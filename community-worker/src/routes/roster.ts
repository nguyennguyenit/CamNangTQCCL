// Đồng bộ kho Gợi ý đội + Đội của tôi (docs/roster-sync.md): kéo theo rev, đẩy gộp LWW theo updatedAt.
// Khác recruit.ts: có hộp (xóa hộp dọn bản ghi con), cap/quota theo trạng thái sống và kết quả từng bản ghi.
// Mọi điều kiện (LWW, hộp sống, nhóm sống, box_id bất biến, quota/cap/trần giữ lại) nằm TRONG câu ghi của db.batch
// (D1 chạy batch tuần tự, nguyên tử), không check-rồi-ghi; câu đọc lại sau mỗi lần ghi suy ra `outcome`.

import { Hono } from "hono";
import { requireUser, type AppEnv } from "../context";
import { ApiError } from "../http";
import { consumeRateLimit } from "../ratelimit";
import { DEFAULT_GROUP_SUFFIXES, ROSTER_KINDS, defaultGroupId, validateRecord, type RejectCode, type RosterKind, type ValidRecord } from "../roster-schema";
import { readJson } from "../validate";

export const ROSTER_PAGE_SIZE = 500;
export const ROSTER_MAX_BATCH = 200;
/** Trần bản ghi SỐNG mỗi user (`quota`). */
export const ROSTER_MAX_LIVE = 20_000;
/** Trần tổng số khóa giữ lại (sống + bản xóa) mỗi user (`retained_cap`). */
export const ROSTER_MAX_RETAINED = 40_000;
/** Cap bản ghi sống (`cap`): hộp và đội theo user, nhóm theo hộp. */
export const ROSTER_CAPS = { box: 20, group: 50, team: 500 } as const;
export const ROSTER_MAX_SKEW_MS = 5 * 60_000;

type Outcome = "applied" | "already-applied" | "conflict" | "rejected";
type Code = RejectCode | "clock_skew" | "box_missing" | "group_missing" | "box_changed" | "not_found" | "quota" | "cap" | "retained_cap";

interface WireRecord {
  kind: RosterKind;
  id: string;
  boxId: string | null;
  updatedAt: number;
  rev: number;
  deleted: boolean;
  data: unknown;
}

interface Result {
  kind: string | null;
  id: string | null;
  outcome: Outcome;
  code?: Code;
  server?: WireRecord;
}

interface RosterRow {
  kind: RosterKind;
  id: string;
  box_id: string | null;
  updated_at: number;
  rev: number;
  deleted: number;
  payload: string;
}

const bad = (code: string, message: string) => new ApiError(400, code, message);

const toWire = (r: RosterRow): WireRecord => ({
  kind: r.kind,
  id: r.id,
  boxId: r.box_id,
  updatedAt: r.updated_at,
  rev: r.rev,
  deleted: r.deleted === 1,
  data: JSON.parse(r.payload) as unknown,
});

function parseSince(raw: string | undefined): number {
  if (raw === undefined || raw === "") return 0;
  const since = /^\d{1,16}$/u.test(raw) ? Number(raw) : NaN;
  if (!Number.isSafeInteger(since)) throw bad("invalid_since", "since phải là số nguyên ≥ 0");
  return since;
}

function parseKinds(raw: string | undefined): RosterKind[] | null {
  if (raw === undefined || raw === "") return null;
  const kinds = raw.split(",");
  for (const kind of kinds) if (!ROSTER_KINDS.includes(kind as RosterKind)) throw bad("invalid_kinds", `kind không hợp lệ: ${kind.slice(0, 20)}`);
  return [...new Set(kinds)] as RosterKind[];
}

async function maxRev(db: D1Database, userId: string): Promise<number> {
  const row = await db.prepare("select coalesce(max(rev), 0) as rev from roster_records where user_id = ?").bind(userId).first<{ rev: number }>();
  return row?.rev ?? 0;
}

// ---- SQL. Tham số số (?N) dùng chung cho câu ghi và câu chẩn đoán:
// ?1 user, ?2 kind, ?3 id, ?4 box_id (null với box), ?5 updated_at, ?6 deleted, ?7 payload, ?8 groupId (team).

const KEY = "user_id = ?1 and kind = ?2 and id = ?3";
const LIVE_BOX = "exists (select 1 from roster_records where user_id = ?1 and kind = 'box' and id = ?4 and deleted = 0)";
const LIVE_GROUP = "exists (select 1 from roster_records where user_id = ?1 and kind = 'group' and id = ?8 and deleted = 0 and box_id = ?4)";
const KEY_EXISTS = `exists (select 1 from roster_records where ${KEY})`;
const KEY_LIVE = `exists (select 1 from roster_records where ${KEY} and deleted = 0)`;
const RETAINED_COUNT = "(select count(*) from roster_records where user_id = ?1)";
const LIVE_COUNT = "(select count(*) from roster_records where user_id = ?1 and deleted = 0)";

