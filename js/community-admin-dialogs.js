// Hộp thoại thao tác của /quan-tri/: `actionDialog` dùng chung (Người dùng, Đội cộng đồng — re-export qua
// js/community-admin-users.js) và hộp thoại Khoá tài khoản theo artboard AdminUserBanMoi (+ Mobile): thẻ thời hạn
// dạng radio, dòng "Tự mở khoá lúc …" theo thời hạn đang chọn, lý do bắt buộc có bộ đếm, nhãn nút theo thời hạn.
// Không có hiệu ứng khi nạp; import vòng với community-admin.js an toàn vì chỉ dùng hàm đã export lúc chạy.

import { L } from './i18n.js';
import { el } from './render.js';
import { describeError, displayName, formatDateTime } from './community-api.js';
import { button } from './community-admin.js';
import { admIcon, durationLabel, initialsAvatar } from './community-admin-audit.js';

export const REASON_MAX = 500;

/** Lỗi của thao tác trên một tài khoản: 403 `forbidden` ở đây là đích ngoài quyền (KDV khác, root, khoá của root). */
export function describeUserActionError(error) {
  return error?.code === 'forbidden' ? L('Bạn không có quyền thao tác trên tài khoản này.', '你无权对该账号执行此操作。') : describeError(error);
}

let dialogSeq = 0;

/**
 * Hộp thoại `<dialog>` native (kiểu `.footer-dialog`): tiêu đề, trường, nút Huỷ + nút xác nhận.
 * `submit()` chạy khi bấm xác nhận; lỗi hiện ở dòng `role=alert` của hộp thoại (người gọi tự báo + tải lại trạng thái),
 * hoặc đóng hộp thoại nếu `closeOnError` (lỗi đã báo ở dòng trạng thái của khu). `confirmDisabled` khoá nút xác nhận ban đầu.
 * Tuỳ chọn cho hộp thoại có đầu riêng: `headIcon` (ô icon cạnh tiêu đề), `subtitle` (node dưới tiêu đề), `lead` là
 * chuỗi hoặc node (được gắn làm mô tả của hộp thoại), `className`, `confirmVariant` (class nút xác nhận).
 */
export function actionDialog({
  title, lead, fields, submitLabel, danger = false, confirmDisabled = false, closeOnError = false, validate, submit, onClose,
  headIcon = null, subtitle = null, className = '', confirmVariant = null,
}) {
  const seq = ++dialogSeq;
  const titleId = `adm-dialog-title-${seq}`;
  const leadId = `adm-dialog-lead-${seq}`;
  const alert = el('p', { class: 'cm-status adm-status', role: 'alert', hidden: '' });
  alert.dataset.kind = 'error';
  const show = (message) => {
    alert.textContent = message;
    alert.hidden = !message;
  };
  const confirm = button(submitLabel, { variant: confirmVariant ?? (danger ? 'adm-btn-danger' : 'primary'), type: 'submit' });
  confirm.disabled = confirmDisabled;
  const cancel = button(L('Huỷ', '取消'));
  const heading = el('h2', { id: titleId, class: 'donate-dialog-title' }, title);
  const leadNode = lead == null || lead === '' ? null : lead.nodeType ? lead : el('p', { class: 'donate-dialog-lead' }, lead);
  if (leadNode) leadNode.id = leadId;
  const head = headIcon || subtitle
    ? el('div', { class: 'adm-dialog-head' }, [
      headIcon ? el('span', { class: 'adm-dialog-icon', 'aria-hidden': 'true' }, admIcon(headIcon, 22)) : null,
      el('div', { class: 'adm-dialog-heading' }, [heading, subtitle]),
    ])
    : heading;
  const form = el('form', { class: 'feedback-dialog-body', novalidate: '' }, [
    head,
    leadNode,
    ...fields,
    alert,
    el('div', { class: 'adm-actions' }, [cancel, confirm]),
  ]);
  const dialog = el('dialog', {
    class: `footer-dialog feedback-dialog adm-dialog ${className}`.trim(),
    'aria-labelledby': titleId,
    'aria-describedby': leadNode ? leadId : null,
  }, form);
  cancel.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    dialog.remove();
    onClose?.();
  });
  let submitting = false;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;
    const invalid = validate?.();
    if (invalid) {
      show(invalid);
      return;
    }
    show('');
    submitting = true;
    confirm.dataset.busy = '1';
    confirm.disabled = true;
    cancel.disabled = true;
    try {
      await submit();
      dialog.close();
    } catch (error) {
      submitting = false;
      delete confirm.dataset.busy;
      if (closeOnError) {
        dialog.close();
        return;
      }
      confirm.disabled = false;
      cancel.disabled = false;
      show(describeUserActionError(error));
    }
  });
  document.body.append(dialog);
  dialog.showModal();
  return { dialog, confirm };
}

/* ---------- Hộp thoại Khoá tài khoản ---------- */

/** Thời hạn khoá theo mã API (`BAN_DURATIONS` của community-worker/src/moderation.ts); `null` = vĩnh viễn. */
const BAN_SPANS = [['1d', 86_400_000], ['7d', 604_800_000], ['30d', 2_592_000_000], ['permanent', null]];
const DEFAULT_DURATION = '1d';
let banSeq = 0;

function confirmLabel(duration) {
  return duration === 'permanent' ? L('Khoá vĩnh viễn', '永久封禁') : L(`Khoá ${durationLabel(duration)}`, `封禁 ${durationLabel(duration)}`);
}

