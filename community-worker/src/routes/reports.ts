// Chiến báo: phân tích ảnh (AI, failover theo danh sách ở tab AI), gửi, liệt kê đã duyệt, thống kê, ảnh,
// của tôi, kiểm duyệt admin.

import { Hono } from "hono";
import { activeProviders, loadProviders } from "../../../shared/ai-config";
import { analyzeReportImage, EMPTY_ANALYSIS, ModelError, toDataUri, type ReportAnalysis } from "../analyze";
import { currentUser, PAGE_SIZE, requireAdmin, requireUser, type AppEnv, type Ctx } from "../context";
import { isAdminEmail } from "../env";
import { ApiError, decodeCursor, iso, paginate } from "../http";
import { consumeRateLimit } from "../ratelimit";
import { aggregateStats } from "../stats";
import {
  IMAGE_TYPES,
  parseHeroes,
  parseImageUpload,
  parseLang,
  parseOptionalText,
  parsePageKey,
  parseResult,
  parseText,
  readJson,
  type ReportResult,
} from "../validate";

export const REPORT_IMAGE_MAX_BYTES = 1_500_000;
const REPORT_STATUSES = ["pending", "approved", "rejected"] as const;
type ReportStatus = (typeof REPORT_STATUSES)[number];

interface ReportRow {
  id: string;
  page_key: string;
  lang: string;
  user_id: string;
  image_key: string | null;
  result: ReportResult;
  ally_heroes: string;
  enemy_heroes: string;
  note: string | null;
  season: string | null;
  status: ReportStatus;
  reject_reason: string | null;
  created_at: number;
  author_name: string;
  author_image: string | null;
}

const SELECT =
  "select r.id, r.page_key, r.lang, r.user_id, r.image_key, r.result, r.ally_heroes, r.enemy_heroes, r.note, r.season, " +
  'r.status, r.reject_reason, r.created_at, u.name as author_name, u.image as author_image from battle_reports r join "user" u on u.id = r.user_id';
const BEFORE_CURSOR = "(r.created_at < ? or (r.created_at = ? and r.id < ?))";
const ORDER = " order by r.created_at desc, r.id desc limit ?";

function toPublicReport(row: ReportRow) {
  return {
    id: row.id,
    result: row.result,
    allyHeroes: JSON.parse(row.ally_heroes) as string[],
    enemyHeroes: JSON.parse(row.enemy_heroes) as string[],
    note: row.note,
    season: row.season,
    lang: row.lang,
    imageUrl: row.image_key ? `/api/reports/${row.id}/image` : null,
    createdAt: iso(row.created_at),
    author: { id: row.user_id, name: row.author_name, image: row.author_image },
  };
}

function toOwnedReport(row: ReportRow) {
  return { ...toPublicReport(row), page: row.page_key, status: row.status, rejectReason: row.reject_reason };
}

/** Liệt kê chiến báo với các điều kiện AND + phân trang con trỏ. */
async function listReports(c: Ctx, where: string[], binds: unknown[]) {
  const cursor = decodeCursor(c.req.query("cursor"));
  const conds = [...where];
  const args = [...binds];
  if (cursor) {
    conds.push(BEFORE_CURSOR);
    args.push(cursor.t, cursor.t, cursor.id);
  }
  const { results } = await c.env.DB.prepare(`${SELECT} where ${conds.join(" and ")}${ORDER}`)
    .bind(...args, PAGE_SIZE + 1)
    .all<ReportRow>();
  return paginate(results, PAGE_SIZE);
}

export const reports = new Hono<AppEnv>();

reports.post("/api/reports/analyze", async (c) => {
  const { user } = await requireUser(c);
  if ((c.env.FEATURE_ENABLED ?? "true") === "false") {
    throw new ApiError(503, "feature_disabled", "Tính năng phân tích ảnh đang tạm tắt");
  }
  const providers = activeProviders(await loadProviders(c.env.AI_KV, c.env.AI_CONFIG_SECRET));
  if (!providers.length) throw new ApiError(503, "ai_not_configured", "Chưa cấu hình dịch vụ AI");
  const image = await parseImageUpload(c.req.raw, "image", REPORT_IMAGE_MAX_BYTES);
  const { now, newId, fetchImpl } = c.get("deps");
  const createdAt = now();
  await consumeRateLimit(c.env.DB, "analyze", user.id, createdAt);

  const uploadId = newId();
  const key = `pending/${uploadId}`;
  await c.env.MEDIA.put(key, image.bytes, {
    httpMetadata: { contentType: image.contentType },
    customMetadata: { userId: user.id },
  });
  await c.env.DB.prepare(
    "insert into uploads (id, user_id, kind, object_key, content_type, size, status, created_at) values (?, ?, 'report', ?, ?, ?, 'pending', ?)",
  )
    .bind(uploadId, user.id, key, image.contentType, image.bytes.length, createdAt)
    .run();

  let analysis: ReportAnalysis;
  try {
    analysis = await analyzeReportImage(toDataUri(image.bytes, image.contentType), { providers, fetchImpl });
  } catch (e) {
    if (!(e instanceof ModelError)) throw e;
    // Ảnh không đọc được: vẫn giữ upload để người dùng tự nhập đội hình.
    if (e.status === 422) {
      analysis = EMPTY_ANALYSIS;
    } else {
      await c.env.MEDIA.delete(key);
      await c.env.DB.prepare("delete from uploads where id = ?").bind(uploadId).run();
      throw new ApiError(e.status, e.code, e.message);
    }
  }
  return c.json({ uploadId, analysis });
});

