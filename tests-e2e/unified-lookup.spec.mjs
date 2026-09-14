// E2E giao diện Tra cứu hợp nhất: deep link sáu nhóm, alias không rewrite,
// phân trang quá 60, hộp thoại hồ sơ có focus trap, live region tiếng Việt,
// đồng thời giữ nguyên Team chuẩn mặc định, alias Team khác và history.
import { test, expect } from '@playwright/test';

const CJK = /[\u3400-\u9fff]/;
const GROUPS = ['heroes', 'tactics', 'equipment', 'advisors', 'troop-mods', 'buildings'];

const lookup = (page) => page.locator('#section-lookup');
const chip = (page, group) => lookup(page).locator(`.lookup-chip[data-group="${group}"]`);
const cards = (page) => lookup(page).locator('.lookup-card');

test('một tab Tra cứu thay hai tab cũ và mở đúng section', async ({ page }) => {
  await page.goto('/#lookup');
  await expect(page.getByRole('tab', { name: 'Tra cứu', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(lookup(page)).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Tra cứu tướng' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Tra cứu chiến pháp' })).toHaveCount(0);
  await expect(page.locator('#section-heroes, #section-tactics')).toHaveCount(0);
  await expect(lookup(page)).toHaveAttribute('role', 'tabpanel');
});

test('nav là tablist điều khiển được bằng phím mũi tên', async ({ page }) => {
  await page.goto('/#lookup');
  const tablist = page.getByRole('tablist').first();
  await expect(tablist).toBeVisible();
  const lookupTab = page.getByRole('tab', { name: 'Tra cứu', exact: true });
  await lookupTab.focus();
  await page.keyboard.press('ArrowRight');
  await expect(lookupTab).toHaveAttribute('aria-selected', 'false');
  await page.keyboard.press('ArrowLeft');
  await expect(lookupTab).toHaveAttribute('aria-selected', 'true');
});

test('sáu chip nhóm là nút có aria-pressed và deep link chọn đúng nhóm', async ({ page }) => {
  for (const group of GROUPS) {
    await page.goto(`/#lookup?group=${group}`);
    await expect(lookup(page).getByRole('button', { pressed: true })).toHaveCount(1);
    await expect(chip(page, group)).toHaveAttribute('aria-pressed', 'true');
    await expect(cards(page).first()).toBeVisible();
  }
  await expect(lookup(page).locator('.lookup-chip')).toHaveCount(GROUPS.length);
});

