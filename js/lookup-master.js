// Thân "danh sách + chi tiết" của bốn nhóm Tra cứu catalog (Trang bị, Quân sư, Cải tạo binh chủng, Công trình;
// artboard LookupEquipment/Advisors/Troops/Buildings + bản Mobile và DetailMobile): bộ lọc, thẻ/hàng danh sách và
// panel chi tiết dựng bằng cây view (`js/view-tree.js`) nên HTML dựng lúc build (Astro) và DOM của trình duyệt
// (`js/lookup-page.js`) là một định nghĩa. Mọi hàm nhận `locale` tường minh; không đọc DOM, không đụng dữ liệu
// ngoài các bản ghi truyền vào. Quy tắc render (plan.md quyết định #14): dữ liệu động chỉ qua cây view.

import { h } from "./view-tree.js";
import { formatNumber, localePath, normalizeLocale, pick } from "./i18n.js";
import { ZH_TRANSLATED_TAG_ATTRS, effectVersions, isTranslatedZhText, lookupDisplayName, zhSafeValue, zhTranslatedTextNote } from "./lookup-detail.js";
import { lookupGroupPath, lookupHref, lookupSlug } from "./lookup-ids.js";
import { portraitTree } from "./hero-portrait.js";

/** Bốn nhóm dùng bố cục danh sách + chi tiết; nhóm khác (tướng, chiến pháp, binh thư) giữ hộp thoại hồ sơ. */
export const MASTER_GROUPS = Object.freeze(["equipment", "advisors", "troop-mods", "buildings"]);
export const isMasterGroup = (group) => MASTER_GROUPS.includes(group);

const CJK_CHAR = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u;
const MISSING = "—";
const TIER_ORDER = ["T0", "T1", "T2", "T3"];
const SLOT_ORDER = ["Vũ khí", "Phòng cụ", "Tọa kỵ", "Bảo vật"];
const QUALITY_ORDER = ["Cam", "Tím"];
const ELEMENT_ORDER = ["Hỏa", "Phong", "Lâm", "Sơn"];
const TROOP_ORDER = ["Khiên binh", "Cung binh", "Thương binh", "Kỵ binh"];
const TROOP_TIER_ORDER = ["Đặc biệt", "Sơ cấp", "Trung cấp", "Cao cấp"];
/** Chữ Hán đại diện của hệ quân sư (ô chữ trên thẻ và chi tiết). */
const ELEMENT_GLYPH = { Hỏa: "火", Phong: "風", Lâm: "林", Sơn: "山" };
const TROOP_ZH = { "Khiên binh": "盾兵", "Cung binh": "弓兵", "Thương binh": "枪兵", "Kỵ binh": "骑兵" };
const COST_KEYS = [["wood", "Gỗ", "木材"], ["stone", "Đá", "石料"], ["iron", "Sắt", "铁矿"]];
const GROUP_LABELS = {
  equipment: ["Trang bị", "装备"],
  advisors: ["Quân sư", "军师"],
  "troop-mods": ["Cải tạo binh chủng", "兵种进阶"],
  buildings: ["Công trình", "建筑"],
};

const isZh = (locale) => normalizeLocale(locale) === "zh";
const text = (locale, vi, zh) => pick(locale, vi, zh);
/** Giá trị chữ của dữ liệu theo ngôn ngữ: bản zh chỉ giữ giá trị dịch được, còn lại rỗng. */
const shown = (value, locale) => {
  if (value === null || value === undefined || value === "") return "";
  return String(zhSafeValue(value, locale) ?? "");
};
const rank = (order, value) => {
  const index = order.indexOf(value);
  return index < 0 ? order.length : index;
};
const sortedBy = (order, values) => [...values].sort((a, b) => rank(order, a) - rank(order, b));
const unique = (values) => [...new Set(values)];

/** Tên chữ Hán nguồn của bản ghi catalog (`aliasesZh` đầu tiên có chữ Hán), rỗng nếu không có. */
function zhName(record) {
  for (const value of record?.aliasesZh ?? []) if (typeof value === "string" && CJK_CHAR.test(value)) return value.trim();
  return "";
}

/** Ô chữ: `count` chữ Hán đầu của tên nguồn; thiếu chữ Hán thì chữ đầu tên Việt (không bao giờ rỗng). */
function glyph(record, nameVi, count = 1) {
  const han = [...zhName(record)].slice(0, count).join("");
  return han || ([...String(nameVi ?? "").trim()][0] ?? "?");
}

const itemHref = (id, locale) => localePath(lookupHref(id), locale);

/**
 * Mục thứ `index` (từ 0) của danh sách dựng sẵn: từ `visibleCount` trở đi mang `data-lookup-later` (HTML có đủ mục,
 * CSS ẩn phần sau trang đầu). `visibleCount` rỗng nghĩa là hiện hết.
 */
export function laterTree(tree, index, visibleCount) {
  if (visibleCount === null || visibleCount === undefined || index < visibleCount) return tree;
  return { ...tree, attrs: { ...tree.attrs, "data-lookup-later": true } };
}
const tierRank = (tier) => rank(TIER_ORDER, tier);
const byTier = (a, b) => tierRank(a.tierVi) - tierRank(b.tierVi);

export function masterGroupLabel(group, locale) {
  return pick(locale, ...GROUP_LABELS[group]);
}

export function masterPanelLabel(group, locale) {
  return {
    equipment: text(locale, "Chi tiết trang bị", "装备详情"),
    advisors: text(locale, "Chi tiết quân sư", "军师详情"),
    "troop-mods": text(locale, "Chi tiết cải tạo binh chủng", "兵种进阶详情"),
    buildings: text(locale, "Chi tiết công trình", "建筑详情"),
  }[group];
}

/* ---------- Bộ lọc ---------- */

const FACET_KEYS = Object.freeze({ equipment: ["slot", "quality"], advisors: ["element"], "troop-mods": ["limit"], buildings: ["scope"] });

