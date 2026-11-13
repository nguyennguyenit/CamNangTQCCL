// Khu "Nhật ký" (#nhat-ky, chỉ root) của /quan-tri/ theo artboard AdminAuditMoi (+ Mobile): thao tác quản trị nhóm
// theo ngày THEO MÚI GIỜ CỦA NGƯỜI XEM (múi giờ trình duyệt), mỗi nhóm là bảng Giờ / Hành động · Đối tượng /
// Người làm / Kết quả (≤680px mỗi mục một thẻ). "Tải thêm" nối tiếp đúng nhóm ngày đang dở, không lặp đầu nhóm.
// Module còn chứa phần dùng chung với khu Người dùng (js/community-admin-users.js): icon nét, nhãn vai trò,
// ảnh đại diện chữ đầu, thẻ nhật ký rút gọn cho trang chi tiết người dùng.
// Không có hiệu ứng khi nạp; import vòng với community-admin.js an toàn vì chỉ dùng hàm đã export lúc chạy.

import { L, currentLocale, formatDate } from './i18n.js';
import { el, icon, svgNode } from './render.js';
import { api, avatar, describeError, formatDateTime } from './community-api.js';
import { adminStatus, button, emptyNote } from './community-admin.js';

/* ---------- Icon nét (artboard AdminAuditMoi · AdminUsersMoi · AdminUserBanMoi) ---------- */

const path = (d) => ['path', { d }];
const LOCK_BODY = ['rect', { x: 5, y: 11, width: 14, height: 9, rx: 2 }];
const ICONS = {
  pencil: [path('M4 20h4L19 9l-4-4L4 16z'), path('M13 7l4 4')],
  lock: [LOCK_BODY, path('M8 11V8a4 4 0 0 1 8 0v3')],
  unlock: [LOCK_BODY, path('M8 11V8a4 4 0 0 1 7.5-2')],
  trash: [path('M4 7h16'), path('M10 11v6'), path('M14 11v6'), path('M6 7l1 13h10l1-13'), path('M9 7V4h6v3')],
  check: [path('M5 12l5 5L20 7')],
  cross: [path('M6 6l12 12'), path('M18 6L6 18')],
  gear: [
    ['circle', { cx: 12, cy: 12, r: 3 }], path('M12 3v3'), path('M12 18v3'), path('M3 12h3'), path('M18 12h3'),
    path('M5.6 5.6l2.1 2.1'), path('M16.3 16.3l2.1 2.1'), path('M5.6 18.4l2.1-2.1'), path('M16.3 7.7l2.1-2.1'),
  ],
  flag: [path('M5 21V4'), path('M5 4h11l-2 4 2 4H5')],
  shield: [path('M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z')],
  feedback: [path('M4 4h16v12H7l-3 3z'), path('M12 7v4'), path('M12 13.5v.1')],
  image: [['rect', { x: 3, y: 5, width: 18, height: 14, rx: 2 }], ['circle', { cx: 9, cy: 10, r: 1.8 }], path('M21 16l-5-5-8 8')],
  plus: [path('M12 5v14'), path('M5 12h14')],
  log: [['rect', { x: 5, y: 4, width: 14, height: 17, rx: 2 }], path('M9 4V3h6v1'), path('M9 10h6'), path('M9 14h6'), path('M9 18h3')],
  search: [['circle', { cx: 11, cy: 11, r: 7 }], path('M20 20l-3.5-3.5')],
  next: [path('M9 6l6 6-6 6')],
  prev: [path('M15 6l-6 6 6 6')],
  clock: [['circle', { cx: 12, cy: 12, r: 9 }], path('M12 7v5l3 2')],
  signout: [path('M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4'), path('M10 16l-4-4 4-4'), path('M6 12h10')],
  hidden: [
    path('M3 3l18 18'), path('M10.6 6.1A9.9 9.9 0 0 1 12 6c5 0 9 6 9 6a16 16 0 0 1-3 3.5'),
    path('M6.6 7.6C4.4 9.2 3 12 3 12s4 6 9 6a8.8 8.8 0 0 0 4.2-1.1'),
  ],
};

