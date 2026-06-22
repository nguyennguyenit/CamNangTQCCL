// Verify Cloudflare Turnstile token (siteverify) + chống replay tuần tự.
// LƯU Ý: Cloudflare siteverify đã enforce token single-use server-side — đó là
// lớp chống replay THẬT. Lớp KV ở đây chỉ là phụ trợ (chặn replay tuần tự đã thấy);
// KHÔNG atomic nên 2 request song song cùng token vẫn lọt qua check (siteverify
// của Cloudflare mới là chốt chặn).

export interface TurnstileResult {
  ok: boolean;
  message?: string;
}

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Hash full token -> key KV (tránh đụng độ prefix khi slice). */
async function tokenKey(token: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return "ts:" + [...new Uint8Array(buf)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyTurnstile(
  token: unknown,
  secret: string,
  ip: string,
  kv: KVNamespace,
  fetchImpl: typeof fetch = fetch,
): Promise<TurnstileResult> {
  if (typeof token !== "string" || !token.trim()) {
    return { ok: false, message: "Thiếu xác thực chống bot" };
  }
  // Chống replay tuần tự: token đã dùng -> từ chối.
  const seenKey = await tokenKey(token);
  if (await kv.get(seenKey)) {
    return { ok: false, message: "Token xác thực đã dùng" };
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
  if (!data?.success) {
    return { ok: false, message: "Xác thực chống bot thất bại" };
  }
  // Đánh dấu token đã dùng (TTL ngắn, đủ qua cửa sổ idempotency).
  await kv.put(seenKey, "1", { expirationTtl: 300 });
  return { ok: true };
}
