// Khung của mục Đội chuẩn / Đội khác dạng cây thuần (`js/reference-shell-tree.js`): chạy trong Node không `document`, ở vi/zh/ja.
// Cây này là một định nghĩa dùng chung cho bản dựng sẵn (`treeToHtml`) và trình duyệt (`treeToDom`), nên test khóa cấu trúc, thứ tự
// chip tất định, cờ `hidden`/`disabled` và các giá trị URL độc hại. Cách gắn sự kiện (delegation) do e2e khóa.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { withLocale } from "../js/i18n.js";
import { t } from "../js/render.js";
import { treeToHtml } from "../js/view-tree.js";
import { SOURCE_TIER_ORDER } from "../js/recommended-reference-state.js";
import { TEAM_VIEW_CARDS, TEAM_VIEW_GRID, TEAM_VIEW_TABLE } from "../js/team-view.js";
import { PAGE_SIZE } from "../js/team-filter-section.js";
import { WAITING_OR_JS_REQUIRED } from "../scripts/verify-astro-dist.mjs";
import {
  PRIMARY_FACETS,
  SECONDARY_FACETS,
  VIEW_OPTIONS,
  activeFilterCount,
  chipText,
  facetEntries,
  narrowingCount,
  referenceEmptyHidden,
  referenceFiltersChildrenTree,
  referenceMoreHidden,
  referenceShellTree,
} from "../js/reference-shell-tree.js";

const LOCALES = ["vi", "zh", "ja"];
const MOUNT_ID = "section-team-chuan";

/** 3 đội: 2 phe, 2 loại binh, 1 tier. */
const ROWS = [
  { sourceConfigId: "a", factionRaw: "Ngụy", unitTypesRaw: ["Kỵ"], tierRaw: "T0" },
  { sourceConfigId: "b", factionRaw: "Ngụy", unitTypesRaw: ["Cung"], tierRaw: "T0" },
  { sourceConfigId: "c", factionRaw: "Thục", unitTypesRaw: ["Kỵ"], tierRaw: "T0" },
];
const EMPTY_STATE = { query: "", filters: {}, view: TEAM_VIEW_CARDS };
const entries = (overrides = {}) => facetEntries({ scopeItems: ROWS, key: "faction", family: "recommended", state: EMPTY_STATE, labels: {}, ...overrides });

const baseParams = (overrides = {}) => ({
  mountId: MOUNT_ID,
  title: "Đội chuẩn",
  family: "recommended",
  state: EMPTY_STATE,
  labels: {},
  openFacets: new Set(),
  scopeItems: ROWS,
  count: ROWS.length,
  scopeCount: ROWS.length,
  activeCount: 0,
  noticeText: "",
  emptyText: "",
  emptyHidden: referenceEmptyHidden(ROWS.length),
  moreHidden: referenceMoreHidden(PAGE_SIZE, ROWS.length),
  viewTree: t("div", { class: "reference-view" }),
  ...overrides,
});
const shell = (locale, overrides) => withLocale(locale, () => referenceShellTree(baseParams(overrides)));

const walk = (node, visit) => {
  if (typeof node === "string") return;
  visit(node);
  for (const child of node.children) walk(child, visit);
};
const findAll = (tree, predicate) => {
  const found = [];
  for (const root of [].concat(tree)) walk(root, (node) => { if (predicate(node)) found.push(node); });
  return found;
};
const classes = (node) => String(node.attrs?.class ?? "").split(/\s+/u).filter(Boolean);
const hasClass = (node, name) => classes(node).includes(name);
const one = (tree, predicate, label) => {
  const found = findAll(tree, predicate);
  assert.equal(found.length, 1, `${label}: cần đúng một phần tử, có ${found.length}`);
  return found[0];
};
const textOf = (node) => (typeof node === "string" ? node : node.children.map(textOf).join(""));

