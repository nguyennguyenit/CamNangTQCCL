// Bình luận trang chi tiết đội: liệt kê theo (pageKey, lang), đăng, xoá; admin xem mới nhất toàn site.

import { Hono } from "hono";
import { currentUser, PAGE_SIZE, requireAdmin, requireUser, type AppEnv } from "../context";
import { isAdminEmail } from "../env";
import { ApiError, decodeCursor, iso, paginate } from "../http";
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
}

const SELECT =
  'select c.id, c.page_key, c.lang, c.user_id, c.body, c.created_at, u.name as author_name, u.image as author_image ' +
  'from comments c join "user" u on u.id = c.user_id';
const BEFORE_CURSOR = "(c.created_at < ? or (c.created_at = ? and c.id < ?))";
const ORDER = " order by c.created_at desc, c.id desc limit ?";

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
  const where = ["c.page_key = ?", "c.lang = ?"];
  const binds: unknown[] = [page, lang];
  if (cursor) {
    where.push(BEFORE_CURSOR);
    binds.push(cursor.t, cursor.t, cursor.id);
  }
  const { results } = await c.env.DB.prepare(`${SELECT} where ${where.join(" and ")}${ORDER}`)
    .bind(...binds, PAGE_SIZE + 1)
    .all<CommentRow>();
  const { rows, nextCursor } = paginate(results, PAGE_SIZE);
  const user = await currentUser(c);
  const admin = isAdminEmail(c.env, user?.email);
  return c.json({ items: rows.map((r) => toComment(r, admin || r.user_id === user?.id)), nextCursor });
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
  };
  return c.json(toComment(row, true), 201);
});

comments.delete("/api/comments/:id", async (c) => {
  const { user, isAdmin } = await requireUser(c);
  const id = c.req.param("id");
  const row = await c.env.DB.prepare("select user_id from comments where id = ?").bind(id).first<{ user_id: string }>();
  if (!row) throw new ApiError(404, "not_found", "Không tìm thấy bình luận");
  if (row.user_id !== user.id && !isAdmin) throw new ApiError(403, "forbidden", "Không có quyền xoá bình luận này");
  await c.env.DB.prepare("delete from comments where id = ?").bind(id).run();
  return c.json({ ok: true });
});

// Admin: bình luận mới nhất toàn site (kèm page) để kiểm duyệt/xoá.
comments.get("/api/admin/comments", async (c) => {
  await requireAdmin(c);
  const cursor = decodeCursor(c.req.query("cursor"));
  const stmt = cursor
    ? c.env.DB.prepare(`${SELECT} where ${BEFORE_CURSOR}${ORDER}`).bind(cursor.t, cursor.t, cursor.id, PAGE_SIZE + 1)
    : c.env.DB.prepare(`${SELECT}${ORDER}`).bind(PAGE_SIZE + 1);
  const { results } = await stmt.all<CommentRow>();
  const { rows, nextCursor } = paginate(results, PAGE_SIZE);
  return c.json({ items: rows.map((r) => ({ ...toComment(r, true), page: r.page_key })), nextCursor });
});
