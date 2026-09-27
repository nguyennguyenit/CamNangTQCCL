// Cửa tra cứu bảy nhóm: lưới tướng 6 cột, bảng chiến pháp, hộp thoại hồ sơ theo artboard
// Lookup/LookupTactics/LookupProfile/LookupMobile.
//
// Quy tắc render (plan.md quyết định #14): dữ liệu động chỉ qua `el()`/`textContent`, không `innerHTML`.
// Chân dung đi qua helper dùng chung `js/hero-portrait.js` (nâng https, no-referrer, fallback chữ Hán).
// Khối "Trong cẩm nang" đọc số liệu tính lúc build (`js/hero-summaries.js`) — chỉ tải manifest + đúng file
// số liệu khi mở hồ sơ đầu tiên, không kéo `index.json`/`other-teams.json` về trang Tra cứu.

import { el, icon, svgNode } from "./render.js";
import { LOOKUP_EMPTY, lookupDisplayName, lookupProfile, tacticTypeLabel, zhSafeValue } from "./lookup-detail.js";
import { L, currentLocale, localePath } from "./i18n.js";
import { createRawNameResolver } from "./website-display.js";
import { heroPortrait } from "./hero-portrait.js";
import { createHeroSummaryLoader } from "./hero-summaries.js";
import { teamDetailHref } from "./team-detail-navigation.js";
import { normalizeText } from "./filters.js";
import { bookLookupId } from "./lookup-ids.js";

