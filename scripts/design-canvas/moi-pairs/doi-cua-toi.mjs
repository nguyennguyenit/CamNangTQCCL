// Cặp so ảnh của nhóm Đội của tôi: DoiCuaToi (+ DoiCuaToiMobile).
// Chỉ nhánh của nhóm này sửa file này. Hình dạng cặp và trạng thái mock: đầu file scripts/design-canvas/compare-moi.mjs.
// Chạy riêng nhóm: node scripts/design-canvas/compare-moi.mjs --only doi-cua-toi --base <url preview>
//
// Trang tải `/api/roster` (mock cộng đồng không có): cặp mở trang ở trạng thái khách (`ready: '.mt-guest'`), rồi `setup`
// gắn máy chủ roster giả của e2e (tests-e2e/helpers/roster-mock.mjs, route đăng ký sau nên thắng mock cộng đồng), nạp
// dữ liệu mẫu theo artboard và tải lại. Artboard mặc định vẽ trình soạn của đội đầu mở sẵn, bảng chọn chiến pháp 2 của
// tướng 2 đang tìm "bạo"; kho của hộp 48 tướng · 63 chiến pháp, thiếu Hạ Hầu Uyên, Tả Từ, Bạo Lệ Vô Nhân, Văn Võ Song Toàn.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT_DIR } from '../../design-tokens.mjs';
import { createRosterServer } from '../../../tests-js/support/roster-fake-server.mjs';
import { ALICE, mockRoster, seedBox, seedTeam } from '../../../tests-e2e/helpers/roster-mock.mjs';

const read = (file) => JSON.parse(readFileSync(join(ROOT_DIR, 'data', file), 'utf8'));
const HEROES = read('heroes-dict.json');
const TACTICS = read('tactics.json').filter((row) => row && typeof row.id === 'string');

const slot = (primary, alternatives = []) => ({ primary, alternatives, rawName: '' });
const hero = (id, [t1, t2], { alts = [[], []], books = [], troopNote = '', statNote = '', redStars = null } = {}) => ({
  hero: `hero:${id}`,
  slotState: 'ok',
  rawName: '',
  heroAlternatives: [],
  redStars,
  tactics: [slot(`tactic:${t1}`, alts[0].map((t) => `tactic:${t}`)), slot(`tactic:${t2}`, alts[1].map((t) => `tactic:${t}`))],
  books: books.map((book) => `book:${book}`),
  bookType: '',
  troopNote,
  statNote,
  gearNote: '',
});
const notes = (general = '', extra = {}) => ({ general, strengths: '', goodAgainst: '', avoid: '', ...extra });
const team = (id, name, source, heroes, more = {}) => ({ id, name, seasonId: 'og-兵演春秋', tierLabel: '', replacesTeamId: null, heroes, notes: notes(), userAlternatives: [], source, ...more });

