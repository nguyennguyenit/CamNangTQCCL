import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

/**
 * Bản tiếng Trung `/zh/…`: mọi route bản Việt có bản gương cùng đường dẫn. Trang zh chỉ hiện chữ Trung
 * (tên riêng đánh dấu `translate="no"` và nhãn nút chuyển ngôn ngữ `lang="vi"` là ngoại lệ có chủ đích),
 * khai `lang="zh-Hans"`, hreflang tới cặp trang và nút chuyển ngôn ngữ trỏ đúng bản còn lại.
 */
const ORIGIN = 'https://tqccl.pages.dev';
const handles = JSON.parse(await readFile(new URL('../pipeline/team-route-handles.json', import.meta.url), 'utf8')).handles;
const legacySegment = Object.values(handles.legacy)[0];
const khaiHoangSegment = Object.values(handles.khaihoang)[0];

/** Chữ Việt có dấu (kể cả đ); chữ Latin không dấu như "Beta", "SP" hay mã mùa không bị tính. */
const VIETNAMESE = /[ăâđêôơưàảãáạằẳẵắặầẩẫấậèẻẽéẹềểễếệìỉĩíịòỏõóọồổỗốộờởỡớợùủũúụừửữứựỳỷỹýỵ]/iu;
const HAN = /[\u3400-\u9fff]/u;

/** Chữ hiển thị và tên truy cập của một vùng, bỏ phần có chủ đích không dịch. */
async function visibleText(page, selector) {
  return page.locator(selector).evaluateAll((roots) => roots.map((root) => {
    const clone = root.cloneNode(true);
    for (const skip of clone.querySelectorAll('[translate="no"], [lang="vi"], script, style, noscript')) skip.remove();
    const labels = [...clone.querySelectorAll('[aria-label], [title], [alt]')]
      .flatMap((node) => ['aria-label', 'title', 'alt'].map((name) => node.getAttribute(name) || ''));
    return [clone.textContent, ...labels].join('\n');
  }).join('\n'));
}

async function expectChineseOnly(page, selector) {
  const text = await visibleText(page, selector);
  const offending = text.split(/\n+/u).map((line) => line.trim()).filter((line) => VIETNAMESE.test(line));
  expect(offending, `${selector} còn chữ Việt`).toEqual([]);
}

async function expectPair(page, locale, viPath) {
  const zhPath = viPath === '/' ? '/zh/' : `/zh${viPath}`;
  await expect(page.locator('html')).toHaveAttribute('lang', locale === 'zh' ? 'zh-Hans' : 'vi');
  await expect(page.locator('link[rel="alternate"][hreflang="vi"]')).toHaveAttribute('href', `${ORIGIN}${viPath}`);
  await expect(page.locator('link[rel="alternate"][hreflang="zh-Hans"]')).toHaveAttribute('href', `${ORIGIN}${zhPath}`);
  await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute('href', `${ORIGIN}${viPath}`);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${ORIGIN}${locale === 'zh' ? zhPath : viPath}`);
  const switcher = page.locator('.header-actions [data-lang-switch]');
  // Nút giữ query/hash hiện tại (js/site-chrome.js); đường dẫn phải là bản gương của trang.
  expect(new URL(await switcher.getAttribute('href'), ORIGIN).pathname).toBe(locale === 'zh' ? viPath : zhPath);
  await expect(switcher).toHaveText(locale === 'zh' ? 'Tiếng Việt' : '中文');
}

test('Landing bản Trung chỉ có chữ Trung, lang zh-Hans, hreflang và nút về bản Việt', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/zh/');
  await expectPair(page, 'zh', '/');
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'zh_CN');
  // Bản Trung không tải subset tiếng Việt.
  await expect(page.locator('link[rel="preload"][href*="vietnamese"]')).toHaveCount(0);
  await expectChineseOnly(page, 'header.site-header');
  await expectChineseOnly(page, 'main');
  await expectChineseOnly(page, 'footer.site-footer');
  // Link nội bộ của vỏ trang ở lại bản Trung.
  const internal = await page.locator('header a[href^="/"], footer a[href^="/"]').evaluateAll((links) =>
    links.filter((link) => !link.hasAttribute('data-lang-switch')).map((link) => link.getAttribute('href')));
  expect(internal.length).toBeGreaterThan(5);
  expect(internal.filter((href) => !href.startsWith('/zh/'))).toEqual([]);
  await page.locator('.header-actions [data-lang-switch]').click();
  await expect(page).toHaveURL(/\/$/u);
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
});

test('trang mục bản Trung dựng nội dung bằng chữ Trung và giữ query khi chuyển ngôn ngữ', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/zh/tra-cuu/?group=tactics');
  await expectPair(page, 'zh', '/tra-cuu/');
  await expect(page.locator('#section-lookup')).not.toBeEmpty();
  await expectChineseOnly(page, 'header.site-header');
  await expectChineseOnly(page, 'footer.site-footer');
  await expect(page.locator('.header-actions [data-lang-switch]')).toHaveAttribute('href', '/tra-cuu/?group=tactics');

  await page.goto('/zh/doi-chuan/');
  await expectPair(page, 'zh', '/doi-chuan/');
  await expect(page.locator('#section-team-chuan a[href^="/zh/doi-chuan/"]').first()).toBeVisible();
  await expect(page.locator('#section-team-chuan a[href^="/doi-chuan/"]')).toHaveCount(0);
  await expectChineseOnly(page, 'main');
});

const SECTIONS = [
  ['doi-chuan', 'team-chuan'], ['doi-khac', 'team-khac'], ['cung-ton', 'coexist'], ['khai-hoang', 'khaihoang'],
  ['tra-cuu', 'lookup'], ['theo-doi-chieu-mo', 'recruit-tracker'], ['soi-doi-tu-anh', 'analyze'], ['goi-y-doi-tu-kho', 'roster-recommend'],
];
for (const [path, section] of SECTIONS) {
  test(`trang mục /zh/${path}/ dựng xong vẫn chỉ có chữ Trung`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/zh/${path}/`);
    await expectPair(page, 'zh', `/${path}/`);
    await expect(page.locator(`#section-${section}`)).not.toBeEmpty();
    await expect(page.locator(`#section-${section} [aria-busy="true"]`)).toHaveCount(0);
    await expectChineseOnly(page, 'main');
  });
}

