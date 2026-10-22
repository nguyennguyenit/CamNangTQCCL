import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CLOUD_STORAGE_KEY,
  MERGED_STORAGE_KEY,
  boxes,
  ensureBoxDefaults,
  lockedOf,
  ownedOf,
  putRecord,
  recordKey,
  toScanState,
} from "../js/roster-cloud-store.js";
import { PUSH_CHUNK_SIZE, PUSH_DEBOUNCE_MS, createRosterSync } from "../js/roster-sync.js";
import { createRosterIdResolver } from "../js/roster-id-resolve.js";
import { addCanonicalItem, applyScanResult, createInitialRosterScanState } from "../js/roster-scan-state.js";
import { signOut } from "../js/community-api.js";
import { createRosterServer, eventTarget, fakeLocks, fakeTimers, httpError, memoryStorage } from "./support/roster-fake-server.mjs";

const load = (name) => JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url), "utf8"));
const heroesDict = load("heroes-dict.json");
const tacticsDict = load("tactics.json");
const resolve = createRosterIdResolver({ heroesDict, tacticsDict });

const ALICE = { id: "u-alice", name: "Alice" };
const BOB = { id: "u-bob", name: "Bob" };
const NOW = Date.UTC(2026, 9, 21, 8, 0, 0);
const tick = () => new Promise((done) => setImmediate(done));
const until = async (predicate) => {
  for (let i = 0; i < 200 && !predicate(); i += 1) await tick();
  assert.ok(predicate(), "điều kiện không đạt");
};

const owned = (name, item, type = "hero") => ({ kind: "owned", id: `main~${item}`, boxId: "main", data: { item, name, type } });

/** Một "tab": instance sync riêng, storage + locks dùng chung với tab khác. */
async function openTab({ server, storage, locks, user = ALICE, kinds, start = true, api, clock = { t: NOW } } = {}) {
  const tab = { statuses: [], conflicts: [], rejected: [], changes: 0, mismatches: 0, clock };
  tab.timers = fakeTimers();
  tab.doc = eventTarget({ visibilityState: "visible" });
  tab.win = eventTarget();
  tab.sync = createRosterSync({
    kinds,
    storage,
    locks,
    api: api || server.api,
    loadSession: async () => user,
    signIn: async () => {},
    timers: tab.timers,
    doc: tab.doc,
    win: tab.win,
    now: () => clock.t,
    onStatus: (status) => tab.statuses.push(status),
    onConflict: (conflict) => tab.conflicts.push(conflict),
    onRejected: (list) => tab.rejected.push(...list),
    onChange: () => (tab.changes += 1),
    onMismatch: () => (tab.mismatches += 1),
  });
  if (start) await tab.sync.start();
  return tab;
}

async function env(options = {}) {
  const server = await createRosterServer({ userId: options.userId || ALICE.id });
  const storage = memoryStorage();
  const locks = fakeLocks();
  return { server, storage, locks };
}

const blob = (storage) => JSON.parse(storage.getItem(CLOUD_STORAGE_KEY));
const postCalls = (server) => server.calls.filter((c) => c.method === "POST");

test("khởi động: kéo theo kinds của Gợi ý đội, trạng thái synced, blob cùng một giá trị {userId,cursor,records,dirty}", async () => {
  const e = await env();
  await e.server.seed({ kind: "box", id: "main", updatedAt: NOW - 1000, deleted: false, data: { id: "main", name: "Hộp", updatedAt: new Date(NOW - 1000).toISOString(), deletedAt: "" } });
  const tab = await openTab({ ...e, kinds: ["box", "owned", "season", "locked", "override"] });
  assert.equal(tab.sync.status(), "synced");
  const get = e.server.calls.find((c) => c.method === "GET");
  assert.match(get.path, /since=0/);
  assert.match(get.path, /kinds=box(%2C|,)owned(%2C|,)season(%2C|,)locked(%2C|,)override/);
  const saved = blob(e.storage);
  assert.equal(saved.userId, ALICE.id);
  assert.equal(saved.cursor, 1);
  assert.ok(saved.records["box:main"]);
  assert.deepEqual(saved.dirty, {});
  assert.deepEqual(boxes(tab.sync.state()).map((b) => b.id), ["main"]);
});

