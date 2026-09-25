// TDD js/unified-lookup.js + js/lookup-detail.js — một cửa tra cứu sáu nhóm.
// Route Tra cứu dùng query `?group=<...>&id=<...>` để chọn nhóm và hồ sơ.
// Tìm kiếm toàn corpus trước khi phân trang, hồ sơ chỉ tiếng Việt và liên kết theo ID.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LOOKUP_GROUPS,
  parseLookupQuery,
  formatLookupQuery,
  buildLookupCorpus,
  searchLookupGroup,
} from "../js/unified-lookup.js";
import { lookupProfile } from "../js/lookup-detail.js";
import { resolveLegacyRoute } from "../js/legacy-routes.js";
import { readFile } from "node:fs/promises";

const CJK = /[\u3400-\u9fff]/;
const SOURCE_SENTINELS = ["sgsdeck", "https://sentinel.example/tra-cuu", ".card > .name"];
const lookupPagePath = new URL("../src/pages/tra-cuu/index.astro", import.meta.url);
const siteLayoutPath = new URL("../src/layouts/SiteLayout.astro", import.meta.url);

function sourceNoise() {
  return { source: "sgsdeck", sourceUrl: "https://sentinel.example/tra-cuu", selector: ".card > .name" };
}

function hero(id, viet, over = {}) {
  const { lookup = {}, ...rest } = over;
  return {
    id, viet, hanViet: viet, chinese: "將", aliases: [], faction: "Thục", stars: 5,
    roleTagViet: "Phụ trợ", stats: { luc: 71, tri: 81, thong: 79, toc: 62, chinh: 92, mi: 95 },
    troopApt: { ky: "S", thuan: "S", cung: "A", thuong: "A", khiGioi: "B" },
    selfTacticCn: "", inheritTacticCn: "", ...sourceNoise(),
    lookup: {
      selfTacticId: null, inheritTacticId: null, advisorId: null, variant: "base",
      categoryVi: "Quân sự", exclusiveTitleVi: "Hoàng thúc", civilInnatePoints: 2,
      collectibleBonusVi: "Tăng thuộc tính", redRulesVi: "Mỗi điểm đỏ tăng hiệu quả",
      conditions: [], flags: { isCollectible: true, isDynamicOpen: false, isMusou: false, isCO: false, isSp: false },
      growth: { luc: 1.98, tri: 0.71 }, civil: { roleVi: null, bonusVi: null, specialtyVi: null, tacticBonusVi: null },
      otherAptitudes: { infantry: "C", navy: "S" }, revisions: [], missingFields: [],
      ...lookup,
    },
    ...rest,
  };
}

function tactic(id, viet, over = {}) {
  const { lookup = {}, ...rest } = over;
  return {
    id, viet, hanViet: viet, chinese: "戰法", type: "Chủ động", quality: "S",
    effect: "戰鬥中，使我軍", effectViet: "Trong trận, quân ta", target: "友軍", targetViet: "Quân ta",
    aliases: [], ...sourceNoise(),
    lookup: {
      activationRate: 0.35, cooldown: 0, maxUsers: 3, pointCost: 0,
      conditions: [], revisions: [], inheritedFromIds: [],
      effectTypeVi: "Tăng ích", exchangeConditionVi: null,
      acquiredFromVi: ["Truyền thừa"], conflictsVi: "Không cộng dồn", missingFields: [], ...lookup,
    },
    ...rest,
  };
}

const HERO_POOL = [
  hero("hero:luu-bi", "Lưu Bị", {
    aliases: ["劉備", "刘备"],
    lookup: { selfTacticId: "tactic:nhan-duc", inheritTacticId: null, advisorId: "advisor:an-phuc-binh-tam" },
  }),
  ...Array.from({ length: 130 }, (_, index) => {
    const serial = String(index + 1).padStart(3, "0");
    return hero(`hero:tuong-${serial}`, `Tướng ${serial}`);
  }),
];

const TACTIC_POOL = [
  tactic("tactic:nhan-duc", "Nhân Đức Tải Thế", {
    chinese: "仁德載世",
    lookup: {
      activationRate: 1,
      conditions: ["Chỉ khi quân ta còn trên 50% binh lực"],
      revisions: [
        { effectiveDate: "2021-06-09", isCurrent: true, labelVi: "Bản hiện hành", textVi: "Nội dung hiện hành" },
        { effectiveDate: null, isCurrent: false, labelVi: "Bản gốc", textVi: "Nội dung gốc" },
      ],
    },
  }),
  tactic("tactic:khong-ty-le", "Không Tỷ Lệ", { lookup: { activationRate: 0, conditions: [] } }),
  tactic("tactic:cho-dich", "Chờ Dịch", { effectViet: "", targetViet: "", effect: "戰鬥中，使敵軍", pending: true }),
  tactic("tactic:trung-lap-a", "Trùng Lặp A", { chinese: "重名" }),
  tactic("tactic:trung-lap-b", "Trùng Lặp B", { chinese: "重名" }),
];

