import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

/**
 * Landing `/` (Phase 4). Số liệu ở đây được TÍNH LẠI từ dữ liệu đã publish ngay trong test, không đọc
 * `src/lib/landing-stats.ts`, để khớp số hiển thị là một phép đối chiếu thật.
 */
const generationRoot = new URL('../src/data/recommended-reference/', import.meta.url);
const current = JSON.parse(await readFile(new URL('current.json', generationRoot), 'utf8'));
const readGeneration = async (name) =>
  JSON.parse(await readFile(new URL(`${current.generationId}/${name}`, generationRoot), 'utf8'));
const readData = async (name) => JSON.parse(await readFile(new URL(`../data/${name}`, import.meta.url), 'utf8'));

const recommended = (await readGeneration('index.json')).records;
const otherTeams = (await readGeneration('other-teams.json')).records;
const seasonRegistry = await readGeneration('seasons.json');
const heroes = await readData('heroes-dict.json');
const tactics = await readData('tactics.json');
const coexist = await readData('coexist.json');
const khaiHoang = await readData('khaihoang.json');

const vi = (value) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const tier0 = recommended.filter((row) => row.tierRaw === 'T0').length;
const seasons = new Set(recommended.map((row) => row.sourceSeasonId)).size;
const avoidCount = otherTeams.filter((row) => (row.legacyContent?.counters?.avoid ?? []).length > 0).length;
const alternativeCount = otherTeams.filter((row) => {
  const holders = row.legacyContent?.heroes ?? [];
  return holders.some((holder) => (holder.alternatives ?? []).length
    || (holder.tactics ?? []).some((tactic) => (tactic.alternatives ?? []).length)
    || (holder.books ?? []).some((book) => (book.alternatives ?? []).length));
}).length;

/**
 * Đội Khai hoang có ĐỦ cấu hình trước/sau: MỌI tướng đều có bộ trước (`unitTypeBefore` + `tacticBefore`)
 * và bộ sau (`unitTypeAfter` + ít nhất một `tacticsAfter`). Đây là phép đếm độc lập với
 * `src/lib/landing-stats.ts` — cố ý không dùng số `variants` (biến thể là cấu hình khác, không phải trước/sau).
 */
const khaiHoangTeamHasBeforeAfter = (team) => team.heroes.length > 0 && team.heroes.every((hero) =>
  Boolean((hero.unitTypeBefore || '').trim()) && Boolean((hero.tacticBefore || '').trim())
  && Boolean((hero.unitTypeAfter || '').trim()) && (hero.tacticsAfter || []).some((tactic) => (tactic || '').trim()));

const beforeAfterTeams = khaiHoang.teams.filter(khaiHoangTeamHasBeforeAfter);
const scopeRecords = recommended.filter((row) => row.sourceSeasonId === seasonRegistry.defaultSourceSeasonId);
const firstScopeKey = [...scopeRecords].sort((left, right) => left.listIndex - right.listIndex)[0]?.safeScopeKey;
const scopeRows = scopeRecords.filter((row) => row.safeScopeKey === firstScopeKey);
const firstTeam = [...scopeRows].sort((left, right) => left.listIndex - right.listIndex)[0];
const unitLabels = seasonRegistry.displayLabels.unit;
const factionLabels = seasonRegistry.displayLabels.faction;

const EXPECTED = {
  configs: vi(recommended.length),
  tier0: vi(tier0),
  seasons: vi(seasons),
  heroes: vi(heroes.length),
  tactics: vi(tactics.length),
  otherTeams: vi(otherTeams.length),
  avoid: vi(avoidCount),
  alternatives: vi(alternativeCount),
  coexistGroups: vi(coexist.length),
  coexistTeams: vi(coexist[0].teams.length),
  coexistHeroes: vi(new Set(coexist[0].teams.flatMap((team) => team.heroes.map((hero) => hero.name))).size),
  khaiHoangTeams: vi(khaiHoang.teams.length),
  khaiHoangBeforeAfter: vi(beforeAfterTeams.length),
  chamSu: vi(khaiHoang.chamSuTeams.length),
  mines: vi(khaiHoang.mines.length),
};

