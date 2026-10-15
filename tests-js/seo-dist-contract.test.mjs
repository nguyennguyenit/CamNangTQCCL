// Hợp đồng dist của Phase 4: link Tra cứu của trang đội, JSON-LD của trang đội / trang nhóm / trang riêng từng mục, bộ file llms.
// Mọi kỳ vọng lấy từ dữ liệu thật (catalog đội, ledger + corpus Tra cứu), không phải số viết tay; chạy trên `dist/` đã build.
import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import astroConfig from "../astro.config.mjs";
import { teamDetailCatalog } from "../src/lib/team-detail-routes.ts";
import { lookupDetailRoutes } from "../src/lib/lookup-detail-routes.ts";
import { lookupBuildCorpus } from "../src/lib/lookup-pages.ts";
import { LOOKUP_GROUP_SLUGS } from "../js/lookup-ids.js";
import { zhGaps, renderZhGapsReport } from "../scripts/report-zh-gaps.mjs";

const ORIGIN = new URL(astroConfig.site).origin;
const dist = (path) => new URL(`../dist/${path}`, import.meta.url);
const read = (path) => readFile(dist(path), "utf8");
const exists = (path) => access(dist(path)).then(() => true, () => false);
const LOCALES = [["vi", ""], ["zh", "/zh"]];
const GAME_NAME = "三国志·战略版";
const LANG = { vi: "vi", zh: "zh-Hans" };
const homeUrl = (prefix) => `${ORIGIN}${prefix ? "/zh/" : "/"}`;

/** Đường dẫn trang → file trong dist. */
const pageFile = (path) => `${path.replace(/^\//u, "")}index.html`;
const unescapeHtml = (value) => value.replace(/&quot;/gu, '"').replace(/&#39;/gu, "'").replace(/&lt;/gu, "<").replace(/&gt;/gu, ">").replace(/&amp;/gu, "&");
const compact = (value) => value.replace(/\s+/gu, "");
const visibleText = (html) => unescapeHtml(html
  .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gu, " ")
  .replace(/<[^>]+>/gu, " ")).replace(/\s+/gu, " ");

/** Mọi khối JSON-LD của trang; khối không parse được làm hỏng test. */
function jsonLdBlocks(html, where) {
  return [...html.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/gu)].map(([, body]) => {
    try {
      return JSON.parse(body);
    } catch (error) {
      throw new Error(`${where}: JSON-LD không parse được (${error.message})`);
    }
  });
}
const blockOf = (blocks, type, where) => {
  const found = blocks.filter((block) => block["@type"] === type);
  assert.equal(found.length, 1, `${where}: cần đúng một khối ${type}, có ${found.length}`);
  return found[0];
};
const metaDescription = (html) => unescapeHtml(html.match(/<meta name="description" content="([^"]*)"/u)?.[1] ?? "");
const canonicalOf = (html) => html.match(/<link rel="canonical" href="([^"]+)"/u)?.[1];
const titleOf = (html) => unescapeHtml(html.match(/<title>([^<]*)<\/title>/u)?.[1] ?? "");

/** Quy ước chung: schema.org context, isPartOf VideoGame, inLanguage đúng ngôn ngữ trang. */
function assertGameAndLanguage(block, locale, where) {
  assert.equal(block["@context"], "https://schema.org", where);
  assert.equal(block.inLanguage, LANG[locale], `${where}: inLanguage`);
  assert.equal(block.isPartOf?.["@type"], "VideoGame", `${where}: isPartOf`);
  assert.equal(block.isPartOf?.name, GAME_NAME, `${where}: tên trò chơi`);
}

function assertBreadcrumb(block, expected, where) {
  assert.equal(block["@context"], "https://schema.org", where);
  const items = block.itemListElement;
  assert.deepEqual(items.map((item) => item.position), items.map((_, index) => index + 1), `${where}: position`);
  assert.deepEqual(items.map((item) => item.item), expected, `${where}: BreadcrumbList item`);
  for (const item of items) assert.ok(item.name, `${where}: breadcrumb thiếu name`);
}

async function teamPages() {
  const catalog = await teamDetailCatalog();
  const family = (entries, name) => entries.map((entry) => ({ family: name, path: entry.routePath }));
  return [...family(catalog.recommended, "doi-chuan"), ...family(catalog.legacy, "doi-khac"), ...family(catalog.khaiHoang, "khai-hoang")];
}

