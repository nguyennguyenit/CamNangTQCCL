// Quản trị người dùng: danh sách/chi tiết (root + KDV), khoá/mở khoá, cấp quyền KDV (root), xoá tài khoản (root).
// Mọi ràng buộc về đích (không phải chính mình/root/đang xoá, KDV chỉ với user thường, quyền ghi đè khoá) nằm trong
// chính câu SQL ghi; dòng nhật ký chỉ được ghi khi điều kiện đó thoả, nên không có khe giữa đọc và ghi.

import { Hono } from "hono";
import { auditIfStmt, writeAuditQuietly } from "../audit";
import { deployMeta, settle, triggerDeploy } from "../deploy";
import { PAGE_SIZE, requireRoot, requireStaff, type AppEnv, type Ctx, type Viewer } from "../context";
import { adminEmails, isAdminEmail, type Env } from "../env";
import { ApiError, decodeCursor, encodeCursor, iso } from "../http";
import { BAN_DURATIONS, maskEmail, PERMANENT_BAN_UNTIL } from "../moderation";
import { parseText, readJson } from "../validate";
import { toAuditItem, type AuditRow } from "./audit";

const ROLE_FILTERS = ["user", "moderator", "root"] as const;
const STATUS_FILTERS = ["active", "banned", "deleting"] as const;
const QUERY_MAX = 100;
const R2_DELETE_CHUNK = 1000;
const DETAIL_ITEMS = 10;
const DETAIL_AUDIT = 20;

interface UserRow {
  id: string;
  name: string;
  email: string;
  image: string | null;
  created_at: string | number;
  last_seen_at: number | null;
  role: string | null;
  banned_until: number | null;
  ban_reason: string | null;
  banned_by_role: string | null;
  deleting_at: number | null;
  comments_n: number;
  reports_n: number;
  feedback_n: number;
  scan_n: number;
}

const SELECT =
  'select u.id, u.name, u.email, u.image, u."createdAt" as created_at, u.last_seen_at, u.role, u.banned_until, u.ban_reason, ' +
  'u.banned_by_role, u.deleting_at, ' +
  "(select count(*) from comments where user_id = u.id) as comments_n, " +
  "(select count(*) from battle_reports where user_id = u.id) as reports_n, " +
  "(select count(*) from feedback where user_id = u.id) as feedback_n, " +
  "(select count(*) from scan_samples where user_id = u.id) as scan_n " +
  'from "user" u';

/** Mốc tạo (ms) từ cột ISO của Better Auth; không đọc được -> null. */
function createdMs(raw: string | number): number | null {
  const ms = typeof raw === "number" ? raw : Date.parse(raw);
  return Number.isFinite(ms) && Number.isFinite(new Date(ms).getTime()) ? ms : null;
}

/** `lower(trim(col)) in (ADMIN_EMAILS)` + bind; danh sách rỗng -> luôn sai. Khớp cách so sánh ở comments.ts. */
function rootSql(env: Env, col: string): { sql: string; binds: string[] } {
  const admins = [...adminEmails(env)];
  return { sql: admins.length ? `lower(trim(${col})) in (${admins.map(() => "?").join(", ")})` : "0", binds: admins };
}

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/gu, (ch) => `\\${ch}`);
}

function banView(row: { banned_until: number | null; ban_reason: string | null; banned_by_role: string | null }, now: number) {
  if (row.banned_until === null || row.banned_until <= now) return null;
  return {
    until: row.banned_until >= PERMANENT_BAN_UNTIL ? null : iso(row.banned_until),
    reason: row.ban_reason,
    byRole: row.banned_by_role,
  };
}

function toUser(env: Env, viewer: Viewer, row: UserRow, now: number) {
  const masked = viewer.role !== "root";
  const created = createdMs(row.created_at);
  return {
    id: row.id,
    name: row.name,
    email: masked ? maskEmail(row.email) : row.email,
    ...(masked ? { emailMasked: true } : {}),
    image: row.image,
    createdAt: created === null ? null : iso(created),
    lastSeenAt: iso(row.last_seen_at),
    role: isAdminEmail(env, row.email) ? "root" : row.role === "moderator" ? "moderator" : "user",
    ban: banView(row, now),
    deleting: row.deleting_at !== null,
    counts: { comments: row.comments_n, reports: row.reports_n, feedback: row.feedback_n, scanSamples: row.scan_n },
  };
}

