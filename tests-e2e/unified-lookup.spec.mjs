// E2E giao diện Tra cứu: mục lục /tra-cuu/ + bảy trang nhóm /tra-cuu/<slug>/, chip nhóm là link giữa các trang,
// phân trang quá 60, hộp thoại hồ sơ theo `?id=` có focus trap (tướng, chiến pháp, binh thư), bốn nhóm catalog dạng
// danh sách + chi tiết (chọn sẵn mục đầu, chip lọc, màn chi tiết mobile), live region tiếng Việt, link cũ
// `?group=&id=` được mục lục chuyển tiếp, và mỗi trang nhóm chỉ tải đúng payload của nhóm mình.
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

/** Slug đóng băng của trang riêng từng mục (`pipeline/lookup-route-handles.json`): đủ để biết số mục và link trang riêng của nhóm. */
const HANDLES = JSON.parse(readFileSync(new URL('../pipeline/lookup-route-handles.json', import.meta.url), 'utf8')).handles;
const ITEM_TOTAL = Object.fromEntries(Object.entries(HANDLES).map(([group, ids]) => [group, Object.keys(ids).length]));
const itemPath = (group, id) => `${GROUP_PATH_BY_GROUP[group]}${HANDLES[group][id]}/`;
const GROUP_PATH_BY_GROUP = {
  heroes: '/tra-cuu/tuong/', tactics: '/tra-cuu/chien-phap/', equipment: '/tra-cuu/trang-bi/', advisors: '/tra-cuu/quan-su/',
  'troop-mods': '/tra-cuu/cai-tao-binh-chung/', buildings: '/tra-cuu/cong-trinh/', books: '/tra-cuu/binh-thu/',
};

/** Link điều hướng của mục: bảng desktop trong header hoặc menu mobile đang mở (footer cũng có link cùng tên). */
function navLink(page, name, mobile = false) {
  return (mobile ? page.locator('#section-menu-items') : page.locator('.quick-nav')).getByRole('link', { name, exact: true });
}

const CJK = /[\u3400-\u9fff]/;
const GROUPS = ['heroes', 'tactics', 'equipment', 'advisors', 'troop-mods', 'buildings', 'books'];
/** Trang nhóm (bản Việt) — khớp `LOOKUP_GROUP_SLUGS` của js/lookup-ids.js. */
const GROUP_PATH = {
  heroes: '/tra-cuu/tuong/',
  tactics: '/tra-cuu/chien-phap/',
  equipment: '/tra-cuu/trang-bi/',
  advisors: '/tra-cuu/quan-su/',
  'troop-mods': '/tra-cuu/cai-tao-binh-chung/',
  buildings: '/tra-cuu/cong-trinh/',
  books: '/tra-cuu/binh-thu/',
};

const lookup = (page) => page.locator('#section-lookup');
const chip = (page, group) => lookup(page).locator(`.lookup-chip[data-group="${group}"]`);
const currentChip = (page) => lookup(page).locator('.lookup-chip[aria-current="page"]');
const cards = (page) => lookup(page).locator('.lookup-card');
const results = (page) => lookup(page).locator('.lookup-card, .lookup-table-panel');
/** Nút mở hồ sơ của kết quả đầu tiên (thẻ tướng hoặc tên trong bảng chiến pháp). */
const firstResult = (page) => lookup(page).locator('[data-lookup-id]').first();
/** Bốn nhóm catalog dùng danh sách + chi tiết thay cho hộp thoại hồ sơ. */
const MASTER_GROUPS = new Set(['equipment', 'advisors', 'troop-mods', 'buildings']);
const panel = (page) => lookup(page).locator('.lookup-detail-panel');
const selectedItem = (page) => lookup(page).locator('.lookup-master-item[aria-current="true"]');
const groupResults = (page, group) => group === 'tactics'
  ? lookup(page).locator('.lookup-table tbody tr')
  : MASTER_GROUPS.has(group) ? lookup(page).locator('.lookup-master-item') : cards(page);

/** Mở trang nhóm và chờ app.js gắn xong: mục dựng sẵn hiện ngay nhưng chỉ mở được hồ sơ sau boot. */
async function openLookup(page, url) {
  await page.goto(url);
  await expect(page.locator('body[data-boot="ready"]')).toBeAttached();
}

test('mục lục Tra cứu là trang tĩnh bảy thẻ nhóm, không nạp app.js', async ({ page }) => {
  await page.goto('/tra-cuu/');
  await expect(navLink(page, 'Tra cứu', false)).toHaveAttribute('aria-current', 'page');
  await expect(lookup(page)).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-page-section', 'lookup');
  await expect(page.locator('.section')).toHaveCount(1);
  await expect(page.locator('script[src="/js/app.js"]')).toHaveCount(0);
  const hubCards = lookup(page).locator('a.lookup-hub-card');
  await expect(hubCards).toHaveCount(GROUPS.length);
  for (const [index, group] of GROUPS.entries()) {
    await expect(hubCards.nth(index)).toHaveAttribute('data-group', group);
    await expect(hubCards.nth(index)).toHaveAttribute('href', GROUP_PATH[group]);
    await expect(hubCards.nth(index).locator('.lookup-hub-count')).toHaveText(/^\d+$/);
  }
  await hubCards.nth(1).click();
  await expect(page).toHaveURL(GROUP_PATH.tactics);
  await expect(currentChip(page)).toHaveAttribute('data-group', 'tactics');
});

test('nav link Tra cứu hỗ trợ điều hướng bằng bàn phím', async ({ page }) => {
  await page.goto('/doi-chuan/');
  const lookupLink = navLink(page, 'Tra cứu');
  await lookupLink.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/tra-cuu/');
  await expect(navLink(page, 'Tra cứu', false)).toHaveAttribute('aria-current', 'page');
});

test('bảy trang nhóm: chip là link, đúng một chip aria-current và kết quả của nhóm', async ({ page }) => {
  for (const group of GROUPS) {
    await openLookup(page, GROUP_PATH[group]);
    await expect(page.locator('body')).toHaveAttribute('data-lookup-group', group);
    await expect(lookup(page).getByRole('navigation', { name: 'Nhóm tra cứu' }).getByRole('link')).toHaveCount(GROUPS.length);
    await expect(currentChip(page)).toHaveCount(1);
    await expect(currentChip(page)).toHaveAttribute('data-group', group);
    for (const other of GROUPS) await expect(chip(page, other)).toHaveAttribute('href', GROUP_PATH[other]);
    await expect(groupResults(page, group).first()).toBeVisible();
  }
});

test('chip nhóm chuyển trang nhóm; Back/Forward về đúng trang và chip đang chọn', async ({ page }) => {
  await openLookup(page, GROUP_PATH.heroes);
  await chip(page, 'tactics').click();
  await expect(page).toHaveURL(GROUP_PATH.tactics);
  await expect(currentChip(page)).toHaveAttribute('data-group', 'tactics');
  await expect(groupResults(page, 'tactics').first()).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(GROUP_PATH.heroes);
  await expect(currentChip(page)).toHaveAttribute('data-group', 'heroes');
  await expect(cards(page).first()).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(GROUP_PATH.tactics);
  await expect(currentChip(page)).toHaveAttribute('data-group', 'tactics');
});

test('route tra cứu sai trên trang nhóm bị từ chối bằng lỗi tiếng Việt', async ({ page }) => {
  for (const [route, message] of [
    ['/tra-cuu/tuong/?id=hero%3Aone&id=hero%3Atwo', 'Mỗi tham số tra cứu chỉ được xuất hiện một lần.'],
    ['/tra-cuu/tuong/?id=https%3A%2F%2Fevil.example%2Fx.json', 'Mã mục tra cứu không hợp lệ.'],
    ['/tra-cuu/trang-bi/?id=HERO%3Aluu-bi', 'Mã mục tra cứu không hợp lệ.'],
  ]) {
    await openLookup(page, route);
    await expect(lookup(page)).toBeVisible();
    await expect(lookup(page).locator('[role="alert"]')).toHaveText(message);
    await expect(lookup(page).getByRole('dialog')).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe(new URL(route, page.url()).pathname);
  }
});
test('mã của nhóm khác trên trang nhóm chuyển sang trang nhóm đúng và mở hồ sơ', async ({ page }) => {
  await page.goto('/tra-cuu/tuong/?id=tactic%3Aan-ui-quan-dan');
  await expect(page).toHaveURL('/tra-cuu/chien-phap/?id=tactic%3Aan-ui-quan-dan');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(currentChip(page)).toHaveAttribute('data-group', 'tactics');
});
test('mục lục chuyển tiếp link cũ ?group=&id=, link sai thì ở lại và chỉ bỏ hai khóa đó', async ({ page }) => {
  for (const [route, target] of [
    ['/tra-cuu/?group=equipment&source=x', '/tra-cuu/trang-bi/?source=x'],
    ['/tra-cuu/tuong/?id=hero%3Aluu-bi', '/tra-cuu/tuong/?id=hero%3Aluu-bi'],
    ['/tra-cuu/?group=scrolls&foo=1', '/tra-cuu/?foo=1'],
    ['/tra-cuu/?group=heroes&id=tactic%3Aan-ui-quan-dan', '/tra-cuu/'],
    ['/tra-cuu/?group=heroes&group=tactics', '/tra-cuu/'],
    ['/tra-cuu/?id=https%3A%2F%2Fevil.example%2Fx.json', '/tra-cuu/'],
  ]) {
    await page.goto(route);
    await expect(page, route).toHaveURL(target);
  }
  await expect(lookup(page).locator('a.lookup-hub-card')).toHaveCount(GROUPS.length);
});
test('tra cứu bỏ qua query key không được hỗ trợ', async ({ page }) => {
  await openLookup(page, '/tra-cuu/tuong/?foo=1');
  await expect(results(page).first()).toBeVisible();
  await expect(lookup(page).locator('[role="alert"]')).toHaveCount(0);
  await expect(lookup(page).getByRole('dialog')).toHaveCount(0);
});
test('mở và đóng hồ sơ giữ các query key ngoài id', async ({ page }) => {
  await openLookup(page, '/tra-cuu/chien-phap/?source=campaign&view=compact');
  await firstResult(page).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  let query = new URL(page.url()).searchParams;
  expect(query.get('id')).toMatch(/^tactic:/);
  expect(query.get('source')).toBe('campaign');
  expect(query.get('view')).toBe('compact');

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  query = new URL(page.url()).searchParams;
  expect(query.has('id')).toBe(false);
  expect(query.get('source')).toBe('campaign');
  expect(query.get('view')).toBe('compact');
});
test('lookup dependency failure stays in its own section', async ({ page }) => {
  await page.route('**/data/lookup-manifest.json', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"schemaVersion":2}\n' }));
  await openLookup(page, '/tra-cuu/tuong/');
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
  await navLink(page, 'Tra cứu').click();
  await expect(page).toHaveURL('/tra-cuu/');
  await expect(lookup(page)).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL('/doi-khac/?q=cuong');
  await expect(page.getByRole('searchbox', { name: 'Tìm Đội khác', exact: true })).toHaveValue('cuong');
});

