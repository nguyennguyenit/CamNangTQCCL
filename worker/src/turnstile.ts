// Verify Cloudflare Turnstile token qua siteverify. Siteverify đã bảo đảm mỗi token
// chỉ dùng được một lần (lần sau trả `timeout-or-duplicate`), nên Worker không giữ
// thêm lớp replay trong KV. Kiểm cả `hostname` để token cấp cho site khác (cùng
// sitekey bị lộ) không dùng được ở đây.

export interface TurnstileResult {
  ok: boolean;
  message?: string;
}

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * @param expectedHostnames hostname site được phép (host của từng origin trong
 *   `ALLOWED_ORIGINS`); `null` khi cấu hình là `*` (dev) thì chỉ dựa vào `success`.
 */
export async function verifyTurnstile(
  token: unknown,
  secret: string,
  ip: string,
  expectedHostnames: readonly string[] | null,
  fetchImpl: typeof fetch = fetch,
): Promise<TurnstileResult> {
  if (typeof token !== "string" || !token.trim()) {
    return { ok: false, message: "Thiếu xác thực chống bot" };
  }

  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);

  let data: any;
  try {
    const resp = await fetchImpl(SITEVERIFY, { method: "POST", body: form });
    data = await resp.json();
  } catch {
    return { ok: false, message: "Lỗi xác thực, thử lại" };
  }
  if (!data?.success || (expectedHostnames !== null && !expectedHostnames.includes(data.hostname))) {
    return { ok: false, message: "Xác thực chống bot thất bại" };
  }
  return { ok: true };
}
