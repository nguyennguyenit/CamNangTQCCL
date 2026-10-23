import { test } from "node:test";
import assert from "node:assert/strict";
import { PENDING_KEY, PENDING_TTL_MS, clearPendingSave, completePendingSave, peekPendingSave, pendingIdForSource, stashPendingSave } from "../js/my-teams-pending.js";
import { fromRecommended } from "../js/my-teams-sources.js";
import { createMyTeamsApi } from "../js/my-teams-api.js";
import { ids, recommendedById } from "./support/my-teams-fixtures.mjs";
import { createRosterServer, eventTarget, fakeLocks, fakeTimers, httpError, memoryStorage } from "./support/roster-fake-server.mjs";

const NOW = Date.UTC(2026, 9, 21, 8, 0, 0);
const draftOf = (id = "team-pending") => fromRecommended(recommendedById("s27-han-hanshi-gong-1"), ids, { id }).draft;

/** Mọi lần ghi `localStorage` trong test này là lỗi: bộ nhớ đệm của "Đội của tôi" chỉ nằm trong bộ nhớ. */
function forbidLocalStorage() {
  const writes = [];
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => null, setItem: (key) => writes.push(key), removeItem: () => {}, clear: () => {} },
  });
  return {
    writes,
    restore() {
      if (original) Object.defineProperty(globalThis, "localStorage", original);
      else delete globalThis.localStorage;
    },
  };
}

test("#14 pending: stash → peek → clear; một mục, giữ draft.id, hết hạn sau 30 phút", () => {
  const storage = memoryStorage();
  assert.equal(PENDING_KEY, "tqccl:my-teams:pending-save");
  assert.equal(PENDING_TTL_MS, 30 * 60 * 1000);
  assert.equal(peekPendingSave({ storage, now: () => NOW }), null);

  const draft = draftOf("team-keep-id");
  assert.equal(stashPendingSave(draft, { storage, now: () => NOW }), true);
  assert.deepEqual(storage.keys(), [PENDING_KEY]);
  assert.equal(JSON.parse(storage.getItem(PENDING_KEY)).createdAt, NOW);
  assert.deepEqual(peekPendingSave({ storage, now: () => NOW + 60_000 }), draft, "peek giữ nguyên nháp và draft.id");
  assert.deepEqual(peekPendingSave({ storage, now: () => NOW + 60_000 }), draft, "peek không xóa");

  // Một mục: stash mới thay mục cũ.
  const other = draftOf("team-second");
  stashPendingSave(other, { storage, now: () => NOW + 1000 });
  assert.equal(peekPendingSave({ storage, now: () => NOW + 2000 }).id, "team-second");

  // Quá 30 phút → null và dọn mục hết hạn.
  assert.equal(peekPendingSave({ storage, now: () => NOW + 1000 + PENDING_TTL_MS + 1 }), null);
  assert.equal(storage.getItem(PENDING_KEY), null);

  // Dữ liệu hỏng → null, không ném, dọn mục.
  storage.setItem(PENDING_KEY, "{không phải json");
  assert.equal(peekPendingSave({ storage, now: () => NOW }), null);
  assert.equal(storage.getItem(PENDING_KEY), null);
  storage.setItem(PENDING_KEY, JSON.stringify({ draft: { id: "team-x", heroes: "hỏng" }, createdAt: NOW }));
  assert.equal(peekPendingSave({ storage, now: () => NOW }), null);

  // Storage đầy/bị chặn: stash trả false, không ném.
  const blocked = { getItem: () => null, setItem: () => { throw new Error("quota"); }, removeItem: () => {} };
  assert.equal(stashPendingSave(draft, { storage: blocked, now: () => NOW }), false);
  assert.equal(peekPendingSave({ storage: undefined, now: () => NOW }), null, "không có storage thì không có bản lưu dở");

  stashPendingSave(draft, { storage, now: () => NOW });
  clearPendingSave({ storage });
  assert.equal(peekPendingSave({ storage, now: () => NOW }), null);
});

