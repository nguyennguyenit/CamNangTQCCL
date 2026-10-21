// Chiến báo: phân tích ảnh (AI, failover theo danh sách ở tab AI), gửi, liệt kê đã duyệt, thống kê, ảnh,
// của tôi, kiểm duyệt admin.

import { Hono } from "hono";
import { auditIfStmt } from "../audit";
import { loadAiConfig, resolveRoute } from "../../../shared/ai-config";
import { analyzeReportImage, EMPTY_ANALYSIS, ModelError, toDataUri, type ReportAnalysis } from "../analyze";
import { currentUser, effectiveRole, PAGE_SIZE, requireStaff, requireUser, type AppEnv, type Ctx } from "../context";
import { ApiError, decodeCursor, iso, paginate } from "../http";
import { visibleUserSql } from "../moderation";
import { consumeRateLimit } from "../ratelimit";
import { aggregateStats } from "../stats";
import { communityTeamVisibleOpenSql, communityTeamVisibleSql, diagnoseCommunityTeam } from "./teams";
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
  communityTeamIdFromPage,
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

/** Đội cộng đồng của trang còn hiển thị công khai (approved, chưa chốt xoá, tác giả hiển thị). */
async function communityTeamVisible(c: Ctx, teamId: string, now: number): Promise<boolean> {
  const row = await c.env.DB.prepare(`select ${communityTeamVisibleSql} as ok`).bind(teamId, now).first<{ ok: number }>();
  return row?.ok === 1;
}

/** Mã lỗi khi ghi vào trang đội bị từ chối: đội không hiển thị -> 404, mùa đóng -> 409. */
function teamRefusal(state: "missing" | "closed" | "ok"): ApiError {
  return state === "closed" ? new ApiError(409, "season_closed", "Mùa đã đóng") : new ApiError(404, "not_found", "Không tìm thấy đội");
}

export const reports = new Hono<AppEnv>();

