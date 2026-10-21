// Hai khu của /quan-tri/ về tài khoản: "Người dùng" (#nguoi-dung: danh sách, chi tiết, khoá/mở khoá, cấp/thu quyền
// kiểm duyệt viên, xoá tài khoản) và "Nhật ký" (#nhat-ky: mọi thao tác quản trị đã ghi, chỉ root).
// Module không có hiệu ứng khi nạp: chỉ community-admin.js gọi `openUsersPanel`/`openAuditPanel` (import vòng với
// community-admin.js an toàn vì chỉ dùng các hàm đã export, không dùng ở cấp module).
// Server mới là nơi kiểm quyền; ở đây chỉ ẩn nút với đích không thao tác được và dịch lỗi theo `code`.

import { L, currentLocale, formatDate, pick } from './i18n.js';
import { el } from './render.js';
import { api, avatar, describeError, displayName, formatDateTime, timeNode } from './community-api.js';
import { SCAN_STATUS_LABEL, adminStatus, button, emptyNote, formField, pagePath, pagedList, selectInput, textInput } from './community-admin.js';

const SEARCH_DEBOUNCE_MS = 300;
const REASON_MAX = 500;

/** Lỗi của thao tác trên một tài khoản: 403 `forbidden` ở đây là đích ngoài quyền (KDV khác, root, khoá của root). */
function describeUserActionError(error) {
  return error?.code === 'forbidden' ? L('Bạn không có quyền thao tác trên tài khoản này.', '你无权对该账号执行此操作。') : describeError(error);
}

/* ---------- Nhãn ---------- */

function roleLabel(role) {
  if (role === 'root') return L('Quản trị viên', '管理员');
  if (role === 'moderator') return L('Kiểm duyệt viên', '版主');
  return L('Người dùng', '用户');
}

