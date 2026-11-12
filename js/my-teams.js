// Trang Đội của tôi (`/doi-cua-toi/`, `/zh/doi-cua-toi/`, artboard DoiCuaToi): bắt buộc đăng nhập; hộp → nhóm → đội.
// Dữ liệu là bản sao riêng của người dùng (js/my-teams-api.js trên `/api/roster`), không có chế độ offline. Mọi chữ người
// dùng nhập luôn là text node. Khách chỉ thấy thẻ mời đăng nhập và KHÔNG gọi `/api/roster`.
// Xóa hộp / nhóm / đội luôn hỏi lại bằng hộp xác nhận trong trang (`confirmInPage`, js/inline-confirm.js); Hủy hoặc
// Escape trả focus về nút Xóa, xóa xong focus sang chỗ hợp lý còn lại (ô chọn hộp hoặc tên nhóm).

import { L, currentLocale } from "./i18n.js";
import { loadSession, describeError, unavailableNotice } from "./community-api.js";
import { createTeamLexicon, loadTeamBooks, loadTeamDictionaries, recordLabel } from "./community-team-data.js";
import { confirmInPage } from "./inline-confirm.js";
import { teamCard } from "./my-teams-cards.js";
import { createTeamEditor } from "./my-teams-editor.js";
import { createSourceLinker, loadSourceIndex } from "./my-teams-links.js";
import { duplicateWarnings } from "./my-teams-model.js";
import { addGroupForm, boxBar, dupsSection, groupHead, guestCard, privacyNote } from "./my-teams-sections.js";
import { boxLabel, defaultGroupsOf, describeFailure, groupLabel, myTeamsApi, onMyTeamsChange, openDialog } from "./my-teams-ui.js";
import { bookRowId } from "./lookup-ids.js";
import { buildCatalog } from "./roster-picker.js";
import { el } from "./render.js";
import { setTeamRouteHandlesFromJSON } from "./team-detail-navigation.js";

const MAIN_BOX = "main";

async function loadNames(locale) {
  try {
    const [{ heroes, tactics }, books] = await Promise.all([loadTeamDictionaries(), loadTeamBooks()]);
    const lexicon = createTeamLexicon({ heroes, tactics, books }, locale);
    const bookIndex = new Map(books.map((book) => [bookRowId(book), book]));
    return {
      ready: true,
      names: {
        hero: (id) => lexicon.heroName(id),
        tactic: (id) => lexicon.tacticName(id),
        book: (id) => recordLabel(bookIndex.get(id), locale) || String(id),
      },
      catalog: buildCatalog({ heroesDict: heroes, tacticsDict: tactics, books }, "editor"),
    };
  } catch {
    return { ready: false, names: { hero: String, tactic: String, book: String }, catalog: [] };
  }
}

/** JSON nhúng trong trang (bảng route, danh mục mùa); hỏng thì trả `fallback`. */
function embedded(id, fallback) {
  try {
    return JSON.parse(document.getElementById(id)?.textContent ?? "") ?? fallback;
  } catch {
    return fallback;
  }
}