test("ghi: debounce 1,5 s rồi đẩy kèm expectedUserId, khóa chỉ được ghi khi đang giữ navigator.locks", async () => {
  const e = await env();
  e.storage.onWrite = (key) => {
    if (key === CLOUD_STORAGE_KEY) assert.ok(e.locks.held.has("tqccl-roster"), "ghi blob ngoài khóa");
  };
  const tab = await openTab(e);
  await tab.sync.mutate((state, { now }) => putRecord(ensureBoxDefaults(state, "main", { now }), owned("Mã Siêu", "hero:ma-sieu"), { now }));
  assert.deepEqual(tab.timers.delays(), [PUSH_DEBOUNCE_MS]);
  assert.equal(PUSH_DEBOUNCE_MS, 1500);
  assert.equal(postCalls(e.server).length, 0);
  await tab.timers.flush();
  const [post] = postCalls(e.server);
  assert.equal(post.json.expectedUserId, ALICE.id);
  assert.equal(post.json.records.length, 4);
  assert.equal(post.json.records[0].kind, "box");
  assert.equal(e.server.live("owned").length, 1);
  assert.deepEqual(blob(e.storage).dirty, {});
  assert.equal(tab.sync.status(), "synced");
});

test("đẩy theo khúc PUSH_CHUNK_SIZE = ROSTER_MAX_BATCH của server (12, gói Workers Free)", async () => {
  const e = await env();
  const tab = await openTab(e);
  await tab.sync.mutate((state, { now }) => {
    let next = ensureBoxDefaults(state, "main", { now });
    for (const hero of heroesDict.slice(0, 120)) next = putRecord(next, owned(hero.viet, hero.id), { now });
    for (const tactic of tacticsDict.slice(0, 400)) next = putRecord(next, owned(tactic.viet, tactic.id, "tactic"), { now });
    return next;
  });
  await tab.sync.syncNow();
  const posts = postCalls(e.server);
  assert.equal(PUSH_CHUNK_SIZE, 12);
  const sizes = posts.map((p) => p.json.records.length);
  assert.equal(sizes.reduce((a, b) => a + b, 0), 523);
  assert.deepEqual(sizes, [...Array(43).fill(12), 7]);
  assert.equal(e.server.live("owned").length, 520);
  assert.deepEqual(blob(e.storage).dirty, {});
});

test("5. gộp dở (mất mạng giữa lô) rồi chạy lại: server không nhân đôi, phần thiếu được đẩy tiếp", async () => {
  const e = await env();
  let posts = 0;
  const flaky = (path, options) => {
    if (options?.method === "POST" && (posts += 1) === 2) return Promise.reject(httpError(0, "network", { unavailable: true }));
    return e.server.api(path, options);
  };
  const tab = await openTab({ ...e, api: flaky });
  let scan = createInitialRosterScanState();
  for (const hero of heroesDict) scan = addCanonicalItem(scan, "heroes", hero.viet);
  for (const tactic of tacticsDict) scan = addCanonicalItem(scan, "tactics", tactic.viet);
  const merged = await tab.sync.mergeLocal(scan, resolve);
  assert.ok(merged.ok);
  await tab.sync.syncNow();
  assert.equal(tab.sync.status(), "offline");
  const partial = e.server.rows.size;
  assert.ok(partial > 0 && partial < heroesDict.length + tacticsDict.length);
  assert.ok(Object.keys(blob(e.storage).dirty).length > 0);
  // Chạy lại gộp (đã có cờ nhưng gộp là thuần "chỉ tạo khóa chưa có") và đẩy tiếp.
  await tab.sync.mergeLocal(scan, resolve);
  await tab.sync.syncNow();
  assert.equal(tab.sync.status(), "synced");
  assert.equal(e.server.live("owned").length, heroesDict.length + tacticsDict.length);
  assert.deepEqual(blob(e.storage).dirty, {});
});

test("6. người dùng từ chối gộp: không tạo gì, cờ 'đã hỏi', lần sau (instance mới) không hỏi lại", async () => {
  const e = await env();
  const tab = await openTab(e);
  assert.equal(tab.sync.mergeStatus(), "none");
  tab.sync.declineMerge();
  assert.equal(tab.sync.mergeStatus(), "declined");
  assert.deepEqual(Object.keys(tab.sync.state().records), []);
  assert.equal(postCalls(e.server).length, 0);
  const again = await openTab(e);
  assert.equal(again.sync.mergeStatus(), "declined");
  assert.deepEqual(JSON.parse(e.storage.getItem(MERGED_STORAGE_KEY)), { [ALICE.id]: "declined" });
});