/** Icon nét trang trí (aria-hidden) theo tên trong bảng trên. */
export function admIcon(name, size = 16) {
  return icon((ICONS[name] || ICONS.log).map(([tag, attrs]) => svgNode(tag, attrs)), { size });
}

/** Nút `.ana-btn` có icon nét đứng trước chữ; `variant` là class biến thể (adm-btn-accent, adm-btn-paper…). */
export function iconButton(text, iconName, variant = 'adm-btn-paper', attrs = {}) {
  return el('button', { class: `ana-btn ${variant}`.trim(), type: 'button', ...attrs }, [iconName ? admIcon(iconName) : null, text]);
}

/* ---------- Nhãn dùng chung ---------- */

export function roleLabel(role) {
  if (role === 'root') return L('Quản trị viên', '管理员');
  if (role === 'moderator') return L('Kiểm duyệt viên', '版主');
  return L('Người dùng', '用户');
}

/** Thời hạn khoá theo mã `duration` của API. */
export function durationLabel(duration) {
  switch (duration) {
    case '1d': return L('1 ngày', '1 天');
    case '7d': return L('7 ngày', '7 天');
    case '30d': return L('30 ngày', '30 天');
    case 'permanent': return L('Vĩnh viễn', '永久');
    default: return '';
  }
}

/** Chữ đầu của tối đa hai từ đầu tên ("Tào Mạnh Đức" → "TM"), như ảnh đại diện chữ của artboard. */
export function initials(name) {
  const words = String(name || '').trim().split(/\s+/u).filter(Boolean);
  if (!words.length) return '?';
  return words.slice(0, 2).map((word) => [...word][0]).join('').toLocaleUpperCase(currentLocale() === 'zh' ? 'zh-CN' : 'vi-VN');
}

/**
 * Ảnh đại diện tròn: ảnh Google (https) nếu có, không thì chữ đầu trên nền giấy đậm. `size` là biến thể cỡ
 * (`sm` 24 · `md` 28 · `lg` 36 · `xl` 64) của `.adm-initials`.
 */
export function initialsAvatar(person, size = 'md') {
  if (typeof person?.image === 'string' && /^https:\/\//.test(person.image)) {
    const image = avatar(person, 'cm-avatar adm-initials');
    image.dataset.size = size;
    return image;
  }
  return el('span', { class: 'adm-initials', 'aria-hidden': 'true', dataset: { size } }, initials(person?.name));
}

/* ---------- Mục nhật ký ---------- */

/** Nhãn hành động nhật ký theo mã; mã lạ hiện nguyên mã. */
export function actionLabel(action) {
  switch (action) {
    case 'user.ban': return L('Khoá tài khoản', '封禁账号');
    case 'user.unban': return L('Mở khoá tài khoản', '解封账号');
    case 'user.role': return L('Đổi vai trò', '变更角色');
    case 'user.delete.start': return L('Bắt đầu xoá tài khoản', '开始删除账号');
    case 'user.delete': return L('Xoá tài khoản', '删除账号');
    case 'comment.delete': return L('Xoá bình luận', '删除评论');
    case 'report.approve': return L('Duyệt chiến báo', '通过战报');
    case 'report.reject': return L('Từ chối chiến báo', '拒绝战报');
    case 'scan_sample.approve': return L('Duyệt ảnh soi đội', '通过识阵截图');
    case 'scan_sample.reject': return L('Từ chối ảnh soi đội', '拒绝识阵截图');
    case 'feedback.status': return L('Đổi trạng thái góp ý', '变更反馈状态');
    case 'post.create': return L('Tạo bài viết', '创建文章');
    case 'post.update': return L('Sửa bài viết', '修改文章');
    case 'post.delete': return L('Xoá bài viết', '删除文章');
    case 'post.publish': return L('Xuất bản bài viết', '发布文章');
    case 'post.unpublish': return L('Gỡ xuất bản bài viết', '取消发布文章');
    case 'post.upload': return L('Tải ảnh bài viết', '上传文章图片');
    case 'ai.config.update': return L('Cập nhật cấu hình AI', '更新 AI 配置');
    case 'team.approve': return L('Duyệt đội cộng đồng', '通过社区阵容');
    case 'team.reject': return L('Từ chối đội cộng đồng', '拒绝社区阵容');
    case 'team.delete': return L('Gỡ đội cộng đồng', '下架社区阵容');
    case 'season.open': return L('Mở mùa mới', '开启新赛季');
    default: return String(action || '');
  }
}