/** Các giá trị của một bản ghi theo từng khóa lọc (bản ghi catalog gốc). */
function facetValues(key, record) {
  if (key === "slot") return record.slotVi ? [record.slotVi] : [];
  if (key === "quality") return record.qualityVi ? [record.qualityVi] : [];
  if (key === "element") return record.elementVi ? [record.elementVi] : [];
  if (key === "limit") return Array.isArray(record.troopLimitVi) && record.troopLimitVi.length ? record.troopLimitVi : ["*"];
  return [record.mainCityOnly ? "main" : "all"];
}

function facetLabel(key, value, locale) {
  if (key === "scope") return value === "main" ? text(locale, "Chỉ thành chính", "仅主城") : text(locale, "Mọi thành", "所有城池");
  if (key === "limit") return value === "*" ? text(locale, "Khác", "其他") : isZh(locale) ? (TROOP_ZH[value] ?? "") : value;
  return shown(value, locale);
}

/** Thứ tự cố định của các giá trị đã biết (khớp artboard), giá trị lạ nối sau theo thứ tự xuất hiện. */
function facetOrder(key, present) {
  const known = { slot: SLOT_ORDER, quality: QUALITY_ORDER, element: ELEMENT_ORDER, limit: TROOP_ORDER, scope: ["main", "all"] }[key];
  return sortedBy(known, present);
}

/**
 * Các khía cạnh lọc của một nhóm từ toàn bộ mục của nhóm (số đếm không đổi theo ô tìm hay lọc khác):
 * `[{key, hasAll, options: [{value, label, count, tone}]}]`; khía cạnh đầu có nút "Tất cả", khía cạnh sau chỉ bật/tắt.
 */
export function masterFacets(group, items, locale) {
  return (FACET_KEYS[group] ?? []).map((key, index) => {
    const records = items.map((item) => item.record ?? {});
    const present = unique(records.flatMap((record) => facetValues(key, record)));
    const options = facetOrder(key, present).map((value) => ({
      value,
      label: facetLabel(key, value, locale),
      count: records.filter((record) => facetValues(key, record).includes(value)).length,
      tone: key === "quality" || key === "element" ? lookupSlug(value) : null,
    })).filter((option) => option.label);
    return { key, hasAll: index === 0, options };
  });
}

/** Bản ghi có khớp các giá trị lọc đang chọn (`{khóa: giá trị}`; khóa vắng/rỗng = không lọc). */
export function masterFilterMatches(group, record, selected = {}) {
  return (FACET_KEYS[group] ?? []).every((key) => !selected[key] || facetValues(key, record).includes(selected[key]));
}

const FILTER_ARIA = {
  equipment: ["Lọc trang bị", "筛选装备"],
  advisors: ["Lọc quân sư", "筛选军师"],
  "troop-mods": ["Lọc cải tạo binh chủng", "筛选兵种进阶"],
  buildings: ["Lọc công trình", "筛选建筑"],
};

/** Hàng chip lọc; chip bật là `aria-pressed="true"`, nút "Tất cả" bật khi khía cạnh không có giá trị chọn. */
export function masterFilterTree(group, items, selected = {}, locale) {
  const chips = [];
  masterFacets(group, items, locale).forEach((facet, index) => {
    if (index > 0) chips.push(h("span", { class: "lookup-filter-divider", "aria-hidden": "true" }));
    const chip = (value, label, count, tone) => h("button", {
      type: "button",
      class: "fchip",
      "aria-pressed": String((selected[facet.key] ?? "") === value),
      "data-facet": facet.key,
      "data-value": value,
      "data-tone": tone,
    }, [
      label,
      h("span", { class: "fchip-count" }, String(count)),
    ]);
    if (facet.hasAll) chips.push(chip("", text(locale, "Tất cả", "全部"), items.length, null));
    for (const option of facet.options) chips.push(chip(option.value, option.label, option.count, option.tone));
  });
  return h("div", { class: "lookup-filters", role: "group", "aria-label": pick(locale, ...FILTER_ARIA[group]) }, chips);
}

/* ---------- Danh sách ---------- */

/** Thứ tự hiển thị: cải tạo binh chủng gom theo binh chủng (Khiên → Cung → Thương → Kỵ), nhóm khác giữ nguyên. */
export function masterDisplayItems(group, items) {
  if (group !== "troop-mods") return items;
  return troopSections(items).flatMap((section) => section.items);
}

/** Mã mục chọn mặc định (mục đầu theo thứ tự hiển thị); danh sách rỗng trả `null`. */
export function masterDefaultId(group, items) {
  return masterDisplayItems(group, items)[0]?.id ?? null;
}

function troopSections(items) {
  const byLimit = new Map();
  for (const item of items) {
    const limit = facetValues("limit", item.record ?? {})[0];
    byLimit.set(limit, [...(byLimit.get(limit) ?? []), item]);
  }
  return sortedBy(TROOP_ORDER, [...byLimit.keys()]).map((limit) => ({ limit, items: byLimit.get(limit) }));
}

const current = (item, selectedId) => (item.id === selectedId ? "true" : null);

function equipmentCardTree(item, locale, selectedId) {
  const record = item.record ?? {};
  const quality = shown(record.qualityVi, locale);
  const slot = shown(record.slotVi, locale);
  const exclusive = item.exclusives?.length ?? 0;
  const meta = [slot, quality].filter(Boolean).join(" · ");
  return h("a", {
    class: "lookup-master-item lookup-eq-card",
    href: itemHref(item.id, locale),
    "data-lookup-id": item.id,
    "data-tone": record.qualityVi ? lookupSlug(record.qualityVi) : null,
    "aria-current": current(item, selectedId),
  }, [
    h("span", { class: "lookup-eq-head" }, [
      h("span", { class: "lookup-eq-glyph", lang: "zh-Hant", "aria-hidden": "true" }, glyph(record, item.nameVi, 2)),
      quality ? h("span", { class: "lookup-eq-quality" }, quality) : null,
    ]),
    h("span", { class: "lookup-eq-body" }, [
      h("span", { class: "lookup-eq-name" }, lookupDisplayName(record, item.nameVi, locale)),
      meta ? h("span", { class: "lookup-eq-meta" }, meta) : null,
      h("span", { class: exclusive ? "lookup-eq-specials is-exclusive" : "lookup-eq-specials" }, exclusive
        ? text(locale, `${exclusive} đặc kỹ độc quyền`, `${exclusive} 个专属特技`)
        : text(locale, "Chỉ đặc kỹ chung", "仅通用特技")),
    ]),
  ]);
}

