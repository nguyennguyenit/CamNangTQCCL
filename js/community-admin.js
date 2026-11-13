// Trang /quan-tri/ (noindex, artboard Admin*): cột điều hướng trái (≤960px thành hàng chip) mở các khu theo hash —
// "Duyệt chiến báo" (#chien-bao: ảnh, dữ liệu AI đã xác nhận, duyệt / từ chối kèm lý do),
// "Bài viết" (#bai-viet: bảng bài, soạn/sửa Markdown có xem trước an toàn, FAQ, lưu nháp, xuất bản/gỡ xuất bản),
// "Bình luận" (#binh-luan: xoá bình luận vi phạm trên mọi trang), "Góp ý" (#gop-y: góp ý/báo lỗi từ footer,
// đánh dấu đã xử lý), "Soi đội" (#soi-doi: tỷ lệ ô sửa/không rõ ẩn danh, duyệt ảnh gửi tự nguyện, xuất fixture
// bộ ảnh chuẩn — js/community-admin-scan.js), "AI" (#ai: nhà cung cấp AI + chuỗi failover của từng tính năng —
// js/community-admin-ai.js), "Đội cộng đồng" (#doi-cong-dong: duyệt/từ chối/gỡ đội,
// mở mùa — js/community-admin-teams.js), "Người dùng" (#nguoi-dung) và "Nhật ký" (#nhat-ky, root) — hai khu cuối nằm ở
// js/community-admin-users.js.
// Vai trò `root` thấy mọi khu; `moderator` (kiểm duyệt viên) chỉ thấy khu có `roles` cho phép, khu khác không dựng
// và không gọi API. Server mới là nơi kiểm quyền; trang chỉ ẩn giao diện.

import { L, currentLocale } from './i18n.js';
import { el, icon, svgNode } from './render.js';
import {
  api,
  avatar,
  communityPageHref,
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
import { openTeamsPanel } from './community-admin-teams.js';
import { openAuditPanel, openUsersPanel } from './community-admin-users.js';
import { openScanPanel } from './community-admin-scan.js';
import { openAiPanel } from './community-admin-ai.js';

// Nhãn trạng thái mẫu Soi đội: khu Người dùng (js/community-admin-users.js) nhập từ đây.
export { SCAN_STATUS_LABEL } from './community-admin-scan.js';

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
  teams: [['circle', { cx: 8, cy: 8, r: 2.5 }], ['circle', { cx: 16, cy: 8, r: 2.5 }], ['circle', { cx: 12, cy: 16, r: 2.5 }], path('M10 9.5l1 4'), path('M14 9.5l-1 4')],
  users: [['circle', { cx: 9, cy: 8, r: 3.5 }], path('M2.5 20a6.5 6.5 0 0 1 13 0'), path('M16 4.5a3.5 3.5 0 0 1 0 7'), path('M18 14.2a6.5 6.5 0 0 1 3.5 5.8')],
  audit: [path('M6 3h9l4 4v14H6z'), path('M9 11h7'), path('M9 15h7'), path('M9 7h3')],
  external: [path('M14 4h6v6'), path('M20 4l-9 9'), path('M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5')],
  // Artboard AdminAnalyze · AdminAIFeatures: tải fixture, cảnh báo, mũi tên nối mắt xích, mở/thu thẻ nhóm (mobile).
  download: [path('M12 4v11'), path('M7 10l5 5 5-5'), path('M5 20h14')],
  warning: [path('M12 3l10 18H2z'), path('M12 10v4'), path('M12 17.5v.1')],
  error: [['circle', { cx: 12, cy: 12, r: 9 }], path('M12 7.5v5.5'), path('M12 16.5v.1')],
  arrowDown: [path('M12 5v12'), path('M7 13l5 5 5-5')],
  chevronUp: [path('M6 15l6-6 6 6')],
  chevronDown: [path('M6 9l6 6 6-6')],
};

export function glyph(name, size = 16) {
  return icon(ICONS[name].map(([tag, attrs]) => svgNode(tag, attrs)), { size });
}

