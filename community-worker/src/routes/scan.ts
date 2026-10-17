// Soi đội: đo độ chính xác đọc ảnh chiến báo.
// (1) Đếm ẩn danh mỗi lần Đối chiếu (không ảnh, không tên, chỉ IP đã băm để giới hạn tốc độ);
// (2) ảnh gửi tự nguyện (đăng nhập) -> admin duyệt -> xuất fixture bộ ảnh chuẩn.

import { Hono } from "hono";
import { auditIfStmt, writeAuditQuietly, type AuditEntry } from "../audit";
import { currentUser, PAGE_SIZE, requireStaff, requireUser, type AppEnv, type Ctx } from "../context";
import { ApiError, decodeCursor, iso, paginate } from "../http";
import { consumeRateLimit } from "../ratelimit";
import { hashIp } from "../turnstile";
import { IMAGE_TYPES, parseImageUpload, parseLang, readJson } from "../validate";

export const SCAN_IMAGE_MAX_BYTES = 1_500_000;
export const SCAN_SCREENS = ["battleReport", "teamDetail", "other"] as const;
export const SCAN_SIDES = ["left", "right"] as const;
const STATS_WINDOWS = [7, 30, 90] as const;
const SAMPLE_STATUSES = ["pending", "approved", "rejected"] as const;
type SampleStatus = (typeof SAMPLE_STATUSES)[number];

const MAX_CELLS = 12;
const MAX_AI_HEROES = 6;
const MAX_READ_CHARS = 40;
const MAX_PAYLOAD_CHARS = 20_000;
const ID_RE = {
  hero: /^hero:[a-z0-9]+(?:-[a-z0-9]+)*$/u,
  tactic: /^tactic:[a-z0-9]+(?:-[a-z0-9]+)*$/u,
  book: /^book:[a-z0-9]+(?:-[a-z0-9]+)*$/u,
} as const;

const bad = (code: string, message: string) => new ApiError(400, code, message);

function parseEnum<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (!allowed.includes(value as T)) throw bad(`invalid_${field}`, `${field} phải là ${allowed.join(", ")}`);
  return value as T;
}

function parseCount(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > MAX_CELLS) {
    throw bad(`invalid_${field}`, `${field} phải là số nguyên 0..${MAX_CELLS}`);
  }
  return value;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseId(value: unknown, kind: keyof typeof ID_RE, field: string): string {
  if (typeof value !== "string" || value.length > 120 || !ID_RE[kind].test(value)) {
    throw bad(`invalid_${field}`, `${field} phải là ID ${kind}:<slug>`);
  }
  return value;
}

function parseOptionalId(value: unknown, kind: keyof typeof ID_RE, field: string): string | null {
  return value === null ? null : parseId(value, kind, field);
}

/** Chuỗi chữ Hán AI chép: cắt còn MAX_READ_CHARS ký tự (theo code point), bỏ khoảng trắng hai đầu. */
function clip(value: unknown, field: string): string {
  if (typeof value !== "string") throw bad(`invalid_${field}`, `${field} phải là chuỗi`);
  return [...value.trim()].slice(0, MAX_READ_CHARS).join("");
}

function clipList(value: unknown, field: string, max: number): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw bad(`invalid_${field}`, `${field} phải là mảng`);
  return value.slice(0, max).map((v) => clip(v, field));
}

interface HeroRead {
  nameCn: string;
  tacticsCn: string[];
  booksCn: string[];
  statFocusCn: string;
}

function parseAiRead(value: unknown): { heroes: HeroRead[] } {
  if (!isObject(value) || !Array.isArray(value.heroes) || value.heroes.length < 1 || value.heroes.length > MAX_AI_HEROES) {
    throw bad("invalid_aiRead", `aiRead.heroes phải có 1–${MAX_AI_HEROES} tướng`);
  }
  const heroes = value.heroes.map((h): HeroRead => {
    if (!isObject(h)) throw bad("invalid_aiRead", "Mỗi tướng trong aiRead phải là object");
    return {
      nameCn: clip(h.nameCn, "nameCn"),
      tacticsCn: clipList(h.tacticsCn, "tacticsCn", 3),
      booksCn: clipList(h.booksCn, "booksCn", 6),
      statFocusCn: h.statFocusCn == null ? "" : clip(h.statFocusCn, "statFocusCn"),
    };
  });
  return { heroes };
}

export interface ConfirmedHero {
  hero: string;
  tactics: [string | null, string | null];
  book: string | null;
}

