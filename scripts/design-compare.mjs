#!/usr/bin/env node
// Soát redesign "Sổ binh pháp" bằng hai tầng:
//
//   node scripts/design-compare.mjs --phase NN [--theme light|dark] [--base <url>]
//     So ảnh (vĩ mô, người duyệt — không pass/fail pixel): chụp localhost ở đúng bề rộng artboard
//     (fullPage, DPR 1), đặt cạnh `screens/<Artboard>.png` có nhãn, ghi ảnh ghép vào
//     `.cache/design-compare/phase-NN[-dark]/<Artboard>.png` và in bảng để ghi "đã sửa / giữ, lý do".
//
//   node scripts/design-compare.mjs --tokens --phase NN [--theme light|dark] [--base <url>]
//     Vi mô (tự động): với mỗi component trong `tokens.json` có `probe` và thuộc phase, đọc
//     `getComputedStyle` của phần tử thật trên trang rồi so với giá trị token của theme đang chạy.
//     Lệch chưa khai trong `exceptions` của component ⇒ exit 1.
//
// `--base` mặc định là `http://127.0.0.1:4321` của `npm run preview` (phải build trước).
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SCREENS_DIR, serve } from './design-artboards.mjs';
import { ROOT_DIR, TOKENS_PATH } from './design-tokens.mjs';

const CACHE_DIR = join(ROOT_DIR, '.cache/design-compare');
const DEFAULT_BASE = 'http://127.0.0.1:4321';

/**
 * Cặp so ảnh theo phase. Mỗi phase bổ sung/sửa cặp của mình khi trang tương ứng đã có.
 * `ready` là selector chỉ xuất hiện SAU khi nội dung của cặp đã dựng xong — bắt buộc, để ảnh chụp không
 * rơi vào lúc trang còn trống. `clip: {y, height}` cắt cả hai ảnh (header ở Phase 3); `setup` là các
 * selector cần bấm trước khi chụp để artboard ở trạng thái mở (menu, bộ lọc, hồ sơ).
 */
