// Hộp xác nhận trong trang (component `hop-xac-nhan` trong docs/design/so-binh-phap/tokens.json), thay cho
// `window.confirm` ở thao tác xoá / không hoàn tác được. `<dialog>` mở bằng `showModal()` nên trình duyệt làm trơ
// phần còn lại của trang và Escape bắn `cancel`. Helper thêm:
// - nhãn cho trình đọc màn hình: `role="alertdialog"` (hoặc `dialog`), `aria-labelledby` = tiêu đề,
//   `aria-describedby` = mô tả, `aria-busy` khi đang chạy, lỗi đọc qua `role="alert"`;
// - focus mặc định vào nút Huỷ (lựa chọn an toàn), Tab / Shift+Tab vòng trong hộp, đóng thì trả focus về phần tử đã mở;
// - chạy thao tác ngay trong hộp: lỗi hiện tại chỗ, hộp giữ mở để thử lại hoặc Huỷ.
import { L } from "./i18n.js";
import { el } from "./render.js";

/** Thời gian đầu sau khi mở hộp bỏ qua bấm nền (cú bấm thứ hai của bấm đúp nút mở). */
const BACKDROP_GRACE_MS = 300;

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

let sequence = 0;

/**
 * Mở hộp xác nhận. Trả `Promise<boolean>`: `true` khi người dùng xác nhận và `onConfirm` (nếu có) thành công;
 * `false` khi Huỷ, Escape hoặc bấm nền.
 *
 * - `title`: câu hỏi (tiêu đề hộp), ví dụ `L("Xoá đội “…”?", "删除阵容“…”？")`.
 * - `message`: chuỗi hoặc Node mô tả hậu quả; bỏ trống thì không có `aria-describedby`.
 * - `danger` (mặc định `true`): nút xác nhận nền đỏ + `role="alertdialog"`; `false` dùng nút chính + `role="dialog"`.
 * - `onConfirm` (tuỳ chọn, có thể async): chạy khi bấm xác nhận, hai nút khoá trong lúc chạy. Trả chuỗi khác rỗng
 *   hoặc `false`, hoặc ném lỗi = thất bại: chuỗi đó (hoặc `errorMessage`) hiện ở dòng lỗi, hộp không đóng.
 *   Trả gì khác (kể cả `undefined`) = thành công, hộp đóng.
 */
export function confirmInPage({
  title,
  message = "",
  confirmLabel = L("Xoá", "删除"),
  cancelLabel = L("Huỷ", "取消"),
  danger = true,
  onConfirm,
  errorMessage = L("Chưa thực hiện được. Thử lại sau.", "操作未完成，请稍后重试。"),
} = {}) {
  const id = `hop-xac-nhan-${++sequence}`;
  const opener = document.activeElement;
  const heading = el("h2", { id: `${id}-tieu-de`, class: "hop-xac-nhan-tieu-de" }, title);
  const description = message ? el("p", { id: `${id}-mo-ta`, class: "hop-xac-nhan-mo-ta" }, message) : null;
  const error = el("p", { class: "hop-xac-nhan-loi", role: "alert", hidden: "" });
  const cancel = el("button", { type: "button", class: "ana-btn" }, cancelLabel);
  const confirm = el("button", { type: "button", class: danger ? "ana-btn hop-xac-nhan-xoa" : "ana-btn primary" }, confirmLabel);
  const dialog = el(
    "dialog",
    {
      class: "hop-xac-nhan",
      role: danger ? "alertdialog" : null,
      "aria-modal": "true",
      "aria-labelledby": heading.id,
      "aria-describedby": description?.id ?? null,
    },
    [el("div", { class: "hop-xac-nhan-than" }, [heading, description, error, el("div", { class: "hop-xac-nhan-nut" }, [cancel, confirm])])],
  );

  return new Promise((resolve) => {
    let busy = false;
    let confirmed = false;
    let settled = false;
    const settle = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const close = () => {
      if (dialog.open) dialog.close();
      else dialog.dispatchEvent(new Event("close"));
    };
    const setBusy = (value) => {
      busy = value;
      // `aria-disabled` thay cho `disabled`: nút đang giữ focus không bị đẩy focus ra `<body>`.
      for (const button of [cancel, confirm]) button.toggleAttribute("aria-disabled", value);
      if (value) dialog.setAttribute("aria-busy", "true");
      else dialog.removeAttribute("aria-busy");
    };

    cancel.addEventListener("click", () => {
      if (!busy) close();
    });

    confirm.addEventListener("click", async () => {
      if (busy) return;
      if (!onConfirm) {
        confirmed = true;
        close();
        return;
      }
      error.hidden = true;
      error.textContent = "";
      setBusy(true);
      let failure = null;
      try {
        const result = await onConfirm();
        if (result === false) failure = errorMessage;
        else if (typeof result === "string" && result) failure = result;
      } catch {
        failure = errorMessage;
      }
      setBusy(false);
      // Hộp đã bị đóng trong lúc chạy (trình duyệt cho Escape lần hai đóng hẳn): kết quả thao tác vẫn là câu trả lời.
      if (!dialog.isConnected) {
        settle(!failure);
        return;
      }
      if (failure) {
        error.textContent = failure;
        error.hidden = false;
        return;
      }
      confirmed = true;
      close();
    });

    // Escape: bỏ qua khi đang chạy thao tác, còn lại đóng như Huỷ.
    dialog.addEventListener("cancel", (event) => {
      if (busy) event.preventDefault();
    });

    // Thân hộp phủ kín `<dialog>` (padding 0): click trúng chính `<dialog>` là click vào nền. Chỉ đóng khi cả
    // `pointerdown` lẫn `click` cùng trúng nền và hộp đã mở quá BACKDROP_GRACE_MS: bấm đúp nút mở làm cú bấm thứ
    // hai rơi xuống `::backdrop` ngay sau khi hộp hiện, không được tính là bấm nền; kéo chọn chữ từ trong hộp ra
    // nền cũng không đóng hộp.
    let openedAt = Infinity;
    let pressedBackdrop = false;
    dialog.addEventListener("pointerdown", (event) => {
      pressedBackdrop = event.target === dialog && performance.now() - openedAt >= BACKDROP_GRACE_MS;
    });
    dialog.addEventListener("click", (event) => {
      const onBackdrop = event.target === dialog && pressedBackdrop;
      pressedBackdrop = false;
      if (onBackdrop && !busy) close();
    });

    // Tab vòng trong hộp (bổ sung cho `showModal`, vốn để Tab thoát ra thanh địa chỉ của trình duyệt).
    dialog.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;
      const items = [...dialog.querySelectorAll(FOCUSABLE)].filter((node) => !node.hidden && !node.disabled);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    dialog.addEventListener("close", () => {
      dialog.remove();
      if (opener?.isConnected) opener.focus?.();
      if (!busy) settle(confirmed);
    });

    document.body.append(dialog);
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    openedAt = performance.now();
    cancel.focus();
  });
}