interface TargetRow {
  id: string;
  email: string;
  role: string | null;
  banned_until: number | null;
  ban_reason: string | null;
  banned_by_role: string | null;
  deleting_at: number | null;
}

const TARGET_SELECT = 'select id, email, role, banned_until, ban_reason, banned_by_role, deleting_at from "user" where id = ?';

async function loadTarget(c: Ctx, id: string): Promise<TargetRow> {
  const target = await c.env.DB.prepare(TARGET_SELECT).bind(id).first<TargetRow>();
  if (!target) throw new ApiError(404, "not_found", "Không tìm thấy người dùng");
  return target;
}

const deleting = () => new ApiError(409, "user_deleting", "Tài khoản đang được xoá");
const forbidden = () => new ApiError(403, "forbidden", "Không có quyền thao tác với người dùng này");

/** Chống tự thao tác (400) và nhắm root (403) trước khi chạm DB ghi; SQL ghi lặp lại cả hai điều kiện. */
function rejectSelfOrRoot(c: Ctx, viewer: Viewer, target: TargetRow) {
  if (target.id === viewer.user.id) throw new ApiError(400, "invalid_target", "Không thể thao tác với chính mình");
  if (isAdminEmail(c.env, target.email)) throw forbidden();
}

export const users = new Hono<AppEnv>();

users.get("/api/admin/users", async (c) => {
  const viewer = await requireStaff(c);
  const now = c.get("deps").now();
  const where: string[] = [];
  const binds: unknown[] = [];

  const role = c.req.query("role");
  if (role) {
    if (!ROLE_FILTERS.includes(role as (typeof ROLE_FILTERS)[number])) throw new ApiError(400, "invalid_role", "role không hợp lệ");
    const root = rootSql(c.env, "u.email");
    if (role === "root") {
      where.push(`(${root.sql})`);
      binds.push(...root.binds);
    } else {
      where.push(`not (${root.sql}) and u.role = ?`);
      binds.push(...root.binds, role);
    }
  }

  const status = c.req.query("status");
  if (status) {
    if (!STATUS_FILTERS.includes(status as (typeof STATUS_FILTERS)[number])) throw new ApiError(400, "invalid_status", "status không hợp lệ");
    if (status === "deleting") {
      where.push("u.deleting_at is not null");
    } else if (status === "banned") {
      where.push("u.deleting_at is null and u.banned_until > ?");
      binds.push(now);
    } else {
      where.push("u.deleting_at is null and (u.banned_until is null or u.banned_until <= ?)");
      binds.push(now);
    }
  }

  const q = (c.req.query("q") ?? "").trim();
  if (q.length > QUERY_MAX) throw new ApiError(400, "invalid_q", "Từ khoá quá dài");
  if (q) {
    if (viewer.role === "root") {
      where.push("(u.name like ? escape '\\' or u.email like ? escape '\\')");
      binds.push(`%${escapeLike(q)}%`, `%${escapeLike(q)}%`);
    } else {
      // KDV không dò được email: chỉ khớp nguyên địa chỉ, không khớp một phần.
      where.push("(u.name like ? escape '\\' or lower(u.email) = lower(?))");
      binds.push(`%${escapeLike(q)}%`, q);
    }
  }

  const cursor = decodeCursor(c.req.query("cursor"));
  if (cursor) {
    if (!Number.isFinite(new Date(cursor.t).getTime())) throw new ApiError(400, "invalid_cursor", "Con trỏ phân trang không hợp lệ");
    const at = new Date(cursor.t).toISOString();
    where.push('(u."createdAt" < ? or (u."createdAt" = ? and u.id < ?))');
    binds.push(at, at, cursor.id);
  }

  const clause = where.length ? ` where ${where.join(" and ")}` : "";
  const { results } = await c.env.DB.prepare(`${SELECT}${clause} order by u."createdAt" desc, u.id desc limit ?`)
    .bind(...binds, PAGE_SIZE + 1)
    .all<UserRow>();
  const page = results.slice(0, PAGE_SIZE);
  const last = page[page.length - 1];
  const lastMs = last ? (createdMs(last.created_at) ?? 0) : 0;
  return c.json({
    items: page.map((r) => toUser(c.env, viewer, r, now)),
    nextCursor: results.length > PAGE_SIZE ? encodeCursor({ t: lastMs, id: last.id }) : null,
  });
});

