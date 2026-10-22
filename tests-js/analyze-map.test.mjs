// TDD js/analyze-map.js — map Hán->Việt, khớp 3 trạng thái cho editor, diff từng ô + đối chiếu team.
import { createBookNameIndex } from "../js/lookup-ids.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  statFocusVn,
  mapRead,
  mapTeamRead,
  findSimilarTeams,
  classifyName,
  createEntityIndex,
  draftFromRead,
  draftReady,
  confirmedTeam,
  cellFromInput,
  emptyCell,
  diffTeam,
  compareTeams,
  normalizeTeamRead,
  readStats,
  sureCell,
} from "../js/analyze-map.js";

const HEROES = [
  { chinese: "曹操", viet: "Tào Tháo", iconUrl: "https://cdn/tao.png" },
  { chinese: "关羽", viet: "Quan Vũ" },
  { chinese: "张飞", viet: "Trương Phi" },
];
const BOOKS = [
  { id: "book:giap-sat", chinese: "铁甲", viet: "Giáp Sắt" },
  { id: "book:phong-bi", chinese: "防备", viet: "Phòng Bị" },
  { id: "book:tam-quan-chi-chung", chinese: "三军之众", viet: "Tam Quân Chi Chúng" },
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


/* ---------- Khớp 3 trạng thái (editor Soi đội) ---------- */

// Từ điển như dữ liệu thật: `chinese` Phồn thể, `aliases` mang bản Giản thể mà Worker chép từ ảnh.
const EDITOR_HEROES = [
  { chinese: "曹操", viet: "Tào Tháo" },
  { chinese: "關羽", aliases: ["关羽"], viet: "Quan Vũ" },
  { chinese: "張飛", aliases: ["张飞"], viet: "Trương Phi" },
  { chinese: "劉備", aliases: ["刘备"], viet: "Lưu Bị" },
  { chinese: "荀彧", viet: "Tuân Úc" },
  { chinese: "荀攸", viet: "Tuân Du" },
];
const INDEXES = {
  heroes: createEntityIndex(EDITOR_HEROES, "hero"),
  tactics: createEntityIndex(TACTICS, "tactic"),
  books: createEntityIndex(BOOKS, "book"),
};

test("classifyName: tên Giản thể in trong ảnh khớp chắc qua alias dù dict ghi Phồn thể", () => {
  assert.deepEqual(classifyName("关羽", INDEXES.heroes), { state: "sure", raw: "关羽", id: "hero:quan-vu", candidates: [] });
  // Gõ tên Việt không dấu cũng khớp chắc.
  assert.equal(classifyName("truong phi", INDEXES.heroes).id, "hero:truong-phi");
});

test("classifyName: chữ chỉ gần giống -> không chắc, kèm vài ứng viên gần nhất", () => {
  const cell = classifyName("荀", INDEXES.heroes);
  assert.equal(cell.state, "unsure");
  assert.equal(cell.id, null);
  assert.deepEqual([...cell.candidates].sort(), ["hero:tuan-du", "hero:tuan-uc"]);
  assert.ok(classifyName("荀", INDEXES.heroes, { candidateLimit: 1 }).candidates.length === 1);
});

test("classifyName: 未知, rỗng hoặc không có ứng viên -> không rõ", () => {
  for (const raw of ["未知", "", "   ", "完全无关"]) {
    const cell = classifyName(raw, INDEXES.heroes);
    assert.equal(cell.state, "unknown", raw);
    assert.deepEqual(cell.candidates, []);
  }
});

test("classifyName: chữ Hán trùng hai ID khác nhau không bao giờ là khớp chắc", () => {
  const index = createEntityIndex([
    { chinese: "曹操", viet: "Tào Tháo A" },
    { chinese: "曹操", viet: "Tào Tháo B" },
  ], "hero");
  assert.equal(classifyName("曹操", index).state, "unsure");
});

test("draftFromRead: chiến pháp giữ đúng ô A/B; ô 未知 là không rõ; binh thư lấy binh thư chính", () => {
  const draft = draftFromRead({
    heroes: [
      { nameCn: "曹操", tacticsCn: ["未知", "魅惑"], booksCn: ["铁甲", "防备"], statFocusCn: "" },
      { nameCn: "关羽", tacticsCn: ["三军之众", "夺魂挟魄"], booksCn: [], statFocusCn: "" },
    ],
  }, INDEXES);
  const [first, second, third] = draft.heroes;
  assert.deepEqual(first.tactics.map((cell) => [cell.state, cell.id]), [["unknown", null], ["sure", "tactic:me-hoac"]]);
  assert.deepEqual([first.book.state, first.book.id], ["sure", "book:giap-sat"]);
  // Binh thư lọt vào ô chiến pháp không được map thành chiến pháp.
  assert.equal(second.tactics[0].state, "unknown");
  assert.equal(second.book.state, "empty");
  // Ảnh chỉ có 2 cột: tướng thứ 3 chưa chọn.
  assert.equal(third.hero.state, "empty");
});

test("draftFromRead: màn chiến báo 3 dòng — bỏ chiến pháp tự mang theo dữ liệu tướng, không lấy chiến pháp làm binh thư", () => {
  // Dữ liệu tướng mang `selfTacticCn` (Phồn thể như từ điển thật); Worker chép Giản thể.
  const tactics = [
    ...TACTICS,
    { chinese: "燕人咆哮", aliases: ["燕人咆哮"], viet: "Yến Nhân Bào Hao" },
    { chinese: "國士將風", aliases: ["国士将风"], viet: "Quốc Sĩ Tướng Phong" },
    { chinese: "禦敵屏障", aliases: ["御敌屏障"], viet: "Ngự Địch Bình Chướng" },
    { chinese: "盛氣凌敵", aliases: ["盛气凌敌"], viet: "Thịnh Khí Lăng Địch" },
    { chinese: "疾風驟雨", aliases: ["疾风骤雨"], viet: "Tật Phong Sậu Vũ" },
    { chinese: "精·青州兵", aliases: ["精·青州兵"], viet: "Lính Thanh Châu" },
  ];
  const indexes = {
    heroes: createEntityIndex([
      { chinese: "張飛", aliases: ["张飞"], viet: "Trương Phi", selfTacticCn: "燕人咆哮" },
      { chinese: "凌統", aliases: ["凌统"], viet: "Lăng Thống", selfTacticCn: "國士將風" },
    ], "hero"),
    tactics: createEntityIndex(tactics, "tactic"),
    books: createEntityIndex(BOOKS, "book"),
  };
  const ids = (hero) => [hero.tactics.map((cell) => cell.id), hero.book.state];

  // Prompt mới: đủ 3 dòng theo thứ tự in, không binh thư.
  const rows = draftFromRead({ heroes: [
    { nameCn: "凌统", tacticsCn: ["国士将风", "御敌屏障", "盛气凌敌"], booksCn: [], statFocusCn: "" },
    { nameCn: "张飞", tacticsCn: ["燕人咆哮", "精·青州兵", "疾风骤雨"], booksCn: [], statFocusCn: "" },
  ] }, indexes);
  assert.deepEqual(ids(rows.heroes[0]), [["tactic:ngu-dich-binh-chuong", "tactic:thinh-khi-lang-dich"], "empty"]);
  assert.deepEqual(ids(rows.heroes[1]), [["tactic:linh-thanh-chau", "tactic:tat-phong-sau-vu"], "empty"]);

  // Output sai thường gặp: dòng tự mang chiếm ô A, dòng 3 bị xếp vào binh thư.
  const misread = draftFromRead({ heroes: [
    { nameCn: "张飞", tacticsCn: ["燕人咆哮", "精·青州兵"], booksCn: ["疾风骤雨"], statFocusCn: "" },
  ] }, indexes);
  assert.deepEqual(ids(misread.heroes[0]), [["tactic:linh-thanh-chau", "tactic:tat-phong-sau-vu"], "empty"]);

  // Tướng chưa rõ mà có 3 dòng: game luôn in chiến pháp tự mang đầu tiên -> bỏ dòng đầu.
  const unknownHero = draftFromRead({ heroes: [
    { nameCn: "未知", tacticsCn: ["国士将风", "御敌屏障", "盛气凌敌"], booksCn: [], statFocusCn: "" },
  ] }, indexes);
  assert.deepEqual(unknownHero.heroes[0].tactics.map((cell) => cell.id), ["tactic:ngu-dich-binh-chuong", "tactic:thinh-khi-lang-dich"]);

  // Ảnh đội hình chỉ có 2 ô đã học (không in tự mang): giữ nguyên A/B.
  const formation = draftFromRead({ heroes: [
    { nameCn: "张飞", tacticsCn: ["精·青州兵", "疾风骤雨"], booksCn: [], statFocusCn: "" },
  ] }, indexes);
  assert.deepEqual(formation.heroes[0].tactics.map((cell) => cell.id), ["tactic:linh-thanh-chau", "tactic:tat-phong-sau-vu"]);
});

test("draftReady/confirmedTeam: đủ 3 tướng chắc; chiến pháp/binh thư chắc hoặc để trống có chủ đích", () => {
  const draft = draftFromRead({
    heroes: [
      { nameCn: "曹操", tacticsCn: ["未知", "魅惑"], booksCn: ["铁甲"], statFocusCn: "" },
      { nameCn: "关羽", tacticsCn: ["夺魂挟魄", "未知"], booksCn: [], statFocusCn: "" },
      { nameCn: "荀", tacticsCn: ["未知", "未知"], booksCn: [], statFocusCn: "" },
    ],
  }, INDEXES);
  assert.equal(draftReady(draft), false);
  assert.equal(confirmedTeam(draft), null);
  // Người dùng xoá trống các ô không rõ: vẫn khoá vì tướng 3 còn "không chắc".
  draft.heroes[0].tactics[0] = emptyCell();
  draft.heroes[1].tactics[1] = emptyCell();
  draft.heroes[2].tactics = [emptyCell(), emptyCell()];
  assert.equal(draftReady(draft), false);
  // Chọn đúng nhãn trong danh sách -> chắc.
  draft.heroes[2].hero = cellFromInput("Tuân Úc", INDEXES.heroes, new Map([["Tuân Úc", "hero:tuan-uc"]]));
  assert.equal(draftReady(draft), true);
  assert.deepEqual(confirmedTeam(draft), {
    heroes: [
      { hero: "hero:tao-thao", tactics: [null, "tactic:me-hoac"], book: "book:giap-sat" },
      { hero: "hero:quan-vu", tactics: ["tactic:doat-hon-hiep-phach", null], book: null },
      { hero: "hero:tuan-uc", tactics: [null, null], book: null },
    ],
  });
  // Xoá trống ô tướng -> khoá lại.
  draft.heroes[1].hero = cellFromInput("", INDEXES.heroes, new Map());
  assert.equal(draftReady(draft), false);
});

/* ---------- Diff từng ô ---------- */

const bookIdOf = createBookNameIndex(BOOKS);

const TEAM = {
  heroes: [
    { hero: "hero:tao-thao", tactics: ["tactic:me-hoac", "tactic:nhanh-tri-dong-nao"], book: "book:giap-sat" },
    { hero: "hero:quan-vu", tactics: [null, "tactic:doat-hon-hiep-phach"], book: null },
    { hero: "hero:truong-phi", tactics: [null, null], book: null },
  ],
};
// Bản ghi Đội chuẩn (index.json): tên Việt theo ô, binh thư chính ở `bookSlotsVi[0]`.
const STANDARD = {
  sourceConfigId: "team-std",
  heroes: [
    { displayNameVi: "Tào Tháo", nameRaw: "曹操", tacticSlotsVi: ["Mê Hoặc", "Thần Cơ Diệu Toán"], tacticSlotsRaw: ["魅惑", "神機妙算"], bookSlotsVi: ["Giáp Sắt", null, null], bookSlotsRaw: ["鐵甲", "", ""] },
    { displayNameVi: "Quan Vũ", nameRaw: "關羽", tacticSlotsVi: ["Đoạt Hồn Hiệp Phách", "Đương Phong Thôi Quyết"], tacticSlotsRaw: ["", ""], bookSlotsVi: [null, null, null], bookSlotsRaw: ["", "", ""] },
    { displayNameVi: "Lưu Bị", nameRaw: "劉備", tacticSlotsVi: ["Thời Cơ Chiến Thắng", null], tacticSlotsRaw: ["", ""], bookSlotsVi: ["Phòng Bị", null, null], bookSlotsRaw: ["", "", ""] },
  ],
};
// Bản ghi Đội khác (other-teams.json): nội dung cũ mang `alternatives`.
const OTHER = {
  legacyTeamId: "team-old",
  legacyContent: {
    heroes: [
      { name: "Tào Tháo", tactics: [{ name: "Thiêu Đốt Doanh Lũy", alternatives: ["Mê Hoặc"] }], books: [{ name: "Phòng Bị", alternatives: [] }] },
      { name: "Quan Vũ", tactics: [], books: [{ name: "Giáp Sắt", alternatives: [] }] },
      { name: "Trương Phi", tactics: [], books: [] },
    ],
  },
};

test("diffTeam: tướng khớp/thừa/thiếu, chiến pháp đúng/sai/thiếu theo từng tướng, binh thư đúng", () => {
  const diff = diffTeam(TEAM, STANDARD, null, bookIdOf);
  assert.equal(diff.heroHit, 2);
  assert.equal(diff.heroTotal, 3);
  assert.equal(diff.tacticHit, 2);
  assert.equal(diff.tacticTotal, 5);
  const [cao, quan, truong] = diff.heroes;
  assert.deepEqual(cao.tactics.map((cell) => cell.status), ["match", "wrong"]);
  assert.deepEqual(cao.missingTactics.map((entry) => entry.name), ["Thần Cơ Diệu Toán"]);
  assert.equal(cao.book.status, "match");
  assert.deepEqual(quan.tactics.map((cell) => cell.status), ["empty", "match"]);
  assert.deepEqual(quan.missingTactics.map((entry) => entry.name), ["Đương Phong Thôi Quyết"]);
  assert.equal(quan.book.status, "none"); // đội không ghi binh thư -> không tính lệch
  assert.equal(truong.status, "extra");
  assert.deepEqual(truong.tactics.map((cell) => cell.status), ["empty", "empty"]);
  assert.deepEqual(diff.missingHeroes.map((hero) => [hero.id, hero.name, hero.raw]), [["hero:luu-bi", "Lưu Bị", "劉備"]]);
  assert.equal(diff.bookDiff, 0);
});

test("diffTeam: chiến pháp trong alternatives tính là đúng; binh thư lệch/thiếu được đếm", () => {
  const diff = diffTeam(TEAM, OTHER, null, bookIdOf);
  assert.equal(diff.heroHit, 3);
  const [cao, quan, truong] = diff.heroes;
  assert.deepEqual(cao.tactics.map((cell) => cell.status), ["match", "wrong"]);
  assert.deepEqual(cao.missingTactics, []);
  assert.deepEqual([cao.book.status, cao.book.expected.name], ["mismatch", "Phòng Bị"]);
  assert.deepEqual([quan.book.status, quan.book.expected.name], ["missing", "Giáp Sắt"]);
  assert.deepEqual(quan.tactics.map((cell) => cell.status), ["empty", "wrong"]);
  assert.equal(truong.book.status, "none");
  assert.equal(diff.bookDiff, 2);
  assert.deepEqual(diff.missingHeroes, []);
});

test("diffTeam: đội tham chiếu lưu tên sách cũ, người dùng có sách id cố định -> match (đổi tên không làm lệch)", () => {
  const renamed = [
    { id: "book:giap-sat", chinese: "铁甲", viet: "Giáp Thép", aliases: ["Giáp Sắt"] },
    { id: "book:phong-bi", chinese: "防备", viet: "Phòng Bị" },
  ];
  const renamedIdOf = createBookNameIndex(renamed);
  // STANDARD ghi "Giáp Sắt" (tên cũ); người dùng chọn sách theo id cố định.
  const diff = diffTeam(TEAM, STANDARD, null, renamedIdOf);
  assert.equal(diff.heroes[0].book.status, "match");
  assert.equal(diff.bookDiff, 0);
  // Không có bộ tra sách thì không suy id từ slug tên: ô sách của đội tham chiếu không bao giờ khớp nhầm.
  assert.equal(diffTeam(TEAM, STANDARD).heroes[0].book.status, "mismatch");
  // Cache theo (tacticIdOf, bookIdOf): đổi bộ tra sách trên cùng bản ghi phải tính lại.
  assert.equal(diffTeam(TEAM, STANDARD, null, createBookNameIndex([])).heroes[0].book.status, "mismatch");
  assert.equal(diffTeam(TEAM, STANDARD, null, renamedIdOf).heroes[0].book.status, "match");
});

test("mapRead: binh thư matched mang canonicalId book: cố định, không phải tactic:<slug>", () => {
  const r = mapRead({ nameCn: "曹操", tacticsCn: [], booksCn: ["铁甲"], statFocusCn: "" }, DICTS);
  assert.equal(r.books[0].canonicalId, "book:giap-sat");
});

test("createEntityIndex binh thư: id lấy từ bản ghi, dòng thiếu id bị bỏ, đổi tên không đổi id", () => {
  const index = createEntityIndex([{ id: "book:giap-sat", chinese: "铁甲", viet: "Giáp Thép" }, { chinese: "无", viet: "Không Id" }], "book");
  assert.deepEqual([...index.byId.keys()], ["book:giap-sat"]);
  assert.equal(classifyName("铁甲", index).id, "book:giap-sat");
});

test("diffTeam: hoà số tướng thì ghép tướng vào ô có nhiều chiến pháp khớp hơn", () => {
  const team = { heroes: [{ hero: "hero:tao-thao", tactics: ["tactic:me-hoac", null], book: null }] };
  const record = {
    heroes: [
      { name: "Tào Tháo/Lưu Bị", tactics: [] },
      { name: "Tào Tháo", tactics: [{ name: "Mê Hoặc" }] },
    ],
  };
  const diff = diffTeam(team, record, null, bookIdOf);
  assert.equal(diff.heroes[0].slotIndex, 1);
  assert.equal(diff.tacticHit, 1);
});

test("compareTeams: xếp theo số tướng khớp rồi chiến pháp khớp, hoà giữ thứ tự nguồn, lọc ngưỡng", () => {
  const record = (id, heroes) => ({ sourceConfigId: id, heroes: heroes.map(([name, tactics = []]) => ({ displayNameVi: name, tacticSlotsVi: tactics, bookSlotsVi: [] })) });
  const records = [
    record("hai-tuong", [["Tào Tháo"], ["Quan Vũ"], ["Lưu Bị"]]),
    record("hai-tuong-co-chien-phap", [["Tào Tháo", ["Mê Hoặc"]], ["Quan Vũ"], ["Lưu Bị"]]),
    record("ba-tuong", [["Tào Tháo"], ["Quan Vũ"], ["Trương Phi"]]),
    record("mot-tuong", [["Tào Tháo", ["Mê Hoặc"]], ["Lưu Bị"], ["Tuân Úc"]]),
    record("hai-tuong-sau", [["Tào Tháo"], ["Trương Phi"], ["Lưu Bị"]]),
  ];
  const ranked = compareTeams(TEAM, records, { minHeroes: 2, limit: 5, bookIdOf });
  assert.deepEqual(ranked.map(({ record: item }) => item.sourceConfigId), ["ba-tuong", "hai-tuong-co-chien-phap", "hai-tuong", "hai-tuong-sau"]);
  assert.equal(compareTeams(TEAM, records, { minHeroes: 2, limit: 2, bookIdOf }).length, 2);
});

/* ---------- 2 phe + tín hiệu lỗi ---------- */

const H = (nameCn) => ({ nameCn, tacticsCn: [], booksCn: [], statFocusCn: "" });

test("normalizeTeamRead: dạng C1 giữ 2 phe, left trước right", () => {
  const read = normalizeTeamRead({
    screen: "battleReport",
    sides: [{ side: "right", heroes: [H("关羽")] }, { side: "left", heroes: [H("曹操")] }],
  });
  assert.equal(read.screen, "battleReport");
  assert.deepEqual(read.sides.map((s) => s.side), ["left", "right"]);
  assert.equal(read.sides[0].heroes[0].nameCn, "曹操");
});

test("normalizeTeamRead: side thiếu/trùng, screen lạ, >2 phe được chịu lỗi", () => {
  const read = normalizeTeamRead({
    screen: "???",
    sides: [{ heroes: [H("曹操")] }, { side: "left", heroes: [H("关羽")] }, { heroes: [H("张飞")] }],
  });
  assert.equal(read.screen, "other");
  assert.deepEqual(read.sides.map((s) => [s.side, s.heroes[0].nameCn]), [["left", "曹操"]]);
});

test("normalizeTeamRead: dạng cũ {heroes} thành 1 phe left", () => {
  assert.deepEqual(normalizeTeamRead({ heroes: [H("曹操")] }), { screen: "other", sides: [{ side: "left", heroes: [H("曹操")] }] });
});

test("normalizeTeamRead: dữ liệu hỏng -> null", () => {
  for (const bad of [null, [], "x", {}, { heroes: [] }, { heroes: ["x"] }, { sides: [] }, { sides: [{ side: "left", heroes: [] }] }, { sides: [null] }, { sides: [{ heroes: "x" }] }]) {
    assert.equal(normalizeTeamRead(bad), null, JSON.stringify(bad));
  }
});

const cellsOf = (...specs) => {
  const draft = { heroes: Array.from({ length: 3 }, () => ({ hero: emptyCell(), tactics: [emptyCell(), emptyCell()], book: emptyCell() })) };
  specs.forEach(([hero, cell, key, slot]) => {
    if (key === "tactic") draft.heroes[hero].tactics[slot] = cell;
    else draft.heroes[hero][key] = cell;
  });
  return draft;
};
const unsure = { state: "unsure", raw: "曹", id: null, candidates: ["hero:cao-cao"] };

test("readStats: ô chắc giữ nguyên -> không có ô sửa", () => {
  const draft = cellsOf([0, sureCell("hero:a"), "hero"], [0, sureCell("tactic:x"), "tactic", 0]);
  assert.deepEqual(readStats(draft, structuredClone(draft)), { read: 2, edited: 0, unclear: 0 });
});

test("readStats: ô chắc bị đổi hoặc bị xoá tính là đã sửa", () => {
  const initial = cellsOf([0, sureCell("hero:a"), "hero"], [0, sureCell("tactic:x"), "tactic", 0]);
  const final = cellsOf([0, sureCell("hero:b"), "hero"]);
  assert.deepEqual(readStats(initial, final), { read: 2, edited: 2, unclear: 0 });
});

test("readStats: ô không chắc được chọn ứng viên = đã sửa + không rõ; bỏ trống thì chỉ không rõ", () => {
  const initial = cellsOf([0, unsure, "hero"], [1, { state: "unknown", raw: "未知", id: null, candidates: [] }, "book"]);
  const final = cellsOf([0, sureCell("hero:cao-cao"), "hero"]);
  assert.deepEqual(readStats(initial, final), { read: 2, edited: 1, unclear: 2 });
});

test("readStats: ô AI để trống không tính, kể cả khi người dùng tự điền (ô tướng thiếu, binh thư màn chiến báo)", () => {
  assert.deepEqual(readStats(cellsOf(), cellsOf()), { read: 0, edited: 0, unclear: 0 });
  const initial = cellsOf([0, sureCell("hero:a"), "hero"]);
  const final = cellsOf([0, sureCell("hero:a"), "hero"], [1, sureCell("hero:b"), "hero"], [2, sureCell("book:z"), "book"]);
  assert.deepEqual(readStats(initial, final), { read: 1, edited: 0, unclear: 0 });
});
