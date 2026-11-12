// Các khối khung của "Đội của tôi" (artboard DoiCuaToi): thanh hộp + kho, cảnh báo trùng, đầu nhóm, form thêm nhóm,
// dòng riêng tư, thẻ mời đăng nhập cho khách. Thuần dựng DOM; thao tác (tạo/đổi tên/xóa) do js/my-teams.js truyền vào.

import { signInPrompt } from "./community-api.js";
import { L, localePath } from "./i18n.js";
import { teamAnchor } from "./my-teams-cards.js";
import { mtIcon } from "./my-teams-icons.js";
import { boxLabel, groupLabel } from "./my-teams-ui.js";
import { el } from "./render.js";

const MAIN_BOX = "main";
const ROSTER_PATH = "/goi-y-doi-tu-kho/";

const button = (label, iconName, { ghost = false, danger = false, small = false, action, onclick } = {}) => el("button", {
  type: "button",
  class: ["ana-btn mt-btn", ghost && "mt-btn-ghost", danger && "mt-delete", small && "mt-btn-sm"].filter(Boolean).join(" "),
  dataset: action ? { action } : {},
  onclick,
}, [mtIcon(iconName, small ? 15 : 16), label]);

/** Đếm tướng / chiến pháp trong kho của hộp (món kho là id `hero:…`, `tactic:…`, `book:…`). */
export function stockCounts(owned) {
  let heroes = 0;
  let tactics = 0;
  for (const item of owned) {
    if (item.startsWith("hero:")) heroes += 1;
    else if (item.startsWith("tactic:")) tactics += 1;
  }
  return { heroes, tactics };
}

/**
 * Thanh hộp: ô chọn hộp (kèm số đội), tình trạng kho của hộp, Tạo hộp · Đổi tên hộp · Xóa hộp (hộp chính thì ghi chú khóa).
 * @param actions {onSelect(boxId), onCreate, onRename, onDelete(button)}
 */
export function boxBar({ boxes, boxId, teamCounts, owned }, actions) {
  const select = el("select", { id: "mt-box" }, boxes.map((box) => el("option", { value: box.id },
    L(`${boxLabel(box)} · ${teamCounts.get(box.id) ?? 0} đội`, `${boxLabel(box)} · ${teamCounts.get(box.id) ?? 0} 个阵容`))));
  select.value = boxId;
  select.addEventListener("change", () => actions.onSelect(select.value));

  const { heroes, tactics } = stockCounts(owned);
  const rosterLink = (text) => el("a", { href: localePath(ROSTER_PATH) }, text);
  const info = owned.size
    ? [
      el("p", { class: "mt-boxinfo-main" }, [mtIcon("box"), el("span", {}, [L("Kho của hộp: ", "仓库库存："), el("strong", {}, L(`${heroes} tướng · ${tactics} chiến pháp`, `${heroes} 名武将 · ${tactics} 个战法`))])]),
      el("p", { class: "mt-boxinfo-sub" }, [L("Dấu “chưa có trong kho” so với kho này. ", "“库中没有”标记以此库存为准。"), rosterLink(L("Sửa kho ở Gợi ý đội", "在武将库配队中修改库存"))]),
    ]
    : [
      el("p", { class: "mt-boxinfo-main" }, [mtIcon("box"), el("span", {}, L("Hộp này chưa có kho.", "此仓库还没有库存。"))]),
      el("p", { class: "mt-boxinfo-sub" }, [L("Nhập kho để biết đội thiếu món nào. ", "录入库存后即可看出阵容缺哪些。"), rosterLink(L("Nhập kho ở Gợi ý đội", "在武将库配队中录入库存"))]),
    ];

  return el("section", { class: "mt-boxbar", "aria-label": L("Hộp kho", "仓库") }, [
    el("label", { class: "mt-boxfield", for: "mt-box" }, [el("span", { class: "mt-boxfield-label" }, L("Hộp", "仓库")), select, mtIcon("chevron")]),
    el("div", { class: "mt-boxinfo", dataset: { stock: owned.size ? "yes" : "no" } }, info),
    el("div", { class: "mt-toolbar mt-boxactions" }, [
      button(L("Tạo hộp", "新建仓库"), "plus", { action: "create-box", onclick: actions.onCreate }),
      button(L("Đổi tên hộp", "重命名"), "pencil", { ghost: true, action: "rename-box", onclick: actions.onRename }),
      boxId === MAIN_BOX
        ? el("span", { class: "mt-boxlock" }, [mtIcon("lock", 14), L("Hộp chính không xóa được", "主仓库不能删除")])
        : (() => {
          const remove = button(L("Xóa hộp", "删除仓库"), "trash", { ghost: true, danger: true, action: "delete-box" });
          remove.addEventListener("click", () => actions.onDelete(remove));
          return remove;
        })(),
    ]),
  ]);
}

