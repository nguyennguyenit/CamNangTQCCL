import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyTacticOverrides,
  buildSeasonCandidates,
  recommendRoster,
  seasonTacticUsage,
  analyzeTacticSubstitutes,
} from "../js/roster-season-candidates.js";
import { canonicalTacticId, recommendTeams } from "../js/team-recommend-engine.js";
import { canonicalHeroId } from "../js/hero-identity.js";

const heroesDict = [
  { chinese: "SP 皇甫嵩", aliases: ["SP皇甫嵩"], viet: "SP Hoàng Phủ Tung" },
  { chinese: "曹操", aliases: [], viet: "Tào Tháo" },
  { chinese: "陸遜", aliases: ["陆逊"], viet: "Lục Tốn" },
  { chinese: "SP 貂蟬", aliases: ["SP貂蝉"], viet: "SP Điêu Thuyền" },
];
const tacticsDict = [
  { chinese: "勠力同心", aliases: [], viet: "Đồng Lòng Hợp Sức" },
  { chinese: "合軍聚眾", aliases: ["合军聚众"], viet: "Hợp Quân Tụ Chúng" },
  { chinese: "焚輜營壘", aliases: [], viet: "Thiêu Đốt Doanh Lũy" },
  { chinese: "萬軍奪帥", aliases: [], viet: "Vạn Quân Đoạt Soái" },
];

function hero(nameRaw, displayNameVi, tacticSlotsRaw, kinds = ["tactic", "tactic"]) {
  return { nameRaw, displayNameVi, tacticSlotsRaw, tacticSlotKinds: kinds, tacticSlotsVi: [] };
}

function record(id, overrides = {}) {
  return {
    sourceConfigId: id,
    displayNameVi: `Đội ${id}`,
    sourceSeasonId: "pk-s28",
    sourceCategoryId: "交戰",
    tierRaw: "T0",
    heroes: [
      hero("SP貂蟬", "SP Điêu Thuyền", ["勠力同心", "合軍聚眾"]),
      hero("陸遜", "Lục Tốn", ["焚輜營壘", "萬軍奪帥"]),
      hero("SP皇甫嵩", "SP Hoàng Phổ Tung", ["—", ""]),
    ],
    ...overrides,
  };
}

test("raw source names map to the canonical Vietnamese names the roster scan stores", () => {
  const { teams } = buildSeasonCandidates([record("a")], "pk-s28", { heroesDict, tacticsDict });
  assert.equal(teams.length, 1);
  const names = teams[0].heroes.map((h) => h.name);
  // displayNameVi viết "Phổ" nhưng kho lưu tên từ điển "Phủ": ánh xạ phải theo tên gốc.
  assert.deepEqual(names, ["SP Điêu Thuyền", "Lục Tốn", "SP Hoàng Phủ Tung"]);
  assert.equal(canonicalHeroId(names[2]), canonicalHeroId("SP Hoàng Phủ Tung"));
  assert.deepEqual(teams[0].heroes[0].tactics.map((t) => t.name), ["Đồng Lòng Hợp Sức", "Hợp Quân Tụ Chúng"]);
});

test("only the selected season's battle configs become candidates, with their source tier", () => {
  const records = [
    record("a"),
    record("b", { sourceSeasonId: "pk-s27" }),
    record("c", { sourceCategoryId: "開荒" }),
    record("d", { tierRaw: null }),
  ];
  const { teams, teamTier } = buildSeasonCandidates(records, "pk-s28", { heroesDict, tacticsDict });
  assert.deepEqual(teams.map((t) => t.id), ["a", "d"]);
  assert.deepEqual(teamTier, [
    { teamId: "a", rankings: [{ tier: "T0" }] },
    { teamId: "d", rankings: [] },
  ]);
  assert.equal(teams[0].source, "season");
  assert.equal(teams[0].seasonId, "pk-s28");
});

test("a config whose hero cannot be identified is excluded and reported", () => {
  const broken = record("x", { heroes: [...record("x").heroes.slice(0, 2), hero("周劭", "Chu Thiệu", ["勠力同心", ""])] });
  const { teams, diagnostics } = buildSeasonCandidates([broken, record("a")], "pk-s28", { heroesDict, tacticsDict });
  assert.deepEqual(teams.map((t) => t.id), ["a"]);
  assert.deepEqual(diagnostics, { total: 2, mapped: 1, unmapped: [{ configId: "x", reason: "hero-unmapped", names: ["周劭"] }] });
});

