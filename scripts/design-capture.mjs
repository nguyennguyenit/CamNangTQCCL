#!/usr/bin/env node
// Chụp ảnh chuẩn cho artboard design "Sổ binh pháp".
//
//   node scripts/design-capture.mjs          chụp mọi artboard → docs/design/so-binh-phap/screens/
//   node scripts/design-capture.mjs --serve  chỉ mở server để xem artboard trên trình duyệt
//
// Artboard dựng bằng docs/design/so-binh-phap/project/support.js (shim tự viết).
// Bỏ 3 artboard hướng A/B/C (chỉ để so sánh, không implement).
import { createServer } from 'node:http';
import { readFile, readdir, mkdir, rm, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DESIGN_DIR = fileURLToPath(new URL('../docs/design/so-binh-phap/', import.meta.url));
const PROJECT_DIR = join(DESIGN_DIR, 'project');
const SCREENS_DIR = join(DESIGN_DIR, 'screens');
const SKIPPED = /^Dir[ABC]-/;
const REQUIRED_FONTS = ['Be Vietnam Pro', 'Noto Serif Display'];
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function serve() {
  const server = createServer(async (request, response) => {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(PROJECT_DIR, `.${path.endsWith('/') ? `${path}index.html` : path}`);
    if (!file.startsWith(PROJECT_DIR + sep)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(file);
      response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  return new Promise((done) => server.listen(0, '127.0.0.1', () => done(server)));
}

async function boards() {
  const canvas = JSON.parse(await readFile(join(PROJECT_DIR, 'canvas.json'), 'utf8'));
  return Object.entries(canvas.boards)
    .filter(([file]) => !SKIPPED.test(file))
    .map(([file, { w, h }]) => ({ file, name: file.replace(/\.dc\.html$/, ''), width: w, height: h }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function capture(browser, origin, board) {
  const page = await browser.newPage({ viewport: { width: board.width, height: board.height }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.goto(`${origin}/${board.file}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('html[data-dc-ready], html[data-dc-error]', { state: 'attached' });
    const failure = await page.getAttribute('html', 'data-dc-error');
    if (failure) throw new Error(failure);
    if (errors.length) throw new Error(errors.join('\n'));
    const missing = await page.evaluate(async (families) => {
      await document.fonts.ready;
      return families.filter((family) => ![...document.fonts].some((face) => face.family.replaceAll('"', '') === family && face.status === 'loaded'));
    }, REQUIRED_FONTS);
    if (missing.length) throw new Error(`Font chưa tải: ${missing.join(', ')} (cần mạng tới Google Fonts)`);
    const path = join(SCREENS_DIR, `${board.name}.png`);
    await page.screenshot({ path, fullPage: true });
    return path;
  } finally {
    await page.close();
  }
}

const server = await serve();
const origin = `http://127.0.0.1:${server.address().port}`;

if (process.argv.includes('--serve')) {
  console.log(`Artboard: ${origin}/Landing.dc.html (Ctrl+C để dừng)`);
} else {
  const { chromium } = await import('@playwright/test');
  const list = await boards();
  const browser = await chromium.launch();
  let failed = 0;
  try {
    await mkdir(SCREENS_DIR, { recursive: true });
    const expected = new Set(list.map((board) => `${board.name}.png`));
    for (const stale of (await readdir(SCREENS_DIR)).filter((file) => !expected.has(file))) {
      await rm(join(SCREENS_DIR, stale));
    }
    for (const board of list) {
      try {
        const path = await capture(browser, origin, board);
        const { size } = await stat(path);
        console.log(`ok   ${board.name}  ${board.width}×${board.height}  ${Math.round(size / 1024)} KB`);
      } catch (error) {
        failed += 1;
        console.error(`FAIL ${board.name}: ${error.message}`);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (failed) {
    console.error(`${failed}/${list.length} artboard lỗi — không dùng ảnh của lần chụp này.`);
    process.exit(1);
  }
  console.log(`${list.length} artboard → ${SCREENS_DIR}`);
}
