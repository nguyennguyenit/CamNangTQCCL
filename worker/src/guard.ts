// Input guard (H4) — KHÔNG tin client. Validate ảnh base64: kích thước thật sau
// giải mã, magic bytes (chỉ cho PNG/JPEG/WebP), tách data URI. CORS + OPTIONS.

const MAGIC: Array<{ mime: string; test: (b: Uint8Array) => boolean }> = [
  { mime: "image/png", test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/webp", test: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 },
];

export interface GuardOk {
  ok: true;
  mime: string;
  dataUri: string;
}
export interface GuardErr {
  ok: false;
  status: number;
  message: string;
}

/** Giải mã base64 (bỏ tiền tố data URI nếu có) -> bytes. */
function decodeBase64(input: string): Uint8Array {
  const comma = input.indexOf(",");
  const b64 = input.startsWith("data:") && comma !== -1 ? input.slice(comma + 1) : input;
  const bin = atob(b64.trim());
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Validate ảnh từ chuỗi base64/data-URI người dùng gửi.
 * @param image chuỗi base64 hoặc data:image/*;base64,...
 * @param maxBytes giới hạn byte sau giải mã (H4)
 */
export function validateImage(image: unknown, maxBytes: number): GuardOk | GuardErr {
  if (typeof image !== "string" || !image.trim()) {
    return { ok: false, status: 400, message: "Thiếu ảnh" };
  }
  // Chặn sớm theo độ dài chuỗi base64 (~4/3 byte) trước khi giải mã.
  if (image.length > maxBytes * 1.4 + 100) {
    return { ok: false, status: 413, message: "Ảnh quá lớn" };
  }
  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(image);
  } catch {
    return { ok: false, status: 400, message: "Base64 không hợp lệ" };
  }
  if (bytes.length > maxBytes) {
    return { ok: false, status: 413, message: "Ảnh quá lớn" };
  }
  if (bytes.length < 64) {
    return { ok: false, status: 400, message: "Ảnh quá nhỏ / hỏng" };
  }
  const match = MAGIC.find((m) => m.test(bytes));
  if (!match) {
    return { ok: false, status: 415, message: "Chỉ nhận ảnh PNG/JPEG/WebP" };
  }
  return { ok: true, mime: match.mime, dataUri: `data:${match.mime};base64,${toBase64(bytes)}` };
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/** Header CORS giới hạn theo origin site. */
export function corsHeaders(allowedOrigin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/** Phản hồi OPTIONS preflight (H4). */
export function preflight(allowedOrigin: string): Response {
  return new Response(null, { status: 204, headers: corsHeaders(allowedOrigin) });
}