const CATALOG = {
  schemaVersion: 1,
  equipment: [
    { id: "equipment:y-thien-kiem", nameVi: "Ỷ Thiên Kiếm", slotVi: "Vũ khí", qualityVi: "Cam", aliasesVi: [], aliasesZh: ["倚天劍"], conditions: [], missingFields: [], ...sourceNoise() },
    { id: "equipment:bach-ngan-giap", nameVi: "Bạch Ngân Giáp", slotVi: "Giáp", qualityVi: "Tím", aliasesVi: [], aliasesZh: ["白銀甲"], conditions: [], missingFields: [], ...sourceNoise() },
  ],
  specials: [
    { id: "equipment-special:gian-hung", nameVi: "Gian Hùng", equipmentId: "equipment:y-thien-kiem", exclusiveHeroId: "hero:luu-bi", slotVi: "Vũ khí", tierVi: "T0", descriptionVi: "Mô tả đặc hiệu", acquisitionVi: ["Rèn"], aliasesVi: [], aliasesZh: ["奸雄"], conditions: [], missingFields: [], ...sourceNoise() },
    { id: "equipment-special:kien-co", nameVi: "Kiên Cố", equipmentId: "equipment:y-thien-kiem", exclusiveHeroId: null, slotVi: "Vũ khí", tierVi: "T1", descriptionVi: "Mô tả kiên cố", acquisitionVi: [], aliasesVi: [], aliasesZh: [], conditions: [], missingFields: [], ...sourceNoise() },
    { id: "equipment-special:mo-coi", nameVi: "Mồ Côi", equipmentId: null, exclusiveHeroId: null, slotVi: "Giáp", tierVi: "T2", descriptionVi: "Chưa rõ trang bị cha", acquisitionVi: [], aliasesVi: [], aliasesZh: [], conditions: [], missingFields: [], ...sourceNoise() },
  ],
  advisors: [
    { id: "advisor:an-phuc-binh-tam", nameVi: "An Phủ Bình Tâm", elementVi: "Phong", heroIds: ["hero:luu-bi"], effectVi: "Hiệu ứng quân sư", tacticPoints: 3, usageVi: "Bổ nhiệm", aliasesVi: [], aliasesZh: ["恩服兵心"], conditions: [], missingFields: [], ...sourceNoise() },
  ],
  troopMods: [
    {
      id: "troop-mod:dan-duong-binh", nameVi: "Đan Dương Binh", appliesToVi: "Thuẫn binh",
      effectVi: "Hiệu ứng cải tiến", suggestedBuildVi: "Gợi ý", troopLimitVi: ["Thuẫn binh"],
      options: [
        { id: "troop-option:dan-duong-binh:a", nameVi: "Xoay", convertsToVi: "Thương binh", descriptionVi: "Mô tả A", tierVi: "Đặc biệt" },
        { id: "troop-option:dan-duong-binh:b", nameVi: "Cầm", convertsToVi: "Thuẫn binh", descriptionVi: "Mô tả B", tierVi: "Cao cấp" },
        { id: "troop-option:dan-duong-binh:c", nameVi: "Bắn", convertsToVi: "Cung binh", descriptionVi: "Mô tả C", tierVi: "Thường" },
      ],
      revisions: [
        { effectiveDate: "2024-08-28", isCurrent: true, labelVi: "Bản hiện hành", textVi: "Nội dung hiện hành" },
        { effectiveDate: "2023-01-01", isCurrent: false, labelVi: "Bản gốc", textVi: "Nội dung gốc" },
      ],
      aliasesVi: [], aliasesZh: ["丹陽兵"], conditions: [], missingFields: [], ...sourceNoise(),
    },
  ],
  buildings: [
    {
      id: "building:bat-tran-do", nameVi: "Bát Trận Đồ", summaryVi: "Tóm tắt", mainCityOnly: true, maxLevel: 5,
      levels: [3, 1, 5, 2, 4].map((level) => ({
        id: `building-level:bat-tran-do:${level}`, level,
        effectVi: `Hiệu ứng cấp ${level}`, durationVi: `${level} giờ`,
        costs: { wood: 1000 * level, stone: 1000 * level, iron: 500 * level },
      })),
      aliasesVi: [], aliasesZh: ["八陣圖"], conditions: [], missingFields: [], ...sourceNoise(),
    },
  ],
};

const corpus = () => buildLookupCorpus({ heroes: HERO_POOL, tactics: TACTIC_POOL, catalog: CATALOG });

/* ---------- Route ---------- */

test("sáu nhóm theo đúng thứ tự công bố", () => {
  assert.deepEqual(LOOKUP_GROUPS, ["heroes", "tactics", "equipment", "advisors", "troop-mods", "buildings"]);
});

test("query trống mở toàn bộ corpus, group/id đều tùy chọn", () => {
  const route = parseLookupQuery("?");
  assert.equal(route.section, "lookup");
  assert.equal(route.group, null);
  assert.equal(route.id, null);
  assert.equal(route.error, null);
});

test("mỗi group hợp lệ được nhận, id được decode", () => {
  for (const group of LOOKUP_GROUPS) {
    const route = parseLookupQuery(`?group=${group}`);
    assert.equal(route.group, group);
    assert.equal(route.error, null);
  }
  const withId = parseLookupQuery("?group=heroes&id=hero%3Aluu-bi");
  assert.equal(withId.group, "heroes");
  assert.equal(withId.id, "hero:luu-bi");
  assert.equal(withId.error, null);
});