test("empty and bond slots are conditional; an unknown tactic slot is kept with its Vietnamese fallback name", () => {
  const rec = record("a", {
    heroes: [
      hero("SP貂蟬", "SP Điêu Thuyền", ["勠力同心", "桃園結義"], ["tactic", "bond"]),
      { ...hero("陸遜", "Lục Tốn", ["焚輜營壘", "御敵屏障"]), tacticSlotsVi: ["Thiêu Đốt Doanh Lũy", "Ngự Địch Bình Chướng"] },
      hero("曹操", "Tào Tháo", ["—", ""]),
    ],
  });
  const { teams } = buildSeasonCandidates([rec], "pk-s28", { heroesDict, tacticsDict });
  assert.deepEqual(teams[0].heroes.map((h) => h.tactics.map((t) => t.name)), [["Đồng Lòng Hợp Sức"], ["Thiêu Đốt Doanh Lũy", "Ngự Địch Bình Chướng"], []]);
  assert.deepEqual(teams[0].heroes[1].tactics[1], { name: "Ngự Địch Bình Chướng", alternatives: [], unresolved: true, raw: "御敵屏障" });
  assert.deepEqual(teams[0].conditionalTactics, [{ heroIndex: 0, slotIndex: 1, raw: "桃園結義" }]);
  const entry = recommendTeams({
    teams,
    teamTier: [{ teamId: "a", rankings: [{ tier: "T0" }] }],
    ownedHeroes: ["SP Điêu Thuyền", "Lục Tốn", "Tào Tháo"],
    ownedTactics: ["Đồng Lòng Hợp Sức", "Thiêu Đốt Doanh Lũy"],
  }).portfolioTeams[0];
  assert.equal(entry.team.id, "a");
  // Còn ô chưa đối chiếu: không bao giờ là "xây ngay".
  assert.equal(entry.status, "unreconciled");
  assert.deepEqual(entry.unresolvedTactics, ["Ngự Địch Bình Chướng"]);
});

test("a slot unknown to the dictionary falls back to the raw text when the source has no Vietnamese name", () => {
  const rec = record("a", { heroes: [hero("SP貂蟬", "SP Điêu Thuyền", ["勠力同心", "御敵屏障"]), ...record("a").heroes.slice(1)] });
  const { teams } = buildSeasonCandidates([rec], "pk-s28", { heroesDict, tacticsDict });
  assert.equal(teams[0].heroes[0].tactics[1].name, "御敵屏障");
  assert.equal(teams[0].heroes[0].tactics[1].unresolved, true);
});

test("season teams carry their unit types from unitTypesRaw; missing means unknown, never guessed", () => {
  const { teams } = buildSeasonCandidates([
    record("ky", { unitTypesRaw: ["騎"] }),
    record("two", { unitTypesRaw: ["弓", "盾"] }),
    record("none", { unitTypesRaw: [] }),
    record("absent"),
  ], "pk-s28", { heroesDict, tacticsDict });
  assert.deepEqual(teams.map((t) => t.unitType), [["Kỵ"], ["Cung", "Khiên"], [], []]);
  assert.deepEqual(teams.map((t) => t.unitTypesRaw), [["騎"], ["弓", "盾"], [], []]);
});

test("season tactic usage counts what each hero carries across the season's configs", () => {
  const other = record("b", {
    heroes: [
      hero("SP貂蟬", "SP Điêu Thuyền", ["勠力同心", "萬軍奪帥"]),
      hero("陸遜", "Lục Tốn", ["焚輜營壘", "合軍聚眾"]),
      hero("曹操", "Tào Tháo", ["", ""]),
    ],
  });
  const { teams } = buildSeasonCandidates([record("a"), other], "pk-s28", { heroesDict, tacticsDict });
  const usage = seasonTacticUsage(teams);
  const diaochan = usage.get(canonicalHeroId("SP Điêu Thuyền"));
  assert.deepEqual([...diaochan], [["Đồng Lòng Hợp Sức", 2], ["Hợp Quân Tụ Chúng", 1], ["Vạn Quân Đoạt Soái", 1]]);
});

test("the pinned Recommended generation maps at least 98% of battle configs", () => {
  const read = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
  const { generationId } = read("src/data/recommended-reference/current.json");
  const { records } = read(`src/data/recommended-reference/${generationId}/index.json`);
  const dicts = { heroesDict: read("data/heroes-dict.json"), tacticsDict: read("data/tactics.json") };
  let total = 0;
  let mapped = 0;
  for (const seasonId of new Set(records.map((r) => r.sourceSeasonId))) {
    const { diagnostics } = buildSeasonCandidates(records, seasonId, dicts);
    total += diagnostics.total;
    mapped += diagnostics.mapped;
  }
  assert.ok(total > 1000, `expected the full catalogue, got ${total}`);
  assert.ok(mapped / total >= 0.98, `mapped ${mapped}/${total}`);
});

