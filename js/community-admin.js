// Trang /quan-tri/ (noindex, artboard Admin*): cột điều hướng trái (≤960px thành hàng chip) mở sáu khu theo hash —
// "Duyệt chiến báo" (#chien-bao: ảnh, dữ liệu AI đã xác nhận, duyệt / từ chối kèm lý do),
// "Bài viết" (#bai-viet: bảng bài, soạn/sửa Markdown có xem trước an toàn, FAQ, lưu nháp, xuất bản/gỡ xuất bản),
// "Bình luận" (#binh-luan: xoá bình luận vi phạm trên mọi trang), "Góp ý" (#gop-y: góp ý/báo lỗi từ footer,
// đánh dấu đã xử lý), "Soi đội" (#soi-doi: tỷ lệ ô sửa/không rõ ẩn danh, duyệt ảnh gửi tự nguyện, xuất fixture
// bộ ảnh chuẩn) và "AI" (#ai: nhà cung cấp AI + chuỗi failover của từng tính năng).
// Server mới là nơi kiểm quyền; trang chỉ ẩn giao diện với người không phải admin.

import { L, currentLocale, localePath } from './i18n.js';
import { el, icon, svgNode } from './render.js';
import {
  api,
  avatar,
  describeError,
  displayName,
  downscaleImage,
  liveStatus,
  loadSession,
  signInPrompt,
  splitNames,
  timeNode,
  unavailableNotice,
} from './community-api.js';
import { reportSummary } from './community-reports.js';
import { FEEDBACK_KINDS } from './feedback-kinds.js';

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,100}$/;

/* ---------- Markdown an toàn (xem trước) ---------- */
// Tập con: tiêu đề, đoạn, danh sách, trích dẫn, khối code, kẻ ngang, đậm/nghiêng/code/link/ảnh.
// Dựng thẳng bằng DOM nên mọi HTML thô trong bài hiện thành chữ, không bao giờ được thực thi.

function safeHref(url) {
  const value = String(url || '').trim();
  if (/^https?:\/\//i.test(value) || /^mailto:/i.test(value) || value.startsWith('#')) return value;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  return null;
}

function safeImageSrc(url) {
  const value = String(url || '').trim();
  if (/^https:\/\//i.test(value)) return value;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  return null;
}

const INLINE_PATTERN = /`([^`]+)`|\*\*(.+?)\*\*|\*(?!\s)(.+?)\*|!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)/gu;

function inlineNodes(text) {
  const nodes = [];
  let last = 0;
  for (const match of text.matchAll(INLINE_PATTERN)) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const [whole, code, strong, em, imgAlt, imgSrc, linkText, linkHref] = match;
    if (code !== undefined) nodes.push(el('code', {}, code));
    else if (strong !== undefined) nodes.push(el('strong', {}, inlineNodes(strong)));
    else if (em !== undefined) nodes.push(el('em', {}, inlineNodes(em)));
    else if (imgSrc !== undefined) {
      const src = safeImageSrc(imgSrc);
      nodes.push(src ? el('img', { src, alt: imgAlt, loading: 'lazy' }) : whole);
    } else if (linkHref !== undefined) {
      const href = safeHref(linkHref);
      nodes.push(href ? el('a', { href, rel: 'noopener', target: '_blank' }, inlineNodes(linkText)) : linkText);
    }
    last = match.index + whole.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Markdown → DocumentFragment (chỉ tập con an toàn ở trên). */
export function renderMarkdown(source) {
  const fragment = document.createDocumentFragment();
  const lines = String(source || '').replace(/\r\n?/g, '\n').split('\n');
  let paragraph = [];
  const flush = () => {
    if (paragraph.length) fragment.append(el('p', {}, inlineNodes(paragraph.join(' '))));
    paragraph = [];
  };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^```/.test(line)) {
      flush();
      const code = [];
      for (index += 1; index < lines.length && !/^```/.test(lines[index]); index += 1) code.push(lines[index]);
      fragment.append(el('pre', {}, el('code', {}, code.join('\n'))));
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flush();
      // Tiêu đề bài là h1 của trang nên `#` trong thân bắt đầu từ h2.
      fragment.append(el(`h${heading[1].length + 1}`, {}, inlineNodes(heading[2].trim())));
      continue;
    }
    if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) {
      flush();
      fragment.append(el('hr'));
      continue;
    }
    const listMatch = line.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
    if (listMatch) {
      flush();
      const ordered = /\d/.test(listMatch[1]);
      const items = [];
      while (index < lines.length) {
        const item = lines[index].match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
        if (!item || /\d/.test(item[1]) !== ordered) break;
        items.push(el('li', {}, inlineNodes(item[2])));
        index += 1;
      }
      index -= 1;
      fragment.append(el(ordered ? 'ol' : 'ul', {}, items));
      continue;
    }
    if (/^>\s?/.test(line)) {
      flush();
      const quoted = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoted.push(lines[index].replace(/^>\s?/, ''));
        index += 1;
      }
      index -= 1;
      fragment.append(el('blockquote', {}, renderMarkdown(quoted.join('\n'))));
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    paragraph.push(line.trim());
  }
  flush();
  return fragment;
}

/* ---------- Icon nét (artboard Admin*) ---------- */

const path = (d) => ['path', { d }];
const ICONS = {
  reports: [path('M4 20V5a1 1 0 0 1 1-1h11l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z'), path('M8 13l2.5 2.5L16 10')],
  posts: [path('M4 20h4L19 9l-4-4L4 16z'), path('M13 7l4 4')],
  comments: [path('M4 5h16v11H9l-5 4z')],
  feedback: [path('M4 4h16v12H7l-3 3z'), path('M12 7v4'), path('M12 13.5v.1')],
  scan: [['rect', { x: 3, y: 5, width: 18, height: 14, rx: 2 }], ['circle', { cx: 11, cy: 12, r: 3.5 }], path('M13.5 14.5L17 18')],
  ai: [['rect', { x: 5, y: 7, width: 14, height: 11, rx: 2 }], path('M12 3v4'), ['circle', { cx: 9.5, cy: 12.5, r: 1 }], ['circle', { cx: 14.5, cy: 12.5, r: 1 }]],
  check: [path('M5 12l5 5L20 7')],
  plus: [path('M12 5v14'), path('M5 12h14')],
  back: [path('M19 12H5'), path('M11 6l-6 6 6 6')],
  up: [path('M12 19V5'), path('M6 11l6-6 6 6')],
  down: [path('M12 5v14'), path('M6 13l6 6 6-6')],
  image: [['rect', { x: 3, y: 5, width: 18, height: 14, rx: 2 }], ['circle', { cx: 9, cy: 10, r: 1.8 }], path('M21 16l-5-5-8 8')],
  external: [path('M14 4h6v6'), path('M20 4l-9 9'), path('M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5')],
};

function glyph(name, size = 16) {
  return icon(ICONS[name].map(([tag, attrs]) => svgNode(tag, attrs)), { size });
}

/** Nút chữ + icon tuỳ chọn; `variant` thêm class biến thể (primary, adm-btn-accent, adm-btn-danger…). */
function button(text, { variant = '', iconName = null, compact = false, type = 'button', ...attrs } = {}) {
  const className = ['ana-btn', variant, compact ? 'adm-btn-compact' : ''].filter(Boolean).join(' ');
  return el('button', { class: className, type, ...attrs }, [iconName ? glyph(iconName) : null, text]);
}

/* ---------- Số việc chờ (GET /api/admin/counts) ---------- */
// Badge trên điều hướng + dòng tổng ở khu Góp ý. Tải khi mở trang và sau mỗi thao tác đổi trạng thái.
// Lỗi tải chỉ giữ số cũ: số đếm là phụ, không chặn việc duyệt. Các lần tải chồng nhau: chỉ lần gọi sau cùng được vẽ.

function countsStore() {
  let current = null;
  let generation = 0;
  const listeners = new Set();
  return {
    async refresh() {
      const mine = ++generation;
      let next;
      try {
        next = await api('/api/admin/counts');
      } catch {
        return;
      }
      if (mine !== generation) return;
      current = next;
      for (const listener of listeners) listener(current);
    },
    subscribe(listener) {
      listeners.add(listener);
      if (current) listener(current);
    },
  };
}

/* ---------- Khung: điều hướng khu theo hash ---------- */
// Link thật (`#chien-bao`…) để mở thẳng một khu, quay lại bằng nút Back; khu chỉ dựng lần đầu được mở.
// Hash không trùng id phần tử nào nên trình duyệt không tự cuộn.

function adminShell(definitions, counts) {
  const titles = [];
  const sections = [];
  const badges = [];
  const links = definitions.map((definition) => {
    const titleId = `adm-title-${definition.id}`;
    const title = el('h2', { id: titleId, class: 'adm-section-title', tabindex: '-1' }, definition.label);
    const actions = el('div', { class: 'adm-actions' });
    const head = el('div', { class: 'adm-section-head' }, [
      el('div', { class: 'adm-section-heading' }, [title, el('p', { class: 'adm-lead' }, definition.lead)]),
      actions,
    ]);
    const section = el('section', { id: `adm-panel-${definition.id}`, class: 'adm-section', 'aria-labelledby': titleId, hidden: '' }, head);
    titles.push(title);
    sections.push({ section, head, actions, counts });
    const badge = definition.count ? el('span', { class: 'adm-nav-count', hidden: '' }) : null;
    if (badge) badges.push([definition.count, badge]);
    return el('a', { class: 'adm-nav-link', href: `#${definition.hash}` }, [glyph(definition.icon, 18), el('span', { class: 'adm-nav-label' }, definition.label), badge]);
  });
  counts.subscribe((values) => {
    for (const [{ key, unit }, badge] of badges) {
      const value = Number(values?.[key]) || 0;
      badge.hidden = value === 0;
      badge.replaceChildren(el('span', { 'aria-hidden': 'true' }, String(value)), el('span', { class: 'visually-hidden' }, `, ${value} ${unit}`));
    }
  });
  const list = el('ul', { class: 'adm-nav-list' }, links.map((link) => el('li', {}, link)));
  const opened = new Set();
  const findSection = (hash) => definitions.findIndex((definition) => `#${definition.hash}` === hash);
  const select = (index, { focus = false } = {}) => {
    sections.forEach(({ section }, current) => {
      section.hidden = current !== index;
      if (current === index) links[current].setAttribute('aria-current', 'page');
      else links[current].removeAttribute('aria-current');
    });
    // Hàng chip mobile: kéo chip đang chọn vào giữa (chỉ cuộn ngang, không đẩy trang).
    if (list.scrollWidth > list.clientWidth) {
      list.scrollLeft = links[index].offsetLeft - (list.clientWidth - links[index].offsetWidth) / 2;
    }
    if (!opened.has(index)) {
      opened.add(index);
      definitions[index].open(sections[index].section, sections[index]);
    }
    if (focus) titles[index].focus();
  };
  // Hash khác (vd `#main-content` của link "bỏ qua tới nội dung") không phải khu quản trị: giữ khu đang mở.
  window.addEventListener('hashchange', () => {
    const index = findSection(window.location.hash);
    if (index >= 0) select(index, { focus: true });
  });
  const node = el('div', { class: 'adm-shell' }, [
    el('aside', { class: 'adm-side' }, [
      el('nav', { class: 'adm-nav', 'aria-label': L('Khu quản trị', '管理区域') }, list),
      el('p', { class: 'adm-side-note' }, L(
        'Quyền do máy chủ kiểm; trang chỉ ẩn giao diện với tài khoản không phải quản trị.',
        '权限由服务器校验；页面只是对非管理员隐藏界面。',
      )),
    ]),
    el('div', { class: 'adm-main' }, sections.map(({ section }) => section)),
  ]);
  return { node, start: () => select(Math.max(0, findSection(window.location.hash))) };
}

/* ---------- Mảnh dùng chung của các khu ---------- */

/** Dòng trạng thái của khu (role=status): thành công xanh, `warn` hổ phách, `error` đỏ. */
function adminStatus() {
  return liveStatus('cm-status adm-status');
}

