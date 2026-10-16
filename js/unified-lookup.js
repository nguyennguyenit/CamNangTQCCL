// Tầng dữ liệu và view thuần của Tra cứu (không DOM): corpus theo nhóm, tìm kiếm, view thẻ/hàng bảng và cây
// markup dùng chung cho HTML dựng lúc build (Astro, trang đầu 60 mục) lẫn DOM của trình duyệt
// (`js/lookup-page.js`). Hàm hiển thị nhận `locale` tường minh; mặc định là ngôn ngữ trang.
//
// Quy tắc render (plan.md quyết định #14): dữ liệu động chỉ qua cây view (`js/view-tree.js`), không HTML thô.

import { lookupDisplayName, tacticTypeLabel, zhSafeValue, ratePercentText } from "./lookup-detail.js";
import { L, currentLocale, localePath, normalizeLocale, pick } from "./i18n.js";
import { normalizeText } from "./filters.js";
import { bookLookupId, groupForId, lookupProfilePath } from "./lookup-ids.js";
import { h } from "./view-tree.js";
import { portraitTree } from "./hero-portrait.js";
import { isMasterGroup, masterResultTrees, masterSummaryTrees } from "./lookup-master.js";

export const LOOKUP_GROUPS = Object.freeze(["heroes", "tactics", "equipment", "advisors", "troop-mods", "buildings", "books"]);
/** Nhãn nhóm dùng chung cho trang Tra cứu và menu điều hướng (SiteLayout, bản Việt). */
export const LOOKUP_GROUP_LABELS = Object.freeze({
  heroes: "Tướng", tactics: "Chiến pháp", equipment: "Trang bị",
  advisors: "Quân sư", "troop-mods": "Cải tạo binh chủng", buildings: "Công trình", books: "Binh thư",
});
/** Nhãn nhóm bản Trung (`/zh/`). */
export const LOOKUP_GROUP_LABELS_ZH = Object.freeze({
  heroes: "武将", tactics: "战法", equipment: "装备",
  advisors: "军师", "troop-mods": "兵种进阶", buildings: "建筑", books: "兵书",
});
/** Nhãn nhóm theo ngôn ngữ chỉ định (`vi` | `zh`). */
export function lookupGroupLabels(locale = currentLocale()) {
  return normalizeLocale(locale) === "zh" ? LOOKUP_GROUP_LABELS_ZH : LOOKUP_GROUP_LABELS;
}
/** Đơn vị đếm của từng nhóm cho dòng trạng thái ("n tướng · bấm để mở hồ sơ"). */
export const LOOKUP_GROUP_UNITS = Object.freeze({
  heroes: "tướng", tactics: "chiến pháp", equipment: "trang bị",
  advisors: "quân sư", "troop-mods": "cải tạo binh chủng", buildings: "công trình", books: "binh thư",
});
/** Lượng từ + đơn vị bản Trung ("12 名武将"). */
const LOOKUP_GROUP_UNITS_ZH = Object.freeze({
  heroes: "名武将", tactics: "个战法", equipment: "件装备",
  advisors: "位军师", "troop-mods": "项兵种进阶", buildings: "座建筑", books: "本兵书",
});
/** Thứ tự vai trò trong khối "Trong cẩm nang" (khớp `index.json` heroes[].roleRaw). */
export const POSITION_LABELS = Object.freeze([L("Chủ tướng", "主将"), L("Phó tướng 1", "副将 1"), L("Phó tướng 2", "副将 2")]);

/**
 * Payload mà trang nhóm tải lúc vào (`entry`) và payload mà hồ sơ của nhóm cần thêm (`profile`, tải lười
 * khi mở hồ sơ đầu tiên). Binh thư đọc `books-dict` riêng, không qua lookup manifest.
 */