const BOOKS_LU = ['di-truc-bao-oan', 'tinh-chuan', 'tri-trong'];
const TEAMS = [
  {
    group: 'main~khai-hoang',
    draft: team('team-mau-a', 'Gia Cát Khác · SP Mã Siêu · Pháp Chính', { kind: 'khaihoang', key: 'gia-cat-khac-sp-ma-sieu-phap-chinh', contentHash: '' }, [
      hero('gia-cat-khac', ['giai-phien-ve', 'danh-bai-quan-dich'], { troopNote: 'Thương · Chủ tướng trước cấp 20', statNote: 'Toàn Thống Soái' }),
      hero('sp-ma-sieu', ['mau-gianh-loi-the', 'bao-le-vo-nhan'], { alts: [['thoi-phong-doan-nhan'], []], troopNote: 'Thương' }),
      hero('phap-chinh', ['tiem-long-tran', 'thinh-khi-linh-dich'], { alts: [['tam-the-tran'], []], troopNote: 'Thương · Chủ tướng sau cấp 20' }),
    ], {
      notes: notes('Sau cấp 20 để Pháp Chính làm chủ tướng.', { strengths: 'Ăn đất Thương cấp 5 ổn, không cần đỏ.', avoid: 'Tào Chương Khiên, Hoàng Quyền Cung, Trần Kiểu Khiên ở đất 5.' }),
    }),
  },
  {
    group: 'main~khai-hoang',
    draft: team('team-mau-b', 'Khương Duy · Hạ Hầu Uyên · Gia Cát Khác', { kind: 'khaihoang', key: 'khuong-duy-ha-hau-uyen-gia-cat-khac', contentHash: '' }, [
      hero('khuong-duy', ['vo-duong-phi-quan', 'thoi-co-chien-thang'], { troopNote: 'Cung' }),
      hero('ha-hau-uyen', ['loa-y-huyet-chien', 'mau-gianh-loi-the'], { troopNote: 'Cung' }),
      hero('gia-cat-khac', ['tiem-long-tran', 'thinh-khi-linh-dich'], { alts: [['bat-mon-kim-toa-tran'], []], troopNote: 'Cung · Chủ tướng sau cấp 20' }),
    ], { replacesTeamId: 'team-mau-a', notes: notes('Sau cấp 20 dùng Bát Môn Kim Tỏa Trận thay Tiềm Long Trận trên Gia Cát Khác.') }),
  },
  {
    group: 'main~ghep-team',
    draft: team('team-mau-c', '40Y Lữ Bố Cung (Vương Dị, Pháp Chính)', { kind: 'recommended', key: 's27-han-hanshi-gong-1', contentHash: '0123456789abcdef' }, [
      hero('lu-bo', ['dan-huyen-luc-chien', 'huyet-dao-tranh-gianh'], { books: BOOKS_LU, statNote: 'Cộng Võ Lực', redStars: 3 }),
      hero('vuong-di', ['doat-hon-hiep-phach', 'duong-phong-thoi-quyet'], { books: ['ky-chinh-tuong-sinh', 'van-thao', 'giau-dao'] }),
      hero('sp-phap-chinh', ['tam-the-tran', 'lam-nguy-cuu-chu'], { books: ['tam-quan-chi-chung', 'ren-luyen', 'dan-quan'], redStars: 1 }),
    ], { tierLabel: 'T0', notes: notes('Thử Giấu Đao trên Vương Dị trước khi đổi binh thư.') }),
  },
  {
    group: 'main~ghep-team',
    draft: team('team-mau-d', 'Lữ Quách Kiều (Tinh·Bạch Mã Nghĩa Tòng)', { kind: 'roster-recommend', key: 'roster-lu-quach-kieu', contentHash: '' }, [
      hero('lu-bo', ['loan-cung-am-vu', 'pha-giap'], { books: ['danh-bat-ngo-thang', 'tri-trong', 'tinh-chuan'] }),
      hero('quach-gia', ['tam-the-tran', 'hoa-thieu-lien-doanh'], { books: ['tam-quan-chi-chung', 'ren-luyen', 'dan-quan'] }),
      hero('tieu-kieu', ['van-vo-song-toan', 'tinh-bach-ma-nghia-tong'], { books: BOOKS_LU }),
    ], { tierLabel: 'T1', userAlternatives: [{ heroIndex: 2, slotIndex: 0, tactic: 'tactic:lam-nguy-cuu-chu' }] }),
  },
  {
    group: 'main~ghep-team',
    draft: team('team-mau-e', 'Gia Cát Khác · Thái Sử Từ · Tả Từ', { kind: 'analyze', key: 'analyze-0123456789abcdef', contentHash: '' }, [
      hero('gia-cat-khac', ['vo-phong-tran', 'thinh-khi-linh-dich']),
      hero('thai-su-tu', ['thoi-phong-doan-nhan', 'mau-gianh-loi-the']),
      hero('ta-tu', ['vo-duong-phi-quan', 'thoi-co-chien-thang']),
    ], { seasonId: null, notes: notes('', { goodAgainst: 'Đất 5 nhiều quân thủ Thương, ưu tiên đánh Phan Chương.' }) }),
  },
];
const MISSING = new Set(['hero:ha-hau-uyen', 'hero:ta-tu', 'tactic:bao-le-vo-nhan', 'tactic:van-vo-song-toan']);

