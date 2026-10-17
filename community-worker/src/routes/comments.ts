// Bình luận trang chi tiết đội: liệt kê theo (pageKey, lang), đăng, xoá; admin xem mới nhất toàn site.

import { Hono } from "hono";
import { currentUser, effectiveRole, PAGE_SIZE, requireStaff, requireUser, type AppEnv, type Role } from "../context";
import { auditIfStmt } from "../audit";
import { adminEmails, isAdminEmail, type Env } from "../env";
import { ApiError, decodeCursor, iso, paginate } from "../http";
import { visibleUserSql } from "../moderation";
import { consumeRateLimit } from "../ratelimit";
import { parseLang, parsePageKey, parseText, readJson } from "../validate";

interface CommentRow {
  id: string;
  page_key: string;
  lang: string;
  user_id: string;
  body: string;
  created_at: number;
  author_name: string;
  author_image: string | null;
  author_role: string | null;
  author_email: string;
}

const SELECT =
  'select c.id, c.page_key, c.lang, c.user_id, c.body, c.created_at, u.name as author_name, u.image as author_image, ' +
  'u.role as author_role, u.email as author_email ' +
  'from comments c join "user" u on u.id = c.user_id';
const BEFORE_CURSOR = "(c.created_at < ? or (c.created_at = ? and c.id < ?))";
const ORDER = " order by c.created_at desc, c.id desc limit ?";

/** Chủ bình luận; root; KDV chỉ với tác giả là user thường (không phải KDV, không thuộc ADMIN_EMAILS). */
function mayDelete(env: Env, viewer: { id: string; role: Role } | null, row: CommentRow): boolean {
  if (!viewer) return false;
  if (row.user_id === viewer.id || viewer.role === "root") return true;
  return viewer.role === "moderator" && row.author_role !== "moderator" && !isAdminEmail(env, row.author_email);
}

function toComment(row: CommentRow, canDelete: boolean) {
  return {
    id: row.id,
    body: row.body,
    lang: row.lang,
    createdAt: iso(row.created_at),
    author: { id: row.user_id, name: row.author_name, image: row.author_image },
    canDelete,
  };
}

export const comments = new Hono<AppEnv>();

comments.get("/api/comments", async (c) => {
  const page = parsePageKey(c.req.query("page"));
  const lang = parseLang(c.req.query("lang"));
  const cursor = decodeCursor(c.req.query("cursor"));
  // Chỉ route công khai ẩn bình luận của user bị khoá/đang xoá; /api/admin/comments không lọc.
  const where = ["c.page_key = ?", "c.lang = ?", visibleUserSql("u")];
  const binds: unknown[] = [page, lang, c.get("deps").now()];
  if (cursor) {
    where.push(BEFORE_CURSOR);
    binds.push(cursor.t, cursor.t, cursor.id);
  }
  const { results } = await c.env.DB.prepare(`${SELECT} where ${where.join(" and ")}${ORDER}`)
    .bind(...binds, PAGE_SIZE + 1)
    .all<CommentRow>();
  const { rows, nextCursor } = paginate(results, PAGE_SIZE);
  const user = await currentUser(c);
  const viewer = user ? { id: user.id, role: effectiveRole(c.env, user) } : null;
  return c.json({ items: rows.map((r) => toComment(r, mayDelete(c.env, viewer, r))), nextCursor });
});

comments.post("/api/comments", async (c) => {
  const { user } = await requireUser(c);
  const input = await readJson(c.req.raw);
  const page = parsePageKey(input.page);
  const lang = parseLang(input.lang);
  const body = parseText(input.body, "body", 1, 2000);
  const { now, newId } = c.get("deps");
  const createdAt = now();
  await consumeRateLimit(c.env.DB, "comment", user.id, createdAt);
  const id = newId();
  await c.env.DB.prepare("insert into comments (id, page_key, lang, user_id, body, created_at) values (?, ?, ?, ?, ?, ?)")
    .bind(id, page, lang, user.id, body, createdAt)
    .run();
  const row: CommentRow = {
    id,
    page_key: page,
    lang,
    user_id: user.id,
    body,
    created_at: createdAt,
    author_name: user.name,
    author_image: user.image,
    author_role: user.role,
    author_email: user.email,
  };
  return c.json(toComment(row, true), 201);
});

comments.delete("/api/comments/:id", async (c) => {
  const viewer = await requireUser(c);
  const { user, role } = viewer;
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(`${SELECT} where c.id = ?`).bind(id).first<CommentRow>();
  if (!row) throw new ApiError(404, "not_found", "Không tìm thấy bình luận");
  const forbidden = new ApiError(403, "forbidden", "Không có quyền xoá bình luận này");
  if (!mayDelete(c.env, { id: user.id, role }, row)) throw forbidden;
  // KDV xoá bình luận của người khác: điều kiện tác giả (không phải KDV, email không thuộc ADMIN_EMAILS) nằm
  // trong DELETE để việc nâng vai trò/đổi email giữa lúc đọc và ghi không làm xoá nhầm.
  const viaModerator = role === "moderator" && row.user_id !== user.id;
  const admins = [...adminEmails(c.env)];
  const notRoot = admins.length ? ` and lower(trim(u.email)) not in (${admins.map(() => "?").join(", ")})` : "";
  const guard = viaModerator
    ? ` and exists (select 1 from "user" u where u.id = comments.user_id and coalesce(u.role, 'user') <> 'moderator'${notRoot})`
    : "";
  const guardBinds = viaModerator ? admins : [];
  const del = c.env.DB.prepare(`delete from comments where id = ?${guard}`).bind(id, ...guardBinds);
  // Chủ tự xoá không phải thao tác quản trị. Staff xoá bình luận của người khác: dòng nhật ký đặt TRƯỚC DELETE trong
  // cùng batch với đúng điều kiện đủ quyền của DELETE (sau DELETE không còn gì để chứng minh yêu cầu này đã xoá).
  const byStaff = role !== "user" && row.user_id !== user.id;
  const res = byStaff
    ? (
        await c.env.DB.batch([
          auditIfStmt(
            c,
            viewer,
            { action: "comment.delete", targetType: "comment", targetId: id, targetLabel: row.page_key, subjectUserId: row.user_id, status: "ok" },
            `select 1 from comments where id = ?${guard}`,
            [id, ...guardBinds],
          ),
          del,
        ])
      )[1]
    : await del.run();
  if (viaModerator && res.meta.changes === 0) throw forbidden;
  return c.json({ ok: true });
});

// Admin: bình luận mới nhất toàn site (kèm page) để kiểm duyệt/xoá.
comments.get("/api/admin/comments", async (c) => {
  const { user, role } = await requireStaff(c);
  const cursor = decodeCursor(c.req.query("cursor"));
  const stmt = cursor
    ? c.env.DB.prepare(`${SELECT} where ${BEFORE_CURSOR}${ORDER}`).bind(cursor.t, cursor.t, cursor.id, PAGE_SIZE + 1)
    : c.env.DB.prepare(`${SELECT}${ORDER}`).bind(PAGE_SIZE + 1);
  const { results } = await stmt.all<CommentRow>();
  const { rows, nextCursor } = paginate(results, PAGE_SIZE);
  return c.json({ items: rows.map((r) => ({ ...toComment(r, mayDelete(c.env, { id: user.id, role }, r)), page: r.page_key })), nextCursor });
});