export const LOOKUP_GROUP_PAYLOADS = Object.freeze({
  heroes: Object.freeze({ entry: ["heroes-dict.json"], profile: ["tactics.json", "lookup-catalog.json"] }),
  tactics: Object.freeze({ entry: ["tactics.json"], profile: ["heroes-dict.json"] }),
  // Trang bị và Quân sư cần tên tướng ngay trên danh sách: build nhúng sẵn các tướng liên quan (`lookupGroupOwners`).
  equipment: Object.freeze({ entry: ["lookup-catalog.json"], profile: [] }),
  advisors: Object.freeze({ entry: ["lookup-catalog.json"], profile: [] }),
  "troop-mods": Object.freeze({ entry: ["lookup-catalog.json"], profile: [] }),
  buildings: Object.freeze({ entry: ["lookup-catalog.json"], profile: [] }),
  books: Object.freeze({ entry: [], profile: [] }),
});

// `<html lang>` cố định theo trang nên hằng dịch lúc nạp module vẫn đúng ngôn ngữ.
const ROUTE_ERRORS = Object.freeze({
  "duplicate-param": L("Mỗi tham số tra cứu chỉ được xuất hiện một lần.", "每个查询参数只能出现一次。"),
  "unknown-id-kind": L("Mã mục tra cứu không hợp lệ.", "条目编号无效。"),
});
const CJK_CHAR = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u;
const MISSING = "—";
export const PAGE_SIZE = 60;
/**
 * Cỡ trang theo nhóm: thẻ trang bị/quân sư dày hơn nên trang đầu ngắn hơn (artboard hiện 12/9 thẻ rồi "Xem thêm"),
 * cải tạo binh chủng hiện trọn một lượt vì danh sách chia khối theo binh chủng.
 */
const PAGE_SIZES = Object.freeze({ equipment: 24, advisors: 18, buildings: 20 });
export const lookupPageSize = (group) => PAGE_SIZES[group] ?? PAGE_SIZE;

/**
 * Hồ sơ trên query của trang nhóm (`/tra-cuu/<nhóm>/?id=<mã>`): chỉ `id` được xét, khóa khác bị bỏ qua
 * (link có `utm_*`/`fbclid` vẫn dùng được). Mã lặp hoặc sai dạng là lỗi; mã thuộc nhóm khác trả
 * `otherGroup` để trang chuyển sang đúng trang nhóm.
 */
export function parseLookupQuery(search, group) {
  const params = new URLSearchParams(search ?? "");
  const route = { group, id: null, otherGroup: null, error: null, messageVi: null };
  if (params.getAll("id").length > 1) return { ...route, error: "duplicate-param", messageVi: ROUTE_ERRORS["duplicate-param"] };
  if (!params.has("id")) return route;
  const id = params.get("id");
  const kind = groupForId(id);
  if (kind === null) return { ...route, error: "unknown-id-kind", messageVi: ROUTE_ERRORS["unknown-id-kind"] };
  if (kind !== group) return { ...route, otherGroup: kind, id };
  return { ...route, id };
}

function entry(group, record) {
  const nameVi = String(record.viet ?? record.nameVi ?? record.hanViet ?? "").trim();
  const aliases = [
    ...(Array.isArray(record.aliases) ? record.aliases : []),
    ...(Array.isArray(record.aliasesVi) ? record.aliasesVi : []),
    ...(Array.isArray(record.aliasesZh) ? record.aliasesZh : []),
    record.chinese,
  ].filter((value) => typeof value === "string" && value.length > 0);
  // Tên Hán-Việt (tên cũ của chiến pháp đã đổi tên hiển thị) vẫn là khóa tìm.
  const searchKeys = [nameVi, ...aliases, ...(typeof record.hanViet === "string" && record.hanViet.trim() ? [record.hanViet] : [])].map(normalizeText);
  return { id: record.id, group, nameVi, aliases, searchKeys, record };
}

/**
 * Binh thư (`books-dict.json`) không có `id` trong dữ liệu: mã hồ sơ dựng bằng `bookLookupId` (dùng chung
 * với trang chi tiết đội), dòng không dựng được mã thì bỏ. Tên Hán-Việt và chữ Hán là khóa tìm phụ; tên nguồn
 * phồn thể (`sourceNames`) và `aliases` (`{[id]: {aliases, formerNames}}`, tính lúc build từ bảng danh tính)
 * thêm tên Hán nguồn và tên cũ đã xác nhận.
 */