/** Nhóm hành động của bộ lọc (optgroup), đúng thứ tự artboard. */
function actionGroups() {
  return [
    [L('Người dùng', '用户'), ['user.ban', 'user.unban', 'user.role', 'user.delete.start', 'user.delete']],
    [L('Chiến báo', '战报'), ['report.approve', 'report.reject']],
    [L('Bình luận', '评论'), ['comment.delete']],
    [L('Soi đội', '识阵'), ['scan_sample.approve', 'scan_sample.reject']],
    [L('Góp ý', '反馈'), ['feedback.status']],
    [L('Bài viết', '文章'), ['post.create', 'post.update', 'post.delete', 'post.publish', 'post.unpublish', 'post.upload']],
    ['AI', ['ai.config.update']],
    [L('Đội cộng đồng', '社区阵容'), ['team.approve', 'team.reject', 'team.delete', 'season.open']],
  ];
}

/**
 * Icon + tông của ô icon theo hành động: duyệt = xanh, xoá/khoá/từ chối = son, còn lại = giấy.
 * Hành động lạ dùng icon sổ nhật ký, tông giấy.
 */
function actionGlyph(action) {
  switch (action) {
    case 'user.ban': return ['lock', 'danger'];
    case 'user.delete.start':
    case 'user.delete':
    case 'comment.delete':
    case 'post.delete':
    case 'team.delete': return ['trash', 'danger'];
    case 'report.reject':
    case 'scan_sample.reject':
    case 'team.reject': return ['cross', 'danger'];
    case 'report.approve':
    case 'scan_sample.approve':
    case 'team.approve': return ['check', 'good'];
    case 'user.unban': return ['unlock', 'neutral'];
    case 'user.role': return ['shield', 'neutral'];
    case 'feedback.status': return ['feedback', 'neutral'];
    case 'post.create': return ['plus', 'neutral'];
    case 'post.update':
    case 'post.publish':
    case 'post.unpublish': return ['pencil', 'neutral'];
    case 'post.upload': return ['image', 'neutral'];
    case 'ai.config.update': return ['gear', 'neutral'];
    case 'season.open': return ['flag', 'neutral'];
    default: return ['log', 'neutral'];
  }
}

/** Nhãn loại đối tượng của nhật ký; loại lạ hiện nguyên mã. */
function targetTypeLabel(type) {
  switch (type) {
    case 'user': return L('người dùng', '用户');
    case 'report': return L('chiến báo', '战报');
    case 'comment': return L('bình luận', '评论');
    case 'feedback': return L('góp ý', '反馈');
    case 'scan_sample': return L('mẫu soi đội', '识阵样本');
    case 'post': return L('bài viết', '文章');
    case 'upload': return L('ảnh bài viết', '文章图片');
    case 'ai_config': return L('cấu hình AI', 'AI 配置');
    case 'team': return L('đội cộng đồng', '社区阵容');
    case 'season': return L('mùa', '赛季');
    default: return String(type || '');
  }
}

/** Đối tượng có nhãn là mã máy (email đã che, đường dẫn trang, khoá ảnh) hiện font mono như artboard. */
const MONO_TARGETS = new Set(['user', 'comment', 'report', 'scan_sample', 'upload']);

