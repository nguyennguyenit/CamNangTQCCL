// Máy chủ giả theo hợp đồng /api/roster (docs/roster-sync.md) cho test client.
// Kiểm bản ghi bằng CHÍNH `community-worker/src/roster-schema.ts` (biên dịch bằng stripTypeScriptTypes vì file dùng
// parameter property mà `--experimental-strip-types` không nhận), nên bản ghi client dựng sai dạng sẽ bị `rejected`.

import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCHEMA_PATH = new URL("../../community-worker/src/roster-schema.ts", import.meta.url);

let schemaModule = null;
async function loadSchema() {
  if (schemaModule) return schemaModule;
  const dir = mkdtempSync(join(tmpdir(), "roster-schema-"));
  const file = join(dir, "roster-schema.mjs");
  writeFileSync(file, stripTypeScriptTypes(readFileSync(SCHEMA_PATH, "utf8"), { mode: "transform" }));
  schemaModule = await import(file);
  return schemaModule;
}

export async function validateRosterRecord(record) {
  return (await loadSchema()).validateRecord(record);
}

export function httpError(status, code, extra = {}) {
  return Object.assign(new Error(`${status} ${code}`), { status, code, ...extra });
}

// Cùng nguồn với server thật: `ROSTER_MAX_BATCH` trong community-worker/src/routes/roster.ts (file đó kéo theo hono/D1 nên đọc hằng số từ mã nguồn).
const MAX_BATCH = Number(/export const ROSTER_MAX_BATCH = (\d+)/u.exec(readFileSync(new URL("../../community-worker/src/routes/roster.ts", import.meta.url), "utf8"))?.[1]);
const keyOf = (kind, id) => `${kind}:${id}`;

/**
 * `userId`: chủ của cookie. `rows`: khóa `kind:id` → dòng đã lưu `{kind,id,boxId,updatedAt,rev,deleted,data}`.
 * Điều khiển lỗi: `fail(err)` (mọi lời gọi), `dropResponse()` (ghi rồi ném lỗi mạng), `hold()` (treo phản hồi POST tới `release()`).
 */
