import { test } from "node:test";
import assert from "node:assert/strict";
import { PUSH_DEBOUNCE_MS, SYNC_META_KEY, createRecruitSync } from "../js/recruit-sync.js";
import {
  createAccount,
  createDefaultRecruitTrackerState,
  mergeRecruitRecords,
  mergeRecruitTrackerState,
  recordDailyMisses,
  recruitRecords,
  renameAccount,
} from "../js/recruit-tracker-store.js";

const USER = { id: "u-alice", name: "Alice" };
const at = (minute) => new Date(Date.UTC(2026, 8, 1, 8, minute)).toISOString();

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => void data.set(key, String(value)),
    removeItem: (key) => void data.delete(key),
  };
}

/** Server giả theo hợp đồng /api/recruit: LWW theo updatedAt, rev tăng dần mỗi dòng được ghi, trang 500. */
function fakeServer({ pageSize = 500 } = {}) {
  const rows = new Map();
  let rev = 0;
  const calls = [];
  let failure = null;
  const server = {
    calls,
    rows,
    get rev() {
      return rev;
    },
    fail(error) {
      failure = error;
    },
    write(record) {
      const key = `${record.kind}:${record.id}`;
      const old = rows.get(key);
      if (old && record.updatedAt <= old.updatedAt) return 0;
      rows.set(key, { ...structuredClone(record), rev: ++rev });
      return 1;
    },
    async api(path, { method = "GET", json } = {}) {
      calls.push({ path, method, json: json && structuredClone(json) });
      if (failure) throw failure;
      const url = new URL(path, "https://tqccl.test");
      assert.equal(url.pathname, "/api/recruit");
      if (method === "POST") {
        assert.ok(json.records.length <= 500, "tối đa 500 bản ghi mỗi lô");
        let accepted = 0;
        for (const record of json.records) accepted += server.write(record);
        return { accepted, cursor: rev };
      }
      const since = Number(url.searchParams.get("since") || 0);
      const newer = [...rows.values()].filter((r) => r.rev > since).sort((a, b) => a.rev - b.rev);
      const page = newer.slice(0, pageSize);
      return {
        records: page.map(({ rev: _rev, ...r }) => r),
        cursor: page.length ? page[page.length - 1].rev : rev,
        more: newer.length > pageSize,
      };
    },
  };
  return server;
}

function fakeTimers() {
  const pending = new Map();
  let seq = 0;
  return {
    setTimeout(fn, ms) {
      pending.set(++seq, { fn, ms });
      return seq;
    },
    clearTimeout(id) {
      pending.delete(id);
    },
    get size() {
      return pending.size;
    },
    async flush() {
      const due = [...pending.values()];
      pending.clear();
      for (const { fn } of due) await fn();
    },
    delays: () => [...pending.values()].map((t) => t.ms),
  };
}

function eventTarget(props = {}) {
  const handlers = {};
  return {
    ...props,
    addEventListener(type, fn) {
      (handlers[type] ||= []).push(fn);
    },
    async dispatch(type) {
      for (const fn of handlers[type] || []) await fn();
    },
  };
}

function setup({ user = USER, state = createDefaultRecruitTrackerState(), storage = memoryStorage(), server = fakeServer(), sessionError = null, signInError = null } = {}) {
  const ctx = { state, statuses: [], applied: [], sessionCalls: [], signIns: 0, sessionError };
  ctx.server = server;
  ctx.storage = storage;
  ctx.timers = fakeTimers();
  ctx.doc = eventTarget({ visibilityState: "visible" });
  ctx.win = eventTarget();
  ctx.sync = createRecruitSync({
    storage,
    getState: () => ctx.state,
    applyRemote: (records) => {
      ctx.applied.push(records);
      ctx.state = mergeRecruitRecords(ctx.state, records);
    },
    onStatus: (status) => ctx.statuses.push(status),
    api: server.api,
    loadSession: async (opts) => {
      ctx.sessionCalls.push(opts);
      if (ctx.sessionError) throw ctx.sessionError;
      return user;
    },
    signIn: async () => {
      ctx.signIns += 1;
      if (signInError) throw signInError;
    },
    timers: ctx.timers,
    doc: ctx.doc,
    win: ctx.win,
  });
  ctx.meta = () => JSON.parse(storage.getItem(SYNC_META_KEY));
  return ctx;
}