function resultBadges(entry) {
  const badge = el('span', { class: 'cm-badge' });
  if (entry.status === 'ok') {
    badge.dataset.status = 'approved';
    badge.textContent = L('Thành công', '成功');
  } else if (entry.status === 'partial') {
    badge.dataset.status = 'pending';
    badge.textContent = L('Một phần', '部分完成');
  } else {
    badge.dataset.status = 'rejected';
    badge.textContent = L('Thất bại', '失败');
  }
  const deployPending = entry.meta?.deploy === 'pending';
  return [badge, deployPending ? el('span', { class: 'cm-badge', dataset: { tone: 'warn' } }, L('chưa rõ kết quả deploy', '部署结果未知')) : null];
}

/** "Đối tượng: <loại> · <nhãn>"; nhãn mono với email che / đường dẫn. Không có gì để hiện thì `null`. */
function targetLine(entry) {
  const type = entry.target?.type;
  const label = entry.target?.label ? String(entry.target.label) : '';
  if (!type && !label) return null;
  const typeText = type ? targetTypeLabel(type) : '';
  return el('p', { class: 'adm-audit-target' }, [
    L('Đối tượng: ', '对象：'),
    typeText,
    typeText && label ? ' · ' : '',
    label ? el('span', { class: 'adm-audit-target-label', dataset: MONO_TARGETS.has(type) ? { mono: '' } : {} }, label) : null,
  ]);
}

/** Dòng phụ theo meta: thời hạn khoá, đổi vai trò, lý do (khung giấy). */
function detailLines(entry) {
  const lines = [];
  const meta = entry.meta && typeof entry.meta === 'object' ? entry.meta : {};
  if (entry.action === 'user.ban' && durationLabel(meta.duration)) {
    lines.push(el('p', { class: 'adm-audit-note' }, L(`Thời hạn: ${durationLabel(meta.duration)}`, `期限：${durationLabel(meta.duration)}`)));
  }
  if (entry.action === 'user.role' && meta.from && meta.to) {
    lines.push(el('p', { class: 'adm-audit-note' }, `${roleLabel(meta.from)} → ${roleLabel(meta.to)}`));
  }
  if (entry.reason) {
    lines.push(el('p', { class: 'adm-audit-reason' }, [el('span', { class: 'adm-audit-reason-label' }, L('Lý do: ', '理由：')), String(entry.reason)]));
  }
  return lines;
}

/** Người làm từ `actor.label` dạng `Tên <em***@example.com>` (server đã che email); nhãn cũ không có email thì chỉ tên. */
function parseActor(actor) {
  const label = String(actor?.label || '').trim();
  const match = label.match(/^(.*?)\s*<([^<>]*)>$/u);
  return { name: (match ? match[1] : label).trim() || L('Không rõ', '未知'), email: match ? match[2].trim() : '' };
}

/** Mốc thời gian hợp lệ hoặc `null`. */
function validDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Giờ:phút theo múi giờ người xem ("20:52"). */
function clockText(date) {
  return formatDate(date, currentLocale(), { timeStyle: 'short' });
}

