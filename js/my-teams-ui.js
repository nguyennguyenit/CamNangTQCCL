// Phần giao diện dùng chung của "Đội của tôi": API đồng bộ một thể hiện cho cả trang, hộp thoại, toast và lời nêu lý do
// thất bại. Trang `/doi-cua-toi/` và nút "Lưu vào đội của tôi" ở các trang nguồn cùng dùng, nên không phụ thuộc nhau.

import { L } from "./i18n.js";
import { el } from "./render.js";

/* ---------- API đồng bộ ---------- */

const listeners = new Set();
const apiPromises = { full: null, dialog: null };

/**
 * Một `createMyTeamsApi` cho mỗi chế độ (nạp lười: trang nguồn chỉ nạp khi người dùng bấm lưu). `dialog: true` chỉ kéo hộp +
 * nhóm (đủ cho hộp thoại lưu); mặc định kéo cả đội và kho cho trang `/doi-cua-toi/`.
 */
export function myTeamsApi({ dialog = false } = {}) {
  const mode = dialog ? "dialog" : "full";
  apiPromises[mode] ??= import("./my-teams-api.js").then((module) =>
    module.createMyTeamsApi({ kinds: dialog ? module.SAVE_DIALOG_KINDS : module.MY_TEAMS_KINDS, onChange: () => listeners.forEach((listener) => listener()) }));
  return apiPromises[mode];
}

/** Đăng ký nghe thay đổi của bộ nhớ đệm; trả hàm hủy. */
export function onMyTeamsChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/* ---------- Lý do thất bại ---------- */

const FIELD_LABELS = {
  name: () => L("Tên đội", "阵容名称", "編成名"),
  tierLabel: () => L("Hạng", "评级", "ランク"),
  seasonId: () => L("Mùa", "赛季", "シーズン"),
  replacesTeamId: () => L("Thay thế cho đội", "替换的阵容", "置き換え対象の編成"),
  heroes: () => L("Số tướng", "武将数量", "武将数"),
  notes: () => L("Ghi chú", "备注", "メモ"),
  total: () => L("Tổng dung lượng đội", "阵容总容量", "編成の合計容量"),
};

const FIELD_PART_LABELS = {
  rawName: () => L("tên gốc", "原名", "元の名前"),
  bookType: () => L("loại binh thư", "兵书类型", "兵法書タイプ"),
  troopNote: () => L("binh chủng", "兵种", "兵種"),
  statNote: () => L("cộng điểm", "加点", "ポイント振り分け"),
  gearNote: () => L("trang bị", "装备", "装備"),
  general: () => L("ghi chú chung", "综合备注", "総合メモ"),
  strengths: () => L("điểm mạnh", "优点", "長所"),
  goodAgainst: () => L("khắc chế", "克制", "有利な相手"),
  avoid: () => L("nên tránh", "避免", "避けたい相手"),
};

const CODE_REASONS = {
  bytes: () => L("quá dài", "超出长度上限", "長さの上限超過"),
  count: () => L("sai số lượng", "数量不符", "数が一致しません"),
  required: () => L("còn thiếu", "缺失", "未入力"),
  pattern: () => L("sai định dạng", "格式不正确", "形式が正しくありません"),
  enum: () => L("giá trị không hợp lệ", "取值无效", "値が無効です"),
  control: () => L("chứa ký tự điều khiển", "含控制字符", "制御文字を含んでいます"),
};

/** Tên trường lỗi của `validateTeam` bằng chữ người dùng đọc được (`heroes[1].statNote` → "Tướng 2 · cộng điểm"). */
export function fieldLabel(field) {
  const hero = /^heroes\[(\d)\](?:\.(\w+))?/u.exec(field);
  if (hero) {
    const part = hero[2] && FIELD_PART_LABELS[hero[2]] ? ` · ${FIELD_PART_LABELS[hero[2]]()}` : "";
    return `${L("Tướng", "武将", "武将")} ${Number(hero[1]) + 1}${part}`;
  }
  const note = /^notes\.(\w+)/u.exec(field);
  if (note) return `${L("Ghi chú", "备注", "メモ")} · ${FIELD_PART_LABELS[note[1]]?.() ?? note[1]}`;
  return FIELD_LABELS[field]?.() ?? field;
}