function emptyNote(text) {
  return el('p', { class: 'adm-empty', hidden: '' }, text);
}

function pagePath(page, lang) {
  return typeof page === 'string' && page.startsWith('/')
    ? el('a', { class: 'adm-path', href: lang ? localePath(page, lang) : page }, page)
    : null;
}

const langLabel = (lang) => (lang === 'zh' ? '中文' : 'Tiếng Việt');

function formField(id, label, control, hint) {
  if (hint) control.setAttribute('aria-describedby', `${id}-hint`);
  return el('div', { class: 'adm-field' }, [
    el('label', { class: 'adm-label', for: id }, label),
    control,
    hint ? el('p', { id: `${id}-hint`, class: 'adm-hint' }, hint) : null,
  ]);
}

function textInput(id, value, { mono = false, ...attrs } = {}) {
  const node = el('input', { id, class: mono ? 'cm-input adm-mono' : 'cm-input', type: 'text', ...attrs });
  node.value = value ?? '';
  return node;
}

function selectInput(id, options, value, attrs = {}) {
  const node = el('select', { id, class: 'cm-select', ...attrs }, options.map(([v, text]) => el('option', { value: v }, text)));
  node.value = value;
  return node;
}

/** Ô ảnh mở ảnh gốc ở tab mới (nền dải, icon mở ngoài ở góc). */
function imageTile(href, alt) {
  return el('a', { class: 'adm-report-image', href, target: '_blank', rel: 'noopener' }, [
    el('img', { src: href, alt, loading: 'lazy' }),
    el('span', { class: 'adm-report-image-open' }, glyph('external')),
    el('span', { class: 'visually-hidden' }, L('(mở tab mới)', '（在新标签页打开）')),
  ]);
}

/**
 * Danh sách phân trang theo cursor + nút "Tải thêm". `fetchPage(cursor)` trả `{ items, nextCursor }`,
 * `render(entry)` dựng một <li>. Tải lại (đổi bộ lọc) khi trang trước chưa về: chỉ lần tải mới nhất được vẽ.
 */
