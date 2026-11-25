import { expect, test } from '@playwright/test';
import { ANALYTICS_CONFIG } from '../js/config.js';
import { PRODUCTION_ORIGIN, dataLayerEntries, routeProductionHost, seedConsent } from './helpers/production-host.mjs';

/**
 * GA4 + Consent Mode v2 (src/lib/analytics-loader.ts, js/analytics.js, js/consent-banner.js, SiteLayout). Chỉ `tqccl.com` bật GA,
 * nên mỗi test route `https://tqccl.com` về server preview cục bộ (tests-e2e/helpers/production-host.mjs): GTM bị thay bằng
 * script rỗng, `google-analytics.com` bị chặn, kết quả đọc từ `window.dataLayer` (mỗi lệnh gtag là một Arguments).
 * `/tra-cuu/` là trang mục lục tĩnh (không nạp app, có cột chuyển nhanh) nên nhẹ và đủ cho vỏ trang.
 */
const ID = ANALYTICS_CONFIG.measurementId;
const KEY = 'analyticsConsent';
const SHELL_PATH = '/tra-cuu/';
const DAY_MS = 24 * 60 * 60 * 1000;

test.beforeEach(async ({ context, baseURL }) => {
  await routeProductionHost(context, baseURL);
});

// Trang vẫn đang tải JSON khi test kết thúc; bỏ route còn dở để lỗi không đổ sang test sau.
test.afterEach(async ({ context }) => {
  await context.unrouteAll({ behavior: 'ignoreErrors' });
});

const command = (name, kind) => (entry) => entry[0] === name && (kind === undefined || entry[1] === kind);
const consentUpdates = async (page) => (await dataLayerEntries(page)).filter(command('consent', 'update')).map((entry) => entry[2]);
const storedChoice = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), KEY);
const banner = (page) => page.locator('#consent-banner');
const opener = (page) => page.locator('.site-footer [data-consent-open]');
const choice = (page, name) => banner(page).locator(`[data-consent-choice="${name}"]`);

/** Nút footer chỉ hiện khi js/consent-banner.js đã chạy trên trang bật GA: dấu hiệu module đã khởi tạo xong. */
const ready = (page) => expect(opener(page)).toBeVisible();

/** Ghi sẵn một giá trị thô (kể cả giá trị hỏng/hết hạn) trước mọi script của trang. */
const seedRaw = (context, raw) => context.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: KEY, value: raw });