/** Câu nêu lý do cho kết quả thất bại của `saveTeam` và các thao tác hộp/nhóm/đội. */
export function describeFailure(result) {
  if (result?.conflict) return L("Đội này vừa được sửa ở nơi khác. Hãy chọn bản muốn giữ.", "该阵容刚在别处被修改，请选择要保留的版本。", "この編成は他の場所で変更されました。残すバージョンを選んでください。");
  if (result?.pending) return L("Chưa lưu được vì mất kết nối. Nội dung vẫn còn nguyên, hãy lưu lại khi có mạng.", "网络中断，尚未保存。内容仍保留，联网后请重新保存。", "接続が切れたため保存できていません。内容は保持されています。接続が回復したら再保存してください。");
  if (result?.code === "validation") {
    const list = (result.errors ?? []).map((error) => `${fieldLabel(error.field)}: ${CODE_REASONS[error.code]?.() ?? error.code}`);
    return list.length
      ? L(`Đội chưa hợp lệ: ${list.join("; ")}.`, `阵容无效：${list.join("；")}。`, `編成が無効です：${list.join("；")}。`)
      : L("Nội dung chưa hợp lệ (tên trống hoặc quá dài).", "内容无效（名称为空或过长）。", "内容が無効です（名前が空、または長すぎます）。");
  }
  switch (result?.code) {
    case "guest":
    case "signed-out":
      return L("Phiên đăng nhập đã hết. Hãy đăng nhập lại.", "登录已失效，请重新登录。", "ログインの有効期限が切れました。再度ログインしてください。");
    case "mismatch":
      return L("Tài khoản đã đổi ở tab khác. Hãy tải lại trang.", "账号已在其他标签页切换，请刷新页面。", "別のタブでアカウントが切り替わりました。ページを再読み込みしてください。");
    case "schema":
      return L("Đội có dữ liệu sai hình dạng nên không lưu được.", "阵容数据结构有误，无法保存。", "編成データの構造が不正なため、保存できません。");
    case "bytes":
      return L("Đội quá lớn để lưu. Hãy rút gọn các ô chữ.", "阵容过大无法保存，请精简文字。", "編成が大きすぎて保存できません。文章を短くしてください。");
    case "quota":
    case "cap":
    case "retained_cap":
      return L("Tài khoản đã đạt giới hạn số lượng cho phép.", "账号已达到数量上限。", "アカウントの件数が上限に達しました。");
    case "team_gone":
      return L("Đội này vừa bị xóa hoặc chuyển hộp ở thiết bị khác. Chưa ghi gì. Bấm Lưu lần nữa để lưu thành đội mới, hoặc Hủy để bỏ.", "此阵容刚在其他设备上被删除或移到别的仓库，尚未写入任何内容。再次点击“保存”可保存为新阵容，或点击“取消”放弃。", "この編成は他の端末で削除されたか、別の倉庫に移動されました。まだ何も書き込まれていません。もう一度「保存」を押すと新しい編成として保存され、「キャンセル」で破棄されます。");
    case "box_missing":
      return L("Hộp này không còn. Hãy tải lại trang.", "该仓库已不存在，请刷新页面。", "この倉庫は存在しません。ページを再読み込みしてください。");
    case "group_missing":
      return L("Nhóm này không còn. Hãy chọn nhóm khác.", "该分组已不存在，请选择其他分组。", "このグループは存在しません。別のグループを選んでください。");
    case "default_protected":
      return L("Hộp chính và hai nhóm mặc định không xóa hoặc đổi tên được.", "主仓库和两个默认分组不能删除或改名。", "メイン倉庫と既定の2グループは削除・名前変更できません。");
    case "not_found":
      return L("Mục này không còn. Hãy tải lại trang.", "该项已不存在，请刷新页面。", "この項目は存在しません。ページを再読み込みしてください。");
    case "clock_skew":
      return L("Đồng hồ máy lệch quá nhiều so với máy chủ. Hãy chỉnh giờ rồi lưu lại.", "本机时间与服务器相差过大，请校准后重新保存。", "端末の時刻がサーバーと大きくずれています。時刻を合わせてから再保存してください。");
    default:
      return L(`Không lưu được (${result?.code ?? "lỗi"}). Nội dung vẫn còn nguyên, hãy thử lại.`, `无法保存（${result?.code ?? "错误"}）。内容仍保留，请重试。`, `保存できません（${result?.code ?? "エラー"}）。内容は保持されています。もう一度お試しください。`);
  }
}