test("thiếu group thì suy ra từ loại ID", () => {
  assert.equal(parseLookupQuery("?id=tactic%3Anhan-duc").group, "tactics");
  assert.equal(parseLookupQuery("?id=equipment-special%3Agian-hung").group, "equipment");
  assert.equal(parseLookupQuery("?id=troop-mod%3Adan-duong-binh").group, "troop-mods");
  assert.equal(parseLookupQuery("?id=building%3Abat-tran-do").group, "buildings");
  assert.equal(parseLookupQuery("?id=advisor%3Aan-phuc-binh-tam").group, "advisors");
});

test("trang bị đặc hiệu nằm cùng nhóm trang bị", () => {
  const route = parseLookupQuery("?group=equipment&id=equipment-special%3Agian-hung");
  assert.equal(route.error, null);
  assert.equal(route.id, "equipment-special:gian-hung");
});

function assertLookupError(search, code) {
  const route = parseLookupQuery(search);
  assert.equal(route.section, "lookup", `${search} phải ở lại lookup để hiện lỗi bản địa hóa`);
  assert.equal(route.error, code, `${search} phải báo lỗi ${code}`);
  assert.equal(route.id, null);
  assert.ok(route.messageVi && route.messageVi.length > 0, `${search} thiếu thông báo tiếng Việt`);
  assert.doesNotMatch(route.messageVi, CJK, `${search} không được hiện chữ Hán`);
}

test("tham số trùng bị từ chối", () => {
  assertLookupError("?group=heroes&group=tactics", "duplicate-param");
  assertLookupError("?group=heroes&id=hero%3Aluu-bi&id=hero%3Atao-thao", "duplicate-param");
});

// Bước 4: parser chỉ xét `group`/`id`; khóa khác được bỏ qua thay vì báo `unknown-param`.
test("bỏ qua khóa khác và chỉ xét group/id", () => {
  const withUnknownKey = parseLookupQuery("?group=heroes&q=luu");
  assert.equal(withUnknownKey.group, "heroes");
  assert.equal(withUnknownKey.id, null);
  assert.equal(withUnknownKey.error, null);

  const withExternalSource = parseLookupQuery("?src=https://evil.example/x.json");
  assert.equal(withExternalSource.group, null);
  assert.equal(withExternalSource.id, null);
  assert.equal(withExternalSource.error, null);
});

test("group lạ hoặc rỗng bị từ chối", () => {
  assertLookupError("?group=books", "unknown-group");
  assertLookupError("?group=", "unknown-group");
  assertLookupError("?group=HEROES", "unknown-group");
});

test("id sai loại so với group bị từ chối", () => {
  assertLookupError("?group=heroes&id=tactic%3Anhan-duc", "id-kind-mismatch");
  assertLookupError("?group=buildings&id=troop-mod%3Adan-duong-binh", "id-kind-mismatch");
  assertLookupError("?group=tactics&id=equipment-special%3Agian-hung", "id-kind-mismatch");
});

test("id không phải canonical ID bị từ chối, không fetch URL từ query", () => {
  assertLookupError("?id=https%3A%2F%2Fevil.example%2Fx.json", "unknown-id-kind");
  assertLookupError("?id=..%2F..%2Fdata%2Fsdeck%2Findex.json", "unknown-id-kind");
  assertLookupError("?id=..%2F..%2Fdata%2Fsgsdeck%2Findex.json", "unknown-id-kind");
  assertLookupError("?group=heroes&id=", "unknown-id-kind");
});

test("query rỗng luôn trả đủ shape route Tra cứu", () => {
  assert.deepEqual(parseLookupQuery(""), {
    section: "lookup", group: null, id: null, error: null, messageVi: null,
  });
});

test("group query đặt trạng thái preselect", () => {
  assert.equal(parseLookupQuery("?group=heroes").group, "heroes");
  assert.equal(parseLookupQuery("?group=tactics").group, "tactics");
});

test("alias hash cũ chuyển tới trang Tra cứu với group tương ứng", () => {
  assert.equal(resolveLegacyRoute("https://tqccl.pages.dev/#heroes", "https://tqccl.pages.dev"), "/tra-cuu/?group=heroes");
  assert.equal(resolveLegacyRoute("https://tqccl.pages.dev/#tactics", "https://tqccl.pages.dev"), "/tra-cuu/?group=tactics");
});

test("query được serialize ổn định và encode ID", () => {
  assert.equal(formatLookupQuery(parseLookupQuery("")), "");
  assert.equal(formatLookupQuery(parseLookupQuery("?group=tactics")), "group=tactics");
  assert.equal(
    formatLookupQuery(parseLookupQuery("?group=heroes&id=hero%3Aluu-bi")),
    "group=heroes&id=hero%3Aluu-bi",
  );
  assert.equal(
    formatLookupQuery({ section: "lookup", group: "heroes", id: "hero:luu-bi", error: null }),
    "group=heroes&id=hero%3Aluu-bi",
  );
});

/* ---------- Corpus, tìm kiếm, phân trang ---------- */

