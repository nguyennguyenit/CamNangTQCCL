// Rate limit theo user, lưu D1, cửa sổ cố định. Lượt vượt ngưỡng vẫn được đếm
// (không mở khoá sớm) nhưng bị từ chối với 429.

import { ApiError } from "./http";

export interface RateRule {
  limit: number;
  windowMs: number;
}

const HOUR = 3_600_000;
const DAY = 86_400_000;

export const RATE_RULES: Record<string, RateRule> = {
  comment: { limit: 10, windowMs: HOUR },
  analyze: { limit: 20, windowMs: DAY },
  report: { limit: 30, windowMs: DAY },
  upload: { limit: 100, windowMs: DAY },
  // Góp ý: khách ẩn danh đếm theo IP đã băm, người đăng nhập theo user.
  feedback_anon: { limit: 5, windowMs: HOUR },
  feedback_user: { limit: 10, windowMs: HOUR },
};

/** Tăng bộ đếm; vượt ngưỡng -> ApiError 429 kèm retryAfter (giây). */
export async function consumeRateLimit(db: D1Database, action: string, userId: string, now: number): Promise<void> {
  const rule = RATE_RULES[action];
  const windowStart = Math.floor(now / rule.windowMs) * rule.windowMs;
  const expiresAt = windowStart + rule.windowMs;
  const row = await db
    .prepare(
      "insert into rate_limits (key, count, expires_at) values (?, 1, ?) " +
        "on conflict (key) do update set count = count + 1 returning count",
    )
    .bind(`${action}:${userId}:${windowStart}`, expiresAt)
    .first<{ count: number }>();
  if ((row?.count ?? 0) > rule.limit) {
    const retryAfter = Math.max(1, Math.ceil((expiresAt - now) / 1000));
    throw new ApiError(429, "rate_limited", "Bạn thao tác quá nhanh, thử lại sau", retryAfter);
  }
}