function pagedList({ list, empty, status, fetchPage, render, fallbackFocus }) {
  const more = button(L('Tải thêm', '加载更多'), { variant: 'adm-more', hidden: '' });
  let cursor = null;
  let generation = 0;
  const refresh = () => {
    empty.hidden = list.childElementCount > 0;
  };
  const load = async ({ reset = false } = {}) => {
    const current = reset ? ++generation : generation;
    if (reset) cursor = null;
    const body = await fetchPage(cursor);
    if (current !== generation) return;
    const items = (Array.isArray(body?.items) ? body.items : []).map(render);
    if (reset) list.replaceChildren(...items);
    else list.append(...items);
    cursor = typeof body?.nextCursor === 'string' && body.nextCursor ? body.nextCursor : null;
    more.hidden = !cursor;
    refresh();
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
  return {
    more,
    reload(busyNode) {
      busyNode.setAttribute('aria-busy', 'true');
      return load({ reset: true })
        .catch((error) => status.set(describeError(error), 'error'))
        .finally(() => busyNode.removeAttribute('aria-busy'));
    },
    /** Bỏ một mục đã xử lý xong; focus sang nút đầu của mục kề, hết mục thì về tiêu đề khu. */
    remove(item) {
      const next = item.nextElementSibling || item.previousElementSibling;
      item.remove();
      refresh();
      (next?.querySelector('button') || fallbackFocus).focus();
    },
  };
}

/* ---------- Duyệt chiến báo ---------- */

function pendingReportItem(report, { status, onDone }) {
  const imageUrl = typeof report.imageUrl === 'string' && report.imageUrl.startsWith('/api/')
    ? report.imageUrl
    : `/api/reports/${encodeURIComponent(report.id)}/image`;
  const approve = button(L('Duyệt', '通过'), { variant: 'primary', iconName: 'check' });
  const reject = button(L('Từ chối', '拒绝'));
  const actions = el('div', { class: 'adm-actions' }, [approve, reject]);
  const item = el('li', { class: 'adm-card adm-report', dataset: { reportId: String(report.id) } }, [
    imageTile(imageUrl, L('Ảnh chiến báo', '战报截图')),
    el('div', { class: 'adm-report-main' }, [
      el('p', { class: 'adm-meta' }, [
        avatar(report.author),
        el('span', { class: 'adm-author' }, displayName(report.author)),
        timeNode(report.createdAt),
        pagePath(report.page, report.lang),
      ]),
      // Dữ liệu AI đã được người gửi xác nhận/sửa trước khi gửi; server chỉ lưu bản đã xác nhận.
      reportSummary(report, { caption: L('Dữ liệu AI đã được người gửi xác nhận', 'AI 识别结果已由提交者确认') }),
      actions,
    ]),
  ]);

  approve.addEventListener('click', async () => {
    approve.disabled = true;
    reject.disabled = true;
    try {
      await api(`/api/admin/reports/${encodeURIComponent(report.id)}/approve`, { method: 'POST', json: {} });
      status.set(L('Đã duyệt chiến báo.', '战报已通过。'));
      onDone(item);
    } catch (error) {
      approve.disabled = false;
      reject.disabled = false;
      status.set(describeError(error), 'error');
    }
  });

  reject.addEventListener('click', () => {
    const inputId = `cm-reject-${report.id}`;
    const reason = el('textarea', { id: inputId, class: 'cm-textarea', rows: '3', maxlength: '500', required: '' });
    const confirm = button(L('Xác nhận từ chối', '确认拒绝'), { variant: 'adm-btn-accent', type: 'submit' });
    const cancel = button(L('Huỷ', '取消'));
    const form = el('form', { class: 'adm-reject', novalidate: '' }, [
      formField(inputId, L('Lý do từ chối', '拒绝原因'), reason, L('Người gửi xem được lý do này ở trang Cộng đồng.', '提交者可在社区页面看到该原因。')),
      el('div', { class: 'adm-actions' }, [confirm, cancel]),
    ]);
    cancel.addEventListener('click', () => {
      form.replaceWith(actions);
      reject.focus();
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const text = reason.value.trim();
      if (!text) {
        status.set(L('Hãy nhập lý do từ chối.', '请填写拒绝原因。'), 'error');
        reason.setAttribute('aria-invalid', 'true');
        reason.focus();
        return;
      }
      confirm.disabled = true;
      try {
        await api(`/api/admin/reports/${encodeURIComponent(report.id)}/reject`, { method: 'POST', json: { reason: text } });
        status.set(L('Đã từ chối chiến báo.', '战报已拒绝。'));
        onDone(item);
      } catch (error) {
        confirm.disabled = false;
        status.set(describeError(error), 'error');
      }
    });
    actions.replaceWith(form);
    reason.focus();
  });
  return item;
}

function openReportsPanel(panel, { head, counts }) {
  const status = adminStatus();
  const list = el('ol', { class: 'adm-list adm-list-roomy', 'aria-label': L('Chiến báo chờ duyệt', '待审核战报') });
  const empty = emptyNote(L('Không còn chiến báo nào chờ duyệt.', '没有待审核的战报。'));
  const paged = pagedList({
    list,
    empty,
    status,
    fallbackFocus: head.querySelector('.adm-section-title'),
    fetchPage: (cursor) => {
      const params = new URLSearchParams({ status: 'pending' });
      if (cursor) params.set('cursor', cursor);
      return api(`/api/admin/reports?${params}`);
    },
    render: (report) => pendingReportItem(report, {
      status,
      onDone: (item) => {
        paged.remove(item);
        counts.refresh();
      },
    }),
  });
  panel.append(status, list, empty, paged.more);
  paged.reload(panel);
}

/* ---------- Kiểm duyệt bình luận ---------- */
// Admin xem mọi bình luận của mọi trang (cả vi lẫn zh, có nhãn ngôn ngữ) để xoá bình luận vi phạm.

function openCommentsPanel(panel, { head }) {
  const status = adminStatus();
  const list = el('ol', { class: 'adm-list', 'aria-label': L('Bình luận mới nhất', '最新评论') });
  const empty = emptyNote(L('Chưa có bình luận nào.', '还没有评论。'));
  const item = (comment) => {
    const remove = button(L('Xoá', '删除'), { variant: 'adm-btn-danger', compact: true });
    const row = el('li', { class: 'adm-card adm-comment' }, [
      avatar(comment.author),
      el('div', { class: 'adm-comment-main' }, [
        el('p', { class: 'adm-meta' }, [
          el('span', { class: 'adm-author' }, displayName(comment.author)),
          timeNode(comment.createdAt),
          el('span', { class: 'cm-badge' }, langLabel(comment.lang)),
          pagePath(comment.page, comment.lang),
        ]),
        el('p', { class: 'adm-body', lang: comment.lang === 'zh' ? 'zh-Hans' : 'vi' }, String(comment.body || '')),
        remove,
      ]),
    ]);
    remove.addEventListener('click', async () => {
      if (!window.confirm(L('Xoá bình luận này?', '确定删除这条评论吗？'))) return;
      remove.disabled = true;
      try {
        await api(`/api/comments/${encodeURIComponent(comment.id)}`, { method: 'DELETE' });
        status.set(L('Đã xoá bình luận.', '评论已删除。'));
        paged.remove(row);
      } catch (error) {
        remove.disabled = false;
        status.set(describeError(error), 'error');
      }
    });
    return row;
  };
  const paged = pagedList({
    list,
    empty,
    status,
    fallbackFocus: head.querySelector('.adm-section-title'),
    fetchPage: (cursor) => api(`/api/admin/comments${cursor ? `?${new URLSearchParams({ cursor })}` : ''}`),
    render: item,
  });
  panel.append(status, list, empty, paged.more);
  paged.reload(panel);
}

/* ---------- Góp ý, sửa lỗi ---------- */
// Góp ý gửi từ hộp thoại ở footer (cả khách ẩn danh). Admin lọc theo trạng thái/loại và chuyển Mới ⇄ Đã xử lý;
// trả lời người gửi bằng thư (link mailto hoặc Reply ngay trong thư báo).

const FEEDBACK_STATUS_LABEL = { new: L('Chưa xử lý', '未处理'), done: L('Đã xử lý', '已处理') };
/** Màu badge loại góp ý: lỗi son, thông tin sai hổ phách, còn lại giấy đậm. */
const FEEDBACK_KIND_TONE = { bug: 'accent', wrong_info: 'warn' };

function feedbackItem(entry, { status, onToggle }) {
  const kind = FEEDBACK_KINDS.find((candidate) => candidate.id === entry.kind);
  const badge = el('span', { class: 'cm-badge' });
  const toggle = el('button', { type: 'button' });
  let current = entry.status === 'done' ? 'done' : 'new';
  const email = typeof entry.email === 'string' && entry.email ? entry.email : null;
  const mailto = email ? `mailto:${email}?subject=${encodeURIComponent(`Re: ${entry.title}`)}` : null;
  const row = el('li', { class: 'adm-card adm-feedback cm-feedback-item' }, [
    el('p', { class: 'adm-meta' }, [
      el('span', { class: 'cm-badge', dataset: { tone: FEEDBACK_KIND_TONE[entry.kind] ?? '' } }, kind ? L(kind.vi, kind.zh) : String(entry.kind || '')),
      badge,
      el('span', { class: 'adm-author' }, entry.author ? displayName(entry.author) : L('Ẩn danh', '匿名')),
      timeNode(entry.createdAt),
      el('span', { class: 'cm-badge' }, langLabel(entry.lang)),
      pagePath(entry.page),
      mailto ? el('a', { class: 'adm-mail', href: mailto }, email) : null,
    ]),
    el('p', { class: 'adm-feedback-title' }, String(entry.title || '')),
    el('p', { class: 'adm-body', lang: entry.lang === 'zh' ? 'zh-Hans' : 'vi' }, String(entry.body || '')),
    toggle,
  ]);
  const paint = () => {
    const done = current === 'done';
    row.dataset.status = current;
    badge.textContent = FEEDBACK_STATUS_LABEL[current];
    badge.dataset.status = done ? 'approved' : 'pending';
    toggle.className = done ? 'ana-btn adm-btn-compact' : 'ana-btn primary adm-btn-compact';
    toggle.replaceChildren(...(done
      ? [L('Đánh dấu chưa xử lý', '标记为未处理')]
      : [glyph('check'), L('Đánh dấu đã xử lý', '标记为已处理')]));
  };
  paint();
  toggle.addEventListener('click', async () => {
    const next = current === 'done' ? 'new' : 'done';
    toggle.disabled = true;
    try {
      await api(`/api/admin/feedback/${encodeURIComponent(entry.id)}/status`, { method: 'POST', json: { status: next } });
      current = next;
      paint();
      onToggle();
      status.set(next === 'done' ? L('Đã đánh dấu đã xử lý.', '已标记为已处理。') : L('Đã đánh dấu chưa xử lý.', '已标记为未处理。'));
    } catch (error) {
      status.set(describeError(error), 'error');
    } finally {
      toggle.disabled = false;
    }
  });
  return row;
}

function openFeedbackPanel(panel, { head, counts }) {
  const status = adminStatus();
  const statusFilter = selectInput('cm-feedback-status', [
    ['new', FEEDBACK_STATUS_LABEL.new],
    ['done', FEEDBACK_STATUS_LABEL.done],
    ['', L('Tất cả', '全部')],
  ], 'new');
  const kindFilter = selectInput('cm-feedback-kind', [
    ['', L('Tất cả', '全部')],
    ...FEEDBACK_KINDS.map((kind) => [kind.id, L(kind.vi, kind.zh)]),
  ], '');
  // Dòng tổng theo artboard AdminFeedback: "3 góp ý chưa xử lý · 12 đã xử lý" (mọi loại).
  const summary = el('p', { class: 'adm-filter-summary', hidden: '' });
  counts.subscribe(({ feedbackNew, feedbackDone }) => {
    summary.replaceChildren(
      el('strong', {}, String(feedbackNew)),
      L(` góp ý chưa xử lý · ${feedbackDone} đã xử lý`, ` 条未处理 · ${feedbackDone} 条已处理`),
    );
    summary.hidden = false;
  });
  const filters = el('div', { class: 'adm-filters' }, [
    formField('cm-feedback-status', L('Trạng thái', '状态'), statusFilter),
    formField('cm-feedback-kind', L('Loại', '类型'), kindFilter),
    summary,
  ]);
  const list = el('ol', { class: 'adm-list', 'aria-label': L('Góp ý', '意见反馈') });
  const empty = emptyNote(L('Không có góp ý nào.', '没有反馈。'));
  const paged = pagedList({
    list,
    empty,
    status,
    fallbackFocus: head.querySelector('.adm-section-title'),
    fetchPage: (cursor) => {
      const params = new URLSearchParams();
      if (statusFilter.value) params.set('status', statusFilter.value);
      if (kindFilter.value) params.set('kind', kindFilter.value);
      if (cursor) params.set('cursor', cursor);
      const query = params.toString();
      return api(`/api/admin/feedback${query ? `?${query}` : ''}`);
    },
    render: (entry) => feedbackItem(entry, { status, onToggle: () => counts.refresh() }),
  });
  statusFilter.addEventListener('change', () => paged.reload(panel));
  kindFilter.addEventListener('change', () => paged.reload(panel));
  panel.append(filters, status, list, empty, paged.more);
  paged.reload(panel);
}

/* ---------- Soi đội: tín hiệu lỗi ---------- */
// (a) Đếm ẩn danh theo màn hình × phe; (b) ảnh người dùng gửi tự nguyện: duyệt rồi tải fixture cho bộ ảnh chuẩn.

const SCAN_SCREEN_LABEL = {
  battleReport: L('Chiến báo', '战报'),
  teamDetail: L('Chi tiết đội', '队伍详情'),
  other: L('Khác', '其他'),
};
const SCAN_SIDE_LABEL = { left: L('Trái (ta)', '左（我方）'), right: L('Phải (đối thủ)', '右（对手）') };
const SCAN_STATUS_LABEL = {
  pending: L('Chờ duyệt', '待审核'),
  approved: L('Đã duyệt', '已通过'),
  rejected: L('Đã từ chối', '已拒绝'),
};

const percent = (part, whole) => (whole > 0 ? `${Math.round((part / whole) * 1000) / 10}%` : '—');

function adminTable(headers, rows) {
  return el('div', { class: 'adm-table-wrap adm-table-scroll' }, el('table', { class: 'adm-table' }, [
    el('thead', {}, el('tr', {}, headers.map((text) => el('th', { scope: 'col' }, text)))),
    el('tbody', {}, rows),
  ]));
}

function scanStatsTable(rows) {
  return adminTable(
    [L('Màn hình', '界面'), L('Phe', '阵营'), L('Số lượt', '次数'), L('% ô sửa', '修改占比'), L('% ô không rõ', '不确定占比')],
    rows.map((row) => el('tr', {}, [
      SCAN_SCREEN_LABEL[row.screen] || String(row.screen),
      SCAN_SIDE_LABEL[row.side] || String(row.side),
      String(row.events),
      percent(row.edited, row.read),
      percent(row.unclear, row.read),
    ].map((cell) => el('td', {}, cell)))),
  );
}

/** Bảng so AI đọc (tên Hán) với đội xác nhận (ID), theo thứ tự ô. */
function scanCompareTable(sample) {
  const ai = Array.isArray(sample.aiRead?.heroes) ? sample.aiRead.heroes : [];
  const confirmed = Array.isArray(sample.confirmed?.heroes) ? sample.confirmed.heroes : [];
  return adminTable(
    [L('Tướng', '武将'), L('AI đọc', 'AI 识别'), L('Đội xác nhận', '队伍确认')],
    confirmed.map((entry, index) => {
      const read = ai[index];
      const readText = read
        ? [read.nameCn, ...(Array.isArray(read.tacticsCn) ? read.tacticsCn : []), ...(Array.isArray(read.booksCn) ? read.booksCn : [])].filter(Boolean).join(' · ')
        : '—';
      const confirmedText = [entry.hero, ...(Array.isArray(entry.tactics) ? entry.tactics : []), entry.book].filter(Boolean).join(' · ');
      return el('tr', {}, [
        el('td', {}, String(index + 1)),
        el('td', { lang: 'zh-Hans' }, readText),
        el('td', {}, confirmedText),
      ]);
    }),
  );
}

function scanSampleItem(sample, { status, onChange }) {
  const id = encodeURIComponent(sample.id);
  const imageUrl = `/api/admin/scan-samples/${id}/image`;
  const badge = el('span', { class: 'cm-badge', dataset: { status: sample.status } }, SCAN_STATUS_LABEL[sample.status] || String(sample.status));
  const actions = el('div', { class: 'adm-actions' });
  const setBusy = (busy) => actions.querySelectorAll('button').forEach((node) => { node.disabled = busy; });
  const act = async (action, message) => {
    setBusy(true);
    try {
      await api(`/api/admin/scan-samples/${id}/${action}`, { method: 'POST', json: {} });
      status.set(message);
      onChange(item);
    } catch (error) {
      setBusy(false);
      status.set(describeError(error), 'error');
    }
  };
  if (sample.status === 'pending') {
    const approve = button(L('Duyệt', '通过'), { variant: 'primary', iconName: 'check' });
    const reject = button(L('Từ chối', '拒绝'));
    approve.addEventListener('click', () => act('approve', L('Đã duyệt mẫu.', '样本已通过。')));
    reject.addEventListener('click', () => act('reject', L('Đã từ chối mẫu và xoá ảnh.', '样本已拒绝并删除图片。')));
    actions.append(approve, reject);
  } else if (sample.status === 'approved') {
    const download = button(L('Tải fixture', '下载 fixture'), { variant: 'primary' });
    download.addEventListener('click', async () => {
      download.disabled = true;
      try {
        const fixture = await api(`/api/admin/scan-samples/${id}/fixture`);
        const url = URL.createObjectURL(new Blob([`${JSON.stringify(fixture, null, 2)}\n`], { type: 'application/json' }));
        const link = el('a', { href: url, download: `${sample.id}.json` });
        document.body.append(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        status.set(L('Đã tải fixture.', '已下载 fixture。'));
      } catch (error) {
        status.set(describeError(error), 'error');
      } finally {
        download.disabled = false;
      }
    });
    actions.append(
      download,
      el('p', { class: 'adm-hint' }, L(
        'Nhớ tải ảnh, che tên tài khoản, đặt vào worker/eval/images/.',
        '记得下载图片，遮住账号名，放入 worker/eval/images/。',
      )),
    );
  }
  const item = el('li', { class: 'adm-card adm-report', dataset: { sampleId: String(sample.id) } }, [
    sample.hasImage
      ? imageTile(imageUrl, L('Ảnh soi đội người dùng gửi', '用户提交的识阵截图'))
      : el('div', { class: 'adm-report-image' }, [glyph('image', 28), el('span', {}, L('Ảnh đã bị xoá.', '图片已删除。'))]),
    el('div', { class: 'adm-report-main' }, [
      el('p', { class: 'adm-meta' }, [
        badge,
        avatar(sample.author),
        el('span', { class: 'adm-author' }, displayName(sample.author)),
        timeNode(sample.createdAt),
        el('span', { class: 'cm-badge' }, SCAN_SCREEN_LABEL[sample.screen] || String(sample.screen)),
        el('span', { class: 'cm-badge' }, SCAN_SIDE_LABEL[sample.side] || String(sample.side)),
      ]),
      scanCompareTable(sample),
      actions,
    ]),
  ]);
  return item;
}

function openScanPanel(panel, { head, counts }) {
  const status = adminStatus();

  // (a) Tỷ lệ theo screen × side.
  const daysSelect = selectInput('cm-scan-days', [
    ['7', L('7 ngày', '7 天')],
    ['30', L('30 ngày', '30 天')],
    ['90', L('90 ngày', '90 天')],
  ], '30');
  const statsBox = el('div', {});
  let statsGeneration = 0;
  const loadStats = async () => {
    const current = ++statsGeneration;
    const body = await api(`/api/admin/scan-stats?days=${encodeURIComponent(daysSelect.value)}`);
    if (current !== statsGeneration) return;
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    statsBox.replaceChildren(rows.length
      ? scanStatsTable(rows)
      : el('p', { class: 'adm-empty' }, L('Chưa có lượt đối chiếu nào trong khoảng này.', '该时间段内还没有对照记录。')));
  };
  daysSelect.addEventListener('change', () => loadStats().catch((error) => status.set(describeError(error), 'error')));

  // (b) Mẫu theo trạng thái; duyệt/từ chối xong thì mẫu rời danh sách trạng thái đang xem.
  const statusSelect = selectInput('cm-scan-status', Object.entries(SCAN_STATUS_LABEL), 'pending');
  const list = el('ol', { class: 'adm-list adm-list-roomy', 'aria-labelledby': 'adm-scan-samples-title' });
  const empty = emptyNote(L('Không có mẫu nào.', '没有样本。'));
  const paged = pagedList({
    list,
    empty,
    status,
    fallbackFocus: head.querySelector('.adm-section-title'),
    fetchPage: (cursor) => {
      const params = new URLSearchParams({ status: statusSelect.value });
      if (cursor) params.set('cursor', cursor);
      return api(`/api/admin/scan-samples?${params}`);
    },
    render: (sample) => scanSampleItem(sample, {
      status,
      onChange: (item) => {
        paged.remove(item);
        counts.refresh();
      },
    }),
  });
  statusSelect.addEventListener('change', () => paged.reload(panel));

  panel.append(
    status,
    el('div', { class: 'adm-block' }, [
      el('div', { class: 'adm-block-head' }, [
        el('h3', { class: 'adm-subtitle' }, L('Tỷ lệ sửa / không rõ (ẩn danh)', '修改 / 不确定占比（匿名）')),
        el('div', { class: 'adm-filters' }, formField('cm-scan-days', L('Khoảng thời gian', '时间范围'), daysSelect)),
      ]),
      statsBox,
    ]),
    el('div', { class: 'adm-block' }, [
      el('div', { class: 'adm-block-head' }, [
        el('h3', { id: 'adm-scan-samples-title', class: 'adm-subtitle' }, L('Ảnh người dùng gửi', '用户提交的截图')),
        el('div', { class: 'adm-filters' }, formField('cm-scan-status', L('Trạng thái', '状态'), statusSelect)),
      ]),
      list,
      empty,
      paged.more,
    ]),
  );
  loadStats().catch((error) => status.set(describeError(error), 'error'));
  paged.reload(panel);
}

/* ---------- Cấu hình AI ---------- */
// Một bản ghi `ai:config`, nút Lưu ghi cả hai phần cùng lúc:
// - Nhà cung cấp: endpoint + API key dùng chung; model = catalog của mẫu (server trả `presets`) + model tự thêm.
// - Tính năng: bốn nhóm, mỗi nhóm một chuỗi failover (nhà cung cấp, model, effort) kèm timeout mỗi lượt và
//   trần tổng thời gian. Mắt xích trên lỗi (sai key, hết tiền, quá tải, máy chủ lỗi) thì chuyển mắt xích kế.
// Server không bao giờ trả key — chỉ 4 ký tự cuối; ô key để trống khi sửa = giữ key cũ.

const AI_MAX_PROVIDERS = 10;
const AI_MAX_EXTRA_MODELS = 20;
const AI_MAX_CHAIN = 10;
/** Giới hạn (giây) khớp shared/ai-config.ts: timeout mỗi lượt 5–120, trần tổng timeout–180. */
const AI_MIN_TIMEOUT_S = 5;
const AI_MAX_TIMEOUT_S = 120;
const AI_MAX_BUDGET_S = 180;

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function effortLabel(level) {
  switch (level) {
    case 'off': return L('Tắt suy luận', '关闭思考');
    case 'none': return L('Không suy luận', '不推理');
    case 'low': return L('Thấp', '低');
    case 'medium': return L('Vừa', '中');
    case 'high': return L('Cao', '高');
    case 'max': return L('Tối đa', '最高');
    case 'default': return L('Mặc định của model', '模型默认');
    default: return level;
  }
}

function effortStyleLabel(style) {
  if (style === 'deepseek') return 'DeepSeek (thinking + reasoning_effort)';
  if (style === 'openai') return 'OpenAI (reasoning_effort)';
  return L('Không có tham số suy luận', '无推理参数');
}

function openAiPanel(panel, { actions }) {
  const status = adminStatus();
  const GROUPS = [
    { id: 'teamScan', label: L('Soi đội từ ảnh', '看图识阵') },
    { id: 'rosterRecommend', label: L('Gợi ý đội (quét tướng, chiến pháp, đội đã build)', '阵容推荐（扫描武将、战法、已配队伍）') },
    { id: 'explainSubstitute', label: L('Giải thích món bù', '替代战法说明') },
    { id: 'battleReport', label: L('Đọc ảnh chiến báo', '识别战报图片') },
  ];
  const warning = el('p', { class: 'cm-notice', hidden: '' }, L(
    'Chưa tính năng nào có mắt xích chạy được — mọi tính năng AI đang tạm dừng.',
    '没有任何功能有可用的链节——所有 AI 功能已暂停。',
  ));
  const providersTitle = el('h3', { id: 'cm-ai-providers-title', class: 'adm-subtitle' }, L('Nhà cung cấp', '服务商'));
  const list = el('ol', { class: 'adm-list', 'aria-labelledby': 'cm-ai-providers-title' });
  const editorSlot = el('div', { class: 'adm-editor-slot' });
  const groupsTitle = el('h3', { id: 'cm-ai-groups-title', class: 'adm-subtitle' }, L('Tính năng', '功能'));
  const groupsNode = el('div', { class: 'adm-groups' });
  // Chưa tải được cấu hình thì không cho Thêm/Lưu (tránh ghi đè cấu hình thật bằng cấu hình rỗng).
  const addButton = button(L('Thêm nhà cung cấp', '添加服务商'), { iconName: 'plus', disabled: '' });
  const saveButton = button(L('Lưu', '保存'), { variant: 'primary', disabled: '' });
  // Dữ liệu server (catalog mẫu, mức effort theo kiểu, nhóm cần ảnh) + bản đang sửa, giữ trong bộ nhớ tới lần Lưu.
  let presets = [];
  let effortLevels = {};
  let needsVision = {};
  // Mỗi nhà cung cấp: dữ liệu server (keyLast4) + `apiKey` vừa gõ.
  let items = [];
  let groups = {};
  // Nhà cung cấp đang mở khung sửa (thẻ được viền son).
  let editingId = null;

  const markDirty = (extra = '') => status.set(`${extra}${L('Có thay đổi chưa lưu — bấm Lưu để áp dụng.', '有未保存的更改——点击“保存”后生效。')}`, 'warn');
  const modelsOf = (item) => [...(presets.find((p) => p.id === item.preset)?.models ?? []), ...item.extraModels];
  const eligibleModels = (item, groupId) => modelsOf(item).filter((m) => !needsVision[groupId] || m.vision);
  /** Mắt xích trỏ tới model/effort còn hợp lệ cho nhóm (nhà cung cấp tắt vẫn hợp lệ, chỉ không chạy). */
  const linkModel = (link, groupId) => {
    const item = items.find((p) => p.id === link.providerId);
    const model = item && eligibleModels(item, groupId).find((m) => m.modelId === link.modelId);
    return model && model.efforts.includes(link.effort) ? { item, model } : null;
  };
  const groupRuns = (groupId) => groups[groupId].chain.some((link) => linkModel(link, groupId)?.item.enabled);

  /** Sau khi sửa/xoá nhà cung cấp: bỏ mắt xích không còn model, đưa effort không còn hợp lệ về mức đầu. Trả số mắt xích bị bỏ. */
  const pruneLinks = () => {
    let dropped = 0;
    for (const { id } of GROUPS) {
      groups[id].chain = groups[id].chain.filter((link) => {
        const item = items.find((p) => p.id === link.providerId);
        const model = item && eligibleModels(item, id).find((m) => m.modelId === link.modelId);
        if (!model) {
          dropped += 1;
          return false;
        }
        if (!model.efforts.includes(link.effort)) link.effort = model.efforts[0];
        return true;
      });
    }
    return dropped;
  };
  const droppedNote = (count) => (count ? L(`Đã bỏ ${count} mắt xích không còn model. `, `已移除 ${count} 个失去模型的链节。`) : '');

  const paintProviders = (focusSelector) => {
    const last = items.length - 1;
    list.replaceChildren(...items.map((item, index) => {
      const iconAction = (name, iconName, label) => el('button', {
        class: 'ana-btn adm-icon-btn', type: 'button', dataset: { action: name }, 'aria-label': label,
      }, glyph(iconName));
      const up = iconAction('up', 'up', L(`Đưa ${item.label} lên trên`, `上移 ${item.label}`));
      const down = iconAction('down', 'down', L(`Đưa ${item.label} xuống dưới`, `下移 ${item.label}`));
      up.disabled = index === 0;
      down.disabled = index === last;
      const toggle = button(item.enabled ? L('Tắt', '停用') : L('Bật', '启用'), { compact: true, dataset: { action: 'toggle' } });
      const edit = button(L('Sửa', '编辑'), { compact: true, dataset: { action: 'edit' } });
      const remove = button(L('Xoá', '删除'), { variant: 'adm-btn-danger', compact: true, dataset: { action: 'remove' } });
      const move = (to) => {
        [items[index], items[to]] = [items[to], items[index]];
        markDirty();
        paint(`[data-index="${to}"] [data-action="${to < index ? 'up' : 'down'}"]:not(:disabled), [data-index="${to}"] [data-action="edit"]`);
      };
      up.addEventListener('click', () => move(index - 1));
      down.addEventListener('click', () => move(index + 1));
      toggle.addEventListener('click', () => {
        item.enabled = !item.enabled;
        markDirty();
        paint(`[data-index="${index}"] [data-action="toggle"]`);
      });
      edit.addEventListener('click', () => openEditor(index));
      remove.addEventListener('click', () => {
        items.splice(index, 1);
        markDirty(droppedNote(pruneLinks()));
        paint(items.length ? `[data-index="${Math.min(index, items.length - 1)}"] [data-action="edit"]` : null);
        if (!items.length) addButton.focus();
      });
      const key = item.apiKey ? L('Key mới (chưa lưu)', '新密钥（未保存）') : `${L('Key', '密钥')} ••••${item.keyLast4 || ''}`;
      const presetLabel = presets.find((p) => p.id === item.preset)?.label ?? L('Tùy chỉnh', '自定义');
      const row = el('li', { class: 'adm-card adm-provider', dataset: { index: String(index), enabled: String(item.enabled) } }, [
        el('div', { class: 'adm-provider-info' }, [
          el('span', { class: 'adm-rank', 'aria-hidden': 'true' }, String(index + 1)),
          el('div', { class: 'adm-provider-body' }, [
            el('p', { class: 'adm-provider-name-row' }, [
              el('span', { class: 'adm-provider-name' }, [el('span', { class: 'visually-hidden' }, `${index + 1}. `), item.label]),
              el('span', { class: 'cm-badge', dataset: { status: item.enabled ? 'approved' : '' } }, item.enabled ? L('Đang bật', '已启用') : L('Đang tắt', '已停用')),
            ]),
            el('code', { class: 'adm-endpoint' }, item.endpoint),
            el('p', { class: 'adm-provider-facts' }, [
              el('span', {}, presetLabel),
              el('span', {}, L(`${modelsOf(item).length} model`, `${modelsOf(item).length} 个模型`)),
              el('span', {}, key),
            ]),
          ]),
        ]),
        el('div', { class: 'adm-row-actions' }, [up, down, toggle, edit, remove]),
      ]);
      if (item.id === editingId) row.dataset.editing = '';
      return row;
    }));
    addButton.disabled = items.length >= AI_MAX_PROVIDERS;
    if (focusSelector) list.querySelector(focusSelector)?.focus();
  };

  function linkRow(groupId, link, index) {
    const chain = groups[groupId].chain;
    const prefix = `cm-ai-${groupId}-${index}`;
    const focusOf = (field) => `[data-group="${groupId}"] [data-link="${index}"] [data-field="${field}"]`;
    const item = items.find((p) => p.id === link.providerId);
    const models = item ? eligibleModels(item, groupId) : [];
    const model = models.find((m) => m.modelId === link.modelId);
    // Chỉ liệt kê nhà cung cấp có model hợp nhóm (giữ mục đang chọn để không mất lựa chọn cũ).
    const providerSelect = selectInput(
      `${prefix}-provider`,
      items
        .filter((p) => p.id === link.providerId || eligibleModels(p, groupId).length)
        .map((p) => [p.id, p.enabled ? p.label : `${p.label} (${L('đang tắt', '已停用')})`]),
      link.providerId,
      { dataset: { field: 'provider' } },
    );
    const modelSelect = selectInput(`${prefix}-model`, models.map((m) => [m.modelId, m.modelId]), link.modelId, { dataset: { field: 'model' } });
    const effortSelect = selectInput(`${prefix}-effort`, (model?.efforts ?? []).map((e) => [e, effortLabel(e)]), link.effort, { dataset: { field: 'effort' } });
    providerSelect.addEventListener('change', () => {
      const first = eligibleModels(items.find((p) => p.id === providerSelect.value), groupId)[0];
      Object.assign(link, { providerId: providerSelect.value, modelId: first?.modelId ?? '', effort: first?.efforts[0] ?? '' });
      markDirty();
      paintGroups(focusOf('provider'));
    });
    modelSelect.addEventListener('change', () => {
      const next = models.find((m) => m.modelId === modelSelect.value);
      link.modelId = next.modelId;
      if (!next.efforts.includes(link.effort)) link.effort = next.efforts[0];
      markDirty();
      paintGroups(focusOf('model'));
    });
    effortSelect.addEventListener('change', () => {
      link.effort = effortSelect.value;
      markDirty();
    });
    const iconAction = (name, iconName, label) =>
      el('button', { class: 'ana-btn adm-icon-btn', type: 'button', dataset: { action: name }, 'aria-label': label }, glyph(iconName));
    const up = iconAction('up', 'up', L(`Đưa mắt xích ${index + 1} lên trên`, `上移第 ${index + 1} 环`));
    const down = iconAction('down', 'down', L(`Đưa mắt xích ${index + 1} xuống dưới`, `下移第 ${index + 1} 环`));
    const remove = button(L('Bỏ', '移除'), {
      variant: 'adm-btn-danger', compact: true, dataset: { action: 'remove' }, 'aria-label': L(`Bỏ mắt xích ${index + 1}`, `移除第 ${index + 1} 环`),
    });
    up.disabled = index === 0;
    down.disabled = index === chain.length - 1;
    const move = (to) => {
      [chain[index], chain[to]] = [chain[to], chain[index]];
      markDirty();
      const row = `[data-group="${groupId}"] [data-link="${to}"]`;
      paintGroups();
      (groupsNode.querySelector(`${row} [data-action="${to < index ? 'up' : 'down'}"]:not(:disabled)`)
        ?? groupsNode.querySelector(`${row} [data-field="provider"]`))?.focus();
    };
    up.addEventListener('click', () => move(index - 1));
    down.addEventListener('click', () => move(index + 1));
    remove.addEventListener('click', () => {
      chain.splice(index, 1);
      markDirty();
      paintGroups(chain.length ? `[data-group="${groupId}"] [data-link="${Math.min(index, chain.length - 1)}"] [data-field="provider"]` : `[data-group="${groupId}"] [data-action="add-link"]`);
    });
    return el('li', { class: 'adm-chain-row', dataset: { link: String(index) } }, [
      el('span', { class: 'adm-chain-index', 'aria-hidden': 'true' }, String(index + 1)),
      formField(`${prefix}-provider`, L('Nhà cung cấp', '服务商'), providerSelect),
      formField(`${prefix}-model`, L('Model', '模型'), modelSelect),
      formField(`${prefix}-effort`, L('Effort', '推理强度'), effortSelect),
      el('div', { class: 'adm-row-actions' }, [up, down, remove]),
    ]);
  }

  function groupSection({ id, label }) {
    const group = groups[id];
    const titleId = `cm-ai-group-${id}-title`;
    const runs = groupRuns(id);
    const seconds = (ms) => String(Math.round(ms / 1000));
    const timeout = textInput(`cm-ai-${id}-timeout`, seconds(group.timeoutMs), {
      type: 'number', inputmode: 'numeric', min: String(AI_MIN_TIMEOUT_S), max: String(AI_MAX_TIMEOUT_S), step: '1', dataset: { field: 'timeout' },
    });
    const budget = textInput(`cm-ai-${id}-budget`, seconds(group.budgetMs), {
      type: 'number', inputmode: 'numeric', min: String(AI_MIN_TIMEOUT_S), max: String(AI_MAX_BUDGET_S), step: '1', dataset: { field: 'budget' },
    });
    timeout.addEventListener('input', () => {
      group.timeoutMs = Number(timeout.value) * 1000;
      timeout.removeAttribute('aria-invalid');
      markDirty();
    });
    budget.addEventListener('input', () => {
      group.budgetMs = Number(budget.value) * 1000;
      budget.removeAttribute('aria-invalid');
      markDirty();
    });
    const firstChoice = () => {
      // Ưu tiên nhà cung cấp đang bật có model hợp nhóm.
      const ordered = [...items.filter((p) => p.enabled), ...items.filter((p) => !p.enabled)];
      for (const item of ordered) {
        const model = eligibleModels(item, id)[0];
        if (model) return { providerId: item.id, modelId: model.modelId, effort: model.efforts[0] };
      }
      return null;
    };
    const add = button(L('Thêm mắt xích', '添加链节'), { iconName: 'plus', compact: true, dataset: { action: 'add-link' } });
    add.disabled = group.chain.length >= AI_MAX_CHAIN || !firstChoice();
    add.addEventListener('click', () => {
      group.chain.push(firstChoice());
      markDirty();
      paintGroups(`[data-group="${id}"] [data-link="${group.chain.length - 1}"] [data-field="provider"]`);
    });
    const copy = button(L('Áp cho mọi nhóm', '应用到所有功能'), { variant: 'adm-btn-ghost', compact: true, dataset: { action: 'copy' } });
    copy.addEventListener('click', () => {
      let dropped = 0;
      for (const other of GROUPS) {
        if (other.id === id) continue;
        const chain = group.chain.filter((link) => linkModel(link, other.id)).map((link) => ({ ...link }));
        dropped += group.chain.length - chain.length;
        groups[other.id] = { chain, timeoutMs: group.timeoutMs, budgetMs: group.budgetMs };
      }
      const skipped = dropped ? L(`Bỏ ${dropped} mắt xích không hợp lệ ở nhóm đích (vd model không nhận ảnh). `, `跳过 ${dropped} 个在目标功能中无效的链节（如模型不支持图片）。`) : '';
      markDirty(`${L('Đã áp chuỗi này cho mọi nhóm. ', '已将此链应用到所有功能。')}${skipped}`);
      paintGroups(`[data-group="${id}"] [data-action="copy"]`);
    });
    return el('section', { class: 'adm-card adm-group', dataset: { group: id }, 'aria-labelledby': titleId }, [
      el('div', { class: 'adm-group-head' }, [
        el('h4', { id: titleId, class: 'adm-group-title' }, label),
        el('span', { class: 'cm-badge', dataset: { status: runs ? 'approved' : 'rejected' } }, runs ? L('Chạy được', '可运行') : L('Chưa cấu hình — tính năng báo lỗi', '未配置——功能将报错')),
        needsVision[id] ? el('span', { class: 'adm-hint' }, L('Chỉ model nhận ảnh', '仅支持图片的模型')) : null,
      ]),
      group.chain.length
        ? el('ol', { class: 'adm-chain', 'aria-label': L(`Chuỗi của ${label}`, `${label} 的调用链`) }, group.chain.map((link, index) => linkRow(id, link, index)))
        : null,
      el('div', { class: 'adm-group-foot' }, [
        el('div', { class: 'adm-timing' }, [
          formField(`cm-ai-${id}-timeout`, L('Timeout mỗi lượt (giây)', '单次超时（秒）'), timeout),
          formField(`cm-ai-${id}-budget`, L('Trần tổng (giây)', '总时限（秒）'), budget),
        ]),
        el('div', { class: 'adm-actions' }, [add, copy]),
      ]),
    ]);
  }

  const paintGroups = (focusSelector) => {
    groupsNode.replaceChildren(...GROUPS.map(groupSection));
    warning.hidden = GROUPS.some(({ id }) => groupRuns(id));
    if (focusSelector) groupsNode.querySelector(focusSelector)?.focus();
  };

  const paint = (focusSelector) => {
    paintProviders(focusSelector);
    paintGroups();
  };

  const load = (body) => {
    presets = Array.isArray(body?.presets) ? body.presets : [];
    effortLevels = body?.effortLevels ?? {};
    needsVision = body?.groupNeedsVision ?? {};
    items = (Array.isArray(body?.providers) ? body.providers : []).map((p) => ({
      id: String(p.id),
      label: String(p.label ?? ''),
      preset: String(p.preset ?? ''),
      endpoint: String(p.endpoint ?? ''),
      enabled: p.enabled === true,
      extraModels: Array.isArray(p.extraModels) ? p.extraModels.map((m) => ({ ...m, efforts: [...m.efforts] })) : [],
      keyLast4: typeof p.keyLast4 === 'string' ? p.keyLast4 : '',
      apiKey: '',
    }));
    groups = Object.fromEntries(GROUPS.map(({ id }) => {
      const g = body?.groups?.[id];
      return [id, {
        chain: Array.isArray(g?.chain) ? g.chain.map((link) => ({ ...link })) : [],
        timeoutMs: g?.timeoutMs ?? 45_000,
        budgetMs: g?.budgetMs ?? 45_000,
      }];
    }));
    saveButton.disabled = false;
    paint();
  };

  function extraModelRow(extras, model, index, repaint) {
    const prefix = `cm-ai-extra-${index}`;
    const modelId = textInput(`${prefix}-id`, model.modelId, { mono: true, maxlength: '120', spellcheck: 'false' });
    modelId.addEventListener('input', () => {
      model.modelId = modelId.value.trim();
    });
    const vision = el('input', { id: `${prefix}-vision`, type: 'checkbox' });
    vision.checked = model.vision;
    vision.addEventListener('change', () => {
      model.vision = vision.checked;
    });
    const style = selectInput(`${prefix}-style`, Object.keys(effortLevels).map((s) => [s, effortStyleLabel(s)]), model.effortStyle);
    style.addEventListener('change', () => {
      model.effortStyle = style.value;
      model.efforts = [...effortLevels[style.value]];
      repaint(`#${prefix}-style`);
    });
    const efforts = (effortLevels[model.effortStyle] ?? []).map((level) => {
      const box = el('input', { id: `${prefix}-effort-${level}`, type: 'checkbox' });
      box.checked = model.efforts.includes(level);
      box.addEventListener('change', () => {
        model.efforts = effortLevels[model.effortStyle].filter((l) => (l === level ? box.checked : model.efforts.includes(l)));
      });
      return el('label', { class: 'adm-check', for: box.id }, [box, effortLabel(level)]);
    });
    const remove = button(L('Bỏ', '移除'), { variant: 'adm-btn-danger', compact: true, 'aria-label': L(`Bỏ model ${index + 1}`, `移除模型 ${index + 1}`) });
    remove.addEventListener('click', () => {
      extras.splice(index, 1);
      repaint(extras.length ? `#cm-ai-extra-${Math.min(index, extras.length - 1)}-id` : '#cm-ai-extra-add');
    });
    return el('li', { class: 'adm-model-row' }, [
      formField(`${prefix}-id`, L('Model id', '模型 ID'), modelId),
      formField(`${prefix}-style`, L('Kiểu tham số suy luận', '推理参数类型'), style),
      el('fieldset', { class: 'adm-efforts' }, [el('legend', { class: 'adm-label' }, L('Mức effort nhận được', '支持的推理强度')), ...efforts]),
      el('label', { class: 'adm-check', for: vision.id }, [vision, L('Nhận ảnh', '支持图片')]),
      el('div', { class: 'adm-row-actions' }, [remove]),
    ]);
  }

  function openEditor(index) {
    const current = index == null ? null : items[index];
    const initialPreset = current ? presets.find((p) => p.id === current.preset) : presets[0];
    const presetSelect = selectInput(
      'cm-ai-preset',
      [...presets.map((p) => [p.id, p.label]), ['', L('Tùy chỉnh', '自定义')]],
      initialPreset ? initialPreset.id : '',
    );
    const label = textInput('cm-ai-label', current ? current.label : initialPreset?.label, { maxlength: '80', required: '' });
    const endpoint = textInput('cm-ai-endpoint', current ? current.endpoint : initialPreset?.endpoint, {
      mono: true, type: 'url', inputmode: 'url', maxlength: '500', required: '', spellcheck: 'false',
    });
    const apiKey = textInput('cm-ai-key', '', {
      type: 'password', autocomplete: 'new-password', maxlength: '500', spellcheck: 'false',
      placeholder: current ? L(`Để trống để giữ key cũ (••••${current.keyLast4 || ''})`, `留空则保留原密钥（••••${current.keyLast4 || ''}）`) : '',
    });
    const enabled = el('input', { id: 'cm-ai-enabled', type: 'checkbox' });
    enabled.checked = current ? current.enabled : true;
    const catalogTitle = el('h4', { id: 'cm-ai-catalog-title', class: 'adm-label' }, L('Model sẵn có', '内置模型'));
    const catalog = el('ul', { class: 'adm-catalog', 'aria-labelledby': 'cm-ai-catalog-title' });
    const paintPreset = () => {
      const preset = presets.find((p) => p.id === presetSelect.value);
      endpoint.readOnly = Boolean(preset);
      catalogTitle.hidden = !preset;
      catalog.replaceChildren(...(preset?.models ?? []).map((m) => el('li', {}, [
        el('code', {}, m.modelId),
        ` · ${m.vision ? L('nhận ảnh', '支持图片') : L('chỉ văn bản', '仅文本')} · ${m.efforts.map(effortLabel).join(', ')}`,
      ])));
    };
    presetSelect.addEventListener('change', () => {
      const preset = presets.find((p) => p.id === presetSelect.value);
      if (preset) {
        endpoint.value = preset.endpoint;
        // Chỉ thay nhãn khi đang để trống hoặc còn là nhãn của mẫu khác.
        if (!label.value.trim() || presets.some((p) => p.label === label.value.trim())) label.value = preset.label;
      }
      paintPreset();
    });
    paintPreset();

    const extras = current ? current.extraModels.map((m) => ({ ...m, efforts: [...m.efforts] })) : [];
    const extrasList = el('ul', { class: 'adm-chain', 'aria-labelledby': 'cm-ai-extra-title' });
    const addExtra = button(L('Thêm model', '添加模型'), { iconName: 'plus', compact: true, id: 'cm-ai-extra-add' });
    const paintExtras = (focusSelector) => {
      extrasList.replaceChildren(...extras.map((model, i) => extraModelRow(extras, model, i, paintExtras)));
      addExtra.disabled = extras.length >= AI_MAX_EXTRA_MODELS;
      if (focusSelector) form.querySelector(focusSelector)?.focus();
    };
    addExtra.addEventListener('click', () => {
      const style = Object.keys(effortLevels)[0];
      extras.push({ modelId: '', vision: false, effortStyle: style, efforts: [...effortLevels[style]] });
      paintExtras(`#cm-ai-extra-${extras.length - 1}-id`);
    });

    const keyHint = current
      ? L(`Đang lưu key ••••${current.keyLast4 || ''}. Để trống = giữ key cũ (đổi endpoint thì phải nhập lại).`, `已保存密钥 ••••${current.keyLast4 || ''}。留空则保留原密钥（更换 endpoint 时须重新填写）。`)
      : L('Bắt buộc với nhà cung cấp mới.', '新服务商必须填写。');
    const done = button(L('Xong', '完成'), { variant: 'primary', type: 'submit' });
    const cancel = button(L('Huỷ', '取消'));
    const form = el('form', { class: 'adm-card adm-editor', novalidate: '' }, [
      el('h4', { class: 'adm-editor-title' }, current ? L('Sửa nhà cung cấp', '编辑服务商') : L('Nhà cung cấp mới', '新服务商')),
      el('div', { class: 'adm-grid-2' }, [
        formField('cm-ai-preset', L('Endpoint mẫu', '接口模板'), presetSelect),
        formField('cm-ai-label', L('Nhãn', '名称'), label),
      ]),
      formField('cm-ai-endpoint', L('Endpoint', 'Endpoint'), endpoint),
      formField('cm-ai-key', L('API key', 'API 密钥'), apiKey, keyHint),
      el('label', { class: 'adm-check', for: 'cm-ai-enabled' }, [enabled, L('Bật nhà cung cấp này', '启用此服务商')]),
      catalogTitle,
      catalog,
      el('h4', { id: 'cm-ai-extra-title', class: 'adm-label' }, L('Model tự thêm', '自定义模型')),
      el('p', { class: 'adm-hint' }, L(
        'Model id theo tài liệu nhà cung cấp (API Chat Completions OpenAI-compatible). Đánh dấu Nhận ảnh chỉ khi model đọc được ảnh.',
        '按服务商文档填写模型 ID（兼容 OpenAI Chat Completions 接口）。仅在模型能识别图片时勾选“支持图片”。',
      )),
      extrasList,
      el('div', { class: 'adm-actions' }, [addExtra]),
      el('div', { class: 'adm-actions' }, [done, cancel]),
    ]);
    paintExtras();
    const close = (focusSelector) => {
      editorSlot.replaceChildren();
      editingId = null;
      paintProviders();
      if (focusSelector) list.querySelector(focusSelector)?.focus();
      else addButton.focus();
    };
    cancel.addEventListener('click', () => close(index == null ? null : `[data-index="${index}"] [data-action="edit"]`));
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const preset = presets.find((p) => p.id === presetSelect.value);
      const data = { label: label.value.trim(), endpoint: endpoint.value.trim(), apiKey: apiKey.value.trim() };
      for (const node of form.querySelectorAll('[aria-invalid]')) node.removeAttribute('aria-invalid');
      const seen = new Set((preset?.models ?? []).map((m) => m.modelId));
      const badExtra = extras.findIndex((m) => !m.modelId || seen.has(m.modelId) || !m.efforts.length || !seen.add(m.modelId));
      const extraProblem = badExtra < 0 ? null
        : !extras[badExtra].modelId ? [form.querySelector(`#cm-ai-extra-${badExtra}-id`), L('Hãy nhập model id.', '请填写模型 ID。')]
          : !extras[badExtra].efforts.length ? [form.querySelector(`#cm-ai-extra-${badExtra}-style`), L('Model cần ít nhất một mức effort.', '模型至少需要一个推理强度。')]
            : [form.querySelector(`#cm-ai-extra-${badExtra}-id`), L('Model id bị trùng.', '模型 ID 重复。')];
      const [invalid, message] = !data.label ? [label, L('Hãy nhập nhãn.', '请填写名称。')]
        : !isHttpsUrl(data.endpoint) ? [endpoint, L('Endpoint phải là URL https hợp lệ.', 'Endpoint 必须是有效的 https URL。')]
          : !current && !data.apiKey ? [apiKey, L('Nhà cung cấp mới cần API key.', '新服务商需要 API 密钥。')]
            : current && data.endpoint !== current.endpoint && !data.apiKey && !current.apiKey
              ? [apiKey, L('Đổi endpoint thì phải nhập lại API key.', '更换 endpoint 时须重新填写 API 密钥。')]
              : extraProblem ?? [null, ''];
      if (invalid) {
        invalid.setAttribute('aria-invalid', 'true');
        status.set(message, 'error');
        invalid.focus();
        return;
      }
      const entry = {
        id: current ? current.id : crypto.randomUUID(),
        label: data.label,
        preset: preset ? preset.id : '',
        endpoint: data.endpoint,
        enabled: enabled.checked,
        extraModels: extras,
        keyLast4: current ? current.keyLast4 : '',
        // Để trống khi sửa = giữ key cũ (hoặc key mới gõ trước đó mà chưa lưu).
        apiKey: data.apiKey || (current ? current.apiKey : ''),
      };
      // Tìm theo id (danh sách có thể đã đổi thứ tự hoặc bị xoá mục trong lúc khung sửa đang mở).
      const position = current ? items.findIndex((p) => p.id === current.id) : items.length;
      if (position < 0) {
        close(null);
        status.set(L('Nhà cung cấp này đã bị xoá khi đang sửa — thay đổi không được áp dụng.', '该服务商在编辑时已被删除——更改未应用。'), 'error');
        return;
      }
      items[position] = entry;
      markDirty(droppedNote(pruneLinks()));
      paint();
      close(`[data-index="${position}"] [data-action="edit"]`);
    });
    editorSlot.replaceChildren(form);
    editingId = current ? current.id : null;
    paintProviders();
    label.focus();
  }

  /** Kiểm trước khi gửi (server kiểm lại): khoảng thời gian và mắt xích hợp lệ. Trả [ô lỗi, thông điệp] hoặc null. */
  const groupProblem = () => {
    for (const { id, label } of GROUPS) {
      const { chain, timeoutMs, budgetMs } = groups[id];
      const timeoutS = timeoutMs / 1000;
      const budgetS = budgetMs / 1000;
      if (!Number.isInteger(timeoutS) || timeoutS < AI_MIN_TIMEOUT_S || timeoutS > AI_MAX_TIMEOUT_S) {
        return [`#cm-ai-${id}-timeout`, L(`${label}: timeout mỗi lượt phải là số giây nguyên từ ${AI_MIN_TIMEOUT_S} đến ${AI_MAX_TIMEOUT_S}.`, `${label}：单次超时须为 ${AI_MIN_TIMEOUT_S}–${AI_MAX_TIMEOUT_S} 的整数秒。`)];
      }
      if (!Number.isInteger(budgetS) || budgetS < timeoutS || budgetS > AI_MAX_BUDGET_S) {
        return [`#cm-ai-${id}-budget`, L(`${label}: trần tổng phải là số giây nguyên, không nhỏ hơn timeout mỗi lượt và không quá ${AI_MAX_BUDGET_S}.`, `${label}：总时限须为整数秒，不小于单次超时且不超过 ${AI_MAX_BUDGET_S}。`)];
      }
      const bad = chain.findIndex((link) => !linkModel(link, id));
      if (bad >= 0) {
        return [`#cm-ai-${id}-${bad}-model`, L(`${label}: mắt xích ${bad + 1} chưa chọn model hợp lệ.`, `${label}：第 ${bad + 1} 环未选择有效模型。`)];
      }
    }
    return null;
  };

  addButton.addEventListener('click', () => openEditor(null));
  saveButton.addEventListener('click', async () => {
    // Khung sửa nhà cung cấp còn mở: bấm Lưu sẽ bỏ mất thay đổi chưa bấm Xong.
    if (editorSlot.firstChild) {
      status.set(L('Hãy bấm Xong hoặc Huỷ ở khung sửa nhà cung cấp trước khi Lưu.', '请先在服务商编辑框中点击“完成”或“取消”，再保存。'), 'error');
      editorSlot.querySelector('button[type="submit"]')?.focus();
      return;
    }
    for (const node of groupsNode.querySelectorAll('[aria-invalid]')) node.removeAttribute('aria-invalid');
    const problem = groupProblem();
    if (problem) {
      const node = groupsNode.querySelector(problem[0]);
      node?.setAttribute('aria-invalid', 'true');
      status.set(problem[1], 'error');
      node?.focus();
      return;
    }
    saveButton.disabled = true;
    status.set(L('Đang lưu…', '正在保存…'));
    try {
      const body = await api('/api/admin/ai/config', {
        method: 'PUT',
        json: {
          providers: items.map(({ id, label, preset, endpoint, enabled, apiKey, extraModels }) => ({ id, label, preset, endpoint, enabled, apiKey, extraModels })),
          groups,
        },
      });
      editorSlot.replaceChildren();
      editingId = null;
      load(body);
      status.set(L('Đã lưu. Có hiệu lực trong khoảng 1 phút.', '已保存，约 1 分钟内生效。'));
    } catch (error) {
      status.set(describeError(error), 'error');
    } finally {
      saveButton.disabled = false;
    }
  });

  actions.append(addButton, saveButton);
  panel.append(
    status,
    warning,
    el('div', { class: 'adm-block' }, [providersTitle, list, editorSlot]),
    el('div', { class: 'adm-block' }, [groupsTitle, groupsNode]),
  );
  panel.setAttribute('aria-busy', 'true');
  api('/api/admin/ai/config')
    .then(load)
    .catch((error) => status.set(describeError(error), 'error'))
    .finally(() => panel.removeAttribute('aria-busy'));
}