/** Kho của hộp main: mọi món của 5 đội trừ `MISSING`, thêm món khác của từ điển cho đủ 48 tướng · 63 chiến pháp. */
function stock() {
  // Bạo Liễm Tứ Phương: món "có trong kho" mà bảng chọn của artboard vẽ cạnh Bạo Lệ Vô Nhân.
  const used = ['tactic:bao-liem-tu-phuong', ...TEAMS.flatMap(({ draft }) => draft.heroes.flatMap((item) => [item.hero, ...item.tactics.map((entry) => entry.primary), ...item.tactics.flatMap((entry) => entry.alternatives)]))];
  const fill = (prefix, rows, total) => {
    const items = [...new Set(used.filter((id) => id.startsWith(prefix) && !MISSING.has(id)))];
    for (const row of rows) {
      if (items.length >= total) break;
      if (!items.includes(row.id) && !MISSING.has(row.id)) items.push(row.id);
    }
    return items;
  };
  return [...fill('hero:', HEROES, 48), ...fill('tactic:', TACTICS, 63)];
}

/** Máy chủ roster giả có dữ liệu mẫu; `withStock: false` = hộp chưa có kho. */
async function seededServer({ withStock = true } = {}) {
  const server = await createRosterServer({ userId: ALICE.id });
  const base = Date.now() - 600_000;
  await seedBox(server, 'main', { at: base });
  const iso = new Date(base).toISOString();
  await server.seed({ kind: 'group', id: 'grp-thu-doi-pk-s27', updatedAt: base, deleted: false, data: { id: 'grp-thu-doi-pk-s27', boxId: 'main', name: 'Thử đội PK-S27', order: 2, updatedAt: iso, deletedAt: '' } });
  // Đội đứng trước trong mảng mới hơn (nhóm xếp đội mới nhất lên đầu).
  for (const [index, { draft, group }] of TEAMS.entries()) await seedTeam(server, draft, { groupId: group, at: base + 60_000 - index * 1000 });
  if (withStock) {
    for (const item of stock()) {
      const id = `main~${item}`;
      await server.seed({ kind: 'owned', id, updatedAt: base, deleted: false, data: { id, boxId: 'main', item, name: item, type: item.startsWith('hero:') ? 'hero' : 'tactic', updatedAt: iso, deletedAt: '' } });
    }
  }
  return server;
}

/** Đăng nhập + dữ liệu mẫu rồi tải lại; `edit` mở trình soạn của đội đầu như artboard (bảng chọn đang tìm "bạo"). */
export const signedIn = ({ edit = true, withStock = true } = {}) => async (page) => {
  await mockRoster(page, { server: await seededServer({ withStock }) });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.mt-team', { timeout: 20_000 });
  if (!edit) return;
  await page.locator('.mt-team[data-team-id="team-mau-a"]').getByRole('button', { name: 'Sửa', exact: true }).click();
  const second = page.locator('form.mt-editor .mt-edit-hero').nth(1);
  // Mobile: tướng 2 đang thu gọn (`<details>`), mở ra như artboard trước khi bấm Đổi.
  if (await second.evaluate((node) => node.tagName === 'DETAILS' && !node.open)) await second.locator('summary').click();
  await second.locator('[data-picker-key="1-t1"]').click();
  await page.locator('.mt-picker input[type="search"]').fill('bạo');
  await page.locator('.mt-picker-opt').first().waitFor();
  // Ảnh fullPage chụp từ đầu trang: bỏ focus khỏi ô tìm (artboard không vẽ vòng focus) và cuộn về đầu để header dính
  // nằm đúng chỗ.
  await page.evaluate(() => {
    document.activeElement?.blur();
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  // Focus vào ô tìm cuộn trang bằng `scroll-behavior: smooth`: chờ cuộn xong hẳn ở đầu trang (header dính đúng chỗ).
  await page.waitForFunction(() => window.scrollY === 0);
  await page.waitForTimeout(400);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.mouse.move(0, 0);
};

export default [
  { artboard: 'DoiCuaToi', path: '/doi-cua-toi/', width: 1440, ready: '.mt-guest', setup: signedIn() },
  { artboard: 'DoiCuaToiMobile', path: '/doi-cua-toi/', width: 390, ready: '.mt-guest', setup: signedIn() },
];

/** Thao tác dựng trạng thái phụ (khách = không gọi; danh sách không mở trình soạn; hộp chưa có kho) cho script so ảnh riêng. */
export const setupStates = {
  danhSach: signedIn({ edit: false }),
  chuaCoKho: signedIn({ edit: false, withStock: false }),
};
