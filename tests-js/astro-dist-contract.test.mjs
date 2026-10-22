import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import vm from "node:vm";
import {
  PUBLIC_ARTIFACTS,
  artifactEntriesFor,
  validatePublicArtifactManifest,
} from "../src/lib/public-artifact-manifest.mjs";
import {
  lookupPublicationSnapshot,
  readPublicArtifact,
  seasonArtifactHashes,
  validatePublicArtifactTree,
  websiteDisplayPublicationSnapshot,
} from "../src/lib/root-static-artifacts.ts";
import { teamDetailCatalog } from "../src/lib/team-detail-routes.ts";
import { lookupDetailRoutes } from "../src/lib/lookup-detail-routes.ts";
import { lookupBuildCorpus } from "../src/lib/lookup-pages.ts";
import { effectVersions, lookupDisplayName } from "../js/lookup-detail.js";
import {
  GET as sitemapGet,
  SITEMAP_MIME,
  sitemapDocument,
  sitemapLocations,
  blogSitemapRoutes,
  mirroredSitemapPaths,
  mirroredSitemapRoutes,
} from "../src/pages/sitemap.xml.ts";
import { COMMUNITY_PAGES, verifyAstroDist } from "../scripts/verify-astro-dist.mjs";
import { jsonLd } from "../src/lib/blog-posts.ts";
import { articleJsonLd, blogIndexJsonLd, llmsDocument, rssDocument } from "../src/lib/blog-seo.ts";
import { assertFrontendShellContract } from "./frontend-shell-contract-assertions.mjs";
import { catalogDoc, heroesDoc, tacticsDoc } from "./fixtures/lookup-bundle-fixtures.mjs";

const projectRoot = new URL("../", import.meta.url);

const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value)}\n`);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const LEGACY_TEAM_ID = "team-intro-0";
const LEGACY_HANDLE = "vinh-quang-thuong";
const LEGACY_ROUTE_SEGMENT = LEGACY_HANDLE;

const KHAIHOANG_TEAM_ID = "gia-cat-khac-sp-ma-sieu-phap-chinh";
const KHAIHOANG_HANDLE = KHAIHOANG_TEAM_ID;
const KHAIHOANG_ROUTE_SEGMENT = KHAIHOANG_HANDLE;
const KHAIHOANG_TITLE = "Gia Cát Khác · SP Mã Siêu · Pháp Chính";

const FIXTURE_ORIGIN = "https://tqccl.com";

/**
 * The fixture dist mirrors the built sitemap: the root page plus every catalog route, XML-escaped. Một mục là
 * URL trần hoặc `{loc, pair: [viHref, zhHref]}` — trang có bản gương khai ba `xhtml:link` (vi, zh-Hans, x-default).
 */
const fixtureSitemapXml = (entries) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.map((entry) => {
  const { loc, pair } = typeof entry === "string" ? { loc: entry, pair: null } : entry;
  const links = pair
    ? [["vi", pair[0]], ["zh-Hans", pair[1]], ["x-default", pair[0]]]
      .map(([lang, href]) => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${href}"/>\n`).join("")
    : "";
  return `  <url>\n    <loc>${loc}</loc>\n${links}  </url>`;
}).join("\n")}
</urlset>
`;

/** Bản Việt của một đường dẫn và bản Trung dưới `/zh`. */
const zhPathOf = (viPath) => (viPath === "/" ? "/zh/" : `/zh${viPath}`);

/** Cặp mục sitemap (vi + zh) của một route có bản gương; `/` (Landing) được xếp riêng ở đầu. */
const mirroredEntries = (viPaths) => viPaths.flatMap((viPath) => {
  const pair = [`${FIXTURE_ORIGIN}${viPath}`, `${FIXTURE_ORIGIN}${zhPathOf(viPath)}`];
  return [{ loc: pair[0], pair }, { loc: pair[1], pair }];
});

/** Sitemap như generator phát: root trước, rồi mọi mục còn lại theo thứ tự URL. */
const orderedSitemap = (entries) => {
  const locOf = (entry) => (typeof entry === "string" ? entry : entry.loc);
  const root = entries.filter((entry) => locOf(entry) === `${FIXTURE_ORIGIN}/`);
  const rest = entries.filter((entry) => locOf(entry) !== `${FIXTURE_ORIGIN}/`).sort((a, b) => (locOf(a) < locOf(b) ? -1 : 1));
  return fixtureSitemapXml([...root, ...rest]);
};

/** `<html lang>` và bộ hreflang mà verifier đòi ở mọi trang có bản gương. */
const pairHead = (locale, viPath) => [
  `<html lang="${locale === "zh" ? "zh-Hans" : "vi"}">`,
  `<link rel="alternate" hreflang="vi" href="${FIXTURE_ORIGIN}${viPath}">`,
  `<link rel="alternate" hreflang="zh-Hans" href="${FIXTURE_ORIGIN}${zhPathOf(viPath)}">`,
  `<link rel="alternate" hreflang="x-default" href="${FIXTURE_ORIGIN}${viPath}">`,
].join("");

const FIXTURE_ROBOTS = `User-agent: *\nAllow: /\n\nSitemap: ${FIXTURE_ORIGIN}/sitemap.xml\n`;

const FIXTURE_HEADERS = "/\n  Cache-Control: max-age=0\n";
const FIXTURE_REDIRECTS = "/tra-cuu/chien-phap/cu/ /tra-cuu/chien-phap/moi/ 301\n";

/** Output blog đúng như build sinh ra từ một tập bài (rỗng khi không có API). */
async function writeBlogOutputs(distDir, posts = []) {
  for (const lang of ["vi", "zh"]) {
    const prefix = lang === "zh" ? join(distDir, "zh") : distDir;
    const own = posts.filter((post) => post.lang === lang);
    await mkdir(join(prefix, "bai-viet"), { recursive: true });
    await writeFile(
      join(prefix, "bai-viet", "index.html"),
      `<!doctype html><script type="application/ld+json">${jsonLd(blogIndexJsonLd(lang, own, FIXTURE_ORIGIN))}</script>\n`,
    );
    await writeFile(join(prefix, "rss.xml"), rssDocument(lang, own, FIXTURE_ORIGIN));
  }
  await writeFile(join(distDir, "llms.txt"), llmsDocument(posts, FIXTURE_ORIGIN, { files: [], full: "", fullPath: "/llms-full.txt", groups: [] }));
}

/** Tám trang mục tĩnh của mô hình đường dẫn mới; 5 trang đầu có phạm vi mùa. `/tra-cuu/` là mục lục tĩnh (không app). */
const SECTION_PAGE_SPECS = [
  { path: "doi-chuan", section: "team-chuan", season: true },
  { path: "doi-khac", section: "team-khac", season: true },
  { path: "cung-ton", section: "coexist", season: true },
  { path: "khai-hoang", section: "khaihoang", season: false },
  { path: "tra-cuu", section: "lookup", season: false, hub: true },
  { path: "theo-doi-chieu-mo", section: "recruit-tracker", season: false },
  { path: "soi-doi-tu-anh", section: "analyze", season: false },
  { path: "goi-y-doi-tu-kho", section: "roster-recommend", season: false },
];
/** Bảy trang nhóm Tra cứu (URL công khai), mỗi trang nạp app.js với nhóm của nó. */
const LOOKUP_GROUP_SPECS = [
  ["tuong", "heroes", "hero:luu-bi"],
  ["chien-phap", "tactics", "tactic:phong-thi-tran"],
  ["trang-bi", "equipment", "equipment:thanh-long-dao"],
  ["quan-su", "advisors", "advisor:tuan-uc"],
  ["cai-tao-binh-chung", "troop-mods", "troop-mod:ho-bao-ky"],
  ["cong-trinh", "buildings", "building:thai-hoc"],
  ["binh-thu", "books", "book:di-truc-bao-oan"],
].map(([slug, group, sampleId]) => ({ path: `tra-cuu/${slug}`, section: "lookup", season: false, group, sampleId }));
const LOOKUP_GROUP_PATHS = LOOKUP_GROUP_SPECS.map(({ path }) => `/${path}/`);
/** Trang nội dung tĩnh có bản gương (các trang chính sách): được index, canonical theo ngôn ngữ. */
const STATIC_PAGE_PATHS = ["/dieu-khoan-su-dung/", "/chinh-sach-bao-mat/", "/quy-tac-cong-dong/", "/mien-tru-trach-nhiem/"];
const staticPageHtml = (locale, viPath) =>
  `<!doctype html>${pairHead(locale, viPath)}<link rel="canonical" href="${FIXTURE_ORIGIN}${locale === "zh" ? zhPathOf(viPath) : viPath}"><body>\n`;
const SECTION_LOCATIONS = SECTION_PAGE_SPECS.map(({ path }) => `${FIXTURE_ORIGIN}/${path}/`);
/** Hai trang danh sách blog luôn có và là cặp dịch của nhau. */
const BLOG_INDEX_ENTRIES = [`${FIXTURE_ORIGIN}/bai-viet/`, `${FIXTURE_ORIGIN}/zh/bai-viet/`]
  .map((loc) => ({ loc, pair: [`${FIXTURE_ORIGIN}/bai-viet/`, `${FIXTURE_ORIGIN}/zh/bai-viet/`] }));
/** Mọi mục sitemap của fixture: Landing, 8 trang mục, 7 trang nhóm Tra cứu, trang tĩnh, 2 trang chi tiết (mỗi route hai ngôn ngữ) và blog. */
const FIXTURE_SITEMAP_ENTRIES = [
  ...mirroredEntries(["/", ...SECTION_PAGE_SPECS.map(({ path }) => `/${path}/`), ...LOOKUP_GROUP_PATHS, ...STATIC_PAGE_PATHS, `/doi-khac/${LEGACY_ROUTE_SEGMENT}/`, `/khai-hoang/${KHAIHOANG_ROUTE_SEGMENT}/`]),
  ...BLOG_INDEX_ENTRIES,
];
const SEASON_MARKER = {
  "heroes-dict": `sha256:${"0".repeat(64)}`,
  tactics: `sha256:${"0".repeat(64)}`,
};

/** Nội dung đội dựng sẵn tối thiểu mà verifier đòi ở bốn trang danh sách đội (vân tay publication ở `website`). */
const PRERENDERED_SECTION_BODY = {
  "team-chuan": '<h1 class="reference-title">Đội chuẩn</h1><div class="reference-view" data-ssr-signature="[]"><article class="reference-team-card"><a data-team-detail-link href="/doi-chuan/x/"></a></article></div>',
  "team-khac": '<h1 class="reference-title">Đội khác</h1><div class="reference-view" data-ssr-signature="[]"><article class="reference-team-card"><a data-team-detail-link href="/doi-khac/x/"></a></article></div>',
  coexist: '<h1 class="reference-title">Cùng Tồn</h1><div class="coexist-group-view" data-ssr-signature="[]"><article class="coexist-team-card"></article></div>',
  khaihoang: '<div class="khaihoang"><h1 class="reference-title">Khai hoang</h1><article class="kh-card"><a class="kh-title-link" href="/khai-hoang/x/"></a></article></div>',
};

/** Thân chi tiết dựng sẵn tối thiểu mà verifier đòi ở mọi trang chi tiết đội. */
const PRERENDERED_DETAIL_BODY = '<div id="team-detail-body" data-prerendered><section><h2>Đội hình</h2></section></div>';

/** Trang mục trong fixture mang đúng payload mà verifier khóa theo bảng của phase. */
function sectionPageHtml({ path, locale, section, season, group, sampleId, registry, pin, seasonHashes, website }) {
  return [
    `<!doctype html>${pairHead(locale, `/${path}/`)}<body data-page-section="${section}"${group ? ` data-lookup-group="${group}"` : ""}>`,
    `<section id="section-${section}" class="section active"${PRERENDERED_SECTION_BODY[section] && website ? ` data-ssr-source="${website.pin.sha256}"` : ""}>`,
    PRERENDERED_SECTION_BODY[section] ?? "",
    group ? `<button type="button" class="lookup-card-button" data-lookup-id="${sampleId}"></button>` : "",
    "</section>",
    season ? '<div id="season-controls"></div>' : "",
    `<script id="team-route-handles" type="application/json">${JSON.stringify(registry)}</script>`,
    `<script id="lookup-route-handles" type="application/json">{}</script>`,
    `<script id="recommended-publication" type="application/json">${JSON.stringify(pin)}</script>`,
    season ? `<script id="season-artifact-hashes" type="application/json">${JSON.stringify(seasonHashes)}</script>` : "",
    group === "books" ? `<script type="application/json" id="lookup-books-hash">"sha256:${"0".repeat(64)}"</script>` : "",
    '<script type="module" src="/js/app.js"></script>',
    "\n",
  ].join("");
}

/** Mục lục Tra cứu: tĩnh, chỉ script chuyển tiếp link cũ và thẻ link tới 7 trang nhóm; không app.js. */
const lookupHubHtml = (locale) => [
  `<!doctype html>${pairHead(locale, "/tra-cuu/")}<head><script id="lookup-hub-redirect">(function(){})();</script></head><body>`,
  ...LOOKUP_GROUP_SPECS.map(({ path, group }) =>
    `<a class="lookup-hub-card" href="${locale === "zh" ? "/zh" : ""}/${path}/" data-group="${group}"></a>`),
  "\n",
].join("");

/** Mọi trang chi tiết đội mang khối cộng đồng (chiến báo + bình luận) và entry của nó. */
const COMMUNITY_MOUNT_HTML = '<section id="community-root"></section><script type="module" src="/js/community-page.js"></script>';
/** Trang cộng đồng tĩnh: noindex, không canonical, chỉ mount + entry riêng. */
const communityPageHtml = (mount, entry) =>
  `<!doctype html><head><meta name="robots" content="noindex"></head><div ${mount}></div><script type="module" src="${entry}"></script>\n`;

/** Landing chỉ còn script chuyển tiếp hash cũ (bản Việt); không payload, không app.js. */
const LANDING_HTML = `<!doctype html>${pairHead("vi", "/")}<body><script id="legacy-route-redirect">(function(){})();</script>\n`;
const LANDING_ZH_HTML = `<!doctype html>${pairHead("zh", "/")}<body>\n`;

/** 404 duy nhất của Pages: khối Việt, khối Trung dựng sẵn và script chọn khối Trung dưới /zh/. */
const NOT_FOUND_HTML = '<!doctype html><head><meta name="robots" content="noindex"></head><h1 id="not-found-title">Không tìm thấy trang</h1><section data-not-found="zh" hidden><h1 id="not-found-title-zh">页面不存在</h1></section><script id="not-found-locale">(function(){})();</script>\n';

/** Font self-host là thư mục public tĩnh; fixture dist phải có bản sao byte-equal ở cả hai phía. */
async function writeStaticFonts(projectDir, distDir) {
  const source = await readdir(new URL("public/fonts/", projectRoot));
  assert.ok(source.includes("OFL.txt"), "public/fonts phải kèm giấy phép OFL");
  await mkdir(join(projectDir, "public", "fonts"), { recursive: true });
  await mkdir(join(distDir, "fonts"), { recursive: true });
  for (const name of source) {
    const bytes = await readFile(new URL(`public/fonts/${name}`, projectRoot));
    await writeFile(join(projectDir, "public", "fonts", name), bytes);
    await writeFile(join(distDir, "fonts", name), bytes);
  }
  // Chân dung tướng tự lưu (`public/heroes`) là thư mục tĩnh thứ hai; fixture dùng file giả, không phụ thuộc ảnh thật.
  await mkdir(join(projectDir, "public", "heroes"), { recursive: true });
  await mkdir(join(distDir, "heroes"), { recursive: true });
  await writeFile(join(projectDir, "public", "heroes", "sample.webp"), "RIFF-sample");
  await writeFile(join(distDir, "heroes", "sample.webp"), "RIFF-sample");
}

/** Ảnh tĩnh của public (favicon, ảnh chia sẻ og:image, logo, logo chữ, QR ủng hộ) được copy nguyên byte như Astro làm. */
async function writeStaticImages(projectDir, distDir) {
  for (const name of ["favicon.png", "og-image.png", "logo.png", "logo-cam-nang.svg", "donate-qr.png"]) {
    const bytes = await readFile(new URL(`public/${name}`, projectRoot));
    await writeFile(join(projectDir, "public", name), bytes);
    await writeFile(join(distDir, name), bytes);
  }
}

/** Head metadata is read back by attribute so tag order never decides the contract. */
const tagAttribute = (tag, name) => tag?.match(new RegExp(`${name}=["']([^"']*)["']`, "u"))?.[1] ?? null;
const linkHref = (html, rel) => tagAttribute(html.match(new RegExp(`<link[^>]+rel=["']${rel}["'][^>]*>`, "u"))?.[0], "href");
const metaContent = (html, key) => tagAttribute(html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, "u"))?.[0], "content");

