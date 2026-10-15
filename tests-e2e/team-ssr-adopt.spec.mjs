import { test, expect } from "@playwright/test";

// Trang danh sách đội dựng sẵn: khi trạng thái đầu của trình duyệt khớp mặc định thì nhận lại đúng các node đó
// (không nháy, không nhân đôi); lệch mặc định (URL khác, kiểu hiển thị khác) thì thay như cũ.

/** Giữ app.js lại tới khi đã ghi nhớ node dựng sẵn, rồi thả cho trang khởi động. */
async function bootWithProbe(page, url, selector, beforeRelease = null) {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route("**/js/app.js", async (route) => { await gate; await route.continue(); });
  // Module script bị giữ nên DOMContentLoaded chưa tới: chờ HTML đã parse qua phần thân (chân trang nằm sau main).
  await page.goto(url, { waitUntil: "commit" });
  await page.locator(".site-footer").waitFor({ state: "attached" });
  const prerendered = await page.evaluate((query) => {
    window.__ssrNodes = [...document.querySelectorAll(query)];
    return window.__ssrNodes.length;
  }, selector);
  expect(prerendered, `${url}: HTML dựng sẵn phải có ${selector} trước khi app.js chạy`).toBeGreaterThan(0);
  await beforeRelease?.();
  release();
  await expect(page.locator("body")).toHaveAttribute("data-boot", "ready");
  return prerendered;
}

const survivors = (page) => page.evaluate(() => window.__ssrNodes.filter((node) => node.isConnected).length);

for (const [locale, prefix] of [["vi", ""], ["zh", "/zh"]]) {
  test(`${locale}: Đội chuẩn/Đội khác/Khai hoang/Cùng Tồn ở trạng thái mặc định giữ nguyên node dựng sẵn và chỉ một h1`, async ({ page }) => {
    for (const [path, selector] of [
      ["/doi-chuan/", ".reference-team-card"],
      ["/doi-khac/", ".reference-team-card"],
      ["/cung-ton/", ".coexist-team-card"],
      ["/khai-hoang/", ".kh-card"],
    ]) {
      const prerendered = await bootWithProbe(page, `${prefix}${path}`, selector);
      expect(await survivors(page), `${path}: node dựng sẵn bị thay`).toBe(prerendered);
      await expect(page.locator(selector), `${path}: nhân đôi thẻ`).toHaveCount(prerendered);
      await expect(page.locator("h1"), path).toHaveCount(1);
      await page.unroute("**/js/app.js");
    }
  });
}

test("Đội chuẩn: tìm chiến pháp từ chip của thẻ dựng sẵn vẫn hoạt động (sự kiện được gắn)", async ({ page }) => {
  await bootWithProbe(page, "/doi-chuan/", ".reference-team-card");
  const chip = page.locator(".reference-team-card button[data-tactic-search]").first();
  const value = await chip.getAttribute("data-tactic-search");
  await chip.click();
  await expect(page).toHaveURL(new RegExp(`[?&]q=${encodeURIComponent(value).replace(/%20/g, "(?:\\+|%20)")}`));
});

test("Đội chuẩn: URL lệch mặc định (kiểu hiển thị khác) thay danh sách như cũ, không để lại thẻ dựng sẵn", async ({ page }) => {
  const prerendered = await bootWithProbe(page, "/doi-chuan/?view=bang", ".reference-team-card");
  expect(prerendered).toBeGreaterThan(0);
  expect(await survivors(page)).toBe(0);
  await expect(page.locator(".reference-team-card")).toHaveCount(0);
  await expect(page.locator(".reference-table tbody tr").first()).toBeVisible();
  await expect(page.locator("h1")).toHaveCount(1);
});

test("Đội chuẩn: nhận lại danh sách dựng sẵn thì link chi tiết mang nguồn quay lại của trang", async ({ page }) => {
  await bootWithProbe(page, "/doi-chuan/", ".reference-team-card");
  const href = await page.locator(".reference-team-card a[data-team-detail-link]").first().getAttribute("href");
  expect(new URL(href, "http://x").searchParams.get("from")).toBe("/doi-chuan/");
});

// Nút dựng sẵn chưa có sự kiện: khoá đến khi trình duyệt gắn xong (bấm lúc đó không được "im lặng").
const CONTROLS = [
  ["/doi-chuan/", ".reference-team-card", ".reference-team-card button[data-tactic-search]"],
  ["/doi-khac/", ".reference-team-card", ".reference-team-card button[data-tactic-search]"],
  ["/khai-hoang/", ".kh-card", ".kh-config-chip, .kh-unit-chip"],
];
for (const [path, selector, controls] of CONTROLS) {
  test(`${path}: nút dựng sẵn bị khoá trước khi app.js gắn sự kiện và mở lại sau đó`, async ({ page }) => {
    await bootWithProbe(page, path, selector, async () => {
      const state = await page.evaluate((query) => [...document.querySelectorAll(query)].map((node) => [node.disabled, node.getAttribute("aria-disabled")]), controls);
      expect(state.length, `${path}: phải có nút dựng sẵn`).toBeGreaterThan(0);
      for (const [disabled, ariaDisabled] of state) {
        expect(disabled).toBe(true);
        expect(ariaDisabled).toBe("true");
      }
    });
    const after = await page.evaluate((query) => [...document.querySelectorAll(query)].filter((node) => node.disabled || node.hasAttribute("aria-disabled")).length, controls);
    expect(after, `${path}: nút còn bị khoá sau khi boot`).toBe(0);
  });
}

test("Khai hoang: nhận lại danh sách dựng sẵn không tháo/gắn lại nó (focus của người đã tab vào thẻ được giữ)", async ({ page }) => {
  await bootWithProbe(page, "/khai-hoang/", ".kh-card", async () => {
    await page.evaluate(() => {
      const link = document.querySelector(".kh-card a.kh-title-link");
      link.focus();
      window.__focused = link;
      window.__khRoot = document.querySelector(".khaihoang");
    });
  });
  expect(await page.evaluate(() => window.__khRoot.isConnected && document.activeElement === window.__focused)).toBe(true);
});

test("Đội chuẩn: lỗi dữ liệu hiện ở đầu mục, trước các thẻ dựng sẵn", async ({ page }) => {
  await page.route("**/data/recommended/**", (route) => route.abort());
  await page.goto("/doi-chuan/");
  await expect(page.locator("body")).toHaveAttribute("data-boot", "ready");
  const errorFirst = await page.evaluate(() => {
    const error = document.querySelector("main .error");
    const card = document.querySelector("main .reference-team-card");
    return Boolean(error) && (!card || Boolean(error.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING));
  });
  expect(errorFirst).toBe(true);
});
