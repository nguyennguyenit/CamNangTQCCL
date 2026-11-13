// Thiết kế mới nhóm Bài viết + Đội chuẩn có kho (artboard MainKho / BaiVietDetail + Mobile).
// 1. Đội chuẩn có kho ở 390px: tên món thiếu là chữ trên thẻ — thấy ngay không cần hover, nằm trong cây trợ năng (trình
//    đọc màn hình đọc theo thứ tự badge → "Thiếu: …"), đi tới được bằng bàn phím, không tràn ngang (issue #69 mục 1).
// 2. Bài viết chi tiết: build thường không có bài (blog lấy từ API cộng đồng lúc build), nên Playwright chạy thêm dev
//    server có bài mẫu (`scripts/design-canvas/bai-viet-fixture.mjs`, webServer thứ hai ở cổng FIXTURE_PORT —
//    playwright.config.mjs) và spec kiểm các khối chính + SEO trên đó.
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { buildSeasonCandidates } from "../js/roster-season-candidates.js";
import { projectRecommendedRows } from "../js/recommended-reference-state.js";
import { buildListCoverage } from "../js/roster-list-coverage.js";
import { CLOUD_STORAGE_KEY, emptyCloudState, mergeLocal } from "../js/roster-cloud-store.js";
import { createRosterIdResolver } from "../js/roster-id-resolve.js";
import { FIXTURE_COVER, FIXTURE_PORT, FIXTURE_SLUG } from "../scripts/design-canvas/bai-viet-fixture.mjs";

const read = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const { generationId } = read("src/data/recommended-reference/current.json");
const { records } = read(`src/data/recommended-reference/${generationId}/index.json`);
const dicts = { heroesDict: read("data/heroes-dict.json"), tacticsDict: read("data/tactics.json") };
const SCAN_KEY = "tqccl.rosterRecommend.scanState.v1";
// `/doi-chuan/` không có `?season=` mở mùa mặc định của generation đang pin (PK-S27 từ #90; trước đó OG).
const seasons = read(`src/data/recommended-reference/${generationId}/seasons.json`);
const SEASON = seasons.defaultSourceSeasonId;
const OLD_SEASON = "pk-s24";

function rosterFor(configIds, seasonId = SEASON) {
  const { teams } = buildSeasonCandidates(records.filter((record) => configIds.includes(record.sourceConfigId)), seasonId, dicts);
  const heroes = new Set();
  const tactics = new Set();
  for (const team of teams) {
    for (const hero of team.heroes) {
      heroes.add(hero.name);
      for (const tactic of hero.tactics) if (!tactic.unresolved) tactics.add(tactic.name);
    }
  }
  return { ownedHeroes: [...heroes].map((name) => ({ name })), ownedTactics: [...tactics].map((name) => ({ name })), lockedTeams: [], confirmed: true, updatedAt: "2026-11-11T00:00:00.000Z" };
}

const noHorizontalOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

const seedLocal = (page, roster) => page.addInitScript(([key, value]) => {
  if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
}, [SCAN_KEY, JSON.stringify(roster)]);

const expectedFor = (roster) => buildListCoverage({ records, seasonId: SEASON, ...dicts, roster });
/** Hai đội đầu của mùa mà kho gồm đúng tướng + chiến pháp của chính đội đó ráp đủ (không vướng chiến pháp chưa đối chiếu). */
const READY_TEAMS = records
  .filter((record) => record.sourceSeasonId === SEASON)
  .map((record) => record.sourceConfigId)
  .filter((id) => expectedFor(rosterFor([id])).byConfigId.get(id)?.missingCount === 0)
  .slice(0, 2);
const roster = rosterFor(READY_TEAMS);
const expected = expectedFor(roster);
// Đội thiếu nhiều món nhất trong lượt thẻ dựng sẵn đầu (tối đa 60 đội, theo thứ tự mặc định): danh sách dài nhất, dễ tràn nhất.
const firstBatch = new Set(projectRecommendedRows(records, { season: SEASON, query: "", filters: {} }, seasons.displayLabels).slice(0, 60).map((row) => row.sourceConfigId));
const [missingId, entry] = [...expected.byConfigId].filter(([id]) => firstBatch.has(id)).sort((a, b) => b[1].missingCount - a[1].missingCount)[0];
const itemsOf = (text, prefix, separator) => text.slice(prefix.length).split(separator);

