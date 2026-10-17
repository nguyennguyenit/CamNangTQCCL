// Nhật ký quản trị (admin_audit): dựng câu INSERT dùng chung cho batch D1 hoặc chạy riêng.
// Nhãn đã che email; meta chỉ gồm trường được chọn (không key/token/body thô).

import type { Ctx, Viewer } from "./context";
import { maskEmail } from "./moderation";

export type AuditStatus = "ok" | "partial" | "failed";

export interface AuditEntry {
  action: string;
  targetType: string;
  targetId: string | null;
  targetLabel?: string | null;
  /** Chủ nội dung (report/comment/feedback/scan_sample) hoặc user đích; null khi không có (vd góp ý ẩn danh, bài viết). */
  subjectUserId?: string | null;
  reason?: string | null;
  meta?: Record<string, unknown>;
  status: AuditStatus;
  /** Id đặt trước khi cần cập nhật đúng dòng này về sau (vd kết quả deploy). Mặc định deps.newId(). */
  id?: string;
}

const LABEL_MAX = 120;
const EMAIL_IN_TEXT = /[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+/gu;
const COLUMNS =
  "id, actor_id, actor_role, actor_label, action, target_type, target_id, target_label, subject_user_id, reason, meta, status, created_at";

/** Che mọi chuỗi giống email trong nhãn (tên/tiêu đề do người dùng nhập có thể chứa email) rồi cắt độ dài. */
export function sanitizeLabel(text: string | null | undefined, max = LABEL_MAX): string | null {
  if (text == null) return null;
  return [...text.replace(EMAIL_IN_TEXT, (email) => maskEmail(email))].slice(0, max).join("");
}

function rowValues(c: Ctx, viewer: Viewer, entry: AuditEntry): (string | number | null)[] {
  if (viewer.role === "user") throw new Error("admin_audit actor must be root or moderator");
  const { now, newId } = c.get("deps");
  return [
    entry.id ?? newId(),
    viewer.user.id,
    viewer.role,
    `${sanitizeLabel(viewer.user.name) ?? ""} <${maskEmail(viewer.user.email)}>`,
    entry.action,
    entry.targetType,
    entry.targetId,
    sanitizeLabel(entry.targetLabel),
    entry.subjectUserId ?? null,
    entry.reason ?? null,
    entry.meta ? JSON.stringify(entry.meta) : null,
    entry.status,
    now(),
  ];
}

const PLACEHOLDERS = Array.from({ length: 13 }, () => "?").join(", ");

/** INSERT vô điều kiện (cho batch D1 hoặc chạy riêng). */
export function auditStmt(c: Ctx, viewer: Viewer, entry: AuditEntry): D1PreparedStatement {
  return c.env.DB.prepare(`insert into admin_audit (${COLUMNS}) values (${PLACEHOLDERS})`).bind(...rowValues(c, viewer, entry));
}

/**
 * INSERT chỉ khi `existsSql` (kèm `binds`) có dòng: điều kiện phải chứng minh CHÍNH thao tác này đã xảy ra
 * (actor, mốc thời gian của yêu cầu, điều kiện đủ quyền), không chỉ là trạng thái đích đã tồn tại.
 * Đặt SAU câu ghi trong cùng batch; riêng thao tác XOÁ đặt TRƯỚC câu DELETE với đúng điều kiện đủ quyền đó.
 */
export function auditIfStmt(c: Ctx, viewer: Viewer, entry: AuditEntry, existsSql: string, binds: unknown[]): D1PreparedStatement {
  return c.env.DB
    .prepare(`insert into admin_audit (${COLUMNS}) select ${PLACEHOLDERS} where exists (${existsSql})`)
    .bind(...rowValues(c, viewer, entry), ...binds);
}

/** Ghi riêng một dòng (khi không có batch D1); lỗi D1 nổi lên cho caller. */
export async function writeAudit(c: Ctx, viewer: Viewer, entry: AuditEntry): Promise<void> {
  await auditStmt(c, viewer, entry).run();
}

/**
 * Ghi dòng failed/partial sau một lỗi khác: không để lỗi ghi nhật ký che lỗi gốc mà caller sắp ném lại.
 * Nếu D1 đang hỏng thì dòng có thể không ghi được (không thể đảm bảo bền sau khi R2/KV đã đổi); chỉ log.
 */
export async function writeAuditQuietly(c: Ctx, viewer: Viewer, entry: AuditEntry): Promise<void> {
  try {
    await writeAudit(c, viewer, entry);
  } catch (error) {
    console.error("admin_audit write failed", entry.action, entry.status, error);
  }
}

/** Cập nhật kết quả deploy cho đúng dòng đã ghi `meta.deploy = 'pending'`: lỗi -> partial. */
export async function settleDeploy(
  c: Ctx,
  auditId: string,
  meta: Record<string, unknown>,
  deploy: { ok: boolean; status: number | null },
): Promise<void> {
  const settled = deploy.ok ? { ...meta, deploy: "ok" } : { ...meta, deploy: { ok: false, status: deploy.status } };
  await c.env.DB.prepare("update admin_audit set status = ?, meta = ? where id = ?")
    .bind(deploy.ok ? "ok" : "partial", JSON.stringify(settled), auditId)
    .run();
}
