import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import astroConfig from "../astro.config.mjs";
import { PUBLIC_ARTIFACTS, validatePublicArtifactManifest } from "../src/lib/public-artifact-manifest.mjs";
import { llmsDocuments } from "../src/lib/llms-documents.ts";
import { websiteDisplayPublicationSnapshot } from "../src/lib/root-static-artifacts.ts";
import { recommendedPublicationSnapshot } from "../src/lib/recommended-reference-artifacts.ts";
import { teamDetailCatalog } from "../src/lib/team-detail-routes.ts";
import { seasonPageCatalog, seasonRedirectRules } from "../src/lib/season-pages.ts";
import { lookupDetailRoutes } from "../src/lib/lookup-detail-routes.ts";
import { lookupBuildCorpus } from "../src/lib/lookup-pages.ts";
import {
  LOOKUP_GROUP_PATHS,
  SECTION_PATHS,
  STATIC_PAGE_PATHS,
  blogSitemapRoutes,
  mirroredSitemapPaths,
  mirroredSitemapRoutes,
  sitemapDocument,
} from "../src/pages/sitemap.xml.ts";
import { HREFLANG, SITE_LOCALES, localizedHtmlPath, mirroredAlternates } from "../src/lib/locale-routes.ts";
import { PRERENDERED_TEAM_SECTIONS as TEAM_SSR_SECTIONS } from "../src/lib/team-ssr.ts";
import { validateLookupBundle } from "../js/lookup-data.js";
import { LOOKUP_GROUP_SLUGS, lookupGroupPath } from "../js/lookup-ids.js";

/** Mục lục Tra cứu: trang tĩnh, không nạp app; các trang có app là 7 trang mục khác cộng 7 trang nhóm Tra cứu. */
const LOOKUP_HUB_PATH = "/tra-cuu/";
const APP_PAGE_PATHS = [...SECTION_PATHS.filter((path) => path !== LOOKUP_HUB_PATH), ...LOOKUP_GROUP_PATHS];

export const DEPLOYMENT_CONTROL_ARTIFACTS = Object.freeze([
  Object.freeze({ sourcePath: "public/_headers", outputPath: "_headers" }),
  // Redirect 301 của mã chiến pháp đã gộp; sinh bởi pipeline/lookup_route_handles.py.
  Object.freeze({ sourcePath: "public/_redirects", outputPath: "_redirects" }),
]);

export const STATIC_PUBLIC_ARTIFACTS = Object.freeze([
  Object.freeze({ sourcePath: "public/favicon.png", outputPath: "favicon.png" }),
  Object.freeze({ sourcePath: "public/og-image.png", outputPath: "og-image.png" }),
  // Logo sách mở (header, menu, footer, hình mờ hero) — components/SealMark.astro.
  Object.freeze({ sourcePath: "public/logo.png", outputPath: "logo.png" }),
  // Mark chữ "Cẩm Nang" của logo (header, menu, footer bản vi) — components/BrandName.astro.
  Object.freeze({ sourcePath: "public/logo-cam-nang.svg", outputPath: "logo-cam-nang.svg" }),
  // Ảnh QR ủng hộ tác giả (hộp thoại footer); file do chủ site cung cấp.
  Object.freeze({ sourcePath: "public/donate-qr.png", outputPath: "donate-qr.png" }),
  Object.freeze({ sourcePath: "public/robots.txt", outputPath: "robots.txt" }),
]);

/** Thư mục public tĩnh phải được copy nguyên trạng vào dist: danh sách file khớp và từng byte khớp. */
export const STATIC_PUBLIC_DIRECTORIES = Object.freeze([
  Object.freeze({ sourcePath: "public/fonts", outputPath: "fonts" }),
  // Chân dung tướng tự lưu (client Global, không có URL từ xa): `/heroes/<slug>.webp` — xem docs/unified-lookup.md.
  Object.freeze({ sourcePath: "public/heroes", outputPath: "heroes" }),
]);


/** Chữ chờ/đòi JavaScript mà trang đội dựng sẵn không được còn mang (HTML tĩnh phải tự đủ nội dung). */
const WAITING_OR_JS_REQUIRED = /Đang tải chi tiết|正在加载详情|cần JavaScript|需要 JavaScript/u;

/**
 * Bốn trang danh sách đội dựng sẵn đội mặc định lúc build: mỗi mục phải mang dấu hiệu nội dung của nó
 * (danh sách có dấu `data-ssr-signature` + link chi tiết; Cùng Tồn có nhóm + thẻ đội; Khai hoang có lưới thẻ + link).
 */
const SECTION_MARKERS = Object.freeze({
  "team-chuan": ['class="reference-view" data-ssr-signature=', "reference-team-card", "data-team-detail-link"],
  "team-khac": ['class="reference-view" data-ssr-signature=', "reference-team-card", "data-team-detail-link"],
  coexist: ['class="coexist-group-view" data-ssr-signature=', "coexist-team-card"],
  khaihoang: ['class="khaihoang"', "kh-card", "kh-title-link"],
});
// Danh sách mục dựng sẵn chỉ định nghĩa ở `team-ssr.ts` (layout dùng cùng mảng); verifier chỉ giữ dấu hiệu nội dung của từng mục.
const PRERENDERED_TEAM_MARKERS = Object.freeze(Object.fromEntries(TEAM_SSR_SECTIONS.map((key) => {
  if (!SECTION_MARKERS[key]) throw new Error(`Verifier has no prerendered content markers for team section: ${key}`);
  return [key, SECTION_MARKERS[key]];
})));
for (const key of Object.keys(SECTION_MARKERS)) {
  if (!TEAM_SSR_SECTIONS.includes(key)) throw new Error(`Verifier carries markers for a section team-ssr does not prerender: ${key}`);
}

/** Trang cộng đồng tĩnh (noindex, ngoài sitemap) ở cả hai ngôn ngữ: mount và entry JS riêng, nội dung dựng lúc chạy. */
export const COMMUNITY_PAGES = Object.freeze(SITE_LOCALES.flatMap((locale) => [
  Object.freeze({ htmlPath: localizedHtmlPath("chien-bao/index.html", locale), mount: 'id="community-hub"', entry: "/js/community-hub.js" }),
  Object.freeze({ htmlPath: localizedHtmlPath("doi-cong-dong/index.html", locale), mount: 'id="community-teams"', entry: "/js/community-teams.js" }),
  Object.freeze({ htmlPath: localizedHtmlPath("quan-tri/index.html", locale), mount: 'id="community-admin"', entry: "/js/community-admin.js" }),
]));