/** Nút chữ + icon tuỳ chọn; `variant` thêm class biến thể (primary, adm-btn-accent, adm-btn-danger…). */
export function button(text, { variant = '', iconName = null, compact = false, type = 'button', ...attrs } = {}) {
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

function adminShell(definitions, counts, { viewer, forbiddenHashes }) {
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
    sections.push({ section, head, actions, counts, viewer });
    const badge = definition.count ? el('span', { class: 'adm-nav-count', hidden: '' }) : null;
    if (badge) badges.push([definition.count, badge]);
    return el('a', { class: 'adm-nav-link', href: `#${definition.hash}` }, [glyph(definition.icon, 18), el('span', { class: 'adm-nav-label' }, definition.label), badge]);
  });
  const list = el('ul', { class: 'adm-nav-list' }, links.map((link) => el('li', {}, link)));
  const opened = new Set();
  const findSection = (hash) => hash === '' ? 0 : definitions.findIndex((definition) => `#${definition.hash}` === hash);
  let active = 0;
  // Hàng chip mobile: kéo chip đang chọn vào giữa (chỉ cuộn ngang, không đẩy trang). Gọi lại khi bề rộng chip đổi
  // (badge số chờ hiện sau khi /api/admin/counts về, font web nạp xong), nếu không chip đang chọn có thể bị đẩy khuất.
  const centerActive = () => {
    if (list.scrollWidth <= list.clientWidth) return;
    const link = links[active];
    list.scrollLeft = link.offsetLeft - (list.clientWidth - link.offsetWidth) / 2;
  };
  counts.subscribe((values) => {
    for (const [{ key, unit }, badge] of badges) {
      const value = Number(values?.[key]) || 0;
      badge.hidden = value === 0;
      badge.replaceChildren(el('span', { 'aria-hidden': 'true' }, String(value)), el('span', { class: 'visually-hidden' }, `, ${value} ${unit}`));
    }
    centerActive();
  });
  document.fonts?.ready.then(centerActive);
  const select = (index, { focus = false } = {}) => {
    active = index;
    sections.forEach(({ section }, current) => {
      section.hidden = current !== index;
      if (current === index) links[current].setAttribute('aria-current', 'page');
      else links[current].removeAttribute('aria-current');
    });
    centerActive();
    if (!opened.has(index)) {
      opened.add(index);
      definitions[index].open(sections[index].section, sections[index]);
    }
    if (focus) titles[index].focus();
  };
  // Hash khác (vd `#main-content` của link "bỏ qua tới nội dung") không phải khu quản trị: giữ khu đang mở.
  // Hash của khu không được phép (KDV mở `#ai`…) về khu đầu và sửa luôn URL.
  const fallbackToFirst = () => {
    history.replaceState(history.state, '', `#${definitions[0].hash}`);
    return 0;
  };
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash;
    const index = forbiddenHashes.has(hash) ? fallbackToFirst() : findSection(hash);
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
  return {
    node,
    start: () => {
      const hash = window.location.hash;
      select(forbiddenHashes.has(hash) ? fallbackToFirst() : Math.max(0, findSection(hash)));
    },
  };
}

/* ---------- Mảnh dùng chung của các khu ---------- */

/** Dòng trạng thái của khu (role=status): thành công xanh, `warn` hổ phách, `error` đỏ. */
export function adminStatus() {
  return liveStatus('cm-status adm-status');
}

/**
 * Dòng trạng thái có icon (artboard AdminAnalyze · AdminAIFeatures): thành công dấu tích xanh, `warn` tam giác hổ
 * phách, `error` vòng tròn chấm than đỏ, `info` (đang lưu…) chữ mực, không icon. Cùng API `set(message, kind)` với `adminStatus`; chữ nằm trong `<span>` để `role=status`
 * đọc đúng thông điệp.
 */
export function adminIconStatus() {
  const node = el('p', { class: 'cm-status adm-status adm-icon-status', role: 'status', 'aria-live': 'polite', hidden: '' });
  node.set = (message, kind = '') => {
    const icon = !message || kind === 'info' ? null : glyph(kind === 'error' ? 'error' : kind === 'warn' ? 'warning' : 'check');
    node.replaceChildren(...(message ? [icon, el('span', {}, message)].filter(Boolean) : []));
    node.dataset.kind = kind;
    node.hidden = !message;
  };
  return node;
}

export function emptyNote(text) {
  return el('p', { class: 'adm-empty', hidden: '' }, text);
}

