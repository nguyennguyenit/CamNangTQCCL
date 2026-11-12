#!/usr/bin/env node
// So ảnh 28 artboard "Thiết kế mới" với trang thật, `/api/**` giả lập (người duyệt nhìn bố cục — không pass/fail pixel),
// và chặn tràn ngang ở mobile.
//
//   node scripts/design-canvas/compare-moi.mjs [--base <url>] [--out <thư mục>] [--only <nhóm>[,<nhóm>…]]
//                                             [--pair '<json cặp>']… [--theme light|dark]
//
// Cặp lấy từ `scripts/design-canvas/moi-pairs/<nhóm>.mjs` (mỗi nhóm một file, `export default` mảng cặp) cộng các
// `--pair` trong lệnh (JSON, lặp được; `--only` không lọc cặp trong lệnh). Một cặp:
//   { artboard: 'DoiCongDongMoi',        // ảnh chuẩn docs/design/so-binh-phap/screens/<artboard>.png
//     path: '/doi-cong-dong/',           // trang thật, nối sau --base
//     width: 1440,                       // bề rộng artboard (1440 hoặc 390); chụp fullPage, DPR 1
//     ready: '.cm-team-card',            // selector chỉ có SAU khi nội dung dựng xong (bắt buộc)
//     setup: ['#nut-mo'] | async (page) => {},  // tuỳ chọn: bấm lần lượt các selector, hoặc tự thao tác
//     mock: 'dang-nhap' | { state: 'quan-tri', …tuỳ chọn mockCommunityApi } }   // mặc định 'khach'
// Trạng thái mock: `khach` (chưa đăng nhập), `dang-nhap` (người chơi), `quan-tri` (root), `bi-khoa` (bị khoá có hạn —
// trang cần `?error=ACCOUNT_BANNED&error_description=…` để hiện thông báo) — xem moi-mock-states.mjs.
//
// Ra: `<out>/<artboard>.png` (artboard trái | localhost phải) + hai ảnh rời; in bảng để ghi lệch / xử lý.
// Exit 1 khi một cặp lỗi (thiếu ảnh chuẩn, `ready` không xuất hiện…) hoặc trang ở bề rộng ≤ 390 tràn ngang
// (`scrollWidth > clientWidth` của tài liệu); in 5 phần tử thò ra xa nhất để sửa.
// `--base` mặc định là `npm run preview` (http://127.0.0.1:4321, phải build trước).
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PROJECT_DIR, SCREENS_DIR, serve } from '../design-artboards.mjs';
import { closeServer, compositeHtml, newContext, pageSettled } from '../design-compare.mjs';
import { ROOT_DIR } from '../design-tokens.mjs';
import { mockCommunityApi } from '../../tests-e2e/helpers/community-mock.mjs';
import { mockOptions } from './moi-mock-states.mjs';

export const PAIRS_DIR = join(ROOT_DIR, 'scripts/design-canvas/moi-pairs');
export const GROUPS = Object.freeze(['doi-cong-dong', 'quan-tri', 'doi-cua-toi', 'bai-viet-kho']);
const DEFAULT_BASE = 'http://127.0.0.1:4321';
const DEFAULT_OUT = join(ROOT_DIR, '.cache/design-compare/moi');
/** Bề rộng tối đa còn bị soát tràn ngang (artboard mobile 390). */
export const OVERFLOW_MAX_WIDTH = 390;
const STUB_TURNSTILE = 'window.turnstile={render:function(b,o){setTimeout(function(){o.callback("dc-token")},30);return "w1"},reset:function(){},remove:function(){},getResponse:function(){return "dc-token"}};';
/** Ảnh đội / chiến báo của mock là PNG 1×1; thay bằng ảnh chiến báo mẫu mà 28 artboard dùng để bố cục so được. */
const SAMPLE_IMAGE = join(PROJECT_DIR, '_blob/8eb2dc821d7ff0a8329d3b7b3d1d3fdc');
const IMAGE_ROUTE = /\/api\/(?:community-teams\/[^/]+\/images\/\d+|reports\/[^/]+\/image)$/;