test("#14 completePendingSave chỉ xóa khi server trả applied hoặc already-applied", () => {
  const storage = memoryStorage();
  const draft = draftOf();
  const stash = () => stashPendingSave(draft, { storage, now: () => NOW });
  const still = () => peekPendingSave({ storage, now: () => NOW })?.id === draft.id;

  for (const failure of [{ ok: false, rejected: true, code: "bytes" }, { ok: false, conflict: true, server: {} }, { ok: false, pending: true, code: "offline" }, null, undefined]) {
    stash();
    assert.equal(completePendingSave(failure, { storage, now: () => NOW }), false);
    assert.ok(still(), `lỗi ${JSON.stringify(failure)} thì bản lưu dở vẫn còn`);
  }
  for (const outcome of ["applied", "already-applied"]) {
    stash();
    assert.equal(completePendingSave({ ok: true, outcome, team: { id: draft.id } }, { storage, now: () => NOW }), true);
    assert.equal(still(), false, outcome);
  }
});

test("#14 lưu qua API: lỗi thì pending còn; mất phản hồi rồi thử lại cùng draft.id ra already-applied", async () => {
  const guard = forbidLocalStorage();
  try {
    const server = await createRosterServer({ userId: "u-alice" });
    const timers = fakeTimers();
    const api = createMyTeamsApi({
      api: server.api,
      loadSession: async () => ({ id: "u-alice", name: "Alice" }),
      signIn: async () => {},
      locks: fakeLocks(),
      timers,
      doc: eventTarget({ visibilityState: "visible" }),
      win: eventTarget(),
      now: () => NOW,
    });
    await api.load();

    const storage = memoryStorage();
    const draft = draftOf("team-retry");
    stashPendingSave(draft, { storage, now: () => NOW });

    // Lần đầu: server ghi xong nhưng phản hồi mất → chưa biết kết quả, không xóa bản lưu dở.
    server.dropResponse();
    const first = await api.saveTeam(peekPendingSave({ storage, now: () => NOW }));
    assert.equal(first.ok, false);
    assert.equal(first.pending, true);
    assert.equal(completePendingSave(first, { storage, now: () => NOW }), false);
    assert.equal(peekPendingSave({ storage, now: () => NOW })?.id, "team-retry");
    assert.equal(server.live("team").length, 1, "server đã ghi trước khi mất phản hồi");

    // Thử lại cùng draft.id: không sinh bản trùng, kết quả already-applied, rồi mới xóa bản lưu dở.
    const retry = await api.saveTeam(peekPendingSave({ storage, now: () => NOW }));
    assert.deepEqual({ ok: retry.ok, outcome: retry.outcome }, { ok: true, outcome: "already-applied" });
    assert.equal(completePendingSave(retry, { storage, now: () => NOW }), true);
    assert.equal(peekPendingSave({ storage, now: () => NOW }), null);
    assert.equal(server.live("team").length, 1);
    assert.deepEqual(guard.writes, [], "không ghi localStorage");
  } finally {
    guard.restore();
  }
});

