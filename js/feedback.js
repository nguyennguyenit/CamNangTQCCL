// Hộp thoại "Góp ý, sửa lỗi" ở footer (src/layouts/SiteLayout.astro). Mở lần đầu: hỏi phiên đăng nhập;
// đã đăng nhập thì điền sẵn email tài khoản, chưa đăng nhập thì mới nạp Turnstile (js/turnstile.js).
// Gửi tới community-worker `POST /api/feedback` kèm đường dẫn trang đang xem và ngôn ngữ trang.

import { L, currentLocale } from './i18n.js';
import { api, describeError, loadSession } from './community-api.js';
import { initModalDialog } from './modal-dialog.js';
import { renderTurnstileWidget, TURNSTILE_ERROR_MESSAGE } from './turnstile.js';

const PAGE_MAX_LENGTH = 300;

export function initFeedbackDialog(doc = document) {
  const form = doc.querySelector('[data-feedback-form]');
  if (!form) return null;
  const { kind, title, body, email } = form.elements;
  const turnstileBox = form.querySelector('[data-feedback-turnstile]');
  const status = form.querySelector('[data-feedback-status]');
  const submit = form.querySelector('button[type="submit"]');
  let prepared = null;
  let accountEmail = '';
  let signedIn = false;
  let token = '';
  let widgetId = null;

  const setStatus = (message, kindName = '') => {
    status.textContent = message;
    status.dataset.kind = kindName;
    status.hidden = !message;
  };

  const prepare = async () => {
    let user = null;
    try {
      user = await loadSession({ probe: true });
    } catch {
      // Dịch vụ cộng đồng không phản hồi: coi như khách; lỗi thật sẽ hiện khi bấm gửi.
    }
    if (user) {
      signedIn = true;
      accountEmail = typeof user.email === 'string' ? user.email : '';
      if (!email.value) email.value = accountEmail;
      return;
    }
    turnstileBox.hidden = false;
    try {
      widgetId = await renderTurnstileWidget(turnstileBox, {
        onToken: (value) => {
          token = value;
        },
        onExpire: () => {
          token = '';
        },
        onError: (message) => setStatus(message, 'error'),
      });
    } catch (error) {
      setStatus(error?.localized ? error.message : TURNSTILE_ERROR_MESSAGE, 'error');
    }
  };

  for (const field of [title, body]) {
    field.addEventListener('input', () => field.removeAttribute('aria-invalid'));
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    const missing = [title, body].filter((field) => !field.value.trim());
    for (const field of missing) field.setAttribute('aria-invalid', 'true');
    if (missing.length) {
      setStatus(L('Hãy nhập tiêu đề và nội dung.', '请填写标题和内容。'), 'error');
      missing[0].focus();
      return;
    }
    await prepared;
    if (!signedIn && !token) {
      setStatus(L('Hãy đợi xác thực chống bot hoàn tất rồi gửi lại.', '请等待人机验证完成后再提交。'), 'error');
      return;
    }
    const payload = {
      kind: kind.value,
      title: title.value.trim(),
      body: body.value.trim(),
      email: email.value.trim(),
      page: location.pathname.slice(0, PAGE_MAX_LENGTH),
      lang: currentLocale(),
    };
    if (!signedIn) payload.turnstileToken = token;
    submit.disabled = true;
    setStatus(L('Đang gửi…', '正在提交…'));
    try {
      await api('/api/feedback', { method: 'POST', json: payload });
      form.reset();
      email.value = accountEmail;
      setStatus(L('Cảm ơn bạn! Góp ý đã được gửi.', '感谢反馈！已成功提交。'));
    } catch (error) {
      setStatus(describeError(error), 'error');
    } finally {
      submit.disabled = false;
      // Token Turnstile chỉ dùng được một lần: đã gửi đi thì xin token mới.
      if (!signedIn) {
        token = '';
        if (widgetId !== null) window.turnstile?.reset(widgetId);
      }
    }
  });

  return initModalDialog('feedback-dialog', 'feedback', {
    doc,
    onOpen: () => {
      prepared ??= prepare();
    },
  });
}

initFeedbackDialog();