const oneHeroTeam = (id, heroName, tactic, extra = {}) => ({
  id, name: id, heroes: [{ name: heroName, tactics: [{ name: tactic, alternatives: [] }] }], ...extra,
});
const tiers = (ids, tier = "T0") => ids.map((teamId) => ({ teamId, rankings: [{ tier }] }));

test("legacy teams only fill the slots the season leaves, after every season team", () => {
  const seasonTeams = [oneHeroTeam("s1", "Tướng A", "CP 1"), oneHeroTeam("s2", "Tướng B", "CP 2")];
  const legacyTeams = [
    oneHeroTeam("l1", "Tướng A", "CP 9"), // trùng tướng đội mùa đã chọn
    oneHeroTeam("l2", "Tướng C", "CP 2"), // trùng chiến pháp đội mùa đã chọn
    oneHeroTeam("l3", "Tướng D", "CP 4"),
    oneHeroTeam("l4", "Tướng E", "CP 5"),
  ];
  const result = recommendRoster({
    seasonTeams, seasonTier: tiers(["s1", "s2"]),
    legacyTeams, legacyTier: tiers(["l1", "l2", "l3", "l4"]),
    ownedHeroes: ["Tướng A", "Tướng B", "Tướng C", "Tướng D", "Tướng E"],
    ownedTactics: ["CP 1", "CP 2", "CP 4", "CP 5", "CP 9"],
    maxTeams: 3,
  });
  assert.deepEqual(result.portfolioTeams.map((e) => [e.team.id, e.source]), [["s1", "team"], ["s2", "team"], ["l3", "legacy"]]);
  assert.equal(result.legacyUsed, true);
});

test("a legacy team with the same three heroes as a season team that was not chosen may be suggested", () => {
  const season = { id: "s1", name: "S", heroes: [{ name: "Tướng A", tactics: [{ name: "CP 1", alternatives: [] }] }, { name: "Tướng B", tactics: [] }] };
  const legacy = { id: "l1", name: "L", heroes: [{ name: "Tướng B", tactics: [] }, { name: "Tướng A", tactics: [{ name: "CP 7", alternatives: [] }] }] };
  const result = recommendRoster({
    seasonTeams: [season], seasonTier: tiers(["s1"]),
    legacyTeams: [legacy], legacyTier: tiers(["l1"]),
    ownedHeroes: ["Tướng A", "Tướng B"], ownedTactics: ["CP 7"],
  });
  // Đội mùa s1 thiếu CP 1 nên không được chọn: đội cũ cùng bộ tướng dùng CP 7 xây được.
  assert.deepEqual(result.portfolioTeams.map((e) => [e.team.id, e.source]), [["l1", "legacy"]]);
  assert.deepEqual(result.blockedStrongTeams.map((b) => b.team.id), ["s1"]);
  assert.equal(result.legacyUsed, true);
});

test("a legacy team with the same three heroes as a CHOSEN season team is never suggested", () => {
  const season = { id: "s1", name: "S", heroes: [{ name: "Tướng A", tactics: [{ name: "CP 1", alternatives: [] }] }, { name: "Tướng B", tactics: [] }] };
  const legacy = { id: "l1", name: "L", heroes: [{ name: "Tướng B", tactics: [] }, { name: "Tướng A", tactics: [{ name: "CP 7", alternatives: [] }] }] };
  const result = recommendRoster({
    seasonTeams: [season], seasonTier: tiers(["s1"]),
    legacyTeams: [legacy], legacyTier: tiers(["l1"]),
    ownedHeroes: ["Tướng A", "Tướng B"], ownedTactics: ["CP 1", "CP 7"],
  });
  assert.deepEqual(result.portfolioTeams.map((e) => e.team.id), ["s1"]);
  assert.equal(result.legacyUsed, false);
});

test("a full season never consults legacy teams", () => {
  const result = recommendRoster({
    seasonTeams: [oneHeroTeam("s1", "Tướng A", "CP 1")], seasonTier: tiers(["s1"]),
    legacyTeams: [oneHeroTeam("l1", "Tướng B", "CP 2")], legacyTier: tiers(["l1"]),
    ownedHeroes: ["Tướng A", "Tướng B"], ownedTactics: ["CP 1", "CP 2"], maxTeams: 1,
  });
  assert.deepEqual(result.portfolioTeams.map((e) => e.team.id), ["s1"]);
  assert.equal(result.legacyUsed, false);
});