async function* htmlFilesUnder(directory) {
  for (const entry of await readdir(dist(directory), { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) yield* htmlFilesUnder(path);
    else if (entry.name.endsWith(".html")) yield path;
  }
}

test("trang đội: link Tra cứu là đường dẫn trang riêng của ledger, không còn `?id=` (vi + zh)", async () => {
  const routes = await lookupDetailRoutes();
  const itemPaths = new Set(routes.entries.map((entry) => entry.path));
  let pages = 0;
  let links = 0;
  for (const prefix of ["", "zh/"]) {
    for (const family of ["doi-chuan", "doi-khac", "khai-hoang", "cung-ton"]) {
      for await (const file of htmlFilesUnder(`${prefix}${family}`)) {
        const html = await read(file);
        pages += 1;
        assert.doesNotMatch(html, /\/tra-cuu\/[^"'\s]*\?[^"'\s]*\bid=/u, `${file}: còn link Tra cứu dạng ?id=`);
        for (const [, href] of html.matchAll(/href="((?:\/zh)?\/tra-cuu\/[^"?#]*)"/gu)) {
          const viPath = href.replace(/^\/zh/u, "");
          if (viPath.split("/").filter(Boolean).length < 3) continue; // trang nhóm / mục lục
          links += 1;
          assert.ok(itemPaths.has(viPath), `${file}: link ${href} không phải route của ledger`);
          assert.ok(await exists(pageFile(href)), `${file}: link ${href} không có file dist`);
        }
      }
    }
  }
  assert.ok(pages > 3000, `phải quét mọi trang đội (${pages})`);
  assert.ok(links > 1000, `trang đội phải có link tới trang mục (${links})`);
});

test("JSON-LD trang chi tiết đội (vi + zh): WebPage + BreadcrumbList, about chỉ gồm tướng có trang riêng và hiện trong HTML", async () => {
  const routes = await lookupDetailRoutes();
  const heroUrls = new Set(routes.entries.filter((entry) => entry.group === "heroes").map((entry) => `${ORIGIN}${entry.path}`));
  const familyPath = { "doi-chuan": "/doi-chuan/", "doi-khac": "/doi-khac/", "khai-hoang": "/khai-hoang/" };
  let withAbout = 0;
  let total = 0;
  for (const page of await teamPages()) {
    for (const [locale, prefix] of LOCALES) {
      const path = `${prefix}${page.path}`;
      const where = `${locale} ${page.path}`;
      const html = await read(pageFile(path));
      const blocks = jsonLdBlocks(html, where);
      assert.equal(blocks.length, 2, where);
      const webPage = blockOf(blocks, "WebPage", where);
      assertGameAndLanguage(webPage, locale, where);
      const url = `${ORIGIN}${path}`;
      assert.equal(webPage.url, url, where);
      assert.equal(canonicalOf(html), url, where);
      assert.equal(webPage.description, metaDescription(html), `${where}: description phải là meta description`);
      assert.ok(webPage.name && titleOf(html).startsWith(webPage.name), `${where}: name phải là tên trong <title>`);
      assertBreadcrumb(blockOf(blocks, "BreadcrumbList", where), [homeUrl(prefix), `${ORIGIN}${prefix}${familyPath[page.family]}`, url], where);
      const text = visibleText(html.match(/<article\b[^>]*id="team-detail-root"[\s\S]*?<\/article>/u)?.[0] ?? "");
      const seen = new Set();
      for (const hero of webPage.about ?? []) {
        assert.equal(hero["@type"], "Thing", where);
        assert.ok(heroUrls.has(hero.url.replace(`${ORIGIN}${prefix}`, ORIGIN)), `${where}: about ${hero.url} không phải trang tướng của ledger`);
        assert.ok(await exists(pageFile(hero.url.slice(ORIGIN.length))), `${where}: about ${hero.url} không có file dist`);
        // Trang tách tiền tố biến thể khỏi tên ("SP 荀彧" cho "SP荀彧"): so tên không tính khoảng trắng.
        assert.ok(compact(text).includes(compact(hero.name)), `${where}: tướng ${hero.name} không có trong HTML của trang`);
        assert.ok(!seen.has(hero.url), `${where}: tướng lặp ${hero.url}`);
        seen.add(hero.url);
      }
      total += 1;
      if (webPage.about?.length) withAbout += 1;
    }
  }
  assert.ok(total > 3000, String(total));
  assert.ok(withAbout > total * 0.8, `phần lớn trang đội phải có tướng có trang riêng (${withAbout}/${total})`);
});

const TERM_GROUPS = new Set(["tactics", "books", "advisors"]);

test("JSON-LD trang riêng từng mục (886 × 2): ItemPage (url, inLanguage, isPartOf) + mainEntity Thing/DefinedTerm + BreadcrumbList, chỉ phản ánh nội dung có trong HTML", async () => {
  const [routes, corpus] = await Promise.all([lookupDetailRoutes(), lookupBuildCorpus()]);
  let images = 0;
  let alternates = 0;
  for (const entry of routes.entries) {
    const item = corpus.byId.get(entry.id);
    const groupPath = `/tra-cuu/${LOOKUP_GROUP_SLUGS[entry.group]}/`;
    for (const [locale, prefix] of LOCALES) {
      const path = `${prefix}${entry.path}`;
      const where = `${locale} ${entry.path}`;
      const html = await read(pageFile(path));
      const blocks = jsonLdBlocks(html, where);
      assert.equal(blocks.length, 2, where);
      const page = blocks.find((block) => block["@type"] !== "BreadcrumbList");
      assert.equal(page["@type"], "ItemPage", where);
      assertGameAndLanguage(page, locale, where);
      const url = `${ORIGIN}${path}`;
      assert.equal(page.url, url, where);
      const thing = page.mainEntity;
      assert.equal(thing["@type"], TERM_GROUPS.has(entry.group) ? "DefinedTerm" : "Thing", where);
      // inLanguage/isPartOf chỉ hợp lệ trên CreativeWork: nút Thing/DefinedTerm không mang chúng.
      for (const key of ["@context", "url", "inLanguage", "isPartOf"]) assert.equal(thing[key], undefined, `${where}: mainEntity không có ${key}`);
      assert.equal(canonicalOf(html), url, where);
      assert.equal(thing.description, metaDescription(html), `${where}: description phải là meta description`);
      assert.ok(thing.name && titleOf(html).startsWith(`${thing.name} — `), `${where}: name phải đứng đầu <title>`);
      const text = visibleText(html.match(/<main\b[\s\S]*<\/main>/u)?.[0] ?? html);
      assert.ok(text.includes(thing.name), `${where}: name phải có trong HTML`);
      if (thing.alternateName !== undefined) {
        assert.notEqual(thing.alternateName, thing.name, where);
        assert.ok(compact(text).includes(compact(thing.alternateName)), `${where}: alternateName "${thing.alternateName}" phải có trong HTML`);
      }
      if (thing.alternateName !== undefined) alternates += 1;
      if (locale === "zh") assert.equal(thing.alternateName, undefined, `${where}: bản Trung không hiện tên Việt`);
      if (TERM_GROUPS.has(entry.group)) {
        assert.equal(thing.inDefinedTermSet?.["@type"], "DefinedTermSet", where);
        assert.equal(thing.inDefinedTermSet.url, `${ORIGIN}${prefix}${groupPath}`, where);
        assert.ok(thing.inDefinedTermSet.name, where);
      } else {
        assert.equal(thing.inDefinedTermSet, undefined, where);
      }
      // Ảnh: chỉ tướng có iconUrl, `https`, và chính ảnh đó có trong HTML; mục khác không khai ảnh.
      const icon = entry.group === "heroes" ? item.record.iconUrl : null;
      if (icon) {
        assert.equal(thing.image, icon.replace(/^http:/u, "https:"), where);
        assert.ok(html.includes(`src="${thing.image}"`), `${where}: ảnh ${thing.image} phải có trong HTML`);
        images += 1;
      } else {
        assert.equal(thing.image, undefined, where);
      }
      assertBreadcrumb(blockOf(blocks, "BreadcrumbList", where), [homeUrl(prefix), `${ORIGIN}${prefix}/tra-cuu/`, `${ORIGIN}${prefix}${groupPath}`, url], where);
    }
  }
  assert.ok(images > 100, `tướng có ảnh phải khai image (${images})`);
  assert.ok(alternates > 300, `bản Việt phải khai tên chữ Hán có trong trang (${alternates})`);
});

test("JSON-LD trang nhóm Tra cứu (7 × 2): CollectionPage + ItemList đủ mọi mục, mọi url có file dist", async () => {
  const [routes, corpus] = await Promise.all([lookupDetailRoutes(), lookupBuildCorpus()]);
  for (const [group, slug] of Object.entries(LOOKUP_GROUP_SLUGS)) {
    for (const [locale, prefix] of LOCALES) {
      const path = `${prefix}/tra-cuu/${slug}/`;
      const where = `${locale} ${path}`;
      const html = await read(pageFile(path));
      const blocks = jsonLdBlocks(html, where);
      assert.equal(blocks.length, 2, where);
      const page = blockOf(blocks, "CollectionPage", where);
      assertGameAndLanguage(page, locale, where);
      assert.equal(page.url, `${ORIGIN}${path}`, where);
      assert.equal(page.description, metaDescription(html), where);
      assert.equal(page.mainEntity["@type"], "ItemList", where);
      const list = page.mainEntity.itemListElement;
      assert.equal(page.mainEntity.numberOfItems, corpus.groups[group].length, where);
      assert.equal(list.length, corpus.groups[group].length, where);
      assert.deepEqual(list.map((entry) => entry.position), list.map((_, index) => index + 1), where);
      const expected = routes.entries.filter((entry) => entry.group === group).map((entry) => `${ORIGIN}${prefix}${entry.path}`);
      assert.deepEqual(list.map((entry) => entry.url).sort(), expected.sort(), `${where}: ItemList phải liệt kê đúng mọi mục của nhóm`);
      for (const entry of list) {
        assert.ok(entry.name, where);
        assert.ok(await exists(pageFile(entry.url.slice(ORIGIN.length))), `${where}: ${entry.url} không có file dist`);
      }
      assertBreadcrumb(blockOf(blocks, "BreadcrumbList", where), [homeUrl(prefix), `${ORIGIN}${prefix}/tra-cuu/`, `${ORIGIN}${path}`], where);
    }
  }
});

/* ---------- llms ---------- */

/** URL của mọi link Markdown `](url)` trong một văn bản. */
const markdownLinks = (text) => [...text.matchAll(/\]\((https?:[^)\s]+)\)/gu)].map(([, url]) => url);

async function llmsChildren() {
  const index = await read("llms.txt");
  const start = index.indexOf("## Toàn văn chữ thuần theo mục");
  assert.ok(start >= 0, "llms.txt phải có mục toàn văn chữ thuần theo mục");
  const urls = markdownLinks(index.slice(start)).filter((url) => url.startsWith(`${ORIGIN}/llms`));
  assert.equal(urls.filter((url) => url === `${ORIGIN}/llms-full.txt`).length, 1, "llms.txt phải link tới /llms-full.txt đúng một lần");
  return { index, children: urls.filter((url) => url !== `${ORIGIN}/llms-full.txt`).map((url) => url.slice(ORIGIN.length)) };
}

test("llms: /llms-full.txt đúng bằng các file con nối theo thứ tự cố định; llms.txt link tới mọi file và mọi link về site có file dist", async () => {
  const { index, children } = await llmsChildren();
  const SECTION_ORDER = ["/llms/doi-chuan", "/llms/doi-khac.txt", "/llms/cung-ton.txt", "/llms/khai-hoang.txt", ...Object.values(LOOKUP_GROUP_SLUGS).map((slug) => `/llms/tra-cuu/${slug}.txt`)];
  const sectionOf = (child) => SECTION_ORDER.findIndex((prefix) => child.startsWith(prefix));
  assert.ok(children.every((child) => sectionOf(child) >= 0), `file con lạ: ${children.filter((child) => sectionOf(child) < 0)}`);
  assert.deepEqual(children.map(sectionOf), [...children.map(sectionOf)].sort((a, b) => a - b), "thứ tự mục cố định: đội chuẩn, đội khác, cùng tồn, khai hoang, 7 nhóm tra cứu");
  for (const required of SECTION_ORDER.slice(1)) assert.ok(children.includes(required), `thiếu ${required}`);
  assert.ok(children.some((child) => child.startsWith("/llms/doi-chuan")), "thiếu file đội chuẩn");
  assert.equal(new Set(children).size, children.length);
  // Nối đúng bằng /llms-full.txt, đúng từng byte.
  const parts = await Promise.all(children.map((child) => read(child.slice(1))));
  assert.equal(parts.join(""), await read("llms-full.txt"));
  // Mọi link của llms.txt về chính site có file thật trong dist.
  for (const url of markdownLinks(index)) {
    if (new URL(url).origin !== ORIGIN) continue;
    const path = new URL(url).pathname;
    assert.ok(await exists(path.endsWith("/") ? pageFile(path) : path.slice(1)), `llms.txt link ${url} không có file dist`);
  }
});

test("llms: tách đội chuẩn theo mùa chỉ khi vượt ~300 KB; mỗi mục của file con mở bằng link trang riêng có file dist", async () => {
  const { children } = await llmsChildren();
  const doiChuan = children.filter((child) => child.startsWith("/llms/doi-chuan"));
  const sizes = await Promise.all(doiChuan.map(async (child) => Buffer.byteLength(await read(child.slice(1)), "utf8")));
  const total = sizes.reduce((sum, size) => sum + size, 0);
  if (total > 300 * 1024) {
    assert.ok(doiChuan.length > 1 && doiChuan.every((child) => /^\/llms\/doi-chuan\/[a-z0-9-]+\.txt$/u.test(child)), "vượt 300 KB thì tách theo mùa");
  } else {
    assert.deepEqual(doiChuan, ["/llms/doi-chuan.txt"]);
  }
  for (const child of children) {
    const text = await read(child.slice(1));
    const entries = [...text.matchAll(/^## \[(?:\\.|[^\]\\])+\]\((https?:[^)\s]+)\)$/gmu)].map(([, url]) => url);
    assert.ok(entries.length > 0, `${child}: không có mục nào`);
    assert.equal(entries.length, [...text.matchAll(/^## /gmu)].length, `${child}: mọi mục phải mở bằng dòng link`);
    for (const url of entries) {
      const { origin, pathname } = new URL(url);
      assert.equal(origin, ORIGIN, `${child}: ${url}`);
      assert.ok(await exists(pageFile(pathname)), `${child}: ${url} không có file dist`);
    }
  }
});

test("llms: có đủ URL trang chi tiết của mọi đội và URL trang riêng của mọi mục Tra cứu", async () => {
  const [catalog, routes] = await Promise.all([teamDetailCatalog(), lookupDetailRoutes()]);
  const full = await read("llms-full.txt");
  const urls = new Set(markdownLinks(full));
  assert.ok(catalog.recommended.length > 0 && routes.entries.length > 0);
  for (const [name, entries] of [["doi-chuan", catalog.recommended], ["doi-khac", catalog.legacy], ["khai-hoang", catalog.khaiHoang]]) {
    const missing = entries.filter((entry) => !urls.has(`${ORIGIN}${entry.routePath}`)).map((entry) => entry.routePath);
    assert.deepEqual(missing, [], `llms-full.txt thiếu URL ${name}`);
  }
  assert.deepEqual(routes.entries.filter((entry) => !urls.has(`${ORIGIN}${entry.path}`)).map((entry) => entry.path), [], "llms-full.txt thiếu URL trang mục");
  // File Tra cứu của nhóm nào chỉ có trang riêng của đúng nhóm đó.
  for (const [group, slug] of Object.entries(LOOKUP_GROUP_SLUGS)) {
    const text = await read(`llms/tra-cuu/${slug}.txt`);
    const inFile = [...new Set(markdownLinks(text))].filter((url) => url.includes("/tra-cuu/"));
    const expected = routes.entries.filter((entry) => entry.group === group).map((entry) => `${ORIGIN}${entry.path}`);
    assert.deepEqual(inFile.sort(), expected.sort(), `llms/tra-cuu/${slug}.txt`);
  }
});

test("llms.txt giữ nội dung blog hiện có và thêm 7 nhóm Tra cứu", async () => {
  const index = await read("llms.txt");
  for (const keep of ["## Mục chính", "## Bản tiếng Trung giản thể", "## Bài viết tiếng Việt", "## Khác", `${ORIGIN}/sitemap.xml`, `${ORIGIN}/rss.xml`]) {
    assert.ok(index.includes(keep), `llms.txt mất: ${keep}`);
  }
  for (const slug of Object.values(LOOKUP_GROUP_SLUGS)) {
    assert.ok(index.includes(`](${ORIGIN}/tra-cuu/${slug}/)`), `llms.txt thiếu nhóm ${slug}`);
    assert.ok(index.includes(`](${ORIGIN}/llms/tra-cuu/${slug}.txt)`), `llms.txt thiếu file llms của nhóm ${slug}`);
  }
});

/* ---------- Báo cáo zh ---------- */

test("báo cáo zh-gaps: mỗi mục viOnly của bản zh nêu được phần thiếu và có dòng trong báo cáo sinh từ dữ liệu hiện tại", async () => {
  const corpus = await lookupBuildCorpus();
  const gaps = zhGaps(corpus);
  assert.ok(gaps.length > 0 && gaps.every((gap) => gap.missing.length > 0), "mỗi mục thiếu phải nêu được phần thiếu");
  const totals = Object.fromEntries(Object.keys(LOOKUP_GROUP_SLUGS).map((group) => [group, corpus.groups[group].length]));
  const report = renderZhGapsReport(gaps, totals);
  for (const gap of gaps) assert.ok(report.includes(`| ${gap.id} |`), gap.id);
});
