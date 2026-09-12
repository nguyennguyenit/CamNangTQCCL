// TDD js/unified-lookup.js + js/lookup-detail.js — một cửa tra cứu sáu nhóm.
// Route `#lookup?group=<...>&id=<...>`, alias `#heroes`/`#tactics` không rewrite,
// search toàn corpus trước khi phân trang, hồ sơ chỉ tiếng Việt và liên kết theo ID.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LOOKUP_GROUPS,
  parseLookupRoute,
  formatLookupHash,
  buildLookupCorpus,
  searchLookupGroup,
} from "../js/unified-lookup.js";
import { lookupProfile } from "../js/lookup-detail.js";
import { readFile } from "node:fs/promises";

const CJK = /[\u3400-\u9fff]/;
const SOURCE_SENTINELS = ["sgsdeck", "https://sentinel.example/tra-cuu", ".card > .name"];
const shellPath = new URL("../src/pages/index.astro", import.meta.url);

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
      selfTacticId: null, inheritTacticId: null, advisorId: null, categoryVi: "Quân sự",
      conditions: [], flags: { isSp: false, isCO: false }, growth: { luc: 1.98, tri: 0.71 },
      civil: { roleVi: null, specialtyVi: null }, otherAptitudes: {}, revisions: [], missingFields: [],
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
      activationRate: 0.35, conditions: [], revisions: [], inheritedFromIds: [],
      effectTypeVi: "Tăng ích", acquiredFromVi: [], missingFields: [], ...lookup,
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
      effectVi: "Hiệu ứng cải tiến", suggestedBuildVi: "Gợi ý", troopLimitVi: "Không",
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
      id: "building:bat-tran-do", nameVi: "Bát Trận Đồ", summaryVi: "Tóm tắt", mainCityOnly: false, maxLevel: 5,
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

test("#lookup trần mở toàn bộ, group/id đều tùy chọn", () => {
  const route = parseLookupRoute("#lookup");
  assert.equal(route.section, "lookup");
  assert.equal(route.group, null);
  assert.equal(route.id, null);
  assert.equal(route.alias, null);
  assert.equal(route.error, null);
});

test("mỗi group hợp lệ được nhận, id được decode", () => {
  for (const group of LOOKUP_GROUPS) {
    const route = parseLookupRoute(`#lookup?group=${group}`);
    assert.equal(route.group, group);
    assert.equal(route.error, null);
  }
  const withId = parseLookupRoute("#lookup?group=heroes&id=hero%3Aluu-bi");
  assert.equal(withId.group, "heroes");
  assert.equal(withId.id, "hero:luu-bi");
  assert.equal(withId.error, null);
});

test("thiếu group thì suy ra từ loại ID", () => {
  assert.equal(parseLookupRoute("#lookup?id=tactic%3Anhan-duc").group, "tactics");
  assert.equal(parseLookupRoute("#lookup?id=equipment-special%3Agian-hung").group, "equipment");
  assert.equal(parseLookupRoute("#lookup?id=troop-mod%3Adan-duong-binh").group, "troop-mods");
  assert.equal(parseLookupRoute("#lookup?id=building%3Abat-tran-do").group, "buildings");
  assert.equal(parseLookupRoute("#lookup?id=advisor%3Aan-phuc-binh-tam").group, "advisors");
});

test("trang bị đặc hiệu nằm cùng nhóm trang bị", () => {
  const route = parseLookupRoute("#lookup?group=equipment&id=equipment-special%3Agian-hung");
  assert.equal(route.error, null);
  assert.equal(route.id, "equipment-special:gian-hung");
});

function assertLookupError(hash, code) {
  const route = parseLookupRoute(hash);
  assert.equal(route.section, "lookup", `${hash} phải ở lại lookup để hiện lỗi bản địa hóa`);
  assert.equal(route.error, code, `${hash} phải báo lỗi ${code}`);
  assert.equal(route.id, null);
  assert.ok(route.messageVi && route.messageVi.length > 0, `${hash} thiếu thông báo tiếng Việt`);
  assert.doesNotMatch(route.messageVi, CJK, `${hash} không được hiện chữ Hán`);
}

test("tham số trùng bị từ chối", () => {
  assertLookupError("#lookup?group=heroes&group=tactics", "duplicate-param");
  assertLookupError("#lookup?group=heroes&id=hero%3Aluu-bi&id=hero%3Atao-thao", "duplicate-param");
});

test("tham số lạ bị từ chối, không nhận query tự do", () => {
  assertLookupError("#lookup?group=heroes&q=luu", "unknown-param");
  assertLookupError("#lookup?src=https%3A%2F%2Fevil.example%2Fx.json", "unknown-param");
});

test("group lạ hoặc rỗng bị từ chối", () => {
  assertLookupError("#lookup?group=books", "unknown-group");
  assertLookupError("#lookup?group=", "unknown-group");
  assertLookupError("#lookup?group=HEROES", "unknown-group");
});

