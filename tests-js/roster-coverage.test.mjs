import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRosterCoverage } from "../js/roster-coverage.js";
import { applyTacticOverrides, recommendRoster } from "../js/roster-season-candidates.js";
import { createTacticIdResolver } from "../js/lookup-ids.js";
import { realData, rosterOf, seasonFrom } from "./fixtures/roster-adapter-fixtures.mjs";

const { tacticsDict } = realData();

/** Đội tổng hợp: `heroes` là [tên, [chiến pháp…]]; chiến pháp có thể là chuỗi hoặc ô đầy đủ. */
const team = (id, tier, heroes, extra = {}) => ({
  id,
  tier,
  heroes: heroes.map(([name, tactics]) => ({
    name,
    tactics: tactics.map((slot) => (typeof slot === "string" ? { name: slot, alternatives: [] } : slot)),
  })),
  conditionalTactics: [],
  ...extra,
});
const tierOf = (teams) => teams.map((item) => ({ teamId: item.id, rankings: item.tier ? [{ tier: item.tier }] : [] }));
const cover = (teams, { heroes = [], tactics = [], ...rest } = {}) => buildRosterCoverage({
  seasonTeams: teams,
  seasonTier: tierOf(teams),
  ownedHeroes: heroes,
  ownedTactics: tactics,
  ...rest,
});
const group = (coverage, tier) => coverage.tiers.find((entry) => entry.tier === tier);
const ids = (list) => list.map((item) => (item.team ?? item).id);

test("1. ranh giới trong một đội: thiếu 0 → ráp đủ, thiếu 1 → thiếu 1, thiếu 2 → không vào hai nhóm", () => {
  const t0 = team("t-0", "T0", [["Tào Tháo", ["Phong Thiên"]]]);
  const t1 = team("t-1", "T0", [["Tào Tháo", ["Phong Thiên"]], ["Lưu Bị", []]]);
  const t2 = team("t-2", "T0", [["Tào Tháo", ["Phong Thiên"]], ["Lưu Bị", ["Hỏa Công"]]]);
  const coverage = cover([t0, t1, t2], { heroes: ["Tào Tháo"], tactics: ["Phong Thiên"] });
  const tier = group(coverage, "T0");
  assert.equal(tier.total, 3);
  assert.deepEqual(ids(tier.complete), ["t-0"]);
  assert.deepEqual(ids(tier.missingOne), ["t-1"]);
  assert.deepEqual(tier.missingOne[0].missing, { kind: "hero", name: "Lưu Bị" });
});

test("2. thiếu 1 tướng + 1 chiến pháp không phải 'thiếu 1'", () => {
  const t = team("t", "T0", [["Tào Tháo", ["Phong Thiên"]], ["Lưu Bị", []]]);
  const tier = group(cover([t], { heroes: ["Tào Tháo"], tactics: [] }), "T0");
  assert.equal(tier.total, 1);
  assert.deepEqual([tier.complete.length, tier.missingOne.length], [0, 0]);
  const only = group(cover([t], { heroes: ["Tào Tháo", "Lưu Bị"], tactics: [] }), "T0");
  assert.deepEqual(only.missingOne[0].missing, { kind: "tactic", name: "Phong Thiên" });
});

test("3. ô tướng 'A/B': có A hoặc B là có", () => {
  const t = team("t", "T0", [["Tào Tháo/Lưu Bị", []], ["Tôn Quyền", []]]);
  assert.deepEqual(ids(group(cover([t], { heroes: ["Lưu Bị", "Tôn Quyền"] }), "T0").complete), ["t"]);
  assert.deepEqual(ids(group(cover([t], { heroes: ["Tào Tháo", "Tôn Quyền"] }), "T0").complete), ["t"]);
  const none = group(cover([t], { heroes: ["Tôn Quyền"] }), "T0");
  assert.deepEqual(ids(none.missingOne), ["t"]);
});

