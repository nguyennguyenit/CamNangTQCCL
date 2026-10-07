// Dựng artboard qua shim docs/design/so-binh-phap/project/support.js để kiểm tra trước khi đưa lên canvas: phục vụ
// thư mục boards (.dc.html) + asset `/_blob/<id>` (đoán kiểu theo nội dung), in chiều cao nội dung thật và ghi ảnh PNG.
//   node scripts/design-canvas/shot.mjs <thư mục boards> <blob dir...> -- Board:width ...   (CLIP=y,h chụp thêm một lát)
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { REPO } from './canvas-page.mjs';

const require = createRequire(join(REPO, 'package.json'));
const { chromium } = require('@playwright/test');
const args = process.argv.slice(2);
const sep = args.indexOf('--');
const [boardsDir, ...blobDirs] = args.slice(0, sep);
const targets = args.slice(sep + 1).map((a) => a.split(':'));
const SUPPORT = join(REPO, 'docs/design/so-binh-phap/project/support.js');
const sniff = (x) => x.subarray(0, 4).toString('latin1') === 'wOF2' ? 'font/woff2' : x[0] === 0x89 ? 'image/png' : x[0] === 0xff && x[1] === 0xd8 ? 'image/jpeg'
  : /^\s*<(svg|\?xml)/.test(x.subarray(0, 64).toString()) ? 'image/svg+xml' : 'text/css';

const server = createServer(async (q, r) => {
  const p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
  try {
    if (p.startsWith('/_blob/')) {
      for (const dir of blobDirs) {
        try { const b = await readFile(join(dir, p.slice(7))); return r.writeHead(200, { 'content-type': sniff(b) }).end(b); } catch { /* thử thư mục kế */ }
      }
      throw new Error('missing blob');
    }
    const file = p === '/support.js' ? SUPPORT : join(boardsDir, p);
    r.writeHead(200, { 'content-type': extname(file) === '.js' ? 'text/javascript' : 'text/html; charset=utf-8' }).end(await readFile(file));
  } catch { r.writeHead(404).end(); }
});
await new Promise((d) => server.listen(0, '127.0.0.1', d));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
for (const [board, w] of targets) {
  const page = await browser.newPage({ viewport: { width: +w, height: 900 } });
  await page.goto(`${origin}/${board}.dc.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('html[data-dc-ready], html[data-dc-error]', { state: 'attached' });
  const h = await page.evaluate(() => { const root = document.querySelector('.dc-body') || [...document.querySelectorAll('div')].find((d) => d.style.width.endsWith('px')); root.style.height = 'auto'; return root.scrollHeight; });
  await page.screenshot({ path: join(boardsDir, `${board}.png`), fullPage: true });
  if (process.env.CLIP) { const [y, ch] = process.env.CLIP.split(',').map(Number); await page.screenshot({ path: join(boardsDir, `${board}.clip.png`), fullPage: true, clip: { x: 0, y, width: +w, height: ch } }); }
  console.log(board, 'natural height', h);
}
await browser.close();
server.close();