test("a chosen substitute turns a missing-tactic team into a substituted portfolio entry", () => {
  const team = { id: "s1", name: "S", heroes: [
    { name: "Tướng A", tactics: [{ name: "CP 1", alternatives: [] }, { name: "CP 2", alternatives: [] }] },
  ] };
  const base = { seasonTeams: [team], seasonTier: tiers(["s1"]), ownedHeroes: ["Tướng A"], ownedTactics: ["CP 1", "CP 8"] };
  assert.equal(recommendRoster(base).blockedStrongTeams[0].status, "missing-tactic");
  const overrides = [{ teamId: "s1", heroIndex: 0, slotIndex: 1, tactic: "CP 8" }];
  const result = recommendRoster({ ...base, tacticOverrides: overrides });
  const [entry] = result.portfolioTeams;
  assert.equal(entry.team.id, "s1");
  assert.equal(entry.status, "variant");
  assert.deepEqual(entry.usedAlternatives, [{ from: "CP 2", to: "CP 8" }]);
  // Ghi đè không sửa dữ liệu gốc của mùa.
  assert.deepEqual(team.heroes[0].tactics[1].alternatives, []);
});

test("overrides for teams or slots that no longer exist are ignored", () => {
  const teams = [oneHeroTeam("s1", "Tướng A", "CP 1")];
  const applied = applyTacticOverrides(teams, [
    { teamId: "gone", heroIndex: 0, slotIndex: 0, tactic: "CP 8" },
    { teamId: "s1", heroIndex: 2, slotIndex: 0, tactic: "CP 8" },
    { teamId: "s1", heroIndex: 0, slotIndex: 5, tactic: "CP 8" },
  ]);
  assert.deepEqual(applied, teams);
});

test("substitutes come from the hero's other season configs, owned and still free", () => {
  const usage = new Map([[canonicalHeroId("Tướng A"), new Map([
    ["CP miss", 9], ["CP in team", 8], ["CP reserved", 7], ["CP unowned", 6], ["CP low", 1], ["CP high", 4], ["CP mid", 2], ["CP mid 2", 2],
  ])]]);
  const result = analyzeTacticSubstitutes({
    heroName: "Tướng A",
    missingTactic: "CP miss",
    teamTactics: ["CP in team"],
    usage,
    ownedTactics: ["CP miss", "CP in team", "CP reserved", "CP low", "CP high", { name: "CP mid", canonicalId: "tactic:cp-mid" }, "CP mid 2"],
    reservedTactics: ["CP reserved"],
  });
  assert.deepEqual(result.substitutes, [
    { tactic: "CP high", configCount: 4 },
    { tactic: "CP mid", configCount: 2 },
    { tactic: "CP mid 2", configCount: 2 },
  ]);
  assert.deepEqual(analyzeTacticSubstitutes({ heroName: "Tướng Lạ", missingTactic: "CP miss", usage, ownedTactics: ["CP high"] }).substitutes, []);
});

test("canonical tactic ids (locked teams from canonical state) are reserved like names", () => {
  const usage = new Map([[canonicalHeroId("Tướng A"), new Map([["CP miss", 9], ["CP locked", 5], ["CP free", 1]])]]);
  const { substitutes } = analyzeTacticSubstitutes({
    heroName: "Tướng A",
    missingTactic: "CP miss",
    teamTactics: ["tactic:cp-in-team"],
    usage,
    ownedTactics: ["CP locked", "CP free"],
    reservedTactics: [canonicalTacticId("CP locked")],
  });
  assert.deepEqual(substitutes, [{ tactic: "CP free", configCount: 1 }]);
});

test("Thiếu món lists the teams closest to buildable first, keeping tier order among equals", () => {
  const team = (id, heroes) => ({ id, name: id, heroes: heroes.map((name) => ({ name, tactics: [] })) });
  const result = recommendRoster({
    seasonTeams: [team("a", ["X", "Y", "Z"]), team("b", ["A", "Y", "Z"]), team("c", ["A", "B", "Z"]), team("d", ["A", "Q", "Z"])],
    seasonTier: [...tiers(["a", "b"], "T0"), ...tiers(["c", "d"], "T1")],
    ownedHeroes: ["A", "B", "Q"],
  });
  assert.deepEqual(result.blockedStrongTeams.map((entry) => entry.team.id), ["c", "d", "b", "a"]);
});
