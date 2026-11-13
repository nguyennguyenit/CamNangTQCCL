// Chụp các màn Đội cộng đồng (/doi-cong-dong/), thông báo tài khoản bị khoá và ba khu quản trị mới (Đội cộng đồng, Người dùng,
// Nhật ký) từ bản build ở .cache/design-canvas/sitebuild cho canvas. `/api/**` giả lập bằng helper e2e dùng chung; đội mẫu lấy
// tướng + chiến pháp thật của Đội khác (id catalog) để thẻ hiện tên và chân dung đúng.
//   node scripts/design-canvas/capture-community.mjs [--debug]   → .cache/design-canvas/captures/<Board>.json
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { REPO } from './canvas-page.mjs';
import { serializeBody } from './serialize-body.mjs';
import { ADMIN, AUDIT_ROWS, PLAYER, USER_ROWS, mockCommunityApi } from '../../tests-e2e/helpers/community-mock.mjs';
import { AI_READ, ANALYSIS, COMMENTS, REPORTS, SAMPLES, SEASONS, TEAM_AUDIT, adminTeam, teamDetail, teamItem } from './community-samples.mjs';

const require = createRequire(join(REPO, 'package.json'));
const { chromium } = require('@playwright/test');
const WORK = join(REPO, '.cache/design-canvas');
const BUILD = join(WORK, 'sitebuild');
const OUT = join(WORK, 'captures');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };

const server = createServer(async (q, r) => {
  let file = join(BUILD, decodeURIComponent(new URL(q.url, 'http://x').pathname));
  try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); } catch { if (!extname(file)) file += '.html'; }
  try { r.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }).end(await readFile(file)); } catch { r.writeHead(404).end(); }
});
await new Promise((d) => server.listen(0, '127.0.0.1', d));
const BASE = `http://127.0.0.1:${server.address().port}`;
await mkdir(OUT, { recursive: true });
const sample = await readFile(join(WORK, 'chien-bao-mau.jpg'));

async function snap(page, board) {
  await page.waitForTimeout(600);
  // serializeBody không đọc lựa chọn hiện tại của <select>: ghi lại thành thuộc tính `selected` trước khi chụp.
  await page.evaluate(() => document.querySelectorAll('select').forEach((s) => [...s.options].forEach((o) => o.toggleAttribute('selected', o.selected))));
  const res = await page.evaluate(serializeBody);
  await writeFile(join(OUT, `${board}.json`), JSON.stringify(res));
  console.log(board, 'height', res.height, 'bytes', res.html.length);
}