users.get("/api/admin/users/:id", async (c) => {
  const viewer = await requireStaff(c);
  const id = c.req.param("id");
  const now = c.get("deps").now();
  const row = await c.env.DB.prepare(`${SELECT} where u.id = ?`).bind(id).first<UserRow>();
  if (!row) throw new ApiError(404, "not_found", "Không tìm thấy người dùng");
  const [comments, reports, log] = await Promise.all([
    c.env.DB.prepare("select id, page_key, lang, body, created_at from comments where user_id = ? order by created_at desc, id desc limit ?")
      .bind(id, DETAIL_ITEMS)
      .all<{ id: string; page_key: string; lang: string; body: string; created_at: number }>(),
    c.env.DB.prepare(
      "select id, page_key, lang, result, status, reject_reason, image_key, created_at from battle_reports where user_id = ? order by created_at desc, id desc limit ?",
    )
      .bind(id, DETAIL_ITEMS)
      .all<{ id: string; page_key: string; lang: string; result: string; status: string; reject_reason: string | null; image_key: string | null; created_at: number }>(),
    c.env.DB.prepare("select * from admin_audit where subject_user_id = ? order by created_at desc, id desc limit ?").bind(id, DETAIL_AUDIT).all<AuditRow>(),
  ]);
  return c.json({
    user: toUser(c.env, viewer, row, now),
    comments: comments.results.map((r) => ({ id: r.id, page: r.page_key, lang: r.lang, body: r.body, createdAt: iso(r.created_at) })),
    reports: reports.results.map((r) => ({
      id: r.id,
      page: r.page_key,
      lang: r.lang,
      result: r.result,
      status: r.status,
      rejectReason: r.reject_reason,
      imageUrl: r.image_key ? `/api/reports/${r.id}/image` : null,
      createdAt: iso(r.created_at),
    })),
    audit: log.results.map(toAuditItem),
  });
});

