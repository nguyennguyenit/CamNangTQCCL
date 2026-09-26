// TDD js/analyze-map.js — map 3 trục Hán->Việt + đối chiếu team.
import { test } from "node:test";
import assert from "node:assert/strict";
import { statFocusVn, mapRead, mapTeamRead, findSimilarTeams } from "../js/analyze-map.js";

const HEROES = [
  { chinese: "曹操", viet: "Tào Tháo", iconUrl: "https://cdn/tao.png" },
  { chinese: "关羽", viet: "Quan Vũ" },
  { chinese: "张飞", viet: "Trương Phi" },
];
const BOOKS = [
  { chinese: "铁甲", viet: "Giáp Sắt" },
  { chinese: "防备", viet: "Phòng Bị" },
  { chinese: "三军之众", viet: "Tam Quân Chi Chúng" },
];
const TACTICS = [
  { chinese: "魅惑", viet: "Mê Hoặc" },
  { chinese: "神机妙算", viet: "Thần Cơ Diệu Toán" },
  { chinese: "夺魂挟魄", viet: "Đoạt Hồn Hiệp Phách" },
  { chinese: "当锋摧决", viet: "Đương Phong Thôi Quyết" },
  { chinese: "焚辎营垒", viet: "Thiêu Đốt Doanh Lũy" },
  { chinese: "灵机一动", viet: "Nhanh Trí Động Não" },
  { chinese: "临机制胜", viet: "Thời Cơ Chiến Thắng" },
];
const DICTS = { heroesDict: HEROES, tacticsDict: TACTICS, booksDict: BOOKS };

test("statFocusVn: đơn + tiền tố Toàn", () => {
  assert.equal(statFocusVn("智力"), "Trí");
  assert.equal(statFocusVn("全智力"), "Toàn Trí");
  assert.equal(statFocusVn(""), "");
});

test("mapRead: Hán exact -> canonical Việt + sure", () => {
  const r = mapRead({ nameCn: "曹操", tacticsCn: ["魅惑"], statFocusCn: "全武力" }, DICTS);
  assert.equal(r.hero.viet, "Tào Tháo");
  assert.equal(r.hero.sure, true);
  assert.equal(r.tactics[0].viet, "Mê Hoặc");
  assert.equal(r.statFocus, "Toàn Lực");
});

test("mapRead: tên lạ -> giữ Hán + cờ không chắc", () => {
  const r = mapRead({ nameCn: "陌生武将", tacticsCn: [], statFocusCn: "" }, DICTS);
  assert.equal(r.hero.sure, false);
  assert.equal(r.hero.viet, "Mạch Sinh Võ Tướng"); // không khớp -> phiên Hán-Việt (không giữ Hán)
});

test("mapRead: tướng không thấy tên rõ -> hiển thị Chưa rõ", () => {
  const r = mapRead({ nameCn: "未知", tacticsCn: [], statFocusCn: "" }, DICTS);
  assert.equal(r.hero.sure, false);
  assert.equal(r.hero.viet, "Chưa rõ");
});

test("mapRead: OCR sai 1 ký tự -> fuzzy về đúng", () => {
  const r = mapRead({ nameCn: "神机刀算", tacticsCn: [], statFocusCn: "" }, { heroesDict: TACTICS, tacticsDict: TACTICS });
  assert.equal(r.hero.viet, "Thần Cơ Diệu Toán");
});

test("mapRead: chỉ giữ chiến pháp, bỏ binh thư/talent đọc nhầm", () => {
  const r = mapRead(
    { nameCn: "曹操", tacticsCn: ["夺魂", "当锋", "荧薙", "灵机", "三军之众", "统军", "铁甲"], statFocusCn: "" },
    DICTS,
  );
  assert.deepEqual(
    r.tactics.map((t) => t.viet),
    ["Đoạt Hồn Hiệp Phách", "Đương Phong Thôi Quyết", "Thiêu Đốt Doanh Lũy", "Nhanh Trí Động Não"],
  );
});

test("mapRead: map binh thư booksCn -> tên Việt canonical", () => {
  const r = mapRead({ nameCn: "曹操", tacticsCn: [], booksCn: ["铁甲", "防备"], statFocusCn: "" }, DICTS);
  assert.deepEqual(r.books.map((b) => b.viet), ["Giáp Sắt", "Phòng Bị"]);
  assert.equal(r.books[0].sure, true);
});

test("mapRead: binh thư lạ -> phiên Hán-Việt + cờ không chắc", () => {
  const r = mapRead({ nameCn: "曹操", tacticsCn: [], booksCn: ["未知兵书"], statFocusCn: "" }, DICTS);
  assert.equal(r.books[0].matched, false);
  assert.equal(r.books[0].viet, "Vị Tri Binh Thư"); // không khớp -> phiên Hán-Việt
});

