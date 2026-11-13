// Độ phủ kho cho danh sách Đội chuẩn: đọc kho từ storage của máy (không gọi mạng) và tính số món thiếu theo
// `sourceConfigId`. Fixture dùng bản ghi thật của generation đang pin, như test của khối Độ phủ kho.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_SEASONS, NEAR_MISSING_LIMIT, buildListCoverage, readOwnedRoster } from "../js/roster-list-coverage.js";
import { buildRosterCoverage } from "../js/roster-coverage.js";
import { applyTacticOverrides } from "../js/roster-season-candidates.js";
import { CLOUD_STORAGE_KEY, emptyCloudState, mergeLocal } from "../js/roster-cloud-store.js";
import { createRosterIdResolver } from "../js/roster-id-resolve.js";
import { ROSTER_SCAN_STORAGE_KEY, createInitialRosterScanState, serializeRosterScanState } from "../js/roster-scan-state.js";
import { createTacticIdResolver } from "../js/lookup-ids.js";
import { realData, rosterOf, seasonFrom } from "./fixtures/roster-adapter-fixtures.mjs";

const SEASON = "og-兵演春秋";
const { records, heroesDict, tacticsDict } = realData();

const storageOf = (entries = {}) => ({ getItem: (key) => (Object.hasOwn(entries, key) ? entries[key] : null) });
const scanOf = ({ heroes = [], tactics = [], overrides = [] } = {}) => ({
  ...createInitialRosterScanState(),
  ownedHeroes: heroes.map((name) => ({ name, confidence: "manual" })),
  ownedTactics: tactics.map((name) => ({ name, confidence: "manual" })),
  tacticOverrides: overrides,
});
const localBlob = (inventory) => JSON.stringify(serializeRosterScanState(scanOf(inventory)));
const cloudBlob = (userId, inventory) => {
  const resolve = createRosterIdResolver({ heroesDict, tacticsDict });
  const { state } = mergeLocal(emptyCloudState(userId), scanOf(inventory), resolve, { now: 1_700_000_000_000 });
  return JSON.stringify({ userId: state.userId, cursor: state.cursor, pulledKinds: state.pulledKinds, records: state.records, dirty: state.dirty, rejected: state.rejected });
};
const names = (items) => items.map((item) => (typeof item === "string" ? item : item.name)).sort();

test("readOwnedRoster: máy không có kho trả null", () => {
  assert.equal(readOwnedRoster(storageOf()), null);
  assert.equal(readOwnedRoster(null), null);
  assert.equal(readOwnedRoster(storageOf({ [ROSTER_SCAN_STORAGE_KEY]: localBlob() })), null);
});

test("readOwnedRoster: khách đọc kho local", () => {
  const storage = storageOf({ [ROSTER_SCAN_STORAGE_KEY]: localBlob({ heroes: ["Tào Tháo"], tactics: ["Phong Thiên"] }) });
  const roster = readOwnedRoster(storage);
  assert.equal(roster.source, "local");
  assert.deepEqual(names(roster.ownedHeroes), ["Tào Tháo"]);
  assert.deepEqual(names(roster.ownedTactics), ["Phong Thiên"]);
});

test("readOwnedRoster: đã đăng nhập đọc cache cloud hộp main của đúng người, không rơi về kho local", () => {
  const storage = storageOf({
    [ROSTER_SCAN_STORAGE_KEY]: localBlob({ heroes: ["Lưu Bị"] }),
    [CLOUD_STORAGE_KEY]: cloudBlob("u-alice", { heroes: ["Tào Tháo"] }),
  });
  const roster = readOwnedRoster(storage, { userId: "u-alice" });
  assert.equal(roster.source, "cloud");
  assert.deepEqual(names(roster.ownedHeroes), ["Tào Tháo"]);
});

test("readOwnedRoster: cache cloud của người khác hoặc chưa có cache thì coi như chưa có kho", () => {
  const storage = storageOf({
    [ROSTER_SCAN_STORAGE_KEY]: localBlob({ heroes: ["Lưu Bị"] }),
    [CLOUD_STORAGE_KEY]: cloudBlob("u-alice", { heroes: ["Tào Tháo"] }),
  });
  assert.equal(readOwnedRoster(storage, { userId: "u-bob" }), null);
  assert.equal(readOwnedRoster(storageOf({ [ROSTER_SCAN_STORAGE_KEY]: localBlob({ heroes: ["Lưu Bị"] }) }), { userId: "u-bob" }), null);
});

