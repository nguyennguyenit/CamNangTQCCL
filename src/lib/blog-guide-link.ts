/**
 * Khối "Trong cẩm nang" của trang bài viết chi tiết (artboard BaiVietDetail `.bvd-cta`): dẫn người đọc sang mục của
 * cẩm nang hợp với chủ đề bài. Chọn mục theo chủ đề (tag) của bài; số liệu tính lúc build từ dữ liệu đã publish
 * (`landingStatistics`), không hard-code. Không khớp chủ đề nào thì dẫn sang Đội chuẩn.
 */
import { localePath, pick } from '../../js/i18n.js';
import type { BlogLocale, BlogPost } from './blog-posts.ts';

export interface BlogGuideLink {
  href: string;
  label: string;
  text: string;
}

export type BlogGuideTopic = 'khai-hoang' | 'goi-y-doi' | 'doi-chuan';

/**
 * Chủ đề → mục, theo thứ tự (mục đầu khớp thắng). Từ khoá tiếng Việt khớp theo nguyên từ (ranh giới từ) để "kho" không
 * khớp "Khoảng cách" / "Khoá đội" / "Khoa học"; từ khoá chữ Hán (không có dấu cách giữa từ) khớp theo chuỗi con.
 */
const GUIDES: ReadonlyArray<{ id: Exclude<BlogGuideTopic, 'doi-chuan'>; keywords: readonly string[] }> = [
  { id: 'khai-hoang', keywords: ['khai hoang', 'chạm sứ', 'quân thủ', '开荒', '碰瓷', '守军'] },
  { id: 'goi-y-doi', keywords: ['gợi ý đội', 'kho', '配队', '库存'] },
];

const HAN = /\p{Script=Han}/u;

/** Chữ thường, dạng NFC (tag nhập bằng bộ gõ tổ hợp ra NFD), tách theo mọi ký tự không phải chữ/số. */
const words = (value: string) => value.normalize('NFC').toLocaleLowerCase('vi').split(/[^\p{L}\p{N}]+/u).filter(Boolean);

function tagMatches(tag: string, keyword: string): boolean {
  if (HAN.test(keyword)) return tag.normalize('NFC').includes(keyword);
  const haystack = words(tag);
  const needle = words(keyword);
  return haystack.some((_, start) => needle.every((word, offset) => haystack[start + offset] === word));
}

/** Mục cẩm nang hợp với các chủ đề của bài. */
export function blogGuideTopic(tags: readonly string[]): BlogGuideTopic {
  for (const guide of GUIDES) {
    if (tags.some((tag) => guide.keywords.some((keyword) => tagMatches(tag, keyword)))) return guide.id;
  }
  return 'doi-chuan';
}

/** Số liệu landing đọc một lần cho cả lần build (mọi trang bài viết dùng chung), nạp chậm khi cần. */
let statistics: ReturnType<typeof loadStatistics> | null = null;
async function loadStatistics() {
  const { landingStatistics, localeNumber } = await import('./landing-stats.ts');
  return { stats: await landingStatistics(), localeNumber };
}

export async function blogGuideLink(post: Pick<BlogPost, 'tags' | 'lang'>): Promise<BlogGuideLink> {
  const locale: BlogLocale = post.lang;
  const p = (vi: string, zh: string) => pick(locale, vi, zh);
  const topic = blogGuideTopic(post.tags);
  if (topic === 'goi-y-doi') {
    return {
      href: localePath('/goi-y-doi-tu-kho/', locale),
      label: p('Mở Gợi ý đội', '打开武将库配队'),
      text: p('Nhập kho tướng và chiến pháp, công cụ chọn tối đa 5 đội không trùng tài nguyên.', '录入武将和战法库存，工具最多推荐 5 支资源不重复的阵容。'),
    };
  }
  statistics ??= loadStatistics();
  const { stats, localeNumber } = await statistics;
  const n = (value: number) => localeNumber(value, locale);
  if (topic === 'khai-hoang') {
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