test("mapRead: thiếu booksCn -> books rỗng (backward-compat)", () => {
  const r = mapRead({ nameCn: "曹操", tacticsCn: [], statFocusCn: "" }, DICTS);
  assert.deepEqual(r.books, []);
});

test("mapRead: gắn iconUrl của tướng khi khớp dict", () => {
  const r = mapRead({ nameCn: "曹操", tacticsCn: [], statFocusCn: "" }, DICTS);
  assert.equal(r.hero.icon, "https://cdn/tao.png");
});

test("mapRead: nameFromPortrait -> ép sure=false dù khớp", () => {
  const r = mapRead({ nameCn: "曹操", tacticsCn: [], statFocusCn: "", nameFromPortrait: true }, DICTS);
  assert.equal(r.hero.matched, true);
  assert.equal(r.hero.sure, false); // đoán từ chân dung -> luôn cờ kiểm tra
});

test("mapRead: ambiguity không được báo sure dù top match có confidence cao", () => {
  const ambiguousHeroes = [
    { viet: "Tào Tháo A", chinese: "曹操" },
    { viet: "Tào Tháo B", chinese: "曹操" },
  ];
  const r = mapRead(
    { nameCn: "曹操", tacticsCn: [], statFocusCn: "" },
    { ...DICTS, heroesDict: ambiguousHeroes },
  );

  assert.equal(r.hero.reviewRequired, true);
  assert.equal(r.hero.sure, false);
  assert.deepEqual(
    findSimilarTeams(
      [r],
      [{ id: "ambiguous-team", heroes: [{ name: "Tào Tháo A", tactics: [] }] }],
      { minHeroes: 1 },
    ),
    [],
  );
});

test("findSimilarTeams: binh thư KHÔNG đổi điểm (giữ nguyên)", () => {
  const teams = [{ heroes: [{ baseName: "Tào Tháo", tactics: [] }, { baseName: "Quan Vũ", tactics: [] }] }];
  const withBooks = mapTeamRead(
    [{ nameCn: "曹操", tacticsCn: [], booksCn: ["铁甲"], statFocusCn: "" }, { nameCn: "关羽", tacticsCn: [], booksCn: ["防备"], statFocusCn: "" }],
    DICTS,
  );
  const noBooks = mapTeamRead(
    [{ nameCn: "曹操", tacticsCn: [], statFocusCn: "" }, { nameCn: "关羽", tacticsCn: [], statFocusCn: "" }],
    DICTS,
  );
  const a = findSimilarTeams(withBooks, teams, { minHeroes: 2 });
  const b = findSimilarTeams(noBooks, teams, { minHeroes: 2 });
  assert.equal(a[0].heroHit, b[0].heroHit);
  assert.equal(a[0].tacticHit, b[0].tacticHit);
});

test("findSimilarTeams: đếm tướng trùng, lọc ngưỡng", () => {
  const teams = [
    { heroes: [{ baseName: "Tào Tháo", tactics: [] }, { baseName: "Quan Vũ", tactics: [] }, { baseName: "Trương Phi", tactics: [] }] },
    { heroes: [{ baseName: "Lưu Bị", tactics: [] }, { baseName: "Triệu Vân", tactics: [] }, { baseName: "Tào Tháo", tactics: [] }] },
  ];
  const mapped = mapTeamRead(
    [{ nameCn: "曹操", tacticsCn: [], statFocusCn: "" }, { nameCn: "关羽", tacticsCn: [], statFocusCn: "" }, { nameCn: "张飞", tacticsCn: [], statFocusCn: "" }],
    DICTS,
  );
  const res = findSimilarTeams(mapped, teams, { minHeroes: 2 });
  assert.equal(res.length, 1); // chỉ team 1 đạt ≥2 (thực ra 3/3)
  assert.equal(res[0].heroHit, 3);
  assert.equal(res[0].total, 3);
});

test("[M1] tướng Hán không khớp KHÔNG vào mẫu số total", () => {
  const teams = [{ heroes: [{ baseName: "Tào Tháo", tactics: [] }, { baseName: "Quan Vũ", tactics: [] }] }];
  const mapped = mapTeamRead(
    [
      { nameCn: "曹操", tacticsCn: [], statFocusCn: "" },
      { nameCn: "关羽", tacticsCn: [], statFocusCn: "" },
      { nameCn: "陌生武将", tacticsCn: [], statFocusCn: "" }, // không khớp dict
    ],
    DICTS,
  );
  const res = findSimilarTeams(mapped, teams, { minHeroes: 2 });
  assert.equal(res[0].total, 2); // chỉ 2 tướng nhận diện được, không phải 3
  assert.equal(res[0].heroHit, 2);
});

