// Phase 10 (P10-1) — vùng bấm mobile của ba control từng dưới 44px và bị bỏ sót ở các phase trước:
// mục lục hướng dẫn Khai hoang (`.kh-guide-details summary`), nút quan hệ trong hồ sơ Tra cứu
// (`.lookup-relation-name`) và nút mở đội trong kết quả Soi đội (`.ana-team-link`).
// Mỗi ca dựng trạng thái thật (mở/có dữ liệu) ở 320/390 × 2 theme, đo CẢ HAI chiều và kiểm kích hoạt.
import { expect, test } from "@playwright/test";

const transparentPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+4gZ8WQAAAABJRU5ErkJggg==",
  "base64",
);
const TURNSTILE_STUB = "window.turnstile={render:(_node,options)=>options.callback('fixture-token'),reset:()=>{}};";
const WORKER_ROUTE = "https://tqccl-vision-proxy.nguyennlt-ncc.workers.dev/**";

/** 320/390 × sáng/tối; theme lấy từ chính hệ điều hành mà trình duyệt mô phỏng (không ghi storage). */
const CASES = [
  { width: 390, colorScheme: "light" },
  { width: 390, colorScheme: "dark" },
  { width: 320, colorScheme: "light" },
  { width: 320, colorScheme: "dark" },
];

/** Đội Khai hoang có `guide` trong dữ liệu thật (đo `.kh-guide-details`). */
const GUIDE_TEAM_PATH = "/khai-hoang/gia-cat-khac-quan-ngan-binh-nhac-tien/";

test.describe("A5 — control đứng riêng phải đủ 44px ở mobile", () => {
  test("mục lục hướng dẫn Khai hoang: đủ 44px, mở được bằng Enter", async ({ browser }) => {
    for (const { width, colorScheme } of CASES) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme });
      const page = await context.newPage();
      await page.goto(GUIDE_TEAM_PATH);
      const summary = page.locator(".kh-guide-details summary").first();
      await expect(summary).toBeVisible();
      const box = await summary.boundingBox();
      expect(box.height, `${width}/${colorScheme}: chiều cao mục lục`).toBeGreaterThanOrEqual(44);
      expect(box.width, `${width}/${colorScheme}: chiều rộng mục lục`).toBeGreaterThanOrEqual(44);

      const details = page.locator(".kh-guide-details").first();
      await expect(details).not.toHaveAttribute("open", "");
      await summary.focus();
      await page.keyboard.press("Enter");
      await expect(details, `${width}/${colorScheme}: Enter phải mở mục lục`).toHaveAttribute("open", "");
      await page.keyboard.press("Enter");
      await expect(details).not.toHaveAttribute("open", "");
      await context.close();
    }
  });

  test("nút quan hệ trong hồ sơ Tra cứu: đủ 44px, Enter mở hồ sơ liên quan", async ({ browser }) => {
    for (const { width, colorScheme } of CASES) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme });
      const page = await context.newPage();
      await page.goto("/tra-cuu/?group=heroes");
      await page.getByRole("searchbox").fill("luu bi");
      await page.locator("#section-lookup .lookup-card").first().click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      const relation = dialog.locator("[data-lookup-relation]").first();
      await expect(relation).toBeVisible();
      const box = await relation.boundingBox();
      expect(box.height, `${width}/${colorScheme}: chiều cao nút quan hệ`).toBeGreaterThanOrEqual(44);
      expect(box.width, `${width}/${colorScheme}: chiều rộng nút quan hệ`).toBeGreaterThanOrEqual(44);

      await relation.focus();
      await page.keyboard.press("Enter");
      await expect(page, `${width}/${colorScheme}: Enter phải mở hồ sơ liên quan`).toHaveURL(/group=tactics/);
      await context.close();
    }
  });

  test("nút mở đội trong kết quả Soi đội: đủ 44px, Enter mở trang chi tiết", async ({ browser, request }) => {
    const teams = await (await request.get("/data/teams.json")).json();
    const target = teams.find((team) => Array.isArray(team.heroes) && team.heroes.length >= 3);
    const heroesDict = await (await request.get("/data/heroes-dict.json")).json();
    const tacticsDict = await (await request.get("/data/tactics.json")).json();
    const reads = target.heroes.map((hero) => ({
      nameCn: heroesDict.find((record) => record.viet === hero.name)?.chinese ?? hero.name,
      tacticsCn: (hero.tactics || []).map((slot) => tacticsDict.find((record) => record.viet === slot.name)?.chinese ?? slot.name),
      booksCn: [],
      statFocusCn: "",
    }));

    for (const { width, colorScheme } of CASES) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme });
      await context.route("https://challenges.cloudflare.com/**", (route) =>
        route.fulfill({ contentType: "application/javascript", body: TURNSTILE_STUB }));
      await context.route(WORKER_ROUTE, (route) => route.fulfill({ json: { heroes: reads } }));
      const page = await context.newPage();
      await page.goto("/soi-doi-tu-anh/");
      await expect(page.locator('body[data-boot="ready"]')).toBeAttached();
      await page.locator("#section-analyze input[type=file]").setInputFiles({ name: "doi-hinh.png", mimeType: "image/png", buffer: transparentPng });
      const run = page.locator("#section-analyze").getByRole("button", { name: "Soi đội", exact: true });
      await expect(run).toBeEnabled();
      await run.click();

      const link = page.locator("#section-analyze .ana-team-row .ana-team-link").first();
      await expect(link).toBeVisible();
      const box = await link.boundingBox();
      expect(box.height, `${width}/${colorScheme}: chiều cao nút mở đội`).toBeGreaterThanOrEqual(44);
      expect(box.width, `${width}/${colorScheme}: chiều rộng nút mở đội`).toBeGreaterThanOrEqual(44);

      await link.focus();
      await page.keyboard.press("Enter");
      await expect(page, `${width}/${colorScheme}: Enter phải mở trang chi tiết đội`).toHaveURL(/\/doi-(khac|chuan)\//);
      await context.close();
    }
  });
});

test.describe("A5 — vòng sửa Opus round 2", () => {
  test("link nguồn tham khảo trong thân chi tiết Đội chuẩn: đủ 44px, Enter mở được", async ({ browser }) => {
    const path = "/doi-chuan/pk-s24-tiem-long-dieu-thuyen/";
    for (const { width, colorScheme } of CASES) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme });
      await context.route("**/*", (route) => new URL(route.request().url()).hostname === "127.0.0.1"
        ? route.continue() : route.abort());
      const page = await context.newPage();
      await page.goto(path);
      const link = page.locator(".detail-source > p > a").first();
      await expect(link).toBeVisible();
      const box = await link.boundingBox();
      expect(box.height, `${width}/${colorScheme}: chiều cao link nguồn`).toBeGreaterThanOrEqual(44);
      expect(box.width, `${width}/${colorScheme}: chiều rộng link nguồn`).toBeGreaterThanOrEqual(44);
      // Không còn màu link mặc định của trình duyệt (P06-B2).
      const colour = await link.evaluate((node) => getComputedStyle(node).color);
      expect(["rgb(0, 0, 238)", "rgb(85, 26, 139)", "rgb(158, 158, 255)"]).not.toContain(colour);
      const [popup] = await Promise.all([page.waitForEvent("popup"), link.press("Enter")]);
      expect(popup, `${width}/${colorScheme}: Enter mở tab mới`).toBeTruthy();
      await popup.close();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
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
      await page.goto("/tra-cuu/?group=tactics");
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