function parseConfirmed(value: unknown): { heroes: ConfirmedHero[] } {
  if (!isObject(value) || !Array.isArray(value.heroes) || value.heroes.length !== 3) {
    throw bad("invalid_confirmed", "confirmed.heroes phải có đúng 3 tướng");
  }
  const heroes = value.heroes.map((h): ConfirmedHero => {
    if (!isObject(h)) throw bad("invalid_confirmed", "Mỗi tướng trong confirmed phải là object");
    if (!Array.isArray(h.tactics) || h.tactics.length !== 2) {
      throw bad("invalid_confirmed", "tactics phải có đúng 2 phần tử");
    }
    return {
      hero: parseId(h.hero, "hero", "hero"),
      tactics: [parseOptionalId(h.tactics[0], "tactic", "tactic"), parseOptionalId(h.tactics[1], "tactic", "tactic")],
      book: parseOptionalId(h.book ?? null, "book", "book"),
    };
  });
  return { heroes };
}

export const scan = new Hono<AppEnv>();

// ---- Đếm ẩn danh ----

scan.post("/api/scan-stats", async (c) => {
  const input = await readJson(c.req.raw);
  const screen = parseEnum(input.screen, SCAN_SCREENS, "screen");
  const side = parseEnum(input.side, SCAN_SIDES, "side");
  const read = parseCount(input.read, "read");
  const edited = parseCount(input.edited, "edited");
  const unclear = parseCount(input.unclear, "unclear");
  // Ô không rõ luôn là ô đã có chữ AI chép.
  if (unclear > read) throw bad("invalid_unclear", "unclear không được lớn hơn read");

  const ipSecret = c.env.IP_HASH_SECRET;
  if (!ipSecret) throw new ApiError(503, "scan_stats_unavailable", "Chưa cấu hình giới hạn tốc độ cho thống kê");
  const now = c.get("deps").now();
  const ip = c.req.header("cf-connecting-ip") || "";
  await consumeRateLimit(c.env.DB, "scan_stats", `ip:${await hashIp(ip, ipSecret)}`, now);

  const day = new Date(now).toISOString().slice(0, 10);
  await c.env.DB.prepare(
    "insert into scan_stats (day, screen, side, events, cells_read, cells_edited, cells_unclear) values (?, ?, ?, 1, ?, ?, ?) " +
      "on conflict (day, screen, side) do update set events = events + 1, cells_read = cells_read + excluded.cells_read, " +
      "cells_edited = cells_edited + excluded.cells_edited, cells_unclear = cells_unclear + excluded.cells_unclear",
  )
    .bind(day, screen, side, read, edited, unclear)
    .run();
  return c.json({ ok: true }, 201);
});

