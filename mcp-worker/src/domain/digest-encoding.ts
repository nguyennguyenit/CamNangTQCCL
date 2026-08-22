/**
 * Mã hoá digest SHA-256 sang dạng an toàn với bộ lọc bí mật của client.
 *
 * Một số client MCP quét response và che mọi chuỗi hex dài (>= 64 ký tự) vì cho
 * rằng đó là credential. Chuỗi hex 64 ký tự của SHA-256 rơi đúng vào bẫy đó, nên
 * mọi giá trị client phải gửi lại cho server đều bị hỏng trước khi model nhìn
 * thấy. Base64url giữ trọn 256 bit trong 43 ký tự và không khớp mẫu hex, nên
 * sống sót qua bộ lọc.
 *
 * Chỉ dùng Web API (`atob`/`btoa`): module này nằm trong closure import của
 * `src/worker.ts`, nơi mọi specifier `node:*` đều bị cấm.
 */

const HEX_DIGEST_PREFIX = "sha256:";
export const SCRUB_SAFE_DIGEST_PREFIX = "sha256b64:";

const DIGEST_BYTE_LENGTH = 32;
const HEX_BODY_PATTERN = /^[0-9a-fA-F]{64}$/u;
const BASE64URL_BODY_PATTERN = /^[A-Za-z0-9_-]{43}$/u;

export type HexDigest = `sha256:${string}`;
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

/** Nghịch đảo của {@link toScrubSafeDigest}; trả digest hex chữ thường. */
export function fromScrubSafeDigest(token: string): HexDigest {
  if (!token.startsWith(SCRUB_SAFE_DIGEST_PREFIX)) {
    throw new TypeError(`Token must start with "${SCRUB_SAFE_DIGEST_PREFIX}"`);
  }
  const body = token.slice(SCRUB_SAFE_DIGEST_PREFIX.length);
  if (!BASE64URL_BODY_PATTERN.test(body)) {
    throw new TypeError("Token body must be exactly 43 base64url characters");
  }

  // atob cần bảng chữ cái chuẩn và độ dài bội số 4; 43 ký tự cần đúng một "=".
  const binary = atob(`${body.replace(/-/gu, "+").replace(/_/gu, "/")}=`);
  if (binary.length !== DIGEST_BYTE_LENGTH) {
    throw new TypeError("Token must decode to exactly 32 bytes");
  }

  let hex = "";
  for (let index = 0; index < binary.length; index += 1) {
    hex += (binary.charCodeAt(index) & 0xff).toString(16).padStart(2, "0");
  }
  return `${HEX_DIGEST_PREFIX}${hex}`;
}
