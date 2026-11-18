import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

/* ---------- Bản ja: ảnh client Nhật in tên Nhật, kho vẫn lưu tên Việt chuẩn ---------- */

const readData = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const realHeroes = readData("data/heroes-dict.json");
const realTactics = readData("data/tactics.json");
const jaEntries = readData("data/lookup-ja.json").entries;
const vietOf = (dict, id) => dict.find((record) => record.id === id).viet;

test("ja: tên Nhật trong ảnh kho khớp đúng tướng/chiến pháp qua lớp lookup-ja", () => {
  const real = { heroesDict: realHeroes, tacticsDict: realTactics, jaEntries };
  const heroes = mapHeroesScan({ heroes: [{ nameCn: "SP荀彧" }, { nameCn: "SP 荀彧" }] }, real).heroes;
  assert.deepEqual(heroes.map((hero) => [hero.name, hero.confidence]), [
    [vietOf(realHeroes, "hero:sp-tuan-uc"), "high"],
    [vietOf(realHeroes, "hero:sp-tuan-uc"), "high"],
  ]);
  const tactics = mapTacticsScan({ tactics: ["国の柱石", "霊機一動", "経天緯地"].map((nameCn) => ({ nameCn })) }, real).tactics;
  assert.deepEqual(tactics.map((tactic) => [tactic.name, tactic.confidence]), [
    [vietOf(realTactics, "tactic:quoc-chi-trinh-can"), "high"],
    [vietOf(realTactics, "tactic:nhanh-tri-dong-nao"), "high"],
    [vietOf(realTactics, "tactic:kinh-thien-vi-dia"), "high"],
  ]);
  // Model chép lệch một chữ (気 thay 機) vẫn về đúng chiến pháp, chỉ hạ độ tin.
  const [ocr] = mapTacticsScan({ tactics: [{ nameCn: "霊気一動" }] }, real).tactics;
  assert.equal(ocr.name, vietOf(realTactics, "tactic:nhanh-tri-dong-nao"));
  const built = mapBuiltTeamsScan({ teams: [{ teamName: "部隊1", heroesCn: ["SP荀彧"], tacticsCn: ["国の柱石", "霊機一動"] }] }, real).teams;
  assert.deepEqual(built, [{
    teamName: "部隊1",
    heroes: [vietOf(realHeroes, "hero:sp-tuan-uc")],
    tactics: [vietOf(realTactics, "tactic:quoc-chi-trinh-can"), vietOf(realTactics, "tactic:nhanh-tri-dong-nao")],
  }]);
});

test("ja: tên Nhật khớp chính xác thắng chữ Hán nguồn của bản ghi khác", () => {
  // Bản Nhật gọi 固若金湯 là 金城湯池, còn 金城湯池 bản Trung là một chiến pháp khác (bản Nhật gọi 湯池鉄城).
  const real = { heroesDict: realHeroes, tacticsDict: realTactics, jaEntries };
  const tactics = mapTacticsScan({ tactics: [{ nameCn: "金城湯池" }, { nameCn: "湯池鉄城" }] }, real).tactics;
  assert.deepEqual(tactics.map((tactic) => [tactic.name, tactic.confidence]), [
    [vietOf(realTactics, "tactic:co-nhuoc-kim-thang"), "high"],
    [vietOf(realTactics, "tactic:kim-thanh-thang-tri"), "high"],
  ]);
  const [rich] = mapTacticsScanRich({ tactics: [{ nameCn: "金城湯池" }] }, real).tactics;
  assert.equal(rich.canonicalId, "tactic:co-nhuoc-kim-thang");
  assert.equal(rich.reviewRequired, false);
});

test("vi/zh: không có jaEntries thì kết quả khớp giữ nguyên như trước", () => {
  const plain = { heroesDict: realHeroes, tacticsDict: realTactics };
  const tactics = mapTacticsScan({ tactics: ["金城湯池", "經天緯地", "経天緯地"].map((nameCn) => ({ nameCn })) }, plain).tactics;
  assert.deepEqual(tactics.map((tactic) => [tactic.name, tactic.confidence]), [
    [vietOf(realTactics, "tactic:kim-thanh-thang-tri"), "high"],
    [vietOf(realTactics, "tactic:kinh-thien-vi-dia"), "high"],
    // Bản vi/zh không xét bí danh (giữ hành vi cũ): tự dạng Nhật chỉ khớp mờ theo `chinese`.
    [vietOf(realTactics, "tactic:kinh-thien-vi-dia"), "low"],
  ]);
  assert.deepEqual(mapHeroesScan({ heroes: [{ nameCn: "SP荀彧" }] }, plain).heroes, [{ name: vietOf(realHeroes, "hero:sp-tuan-uc"), confidence: "high" }]);
  // jaEntries rỗng/null giữ nguyên hành vi bản vi/zh.
  assert.deepEqual(mapTacticsScan({ tactics: [{ nameCn: "経天緯地" }] }, { ...plain, jaEntries: null }).tactics, [tactics[2]]);
});
