// Rate-limit IP + daily cap + monthly cap/kill-switch (H5). Dùng KV làm counter.
// Mọi hàm nhận KVNamespace (mock được trong test). Reset theo mốc UTC.

export interface LimitResult {
  allowed: boolean;
  status?: number;
  message?: string;
}

/** Tăng counter KV theo key, đặt TTL khi tạo mới. Trả giá trị sau khi tăng. */
async function incr(kv: KVNamespace, key: string, ttlSeconds: number): Promise<number> {
  const cur = parseInt((await kv.get(key)) || "0", 10) || 0;
  const next = cur + 1;
  await kv.put(key, String(next), { expirationTtl: ttlSeconds });
  return next;
}

/** Đọc counter (không tăng). */
async function read(kv: KVNamespace, key: string): Promise<number> {
  return parseInt((await kv.get(key)) || "0", 10) || 0;
}

/** Mốc thời gian UTC dạng YYYY-MM-DD và YYYY-MM (truyền vào để test tất định). */
export function timeKeys(now: Date): { day: string; month: string; hourBucket: string } {
  const iso = now.toISOString();
  return {
    day: iso.slice(0, 10), // 2026-06-22
    month: iso.slice(0, 7), // 2026-06
    hourBucket: iso.slice(0, 13), // 2026-06-22T19 (cửa sổ giờ)
  };
}

/**
 * Kiểm tra cap + tăng counter PER-IP (trước Turnstile). Thứ tự (rẻ -> đắt):
 *   kill-switch -> monthly -> daily -> per-IP/giờ.
 *
 * [H2] CHỈ tăng per-IP ở đây (để chặn spam pre-auth mà vẫn throttle theo IP).
 * Counter global daily/monthly tăng SAU khi Turnstile pass qua `commitGlobalUsage`,
 * tránh traffic chưa xác thực đốt quota toàn cục (DoS).
 *
 * [H1] Counter KV KHÔNG atomic (read-then-incr, eventual consistency) → cap là
 * BEST-EFFORT, không phải giới hạn cứng. Burst song song có thể vượt nhẹ. Backstop
 * thật chống bill: KHÔNG gắn thẻ thanh toán + đặt MONTHLY_CAP có headroom (xem README).
 */
export async function checkLimits(
  kv: KVNamespace,
  ipHash: string,
  now: Date,
  cfg: { featureEnabled: boolean; rlPerHour: number; dailyCap: number; monthlyCap: number },
): Promise<LimitResult> {
  if (!cfg.featureEnabled) {
    return { allowed: false, status: 503, message: "Tính năng đang tắt" };
  }
  const { day, month, hourBucket } = timeKeys(now);

  if ((await read(kv, `m:${month}`)) >= cfg.monthlyCap) {
    return { allowed: false, status: 503, message: "Đã đạt giới hạn tháng, tạm dừng" };
  }
  if ((await read(kv, `d:${day}`)) >= cfg.dailyCap) {
    return { allowed: false, status: 429, message: "Hết lượt hôm nay" };
  }
  if ((await read(kv, `h:${hourBucket}:${ipHash}`)) >= cfg.rlPerHour) {
    return { allowed: false, status: 429, message: "Bạn thử quá nhiều lần, đợi chút" };
  }

  // Tăng per-IP ngay (TTL ~2h) — throttle theo IP kể cả khi Turnstile fail sau đó.
  await incr(kv, `h:${hourBucket}:${ipHash}`, 7200);
  return { allowed: true };
}

/**
 * Tăng counter global daily + monthly. Gọi SAU khi Turnstile pass + ngay trước
 * khi gọi model (đếm lần thực sự tốn tiền). [H2]
 */
export async function commitGlobalUsage(kv: KVNamespace, now: Date): Promise<void> {
  const { day, month } = timeKeys(now);
  await incr(kv, `d:${day}`, 172800); // ~2 ngày
  await incr(kv, `m:${month}`, 3456000); // ~40 ngày
}

/** Hash IP (SHA-256, hex 16 ký tự đầu) — không lưu IP thô. */
export async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip || "unknown");
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
}
