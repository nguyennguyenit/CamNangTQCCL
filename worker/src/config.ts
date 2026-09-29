// Cấu hình mặc định + đọc env. Số liệu cap là placeholder, chốt theo quota thực
// (L2). Nhà cung cấp AI không nằm ở env: admin nhập ở /quan-tri/, lưu mã hoá trong KV `ai:providers`
// (xem shared/ai-config.ts).

export interface Env {
  // Secrets (wrangler secret put) — KHÔNG commit.
  TURNSTILE_SECRET: string;
  // Khoá HMAC băm IP cho bộ đếm per-IP; thiếu/rỗng -> Worker trả 503 (fail-closed).
  IP_HASH_SECRET?: string;
  // Khoá giải mã danh sách nhà cung cấp AI; PHẢI trùng giá trị ở community-worker. Thiếu -> 503.
  AI_CONFIG_SECRET?: string;
  // KV (rate-limit + đếm cap); chỉ ĐỌC bản ghi `ai:providers` do community-worker ghi.
  RL: KVNamespace;
  // Vars (wrangler.toml) — có thể override.
  // Các origin exact của site, phân cách dấu phẩy (vd "https://tqccl.com,https://www.tqccl.com").
  // Thiếu/rỗng -> danh sách rỗng: /analyze trả 503 (fail-closed). "*" chỉ dùng khi dev.
  ALLOWED_ORIGINS?: string;
  FEATURE_ENABLED?: string; // "false" -> kill-switch tắt feature
  RL_PER_HOUR?: string;
  DAILY_CAP?: string;
  MONTHLY_CAP?: string;
  MAX_IMAGE_BYTES?: string;
}

export interface Config {
  /** Origin exact được phép; `"*"` = dev (mọi origin, không kiểm hostname Turnstile). */
  allowedOrigins: string[] | "*";
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

export function parseAllowedOrigins(value: string | undefined): string[] | "*" {
  const raw = (value ?? "").trim();
  if (raw === "*") return "*";
  return raw.split(",").map((origin) => origin.trim()).filter(Boolean);
}

export function loadConfig(env: Env): Config {
  return {
    allowedOrigins: parseAllowedOrigins(env.ALLOWED_ORIGINS),
    featureEnabled: (env.FEATURE_ENABLED ?? "true") !== "false",
    rlPerHour: num(env.RL_PER_HOUR, 10), // placeholder (L2)
    dailyCap: num(env.DAILY_CAP, 500), // placeholder (L2)
    monthlyCap: num(env.MONTHLY_CAP, 8000), // placeholder — kill-switch khi chạm (H5)
    maxImageBytes: num(env.MAX_IMAGE_BYTES, 1_500_000), // ≤1.5MB sau giải mã (H4)
  };
}