const offlineError = () => Object.assign(new Error("offline"), { status: 0, unavailable: true });

test("khách: không gọi API, trạng thái guest, schedulePush không làm gì", async () => {
  const ctx = setup({ user: null });
  await ctx.sync.start();
  assert.deepEqual(ctx.sessionCalls, [{ probe: false }]);
  assert.equal(ctx.sync.status(), "guest");
  assert.deepEqual(ctx.statuses, ["guest"]);
  ctx.sync.schedulePush();
  assert.equal(ctx.timers.size, 0);
  await ctx.win.dispatch("online");
  await ctx.doc.dispatch("visibilitychange");
  assert.equal(ctx.server.calls.length, 0);
  assert.equal(ctx.storage.getItem(SYNC_META_KEY), null);
});

test("lần đầu đăng nhập: kéo dữ liệu đám mây, gộp, rồi đẩy mọi bản ghi tại chỗ và lưu meta", async () => {
  const server = fakeServer();
  let cloud = createDefaultRecruitTrackerState();
  cloud = createAccount(cloud, "Acc máy khác", { now: at(1) });
  for (const record of recruitRecords(cloud)) server.write(record);

  let local = createDefaultRecruitTrackerState();
  local = createAccount(local, "Acc máy này", { now: at(2) });
  local = recordDailyMisses(local, { date: "2026-09-01", pulls: 2, now: at(3) });

  const ctx = setup({ server, state: local });
  await ctx.sync.start();

  assert.deepEqual(ctx.server.calls.map((c) => c.method), ["GET", "POST"]);
  assert.equal(ctx.server.calls[0].path, "/api/recruit?since=0");
  const names = ctx.state.accounts.map((a) => a.name).sort();
  assert.deepEqual(names, ["Acc máy khác", "Acc máy này", "Chính"]);
  // Server giữ đủ mọi bản ghi của cả hai phía.
  const serverKeys = [...server.rows.keys()].sort();
  const localKeys = recruitRecords(ctx.state).map((r) => `${r.kind}:${r.id}`).sort();
  assert.deepEqual(serverKeys, localKeys);
  const maxUpdated = Math.max(...recruitRecords(ctx.state).map((r) => r.updatedAt));
  assert.deepEqual(ctx.meta(), { userId: USER.id, cursor: server.rev, pushedAt: maxUpdated });
  assert.deepEqual(ctx.statuses, ["syncing", "synced"]);
});

test("đẩy sau đó: debounce, chỉ gửi bản ghi sửa sau pushedAt", async () => {
  let state = createDefaultRecruitTrackerState();
  state = createAccount(state, "Phụ", { now: at(1) });
  const ctx = setup({ state });
  await ctx.sync.start();
  const firstPush = ctx.server.calls.length;

  const accountId = ctx.state.accounts.find((a) => a.name === "Phụ").id;
  ctx.state = renameAccount(ctx.state, accountId, "Phụ 2", { now: at(5) });
  ctx.sync.schedulePush();
  ctx.sync.schedulePush();
  assert.deepEqual(ctx.timers.delays(), [PUSH_DEBOUNCE_MS]);
  await ctx.timers.flush();

  const pushes = ctx.server.calls.slice(firstPush);
  assert.equal(pushes.length, 1);
  assert.deepEqual(pushes[0].json.records.map((r) => [r.kind, r.id, r.data.name]), [["account", accountId, "Phụ 2"]]);
  assert.equal(ctx.meta().pushedAt, Date.parse(at(5)));
  assert.equal(ctx.sync.status(), "synced");

  // Không có gì mới: không gọi mạng.
  ctx.sync.schedulePush();
  await ctx.timers.flush();
  assert.equal(ctx.server.calls.length, firstPush + 1);
});

