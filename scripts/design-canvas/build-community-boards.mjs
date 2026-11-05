// Dựng artboard Đội cộng đồng + quản trị mới từ các bản chụp của capture-community.mjs → .cache/design-canvas/boards/project/<Board>.dc.html.
//   node scripts/design-canvas/build-community-boards.mjs <stylesheet /_blob/id> <ảnh mẫu /_blob/id> [bảng ảnh .json]
// Bảng ảnh (tuỳ chọn) đổi chân dung tướng (`iconUrl` từ xa, `/heroes/*.webp`) sang asset canvas: canvas không tải ảnh ngoài.
// Ảnh đội (`/api/community-teams/<id>/images/<n>`) và ảnh người dùng chọn (blob:/data: URI) đổi thành ảnh mẫu đã tải lên canvas.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, assetMap, renderPage } from './canvas-page.mjs';

const [stylesheet, sampleImage, imageMapFile] = process.argv.slice(2);
const imageMap = imageMapFile ? JSON.parse(readFileSync(imageMapFile, 'utf8')) : {};
if (!stylesheet || !sampleImage) throw new Error('cần <stylesheet /_blob/id> <ảnh mẫu /_blob/id>');
const WORK = join(REPO, '.cache/design-canvas');
const OUT = join(WORK, 'boards/project');
mkdirSync(OUT, { recursive: true });
const assets = { ...assetMap(join(WORK, 'sitebuild')), ...imageMap };

export const BOARDS = {
  DoiCongDong: 'Đội cộng đồng — danh sách',
  DoiCongDongDetail: 'Đội cộng đồng — chi tiết đội',
  DoiCongDongNew: 'Đội cộng đồng — đăng đội',
  DoiCongDongMine: 'Đội cộng đồng — đội của tôi',
  BanNotice: 'Thông báo tài khoản bị khoá',
  AdminTeams: 'Quản trị — đội cộng đồng',
  AdminUsers: 'Quản trị — người dùng',
  AdminUserBan: 'Quản trị — khoá tài khoản',
  AdminAudit: 'Quản trị — nhật ký',
};

// Chiều cao đo lại qua shim (shot.mjs) khi ảnh mẫu lớn hơn ảnh 1×1 lúc chụp: lấy số lớn hơn để không cắt nội dung.
let natural = {};
try { natural = JSON.parse(readFileSync(join(WORK, 'boards/natural-heights-community.json'), 'utf8')); } catch { /* chưa đo */ }
const heights = {};
for (const [name, title] of Object.entries(BOARDS)) {
  for (const [suffix, width] of [['', 1440], ['Mobile', 390]]) {
    const board = name + suffix;
    const capture = JSON.parse(readFileSync(join(WORK, 'captures', `${board}.json`), 'utf8'));
    capture.html = capture.html
      .replace(/src="(data:image\/[^"]+|blob:[^"]+|\/api\/community-teams\/[^"]+)"/g, `src="${sampleImage}"`)
      // Hộp thoại mở bằng showModal() nằm ở top layer; artboard không có top layer nên vẽ lại nền mờ + hộp giữa khung nhìn đầu.
      .replace(/<dialog ([^>]*\bopen="")>/g, '<div aria-hidden="true" style="position: absolute; inset: 0; z-index: 55; background-color: var(--overlay);"></div>'
        + '<dialog $1 style="position: absolute; top: 160px; left: 0; right: 0; margin: 0 auto; z-index: 60; width: min(420px, calc(100% - 32px));">');
    const height = Math.max(capture.height, natural[board] || 0);
    const html = renderPage({ title: title + (suffix ? ' (mobile)' : ''), width, height, capture, stylesheet, assets });
    if (/data:image|src="(blob:|\/api\/|https?:|\/heroes\/)/.test(html)) throw new Error(`${board}: còn ảnh không phải asset canvas`);
    writeFileSync(join(OUT, `${board}.dc.html`), html);
    heights[board] = height;
  }
}
writeFileSync(join(WORK, 'boards/heights-community.json'), JSON.stringify(heights, null, 2));
console.log(heights);