function kindLiveCount(kind: RosterKind): string | null {
  if (kind === "box") return "(select count(*) from roster_records where user_id = ?1 and kind = 'box' and deleted = 0)";
  if (kind === "group") return "(select count(*) from roster_records where user_id = ?1 and kind = 'group' and box_id = ?4 and deleted = 0)";
  if (kind === "team") return "(select count(*) from roster_records where user_id = ?1 and kind = 'team' and deleted = 0)";
  return null;
}

const writeSqlCache = new Map<string, string>();
function writeSql(kind: RosterKind, deleted: boolean): string {
  const cacheKey = `${kind}:${deleted}`;
  const cached = writeSqlCache.get(cacheKey);
  if (cached) return cached;
  // Bản xóa chỉ sửa khóa đã có (không tạo bản xóa cho khóa chưa tồn tại).
  const where: string[] = [];
  if (deleted) {
    where.push(KEY_EXISTS);
  } else {
    if (kind !== "box") where.push(LIVE_BOX);
    if (kind === "team") where.push(LIVE_GROUP);
    // Đang sống thì sửa tự do; tạo mới/hồi sinh phải qua quota, cap và (khóa mới) trần giữ lại.
    const cap = kindLiveCount(kind);
    const fresh = [`(${KEY_EXISTS} or ${RETAINED_COUNT} < ${ROSTER_MAX_RETAINED})`, `${LIVE_COUNT} < ${ROSTER_MAX_LIVE}`];
    if (cap) fresh.push(`${cap} < ${ROSTER_CAPS[kind as keyof typeof ROSTER_CAPS]}`);
    where.push(`(${KEY_LIVE} or (${fresh.join(" and ")}))`);
  }
  // box_id bất biến sau khi tạo.
  if (kind !== "box") where.push(`not exists (select 1 from roster_records where ${KEY} and box_id is not ?4)`);
  const sql =
    "insert into roster_records (user_id, kind, id, box_id, updated_at, rev, deleted, payload) " +
    "select ?1, ?2, ?3, ?4, ?5, (select coalesce(max(rev), 0) + 1 from roster_records where user_id = ?1), ?6, ?7 " +
    `where ${where.join(" and ")} ` +
    "on conflict (user_id, kind, id) do update set updated_at = excluded.updated_at, rev = excluded.rev, " +
    "deleted = excluded.deleted, payload = excluded.payload " +
    "where excluded.updated_at > roster_records.updated_at";
  writeSqlCache.set(cacheKey, sql);
  return sql;
}

const diagSqlCache = new Map<string, string>();
/** Đọc bản đang lưu + các cờ để suy lý do khi câu ghi không ghi dòng nào. Đếm chỉ chạy khi thật sự cần (CASE rút gọn). */
function diagSql(kind: RosterKind): string {
  const cached = diagSqlCache.get(kind);
  if (cached) return cached;
  const cols = ["r.rev as s_rev", "r.updated_at as s_updated_at", "r.deleted as s_deleted", "r.payload as s_payload", "r.box_id as s_box_id"];
  cols.push(kind === "box" ? "1 as box_live" : `${LIVE_BOX} as box_live`);
  // Chẩn đoán không dùng payload (?7): nhóm của đội đánh số lại thành ?7 để `bindFor` không bind lại payload tới 16 KiB.
  cols.push(kind === "team" ? `${LIVE_GROUP.replace("?8", "?7")} as group_live` : "1 as group_live");
  const freshOrResurrect = "?6 = 0 and (r.rev is null or r.deleted = 1)";
  cols.push(`case when ${freshOrResurrect} then ${LIVE_COUNT} end as live_total`);
  cols.push(`case when ?6 = 0 and r.rev is null then ${RETAINED_COUNT} end as retained`);
  const cap = kindLiveCount(kind);
  cols.push(cap ? `case when ${freshOrResurrect} then ${cap} end as kind_live` : "null as kind_live");
  const sql =
    `select ${cols.join(", ")} from (select 1 as o) ` +
    "left join roster_records r on r.user_id = ?1 and r.kind = ?2 and r.id = ?3";
  diagSqlCache.set(kind, sql);
  return sql;
}

/** Chỉ bind đúng số tham số mà câu SQL dùng (D1 báo lỗi khi bind thừa). */
function bindFor(db: D1Database, sql: string, values: unknown[]): D1PreparedStatement {
  let max = 0;
  for (const m of sql.matchAll(/\?(\d+)/gu)) max = Math.max(max, Number(m[1]));
  return db.prepare(sql).bind(...values.slice(0, max));
}