test("gộp đồng ý đẩy kho local (món thêm tay không có canonicalId) và đặt cờ merged", async () => {
  const e = await env();
  const tab = await openTab(e);
  let scan = createInitialRosterScanState();
  scan = addCanonicalItem(scan, "heroes", "Mã Siêu");
  scan = addCanonicalItem(scan, "tactics", "Đương Phong Thôi Quyết");
  scan = applyScanResult(scan, "builtTeams", { teams: [{ teamName: "Đội", heroes: ["Mã Siêu"], tactics: ["An Ủi Quân Dân"] }] });
  scan = { ...scan, seasonId: "season-s5" };
  const result = await tab.sync.mergeLocal(scan, resolve);
  assert.deepEqual(result.localOnly.heroes, []);
  assert.equal(tab.sync.mergeStatus(), "merged");
  await tab.sync.syncNow();
  assert.equal(e.server.live("owned").length, 2);
  assert.equal(e.server.live("locked").length, 1);
  assert.equal(e.server.live("season").length, 1);
  assert.equal(e.server.live("group").length, 0, "Gợi ý đội không kéo group nên không dựng nhóm mặc định");
  assert.equal(postCalls(e.server)[0].json.records.every((r) => r.data.updatedAt), true);
  const second = await openTab({ ...e, storage: memoryStorage() });
  assert.deepEqual(toScanState(second.sync.state(), "main").ownedHeroes.map((h) => h.name), ["Mã Siêu"]);
});

test("7. đổi tài khoản A → B → A: cờ theo userId, cache của A không lộ cho B", async () => {
  const storage = memoryStorage();
  const locks = fakeLocks();
  const serverA = await createRosterServer({ userId: ALICE.id });
  const serverB = await createRosterServer({ userId: BOB.id });
  const a1 = await openTab({ server: serverA, storage, locks, user: ALICE });
  let scan = addCanonicalItem(createInitialRosterScanState(), "heroes", "Mã Siêu");
  await a1.sync.mergeLocal(scan, resolve);
  await a1.sync.syncNow();
  assert.equal(a1.sync.mergeStatus(), "merged");

  const b = await openTab({ server: serverB, storage, locks, user: BOB });
  assert.equal(blob(storage).userId, BOB.id);
  assert.deepEqual(Object.keys(b.sync.state().records), [], "cache của A không lộ cho B");
  assert.equal(b.sync.mergeStatus(), "none");
  assert.equal(postCalls(serverB).length, 0);

  const a2 = await openTab({ server: serverA, storage, locks, user: ALICE });
  assert.equal(a2.sync.mergeStatus(), "merged", "A không bị hỏi gộp lại");
  assert.deepEqual(ownedOf(a2.sync.state(), "main").map((o) => o.item), ["hero:ma-sieu"], "kéo lại từ server của A");
  assert.equal(postCalls(serverA).length, 1, "không đẩy lại gì");
});

test("8a. tab 1 còn dirty của A, tab 2 đăng xuất A rồi đăng nhập B: tab 1 không đẩy gì vào B", async () => {
  const storage = memoryStorage();
  const locks = fakeLocks();
  const serverA = await createRosterServer({ userId: ALICE.id });
  const serverB = await createRosterServer({ userId: BOB.id });
  const tab1 = await openTab({ server: serverA, storage, locks, user: ALICE });
  await tab1.sync.mutate((state, { now }) => putRecord(ensureBoxDefaults(state, "main", { now }), owned("Mã Siêu", "hero:ma-sieu"), { now }));
  assert.equal(tab1.timers.size, 1);
  storage.removeItem(CLOUD_STORAGE_KEY); // signOut ở tab 2
  await openTab({ server: serverB, storage, locks, user: BOB });
  await tab1.timers.flush();
  assert.equal(postCalls(serverA).length, 0);
  assert.equal(postCalls(serverB).length, 0);
  assert.equal(tab1.sync.status(), "mismatch");
  assert.equal(tab1.mismatches, 1);
  assert.equal(tab1.timers.size, 0, "timer dừng");
  assert.equal(blob(storage).userId, BOB.id, "blob của B không bị ghi đè");
  assert.deepEqual(Object.keys(blob(storage).records), []);
  assert.deepEqual((await tab1.sync.mutate((s) => s)).ok, false, "UI khóa");
});

test("8b. user_mismatch từ server (lọt qua so userId): dừng timer, khóa, không áp kết quả", async () => {
  const e = await env({ userId: BOB.id }); // cookie là của B, tab vẫn nghĩ là A
  const readOnly = (path, options) => (options?.method === "POST" ? e.server.api(path, options) : Promise.resolve({ userId: ALICE.id, records: [], cursor: 0, more: false }));
  const tab = await openTab({ ...e, user: ALICE, api: readOnly });
  await tab.sync.mutate((state, { now }) => putRecord(ensureBoxDefaults(state, "main", { now }), owned("Mã Siêu", "hero:ma-sieu"), { now }));
  await tab.timers.flush();
  assert.equal(postCalls(e.server).length, 1);
  assert.equal(tab.sync.status(), "mismatch");
  assert.equal(tab.mismatches, 1);
  assert.equal(tab.timers.size, 0);
  assert.equal(e.server.rows.size, 0);
  assert.equal((await tab.sync.mutate((s) => s)).ok, false);
});

