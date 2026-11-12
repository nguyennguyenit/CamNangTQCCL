// Bảng chọn món mở ngay dưới ô đang sửa trong trình soạn "Đội của tôi" (artboard DoiCuaToi `.dct-picker`): ô tìm,
// dòng đếm kết quả, danh sách nút bật/tắt (`aria-pressed`) kèm "có / chưa có trong kho" khi hộp có kho, nút Xong.
// Tìm theo tên Việt / Hán-Việt / chữ Hán qua `filterCatalog` (policy `editor` của roster-picker, đủ danh mục).
// Chọn một (tướng, chiến pháp chính): bấm món khác thì thay; chọn nhiều (thay thế, binh thư): bật/tắt tới `max`.
// Escape hoặc Xong đóng bảng và trả focus về nút đã mở (`onClose`).

import { L } from "./i18n.js";
import { mtIcon } from "./my-teams-icons.js";
import { filterCatalog } from "./roster-picker.js";
import { el } from "./render.js";

/** Số món hiện tối đa trong danh sách (gõ thêm để thu hẹp). */
const SHOWN = 40;

const KIND_NOUN = {
  heroes: () => L("tướng", "武将"),
  tactics: () => L("chiến pháp", "战法"),
  books: () => L("binh thư", "兵书"),
};

let sequence = 0;

/**
 * @param kind heroes | tactics | books
 * @param values mảng id đang chọn (sửa tại chỗ)
 * @param max số món tối đa (chọn một = 1 và `single`)
 * @param owned Set kho của hộp (rỗng = không gắn nhãn kho)
 * @param nameOf id → tên hiển thị
 * @param label nhãn của nhóm (đọc cho trình đọc màn hình)
 * @param onChange gọi sau mỗi lần đổi lựa chọn · onClose gọi khi đóng
 */
export function inlinePicker({ kind, catalog, values, max, single = false, owned, nameOf, label, onChange, onClose }) {
  const id = `mt-picker-${++sequence}`;
  const search = el("input", { id: `${id}-q`, type: "search", autocomplete: "off", "aria-label": L(`Tìm ${KIND_NOUN[kind]()}`, `搜索${KIND_NOUN[kind]()}`), placeholder: L("Tên Việt, Hán-Việt hoặc chữ Hán…", "越南名、汉越音或汉字…") });
  const hint = el("p", { class: "mt-picker-hint", role: "status", "aria-live": "polite" });
  const list = el("ul", { class: "mt-picker-list" });
  const done = el("button", { type: "button", class: "ana-btn mt-btn mt-btn-sm" }, L("Xong", "完成"));
  const node = el("div", { class: "mt-picker", role: "group", "aria-label": label }, [
    el("label", { class: "mt-picker-search", for: search.id }, [mtIcon("search"), search]),
    hint,
    list,
    el("div", { class: "mt-picker-foot" }, [done]),
  ]);

  let limitNote = "";
  const stockTag = (itemId) => {
    if (!owned.size) return null;
    return owned.has(itemId)
      ? el("span", { class: "mt-have" }, L("có trong kho", "库中有"))
      : el("span", { class: "mt-miss" }, L("chưa có trong kho", "库中没有"));
  };

  function toggle(itemId) {
    const at = values.indexOf(itemId);
    limitNote = "";
    if (single) {
      values.splice(0, values.length, ...(at >= 0 ? [] : [itemId]));
    } else if (at >= 0) {
      values.splice(at, 1);
    } else if (values.length >= max) {
      limitNote = L(`Tối đa ${max} mục.`, `最多 ${max} 项。`);
    } else {
      values.push(itemId);
    }
    onChange();
    paint();
  }

  function paint() {
    const found = filterCatalog(catalog, { kind, query: search.value }, "editor");
    const shown = found.slice(0, SHOWN);
    const count = found.length > SHOWN
      ? L(`${found.length} kết quả, hiện ${SHOWN} đầu`, `${found.length} 个结果，显示前 ${SHOWN} 个`)
      : L(`${found.length} kết quả`, `${found.length} 个结果`);
    hint.textContent = limitNote || L(`Chỉ hiện ${KIND_NOUN[kind]()} · ${count}`, `仅显示${KIND_NOUN[kind]()} · ${count}`);
    hint.dataset.limit = String(Boolean(limitNote));
    list.replaceChildren(...shown.map((item) => {
      const on = values.includes(item.id);
      return el("li", {}, [el("button", {
        type: "button",
        class: `mt-picker-opt${on ? " is-on" : ""}`,
        "aria-pressed": String(on),
        dataset: { itemId: item.id },
        onclick: () => {
          toggle(item.id);
          list.querySelector(`[data-item-id="${CSS.escape(item.id)}"]`)?.focus();
        },
      }, [el("span", {}, nameOf(item.id)), stockTag(item.id), on ? mtIcon("check") : null])]);
    }));
  }

  const close = () => onClose();
  search.addEventListener("input", () => {
    limitNote = "";
    paint();
  });
  // Ô tìm nằm trong form của trình soạn: Enter không được gửi form.
  search.addEventListener("keydown", (event) => {
    if (event.key === "Enter") event.preventDefault();
  });
  node.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    close();
  });
  done.addEventListener("click", close);
  paint();
  return { node, focus: () => search.focus() };
}