test("kéo nhiều trang theo cursor/more, đẩy lần đầu theo lô ≤ 500", async () => {
  const server = fakeServer({ pageSize: 2 });
  let cloud = createDefaultRecruitTrackerState();
  for (let i = 0; i < 5; i++) cloud = createAccount(cloud, `Cloud ${i}`, { now: at(i + 1) });
  for (const record of recruitRecords(cloud)) server.write(record);

  let local = createDefaultRecruitTrackerState();
  for (let i = 0; i < 520; i++) {
    const day = new Date(Date.UTC(2025, 0, 1) + i * 86_400_000);
    local = recordDailyMisses(local, { date: day.toISOString().slice(0, 10), pulls: 1, now: day.toISOString() });
  }
  const localCount = recruitRecords(local).length;
  assert.ok(localCount > 500, `cần > 500 bản ghi, có ${localCount}`);

  const ctx = setup({ server, state: local });
  await ctx.sync.start();

  const gets = ctx.server.calls.filter((c) => c.method === "GET").map((c) => c.path);
  // 6 bản ghi trên server, trang 2: ba trang, trang cuối more=false.
  assert.deepEqual(gets, ["/api/recruit?since=0", "/api/recruit?since=2", "/api/recruit?since=4"]);
  assert.equal(ctx.applied.length, 1, "gộp một lần sau khi kéo đủ các trang");
  assert.equal(ctx.state.accounts.filter((a) => a.name.startsWith("Cloud")).length, 5);
  const posts = ctx.server.calls.filter((c) => c.method === "POST");
  assert.ok(posts.length >= 2);
  assert.ok(posts.every((c) => c.json.records.length <= 500));
  assert.equal(server.rows.size, recruitRecords(ctx.state).length);
});

test("mất mạng -> offline, có mạng lại thì đồng bộ tiếp phần còn thiếu", async () => {
  const server = fakeServer();
  let state = createDefaultRecruitTrackerState();
  state = createAccount(state, "Phụ", { now: at(1) });
  const ctx = setup({ server, state });
  server.fail(offlineError());
  await ctx.sync.start();
  assert.equal(ctx.sync.status(), "offline");
  assert.equal(server.rows.size, 0);
  assert.deepEqual(ctx.meta(), { userId: USER.id, cursor: 0, pushedAt: 0 });

  ctx.state = renameAccount(ctx.state, ctx.state.activeAccountId, "Phụ offline", { now: at(2) });
  ctx.sync.schedulePush();
  await ctx.timers.flush();
  assert.equal(ctx.sync.status(), "offline");

  server.fail(null);
  await ctx.win.dispatch("online");
  assert.equal(ctx.sync.status(), "synced");
  assert.deepEqual([...server.rows.values()].map((r) => r.data.name).sort(), ["Chính", "Phụ offline"]);
  assert.equal(ctx.meta().pushedAt, Date.parse(at(2)));
});

test("hỏi phiên lỗi mạng -> offline, online thì hỏi lại phiên và đồng bộ", async () => {
  const ctx = setup({ sessionError: offlineError() });
  await ctx.sync.start();
  assert.equal(ctx.sync.status(), "offline");
  assert.equal(ctx.server.calls.length, 0);
  ctx.sessionError = null;
  await ctx.win.dispatch("online");
  assert.equal(ctx.sync.status(), "synced");
  assert.deepEqual(ctx.sessionCalls, [{ probe: false }, { probe: false }]);
  assert.deepEqual(ctx.server.calls.map((c) => c.method), ["GET", "POST"]);
});

test("tab hiện lại thì kéo thay đổi mới từ máy khác", async () => {
  const server = fakeServer();
  const ctx = setup({ server });
  await ctx.sync.start();
  const cursor = ctx.meta().cursor;

  let other = createDefaultRecruitTrackerState();
  other = createAccount(other, "Từ máy khác", { now: at(9) });
  for (const record of recruitRecords(other).filter((r) => r.id !== "acc_main")) server.write(record);

  ctx.doc.visibilityState = "hidden";
  await ctx.doc.dispatch("visibilitychange");
  assert.ok(!ctx.state.accounts.some((a) => a.name === "Từ máy khác"));
  ctx.doc.visibilityState = "visible";
  await ctx.doc.dispatch("visibilitychange");
  assert.ok(ctx.state.accounts.some((a) => a.name === "Từ máy khác"));
  assert.equal(server.calls.filter((c) => c.method === "GET").at(-1).path, `/api/recruit?since=${cursor}`);
  assert.ok(ctx.meta().cursor > cursor);
});