/** Nhãn hành động nhật ký theo mã; mã lạ hiện nguyên mã. */
function actionLabel(action) {
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

const AUDIT_ACTIONS = [
  'user.ban', 'user.unban', 'user.role', 'user.delete.start', 'user.delete', 'comment.delete',
  'report.approve', 'report.reject', 'scan_sample.approve', 'scan_sample.reject', 'feedback.status',
  'post.create', 'post.update', 'post.delete', 'post.publish', 'post.unpublish', 'post.upload', 'ai.config.update',
  'team.approve', 'team.reject', 'team.delete', 'season.open',
];

function auditStatusBadge(status) {
  const badge = el('span', { class: 'cm-badge' });
  if (status === 'ok') {
    badge.dataset.status = 'approved';
    badge.textContent = L('Thành công', '成功');
  } else if (status === 'partial') {
    badge.dataset.status = 'pending';
    badge.textContent = L('Một phần', '部分完成');
  } else {
    badge.dataset.status = 'rejected';
    badge.textContent = L('Thất bại', '失败');
  }
  return badge;
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

/** Một dòng nhật ký (dùng ở khu Nhật ký và ở chi tiết người dùng). */
function auditItem(entry) {
  const targetText = [entry.target?.type ? targetTypeLabel(entry.target.type) : '', entry.target?.label].filter(Boolean).join(' · ');
  const deployPending = entry.meta?.deploy === 'pending';
  return el('li', { class: 'adm-card adm-audit' }, [
    el('p', { class: 'adm-meta' }, [
      timeNode(entry.createdAt),
      el('span', { class: 'adm-author' }, `${String(entry.actor?.label || '')} (${roleLabel(entry.actor?.role)})`),
      auditStatusBadge(entry.status),
      deployPending ? el('span', { class: 'cm-badge', dataset: { status: 'pending' } }, L('chưa rõ kết quả deploy', '部署结果未知')) : null,
    ]),
    el('p', { class: 'adm-audit-action' }, actionLabel(entry.action)),
    targetText ? el('p', { class: 'adm-meta' }, L(`Đối tượng: ${targetText}`, `对象：${targetText}`)) : null,
    entry.reason ? el('p', { class: 'adm-body' }, L(`Lý do: ${entry.reason}`, `理由：${entry.reason}`)) : null,
  ]);
}

/* ---------- Nhật ký ---------- */

export function openAuditPanel(panel, { head }) {
  const status = adminStatus();
  const filter = selectInput('adm-audit-action', [
    ['', L('Tất cả hành động', '全部动作')],
    ...AUDIT_ACTIONS.map((action) => [action, actionLabel(action)]),
  ], '');
  const list = el('ol', { class: 'adm-list', 'aria-label': L('Nhật ký quản trị', '管理日志') });
  const empty = emptyNote(L('Chưa có thao tác nào.', '暂无操作记录。'));
  const paged = pagedList({
    list,
    empty,
    status,
    fallbackFocus: head.querySelector('.adm-section-title'),
    fetchPage: (cursor) => {
      const params = new URLSearchParams();
      if (filter.value) params.set('action', filter.value);
      if (cursor) params.set('cursor', cursor);
      const query = params.toString();
      return api(`/api/admin/audit${query ? `?${query}` : ''}`);
    },
    render: auditItem,
  });
  filter.addEventListener('change', () => paged.reload(panel));
  panel.append(
    el('div', { class: 'adm-filters' }, formField('adm-audit-action', L('Hành động', '动作'), filter)),
    status, list, empty, paged.more,
  );
  paged.reload(panel);
}

/* ---------- Người dùng: hiển thị ---------- */

/** Thời điểm tương đối ("2 giờ trước"); quá một năm thì hiện ngày. */
function relativeTime(value) {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return '';
  const seconds = Math.round((time - Date.now()) / 1000);
  if (Math.abs(seconds) < 60) return L('vừa xong', '刚刚');
  const formatter = new Intl.RelativeTimeFormat(pick(currentLocale(), 'vi-VN', 'zh-CN'), { numeric: 'auto' });
  const units = [['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit);
  }
  return '';
}

function banText(user) {
  if (user.deleting) return L('Đang xoá', '删除中');
  if (!user.ban) return '';
  return user.ban.until
    ? L(`Khoá đến ${formatDateTime(user.ban.until)}`, `封禁至 ${formatDateTime(user.ban.until)}`)
    : L('Khoá vĩnh viễn', '永久封禁');
}

function countsText(counts) {
  const c = counts || {};
  return L(
    `${c.comments ?? 0} bình luận · ${c.reports ?? 0} chiến báo · ${c.feedback ?? 0} góp ý · ${c.scanSamples ?? 0} mẫu soi đội`,
    `${c.comments ?? 0} 条评论 · ${c.reports ?? 0} 份战报 · ${c.feedback ?? 0} 条反馈 · ${c.scanSamples ?? 0} 个识阵样本`,
  );
}

/** Dải thông tin dưới tên: ngày đăng ký, hoạt động, vai trò, khoá, số liệu. Email che chỉ là chữ. */
function userMeta(user) {
  const lastSeen = user.lastSeenAt ? relativeTime(user.lastSeenAt) : '';
  const ban = banText(user);
  return el('p', { class: 'adm-meta' }, [
    user.createdAt ? el('span', {}, L(`Đăng ký ${formatDate(user.createdAt)}`, `注册于 ${formatDate(user.createdAt)}`)) : null,
    el('span', {}, lastSeen ? L(`Hoạt động ${lastSeen}`, `最近活动 ${lastSeen}`) : L('Chưa ghi nhận', '暂无记录')),
    el('span', { class: 'cm-badge' }, roleLabel(user.role)),
    ban ? el('span', { class: 'cm-badge', dataset: { status: 'rejected' } }, ban) : null,
    el('span', {}, countsText(user.counts)),
  ]);
}

function userRow(user) {
  const open = el('button', { class: 'adm-user-open', type: 'button', dataset: { userId: user.id } }, [
    avatar(user),
    el('span', { class: 'adm-user-who' }, [
      el('span', { class: 'adm-author' }, displayName(user)),
      el('span', { class: 'adm-mail' }, String(user.email || '')),
    ]),
  ]);
  return el('li', { class: 'adm-card adm-user' }, [open, userMeta(user)]);
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

/* ---------- Người dùng: hộp thoại ---------- */

let dialogSeq = 0;

/**
 * Hộp thoại `<dialog>` native (kiểu `.footer-dialog`): tiêu đề, trường, nút Huỷ + nút xác nhận.
 * `submit()` chạy khi bấm xác nhận; lỗi hiện ở dòng `role=alert` của hộp thoại (người gọi tự báo + tải lại trạng thái),
 * hoặc đóng hộp thoại nếu `closeOnError` (lỗi đã báo ở dòng trạng thái của khu). `confirmDisabled` khoá nút xác nhận ban đầu.
 */
export function actionDialog({ title, lead, fields, submitLabel, danger = false, confirmDisabled = false, closeOnError = false, validate, submit, onClose }) {
  const titleId = `adm-dialog-title-${++dialogSeq}`;
  const alert = el('p', { class: 'cm-status adm-status', role: 'alert', hidden: '' });
  alert.dataset.kind = 'error';
  const show = (message) => {
    alert.textContent = message;
    alert.hidden = !message;
  };
  const confirm = button(submitLabel, { variant: danger ? 'adm-btn-danger' : 'primary', type: 'submit' });
  confirm.disabled = confirmDisabled;
  const cancel = button(L('Huỷ', '取消'));
  const form = el('form', { class: 'feedback-dialog-body', novalidate: '' }, [
    el('h2', { id: titleId, class: 'donate-dialog-title' }, title),
    lead ? el('p', { class: 'donate-dialog-lead' }, lead) : null,
    ...fields,
    alert,
    el('div', { class: 'adm-actions' }, [cancel, confirm]),
  ]);
  const dialog = el('dialog', { class: 'footer-dialog feedback-dialog adm-dialog', 'aria-labelledby': titleId }, form);
  cancel.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    dialog.remove();
    onClose?.();
  });
  let submitting = false;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;
    const invalid = validate?.();
    if (invalid) {
      show(invalid);
      return;
    }
    show('');
    submitting = true;
    confirm.dataset.busy = '1';
    confirm.disabled = true;
    cancel.disabled = true;
    try {
      await submit();
      dialog.close();
    } catch (error) {
      submitting = false;
      delete confirm.dataset.busy;
      if (closeOnError) {
        dialog.close();
        return;
      }
      confirm.disabled = false;
      cancel.disabled = false;
      show(describeUserActionError(error));
    }
  });
  document.body.append(dialog);
  dialog.showModal();
  return { dialog, confirm };
}

