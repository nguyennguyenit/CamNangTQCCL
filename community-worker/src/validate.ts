// Kiểm tra đầu vào chặt: pageKey, lang, slug, chuỗi, mảng tướng, ảnh (magic bytes).

import { ApiError } from "./http";

/** Đội cộng đồng không ép uuid (id harness dạng `id-0001`): đội có tồn tại hay không do DB quyết. */
export const PAGE_KEY_RE =
  /^\/(?:(?:doi-chuan|doi-khac|khai-hoang)\/[a-z0-9][a-z0-9-]{0,120}|doi-cong-dong\/[a-z0-9][a-z0-9-]{0,63})\/$/u;
const COMMUNITY_TEAM_PAGE_RE = /^\/doi-cong-dong\/([a-z0-9][a-z0-9-]{0,63})\/$/u;
export const ID_RE = {
  hero: /^hero:[a-z0-9]+(?:-[a-z0-9]+)*$/u,
  tactic: /^tactic:[a-z0-9]+(?:-[a-z0-9]+)*$/u,
  book: /^book:[a-z0-9]+(?:-[a-z0-9]+)*$/u,
} as const;
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,100}$/u;
export const LANGS = ["vi", "zh"] as const;
export type Lang = (typeof LANGS)[number];
export const REPORT_RESULTS = ["win", "loss", "draw"] as const;
export type ReportResult = (typeof REPORT_RESULTS)[number];
export const MAX_HEROES = 5;
export const MAX_HERO_CHARS = 20;

const bad = (code: string, message: string) => new ApiError(400, code, message);

export function parsePageKey(value: unknown): string {
  if (typeof value !== "string" || !PAGE_KEY_RE.test(value)) {
    throw bad("invalid_page", "pageKey không hợp lệ");
  }
  return value;
}

/** Id đội cộng đồng của một page key `/doi-cong-dong/<id>/`; page khác -> null. */
export function communityTeamIdFromPage(page: string): string | null {
  return COMMUNITY_TEAM_PAGE_RE.exec(page)?.[1] ?? null;
}

/** ID dạng `hero:<slug>` / `tactic:<slug>` / `book:<slug>`; lỗi `invalid_<field>`. */
export function parseId(value: unknown, kind: keyof typeof ID_RE, field: string): string {
  if (typeof value !== "string" || value.length > 120 || !ID_RE[kind].test(value)) {
    throw bad(`invalid_${field}`, `${field} phải là ID ${kind}:<slug>`);
  }
  return value;
}

export function parseLang(value: unknown): Lang {
  if (value !== "vi" && value !== "zh") throw bad("invalid_lang", "lang phải là vi hoặc zh");
  return value;
}

export function parseSlug(value: unknown): string {
  if (typeof value !== "string" || !SLUG_RE.test(value)) throw bad("invalid_slug", "slug không hợp lệ");
  return value;
}

/** Chuỗi bắt buộc đã trim, độ dài [min, max] tính theo code point. */
export function parseText(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== "string") throw bad(`invalid_${field}`, `${field} phải là chuỗi`);
  const text = value.trim();
  const len = Array.from(text).length;
  if (len < min || len > max) throw bad(`invalid_${field}`, `${field} phải dài ${min}–${max} ký tự`);
  return text;
}

/** Chuỗi tuỳ chọn: undefined/null/"" -> null. */
export function parseOptionalText(value: unknown, field: string, max: number): string | null {
  if (value == null || (typeof value === "string" && value.trim() === "")) return null;
  return parseText(value, field, 1, max);
}

/** Mảng tướng: minItems–5 phần tử, mỗi tên 1–20 ký tự, không trùng. */
export function parseHeroes(value: unknown, field: string, minItems: number): string[] {
  if (!Array.isArray(value) || value.length < minItems || value.length > MAX_HEROES) {
    throw bad(`invalid_${field}`, `${field} phải có ${minItems}–${MAX_HEROES} tướng`);
  }
  const heroes = value.map((h) => parseText(h, field, 1, MAX_HERO_CHARS));
  if (new Set(heroes).size !== heroes.length) throw bad(`invalid_${field}`, `${field} có tướng trùng`);
  return heroes;
}

export function parseResult(value: unknown): ReportResult {
  if (!REPORT_RESULTS.includes(value as ReportResult)) {
    throw bad("invalid_result", "result phải là win, loss hoặc draw");
  }
  return value as ReportResult;
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const type = req.headers.get("content-type") || "";
  if (!type.toLowerCase().startsWith("application/json")) {
    throw new ApiError(415, "unsupported_media_type", "Cần Content-Type application/json");
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw bad("invalid_json", "JSON không hợp lệ");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw bad("invalid_json", "Body phải là object JSON");
  return body as Record<string, unknown>;
}

// ---- Ảnh ----

export const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Nhận diện định dạng từ magic bytes; không khớp JPEG/PNG/WebP -> null. */
export function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((b, i) => bytes[i] === b)) return "image/png";
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

export interface ValidImage {
  bytes: Uint8Array;
  contentType: string;
  ext: string;
}

/** Lấy File từ multipart, kiểm MIME khai báo == magic bytes và kích thước. */
export async function parseImageUpload(req: Request, field: string, maxBytes: number): Promise<ValidImage> {
  const declaredLength = Number(req.headers.get("content-length") || "0");
  // Chừa 64KB cho phần bao multipart.
  if (declaredLength > maxBytes + 65_536) throw new ApiError(413, "image_too_large", "Ảnh quá lớn");
  const type = (req.headers.get("content-type") || "").toLowerCase();
  if (!type.startsWith("multipart/form-data")) {
    throw new ApiError(415, "unsupported_media_type", "Cần multipart/form-data");
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw bad("invalid_form", "Form không hợp lệ");
  }
  const file = form.get(field);
  if (!file || typeof file === "string") throw bad("missing_image", "Thiếu ảnh");
  if (file.size === 0) throw bad("missing_image", "Ảnh rỗng");
  if (file.size > maxBytes) throw new ApiError(413, "image_too_large", "Ảnh quá lớn");
  const declared = (file.type || "").toLowerCase();
  if (!(declared in IMAGE_TYPES)) throw new ApiError(415, "invalid_image_type", "Chỉ nhận JPEG, PNG hoặc WebP");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffImageType(bytes);
  if (sniffed !== declared) throw new ApiError(415, "invalid_image_type", "Nội dung ảnh không khớp định dạng");
  return { bytes, contentType: sniffed, ext: IMAGE_TYPES[sniffed] };
}