/** robots.txt, the sitemap and every canonical are locked to the single configured origin. */
async function configuredSite() {
  const source = await readFile(new URL("../astro.config.mjs", import.meta.url), "utf8");
  const match = source.match(/site:\s*["'](https?:\/\/[^"']+)["']/u);
  assert.ok(match, "astro.config.mjs must declare an absolute site origin");
  return match[1];
}

async function writeRecommendedFixture(projectDir, distDir, { legacyTeamsHash } = {}) {
  const generationId = "1".repeat(64);
  const scope = `s-${"2".repeat(64)}`;
  const sourceRoot = join(projectDir, "src", "data", "recommended-reference");
  const generation = join(sourceRoot, generationId);
  const output = join(distDir, "data", "recommended", generationId);
  await mkdir(generation, { recursive: true });
  await mkdir(output, { recursive: true });
  const teamsBytes = jsonBytes([{
    id: LEGACY_TEAM_ID,
    source: "team-intro",
    name: "Đội gốc",
    nickname: null,
    heroes: [{ name: "Tuân Úc", tactics: [], books: [], alternatives: [], note: null }],
    counters: { good: [], avoid: [] },
    notes: null,
  }]);
  await mkdir(join(projectDir, "data"), { recursive: true });
  await writeFile(join(projectDir, "data", "teams.json"), teamsBytes);
  const payloads = {
    "seasons.json": jsonBytes({ schemaVersion: 1, seasonOptions: [], scopes: [] }),
    "index.json": jsonBytes({ schemaVersion: 1, records: [] }),
    "other-teams.json": jsonBytes({ schemaVersion: 1, records: [] }),
    "hero-summaries.json": jsonBytes({ schemaVersion: 1, provenance: {
      catalogSha256: `sha256:${"0".repeat(64)}`,
      recommendedJoin: "heroes[].nameRaw ↔ chinese|aliases", otherJoin: "holders[].nameRaw ↔ hanViet",
      unmatchedSlots: { recommended: 0, other: 0 }, ambiguousSlots: { recommended: 0, other: 0 },
    }, summaries: {} }),
    "tactic-summaries.json": jsonBytes({schemaVersion:1,provenance:{tacticCatalogSha256:`sha256:${"0".repeat(64)}`,heroCatalogSha256:`sha256:${"0".repeat(64)}`,recommendedJoin:"heroes[].tacticSlotsRaw ↔ chinese|aliases",otherJoin:"holders[].tacticSlotsRaw ↔ viet|hanViet",unmatchedSlots:{recommended:0,other:0},ambiguousSlots:{recommended:0,other:0}},summaries:{}}),
    [`details-${scope}.json`]: jsonBytes({ schemaVersion: 1, records: [] }),
  };
  const files = Object.fromEntries(Object.entries(payloads).map(([name, bytes]) => [name, { sha256: sha256(bytes), bytes: bytes.length }]));
  for (const [name, bytes] of Object.entries(payloads)) {
    await writeFile(join(generation, name), bytes);
    await writeFile(join(output, name), bytes);
  }
  const manifest = jsonBytes({
    schemaVersion: 1,
    generationId,
    dedupKeyVersion: 1,
    allowedScopeKeys: [scope],
    files,
    legacyTeamsHash: legacyTeamsHash ?? `sha256:${sha256(teamsBytes)}`,
  });
  await writeFile(join(generation, "manifest.json"), manifest);
  await writeFile(join(output, "manifest.json"), manifest);
  const current = jsonBytes({ schemaVersion: 1, generationId, manifestSha256: sha256(manifest) });
  await writeFile(join(sourceRoot, "current.json"), current);
  await mkdir(join(distDir, "data", "recommended"), { recursive: true });
  await writeFile(join(distDir, "data", "recommended", "current.json"), current);
  const pin = { schemaVersion: 1, generationId, manifestSha256: sha256(manifest) };
  const registry = {
    r: {},
    l: { [LEGACY_TEAM_ID]: LEGACY_HANDLE },
    k: { [KHAIHOANG_TEAM_ID]: KHAIHOANG_HANDLE },
  };
  await writeFile(join(distDir, "index.html"), LANDING_HTML);
  await mkdir(join(distDir, "zh"), { recursive: true });
  await writeFile(join(distDir, "zh", "index.html"), LANDING_ZH_HTML);
  for (const locale of ["vi", "zh"]) {
    for (const spec of [...SECTION_PAGE_SPECS, ...LOOKUP_GROUP_SPECS]) {
      const dir = locale === "zh" ? join(distDir, "zh", spec.path) : join(distDir, spec.path);
      await mkdir(dir, { recursive: true });
      await writeFile(
        join(dir, "index.html"),
        spec.hub ? lookupHubHtml(locale) : sectionPageHtml({ ...spec, locale, registry, pin, seasonHashes: SEASON_MARKER }),
      );
    }
  }
  for (const locale of ["vi", "zh"]) {
    for (const viPath of STATIC_PAGE_PATHS) {
      const dir = join(distDir, ...(locale === "zh" ? ["zh"] : []), viPath.slice(1, -1));
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, "index.html"), staticPageHtml(locale, viPath));
    }
  }
  await writeFile(join(distDir, "404.html"), NOT_FOUND_HTML);
  for (const { htmlPath, mount, entry } of COMMUNITY_PAGES) {
    await mkdir(join(distDir, dirname(htmlPath)), { recursive: true });
    await writeFile(join(distDir, htmlPath), communityPageHtml(mount, entry));
  }
  // The route cutover reads its frozen handles from the ledger of the same project root.
  await mkdir(join(projectDir, "pipeline"), { recursive: true });
  const khaiHoangBytes = jsonBytes({ teams: [{ id: KHAIHOANG_TEAM_ID, title: KHAIHOANG_TITLE }] });
  await writeFile(join(projectDir, "data", "khaihoang.json"), khaiHoangBytes);
  const ledger = {
    schemaVersion: 2,
    generationId,
    legacyTeamsSha256: `sha256:${sha256(teamsBytes)}`,
    khaihoangSha256: `sha256:${sha256(khaiHoangBytes)}`,
    note: "Handle URL đã review; gán một lần, không suy lại từ displayNameVi.",
    handles: {
      recommended: {},
      legacy: { [LEGACY_TEAM_ID]: LEGACY_HANDLE },
      khaihoang: { [KHAIHOANG_TEAM_ID]: KHAIHOANG_HANDLE },
    },
  };
  await writeFile(join(projectDir, "pipeline", "team-route-handles.json"), jsonBytes(ledger));
  // robots.txt is a static public artifact; the sitemap is derived from the same frozen catalog.
  await mkdir(join(projectDir, "public"), { recursive: true });
  await writeFile(join(projectDir, "public", "robots.txt"), FIXTURE_ROBOTS);
  await writeFile(join(distDir, "robots.txt"), FIXTURE_ROBOTS);
  const sitemap = orderedSitemap(FIXTURE_SITEMAP_ENTRIES);
  await writeFile(join(distDir, "sitemap.xml"), sitemap);
  await writeBlogOutputs(distDir);
  // Trang chi tiết có bản Trung cùng pin identity dưới `zh/`.
  for (const locale of ["vi", "zh"]) {
    const base = locale === "zh" ? join(distDir, "zh") : distDir;
    await mkdir(join(base, "doi-khac", LEGACY_ROUTE_SEGMENT), { recursive: true });
    await writeFile(
      join(base, "doi-khac", LEGACY_ROUTE_SEGMENT, "index.html"),
      `<!doctype html>${pairHead(locale, `/doi-khac/${LEGACY_ROUTE_SEGMENT}/`)}<article id="team-detail-root" data-legacy-team-id="${LEGACY_TEAM_ID}" data-legacy-teams-sha256="sha256:${sha256(teamsBytes)}" data-generation-id="${generationId}" data-manifest-sha256="${sha256(manifest)}">${PRERENDERED_DETAIL_BODY}</article><script type="module" src="/js/team-detail.js"></script>${COMMUNITY_MOUNT_HTML}\n`,
    );
    await mkdir(join(base, "khai-hoang", KHAIHOANG_ROUTE_SEGMENT), { recursive: true });
    await writeFile(
      join(base, "khai-hoang", KHAIHOANG_ROUTE_SEGMENT, "index.html"),
      `<!doctype html>${pairHead(locale, `/khai-hoang/${KHAIHOANG_ROUTE_SEGMENT}/`)}<article id="team-detail-root" data-family="khaihoang" data-khaihoang-team-id="${KHAIHOANG_TEAM_ID}" data-khaihoang-sha256="sha256:${sha256(khaiHoangBytes)}">${PRERENDERED_DETAIL_BODY}</article><script type="module" src="/js/khaihoang-detail.js"></script>${COMMUNITY_MOUNT_HTML}\n`,
    );
  }
  return { ledger, generationId, manifest, sitemap };
}

test("season bundle publishes exactly five sidecars with the shared resolver", async () => {
  assert.deepEqual(artifactEntriesFor("data").filter((entry) => entry.routeParam.startsWith("season-")).map((entry) => entry.routeParam).sort(), ["season-content-links", "season-evidence", "season-registry", "season-team-configs", "season-team-evaluations"]);
  assert.ok(artifactEntriesFor("js").some((entry) => entry.routeParam === "season-context"));
});

test("seasonal registry and evidence routes are explicit runtime artifacts", async () => {
  const seasonal = artifactEntriesFor("data").filter((entry) =>
    ["season-registry", "season-evidence"].includes(entry.routeParam));
  assert.deepEqual(seasonal.map((entry) => entry.routeParam).sort(), ["season-evidence", "season-registry"]);
  for (const entry of seasonal) {
    assert.equal(entry.publicationClass, "runtime");
    assert.equal(entry.mimeType, "application/json; charset=utf-8");
    assert.ok(Array.isArray(JSON.parse(await readFile(new URL(`data/${entry.sourceBasename}`, projectRoot), "utf8"))));
  }
});

test("season sidecars without manifest entries reject source inventory", async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), "tqccl-season-inventory-"));
  t.after(async () => {
    await import("node:fs/promises").then(({ rm }) => rm(rootDir, { recursive: true, force: true }));
  });
  await mkdir(join(rootDir, "data"));
  for (const name of ["season-registry", "season-evidence"]) {
    await writeFile(join(rootDir, "data", `${name}.json`), "[]\n");
  }
  await assert.rejects(validatePublicArtifactTree({ rootDir, manifest: [], kinds: ["data"] }), /source set mismatch/i);
});

test("manifest explicitly classifies every published root artifact", async () => {
  const expectedByKind = {};
  for (const kind of ["js", "css", "data"]) {
    const directory = new URL(`${kind}/`, projectRoot);
    const names = (await import("node:fs/promises"))
      .readdir(directory)
      .then((entries) => entries
        .filter((entry) => kind !== "data" || entry !== "sgsdeck")
        .sort());
    expectedByKind[kind] = await names;
  }

  validatePublicArtifactManifest(PUBLIC_ARTIFACTS);
  for (const kind of ["js", "css", "data"]) {
    const entries = artifactEntriesFor(kind);
    assert.deepEqual(
      entries.map((entry) => entry.sourceBasename).sort(),
      expectedByKind[kind],
    );
    assert.equal(new Set(entries.map((entry) => entry.routeParam)).size, entries.length);
    assert.ok(entries.every((entry) => !entry.routeParam.includes(".")));
  }

  const dataClasses = Object.fromEntries(
    artifactEntriesFor("data").map((entry) => [entry.sourceBasename, entry.publicationClass]),
  );
  for (const name of [
    "teams.json",
    "coexist.json",
    "khaihoang.json",
    "tactics.json",
    "heroes-dict.json",
    "books-dict.json",
    "team-tier.json",
  ]) {
    assert.equal(dataClasses[name], "runtime");
  }
  assert.equal(dataClasses["facets.json"], "legacy-public/build-input");
  assert.equal(dataClasses["tactics-generic.json"], "legacy-public/build-input");
});

test("manifest rejects route collisions, extension mistakes, and unknown kinds", () => {
  const valid = {
    kind: "data",
    routeParam: "teams",
    sourceBasename: "teams.json",
    publicationClass: "runtime",
    mimeType: "application/json; charset=utf-8",
  };

  assert.throws(
    () => validatePublicArtifactManifest([valid, { ...valid }]),
    /duplicate/i,
  );
  assert.throws(
    () => validatePublicArtifactManifest([{ ...valid, routeParam: "teams.json" }]),
    /extensionless/i,
  );
  assert.throws(
    () => validatePublicArtifactManifest([{ ...valid, kind: "private" }]),
    /kind/i,
  );
  assert.throws(
    () => validatePublicArtifactManifest([{ ...valid, sourceBasename: "../teams.json" }]),
    /basename/i,
  );
});

test("artifact reader returns exact bytes and rejects unknown, missing, and symlink sources", async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), "tqccl-astro-artifacts-"));
  t.after(async () => {
    await import("node:fs/promises").then(({ rm }) => rm(rootDir, { recursive: true, force: true }));
  });
  await mkdir(join(rootDir, "data"));
  await writeFile(join(rootDir, "data", "fixture.json"), "{\"ok\":true}\n");
  const manifest = [{
    kind: "data",
    routeParam: "fixture",
    sourceBasename: "fixture.json",
    publicationClass: "runtime",
    mimeType: "application/json; charset=utf-8",
  }];

  const artifact = await readPublicArtifact({
    kind: "data",
    routeParam: "fixture",
    rootDir,
    manifest,
  });
  assert.equal(artifact.bytes.toString(), "{\"ok\":true}\n");
  assert.equal(artifact.mimeType, "application/json; charset=utf-8");

  await assert.rejects(
    readPublicArtifact({ kind: "data", routeParam: "unknown", rootDir, manifest }),
    /not allowlisted/i,
  );
  await writeFile(join(rootDir, "outside.json"), "{}");
  await symlink(join(rootDir, "outside.json"), join(rootDir, "data", "fixture-link.json"));
  await assert.rejects(
    readPublicArtifact({
      kind: "data",
      routeParam: "fixture-link",
      rootDir,
      manifest: [{ ...manifest[0], routeParam: "fixture-link", sourceBasename: "fixture-link.json" }],
    }),
    /symlink|regular file/i,
  );
  await assert.rejects(
    readPublicArtifact({
      kind: "data",
      routeParam: "missing",
      rootDir,
      manifest: [{ ...manifest[0], routeParam: "missing", sourceBasename: "missing.json" }],
    }),
    /missing|ENOENT/i,
  );
});

test("artifact tree rejects symlinked directories and source-set drift", async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), "tqccl-astro-tree-"));
  const outsideDir = await mkdtemp(join(tmpdir(), "tqccl-astro-outside-"));
  t.after(async () => {
    const { rm } = await import("node:fs/promises");
    await Promise.all([
      rm(rootDir, { recursive: true, force: true }),
      rm(outsideDir, { recursive: true, force: true }),
    ]);
  });
  await writeFile(join(outsideDir, "fixture.json"), "{}\n");
  await symlink(
    `../${outsideDir.split("/").at(-1)}`,
    join(rootDir, "data"),
    "dir",
  );
  const manifest = [{
    kind: "data",
    routeParam: "fixture",
    sourceBasename: "fixture.json",
    publicationClass: "runtime",
    mimeType: "application/json; charset=utf-8",
  }];
  await assert.rejects(
    validatePublicArtifactTree({ rootDir, manifest, kinds: ["data"] }),
    /real directory|escapes/i,
  );

  const driftRoot = await mkdtemp(join(tmpdir(), "tqccl-astro-drift-"));
  t.after(async () => {
    await import("node:fs/promises").then(({ rm }) =>
      rm(driftRoot, { recursive: true, force: true }));
  });
  await mkdir(join(driftRoot, "data"));
  await writeFile(join(driftRoot, "data", "fixture.json"), "{}\n");
  await writeFile(join(driftRoot, "data", "unexpected.json"), "{}\n");
  await assert.rejects(
    validatePublicArtifactTree({ rootDir: driftRoot, manifest, kinds: ["data"] }),
    /source set mismatch/i,
  );
});