/* ---------- Người dùng: chi tiết ---------- */

function detailLists(body) {
  const section = (title, items, render, emptyText) => el('section', { class: 'adm-user-section' }, [
    el('h4', { class: 'adm-user-subtitle' }, title),
    items.length
      ? el('ul', { class: 'adm-list' }, items.map(render))
      : el('p', { class: 'adm-empty' }, emptyText),
  ]);
  const comments = Array.isArray(body.comments) ? body.comments : [];
  const reports = Array.isArray(body.reports) ? body.reports : [];
  const audit = Array.isArray(body.audit) ? body.audit : [];
  return [
    section(L('Bình luận gần đây', '最近评论'), comments, (comment) => el('li', { class: 'adm-card' }, [
      el('p', { class: 'adm-meta' }, [timeNode(comment.createdAt), pagePath(comment.page, comment.lang)]),
      el('p', { class: 'adm-body', lang: comment.lang === 'zh' ? 'zh-Hans' : 'vi' }, String(comment.body || '')),
    ]), L('Chưa có bình luận.', '暂无评论。')),
    section(L('Chiến báo gần đây', '最近战报'), reports, (report) => el('li', { class: 'adm-card' }, [
      el('p', { class: 'adm-meta' }, [
        timeNode(report.createdAt),
        pagePath(report.page, report.lang),
        el('span', { class: 'cm-badge', dataset: { status: report.status } }, SCAN_STATUS_LABEL[report.status] || String(report.status || '')),
      ]),
    ]), L('Chưa có chiến báo.', '暂无战报。')),
    section(L('Nhật ký về người này', '涉及此用户的日志'), audit, auditItem, L('Chưa có thao tác nào.', '暂无操作记录。')),
  ];
}

/* ---------- Người dùng: khu chính ---------- */