test("id sai loại so với group bị từ chối", () => {
  assertLookupError("#lookup?group=heroes&id=tactic%3Anhan-duc", "id-kind-mismatch");
  assertLookupError("#lookup?group=buildings&id=troop-mod%3Adan-duong-binh", "id-kind-mismatch");
  assertLookupError("#lookup?group=tactics&id=equipment-special%3Agian-hung", "id-kind-mismatch");
});

test("id không phải canonical ID bị từ chối, không fetch URL từ hash", () => {
  assertLookupError("#lookup?id=https%3A%2F%2Fevil.example%2Fx.json", "unknown-id-kind");
  assertLookupError("#lookup?id=..%2F..%2Fdata%2Fsgsdeck%2Findex.json", "unknown-id-kind");
  assertLookupError("#lookup?group=heroes&id=", "unknown-id-kind");
});

test("#heroes và #tactics là alias preselect, không bị rewrite", () => {
  const heroesAlias = parseLookupRoute("#heroes");
  assert.equal(heroesAlias.section, "lookup");
  assert.equal(heroesAlias.group, "heroes");
  assert.equal(heroesAlias.alias, "heroes");
  assert.equal(formatLookupHash(heroesAlias), "#heroes");

  const tacticsAlias = parseLookupRoute("#tactics");
  assert.equal(tacticsAlias.group, "tactics");
  assert.equal(tacticsAlias.alias, "tactics");
  assert.equal(formatLookupHash(tacticsAlias), "#tactics");
});

test("hash chuẩn được serialize ổn định và encode ID", () => {
  assert.equal(formatLookupHash(parseLookupRoute("#lookup")), "#lookup");
  assert.equal(formatLookupHash(parseLookupRoute("#lookup?group=tactics")), "#lookup?group=tactics");
  assert.equal(
    formatLookupHash(parseLookupRoute("#lookup?group=heroes&id=hero%3Aluu-bi")),
    "#lookup?group=heroes&id=hero%3Aluu-bi",
  );
  assert.equal(
    formatLookupHash({ section: "lookup", group: "equipment", id: "equipment-special:gian-hung", alias: null }),
    "#lookup?group=equipment&id=equipment-special%3Agian-hung",
  );
});

test("hash ngoài lookup không bị lookup chiếm quyền", () => {
  for (const hash of ["", "#", "#team-chuan", "#team-khac", "#team-pk", "#meta-cu", "#coexist", "#khaihoang", "#analyze", "#khong-ton-tai"]) {
    assert.equal(parseLookupRoute(hash), null, `${hash || "(rỗng)"} phải để router Team chuẩn xử lý`);
  }
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

test("hồ sơ tướng có đủ chỉ số, thích tính, tăng trưởng và nội chính", () => {
  const profile = profileFor("hero:luu-bi");
  for (const key of ["luc", "tri", "thong", "toc", "chinh", "mi"]) {
    assert.ok(fieldByKey(profile, key), `thiếu chỉ số ${key}`);
  }
  for (const key of ["ky", "thuan", "cung", "thuong", "khiGioi"]) {
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

test("hồ sơ quân sư liên kết ngược về tướng", () => {
  const advisor = profileFor("advisor:an-phuc-binh-tam");
  const heroes = advisor.children.find((child) => child.key === "heroes");
  assert.deepEqual(heroes.items.map((item) => item.id), ["hero:luu-bi"]);
  assert.deepEqual(heroes.items.map((item) => item.titleVi), ["Lưu Bị"]);
});

test("cải tiến binh chủng giữ đủ tùy chọn và bản sửa", () => {
  const profile = profileFor("troop-mod:dan-duong-binh");
  const options = profile.children.find((child) => child.key === "options");
  assert.equal(options.items.length, 3);
  assert.deepEqual(options.items.map((item) => item.id), CATALOG.troopMods[0].options.map((option) => option.id));
  assert.equal(profile.revisions.length, 2);
  assert.equal(profile.revisions[0].isCurrent, true);
});

test("công trình mở đủ cấp theo thứ tự kèm chi phí và thời gian", () => {
  const profile = profileFor("building:bat-tran-do");
  const levels = profile.children.find((child) => child.key === "levels");
  assert.deepEqual(levels.items.map((item) => item.level), [1, 2, 3, 4, 5]);
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

test("shell chỉ còn một tab Tra cứu và một mount lookup", async () => {
  const html = await readFile(shellPath, "utf8");
  const sections = [...html.matchAll(/data-section=["']([^"']+)["']/g)].map((match) => match[1]);

  assert.equal(sections.includes("lookup"), true, "thiếu tab Tra cứu");
  assert.equal(sections.includes("heroes"), false, "tab Tra cứu tướng phải được gộp");
  assert.equal(sections.includes("tactics"), false, "tab Tra cứu chiến pháp phải được gộp");
  assert.match(html, /data-section=["']lookup["'][^>]*>\s*Tra cứu/);
  assert.match(html, /id=["']section-lookup["']/);
  assert.doesNotMatch(html, /id=["']section-heroes["']/);
  assert.doesNotMatch(html, /id=["']section-tactics["']/);
  assert.match(html, /class=["']nav-tab active["'][^>]+data-section=["']team-chuan["']/);
  assert.match(html, /id=["']section-team-chuan["'][^>]+class=["']section active["']/);
});