const LANDING_BLOCKS = ['dau-trang', 'nguon-du-lieu', 'landing-sections', 'landing-vaults', 'landing-community', 'tai-game'];

/** Cuộn anchor có thể mượt (`scroll-behavior: smooth`); chờ vị trí đứng yên rồi mới đo. */
async function scrollSettled(page) {
  await page.evaluate(() => new Promise((done) => {
    let previous = -1;
    let still = 0;
    const tick = () => {
      const y = Math.round(window.scrollY);
      if (y === previous) still += 1; else still = 0;
      previous = y;
      if (still >= 5) return done();
      requestAnimationFrame(tick);
    };
    tick();
  }));
}

test('Landing dựng đủ các khối theo thứ tự, CTA tối đứng sau cùng', async ({ page }) => {
  await page.goto('/');
  const order = await page.$$eval('main .landing-hero, main .landing-section', (elements) => elements.map((el) => el.id));
  expect(order.slice(0, LANDING_BLOCKS.length)).toEqual(LANDING_BLOCKS);
  expect(order.at(-1)).toBe('landing-cta');

  // Khối điều hướng là thẻ link tới đúng trang mục.
  const links = await page.$$eval('main .landing-tile, main .landing-community-card', (anchors) => anchors.map((a) => a.getAttribute('href')));
  expect(links).toEqual([
    '/doi-chuan/', '/doi-khac/', '/cung-ton/', '/khai-hoang/',
    '/tra-cuu/', '/theo-doi-chieu-mo/', '/soi-doi-tu-anh/', '/goi-y-doi-tu-kho/',
    '/chien-bao/', '/bai-viet/', '/doi-chuan/',
  ]);
  // Hai nút hero: Đội chuẩn là CTA chính, Gợi ý đội từ kho là lối phụ.
  expect(await page.$$eval('#dau-trang .landing-hero-actions a', (anchors) => anchors.map((a) => a.getAttribute('href'))))
    .toEqual(['/doi-chuan/', '/goi-y-doi-tu-kho/']);
  await expect(page.locator('#landing-cta a.landing-btn')).toHaveAttribute('href', '/doi-chuan/');
});

test('số liệu Landing khớp dữ liệu đã publish', async ({ page }) => {
  await page.goto('/');
  const numbers = await page.$$eval('.landing-stat-number', (nodes) => nodes.map((node) => node.textContent.trim()));
  expect(numbers).toEqual([EXPECTED.configs, EXPECTED.tier0, EXPECTED.seasons, EXPECTED.heroes, EXPECTED.tactics]);

  await expect(page.locator('.landing-lead')).toHaveText(
    `${EXPECTED.configs} cấu hình đội từ ${EXPECTED.seasons} mùa nguồn, ${EXPECTED.otherTeams} đội người chơi tổng hợp, `
    + `cùng ${EXPECTED.heroes} tướng và ${EXPECTED.tactics} chiến pháp để tra cứu — miễn phí, không cần tài khoản.`,
  );
  // Nguồn ghi chung, không nêu tên site nguồn.
  await expect(page.locator('main')).not.toContainText('SGSDeck');

  const vaults = page.locator('#landing-sections .landing-tile-desc');
  await expect(vaults.nth(0)).toHaveText(
    `${EXPECTED.configs} cấu hình theo mùa và danh mục, giữ đúng thứ tự nguồn, kèm điểm nguồn.`,
  );
  await expect(vaults.nth(1)).toHaveText(
    `${EXPECTED.otherTeams} đội người chơi tổng hợp: ${EXPECTED.avoid} đội ghi đội sợ, `
    + `${EXPECTED.alternatives} đội có phương án thay thế.`,
  );

  await expect(page.locator('#landing-sections .landing-tile-desc').nth(2)).toHaveText(
    `${EXPECTED.coexistGroups} nhóm, mỗi nhóm ${EXPECTED.coexistTeams} đội dùng cùng lúc — `
    + `${EXPECTED.coexistHeroes} tướng không trùng nhau.`,
  );
  await expect(page.locator('#landing-sections .landing-tile-desc').nth(3)).toHaveText(
    `${EXPECTED.khaiHoangTeams} đội mở đất, ${EXPECTED.khaiHoangBeforeAfter} đội có đủ cấu hình trước/sau, `
    + `${EXPECTED.chamSu} đội Chạm Sứ, cùng quân thủ của ${EXPECTED.mines} mỏ.`,
  );
});