function bookRecords(books, aliases) {
  return (Array.isArray(books) ? books : []).flatMap((row) => {
    const id = bookLookupId(row);
    if (!id) return [];
    const extra = aliases && Object.hasOwn(aliases, id) ? aliases[id] : null;
    const names = (value) => (Array.isArray(value) ? value.filter((name) => typeof name === "string" && name.trim()) : []);
    return [{
      ...row,
      id,
      aliases: typeof row.hanViet === "string" && row.hanViet ? [row.hanViet] : [],
      aliasesZh: [...names(row.sourceNames), ...names(extra?.aliases)],
      formerNames: names(extra?.formerNames),
    }];
  });
}

const EMPTY_CATALOG = Object.freeze({ equipment: [], specials: [], advisors: [], troopMods: [], buildings: [] });

/**
 * Corpus của những payload đã tải: nhóm chưa có payload là mảng rỗng. Trang dựng lại corpus khi payload
 * tải lười về tới, nên hồ sơ chỉ giải được quan hệ sang nhóm đã có dữ liệu.
 */
export function buildLookupCorpus({ heroes = [], tactics = [], catalog = null, books = [], bookAliases = {} } = {}) {
  const source = catalog ?? EMPTY_CATALOG;
  // Đặc kỹ không có nhóm riêng: chúng nằm trong chi tiết trang bị cha (`exclusives`) hoặc ở danh sách đặc kỹ chung,
  // còn mã `equipment-special:*` vẫn tra được qua `byId`. Tên đặc kỹ gắn trang bị là khóa tìm phụ của trang bị đó.
  const specials = source.specials.map((record) => entry("equipment", record));
  const exclusivesOf = new Map();
  for (const special of specials) {
    const parent = special.record.equipmentId;
    if (parent) exclusivesOf.set(parent, [...(exclusivesOf.get(parent) ?? []), special]);
  }
  const equipment = source.equipment.map((record) => {
    const row = entry("equipment", record);
    const own = exclusivesOf.get(record.id) ?? [];
    return {
      ...row,
      exclusives: own.map((special) => special.record),
      searchKeys: [...row.searchKeys, ...own.flatMap((special) => special.searchKeys)],
    };
  });
  const groups = {
    heroes: heroes.map((record) => entry("heroes", record)),
    tactics: tactics.map((record) => entry("tactics", record)),
    equipment,
    advisors: source.advisors.map((record) => entry("advisors", record)),
    "troop-mods": source.troopMods.map((record) => entry("troop-mods", record)),
    buildings: source.buildings.map((record) => entry("buildings", record)),
    books: bookRecords(books, bookAliases).map((record) => entry("books", record)),
  };
  const byId = new Map();
  for (const rows of [...Object.values(groups), specials]) for (const row of rows) byId.set(row.id, row);
  return { groups, byId, heroes, tactics, catalog: source };
}

/** Số bản ghi của từng nhóm (mục lục và dòng trạng thái). */
export function lookupGroupCounts(corpus) {
  return Object.fromEntries(LOOKUP_GROUPS.map((group) => [group, corpus.groups[group].length]));
}

/**
 * Hạng khớp theo tên chữ Hán (bản zh): 0 trùng hẳn, 1 khớp đầu, 2 chứa, 3 chỉ khớp tên Việt/bí danh khác.
 * Sắp xếp ổn định nên trong cùng hạng vẫn giữ thứ tự nguồn.
 */
function chineseRank(item, needle) {
  const record = item.record ?? {};
  const names = [recordChinese(record), ...(Array.isArray(record.aliasesZh) ? record.aliasesZh : []), ...(Array.isArray(record.aliases) ? record.aliases : [])]
    .filter((name) => typeof name === "string" && CJK_CHAR.test(name)).map(normalizeText);
  if (names.some((name) => name === needle)) return 0;
  if (names.some((name) => name.startsWith(needle))) return 1;
  if (names.some((name) => name.includes(needle))) return 2;
  return 3;
}