export async function initMyTeams(mount = document.getElementById("my-teams")) {
  if (!mount) return null;
  const locale = currentLocale();

  let user;
  try {
    user = await loadSession({ probe: true });
  } catch {
    mount.replaceChildren(unavailableNotice());
    return null;
  }
  if (!user) {
    mount.replaceChildren(guestCard());
    return null;
  }

  // Bảng route đầy đủ {r, l, k} của trang (layout chỉ nhúng {l}): dựng link nguồn cho mọi họ đội.
  setTeamRouteHandlesFromJSON(document.getElementById("my-teams-routes")?.textContent ?? "");
  const linker = createSourceLinker(embedded("my-teams-routes", {}));
  const seasons = Array.isArray(embedded("my-teams-seasons", [])) ? embedded("my-teams-seasons", []) : [];
  const seasonLabel = (id) => seasons.find((season) => season.id === id)?.label ?? id;

  /** `editing`: id đội đang sửa (trình soạn thay thẻ tại chỗ); `saved`: id đội vừa lưu (thẻ hiện "Đã lưu thay đổi."). */
  const view = { boxId: MAIN_BOX, editing: null, editor: null, saved: null };
  let api;
  let lexicon;
  let sourceIndex = null;

  // Vùng báo luôn có trong DOM (không bật `hidden` cùng lúc đặt chữ, để trình đọc màn hình nghe được); rỗng thì CSS thu gọn.
  const status = el("p", { class: "mt-status", role: "status", "aria-live": "polite" });
  const errorBox = el("p", { class: "mt-alert", role: "alert", hidden: "" });
  const body = el("div", { class: "mt-body" });
  const say = (message) => {
    status.textContent = message;
  };
  const fail = (result) => {
    errorBox.textContent = describeFailure(result);
    errorBox.hidden = false;
  };
  const clearMessages = () => {
    view.saved = null;
    errorBox.hidden = true;
    errorBox.textContent = "";
    say("");
  };
  const focusLater = (selector) => body.querySelector(selector)?.focus();

  /** Chạy một thao tác `api.*`; thành công thì vẽ lại, thất bại thì nêu lý do bằng `role="alert"`. */
  async function run(operation, success) {
    clearMessages();
    const result = await operation();
    if (!result.ok) {
      fail(result);
      return result;
    }
    if (success) say(success(result));
    paint();
    return result;
  }

  /** Hỏi lại trong trang trước khi xóa; thao tác lỗi thì hộp giữ mở và nêu lý do. Trả `true` khi đã xóa. */
  const confirmDelete = ({ title, message, confirmLabel, operation, success }) => confirmInPage({
    title,
    message,
    confirmLabel,
    cancelLabel: L("Hủy", "取消"),
    onConfirm: async () => {
      clearMessages();
      const result = await operation();
      if (!result.ok) return describeFailure(result);
      say(success);
      paint();
      return true;
    },
  });

  /** Đóng trình soạn đang mở (gỡ listener của nó); không vẽ lại. */
  function closeEditor() {
    view.editor?.dispose();
    view.editing = view.editor = null;
  }

  /**
   * Trước thao tác sẽ đóng / thay trình soạn: bản soạn có thay đổi chưa lưu thì hỏi lại trong trang. Trả `true` khi được
   * đi tiếp (không có trình soạn, chưa sửa gì, hoặc người dùng chọn bỏ thay đổi); `false` khi Hủy. Không tự đóng
   * trình soạn: thao tác đóng nó khi thật sự xảy ra (đổi hộp, tạo / xóa hộp xong — `paint` đóng trình soạn của hộp khác).
   */
  async function discardOk() {
    if (!view.editor?.isDirty()) return true;
    return confirmInPage({
      title: L("Bỏ thay đổi chưa lưu?", "放弃未保存的更改？"),
      message: L("Đội đang sửa có thay đổi chưa lưu. Tiếp tục thì các thay đổi này mất.", "正在编辑的阵容有未保存的更改，继续将丢失这些更改。"),
      confirmLabel: L("Bỏ thay đổi", "放弃更改"),
      cancelLabel: L("Hủy", "取消"),
    });
  }

  /** Như `discardOk`, rồi đóng trình soạn khi được đi tiếp (người gọi vẽ lại). */
  async function leaveEditorOk() {
    if (!(await discardOk())) return false;
    closeEditor();
    return true;
  }

  /* ---------- Hộp thoại nhập tên (tạo / đổi tên hộp, nhóm) ---------- */

  function promptDialog({ title, label, value = "", confirmLabel, submit }) {
    const input = el("input", { class: "ana-input mt-input", type: "text", id: "mt-prompt-input", autocomplete: "off" });
    input.value = value;
    const alert = el("p", { class: "mt-alert", role: "alert", hidden: "" });
    const confirm = el("button", { type: "submit", class: "ana-btn primary" }, confirmLabel);
    const cancel = el("button", { type: "button", class: "ana-btn" }, L("Hủy", "取消"));
    const form = el("form", { class: "mt-prompt", novalidate: "" }, [
      el("div", { class: "mt-field" }, [el("label", { for: "mt-prompt-input" }, label), input]),
      alert,
      el("div", { class: "mt-dialog-actions" }, [cancel, confirm]),
    ]);
    const { close } = openDialog({ title, body: form });
    cancel.addEventListener("click", close);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      confirm.disabled = true;
      const result = await submit(input.value);
      if (result.ok) {
        close();
        return;
      }
      alert.textContent = describeFailure(result);
      alert.hidden = false;
      confirm.disabled = false;
    });
    input.focus();
    input.select();
  }

  /* ---------- Thao tác ---------- */

  const nameOf = (id, kind) => lexicon.names[kind](id);

  const cardDeps = {
    nameOf,
    sourceHref: (team) => linker.href(team.source, locale),
    updated: (team) => {
      const indexed = sourceIndex?.[`${team.source.kind}:${team.source.key}`];
      return Boolean(team.source.contentHash) && typeof indexed === "string" && indexed !== team.source.contentHash;
    },
    seasonLabel,
    get editable() {
      return lexicon.ready;
    },
    onEdit: async (team) => {
      if (view.editing === team.id) return;
      if (!(await leaveEditorOk())) return;
      // Thẻ được vẽ từ lần trước: lấy bản đội mới nhất (có thể vừa đổi hoặc bị xóa ở máy khác trong lúc hỏi lại).
      const fresh = api.snapshot().teams.find((candidate) => candidate.id === team.id);
      if (!fresh) {
        paint();
        return;
      }
      openEditor(fresh);
    },
    onMove: (team, select) => run(() => api.moveTeam(team.id, select.value), () => L("Đã chuyển nhóm.", "已移动分组。")).then((result) => {
      if (!result.ok) paint();
    }),
    onDelete: async (team) => {
      const groupId = team.groupId;
      const done = await confirmDelete({
        title: L(`Xóa đội “${team.name}”?`, `删除阵容“${team.name}”？`),
        message: L(`Đội bị xóa khỏi Đội của tôi trên mọi máy. Việc này không hoàn tác được.`, `该阵容将从所有设备的“我的阵容”中删除。此操作无法撤销。`),
        confirmLabel: L("Xóa đội", "删除阵容"),
        operation: () => api.deleteTeam(team.id),
        success: L("Đã xóa đội.", "已删除阵容。"),
      });
      if (done) (body.querySelector(`.mt-group[data-group-id="${CSS.escape(groupId)}"] .mt-group-name`) ?? body.querySelector(".mt-group-name"))?.focus();
    },
  };

  /* ---------- Danh sách ---------- */

  function paint() {
    const snapshot = api.snapshot();
    const boxes = snapshot.boxes.length ? snapshot.boxes : [{ id: MAIN_BOX, name: "Hộp chính" }];
    if (!boxes.some((box) => box.id === view.boxId)) view.boxId = MAIN_BOX;
    const box = boxes.find((candidate) => candidate.id === view.boxId);
    const groups = snapshot.groups.filter((group) => group.boxId === view.boxId);
    const shownGroups = groups.length ? groups : defaultGroupsOf(view.boxId);
    const teams = snapshot.teams.filter((team) => team.boxId === view.boxId);
    const warnings = duplicateWarnings(teams);
    const owned = snapshot.owned.get(view.boxId) ?? new Set();
    const fallback = shownGroups.find((group) => group.id === `${view.boxId}~ghep-team`) ?? shownGroups[shownGroups.length - 1];
    const groupOf = (team) => shownGroups.find((group) => group.id === team.groupId) ?? fallback;
    const teamCounts = new Map();
    for (const team of snapshot.teams) teamCounts.set(team.boxId, (teamCounts.get(team.boxId) ?? 0) + 1);
    // Đội đang sửa đã bị xóa ở nơi khác: đóng trình soạn (không còn bản ghi để lưu vào).
    if (view.editing && !teams.some((team) => team.id === view.editing)) closeEditor();

    const bar = boxBar({ boxes, boxId: view.boxId, teamCounts, owned }, {
      onSelect: async (boxId) => {
        // Hủy bỏ thay đổi: ô chọn trả về hộp đang xem, trình soạn giữ nguyên.
        if (!(await leaveEditorOk())) {
          body.querySelector("#mt-box").value = view.boxId;
          return;
        }
        view.boxId = boxId;
        paint();
        focusLater("#mt-box");
      },
      onCreate: async () => (await discardOk()) && promptDialog({
        title: L("Tạo hộp", "新建仓库"),
        label: L("Tên hộp", "仓库名称"),
        confirmLabel: L("Tạo hộp", "新建"),
        submit: async (name) => {
          const result = await api.createBox(name);
          if (result.ok) {
            view.boxId = result.boxId;
            say(L("Đã tạo hộp.", "已新建仓库。"));
            paint();
          }
          return result;
        },
      }),
      onRename: () => promptDialog({
        title: L("Đổi tên hộp", "重命名仓库"),
        label: L("Tên hộp", "仓库名称"),
        value: boxLabel(box),
        confirmLabel: L("Lưu tên", "保存名称"),
        submit: async (name) => {
          const result = await api.renameBox(box.id, name);
          if (result.ok) paint();
          return result;
        },
      }),
      onDelete: async () => {
        if (!(await discardOk())) return;
        const done = await confirmDelete({
          title: L(`Xóa hộp “${boxLabel(box)}”?`, `删除仓库“${boxLabel(box)}”？`),
          message: L(`Xóa hộp sẽ mất ${teams.length} đội, các nhóm và kho của hộp này. Không hoàn tác được.`, `删除仓库将同时失去 ${teams.length} 个阵容及该仓库的分组和库存，且无法撤销。`),
          confirmLabel: L("Xóa hộp", "删除仓库"),
          operation: async () => {
            const result = await api.deleteBox(box.id);
            if (result.ok) view.boxId = MAIN_BOX;
            return result;
          },
          success: L("Đã xóa hộp.", "已删除仓库。"),
        });
        if (done) focusLater("#mt-box");
      },
    });

    const notices = [];
    if (!lexicon.ready) notices.push(el("p", { class: "mt-notice", role: "status" }, L("Chưa tải được danh mục tướng và chiến pháp: tên hiện tạm dưới dạng mã và chưa thể sửa đội.", "未能加载武将与战法图鉴：名称暂以编号显示，暂时无法编辑阵容。")));
    const skipped = snapshot.skipped.filter((item) => item.boxId === view.boxId);
    if (skipped.length) notices.push(el("p", { class: "mt-notice", role: "status", dataset: { skipped: String(skipped.length) } }, L(`${skipped.length} bản ghi đội bị hỏng nên không hiển thị; các đội khác không bị ảnh hưởng.`, `${skipped.length} 条阵容记录已损坏，未显示；其他阵容不受影响。`)));
    if (snapshot.rejected.length) notices.push(el("p", { class: "mt-alert", role: "alert" }, L(`${snapshot.rejected.length} thay đổi bị máy chủ từ chối: ${describeFailure({ code: snapshot.rejected[0].code })}`, `${snapshot.rejected.length} 项更改被服务器拒绝：${describeFailure({ code: snapshot.rejected[0].code })}`)));
    if (warnings.length) notices.push(dupsSection(warnings, teams, nameOf));

    const ctx = { teams, groups: shownGroups, warnings, owned, groupOf };
    const sections = shownGroups.map((group) => {
      const own = teams.filter((team) => groupOf(team).id === group.id).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
      const isDefault = /~(?:khai-hoang|ghep-team)$/u.test(group.id);
      const head = groupHead(group, own.length, isDefault, {
        onRename: () => promptDialog({
          title: L("Đổi tên nhóm", "重命名分组"),
          label: L("Tên nhóm", "分组名称"),
          value: group.name,
          confirmLabel: L("Lưu tên", "保存名称"),
          submit: async (name) => {
            const result = await api.renameGroup(group.id, name);
            if (result.ok) paint();
            return result;
          },
        }),
        onDelete: async () => {
          const done = await confirmDelete({
            title: L(`Xóa nhóm “${groupLabel(group)}”?`, `删除分组“${groupLabel(group)}”？`),
            message: L(`${own.length} đội trong nhóm sẽ chuyển về Ghép Team. Nhóm bị xóa không khôi phục được.`, `组内 ${own.length} 个阵容将移至“组队”。分组删除后无法恢复。`),
            confirmLabel: L("Xóa nhóm", "删除分组"),
            operation: () => api.deleteGroup(group.id),
            success: L("Đã xóa nhóm.", "已删除分组。"),
          });
          if (done) focusLater(`.mt-group[data-group-id="${CSS.escape(`${view.boxId}~ghep-team`)}"] .mt-group-name`);
        },
      });
      const items = own.map((team) => (team.id === view.editing && view.editor ? view.editor : teamCard(team, { ...ctx, saved: team.id === view.saved }, cardDeps)));
      return el("section", { class: "mt-group", dataset: { groupId: group.id }, "aria-label": groupLabel(group) }, [
        head,
        own.length
          ? el("div", { class: "mt-teams" }, items)
          : el("p", { class: "mt-empty" }, L("Chưa có đội trong nhóm này. Khi lưu đội, chọn nhóm này trong hộp thoại lưu hoặc dùng ô “Nhóm” trên thẻ đội để chuyển sang.", "此分组暂无阵容。保存阵容时在保存对话框中选择此分组，或用阵容卡片上的“分组”移入。")),
      ]);
    });

    const addGroup = addGroupForm(async (input, submit) => {
      if (submit.disabled) return;
      submit.disabled = true;
      try {
        const result = await run(() => api.createGroup(view.boxId, input.value), () => L("Đã thêm nhóm.", "已添加分组。"));
        if (result.ok) body.querySelector("#mt-new-group").value = "";
      } finally {
        submit.disabled = false;
      }
    });

    body.replaceChildren(...[
      bar,
      ...notices,
      teams.length === 0 ? el("p", { class: "mt-empty mt-empty-all" }, L("Hộp này chưa có đội. Bấm “Lưu vào đội của tôi” ở Đội chuẩn, Đội khác, Khai hoang, Gợi ý đội hoặc Soi đội để thêm.", "此仓库还没有阵容。在推荐阵容、其他阵容、开荒、武将库配队或截图识阵中点击“保存到我的阵容”即可添加。")) : null,
      ...sections,
      addGroup,
      privacyNote(),
    ].filter(Boolean));
  }

  /* ---------- Trình soạn (thay thẻ đội tại chỗ) ---------- */

  function openEditor(team) {
    const snapshot = api.snapshot();
    const groups = snapshot.groups.filter((group) => group.boxId === team.boxId);
    clearMessages();
    const leave = (savedId = null) => {
      closeEditor();
      view.saved = savedId;
      paint();
      body.querySelector(`[data-team-id="${CSS.escape(team.id)}"] .mt-team-actions button`)?.focus();
    };
    view.saved = null;
    view.editing = team.id;
    view.editor = createTeamEditor({
      team,
      teams: snapshot.teams.filter((other) => other.boxId === team.boxId),
      groups: groups.length ? groups : defaultGroupsOf(team.boxId),
      names: lexicon.names,
      catalog: lexicon.catalog,
      owned: snapshot.owned.get(team.boxId) ?? new Set(),
      seasons,
      save: (candidate) => {
        // Nhóm đã chọn bị xóa trong lúc soạn (ở đây hoặc máy khác): lưu vào nhóm dự phòng Ghép Team của hộp,
        // không ghi id nhóm không còn.
        const live = api.snapshot().groups.some((group) => group.id === candidate.groupId && group.boxId === team.boxId);
        const groupId = live ? candidate.groupId : `${team.boxId}~ghep-team`;
        return api.saveTeam({ ...candidate, groupId }, { boxId: team.boxId, groupId });
      },
      onSaved: () => {
        leave(team.id);
        say(L("Đã lưu thay đổi.", "已保存更改。"));
      },
      onCancel: () => leave(),
      onKeepServer: () => {
        say(L("Đã giữ bản trên máy chủ.", "已保留服务器版本。"));
        leave();
      },
    });
    paint();
    view.editor?.querySelector("input")?.focus();
  }

  /* ---------- Khởi động ---------- */

  mount.replaceChildren(el("p", { class: "mt-loading", role: "status" }, L("Đang tải đội của bạn…", "正在加载你的阵容…")));
  try {
    api = await myTeamsApi();
    const [loaded, names, index] = await Promise.all([api.load(), loadNames(locale), loadSourceIndex()]);
    lexicon = names;
    sourceIndex = index;
    if (loaded.status === "guest" || loaded.status === "signed-out") {
      mount.replaceChildren(guestCard({ expired: true }));
      return null;
    }
    // Hộp chính + hai nhóm mặc định luôn có trước khi vẽ (idempotent, cùng request với lần lưu đầu).
    await api.ensureBoxDefaults(MAIN_BOX);
  } catch (error) {
    mount.replaceChildren(el("p", { class: "mt-alert", role: "alert" }, describeError(error)));
    return null;
  }
  mount.replaceChildren(status, errorBox, body);
  paint();
  // Đồng bộ nền vẽ lại danh sách, trừ lúc đang sửa (vẽ lại sẽ gỡ trình soạn khỏi DOM và làm mất focus của người dùng).
  onMyTeamsChange(() => {
    if (!view.editing) paint();
  });
  return { paint };
}

initMyTeams();