/** Khối cảnh báo trùng tướng/chiến pháp chính trong hộp; mỗi cặp link tới hai thẻ đội. */
export function dupsSection(warnings, teams, nameOf) {
  const link = (team) => el("a", { href: `#${teamAnchor(team?.id ?? "")}` }, `“${team?.name ?? "?"}”`);
  return el("section", { class: "mt-dups", id: "mt-dups", "aria-labelledby": "mt-dups-title" }, [
    el("div", { class: "mt-dups-icon" }, [mtIcon("warn", 20)]),
    el("div", { class: "mt-dups-body" }, [
      el("h2", { class: "mt-dups-title", id: "mt-dups-title" }, L(`${warnings.length} cặp đội trùng tướng hoặc chiến pháp chính trong hộp này`, `此仓库内有 ${warnings.length} 对阵容的武将或主战法重复`)),
      el("ul", { class: "mt-dups-list" }, warnings.map((warning) => {
        const a = teams.find((team) => team.id === warning.a);
        const b = teams.find((team) => team.id === warning.b);
        const what = [...warning.heroes.map((id) => nameOf(id, "hero")), ...warning.tactics.map((id) => nameOf(id, "tactic"))].join(L(", ", "、"));
        return el("li", {}, [link(a), L(" và ", " 与 "), link(b), L(": ", "："), el("span", { class: "mt-dup-what" }, what)]);
      })),
      el("p", { class: "mt-dups-foot" }, L("Không cùng ra trận thì bỏ qua được. Đánh dấu “Thay thế cho …” trong trình soạn để hai đội không bị tính trùng.", "不同时出战则可忽略。在编辑器中设置“替换…”可让两支阵容不再计为重复。")),
    ]),
  ]);
}

/**
 * Đầu nhóm: tên (h2, nhận focus sau khi xóa), số đội, "Nhóm mặc định" hoặc Đổi tên · Xóa nhóm.
 * @param actions {onRename, onDelete(button)}
 */
export function groupHead(group, count, isDefault, actions) {
  const headingId = `mt-g-${group.id.replace(/[^a-z0-9-]/giu, "-")}`;
  const tools = isDefault
    ? el("span", { class: "mt-group-default" }, L("Nhóm mặc định", "默认分组"))
    : el("span", { class: "mt-group-tools" }, [
      button(L("Đổi tên", "重命名"), "pencil", { ghost: true, small: true, action: "rename-group", onclick: actions.onRename }),
      (() => {
        const remove = button(L("Xóa nhóm", "删除分组"), "trash", { ghost: true, danger: true, small: true, action: "delete-group" });
        remove.addEventListener("click", () => actions.onDelete(remove));
        return remove;
      })(),
    ]);
  return el("header", { class: "mt-group-head" }, [
    el("h2", { class: "mt-group-name", id: headingId, tabindex: "-1" }, groupLabel(group)),
    el("span", { class: "mt-count" }, L(`${count} đội`, `${count} 个阵容`)),
    tools,
  ]);
}

/** Form "Thêm nhóm" (ô chữ + nút); `onSubmit(input, button)` do trang xử lý. */
export function addGroupForm(onSubmit) {
  const input = el("input", { class: "ana-input mt-input", type: "text", id: "mt-new-group", autocomplete: "off", placeholder: L("Ví dụ: Đội thủ thành", "例如：守城阵容") });
  const submit = el("button", { type: "submit", class: "ana-btn mt-btn" }, [mtIcon("plus"), L("Thêm nhóm", "添加分组")]);
  const form = el("form", { class: "mt-add-group", novalidate: "" }, [
    el("label", { for: "mt-new-group" }, L("Thêm nhóm", "添加分组")),
    el("div", { class: "mt-add-group-row" }, [input, submit]),
  ]);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onSubmit(input, submit);
  });
  return form;
}

export const privacyNote = () => el("p", { class: "mt-privacy" }, [
  mtIcon("shield"),
  L("Đội chỉ bạn xem được: không công khai, không chia sẻ. Xóa hộp, nhóm hoặc đội luôn hỏi lại trước khi xóa.", "阵容仅你可见：不公开、不分享。删除仓库、分组或阵容前都会再次确认。"),
]);

/** Thẻ mời đăng nhập của khách (dùng nút đăng nhập chung của cộng đồng). `expired` = phiên vừa hết hạn. */
export function guestCard({ expired = false } = {}) {
  const prompt = signInPrompt(expired
    ? L("Phiên đăng nhập đã hết. Hãy đăng nhập lại.", "登录已失效，请重新登录。")
    : L("Đội của tôi lưu đội theo tài khoản Google nên mở được trên mọi máy. Chưa đăng nhập thì trang này không tải dữ liệu nào.", "“我的阵容”按 Google 账号保存，可在任何设备上打开。未登录时此页面不会加载任何数据。"));
  return el("section", { class: "mt-guest", "aria-labelledby": "mt-guest-title" }, [
    el("div", { class: "mt-guest-icon" }, [mtIcon("lock", 26)]),
    el("h2", { class: "mt-guest-title", id: "mt-guest-title" }, L("Đăng nhập để mở Đội của tôi", "登录后打开“我的阵容”")),
    prompt,
    el("p", { class: "mt-guest-note" }, [
      mtIcon("info", 15),
      L("Đang ở trang đội và bấm “Lưu vào đội của tôi” khi chưa đăng nhập? Đội được giữ tạm trên trình duyệt này và tự lưu đúng một lần sau khi đăng nhập.", "在阵容页未登录时点了“保存到我的阵容”？阵容会暂存在此浏览器中，登录后自动保存一次。"),
    ]),
  ]);
}
