// Điều hướng và chờ trang khởi động: js/app.js đặt `body[data-boot="ready"]` ở `finally` của `main()`, kể cả khi boot lỗi.
// Hai trang danh sách đội (/doi-chuan/, /doi-khac/) phát sẵn khung lọc từ build với mọi điều khiển còn khoá (`disabled`) cho tới khi
// app.js gắn sự kiện; `page.goto` chỉ chờ `load` nên spec nào bấm chip, đổi mùa, đổi kiểu hiển thị hay gõ ô tìm ngay sau đó phải
// qua `gotoBooted`, không thì bấm vào nút còn khoá. Spec nào cần nhìn trang TRƯỚC boot (bản dựng sẵn thuần) dùng `holdBoot` /
// `bootWithProbe`, giữ app.js lại tới khi đã đo xong.
import { expect } from '@playwright/test';

/** `page.goto` + chờ `body[data-boot="ready"]`; trả về response của lần điều hướng, như `page.goto`. */
export async function gotoBooted(page, url, options) {
  const response = await page.goto(url, options);
  await expect(page.locator('body')).toHaveAttribute('data-boot', 'ready');
  return response;
}

/**
 * Mở `url` nhưng giữ `js/app.js` lại: trang đứng ở bản dựng sẵn thuần (HTML đã parse tới chân trang, app.js chưa chạy).
 * Trả hàm `release()` để thả app.js; người gọi tự chờ `body[data-boot="ready"]` (như `gotoBooted`) sau khi thả.
 */
export async function holdBoot(page, url) {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route('**/js/app.js', async (route) => { await gate; await route.continue(); });
  // Module script bị giữ nên DOMContentLoaded chưa tới: chờ HTML đã parse qua phần thân (chân trang nằm sau main).
  await page.goto(url, { waitUntil: 'commit' });
  await page.locator('.site-footer').waitFor({ state: 'attached' });
  return release;
}

/** Giữ app.js lại tới khi đã ghi nhớ node dựng sẵn (`window.__ssrNodes`), rồi thả cho trang khởi động. Trả số node đã nhớ. */
export async function bootWithProbe(page, url, selector, beforeRelease = null) {
  const release = await holdBoot(page, url);
  const prerendered = await page.evaluate((query) => {
    window.__ssrNodes = [...document.querySelectorAll(query)];
    return window.__ssrNodes.length;
  }, selector);
  expect(prerendered, `${url}: HTML dựng sẵn phải có ${selector} trước khi app.js chạy`).toBeGreaterThan(0);
  await beforeRelease?.();
  release();
  await expect(page.locator('body')).toHaveAttribute('data-boot', 'ready');
  return prerendered;
}