/* ---------- Bài viết ---------- */

function statusLabel(post) {
  return post?.status === 'published' ? L('Đã xuất bản', '已发布') : L('Bản nháp', '草稿');
}

/** Câu mô tả kết quả gọi deploy hook sau khi xuất bản / gỡ xuất bản. */
function deployMessage(body, published) {
  const deploy = body?.deploy;
  const done = published
    ? L('Đã xuất bản bài viết.', '文章已发布。')
    : L('Đã gỡ xuất bản bài viết.', '文章已取消发布。');
  if (!deploy || typeof deploy !== 'object') return { text: done, kind: '' };
  if (deploy.ok) {
    return { text: `${done} ${L('Đã yêu cầu build lại site; thay đổi sẽ lên sau vài phút.', '已触发站点重新构建，几分钟后生效。')}`, kind: '' };
  }
  const code = Number.isFinite(deploy.status) ? ` (HTTP ${deploy.status})` : '';
  return {
    text: `${done} ${L('Nhưng gọi deploy hook thất bại', '但调用部署钩子失败')}${code}. ${L('Hãy thử lại để build lại site.', '请重试以重新构建站点。')}`,
    kind: 'error',
  };
}

function emptyPost() {
  return {
    id: null,
    lang: currentLocale(),
    translationKey: '',
    slug: '',
    title: '',
    description: '',
    tags: [],
    coverImage: null,
    bodyMarkdown: '',
    faq: [],
    status: 'draft',
  };
}