for (const locale of LOCALES) {
  test(`${locale}: khung có đúng một aside.reference-filters và nút Bộ lọc trỏ đúng id của nó`, () => {
    const tree = shell(locale);
    assert.equal(tree.tag, "div");
    assert.ok(hasClass(tree, "reference-browser"));
    const asides = findAll(tree, (node) => node.tag === "aside" && hasClass(node, "reference-filters"));
    assert.equal(asides.length, 1);
    const [aside] = asides;
    assert.equal(aside.attrs.id, `${MOUNT_ID}-filters`);
    assert.ok(hasClass(aside, "collapsed"), "sidebar mặc định thu gọn (mobile)");
    const toggle = one(tree, (node) => node.tag === "button" && hasClass(node, "filter-collapse-toggle"), "nút Bộ lọc");
    assert.equal(toggle.attrs["aria-controls"], aside.attrs.id);
    assert.equal(toggle.attrs["aria-expanded"], "false");
    // `.reference-browser > .reference-results > [toolbar, aside, thân]`; thân: thanh kho ẩn, thông báo, danh sách, "Xem thêm", "không có đội".
    const [results] = tree.children;
    assert.ok(hasClass(results, "reference-results"));
    assert.deepEqual(results.children.map((child) => classes(child)[0]), ["reference-toolbar", "reference-filters", "reference-results-body"]);
    const body = results.children[2];
    assert.deepEqual(body.children.map((child) => classes(child).find((name) => name.startsWith("reference-"))),
      ["reference-roster-bar", "reference-notice", "reference-view", "reference-more", "reference-empty"]);
    assert.equal(body.children[0].attrs.hidden, true, "thanh kho ẩn cho tới khi trình duyệt vẽ");
  });

  test(`${locale}: mọi thuộc tính aria-* là chuỗi, chip nhận diện bằng data-focus-key và không có data-facet-*`, () => {
    const tree = withLocale(locale, () => referenceShellTree(baseParams({
      state: { query: "", filters: { faction: ["Ngụy"], subcategory: ["Nhóm 1"], source: ["moi-phe"] }, view: TEAM_VIEW_GRID },
      scopeItems: [...ROWS, { sourceConfigId: "d", factionRaw: "Hán", unitTypesRaw: ["Khiên"], tierRaw: "T1", subcategoryRaw: "Nhóm 1", source: "moi-phe" }],
      openFacets: new Set(["source"]),
    })));
    walk(tree, (node) => {
      for (const [name, value] of Object.entries(node.attrs ?? {})) {
        if (name.startsWith("aria-")) assert.equal(typeof value, "string", `${node.tag}.${name} phải là chuỗi (el() ghi "false", t() bỏ false)`);
        assert.ok(!name.startsWith("data-facet"), `không thêm thuộc tính ${name}`);
      }
    });
    const facetKeys = new Set([...PRIMARY_FACETS, ...SECONDARY_FACETS]);
    const chips = findAll(tree, (node) => node.tag === "button" && hasClass(node, "fchip"));
    assert.ok(chips.length >= 5);
    for (const chip of chips) {
      const focusKey = chip.attrs["data-focus-key"];
      const split = focusKey.indexOf(":");
      assert.ok(facetKeys.has(focusKey.slice(0, split)), `khoá facet lạ: ${focusKey}`);
      assert.equal(chip.attrs["aria-pressed"], String(hasClass(chip, "on")));
    }
    const toggles = findAll(tree, (node) => node.tag === "button" && hasClass(node, "flabel-toggle"));
    assert.deepEqual(toggles.map((node) => node.attrs["data-focus-key"]), ["subcategory:toggle", "source:toggle"]);
    assert.deepEqual(toggles.map((node) => node.attrs["aria-expanded"]), ["false", "true"], "chỉ nhóm phụ trong openFacets đang mở");
    for (const toggle of toggles) {
      const row = one(tree, (node) => node.attrs?.id === toggle.attrs["aria-controls"], `chip-row của ${toggle.attrs["data-focus-key"]}`);
      assert.equal(row.attrs.hidden === true, toggle.attrs["aria-expanded"] === "false");
    }
  });

  test(`${locale}: nhóm kiểu hiển thị có ba nút theo thứ tự, aria-pressed theo state.view`, () => {
    for (const view of [TEAM_VIEW_CARDS, TEAM_VIEW_GRID, TEAM_VIEW_TABLE, "khong-hop-le", undefined]) {
      const tree = shell(locale, { state: { ...EMPTY_STATE, view } });
      const buttons = findAll(tree, (node) => node.tag === "button" && node.attrs?.["data-view"] !== undefined);
      assert.deepEqual(buttons.map((node) => node.attrs["data-view"]), VIEW_OPTIONS.map((option) => option.value));
      const expected = VIEW_OPTIONS.map((option) => option.value).includes(view) ? view : TEAM_VIEW_CARDS;
      assert.deepEqual(buttons.map((node) => node.attrs["aria-pressed"]), VIEW_OPTIONS.map((option) => String(option.value === expected)), `view=${view}`);
      assert.deepEqual(buttons.map((node) => hasClass(node, "on")), VIEW_OPTIONS.map((option) => option.value === expected));
    }
  });

  test(`${locale}: không có lọc thì "Xóa lọc" bị khoá và huy hiệu Bộ lọc ẩn; có lọc thì mở`, () => {
    const idle = shell(locale);
    assert.equal(one(idle, (node) => hasClass(node, "clear-btn"), "Xóa lọc").attrs.disabled, true);
    const idleBadge = one(idle, (node) => hasClass(node, "filter-count"), "huy hiệu");
    assert.equal(idleBadge.attrs.hidden, true);
    assert.equal(idleBadge.attrs["aria-hidden"], "true");
    const state = { ...EMPTY_STATE, query: "lưu", filters: { faction: ["Ngụy"], unit: ["Kỵ", "Cung"] } };
    assert.equal(narrowingCount(state), 4);
    const active = shell(locale, { state, activeCount: activeFilterCount(state, false) });
    assert.ok(!findAll(active, (node) => hasClass(node, "clear-btn"))[0].attrs.disabled);
    const badge = one(active, (node) => hasClass(node, "filter-count"), "huy hiệu");
    assert.ok(!badge.attrs.hidden);
    assert.equal(textOf(badge), "4");
  });

  test(`${locale}: thông báo rỗng có hidden; "Xem thêm" ẩn khi số mục không quá PAGE_SIZE; "không có đội" ẩn khi còn mục`, () => {
    const notice = (tree) => one(tree, (node) => hasClass(node, "reference-notice"), "thông báo");
    assert.equal(notice(shell(locale, { noticeText: "" })).attrs.hidden, true);
    const shown = shell(locale, { noticeText: "Mùa này chưa được thu thập." });
    assert.ok(!notice(shown).attrs.hidden);
    assert.equal(textOf(notice(shown)), "Mùa này chưa được thu thập.");

    const more = (total) => one(shell(locale, { moreHidden: referenceMoreHidden(PAGE_SIZE, total) }), (node) => hasClass(node, "reference-more"), "Xem thêm");
    assert.equal(more(0).attrs.hidden, true);
    assert.equal(more(PAGE_SIZE).attrs.hidden, true, "đúng PAGE_SIZE mục: đã hiện hết");
    assert.ok(!more(PAGE_SIZE + 1).attrs.hidden, "hơn PAGE_SIZE mục: còn lượt sau");
    assert.equal(referenceMoreHidden(PAGE_SIZE * 2, PAGE_SIZE * 2 + 1), false);
    assert.equal(referenceMoreHidden(PAGE_SIZE * 3, PAGE_SIZE * 2 + 1), true);

    const empty = (total) => one(shell(locale, { emptyText: "Không có đội khớp bộ lọc.", emptyHidden: referenceEmptyHidden(total) }), (node) => hasClass(node, "reference-empty"), "không có đội");
    assert.ok(!empty(0).attrs.hidden);
    assert.equal(textOf(empty(0)), "Không có đội khớp bộ lọc.");
    assert.equal(empty(1).attrs.hidden, true);
  });

  test(`${locale}: giá trị URL độc hại (__proto__, constructor, toString) không làm cây hỏng, nhãn chip luôn là chuỗi`, () => {
    const hostile = ["__proto__", "constructor", "toString"];
    const state = { ...EMPTY_STATE, filters: { source: hostile, faction: hostile, unit: hostile, tier: hostile, subcategory: hostile } };
    const labels = { faction: {}, unit: {} };
    const tree = withLocale(locale, () => referenceShellTree(baseParams({ state, labels, openFacets: new Set(SECONDARY_FACETS), activeCount: narrowingCount(state) })));
    assert.doesNotThrow(() => treeToHtml(tree));
    const chips = findAll(tree, (node) => node.tag === "button" && hasClass(node, "fchip"));
    for (const key of Object.keys(state.filters)) {
      for (const value of hostile) {
        const chip = one(chips, (node) => node.attrs["data-focus-key"] === `${key}:${value}`, `chip ${key}:${value}`);
        const label = one(chip, (node) => hasClass(node, "fchip-label"), `nhãn ${key}:${value}`);
        assert.ok(label.children.every((child) => typeof child === "string"), `nhãn ${key}:${value} phải là chuỗi, không phải nút cây`);
        assert.equal(typeof withLocale(locale, () => chipText(labels, key, value)), "string");
      }
    }
    // Nhãn nguồn của khoá lạ là chính khoá đó (không trả `Object.prototype` hay hàm kế thừa).
    for (const value of hostile) assert.equal(withLocale(locale, () => chipText(labels, "source", value)), value);
    assert.doesNotMatch(treeToHtml(tree), /\[object Object\]|function |native code/u);
  });

  test(`${locale}: HTML của khung không mang chữ chờ hay đòi JavaScript`, () => {
    const state = { ...EMPTY_STATE, filters: { faction: ["Ngụy"] } };
    const html = treeToHtml(withLocale(locale, () => referenceShellTree(baseParams({ state, activeCount: 1, noticeText: "Ghi chú", emptyText: "Không có đội." }))));
    assert.ok(html.length > 500);
    assert.doesNotMatch(html, WAITING_OR_JS_REQUIRED);
  });
}

