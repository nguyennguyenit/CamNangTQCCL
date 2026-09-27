// Binding + biến môi trường của Worker cộng đồng và cách đọc cấu hình.

export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  // Vars (wrangler.jsonc).
  // Một hoặc nhiều origin site, phân tách dấu phẩy; origin đầu tiên là mặc định.
  SITE_ORIGIN?: string;
  ADMIN_EMAILS?: string;
  REGION?: string;
  MODEL_ID?: string;
  MODEL_ENDPOINT?: string;
  FEATURE_ENABLED?: string;
  // Secrets (wrangler secret put) — KHÔNG commit.
  BETTER_AUTH_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  QWEN_API_KEY?: string;
  // Token GitHub fine-grained (Actions: write trên đúng repo) để kích hoạt workflow build lại site.
  GITHUB_DISPATCH_TOKEN?: string;
  // Var: "owner/repo" nhận repository_dispatch.
  GITHUB_REPOSITORY?: string;
}

export const DEFAULT_SITE_ORIGIN = "https://tqccl.pages.dev";

// Origin dev cục bộ (astro dev 4321, astro preview 4322, wrangler dev 8788).
export const DEV_ORIGINS = [
  "http://localhost:4321",
  "http://127.0.0.1:4321",
  "http://localhost:4322",
  "http://127.0.0.1:4322",
  "http://localhost:8788",
  "http://127.0.0.1:8788",
];

/** Mọi origin site khai trong SITE_ORIGIN (vd tqccl.com, www.tqccl.com, tqccl.pages.dev). */
export function siteOrigins(env: Env): string[] {
  const list = (env.SITE_ORIGIN || DEFAULT_SITE_ORIGIN)
    .split(",")
    .map((value) => value.trim().replace(/\/+$/u, ""))
    .filter(Boolean);
  return list.length ? list : [DEFAULT_SITE_ORIGIN];
}

export function siteOrigin(env: Env): string {
  return siteOrigins(env)[0];
}

export function trustedOrigins(env: Env): string[] {
  return Array.from(new Set([...siteOrigins(env), ...DEV_ORIGINS]));
}

/**
 * Origin site trình duyệt đang dùng. Proxy origin-fallback gắn X-Forwarded-Host/Proto; service binding
 * giữ nguyên URL gốc. Chỉ nhận origin trong allowlist, còn lại rơi về origin mặc định.
 */
export function requestOrigin(env: Env, request: Request): string {
  const host = request.headers.get("x-forwarded-host");
  const proto = request.headers.get("x-forwarded-proto") === "http" ? "http" : "https";
  const candidate = host ? `${proto}://${host}` : new URL(request.url).origin;
  return trustedOrigins(env).includes(candidate) ? candidate : siteOrigin(env);
}

export function adminEmails(env: Env): Set<string> {
  return new Set(
    (env.ADMIN_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdminEmail(env: Env, email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails(env).has(email.trim().toLowerCase());
}

// Endpoint OpenAI-compatible của DashScope theo region (giống worker/src/config.ts).
export const REGION_ENDPOINT: Record<string, string> = {
  intl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
  cn: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
};

export function resolveModelEndpoint(env: Env): string {
  if (env.MODEL_ENDPOINT) return env.MODEL_ENDPOINT;
  const region = (env.REGION || "intl").toLowerCase();
  return REGION_ENDPOINT[region] || REGION_ENDPOINT.intl;
}