const PAIRS = [
  // Phase 3 — header dùng chung (cắt dải header) và footer dùng chung (cắt đáy trang).
  { phase: 3, artboard: 'Main', path: '/doi-chuan/', width: 1440, clip: { y: 0, height: 72 }, ready: '.site-header' },
  { phase: 3, artboard: 'MobileList', path: '/doi-chuan/', width: 390, clip: { y: 0, height: 64 }, ready: '.site-header' },
  { phase: 3, artboard: 'LandingMenu', path: '/', width: 1440, ready: '.site-header', setup: ['#nav-toggle-doi-hinh'] },
  { phase: 3, artboard: 'LandingMenuMobile', path: '/', width: 390, ready: '.site-header', setup: ['#section-menu-toggle'] },
  { phase: 3, artboard: 'Landing', path: '/', width: 1440, clip: { bottom: 580 }, ready: '.site-footer' },
  { phase: 3, artboard: 'LandingMobile', path: '/', width: 390, clip: { bottom: 1280 }, ready: '.site-footer' },
  { phase: 4, artboard: 'Landing', path: '/', width: 1440, ready: '#tai-game' },
  { phase: 4, artboard: 'LandingMobile', path: '/', width: 390, ready: '#tai-game' },
  { phase: 5, artboard: 'Main', path: '/doi-chuan/', width: 1440, ready: '#section-team-chuan .reference-team-card' },
  { phase: 5, artboard: 'MainTable', path: '/doi-chuan/?view=bang', width: 1440, ready: '#section-team-chuan .reference-table tbody tr' },
  { phase: 5, artboard: 'MobileList', path: '/doi-chuan/', width: 390, ready: '#section-team-chuan .reference-team-card' },
  { phase: 5, artboard: 'MobileTable', path: '/doi-chuan/?view=bang', width: 390, ready: '#section-team-chuan .reference-table tbody tr' },
  { phase: 5, artboard: 'MobileFilters', path: '/doi-chuan/', width: 390, ready: '#section-team-chuan .reference-toolbar', setup: ['#section-team-chuan .filter-collapse-toggle'] },
  { phase: 7, artboard: 'Lookup', path: '/tra-cuu/', width: 1440, ready: '#section-lookup' },
  { phase: 7, artboard: 'LookupTactics', path: '/tra-cuu/?group=tactics', width: 1440, ready: '#section-lookup' },
  { phase: 7, artboard: 'LookupProfile', path: '/tra-cuu/?group=heroes&id=hero:1', width: 1440, ready: '#section-lookup' },
  { phase: 7, artboard: 'LookupMobile', path: '/tra-cuu/', width: 390, ready: '#section-lookup' },
  { phase: 8, artboard: 'Coexist', path: '/cung-ton/', width: 1440, ready: '#section-coexist' },
  { phase: 8, artboard: 'CoexistMobile', path: '/cung-ton/', width: 390, ready: '#section-coexist' },
  { phase: 8, artboard: 'Khaihoang', path: '/khai-hoang/', width: 1440, ready: '#section-khaihoang' },
  { phase: 8, artboard: 'KhaihoangMobile', path: '/khai-hoang/', width: 390, ready: '#section-khaihoang' },
  { phase: 9, artboard: 'Recruit', path: '/chieu-mo/', width: 1440, ready: '#section-recruit-tracker' },
  { phase: 9, artboard: 'RecruitMobile', path: '/chieu-mo/', width: 390, ready: '#section-recruit-tracker' },
  { phase: 9, artboard: 'Analyze', path: '/soi-doi/', width: 1440, ready: '#section-analyze' },
  { phase: 9, artboard: 'AnalyzeMobile', path: '/soi-doi/', width: 390, ready: '#section-analyze' },
  { phase: 9, artboard: 'Roster', path: '/goi-y-doi/', width: 1440, ready: '#section-roster-recommend' },
  { phase: 9, artboard: 'RosterMobile', path: '/goi-y-doi/', width: 390, ready: '#section-roster-recommend' },
];

function parseArgs(argv) {
  const value = (flag, fallback) => {
    const at = argv.indexOf(flag);
    return at >= 0 ? argv[at + 1] : fallback;
  };
  const theme = value('--theme', 'light');
  if (!['light', 'dark'].includes(theme)) throw new Error(`--theme không hợp lệ: ${theme}`);
  const phase = Number(value('--phase', '0'));
  if (!Number.isInteger(phase) || phase < 1) throw new Error('cần --phase NN');
  return {
    phase,
    theme,
    base: value('--base', DEFAULT_BASE).replace(/\/$/, ''),
    tokens: argv.includes('--tokens'),
    serve: argv.includes('--serve'),
  };
}

/** Một browser cho cả lần chạy; mỗi bề rộng/theme một context — không rò tiến trình con. */
async function openBrowser() {
  const { chromium } = await import('@playwright/test');
  return chromium.launch();
}

async function newContext(browser, { theme, width, height = 900 }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  // Mỗi lần tải trang là một lần đo sạch: bỏ lựa chọn giao diện trang tự ghi (localStorage, trừ `theme`)
  // và snapshot quay lại (sessionStorage) để probe sau không đo nhầm trạng thái do probe trước để lại.
  await context.addInitScript(() => {
    try {
      for (const key of Object.keys(localStorage)) if (key !== 'theme') localStorage.removeItem(key);
    } catch { /* storage bị chặn: không có gì phải xóa */ }
    try {
      sessionStorage.clear();
    } catch { /* storage bị chặn: không có gì phải xóa */ }
  });
  // Theme tối được đặt trước khi tải để `initSiteChrome` áp ngay, không chớp sáng.
  if (theme === 'dark') await context.addInitScript(() => localStorage.setItem('theme', 'dark'));
  return context;
}