export function parseArgs(argv) {
  const values = (flag) => argv.flatMap((arg, index) => (arg === flag && index + 1 < argv.length ? [argv[index + 1]] : []));
  const value = (flag, fallback) => values(flag).at(-1) ?? fallback;
  const theme = value('--theme', 'light');
  if (!['light', 'dark'].includes(theme)) throw new Error(`--theme không hợp lệ: ${theme}`);
  const only = values('--only').flatMap((item) => item.split(',')).map((item) => item.trim()).filter(Boolean);
  const unknown = only.filter((group) => !GROUPS.includes(group));
  if (unknown.length) throw new Error(`--only không hợp lệ: ${unknown.join(', ')} (chọn ${GROUPS.join(' | ')})`);
  const pairs = values('--pair').map((json) => {
    try {
      return { ...JSON.parse(json), group: 'lệnh' };
    } catch (error) {
      throw new Error(`--pair không phải JSON: ${json} (${error.message})`);
    }
  });
  return {
    base: value('--base', DEFAULT_BASE).replace(/\/$/, ''),
    out: resolve(value('--out', DEFAULT_OUT)),
    only,
    pairs,
    theme,
  };
}

/** Kiểm hình dạng một cặp; trả danh sách lỗi (rỗng = hợp lệ). */
export function pairProblems(pair) {
  const problems = [];
  if (!pair || typeof pair !== 'object') return ['cặp phải là object'];
  if (!pair.artboard || typeof pair.artboard !== 'string') problems.push('thiếu `artboard`');
  if (!pair.path || !String(pair.path).startsWith('/')) problems.push('`path` phải bắt đầu bằng /');
  if (!Number.isInteger(pair.width) || pair.width <= 0) problems.push('`width` phải là số nguyên dương');
  if (!pair.ready || typeof pair.ready !== 'string') problems.push('thiếu `ready` (selector chỉ có sau khi nội dung dựng xong)');
  if (pair.setup != null && !Array.isArray(pair.setup) && typeof pair.setup !== 'function') problems.push('`setup` phải là mảng selector hoặc hàm');
  if (pair.mock != null && typeof pair.mock !== 'string' && typeof pair.mock !== 'object') problems.push('`mock` phải là tên trạng thái hoặc object');
  return problems;
}

/** Nạp cặp của các nhóm (`only` rỗng = mọi file trong moi-pairs/), gắn tên nhóm vào từng cặp. */
export async function loadPairs({ only = [], dir = PAIRS_DIR } = {}) {
  const files = (await readdir(dir)).filter((file) => file.endsWith('.mjs')).sort();
  const pairs = [];
  for (const file of files) {
    const group = file.replace(/\.mjs$/, '');
    if (only.length && !only.includes(group)) continue;
    const module = await import(pathToFileURL(join(dir, file)).href);
    const list = module.default ?? module.pairs;
    if (!Array.isArray(list)) throw new Error(`${file} phải export default một mảng cặp`);
    pairs.push(...list.map((pair) => ({ ...pair, group })));
  }
  return pairs;
}

/** Tràn ngang của tài liệu + 5 phần tử thò ra ngoài bề rộng nhìn thấy xa nhất (để biết sửa chỗ nào). */
async function horizontalOverflow(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const limit = root.clientWidth;
    const culprits = [];
    for (const node of document.body.querySelectorAll('*')) {
      const box = node.getBoundingClientRect();
      if (box.width === 0 || box.right <= limit + 0.5) continue;
      const name = node.id ? `#${node.id}` : `${node.tagName.toLowerCase()}${node.classList.length ? `.${[...node.classList].join('.')}` : ''}`;
      culprits.push({ name, right: Math.round(box.right) });
    }
    culprits.sort((a, b) => b.right - a.right);
    return { scrollWidth: root.scrollWidth, clientWidth: limit, culprits: culprits.slice(0, 5) };
  });
}