users.post("/api/admin/users/:id/ban", async (c) => {
  const viewer = await requireStaff(c);
  const { user: actor, role } = viewer;
  const id = c.req.param("id");
  const input = await readJson(c.req.raw);
  const duration = input.duration;
  if (typeof duration !== "string" || !Object.hasOwn(BAN_DURATIONS, duration)) {
    throw new ApiError(400, "invalid_duration", "duration phải là 1d, 7d, 30d hoặc permanent");
  }
  const reason = parseText(input.reason, "reason", 1, 500);
  const target = await loadTarget(c, id);
  rejectSelfOrRoot(c, viewer, target);

  const { now: nowFn, newId } = c.get("deps");
  const now = nowFn();
  const span = BAN_DURATIONS[duration as keyof typeof BAN_DURATIONS];
  const until = span === null ? PERMANENT_BAN_UNTIL : now + span;
  const root = rootSql(c.env, "email");
  const byModerator = role === "moderator";
  // Điều kiện đủ quyền áp lên đích TRƯỚC khi ghi: KDV chỉ với user thường và không đè khoá còn hạn của root.
  const before =
    `deleting_at is null and id <> ? and not (${root.sql})` +
    (byModerator ? " and role = 'user' and (banned_until is null or banned_until <= ? or banned_by_role = 'moderator')" : "");
  const beforeBinds = [actor.id, ...root.binds, ...(byModerator ? [now] : [])];
  // Điều kiện CÒN đúng SAU khi ghi và chứng minh chính yêu cầu này đã đặt khoá (actor, vai trò, lý do, hạn).
  const after =
    `id = ? and banned_by = ? and banned_by_role = ? and ban_reason = ? and banned_until = ? and deleting_at is null and id <> ? and not (${root.sql})` +
    (byModerator ? " and role = 'user'" : "");
  const auditId = newId();
  const banMeta = { duration, until, votesRemoved: 0 };
  const votes = await c.env.DB.prepare("select count(*) as n from community_team_votes where user_id = ?").bind(id).first<{ n: number }>();
  banMeta.votesRemoved = votes?.n ?? 0;
  const [res, logged] = await c.env.DB.batch([
    c.env.DB.prepare(
      `update "user" set banned_until = ?, ban_reason = ?, banned_by = ?, banned_by_role = ? where id = ? and ${before}`,
    ).bind(until, reason, actor.id, role, id, ...beforeBinds),
    auditIfStmt(
      c,
      viewer,
      {
        id: auditId,
        action: "user.ban",
        targetType: "user",
        targetId: id,
        targetLabel: maskEmail(target.email),
        subjectUserId: id,
        reason,
        meta: deployMeta(banMeta, true),
        status: "ok",
      },
      `select 1 from "user" where ${after}`,
      [id, actor.id, role, reason, until, actor.id, ...root.binds],
    ),
    // Chỉ huỷ phiên khi dòng nhật ký của đúng yêu cầu này đã được ghi (tức khoá đã áp).
    c.env.DB.prepare('delete from session where "userId" = ? and exists (select 1 from admin_audit where id = ?)').bind(id, auditId),
    // Cùng điều kiện với huỷ phiên: chỉ xoá vote khi khoá của đúng yêu cầu này đã áp (trigger đếm lại điểm đội).
    c.env.DB.prepare("delete from community_team_votes where user_id = ? and exists (select 1 from admin_audit where id = ?)").bind(id, auditId),
  ]);
  if (!res.meta.changes || !logged.meta.changes) {
    const now2 = await c.env.DB.prepare(TARGET_SELECT).bind(id).first<TargetRow>();
    if (!now2) throw new ApiError(404, "not_found", "Không tìm thấy người dùng");
    throw now2.deleting_at !== null ? deleting() : forbidden();
  }
  const deploy = await triggerDeploy(c.env, c.get("deps").fetchImpl);
  await settle(c, auditId, banMeta, deploy);
  return c.json({ id, ban: { until: span === null ? null : iso(until), reason, byRole: role }, deploy });
});

users.post("/api/admin/users/:id/unban", async (c) => {
  const viewer = await requireStaff(c);
  const id = c.req.param("id");
  const target = await loadTarget(c, id);
  if (target.deleting_at !== null) throw deleting();
  if (target.banned_until === null) throw new ApiError(409, "not_banned", "Người dùng không bị khoá");

  const root = rootSql(c.env, "email");
  const byModerator = viewer.role === "moderator";
  // Khớp đúng khoá đã đọc (hạn, người đặt, lý do): nếu khoá vừa bị thay thì không mở nhầm và nhật ký không sai nội dung.
  const guard =
    "id = ? and banned_until = ? and banned_by_role is ? and ban_reason is ? and deleting_at is null" +
    (byModerator ? ` and role = 'user' and banned_by_role = 'moderator' and not (${root.sql})` : "");
  const guardBinds = [id, target.banned_until, target.banned_by_role, target.ban_reason, ...(byModerator ? root.binds : [])];
  const previous = { previousUntil: target.banned_until, previousByRole: target.banned_by_role, previousReason: target.ban_reason };
  const auditId = c.get("deps").newId();
  // Xoá cột làm mất bằng chứng -> dòng nhật ký đặt TRƯỚC UPDATE với đúng điều kiện của UPDATE.
  const [logged, res] = await c.env.DB.batch([
    auditIfStmt(
      c,
      viewer,
      {
        id: auditId,
        action: "user.unban",
        targetType: "user",
        targetId: id,
        targetLabel: maskEmail(target.email),
        subjectUserId: id,
        meta: deployMeta(previous, true),
        status: "ok",
      },
      `select 1 from "user" where ${guard}`,
      guardBinds,
    ),
    c.env.DB.prepare(
      `update "user" set banned_until = null, ban_reason = null, banned_by = null, banned_by_role = null where ${guard}`,
    ).bind(...guardBinds),
  ]);
  if (!res.meta.changes || !logged.meta.changes) {
    const now2 = await c.env.DB.prepare(TARGET_SELECT).bind(id).first<TargetRow>();
    if (!now2) throw new ApiError(404, "not_found", "Không tìm thấy người dùng");
    if (now2.deleting_at !== null) throw deleting();
    if (now2.banned_until === null) throw new ApiError(409, "not_banned", "Người dùng không bị khoá");
    throw byModerator ? forbidden() : new ApiError(409, "conflict", "Trạng thái khoá vừa thay đổi, thử lại");
  }
  const deploy = await triggerDeploy(c.env, c.get("deps").fetchImpl);
  await settle(c, auditId, previous, deploy);
  return c.json({ id, ban: null, deploy });
});

