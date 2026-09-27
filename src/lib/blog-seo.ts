/**
 * Chữ hiển thị và dữ liệu có cấu trúc (JSON-LD, RSS, llms.txt) của blog. Mỗi chuỗi chọn đúng một
 * ngôn ngữ qua `pick()`; bản vi là gốc, bản zh là bản dịch tiếng Trung giản thể.
 */
import { pick } from '../../js/i18n.js';
import { blogIndexPath, type BlogLocale, type RenderedBlogPost } from './blog-posts.ts';

export const SITE_NAME = { vi: 'Cẩm Nang Game Tam Quốc Chí - Chiến Lược', zh: '三国志战略版攻略手册' } as const;

export function blogCopy(locale: BlogLocale) {
  const p = (vi: string, zh: string): string => pick(locale, vi, zh);
  return {
    locale,
    htmlLang: p('vi', 'zh-Hans'),
    ogLocale: p('vi_VN', 'zh_CN'),
    siteName: SITE_NAME[locale],
    blogName: p('Bài viết', '文章'),
    home: p('Trang chủ', '首页'),
    indexTitle: p(`Bài viết — ${SITE_NAME.vi}`, `文章 — ${SITE_NAME.zh}`),
    indexHeading: p('Bài viết', '文章'),
    indexDescription: p(
      'Bài viết hướng dẫn và phân tích Tam Quốc Chí Chiến Lược: đội hình, tướng, chiến pháp và cách chơi theo mùa.',
      '三国志战略版攻略与分析文章：阵容、武将、战法以及各赛季玩法。',
    ),
    indexKicker: p('Cẩm nang cộng đồng', '社区攻略'),
    tagline: p('Bài viết', '文章'),
    emptyTitle: p('Chưa có bài viết nào', '暂无文章'),
    emptyBody: p(
      'Bài viết đầu tiên sẽ xuất hiện ở đây ngay khi được xuất bản. Trong lúc chờ, bạn có thể xem đội hình và tra cứu tướng.',
      '第一篇文章发布后会显示在这里。在此之前，你可以先查看阵容或查询武将。',
    ),
    emptyTeams: p('Xem Đội chuẩn', '查看推荐阵容'),
    emptyLookup: p('Tra cứu', '图鉴查询'),
    postCount: (count: number) => p(`${count} bài viết`, `共 ${count} 篇文章`),
    articleTitle: (title: string) => p(`${title} — Bài viết — ${SITE_NAME.vi}`, `${title} — 文章 — ${SITE_NAME.zh}`),
    back: p('Tất cả bài viết', '全部文章'),
    backLabel: p('Quay lại danh sách bài viết', '返回文章列表'),
    breadcrumbLabel: p('Đường dẫn', '导航路径'),
    summary: p('Tóm tắt', '摘要'),
    toc: p('Mục lục', '目录'),
    faq: p('Câu hỏi thường gặp', '常见问题'),
    related: p('Bài viết liên quan', '相关文章'),
    tags: p('Chủ đề', '标签'),
    author: p('Tác giả', '作者'),
    published: p('Đăng ngày', '发布于'),
    updated: p('Cập nhật', '更新于'),
    readingTime: (minutes: number) => p(`${minutes} phút đọc`, `阅读约 ${minutes} 分钟`),
    readMore: p('Đọc bài', '阅读全文'),
    translation: p('Đọc bản tiếng Trung', '阅读越南语版本'),
    translationLang: p('zh-Hans', 'vi'),
    rssLabel: p('RSS bài viết', '文章 RSS'),
    rssTitle: p(`Bài viết — ${SITE_NAME.vi}`, `文章 — ${SITE_NAME.zh}`),
  };
}

/** Ngày hiển thị theo giờ Việt Nam (ngày build/đăng đều quy về một múi giờ). */
export function formatPostDate(iso: string, locale: BlogLocale): string {
  return new Intl.DateTimeFormat(pick(locale, 'vi-VN', 'zh-CN'), {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(iso));
}

const absolute = (path: string, site: URL | string) => new URL(path, site).href;

function organization(locale: BlogLocale, site: URL | string) {
  return {
    '@type': 'Organization',
    name: SITE_NAME[locale],
    url: absolute('/', site),
    logo: { '@type': 'ImageObject', url: absolute('/favicon.png', site) },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[], site: URL | string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absolute(item.path, site),
    })),
  };
}