/** Một dòng của bảng nhật ký (desktop: lưới 4 cột; ≤680px: thẻ). */
function auditRow(entry) {
  const date = validDate(entry.createdAt);
  const [glyphName, tone] = actionGlyph(entry.action);
  const actor = parseActor(entry.actor);
  const extra = detailLines(entry);
  return el('li', { class: 'adm-audit' }, [
    date ? el('time', { class: 'adm-audit-time', datetime: date.toISOString() }, clockText(date)) : el('span', { class: 'adm-audit-time' }, '—'),
    el('div', { class: 'adm-audit-what' }, [
      el('span', { class: 'adm-audit-icon', 'aria-hidden': 'true', dataset: { tone } }, admIcon(glyphName)),
      el('div', { class: 'adm-audit-text' }, [
        el('p', { class: 'adm-audit-action' }, actionLabel(entry.action)),
        targetLine(entry),
      ]),
    ]),
    extra.length ? el('div', { class: 'adm-audit-extra' }, extra) : null,
    el('div', { class: 'adm-audit-actor' }, [
      el('span', { class: 'visually-hidden' }, L('Người làm: ', '操作人：')),
      initialsAvatar({ name: actor.name }, 'md'),
      el('span', { class: 'adm-audit-actor-text' }, [
        el('span', { class: 'adm-audit-actor-name' }, actor.name),
        el('span', { class: 'adm-audit-actor-meta' }, roleLabel(entry.actor?.role)),
        actor.email ? el('span', { class: 'adm-audit-actor-meta' }, actor.email) : null,
      ]),
    ]),
    el('div', { class: 'adm-audit-result' }, [el('span', { class: 'visually-hidden' }, L('Kết quả: ', '结果：')), ...resultBadges(entry)]),
  ]);
}

/** Thẻ nhật ký rút gọn cho "Nhật ký về người này" ở chi tiết người dùng (AdminUserBanMoi). */
export function auditBrief(entry) {
  const date = validDate(entry.createdAt);
  const [glyphName] = actionGlyph(entry.action);
  const actor = parseActor(entry.actor);
  return el('li', { class: 'adm-user-card adm-audit-brief' }, [
    el('p', { class: 'adm-user-card-meta' }, [
      date ? el('time', { datetime: date.toISOString() }, formatDateTime(date)) : null,
      ...resultBadges(entry),
    ]),
    el('p', { class: 'adm-audit-brief-action' }, [admIcon(glyphName), actionLabel(entry.action)]),
    targetLine(entry),
    ...detailLines(entry),
    el('p', { class: 'adm-audit-by' }, [L('Bởi ', '操作人 '), el('strong', {}, actor.name), ` · ${roleLabel(entry.actor?.role)}`]),
  ]);
}

/* ---------- Nhóm theo ngày (múi giờ của người xem) ---------- */