test("saveTeam: applied, lỗi kiểm tra không gọi mạng, khách bị từ chối, xung đột trả bản server, rejected kèm code", async () => {
  const guard = forbidLocalStorage();
  try {
    const server = await createRosterServer({ userId: "u-alice" });
    let user = { id: "u-alice", name: "Alice" };
    let tamper = null;
    const open = () =>
      createMyTeamsApi({
        api: async (path, options) => {
          const response = await server.api(path, options);
          return tamper && options?.method === "POST" ? tamper(response) : response;
        },
        loadSession: async () => user,
        signIn: async () => {},
        locks: fakeLocks(),
        timers: fakeTimers(),
        doc: eventTarget({ visibilityState: "visible" }),
        win: eventTarget(),
        now: () => NOW,
      });
    const api = open();
    await api.load();

    const applied = await api.saveTeam(draftOf("team-one"), { defaultGroup: "khai-hoang" });
    assert.deepEqual({ ok: applied.ok, outcome: applied.outcome }, { ok: true, outcome: "applied" });
    const row = server.live("team")[0];
    assert.equal(row.boxId, "main");
    assert.equal(row.data.groupId, "main~khai-hoang");
    assert.ok(server.rows.has("box:main") && server.rows.has("group:main~khai-hoang") && server.rows.has("group:main~ghep-team"), "hộp và hai nhóm mặc định đi cùng lần lưu đầu");
    const posts = server.calls.filter((call) => call.method === "POST").length;

    // Lưu lại đúng bản đã lưu: server báo already-applied hoặc không đổi; sửa tên thì applied với cùng id.
    const renamed = await api.saveTeam({ ...draftOf("team-one"), name: "Tên đã sửa" });
    assert.equal(renamed.ok, true);
    assert.equal(server.live("team").length, 1);
    assert.equal(server.live("team")[0].data.name, "Tên đã sửa");

    // Lỗi kiểm tra: không gọi mạng.
    const bad = draftOf("team-bad");
    bad.name = "曹".repeat(61);
    const before = server.calls.length;
    const refused = await api.saveTeam(bad);
    assert.equal(refused.ok, false);
    assert.equal(refused.rejected, true);
    assert.equal(refused.code, "validation");
    assert.deepEqual(refused.errors, [{ field: "name", code: "bytes" }]);
    assert.equal(server.calls.length, before);
    assert.equal((await api.saveTeam({ id: "team-x", heroes: "hỏng" })).code, "schema");
    const four = draftOf("team-four");
    four.heroes.push(structuredClone(four.heroes[0]));
    assert.equal((await api.saveTeam(four)).code, "schema", "quá 3 tướng là sai hình dạng");

    // Xung đột: máy khác đã lưu bản mới hơn của cùng đội.
    const newer = (await api.saveTeam({ ...draftOf("team-conflict"), name: "Bản của máy này" })).ok;
    assert.equal(newer, true);
    const theirs = structuredClone(server.rows.get("team:team-conflict"));
    theirs.updatedAt += 60_000;
    theirs.data = { ...theirs.data, name: "Bản của máy khác", updatedAt: new Date(theirs.updatedAt).toISOString() };
    await server.seed({ kind: "team", id: "team-conflict", updatedAt: theirs.updatedAt, deleted: false, data: theirs.data });
    const conflict = await api.saveTeam({ ...draftOf("team-conflict"), name: "Sửa trên máy này" });
    assert.equal(conflict.ok, false);
    assert.equal(conflict.conflict, true);
    assert.equal(conflict.server.name, "Bản của máy khác");
    assert.equal(conflict.server.id, "team-conflict");

    // Rejected: server từ chối bản ghi → code của server.
    tamper = (response) => ({ ...response, results: response.results.map((item) => (item.kind === "team" ? { kind: item.kind, id: item.id, outcome: "rejected", code: "quota" } : item)) });
    const rejected = await api.saveTeam(draftOf("team-rejected"));
    assert.deepEqual({ ok: rejected.ok, rejected: rejected.rejected, code: rejected.code }, { ok: false, rejected: true, code: "quota" });
    tamper = null;
    assert.ok(posts >= 1);

    // Khách (chưa đăng nhập): không lưu, không gọi mạng.
    user = null;
    const guestApi = open();
    const calls = server.calls.length;
    const guest = await guestApi.saveTeam(draftOf("team-guest"));
    assert.deepEqual({ ok: guest.ok, rejected: guest.rejected, code: guest.code }, { ok: false, rejected: true, code: "guest" });
    assert.equal(server.calls.length, calls);
    assert.deepEqual(guard.writes, []);
  } finally {
    guard.restore();
  }
});

