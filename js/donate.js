// Hộp thoại "Ủng hộ tác giả" ở footer (src/layouts/SiteLayout.astro): `<dialog>` native mở bằng
// `showModal()` nên trình duyệt tự giam focus trong hộp thoại và Escape tự đóng. Ở đây chỉ thêm:
// hiện nút mở (không có JS thì nút ẩn), đóng bằng nút ✕ hoặc bấm nền, và trả focus về nút đã mở.

/**
 * Gắn hành vi cho `#donate-dialog` và mọi nút `[data-donate-open]`.
 * Trình duyệt không có `HTMLDialogElement.showModal` thì giữ nút ẩn (không có đường mở hỏng).
 */
export function initDonateDialog(doc = document) {
  const dialog = doc.getElementById('donate-dialog');
  if (!dialog || typeof dialog.showModal !== 'function') return null;
  let opener = null;

  for (const button of doc.querySelectorAll('[data-donate-open]')) {
    button.hidden = false;
    button.addEventListener('click', () => {
      if (dialog.open) return;
      opener = button;
      dialog.showModal();
    });
  }

  // Thân hộp thoại phủ kín `<dialog>` (padding 0): click trúng chính `<dialog>` là click vào nền.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog || event.target.closest?.('[data-donate-close]')) dialog.close();
  });

  // `close` bắn cho cả Escape, nút ✕ và bấm nền: luôn trả focus về đúng nút đã mở.
  dialog.addEventListener('close', () => {
    opener?.focus();
    opener = null;
  });

  return dialog;
}

initDonateDialog();
