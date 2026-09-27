/**
 * Bài viết blog lấy từ community API lúc build (`GET {COMMUNITY_API_ORIGIN}/api/posts`).
 * Không khai biến môi trường → blog rỗng (build local/CI không cần API). Đã khai mà API lỗi hoặc
 * payload sai hợp đồng → dừng build (fail closed): thà không deploy còn hơn xuất trang thiếu/sai bài.
 * Markdown → HTML bằng Sätteri (bộ xử lý Markdown của Astro); HTML thô bị bỏ, link/ảnh chỉ nhận
 * scheme an toàn.
 */
import { markdownToHtml } from 'satteri';
import { localePath } from '../../js/i18n.js';
import { EXTERNAL_REL } from './official-links.ts';

export type BlogLocale = 'vi' | 'zh';

export interface BlogFaq {
  q: string;
  a: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  lang: BlogLocale;
  translationKey: string | null;
  title: string;
  description: string;
  bodyMarkdown: string;
  faq: BlogFaq[];
  tags: string[];
  coverImage: string | null;
  author: { name: string };
  publishedAt: string;
  updatedAt: string;
  createdAt: string;
}

export interface BlogHeading {
  depth: 2 | 3;
  id: string;
  text: string;
}

export interface RenderedMarkdown {
  html: string;
  headings: BlogHeading[];
  text: string;
}

export interface RenderedBlogPost extends BlogPost {
  /** Pathname công khai, có tiền tố `/zh` với bài tiếng Trung. */
  path: string;
  html: string;
  headings: BlogHeading[];
  readingMinutes: number;
}

export const SITE_ORIGIN = 'https://tqccl.com';
export const BLOG_BASE_PATH = '/bai-viet/';
export const POST_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,100}$/u;
const TRANSLATION_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,120}$/u;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/u;
const LIMITS = { id: 100, title: 200, description: 500, body: 200_000, faq: 50, faqText: 2000, tags: 20, tag: 50, author: 100, url: 2048 };

/** Id do trang bài viết tự dùng: heading trong thân bài không được trùng. */
const RESERVED_IDS = ['main-content', 'section-menu-items', 'blog-article-title', 'blog-summary', 'blog-toc', 'blog-body', 'blog-faq', 'blog-faq-title', 'blog-related', 'blog-related-title', 'blog-list-title'];

// ---------- Kiểm tra payload ----------

function fail(message: string): never {
  throw new Error(`Blog posts payload invalid: ${message}`);
}

function text(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || !value.trim()) fail(`${field} must be a non-empty string`);
  if (value.length > max) fail(`${field} exceeds ${max} characters`);
  return value.trim();
}

function isoDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value) || !Number.isFinite(Date.parse(value))) {
    fail(`${field} must be an ISO 8601 date-time`);
  }
  return new Date(value).toISOString();
}

/** Ảnh bìa: https tuyệt đối, hoặc đường dẫn cùng site (`/api/media/<key>`). */
function coverImage(value: unknown, field: string): string | null {
  if (value === null) return null;
  const url = text(value, field, LIMITS.url);
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    fail(`${field} must be an https URL or a same-site path`);
  }
  if (parsed.protocol !== 'https:') fail(`${field} must use https`);
  return parsed.href;
}

