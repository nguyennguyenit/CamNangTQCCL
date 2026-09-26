// Cấu hình mặc định + đọc env. Số liệu cap là placeholder, chốt theo free tier
// thực (L2). Provider mặc định: Qwen Alibaba DashScope OpenAI-compatible.

export interface Env {
  // Secrets (wrangler secret put) — KHÔNG commit.
  QWEN_API_KEY: string;
  TURNSTILE_SECRET: string;
  // Khoá HMAC băm IP cho bộ đếm per-IP; thiếu/rỗng -> Worker trả 503 (fail-closed).
  IP_HASH_SECRET?: string;
  // KV (rate-limit + đếm cap).
  RL: KVNamespace;
  // Vars (wrangler.toml) — có thể override.
  ALLOWED_ORIGIN?: string; // origin site, vd https://tqccl.pages.dev
  REGION?: string; // "intl" (Singapore, mặc định) | "cn" (mainland)
  MODEL_ENDPOINT?: string; // set để override hẳn endpoint (ưu tiên hơn REGION)
  MODEL_ID?: string;
  FEATURE_ENABLED?: string; // "false" -> kill-switch tắt feature
  RL_PER_HOUR?: string;
  DAILY_CAP?: string;
  MONTHLY_CAP?: string;
  MAX_IMAGE_BYTES?: string;
}

export interface Config {
  allowedOrigin: string;
  modelEndpoint: string;
  modelId: string;
  featureEnabled: boolean;
  rlPerHour: number;
  dailyCap: number;
  monthlyCap: number;
  maxImageBytes: number;
}

const num = (v: string | undefined, dflt: number): number => {
  const n = v != null ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : dflt;
};

// Endpoint OpenAI-compatible theo region (hỗ trợ cả 2 — chọn bằng REGION).
export const REGION_ENDPOINT: Record<string, string> = {
  intl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions", // Singapore (free tier)
  cn: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", // mainland (rẻ hơn)
};

export function resolveEndpoint(env: Env): string {
  if (env.MODEL_ENDPOINT) return env.MODEL_ENDPOINT; // override hẳn
  const region = (env.REGION || "intl").toLowerCase();
  return REGION_ENDPOINT[region] || REGION_ENDPOINT.intl;
}

export function loadConfig(env: Env): Config {
  return {
    allowedOrigin: env.ALLOWED_ORIGIN || "*",
    // Qwen DashScope — region chọn qua REGION (intl mặc định: có free tier + data Singapore).
    modelEndpoint: resolveEndpoint(env),
    modelId: env.MODEL_ID || "qwen3.7-plus",
    featureEnabled: (env.FEATURE_ENABLED ?? "true") !== "false",
    rlPerHour: num(env.RL_PER_HOUR, 10), // placeholder (L2)
    dailyCap: num(env.DAILY_CAP, 500), // placeholder (L2)
    monthlyCap: num(env.MONTHLY_CAP, 8000), // placeholder — kill-switch khi chạm (H5)
    maxImageBytes: num(env.MAX_IMAGE_BYTES, 1_500_000), // ≤1.5MB sau giải mã (H4)
  };
}
