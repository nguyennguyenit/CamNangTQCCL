// Input guard (H4) — KHÔNG tin client. Validate ảnh base64: kích thước sau giải mã
// (tính từ độ dài), magic bytes (chỉ PNG/JPEG/WebP), tách data URI. CORS + OPTIONS.

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

/** Base64 chuẩn (có padding) như `canvas.toDataURL` tạo; độ dài còn phải chia hết cho 4. */
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

/** Phần base64 của input (bỏ tiền tố data URI nếu có). */
function base64Part(input: string): string {
  const comma = input.indexOf(",");
  return (input.startsWith("data:") && comma !== -1 ? input.slice(comma + 1) : input).trim();
}

/** Giải mã chỉ `count` byte đầu (count chia hết cho 3) để đọc magic bytes. */
function decodeHead(b64: string, count: number): Uint8Array {
  const bin = atob(b64.slice(0, (count / 3) * 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Validate ảnh từ chuỗi base64/data-URI người dùng gửi. Không giải mã toàn ảnh:
 * kiểm ký tự bằng regex, tính kích thước từ độ dài + padding, chỉ giải mã phần đầu
 * cho magic bytes; `dataUri` dựng lại từ chính chuỗi base64 đã kiểm.
 * @param image chuỗi base64 hoặc data:image/*;base64,...
 * @param maxBytes giới hạn byte sau giải mã (H4)
 */
export function validateImage(image: unknown, maxBytes: number): GuardOk | GuardErr {
  if (typeof image !== "string" || !image.trim()) {
    return { ok: false, status: 400, message: "Thiếu ảnh" };
  }
  // Chặn sớm theo độ dài chuỗi base64 (~4/3 byte) trước khi kiểm ký tự.
  if (image.length > maxBytes * 1.4 + 100) {
    return { ok: false, status: 413, message: "Ảnh quá lớn" };
  }
  const b64 = base64Part(image);
  if (b64.length % 4 !== 0 || !BASE64.test(b64)) {
    return { ok: false, status: 400, message: "Base64 không hợp lệ" };
  }
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  const byteLength = (b64.length / 4) * 3 - padding;
  if (byteLength > maxBytes) {
    return { ok: false, status: 413, message: "Ảnh quá lớn" };
  }
  if (byteLength < 64) {
    return { ok: false, status: 400, message: "Ảnh quá nhỏ / hỏng" };
  }
  const head = decodeHead(b64, 12);
  const match = MAGIC.find((m) => m.test(head));
  if (!match) {
    return { ok: false, status: 415, message: "Chỉ nhận ảnh PNG/JPEG/WebP" };
  }
  return { ok: true, mime: match.mime, dataUri: `data:${match.mime};base64,${b64}` };
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