/**
 * Tìm trong đúng một nhóm (toàn nhóm trước khi cắt trang); trang tính từ 1. `filter(item)` (nếu có) giữ lại các mục
 * thỏa điều kiện sau bước tìm, trước khi cắt trang (bộ lọc chip của bốn nhóm catalog).
 */
export function searchLookupGroup(corpus, { group, query = "", page = 1, pageSize = lookupPageSize(group), locale = currentLocale(), filter = null }) {
  const source = corpus.groups[group] ?? [];
  const needle = normalizeText(query);
  const searched = needle
    ? source.filter((item) => item.searchKeys.some((key) => key.includes(needle)))
    : source;
  const filtered = filter ? searched.filter(filter) : searched;
  // Bản zh ưu tiên mục khớp tên chữ Hán; bản Việt giữ nguyên thứ tự nguồn.
  const matches = needle && normalizeLocale(locale) === "zh"
    ? filtered.map((item, index) => ({ item, index, rank: chineseRank(item, needle) }))
      .sort((a, b) => a.rank - b.rank || a.index - b.index)
      .map(({ item }) => item)
    : filtered;
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const start = (safePage - 1) * pageSize;
  return { items: matches.slice(start, start + pageSize), total: matches.length, page: safePage, hasMore: start + pageSize < matches.length };
}

/* ---------- Dữ liệu hiển thị (hàm thuần, đo được bằng unit test) ---------- */

/** Tên chữ Hán của một bản ghi bất kỳ (tướng/chiến pháp có `chinese`, catalog có `aliasesZh`). */
export function recordChinese(record) {
  if (typeof record?.chinese === "string" && record.chinese.trim()) return record.chinese;
  for (const value of record?.aliasesZh ?? []) if (typeof value === "string" && CJK_CHAR.test(value)) return value;
  return "";
}

const VARIANT_LABEL = { sp: "SP", co: "CO", "40y": "40Y", base: null };
const FACTION_CODE = { "Ngụy": "nguy", "Thục": "thuc", "Ngô": "ngo", "Quần": "quan", "Hỗn hợp": "honhop" };
/** Giá trị chữ của dữ liệu theo ngôn ngữ: bản zh chỉ giữ giá trị dịch được, còn lại rỗng (bị bỏ). */
const shown = (value, locale) => {
  if (value === null || value === undefined || value === "") return "";
  return String(zhSafeValue(value, locale) ?? "");
};

/** Thẻ kết quả: huy hiệu biến thể, dòng phụ theo nhóm (phe/vai trò, phẩm/loại, vị trí…). */
export function lookupCardView(group, item, locale = currentLocale()) {
  const record = item.record ?? {};
  const lookup = record.lookup ?? {};
  const variant = VARIANT_LABEL[lookup.variant] ?? null;
  const kind = item.group ?? group;
  const hero = kind === "heroes";
  const text = (vi, zh) => pick(locale, vi, zh);
  const stars = hero && Number.isFinite(Number(record.stars)) ? text(`${record.stars} sao`, `${record.stars} 星`) : null;
  const parts = hero
    ? [
        shown(record.faction, locale) ? { kind: "faction", text: shown(record.faction, locale), code: FACTION_CODE[record.faction] ?? "none" } : null,
        stars ? { kind: "stars", text: stars } : null,
        record.cost ? { kind: "text", text: text(`Thống ngự ${record.cost}`, `统御 ${record.cost}`) } : null,
        shown(record.roleTagViet, locale) ? { kind: "role", text: shown(record.roleTagViet, locale) } : null,
      ]
    : [
        shown(record.qualityVi ?? record.quality, locale) ? { kind: "text", text: shown(record.qualityVi ?? record.quality, locale) } : null,
        kind === "tactics" && tacticTypeLabel(record.type, locale) ? { kind: "text", text: tacticTypeLabel(record.type, locale) } : null,
        kind === "equipment" && shown(record.slotVi, locale) ? { kind: "text", text: shown(record.slotVi, locale) } : null,
        kind === "advisors" && shown(record.elementVi, locale) ? { kind: "text", text: shown(record.elementVi, locale) } : null,
        kind === "troop-mods" && shown(record.appliesToVi, locale) ? { kind: "text", text: shown(record.appliesToVi, locale) } : null,
        kind === "buildings" && Number.isFinite(Number(record.maxLevel)) ? { kind: "text", text: text("Cấp tối đa ", "最高等级 ") + String(record.maxLevel) } : null,
      ];
  return {
    variant,
    title: lookupDisplayName(record, item.nameVi, locale),
    // Binh thư bản Việt dùng tên dịch nghĩa: không hiện chữ Hán (kể cả ô chân dung), chữ Hán chỉ là khóa tìm.
    chinese: kind === "books" && normalizeLocale(locale) !== "zh" ? "" : recordChinese(record),
    faction: hero && shown(record.faction, locale) ? shown(record.faction, locale) : null,
    stars,
    meta: parts.filter(Boolean),
  };
}

