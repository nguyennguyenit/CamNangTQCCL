// Đồng bộ "Theo dõi chiêu mộ": kéo thay đổi theo rev, đẩy bản ghi gộp LWW theo updatedAt.
// Mỗi dòng được ghi nhận rev mới (tăng dần theo user) nên client chỉ cần nhớ một con trỏ số.

import { Hono } from "hono";
import { requireUser, type AppEnv } from "../context";
import { ApiError } from "../http";
import { consumeRateLimit } from "../ratelimit";
import { requireToken } from "../tokens";
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

// ---- Ghi lượt quay từ tool ngoài (token API, `POST /api/recruit/pulls`) ----
// Server dựng event schema v2 giống `recordDaily*` của js/recruit-tracker-store.js: mỗi lượt một event `pulls: 1`.

export const RECRUIT_DAILY_BANNER_ID = "danh-tuong-pk";
/** Số lượt rẻ (miễn phí + nửa giá) mỗi ngày của gói ngày — khớp DAILY_PULL_LIMIT phía client. */
export const RECRUIT_DAILY_PULL_LIMIT = 4;
export const RECRUIT_DEFAULT_TIME_ZONE = "Asia/Ho_Chi_Minh";
/** Phân loại 5★ của tracker (giá trị tiếng Việt lưu trong kho), khớp VALUE_CLASSES của js/recruit-tracker.js. */
const VALUE_CLASSES = ["Chưa phân loại", "Chủ lực", "Dùng đội", "Tình huống", "Nội chính", "Vật liệu"];
const PULL_KEY_RE = /^[A-Za-z0-9_-]{8,64}$/u;
const HERO_MAX = 40;
const ACCOUNT_NAME_MAX = 100;

interface PullInput {
  key: string;
  at: number;
  fiveStar: boolean;
  hero: string;
  heroValueClass: string;
}

const badPulls = (message: string) => new ApiError(400, "invalid_pulls", message);
const normalizeName = (value: string) => value.trim().normalize("NFC");

function parseTimeZone(value: unknown): Intl.DateTimeFormat {
  const timeZone = value === undefined || value === null || value === "" ? RECRUIT_DEFAULT_TIME_ZONE : value;
  if (typeof timeZone !== "string") throw new ApiError(400, "invalid_timeZone", "timeZone phải là tên IANA");
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  } catch {
    throw new ApiError(400, "invalid_timeZone", "timeZone phải là tên IANA, vd Asia/Ho_Chi_Minh");
  }
}

