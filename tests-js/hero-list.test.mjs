import { test } from "node:test";
import assert from "node:assert/strict";
import { filterHeroes } from "../js/hero-list.js";

function hero(over) {
  return {
    chinese: "x", hanViet: "X", faction: "Ngụy", stars: 5,
    troopApt: { ky: "S", thuan: "B", cung: "B", thuong: "B", khiGioi: "B" },
    roleTagViet: "Phụ trợ",
    ...over,
  };
}

const POOL = [
  hero({ chinese: "a", faction: "Ngụy", stars: 5, roleTagViet: "Phụ trợ", troopApt: { ky: "S", thuan: "B", cung: "B", thuong: "B", khiGioi: "B" } }),
  hero({ chinese: "b", faction: "Thục", stars: 4, roleTagViet: "Vũ lực", troopApt: { ky: "B", thuan: "B", cung: "A", thuong: "B", khiGioi: "B" } }),
  hero({ chinese: "c", faction: "Ngụy", stars: 5, roleTagViet: "Vũ lực", troopApt: { ky: "A", thuan: "S", cung: "B", thuong: "B", khiGioi: "B" } }),
];

test("không lọc -> trả hết", () => {
  assert.equal(filterHeroes(POOL, {}).length, 3);
});

test("lọc phe (OR trong nhóm)", () => {
  const r = filterHeroes(POOL, { factions: new Set(["Ngụy"]) });
  assert.deepEqual(r.map((h) => h.chinese), ["a", "c"]);
});

test("lọc sao", () => {
  const r = filterHeroes(POOL, { stars: new Set(["4"]) });
  assert.deepEqual(r.map((h) => h.chinese), ["b"]);
});

test("lọc vai trò", () => {
  const r = filterHeroes(POOL, { roles: new Set(["Vũ lực"]) });
  assert.deepEqual(r.map((h) => h.chinese), ["b", "c"]);
});

test("lọc thích tính binh chủng (S/A) — kỵ", () => {
  // ky apt: a=S, b=B, c=A -> a,c đạt S/A.
  const r = filterHeroes(POOL, { troops: new Set(["ky"]) });
  assert.deepEqual(r.map((h) => h.chinese), ["a", "c"]);
});

test("nhiều troop OR; AND giữa các nhóm", () => {
  // troop cung(A: b) OR thuan(S: c) = b,c; AND phe Ngụy -> c.
  const r = filterHeroes(POOL, { troops: new Set(["cung", "thuan"]), factions: new Set(["Ngụy"]) });
  assert.deepEqual(r.map((h) => h.chinese), ["c"]);
});