/** Chờ một mốc có trong DOM (probe đọc computed style được cả khi khối đang ẩn); hết thời gian là lỗi thật. */
async function waitAttached(page, selector, timeout = 20_000) {
  await page.waitForSelector(selector, { timeout, state: 'attached' });
}

/** Theme đã áp + font đã tải + vẽ xong một frame — dùng chung cho ảnh chụp và probe. */
async function pageSettled(page, theme, timeout = 20_000) {
  if (theme === 'dark') await page.waitForSelector('html[data-theme="dark"]', { timeout });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
}

/** Trang thật nạp dữ liệu bất đồng bộ: chờ mốc nội dung của phase rồi để trang ổn định. */
async function readyPage(page, selector, { theme, timeout = 20_000 } = {}) {
  await waitAttached(page, selector, timeout);
  await pageSettled(page, theme, timeout);
}

/** Đóng server HTTP đã phục vụ trang so ảnh; keep-alive phải bị cắt thì tiến trình mới thoát. */
async function closeServer(server) {
  if (!server) return;
  server.closeAllConnections?.();
  await new Promise((done) => server.close(done));
}

/**
 * Ảnh ghép: artboard (trái) cạnh localhost (phải).
 * `clip` cắt theo đỉnh ảnh (`{y, height}`) hoặc theo đáy (`{bottom}` — footer, chiều cao hai ảnh khác nhau).
 */
function compositeHtml({ artboard, width, clip }) {
  const frameStyle = clip
    ? (clip.bottom ? `height:${clip.bottom}px;display:flex;align-items:flex-end` : `height:${clip.height}px`)
    : '';
  const imageStyle = clip?.bottom ? ' style="flex:none"' : (clip?.y ? ` style="margin-top:-${clip.y}px"` : '');
  const frame = (label, src) => `
    <figure>
      <figcaption>${label}</figcaption>
      <div class="frame"${frameStyle ? ` style="${frameStyle}"` : ''}>
        <img src="${src}" width="${width}"${imageStyle} alt="">
      </div>
    </figure>`;
  return `<!doctype html><meta charset="utf-8"><title>${artboard} — so ảnh</title>
<style>
  body { margin: 0; display: flex; align-items: flex-start; gap: 16px; background: #2b2b2b; font: 13px system-ui; color: #eee; }
  figure { margin: 0; }
  figcaption { padding: 4px 6px; background: #111; }
  .frame { overflow: hidden; }
  img { display: block; }
</style>
${frame(`artboard · ${artboard}`, `./${artboard}.artboard.png`)}
${frame('localhost', `./${artboard}.localhost.png`)}`;
}