// Xóa hộp: dọn mọi bản ghi con CHỈ khi bản xóa hộp vừa thắng LWW (updated_at đúng bản gửi, deleted = 1).
const DELETE_BOX_CHILDREN =
  "delete from roster_records where user_id = ?1 and box_id = ?2 and " +
  "exists (select 1 from roster_records where user_id = ?1 and kind = 'box' and id = ?2 and deleted = 1 and updated_at = ?3)";

// Xóa nhóm: chuyển đội sống sang nhóm Ghép Team mặc định với rev mới riêng từng đội (con trỏ kéo không bỏ sót).
// updated_at của đội = max(hiện có, mốc xóa nhóm) để không lùi LWW; payload.updatedAt cập nhật theo.
const MOVE_TEAMS =
  "with base as materialized (select coalesce(max(rev), 0) as b from roster_records where user_id = ?1) " +
  "update roster_records set rev = base.b + s.rn, updated_at = max(roster_records.updated_at, ?4), " +
  "payload = json_set(roster_records.payload, '$.groupId', ?3, '$.updatedAt', " +
  "case when roster_records.updated_at < ?4 then ?5 else json_extract(roster_records.payload, '$.updatedAt') end) " +
  "from (select id, row_number() over (order by id) as rn from roster_records " +
  "where user_id = ?1 and kind = 'team' and deleted = 0 and box_id = ?2 and json_extract(payload, '$.groupId') = ?6) s, base " +
  "where roster_records.user_id = ?1 and roster_records.kind = 'team' and roster_records.id = s.id and " +
  "exists (select 1 from roster_records where user_id = ?1 and kind = 'group' and id = ?6 and deleted = 1 and updated_at = ?4)";

interface Diag {
  s_rev: number | null;
  s_updated_at: number | null;
  s_deleted: number | null;
  s_payload: string | null;
  s_box_id: string | null;
  box_live: number;
  group_live: number;
  live_total: number | null;
  retained: number | null;
  kind_live: number | null;
}

/** Suy kết quả của một bản ghi từ câu chẩn đoán chạy ngay sau câu ghi (cùng batch, cùng thứ tự). */
function classify(rec: ValidRecord, wrote: boolean, d: Diag): Omit<Result, "kind" | "id"> {
  if (wrote) return { outcome: "applied" };
  const stored: RosterRow | null =
    d.s_rev === null
      ? null
      : {
          kind: rec.kind,
          id: rec.id,
          box_id: d.s_box_id,
          updated_at: d.s_updated_at as number,
          rev: d.s_rev,
          deleted: d.s_deleted as number,
          payload: d.s_payload as string,
        };
  if (stored) {
    if (stored.updated_at === rec.updatedAt && stored.payload === rec.payload && (stored.deleted === 1) === rec.deleted) return { outcome: "already-applied" };
    if (stored.updated_at >= rec.updatedAt) return { outcome: "conflict", server: toWire(stored) };
    if (rec.kind !== "box" && stored.box_id !== rec.boxId) return reject("box_changed");
  } else if (rec.deleted) {
    return reject("not_found");
  }
  if (rec.kind !== "box" && !d.box_live) return reject("box_missing");
  if (rec.kind === "team" && !d.group_live) return reject("group_missing");
  if (!stored && (d.retained ?? 0) >= ROSTER_MAX_RETAINED) return reject("retained_cap");
  if ((d.live_total ?? 0) >= ROSTER_MAX_LIVE) return reject("quota");
  if (d.kind_live !== null && rec.kind in ROSTER_CAPS && d.kind_live >= ROSTER_CAPS[rec.kind as keyof typeof ROSTER_CAPS]) return reject("cap");
  // Câu ghi chỉ bỏ qua vì các lý do trên (đã loại hết); tới đây là bất biến bị phá. Batch đã commit nên KHÔNG ném (500 làm client
  // gửi lại cả lô): ghi log và trả kết quả xác định — có bản đang lưu thì `conflict` kèm bản đó, không thì `quota` (server từ chối lưu).
  console.error(`roster: không suy được lý do bản ghi ${rec.kind}:${rec.id} không được ghi`);
  return stored ? { outcome: "conflict", server: toWire(stored) } : reject("quota");
}

const reject = (code: Code): Omit<Result, "kind" | "id"> => ({ outcome: "rejected", code });

// Hộp trước, rồi nhóm, rồi mọi thứ còn lại (đội cần nhóm sống; con cần hộp sống). Ổn định theo thứ tự gửi.
const PRIORITY: Record<RosterKind, number> = { box: 0, group: 1, owned: 2, season: 2, locked: 2, override: 2, team: 2 };

export const roster = new Hono<AppEnv>();