/** Khoá ngày lịch theo múi giờ trình duyệt (getter local của Date). */
function dayKey(date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/** "Hôm nay · 11 thg 11, 2026" / "Hôm qua · …" / "8 thg 11, 2026"; so với "bây giờ" lúc dựng nhóm. */
function dayLabel(date) {
  if (!date) return L('Không rõ ngày', '日期未知');
  const now = new Date();
  const text = formatDate(date);
  if (dayKey(date) === dayKey(now)) return L(`Hôm nay · ${text}`, `今天 · ${text}`);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (dayKey(date) === dayKey(yesterday)) return L(`Hôm qua · ${text}`, `昨天 · ${text}`);
  return text;
}

let daySeq = 0;

/** Một nhóm ngày: đầu nhóm h3 + bảng (hàng tiêu đề cột chỉ để nhìn, danh sách gắn nhãn bằng đầu nhóm). */
function dayGroup(date) {
  const titleId = `adm-audit-day-${++daySeq}`;
  const list = el('ol', { class: 'adm-audit-list', 'aria-labelledby': titleId });
  const node = el('div', { class: 'adm-audit-day' }, [
    el('h3', { id: titleId, class: 'adm-audit-day-title' }, dayLabel(date)),
    el('div', { class: 'adm-audit-table' }, [
      el('div', { class: 'adm-audit-cols', 'aria-hidden': 'true' }, [
        el('span', {}, L('Giờ', '时间')),
        el('span', {}, L('Hành động · đối tượng', '操作 · 对象')),
        el('span', {}, L('Người làm', '操作人')),
        el('span', {}, L('Kết quả', '结果')),
      ]),
      list,
    ]),
  ]);
  return { node, list };
}

/** Ghi chú cuối khu có icon khiên (artboard: chữ 12.5 muted). */
export function footNote(text) {
  return el('p', { class: 'adm-foot-note' }, [el('span', { class: 'adm-foot-note-icon' }, admIcon('shield', 14)), el('span', {}, text)]);
}

/* ---------- Khu Nhật ký ---------- */

export function openAuditPanel(panel) {
  const status = adminStatus();
  const filter = el('select', { id: 'adm-audit-action', class: 'cm-select' }, [
    el('option', { value: '' }, L('Tất cả hành động', '全部动作')),
    ...actionGroups().map(([label, actions]) => el('optgroup', { label }, actions.map((action) => el('option', { value: action }, actionLabel(action))))),
  ]);
  const summaryLabel = el('strong', {});
  const summary = el('p', { class: 'adm-filter-summary', role: 'status' }, [
    summaryLabel,
    L(' · mới nhất lên trước · mỗi lần tải 20 mục', ' · 最新在前 · 每次加载 20 条'),
  ]);
  const filters = el('div', { class: 'adm-audit-filters' }, [
    el('div', { class: 'adm-field adm-audit-filter-field' }, [el('label', { class: 'adm-label', for: 'adm-audit-action' }, L('Hành động', '动作')), filter]),
    summary,
  ]);
  const days = el('div', { class: 'adm-audit-days', 'aria-label': L('Nhật ký quản trị', '管理日志'), role: 'group' });
  const empty = emptyNote(L('Chưa có thao tác nào.', '暂无操作记录。'));
  const more = button(L('Tải thêm', '加载更多'), { variant: 'adm-more adm-audit-more adm-btn-paper', hidden: '' });

  let cursor = null;
  let generation = 0;
  /** Nhóm ngày cuối cùng đang hiện: trang sau cùng ngày nối vào đây thay vì mở nhóm mới. */
  let lastDay = null;

  const append = (items) => {
    for (const entry of items) {
      const date = validDate(entry.createdAt);
      const key = date ? dayKey(date) : 'unknown';
      if (!lastDay || lastDay.key !== key) {
        lastDay = { key, ...dayGroup(date) };
        days.append(lastDay.node);
      }
      lastDay.list.append(auditRow(entry));
    }
  };

  const load = async ({ reset = false } = {}) => {
    const mine = reset ? ++generation : generation;
    // Tải lại: bỏ cursor và ẩn "Tải thêm" ngay, để không ai bấm tải tiếp trang của bộ lọc cũ trong lúc chờ.
    if (reset) {
      cursor = null;
      more.hidden = true;
    }
    const params = new URLSearchParams();
    if (filter.value) params.set('action', filter.value);
    if (!reset && cursor) params.set('cursor', cursor);
    const query = params.toString();
    const body = await api(`/api/admin/audit${query ? `?${query}` : ''}`);
    if (mine !== generation) return;
    if (reset) {
      days.replaceChildren();
      lastDay = null;
    }
    append(Array.isArray(body?.items) ? body.items : []);
    cursor = typeof body?.nextCursor === 'string' && body.nextCursor ? body.nextCursor : null;
    more.hidden = !cursor;
    empty.hidden = days.childElementCount > 0;
  };

  const reload = () => {
    summaryLabel.textContent = filter.selectedOptions[0]?.textContent || '';
    status.set('');
    panel.setAttribute('aria-busy', 'true');
    return load({ reset: true })
      .catch((error) => status.set(describeError(error), 'error'))
      .finally(() => panel.removeAttribute('aria-busy'));
  };

  more.addEventListener('click', async () => {
    more.disabled = true;
    try {
      await load();
    } catch (error) {
      status.set(describeError(error), 'error');
    } finally {
      more.disabled = false;
    }
  });
  filter.addEventListener('change', reload);

  panel.append(
    filters,
    status,
    days,
    empty,
    more,
    footNote(L(
      'Chỉ quản trị viên xem được nhật ký. Email trong tên người làm và tên đối tượng luôn được che trước khi ghi.',
      '只有管理员可以查看日志。操作人名称和对象名称中的邮箱在记录前都会被遮挡。',
    )),
  );
  reload();
}
