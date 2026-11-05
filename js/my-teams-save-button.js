// Nút "Lưu vào đội của tôi" dùng chung cho bốn nguồn (Đội chuẩn/Đội khác, Khai hoang, Gợi ý đội, Soi đội). Nút chỉ biết
// một hàm `build()` trả `{draft, defaultGroup, unresolved?}` và gọi nó LÚC BẤM (biến thể theo URL hiện tại, kết quả
// đang hiển thị), nên đổi biến thể bằng `replaceState` không làm nút lưu nhầm bản.
//  - `draft.id` sinh một lần cho mỗi nguồn (`source.kind:key`) và giữ qua thử lại; chỉ bỏ sau khi server xác nhận.
//  - Khách: cất đội nháp vào `sessionStorage` (my-teams-pending.js) rồi đăng nhập; trang quay lại tự lưu, chỉ xóa bản lưu dở
//    khi server trả `applied`/`already-applied`, lỗi thì toast "Lưu lại" và giữ bản lưu dở.
//  - Đã đăng nhập: hộp thoại chọn hộp + nhóm (mặc định theo nguồn) rồi lưu; toast có link sang `/doi-cua-toi/`.
// Phần nặng (API đồng bộ, bộ chuyển nguồn) nạp lười khi bấm, trang nguồn không tải thêm gì lúc mở.

import { loadSession, signIn, describeError } from "./community-api.js";
import { L, localePath } from "./i18n.js";
import { completePendingSave, peekPendingSave, peekPendingUnresolved, pendingIdForSource, stashPendingSave } from "./my-teams-pending.js";
import { boxLabel, defaultGroupsOf, describeFailure, groupLabel, myTeamsApi, openDialog, showToast } from "./my-teams-ui.js";
import { el } from "./render.js";

const MAIN_BOX = "main";
const SAVE_LABEL = () => L("Lưu vào đội của tôi", "保存到我的阵容");

/** `draft.id` theo nguồn: sinh lần đầu, giữ tới khi server xác nhận (thử lại không sinh bản trùng). */
const draftIds = new Map();

/**
 * Hàm dựng cho trang có payload nhúng (`#team-save-payload`): đọc biến thể LÚC GỌI từ `?variant` của URL hiện tại.
 * Biến thể không có trong payload là lỗi, không rơi về bản mặc định (nút sẽ lưu nhầm bản). Mỗi mục payload mang `unresolved`
 * do build tính (ghi chú bị bỏ vì vượt trần, tên chưa đối chiếu) để thông báo lưu báo đúng số mục.
 */
export function embeddedBuilder({ doc = document, location = globalThis.location } = {}) {
  return async () => {
    const node = doc.querySelector("#team-save-payload");
    if (!node) throw new Error("no-payload");
    const payload = JSON.parse(node.textContent || "null");
    // Chỉ Khai hoang có biến thể trong payload; Đội chuẩn/Đội khác mặc định chỉ có bản "" (biến thể Đội khác dựng lúc chạy).
    const variant = payload?.kind === "khaihoang" ? new URL(location.href).searchParams.get("variant") ?? "" : "";
    const item = payload?.items?.[variant];
    if (!item?.draft) throw new Error("unknown-variant");
    return { draft: structuredClone(item.draft), defaultGroup: item.defaultGroup, unresolved: item.unresolved };
  };
}

/** Gắn `draft.id` ổn định cho nguồn; trả bản dựng kèm khóa nguồn. */
async function prepare(build) {
  const built = await build();
  const { newTeamId } = await import("./my-teams-sources.js");
  const key = `${built.draft.source.kind}:${built.draft.source.key}`;
  const pendingId = pendingIdForSource(key);
  if (pendingId) draftIds.set(key, pendingId);
  else if (!draftIds.has(key)) draftIds.set(key, newTeamId());
  return { ...built, key, draft: { ...built.draft, id: draftIds.get(key) } };
}

const openTeamsHref = () => localePath("/doi-cua-toi/");

