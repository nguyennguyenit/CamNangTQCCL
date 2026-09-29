// Trang /quan-tri/ (noindex): năm tab — "Duyệt chiến báo" (ảnh, dữ liệu AI đã xác nhận, duyệt / từ chối kèm lý do),
// "Bài viết" (danh sách, soạn/sửa Markdown có xem trước an toàn, FAQ, lưu nháp, xuất bản/gỡ xuất bản),
// "Bình luận" (xoá bình luận vi phạm trên mọi trang), "Góp ý" (góp ý/báo lỗi từ footer, đánh dấu đã xử lý)
// và "AI" (danh sách nhà cung cấp AI + thứ tự failover cho mọi tính năng đọc ảnh).
// Server mới là nơi kiểm quyền; trang chỉ ẩn giao diện với người không phải admin.

import { L, currentLocale, localePath } from './i18n.js';
import { el } from './render.js';
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

/* ---------- Tabs (mẫu WAI-ARIA: mũi tên trái/phải, Home/End) ---------- */

function tabs(definitions) {
  const tablist = el('div', { class: 'cm-tabs', role: 'tablist', 'aria-label': L('Khu quản trị', '管理区域') });
  const panels = [];
  const buttons = definitions.map((definition, index) => {
    const tabId = `cm-tab-${definition.id}`;
    const panelId = `cm-panel-${definition.id}`;
    const button = el('button', {
      id: tabId,
      class: 'cm-tab',
      type: 'button',
      role: 'tab',
      'aria-controls': panelId,
      'aria-selected': index === 0 ? 'true' : 'false',
      tabindex: index === 0 ? '0' : '-1',
    }, definition.label);
    const panel = el('div', { id: panelId, class: 'cm-tab-panel', role: 'tabpanel', 'aria-labelledby': tabId, tabindex: '0' });
    if (index !== 0) panel.hidden = true;
    panels.push(panel);
    return button;
  });
  const loaded = new Set();
  const select = (index, { focus = false } = {}) => {
    buttons.forEach((button, current) => {
      const active = current === index;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      panels[current].hidden = !active;
    });
    if (focus) buttons[index].focus();
    if (!loaded.has(index)) {
      loaded.add(index);
      definitions[index].open(panels[index]);
    }
  };
  buttons.forEach((button, index) => {
    button.addEventListener('click', () => select(index));
    button.addEventListener('keydown', (event) => {
      const last = buttons.length - 1;
      const target = event.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
        : event.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
          : event.key === 'Home' ? 0 : event.key === 'End' ? last : null;
      if (target === null) return;
      event.preventDefault();
      select(target, { focus: true });
    });
  });
  tablist.append(...buttons);
  return { node: el('div', { class: 'cm-admin-tabs' }, [tablist, ...panels]), start: () => select(0) };
}

/* ---------- Duyệt chiến báo ---------- */

