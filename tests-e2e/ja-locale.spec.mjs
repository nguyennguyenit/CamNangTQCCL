import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { SITE_LOCALES } from '../js/i18n.js';

/**
 * Bản tiếng Nhật `/ja/…`: mọi route bản Việt có bản gương cùng đường dẫn. Trang ja chỉ hiện chữ Nhật/Hán (tên riêng
 * `translate="no"` và nhãn link chuyển ngôn ngữ `lang="vi"` là ngoại lệ có chủ đích), khai `lang="ja"`, đủ hreflang của
 * mọi locale, và nhóm chuyển ngôn ngữ có một link cho mỗi bản (bản đang xem `aria-current="page"`).
 *
 * Spec chỉ chạy khi `ja` đã nằm trong `SITE_LOCALES` (trước đó route `/ja/` chưa được sinh).
 */
test.skip(!SITE_LOCALES.includes('ja'), 'locale ja chưa bật trong SITE_LOCALES');

const ORIGIN = 'https://tqccl.com';
const handles = JSON.parse(await readFile(new URL('../pipeline/team-route-handles.json', import.meta.url), 'utf8')).handles;
const legacySegment = Object.values(handles.legacy)[0];
const khaiHoangSegment = Object.values(handles.khaihoang)[0];
const lookupHandles = JSON.parse(await readFile(new URL('../pipeline/lookup-route-handles.json', import.meta.url), 'utf8')).handles;
const lookupJa = JSON.parse(await readFile(new URL('../data/lookup-ja.json', import.meta.url), 'utf8'));
/**
 * Ký tự phồn/giản thể có dạng Nhật khác (`data/ja-kanji-variants.json`): trang đội ja không được còn chữ Hán nguồn chưa đổi. Trừ
 * ký tự có trong tên Nhật của `data/lookup-ja.json` (tên đã thấy ở nguồn Nhật, như 焰逐風飛) và tên game 三國志 của tên site.
 */
const JA_NAME_CHARS = new Set(Object.values(lookupJa.entries).flatMap((entry) => [...entry.name]));
const SOURCE_ONLY_KANJI = new Set(Object.keys(JSON.parse(await readFile(new URL('../data/ja-kanji-variants.json', import.meta.url), 'utf8')).map)
  .filter((char) => !JA_NAME_CHARS.has(char)));

/** Chữ Việt có dấu (kể cả đ); chữ Latin không dấu như "Beta", "SP" hay mã mùa không bị tính. */
const VIETNAMESE = /[ăâđêôơưàảãáạằẳẵắặầẩẫấậèẻẽéẹềểễếệìỉĩíịòỏõóọồổỗốộờởỡớợùủũúụừửữứựỳỷỹýỵ]/iu;
/** Chữ Hán hoặc kana. */
const JAPANESE = /[぀-ヿ㐀-鿿]/u;
/** Thứ tự nhóm chuyển ngôn ngữ = thứ tự `SITE_LOCALES`; nhãn viết bằng chính ngôn ngữ đó. */
const SWITCHER = [
  { hreflang: 'vi', label: 'Tiếng Việt', path: (viPath) => viPath },
  { hreflang: 'zh-Hans', label: '中文', path: (viPath) => (viPath === '/' ? '/zh/' : `/zh${viPath}`) },
  { hreflang: 'ja', label: '日本語', path: (viPath) => (viPath === '/' ? '/ja/' : `/ja${viPath}`) },
];
const jaPathOf = (viPath) => (viPath === '/' ? '/ja/' : `/ja${viPath}`);

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

async function expectJapaneseOnly(page, selector) {
  const text = await visibleText(page, selector);
  const offending = text.split(/\n+/u).map((line) => line.trim()).filter((line) => VIETNAMESE.test(line));
  expect(offending, `${selector} còn chữ Việt`).toEqual([]);
}

