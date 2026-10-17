// Đọc nhật ký quản trị: chỉ root, mới nhất trước, phân trang theo (created_at, id).

import { Hono } from "hono";
import { PAGE_SIZE, requireRoot, type AppEnv } from "../context";
import { ApiError, decodeCursor, iso, paginate } from "../http";

export interface AuditRow {
  id: string;
  actor_id: string;
  actor_role: string;
  actor_label: string;
  action: string;
  target_type: string;
  target_id: string | null;
  target_label: string | null;
  subject_user_id: string | null;
  reason: string | null;
  meta: string | null;
  status: string;
  created_at: number;
}

export function toAuditItem(r: AuditRow) {
  return {
    id: r.id,
    actor: { id: r.actor_id, role: r.actor_role, label: r.actor_label },
    action: r.action,
    target: { type: r.target_type, id: r.target_id, label: r.target_label },
    subjectUserId: r.subject_user_id,
    reason: r.reason,
    meta: r.meta ? (JSON.parse(r.meta) as unknown) : null,
    status: r.status,
    createdAt: iso(r.created_at),
  };
}

const ACTION_RE = /^[a-z_]+(\.[a-z_]+){0,3}$/u;

export const audit = new Hono<AppEnv>();

audit.get("/api/admin/audit", async (c) => {
  await requireRoot(c);
  const where: string[] = [];
  const binds: unknown[] = [];
  const action = c.req.query("action");
  if (action) {
    if (action.length > 40 || !ACTION_RE.test(action)) throw new ApiError(400, "invalid_action", "action không hợp lệ");
    where.push("action = ?");
    binds.push(action);
  }
  const cursor = decodeCursor(c.req.query("cursor"));
  if (cursor) {
    where.push("(created_at < ? or (created_at = ? and id < ?))");
    binds.push(cursor.t, cursor.t, cursor.id);
  }
  const clause = where.length ? ` where ${where.join(" and ")}` : "";
  const { results } = await c.env.DB.prepare(`select * from admin_audit${clause} order by created_at desc, id desc limit ?`)
    .bind(...binds, PAGE_SIZE + 1)
    .all<AuditRow>();
  const { rows, nextCursor } = paginate(results, PAGE_SIZE);
  return c.json({ items: rows.map(toAuditItem), nextCursor });
});