function validatePost(raw: unknown, index: number): BlogPost {
  const at = `items[${index}]`;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail(`${at} must be an object`);
  const item = raw as Record<string, unknown>;
  const slug = item.slug;
  if (typeof slug !== 'string' || !POST_SLUG_PATTERN.test(slug)) fail(`${at}.slug is not a valid slug`);
  if (item.lang !== 'vi' && item.lang !== 'zh') fail(`${at}.lang must be "vi" or "zh"`);
  if (item.status !== 'published') fail(`${at}.status must be "published"`);
  const translationKey = item.translationKey;
  if (translationKey !== null && (typeof translationKey !== 'string' || !TRANSLATION_KEY_PATTERN.test(translationKey))) {
    fail(`${at}.translationKey must be null or a key`);
  }
  if (!Array.isArray(item.faq) || item.faq.length > LIMITS.faq) fail(`${at}.faq must be an array of at most ${LIMITS.faq}`);
  const faq = item.faq.map((entry: unknown, faqIndex: number) => {
    if (!entry || typeof entry !== 'object') fail(`${at}.faq[${faqIndex}] must be an object`);
    const pair = entry as Record<string, unknown>;
    return { q: text(pair.q, `${at}.faq[${faqIndex}].q`, LIMITS.faqText), a: text(pair.a, `${at}.faq[${faqIndex}].a`, LIMITS.faqText) };
  });
  if (!Array.isArray(item.tags) || item.tags.length > LIMITS.tags) fail(`${at}.tags must be an array of at most ${LIMITS.tags}`);
  const tags = item.tags.map((tag: unknown, tagIndex: number) => text(tag, `${at}.tags[${tagIndex}]`, LIMITS.tag));
  if (new Set(tags.map((tag) => tag.toLowerCase())).size !== tags.length) fail(`${at}.tags contains duplicates`);
  const author = item.author;
  if (!author || typeof author !== 'object') fail(`${at}.author must be an object`);
  if (typeof item.bodyMarkdown !== 'string' || !item.bodyMarkdown.trim()) fail(`${at}.bodyMarkdown must be non-empty`);
  if (item.bodyMarkdown.length > LIMITS.body) fail(`${at}.bodyMarkdown exceeds ${LIMITS.body} characters`);
  return {
    id: text(item.id, `${at}.id`, LIMITS.id),
    slug,
    lang: item.lang,
    translationKey: translationKey as string | null,
    title: text(item.title, `${at}.title`, LIMITS.title),
    description: text(item.description, `${at}.description`, LIMITS.description),
    bodyMarkdown: item.bodyMarkdown,
    faq,
    tags,
    coverImage: coverImage(item.coverImage, `${at}.coverImage`),
    author: { name: text((author as Record<string, unknown>).name, `${at}.author.name`, LIMITS.author) },
    publishedAt: isoDate(item.publishedAt, `${at}.publishedAt`),
    updatedAt: isoDate(item.updatedAt, `${at}.updatedAt`),
    createdAt: isoDate(item.createdAt, `${at}.createdAt`),
  };
}

/** Kiểm payload `GET /api/posts`; mọi sai lệch (kể cả trùng id, slug, translationKey) đều throw. */
export function validatePostsPayload(payload: unknown): BlogPost[] {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { items?: unknown }).items)) {
    fail('expected an object with an `items` array');
  }
  const posts = (payload as { items: unknown[] }).items.map(validatePost);
  const seen = new Set<string>();
  const claim = (key: string, message: string) => {
    if (seen.has(key)) fail(message);
    seen.add(key);
  };
  for (const post of posts) {
    claim(`id:${post.id}`, `duplicate id ${post.id}`);
    claim(`slug:${post.lang}:${post.slug}`, `duplicate slug ${post.lang}/${post.slug}`);
    if (post.translationKey !== null) {
      claim(`tk:${post.lang}:${post.translationKey}`, `duplicate translationKey ${post.lang}/${post.translationKey}`);
    }
  }
  return posts;
}

// ---------- Markdown ----------

/** Id heading đọc được: bỏ dấu tiếng Việt, giữ chữ Hán, gạch nối thay khoảng trắng/ký hiệu. */
export function headingSlug(value: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[đĐ]/gu, 'd')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  return slug || 'muc';
}

type HastProps = Record<string, unknown>;
type HastElement = { type: 'element'; tagName: string; properties?: HastProps; children?: unknown[] };

/** Link: chỉ `#`, đường dẫn cùng site, http(s) và mailto. Trả null khi phải bỏ href. */
function safeHref(href: unknown, siteOrigin: string): { href: string; external: boolean } | null {
  if (typeof href !== 'string') return null;
  const value = href.trim();
  if (value.startsWith('#') || (value.startsWith('/') && !value.startsWith('//'))) return { href: value, external: false };
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol === 'mailto:') return { href: parsed.href, external: true };
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  return { href: parsed.href, external: parsed.origin !== siteOrigin };
}