test.describe("Đội chuẩn có kho ở 390px: món thiếu trên thẻ", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedLocal(page, roster);
  });

  test("tên món thiếu thấy ngay trên thẻ, đủ món, nằm trong khung thẻ, không tràn ngang; badge không lặp danh sách vào title", async ({ page }) => {
    await page.goto("/doi-chuan/");
    const card = page.locator(`#section-team-chuan [data-reference-key="${missingId}"]`);
    const list = card.locator(".roster-stock-missing");
    await expect(list).toBeVisible();
    const text = await list.innerText();
    expect(text.startsWith("Thiếu: ")).toBe(true);
    expect(itemsOf(text, "Thiếu: ", ", ")).toHaveLength(entry.missing.length);
    for (const item of entry.missing.filter((missing) => missing.kind === "hero")) expect(text).toContain(`tướng ${item.name}`);
    const [listBox, cardBox] = await Promise.all([list.boundingBox(), card.boundingBox()]);
    expect(listBox.x + listBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 0.5);
    await expect(card.locator(".roster-stock-badge")).not.toHaveAttribute("title");
    expect(await noHorizontalOverflow(page)).toBe(true);
  });

  test("trình đọc màn hình đọc badge rồi danh sách món thiếu; không có gì bị ẩn khỏi cây trợ năng", async ({ page }) => {
    await page.goto("/doi-chuan/");
    const title = page.locator(`#section-team-chuan [data-reference-key="${missingId}"] .reference-card-title`);
    await expect(title.locator(".roster-stock-missing")).toBeVisible();
    const snapshot = await title.ariaSnapshot();
    const badgeAt = snapshot.indexOf(`Thiếu ${entry.missingCount} món`);
    const listAt = snapshot.indexOf("Thiếu: ");
    expect(badgeAt).toBeGreaterThanOrEqual(0);
    expect(listAt).toBeGreaterThan(badgeAt);
    expect(await title.locator(".roster-stock-cov").evaluate((node) => node.closest("[aria-hidden='true'],[hidden],[inert]") === null)).toBe(true);
  });

  test("đi bằng bàn phím: Tab tới thẻ đội thì danh sách món thiếu của chính thẻ đó hiện trong vùng nhìn thấy, không cần chạm", async ({ page }) => {
    await page.goto("/doi-chuan/");
    // Chờ trang vẽ xong thanh kho + badge (lượt vẽ lại sau khi đọc kho có thể thay node đang focus).
    await expect(page.locator("#section-team-chuan .reference-roster-bar")).toHaveAttribute("data-state", "ready");
    await expect(page.locator(`#section-team-chuan [data-reference-key="${missingId}"] .roster-stock-missing`)).toBeVisible();
    await expect(page.locator('body[data-boot="ready"]')).toBeAttached();
    const cards = page.locator("#section-team-chuan .reference-team-card");
    const index = await cards.evaluateAll((nodes, id) => nodes.findIndex((node) => node.dataset.referenceKey === id), missingId);
    expect(index).toBeGreaterThan(0);
    const card = cards.nth(index);
    const list = card.locator(".roster-stock-missing");
    // Xuất phát từ link tên đội của thẻ liền trước rồi chỉ dùng Tab, như người dùng bàn phím đi dọc danh sách.
    const start = cards.nth(index - 1).locator("a[data-team-detail-link]").first();
    await start.focus();
    await expect(start).toBeFocused();
    for (let presses = 0; presses < 40; presses += 1) {
      await page.keyboard.press("Tab");
      if (await card.evaluate((node) => node.contains(document.activeElement))) break;
    }
    expect(await card.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    await expect(list).toBeInViewport();
    expect(itemsOf(await list.innerText(), "Thiếu: ", ", ")).toHaveLength(entry.missing.length);
  });

  test("kiểu Bảng: badge ở ô đội, danh sách ở hàng phụ ngoài tiêu đề hàng, nối bằng aria-describedby; không tràn ngang", async ({ page }) => {
    await page.goto("/doi-chuan/?view=bang");
    const row = page.locator(`#section-team-chuan tr[data-reference-key="${missingId}"]`);
    const badge = row.locator("th .roster-stock-badge");
    await expect(badge).toHaveText(`Thiếu ${entry.missingCount} món`);
    await expect(row.locator(".roster-stock-missing")).toHaveCount(0);
    const extra = page.locator(`#section-team-chuan tr[data-reference-key="${missingId}"] + tr.roster-stock-missing-row`);
    await expect(extra.locator(".roster-stock-missing")).toBeVisible();
    const describedBy = await badge.getAttribute("aria-describedby");
    expect(await extra.locator(".roster-stock-missing").getAttribute("id")).toBe(describedBy);
    await expect(badge).toHaveAccessibleDescription(/^Thiếu: /);
    expect(await noHorizontalOverflow(page)).toBe(true);
  });

  test("thanh kho có thanh đo, chú giải ba mức và số đội trên nút lọc", async ({ page }) => {
    await page.goto("/doi-chuan/");
    const bar = page.locator("#section-team-chuan .reference-roster-bar");
    await expect(bar).toHaveAttribute("data-state", "ready");
    const counts = { ready: 0, near: 0, far: 0 };
    for (const item of expected.byConfigId.values()) counts[item.missingCount === 0 ? "ready" : item.missingCount <= 2 ? "near" : "far"]++;
    await expect(bar.getByRole("meter", { name: "Độ phủ kho" })).toHaveAttribute("aria-valuenow", String(counts.ready));
    await expect(bar.locator(".roster-legend")).toHaveText(`${counts.ready} ráp được${counts.near} thiếu 1–2 món${counts.far} thiếu từ 3 món`);
    await expect(bar.locator(".roster-source")).toContainText(`Theo kho đã lưu trên máy này: ${roster.ownedHeroes.length} tướng · ${roster.ownedTactics.length} chiến pháp`);
    await expect(bar.getByRole("button", { name: `Ráp được ${counts.ready}` })).toBeVisible();
    await expect(bar.getByRole("button", { name: `Thiếu tối đa 2 ${counts.ready + counts.near}` })).toBeVisible();
    await bar.getByRole("button", { name: "Dễ ráp nhất" }).click();
    await expect(bar.locator(".roster-sorted-note")).toHaveText("Sắp theo số món thiếu, giữ khối theo bậc.");
  });
});