test("8c. phản hồi muộn của phiên A bị bỏ khi chủ cache đã đổi sang B", async () => {
  const storage = memoryStorage();
  const locks = fakeLocks();
  const serverA = await createRosterServer({ userId: ALICE.id });
  const serverB = await createRosterServer({ userId: BOB.id });
  const tab1 = await openTab({ server: serverA, storage, locks, user: ALICE });
  await tab1.sync.mutate((state, { now }) => putRecord(ensureBoxDefaults(state, "main", { now }), owned("Mã Siêu", "hero:ma-sieu"), { now }));
  const release = serverA.holdNext();
  const pending = tab1.timers.flush();
  await until(() => postCalls(serverA).length === 1);
  storage.removeItem(CLOUD_STORAGE_KEY);
  await openTab({ server: serverB, storage, locks, user: BOB });
  release();
  await pending;
  assert.equal(blob(storage).userId, BOB.id);
  assert.deepEqual(blob(storage).records, {});
  assert.equal(tab1.sync.status(), "mismatch");
  assert.equal(tab1.conflicts.length + tab1.rejected.length, 0);
});

test("10. sửa X@11 trong lúc X@10 đang gửi: phản hồi X@10 không xóa X khỏi dirty, X@11 được đẩy lượt sau", async () => {
  const e = await env();
  const tab = await openTab(e);
  await tab.sync.mutate((state, { now }) => putRecord(ensureBoxDefaults(state, "main", { now }), { ...owned("Mã Siêu", "hero:ma-sieu"), data: { item: "hero:ma-sieu", name: "Mã Siêu", type: "hero", redStars: 1 } }, { now }));
  const key = recordKey("owned", "main~hero:ma-sieu");
  const sentAt = tab.sync.state().records[key].updatedAt;
  const release = e.server.holdNext();
  const inFlight = tab.sync.syncNow();
  await until(() => postCalls(e.server).length === 1);
  await tab.sync.mutate((state, { now }) => putRecord(state, { ...owned("Mã Siêu", "hero:ma-sieu"), data: { item: "hero:ma-sieu", name: "Mã Siêu", type: "hero", redStars: 2 } }, { now }));
  const editedAt = tab.sync.state().records[key].updatedAt;
  assert.ok(editedAt > sentAt);
  release();
  await inFlight;
  assert.equal(blob(e.storage).dirty[key], editedAt, "X@11 vẫn dirty");
  assert.equal(e.server.rows.get(key).updatedAt, sentAt);
  await tab.sync.syncNow();
  assert.equal(e.server.rows.get(key).updatedAt, editedAt);
  assert.equal(e.server.rows.get(key).data.redStars, 2);
  assert.equal(blob(e.storage).dirty[key], undefined);
});

test("11. already-applied (gửi lại sau mất phản hồi): ACK, không báo xung đột", async () => {
  const e = await env();
  const tab = await openTab(e);
  await tab.sync.mutate((state, { now }) => putRecord(ensureBoxDefaults(state, "main", { now }), owned("Mã Siêu", "hero:ma-sieu"), { now }));
  e.server.dropResponse(); // server ghi rồi mất phản hồi
  await tab.timers.flush();
  assert.equal(tab.sync.status(), "offline");
  assert.ok(Object.keys(blob(e.storage).dirty).length > 0);
  // Đẩy lại chỉ POST (không kéo): server trả already-applied.
  tab.sync.schedulePush();
  await tab.timers.flush();
  assert.deepEqual(blob(e.storage).dirty, {});
  assert.equal(tab.conflicts.length, 0);
  assert.equal(tab.rejected.length, 0);
  assert.equal(tab.sync.status(), "synced");
  assert.equal(e.server.live("owned").length, 1);
});

