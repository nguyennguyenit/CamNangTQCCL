import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  MAIN_BOX_ID,
  applyPull,
  applyResults,
  boxes,
  clockOf,
  emptyCloudState,
  ensureBoxDefaults,
  groupsOf,
  lockedOf,
  lockedTeamKey,
  mergeCloudStates,
  mergeLocal,
  nextStamp,
  overrideRecordId,
  overridesOf,
  ownedOf,
  pendingPush,
  putRecord,
  recordKey,
  removeRecord,
  seasonOf,
  sha256Hex16,
  toScanState,
  writeScanState,
} from "../js/roster-cloud-store.js";
import { createRosterIdResolver } from "../js/roster-id-resolve.js";
import {
  addCanonicalItem,
  applyScanResult,
  createInitialRosterScanState,
  removeItem,
  setTacticOverride,
} from "../js/roster-scan-state.js";
import { validateRosterRecord } from "./support/roster-fake-server.mjs";

const load = (name) => JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url), "utf8"));
const resolve = createRosterIdResolver({ heroesDict: load("heroes-dict.json"), tacticsDict: load("tactics.json") });
const NOW = Date.UTC(2026, 9, 21, 8, 0, 0);
const iso = (ms) => new Date(ms).toISOString();
const CJK_TEAM = "yxms-010-周劭蜀弓";

/** Kho local thật: món thêm tay `{name, confidence:"manual"}`, không `canonicalId`. */
function localInventory() {
  let scan = createInitialRosterScanState();
  for (const name of ["Mã Siêu", "Tào Tháo", "SP Quách Gia"]) scan = addCanonicalItem(scan, "heroes", name);
  for (const name of ["Đương Phong Thôi Quyết", "An Ủi Quân Dân"]) scan = addCanonicalItem(scan, "tactics", name);
  scan = applyScanResult(scan, "builtTeams", { teams: [{ teamName: "Team cũ", heroes: ["Trình Phổ", "Mã Siêu"], tactics: ["An Ủi Quân Dân"] }] });
  scan = setTacticOverride(scan, { teamId: CJK_TEAM, heroIndex: 0, slotIndex: 1, tactic: "Cắt Xương Trị Độc" });
  return { ...scan, seasonId: "season-s5" };
}

const tombstone = (kind, id, boxId, updatedAt, rev) => ({
  kind,
  id,
  boxId: kind === "box" ? null : boxId,
  updatedAt,
  rev,
  deleted: true,
  data: { id, updatedAt: iso(updatedAt), deletedAt: iso(updatedAt), boxId: boxId ?? id },
});

const liveKeys = (state) => Object.values(state.records).filter((r) => !r.deleted).map((r) => recordKey(r.kind, r.id)).sort();

test("sha256Hex16 khớp Web Crypto cho ASCII, tiếng Việt và chữ Hán", async () => {
  for (const text of ["", "abc", "yxms-010-周劭蜀弓", "Đương Phong Thôi Quyết".repeat(40)]) {
    assert.equal(sha256Hex16(text), createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16));
  }
});

test("3. gộp lần đầu: hộp main, season, 2 nhóm mặc định, 5 owned, 1 locked, 1 override", () => {
  const { state, localOnly } = mergeLocal(emptyCloudState("u-alice"), localInventory(), resolve, { now: NOW });
  assert.deepEqual(boxes(state).map((b) => b.id), ["main"]);
  assert.equal(seasonOf(state, "main")?.seasonId, "season-s5");
  assert.deepEqual(groupsOf(state, "main").map((g) => g.id), ["main~khai-hoang", "main~ghep-team"]);
  assert.deepEqual(ownedOf(state, "main").map((o) => o.item).sort(), [
    "hero:ma-sieu",
    "hero:sp-quach-gia",
    "hero:tao-thao",
    "tactic:an-ui-quan-dan",
    "tactic:duong-phong-thoi-quyet",
  ]);
  assert.equal(lockedOf(state, "main").length, 1);
  assert.equal(overridesOf(state, "main").length, 1);
  assert.deepEqual(localOnly.heroes, []);
  // Mọi bản ghi đều đang dirty và mang updatedAt hiện hành.
  for (const [key, ts] of Object.entries(state.dirty)) assert.equal(state.records[key].updatedAt, ts);
  assert.equal(Object.keys(state.dirty).length, Object.keys(state.records).length);
});