test("corpus phủ đủ sáu nhóm và mọi bản ghi con", () => {
  const built = corpus();
  assert.deepEqual(Object.keys(built.groups).sort(), [...LOOKUP_GROUPS].sort());
  assert.equal(built.groups.heroes.length, HERO_POOL.length);
  assert.equal(built.groups.tactics.length, TACTIC_POOL.length);
  assert.equal(built.groups.equipment.length, CATALOG.equipment.length + CATALOG.specials.length);
  assert.equal(built.groups.advisors.length, CATALOG.advisors.length);
  assert.equal(built.groups["troop-mods"].length, CATALOG.troopMods.length);
  assert.equal(built.groups.buildings.length, CATALOG.buildings.length);

  const equipmentIds = built.groups.equipment.map((entry) => entry.id);
  assert.ok(equipmentIds.includes("equipment-special:mo-coi"), "đặc hiệu chưa biết trang bị cha vẫn phải tìm được");
});

test("tên hiển thị trong kết quả chỉ tiếng Việt", () => {
  const built = corpus();
  for (const group of LOOKUP_GROUPS) {
    for (const entry of built.groups[group]) {
      assert.doesNotMatch(entry.nameVi, CJK, `${entry.id} hiện chữ Hán trong danh sách`);
      assert.ok(entry.nameVi.length > 0, `${entry.id} thiếu tên tiếng Việt`);
    }
  }
});

test("trang đầu 60 mục, Xem thêm đi tới bản ghi cuối cùng", () => {
  const built = corpus();
  const first = searchLookupGroup(built, { group: "heroes", query: "" });
  assert.equal(first.total, HERO_POOL.length);
  assert.equal(first.items.length, 60);
  assert.equal(first.hasMore, true);

  const seen = [...first.items.map((item) => item.id)];
  let page = 1;
  let current = first;
  while (current.hasMore) {
    page += 1;
    current = searchLookupGroup(built, { group: "heroes", query: "", page });
    seen.push(...current.items.map((item) => item.id));
  }
  assert.equal(current.hasMore, false);
  assert.equal(page, 3);
  assert.equal(current.items.length, HERO_POOL.length - 120);
  assert.deepEqual(new Set(seen).size, HERO_POOL.length);
  assert.equal(seen.at(-1), HERO_POOL.at(-1).id, "bản ghi cuối phải truy cập được");
});

test("tìm toàn corpus trước khi cắt trang", () => {
  const built = corpus();
  const late = searchLookupGroup(built, { group: "heroes", query: "Tướng 129" });
  assert.equal(late.items[0].id, "hero:tuong-129");
  assert.ok(late.total >= 1);

  const unpagedPosition = HERO_POOL.findIndex((entry) => entry.id === "hero:tuong-129");
  assert.ok(unpagedPosition >= 60, "bản ghi thử phải nằm ngoài trang đầu khi không tìm");
});

test("tìm tiếng Việt bỏ dấu và không phân biệt hoa thường", () => {
  const built = corpus();
  assert.equal(searchLookupGroup(built, { group: "heroes", query: "luu bi" }).items[0].id, "hero:luu-bi");
  assert.equal(searchLookupGroup(built, { group: "heroes", query: "LUU BI" }).items[0].id, "hero:luu-bi");
  assert.equal(searchLookupGroup(built, { group: "heroes", query: "Lưu Bị" }).items[0].id, "hero:luu-bi");
});

test("chữ Hán chỉ là alias tìm kiếm cho mọi nhóm", () => {
  const built = corpus();
  const cases = [
    ["heroes", "劉備", "hero:luu-bi"],
    ["tactics", "仁德載世", "tactic:nhan-duc"],
    ["equipment", "倚天劍", "equipment:y-thien-kiem"],
    ["equipment", "奸雄", "equipment-special:gian-hung"],
    ["advisors", "恩服兵心", "advisor:an-phuc-binh-tam"],
    ["troop-mods", "丹陽兵", "troop-mod:dan-duong-binh"],
    ["buildings", "八陣圖", "building:bat-tran-do"],
  ];
  for (const [group, query, id] of cases) {
    const found = searchLookupGroup(built, { group, query });
    assert.equal(found.items[0]?.id, id, `${query} phải khớp ${id}`);
    assert.doesNotMatch(found.items[0].nameVi, CJK);
  }
});

test("không có kết quả trả tổng 0 và không còn trang", () => {
  const built = corpus();
  const empty = searchLookupGroup(built, { group: "buildings", query: "zzzqqq" });
  assert.equal(empty.total, 0);
  assert.deepEqual(empty.items, []);
  assert.equal(empty.hasMore, false);
});

/* ---------- Hồ sơ chi tiết ---------- */

function profileFor(id) {
  return lookupProfile(corpus(), id);
}

function fieldByKey(profile, key) {
  return profile.fields.find((field) => field.key === key);
}

function relationByKey(profile, key) {
  return profile.relations.find((relation) => relation.key === key);
}

test("ID lạ không dựng hồ sơ", () => {
  assert.equal(profileFor("hero:khong-ton-tai"), null);
  assert.equal(profileFor("https://evil.example/x.json"), null);
});