test("load: đội hợp lệ theo hộp, bản ghi hỏng bị bỏ qua kèm thông báo; ensureBoxDefaults idempotent; 401 thì chỉ đọc", async () => {
  const server = await createRosterServer({ userId: "u-alice" });
  let inject = null;
  const api = createMyTeamsApi({
    api: async (path, options) => {
      const response = await server.api(path, options);
      return inject && !options?.method ? inject(response) : response;
    },
    loadSession: async () => ({ id: "u-alice", name: "Alice" }),
    signIn: async () => {},
    locks: fakeLocks(),
    timers: fakeTimers(),
    doc: eventTarget({ visibilityState: "visible" }),
    win: eventTarget(),
    now: () => NOW,
  });
  await api.load();
  await api.saveTeam(draftOf("team-good"));

  const owned = { kind: "owned", id: "main~hero:cam-ninh", updatedAt: NOW, deleted: false, data: { id: "main~hero:cam-ninh", boxId: "main", item: "hero:cam-ninh", name: "Cam Ninh", type: "hero", updatedAt: new Date(NOW).toISOString(), deletedAt: "" } };
  await server.seed(owned);

  // Bản ghi `team` hỏng đến từ server (dữ liệu cũ/hỏng) không làm vỡ cả danh sách.
  inject = (response) => ({
    ...response,
    records: [
      ...response.records,
      { kind: "team", id: "team-broken", boxId: "main", updatedAt: NOW + 5, rev: 999, deleted: false, data: { id: "team-broken", boxId: "main", heroes: "hỏng", updatedAt: new Date(NOW + 5).toISOString(), deletedAt: "" } },
    ],
    cursor: 999,
  });
  await api.sync.syncNow();
  const snapshot = api.snapshot();
  assert.deepEqual(snapshot.teams.map((team) => team.id), ["team-good"]);
  assert.deepEqual(snapshot.skipped.map((item) => item.id), ["team-broken"]);
  assert.ok(snapshot.owned.get("main").has("hero:cam-ninh"));
  assert.deepEqual(snapshot.groups.map((group) => group.id).sort(), ["main~ghep-team", "main~khai-hoang"]);
  assert.deepEqual(snapshot.boxes.map((box) => box.id), ["main"]);

  const stamp = server.rev;
  assert.equal((await api.ensureBoxDefaults("main")).ok, true);
  await api.sync.syncNow();
  assert.equal(server.rev, stamp, "idempotent: không ghi thêm gì");
  assert.equal((await api.ensureBoxDefaults("box-phu")).ok, true);
  await api.sync.syncNow();
  assert.ok(server.rows.has("box:box-phu") && server.rows.has("group:box-phu~khai-hoang") && server.rows.has("group:box-phu~ghep-team"));

  // 401: giữ dữ liệu đã tải để đọc, lưu bị từ chối.
  server.fail(httpError(401, "unauthorized"));
  await api.sync.syncNow();
  assert.equal(api.snapshot().teams.length, 1);
  const refused = await api.saveTeam(draftOf("team-after-401"));
  assert.deepEqual({ ok: refused.ok, code: refused.code }, { ok: false, code: "signed-out" });
});

test("M1 completePendingSave: lưu đội KHÁC thành công không xóa bản lưu dở đang chờ", () => {
  const storage = memoryStorage();
  const draft = draftOf();
  stashPendingSave(draft, { storage, now: () => NOW });
  assert.equal(completePendingSave({ ok: true, outcome: "applied", team: { id: "team-khac" } }, { storage, now: () => NOW }), false);
  assert.equal(peekPendingSave({ storage, now: () => NOW })?.id, draft.id);
  assert.equal(completePendingSave({ ok: true, outcome: "applied" }, { storage, now: () => NOW }), false, "kết quả không có team.id không xóa");
});

test("M4 sau OAuth: lưu lại cùng nguồn dùng lại draft.id đang chờ nên hoàn tất xóa bản lưu dở (không phát lại thành đội trùng)", () => {
  const storage = memoryStorage();
  const draft = draftOf("team-x");
  stashPendingSave(draft, { storage, now: () => NOW });
  const key = `${draft.source.kind}:${draft.source.key}`;
  const reused = pendingIdForSource(key, { storage, now: () => NOW });
  assert.equal(reused, "team-x", "cùng nguồn → dùng lại id đang chờ");
  assert.equal(pendingIdForSource("recommended:nguon-khac", { storage, now: () => NOW }), null, "nguồn khác không dùng lại");
  assert.equal(completePendingSave({ ok: true, outcome: "applied", team: { id: reused } }, { storage, now: () => NOW }), true);
  assert.equal(peekPendingSave({ storage, now: () => NOW }), null, "bản lưu dở đã bị xóa, không còn gì để phát lại");
  stashPendingSave(draft, { storage, now: () => NOW });
  assert.equal(pendingIdForSource(key, { storage, now: () => NOW + PENDING_TTL_MS + 1 }), null, "hết hạn thì không dùng lại");
});