test("12. conflict (server mới hơn, và hòa khác payload): nhận bản server, phát conflict kèm bản thua", async () => {
  const e = await env();
  const tab = await openTab(e);
  await tab.sync.mutate((state, { now }) => putRecord(ensureBoxDefaults(state, "main", { now }), owned("Mã Siêu", "hero:ma-sieu"), { now }));
  await tab.timers.flush();
  const key = recordKey("owned", "main~hero:ma-sieu");

  // Máy khác ghi bản mới hơn; tab này sửa (chưa biết) rồi đẩy -> conflict.
  const iso = (ms) => new Date(ms).toISOString();
  const other = tab.sync.state().records[key].updatedAt + 5000;
  await e.server.seed({ kind: "owned", id: "main~hero:ma-sieu", updatedAt: other, deleted: false, data: { id: "main~hero:ma-sieu", boxId: "main", item: "hero:ma-sieu", name: "Mã Siêu", type: "hero", redStars: 5, updatedAt: iso(other), deletedAt: "" } });
  await tab.sync.mutate((state, { now }) => putRecord(state, { ...owned("Mã Siêu", "hero:ma-sieu"), data: { item: "hero:ma-sieu", name: "Mã Siêu", type: "hero", redStars: 1 } }, { now }));
  await tab.timers.flush();
  assert.equal(tab.conflicts.length, 1);
  assert.equal(tab.conflicts[0].loser.data.redStars, 1);
  assert.equal(tab.conflicts[0].server.data.redStars, 5);
  assert.equal(tab.sync.state().records[key].data.redStars, 5);
  assert.equal(blob(e.storage).dirty[key], undefined);

  // Hòa updatedAt khác payload.
  await tab.sync.mutate((state, { now }) => putRecord(state, { ...owned("Mã Siêu", "hero:ma-sieu"), data: { item: "hero:ma-sieu", name: "Mã Siêu", type: "hero", redStars: 2 } }, { now }));
  const mine = tab.sync.state().records[key].updatedAt;
  e.server.rows.get(key).updatedAt = mine; // server có bản cùng dấu, payload khác
  e.server.rows.get(key).data = { ...e.server.rows.get(key).data, redStars: 4, updatedAt: iso(mine) };
  await tab.timers.flush();
  assert.equal(tab.conflicts.length, 2);
  assert.equal(tab.conflicts[1].loser.data.redStars, 2);
  assert.equal(tab.sync.state().records[key].data.redStars, 4);
});

test("13. rejected: bản đó ra khỏi dirty, vào danh sách bị từ chối kèm sự kiện; bản khác vẫn ACK", async () => {
  const e = await env();
  const tab = await openTab(e);
  await tab.sync.mutate((state, { now }) => {
    let next = ensureBoxDefaults(state, "main", { now });
    next = putRecord(next, owned("Mã Siêu", "hero:ma-sieu"), { now });
    // `item` sai dạng id -> server `schema`.
    return putRecord(next, { kind: "owned", id: "main~hero:Bad_Item", boxId: "main", data: { item: "hero:Bad_Item", name: "Hỏng", type: "hero" } }, { now });
  });
  await tab.timers.flush();
  const dirty = blob(e.storage).dirty;
  assert.deepEqual(dirty, {});
  assert.equal(tab.rejected.length, 1);
  assert.equal(tab.rejected[0].code, "schema");
  assert.equal(tab.rejected[0].key, "owned:main~hero:Bad_Item");
  assert.equal(tab.rejected[0].record.data.name, "Hỏng", "giữ nội dung");
  assert.equal(tab.sync.rejected().length, 1);
  assert.equal(e.server.live("owned").length, 1);
  assert.equal(blob(e.storage).rejected.length, 1);
  tab.sync.dismissRejected("owned:main~hero:Bad_Item");
  assert.equal(tab.sync.rejected().length, 0);
});

test("15. hai tab: A và B cùng đọc S, A ghi X, B ghi Y trước khi có sự kiện storage: blob có cả X và Y, cả hai lên server", async () => {
  const e = await env();
  const a = await openTab(e);
  await a.sync.mutate((state, { now }) => ensureBoxDefaults(state, "main", { now }));
  await a.sync.syncNow();
  const b = await openTab(e);
  assert.ok(b.sync.state().records["box:main"]);
  // Ghi đồng thời (không dispatch `storage` cho tab nào).
  await Promise.all([
    a.sync.mutate((state, { now }) => putRecord(state, owned("Mã Siêu", "hero:ma-sieu"), { now })),
    b.sync.mutate((state, { now }) => putRecord(state, owned("Tào Tháo", "hero:tao-thao"), { now })),
  ]);
  const saved = blob(e.storage);
  assert.ok(saved.records["owned:main~hero:ma-sieu"] && saved.records["owned:main~hero:tao-thao"], "blob có cả X và Y");
  assert.ok(saved.dirty["owned:main~hero:ma-sieu"] && saved.dirty["owned:main~hero:tao-thao"], "dirty có cả hai");
  await a.sync.syncNow();
  assert.deepEqual(e.server.live("owned").map((r) => r.id).sort(), ["main~hero:ma-sieu", "main~hero:tao-thao"]);
  await b.sync.syncNow();
  assert.deepEqual(ownedOf(b.sync.state(), "main").map((o) => o.item).sort(), ["hero:ma-sieu", "hero:tao-thao"]);
  assert.deepEqual(blob(e.storage).dirty, {});
});