/** Mỗi màn: tên board, cấu hình mock, đường dẫn, thao tác trước khi chụp. */
const SCREENS = [
  ['DoiCongDong', { user: PLAYER, teams: { seasons: SEASONS, list: { items: SAMPLES.map((_, i) => teamItem(i)), nextCursor: 'c2' } } }, '/doi-cong-dong/', async (page) => {
    await page.waitForSelector('.cm-team-card');
  }],
  ['DoiCongDongDetail', { user: PLAYER, comments: COMMENTS, reports: REPORTS, stats: { total: 2, wins: 1, losses: 1, draws: 0, winRate: 0.5, topOpponents: [] }, teams: { seasons: SEASONS, details: (id) => teamDetail(Number(id.slice(1)) - 1) } }, '/doi-cong-dong/?id=t1', async (page) => {
    await page.waitForSelector('.cm-team-detail');
  }],
  ['DoiCongDongNew', { user: PLAYER, teams: { seasons: SEASONS, analyze: () => ({ body: { read: AI_READ } }), list: (params) => (params.get('heroes') ? { items: [teamItem(0)], nextCursor: null } : { items: [], nextCursor: null }) } }, '/doi-cong-dong/?new=1', async (page) => {
    await page.locator('#cm-team-image-0').setInputFiles({ name: 'doi-hinh.jpg', mimeType: 'image/jpeg', buffer: sample });
    const read = page.getByRole('button', { name: 'Đọc bằng AI' }).first();
    await read.waitFor();
    await page.waitForTimeout(400);
    await read.click();
    await page.waitForSelector('#cm-team-cell-0-0');
    await page.waitForTimeout(800);
    await page.locator('#cm-team-title-input').fill('Vũ Tung Úc — PK đầu mùa');
    await page.locator('#cm-team-troop').selectOption('thuong');
    await page.locator('#cm-team-playstyle').fill(ANALYSIS.playstyle);
  }],
  ['DoiCongDongMine', { user: PLAYER, teams: { seasons: SEASONS, mine: { items: [
    teamItem(0, { status: 'pending', author: PLAYER }),
    teamItem(3, { status: 'rejected', rejectReason: 'Ảnh không thấy rõ chiến pháp của tướng thứ ba.', author: PLAYER }),
    teamItem(1, { status: 'approved', author: PLAYER }),
  ], nextCursor: null } } }, '/doi-cong-dong/?mine=1', async (page) => {
    await page.waitForSelector('.cm-team-card');
  }],
  ['BanNotice', { banNotice: { status: 200, body: { until: '2026-10-29T08:00:00.000Z', reason: 'Spam quảng cáo trong bình luận', deleting: false } }, teams: { seasons: SEASONS, list: { items: SAMPLES.slice(0, 3).map((_, i) => teamItem(i)), nextCursor: null } } }, '/doi-cong-dong/?error=ACCOUNT_BANNED&error_description=tok', async (page) => {
    await page.locator('#community-auth').getByRole('alert').waitFor();
  }],
  ['AdminTeams', { user: ADMIN, users: USER_ROWS(), teams: { seasons: SEASONS, details: (id) => teamDetail(Number(id.slice(1)) - 1), admin: [adminTeam(0), adminTeam(1), adminTeam(2)] } }, '/quan-tri/#doi-cong-dong', async (page) => {
    const panel = page.getByRole('region', { name: 'Đội cộng đồng', exact: true });
    await panel.locator('.adm-team').first().waitFor();
    await panel.locator('.adm-team').first().getByText('Xem phân tích').click();
    await page.waitForTimeout(500);
  }],
  ['AdminUsers', { user: ADMIN, users: USER_ROWS(), teams: { seasons: SEASONS, admin: [adminTeam(0), adminTeam(1)] } }, '/quan-tri/#nguoi-dung', async (page) => {
    await page.getByRole('region', { name: 'Người dùng', exact: true }).locator('.adm-user').first().waitFor();
  }],
  ['AdminUserBan', { user: ADMIN, users: USER_ROWS(), auditItems: AUDIT_ROWS(), teams: { seasons: SEASONS, admin: [adminTeam(0), adminTeam(1)] } }, '/quan-tri/#nguoi-dung', async (page) => {
    const panel = page.getByRole('region', { name: 'Người dùng', exact: true });
    await panel.locator('.adm-user-open', { hasText: 'Lưu Bị' }).click();
    await panel.getByRole('heading', { name: 'Lưu Bị' }).waitFor();
    await panel.getByRole('button', { name: 'Khoá…', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Khoá tài khoản' });
    await dialog.getByLabel('Thời hạn').selectOption('7d');
    await dialog.getByLabel('Lý do').fill('Spam liên tục ở bình luận Đội chuẩn');
  }],
  ['AdminAudit', { user: ADMIN, auditItems: [...TEAM_AUDIT, ...AUDIT_ROWS()], teams: { seasons: SEASONS, admin: [adminTeam(0), adminTeam(1)] } }, '/quan-tri/#nhat-ky', async (page) => {
    await page.getByRole('region', { name: 'Nhật ký', exact: true }).locator('.adm-audit').first().waitFor();
  }],
];

const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const browser = await chromium.launch();
for (const [board, mock, path, act] of SCREENS) {
  if (only.length && !only.includes(board)) continue;
  for (const [suffix, width] of [['', 1440], ['Mobile', 390]]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.route('https://challenges.cloudflare.com/**', (route) => route.fulfill({ contentType: 'text/javascript', body: 'window.turnstile={render:function(b,o){setTimeout(function(){o.callback("dc-token")},30);return "w1"},reset:function(){},remove:function(){},getResponse:function(){return "dc-token"}};' }));
    await mockCommunityApi(page, mock);
    await page.goto(`${BASE}${path}`, { waitUntil: 'load' });
    await page.waitForSelector('.site-footer');
    await act(page);
    await page.waitForTimeout(800);
    await snap(page, board + suffix);
    await page.close();
  }
}
await browser.close();
server.close();