/** Tên các võ tướng mang kỹ năng quân sư (đã có trong corpus), theo ngôn ngữ. */
function advisorHeroes(record, byId, locale) {
  return (record.heroIds ?? []).map((id) => byId?.get(id)).filter(Boolean).map((hero) => ({
    id: hero.id,
    name: lookupDisplayName(hero.record, hero.nameVi, locale),
    chinese: hero.record?.chinese,
    nameVi: hero.nameVi,
    iconUrl: hero.record?.iconUrl,
  }));
}

function advisorCardTree(item, locale, selectedId, byId) {
  const record = item.record ?? {};
  const element = shown(record.elementVi, locale);
  const heroes = advisorHeroes(record, byId, locale).map((hero) => hero.name);
  const owner = [heroes.join(", "), element ? text(locale, `hệ ${element}`, `${element}系`) : ""].filter(Boolean).join(" · ");
  const points = Number.isFinite(Number(record.tacticPoints)) ? Number(record.tacticPoints) : null;
  const effect = String((isZh(locale) ? record.effectZh : record.effectVi) ?? "").trim();
  return h("a", {
    class: "lookup-master-item lookup-adv-card",
    href: itemHref(item.id, locale),
    "data-lookup-id": item.id,
    "data-tone": record.elementVi ? lookupSlug(record.elementVi) : null,
    "aria-current": current(item, selectedId),
  }, [
    h("span", { class: "lookup-adv-head" }, [
      h("span", { class: "lookup-adv-glyph", lang: "zh-Hant", "aria-hidden": "true" }, ELEMENT_GLYPH[record.elementVi] ?? glyph(record, item.nameVi)),
      h("span", { class: "lookup-adv-ident" }, [
        h("span", { class: "lookup-adv-name" }, lookupDisplayName(record, item.nameVi, locale)),
        owner ? h("span", { class: "lookup-adv-meta" }, owner) : null,
      ]),
      points === null ? null : h("span", { class: "lookup-adv-points" }, [
        h("strong", {}, String(points)),
        text(locale, "điểm", "点"),
      ]),
    ]),
    effect ? h("span", { class: "lookup-adv-effect" }, effect) : null,
    h("span", { class: "lookup-adv-foot" }, [
      h("span", {}, points === null ? "" : text(locale, `${points} điểm chiến pháp`, `${points} 战法点`)),
      h("span", { class: "lookup-adv-more" }, text(locale, "Chi tiết →", "详情 →")),
    ]),
  ]);
}

function rowTree(item, locale, selectedId, { sub, aside }) {
  const record = item.record ?? {};
  const han = zhName(record);
  return h("a", {
    class: "lookup-master-item lookup-row",
    href: itemHref(item.id, locale),
    "data-lookup-id": item.id,
    "aria-current": current(item, selectedId),
  }, [
    h("span", { class: "lookup-row-glyph", lang: "zh-Hant", "aria-hidden": "true" }, glyph(record, item.nameVi)),
    h("span", { class: "lookup-row-body" }, [
      h("span", { class: "lookup-row-name" }, lookupDisplayName(record, item.nameVi, locale)),
      sub ? h("span", { class: "lookup-row-sub" }, sub) : null,
    ]),
    // Bản zh: tên hiển thị đã là chữ Hán, không lặp lại.
    han && !isZh(locale) && !aside ? h("span", { class: "lookup-row-zh", lang: "zh-Hant" }, han) : null,
    aside ? h("span", { class: "lookup-row-aside" }, aside) : null,
  ]);
}

function troopRowTree(item, locale, selectedId) {
  if (isZh(locale)) return rowTree(item, locale, selectedId, { sub: String(item.record?.appliesToZh ?? "").trim() });
  const applies = String(item.record?.appliesToVi ?? "").trim();
  return rowTree(item, locale, selectedId, { sub: applies || "Chưa có đội hình tham khảo" });
}

function buildingRowTree(item, locale, selectedId) {
  const record = item.record ?? {};
  const max = Number.isFinite(Number(record.maxLevel)) ? Number(record.maxLevel) : null;
  return rowTree(item, locale, selectedId, {
    sub: facetLabel("scope", record.mainCityOnly ? "main" : "all", locale),
    aside: max === null ? "" : text(locale, `Lv ${max}`, `${max} 级`),
  });
}

/** Danh sách kết quả của bốn nhóm catalog (rỗng trả `[]`); `selectedId` là mục đang chọn. */
export function masterResultTrees(group, items, locale, { selectedId = null, byId = null, visibleCount = null } = {}) {
  if (!items.length) return [];
  const later = (tree, item) => laterTree(tree, items.indexOf(item), visibleCount);
  if (group === "equipment") return items.map((item) => later(equipmentCardTree(item, locale, selectedId), item));
  if (group === "advisors") return items.map((item) => later(advisorCardTree(item, locale, selectedId, byId), item));
  if (group === "buildings") return items.map((item) => later(buildingRowTree(item, locale, selectedId), item));
  return troopSections(items).map((section) => h("section", { class: "lookup-row-group" }, [
    h("h2", { class: "lookup-row-group-title" }, [
      facetLabel("limit", section.limit, locale),
      h("span", { class: "lookup-row-group-count" }, ` · ${section.items.length}`),
    ]),
    ...section.items.map((item) => later(troopRowTree(item, locale, selectedId), item)),
  ]));
}

