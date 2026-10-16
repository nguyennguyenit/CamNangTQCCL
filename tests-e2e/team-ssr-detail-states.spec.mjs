import { test, expect } from "@playwright/test";

// Trang chi tiết dựng sẵn: huy hiệu của cấu hình mặc định không được hiện khi URL xin cấu hình khác (đang tải hoặc lỗi),
// và chọn lại chip "Mặc định" khi chưa tải gì không được tải/xoá thân dựng sẵn.

async function firstDetailHref(page, listPath, linkSelector) {
  await page.goto(listPath);
  const href = await page.locator(linkSelector).first().getAttribute("href");
  expect(href).toBeTruthy();
  return href.split("?")[0];
}

/** Giữ script của trang chi tiết lại: kiểm trạng thái chỉ-HTML (trước khi client chạy), rồi thả. */
async function openGated(page, url, script) {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route(`**/js/${script}`, async (route) => { await gate; await route.continue(); });
  await page.goto(url, { waitUntil: "commit" });
  await page.locator(".site-footer").waitFor({ state: "attached" });
  return release;
}

const badgesState = (page) => page.evaluate(() => {
  const node = document.querySelector("#team-detail-badges");
  return { hidden: node.hidden, children: node.childElementCount };
});

for (const [name, listPath, linkSelector, script, variant] of [
  ["Khai hoang", "/khai-hoang/", "main a.kh-title-link", "khaihoang-detail.js", "khong-ton-tai"],
  ["Đội khác", "/doi-khac/", "main a[data-team-detail-link]", "team-detail.js", "khong-ton-tai"],
]) {
  test(`${name}: ?variant= ẩn huy hiệu dựng sẵn khi đang tải và xoá khi báo lỗi`, async ({ page }) => {
    const path = await firstDetailHref(page, listPath, linkSelector);
    await page.goto(path);
    await expect(page.locator("#team-detail-root")).toHaveAttribute("aria-busy", "false");
    expect((await badgesState(page)).hidden, "mặc định có huy hiệu").toBe(false);

    await page.unroute("**/*");
    const release = await openGated(page, `${path}?variant=${variant}`, script);
    expect(await badgesState(page), "đang tải").toMatchObject({ hidden: true });
    release();
    await expect(page.locator("#team-detail-status .error")).toBeVisible();
    expect(await badgesState(page), "sau lỗi").toEqual({ hidden: true, children: 0 });
  });
}

test("Khai hoang: bấm chip Mặc định khi chưa tải gì không tải dữ liệu và không xoá thân dựng sẵn", async ({ page }) => {
  const path = await firstDetailHref(page, "/khai-hoang/", "main a.kh-title-link");
  const requested = [];
  await page.route("**/data/khaihoang.json*", (route) => { requested.push(route.request().url()); return route.abort(); });
  await page.goto(path);
  const chip = page.locator('.kh-config-chip[data-variant=""]');
  await expect(chip).toBeEnabled();
  await chip.click();
  await expect(page.locator("#team-detail-body")).toBeVisible();
  await expect(page.locator("#team-detail-body h2").first()).toBeVisible();
  await expect(page.locator("#team-detail-status .error")).toHaveCount(0);
  expect(requested).toEqual([]);
});

test("Khai hoang: chip cấu hình của trang chi tiết bị khoá trước khi client gắn sự kiện", async ({ page }) => {
  const path = await firstDetailHref(page, "/khai-hoang/", "main a.kh-title-link");
  const release = await openGated(page, path, "khaihoang-detail.js");
  const state = await page.evaluate(() => [...document.querySelectorAll(".kh-config-chip")].map((chip) => chip.disabled));
  expect(state.length).toBeGreaterThan(0);
  expect(state.every(Boolean)).toBe(true);
  release();
  await expect(page.locator(".kh-config-chip:disabled")).toHaveCount(0);
});

test("Khai hoang: bấm cấu hình khác rồi bấm lại Mặc định khi dữ liệu còn đang tải thì nội dung theo lần bấm sau cùng", async ({ page }) => {
  const path = await firstDetailHref(page, "/khai-hoang/", "main a.kh-title-link");
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route("**/data/khaihoang.json*", async (route) => { await gate; await route.continue(); });
  await page.goto(path);
  const other = page.locator('.kh-config-chip:not([data-variant=""])').first();
  const fallback = page.locator('.kh-config-chip[data-variant=""]');
  await expect(other).toBeEnabled();
  await other.click();
  await fallback.click();
  const loaded = page.waitForResponse("**/data/khaihoang.json*");
  release();
  // Lượt tải dở dang (do lần bấm đầu) kết thúc sau lần bấm cuối: chờ nguồn về rồi để client băm, đối chiếu và dựng xong.
  await loaded;
  await page.waitForTimeout(500);
  await expect(fallback).toHaveAttribute("aria-pressed", "true");
  await expect(other).toHaveAttribute("aria-pressed", "false");
  expect(new URL(page.url()).searchParams.has("variant")).toBe(false);
});

test("Khai hoang: bấm cấu hình khác mà tải lỗi thì giữ thân dựng sẵn, báo lỗi và URL về mặc định", async ({ page }) => {
  const path = await firstDetailHref(page, "/khai-hoang/", "main a.kh-title-link");
  await page.route("**/data/khaihoang.json*", (route) => route.abort());
  await page.goto(path);
  const other = page.locator('.kh-config-chip:not([data-variant=""])').first();
  await expect(other).toBeEnabled();
  await other.click();
  await expect(page.locator("#team-detail-status .error")).toBeVisible();
  await expect(page.locator("#team-detail-body h2").first()).toBeVisible();
  await expect(page.locator('.kh-config-chip[data-variant=""]')).toHaveAttribute("aria-pressed", "true");
  expect(new URL(page.url()).searchParams.has("variant")).toBe(false);
});