test("sự kiện storage chỉ kích hoạt gộp: không thay state đang dirty bằng snapshot", async () => {
  const e = await env();
  const a = await openTab(e);
  const b = await openTab(e);
  await a.sync.mutate((state, { now }) => putRecord(ensureBoxDefaults(state, "main", { now }), owned("Mã Siêu", "hero:ma-sieu"), { now }));
  const before = a.changes;
  await b.win.dispatch("storage", { key: CLOUD_STORAGE_KEY });
  // Tab b thấy bản ghi của a.
  assert.deepEqual(ownedOf(b.sync.state(), "main").map((o) => o.item), ["hero:ma-sieu"]);
  await b.sync.mutate((state, { now }) => putRecord(state, owned("Tào Tháo", "hero:tao-thao"), { now }));
  await a.win.dispatch("storage", { key: CLOUD_STORAGE_KEY });
  assert.ok(a.changes > before);
  assert.deepEqual(ownedOf(a.sync.state(), "main").map((o) => o.item).sort(), ["hero:ma-sieu", "hero:tao-thao"]);
  assert.ok(a.sync.state().dirty["owned:main~hero:ma-sieu"], "dirty của a còn nguyên");
  await a.win.dispatch("storage", { key: "khac" });
});

test("16. 401 giữa chừng: signed-out, kho cloud chỉ đọc, không đổi sang kho local", async () => {
  const e = await env();
  const tab = await openTab(e);
  await tab.sync.mutate((state, { now }) => putRecord(ensureBoxDefaults(state, "main", { now }), owned("Mã Siêu", "hero:ma-sieu"), { now }));
  await tab.sync.syncNow();
  e.server.fail(httpError(401, "unauthorized"));
  await tab.sync.syncNow();
  assert.equal(tab.sync.status(), "signed-out");
  assert.equal(tab.timers.size, 0);
  const refused = await tab.sync.mutate((state, { now }) => putRecord(state, owned("Tào Tháo", "hero:tao-thao"), { now }));
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, "signed-out");
  assert.deepEqual(ownedOf(tab.sync.state(), "main").map((o) => o.item), ["hero:ma-sieu"], "vẫn đọc được kho cloud");
  assert.ok(e.storage.getItem(CLOUD_STORAGE_KEY), "không xóa cache");
  assert.equal(e.storage.getItem("tqccl.rosterRecommend.scanState.v1"), null, "không đụng kho local");
});

test("offline: lỗi mạng giữ dirty, `online` và visibilitychange đồng bộ lại", async () => {
  const e = await env();
  const tab = await openTab(e);
  await tab.sync.mutate((state, { now }) => putRecord(ensureBoxDefaults(state, "main", { now }), owned("Mã Siêu", "hero:ma-sieu"), { now }));
  e.server.fail(httpError(0, "network", { unavailable: true }));
  await tab.timers.flush();
  assert.equal(tab.sync.status(), "offline");
  assert.ok(Object.keys(blob(e.storage).dirty).length > 0);
  e.server.fail(null);
  await tab.win.dispatch("online");
  assert.equal(tab.sync.status(), "synced");
  assert.equal(e.server.live("owned").length, 1);
  e.server.fail(httpError(500, "boom"));
  await tab.doc.dispatch("visibilitychange");
  assert.equal(tab.sync.status(), "error");
});

test("khách (không có phiên): trạng thái guest, không gọi API, mutate bị từ chối", async () => {
  const e = await env();
  const tab = await openTab({ ...e, user: null });
  assert.equal(tab.sync.status(), "guest");
  assert.equal(e.server.calls.length, 0);
  assert.equal((await tab.sync.mutate((s) => s)).reason, "guest");
  assert.equal(e.storage.getItem(CLOUD_STORAGE_KEY), null);
});

test("kinds rộng hơn cache đã kéo: kéo lại từ đầu; cache rộng hơn thì giữ phạm vi rộng để cursor đúng", async () => {
  const e = await env();
  const narrow = await openTab({ ...e, kinds: ["box", "owned"] });
  assert.deepEqual(blob(e.storage).pulledKinds, ["box", "owned"]);
  await e.server.seed({ kind: "box", id: "main", updatedAt: NOW, deleted: false, data: { id: "main", name: "H", updatedAt: new Date(NOW).toISOString(), deletedAt: "" } });
  await narrow.sync.syncNow();
  assert.ok(blob(e.storage).cursor > 0);
  const wide = await openTab({ ...e, kinds: ["box", "owned", "team"] });
  const gets = e.server.calls.filter((c) => c.method === "GET");
  assert.match(gets.at(-1).path, /since=0/);
  assert.deepEqual(blob(e.storage).pulledKinds, ["box", "owned", "team"]);
  const again = await openTab({ ...e, kinds: ["box", "owned"] });
  assert.match(e.server.calls.filter((c) => c.method === "GET").at(-1).path, /team/);
  assert.equal(wide.sync.status(), "synced");
  assert.equal(again.sync.status(), "synced");
});

