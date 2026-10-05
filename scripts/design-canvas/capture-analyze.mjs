// Chụp các trạng thái thật của /soi-doi-tu-anh/ (bản build ở .cache/design-canvas/sitebuild) cho canvas:
// Analyze (chọn ảnh) → AnalyzeSides (ảnh hai phe) → AnalyzeReview (kiểm tra đội) → AnalyzeResult (đối chiếu).
// Turnstile và Worker được giả lập: Turnstile trả token ngay, Worker trả một lượt đọc mẫu hai phe có ô không chắc/không rõ.
//   node scripts/design-canvas/capture-analyze.mjs [--debug]   → .cache/design-canvas/captures/<Board>.json
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { REPO } from './canvas-page.mjs';
import { serializeBody } from './serialize-body.mjs';

const require = createRequire(join(REPO, 'package.json'));
const { chromium } = require('@playwright/test');
const WORK = join(REPO, '.cache/design-canvas');
const BUILD = join(WORK, 'sitebuild');
const OUT = join(WORK, 'captures');
const DEBUG = process.argv.includes('--debug');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

// Lượt đọc mẫu (màn chiến báo, hai phe). Phe trái có ô cần xác nhận để thấy đủ trạng thái của editor.
const READ = {
  screen: 'battleReport',
  sides: [
    { side: 'left', heroes: [
      { nameCn: '40Y 呂布', tacticsCn: ['引弦力戰', '血刃爭鋒'], booksCn: ['以直報怨'], statFocusCn: '' },
      { nameCn: '王異', tacticsCn: ['奪魂挟魄', '當鋒摧決'], booksCn: ['奇正相生'], statFocusCn: '' },
      { nameCn: '法正', tacticsCn: ['三勢陣', '臨危救主'], booksCn: ['未知'], statFocusCn: '' },
    ] },
    { side: 'right', heroes: [
      { nameCn: 'SP 馬超', tacticsCn: ['當鋒摧決', '摧鋒斷刃'], booksCn: [], statFocusCn: '' },
      { nameCn: '許攸', tacticsCn: ['臨危救主', '解煩衛'], booksCn: [], statFocusCn: '' },
      { nameCn: '陳宮', tacticsCn: ['雁行陣', '剛柔並濟'], booksCn: [], statFocusCn: '' },
    ] },
  ],
};
const TURNSTILE_STUB = 'window.turnstile={render:function(b,o){setTimeout(function(){o.callback("dc-token")},30);return "w1"},reset:function(){},remove:function(){},getResponse:function(){return "dc-token"}};';

const server = createServer(async (q, r) => {
  let file = join(BUILD, decodeURIComponent(new URL(q.url, 'http://x').pathname));
  try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); } catch { if (!extname(file)) file += '.html'; }
  try { r.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }).end(await readFile(file)); } catch { r.writeHead(404).end(); }
});
await new Promise((d) => server.listen(0, '127.0.0.1', d));
const BASE = `http://127.0.0.1:${server.address().port}`;
await mkdir(OUT, { recursive: true });
const png = await readFile(join(REPO, 'public/og-image.png'));

async function snap(page, board) {
  await page.waitForTimeout(500);
  const res = await page.evaluate(serializeBody);
  await writeFile(join(OUT, `${board}.json`), JSON.stringify(res));
  console.log(board, 'height', res.height, 'bytes', res.html.length);
}

async function controls(page, label) {
  if (!DEBUG) return;
  console.log(`--- ${label}`);
  console.log(await page.evaluate(() => [...document.querySelectorAll('#main-content button, #main-content input, #main-content select')]
    .filter((e) => e.getClientRects().length).map((e) => `${e.tagName}.${e.className} [${e.getAttribute('role') || e.type}] ${e.getAttribute('aria-label') || ''} :: ${e.textContent.trim().slice(0, 50)}`).join('\n')));
}

const browser = await chromium.launch();
for (const [suffix, width] of [['', 1440], ['Mobile', 390]]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.route('https://challenges.cloudflare.com/**', (route) => route.fulfill({ contentType: 'text/javascript', body: TURNSTILE_STUB }));
  await page.route('**/analyze', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(READ) }));
  await page.route('**/api/**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' }));
  await page.goto(`${BASE}/soi-doi-tu-anh/`, { waitUntil: 'load' });
  await page.waitForSelector('.site-footer');
  await page.waitForTimeout(1500);
  await snap(page, `Analyze${suffix}`);

  await page.setInputFiles('.ana-file', { name: 'chien-bao.png', mimeType: 'image/png', buffer: png });
  await page.waitForTimeout(800);
  await controls(page, 'after file');
  await page.click('.ana-run');
  await page.waitForSelector('.ana-side-pick:not([hidden])', { timeout: 15000 });
  await controls(page, 'sides');
  await snap(page, `AnalyzeSides${suffix}`);

  await page.locator('.ana-side-options [role="radio"], .ana-side-options button, .ana-side-options input').first().click();
  await page.click('.ana-side-run');
  await page.waitForTimeout(1200);
  await controls(page, 'editor');
  await snap(page, `AnalyzeReview${suffix}`);

  // Xác nhận mọi ô còn chờ: chọn gợi ý gần nhất đầu tiên, ô không có gợi ý thì "Để trống".
  for (let i = 0; i < 12; i += 1) {
    const candidate = page.locator('.ana-candidate:visible').first();
    const clear = page.locator('.ana-cell-clear:visible').first();
    if (await candidate.count()) await candidate.click();
    else if (await clear.count()) await clear.click();
    else break;
    await page.waitForTimeout(150);
  }
  await controls(page, 'before compare');
  const compare = page.locator('.ana-compare-run');
  if (await compare.isEnabled()) {
    await compare.click();
    await page.waitForTimeout(1500);
    await snap(page, `AnalyzeResult${suffix}`);
  } else console.log('compare still disabled');
  await page.close();
}
await browser.close();
server.close();