/* ---------- Hộp thoại ---------- */

let dialogSeq = 0;

/**
 * Hộp thoại `<dialog>` native (`showModal`: trình duyệt giam focus, Escape tự đóng). Trả focus về nút đã mở khi đóng.
 * @returns {{dialog: HTMLDialogElement, close(): void, titleId: string}}
 */
export function openDialog({ title, body, className = "" }) {
  const titleId = `mt-dialog-title-${++dialogSeq}`;
  const opener = document.activeElement;
  const dialog = el("dialog", { class: `mt-dialog ${className}`.trim(), "aria-labelledby": titleId }, [
    el("div", { class: "mt-dialog-body" }, [el("h2", { id: titleId, class: "mt-dialog-title" }, title), body]),
  ]);
  document.body.append(dialog);
  dialog.addEventListener("close", () => {
    dialog.remove();
    if (opener?.isConnected) opener.focus?.();
  });
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
  return { dialog, close: () => dialog.close?.() ?? dialog.remove(), titleId };
}

/* ---------- Toast ---------- */

const TOAST_MS = 10_000;

function toastRegion() {
  let region = document.getElementById("mt-toasts");
  if (!region) {
    region = el("div", { id: "mt-toasts", class: "mt-toasts" });
    document.body.append(region);
  }
  return region;
}

/**
 * Thông báo nổi. `kind: "error"` dùng `role="alert"` và ở lại tới khi đóng; thành công tự tắt sau 10 giây. `href` thêm
 * một liên kết, `onAction` thêm một nút (vd. "Lưu lại").
 */
export function showToast({ message, kind = "success", href, linkLabel, actionLabel, onAction }) {
  const close = el("button", { type: "button", class: "mt-toast-close", "aria-label": L("Đóng thông báo", "关闭通知", "通知を閉じる") }, "×");
  const toast = el("div", { class: "mt-toast", role: kind === "error" ? "alert" : "status", dataset: { kind } }, [
    el("p", { class: "mt-toast-text" }, message),
    href ? el("a", { class: "mt-toast-link", href }, linkLabel) : null,
    actionLabel ? el("button", { type: "button", class: "mt-toast-action", onclick: () => { toast.remove(); onAction?.(); } }, actionLabel) : null,
    close,
  ]);
  close.addEventListener("click", () => toast.remove());
  toastRegion().append(toast);
  if (kind !== "error") setTimeout(() => toast.remove(), TOAST_MS);
  return toast;
}

/* ---------- Nhãn hộp/nhóm ---------- */

const MAIN_DEFAULT_NAME = "Hộp chính";

/** Hộp chính còn tên mặc định hiện theo ngôn ngữ trang; hộp đã đặt tên (kể cả `main` đã đổi tên) giữ nguyên tên đó. */
export const boxLabel = (box) => {
  const name = String(box?.name ?? "").trim();
  if (box?.id === "main" && (!name || name === MAIN_DEFAULT_NAME)) return L("Hộp chính", "主仓库", "メイン倉庫");
  return name || String(box?.id ?? "");
};

/** Hai nhóm mặc định hiện theo ngôn ngữ trang; nhóm tự đặt giữ nguyên tên. */
export function groupLabel(group) {
  if (/~khai-hoang$/u.test(group?.id ?? "")) return L("Khai Hoang", "开荒", "開拓");
  if (/~ghep-team$/u.test(group?.id ?? "")) return L("Ghép Team", "组队", "チーム編成");
  return String(group?.name ?? group?.id ?? "");
}

/** Hai nhóm mặc định của một hộp chưa có bản ghi nhóm nào (hộp mới, chưa đồng bộ). */
export const defaultGroupsOf = (boxId) => [
  { id: `${boxId}~khai-hoang`, boxId, name: "Khai Hoang", order: 0 },
  { id: `${boxId}~ghep-team`, boxId, name: "Ghép Team", order: 1 },
];