export function pagePath(page, lang) {
  return typeof page === 'string' && page.startsWith('/')
    ? el('a', { class: 'adm-path', href: lang || page.startsWith('/doi-cong-dong/') ? communityPageHref(page, lang || 'vi') : page }, page)
    : null;
}

const langLabel = (lang) => (lang === 'zh' ? '中文' : 'Tiếng Việt');

export function formField(id, label, control, hint) {
  if (hint) control.setAttribute('aria-describedby', `${id}-hint`);
  return el('div', { class: 'adm-field' }, [
    el('label', { class: 'adm-label', for: id }, label),
    control,
    hint ? el('p', { id: `${id}-hint`, class: 'adm-hint' }, hint) : null,
  ]);
}

export function textInput(id, value, { mono = false, ...attrs } = {}) {
  const node = el('input', { id, class: mono ? 'cm-input adm-mono' : 'cm-input', type: 'text', ...attrs });
  node.value = value ?? '';
  return node;
}

export function selectInput(id, options, value, attrs = {}) {
  const node = el('select', { id, class: 'cm-select', ...attrs }, options.map(([v, text]) => el('option', { value: v }, text)));
  node.value = value;
  return node;
}

/** Ô ảnh mở ảnh gốc ở tab mới (nền dải, icon mở ngoài ở góc). */
export function imageTile(href, alt) {
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
export function pagedList({ list, empty, status, fetchPage, render, fallbackFocus }) {
  const more = button(L('Tải thêm', '加载更多'), { variant: 'adm-more', hidden: '' });
  let cursor = null;
  let generation = 0;
  const refresh = () => {
    empty.hidden = list.childElementCount > 0;
  };
  const load = async ({ reset = false } = {}) => {
    const current = reset ? ++generation : generation;
    // Tải lại: bỏ cursor và ẩn "Tải thêm" ngay, để không ai bấm tải tiếp trang của bộ lọc cũ trong lúc chờ.
    if (reset) {
      cursor = null;
      more.hidden = true;
    }
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
    const remove = comment.canDelete ? button(L('Xoá', '删除'), { variant: 'adm-btn-danger', compact: true }) : null;
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
    remove?.addEventListener('click', async () => {
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
  // Email đã che (kiểm duyệt viên) chỉ là chữ: không có địa chỉ thật để gửi thư.
  const mailto = email && entry.emailMasked !== true ? `mailto:${email}?subject=${encodeURIComponent(`Re: ${entry.title}`)}` : null;
  const row = el('li', { class: 'adm-card adm-feedback cm-feedback-item' }, [
    el('p', { class: 'adm-meta' }, [
      el('span', { class: 'cm-badge', dataset: { tone: FEEDBACK_KIND_TONE[entry.kind] ?? '' } }, kind ? L(kind.vi, kind.zh) : String(entry.kind || '')),
      badge,
      el('span', { class: 'adm-author' }, entry.author ? displayName(entry.author) : L('Ẩn danh', '匿名')),
      timeNode(entry.createdAt),
      el('span', { class: 'cm-badge' }, langLabel(entry.lang)),
      pagePath(entry.page),
      mailto ? el('a', { class: 'adm-mail', href: mailto }, email) : null,
      email && !mailto ? el('span', { class: 'adm-mail' }, email) : null,
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
      el('span', { class: 'adm-identity-role' }, user.role === 'root'
        ? L('Quản trị viên · đăng nhập Google', '管理员 · Google 登录')
        : L('Kiểm duyệt viên · đăng nhập Google', '版主 · Google 登录')),
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
  if (user.role !== 'root' && user.role !== 'moderator') {
    mount.replaceChildren(el('p', { class: 'cm-notice' }, L('Tài khoản này không có quyền quản trị.', '该账号没有管理权限。')));
    return;
  }
  paintIdentity(user);
  const counts = countsStore();
  const ROOT = ['root'];
  const STAFF = ['root', 'moderator'];
  const definitions = [
    {
      id: 'reports',
      roles: STAFF,
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
      roles: ROOT,
      hash: 'bai-viet',
      icon: 'posts',
      label: L('Bài viết', '文章'),
      lead: L('Bài hướng dẫn và phân tích; bản Việt và bản Trung nối bằng khoá bản dịch.', '攻略与分析文章；越南语版与中文版通过译文关联键对应。'),
      count: { key: 'postsDraft', unit: L('bản nháp', '篇草稿') },
      open: openPostsPanel,
    },
    {
      id: 'comments',
      roles: STAFF,
      hash: 'binh-luan',
      icon: 'comments',
      label: L('Bình luận', '评论'),
      lead: L('Bình luận mới nhất trên mọi trang, cả bản Việt và bản Trung · xoá bình luận vi phạm quy tắc cộng đồng.', '所有页面的最新评论（含越南语版与中文版）· 删除违反社区规则的评论。'),
      open: openCommentsPanel,
    },
    {
      id: 'feedback',
      roles: STAFF,
      hash: 'gop-y',
      icon: 'feedback',
      label: L('Góp ý', '意见反馈'),
      lead: L('Góp ý và báo lỗi gửi từ footer · đánh dấu đã xử lý để khỏi làm lại.', '从页脚提交的意见与错误报告 · 标记为已处理以免重复。'),
      count: { key: 'feedbackNew', unit: L('góp ý chưa xử lý', '条反馈未处理') },
      open: openFeedbackPanel,
    },
    {
      id: 'scan',
      roles: STAFF,
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
      roles: ROOT,
      hash: 'ai',
      icon: 'ai',
      label: 'AI',
      lead: L(
        'Nhà cung cấp giữ endpoint và API key dùng chung. Mỗi tính năng có chuỗi failover riêng; bấm Lưu để áp dụng cả hai phần, có hiệu lực trong khoảng 1 phút.',
        '服务商保存共用的 endpoint 和 API 密钥。每个功能有自己的 failover 调用链；点击“保存”同时应用两部分，约 1 分钟内生效。',
      ),
      open: openAiPanel,
    },
    {
      id: 'teams',
      roles: STAFF,
      hash: 'doi-cong-dong',
      icon: 'teams',
      label: L('Đội cộng đồng', '社区阵容'),
      lead: user.role === 'root'
        ? L('Duyệt hoặc từ chối đội người chơi đăng, gỡ đội đã duyệt, dọn đội xoá dở và mở mùa mới.', '审核或拒绝玩家发布的阵容、下架已通过的阵容、清理删除未完成的阵容，并开启新赛季。')
        : L('Duyệt hoặc từ chối đội người chơi đăng, gỡ đội đã duyệt, dọn đội xoá dở. Email tác giả đã được che.', '审核或拒绝玩家发布的阵容、下架已通过的阵容、清理删除未完成的阵容。作者邮箱已做遮挡显示。'),
      count: { key: 'teamsPending', unit: L('đội chờ', '待审') },
      open: openTeamsPanel,
    },
    {
      id: 'users',
      hash: 'nguoi-dung',
      icon: 'users',
      label: L('Người dùng', '用户'),
      lead: user.role === 'root'
        ? L('Tìm tài khoản, khoá có thời hạn kèm lý do, cấp hoặc thu quyền kiểm duyệt viên, xoá tài khoản cùng dữ liệu.', '查找账号、按期限封禁并注明理由、授予或收回版主权限、删除账号及其数据。')
        : L('Tìm tài khoản và khoá hoặc mở khoá người dùng thường kèm lý do. Email hiển thị đã được che.', '查找账号，并对普通用户封禁或解封（需注明理由）。邮箱已做遮挡显示。'),
      roles: STAFF,
      open: openUsersPanel,
    },
    {
      id: 'audit',
      hash: 'nhat-ky',
      icon: 'audit',
      label: L('Nhật ký', '日志'),
      lead: L('Mọi thao tác quản trị đã ghi: ai làm, hành động, đối tượng, lý do, kết quả.', '已记录的所有管理操作：操作人、动作、对象、理由与结果。'),
      roles: ROOT,
      open: openAuditPanel,
    },
  ];
  // Chỉ dựng (và chỉ gọi API cho) khu hợp vai trò; hash của khu bị loại được shell đưa về khu đầu.
  const allowed = definitions.filter((definition) => definition.roles.includes(user.role));
  const forbiddenHashes = new Set(definitions.filter((definition) => !allowed.includes(definition)).map((definition) => `#${definition.hash}`));
  const view = adminShell(allowed, counts, { viewer: user, forbiddenHashes });
  mount.replaceChildren(view.node);
  view.start();
  counts.refresh();
}

initCommunityAdmin();
