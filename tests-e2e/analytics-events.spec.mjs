import { expect, test } from '@playwright/test';
import { dataLayerEntries, PRODUCTION_ORIGIN, routeProductionHost, seedConsent } from './helpers/production-host.mjs';
import { gotoBooted } from './helpers/boot.mjs';

/**
 * Sự kiện GA4 tùy chỉnh (js/analytics.js `track`): feedback/donate mở hộp thoại, Tra cứu (search có debounce, chọn hồ sơ),
 * lọc ở /doi-chuan/ (mùa, kiểu hiển thị, chip). `track` chỉ gửi trên host sản xuất nên trang chạy dưới `https://tqccl.com`
 * (helper route về server preview, chặn mạng GA). Ta chỉ đọc `window.dataLayer`, nơi `gtag('event', tên, tham số)` để lại
 * một Arguments `['event', tên, tham số]`. Lựa chọn đồng ý ghi sẵn là `denied` để thanh đồng ý không che nút ở footer.
 */
const ALLOWED_PARAM_KEYS = new Set([
  'step', 'season', 'team_count', 'search_term', 'lookup_group', 'content_type', 'content_id', 'source', 'method',
  'action', 'kind', 'filter', 'filter_value',
]);

async function openProductionHost(page, context, baseURL, path, consent = 'denied') {
  await routeProductionHost(context, baseURL);
  await seedConsent(context, consent);
  await gotoBooted(page, `${PRODUCTION_ORIGIN}${path}`);
}

/** Mọi `gtag('event', …)` tuỳ chỉnh đã vào dataLayer, theo thứ tự (bỏ `page_view` do loader gửi kèm URL đầy đủ). */
const events = async (page) =>
  (await dataLayerEntries(page)).filter((entry) => entry[0] === 'event' && entry[1] !== 'page_view').map(([, name, params]) => ({ name, params: params ?? {} }));

const eventsNamed = async (page, name) => (await events(page)).filter((event) => event.name === name);

/** Tham số chỉ có enum/id công khai: đúng khóa của hợp đồng, giá trị chuỗi/số/boolean, không có dấu hiệu email. */
async function expectNoPii(page) {
  for (const { name, params } of await events(page)) {
    for (const [key, value] of Object.entries(params)) {
      expect(ALLOWED_PARAM_KEYS.has(key), `${name}.${key} không thuộc hợp đồng`).toBe(true);
      expect(['string', 'number', 'boolean']).toContain(typeof value);
      expect(String(value)).not.toMatch(/@|https?:\/\//u);
    }
  }
}

test('hộp thoại Góp ý và Ủng hộ mở thì báo feedback.open / feedback.donate_open', async ({ page, context, baseURL }) => {
  await openProductionHost(page, context, baseURL, '/tra-cuu/tuong/');
  expect(await eventsNamed(page, 'feedback')).toEqual([]);

  const feedbackButton = page.locator('[data-feedback-open]');
  await expect(feedbackButton).toBeVisible();
  await feedbackButton.click();
  await expect(page.locator('#feedback-dialog')).toBeVisible();
  expect(await eventsNamed(page, 'feedback')).toEqual([{ name: 'feedback', params: { action: 'open', kind: 'feature' } }]);
  await page.keyboard.press('Escape');
  await expect(page.locator('#feedback-dialog')).toBeHidden();

  const donateButton = page.locator('[data-donate-open]');
  await expect(donateButton).toBeVisible();
  await donateButton.click();
  await expect(page.locator('#donate-dialog')).toBeVisible();
  const feedbackEvents = await eventsNamed(page, 'feedback');
  expect(feedbackEvents.at(-1)).toEqual({ name: 'feedback', params: { action: 'donate_open' } });
  expect(feedbackEvents).toHaveLength(2);
  await expectNoPii(page);
});

test('Tra cứu: search chỉ báo một lần sau khi ngừng gõ, select_content khi mở hồ sơ', async ({ page, context, baseURL }) => {
  // `search` mang chữ gõ nên chỉ gửi khi đã đồng ý.
  await openProductionHost(page, context, baseURL, '/tra-cuu/tuong/', 'granted');
  const input = page.locator('.lookup-search-input');
  expect(await eventsNamed(page, 'search')).toEqual([]);

  await input.click();
  await input.pressSequentially('  lưu bị ', { delay: 60 });
  // Vừa gõ xong: chưa tới 1 s yên lặng nên chưa có sự kiện nào (không báo theo từng phím).
  expect(await eventsNamed(page, 'search')).toEqual([]);
  await expect.poll(async () => (await eventsNamed(page, 'search')).length, { timeout: 5000 }).toBe(1);
  await page.waitForTimeout(1500);
  expect(await eventsNamed(page, 'search')).toEqual([
    { name: 'search', params: { search_term: 'lưu bị', lookup_group: 'heroes' } },
  ]);

  const first = page.locator('#section-lookup [data-lookup-id]').first();
  const id = await first.getAttribute('data-lookup-id');
  expect(id).toBeTruthy();
  expect(await eventsNamed(page, 'select_content')).toEqual([]);
  await first.click();
  await expect(page.locator('.lookup-dialog')).toBeVisible();
  expect(await eventsNamed(page, 'select_content')).toEqual([
    { name: 'select_content', params: { content_type: 'heroes', content_id: id } },
  ]);
  await expectNoPii(page);
});

test('/doi-chuan/: filter_change chỉ báo khi người dùng đổi mùa, kiểu hiển thị, chip; không báo lúc tải trang', async ({ page, context, baseURL }) => {
  await openProductionHost(page, context, baseURL, '/doi-chuan/');
  const section = page.locator('#section-team-chuan');
  await expect(section.locator('.reference-team-card').first()).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(await eventsNamed(page, 'filter_change')).toEqual([]);

  // Kiểu hiển thị: bấm nút đang bật (Thẻ) không phải thay đổi; chuyển sang Thẻ gọn mới báo.
  await section.locator('.view-btn-the').click();
  expect(await eventsNamed(page, 'filter_change')).toEqual([]);
  await section.locator('.view-btn-luoi').click();
  await expect(page).toHaveURL(/[?&]view=luoi/u);
  expect(await eventsNamed(page, 'filter_change')).toEqual([{ name: 'filter_change', params: { filter: 'view', filter_value: 'luoi' } }]);

  // Mùa nguồn: chọn một mùa khác mùa đang chọn.
  const seasonSelect = section.getByLabel('Mùa', { exact: true });
  const current = await seasonSelect.inputValue();
  const other = await seasonSelect.locator('option').evaluateAll((options, now) => options.map((option) => option.value).find((value) => value && value !== now), current);
  expect(other).toBeTruthy();
  await seasonSelect.selectOption(other);
  await expect(page).toHaveURL(new RegExp(`[?&]season=${other}`, 'u'));
  expect((await eventsNamed(page, 'filter_change')).at(-1)).toEqual({ name: 'filter_change', params: { filter: 'season', filter_value: other } });

  // Chip facet (không tính chip lọc theo kho).
  await section.locator('.fchip:not(.roster-chip)').first().click();
  const facet = (await eventsNamed(page, 'filter_change')).at(-1);
  expect(facet.params.filter).toBe('facet');
  expect(facet.params.filter_value).toMatch(/^(faction|unit|tier|subcategory|source):.+/u);
  expect(await eventsNamed(page, 'filter_change')).toHaveLength(3);
  await expectNoPii(page);
});