reports.post("/api/reports/analyze", async (c) => {
  const { user } = await requireUser(c);
  if ((c.env.FEATURE_ENABLED ?? "true") === "false") {
    throw new ApiError(503, "feature_disabled", "Tính năng phân tích ảnh đang tạm tắt");
  }
  const route = resolveRoute(await loadAiConfig(c.env.AI_KV, c.env.AI_CONFIG_SECRET), "battleReport");
  if (!route.targets.length) throw new ApiError(503, "ai_not_configured", "Chưa cấu hình dịch vụ AI");
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
  try {
    await c.env.DB.prepare(
      "insert into uploads (id, user_id, kind, object_key, content_type, size, status, created_at) values (?, ?, 'report', ?, ?, ?, 'pending', ?)",
    )
      .bind(uploadId, user.id, key, image.contentType, image.bytes.length, createdAt)
      .run();
  } catch (e) {
    // Không để ảnh mồ côi trong R2 khi D1 lỗi (vd trigger chặn user bị khoá).
    await c.env.MEDIA.delete(key);
    throw e;
  }

  let analysis: ReportAnalysis;
  try {
    analysis = await analyzeReportImage(toDataUri(image.bytes, image.contentType), { route, fetchImpl });
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
  const clientSeason = parseOptionalText(input.season, "season", 40);
  const { now, newId } = c.get("deps");
  const createdAt = now();

  const upload = await c.env.DB.prepare(
    "select object_key, content_type from uploads where id = ? and user_id = ? and kind = 'report' and status = 'pending' and object_key not like 'pending/team-%'",
  )
    .bind(uploadId, user.id)
    .first<{ object_key: string; content_type: string }>();
  if (!upload) throw new ApiError(400, "invalid_upload", "Ảnh chiến báo không tồn tại hoặc đã hết hạn");
  const object = await c.env.MEDIA.get(upload.object_key);
  if (!object) throw new ApiError(400, "invalid_upload", "Ảnh chiến báo không tồn tại hoặc đã hết hạn");
  // Trang đội cộng đồng: kiểm đội/mùa TRƯỚC rate limit để lượt bị từ chối không tốn hạn mức; mùa lấy từ đội, bỏ giá trị client.
  const teamId = communityTeamIdFromPage(page);
  let season = clientSeason;
  if (teamId) {
    const team = await diagnoseCommunityTeam(c.env.DB, teamId, createdAt);
    if (team.state !== "ok") throw teamRefusal(team.state);
    season = team.seasonId;
  }
  await consumeRateLimit(c.env.DB, "report", user.id, createdAt);

  // Chuyển ảnh khỏi vùng pending (bị cron dọn sau 24 giờ) sang reports/.
  const id = newId();
  const imageKey = `reports/${id}.${IMAGE_TYPES[upload.content_type] ?? "img"}`;
  await c.env.MEDIA.put(imageKey, await object.arrayBuffer(), {
    httpMetadata: { contentType: upload.content_type },
    customMetadata: { userId: user.id },
  });
  const insert = c.env.DB.prepare(
    "insert into battle_reports (id, page_key, lang, user_id, image_key, result, ally_heroes, enemy_heroes, note, season, status, created_at) " +
      `select ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?${teamId ? ` where ${communityTeamVisibleOpenSql}` : ""}`,
  ).bind(id, page, lang, user.id, imageKey, result, JSON.stringify(allyHeroes), JSON.stringify(enemyHeroes), note, season, createdAt, ...(teamId ? [teamId, createdAt] : []));
  let inserted: number;
  try {
    const results = await c.env.DB.batch([
      insert,
      // Chỉ gắn ảnh khi dòng chiến báo thật sự được ghi: bị chặn thì upload vẫn pending để gửi lại.
      c.env.DB.prepare("update uploads set status = 'attached', object_key = ? where id = ? and exists (select 1 from battle_reports where id = ?)").bind(imageKey, uploadId, id),
    ]);
    inserted = results[0].meta.changes;
  } catch (e) {
    // Không để ảnh mồ côi trong R2 khi D1 lỗi (vd trigger chặn user bị khoá).
    await c.env.MEDIA.delete(imageKey);
    throw e;
  }
  if (!inserted) {
    // Giữ pending/<uploadId> và dòng upload pending; chỉ bỏ bản sao mới.
    await c.env.MEDIA.delete(imageKey);
    const after = teamId ? await diagnoseCommunityTeam(c.env.DB, teamId, now()) : { state: "missing" as const };
    throw teamRefusal(after.state === "closed" ? "closed" : "missing");
  }
  await c.env.MEDIA.delete(upload.object_key);
  return c.json({ id, status: "pending" }, 201);
});

reports.get("/api/reports", async (c) => {
  const page = parsePageKey(c.req.query("page"));
  const lang = parseLang(c.req.query("lang"));
  const now = c.get("deps").now();
  // Điều kiện ẩn đặt ở lời gọi công khai (listReports còn phục vụ /api/me/reports và /api/admin/reports).
  const teamId = communityTeamIdFromPage(page);
  if (teamId) {
    // Trang đội cộng đồng: kho chung vi/zh (bỏ lọc lang); đội không hiển thị -> rỗng, không lộ trạng thái.
    if (!(await communityTeamVisible(c, teamId, now))) return c.json({ items: [], nextCursor: null });
    const { rows, nextCursor } = await listReports(c, ["r.page_key = ?", "r.status = 'approved'", visibleUserSql("u")], [page, now]);
    return c.json({ items: rows.map(toPublicReport), nextCursor });
  }
  const { rows, nextCursor } = await listReports(c, ["r.page_key = ?", "r.lang = ?", "r.status = 'approved'", visibleUserSql("u")], [page, lang, now]);
  return c.json({ items: rows.map(toPublicReport), nextCursor });
});

reports.get("/api/reports/stats", async (c) => {
  const page = parsePageKey(c.req.query("page"));
  const now = c.get("deps").now();
  const teamId = communityTeamIdFromPage(page);
  if (teamId && !(await communityTeamVisible(c, teamId, now))) return c.json(aggregateStats([]));
  const { results } = await c.env.DB.prepare(
    `select r.result, r.enemy_heroes from battle_reports r join "user" u on u.id = r.user_id where r.page_key = ? and r.status = 'approved' and ${visibleUserSql("u")}`,
  )
    .bind(page, now)
    .all<{ result: ReportResult; enemy_heroes: string }>();
  const stats = aggregateStats(results.map((r) => ({ result: r.result, enemyHeroes: JSON.parse(r.enemy_heroes) as string[] })));
  return c.json(stats);
});

/** If-None-Match có khớp ETag không (danh sách, bỏ tiền tố yếu W/, hoặc *). */
function etagMatches(header: string | undefined, etag: string): boolean {
  if (!header) return false;
  return header.split(",").some((part) => {
    const tag = part.trim().replace(/^W\//u, "");
    return tag === "*" || tag === etag;
  });
}

reports.get("/api/reports/:id/image", async (c) => {
  const row = await c.env.DB.prepare(
    `select r.user_id, r.image_key, r.status, r.page_key, (${visibleUserSql("u")}) as author_visible from battle_reports r join "user" u on u.id = r.user_id where r.id = ?`,
  )
    .bind(c.get("deps").now(), c.req.param("id"))
    .first<{ user_id: string; image_key: string | null; status: ReportStatus; page_key: string; author_visible: number }>();
  const notFound = new ApiError(404, "not_found", "Không tìm thấy ảnh");
  if (!row || !row.image_key) throw notFound;
  // Công khai = đã duyệt và tác giả không bị khoá/đang xoá (trang đội cộng đồng: thêm đội cha còn hiển thị).
  // Còn lại chỉ chủ báo cáo hoặc staff xem được.
  // Phân quyền xong mới xét ETag: ETag cũ của khách không được dùng để dò ảnh đã bị ẩn.
  const teamId = communityTeamIdFromPage(row.page_key);
  const open = row.status === "approved" && row.author_visible === 1 && (!teamId || (await communityTeamVisible(c, teamId, c.get("deps").now())));
  if (!open) {
    const user = await currentUser(c);
    if (!user || (user.id !== row.user_id && effectiveRole(c.env, user) === "user")) throw notFound;
  }
  const object = await c.env.MEDIA.get(row.image_key);
  if (!object) throw notFound;
  const headers = {
    "Cache-Control": open ? "public, no-cache" : "private, no-store",
    "X-Content-Type-Options": "nosniff",
    ETag: object.httpEtag,
  };
  if (etagMatches(c.req.header("if-none-match"), object.httpEtag)) {
    await object.body.cancel();
    return new Response(null, { status: 304, headers });
  }
  return new Response(object.body, { headers: { ...headers, "Content-Type": object.httpMetadata?.contentType || "application/octet-stream" } });
});

reports.get("/api/me/reports", async (c) => {
  const { user } = await requireUser(c);
  const { rows, nextCursor } = await listReports(c, ["r.user_id = ?"], [user.id]);
  return c.json({ items: rows.map(toOwnedReport), nextCursor });
});

reports.get("/api/admin/reports", async (c) => {
  await requireStaff(c);
  const status = c.req.query("status") ?? "pending";
  if (!REPORT_STATUSES.includes(status as ReportStatus)) {
    throw new ApiError(400, "invalid_status", "status phải là pending, approved hoặc rejected");
  }
  const { rows, nextCursor } = await listReports(c, ["r.status = ?"], [status]);
  return c.json({ items: rows.map(toOwnedReport), nextCursor });
});

/** Đổi trạng thái kiểm duyệt; 404 nếu không có báo cáo. */
async function review(c: Ctx, status: "approved" | "rejected", reason: string | null) {
  const viewer = await requireStaff(c);
  const { user } = viewer;
  const id = c.req.param("id") ?? "";
  const row = await c.env.DB.prepare("select user_id, page_key from battle_reports where id = ?")
    .bind(id)
    .first<{ user_id: string; page_key: string }>();
  if (!row) throw new ApiError(404, "not_found", "Không tìm thấy chiến báo");
  const at = c.get("deps").now();
  // Nhật ký chỉ ghi khi chính UPDATE này đã đặt reviewed_by/reviewed_at của yêu cầu.
  const [res] = await c.env.DB.batch([
    c.env.DB.prepare("update battle_reports set status = ?, reject_reason = ?, reviewed_by = ?, reviewed_at = ? where id = ?").bind(
      status,
      reason,
      user.id,
      at,
      id,
    ),
    auditIfStmt(
      c,
      viewer,
      {
        action: status === "approved" ? "report.approve" : "report.reject",
        targetType: "report",
        targetId: id,
        targetLabel: row.page_key,
        subjectUserId: row.user_id,
        reason,
        status: "ok",
      },
      "select 1 from battle_reports where id = ? and status = ? and reviewed_by = ? and reviewed_at = ?",
      [id, status, user.id, at],
    ),
  ]);
  if (!res.meta.changes) throw new ApiError(404, "not_found", "Không tìm thấy chiến báo");
  return c.json({ id, status, rejectReason: reason });
}

reports.post("/api/admin/reports/:id/approve", (c) => review(c, "approved", null));

reports.post("/api/admin/reports/:id/reject", async (c) => {
  await requireStaff(c);
  const input = await readJson(c.req.raw);
  return review(c, "rejected", parseText(input.reason, "reason", 1, 500));
});
