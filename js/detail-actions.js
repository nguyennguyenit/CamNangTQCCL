// Khối hành động dùng chung cho ba trang chi tiết đội: link nguồn đã kiểm scheme và nút sao chép URL.
// Không tự đọc dữ liệu: caller đưa danh sách `{href, label}` đã qua `validateHttpSourceUrl`.

import { el, icon, svgNode } from './render.js';

const SOURCE_LINK_LABEL = 'Xem nguồn';
const COPY_LINK_LABEL = 'Sao chép liên kết đội';
const COPY_FALLBACK_LABEL = 'Liên kết đội';
const COPIED_MESSAGE = 'Đã sao chép liên kết';
const COPY_FAILED_MESSAGE = 'Không sao chép tự động được. Liên kết đã được chọn sẵn để bạn tự sao chép.';

/**
 * Lỗi mạng/HTTP khi tải dữ liệu chi tiết: fetch bị chặn (TypeError của trình duyệt) hoặc bộ nạp báo
 * `<đường dẫn>: <mã HTTP>`. Mọi lỗi khác (byte lệch pin, dữ liệu sai dạng, thiếu đội) là lỗi xác minh.
 */
export const isNetworkError = (error) => /Failed to fetch|NetworkError|load failed|: \d{3}$/i.test(error?.message || '');

/** URL để chia sẻ: chính trang chi tiết, bỏ `from` (trạng thái danh sách riêng của người gửi). */
function shareableUrl(href) {
  if (!href) return '';
  const url = new URL(href);
  url.searchParams.delete('from');
  return url.href;
}

const externalIcon = () => icon([
  svgNode('path', {d: 'M14 4h6v6'}),
  svgNode('path', {d: 'M20 4l-9 9'}),
  svgNode('path', {d: 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'}),
], {size: 15, stroke: 2});

const copyIcon = () => icon([
  svgNode('path', {d: 'M10 14a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1l-1 1'}),
  svgNode('path', {d: 'M14 10a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1-1'}),
]);

/** Một link nguồn ngoài đã kiểm scheme: mở thẻ mới, `rel` đầy đủ như quy ước hiện có. */
function sourceLink({href, label}) {
  return el('a', {
    class: 'detail-action detail-source-link',
    href,
    target: '_blank',
    rel: 'noopener noreferrer',
  }, [label || SOURCE_LINK_LABEL, externalIcon()]);
}

/**
 * Nút "Sao chép liên kết": ghi URL chia sẻ của trang đang xem (giữ `variant`, bỏ `from`) vào clipboard;
 * không có clipboard hoặc bị từ chối thì hiện ô chỉ đọc đã chọn sẵn URL và báo bằng `role="status"`,
 * không báo thành công giả.
 */
function copyControl() {
  const fallback = el('input', {
    id: 'team-copy-fallback', class: 'detail-copy-fallback', type: 'text',
    readonly: '', hidden: '', 'aria-label': COPY_FALLBACK_LABEL,
  });
  const status = el('p', {
    id: 'team-copy-status', class: 'detail-copy-status',
    role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true',
  });
  const button = el('button', {
    id: 'team-copy-link', class: 'detail-copy-btn', type: 'button', 'aria-label': COPY_LINK_LABEL,
  }, copyIcon());
  button.addEventListener('click', async () => {
    const href = shareableUrl(globalThis.location?.href);
    fallback.value = href;
    try {
      if (typeof navigator?.clipboard?.writeText !== 'function') throw new Error('clipboard-unavailable');
      await navigator.clipboard.writeText(href);
      fallback.hidden = true;
      status.textContent = COPIED_MESSAGE;
    } catch {
      fallback.hidden = false;
      fallback.focus();
      fallback.select();
      status.textContent = COPY_FAILED_MESSAGE;
    }
  });
  return {button, fallback, status};
}

/**
 * Nội dung panel điểm: link nguồn (nếu có) rồi nút sao chép, ô chọn sẵn và vùng trạng thái.
 * Trả fragment để entry page tự gắn vào `#team-detail-actions` của shell.
 */
export function detailPanelActions({sources = []} = {}) {
  const {button, fallback, status} = copyControl();
  // Không render markdown lạ: mọi link đã được caller kiểm `http(s)` trước khi tới đây.
  const links = sources.filter(source => typeof source?.href === 'string' && source.href).map(sourceLink);
  return el('div', {class: 'detail-actions-body'}, [...links, button, fallback, status]);
}
