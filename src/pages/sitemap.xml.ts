import type { APIContext, APIRoute } from "astro";
import { teamDetailCatalog } from "../lib/team-detail-routes.ts";
import { lookupDetailRoutes } from "../lib/lookup-detail-routes.ts";
import { blogIndexPath, loadBlogPosts, translationOf, type BlogLocale } from "../lib/blog-posts.ts";
import { alternatePaths, type AlternateLink } from "../lib/locale-routes.ts";
import { localePath } from "../../js/i18n.js";
import { LOOKUP_GROUP_SLUGS, lookupGroupPath } from "../../js/lookup-ids.js";
import { POLICY_PAGES } from "../lib/policy-pages.ts";

export const prerender = true;

export const SITEMAP_MIME = "application/xml; charset=utf-8";

/** Tám trang mục tĩnh; thứ tự trong tài liệu do `sitemapLocations` sắp xếp. */
export const SECTION_PATHS = [
  "/doi-chuan/",
  "/doi-khac/",
  "/cung-ton/",
  "/khai-hoang/",
  "/tra-cuu/",
  "/theo-doi-chieu-mo/",
  "/soi-doi-tu-anh/",
  "/goi-y-doi-tu-kho/",
] as const;

/** Bảy trang nhóm Tra cứu (`/tra-cuu/<slug>/`), cùng cấp với trang mục. */
export const LOOKUP_GROUP_PATHS: readonly string[] = Object.keys(LOOKUP_GROUP_SLUGS).map((group) => lookupGroupPath(group) as string);

/** Trang nội dung tĩnh có bản gương `/zh`, được index (không phải trang mục của app.js): các trang chính sách. */
export const STATIC_PAGE_PATHS: readonly string[] = POLICY_PAGES.map((page) => page.path);

/**
 * Một URL của sitemap; `lastmod` (ISO 8601) chỉ khai khi biết chắc thời điểm sửa — hiện là blog.
 * `alternates` là cặp hreflang (`xhtml:link`) khi trang có bản ngôn ngữ còn lại.
 */
export interface SitemapRoute {
  path: string;
  lastmod?: string;
  alternates?: AlternateLink[];
}

/** Bài viết như sitemap cần: pathname công khai, ngôn ngữ, thời điểm cập nhật và bản dịch (nếu có). */
export interface SitemapPost {
  path: string;
  lang: BlogLocale;
  updatedAt: string;
  translationPath?: string | null;
}

/**
 * Route có bản gương `/zh`: mỗi đường dẫn bản Việt sinh hai URL (vi + zh) cùng một bộ hreflang.
 * Nhận cả `/` (Landing); build và verifier dùng chung để sitemap khớp từng byte.
 */
export function mirroredSitemapRoutes(viPaths: readonly string[]): SitemapRoute[] {
  return viPaths.flatMap((path) => {
    const zhPath = localePath(path, "zh");
    const alternates = alternatePaths(path, zhPath);
    return [{ path, alternates }, { path: zhPath, alternates }];
  });
}

/** Tập route có bản gương của sitemap: Landing, 8 trang mục, 7 trang nhóm Tra cứu, trang tĩnh và mọi trang chi tiết (đội + mục Tra cứu). */
export function mirroredSitemapPaths(detailRoutePaths: readonly string[]): string[] {
  return ["/", ...SECTION_PATHS, ...LOOKUP_GROUP_PATHS, ...STATIC_PAGE_PATHS, ...detailRoutePaths];
}

/**
 * Hai trang danh sách blog (luôn có, kể cả khi rỗng) cộng mọi bài. Trang danh sách lấy `lastmod` của bài
 * mới sửa nhất cùng ngôn ngữ. Build và verifier dùng chung hàm này để sitemap khớp từng byte.
 */
export function blogSitemapRoutes(posts: readonly SitemapPost[]): SitemapRoute[] {
  const routes: SitemapRoute[] = [];
  for (const lang of ["vi", "zh"] as const) {
    const own = posts.filter((post) => post.lang === lang);
    const latest = own.reduce<string | undefined>((max, post) => (max === undefined || post.updatedAt > max ? post.updatedAt : max), undefined);
    const alternates = alternatePaths(blogIndexPath("vi"), blogIndexPath("zh"));
    routes.push(latest ? { path: blogIndexPath(lang), lastmod: latest, alternates } : { path: blogIndexPath(lang), alternates });
    for (const post of own) {
      const route: SitemapRoute = { path: post.path, lastmod: post.updatedAt };
      // Chỉ bài có bản dịch (cùng translationKey) mới khai hreflang; bài đơn ngữ đứng riêng.
      if (post.translationPath) {
        route.alternates = lang === "vi" ? alternatePaths(post.path, post.translationPath) : alternatePaths(post.translationPath, post.path);
      }
      routes.push(route);
    }
  }
  return routes;
}