async function capturePairs(options) {
  const pairs = PAIRS.filter((pair) => pair.phase === options.phase);
  const runDir = join(CACHE_DIR, `phase-${String(options.phase).padStart(2, '0')}${options.theme === 'dark' ? '-dark' : ''}`);
  await mkdir(runDir, { recursive: true });
  if (!pairs.length) {
    console.log(`Phase ${options.phase}: chưa có cặp ảnh nào — xem bảng lệch token trong báo cáo phase.`);
    return [];
  }
  const missingReady = pairs.filter((pair) => !pair.ready);
  if (missingReady.length) {
    throw new Error(`cặp ảnh phải khai \`ready\` (selector chỉ có sau khi nội dung dựng xong): ${missingReady.map((pair) => pair.artboard).join(', ')}`);
  }
  const browser = await openBrowser();
  const server = await serve(runDir);
  const origin = `http://127.0.0.1:${server.address().port}`;
  const rows = [];
  try {
    for (const pair of pairs) {
      const context = await newContext(browser, { theme: options.theme, width: pair.width, height: 1000 });
      try {
        const page = await context.newPage();
        await page.goto(`${options.base}${pair.path}`, { waitUntil: 'domcontentloaded' });
        await readyPage(page, pair.ready, { theme: options.theme });
        for (const selector of pair.setup ?? []) {
          await page.click(selector, { timeout: 5_000 });
          await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
        }
        await page.screenshot({ path: join(runDir, `${pair.artboard}.localhost.png`), fullPage: true });
      } finally {
        await context.close();
      }
      await copyFile(join(SCREENS_DIR, `${pair.artboard}.png`), join(runDir, `${pair.artboard}.artboard.png`));
      await writeFile(join(runDir, `${pair.artboard}.html`), compositeHtml(pair));
      const shotContext = await newContext(browser, { theme: options.theme, width: pair.width * 2 + 16, height: 120 });
      try {
        const shotPage = await shotContext.newPage();
        await shotPage.goto(`${origin}/${pair.artboard}.html`, { waitUntil: 'load' });
        await shotPage.evaluate(() => Promise.all([...document.images].map((image) => image.decode().catch(() => {}))));
        const out = join(runDir, `${pair.artboard}.png`);
        await shotPage.screenshot({ path: out, fullPage: true });
        rows.push([pair.artboard, `${pair.width}px`, pair.path, out.replace(`${ROOT_DIR}/`, '')]);
      } finally {
        await shotContext.close();
      }
    }
  } finally {
    await browser.close();
    await closeServer(server);
  }
  console.log(`| Artboard | Bề rộng | Trang | Ảnh ghép | Lệch | Xử lý |`);
  console.log(`| --- | --- | --- | --- | --- | --- |`);
  for (const [artboard, width, path, out] of rows) console.log(`| ${artboard} | ${width} | \`${path}\` | \`${out}\` | | |`);
  console.log(`\n${rows.length} ảnh ghép → ${runDir.replace(`${ROOT_DIR}/`, '')}`);
  return rows;
}

/* ===== Đo computed style so với token (vi mô, tự động) ===== */

const COLOR_PROPERTIES = new Set([
  'color', 'background-color', 'border-color', 'outline-color', 'border-top-color',
  'border-right-color', 'border-bottom-color', 'border-left-color',
]);
const px = (value) => Number.parseFloat(value);
const firstFamily = (value) => value.split(',')[0].replace(/["']/g, '').trim().toLowerCase();
const round = (value) => Math.round(value * 100) / 100;

/** Đổi `#rgb`/`#rrggbb` sang dạng `rgb(r, g, b)` mà `getComputedStyle` trả về. */
function toRgb(value) {
  const short = value.match(/^#([0-9a-f]{3})$/i);
  if (short) return toRgb(`#${[...short[1]].map((character) => character + character).join('')}`);
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const number = Number.parseInt(hex[1], 16);
    return `rgb(${(number >> 16) & 255}, ${(number >> 8) & 255}, ${number & 255})`;
  }
  return value.replace(/\s+/g, ' ').toLowerCase();
}

/** Bóng: thứ tự thành phần khác nhau giữa token (`0 1px 3px rgba(…)`) và computed (`rgba(…) 0px 1px 3px 0px`). */
function shadowSignature(value) {
  if (!value || value === 'none') return 'none';
  const color = (value.match(/rgba?\([^)]*\)/)?.[0] ?? '').replace(/\s+/g, '');
  const withoutColor = value.replace(/rgba?\([^)]*\)/g, ' ');
  const inset = /\binset\b/.test(withoutColor) ? 'inset ' : '';
  const lengths = (withoutColor.match(/-?\d*\.?\d+(?:px)?/g) ?? []).map((length) => Number.parseFloat(length));
  // Bóng luôn có 4 độ dài (x, y, blur, spread); bản token gọn có thể bỏ các số 0 ở cuối.
  while (lengths.length < 4) lengths.push(0);
  return `${inset}${lengths.slice(0, 4).map((length) => `${length}px`).join(' ')} ${color}`.trim();
}

/** Mọi token theo `var` của nó, để giải tham chiếu `var(--x)` trong giá trị token. */
function indexByVar(tokens) {
  const byVar = new Map();
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.var === 'string') byVar.set(node.var, node);
    for (const child of Object.values(node)) walk(child);
  };
  for (const [group, value] of Object.entries(tokens)) {
    if (group === 'meta' || group === 'components') continue;
    walk(value);
  }
  return byVar;
}

