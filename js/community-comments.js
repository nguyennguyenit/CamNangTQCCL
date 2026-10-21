// Bình luận dưới trang chi tiết đội. Chỉ hiện bình luận cùng `lang` với trang (vi/zh không trộn).
// Nội dung người dùng luôn là text node (`el`), không bao giờ qua innerHTML.

import { L } from './i18n.js';
import { el } from './render.js';
import {
  COMMENT_MAX_LENGTH,
  api,
  avatar,
  describeError,
  displayName,
  langTag,
  liveStatus,
  signInPrompt,
  timeNode,
} from './community-api.js';

function commentItem(comment, { onDelete, tagged = false }) {
  const deleteButton = comment.canDelete
    ? el('button', { class: 'cm-text-btn cm-comment-delete', type: 'button' }, L('Xoá', '删除'))
    : null;
  const item = el('li', { class: 'cm-comment', dataset: { commentId: String(comment.id) } }, [
    avatar(comment.author),
    el('div', { class: 'cm-comment-main' }, [
      el('p', { class: 'cm-comment-meta' }, [
        el('span', { class: 'cm-comment-author' }, displayName(comment.author)),
        tagged ? langTag(comment.lang) : null,
        timeNode(comment.createdAt),
      ]),
      el('p', { class: 'cm-comment-body' }, String(comment.body || '')),
      deleteButton,
    ]),
  ]);
  deleteButton?.addEventListener('click', () => onDelete(comment, item, deleteButton));
  return item;
}

/**
 * Khối bình luận. `user` null → mời đăng nhập thay cho ô nhập.
 * `sharedPool` (đội cộng đồng, kho chung vi/zh): không lọc theo `lang`, mỗi bình luận kèm nhãn `[VI]`/`[ZH]`;
 * bài mới vẫn gửi `lang` của trang.
 * Trả về element section để trang gắn vào.
 */
export function mountComments(container, { pageKey, lang, user, sharedPool = false }) {
  const titleId = 'cm-comments-title';
  const list = el('ol', { class: 'cm-comment-list', 'aria-labelledby': titleId });
  const empty = el('p', { class: 'scope-note cm-empty' }, L('Chưa có bình luận nào. Hãy là người đầu tiên!', '还没有评论，来发表第一条吧！'));
  const status = liveStatus();
  const moreButton = el('button', { class: 'ana-btn cm-more', type: 'button', hidden: '' }, L('Xem thêm bình luận', '查看更多评论'));
  let cursor = null;

  const refreshEmpty = () => {
    empty.hidden = list.childElementCount > 0;
  };

  const onDelete = async (comment, item, button) => {
    if (!window.confirm(L('Xoá bình luận này?', '确定删除这条评论吗？'))) return;
    button.disabled = true;
    try {
      await api(`/api/comments/${encodeURIComponent(comment.id)}`, { method: 'DELETE' });
      const next = item.nextElementSibling || item.previousElementSibling;
      item.remove();
      refreshEmpty();
      status.set(L('Đã xoá bình luận.', '评论已删除。'));
      (next?.querySelector('button, a') || textarea || moreButton).focus?.();
    } catch (error) {
      button.disabled = false;
      status.set(describeError(error), 'error');
    }
  };

  const append = (items) => {
    for (const comment of items) {
      if (!sharedPool && comment?.lang !== lang) continue;
      list.append(commentItem(comment, { onDelete, tagged: sharedPool }));
    }
    refreshEmpty();
  };

  const load = async () => {
    const params = new URLSearchParams({ page: pageKey, lang });
    if (cursor) params.set('cursor', cursor);
    const body = await api(`/api/comments?${params}`);
    append(Array.isArray(body?.items) ? body.items : []);
    cursor = typeof body?.nextCursor === 'string' && body.nextCursor ? body.nextCursor : null;
    moreButton.hidden = !cursor;
  };

  moreButton.addEventListener('click', async () => {
    moreButton.disabled = true;
    const before = list.childElementCount;
    try {
      await load();
      // Focus sang bình luận đầu tiên vừa nạp để người dùng bàn phím đọc tiếp.
      const first = list.children[before];
      if (first) {
        first.tabIndex = -1;
        first.focus();
      }
    } catch (error) {
      status.set(describeError(error), 'error');
    } finally {
      moreButton.disabled = false;
    }
  });

  let textarea = null;
  let composer;
  if (user) {
    const inputId = 'cm-comment-input';
    const counterId = 'cm-comment-counter';
    textarea = el('textarea', {
      id: inputId,
      class: 'cm-textarea',
      rows: '3',
      maxlength: String(COMMENT_MAX_LENGTH),
      required: '',
      'aria-describedby': counterId,
    });
    const counter = el('p', { id: counterId, class: 'cm-counter' });
    const updateCounter = () => {
      counter.textContent = L(
        `${textarea.value.length}/${COMMENT_MAX_LENGTH} ký tự`,
        `${textarea.value.length}/${COMMENT_MAX_LENGTH} 字`,
      );
    };
    updateCounter();
    textarea.addEventListener('input', updateCounter);
    const submit = el('button', { class: 'ana-btn primary', type: 'submit' }, L('Gửi bình luận', '发表评论'));
    composer = el('form', { class: 'cm-comment-form', novalidate: '' }, [
      el('label', { class: 'cm-label', for: inputId }, L('Viết bình luận', '写评论')),
      textarea,
      el('div', { class: 'cm-form-row' }, [counter, submit]),
    ]);
    composer.addEventListener('submit', async (event) => {
      event.preventDefault();
      const body = textarea.value.trim();
      if (!body) {
        status.set(L('Hãy nhập nội dung bình luận.', '请输入评论内容。'), 'error');
        textarea.focus();
        return;
      }
      submit.disabled = true;
      status.set(L('Đang gửi…', '正在发送…'));
      try {
        const created = await api('/api/comments', { method: 'POST', json: { page: pageKey, lang, body } });
        const comment = { ...created, lang: created?.lang || lang, author: created?.author || user, canDelete: created?.canDelete ?? true };
        list.prepend(commentItem(comment, { onDelete, tagged: sharedPool }));
        refreshEmpty();
        textarea.value = '';
        updateCounter();
        status.set(L('Đã đăng bình luận.', '评论已发表。'));
        textarea.focus();
      } catch (error) {
        status.set(describeError(error), 'error');
      } finally {
        submit.disabled = false;
      }
    });
  } else {
    composer = signInPrompt(L('Đăng nhập để bình luận.', '登录后即可评论。'));
  }

  const section = el('section', { class: 'cm-block cm-comments', 'aria-labelledby': titleId }, [
    el('h2', { id: titleId, class: 'cm-title' }, L('Bình luận', '评论')),
    composer,
    status,
    list,
    empty,
    moreButton,
  ]);
  container.append(section);
  return { section, load };
}