test("4. ô chiến pháp có món bù người dùng: có món bù là có", () => {
  const base = team("t", "T0", [["Tào Tháo", ["Phong Thiên"]]]);
  const [withOverride] = applyTacticOverrides([base], [{ teamId: "t", heroIndex: 0, slotIndex: 0, tactic: "Hỏa Công" }]);
  const owned = { heroes: ["Tào Tháo"], tactics: ["Hỏa Công"] };
  assert.deepEqual(ids(group(cover([withOverride], owned), "T0").complete), ["t"]);
  assert.deepEqual(ids(group(cover([base], owned), "T0").missingOne), ["t"]);
});

test("5. ô unresolved, các ô khác đủ: không 'ráp đủ', nằm trong 'thiếu 1' với món là ô chưa đối chiếu", () => {
  const t = team("t", "T0", [["Tào Tháo", ["Phong Thiên", { name: "Chữ lạ", alternatives: [], unresolved: true, raw: "未知" }]]]);
  const tier = group(cover([t], { heroes: ["Tào Tháo"], tactics: ["Phong Thiên"] }), "T0");
  assert.equal(tier.complete.length, 0);
  assert.deepEqual(ids(tier.missingOne), ["t"]);
  assert.deepEqual(tier.missingOne[0].missing, { kind: "tactic", name: "Chữ lạ", unresolved: true });
  const two = group(cover([t], { heroes: ["Tào Tháo"], tactics: [] }), "T0");
  assert.equal(two.missingOne.length, 0);
});

test("6. ô rỗng và conditionalTactics bị bỏ qua", () => {
  const t = team("t", "T0", [["Tào Tháo", ["Phong Thiên"]]], { conditionalTactics: [{ heroIndex: 0, slotIndex: 1, raw: "Kết nghĩa" }] });
  t.heroes[0].tactics.push({ name: "", alternatives: [] });
  const tier = group(cover([t], { heroes: ["Tào Tháo"], tactics: ["Phong Thiên"] }), "T0");
  assert.deepEqual(ids(tier.complete), ["t"]);
});

test("7. một tướng dùng ở nhiều đội: mỗi đội tính riêng", () => {
  const a = team("a", "T0", [["Tào Tháo", ["Phong Thiên"]]]);
  const b = team("b", "T0", [["Tào Tháo", ["Phong Thiên"]]]);
  const tier = group(cover([a, b], { heroes: ["Tào Tháo"], tactics: ["Phong Thiên"] }), "T0");
  assert.deepEqual(ids(tier.complete), ["a", "b"]);
});

test("8. thứ tự tier theo SOURCE_TIER_ORDER; tier lạ xếp cuối", () => {
  const teams = [team("z", "ZZ", [["A", []]]), team("t2", "T2", [["A", []]]), team("t0", "T0", [["A", []]]), team("t15", "T1.5", [["A", []]]), team("f", "FUNC", [["A", []]])];
  assert.deepEqual(cover(teams, { heroes: ["A"] }).tiers.map((entry) => entry.tier), ["T0", "T1.5", "T2", "FUNC", "ZZ"]);
});

test("9. mùa 0 đội (pk-s20): cấu trúc rỗng, không ném lỗi", () => {
  const empty = seasonFrom("pk-s20");
  assert.equal(empty.teams.length, 0);
  const coverage = buildRosterCoverage({ seasonTeams: empty.teams, seasonTier: empty.teamTier, ownedHeroes: ["Tào Tháo"], ownedTactics: [] });
  assert.deepEqual(coverage.tiers, []);
  assert.deepEqual(coverage.progress, { heroes: { owned: 0, total: 0 }, tactics: { owned: 0, total: 0 } });
  assert.deepEqual(coverage.unmapped, []);
  assert.doesNotThrow(() => buildRosterCoverage({}));
});

test("10. tiến độ: món trùng trong kho không đếm hai lần; món ngoài mùa không tăng tử số", () => {
  const teams = [team("a", "T0", [["Tào Tháo", ["Phong Thiên"]], ["Lưu Bị", ["Hỏa Công"]]]), team("b", "T1", [["Tào Tháo", ["Phong Thiên"]]])];
  const coverage = cover(teams, {
    heroes: ["Tào Tháo", "Tào Tháo", { name: "Tào Tháo" }, "Quan Vũ"],
    tactics: ["Phong Thiên", "Phong Thiên", "Món Ngoài Mùa"],
  });
  assert.deepEqual(coverage.progress, { heroes: { owned: 1, total: 2 }, tactics: { owned: 1, total: 2 } });
});