/**
 * Chữ của một trường có bản dịch Việt và (có thể) chữ Hán nguồn: bản Việt dùng bản dịch, bản zh dùng chữ
 * nguồn, không có thì chỉ giữ giá trị dịch được (`zhSafeValue`). Rỗng/không hiện được trả `fallback`.
 */
function localizedCell(vi, raw, locale, fallback) {
  if (normalizeLocale(locale) === "zh") {
    const rawText = typeof raw === "string" ? raw.trim() : "";
    if (rawText) return rawText;
  }
  if (vi === null || vi === undefined || vi === "") return fallback;
  const value = zhSafeValue(vi, locale);
  return value === null ? fallback : String(value);
}

/** Một dòng bảng chiến pháp từ bản ghi; cùng giá trị với các trường của hồ sơ, ô thiếu hiện "—". */
export function tacticTableRow(record, locale = currentLocale()) {
  const rate = record.lookup?.activationRate;
  return {
    nameVi: lookupDisplayName(record, String(record.viet ?? record.nameVi ?? record.hanViet ?? "").trim(), locale),
    quality: localizedCell(record.quality, null, locale, MISSING),
    type: tacticTypeLabel(record.type, locale) ?? MISSING,
    effectType: localizedCell(record.lookup?.effectTypeVi, null, locale, MISSING),
    target: localizedCell(record.targetViet, record.target, locale, MISSING),
    effect: localizedCell(record.effectViet, record.effect, locale, ""),
    rate: rate === null || rate === undefined || rate === "" ? MISSING : ratePercentText(rate),
  };
}

/** Tiêu đề cột bảng chiến pháp (cũng là nhãn `data-label` của ô trên mobile). */
const TABLE_HEADS = Object.freeze({
  name: ["Chiến pháp", "战法"],
  quality: ["Phẩm", "品质"],
  type: ["Loại", "类型"],
  effectType: ["Hiệu quả", "效果类型"],
  target: ["Mục tiêu", "目标"],
  rate: ["Tỷ lệ", "发动率"],
});
const head = (key, locale) => pick(locale, ...TABLE_HEADS[key]);

/* ---------- Cây markup dùng chung (Astro lúc build + DOM trình duyệt) ---------- */

/**
 * Thẻ kết quả (mọi nhóm trừ chiến pháp): link hồ sơ mang `data-lookup-id`. Thẻ tướng (artboard Lookup) mang
 * `data-faction` để CSS tô vạch phe dưới chân dung; dòng phụ "Phe · N sao · Thống ngự N", vai trò dòng riêng.
 * Biến thể SP/CO/40Y đã nằm trong tên và ảnh nên thẻ không gắn nhãn biến thể riêng.
 */