roster.get("/api/roster", async (c) => {
  const { user } = await requireUser(c);
  const since = parseSince(c.req.query("since"));
  const kinds = parseKinds(c.req.query("kinds"));
  await consumeRateLimit(c.env.DB, "roster_pull", user.id, c.get("deps").now());
  const kindSql = kinds ? ` and kind in (${kinds.map(() => "?").join(", ")})` : "";
  const { results } = await c.env.DB.prepare(
    `select kind, id, box_id, updated_at, rev, deleted, payload from roster_records where user_id = ? and rev > ?${kindSql} order by rev limit ?`,
  )
    .bind(user.id, since, ...(kinds ?? []), ROSTER_PAGE_SIZE + 1)
    .all<RosterRow>();
  const more = results.length > ROSTER_PAGE_SIZE;
  const rows = more ? results.slice(0, ROSTER_PAGE_SIZE) : results;
  // Trang rỗng trả rev lớn nhất hiện có (không phải since) để client tự sửa con trỏ lệch.
  const cursor = rows.length ? rows[rows.length - 1].rev : await maxRev(c.env.DB, user.id);
  return c.json({ userId: user.id, records: rows.map(toWire), cursor, more });
});

roster.post("/api/roster", async (c) => {
  const { user } = await requireUser(c);
  const input = await readJson(c.req.raw);
  if (typeof input.expectedUserId !== "string") throw bad("invalid_expected_user", "expectedUserId phải là chuỗi");
  if (!Array.isArray(input.records)) throw bad("invalid_records", "records phải là mảng");
  if (input.records.length > ROSTER_MAX_BATCH) throw bad("invalid_records", `Tối đa ${ROSTER_MAX_BATCH} bản ghi mỗi lần`);
  if (input.expectedUserId !== user.id) throw new ApiError(409, "user_mismatch", "Phiên đăng nhập không còn khớp tài khoản của bộ nhớ trên máy");
  const db = c.env.DB;
  const now = c.get("deps").now();
  await consumeRateLimit(db, "roster_push", user.id, now);

  const results: Result[] = new Array<Result>(input.records.length);
  const todo: { index: number; rec: ValidRecord }[] = [];
  for (const [index, raw] of (input.records as unknown[]).entries()) {
    const v = await validateRecord(raw);
    if (!v.ok) {
      results[index] = { kind: v.kind, id: v.id, outcome: "rejected", code: v.code };
    } else if (v.record.updatedAt > now + ROSTER_MAX_SKEW_MS) {
      results[index] = { kind: v.record.kind, id: v.record.id, outcome: "rejected", code: "clock_skew" };
    } else {
      todo.push({ index, rec: v.record });
    }
  }
  todo.sort((a, b) => PRIORITY[a.rec.kind] - PRIORITY[b.rec.kind] || a.index - b.index);

  const stmts: D1PreparedStatement[] = [];
  const slots: { index: number; rec: ValidRecord; write: number; diag: number }[] = [];
  for (const { index, rec } of todo) {
    const params = [user.id, rec.kind, rec.id, rec.boxId, rec.updatedAt, rec.deleted ? 1 : 0, rec.payload, rec.groupId];
    const write = stmts.push(bindFor(db, writeSql(rec.kind, rec.deleted), params)) - 1;
    const diag = stmts.push(bindFor(db, diagSql(rec.kind), [...params.slice(0, 6), rec.groupId])) - 1;
    slots.push({ index, rec, write, diag });
    if (rec.deleted && rec.kind === "box") stmts.push(db.prepare(DELETE_BOX_CHILDREN).bind(user.id, rec.id, rec.updatedAt));
    if (rec.deleted && rec.kind === "group" && rec.boxId) {
      // Nhóm xóa được: chỉ nhóm không mặc định tới đây (nhóm mặc định đã bị default_protected ở schema).
      const fallback = defaultGroupId(rec.boxId, DEFAULT_GROUP_SUFFIXES[1]);
      stmts.push(db.prepare(MOVE_TEAMS).bind(user.id, rec.boxId, fallback, rec.updatedAt, rec.updatedAtIso, rec.id));
    }
  }
  let cursor: number;
  if (stmts.length) {
    stmts.push(db.prepare("select coalesce(max(rev), 0) as rev from roster_records where user_id = ?").bind(user.id));
    const out = await db.batch(stmts);
    for (const s of slots) {
      const diag = out[s.diag].results[0] as unknown as Diag;
      results[s.index] = { kind: s.rec.kind, id: s.rec.id, ...classify(s.rec, (out[s.write].meta.changes ?? 0) > 0, diag) };
    }
    cursor = (out[out.length - 1].results[0] as unknown as { rev: number }).rev;
  } else {
    cursor = await maxRev(db, user.id);
  }
  return c.json({ results, cursor });
});
