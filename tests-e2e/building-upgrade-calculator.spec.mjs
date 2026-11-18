// E2E máy tính nâng cấp công trình trên trang nhóm Công trình: khung ẩn khi chưa có JavaScript, các dòng đọc/ghi trên
// query `?nang=` (giữ `?id=`), sửa cấp cập nhật tổng tại chỗ, cấp thiếu dữ liệu được nêu rõ, bản zh, mobile 390px không
// tràn ngang và khối ẩn khi mở màn chi tiết mobile.
import { test, expect } from '@playwright/test';

const calc = (page) => page.locator('[data-building-calc]');

async function open(page, url) {
  await page.goto(url);
  await expect(page.locator('body[data-boot="ready"]')).toBeAttached();
}

test('khung máy tính có trong HTML nhưng ẩn khi chưa có JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/tra-cuu/cong-trinh/');
  await expect(page.locator('[data-building-calc]')).toHaveAttribute('hidden', '');
  await expect(page.locator('[data-building-calc]')).toBeHidden();
  await context.close();
});

test('các dòng trên query: tổng, thiếu dữ liệu, sửa cấp, thêm/bỏ dòng và giữ ?id=', async ({ page }) => {
  await open(page, '/tra-cuu/cong-trinh/?nang=quan-dinh.5.20&nang=quan-xa.0.5');
  await expect(calc(page)).toBeVisible();
  await expect(calc(page).locator('details')).toHaveAttribute('open', '');
  const rows = calc(page).locator('.building-calc-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1).locator('.building-calc-missing')).toHaveText('Thiếu dữ liệu cấp 1, 2: tài nguyên và thời gian');
  await expect(calc(page).locator('.building-calc-result > .building-calc-missing')).toHaveText('Tổng chưa gồm 2 cấp thiếu dữ liệu.');

  // Sửa cấp đích: ô đang gõ giữ focus, dòng kết quả và query đổi theo.
  const to = rows.first().locator('input[data-field="to"]');
  await to.fill('10');
  await expect(to).toBeFocused();
  await expect(rows.first().locator('.building-calc-row-range')).toHaveText('Lv 5 → 10');
  await expect(page).toHaveURL(/\?nang=quan-dinh\.5\.10&nang=quan-xa\.0\.5$/);

  // Cấp vượt tối đa được kẹp khi rời ô.
  await to.fill('99');
  await to.blur();
  await expect(to).toHaveValue('20');

  await calc(page).getByRole('button', { name: 'Bỏ dòng Quân Xá' }).click();
  await expect(rows).toHaveCount(1);
  await expect(page).toHaveURL(/\?nang=quan-dinh\.5\.20$/);
  await calc(page).getByRole('button', { name: '+ Thêm công trình' }).click();
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1).locator('select')).toBeFocused();

  // Mở một công trình ở panel chi tiết giữ các dòng; Back trở lại đúng danh sách dòng.
  await page.locator('.lookup-master-list [data-lookup-id]').nth(2).click();
  await expect(page).toHaveURL(/nang=quan-dinh\.5\.20&nang=[a-z-]+\.0\.\d+&id=building/);
  await page.goBack();
  await expect(rows).toHaveCount(2);
});

test('bản zh và mobile 390px: chữ Trung, không tràn ngang, ẩn khi mở màn chi tiết', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, '/zh/tra-cuu/cong-trinh/?nang=quan-xa.0.5');
  await expect(calc(page).locator('.building-calc-title')).toHaveText('升级资源计算');
  await expect(calc(page).locator('.building-calc-row .building-calc-missing')).toHaveText('缺少第 1、2 级数据：资源和耗时');
  await expect(calc(page).locator('.building-calc-totals')).toContainText('耗时');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  // Ô chọn và ô cấp đạt vùng bấm 44px trên mobile.
  for (const selector of ['select', 'input[data-field="from"]', 'input[data-field="to"]', '.building-calc-remove']) {
    const box = await calc(page).locator(selector).first().boundingBox();
    expect(box.height, selector).toBeGreaterThanOrEqual(44);
  }
  await page.locator('.lookup-master-list [data-lookup-id]').first().click();
  await expect(calc(page)).toBeHidden();
});
