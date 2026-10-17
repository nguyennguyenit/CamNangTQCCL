// Khoá/xoá tài khoản: điều kiện chặn dùng chung, che email, token thông báo khoá (HMAC).

export const PERMANENT_BAN_UNTIL = 8_640_000_000_000_000;

export const BAN_DURATIONS = {
  "1d": 86_400_000,
  "7d": 604_800_000,
  "30d": 2_592_000_000,
  permanent: null,
} as const;

export const BAN_NOTICE_TTL_MS = 600_000;

export interface BlockState {
  bannedUntil: number | null;
  deletingAt: number | null;
}

/** Bị chặn = còn hạn khoá (banned_until > now) hoặc đang xoá. Khớp điều kiện trong trigger 0006. */
export function isBlocked(state: BlockState, now: number): boolean {
  return (state.bannedUntil !== null && state.bannedUntil > now) || state.deletingAt !== null;
}

/** `ng***@gmail.com`; phần local ≤ 2 ký tự giữ 1 ký tự. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 0) return "***";
  const local = email.slice(0, at);
  const keep = local.length <= 2 ? 1 : 2;
  return `${local.slice(0, keep)}***${email.slice(at)}`;
}

/** Đoạn SQL lọc user hiển thị công khai; bind đúng một giá trị `now` (epoch ms). */
export function visibleUserSql(alias: string): string {
  return `(${alias}.banned_until is null or ${alias}.banned_until <= ?) and ${alias}.deleting_at is null`;
}

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/u.test(text)) return null;
  try {
    const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  } catch {
    return null;
  }
}

async function hmacKey(secret: string, usage: "sign" | "verify"): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [usage]);
}

/** Tiền tố miền cho HMAC: cùng BETTER_AUTH_SECRET với chữ ký cookie của Better Auth nhưng không dùng lẫn chữ ký. */
const BAN_NOTICE_DOMAIN = "ban-notice:v1.";

/** Token `base64url(userId).exp.sig` (userId mã hoá để không chứa dấu chấm). */
export async function signBanNotice(secret: string | undefined, payload: { userId: string; exp: number }): Promise<string> {
  const body = `${toBase64Url(encoder.encode(payload.userId))}.${payload.exp}`;
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret || "", "sign"), encoder.encode(BAN_NOTICE_DOMAIN + body));
  return `${body}.${toBase64Url(new Uint8Array(sig))}`;
}

/** Trả userId nếu token hợp lệ và chưa hết hạn; ngược lại null. */
export async function verifyBanNotice(secret: string | undefined, token: string, now: number): Promise<string | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [idPart, expPart, sigPart] = parts;
  const sig = fromBase64Url(sigPart);
  const idBytes = fromBase64Url(idPart);
  if (!sig || !idBytes || !/^\d+$/u.test(expPart)) return null;
  const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret || "", "verify"), sig, encoder.encode(`${BAN_NOTICE_DOMAIN}${idPart}.${expPart}`));
  if (!ok || Number(expPart) <= now) return null;
  return new TextDecoder().decode(idBytes);
}