test("hồ sơ tướng liên kết chiến pháp và quân sư theo ID", () => {
  const profile = profileFor("hero:luu-bi");
  assert.equal(profile.group, "heroes");
  assert.equal(profile.titleVi, "Lưu Bị");

  const self = relationByKey(profile, "selfTactic");
  assert.equal(self.resolved, true);
  assert.equal(self.targetId, "tactic:nhan-duc");
  assert.equal(self.targetGroup, "tactics");
  assert.equal(self.titleVi, "Nhân Đức Tải Thế");

  const advisor = relationByKey(profile, "advisor");
  assert.equal(advisor.resolved, true);
  assert.equal(advisor.targetId, "advisor:an-phuc-binh-tam");
  assert.equal(advisor.titleVi, "An Phủ Bình Tâm");
});

test("thiếu liên kết là chữ cập nhật tiếng Việt, không bịa tiêu đề/link chữ Hán", () => {
  const orphan = buildLookupCorpus({
    heroes: [hero("hero:vo-danh", "Vô Danh", { selfTacticCn: "無此戰法" })],
    tactics: TACTIC_POOL,
    catalog: CATALOG,
  });
  const relation = lookupProfile(orphan, "hero:vo-danh").relations.find((r) => r.key === "selfTactic");
  assert.equal(relation.resolved, false);
  assert.equal(relation.targetId, null);
  assert.ok(relation.statusVi.length > 0);
  assert.doesNotMatch(JSON.stringify(relation), CJK);
});

test("fallback tên Hán chỉ khi duy nhất, mơ hồ thì để trạng thái chưa xác minh", () => {
  const unique = buildLookupCorpus({
    heroes: [hero("hero:duy-nhat", "Duy Nhất", { selfTacticCn: "仁德載世" })],
    tactics: TACTIC_POOL,
    catalog: CATALOG,
  });
  const resolved = lookupProfile(unique, "hero:duy-nhat").relations.find((r) => r.key === "selfTactic");
  assert.equal(resolved.resolved, true);
  assert.equal(resolved.targetId, "tactic:nhan-duc");

  const ambiguous = buildLookupCorpus({
    heroes: [hero("hero:mo-ho", "Mơ Hồ", { selfTacticCn: "重名" })],
    tactics: TACTIC_POOL,
    catalog: CATALOG,
  });
  const unresolved = lookupProfile(ambiguous, "hero:mo-ho").relations.find((r) => r.key === "selfTactic");
  assert.equal(unresolved.resolved, false);
  assert.equal(unresolved.targetId, null);
  assert.ok(unresolved.statusVi.length > 0);
});

test("giá trị 0 hợp lệ hiển thị là 0, không thành gạch ngang", () => {
  const zeros = buildLookupCorpus({
    heroes: [hero("hero:so-khong", "Số Không", {
      stats: { luc: 0, tri: 0, thong: 0, toc: 0, chinh: 0, mi: 0 },
      lookup: { growth: { luc: 0, tri: 0 }, civilInnatePoints: 0 },
    })],
    tactics: TACTIC_POOL,
    catalog: CATALOG,
  });
  const profile = lookupProfile(zeros, "hero:so-khong");
  const luc = fieldByKey(profile, "luc");
  assert.equal(luc.value, 0);
  assert.equal(luc.textVi, "0");
  assert.notEqual(luc.textVi, "—");

  const rate = fieldByKey(lookupProfile(corpus(), "tactic:khong-ty-le"), "activationRate");
  assert.equal(rate.value, 0);
  assert.match(rate.textVi, /0/);
  assert.notEqual(rate.textVi, "—");
});

test("hồ sơ tướng có đủ chỉ số, thích tính và metadata đã duyệt", () => {
  const profile = profileFor("hero:luu-bi");
  for (const key of ["variant", "categoryVi", "exclusiveTitleVi", "civilInnatePoints", "collectibleBonusVi", "redRulesVi", "flags", "luc", "tri", "thong", "toc", "chinh", "mi"]) {
    assert.ok(fieldByKey(profile, key), `thiếu trường tướng ${key}`);
  }
  for (const key of ["ky", "thuan", "cung", "thuong", "khiGioi", "infantry", "navy"]) {
    assert.ok(profile.aptitudes.some((apt) => apt.key === key), `thiếu thích tính ${key}`);
  }
  assert.ok(profile.sections.some((section) => section.key === "growth"), "thiếu khối tăng trưởng");
  assert.ok(profile.sections.some((section) => section.key === "civil"), "thiếu khối nội chính");
});

test("hồ sơ chiến pháp dùng bản Việt, không mượn effect gốc để lấp chỗ trống", () => {
  const current = profileFor("tactic:nhan-duc");
  assert.equal(fieldByKey(current, "effect").textVi, "Trong trận, quân ta");
  assert.equal(fieldByKey(current, "target").textVi, "Quân ta");
  assert.equal(current.revisions.length, 2);
  assert.equal(current.revisions[0].isCurrent, true);
  assert.deepEqual(current.conditions, ["Chỉ khi quân ta còn trên 50% binh lực"]);

  const pending = profileFor("tactic:cho-dich");
  const effect = fieldByKey(pending, "effect");
  assert.match(effect.textVi, /cập nhật/i);
  assert.doesNotMatch(JSON.stringify(pending), CJK);
  assert.deepEqual(pending.conditions, []);
});