/**
 * Trang có bản gương vi ↔ zh phải khai đúng `<html lang>` của ngôn ngữ mình và đủ bộ hreflang
 * (vi, zh-Hans, x-default = bản Việt) trỏ URL tuyệt đối của cặp trang.
 */
function verifyLocalePair(html, htmlPath, locale, routePath, site) {
  if (!html.includes(`<html lang="${HREFLANG[locale]}"`)) {
    throw new Error(`Page does not declare its language (${HREFLANG[locale]}): ${htmlPath}`);
  }
  for (const alternate of mirroredAlternates(routePath)) {
    const link = `<link rel="alternate" hreflang="${alternate.hreflang}" href="${new URL(alternate.path, site).href}">`;
    if (!html.includes(link)) throw new Error(`Page lacks its hreflang alternate ${alternate.hreflang}: ${htmlPath}`);
  }
}

/** Output cố định của blog: có kể cả khi API chưa có bài (trang danh sách rỗng, feed rỗng). */
export const BLOG_FIXED_OUTPUTS = Object.freeze([
  "bai-viet/index.html",
  "zh/bai-viet/index.html",
  "rss.xml",
  "zh/rss.xml",
  "llms.txt",
]);
/** Trang bài viết: tập bài do community API quyết định lúc build nên verifier đọc lại từ chính dist. */
const BLOG_POST_FILE = /^(zh\/)?bai-viet\/([a-z0-9][a-z0-9-]{0,100})\/index\.html$/u;

/** Mọi khối JSON-LD của trang; khối không parse được là lỗi build. */
function jsonLdBlocks(html, path) {
  return [...html.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/gu)].map(([, body]) => {
    try {
      return JSON.parse(body);
    } catch {
      throw new Error(`Blog page carries invalid JSON-LD: ${path}`);
    }
  });
}

/**
 * Blog tự nhất quán: mỗi bài có BlogPosting đúng URL/ngôn ngữ/ngày, trang danh sách liệt kê đúng tập bài
 * cùng ngôn ngữ, RSS và llms.txt nhắc đủ URL. Trả về danh sách bài cho sitemap.
 */
async function verifyBlogOutputs(distPath, postFiles, site) {
  const origin = new URL(site).origin;
  const posts = [];
  for (const file of postFiles) {
    const [, zhPrefix, slug] = file.match(BLOG_POST_FILE);
    const lang = zhPrefix ? "zh" : "vi";
    const path = `${zhPrefix ? "/zh" : ""}/bai-viet/${slug}/`;
    const url = new URL(path, origin).href;
    const html = await readFile(resolve(distPath, file), "utf8");
    const article = jsonLdBlocks(html, file).find((block) => block?.["@type"] === "BlogPosting");
    if (
      !article
      || article.url !== url
      || article.mainEntityOfPage?.["@id"] !== url
      || article.inLanguage !== (lang === "zh" ? "zh-Hans" : "vi")
      || !article.headline
      || !article.author?.name
      || !Number.isFinite(Date.parse(article.datePublished))
      || !Number.isFinite(Date.parse(article.dateModified))
    ) throw new Error(`Blog post lacks valid BlogPosting JSON-LD: ${file}`);
    if (!html.includes(`<link rel="canonical" href="${url}">`)) throw new Error(`Blog post canonical differs from its URL: ${file}`);
    // Bản dịch (nếu có) đọc từ hreflang của chính trang để sitemap tái tạo đúng cặp `xhtml:link`.
    const otherHreflang = lang === "zh" ? "vi" : "zh-Hans";
    const translationHref = html.match(new RegExp(`<link rel="alternate" hreflang="${otherHreflang}" href="([^"]+)">`, "u"))?.[1];
    const translationPath = translationHref ? new URL(translationHref).pathname : null;
    if (translationPath && !BLOG_POST_FILE.test(`${translationPath.slice(1)}index.html`)) {
      throw new Error(`Blog post hreflang points outside the blog: ${file}`);
    }
    posts.push({ path, lang, updatedAt: article.dateModified, url, translationPath });
  }
  for (const lang of ["vi", "zh"]) {
    const indexFile = lang === "zh" ? "zh/bai-viet/index.html" : "bai-viet/index.html";
    const html = await readFile(resolve(distPath, indexFile), "utf8");
    const collection = jsonLdBlocks(html, indexFile).find((block) => block?.["@type"] === "CollectionPage");
    const listed = (collection?.mainEntity?.blogPost ?? []).map((entry) => entry.url).sort();
    const expected = posts.filter((post) => post.lang === lang).map((post) => post.url).sort();
    if (!collection || JSON.stringify(listed) !== JSON.stringify(expected)) {
      throw new Error(`Blog index does not list exactly the emitted ${lang} posts: ${indexFile}`);
    }
    const feed = await readFile(resolve(distPath, lang === "zh" ? "zh/rss.xml" : "rss.xml"), "utf8");
    if (!feed.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"')) throw new Error(`Blog RSS is not an RSS 2.0 document (${lang})`);
    const feedLinks = [...feed.matchAll(/<link>([^<]*)<\/link>/gu)].map(([, link]) => link).slice(1).sort();
    if (JSON.stringify(feedLinks) !== JSON.stringify(expected)) throw new Error(`Blog RSS does not list exactly the emitted ${lang} posts`);
  }
  const llms = await readFile(resolve(distPath, "llms.txt"), "utf8");
  for (const post of posts) {
    if (!llms.includes(`](${post.url})`)) throw new Error(`llms.txt does not list blog post: ${post.url}`);
  }
  return posts;
}

/**
 * llms: mỗi file con đúng byte của hàm sinh, `/llms-full.txt` đúng bằng các file con nối theo thứ tự, `llms.txt` link tới mọi
 * file con và `llms-full.txt`, và mọi link của `llms.txt` về chính site trỏ tới file có thật trong dist.
 */
async function verifyLlmsOutputs(distPath, llms) {
  const parts = [];
  for (const file of llms.files) {
    const emitted = await readFile(resolve(distPath, file.path.slice(1)), "utf8");
    if (emitted !== file.text) throw new Error(`llms file differs from the generator: ${file.path}`);
    parts.push(emitted);
  }
  if (await readFile(resolve(distPath, llms.fullPath.slice(1)), "utf8") !== parts.join("")) {
    throw new Error("llms-full.txt is not the concatenation of the llms files in order");
  }
  const index = await readFile(resolve(distPath, "llms.txt"), "utf8");
  const origin = new URL(astroConfig.site).origin;
  for (const path of [...llms.files.map((file) => file.path), llms.fullPath]) {
    if (!index.includes(`](${origin}${path})`)) throw new Error(`llms.txt does not link ${path}`);
  }
  for (const [, href] of index.matchAll(/\]\((https?:[^)\s]+)\)/gu)) {
    const url = new URL(href);
    if (url.origin !== origin) continue;
    const file = url.pathname.endsWith("/") ? `${url.pathname.slice(1)}index.html` : url.pathname.slice(1);
    if (!(await readFile(resolve(distPath, decodeURIComponent(file))).then(() => true, () => false))) {
      throw new Error(`llms.txt links to a file that is not in dist: ${href}`);
    }
  }
}