test("readOwnedRoster: khách không bao giờ đọc cache cloud còn sót lại", () => {
  const storage = storageOf({ [CLOUD_STORAGE_KEY]: cloudBlob("u-alice", { heroes: ["Tào Tháo"] }) });
  assert.equal(readOwnedRoster(storage), null);
});

test("readOwnedRoster: JSON hỏng hoặc storage ném lỗi trả null, không ném", () => {
  assert.equal(readOwnedRoster(storageOf({ [ROSTER_SCAN_STORAGE_KEY]: "{hỏng" })), null);
  assert.equal(readOwnedRoster(storageOf({ [CLOUD_STORAGE_KEY]: "{hỏng" }), { userId: "u-alice" }), null);
  assert.equal(readOwnedRoster({ getItem() { throw new Error("blocked"); } }), null);
});

test("buildListCoverage: khóa là sourceConfigId của đội Giao chiến đã đối chiếu của đúng mùa", () => {
  const season = seasonFrom(SEASON);
  const coverage = buildListCoverage({ records, seasonId: SEASON, heroesDict, tacticsDict, roster: { ownedHeroes: [], ownedTactics: [] } });
  assert.deepEqual([...coverage.byConfigId.keys()].sort(), season.teams.map((team) => team.id).sort());
  assert.equal(coverage.summary.total, season.teams.length);
  assert.equal(coverage.summary.complete, 0);
  const otherSeason = records.find((record) => record.sourceSeasonId !== SEASON);
  assert.equal(coverage.byConfigId.has(otherSeason.sourceConfigId), false);
});

test("buildListCoverage: số ráp được khớp tổng 'Ráp đủ' của khối Độ phủ kho trên cùng kho", () => {
  const season = seasonFrom(SEASON);
  const roster = rosterOf(season.teams.slice(0, 6));
  const coverage = buildListCoverage({ records, seasonId: SEASON, heroesDict, tacticsDict, roster });
  const block = buildRosterCoverage({
    seasonTeams: season.teams,
    seasonTier: season.teamTier,
    ownedHeroes: roster.ownedHeroes,
    ownedTactics: roster.ownedTactics,
    tacticIdOf: createTacticIdResolver(tacticsDict),
  });
  const complete = block.tiers.reduce((sum, tier) => sum + tier.complete.length, 0);
  assert.ok(complete > 0);
  assert.equal(coverage.summary.complete, complete);
  for (const entry of block.teams) {
    assert.equal(coverage.byConfigId.get(entry.team.id).missingCount, entry.missingCount);
    assert.deepEqual(coverage.byConfigId.get(entry.team.id).missing.map(({ nameZh: _zh, ...item }) => item), entry.missing);
  }
});

test("buildListCoverage: thiếu kho hoặc thiếu từ điển trả cấu trúc rỗng", () => {
  const empty = buildListCoverage({ records, seasonId: SEASON, heroesDict, tacticsDict, roster: null });
  assert.equal(empty.byConfigId.size, 0);
  assert.deepEqual(empty.summary, { complete: 0, total: 0, near: 0, far: 0, roster: null });
});

/** Kho đủ mọi món của một đội trừ một chiến pháp, kèm món bù người dùng đã chọn cho đúng ô đó (như ở Gợi ý đội). */
function substituteFixture() {
  const season = seasonFrom(SEASON);
  const team = season.teams.find((item) => item.heroes[0].tactics.some((tactic) => !tactic.unresolved));
  const slotIndex = team.heroes[0].tactics.findIndex((tactic) => !tactic.unresolved);
  const original = team.heroes[0].tactics[slotIndex].name;
  const roster = rosterOf([team], { skipTactics: [original] });
  const substitute = tacticsDict.map((tactic) => tactic.viet).find((name) => name && name !== original && !roster.ownedTactics.includes(name));
  roster.ownedTactics.push(substitute);
  return { season, team, roster, overrides: [{ teamId: team.id, heroIndex: 0, slotIndex, tactic: substitute }] };
}

test("readOwnedRoster: trả cả món bù đã chọn (tacticOverrides) của kho local và kho cloud", () => {
  const overrides = [{ teamId: "og-bingyan-40y-lvbu-b", heroIndex: 0, slotIndex: 0, tactic: "Phong Thiên" }];
  const local = readOwnedRoster(storageOf({ [ROSTER_SCAN_STORAGE_KEY]: localBlob({ heroes: ["Tào Tháo"], tactics: ["Phong Thiên"], overrides }) }));
  assert.deepEqual(local.tacticOverrides, overrides);
  const cloud = readOwnedRoster(
    storageOf({ [CLOUD_STORAGE_KEY]: cloudBlob("u-alice", { heroes: ["Tào Tháo"], tactics: ["Phong Thiên"], overrides }) }),
    { userId: "u-alice" },
  );
  assert.deepEqual(cloud.tacticOverrides, overrides);
});

