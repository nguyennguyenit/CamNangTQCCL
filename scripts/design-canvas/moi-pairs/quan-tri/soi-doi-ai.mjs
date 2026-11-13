// Cặp so ảnh khu soi-doi-ai của nhóm Quản trị (gộp ở ../quan-tri.mjs): AdminAnalyze (#soi-doi) và AdminAIFeatures (#ai).
// Mock chung chưa có `/api/admin/scan-stats`, `/api/admin/scan-samples` và luôn trả `scanPending: 0`, nên `setup` tự route
// các endpoint đó bằng dữ liệu giống artboard rồi tải lại trang (route phải có trước khi khu Soi đội gọi API).
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PROJECT_DIR } from '../../../design-artboards.mjs';

/** Ảnh chiến báo mẫu mà artboard dùng (compare-moi chỉ thay ảnh chiến báo/đội, không thay ảnh mẫu soi đội). */
const SAMPLE_IMAGE = join(PROJECT_DIR, '_blob/8eb2dc821d7ff0a8329d3b7b3d1d3fdc');

/** Bảng tỷ lệ 4 dòng như artboard: % = edited/read, unclear/read. */
const SCAN_STATS = [
  { screen: 'battleReport', side: 'left', events: 412, read: 1000, edited: 68, unclear: 21 },
  { screen: 'battleReport', side: 'right', events: 157, read: 500, edited: 47, unclear: 18 },
  { screen: 'teamDetail', side: 'left', events: 238, read: 1000, edited: 32, unclear: 9 },
  { screen: 'other', side: 'left', events: 21, read: 350, edited: 50, unclear: 21 },
];

const read = (nameCn, tacticsCn) => ({ nameCn, tacticsCn, booksCn: [], statFocusCn: '' });
const hero = (id, tactics, book = null) => ({ hero: id, tactics, book });
const AUTHOR = { name: 'Tiểu Tướng Quân', image: null };

/** Hai mẫu chờ duyệt: mẫu 1 có một ô "đã sửa" (AI đọc 速乘其力, người dùng chọn Mau Giành Lợi Thế), mẫu 2 có hai ô Để trống. */
const SCAN_SAMPLES = [
  {
    id: 's1', screen: 'battleReport', side: 'left', lang: 'vi', status: 'pending', hasImage: true,
    createdAt: '2026-11-10T14:42:00.000Z', author: AUTHOR,
    aiRead: { heroes: [read('诸葛恪', ['武锋阵', '盛气凌敌']), read('太史慈', ['摧锋断刃', '速乘其力']), read('左慈', ['无当飞军', '临机制胜'])] },
    confirmed: { heroes: [
      hero('hero:gia-cat-khac', ['tactic:vo-phong-tran', 'tactic:thinh-khi-linh-dich']),
      hero('hero:thai-su-tu', ['tactic:thoi-phong-doan-nhan', 'tactic:mau-gianh-loi-the']),
      hero('hero:ta-tu', ['tactic:vo-duong-phi-quan', 'tactic:thoi-co-chien-thang']),
    ] },
  },
  {
    id: 's2', screen: 'battleReport', side: 'right', lang: 'vi', status: 'pending', hasImage: true,
    createdAt: '2026-11-10T14:44:00.000Z', author: AUTHOR,
    aiRead: { heroes: [read('丁奉', ['骁军定北', '轻勇飞燕']), read('陈武', ['避实击虚', '御敌屏障']), read('董袭', ['顿兵坚城', '落凤'])] },
    confirmed: { heroes: [
      hero('hero:dinh-phung', [null, 'tactic:khinh-dung-phi-yen']),
      hero('hero:tran-vo', ['tactic:ti-thuc-kich-hu', 'tactic:ngu-dich-binh-chuong']),
      hero('hero:dong-tap', [null, 'tactic:lac-phuong']),
    ] },
  },
];

const COUNTS = { reportsPending: 7, postsDraft: 12, feedbackNew: 5, feedbackDone: 0, scanPending: 4, teamsPending: 3 };

/** Route các endpoint Soi đội + số đếm rồi tải lại trang để khu dựng bằng dữ liệu này. */
const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

/** Số đếm trên điều hướng như artboard (mock chung luôn trả 0 cho Soi đội và Bài viết). */
const routeCounts = (page) => page.route((url) => url.pathname === '/api/admin/counts', (route) => json(route, COUNTS));