test("3b. bản ghi client dựng ra qua đúng validate của server (id, khóa data, hash, ràng buộc hộp)", async () => {
  const { state } = mergeLocal(emptyCloudState("u-alice"), localInventory(), resolve, { now: NOW });
  const wire = pendingPush(state);
  assert.equal(wire.length, 11); // hộp, 2 nhóm, mùa, 5 owned, 1 locked, 1 override
  assert.deepEqual(new Set(wire.map((r) => r.kind)), new Set(["box", "group", "season", "owned", "locked", "override"]));
  for (const record of wire) {
    const checked = await validateRosterRecord(record);
    assert.equal(checked.ok, true, `${record.kind} ${record.id}: ${checked.message}`);
  }
  const override = wire.find((r) => r.kind === "override");
  assert.equal(override.id, `main~${sha256Hex16(CJK_TEAM)}~0~1`);
  assert.equal(override.data.teamId, CJK_TEAM);
  // Hộp đứng đầu để cả hai chạy được trong một request.
  assert.equal(wire[0].kind, "box");
});

test("3c. bản xóa và bản thao tác tiếp theo cũng qua validate của server", async () => {
  let { state } = mergeLocal(emptyCloudState("u-alice"), localInventory(), resolve, { now: NOW });
  const before3c = toScanState(state, MAIN_BOX_ID);
  state = writeScanState(state, MAIN_BOX_ID, removeItem(before3c, "heroes", "Mã Siêu"), resolve, { now: NOW + 10, previous: before3c }).state;
  const deleted = pendingPush(state).find((r) => r.id === "main~hero:ma-sieu");
  assert.equal(deleted.deleted, true);
  assert.deepEqual(Object.keys(deleted.data).sort(), ["boxId", "deletedAt", "id", "updatedAt"]);
  assert.equal((await validateRosterRecord(deleted)).ok, true);
});

test("2. món ngoài từ điển không sinh bản ghi, vào localOnly; các món khác vẫn gộp", () => {
  let scan = localInventory();
  scan = addCanonicalItem(scan, "heroes", "Tướng Không Tồn Tại");
  scan = addCanonicalItem(scan, "tactics", "刮骨療毒");
  const { state, localOnly } = mergeLocal(emptyCloudState("u-alice"), scan, resolve, { now: NOW });
  assert.deepEqual(localOnly.heroes, ["Tướng Không Tồn Tại"]);
  assert.deepEqual(localOnly.tactics, ["刮骨療毒"]);
  assert.equal(ownedOf(state, "main").length, 5);
});

test("4. cloud có bản xóa của owned, locked và override tương ứng: gộp không tạo lại cả ba", () => {
  const scan = localInventory();
  const lockedKey = lockedTeamKey(scan.lockedTeams[0], resolve);
  const overrideId = overrideRecordId("main", CJK_TEAM, 0, 1);
  let state = emptyCloudState("u-alice");
  state = applyPull(
    state,
    [
      tombstone("owned", "main~hero:ma-sieu", "main", NOW - 5000, 1),
      tombstone("locked", `main~${lockedKey}`, "main", NOW - 4000, 2),
      tombstone("override", overrideId, "main", NOW - 3000, 3),
    ],
    3,
  ).state;
  const merged = mergeLocal(state, scan, resolve, { now: NOW }).state;
  for (const key of [recordKey("owned", "main~hero:ma-sieu"), recordKey("locked", `main~${lockedKey}`), recordKey("override", overrideId)]) {
    assert.equal(merged.records[key].deleted, true, `${key} vẫn là bản xóa`);
    assert.equal(merged.records[key].updatedAt, state.records[key].updatedAt, `${key} không bị đóng dấu lại`);
    assert.equal(merged.dirty[key], undefined, `${key} không bị đẩy lại`);
  }
  assert.equal(ownedOf(merged, "main").length, 4);
  assert.equal(lockedOf(merged, "main").length, 0);
  assert.equal(overridesOf(merged, "main").length, 0);
});