/** Dòng trạng thái: "<strong>n</strong> vũ khí · màu thẻ theo phẩm chất". */
export function masterSummaryTrees(group, total, locale, selected = {}) {
  const slot = group === "equipment" && selected.slot ? facetLabel("slot", selected.slot, locale) : "";
  const tail = {
    equipment: text(locale, " · màu thẻ theo phẩm chất", " · 卡片颜色按品质"),
    advisors: text(locale, " · chia theo hệ", " · 按属性分类"),
    "troop-mods": text(locale, " · chia theo binh chủng · dòng phụ là đội hình hay dùng", " · 按兵种分类"),
    buildings: text(locale, " · cấp tối đa bên phải", " · 右侧为最高等级"),
  }[group];
  const unit = {
    equipment: slot ? text(locale, slot.toLowerCase(), `件${slot}`) : text(locale, "trang bị", "件装备"),
    advisors: text(locale, "kỹ năng quân sư", "位军师"),
    "troop-mods": text(locale, "cải tạo", "项兵种进阶"),
    buildings: text(locale, "công trình", "座建筑"),
  }[group];
  return [h("strong", {}, String(total)), ` ${unit}`, h("span", { class: "lookup-summary-tail" }, tail)];
}

/* ---------- Chi tiết ---------- */

const chevronBack = () => h("span", { class: "lookup-detail-back-icon", "aria-hidden": "true" });

function backLink(group, locale) {
  return h("a", {
    class: "lookup-detail-back",
    href: localePath(lookupGroupPath(group), locale),
    "data-lookup-back": "",
  }, [chevronBack(), masterGroupLabel(group, locale)]);
}

const badge = (className, label, attrs = {}) => h("span", { class: `badge ${className}`, ...attrs }, label);

/** Đầu chi tiết dùng chung: ô chữ, dòng nhãn nhóm (mobile), tên + chữ Hán, huy hiệu. */
function headTree({ tile, tone, eyebrow, title, han, badges }) {
  return h("header", { class: "lookup-detail-head" }, [
    h("span", { class: "lookup-detail-tile", lang: "zh-Hant", "aria-hidden": "true", "data-tone": tone }, tile),
    h("div", { class: "lookup-detail-ident" }, [
      h("span", { class: "lookup-detail-eyebrow" }, eyebrow),
      h("div", { class: "lookup-detail-titles" }, [
        h("h2", { class: "lookup-detail-title", id: "lookup-detail-title" }, title),
        han ? h("span", { class: "lookup-detail-zh", lang: "zh-Hant" }, han) : null,
      ]),
      badges.length ? h("div", { class: "lookup-detail-badges" }, badges) : null,
    ]),
  ]);
}

const sectionTree = (className, heading, body) => h("section", { class: `lookup-detail-section ${className}` }, [
  heading ? h("h3", { class: "lookup-detail-heading" }, heading) : null,
  ...body,
]);

/** Bản zh bỏ phần chỉ có chữ Việt; báo một dòng để người đọc biết chi tiết chưa đầy đủ. */
const zhNoteTree = () => h("p", { class: "lookup-detail-note" }, "部分说明暂无中文原文，未在此显示。");
/** Cờ chữ Hán dịch từ tiếng Việt (`zhSource.kind === "translation"`), chỉ gắn ở bản zh. */
const zhTranslatedTree = (locale) => h("span", { ...ZH_TRANSLATED_TAG_ATTRS }, zhTranslatedTextNote(locale));

function heroLink(hero, locale) {
  return h("a", { class: "lookup-detail-link", href: itemHref(hero.id, locale) }, hero.name);
}

function specialCardTree(special, byId, locale, targetId) {
  const hero = special.exclusiveHeroId ? byId?.get(special.exclusiveHeroId) : null;
  const heroInfo = hero ? { id: hero.id, name: lookupDisplayName(hero.record, hero.nameVi, locale) } : null;
  const description = isZh(locale) ? "" : String(special.descriptionVi ?? "").trim();
  const sources = isZh(locale) ? [] : (special.acquisitionVi ?? []).filter(Boolean);
  const han = isZh(locale) ? "" : zhName(special);
  return h("article", {
    class: special.id === targetId ? "lookup-special is-target" : "lookup-special",
    "data-tier": special.tierVi ?? null,
    "data-special-id": special.id,
  }, [
    h("div", { class: "lookup-special-head" }, [
      special.tierVi ? badge("badge-tier", shown(special.tierVi, locale), { "data-tier": special.tierVi }) : null,
      h("span", { class: "lookup-special-name" }, lookupDisplayName(special, special.nameVi, locale)),
      han ? h("span", { class: "lookup-special-zh", lang: "zh-Hant" }, han) : null,
    ]),
    heroInfo ? h("span", { class: "lookup-special-hero" }, isZh(locale)
      ? [heroLink(heroInfo, locale), "装备时专属"]
      : ["Độc quyền khi ", heroLink(heroInfo, locale), " trang bị"]) : null,
    description ? h("p", { class: "lookup-special-desc" }, description) : null,
    sources.length ? h("span", { class: "lookup-special-source" }, `Nguồn: ${sources.join(", ")}`) : null,
  ]);
}

function commonSpecialRow(special, locale) {
  const description = isZh(locale) ? "" : String(special.descriptionVi ?? "").trim();
  return h("li", { class: "lookup-special-row", "data-special-id": special.id }, [
    badge("badge-tier", shown(special.tierVi, locale), { "data-tier": special.tierVi ?? null }),
    h("span", { class: "lookup-special-row-body" }, [
      h("span", { class: "lookup-special-row-name" }, lookupDisplayName(special, special.nameVi, locale)),
      description ? h("span", { class: "lookup-special-row-desc" }, description) : null,
    ]),
  ]);
}

/** Đặc kỹ chung của một trang bị: không gắn trang bị nào và cùng ô (hoặc không phân ô), từ bậc T0 mạnh nhất. */
export function commonSpecialsFor(record, specials) {
  return specials
    .filter((special) => !special.equipmentId && (!special.slotVi || special.slotVi === record.slotVi))
    .map((special, index) => ({ special, index }))
    .sort((a, b) => byTier(a.special, b.special) || a.index - b.index)
    .map(({ special }) => special);
}