reports.post("/api/reports", async (c) => {
  const { user } = await requireUser(c);
  const input = await readJson(c.req.raw);
  const page = parsePageKey(input.page);
  const lang = parseLang(input.lang);
  const uploadId = parseText(input.uploadId, "uploadId", 1, 64);
  const result = parseResult(input.result);
  const allyHeroes = parseHeroes(input.allyHeroes, "allyHeroes", 1);
  const enemyHeroes = parseHeroes(input.enemyHeroes, "enemyHeroes", 0);
  const note = parseOptionalText(input.note, "note", 500);
  const season = parseOptionalText(input.season, "season", 40);
  const { now, newId } = c.get("deps");
  const createdAt = now();

  const upload = await c.env.DB.prepare(
    "select object_key, content_type from uploads where id = ? and user_id = ? and kind = 'report' and status = 'pending'",
  )
    .bind(uploadId, user.id)
    .first<{ object_key: string; content_type: string }>();
  if (!upload) throw new ApiError(400, "invalid_upload", "Ảnh chiến báo không tồn tại hoặc đã hết hạn");
  const object = await c.env.MEDIA.get(upload.object_key);
  if (!object) throw new ApiError(400, "invalid_upload", "Ảnh chiến báo không tồn tại hoặc đã hết hạn");
  await consumeRateLimit(c.env.DB, "report", user.id, createdAt);

  // Chuyển ảnh khỏi vùng pending (bị cron dọn sau 24 giờ) sang reports/.
  const id = newId();
  const imageKey = `reports/${id}.${IMAGE_TYPES[upload.content_type] ?? "img"}`;
  await c.env.MEDIA.put(imageKey, await object.arrayBuffer(), {
    httpMetadata: { contentType: upload.content_type },
    customMetadata: { userId: user.id },
  });
  await c.env.DB.batch([
    c.env.DB.prepare(
      "insert into battle_reports (id, page_key, lang, user_id, image_key, result, ally_heroes, enemy_heroes, note, season, status, created_at) " +
        "values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)",
    ).bind(id, page, lang, user.id, imageKey, result, JSON.stringify(allyHeroes), JSON.stringify(enemyHeroes), note, season, createdAt),
    c.env.DB.prepare("update uploads set status = 'attached', object_key = ? where id = ?").bind(imageKey, uploadId),
  ]);
  await c.env.MEDIA.delete(upload.object_key);
  return c.json({ id, status: "pending" }, 201);
});

reports.get("/api/reports", async (c) => {
  const page = parsePageKey(c.req.query("page"));
  const lang = parseLang(c.req.query("lang"));
  const { rows, nextCursor } = await listReports(c, ["r.page_key = ?", "r.lang = ?", "r.status = 'approved'"], [page, lang]);
  return c.json({ items: rows.map(toPublicReport), nextCursor });
});

reports.get("/api/reports/stats", async (c) => {
  const page = parsePageKey(c.req.query("page"));
  const { results } = await c.env.DB.prepare(
    "select result, enemy_heroes from battle_reports where page_key = ? and status = 'approved'",
  )
    .bind(page)
    .all<{ result: ReportResult; enemy_heroes: string }>();
  const stats = aggregateStats(results.map((r) => ({ result: r.result, enemyHeroes: JSON.parse(r.enemy_heroes) as string[] })));
  return c.json(stats);
});

reports.get("/api/reports/:id/image", async (c) => {
  const row = await c.env.DB.prepare("select user_id, image_key, status from battle_reports where id = ?")
    .bind(c.req.param("id"))
    .first<{ user_id: string; image_key: string | null; status: ReportStatus }>();
  const notFound = new ApiError(404, "not_found", "Không tìm thấy ảnh");
  if (!row || !row.image_key) throw notFound;
  const approved = row.status === "approved";
  if (!approved) {
    // Ảnh chưa duyệt chỉ chủ báo cáo hoặc admin xem được; người khác nhận 404.
    const user = await currentUser(c);
    if (!user || (user.id !== row.user_id && !isAdminEmail(c.env, user.email))) throw notFound;
  }
  const object = await c.env.MEDIA.get(row.image_key);
  if (!object) throw notFound;
  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
      "Cache-Control": approved ? "public, max-age=3600" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
      ETag: object.httpEtag,
    },
  });
});

reports.get("/api/me/reports", async (c) => {
  const { user } = await requireUser(c);
  const { rows, nextCursor } = await listReports(c, ["r.user_id = ?"], [user.id]);
  return c.json({ items: rows.map(toOwnedReport), nextCursor });
});

reports.get("/api/admin/reports", async (c) => {
  await requireAdmin(c);
  const status = c.req.query("status") ?? "pending";
  if (!REPORT_STATUSES.includes(status as ReportStatus)) {
    throw new ApiError(400, "invalid_status", "status phải là pending, approved hoặc rejected");
  }
  const { rows, nextCursor } = await listReports(c, ["r.status = ?"], [status]);
  return c.json({ items: rows.map(toOwnedReport), nextCursor });
});

/** Đổi trạng thái kiểm duyệt; 404 nếu không có báo cáo. */
async function review(c: Ctx, status: "approved" | "rejected", reason: string | null) {
  const { user } = await requireAdmin(c);
  const id = c.req.param("id");
  const res = await c.env.DB.prepare(
    "update battle_reports set status = ?, reject_reason = ?, reviewed_by = ?, reviewed_at = ? where id = ?",
  )
    .bind(status, reason, user.id, c.get("deps").now(), id)
    .run();
  if (!res.meta.changes) throw new ApiError(404, "not_found", "Không tìm thấy chiến báo");
  return c.json({ id, status, rejectReason: reason });
}

reports.post("/api/admin/reports/:id/approve", (c) => review(c, "approved", null));

reports.post("/api/admin/reports/:id/reject", async (c) => {
  await requireAdmin(c);
  const input = await readJson(c.req.raw);
  return review(c, "rejected", parseText(input.reason, "reason", 1, 500));
});
