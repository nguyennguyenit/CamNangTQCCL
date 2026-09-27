// Góp ý / báo lỗi từ nút ở footer: ai cũng gửi được (khách ẩn danh qua Turnstile + giới hạn theo IP),
// lưu D1 rồi gửi thư báo tới hộp thư quản trị (Reply-To = email người gửi). Admin xem và đánh dấu đã xử lý.

import { Hono } from "hono";
import { currentUser, PAGE_SIZE, requireAdmin, type AppEnv } from "../context";
import { siteOrigin, siteOrigins, type Env } from "../env";
import { ApiError, decodeCursor, iso, paginate } from "../http";
import { consumeRateLimit } from "../ratelimit";
import { hashIp, verifyTurnstile } from "../turnstile";
import { parseLang, parseOptionalText, parseText, readJson, type Lang } from "../validate";

export const FEEDBACK_KINDS = ["feature", "bug", "wrong_info", "other"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
const FEEDBACK_STATUSES = ["new", "done"] as const;
type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const TITLE_MAX = 120;
export const BODY_MAX = 4000;
const EMAIL_MAX = 254;
const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/u;
// Đường dẫn cùng site (không phải URL tuyệt đối hay `//host`), không khoảng trắng.
const PAGE_RE = /^\/(?!\/)\S{0,299}$/u;

const KIND_LABEL: Record<FeedbackKind, string> = {
  feature: "Đề xuất tính năng",
  bug: "Báo cáo lỗi",
  wrong_info: "Thông tin sai",
  other: "Khác",
};

interface FeedbackRow {
  id: string;
  kind: FeedbackKind;
  title: string;
  body: string;
  email: string | null;
  page: string | null;
  lang: Lang;
  user_id: string | null;
  status: FeedbackStatus;
  created_at: number;
  author_name: string | null;
}

const SELECT =
  "select f.id, f.kind, f.title, f.body, f.email, f.page, f.lang, f.user_id, f.status, f.created_at, u.name as author_name " +
  'from feedback f left join "user" u on u.id = f.user_id';
const BEFORE_CURSOR = "(f.created_at < ? or (f.created_at = ? and f.id < ?))";
const ORDER = " order by f.created_at desc, f.id desc limit ?";

function parseKind(value: unknown): FeedbackKind {
  if (!FEEDBACK_KINDS.includes(value as FeedbackKind)) throw new ApiError(400, "invalid_kind", "Loại góp ý không hợp lệ");
  return value as FeedbackKind;
}

function parseStatus(value: unknown): FeedbackStatus {
  if (!FEEDBACK_STATUSES.includes(value as FeedbackStatus)) throw new ApiError(400, "invalid_status", "Trạng thái không hợp lệ");
  return value as FeedbackStatus;
}

export const feedback = new Hono<AppEnv>();

feedback.post("/api/feedback", async (c) => {
  const input = await readJson(c.req.raw);
  const kind = parseKind(input.kind);
  // Tiêu đề một dòng: gộp mọi khoảng trắng (kể cả xuống dòng) để dùng thẳng làm tiêu đề thư.
  const title = parseText(input.title, "title", 1, TITLE_MAX).replace(/\s+/gu, " ");
  const body = parseText(input.body, "body", 1, BODY_MAX);
  const email = parseOptionalText(input.email, "email", EMAIL_MAX);
  if (email !== null && !EMAIL_RE.test(email)) throw new ApiError(400, "invalid_email", "Email không hợp lệ");
  const page = parseOptionalText(input.page, "page", 300);
  if (page !== null && !PAGE_RE.test(page)) throw new ApiError(400, "invalid_page", "Trang không hợp lệ");
  const lang = parseLang(input.lang);

  const { now, newId, fetchImpl } = c.get("deps");
  const createdAt = now();
  const user = await currentUser(c);
  if (user) {
    await consumeRateLimit(c.env.DB, "feedback_user", user.id, createdAt);
  } else {
    const { TURNSTILE_SECRET: secret, IP_HASH_SECRET: ipSecret } = c.env;
    if (!secret || !ipSecret) throw new ApiError(503, "feedback_unavailable", "Chưa cấu hình chống bot cho góp ý");
    const token = typeof input.turnstileToken === "string" ? input.turnstileToken.trim() : "";
    if (!token) throw new ApiError(403, "turnstile_required", "Thiếu xác thực chống bot");
    const ip = c.req.header("cf-connecting-ip") || "";
    // Đếm trước siteverify: bot bị chặn không tốn thêm lượt gọi Turnstile.
    await consumeRateLimit(c.env.DB, "feedback_anon", `ip:${await hashIp(ip, ipSecret)}`, createdAt);
    const hostnames = siteOrigins(c.env).map((origin) => new URL(origin).hostname);
    if (!(await verifyTurnstile(token, secret, ip, hostnames, fetchImpl))) {
      throw new ApiError(403, "turnstile_failed", "Xác thực chống bot thất bại");
    }
  }

  const row: FeedbackRow = {
    id: newId(),
    kind,
    title,
    body,
    email,
    page,
    lang,
    user_id: user?.id ?? null,
    status: "new",
    created_at: createdAt,
    author_name: user?.name ?? null,
  };
  await c.env.DB.prepare(
    "insert into feedback (id, kind, title, body, email, page, lang, user_id, status, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(row.id, kind, title, body, email, page, lang, row.user_id, row.status, createdAt)
    .run();
  // Góp ý đã lưu là đủ: thư gửi nền, lỗi thư chỉ ghi log (admin vẫn thấy trong /quan-tri).
  c.executionCtx.waitUntil(sendFeedbackMail(c.env, row, user?.email ?? null));
  return c.json({ ok: true }, 201);
});

async function sendFeedbackMail(env: Env, row: FeedbackRow, accountEmail: string | null): Promise<void> {
  if (!env.FEEDBACK_MAIL || !env.FEEDBACK_FROM || !env.FEEDBACK_TO) {
    console.error("feedback mail not configured", row.id);
    return;
  }
  const origin = siteOrigin(env);
  const sender = row.author_name ? `${row.author_name} <${accountEmail}> (đã đăng nhập)` : "Ẩn danh";
  const text = [
    `Loại: ${KIND_LABEL[row.kind]}`,
    `Trang: ${row.page ? origin + row.page : "(không rõ)"} (${row.lang})`,
    `Người gửi: ${sender}`,
    `Email trả lời: ${row.email ?? "(không để lại)"}`,
    `Thời gian: ${new Date(row.created_at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`,
    `Quản trị: ${origin}/quan-tri/`,
    "",
    row.title,
    "",
    row.body,
  ].join("\n");
  try {
    await env.FEEDBACK_MAIL.send({
      from: { email: env.FEEDBACK_FROM, name: "TQCCL Góp ý" },
      to: env.FEEDBACK_TO,
      ...(row.email ? { replyTo: row.email } : {}),
      subject: `[TQCCL][${KIND_LABEL[row.kind]}] ${row.title}`,
      text,
    });
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    console.error("feedback mail failed", row.id, code, error);
  }
}

// Admin: góp ý mới nhất, lọc tuỳ chọn theo trạng thái và loại.
feedback.get("/api/admin/feedback", async (c) => {
  await requireAdmin(c);
  const where: string[] = [];
  const binds: unknown[] = [];
  const status = c.req.query("status");
  if (status) {
    where.push("f.status = ?");
    binds.push(parseStatus(status));
  }
  const kind = c.req.query("kind");
  if (kind) {
    where.push("f.kind = ?");
    binds.push(parseKind(kind));
  }
  const cursor = decodeCursor(c.req.query("cursor"));
  if (cursor) {
    where.push(BEFORE_CURSOR);
    binds.push(cursor.t, cursor.t, cursor.id);
  }
  const clause = where.length ? ` where ${where.join(" and ")}` : "";
  const { results } = await c.env.DB.prepare(`${SELECT}${clause}${ORDER}`)
    .bind(...binds, PAGE_SIZE + 1)
    .all<FeedbackRow>();
  const { rows, nextCursor } = paginate(results, PAGE_SIZE);
  return c.json({
    items: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      body: r.body,
      email: r.email,
      page: r.page,
      lang: r.lang,
      status: r.status,
      createdAt: iso(r.created_at),
      author: r.user_id && r.author_name ? { id: r.user_id, name: r.author_name } : null,
    })),
    nextCursor,
  });
});

feedback.post("/api/admin/feedback/:id/status", async (c) => {
  await requireAdmin(c);
  const status = parseStatus((await readJson(c.req.raw)).status);
  const id = c.req.param("id");
  const { meta } = await c.env.DB.prepare("update feedback set status = ? where id = ?").bind(status, id).run();
  if (!meta.changes) throw new ApiError(404, "not_found", "Không tìm thấy góp ý");
  return c.json({ id, status });
});