test.describe("Đội chuẩn có kho: số trên nút, ngôn ngữ, nguồn kho, trang mùa cũ", () => {
  test("đang lọc chip hoặc tìm từ khoá thì ẩn số đội trên hai nút lọc kho; bỏ lọc thì hiện lại", async ({ page }) => {
    await seedLocal(page, roster);
    await page.goto("/doi-chuan/");
    const section = page.locator("#section-team-chuan");
    const bar = section.locator(".reference-roster-bar");
    await expect(bar).toHaveAttribute("data-state", "ready");
    const counts = bar.locator(".fchip-count");
    await expect(counts).toHaveCount(2);

    const facet = section.locator(".reference-filters .fchip").first();
    await facet.click();
    await expect(facet).toHaveAttribute("aria-pressed", "true");
    await expect(counts).toHaveCount(0);
    await expect(bar.getByRole("button", { name: "Ráp được", exact: true })).toBeVisible();
    await facet.click();
    await expect(counts).toHaveCount(2);

    await section.locator(".reference-search-input").fill("Lữ Bố");
    await expect(page).toHaveURL(/[?&]q=/);
    await expect(counts).toHaveCount(0);
    await section.locator(".reference-search-input").fill("");
    await expect(counts).toHaveCount(2);
  });

  test("/zh/doi-chuan/ có kho: danh sách bằng tên Hán, mở đầu '缺少：' không dấu cách", async ({ page }) => {
    await seedLocal(page, roster);
    await page.goto("/zh/doi-chuan/");
    const list = page.locator(`#section-team-chuan [data-reference-key="${missingId}"] .roster-stock-missing`);
    await expect(list).toBeVisible();
    const text = await list.innerText();
    expect(text.startsWith("缺少：")).toBe(true);
    expect(text.startsWith("缺少： ")).toBe(false);
    expect(itemsOf(text, "缺少：", "、")).toHaveLength(entry.missing.length);
    expect(text).not.toMatch(/tướng|chiến pháp/u);
  });

  test("đã đăng nhập: kho tài khoản ghi nguồn 'kho tài khoản'; tài khoản chưa có kho thì câu dẫn không nói 'không cần đăng nhập'", async ({ page }) => {
    const resolve = createRosterIdResolver(dicts);
    const { state } = mergeLocal(emptyCloudState("u-alice"), { ...roster, tacticOverrides: [] }, resolve, { now: 1_700_000_000_000 });
    const cloud = JSON.stringify({ userId: state.userId, cursor: state.cursor, pulledKinds: state.pulledKinds, records: state.records, dirty: state.dirty, rejected: state.rejected });
    let user = { id: "u-alice", name: "Alice", role: "user" };
    await page.route("**/api/me", (route) => route.fulfill({ json: { user } }));
    await page.addInitScript(([key, value]) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
      localStorage.setItem("tqccl:community-session", "1");
    }, [CLOUD_STORAGE_KEY, cloud]);
    await page.goto("/doi-chuan/");
    const bar = page.locator("#section-team-chuan .reference-roster-bar");
    await expect(bar).toHaveAttribute("data-state", "ready");
    await expect(bar.locator(".roster-source")).toContainText("Theo kho tài khoản (bản lưu trên máy này)");

    user = { id: "u-bob", name: "Bob", role: "user" };
    await page.reload();
    await expect(bar).toHaveAttribute("data-state", "empty");
    await expect(bar.locator(".reference-roster-hint")).toContainText("Kho của tài khoản bạn chưa có trên máy này.");
    await expect(bar.locator(".reference-roster-hint")).not.toContainText("không cần đăng nhập");
  });

  test("trang mùa cũ có kho: một câu tóm tắt (không thanh đo) và tên món thiếu trên thẻ", async ({ page }) => {
    const season = buildSeasonCandidates(records, OLD_SEASON, dicts);
    const target = season.teams[0];
    const oldRoster = rosterFor([target.id], OLD_SEASON);
    const oldExpected = buildListCoverage({ records, seasonId: OLD_SEASON, ...dicts, roster: oldRoster });
    await seedLocal(page, oldRoster);
    await page.goto(`/doi-chuan/${OLD_SEASON}/`);
    const root = page.locator("#section-season-page");
    await expect(root.locator(".reference-roster-summary")).toContainText(`${oldExpected.summary.complete} / ${oldExpected.summary.total}`);
    await expect(root.locator(".roster-meter, .roster-legend, .roster-summary-block")).toHaveCount(0);
    const [oldMissingId, oldEntry] = [...oldExpected.byConfigId].find(([, item]) => item.missingCount > 0);
    const list = root.locator(`[data-reference-key="${oldMissingId}"] .roster-stock-missing`);
    await expect(list).toBeVisible();
    expect(itemsOf(await list.innerText(), "Thiếu: ", ", ")).toHaveLength(oldEntry.missing.length);
  });
});

