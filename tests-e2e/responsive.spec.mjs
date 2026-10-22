import { test, expect } from '@playwright/test';

/** Hộp chữ thật của phần tử (không tính khoảng trống của box). */
const inkRight = (locator) => locator.evaluate((node) => {
  const range = document.createRange();
  range.selectNodeContents(node);
  return range.getBoundingClientRect().right;
});

test('footer 821–1440px: khối thương hiệu không đè cột link đầu', async ({ page }) => {
  for (const width of [821, 900, 1024, 1279, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/doi-khac/');
    const brand = page.locator('.footer-brand');
    const firstCol = page.locator('.footer-col').first();
    const brandBox = await brand.boundingBox();
    const colBox = await firstCol.boundingBox();
    const sameRow = colBox.y < brandBox.y + brandBox.height;
    if (sameRow) expect(await inkRight(brand), `${width}: thương hiệu tràn sang cột Đội hình`).toBeLessThanOrEqual(colBox.x);
    expect(await brand.evaluate((node) => node.scrollWidth - node.clientWidth), `${width}: thương hiệu tràn khung`).toBeLessThanOrEqual(1);
  }
});

test('bảng chiến pháp 681–1023px xếp dọc, không cột nào bị cắt khỏi khung', async ({ page }) => {
  for (const width of [768, 900, 1023]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/tra-cuu/chien-phap/');
    const panel = page.locator('#section-lookup .lookup-table-panel');
    await expect(panel.locator('tbody tr').first()).toBeVisible();
    await expect(panel.locator('thead')).toBeHidden();
    expect(await panel.evaluate((node) => node.scrollWidth - node.clientWidth), `${width}: bảng rộng hơn khung`).toBe(0);
    const nameWidth = await panel.locator('tbody th.lookup-table-cell-name').first().evaluate((node) => node.clientWidth);
    expect(nameWidth, `${width}: ô tên chiến pháp`).toBeGreaterThan(width / 2);
  }
});

test('cột chuyển nhanh không đè control danh sách đội ở 821–900px', async ({ page }) => {
  for (const width of [821, 860, 900]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/doi-chuan/');
    const rail = await page.locator('.quick-nav-list').boundingBox();
    for (const selector of ['.view-btn[data-view="bang"]', '.reference-search-input']) {
      const box = await page.locator(`#section-team-chuan ${selector}`).boundingBox();
      expect(box.x + box.width, `${width}: ${selector} nằm dưới cột chuyển nhanh`).toBeLessThanOrEqual(rail.x);
    }
  }
});

test('màn thấp dùng nút chuyển nhanh; danh sách mở nằm giữa header và nút', async ({ page }) => {
  for (const [width, height] of [[844, 390], [1366, 500], [1024, 619], [320, 568]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/doi-chuan/');
    const toggle = page.locator('.quick-nav-toggle');
    await expect(toggle, `${width}×${height}: nút chuyển nhanh`).toBeVisible();
    await toggle.click();
    const list = page.locator('.quick-nav-list');
    await expect(list).toBeVisible();
    const box = await list.boundingBox();
    const header = await page.locator('.top-header').boundingBox();
    expect(box.y, `${width}×${height}: danh sách chui dưới header`).toBeGreaterThanOrEqual(header.y + header.height);
    // Mục cuối vẫn tới được bằng cuộn trong danh sách.
    const last = list.locator('.quick-nav-link').last();
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
  }
  // Màn đủ cao vẫn là thanh icon cố định, nằm trọn giữa header và mép dưới.
  await page.setViewportSize({ width: 1024, height: 620 });
  await page.goto('/doi-chuan/');
  await expect(page.locator('.quick-nav-toggle')).toBeHidden();
  const rail = await page.locator('.quick-nav-list').boundingBox();
  expect(rail.y).toBeGreaterThanOrEqual(64);
  expect(rail.y + rail.height).toBeLessThanOrEqual(620);
});

test('footer mobile thu gọn link game sau tiêu đề dải; desktop và không JS luôn hiện đủ', async ({ page, browser }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/doi-khac/');
  const toggle = page.getByRole('button', { name: 'Game chính thức' });
  const firstLink = page.locator('#footer-game-links a').first();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(firstLink).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(firstLink).toBeVisible();
  // Qua mốc 820px: desktop luôn hiện link, nút biến mất.
  await page.setViewportSize({ width: 1024, height: 844 });
  await expect(toggle).toBeHidden();
  await expect(firstLink).toBeVisible();

  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const noJs = await context.newPage();
  await noJs.goto('/doi-khac/');
  await expect(noJs.locator('#footer-game-links a').first()).toBeVisible();
  await expect(noJs.locator('[data-footer-game-toggle]')).toBeHidden();
  await context.close();
});