test('ba họ trang chi tiết bản Trung: tiêu đề chữ Hán, link về danh sách bản Trung, cặp hreflang', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const recommendedPath = await page.request.get('/sitemap.xml').then((response) => response.text())
    .then((xml) => xml.match(/<loc>https:\/\/tqccl\.pages\.dev(\/doi-chuan\/[^<]+\/)<\/loc>/u)[1]);
  const cases = [
    { viPath: recommendedPath, back: /^\/zh\/doi-chuan\/(\?season=[^&]+)?$/u },
    { viPath: `/doi-khac/${legacySegment}/`, back: /^\/zh\/doi-khac\/$/u },
    { viPath: `/khai-hoang/${khaiHoangSegment}/`, back: /^\/zh\/khai-hoang\/$/u },
  ];
  for (const { viPath, back } of cases) {
    await page.goto(`/zh${viPath}`);
    await expectPair(page, 'zh', viPath);
    await expect(page.locator('#team-detail-title')).toHaveText(HAN);
    expect(await page.title()).toMatch(/三国志战略版攻略手册$/u);
    expect(await page.title()).not.toMatch(VIETNAMESE);
    expect(await page.locator('#team-return-link').getAttribute('href')).toMatch(back);
    await expect(page.locator('#team-detail-root')).toHaveAttribute('aria-busy', 'false');
    await expectChineseOnly(page, 'header.site-header');
    await expectChineseOnly(page, '.detail-back-row, #team-detail-root');
    await expectChineseOnly(page, 'footer.site-footer');

    await page.goto(viPath);
    await expectPair(page, 'vi', viPath);
  }
});

test('menu mobile bản Trung có nút chuyển ngôn ngữ tới bản Việt', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/zh/khai-hoang/');
  await page.locator('#section-menu-toggle').click();
  const menuSwitch = page.locator('#section-menu-items [data-lang-switch]');
  await expect(menuSwitch).toBeVisible();
  await expect(menuSwitch).toHaveAttribute('href', '/khai-hoang/');
  await expectChineseOnly(page, '#section-menu-items');
});

test('404 dưới /zh/ hiện khối tiếng Trung và nút về bản Việt', async ({ page }) => {
  const response = await page.goto('/zh/doi-chuan/khong-ton-tai/');
  expect(response.status()).toBe(404);
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
  await expect(page.locator('#not-found-title-zh')).toBeVisible();
  await expect(page.locator('#not-found-title')).toHaveCount(0);
  await expect(page.getByRole('link', { name: '返回首页' })).toHaveAttribute('href', '/zh/');
  await expect(page.locator('.header-actions [data-lang-switch]')).toHaveAttribute('href', '/');
  expect(await page.title()).toMatch(HAN);

  await page.goto('/doi-chuan/khong-ton-tai/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await expect(page.locator('#not-found-title')).toBeVisible();
  await expect(page.locator('[data-not-found="zh"]')).toBeHidden();
});