test("đếm facet theo phạm vi: 2 phe, 2 loại binh, 1 tier; giá trị đang chọn nhưng ngoài phạm vi hiện với số 0", () => {
  assert.deepEqual(entries(), [["Ngụy", 2], ["Thục", 1]]);
  assert.deepEqual(entries({ key: "unit" }), [["Kỵ", 2], ["Cung", 1]]);
  assert.deepEqual(entries({ key: "tier" }), [["T0", 3]]);
  assert.deepEqual(entries({ state: { ...EMPTY_STATE, filters: { faction: ["Ngô", "Ngụy"] } } }), [["Ngụy", 2], ["Thục", 1], ["Ngô", 0]]);
  // Đội khác đếm theo team: hợp giá trị của mọi phương án đủ dữ liệu.
  const teams = [
    { completeRecords: [ROWS[0], ROWS[1]] },
    { completeRecords: [ROWS[2]] },
  ];
  assert.deepEqual(entries({ scopeItems: teams, family: "other" }), [["Ngụy", 1], ["Thục", 1]]);
  assert.deepEqual(entries({ scopeItems: teams, family: "other", key: "unit" }), [["Kỵ", 2], ["Cung", 1]]);
});

test("tier xếp theo SOURCE_TIER_ORDER, tier lạ về cuối theo mã thô (không localeCompare)", () => {
  const tiers = ["T1", "t9", "功能隊", "T0", "Z9", "T9", "T0.5", "FUNC", "A9"];
  const scopeItems = tiers.map((tierRaw, index) => ({ sourceConfigId: `x${index}`, tierRaw }));
  const result = facetEntries({ scopeItems, key: "tier", family: "recommended", state: EMPTY_STATE, labels: {} }).map(([value]) => value);
  const known = SOURCE_TIER_ORDER.filter((tier) => tiers.includes(tier));
  assert.deepEqual(result, [...known, "A9", "T9", "Z9", "t9"]);
  assert.deepEqual(result.slice(0, known.length), ["T0", "T0.5", "T1", "FUNC", "功能隊"]);
  // Tier đang chọn nhưng ngoài phạm vi vẫn xếp theo cùng luật.
  const withSelected = facetEntries({ scopeItems: [], key: "tier", family: "recommended", state: { ...EMPTY_STATE, filters: { tier: ["T2", "T0", "a1"] } }, labels: {} });
  assert.deepEqual(withSelected, [["T0", 0], ["T2", 0], ["a1", 0]]);
});

