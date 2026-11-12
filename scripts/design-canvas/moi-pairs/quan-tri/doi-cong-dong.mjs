// Cặp so ảnh khu doi-cong-dong của nhóm Quản trị (gộp ở ../quan-tri.mjs).
// Mock `quan-tri` (root) có 3 đội chờ duyệt `adminTeam(0..2)` và chi tiết đội (phân tích + chiến pháp). Trạng thái như
// artboard: đội đầu mở "Xem phân tích", đội thứ hai mở form từ chối có sẵn lý do mẫu, form "Mở mùa mới" mở sẵn, điền chữ mẫu.
const REJECT_REASON = 'Ảnh chưa thấy chiến pháp của Triệu Vân. Bạn gửi lại ảnh màn chi tiết đội đủ 3 tướng nhé.';

/** Mở phân tích đội đầu (chờ API chi tiết vẽ xong) và form từ chối đội thứ hai. */
async function setup(page) {
  const panel = page.locator('#adm-panel-teams');
  const rows = panel.locator('.adm-team');
  await rows.first().getByRole('button', { name: 'Xem phân tích' }).click();
  await rows.first().locator('.adm-team-analysis dl').waitFor();
  await rows.nth(1).getByRole('button', { name: 'Từ chối', exact: true }).click();
  await rows.nth(1).getByLabel('Lý do từ chối').fill(REJECT_REASON);
  await rows.nth(1).getByLabel('Lý do từ chối').blur();
  // Chữ mẫu của form Mở mùa mới như artboard.
  await panel.getByLabel('Mã mùa').fill('s2');
  await panel.getByLabel('Tên mùa (Việt)').fill('Mùa 2');
  await panel.getByLabel('Tên mùa (Trung)').fill('第二赛季');
  await panel.getByLabel('Tên mùa (Trung)').blur();
  // Các bước trên cuộn trang; về đầu trang để header dính không bị chụp giữa trang.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForFunction(() => window.scrollY === 0);
}

const pair = (artboard, width) => ({
  artboard,
  path: '/quan-tri/#doi-cong-dong',
  width,
  ready: '#adm-panel-teams .adm-team .adm-team-portrait',
  setup,
  mock: { state: 'quan-tri' },
});

export default [pair('AdminTeamsMoi', 1440), pair('AdminTeamsMoiMobile', 390)];