export async function createRosterServer({ userId = "u-alice", pageSize = 500 } = {}) {
  await loadSchema();
  const rows = new Map();
  let rev = 0;
  let failure = null;
  let dropNext = false;
  let hold = null;
  const calls = [];
  const rejections = new Map();

  const wire = (row) => ({ kind: row.kind, id: row.id, boxId: row.boxId, updatedAt: row.updatedAt, rev: row.rev, deleted: row.deleted, data: structuredClone(row.data) });

  function deleteBoxChildren(boxId) {
    for (const [key, row] of rows) if (row.boxId === boxId && row.kind !== "box") rows.delete(key);
  }

  /** Như `MOVE_TEAMS` của worker: đội sống của nhóm vừa xóa về Ghép Team, `updated_at = max(cũ, T)`, mỗi đội một rev mới (theo id). */
  function moveTeams(group) {
    const fallback = `${group.boxId}~ghep-team`;
    const moving = [...rows.values()].filter((row) => row.kind === "team" && !row.deleted && row.boxId === group.boxId && row.data.groupId === group.id).sort((a, b) => (a.id < b.id ? -1 : 1));
    for (const row of moving) {
      if (row.updatedAt < group.updatedAt) row.data.updatedAt = group.updatedAtIso;
      row.updatedAt = Math.max(row.updatedAt, group.updatedAt);
      row.data.groupId = fallback;
      row.rev = ++rev;
    }
  }

  async function apply(record) {
    const injected = rejections.get(keyOf(record.kind, record.id));
    if (injected && injected.times > 0) {
      injected.times -= 1;
      return { kind: record.kind, id: record.id, outcome: "rejected", code: injected.code };
    }
    const checked = await validateRosterRecord(record);
    if (!checked.ok) return { kind: checked.kind, id: checked.id, outcome: "rejected", code: checked.code };
    const { record: valid } = checked;
    if (valid.updatedAt > Date.now() + 5 * 60_000) return { kind: valid.kind, id: valid.id, outcome: "rejected", code: "clock_skew" };
    const key = keyOf(valid.kind, valid.id);
    const old = rows.get(key);
    const stored = JSON.parse(valid.payload);
    if (old && old.updatedAt === valid.updatedAt) {
      if (JSON.stringify(old.data) === valid.payload) return { kind: valid.kind, id: valid.id, outcome: "already-applied" };
      return { kind: valid.kind, id: valid.id, outcome: "conflict", server: wire(old) };
    }
    if (old && old.updatedAt > valid.updatedAt) return { kind: valid.kind, id: valid.id, outcome: "conflict", server: wire(old) };
    if (valid.deleted && !old) return { kind: valid.kind, id: valid.id, outcome: "rejected", code: "not_found" };
    if (!valid.deleted && valid.kind !== "box") {
      const box = rows.get(keyOf("box", valid.boxId));
      if (!box || box.deleted) return { kind: valid.kind, id: valid.id, outcome: "rejected", code: "box_missing" };
      if (valid.kind === "team") {
        const group = rows.get(keyOf("group", valid.groupId));
        if (!group || group.deleted || group.boxId !== valid.boxId) return { kind: valid.kind, id: valid.id, outcome: "rejected", code: "group_missing" };
      }
    }
    rows.set(key, { kind: valid.kind, id: valid.id, boxId: valid.boxId, updatedAt: valid.updatedAt, rev: ++rev, deleted: valid.deleted, data: stored });
    if (valid.kind === "box" && valid.deleted) deleteBoxChildren(valid.id);
    if (valid.kind === "group" && valid.deleted) moveTeams(valid);
    return { kind: valid.kind, id: valid.id, outcome: "applied" };
  }

  const server = {
    /** Chủ của cookie hiện tại; gán lại để mô phỏng đổi tài khoản ở tab khác. */
    userId,
    rows,
    calls,
    get rev() {
      return rev;
    },
    fail(error) {
      failure = error;
    },
    /** Từ chối `code` cho `times` lần POST kế tiếp chứa bản ghi `kind:id` (không ghi vào server), như cap/quota/clock_skew. */
    rejectNext(kind, id, code, times = 1) {
      rejections.set(keyOf(kind, id), { code, times });
    },
    dropResponse() {
      dropNext = true;
    },
    /** Treo phản hồi POST kế tiếp (đã xử lý xong) cho tới khi `release()`. */
    holdNext() {
      let release;
      const gate = new Promise((resolve) => (release = resolve));
      hold = gate;
      return release;
    },
    /** Đặt thẳng một bản ghi đã hợp lệ (máy khác đã ghi). */
    async seed(record) {
      const result = await apply(record);
      if (result.outcome === "rejected") throw new Error(`seed rejected: ${result.code} ${result.id}`);
      return result;
    },
    live(kind) {
      return [...rows.values()].filter((row) => row.kind === kind && !row.deleted);
    },
    async api(path, { method = "GET", json } = {}) {
      calls.push({ path, method, json: json && structuredClone(json) });
      if (failure) throw failure;
      const url = new URL(path, "https://tqccl.test");
      if (url.pathname !== "/api/roster") throw httpError(404, "not_found");
      if (method === "POST") {
        if (json?.expectedUserId !== server.userId) throw httpError(409, "user_mismatch");
        if (!Array.isArray(json?.records) || json.records.length > MAX_BATCH) throw httpError(400, "bad_request");
        const results = [];
        const priority = { box: 0, group: 1 };
        const ordered = [...json.records].sort((a, b) => (priority[a.kind] ?? 2) - (priority[b.kind] ?? 2));
        const byIndex = new Map();
        for (const record of ordered) byIndex.set(record, await apply(record));
        for (const record of json.records) results.push(byIndex.get(record));
        const gate = hold;
        hold = null;
        if (gate) await gate;
        if (dropNext) {
          dropNext = false;
          throw httpError(0, "network", { unavailable: true });
        }
        return { results, cursor: rev };
      }
      const since = Number(url.searchParams.get("since") || 0);
      const kinds = url.searchParams.get("kinds")?.split(",");
      const newer = [...rows.values()].filter((row) => row.rev > since && (!kinds || kinds.includes(row.kind))).sort((a, b) => a.rev - b.rev);
      const page = newer.slice(0, pageSize);
      return { userId: server.userId, records: page.map(wire), cursor: page.length ? page[page.length - 1].rev : rev, more: newer.length > pageSize };
    },
  };
  return server;
}

export function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  const storage = {
    writes: [],
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem(key, value) {
      storage.onWrite?.(key);
      data.set(key, String(value));
      storage.writes.push(key);
    },
    removeItem: (key) => void data.delete(key),
    keys: () => [...data.keys()],
  };
  return storage;
}

/** `navigator.locks` giả dùng chung giữa các "tab": tuần tự theo tên, ghi lại khóa đang giữ. */
export function fakeLocks() {
  const tails = new Map();
  const held = new Set();
  return {
    held,
    async request(name, callback) {
      const previous = tails.get(name) || Promise.resolve();
      let release;
      tails.set(name, new Promise((resolve) => (release = resolve)));
      await previous;
      held.add(name);
      try {
        return await callback({ name });
      } finally {
        held.delete(name);
        release();
      }
    },
  };
}

export function fakeTimers() {
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
    delays: () => [...pending.values()].map((t) => t.ms),
    async flush() {
      const due = [...pending.values()];
      pending.clear();
      for (const { fn } of due) await fn();
    },
  };
}

export function eventTarget(props = {}) {
  const handlers = {};
  return {
    ...props,
    addEventListener(type, fn) {
      (handlers[type] ||= []).push(fn);
    },
    async dispatch(type, event = {}) {
      for (const fn of handlers[type] || []) await fn({ type, ...event });
    },
  };
}
