// Thanh đồng ý phân tích (GA4 + Consent Mode v2) và nút "Cài đặt cookie" ở footer. Markup do src/layouts/SiteLayout.astro
// dựng sẵn (`#consent-banner` mang `hidden`, nút footer `[data-consent-open]` mang `hidden`); ở đây chỉ gắn hành vi và quyết
// định khi nào hiện. Chỉ chạy khi trang bật GA (js/analytics.js `isAnalyticsEnabled`: đúng host, không phải trang quản trị,
// script <head> đã dựng gtag): trang khác giữ nguyên `hidden` nên không có thanh và không có nút.
//   - Hiện thanh khi chưa có lựa chọn còn hiệu lực (chưa chọn hoặc quá 12 tháng); không cướp focus.
//   - Từ chối / Đồng ý: `setConsent` ghi lựa chọn, báo Consent Mode (Từ chối còn xoá cookie `_ga*`) rồi ẩn thanh.
//   - "Cài đặt cookie" mở lại thanh và đưa focus vào đó; chọn xong focus về lại nút đã mở. Thanh không giam focus.
//     Nút mang `aria-expanded` theo đúng trạng thái hiện/ẩn của thanh.
//   - Lần hỏi đầu không có nút để trả focus: nếu focus đang nằm trong thanh (nút vừa bấm sắp biến mất) thì chuyển tới vùng
//     nội dung chính `#main-content` (đích của link bỏ qua điều hướng) thay vì để rơi về <body>.
//   - Thanh phủ lên đáy trang; chiều cao thật ghi vào `--consent-banner-height` trên <html> để CSS chừa chỗ (đệm cuối trang,
//     `scroll-padding`) và nâng các thanh/nút/thông báo dính đáy lên trên thanh.
//   - Tab khác đổi lựa chọn (sự kiện `storage`) hoặc trang được dựng lại từ bfcache (`pageshow`) thì trang này áp theo lựa chọn
//     đang lưu và ẩn thanh.

import { CONSENT_STORAGE_KEY, applyConsent, getConsent, isAnalyticsEnabled, setConsent } from './analytics.js';

const OPEN_ATTRIBUTE = 'data-consent-banner';
const HEIGHT_PROPERTY = '--consent-banner-height';

/**
 * @param {{doc?: Document, win?: any}} [options]
 * @returns {{show(options?: {focus?: boolean}): void, hide(): void} | null} `null` khi trang không bật GA
 */
export function initConsentBanner({ doc = document, win = doc.defaultView } = {}) {
  const banner = doc.getElementById('consent-banner');
  if (!banner || !isAnalyticsEnabled(win)) return null;
  const root = doc.documentElement;
  const openers = [...doc.querySelectorAll('[data-consent-open]')];
  let opener = null;
  let observer = null;
  // Lựa chọn mà gtag đang áp: script <head> chỉ áp "granted" (mặc định đã là từ chối), nên đọc từ storage là đủ.
  let applied = getConsent(win);

  const syncHeight = () => root.style.setProperty(HEIGHT_PROPERTY, `${banner.offsetHeight}px`);
  const setExpanded = (expanded) => {
    for (const button of openers) button.setAttribute('aria-expanded', String(expanded));
  };

  const show = ({ focus = false } = {}) => {
    banner.hidden = false;
    root.setAttribute(OPEN_ATTRIBUTE, 'open');
    setExpanded(true);
    syncHeight();
    // Chiều cao đổi khi xoay màn hình, đổi cỡ chữ hoặc chữ gãy dòng khác đi: theo dõi để phần chừa chỗ luôn đúng.
    if (!observer && typeof win.ResizeObserver === 'function') {
      observer = new win.ResizeObserver(syncHeight);
      observer.observe(banner);
    }
    if (focus) banner.focus();
  };

  const hide = () => {
    banner.hidden = true;
    root.removeAttribute(OPEN_ATTRIBUTE);
    root.style.removeProperty(HEIGHT_PROPERTY);
    setExpanded(false);
    observer?.disconnect();
    observer = null;
  };

  /** Ẩn thanh mà không để focus rơi về <body>: về nút đã mở thanh, hoặc (lần hỏi đầu) tới vùng nội dung chính. */
  const close = () => {
    const hadFocus = banner.contains(doc.activeElement);
    hide();
    if (opener) {
      opener.focus();
      opener = null;
      return;
    }
    const main = hadFocus ? doc.getElementById('main-content') : null;
    if (!main) return;
    // Vùng chứa không thao tác được nên chỉ cần tabindex tạm để nhận focus, gỡ ngay khi focus đi chỗ khác.
    main.setAttribute('tabindex', '-1');
    main.addEventListener('blur', () => main.removeAttribute('tabindex'), { once: true });
    main.focus({ preventScroll: true });
  };

  for (const button of openers) {
    button.hidden = false;
    button.addEventListener('click', () => {
      opener = button;
      // Nút báo aria-expanded nên bấm lần nữa khi thanh đang mở thì đóng lại (focus về nút), không ép chọn.
      if (!banner.hidden) close();
      else show({ focus: true });
    });
  }

  banner.addEventListener('click', (event) => {
    const choice = event.target.closest?.('[data-consent-choice]')?.dataset.consentChoice;
    if (!choice || !setConsent(choice, win)) return;
    applied = choice;
    close();
  });

  const syncFromStorage = () => {
    const choice = getConsent(win);
    if (!choice) return;
    if (choice !== applied) {
      applyConsent(choice, win);
      applied = choice;
    }
    close();
  };
  win.addEventListener('storage', (event) => {
    if (event.key === CONSENT_STORAGE_KEY || event.key === null) syncFromStorage();
  });
  win.addEventListener('pageshow', (event) => {
    if (event.persisted) syncFromStorage();
  });

  if (applied === null) show();
  return { show, hide };
}

if (typeof document !== 'undefined') initConsentBanner();
