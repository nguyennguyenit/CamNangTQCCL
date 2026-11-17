// Ngôn ngữ của trang do `<html lang>` quyết định. Mỗi locale trong `SITE_LOCALES` là một bản tách rời: bản Việt ở gốc `/`,
// các bản khác dưới tiền tố `/<mã>/`; mỗi chuỗi hiển thị chọn đúng một ngôn ngữ, không ghép song ngữ.
// Đây là nguồn duy nhất của danh sách locale: Astro (`src/lib/locale-routes.ts`), sitemap, verifier và trình duyệt cùng đọc.

/**
 * Danh sách locale theo thứ tự cố định. `L()`/`pick()` chọn biến thể theo **vị trí** trong danh sách này nên chỉ được
 * nối thêm ở cuối (test `tests-js/i18n-locales.test.mjs` khóa thứ tự); locale đầu tiên là mặc định.
 */
export const SITE_LOCALES = Object.freeze(/** @type {const} */ (['vi', 'zh']));
/** @typedef {(typeof SITE_LOCALES)[number]} SiteLocaleCode Một phần tử của `SITE_LOCALES`. */
/** Tên cũ của `SITE_LOCALES`, giữ cho import hiện có. */
export const LOCALES = SITE_LOCALES;
export const DEFAULT_LOCALE = SITE_LOCALES[0];

// Các bảng theo locale dưới đây có thể khai trước locale chưa bật (chưa nằm trong `SITE_LOCALES`): mọi hàm chỉ duyệt
// `SITE_LOCALES` nên bản ghi thừa không đổi output; bật locale chỉ còn là nối mã vào cuối `SITE_LOCALES`.

/** Tiền tố đường dẫn của từng locale (bản mặc định không có tiền tố). */
export const LOCALE_PREFIX = Object.freeze({ vi: '', zh: '/zh', ja: '/ja' });
/** Giá trị `<html lang>`/`hreflang`/thuộc tính `lang` của từng locale. */
export const LOCALE_HTML_LANG = Object.freeze({ vi: 'vi', zh: 'zh-Hans', ja: 'ja' });
/** Mã locale cho `Intl` (định dạng số, ngày). */
export const LOCALE_INTL = Object.freeze({ vi: 'vi-VN', zh: 'zh-CN', ja: 'ja-JP' });
/** Giá trị `og:locale`. */
export const LOCALE_OG = Object.freeze({ vi: 'vi_VN', zh: 'zh_CN', ja: 'ja_JP' });
/** Tên ngôn ngữ viết bằng chính ngôn ngữ đó (nhãn nút chuyển ngôn ngữ, ô chọn ngôn ngữ). */
export const LOCALE_LABEL = Object.freeze({ vi: 'Tiếng Việt', zh: '中文', ja: '日本語' });

/**
 * `value` có đúng là một mã trong `SITE_LOCALES` không (dữ liệu từ ngoài: bài viết, đội cộng đồng).
 * @param {unknown} value
 * @returns {value is (typeof SITE_LOCALES)[number]}
 */
export function isSiteLocale(value) {
  return typeof value === 'string' && SITE_LOCALES.includes(value);
}

/**
 * Chuẩn hoá mã ngôn ngữ bất kỳ (`zh-Hans`, `vi-VN`, `zh_CN`…) về một phần tử của `SITE_LOCALES`; không khớp → mặc định.
 * @param {unknown} value
 * @returns {SiteLocaleCode}
 */
export function normalizeLocale(value) {
  const primary = String(value || '').toLowerCase().split(/[-_]/)[0];
  return isSiteLocale(primary) ? primary : DEFAULT_LOCALE;
}

/** Thuộc tính `lang` của một nội dung viết bằng `locale` (mã lạ → bản mặc định). */
export function htmlLang(locale) {
  return LOCALE_HTML_LANG[normalizeLocale(locale)];
}

/**
 * Trang ở `locale` có hiện nội dung chỉ có chữ Việt (lớp dịch Việt của dữ liệu, ghi chú chỉ có bản Việt) không:
 * chỉ bản Việt hiện; mọi bản khác dùng chữ nguồn và bỏ phần chỉ có chữ Việt.
 */
export function contentLocaleIsVietnamese(locale) {
  return normalizeLocale(locale) === DEFAULT_LOCALE;
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

/**
 * Chọn biến thể theo ngôn ngữ chỉ định: `pick(locale, vi, zh, …)`, biến thể thứ i ứng với `SITE_LOCALES[i]`.
 * Thiếu biến thể cho locale đang dùng thì ném lỗi (build dựng mọi trang của mọi locale nên lỗi lộ ngay); biến thể
 * thừa ở cuối được bỏ qua để chuỗi của locale sắp thêm có thể viết trước khi bật locale đó.
 */
export function pick(locale, ...variants) {
  const resolved = normalizeLocale(locale);
  const index = SITE_LOCALES.indexOf(resolved);
  if (index >= variants.length) {
    throw new Error(`pick: thiếu biến thể cho locale "${resolved}" (nhận ${variants.length}, cần ${SITE_LOCALES.length})`);
  }
  return variants[index];
}

/** Chọn biến thể theo ngôn ngữ trang hiện tại: `L(vi, zh, …)`. */
export function L(...variants) {
  return pick(currentLocale(), ...variants);
}

/** Locale có tiền tố của `path` (`/zh`, `/zh/...` → `zh`); không có → `null`. */
function prefixedLocale(path) {
  for (const locale of SITE_LOCALES) {
    const prefix = LOCALE_PREFIX[locale];
    if (prefix && (path === prefix || path.startsWith(`${prefix}/`))) return locale;
  }
  return null;
}

/** Bỏ tiền tố locale khỏi pathname; trả về pathname gốc tiếng Việt. */
export function stripLocale(pathname) {
  const path = String(pathname || '/');
  const locale = prefixedLocale(path);
  if (locale === null) return path;
  const prefix = LOCALE_PREFIX[locale];
  return path === prefix ? '/' : path.slice(prefix.length);
}

/**
 * Ngôn ngữ suy từ pathname (`/zh/...` → `zh`).
 * @param {string | null | undefined} pathname
 * @returns {SiteLocaleCode}
 */
export function localeFromPath(pathname) {
  return prefixedLocale(String(pathname || '/')) ?? DEFAULT_LOCALE;
}

/**
 * Đường dẫn nội bộ theo ngôn ngữ. Chỉ nhận đường tuyệt đối cùng site (`/...`);
 * URL ngoài, `#hash`, `?query` đứng riêng được trả nguyên.
 */
export function localePath(path, locale = currentLocale()) {
  const value = String(path ?? '/');
  if (!value.startsWith('/') || value.startsWith('//')) return value;
  const base = stripLocale(value);
  const prefix = LOCALE_PREFIX[normalizeLocale(locale)];
  if (!prefix) return base;
  return base === '/' ? `${prefix}/` : `${prefix}${base}`;
}

/** Định dạng số theo ngôn ngữ trang. */
export function formatNumber(value, locale = currentLocale()) {
  return new Intl.NumberFormat(LOCALE_INTL[normalizeLocale(locale)]).format(value);
}

/** Định dạng ngày theo ngôn ngữ trang. */
export function formatDate(value, locale = currentLocale(), options = { dateStyle: 'medium' }) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(LOCALE_INTL[normalizeLocale(locale)], options).format(date);
}
