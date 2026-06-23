// TDD js/analyze-map.js — map 3 trục Hán->Việt + đối chiếu team.
import { test } from "node:test";
import assert from "node:assert/strict";
import { statFocusVn, mapRead, mapTeamRead, findSimilarTeams } from "../js/analyze-map.js";

const HEROES = [
  { chinese: "曹操", viet: "Tào Tháo" },
  { chinese: "关羽", viet: "Quan Vũ" },
  { chinese: "张飞", viet: "Trương Phi" },
];
const TACTICS = [
  { chinese: "魅惑", viet: "Mê Hoặc" },
  { chinese: "神机妙算", viet: "Thần Cơ Diệu Toán" },
  { chinese: "夺魂挟魄", viet: "Đoạt Hồn Hiệp Phách" },
  { chinese: "当锋摧决", viet: "Đương Phong Thôi Quyết" },
  { chinese: "焚辎营垒", viet: "Thiêu Đốt Doanh Lũy" },
  { chinese: "临机制胜", viet: "Thời Cơ Chiến Thắng" },
];
const DICTS = { heroesDict: HEROES, tacticsDict: TACTICS };

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
  assert.equal(r.hero.viet, "陌生武将"); // giữ Hán khi không khớp
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
    ["Đoạt Hồn Hiệp Phách", "Đương Phong Thôi Quyết", "Thiêu Đốt Doanh Lũy", "Thời Cơ Chiến Thắng"],
  );
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