function equipmentDetail(item, corpus, locale, targetId) {
  const record = item.record ?? {};
  const byId = corpus.byId;
  const slot = shown(record.slotVi, locale);
  const quality = shown(record.qualityVi, locale);
  const exclusives = [...(item.exclusives ?? [])].sort(byTier);
  const common = commonSpecialsFor(record, corpus.catalog?.specials ?? []);
  const hidden = isZh(locale) && [...exclusives, ...common].some((special) => special.descriptionVi);
  return [
    headTree({
      tile: glyph(record, item.nameVi),
      tone: record.qualityVi ? lookupSlug(record.qualityVi) : null,
      eyebrow: [masterGroupLabel("equipment", locale), slot].filter(Boolean).join(" · "),
      title: lookupDisplayName(record, item.nameVi, locale),
      han: isZh(locale) ? "" : zhName(record),
      badges: [
        slot ? badge("unit", slot) : null,
        quality ? badge("badge-tone", quality, { "data-tone": lookupSlug(record.qualityVi) }) : null,
      ].filter(Boolean),
    }),
    exclusives.length ? sectionTree("lookup-eq-exclusive", text(locale, "Đặc kỹ độc quyền", "专属特技"),
      exclusives.map((special) => specialCardTree(special, byId, locale, targetId))) : null,
    common.length ? sectionTree("lookup-eq-common", text(locale, "Đặc kỹ chung có thể rèn", "可锻造通用特技"), [
      h("ul", { class: "lookup-special-list" }, common.map((special) => commonSpecialRow(special, locale))),
      h("span", { class: "lookup-detail-footnote" }, text(locale,
        `Bậc T0 mạnh nhất → T3. ${common.length} đặc kỹ chung dùng cho mọi trang bị cùng loại.`,
        `T0 最强 → T3。共 ${common.length} 个通用特技，同类装备均可使用。`)),
    ]) : null,
    hidden ? zhNoteTree() : null,
  ];
}

/** Đặc kỹ không gắn trang bị nào (đặc kỹ chung hoặc chưa rõ trang bị cha): chi tiết riêng của chính nó. */
function specialDetail(item, corpus, locale) {
  const record = item.record ?? {};
  const parent = record.equipmentId ? corpus.byId.get(record.equipmentId) : null;
  const slot = shown(record.slotVi, locale);
  return [
    headTree({
      tile: glyph(record, item.nameVi),
      tone: null,
      eyebrow: [masterGroupLabel("equipment", locale), text(locale, "Đặc kỹ", "特技")].join(" · "),
      title: lookupDisplayName(record, item.nameVi, locale),
      han: isZh(locale) ? "" : zhName(record),
      badges: [
        record.tierVi ? badge("badge-tier", shown(record.tierVi, locale), { "data-tier": record.tierVi }) : null,
        slot ? badge("unit", slot) : null,
      ].filter(Boolean),
    }),
    sectionTree("lookup-eq-exclusive", text(locale, "Đặc kỹ", "特技"), [
      specialCardTree(record, corpus.byId, locale, record.id),
      parent ? h("a", { class: "lookup-detail-link", href: itemHref(parent.id, locale) }, lookupDisplayName(parent.record, parent.nameVi, locale)) : null,
    ]),
    isZh(locale) && record.descriptionVi ? zhNoteTree() : null,
  ];
}

function advisorDetail(item, corpus, locale) {
  const record = item.record ?? {};
  const element = shown(record.elementVi, locale);
  const heroes = advisorHeroes(record, corpus.byId, locale);
  const points = Number.isFinite(Number(record.tacticPoints)) ? Number(record.tacticPoints) : null;
  const zh = isZh(locale);
  const effect = effectVersions(zh ? record.effectZh : record.effectVi);
  const usage = String((zh ? record.usageZh : record.usageVi) ?? "").trim();
  const effectBoxes = effect.map((block) => h("div", { class: "lookup-effect-box" }, [
    block.labelVi ? h("span", { class: "lookup-version-tag" }, block.labelVi) : null,
    ...block.paragraphs.map((paragraph) => h("p", {}, paragraph)),
  ]));
  return [
    headTree({
      tile: ELEMENT_GLYPH[record.elementVi] ?? glyph(record, item.nameVi),
      tone: record.elementVi ? lookupSlug(record.elementVi) : null,
      eyebrow: [masterGroupLabel("advisors", locale), element ? text(locale, `Hệ ${element}`, `${element}系`) : ""].filter(Boolean).join(" · "),
      title: lookupDisplayName(record, item.nameVi, locale),
      han: isZh(locale) ? "" : zhName(record),
      badges: [
        element ? badge("badge-tone", text(locale, `Hệ ${element}`, `${element}系`), { "data-tone": lookupSlug(record.elementVi) }) : null,
        badge("unit", text(locale, "Kỹ năng quân sư", "军师技能")),
        points === null ? null : badge("badge-outline lookup-detail-badge-extra", text(locale, `${points} điểm chiến pháp`, `${points} 战法点`)),
      ].filter(Boolean),
    }),
    heroes.length || points !== null ? h("dl", { class: "lookup-detail-facts" }, [
      heroes.length ? h("div", { class: "lookup-detail-fact" }, [
        h("dt", {}, text(locale, "Võ tướng", "武将")),
        h("dd", {}, heroes.flatMap((hero, index) => [index ? ", " : null, heroLink(hero, locale)])),
      ]) : null,
      points === null ? null : h("div", { class: "lookup-detail-fact" }, [
        h("dt", {}, text(locale, "Điểm chiến pháp", "战法点")),
        h("dd", { class: "lookup-detail-fact-strong" }, String(points)),
      ]),
    ]) : null,
    heroes.length ? sectionTree("lookup-adv-heroes", text(locale, "Võ tướng", "武将"), heroes.map((hero) => h("a", {
      class: "lookup-hero-row",
      href: itemHref(hero.id, locale),
    }, [
      portraitTree({ chinese: hero.chinese, nameVi: hero.nameVi, iconUrl: hero.iconUrl, className: "lookup-hero-row-portrait", alt: hero.name }),
      h("span", { class: "lookup-hero-row-body" }, [
        h("span", { class: "lookup-hero-row-name" }, hero.name),
        h("span", { class: "lookup-hero-row-note" }, text(locale, "Võ tướng mang kỹ năng này", "携带此技能的武将")),
      ]),
    ]))) : null,
    effectBoxes.length ? sectionTree("lookup-adv-effect", text(locale, "Hiệu quả", "效果"), [
      zh && isTranslatedZhText(record) ? zhTranslatedTree(locale) : null,
      h("div", { class: "lookup-effect-boxes" }, effectBoxes),
    ]) : null,
    usage ? sectionTree("lookup-adv-usage", text(locale, "Cách dùng", "用法"), [h("p", { class: "lookup-detail-prose" }, usage)]) : null,
    zh && ((record.effectVi && !record.effectZh) || (record.usageVi && !record.usageZh)) ? zhNoteTree() : null,
  ];
}