test('anchor Landing cuộn tới đúng khối, không nằm dưới header dính', async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const hash of ['#nguon-du-lieu', '#tai-game']) {
      await page.goto(`/${hash}`);
      await scrollSettled(page);
      const measured = await page.evaluate((id) => {
        const target = document.querySelector(id).getBoundingClientRect();
        const header = document.querySelector('.site-header').getBoundingClientRect();
        return { top: Math.round(target.top), headerBottom: Math.round(header.bottom) };
      }, hash);
      expect(measured.top, `${hash} @${width} phải nằm dưới header`).toBeGreaterThanOrEqual(measured.headerBottom - 1);
    }
    // Bấm từ điều hướng thật: header (desktop) hoặc menu mobile, rồi footer.
    await page.goto('/');
    if (width === 1440) {
      await page.click('#nav-toggle-ve-cam-nang');
      await page.click('.site-nav a[href="/#nguon-du-lieu"]');
    } else {
      await page.click('#section-menu-toggle');
      await page.locator('#section-menu-items summary', { hasText: 'Về cẩm nang' }).click();
      await page.click('#section-menu-items a[href="/#nguon-du-lieu"]');
    }
    await scrollSettled(page);
    expect(await page.evaluate(() => Math.round(document.querySelector('#nguon-du-lieu').getBoundingClientRect().top)))
      .toBeGreaterThanOrEqual(await page.evaluate(() => Math.round(document.querySelector('.site-header').getBoundingClientRect().bottom)) - 1);
    await page.click('.footer-game-list a[href="/#tai-game"]');
    await scrollSettled(page);
    expect(await page.evaluate(() => Math.round(document.querySelector('#tai-game').getBoundingClientRect().top)))
      .toBeGreaterThanOrEqual(await page.evaluate(() => Math.round(document.querySelector('.site-header').getBoundingClientRect().bottom)) - 1);
  }
});

test('mục Tải game: QR quét được, link ngoài đủ target/rel, không ảnh nhà phát hành', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const frame = page.locator('.landing-qr-frame[role="img"][aria-label="Mã QR tải game"]');
  await expect(frame).toBeVisible();
  const qr = await frame.locator('svg').evaluate((svg) => {
    const box = svg.getBoundingClientRect();
    return { width: Math.round(box.width), viewBox: svg.getAttribute('viewBox') };
  });
  expect(qr.viewBox).toBeTruthy();
  expect(qr.width).toBeGreaterThanOrEqual(120);

  const outbound = await page.$$eval('main a[target="_blank"]', (anchors) => anchors.map((a) => ({
    href: a.getAttribute('href'),
    rel: a.getAttribute('rel'),
    label: a.textContent.trim(),
  })));
  expect(outbound.map((entry) => entry.href.startsWith('https://'))).toEqual(outbound.map(() => true));
  expect(outbound.map((entry) => entry.rel)).toEqual(outbound.map(() => 'noopener noreferrer'));
  expect(outbound.map((entry) => entry.href)).toEqual([
    'https://tqccl.vntth.com/',
    'https://apps.apple.com/vn/app/id1616630100',
    'https://play.google.com/store/apps/details?id=com.vntth.sgzzlb.gp.vn&gl=vn',
    'https://global-package-publish.qookkagames.com/s3gsource/13/s3g_vn_0610.pc.exe',
  ]);
  // Ảnh duy nhất được phép trong main là logo trang trí của site (alt rỗng), không ảnh nhà phát hành.
  const images = await page.$$eval('main img', (nodes) => nodes.map((img) => [img.getAttribute('src'), img.getAttribute('alt')]));
  expect(images.filter(([src, alt]) => src !== '/logo.png' || alt !== '')).toEqual([]);
});