test("hồ sơ chiến pháp hiện đầy đủ giới hạn và cách nhận đã duyệt", () => {
  const profile = profileFor("tactic:nhan-duc");
  for (const key of ["cooldown", "maxUsers", "pointCost", "acquiredFromVi", "conflictsVi"]) {
    assert.ok(fieldByKey(profile, key), `thiếu trường chiến pháp ${key}`);
  }
  assert.equal(fieldByKey(profile, "cooldown").textVi, "0");
  assert.equal(fieldByKey(profile, "pointCost").textVi, "0");
  assert.equal(fieldByKey(profile, "acquiredFromVi").textVi, "Truyền thừa");
});

test("hồ sơ trang bị mở đủ đặc hiệu con và đặc hiệu mồ côi vẫn có hồ sơ riêng", () => {
  const equipment = profileFor("equipment:y-thien-kiem");
  const specials = equipment.children.find((child) => child.key === "specials");
  assert.deepEqual(specials.items.map((item) => item.id), ["equipment-special:gian-hung", "equipment-special:kien-co"]);

  const special = profileFor("equipment-special:gian-hung");
  assert.equal(relationByKey(special, "equipment").targetId, "equipment:y-thien-kiem");
  assert.equal(relationByKey(special, "exclusiveHero").targetId, "hero:luu-bi");
  assert.equal(relationByKey(special, "exclusiveHero").titleVi, "Lưu Bị");

  const orphan = profileFor("equipment-special:mo-coi");
  const parent = relationByKey(orphan, "equipment");
  assert.equal(parent.resolved, false);
  assert.equal(parent.targetId, null);
  assert.ok(parent.statusVi.length > 0);
});

test("hồ sơ đặc kỹ hiện cách nhận đã duyệt", () => {
  const special = profileFor("equipment-special:gian-hung");
  assert.equal(fieldByKey(special, "acquisitionVi").textVi, "Rèn");
});

test("hồ sơ quân sư liên kết ngược về tướng và hiện nguyên tố", () => {
  const advisor = profileFor("advisor:an-phuc-binh-tam");
  const heroes = advisor.children.find((child) => child.key === "heroes");
  assert.deepEqual(heroes.items.map((item) => item.id), ["hero:luu-bi"]);
  assert.deepEqual(heroes.items.map((item) => item.titleVi), ["Lưu Bị"]);
  assert.equal(fieldByKey(advisor, "elementVi").textVi, "Phong");
});

test("cải tiến binh chủng giữ đủ tùy chọn, bản sửa và giới hạn binh chủng", () => {
  const profile = profileFor("troop-mod:dan-duong-binh");
  const options = profile.children.find((child) => child.key === "options");
  assert.equal(options.items.length, 3);
  assert.deepEqual(options.items.map((item) => item.id), CATALOG.troopMods[0].options.map((option) => option.id));
  assert.equal(profile.revisions.length, 2);
  assert.equal(profile.revisions[0].isCurrent, true);
  assert.equal(fieldByKey(profile, "troopLimitVi").textVi, "Thuẫn binh");
});

test("công trình mở đủ cấp, chi phí, thời gian và phạm vi thành", () => {
  const profile = profileFor("building:bat-tran-do");
  const levels = profile.children.find((child) => child.key === "levels");
  assert.deepEqual(levels.items.map((item) => item.level), [1, 2, 3, 4, 5]);
  assert.equal(fieldByKey(profile, "mainCityOnly").textVi, "Chỉ thành chính");
  for (const item of levels.items) {
    assert.ok(item.durationVi.length > 0, `cấp ${item.level} thiếu thời gian`);
    assert.equal(typeof item.costs.wood, "number");
    assert.ok(item.effectVi.length > 0);
  }
});

test("hồ sơ mọi nhóm ẩn nguồn và chỉ hiện tiếng Việt", () => {
  const ids = [
    "hero:luu-bi", "tactic:nhan-duc", "equipment:y-thien-kiem", "equipment-special:gian-hung",
    "advisor:an-phuc-binh-tam", "troop-mod:dan-duong-binh", "building:bat-tran-do",
  ];
  for (const id of ids) {
    const serialized = JSON.stringify(profileFor(id));
    assert.doesNotMatch(serialized, CJK, `${id} lộ chữ Hán trong hồ sơ`);
    for (const sentinel of SOURCE_SENTINELS) {
      assert.equal(serialized.includes(sentinel), false, `${id} lộ nguồn: ${sentinel}`);
    }
  }
});