export function lookupCardTree(group, item, locale = currentLocale()) {
  const view = lookupCardView(group, item, locale);
  const faction = view.meta.find((part) => part.kind === "faction");
  const meta = view.meta.filter((part) => part.kind !== "role").map((part) => (part.kind === "faction"
    ? h("span", { class: `reference-faction f-${part.code}` }, part.text)
    : h("span", { class: part.kind === "stars" ? "lookup-card-meta-text lookup-card-stars" : "lookup-card-meta-text" }, part.text)));
  const role = view.meta.find((part) => part.kind === "role");
  return h("article", { class: "lookup-card", "data-faction": faction ? faction.code : null }, [
    // Link thật tới hồ sơ: bấm trước khi app sẵn sàng (hoặc không có JS) vẫn mở đúng hồ sơ; app chặn click thường để mở tại chỗ.
    h("a", { class: "lookup-card-button", href: localePath(lookupProfilePath(item.id), locale), "data-lookup-id": item.id }, [
      h("span", { class: "lookup-card-portrait" }, [
        portraitTree({ chinese: view.chinese, nameVi: view.title, iconUrl: item.record?.iconUrl, className: "lookup-portrait" }),
      ]),
      h("span", { class: "lookup-card-body" }, [
        h("span", { class: "lookup-card-name" }, view.title),
        meta.length ? h("span", { class: "lookup-card-meta" }, meta) : null,
        role ? h("span", { class: "lookup-card-role" }, role.text) : null,
      ]),
    ]),
  ]);
}

/** Hàng bảng chiến pháp: tên là link hồ sơ mang `data-lookup-id`. */
export function lookupTableRowTree(item, locale = currentLocale()) {
  const row = tacticTableRow(item.record ?? {}, locale);
  const chineseName = normalizeLocale(locale) === "zh" ? "" : recordChinese(item.record ?? {});
  return h("tr", {}, [
    h("th", { scope: "row", class: "lookup-table-cell-name", "data-label": head("name", locale) }, [
      h("a", { class: "lookup-table-name", href: localePath(lookupProfilePath(item.id), locale), "data-lookup-id": item.id }, row.nameVi),
      chineseName ? h("span", { class: "lookup-table-zh", lang: "zh-Hant" }, chineseName) : null,
      row.effect ? h("p", { class: "lookup-table-effect" }, row.effect) : null,
    ]),
    h("td", { class: "lookup-table-quality", "data-label": head("quality", locale) }, [h("span", { class: "lookup-quality" }, row.quality)]),
    h("td", { "data-label": head("type", locale) }, row.type),
    h("td", { "data-label": head("effectType", locale) }, row.effectType),
    h("td", { "data-label": head("target", locale) }, row.target),
    h("td", { class: "lookup-table-rate", "data-label": head("rate", locale) }, row.rate),
  ]);
}

/**
 * Lưới kết quả của một nhóm: bảng cho chiến pháp, danh sách/thẻ chọn được cho bốn nhóm catalog (`selectedId` là mục
 * đang mở, `byId` để tra tên tướng của quân sư), thẻ cho nhóm khác; không có kết quả trả `[]`.
 * @param {string} group
 * @param {any[]} items
 * @param {string} [locale]
 * @param {{selectedId?: string | null, byId?: Map<string, any> | null}} [options]
 */
export function lookupResultTrees(group, items, locale = currentLocale(), { selectedId = null, byId = null } = {}) {
  if (!items.length) return [];
  if (isMasterGroup(group)) return masterResultTrees(group, items, locale, { selectedId, byId });
  if (group !== "tactics") return items.map((item) => lookupCardTree(group, item, locale));
  return [h("div", { class: "lookup-table-panel" }, [
    h("table", { class: "lookup-table" }, [
      h("thead", {}, [h("tr", {}, [
        h("th", { scope: "col" }, head("name", locale)),
        h("th", { scope: "col" }, head("quality", locale)),
        h("th", { scope: "col" }, head("type", locale)),
        h("th", { scope: "col" }, head("effectType", locale)),
        h("th", { scope: "col" }, head("target", locale)),
        h("th", { scope: "col", class: "lookup-table-rate" }, head("rate", locale)),
      ])]),
      h("tbody", {}, items.map((item) => lookupTableRowTree(item, locale))),
    ]),
  ])];
}