test("10b. tiến độ bỏ ô unresolved và không tính món bù người dùng vào tổng", () => {
  const base = team("a", "T0", [["Tào Tháo", ["Phong Thiên", { name: "Chữ lạ", alternatives: [], unresolved: true }]]]);
  const [withOverride] = applyTacticOverrides([base], [{ teamId: "a", heroIndex: 0, slotIndex: 0, tactic: "Hỏa Công" }]);
  const coverage = cover([withOverride], { heroes: ["Tào Tháo"], tactics: ["Hỏa Công"] });
  assert.deepEqual(coverage.progress.tactics, { owned: 0, total: 1 });
});

test("10c. unmapped chuyển tiếp cho UI", () => {
  const unmapped = [{ configId: "x", reason: "hero-unmapped" }];
  assert.deepEqual(cover([], { unmapped }).unmapped, unmapped);
});

const SEASON = "og-兵演春秋";
const LVBU = "og-bingyan-40y-lvbu-b";
const WUNV = "og-bingyan-wunv-cavalry-hubaoqi";

test("11. dữ liệu thật, kho của issue #5, mùa og-兵演春秋: tổng 25, hai đội đều ráp đủ khi đứng riêng", () => {
  const season = seasonFrom(SEASON);
  const roster = rosterOf(season.teams.filter((item) => [LVBU, WUNV].includes(item.id)));
  const coverage = buildRosterCoverage({
    seasonTeams: season.teams,
    seasonTier: season.teamTier,
    ownedHeroes: roster.ownedHeroes,
    ownedTactics: roster.ownedTactics,
    tacticIdOf: createTacticIdResolver(tacticsDict),
    unmapped: [],
  });
  assert.deepEqual(coverage.tiers.map((entry) => [entry.tier, entry.total]), [["T0", 12], ["T0.5", 1], ["T1", 12]]);
  assert.equal(coverage.tiers.reduce((sum, entry) => sum + entry.total, 0), 25);
  const t0 = group(coverage, "T0");
  assert.ok(ids(t0.complete).includes(LVBU));
  assert.ok(ids(t0.complete).includes(WUNV));
  for (const entry of coverage.tiers) assert.equal(entry.total >= entry.complete.length + entry.missingOne.length, true);
  assert.ok(coverage.progress.heroes.owned > 0 && coverage.progress.heroes.owned <= coverage.progress.heroes.total);
});

test("12. kho lưu tên Hán-Việt cũ của chiến pháp ra cùng id với engine", () => {
  const season = seasonFrom(SEASON);
  const resolver = createTacticIdResolver(tacticsDict);
  const byViet = new Map(tacticsDict.map((row) => [row.viet, row]));
  const renamedIn = (item) => item.heroes.flatMap((hero) => hero.tactics.map((slot) => slot.name)).filter((name) => {
    const row = byViet.get(name);
    return row?.hanViet && row.hanViet !== row.viet && resolver(row.hanViet) === resolver(name);
  });
  const target = season.teams.find((item) => item.id === "og-bingyan-zhangfei-nuke-bow");
  const renamed = renamedIn(target);
  assert.ok(renamed.length > 0, "fixture cần ít nhất một chiến pháp có tên Hán-Việt khác tên Việt");
  const base = rosterOf([target]);
  const ownedTactics = base.ownedTactics.map((name) => (renamed.includes(name) ? byViet.get(name).hanViet : name));
  const coverage = buildRosterCoverage({
    seasonTeams: season.teams,
    seasonTier: season.teamTier,
    ownedHeroes: base.ownedHeroes,
    ownedTactics,
    tacticIdOf: resolver,
  });
  assert.ok(coverage.tiers.some((entry) => ids(entry.complete).includes(target.id)));
  const result = recommendRoster({
    seasonTeams: season.teams, seasonTier: season.teamTier, tacticsDict, ownedHeroes: base.ownedHeroes, ownedTactics, fullBox: true,
  });
  assert.ok(result.portfolioTeams.some((entry) => entry.team.id === target.id));
});
