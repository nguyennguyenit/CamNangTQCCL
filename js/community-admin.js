// Trang /quan-tri/ (noindex): ba tab — "Duyệt chiến báo" (ảnh, dữ liệu AI đã xác nhận, duyệt / từ chối kèm lý do),
// "Bài viết" (danh sách, soạn/sửa Markdown có xem trước an toàn, FAQ, lưu nháp, xuất bản/gỡ xuất bản)
// và "Bình luận" (xoá bình luận vi phạm trên mọi trang).
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
  ]);
  mount.replaceChildren(view.node);
  view.start();
}

initCommunityAdmin();
