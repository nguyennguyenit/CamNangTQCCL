// Cửa tra cứu sáu nhóm: lưới tướng 6 cột, bảng chiến pháp, hộp thoại hồ sơ theo artboard
// Lookup/LookupTactics/LookupProfile/LookupMobile.
//
// Quy tắc render (plan.md quyết định #14): dữ liệu động chỉ qua `el()`/`textContent`, không `innerHTML`.
// Chân dung đi qua helper dùng chung `js/hero-portrait.js` (nâng https, no-referrer, fallback chữ Hán).
// Khối "Trong cẩm nang" đọc số liệu tính lúc build (`js/hero-summaries.js`) — chỉ tải manifest + đúng file
// số liệu khi mở hồ sơ đầu tiên, không kéo `index.json`/`other-teams.json` về trang Tra cứu.

import { el, icon, svgNode } from "./render.js";
import { lookupProfile, tacticTypeLabel } from "./lookup-detail.js";
import { heroPortrait } from "./hero-portrait.js";
import { createHeroSummaryLoader } from "./hero-summaries.js";
import { teamDetailHref } from "./team-detail-navigation.js";

export const LOOKUP_GROUPS = Object.freeze(["heroes", "tactics", "equipment", "advisors", "troop-mods", "buildings"]);
/** Nhãn nhóm dùng chung cho chip ở trang Tra cứu và menu điều hướng (SiteLayout). */
export const LOOKUP_GROUP_LABELS = Object.freeze({
  heroes: "Tướng", tactics: "Chiến pháp", equipment: "Trang bị",
  advisors: "Quân sư", "troop-mods": "Cải tạo binh chủng", buildings: "Công trình",
});
/** Đơn vị đếm của từng nhóm cho dòng trạng thái ("n tướng · bấm để mở hồ sơ"). */
export const LOOKUP_GROUP_UNITS = Object.freeze({
  heroes: "tướng", tactics: "chiến pháp", equipment: "trang bị",
  advisors: "quân sư", "troop-mods": "cải tạo binh chủng", buildings: "công trình",
});
/** Thứ tự vai trò trong khối "Trong cẩm nang" (khớp `index.json` heroes[].roleRaw). */
export const POSITION_LABELS = Object.freeze(["Chủ tướng", "Phó tướng 1", "Phó tướng 2"]);