test('Landing không cuộn ngang ở 320/390 và QR vẫn nền sáng trong theme tối', async ({ page }) => {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const qrBackground = await page.locator('.landing-qr-frame').evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(qrBackground).toBe('rgb(255, 255, 255)');
});

test('Khải hoang: chỉ đếm đội có đủ cấu hình trước/sau, đúng cả hai ca biên', async ({ page }) => {
  const byId = new Map(khaiHoang.teams.map((team) => [team.id, team]));
  // Ca biên 1: đội KHÔNG có biến thể nhưng mọi tướng đều có bộ trước và bộ sau ⇒ phải được đếm.
  const fullBuild = byId.get('thai-van-co-khuong-duy-thai-su-tu');
  expect(fullBuild).toBeTruthy();
  expect((fullBuild.variants ?? []).length).toBe(0);
  expect(khaiHoangTeamHasBeforeAfter(fullBuild)).toBe(true);
  // Ca biên 2: đội chỉ có dữ liệu sau cấp 20 ⇒ không được đếm là có trước/sau.
  const afterOnly = byId.get('truong-xuan-hoa-lu-bo-ta-tu');
  expect(afterOnly).toBeTruthy();
  expect(khaiHoangTeamHasBeforeAfter(afterOnly)).toBe(false);
  expect(afterOnly.heroes.every((hero) => !(hero.tacticBefore || '').trim())).toBe(true);
  expect(EXPECTED.khaiHoangBeforeAfter).toBe('16');

  await page.goto('/');
  await expect(page.locator('#landing-sections .landing-tile-desc').nth(3)).toHaveText(
    `${EXPECTED.khaiHoangTeams} đội mở đất, ${EXPECTED.khaiHoangBeforeAfter} đội có đủ cấu hình trước/sau, `
    + `${EXPECTED.chamSu} đội Chạm Sứ, cùng quân thủ của ${EXPECTED.mines} mỏ.`,
  );
});

