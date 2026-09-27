// Chrome dùng chung cho mọi trang: theme và điều hướng (menu thả + menu mobile). Không tải dữ liệu gameplay.
// Đây là nơi duy nhất gắn nút đổi giao diện; script inline trong <head> của SiteLayout đặt
// `data-theme` trước stylesheet để trang không nháy, còn ở đây chỉ áp lại và đổi giá trị.

import { createSiteNav } from './site-nav.js';

const THEME_KEY = 'theme';

/** Storage có thể bị chặn ở getter, getItem hoặc setItem; không cái nào được chặn boot. */
function readStoredTheme() {
  try {
    const value = globalThis.localStorage?.getItem(THEME_KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null;
  }
}

function storeTheme(theme) {
  try {
    globalThis.localStorage?.setItem(THEME_KEY, theme);
    return true;
  } catch {
    return false;
  }
}

/** Không có lựa chọn đã lưu thì theo hệ điều hành; matchMedia hỏng về mặc định sáng. */
function systemTheme() {
  try {
    return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function initSiteChrome({documentTarget = document, windowTarget = globalThis} = {}) {
  const root = documentTarget.documentElement;
  // Hai nút cùng một bộ điều khiển: `#theme-toggle` ở header (trang trong) và nút trong đầu menu mobile.
  const toggles = [...documentTarget.querySelectorAll('[data-theme-toggle]')];
  const applyTheme = (theme) => {
    root.dataset.theme = theme;
    const dark = theme === 'dark';
    // Tên nút cố định ("Giao diện tối" ở layout); trạng thái chỉ nằm ở `aria-pressed`.
    for (const toggle of toggles) toggle.setAttribute('aria-pressed', String(dark));
  };
  const syncTheme = () => applyTheme(readStoredTheme() || systemTheme());
  syncTheme();
  for (const toggle of toggles) {
    toggle.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      // Ghi hỏng vẫn phải đổi được giao diện trong phiên hiện tại.
      storeTheme(next);
    });
  }
  // Back/forward từ bfcache dựng lại DOM cũ: đọc lại lựa chọn thay vì giữ theme đã chụp.
  windowTarget.addEventListener?.('pageshow', syncTheme);
  // Tab khác đổi theme (kể cả xóa khóa: `key === null`).
  windowTarget.addEventListener?.('storage', (event) => {
    if (!event || event.key === THEME_KEY || event.key === null) syncTheme();
  });

  syncLanguageSwitch({documentTarget, windowTarget});
  const nav = createSiteNav({documentTarget, windowTarget});
  return {nav, applyTheme, syncTheme};
}

/**
 * Nút chuyển ngôn ngữ (`[data-lang-switch]`, header + menu mobile) là link thật tới bản gương của trang.
 * Bộ lọc, biến thể và deep-link nằm ở query/hash và đổi tại chỗ (history API), nên href được ghép lại với
 * query/hash của lúc bấm; href gốc do layout phát được giữ ở `data-lang-base` để không cộng dồn.
 */
export function syncLanguageSwitch({documentTarget = document, windowTarget = globalThis} = {}) {
  const links = [...documentTarget.querySelectorAll('[data-lang-switch]')];
  const refresh = (link) => {
    const location = windowTarget.location;
    if (!location) return;
    link.dataset.langBase ??= link.getAttribute('href') || '/';
    const target = new URL(link.dataset.langBase, location.href);
    if (target.origin !== location.origin) return;
    link.setAttribute('href', `${target.pathname}${target.search || location.search}${target.hash || location.hash}`);
  };
  for (const link of links) {
    refresh(link);
    // Cập nhật ngay trước khi điều hướng: chuột (kể cả mở tab mới), bàn phím và chạm đều đi qua các sự kiện này.
    for (const type of ['pointerdown', 'focus', 'click']) link.addEventListener(type, () => refresh(link));
  }
  return links;
}