/**
 * Phần nhắc của toast lưu theo `unresolved` của bộ chuyển nguồn. Hai loại khác nhau về việc người dùng làm được gì:
 *  - `unresolved` (tên chưa đối chiếu): ô vẫn nằm trong đội với tên gốc, sửa được trong Đội của tôi;
 *  - `over-limit` (dòng ghi chú, phương án thay vượt trần byte): KHÔNG có trong đội đã lưu, chỉ còn ở trang nguồn.
 * Không có gì để báo thì trả chuỗi rỗng.
 */
export function unresolvedNotice(unresolved) {
  const items = Array.isArray(unresolved) ? unresolved : [];
  const names = items.filter((item) => item?.reason !== "over-limit").length;
  const notes = items.filter((item) => item?.reason === "over-limit" && item.field === "notes.general").length;
  const others = items.filter((item) => item?.reason === "over-limit" && item.field !== "notes.general").length;
  return [
    names ? L(` Có ${names} mục chưa đối chiếu được, bạn có thể sửa trong Đội của tôi.`, ` 有 ${names} 项未能匹配，可在“我的阵容”中修改。`) : "",
    notes ? L(` ${notes} dòng ghi chú vượt giới hạn dung lượng nên không được lưu, bản đầy đủ vẫn ở trang nguồn.`, ` ${notes} 行备注超出容量上限，未被保存，完整内容仍在来源页面。`) : "",
    others ? L(` ${others} phương án thay vượt giới hạn nên không được lưu.`, ` ${others} 个替代方案超出上限，未被保存。`) : "",
  ].join("");
}

function successToast(team, unresolved) {
  showToast({
    message: `${L(`Đã lưu “${team.name}” vào Đội của tôi.`, `已将“${team.name}”保存到我的阵容。`)}${unresolvedNotice(unresolved)}`,
    href: openTeamsHref(),
    linkLabel: L("Mở Đội của tôi", "打开我的阵容"),
  });
}

/* ---------- Hộp thoại chọn hộp + nhóm ---------- */

async function openSaveDialog(prep) {
  const api = await myTeamsApi({ dialog: true });
  const snapshot = await api.load();
  const boxes = snapshot.boxes.length ? snapshot.boxes : [{ id: MAIN_BOX, name: "Hộp chính" }];
  const groupsFor = (boxId) => {
    const own = snapshot.groups.filter((group) => group.boxId === boxId);
    return own.length ? own : defaultGroupsOf(boxId);
  };

  const boxSelect = el("select", { class: "ana-input", id: "mt-save-box" }, boxes.map((box) => el("option", { value: box.id }, boxLabel(box))));
  const groupSelect = el("select", { class: "ana-input", id: "mt-save-group" });
  const paintGroups = () => {
    const groups = groupsFor(boxSelect.value);
    groupSelect.replaceChildren(...groups.map((group) => el("option", { value: group.id }, groupLabel(group))));
    groupSelect.value = groups.some((group) => group.id === `${boxSelect.value}~${prep.defaultGroup}`) ? `${boxSelect.value}~${prep.defaultGroup}` : groups[0].id;
  };
  boxSelect.addEventListener("change", paintGroups);
  paintGroups();

  const alert = el("p", { class: "mt-alert", role: "alert", hidden: "" });
  const save = el("button", { type: "button", class: "ana-btn primary" }, L("Lưu", "保存"));
  const cancel = el("button", { type: "button", class: "ana-btn" }, L("Hủy", "取消"));
  const body = el("div", { class: "mt-save-form" }, [
    el("p", { class: "mt-dialog-lead" }, prep.draft.name),
    el("label", { class: "mt-field", for: "mt-save-box" }, [el("span", {}, L("Hộp", "仓库")), boxSelect]),
    el("label", { class: "mt-field", for: "mt-save-group" }, [el("span", {}, L("Nhóm", "分组")), groupSelect]),
    alert,
    el("div", { class: "mt-dialog-actions" }, [cancel, save]),
  ]);
  const { close } = openDialog({ title: L("Lưu vào đội của tôi", "保存到我的阵容"), body });
  cancel.addEventListener("click", close);

  save.addEventListener("click", async () => {
    save.disabled = true;
    alert.hidden = true;
    let result;
    try {
      result = await api.saveTeam(prep.draft, { boxId: boxSelect.value, groupId: groupSelect.value });
    } catch (error) {
      result = { ok: false, code: error?.message };
    }
    if (result.ok) {
      completePendingSave(result);
      draftIds.delete(prep.key);
      close();
      successToast(result.team, prep.unresolved);
      return;
    }
    alert.textContent = describeFailure(result);
    alert.hidden = false;
    save.textContent = L("Lưu lại", "重新保存");
    save.disabled = false;
  });
  groupSelect.focus();
}