/** Khóa so khớp tên lựa chọn: bỏ dấu, chữ thường, bỏ ký tự ngăn ("Chuyển·Cầm Thương" = "Chuyển · Cầm thương"). */
const optionKey = (value) => lookupSlug(value).replace(/-/g, "");

/**
 * Mã các lựa chọn cải tạo thuộc lộ trình gợi ý: tên trong dấu 【…】 của `suggestedBuildVi` khớp tên lựa chọn
 * (bỏ dấu/hoa thường). Không có gợi ý hoặc tên không khớp lựa chọn nào thì không đánh dấu gì.
 */
export function troopSuggestedIds(record) {
  const names = new Set([...String(record?.suggestedBuildVi ?? "").matchAll(/【([^】]+)】/gu)].map((match) => optionKey(match[1])));
  names.delete("");
  return new Set((record?.options ?? []).filter((option) => names.has(optionKey(option.nameVi))).map((option) => option.id));
}

/** Phiên bản hiệu quả: bản sửa đổi của nguồn (bản hiện hành trước) hoặc các khối phiên bản của chữ hiệu quả. */
export function troopEffectVersions(record) {
  const revisions = (record?.revisions ?? []).filter((revision) => String(revision.textVi ?? "").trim());
  if (revisions.length) {
    return revisions.map((revision) => ({
      label: revision.isCurrent && revision.effectiveDate ? `${revision.labelVi} · ${revision.effectiveDate}` : String(revision.labelVi ?? ""),
      paragraphs: [String(revision.textVi).trim()],
    }));
  }
  return effectVersions(record?.effectVi).map((block, index) => ({ label: block.labelVi ?? "", paragraphs: block.paragraphs, index }));
}

function optionCardTree(option, suggested, locale) {
  const zh = isZh(locale);
  const converts = zh ? shown(option.convertsToVi, locale) : String(option.convertsToVi ?? "").trim();
  const description = String((zh ? option.descriptionZh : option.descriptionVi) ?? "").trim();
  return h("div", { class: suggested ? "lookup-option-card is-suggested" : "lookup-option-card" }, [
    h("span", { class: "lookup-option-card-head" }, [
      h("span", { class: "lookup-option-card-name" }, zh ? option.nameZh : option.nameVi),
      suggested ? badge("badge-suggest", text(locale, "Gợi ý", "推荐")) : null,
    ]),
    description ? h("span", { class: "lookup-option-card-desc" }, description) : null,
    converts ? h("span", { class: "lookup-option-card-convert" }, text(locale, `Chuyển thành ${converts}`, `转为${converts}`)) : null,
  ]);
}

