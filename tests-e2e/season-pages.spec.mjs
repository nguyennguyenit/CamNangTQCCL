import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

/**
 * Trang mùa Đội chuẩn (#6): `/doi-chuan/<mã mùa>/` và bản zh. Trang tĩnh, không có khung comment; khối "Các mùa khác"
 * của `/doi-chuan/` nằm ngoài vùng client thay thế; bộ lọc `?season=` của trang danh sách giữ nguyên.
 */
const SEASON = { slug: 'pk-s24', id: 'pk-s24' };
const root = new URL('../src/data/recommended-reference/', import.meta.url);
const generation = JSON.parse(await readFile(new URL('current.json', root), 'utf8')).generationId;
const rows = JSON.parse(await readFile(new URL(`${generation}/index.json`, root), 'utf8')).records
  .filter((row) => row.sourceSeasonId === SEASON.id);
const VIETNAMESE = /[ăâđêôơưàảãáạằẳẵắặầẩẫấậèẻẽéẹềểễếệìỉĩíịòỏõóọồổỗốộờởỡớợùủũúụừửữứựỳỷỹýỵ]/iu;

test('trang mùa có JS: đủ đội, khối "Các mùa khác" không bị client xóa, không có khung comment', async ({ page }) => {
  expect(rows.length).toBeGreaterThan(0);
  await page.goto(`/doi-chuan/${SEASON.slug}/`);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('h1')).toContainText('PK-S24');
  await expect(page.locator('.reference-team-card')).toHaveCount(rows.length);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#community-root')).toHaveCount(0);
  await expect(page.locator('.cm-root')).toHaveCount(0);

  await page.goto('/doi-chuan/');
  await expect(page.locator('#section-team-chuan .reference-team-card').first()).toBeVisible();
  await page.waitForLoadState('networkidle');
  const block = page.locator('[data-other-seasons]');
  await expect(block).toBeVisible();
  await expect(block.locator(`a[href="/doi-chuan/${SEASON.slug}/"]`)).toHaveCount(1);
  expect(await block.locator('a').count()).toBeGreaterThan(10);
  await expect(page.locator('#section-team-chuan [data-other-seasons]')).toHaveCount(0);
  // Bấm link thật mở đúng trang mùa.
  await block.locator(`a[href="/doi-chuan/${SEASON.slug}/"]`).click();
  await expect(page).toHaveURL(new RegExp(`/doi-chuan/${SEASON.slug}/$`, 'u'));
});

test('HTML dist của trang mùa không chứa id="community-root"', async () => {
  for (const prefix of ['', 'zh/']) {
    const html = await readFile(new URL(`../dist/${prefix}doi-chuan/${SEASON.slug}/index.html`, import.meta.url), 'utf8');
    expect(html).not.toContain('id="community-root"');
    expect(html).not.toContain('community-page.js');
  }
});

test('PR không sửa community-worker/** hay js/community-api.js', async () => {
  let changed;
  try {
    changed = execFileSync('git', ['diff', '--name-only', 'origin/main...HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n').filter(Boolean);
  } catch {
    test.skip(true, 'không có origin/main để so sánh');
    return;
  }
  expect(changed.filter((file) => file.startsWith('community-worker/') || file === 'js/community-api.js')).toEqual([]);
});

test('bộ lọc ?season= của /doi-chuan/ giữ nguyên: chọn mùa cũ hiện đội của mùa đó, URL vẫn là /doi-chuan/', async ({ page }) => {
  await page.goto(`/doi-chuan/?season=${SEASON.id}`);
  const section = page.locator('#section-team-chuan');
  await expect(section.getByLabel('Mùa', { exact: true })).toHaveValue(SEASON.id);
  await expect(section.locator('.reference-team-card').first()).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/doi-chuan/\\?season=${SEASON.id}$`, 'u'));
  await expect(section.locator('.reference-count')).toContainText(String(rows.length));
});

test('zh: trang mùa và khối "其他赛季" không lẫn chữ Việt', async ({ page }) => {
  const only = async (selector) => {
    const text = await page.locator(selector).evaluateAll((roots) => roots.map((node) => {
      const clone = node.cloneNode(true);
      for (const skip of clone.querySelectorAll('[translate="no"], [lang="vi"], script, style, noscript')) skip.remove();
      const labels = [...clone.querySelectorAll('[aria-label], [title], [alt]')].flatMap((el) => ['aria-label', 'title', 'alt'].map((name) => el.getAttribute(name) || ''));
      return [clone.textContent, ...labels].join('\n');
    }).join('\n'));
    expect(text.split(/\n+/u).map((line) => line.trim()).filter((line) => VIETNAMESE.test(line)), `${selector} còn chữ Việt`).toEqual([]);
  };
  await page.goto(`/zh/doi-chuan/${SEASON.slug}/`);
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('.reference-team-card')).toHaveCount(rows.length);
  await only('main');
  await page.goto('/zh/doi-chuan/');
  await expect(page.locator('[data-other-seasons]')).toBeVisible();
  await expect(page.locator(`[data-other-seasons] a[href="/zh/doi-chuan/${SEASON.slug}/"]`)).toHaveCount(1);
  await only('[data-other-seasons]');
});