/** `lang`, bộ hreflang của mọi locale, canonical và nhóm chuyển ngôn ngữ ba lựa chọn của một trang ja có bản gương. */
async function expectJaPage(page, viPath) {
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  for (const { hreflang, path } of SWITCHER) {
    await expect(page.locator(`link[rel="alternate"][hreflang="${hreflang}"]`)).toHaveAttribute('href', `${ORIGIN}${path(viPath)}`);
  }
  await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute('href', `${ORIGIN}${viPath}`);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${ORIGIN}${jaPathOf(viPath)}`);
  const links = page.locator('.header-actions [data-lang-switcher] a');
  await expect(links).toHaveCount(SWITCHER.length);
  for (const [index, { hreflang, label, path }] of SWITCHER.entries()) {
    const link = links.nth(index);
    await expect(link).toHaveAttribute('hreflang', hreflang);
    await expect(link).toHaveText(label);
    // Link giữ query/hash hiện tại (js/site-chrome.js); đường dẫn là bản gương của trang ở ngôn ngữ đó.
    expect(new URL(await link.getAttribute('href'), ORIGIN).pathname).toBe(path(viPath));
    if (hreflang === 'ja') await expect(link).toHaveAttribute('aria-current', 'page');
    else await expect(link).not.toHaveAttribute('aria-current', /.+/u);
  }
}

test('Landing bản Nhật chỉ có chữ Nhật, lang ja, đủ hreflang và nhóm chuyển ngôn ngữ ba lựa chọn', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/ja/');
  await expectJaPage(page, '/');
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'ja_JP');
  await expect(page.locator('meta[property="og:locale:alternate"]')).toHaveCount(SITE_LOCALES.length - 1);
  // Bản Nhật không tải subset tiếng Việt.
  await expect(page.locator('link[rel="preload"][href*="vietnamese"]')).toHaveCount(0);
  await expectJapaneseOnly(page, 'header.site-header');
  await expectJapaneseOnly(page, 'main');
  await expectJapaneseOnly(page, 'footer.site-footer');
  expect(await page.title()).toMatch(JAPANESE);
  // Link nội bộ của vỏ trang ở lại bản Nhật.
  const internal = await page.locator('header a[href^="/"], footer a[href^="/"]').evaluateAll((links) =>
    links.filter((link) => !link.closest('[data-lang-switcher]')).map((link) => link.getAttribute('href')));
  expect(internal.length).toBeGreaterThan(5);
  expect(internal.filter((href) => !href.startsWith('/ja/'))).toEqual([]);
  await page.locator('.header-actions [data-lang-switcher] a[hreflang="zh-Hans"]').click();
  await expect(page).toHaveURL(/\/zh\/$/u);
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
});

test('nhóm chuyển ngôn ngữ giữ query và hash cho mọi lựa chọn, kể cả bản đang xem', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/ja/tra-cuu/chien-phap/?id=tactic%3Aan-ui-quan-dan');
  await expect(page.locator('body[data-boot=ready]')).toBeAttached();
  const query = '?id=tactic%3Aan-ui-quan-dan';
  for (const { hreflang, path } of SWITCHER) {
    await expect(page.locator(`.header-actions [data-lang-switcher] a[hreflang="${hreflang}"]`))
      .toHaveAttribute('href', `${path('/tra-cuu/chien-phap/')}${query}`);
  }
  await page.locator('.header-actions [data-lang-switcher] a[hreflang="vi"]').click();
  await page.waitForURL((url) => url.pathname === '/tra-cuu/chien-phap/' && url.search === query);
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
});

const SECTIONS = [
  ['doi-chuan', 'team-chuan'], ['doi-khac', 'team-khac'], ['cung-ton', 'coexist'], ['khai-hoang', 'khaihoang'],
  ['tra-cuu', 'lookup'], ['theo-doi-chieu-mo', 'recruit-tracker'], ['soi-doi-tu-anh', 'analyze'], ['goi-y-doi-tu-kho', 'roster-recommend'],
  ...['tuong', 'chien-phap', 'trang-bi', 'quan-su', 'cai-tao-binh-chung', 'cong-trinh', 'binh-thu'].map((slug) => [`tra-cuu/${slug}`, 'lookup']),
];
for (const [path, section] of SECTIONS) {
  test(`trang mục /ja/${path}/ dựng xong vẫn chỉ có chữ Nhật`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/ja/${path}/`);
    await expectJaPage(page, `/${path}/`);
    await expect(page.locator(`#section-${section}`)).not.toBeEmpty();
    await expect(page.locator(`#section-${section} [aria-busy="true"]`)).toHaveCount(0);
    await expectJapaneseOnly(page, 'header.site-header');
    await expectJapaneseOnly(page, 'main');
    await expectJapaneseOnly(page, 'footer.site-footer');
  });
}

