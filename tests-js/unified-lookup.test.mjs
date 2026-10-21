// TDD js/unified-lookup.js + js/lookup-detail.js — Tra cứu bảy nhóm, mỗi nhóm một trang.
// Trang nhóm `/tra-cuu/<slug>/` chỉ đọc `?id=<mã>`; mã thuộc nhóm khác được chuyển sang đúng trang.
// Tìm kiếm toàn nhóm trước khi phân trang, hồ sơ chỉ tiếng Việt và liên kết theo ID.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LOOKUP_GROUPS,
  parseLookupQuery,
  buildLookupCorpus,
  searchLookupGroup,
  retiredLookupRedirect,
} from "../js/unified-lookup.js";
import { effectVersions, lookupProfile } from "../js/lookup-detail.js";
import { resolveLegacyRoute } from "../js/legacy-routes.js";
import { bookSourceAliases } from "../js/lookup-ids.js";
import { readFile } from "node:fs/promises";

const CJK = /[\u3400-\u9fff]/;
const SOURCE_SENTINELS = ["sgsdeck", "https://sentinel.example/tra-cuu", ".card > .name"];

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
      conditions: [], revisions: [], inheritedFromIds: [], formerIds: [], effectZhSource: null,
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

// Dạng thật của `data/books-dict.json`: không có `id`, `hanViet` có thể vắng hoặc khác tên dịch nghĩa.
const BOOKS = [
  { chinese: "百战", viet: "Bách Chiến", hanViet: "Bách Chiến", sourceNames: ["百戰"], effect: "自帶戰法的發動機率提高 3%", effectViet: "Tỷ lệ phát động của chiến pháp tự mang tăng 3%.", effectVersion: "2021-11" },
  { chinese: "守而有道", viet: "Biết Cách Phòng Thủ" },
  { chinese: "无名" },
];

const corpus = () => buildLookupCorpus({ heroes: HERO_POOL, tactics: TACTIC_POOL, catalog: CATALOG, books: BOOKS });

/* ---------- Route ---------- */

test("bảy nhóm theo đúng thứ tự công bố", () => {
  assert.deepEqual(LOOKUP_GROUPS, ["heroes", "tactics", "equipment", "advisors", "troop-mods", "buildings", "books"]);
});

test("trang nhóm không có id thì không mở hồ sơ, khóa khác của query bị bỏ qua", () => {
  for (const search of ["", "?", "?q=luu", "?group=tactics", "?src=https://evil.example/x.json"]) {
    assert.deepEqual(parseLookupQuery(search, "heroes"), { group: "heroes", id: null, otherGroup: null, error: null, messageVi: null }, search);
  }
});

test("id cùng nhóm được decode; đặc kỹ trang bị thuộc nhóm trang bị", () => {
  assert.equal(parseLookupQuery("?id=hero%3Aluu-bi", "heroes").id, "hero:luu-bi");
  const special = parseLookupQuery("?id=equipment-special%3Agian-hung", "equipment");
  assert.equal(special.id, "equipment-special:gian-hung");
  assert.equal(special.otherGroup, null);
});

test("id của nhóm khác trả nhóm đích để trang chuyển sang đúng trang", () => {
  for (const [id, group] of [["tactic%3Anhan-duc", "tactics"], ["troop-mod%3Adan-duong-binh", "troop-mods"], ["equipment-special%3Agian-hung", "equipment"], ["book%3Abach-chien", "books"]]) {
    const route = parseLookupQuery(`?id=${id}`, "heroes");
    assert.equal(route.otherGroup, group, id);
    assert.equal(route.id, decodeURIComponent(id));
    assert.equal(route.error, null);
  }
});

function assertLookupError(search, code) {
  const route = parseLookupQuery(search, "heroes");
  assert.equal(route.error, code, `${search} phải báo lỗi ${code}`);
  assert.equal(route.id, null);
  assert.ok(route.messageVi && route.messageVi.length > 0, `${search} thiếu thông báo tiếng Việt`);
  assert.doesNotMatch(route.messageVi, CJK, `${search} không được hiện chữ Hán`);
}

