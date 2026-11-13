// Cặp so ảnh của nhóm Bài viết + Đội chuẩn có kho: BaiVietDetail, MainKho (+ …Mobile).
// Chỉ nhánh của nhóm này sửa file này. Hình dạng cặp và trạng thái mock: đầu file scripts/design-canvas/compare-moi.mjs.
// Chạy riêng nhóm: node scripts/design-canvas/compare-moi.mjs --only bai-viet-kho --base <url preview>
//
// Bài viết chỉ có khi build gọi API cộng đồng, nên `--base` là dev server có bài mẫu:
//   node scripts/design-canvas/bai-viet-fixture.mjs --port 4371   (rồi --base http://127.0.0.1:4371)
// MainKho chụp trạng thái "Có kho": kho local gồm đúng tướng + chiến pháp của 4 đội mùa OG (dựng từ generation Đội chuẩn
// đang pin, như e2e badge kho), ghi vào localStorage rồi phát `pageshow` cho trang đọc lại. Trạng thái "Chưa có kho" là trang mặc định (không có kho):
//   --pair '{"artboard":"MainKho","path":"/doi-chuan/","width":1440,"ready":".reference-roster-bar[data-state=\"empty\"]"}'
//   với --out khác để không đè ảnh "Có kho".
import { readFileSync } from 'node:fs';
import { buildSeasonCandidates } from '../../../js/roster-season-candidates.js';
import { FIXTURE_SLUG } from '../bai-viet-fixture.mjs';

const read = (path) => JSON.parse(readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8'));
const SCAN_KEY = 'tqccl.rosterRecommend.scanState.v1';
const SEASON = 'og-兵演春秋';
/** Bốn đội "Ráp được" của artboard MainKho (map COV trong renderVals). */
const READY_TEAMS = ['og-bingyan-40y-lvbu-b', 'og-bingyan-wunv-cavalry-hubaoqi', 'og-bingyan-lvguoqiao-baima', 'og-bingyan-taishici-bow'];

/** Kho có đúng tướng và chiến pháp đã đối chiếu của các đội `READY_TEAMS`. */
function rosterJson() {
  const { generationId } = read('src/data/recommended-reference/current.json');
  const { records } = read(`src/data/recommended-reference/${generationId}/index.json`);
  const dicts = { heroesDict: read('data/heroes-dict.json'), tacticsDict: read('data/tactics.json') };
  const { teams } = buildSeasonCandidates(records.filter((record) => READY_TEAMS.includes(record.sourceConfigId)), SEASON, dicts);
  const heroes = new Set();
  const tactics = new Set();
  for (const team of teams) {
    for (const hero of team.heroes) {
      heroes.add(hero.name);
      for (const tactic of hero.tactics) if (!tactic.unresolved) tactics.add(tactic.name);
    }
  }
  return JSON.stringify({
    ownedHeroes: [...heroes].map((name) => ({ name })),
    ownedTactics: [...tactics].map((name) => ({ name })),
    lockedTeams: [],
    confirmed: true,
    updatedAt: '2026-11-11T00:00:00.000Z',
  });
}

/**
 * Ghi kho rồi cho trang đọc lại như khi trả về từ bfcache (`pageshow` persisted); chờ thanh kho ở trạng thái có kho.
 * Không tải lại: `newContext` của compare xoá localStorage ở mỗi lần tải trang.
 */
async function withRoster(page) {
  const roster = rosterJson();
  await page.evaluate(([key, value]) => {
    localStorage.setItem(key, value);
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  }, [SCAN_KEY, roster]);
  await page.waitForSelector('#section-team-chuan .reference-roster-bar[data-state="ready"]', { timeout: 20_000 });
}

const article = `/bai-viet/${FIXTURE_SLUG}/`;
const kho = { path: '/doi-chuan/', ready: '#section-team-chuan .reference-roster-bar[data-state]', setup: withRoster };

export default [
  { artboard: 'BaiVietDetail', path: article, width: 1440, ready: '.bv-body' },
  { artboard: 'BaiVietDetailMobile', path: article, width: 390, ready: '.bv-body' },
  { artboard: 'MainKho', width: 1440, ...kho },
  { artboard: 'MainKhoMobile', width: 390, ...kho },
];
