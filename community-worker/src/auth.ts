// Better Auth (Google) trên D1 — dựng instance theo từng request từ env.
// Request tới qua proxy same-origin của Pages; baseURL = origin site trình duyệt đang dùng (trong allowlist)
// để callback OAuth và cookie phiên quay về đúng domain (tqccl.com, www.tqccl.com, tqccl.pages.dev).

import { betterAuth } from "better-auth";
import { siteOrigin, trustedOrigins, type Env } from "./env";

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
}

/** Đọc phiên từ cookie; không có/hết hạn -> null. */
export async function getSessionUser(env: Env, headers: Headers): Promise<SessionUser | null> {
  const session = await createAuth(env).api.getSession({ headers });
  if (!session) return null;
  const { id, name, email, image } = session.user;
  return { id, name, email, image: image ?? null };
}