export function openUsersPanel(panel, { head, viewer }) {
  const status = adminStatus();
  const staffOnly = viewer.role !== 'root';

  /* Danh sách */
  const search = textInput('adm-users-q', '', { maxlength: '100', autocomplete: 'off', type: 'search' });
  const roleFilter = selectInput('adm-users-role', [
    ['', L('Tất cả', '全部')],
    ['user', roleLabel('user')],
    ['moderator', roleLabel('moderator')],
    ['root', roleLabel('root')],
  ], '');
  const stateFilter = selectInput('adm-users-status', [
    ['', L('Tất cả', '全部')],
    ['active', L('Bình thường', '正常')],
    ['banned', L('Đang bị khoá', '已封禁')],
    ['deleting', L('Đang xoá', '删除中')],
  ], '');
  const filters = el('div', { class: 'adm-filters adm-filters-top' }, [
    formField('adm-users-q', L('Tìm kiếm', '搜索'), search, staffOnly ? L('Tìm theo tên hoặc email đầy đủ', '按姓名或完整邮箱查找') : L('Tìm theo tên hoặc email', '按姓名或邮箱查找')),
    formField('adm-users-role', L('Vai trò', '角色'), roleFilter),
    formField('adm-users-status', L('Trạng thái', '状态'), stateFilter),
  ]);
  const list = el('ul', { class: 'adm-list', 'aria-label': L('Danh sách người dùng', '用户列表') });
  const empty = emptyNote(L('Không có người dùng phù hợp.', '没有符合条件的用户。'));
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
      if (stateFilter.value) params.set('status', stateFilter.value);
      if (cursor) params.set('cursor', cursor);
      const query = params.toString();
      return api(`/api/admin/users${query ? `?${query}` : ''}`);
    },
    render: (user) => {
      const row = userRow(user);
      row.querySelector('.adm-user-open').addEventListener('click', () => showDetail(user.id));
      return row;
    },
  });
  const listView = el('div', { class: 'adm-user-list-view' }, [filters, list, empty, paged.more]);

  let timer = null;
  const reloadNow = () => {
    clearTimeout(timer);
    return paged.reload(listView);
  };
  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(reloadNow, SEARCH_DEBOUNCE_MS);
  });
  roleFilter.addEventListener('change', reloadNow);
  stateFilter.addEventListener('change', reloadNow);

  /* Chi tiết */
  const detailBody = el('div', { class: 'adm-user-detail-body' });
  const back = button(L('Quay lại danh sách', '返回列表'), { iconName: 'back' });
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
    detailBody.replaceChildren(el('p', { class: 'adm-empty' }, L('Đang tải…', '加载中…')));
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

  const openBan = (user) => {
    const duration = selectInput('adm-ban-duration', [
      ['1d', L('1 ngày', '1 天')],
      ['7d', L('7 ngày', '7 天')],
      ['30d', L('30 ngày', '30 天')],
      ['permanent', L('Vĩnh viễn', '永久')],
    ], '1d');
    const reason = el('textarea', { id: 'adm-ban-reason', class: 'cm-textarea', rows: '3', maxlength: String(REASON_MAX), required: '' });
    actionDialog({
      title: L('Khoá tài khoản', '封禁账号'),
      lead: L(`Người bị khoá sẽ bị đăng xuất, không đăng nhập lại được và nội dung công khai của họ được ẩn. Tài khoản: ${displayName(user)}.`, `被封禁的用户会被强制下线、无法再次登录，其公开内容将被隐藏。账号：${displayName(user)}。`),
      fields: [
        formField('adm-ban-duration', L('Thời hạn', '期限'), duration),
        formField('adm-ban-reason', L('Lý do', '理由'), reason, L(`Bắt buộc, tối đa ${REASON_MAX} ký tự. Người bị khoá sẽ thấy lý do này.`, `必填，最多 ${REASON_MAX} 个字符。被封禁者将看到此理由。`)),
      ],
      submitLabel: L('Khoá', '封禁'),
      danger: true,
      validate: () => (reason.value.trim() ? '' : L('Cần nhập lý do khoá.', '请填写封禁理由。')),
      submit: () => mutate(user, () => api(`/api/admin/users/${encodeURIComponent(user.id)}/ban`, {
        method: 'POST',
        json: { duration: duration.value, reason: reason.value.trim() },
      }), L('Đã khoá tài khoản.', '账号已封禁。')),
      onClose: refocusDetail,
    });
  };

  const openDelete = (user, { resume }) => {
    const expected = String(user.email || '').trim().toLowerCase();
    const email = textInput('adm-delete-email', '', { autocomplete: 'off', spellcheck: 'false' });
    const { confirm } = actionDialog({
      title: resume ? L('Thử xoá tiếp', '继续删除') : L('Xoá tài khoản', '删除账号'),
      lead: resume
        ? L(`Lần xoá trước chưa hoàn tất. Gõ lại email ${user.email} để chạy tiếp.`, `上次删除未完成。重新输入邮箱 ${user.email} 以继续。`)
        : L(`Xoá vĩnh viễn ${displayName(user)} cùng bình luận, chiến báo, mẫu soi đội và ảnh. Góp ý được giữ lại ẩn danh. Không thể hoàn tác. Gõ lại email ${user.email} để xác nhận.`, `将永久删除 ${displayName(user)} 及其评论、战报、识阵样本和图片；反馈会匿名保留。无法撤销。请重新输入邮箱 ${user.email} 以确认。`),
      fields: [formField('adm-delete-email', L('Nhập lại email để xác nhận', '重新输入邮箱以确认'), email)],
      submitLabel: L('Xoá vĩnh viễn', '永久删除'),
      danger: true,
      confirmDisabled: true,
      closeOnError: true,
      validate: () => (email.value.trim().toLowerCase() === expected ? '' : L('Email xác nhận không khớp.', '确认邮箱不匹配。')),
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
        if (mine === selection) status.set(L('Đã xoá tài khoản.', '账号已删除。'));
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
    const act = (label, handler, variant = '') => {
      const node = button(label, { variant });
      node.addEventListener('click', handler);
      actions.append(node);
      return node;
    };
    if (allowed.ban) act(L('Khoá…', '封禁…'), () => openBan(user), 'adm-btn-danger');
    if (allowed.unban) {
      act(L('Mở khoá', '解封'), async (event) => {
        event.currentTarget.disabled = true;
        await mutate(user, () => api(`/api/admin/users/${encodeURIComponent(user.id)}/unban`, { method: 'POST', json: {} }), L('Đã mở khoá tài khoản.', '账号已解封。')).catch(() => {});
      });
    }
    if (allowed.role) {
      const grant = allowed.role === 'moderator';
      act(grant ? L('Cấp quyền kiểm duyệt viên', '授予版主权限') : L('Thu quyền kiểm duyệt viên', '收回版主权限'), async (event) => {
        event.currentTarget.disabled = true;
        await mutate(user, () => api(`/api/admin/users/${encodeURIComponent(user.id)}/role`, { method: 'POST', json: { role: allowed.role } }),
          grant ? L('Đã cấp quyền kiểm duyệt viên.', '已授予版主权限。') : L('Đã thu quyền kiểm duyệt viên.', '已收回版主权限。')).catch(() => {});
      });
    }
    if (allowed.remove) act(L('Xoá tài khoản…', '删除账号…'), () => openDelete(user, { resume: false }), 'adm-btn-danger');
    if (allowed.resume) act(L('Thử xoá tiếp', '继续删除'), () => openDelete(user, { resume: true }), 'adm-btn-danger');
    detailBody.replaceChildren(...[
      el('div', { class: 'adm-card adm-user-head' }, [
        avatar(user),
        el('div', { class: 'adm-user-who' }, [
          el('h3', { class: 'adm-user-name', tabindex: '-1' }, displayName(user)),
          el('span', { class: 'adm-mail' }, String(user.email || '')),
        ]),
      ]),
      userMeta(user),
      user.ban?.reason ? el('p', { class: 'adm-body' }, L(`Lý do khoá: ${user.ban.reason}`, `封禁理由：${user.ban.reason}`)) : null,
      actions,
      allowed.removeHint ? el('p', { class: 'adm-hint' }, L('Mở khoá trước khi xoá tài khoản.', '请先解封，再删除账号。')) : null,
      user.deleting ? el('p', { class: 'adm-hint' }, L('Tài khoản đang được xoá; các thao tác khác đã tắt.', '账号正在删除中，其他操作已停用。')) : null,
      ...detailLists(rest),
    ].filter(Boolean));
  };

  panel.append(status, listView, detailView);
  reloadNow();
}
