import { test } from "node:test";
import assert from "node:assert/strict";
import { mapBuiltTeamsScan, mapHeroesScan, mapTacticsScan } from "../js/roster-scan-map.js";

const heroesDict = [
  { chinese: "马超", viet: "Mã Siêu" },
  { chinese: "程普", viet: "Trình Phổ" },
];
const tacticsDict = [
  { chinese: "当锋摧决", viet: "Đương Phong Thôi Quyết" },
  { chinese: "抚辑军民", viet: "An Ủi Quân Dân" },
];
const dicts = { heroesDict, tacticsDict };

test("mapHeroesScan maps Chinese hero names to canonical Vietnamese", () => {
  const result = mapHeroesScan({ heroes: [{ nameCn: "马超", redStars: 4, level: 50 }] }, dicts);

  assert.deepEqual(result.heroes, [{ name: "Mã Siêu", confidence: "high", redStars: 4, level: 50 }]);
});

test("mapTacticsScan maps tactic names", () => {
  const result = mapTacticsScan({ tactics: [{ nameCn: "当锋摧决" }] }, dicts);

  assert.deepEqual(result.tactics, [{ name: "Đương Phong Thôi Quyết", confidence: "high" }]);
});

test("mapBuiltTeamsScan maps locked team heroes and tactics", () => {
  const result = mapBuiltTeamsScan({
    teams: [{ teamName: "Đội cũ", heroesCn: ["程普"], tacticsCn: ["抚辑军民"] }],
  }, dicts);

  assert.deepEqual(result.teams, [{ teamName: "Đội cũ", heroes: ["Trình Phổ"], tactics: ["An Ủi Quân Dân"] }]);
});