test("artifact tree accepts only the optional private SGSDeck data subtree", async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), "tqccl-astro-private-data-"));
  const outsideDir = await mkdtemp(join(tmpdir(), "tqccl-astro-private-outside-"));
  t.after(async () => {
    const { rm } = await import("node:fs/promises");
    await Promise.all([
      rm(rootDir, { recursive: true, force: true }),
      rm(outsideDir, { recursive: true, force: true }),
    ]);
  });
  await mkdir(join(rootDir, "data"));
  await writeFile(join(rootDir, "data", "fixture.json"), "{}\n");
  const manifest = [{
    kind: "data",
    routeParam: "fixture",
    sourceBasename: "fixture.json",
    publicationClass: "runtime",
    mimeType: "application/json; charset=utf-8",
  }];

  await mkdir(join(rootDir, "data", "sgsdeck"));
  await writeFile(join(rootDir, "data", "sgsdeck", "manifest.json"), "{}\n");
  await validatePublicArtifactTree({ rootDir, manifest, kinds: ["data"] });

  await mkdir(join(rootDir, "data", "other-private"));
  await assert.rejects(
    validatePublicArtifactTree({ rootDir, manifest, kinds: ["data"] }),
    /source set mismatch/i,
  );
  await import("node:fs/promises").then(({ rm }) =>
    rm(join(rootDir, "data", "other-private"), { recursive: true, force: true }));

  await import("node:fs/promises").then(({ rm }) =>
    rm(join(rootDir, "data", "sgsdeck"), { recursive: true, force: true }));
  await writeFile(join(rootDir, "data", "sgsdeck"), "not a directory\n");
  await assert.rejects(
    validatePublicArtifactTree({ rootDir, manifest, kinds: ["data"] }),
    /private artifact subtree|real directory/i,
  );

  await import("node:fs/promises").then(({ rm }) => rm(join(rootDir, "data", "sgsdeck")));
  await symlink(outsideDir, join(rootDir, "data", "sgsdeck"), "dir");
  await assert.rejects(
    validatePublicArtifactTree({ rootDir, manifest, kinds: ["data"] }),
    /private artifact subtree|real directory|escapes/i,
  );
});

test("dist verifier rejects missing, unexpected, and symlinked output", async (t) => {
  const projectDir = await mkdtemp(join(tmpdir(), "tqccl-astro-verify-source-"));
  const distDir = await mkdtemp(join(tmpdir(), "tqccl-astro-verify-dist-"));
  t.after(async () => {
    const { rm } = await import("node:fs/promises");
    await Promise.all([
      rm(projectDir, { recursive: true, force: true }),
      rm(distDir, { recursive: true, force: true }),
    ]);
  });
  const manifest = [{
    kind: "data",
    routeParam: "fixture",
    sourceBasename: "fixture.json",
    publicationClass: "runtime",
    mimeType: "application/json; charset=utf-8",
  }];
  await mkdir(join(projectDir, "data"));
  await mkdir(join(projectDir, "public"));
  await mkdir(join(distDir, "data"));
  await writeFile(join(projectDir, "data", "fixture.json"), "{}\n");
  await writeFile(join(projectDir, "public", "_headers"), FIXTURE_HEADERS);
  await writeFile(join(distDir, "index.html"), "<!doctype html>\n");
  await writeFile(join(distDir, "_headers"), FIXTURE_HEADERS);
  await writeFile(join(projectDir, "public", "_redirects"), FIXTURE_REDIRECTS);
  await writeFile(join(distDir, "_redirects"), FIXTURE_REDIRECTS);
  await writeStaticImages(projectDir, distDir);
  await writeStaticFonts(projectDir, distDir);
  await writeRecommendedFixture(projectDir, distDir);

  await assert.rejects(
    verifyAstroDist({
      projectRoot: new URL(`file://${projectDir}/`),
      distDir: new URL(`file://${distDir}/`),
      manifest,
    }),
    /missing: data\/fixture\.json/i,
  );

  await writeFile(join(distDir, "data", "fixture.json"), "{}\n");
  await writeFile(join(distDir, "unexpected.txt"), "private\n");
  await assert.rejects(
    verifyAstroDist({
      projectRoot: new URL(`file://${projectDir}/`),
      distDir: new URL(`file://${distDir}/`),
      manifest,
    }),
    /unexpected: unexpected\.txt/i,
  );

  const { rm } = await import("node:fs/promises");
  await rm(join(distDir, "unexpected.txt"));
  await writeFile(join(distDir, "_headers"), "tampered\n");
  await assert.rejects(
    verifyAstroDist({
      projectRoot: new URL(`file://${projectDir}/`),
      distDir: new URL(`file://${distDir}/`),
      manifest,
    }),
    /control artifact bytes differ/i,
  );
  await writeFile(join(distDir, "_headers"), FIXTURE_HEADERS);
  await symlink(join(projectDir, "data", "fixture.json"), join(distDir, "fixture-link.json"));
  await assert.rejects(
    verifyAstroDist({
      projectRoot: new URL(`file://${projectDir}/`),
      distDir: new URL(`file://${distDir}/`),
      manifest,
    }),
    /must not contain symlinks/i,
  );
});

