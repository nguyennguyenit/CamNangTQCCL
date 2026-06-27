import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHeroFactionIndex, dominantFaction, assignDerivedFactions } from "../js/derive-team-faction.js";

const heroesDict = [
  { viet: "Tuân Úc", hanViet: "Tuân Úc", chinese: "荀彧", faction: "Ngụy" },
  { viet: "Trương Liêu", hanViet: "Trương Liêu", chinese: "张辽", faction: "Ngụy" },
  { viet: "Lưu Bị", hanViet: "Lưu Bị", chinese: "刘备", faction: "Thục" },
  { viet: "Tôn Quyền", hanViet: "Tôn Quyền", chinese: "孙权", faction: "Ngô" },
  { viet: "Không Phe", faction: null },
];

test("index map gồm viet/hanViet/chinese, bỏ tướng không phe", () => {
  const idx = buildHeroFactionIndex(heroesDict);
  assert.equal(idx.get("Tuân Úc"), "Ngụy");
  assert.equal(idx.get("张辽"), "Ngụy");
  assert.equal(idx.has("Không Phe"), false);
});

test("đa số quá bán -> phe đó", () => {
  const idx = buildHeroFactionIndex(heroesDict);
  const team = { heroes: [{ baseName: "Tuân Úc" }, { baseName: "Trương Liêu" }, { baseName: "Lưu Bị" }] };
  assert.equal(dominantFaction(team, idx), "Ngụy");
});

test("không quá bán (mỗi tướng 1 phe) -> Hỗn hợp", () => {
  const idx = buildHeroFactionIndex(heroesDict);
  const team = { heroes: [{ baseName: "Tuân Úc" }, { baseName: "Lưu Bị" }, { baseName: "Tôn Quyền" }] };
  assert.equal(dominantFaction(team, idx), "Hỗn hợp");
});

test("không khớp tướng nào -> null", () => {
  const idx = buildHeroFactionIndex(heroesDict);
  assert.equal(dominantFaction({ heroes: [{ baseName: "Vô Danh" }] }, idx), null);
});

test("assignDerivedFactions chỉ gán cho team chưa có phe", () => {
  const teams = [
    { faction: "Quần", heroes: [{ baseName: "Tuân Úc" }, { baseName: "Trương Liêu" }] },
    { heroes: [{ baseName: "Tuân Úc" }, { baseName: "Trương Liêu" }] },
  ];
  assignDerivedFactions(teams, heroesDict);
  assert.equal(teams[0].faction, "Quần"); // giữ nguyên
  assert.equal(teams[1].faction, "Ngụy"); // suy ra
});