function safeImageSrc(src: unknown): string | null {
  if (typeof src !== 'string') return null;
  const value = src.trim();
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}

/**
 * Markdown → HTML an toàn. HTML thô và comment bị bỏ; heading cấp 1 hạ xuống cấp 2 (trang đã có h1);
 * heading nhận id; link ngoài mở tab mới với `rel` an toàn; ảnh lười tải.
 */
export function renderBlogMarkdown(markdown: string, { siteOrigin = SITE_ORIGIN }: { siteOrigin?: string } = {}): RenderedMarkdown {
  const headings: BlogHeading[] = [];
  const used = new Set(RESERVED_IDS);
  const uniqueId = (base: string) => {
    let id = base;
    for (let suffix = 2; used.has(id); suffix += 1) id = `${base}-${suffix}`;
    used.add(id);
    return id;
  };
  const { html } = markdownToHtml(markdown, {
    features: { gfm: { footnotes: false }, frontmatter: false },
    hastPlugins: [
      {
        name: 'blog-sanitize',
        raw(node, ctx) {
          ctx.removeNode(node);
        },
        comment(node, ctx) {
          ctx.removeNode(node);
        },
        element: [
          {
            filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
            visit(node, ctx) {
              const depth = Math.max(2, Number(node.tagName.slice(1)));
              const label = ctx.textContent(node).trim();
              const id = uniqueId(headingSlug(label));
              if (depth <= 3 && label) headings.push({ depth: depth as 2 | 3, id, text: label });
              return { type: 'element', tagName: `h${depth}`, properties: { id }, children: node.children } as never;
            },
          },
          {
            filter: ['a'],
            visit(node, ctx) {
              const target = safeHref((node as HastElement).properties?.href, siteOrigin);
              if (!target) {
                ctx.setProperty(node, 'href', null);
                return;
              }
              ctx.setProperty(node, 'href', target.href);
              if (target.external) {
                ctx.setProperty(node, 'rel', EXTERNAL_REL.split(' '));
                if (!target.href.startsWith('mailto:')) ctx.setProperty(node, 'target', '_blank');
              }
            },
          },
          {
            filter: ['img'],
            visit(node, ctx) {
              const src = safeImageSrc((node as HastElement).properties?.src);
              if (!src) {
                ctx.removeNode(node);
                return;
              }
              ctx.setProperty(node, 'src', src);
              ctx.setProperty(node, 'loading', 'lazy');
              ctx.setProperty(node, 'decoding', 'async');
            },
          },
        ],
      },
    ],
  });
  const plain = html.replace(/<[^>]*>/gu, ' ').replace(/&[a-z#0-9]+;/giu, ' ').replace(/\s+/gu, ' ').trim();
  return { html, headings, text: plain };
}

/** Phút đọc: tiếng Việt ~220 từ/phút, tiếng Trung ~400 chữ/phút; tối thiểu 1 phút. */
export function readingMinutes(plain: string, lang: BlogLocale): number {
  const han = plain.match(/[\u3400-\u9fff\uf900-\ufaff]/gu)?.length ?? 0;
  const words = plain.replace(/[\u3400-\u9fff\uf900-\ufaff]/gu, ' ').split(/\s+/u).filter(Boolean).length;
  const minutes = lang === 'zh' ? (han + words) / 400 : words / 220 + han / 400;
  return Math.max(1, Math.ceil(minutes));
}

export function postPath(post: Pick<BlogPost, 'lang' | 'slug'>): string {
  return localePath(`${BLOG_BASE_PATH}${post.slug}/`, post.lang);
}

export function blogIndexPath(locale: BlogLocale): string {
  return localePath(BLOG_BASE_PATH, locale);
}

// ---------- Nạp lúc build ----------

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

/** Origin API: bỏ trống → null (blog rỗng); có giá trị mà không phải http(s) → lỗi build. */
export function communityApiOrigin(env: Record<string, string | undefined> = process.env): string | null {
  const value = env.COMMUNITY_API_ORIGIN?.trim();
  if (!value) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('COMMUNITY_API_ORIGIN must be an absolute http(s) URL');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('COMMUNITY_API_ORIGIN must use http(s)');
  return parsed.origin;
}

/** Bài mới nhất trước; cùng thời điểm thì theo slug để thứ tự build ổn định. */
function byNewest(a: BlogPost, b: BlogPost) {
  return b.publishedAt.localeCompare(a.publishedAt) || a.slug.localeCompare(b.slug);
}

export async function fetchBlogPosts({
  env = process.env,
  fetchImpl = fetch,
  siteOrigin = SITE_ORIGIN,
}: { env?: Record<string, string | undefined>; fetchImpl?: FetchLike; siteOrigin?: string } = {}): Promise<RenderedBlogPost[]> {
  const origin = communityApiOrigin(env);
  if (!origin) return [];
  let response: Response;
  try {
    response = await fetchImpl(new URL('/api/posts', origin), {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new Error(`Blog posts fetch failed: ${(error as Error).message}`);
  }
  if (!response.ok) throw new Error(`Blog posts fetch failed: HTTP ${response.status}`);
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    fail('response is not JSON');
  }
  return validatePostsPayload(payload)
    .sort(byNewest)
    .map((post) => {
      const rendered = renderBlogMarkdown(post.bodyMarkdown, { siteOrigin });
      return {
        ...post,
        path: postPath(post),
        html: rendered.html,
        headings: rendered.headings,
        readingMinutes: readingMinutes(rendered.text, post.lang),
      };
    });
}

let memo: { origin: string | null; posts: Promise<RenderedBlogPost[]> } | null = null;

/** Một lần gọi API cho cả lần build: index, bài, RSS, llms.txt và sitemap dùng chung kết quả. */
export function loadBlogPosts(): Promise<RenderedBlogPost[]> {
  const origin = communityApiOrigin();
  if (!memo || memo.origin !== origin) memo = { origin, posts: fetchBlogPosts() };
  return memo.posts;
}

export async function postsForLocale(locale: BlogLocale): Promise<RenderedBlogPost[]> {
  return (await loadBlogPosts()).filter((post) => post.lang === locale);
}

/** Bản dịch cùng translationKey ở ngôn ngữ còn lại (cho hreflang và nút chuyển ngôn ngữ). */
export function translationOf(post: BlogPost, posts: readonly RenderedBlogPost[]): RenderedBlogPost | null {
  if (!post.translationKey) return null;
  return posts.find((other) => other.lang !== post.lang && other.translationKey === post.translationKey) ?? null;
}

/** Bài liên quan: cùng ngôn ngữ, chung nhiều thẻ nhất, rồi mới nhất. Không chung thẻ nào thì không tính. */
export function relatedPosts(post: BlogPost, posts: readonly RenderedBlogPost[], limit = 3): RenderedBlogPost[] {
  const tags = new Set(post.tags.map((tag) => tag.toLowerCase()));
  return posts
    .filter((other) => other.lang === post.lang && other.id !== post.id)
    .map((other) => ({ other, shared: other.tags.filter((tag) => tags.has(tag.toLowerCase())).length }))
    .filter(({ shared }) => shared > 0)
    .sort((a, b) => b.shared - a.shared || byNewest(a.other, b.other))
    .slice(0, limit)
    .map(({ other }) => other);
}

/** JSON-LD nhúng trong `<script>`: chặn `</script>` và ký tự phân dòng JS trong chuỗi. */
export function jsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</gu, '\\u003c')
    .replace(/>/gu, '\\u003e')
    .replace(/&/gu, '\\u0026')
    .replace(/\u2028/gu, '\\u2028')
    .replace(/\u2029/gu, '\\u2029');
}