test("17. signOut xóa tqccl.roster.cloud.v1 trước khi tải lại trang", async () => {
  const store = memoryStorage({ [CLOUD_STORAGE_KEY]: "{}", "tqccl:community-session": "1" });
  const saved = { fetch: globalThis.fetch, localStorage: globalThis.localStorage, location: globalThis.location };
  let reloaded = false;
  globalThis.localStorage = store;
  globalThis.location = { reload: () => (reloaded = true), href: "https://tqccl.test/" };
  globalThis.fetch = async () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  try {
    await signOut();
  } finally {
    Object.assign(globalThis, saved);
    for (const [key, value] of Object.entries(saved)) if (value === undefined) delete globalThis[key];
  }
  assert.equal(reloaded, true);
  assert.equal(store.getItem(CLOUD_STORAGE_KEY), null);
  assert.equal(store.getItem("tqccl:community-session"), null);
});

test("lockedOf/boxes đọc được sau tải lại trang (blob là nguồn duy nhất của cache)", async () => {
  const e = await env();
  const a = await openTab(e);
  let scan = applyScanResult(createInitialRosterScanState(), "builtTeams", { teams: [{ teamName: "Đội", heroes: ["Mã Siêu"], tactics: ["An Ủi Quân Dân"] }] });
  await a.sync.mergeLocal(scan, resolve);
  await a.sync.syncNow();
  const reopened = await openTab({ ...e, api: () => Promise.reject(httpError(0, "network", { unavailable: true })) });
  assert.equal(lockedOf(reopened.sync.state(), "main").length, 1);
  assert.equal(reopened.sync.status(), "offline");
});

test("H2 (A). tab của Alice còn mở, tab khác đăng xuất rồi Bob đăng nhập: lần kéo khi tab hiện lại vào mismatch, không trộn dữ liệu của Bob", async () => {
  const e = await env();
  const tab = await openTab({ ...e, storage: memoryStorage() });
  await e.server.seed({ kind: "box", id: "main", updatedAt: NOW - 1000, deleted: false, data: { id: "main", name: "Của Alice", updatedAt: new Date(NOW - 1000).toISOString(), deletedAt: "" } });
  await tab.sync.syncNow();
  const cursor = tab.sync.state().cursor;
  e.server.userId = BOB.id;
  await e.server.seed({ kind: "box", id: "box-bob", updatedAt: NOW - 500, deleted: false, data: { id: "box-bob", name: "Của Bob", updatedAt: new Date(NOW - 500).toISOString(), deletedAt: "" } });
  await tab.doc.dispatch("visibilitychange");
  assert.equal(tab.sync.status(), "mismatch");
  assert.equal(tab.mismatches, 1);
  assert.equal(tab.sync.state().records["box:box-bob"], undefined, "bản ghi của Bob không được áp");
  assert.equal(tab.sync.state().cursor, cursor);
  assert.equal(postCalls(e.server).length, 0);
});

test("H2 (B). blob lưu của Alice, phiên server đã là Bob: kéo không ghi bản ghi/con trỏ của Bob vào blob", async () => {
  const e = await env();
  const first = await openTab(e);
  await first.sync.mutate((state, { now }) => ensureBoxDefaults(state, "main", { now }));
  await first.sync.syncNow();
  const before = e.storage.getItem(CLOUD_STORAGE_KEY);
  e.server.userId = BOB.id;
  await e.server.seed({ kind: "box", id: "box-bob", updatedAt: NOW + 500, deleted: false, data: { id: "box-bob", name: "Của Bob", updatedAt: new Date(NOW + 500).toISOString(), deletedAt: "" } });
  const second = await openTab({ ...e, user: ALICE });
  assert.equal(second.sync.status(), "mismatch");
  assert.equal(e.storage.getItem(CLOUD_STORAGE_KEY), before, "blob không đổi");
});

test("H2. signOut xóa cache roster kể cả khi gọi sign-out thất bại", async () => {
  const store = memoryStorage({ [CLOUD_STORAGE_KEY]: "{}" });
  const saved = { fetch: globalThis.fetch, localStorage: globalThis.localStorage, location: globalThis.location };
  globalThis.localStorage = store;
  globalThis.location = { reload: () => {}, href: "https://tqccl.test/" };
  globalThis.fetch = async () => new Response("{}", { status: 500, headers: { "content-type": "application/json" } });
  try {
    await assert.rejects(signOut());
  } finally {
    Object.assign(globalThis, saved);
    for (const [key, value] of Object.entries(saved)) if (value === undefined) delete globalThis[key];
  }
  assert.equal(store.getItem(CLOUD_STORAGE_KEY), null);
});

