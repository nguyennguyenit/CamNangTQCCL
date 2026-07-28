import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mapBuiltTeamsScan,
  mapBuiltTeamsScanRich,
  mapHeroesScan,
  mapHeroesScanRich,
  mapTacticsScan,
  mapTacticsScanRich,
} from "../js/roster-scan-map.js";

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

test("rich mapper giữ evidence, runner-up và image ordinal", () => {
  const ambiguousHeroes = [
    { chinese: "马超", viet: "SP Mã Siêu", linkScore: 0.91 },
    { chinese: "马超", viet: "Mã Siêu", linkScore: 0.9 },
  ];
  const result = mapHeroesScanRich(
    {
      heroes: [
        {
          nameCn: "马超",
          redStars: 4,
          imageOrdinal: 2,
          fieldPresence: ["nameCn", "redStars"],
        },
      ],
    },
    {
      heroesDict: ambiguousHeroes,
      observationBatchId: "batch-1",
      sourceScope: "currentTurnImage",
    },
  );
  const [hero] = result.heroes;

  assert.equal(hero.rawChinese, "马超");
  assert.equal(hero.normalizedText, "sp ma sieu");
  assert.equal(hero.canonicalId, "hero:sp-ma-sieu");
  assert.equal(hero.secondScore, 1);
  assert.equal(hero.margin, 0);
  assert.equal(hero.reviewRequired, true);
  assert.equal(hero.dictionaryLinkScore, 0.91);
  assert.equal(hero.imageOrdinal, 2);
  assert.deepEqual(hero.evidence, {
    batchId: "batch-1",
    sourceScope: "currentTurnImage",
    trust: "untrusted",
    imageOrdinal: 2,
    fieldPresence: ["nameCn", "redStars"],
  });
});

test("rich tactic và built-team mapper giữ holder thay vì làm phẳng evidence", () => {
  const tactic = mapTacticsScanRich(
    { tactics: [{ nameCn: "当锋摧决", imageOrdinal: 1 }] },
    { tacticsDict, observationBatchId: "batch-2", sourceScope: "currentTurnImage" },
  );
  const built = mapBuiltTeamsScanRich(
    {
      teams: [
        {
          teamName: "Đội cũ",
          heroes: [
            {
              nameCn: "程普",
              tacticsCn: ["抚辑军民"],
              imageOrdinal: 3,
            },
          ],
        },
      ],
    },
    { ...dicts, observationBatchId: "batch-3", sourceScope: "priorConfirmedNote" },
  );

  assert.equal(tactic.tactics[0].canonicalId, "tactic:duong-phong-thoi-quyet");
  assert.equal(built.teams[0].heroSlots[0].hero.canonicalId, "hero:trinh-pho");
  assert.equal(
    built.teams[0].heroSlots[0].tactics[0].canonicalId,
    "tactic:an-ui-quan-dan",
  );
  assert.equal(built.teams[0].heroSlots[0].imageOrdinal, 3);
});