test("id lặp bị từ chối", () => {
  assertLookupError("?id=hero%3Aluu-bi&id=hero%3Atao-thao", "duplicate-param");
});

test("id không phải canonical ID bị từ chối, không fetch URL từ query", () => {
  assertLookupError("?id=https%3A%2F%2Fevil.example%2Fx.json", "unknown-id-kind");
  assertLookupError("?id=..%2F..%2Fdata%2Fsdeck%2Findex.json", "unknown-id-kind");
  assertLookupError("?id=..%2F..%2Fdata%2Fsgsdeck%2Findex.json", "unknown-id-kind");
  assertLookupError("?id=", "unknown-id-kind");
});

test("alias hash cũ chuyển tới trang mục lục Tra cứu với group tương ứng", () => {
  assert.equal(resolveLegacyRoute("https://tqccl.com/#heroes", "https://tqccl.com"), "/tra-cuu/?group=heroes");
  assert.equal(resolveLegacyRoute("https://tqccl.com/#tactics", "https://tqccl.com"), "/tra-cuu/?group=tactics");
});

/* ---------- Corpus, tìm kiếm, phân trang ---------- */

test("corpus phủ đủ bảy nhóm và mọi bản ghi con", () => {
  const built = corpus();
  assert.deepEqual(Object.keys(built.groups).sort(), [...LOOKUP_GROUPS].sort());
  assert.equal(built.groups.heroes.length, HERO_POOL.length);
  assert.equal(built.groups.tactics.length, TACTIC_POOL.length);
  // Trang bị chỉ liệt kê trang bị; đặc kỹ nằm trong chi tiết trang bị cha và vẫn tra được theo mã.
  assert.equal(built.groups.equipment.length, CATALOG.equipment.length);
  assert.equal(built.groups.advisors.length, CATALOG.advisors.length);
  assert.equal(built.groups["troop-mods"].length, CATALOG.troopMods.length);
  assert.equal(built.groups.buildings.length, CATALOG.buildings.length);
  // Dòng binh thư không có tên Việt thì không có mã hồ sơ nên bị bỏ.
  assert.deepEqual(built.groups.books.map((entry) => entry.id), ["book:bach-chien", "book:biet-cach-phong-thu"]);

  const equipmentIds = built.groups.equipment.map((entry) => entry.id);
  assert.ok(!equipmentIds.some((id) => id.startsWith("equipment-special:")), "đặc kỹ không phải mục của danh sách trang bị");
  for (const special of CATALOG.specials) {
    assert.equal(built.byId.get(special.id)?.record, special, `${special.id} vẫn tra được theo mã (kể cả đặc kỹ mồ côi)`);
  }
  assert.deepEqual(built.groups.equipment[0].exclusives.map((special) => special.id), ["equipment-special:gian-hung", "equipment-special:kien-co"]);
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

test("bản zh xếp mục khớp tên chữ Hán trước, bản Việt giữ thứ tự nguồn", () => {
  const built = buildLookupCorpus({
    heroes: [
      { id: "hero:quan-binh", viet: "Quan Bình", chinese: "關平", aliases: ["关平"] },
      { id: "hero:sp-quan-vu", viet: "SP Quan Vũ", chinese: "SP 關羽", aliases: ["SP关羽"] },
      { id: "hero:quan-vu", viet: "Quan Vũ", chinese: "關羽", aliases: ["关羽"] },
    ],
    tactics: [],
    catalog: { equipment: [], specials: [], advisors: [], troopMods: [], buildings: [] },
  });
  const ids = (query, locale) => searchLookupGroup(built, { group: "heroes", query, locale }).items.map((item) => item.id);
  // Gõ giản thể khớp bí danh; trùng hẳn tên Hán đứng đầu, khớp một phần xếp sau.
  assert.deepEqual(ids("关羽", "zh"), ["hero:quan-vu", "hero:sp-quan-vu"]);
  assert.deepEqual(ids("關", "zh"), ["hero:quan-binh", "hero:quan-vu", "hero:sp-quan-vu"]);
  assert.deepEqual(ids("关羽", "vi"), ["hero:sp-quan-vu", "hero:quan-vu"]);
  // Tên Việt vẫn tìm được ở bản zh, sau các mục khớp chữ Hán.
  assert.deepEqual(ids("quan vu", "zh"), ["hero:sp-quan-vu", "hero:quan-vu"]);
});

test("tìm không dấu coi đ/Đ là d/D", () => {
  const built = buildLookupCorpus({
    heroes: [
      { id: "hero:dieu-thuyen", viet: "Điêu Thuyền", chinese: "貂蟬" },
      { id: "hero:dong-trac", viet: "Đổng Trác", chinese: "董卓" },
    ],
    tactics: [{ id: "tactic:doat-hon", viet: "Đoạt Hồn Hiệp Đấu", chinese: "奪魂挾鬥" }],
    catalog: { equipment: [], specials: [], advisors: [], troopMods: [], buildings: [] },
  });
  const ids = (group, query) => searchLookupGroup(built, { group, query }).items.map((item) => item.id);
  assert.deepEqual(ids("heroes", "dieu thuyen"), ["hero:dieu-thuyen"]);
  assert.deepEqual(ids("heroes", "dong trac"), ["hero:dong-trac"]);
  assert.deepEqual(ids("heroes", "DIEU"), ["hero:dieu-thuyen"]);
  assert.deepEqual(ids("tactics", "hiep dau"), ["tactic:doat-hon"]);
  assert.deepEqual(ids("tactics", "doat hon"), ["tactic:doat-hon"]);
  assert.deepEqual(ids("heroes", "Điêu"), ["hero:dieu-thuyen"]);
});

test("chữ Hán chỉ là alias tìm kiếm cho mọi nhóm", () => {
  const built = corpus();
  const cases = [
    ["heroes", "劉備", "hero:luu-bi"],
    ["tactics", "仁德載世", "tactic:nhan-duc"],
    ["equipment", "倚天劍", "equipment:y-thien-kiem"],
    // Tên đặc kỹ gắn trang bị là khóa tìm phụ của trang bị đó.
    ["equipment", "奸雄", "equipment:y-thien-kiem"],
    ["advisors", "恩服兵心", "advisor:an-phuc-binh-tam"],
    ["troop-mods", "丹陽兵", "troop-mod:dan-duong-binh"],
    ["buildings", "八陣圖", "building:bat-tran-do"],
    ["books", "守而有道", "book:biet-cach-phong-thu"],
    // Tên nguồn phồn thể của binh thư (`sourceNames`) cũng là khóa tìm.
    ["books", "百戰", "book:bach-chien"],
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

test("deep link binh thư `?id=book:<slug>` mở đúng hồ sơ kèm hiệu ứng và phiên bản số liệu", () => {
  const route = parseLookupQuery("?id=book%3Abach-chien", "books");
  assert.equal(route.error, null);
  assert.equal(route.id, "book:bach-chien");
  assert.equal(parseLookupQuery("?id=book%3Abach-chien", "tactics").otherGroup, "books");
  const profile = lookupProfile(corpus(), route.id);
  assert.equal(profile.titleVi, "Bách Chiến");
  assert.deepEqual(profile.fields.map((field) => [field.key, field.textVi]), [
    ["effect", "Tỷ lệ phát động của chiến pháp tự mang tăng 3%."],
    ["effectVersion", "2021-11"],
  ]);
});

test("hồ sơ binh thư bản zh hiện hiệu ứng chữ Hán nguồn; binh thư chưa có hiệu ứng để trạng thái trống", () => {
  const previous = globalThis.document;
  globalThis.document = { documentElement: { lang: "zh-CN" } };
  try {
    const zh = lookupProfile(corpus(), "book:bach-chien");
    assert.deepEqual(zh.fields.map((field) => [field.key, field.textVi]), [
      ["effect", "自帶戰法的發動機率提高 3%"],
      ["effectVersion", "2021-11"],
    ]);
    assert.equal(zh.viOnly, false);
  } finally {
    globalThis.document = previous;
  }
  const bare = lookupProfile(corpus(), "book:biet-cach-phong-thu");
  assert.deepEqual(bare.fields.map((field) => [field.key, field.value]), [["effect", null]]);
});

test("corpus chỉ có payload đã tải: nhóm thiếu dữ liệu rỗng, quan hệ sang nhóm đó chưa giải được", () => {
  const heroesOnly = buildLookupCorpus({ heroes: HERO_POOL });
  assert.equal(heroesOnly.groups.heroes.length, HERO_POOL.length);
  for (const group of LOOKUP_GROUPS.filter((key) => key !== "heroes")) assert.deepEqual(heroesOnly.groups[group], [], group);
  const partial = lookupProfile(heroesOnly, "hero:luu-bi").relations.find((relation) => relation.key === "selfTactic");
  assert.equal(partial.resolved, false);
  const full = lookupProfile(buildLookupCorpus({ heroes: HERO_POOL, tactics: TACTIC_POOL, catalog: CATALOG }), "hero:luu-bi")
    .relations.find((relation) => relation.key === "selfTactic");
  assert.equal(full.resolved, true);
});

test("tên cũ của binh thư (bảng danh tính) tìm được và chỉ hiện trên hồ sơ bản zh", () => {
  // Mục danh tính chỉ có chữ Hán = tên cũ đã xác nhận; mục có kèm tên Việt chỉ là alias tìm kiếm.
  const books = [{ chinese: "新书", viet: "Sách Mới" }];
  const bookAliases = bookSourceAliases(books, [
    { kind: "book", aliases: ["舊書"], displayNameVi: "Sách Mới" },
    { kind: "book", aliases: ["Sách Mới", "新書", "新书"], displayNameVi: "Sách Mới" },
  ]);
  assert.deepEqual(bookAliases, { "book:sach-moi": { aliases: ["舊書", "新書"], formerNames: ["舊書"] } });
  const built = buildLookupCorpus({ heroes: [], tactics: [], catalog: { equipment: [], specials: [], advisors: [], troopMods: [], buildings: [] }, books, bookAliases });
  for (const query of ["舊書", "新書"]) {
    assert.equal(searchLookupGroup(built, { group: "books", query }).items[0]?.id, "book:sach-moi", query);
  }
  assert.equal(lookupProfile(built, "book:sach-moi").fields.some((field) => field.key === "formerNames"), false);
  const previous = globalThis.document;
  globalThis.document = { documentElement: { lang: "zh-CN" } };
  try {
    const former = lookupProfile(built, "book:sach-moi").fields.find((field) => field.key === "formerNames");
    assert.equal(former?.value, "舊書");
  } finally {
    globalThis.document = previous;
  }
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

test("hồ sơ chiến pháp nêu tướng mang nó làm chiến pháp tự có, theo cùng quy tắc với hồ sơ tướng", () => {
  const corpus = buildLookupCorpus({
    heroes: [
      hero("hero:luu-bi", "Lưu Bị", { lookup: { selfTacticId: "tactic:nhan-duc" } }),
      hero("hero:duy-nhat", "Duy Nhất", { selfTacticCn: "仁德載世" }),
      hero("hero:mo-ho", "Mơ Hồ", { selfTacticCn: "重名" }),
    ],
    tactics: TACTIC_POOL,
    catalog: CATALOG,
  });
  const holders = lookupProfile(corpus, "tactic:nhan-duc").relations.filter((r) => r.key.startsWith("innateHolder:"));
  assert.deepEqual(holders.map((r) => [r.targetId, r.titleVi, r.resolved, r.targetGroup]), [
    ["hero:duy-nhat", "Duy Nhất", true, "heroes"],
    ["hero:luu-bi", "Lưu Bị", true, "heroes"],
  ]);
  // Tên Hán trùng nhiều chiến pháp: hồ sơ tướng để chưa xác minh, nên chiều ngược cũng không gán.
  for (const id of ["tactic:trung-lap-a", "tactic:trung-lap-b"]) {
    for (const relation of lookupProfile(corpus, id).relations) assert.ok(!relation.key.startsWith("innateHolder:"));
  }
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
});

test("hồ sơ tướng có đánh giá giữ/rã thẻ và cách nhận theo gói, bản zh dùng chữ Hán nguồn", () => {
  const packs = [
    { packVi: "Danh tướng", packZh: "名將", categoryVi: "Gói Danh tướng", categoryZh: "名將卡包", isCore: true, coreRate: 0.34, nonCoreRate: 0.66 },
    { packVi: "Sưu tầm", packZh: "典藏卡包", categoryVi: "Gói Sưu tầm", categoryZh: "典藏卡包", isCore: false, coreRate: 0.36, nonCoreRate: 0.64 },
  ];
  const built = buildLookupCorpus({
    heroes: [
      hero("hero:sp-dien-vi", "SP Điển Vi", { lookup: { usageVi: "Có thể giữ 1 thẻ.", usageZh: "可留一個", cardPacks: packs } }),
      hero("hero:khong-goi", "Không Gói", { lookup: { usageVi: null, usageZh: null, cardPacks: [] } }),
    ],
    tactics: TACTIC_POOL,
    catalog: CATALOG,
  });
  const rows = (profile) => profile.sections.find((section) => section.key === "cardPacks")?.fields.map((field) => [field.labelVi, field.textVi]);

  const vi = lookupProfile(built, "hero:sp-dien-vi");
  assert.equal(fieldByKey(vi, "usage").labelVi, "Đánh giá");
  assert.equal(fieldByKey(vi, "usage").textVi, "Có thể giữ 1 thẻ.");
  assert.equal(vi.sections.find((section) => section.key === "cardPacks").titleVi, "Cách nhận");
  assert.deepEqual(rows(vi), [
    ["Gói Danh tướng · Danh tướng", "Tướng lõi · lõi 34% / thường 66%"],
    ["Gói Sưu tầm · Sưu tầm", "Thường · lõi 36% / thường 64%"],
  ]);

  const zh = asZhPage(() => lookupProfile(built, "hero:sp-dien-vi"));
  assert.equal(fieldByKey(zh, "usage").textVi, "可留一個");
  assert.deepEqual(rows(zh), [
    ["名將卡包 · 名將", "核心 · 核心 34% / 非核心 66%"],
    ["典藏卡包 · 典藏卡包", "非核心 · 核心 36% / 非核心 64%"],
  ]);

  const empty = lookupProfile(built, "hero:khong-goi");
  assert.equal(fieldByKey(empty, "usage"), undefined);
  assert.equal(rows(empty), undefined);
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

/* ---------- Phase 7: giao diện mới, nhãn tiếng Việt, khối "Trong cẩm nang" ---------- */

import { lookupCardView, lookupOrderNote, tacticTableRow, camNangView, POSITION_LABELS, lookupResultTrees } from "../js/unified-lookup.js";
import { h, treeToHtml } from "../js/view-tree.js";
import { portraitUrl, portraitChar } from "../js/hero-portrait.js";
import { parseHeroSummaries } from "../js/hero-summaries.js";

const HERO_UI = hero("hero:sp-lu-mong", "SP Lữ Mông", {
  chinese: "SP 呂蒙", aliases: ["SP吕蒙"], faction: "Ngô", stars: 5, roleTagViet: "Khống chế / Kiêm nhiệm",
  iconUrl: "http://image.aligames.com/a.png", cost: 7,
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
  assert.deepEqual(view.meta.map((part) => part.text), ["Ngô", "5 sao", "Thống ngự 7", "Khống chế / Kiêm nhiệm"]);
});

test("ghi chú thứ tự nguồn chỉ ẩn khi bản zh xếp lại kết quả tìm", () => {
  assert.equal(lookupOrderNote("", "vi"), "Thứ tự theo nguồn");
  assert.equal(lookupOrderNote("lu mong", "vi"), "Thứ tự theo nguồn");
  assert.equal(lookupOrderNote("", "zh"), "按来源顺序");
  assert.equal(lookupOrderNote("呂蒙", "zh"), null);
  assert.equal(lookupOrderNote("   ", "zh"), "按来源顺序");
});

test("bảng chiến pháp lấy phẩm, loại, dạng hiệu ứng, mục tiêu, tỷ lệ và để trống thành —", () => {
  const row = tacticTableRow(TACTIC_POOL.find((item) => item.id === "tactic:nhan-duc"));
  assert.equal(row.nameVi, "Nhân Đức Tải Thế");
  assert.equal(row.quality, "S");
  assert.equal(row.type, "Chủ động");
  assert.equal(row.effectType, "Tăng ích");
  assert.equal(row.target, "Quân ta");
  assert.equal(row.rate, "100%");

  assert.equal(tacticTableRow(TACTIC_POOL.find((item) => item.id === "tactic:cho-dich")).target, "—");
  assert.equal(tacticTableRow(tactic("tactic:thieu", "Thiếu Dữ Liệu", { lookup: { activationRate: null } })).rate, "—");
});

test("tỷ lệ kích hoạt là phần trăm; giá trị ngoài 0–1 không in số vô nghĩa", () => {
  const warned = [];
  const original = console.warn;
  console.warn = (message) => warned.push(String(message));
  try {
    const rate = (value) => tacticTableRow(tactic(`tactic:ti-le-${String(value).replace(/\W/g, "")}`, "Tỷ Lệ", { lookup: { activationRate: value } })).rate;
    assert.equal(rate(0.375), "37.5%");
    assert.equal(rate(0.55), "55%");
    // Dữ liệu sai khoảng (50 = 5000%) không được in ra: bảng hiện gạch ngang, hồ sơ cũng vậy.
    assert.equal(rate(50), "—");
    assert.equal(rate(-1), "—");
    const corpus = buildLookupCorpus({
      tactics: [
        tactic("tactic:ti-le-tron", "Tỷ Lệ Tròn", { lookup: { activationRate: 0.55 } }),
        tactic("tactic:ngoai-khoang", "Ngoài Khoảng", { lookup: { activationRate: 50 } }),
      ],
    });
    const field = lookupProfile(corpus, "tactic:ti-le-tron").fields.find((item) => item.key === "activationRate");
    assert.equal(field.labelVi, "Tỷ lệ kích hoạt");
    assert.equal(field.textVi, "55%");
    const shown = lookupProfile(corpus, "tactic:ngoai-khoang").fields.find((item) => item.key === "activationRate");
    assert.equal(shown.textVi, "—");
    assert.doesNotMatch(shown.textVi, /5000|50%/);
  } finally {
    console.warn = original;
  }
  assert.ok(warned.some((line) => line.includes("ngoài khoảng 0–1")), "tỷ lệ sai khoảng phải được cảnh báo cho dev");
});

/** Chạy `run` như trang `/zh/` (các hàm mặc định đọc ngôn ngữ từ `<html lang>`). */
function asZhPage(run) {
  const previous = globalThis.document;
  globalThis.document = { documentElement: { lang: "zh-Hans" } };
  try { return run(); } finally { globalThis.document = previous; }
}

async function publishedLookup() {
  const [heroes, tactics, catalog, books] = await Promise.all(
    ["heroes-dict", "tactics", "lookup-catalog", "books-dict"].map(async (name) => JSON.parse(await readFile(new URL(`../data/${name}.json`, import.meta.url), "utf8"))),
  );
  return { heroes, tactics, catalog, books };
}

test("hàng bảng chiến pháp và hồ sơ cùng một giá trị cho mọi chiến pháp đã công bố, cả hai ngôn ngữ", async () => {
  const data = await publishedLookup();
  const built = buildLookupCorpus(data);
  const cell = (profile, key, fallback = "—") => {
    const field = fieldByKey(profile, key);
    return !field || field.value === null || field.value === undefined || field.value === "" ? fallback : field.textVi;
  };
  for (const locale of ["vi", "zh"]) {
    const expected = (record) => {
      const profile = lookupProfile(built, record.id);
      return {
        nameVi: profile.titleVi, quality: cell(profile, "quality"), type: cell(profile, "type"),
        effectType: cell(profile, "effectTypeVi"), target: cell(profile, "target"), effect: cell(profile, "effect", ""),
        zhTranslated: locale === "zh" && record.lookup.effectZhSource?.kind === "translation",
        rate: cell(profile, "activationRate"),
      };
    };
    for (const record of data.tactics) {
      const want = locale === "zh" ? asZhPage(() => expected(record)) : expected(record);
      assert.deepEqual(tacticTableRow(record, locale), want, `${locale} ${record.id}`);
    }
  }
});

test("thẻ và hàng bảng dựng lúc build với locale tường minh khớp bản dựng trên trang cùng ngôn ngữ", async () => {
  const built = buildLookupCorpus(await publishedLookup());
  for (const group of LOOKUP_GROUPS) {
    const items = searchLookupGroup(built, { group, page: 1 }).items;
    assert.ok(items.length > 0, group);
    const onZhPage = asZhPage(() => treeToHtml(h("div", {}, lookupResultTrees(group, items))));
    assert.equal(treeToHtml(h("div", {}, lookupResultTrees(group, items, "zh"))), onZhPage, `zh ${group}`);
    assert.equal(treeToHtml(h("div", {}, lookupResultTrees(group, items, "vi"))), treeToHtml(h("div", {}, lookupResultTrees(group, items))), `vi ${group}`);
  }
});

test("thẻ bản zh hiện tên chữ Hán và nhãn Trung, không lọt chữ Việt của bộ giá trị đóng", () => {
  const entry = heroUiCorpus().byId.get("hero:sp-lu-mong");
  const view = lookupCardView("heroes", entry, "zh");
  assert.equal(view.title, "SP 呂蒙");
  assert.equal(view.faction, "吴");
  assert.equal(view.stars, "5 星");
  assert.deepEqual(view.meta.map((part) => part.text), ["吴", "5 星", "统御 7"]);
});

test("cách nhận của mọi chiến pháp đã công bố không lộ mã trích dẫn bsn", async () => {
  const [heroes, tactics, catalog] = await Promise.all(
    ["heroes-dict", "tactics", "lookup-catalog"].map(async (name) => JSON.parse(await readFile(new URL(`../data/${name}.json`, import.meta.url), "utf8"))),
  );
  const built = buildLookupCorpus({ heroes, tactics, catalog });
  let checked = 0;
  for (const row of tactics) {
    const field = fieldByKey(lookupProfile(built, row.id), "acquiredFromVi");
    if (!field) continue;
    checked += 1;
    assert.doesNotMatch(field.textVi, /bsn=\d+/, row.id);
  }
  assert.ok(checked > 0, "dữ liệu thật phải có chiến pháp mang cách nhận");
});

test("hiệu ứng nhiều phiên bản tách thành khối có nhãn, cả dạng ' / / ' lẫn dạng dòng trống", () => {
  assert.deepEqual(effectVersions("Cập nhật 2021-06-09 (cân bằng) / Giảm 12% / Hồi 63% / / Phiên bản gốc / Giảm 13%"), [
    { labelVi: "Cập nhật 2021-06-09 (cân bằng)", paragraphs: ["Giảm 12%", "Hồi 63%"] },
    { labelVi: "Phiên bản gốc", paragraphs: ["Giảm 13%"] },
  ]);
  // Phiên bản nối bằng một " / " đơn, và nhãn chữ Hán nguồn của bản zh.
  assert.deepEqual(effectVersions("Cập nhật 2024-09-11 (tăng cường) / Mới / Cập nhật 2024-03-20 (tăng cường) / Giữa / Phiên bản gốc / Cũ").map((block) => block.labelVi),
    ["Cập nhật 2024-09-11 (tăng cường)", "Cập nhật 2024-03-20 (tăng cường)", "Phiên bản gốc"]);
  assert.deepEqual(effectVersions("2021-06-09 更新（平衡） / 戰鬥前3回合 / / 原始版本 / 戰鬥前2回合"), [
    { labelVi: "2021-06-09 更新（平衡）", paragraphs: ["戰鬥前3回合"] },
    { labelVi: "原始版本", paragraphs: ["戰鬥前2回合"] },
  ]);
  assert.deepEqual(effectVersions("Cập nhật ngày 2020-04-01: Đánh thêm.\n\nCập nhật 2019-01-01 (tăng cường)\nĐánh.\nGhi chú: X"), [
    { labelVi: "Cập nhật ngày 2020-04-01", paragraphs: ["Đánh thêm."] },
    { labelVi: "Cập nhật 2019-01-01 (tăng cường)", paragraphs: ["Đánh.", "Ghi chú: X"] },
  ]);
  // Chữ thường: " / " nghĩa là "hoặc" nên giữ nguyên; đoạn cách dòng trống là đoạn tiếp, không phải phiên bản.
  assert.deepEqual(effectVersions("Dùng khi công thành / đánh khí giới.\n\nĐoạn hai."), [
    { labelVi: null, paragraphs: ["Dùng khi công thành / đánh khí giới.", "Đoạn hai."] },
  ]);
  assert.deepEqual(effectVersions(null), []);
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
  assert.deepEqual(view.positions.map((row) => [row.label, row.count]), [["Phó tướng 2", 42], ["Phó tướng 1", 11], ["Chủ tướng", 2]]);
  assert.equal(view.positions[0].percent, 100);
  assert.equal(view.positions[2].percent, 5);
  assert.deepEqual(POSITION_LABELS(), ["Chủ tướng", "Phó tướng 1", "Phó tướng 2"]);
  assert.deepEqual(view.representative.map((team) => team.positionLabel), ["Phó tướng 2", "Chủ tướng"]);
  assert.equal(camNangView(null), null);
});

test("ô chân dung nâng https, từ chối scheme lạ và lấy chữ Hán đầu tên", () => {
  assert.equal(portraitUrl("http://image.aligames.com/a.png"), "https://image.aligames.com/a.png");
  assert.equal(portraitUrl("https://cloud.lingxigames.com/a.png"), "https://cloud.lingxigames.com/a.png");
  assert.equal(portraitUrl("javascript:alert(1)"), null);
  assert.equal(portraitUrl("image.aligames.com/a.png"), null);
  assert.equal(portraitUrl(null), null);
  assert.equal(portraitUrl("/heroes/tao-ngang.webp"), "/heroes/tao-ngang.webp");
  for (const rejected of ["//evil.example/heroes/a.webp", "/heroes/A.webp", "/heroes/a.png", "/heroes/a/b.webp", "/heroes/.webp", "/other/a.webp", "heroes/a.webp", "/heroes/a.webp?x=1", "/heroes/a.webp\n", "/heroes/../a.webp", "/\\evil.example/a.webp"]) {
    assert.equal(portraitUrl(rejected), null, rejected);
  }
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

test("?id= của chiến pháp đã gộp chuyển sang hồ sơ của mã còn sống; mã sống hoặc lạ không chuyển", () => {
  const corpus = buildLookupCorpus({
    tactics: [
      tactic("tactic:si-tranh-tien-pho", "Sĩ Tranh Tiên Phô", { lookup: { formerIds: ["tactic:nhanh-chan-tranh-dat"] } }),
      tactic("tactic:khac", "Khác"),
    ],
  });
  const route = parseLookupQuery("?id=tactic%3Anhanh-chan-tranh-dat", "tactics");
  assert.equal(route.error, null);
  assert.equal(retiredLookupRedirect(corpus, route.id), "/tra-cuu/chien-phap/?id=tactic%3Asi-tranh-tien-pho");
  assert.equal(retiredLookupRedirect(corpus, "tactic:si-tranh-tien-pho"), null);
  assert.equal(retiredLookupRedirect(corpus, "tactic:khong-ton-tai"), null);
});
