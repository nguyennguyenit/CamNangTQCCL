// Cặp so ảnh của nhóm Đội cộng đồng: DoiCongDongMoi, DoiCongDongDetailMoi, DoiCongDongNewMoi, DoiCongDongMineMoi, BanNoticeMoi (+ …Mobile).
// Chỉ nhánh của nhóm này sửa file này. Hình dạng cặp và trạng thái mock: đầu file scripts/design-canvas/compare-moi.mjs.
// Chạy riêng nhóm: node scripts/design-canvas/compare-moi.mjs --only doi-cong-dong --base <url preview>
//
// Chi tiết đội so ở chế độ SPA `?id=t1` (preview không có trang tĩnh `/doi-cong-dong/<id>/` vì build không gọi API):
// khung SPA và trang tĩnh dùng cùng class (js/community-team-detail.js ↔ CommunityTeamPage.astro).
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PROJECT_DIR } from '../../design-artboards.mjs';
import { REPORTS, SAMPLES, teamItem } from '../community-samples.mjs';
import { MOCK_STATES } from '../moi-mock-states.mjs';

/** Danh sách như artboard: điểm theo công thức trang (lên − xuống + 2 × người thắng), số ảnh khác nhau, một đội không ảnh. */
function listItems() {
  const images = [1, 2, 1, 0, 3, 1]; // Lượng Hưng Bào (mục 4) là thẻ "Chưa có ảnh đội".
  return SAMPLES.map((_, index) => {
    const item = teamItem(index, { imageCount: images[index] });
    return { ...item, points: item.upVotes - item.downVotes + 2 * item.evidenceCount };
  });
}

/** Mock người chơi đăng nhập + danh sách đội theo artboard. */
function listMock() {
  const base = MOCK_STATES['dang-nhap']();
  return { state: 'dang-nhap', teams: { ...base.teams, list: { items: listItems(), nextCursor: 'c2' } } };
}

/** Mock chi tiết: chiến báo có ảnh, số liệu chiến báo + đối thủ thường gặp như artboard. */
function detailMock() {
  const base = MOCK_STATES['dang-nhap']();
  return {
    state: 'dang-nhap',
    teams: { ...base.teams, list: { items: listItems(), nextCursor: null } },
    // Chiến báo có ảnh như artboard (route ảnh mẫu của compare-moi phục vụ `/api/reports/<id>/image`).
    reports: REPORTS.map((report) => ({ ...report, imageUrl: `/api/reports/${report.id}/image` })),
    stats: {
      total: 14,
      wins: 10,
      losses: 3,
      draws: 1,
      winRate: 10 / 14,
      topOpponents: [
        { heroes: ['张飞', '关银屏', '赵云'], count: 4, wins: 2 },
        { heroes: ['吕蒙', '陆逊', '鲁肃'], count: 3, wins: 2 },
        { heroes: ['诸葛亮', '关兴', '张苞'], count: 2, wins: 2 },
      ],
    },
  };
}

const SAMPLE_IMAGE = join(PROJECT_DIR, '_blob/8eb2dc821d7ff0a8329d3b7b3d1d3fdc');

/** Form đăng như artboard: 2 ảnh, đọc AI ảnh 1, tiêu đề, binh chủng Thương, lối chơi, điểm mạnh. */
async function fillTeamForm(page) {
  const buffer = await readFile(SAMPLE_IMAGE);
  const file = { name: 'team.jpg', mimeType: 'image/jpeg', buffer };
  await page.setInputFiles('#cm-team-image-0', file);
  await page.locator('.cm-team-image-slot').nth(0).getByRole('button', { name: 'Đọc bằng AI' }).click();
  await page.waitForSelector('.cm-team-image-slot:nth-child(1) .cm-team-slot-status[data-kind="ok"]');
  await page.setInputFiles('#cm-team-image-1', file);
  await page.locator('.cm-team-image-slot').nth(1).getByRole('button', { name: 'Đọc bằng AI' }).waitFor();
  await page.fill('#cm-team-title-input', 'Vũ Tung Úc — PK đầu mùa');
  await page.locator('#cm-team-troop input[value="thuong"]').check();
  await page.fill('#cm-team-playstyle', 'Đội Thương đánh nhanh: SP Quan Vũ làm chủ lực, SP Hoàng Phủ Tung mở Phong Thỉ Trận cho chủ tướng, SP Tuân Úc giữ nhịp ở hàng sau bằng Uy Mưu Vô Địch.');
  // Mobile gập "Phân tích thêm" sau một nút; mở ra như artboard trước khi điền.
  const extra = page.locator('.cm-team-extra-toggle');
  if (await extra.isVisible()) await extra.click();
  await page.fill('#cm-team-strengths', 'Dồn sát thương sớm, hợp đánh đội chưa kịp dựng giáp.');
  await page.evaluate(() => window.scrollTo(0, 0));
}

/** Ảnh tải lười (ảnh chiến báo dưới màn hình) không kịp hiện khi chụp cả trang: nạp ngay rồi chờ giải mã. */
async function loadAllImages(page) {
  await page.evaluate(async () => {
    for (const image of document.querySelectorAll('img[loading="lazy"]')) image.loading = 'eager';
    await Promise.all([...document.images].map((image) => image.decode().catch(() => {})));
  });
}

const BAN_PATH = '/doi-cong-dong/?error=ACCOUNT_BANNED&error_description=tok';

export default [
  { artboard: 'DoiCongDongMoi', path: '/doi-cong-dong/', width: 1440, ready: '.cm-team-card .cm-team-card-portrait img', mock: listMock() },
  { artboard: 'DoiCongDongMoiMobile', path: '/doi-cong-dong/', width: 390, ready: '.cm-team-card .cm-team-card-portrait img', mock: listMock() },
  { artboard: 'DoiCongDongDetailMoi', path: '/doi-cong-dong/?id=t1', width: 1440, ready: '.cm-comments .cm-comment', mock: detailMock(), setup: loadAllImages },
  { artboard: 'DoiCongDongDetailMoiMobile', path: '/doi-cong-dong/?id=t1', width: 390, ready: '.cm-comments .cm-comment', mock: detailMock(), setup: loadAllImages },
  { artboard: 'DoiCongDongNewMoi', path: '/doi-cong-dong/?new=1', width: 1440, ready: '.cm-team-form', mock: 'dang-nhap', setup: fillTeamForm },
  { artboard: 'DoiCongDongNewMoiMobile', path: '/doi-cong-dong/?new=1', width: 390, ready: '.cm-team-form', mock: 'dang-nhap', setup: fillTeamForm },
  { artboard: 'DoiCongDongMineMoi', path: '/doi-cong-dong/?mine=1', width: 1440, ready: '.cm-team-mine-card', mock: 'dang-nhap' },
  { artboard: 'DoiCongDongMineMoiMobile', path: '/doi-cong-dong/?mine=1', width: 390, ready: '.cm-team-mine-card', mock: 'dang-nhap' },
  { artboard: 'BanNoticeMoi', path: BAN_PATH, width: 1440, ready: '.cm-auth-notice .cm-auth-notice-title', mock: 'bi-khoa' },
  { artboard: 'BanNoticeMoiMobile', path: BAN_PATH, width: 390, ready: '.cm-auth-notice .cm-auth-notice-title', mock: 'bi-khoa' },
];