test('ba họ trang chi tiết và một trang mùa bản Nhật: tiêu đề chữ Nhật, link về danh sách bản Nhật, đủ hreflang', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const sitemap = await page.request.get('/sitemap.xml').then((response) => response.text());
  const recommendedPath = sitemap.match(/<loc>https:\/\/tqccl\.com(\/doi-chuan\/[a-z0-9]+(?:-[a-z0-9]+){2,}\/)<\/loc>/u)[1];
  const cases = [
    { viPath: recommendedPath, back: /^\/ja\/doi-chuan\/(\?season=[^&]+)?$/u },
    { viPath: `/doi-khac/${legacySegment}/`, back: /^\/ja\/doi-khac\/$/u },
    { viPath: `/khai-hoang/${khaiHoangSegment}/`, back: /^\/ja\/khai-hoang\/$/u },
  ];
  for (const { viPath, back } of cases) {
    await page.goto(jaPathOf(viPath));
    await expectJaPage(page, viPath);
    await expect(page.locator('#team-detail-title')).toHaveText(JAPANESE);
    expect(await page.title()).toMatch(JAPANESE);
    expect(await page.title()).not.toMatch(VIETNAMESE);
    expect(await page.locator('#team-return-link').getAttribute('href')).toMatch(back);
    await expect(page.locator('#team-detail-root')).toHaveAttribute('aria-busy', 'false');
    await expectJapaneseOnly(page, 'header.site-header');
    await expectJapaneseOnly(page, '.detail-back-row, #team-detail-root');
    await expectJapaneseOnly(page, 'footer.site-footer');
    // Tên tướng/chiến pháp/đội là tên Nhật hoặc tự dạng Nhật, không còn chữ Hán nguồn thô (như 轉, 將).
    const shown = `${await page.title()}\n${await page.locator('#team-detail-title, #team-detail-root').allInnerTexts().then((texts) => texts.join('\n'))}`.replaceAll('三國志', '');
    expect([...new Set([...shown].filter((char) => SOURCE_ONLY_KANJI.has(char)))], `chữ Hán nguồn chưa đổi ở ${viPath}`).toEqual([]);
  }

  // Trang mùa Đội chuẩn (mùa cũ có đội): slug là mã mùa (`pk-s24`, `s3`…).
  const seasonPath = sitemap.match(/<loc>https:\/\/tqccl\.com\/ja(\/doi-chuan\/(?:pk-)?s\d+\/)<\/loc>/u)?.[1];
  expect(seasonPath, 'sitemap phải có trang mùa bản Nhật').toBeTruthy();
  await page.goto(jaPathOf(seasonPath));
  await expectJaPage(page, seasonPath);
  expect(await page.title()).not.toMatch(VIETNAMESE);
  await expectJapaneseOnly(page, 'main');
});

test('trang riêng Tra cứu bản Nhật: tên Nhật, tên gốc chữ Hán, nhãn trạng thái tên, nhãn dịch máy và dòng báo thiếu', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const tactics = Object.entries(lookupJa.entries).filter(([id]) => id.startsWith('tactic:'));
  // Mục có bản dịch hiệu ứng: hiện tên Nhật, tên gốc, nhãn trạng thái tên, nhãn 機械翻訳 và dòng số liệu bản đại lục.
  const [translatedId, translated] = tactics.find(([, entry]) => entry.texts?.effect && entry.name !== entry.nameOriginal);
  const translatedPath = `/tra-cuu/chien-phap/${lookupHandles.tactics[translatedId]}/`;
  await page.goto(jaPathOf(translatedPath));
  await expectJaPage(page, translatedPath);
  await expect(page.locator('h1')).toContainText(translated.name);
  const main = page.locator('main');
  await expect(main).toContainText('原名');
  await expect(main).toContainText(translated.nameOriginal);
  await expect(main).toContainText(/確認済み|字形変換/u);
  await expect(main).toContainText('機械翻訳');
  await expect(main).toContainText('数値は中国大陸版に基づく');
  await expectJapaneseOnly(page, 'main');
  expect(await page.title()).not.toMatch(VIETNAMESE);

  // Mục chưa có bản dịch hiệu ứng: hiện dòng báo thiếu, không hiện chữ Việt thay thế.
  const missing = tactics.find(([, entry]) => !entry.texts?.effect);
  expect(missing, 'data/lookup-ja.json phải còn mục chiến pháp thiếu bản dịch hiệu ứng').toBeTruthy();
  const missingPath = `/tra-cuu/chien-phap/${lookupHandles.tactics[missing[0]]}/`;
  await page.goto(jaPathOf(missingPath));
  await expect(page.locator('h1')).toContainText(missing[1].name);
  await expect(main).toContainText(/日本語訳がない|未翻訳/u);
  await expectJapaneseOnly(page, 'main');

  // Trang nhóm: danh sách dựng sẵn dùng tên Nhật.
  await page.goto('/ja/tra-cuu/chien-phap/');
  await expect(page.locator(`#section-lookup a[data-lookup-id="${translatedId}"]`).first()).toContainText(translated.name);
});

