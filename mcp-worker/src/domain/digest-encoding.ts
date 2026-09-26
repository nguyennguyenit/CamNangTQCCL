/**
 * Mã hoá digest SHA-256 sang dạng an toàn với bộ lọc bí mật của client.
 *
 * Một số client MCP quét response và che mọi chuỗi hex dài (>= 64 ký tự) vì cho
 * rằng đó là credential. Chuỗi hex 64 ký tự của SHA-256 rơi đúng vào bẫy đó, nên
 * mọi giá trị client phải gửi lại cho server đều bị hỏng trước khi model nhìn
 * thấy. Base64url giữ trọn 256 bit trong 43 ký tự và không khớp mẫu hex, nên
 * sống sót qua bộ lọc.
 *
 * Chỉ dùng Web API (`btoa`): module này nằm trong closure import của
 * `src/worker.ts`, nơi mọi specifier `node:*` đều bị cấm.
 */

const HEX_DIGEST_PREFIX = "sha256:";
export const SCRUB_SAFE_DIGEST_PREFIX = "sha256b64:";

const HEX_BODY_PATTERN = /^[0-9a-fA-F]{64}$/u;

export type ScrubSafeDigest = `sha256b64:${string}`;

/** Chuyển `sha256:<64 hex>` thành `sha256b64:<43 base64url>`. */
export function toScrubSafeDigest(hexDigest: string): ScrubSafeDigest {
  if (!hexDigest.startsWith(HEX_DIGEST_PREFIX)) {
    throw new TypeError(`Digest must start with "${HEX_DIGEST_PREFIX}"`);
  }
  const body = hexDigest.slice(HEX_DIGEST_PREFIX.length);
  if (!HEX_BODY_PATTERN.test(body)) {
    throw new TypeError("Digest body must be exactly 64 hexadecimal characters");
  }

  let binary = "";
  for (let index = 0; index < body.length; index += 2) {
    binary += String.fromCharCode(Number.parseInt(body.slice(index, index + 2), 16));
  }
  // btoa sinh base64 chuẩn; đổi sang bảng chữ cái url-safe và bỏ padding.
  const base64url = btoa(binary)
    .replace(/\+/gu, "-")
    .replace(/\//gu, "_")
    .replace(/=+$/u, "");
  return `${SCRUB_SAFE_DIGEST_PREFIX}${base64url}`;
}
