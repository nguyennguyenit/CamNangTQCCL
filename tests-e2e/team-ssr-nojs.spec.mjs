import { test, expect } from "@playwright/test";

// Trang đội dựng sẵn: mở với JavaScript tắt hẳn vẫn thấy nội dung đội (HTML tĩnh), không câu chờ/yêu cầu JS.
const WAITING = /Đang tải chi tiết|正在加载详情|cần JavaScript|需要 JavaScript/u;
const LOCALES = [["vi", ""], ["zh", "/zh"]];
const LISTS = [
  { path: "/doi-chuan/", team: ".reference-team-card", detail: true },
  { path: "/doi-khac/", team: ".reference-team-card", detail: true },
  { path: "/cung-ton/", team: ".coexist-team-card", detail: false },
  { path: "/khai-hoang/", team: ".kh-card", detail: true },
];

test.describe("không có JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  for (const [locale, prefix] of LOCALES) {
    for (const { path, team, detail } of LISTS) {
      test(`${locale} ${path}: danh sách có đội mặc định (3 tướng${detail ? " + link chi tiết" : ""}) và đúng một h1`, async ({ page }) => {
        await page.goto(`${prefix}${path}`, { waitUntil: "domcontentloaded" });
        await expect(page.locator("h1")).toHaveCount(1);
        await expect(page.locator("main")).not.toContainText(WAITING);
        const cards = page.locator(`main ${team}`);
        expect(await cards.count()).toBeGreaterThan(0);
        await expect(cards.first()).toBeVisible();
        // Mỗi đội: ba hàng tướng.
        const heroRows = cards.first().locator(".hero, .kh-holder");
        expect(await heroRows.count()).toBeGreaterThanOrEqual(3);
        if (detail) {
          const link = cards.first().locator("a[data-team-detail-link], a.kh-title-link").first();
          await expect(link).toHaveAttribute("href", new RegExp(`^${prefix}${path}[^/?#]+/`));
        }
      });
    }

    for (const { path } of LISTS.filter((item) => item.detail)) {
      test(`${locale} ${path}: bấm đội đầu mở trang chi tiết có thân dựng sẵn`, async ({ page }) => {
        await page.goto(`${prefix}${path}`, { waitUntil: "domcontentloaded" });
        const href = await page.locator("main a[data-team-detail-link], main a.kh-title-link").first().getAttribute("href");
        expect(href).toBeTruthy();
        await page.goto(href, { waitUntil: "domcontentloaded" });
        await expect(page.locator("h1")).toHaveCount(1);
        const body = page.locator("#team-detail-body");
        await expect(body).toBeVisible();
        await expect(body.locator("h2").first()).toBeVisible();
        expect(await body.locator(".detail-hero-card, .kh-hero-card, .detail-section").count()).toBeGreaterThan(0);
        await expect(page.locator("#team-detail-status")).toHaveCount(0);
        await expect(page.locator("main")).not.toContainText(WAITING);
        await expect(page.locator("#team-detail-root")).toHaveAttribute("aria-busy", "false");
      });
    }
  }
});