export function postImage(post: RenderedBlogPost, site: URL | string): string {
  return absolute(post.coverImage ?? '/og-image.png', site);
}

export function articleJsonLd(post: RenderedBlogPost, site: URL | string) {
  const copy = blogCopy(post.lang);
  const url = absolute(post.path, site);
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    image: [postImage(post, site)],
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    inLanguage: copy.htmlLang,
    keywords: post.tags.join(', '),
    author: { '@type': 'Person', name: post.author.name },
    publisher: organization(post.lang, site),
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    isPartOf: { '@type': 'Blog', name: copy.blogName, url: absolute(blogIndexPath(post.lang), site) },
  };
}

export function faqJsonLd(post: RenderedBlogPost) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: blogCopy(post.lang).htmlLang,
    mainEntity: post.faq.map((entry) => ({
      '@type': 'Question',
      name: entry.q,
      acceptedAnswer: { '@type': 'Answer', text: entry.a },
    })),
  };
}

export function blogIndexJsonLd(locale: BlogLocale, posts: readonly RenderedBlogPost[], site: URL | string) {
  const copy = blogCopy(locale);
  const url = absolute(blogIndexPath(locale), site);
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: copy.indexHeading,
    description: copy.indexDescription,
    url,
    inLanguage: copy.htmlLang,
    isPartOf: { '@type': 'WebSite', name: copy.siteName, url: absolute('/', site) },
    mainEntity: {
      '@type': 'Blog',
      name: copy.blogName,
      url,
      publisher: organization(locale, site),
      blogPost: posts.map((post) => ({
        '@type': 'BlogPosting',
        headline: post.title,
        url: absolute(post.path, site),
        datePublished: post.publishedAt,
        dateModified: post.updatedAt,
      })),
    },
    ...(posts.length
      ? {
          hasPart: {
            '@type': 'ItemList',
            itemListElement: posts.map((post, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              url: absolute(post.path, site),
              name: post.title,
            })),
          },
        }
      : {}),
  };
}

