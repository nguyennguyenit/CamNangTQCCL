// Bảng chọn nhanh danh mục tướng / chiến pháp / binh thư: tìm + lọc + "Chọn tất cả N" cho kho (Gợi ý đội)
// và cho trình soạn đội (Đội của tôi). Phần thuần (`buildCatalog`, `filterCatalog`, `pickerTree`) không đụng DOM;
// `createPicker` dựng DOM và chỉ phát sự kiện chọn, nơi dùng tự quyết lưu vào đâu (kho local / hộp cloud / đội đang soạn).
//
// Hai policy dùng chung cơ chế tìm/lọc:
//  - `inventory`: món có thể nằm trong kho. Chiến pháp INNATE và "Tự mang" luôn bị loại (không vào kho); không có binh thư.
//  - `editor`: toàn bộ danh mục kể cả INNATE/"Tự mang" và binh thư (`book:<slug>` theo `lookup-ids.js`); chọn từng mục.

import { el } from "./render.js";
import { h, treeToDom } from "./view-tree.js";
import { L } from "./i18n.js";
import { normalizeText } from "./filters.js";
import { bookRowId } from "./lookup-ids.js";
import { addCanonicalItem, removeItem } from "./roster-scan-state.js";

export const POLICIES = {
  inventory: { kinds: ["heroes", "tactics"], excludedSources: ["INNATE"], selectAll: true },
  editor: { kinds: ["heroes", "tactics", "books"], excludedSources: [], selectAll: false },
};

const policyOf = (policy) => {
  const found = POLICIES[policy];
  if (!found) throw new Error(`Policy bảng chọn không hợp lệ: ${policy}`);
  return found;
};

/** Nhóm nguồn chiến pháp; "Tự mang" (dữ liệu cũ) cùng nhóm INNATE, `null` vào "Khác". */
const sourceGroup = (source) => (source === "Tự mang" ? "INNATE" : typeof source === "string" && source ? source : "other");
const qualityGroup = (quality) => (typeof quality === "string" && quality ? quality : "other");
const nameList = (value) => (Array.isArray(value) ? value : []).filter((name) => typeof name === "string" && name.trim());
const blobOf = (...parts) => normalizeText(parts.flat().filter((part) => typeof part === "string" && part).join(" "));

/**
 * Danh mục phẳng cho bảng chọn. `name` luôn là tên Việt chuẩn của từ điển (kho lưu dạng này, kể cả khi người dùng
 * tìm bằng chữ Hán); `search` là chuỗi đã bỏ dấu gồm tên Việt, Hán-Việt, Hán (giản/phồn) để tìm.
 * Binh thư chỉ có ở policy `editor`.
 */
export function buildCatalog({ heroesDict = [], tacticsDict = [], books = [] } = {}, policy = "inventory") {
  const rules = policyOf(policy);
  const items = [];
  for (const row of heroesDict) {
    if (typeof row?.id !== "string" || typeof row.viet !== "string" || !row.viet.trim()) continue;
    items.push({
      type: "heroes",
      id: row.id,
      name: row.viet.trim(),
      chinese: row.chinese || "",
      faction: row.faction || "",
      stars: Number(row.stars) || 0,
      cost: Number(row.cost) || 0,
      search: blobOf(row.viet, row.hanViet, row.chinese, nameList(row.aliases)),
    });
  }
  for (const row of tacticsDict) {
    if (typeof row?.id !== "string" || typeof row.viet !== "string" || !row.viet.trim()) continue;
    items.push({
      type: "tactics",
      id: row.id,
      name: row.viet.trim(),
      chinese: row.chinese || "",
      tacticType: row.type || "",
      source: sourceGroup(row.source),
      quality: qualityGroup(row.quality),
      search: blobOf(row.viet, row.hanViet, row.chinese, nameList(row.aliases)),
    });
  }
  if (rules.kinds.includes("books")) {
    for (const row of books) {
      const id = bookRowId(row);
      const name = typeof row?.viet === "string" ? row.viet.trim() : "";
      if (!id || !name) continue;
      items.push({ type: "books", id, name, chinese: row.chinese || "", search: blobOf(row.viet, row.hanViet, row.chinese, nameList(row.sourceNames)) });
    }
  }
  return items;
}