function pendingReportItem(report, { status, onDone }) {
  const imageUrl = typeof report.imageUrl === 'string' && report.imageUrl.startsWith('/api/')
    ? report.imageUrl
    : `/api/reports/${encodeURIComponent(report.id)}/image`;
  const approve = el('button', { class: 'ana-btn primary', type: 'button' }, L('Duyệt', '通过'));
  const reject = el('button', { class: 'ana-btn', type: 'button' }, L('Từ chối', '拒绝'));
  const actions = el('div', { class: 'cm-form-row' }, [approve, reject]);
  const item = el('li', { class: 'cm-report cm-admin-report', dataset: { reportId: String(report.id) } }, [
    el('a', { class: 'cm-report-image-link', href: imageUrl, target: '_blank', rel: 'noopener' }, [
      el('img', { class: 'cm-report-image', src: imageUrl, alt: L('Ảnh chiến báo', '战报截图'), loading: 'lazy' }),
      el('span', { class: 'visually-hidden' }, L('(mở tab mới)', '（在新标签页打开）')),
    ]),
    el('div', { class: 'cm-admin-report-main' }, [
      el('p', { class: 'cm-report-meta' }, [
        avatar(report.author),
        el('span', {}, displayName(report.author)),
        timeNode(report.createdAt),
        typeof report.page === 'string' ? el('a', { class: 'cm-link', href: localePath(report.page, report.lang) }, report.page) : null,
      ]),
      // Dữ liệu AI đã được người gửi xác nhận/sửa trước khi gửi; server chỉ lưu bản đã xác nhận.
      reportSummary(report),
      actions,
    ]),
  ]);

  const finish = (message) => {
    const next = item.nextElementSibling || item.previousElementSibling;
    item.remove();
    status.set(message);
    onDone(next);
  };

  approve.addEventListener('click', async () => {
    approve.disabled = true;
    reject.disabled = true;
    try {
      await api(`/api/admin/reports/${encodeURIComponent(report.id)}/approve`, { method: 'POST', json: {} });
      finish(L('Đã duyệt chiến báo.', '战报已通过。'));
    } catch (error) {
      approve.disabled = false;
      reject.disabled = false;
      status.set(describeError(error), 'error');
    }
  });

  reject.addEventListener('click', () => {
    const inputId = `cm-reject-${report.id}`;
    const reason = el('input', { id: inputId, class: 'cm-input', type: 'text', maxlength: '500', required: '' });
    const confirm = el('button', { class: 'ana-btn primary', type: 'submit' }, L('Xác nhận từ chối', '确认拒绝'));
    const cancel = el('button', { class: 'ana-btn', type: 'button' }, L('Huỷ', '取消'));
    const form = el('form', { class: 'cm-reject-form', novalidate: '' }, [
      el('label', { class: 'cm-label', for: inputId }, L('Lý do từ chối', '拒绝原因')),
      reason,
      el('div', { class: 'cm-form-row' }, [cancel, confirm]),
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
        finish(L('Đã từ chối chiến báo.', '战报已拒绝。'));
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

function openReportsPanel(panel) {
  const status = liveStatus();
  const list = el('ol', { class: 'cm-report-list', 'aria-label': L('Chiến báo chờ duyệt', '待审核战报') });
  const empty = el('p', { class: 'scope-note cm-empty', hidden: '' }, L('Không còn chiến báo nào chờ duyệt.', '没有待审核的战报。'));
  const more = el('button', { class: 'ana-btn cm-more', type: 'button', hidden: '' }, L('Tải thêm', '加载更多'));
  let cursor = null;
  const refresh = () => {
    empty.hidden = list.childElementCount > 0;
  };
  const onDone = (next) => {
    refresh();
    (next?.querySelector('button') || panel).focus();
  };
  const load = async () => {
    const params = new URLSearchParams({ status: 'pending' });
    if (cursor) params.set('cursor', cursor);
    const body = await api(`/api/admin/reports?${params}`);
    for (const report of Array.isArray(body?.items) ? body.items : []) list.append(pendingReportItem(report, { status, onDone }));
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
  panel.append(status, list, empty, more);
  panel.setAttribute('aria-busy', 'true');
  load()
    .catch((error) => status.set(describeError(error), 'error'))
    .finally(() => panel.removeAttribute('aria-busy'));
}

/* ---------- Kiểm duyệt bình luận ---------- */
// Admin xem mọi bình luận của mọi trang (cả vi lẫn zh, có nhãn ngôn ngữ) để xoá bình luận vi phạm.

function openCommentsPanel(panel) {
  const status = liveStatus();
  const list = el('ol', { class: 'cm-comment-list', 'aria-label': L('Bình luận mới nhất', '最新评论') });
  const empty = el('p', { class: 'scope-note cm-empty', hidden: '' }, L('Chưa có bình luận nào.', '还没有评论。'));
  const more = el('button', { class: 'ana-btn cm-more', type: 'button', hidden: '' }, L('Tải thêm', '加载更多'));
  let cursor = null;
  const refresh = () => {
    empty.hidden = list.childElementCount > 0;
  };
  const item = (comment) => {
    const remove = el('button', { class: 'cm-text-btn cm-danger', type: 'button' }, L('Xoá', '删除'));
    const row = el('li', { class: 'cm-comment' }, [
      avatar(comment.author),
      el('div', { class: 'cm-comment-main' }, [
        el('p', { class: 'cm-comment-meta' }, [
          el('span', { class: 'cm-comment-author' }, displayName(comment.author)),
          timeNode(comment.createdAt),
          el('span', { class: 'cm-badge' }, comment.lang === 'zh' ? '中文' : 'Tiếng Việt'),
          typeof comment.page === 'string' ? el('a', { class: 'cm-link', href: localePath(comment.page, comment.lang) }, comment.page) : null,
        ]),
        el('p', { class: 'cm-comment-body', lang: comment.lang === 'zh' ? 'zh-Hans' : 'vi' }, String(comment.body || '')),
        remove,
      ]),
    ]);
    remove.addEventListener('click', async () => {
      if (!window.confirm(L('Xoá bình luận này?', '确定删除这条评论吗？'))) return;
      remove.disabled = true;
      try {
        await api(`/api/comments/${encodeURIComponent(comment.id)}`, { method: 'DELETE' });
        const next = row.nextElementSibling || row.previousElementSibling;
        row.remove();
        refresh();
        status.set(L('Đã xoá bình luận.', '评论已删除。'));
        (next?.querySelector('button') || panel).focus();
      } catch (error) {
        remove.disabled = false;
        status.set(describeError(error), 'error');
      }
    });
    return row;
  };
  const load = async () => {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    const query = params.toString();
    const body = await api(`/api/admin/comments${query ? `?${query}` : ''}`);
    for (const comment of Array.isArray(body?.items) ? body.items : []) list.append(item(comment));
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
  panel.append(status, list, empty, more);
  panel.setAttribute('aria-busy', 'true');
  load()
    .catch((error) => status.set(describeError(error), 'error'))
    .finally(() => panel.removeAttribute('aria-busy'));
}

/* ---------- Góp ý, sửa lỗi ---------- */
// Góp ý gửi từ hộp thoại ở footer (cả khách ẩn danh). Admin lọc theo trạng thái/loại và chuyển Mới ⇄ Đã xử lý;
// trả lời người gửi bằng thư (link mailto hoặc Reply ngay trong thư báo).

const FEEDBACK_STATUS_LABEL = { new: L('Chưa xử lý', '未处理'), done: L('Đã xử lý', '已处理') };

function feedbackItem(entry, { status }) {
  const kind = FEEDBACK_KINDS.find((candidate) => candidate.id === entry.kind);
  const badge = el('span', { class: 'cm-badge' });
  const toggle = el('button', { class: 'cm-text-btn', type: 'button' });
  let current = entry.status === 'done' ? 'done' : 'new';
  const paint = () => {
    badge.textContent = FEEDBACK_STATUS_LABEL[current];
    badge.dataset.status = current === 'done' ? 'approved' : 'pending';
    toggle.textContent = current === 'done' ? L('Đánh dấu chưa xử lý', '标记为未处理') : L('Đánh dấu đã xử lý', '标记为已处理');
  };
  paint();
  const email = typeof entry.email === 'string' && entry.email ? entry.email : null;
  const mailto = email ? `mailto:${email}?subject=${encodeURIComponent(`Re: ${entry.title}`)}` : null;
  const row = el('li', { class: 'cm-comment cm-feedback-item' }, [
    el('div', { class: 'cm-comment-main' }, [
      el('p', { class: 'cm-comment-meta' }, [
        el('span', { class: 'cm-badge' }, kind ? L(kind.vi, kind.zh) : String(entry.kind || '')),
        badge,
        el('span', { class: 'cm-comment-author' }, entry.author ? displayName(entry.author) : L('Ẩn danh', '匿名')),
        timeNode(entry.createdAt),
        el('span', { class: 'cm-badge' }, entry.lang === 'zh' ? '中文' : 'Tiếng Việt'),
        typeof entry.page === 'string' && entry.page.startsWith('/') ? el('a', { class: 'cm-link', href: entry.page }, entry.page) : null,
        mailto ? el('a', { class: 'cm-link', href: mailto }, email) : null,
      ]),
      el('p', { class: 'cm-comment-author' }, String(entry.title || '')),
      el('p', { class: 'cm-comment-body', lang: entry.lang === 'zh' ? 'zh-Hans' : 'vi' }, String(entry.body || '')),
      toggle,
    ]),
  ]);
  toggle.addEventListener('click', async () => {
    const next = current === 'done' ? 'new' : 'done';
    toggle.disabled = true;
    try {
      await api(`/api/admin/feedback/${encodeURIComponent(entry.id)}/status`, { method: 'POST', json: { status: next } });
      current = next;
      paint();
      status.set(next === 'done' ? L('Đã đánh dấu đã xử lý.', '已标记为已处理。') : L('Đã đánh dấu chưa xử lý.', '已标记为未处理。'));
    } catch (error) {
      status.set(describeError(error), 'error');
    } finally {
      toggle.disabled = false;
    }
  });
  return row;
}

function openFeedbackPanel(panel) {
  const status = liveStatus();
  const statusFilter = el('select', { id: 'cm-feedback-status', class: 'cm-select' }, [
    el('option', { value: 'new' }, FEEDBACK_STATUS_LABEL.new),
    el('option', { value: 'done' }, FEEDBACK_STATUS_LABEL.done),
    el('option', { value: '' }, L('Tất cả', '全部')),
  ]);
  const kindFilter = el('select', { id: 'cm-feedback-kind', class: 'cm-select' }, [
    el('option', { value: '' }, L('Tất cả', '全部')),
    ...FEEDBACK_KINDS.map((kind) => el('option', { value: kind.id }, L(kind.vi, kind.zh))),
  ]);
  const filters = el('div', { class: 'cm-field-grid' }, [
    el('div', { class: 'cm-field' }, [el('label', { class: 'cm-label', for: 'cm-feedback-status' }, L('Trạng thái', '状态')), statusFilter]),
    el('div', { class: 'cm-field' }, [el('label', { class: 'cm-label', for: 'cm-feedback-kind' }, L('Loại', '类型')), kindFilter]),
  ]);
  const list = el('ol', { class: 'cm-comment-list', 'aria-label': L('Góp ý', '意见反馈') });
  const empty = el('p', { class: 'scope-note cm-empty', hidden: '' }, L('Không có góp ý nào.', '没有反馈。'));
  const more = el('button', { class: 'ana-btn cm-more', type: 'button', hidden: '' }, L('Tải thêm', '加载更多'));
  let cursor = null;
  // Đổi bộ lọc khi trang trước chưa về: chỉ kết quả của lần tải mới nhất được vẽ.
  let generation = 0;
  const load = async ({ reset = false } = {}) => {
    const current = reset ? ++generation : generation;
    if (reset) cursor = null;
    const params = new URLSearchParams();
    if (statusFilter.value) params.set('status', statusFilter.value);
    if (kindFilter.value) params.set('kind', kindFilter.value);
    if (cursor) params.set('cursor', cursor);
    const query = params.toString();
    const body = await api(`/api/admin/feedback${query ? `?${query}` : ''}`);
    if (current !== generation) return;
    const items = (Array.isArray(body?.items) ? body.items : []).map((entry) => feedbackItem(entry, { status }));
    if (reset) list.replaceChildren(...items);
    else list.append(...items);
    cursor = typeof body?.nextCursor === 'string' && body.nextCursor ? body.nextCursor : null;
    more.hidden = !cursor;
    empty.hidden = list.childElementCount > 0;
  };
  const reload = () => {
    panel.setAttribute('aria-busy', 'true');
    load({ reset: true })
      .catch((error) => status.set(describeError(error), 'error'))
      .finally(() => panel.removeAttribute('aria-busy'));
  };
  statusFilter.addEventListener('change', reload);
  kindFilter.addEventListener('change', reload);
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
  panel.append(filters, status, list, empty, more);
  reload();
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

function formField(id, label, control, hint) {
  return el('div', { class: 'cm-field' }, [
    el('label', { class: 'cm-label', for: id }, label),
    control,
    hint ? el('p', { id: `${id}-hint`, class: 'scope-note' }, hint) : null,
  ]);
}

function textInput(id, value, attrs = {}) {
  const node = el('input', { id, class: 'cm-input', type: 'text', ...attrs });
  node.value = value ?? '';
  return node;
}

function selectInput(id, options, value, attrs = {}) {
  const node = el('select', { id, class: 'cm-select', ...attrs }, options.map(([v, text]) => el('option', { value: v }, text)));
  node.value = value;
  return node;
}

function openAiPanel(panel) {
  const status = liveStatus();
  const GROUPS = [
    { id: 'teamScan', label: L('Soi đội từ ảnh', '看图识阵') },
    { id: 'rosterRecommend', label: L('Gợi ý đội (quét tướng, chiến pháp, đội đã build)', '阵容推荐（扫描武将、战法、已配队伍）') },
    { id: 'explainSubstitute', label: L('Giải thích món bù', '替代战法说明') },
    { id: 'battleReport', label: L('Đọc ảnh chiến báo', '识别战报图片') },
  ];
  const note = el('p', { class: 'scope-note' }, L(
    'Nhà cung cấp giữ endpoint và API key dùng chung. Mỗi tính năng có chuỗi riêng: thứ tự là thứ tự ưu tiên, mắt xích trên lỗi (sai key, hết tiền, quá tải, máy chủ lỗi) thì tự chuyển sang mắt xích kế cho tới khi hết trần tổng thời gian. Bấm Lưu để áp dụng cả hai phần; có hiệu lực trong khoảng 1 phút.',
    '服务商保存共用的 endpoint 和 API 密钥。每个功能有自己的链：顺序即优先级，上一环出错（密钥错误、余额不足、过载、服务器错误）时自动切换到下一环，直到用完总时限。点击“保存”同时应用两部分，约 1 分钟内生效。',
  ));
  const warning = el('p', { class: 'cm-notice', hidden: '' }, L(
    'Chưa tính năng nào có mắt xích chạy được — mọi tính năng AI đang tạm dừng.',
    '没有任何功能有可用的链节——所有 AI 功能已暂停。',
  ));
  const providersTitle = el('h2', { id: 'cm-ai-providers-title', class: 'cm-title' }, L('Nhà cung cấp', '服务商'));
  const list = el('ol', { class: 'cm-post-list', 'aria-labelledby': 'cm-ai-providers-title' });
  const editorSlot = el('div');
  const groupsTitle = el('h2', { id: 'cm-ai-groups-title', class: 'cm-title' }, L('Tính năng', '功能'));
  const groupsNode = el('div', { class: 'cm-ai-groups' });
  // Chưa tải được cấu hình thì không cho Thêm/Lưu (tránh ghi đè cấu hình thật bằng cấu hình rỗng).
  const addButton = el('button', { class: 'ana-btn', type: 'button', disabled: '' }, L('Thêm nhà cung cấp', '添加服务商'));
  const saveButton = el('button', { class: 'ana-btn primary', type: 'button', disabled: '' }, L('Lưu', '保存'));
  // Dữ liệu server (catalog mẫu, mức effort theo kiểu, nhóm cần ảnh) + bản đang sửa, giữ trong bộ nhớ tới lần Lưu.
  let presets = [];
  let effortLevels = {};
  let needsVision = {};
  // Mỗi nhà cung cấp: dữ liệu server (keyLast4) + `apiKey` vừa gõ.
  let items = [];
  let groups = {};

  const markDirty = (extra = '') => status.set(`${extra}${L('Có thay đổi chưa lưu — bấm Lưu để áp dụng.', '有未保存的更改——点击“保存”后生效。')}`);
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
      const action = (name, text, attrs = {}) => el('button', { class: 'cm-text-btn', type: 'button', dataset: { action: name }, ...attrs }, text);
      const up = action('up', '↑', { 'aria-label': L(`Đưa ${item.label} lên trên`, `上移 ${item.label}`) });
      const down = action('down', '↓', { 'aria-label': L(`Đưa ${item.label} xuống dưới`, `下移 ${item.label}`) });
      up.disabled = index === 0;
      down.disabled = index === last;
      const toggle = action('toggle', item.enabled ? L('Tắt', '停用') : L('Bật', '启用'));
      const edit = el('button', { class: 'ana-btn', type: 'button', dataset: { action: 'edit' } }, L('Sửa', '编辑'));
      const remove = action('remove', L('Xoá', '删除'), { class: 'cm-text-btn cm-danger' });
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
      return el('li', { class: 'cm-post-row cm-ai-row', dataset: { index: String(index) } }, [
        el('div', { class: 'cm-post-main' }, [
          el('p', { class: 'cm-post-title' }, `${index + 1}. ${item.label}`),
          el('p', { class: 'cm-report-meta' }, [
            el('span', { class: 'cm-badge', dataset: { status: item.enabled ? 'approved' : 'pending' } }, item.enabled ? L('Đang bật', '已启用') : L('Đang tắt', '已停用')),
            el('span', {}, presetLabel),
            el('code', {}, item.endpoint),
            el('span', {}, L(`${modelsOf(item).length} model`, `${modelsOf(item).length} 个模型`)),
            el('span', {}, key),
          ]),
        ]),
        el('div', { class: 'cm-ai-actions' }, [up, down, toggle, edit, remove]),
      ]);
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
    const action = (name, text, label, attrs = {}) =>
      el('button', { class: 'cm-text-btn', type: 'button', dataset: { action: name }, 'aria-label': label, ...attrs }, text);
    const up = action('up', '↑', L(`Đưa mắt xích ${index + 1} lên trên`, `上移第 ${index + 1} 环`));
    const down = action('down', '↓', L(`Đưa mắt xích ${index + 1} xuống dưới`, `下移第 ${index + 1} 环`));
    const remove = action('remove', L('Bỏ', '移除'), L(`Bỏ mắt xích ${index + 1}`, `移除第 ${index + 1} 环`), { class: 'cm-text-btn cm-danger' });
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
    return el('li', { class: 'cm-post-row cm-ai-row cm-ai-link', dataset: { link: String(index) } }, [
      el('span', { class: 'cm-post-title' }, `${index + 1}.`),
      formField(`${prefix}-provider`, L('Nhà cung cấp', '服务商'), providerSelect),
      formField(`${prefix}-model`, L('Model', '模型'), modelSelect),
      formField(`${prefix}-effort`, L('Effort', '推理强度'), effortSelect),
      el('div', { class: 'cm-ai-actions' }, [up, down, remove]),
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
    const add = el('button', { class: 'ana-btn', type: 'button', dataset: { action: 'add-link' } }, L('Thêm mắt xích', '添加链节'));
    add.disabled = group.chain.length >= AI_MAX_CHAIN || !firstChoice();
    add.addEventListener('click', () => {
      group.chain.push(firstChoice());
      markDirty();
      paintGroups(`[data-group="${id}"] [data-link="${group.chain.length - 1}"] [data-field="provider"]`);
    });
    const copy = el('button', { class: 'cm-text-btn', type: 'button', dataset: { action: 'copy' } }, L('Áp cho mọi nhóm', '应用到所有功能'));
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
    return el('section', { class: 'cm-ai-editor cm-ai-group', dataset: { group: id }, 'aria-labelledby': titleId }, [
      el('h3', { id: titleId, class: 'cm-post-title' }, label),
      el('p', { class: 'cm-report-meta' }, [
        el('span', { class: 'cm-badge', dataset: { status: runs ? 'approved' : 'rejected' } }, runs ? L('Chạy được', '可运行') : L('Chưa cấu hình — tính năng báo lỗi', '未配置——功能将报错')),
        needsVision[id] ? el('span', {}, L('Chỉ model nhận ảnh', '仅支持图片的模型')) : null,
      ]),
      group.chain.length
        ? el('ol', { class: 'cm-post-list', 'aria-label': L(`Chuỗi của ${label}`, `${label} 的调用链`) }, group.chain.map((link, index) => linkRow(id, link, index)))
        : null,
      el('div', { class: 'cm-field-grid' }, [
        formField(`cm-ai-${id}-timeout`, L('Timeout mỗi lượt (giây)', '单次超时（秒）'), timeout),
        formField(`cm-ai-${id}-budget`, L('Trần tổng (giây)', '总时限（秒）'), budget),
      ]),
      el('div', { class: 'cm-form-row' }, [add, copy]),
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
    const modelId = textInput(`${prefix}-id`, model.modelId, { maxlength: '120', spellcheck: 'false' });
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
      return el('label', { class: 'cm-check', for: box.id }, [box, effortLabel(level)]);
    });
    const remove = el('button', { class: 'cm-text-btn cm-danger', type: 'button', 'aria-label': L(`Bỏ model ${index + 1}`, `移除模型 ${index + 1}`) }, L('Bỏ', '移除'));
    remove.addEventListener('click', () => {
      extras.splice(index, 1);
      repaint(extras.length ? `#cm-ai-extra-${Math.min(index, extras.length - 1)}-id` : '#cm-ai-extra-add');
    });
    return el('li', { class: 'cm-post-row cm-ai-row cm-ai-model' }, [
      formField(`${prefix}-id`, L('Model id', '模型 ID'), modelId),
      formField(`${prefix}-style`, L('Kiểu tham số suy luận', '推理参数类型'), style),
      el('fieldset', { class: 'cm-ai-efforts' }, [el('legend', { class: 'cm-label' }, L('Mức effort nhận được', '支持的推理强度')), ...efforts]),
      el('label', { class: 'cm-check', for: vision.id }, [vision, L('Nhận ảnh', '支持图片')]),
      el('div', { class: 'cm-ai-actions' }, [remove]),
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
      type: 'url', inputmode: 'url', maxlength: '500', required: '', spellcheck: 'false',
    });
    const apiKey = textInput('cm-ai-key', '', {
      type: 'password', autocomplete: 'new-password', maxlength: '500', spellcheck: 'false', 'aria-describedby': 'cm-ai-key-hint',
    });
    const enabled = el('input', { id: 'cm-ai-enabled', type: 'checkbox' });
    enabled.checked = current ? current.enabled : true;
    const catalogTitle = el('h3', { id: 'cm-ai-catalog-title', class: 'cm-label' }, L('Model sẵn có', '内置模型'));
    const catalog = el('ul', { class: 'cm-ai-catalog', 'aria-labelledby': 'cm-ai-catalog-title' });
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
    const extrasList = el('ul', { class: 'cm-post-list', 'aria-labelledby': 'cm-ai-extra-title' });
    const addExtra = el('button', { id: 'cm-ai-extra-add', class: 'ana-btn', type: 'button' }, L('Thêm model', '添加模型'));
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
    const done = el('button', { class: 'ana-btn primary', type: 'submit' }, L('Xong', '完成'));
    const cancel = el('button', { class: 'ana-btn', type: 'button' }, L('Huỷ', '取消'));
    const form = el('form', { class: 'cm-post-form cm-ai-editor', novalidate: '' }, [
      el('h2', { class: 'cm-title' }, current ? L('Sửa nhà cung cấp', '编辑服务商') : L('Nhà cung cấp mới', '新服务商')),
      el('div', { class: 'cm-field-grid' }, [
        formField('cm-ai-preset', L('Endpoint mẫu', '接口模板'), presetSelect),
        formField('cm-ai-label', L('Nhãn', '名称'), label),
      ]),
      formField('cm-ai-endpoint', L('Endpoint', 'Endpoint'), endpoint),
      formField('cm-ai-key', L('API key', 'API 密钥'), apiKey, keyHint),
      el('label', { class: 'cm-check', for: 'cm-ai-enabled' }, [enabled, L('Bật nhà cung cấp này', '启用此服务商')]),
      catalogTitle,
      catalog,
      el('h3', { id: 'cm-ai-extra-title', class: 'cm-label' }, L('Model tự thêm', '自定义模型')),
      el('p', { class: 'scope-note' }, L(
        'Model id theo tài liệu nhà cung cấp (API Chat Completions OpenAI-compatible). Đánh dấu Nhận ảnh chỉ khi model đọc được ảnh.',
        '按服务商文档填写模型 ID（兼容 OpenAI Chat Completions 接口）。仅在模型能识别图片时勾选“支持图片”。',
      )),
      extrasList,
      el('div', { class: 'cm-form-row' }, [addExtra]),
      el('div', { class: 'cm-form-row' }, [cancel, done]),
    ]);
    paintExtras();
    const close = (focusSelector) => {
      editorSlot.replaceChildren();
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
      load(body);
      status.set(L('Đã lưu. Có hiệu lực trong khoảng 1 phút.', '已保存，约 1 分钟内生效。'));
    } catch (error) {
      status.set(describeError(error), 'error');
    } finally {
      saveButton.disabled = false;
    }
  });

  panel.append(
    note,
    warning,
    status,
    providersTitle,
    list,
    editorSlot,
    el('div', { class: 'cm-form-row' }, [addButton]),
    groupsTitle,
    groupsNode,
    el('div', { class: 'cm-form-row' }, [saveButton]),
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

function openPostsPanel(panel) {
  const status = liveStatus();
  const view = el('div', { class: 'cm-posts-view' });
  panel.append(status, view);

  async function showList(focusTarget) {
    const createButton = el('button', { class: 'ana-btn primary', type: 'button' }, L('Viết bài mới', '写新文章'));
    createButton.addEventListener('click', () => showEditor(emptyPost()));
    const table = el('div', { class: 'cm-post-list-wrap' });
    view.replaceChildren(el('div', { class: 'cm-form-row' }, [createButton]), table);
    view.setAttribute('aria-busy', 'true');
    try {
      const body = await api('/api/admin/posts');
      const posts = Array.isArray(body?.items) ? body.items : [];
      if (!posts.length) {
        table.replaceChildren(el('p', { class: 'scope-note cm-empty' }, L('Chưa có bài viết nào.', '还没有文章。')));
      } else {
        table.replaceChildren(el('ul', { class: 'cm-post-list' }, posts.map((post) => {
          const edit = el('button', { class: 'ana-btn', type: 'button' }, L('Sửa', '编辑'));
          edit.addEventListener('click', () => showEditor(post));
          return el('li', { class: 'cm-post-row' }, [
            el('div', { class: 'cm-post-main' }, [
              el('p', { class: 'cm-post-title' }, String(post.title || post.slug || '')),
              el('p', { class: 'cm-report-meta' }, [
                el('span', { class: 'cm-badge', dataset: { status: post.status === 'published' ? 'approved' : 'pending' } }, statusLabel(post)),
                el('span', { lang: post.lang === 'zh' ? 'zh-Hans' : 'vi' }, post.lang === 'zh' ? '中文' : 'Tiếng Việt'),
                el('code', {}, String(post.slug || '')),
                timeNode(post.updatedAt),
              ]),
            ]),
            edit,
          ]);
        })));
      }
    } catch (error) {
      table.replaceChildren(el('p', { class: 'cm-notice' }, describeError(error)));
    } finally {
      view.removeAttribute('aria-busy');
    }
    (focusTarget ? view.querySelector(focusTarget) : null)?.focus();
  }

  function showEditor(initial) {
    let post = { ...emptyPost(), ...initial };
    const field = (id, label, control, hint) => el('div', { class: 'cm-field' }, [
      el('label', { class: 'cm-label', for: id }, label),
      control,
      hint ? el('p', { id: `${id}-hint`, class: 'scope-note' }, hint) : null,
    ]);
    const input = (id, value, attrs = {}) => {
      const node = el('input', { id, class: 'cm-input', type: 'text', ...attrs });
      node.value = value ?? '';
      return node;
    };
    const langSelect = el('select', { id: 'cm-post-lang', class: 'cm-select' }, [
      el('option', { value: 'vi' }, 'Tiếng Việt'),
      el('option', { value: 'zh' }, '中文'),
    ]);
    langSelect.value = post.lang === 'zh' ? 'zh' : 'vi';
    const translationKey = input('cm-post-translation', post.translationKey, { maxlength: '100', 'aria-describedby': 'cm-post-translation-hint' });
    const slug = input('cm-post-slug', post.slug, { maxlength: '101', required: '', pattern: SLUG_PATTERN.source, 'aria-describedby': 'cm-post-slug-hint' });
    const title = input('cm-post-title', post.title, { maxlength: '200', required: '' });
    const description = el('textarea', { id: 'cm-post-description', class: 'cm-textarea', rows: '2', maxlength: '300' });
    description.value = post.description || '';
    const tags = input('cm-post-tags', (post.tags || []).join(', '), { 'aria-describedby': 'cm-post-tags-hint' });

    // Ảnh bìa: tải lên riêng, form chỉ giữ URL `/api/media/...` trả về.
    let coverImage = post.coverImage || null;
    const coverPreview = el('div', { class: 'cm-cover-preview' });
    const coverFile = el('input', { id: 'cm-post-cover', class: 'cm-file', type: 'file', accept: 'image/jpeg,image/png,image/webp' });
    const paintCover = () => {
      if (!coverImage) {
        coverPreview.replaceChildren(el('p', { class: 'scope-note' }, L('Chưa có ảnh bìa.', '尚未设置封面。')));
        return;
      }
      const remove = el('button', { class: 'cm-text-btn', type: 'button' }, L('Bỏ ảnh bìa', '移除封面'));
      remove.addEventListener('click', () => {
        coverImage = null;
        paintCover();
        coverFile.focus();
      });
      coverPreview.replaceChildren(
        el('img', { class: 'cm-cover-image', src: coverImage, alt: L('Ảnh bìa', '封面图') }),
        el('code', {}, coverImage),
        remove,
      );
    };
    paintCover();
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

    const bodyInput = el('textarea', { id: 'cm-post-body', class: 'cm-textarea cm-markdown-input', rows: '18', spellcheck: 'true' });
    bodyInput.value = post.bodyMarkdown || '';
    const preview = el('div', { class: 'cm-markdown-preview', 'aria-live': 'off' });
    const paintPreview = () => preview.replaceChildren(renderMarkdown(bodyInput.value));
    paintPreview();
    let previewTimer = 0;
    bodyInput.addEventListener('input', () => {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(paintPreview, 150);
    });

    // FAQ: danh sách cặp hỏi/đáp thêm/xoá được.
    const faqList = el('ol', { class: 'cm-faq-list' });
    let faqSeq = 0;
    const addFaq = (entry = { q: '', a: '' }, focus = false) => {
      faqSeq += 1;
      const qId = `cm-faq-q-${faqSeq}`;
      const aId = `cm-faq-a-${faqSeq}`;
      const q = input(qId, entry.q, { maxlength: '300' });
      q.dataset.faq = 'q';
      const a = el('textarea', { id: aId, class: 'cm-textarea', rows: '2', maxlength: '2000' });
      a.dataset.faq = 'a';
      a.value = entry.a || '';
      const remove = el('button', { class: 'cm-text-btn', type: 'button' }, L('Xoá câu hỏi', '删除问题'));
      const row = el('li', { class: 'cm-faq-row' }, [
        field(qId, L('Câu hỏi', '问题'), q),
        field(aId, L('Trả lời', '回答'), a),
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
    const addFaqButton = el('button', { class: 'ana-btn', type: 'button' }, L('Thêm câu hỏi', '添加问题'));
    addFaqButton.addEventListener('click', () => addFaq(undefined, true));
    for (const entry of Array.isArray(post.faq) ? post.faq : []) addFaq(entry);

    const heading = el('h2', { class: 'cm-title' }, post.id ? L('Sửa bài viết', '编辑文章') : L('Bài viết mới', '新文章'));
    const back = el('button', { class: 'ana-btn', type: 'button' }, L('Về danh sách', '返回列表'));
    const save = el('button', { class: 'ana-btn', type: 'submit', value: 'save' }, L('Lưu nháp', '保存草稿'));
    const publishToggle = el('button', { class: 'ana-btn primary', type: 'button' });
    const remove = el('button', { class: 'cm-text-btn cm-danger', type: 'button' }, L('Xoá bài', '删除文章'));
    const paintButtons = () => {
      publishToggle.textContent = post.status === 'published' ? L('Gỡ xuất bản', '取消发布') : L('Xuất bản', '发布');
      remove.hidden = !post.id;
      save.textContent = post.status === 'published' ? L('Lưu thay đổi', '保存修改') : L('Lưu nháp', '保存草稿');
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
      // PUT bài đã xuất bản gọi lại deploy hook: trả `deploy` để báo kết quả build lại.
      return { deploy: saved?.deploy ?? null };
    };

    const busy = (flag) => {
      for (const button of [save, publishToggle, remove]) button.disabled = flag;
    };

    const form = el('form', { class: 'cm-post-form', novalidate: '' }, [
      el('div', { class: 'cm-field-grid' }, [
        field('cm-post-lang', L('Ngôn ngữ', '语言'), langSelect),
        field('cm-post-slug', 'Slug', slug, L('Ví dụ: doi-hinh-mua-s18. Duy nhất trong cùng ngôn ngữ.', '例如：doi-hinh-mua-s18。同一语言内必须唯一。')),
        field('cm-post-translation', L('Khoá bản dịch', '译文关联键'), translationKey, L('Đặt giống nhau cho bản Việt và bản Trung của cùng một bài.', '同一篇文章的越南语版与中文版填写相同的值。')),
      ]),
      field('cm-post-title', L('Tiêu đề', '标题'), title),
      field('cm-post-description', L('Mô tả ngắn (SEO)', '简短描述（SEO）'), description),
      field('cm-post-tags', L('Thẻ', '标签'), tags, L('Ngăn bằng dấu phẩy.', '用逗号分隔。')),
      field('cm-post-cover', L('Ảnh bìa', '封面图'), coverFile),
      coverPreview,
      el('div', { class: 'cm-markdown' }, [
        field('cm-post-body', L('Nội dung (Markdown)', '正文（Markdown）'), bodyInput),
        el('div', { class: 'cm-field' }, [
          el('p', { class: 'cm-label', id: 'cm-post-preview-label' }, L('Xem trước', '预览')),
          preview,
        ]),
      ]),
      el('fieldset', { class: 'cm-faq' }, [
        el('legend', { class: 'cm-label' }, L('Câu hỏi thường gặp (FAQ)', '常见问题（FAQ）')),
        faqList,
        addFaqButton,
      ]),
      el('div', { class: 'cm-form-row' }, [back, remove, save, publishToggle]),
    ]);
    preview.setAttribute('aria-labelledby', 'cm-post-preview-label');
    preview.setAttribute('role', 'region');

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
              : L('Đã lưu bài viết.', '文章已保存。'));
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
        status.set(L('Đã xoá bài viết.', '文章已删除。'));
        await showList('button');
      } catch (error) {
        status.set(describeError(error), 'error');
        busy(false);
      }
    });

    view.replaceChildren(heading, form);
    heading.tabIndex = -1;
    heading.focus();
  }

  showList();
}

/* ---------- Khởi tạo ---------- */

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
  const view = tabs([
    { id: 'reports', label: L('Duyệt chiến báo', '审核战报'), open: openReportsPanel },
    { id: 'posts', label: L('Bài viết', '文章'), open: openPostsPanel },
    { id: 'comments', label: L('Bình luận', '评论'), open: openCommentsPanel },
    { id: 'feedback', label: L('Góp ý', '意见反馈'), open: openFeedbackPanel },
    { id: 'ai', label: 'AI', open: openAiPanel },
  ]);
  mount.replaceChildren(view.node);
  view.start();
}

initCommunityAdmin();
