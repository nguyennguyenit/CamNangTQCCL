// Chống bot cho khách ẩn danh: xác thực token Cloudflare Turnstile (siteverify) và băm IP cho bộ đếm.
// Chép từ worker/src/turnstile.ts + worker/src/ratelimit.ts (hashIp) — hai Worker là hai package riêng.
// Siteverify đã bảo đảm mỗi token chỉ dùng một lần; kiểm thêm `hostname` để token cấp cho site khác
// (cùng sitekey bị lộ) không dùng được ở đây.

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** true khi siteverify xác nhận token cho một trong các hostname của site. Lỗi mạng -> false. */
export async function verifyTurnstile(
  token: string,
  secret: string,
  ip: string,
  expectedHostnames: readonly string[],
  fetchImpl: typeof fetch,
): Promise<boolean> {
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  try {
    const resp = await fetchImpl(SITEVERIFY, { method: "POST", body: form });
    const data = (await resp.json()) as { success?: boolean; hostname?: string };
    return data.success === true && typeof data.hostname === "string" && expectedHostnames.includes(data.hostname);
  } catch {
    return false;
  }
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
