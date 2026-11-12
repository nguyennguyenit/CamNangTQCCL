// Thiết kế mới nhóm Bài viết + Đội chuẩn có kho (artboard MainKho / BaiVietDetail + Mobile).
// 1. Đội chuẩn có kho ở 390px: tên món thiếu là chữ trên thẻ — thấy ngay không cần hover, nằm trong cây trợ năng (trình
//    đọc màn hình đọc theo thứ tự badge → "Thiếu: …"), đi tới được bằng bàn phím, không tràn ngang (issue #69 mục 1).
// 2. Bài viết chi tiết: build thường không có bài (blog lấy từ API cộng đồng lúc build), nên spec chạy dev server có bài
//    mẫu riêng (`scripts/design-canvas/bai-viet-fixture.mjs`, cổng trống bất kỳ) và kiểm các khối chính + SEO.
import { expect, test } from "@playwright/test";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { buildSeasonCandidates } from "../js/roster-season-candidates.js";
import { buildListCoverage } from "../js/roster-list-coverage.js";
import { FIXTURE_COVER, FIXTURE_SLUG } from "../scripts/design-canvas/bai-viet-fixture.mjs";

const read = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const { generationId } = read("src/data/recommended-reference/current.json");
const { records } = read(`src/data/recommended-reference/${generationId}/index.json`);
const dicts = { heroesDict: read("data/heroes-dict.json"), tacticsDict: read("data/tactics.json") };
const SCAN_KEY = "tqccl.rosterRecommend.scanState.v1";
const SEASON = "og-兵演春秋";
const READY_TEAMS = ["og-bingyan-40y-lvbu-b", "og-bingyan-wunv-cavalry-hubaoqi"];

function rosterFor(configIds) {
  const { teams } = buildSeasonCandidates(records.filter((record) => configIds.includes(record.sourceConfigId)), SEASON, dicts);
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

test.describe("Đội chuẩn có kho ở 390px: món thiếu trên thẻ", () => {
  const roster = rosterFor(READY_TEAMS);
  const expected = buildListCoverage({ records, seasonId: SEASON, ...dicts, roster });
  // Đội thiếu nhiều món nhất: danh sách dài nhất, dễ tràn nhất.
  const [missingId, entry] = [...expected.byConfigId].sort((a, b) => b[1].missingCount - a[1].missingCount)[0];

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(([key, value]) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    }, [SCAN_KEY, JSON.stringify(roster)]);
  });

  test("tên món thiếu thấy ngay trên thẻ, đủ món, nằm trong khung thẻ, không tràn ngang", async ({ page }) => {
    await page.goto("/doi-chuan/");
    const card = page.locator(`#section-team-chuan [data-reference-key="${missingId}"]`);
    const list = card.locator(".roster-stock-missing");
    await expect(list).toBeVisible();
    const text = await list.innerText();
    expect(text.startsWith("Thiếu: ")).toBe(true);
    const items = text.slice("Thiếu: ".length).split(", ");
    expect(items).toHaveLength(entry.missing.length);
    for (const item of entry.missing.filter((missing) => missing.kind === "hero")) expect(text).toContain(`tướng ${item.name}`);
    const [listBox, cardBox] = await Promise.all([list.boundingBox(), card.boundingBox()]);
    expect(listBox.x + listBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 0.5);
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

  test("đi bằng bàn phím: Tab từ link tên đội tới thẻ, danh sách món thiếu nằm trong vùng nhìn thấy", async ({ page }) => {
    await page.goto("/doi-chuan/");
    const card = page.locator(`#section-team-chuan [data-reference-key="${missingId}"]`);
    await expect(card.locator(".roster-stock-missing")).toBeVisible();
    await card.locator("a[data-team-detail-link]").first().focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(card.locator("a[data-team-detail-link]").first()).toBeFocused();
    await expect(card.locator(".roster-stock-missing")).toBeInViewport();
  });

  test("chạm vào badge không làm mất danh sách; kiểu Bảng ở 390px cũng có danh sách và không tràn ngang", async ({ page }) => {
    await page.goto("/doi-chuan/");
    const card = page.locator(`#section-team-chuan [data-reference-key="${missingId}"]`);
    await card.locator(".roster-stock-badge").click();
    await expect(card.locator(".roster-stock-missing")).toBeVisible();
    await page.goto("/doi-chuan/?view=bang");
    await expect(page.locator(`#section-team-chuan tr[data-reference-key="${missingId}"] .roster-stock-missing`)).toContainText("Thiếu:");
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
    await expect(bar.locator(".roster-source")).toContainText(`${roster.ownedHeroes.length} tướng · ${roster.ownedTactics.length} chiến pháp`);
    await expect(bar.getByRole("button", { name: `Ráp được ${counts.ready}` })).toBeVisible();
    await expect(bar.getByRole("button", { name: `Thiếu tối đa 2 ${counts.ready + counts.near}` })).toBeVisible();
    await bar.getByRole("button", { name: "Dễ ráp nhất" }).click();
    await expect(bar.locator(".roster-sorted-note")).toHaveText("Sắp theo số món thiếu, giữ khối theo bậc.");
  });
});