test("4b. season cloud đã có thì giữ seasonId của cloud, không ghi đè bằng local", () => {
  let state = emptyCloudState("u-alice");
  state = putRecord(state, { kind: "box", id: "main", data: { name: "Hộp chính" } }, { now: NOW - 9000 });
  state = putRecord(state, { kind: "season", id: "main", boxId: "main", data: { seasonId: "season-s9" } }, { now: NOW - 9000 });
  const merged = mergeLocal(state, localInventory(), resolve, { now: NOW }).state;
  assert.equal(seasonOf(merged, "main").seasonId, "season-s9");
});

test("5. gộp dở rồi chạy lại: không nhân đôi, phần thiếu được tạo, bản đã có giữ nguyên dấu thời gian", () => {
  const first = mergeLocal(emptyCloudState("u-alice"), localInventory(), resolve, { now: NOW }).state;
  const partial = structuredClone(first);
  for (const key of ["owned:main~hero:tao-thao", "owned:main~tactic:an-ui-quan-dan"]) {
    delete partial.records[key];
    delete partial.dirty[key];
  }
  const again = mergeLocal(partial, localInventory(), resolve, { now: NOW + 60_000 }).state;
  assert.deepEqual(liveKeys(again), liveKeys(first));
  assert.equal(again.records["owned:main~hero:ma-sieu"].updatedAt, first.records["owned:main~hero:ma-sieu"].updatedAt);
  assert.equal(again.records["owned:main~hero:tao-thao"].updatedAt, NOW + 60_000);
  // Chạy lần thứ ba không đổi gì.
  assert.deepEqual(mergeLocal(again, localInventory(), resolve, { now: NOW + 120_000 }).state, again);
});

test("ensureBoxDefaults idempotent; hộp khác main có nhóm mặc định nhưng không có season", () => {
  let state = ensureBoxDefaults(emptyCloudState("u-alice"), "box-abc", { name: "Hộp phụ", now: NOW });
  assert.deepEqual(Object.keys(state.records).sort(), ["box:box-abc", "group:box-abc~ghep-team", "group:box-abc~khai-hoang"]);
  assert.equal(state.records["box:box-abc"].data.name, "Hộp phụ");
  assert.equal(ensureBoxDefaults(state, "box-abc", { now: NOW + 5 }), state, "không đổi => trả lại cùng state");
  state = ensureBoxDefaults(state, "main", { now: NOW + 5 });
  assert.equal(state.records["box:main"].data.name.length > 0, true);
});

test("9. Lamport: đồng hồ máy chậm hơn bản đã thấy thì updatedAt mới vẫn lớn hơn", () => {
  let state = applyPull(emptyCloudState("u-alice"), [{ ...tombstone("owned", "main~hero:x", "main", NOW + 60_000, 7), deleted: false, data: {} }], 7).state;
  assert.equal(clockOf(state), NOW + 60_000);
  state = putRecord(state, { kind: "box", id: "main", data: { name: "Hộp" } }, { now: NOW });
  assert.equal(state.records["box:main"].updatedAt, NOW + 60_001);
  state = putRecord(state, { kind: "box", id: "main", data: { name: "Hộp 2" } }, { now: NOW });
  assert.equal(state.records["box:main"].updatedAt, NOW + 60_002);
});

test("14. bản xóa của hộp kéo về: mọi bản ghi con (kể cả dirty) bị bỏ khỏi cache", () => {
  let { state } = mergeLocal(emptyCloudState("u-alice"), localInventory(), resolve, { now: NOW });
  state = ensureBoxDefaults(state, "box-keep", { name: "Giữ", now: NOW });
  const result = applyPull(state, [tombstone("box", "main", "main", NOW + 1000, 40)], 40);
  assert.deepEqual(Object.keys(result.state.records).filter((k) => k.includes("main")), ["box:main"]);
  assert.equal(result.state.records["box:main"].deleted, true);
  assert.deepEqual(Object.keys(result.state.dirty).filter((k) => !k.includes("box-keep")), []);
  assert.ok(result.state.records["box:box-keep"], "hộp khác không bị ảnh hưởng");
  assert.equal(result.state.cursor, 40);
});

test("14b. xóa hộp tại chỗ cũng bỏ con và đẩy bản xóa của hộp", () => {
  let { state } = mergeLocal(emptyCloudState("u-alice"), localInventory(), resolve, { now: NOW });
  state = ensureBoxDefaults(state, "box-two", { name: "Hai", now: NOW });
  state = removeRecord(state, "box", "box-two", { now: NOW + 10 });
  assert.deepEqual(Object.keys(state.records).filter((k) => k.includes("box-two")), ["box:box-two"]);
  assert.equal(state.records["box:box-two"].deleted, true);
  assert.equal(state.dirty["box:box-two"], state.records["box:box-two"].updatedAt);
});