test("findSimilarTeams: tie-break theo chiến pháp trùng", () => {
  const teams = [
    { heroes: [{ baseName: "Tào Tháo", tactics: [] }, { baseName: "Quan Vũ", tactics: [] }] },
    { heroes: [{ baseName: "Tào Tháo", tactics: [{ name: "Mê Hoặc", alternatives: [] }] }, { baseName: "Quan Vũ", tactics: [] }] },
  ];
  const mapped = mapTeamRead(
    [{ nameCn: "曹操", tacticsCn: ["魅惑"], statFocusCn: "" }, { nameCn: "关羽", tacticsCn: [], statFocusCn: "" }],
    DICTS,
  );
  const res = findSimilarTeams(mapped, teams, { minHeroes: 2 });
  assert.equal(res[0].tacticHit, 1); // team có chiến pháp trùng xếp trên
});

test("findSimilarTeams phân biệt SP với base theo canonical ID", () => {
  const heroes = [
    { chinese: "荀彧", viet: "SP Tuân Úc" },
    { chinese: "曹操", viet: "Tào Tháo" },
  ];
  const mapped = mapTeamRead(
    [
      { nameCn: "荀彧", tacticsCn: [], statFocusCn: "" },
      { nameCn: "曹操", tacticsCn: [], statFocusCn: "" },
    ],
    { heroesDict: heroes, tacticsDict: [], booksDict: [] },
  );
  const teams = [
    {
      id: "base",
      heroes: [
        { name: "Tuân Úc", baseName: "Tuân Úc", tactics: [] },
        { name: "Tào Tháo", baseName: "Tào Tháo", tactics: [] },
      ],
    },
    {
      id: "sp",
      heroes: [
        { name: "SP Tuân Úc", baseName: "Tuân Úc", isSP: true, tactics: [] },
        { name: "Tào Tháo", baseName: "Tào Tháo", tactics: [] },
      ],
    },
  ];

  const result = findSimilarTeams(mapped, teams, { minHeroes: 2 });
  assert.deepEqual(result.map(({ team }) => team.id), ["sp"]);
});

test("một combined slot không được tính thành hai hero hits", () => {
  const mapped = [
    { hero: { matched: true, canonicalId: "hero:a" }, tactics: [] },
    { hero: { matched: true, canonicalId: "hero:b" }, tactics: [] },
  ];
  const teams = [
    {
      id: "combined",
      heroes: [{ name: "A/B", tactics: [] }],
    },
  ];

  assert.deepEqual(findSimilarTeams(mapped, teams, { minHeroes: 2 }), []);
});

test("findSimilarTeams chỉ tính tactic khi đúng holder và tie theo team ID", () => {
  const mapped = mapTeamRead(
    [
      { nameCn: "曹操", tacticsCn: ["魅惑"], statFocusCn: "" },
      { nameCn: "关羽", tacticsCn: [], statFocusCn: "" },
    ],
    DICTS,
  );
  const teams = [
    {
      id: "team-z-wrong-holder",
      heroes: [
        { name: "Tào Tháo", baseName: "Tào Tháo", tactics: [] },
        { name: "Quan Vũ", baseName: "Quan Vũ", tactics: [{ name: "Mê Hoặc" }] },
      ],
    },
    {
      id: "team-b-right-holder",
      heroes: [
        { name: "Tào Tháo", baseName: "Tào Tháo", tactics: [{ name: "Mê Hoặc" }] },
        { name: "Quan Vũ", baseName: "Quan Vũ", tactics: [] },
      ],
    },
    {
      id: "team-a-right-holder",
      heroes: [
        { name: "Tào Tháo", baseName: "Tào Tháo", tactics: [{ name: "Mê Hoặc" }] },
        { name: "Quan Vũ", baseName: "Quan Vũ", tactics: [] },
      ],
    },
  ];

  const result = findSimilarTeams(mapped, teams, { minHeroes: 2 });
  assert.deepEqual(
    result.map(({ team, tacticHit }) => [team.id, tacticHit]),
    [
      ["team-a-right-holder", 1],
      ["team-b-right-holder", 1],
      ["team-z-wrong-holder", 0],
    ],
  );
});

test("findSimilarTeams: tướng đoán từ chân dung không tính là khớp nhưng vẫn vào mẫu số", () => {
  const teams = [{ id: "ba-tuong", heroes: [{ baseName: "Tào Tháo", tactics: [] }, { baseName: "Quan Vũ", tactics: [] }, { baseName: "Trương Phi", tactics: [] }] }];
  const mapped = mapTeamRead(
    [
      { nameCn: "曹操", tacticsCn: [], statFocusCn: "" },
      { nameCn: "关羽", tacticsCn: [], statFocusCn: "" },
      { nameCn: "张飞", tacticsCn: [], statFocusCn: "", nameFromPortrait: true },
    ],
    DICTS,
  );
  const res = findSimilarTeams(mapped, teams, { minHeroes: 2 });
  assert.equal(res.length, 1);
  assert.equal(res[0].heroHit, 2);
  assert.equal(res[0].total, 3);
});