const GROUP_BY_KIND = Object.freeze({
  hero: "heroes", tactic: "tactics", equipment: "equipment", "equipment-special": "equipment",
  advisor: "advisors", "troop-mod": "troop-mods", building: "buildings",
});
const ROUTE_ERRORS = Object.freeze({
  "duplicate-param": "Mỗi tham số tra cứu chỉ được xuất hiện một lần.",
  "unknown-group": "Nhóm tra cứu không hợp lệ.",
  "id-kind-mismatch": "Mục tra cứu không thuộc nhóm đã chọn.",
  "unknown-id-kind": "Mã mục tra cứu không hợp lệ.",
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
 */
export function parseLookupQuery(search) {
  const params = new URLSearchParams(search ?? "");
  for (const key of ["group", "id"]) if (params.getAll(key).length > 1) return errorRoute("duplicate-param");
  let group = params.has("group") ? params.get("group") : null;
  const id = params.has("id") ? params.get("id") : null;
  if (group !== null && !LOOKUP_GROUPS.includes(group)) return errorRoute("unknown-group");
  const inferred = id !== null ? groupForId(id) : null;
  if (id !== null && inferred === null) return errorRoute("unknown-id-kind");
  if (group !== null && id !== null && group !== inferred) return errorRoute("id-kind-mismatch");
  if (group === null && inferred) group = inferred;
  return { section: "lookup", group, id, error: null, messageVi: null };
}

export function formatLookupQuery(route) {
  const params = new URLSearchParams();
  if (route?.group) params.set("group", route.group);
  if (route?.id) params.set("id", route.id);
  return params.toString();
}

function normalized(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi").trim();
}

function entry(group, record) {
  const nameVi = String(record.viet ?? record.nameVi ?? record.hanViet ?? "").trim();
  const aliases = [
    ...(Array.isArray(record.aliases) ? record.aliases : []),
    ...(Array.isArray(record.aliasesVi) ? record.aliasesVi : []),
    ...(Array.isArray(record.aliasesZh) ? record.aliasesZh : []),
    record.chinese,
  ].filter((value) => typeof value === "string" && value.length > 0);
  return { id: record.id, group, nameVi, aliases, record };
}

export function buildLookupCorpus({ heroes, tactics, catalog }) {
  const groups = {
    heroes: heroes.map((record) => entry("heroes", record)),
    tactics: tactics.map((record) => entry("tactics", record)),
    equipment: [...catalog.equipment, ...catalog.specials].map((record) => entry("equipment", record)),
    advisors: catalog.advisors.map((record) => entry("advisors", record)),
    "troop-mods": catalog.troopMods.map((record) => entry("troop-mods", record)),
    buildings: catalog.buildings.map((record) => entry("buildings", record)),
  };
  const byId = new Map();
  for (const rows of Object.values(groups)) for (const row of rows) byId.set(row.id, row);
  return { groups, byId, heroes, tactics, catalog };
}

export function searchLookupGroup(corpus, { group = null, query = "", page = 1, pageSize = PAGE_SIZE } = {}) {
  const source = group ? (corpus.groups[group] ?? []) : LOOKUP_GROUPS.flatMap((key) => corpus.groups[key]);
  const needle = normalized(query);
  const matches = needle
    ? source.filter((item) => [item.nameVi, ...item.aliases].some((value) => normalized(value).includes(needle)))
    : source;
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
        record.faction ? { kind: "faction", text: String(record.faction), code: FACTION_CODE[record.faction] ?? "none" } : null,
        record.roleTagViet ? { kind: "text", text: String(record.roleTagViet) } : null,
      ]
    : [
        (record.qualityVi ?? record.quality) ? { kind: "text", text: String(record.qualityVi ?? record.quality) } : null,
        kind === "tactics" && tacticTypeLabel(record.type) ? { kind: "text", text: tacticTypeLabel(record.type) } : null,
        kind === "equipment" && record.slotVi ? { kind: "text", text: String(record.slotVi) } : null,
        kind === "advisors" && record.elementVi ? { kind: "text", text: String(record.elementVi) } : null,
        kind === "troop-mods" && record.appliesToVi ? { kind: "text", text: String(record.appliesToVi) } : null,
        kind === "buildings" && Number.isFinite(Number(record.maxLevel)) ? { kind: "text", text: "Cấp tối đa " + String(record.maxLevel) } : null,
      ];
  const meta = parts.filter(Boolean);
  return {
    variant,
    chinese: recordChinese(record),
    faction: hero && record.faction ? String(record.faction) : null,
    stars: hero && Number.isFinite(Number(record.stars)) ? `${record.stars} sao` : null,
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

/** % thanh chỉ số/thanh đếm: giá trị 0-100 (chỉ số tướng) khoá trong [0, 100]. */
function barPercent(value, max) {
  const ratio = max > 0 ? (Number(value) || 0) / max : 0;
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

/**
 * Khối "Trong cẩm nang" từ payload đã kiểm: số đội theo họ và theo vị trí (gộp hai họ, khớp tổng
 * hiển thị), top chiến pháp/binh thư/hướng điểm kèm số đội, 3 đội tiêu biểu giữ nguyên thứ tự build.
 */
export function camNangView(summary) {
  if (!summary) return null;
  const positions = POSITION_LABELS.map((label, index) => {
    const count = summary.standard.positions[index] + summary.other.positions[index];
    return { label, count };
  });
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

/* ---------- Giao diện ---------- */

export function initUnifiedLookup(bundle, mount, options = {}) {
  const corpus = buildLookupCorpus(bundle);
  const labels = LOOKUP_GROUP_LABELS;
  const summaries = options.summary ? createHeroSummaryLoader(options.summary) : null;
  let page = 1;
  let query = "";
  let route = parseLookupQuery(location.search);
  let opener = null;
  let dialogToken = 0;

  const heading = el("header", { class: "reference-head lookup-head" }, [
    el("div", { class: "reference-head-text" }, [
      el("span", { class: "reference-kicker" }, "Tra cứu"),
      el("h1", { class: "reference-title" }, "Tra cứu"),
      el("p", { class: "reference-lead" }, "Tướng, chiến pháp, trang bị, quân sư, cải tạo binh chủng và công trình — tìm bằng tên Việt, Hán-Việt hoặc chữ Hán."),
    ]),
  ]);
  const search = el("input", {
    type: "search",
    class: "lookup-search-input",
    "aria-label": "Tìm trong Tra cứu",
    placeholder: "Tìm tướng, chiến pháp, trang bị, quân sư… (gõ không dấu hoặc chữ Hán đều được)",
  });
  const searchBox = el("label", { class: "search lookup-search" }, [
    icon([
      svgNode("circle", { cx: 11, cy: 11, r: 7 }),
      svgNode("line", { x1: 16.5, y1: 16.5, x2: 21, y2: 21 }),
    ], { size: 20 }),
    search,
  ]);
  const chips = el("div", { class: "lookup-chips", role: "group", "aria-label": "Nhóm tra cứu" });
  const summary = el("p", { class: "lookup-summary", role: "status", "aria-live": "polite" });
  summary.dataset.lookupTotal = "0";
  const statusRow = el("div", { class: "lookup-status-row" }, [summary, el("span", { class: "lookup-order" }, "Thứ tự theo nguồn")]);
  const grid = el("div", { class: "lookup-grid" });
  const feedback = el("div", { class: "lookup-feedback", "aria-live": "polite" });
  const detailMount = el("div", { class: "lookup-detail-mount" });
  const more = el("div", { class: "lookup-more-row" });
  mount.replaceChildren(heading, searchBox, chips, statusRow, feedback, grid, more, detailMount);

  /** Hồ sơ là query của trang: giữ mọi khóa khác, chỉ thay đúng `group`/`id`. */
  function setRoute(next, { push = true } = {}) {
    route = next;
    const url = new URL(location.href);
    url.searchParams.delete("group");
    url.searchParams.delete("id");
    for (const [key, value] of new URLSearchParams(formatLookupQuery(next))) url.searchParams.set(key, value);
    history[push ? "pushState" : "replaceState"](history.state, "", url);
    render();
  }

  function closeDialog({ restore = true } = {}) {
    const openerId = opener?.dataset.lookupId;
    dialogToken += 1;
    detailMount.replaceChildren();
    document.documentElement.classList.remove("lookup-dialog-open");
    if (route?.id) setRoute({ ...route, id: null }, { push: false });
    else render();
    if (restore) {
      const restored = [...grid.querySelectorAll("[data-lookup-id]")].find((button) => button.dataset.lookupId === openerId);
      (restored ?? search).focus();
    }
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
      barFill(barPercent(value, 100), "lookup-stat-fill"),
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
      card.append(el("p", { class: "lookup-relation-pending" }, relation.statusVi ?? "Đang cập nhật"));
      return card;
    }
    const record = target.record ?? {};
    const relationButton = routeButton(target.nameVi, { group: target.group, id: target.id }, "lookup-relation-name");
    relationButton.dataset.lookupRelation = target.id;
    const head = el("div", { class: "lookup-relation-head" }, [relationButton]);
    if (record.quality) head.append(el("span", { class: "lookup-quality" }, String(record.quality).toUpperCase()));
    const sub = [tacticTypeLabel(record.type), record.lookup?.effectTypeVi].filter(Boolean).join(" · ");
    if (sub) head.append(el("span", { class: "lookup-relation-sub" }, sub));
    card.append(head);
    if (record.effectViet) card.append(el("p", { class: "lookup-relation-effect" }, String(record.effectViet)));
    return card;
  }

  /** Ảnh + tên + huy hiệu của hộp thoại (mọi nhóm). */
  function dialogHeader(entryRow, profile) {
    const record = entryRow.record ?? {};
    const chinese = recordChinese(record);
    const view = lookupCardView(entryRow.group, entryRow);
    const eyebrow = [labels[entryRow.group], record.lookup?.categoryVi ?? record.qualityVi ?? record.slotVi ?? record.elementVi ?? record.appliesToVi]
      .filter(Boolean).join(" · ");
    const badges = el("div", { class: "lookup-dialog-badges" });
    if (view.variant) badges.append(el("span", { class: `pre ${String(record.lookup?.variant ?? "").toLowerCase()}` }, view.variant));
    if (view.faction) badges.append(el("span", { class: `badge faction f-${FACTION_CODE[view.faction] ?? "none"}` }, view.faction));
    if (view.stars) badges.append(el("span", { class: "badge" }, view.stars));
    if (record.cost) badges.append(el("span", { class: "badge" }, ["Thống ngự ", String(record.cost)]));
    if (entryRow.group !== "heroes" && record.quality) badges.append(el("span", { class: "badge" }, String(record.quality)));
    const close = el("button", { type: "button", class: "lookup-close", "aria-label": "Đóng hồ sơ" }, [
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
          chinese ? el("span", { class: "lookup-dialog-zh", lang: "zh-Hant" }, chinese) : null,
        ]),
        badges.childElementCount ? badges : null,
        heroFacts(profile),
      ]),
      close,
    ]);
    return { element: header, close };
  }

  /** Bảng vai trò / danh hiệu / đặc tính theo artboard LookupProfile. */
  function heroFacts(profile) {
    const rows = [
      ["Vai trò", valueText(fieldByKey(profile, "roleTagViet"), "")],
      ["Danh hiệu độc quyền", valueText(fieldByKey(profile, "exclusiveTitleVi"), "")],
      ["Đặc tính", valueText(fieldByKey(profile, "flags"), "")],
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
        : `${Number(perLevel) > 0 ? "+" : ""}${perLevel} / cấp`;
      return statRow(field.labelVi, field.value, growthText);
    }).filter(Boolean);
    const block = el("section", { class: "lookup-profile-section" }, [
      el("h3", { class: "lookup-section-title" }, "Chỉ số"),
      el("div", { class: "lookup-stats" }, rows),
    ]);
    const aptitudes = profile.aptitudes.filter((item) => item && item.value);
    if (aptitudes.length) {
      block.append(el("h3", { class: "lookup-section-title" }, "Thích tính binh chủng"));
      block.append(el("div", { class: "lookup-aptitudes" }, aptitudes.map((item) => el("div", { class: "lookup-aptitude" }, [
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
        el("span", { class: "lookup-civil-empty" }, "Đang cập nhật"),
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
        item.titleVi ?? (item.level ? `Cấp ${item.level}` : null),
        item.tierVi,
        item.descriptionVi,
        item.convertsToVi,
        item.costs ? Object.entries(item.costs).map(([key, value]) => `${COST_LABELS[key] ?? key}: ${value}`).join(", ") : null,
        item.durationVi,
        item.effectVi,
      ].filter((value) => value && value !== "Đang cập nhật");
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
    const status = el("p", { class: "lookup-summary-status", role: "status" }, "Đang tải số liệu đội hình…");
    block.append(status);
    summaries().then((table) => {
      if (token !== dialogToken || !block.isConnected) return;
      const view = camNangView(table[identifier]);
      if (!view) {
        status.textContent = "Chưa có trong đội nào.";
        return;
      }
      status.remove();
      block.append(camNangCards(view));
    }).catch(() => {
      if (token !== dialogToken || !block.isConnected) return;
      status.textContent = "Chưa tải được số liệu Trong cẩm nang.";
    });
  }

  function camNangCards(view) {
    const appearance = el("article", { class: "cam-nang-card" }, [
      el("h4", { class: "cam-nang-title" }, "Xuất hiện trong"),
      el("div", { class: "cam-nang-counts" }, [
        el("a", {
          class: "cam-nang-count",
          href: `/doi-chuan/?${new URLSearchParams({ season: "all", q: view.searchName })}`,
          title: "Tìm tướng này trong Đội chuẩn",
        }, [
          el("span", { class: "cam-nang-number" }, String(view.standard)),
          el("span", { class: "cam-nang-unit" }, "đội chuẩn"),
        ]),
        el("div", { class: "cam-nang-count" }, [
          el("span", { class: "cam-nang-number" }, String(view.other)),
          el("span", { class: "cam-nang-unit" }, "đội khác"),
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
    const tactics = el("article", { class: "cam-nang-card" }, [
      el("h4", { class: "cam-nang-title" }, "Chiến pháp hay mang"),
      el("ul", { class: "cam-nang-bars" }, view.tactics.map((item) => el("li", { class: "cam-nang-bar" }, [
        el("span", { class: "cam-nang-bar-label" }, item.name),
        el("span", { class: "cam-nang-bar-value" }, String(item.teams)),
        el("span", { class: "cam-nang-bar-track", "aria-hidden": "true" }, [
          barFill(item.percent, "cam-nang-bar-fill"),
        ]),
      ]))),
      el("div", { class: "cam-nang-facts" }, [
        view.books.items.length ? el("span", { class: "cam-nang-fact" }, [
          el("span", { class: "cam-nang-fact-label" }, ["Binh thư hay dùng (", String(view.books.teams), " đội)"]),
          el("span", { class: "cam-nang-fact-value" }, view.books.items.map((item) => item.name).join(" · ")),
        ]) : null,
        view.statFocus.items.length ? el("span", { class: "cam-nang-fact" }, [
          el("span", { class: "cam-nang-fact-label" }, ["Hướng điểm hay dùng (", String(view.statFocus.teams), " đội)"]),
          el("span", { class: "cam-nang-fact-value" }, view.statFocus.items.map((item) => item.name).join(" · ")),
        ]) : null,
      ].filter(Boolean)),
    ]);
    const teams = el("article", { class: "cam-nang-card" }, [
      el("h4", { class: "cam-nang-title" }, "Đội tiêu biểu"),
      el("ul", { class: "cam-nang-teams" }, view.representative.map((team) => {
        const href = team.family === "recommended"
          ? teamDetailHref({ sourceConfigId: team.sourceConfigId }, { from: location.href })
          : teamDetailHref({ legacyTeamId: team.legacyTeamId, legacyVariantId: team.legacyVariantId }, { from: location.href });
        return el("li", { class: "cam-nang-team" }, [
          href
            ? el("a", { class: "cam-nang-team-name", href }, team.name)
            : el("span", { class: "cam-nang-team-name" }, team.name),
          el("span", { class: "cam-nang-team-score" }, team.score === null ? MISSING : String(team.score)),
          el("span", { class: "cam-nang-team-meta" }, [team.seasonLabel, team.positionLabel].filter(Boolean).join(" · ")),
        ]);
      })),
      el("a", { class: "cam-nang-link", href: `/doi-chuan/?${new URLSearchParams({ season: "all", q: view.searchName })}` }, [
        "Tìm tướng này trong Đội chuẩn",
        icon([svgNode("line", { x1: 5, y1: 12, x2: 19, y2: 12 }), svgNode("polyline", { points: "13 6 19 12 13 18" })], { size: 15, stroke: 2 }),
      ]),
    ]);
    return el("div", { class: "cam-nang-grid" }, [appearance, tactics, teams]);
  }

  function renderDialog(id) {
    const profile = lookupProfile(corpus, id);
    const entryRow = corpus.byId.get(id);
    if (!profile || !entryRow) {
      feedback.textContent = "Mục tra cứu đang được cập nhật.";
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

    const conditions = listBlock("Điều kiện", profile.conditions.map((text) => el("p", { class: "lookup-child-row" }, text)), "lookup-children");
    const revisions = listBlock("Lịch sử cập nhật", profile.revisions.map((revision) => el("p", { class: "lookup-child-row" }, revisionText(revision))), "lookup-children");
    if (conditions) body.append(conditions);
    if (revisions) body.append(revisions);

    dialog.append(header, body);
    if (entryRow.group === "heroes" && summaries) {
      const block = el("section", { class: "cam-nang", "aria-labelledby": "cam-nang-title" }, [
        el("div", { class: "cam-nang-head" }, [
          el("h3", { class: "cam-nang-heading", id: "cam-nang-title" }, "Trong cẩm nang"),
          el("span", { class: "cam-nang-note" }, "Tính từ đội chuẩn và đội khác đang có · mọi mùa nguồn"),
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
    const portraitWrap = el("span", { class: "lookup-card-portrait" }, [
      heroPortrait({
        chinese: view.chinese,
        nameVi: item.nameVi,
        iconUrl: item.record?.iconUrl,
        className: "lookup-portrait",
      }),
      view.variant ? el("span", { class: `pre ${String(item.record?.lookup?.variant ?? "").toLowerCase()} lookup-card-variant` }, view.variant) : null,
    ]);
    const meta = el("span", { class: "lookup-card-meta" }, view.meta.map((part) => part.kind === "faction"
      ? el("span", { class: `reference-faction f-${part.code}` }, part.text)
      : el("span", { class: "lookup-card-meta-text" }, part.text)));
    button.append(portraitWrap);
    button.append(el("span", { class: "lookup-card-body" }, [
      el("span", { class: "lookup-card-name" }, item.nameVi),
      meta.childElementCount ? meta : null,
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
    const zh = recordChinese(item.record ?? {});
    const head = el("th", { scope: "row", class: "lookup-table-cell-name", dataset: { label: "Chiến pháp" } }, [
      nameButton,
      zh ? el("span", { class: "lookup-table-zh", lang: "zh-Hant" }, zh) : null,
      row.effect ? el("p", { class: "lookup-table-effect" }, row.effect) : null,
    ]);
    const cells = [
      el("td", { class: "lookup-table-quality", dataset: { label: "Phẩm" } }, [el("span", { class: "lookup-quality" }, row.quality)]),
      el("td", { dataset: { label: "Loại" } }, row.type),
      el("td", { dataset: { label: "Hiệu quả" } }, row.effectType),
      el("td", { dataset: { label: "Mục tiêu" } }, row.target),
      el("td", { class: "lookup-table-rate", dataset: { label: "Tỷ lệ" } }, row.rate),
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
      feedback.textContent = "Không có kết quả phù hợp.";
      return;
    }
    if (useTable) {
      grid.append(el("div", { class: "lookup-table-panel" }, [
        el("table", { class: "lookup-table" }, [
          el("thead", {}, [el("tr", {}, [
            el("th", { scope: "col" }, "Chiến pháp"),
            el("th", { scope: "col" }, "Phẩm"),
            el("th", { scope: "col" }, "Loại"),
            el("th", { scope: "col" }, "Hiệu quả"),
            el("th", { scope: "col" }, "Mục tiêu"),
            el("th", { scope: "col", class: "lookup-table-rate" }, "Tỷ lệ"),
          ])]),
          el("tbody", {}, items.map(tableRow)),
        ]),
      ]));
    } else {
      grid.append(...items.map((item) => cardView(group, item)));
    }
    if (items.length < total) {
      const button = el("button", { type: "button", class: "lookup-more" }, "Xem thêm");
      button.addEventListener("click", () => { page += 1; render(); });
      more.append(button, el("span", { class: "lookup-more-note" }, "Mỗi lượt hiện 60 kết quả"));
    }
  }

  /** Trả focus về thẻ/nút đã mở hồ sơ (hoặc ô tìm) sau khi hộp thoại biến mất vì Back/Forward. */
  function restoreOpenerFocus() {
    const openerId = opener?.dataset.lookupId;
    const restored = [...grid.querySelectorAll("[data-lookup-id]")].find((button) => button.dataset.lookupId === openerId);
    (restored ?? search).focus();
  }

  function render() {
    const hadDialog = detailMount.querySelector(".lookup-dialog") !== null;
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
      button.addEventListener("click", () => { page = 1; setRoute({ section: "lookup", group, id: null, error: null }); });
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
    const unit = group ? LOOKUP_GROUP_UNITS[group] : "kết quả";
    const hint = group === "tactics" ? " · bấm tên để mở hồ sơ" : " · bấm để mở hồ sơ";
    summary.replaceChildren(el("strong", {}, String(result.total)), ` ${unit}${hint}`);
    renderResults({ group, items, total: result.total });
    if (route?.id) renderDialog(route.id);
    else if (hadDialog) restoreOpenerFocus();
  }

  search.addEventListener("input", () => { query = search.value; page = 1; render(); });
  window.addEventListener("popstate", () => { page = 1; render(); });
  render();
  return { corpus, render };
}

const COST_LABELS = { wood: "Gỗ", iron: "Sắt", stone: "Đá", food: "Lương" };

function barFill(percent, className) {
  const fill = el("span", { class: className });
  fill.style.width = `${percent}%`;
  return fill;
}

function revisionText(revision) {
  const parts = Object.entries(revision ?? {})
    .filter(([key, value]) => value && (key.endsWith("Vi") || ["date", "effectiveDate", "version"].includes(key)))
    .map(([, value]) => String(value));
  return parts.join(" · ") || "Đã ghi nhận cập nhật";
}