test('alias #heroes và #tactics preselect nhóm mà không rewrite hash', async ({ page }) => {
  await page.goto('/#heroes');
  await expect(page).toHaveURL(/#heroes$/);
  await expect(chip(page, 'heroes')).toHaveAttribute('aria-pressed', 'true');

  await page.goto('/#tactics');
  await expect(page).toHaveURL(/#tactics$/);
  await expect(chip(page, 'tactics')).toHaveAttribute('aria-pressed', 'true');

  await page.goBack();
  await expect(page).toHaveURL(/#heroes$/);
  await expect(chip(page, 'heroes')).toHaveAttribute('aria-pressed', 'true');
  await page.goForward();
  await expect(page).toHaveURL(/#tactics$/);
});


test('quay lại Tra cứu bằng tab đồng bộ bộ lọc với hash mới', async ({ page }) => {
  await page.goto('/#lookup?group=tactics');
  await expect(lookup(page).getByRole('button', { name: 'Chiến pháp' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('tab', { name: 'Đội chuẩn', exact: true }).click();
  await page.getByRole('tab', { name: 'Tra cứu', exact: true }).click();
  await expect(page).toHaveURL(/#lookup$/);
  await expect(lookup(page).locator('.lookup-chip[aria-pressed="true"]')).toHaveCount(0);
  await expect(lookup(page).locator('[data-lookup-total]')).toContainText(/^\d+ kết quả$/);
});
test('route sai bị từ chối bằng lỗi tiếng Việt trong section lookup', async ({ page }) => {
  for (const hash of [
    '#lookup?group=heroes&group=tactics',
    '#lookup?group=books',
    '#lookup?foo=1',
    '#lookup?group=heroes&id=tactic%3Anhan-duc',
    '#lookup?id=https%3A%2F%2Fevil.example%2Fx.json',
  ]) {
    await page.goto(`/${hash}`);
    await expect(lookup(page)).toBeVisible();
    const status = lookup(page).locator('[role="alert"], [role="status"]').first();
    await expect(status).toBeVisible();
    expect(await status.textContent()).not.toMatch(CJK);
    expect((await status.textContent()).trim().length).toBeGreaterThan(0);
    await expect(lookup(page).getByRole('dialog')).toHaveCount(0);
  }
});

test('thay đổi dependency đã pin khiến toàn bộ publication dừng fail-closed', async ({ page }) => {
  await page.route('**/data/lookup-manifest.json', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"schemaVersion":2}\n' }));
  await page.goto('/#lookup');
  const error = page.locator('#section-team-chuan .error');
  await expect(error).toHaveText('Không thể tải dữ liệu. Hãy tải lại trang hoặc liên hệ quản trị viên nếu lỗi tiếp diễn.');
  await expect(error).toBeHidden();
  await expect(lookup(page)).toBeEmpty();
  await page.getByRole('tab', { name: 'Đội chuẩn', exact: true }).click();
  await expect(error).toBeVisible();
  await expect(page.locator('#section-team-chuan .team-card')).toHaveCount(0);
});

test('Team chuẩn vẫn là mặc định và alias Team khác giữ nguyên', async ({ page }) => {
  await page.goto('/#khong-ton-tai');
  await expect(page.locator('#section-team-chuan')).toHaveClass(/active/);

  await page.goto('/#team-pk');
  await expect(page).toHaveURL(/source=team-intro.*#team-khac|#team-khac.*source=team-intro/);
  await page.goto('/#meta-cu');
  await expect(page).toHaveURL(/source=moi-phe.*#team-khac|#team-khac.*source=moi-phe/);
});

test('chuyển sang Tra cứu rồi Back giữ nguyên truy vấn và mùa nguồn của Team khác', async ({ page }) => {
  await page.goto('/?q=cuong#team-khac');
  await expect(page.getByRole('searchbox', { name: 'Tìm Đội khác', exact: true })).toHaveValue('cuong');
  await page.getByRole('tab', { name: 'Tra cứu', exact: true }).click();
  await expect(lookup(page)).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/q=cuong/);
  await expect(page.locator('#section-team-khac')).toHaveClass(/active/);
  await expect(page.getByRole('searchbox', { name: 'Tìm Đội khác', exact: true })).toHaveValue('cuong');
});

test('quá 60 kết quả vẫn tới được bản ghi cuối bằng Xem thêm', async ({ page }) => {
  await page.goto('/#lookup?group=heroes');
  const total = Number(await lookup(page).locator('[data-lookup-total]').getAttribute('data-lookup-total'));
  expect(total).toBeGreaterThan(60);
  await expect(cards(page)).toHaveCount(60);

  const more = lookup(page).getByRole('button', { name: 'Xem thêm' });
  while (await more.count()) {
    const before = await cards(page).count();
    await more.click();
    await expect.poll(() => cards(page).count()).toBeGreaterThan(before);
  }
  await expect(cards(page)).toHaveCount(total);
  await expect(cards(page).last()).toBeVisible();
});

test('tìm kiếm chạy trên toàn corpus, bỏ dấu và alias chữ Hán', async ({ page }) => {
  await page.goto('/#lookup?group=heroes');
  const search = lookup(page).getByRole('searchbox');
  await search.fill('luu bi');
  await expect(cards(page).first()).toContainText('Lưu Bị');
  await search.fill('劉備');
  await expect(cards(page).first()).toContainText('Lưu Bị');
  expect(await cards(page).first().textContent()).not.toMatch(CJK);

  await search.fill('zzzqqq');
  const empty = lookup(page).locator('[role="status"]').first();
  await expect(empty).toBeVisible();
  await expect(empty).toContainText(/Không có kết quả/i);
});

test('hộp thoại hồ sơ bẫy focus, đóng bằng Escape và trả focus về thẻ mở', async ({ page }) => {
  await page.goto('/#lookup?group=tactics');
  const opener = cards(page).first().getByRole('button').first();
  await opener.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  for (let i = 0; i < 12; i += 1) await page.keyboard.press('Tab');
  expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  expect(await dialog.textContent()).not.toMatch(CJK);

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('bấm nền cũng đóng hộp thoại', async ({ page }) => {
  await page.goto('/#lookup?group=equipment');
  await cards(page).first().getByRole('button').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.locator('.lookup-backdrop').click({ position: { x: 5, y: 5 } });
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('hồ sơ tướng đi tới chiến pháp liên quan và cập nhật hash theo ID', async ({ page }) => {
  await page.goto('/#lookup?group=heroes');
  await lookup(page).getByRole('searchbox').fill('luu bi');
  await cards(page).first().getByRole('button').first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/#lookup\?group=heroes&id=hero%3A/);

  await dialog.locator('[data-lookup-relation]').first().click();
  await expect(page).toHaveURL(/#lookup\?group=tactics&id=tactic%3A/);
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.getByRole('dialog').textContent()).not.toMatch(CJK);
});

test('deep link tới một ID mở thẳng hồ sơ', async ({ page }) => {
  await page.goto('/#lookup?group=heroes');
  await lookup(page).getByRole('searchbox').fill('luu bi');
  await cards(page).first().getByRole('button').first().click();
  const deepLink = new URL(page.url()).hash;
  await page.goto(`/${deepLink}`);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(deepLink.replace(/[?]/g, '\\?')));
});

test('hồ sơ công trình hiện cấp, chi phí, thời gian và hiệu ứng', async ({ page }) => {
  await page.goto('/#lookup?group=buildings');
  await cards(page).first().getByRole('button').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Cấp 1');
  await expect(dialog).toContainText(/Gỗ|Sắt|Đá|Lương/);
  await expect(dialog).toContainText(/giờ|phút/);
});

for (const width of [320, 375, 768, 1280]) {
  for (const theme of ['light', 'dark']) {
    test(`Tra cứu dùng được ở ${width}px trong nền ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
      await page.goto('/#lookup');
      if (width <= 820) await page.locator('#section-menu-toggle').click();
      await expect(page.getByRole('tab', { name: 'Tra cứu', exact: true })).toBeVisible();
      if (width <= 820) await page.locator('#section-menu-toggle').click();
      for (const group of GROUPS) {
        await chip(page, group).click();
        await expect(chip(page, group)).toHaveAttribute('aria-pressed', 'true');
        await expect(cards(page).first()).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
        await cards(page).first().getByRole('button').first().click();
        await expect(page.getByRole('dialog')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);
      }
    });
  }
}