function postLangLabel(post) {
  return el('span', { lang: post.lang === 'zh' ? 'zh-Hans' : 'vi' }, langLabel(post.lang));
}

function postStatusBadge(post) {
  return el('span', { class: 'cm-badge', dataset: { status: post.status === 'published' ? 'approved' : '' } }, statusLabel(post));
}

function openPostsPanel(panel, { head, actions, counts }) {
  const status = adminStatus();
  const view = el('div', { class: 'adm-posts-view' });
  const createButton = button(L('Viết bài mới', '写新文章'), { variant: 'primary', iconName: 'plus' });
  createButton.addEventListener('click', () => showEditor(emptyPost()));
  actions.append(createButton);
  panel.append(view);

  async function showList(focusTarget) {
    head.hidden = false;
    const table = el('div', { class: 'adm-posts' });
    view.replaceChildren(
      status,
      table,
      el('p', { class: 'adm-hint' }, L(
        'Xuất bản, gỡ xuất bản hoặc sửa bài đã xuất bản sẽ yêu cầu build lại site; thay đổi lên sau vài phút.',
        '发布、取消发布或修改已发布文章会触发站点重新构建，几分钟后生效。',
      )),
    );
    view.setAttribute('aria-busy', 'true');
    try {
      const body = await api('/api/admin/posts');
      const posts = Array.isArray(body?.items) ? body.items : [];
      if (!posts.length) {
        table.replaceChildren(el('p', { class: 'adm-empty' }, L('Chưa có bài viết nào.', '还没有文章。')));
      } else {
        table.replaceChildren(el('div', { class: 'adm-table-wrap adm-table-scroll adm-posts-table' }, el('table', { class: 'adm-table' }, [
          el('thead', {}, el('tr', {}, [
            el('th', { scope: 'col' }, L('Tiêu đề', '标题')),
            el('th', { scope: 'col' }, L('Trạng thái', '状态')),
            el('th', { scope: 'col' }, L('Ngôn ngữ', '语言')),
            el('th', { scope: 'col' }, 'Slug'),
            el('th', { scope: 'col' }, L('Cập nhật', '更新')),
            el('th', { scope: 'col' }, el('span', { class: 'visually-hidden' }, L('Thao tác', '操作'))),
          ])),
          el('tbody', {}, posts.map((post) => {
            const open = el('button', { class: 'adm-table-title', type: 'button' }, String(post.title || post.slug || ''));
            const edit = button(L('Sửa', '编辑'), { compact: true, 'aria-label': L(`Sửa bài ${post.title || post.slug || ''}`, `编辑 ${post.title || post.slug || ''}`) });
            open.addEventListener('click', () => showEditor(post));
            edit.addEventListener('click', () => showEditor(post));
            return el('tr', {}, [
              el('td', { class: 'adm-cell-title', lang: post.lang === 'zh' ? 'zh-Hans' : 'vi' }, open),
              el('td', { class: 'adm-cell-status' }, postStatusBadge(post)),
              el('td', { class: 'adm-cell-lang' }, postLangLabel(post)),
              el('td', { class: 'adm-cell-slug' }, el('code', {}, String(post.slug || ''))),
              el('td', { class: 'adm-cell-time' }, timeNode(post.updatedAt)),
              el('td', { class: 'adm-cell-action' }, edit),
            ]);
          })),
        ])));
      }
    } catch (error) {
      table.replaceChildren(el('p', { class: 'cm-notice' }, describeError(error)));
    } finally {
      view.removeAttribute('aria-busy');
    }
    (focusTarget ? panel.querySelector(focusTarget) : null)?.focus();
  }

  function showEditor(initial) {
    let post = { ...emptyPost(), ...initial };
    head.hidden = true;
    status.set('');
    const langSelect = selectInput('cm-post-lang', [['vi', 'Tiếng Việt'], ['zh', '中文']], post.lang === 'zh' ? 'zh' : 'vi');
    const translationKey = textInput('cm-post-translation', post.translationKey, { mono: true, maxlength: '100', spellcheck: 'false' });
    const slug = textInput('cm-post-slug', post.slug, { mono: true, maxlength: '101', required: '', pattern: SLUG_PATTERN.source, spellcheck: 'false' });
    const title = textInput('cm-post-title', post.title, { maxlength: '200', required: '' });
    const description = textInput('cm-post-description', post.description, { maxlength: '300' });
    const tags = textInput('cm-post-tags', (post.tags || []).join(', '));

    // Ảnh bìa: tải lên riêng, form chỉ giữ URL `/api/media/...` trả về.
    let coverImage = post.coverImage || null;
    const coverFile = el('input', { id: 'cm-post-cover', class: 'visually-hidden', type: 'file', accept: 'image/jpeg,image/png,image/webp' });
    const coverMedia = el('div', { class: 'adm-cover-media' });
    const coverName = el('span', { class: 'adm-cover-name' });
    const coverPick = el('label', { class: 'ana-btn adm-btn-compact adm-file-btn', for: 'cm-post-cover' });
    const coverRemove = button(L('Bỏ ảnh bìa', '移除封面'), { variant: 'adm-btn-ghost', compact: true });
    const paintCover = () => {
      coverMedia.replaceChildren(coverImage ? el('img', { src: coverImage, alt: L('Ảnh bìa', '封面图') }) : glyph('image', 28));
      coverName.replaceChildren(coverImage ? el('code', {}, coverImage) : L('Chưa có ảnh bìa · JPG, PNG hoặc WebP', '尚未设置封面 · JPG、PNG 或 WebP'));
      coverPick.textContent = coverImage ? L('Đổi ảnh', '更换图片') : L('Tải ảnh lên', '上传图片');
      coverRemove.hidden = !coverImage;
    };
    paintCover();
    coverRemove.addEventListener('click', () => {
      coverImage = null;
      paintCover();
      coverFile.focus();
    });
    coverFile.addEventListener('change', async () => {
      const file = coverFile.files?.[0];
      if (!file) return;
      status.set(L('Đang tải ảnh lên…', '正在上传图片…'));
      try {
        const blob = await downscaleImage(file);
        const form = new FormData();
        form.append('image', blob, 'cover.jpg');
        const body = await api('/api/admin/uploads', { method: 'POST', form });
        if (typeof body?.url !== 'string' || !body.url.startsWith('/')) throw new Error('missing url');
        coverImage = body.url;
        paintCover();
        status.set(L('Đã tải ảnh bìa lên.', '封面已上传。'));
      } catch (error) {
        status.set(describeError(error), 'error');
      } finally {
        coverFile.value = '';
      }
    });

    const bodyInput = el('textarea', { id: 'cm-post-body', class: 'cm-textarea adm-md-input', rows: '16', spellcheck: 'true' });
    bodyInput.value = post.bodyMarkdown || '';
    const preview = el('div', { class: 'adm-md-preview', role: 'region', 'aria-labelledby': 'cm-post-preview-label', 'aria-live': 'off' });
    const paintPreview = () => preview.replaceChildren(renderMarkdown(bodyInput.value));
    paintPreview();
    let previewTimer = 0;
    bodyInput.addEventListener('input', () => {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(paintPreview, 150);
    });
    // Màn hẹp: một cột, công tắc Soạn / Xem trước (CSS chỉ hiện công tắc ≤680px).
    const markdown = el('div', { class: 'adm-md', dataset: { mode: 'edit' } });
    const modeButton = (mode, text) => {
      const node = el('button', { class: 'adm-md-mode', type: 'button', 'aria-pressed': String(mode === 'edit') }, text);
      node.addEventListener('click', () => {
        markdown.dataset.mode = mode;
        for (const other of node.parentElement.children) other.setAttribute('aria-pressed', String(other === node));
        if (mode === 'preview') paintPreview();
      });
      return node;
    };
    markdown.append(
      el('div', { class: 'adm-md-switch', role: 'group', 'aria-label': L('Chế độ soạn bài', '编辑模式') }, [
        modeButton('edit', L('Soạn', '编辑')),
        modeButton('preview', L('Xem trước', '预览')),
      ]),
      el('div', { class: 'adm-md-pane adm-md-edit' }, [
        el('label', { class: 'adm-label', for: 'cm-post-body' }, L('Nội dung (Markdown)', '正文（Markdown）')),
        bodyInput,
      ]),
      el('div', { class: 'adm-md-pane adm-md-view' }, [
        el('p', { class: 'adm-label', id: 'cm-post-preview-label' }, L('Xem trước', '预览')),
        preview,
      ]),
    );

    // FAQ: danh sách cặp hỏi/đáp thêm/xoá được.
    const faqList = el('ol', { class: 'adm-faq-list' });
    let faqSeq = 0;
    const addFaq = (entry = { q: '', a: '' }, focus = false) => {
      faqSeq += 1;
      const qId = `cm-faq-q-${faqSeq}`;
      const aId = `cm-faq-a-${faqSeq}`;
      const q = textInput(qId, entry.q, { maxlength: '300' });
      q.dataset.faq = 'q';
      const a = el('textarea', { id: aId, class: 'cm-textarea', rows: '2', maxlength: '2000' });
      a.dataset.faq = 'a';
      a.value = entry.a || '';
      const remove = button(L('Xoá câu hỏi', '删除问题'), { variant: 'adm-btn-danger', compact: true });
      const row = el('li', { class: 'adm-faq-row' }, [
        formField(qId, L('Câu hỏi', '问题'), q),
        formField(aId, L('Trả lời', '回答'), a),
        remove,
      ]);
      remove.addEventListener('click', () => {
        const next = row.nextElementSibling || row.previousElementSibling;
        row.remove();
        (next?.querySelector('input') || addFaqButton).focus();
      });
      faqList.append(row);
      if (focus) q.focus();
    };
    const addFaqButton = button(L('Thêm câu hỏi', '添加问题'), { iconName: 'plus', compact: true });
    addFaqButton.addEventListener('click', () => addFaq(undefined, true));
    for (const entry of Array.isArray(post.faq) ? post.faq : []) addFaq(entry);

    const heading = el('h2', { class: 'adm-section-title', tabindex: '-1' }, post.id ? L('Sửa bài viết', '编辑文章') : L('Bài viết mới', '新文章'));
    const state = el('p', { class: 'adm-editor-state' });
    const paintState = () => {
      state.replaceChildren(
        postStatusBadge(post),
        post.updatedAt ? el('span', {}, [L('Lưu lần cuối ', '最后保存于 '), timeNode(post.updatedAt)]) : el('span', {}, L('Chưa lưu', '尚未保存')),
      );
    };
    const back = button(L('Về danh sách', '返回列表'), { variant: 'adm-btn-ghost', iconName: 'back' });
    const save = button(L('Lưu nháp', '保存草稿'), { type: 'submit' });
    const publishToggle = button('');
    const remove = button(L('Xoá bài', '删除文章'), { variant: 'adm-btn-danger' });
    const paintButtons = () => {
      const published = post.status === 'published';
      publishToggle.textContent = published ? L('Gỡ xuất bản', '取消发布') : L('Xuất bản', '发布');
      publishToggle.className = published ? 'ana-btn' : 'ana-btn adm-btn-accent';
      remove.hidden = !post.id;
      save.textContent = published ? L('Lưu thay đổi', '保存修改') : L('Lưu nháp', '保存草稿');
      paintState();
    };
    paintButtons();

    const collect = () => ({
      lang: langSelect.value,
      translationKey: translationKey.value.trim() || null,
      slug: slug.value.trim(),
      title: title.value.trim(),
      description: description.value.trim(),
      tags: splitNames(tags.value, 12),
      coverImage,
      bodyMarkdown: bodyInput.value,
      faq: [...faqList.children]
        .map((row) => ({
          q: row.querySelector('[data-faq="q"]').value.trim(),
          a: row.querySelector('[data-faq="a"]').value.trim(),
        }))
        .filter((entry) => entry.q && entry.a),
    });

    const validate = (data) => {
      for (const node of [slug, title]) node.removeAttribute('aria-invalid');
      const invalid = !SLUG_PATTERN.test(data.slug) ? slug : !data.title ? title : null;
      if (!invalid) return true;
      invalid.setAttribute('aria-invalid', 'true');
      status.set(invalid === slug
        ? L('Slug chỉ gồm chữ thường không dấu, số và dấu gạch ngang.', 'Slug 只能包含小写字母、数字和连字符。')
        : L('Hãy nhập tiêu đề bài viết.', '请填写文章标题。'), 'error');
      invalid.focus();
      return false;
    };

    const persist = async () => {
      const data = collect();
      if (!validate(data)) return false;
      const saved = post.id
        ? await api(`/api/admin/posts/${encodeURIComponent(post.id)}`, { method: 'PUT', json: data })
        : await api('/api/admin/posts', { method: 'POST', json: data });
      post = { ...post, ...data, ...(saved && typeof saved === 'object' ? (saved.post || saved) : {}) };
      heading.textContent = L('Sửa bài viết', '编辑文章');
      paintButtons();
      counts.refresh();
      // PUT bài đã xuất bản gọi lại deploy hook: trả `deploy` để báo kết quả build lại.
      return { deploy: saved?.deploy ?? null };
    };

    const busy = (flag) => {
      for (const node of [save, publishToggle, remove]) node.disabled = flag;
    };

    const form = el('form', { class: 'adm-form', novalidate: '' }, [
      el('div', { class: 'adm-grid-3' }, [
        formField('cm-post-lang', L('Ngôn ngữ', '语言'), langSelect),
        formField('cm-post-slug', 'Slug', slug, L('Ví dụ: doi-hinh-mua-s18. Duy nhất trong cùng ngôn ngữ.', '例如：doi-hinh-mua-s18。同一语言内必须唯一。')),
        formField('cm-post-translation', L('Khoá bản dịch', '译文关联键'), translationKey, L('Đặt giống nhau cho bản Việt và bản Trung của cùng một bài.', '同一篇文章的越南语版与中文版填写相同的值。')),
      ]),
      el('div', { class: 'adm-grid-title' }, [
        formField('cm-post-title', L('Tiêu đề', '标题'), title),
        formField('cm-post-tags', L('Thẻ', '标签'), tags, L('Ngăn bằng dấu phẩy.', '用逗号分隔。')),
      ]),
      formField('cm-post-description', L('Mô tả ngắn (SEO)', '简短描述（SEO）'), description),
      el('div', { class: 'adm-card adm-cover' }, [
        coverMedia,
        el('div', { class: 'adm-cover-info' }, [
          el('span', { class: 'adm-label' }, L('Ảnh bìa', '封面图')),
          coverName,
          el('div', { class: 'adm-actions' }, [coverFile, coverPick, coverRemove]),
        ]),
      ]),
      markdown,
      el('fieldset', { class: 'adm-faq' }, [
        el('legend', {}, L('Câu hỏi thường gặp (FAQ)', '常见问题（FAQ）')),
        faqList,
        el('div', {}, addFaqButton),
      ]),
      el('div', { class: 'adm-dock' }, [status, el('div', { class: 'adm-actions' }, [remove, save, publishToggle])]),
    ]);

    back.addEventListener('click', () => showList());
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      busy(true);
      status.set(L('Đang lưu…', '正在保存…'));
      try {
        const saved = await persist();
        if (saved) {
          const deploy = saved.deploy ? deployMessage(saved, true) : null;
          status.set(deploy && deploy.kind === 'error'
            ? `${L('Đã lưu bài viết.', '文章已保存。')} ${L('Nhưng gọi deploy hook thất bại. Hãy lưu lại để build lại site.', '但调用部署钩子失败，请再次保存以重新构建站点。')}`
            : deploy
              ? `${L('Đã lưu bài viết.', '文章已保存。')} ${L('Đã yêu cầu build lại site; thay đổi sẽ lên sau vài phút.', '已触发站点重新构建，几分钟后生效。')}`
              : L('Đã lưu bài viết.', '文章已保存。'), deploy?.kind ?? '');
        }
      } catch (error) {
        status.set(describeError(error), 'error');
      } finally {
        busy(false);
      }
    });
    publishToggle.addEventListener('click', async () => {
      const publishing = post.status !== 'published';
      busy(true);
      status.set(publishing ? L('Đang xuất bản…', '正在发布…') : L('Đang gỡ xuất bản…', '正在取消发布…'));
      try {
        if (!(await persist())) return;
        const body = await api(`/api/admin/posts/${encodeURIComponent(post.id)}/${publishing ? 'publish' : 'unpublish'}`, { method: 'POST', json: {} });
        post = { ...post, ...(body?.post && typeof body.post === 'object' ? body.post : {}), status: publishing ? 'published' : 'draft' };
        paintButtons();
        counts.refresh();
        const message = deployMessage(body, publishing);
        status.set(message.text, message.kind);
      } catch (error) {
        status.set(describeError(error), 'error');
      } finally {
        busy(false);
      }
    });
    remove.addEventListener('click', async () => {
      if (!post.id || !window.confirm(L('Xoá vĩnh viễn bài viết này?', '确定永久删除这篇文章吗？'))) return;
      busy(true);
      try {
        await api(`/api/admin/posts/${encodeURIComponent(post.id)}`, { method: 'DELETE' });
        await showList('.adm-section-head .ana-btn');
        counts.refresh();
        status.set(L('Đã xoá bài viết.', '文章已删除。'));
      } catch (error) {
        status.set(describeError(error), 'error');
        busy(false);
      }
    });

    view.replaceChildren(
      el('div', { class: 'adm-editor-head' }, [back, heading, state]),
      form,
    );
    heading.focus();
  }

  showList();
}