/**
 * Hoà số đếm: mọi phe một đội. Hai mã `A`/`B` cùng một nhãn hiển thị buộc phép sắp rơi xuống khoá cuối (mã thô); `đa`/`dz` là cặp mà
 * collation `vi` (đ sau d) và `en` (đ là d có dấu) sắp ngược nhau, nên lộ ra nếu chỗ nào đó dùng locale mặc định của tiến trình.
 */
const TIE_LABELS = { faction: { A: "Cùng nhãn", B: "Cùng nhãn" } };
const TIE_ROWS = ["Thục", "Ngụy", "Ngô", "B", "Hán", "A", "Quần", "Hỗn hợp", "đa", "dz"].map((factionRaw, index) => ({ sourceConfigId: `f${index}`, factionRaw, unitTypesRaw: [], tierRaw: ["t9", "T9", "Z9", "T0"][index % 4] }));
const tieSnapshot = (locale, scopeItems = TIE_ROWS) => withLocale(locale, () => ({
  faction: facetEntries({ scopeItems, key: "faction", family: "recommended", state: EMPTY_STATE, labels: TIE_LABELS }),
  tier: facetEntries({ scopeItems, key: "tier", family: "recommended", state: EMPTY_STATE, labels: {} }),
}));

test("thứ tự khi hoà số đếm tất định: không phụ thuộc thứ tự đầu vào, mã thô là khoá cuối", () => {
  for (const locale of LOCALES) {
    const forward = tieSnapshot(locale);
    assert.deepEqual(tieSnapshot(locale, [...TIE_ROWS].reverse()), forward, `${locale}: đảo thứ tự đầu vào`);
    const rotated = [...TIE_ROWS.slice(3), ...TIE_ROWS.slice(0, 3)];
    assert.deepEqual(tieSnapshot(locale, rotated), forward, `${locale}: xoay thứ tự đầu vào`);
    const values = forward.faction.map(([value]) => value);
    assert.ok(values.indexOf("A") < values.indexOf("B"), `${locale}: cùng nhãn thì mã thô A đứng trước B`);
    assert.deepEqual(forward.tier.map(([value]) => value), ["T0", "T9", "Z9", "t9"].filter((value) => forward.tier.some(([tier]) => tier === value)));
  }
});

