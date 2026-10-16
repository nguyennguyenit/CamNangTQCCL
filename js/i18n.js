// Ngôn ngữ của trang do `<html lang>` quyết định. Bản tiếng Việt (gốc `/`) và bản tiếng Trung
// (tiền tố `/zh/`) là hai bản tách rời: mỗi chuỗi hiển thị chọn đúng một ngôn ngữ, không ghép song ngữ.

export const LOCALES = Object.freeze(['vi', 'zh']);
export const DEFAULT_LOCALE = 'vi';
export const ZH_PREFIX = '/zh';

/** Chuẩn hoá mã ngôn ngữ bất kỳ (`zh-Hans`, `vi-VN`…) về `vi` | `zh`. */
export function normalizeLocale(value) {
  return String(value || '').toLowerCase().startsWith('zh') ? 'zh' : DEFAULT_LOCALE;
}

/** Ngôn ngữ đang được ép tạm bởi `withLocale` (dựng cây view cho một locale tường minh); `null` khi không ép. */
let scopedLocale = null;

/** Ngôn ngữ trang hiện tại; ngoài trình duyệt (Node test, build) mặc định `vi` trừ khi đang trong `withLocale`. */
export function currentLocale(doc = globalThis.document) {
  if (scopedLocale !== null && doc === globalThis.document) return scopedLocale;
  return normalizeLocale(doc?.documentElement?.lang);
}

/**
 * Chạy `run` đồng bộ với ngôn ngữ trang là `locale` (không cần `document`): builder cây view dùng `L()` /
 * `currentLocale()` nên cần biết ngôn ngữ khi dựng HTML lúc build. `locale` rỗng thì chạy nguyên trạng.
 */
export function withLocale(locale, run) {
  if (locale === undefined || locale === null) return run();
  const previous = scopedLocale;
  scopedLocale = normalizeLocale(locale);
  try { return run(); } finally { scopedLocale = previous; }
}

/** Chọn chuỗi theo ngôn ngữ chỉ định. Dùng ở Astro (locale tường minh) và nơi cần locale cố định. */
export function pick(locale, vi, zh) {
  return normalizeLocale(locale) === 'zh' ? zh : vi;
}

/** Chọn chuỗi theo ngôn ngữ trang hiện tại. */
export function L(vi, zh) {
  return pick(currentLocale(), vi, zh);
}

/** Bỏ tiền tố `/zh` khỏi pathname; trả về pathname gốc tiếng Việt. */
export function stripLocale(pathname) {
  const path = String(pathname || '/');
  if (path === ZH_PREFIX) return '/';
  return path.startsWith(`${ZH_PREFIX}/`) ? path.slice(ZH_PREFIX.length) : path;
}

/** Ngôn ngữ suy từ pathname (`/zh/...` → `zh`). */
export function localeFromPath(pathname) {
  const path = String(pathname || '/');
  return path === ZH_PREFIX || path.startsWith(`${ZH_PREFIX}/`) ? 'zh' : DEFAULT_LOCALE;
}

/**
 * Đường dẫn nội bộ theo ngôn ngữ. Chỉ nhận đường tuyệt đối cùng site (`/...`);
 * URL ngoài, `#hash`, `?query` đứng riêng được trả nguyên.
 */
export function localePath(path, locale = currentLocale()) {
  const value = String(path ?? '/');
  if (!value.startsWith('/') || value.startsWith('//')) return value;
  const base = stripLocale(value);
  if (normalizeLocale(locale) !== 'zh') return base;
  return base === '/' ? `${ZH_PREFIX}/` : `${ZH_PREFIX}${base}`;
}

/** Định dạng số theo ngôn ngữ trang. */
export function formatNumber(value, locale = currentLocale()) {
  return new Intl.NumberFormat(pick(locale, 'vi-VN', 'zh-CN')).format(value);
}

/** Định dạng ngày theo ngôn ngữ trang. */
export function formatDate(value, locale = currentLocale(), options = { dateStyle: 'medium' }) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(pick(locale, 'vi-VN', 'zh-CN'), options).format(date);
}
