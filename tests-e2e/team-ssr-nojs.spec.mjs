import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

// Trang đội dựng sẵn: mở với JavaScript tắt hẳn vẫn thấy nội dung đội (HTML tĩnh), không câu chờ/yêu cầu JS.
const WAITING = /Đang tải chi tiết|正在加载详情|cần JavaScript|需要 JavaScript/u;
const LOCALES = [["vi", ""], ["zh", "/zh"]];
/** Ledger handle đóng băng: `handle → legacyTeamId` để đọc ngược link trang Đội khác (link không mang `?variant=`). */
const LEGACY_BY_HANDLE = new Map(Object.entries(JSON.parse(readFileSync(new URL("../pipeline/team-route-handles.json", import.meta.url), "utf8")).handles.legacy)
  .map(([legacyTeamId, handle]) => [handle, legacyTeamId]));
const OPTIONS_TITLE = { vi: "Các phương án khác của team", zh: "本队其他方案" };
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

    test(`${locale} /doi-khac/: mỗi thẻ là một team có phương án đủ dữ liệu, không link nào tới phương án bị loại`, async ({ page, request }) => {
      const pin = await (await request.get("/data/recommended/current.json")).json();
      const other = await (await request.get(`/data/recommended/${pin.generationId}/other-teams.json`)).json();
      const complete = new Set(other.records.filter((row) => row.dataComplete === true).map((row) => row.legacyTeamId));
      const teams = other.teamGroups.filter((group) => group.representativeVariantId !== null);
      await page.goto(`${prefix}/doi-khac/`, { waitUntil: "domcontentloaded" });
      const cards = page.locator("main .reference-team-card");
      await expect(cards).toHaveCount(Math.min(60, teams.length));
      const keys = await cards.evaluateAll((nodes) => nodes.map((node) => node.dataset.referenceKey));
      expect(keys.every((key) => teams.some((group) => group.representativeVariantId === key))).toBe(true);
      const hrefs = await page.locator("main a[data-team-detail-link]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")));
      expect(hrefs.length).toBeGreaterThan(0);
      for (const href of hrefs) {
        const url = new URL(href, "https://x.test");
        // Mỗi đội gốc một phương án: link không mang `?variant=`, handle trỏ đúng đội gốc của phương án đủ dữ liệu.
        expect(url.searchParams.has("variant"), href).toBe(false);
        const handle = decodeURIComponent(url.pathname.replace(/^(?:\/zh)?\/doi-khac\//u, "").replace(/\/$/u, ""));
        expect(complete.has(LEGACY_BY_HANDLE.get(handle)), href).toBe(true);
      }
    });

    test(`${locale} trang Đội khác: khối các phương án khác của team đọc được khi không có JS, mỗi link mở trang 200`, async ({ page, request }) => {
      const pin = await (await request.get("/data/recommended/current.json")).json();
      const other = await (await request.get(`/data/recommended/${pin.generationId}/other-teams.json`)).json();
      const byVariant = new Map(other.records.map((row) => [row.legacyVariantId, row]));
      const group = other.teamGroups.find((item) => item.completeVariantIds.length >= 2);
      const [current, ...rest] = group.completeVariantIds.map((id) => byVariant.get(id)).sort((a, b) => a.optionRank - b.optionRank);
      const handles = Object.fromEntries([...LEGACY_BY_HANDLE].map(([handle, id]) => [id, handle]));
      await page.goto(`${prefix}/doi-khac/${encodeURIComponent(handles[current.legacyTeamId])}/`, { waitUntil: "domcontentloaded" });
      const section = page.locator("#team-detail-body .detail-team-options");
      await expect(section).toBeVisible();
      await expect(section.locator("h2")).toHaveText(OPTIONS_TITLE[locale]);
      const hrefs = await section.locator("a.detail-team-option-link").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
      expect(hrefs).toEqual(rest.map((row) => `${prefix}/doi-khac/${encodeURIComponent(handles[row.legacyTeamId])}/`));
      for (const href of hrefs) expect((await request.get(href)).status(), href).toBe(200);
      expect(await section.locator(".detail-team-option-item.is-diff").count()).toBeGreaterThan(0);
    });

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