test('tqccl.com: consent mặc định từ chối, config mang id đo, gtag.js được nạp và thanh đồng ý hiện', async ({ page }) => {
  await page.goto(`${PRODUCTION_ORIGIN}${SHELL_PATH}`);
  await ready(page);
  const entries = await dataLayerEntries(page);
  const defaultAt = entries.findIndex(command('consent', 'default'));
  const configAt = entries.findIndex(command('config'));
  expect(defaultAt).toBe(0);
  expect(entries[defaultAt][2]).toEqual({
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500,
  });
  expect(configAt).toBeGreaterThan(defaultAt);
  expect(entries[configAt][1]).toBe(ID);
  // config không tự gửi page_view (js/app.js gỡ utm_* khỏi URL trước khi gtag.js kịp đọc): loader gửi lượt xem trang đầu
  // tường minh ngay sau config, với URL chụp ở <head>.
  expect(entries[configAt][2]).toEqual({ send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
  const views = entries.filter(command('event', 'page_view'));
  expect(views).toHaveLength(1);
  expect(entries.findIndex(command('event', 'page_view'))).toBe(configAt + 1);
  expect(views[0][2]).toEqual({ page_location: `${PRODUCTION_ORIGIN}${SHELL_PATH}` });
  // Không có lựa chọn đã lưu: không có lệnh update nào, không có gì trong storage.
  expect(entries.filter(command('consent', 'update'))).toEqual([]);
  expect(await storedChoice(page)).toBeNull();
  await expect(page.locator(`script[src="https://www.googletagmanager.com/gtag/js?id=${ID}"]`)).toHaveCount(1);

  await expect(banner(page)).toBeVisible();
  await expect(banner(page)).toHaveAttribute('role', 'region');
  await expect(banner(page)).toHaveAccessibleName(/\S/u);
  await expect(banner(page)).toContainText('Google Analytics');
  await expect(banner(page).locator('a[href="/chinh-sach-bao-mat/"]')).toHaveCount(1);
  await expect(choice(page, 'denied')).toHaveText('Từ chối');
  await expect(choice(page, 'granted')).toHaveText('Đồng ý');
});

test('Đồng ý: update granted, lưu lựa chọn, ẩn thanh; tải lại không hỏi lại và áp lựa chọn từ storage', async ({ page }) => {
  await page.goto(`${PRODUCTION_ORIGIN}${SHELL_PATH}`);
  await ready(page);
  await choice(page, 'granted').click();

  expect(await consentUpdates(page)).toEqual([{ analytics_storage: 'granted' }]);
  const stored = await storedChoice(page);
  expect(stored).toMatchObject({ v: 1, choice: 'granted' });
  expect(Math.abs(Date.now() - stored.at)).toBeLessThan(60_000);
  await expect(banner(page)).toBeHidden();

  await page.reload();
  await ready(page);
  await expect(banner(page)).toBeHidden();
  const entries = await dataLayerEntries(page);
  const at = (name, kind) => entries.findIndex(command(name, kind));
  // Lựa chọn đã lưu được áp ngay sau consent mặc định và trước config, để lượt xem trang đầu đã mang quyền đồng ý.
  expect(at('consent', 'default')).toBe(0);
  expect(entries[at('consent', 'update')][2]).toEqual({ analytics_storage: 'granted' });
  expect(at('consent', 'update')).toBeGreaterThan(at('consent', 'default'));
  expect(at('config')).toBeGreaterThan(at('consent', 'update'));
  expect(at('event', 'page_view')).toBe(at('config') + 1);
});

test('Từ chối: lưu denied, ẩn thanh, tải lại không hỏi lại và không cấp quyền', async ({ page }) => {
  await page.goto(`${PRODUCTION_ORIGIN}${SHELL_PATH}`);
  await ready(page);
  await choice(page, 'denied').click();

  expect(await consentUpdates(page)).toEqual([{ analytics_storage: 'denied' }]);
  expect(await storedChoice(page)).toMatchObject({ v: 1, choice: 'denied' });
  await expect(banner(page)).toBeHidden();

  await page.reload();
  await ready(page);
  await expect(banner(page)).toBeHidden();
  // Mặc định đã là từ chối nên không cần update; quan trọng là không có lệnh cấp quyền nào.
  expect(await consentUpdates(page)).toEqual([]);
});

test('lựa chọn hết hạn sau 12 tháng, sai phiên bản hoặc hỏng thì thanh hỏi lại và không cấp quyền', async ({ browser, baseURL }) => {
  const cases = {
    'hết hạn': JSON.stringify({ v: 1, choice: 'granted', at: Date.now() - 366 * DAY_MS }),
    'sai phiên bản': JSON.stringify({ v: 2, choice: 'granted', at: Date.now() }),
    'lựa chọn lạ': JSON.stringify({ v: 1, choice: 'maybe', at: Date.now() }),
    'JSON hỏng': '{hỏng',
  };
  for (const [label, raw] of Object.entries(cases)) {
    const context = await browser.newContext({ baseURL });
    await routeProductionHost(context, baseURL);
    await seedRaw(context, raw);
    const page = await context.newPage();
    await page.goto(`${PRODUCTION_ORIGIN}${SHELL_PATH}`);
    await ready(page);
    await expect(banner(page), label).toBeVisible();
    expect(await consentUpdates(page), label).toEqual([]);
    await context.close();
  }
});

test('lựa chọn còn trong 12 tháng được giữ: không hỏi lại', async ({ context, page }) => {
  await seedRaw(context, JSON.stringify({ v: 1, choice: 'granted', at: Date.now() - 364 * DAY_MS }));
  await page.goto(`${PRODUCTION_ORIGIN}${SHELL_PATH}`);
  await ready(page);
  await expect(banner(page)).toBeHidden();
  expect(await consentUpdates(page)).toEqual([{ analytics_storage: 'granted' }]);
});

test('lượt xem trang đầu mang URL gốc kể cả tham số theo dõi mà js/app.js gỡ khỏi URL ngay sau đó', async ({ page }) => {
  const path = '/doi-chuan/?utm_source=newsletter&utm_medium=email&gclid=abc123';
  await page.goto(`${PRODUCTION_ORIGIN}${path}`);
  await expect(page.locator('body')).toHaveAttribute('data-boot', 'ready');
  // app.js đã gỡ utm_*/gclid khỏi URL của trình duyệt…
  expect(new URL(page.url()).search).toBe('');
  // …nhưng page_view do loader gửi ở <head> vẫn mang URL ban đầu, và chỉ có đúng một lượt xem trang.
  const views = (await dataLayerEntries(page)).filter(command('event', 'page_view'));
  expect(views).toHaveLength(1);
  expect(views[0][2]).toEqual({ page_location: `${PRODUCTION_ORIGIN}${path}` });
});

test('sự kiện search (chữ người dùng gõ) chỉ đi khi đã đồng ý; sự kiện khác vẫn đi khi từ chối hoặc chưa chọn', async ({ page }) => {
  await page.goto(`${PRODUCTION_ORIGIN}${SHELL_PATH}`);
  await ready(page);
  const track = (name, params) => page.evaluate(async ([eventName, eventParams]) => {
    const { track: send } = await import('/js/analytics.js');
    send(eventName, eventParams);
  }, [name, params]);
  const sent = async () => (await dataLayerEntries(page)).filter(command('event')).map(([, name]) => name);
  const search = { search_term: 'kiếm', lookup_group: 'heroes' };

  // Chưa chọn: Consent Mode vẫn gửi tín hiệu không cookie kèm tham số sự kiện, nên chữ tự do không được gửi.
  await track('search', search);
  await track('select_content', { content_type: 'heroes', content_id: 'hero:ma-sieu' });
  expect(await sent()).toEqual(['page_view', 'select_content']);

  await choice(page, 'denied').click();
  await track('search', search);
  await track('feedback', { action: 'open' });
  expect(await sent()).toEqual(['page_view', 'select_content', 'feedback']);

  await opener(page).click();
  await choice(page, 'granted').click();
  await track('search', search);
  const events = (await dataLayerEntries(page)).filter(command('event'));
  expect(events.at(-1).slice(1)).toEqual(['search', search]);
});

test('lần hỏi đầu: nút Cài đặt cookie báo thanh đang mở, chọn xong focus chuyển tới vùng nội dung chính chứ không rơi về body', async ({ page }) => {
  await page.goto(`${PRODUCTION_ORIGIN}${SHELL_PATH}`);
  await ready(page);
  await expect(opener(page)).toHaveAttribute('aria-expanded', 'true');
  await choice(page, 'denied').click();
  await expect(banner(page)).toBeHidden();
  await expect(opener(page)).toHaveAttribute('aria-expanded', 'false');
  const main = page.locator('#main-content');
  await expect(main).toBeFocused();
  expect(await main.evaluate((node) => getComputedStyle(node).outlineStyle)).toBe('none');
  // tabindex chỉ là tạm để nhận focus: gỡ khi focus đi chỗ khác.
  await page.keyboard.press('Tab');
  await expect(main).not.toBeFocused();
  await expect(main).not.toHaveAttribute('tabindex', /.*/u);
});

test('"Cài đặt cookie" ở footer mở lại thanh, đưa focus vào đó và trả focus về nút sau khi chọn', async ({ context, page }) => {
  await seedConsent(context, 'denied');
  await page.goto(`${PRODUCTION_ORIGIN}${SHELL_PATH}`);
  await ready(page);
  await expect(banner(page)).toBeHidden();
  await expect(opener(page)).toHaveText('Cài đặt cookie');
  await expect(opener(page)).toHaveAttribute('aria-expanded', 'false');

  await opener(page).click();
  await expect(banner(page)).toBeVisible();
  await expect(opener(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(banner(page)).toBeFocused();
  // Thanh không giam focus: Tab đi tiếp qua link chính sách và hai nút rồi ra khỏi thanh.
  await page.keyboard.press('Tab');
  await expect(banner(page).locator('a')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(choice(page, 'denied')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(choice(page, 'granted')).toBeFocused();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.closest('#consent-banner'))).toBeNull();

  // Nút là công tắc (aria-expanded): bấm khi thanh đang mở thì đóng, không ép chọn; bấm lại thì mở.
  await opener(page).focus();
  await page.keyboard.press('Enter');
  await expect(banner(page)).toBeHidden();
  await expect(opener(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(opener(page)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(banner(page)).toBeVisible();
  await choice(page, 'granted').click();
  await expect(banner(page)).toBeHidden();
  await expect(opener(page)).toBeFocused();
  await expect(opener(page)).toHaveAttribute('aria-expanded', 'false');
  expect(await storedChoice(page)).toMatchObject({ choice: 'granted' });
  expect(await consentUpdates(page)).toEqual([{ analytics_storage: 'granted' }]);
});

test('rút lại đồng ý xoá cookie _ga* của domain và báo denied', async ({ context, page }) => {
  await context.addCookies([
    { name: '_ga', value: 'GA1.1.111.222', url: PRODUCTION_ORIGIN },
    { name: `_ga_${ID.replace(/^G-/u, '')}`, value: 'GS2.1.s1', url: PRODUCTION_ORIGIN },
    { name: 'khac', value: 'giu-lai', url: PRODUCTION_ORIGIN },
  ]);
  await seedConsent(context, 'granted');
  await page.goto(`${PRODUCTION_ORIGIN}${SHELL_PATH}`);
  await ready(page);
  expect((await context.cookies(PRODUCTION_ORIGIN)).map((cookie) => cookie.name).sort()).toEqual(['_ga', `_ga_${ID.slice(2)}`, 'khac'].sort());

  await opener(page).click();
  await choice(page, 'denied').click();
  expect(await consentUpdates(page)).toEqual([{ analytics_storage: 'granted' }, { analytics_storage: 'denied' }]);
  await expect.poll(async () => (await context.cookies(PRODUCTION_ORIGIN)).map((cookie) => cookie.name)).toEqual(['khac']);
});

test('lựa chọn ở một tab áp sang tab khác đang mở', async ({ context, page }) => {
  await page.goto(`${PRODUCTION_ORIGIN}${SHELL_PATH}`);
  await ready(page);
  await expect(banner(page)).toBeVisible();
  const other = await context.newPage();
  await other.goto(`${PRODUCTION_ORIGIN}${SHELL_PATH}`);
  await ready(other);
  await choice(other, 'granted').click();
  await expect(banner(page)).toBeHidden();
  expect(await consentUpdates(page)).toEqual([{ analytics_storage: 'granted' }]);
});

test('/quan-tri/ ở mọi locale: HTML không có dấu vết GA và trình duyệt không dựng gtag, thanh hay nút cookie', async ({ page, request }) => {
  // Đối chứng: trang thường mang script và thanh đồng ý, nên các `not.toContain` bên dưới không rỗng nghĩa.
  const normal = await (await request.get(SHELL_PATH)).text();
  for (const marker of ['id="analytics-loader"', 'googletagmanager.com/gtag/js', 'id="consent-banner"', 'data-consent-open', '/js/consent-banner.js']) {
    expect(normal, marker).toContain(marker);
  }
  for (const path of ['/quan-tri/', '/zh/quan-tri/', '/ja/quan-tri/']) {
    const html = await (await request.get(path)).text();
    for (const marker of ['gtag', 'googletagmanager', 'dataLayer', 'analytics-loader', 'consent-banner', 'data-consent', KEY, ID]) {
      expect(html, `${path} chứa ${marker}`).not.toContain(marker);
    }
    await page.goto(`${PRODUCTION_ORIGIN}${path}`);
    await expect(page.locator('footer.site-footer')).toBeVisible();
    expect(await page.evaluate(() => ({ dataLayer: typeof window.dataLayer, gtag: typeof window.gtag }))).toEqual({ dataLayer: 'undefined', gtag: 'undefined' });
    await expect(page.locator('script[src*="googletagmanager"]')).toHaveCount(0);
    await expect(page.locator('#consent-banner, [data-consent-open]')).toHaveCount(0);
  }
});

test('localhost (preview, test build): không dataLayer, không script GA, không thanh, nút cookie ẩn', async ({ page }) => {
  await page.goto(SHELL_PATH);
  await expect(page.locator('footer.site-footer')).toBeVisible();
  // Chờ module của footer (donate/feedback) chạy xong để chắc consent-banner.js cũng đã có cơ hội chạy.
  await expect(page.locator('.site-footer [data-donate-open]')).toBeVisible();
  expect(await page.evaluate(() => ({ dataLayer: typeof window.dataLayer, gtag: typeof window.gtag }))).toEqual({ dataLayer: 'undefined', gtag: 'undefined' });
  await expect(page.locator('script[src*="googletagmanager"]')).toHaveCount(0);
  await expect(banner(page)).toBeHidden();
  await expect(opener(page)).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.hasAttribute('data-consent-banner'))).toBe(false);
});

for (const [prefix, text, deny, allow, settings] of [
  ['/zh', /Google Analytics.*Cookie/su, '拒绝', '同意', 'Cookie 设置'],
  ['/ja', /Google アナリティクス.*Cookie/su, '拒否する', '同意する', 'Cookie 設定'],
]) {
  test(`${prefix}: thanh đồng ý, nút footer và link chính sách đúng ngôn ngữ`, async ({ page }) => {
    await page.goto(`${PRODUCTION_ORIGIN}${prefix}${SHELL_PATH}`);
    await ready(page);
    await expect(banner(page)).toBeVisible();
    await expect(banner(page)).toHaveText(text);
    await expect(choice(page, 'denied')).toHaveText(deny);
    await expect(choice(page, 'granted')).toHaveText(allow);
    await expect(opener(page)).toHaveText(settings);
    await expect(banner(page).locator('a')).toHaveAttribute('href', `${prefix}/chinh-sach-bao-mat/`);
    // Không lẫn chữ Việt có dấu trong thanh hoặc nút footer.
    const vietnamese = /[ăâđêôơưàảãáạằẳẵắặầẩẫấậèẻẽéẹềểễếệìỉĩíịòỏõóọồổỗốộờởỡớợùủũúụừửữứựỳỷỹýỵ]/iu;
    expect(`${await banner(page).innerText()}\n${await opener(page).innerText()}`).not.toMatch(vietnamese);
  });
}

test('thanh đồng ý: hai nút cùng cỡ, Đồng ý là nút chính, không đẩy nội dung, theme sáng/tối theo token, link bỏ qua điều hướng vẫn là Tab đầu tiên', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${PRODUCTION_ORIGIN}${SHELL_PATH}`);
  await ready(page);
  await expect(banner(page)).toBeVisible();

  const [denyBox, allowBox] = [await choice(page, 'denied').boundingBox(), await choice(page, 'granted').boundingBox()];
  expect(denyBox.height).toBe(allowBox.height);
  expect(denyBox.height).toBeGreaterThanOrEqual(44);
  // Đồng ý nổi bật bằng nền chọn của nút chính (`--select`); Từ chối giữ nút thường.
  const selectColor = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.backgroundColor = 'var(--select)';
    document.body.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  });
  await expect(choice(page, 'granted')).toHaveCSS('background-color', selectColor);
  await expect(choice(page, 'denied')).not.toHaveCSS('background-color', selectColor);

  const bar = await banner(page).boundingBox();
  expect(bar.y + bar.height).toBe(800);
  expect(bar.width).toBe(1280);
  // Thanh phủ lên đáy trang nên cuối trang có đệm đúng bằng chiều cao thanh: footer cuộn được lên trên thanh, đích cuộn/focus
  // chừa chỗ (`scroll-padding`), thanh dính đáy và toast nâng lên trên thanh. Đóng thanh thì mọi thứ trả về như cũ.
  const barHeight = await banner(page).evaluate((node) => node.offsetHeight);
  const height = () => page.evaluate(() => document.documentElement.scrollHeight);
  const metrics = () => page.evaluate(() => ({
    scrollPaddingBottom: getComputedStyle(document.documentElement).scrollPaddingBottom,
    bodyPaddingBottom: getComputedStyle(document.body).paddingBottom,
    bottoms: Object.fromEntries(['ana-editor-foot', 'roster-actionbar', 'rt-toast', 'mt-toasts'].map((name) => {
      const probe = document.createElement('div');
      probe.className = name;
      document.body.append(probe);
      const bottom = parseFloat(getComputedStyle(probe).bottom);
      probe.remove();
      return [name, bottom];
    })),
  }));
  const withBanner = await height();
  const open = await metrics();
  expect(open.scrollPaddingBottom).toBe(`${barHeight}px`);
  expect(open.bodyPaddingBottom).toBe(`${barHeight}px`);
  // `html { scroll-behavior: smooth }`: cuộn tức thì để đo đúng vị trí cuối trang.
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  const footerEnd = await page.locator('.footer-bottom').boundingBox();
  expect(footerEnd.y + footerEnd.height).toBeLessThanOrEqual(bar.y + 1);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  // Thanh đứng ngay sau link bỏ qua trong DOM nhưng link vẫn là Tab đầu tiên, nằm ở mép trên và không bị thanh (mép dưới) che.
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  const skip = await page.locator('.skip-link').boundingBox();
  expect(skip.y).toBeGreaterThanOrEqual(0);
  expect(skip.y + skip.height).toBeLessThanOrEqual(bar.y);
  await page.keyboard.press('Tab');
  await expect(banner(page).locator('a')).toBeFocused();

  const background = (target) => target.evaluate((node) => getComputedStyle(node).backgroundColor);
  const panel = () => page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.backgroundColor = 'var(--panel)';
    document.body.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  });
  const light = await background(banner(page));
  expect(light).toBe(await panel());
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  const dark = await background(banner(page));
  expect(dark).toBe(await panel());
  expect(dark).not.toBe(light);

  await choice(page, 'denied').click();
  await expect(banner(page)).toBeHidden();
  const closed = await metrics();
  expect(Math.abs(withBanner - (await height()) - barHeight)).toBeLessThanOrEqual(1);
  expect(closed.scrollPaddingBottom).toBe('auto');
  expect(closed.bodyPaddingBottom).toBe('0px');
  for (const name of Object.keys(open.bottoms)) {
    expect(Math.abs(open.bottoms[name] - closed.bottoms[name] - barHeight), name).toBeLessThanOrEqual(1);
  }
});

test('mobile: nút chuyển nhanh nằm trên thanh đồng ý, thanh xếp dọc và nút bấm đủ lớn', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${PRODUCTION_ORIGIN}${SHELL_PATH}`);
  await ready(page);
  await expect(banner(page)).toBeVisible();
  const toggle = page.locator('.quick-nav-toggle');
  await expect(toggle).toBeVisible();

  const bar = await banner(page).boundingBox();
  expect(bar.y + bar.height).toBe(844);
  expect(bar.height).toBeLessThanOrEqual(844 / 2);
  const toggleBox = await toggle.boundingBox();
  expect(toggleBox.y + toggleBox.height).toBeLessThanOrEqual(bar.y);
  for (const name of ['denied', 'granted']) {
    const box = await choice(page, name).boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.y).toBeGreaterThanOrEqual(bar.y);
  }

  // Danh sách chuyển nhanh mở lên trên nút nên cũng nằm trọn trên thanh.
  await toggle.click();
  const list = await page.locator('#quick-nav-panel').boundingBox();
  expect(list.y + list.height).toBeLessThanOrEqual(bar.y);

  await choice(page, 'denied').click();
  await expect(banner(page)).toBeHidden();
  const lowered = await toggle.boundingBox();
  expect(lowered.y + lowered.height).toBeGreaterThan(bar.y);
});