test("LWW kéo về: bản server mới hơn thắng; hòa khác payload nhận bản server; bản local dirty mới hơn được giữ", () => {
  const live = (id, ts, name, rev) => ({ kind: "box", id, boxId: null, updatedAt: ts, rev, deleted: false, data: { id, name, updatedAt: iso(ts), deletedAt: "" } });
  let state = putRecord(emptyCloudState("u-alice"), { kind: "box", id: "main", data: { name: "local" } }, { now: NOW });
  const localTs = state.records["box:main"].updatedAt;
  // Server cũ hơn -> giữ local (còn dirty).
  let result = applyPull(state, [live("main", localTs - 5, "server-old", 1)], 1);
  assert.equal(result.state.records["box:main"].data.name, "local");
  assert.equal(result.state.dirty["box:main"], localTs);
  // Hòa khác payload -> server thắng, local bị mất khỏi dirty và được báo.
  result = applyPull(state, [live("main", localTs, "server-tie", 2)], 2);
  assert.equal(result.state.records["box:main"].data.name, "server-tie");
  assert.equal(result.state.dirty["box:main"], undefined);
  assert.equal(result.lost.length, 1);
  assert.equal(result.lost[0].data.name, "local");
  // Server mới hơn -> server thắng.
  result = applyPull(state, [live("main", localTs + 1, "server-new", 3)], 3);
  assert.equal(result.state.records["box:main"].data.name, "server-new");
  assert.equal(result.state.records["box:main"].rev, 3);
});

test("mergeCloudStates (hai tab): bản ghi theo updatedAt, hợp dirty, cursor theo bản có đủ bản ghi, con của hộp bị xóa bị bỏ", () => {
  const base = ensureBoxDefaults(emptyCloudState("u-alice"), "main", { now: NOW });
  const a = putRecord(base, { kind: "owned", id: "main~hero:ma-sieu", boxId: "main", data: { item: "hero:ma-sieu", name: "Mã Siêu", type: "hero" } }, { now: NOW + 10 });
  const b = putRecord(base, { kind: "owned", id: "main~hero:tao-thao", boxId: "main", data: { item: "hero:tao-thao", name: "Tào Tháo", type: "hero" } }, { now: NOW + 20 });
  const merged = mergeCloudStates(a, b);
  assert.deepEqual(ownedOf(merged, "main").map((o) => o.item).sort(), ["hero:ma-sieu", "hero:tao-thao"]);
  assert.ok(merged.dirty["owned:main~hero:ma-sieu"] && merged.dirty["owned:main~hero:tao-thao"]);

  const newer = { ...b, cursor: 9, records: { ...b.records, "box:main": { ...b.records["box:main"], deleted: true, updatedAt: NOW + 99, rev: 9 } } };
  const pruned = mergeCloudStates(a, newer);
  assert.equal(pruned.cursor, 9);
  assert.deepEqual(Object.keys(pruned.records).filter((k) => k.startsWith("owned:")), []);
});

test("toScanState <-> writeScanState: vòng đi về giữ kho, bỏ món bị gỡ bằng bản xóa, hồi sinh món đã xóa", () => {
  let { state } = mergeLocal(emptyCloudState("u-alice"), localInventory(), resolve, { now: NOW });
  let scan = toScanState(state, "main");
  assert.deepEqual(scan.ownedHeroes.map((h) => h.name).sort(), ["Mã Siêu", "SP Quách Gia", "Tào Tháo"]);
  assert.equal(scan.seasonId, "season-s5");
  assert.equal(scan.lockedTeams[0].teamName, "Team cũ");
  assert.deepEqual(scan.tacticOverrides, [{ teamId: CJK_TEAM, heroIndex: 0, slotIndex: 1, tactic: "Cắt Xương Trị Độc" }]);

  const previous = scan;
  scan = removeItem(scan, "heroes", "Tào Tháo");
  state = writeScanState(state, "main", scan, resolve, { now: NOW + 100, previous }).state;
  assert.equal(state.records["owned:main~hero:tao-thao"].deleted, true);
  assert.equal(ownedOf(state, "main").length, 4);

  scan = addCanonicalItem(toScanState(state, "main"), "heroes", "Tào Tháo");
  state = writeScanState(state, "main", scan, resolve, { now: NOW + 200 }).state;
  assert.equal(state.records["owned:main~hero:tao-thao"].deleted, false);
  assert.equal(ownedOf(state, "main").length, 5);

  // Không đổi gì -> không đóng dấu lại.
  const same = writeScanState(state, "main", toScanState(state, "main"), resolve, { now: NOW + 300 }).state;
  assert.deepEqual(same, state);
});