test('Soi đội từ ảnh và Gợi ý đội từ kho bản Nhật mở được, chỉ có chữ Nhật', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const [path, section] of [['soi-doi-tu-anh', 'analyze'], ['goi-y-doi-tu-kho', 'roster-recommend']]) {
    await page.goto(`/ja/${path}/`);
    await expect(page.locator('body[data-boot=ready]')).toBeAttached();
    await expect(page.locator(`#section-${section}`)).toBeVisible();
    await expect(page.locator(`#section-${section}`)).not.toBeEmpty();
    await expectJapaneseOnly(page, `#section-${section}`);
  }
});

test('menu mobile bản Nhật có nhóm chuyển ngôn ngữ ba lựa chọn; header mobile chỉ giữ link sang bản khác', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/ja/khai-hoang/');
  await expect(page.locator('.header-actions [data-lang-switcher] a[aria-current="page"]')).toBeHidden();
  await expect(page.locator('.header-actions [data-lang-switch]')).toHaveCount(SITE_LOCALES.length - 1);
  await page.locator('#section-menu-toggle').click();
  const menuLinks = page.locator('#section-menu-items [data-lang-switcher] a');
  await expect(menuLinks).toHaveCount(SWITCHER.length);
  await expect(menuLinks.nth(2)).toHaveAttribute('aria-current', 'page');
  await expect(menuLinks.nth(0)).toHaveAttribute('href', '/khai-hoang/');
  await expect(menuLinks.nth(1)).toHaveAttribute('href', '/zh/khai-hoang/');
  // Không tràn ngang ở 390px.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expectJapaneseOnly(page, '#section-menu-items');
});

test('404 dưới /ja/ hiện khối tiếng Nhật và nhóm chuyển ngôn ngữ trỏ trang chủ từng bản', async ({ page }) => {
  const response = await page.goto('/ja/doi-chuan/khong-ton-tai/');
  expect(response.status()).toBe(404);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page.locator('#not-found-title-ja')).toBeVisible();
  await expect(page.locator('#not-found-title')).toHaveCount(0);
  await expect(page.locator('[data-not-found="zh"]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'トップページへ戻る' })).toHaveAttribute('href', '/ja/');
  expect(await page.title()).toMatch(JAPANESE);
  const links = page.locator('.header-actions [data-lang-switcher] a');
  await expect(links.nth(2)).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.header-actions [data-lang-switch][hreflang="vi"]')).toHaveAttribute('href', '/');
  await expect(page.locator('.header-actions [data-lang-switch][hreflang="zh-Hans"]')).toHaveAttribute('href', '/zh/');
  await expectJapaneseOnly(page, 'main');

  // Bản Việt của 404 vẫn giữ khối Việt, khối Nhật ẩn.
  await page.goto('/doi-chuan/khong-ton-tai/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await expect(page.locator('#not-found-title')).toBeVisible();
  await expect(page.locator('[data-not-found="ja"]')).toBeHidden();
});

test('blog bản Nhật: danh sách và RSS được publish kể cả khi chưa có bài', async ({ page }) => {
  const index = await page.goto('/ja/bai-viet/');
  expect(index.status()).toBe(200);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expectJapaneseOnly(page, 'main');
  const rss = await page.request.get('/ja/rss.xml');
  expect(rss.status()).toBe(200);
  expect(await rss.text()).toContain('<language>ja</language>');
});
