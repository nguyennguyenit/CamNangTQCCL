// Mảnh giao diện dùng chung của trang Đội cộng đồng (thiết kế mới, artboard DoiCongDong*Moi): icon nét, nhãn
// binh chủng, nhãn ngôn ngữ, dòng số liệu, khối ảnh thẻ, nút dạng link. Không gọi API, không giữ trạng thái.

import { L, formatNumber } from './i18n.js';
import { el, icon, svgNode } from './render.js';
import { troopLabel } from './community-team-data.js';

const path = (d) => svgNode('path', { d });

/** Icon nét 24×24 (aria-hidden) theo tên; tên lạ trả `null`. */
const ICON_PATHS = {
  plus: ['M12 5v14', 'M5 12h14'],
  list: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
  chevronDown: ['M6 9l6 6 6-6'],
  chevronUp: ['M18 15l-6-6-6 6'],
  arrowRight: ['M5 12h14', 'M12 5l7 7-7 7'],
  arrowLeft: ['M19 12H5', 'M12 19l-7-7 7-7'],
  arrowDown: ['M12 5v14', 'M19 12l-7 7-7-7'],
  trophy: ['M8 21h8', 'M12 17v4', 'M7 4h10v5a5 5 0 0 1-10 0z', 'M17 5h3v2a3 3 0 0 1-3 3', 'M7 5H4v2a3 3 0 0 0 3 3'],
  comment: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  image: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z', 'M21 15l-5-5L5 21'],
  imageOff: ['M2 2l20 20', 'M10.4 3H19a2 2 0 0 1 2 2v8.6', 'M21 19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5', 'M21 15l-3-3', 'M5 21l7-7'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.35-4.35'],
  filter: ['M22 3H2l8 9.46V19l4 2v-8.54z'],
  external: ['M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6', 'M15 3h6v6', 'M10 14L21 3'],
  info: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 16v-4', 'M12 8h.01'],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
  xCircle: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M15 9l-6 6', 'M9 9l6 6'],
  checkCircle: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M9 12l2 2 4-4'],
  check: ['M20 6L9 17l-5-5'],
  trash: ['M3 6h18', 'M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6', 'M10 11v6', 'M14 11v6', 'M9 6V4h6v2'],
  upload: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M17 8l-5-5-5 5', 'M12 3v12'],
  scan: ['M3 7V5a2 2 0 0 1 2-2h2', 'M17 3h2a2 2 0 0 1 2 2v2', 'M21 17v2a2 2 0 0 1-2 2h-2', 'M7 21H5a2 2 0 0 1-2-2v-2', 'M7 12h10'],
  alert: ['M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z', 'M12 9v4', 'M12 17h.01'],
  lock: ['M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z', 'M7 11V7a5 5 0 0 1 10 0v4'],
  x: ['M18 6L6 18', 'M6 6l12 12'],
  refresh: ['M21 12a9 9 0 1 1-3-6.7L21 8', 'M21 3v5h-5'],
  send: ['M22 2L11 13', 'M22 2l-7 20-4-9-9-4z'],
  users: ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
};

export function teamIcon(name, size = 16) {
  const paths = ICON_PATHS[name];
  return paths ? icon(paths.map(path), { size }) : null;
}

/** Nhãn binh chủng dạng viên: chấm màu binh + chữ (chấm theo `data-troop`, Khí giới/giá trị lạ dùng màu mực). */
export function troopPill(troop) {
  return el('span', { class: 'cm-team-troop-pill' }, [
    el('i', { class: 'cm-team-troop-dot', 'aria-hidden': 'true', dataset: { troop: String(troop ?? '') } }),
    troopLabel(troop),
  ]);
}

/**
 * Nhãn ngôn ngữ văn bản người dùng ("VI"/"ZH", ô mono): giữ class `cm-lang-tag` làm móc cho test và CSS cũ;
 * `title` nói rõ ngôn ngữ cho người dùng chuột, chữ hai ký tự đủ cho trình đọc màn hình.
 */
export function langBadge(lang) {
  if (lang !== 'vi' && lang !== 'zh') return null;
  return el('abbr', {
    class: 'cm-lang-tag cm-team-lang',
    dataset: { lang },
    title: lang === 'vi' ? L('Viết bằng tiếng Việt', '以越南语撰写') : L('Viết bằng tiếng Trung', '以中文撰写'),
  }, lang.toUpperCase());
}

/** Một số liệu có icon; phần đọc cho trình đọc màn hình đi kèm nhãn đầy đủ. */
export function statItem(iconName, value, label, { visible = '' } = {}) {
  return el('span', { class: 'cm-team-stat' }, [
    teamIcon(iconName, 14),
    el('span', { 'aria-hidden': 'true' }, visible ? `${formatNumber(value)} ${visible}` : formatNumber(value)),
    el('span', { class: 'visually-hidden' }, `${label}: ${formatNumber(value)}`),
  ]);
}

/** Dòng "57 điểm · ^42 · v3 · 🏆 9 người thắng · 💬 12" của thẻ đội. */
export function teamStatsLine(team, className = 'cm-team-stats') {
  return el('p', { class: className }, [
    el('span', { class: 'cm-team-points-text' }, L(`${formatNumber(team.points)} điểm`, `${formatNumber(team.points)} 分`)),
    statItem('chevronUp', team.upVotes, L('Bình chọn lên', '赞成票')),
    statItem('chevronDown', team.downVotes, L('Bình chọn xuống', '反对票')),
    statItem('trophy', team.evidenceCount, L('Người thắng', '获胜玩家'), { visible: L('người thắng', '人获胜') }),
    statItem('comment', team.commentCount, L('Bình luận', '评论')),
  ]);
}

/** Đường dẫn ảnh đội (Worker phục vụ, đã kiểm quyền xem). */
export function teamImageUrl(id, position) {
  return `/api/community-teams/${encodeURIComponent(id)}/images/${position}`;
}

/** Số ảnh đội hợp lệ (0–3). */
export function teamImageCount(team) {
  return Math.max(0, Math.min(Number(team?.imageCount) || 0, 3));
}

/** Khối ảnh đầu thẻ: ảnh đầu + nhãn số ảnh, hoặc trạng thái "Chưa có ảnh đội". */
export function teamMedia(team) {
  const count = teamImageCount(team);
  if (!count) {
    return el('div', { class: 'cm-team-card-media', dataset: { empty: 'true' } }, [
      teamIcon('imageOff', 22),
      el('span', { class: 'cm-team-media-empty-title' }, L('Chưa có ảnh đội', '暂无阵容图片')),
      el('span', { class: 'cm-team-media-empty-hint' }, L('Đội hình vẫn xem được bên dưới', '阵容仍可在下方查看')),
    ]);
  }
  return el('div', { class: 'cm-team-card-media' }, [
    el('img', { class: 'cm-team-thumb', src: teamImageUrl(team.id, 0), alt: '', loading: 'lazy', decoding: 'async' }),
    el('span', { class: 'cm-team-photo-count' }, [teamIcon('image', 14), L(`${count} ảnh`, `${count} 张图`)]),
  ]);
}

/** Nút dạng link (`a.cm-team-btn`) có icon trước/sau chữ. */
export function buttonLink(href, label, { variant = '', before = null, after = null, className = '' } = {}) {
  const classes = ['cm-team-btn', variant ? `cm-team-btn-${variant}` : '', className].filter(Boolean).join(' ');
  return el('a', { class: classes, href }, [before ? teamIcon(before) : null, label, after ? teamIcon(after) : null]);
}