/* ---------- Bấm nút ---------- */

async function onSave(build) {
  const prep = await prepare(build);
  const user = await loadSession({ probe: true });
  if (!user) {
    // Rời trang sang Google: cất nháp (đã có id) để trang quay lại lưu đúng một lần, vào hộp chính theo nhóm mặc định của nguồn.
    stashPendingSave({ ...prep.draft, groupId: `${MAIN_BOX}~${prep.defaultGroup}` }, { unresolved: prep.unresolved });
    await signIn();
    return;
  }
  await openSaveDialog(prep);
}

const failedToast = (error, retry) =>
  showToast({
    kind: "error",
    message: error?.message === "unknown-variant" || error?.message === "no-payload"
      ? L("Không dựng được đội để lưu từ trang này.", "无法从此页面生成可保存的阵容。")
      : describeError(error),
    actionLabel: L("Lưu lại", "重新保存"),
    onAction: retry,
  });

/**
 * Nút lưu. `build()` chạy mỗi lần bấm. Bản lưu dở sau đăng nhập được tiếp tục khi module được nạp (cuối file), không chờ
 * nút xuất hiện: trang Gợi ý đội chỉ dựng nút sau khi người dùng bấm "Gợi ý", mà trang quay về từ OAuth chưa có kết quả.
 * @returns {HTMLButtonElement}
 */
export function createSaveButton({ build, className = "detail-action mt-save-btn" }) {
  const button = el("button", { type: "button", class: className, dataset: { mtSave: "" } }, SAVE_LABEL());
  const run = async () => {
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    try {
      await onSave(build);
    } catch (error) {
      failedToast(error, run);
    } finally {
      button.disabled = false;
      button.removeAttribute("aria-busy");
    }
  };
  button.addEventListener("click", run);
  return button;
}

/* ---------- Tiếp tục bản lưu dở sau OAuth ---------- */

let resumed = false;

/**
 * Trang tải với phiên hợp lệ và có bản lưu dở → lưu vào hộp chính. Chỉ xóa bản lưu dở khi `applied`/`already-applied`;
 * lỗi thì toast "Lưu lại" và giữ nguyên. Chưa có phiên (hủy đăng nhập) thì để nguyên tới khi hết hạn.
 */
export async function resumePendingSave() {
  if (resumed || !peekPendingSave()) return;
  resumed = true;
  await attemptPending();
}

async function attemptPending() {
  const draft = peekPendingSave();
  if (!draft) return;
  const unresolved = peekPendingUnresolved();
  try {
    if (!(await loadSession({ probe: true }))) return;
    const api = await myTeamsApi({ dialog: true });
    await api.load();
    const result = await api.saveTeam(draft, { boxId: MAIN_BOX });
    if (completePendingSave(result)) {
      draftIds.delete(`${draft.source.kind}:${draft.source.key}`);
      successToast(result.team, unresolved);
      return;
    }
    showToast({ kind: "error", message: describeFailure(result), actionLabel: L("Lưu lại", "重新保存"), onAction: attemptPending });
  } catch (error) {
    showToast({ kind: "error", message: describeError(error), actionLabel: L("Lưu lại", "重新保存"), onAction: attemptPending });
  }
}

// Mọi trang nạp module này (Đội chuẩn/Khác, Khai hoang, Gợi ý đội, Soi đội) tự tiếp tục bản lưu dở khi tải xong. Không có bản
// lưu dở thì chỉ đọc `sessionStorage`, không gọi mạng.
if (typeof document !== "undefined") void resumePendingSave();