const XML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
export const escapeXml = (value: string) => value.replace(/[&<>"']/gu, (character) => XML_ESCAPES[character]!);

export const RSS_MIME = 'application/rss+xml; charset=utf-8';

/** RSS 2.0 cho một ngôn ngữ; `lastBuildDate` lấy từ bài cập nhật gần nhất để tài liệu ổn định giữa các lần build. */
export function rssDocument(locale: BlogLocale, posts: readonly RenderedBlogPost[], site: URL | string): string {
  const copy = blogCopy(locale);
  const feedPath = locale === 'zh' ? '/zh/rss.xml' : '/rss.xml';
  const latest = posts.reduce<string | null>((max, post) => (max === null || post.updatedAt > max ? post.updatedAt : max), null);
  const items = posts.map((post) => {
    const url = absolute(post.path, site);
    return [
      '    <item>',
      `      <title>${escapeXml(post.title)}</title>`,
      `      <link>${escapeXml(url)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
      `      <description>${escapeXml(post.description)}</description>`,
      `      <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>`,
      `      <dc:creator>${escapeXml(post.author.name)}</dc:creator>`,
      ...post.tags.map((tag) => `      <category>${escapeXml(tag)}</category>`),
      '    </item>',
    ].join('\n');
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    '  <channel>',
    `    <title>${escapeXml(copy.rssTitle)}</title>`,
    `    <link>${escapeXml(absolute(blogIndexPath(locale), site))}</link>`,
    `    <description>${escapeXml(copy.indexDescription)}</description>`,
    `    <language>${pick(locale, 'vi', 'zh-cn')}</language>`,
    `    <atom:link href="${escapeXml(absolute(feedPath, site))}" rel="self" type="application/rss+xml"/>`,
    ...(latest ? [`    <lastBuildDate>${new Date(latest).toUTCString()}</lastBuildDate>`] : []),
    ...items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
}

/** Tổng quan site cho trình thu thập AI (llmstxt.org): mục đích, các mục chính, danh sách bài. */
export function llmsDocument(posts: readonly RenderedBlogPost[], site: URL | string): string {
  // Tiêu đề bài do admin nhập: thoát `[`/`]` để không vỡ cú pháp link Markdown.
  const link = (label: string, path: string, note: string) =>
    `- [${label.replace(/[[\]\\]/gu, (character) => `\\${character}`)}](${absolute(path, site)}): ${note}`;
  const postLines = (lang: BlogLocale) => {
    const own = posts.filter((post) => post.lang === lang);
    return own.length
      ? own.map((post) => link(post.title, post.path, `${post.description.replace(/\s+/gu, ' ')} (${post.publishedAt.slice(0, 10)})`))
      : [lang === 'vi' ? '- Chưa có bài viết tiếng Việt.' : '- Chưa có bài viết tiếng Trung.'];
  };
  return [
    `# ${SITE_NAME.vi}`,
    '',
    '> Cẩm nang cộng đồng cho người chơi Tam Quốc Chí Chiến Lược (三国志·战略版): đội hình theo mùa, tra cứu tướng, chiến pháp, trang bị, quân sư và vài công cụ tính giúp. Site có bản tiếng Việt (gốc `/`) và bản tiếng Trung giản thể (`/zh/`).',
    '',
    'Tên tướng và chiến pháp ở bản tiếng Việt dùng âm Hán Việt; bản tiếng Trung giữ chữ Hán gốc. Nội dung chỉ mang tính tham khảo, không phải thông tin chính thức của nhà phát hành.',
    '',
    '## Mục chính',
    '',
    link('Đội chuẩn', '/doi-chuan/', 'đội hình khuyến nghị theo mùa, lọc theo phe, loại binh và mùa'),
    link('Đội khác', '/doi-khac/', 'đội người chơi tổng hợp và đối chiếu với đội chuẩn'),
    link('Cùng Tồn', '/cung-ton/', 'các nhóm đội dùng cùng lúc không trùng tướng và chiến pháp'),
    link('Khai hoang', '/khai-hoang/', 'hướng dẫn đánh đất theo từng đội'),
    link('Tra cứu', '/tra-cuu/', 'tướng, chiến pháp, trang bị, quân sư, cải tạo binh chủng và công trình'),
    link('Bài viết', '/bai-viet/', 'bài hướng dẫn và phân tích bằng tiếng Việt'),
    link('文章', '/zh/bai-viet/', 'bài viết bằng tiếng Trung giản thể'),
    '',
    '## Bản tiếng Trung giản thể',
    '',
    link('首页', '/zh/', 'trang chủ bản tiếng Trung'),
    link('推荐阵容', '/zh/doi-chuan/', 'Đội chuẩn, tên đội và tướng bằng chữ Hán gốc'),
    link('其他阵容', '/zh/doi-khac/', 'Đội khác bản tiếng Trung'),
    link('共存阵容', '/zh/cung-ton/', 'Cùng Tồn bản tiếng Trung'),
    link('开荒', '/zh/khai-hoang/', 'Khai hoang bản tiếng Trung'),
    link('图鉴查询', '/zh/tra-cuu/', 'Tra cứu bản tiếng Trung'),
    link('招募记录', '/zh/theo-doi-chieu-mo/', 'Theo dõi chiêu mộ bản tiếng Trung'),
    link('截图识阵', '/zh/soi-doi-tu-anh/', 'Soi đội từ ảnh bản tiếng Trung'),
    link('武将库配队', '/zh/goi-y-doi-tu-kho/', 'Gợi ý đội từ kho bản tiếng Trung'),
    '',
    '## Bài viết tiếng Việt',
    '',
    ...postLines('vi'),
    '',
    '## Bài viết tiếng Trung (中文文章)',
    '',
    ...postLines('zh'),
    '',
    '## Khác',
    '',
    link('Sitemap', '/sitemap.xml', 'toàn bộ URL công khai'),
    link('RSS tiếng Việt', '/rss.xml', 'bài viết mới nhất bằng tiếng Việt'),
    link('RSS tiếng Trung', '/zh/rss.xml', 'bài viết mới nhất bằng tiếng Trung'),
    '',
  ].join('\n');
}