export const LOOKUP_GROUPS = Object.freeze(["heroes", "tactics", "equipment", "advisors", "troop-mods", "buildings", "books"]);
/** Nhãn nhóm dùng chung cho chip ở trang Tra cứu và menu điều hướng (SiteLayout, bản Việt). */
export const LOOKUP_GROUP_LABELS = Object.freeze({
  heroes: "Tướng", tactics: "Chiến pháp", equipment: "Trang bị",
  advisors: "Quân sư", "troop-mods": "Cải tạo binh chủng", buildings: "Công trình", books: "Binh thư",
});
/** Nhãn nhóm bản Trung (`/zh/`): SiteLayout chọn theo `locale`, trang Tra cứu chọn theo `<html lang>`. */
export const LOOKUP_GROUP_LABELS_ZH = Object.freeze({
  heroes: "武将", tactics: "战法", equipment: "装备",
  advisors: "军师", "troop-mods": "兵种进阶", buildings: "建筑", books: "兵书",
});
/** Nhãn nhóm theo ngôn ngữ chỉ định (`vi` | `zh`). */
export function lookupGroupLabels(locale = currentLocale()) {
  return locale === "zh" ? LOOKUP_GROUP_LABELS_ZH : LOOKUP_GROUP_LABELS;
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

const GROUP_BY_KIND = Object.freeze({
  hero: "heroes", tactic: "tactics", equipment: "equipment", "equipment-special": "equipment",
  advisor: "advisors", "troop-mod": "troop-mods", building: "buildings", book: "books",
});
// `<html lang>` cố định theo trang nên hằng dịch lúc nạp module vẫn đúng ngôn ngữ.
const ROUTE_ERRORS = Object.freeze({
  "duplicate-param": L("Mỗi tham số tra cứu chỉ được xuất hiện một lần.", "每个查询参数只能出现一次。"),
  "unknown-group": L("Nhóm tra cứu không hợp lệ.", "查询分类无效。"),
  "id-kind-mismatch": L("Mục tra cứu không thuộc nhóm đã chọn.", "该条目不属于所选分类。"),
  "unknown-id-kind": L("Mã mục tra cứu không hợp lệ.", "条目编号无效。"),
});
const CJK_CHAR = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u;
const MISSING = "—";
const PAGE_SIZE = 60;

function errorRoute(code) {
  return { section: "lookup", group: null, id: null, error: code, messageVi: ROUTE_ERRORS[code] };
}

function groupForId(id) {
  if (typeof id !== "string") return null;
  const separator = id.indexOf(":");
  if (separator <= 0 || !/^[a-z0-9][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/.test(id)) return null;
  return GROUP_BY_KIND[id.slice(0, separator)] ?? null;
}

/**
 * Hồ sơ Tra cứu nằm trên query của `/tra-cuu/`: chỉ `group` và `id` được xét, khóa khác của
 * trang bị bỏ qua (link có `utm_*`/`fbclid` vẫn dùng được). Giá trị lặp hoặc sai vẫn là lỗi.
 * `group` là bộ lọc lưới người dùng đã chọn (`null` = tất cả), không suy từ loại `id`: loại của `id`
 * chỉ dùng để kiểm hợp lệ và tìm bản ghi.
 */
export function parseLookupQuery(search) {
  const params = new URLSearchParams(search ?? "");
  for (const key of ["group", "id"]) if (params.getAll(key).length > 1) return errorRoute("duplicate-param");
  const group = params.has("group") ? params.get("group") : null;
  const id = params.has("id") ? params.get("id") : null;
  if (group !== null && !LOOKUP_GROUPS.includes(group)) return errorRoute("unknown-group");
  const kind = id !== null ? groupForId(id) : null;
  if (id !== null && kind === null) return errorRoute("unknown-id-kind");
  if (group !== null && id !== null && group !== kind) return errorRoute("id-kind-mismatch");
  return { section: "lookup", group, id, error: null, messageVi: null };
}

export function formatLookupQuery(route) {
  const params = new URLSearchParams();
  if (route?.group) params.set("group", route.group);
  if (route?.id) params.set("id", route.id);
  return params.toString();
}

function entry(group, record) {
  const nameVi = String(record.viet ?? record.nameVi ?? record.hanViet ?? "").trim();
  const aliases = [
    ...(Array.isArray(record.aliases) ? record.aliases : []),
    ...(Array.isArray(record.aliasesVi) ? record.aliasesVi : []),
    ...(Array.isArray(record.aliasesZh) ? record.aliasesZh : []),
    record.chinese,
  ].filter((value) => typeof value === "string" && value.length > 0);
  const searchKeys = [nameVi, ...aliases].map(normalizeText);
  return { id: record.id, group, nameVi, aliases, searchKeys, record };
}

/**
 * Binh thư (`books-dict.json`) không có `id` trong dữ liệu: mã hồ sơ dựng bằng `bookLookupId` (dùng chung
 * với trang chi tiết đội), dòng không dựng được mã thì bỏ. Tên Hán-Việt và chữ Hán là khóa tìm phụ; `aliases`
 * (`{[id]: {aliases, formerNames}}`, tính lúc build từ bảng danh tính) thêm tên Hán nguồn và tên cũ đã xác nhận.
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
      aliasesZh: names(extra?.aliases),
      formerNames: names(extra?.formerNames),
    }];
  });
}

export function buildLookupCorpus({ heroes, tactics, catalog, books = [], bookAliases = null }) {
  const groups = {
    heroes: heroes.map((record) => entry("heroes", record)),
    tactics: tactics.map((record) => entry("tactics", record)),
    equipment: [...catalog.equipment, ...catalog.specials].map((record) => entry("equipment", record)),
    advisors: catalog.advisors.map((record) => entry("advisors", record)),
    "troop-mods": catalog.troopMods.map((record) => entry("troop-mods", record)),
    buildings: catalog.buildings.map((record) => entry("buildings", record)),
    books: bookRecords(books, bookAliases).map((record) => entry("books", record)),
  };
  const byId = new Map();
  for (const rows of Object.values(groups)) for (const row of rows) byId.set(row.id, row);
  return { groups, byId, heroes, tactics, catalog };
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

export function searchLookupGroup(corpus, { group = null, query = "", page = 1, pageSize = PAGE_SIZE, locale = currentLocale() } = {}) {
  const source = group ? (corpus.groups[group] ?? []) : LOOKUP_GROUPS.flatMap((key) => corpus.groups[key]);
  const needle = normalizeText(query);
  const filtered = needle
    ? source.filter((item) => item.searchKeys.some((key) => key.includes(needle)))
    : source;
  // Bản zh ưu tiên mục khớp tên chữ Hán; bản Việt giữ nguyên thứ tự nguồn.
  const matches = needle && locale === "zh"
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
/** Giá trị chữ của dữ liệu theo ngôn ngữ trang: bản zh chỉ giữ giá trị dịch được, còn lại rỗng (bị bỏ). */
const shown = (value) => {
  if (value === null || value === undefined || value === "") return "";
  return String(zhSafeValue(value) ?? "");
};
/** Mã phe cho class màu: dữ liệu luôn lưu phe bằng tiếng Việt, nhãn hiển thị có thể là chữ Trung. */
const FACTION_CODE_BY_LABEL = { ...FACTION_CODE, "魏": "nguy", "蜀": "thuc", "吴": "ngo", "群": "quan" };

/** Thẻ kết quả: huy hiệu biến thể, dòng phụ theo nhóm (phe/vai trò, phẩm/loại, vị trí…). */
export function lookupCardView(group, item) {
  const record = item.record ?? {};
  const lookup = record.lookup ?? {};
  const variant = VARIANT_LABEL[lookup.variant] ?? null;
  // Nhóm của chính mục (kết quả hỗn hợp không chọn nhóm vẫn phải hiện đúng dòng phụ theo nhóm).
  const kind = item.group ?? group;
  const hero = kind === "heroes";
  const parts = hero
    ? [
        shown(record.faction) ? { kind: "faction", text: shown(record.faction), code: FACTION_CODE[record.faction] ?? "none" } : null,
        record.cost ? { kind: "text", text: L(`Thống ngự ${record.cost}`, `统御 ${record.cost}`) } : null,
        shown(record.roleTagViet) ? { kind: "role", text: shown(record.roleTagViet) } : null,
      ]
    : [
        shown(record.qualityVi ?? record.quality) ? { kind: "text", text: shown(record.qualityVi ?? record.quality) } : null,
        kind === "tactics" && tacticTypeLabel(record.type) ? { kind: "text", text: tacticTypeLabel(record.type) } : null,
        kind === "equipment" && shown(record.slotVi) ? { kind: "text", text: shown(record.slotVi) } : null,
        kind === "advisors" && shown(record.elementVi) ? { kind: "text", text: shown(record.elementVi) } : null,
        kind === "troop-mods" && shown(record.appliesToVi) ? { kind: "text", text: shown(record.appliesToVi) } : null,
        kind === "buildings" && Number.isFinite(Number(record.maxLevel)) ? { kind: "text", text: L("Cấp tối đa ", "最高等级 ") + String(record.maxLevel) } : null,
      ];
  const meta = parts.filter(Boolean);
  return {
    variant,
    // Binh thư bản Việt dùng tên dịch nghĩa: không hiện chữ Hán (kể cả ô chân dung), chữ Hán chỉ là khóa tìm.
    chinese: kind === "books" && currentLocale() !== "zh" ? "" : recordChinese(record),
    faction: hero && shown(record.faction) ? shown(record.faction) : null,
    stars: hero && Number.isFinite(Number(record.stars)) ? L(`${record.stars} sao`, `${record.stars} 星`) : null,
    meta,
  };
}

const fieldByKey = (profile, key) => profile.fields.find((field) => field.key === key) ?? null;
const valueText = (field, fallback = MISSING) => {
  if (!field) return fallback;
  const value = field.value;
  if (value === null || value === undefined || value === "") return fallback;
  return field.textVi;
};

/** Một dòng bảng chiến pháp từ hồ sơ đã có; ô thiếu hiện "—", không bịa. */
export function tacticTableRow(profile) {
  const rate = fieldByKey(profile, "activationRate");
  return {
    nameVi: profile.titleVi,
    quality: valueText(fieldByKey(profile, "quality")),
    type: valueText(fieldByKey(profile, "type")),
    effectType: valueText(fieldByKey(profile, "effectTypeVi")),
    target: valueText(fieldByKey(profile, "target")),
    effect: valueText(fieldByKey(profile, "effect"), ""),
    rate: rate && rate.value !== null && rate.value !== undefined && rate.value !== "" ? rate.textVi : MISSING,
  };
}

/** % thanh chỉ số/thanh đếm theo trần `max`, khoá trong [0, 100]. */
function barPercent(value, max) {
  const ratio = max > 0 ? (Number(value) || 0) / max : 0;
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

/* Trần thanh chỉ số hồ sơ: artboard LookupProfile vẽ 81→68%, 89→74%, 91→76%, 37→31% (= giá trị/120).
   Dữ liệu thật đa số ≤100 nhưng vài tướng vượt (tới ~249); phần vượt 120 khoá đầy thanh, số vẫn in đúng. */
const STAT_BAR_MAX = 120;

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

/** Tiêu đề cột bảng chiến pháp (cũng là nhãn `data-label` của ô trên mobile). */
const TABLE_HEADS = Object.freeze({
  name: L("Chiến pháp", "战法"),
  quality: L("Phẩm", "品质"),
  type: L("Loại", "类型"),
  effectType: L("Hiệu quả", "效果类型"),
  target: L("Mục tiêu", "目标"),
  rate: L("Tỷ lệ", "发动率"),
});

/** Hướng điểm (tên Việt từ số liệu build) → chữ Trung; dạng không nhận ra trả rỗng để bản zh bỏ qua. */
const STAT_ZH = { "Trí Lực": "智力", "Võ Lực": "武力", "Thống Soái": "统率", "Tốc Độ": "速度", "Chính Trị": "政治", "Mị Lực": "魅力" };
function statFocusZh(name) {
  const value = String(name ?? "").trim();
  const full = /^Toàn (.+)$/u.exec(value);
  if (full) return STAT_ZH[full[1]] ? `全${STAT_ZH[full[1]]}` : "";
  const pair = /^(.+) và (.+)$/u.exec(value);
  if (pair) return STAT_ZH[pair[1]] && STAT_ZH[pair[2]] ? `${STAT_ZH[pair[1]]}、${STAT_ZH[pair[2]]}` : "";
  return STAT_ZH[value] ?? "";
}

/* ---------- Giao diện ---------- */

export function initUnifiedLookup(bundle, mount, options = {}) {
  const corpus = buildLookupCorpus(bundle);
  const labels = lookupGroupLabels();
  const zh = currentLocale() === "zh";
  // Tên Việt trong số liệu "Trong cẩm nang" → chữ Hán nguồn (bản zh). `options.rawNameResolver` (heroes-dict,
  // tactics, books-dict) phủ cả binh thư; thiếu thì tự dựng từ tướng/chiến pháp của bundle.
  const rawName = zh ? (options.rawNameResolver ?? createRawNameResolver(bundle.heroes, bundle.tactics)) : null;
  /** Danh sách tên cho bản đang xem; bản zh bỏ tên không tra được chữ Hán để không trộn ngôn ngữ. */
  const localNames = (items) => zh
    ? items.map((item) => ({ ...item, name: rawName(item.name) })).filter((item) => item.name)
    : items;
  const summaries = options.summary ? createHeroSummaryLoader(options.summary) : null;
  let page = 1;
  let query = "";
  let route = parseLookupQuery(location.search);
  let opener = null;
  let dialogToken = 0;
  // Đóng hồ sơ bằng history.go(): lượt render của popstate kế tiếp phải trả focus về thẻ đã mở.
  let restoreAfterPop = false;

  const heading = el("header", { class: "reference-head lookup-head" }, [
    el("div", { class: "reference-head-text" }, [
      el("span", { class: "reference-kicker" }, L("Tra cứu", "图鉴查询")),
      el("h1", { class: "reference-title" }, L("Tra cứu", "图鉴查询")),
      el("p", { class: "reference-lead" }, L("Tướng, chiến pháp, trang bị, quân sư, cải tạo binh chủng, công trình và binh thư — tìm bằng tên Việt, Hán-Việt hoặc chữ Hán.", "武将、战法、装备、军师、兵种进阶、建筑与兵书——可用中文名、越南语名或汉越音搜索。")),
    ]),
  ]);
  const search = el("input", {
    type: "search",
    class: "lookup-search-input",
    "aria-label": L("Tìm trong Tra cứu", "在图鉴中搜索"),
    placeholder: L("Tìm tướng, chiến pháp, trang bị, quân sư… (gõ không dấu hoặc chữ Hán đều được)", "搜索武将、战法、装备、军师……（支持中文名）"),
  });
  const searchBox = el("label", { class: "search lookup-search" }, [
    icon([
      svgNode("circle", { cx: 11, cy: 11, r: 7 }),
      svgNode("line", { x1: 16.5, y1: 16.5, x2: 21, y2: 21 }),
    ], { size: 20 }),
    search,
  ]);
  const chips = el("div", { class: "lookup-chips", role: "group", "aria-label": L("Nhóm tra cứu", "查询分类") });
  const summary = el("p", { class: "lookup-summary", role: "status", "aria-live": "polite" });
  summary.dataset.lookupTotal = "0";
  const statusRow = el("div", { class: "lookup-status-row" }, [summary]);
  const grid = el("div", { class: "lookup-grid" });
  const feedback = el("div", { class: "lookup-feedback", "aria-live": "polite" });
  const detailMount = el("div", { class: "lookup-detail-mount" });
  const more = el("div", { class: "lookup-more-row" });
  mount.replaceChildren(heading, searchBox, chips, statusRow, feedback, grid, more, detailMount);

  /**
   * Số bước lịch sử hồ sơ đã push trong phiên (hồ sơ → hồ sơ liên quan → …) ghi ở `history.state`;
   * 0 khi hồ sơ mở bằng deep link hoặc không có hồ sơ.
   */
  function dialogDepth() {
    const depth = history.state?.lookupDialogDepth;
    return route?.id && Number.isSafeInteger(depth) && depth > 0 ? depth : 0;
  }

  /** `history.state` hiện có, thay đúng khóa `lookupDialogDepth` (0 = bỏ khóa), giữ khóa của nơi khác. */
  function stateWithDepth(depth) {
    const { lookupDialogDepth, ...rest } = history.state && typeof history.state === "object" ? history.state : {};
    if (depth > 0) return { ...rest, lookupDialogDepth: depth };
    return Object.keys(rest).length ? rest : null;
  }

  /** Hồ sơ là query của trang: giữ mọi khóa khác, chỉ thay đúng `group`/`id`. */
  function setRoute(next, { push = true } = {}) {
    const state = push ? stateWithDepth(next.id ? dialogDepth() + 1 : 0) : history.state;
    route = next;
    const url = new URL(location.href);
    url.searchParams.delete("group");
    url.searchParams.delete("id");
    for (const [key, value] of new URLSearchParams(formatLookupQuery(next))) url.searchParams.set(key, value);
    history[push ? "pushState" : "replaceState"](state, "", url);
    render();
  }

  /**
   * Hồ sơ mở bằng push trong phiên: đóng là lùi đúng số bước đã push, để một lần Back sau đó về trạng thái
   * trước khi mở. Hồ sơ mở bằng deep link: bỏ `id` tại chỗ bằng replaceState.
   */
  function closeDialog() {
    const depth = dialogDepth();
    if (depth > 0) {
      dialogToken += 1;
      detailMount.replaceChildren();
      document.documentElement.classList.remove("lookup-dialog-open");
      restoreAfterPop = true;
      history.go(-depth);
      return;
    }
    const openerId = opener?.dataset.lookupId;
    dialogToken += 1;
    detailMount.replaceChildren();
    document.documentElement.classList.remove("lookup-dialog-open");
    if (route?.id) setRoute({ ...route, id: null }, { push: false });
    else render();
    const restored = [...grid.querySelectorAll("[data-lookup-id]")].find((button) => button.dataset.lookupId === openerId);
    (restored ?? search).focus();
  }

  /** Nút/liên kết mở một mục khác trong hộp thoại (quan hệ, mục con). */
  function routeButton(labelText, next, className) {
    const button = el("button", { type: "button", class: className }, labelText);
    button.addEventListener("click", () => setRoute({ section: "lookup", group: next.group, id: next.id, error: null }));
    return button;
  }

  function factRow(labelVi, textVi) {
    return el("div", { class: "lookup-fact" }, [
      el("dt", { class: "lookup-fact-key" }, labelVi),
      el("dd", { class: "lookup-fact-value" }, textVi),
    ]);
  }

  function statRow(labelVi, value, growthText) {
    const bar = el("span", { class: "lookup-stat-bar", "aria-hidden": "true" }, [
      barFill(barPercent(value, STAT_BAR_MAX), "lookup-stat-fill"),
    ]);
    return el("div", { class: "lookup-stat" }, [
      el("span", { class: "lookup-stat-label" }, labelVi),
      el("span", { class: "lookup-stat-value" }, value === null || value === undefined || value === "" ? MISSING : String(value)),
      bar,
      el("span", { class: "lookup-stat-growth" }, growthText || MISSING),
    ]);
  }

  /** Thẻ chiến pháp của hồ sơ (tên bấm được, phẩm, loại · dạng hiệu ứng, hiệu ứng gốc). */
  function tacticCard(relation) {
    const target = corpus.byId.get(relation.targetId);
    const card = el("article", { class: "lookup-relation-card" }, [
      el("span", { class: "lookup-relation-label" }, relation.labelVi),
    ]);
    if (!relation.resolved || !target) {
      card.append(el("p", { class: "lookup-relation-pending" }, relation.statusVi ?? LOOKUP_EMPTY));
      return card;
    }
    const record = target.record ?? {};
    const relationButton = routeButton(lookupDisplayName(record, target.nameVi), { group: target.group, id: target.id }, "lookup-relation-name");
    relationButton.dataset.lookupRelation = target.id;
    const head = el("div", { class: "lookup-relation-head" }, [relationButton]);
    if (record.quality) head.append(el("span", { class: "lookup-quality" }, String(record.quality).toUpperCase()));
    const sub = [tacticTypeLabel(record.type), shown(record.lookup?.effectTypeVi)].filter(Boolean).join(" · ");
    if (sub) head.append(el("span", { class: "lookup-relation-sub" }, sub));
    card.append(head);
    // Bản zh dùng hiệu ứng chữ Hán nguồn (`effect`), bản Việt dùng bản dịch.
    const effect = zh ? record.effect : record.effectViet;
    if (effect) card.append(el("p", { class: "lookup-relation-effect" }, String(effect)));
    return card;
  }

  /** Ảnh + tên + huy hiệu của hộp thoại (mọi nhóm). */
  function dialogHeader(entryRow, profile) {
    const record = entryRow.record ?? {};
    const view = lookupCardView(entryRow.group, entryRow);
    const chinese = view.chinese;
    const eyebrow = [labels[entryRow.group], shown(record.lookup?.categoryVi ?? record.qualityVi ?? record.slotVi ?? record.elementVi ?? record.appliesToVi)]
      .filter(Boolean).join(" · ");
    const badges = el("div", { class: "lookup-dialog-badges" });
    if (view.variant) badges.append(el("span", { class: "badge badge-band" }, view.variant));
    if (view.faction) badges.append(el("span", { class: `badge faction f-${FACTION_CODE_BY_LABEL[view.faction] ?? "none"}` }, view.faction));
    if (view.stars) badges.append(el("span", { class: "badge badge-fill" }, view.stars));
    if (record.cost) badges.append(el("span", { class: "badge badge-fill" }, L(`Thống ngự ${record.cost}`, `统御 ${record.cost}`)));
    // Tướng: hạng mục (badge 'Quân sự' của artboard); nhóm khác: phẩm của chính mục.
    const grade = shown(entryRow.group === "heroes" ? record.lookup?.categoryVi : record.quality);
    if (grade) badges.append(entryRow.group === "heroes"
      ? el("span", { class: "badge badge-fill" }, String(grade))
      : el("span", { class: "lookup-quality" }, String(grade)));
    const close = el("button", { type: "button", class: "lookup-close", "aria-label": L("Đóng hồ sơ", "关闭详情") }, [
      icon([
        svgNode("line", { x1: 6, y1: 6, x2: 18, y2: 18 }),
        svgNode("line", { x1: 18, y1: 6, x2: 6, y2: 18 }),
      ], { size: 20 }),
    ]);
    close.addEventListener("click", () => closeDialog());
    const header = el("header", { class: "lookup-dialog-head" }, [
      heroPortrait({
        chinese,
        nameVi: profile.titleVi,
        iconUrl: record.iconUrl,
        className: "lookup-dialog-portrait",
      }),
      el("div", { class: "lookup-dialog-ident" }, [
        el("span", { class: "lookup-dialog-eyebrow" }, eyebrow),
        el("div", { class: "lookup-dialog-titles" }, [
          el("h2", { class: "lookup-dialog-title", id: "lookup-dialog-title" }, profile.titleVi),
          // Bản zh: tiêu đề đã là chữ Hán, không lặp lại dòng chữ Hán phụ.
          chinese && !zh ? el("span", { class: "lookup-dialog-zh", lang: "zh-Hant" }, chinese) : null,
        ]),
        badges.childElementCount ? badges : null,
        heroFacts(profile),
      ]),
      close,
    ]);
    return { element: header, close };
  }

  /** Bảng vai trò / danh hiệu / đặc tính theo artboard LookupProfile, cùng các trường hồ sơ tướng khác khi có. */
  function heroFacts(profile) {
    const rows = [
      [L("Vai trò", "定位"), valueText(fieldByKey(profile, "roleTagViet"), "")],
      [L("Danh hiệu độc quyền", "专属称号"), valueText(fieldByKey(profile, "exclusiveTitleVi"), "")],
      [L("Đặc tính", "特性"), valueText(fieldByKey(profile, "flags"), "")],
      // Nhãn do hồ sơ (`lookup-detail.js`) đặt; trường vắng thì `fieldByKey` trả null và dòng bị bỏ.
      ...["civilInnatePoints", "collectibleBonusVi", "redRulesVi"].map((key) => {
        const field = fieldByKey(profile, key);
        return [field?.labelVi, valueText(field, "")];
      }),
    ].filter(([, value]) => value);
    if (!rows.length) return null;
    return el("dl", { class: "lookup-dialog-facts" }, rows.map(([labelVi, textVi]) => factRow(labelVi, textVi)));
  }

  /** Cột trái hồ sơ tướng: sáu chỉ số có thanh + tăng trưởng, thích tính binh chủng. */
  function heroStats(profile) {
    const growth = new Map((profile.sections.find((section) => section.key === "growth")?.fields ?? [])
      .map((item) => [item.key, item.value]));
    const keys = ["luc", "tri", "thong", "toc", "chinh", "mi"];
    const rows = keys.map((key) => {
      const field = fieldByKey(profile, key);
      if (!field) return null;
      const perLevel = growth.get(key);
      const growthText = perLevel === null || perLevel === undefined || perLevel === ""
        ? MISSING
        : `${Number(perLevel) > 0 ? "+" : ""}${perLevel} ${L("/ cấp", "/ 级")}`;
      return statRow(field.labelVi, field.value, growthText);
    }).filter(Boolean);
    const block = el("section", { class: "lookup-profile-section" }, [
      el("h3", { class: "lookup-section-title" }, L("Chỉ số", "属性")),
      el("div", { class: "lookup-stats" }, rows),
    ]);
    const aptitudes = profile.aptitudes.filter((item) => item && item.value);
    if (aptitudes.length) {
      block.append(el("h3", { class: "lookup-section-title" }, L("Thích tính binh chủng", "兵种适性")));
      block.append(el("div", { class: "lookup-aptitudes" }, aptitudes.map((item) => el("div", {
        class: "lookup-aptitude",
        dataset: { grade: String(item.textVi) },
      }, [
        el("span", { class: "lookup-aptitude-grade" }, item.textVi),
        el("span", { class: "lookup-aptitude-label" }, item.labelVi),
      ]))));
    }
    return block;
  }

  /** Khối "Nội chính" (hoặc dòng chỉ có dữ liệu trống như artboard). */
  function civilBlock(profile) {
    const section = profile.sections.find((item) => item.key === "civil");
    if (!section) return null;
    const filled = section.fields.filter((item) => item.value !== null && item.value !== undefined && item.value !== "");
    if (!filled.length) {
      return el("div", { class: "lookup-civil" }, [
        el("span", { class: "lookup-civil-label" }, section.titleVi),
        el("span", { class: "lookup-civil-empty" }, LOOKUP_EMPTY),
      ]);
    }
    return el("section", { class: "lookup-profile-section" }, [
      el("h3", { class: "lookup-section-title" }, section.titleVi),
      el("dl", { class: "lookup-dialog-facts" }, filled.map((item) => factRow(item.labelVi, item.textVi))),
    ]);
  }

  /** Hồ sơ các nhóm còn lại: mọi trường còn lại của profile dưới dạng cặp nhãn/giá trị. */
  function genericFields(profile, skip) {
    const rows = profile.fields.filter((item) => !skip.includes(item.key));
    if (!rows.length) return null;
    return el("dl", { class: "lookup-dialog-facts" }, rows.map((item) => factRow(item.labelVi, item.textVi)));
  }

  function childrenBlock(child) {
    const block = el("section", { class: "lookup-profile-section" }, [
      el("h3", { class: "lookup-section-title" }, child.titleVi),
    ]);
    const list = el("div", { class: "lookup-children" });
    for (const item of child.items) {
      const linked = corpus.byId.get(item.id);
      if (linked) {
        list.append(routeButton(item.titleVi, { group: linked.group, id: linked.id }, "lookup-child-link"));
        continue;
      }
      const details = [
        item.titleVi ?? (item.level ? L(`Cấp ${item.level}`, `${item.level} 级`) : null),
        item.tierVi,
        item.descriptionVi,
        item.convertsToVi,
        item.costs ? costText(item.costs) : null,
        item.durationVi,
        item.effectVi,
      ].filter((value) => value && value !== LOOKUP_EMPTY);
      if (!details.length) continue;
      list.append(el("p", { class: "lookup-child-row" }, details.join(" · ")));
    }
    if (!list.childElementCount) return null;
    block.append(list);
    return block;
  }

  function listBlock(titleVi, rows, className) {
    if (!rows.length) return null;
    return el("section", { class: "lookup-profile-section" }, [
      el("h3", { class: "lookup-section-title" }, titleVi),
      el("div", { class: className }, rows),
    ]);
  }

  /** Khối "Trong cẩm nang": số liệu tính lúc build, chỉ tải khi mở hồ sơ đầu tiên. */
  function renderSummaryBlock(block, identifier, token) {
    if (!summaries) return;
    const status = el("p", { class: "lookup-summary-status", role: "status" }, L("Đang tải số liệu đội hình…", "正在加载阵容数据…"));
    block.append(status);
    summaries().then((table) => {
      if (token !== dialogToken || !block.isConnected) return;
      const view = camNangView(table[identifier]);
      if (!view) {
        status.textContent = L("Chưa có trong đội nào.", "尚未出现在任何阵容中。");
        return;
      }
      status.remove();
      block.append(camNangCards(view));
    }).catch(() => {
      if (token !== dialogToken || !block.isConnected) return;
      status.textContent = L("Chưa tải được số liệu Trong cẩm nang.", "无法加载“攻略收录”数据。");
    });
  }

  function camNangCards(view) {
    const appearance = el("article", { class: "cam-nang-card" }, [
      el("h4", { class: "cam-nang-title" }, L("Xuất hiện trong", "出现于")),
      // Số đếm chỉ là số liệu: link "Tìm tướng này trong Đội chuẩn" (thẻ Đội tiêu biểu) mới dẫn sang danh sách,
      // vì kết quả tìm theo tên không trùng khớp con số đếm theo vị trí tướng.
      el("div", { class: "cam-nang-counts" }, [
        el("div", { class: "cam-nang-count" }, [
          el("span", { class: "cam-nang-number" }, String(view.standard)),
          el("span", { class: "cam-nang-unit" }, L("đội chuẩn", "支推荐阵容")),
        ]),
        el("div", { class: "cam-nang-count" }, [
          el("span", { class: "cam-nang-number" }, String(view.other)),
          el("span", { class: "cam-nang-unit" }, L("đội khác", "支其他阵容")),
        ]),
      ]),
      el("ul", { class: "cam-nang-bars" }, view.positions.map((row) => el("li", { class: "cam-nang-bar" }, [
        el("span", { class: "cam-nang-bar-label" }, row.label),
        el("span", { class: "cam-nang-bar-value" }, String(row.count)),
        el("span", { class: "cam-nang-bar-track", "aria-hidden": "true" }, [
          barFill(row.percent, "cam-nang-bar-fill"),
        ]),
      ]))),
    ]);
    const books = localNames(view.books.items);
    const statFocus = zh ? view.statFocus.items.map((item) => ({ ...item, name: statFocusZh(item.name) })).filter((item) => item.name) : view.statFocus.items;
    const tactics = el("article", { class: "cam-nang-card" }, [
      el("h4", { class: "cam-nang-title" }, L("Chiến pháp hay mang", "常带战法")),
      el("ul", { class: "cam-nang-bars" }, localNames(view.tactics).map((item) => el("li", { class: "cam-nang-bar" }, [
        el("span", { class: "cam-nang-bar-label" }, item.name),
        el("span", { class: "cam-nang-bar-value" }, String(item.teams)),
        el("span", { class: "cam-nang-bar-track", "aria-hidden": "true" }, [
          barFill(item.percent, "cam-nang-bar-fill"),
        ]),
      ]))),
      el("div", { class: "cam-nang-facts" }, [
        books.length ? el("span", { class: "cam-nang-fact" }, [
          el("span", { class: "cam-nang-fact-label" }, zh
            ? `常用兵书（${view.books.teams} 支阵容）`
            : ["Binh thư hay dùng (", String(view.books.teams), " đội)"]),
          el("span", { class: "cam-nang-fact-value" }, books.map((item) => item.name).join(" · ")),
        ]) : null,
        statFocus.length ? el("span", { class: "cam-nang-fact" }, [
          el("span", { class: "cam-nang-fact-label" }, zh
            ? `常用加点（${view.statFocus.teams} 支阵容）`
            : ["Hướng điểm hay dùng (", String(view.statFocus.teams), " đội)"]),
          el("span", { class: "cam-nang-fact-value" }, statFocus.map((item) => item.name).join(" · ")),
        ]) : null,
      ].filter(Boolean)),
    ]);
    const teams = el("article", { class: "cam-nang-card" }, [
      el("h4", { class: "cam-nang-title" }, L("Đội tiêu biểu", "代表阵容")),
      el("ul", { class: "cam-nang-teams" }, view.representative.map((team) => {
        const detail = team.family === "recommended"
          ? teamDetailHref({ sourceConfigId: team.sourceConfigId }, { from: location.href })
          : teamDetailHref({ legacyTeamId: team.legacyTeamId, legacyVariantId: team.legacyVariantId }, { from: location.href });
        const href = detail ? localePath(detail) : detail;
        // Tên đội chỉ có bản Việt: bản zh dùng nhãn chung, mùa/vị trí ở dòng phụ vẫn phân biệt từng đội.
        const name = zh ? "查看阵容" : team.name;
        return el("li", { class: "cam-nang-team" }, [
          href
            ? el("a", { class: "cam-nang-team-name", href }, name)
            : el("span", { class: "cam-nang-team-name" }, name),
          el("span", { class: "cam-nang-team-score" }, team.score === null ? MISSING : String(team.score)),
          el("span", { class: "cam-nang-team-meta" }, [team.seasonLabel, team.positionLabel].filter(Boolean).join(" · ")),
        ]);
      })),
      el("a", { class: "cam-nang-link", href: localePath(`/doi-chuan/?${new URLSearchParams({ season: "all", q: view.searchName })}`) }, [
        L("Tìm tướng này trong Đội chuẩn", "在推荐阵容中查找该武将"),
        icon([svgNode("line", { x1: 5, y1: 12, x2: 19, y2: 12 }), svgNode("polyline", { points: "13 6 19 12 13 18" })], { size: 15, stroke: 2 }),
      ]),
    ]);
    return el("div", { class: "cam-nang-grid" }, [appearance, tactics, teams]);
  }

  function renderDialog(id) {
    const profile = lookupProfile(corpus, id);
    const entryRow = corpus.byId.get(id);
    if (!profile || !entryRow) {
      feedback.textContent = L("Mục tra cứu đang được cập nhật.", "该条目正在更新。");
      feedback.setAttribute("role", "alert");
      return;
    }
    dialogToken += 1;
    const token = dialogToken;
    const backdrop = el("div", { class: "lookup-backdrop" });
    const dialog = el("article", { class: "lookup-dialog", role: "dialog", "aria-modal": "true", tabindex: "-1" });
    const { element: header, close } = dialogHeader(entryRow, profile);
    dialog.setAttribute("aria-labelledby", "lookup-dialog-title");
    const body = el("div", { class: "lookup-profile" });
    const relations = profile.relations.filter((relation) => relation.key === "selfTactic" || relation.key === "inheritTactic");
    const others = profile.relations.filter((relation) => !relations.includes(relation));

    if (entryRow.group === "heroes") {
      const right = el("div", { class: "lookup-profile-column" });
      if (relations.length) for (const relation of relations) right.append(tacticCard(relation));
      for (const relation of others) {
        right.append(relation.resolved
          ? routeButton(`${relation.labelVi}: ${relation.titleVi}`, { group: relation.targetGroup, id: relation.targetId }, "lookup-child-link")
          : el("p", { class: "lookup-relation-pending" }, `${relation.labelVi}: ${relation.statusVi}`));
      }
      const civil = civilBlock(profile);
      if (civil) right.append(civil);
      body.append(el("div", { class: "lookup-profile-column" }, [heroStats(profile)]), right);
    } else {
      // Chỉ bỏ trường đã hiện ở chỗ khác trong hộp thoại: "Phẩm chất" nằm ở badge đầu hồ sơ.
      const skip = entryRow.group === "tactics" ? ["quality"] : [];
      const fields = genericFields(profile, skip);
      const left = el("div", { class: "lookup-profile-column" }, fields ? [fields] : []);
      const right = el("div", { class: "lookup-profile-column" });
      for (const relation of profile.relations) {
        right.append(relation.resolved
          ? routeButton(`${relation.labelVi}: ${relation.titleVi}`, { group: relation.targetGroup, id: relation.targetId }, "lookup-child-link")
          : el("p", { class: "lookup-relation-pending" }, `${relation.labelVi}: ${relation.statusVi}`));
      }
      for (const child of profile.children) {
        const block = childrenBlock(child);
        if (block) right.append(block);
      }
      body.append(left, right);
    }

    const conditions = listBlock(L("Điều kiện", "条件"), profile.conditions.map((text) => el("p", { class: "lookup-child-row" }, text)), "lookup-children");
    const revisions = listBlock(L("Lịch sử cập nhật", "更新记录"), profile.revisions.map((revision) => el("p", { class: "lookup-child-row" }, revisionText(revision))), "lookup-children");
    if (conditions) body.append(conditions);
    if (revisions) body.append(revisions);
    // Bản zh đã bỏ nội dung chỉ có chữ Việt: báo một dòng để người đọc biết hồ sơ chưa đầy đủ.
    if (profile.viOnly) body.append(el("p", { class: "lookup-child-row lookup-zh-note" }, "部分说明暂无中文原文，未在此显示。"));

    dialog.append(header, body);
    if (entryRow.group === "heroes" && summaries) {
      const block = el("section", { class: "cam-nang", "aria-labelledby": "cam-nang-title" }, [
        el("div", { class: "cam-nang-head" }, [
          el("h3", { class: "cam-nang-heading", id: "cam-nang-title" }, L("Trong cẩm nang", "攻略收录")),
          el("span", { class: "cam-nang-note" }, L("Tính từ đội chuẩn và đội khác đang có · mọi mùa", "统计自现有推荐阵容与其他阵容 · 全部赛季")),
        ]),
      ]);
      dialog.append(block);
      renderSummaryBlock(block, id, token);
    }
    backdrop.append(dialog);
    backdrop.addEventListener("click", (event) => { if (event.target === backdrop) closeDialog(); });
    backdrop.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { event.preventDefault(); closeDialog(); return; }
      if (event.key !== "Tab") return;
      const focusable = [...dialog.querySelectorAll("button,[href],input,select,textarea,[tabindex]:not([tabindex='-1'])")];
      if (!focusable.length) { event.preventDefault(); dialog.focus(); return; }
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    detailMount.replaceChildren(backdrop);
    document.documentElement.classList.add("lookup-dialog-open");
    queueMicrotask(() => close.focus());
  }

  function cardView(group, item) {
    const view = lookupCardView(group, item);
    const button = el("button", { type: "button", class: "lookup-card-button", dataset: { lookupId: item.id } });
    const title = lookupDisplayName(item.record, item.nameVi);
    const portraitWrap = el("span", { class: "lookup-card-portrait" }, [
      heroPortrait({
        chinese: view.chinese,
        nameVi: title,
        iconUrl: item.record?.iconUrl,
        className: "lookup-portrait",
      }),
      view.variant ? el("span", { class: `pre ${String(item.record?.lookup?.variant ?? "").toLowerCase()} lookup-card-variant` }, view.variant) : null,
    ]);
    const meta = el("span", { class: "lookup-card-meta" }, view.meta.filter((part) => part.kind !== "role").map((part) => part.kind === "faction"
      ? el("span", { class: `reference-faction f-${part.code}` }, part.text)
      : el("span", { class: "lookup-card-meta-text" }, part.text)));
    // Vai trò luôn nằm dòng riêng dưới "Phe · Thống ngự N" như artboard Lookup.
    const role = view.meta.find((part) => part.kind === "role");
    button.append(portraitWrap);
    button.append(el("span", { class: "lookup-card-body" }, [
      el("span", { class: "lookup-card-name" }, title),
      meta.childElementCount ? meta : null,
      role ? el("span", { class: "lookup-card-role" }, role.text) : null,
    ]));
    button.addEventListener("click", () => {
      opener = button;
      setRoute({ section: "lookup", group, id: item.id, error: null });
    });
    return el("article", { class: "lookup-card" }, [button]);
  }

  function tableRow(item) {
    const profile = lookupProfile(corpus, item.id);
    const row = tacticTableRow(profile);
    const nameButton = el("button", { type: "button", class: "lookup-table-name", dataset: { lookupId: item.id } }, row.nameVi);
    nameButton.addEventListener("click", () => {
      opener = nameButton;
      setRoute({ section: "lookup", group: "tactics", id: item.id, error: null });
    });
    const chineseName = zh ? "" : recordChinese(item.record ?? {});
    const head = el("th", { scope: "row", class: "lookup-table-cell-name", dataset: { label: TABLE_HEADS.name } }, [
      nameButton,
      chineseName ? el("span", { class: "lookup-table-zh", lang: "zh-Hant" }, chineseName) : null,
      row.effect ? el("p", { class: "lookup-table-effect" }, row.effect) : null,
    ]);
    const cells = [
      el("td", { class: "lookup-table-quality", dataset: { label: TABLE_HEADS.quality } }, [el("span", { class: "lookup-quality" }, row.quality)]),
      el("td", { dataset: { label: TABLE_HEADS.type } }, row.type),
      el("td", { dataset: { label: TABLE_HEADS.effectType } }, row.effectType),
      el("td", { dataset: { label: TABLE_HEADS.target } }, row.target),
      el("td", { class: "lookup-table-rate", dataset: { label: TABLE_HEADS.rate } }, row.rate),
    ];
    return el("tr", {}, [head, ...cells]);
  }

  function renderResults({ group, items, total }) {
    grid.replaceChildren();
    more.replaceChildren();
    const useTable = group === "tactics";
    grid.classList.toggle("lookup-grid-cards", !useTable);
    grid.classList.toggle("lookup-grid-table", useTable);
    if (!total) {
      feedback.setAttribute("role", "status");
      feedback.textContent = L("Không có kết quả phù hợp.", "没有符合条件的结果。");
      return;
    }
    if (useTable) {
      grid.append(el("div", { class: "lookup-table-panel" }, [
        el("table", { class: "lookup-table" }, [
          el("thead", {}, [el("tr", {}, [
            el("th", { scope: "col" }, TABLE_HEADS.name),
            el("th", { scope: "col" }, TABLE_HEADS.quality),
            el("th", { scope: "col" }, TABLE_HEADS.type),
            el("th", { scope: "col" }, TABLE_HEADS.effectType),
            el("th", { scope: "col" }, TABLE_HEADS.target),
            el("th", { scope: "col", class: "lookup-table-rate" }, TABLE_HEADS.rate),
          ])]),
          el("tbody", {}, items.map(tableRow)),
        ]),
      ]));
    } else {
      grid.append(...items.map((item) => cardView(group, item)));
    }
    renderMore(items.length, total);
  }

  /** Hàng "Xem thêm" khi còn kết quả chưa hiện. */
  function renderMore(shown, total) {
    more.replaceChildren();
    if (shown >= total) return;
    const button = el("button", { type: "button", class: "lookup-more" }, L("Xem thêm", "查看更多"));
    button.addEventListener("click", appendNextPage);
    more.append(button, el("span", { class: "lookup-more-note" }, L("Mỗi lượt hiện 60 kết quả", "每次显示 60 条结果")));
  }

  /**
   * "Xem thêm" chỉ nối lượt mới vào cuối lưới (không dựng lại lượt đã hiện) rồi đưa focus tới mục đầu của
   * lượt mới, để người dùng bàn phím đọc tiếp đúng chỗ thay vì rơi về `body`.
   */
  function appendNextPage() {
    const group = route?.group ?? null;
    page += 1;
    const { items, total } = searchLookupGroup(corpus, { group, query, page });
    const nodes = group === "tactics" ? items.map(tableRow) : items.map((item) => cardView(group, item));
    (grid.querySelector(".lookup-table tbody") ?? grid).append(...nodes);
    renderMore(grid.querySelectorAll("[data-lookup-id]").length, total);
    nodes[0]?.querySelector("[data-lookup-id]")?.focus();
  }

  /** Trả focus về thẻ/nút đã mở hồ sơ (hoặc ô tìm) sau khi hộp thoại biến mất vì Back/Forward. */
  function restoreOpenerFocus() {
    const openerId = opener?.dataset.lookupId;
    const restored = [...grid.querySelectorAll("[data-lookup-id]")].find((button) => button.dataset.lookupId === openerId);
    (restored ?? search).focus();
  }

  function render() {
    const hadDialog = detailMount.querySelector(".lookup-dialog") !== null || restoreAfterPop;
    restoreAfterPop = false;
    route = parseLookupQuery(location.search);
    feedback.removeAttribute("role");
    feedback.textContent = "";
    dialogToken += 1;
    detailMount.replaceChildren();
    document.documentElement.classList.remove("lookup-dialog-open");
    chips.replaceChildren();
    for (const group of LOOKUP_GROUPS) {
      const button = el("button", {
        type: "button",
        class: "fchip lookup-chip",
        dataset: { group },
        "aria-pressed": String(route?.group === group),
      }, [
        labels[group],
        el("span", { class: "lookup-chip-count" }, String(corpus.groups[group].length)),
      ]);
      // Bấm lại chip đang nhấn bỏ lọc nhóm: lưới về tất cả.
      button.addEventListener("click", () => { page = 1; setRoute({ section: "lookup", group: route?.group === group ? null : group, id: null, error: null }); });
      chips.append(button);
    }
    if (route?.error) {
      grid.replaceChildren();
      more.replaceChildren();
      summary.dataset.lookupTotal = "0";
      summary.textContent = "";
      feedback.setAttribute("role", "alert");
      feedback.textContent = route.messageVi;
      return;
    }
    const group = route?.group ?? null;
    const result = searchLookupGroup(corpus, { group, query, page: 1 });
    const items = [...result.items];
    for (let current = 2; current <= page && items.length < result.total; current += 1) {
      items.push(...searchLookupGroup(corpus, { group, query, page: current }).items);
    }
    summary.dataset.lookupTotal = String(result.total);
    const unit = group ? L(LOOKUP_GROUP_UNITS[group], LOOKUP_GROUP_UNITS_ZH[group]) : L("kết quả", "条结果");
    const hint = group === "tactics" ? L(" · bấm tên để mở hồ sơ", " · 点击名称查看详情") : L(" · bấm để mở hồ sơ", " · 点击查看详情");
    summary.replaceChildren(el("strong", {}, String(result.total)), ` ${unit}${hint}`);
    renderResults({ group, items, total: result.total });
    if (route?.id) renderDialog(route.id);
    else if (hadDialog) restoreOpenerFocus();
  }

  search.addEventListener("input", () => { query = search.value; page = 1; render(); });
  // Back/Forward giữ số lượt "Xem thêm" đã mở khi nhóm lọc không đổi (đóng/mở hồ sơ), chỉ về lượt đầu khi đổi nhóm.
  window.addEventListener("popstate", () => {
    if ((parseLookupQuery(location.search).group ?? null) !== (route?.group ?? null)) page = 1;
    render();
  });
  render();
  return { corpus, render };
}

const COST_LABELS = { wood: L("Gỗ", "木材"), iron: L("Sắt", "铁矿"), stone: L("Đá", "石料") };

/**
 * Chi phí của một cấp công trình (`lookup-data.js` bắt buộc đúng ba khóa `wood`/`iron`/`stone`): bỏ ô không có
 * giá trị (`null`/`undefined`/rỗng) nên UI không bao giờ in `null`. Không còn ô nào thì trả `null` để bỏ hẳn phần
 * chi phí khỏi dòng.
 */
export function costText(costs) {
  if (!costs || typeof costs !== "object") return null;
  const parts = Object.entries(costs)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => `${COST_LABELS[key]}: ${value}`);
  return parts.length ? parts.join(", ") : null;
}

function barFill(percent, className) {
  const fill = el("span", { class: className });
  fill.style.width = `${percent}%`;
  return fill;
}

function revisionText(revision) {
  const parts = Object.entries(revision ?? {})
    .filter(([key, value]) => value && (key.endsWith("Vi") || ["date", "effectiveDate", "version"].includes(key)))
    .map(([, value]) => String(value));
  return parts.join(" · ") || L("Đã ghi nhận cập nhật", "已记录更新");
}
