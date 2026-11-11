// Độ phủ kho cho danh sách Đội chuẩn: đọc kho từ storage của máy (không gọi mạng) và tính số món thiếu theo
// `sourceConfigId`. Fixture dùng bản ghi thật của generation đang pin, như test của khối Độ phủ kho.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildListCoverage, readOwnedRoster } from "../js/roster-list-coverage.js";
import { buildRosterCoverage } from "../js/roster-coverage.js";
import { CLOUD_STORAGE_KEY, emptyCloudState, mergeLocal } from "../js/roster-cloud-store.js";
import { createRosterIdResolver } from "../js/roster-id-resolve.js";
import { ROSTER_SCAN_STORAGE_KEY, createInitialRosterScanState, serializeRosterScanState } from "../js/roster-scan-state.js";
import { createTacticIdResolver } from "../js/lookup-ids.js";
import { realData, rosterOf, seasonFrom } from "./fixtures/roster-adapter-fixtures.mjs";

const SEASON = "og-兵演春秋";
const { records, heroesDict, tacticsDict } = realData();

const storageOf = (entries = {}) => ({ getItem: (key) => (Object.hasOwn(entries, key) ? entries[key] : null) });
const scanOf = ({ heroes = [], tactics = [] } = {}) => ({
  ...createInitialRosterScanState(),
  ownedHeroes: heroes.map((name) => ({ name, confidence: "manual" })),
  ownedTactics: tactics.map((name) => ({ name, confidence: "manual" })),
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
    assert.deepEqual(coverage.byConfigId.get(entry.team.id).missing, entry.missing);
  }
});

test("buildListCoverage: thiếu kho hoặc thiếu từ điển trả cấu trúc rỗng", () => {
  const empty = buildListCoverage({ records, seasonId: SEASON, heroesDict, tacticsDict, roster: null });
  assert.equal(empty.byConfigId.size, 0);
  assert.deepEqual(empty.summary, { complete: 0, total: 0 });
});