/* ---------- Khởi tạo ---------- */

/** Thẻ tài khoản quản trị ở đầu trang (artboard: ảnh đại diện + tên + "Quản trị viên · đăng nhập Google"). */
function paintIdentity(user) {
  const slot = document.getElementById('community-admin-identity');
  if (!slot) return;
  slot.replaceChildren(
    avatar(user),
    el('span', { class: 'adm-identity-text' }, [
      el('span', { class: 'adm-identity-name' }, displayName(user)),
      el('span', { class: 'adm-identity-role' }, L('Quản trị viên · đăng nhập Google', '管理员 · Google 登录')),
    ]),
  );
  slot.hidden = false;
}

export async function initCommunityAdmin(mount = document.getElementById('community-admin')) {
  if (!mount) return;
  mount.setAttribute('aria-busy', 'true');
  let user;
  try {
    user = await loadSession({ probe: true });
  } catch {
    mount.replaceChildren(unavailableNotice());
    mount.removeAttribute('aria-busy');
    return;
  }
  mount.removeAttribute('aria-busy');
  if (!user) {
    mount.replaceChildren(signInPrompt(L('Đăng nhập bằng tài khoản quản trị để tiếp tục.', '请使用管理员账号登录。')));
    return;
  }
  if (!user.isAdmin) {
    mount.replaceChildren(el('p', { class: 'cm-notice' }, L('Tài khoản này không có quyền quản trị.', '该账号没有管理权限。')));
    return;
  }
  paintIdentity(user);
  const counts = countsStore();
  const view = adminShell([
    {
      id: 'reports',
      hash: 'chien-bao',
      icon: 'reports',
      label: L('Duyệt chiến báo', '审核战报'),
      lead: L(
        'Chiến báo người chơi gửi kèm ảnh và dữ liệu đội đã tự xác nhận. Chỉ chiến báo đã duyệt mới vào số liệu của đội.',
        '玩家提交的战报附带截图和已自行确认的阵容数据。只有通过审核的战报才计入阵容统计。',
      ),
      count: { key: 'reportsPending', unit: L('chiến báo chờ duyệt', '份战报待审核') },
      open: openReportsPanel,
    },
    {
      id: 'posts',
      hash: 'bai-viet',
      icon: 'posts',
      label: L('Bài viết', '文章'),
      lead: L('Bài hướng dẫn và phân tích; bản Việt và bản Trung nối bằng khoá bản dịch.', '攻略与分析文章；越南语版与中文版通过译文关联键对应。'),
      count: { key: 'postsDraft', unit: L('bản nháp', '篇草稿') },
      open: openPostsPanel,
    },
    {
      id: 'comments',
      hash: 'binh-luan',
      icon: 'comments',
      label: L('Bình luận', '评论'),
      lead: L('Bình luận mới nhất trên mọi trang, cả bản Việt và bản Trung · xoá bình luận vi phạm quy tắc cộng đồng.', '所有页面的最新评论（含越南语版与中文版）· 删除违反社区规则的评论。'),
      open: openCommentsPanel,
    },
    {
      id: 'feedback',
      hash: 'gop-y',
      icon: 'feedback',
      label: L('Góp ý', '意见反馈'),
      lead: L('Góp ý và báo lỗi gửi từ footer · đánh dấu đã xử lý để khỏi làm lại.', '从页脚提交的意见与错误报告 · 标记为已处理以免重复。'),
      count: { key: 'feedbackNew', unit: L('góp ý chưa xử lý', '条反馈未处理') },
      open: openFeedbackPanel,
    },
    {
      id: 'scan',
      hash: 'soi-doi',
      icon: 'scan',
      label: L('Soi đội', '截图识阵'),
      lead: L(
        'Tỷ lệ ô người dùng phải sửa hoặc AI đọc không rõ (đếm ẩn danh) và ảnh người dùng tự nguyện gửi để bổ sung bộ ảnh chuẩn.',
        '用户需要修改或 AI 识别不清的格子占比（匿名统计），以及用户自愿提交、用于补充基准图集的截图。',
      ),
      count: { key: 'scanPending', unit: L('ảnh chờ duyệt', '张截图待审核') },
      open: openScanPanel,
    },
    {
      id: 'ai',
      hash: 'ai',
      icon: 'ai',
      label: 'AI',
      lead: L(
        'Nhà cung cấp giữ endpoint và API key dùng chung. Mỗi tính năng có chuỗi riêng: thứ tự là thứ tự ưu tiên, mắt xích trên lỗi (sai key, hết tiền, quá tải, máy chủ lỗi) thì tự chuyển sang mắt xích kế cho tới khi hết trần tổng thời gian. Bấm Lưu để áp dụng cả hai phần; có hiệu lực trong khoảng 1 phút.',
        '服务商保存共用的 endpoint 和 API 密钥。每个功能有自己的链：顺序即优先级，上一环出错（密钥错误、余额不足、过载、服务器错误）时自动切换到下一环，直到用完总时限。点击“保存”同时应用两部分，约 1 分钟内生效。',
      ),
      open: openAiPanel,
    },
  ], counts);
  mount.replaceChildren(view.node);
  view.start();
  counts.refresh();
}

initCommunityAdmin();