function troopDetail(item, corpus, locale) {
  const record = item.record ?? {};
  const zh = isZh(locale);
  const limits = (record.troopLimitVi ?? []).map((limit) => facetLabel("limit", limit, locale)).filter(Boolean);
  const conditionsVi = (record.conditions ?? []).map((row) => (typeof row === "string" ? row : row?.textVi)).filter(Boolean);
  // Bản zh: điều kiện hiện khi dịch được hết (mùa "Binh Diễn Xuân Thu"…), chữ Hán do bộ giá trị đóng của lookup-detail.
  const conditionsZh = conditionsVi.map((row) => shown(row, locale));
  const conditions = !zh ? conditionsVi : conditionsZh.every(Boolean) ? conditionsZh : [];
  const applies = String((zh ? record.appliesToZh : record.appliesToVi) ?? "").trim();
  const versions = !zh ? troopEffectVersions(record)
    : effectVersions(record.effectZh).map((block, index) => ({ label: block.labelVi ?? "", paragraphs: block.paragraphs, index }));
  const options = zh ? (record.options ?? []).filter((option) => option.nameZh) : record.options ?? [];
  const suggested = troopSuggestedIds(record);
  const tiers = unique(options.map((option) => option.tierVi ?? ""));
  const columns = [...TROOP_TIER_ORDER.filter((tier) => tiers.includes(tier)), ...tiers.filter((tier) => !TROOP_TIER_ORDER.includes(tier))];
  const build = String((zh ? record.suggestedBuildZh : record.suggestedBuildVi) ?? "").trim();
  const translated = zh && (isTranslatedZhText(record) || options.some(isTranslatedZhText));
  const hidden = zh && ((record.effectVi && !record.effectZh) || options.length < (record.options ?? []).length
    || (record.appliesToVi && !applies) || (record.suggestedBuildVi && !build) || conditions.length < conditionsVi.length);
  const troopVersionLabel = (version, index) => version.label || text(locale, `Bản ${index + 1}`, `版本 ${index + 1}`);
  return [
    headTree({
      tile: glyph(record, item.nameVi),
      tone: "accent",
      eyebrow: [text(locale, "Cải tạo", "进阶"), limits.join(", ")].filter(Boolean).join(" · "),
      title: lookupDisplayName(record, item.nameVi, locale),
      han: zh ? "" : zhName(record),
      badges: [
        ...limits.map((limit) => badge("unit", limit)),
        ...conditions.map((condition) => badge("badge-scenario", condition)),
      ],
    }),
    translated ? h("p", {}, [zhTranslatedTree(locale)]) : null,
    applies ? sectionTree("lookup-troop-applies", text(locale, "Thường dùng cho", "常用于"), [h("p", { class: "lookup-detail-prose" }, applies)]) : null,
    versions.length ? sectionTree("lookup-troop-effect", text(locale, "Hiệu quả", "效果"), [
      versions.length > 1 ? h("div", {
        class: "lookup-effect-tabs",
        role: "group",
        "aria-label": text(locale, "Phiên bản hiệu quả", "效果版本"),
      }, versions.map((version, index) => h("button", {
        type: "button",
        class: "fchip",
        "aria-pressed": String(index === 0),
        "data-effect-tab": String(index),
      }, troopVersionLabel(version, index)))) : null,
      // Mỗi panel mở bằng nhãn của chính nó: không JavaScript (CSS hiện mọi panel) và llms vẫn biết đoạn thuộc bản nào.
      ...versions.map((version, index) => h("div", {
        class: "lookup-effect-text",
        "data-effect-panel": String(index),
        hidden: index === 0 ? null : true,
      }, [
        versions.length > 1 ? h("p", { class: "lookup-version-tag lookup-effect-version-label" }, troopVersionLabel(version, index)) : null,
        ...version.paragraphs.map((paragraph) => h("p", { class: "lookup-detail-prose" }, paragraph)),
      ])),
    ]) : null,
    options.length ? sectionTree("lookup-troop-tree", "", [
      h("div", { class: "lookup-tree-head" }, [
        h("h3", { class: "lookup-detail-heading" }, text(locale, `Cây cải tạo · ${options.length} lựa chọn`, `进阶树 · ${options.length} 个选项`)),
        suggested.size ? h("span", { class: "lookup-tree-hint" }, text(locale, "Khung son = lộ trình gợi ý", "红框 = 推荐路线")) : null,
      ]),
      h("div", { class: "lookup-tree" }, columns.map((tier) => {
        const rows = options.filter((option) => (option.tierVi ?? "") === tier);
        return h("div", { class: "lookup-tree-column" }, [
          h("span", { class: "lookup-tree-tier" }, [zh ? shown(tier, locale) || MISSING : tier, h("span", { class: "lookup-tree-count" }, ` · ${rows.length}`)]),
          ...rows.map((option) => optionCardTree(option, suggested.has(option.id), locale)),
        ]);
      })),
    ]) : null,
    build ? h("div", { class: "lookup-build-bar" }, [
      h("span", { class: "lookup-build-label" }, text(locale, "Gợi ý build", "推荐搭配")),
      h("span", { class: "lookup-build-text" }, build),
    ]) : null,
    hidden ? zhNoteTree() : null,
  ];
}

/* ---------- Công trình ---------- */

/** Thời lượng dạng "2 giờ"; bản zh đổi đơn vị, dạng lạ trả `null` (hiện "—"). */
function durationLabel(value, locale) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (!isZh(locale)) return raw;
  const match = /^(\d+(?:[.,]\d+)?)\s*(giờ|phút|ngày|giây)$/u.exec(raw);
  return match ? `${match[1]} ${{ "giờ": "小时", "phút": "分钟", "ngày": "天", "giây": "秒" }[match[2]]}` : null;
}

const costValue = (costs, key) => (costs && costs[key] !== null && costs[key] !== undefined && costs[key] !== "" ? Number(costs[key]) : null);

/** Tổng tài nguyên qua mọi cấp (ô không có giá trị bỏ qua); khóa không có giá trị nào thì `null`. */
export function buildingTotals(levels) {
  const totals = {};
  for (const [key] of COST_KEYS) {
    const values = levels.map((level) => costValue(level.costs, key)).filter((value) => Number.isFinite(value));
    totals[key] = values.length ? values.reduce((sum, value) => sum + value, 0) : null;
  }
  return totals;
}

/**
 * Số có dấu đầu tiên trong hiệu ứng của cấp cuối kèm đơn vị liền sau ("+15%", "+15000/giờ"); không có thì `null`.
 * `field` chọn chữ hiệu ứng (`effectZh` cho bản zh).
 */
export function buildingHeadline(levels, field = "effectVi") {
  const last = [...levels].sort((a, b) => a.level - b.level).at(-1);
  const match = /[+\-−]\s?\d[\d.,]*(?:\s?%|\/\p{L}+)?/u.exec(String(last?.[field] ?? ""));
  return match ? match[0].replace(/\s+/gu, "") : null;
}

function levelRowTree(level, isMax, locale) {
  const zh = isZh(locale);
  const cell = (className, label, value) => h("td", { class: className, "data-label": label }, value);
  return h("tr", { class: isMax ? "lookup-level-row is-max" : "lookup-level-row" }, [
    h("th", { scope: "row", class: "lookup-level-num", "data-label": text(locale, "Cấp", "等级") }, String(level.level)),
    cell("lookup-level-effect", text(locale, "Hiệu quả", "效果"), String((zh ? level.effectZh : level.effectVi) ?? "").trim() || MISSING),
    ...COST_KEYS.map(([key, vi, zhLabel]) => {
      const value = costValue(level.costs, key);
      return cell("lookup-level-cost", pick(locale, vi, zhLabel), Number.isFinite(value) ? formatNumber(value, locale) : MISSING);
    }),
    cell("lookup-level-time", text(locale, "Thời gian", "耗时"), (zh && level.durationZh) || durationLabel(level.durationVi, locale) || MISSING),
  ]);
}