test("buildListCoverage: món bù đã chọn được tính như ở khối Độ phủ kho (đội thành ráp được)", () => {
  const { season, team, roster, overrides } = substituteFixture();
  const without = buildListCoverage({ records, seasonId: SEASON, heroesDict, tacticsDict, roster });
  assert.equal(without.byConfigId.get(team.id).missingCount, 1);
  const withSubstitute = buildListCoverage({ records, seasonId: SEASON, heroesDict, tacticsDict, roster: { ...roster, tacticOverrides: overrides } });
  assert.equal(withSubstitute.byConfigId.get(team.id).missingCount, 0);
  const block = buildRosterCoverage({
    seasonTeams: applyTacticOverrides(season.teams, overrides),
    seasonTier: season.teamTier,
    ownedHeroes: roster.ownedHeroes,
    ownedTactics: roster.ownedTactics,
    tacticIdOf: createTacticIdResolver(tacticsDict),
  });
  assert.equal(withSubstitute.summary.complete, block.tiers.reduce((sum, tier) => sum + tier.complete.length, 0));
});

test("buildListCoverage: món thiếu mang tên Hán của từ điển (nameZh) để bản zh không lẫn tên Việt", () => {
  const coverage = buildListCoverage({ records, seasonId: SEASON, heroesDict, tacticsDict, roster: { ownedHeroes: [], ownedTactics: [] } });
  const items = [...coverage.byConfigId.values()].flatMap((entry) => entry.missing).filter((item) => !item.unresolved);
  const hero = items.find((item) => item.kind === "hero" && !item.name.includes("/"));
  const tactic = items.find((item) => item.kind === "tactic");
  assert.equal(hero.nameZh, heroesDict.find((row) => row.viet === hero.name).chinese);
  assert.equal(tactic.nameZh, tacticsDict.find((row) => row.viet === tactic.name).chinese);
});

test("buildListCoverage: phạm vi Tất cả gộp độ phủ của từng mùa, không mất mùa nào", () => {
  const season = seasonFrom(SEASON);
  const roster = rosterOf(season.teams.slice(0, 6));
  const all = buildListCoverage({ records, seasonId: ALL_SEASONS, heroesDict, tacticsDict, roster });
  const seasonIds = [...new Set(records.map((record) => record.sourceSeasonId))];
  assert.ok(seasonIds.length > 1);
  let complete = 0;
  let total = 0;
  let near = 0;
  let far = 0;
  for (const seasonId of seasonIds) {
    const one = buildListCoverage({ records, seasonId, heroesDict, tacticsDict, roster });
    complete += one.summary.complete;
    total += one.summary.total;
    near += one.summary.near;
    far += one.summary.far;
    for (const [id, entry] of one.byConfigId) assert.deepEqual(all.byConfigId.get(id), entry);
  }
  assert.ok(complete > 0);
  assert.deepEqual(all.summary, { complete, total, near, far, roster: { heroes: roster.ownedHeroes.length, tactics: roster.ownedTactics.length, source: null } });
  assert.equal(all.byConfigId.size, total);
});

test("buildListCoverage: tóm tắt chia ba mức (ráp được, thiếu 1–2, thiếu từ 3) và ghi cỡ kho đã đọc", () => {
  const season = seasonFrom(SEASON);
  const roster = { ...rosterOf(season.teams.slice(0, 3)), source: "local" };
  const coverage = buildListCoverage({ records, seasonId: SEASON, heroesDict, tacticsDict, roster });
  const entries = [...coverage.byConfigId.values()];
  assert.equal(coverage.summary.complete, entries.filter((entry) => entry.missingCount === 0).length);
  assert.equal(coverage.summary.near, entries.filter((entry) => entry.missingCount > 0 && entry.missingCount <= NEAR_MISSING_LIMIT).length);
  assert.equal(coverage.summary.far, entries.filter((entry) => entry.missingCount > NEAR_MISSING_LIMIT).length);
  assert.equal(coverage.summary.complete + coverage.summary.near + coverage.summary.far, coverage.summary.total);
  assert.deepEqual(coverage.summary.roster, { heroes: roster.ownedHeroes.length, tactics: roster.ownedTactics.length, source: "local" });
});