/** Cổng TCP trống trên 127.0.0.1. */
async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

test.describe("Bài viết chi tiết (dev server có bài mẫu)", () => {
  test.describe.configure({ mode: "serial" });
  let child = null;
  let base = "";
  const output = [];
  const articlePath = `/bai-viet/${FIXTURE_SLUG}/`;

  test.beforeAll(async () => {
    test.setTimeout(180_000);
    const port = await freePort();
    const script = fileURLToPath(new URL("../scripts/design-canvas/bai-viet-fixture.mjs", import.meta.url));
    child = spawn(process.execPath, [script, "--port", String(port)], { cwd: fileURLToPath(new URL("..", import.meta.url)), stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", (chunk) => output.push(String(chunk)));
    child.stderr.on("data", (chunk) => output.push(String(chunk)));
    base = `http://127.0.0.1:${port}`;
    for (let attempt = 0; ; attempt += 1) {
      if (child.exitCode !== null) throw new Error(`dev server bài mẫu dừng sớm:\n${output.join("")}`);
      try {
        const response = await fetch(`${base}${articlePath}`);
        if (response.ok) break;
      } catch {
        // còn đang khởi động
      }
      if (attempt > 600) throw new Error(`dev server bài mẫu không lên:\n${output.join("")}`);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  });

  test.afterAll(async () => {
    if (!child || child.exitCode !== null) return;
    const exited = new Promise((resolve) => child.once("exit", resolve));
    child.kill("SIGTERM");
    const timer = setTimeout(() => child.kill("SIGKILL"), 5_000);
    await exited;
    clearTimeout(timer);
  });

  test.beforeEach(async ({ page }) => {
    // Ảnh bìa mẫu và API cộng đồng không cần thật: trả ảnh rỗng / 204 để trang không gọi ra ngoài.
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
    expect(await sideToc.evaluate((node) => getComputedStyle(node.closest(".bv-side")).position)).toBe("sticky");

    const body = page.locator("#blog-body");
    await expect(body.getByRole("heading", { level: 2 })).toHaveText(["Đội mở đất nên chọn", "Đội Chạm Sứ mang 1 lính", "Quân thủ mỏ cấp 4 và 5", "Lưu đội để chỉnh theo kho"]);
    const table = body.getByRole("region", { name: /^Đội · Binh chủng · Đất 4/ });
    await expect(table).toHaveAttribute("tabindex", "0");
    await expect(table.getByRole("rowheader").first()).toHaveText("Gia Cát Khác · Thái Sử Từ · Tả Từ");
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

  test("mobile 390: mục lục mở/đóng sau Tóm tắt, Trong cẩm nang sau FAQ, không tràn ngang", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}${articlePath}`);
    const toc = page.locator(".bv-toc-mobile");
    await expect(toc).toBeVisible();
    await expect(toc).toHaveAttribute("open", "");
    await expect(toc.locator(".bv-toc-count")).toHaveText("6 mục");
    await expect(page.locator("#blog-toc")).toBeHidden();
    const [summary, tocBox, faq, guide] = await Promise.all(["#blog-summary", ".bv-toc-mobile", "#blog-faq", ".bv-guide"].map((selector) => page.locator(selector).boundingBox()));
    expect(tocBox.y).toBeGreaterThan(summary.y);
    expect(guide.y).toBeGreaterThan(faq.y);
    await toc.locator("summary").click();
    await expect(toc.getByRole("link").first()).toBeHidden();
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
