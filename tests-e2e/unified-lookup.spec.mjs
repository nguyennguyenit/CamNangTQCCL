// E2E giao diện Tra cứu hợp nhất: deep link sáu nhóm, alias không rewrite,
// phân trang quá 60, hộp thoại hồ sơ có focus trap, live region tiếng Việt,
// đồng thời giữ nguyên Team chuẩn mặc định, alias Team khác và history.
import { test, expect } from '@playwright/test';

/** Link điều hướng của mục: bảng desktop trong header hoặc menu mobile đang mở (footer cũng có link cùng tên). */
function navLink(page, name, mobile = false) {
  return (mobile ? page.locator('#section-menu-items') : page.locator('.site-nav')).getByRole('link', { name, exact: true });
}

const CJK = /[\u3400-\u9fff]/;
const GROUPS = ['heroes', 'tactics', 'equipment', 'advisors', 'troop-mods', 'buildings'];

const lookup = (page) => page.locator('#section-lookup');
const chip = (page, group) => lookup(page).locator(`.lookup-chip[data-group="${group}"]`);
const cards = (page) => lookup(page).locator('.lookup-card');
const results = (page) => lookup(page).locator('.lookup-card, .lookup-table-panel');
/** Nút mở hồ sơ của kết quả đầu tiên (thẻ tướng hoặc tên trong bảng chiến pháp). */
const firstResult = (page) => lookup(page).locator('[data-lookup-id]').first();
const groupResults = (page, group) => group === 'tactics' ? lookup(page).locator('.lookup-table tbody tr') : cards(page);

test('Tra cứu mở đúng trang mục và không tách lại hai bảng tra cứu cũ', async ({ page }) => {
  await page.goto('/tra-cuu/');
  await expect(navLink(page, 'Tra cứu', false)).toHaveAttribute('aria-current', 'page');
  await expect(lookup(page)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Tra cứu tướng' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Tra cứu chiến pháp' })).toHaveCount(0);
  await expect(page.locator('body')).toHaveAttribute('data-page-section', 'lookup');
  await expect(page.locator('.section')).toHaveCount(1);
});

test('nav link Tra cứu hỗ trợ điều hướng bằng bàn phím', async ({ page }) => {
  await page.goto('/doi-chuan/');
  const lookupLink = navLink(page, 'Tra cứu');
  await lookupLink.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/tra-cuu/');
  await expect(navLink(page, 'Tra cứu', false)).toHaveAttribute('aria-current', 'page');
});