async function captureLocalhost(browser, pair, options, file) {
  const context = await newContext(browser, { theme: options.theme, width: pair.width, height: 1000 });
  try {
    const page = await context.newPage();
    await page.route('https://challenges.cloudflare.com/**', (route) => route.fulfill({ contentType: 'text/javascript', body: STUB_TURNSTILE }));
    await mockCommunityApi(page, mockOptions(pair.mock));
    // Route đăng ký sau được xét trước: ảnh mẫu thắng PNG 1×1 của mock, phần còn lại của `/api/**` giữ nguyên.
    const sample = await readFile(SAMPLE_IMAGE);
    await page.route((url) => IMAGE_ROUTE.test(url.pathname), (route) => route.fulfill({ status: 200, contentType: 'image/jpeg', body: sample }));
    await page.goto(`${options.base}${pair.path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(pair.ready, { timeout: 20_000, state: 'attached' });
    await pageSettled(page, options.theme);
    if (typeof pair.setup === 'function') await pair.setup(page);
    else for (const selector of pair.setup ?? []) await page.click(selector, { timeout: 5_000 });
    await pageSettled(page, options.theme);
    const overflow = pair.width <= OVERFLOW_MAX_WIDTH ? await horizontalOverflow(page) : null;
    await page.screenshot({ path: file, fullPage: true });
    return overflow;
  } finally {
    await context.close();
  }
}

async function compose(browser, origin, pair, key, theme, file) {
  const context = await newContext(browser, { theme, width: pair.width * 2 + 16, height: 120 });
  try {
    const page = await context.newPage();
    await page.goto(`${origin}/${key}.html`, { waitUntil: 'load' });
    await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode().catch(() => {}))));
    await page.screenshot({ path: file, fullPage: true });
  } finally {
    await context.close();
  }
}

/** Chụp + ghép mọi cặp; trả { rows, failures } — failures khác rỗng nghĩa là exit 1. */
export async function comparePairs(pairs, options) {
  const { chromium } = await import('@playwright/test');
  await mkdir(options.out, { recursive: true });
  const rows = [];
  const failures = [];
  const browser = await chromium.launch();
  const server = await serve(options.out);
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const pair of pairs) {
      const key = `${pair.artboard}${options.theme === 'dark' ? '-dark' : ''}`;
      const problems = pairProblems(pair);
      if (problems.length) {
        failures.push(`${pair.artboard ?? '(không tên)'} [${pair.group}]: ${problems.join('; ')}`);
        continue;
      }
      try {
        const overflow = await captureLocalhost(browser, pair, options, join(options.out, `${key}.localhost.png`));
        if (overflow && overflow.scrollWidth > overflow.clientWidth) {
          const where = overflow.culprits.map((item) => `${item.name} (phải ${item.right}px)`).join(', ');
          failures.push(`${pair.artboard} ${pair.width}px \`${pair.path}\`: tràn ngang scrollWidth ${overflow.scrollWidth} > clientWidth ${overflow.clientWidth}${where ? ` — ${where}` : ''}`);
        }
        await copyFile(join(SCREENS_DIR, `${pair.artboard}.png`), join(options.out, `${key}.artboard.png`));
        await writeFile(join(options.out, `${key}.html`), compositeHtml({ artboard: key, width: pair.width }));
        const out = join(options.out, `${key}.png`);
        await compose(browser, origin, pair, key, options.theme, out);
        const mock = typeof pair.mock === 'object' ? pair.mock.state ?? 'khach' : pair.mock ?? 'khach';
        const fit = overflow ? (overflow.scrollWidth > overflow.clientWidth ? 'TRÀN' : 'không tràn') : '—';
        rows.push([pair.group, pair.artboard, `${pair.width}px`, pair.path, mock, fit, relative(ROOT_DIR, out)]);
      } catch (error) {
        failures.push(`${pair.artboard} ${pair.width}px \`${pair.path}\`: ${error.message.split('\n')[0]}`);
      }
    }
  } finally {
    await browser.close();
    await closeServer(server);
  }
  return { rows, failures };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  const options = parseArgs(process.argv.slice(2));
  const pairs = [...(await loadPairs({ only: options.only })), ...options.pairs];
  if (!pairs.length) {
    console.log(`Chưa có cặp nào${options.only.length ? ` cho ${options.only.join(', ')}` : ''} — thêm vào ${relative(ROOT_DIR, PAIRS_DIR)}/<nhóm>.mjs hoặc dùng --pair.`);
  } else {
    const { rows, failures } = await comparePairs(pairs, options);
    console.log('| Nhóm | Artboard | Bề rộng | Trang | Mock | Tràn ngang | Ảnh ghép | Lệch | Xử lý |');
    console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const [group, artboard, width, path, mock, fit, out] of rows) {
      console.log(`| ${group} | ${artboard} | ${width} | \`${path}\` | ${mock} | ${fit} | \`${out}\` | | |`);
    }
    console.log(`\n${rows.length} ảnh ghép → ${relative(ROOT_DIR, options.out) || options.out}`);
    if (failures.length) {
      for (const failure of failures) console.error(`FAIL ${failure}`);
      process.exitCode = 1;
    }
  }
}
