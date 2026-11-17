// Khu "Người dùng" của /quan-tri/ (#nguoi-dung) theo artboard AdminUsersMoi + AdminUserBanMoi (+ Mobile): bảng người
// dùng (≤680px mỗi người một thẻ), tìm kiếm có icon, Vai trò, chip Trạng thái, dòng đếm; chi tiết người dùng (thẻ hồ
// sơ + ô số liệu, bình luận/chiến báo gần đây, nhật ký về người này), khoá/mở khoá, cấp/thu quyền kiểm duyệt viên,
// xoá tài khoản. Khu "Nhật ký" (#nhat-ky) ở js/community-admin-audit.js, hộp thoại ở js/community-admin-dialogs.js;
// module này re-export `openAuditPanel` và `actionDialog` để community-admin.js / community-admin-teams.js giữ import cũ.
// Module không có hiệu ứng khi nạp: chỉ community-admin.js gọi `openUsersPanel` (import vòng với community-admin.js an
// toàn vì chỉ dùng các hàm đã export, không dùng ở cấp module).
// Server mới là nơi kiểm quyền; ở đây chỉ ẩn nút với đích không thao tác được và dịch lỗi theo `code`.

import { L, currentLocale, formatDate, htmlLang, pick } from './i18n.js';
import { el } from './render.js';
import { api, describeError, displayName, formatDateTime, timeNode } from './community-api.js';
import { SCAN_STATUS_LABEL, adminStatus, emptyNote, formField, pagePath, pagedList, selectInput, textInput } from './community-admin.js';
import { admIcon, auditBrief, footNote, iconButton, initialsAvatar, roleLabel } from './community-admin-audit.js';
import { actionDialog, describeUserActionError, openBanDialog } from './community-admin-dialogs.js';

export { openAuditPanel } from './community-admin-audit.js';
export { actionDialog } from './community-admin-dialogs.js';

const SEARCH_DEBOUNCE_MS = 300;

/* ---------- Người dùng: hiển thị ---------- */