test("writeScanState: món ngoài từ điển vào localOnly và không bị đẩy", () => {
  const { state } = mergeLocal(emptyCloudState("u-alice"), localInventory(), resolve, { now: NOW });
  const scan = addCanonicalItem(toScanState(state, "main"), "heroes", "Tướng Không Tồn Tại");
  const result = writeScanState(state, "main", scan, resolve, { now: NOW + 50 });
  assert.deepEqual(result.localOnly.heroes, ["Tướng Không Tồn Tại"]);
  assert.equal(ownedOf(result.state, "main").length, 5);
});

test("M3. writeScanState: xóa mềm theo chênh lệch previous → scan, không theo 'mọi thứ sống không có trong scan'", () => {
  let { state } = mergeLocal(emptyCloudState("u-alice"), localInventory(), resolve, { now: NOW });
  // Máy khác thêm một món mà từ điển bản này không dựng được (hoặc thêm sau khi UI này nạp): bản cloud còn sống, UI không biết.
  state = putRecord(state, { kind: "owned", id: "main~hero:moi-tu-ban-sau", boxId: "main", data: { item: "hero:moi-tu-ban-sau", name: "Tướng Mới", type: "hero" } }, { now: NOW + 5 });
  const previous = toScanState(state, "main");
  const scan = removeItem(previous, "heroes", "Tào Tháo");
  const written = writeScanState(state, "main", scan, resolve, { now: NOW + 100, previous }).state;
  assert.equal(written.records["owned:main~hero:tao-thao"].deleted, true, "món người dùng gỡ bị xóa");
  assert.equal(written.records["owned:main~hero:moi-tu-ban-sau"].deleted, false, "món client không thấy/không dựng được giữ nguyên trên cloud");

  // UI có kho cũ hơn cloud (pull xen giữa): món mới trên cloud không có trong previous → không bị xóa khi ghi.
  const stale = toScanState(mergeLocal(emptyCloudState("u-alice"), localInventory(), resolve, { now: NOW }).state, "main");
  const result = writeScanState(state, "main", removeItem(stale, "heroes", "Tào Tháo"), resolve, { now: NOW + 200, previous: stale }).state;
  assert.equal(result.records["owned:main~hero:moi-tu-ban-sau"].deleted, false);

  // Không có previous → không xóa gì.
  const noDiff = writeScanState(state, "main", removeItem(previous, "heroes", "Tào Tháo"), resolve, { now: NOW + 300 }).state;
  assert.equal(noDiff.records["owned:main~hero:tao-thao"].deleted, false);
});

test("M4. applyPull: trang rỗng có cursor server thấp hơn con trỏ local → về 0 và reset; trang rỗng bình thường giữ con trỏ", () => {
  const state = { ...emptyCloudState("u-alice"), cursor: 99 };
  const drifted = applyPull(state, [], 3);
  assert.equal(drifted.state.cursor, 0);
  assert.equal(drifted.reset, true);
  const same = applyPull(state, [], 99);
  assert.deepEqual([same.state.cursor, same.reset], [99, false]);
  const withRecords = applyPull(state, [tombstone("owned", "main~hero:x", "main", NOW, 5)], 5);
  assert.deepEqual([withRecords.state.cursor, withRecords.reset], [99, false], "trang có bản ghi không reset");
});

const FUTURE = Date.UTC(2030, 0, 1);
const NOW0 = Date.UTC(2026, 9, 21, 8, 0, 0);
const rejectAll = (sent, code) => sent.map((item) => ({ kind: item.kind, id: item.id, outcome: "rejected", code }));