async function listFiles(directory, base = directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`dist must not contain symlinks: ${path}`);
    if (entry.isDirectory()) files.push(...await listFiles(path, base));
    else if (entry.isFile()) files.push(relative(base, path).split(sep).join("/"));
    else throw new Error(`dist contains unsupported filesystem entry: ${path}`);
  }
  return files.sort();
}

export async function verifyAstroDist({
  projectRoot = new URL("../", import.meta.url),
  distDir = new URL("../dist/", import.meta.url),
  manifest = PUBLIC_ARTIFACTS,
  controlArtifacts = DEPLOYMENT_CONTROL_ARTIFACTS,
  staticArtifacts = STATIC_PUBLIC_ARTIFACTS,
  staticDirectories = STATIC_PUBLIC_DIRECTORIES,
} = {}) {
  validatePublicArtifactManifest(manifest);
  const rootPath = fileURLToPath(projectRoot);
  const distPath = fileURLToPath(distDir);
  const hasWebsiteDisplay = manifest.some((entry) => entry.kind === "data" && entry.routeParam === "website-display");
  const website = hasWebsiteDisplay ? await websiteDisplayPublicationSnapshot({rootDir: rootPath, manifest}) : null;
  const recommended = website?.recommended ?? await recommendedPublicationSnapshot(resolve(rootPath, "src/data/recommended-reference"));
  const catalog = await teamDetailCatalog({
    recommendedRoot: resolve(rootPath, "src/data/recommended-reference"),
    teamsPath: resolve(rootPath, "data/teams.json"),
    handlesPath: resolve(rootPath, "pipeline/team-route-handles.json"),
    // A verifier root is always explicit: the pinned Khai hoang source comes from the same root.
    khaiHoangPath: resolve(rootPath, "data/khaihoang.json"),
  });
  if (catalog.generationId !== recommended.pin.generationId) {
    throw new Error("Team detail catalog and emitted Recommended generation differ");
  }
  // Trang mùa Đội chuẩn (mùa cũ có đội) từ cùng registry đã pin; registry rỗng thì không có trang nào.
  const seasons = seasonPageCatalog(JSON.parse(Buffer.from(recommended.files["seasons.json"]).toString("utf8")), catalog);
  // Trang riêng từng mục Tra cứu: ledger đóng băng + corpus của chính gốc dự án này. Chỉ khi manifest phát cả bundle Tra cứu
  // lẫn books-dict (dist thật); fixture rút gọn không có kho Tra cứu đầy đủ nên không có trang mục.
  const hasLookupItems = ["lookup-manifest", "books-dict"].every((routeParam) =>
    manifest.some((artifact) => artifact.kind === "data" && artifact.routeParam === routeParam));
  const lookupItems = hasLookupItems ? await lookupDetailRoutes({ rootDir: rootPath, manifest }) : null;
  const lookupCorpus = hasLookupItems ? await lookupBuildCorpus({ rootDir: rootPath, manifest }) : null;
  // Bộ file llms (con + gộp) từ cùng hàm sinh với route; chỉ khi dist đầy đủ dữ liệu đội và Tra cứu (fixture rút gọn không có).
  const llms = hasWebsiteDisplay && hasLookupItems ? await llmsDocuments(astroConfig.site) : null;
  const recommendedFiles = [
    "data/recommended/current.json",
    ...Object.keys(recommended.files).map((name) => `data/recommended/${recommended.pin.generationId}/${name}`),
  ];
  const expectedAssets = manifest.map((artifact) =>
    `${artifact.kind}/${artifact.sourceBasename}`);
  // Font self-host là thư mục public tĩnh: dist phải có đúng danh sách file và đúng từng byte.
  const staticDirectoryFiles = [];
  for (const directory of staticDirectories) {
    const files = await listFiles(resolve(rootPath, directory.sourcePath));
    if (!files.length) throw new Error(`static public directory is empty: ${directory.sourcePath}`);
    for (const file of files) staticDirectoryFiles.push([`${directory.sourcePath}/${file}`, `${directory.outputPath}/${file}`]);
  }
  const sectionHtmlPaths = [...SECTION_PATHS, ...LOOKUP_GROUP_PATHS].map((path) => `${path.slice(1)}index.html`);
  // Mọi route bản Việt có bản Trung cùng đường dẫn dưới `zh/`: Landing, 8 trang mục và 3 họ trang chi tiết.
  const localizedHtml = (paths) => SITE_LOCALES.flatMap((locale) => paths.map((path) => localizedHtmlPath(path, locale)));
  const files = await listFiles(distPath);
  const blogPostFiles = files.filter((file) => BLOG_POST_FILE.test(file));
  const expectedFiles = [
    ...localizedHtml(["index.html"]),
    "404.html",
    "sitemap.xml",
    ...localizedHtml(sectionHtmlPaths),
    ...localizedHtml(STATIC_PAGE_PATHS.map((path) => `${path.slice(1)}index.html`)),
    ...localizedHtml(catalog.htmlPaths),
    ...localizedHtml(seasons.pages.map((season) => season.htmlPath)),
    ...localizedHtml((lookupItems?.entries ?? []).map((entry) => `${entry.path.slice(1)}index.html`)),
    ...COMMUNITY_PAGES.map((page) => page.htmlPath),
    ...BLOG_FIXED_OUTPUTS,
    ...(llms ? [...llms.files.map((file) => file.path.slice(1)), llms.fullPath.slice(1)] : []),
    ...blogPostFiles,
    ...expectedAssets,
    ...recommendedFiles,
    ...controlArtifacts.map((artifact) => artifact.outputPath),
    ...staticArtifacts.map((artifact) => artifact.outputPath),
    ...staticDirectoryFiles.map(([, outputPath]) => outputPath),
  ].sort();
  // Route segments may be emitted percent-encoded; identity is the decoded path.
  const decodePath = (file) => {
    try {
      return decodeURIComponent(file);
    } catch {
      return file;
    }
  };
  const emittedByDecodedPath = new Map(files.map((file) => [decodePath(file), file]));
  const unexpectedFiles = files.filter((file) => !expectedFiles.includes(decodePath(file)));
  const missingFiles = expectedFiles.filter((file) => !emittedByDecodedPath.has(file));
  if (unexpectedFiles.length || missingFiles.length) {
    throw new Error(
      `dist allowlist mismatch; unexpected: ${unexpectedFiles.join(", ") || "none"}; missing: ${missingFiles.join(", ") || "none"}`,
    );
  }
  if (emittedByDecodedPath.size !== files.length) throw new Error("dist contains colliding team detail paths");

  const blogPosts = await verifyBlogOutputs(distPath, blogPostFiles, astroConfig.site);
  if (llms) await verifyLlmsOutputs(distPath, llms);

  // Byte equality with the build-owned generator enforces valid structure, exact absolute
  // origins, and the absence of query/hash drift without maintaining a second XML parser.
  const sitemapXml = await readFile(resolve(distPath, "sitemap.xml"), "utf8");
  const detailRoutePaths = [
    ...[...catalog.recommended, ...catalog.legacy, ...catalog.khaiHoang].map((entry) => entry.routePath),
    ...(lookupItems?.entries ?? []).map((entry) => entry.path),
    ...seasons.pages.map((season) => season.routePath),
  ];
  const sitemapRoutePaths = [
    ...mirroredSitemapRoutes(mirroredSitemapPaths(detailRoutePaths)),
    ...blogSitemapRoutes(blogPosts),
  ];
  const expectedSitemapXml = sitemapDocument(astroConfig.site, sitemapRoutePaths);
  if (sitemapXml !== expectedSitemapXml) {
    throw new Error("dist sitemap.xml does not match the generated document");
  }

  for (const artifact of manifest) {
    const relativePath = `${artifact.kind}/${artifact.sourceBasename}`;
    const [sourceBytes, emittedBytes] = await Promise.all([
      readFile(resolve(rootPath, relativePath)),
      readFile(resolve(distPath, relativePath)),
    ]);
    if (!sourceBytes.equals(emittedBytes)) {
      throw new Error(`Emitted artifact bytes differ from source: ${relativePath}`);
    }
  }

  const currentOutput = await readFile(resolve(distPath, "data/recommended/current.json"));
  if (!currentOutput.equals(recommended.currentBytes)) {
    throw new Error("Emitted Recommended current selector differs from source");
  }
  for (const [name, bytes] of Object.entries(recommended.files)) {
    const emitted = await readFile(resolve(distPath, `data/recommended/${recommended.pin.generationId}/${name}`));
    if (!emitted.equals(bytes)) throw new Error(`Emitted Recommended artifact differs from source: ${name}`);
  }
  // Landing chỉ có script chuyển tiếp hash cũ; mọi payload của app.js thuộc về 8 trang mục.
  const readPage = async (decodedPath) => readFile(resolve(distPath, emittedByDecodedPath.get(decodedPath)), "utf8");
  const site = astroConfig.site;
  for (const locale of SITE_LOCALES) {
    const landingPath = localizedHtmlPath("index.html", locale);
    const landing = await readPage(landingPath);
    for (const forbidden of ['id="team-route-handles"', 'id="season-artifact-hashes"', 'id="season-controls"', 'src="/js/app.js"']) {
      if (landing.includes(forbidden)) throw new Error(`Landing must not carry the section payload: ${forbidden} (${landingPath})`);
    }
    verifyLocalePair(landing, landingPath, locale, "/", site);
  }
  // Hash cũ chỉ tồn tại ở URL bản Việt (trước khi có bản Trung).
  if (!(await readPage("index.html")).includes('id="legacy-route-redirect"')) throw new Error("Landing lacks the inline legacy route redirect");
  const expectedRegistry = {
    r: Object.fromEntries(catalog.recommended.map((entry) => [entry.sourceConfigId, entry.routeSegment])),
    l: Object.fromEntries(catalog.legacy.map((entry) => [entry.legacyTeamId, entry.routeSegment])),
    k: Object.fromEntries(catalog.khaiHoang.map((entry) => [entry.khaiHoangTeamId, entry.handle])),
  };
  // Bảng payload của phase: mọi trang có app nhận `{r,l,k}`; chỉ 3 trang có phạm vi mùa.
  const SEASON_SECTION_PATHS = new Set(["/doi-chuan/", "/doi-khac/", "/cung-ton/"]);
  const seasonHashesMarkers = [];
  for (const [locale, sectionPath] of SITE_LOCALES.flatMap((locale) => APP_PAGE_PATHS.map((path) => [locale, path]))) {
    const htmlPath = localizedHtmlPath(`${sectionPath.slice(1)}index.html`, locale);
    const season = SEASON_SECTION_PATHS.has(sectionPath);
    const page = await readPage(htmlPath);
    verifyLocalePair(page, htmlPath, locale, sectionPath, site);
    if (!page.includes('src="/js/app.js"')) throw new Error(`Section page does not load the section application: ${htmlPath}`);
    const pageSection = page.match(/<body[^>]*\bdata-page-section="([a-z-]+)"/);
    if (!pageSection) throw new Error(`Section page does not declare its page section: ${htmlPath}`);
    if (!page.includes(`id="section-${pageSection[1]}"`)) throw new Error(`Section page lacks its own mount: ${htmlPath}`);
    const prerenderedMarkers = PRERENDERED_TEAM_MARKERS[pageSection[1]];
    if (prerenderedMarkers) {
      for (const marker of prerenderedMarkers) {
        if (!page.includes(marker)) throw new Error(`Team section page lacks its prerendered default content (${marker}): ${htmlPath}`);
      }
      if ((page.match(/<h1\b/gu) ?? []).length !== 1) throw new Error(`Team section page must carry exactly one h1: ${htmlPath}`);
      // Chữ người đọc thấy: bỏ chú thích HTML và script (chú thích của footer nhắc JavaScript cho nút hộp thoại).
      if (WAITING_OR_JS_REQUIRED.test(page.replace(/<!--[^]*?-->/gu, "").replace(/<script\b[^]*?<\/script>/gu, ""))) {
        throw new Error(`Team section page must not carry waiting or JavaScript-required text: ${htmlPath}`);
      }
      // Trình duyệt chỉ nhận lại DOM dựng sẵn khi nó dựng từ đúng publication đã pin trên trang.
      if (website && !page.includes(`data-ssr-source="${website.pin.sha256}"`)) {
        throw new Error(`Team section page prerendered content is not tied to the website display publication: ${htmlPath}`);
      }
    }
    const registryMatch = page.match(/id="team-route-handles"[^>]*>([^<]+)<\/script>/);
    if (!registryMatch) throw new Error(`Section page lacks the team route handle registry: ${htmlPath}`);
    if (JSON.stringify(JSON.parse(registryMatch[1])) !== JSON.stringify(expectedRegistry)) {
      throw new Error(`Section page team route handle registry differs from the catalog: ${htmlPath}`);
    }
    // Ngoại lệ slug Tra cứu (quy tắc: slug = hậu tố mã) mà trình duyệt dùng dựng link trùng với HTML dựng sẵn.
    if (lookupItems) {
      const exceptions = page.match(/id="lookup-route-handles"[^>]*>([^<]+)<\/script>/)?.[1];
      if (!exceptions || JSON.stringify(JSON.parse(exceptions)) !== JSON.stringify(lookupItems.exceptions)) {
        throw new Error(`Section page lookup route exceptions differ from the ledger: ${htmlPath}`);
      }
    }
    const embedded = page.match(/id="recommended-publication"[^>]*>([^<]+)<\/script>/);
    if (!embedded) throw new Error(`Section page lacks the Recommended publication pin: ${htmlPath}`);
    const embeddedPin = JSON.parse(embedded[1]);
    if (
      embeddedPin.schemaVersion !== recommended.pin.schemaVersion
      || embeddedPin.generationId !== recommended.pin.generationId
      || embeddedPin.manifestSha256 !== recommended.pin.manifestSha256
    ) throw new Error(`Section page Recommended pin differs from emitted generation: ${htmlPath}`);
    if (website) {
      const embeddedWebsite = page.match(/id="website-display-publication"[^>]*>([^<]+)<\/script>/);
      if (!embeddedWebsite || JSON.stringify(JSON.parse(embeddedWebsite[1])) !== JSON.stringify(website.pin)) {
        throw new Error(`Section page lacks the website display publication pin: ${htmlPath}`);
      }
    }
    const seasonMarker = page.match(/id="season-artifact-hashes"[^>]*>([^<]+)<\/script>/);
    if (season && !seasonMarker) throw new Error(`Season section page lacks its season artifact hashes: ${htmlPath}`);
    if (season && !page.includes('id="season-controls"')) throw new Error(`Season section page lacks its season controls mount: ${htmlPath}`);
    if (!season && seasonMarker) throw new Error(`Section page must not carry season artifact hashes: ${htmlPath}`);
    if (!season && page.includes('id="season-controls"')) throw new Error(`Section page must not carry a season controls mount: ${htmlPath}`);
    if (seasonMarker) seasonHashesMarkers.push(JSON.parse(seasonMarker[1]));
    // Trang nhóm Tra cứu: khai nhóm cho app.js, lưới trang đầu dựng sẵn, pin binh thư chỉ ở trang Binh thư.
    if (LOOKUP_GROUP_PATHS.includes(sectionPath)) {
      const group = Object.keys(LOOKUP_GROUP_SLUGS).find((key) => `/tra-cuu/${LOOKUP_GROUP_SLUGS[key]}/` === sectionPath);
      if (!page.includes(`data-lookup-group="${group}"`)) throw new Error(`Lookup group page does not declare its group: ${htmlPath}`);
      if (!page.includes("data-lookup-id=")) throw new Error(`Lookup group page lacks its prerendered first page: ${htmlPath}`);
      if (lookupCorpus) {
        // Trang nhóm dựng sẵn ĐÚNG tập mục của nhóm (client chỉ ẩn/hiện), không thiếu cũng không lặp.
        const rendered = [...page.matchAll(/data-lookup-id="([^"]+)"/gu)].map((match) => match[1]).sort();
        const expected = lookupCorpus.groups[group].map((row) => row.id).sort();
        if (rendered.length !== expected.length || rendered.some((id, index) => id !== expected[index])) {
          const have = new Set(rendered);
          const want = new Set(expected);
          const missing = expected.filter((id) => !have.has(id));
          const extra = rendered.filter((id, index) => !want.has(id) || rendered[index - 1] === id);
          throw new Error(`Lookup group page must prerender every item exactly once (${rendered.length}/${expected.length}; missing ${JSON.stringify(missing.slice(0, 3))}, extra ${JSON.stringify(extra.slice(0, 3))}): ${htmlPath}`);
        }
      }
      if ((group === "books") !== page.includes('id="lookup-books-hash"')) {
        throw new Error(`Only the Binh thư page carries the books-dict pin: ${htmlPath}`);
      }
    }
  }

  // Mục lục Tra cứu: canonical chính nó, chuyển tiếp link cũ bằng script inline, link tới đủ 7 trang nhóm, không nạp app.
  for (const locale of SITE_LOCALES) {
    const htmlPath = localizedHtmlPath(`${LOOKUP_HUB_PATH.slice(1)}index.html`, locale);
    const page = await readPage(htmlPath);
    verifyLocalePair(page, htmlPath, locale, LOOKUP_HUB_PATH, site);
    if (page.includes('src="/js/app.js"')) throw new Error(`Lookup hub must not boot the root application: ${htmlPath}`);
    if (!page.includes('id="lookup-hub-redirect"')) throw new Error(`Lookup hub lacks its legacy query redirect: ${htmlPath}`);
    for (const groupPath of LOOKUP_GROUP_PATHS) {
      const href = locale === "zh" ? `/zh${groupPath}` : groupPath;
      if (!page.includes(`class="lookup-hub-card" href="${href}"`)) throw new Error(`Lookup hub lacks its card for ${href}: ${htmlPath}`);
    }
  }

  // Trang riêng từng mục Tra cứu: hồ sơ dựng sẵn, canonical + hreflang của chính nó, title/description duy nhất, một h1.
  if (lookupItems) {
    const seen = { title: new Map(), description: new Map() };
    for (const entry of lookupItems.entries) {
      for (const locale of SITE_LOCALES) {
        const htmlPath = localizedHtmlPath(`${entry.path.slice(1)}index.html`, locale);
        const page = await readPage(htmlPath);
        verifyLocalePair(page, htmlPath, locale, entry.path, site);
        const canonical = new URL(locale === "zh" ? `/zh${entry.path}` : entry.path, site).href;
        if (!page.includes(`<link rel="canonical" href="${canonical}">`)) throw new Error(`Lookup item page lacks its own canonical URL: ${htmlPath}`);
        for (const [kind, pattern] of [["title", /<title>([^<]*)<\/title>/u], ["description", /<meta name="description" content="([^"]*)"/u]]) {
          const value = page.match(pattern)?.[1];
          if (!value) throw new Error(`Lookup item page lacks its ${kind}: ${htmlPath}`);
          if (kind === "description" && /[:：]$/u.test(value.trim())) throw new Error(`Lookup item page description ends with a dangling colon: ${htmlPath}`);
          const key = `${locale}\u0000${value}`;
          if (seen[kind].has(key)) throw new Error(`Lookup item pages share a ${kind}: ${htmlPath} and ${seen[kind].get(key)}`);
          seen[kind].set(key, htmlPath);
        }
        if ((page.match(/<h1\b/gu) ?? []).length !== 1) throw new Error(`Lookup item page must carry exactly one h1: ${htmlPath}`);
        // Link dựng sẵn lúc build, script riêng không đọc bảng route nào: bảng ≈4.9 KB × 1772 trang không được nhúng.
        for (const table of ['id="team-route-handles"', 'id="lookup-route-handles"']) {
          if (page.includes(table)) throw new Error(`Lookup item page must not embed the route table (${table}): ${htmlPath}`);
        }
        if (page.includes('src="/js/app.js"') || !page.includes('src="/js/lookup-item-page.js"')) {
          throw new Error(`Lookup item page must load only its own script: ${htmlPath}`);
        }
        if (!page.includes(`data-lookup-item="${entry.id}"`) && !page.includes(`data-lookup-detail="${entry.id}"`)) {
          throw new Error(`Lookup item page lacks its prerendered profile (${entry.id}): ${htmlPath}`);
        }
        const groupHref = locale === "zh" ? `/zh${lookupGroupPath(entry.group)}` : lookupGroupPath(entry.group);
        if (!page.includes(`class="detail-link detail-back-link" href="${groupHref}"`)) {
          throw new Error(`Lookup item page lacks its link back to the group page: ${htmlPath}`);
        }
        if (WAITING_OR_JS_REQUIRED.test(page.replace(/<!--[^]*?-->/gu, "").replace(/<script\b[^]*?<\/script>/gu, ""))) {
          throw new Error(`Lookup item page must not carry waiting or JavaScript-required text: ${htmlPath}`);
        }
      }
    }
  }

  // Trang nội dung tĩnh (chính sách bảo mật): được index, canonical chính URL của mình, không nạp app gốc.
  for (const [locale, staticPath] of SITE_LOCALES.flatMap((locale) => STATIC_PAGE_PATHS.map((path) => [locale, path]))) {
    const htmlPath = localizedHtmlPath(`${staticPath.slice(1)}index.html`, locale);
    const page = await readPage(htmlPath);
    verifyLocalePair(page, htmlPath, locale, staticPath, site);
    const canonical = new URL(locale === "zh" ? `/zh${staticPath}` : staticPath, site).href;
    if (!page.includes(`<link rel="canonical" href="${canonical}">`)) {
      throw new Error(`Static page lacks its own canonical URL: ${htmlPath}`);
    }
    if (/<meta\b(?=[^>]*\bname=["']robots["'])(?=[^>]*\bnoindex)[^>]*>/iu.test(page)) {
      throw new Error(`Static page must stay indexable: ${htmlPath}`);
    }
    if (page.includes('src="/js/app.js"')) throw new Error(`Static page must not boot the root application: ${htmlPath}`);
  }

  // Mỗi trang chi tiết phải pin đúng identity đã validate, và không nạp app gốc.
  const familyPages = [
    ...catalog.recommended.map((entry) => ({
      path: entry.htmlPath,
      routePath: entry.routePath,
      entry: "/js/team-detail.js",
      pins: [
        `data-source-config-id="${entry.sourceConfigId}"`,
        `data-scope-key="${entry.safeScopeKey}"`,
        `data-generation-id="${catalog.generationId}"`,
        `data-manifest-sha256="${catalog.manifestSha256}"`,
      ],
    })),
    ...catalog.legacy.map((entry) => ({
      path: entry.htmlPath,
      routePath: entry.routePath,
      entry: "/js/team-detail.js",
      pins: [
        `data-legacy-team-id="${entry.legacyTeamId}"`,
        `data-legacy-teams-sha256="${catalog.legacyTeamsSha256}"`,
        `data-generation-id="${catalog.generationId}"`,
        `data-manifest-sha256="${catalog.manifestSha256}"`,
      ],
    })),
    ...catalog.khaiHoang.map((entry) => ({
      path: entry.htmlPath,
      routePath: entry.routePath,
      entry: "/js/khaihoang-detail.js",
      pins: [
        `data-family="khaihoang"`,
        `data-khaihoang-team-id="${entry.khaiHoangTeamId}"`,
        `data-khaihoang-sha256="${catalog.khaiHoangSha256}"`,
      ],
    })),
  ];
  // Bản Trung của mỗi trang chi tiết pin đúng cùng identity; tiêu đề/meta khác ngôn ngữ nên cũng không được trùng.
  const pages = SITE_LOCALES.flatMap((locale) => familyPages.map((page) => ({ ...page, locale, path: localizedHtmlPath(page.path, locale) })));
  // Tab và kết quả tìm kiếm chỉ phân biệt được trang chi tiết qua <title>/meta description: không trùng nhau.
  const detailHeads = { "<title>": new Map(), "meta description": new Map() };
  const claimHead = (kind, value, path) => {
    if (value === null) return;
    const owner = detailHeads[kind].get(value);
    if (owner) throw new Error(`Team detail pages share a duplicate ${kind}: ${value} (${owner}, ${path})`);
    detailHeads[kind].set(value, path);
  };
  for (let start = 0; start < pages.length; start += 64) {
    const loaded = await Promise.all(pages.slice(start, start + 64).map(async ({ path, routePath, locale, entry, pins }) => {
      const page = await readPage(path);
      claimHead("<title>", page.match(/<title>([^<]*)<\/title>/u)?.[1] ?? null, path);
      claimHead("meta description", page.match(/<meta\b(?=[^>]*\bname=["']description["'])[^>]*\bcontent="([^"]*)"/u)?.[1] ?? null, path);
      return { path, routePath, locale, entry, pins, page };
    }));
    for (const { path, routePath, locale, entry, pins, page } of loaded) {
      verifyLocalePair(page, path, locale, routePath, site);
      for (const pin of pins) {
        if (!page.includes(pin)) throw new Error(`Team detail page lacks its validated pin: ${path} (${pin})`);
      }
      if (!page.includes(`src="${entry}"`)) {
        throw new Error(`Team detail page does not load its own entry: ${path} (${entry})`);
      }
      if (website) {
        const pageWebsite = page.match(/id="website-display-publication"[^>]*>([^<]+)<\/script>/);
        if (!pageWebsite || JSON.stringify(JSON.parse(pageWebsite[1])) !== JSON.stringify(website.pin)) {
          throw new Error(`Team detail page lacks the website display publication pin: ${path}`);
        }
      }
      if (page.includes('src="/js/app.js"')) throw new Error(`Team detail page boots the root application: ${path}`);
      // Thân dựng sẵn lúc build: có nội dung ngay trong HTML, không trạng thái chờ và không đòi JavaScript.
      const article = page.match(/<article\b[^>]*\bid="team-detail-root"[^]*?<\/article>/u)?.[0] ?? "";
      const body = article.match(/<div\b[^>]*\bid="team-detail-body"[^>]*>/u)?.[0] ?? "";
      if (!body.includes("data-prerendered") || /\bhidden\b/u.test(body) || !/<h2\b/u.test(article)) {
        throw new Error(`Team detail page lacks its prerendered body: ${path}`);
      }
      if (article.includes('id="team-detail-status"') || WAITING_OR_JS_REQUIRED.test(article)) {
        throw new Error(`Team detail page carries a waiting or JavaScript-required state: ${path}`);
      }
      if (!page.includes('id="community-root"') || !page.includes('src="/js/community-page.js"')) {
        throw new Error(`Team detail page lacks its community section: ${path}`);
      }
    }
  }
  // Trang mùa Đội chuẩn: tĩnh, đủ N đội, canonical + hreflang của chính nó, title/description không trùng (S3 và PK-S7 cùng tên Việt),
  // không khung comment và không nạp app (trang mùa không thuộc `PAGE_KEY_PATTERN` của khung comment).
  for (const season of seasons.pages) {
    for (const locale of SITE_LOCALES) {
      const htmlPath = localizedHtmlPath(season.htmlPath, locale);
      const page = await readPage(htmlPath);
      verifyLocalePair(page, htmlPath, locale, season.routePath, site);
      const canonical = new URL(locale === "zh" ? `/zh${season.routePath}` : season.routePath, site).href;
      if (!page.includes(`<link rel="canonical" href="${canonical}">`)) throw new Error(`Season page lacks its own canonical URL: ${htmlPath}`);
      claimHead("<title>", page.match(/<title>([^<]*)<\/title>/u)?.[1] ?? null, htmlPath);
      claimHead("meta description", page.match(/<meta\b(?=[^>]*\bname=["']description["'])[^>]*\bcontent="([^"]*)"/u)?.[1] ?? null, htmlPath);
      if ((page.match(/<h1\b/gu) ?? []).length !== 1) throw new Error(`Season page must carry exactly one h1: ${htmlPath}`);
      if (!page.includes(season.displayCode)) throw new Error(`Season page lacks its season code (${season.displayCode}): ${htmlPath}`);
      const cards = (page.match(/data-reference-key="/gu) ?? []).length;
      if (cards !== season.count) throw new Error(`Season page must prerender every team (${cards}/${season.count}): ${htmlPath}`);
      if ((page.match(/\bdata-team-detail-link\b/gu) ?? []).length < season.count) throw new Error(`Season page lacks a detail link for every team: ${htmlPath}`);
      if (page.includes('id="community-root"') || page.includes("community-page.js") || page.includes('src="/js/app.js"')) {
        throw new Error(`Season page must not carry the community section or boot an application: ${htmlPath}`);
      }
      if (WAITING_OR_JS_REQUIRED.test(page.replace(/<!--[^]*?-->/gu, "").replace(/<script\b[^]*?<\/script>/gu, ""))) {
        throw new Error(`Season page must not carry waiting or JavaScript-required text: ${htmlPath}`);
      }
      if (website && !page.includes(`data-ssr-source="${website.pin.sha256}"`)) {
        throw new Error(`Season page prerendered content is not tied to the website display publication: ${htmlPath}`);
      }
    }
  }
  // `/doi-chuan/` liệt kê mọi trang mùa bằng <a href> thật, ngoài vùng client thay thế (`#section-team-chuan`).
  for (const locale of SITE_LOCALES) {
    const htmlPath = localizedHtmlPath("doi-chuan/index.html", locale);
    const page = await readPage(htmlPath);
    const block = page.match(/<nav\b[^>]*\bdata-other-seasons\b[^]*?<\/nav>/u)?.[0] ?? null;
    if (!seasons.pages.length) {
      if (block) throw new Error(`Section page lists other seasons but no season page exists: ${htmlPath}`);
      continue;
    }
    if (!block) throw new Error(`Section page lacks its other-seasons block: ${htmlPath}`);
    for (const season of seasons.pages) {
      const href = locale === "zh" ? `/zh${season.routePath}` : season.routePath;
      if (!block.includes(`<a href="${href}"`)) throw new Error(`Other-seasons block lacks its link ${href}: ${htmlPath}`);
    }
    const mount = page.match(/<section\b[^>]*\bid="section-team-chuan"[^]*?<\/section>/u)?.[0] ?? "";
    if (!mount || mount.includes("data-other-seasons")) throw new Error(`Other-seasons block must sit outside the client-replaced mount: ${htmlPath}`);
  }
  const notFound = await readPage("404.html");
  if (!notFound.includes('id="not-found-title"')) throw new Error("Static 404 page lacks its not-found heading");
  // Pages chỉ phục vụ một 404.html: khối tiếng Trung dựng sẵn, script chọn nó cho đường dẫn dưới /zh/.
  if (!notFound.includes('data-not-found="zh"') || !notFound.includes('id="not-found-locale"')) {
    throw new Error("Static 404 page lacks its Chinese block for /zh/ paths");
  }
  if (notFound.includes('src="/js/app.js"') || notFound.includes('src="/js/team-detail.js"') || notFound.includes('src="/js/khaihoang-detail.js"')) {
    throw new Error("Static 404 page must not boot application entries");
  }
  if (!/<meta\b(?=[^>]*\bname=["']robots["'])(?=[^>]*\bcontent=["']noindex["'])[^>]*>/iu.test(notFound)) {
    throw new Error("Static 404 page must declare robots=noindex");
  }
  if (/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/iu.test(notFound)) {
    throw new Error("Static 404 page must not declare a canonical URL");
  }
  if (/<meta\b(?=[^>]*\bproperty=["']og:url["'])[^>]*>/iu.test(notFound)) {
    throw new Error("Static 404 page must not declare og:url");
  }
  for (const { htmlPath, mount, entry } of COMMUNITY_PAGES) {
    const page = await readPage(htmlPath);
    if (!page.includes(mount) || !page.includes(`src="${entry}"`)) {
      throw new Error(`Community page lacks its mount or entry: ${htmlPath}`);
    }
    if (!/<meta\b(?=[^>]*\bname=["']robots["'])(?=[^>]*\bcontent=["']noindex["'])[^>]*>/iu.test(page)) {
      throw new Error(`Community page must declare robots=noindex: ${htmlPath}`);
    }
    if (/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/iu.test(page) || page.includes('src="/js/app.js"')) {
      throw new Error(`Community page must not declare a canonical URL or boot the root application: ${htmlPath}`);
    }
  }
  let lookupGenerationId = null;
  const lookupRoutes = new Set(manifest.filter((artifact) => artifact.kind === "data").map((artifact) => artifact.routeParam));
  if (lookupRoutes.has("lookup-manifest")) {
    let lookupManifest;
    try {
      lookupManifest = JSON.parse(await readFile(resolve(distPath, "data/lookup-manifest.json"), "utf8"));
    } catch {
      throw new Error("Emitted lookup manifest is invalid");
    }
    const payloadNames = ["heroes-dict.json", "tactics.json", "lookup-catalog.json"];
    if (
      lookupManifest?.schemaVersion !== 1
      || Object.keys(lookupManifest.files ?? {}).sort().join(",") !== [...payloadNames].sort().join(",")
    ) throw new Error("Emitted lookup manifest shape is invalid");
    for (const name of payloadNames) {
      const bytes = await readFile(resolve(distPath, `data/${name}`));
      const actual = createHash("sha256").update(bytes).digest("hex");
      if (lookupManifest.files[name] !== actual) throw new Error(`Emitted ${name} leaves lookup manifest generation`);
    }
    const ordered = Object.fromEntries(Object.keys(lookupManifest.files).sort().map((name) => [name, lookupManifest.files[name]]));
    const derived = "lookup:" + createHash("sha256").update(`${JSON.stringify(ordered)}\n`).digest("hex");
    if (lookupManifest.generationId !== derived) throw new Error("Emitted lookup generation is invalid");
    if (!seasonHashesMarkers.length) throw new Error("No section page carries the season-artifact-hashes generation pin");
    for (const seasonHashes of seasonHashesMarkers) {
      for (const name of ["heroes-dict", "tactics"]) {
        if (seasonHashes[name] !== `sha256:${lookupManifest.files[`${name}.json`]}`) {
          throw new Error("Built HTML season-artifact-hashes differs from lookup generation");
        }
      }
    }
    // Tham chiếu chéo giữa ba payload chỉ kiểm được trên trọn bộ: trình duyệt chỉ kiểm từng payload của trang.
    const rawFiles = Object.fromEntries(await Promise.all(payloadNames.map(async (name) => [name, new Uint8Array(await readFile(resolve(distPath, `data/${name}`)))])));
    try {
      await validateLookupBundle(lookupManifest, rawFiles);
    } catch (error) {
      throw new Error(`Emitted lookup bundle is invalid: ${error.message}`);
    }
    lookupGenerationId = lookupManifest.generationId;
  }

  for (const artifact of [...controlArtifacts, ...staticArtifacts]) {
    const [sourceBytes, emittedBytes] = await Promise.all([
      readFile(resolve(rootPath, artifact.sourcePath)),
      readFile(resolve(distPath, artifact.outputPath)),
    ]);
    if (!sourceBytes.equals(emittedBytes)) {
      throw new Error(`Deployment control artifact bytes differ from source: ${artifact.outputPath}`);
    }
  }

  // Mùa hiện tại không có trang: slug cũ của nó phải 301 về danh sách (luật sinh bởi pipeline/lookup_route_handles.py).
  const redirects = (await readFile(resolve(distPath, "_redirects"), "utf8")).split("\n");
  for (const rule of seasonRedirectRules(seasons)) {
    if (!redirects.includes(`${rule.from} ${rule.to} ${rule.status}`)) throw new Error(`dist _redirects lacks the current-season rule: ${rule.from}`);
  }

  for (const [sourcePath, outputPath] of staticDirectoryFiles) {
    const [sourceBytes, emittedBytes] = await Promise.all([
      readFile(resolve(rootPath, sourcePath)),
      readFile(resolve(distPath, outputPath)),
    ]);
    if (!sourceBytes.equals(emittedBytes)) {
      throw new Error(`Static public file bytes differ from source: ${outputPath}`);
    }
  }

  const forbiddenSegments = new Set([
    "pipeline",
    "worker",
    "tests",
    "tests-js",
    "tests-e2e",
    "plans",
    ".git",
  ]);
  for (const file of files) {
    if (file.split("/").some((segment) => forbiddenSegments.has(segment))) {
      throw new Error(`Private source path entered dist: ${file}`);
    }
    if (/(^|\/)(\.env|.*\.(pem|key|p12))$/i.test(file)) {
      throw new Error(`Secret-like file entered dist: ${file}`);
    }
  }

  return {
    assetCount: manifest.length,
    staticFileCount: staticDirectoryFiles.length,
    files,
    unexpectedFiles,
    missingFiles,
    lookupGenerationId,
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  const result = await verifyAstroDist();
  console.log(`Verified ${result.files.length} dist files (${result.assetCount} raw assets, ${result.staticFileCount} static public files).`);
}