/** Thời điểm tương đối ("2 giờ trước"); quá một năm thì hiện ngày. */
function relativeTime(value) {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return '';
  const seconds = Math.round((time - Date.now()) / 1000);
  if (Math.abs(seconds) < 60) return L('vừa xong', '刚刚', 'たった今');
  const formatter = new Intl.RelativeTimeFormat(pick(currentLocale(), 'vi-VN', 'zh-CN', 'ja-JP'), { numeric: 'auto' });
  const units = [['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit);
  }
  return '';
}

/** "Khoá đến 20:40 18 thg 11, 2026 · do kiểm duyệt viên" / "Khoá vĩnh viễn · do quản trị viên". */
function banLine(ban) {
  const until = ban.until
    ? L(`Khoá đến ${formatDateTime(ban.until)}`, `封禁至 ${formatDateTime(ban.until)}`, `${formatDateTime(ban.until)}まで利用停止`)
    : L('Khoá vĩnh viễn', '永久封禁', '永久に利用停止');
  if (ban.byRole !== 'root' && ban.byRole !== 'moderator') return until;
  return `${until} · ${L(`do ${roleLabel(ban.byRole).toLocaleLowerCase('vi-VN')}`, `由${roleLabel(ban.byRole)}操作`, `${roleLabel(ban.byRole)}による操作`)}`;
}

/** Badge vai trò: người dùng nền giấy đậm, KDV viền + khiên, quản trị viên nền mực + khiên. */
function roleBadge(role) {
  const known = role === 'root' || role === 'moderator' ? role : 'user';
  return el('span', { class: 'cm-badge adm-role-badge', dataset: { role: known } }, [known === 'user' ? null : admIcon('shield', 13), roleLabel(known)]);
}

/** Badge trạng thái tài khoản: Bình thường · Đang bị khoá (khoá) · Đang xoá (thùng rác). */
function stateBadge(user) {
  if (user.deleting) return el('span', { class: 'cm-badge', dataset: { status: 'pending' } }, [admIcon('trash', 13), L('Đang xoá', '删除中', '削除中')]);
  if (user.ban) return el('span', { class: 'cm-badge', dataset: { status: 'rejected' } }, [admIcon('lock', 13), L('Đang bị khoá', '已封禁', '利用停止中')]);
  return el('span', { class: 'cm-badge', dataset: { status: 'approved' } }, L('Bình thường', '正常', '正常'));
}

/** Bốn ô đóng góp; số 0 nhạt hơn như artboard. */
function countItems(counts) {
  const c = counts || {};
  return [
    [c.comments, L('bình luận', '条评论', 'コメント')],
    [c.reports, L('chiến báo', '份战报', '戦報')],
    [c.feedback, L('góp ý', '条反馈', 'フィードバック')],
    [c.scanSamples, L('mẫu soi đội', '个识阵样本', '編成解析サンプル')],
  ].map(([value, label]) => {
    const n = Number(value) || 0;
    return el('span', { class: 'adm-user-count' }, [el('strong', { dataset: n === 0 ? { zero: '' } : {} }, String(n)), ` ${label}`]);
  });
}

function userRow(user, viewer) {
  const lastSeen = user.lastSeenAt ? relativeTime(user.lastSeenAt) : '';
  return el('li', { class: 'adm-user' }, [
    // Nút mở chi tiết phủ cả hàng (::after) nhưng tên truy cập chỉ gồm tên + email.
    el('button', { class: 'adm-user-open', type: 'button', dataset: { userId: user.id } }, [
      initialsAvatar(user, 'lg'),
      el('span', { class: 'adm-user-who' }, [
        el('span', { class: 'adm-user-line' }, [
          el('span', { class: 'adm-author adm-user-row-name' }, displayName(user)),
          viewer?.id === user.id ? el('span', { class: 'cm-badge adm-you' }, L('Bạn', '你', 'あなた')) : null,
        ]),
        el('span', { class: 'adm-mail' }, String(user.email || '')),
      ]),
    ]),
    el('span', { class: 'adm-user-tags' }, [
      el('span', { class: 'adm-user-role' }, [el('span', { class: 'visually-hidden' }, L('Vai trò: ', '角色：', '役割：')), roleBadge(user.role)]),
      el('span', { class: 'adm-user-state' }, [
        el('span', { class: 'visually-hidden' }, L('Trạng thái: ', '状态：', '状態：')),
        stateBadge(user),
        user.ban && !user.deleting ? el('span', { class: 'adm-user-ban-line' }, banLine(user.ban)) : null,
      ]),
    ]),
    el('span', { class: 'adm-user-counts' }, [el('span', { class: 'visually-hidden' }, L('Đóng góp: ', '贡献：', '投稿：')), ...countItems(user.counts)]),
    el('span', { class: 'adm-user-activity' }, [
      el('span', { class: 'adm-user-seen' }, lastSeen
        ? [el('span', { class: 'adm-user-seen-label' }, L('Hoạt động ', '最近活动 ', '最終活動 ')), lastSeen]
        : L('Chưa ghi nhận', '暂无记录', '記録なし')),
      user.createdAt ? el('span', {}, L(`Đăng ký ${formatDate(user.createdAt)}`, `注册于 ${formatDate(user.createdAt)}`, `登録日 ${formatDate(user.createdAt)}`)) : null,
    ]),
    el('span', { class: 'adm-user-chevron', 'aria-hidden': 'true' }, admIcon('next', 18)),
  ]);
}

/* ---------- Người dùng: quyền thao tác ---------- */

/**
 * Nút nào hiện với (người xem, đích). Server vẫn kiểm lại; đây chỉ để khỏi bày nút chắc chắn bị từ chối:
 * không tự thao tác, không động tới root, KDV chỉ thao tác user thường và không gỡ khoá do root đặt,
 * root chỉ xoá khi không bị khoá, người đang bị xoá chỉ còn "thử xoá tiếp".
 */
function availableActions(viewer, target) {
  const none = { ban: false, unban: false, role: null, remove: false, removeHint: false, resume: false };
  if (!viewer || viewer.id === target.id || target.role === 'root') return none;
  const root = viewer.role === 'root';
  if (target.deleting) return { ...none, resume: root };
  if (!root && target.role !== 'user') return none;
  const banned = Boolean(target.ban);
  return {
    ban: !banned,
    unban: banned && (root || target.ban.byRole !== 'root'),
    role: root ? (target.role === 'moderator' ? 'user' : 'moderator') : null,
    remove: root && !banned,
    removeHint: root && banned,
    resume: false,
  };
}

/* ---------- Người dùng: chi tiết ---------- */

/** Ô số liệu của thẻ hồ sơ: ngày đăng ký, hoạt động, bốn số đóng góp (serif 22). */
function profileStats(user) {
  const c = user.counts || {};
  const lastSeen = user.lastSeenAt ? relativeTime(user.lastSeenAt) : '';
  const cell = (label, value, kind = 'text') => el('div', { class: 'adm-user-stat', dataset: { kind } }, [
    el('dt', {}, label),
    el('dd', { dataset: kind === 'count' && value === 0 ? { zero: '' } : {} }, String(value)),
  ]);
  return el('dl', { class: 'adm-user-stats' }, [
    cell(L('Đăng ký', '注册', '登録日'), user.createdAt ? formatDate(user.createdAt) : '—'),
    cell(L('Hoạt động', '最近活动', '最終活動'), lastSeen || L('Chưa ghi nhận', '暂无记录', '記録なし')),
    cell(L('Bình luận', '评论', 'コメント'), Number(c.comments) || 0, 'count'),
    cell(L('Chiến báo', '战报', '戦報'), Number(c.reports) || 0, 'count'),
    cell(L('Góp ý', '反馈', 'フィードバック'), Number(c.feedback) || 0, 'count'),
    cell(L('Mẫu soi đội', '识阵样本', '編成解析サンプル'), Number(c.scanSamples) || 0, 'count'),
  ]);
}

/** Bình luận / chiến báo / nhật ký gần đây: hai cột (bình luận | chiến báo + nhật ký), ≤680px xếp chồng. */
function detailLists(body) {
  const section = (title, windowText, items, render, emptyText) => el('section', { class: 'adm-user-section' }, [
    el('div', { class: 'adm-user-section-head' }, [
      el('h4', { class: 'adm-user-subtitle' }, title),
      el('span', { class: 'adm-user-section-window' }, windowText),
    ]),
    items.length
      ? el('ul', { class: 'adm-user-cards', 'aria-label': title }, items.map(render))
      : el('p', { class: 'adm-empty' }, emptyText),
  ]);
  const comments = Array.isArray(body.comments) ? body.comments : [];
  const reports = Array.isArray(body.reports) ? body.reports : [];
  const audit = Array.isArray(body.audit) ? body.audit : [];
  const latest = (n) => L(`${n} mục mới nhất`, `最新 ${n} 条`, `最新${n}件`);
  return el('div', { class: 'adm-user-columns' }, [
    section(L('Bình luận gần đây', '最近评论', '最近のコメント'), latest(10), comments, (comment) => el('li', { class: 'adm-user-card' }, [
      el('p', { class: 'adm-user-card-meta' }, [timeNode(comment.createdAt), pagePath(comment.page, comment.lang)]),
      el('p', { class: 'adm-body', lang: htmlLang(comment.lang) }, String(comment.body || '')),
    ]), L('Chưa có bình luận.', '暂无评论。', 'コメントはまだありません。')),
    el('div', { class: 'adm-user-aside' }, [
      section(L('Chiến báo gần đây', '最近战报', '最近の戦報'), latest(10), reports, (report) => el('li', { class: 'adm-user-card' }, [
        el('p', { class: 'adm-user-card-meta' }, [
          timeNode(report.createdAt),
          pagePath(report.page, report.lang),
          el('span', { class: 'cm-badge', dataset: { status: report.status } }, SCAN_STATUS_LABEL[report.status] || String(report.status || '')),
        ]),
      ]), L('Chưa có chiến báo.', '暂无战报。', '戦報はまだありません。')),
      section(L('Nhật ký về người này', '涉及此用户的日志', 'このユーザーに関するログ'), latest(20), audit, auditBrief, L('Chưa có thao tác nào.', '暂无操作记录。', '操作記録はまだありません。')),
    ]),
  ]);
}

/* ---------- Người dùng: khu chính ---------- */

export function openUsersPanel(panel, { head, viewer }) {
  const status = adminStatus();
  const staffOnly = viewer.role !== 'root';

  /* Bộ lọc: tìm kiếm có icon + Vai trò; chip Trạng thái (một lựa chọn, aria-pressed) */
  const search = textInput('adm-users-q', '', {
    maxlength: '100',
    autocomplete: 'off',
    type: 'search',
    placeholder: L('Tên hoặc email', '姓名或邮箱', '名前またはメールアドレス'),
  });
  const searchField = formField('adm-users-q', L('Tìm kiếm', '搜索', '検索'), search, staffOnly
    ? L('Tìm theo tên hoặc email đầy đủ · kết quả cập nhật khi gõ', '按姓名或完整邮箱查找 · 输入时更新结果', '名前または完全なメールアドレスで検索 · 入力に合わせて結果を更新')
    : L('Tìm theo tên hoặc email · kết quả cập nhật khi gõ', '按姓名或邮箱查找 · 输入时更新结果', '名前またはメールアドレスで検索 · 入力に合わせて結果を更新'));
  // Ô tìm có icon kính lúp bên trái: bọc ô nhập ngay tại chỗ trong trường (nhãn/gợi ý giữ nguyên liên kết).
  const searchWrap = el('div', { class: 'adm-search' }, el('span', { class: 'adm-search-icon' }, admIcon('search', 18)));
  search.replaceWith(searchWrap);
  searchWrap.append(search);
  const roleFilter = selectInput('adm-users-role', [
    ['', L('Tất cả', '全部', 'すべて')],
    ['user', roleLabel('user')],
    ['moderator', roleLabel('moderator')],
    ['root', roleLabel('root')],
  ], '');
  let stateValue = '';
  const chips = [
    ['', L('Tất cả', '全部', 'すべて')],
    ['active', L('Bình thường', '正常', '正常')],
    ['banned', L('Đang bị khoá', '已封禁', '利用停止中')],
    ['deleting', L('Đang xoá', '删除中', '削除中')],
  ].map(([value, label]) => el('button', { class: 'adm-user-chip', type: 'button', 'aria-pressed': String(value === stateValue), dataset: { value } }, label));
  const filters = el('div', { class: 'adm-user-filters' }, [
    el('div', { class: 'adm-user-filter-row' }, [searchField, formField('adm-users-role', L('Vai trò', '角色', '役割'), roleFilter)]),
    el('div', { class: 'adm-user-chip-field', role: 'group', 'aria-labelledby': 'adm-users-status-label' }, [
      el('span', { id: 'adm-users-status-label', class: 'adm-label' }, L('Trạng thái', '状态', '状態')),
      el('div', { class: 'adm-user-chip-row' }, chips),
    ]),
  ]);

  /* Danh sách: dòng đếm (API không trả tổng → chỉ đếm số đã tải), bảng có hàng tiêu đề cột */
  const countText = el('strong', {});
  const summary = el('p', { class: 'adm-user-summary', role: 'status' }, [
    countText,
    el('span', {}, L('Mới đăng ký lên trước · mỗi lần tải 20 tài khoản', '最新注册在前 · 每次加载 20 个账号', '新規登録順 · 1回の読み込みは20アカウント')),
  ]);
  const list = el('ul', { class: 'adm-user-list', 'aria-label': L('Danh sách người dùng', '用户列表', 'ユーザー一覧') });
  const table = el('div', { class: 'adm-user-table' }, [
    el('div', { class: 'adm-user-cols', 'aria-hidden': 'true' }, [
      el('span', {}, L('Người dùng', '用户', 'ユーザー')),
      el('span', {}, L('Vai trò', '角色', '役割')),
      el('span', {}, L('Trạng thái', '状态', '状態')),
      el('span', {}, L('Đóng góp', '贡献', '投稿')),
      el('span', {}, L('Hoạt động', '活动', '活動')),
      el('span', {}),
    ]),
    list,
  ]);
  const empty = emptyNote(L('Không có người dùng phù hợp.', '没有符合条件的用户。', '該当するユーザーはいません。'));
  const paged = pagedList({
    list,
    empty,
    status,
    fallbackFocus: head.querySelector('.adm-section-title'),
    fetchPage: (cursor) => {
      const params = new URLSearchParams();
      const q = search.value.trim();
      if (q) params.set('q', q);
      if (roleFilter.value) params.set('role', roleFilter.value);
      if (stateValue) params.set('status', stateValue);
      if (cursor) params.set('cursor', cursor);
      const query = params.toString();
      return api(`/api/admin/users${query ? `?${query}` : ''}`);
    },
    render: (user) => {
      const row = userRow(user, viewer);
      row.querySelector('.adm-user-open').addEventListener('click', () => showDetail(user.id));
      return row;
    },
  });
  paged.more.classList.add('adm-btn-paper');
  const tableWrap = el('div', { class: 'adm-user-table-wrap', hidden: '' }, [summary, table]);
  /** Số đã tải; còn trang sau thì nói rõ "đã tải", không đoán tổng. */
  const updateSummary = () => {
    const n = list.childElementCount;
    tableWrap.hidden = n === 0;
    countText.textContent = paged.more.hidden ? L(`${n} người dùng`, `${n} 位用户`, `${n}人のユーザー`) : L(`Đã tải ${n} người dùng`, `已加载 ${n} 位用户`, `${n}人のユーザーを読み込み済み`);
  };
  new MutationObserver(updateSummary).observe(list, { childList: true });
  new MutationObserver(updateSummary).observe(paged.more, { attributes: true, attributeFilter: ['hidden'] });
  const listView = el('div', { class: 'adm-user-list-view' }, [
    filters,
    tableWrap,
    empty,
    paged.more,
    footNote(L(
      'Kiểm duyệt viên chỉ thấy email đã che (ví dụ ta***@example.com), tìm bằng tên hoặc email đầy đủ, và chỉ khoá hoặc mở khoá người dùng thường.',
      '版主只能看到遮挡后的邮箱（例如 ta***@example.com），只能按姓名或完整邮箱查找，并且只能封禁或解封普通用户。',
      'モデレーターにはマスクされたメールアドレス（例：ta***@example.com）のみ表示され、名前または完全なメールアドレスでの検索と、一般ユーザーの利用停止・解除のみ行えます。',
    )),
  ]);

  let timer = null;
  const reloadNow = () => {
    clearTimeout(timer);
    return paged.reload(listView).then(updateSummary);
  };
  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(reloadNow, SEARCH_DEBOUNCE_MS);
  });
  roleFilter.addEventListener('change', reloadNow);
  for (const chip of chips) {
    chip.addEventListener('click', () => {
      if (chip.dataset.value === stateValue) return;
      stateValue = chip.dataset.value;
      for (const other of chips) other.setAttribute('aria-pressed', String(other === chip));
      reloadNow();
    });
  }

  /* Chi tiết */
  const detailBody = el('div', { class: 'adm-user-detail-body' });
  const back = iconButton(L('Quay lại danh sách', '返回列表', '一覧に戻る'), 'prev');
  const detailView = el('div', { class: 'adm-user-detail', hidden: '' }, [back, detailBody]);
  let currentId = null;
  let generation = 0;
  let listDirty = false;
  /** Tăng mỗi lần đổi màn hình (vào chi tiết / về danh sách): thao tác ghi chỉ cập nhật giao diện khi còn đúng màn hình đã bắt đầu. */
  let selection = 0;

  const showList = async ({ focusId = null } = {}) => {
    selection += 1;
    currentId = null;
    generation += 1;
    detailView.hidden = true;
    listView.hidden = false;
    if (listDirty) {
      listDirty = false;
      await reloadNow();
    }
    (focusId ? list.querySelector(`[data-user-id="${CSS.escape(focusId)}"]`) : null)?.focus?.();
  };
  back.addEventListener('click', () => showList({ focusId: currentId }));

  /** Tải lại chi tiết; trả `false` khi người đã biến mất (đã xoá) hoặc lượt tải bị lượt mới thay. */
  const loadDetail = async (id, { focus = false } = {}) => {
    const mine = ++generation;
    currentId = id;
    let body;
    try {
      body = await api(`/api/admin/users/${encodeURIComponent(id)}`);
    } catch (error) {
      if (mine !== generation) return false;
      if (error?.status === 404) {
        listDirty = true;
        await showList();
        status.set(describeError(error), 'error');
      } else {
        status.set(describeError(error), 'error');
      }
      return false;
    }
    if (mine !== generation) return false;
    renderDetail(body);
    if (focus) detailBody.querySelector('.adm-user-name')?.focus();
    return true;
  };

  const showDetail = (id) => {
    selection += 1;
    status.set('');
    listView.hidden = true;
    detailView.hidden = false;
    detailBody.replaceChildren(el('p', { class: 'adm-empty' }, L('Đang tải…', '加载中…', '読み込み中…')));
    loadDetail(id, { focus: true });
  };

  /** Thao tác ghi: thành công thì báo + tải lại chi tiết; lỗi thì báo + tải lại (trạng thái có thể đã đổi). */
  const mutate = async (user, request, okMessage) => {
    const mine = selection;
    try {
      await request();
    } catch (error) {
      listDirty = true;
      if (mine === selection) {
        status.set(describeUserActionError(error), 'error');
        await loadDetail(user.id);
      } else if (!listView.hidden) await showList();
      throw error;
    }
    listDirty = true;
    if (mine === selection) {
      status.set(okMessage);
      await loadDetail(user.id);
    } else if (!listView.hidden) await showList();
  };

  const refocusDetail = () => detailBody.querySelector('.adm-user-name')?.focus();

  const openBan = (user) => openBanDialog(user, {
    submit: ({ duration, reason }) => mutate(user, () => api(`/api/admin/users/${encodeURIComponent(user.id)}/ban`, {
      method: 'POST',
      json: { duration, reason },
    }), L('Đã khoá tài khoản.', '账号已封禁。', 'アカウントを利用停止にしました。')),
    onClose: refocusDetail,
  });

  const openDelete = (user, { resume }) => {
    const expected = String(user.email || '').trim().toLowerCase();
    const email = textInput('adm-delete-email', '', { autocomplete: 'off', spellcheck: 'false' });
    const { confirm } = actionDialog({
      title: resume ? L('Thử xoá tiếp', '继续删除', '削除を続行') : L('Xoá tài khoản', '删除账号', 'アカウントを削除'),
      lead: resume
        ? L(`Lần xoá trước chưa hoàn tất. Gõ lại email ${user.email} để chạy tiếp.`, `上次删除未完成。重新输入邮箱 ${user.email} 以继续。`, `前回の削除は完了していません。続行するには、メールアドレス ${user.email} を再入力してください。`)
        : L(`Xoá vĩnh viễn ${displayName(user)} cùng bình luận, chiến báo, mẫu soi đội và ảnh. Góp ý được giữ lại ẩn danh. Không thể hoàn tác. Gõ lại email ${user.email} để xác nhận.`, `将永久删除 ${displayName(user)} 及其评论、战报、识阵样本和图片；反馈会匿名保留。无法撤销。请重新输入邮箱 ${user.email} 以确认。`, `${displayName(user)} と、そのコメント・戦報・編成解析サンプル・画像を完全に削除します。フィードバックは匿名で保持されます。元に戻せません。確認のため、メールアドレス ${user.email} を再入力してください。`),
      fields: [formField('adm-delete-email', L('Nhập lại email để xác nhận', '重新输入邮箱以确认', '確認のためメールアドレスを再入力'), email)],
      submitLabel: L('Xoá vĩnh viễn', '永久删除', '完全に削除'),
      danger: true,
      confirmDisabled: true,
      closeOnError: true,
      validate: () => (email.value.trim().toLowerCase() === expected ? '' : L('Email xác nhận không khớp.', '确认邮箱不匹配。', '確認用メールアドレスが一致しません。')),
      submit: async () => {
        const mine = selection;
        const confirmEmail = email.value.trim();
        try {
          await api(`/api/admin/users/${encodeURIComponent(user.id)}`, { method: 'DELETE', json: { confirmEmail } });
        } catch (error) {
          listDirty = true;
          if (mine === selection) {
            status.set(describeUserActionError(error), 'error');
            await loadDetail(user.id);
          } else if (!listView.hidden) await showList();
          throw error;
        }
        listDirty = true;
        if (mine === selection) status.set(L('Đã xoá tài khoản.', '账号已删除。', 'アカウントを削除しました。'));
        if (mine === selection || !listView.hidden) await showList();
      },
      onClose: refocusDetail,
    });
    email.addEventListener('input', () => {
      confirm.disabled = Boolean(confirm.dataset.busy) || email.value.trim().toLowerCase() !== expected;
    });
  };

  const renderDetail = ({ user, ...rest }) => {
    const allowed = availableActions(viewer, user);
    const actions = el('div', { class: 'adm-user-actions adm-actions' });
    const act = (label, iconName, variant, handler, attrs = {}) => {
      const node = iconButton(label, iconName, variant, attrs);
      node.addEventListener('click', handler);
      actions.append(node);
      return node;
    };
    if (allowed.ban) act(L('Khoá…', '封禁…', '利用停止…'), 'lock', 'adm-btn-accent', () => openBan(user), { 'aria-haspopup': 'dialog' });
    if (allowed.unban) {
      act(L('Mở khoá', '解封', '利用停止を解除'), 'unlock', 'adm-btn-paper', async (event) => {
        event.currentTarget.disabled = true;
        await mutate(user, () => api(`/api/admin/users/${encodeURIComponent(user.id)}/unban`, { method: 'POST', json: {} }), L('Đã mở khoá tài khoản.', '账号已解封。', 'アカウントの利用停止を解除しました。')).catch(() => {});
      });
    }
    if (allowed.role) {
      const grant = allowed.role === 'moderator';
      act(grant ? L('Cấp quyền kiểm duyệt viên', '授予版主权限', 'モデレーター権限を付与') : L('Thu quyền kiểm duyệt viên', '收回版主权限', 'モデレーター権限を取り消す'), 'shield', 'adm-btn-paper', async (event) => {
        event.currentTarget.disabled = true;
        await mutate(user, () => api(`/api/admin/users/${encodeURIComponent(user.id)}/role`, { method: 'POST', json: { role: allowed.role } }),
          grant ? L('Đã cấp quyền kiểm duyệt viên.', '已授予版主权限。', 'モデレーター権限を付与しました。') : L('Đã thu quyền kiểm duyệt viên.', '已收回版主权限。', 'モデレーター権限を取り消しました。')).catch(() => {});
      });
    }
    if (allowed.remove) act(L('Xoá tài khoản…', '删除账号…', 'アカウントを削除…'), 'trash', 'adm-btn-danger-line', () => openDelete(user, { resume: false }), { 'aria-haspopup': 'dialog' });
    if (allowed.resume) act(L('Thử xoá tiếp', '继续删除', '削除を続行'), 'trash', 'adm-btn-danger-line', () => openDelete(user, { resume: true }), { 'aria-haspopup': 'dialog' });
    const banned = user.ban && !user.deleting;
    detailBody.replaceChildren(
      el('div', { class: 'adm-user-profile' }, [
        el('div', { class: 'adm-user-profile-top' }, [
          el('div', { class: 'adm-user-head' }, [
            initialsAvatar(user, 'xl'),
            el('div', { class: 'adm-user-who' }, [
              el('h3', { class: 'adm-user-name', tabindex: '-1' }, displayName(user)),
              el('span', { class: 'adm-user-mail' }, String(user.email || '')),
              el('span', { class: 'adm-user-badges' }, [roleBadge(user.role), stateBadge(user)]),
            ]),
          ]),
          actions.childElementCount ? actions : null,
        ]),
        banned ? el('p', { class: 'adm-user-ban-line' }, banLine(user.ban)) : null,
        banned && user.ban.reason
          ? el('p', { class: 'adm-audit-reason' }, [el('span', { class: 'adm-audit-reason-label' }, L('Lý do khoá: ', '封禁理由：', '停止理由：')), String(user.ban.reason)])
          : null,
        allowed.removeHint ? el('p', { class: 'adm-hint' }, L('Mở khoá trước khi xoá tài khoản.', '请先解封，再删除账号。', '先に利用停止を解除してから、アカウントを削除してください。')) : null,
        user.deleting ? el('p', { class: 'adm-hint' }, L('Tài khoản đang được xoá; các thao tác khác đã tắt.', '账号正在删除中，其他操作已停用。', 'アカウントを削除中です。他の操作は無効になっています。')) : null,
        profileStats(user),
      ]),
      detailLists(rest),
    );
  };

  panel.append(status, listView, detailView);
  reloadNow();
}