/** Chạy phép sắp trong tiến trình con có locale mặc định (ICU) là `lang`, trả JSON mà con in ra. */
function inProcess(lang, script) {
  const env = { ...process.env, LANG: lang, LC_ALL: lang, LC_COLLATE: lang, LC_MESSAGES: lang };
  delete env.LANGUAGE;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], { env, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test("thứ tự chip không phụ thuộc locale mặc định của tiến trình: LANG=C và LANG=vi_VN cho cùng kết quả", () => {
  const i18nUrl = new URL("../js/i18n.js", import.meta.url).href;
  const treeUrl = new URL("../js/reference-shell-tree.js", import.meta.url).href;
  const script = `
    import { withLocale } from ${JSON.stringify(i18nUrl)};
    import { facetEntries } from ${JSON.stringify(treeUrl)};
    const rows = ${JSON.stringify(TIE_ROWS)};
    const labels = ${JSON.stringify(TIE_LABELS)};
    const state = { query: "", filters: {}, view: "the" };
    const out = {};
    for (const locale of ["vi", "zh", "ja"]) out[locale] = withLocale(locale, () => ({
      faction: facetEntries({ scopeItems: rows, key: "faction", family: "recommended", state, labels }),
      tier: facetEntries({ scopeItems: rows, key: "tier", family: "recommended", state, labels: {} }),
    }));
    console.log(JSON.stringify(out));`;
  // Đối chứng: chữ Việt `đ` là một chữ cái riêng trong collation `vi` (sau `d`) nhưng chỉ là `d` có dấu trong `en`: hai locale mặc định
  // này thực sự sắp khác nhau (nếu không, phép so ở dưới chẳng chứng minh gì). Locale `C` của Node là `en-US`.
  const control = `console.log(JSON.stringify(["đa", "dz"].sort((left, right) => left.localeCompare(right))));`;
  assert.notDeepEqual(inProcess("C", control), inProcess("vi_VN.UTF-8", control), "LANG không đổi được locale mặc định của Node trong môi trường này");
  const posix = inProcess("C", script);
  const vietnamese = inProcess("vi_VN.UTF-8", script);
  assert.deepEqual(posix, vietnamese);
  for (const locale of LOCALES) assert.deepEqual(posix[locale], JSON.parse(JSON.stringify(tieSnapshot(locale))), `${locale}: tiến trình con khác tiến trình này`);
});

test("hàm đếm lọc: chip + từ khoá thu hẹp danh sách; lọc kho chỉ tính khi mùa có độ phủ", () => {
  const state = { query: "", filters: { faction: ["Ngụy", "Thục"], unit: [], tier: "không phải mảng" }, rosterFilter: "rap-duoc" };
  assert.equal(narrowingCount(state), 2);
  assert.equal(narrowingCount({ ...state, query: "lưu" }), 3);
  assert.equal(narrowingCount({}), 0);
  assert.equal(activeFilterCount(state, false), 2);
  assert.equal(activeFilterCount(state, true), 3);
  assert.equal(activeFilterCount({ ...state, rosterFilter: null }, true), 2);
});

test("con của sidebar: đầu sidebar rồi các nhóm có chip; phạm vi rỗng chỉ còn đầu sidebar", () => {
  const children = withLocale("vi", () => referenceFiltersChildrenTree({ mountId: MOUNT_ID, scopeItems: [], state: EMPTY_STATE, labels: {}, family: "recommended", openFacets: new Set(), activeCount: 0 }));
  assert.equal(children.length, 1);
  assert.ok(hasClass(children[0], "reference-filter-head"));
  const full = withLocale("vi", () => referenceFiltersChildrenTree({ mountId: MOUNT_ID, scopeItems: ROWS, state: EMPTY_STATE, labels: {}, family: "recommended", openFacets: new Set(), activeCount: 0 }));
  assert.deepEqual(full.slice(1).map((node) => classes(node)[1]), ["unit-group", "faction-group", "tier-group"]);
});