const byVar = (tokens) => tokens.__byVar ?? (tokens.__byVar = indexByVar(tokens));

/** Giá trị của token theo đường dẫn `nhóm.khoá[.khoá]`, đã chọn theme. */
function tokenValue(tokens, theme, path) {
  let node = tokens;
  for (const key of path.split('.')) {
    node = node?.[key];
    if (node === undefined) throw new Error(`token không tồn tại: ${path}`);
  }
  return typeof node === 'string' ? node : (node[theme] ?? node.light ?? node.value);
}

/** `color.light.<tên>` ở theme tối đọc sang `color.dark.<tên>` khi bảng tối có giá trị đó. */
function themedRef(tokens, theme, ref) {
  if (theme !== 'dark' || !ref.startsWith('color.light.')) return ref;
  const name = ref.slice('color.light.'.length);
  return tokens.color.dark?.[name] ? `color.dark.${name}` : ref;
}

/** Giá trị mà trình duyệt sẽ tính: theo theme, có thể đi qua nhiều lần `var(--x)`. */
function resolveValue(tokens, theme, value) {
  let out = value;
  for (let depth = 0; depth < 6; depth += 1) {
    const reference = out.match(/^var\((--[a-z0-9-]+)\)$/i);
    if (!reference) return out;
    const token = byVar(tokens).get(reference[1]);
    if (!token) throw new Error(`không có token cho ${out}`);
    out = token[theme] ?? token.light ?? token.value;
  }
  throw new Error(`tham chiếu token lồng quá sâu: ${value}`);
}

/** Cặp (thuộc tính CSS, token) cần đo; `font: type.x` mở thành 4 thuộc tính con + letter-spacing nếu vai trò có. */
function probePairs(tokens, styles) {
  const pairs = [];
  for (const [property, tokenRef] of Object.entries(styles)) {
    if (property !== 'font') {
      pairs.push([property, tokenRef]);
      continue;
    }
    for (const [cssProperty, field] of [['font-size', 'size'], ['font-weight', 'weight'], ['line-height', 'lineHeight'], ['font-family', 'family']]) {
      pairs.push([cssProperty, `${tokenRef}.${field}`]);
    }
    if (tokens.type[tokenRef.slice('type.'.length)]?.letterSpacing) pairs.push(['letter-spacing', `${tokenRef}.letterSpacing`]);
  }
  return pairs;
}

/** Kỳ vọng của một cặp (thuộc tính CSS, token) và cách so với giá trị computed. */
function expectation(tokens, theme, property, tokenRef) {
  if (tokenRef.startsWith('type.')) {
    const [roleName, field] = tokenRef.slice('type.'.length).split('.');
    const role = tokens.type[roleName];
    if (!role) throw new Error(`không có vai trò chữ: ${tokenRef}`);
    if (property === 'font-size') return { display: role.size, ok: (actual) => px(actual) === px(role.size) };
    if (property === 'font-weight') return { display: String(role.weight), ok: (actual) => Number(actual) === role.weight };
    if (property === 'font-family') {
      const wanted = tokens.font[role.family].value;
      return { display: wanted, ok: (actual) => firstFamily(actual) === firstFamily(wanted) };
    }
    if (property === 'line-height') {
      const wanted = px(role.size) * Number(role.lineHeight);
      return { display: `${round(wanted)}px`, ok: (actual) => Math.abs(px(actual) - wanted) <= 0.6 };
    }
    if (property === 'letter-spacing' && field === 'letterSpacing') {
      return { display: `${role.letterSpacing} × font-size`, em: Number.parseFloat(role.letterSpacing) };
    }
    throw new Error(`thuộc tính không đo được qua vai trò chữ: ${property} (${field ?? ''})`);
  }
  const raw = resolveValue(tokens, theme, tokenValue(tokens, theme, tokenRef));
  if (COLOR_PROPERTIES.has(property)) {
    const wanted = toRgb(raw);
    return { display: wanted, ok: (actual) => toRgb(actual) === wanted };
  }
  if (property === 'box-shadow') {
    const wanted = shadowSignature(raw);
    return { display: raw, ok: (actual) => shadowSignature(actual) === wanted };
  }
  const wanted = px(raw);
  return { display: raw, ok: (actual) => Math.abs(px(actual) - wanted) <= 0.5 };
}

