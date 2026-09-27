// Khối hành động dùng chung cho ba trang chi tiết đội: nút sao chép URL của trang.
// Không tự đọc dữ liệu và không dẫn link ra ngoài.

import { el, icon, svgNode } from './render.js';
import { L } from './i18n.js';

const COPY_LINK_LABEL = L('Sao chép liên kết đội', '复制阵容链接');
const COPY_FALLBACK_LABEL = L('Liên kết đội', '阵容链接');
const COPIED_MESSAGE = L('Đã sao chép liên kết', '链接已复制');
const COPY_FAILED_MESSAGE = L('Không sao chép tự động được. Liên kết đã được chọn sẵn để bạn tự sao chép.', '无法自动复制。链接已为你选中，请手动复制。');

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

const copyIcon = () => icon([
  svgNode('path', {d: 'M10 14a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1l-1 1'}),
  svgNode('path', {d: 'M14 10a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1-1'}),
]);

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
 * Nội dung panel điểm: nút sao chép, ô chọn sẵn và vùng trạng thái.
 * Trả fragment để entry page tự gắn vào `#team-detail-actions` của shell.
 */
export function detailPanelActions() {
  const {button, fallback, status} = copyControl();
  return el('div', {class: 'detail-actions-body'}, [button, fallback, status]);
}
