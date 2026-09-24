#!/usr/bin/env node
// Chụp ảnh chuẩn cho artboard design "Sổ binh pháp".
//
//   node scripts/design-capture.mjs          chụp mọi artboard → docs/design/so-binh-phap/screens/
//   node scripts/design-capture.mjs --serve  chỉ mở server để xem artboard trên trình duyệt
//
// Artboard dựng bằng docs/design/so-binh-phap/project/support.js (shim tự viết).
// Bỏ 3 artboard hướng A/B/C (chỉ để so sánh, không implement).
import { readdir, mkdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { artboards, SCREENS_DIR, serve } from './design-artboards.mjs';

const REQUIRED_FONTS = ['Be Vietnam Pro', 'Noto Serif Display'];

async function captureOnce(browser, origin, board) {
  const page = await browser.newPage({ viewport: { width: board.width, height: board.height }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.goto(`${origin}/${board.file}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('html[data-dc-ready], html[data-dc-error]', { state: 'attached' });
    const failure = await page.getAttribute('html', 'data-dc-error');
    if (failure) throw new Error(failure);
    if (errors.length) throw new Error(errors.join('\n'));
    // Google Fonts chia mỗi font thành nhiều lát unicode-range và chỉ tải lát khi layout cần → thứ tự tải
    // thay đổi theo mạng, ảnh chụp lệch giữa các lần chạy. Tải hết mọi lát; lát nào lỗi mạng thì chụp lại.
    const unloaded = await page.evaluate(async (families) => {
      await Promise.allSettled([...document.fonts].map((face) => face.load()));
      await document.fonts.ready;
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      const faces = [...document.fonts];
      const absent = families.filter((family) => !faces.some((face) => face.family.replaceAll('"', '') === family));
      const failed = faces.filter((face) => face.status !== 'loaded').map((face) => `${face.family} ${face.weight} (${face.status})`);
      return [...absent.map((family) => `${family} (không khai báo)`), ...new Set(failed)];
    }, REQUIRED_FONTS);
    if (unloaded.length) throw new Error(`Font chưa tải: ${unloaded.join(', ')} (cần mạng tới Google Fonts)`);
    const path = join(SCREENS_DIR, `${board.name}.png`);
    await page.screenshot({ path, fullPage: true });
    return path;
  } finally {
    await page.close();
  }
}

async function capture(browser, origin, board, attempts = 3) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await captureOnce(browser, origin, board);
    } catch (error) {
      if (attempt >= attempts || !error.message.startsWith('Font chưa tải')) throw error;
      console.error(`thử lại ${board.name} (${attempt}/${attempts}): ${error.message}`);
    }
  }
}

const server = await serve();
const origin = `http://127.0.0.1:${server.address().port}`;

if (process.argv.includes('--serve')) {
  console.log(`Artboard: ${origin}/Landing.dc.html (Ctrl+C để dừng)`);
} else {
  const { chromium } = await import('@playwright/test');
  const list = await artboards();
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