/** `YYYY-MM-DD` của mốc `ms` theo múi giờ của formatter. */
function localDate(format: Intl.DateTimeFormat, ms: number): string {
  const parts = Object.fromEntries(format.formatToParts(ms).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function parsePull(value: unknown, index: number): PullInput {
  const at = `pulls[${index}]`;
  if (!isPlainObject(value)) throw badPulls(`${at} phải là object`);
  const { key, fiveStar, hero, heroValueClass } = value;
  if (typeof key !== "string" || !PULL_KEY_RE.test(key)) throw badPulls(`${at}.key phải gồm 8–64 ký tự A-Z a-z 0-9 _ -`);
  const ms = typeof value.at === "string" ? Date.parse(value.at) : NaN;
  if (!Number.isFinite(ms) || ms < 0) throw badPulls(`${at}.at phải là thời điểm ISO 8601`);
  if (typeof fiveStar !== "boolean") throw badPulls(`${at}.fiveStar phải là boolean`);
  if (!fiveStar) return { key, at: ms, fiveStar, hero: "", heroValueClass: "" };
  const name = typeof hero === "string" ? hero.trim() : "";
  if (!name || Array.from(name).length > HERO_MAX) throw badPulls(`${at}.hero bắt buộc với lượt 5★, 1–${HERO_MAX} ký tự`);
  const valueClass = heroValueClass === undefined || heroValueClass === "" ? VALUE_CLASSES[0] : heroValueClass;
  if (typeof valueClass !== "string" || !VALUE_CLASSES.includes(valueClass)) {
    throw badPulls(`${at}.heroValueClass phải là một trong: ${VALUE_CLASSES.join(", ")}`);
  }
  return { key, at: ms, fiveStar, hero: name, heroValueClass: valueClass };
}

function parsePulls(value: unknown): PullInput[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > RECRUIT_DAILY_PULL_LIMIT) {
    throw badPulls(`pulls phải là mảng 1–${RECRUIT_DAILY_PULL_LIMIT} lượt`);
  }
  const pulls = value.map(parsePull);
  if (new Set(pulls.map((p) => p.key)).size !== pulls.length) throw badPulls("key trùng trong cùng lô");
  return pulls;
}

/** Tài khoản tracker còn sống có tên khớp chính xác (trim + NFC); không có -> 404, nhiều -> 409. */
async function findAccountId(db: D1Database, userId: string, accountName: string): Promise<string> {
  const { results } = await db
    .prepare("select id, payload from recruit_records where user_id = ? and kind = 'account'")
    .bind(userId)
    .all<{ id: string; payload: string }>();
  const matches = results.filter((r) => {
    const data = JSON.parse(r.payload) as { name?: unknown; deletedAt?: unknown };
    return !data.deletedAt && typeof data.name === "string" && normalizeName(data.name) === accountName;
  });
  if (!matches.length) throw new ApiError(404, "account_not_found", "Không có tài khoản tracker trùng tên");
  if (matches.length > 1) throw new ApiError(409, "account_ambiguous", "Nhiều tài khoản tracker trùng tên; đổi tên cho khác nhau");
  return matches[0].id;
}

/** Số lượt rẻ đã ghi (event còn sống, miss/fiveStar) của tài khoản trên gói ngày, theo từng ngày. */
async function dailyUsed(db: D1Database, userId: string, accountId: string, dates: string[]): Promise<Map<string, number>> {
  const { results } = await db
    .prepare(
      "select json_extract(payload, '$.date') as date, sum(json_extract(payload, '$.pulls')) as n from recruit_records " +
        "where user_id = ? and kind = 'event' and json_extract(payload, '$.accountId') = ? and json_extract(payload, '$.bannerId') = ? " +
        "and json_extract(payload, '$.result') in ('miss', 'fiveStar') and coalesce(json_extract(payload, '$.deletedAt'), '') = '' " +
        "and json_extract(payload, '$.date') in (select value from json_each(?)) group by 1",
    )
    .bind(userId, accountId, RECRUIT_DAILY_BANNER_ID, JSON.stringify(dates))
    .all<{ date: string; n: number }>();
  return new Map(results.map((r) => [r.date, Number(r.n) || 0]));
}

recruit.post("/api/recruit/pulls", async (c) => {
  const { userId } = await requireToken(c, "recruit:write");
  const input = await readJson(c.req.raw);
  if (typeof input.accountName !== "string" || !normalizeName(input.accountName) || input.accountName.length > ACCOUNT_NAME_MAX) {
    throw new ApiError(400, "invalid_accountName", `accountName phải dài 1–${ACCOUNT_NAME_MAX} ký tự`);
  }
  if (input.banner !== RECRUIT_DAILY_BANNER_ID) {
    throw new ApiError(400, "invalid_banner", `Chỉ hỗ trợ banner "${RECRUIT_DAILY_BANNER_ID}"`);
  }
  const format = parseTimeZone(input.timeZone);
  const pulls = parsePulls(input.pulls);
  const db = c.env.DB;
  const now = c.get("deps").now();
  await consumeRateLimit(db, "recruit_token_push", userId, now);
  const accountId = await findAccountId(db, userId, normalizeName(input.accountName));

  // Lượt cùng `at` (hoặc lùi) trong lô được đẩy +1 ms để thứ tự occurredAt giữ đúng thứ tự gửi.
  let previous = -1;
  const events = pulls.map((p) => {
    const occurred = Math.max(p.at, previous + 1);
    previous = occurred;
    return { pull: p, id: `evt_ext_${p.key}`, date: localDate(format, occurred), occurred };
  });
  const { results: existing } = await db
    .prepare("select id from recruit_records where user_id = ? and kind = 'event' and id in (select value from json_each(?))")
    .bind(userId, JSON.stringify(events.map((e) => e.id)))
    .all<{ id: string }>();
  const seen = new Set(existing.map((r) => r.id));
  const fresh = events.filter((e) => !seen.has(e.id));

  const dates = [...new Set(events.map((e) => e.date))];
  const used = await dailyUsed(db, userId, accountId, dates);
  for (const e of fresh) used.set(e.date, (used.get(e.date) ?? 0) + 1);
  for (const [date, n] of used) {
    if (n > RECRUIT_DAILY_PULL_LIMIT) {
      throw new ApiError(409, "daily_limit", `Ngày ${date} vượt ${RECRUIT_DAILY_PULL_LIMIT} lượt rẻ của gói ngày; không ghi lượt nào`);
    }
  }

  const updatedAt = new Date(now).toISOString();
  const records: RecruitRecord[] = fresh.map(({ pull: p, id, date, occurred }) => {
    const occurredAt = new Date(occurred).toISOString();
    const data = {
      id,
      accountId,
      bannerId: RECRUIT_DAILY_BANNER_ID,
      date,
      drawKind: "daily",
      pulls: 1,
      result: p.fiveStar ? "fiveStar" : "miss",
      heroName: p.hero,
      heroValueClass: p.heroValueClass,
      note: "",
      occurredAt,
      createdAt: occurredAt,
      updatedAt,
      deletedAt: "",
    };
    return { kind: "event", id, updatedAt: now, payload: JSON.stringify(data) };
  });
  let accepted = 0;
  if (records.length) {
    await enforceQuota(db, userId, records);
    const upsert = db.prepare(UPSERT);
    const results = await db.batch(records.map((r) => upsert.bind(userId, r.kind, r.id, r.updatedAt, userId, r.payload)));
    for (const res of results) accepted += res.meta.changes ?? 0;
  }
  const lastDate = events[events.length - 1].date;
  return c.json({
    accepted,
    duplicates: events.length - fresh.length,
    events: events.map((e) => ({ key: e.pull.key, id: e.id, date: e.date, duplicate: seen.has(e.id) })),
    daily: { date: lastDate, used: used.get(lastDate) ?? 0, limit: RECRUIT_DAILY_PULL_LIMIT },
    cursor: await maxRev(db, userId),
  });
});