test('hai khối xem trước dựng từ dữ liệu publish thật và link tới trang chi tiết có thật', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');

  const card = page.locator('.landing-preview-card');
  await expect(card).toBeVisible();
  await expect(card.locator('.team-name')).toHaveText(firstTeam.displayNameVi);
  await expect(card.locator('.reference-score')).toHaveText(String(firstTeam.value));
  await expect(card.locator('.reference-units')).toHaveText(firstTeam.unitTypesRaw.map((unit) => unitLabels[unit]).join(' · '));
  await expect(card.locator('.reference-faction')).toHaveText(factionLabels[firstTeam.factionRaw]);
  await expect(card.locator('.reference-holder')).toHaveCount(firstTeam.heroes.length);
  await expect(card.locator('.reference-holder').first().locator('.hero-name')).toHaveText(firstTeam.heroes[0].displayNameVi);
  await expect(card.locator('.reference-holder').nth(1).locator('.tag.t-tactic').first())
    .toHaveText(firstTeam.heroes[1].tacticSlotsVi[0]);

  const href = await card.locator('.landing-preview-link').getAttribute('href');
  expect(href).toMatch(/^\/doi-chuan\/[^/]+\/$/);
  const detail = await page.request.get(href);
  expect(detail.status()).toBe(200);
  expect(await detail.text()).toContain(firstTeam.displayNameVi);

  const bar = page.locator('#landing-vaults .landing-table-bar');
  await expect(bar).toContainText(seasonRegistry.seasonOptions.find((option) => option.sourceSeasonId === seasonRegistry.defaultSourceSeasonId).displayNameVi);
  await expect(page.locator('#landing-vaults .landing-table-count')).toHaveText(`${vi(scopeRows.length)} / ${vi(scopeRows.length)} đội`);

  const rows = page.locator('#landing-vaults .reference-table tbody tr');
  await expect(rows).toHaveCount(4);
  const firstRow = rows.first();
  await expect(firstRow.locator('th')).toContainText(firstTeam.displayNameVi);
  await expect(firstRow.locator('th .landing-table-meta')).toHaveText(
    [factionLabels[firstTeam.factionRaw], ...firstTeam.unitTypesRaw.map((unit) => unitLabels[unit])].join(' · '),
  );
  await expect(firstRow.locator('td').first()).toHaveText(firstTeam.heroes.map((holder) => holder.displayNameVi).join(' · '));
  await expect(firstRow.locator('.landing-table-score')).toHaveText(String(firstTeam.value));

  // N4-1: ở bề rộng hẹp bảng xếp dọc theo MobileTable nên cột điểm nằm ngay trong khung nhìn —
  // không còn cuộn ngang bên trong khung và không đẩy trang rộng ra.
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const measured = await page.evaluate(() => {
      const region = document.querySelector('.landing-table-scroll');
      const row = region.querySelector('tbody tr');
      const score = row.querySelector('.landing-table-score');
      const name = row.querySelector('th');
      const box = region.getBoundingClientRect();
      const scoreBox = score.getBoundingClientRect();
      const nameBox = name.getBoundingClientRect();
      return {
        innerScroll: region.scrollWidth - region.clientWidth,
        scoreLeft: Math.round(scoreBox.left),
        scoreRight: Math.round(scoreBox.right),
        regionLeft: Math.round(box.left),
        regionRight: Math.round(box.right),
        sameRow: Math.abs(scoreBox.top - nameBox.top) <= 4,
        scoreBelowName: scoreBox.top >= nameBox.bottom,
        nameLeft: Math.round(nameBox.left),
        rowText: score.textContent.trim(),
      };
    });
    // Không cuộn ẩn, và điểm nằm trong khung: không cần gợi ý cuộn.
    expect(measured.innerScroll, `${width}: cuộn ngang trong khung`).toBe(0);
    expect(measured.scoreRight, `${width}: mép phải điểm`).toBeLessThanOrEqual(measured.regionRight);
    expect(measured.scoreLeft, `${width}: mép trái điểm`).toBeGreaterThanOrEqual(measured.regionLeft);
    // Điểm cùng hàng với tên đội (không bị đẩy xuống dưới như một hàng xếp dọc).
    expect(measured.sameRow, `${width}: điểm cùng hàng với tên đội`).toBe(true);
    expect(measured.scoreBelowName, `${width}: điểm không nằm dưới tên`).toBe(false);
    expect(measured.rowText, `${width}: vẫn in điểm`).toBe(String(firstTeam.value));
  }
});