async function scanSetup(page) {
  const image = await readFile(SAMPLE_IMAGE);
  await routeCounts(page);
  await page.route((url) => url.pathname === '/api/admin/scan-stats', (route) => json(route, { days: 30, rows: SCAN_STATS }));
  await page.route((url) => url.pathname === '/api/admin/scan-samples', (route) => {
    const status = new URL(route.request().url()).searchParams.get('status') || 'pending';
    return json(route, { items: SCAN_SAMPLES.filter((sample) => sample.status === status), nextCursor: status === 'pending' ? 'c2' : null });
  });
  await page.route((url) => /^\/api\/admin\/scan-samples\/[^/]+\/image$/.test(url.pathname), (route) => (
    route.fulfill({ status: 200, contentType: 'image/jpeg', body: image })
  ));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#adm-panel-scan .adm-scan-sample .adm-scan-chip', { timeout: 20_000 });
}

/** Ba nhà cung cấp + bốn nhóm như artboard AdminAIFeatures (catalog mẫu = AI_PRESETS của mock). */
const AI_CONFIG = {
  providers: [
    {
      id: 'p-deepseek', label: 'DeepSeek', preset: 'deepseek', endpoint: 'https://api.deepseek.com/chat/completions', enabled: true,
      apiKey: 'sk-demo-a1f3',
      extraModels: [{ modelId: 'deepseek-v4-pro', vision: false, effortStyle: 'deepseek', efforts: ['off', 'low', 'high', 'max'] }],
    },
    {
      id: 'p-zen', label: 'OpenCode Zen', preset: 'opencode-zen', endpoint: 'https://opencode.ai/zen/v1/chat/completions', enabled: true,
      apiKey: 'sk-demo-9c2e',
      extraModels: [
        { modelId: 'deepseek-v4-flash-vision-exp', vision: true, effortStyle: 'deepseek', efforts: ['off', 'low', 'high', 'max'] },
        { modelId: 'deepseek-v4-pro', vision: false, effortStyle: 'deepseek', efforts: ['off', 'low', 'high', 'max'] },
      ],
    },
    {
      id: 'p-custom', label: 'Dự phòng tuỳ chỉnh', preset: '', endpoint: 'https://api.example-ai.com/v1/chat/completions', enabled: false,
      apiKey: 'sk-demo-47d0',
      extraModels: [{ modelId: 'vision-lite', vision: true, effortStyle: 'none', efforts: ['default'] }],
    },
  ],
  groups: {
    teamScan: { timeoutMs: 45_000, budgetMs: 90_000, chain: [
      { providerId: 'p-deepseek', modelId: 'deepseek-flash', effort: 'off' },
      { providerId: 'p-zen', modelId: 'deepseek-v4.1-flash', effort: 'low' },
    ] },
    rosterRecommend: { timeoutMs: 60_000, budgetMs: 120_000, chain: [
      { providerId: 'p-zen', modelId: 'deepseek-v4-flash-vision-exp', effort: 'low' },
      { providerId: 'p-deepseek', modelId: 'deepseek-flash', effort: 'off' },
    ] },
    explainSubstitute: { timeoutMs: 30_000, budgetMs: 60_000, chain: [
      { providerId: 'p-deepseek', modelId: 'deepseek-v4-pro', effort: 'high' },
      { providerId: 'p-zen', modelId: 'deepseek-v4-flash', effort: 'off' },
    ] },
    battleReport: { timeoutMs: 45_000, budgetMs: 45_000, chain: [
      { providerId: 'p-custom', modelId: 'vision-lite', effort: 'default' },
    ] },
  },
};

/** Artboard vẽ trạng thái có thay đổi chưa lưu: tắt rồi bật lại nhà cung cấp cuối (cấu hình không đổi, dòng báo hiện). */
async function aiSetup(page) {
  await routeCounts(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#adm-panel-ai .adm-ai-group', { timeout: 20_000 });
  const toggle = () => page.locator('#adm-panel-ai .adm-ai-provider').last().locator('[data-action="toggle"]').click();
  await toggle();
  await toggle();
  await page.evaluate(() => document.activeElement?.blur());
  await page.mouse.move(0, 0);
}

const scanPair = (artboard, width) => ({
  artboard, width, path: '/quan-tri/#soi-doi', ready: '#adm-panel-scan:not([hidden])', setup: scanSetup, mock: { state: 'quan-tri' },
});
const aiPair = (artboard, width) => ({
  artboard, width, path: '/quan-tri/#ai', ready: '#adm-panel-ai .adm-ai-group', setup: aiSetup, mock: { state: 'quan-tri', aiConfig: AI_CONFIG },
});

export default [
  scanPair('AdminAnalyze', 1440),
  scanPair('AdminAnalyzeMobile', 390),
  aiPair('AdminAIFeatures', 1440),
  aiPair('AdminAIFeaturesMobile', 390),
];
