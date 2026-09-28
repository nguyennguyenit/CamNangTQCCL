import { expect, test } from '@playwright/test';

/**
 * Cầu chuyển domain (src/lib/host-bridge.ts) chạy trên hostname THẬT: request tới
 * `https://tqccl.com`, `https://tqccl.pages.dev` và `https://www.tqccl.com` được route về bản build
 * local (preview), nên trình duyệt thấy đúng origin/hostname, có localStorage riêng từng origin,
 * mà script không cần hook tiêm hostname cho test. Trang `/__seed` là HTML trống (không có bridge)
 * để ghi sẵn storage cho một origin.
 */
const HOSTS = ['tqccl.com', 'tqccl.pages.dev', 'www.tqccl.com'];
const PREFIX = '#tqccl-migrate=';

test.beforeEach(async ({ context, baseURL }) => {
  for (const host of HOSTS) {
    await context.route(`https://${host}/**`, async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/__seed') {
        await route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>seed</title>' });
        return;
      }
      const response = await route.fetch({ url: new URL(url.pathname + url.search, baseURL).href });
      await route.fulfill({ response });
    });
  }
});

// Trang vẫn đang tải JSON khi test kết thúc; bỏ route còn dở để lỗi không đổ sang test sau.
test.afterEach(async ({ context }) => {
  await context.unrouteAll({ behavior: 'ignoreErrors' });
});

async function seed(page, origin, items) {
  await page.goto(`${origin}/__seed`);
  await page.evaluate((entries) => {
    for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
  }, items);
}

const storageOf = (page, keys) =>
  page.evaluate((names) => Object.fromEntries(names.map((name) => [name, localStorage.getItem(name)])), keys);

test('tqccl.pages.dev carries tracker, scan, view and theme to tqccl.com without overwriting newer data', async ({ page }) => {
  const legacy = {
    tqcclRecruitTracker: '{"schemaVersion":1,"accounts":[{"id":"a"}]}',
    'tqccl.rosterRecommend.scanState.v1': '{"ownedHeroes":["h1"]}',
    'tqccl.teamView.v1': 'bang',
    theme: 'dark',
  };
  await seed(page, 'https://tqccl.pages.dev', legacy);
  // Máy đã từng mở tqccl.com: khóa `tqccl.teamView.v1` ở đây mới hơn, phải được giữ.
  await seed(page, 'https://tqccl.com', { 'tqccl.teamView.v1': 'the' });

  await page.goto('https://tqccl.pages.dev/theo-doi-chieu-mo/?nguon=cu#muc');
  await expect(page).toHaveURL('https://tqccl.com/theo-doi-chieu-mo/?nguon=cu#muc');
  expect(await storageOf(page, Object.keys(legacy))).toEqual({ ...legacy, 'tqccl.teamView.v1': 'the' });
  // Bridge chạy trước script theme: trang mới đã tối ngay lần tải đầu.
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('www.tqccl.com without stored data redirects and the restored legacy hash still routes', async ({ page }) => {
  await page.goto('https://www.tqccl.com/#khaihoang');
  // Không có dữ liệu thì chuyển thẳng với hash gốc; script hash cũ của Landing đưa tiếp tới Khai hoang.
  await expect(page).toHaveURL('https://tqccl.com/khai-hoang/');
});

test('the migrated fragment is restored before the Landing legacy-hash redirect reads it', async ({ page }) => {
  await seed(page, 'https://tqccl.pages.dev', { theme: 'light' });
  await page.goto('https://tqccl.pages.dev/#khaihoang');
  await expect(page).toHaveURL('https://tqccl.com/khai-hoang/');
  expect(await storageOf(page, ['theme'])).toEqual({ theme: 'light' });
});

test('an invalid migration payload on tqccl.com is stripped and writes nothing', async ({ page }) => {
  const payload = encodeURIComponent(JSON.stringify({ v: 1, hash: '', items: { theme: 'dark', evil: 'x' } }));
  await page.goto(`https://tqccl.com/tra-cuu/tuong/?source=x${PREFIX}${payload}`);
  await expect(page).toHaveURL('https://tqccl.com/tra-cuu/tuong/?source=x');
  expect(await storageOf(page, ['theme', 'evil'])).toEqual({ theme: null, evil: null });
});

test('the local preview host is untouched by the bridge', async ({ page }) => {
  await page.goto('/theo-doi-chieu-mo/#muc');
  await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:\d+\/theo-doi-chieu-mo\/#muc$/);
});