test("dist verifier admits exactly the catalog team pages, the 404 and no stale publication", async (t) => {
  const { rm } = await import("node:fs/promises");
  const projectDir = await mkdtemp(join(tmpdir(), "tqccl-astro-teams-source-"));
  const distDir = await mkdtemp(join(tmpdir(), "tqccl-astro-teams-dist-"));
  t.after(async () => {
    await Promise.all([
      rm(projectDir, { recursive: true, force: true }),
      rm(distDir, { recursive: true, force: true }),
    ]);
  });
  const manifest = [];
  await mkdir(join(projectDir, "public"), { recursive: true });
  await writeFile(join(projectDir, "public", "_headers"), FIXTURE_HEADERS);
  await writeFile(join(distDir, "_headers"), FIXTURE_HEADERS);
  await writeFile(join(projectDir, "public", "_redirects"), FIXTURE_REDIRECTS);
  await writeFile(join(distDir, "_redirects"), FIXTURE_REDIRECTS);
  await writeStaticImages(projectDir, distDir);
  await writeStaticFonts(projectDir, distDir);
  const fixture = await writeRecommendedFixture(projectDir, distDir);
  const verify = () => verifyAstroDist({
    projectRoot: new URL(`file://${projectDir}/`),
    distDir: new URL(`file://${distDir}/`),
    manifest,
  });

  const result = await verify();
  assert.ok(result.files.includes(`doi-khac/${LEGACY_ROUTE_SEGMENT}/index.html`));
  assert.ok(result.files.includes("404.html"));
  assert.ok(!result.files.some((file) => file.startsWith("teams/")));
  // Registry mùa rỗng: không có trang mùa nào; một trang mùa lạc vào dist là file thừa (cả hai ngôn ngữ).
  for (const stray of ["doi-chuan/pk-s24/index.html", "zh/doi-chuan/pk-s24/index.html"]) {
    await mkdir(dirname(join(distDir, stray)), { recursive: true });
    await writeFile(join(distDir, stray), "<!doctype html>\n");
    await assert.rejects(verify(), new RegExp(`unexpected: ${stray.replaceAll("/", "\\/").replace(".", "\\.")}`, "i"), stray);
    await rm(join(distDir, stray));
    await rm(dirname(join(distDir, stray)), { recursive: true });
  }
  await verify();
  await writeFile(join(distDir, "sitemap.xml"), fixture.sitemap.replaceAll(FIXTURE_ORIGIN, "https://wrong.example"));
  await assert.rejects(verify(), /sitemap.*generated document/i);
  await writeFile(join(distDir, "sitemap.xml"), fixture.sitemap.replace("</loc>", "?q=wrong</loc>"));
  await assert.rejects(verify(), /sitemap.*generated document/i);
  await writeFile(join(distDir, "sitemap.xml"), fixture.sitemap.replace("</urlset>", "<broken></urlset>"));
  await assert.rejects(verify(), /sitemap.*generated document/i);
  await writeFile(join(distDir, "sitemap.xml"), fixture.sitemap);
  const validNotFound = await readFile(join(distDir, "404.html"), "utf8");
  await writeFile(join(distDir, "404.html"), validNotFound.replace('<meta name="robots" content="noindex">', ""));
  await assert.rejects(verify(), /404.*noindex/i);
  await writeFile(
    join(distDir, "404.html"),
    validNotFound.replace(
      "</head>",
      '<link rel="canonical" href="https://tqccl.com/404/"><meta property="og:url" content="https://tqccl.com/404/"></head>',
    ),
  );
  await assert.rejects(verify(), /404.*canonical|404.*og:url/i);
  await writeFile(join(distDir, "404.html"), validNotFound);

  await rm(join(distDir, "404.html"));
  await assert.rejects(verify(), /missing: 404\.html/i);
  await writeFile(join(distDir, "404.html"), validNotFound);

  // The verifier's inventory is the ledger's frozen segment, not a path it re-derives.
  const relocated = { ...fixture.ledger, handles: { ...fixture.ledger.handles, legacy: { [LEGACY_TEAM_ID]: "hoang-ma-thuong" } } };
  await writeFile(join(projectDir, "pipeline", "team-route-handles.json"), jsonBytes(relocated));
  await assert.rejects(verify(), /missing: doi-khac\/hoang-ma-thuong\/index\.html/i);
  await assert.rejects(verify(), /unexpected: doi-khac\/vinh-quang-thuong\/index\.html/i);
  await writeFile(join(projectDir, "pipeline", "team-route-handles.json"), jsonBytes(fixture.ledger));

  // A relocated Khai hoang handle moves that page too: the frozen segment is the inventory.
  const relocatedKhaiHoang = { ...fixture.ledger, handles: { ...fixture.ledger.handles, khaihoang: { [KHAIHOANG_TEAM_ID]: "khai-hoang-doi-ten" } } };
  await writeFile(join(projectDir, "pipeline", "team-route-handles.json"), jsonBytes(relocatedKhaiHoang));
  await assert.rejects(verify(), /missing: khai-hoang\/khai-hoang-doi-ten\/index\.html/i);
  await assert.rejects(verify(), /unexpected: khai-hoang\/gia-cat-khac-sp-ma-sieu-phap-chinh\/index\.html/i);
  await writeFile(join(projectDir, "pipeline", "team-route-handles.json"), jsonBytes(fixture.ledger));

  // Every Khai hoang page pins its own identity, its source hash and its own entry.
  const khaiHoangPagePath = join(distDir, "khai-hoang", KHAIHOANG_ROUTE_SEGMENT, "index.html");
  const validKhaiHoangPage = await readFile(khaiHoangPagePath, "utf8");
  await writeFile(khaiHoangPagePath, validKhaiHoangPage.replace(`data-khaihoang-team-id="${KHAIHOANG_TEAM_ID}"`, 'data-khaihoang-team-id="team-doi-ten"'));
  await assert.rejects(verify(), /lacks its validated pin/i);
  await writeFile(khaiHoangPagePath, validKhaiHoangPage.replace(/data-khaihoang-sha256="[^"]+"/u, `data-khaihoang-sha256="sha256:${"0".repeat(64)}"`));
  await assert.rejects(verify(), /lacks its validated pin/i);
  await writeFile(khaiHoangPagePath, validKhaiHoangPage.replace('src="/js/khaihoang-detail.js"', 'src="/js/app.js"'));
  await assert.rejects(verify(), /does not load its own entry|boots the root application/i);
  await writeFile(khaiHoangPagePath, validKhaiHoangPage);

  // Thân chi tiết phải dựng sẵn trong HTML: thiếu thân, ẩn thân, hoặc còn câu chờ/đòi JavaScript đều làm hỏng build.
  await writeFile(khaiHoangPagePath, validKhaiHoangPage.replace(PRERENDERED_DETAIL_BODY, '<div id="team-detail-body" hidden></div>'));
  await assert.rejects(verify(), /lacks its prerendered body/i);
  await writeFile(khaiHoangPagePath, validKhaiHoangPage.replace(PRERENDERED_DETAIL_BODY, `<div id="team-detail-status">Đang tải chi tiết…</div>${PRERENDERED_DETAIL_BODY}`));
  await assert.rejects(verify(), /waiting or JavaScript-required state/i);
  await writeFile(khaiHoangPagePath, validKhaiHoangPage.replace(PRERENDERED_DETAIL_BODY, `${PRERENDERED_DETAIL_BODY}<noscript><p>Trang chi tiết cần JavaScript</p></noscript>`));
  await assert.rejects(verify(), /waiting or JavaScript-required state/i);
  await writeFile(khaiHoangPagePath, validKhaiHoangPage);

  // Bốn trang danh sách đội phải mang đội mặc định dựng sẵn, đúng một h1 và không đòi JavaScript.
  for (const [pagePath, mutate, expected] of [
    ["doi-chuan", (html) => html.replace(PRERENDERED_SECTION_BODY["team-chuan"], ""), /lacks its prerendered default content/i],
    ["zh/khai-hoang", (html) => html.replace(PRERENDERED_SECTION_BODY.khaihoang, ""), /lacks its prerendered default content/i],
    ["cung-ton", (html) => html.replace(PRERENDERED_SECTION_BODY.coexist, `${PRERENDERED_SECTION_BODY.coexist}<h1>Hai</h1>`), /exactly one h1/i],
    ["doi-khac", (html) => html.replace(PRERENDERED_SECTION_BODY["team-khac"], `${PRERENDERED_SECTION_BODY["team-khac"]}<noscript><p>Mục này cần JavaScript để hiển thị nội dung.</p></noscript>`), /waiting or JavaScript-required text/i],
  ]) {
    const sectionPath = join(distDir, ...pagePath.split("/"), "index.html");
    const validSection = await readFile(sectionPath, "utf8");
    await writeFile(sectionPath, mutate(validSection));
    await assert.rejects(verify(), expected, pagePath);
    await writeFile(sectionPath, validSection);
  }

  // Hai trang chi tiết cùng <title> hoặc cùng meta description thì tab/kết quả tìm kiếm không phân biệt được.
  const legacyDetailPath = join(distDir, "doi-khac", LEGACY_ROUTE_SEGMENT, "index.html");
  const validLegacyDetail = await readFile(legacyDetailPath, "utf8");
  const withHead = (html, title, description) => html.replace("<!doctype html>", `<!doctype html><head><title>${title}</title><meta name="description" content="${description}"></head>`);
  await writeFile(legacyDetailPath, withHead(validLegacyDetail, "Đội A — Đội khác", "Mô tả A"));
  await writeFile(khaiHoangPagePath, withHead(validKhaiHoangPage, "Đội B — Khai hoang", "Mô tả B"));
  await verify();
  await writeFile(khaiHoangPagePath, withHead(validKhaiHoangPage, "Đội A — Đội khác", "Mô tả B"));
  await assert.rejects(verify(), /duplicate <title>.*Đội A — Đội khác/i);
  await writeFile(khaiHoangPagePath, withHead(validKhaiHoangPage, "Đội B — Khai hoang", "Mô tả A"));
  await assert.rejects(verify(), /duplicate meta description.*Mô tả A/i);
  await writeFile(legacyDetailPath, validLegacyDetail);
  await writeFile(khaiHoangPagePath, validKhaiHoangPage);

  await mkdir(join(distDir, "doi-khac", "team-khong-co"), { recursive: true });
  await writeFile(join(distDir, "doi-khac", "team-khong-co", "index.html"), "<!doctype html>\n");
  await assert.rejects(verify(), /unexpected: doi-khac\/team-khong-co\/index\.html/i);
  await rm(join(distDir, "doi-khac", "team-khong-co"), { recursive: true });

  // A page still emitted under the retired route family is not part of the inventory.
  await mkdir(join(distDir, "teams", "legacy", LEGACY_TEAM_ID), { recursive: true });
  await writeFile(join(distDir, "teams", "legacy", LEGACY_TEAM_ID, "index.html"), "<!doctype html>\n");
  await assert.rejects(verify(), /unexpected: teams\/legacy\/team-intro-0\/index\.html/i);
  await rm(join(distDir, "teams"), { recursive: true });

  // Each legacy publication pin is independently enforced while identity/raw pins remain valid.
  const legacyPagePath = join(distDir, "doi-khac", LEGACY_ROUTE_SEGMENT, "index.html");
  const validLegacyPage = await readFile(legacyPagePath, "utf8");
  await writeFile(legacyPagePath, validLegacyPage.replace(/\sdata-generation-id="[^"]+"/, ""));
  await assert.rejects(verify(), /lacks its validated pin/i);
  await writeFile(
    legacyPagePath,
    validLegacyPage.replace(/data-manifest-sha256="[^"]+"/, `data-manifest-sha256="${"0".repeat(64)}"`),
  );
  await assert.rejects(verify(), /lacks its validated pin/i);
  // Trang chi tiết thiếu khối cộng đồng, hay trang cộng đồng bị index, đều làm hỏng build.
  await writeFile(legacyPagePath, validLegacyPage.replace('<section id="community-root"></section>', ""));
  await assert.rejects(verify(), /lacks its community section/i);
  await writeFile(legacyPagePath, validLegacyPage);
  const adminPath = join(distDir, "quan-tri", "index.html");
  const validAdmin = await readFile(adminPath, "utf8");
  await writeFile(adminPath, validAdmin.replace('<meta name="robots" content="noindex">', ""));
  await assert.rejects(verify(), /community page must declare robots=noindex/i);
  await writeFile(adminPath, validAdmin);
  // Chính sách bảo mật là URL khai với Google OAuth: phải index được và canonical đúng bản ngôn ngữ.
  const privacyZhPath = join(distDir, "zh", "chinh-sach-bao-mat", "index.html");
  const validPrivacyZh = await readFile(privacyZhPath, "utf8");
  await writeFile(privacyZhPath, validPrivacyZh.replace("<body>", '<meta name="robots" content="noindex"><body>'));
  await assert.rejects(verify(), /static page must stay indexable/i);
  await writeFile(privacyZhPath, validPrivacyZh.replace(`rel="canonical" href="${FIXTURE_ORIGIN}/zh/`, `rel="canonical" href="${FIXTURE_ORIGIN}/`));
  await assert.rejects(verify(), /static page lacks its own canonical/i);
  await writeFile(privacyZhPath, validPrivacyZh);
  // Tra cứu: mục lục tĩnh không được nạp app, trang nhóm phải có trang đầu dựng sẵn, và thiếu trang nhóm nào cũng hỏng build.
  const hubPath = join(distDir, "tra-cuu", "index.html");
  const validHub = await readFile(hubPath, "utf8");
  await writeFile(hubPath, `${validHub}<script type="module" src="/js/app.js"></script>`);
  await assert.rejects(verify(), /lookup hub must not boot the root application/i);
  await writeFile(hubPath, validHub.replace('href="/tra-cuu/binh-thu/"', 'href="/tra-cuu/?group=books"'));
  await assert.rejects(verify(), /lookup hub lacks its card for \/tra-cuu\/binh-thu\//i);
  await writeFile(hubPath, validHub);
  const zhTacticsPath = join(distDir, "zh", "tra-cuu", "chien-phap", "index.html");
  const validZhTactics = await readFile(zhTacticsPath, "utf8");
  await writeFile(zhTacticsPath, validZhTactics.replace(/<button[^>]*data-lookup-id=[^>]*><\/button>/u, ""));
  await assert.rejects(verify(), /lookup group page lacks its prerendered first page/i);
  await writeFile(zhTacticsPath, validZhTactics);
  const buildingsPath = join(distDir, "tra-cuu", "cong-trinh", "index.html");
  const validBuildings = await readFile(buildingsPath, "utf8");
  await rm(dirname(buildingsPath), { recursive: true });
  await assert.rejects(verify(), /missing: tra-cuu\/cong-trinh\/index\.html/i);
  await mkdir(dirname(buildingsPath));
  await writeFile(buildingsPath, validBuildings);
  await verify();
  await rm(join(distDir, "chien-bao"), { recursive: true });
  await assert.rejects(verify(), /missing: chien-bao\/index\.html/i);

  // A selected publication built from different raw originals must fail the build.
  const stale = await mkdtemp(join(tmpdir(), "tqccl-astro-teams-stale-"));
  const staleDist = await mkdtemp(join(tmpdir(), "tqccl-astro-teams-stale-dist-"));
  t.after(async () => {
    await Promise.all([
      rm(stale, { recursive: true, force: true }),
      rm(staleDist, { recursive: true, force: true }),
    ]);
  });
  await writeRecommendedFixture(stale, staleDist, { legacyTeamsHash: `sha256:${"9".repeat(64)}` });
  await assert.rejects(
    verifyAstroDist({
      projectRoot: new URL(`file://${stale}/`),
      distDir: new URL(`file://${staleDist}/`),
      manifest,
    }),
    /legacy teams hash/i,
  );
});

test("built dist is allowlisted and every emitted asset is byte-identical", async () => {
  const result = await verifyAstroDist({
    projectRoot: new URL("../", import.meta.url),
    distDir: new URL("../dist/", import.meta.url),
  });

  assert.equal(result.assetCount, PUBLIC_ARTIFACTS.length);
  assert.ok(result.files.includes("index.html"));
  assert.ok(result.files.includes("_headers"));
  assert.ok(result.files.includes("_redirects"));
  // Font self-host đi kèm giấy phép và nằm trong allowlist dist.
  assert.ok(result.files.includes("fonts/be-vietnam-pro-400-latin.woff2"));
  assert.ok(result.files.includes("fonts/OFL.txt"));
  // The Khai hoang page ships with its own entry: both must exist in the emitted dist.
  assert.ok(result.files.includes("js/khaihoang-detail.js"));
  assert.ok(result.files.includes("khai-hoang/gia-cat-khac-sp-ma-sieu-phap-chinh/index.html"));
  // Mọi trang mùa của Đội chuẩn (vi + zh) nằm trong allowlist và có mặt trong dist.
  const { seasonPages } = await import("../src/lib/season-pages.ts");
  const { pages: seasonPageList } = await seasonPages();
  assert.ok(seasonPageList.length > 10);
  for (const page of seasonPageList) {
    assert.ok(result.files.includes(page.htmlPath), `thiếu ${page.htmlPath}`);
    assert.ok(result.files.includes(`zh/${page.htmlPath}`), `thiếu zh/${page.htmlPath}`);
  }
  assert.equal(result.unexpectedFiles.length, 0);
  assert.deepEqual(
    await readFile(new URL("../dist/_headers", import.meta.url)),
    await readFile(new URL("../public/_headers", import.meta.url)),
  );
  assert.deepEqual(
    await readFile(new URL("../dist/_redirects", import.meta.url)),
    await readFile(new URL("../public/_redirects", import.meta.url)),
  );
  const html = await readFile(new URL("../dist/doi-chuan/index.html", import.meta.url), "utf8");
  assertFrontendShellContract(html, {
    stylesheetPattern: /<link[^>]+rel=["']stylesheet["'][^>]+href=["']\/css\/styles\.css["']/,
    scriptPattern: /<script[^>]+type=["']module["'][^>]+src=["']\/js\/app\.js["'][^>]*><\/script>/,
    section: "team-chuan",
  });
  assert.doesNotMatch(html, /_astro\//);
  // Landing là trang riêng: không nạp app.js, chỉ có script chuyển tiếp hash cũ.
  const landing = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.doesNotMatch(landing, /_astro\//);
  assert.match(landing, /id=["']legacy-route-redirect["']/);
  // Script chặn phải chứa nguyên thân hàm thuần của js/legacy-routes.js, không phải bản sao rời.
  assert.match(landing, /function resolveLegacyRoute\(/);
  assert.match(landing, /addEventListener\(['"]hashchange['"]/);
  assert.doesNotMatch(landing, /src=["']\/js\/app\.js["']/);
  assert.doesNotMatch(landing, /id=["']team-route-handles["']/);
  assert.doesNotMatch(landing, /id=["']season-artifact-hashes["']/);
  // Landing chỉ có một h1 (tiêu đề hero); tên thương hiệu ở header là span, không phải h1 thứ hai.
  assert.equal((landing.match(/<h1\b/g) ?? []).length, 1);
  assert.match(landing, /<span class="brand-text"><span class="site-title">/);
  // Panel menu thả là danh sách link (disclosure) nên không khai aria-haspopup.
  assert.doesNotMatch(landing, /aria-haspopup/);
  assert.doesNotMatch(html, /aria-haspopup/);
  // Nguồn gốc QR (lệnh sinh + phiên bản qrcode) phải ra dist trong comment ngay đầu SVG;
  // frontmatter của DownloadQr.astro không được build xuất ra nên không tính.
  const qrProvenance = landing.match(/class="landing-qr-frame"[^>]*>\s*<svg\b[^>]*>\s*<!--([\s\S]*?)-->/)?.[1] ?? "";
  assert.ok(
    qrProvenance.includes('npx --yes qrcode@1.5.4 -t svg "https://tqccl.onelink.me/qmz6/qifw0r4t?af_qr=true"'),
    "QR SVG in dist/index.html lacks the generation command comment",
  );
  assert.match(qrProvenance, /qrcode@1\.5\.4/);
  // Mô tả /doi-chuan/ không nhắc bộ lọc điểm (đã bỏ từ Phase 5) và không nêu tên SGSDeck (nguồn ghi chung).
  const doiChuanDescription = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";
  assert.ok(doiChuanDescription, "/doi-chuan/ phải có meta description");
  assert.doesNotMatch(doiChuanDescription, /SGSDeck|điểm/i);
});

test("built dist declares canonical, article metadata, robots and the catalog sitemap", async () => {
  const site = await configuredSite();
  const origin = new URL(site).origin;
  // tqccl.com là domain chính: canonical, og, sitemap và robots đều trỏ về đây.
  assert.equal(origin, "https://tqccl.com");
  const rootHref = new URL("/", origin).href;
  const read = (relative) => readFile(new URL(`../dist/${relative}`, import.meta.url), "utf8");
  const catalog = await teamDetailCatalog();

  const index = await read("index.html");
  assert.equal(linkHref(index, "canonical"), rootHref);
  assert.equal(metaContent(index, "og:url"), rootHref);
  assert.equal(metaContent(index, "og:type"), "website");

  for (const entry of [catalog.recommended[0], catalog.legacy[0], catalog.khaiHoang[0]]) {
    assert.ok(entry, "the catalog must publish all three detail families");
    // Canonical theo ngôn ngữ: bản Trung trỏ chính URL `/zh/…` của nó, không gộp về bản Việt.
    for (const [htmlPath, routePath] of [[entry.htmlPath, entry.routePath], [`zh/${entry.htmlPath}`, zhPathOf(entry.routePath)]]) {
      const html = await read(htmlPath);
      const canonical = new URL(routePath, origin).href;
      assert.equal(linkHref(html, "canonical"), canonical, htmlPath);
      assert.equal(metaContent(html, "og:url"), canonical, htmlPath);
      assert.equal(metaContent(html, "og:type"), "article", htmlPath);
    }
  }

  const notFound = await read("404.html");
  assert.equal(metaContent(notFound, "robots"), "noindex");
  assert.equal(linkHref(notFound, "canonical"), null);
  assert.equal(metaContent(notFound, "og:url"), null);

  const robots = await read("robots.txt");
  assert.deepEqual(
    await readFile(new URL("../dist/robots.txt", import.meta.url)),
    await readFile(new URL("../public/robots.txt", import.meta.url)),
  );
  // Mỗi nhóm (mọi bot + bot AI khai tường minh) cho phép toàn site, chỉ chặn trang quản trị và API.
  const groups = robots.split(/\n\s*\n/u).map((block) => block.split(/\r?\n/u).filter(Boolean));
  const sitemapLine = groups.pop();
  assert.deepEqual(sitemapLine, [`Sitemap: ${rootHref}sitemap.xml`]);
  assert.deepEqual(groups.map((group) => group[0]), ["User-agent: *", "User-agent: GPTBot", "User-agent: ClaudeBot", "User-agent: PerplexityBot", "User-agent: Google-Extended"]);
  for (const group of groups) {
    assert.deepEqual(group.slice(1), ["Allow: /", "Disallow: /quan-tri/", "Disallow: /zh/quan-tri/", "Disallow: /api/"], group[0]);
  }

  const sitemap = await read("sitemap.xml");
  assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/u);
  const locations = [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/gu)].map(([, location]) => location);
  // Release baseline: Landing, 8 trang mục, 7 trang nhóm Tra cứu, 4 trang chính sách, 1366 Recommended, 166 legacy, 17 Khai hoang,
  // 938 trang riêng mục Tra cứu (251 tướng, 409 chiến pháp sau đợt theo client Global) — mỗi route hai ngôn ngữ — và 2 trang danh sách blog (build không khai COMMUNITY_API_ORIGIN nên chưa có bài).
  const lookupRoutes = await lookupDetailRoutes();
  assert.equal(lookupRoutes.entries.length, 938);
  // + trang mùa Đội chuẩn: mỗi mùa cũ có đội một trang, hai ngôn ngữ (mùa hiện tại và mùa 0 đội không có).
  const { seasonPages } = await import("../src/lib/season-pages.ts");
  const { pages: seasonPageList } = await seasonPages();
  assert.ok(seasonPageList.length > 10);
  assert.equal(locations.length, 5016 + 2 * seasonPageList.length);
  assert.deepEqual(
    locations,
    [rootHref, ...[
      "/zh/",
      ...[
        ...SECTION_PAGE_SPECS.map(({ path }) => `/${path}/`),
        ...LOOKUP_GROUP_PATHS,
        ...STATIC_PAGE_PATHS,
        ...[...catalog.recommended, ...catalog.legacy, ...catalog.khaiHoang].map((entry) => entry.routePath),
        ...lookupRoutes.entries.map((entry) => entry.path),
        ...seasonPageList.map((page) => page.routePath),
      ].flatMap((path) => [path, zhPathOf(path)]),
      "/bai-viet/",
      "/zh/bai-viet/",
    ].sort().map((path) => new URL(path, origin).href)],
  );
  for (const location of locations) {
    const url = new URL(location);
    assert.equal(url.origin, origin, location);
    assert.equal(url.pathname.startsWith("/teams/"), false, location);
  }
});

test("every canonical page declares its own-language site name, locale and an absolute og:image shipped in dist", async () => {
  const origin = new URL(await configuredSite()).origin;
  const sitemap = await readFile(new URL("../dist/sitemap.xml", import.meta.url), "utf8");
  const pages = [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/gu)].map(([, location]) => new URL(location).pathname);
  const images = new Set();
  for (const pathname of pages) {
    const html = await readFile(new URL(`../dist${pathname}index.html`, import.meta.url), "utf8");
    assert.ok(linkHref(html, "canonical"), pathname);
    const zh = pathname.startsWith("/zh/");
    assert.equal(metaContent(html, "og:site_name"), zh ? "三国志战略版攻略手册" : "Cẩm Nang Game Tam Quốc Chí - Chiến Lược", pathname);
    assert.equal(metaContent(html, "og:locale"), zh ? "zh_CN" : "vi_VN", pathname);
    assert.match(html, zh ? /<html lang="zh-Hans"/u : /<html lang="vi"/u, pathname);
    const image = metaContent(html, "og:image");
    assert.ok(image, `${pathname} lacks og:image`);
    const url = new URL(image);
    assert.equal(url.origin, origin, pathname);
    images.add(url.pathname);
  }
  for (const pathname of images) {
    const info = await stat(new URL(`../dist${pathname}`, import.meta.url));
    assert.ok(info.isFile() && info.size > 0, `${pathname} must ship in dist`);
  }
});

test("every built page runs the host bridge as the first head script", async () => {
  const distDir = new URL("../dist/", import.meta.url);
  const pages = (await readdir(distDir, { recursive: true })).filter((path) => path.endsWith(".html"));
  assert.ok(pages.length > 1500, `only ${pages.length} HTML pages`);
  const sources = new Set();
  for (const path of pages) {
    const html = await readFile(new URL(path, distDir), "utf8");
    const head = html.match(/<head>([\s\S]*?)<\/head>/u)?.[1] ?? "";
    const first = head.match(/<script\b([^>]*)>([\s\S]*?)<\/script>/u);
    assert.ok(first, `${path} has no head script`);
    assert.match(first[1], /\bid="host-bridge"/u, `${path}: the first head script must be the host bridge`);
    assert.ok(head.indexOf("<script") < head.indexOf('rel="stylesheet"'), path);
    sources.add(first[2]);
  }
  assert.equal(sources.size, 1, "every page must ship the same bridge");
  const [source] = sources;

  // Chạy đúng byte đã build trong cửa sổ giả: host cũ mang dữ liệu đi, host chính nhận lại.
  const fakeWindow = (href, entries) => {
    const url = new URL(href);
    const store = new Map(Object.entries(entries));
    const calls = [];
    return {
      store,
      calls,
      window: {
        localStorage: { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) },
        location: { hostname: url.hostname, pathname: url.pathname, search: url.search, hash: url.hash, replace: (to) => calls.push(to) },
        history: { replaceState: (_state, _title, to) => calls.push(to) },
      },
    };
  };
  const legacy = fakeWindow("https://tqccl.pages.dev/theo-doi-chieu-mo/?a=1#x", { tqcclRecruitTracker: "{}", other: "no" });
  vm.runInNewContext(source, { window: legacy.window });
  assert.equal(legacy.calls.length, 1);
  assert.match(legacy.calls[0], /^https:\/\/tqccl\.com\/theo-doi-chieu-mo\/\?a=1#tqccl-migrate=/u);
  const primary = fakeWindow(legacy.calls[0], {});
  vm.runInNewContext(source, { window: primary.window });
  assert.deepEqual(primary.calls, ["/theo-doi-chieu-mo/?a=1#x"]);
  assert.deepEqual(Object.fromEntries(primary.store), { tqcclRecruitTracker: "{}" });
  for (const href of ["https://preview.tqccl.pages.dev/", "http://127.0.0.1:4174/", "http://localhost:4321/"]) {
    const other = fakeWindow(href, { theme: "dark" });
    vm.runInNewContext(source, { window: other.window });
    assert.deepEqual(other.calls, [], href);
  }
});

test("sitemap endpoint publishes exactly the root page plus the catalog routes", async () => {
  const site = await configuredSite();
  const origin = new URL(site).origin;
  const catalog = await teamDetailCatalog();
  const lookupRoutes = await lookupDetailRoutes();
  const { seasonPages } = await import("../src/lib/season-pages.ts");
  const { pages: seasonPageList } = await seasonPages();
  const response = await sitemapGet({ site: new URL(site) });

  assert.equal(response.headers.get("content-type"), SITEMAP_MIME);
  const xml = await response.text();
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/u);
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9" xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml">/u);
  assert.doesNotMatch(xml, /<changefreq>|<priority>/u);

  const locations = [...xml.matchAll(/<loc>([^<]*)<\/loc>/gu)].map(([, location]) => location);
  // Mỗi route bản Việt có bản Trung cùng đường dẫn dưới /zh (Landing, 8 trang mục, 7 trang nhóm Tra cứu, trang tĩnh, 3 họ chi tiết đội, 938 trang riêng mục Tra cứu).
  const mirrored = [
    "/",
    ...SECTION_PAGE_SPECS.map(({ path }) => `/${path}/`),
    ...LOOKUP_GROUP_PATHS,
    ...STATIC_PAGE_PATHS,
    ...[...catalog.recommended, ...catalog.legacy, ...catalog.khaiHoang].map((entry) => entry.routePath),
    ...lookupRoutes.entries.map((entry) => entry.path),
    ...seasonPageList.map((page) => page.routePath),
  ];
  const routePaths = [...mirrored.flatMap((path) => [path, zhPathOf(path)]), "/bai-viet/", "/zh/bai-viet/"].filter((path) => path !== "/");
  assert.equal(catalog.recommended.length, 1366);
  assert.equal(catalog.legacy.length, 166);
  assert.equal(catalog.khaiHoang.length, 17);
  assert.equal(lookupRoutes.entries.length, 938);
  assert.equal(locations.length, 5016 + 2 * seasonPageList.length);
  assert.deepEqual(
    locations,
    [new URL("/", origin).href, ...routePaths.sort().map((path) => new URL(path, origin).href)],
  );
  // Mọi URL có bản gương khai đủ bộ hreflang trỏ cặp trang, x-default là bản Việt.
  const urls = xml.split("<url>").slice(1);
  for (const block of urls) {
    const loc = block.match(/<loc>([^<]*)<\/loc>/u)[1];
    const viPath = new URL(loc).pathname.replace(/^\/zh(?=\/)/u, "");
    const alternates = [...block.matchAll(/<xhtml:link rel="alternate" hreflang="([^"]+)" href="([^"]+)"\/>/gu)].map(([, lang, href]) => `${lang} ${href}`);
    assert.deepEqual(alternates, [
      `vi ${new URL(viPath, origin).href}`,
      `zh-Hans ${new URL(zhPathOf(viPath), origin).href}`,
      `x-default ${new URL(viPath, origin).href}`,
    ], loc);
  }
  assert.equal(new Set(locations).size, locations.length);
  assert.equal(locations.filter((location) => new URL(location).pathname.startsWith("/teams/")).length, 0);
});

test("sitemap endpoint fails closed on a missing origin, duplicates and the retired family", async () => {
  await assert.rejects(sitemapGet({ site: undefined }), /origin/iu);
  await assert.rejects(sitemapGet({ site: new URL("file:///tmp/site") }), /http/iu);
  assert.throws(() => sitemapLocations("not a url", ["/"]), /origin/iu);
  assert.throws(() => sitemapLocations(FIXTURE_ORIGIN, ["/doi-chuan/a/", "/doi-chuan/a/"]), /duplicate/iu);
  assert.throws(() => sitemapLocations(FIXTURE_ORIGIN, ["/teams/legacy/team-intro-0/"]), /retired/iu);
});

test("sitemap XML escapes loc metacharacters", () => {
  // `&` and `'` survive URL normalization in a path, so the emitted text must escape them.
  const xml = sitemapDocument(FIXTURE_ORIGIN, ["/doi-chuan/a&b'c/"]);
  assert.match(xml, /<loc>https:\/\/tqccl\.com\/doi-chuan\/a&amp;b&apos;c\/<\/loc>/u);
  assert.doesNotMatch(xml, /&(?!amp;|lt;|gt;|quot;|apos;)/u);
});

test("sitemap dates blog posts and each blog index by its newest post", () => {
  const xml = sitemapDocument(FIXTURE_ORIGIN, blogSitemapRoutes([
    { path: "/bai-viet/cu/", lang: "vi", updatedAt: "2026-09-01T00:00:00.000Z" },
    { path: "/bai-viet/moi/", lang: "vi", updatedAt: "2026-09-20T08:00:00.000Z" },
  ]));
  const entry = (path) => xml.match(new RegExp(`<loc>${FIXTURE_ORIGIN}${path}</loc>\\n(?:    <lastmod>([^<]+)</lastmod>\\n)?`, "u"));
  assert.equal(entry("/bai-viet/")[1], "2026-09-20T08:00:00.000Z");
  assert.equal(entry("/bai-viet/cu/")[1], "2026-09-01T00:00:00.000Z");
  // Bản zh chưa có bài: trang danh sách vẫn được publish nhưng không có ngày sửa.
  assert.ok(entry("/zh/bai-viet/"));
  assert.equal(entry("/zh/bai-viet/")[1], undefined);
});

/** Một bài đã render tối thiểu cho fixture dist (các trường mà JSON-LD, RSS và llms.txt dùng). */
const FIXTURE_POST = {
  id: "p1", slug: "cach-danh-dat", lang: "vi", translationKey: null, title: "Cách đánh đất", description: "Mẹo đánh đất cấp 6.",
  bodyMarkdown: "Nội dung", faq: [], tags: ["khai hoang"], coverImage: null, author: { name: "Nguyên" },
  publishedAt: "2026-09-10T00:00:00.000Z", updatedAt: "2026-09-12T00:00:00.000Z", createdAt: "2026-09-09T00:00:00.000Z",
  path: "/bai-viet/cach-danh-dat/", html: "<p>Nội dung</p>", headings: [], readingMinutes: 1,
};

test("dist verifier admits blog posts only with consistent JSON-LD, index, feed and dated sitemap", async (t) => {
  const { rm } = await import("node:fs/promises");
  const projectDir = await mkdtemp(join(tmpdir(), "tqccl-blog-project-"));
  const distDir = await mkdtemp(join(tmpdir(), "tqccl-blog-dist-"));
  t.after(() => Promise.all([rm(projectDir, { recursive: true, force: true }), rm(distDir, { recursive: true, force: true })]));
  await mkdir(join(projectDir, "public"), { recursive: true });
  await writeFile(join(projectDir, "public", "_headers"), FIXTURE_HEADERS);
  await writeFile(join(distDir, "_headers"), FIXTURE_HEADERS);
  await writeFile(join(projectDir, "public", "_redirects"), FIXTURE_REDIRECTS);
  await writeFile(join(distDir, "_redirects"), FIXTURE_REDIRECTS);
  await writeStaticImages(projectDir, distDir);
  await writeStaticFonts(projectDir, distDir);
  await writeRecommendedFixture(projectDir, distDir);
  const verify = () => verifyAstroDist({
    projectRoot: new URL(`file://${projectDir}/`),
    distDir: new URL(`file://${distDir}/`),
    manifest: [],
  });
  await verify();

  const postHtml = (data) => `<!doctype html><link rel="canonical" href="${FIXTURE_ORIGIN}${FIXTURE_POST.path}"><script type="application/ld+json">${jsonLd(data)}</script>\n`;
  await mkdir(join(distDir, "bai-viet", FIXTURE_POST.slug), { recursive: true });
  await writeFile(join(distDir, "bai-viet", FIXTURE_POST.slug, "index.html"), postHtml(articleJsonLd(FIXTURE_POST, FIXTURE_ORIGIN)));
  // Bài mới trong dist mà danh sách, feed, sitemap chưa nhắc tới là output lệch.
  await assert.rejects(verify(), /Blog index does not list/u);
  await writeBlogOutputs(distDir, [FIXTURE_POST]);
  await assert.rejects(verify(), /sitemap/iu);
  const detailPaths = [`/doi-khac/${LEGACY_ROUTE_SEGMENT}/`, `/khai-hoang/${KHAIHOANG_ROUTE_SEGMENT}/`];
  await writeFile(join(distDir, "sitemap.xml"), sitemapDocument(FIXTURE_ORIGIN, [
    ...mirroredSitemapRoutes(mirroredSitemapPaths(detailPaths)),
    ...blogSitemapRoutes([FIXTURE_POST]),
  ]));
  await verify();

  // JSON-LD sai ngôn ngữ hoặc thiếu hẳn đều bị từ chối.
  await writeFile(join(distDir, "bai-viet", FIXTURE_POST.slug, "index.html"), postHtml({ ...articleJsonLd(FIXTURE_POST, FIXTURE_ORIGIN), inLanguage: "en" }));
  await assert.rejects(verify(), /BlogPosting JSON-LD/u);
  await writeFile(join(distDir, "bai-viet", FIXTURE_POST.slug, "index.html"), "<!doctype html><p>bài</p>\n");
  await assert.rejects(verify(), /BlogPosting JSON-LD/u);
});

test("dist verifier locks the emitted sitemap to the catalog route set", async (t) => {
  const { rm } = await import("node:fs/promises");
  const projectDir = await mkdtemp(join(tmpdir(), "tqccl-sitemap-source-"));
  const distDir = await mkdtemp(join(tmpdir(), "tqccl-sitemap-dist-"));
  t.after(async () => {
    await Promise.all([
      rm(projectDir, { recursive: true, force: true }),
      rm(distDir, { recursive: true, force: true }),
    ]);
  });
  await mkdir(join(projectDir, "public"), { recursive: true });
  await writeFile(join(projectDir, "public", "_headers"), FIXTURE_HEADERS);
  await writeFile(join(distDir, "_headers"), FIXTURE_HEADERS);
  await writeFile(join(projectDir, "public", "_redirects"), FIXTURE_REDIRECTS);
  await writeFile(join(distDir, "_redirects"), FIXTURE_REDIRECTS);
  await writeStaticImages(projectDir, distDir);
  await writeStaticFonts(projectDir, distDir);
  await writeRecommendedFixture(projectDir, distDir);
  const verify = () => verifyAstroDist({
    projectRoot: new URL(`file://${projectDir}/`),
    distDir: new URL(`file://${distDir}/`),
    manifest: [],
  });

  await verify();
  const root = `${FIXTURE_ORIGIN}/`;
  const detail = `${FIXTURE_ORIGIN}/doi-khac/${LEGACY_ROUTE_SEGMENT}/`;
  const khaiHoang = `${FIXTURE_ORIGIN}/khai-hoang/${KHAIHOANG_ROUTE_SEGMENT}/`;
  const locOf = (entry) => entry.loc;
  // Generator: root trước, rồi toàn bộ route (trang mục + chi tiết, mỗi route hai ngôn ngữ) đã sort.
  const complete = orderedSitemap(FIXTURE_SITEMAP_ENTRIES);
  const without = (location) => orderedSitemap(FIXTURE_SITEMAP_ENTRIES.filter((entry) => locOf(entry) !== location));
  const rejected = {
    "the root page is missing": fixtureSitemapXml(FIXTURE_SITEMAP_ENTRIES.filter((entry) => locOf(entry) !== root).sort((a, b) => (a.loc < b.loc ? -1 : 1))),
    "a section page is missing": without(SECTION_LOCATIONS[0]),
    "a Chinese section page is missing": without(`${FIXTURE_ORIGIN}/zh/doi-chuan/`),
    "the Chinese Landing is missing": without(`${FIXTURE_ORIGIN}/zh/`),
    "a legacy route is missing": without(detail),
    "a Chinese legacy route is missing": without(`${FIXTURE_ORIGIN}/zh/doi-khac/${LEGACY_ROUTE_SEGMENT}/`),
    "a Khai hoang route is missing": without(khaiHoang),
    "a blog index is missing": without(`${FIXTURE_ORIGIN}/zh/bai-viet/`),
    "a page loses its hreflang alternates": orderedSitemap(FIXTURE_SITEMAP_ENTRIES.map((entry) => (entry.loc === detail ? entry.loc : entry))),
    "the retired family is published": orderedSitemap([...FIXTURE_SITEMAP_ENTRIES, `${FIXTURE_ORIGIN}/teams/legacy/${LEGACY_TEAM_ID}/`]),
    "a URL is published twice": orderedSitemap([...FIXTURE_SITEMAP_ENTRIES, khaiHoang]),
  };
  for (const [label, xml] of Object.entries(rejected)) {
    await writeFile(join(distDir, "sitemap.xml"), xml);
    await assert.rejects(verify(), /sitemap/i, label);
  }
  await writeFile(join(distDir, "sitemap.xml"), complete);
  await verify();

  // A shell or payload served as sitemap.xml is not a sitemap.
  await writeFile(join(distDir, "sitemap.xml"), "<!doctype html>\n");
  await assert.rejects(verify(), /sitemap/i);
  await writeFile(join(distDir, "sitemap.xml"), complete);
  await verify();

  // robots.txt stays a byte-identical copy of its reviewed source.
  await writeFile(join(distDir, "robots.txt"), "User-agent: *\nDisallow: /\n");
  await assert.rejects(verify(), /robots\.txt/i);
});

const LOOKUP_FILES = ["heroes-dict.json", "lookup-catalog.json", "lookup-manifest.json", "tactics.json"];
const SEASON_SIDECARS = ["season-registry", "season-evidence", "season-team-configs", "season-team-evaluations", "season-content-links"];
const dataEntry = (routeParam) => ({
  kind: "data",
  routeParam,
  sourceBasename: `${routeParam}.json`,
  publicationClass: "runtime",
  mimeType: "application/json; charset=utf-8",
});

/** Bundle Tra cứu hợp lệ trọn vẹn (verifier chạy `validateLookupBundle` trên bộ đã phát). */
async function writeLookupBundle(dataDir, overrides = {}) {
  const payloads = {
    "heroes-dict.json": jsonBytes(heroesDoc()),
    "tactics.json": jsonBytes(tacticsDoc()),
    "lookup-catalog.json": jsonBytes(catalogDoc()),
    ...overrides,
  };
  const files = {};
  for (const name of Object.keys(payloads).sort()) files[name] = sha256(payloads[name]);
  const manifest = {
    schemaVersion: 1,
    generationId: `lookup:${sha256(Buffer.from(`${JSON.stringify(files)}\n`))}`,
    files,
  };
  payloads["lookup-manifest.json"] = jsonBytes(manifest);
  await mkdir(dataDir, { recursive: true });
  for (const [name, bytes] of Object.entries(payloads)) await writeFile(join(dataDir, name), bytes);
  return { payloads, manifest };
}

async function lookupRoot(t, prefix) {
  const rootDir = await mkdtemp(join(tmpdir(), prefix));
  t.after(async () => {
    await import("node:fs/promises").then(({ rm }) => rm(rootDir, { recursive: true, force: true }));
  });
  const bundle = await writeLookupBundle(join(rootDir, "data"));
  return { rootDir, ...bundle };
}

test("manifest adds the lookup modules and data artifacts without dropping completed entries", () => {
  const byRoute = Object.fromEntries(PUBLIC_ARTIFACTS.map((entry) => [`${entry.kind}/${entry.routeParam}`, entry]));
  for (const routeParam of ["lookup-data", "unified-lookup", "lookup-detail", "recommended-reference-state", "recommended-reference-render", "app"]) {
    assert.equal(byRoute[`js/${routeParam}`]?.publicationClass, "runtime", `js/${routeParam}`);
  }
  for (const routeParam of ["lookup-catalog", "lookup-manifest", "heroes-dict", "tactics", ...SEASON_SIDECARS]) {
    const entry = byRoute[`data/${routeParam}`];
    assert.equal(entry?.publicationClass, "runtime", `data/${routeParam}`);
    assert.equal(entry.mimeType, "application/json; charset=utf-8");
    assert.equal(entry.sourceBasename, `${routeParam}.json`);
  }
  validatePublicArtifactManifest(PUBLIC_ARTIFACTS);
});

test("lookup publication snapshot returns the verified four-file bundle", async (t) => {
  const { rootDir, payloads, manifest } = await lookupRoot(t, "tqccl-lookup-snapshot-");
  const snapshot = await lookupPublicationSnapshot({ rootDir });

  assert.equal(snapshot.generationId, manifest.generationId);
  assert.deepEqual(snapshot.manifest, manifest);
  assert.deepEqual(Object.keys(snapshot.files).sort(), LOOKUP_FILES);
  for (const [name, bytes] of Object.entries(payloads)) {
    assert.deepEqual(Buffer.from(snapshot.files[name]), bytes);
  }
  assert.deepEqual(await lookupPublicationSnapshot({ rootDir }), snapshot);
});

test("lookup publication snapshot rejects incoherent, incomplete and symlinked bundles", async (t) => {
  const cases = {
    "tampered payload": async (dataDir) => writeFile(join(dataDir, "tactics.json"), jsonBytes([{ id: "tactic:mixed" }])),
    "digest rewritten in manifest": async (dataDir) => {
      const manifest = JSON.parse(await readFile(join(dataDir, "lookup-manifest.json"), "utf8"));
      manifest.files["heroes-dict.json"] = "0".repeat(64);
      await writeFile(join(dataDir, "lookup-manifest.json"), jsonBytes(manifest));
    },
    "generation id not derived from digests": async (dataDir) => {
      const manifest = JSON.parse(await readFile(join(dataDir, "lookup-manifest.json"), "utf8"));
      manifest.generationId = `lookup:${"1".repeat(64)}`;
      await writeFile(join(dataDir, "lookup-manifest.json"), jsonBytes(manifest));
    },
    "missing catalog payload": async (dataDir) => {
      await import("node:fs/promises").then(({ rm }) => rm(join(dataDir, "lookup-catalog.json")));
    },
    "manifest declaring itself": async (dataDir) => {
      const manifest = JSON.parse(await readFile(join(dataDir, "lookup-manifest.json"), "utf8"));
      manifest.files["lookup-manifest.json"] = "0".repeat(64);
      await writeFile(join(dataDir, "lookup-manifest.json"), jsonBytes(manifest));
    },
    "symlinked payload": async (dataDir, outsideDir) => {
      const { rm } = await import("node:fs/promises");
      const planted = join(outsideDir, "heroes-dict.json");
      await writeFile(planted, jsonBytes([{ id: "hero:outside" }]));
      await rm(join(dataDir, "heroes-dict.json"));
      await symlink(planted, join(dataDir, "heroes-dict.json"));
    },
  };
  for (const [label, mutate] of Object.entries(cases)) {
    const { rootDir } = await lookupRoot(t, "tqccl-lookup-invalid-");
    const outsideDir = await mkdtemp(join(tmpdir(), "tqccl-lookup-outside-"));
    t.after(async () => {
      await import("node:fs/promises").then(({ rm }) => rm(outsideDir, { recursive: true, force: true }));
    });
    await mutate(join(rootDir, "data"), outsideDir);
    await assert.rejects(lookupPublicationSnapshot({ rootDir }), /lookup/i, label);
  }
});

test("season hashes and data routes serve the pinned lookup generation", async (t) => {
  const { rootDir, payloads, manifest } = await lookupRoot(t, "tqccl-lookup-pin-");
  const dataDir = join(rootDir, "data");
  const names = [...SEASON_SIDECARS, "teams", "coexist", "books-dict"];
  for (const name of names) await writeFile(join(dataDir, `${name}.json`), jsonBytes([]));
  const artifactManifest = [...names, "heroes-dict", "tactics", "lookup-catalog", "lookup-manifest"].map(dataEntry);

  const hashes = await seasonArtifactHashes({ rootDir, manifest: artifactManifest });
  assert.equal(hashes["heroes-dict"], `sha256:${manifest.files["heroes-dict.json"]}`);
  assert.equal(hashes["tactics"], `sha256:${manifest.files["tactics.json"]}`);

  await writeFile(join(dataDir, "heroes-dict.json"), jsonBytes([{ id: "hero:promoted-mid-build" }]));
  const rehashed = await seasonArtifactHashes({ rootDir, manifest: artifactManifest });
  assert.deepEqual(rehashed, hashes);
  const served = await readPublicArtifact({ kind: "data", routeParam: "heroes-dict", rootDir, manifest: artifactManifest });
  assert.deepEqual(Buffer.from(served.bytes), payloads["heroes-dict.json"]);
});

test("dist verifier byte-locks the self-hosted font directory", async (t) => {
  const { rm } = await import("node:fs/promises");
  const projectDir = await mkdtemp(join(tmpdir(), "tqccl-fonts-source-"));
  const distDir = await mkdtemp(join(tmpdir(), "tqccl-fonts-dist-"));
  t.after(async () => {
    await Promise.all([
      rm(projectDir, { recursive: true, force: true }),
      rm(distDir, { recursive: true, force: true }),
    ]);
  });
  await mkdir(join(projectDir, "public"), { recursive: true });
  await writeFile(join(projectDir, "public", "_headers"), FIXTURE_HEADERS);
  await writeFile(join(distDir, "_headers"), FIXTURE_HEADERS);
  await writeFile(join(projectDir, "public", "_redirects"), FIXTURE_REDIRECTS);
  await writeFile(join(distDir, "_redirects"), FIXTURE_REDIRECTS);
  await writeStaticImages(projectDir, distDir);
  await writeStaticFonts(projectDir, distDir);
  await writeRecommendedFixture(projectDir, distDir);
  const verify = () => verifyAstroDist({
    projectRoot: new URL(`file://${projectDir}/`),
    distDir: new URL(`file://${distDir}/`),
    manifest: [],
  });

  const result = await verify();
  assert.ok(result.staticFileCount >= 16, "mọi file font + giấy phép phải nằm trong allowlist dist");
  assert.ok(result.files.includes("fonts/OFL.txt"));

  // Sửa nội dung một file font trong dist là lệch byte với nguồn đã review.
  await writeFile(join(distDir, "fonts", "OFL.txt"), "tampered\n");
  await assert.rejects(verify(), /fonts\/OFL\.txt/i);
  await writeStaticFonts(projectDir, distDir);

  // File lạ trong dist/fonts không được lọt qua allowlist.
  await writeFile(join(distDir, "fonts", "extra.woff2"), "x");
  await assert.rejects(verify(), /unexpected: fonts\/extra\.woff2/i);
  await rm(join(distDir, "fonts", "extra.woff2"));

  // Thiếu một file font đã publish cũng chặn.
  await rm(join(distDir, "fonts", "OFL.txt"));
  await assert.rejects(verify(), /missing: fonts\/OFL\.txt/i);

  // Chân dung tướng tự lưu cũng nằm trong allowlist: file lạ hoặc lệch byte đều bị chặn.
  await writeStaticFonts(projectDir, distDir);
  await verify();
  await writeFile(join(distDir, "heroes", "extra.webp"), "x");
  await assert.rejects(verify(), /unexpected: heroes\/extra\.webp/i);
  await rm(join(distDir, "heroes", "extra.webp"));
  await writeFile(join(distDir, "heroes", "sample.webp"), "tampered");
  await assert.rejects(verify(), /heroes\/sample\.webp/i);
});

async function lookupDistFixture(t) {
  const projectDir = await mkdtemp(join(tmpdir(), "tqccl-lookup-dist-source-"));
  const distDir = await mkdtemp(join(tmpdir(), "tqccl-lookup-dist-out-"));
  t.after(async () => {
    const { rm } = await import("node:fs/promises");
    await Promise.all([rm(projectDir, { recursive: true, force: true }), rm(distDir, { recursive: true, force: true })]);
  });
  const { payloads, manifest } = await writeLookupBundle(join(projectDir, "data"));
  await mkdir(join(distDir, "data"), { recursive: true });
  for (const [name, bytes] of Object.entries(payloads)) await writeFile(join(distDir, "data", name), bytes);
  await mkdir(join(projectDir, "public"), { recursive: true });
  const headers = "/\n  Cache-Control: max-age=0\n";
  await writeFile(join(projectDir, "public", "_headers"), headers);
  await writeFile(join(distDir, "_headers"), headers);
  await writeFile(join(projectDir, "public", "_redirects"), FIXTURE_REDIRECTS);
  await writeFile(join(distDir, "_redirects"), FIXTURE_REDIRECTS);
  await writeStaticImages(projectDir, distDir);
  await writeStaticFonts(projectDir, distDir);
  await writeRecommendedFixture(projectDir, distDir);
  // Pin mùa sống ở mọi trang mục có phạm vi mùa, cả bản Việt lẫn bản Trung; fixture phải đổi đồng bộ mọi trang.
  const marker = async (hashes) => {
    for (const pagePath of SECTION_PAGE_SPECS.filter((entry) => entry.season)
      .flatMap((spec) => [join(distDir, spec.path, "index.html"), join(distDir, "zh", spec.path, "index.html")])) {
      const html = await readFile(pagePath, "utf8");
      const stripped = html.replace(/<script id="season-artifact-hashes"[^>]*>[^<]*<\/script>\n?/, "");
      await writeFile(pagePath, `${stripped.trimEnd()}<script id="season-artifact-hashes" type="application/json">${JSON.stringify(hashes)}</script>\n`);
    }
  };
  await marker({
    "heroes-dict": `sha256:${manifest.files["heroes-dict.json"]}`,
    tactics: `sha256:${manifest.files["tactics.json"]}`,
  });
  return {
    projectDir,
    distDir,
    payloads,
    manifest,
    marker,
    verify: () => verifyAstroDist({
      projectRoot: new URL(`file://${projectDir}/`),
      distDir: new URL(`file://${distDir}/`),
      manifest: ["heroes-dict", "tactics", "lookup-catalog", "lookup-manifest"].map(dataEntry),
    }),
  };
}

test("dist verifier accepts one lookup generation across HTML, routes and emitted bytes", async (t) => {
  const fixture = await lookupDistFixture(t);
  const result = await fixture.verify();
  assert.equal(result.lookupGenerationId, fixture.manifest.generationId);
  assert.equal(result.unexpectedFiles.length, 0);
});

test("dist verifier rejects HTML pinned to an older generation than the emitted routes", async (t) => {
  const fixture = await lookupDistFixture(t);
  await fixture.marker({
    "heroes-dict": `sha256:${sha256(jsonBytes([{ id: "hero:previous-generation" }]))}`,
    tactics: `sha256:${fixture.manifest.files["tactics.json"]}`,
  });
  await assert.rejects(fixture.verify(), /generation|season-artifact-hashes/i);
});

test("dist verifier rejects emitted dictionaries that leave the lookup manifest", async (t) => {
  const fixture = await lookupDistFixture(t);
  const desynced = jsonBytes([{ id: "hero:desynced" }]);
  await writeFile(join(fixture.projectDir, "data", "heroes-dict.json"), desynced);
  await writeFile(join(fixture.distDir, "data", "heroes-dict.json"), desynced);
  await fixture.marker({
    "heroes-dict": `sha256:${sha256(desynced)}`,
    tactics: `sha256:${fixture.manifest.files["tactics.json"]}`,
  });
  await assert.rejects(fixture.verify(), /lookup manifest|generation/i);
});

test("dist verifier still enforces the Recommended publication pin alongside lookup checks", async (t) => {
  const fixture = await lookupDistFixture(t);
  const pagePath = join(fixture.distDir, "doi-chuan", "index.html");
  const html = await readFile(pagePath, "utf8");
  await writeFile(pagePath, html.replace(/"generationId":"[0-9a-f]{64}"/, `"generationId":"${"3".repeat(64)}"`));
  await assert.rejects(fixture.verify(), /Recommended/i);
});

/** Ledger slug của fixture (cùng canonical JSON + digest mà `lookup_route_handles.py` và loader TS dùng). */
const canonicalJson = (value) => (value && typeof value === "object"
  ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`
  : JSON.stringify(value));

/** Dist fixture có đủ bundle Tra cứu + books-dict + ledger: trang nhóm đủ mọi mục, trang riêng từng mục, sitemap có mục. */
async function lookupItemsFixture(t) {
  const fixture = await lookupDistFixture(t);
  const booksBytes = jsonBytes([{ id: "book:di-truc-bao-oan", viet: "Dĩ Trực Báo Oán", hanViet: "Dĩ Trực Báo Oán", chinese: "以直报怨", effect: "效果", effectViet: "Hiệu ứng", effectVersion: "2021-11" }]);
  for (const dir of [join(fixture.projectDir, "data"), join(fixture.distDir, "data")]) await writeFile(join(dir, "books-dict.json"), booksBytes);
  await mkdir(join(fixture.projectDir, "pipeline"), { recursive: true });
  await writeFile(join(fixture.projectDir, "pipeline", "recommended-identity-map.json"), jsonBytes({ entries: [] }));
  const manifest = ["heroes-dict", "tactics", "lookup-catalog", "lookup-manifest", "books-dict"].map(dataEntry);
  // Trang nhóm gốc của fixture (một thẻ mẫu): làm khung để dựng lại với đủ mọi thẻ.
  const baseGroupPages = {};
  for (const locale of ["vi", "zh"]) {
    for (const spec of LOOKUP_GROUP_SPECS) {
      baseGroupPages[`${locale}/${spec.group}`] = await readFile(join(fixture.distDir, ...(locale === "zh" ? ["zh"] : []), spec.path, "index.html"), "utf8");
    }
  }
  const corpus = await lookupBuildCorpus({ rootDir: fixture.projectDir, manifest });
  const handles = Object.fromEntries(Object.entries(corpus.groups).map(([group, rows]) => [group, Object.fromEntries(rows.map((row) => [row.id, row.id.split(":")[1]]))]));
  const ledgerOf = (table) => {
    const retired = Object.fromEntries(Object.keys(table).map((group) => [group, {}]));
    return {
      schemaVersion: 1,
      generationId: fixture.manifest.generationId,
      booksSha256: sha256(booksBytes),
      handlesSha256: createHash("sha256").update(canonicalJson({ handles: table, retired })).digest("hex"),
      note: "fixture",
      handles: table,
      retired,
    };
  };
  const ledgerPath = join(fixture.projectDir, "pipeline", "lookup-route-handles.json");
  await writeFile(ledgerPath, jsonBytes(ledgerOf(handles)));
  const entries = Object.entries(handles).flatMap(([group, table]) => Object.entries(table).map(([id, slug]) => ({ group, id, slug, path: `/tra-cuu/${LOOKUP_GROUP_SPECS.find((spec) => spec.group === group).path.split("/")[1]}/${slug}/` })));
  const itemFile = (locale, entry) => join(fixture.distDir, ...(locale === "zh" ? ["zh"] : []), ...entry.path.split("/").filter(Boolean), "index.html");
  const itemHtml = (locale, entry, overrides = {}) => {
    const groupHref = `${locale === "zh" ? "/zh" : ""}/${LOOKUP_GROUP_SPECS.find((spec) => spec.group === entry.group).path}/`;
    const canonical = `${FIXTURE_ORIGIN}${locale === "zh" ? "/zh" : ""}${entry.path}`;
    return [
      `<!doctype html>${pairHead(locale, entry.path)}<title>${overrides.title ?? `${entry.id} ${locale}`}</title>`,
      `<meta name="description" content="${overrides.description ?? `mô tả ${entry.id} ${locale}`}">`,
      `<link rel="canonical" href="${overrides.canonical ?? canonical}">`,
      `<a class="detail-link detail-back-link" href="${groupHref}">Quay lại</a>`,
      `<section data-lookup-item-root><article data-lookup-item="${entry.id}"><h1>${entry.id}</h1></article></section>`,
      '<script type="module" src="/js/lookup-item-page.js"></script>\n',
    ].join("");
  };
  const groupHtml = (locale, spec, extraId = null) => {
    const ids = [...Object.keys(handles[spec.group]), ...(extraId ? [extraId] : [])];
    return baseGroupPages[`${locale}/${spec.group}`].replace(
      /<button type="button" class="lookup-card-button" data-lookup-id="[^"]*"><\/button>/u,
      ids.map((id) => `<a class="lookup-card-button" href="x" data-lookup-id="${id}"></a>`).join(""),
    );
  };
  const writeAll = async () => {
    for (const locale of ["vi", "zh"]) {
      for (const spec of LOOKUP_GROUP_SPECS) {
        await writeFile(join(fixture.distDir, ...(locale === "zh" ? ["zh"] : []), spec.path, "index.html"), groupHtml(locale, spec));
      }
      for (const entry of entries) {
        await mkdir(dirname(itemFile(locale, entry)), { recursive: true });
        await writeFile(itemFile(locale, entry), itemHtml(locale, entry));
      }
    }
    await writeFile(join(fixture.distDir, "sitemap.xml"), orderedSitemap([...FIXTURE_SITEMAP_ENTRIES, ...mirroredEntries(entries.map((entry) => entry.path))]));
  };
  return {
    ...fixture,
    entries,
    handles,
    ledgerPath,
    ledgerOf,
    itemFile,
    itemHtml,
    groupHtml,
    writeAll,
    verify: () => verifyAstroDist({ projectRoot: new URL(`file://${fixture.projectDir}/`), distDir: new URL(`file://${fixture.distDir}/`), manifest }),
  };
}

test("lookup fixture: books carry a frozen id, and renaming `viet` in the fixture creates no new book route", async (t) => {
  const fixture = await lookupItemsFixture(t);
  const bookIds = fixture.entries.filter((entry) => entry.group === "books").map((entry) => entry.id);
  assert.deepEqual(bookIds, ["book:di-truc-bao-oan"]);
  const renamed = jsonBytes([{ id: "book:di-truc-bao-oan", viet: "Lấy Thẳng Báo Oán", aliases: ["Dĩ Trực Báo Oán"], chinese: "以直报怨", effect: "效果", effectViet: "Hiệu ứng", effectVersion: "2021-11" }]);
  await writeFile(join(fixture.projectDir, "data", "books-dict.json"), renamed);
  const manifest = ["heroes-dict", "tactics", "lookup-catalog", "lookup-manifest", "books-dict"].map(dataEntry);
  const corpus = await lookupBuildCorpus({ rootDir: fixture.projectDir, manifest });
  assert.deepEqual(corpus.groups.books.map((row) => row.id), bookIds);
});

test("dist verifier admits the lookup item pages only with the ledger routes, own metadata and every card prerendered", async (t) => {
  const fixture = await lookupItemsFixture(t);
  assert.deepEqual([...new Set(fixture.entries.map((entry) => entry.group))].sort(), LOOKUP_GROUP_SPECS.map((spec) => spec.group).sort(), "fixture phải phủ đủ bảy nhóm");
  // Chưa có trang mục nào: allowlist thiếu file và sitemap thiếu URL.
  await assert.rejects(fixture.verify(), /allowlist mismatch/u);
  await fixture.writeAll();
  const result = await fixture.verify();
  assert.equal(result.unexpectedFiles.length, 0);

  const [first] = fixture.entries;
  const file = fixture.itemFile("vi", first);
  const restore = () => writeFile(file, fixture.itemHtml("vi", first));
  const rejected = {
    "canonical of another page": [fixture.itemHtml("vi", first, { canonical: `${FIXTURE_ORIGIN}/tra-cuu/tuong/khac/` }), /canonical/u],
    "a title shared with another page": [fixture.itemHtml("vi", first, { title: `${fixture.entries[1].id} vi` }), /share a title/u],
    "a description shared with another page": [fixture.itemHtml("vi", first, { description: `mô tả ${fixture.entries[1].id} vi` }), /share a description/u],
    "no profile of its own": [fixture.itemHtml("vi", first).replace(`data-lookup-item="${first.id}"`, 'data-lookup-item="hero:other"'), /prerendered profile/u],
    "two h1": [fixture.itemHtml("vi", first).replace("</article>", "<h1>x</h1></article>"), /exactly one h1/u],
    "the root application booted": [fixture.itemHtml("vi", first).replace("lookup-item-page.js", "app.js"), /only its own script/u],
    "no link back to the group page": [fixture.itemHtml("vi", first).replace(/href="\/tra-cuu\/[^"]+\/"/u, 'href="/"'), /link back to the group page/u],
    "a description ending in a colon": [fixture.itemHtml("vi", first, { description: "Ám Triều Dũng Động — chiến pháp phẩm A · Chủ động: " }), /dangling colon/u],
    "a description ending in a full-width colon": [fixture.itemHtml("vi", first, { description: "暗潮湧動（战法，品质A·主动）：" }), /dangling colon/u],
    "waiting text": [fixture.itemHtml("vi", first).replace("<h1>", "<h1>Đang tải chi tiết "), /waiting or JavaScript-required/u],
  };
  for (const [label, [html, pattern]] of Object.entries(rejected)) {
    await writeFile(file, html);
    await assert.rejects(fixture.verify(), pattern, label);
  }
  await restore();
  await fixture.verify();

  // Trang mục thiếu hoặc thừa so với ledger.
  const { rm } = await import("node:fs/promises");
  await rm(file);
  await assert.rejects(fixture.verify(), /missing: /u);
  await restore();
  await mkdir(join(fixture.distDir, "tra-cuu", "tuong", "khong-co-trong-ledger"), { recursive: true });
  await writeFile(join(fixture.distDir, "tra-cuu", "tuong", "khong-co-trong-ledger", "index.html"), fixture.itemHtml("vi", first));
  await assert.rejects(fixture.verify(), /unexpected: tra-cuu\/tuong\/khong-co-trong-ledger/u);
  await rm(join(fixture.distDir, "tra-cuu", "tuong", "khong-co-trong-ledger"), { recursive: true });
  await fixture.verify();

  // Trang nhóm phải dựng sẵn đủ mọi mục và mang đúng bảng slug của ledger.
  const spec = LOOKUP_GROUP_SPECS.find((candidate) => candidate.group === first.group);
  const groupFile = join(fixture.distDir, spec.path, "index.html");
  await writeFile(groupFile, fixture.groupHtml("vi", spec, "hero:thua"));
  await assert.rejects(fixture.verify(), /prerender every item/u);
  // Cùng số thẻ nhưng một mục thay bằng mã lạ (một thiếu, một thừa): đếm số lượng không đủ, phải so tập mã.
  await writeFile(groupFile, fixture.groupHtml("vi", spec).replace(`data-lookup-id="${first.id}"`, 'data-lookup-id="hero:thua"'));
  await assert.rejects(fixture.verify(), /prerender every item exactly once/u);
  const otherPage = join(fixture.distDir, ...LOOKUP_GROUP_SPECS.filter((candidate) => candidate.group !== first.group)[0].path.split("/"), "index.html");
  const original = await readFile(otherPage, "utf8");
  await writeFile(groupFile, fixture.groupHtml("vi", spec));
  await writeFile(otherPage, original.replace('id="lookup-route-handles" type="application/json">{}', 'id="lookup-route-handles" type="application/json">{"hero:x":"khac"}'));
  await assert.rejects(fixture.verify(), /route exceptions differ from the ledger/u);
  await writeFile(otherPage, original);
  await writeFile(groupFile, fixture.groupHtml("vi", spec));
  await fixture.verify();

  // Ledger đổi (mục mới chưa cấp slug hoặc sửa tay) không lọt qua.
  const handles = structuredClone(fixture.handles);
  delete handles[first.group][first.id];
  await writeFile(fixture.ledgerPath, jsonBytes(fixture.ledgerOf(handles)));
  await assert.rejects(fixture.verify(), /ledger/iu);
  await writeFile(fixture.ledgerPath, jsonBytes({ ...fixture.ledgerOf(fixture.handles), note: "sửa tay", handlesSha256: "0".repeat(64) }));
  await assert.rejects(fixture.verify(), /handlesSha256/u);
  await writeFile(fixture.ledgerPath, jsonBytes(fixture.ledgerOf(fixture.handles)));
  await fixture.verify();

  // Sitemap phải có đủ mọi trang mục.
  await writeFile(join(fixture.distDir, "sitemap.xml"), orderedSitemap(FIXTURE_SITEMAP_ENTRIES));
  await assert.rejects(fixture.verify(), /sitemap/iu);
});

/* ---------- Trang đội dựng sẵn: người đọc (và crawler) không cần JavaScript ---------- */

const distText = (name) => readFile(new URL(`../dist/${name}`, import.meta.url), "utf8");
const publicJson = async (routeParam) => JSON.parse(Buffer.from((await readPublicArtifact({ kind: "data", routeParam })).bytes).toString("utf8"));
/** Chữ người đọc thấy trong HTML: bỏ script/style/thẻ, giải mã entity cơ bản, gộp khoảng trắng. */
const visibleText = (html) => html
  .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gu, " ")
  .replace(/<[^>]+>/gu, " ")
  .replace(/&quot;/gu, '"').replace(/&#39;/gu, "'").replace(/&lt;/gu, "<").replace(/&gt;/gu, ">").replace(/&amp;/gu, "&")
  .replace(/\s+/gu, " ");
const withoutVariantPrefix = (name) => String(name).replace(/^(SP|CO|40Y)\s*/u, "").trim();
const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff]/u;
const WAITING_TEXT = /Đang tải chi tiết|正在加载详情|cần JavaScript|需要 JavaScript/u;
const articleOf = (html) => html.match(/<article\b[^>]*id="team-detail-root"[\s\S]*?<\/article>/u)?.[0] ?? "";
const mainOf = (html) => html.match(/<main\b[\s\S]*<\/main>/u)?.[0] ?? "";
const zhPath = (htmlPath) => `zh/${htmlPath}`;

async function resolverZh() {
  const { createRawNameResolver } = await import("../js/website-display.js");
  return createRawNameResolver(...await Promise.all(["heroes-dict", "tactics", "books-dict"].map(publicJson)));
}

/** Tên tướng/chiến pháp/binh thư của một bản ghi Đội chuẩn theo ngôn ngữ trang (nguồn: bản ghi chi tiết thật). */
function recommendedNames(record, locale) {
  const pick = (vi, raw) => (locale === "zh" ? raw : vi);
  const heroes = record.heroes.map((hero) => withoutVariantPrefix(pick(hero.displayNameVi, hero.nameRaw)));
  const tactics = record.heroes.flatMap((hero) => pick(hero.tacticSlotsVi, hero.tacticSlotsRaw) ?? []);
  const books = record.heroes.flatMap((hero) => pick(hero.bookSlotsVi, hero.bookSlotsRaw) ?? []);
  const plain = (value) => typeof value === "string" && value.trim() && !/[\/·()（）]/u.test(value);
  return { heroes: heroes.filter(Boolean), tactics: tactics.filter(plain), books: books.filter(plain) };
}

test("Đội chuẩn: trang chi tiết dựng sẵn có tướng, chiến pháp, binh thư của chính đội, không câu chờ JS (vi + zh)", async () => {
  const catalog = await teamDetailCatalog();
  const website = await websiteDisplayPublicationSnapshot();
  const recordOf = (candidate) => JSON.parse(Buffer.from(website.recommended.files[`details-${candidate.safeScopeKey}.json`]).toString("utf8"))
    .records.find((row) => row.sourceConfigId === candidate.sourceConfigId);
  const full = (record) => ["vi", "zh"].every((locale) => {
    const names = recommendedNames(record, locale);
    return names.heroes.length >= 3 && names.tactics.length && names.books.length;
  });
  const entry = catalog.recommended.find((candidate) => full(recordOf(candidate)));
  assert.ok(entry, "dữ liệu thật phải có ít nhất một đội đủ tướng, chiến pháp, binh thư");
  const record = recordOf(entry);
  for (const locale of ["vi", "zh"]) {
    const html = await distText(locale === "zh" ? zhPath(entry.htmlPath) : entry.htmlPath);
    const body = articleOf(html);
    const text = visibleText(body);
    const names = recommendedNames(record, locale);
    assert.ok(names.heroes.length >= 3 && names.tactics.length && names.books.length, "mẫu thật phải có đủ tướng, chiến pháp, binh thư");
    for (const [kind, values] of Object.entries(names)) {
      for (const value of values) assert.ok(text.includes(value), `${locale} ${entry.routePath}: thiếu ${kind} "${value}" trong HTML dựng sẵn`);
    }
    assert.doesNotMatch(body, WAITING_TEXT, `${locale}: không còn câu chờ/yêu cầu JavaScript`);
    assert.doesNotMatch(body, /id="team-detail-status"/u);
    assert.doesNotMatch(body, /id="team-detail-body"[^>]*\bhidden\b/u);
  }
});

test("Đội khác: trang chi tiết dựng sẵn có tướng, chiến pháp, binh thư của đội gốc (vi + zh)", async () => {
  const catalog = await teamDetailCatalog();
  const teams = await publicJson("teams");
  const resolve = await resolverZh();
  const entry = catalog.legacy.find((candidate) => teams.some((team) => team.id === candidate.legacyTeamId && team.heroes?.length >= 3));
  const team = teams.find((candidate) => candidate.id === entry.legacyTeamId);
  for (const locale of ["vi", "zh"]) {
    const html = await distText(locale === "zh" ? zhPath(entry.htmlPath) : entry.htmlPath);
    const body = articleOf(html);
    const text = visibleText(body);
    const tr = (name) => (locale === "zh" ? resolve(name) : name);
    const heroes = team.heroes.map((hero) => tr(hero.baseName ?? hero.name)).filter(Boolean);
    const tactics = team.heroes.flatMap((hero) => hero.tactics ?? []).map((item) => tr(item.name)).filter(Boolean);
    const books = team.heroes.flatMap((hero) => hero.books ?? []).map((item) => tr(item.name)).filter(Boolean);
    assert.ok(heroes.length && tactics.length && books.length, `${locale}: mẫu phải có tướng, chiến pháp, binh thư tra được`);
    for (const value of [heroes[0], tactics[0], books[0]]) assert.ok(text.includes(withoutVariantPrefix(value)), `${locale} ${entry.routePath}: thiếu "${value}"`);
    assert.doesNotMatch(body, WAITING_TEXT);
    assert.doesNotMatch(body, /id="team-detail-status"/u);
    assert.doesNotMatch(body, /id="team-detail-body"[^>]*\bhidden\b/u);
  }
});

test("Khai hoang: trang chi tiết dựng sẵn có tướng, chiến pháp, điểm và hướng dẫn của đội (vi + zh)", async () => {
  const catalog = await teamDetailCatalog();
  const data = await publicJson("khaihoang");
  const resolve = await resolverZh();
  const entry = catalog.khaiHoang.find((candidate) => data.teams.find((team) => team.id === candidate.khaiHoangTeamId)?.guide?.ratings);
  const team = data.teams.find((candidate) => candidate.id === entry.khaiHoangTeamId);
  for (const locale of ["vi", "zh"]) {
    const html = await distText(locale === "zh" ? zhPath(entry.htmlPath) : entry.htmlPath);
    const body = articleOf(html);
    const text = visibleText(body);
    const tr = (name) => (locale === "zh" ? resolve(name) : name);
    const hero = tr(withoutVariantPrefix(team.heroes[0].name));
    const tactic = team.heroes.flatMap((item) => item.tacticsAfter ?? []).map(tr).find((name) => name && !/[\/·]/u.test(name));
    assert.ok(hero && tactic, `${locale}: mẫu phải có tướng và chiến pháp tra được`);
    assert.ok(text.includes(hero), `${locale} ${entry.routePath}: thiếu tướng ${hero}`);
    assert.ok(text.includes(tactic), `${locale} ${entry.routePath}: thiếu chiến pháp ${tactic}`);
    assert.match(body, /class="kh-ratings\b/u, `${locale}: thanh điểm đánh giá phải dựng sẵn`);
    assert.doesNotMatch(body, WAITING_TEXT);
    assert.doesNotMatch(body, /id="team-detail-status"/u);
    assert.doesNotMatch(body, /id="team-detail-body"[^>]*\bhidden\b/u);
  }
});

test("bốn trang danh sách đội dựng sẵn đội mặc định: tướng + link chi tiết, một h1, không noscript 'cần JavaScript' (vi + zh)", async () => {
  const catalog = await teamDetailCatalog();
  const website = await websiteDisplayPublicationSnapshot();
  const { projectRecommendedRows } = await import("../js/recommended-reference-state.js");
  const seasons = JSON.parse(Buffer.from(website.recommended.files["seasons.json"]).toString("utf8"));
  const indexRecords = JSON.parse(Buffer.from(website.recommended.files["index.json"]).toString("utf8")).records;
  const otherRecords = JSON.parse(Buffer.from(website.recommended.files["other-teams.json"]).toString("utf8")).records;
  const baseState = { query: "", filters: {}, view: "the" };
  const recommendedRow = projectRecommendedRows(indexRecords, { ...baseState, season: seasons.defaultSourceSeasonId }, seasons.displayLabels)[0];
  const otherRow = projectRecommendedRows(otherRecords, { ...baseState, season: "all" }, seasons.displayLabels)[0];
  const khaihoang = await publicJson("khaihoang");
  const khaiEntry = catalog.khaiHoang.find((entry) => entry.khaiHoangTeamId === khaihoang.teams[0].id);
  const recommendedEntry = catalog.recommended.find((entry) => entry.sourceConfigId === recommendedRow.sourceConfigId);
  const otherEntry = catalog.legacy.find((entry) => entry.legacyTeamId === (otherRow.legacyTeamId ?? otherRow.id));
  assert.ok(recommendedEntry && otherEntry && khaiEntry, "mẫu mặc định phải có route chi tiết");

  const resolve = await resolverZh();
  // Cùng Tồn: nhóm đầu của mùa mới nhất (mặc định của URL trống) — tướng của đội đầu phải có trong HTML.
  const seasonUi = await import("../js/season-ui-state.js");
  const { projectSeasonBrowse } = await import("../js/season-context.js");
  const model = await seasonUi.loadSeasonModel(await seasonArtifactHashes(), async (name) => new Uint8Array((await readPublicArtifact({ kind: "data", routeParam: name })).bytes));
  const scenarioId = seasonUi.coexistScenarioIds(model)[0];
  assert.equal(scenarioId, seasonUi.COEXIST_LATEST_SCENARIO_ID, "mùa mặc định của Cùng Tồn là mùa mới nhất");
  const defaultGroup = seasonUi.coexistGroups(projectSeasonBrowse(model, seasonUi.readSeasonQuery(`https://tqccl.invalid/cung-ton/?scenario=${scenarioId}`, model).browse))[0];
  const coexistHeroes = (locale) => defaultGroup.content.teams[0].heroes
    .map((hero) => String(hero.name ?? hero.nameRaw).split(/[\n(（]/u)[0].trim())
    .map((name) => (locale === "zh" && !CJK_RE.test(name) ? resolve(withoutVariantPrefix(name)) : name))
    .filter((name) => name && (locale === "zh" || !CJK_RE.test(name)));
  const cases = [
    { path: "doi-chuan", entry: recommendedEntry, heroes: (locale) => recommendedRow.heroes.map((hero) => locale === "zh" ? hero.nameRaw : hero.displayNameVi) },
    { path: "doi-khac", entry: otherEntry, heroes: (locale) => (otherRow.holders ?? otherRow.heroes).map((hero) => locale !== "zh" ? hero.displayNameVi : CJK_RE.test(hero.nameRaw) ? hero.nameRaw : resolve(withoutVariantPrefix(hero.nameRaw))) },
    { path: "khai-hoang", entry: khaiEntry, heroes: (locale) => khaihoang.teams[0].heroes.map((hero) => locale === "zh" ? resolve(withoutVariantPrefix(hero.name)) : hero.name) },
    { path: "cung-ton", entry: null, heroes: coexistHeroes },
  ];
  for (const locale of ["vi", "zh"]) {
    for (const { path, entry, heroes } of cases) {
      const html = await distText(`${locale === "zh" ? "zh/" : ""}${path}/index.html`);
      const where = `${locale} /${path}/`;
      assert.equal((html.match(/<h1\b/gu) ?? []).length, 1, `${where}: đúng một h1 (không tính noscript)`);
      assert.doesNotMatch(html, /<noscript>[\s\S]*?JavaScript[\s\S]*?<\/noscript>/u, `${where}: không noscript yêu cầu JavaScript`);
      const section = html.match(/<section\b[^>]*id="section-[a-z-]+"[\s\S]*?<script\b/u)?.[0] ?? "";
      const text = visibleText(section);
      if (entry) {
        const href = `${locale === "zh" ? "/zh" : ""}${entry.routePath}`;
        assert.ok(section.includes(`href="${href}`), `${where}: thiếu link chi tiết ${href}`);
      }
      const names = heroes(locale).filter(Boolean).map(withoutVariantPrefix);
      assert.ok(names.length >= 1, `${where}: mẫu phải có tên tướng`);
      for (const name of names) assert.ok(text.includes(name), `${where}: thiếu tướng ${name}`);
      assert.ok((section.match(/class="hero\b/gu) ?? []).length >= 3 || (section.match(/class="kh-holder\b/gu) ?? []).length >= 3 || /class="[^"]*\bkh-card\b/u.test(section), `${where}: đội mặc định phải có ≥3 tướng`);
    }
  }
});

/* ---------- Tra cứu: trang nhóm đủ mục, trang riêng từng mục (không cần JavaScript) ---------- */

const LOOKUP_ROOT = { vi: "", zh: "zh/" };

test("Tra cứu: mỗi trang nhóm dựng sẵn đủ mọi mục (vi + zh), mỗi thẻ là link tới trang riêng của mục", async () => {
  const corpus = await lookupBuildCorpus();
  const routes = await lookupDetailRoutes();
  let rendered = 0;
  for (const { path, group } of LOOKUP_GROUP_SPECS) {
    const expected = corpus.groups[group].map((row) => row.id);
    assert.ok(expected.length > 0, group);
    for (const locale of ["vi", "zh"]) {
      const html = await distText(`${LOOKUP_ROOT[locale]}${path}/index.html`);
      const ids = [...html.matchAll(/data-lookup-id="([^"]+)"/gu)].map(([, id]) => id);
      // Cải tạo binh chủng xếp thành khối theo binh chủng nên thứ tự hiển thị khác thứ tự nguồn: so tập mã, mỗi mã đúng một lần.
      assert.deepEqual([...ids].sort(), [...expected].sort(), `${locale} ${path}: data-lookup-id phải là đúng mọi mục của nhóm, mỗi mục một lần`);
      for (const id of expected) {
        const href = `${locale === "zh" ? "/zh" : ""}${routes.byId.get(id).path}`;
        assert.ok(html.includes(`href="${href}" data-lookup-id="${id}"`), `${locale} ${path}: thẻ ${id} phải là link ${href}`);
      }
      // Khai báo cho trình duyệt: ngoại lệ slug (hiện rỗng: slug = hậu tố mã) khớp ledger; trang đầu hiện, còn lại chờ "Xem thêm".
      const table = JSON.parse(html.match(/id="lookup-route-handles"[^>]*>([^<]+)<\/script>/u)[1]);
      assert.deepEqual(table, routes.exceptions, `${locale} ${path}`);
      assert.deepEqual(Object.fromEntries(routes.entries.filter((entry) => entry.slug !== entry.id.slice(entry.id.indexOf(":") + 1)).map((entry) => [entry.id, entry.slug])), routes.exceptions, "ngoại lệ = đúng những mục lệch quy tắc hậu tố mã");
      assert.ok(html.includes("document.documentElement.dataset.lookupJs"), `${locale} ${path}: thiếu cờ JavaScript trong head`);
      rendered += ids.length;
    }
  }
  assert.equal(rendered, routes.entries.length * 2);
});

/** Chữ thật của bản ghi mà trang riêng của từng nhóm phải mang: tên + một trường hồ sơ chính (vi + zh). */
function lookupSampleExpectations(group, corpus, locale) {
  const zh = locale === "zh";
  const rows = corpus.groups[group];
  const name = (row) => lookupDisplayName(row.record, row.nameVi, locale);
  if (group === "heroes") {
    // Chiến pháp bản thân của tướng: tên tướng + tên chiến pháp mà hồ sơ nối tới.
    const row = rows.find((candidate) => corpus.byId.get(candidate.record.lookup?.selfTacticId));
    const tactic = corpus.byId.get(row.record.lookup.selfTacticId);
    return { row, texts: [name(row), name(tactic)] };
  }
  if (group === "tactics") {
    const row = rows.find((candidate) => effectVersions(zh ? candidate.record.effect : candidate.record.effectViet)[0]?.paragraphs[0]);
    return { row, texts: [name(row), effectVersions(zh ? row.record.effect : row.record.effectViet)[0].paragraphs[0]] };
  }
  if (group === "books") {
    const row = rows.find((candidate) => candidate.record.effect && candidate.record.effectViet);
    return { row, texts: [name(row), zh ? row.record.effect : row.record.effectViet] };
  }
  if (group === "equipment") {
    const row = rows.find((candidate) => candidate.exclusives?.length);
    return { row, texts: [name(row), lookupDisplayName(row.exclusives[0], row.exclusives[0].nameVi, locale)] };
  }
  if (group === "advisors") {
    const row = rows.find((candidate) => candidate.record.heroIds?.some((id) => corpus.byId.has(id)));
    const hero = corpus.byId.get(row.record.heroIds.find((id) => corpus.byId.has(id)));
    return { row, texts: [name(row), name(hero), ...(zh ? [] : [effectVersions(row.record.effectVi)[0].paragraphs[0]])] };
  }
  if (group === "troop-mods") {
    const row = rows.find((candidate) => candidate.record.appliesToVi);
    return { row, texts: [name(row), ...(zh ? [] : [row.record.appliesToVi.trim()])] };
  }
  const row = rows.find((candidate) => candidate.record.summaryVi && candidate.record.levels?.length);
  return { row, texts: [name(row), ...(zh ? [`${row.record.maxLevel}`] : [row.record.summaryVi.trim()])] };
}

test("Tra cứu: trang riêng mẫu của mỗi nhóm có tên và trường hồ sơ chính lấy từ corpus, không cần JavaScript (vi + zh)", async () => {
  const corpus = await lookupBuildCorpus();
  const routes = await lookupDetailRoutes();
  for (const { group } of LOOKUP_GROUP_SPECS) {
    for (const locale of ["vi", "zh"]) {
      const { row, texts } = lookupSampleExpectations(group, corpus, locale);
      const route = routes.byId.get(row.id);
      const html = await distText(`${LOOKUP_ROOT[locale]}${route.path.slice(1)}index.html`);
      // Số cấp in đậm nằm trong thẻ riêng nên so sánh bỏ hết khoảng trắng ở cả hai phía.
      const compact = (value) => String(value).replace(/\s+/gu, "");
      const text = compact(visibleText(mainOf(html)));
      const where = `${locale} ${route.path}`;
      for (const expected of texts) {
        assert.ok(text.includes(compact(expected)), `${where}: thiếu "${expected}" trong HTML dựng sẵn`);
      }
      assert.equal((html.match(/<h1\b/gu) ?? []).length, 1, `${where}: đúng một h1`);
      assert.ok(html.includes(`<h1 class="lookup-dialog-title" id="lookup-dialog-title">${texts[0]}</h1>`) || html.includes(`id="lookup-detail-title">${texts[0]}</h1>`), `${where}: h1 là tên mục`);
      assert.doesNotMatch(html, /Đang tải|正在加载/u, `${where}: không còn câu chờ`);
    }
  }
});

test("Tra cứu: mọi trang riêng (938 × 2) có canonical + hreflang của chính nó, title và description duy nhất, link về trang nhóm", async () => {
  const origin = new URL(await configuredSite()).origin;
  const routes = await lookupDetailRoutes();
  const titles = new Set();
  const descriptions = new Set();
  for (const entry of routes.entries) {
    for (const locale of ["vi", "zh"]) {
      const viPath = entry.path;
      const path = locale === "zh" ? zhPathOf(viPath) : viPath;
      const html = await distText(`${path.slice(1)}index.html`);
      assert.equal(linkHref(html, "canonical"), new URL(path, origin).href, path);
      assert.equal(metaContent(html, "og:url"), new URL(path, origin).href, path);
      const alternates = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/gu)].map(([, lang, href]) => `${lang} ${href}`);
      assert.deepEqual(alternates, [
        `vi ${new URL(viPath, origin).href}`,
        `zh-Hans ${new URL(zhPathOf(viPath), origin).href}`,
        `x-default ${new URL(viPath, origin).href}`,
      ], path);
      const title = html.match(/<title>([^<]+)<\/title>/u)?.[1];
      const description = metaContent(html, "description");
      assert.ok(title && description, path);
      assert.ok(!titles.has(title), `title trùng: ${title}`);
      assert.ok(!descriptions.has(description), `description trùng: ${description}`);
      assert.doesNotMatch(description.trim(), /[:：]$/u, `${path}: description kết thúc bằng dấu hai chấm treo: ${description}`);
      assert.doesNotMatch(description, /Cập nhật[^:：]{0,60}[:：]/u, `${path}: description dùng nhãn phiên bản làm tóm tắt: ${description}`);
      titles.add(title);
      descriptions.add(description);
      const groupHref = `${locale === "zh" ? "/zh" : ""}/tra-cuu/${entry.path.split("/")[2]}/`;
      assert.ok(html.includes(`class="detail-link detail-back-link" href="${groupHref}"`), `${path}: thiếu link quay lại ${groupHref}`);
    }
  }
  assert.equal(titles.size, routes.entries.length * 2);
});