test("trang Tra cứu chỉ còn một tab và một mount lookup", async () => {
  const [page, layout] = await Promise.all([
    readFile(lookupPagePath, "utf8"),
    readFile(siteLayoutPath, "utf8"),
  ]);
  const sections = layout.match(/const SECTIONS = \[([\s\S]*?)\n\];/);
  assert.ok(sections, "thiếu danh sách nav trong SiteLayout");
  assert.match(sections[1], /\{id:\s*'lookup',\s*label:\s*'Tra cứu',/);
  assert.doesNotMatch(sections[1], /\bid:\s*'(?:heroes|tactics)'/);

  const navLink = layout.match(/\{!landing && topSections\.map\(\(section\) => \([\s\S]*?<a\b([\s\S]*?)<\/a>/);
  assert.ok(navLink, "nav phải kết xuất mỗi mục thành liên kết <a>");
  assert.match(navLink[1], /data-section=\{section\.id\}/);
  assert.match(navLink[1], /href=\{section\.path\}/);
  assert.match(navLink[1], /aria-current=\{section\.id === activeSection \? 'page' : null\}/);
  assert.match(navLink[1], />\{section\.label\}/);
  // Ba mục Beta nằm trong menu thả "Công cụ": vẫn là liên kết thật, cùng bộ thuộc tính nav.
  const toolLink = layout.match(/section\.entries\.map\(\(entry\) => \([\s\S]*?<a\b([\s\S]*?)>\s*<span class="nav-menu-label"/);
  assert.ok(toolLink, "mục trong menu thả phải là liên kết <a>");
  assert.match(toolLink[1], /data-section=\{entry\.id\}/);
  assert.match(toolLink[1], /href=\{entry\.href\}/);
  assert.match(toolLink[1], /aria-current=\{entry\.id && entry\.id === activeSection \? 'page' : null\}/);

  const mounts = [...page.matchAll(/<section\b[^>]*\bid=["'](section-[^"']+)["'][^>]*>/g)]
    .map((match) => match[1]);
  assert.deepEqual(mounts, ["section-lookup"], "trang Tra cứu chỉ có một mount");
  assert.match(page, /<section\b[^>]*id=["']section-lookup["'][^>]*>/);
  assert.match(page, /<script[^>]+type=["']module["'][^>]+src=["']\/js\/app\.js["']/);
});

/* ---------- Phase 7: giao diện mới, nhãn tiếng Việt, khối "Trong cẩm nang" ---------- */

import { lookupCardView, tacticTableRow, camNangView, POSITION_LABELS } from "../js/unified-lookup.js";
import { portraitUrl, portraitChar } from "../js/hero-portrait.js";
import { parseHeroSummaries } from "../js/hero-summaries.js";

const HERO_UI = hero("hero:sp-lu-mong", "SP Lữ Mông", {
  chinese: "SP 呂蒙", aliases: ["SP吕蒙"], faction: "Ngô", stars: 5, roleTagViet: "Khống chế / Kiêm nhiệm",
  iconUrl: "http://image.aligames.com/a.png",
  lookup: { variant: "sp", categoryVi: "Quân sự", flags: { isCollectible: true, isDynamicOpen: true, isSp: true, isMusou: false, isCO: false } },
});

function heroUiCorpus(over = {}) {
  return buildLookupCorpus({ heroes: [HERO_UI, ...(over.heroes ?? [])], tactics: TACTIC_POOL, catalog: CATALOG });
}

test("thẻ kết quả Tra cứu hiện biến thể, phe, sao và tên Hán", () => {
  const entry = heroUiCorpus().byId.get("hero:sp-lu-mong");
  const view = lookupCardView("heroes", entry);
  assert.equal(view.variant, "SP");
  assert.equal(view.faction, "Ngô");
  assert.equal(view.stars, "5 sao");
  assert.equal(view.chinese, "SP 呂蒙");
  assert.deepEqual(view.meta.map((part) => part.text), ["Ngô", "Khống chế / Kiêm nhiệm"]);
});

test("bảng chiến pháp lấy phẩm, loại, dạng hiệu ứng, mục tiêu, tỷ lệ và để trống thành —", () => {
  const corpus = heroUiCorpus();
  const row = tacticTableRow(lookupProfile(corpus, "tactic:nhan-duc"));
  assert.equal(row.nameVi, "Nhân Đức Tải Thế");
  assert.equal(row.quality, "S");
  assert.equal(row.type, "Chủ động");
  assert.equal(row.effectType, "Tăng ích");
  assert.equal(row.target, "Quân ta");
  assert.equal(row.rate, "100%");

  const pending = tacticTableRow(lookupProfile(corpus, "tactic:cho-dich"));
  assert.equal(pending.target, "—");
  const missing = buildLookupCorpus({
    heroes: [],
    tactics: [tactic("tactic:thieu", "Thiếu Dữ Liệu", { lookup: { activationRate: null } })],
    catalog: CATALOG,
  });
  assert.equal(tacticTableRow(lookupProfile(missing, "tactic:thieu")).rate, "—");
});

test("nội chính hiện nhãn tiếng Việt, không bao giờ in khóa thô", () => {
  const warned = [];
  const original = console.warn;
  console.warn = (message) => warned.push(String(message));
  try {
    const corpus = buildLookupCorpus({
      heroes: [hero("hero:la-mat", "La Mật", { lookup: { civil: { bonusVi: "Thưởng A", khoaLanh: "X" } } })],
      tactics: TACTIC_POOL,
      catalog: CATALOG,
    });
    const civil = lookupProfile(corpus, "hero:la-mat").sections.find((section) => section.key === "civil");
    assert.deepEqual(civil.fields.map((field) => field.labelVi), ["Thưởng nội chính"]);
    const shown = civil.fields.map((field) => `${field.labelVi}=${field.textVi}`).join(" | ");
    assert.equal(shown, "Thưởng nội chính=Thưởng A");
    assert.doesNotMatch(shown, /khoaLanh|bonusVi|Đang cập nhật/);
  } finally {
    console.warn = original;
  }
  assert.ok(warned.some((line) => line.includes("khoaLanh")), "khóa không nhãn phải được cảnh báo cho dev");
});

test("khối Trong cẩm nang gộp vị trí hai họ, giữ trần 3 mục và gắn nhãn vị trí", () => {
  const view = camNangView({
    searchName: "SP Lữ Mông",
    standard: { teams: 48, positions: [1, 10, 37] },
    other: { teams: 7, positions: [1, 1, 5] },
    tactics: [{ name: "Thuyền Cỏ Mượn Tên", teams: 34 }, { name: "An Ủi Quân Dân", teams: 10 }],
    books: { teams: 52, items: [{ name: "Phòng Bị", teams: 24 }] },
    statFocus: { teams: 41, items: [{ name: "Toàn Thống Soái", teams: 23 }] },
    representative: [
      { family: "recommended", name: "Quán Quân Thương", seasonLabel: "PK-S25", score: 113, position: 2, sourceConfigId: "s25" },
      { family: "other", name: "Mông Tốn Túc", seasonLabel: "", score: null, position: 0, legacyTeamId: "team-intro-4", legacyVariantId: "v-1" },
    ],
  });
  assert.deepEqual(view.positions.map((row) => [row.label, row.count]), [["Chủ tướng", 2], ["Phó tướng 1", 11], ["Phó tướng 2", 42]]);
  assert.equal(view.positions[2].percent, 100);
  assert.equal(view.positions[0].percent, 5);
  assert.deepEqual(POSITION_LABELS, ["Chủ tướng", "Phó tướng 1", "Phó tướng 2"]);
  assert.deepEqual(view.representative.map((team) => team.positionLabel), ["Phó tướng 2", "Chủ tướng"]);
  assert.equal(camNangView(null), null);
});

test("ô chân dung nâng https, từ chối scheme lạ và lấy chữ Hán đầu tên", () => {
  assert.equal(portraitUrl("http://image.aligames.com/a.png"), "https://image.aligames.com/a.png");
  assert.equal(portraitUrl("https://cloud.lingxigames.com/a.png"), "https://cloud.lingxigames.com/a.png");
  assert.equal(portraitUrl("javascript:alert(1)"), null);
  assert.equal(portraitUrl("image.aligames.com/a.png"), null);
  assert.equal(portraitUrl(null), null);
  assert.equal(portraitChar("SP 呂蒙", "SP Lữ Mông"), "呂");
  assert.equal(portraitChar("", "Nghiêm Nhan"), "N");
  assert.equal(portraitChar("", ""), "?");
});

const SUMMARY_FIXTURE = {
  schemaVersion: 1,
  provenance: {
    catalogSha256: `sha256:${"a".repeat(64)}`,
    recommendedJoin: "heroes[].nameRaw ↔ chinese|aliases (bỏ khoảng trắng)",
    otherJoin: "holders[].nameRaw ↔ hanViet (bỏ khoảng trắng hai đầu)",
    unmatchedSlots: { recommended: 27, other: 0 },
    ambiguousSlots: { recommended: 0, other: 0 },
  },
  summaries: {
    "hero:sp-lu-mong": {
      searchName: "SP Lữ Mông",
      standard: { teams: 48, positions: [1, 10, 37] },
      other: { teams: 7, positions: [1, 1, 5] },
      tactics: [{ name: "Thuyền Cỏ Mượn Tên", teams: 34 }],
      books: { teams: 52, items: [{ name: "Phòng Bị", teams: 24 }] },
      statFocus: { teams: 41, items: [{ name: "Toàn Thống Soái", teams: 23 }] },
      representative: [{ family: "recommended", name: "Quán Quân Thương", seasonLabel: "PK-S25", score: 113, position: 2, sourceConfigId: "s25" }],
    },
  },
};

test("payload Trong cẩm nang chỉ được nhận khi khớp kho Tra cứu và đúng cấu trúc", () => {
  const parsed = parseHeroSummaries(SUMMARY_FIXTURE, { catalogSha256: "a".repeat(64) });
  assert.equal(parsed["hero:sp-lu-mong"].standard.teams, 48);
  assert.throws(() => parseHeroSummaries(SUMMARY_FIXTURE, { catalogSha256: "b".repeat(64) }), /kho Tra cứu/);
  assert.throws(() => parseHeroSummaries({ ...SUMMARY_FIXTURE, schemaVersion: 2 }, { catalogSha256: "a".repeat(64) }), /phiên bản/);
  const broken = structuredClone(SUMMARY_FIXTURE);
  broken.summaries["hero:sp-lu-mong"].standard.teams = 999;
  assert.throws(() => parseHeroSummaries(broken, { catalogSha256: "a".repeat(64) }), /không hợp lệ/);
  const brokenItems = structuredClone(SUMMARY_FIXTURE);
  brokenItems.summaries["hero:sp-lu-mong"].books.items[0].teams = 99;
  assert.throws(() => parseHeroSummaries(brokenItems, { catalogSha256: "a".repeat(64) }), /binh thư/);
});
