// Chrome dùng chung cho mọi trang: theme và menu section. Không tải dữ liệu gameplay.

import { createMobileSectionMenu } from './mobile-section-menu.js';

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

export function initSiteChrome({documentTarget = document} = {}) {
  const root = documentTarget.documentElement;
  const toggle = documentTarget.querySelector('#theme-toggle');
  const prefersDark = globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const applyTheme = (theme) => {
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    if (!toggle) return;
    const dark = theme === 'dark';
    toggle.setAttribute('aria-pressed', String(dark));
    toggle.setAttribute('aria-label', dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối');
  };
  applyTheme(readStoredTheme() || (prefersDark ? 'dark' : 'light'));
  toggle?.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    // Ghi hỏng vẫn phải đổi được giao diện trong phiên hiện tại.
    storeTheme(next);
  });

  const nav = documentTarget.querySelector('.section-nav');
  const menuToggle = documentTarget.querySelector('#section-menu-toggle');
  const tabs = [...documentTarget.querySelectorAll('.nav-tab')];
  const menu = nav && menuToggle ? createMobileSectionMenu({nav, toggle: menuToggle, tabs, documentTarget}) : null;
  menu?.setActive(tabs.find((tab) => tab.classList.contains('active'))?.dataset.section);

  return {menu, applyTheme};
}