test.describe("Bài viết chi tiết (dev server có bài mẫu)", () => {
  const base = `http://127.0.0.1:${FIXTURE_PORT}`;
  const articlePath = `/bai-viet/${FIXTURE_SLUG}/`;

  test.beforeEach(async ({ page }) => {
    // Ảnh bìa mẫu và API cộng đồng không cần thật: trả ảnh rỗng / khách để trang không gọi ra ngoài.
    await page.route((url) => url.pathname === FIXTURE_COVER, (route) => route.fulfill({ status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="21" height="9"/>' }));
    await page.route("**/api/me", (route) => route.fulfill({ json: { user: null } }));
  });

  test("desktop 1440: đầu bài, ảnh bìa, tóm tắt, mục lục cột phụ, thân bài, FAQ, Trong cẩm nang, bài liên quan", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${base}${articlePath}`);
    const article = page.locator("article.bv-article");
    await expect(page.locator(".bv-crumbs")).toContainText("Trang chủ");
    await expect(article.locator(".bv-kicker")).toHaveText("Bài viết · Khai hoang");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Khai hoang không cần full đỏ: chọn đội mở đất và đánh mỏ cấp 4–6");
    await expect(article.locator(".bv-meta")).toContainText("Ban biên tập Cẩm Nang");
    await expect(article.locator(".bv-meta time")).toHaveCount(2);
    await expect(article.getByRole("list", { name: "Chủ đề" }).getByRole("listitem")).toHaveText(["Khai hoang", "Chạm Sứ", "Quân thủ mỏ", "Binh Diễn Xuân Thu"]);
    await expect(article.getByRole("link", { name: "Đọc bản tiếng Trung" })).toHaveAttribute("href", `/zh/bai-viet/${FIXTURE_SLUG}/`);
    await expect(article.locator(".bv-cover img")).toHaveAttribute("src", FIXTURE_COVER);
    await expect(page.locator("#blog-summary")).toContainText("Bốn đội khai hoang có điểm cao nhất");

    const sideToc = page.locator("aside.bv-side #blog-toc");
    await expect(sideToc).toBeVisible();
    await expect(page.locator(".bv-toc-mobile")).toBeHidden();
    await expect(sideToc.getByRole("link")).toHaveCount(6);
    await expect(sideToc.locator('a[aria-current="location"]')).toHaveText("Đội mở đất nên chọn");
    const side = await sideToc.evaluate((node) => {
      const style = getComputedStyle(node.closest(".bv-side"));
      return { position: style.position, overflowY: style.overflowY, maxHeight: style.maxHeight };
    });
    expect(side).toEqual({ position: "sticky", overflowY: "auto", maxHeight: `${900 - 96 - 24}px` });

    const body = page.locator("#blog-body");
    await expect(body.getByRole("heading", { level: 2 })).toHaveText(["Đội mở đất nên chọn", "Đội Chạm Sứ mang 1 lính", "Quân thủ mỏ cấp 4 và 5", "Lưu đội để chỉnh theo kho"]);
    await expect(body.locator(".bv-table-wrap").first().locator("tbody th[scope='row']").first()).toHaveText("Gia Cát Khác · Thái Sử Từ · Tả Từ");
    expect(await body.locator("[style]").count()).toBe(0);

    const faq = page.locator("#blog-faq");
    await expect(faq.getByRole("heading", { level: 2 })).toHaveText("Câu hỏi thường gặp");
    await expect(faq.locator("details")).toHaveCount(3);
    await expect(faq.locator("details").first()).toHaveAttribute("open", "");
    await faq.locator("summary").nth(1).click();
    await expect(faq.locator("details").nth(1).locator("p")).toBeVisible();

    const guide = page.locator(".bv-guide");
    await expect(guide).toContainText("Trong cẩm nang");
    await expect(guide.getByRole("link", { name: "Mở mục Khai hoang" })).toHaveAttribute("href", "/khai-hoang/");
    await expect(page.locator("#blog-related .bv-card")).toHaveCount(2);
    await expect(page.getByRole("navigation", { name: "Quay lại danh sách bài viết" }).getByRole("link")).toHaveAttribute("href", "/bai-viet/");
  });

  test("HTML dựng sẵn không đánh dấu mục lục; bảng là vùng cuộn có tên chỉ khi thật sự cuộn ngang", async ({ page, request }) => {
    const html = await (await request.get(`${base}${articlePath}`)).text();
    expect(html).not.toContain('aria-current="location"');
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${base}${articlePath}`);
      await expect(page.locator('#blog-toc a[aria-current="location"], .bv-toc-mobile a[aria-current="location"]').first()).toBeAttached();
      const frames = await page.locator("#blog-body .bv-table-wrap").evaluateAll((nodes) => nodes.map((node) => ({
        scrolls: node.scrollWidth > node.clientWidth + 1,
        role: node.getAttribute("role"),
        tabindex: node.getAttribute("tabindex"),
        label: node.getAttribute("aria-label"),
      })));
      expect(frames.length).toBe(2);
      for (const frame of frames) {
        if (frame.scrolls) expect(frame).toMatchObject({ role: "region", tabindex: "0", label: expect.stringMatching(/ · /u) });
        else expect(frame).toEqual({ scrolls: false, role: null, tabindex: null, label: null });
      }
      if (width === 390) expect(frames.some((frame) => frame.scrolls)).toBe(true);
    }
  });

  test("SEO giữ nguyên: canonical, hreflang, BlogPosting + BreadcrumbList + FAQPage", async ({ page }) => {
    await page.goto(`${base}${articlePath}`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://tqccl.com${articlePath}`);
    await expect(page.locator('link[rel="alternate"][hreflang="zh-Hans"]')).toHaveCount(1);
    const types = await page.locator('script[type="application/ld+json"]').evaluateAll((nodes) => nodes.map((node) => JSON.parse(node.textContent)["@type"]));
    expect(types).toEqual(expect.arrayContaining(["BlogPosting", "BreadcrumbList", "FAQPage"]));
    const faq = await page.locator('script[type="application/ld+json"]').evaluateAll((nodes) => nodes.map((node) => JSON.parse(node.textContent)).find((data) => data["@type"] === "FAQPage"));
    expect(faq.mainEntity).toHaveLength(3);
  });

  test("mục lục đánh dấu mục đang đọc khi cuộn", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${base}${articlePath}`);
    // Đưa heading thứ ba tới sát mép trên cửa sổ (qua ngưỡng đọc), chưa tới heading thứ tư.
    await page.locator("#blog-body h2").nth(2).evaluate((heading) => window.scrollTo(0, heading.getBoundingClientRect().top + window.scrollY - 40));
    await expect(page.locator('#blog-toc a[aria-current="location"]')).toHaveText("Quân thủ mỏ cấp 4 và 5");
    await expect(page.locator('#blog-toc a[aria-current="location"]')).toHaveCount(1);
  });

  test("mobile 390: mục lục mở/đóng sau Tóm tắt, Trong cẩm nang sau FAQ, ảnh bìa và bảng tràn sát mép, không tràn ngang", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}${articlePath}`);
    const toc = page.locator(".bv-toc-mobile");
    await expect(toc).toBeVisible();
    await expect(toc).toHaveAttribute("open", "");
    await expect(toc.locator(".bv-toc-count")).toHaveText("6 mục");
    await expect(page.locator("#blog-toc")).toBeHidden();
    const [summary, tocBox, faq, guide, cover, table] = await Promise.all(["#blog-summary", ".bv-toc-mobile", "#blog-faq", ".bv-guide", ".bv-cover", ".bv-table-wrap"].map((selector) => page.locator(selector).first().boundingBox()));
    expect(tocBox.y).toBeGreaterThan(summary.y);
    expect(guide.y).toBeGreaterThan(faq.y);
    for (const box of [cover, table]) expect([Math.round(box.x), Math.round(box.width)]).toEqual([0, 390]);
    await toc.locator("summary").click();
    await expect(toc.getByRole("link").first()).toBeHidden();
    expect(await noHorizontalOverflow(page)).toBe(true);
  });

  test("tablet 768: ảnh bìa và bảng nằm trong lề trang (không lề âm), không tràn ngang", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${base}${articlePath}`);
    const [summary, cover, table] = await Promise.all(["#blog-summary", ".bv-cover", ".bv-table-wrap"].map((selector) => page.locator(selector).first().boundingBox()));
    for (const box of [cover, table]) expect(Math.round(box.x)).toBe(Math.round(summary.x));
    expect(await noHorizontalOverflow(page)).toBe(true);
  });

  test("bản zh: chữ của trang bằng tiếng Trung, link bản Việt", async ({ page }) => {
    await page.goto(`${base}/zh${articlePath}`);
    await expect(page.locator(".bv-kicker")).toHaveText("文章 · 开荒");
    await expect(page.locator("#blog-summary .bv-label")).toHaveText("摘要");
    await expect(page.locator(".bv-guide-link")).toHaveText("打开开荒栏目");
    await expect(page.getByRole("link", { name: "阅读越南语版本" })).toHaveAttribute("href", articlePath);
  });
});