test("đổi user: bỏ cursor/pushedAt của user cũ, kéo từ 0 và đẩy toàn bộ", async () => {
  const storage = memoryStorage({ [SYNC_META_KEY]: JSON.stringify({ userId: "u-bob", cursor: 42, pushedAt: Date.parse(at(30)) }) });
  let state = createDefaultRecruitTrackerState();
  state = createAccount(state, "Cũ", { now: at(1) });
  const ctx = setup({ storage, state });
  await ctx.sync.start();
  assert.equal(ctx.server.calls[0].path, "/api/recruit?since=0");
  const pushed = ctx.server.calls.filter((c) => c.method === "POST").flatMap((c) => c.json.records.map((r) => r.id));
  assert.deepEqual(pushed.sort(), recruitRecords(state).map((r) => r.id).sort());
  assert.equal(ctx.meta().userId, USER.id);
});

test("401 giữa chừng -> guest, ngừng đẩy; lỗi khác -> error; không bao giờ ném", async () => {
  const server = fakeServer();
  const ctx = setup({ server });
  await ctx.sync.start();

  server.fail(Object.assign(new Error("bad"), { status: 400, code: "invalid_records" }));
  ctx.state = createAccount(ctx.state, "X", { now: at(3) });
  ctx.sync.schedulePush();
  await ctx.timers.flush();
  assert.equal(ctx.sync.status(), "error");

  server.fail(Object.assign(new Error("gone"), { status: 401 }));
  await ctx.win.dispatch("online");
  assert.equal(ctx.sync.status(), "guest");
  const calls = server.calls.length;
  ctx.sync.schedulePush();
  assert.equal(ctx.timers.size, 0);
  assert.equal(server.calls.length, calls);
});

test("signIn chuyển cho community-api", async () => {
  const ctx = setup({ user: null });
  await ctx.sync.signIn();
  assert.equal(ctx.signIns, 1);
});

test("khách đăng nhập lỗi: giữ trạng thái guest (vẫn còn nút Đăng nhập) và trả lỗi cho UI", async () => {
  const error = Object.assign(new Error("rate limited"), { status: 429 });
  const ctx = setup({ user: null, signInError: error });
  await ctx.sync.start();
  assert.equal(await ctx.sync.signIn(), error);
  assert.equal(ctx.sync.status(), "guest");
  assert.deepEqual(ctx.statuses, ["guest"]);
});

test("nhập JSON cũ sau khi đã đồng bộ: đẩy toàn bộ để bản ghi có updatedAt cũ hơn pushedAt vẫn lên đám mây", async () => {
  const server = fakeServer();
  const ctx = setup({ server, state: createAccount(createDefaultRecruitTrackerState(), "Hiện tại", { now: at(50) }) });
  await ctx.sync.start();
  const backup = createAccount(createDefaultRecruitTrackerState(), "Bản sao lưu tuần trước", { now: at(1) });
  const backupAccount = backup.accounts.find((account) => account.name === "Bản sao lưu tuần trước");
  ctx.state = mergeRecruitTrackerState(ctx.state, backup);

  ctx.sync.schedulePush();
  await ctx.timers.flush();
  assert.equal(server.rows.has(`account:${backupAccount.id}`), false, "đẩy thường bỏ sót bản ghi cũ hơn pushedAt");

  ctx.sync.schedulePush({ full: true });
  await ctx.timers.flush();
  assert.equal(server.rows.get(`account:${backupAccount.id}`)?.data.name, "Bản sao lưu tuần trước");
  assert.equal(ctx.sync.status(), "synced");
});