/** Probe của một component: mảng `probes` (trạng thái riêng) hoặc `probe` đơn. */
const probesOf = (component) => component.probes ?? (component.probe ? [component.probe] : []);

async function probeTokens(options) {
  const tokens = JSON.parse(await readFile(TOKENS_PATH, 'utf8'));
  const components = Object.entries(tokens.components).filter(([, component]) => probesOf(component).length
    && (component.phaseOwner === options.phase || (component.phaseUsed ?? []).includes(options.phase)));
  const rows = [];
  const failures = [];
  const browser = await openBrowser();
  try {
    const pages = new Map();
    for (const [key, component] of components) {
      for (const probe of probesOf(component)) {
        // Trạng thái chỉ có ở mobile (menu toàn màn hình) khai `width`; mặc định 1440.
        const page = `${probe.page ?? '/'}@${probe.width ?? 1440}`;
        if (!pages.has(page)) pages.set(page, []);
        pages.get(page).push([key, component, probe]);
      }
    }
    for (const [page, entries] of pages) {
      const [path, width] = page.split('@');
      const context = await newContext(browser, { theme: options.theme, width: Number(width), height: 1000 });
      try {
        const tab = await context.newPage();
        await tab.goto(`${options.base}${path}`, { waitUntil: 'domcontentloaded' });
        let settled = false;
        for (const [key, component, probe] of entries) {
          // Chờ phần tử đầu tiên cần có mặt (mốc `ready`, hoặc bước setup, hoặc chính phần tử đo):
          // không có phần tử là lỗi thật, không bỏ qua.
          await waitAttached(tab, probe.ready ?? probe.setup?.[0] ?? probe.selector);
          if (!settled) {
            await pageSettled(tab, options.theme);
            settled = true;
          }
          const styles = probe.styles ?? component.styles;
          const pairs = probePairs(tokens, probe.styles ?? component.styles);
          if (probe.state === 'focus') {
            // Tab một lần để trình duyệt chuyển sang chế độ bàn phím, rồi focus đúng phần tử cần đo.
            await tab.keyboard.press('Tab');
            await tab.evaluate((target) => document.querySelector(target)?.focus(), probe.selector);
          }
          for (const step of probe.setup ?? []) {
            // Thao tác để trang ở trạng thái cần đo (menu mở, chip đang bật).
            await tab.click(step, { timeout: 5_000 });
            await tab.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
          }
          // Trạng thái sau setup mới có thể có phần tử đích (ví dụ chip vừa bật).
          await waitAttached(tab, probe.selector, 5_000);
          const measured = await tab.evaluate(({ target, list }) => {
            const element = document.querySelector(target);
            if (!element) return null;
            const style = getComputedStyle(element);
            return Object.fromEntries(list.map((property) => [property, style.getPropertyValue(property)]));
          }, { target: probe.selector, list: pairs.map(([property]) => property) });
          if (!measured) {
            failures.push({ key, state: probe.state ?? 'default', property: '-', actual: `không thấy phần tử (${probe.selector})`, explained: false });
            continue;
          }
          for (const [property, tokenRef] of pairs) {
            rows.push(record({
              key, component, probe, property, tokenRef, measured, tokens, theme: options.theme, failures,
            }));
          }
          if (probe.setup?.length) {
            // Probe có thao tác đổi trạng thái (bật chip, mở menu, chuyển Thẻ/Bảng) — nạp lại URL gốc của
            // trang (bỏ query do thao tác sinh ra) để probe sau vẫn đo trạng thái đầu; lựa chọn trang tự
            // ghi đã bị xóa ở init script của context.
            await tab.goto(`${options.base}${path}`, { waitUntil: 'domcontentloaded' });
            settled = false;
          }
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  const broken = rows.filter((row) => !row.ok);
  const unexplained = failures.filter((failure) => !failure.explained);
  console.log('| Component | Trạng thái | Selector | Thuộc tính | Mong đợi | Thực tế |');
  console.log('| --- | --- | --- | --- | --- | --- |');
  for (const row of broken) {
    console.log(`| ${row.key} | ${row.state} | \`${row.selector}\` | \`${row.property}\` | ${row.expected} | ${row.actual} |`);
  }
  for (const failure of failures.filter((item) => item.property === '-')) {
    console.log(`| ${failure.key} | ${failure.state} | — | — | phần tử | ${failure.actual} |`);
  }
  if (!broken.length) console.log('| — | — | — | — | không lệch |');
  console.log(`\n${rows.length - broken.length}/${rows.length} thuộc tính khớp token (theme ${options.theme}, phase ${options.phase}); ${unexplained.length} lệch chưa giải thích.`);
  for (const failure of failures.filter((item) => item.explained)) {
    console.log(`đã giải thích: ${failure.key} ${failure.property} = ${failure.actualValue} — ${failure.reason}`);
  }
  if (!rows.length) console.log('không đo được thuộc tính nào — coi như gate đỏ.');
  return { unexplained: unexplained.length, measured: rows.length };
}

/** So một thuộc tính, ghi lại lệch; component có thể khai `exceptions` (kèm `actual` cụ thể) để giải thích. */
function record({ key, component, probe, property, tokenRef, measured, tokens, theme, failures }) {
  const state = probe.state ?? 'default';
  const actual = measured[property] ?? '';
  const wanted = expectation(tokens, theme, property, themedRef(tokens, theme, tokenRef));
  let ok;
  let display = wanted.display;
  if (property === 'letter-spacing') {
    // `em` so với font-size thật của phần tử (token chỉ ghi em, không phải px).
    const fontPx = px(measured['font-size'] ?? '16px');
    const expectedPx = wanted.em * fontPx;
    display = `${wanted.display} ≈ ${round(expectedPx)}px`;
    ok = Math.abs(px(actual) - expectedPx) <= 0.2;
  } else {
    ok = wanted.ok(actual);
  }
  const row = { key, state, selector: probe.selector, property, expected: display, actual, ok };
  if (!ok) {
    // Ngoại lệ khả thi phải khai `actual` cụ thể và khớp CHÍNH XÁC kết quả đo được — không có wildcard.
    const exception = (component.exceptions ?? []).find((item) => item.property === property
      && typeof item.actual === 'string' && item.actual === actual);
    failures.push({
      key,
      state,
      property,
      actual: `${actual} (mong đợi ${display})`,
      actualValue: actual,
      explained: Boolean(exception),
      reason: exception?.reason,
    });
  }
  return row;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  const options = parseArgs(process.argv.slice(2));
  if (options.serve) {
    const server = await serve(SCREENS_DIR);
    console.log(`Ảnh chuẩn: http://127.0.0.1:${server.address().port}/Landing.png (Ctrl+C để dừng)`);
  } else if (options.tokens) {
    const { unexplained, measured } = await probeTokens(options);
    if (unexplained) {
      console.error(`${unexplained} lệch chưa giải thích so với tokens.json.`);
      process.exitCode = 1;
    } else if (!measured) {
      // Phase chưa có component nào để đo: gate đỏ, không được coi là pass.
      console.error(`Phase ${options.phase}: 0 thuộc tính đo được — chưa có probe, không tính là đạt.`);
      process.exitCode = 1;
    }
  } else {
    await capturePairs(options);
  }
}
