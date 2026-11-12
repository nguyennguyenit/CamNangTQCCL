// Bảng chọn món mở ngay dưới ô đang sửa trong trình soạn "Đội của tôi" (artboard DoiCuaToi `.dct-picker`): ô tìm,
// nút "Bộ lọc" mở hàng chip lọc gọn (thế lực / sao / cost của tướng; loại / nguồn / phẩm của chiến pháp — cùng bộ lọc
// của bảng chọn cũ `createPicker`, chip `chip-loc`), dòng đếm kết quả, danh sách nút bật/tắt (`aria-pressed`) kèm
// "có / chưa có trong kho" khi hộp có kho (chỉ tướng và chiến pháp: kho không lưu binh thư), nút Xong.
// Tìm theo tên Việt / Hán-Việt / chữ Hán qua `filterCatalog` (policy `editor` của roster-picker, đủ danh mục).
// Chọn một (tướng, chiến pháp chính): bấm món khác thì thay; chọn nhiều (thay thế, binh thư): bật/tắt tới `max`.
// Bàn phím: ↓ từ ô tìm vào danh sách, ↑/↓ giữa các món, Escape hoặc Xong đóng bảng và trả focus về nút đã mở.

import { L } from "./i18n.js";
import { mtIcon } from "./my-teams-icons.js";
import { filterCatalog, filterOptions } from "./roster-picker.js";
import { el } from "./render.js";

/** Số món hiện tối đa trong danh sách (gõ thêm hoặc lọc để thu hẹp). */
const SHOWN = 40;

/** Kho chỉ lưu tướng + chiến pháp (`SCAN_OWNED_TYPES`): binh thư không có nhãn kho. */
const STOCKED_KINDS = new Set(["heroes", "tactics"]);

const KIND_NOUN = {
  heroes: () => L("tướng", "武将"),
  tactics: () => L("chiến pháp", "战法"),
  books: () => L("binh thư", "兵书"),
};

/** Nhãn bộ lọc, cùng chữ với bảng chọn cũ (`FILTER_LABELS` của js/roster-picker.js). */
const FILTER_LABELS = {
  faction: () => L("Thế lực", "势力"),
  stars: () => L("Số sao", "星级"),
  cost: () => L("Cost", "费用"),
  type: () => L("Loại", "类型"),
  source: () => L("Nguồn", "来源"),
  quality: () => L("Phẩm", "品质"),
};

/**
 * @param id id phần tử của bảng (nút mở trỏ `aria-controls` tới đây)
 * @param kind heroes | tactics | books
 * @param values mảng id đang chọn (sửa tại chỗ)
 * @param max số món tối đa (chọn một = 1 và `single`)
 * @param owned Set kho của hộp (rỗng = không gắn nhãn kho)
 * @param nameOf id → tên hiển thị
 * @param label nhãn của nhóm (đọc cho trình đọc màn hình)
 * @param onChange gọi sau mỗi lần đổi lựa chọn · onClose gọi khi đóng
 * @returns {{node, focus(), refresh()}} `refresh` vẽ lại danh sách khi `values` bị đổi từ bên ngoài
 */
export function inlinePicker({ id, kind, catalog, values, max, single = false, owned, nameOf, label, onChange, onClose }) {
  const filters = {};
  const choices = filterOptions("editor", kind);
  const listId = `${id}-list`;
  const search = el("input", { id: `${id}-q`, type: "search", autocomplete: "off", "aria-controls": listId, "aria-label": L(`Tìm ${KIND_NOUN[kind]()}`, `搜索${KIND_NOUN[kind]()}`), placeholder: L("Tên Việt, Hán-Việt hoặc chữ Hán…", "越南名、汉越音或汉字…") });
  const hint = el("p", { class: "mt-picker-hint", role: "status", "aria-live": "polite" });
  const list = el("ul", { class: "mt-picker-list", id: listId, "aria-label": label });
  const done = el("button", { type: "button", class: "ana-btn mt-btn mt-btn-sm" }, L("Xong", "完成"));

  // Bộ lọc gọn: một nút bật/tắt hàng chip; mỗi bộ lọc chọn một giá trị, bấm lại để bỏ.
  const filterPanel = el("div", { class: "mt-picker-filters", id: `${id}-filters`, hidden: "" });
  const filterToggle = Object.keys(choices).length
    ? el("button", { type: "button", class: "fchip mt-picker-filter-toggle", "aria-expanded": "false", "aria-controls": filterPanel.id })
    : null;
  const activeCount = () => Object.values(filters).filter(Boolean).length;
  const paintToggle = () => {
    if (!filterToggle) return;
    const count = activeCount();
    // `replaceChildren(null)` chèn chữ "null": chỉ truyền nút thật.
    filterToggle.replaceChildren(...[L("Bộ lọc", "筛选"), count ? el("span", { class: "fchip-count" }, String(count)) : null].filter(Boolean));
  };
  function paintFilters() {
    filterPanel.replaceChildren(...Object.entries(choices).map(([name, options]) => el("div", { class: "mt-picker-filter", role: "group", "aria-label": FILTER_LABELS[name]() }, [
      el("span", { class: "mt-picker-filter-label", "aria-hidden": "true" }, FILTER_LABELS[name]()),
      ...options.map((option) => el("button", {
        type: "button",
        class: "fchip",
        "aria-pressed": String(filters[name] === option.value),
        dataset: { filter: name, value: option.value },
        onclick: () => {
          filters[name] = filters[name] === option.value ? "" : option.value;
          paintFilters();
          paintToggle();
          paint();
          filterPanel.querySelector(`[data-filter="${name}"][data-value="${CSS.escape(option.value)}"]`)?.focus();
        },
      }, option.label)),
    ])));
  }
  filterToggle?.addEventListener("click", () => {
    const open = filterPanel.hidden;
    filterPanel.hidden = !open;
    filterToggle.setAttribute("aria-expanded", String(open));
  });

  const node = el("div", { class: "mt-picker", id, role: "group", "aria-label": label }, [
    el("div", { class: "mt-picker-top" }, [el("label", { class: "mt-picker-search", for: search.id }, [mtIcon("search"), search]), filterToggle]),
    filterToggle ? filterPanel : null,
    hint,
    list,
    el("div", { class: "mt-picker-foot" }, [done]),
  ]);

  let limitNote = "";
  const stockTag = (itemId) => {
    if (!owned.size || !STOCKED_KINDS.has(kind)) return null;
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
    const found = filterCatalog(catalog, { kind, query: search.value, ...filters }, "editor");
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

  const options = () => [...list.querySelectorAll(".mt-picker-opt")];
  search.addEventListener("input", () => {
    limitNote = "";
    paint();
  });
  search.addEventListener("keydown", (event) => {
    // Ô tìm nằm trong form của trình soạn: Enter không được gửi form.
    if (event.key === "Enter") event.preventDefault();
    if (event.key === "ArrowDown" && options().length) {
      event.preventDefault();
      options()[0].focus();
    }
  });
  list.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const items = options();
    const at = items.indexOf(document.activeElement);
    if (at < 0) return;
    event.preventDefault();
    if (event.key === "ArrowUp" && at === 0) search.focus();
    else items[Math.min(items.length - 1, Math.max(0, at + (event.key === "ArrowDown" ? 1 : -1)))].focus();
  });
  node.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    onClose();
  });
  done.addEventListener("click", () => onClose());
  paintToggle();
  if (filterToggle) paintFilters();
  paint();
  return { node, focus: () => search.focus(), refresh: paint };
}
