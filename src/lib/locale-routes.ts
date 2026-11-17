/**
 * Route theo locale. Mọi route bản Việt có bản gương cùng đường dẫn dưới tiền tố của từng locale khác
 * (Landing, 8 trang mục, 3 họ trang chi tiết, Chiến báo, Quản trị); blog chỉ ghép khi bài có `translationKey` chung.
 * Layout, sitemap và verifier dùng chung các hàm này nên hreflang khớp nhau. Danh sách locale và các bảng theo locale
 * nằm ở `js/i18n.js` (nguồn duy nhất, trình duyệt cũng đọc); file này chỉ re-export và thêm phần riêng của route.
 */
import {
  DEFAULT_LOCALE,
  LOCALE_HTML_LANG,
  LOCALE_LABEL as LOCALE_LABEL_TABLE,
  LOCALE_PREFIX,
  SITE_LOCALES as LOCALE_LIST,
  localePath,
  stripLocale,
} from '../../js/i18n.js';

/** Một phần tử của `SITE_LOCALES`; suy từ danh sách nên thêm locale ở `js/i18n.js` là đủ. */
export type SiteLocale = (typeof LOCALE_LIST)[number];

export const SITE_LOCALES: readonly SiteLocale[] = LOCALE_LIST;

/** Giá trị `hreflang`/`<html lang>` của từng ngôn ngữ; `x-default` trỏ bản Việt. */
export const HREFLANG: Readonly<Record<SiteLocale, string>> = LOCALE_HTML_LANG;

/** Nhãn nút chuyển ngôn ngữ: mỗi nhãn viết bằng chính ngôn ngữ đích. */
export const LOCALE_LABEL: Readonly<Record<SiteLocale, string>> = LOCALE_LABEL_TABLE;

/** Trang cộng đồng tĩnh (noindex): vẫn có bản ở mọi locale nhưng không vào sitemap. */
export const COMMUNITY_PATHS = Object.freeze(['/chien-bao/', '/doi-cua-toi/', '/quan-tri/']);

/** Các locale đích của nút chuyển ngôn ngữ trên trang `locale`: mọi locale còn lại, theo thứ tự danh sách. */
export const switchTargets = (locale: SiteLocale): SiteLocale[] => SITE_LOCALES.filter((other) => other !== locale);

/** Tệp HTML của một route trong dist theo ngôn ngữ (`doi-chuan/x/index.html` → `zh/doi-chuan/x/index.html`). */
export const localizedHtmlPath = (htmlPath: string, locale: SiteLocale): string => {
  const prefix: string = LOCALE_PREFIX[locale];
  return prefix ? `${prefix.slice(1)}/${htmlPath}` : htmlPath;
};

export interface AlternateLink {
  hreflang: string;
  path: string;
}

/** Đường dẫn của một route có bản gương ở mọi locale, tính từ pathname bất kỳ ngôn ngữ nào. */
export function mirroredPaths(pathname: string): Record<SiteLocale, string> {
  const base = stripLocale(pathname);
  return Object.fromEntries(SITE_LOCALES.map((locale) => [locale, localePath(base, locale)])) as Record<SiteLocale, string>;
}

/**
 * Bộ hreflang của một nhóm trang cùng nội dung: một link cho mỗi locale có đường dẫn (theo thứ tự danh sách) và
 * `x-default` = bản đầu tiên có mặt (bản Việt khi có).
 */
export function alternatePaths(pathsByLocale: Partial<Record<SiteLocale, string>>): AlternateLink[] {
  const present = SITE_LOCALES.filter((locale) => typeof pathsByLocale[locale] === 'string');
  if (present.length === 0) return [];
  const fallback = present.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : present[0];
  return [
    ...present.map((locale) => ({ hreflang: HREFLANG[locale], path: pathsByLocale[locale] as string })),
    { hreflang: 'x-default', path: pathsByLocale[fallback] as string },
  ];
}

/** Hreflang của một route có bản gương: tính từ pathname bất kỳ ngôn ngữ nào của nhóm. */
export function mirroredAlternates(pathname: string): AlternateLink[] {
  return alternatePaths(mirroredPaths(pathname));
}