users.post("/api/admin/users/:id/role", async (c) => {
  const viewer = await requireRoot(c);
  const id = c.req.param("id");
  const input = await readJson(c.req.raw);
  const to = input.role;
  if (to !== "user" && to !== "moderator") throw new ApiError(400, "invalid_role", "role phải là user hoặc moderator");
  const target = await loadTarget(c, id);
  rejectSelfOrRoot(c, viewer, target);
  if (target.deleting_at !== null) throw deleting();
  const from = target.role === "moderator" ? "moderator" : "user";
  if (from === to) throw new ApiError(409, "role_unchanged", "Vai trò không thay đổi");

  const root = rootSql(c.env, "email");
  // Từ/đến trong nhật ký chỉ đúng khi vai trò đang là `from`: điều kiện này dùng chung cho nhật ký và UPDATE.
  const guard = `id = ? and role = ? and deleting_at is null and not (${root.sql})`;
  const guardBinds = [id, from, ...root.binds];
  const [logged, res] = await c.env.DB.batch([
    auditIfStmt(
      c,
      viewer,
      { action: "user.role", targetType: "user", targetId: id, targetLabel: maskEmail(target.email), subjectUserId: id, meta: { from, to }, status: "ok" },
      `select 1 from "user" where ${guard}`,
      guardBinds,
    ),
    c.env.DB.prepare(`update "user" set role = ? where ${guard}`).bind(to, ...guardBinds),
  ]);
  if (!res.meta.changes || !logged.meta.changes) {
    const now2 = await c.env.DB.prepare(TARGET_SELECT).bind(id).first<TargetRow>();
    if (!now2) throw new ApiError(404, "not_found", "Không tìm thấy người dùng");
    if (now2.deleting_at !== null) throw deleting();
    if (isAdminEmail(c.env, now2.email)) throw forbidden();
    throw new ApiError(409, "conflict", "Vai trò vừa thay đổi, thử lại");
  }
  return c.json({ id, role: to });
});

/** Khoá R2 của user cần xoá: ảnh chiến báo/soi đội (không gồm uploads.kind='post' đang dùng trên blog), khử trùng. */
async function inventoryKeys(c: Ctx, id: string): Promise<string[]> {
  const keys = new Set<string>();
  const queries = [
    "select object_key as k from uploads where user_id = ? and kind = 'report'",
    "select image_key as k from battle_reports where user_id = ? and image_key is not null",
    "select image_key as k from scan_samples where user_id = ? and image_key is not null",
    "select i.object_key as k from community_team_images i join community_teams t on t.id = i.team_id where t.author_id = ?",
    `select r.image_key as k from battle_reports r where r.page_key in (${TEAM_PAGES}) and r.image_key is not null`,
  ];
  for (const sql of queries) {
    const { results } = await c.env.DB.prepare(sql).bind(id).all<{ k: string }>();
    for (const r of results) keys.add(r.k);
  }
  return [...keys];
}

/** Page key của mọi đội của một tác giả (bind một `author_id`). */
const TEAM_PAGES = "select '/doi-cong-dong/' || id || '/' from community_teams where author_id = ?";