const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/** A sitemap only publishes absolute URLs, so a missing or non-http(s) configured origin is a build failure. */
function requireOrigin(site: string | URL | undefined) {
  let parsed: URL;
  try {
    parsed = new URL(site instanceof URL ? site.href : String(site ?? ""));
  } catch {
    throw new Error("Sitemap needs the absolute `site` origin declared in astro.config");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Sitemap origin must be http(s): ${parsed.protocol}`);
  }
  return parsed.origin;
}

/**
 * Root first, then every catalog route in a stable order; a repeat or a retired family stops the build.
 * `/` trong danh sách (route có hreflang) chính là root đã đứng đầu nên chỉ được gộp một lần.
 */
export function sitemapLocations(site: string | URL | undefined, routePaths: readonly string[]) {
  const origin = requireOrigin(site);
  const locations = [new URL("/", origin).href];
  const rest = [...routePaths];
  const rootIndex = rest.indexOf("/");
  if (rootIndex !== -1) rest.splice(rootIndex, 1);
  for (const routePath of rest.sort()) locations.push(new URL(routePath, origin).href);
  const seen = new Set<string>();
  for (const location of locations) {
    const { pathname } = new URL(location);
    if (pathname === "/teams" || pathname.startsWith("/teams/")) {
      throw new Error(`Sitemap must not publish the retired route family: ${location}`);
    }
    if (seen.has(location)) throw new Error(`Sitemap publishes a duplicate URL: ${location}`);
    seen.add(location);
  }
  return locations;
}

/** Chuỗi đường dẫn thuần (trang mục, route chi tiết) hoặc `SitemapRoute` có `lastmod`. */
export function sitemapDocument(site: string | URL | undefined, routes: readonly (string | SitemapRoute)[]) {
  const normalized = routes.map((route) => (typeof route === "string" ? { path: route } : route));
  const locations = sitemapLocations(site, normalized.map((route) => route.path));
  const origin = new URL(locations[0]!).origin;
  const lastmodByLocation = new Map(
    normalized.filter((route) => route.lastmod).map((route) => [new URL(route.path, origin).href, route.lastmod!]),
  );
  const alternatesByLocation = new Map(
    normalized.filter((route) => route.alternates?.length).map((route) => [new URL(route.path, origin).href, route.alternates!]),
  );
  const escape = (value: string) => value.replace(/[&<>"']/gu, (character) => XML_ESCAPES[character]!);
  const entries = locations
    .map((location) => {
      const lastmod = lastmodByLocation.get(location);
      const alternates = (alternatesByLocation.get(location) ?? [])
        .map((alternate) => `    <xhtml:link rel="alternate" hreflang="${escape(alternate.hreflang)}" href="${escape(new URL(alternate.path, origin).href)}"/>\n`)
        .join("");
      return `  <url>\n    <loc>${escape(location)}</loc>\n${lastmod ? `    <lastmod>${escape(lastmod)}</lastmod>\n` : ""}${alternates}  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries}\n</urlset>\n`;
}

export const GET: APIRoute = async ({ site }: APIContext) => {
  const catalog = await teamDetailCatalog();
  const lookup = await lookupDetailRoutes();
  const posts = await loadBlogPosts();
  const routes = [
    ...mirroredSitemapRoutes(mirroredSitemapPaths([
      ...[...catalog.recommended, ...catalog.legacy, ...catalog.khaiHoang].map((entry) => entry.routePath),
      ...lookup.entries.map((entry) => entry.path),
    ])),
    ...blogSitemapRoutes(posts.map((post) => ({ ...post, translationPath: translationOf(post, posts)?.path ?? null }))),
  ];
  return new Response(sitemapDocument(site, routes), {
    headers: { "Content-Type": SITEMAP_MIME },
  });
};
