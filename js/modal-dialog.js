// Hộp thoại footer (Ủng hộ tác giả, Góp ý): `<dialog>` native mở bằng `showModal()` nên trình duyệt tự giam
// focus trong hộp thoại và Escape tự đóng. Ở đây chỉ thêm: hiện nút mở (không có JS thì nút ẩn), đóng bằng
// nút ✕ hoặc bấm nền, và trả focus về nút đã mở.

/**
 * Gắn hành vi cho `#<id>` và mọi nút `[data-<name>-open]`; nút đóng là `[data-<name>-close]`.
 * `onOpen` chạy mỗi lần hộp thoại mở. Trình duyệt không có `showModal` thì giữ nút ẩn (không có đường mở hỏng).
 */
export function initModalDialog(id, name, { doc = document, onOpen } = {}) {
  const dialog = doc.getElementById(id);
  if (!dialog || typeof dialog.showModal !== 'function') return null;
  let opener = null;

  for (const button of doc.querySelectorAll(`[data-${name}-open]`)) {
    button.hidden = false;
    button.addEventListener('click', () => {
      if (dialog.open) return;
      opener = button;
      dialog.showModal();
      onOpen?.(dialog);
    });
  }

  // Thân hộp thoại phủ kín `<dialog>` (padding 0): click trúng chính `<dialog>` là click vào nền.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog || event.target.closest?.(`[data-${name}-close]`)) dialog.close();
  });

  // `close` bắn cho cả Escape, nút ✕ và bấm nền: luôn trả focus về đúng nút đã mở.
  dialog.addEventListener('close', () => {
    opener?.focus();
    opener = null;
  });

  return dialog;
}