function buildingDetail(item, corpus, locale) {
  const record = item.record ?? {};
  const zh = isZh(locale);
  const levels = [...(record.levels ?? [])].sort((a, b) => a.level - b.level);
  const last = levels.at(-1);
  const max = Number.isFinite(Number(record.maxLevel)) ? Number(record.maxLevel) : last?.level ?? null;
  const scope = facetLabel("scope", record.mainCityOnly ? "main" : "all", locale);
  const headline = buildingHeadline(levels, zh ? "effectZh" : "effectVi");
  const duration = last ? (zh && last.durationZh) || durationLabel(last.durationVi, locale) : null;
  const totals = buildingTotals(levels);
  const totalParts = COST_KEYS.filter(([key]) => Number.isFinite(totals[key]) && totals[key] > 0)
    .map(([key, vi, zhLabel]) => `${pick(locale, vi.toLowerCase(), zhLabel)} ${formatNumber(totals[key], locale)}`);
  const summary = String((zh ? record.summaryZh : record.summaryVi) ?? "").trim();
  const tile = (label, value, className = "") => h("div", { class: `lookup-stat-tile ${className}`.trim() }, [
    h("span", { class: "lookup-stat-tile-label" }, label),
    h("span", { class: "lookup-stat-tile-value" }, value),
  ]);
  return [
    headTree({
      tile: glyph(record, item.nameVi),
      tone: "accent",
      eyebrow: [masterGroupLabel("buildings", locale), scope.toLowerCase()].filter(Boolean).join(" · "),
      title: lookupDisplayName(record, item.nameVi, locale),
      han: zh ? "" : zhName(record),
      badges: [
        max === null ? null : badge("badge-fill lookup-detail-badge-extra", text(locale, `Cấp tối đa ${max}`, `最高等级 ${max}`)),
        badge("badge-outline lookup-detail-badge-extra", scope),
      ].filter(Boolean),
    }),
    h("div", { class: "lookup-stat-tiles" }, [
      max === null ? null : tile(text(locale, "Cấp tối đa", "最高等级"), String(max), "lookup-stat-tile-wide"),
      tile(text(locale, "Xây ở", "建造于"), scope, "lookup-stat-tile-wide"),
      headline ? tile(text(locale, "Hiệu quả cấp max", "满级效果"), headline) : null,
      duration ? tile(text(locale, "Thời gian cấp max", "满级耗时"), duration) : null,
    ]),
    summary && zh && isTranslatedZhText(record) ? h("p", {}, [zhTranslatedTree(locale)]) : null,
    summary ? h("p", { class: "lookup-detail-prose lookup-detail-summary" }, summary) : null,
    levels.length ? sectionTree("lookup-building-levels", text(locale, "Theo cấp", "按等级"), [
      h("div", { class: "lookup-levels-panel" }, [h("table", { class: "lookup-levels-table" }, [
        h("thead", {}, [h("tr", {}, [
          h("th", { scope: "col" }, text(locale, "Cấp", "等级")),
          h("th", { scope: "col" }, text(locale, "Hiệu quả", "效果")),
          ...COST_KEYS.map(([, vi, zhLabel]) => h("th", { scope: "col", class: "lookup-level-cost" }, pick(locale, vi, zhLabel))),
          h("th", { scope: "col", class: "lookup-level-time" }, text(locale, "Thời gian", "耗时")),
        ])]),
        h("tbody", {}, levels.map((level) => levelRowTree(level, level === last, locale))),
      ])]),
      totalParts.length && max !== null ? h("span", { class: "lookup-detail-footnote" }, text(locale,
        `Tổng tài nguyên lên cấp ${max}: ${totalParts.join(" · ")}`,
        `升至 ${max} 级总资源：${totalParts.join(" · ")}`)) : null,
    ]) : null,
    zh && ((record.summaryVi && !record.summaryZh) || levels.some((level) => level.effectVi && !level.effectZh)) ? zhNoteTree() : null,
  ];
}

/** Cây `tree` với tiêu đề chi tiết (`#lookup-detail-title`) đổi từ `h2` thành `h1` (trang riêng chỉ có một `h1`). */
function titleAsH1(tree) {
  if (typeof tree === "string") return tree;
  const children = tree.children.map(titleAsH1);
  return tree.tag === "h2" && tree.attrs.id === "lookup-detail-title"
    ? { ...tree, tag: "h1", children }
    : { ...tree, children };
}

/**
 * Panel chi tiết của một mục (hoặc đặc kỹ, với `item` là mục `equipment-special:`): nội dung của `<aside>`.
 * `targetId` là mục đang mở (đặc kỹ được tô khung trong chi tiết trang bị cha). `page` là trang riêng của mục: tiêu đề là
 * `h1` và không có link quay lại danh sách (trang đã có hàng quay lại của nó).
 */
export function masterDetailTree(group, item, corpus, locale, { targetId = item.id, page = false } = {}) {
  const body = group === "equipment"
    ? (item.id.startsWith("equipment-special:") ? specialDetail(item, corpus, locale) : equipmentDetail(item, corpus, locale, targetId))
    : group === "advisors" ? advisorDetail(item, corpus, locale)
      : group === "troop-mods" ? troopDetail(item, corpus, locale)
        : buildingDetail(item, corpus, locale);
  const tree = h("article", {
    class: `lookup-detail lookup-detail-${group}`,
    "data-lookup-detail": item.id,
    "aria-labelledby": "lookup-detail-title",
  }, [page ? null : backLink(group, locale), ...body.filter(Boolean)]);
  return page ? titleAsH1(tree) : tree;
}

/**
 * Mục mà mã hồ sơ `id` mở trong panel: trang bị mở chính nó; đặc kỹ gắn trang bị cha mở trang bị cha (đặc kỹ được
 * tô khung), đặc kỹ không có cha mở chi tiết riêng; mã không có trong corpus trả `null`.
 */
export function masterTargetFor(corpus, id) {
  const row = corpus.byId.get(id);
  if (!row) return null;
  if (id.startsWith("equipment-special:")) {
    const parent = row.record?.equipmentId ? corpus.byId.get(row.record.equipmentId) : null;
    if (parent) return { item: parent, targetId: id };
  }
  return { item: row, targetId: id };
}