test('sáu chip nhóm là nút có aria-pressed và deep link chọn đúng nhóm', async ({ page }) => {
  for (const group of GROUPS) {
    await page.goto(`/tra-cuu/?group=${group}`);
    await expect(lookup(page).getByRole('button', { pressed: true })).toHaveCount(1);
    await expect(chip(page, group)).toHaveAttribute('aria-pressed', 'true');
    await expect(groupResults(page, group).first()).toBeVisible();
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
  await navLink(page, 'Đội chuẩn').click();
  await expect(page).toHaveURL('/doi-chuan/');
  await navLink(page, 'Tra cứu').click();
  await expect(page).toHaveURL('/tra-cuu/');
  await expect(lookup(page).locator('.lookup-chip[aria-pressed="true"]')).toHaveCount(0);
  await expect(lookup(page).locator('[data-lookup-total]')).toContainText(/^\d+ (?:kết quả|tướng|chiến pháp|trang bị|quân sư|cải tạo binh chủng|công trình) · bấm/);
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
  await expect(results(page).first()).toBeVisible();
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

  await firstResult(page).click();
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
  await navLink(page, 'Tra cứu').click();
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
  // Ô chân dung luôn có chữ Hán dự phòng dưới ảnh; tên hiển thị của thẻ phải thuần Việt.
  expect(await cards(page).first().locator('.lookup-card-name').textContent()).not.toMatch(CJK);

  await search.fill('zzzqqq');
  const empty = lookup(page).locator('.lookup-feedback');
  await expect(empty).toBeVisible();
  await expect(empty).toContainText(/Không có kết quả/i);
});

test('hộp thoại hồ sơ bẫy focus, đóng bằng Escape và trả focus về thẻ mở', async ({ page }) => {
  await page.goto('/tra-cuu/?group=heroes');
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
  await page.goto('/tra-cuu/?group=equipment');
  await firstResult(page).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.locator('.lookup-backdrop').click({ position: { x: 5, y: 5 } });
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('hồ sơ tướng đi tới chiến pháp liên quan và cập nhật query theo ID', async ({ page }) => {
  await page.goto('/tra-cuu/?group=heroes');
  await lookup(page).getByRole('searchbox').fill('luu bi');
  await firstResult(page).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/tra-cuu\/\?group=heroes&id=hero%3A/);

  await dialog.locator('[data-lookup-relation]').first().click();
  await expect(page).toHaveURL(/\/tra-cuu\/\?group=tactics&id=tactic%3A/);
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('deep link tới một ID mở thẳng hồ sơ', async ({ page }) => {
  await page.goto('/tra-cuu/?group=heroes');
  await lookup(page).getByRole('searchbox').fill('luu bi');
  await firstResult(page).click();
  const deepLink = new URL(page.url()).search;
  await page.goto(`/tra-cuu/${deepLink}`);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page).toHaveURL(`/tra-cuu/${deepLink}`);
});

test('hồ sơ công trình hiện cấp, chi phí, thời gian và hiệu ứng', async ({ page }) => {
  await page.goto('/tra-cuu/?group=buildings');
  await firstResult(page).click();
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
      await expect(navLink(page, 'Tra cứu', width <= 820)).toHaveAttribute('aria-current', 'page');
      if (width <= 820) await page.locator('.site-menu-close').click();
      for (const group of GROUPS) {
        await chip(page, group).click();
        await expect(chip(page, group)).toHaveAttribute('aria-pressed', 'true');
        await expect(groupResults(page, group).first()).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
        await firstResult(page).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
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
  return [...new Set(heroes.map((hero) => hero.iconUrl).filter(Boolean).map((url) => new URL(url).host))];
}

test('mọi ảnh chân dung là https + no-referrer + lazy; thiếu iconUrl thì hiện chữ Hán', async ({ page }) => {
  await page.goto('/tra-cuu/');
  await expect(cards(page)).toHaveCount(60);
  const portraits = await page.evaluate(() => [...document.querySelectorAll('#section-lookup .lookup-card img')].map((image) => ({
    src: image.getAttribute('src'), referrer: image.getAttribute('referrerpolicy'),
    loading: image.getAttribute('loading'), decoding: image.getAttribute('decoding'), alt: image.getAttribute('alt'),
  })));
  expect(portraits.length).toBeGreaterThan(0);
  for (const portrait of portraits) {
    expect(portrait.src).toMatch(/^https:\/\//);
    expect(portrait.referrer).toBe('no-referrer');
    expect(portrait.loading).toBe('lazy');
    expect(portrait.decoding).toBe('async');
    expect(portrait.alt.length).toBeGreaterThan(0);
  }
  // Trang đầu toàn tướng có ảnh; ô chữ Hán kiểm trên hồ sơ của tướng thiếu iconUrl (Chu Thương).
  await page.goto('/tra-cuu/?group=heroes&id=hero%3Achu-thuong');
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
  await page.goto('/tra-cuu/');
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
  await page.goto('/tra-cuu/');
  await expect(cards(page)).toHaveCount(60);
  expect(requested).toEqual([]);

  await firstResult(page).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect.poll(() => requested.length, { timeout: 15_000 }).toBeGreaterThan(0);
  expect(requested).toContain('manifest.json');
  expect(requested).toContain('hero-summaries.json');
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
  for (const [order, record] of index.records.entries()) {
    const holder = (record.heroes ?? []).find((item) => chineseKeys.has(strip(item.nameRaw)));
    if (!holder) continue;
    standard += 1;
    positions[roleIndex[holder.roleRaw]] += 1;
    for (const name of new Set((holder.tacticSlotsVi ?? []).filter(Boolean))) tactics.set(name, (tactics.get(name) ?? 0) + 1);
    representative.push({ family: 'recommended', name: record.displayNameVi, score: record.value, order });
  }
  for (const record of others.records) {
    const holder = (record.holders ?? []).find((item) => String(item.nameRaw ?? '').trim() === vietnameseKey);
    if (!holder) continue;
    other += 1;
    positions[(record.holders ?? []).indexOf(holder)] += 1;
    for (const name of new Set((holder.tacticSlotsRaw ?? []).filter(Boolean))) tactics.set(name, (tactics.get(name) ?? 0) + 1);
    representative.push({ family: 'other', name: record.name, score: null, order: representative.length });
  }
  expect(standard).toBeGreaterThan(0);
  expect(other).toBeGreaterThan(0);
  // Thứ tự hiển thị: điểm giảm dần rồi thứ tự nguồn (Đội chuẩn đứng trước khi cùng hạng).
  const topTactics = [...tactics.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  await page.goto(`/tra-cuu/?group=heroes&id=${encodeURIComponent(target)}`);
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
  const positionRows = lookup(page).locator('.cam-nang-card').first().locator('.cam-nang-bar');
  await expect(positionRows.nth(0).locator('.cam-nang-bar-value')).toHaveText(String(positions[0]));
  await expect(positionRows.nth(1).locator('.cam-nang-bar-value')).toHaveText(String(positions[1]));
  await expect(positionRows.nth(2).locator('.cam-nang-bar-value')).toHaveText(String(positions[2]));
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
  const profile = '/tra-cuu/?group=heroes&id=hero%3Asp-lu-mong';
  await page.goto(profile);
  await expect(lookup(page).locator('.cam-nang-grid')).toBeVisible();
  const team = lookup(page).locator('.cam-nang-team a').first();
  const href = await team.getAttribute('href');
  expect(href).toMatch(/^\/doi-chuan\/.+[?]from=/);
  await team.click();
  await expect(page).toHaveURL(/\/doi-chuan\//);
  await page.locator('.detail-back-link, .detail-back-row a').first().click();
  await expect(page).toHaveURL(new RegExp(`/tra-cuu/\\?group=heroes&id=hero%3Asp-lu-mong$`));
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('SP Lữ Mông');
});

test('link Tìm tướng này trong Đội chuẩn giữ season=all và q theo tên', async ({ page }) => {
  await page.goto('/tra-cuu/?group=heroes&id=hero%3Asp-lu-mong');
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
  await page.goto('/tra-cuu/?group=tactics');
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
    await page.goto('/tra-cuu/?group=tactics');
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
      await page.goto('/tra-cuu/?group=heroes&id=hero%3Asp-lu-mong');
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
    await page.goto('/tra-cuu/?group=heroes');
    await expect(lookup(page).locator('.lookup-chip[aria-pressed="true"]')).toBeVisible();
    const contrast = await page.evaluate(() => {
      const toRgb = (value) => value.match(/[\d.]+/g).slice(0, 3).map(Number);
      const lum = (rgb) => {
        const [r, g, b] = rgb.map((channel) => {
          const c = channel / 255;
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const chip = document.querySelector('#section-lookup .lookup-chip[aria-pressed="true"]');
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
    await expect(lookup(page).locator('.lookup-chip[aria-pressed="true"] .lookup-chip-count')).toBeVisible();
  });
}

test('thẻ chiến pháp và kết quả hỗn hợp không in enum loại thô', async ({ page }) => {
  await page.goto('/tra-cuu/?group=heroes&id=hero%3Asp-lu-mong');
  await expect(page.getByRole('dialog')).toBeVisible();
  const subs = await lookup(page).locator('.lookup-relation-sub').allTextContents();
  expect(subs.length).toBeGreaterThan(0);
  for (const text of subs) {
    expect(text).not.toMatch(/\b(?:ACTIVE|PASSIVE|COMMAND|INTERNAL|FORMATION|TROOP|BURST)\b/);
    expect(text).toMatch(/Chủ động|Bị động|Chỉ huy|Nội chính|Trận pháp|Binh chủng|Bùng nổ/);
  }
  // Nhóm hỗn hợp: tìm không chọn nhóm để thẻ chiến pháp cũng đi qua đường thẻ kết quả.
  await page.goto('/tra-cuu/');
  await expect(cards(page).first()).toBeVisible();
  await lookup(page).getByRole('searchbox').fill('An Ủi');
  await expect(cards(page).first()).toContainText('An Ủi');
  const meta = await lookup(page).locator('.lookup-card-meta-text').allTextContents();
  expect(meta.length).toBeGreaterThan(0);
  for (const text of meta) expect(text).not.toMatch(/^(?:ACTIVE|PASSIVE|COMMAND|INTERNAL|FORMATION|TROOP|BURST)$/);
  expect(meta.some((text) => /Chủ động|Bị động|Chỉ huy|Nội chính|Trận pháp|Binh chủng|Bùng nổ/.test(text))).toBe(true);
});

test('hồ sơ giữ đủ trường đã có: bậc đặc kỹ, phẩm trang bị, loại và dạng hiệu ứng chiến pháp', async ({ page }) => {
  await page.goto('/tra-cuu/?group=equipment&id=equipment-special%3Agian-hung');
  await expect(page.getByRole('dialog')).toContainText('Bậc');
  await expect(page.getByRole('dialog')).toContainText('T0');
  await page.goto('/tra-cuu/?group=equipment&id=equipment%3Ay-thien-kiem');
  await expect(page.getByRole('dialog')).toContainText('Phẩm chất');
  await page.goto('/tra-cuu/?group=tactics&id=tactic%3Aan-ui-quan-dan');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Loại');
  await expect(dialog).toContainText('Chỉ huy');
  await expect(dialog).toContainText('Dạng hiệu ứng');
  await expect(dialog).toContainText('Tăng ích');
});

test('Back đóng hồ sơ và trả focus về nơi đã mở', async ({ page }) => {
  await page.goto('/tra-cuu/?group=heroes');
  await firstResult(page).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL('/tra-cuu/?group=heroes');
  expect(await page.evaluate(() => document.activeElement !== document.body && document.activeElement !== document.documentElement)).toBe(true);
  await page.goForward();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
});
