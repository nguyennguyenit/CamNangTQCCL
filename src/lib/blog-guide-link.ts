/**
 * Khối "Trong cẩm nang" của trang bài viết chi tiết (artboard BaiVietDetail `.bvd-cta`): dẫn người đọc sang mục của
 * cẩm nang hợp với chủ đề bài. Chọn mục theo chủ đề (tag) của bài; số liệu tính lúc build từ dữ liệu đã publish
 * (`landingStatistics`), không hard-code. Không khớp chủ đề nào thì dẫn sang Đội chuẩn.
 */
import { localePath, pick } from '../../js/i18n.js';
import { landingStatistics, localeNumber } from './landing-stats.ts';
import type { BlogLocale, BlogPost } from './blog-posts.ts';

export interface BlogGuideLink {
  href: string;
  label: string;
  text: string;
}

/** Chủ đề → mục; so khớp không phân biệt hoa thường trên từng tag, theo thứ tự (mục đầu khớp thắng). */
const GUIDES = [
  { id: 'khai-hoang', keywords: ['khai hoang', 'chạm sứ', 'quân thủ', '开荒', '碰瓷', '守军'] },
  { id: 'goi-y-doi', keywords: ['gợi ý đội', 'kho', '配队', '库存'] },
] as const;

function guideFor(tags: readonly string[]): (typeof GUIDES)[number]['id'] | 'doi-chuan' {
  const lowered = tags.map((tag) => tag.toLocaleLowerCase('vi'));
  for (const guide of GUIDES) {
    if (lowered.some((tag) => guide.keywords.some((keyword) => tag.includes(keyword)))) return guide.id;
  }
  return 'doi-chuan';
}

export async function blogGuideLink(post: Pick<BlogPost, 'tags' | 'lang'>): Promise<BlogGuideLink> {
  const locale: BlogLocale = post.lang;
  const p = (vi: string, zh: string) => pick(locale, vi, zh);
  const n = (value: number) => localeNumber(value, locale);
  const guide = guideFor(post.tags);
  if (guide === 'goi-y-doi') {
    return {
      href: localePath('/goi-y-doi-tu-kho/', locale),
      label: p('Mở Gợi ý đội', '打开武将库配队'),
      text: p('Nhập kho tướng và chiến pháp, công cụ chọn tối đa 5 đội không trùng tài nguyên.', '录入武将和战法库存，工具最多推荐 5 支资源不重复的阵容。'),
    };
  }
  const stats = await landingStatistics();
  if (guide === 'khai-hoang') {
    const { teams, mines } = stats.khaiHoang;
    return {
      href: localePath('/khai-hoang/', locale),
      label: p('Mở mục Khai hoang', '打开开荒栏目'),
      text: p(`${n(teams)} đội khai hoang có điểm từng mốc đất và quân thủ của ${n(mines)} mỏ.`, `${n(teams)} 支开荒队，含各级地评分与 ${n(mines)} 个矿的守军。`),
    };
  }
  return {
    href: localePath('/doi-chuan/', locale),
    label: p('Mở Đội chuẩn', '打开推荐阵容'),
    text: p(`${n(stats.standardConfigs)} cấu hình Đội chuẩn của ${n(stats.sourceSeasons)} mùa, có điểm và chiến pháp từng tướng.`, `${n(stats.standardConfigs)} 套推荐阵容，覆盖 ${n(stats.sourceSeasons)} 个赛季，含评分与各武将战法。`),
  };
}