test("M4. con trỏ local vượt server (D1 khôi phục): trang rỗng → về 0 và kéo lại đủ bản ghi", async () => {
  const e = await env();
  await e.server.seed({ kind: "box", id: "main", updatedAt: NOW - 1000, deleted: false, data: { id: "main", name: "Hộp", updatedAt: new Date(NOW - 1000).toISOString(), deletedAt: "" } });
  const first = await openTab(e);
  assert.equal(first.sync.state().cursor, 1);
  const stale = { ...blob(e.storage), cursor: 99, records: {} };
  e.storage.setItem(CLOUD_STORAGE_KEY, JSON.stringify(stale));
  const tab = await openTab(e);
  assert.ok(tab.sync.state().records["box:main"], "bản ghi bị bỏ sót đã được kéo lại");
  assert.equal(tab.sync.state().cursor, 1);
  const gets = e.server.calls.filter((c) => c.method === "GET").map((c) => c.path.match(/since=(\d+)/)[1]);
  assert.deepEqual(gets.slice(-2), ["99", "0"]);
});

test("M5. chưa kéo được (offline) thì không dựng hộp/nhóm mặc định; có mạng lại thì bản của server (đổi tên hộp từ máy khác) được giữ", async () => {
  const e = await env();
  await e.server.seed({ kind: "box", id: "main", updatedAt: NOW - 5000, deleted: false, data: { id: "main", name: "Hộp đã đổi tên", updatedAt: new Date(NOW - 5000).toISOString(), deletedAt: "" } });
  let online = false;
  const api = (path, options) => (online ? e.server.api(path, options) : Promise.reject(httpError(0, "network", { unavailable: true })));
  const tab = await openTab({ ...e, kinds: ["box", "group", "team", "owned"], api });
  assert.equal(tab.sync.status(), "offline");
  const refused = await tab.sync.mutateAfterPull((state, { now }) => ensureBoxDefaults(state, "main", { now }));
  assert.deepEqual(refused, { ok: false, reason: "offline" });
  assert.equal(tab.sync.state().records["box:main"], undefined, "không dựng hộp chính khi chưa kéo");
  online = true;
  await tab.doc.dispatch("visibilitychange");
  assert.equal(tab.sync.status(), "synced");
  const ensured = await tab.sync.mutateAfterPull((state, { now }) => ensureBoxDefaults(state, "main", { now }));
  assert.deepEqual(ensured, { ok: true });
  assert.equal(boxes(tab.sync.state())[0].name, "Hộp đã đổi tên");
  await tab.timers.flush();
  assert.equal(postCalls(e.server).flatMap((c) => c.json.records).some((r) => r.kind === "box"), false, "không đẩy lại bản ghi hộp");
  assert.equal(e.server.live("group").length, 2, "nhóm mặc định được dựng sau lần kéo có phủ group");
});

test("M5. Gợi ý đội (không kéo group): ensureMainBox chỉ dựng hộp, không đụng nhóm", async () => {
  const e = await env();
  const tab = await openTab(e);
  assert.deepEqual(await tab.sync.ensureMainBox(), { ok: true });
  await tab.timers.flush();
  assert.deepEqual(e.server.live("box").map((r) => r.id), ["main"]);
  assert.equal(e.server.live("group").length, 0);
});

test("L1. tab A đẩy xong: tab B còn giữ dirty cũ không đẩy lại bản đã được ACK", async () => {
  const e = await env();
  const a = await openTab(e);
  const b = await openTab(e);
  await a.sync.mutate((state, { now }) => putRecord(ensureBoxDefaults(state, "main", { now }), owned("Mã Siêu", "hero:ma-sieu"), { now }));
  await b.win.dispatch("storage", { key: CLOUD_STORAGE_KEY });
  assert.ok(Object.keys(b.sync.state().dirty).length > 0, "B đã gộp dirty của A");
  await a.timers.flush();
  assert.equal(postCalls(e.server).length, 1);
  b.sync.schedulePush();
  await b.timers.flush();
  assert.equal(postCalls(e.server).length, 1, "B không gửi lại");
  assert.deepEqual(blob(e.storage).dirty, {});
});

test("17b. khóa cache trong community-api.js khớp CLOUD_STORAGE_KEY", () => {
  const source = readFileSync(new URL("../js/community-api.js", import.meta.url), "utf8");
  assert.ok(source.includes(`'${CLOUD_STORAGE_KEY}'`), "community-api.js phải dùng đúng khóa cache roster");
});