/**
 * Nội dung dòng trạng thái: "<strong>n</strong> tướng · bấm để mở hồ sơ · ảnh chân dung từ nguồn game"; bốn nhóm
 * catalog có dòng riêng theo bố cục (`selected` là bộ lọc đang chọn).
 */
export function lookupSummaryTrees(group, total, locale = currentLocale(), selected = {}) {
  if (isMasterGroup(group)) return masterSummaryTrees(group, total, locale, selected);
  const unit = pick(locale, LOOKUP_GROUP_UNITS[group], LOOKUP_GROUP_UNITS_ZH[group]);
  const hint = group === "tactics" ? pick(locale, " · bấm tên để mở hồ sơ", " · 点击名称查看详情") : pick(locale, " · bấm để mở hồ sơ", " · 点击查看详情");
  const source = group === "heroes" ? pick(locale, " · ảnh chân dung từ nguồn game", " · 头像取自游戏素材") : "";
  return [h("strong", {}, String(total)), ` ${unit}${hint}${source}`];
}

/**
 * Ghi chú thứ tự bên phải dòng trạng thái: thứ tự nguồn giữ nguyên trừ khi bản zh xếp lại kết quả tìm theo
 * mức khớp tên chữ Hán (`searchLookupGroup`); khi đó trả `null` để ẩn ghi chú.
 */
export function lookupOrderNote(query = "", locale = currentLocale()) {
  if (normalizeText(query) && normalizeLocale(locale) === "zh") return null;
  return pick(locale, "Thứ tự theo nguồn", "按来源顺序");
}

/** Hàng "Xem thêm" khi còn kết quả chưa hiện; hết thì `[]`. */
export function lookupMoreTrees(shownCount, total, locale = currentLocale(), pageSize = PAGE_SIZE) {
  if (shownCount >= total) return [];
  return [
    h("button", { type: "button", class: "lookup-more" }, pick(locale, "Xem thêm", "查看更多")),
    h("span", { class: "lookup-more-note" }, pick(locale, `Mỗi lượt hiện ${pageSize} kết quả`, `每次显示 ${pageSize} 条结果`)),
  ];
}

/* ---------- Khối "Trong cẩm nang" ---------- */

/** % thanh chỉ số/thanh đếm theo trần `max`, khoá trong [0, 100]. */
export function barPercent(value, max) {
  const ratio = max > 0 ? (Number(value) || 0) / max : 0;
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

/**
 * Khối "Trong cẩm nang" từ payload đã kiểm: số đội theo họ và theo vị trí (gộp hai họ, khớp tổng
 * hiển thị), top chiến pháp/binh thư/hướng điểm kèm số đội, 3 đội tiêu biểu giữ nguyên thứ tự build.
 */
export function camNangView(summary) {
  if (!summary) return null;
  // Thanh dài trước như artboard LookupProfile (Phó tướng 2 → Phó tướng 1 → Chủ tướng); hoà giữ thứ tự vị trí.
  const positions = POSITION_LABELS.map((label, index) => {
    const count = summary.standard.positions[index] + summary.other.positions[index];
    return { label, count };
  }).sort((a, b) => b.count - a.count);
  const max = Math.max(1, ...positions.map((row) => row.count));
  const maxTactic = Math.max(1, ...summary.tactics.map((item) => item.teams));
  return {
    standard: summary.standard.teams,
    other: summary.other.teams,
    positions: positions.map((row) => ({ ...row, percent: barPercent(row.count, max) })),
    tactics: summary.tactics.map((item) => ({ ...item, percent: barPercent(item.teams, maxTactic) })),
    books: summary.books,
    statFocus: summary.statFocus,
    representative: summary.representative.map((team) => ({ ...team, positionLabel: POSITION_LABELS[team.position] })),
    searchName: summary.searchName,
  };
}
