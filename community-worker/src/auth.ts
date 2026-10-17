// Better Auth (Google) trên D1 — dựng instance theo từng request từ env.
// Request tới qua proxy same-origin của Pages; baseURL = origin site trình duyệt đang dùng (trong allowlist)
// để callback OAuth và cookie phiên quay về đúng domain (tqccl.com, www.tqccl.com, tqccl.pages.dev).

import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { siteOrigin, trustedOrigins, type Env } from "./env";
import { BAN_NOTICE_TTL_MS, isBlocked, signBanNotice } from "./moderation";

export function createAuth(env: Env, origin = siteOrigin(env)) {
  return betterAuth({
    appName: "Cẩm Nang TQCCL",
    baseURL: origin,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    // Better Auth nhận D1Database trực tiếp (dialect D1 dựng sẵn trong kysely-adapter).
    database: env.DB,
    trustedOrigins: trustedOrigins(env),
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID || "",
        clientSecret: env.GOOGLE_CLIENT_SECRET || "",
        prompt: "select_account",
      },
    },
    // Trường mới của 0006; input:false để client không tự đặt khi đăng ký/cập nhật.
    user: {
      additionalFields: {
        role: { type: "string", defaultValue: "user", input: false },
        banned_until: { type: "number", required: false, input: false },
        ban_reason: { type: "string", required: false, input: false },
        deleting_at: { type: "number", required: false, input: false },
        last_seen_at: { type: "number", required: false, input: false },
      },
    },
    databaseHooks: {
      session: {
        create: {
          // Không tạo phiên cho tài khoản bị khoá/đang xoá. Lý do khoá không đi qua URL: chỉ token HMAC ngắn hạn
          // để client gọi GET /api/ban-notice. Trigger session_block_blocked_user đóng nốt khe race.
          before: async (session) => {
            const row = await env.DB.prepare('select banned_until, deleting_at from "user" where id = ?')
              .bind(session.userId)
              .first<{ banned_until: number | null; deleting_at: number | null }>();
            if (!row) return;
            const now = Date.now();
            if (!isBlocked({ bannedUntil: row.banned_until, deletingAt: row.deleting_at }, now)) return;
            const token = await signBanNotice(env.BETTER_AUTH_SECRET, { userId: session.userId, exp: now + BAN_NOTICE_TTL_MS });
            throw new APIError("FORBIDDEN", {
              code: row.deleting_at !== null ? "ACCOUNT_UNAVAILABLE" : "ACCOUNT_BANNED",
              message: token,
            });
          },
        },
      },
    },
    // Chỉ đăng nhập Google; không bật email/password.
    emailAndPassword: { enabled: false },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/social": { window: 60, max: 10 },
        "/callback/*": { window: 60, max: 20 },
      },
    },
    advanced: {
      useSecureCookies: origin.startsWith("https://"),
      // Pages Function chuyển tiếp nguyên header gốc, gồm cf-connecting-ip của client.
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
  });
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: "user" | "moderator";
  lastSeenAt: number | null;
}

/** Dòng thô của user đang đăng nhập; quyết định khoá nằm ở toSessionUser. */
export interface SessionUserRow {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string | null;
  banned_until: number | null;
  deleting_at: number | null;
  last_seen_at: number | null;
}

/** Đọc phiên từ cookie; không có/hết hạn -> null. Trả dòng thô, không quyết định khoá. */
export async function getSessionUser(env: Env, headers: Headers): Promise<SessionUserRow | null> {
  const session = await createAuth(env).api.getSession({ headers });
  if (!session) return null;
  const u = session.user as typeof session.user & Partial<Omit<SessionUserRow, "id" | "name" | "email" | "image">>;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image ?? null,
    role: u.role ?? null,
    banned_until: u.banned_until ?? null,
    deleting_at: u.deleting_at ?? null,
    last_seen_at: u.last_seen_at ?? null,
  };
}

/** Chỗ duy nhất quyết định khoá: null khi bị khoá còn hạn hoặc đang xoá. */
export function toSessionUser(row: SessionUserRow | null, now: number): SessionUser | null {
  if (!row) return null;
  if (isBlocked({ bannedUntil: row.banned_until, deletingAt: row.deleting_at }, now)) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    image: row.image,
    role: row.role === "moderator" ? "moderator" : "user",
    lastSeenAt: row.last_seen_at,
  };
}
