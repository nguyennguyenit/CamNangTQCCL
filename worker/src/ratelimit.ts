// Rate-limit IP + daily cap + monthly cap/kill-switch (H5). Dùng KV làm counter.
// Mọi hàm nhận KVNamespace (mock được trong test). Reset theo mốc UTC.

export interface LimitResult {
  allowed: boolean;
  status?: number;
  message?: string;
}

/**
 * Tăng counter KV theo key, đặt TTL khi tạo mới. Best-effort: lỗi đọc coi như 0,
 * lỗi ghi (vd KV 429 vượt hạn mức ghi) bị bỏ qua để request vẫn được phục vụ.
 */
async function incr(kv: KVNamespace, key: string, ttlSeconds: number): Promise<void> {
  const next = (await read(kv, key)) + 1;
  try {
    await kv.put(key, String(next), { expirationTtl: ttlSeconds });
  } catch {
    // Counter là best-effort (H1): mất một lần đếm tốt hơn trả lỗi cho người dùng.
  }
}

/** Đọc counter (không tăng); lỗi đọc KV coi như 0. */
async function read(kv: KVNamespace, key: string): Promise<number> {
  try {
    return parseInt((await kv.get(key)) || "0", 10) || 0;
  } catch {
    return 0;
  }
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

/**
 * Khoá bucket của IP: IPv4 giữ nguyên địa chỉ, IPv6 gom theo /64 (4 nhóm đầu) vì
 * một thuê bao thường được cấp cả dải /64.
 */
function ipBucket(ip: string): string {
  const address = ip.trim().toLowerCase().split("%", 1)[0];
  if (!address.includes(":")) return address || "unknown";
  // IPv4 nhúng (vd `::ffff:1.2.3.4`) chiếm 2 nhóm cuối, luôn nằm ngoài /64.
  const split = (part: string) => (part ? part.split(":") : []).flatMap((group) => (group.includes(".") ? ["0", "0"] : [group]));
  const [head, tail] = address.split("::", 2);
  const headGroups = split(head);
  const tailGroups = tail === undefined ? [] : split(tail);
  const zeros = tail === undefined ? 0 : Math.max(0, 8 - headGroups.length - tailGroups.length);
  const groups = [...headGroups, ...Array<string>(zeros).fill("0"), ...tailGroups];
  return groups.slice(0, 4).map((group) => (parseInt(group, 16) || 0).toString(16)).join(":") + "::/64";
}

/** HMAC-SHA256(secret, bucket IP), hex 16 byte đầu — không lưu IP thô hay hash trần đoán ngược được. */
export async function hashIp(ip: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(ipBucket(ip)));
  return [...new Uint8Array(signature)].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}