/** Câu hết hạn theo giờ địa phương của người xem nếu khoá ngay bây giờ. */
export function banUntilText(duration, now = Date.now()) {
  const span = BAN_SPANS.find(([value]) => value === duration)?.[1];
  if (span == null) return L('Không tự hết hạn; chỉ mở khoá bằng tay ở trang này.', '不会自动到期；只能在此页面手动解封。');
  const at = formatDateTime(now + span);
  return L(`Tự mở khoá lúc ${at} nếu khoá ngay bây giờ.`, `如果现在封禁，将于 ${at} 自动解封。`);
}

/**
 * Mở hộp thoại khoá `user`. `submit({ duration, reason })` gửi yêu cầu (ném lỗi để hộp thoại giữ mở và hiện lỗi);
 * `onClose` chạy khi hộp thoại đóng (trả focus).
 */
export function openBanDialog(user, { submit, onClose }) {
  const name = `adm-ban-duration-${++banSeq}`;
  const radios = BAN_SPANS.map(([value]) => el('input', { type: 'radio', name, value }));
  radios.find((radio) => radio.value === DEFAULT_DURATION).checked = true;
  const selected = () => radios.find((radio) => radio.checked)?.value || DEFAULT_DURATION;

  const untilText = el('span', {});
  const durations = el('fieldset', { class: 'adm-ban-dur-group' }, [
    el('legend', { class: 'adm-label' }, L('Thời hạn', '期限')),
    el('div', { class: 'adm-ban-dur-grid' }, radios.map((radio) => el('label', { class: 'adm-ban-dur' }, [radio, el('span', {}, durationLabel(radio.value))]))),
    el('p', { class: 'adm-ban-until', 'aria-live': 'polite' }, [admIcon('clock', 14), untilText]),
  ]);

  const reason = el('textarea', {
    id: 'adm-ban-reason',
    class: 'cm-textarea',
    rows: '3',
    maxlength: String(REASON_MAX),
    required: '',
    'aria-describedby': 'adm-ban-reason-hint',
  });
  const counter = el('span', { class: 'adm-ban-counter', 'aria-hidden': 'true' }, `0/${REASON_MAX}`);
  const reasonField = el('div', { class: 'adm-field' }, [
    el('label', { class: 'adm-label', for: 'adm-ban-reason' }, [L('Lý do', '理由'), el('span', { class: 'adm-required', 'aria-hidden': 'true' }, ' *')]),
    reason,
    el('div', { class: 'adm-ban-reason-foot' }, [
      el('p', { id: 'adm-ban-reason-hint', class: 'adm-hint' }, L(`Bắt buộc, tối đa ${REASON_MAX} ký tự. Người bị khoá sẽ thấy lý do này.`, `必填，最多 ${REASON_MAX} 个字符。被封禁者将看到此理由。`)),
      counter,
    ]),
  ]);

  const effects = el('div', { class: 'adm-ban-effects' }, [
    el('p', { class: 'adm-ban-effects-title' }, L('Người bị khoá sẽ:', '被封禁的用户将：')),
    el('ul', { class: 'adm-ban-effects-list' }, [
      ['signout', L('Bị đăng xuất.', '被强制下线。')],
      ['lock', L('Không đăng nhập lại được cho tới khi hết hạn hoặc được mở khoá.', '在到期或被解封之前无法再次登录。')],
      ['hidden', L('Bị ẩn nội dung công khai.', '公开内容将被隐藏。')],
    ].map(([glyph, text]) => el('li', {}, [el('span', { class: 'adm-ban-effects-icon' }, admIcon(glyph)), el('span', {}, text)]))),
  ]);

  const subtitle = el('p', { class: 'adm-dialog-sub' }, [
    initialsAvatar(user, 'sm'),
    el('strong', {}, displayName(user)),
    user.email ? el('span', { class: 'adm-dialog-sub-mail' }, String(user.email)) : null,
  ]);

  const { confirm } = actionDialog({
    title: L('Khoá tài khoản', '封禁账号'),
    headIcon: 'lock',
    subtitle,
    lead: effects,
    fields: [durations, reasonField],
    submitLabel: confirmLabel(DEFAULT_DURATION),
    confirmVariant: 'adm-btn-accent',
    className: 'adm-ban-dialog',
    validate: () => {
      const missing = !reason.value.trim();
      if (missing) {
        reason.setAttribute('aria-invalid', 'true');
        reason.focus();
      } else reason.removeAttribute('aria-invalid');
      return missing ? L('Cần nhập lý do khoá.', '请填写封禁理由。') : '';
    },
    submit: () => submit({ duration: selected(), reason: reason.value.trim() }),
    onClose,
  });

  // Giờ hết khoá tính theo "bây giờ": tính lại khi đổi thời hạn và khi gõ lý do (chỉ ghi khi chữ đổi, để vùng
  // aria-live không đọc lặp) — hộp thoại để mở lâu vẫn không hiện giờ đã cũ.
  const refreshUntil = () => {
    const text = banUntilText(selected());
    if (untilText.textContent !== text) untilText.textContent = text;
  };
  const sync = () => {
    refreshUntil();
    confirm.replaceChildren(admIcon('lock'), el('span', {}, confirmLabel(selected())));
  };
  for (const radio of radios) radio.addEventListener('change', sync);
  reason.addEventListener('input', () => {
    counter.textContent = `${reason.value.length}/${REASON_MAX}`;
    if (reason.value.trim()) reason.removeAttribute('aria-invalid');
    refreshUntil();
  });
  sync();
}