users.delete("/api/admin/users/:id", async (c) => {
  const viewer = await requireRoot(c);
  const { user: actor } = viewer;
  const id = c.req.param("id");
  const input = await readJson(c.req.raw);
  const target = await loadTarget(c, id);
  rejectSelfOrRoot(c, viewer, target);
  const confirm = typeof input.confirmEmail === "string" ? input.confirmEmail.trim().toLowerCase() : null;
  if (confirm === null || confirm !== target.email.trim().toLowerCase()) {
    throw new ApiError(400, "confirm_mismatch", "Email xác nhận không khớp");
  }

  const { now: nowFn, newId } = c.get("deps");
  const now = nowFn();
  const root = rootSql(c.env, "email");
  const label = maskEmail(target.email);
  const banned = () => new ApiError(409, "user_banned", "Phải mở khoá tài khoản trước khi xoá");

  if (target.deleting_at === null) {
    if (target.banned_until !== null && target.banned_until > now) throw banned();
    // Bước chuyển trạng thái duy nhất: nhật ký `start` đặt TRƯỚC UPDATE với đúng điều kiện của UPDATE, nên chỉ yêu cầu
    // thật sự đổi trạng thái mới sinh dòng start (thử lại/đồng thời không nhân đôi). Phiên chỉ bị huỷ khi dòng đó có.
    const guard = `id = ? and deleting_at is null and id <> ? and not (${root.sql}) and (banned_until is null or banned_until <= ?)`;
    const guardBinds = [id, actor.id, ...root.binds, now];
    const auditId = newId();
    const [logged, res] = await c.env.DB.batch([
      auditIfStmt(
        c,
        viewer,
        {
          id: auditId,
          action: "user.delete.start",
          targetType: "user",
          targetId: id,
          targetLabel: label,
          subjectUserId: id,
          meta: deployMeta({}, true),
          status: "ok",
        },
        `select 1 from "user" where ${guard}`,
        guardBinds,
      ),
      c.env.DB.prepare(`update "user" set deleting_at = ? where ${guard}`).bind(now, ...guardBinds),
      c.env.DB.prepare('delete from session where "userId" = ? and exists (select 1 from admin_audit where id = ?)').bind(id, auditId),
    ]);
    if (!res.meta.changes || !logged.meta.changes) {
      // Thua cuộc đồng thời: nếu yêu cầu khác đã bắt đầu xoá thì chạy tiếp như thử lại (không gửi site-publish: yêu cầu thắng gửi); ngược lại giải thích vì sao không được.
      const now2 = await c.env.DB.prepare(TARGET_SELECT).bind(id).first<TargetRow>();
      if (!now2) throw new ApiError(404, "not_found", "Không tìm thấy người dùng");
      if (now2.deleting_at === null) throw now2.banned_until !== null && now2.banned_until > now ? banned() : forbidden();
    } else {
      // Tài khoản đã ẩn khỏi mọi đọc công khai: build lại site trước khi dọn R2 (lần gọi lại không vào đây).
      const deploy = await triggerDeploy(c.env, c.get("deps").fetchImpl);
      await settle(c, auditId, {}, deploy);
    }
  }

  const keys = await inventoryKeys(c, id);
  let removed = 0;
  try {
    for (let i = 0; i < keys.length; i += R2_DELETE_CHUNK) {
      const chunk = keys.slice(i, i + R2_DELETE_CHUNK);
      await c.env.MEDIA.delete(chunk);
      removed += chunk.length;
    }
  } catch (error) {
    console.error("user delete: R2 cleanup failed", id, error);
    await writeAuditQuietly(c, viewer, {
      action: "user.delete",
      targetType: "user",
      targetId: id,
      targetLabel: label,
      subjectUserId: id,
      meta: { step: "r2", removed, total: keys.length },
      status: "failed",
    });
    throw new ApiError(502, "delete_incomplete", "Chưa xoá hết ảnh, thử lại để hoàn tất");
  }

  const counts = await c.env.DB.prepare(
    "select (select count(*) from comments where user_id = ?) as comments, (select count(*) from battle_reports where user_id = ?) as reports, " +
      "(select count(*) from scan_samples where user_id = ?) as scan_samples, (select count(*) from feedback where user_id = ?) as feedback, " +
      "(select count(*) from community_teams where author_id = ?) as teams",
  )
    .bind(id, id, id, id, id)
    .first<{ comments: number; reports: number; scan_samples: number; feedback: number; teams: number }>();

  // Điều kiện đích dùng cho mọi câu của batch: vẫn đang xoá, không phải mình/root. Câu cuối DELETE (cascade phần còn lại).
  const eligible = `id = ? and deleting_at is not null and id <> ? and not (${root.sql})`;
  const eligibleBinds = [id, actor.id, ...root.binds];
  const gate = ` and exists (select 1 from "user" where ${eligible})`;
  const stmts = [
    // Đặt TRƯỚC DELETE: sau DELETE không còn gì chứng minh yêu cầu này đã xoá; yêu cầu thử lại đồng thời đến sau
    // thấy user đã mất nên không ghi trùng.
    auditIfStmt(
      c,
      viewer,
      {
        action: "user.delete",
        targetType: "user",
        targetId: id,
        targetLabel: label,
        subjectUserId: id,
        meta: {
          objects: removed,
          comments: counts?.comments ?? 0,
          reports: counts?.reports ?? 0,
          scanSamples: counts?.scan_samples ?? 0,
          feedback: counts?.feedback ?? 0,
          teams: counts?.teams ?? 0,
        },
        status: "ok",
      },
      `select 1 from "user" where ${eligible}`,
      eligibleBinds,
    ),
    c.env.DB.prepare(`update uploads set user_id = ? where user_id = ? and kind = 'post'${gate}`).bind(actor.id, id, ...eligibleBinds),
    c.env.DB.prepare(`update posts set author_id = null where author_id = ?${gate}`).bind(id, ...eligibleBinds),
    c.env.DB.prepare(`update feedback set email = null, user_id = null where user_id = ?${gate}`).bind(id, ...eligibleBinds),
    // Nội dung của người khác trên trang đội của user (đội cascade qua FK): xoá trước, ảnh chiến báo kèm dòng uploads.
    c.env.DB.prepare(
      `delete from uploads where object_key in (select r.image_key from battle_reports r where r.page_key in (${TEAM_PAGES}) and r.image_key is not null)${gate}`,
    ).bind(id, ...eligibleBinds),
    c.env.DB.prepare(`delete from comments where page_key in (${TEAM_PAGES})${gate}`).bind(id, ...eligibleBinds),
    c.env.DB.prepare(`delete from battle_reports where page_key in (${TEAM_PAGES})${gate}`).bind(id, ...eligibleBinds),
    c.env.DB.prepare(`update community_teams set reviewed_by = null where reviewed_by = ?${gate}`).bind(id, ...eligibleBinds),
    c.env.DB.prepare(`update battle_reports set reviewed_by = null where reviewed_by = ?${gate}`).bind(id, ...eligibleBinds),
    c.env.DB.prepare(`update scan_samples set reviewed_by = null where reviewed_by = ?${gate}`).bind(id, ...eligibleBinds),
    c.env.DB.prepare(`delete from "user" where ${eligible}`).bind(...eligibleBinds),
  ];
  let results: D1Result[];
  try {
    results = await c.env.DB.batch(stmts);
  } catch (error) {
    // R2 đã xoá xong nhưng D1 lỗi: user vẫn đang xoá, gọi lại sẽ hoàn tất; ghi dấu vết trước khi báo lỗi.
    console.error("user delete: final D1 batch failed", id, error);
    await writeAuditQuietly(c, viewer, {
      action: "user.delete",
      targetType: "user",
      targetId: id,
      targetLabel: label,
      subjectUserId: id,
      meta: { step: "d1", removed, total: keys.length },
      status: "partial",
    });
    throw error;
  }
  if (!results[results.length - 1].meta.changes) {
    // Đã bị yêu cầu thử lại khác xoá xong -> hoàn tất; còn lại là không đủ điều kiện.
    const left = await c.env.DB.prepare(TARGET_SELECT).bind(id).first<TargetRow>();
    if (left) throw forbidden();
  }
  return c.json({ ok: true, removedObjects: removed });
});