/**
 * Lọc danh mục. `filters`: `kind` (bắt buộc: heroes|tactics|books), `query` (mọi từ phải có trong tên Việt/Hán-Việt/Hán,
 * không phân biệt dấu), tướng: `faction`, `stars`, `cost` (so dạng số, nhận cả chuỗi); chiến pháp: `type`, `source`
 * (INHERITANCE/EVENT/INNATE/other), `quality` (S/A/B/C/other). Giá trị rỗng = không lọc.
 */
export function filterCatalog(items, filters = {}, policy = "inventory") {
  const rules = policyOf(policy);
  const { kind } = filters;
  if (!rules.kinds.includes(kind)) return [];
  const terms = normalizeText(filters.query).split(/\s+/).filter(Boolean);
  const has = (value) => value !== undefined && value !== null && value !== "";
  const wantStars = has(filters.stars) ? Number(filters.stars) : null;
  const wantCost = has(filters.cost) ? Number(filters.cost) : null;
  return items.filter((item) => {
    if (item.type !== kind) return false;
    if (kind === "tactics" && rules.excludedSources.includes(item.source)) return false;
    if (terms.length && !terms.every((term) => item.search.includes(term))) return false;
    if (kind === "heroes") {
      if (has(filters.faction) && item.faction !== filters.faction) return false;
      if (wantStars !== null && item.stars !== wantStars) return false;
      if (wantCost !== null && item.cost !== wantCost) return false;
    } else if (kind === "tactics") {
      if (has(filters.type) && item.tacticType !== filters.type) return false;
      if (has(filters.source) && item.source !== filters.source) return false;
      if (has(filters.quality) && item.quality !== filters.quality) return false;
    }
    return true;
  });
}

const TYPE_LABELS = {
  COMMAND: ["Chỉ huy", "指挥"],
  ACTIVE: ["Chủ động", "主动"],
  PASSIVE: ["Bị động", "被动"],
  BURST: ["Bùng nổ", "突击"],
  FORMATION: ["Trận pháp", "阵法"],
  TROOP: ["Binh chủng", "兵种"],
  INTERNAL: ["Nội chính", "内政"],
};
const SOURCE_LABELS = {
  INHERITANCE: ["Truyền thừa", "传承"],
  EVENT: ["Sự kiện", "活动"],
  INNATE: ["Tự mang", "自带"],
  other: ["Khác", "其他"],
};
const QUALITY_LABELS = { S: ["S", "S"], A: ["A", "A"], B: ["B", "B"], C: ["C", "C"], other: ["Khác", "其他"] };
const FACTIONS = [["Ngụy", "魏"], ["Thục", "蜀"], ["Ngô", "吴"], ["Quần", "群"], ["Hán", "汉"]];

const option = (value, pair) => ({ value, label: L(pair[0], pair[1]) });

