// Phase 10 (P10-1) — vùng bấm mobile của các control từng dưới 44px và bị bỏ sót ở các phase trước:
// nút quan hệ trong hồ sơ Tra cứu (`.lookup-relation-name`) và nút mở đội trong kết quả Soi đội (`.ana-team-link`).
// Mỗi ca dựng trạng thái thật (mở/có dữ liệu) ở 320/390 × 2 theme, đo CẢ HAI chiều và kiểm kích hoạt.
import { expect, test } from "@playwright/test";

const TURNSTILE_STUB = "window.turnstile={render:(_node,options)=>options.callback('fixture-token'),reset:()=>{}};";

/** 320/390 × sáng/tối; theme lấy từ chính hệ điều hành mà trình duyệt mô phỏng (không ghi storage). */
const CASES = [
  { width: 390, colorScheme: "light" },
  { width: 390, colorScheme: "dark" },
  { width: 320, colorScheme: "light" },
  { width: 320, colorScheme: "dark" },
];

test.describe("A5 — control đứng riêng phải đủ 44px ở mobile", () => {
  test("nút quan hệ trong hồ sơ Tra cứu: đủ 44px, Enter mở hồ sơ liên quan", async ({ browser }) => {
    for (const { width, colorScheme } of CASES) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme });
      const page = await context.newPage();
      await page.goto("/tra-cuu/tuong/");
      await expect(page.locator('body[data-boot="ready"]')).toBeAttached();
      await page.getByRole("searchbox").fill("luu bi");
      await page.locator("#section-lookup .lookup-card [data-lookup-id]").first().click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      const relation = dialog.locator("[data-lookup-relation]").first();
      await expect(relation).toBeVisible();
      const box = await relation.boundingBox();
      expect(box.height, `${width}/${colorScheme}: chiều cao nút quan hệ`).toBeGreaterThanOrEqual(44);
      expect(box.width, `${width}/${colorScheme}: chiều rộng nút quan hệ`).toBeGreaterThanOrEqual(44);

      await relation.focus();
      await page.keyboard.press("Enter");
      await expect(page, `${width}/${colorScheme}: Enter phải mở hồ sơ liên quan`).toHaveURL(/\/tra-cuu\/chien-phap\/\?id=tactic%3A/);
      await expect(dialog, `${width}/${colorScheme}: hồ sơ chiến pháp mở trên trang Chiến pháp`).toBeVisible();
      await context.close();
    }
  });

  test("nút mở đội trong kết quả Soi đội: đủ 44px, Enter mở trang chi tiết", async ({ browser }) => {
    // Link chia sẻ `?doi=` của một Đội chuẩn mùa mặc định có đủ tướng trong từ điển: kết quả dựng không cần Worker.
    const setup = await browser.newPage();
    await setup.goto("/soi-doi-tu-anh/");
    await expect(setup.locator('body[data-boot="ready"]')).toBeAttached();
    const link = await setup.evaluate(async () => {
      const [{ createEntityIndex, referenceTeam }, { encodeTeamParam }] = await Promise.all([import("/js/analyze-map.js"), import("/js/analyze-state.js")]);
      const pin = JSON.parse(document.querySelector("#recommended-publication").textContent);
      const json = (path) => fetch(path).then((response) => response.json());
      const [seasons, index, heroes] = await Promise.all([
        json(`/data/recommended/${pin.generationId}/seasons.json`), json(`/data/recommended/${pin.generationId}/index.json`), json("/data/heroes-dict.json"),
      ]);
      const known = createEntityIndex(heroes, "hero").byId;
      for (const record of index.records.filter((item) => item.sourceSeasonId === seasons.defaultSourceSeasonId)) {
        const ids = referenceTeam(record).slots.map((slot) => slot.alternatives[0]?.canonicalId);
        if (ids.length !== 3 || !ids.every((id) => known.has(id))) continue;
        const doi = encodeTeamParam({ heroes: ids.map((hero) => ({ hero, tactics: [null, null], book: null })) });
        return `/soi-doi-tu-anh/?season=${encodeURIComponent(seasons.defaultSourceSeasonId)}&doi=${doi}`;
      }
      return null;
    });
    await setup.close();
    expect(link).not.toBeNull();

    for (const { width, colorScheme } of CASES) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme });
      await context.route("https://challenges.cloudflare.com/**", (route) =>
        route.fulfill({ contentType: "application/javascript", body: TURNSTILE_STUB }));
      const page = await context.newPage();
      await page.goto(link);
      await expect(page.locator('body[data-boot="ready"]')).toBeAttached();

      const teamLink = page.locator("#section-analyze .ana-team-row .ana-team-link").first();
      await expect(teamLink).toBeVisible();
      const box = await teamLink.boundingBox();
      expect(box.height, `${width}/${colorScheme}: chiều cao nút mở đội`).toBeGreaterThanOrEqual(44);
      expect(box.width, `${width}/${colorScheme}: chiều rộng nút mở đội`).toBeGreaterThanOrEqual(44);

      await teamLink.focus();
      await page.keyboard.press("Enter");
      await expect(page, `${width}/${colorScheme}: Enter phải mở trang chi tiết đội`).toHaveURL(/\/doi-(khac|chuan)\//);
      await context.close();
    }
  });
});

test.describe("A5 — vòng sửa Opus round 3", () => {
  test("nút tên chiến pháp trong bảng Tra cứu: đủ 44px và Enter mở hồ sơ", async ({ browser }) => {
    for (const { width, colorScheme } of CASES) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme });
      await context.route("**/*", (route) => new URL(route.request().url()).hostname === "127.0.0.1"
        ? route.continue() : route.abort());
      const page = await context.newPage();
      await page.goto("/tra-cuu/chien-phap/");
      await expect(page.locator('body[data-boot="ready"]')).toBeAttached();
      const names = page.locator("#section-lookup .lookup-table-name");
      await expect(names.first()).toBeVisible();
      const boxes = await names.evaluateAll((nodes) => nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return { height: Math.round(rect.height), width: Math.round(rect.width) };
      }));
      expect(boxes.length, `${width}/${colorScheme}: số nút`).toBeGreaterThan(20);
      for (const box of boxes) {
        expect(box.height, `${width}/${colorScheme}: chiều cao nút tên`).toBeGreaterThanOrEqual(44);
        expect(box.width, `${width}/${colorScheme}: chiều rộng nút tên`).toBeGreaterThanOrEqual(44);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      // Enter mở đúng hồ sơ của chiến pháp đang chọn.
      const first = names.first();
      const label = (await first.textContent()).trim();
      await first.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText(label);
      await expect(page).toHaveURL(/id=tactic/);
      await context.close();
    }
  });
});
