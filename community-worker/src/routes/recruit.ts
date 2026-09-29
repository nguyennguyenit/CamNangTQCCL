// Đồng bộ "Theo dõi chiêu mộ": kéo thay đổi theo rev, đẩy bản ghi gộp LWW theo updatedAt.
// Mỗi dòng được ghi nhận rev mới (tăng dần theo user) nên client chỉ cần nhớ một con trỏ số.

import { Hono } from "hono";
import { requireUser, type AppEnv } from "../context";
import { ApiError } from "../http";
import { consumeRateLimit } from "../ratelimit";
import { readJson } from "../validate";

export const RECRUIT_KINDS = ["account", "banner", "event"] as const;
export const RECRUIT_PAGE_SIZE = 500;
export const RECRUIT_MAX_BATCH = 500;
export const RECRUIT_MAX_ID = 100;
export const RECRUIT_MAX_DATA_BYTES = 4096;
/** Trần bản ghi mỗi user (mọi kind); vượt -> 413. */
export const RECRUIT_MAX_RECORDS = 20_000;

type RecruitKind = (typeof RECRUIT_KINDS)[number];

interface RecruitRecord {
  kind: RecruitKind;
  id: string;
  updatedAt: number;
  payload: string;
}

interface RecruitRow {
  kind: RecruitKind;
  id: string;
  updated_at: number;
  rev: number;
  payload: string;
}

const bad = (message: string) => new ApiError(400, "invalid_records", message);
const encoder = new TextEncoder();

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseRecord(value: unknown, index: number): RecruitRecord {
  const at = `records[${index}]`;
  if (!isPlainObject(value)) throw bad(`${at} phải là object`);
  const { kind, id, updatedAt, data } = value;
  if (!RECRUIT_KINDS.includes(kind as RecruitKind)) throw bad(`${at}.kind không hợp lệ`);
  if (typeof id !== "string" || id.length < 1 || id.length > RECRUIT_MAX_ID) throw bad(`${at}.id phải dài 1–${RECRUIT_MAX_ID}`);
  if (!Number.isSafeInteger(updatedAt) || (updatedAt as number) < 0) throw bad(`${at}.updatedAt phải là số nguyên ms`);
  if (!isPlainObject(data)) throw bad(`${at}.data phải là object`);
  if (data.id !== id) throw bad(`${at}.data.id khác id`);
  if (typeof data.updatedAt !== "string" || Date.parse(data.updatedAt) !== updatedAt) {
    throw bad(`${at}.data.updatedAt khác updatedAt`);
  }
  const payload = JSON.stringify(data);
  if (encoder.encode(payload).byteLength > RECRUIT_MAX_DATA_BYTES) throw bad(`${at}.data quá ${RECRUIT_MAX_DATA_BYTES} byte`);
  return { kind: kind as RecruitKind, id, updatedAt: updatedAt as number, payload };
}

function parseRecords(value: unknown): RecruitRecord[] {
  if (!Array.isArray(value)) throw bad("records phải là mảng");
  if (value.length > RECRUIT_MAX_BATCH) throw bad(`Tối đa ${RECRUIT_MAX_BATCH} bản ghi mỗi lần`);
  return value.map(parseRecord);
}

function parseSince(raw: string | undefined): number {
  if (raw === undefined || raw === "") return 0;
  const since = /^\d{1,16}$/u.test(raw) ? Number(raw) : NaN;
  if (!Number.isSafeInteger(since)) throw new ApiError(400, "invalid_since", "since phải là số nguyên ≥ 0");
  return since;
}

async function maxRev(db: D1Database, userId: string): Promise<number> {
  const row = await db
    .prepare("select coalesce(max(rev), 0) as rev from recruit_records where user_id = ?")
    .bind(userId)
    .first<{ rev: number }>();
  return row?.rev ?? 0;
}

/** Số bản ghi mới (chưa có trên server) mà lượt ghi sẽ thêm vượt trần -> 413. */
async function enforceQuota(db: D1Database, userId: string, records: RecruitRecord[]): Promise<void> {
  const stored = await db
    .prepare("select count(*) as n from recruit_records where user_id = ?")
    .bind(userId)
    .first<{ n: number }>();
  const total = stored?.n ?? 0;
  if (total + records.length <= RECRUIT_MAX_RECORDS) return;
  // Gần trần: đếm chính xác bao nhiêu khoá đã tồn tại (sửa bản ghi cũ không tính thêm).
  const keys = [...new Set(records.map((r) => `${r.kind}:${r.id}`))];
  const existing = await db
    .prepare(
      "select count(*) as n from recruit_records where user_id = ? and (kind || ':' || id) in (select value from json_each(?))",
    )
    .bind(userId, JSON.stringify(keys))
    .first<{ n: number }>();
  if (total + keys.length - (existing?.n ?? 0) > RECRUIT_MAX_RECORDS) {
    throw new ApiError(413, "recruit_quota_exceeded", `Vượt giới hạn ${RECRUIT_MAX_RECORDS} bản ghi đồng bộ`);
  }
}

// Ghi LWW: chỉ thay khi updatedAt tới mới hơn; rev = max(rev) của user + 1, tính trong cùng transaction
// của batch nên mỗi dòng thực sự được ghi nhận một rev mới, tăng dần.
const UPSERT =
  "insert into recruit_records (user_id, kind, id, updated_at, rev, payload) " +
  "values (?, ?, ?, ?, (select coalesce(max(rev), 0) + 1 from recruit_records where user_id = ?), ?) " +
  "on conflict (user_id, kind, id) do update set updated_at = excluded.updated_at, rev = excluded.rev, payload = excluded.payload " +
  "where excluded.updated_at > recruit_records.updated_at";

export const recruit = new Hono<AppEnv>();

recruit.get("/api/recruit", async (c) => {
  const { user } = await requireUser(c);
  const since = parseSince(c.req.query("since"));
  const { results } = await c.env.DB.prepare(
    "select kind, id, updated_at, rev, payload from recruit_records where user_id = ? and rev > ? order by rev limit ?",
  )
    .bind(user.id, since, RECRUIT_PAGE_SIZE + 1)
    .all<RecruitRow>();
  const more = results.length > RECRUIT_PAGE_SIZE;
  const rows = more ? results.slice(0, RECRUIT_PAGE_SIZE) : results;
  // Trang rỗng trả rev lớn nhất hiện có (không phải since) để client tự sửa con trỏ lệch.
  const cursor = rows.length ? rows[rows.length - 1].rev : await maxRev(c.env.DB, user.id);
  return c.json({
    records: rows.map((r) => ({ kind: r.kind, id: r.id, updatedAt: r.updated_at, data: JSON.parse(r.payload) as unknown })),
    cursor,
    more,
  });
});

recruit.post("/api/recruit", async (c) => {
  const { user } = await requireUser(c);
  const input = await readJson(c.req.raw);
  const records = parseRecords(input.records);
  const db = c.env.DB;
  await consumeRateLimit(db, "recruit_push", user.id, c.get("deps").now());
  let accepted = 0;
  if (records.length) {
    await enforceQuota(db, user.id, records);
    const upsert = db.prepare(UPSERT);
    const results = await db.batch(
      records.map((r) => upsert.bind(user.id, r.kind, r.id, r.updatedAt, user.id, r.payload)),
    );
    for (const res of results) accepted += res.meta.changes ?? 0;
  }
  return c.json({ accepted, cursor: await maxRev(db, user.id) });
});
