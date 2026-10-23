/**
 * Cặp route Việt ↔ Trung. Mọi route bản Việt có bản Trung cùng đường dẫn dưới tiền tố `/zh`
 * (Landing, 8 trang mục, 3 họ trang chi tiết, Chiến báo, Quản trị); blog chỉ ghép cặp khi bài có
 * `translationKey` chung. Layout, sitemap và verifier dùng chung các hàm này nên hreflang khớp nhau.
 */
import { localePath, stripLocale } from '../../js/i18n.js';

export type SiteLocale = 'vi' | 'zh';

export const SITE_LOCALES: readonly SiteLocale[] = Object.freeze(['vi', 'zh']);

/** Giá trị `hreflang`/`<html lang>` của từng ngôn ngữ; `x-default` luôn trỏ bản Việt. */
export const HREFLANG: Readonly<Record<SiteLocale, string>> = Object.freeze({ vi: 'vi', zh: 'zh-Hans' });

/** Nhãn nút chuyển ngôn ngữ: mỗi nhãn viết bằng chính ngôn ngữ đích. */
export const LOCALE_LABEL: Readonly<Record<SiteLocale, string>> = Object.freeze({ vi: 'Tiếng Việt', zh: '中文' });

/** Trang cộng đồng tĩnh (noindex): vẫn có bản Trung nhưng không vào sitemap. */
export const COMMUNITY_PATHS = Object.freeze(['/chien-bao/', '/doi-cua-toi/', '/quan-tri/']);

export const otherLocale = (locale: SiteLocale): SiteLocale => (locale === 'zh' ? 'vi' : 'zh');

/** Tệp HTML của một route trong dist theo ngôn ngữ (`doi-chuan/x/index.html` → `zh/doi-chuan/x/index.html`). */
export const localizedHtmlPath = (htmlPath: string, locale: SiteLocale) => (locale === 'zh' ? `zh/${htmlPath}` : htmlPath);

export interface AlternateLink {
  hreflang: string;
  path: string;
}

/** Bộ hreflang của một cặp trang: vi, zh-Hans và x-default (= bản Việt). */
export function alternatePaths(viPath: string, zhPath: string): AlternateLink[] {
  return [
    { hreflang: HREFLANG.vi, path: viPath },
    { hreflang: HREFLANG.zh, path: zhPath },
    { hreflang: 'x-default', path: viPath },
  ];
}

/** Hreflang của một route có bản gương: tính từ pathname bất kỳ ngôn ngữ nào của cặp. */
export function mirroredAlternates(pathname: string): AlternateLink[] {
  const base = stripLocale(pathname);
  return alternatePaths(localePath(base, 'vi'), localePath(base, 'zh'));
}
