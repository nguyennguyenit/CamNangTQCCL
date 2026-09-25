// E2E giao diện Tra cứu hợp nhất: deep link sáu nhóm, alias không rewrite,
// phân trang quá 60, hộp thoại hồ sơ có focus trap, live region tiếng Việt,
// đồng thời giữ nguyên Team chuẩn mặc định, alias Team khác và history.
import { test, expect } from '@playwright/test';

const CJK = /[\u3400-\u9fff]/;
const GROUPS = ['heroes', 'tactics', 'equipment', 'advisors', 'troop-mods', 'buildings'];

const lookup = (page) => page.locator('#section-lookup');
const chip = (page, group) => lookup(page).locator(`.lookup-chip[data-group="${group}"]`);
const cards = (page) => lookup(page).locator('.lookup-card');

test('Tra cứu mở đúng trang mục và không tách lại hai bảng tra cứu cũ', async ({ page }) => {
  await page.goto('/tra-cuu/');
  await expect(page.getByRole('link', { name: 'Tra cứu', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(lookup(page)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Tra cứu tướng' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Tra cứu chiến pháp' })).toHaveCount(0);
  await expect(page.locator('body')).toHaveAttribute('data-page-section', 'lookup');
  await expect(page.locator('.section')).toHaveCount(1);
});

test('nav link Tra cứu hỗ trợ điều hướng bằng bàn phím', async ({ page }) => {
  await page.goto('/doi-chuan/');
  const lookupLink = page.getByRole('link', { name: 'Tra cứu', exact: true });
  await lookupLink.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/tra-cuu/');
  await expect(page.getByRole('link', { name: 'Tra cứu', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('sáu chip nhóm là nút có aria-pressed và deep link chọn đúng nhóm', async ({ page }) => {
  for (const group of GROUPS) {
    await page.goto(`/tra-cuu/?group=${group}`);
    await expect(lookup(page).getByRole('button', { pressed: true })).toHaveCount(1);
    await expect(chip(page, group)).toHaveAttribute('aria-pressed', 'true');
    await expect(cards(page).first()).toBeVisible();
  }
  await expect(lookup(page).locator('.lookup-chip')).toHaveCount(GROUPS.length);
});

test('legacy aliases select lookup groups and query history restores each group', async ({ page }) => {
  await page.goto('/tra-cuu/?group=heroes');
  await expect(chip(page, 'heroes')).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/tra-cuu/?group=tactics');
  await expect(chip(page, 'tactics')).toHaveAttribute('aria-pressed', 'true');

  await page.goBack();
  await expect(page).toHaveURL('/tra-cuu/?group=heroes');
  await expect(chip(page, 'heroes')).toHaveAttribute('aria-pressed', 'true');
  await page.goForward();
  await expect(page).toHaveURL('/tra-cuu/?group=tactics');
});


test('quay lại Tra cứu bằng liên kết cập nhật route và bộ lọc', async ({ page }) => {
  await page.goto('/tra-cuu/?group=tactics');
  await expect(chip(page, 'tactics')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('link', { name: 'Đội chuẩn', exact: true }).click();
  await expect(page).toHaveURL('/doi-chuan/');
  await page.getByRole('link', { name: 'Tra cứu', exact: true }).click();
  await expect(page).toHaveURL('/tra-cuu/');
  await expect(lookup(page).locator('.lookup-chip[aria-pressed="true"]')).toHaveCount(0);
  await expect(lookup(page).locator('[data-lookup-total]')).toContainText(/^\d+ kết quả$/);
});
test('route tra cứu sai bị từ chối bằng lỗi tiếng Việt', async ({ page }) => {
  for (const [route, message] of [
    ['/tra-cuu/?group=heroes&group=tactics', 'Mỗi tham số tra cứu chỉ được xuất hiện một lần.'],
    ['/tra-cuu/?group=heroes&id=hero%3Aone&id=hero%3Atwo', 'Mỗi tham số tra cứu chỉ được xuất hiện một lần.'],
    ['/tra-cuu/?group=books', 'Nhóm tra cứu không hợp lệ.'],
    ['/tra-cuu/?group=heroes&id=tactic%3Anhan-duc', 'Mục tra cứu không thuộc nhóm đã chọn.'],
    ['/tra-cuu/?id=https%3A%2F%2Fevil.example%2Fx.json', 'Mã mục tra cứu không hợp lệ.'],
  ]) {
    await page.goto(route);
    await expect(lookup(page)).toBeVisible();
    await expect(lookup(page).locator('[role="alert"]')).toHaveText(message);
    await expect(lookup(page).getByRole('dialog')).toHaveCount(0);
  }
});
test('tra cứu bỏ qua query key không được hỗ trợ', async ({ page }) => {
  await page.goto('/tra-cuu/?foo=1');
  await expect(cards(page).first()).toBeVisible();
  await expect(lookup(page).locator('[role="alert"]')).toHaveCount(0);
  await expect(lookup(page).getByRole('dialog')).toHaveCount(0);
});
test('route updates preserve query keys outside lookup state', async ({ page }) => {
  await page.goto('/tra-cuu/?group=heroes&source=campaign&view=compact');
  await chip(page, 'tactics').click();
  let query = new URL(page.url()).searchParams;
  expect(query.get('group')).toBe('tactics');
  expect(query.get('source')).toBe('campaign');
  expect(query.get('view')).toBe('compact');

  await cards(page).first().getByRole('button').first().click();
  query = new URL(page.url()).searchParams;
  expect(query.get('group')).toBe('tactics');
  expect(query.get('id')).toMatch(/^tactic:/);
  expect(query.get('source')).toBe('campaign');
  expect(query.get('view')).toBe('compact');
});
test('lookup dependency failure stays in its own section', async ({ page }) => {
  await page.route('**/data/lookup-manifest.json', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"schemaVersion":2}\n' }));
  await page.goto('/tra-cuu/');
  const error = lookup(page).locator('.error');
  await expect(error).toHaveText('Không thể tải dữ liệu. Hãy tải lại trang hoặc liên hệ quản trị viên nếu lỗi tiếp diễn.');
});
test('landing giữ hash lạ và alias Team khác chuyển sang trang riêng', async ({ page }) => {
  await page.goto('/#khong-ton-tai');
  await expect(page).toHaveURL('/#khong-ton-tai');
  expect(await page.locator('body').getAttribute('data-page-section')).toBeNull();
  await expect(page.locator('script[src="/js/app.js"]')).toHaveCount(0);

  await page.goto('/#team-pk');
  await expect(page).toHaveURL('/doi-khac/?source=team-intro');
  await page.goto('/#meta-cu');
  await expect(page).toHaveURL('/doi-khac/?source=moi-phe');
});
test('chuyển sang Tra cứu rồi Back giữ nguyên truy vấn của Team khác', async ({ page }) => {
  await page.goto('/doi-khac/?q=cuong');
  await expect(page.getByRole('searchbox', { name: 'Tìm Đội khác', exact: true })).toHaveValue('cuong');
  await page.getByRole('link', { name: 'Tra cứu', exact: true }).click();
  await expect(page).toHaveURL('/tra-cuu/');
  await expect(lookup(page)).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL('/doi-khac/?q=cuong');
  await expect(page.getByRole('searchbox', { name: 'Tìm Đội khác', exact: true })).toHaveValue('cuong');
});

test('quá 60 kết quả vẫn tới được bản ghi cuối bằng Xem thêm', async ({ page }) => {
  await page.goto('/tra-cuu/?group=heroes');
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
  await page.goto('/tra-cuu/?group=heroes');
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
  await page.goto('/tra-cuu/?group=tactics');
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
  await page.goto('/tra-cuu/?group=equipment');
  await cards(page).first().getByRole('button').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.locator('.lookup-backdrop').click({ position: { x: 5, y: 5 } });
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('hồ sơ tướng đi tới chiến pháp liên quan và cập nhật query theo ID', async ({ page }) => {
  await page.goto('/tra-cuu/?group=heroes');
  await lookup(page).getByRole('searchbox').fill('luu bi');
  await cards(page).first().getByRole('button').first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/tra-cuu\/\?group=heroes&id=hero%3A/);

  await dialog.locator('[data-lookup-relation]').first().click();
  await expect(page).toHaveURL(/\/tra-cuu\/\?group=tactics&id=tactic%3A/);
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.getByRole('dialog').textContent()).not.toMatch(CJK);
});

test('deep link tới một ID mở thẳng hồ sơ', async ({ page }) => {
  await page.goto('/tra-cuu/?group=heroes');
  await lookup(page).getByRole('searchbox').fill('luu bi');
  await cards(page).first().getByRole('button').first().click();
  const deepLink = new URL(page.url()).search;
  await page.goto(`/tra-cuu/${deepLink}`);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page).toHaveURL(`/tra-cuu/${deepLink}`);
});

test('hồ sơ công trình hiện cấp, chi phí, thời gian và hiệu ứng', async ({ page }) => {
  await page.goto('/tra-cuu/?group=buildings');
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
      await page.goto('/tra-cuu/');
      if (width <= 820) await page.locator('#section-menu-toggle').click();
      await expect(page.getByRole('link', { name: 'Tra cứu', exact: true })).toHaveAttribute('aria-current', 'page');
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