scan.get("/api/admin/scan-stats", async (c) => {
  await requireStaff(c);
  const raw = c.req.query("days");
  const days = raw === undefined || raw === "" ? 30 : Number(raw);
  if (!STATS_WINDOWS.includes(days as (typeof STATS_WINDOWS)[number])) {
    throw bad("invalid_days", "days phải là 7, 30 hoặc 90");
  }
  // Cửa sổ gồm hôm nay và days-1 ngày trước (UTC).
  const from = new Date(c.get("deps").now() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  const { results } = await c.env.DB.prepare(
    "select screen, side, sum(events) as events, sum(cells_read) as read, sum(cells_edited) as edited, sum(cells_unclear) as unclear " +
      "from scan_stats where day >= ? group by screen, side order by screen, side",
  )
    .bind(from)
    .all<{ screen: string; side: string; events: number; read: number; edited: number; unclear: number }>();
  return c.json({ days, rows: results });
});

// ---- Ảnh gửi tự nguyện ----

interface SampleRow {
  id: string;
  user_id: string;
  image_key: string | null;
  screen: string;
  side: string;
  lang: string;
  ai_read: string;
  confirmed: string;
  status: SampleStatus;
  created_at: number;
  author_name: string;
  author_image: string | null;
}

const SELECT =
  "select s.id, s.user_id, s.image_key, s.screen, s.side, s.lang, s.ai_read, s.confirmed, s.status, s.created_at, " +
  'u.name as author_name, u.image as author_image from scan_samples s join "user" u on u.id = s.user_id';

scan.post("/api/scan-samples", async (c) => {
  const { user } = await requireUser(c);
  // Đọc ảnh từ bản sao để còn đọc được `payload` từ request gốc.
  const image = await parseImageUpload(c.req.raw.clone(), "image", SCAN_IMAGE_MAX_BYTES);
  const form = await c.req.raw.formData();
  const rawPayload = form.get("payload");
  if (typeof rawPayload !== "string" || !rawPayload || rawPayload.length > MAX_PAYLOAD_CHARS) {
    throw bad("invalid_payload", "payload phải là chuỗi JSON hợp lệ");
  }
  let payload: unknown;
  try {
    payload = JSON.parse(rawPayload);
  } catch {
    throw bad("invalid_payload", "payload không phải JSON hợp lệ");
  }
  if (!isObject(payload)) throw bad("invalid_payload", "payload phải là object JSON");
  const screen = parseEnum(payload.screen, SCAN_SCREENS, "screen");
  const side = parseEnum(payload.side, SCAN_SIDES, "side");
  const lang = parseLang(payload.lang);
  const aiRead = parseAiRead(payload.aiRead);
  const confirmed = parseConfirmed(payload.confirmed);

  const { now, newId } = c.get("deps");
  const createdAt = now();
  await consumeRateLimit(c.env.DB, "scan_sample", user.id, createdAt);

  const id = newId();
  const imageKey = `scan-samples/${id}.${IMAGE_TYPES[image.contentType] ?? "img"}`;
  await c.env.MEDIA.put(imageKey, image.bytes, {
    httpMetadata: { contentType: image.contentType },
    customMetadata: { userId: user.id },
  });
  try {
    await c.env.DB.prepare(
      "insert into scan_samples (id, user_id, image_key, screen, side, lang, ai_read, confirmed, status, created_at) " +
        "values (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)",
    )
      .bind(id, user.id, imageKey, screen, side, lang, JSON.stringify(aiRead), JSON.stringify(confirmed), createdAt)
      .run();
  } catch (e) {
    // Không để ảnh mồ côi trong R2 khi D1 lỗi.
    await c.env.MEDIA.delete(imageKey);
    throw e;
  }
  return c.json({ id, status: "pending" }, 201);
});

scan.get("/api/admin/scan-samples", async (c) => {
  await requireStaff(c);
  const status = parseEnum(c.req.query("status") ?? "pending", SAMPLE_STATUSES, "status");
  const conds = ["s.status = ?"];
  const args: unknown[] = [status];
  const cursor = decodeCursor(c.req.query("cursor"));
  if (cursor) {
    conds.push("(s.created_at < ? or (s.created_at = ? and s.id < ?))");
    args.push(cursor.t, cursor.t, cursor.id);
  }
  const { results } = await c.env.DB.prepare(`${SELECT} where ${conds.join(" and ")} order by s.created_at desc, s.id desc limit ?`)
    .bind(...args, PAGE_SIZE + 1)
    .all<SampleRow>();
  const { rows, nextCursor } = paginate(results, PAGE_SIZE);
  return c.json({
    items: rows.map((r) => ({
      id: r.id,
      screen: r.screen,
      side: r.side,
      lang: r.lang,
      aiRead: JSON.parse(r.ai_read) as unknown,
      confirmed: JSON.parse(r.confirmed) as unknown,
      status: r.status,
      hasImage: r.image_key !== null,
      createdAt: iso(r.created_at),
      author: { name: r.author_name, image: r.author_image },
    })),
    nextCursor,
  });
});

async function findSample(c: Ctx): Promise<SampleRow> {
  const row = await c.env.DB.prepare(`${SELECT} where s.id = ?`).bind(c.req.param("id")).first<SampleRow>();
  if (!row) throw new ApiError(404, "not_found", "Không tìm thấy mẫu");
  return row;
}

scan.get("/api/admin/scan-samples/:id/image", async (c) => {
  await requireStaff(c);
  const row = await findSample(c);
  const notFound = new ApiError(404, "not_found", "Không tìm thấy ảnh");
  if (!row.image_key) throw notFound;
  const object = await c.env.MEDIA.get(row.image_key);
  if (!object) throw notFound;
  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

/** UPDATE duyệt không đổi dòng nào: mẫu đã bị xoá -> 404, còn lại do `fallback`. */
async function explainNoChange(c: Ctx, id: string, fallback: ApiError): Promise<ApiError> {
  const current = await c.env.DB.prepare("select 1 from scan_samples where id = ?").bind(id).first();
  if (!current) return new ApiError(404, "not_found", "Không tìm thấy mẫu");
  return fallback;
}

scan.post("/api/admin/scan-samples/:id/approve", async (c) => {
  const viewer = await requireStaff(c);
  const { user } = viewer;
  const row = await findSample(c);
  // Mẫu đã bị từ chối mất ảnh: không thể duyệt lại. Điều kiện nằm cả trong UPDATE để một lượt từ chối chạy
  // song song (xoá ảnh giữa lúc đọc và ghi) không để lại mẫu "đã duyệt" mà không có ảnh.
  const missing = new ApiError(409, "image_missing", "Mẫu không còn ảnh, không thể duyệt");
  if (!row.image_key) throw missing;
  const at = c.get("deps").now();
  const [res] = await c.env.DB.batch([
    c.env.DB.prepare(
      "update scan_samples set status = 'approved', reviewed_by = ?, reviewed_at = ? where id = ? and image_key is not null",
    ).bind(user.id, at, row.id),
    auditIfStmt(
      c,
      viewer,
      sampleAudit("scan_sample.approve", row),
      "select 1 from scan_samples where id = ? and status = 'approved' and image_key is not null and reviewed_by = ? and reviewed_at = ?",
      [row.id, user.id, at],
    ),
  ]);
  if (!res.meta.changes) throw await explainNoChange(c, row.id, missing);
  return c.json({ id: row.id, status: "approved" });
});

function sampleAudit(action: string, row: SampleRow): AuditEntry {
  return { action, targetType: "scan_sample", targetId: row.id, targetLabel: `${row.screen}/${row.side}`, subjectUserId: row.user_id, status: "ok" };
}

scan.post("/api/admin/scan-samples/:id/reject", async (c) => {
  const viewer = await requireStaff(c);
  const { user } = viewer;
  const row = await findSample(c);
  // Xoá ảnh trước: nếu xoá lỗi thì giữ nguyên trạng thái để thử lại (nhật ký `failed`, D1 không đổi).
  if (row.image_key) {
    try {
      await c.env.MEDIA.delete(row.image_key);
    } catch (error) {
      await writeAuditQuietly(c, viewer, { ...sampleAudit("scan_sample.reject", row), status: "failed", meta: { step: "r2" } });
      throw error;
    }
  }
  const at = c.get("deps").now();
  let res: D1Result;
  try {
    [res] = await c.env.DB.batch([
      c.env.DB.prepare(
        "update scan_samples set status = 'rejected', image_key = null, reviewed_by = ?, reviewed_at = ? where id = ?",
      ).bind(user.id, at, row.id),
      auditIfStmt(
        c,
        viewer,
        sampleAudit("scan_sample.reject", row),
        "select 1 from scan_samples where id = ? and status = 'rejected' and image_key is null and reviewed_by = ? and reviewed_at = ?",
        [row.id, user.id, at],
      ),
    ]);
  } catch (error) {
    // Ảnh R2 đã xoá nhưng D1 lỗi: kết quả dở dang (mẫu còn trỏ tới ảnh không tồn tại).
    if (row.image_key) await writeAuditQuietly(c, viewer, { ...sampleAudit("scan_sample.reject", row), status: "partial", meta: { step: "d1" } });
    throw error;
  }
  if (!res.meta.changes) {
    if (row.image_key) await writeAuditQuietly(c, viewer, { ...sampleAudit("scan_sample.reject", row), status: "partial", meta: { step: "d1", changed: false } });
    throw await explainNoChange(c, row.id, new ApiError(409, "review_conflict", "Mẫu đã thay đổi, thử lại"));
  }
  return c.json({ id: row.id, status: "rejected" });
});

// Fixture bộ ảnh chuẩn (worker/eval/fixtures/<id>.json); ảnh admin tải riêng từ endpoint ảnh. Không xuất
// `screen`: đó là nhãn AI tự đoán cho chính ảnh này (người dùng không xác nhận), chấm lại bằng nó là tự so với mình.
scan.get("/api/admin/scan-samples/:id/fixture", async (c) => {
  await requireStaff(c);
  const row = await findSample(c);
  if (row.status !== "approved") throw new ApiError(409, "not_approved", "Chỉ xuất fixture từ mẫu đã duyệt");
  if (!row.image_key) throw new ApiError(409, "image_missing", "Mẫu không còn ảnh");
  const ext = row.image_key.slice(row.image_key.lastIndexOf(".") + 1);
  const confirmed = JSON.parse(row.confirmed) as { heroes: ConfirmedHero[] };
  return c.json({
    image: `${row.id}.${ext}`,
    source: `scan-sample ${row.id}`,
    expected: { sides: [{ side: row.side, heroes: confirmed.heroes }] },
  });
});