/** Các bộ lọc thả xuống của một loại theo policy: `{<tên bộ lọc>: [{value, label}]}` (bộ lọc không có thì vắng mặt). */
export function filterOptions(policy, kind) {
  const rules = policyOf(policy);
  if (kind === "heroes") {
    return {
      faction: FACTIONS.map(([value, zh]) => option(value, [value, zh])),
      stars: [5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n}★` })),
      cost: [7, 6, 5, 4, 3, 2].map((n) => ({ value: String(n), label: L(`Cost ${n}`, `${n} 费`) })),
    };
  }
  if (kind === "tactics") {
    const sources = Object.keys(SOURCE_LABELS).filter((key) => !rules.excludedSources.includes(key));
    return {
      type: Object.entries(TYPE_LABELS).map(([value, pair]) => option(value, pair)),
      source: sources.map((value) => option(value, SOURCE_LABELS[value])),
      quality: Object.entries(QUALITY_LABELS).map(([value, pair]) => option(value, pair)),
    };
  }
  return {};
}

const FILTER_LABELS = {
  faction: ["Thế lực", "势力"],
  stars: ["Số sao", "星级"],
  cost: ["Cost", "费用"],
  type: ["Loại", "类型"],
  source: ["Nguồn", "来源"],
  quality: ["Phẩm", "品质"],
};

/* ---------- Chọn / bỏ chọn trên kho (dạng state `roster-scan-state`) ---------- */

const ownedKey = (type) => (type === "tactics" ? "ownedTactics" : "ownedHeroes");

/** Thêm các món (tướng/chiến pháp) vào kho theo tên Việt chuẩn; món đã có không nhân đôi. Binh thư bị bỏ qua. */
export function addPicked(state, items) {
  let next = state;
  for (const item of items) {
    if (item.type === "books") continue;
    next = addCanonicalItem(next, item.type, item.name);
  }
  return next;
}

const isOwnedEntry = (entry, item) => entry.canonicalId === item.id || entry.name === item.name;

/** Gỡ đúng các món đã cho khỏi kho (khớp theo ID canonical hoặc tên Việt chuẩn); món khác giữ nguyên. */
export function removePicked(state, items) {
  let next = state;
  for (const item of items) {
    if (item.type === "books") continue;
    for (const entry of (next?.[ownedKey(item.type)] || []).filter((candidate) => isOwnedEntry(candidate, item))) {
      next = removeItem(next, item.type, entry.name);
    }
  }
  return next;
}

/** Các món trong `items` đang có trong kho. */
export function pickedItems(state, items) {
  return items.filter((item) => item.type !== "books" && (state?.[ownedKey(item.type)] || []).some((entry) => isOwnedEntry(entry, item)));
}

/* ---------- Cây view của danh sách chọn ---------- */

/**
 * Danh sách hàng chọn. Mỗi hàng là nút bật/tắt (`aria-pressed`) mang `data-picker-id`; chỉ `limit` hàng đầu được vẽ.
 * @param items danh sách đã lọc · @param selected Set ID đã chọn · @param label (item) => chữ hiển thị
 * @param meta (item) => chữ phụ (tuỳ chọn)
 */
export function pickerTree({ items, selected = new Set(), label, meta, limit = items.length, disabled = false }) {
  return h("ul", { class: "roster-picker-list" }, items.slice(0, limit).map((item) => {
    const on = selected.has(item.id);
    const extra = meta?.(item);
    return h("li", { class: "roster-picker-row" }, [
      h("button", {
        type: "button",
        class: "roster-picker-item",
        "aria-pressed": on ? "true" : "false",
        "data-picker-id": item.id,
        disabled: disabled ? true : null,
      }, [
        h("span", { class: "roster-picker-mark", "aria-hidden": "true" }, on ? "✓" : ""),
        h("span", { class: "roster-picker-name" }, label(item)),
        extra ? h("span", { class: "roster-picker-meta" }, extra) : null,
      ]),
    ]);
  }));
}

/* ---------- DOM ---------- */

const KIND_LABELS = {
  heroes: ["Tướng", "武将"],
  tactics: ["Chiến pháp", "战法"],
  books: ["Binh thư", "兵书"],
};
const PAGE_SIZE = 60;
let pickerSeq = 0;

/**
 * Bảng chọn có tìm + lọc. Không giữ danh sách đã chọn: gọi `selected()` mỗi lần vẽ và báo thay đổi qua `onToggle`.
 * @param policy "inventory" | "editor" · @param catalog kết quả `buildCatalog` · @param title tiêu đề khối
 * @param selected () => Set ID đang chọn · @param onToggle (items, on) => void (một món khi bấm hàng, cả tập khi Chọn tất cả/Bỏ chọn)
 * @param label (item) => tên hiển thị (bản zh hiện chữ Hán) · @param kinds (tuỳ chọn) tập con loại được chọn · @returns {node, refresh(), setDisabled(bool)}
 */
export function createPicker({ policy, catalog, title, lead, selected, onToggle, label = (item) => item.name, kinds }) {
  const rules = policyOf(policy);
  // `kinds` thu hẹp loại của policy (trình soạn đội chỉ chọn đúng loại của ô đang sửa); loại ngoài policy bị bỏ.
  const shownKinds = kinds ? rules.kinds.filter((kind) => kinds.includes(kind)) : rules.kinds;
  const uid = `roster-picker-${++pickerSeq}`;
  const filters = { kind: shownKinds[0], query: "" };
  let shownCount = PAGE_SIZE;
  let disabled = false;

  const search = el("input", { type: "search", class: "ana-input roster-picker-search", id: `${uid}-q`, autocomplete: "off", placeholder: L("Tìm tên Việt, Hán-Việt hoặc chữ Hán…", "搜索越南名、汉越音或汉字…"), "aria-label": L("Tìm trong danh mục", "搜索图鉴") });
  const filterRow = el("div", { class: "roster-picker-filters" });
  const status = el("p", { class: "roster-picker-count", role: "status", tabindex: "-1", "aria-live": "polite" });
  const selectAllBtn = el("button", { type: "button", class: "ana-btn roster-picker-selectall" });
  const clearBtn = el("button", { type: "button", class: "roster-ghost roster-picker-clearall" });
  const moreBtn = el("button", { type: "button", class: "roster-ghost roster-more roster-picker-more" });
  const listSlot = el("div", { class: "roster-picker-slot" });
  const emptyNote = el("p", { class: "roster-empty roster-picker-empty" }, L("Không có mục nào khớp bộ lọc.", "没有符合筛选条件的条目。"));

  const kindField = shownKinds.length > 1
    ? el("fieldset", { class: "roster-picker-kinds" }, [
      el("legend", { class: "roster-field-label" }, L("Loại", "类别")),
      el("div", { class: "roster-seg" }, shownKinds.map((kind) => {
        const input = el("input", { type: "radio", name: `${uid}-kind`, value: kind, class: "roster-seg-input" });
        input.checked = kind === filters.kind;
        input.addEventListener("change", () => {
          if (!input.checked) return;
          for (const key of Object.keys(filters)) if (key !== "kind" && key !== "query") delete filters[key];
          filters.kind = kind;
          shownCount = PAGE_SIZE;
          paintFilters();
          paint();
        });
        return el("label", { class: "roster-seg-option" }, [input, el("span", {}, L(...KIND_LABELS[kind]))]);
      })),
    ])
    : null;

  function paintFilters() {
    const options = filterOptions(policy, filters.kind);
    filterRow.replaceChildren(...Object.entries(options).map(([name, list]) => {
      const id = `${uid}-${name}`;
      const select = el("select", { class: "ana-input", id, "aria-label": L(...FILTER_LABELS[name]) }, [
        el("option", { value: "" }, L(`${FILTER_LABELS[name][0]}: tất cả`, `${FILTER_LABELS[name][1]}：全部`)),
        ...list.map((item) => el("option", { value: item.value }, item.label)),
      ]);
      select.value = filters[name] ?? "";
      select.addEventListener("change", () => {
        filters[name] = select.value;
        shownCount = PAGE_SIZE;
        paint();
      });
      return select;
    }));
    filterRow.hidden = filterRow.childElementCount === 0;
  }

  let current = [];
  function paint() {
    current = filterCatalog(catalog, filters, policy);
    const chosen = selected();
    const picked = current.filter((item) => chosen.has(item.id));
    const visible = Math.min(shownCount, current.length);
    status.textContent = L(`${current.length} mục · đã chọn ${picked.length}`, `${current.length} 项 · 已选 ${picked.length}`);
    selectAllBtn.hidden = clearBtn.hidden = !rules.selectAll;
    selectAllBtn.textContent = L(`Chọn tất cả ${current.length}`, `全选 ${current.length} 项`);
    selectAllBtn.setAttribute("aria-label", L(`Chọn tất cả ${current.length} mục đang lọc`, `全选当前筛选的 ${current.length} 项`));
    selectAllBtn.disabled = disabled || current.length === 0 || picked.length === current.length;
    clearBtn.textContent = L("Bỏ chọn tất cả", "取消全选");
    clearBtn.setAttribute("aria-label", L(`Bỏ chọn tất cả, ${picked.length} mục đã chọn trong bộ lọc`, `取消全选，当前筛选中已选 ${picked.length} 项`));
    clearBtn.disabled = disabled || picked.length === 0;
    const tree = pickerTree({
      items: current,
      selected: chosen,
      label,
      limit: visible,
      disabled,
      meta: (item) => (item.type === "heroes"
        ? `${L(...(FACTIONS.find(([vi]) => vi === item.faction) || [item.faction, item.faction]))} · ${item.stars}★ · ${item.cost}`
        : item.type === "tactics"
          ? [L(...(TYPE_LABELS[item.tacticType] || [item.tacticType, item.tacticType])), item.quality !== "other" ? item.quality : ""].filter(Boolean).join(" · ")
          : ""),
    });
    listSlot.replaceChildren(treeToDom(tree));
    listSlot.hidden = current.length === 0;
    emptyNote.hidden = current.length > 0;
    moreBtn.hidden = current.length <= PAGE_SIZE;
    moreBtn.textContent = visible < current.length ? L(`Hiện thêm (${visible}/${current.length})`, `显示更多（${visible}/${current.length}）`) : L("Thu gọn", "收起");
  }

  listSlot.addEventListener("click", (event) => {
    const button = event.target.closest?.(".roster-picker-item");
    if (!button || disabled) return;
    const item = current.find((candidate) => candidate.id === button.dataset.pickerId);
    if (!item) return;
    const on = button.getAttribute("aria-pressed") !== "true";
    onToggle([item], on);
    paint();
    // Giữ focus ở đúng hàng sau khi vẽ lại.
    listSlot.querySelector(`[data-picker-id="${CSS.escape(item.id)}"]`)?.focus();
  });

  /** Vẽ lại sau chọn/bỏ chọn hàng loạt; nút vừa bấm có thể thành `disabled` và mất focus: chuyển sang nút kia (hoặc dòng trạng thái). */
  function paintKeepingFocus(button, sibling) {
    const hadFocus = document.activeElement === button;
    paint();
    if (!hadFocus || !button.disabled) return;
    if (!sibling.disabled && !sibling.hidden) sibling.focus();
    else status.focus();
  }
  selectAllBtn.addEventListener("click", () => {
    const chosen = selected();
    const todo = current.filter((item) => !chosen.has(item.id));
    if (!todo.length || disabled) return;
    onToggle(todo, true);
    paintKeepingFocus(selectAllBtn, clearBtn);
  });
  clearBtn.addEventListener("click", () => {
    const chosen = selected();
    const todo = current.filter((item) => chosen.has(item.id));
    if (!todo.length || disabled) return;
    onToggle(todo, false);
    paintKeepingFocus(clearBtn, selectAllBtn);
  });
  moreBtn.addEventListener("click", () => {
    shownCount = shownCount < current.length ? shownCount + PAGE_SIZE : PAGE_SIZE;
    paint();
  });
  search.addEventListener("input", () => {
    filters.query = search.value;
    shownCount = PAGE_SIZE;
    paint();
  });

  const node = el("section", { class: "roster-picker", "aria-labelledby": `${uid}-title`, dataset: { policy } }, [
    el("div", { class: "roster-panel-head" }, [el("h3", { id: `${uid}-title` }, title), status]),
    lead ? el("p", { class: "roster-section-lead" }, lead) : null,
    kindField,
    el("div", { class: "roster-picker-search-row" }, [search]),
    filterRow,
    rules.selectAll ? el("div", { class: "roster-picker-bar" }, [selectAllBtn, clearBtn]) : null,
    listSlot,
    emptyNote,
    moreBtn,
  ]);
  paintFilters();
  paint();

  return {
    node,
    refresh: paint,
    setDisabled(value) {
      if (disabled === Boolean(value)) return;
      disabled = Boolean(value);
      search.disabled = disabled;
      paint();
    },
  };
}