test("L2. clock_skew: bản bị từ chối không kéo đồng hồ Lamport, dấu sau đó về lại gần giờ máy", () => {
  let state = putRecord(emptyCloudState("u"), { kind: "box", id: "b1", data: { name: "H" } }, { now: FUTURE });
  assert.equal(clockOf(state), FUTURE);
  const sent = pendingPush(state);
  state = applyResults(state, sent, rejectAll(sent, "clock_skew")).state;
  assert.equal(clockOf(state), 0, "bản chưa từng được server nhận không tính vào đồng hồ");
  assert.equal(nextStamp(state, NOW0), NOW0);
  const retry = putRecord(state, { kind: "box", id: "b1", data: { name: "H" } }, { now: NOW0 });
  assert.equal(retry.records["box:b1"].updatedAt, NOW0, "cùng nội dung vẫn được đóng dấu lại");
  assert.deepEqual(Object.keys(retry.dirty), ["box:b1"]);
});

test("H1. rejected: ghi lại cùng nội dung đóng dấu mới và vào dirty; ensureBoxDefaults dựng lại hộp bị từ chối", () => {
  let state = ensureBoxDefaults(emptyCloudState("u"), "main", { now: NOW0 });
  const sent = pendingPush(state);
  state = applyResults(state, sent, rejectAll(sent, "cap")).state;
  assert.deepEqual(state.dirty, {});
  assert.equal(pendingPush(state).length, 0);
  const again = ensureBoxDefaults(state, "main", { now: NOW0 + 10 });
  assert.notEqual(again, state);
  assert.deepEqual(pendingPush(again).map((item) => item.kind + ":" + item.id).sort(), ["box:main", "group:main~ghep-team", "group:main~khai-hoang"]);
});

test("H1. rejected: bản kéo về của server thắng bản bị từ chối kể cả khi dấu local lớn hơn", () => {
  let state = putRecord(emptyCloudState("u"), { kind: "box", id: "b1", data: { name: "Local" } }, { now: FUTURE });
  const sent = pendingPush(state);
  state = applyResults(state, sent, rejectAll(sent, "clock_skew")).state;
  const iso = new Date(NOW0).toISOString();
  const remote = { kind: "box", id: "b1", updatedAt: NOW0, rev: 3, deleted: false, data: { id: "b1", name: "Server", updatedAt: iso, deletedAt: "" } };
  const pulled = applyPull(state, [remote], 3).state;
  assert.equal(pulled.records["box:b1"].data.name, "Server");
});

test("L3. applyPull: bản sống của server thay bản xóa hộp local → cursor về 0 và reset để kéo lại các bản con", () => {
  let state = emptyCloudState("u");
  state = putRecord(state, { kind: "box", id: "b1", data: { name: "H" } }, { now: NOW0 });
  state = putRecord(state, { kind: "group", id: "b1~ghep-team", boxId: "b1", data: { name: "G", order: 1 } }, { now: NOW0 });
  state = removeRecord(state, "box", "b1", { now: NOW0 + 1 });
  state = { ...state, cursor: 9 };
  assert.equal(state.records["group:b1~ghep-team"], undefined);
  const iso = new Date(NOW0 + 100).toISOString();
  const remote = { kind: "box", id: "b1", updatedAt: NOW0 + 100, rev: 10, deleted: false, data: { id: "b1", name: "Server", updatedAt: iso, deletedAt: "" } };
  const applied = applyPull(state, [remote], 10);
  assert.equal(applied.reset, true);
  assert.equal(applied.state.cursor, 0);
});

test("L3. applyResults conflict: server còn hộp sống sau khi local xóa → cursor về 0", () => {
  let state = putRecord(emptyCloudState("u"), { kind: "box", id: "b1", data: { name: "H" } }, { now: NOW0 });
  state = removeRecord(state, "box", "b1", { now: NOW0 + 1 });
  state = { ...state, cursor: 9 };
  const sent = pendingPush(state);
  const iso = new Date(NOW0 + 100).toISOString();
  const server = { kind: "box", id: "b1", updatedAt: NOW0 + 100, rev: 10, deleted: false, data: { id: "b1", name: "Server", updatedAt: iso, deletedAt: "" } };
  const applied = applyResults(state, sent, [{ kind: "box", id: "b1", outcome: "conflict", server }]);
  assert.equal(applied.state.cursor, 0);
  assert.equal(applied.state.records["box:b1"].deleted, false);
});