test('ba nút tải đều có mũi tên link ngoài riêng, giữ icon thiết bị', async ({ page }) => {
  await page.goto('/');
  // Mũi tên ↗ nhận diện bằng chính hình học của nó (2 path), không tính là "có SVG là đủ".
  const arrowPath = ['M14 4h6v6', 'M20 4l-9 9'];
  const survey = await page.evaluate((arrowPath) => {
    const isArrow = (svg) => {
      const shapes = [...svg.querySelectorAll('path')].map((path) => (path.getAttribute('d') || '').trim());
      return shapes.length === 2 && shapes[0].startsWith(arrowPath[0]) && shapes[1].startsWith(arrowPath[1]);
    };
    return {
      arrows: ['#tai-game .landing-store-arrow', '#tai-game .landing-exe-arrow'].map((selector) => {
        const nodes = [...document.querySelectorAll(selector)];
        return {
          count: nodes.length,
          allArrows: nodes.every((node) => [...node.querySelectorAll('svg')].some(isArrow)),
          hidden: nodes.every((node) => [...node.querySelectorAll('svg')].every((svg) => svg.getAttribute('aria-hidden') === 'true')),
          deviceIcons: nodes.every((node) => node.parentElement.querySelectorAll('svg').length === 2),
        };
      }),
      storeArrows: document.querySelectorAll('#tai-game .landing-store-arrow').length,
      exeArrows: document.querySelectorAll('#tai-game .landing-exe-arrow').length,
      outbound: [...document.querySelectorAll('#tai-game a[target="_blank"]')].map((anchor) => ({
        href: anchor.getAttribute('href'),
        arrows: [...anchor.querySelectorAll('svg')].filter(isArrow).length,
        notice: anchor.textContent.includes('(mở tab mới)'),
      })),
    };
  }, arrowPath);

  expect(survey.storeArrows).toBe(2);
  expect(survey.exeArrows).toBe(1);
  for (const group of survey.arrows) {
    expect(group.count).toBeGreaterThan(0);
    expect(group.allArrows).toBe(true);
    expect(group.hidden).toBe(true);
    expect(group.deviceIcons).toBe(true);
  }
  expect(survey.outbound.map((entry) => entry.arrows)).toEqual([1, 1, 1, 1]);
  expect(survey.outbound.map((entry) => entry.notice)).toEqual([true, true, true, true]);
  expect(survey.outbound.map((entry) => entry.href)).toEqual([
    'https://tqccl.vntth.com/',
    'https://apps.apple.com/vn/app/id1616630100',
    'https://play.google.com/store/apps/details?id=com.vntth.sgzzlb.gp.vn&gl=vn',
    'https://global-package-publish.qookkagames.com/s3gsource/13/s3g_vn_0610.pc.exe',
  ]);
});

test('Landing không nạp ứng dụng mục và giữ chuyển tiếp hash cũ', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('script[src="/js/app.js"]')).toHaveCount(0);
  await expect(page.locator('script#legacy-route-redirect')).toHaveCount(1);
  await page.goto('/#team-pk');
  await expect(page).toHaveURL('/doi-khac/?source=team-intro');
});

test('footer: nút Ủng hộ tác giả mở hộp thoại QR, Escape/nút đóng trả focus về nút', async ({ page }) => {
  for (const path of ['/', '/doi-chuan/']) {
    await page.goto(path);
    const opener = page.locator('.site-footer [data-donate-open]');
    const dialog = page.locator('#donate-dialog');
    await expect(opener).toBeVisible();
    await expect(dialog).not.toBeVisible();

    await opener.click();
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.donate-dialog-qr')).toHaveAttribute('src', '/donate-qr.png');
    await expect(dialog.locator('.donate-dialog-qr')).toHaveAttribute('alt', /\S/);
    await expect(dialog.locator('.donate-dialog-recipient')).toContainText('NGUYEN LE THAI NGUYEN');
    await expect(dialog.locator('.donate-dialog-recipient')).toContainText('*******096');
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(opener).toBeFocused();

    await opener.click();
    await dialog.locator('[data-donate-close]').click();
    await expect(dialog).not.toBeVisible();
    await expect(opener).toBeFocused();
  }
});

test('điều hướng có mục Chiến báo và Bài viết ở menu, menu mobile và footer', async ({ page }) => {
  await page.goto('/doi-chuan/');
  for (const scope of ['.site-nav', '#section-menu-items', '.site-footer']) {
    for (const href of ['/chien-bao/', '/bai-viet/']) {
      await expect(page.locator(`${scope} a[href="${href}"]`)).toHaveCount(1);
    }
  }
});