test('quá 60 kết quả vẫn tới được bản ghi cuối bằng Xem thêm', async ({ page }) => {
  await openLookup(page, '/tra-cuu/tuong/');
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
  await openLookup(page, '/tra-cuu/tuong/');
  const search = lookup(page).getByRole('searchbox');
  await search.fill('luu bi');
  await expect(cards(page).first()).toContainText('Lưu Bị');
  await search.fill('劉備');
  await expect(cards(page).first()).toContainText('Lưu Bị');
  // Ô chân dung luôn có chữ Hán dự phòng dưới ảnh; tên hiển thị của thẻ phải thuần Việt.
  expect(await cards(page).first().locator('.lookup-card-name').textContent()).not.toMatch(CJK);

  await search.fill('zzzqqq');
  const empty = lookup(page).locator('.lookup-feedback');
  await expect(empty).toBeVisible();
  await expect(empty).toContainText(/Không có kết quả/i);
});

test('hộp thoại hồ sơ bẫy focus, đóng bằng Escape và trả focus về thẻ mở', async ({ page }) => {
  await openLookup(page, '/tra-cuu/tuong/');
  const opener = firstResult(page);
  await opener.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  for (let i = 0; i < 12; i += 1) await page.keyboard.press('Tab');
  expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  // Tên Hán của hồ sơ là chữ dữ liệu có chủ đích; phần còn lại của hộp thoại không được lộ chữ Hán nguồn.
  const zh = [...await dialog.locator('.lookup-dialog-zh').allTextContents(),
    ...await dialog.locator('.hero-portrait-han').allTextContents()];
  let remained = (await dialog.textContent()) ?? '';
  for (const value of zh) remained = remained.split(value).join('');
  expect(remained).not.toMatch(CJK);

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('bấm nền cũng đóng hộp thoại', async ({ page }) => {
  await openLookup(page, '/tra-cuu/chien-phap/');
  await firstResult(page).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.locator('.lookup-backdrop').click({ position: { x: 5, y: 5 } });
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('hồ sơ tướng đi tới chiến pháp liên quan: link trang riêng của chiến pháp, Back về hồ sơ tướng', async ({ page }) => {
  await openLookup(page, '/tra-cuu/tuong/');
  await lookup(page).getByRole('searchbox').fill('luu bi');
  await firstResult(page).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/tra-cuu\/tuong\/\?id=hero%3A/);

  const relation = dialog.locator('[data-lookup-relation]').first();
  const target = await relation.getAttribute('data-lookup-relation');
  // Nhóm khác: link tới trang riêng của chiến pháp (không còn mở hộp thoại trên trang Chiến pháp).
  await expect(relation).toHaveAttribute('href', itemPath('tactics', target));
  await relation.click();
  await expect(page).toHaveURL(itemPath('tactics', target));
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/tra-cuu\/tuong\/\?id=hero%3A/);
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('deep link tới một ID mở thẳng hồ sơ', async ({ page }) => {
  await openLookup(page, '/tra-cuu/tuong/');
  await lookup(page).getByRole('searchbox').fill('luu bi');
  await firstResult(page).click();
  const deepLink = new URL(page.url()).search;
  await openLookup(page, `/tra-cuu/tuong/${deepLink}`);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page).toHaveURL(`/tra-cuu/tuong/${deepLink}`);
});

test('chi tiết công trình hiện cấp, chi phí, thời gian và hiệu ứng', async ({ page }) => {
  await openLookup(page, '/tra-cuu/cong-trinh/');
  await lookup(page).locator('.lookup-master-item').nth(1).click();
  const detail = panel(page);
  await expect(detail.locator('.lookup-levels-table thead')).toContainText(/Gỗ/);
  await expect(detail.locator('.lookup-levels-table thead')).toContainText(/Sắt/);
  await expect(detail.locator('.lookup-levels-table thead')).toContainText(/Thời gian/);
  await expect(detail.locator('.lookup-level-row').first()).toContainText(/phút|giờ/);
  await expect(detail.locator('.lookup-level-row').first().locator('.lookup-level-effect')).not.toHaveText('—');
  await expect(detail).not.toContainText('Cấp công trình');
});

for (const width of [320, 375, 768, 1280]) {
  for (const theme of ['light', 'dark']) {
    test(`Tra cứu dùng được ở ${width}px trong nền ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
      await page.goto('/tra-cuu/');
      if (width < 1280) await page.locator('#section-menu-toggle').click();
      await expect(navLink(page, 'Tra cứu', width < 1280)).toHaveAttribute('aria-current', 'page');
      if (width < 1280) await page.locator('.site-menu-close').click();
      await openLookup(page, GROUP_PATH.heroes);
      for (const group of GROUPS) {
        if (group !== 'heroes') await chip(page, group).click();
        await expect(page).toHaveURL(GROUP_PATH[group]);
        await expect(currentChip(page)).toHaveAttribute('data-group', group);
        await expect(page.locator('body[data-boot="ready"]')).toBeAttached();
        await expect(groupResults(page, group).first()).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
        const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
        await firstResult(page).click();
        if (MASTER_GROUPS.has(group)) {
          // Chi tiết cạnh danh sách (desktop) hoặc màn riêng có nút quay lại (hẹp hơn 1024px).
          await expect(panel(page)).toBeVisible();
          expect(await noOverflow()).toBe(true);
          if (width < 1024) {
            await expect(lookup(page).locator('.lookup-master-list')).toBeHidden();
            await lookup(page).locator('[data-lookup-back]').click();
            await expect(lookup(page).locator('.lookup-master-list')).toBeVisible();
            await expect(panel(page)).toBeHidden();
            await expect(page).toHaveURL(GROUP_PATH[group]);
          } else {
            await expect(lookup(page).locator('.lookup-master-list')).toBeVisible();
          }
          expect(await noOverflow()).toBe(true);
          continue;
        }
        await expect(page.getByRole('dialog')).toBeVisible();
        expect(await noOverflow()).toBe(true);
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);
      }
    });
  }
}

/* ---------- Phase 7: chân dung, khối Trong cẩm nang, deep link, tải dữ liệu ---------- */

/** Mọi host chân dung lấy từ dữ liệu trong test (hiện image.aligames.com + cloud.lingxigames.com). */
async function portraitHosts(request) {
  const heroes = await (await request.get('/data/heroes-dict.json')).json();
  // Chân dung tự lưu của tướng client Global là đường dẫn cùng origin `/heroes/<slug>.webp`: chặn theo tiền tố đường dẫn.
  return [...new Set(heroes.map((hero) => hero.iconUrl).filter(Boolean).map((url) => (url.startsWith('/heroes/') ? '/heroes/' : new URL(url).host)))];
}

test('mọi ảnh chân dung là https hoặc ảnh tự lưu /heroes/ + no-referrer + lazy; thiếu iconUrl thì hiện chữ Hán', async ({ page }) => {
  await openLookup(page, '/tra-cuu/tuong/');
  await expect(cards(page)).toHaveCount(60);
  const portraits = await page.evaluate(() => [...document.querySelectorAll('#section-lookup .lookup-card img')].map((image) => ({
    src: image.getAttribute('src'), referrer: image.getAttribute('referrerpolicy'),
    loading: image.getAttribute('loading'), decoding: image.getAttribute('decoding'), alt: image.getAttribute('alt'),
  })));
  expect(portraits.length).toBeGreaterThan(0);
  for (const portrait of portraits) {
    expect(portrait.src).toMatch(/^(https:\/\/|\/heroes\/[a-z0-9-]+\.webp$)/);
    expect(portrait.referrer).toBe('no-referrer');
    expect(portrait.loading).toBe('lazy');
    expect(portrait.decoding).toBe('async');
    expect(portrait.alt.length).toBeGreaterThan(0);
  }
  // Trang đầu toàn tướng có ảnh; ô chữ Hán kiểm trên hồ sơ của tướng thiếu iconUrl (SP Tào Tháo: chưa có ở client Global
  // nên không có chân dung tự lưu).
  await openLookup(page, '/tra-cuu/tuong/?id=hero%3Asp-tao-thao');
  await expect(page.getByRole('dialog')).toBeVisible();
  const han = await page.evaluate(() => [...document.querySelectorAll('#section-lookup .lookup-dialog-portrait .hero-portrait-han')].map((node) => ({
    char: node.textContent.trim(), lang: node.firstElementChild?.getAttribute('lang'), hidden: node.firstElementChild?.getAttribute('aria-hidden'),
    images: node.parentElement.querySelectorAll('img').length, font: getComputedStyle(node).fontFamily,
  })));
  expect(han.length).toBe(1);
  for (const box of han) {
    expect(box.images).toBe(0);
    expect(box.font).toMatch(/Songti|Serif CJK/i);
    expect(box.char).toMatch(CJK);
    expect(box.lang).toBe('zh-Hant');
    expect(box.hidden).toBe('true');
  }
});

test('chặn mọi host chân dung: mọi thẻ hiện fallback chữ Hán, không ảnh vỡ', async ({ page, request }) => {
  const hosts = await portraitHosts(request);
  expect(hosts.length).toBeGreaterThan(0);
  await page.route('**/*', (route) => (hosts.some((host) => route.request().url().includes(host)) ? route.abort() : route.continue()));
  await openLookup(page, '/tra-cuu/tuong/');
  await expect(cards(page)).toHaveCount(60);
  // Cuộn hết lưới để mọi ảnh lazy được yêu cầu (và lỗi) rồi mới kiểm fallback.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((done) => setTimeout(done, 30)); }
  });
  await expect.poll(async () => page.evaluate(() => document.querySelectorAll('#section-lookup .lookup-card img').length), { timeout: 10_000 }).toBe(0);
  const state = await page.evaluate(() => ({
    cards: document.querySelectorAll('#section-lookup .lookup-card').length,
    han: document.querySelectorAll('#section-lookup .lookup-card .hero-portrait-han').length,
    broken: [...document.querySelectorAll('#section-lookup img')].filter((image) => image.complete && image.naturalWidth === 0).length,
  }));
  expect(state.han).toBe(state.cards);
  expect(state.broken).toBe(0);
});

test('index.json không được tải khi chưa mở hồ sơ, chỉ tải số liệu khi mở', async ({ page }) => {
  const requested = [];
  page.on('request', (r) => { if (r.url().includes('/data/recommended/')) requested.push(r.url().split('/').at(-1)); });
  await openLookup(page, '/tra-cuu/tuong/');
  await expect(cards(page)).toHaveCount(60);
  expect(requested).toEqual([]);

  await firstResult(page).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect.poll(() => requested.includes('hero-summaries.json'), { timeout: 15_000 }).toBe(true);
  expect(requested).toContain('manifest.json');
  expect(requested).toContain('hero-summaries.json');
  expect(requested).not.toContain('index.json');
  expect(requested).not.toContain('other-teams.json');
});

test('hồ sơ chiến pháp: chọn phiên bản hiệu ứng, số cấp in đậm và Trong cẩm nang khớp số liệu build', async ({ page, request }) => {
  const requested = [];
  page.on('request', (r) => { if (r.url().includes('/data/recommended/')) requested.push(r.url().split('/').at(-1)); });
  await openLookup(page, '/tra-cuu/chien-phap/?id=tactic%3Aho-bao-ky');
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('.lookup-tactic-tile', { hasText: 'Người mang tối đa' })).toContainText('1');
  await expect(dialog.locator('.lookup-source-hero')).toContainText('Tào Thuần');

  // Bản hiện hành chọn sẵn; bấm "Bản gốc" đổi đoạn hiệu ứng và trạng thái nút.
  const buttons = dialog.locator('.lookup-version-button');
  await expect(buttons).toHaveCount(3);
  await expect(buttons.first()).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.locator('.lookup-tactic-level').first()).toHaveText('20→40');
  await buttons.last().click();
  await expect(buttons.last()).toHaveAttribute('aria-pressed', 'true');
  await expect(buttons.first()).toHaveAttribute('aria-pressed', 'false');
  await expect(dialog.locator('.lookup-tactic-level').first()).toHaveText('45%→90%');

  // Số liệu hiển thị trùng file build của generation đang pin; không tải index/other-teams.
  const pin = await (await request.get('/data/recommended/current.json')).json();
  const summaries = await (await request.get(`/data/recommended/${pin.generationId}/tactic-summaries.json`)).json();
  const expected = summaries.summaries['tactic:ho-bao-ky'];
  const numbers = dialog.locator('.cam-nang-number');
  await expect(numbers.first()).toHaveText(String(expected.standard.teams));
  await expect(numbers.nth(1)).toHaveText(String(expected.other.teams));
  await expect(dialog.locator('.cam-nang-card').nth(1).locator('.cam-nang-bar-value').first()).toHaveText(String(expected.carriers[0].teams));
  await expect(dialog.locator('.cam-nang-team')).toHaveCount(expected.representative.length);
  expect(requested).toContain('tactic-summaries.json');
  expect(requested).not.toContain('index.json');
  expect(requested).not.toContain('other-teams.json');
});

test('số liệu Trong cẩm nang của SP Lữ Mông khớp phép đếm độc lập', async ({ page, request }) => {
  const heroes = await (await request.get('/data/heroes-dict.json')).json();
  const pin = await (await request.get('/data/recommended/current.json')).json();
  const [index, others] = await Promise.all([
    (await request.get(`/data/recommended/${pin.generationId}/index.json`)).json(),
    (await request.get(`/data/recommended/${pin.generationId}/other-teams.json`)).json(),
  ]);
  const strip = (value) => String(value ?? '').replace(/\s+/gu, '');
  const target = 'hero:sp-lu-mong';
  const hero = heroes.find((item) => item.id === target);
  const positions = [0, 0, 0];
  const representative = [];
  // Phép đếm độc lập: khóa chữ Hán của chính tướng (bỏ khoảng trắng) cho Đội chuẩn, tên Việt cho Đội khác.
  const chineseKeys = new Set([hero.chinese, ...(hero.aliases ?? [])].map(strip).filter(Boolean));
  const vietnameseKey = String(hero.hanViet ?? '').trim();
  let standard = 0;
  let other = 0;
  const tactics = new Map();
  const roleIndex = { '主將': 0, '副將 1': 1, '副將 2': 2 };
  // Ô `bond` (duyên phận) không phải chiến pháp; thiếu cột kind thì mặc định là `tactic`.
  const realTactics = (holder, vi) => {
    const names = (vi ? holder.tacticSlotsVi : holder.tacticSlotsRaw) ?? [];
    const kinds = holder.tacticSlotKinds ?? [];
    return names.filter((name, index) => name && (kinds[index] ?? 'tactic') === 'tactic');
  };
  for (const [order, record] of index.records.entries()) {
    const holder = (record.heroes ?? []).find((item) => chineseKeys.has(strip(item.nameRaw)));
    if (!holder) continue;
    standard += 1;
    positions[roleIndex[holder.roleRaw]] += 1;
    for (const name of new Set(realTactics(holder, true))) tactics.set(name, (tactics.get(name) ?? 0) + 1);
    representative.push({ family: 'recommended', name: record.displayNameVi, score: record.value, order });
  }
  for (const record of others.records) {
    const holder = (record.holders ?? []).find((item) => String(item.nameRaw ?? '').trim() === vietnameseKey);
    if (!holder) continue;
    other += 1;
    positions[(record.holders ?? []).indexOf(holder)] += 1;
    for (const name of new Set(realTactics(holder, false))) tactics.set(name, (tactics.get(name) ?? 0) + 1);
    representative.push({ family: 'other', name: record.name, score: null, order: representative.length });
  }
  expect(standard).toBeGreaterThan(0);
  expect(other).toBeGreaterThan(0);
  // Thứ tự hiển thị: điểm giảm dần rồi thứ tự nguồn (Đội chuẩn đứng trước khi cùng hạng).
  const topTactics = [...tactics.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  await openLookup(page, `/tra-cuu/tuong/?id=${encodeURIComponent(target)}`);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(lookup(page).locator('.cam-nang-grid')).toBeVisible();
  const counts = await lookup(page).locator('.cam-nang-number').allTextContents();
  expect(counts.map(Number)).toEqual([standard, other]);
  const tacticRows = lookup(page).locator('.cam-nang-card').nth(1).locator('.cam-nang-bar');
  await expect(tacticRows).toHaveCount(topTactics.length);
  for (const [index, [name, teams]] of topTactics.entries()) {
    await expect(tacticRows.nth(index).locator('.cam-nang-bar-label')).toHaveText(name);
    await expect(tacticRows.nth(index).locator('.cam-nang-bar-value')).toHaveText(String(teams));
  }
  // Vị trí xếp theo số đội giảm dần (hoà giữ thứ tự Chủ tướng → Phó tướng 1 → Phó tướng 2).
  const positionLabels = ['Chủ tướng', 'Phó tướng 1', 'Phó tướng 2'];
  const rankedPositions = positions.map((count, index) => [positionLabels[index], count]).sort((a, b) => b[1] - a[1]);
  const positionRows = lookup(page).locator('.cam-nang-card').first().locator('.cam-nang-bar');
  for (const [index, [label, count]] of rankedPositions.entries()) {
    await expect(positionRows.nth(index).locator('.cam-nang-bar-label')).toHaveText(label);
    await expect(positionRows.nth(index).locator('.cam-nang-bar-value')).toHaveText(String(count));
  }
  // Không có phần tử nào lộ khóa thô kiểu `bonusVi:`.
  // Đội tiêu biểu phải theo đúng thứ tự nguồn đã phát (điểm giảm dần rồi thứ tự bản ghi).
  const ranked = [...representative].sort((a, b) => (a.score === null) - (b.score === null) || (b.score ?? 0) - (a.score ?? 0)
    || (a.family === 'recommended' ? 0 : 1) - (b.family === 'recommended' ? 0 : 1) || a.order - b.order).slice(0, 3);
  const teamNames = await lookup(page).locator('.cam-nang-team-name').allTextContents();
  expect(teamNames).toEqual(ranked.map((team) => team.name));
  const leaked = await page.evaluate(() => [...document.querySelectorAll('#section-lookup *')].some((el) => /\b[a-z]+[A-Z][A-Za-z]*:/.test(el.textContent ?? '')));
  expect(leaked).toBe(false);
});

test('từ đội tiêu biểu vào trang chi tiết rồi Quay lại về đúng hồ sơ', async ({ page }) => {
  const profile = '/tra-cuu/tuong/?id=hero%3Asp-lu-mong';
  await openLookup(page, profile);
  await expect(lookup(page).locator('.cam-nang-grid')).toBeVisible();
  const team = lookup(page).locator('.cam-nang-team a').first();
  const href = await team.getAttribute('href');
  expect(href).toMatch(/^\/doi-chuan\/.+[?]from=/);
  await team.click();
  await expect(page).toHaveURL(/\/doi-chuan\//);
  await page.locator('.detail-back-link, .detail-back-row a').first().click();
  await expect(page).toHaveURL(new RegExp(`/tra-cuu/tuong/\\?id=hero%3Asp-lu-mong$`));
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('SP Lữ Mông');
});

test('link Tìm tướng này trong Đội chuẩn giữ season=all và q theo tên', async ({ page }) => {
  await openLookup(page, '/tra-cuu/tuong/?id=hero%3Asp-lu-mong');
  await expect(lookup(page).locator('.cam-nang-grid')).toBeVisible();
  const link = lookup(page).locator('.cam-nang-link');
  await expect(link).toHaveAttribute('href', /^\/doi-chuan\/\?season=all&q=/);
  expect(new URL(await link.getAttribute('href'), page.url()).searchParams.get('q')).toBe('SP Lữ Mông');
});

/* ---------- Vòng sửa P07: bảng toàn chiều rộng, hồ sơ mobile, tab đang chọn, enum, dữ liệu trả lại, Back ---------- */

const tableHeaders = ['Chiến pháp', 'Phẩm', 'Loại', 'Hiệu quả', 'Mục tiêu', 'Tỷ lệ'];

/** Nhãn cột hiện ra ở chế độ xếp dọc (nội dung `::before` lấy từ `data-label`). */
async function mobileTableLabels(page) {
  return page.evaluate(() => {
    const row = document.querySelector('#section-lookup .lookup-table tbody tr');
    const cells = [...row.querySelectorAll('th, td')];
    return cells.map((cell) => getComputedStyle(cell, '::before').content.replace(/^"|"$/g, ''));
  });
}

test('bảng chiến pháp chiếm toàn bộ chiều rộng và hiện đủ sáu cột ở desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openLookup(page, '/tra-cuu/chien-phap/');
  const panel = lookup(page).locator('.lookup-table-panel');
  await expect(panel).toBeVisible();
  const width = (await panel.boundingBox()).width;
  expect(width).toBeGreaterThan(1300);
  const headers = lookup(page).locator('.lookup-table thead th');
  await expect(headers).toHaveCount(6);
  for (const [index, label] of tableHeaders.entries()) {
    await expect(headers.nth(index)).toBeVisible();
    await expect(headers.nth(index)).toHaveText(label);
    expect((await headers.nth(index).boundingBox()).width).toBeGreaterThan(30);
  }
  // Không cột dữ liệu nào bị cắt: mọi ô thân bảng nằm trong khung panel.
  const overflow = await page.evaluate(() => {
    const frame = document.querySelector('#section-lookup .lookup-table-panel').getBoundingClientRect();
    return [...document.querySelectorAll('#section-lookup .lookup-table tbody tr:first-child > *')]
      .filter((cell) => cell.getBoundingClientRect().right > frame.right + 1).length;
  });
  expect(overflow).toBe(0);
});

for (const width of [390, 320]) {
  test(`bảng chiến pháp ở ${width}px bày đủ sáu trường với nhãn cột`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openLookup(page, '/tra-cuu/chien-phap/');
    await expect(lookup(page).locator('.lookup-table tbody tr').first()).toBeVisible();
    expect(await mobileTableLabels(page)).toEqual(tableHeaders);
    const sizes = await page.evaluate(() => {
      const row = document.querySelector('#section-lookup .lookup-table tbody tr');
      return [...row.querySelectorAll('th, td')].map((cell) => ({
        width: cell.clientWidth, height: cell.clientHeight, text: cell.textContent.trim().length,
      }));
    });
    for (const cell of sizes) {
      expect(cell.width).toBeGreaterThan(60);
      expect(cell.text).toBeGreaterThan(0);
    }
    const first = sizes[0];
    const last = sizes.at(-1);
    expect(last.height).toBeGreaterThan(0);
    expect(first.width).toBeGreaterThan(60);
  });
}

for (const width of [390, 320]) {
  for (const theme of ['light', 'dark']) {
    test(`đầu hồ sơ và bảng facts đọc được ở ${width}px nền ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
      await openLookup(page, '/tra-cuu/tuong/?id=hero%3Asp-lu-mong');
      await expect(page.getByRole('dialog')).toBeVisible();
      const head = await page.evaluate(() => {
        const facts = [...document.querySelectorAll('#section-lookup .lookup-fact')].map((row) => ({
          width: row.clientWidth,
          valueWidth: row.querySelector('.lookup-fact-value').clientWidth,
          valueHeight: row.querySelector('.lookup-fact-value').clientHeight,
        }));
        const title = document.querySelector('#section-lookup .lookup-dialog-title');
        return {
          headHeight: document.querySelector('#section-lookup .lookup-dialog-head').clientHeight,
          facts,
          titleHeight: title.clientHeight,
          titleWidth: title.clientWidth,
          titleLines: Math.round(title.clientHeight / Number.parseFloat(getComputedStyle(title).lineHeight)),
        };
      });
      expect(head.facts.length).toBeGreaterThanOrEqual(2);
      for (const fact of head.facts) {
        expect(fact.width).toBeGreaterThan(120);
        expect(fact.valueWidth).toBeGreaterThan(80);
        expect(fact.valueHeight).toBeLessThan(60);
      }
      expect(head.headHeight).toBeLessThan(520);
      expect(head.titleLines).toBeLessThanOrEqual(2);
      expect(head.titleWidth).toBeGreaterThan(90);
    });
  }
}

for (const theme of ['light', 'dark']) {
  test(`tab nhóm đang chọn đủ tương phản ở nền ${theme}`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
    await openLookup(page, '/tra-cuu/tuong/');
    await expect(lookup(page).locator('.lookup-chip[aria-current="page"]')).toBeVisible();
    const contrast = await page.evaluate(() => {
      const toRgb = (value) => value.match(/[\d.]+/g).slice(0, 3).map(Number);
      const lum = (rgb) => {
        const [r, g, b] = rgb.map((channel) => {
          const c = channel / 255;
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const chip = document.querySelector('#section-lookup .lookup-chip[aria-current="page"]');
      const style = getComputedStyle(chip);
      let background = style.backgroundColor;
      for (let node = chip; node && /rgba?\([^)]*,\s*0\)|transparent/.test(background); node = node.parentElement) {
        background = node.parentElement ? getComputedStyle(node.parentElement).backgroundColor : "rgb(255, 255, 255)";
      }
      const a = lum(toRgb(style.color));
      const b = lum(toRgb(background));
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
    await expect(lookup(page).locator('.lookup-chip[aria-current="page"] .lookup-chip-count')).toBeVisible();
  });
}

test('hồ sơ tướng và bảng chiến pháp không in enum loại thô', async ({ page }) => {
  await openLookup(page, '/tra-cuu/tuong/?id=hero%3Asp-lu-mong');
  await expect(page.getByRole('dialog')).toBeVisible();
  const subs = await lookup(page).locator('.lookup-relation-sub').allTextContents();
  expect(subs.length).toBeGreaterThan(0);
  for (const text of subs) {
    expect(text).not.toMatch(/\b(?:ACTIVE|PASSIVE|COMMAND|INTERNAL|FORMATION|TROOP|BURST)\b/);
    expect(text).toMatch(/Chủ động|Bị động|Chỉ huy|Nội chính|Trận pháp|Binh chủng|Bùng nổ/);
  }
  // Cột Loại của bảng Chiến pháp đi qua cùng bảng nhãn loại.
  await openLookup(page, '/tra-cuu/chien-phap/');
  await lookup(page).getByRole('searchbox').fill('An Ủi');
  await expect(lookup(page).locator('.lookup-table tbody tr').first()).toContainText('An Ủi');
  const types = await lookup(page).locator('.lookup-table tbody td[data-label="Loại"]').allTextContents();
  expect(types.length).toBeGreaterThan(0);
  for (const text of types) expect(text).not.toMatch(/\b(?:ACTIVE|PASSIVE|COMMAND|INTERNAL|FORMATION|TROOP|BURST)\b/);
  expect(types.every((text) => /Chủ động|Bị động|Chỉ huy|Nội chính|Trận pháp|Binh chủng|Bùng nổ/.test(text))).toBe(true);
});

test('hồ sơ giữ đủ trường đã có: bậc đặc kỹ, phẩm trang bị, loại và dạng hiệu ứng chiến pháp', async ({ page }) => {
  // Mã đặc kỹ mở trang bị cha: đặc kỹ được tô khung và giữ bậc T0, trang bị cha là mục đang chọn.
  await openLookup(page, '/tra-cuu/trang-bi/?id=equipment-special%3Agian-hung');
  await expect(panel(page).locator('.lookup-detail-title')).toHaveText('Kiếm Ỷ Thiên');
  await expect(panel(page).locator('.lookup-special.is-target')).toContainText('Gian Hùng');
  await expect(panel(page).locator('.lookup-special.is-target .badge-tier')).toHaveText('T0');
  await expect(selectedItem(page)).toHaveAttribute('data-lookup-id', 'equipment:y-thien-kiem');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await openLookup(page, '/tra-cuu/trang-bi/?id=equipment%3Ay-thien-kiem');
  await expect(panel(page).locator('.badge-tone')).toHaveText('Cam');
  await openLookup(page, '/tra-cuu/chien-phap/?id=tactic%3Aan-ui-quan-dan');
  const dialog = page.getByRole('dialog');
  // Loại nằm ở eyebrow + huy hiệu nền mực; dạng hiệu ứng ở huy hiệu viền và bảng nguồn (artboard LookupTacticProfile).
  await expect(dialog.locator('.lookup-dialog-eyebrow')).toContainText('Chỉ huy');
  await expect(dialog.locator('.lookup-dialog-badges .badge-ink')).toHaveText('Chỉ huy');
  await expect(dialog.locator('.lookup-tactic-facts')).toContainText('Dạng hiệu ứng');
  await expect(dialog.locator('.lookup-tactic-facts')).toContainText('Tăng ích');
});

test('Back đóng hồ sơ và trả focus về nơi đã mở', async ({ page }) => {
  await openLookup(page, '/tra-cuu/tuong/');
  await firstResult(page).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL('/tra-cuu/tuong/');
  expect(await page.evaluate(() => document.activeElement !== document.body && document.activeElement !== document.documentElement)).toBe(true);
  await page.goForward();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
});

/* ---------- Vòng sửa Opus (P07-D2…D5, N1…N4) ---------- */

/** Đổi mã màu token (`#f6e1dc`) sang dạng `rgb(...)` mà `getComputedStyle` trả về. */
function tokenRgb(value) {
  const hex = String(value).trim().replace(/^#/, "");
  const number = Number.parseInt(hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex, 16);
  return `rgb(${(number >> 16) & 255}, ${(number >> 8) & 255}, ${number & 255})`;
}

/** Số dòng chữ thật của một phần tử (hộp dòng của text node, không tính padding). */
const lineBoxes = (locator) => locator.evaluate((node) => {
  const textNode = [...node.childNodes].find((child) => child.nodeType === 3 && child.textContent.trim());
  const range = document.createRange();
  range.selectNodeContents(textNode ?? node);
  return range.getClientRects().length;
});

const tokenValue = (page, name) => page.evaluate((key) =>
  getComputedStyle(document.documentElement).getPropertyValue(key).trim(), name);

test('bảng chiến pháp: cột đúng artboard, đầu bảng một dòng, không ô nào tràn khung', async ({ page }) => {
  // Bề rộng nội dung (content-box, như artboard LookupTactics khai) của các cột; cột tên nhận phần còn lại.
  const declared = [60, 120, 230, 200, 80];
  for (const width of [1440, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await openLookup(page, '/tra-cuu/chien-phap/');
    await expect(lookup(page).locator('.lookup-table tbody tr').first()).toBeVisible();
    const headers = lookup(page).locator('.lookup-table thead th');
    for (const [index, expected] of declared.entries()) {
      const contentWidth = await headers.nth(index + 1).evaluate((node) => {
        const style = getComputedStyle(node);
        return node.getBoundingClientRect().width
          - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
          - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth);
      });
      expect(Math.abs(contentWidth - expected)).toBeLessThanOrEqual(2);
      expect(await lineBoxes(headers.nth(index + 1))).toBe(1);
    }
    expect(await lineBoxes(headers.nth(0))).toBe(1);
    // Không ô nào (đầu bảng hay thân bảng) tràn ra ngoài khung panel.
    const overflow = await page.evaluate(() => {
      const frame = document.querySelector('#section-lookup .lookup-table-panel').getBoundingClientRect();
      return [...document.querySelectorAll('#section-lookup .lookup-table thead th, #section-lookup .lookup-table tbody tr:first-child > *')]
        .filter((cell) => cell.getBoundingClientRect().right > frame.right + 1 || cell.scrollWidth > cell.clientWidth + 1)
        .map((cell) => cell.textContent.trim().slice(0, 20));
    });
    expect(overflow).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
});

test('tỷ lệ kích hoạt trong bảng và hồ sơ không lộ số thập phân dài hay giá trị vô lý', async ({ page }) => {
  await openLookup(page, '/tra-cuu/chien-phap/');
  await expect(lookup(page).locator('.lookup-table tbody tr').first()).toBeVisible();
  const rates = await lookup(page).locator('.lookup-table tbody .lookup-table-rate').allTextContents();
  expect(rates.length).toBeGreaterThan(20);
  for (const text of rates) {
    expect(text).not.toMatch(/\d\.\d{6,}/);
    expect(text).toMatch(/^(—|\d+(?:\.\d)?%)$/);
    if (text !== '—') expect(Number.parseFloat(text)).toBeLessThanOrEqual(100);
  }
  // Thiên Uy Khiếu Trận: nguồn ghi 50 (thang phần trăm, hiệu chỉnh đã review thành 0.5); client Global ghi 55% nên hiện 55%.
  // Nhánh gạch ngang cho giá trị ngoài 0–1 vẫn được unit test ratePercentText (50 / −1) phủ.
  await openLookup(page, '/tra-cuu/chien-phap/?id=tactic%3Athien-uy-khieu-tran');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Tỷ lệ kích hoạt');
  const profile = await dialog.textContent();
  expect(profile).not.toMatch(/\d\.\d{6,}/);
  expect(profile).not.toContain('5000');
  await expect(dialog.locator('.lookup-tactic-tile', { hasText: 'Tỷ lệ kích hoạt' }).first()).toContainText('55%');
});

test('cách nhận hiện tên sự kiện, ẩn mã trích dẫn bsn của nguồn', async ({ page }) => {
  await openLookup(page, '/tra-cuu/chien-phap/?id=tactic%3Akien-cuong-chi-hoa');
  // Chiến pháp tự mang của CO Đại Kiều: thẻ tướng không được che mất cách nhận qua sự kiện.
  const fact = page.getByRole('dialog').locator('.lookup-tactic-source');
  await expect(fact.locator('.lookup-source-hero')).toContainText('Đại Kiều');
  await expect(fact.locator('.lookup-source-acquired')).toHaveText('Sự kiện liên động Chân Tam Quốc Vô Song máy chủ Đài Loan');
  expect(await fact.textContent()).not.toContain('bsn=');
});

test('chi phí công trình không in null hay khóa thô, ô rỗng hiện gạch ngang', async ({ page }) => {
  for (const id of ['building%3Athai-thach-xu', 'building%3Aquan-xa']) {
    await openLookup(page, `/tra-cuu/cong-trinh/?id=${id}`);
    await expect(panel(page).locator('.lookup-levels-table')).toBeVisible();
    const text = await panel(page).textContent();
    expect(text).not.toMatch(/\b(?:null|undefined|NaN)\b/);
    expect(text).not.toMatch(/\b(?:wood|stone|iron|food)\b/);
  }
  // Thái Thạch Xứ: Đá là null trong dữ liệu nên ô Đá là gạch ngang, Gỗ và Sắt có số.
  await openLookup(page, '/tra-cuu/cong-trinh/?id=building%3Athai-thach-xu');
  const level = panel(page).locator('.lookup-level-row').first();
  await expect(level.locator('td[data-label="Gỗ"]')).toHaveText('180');
  await expect(level.locator('td[data-label="Sắt"]')).toHaveText('180');
  await expect(level.locator('td[data-label="Đá"]')).toHaveText('—');
  await expect(level.locator('.lookup-level-effect')).toContainText('Sản lượng đá');
  // Quân Xá: cấp 1 chỉ có hiệu ứng, không có chi phí nào dùng được; dòng tổng chỉ cộng các ô có số.
  await openLookup(page, '/tra-cuu/cong-trinh/?id=building%3Aquan-xa');
  const first = panel(page).locator('.lookup-level-row').first();
  await expect(first).toContainText('bố trí 1 bộ đội');
  for (const label of ['Gỗ', 'Đá', 'Sắt']) await expect(first.locator(`td[data-label="${label}"]`)).toHaveText('—');
  await expect(panel(page).locator('.lookup-detail-footnote')).not.toContainText(/null|undefined|NaN/);
});

for (const theme of ['light', 'dark']) {
  test(`ô thích tính bậc S và badge hồ sơ dùng đúng cặp token ở nền ${theme}`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
    await openLookup(page, '/tra-cuu/tuong/?id=hero%3Asp-lu-mong');
    await expect(page.getByRole('dialog')).toBeVisible();
    const soft = tokenRgb(await tokenValue(page, '--accent-soft'));
    const ink = tokenRgb(await tokenValue(page, '--accent-ink'));
    const panel3 = tokenRgb(await tokenValue(page, '--panel-3'));
    const ink2 = tokenRgb(await tokenValue(page, '--ink-2'));
    const band = tokenRgb(await tokenValue(page, '--band'));
    const bandInk = tokenRgb(await tokenValue(page, '--band-ink'));
    const panel2 = tokenRgb(await tokenValue(page, '--panel-2'));
    const tiles = await lookup(page).locator('.lookup-aptitude').evaluateAll((nodes) => nodes.map((node) => {
      const grade = node.querySelector('.lookup-aptitude-grade');
      return { grade: node.dataset.grade, background: getComputedStyle(node).backgroundColor, color: getComputedStyle(grade).color };
    }));
    expect(tiles.length).toBeGreaterThanOrEqual(5);
    expect(tiles.filter((tile) => tile.grade === 'S').length).toBeGreaterThan(0);
    for (const tile of tiles) {
      if (tile.grade === 'S') {
        expect(tile.background).toBe(soft);
        expect(tile.color).toBe(ink);
      } else {
        expect(tile.background).toBe(panel3);
        expect(tile.color).toBe(ink2);
      }
    }
    // Badge đầu hồ sơ: viên 26px, nền không trong suốt (nhãn SP nền dải, còn lại nền giấy đậm).
    const badges = await lookup(page).locator('.lookup-dialog-badges > *').evaluateAll((nodes) => nodes.map((node) => {
      const style = getComputedStyle(node);
      return { text: node.textContent.trim(), background: style.backgroundColor, color: style.color, height: Math.round(node.getBoundingClientRect().height) };
    }));
    expect(badges.map((badge) => badge.text)).toEqual(['SP', 'Ngô', '5 sao', 'Thống ngự 7', 'Quân sự']);
    expect(badges[0].background).toBe(band);
    expect(badges[0].color).toBe(bandInk);
    for (const badge of badges.slice(2)) {
      expect(badge.background).toBe(panel2);
      expect(badge.color).toBe(ink2);
      expect(badge.height).toBe(26);
    }
    // Hộp thoại chiến pháp: phẩm dùng đúng viên hồng như bảng.
    await openLookup(page, '/tra-cuu/chien-phap/?id=tactic%3Aan-ui-quan-dan');
    const quality = lookup(page).locator('.lookup-dialog-badges .badge-accent');
    await expect(quality).toHaveText('Phẩm S');
    expect(Math.round(await quality.evaluate((node) => node.getBoundingClientRect().height))).toBe(26);
    expect(await quality.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(soft);
    expect(await quality.evaluate((node) => getComputedStyle(node).color)).toBe(ink);
  });
}

test('thanh nhóm một hàng ở mọi bề rộng: nhóm đang xem luôn trong khung, mép còn mục khuất thì mờ', async ({ page }) => {
  const rail = (page) => page.evaluate(() => {
    const nav = document.querySelector('#section-lookup .lookup-chips');
    const box = nav.getBoundingClientRect();
    const chips = [...nav.querySelectorAll('.lookup-chip')].map((node) => node.getBoundingClientRect());
    const current = nav.querySelector('.lookup-chip[aria-current="page"]').getBoundingClientRect();
    const search = document.querySelector('#section-lookup .lookup-search').getBoundingClientRect();
    return {
      rows: new Set(chips.map((chip) => Math.round(chip.top))).size,
      currentInside: current.left >= box.left - 1 && current.right <= box.right + 1,
      overflowing: nav.scrollWidth > nav.clientWidth + 1,
      fade: nav.dataset.fade ?? null,
      gap: Math.round(box.top - search.bottom),
      pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  // Công trình là nhóm thứ sáu: ở bề rộng hẹp nó chỉ lọt khung nếu thanh đã cuộn tới nó.
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await openLookup(page, '/tra-cuu/cong-trinh/');
    const state = await rail(page);
    expect(state.rows, `${width}`).toBe(1);
    expect(state.currentInside, `${width}`).toBe(true);
    expect(state.pageOverflow, `${width}`).toBe(false);
    expect(state.gap, `${width}`).toBe(width <= 680 ? 16 : 24);
    if (state.overflowing) expect(state.fade, `${width}`).toMatch(/^(start|end|both)$/);
    else expect(state.fade, `${width}`).toBeNull();
  }
  // Cuộn hết về đầu thì chỉ còn mép phải mờ.
  await page.setViewportSize({ width: 390, height: 844 });
  await openLookup(page, '/tra-cuu/cong-trinh/');
  await lookup(page).locator('.lookup-chips').evaluate((nav) => { nav.scrollLeft = 0; nav.dispatchEvent(new Event('scroll')); });
  await expect(lookup(page).locator('.lookup-chips')).toHaveAttribute('data-fade', 'end');

  // Mobile: viên bo tròn, viên đang xem nền chọn + chữ chọn (cả số đếm), viên khác nền giấy.
  const band = tokenRgb(await tokenValue(page, '--band'));
  const bandInk = tokenRgb(await tokenValue(page, '--band-ink'));
  const panel3 = tokenRgb(await tokenValue(page, '--panel-3'));
  const selected = await lookup(page).locator('.lookup-chip[aria-current="page"]').evaluate((node) => ({
    radius: getComputedStyle(node).borderRadius,
    background: getComputedStyle(node).backgroundColor,
    color: getComputedStyle(node).color,
    count: getComputedStyle(node.querySelector('.lookup-chip-count')).color,
  }));
  expect(selected.radius).toBe('999px');
  expect(selected.background).toBe(band);
  expect(selected.color).toBe(bandInk);
  expect(selected.count).toBe(bandInk);
  const idle = await lookup(page).locator('.lookup-chip:not([aria-current])').first().evaluate((node) => ({
    radius: getComputedStyle(node).borderRadius,
    background: getComputedStyle(node).backgroundColor,
  }));
  expect(idle.radius).toBe('999px');
  expect(idle.background).toBe(panel3);
});

test('thẻ tướng có dòng phụ Thống ngự; nhãn facts một dòng; chỉ số mobile gắn thanh với tăng trưởng', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openLookup(page, '/tra-cuu/tuong/');
  const card = lookup(page).locator('.lookup-card').filter({ hasText: 'SP Lữ Mông' }).first();
  await expect(card.locator('.lookup-card-meta')).toContainText('Thống ngự 7');

  await openLookup(page, '/tra-cuu/tuong/?id=hero%3Asp-lu-mong');
  await expect(page.getByRole('dialog')).toBeVisible();
  const label = lookup(page).locator('.lookup-fact', { hasText: 'Danh hiệu độc quyền' }).first().locator('.lookup-fact-key');
  expect(await lineBoxes(label)).toBe(1);

  await page.setViewportSize({ width: 390, height: 844 });
  await openLookup(page, '/tra-cuu/tuong/?id=hero%3Asp-lu-mong');
  await expect(page.getByRole('dialog')).toBeVisible();
  const stats = await lookup(page).locator('.lookup-stat').evaluateAll((nodes) => nodes.map((node) => {
    const bar = node.querySelector('.lookup-stat-bar').getBoundingClientRect();
    const growth = node.querySelector('.lookup-stat-growth').getBoundingClientRect();
    return {
      barTop: Math.round(bar.top), growthTop: Math.round(growth.top),
      barRight: Math.round(bar.right), growthLeft: Math.round(growth.left),
      barWidth: Math.round(bar.width), rowWidth: Math.round(node.getBoundingClientRect().width),
    };
  }));
  expect(stats.length).toBeGreaterThanOrEqual(5);
  for (const stat of stats) {
    // Tăng trưởng nằm cạnh mép thanh (không lọt vào cột nhãn) và cùng hàng với thanh.
    expect(stat.growthLeft).toBeGreaterThanOrEqual(stat.barRight - 1);
    expect(Math.abs(stat.barTop - stat.growthTop)).toBeLessThanOrEqual(8);
    expect(stat.barWidth).toBeGreaterThan(stat.rowWidth / 2);
  }
});

test('chip nhóm mobile đủ 44px và chữ căn giữa ở 390/320 × 2 theme (P10-B1/P07-R1)', async ({ page }) => {
  const measure = (page) => page.evaluate(() => [...document.querySelectorAll('#section-lookup .lookup-chip')].map((node) => {
    const text = [...node.childNodes].find((child) => child.nodeType === 3 && child.textContent.trim());
    const range = document.createRange();
    range.selectNodeContents(text ?? node);
    const textBox = range.getBoundingClientRect();
    const box = node.getBoundingClientRect();
    return {
      text: node.textContent.trim().slice(0, 14),
      height: Math.round(box.height),
      topGap: Math.round(textBox.top - box.top),
      bottomGap: Math.round(box.bottom - textBox.bottom),
    };
  }));
  for (const width of [390, 320]) {
    for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 844 });
      await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
      await openLookup(page, '/tra-cuu/chien-phap/');
      await expect(lookup(page).locator('.lookup-chip').first()).toBeVisible();
      const chips = await measure(page);
      expect(chips.length, `${width}/${theme}`).toBe(GROUPS.length);
      for (const chip of chips) {
        expect(chip.height, `${width}/${theme} ${chip.text}`).toBeGreaterThanOrEqual(44);
        expect(Math.abs(chip.topGap - chip.bottomGap), `${width}/${theme} ${chip.text}`).toBeLessThanOrEqual(1);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    }
  }
});

test('hàng đội tiêu biểu: cả hàng là vùng bấm của link đội (P07-R2)', async ({ page }) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await openLookup(page, '/tra-cuu/tuong/?id=hero%3Asp-lu-mong');
    await expect(lookup(page).locator('.cam-nang-teams')).toBeVisible();
    const rows = lookup(page).locator('.cam-nang-team');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let index = 0; index < count; index += 1) {
      // Khối nằm dưới màn hình: cuộn hàng vào khung nhìn trước khi dò điểm bấm.
      await rows.nth(index).scrollIntoViewIfNeeded();
      const hit = await rows.nth(index).evaluate((node) => {
        const link = node.querySelector('.cam-nang-team-name');
        const score = node.querySelector('.cam-nang-team-score');
        const box = score.getBoundingClientRect();
        const point = { x: Math.round(box.left + box.width * 0.8), y: Math.round(box.top + box.height * 0.8) };
        const resolved = document.elementFromPoint(point.x, point.y);
        return { height: Math.round(node.getBoundingClientRect().height), sameLink: resolved === link || link?.contains(resolved) === true };
      });
      expect(hit.height, `${width}: chiều cao hàng`).toBeGreaterThanOrEqual(44);
      expect(hit.sameLink, `${width}: điểm ở ô điểm trỏ về link đội`).toBe(true);
    }
    // Bấm ở vùng điểm vẫn điều hướng tới trang đội và giữ `from` mở lại hồ sơ.
    await rows.first().scrollIntoViewIfNeeded();
    const first = rows.first().locator('.cam-nang-team-name');
    const href = await first.getAttribute('href');
    const box = await rows.first().locator('.cam-nang-team-score').boundingBox();
    await page.mouse.click(box.x + box.width * 0.8, box.y + box.height * 0.8);
    await expect(page).toHaveURL(new RegExp(href.split('?')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    expect(new URL(page.url()).searchParams.get('from')).toContain('id=hero%3Asp-lu-mong');
  }
});

/* ---------- Phase 3: nhóm lọc tách khỏi hồ sơ, Back/đóng, focus Xem thêm ---------- */

test('Xem thêm hai lần, mở thẻ thứ 150 rồi Back giữ 180 thẻ và focus thẻ vừa mở', async ({ page }) => {
  await openLookup(page, '/tra-cuu/tuong/');
  const more = lookup(page).getByRole('button', { name: 'Xem thêm' });
  await more.click();
  await expect(cards(page)).toHaveCount(120);
  await more.click();
  await expect(cards(page)).toHaveCount(180);
  const opener = cards(page).nth(149).locator('[data-lookup-id]');
  const openedId = await opener.getAttribute('data-lookup-id');
  await opener.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(cards(page)).toHaveCount(180);
  await expect(lookup(page).locator(`[data-lookup-id="${openedId}"]`)).toBeFocused();
});

test('đóng hồ sơ bằng nút X rồi một lần Back về đúng trang nhóm trước khi mở', async ({ page }) => {
  await openLookup(page, '/tra-cuu/tuong/');
  await chip(page, 'tactics').click();
  await expect(page).toHaveURL('/tra-cuu/chien-phap/');
  await expect(page.locator('body[data-boot="ready"]')).toBeAttached();
  await firstResult(page).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Đóng hồ sơ' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL('/tra-cuu/chien-phap/');
  await page.goBack();
  await expect(page).toHaveURL('/tra-cuu/tuong/');
  await expect(currentChip(page)).toHaveAttribute('data-group', 'heroes');
});

test('Enter trên Xem thêm đưa focus tới thẻ đầu của lượt mới', async ({ page }) => {
  await openLookup(page, '/tra-cuu/tuong/');
  await lookup(page).getByRole('button', { name: 'Xem thêm' }).focus();
  await page.keyboard.press('Enter');
  await expect(cards(page)).toHaveCount(120);
  await expect(cards(page).nth(60).locator('[data-lookup-id]')).toBeFocused();
});

test('số đội chuẩn trong Trong cẩm nang là chữ, link chữ vẫn dẫn sang Đội chuẩn', async ({ page }) => {
  await openLookup(page, '/tra-cuu/tuong/?id=hero%3Achu-du');
  const block = page.getByRole('dialog').locator('.cam-nang');
  await expect(block.locator('.cam-nang-counts')).toBeVisible();
  await expect(block.locator('.cam-nang-counts a')).toHaveCount(0);
  await expect(block.getByRole('link', { name: 'Tìm tướng này trong Đội chuẩn' })).toBeVisible();
});

test('hồ sơ tướng hiện Điểm nội chính khi dữ liệu có', async ({ page }) => {
  await openLookup(page, '/tra-cuu/tuong/?id=hero%3Aluu-bi');
  const fact = page.getByRole('dialog').locator('.lookup-dialog-facts .lookup-fact').filter({ hasText: 'Điểm nội chính' });
  await expect(fact).toHaveCount(1);
  await expect(fact.locator('dd')).toHaveText('0');
});

test('nút đóng hồ sơ vẫn trong màn hình khi cuộn hộp thoại trên mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openLookup(page, '/tra-cuu/tuong/?id=hero%3Atao-thao');
  await expect(page.getByRole('dialog')).toBeVisible();
  const scrolled = await page.locator('.lookup-backdrop').evaluate((node) => { node.scrollTop = 1500; return node.scrollTop; });
  expect(scrolled).toBeGreaterThan(500);
  const box = await page.getByRole('button', { name: 'Đóng hồ sơ' }).boundingBox();
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(812);
});

/* ---------- Bốn nhóm catalog: danh sách + chi tiết (Trang bị, Quân sư, Cải tạo binh chủng, Công trình) ---------- */

test.describe('danh sách + chi tiết của bốn nhóm catalog', () => {
  test('HTML dựng sẵn đã có đủ mọi mục, chip lọc và chi tiết của mục đầu (không cần JS)', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    for (const group of ['equipment', 'advisors', 'troop-mods', 'buildings']) {
      const items = ITEM_TOTAL[group];
      await page.goto(GROUP_PATH[group]);
      await expect(lookup(page).locator('.lookup-master-item')).toHaveCount(items);
      await expect(selectedItem(page)).toHaveCount(1);
      await expect(selectedItem(page)).toHaveAttribute('data-lookup-id', await lookup(page).locator('.lookup-master-item').first().getAttribute('data-lookup-id'));
      await expect(panel(page).locator('.lookup-detail-title')).not.toBeEmpty();
      await expect(lookup(page).locator('.lookup-filters button')).not.toHaveCount(0);
      await expect(lookup(page).locator('.lookup-dialog')).toHaveCount(0);
    }
    await context.close();
  });

  test('bấm một mục đổi chi tiết và mục đang chọn, Back về mục trước; không mở hộp thoại', async ({ page }) => {
    await openLookup(page, GROUP_PATH.equipment);
    const first = await selectedItem(page).getAttribute('data-lookup-id');
    const second = lookup(page).locator('.lookup-master-item').nth(1);
    const secondId = await second.getAttribute('data-lookup-id');
    const secondName = await second.locator('.lookup-eq-name').textContent();
    await second.click();
    await expect(page).toHaveURL(`${GROUP_PATH.equipment}?id=${encodeURIComponent(secondId)}`);
    await expect(selectedItem(page)).toHaveAttribute('data-lookup-id', secondId);
    await expect(panel(page).locator('.lookup-detail-title')).toHaveText(secondName);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.goBack();
    await expect(page).toHaveURL(GROUP_PATH.equipment);
    await expect(selectedItem(page)).toHaveAttribute('data-lookup-id', first);
  });

  test('Xem thêm nối thêm một lượt thẻ trang bị/quân sư, giữ mục đang chọn và đưa focus tới thẻ đầu lượt mới', async ({ page }) => {
    await openLookup(page, GROUP_PATH.equipment);
    const items = lookup(page).locator('.lookup-master-item');
    await expect(items).toHaveCount(24);
    const selected = await selectedItem(page).getAttribute('data-lookup-id');
    await lookup(page).getByRole('button', { name: 'Xem thêm' }).click();
    await expect(items).toHaveCount(48);
    await expect(items.nth(24)).toBeFocused();
    await expect(selectedItem(page)).toHaveAttribute('data-lookup-id', selected);
    await expect(lookup(page).locator('.lookup-more-note')).toHaveText('Mỗi lượt hiện 24 kết quả');
    await openLookup(page, GROUP_PATH.advisors);
    await expect(items).toHaveCount(18);
    await lookup(page).getByRole('button', { name: 'Xem thêm' }).click();
    await expect(items).toHaveCount(36);
  });

  test('chip lọc trang bị: ô và phẩm giao nhau, bấm lại để tắt, Tất cả bỏ lọc', async ({ page }) => {
    await openLookup(page, GROUP_PATH.equipment);
    const facet = (key, value) => lookup(page).locator(`button[data-facet="${key}"][data-value="${value}"]`);
    const summary = lookup(page).locator('.lookup-summary');
    await expect(summary).toContainText(/^114 trang bị/);
    await expect(facet('slot', '')).toHaveAttribute('aria-pressed', 'true');
    await facet('slot', 'Vũ khí').click();
    await expect(facet('slot', 'Vũ khí')).toHaveAttribute('aria-pressed', 'true');
    await expect(facet('slot', '')).toHaveAttribute('aria-pressed', 'false');
    await expect(summary).toContainText(/^31 vũ khí/);
    await expect(lookup(page).locator('.lookup-eq-card')).toHaveCount(24);
    await facet('quality', 'Tím').click();
    await expect(summary).toContainText(/^6 vũ khí/);
    await expect(lookup(page).locator('.lookup-eq-card')).toHaveCount(6);
    await facet('quality', 'Tím').click();
    await expect(facet('quality', 'Tím')).toHaveAttribute('aria-pressed', 'false');
    await expect(summary).toContainText(/^31 vũ khí/);
    await facet('slot', '').click();
    await expect(summary).toContainText(/^114 trang bị/);
  });

  test('chip hệ của quân sư lọc danh sách và dòng trạng thái', async ({ page }) => {
    await openLookup(page, GROUP_PATH.advisors);
    await lookup(page).locator('button[data-facet="element"][data-value="Sơn"]').click();
    await expect(lookup(page).locator('.lookup-summary')).toContainText(/^11 kỹ năng quân sư/);
    await expect(lookup(page).locator('.lookup-adv-card')).toHaveCount(11);
    for (const meta of await lookup(page).locator('.lookup-adv-card .lookup-adv-meta').allTextContents()) expect(meta).toMatch(/hệ Sơn$/);
  });

  test('mã đặc kỹ mở trang bị cha; đặc kỹ chung và mồ côi vẫn mở được; mã lạ báo đang cập nhật', async ({ page }) => {
    await openLookup(page, `${GROUP_PATH.equipment}?id=equipment-special%3Agian-hung`);
    await expect(panel(page).locator('.lookup-special.is-target')).toContainText('Gian Hùng');
    await expect(panel(page).locator('.lookup-special.is-target')).toContainText('Tào Tháo');
    await expect(panel(page).locator('.lookup-special.is-target a.lookup-detail-link')).toHaveAttribute('href', itemPath('heroes', 'hero:tao-thao'));
    await openLookup(page, `${GROUP_PATH.equipment}?id=equipment-special%3Aphu-chu`);
    await expect(panel(page).locator('.lookup-detail-title')).toHaveText('Phù Chú');
    await openLookup(page, `${GROUP_PATH.equipment}?id=equipment%3Akhong-co`);
    await expect(lookup(page).locator('[role="alert"]')).toHaveText('Mục tra cứu đang được cập nhật.');
  });

  test('đặc kỹ độc quyền xếp bậc mạnh trước và đặc kỹ chung liệt kê đủ bậc T1–T3', async ({ page }) => {
    await openLookup(page, `${GROUP_PATH.equipment}?id=equipment%3Ay-thien-kiem`);
    await expect(panel(page).locator('.lookup-eq-exclusive .badge-tier').first()).toHaveText('T0');
    const tiers = await panel(page).locator('.lookup-eq-common .badge-tier').allTextContents();
    expect(tiers.length).toBeGreaterThan(5);
    expect([...tiers].sort()).toEqual(tiers);
    expect(new Set(tiers)).toEqual(new Set(['T1', 'T2', 'T3']));
    await expect(panel(page).locator('.lookup-eq-common .lookup-detail-footnote')).toContainText(`${tiers.length} đặc kỹ chung`);
  });

  test('cải tạo binh chủng: nhóm theo binh chủng, một bản client (không đổi phiên bản), đánh dấu lộ trình gợi ý', async ({ page }) => {
    await openLookup(page, `${GROUP_PATH['troop-mods']}?id=troop-mod%3Adan-duong-binh`);
    const groups = lookup(page).locator('.lookup-row-group-title');
    await expect(groups).toHaveCount(4);
    await expect(groups.first()).toContainText('Khiên binh');
    // Tên và hướng dẫn theo client Global (tên cũ "Đan Dương Binh" thành tên khác).
    await expect(selectedItem(page)).toContainText('Lính Đan Dương');
    await expect(panel(page).locator('.lookup-option-card')).toHaveCount(12);
    // Lộ trình gợi ý (SGSDeck) ghi "Chuyển·Cầm Thương", lựa chọn client tên "Chuyển.Thương": chỉ 3 lựa chọn khớp tên.
    await expect(panel(page).locator('.lookup-option-card.is-suggested')).toHaveCount(3);
    await expect(panel(page).locator('.lookup-option-card.is-suggested .badge-suggest')).toHaveCount(3);
    await expect(panel(page).locator('[data-effect-tab]')).toHaveCount(0);
    await expect(panel(page).locator('.lookup-effect-text:not([hidden])')).toHaveCount(1);
    // Mục không có gợi ý build thì không đánh dấu và không có thanh gợi ý.
    await openLookup(page, `${GROUP_PATH['troop-mods']}?id=troop-mod%3Aho-bao-ky`);
    await expect(panel(page).locator('.lookup-option-card.is-suggested')).toHaveCount(0);
    await expect(panel(page).locator('.lookup-build-bar')).toHaveCount(0);
  });

  test('công trình: ô số liệu, bảng theo cấp tăng dần, cấp cuối nổi và tổng tài nguyên', async ({ page }) => {
    await openLookup(page, `${GROUP_PATH.buildings}?id=building%3Abat-tran-do`);
    await expect(panel(page).locator('.lookup-stat-tile')).toHaveCount(4);
    const rows = panel(page).locator('.lookup-level-row');
    await expect(rows).toHaveCount(5);
    await expect(rows.first().locator('th')).toHaveText('1');
    await expect(rows.last().locator('th')).toHaveText('5');
    await expect(rows.last()).toHaveClass(/is-max/);
    await expect(rows.last().locator('td[data-label="Gỗ"]')).toHaveText('480.000');
    await expect(panel(page).locator('.lookup-detail-footnote')).toContainText('Tổng tài nguyên lên cấp 5: gỗ 1.024.000 · đá 1.024.000 · sắt 512.000');
  });

  test('mobile: danh sách một cột, mở mục thành màn chi tiết có nút quay lại và trả focus về mục đã mở', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openLookup(page, GROUP_PATH.buildings);
    await expect(panel(page)).toBeHidden();
    const opener = lookup(page).locator('.lookup-master-item').nth(3);
    const openerId = await opener.getAttribute('data-lookup-id');
    await opener.click();
    await expect(page.locator('#section-lookup')).toHaveAttribute('data-lookup-detail-open', 'true');
    await expect(panel(page)).toBeVisible();
    await expect(lookup(page).locator('.lookup-master-list')).toBeHidden();
    await expect(lookup(page).locator('.lookup-detail-back')).toBeFocused();
    await lookup(page).locator('.lookup-detail-back').click();
    await expect(page).toHaveURL(GROUP_PATH.buildings);
    await expect(lookup(page).locator('.lookup-master-list')).toBeVisible();
    await expect(lookup(page).locator(`[data-lookup-id="${openerId}"]`)).toBeFocused();
    // Back của trình duyệt cũng đóng màn chi tiết.
    await opener.click();
    await expect(panel(page)).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(GROUP_PATH.buildings);
    await expect(panel(page)).toBeHidden();
  });

  test('bản zh: danh sách và chi tiết dùng chữ Hán, không lọt chữ Việt của dữ liệu', async ({ page }) => {
    const VIETNAMESE = /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i;
    for (const url of [
      '/zh/tra-cuu/trang-bi/?id=equipment%3Ay-thien-kiem',
      '/zh/tra-cuu/quan-su/',
      '/zh/tra-cuu/cai-tao-binh-chung/?id=troop-mod%3Adan-duong-binh',
      '/zh/tra-cuu/cong-trinh/?id=building%3Abat-tran-do',
    ]) {
      await page.goto(url);
      await expect(page.locator('body[data-boot="ready"]')).toBeAttached();
      await expect(lookup(page).locator('.lookup-master-item').first()).toBeVisible();
      const text = `${await lookup(page).locator('.lookup-master').textContent()}`;
      expect(text, url).not.toMatch(VIETNAMESE);
      expect(text, url).toMatch(CJK);
      await expect(panel(page).locator('.lookup-detail-title')).toHaveText(CJK);
    }
  });
});

/* ---------- Hợp đồng hiệu năng: mỗi trang nhóm chỉ tải payload của nhóm mình ---------- */

test.describe('tải dữ liệu theo trang nhóm', () => {
  /** Payload `/data/*.json` (bỏ `/data/recommended/`) mỗi trang nhóm được tải trước khi boot xong. */
  const BOOT_DATA = {
    heroes: ['website-display.json', 'lookup-manifest.json', 'heroes-dict.json'],
    tactics: ['website-display.json', 'lookup-manifest.json', 'tactics.json'],
    equipment: ['website-display.json', 'lookup-manifest.json', 'lookup-catalog.json'],
    advisors: ['website-display.json', 'lookup-manifest.json', 'lookup-catalog.json'],
    'troop-mods': ['website-display.json', 'lookup-manifest.json', 'lookup-catalog.json'],
    buildings: ['website-display.json', 'lookup-manifest.json', 'lookup-catalog.json'],
    books: ['website-display.json', 'books-dict.json'],
  };

  /** Ghi lại tên file của mọi request `/data/*.json` cấp đầu (không tính generation `/data/recommended/`). */
  function recordData(page) {
    const names = [];
    page.on('request', (request) => {
      const { pathname } = new URL(request.url());
      if (/^\/data\/[^/]+\.json$/.test(pathname)) names.push(pathname.slice('/data/'.length));
    });
    return names;
  }

  for (const prefix of ['', '/zh']) {
    for (const group of GROUPS) {
      test(`${prefix || '/vi'} ${group}: chỉ tải ${BOOT_DATA[group].join(', ')} khi vào trang`, async ({ page }) => {
        const names = recordData(page);
        await page.goto(`${prefix}${GROUP_PATH[group]}`);
        await expect(page.locator('body[data-boot="ready"]')).toBeAttached();
        await expect(lookup(page).locator('[data-lookup-id]').first()).toBeVisible();
        expect([...names].sort()).toEqual([...BOOT_DATA[group]].sort());
      });
    }

    test(`${prefix || '/vi'} mục lục Tra cứu không tải /data/ nào`, async ({ page }) => {
      const requested = [];
      page.on('request', (request) => { if (new URL(request.url()).pathname.startsWith('/data/')) requested.push(request.url()); });
      await page.goto(`${prefix}/tra-cuu/`);
      await expect(lookup(page).locator('a.lookup-hub-card')).toHaveCount(GROUPS.length);
      await page.waitForLoadState('networkidle');
      expect(requested).toEqual([]);
    });
  }

  test('mở hồ sơ tướng mới tải chiến pháp + danh mục; mở hồ sơ chiến pháp mới tải tướng', async ({ page }) => {
    const names = recordData(page);
    await page.goto(GROUP_PATH.heroes);
    await expect(page.locator('body[data-boot="ready"]')).toBeAttached();
    const booted = names.length;
    await firstResult(page).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect.poll(() => names.slice(booted).sort()).toEqual(['lookup-catalog.json', 'tactics.json']);

    names.length = 0;
    await page.goto(GROUP_PATH.tactics);
    await expect(page.locator('body[data-boot="ready"]')).toBeAttached();
    expect(names).not.toContain('heroes-dict.json');
    const tacticsBooted = names.length;
    await firstResult(page).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect.poll(() => names.slice(tacticsBooted)).toEqual(['heroes-dict.json']);
  });

  test('HTML dựng sẵn của trang Tướng có đủ mọi mục; chỉ 60 mục đầu hiện khi có JavaScript, phần còn lại chờ Xem thêm', async ({ request }) => {
    const html = await (await request.get(GROUP_PATH.heroes)).text();
    expect(html.match(/data-lookup-id="/g)).toHaveLength(ITEM_TOTAL.heroes);
    expect(html.match(/data-lookup-later/g)).toHaveLength(ITEM_TOTAL.heroes - 60);
    const heroes = await (await request.get('/data/heroes-dict.json')).json();
    const total = Number(html.match(/data-lookup-total="(\d+)"/)?.[1]);
    expect(total).toBe(ITEM_TOTAL.heroes);
    expect(total).toBeLessThanOrEqual(heroes.length);
    expect(html).toContain('class="lookup-more');
  });

  test('link cũ ?group=tactics&id= qua mục lục tới trang Chiến pháp và mở hồ sơ', async ({ page, request }) => {
    const tactics = await (await request.get('/data/tactics.json')).json();
    const id = tactics.find((row) => typeof row.id === 'string' && row.id.startsWith('tactic:')).id;
    await page.goto(`/tra-cuu/?group=tactics&id=${encodeURIComponent(id)}`);
    await expect(page).toHaveURL(`/tra-cuu/chien-phap/?id=${encodeURIComponent(id)}`);
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(currentChip(page)).toHaveAttribute('data-group', 'tactics');
  });

  test('thẻ và tên chiến pháp dựng sẵn là link trang riêng: bấm khi app chưa chạy vẫn tới đúng trang của mục', async ({ page }) => {
    // Chặn app.js: trang chỉ còn HTML dựng lúc build, như lúc người dùng bấm trước khi app sẵn sàng.
    await page.route('**/js/app.js', (route) => route.abort());
    for (const [group, selector] of [['heroes', '.lookup-card-button'], ['tactics', '.lookup-table-name']]) {
      await page.goto(GROUP_PATH[group]);
      const first = lookup(page).locator(selector).first();
      const id = await first.getAttribute('data-lookup-id');
      await first.click();
      await expect(page).toHaveURL(itemPath(group, id));
      await expect(page.locator('h1')).toHaveCount(1);
    }
  });
});
