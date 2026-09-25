// Điều hướng dùng chung cho mọi trang: menu thả (Công cụ, Game; Landing thêm Đội hình, Tra cứu)
// và menu mobile toàn màn hình. Không tải dữ liệu gameplay, không tự dựng href.
//
// Hợp đồng DOM do src/layouts/SiteLayout.astro phát:
//   [data-dropdown] > [data-dropdown-button][aria-expanded][aria-controls] + [data-dropdown-panel][id][hidden]
//   #section-menu-toggle[aria-controls="#section-menu-items"][aria-expanded] + #section-menu-items[hidden] > [data-menu-close]
//
// Quy tắc: link bên trong là anchor thật (không preventDefault, không nuốt click có modifier);
// mở một menu thì đóng menu khác; Escape đóng và trả focus về nút; bấm ra ngoài hoặc Tab ra khỏi
// menu thì đóng; menu mobile khóa cuộn nền và giam focus trong lớp phủ.

const SCROLL_LOCK_CLASS = 'site-menu-open';
const DESKTOP_QUERY = '(min-width: 821px)';
const FOCUSABLE = 'a[href], button';

export function createSiteNav({ documentTarget = document, windowTarget = globalThis } = {}) {
  const root = documentTarget.documentElement;
  const dropdowns = [...documentTarget.querySelectorAll('[data-dropdown]')]
    .map((element) => {
      const button = element.querySelector('[data-dropdown-button]');
      const panel = element.querySelector('[data-dropdown-panel]');
      return button && panel ? { root: element, button, panel } : null;
    })
    .filter(Boolean);
  const menuToggle = documentTarget.querySelector('#section-menu-toggle');
  const overlay = documentTarget.querySelector('#section-menu-items');
  const closeButton = overlay ? overlay.querySelector('[data-menu-close]') : null;
  let openDropdown = null;
  let menuOpen = false;

  function setDropdown(dropdown, open) {
    dropdown.panel.hidden = !open;
    dropdown.button.setAttribute('aria-expanded', String(open));
    if (open) dropdown.root.classList.add('open');
    else dropdown.root.classList.remove('open');
  }

  function closeDropdowns({ restoreFocus = false } = {}) {
    if (!openDropdown) return;
    const previous = openDropdown;
    openDropdown = null;
    setDropdown(previous, false);
    if (restoreFocus) previous.button.focus();
  }

  function openByDropdown(dropdown) {
    const alreadyOpen = openDropdown === dropdown;
    closeDropdowns();
    if (alreadyOpen) return;
    openDropdown = dropdown;
    setDropdown(dropdown, true);
  }

  function setMenuOpen(open, { restoreFocus = true } = {}) {
    if (!overlay || !menuToggle) return;
    menuOpen = open;
    if (open) overlay.removeAttribute('hidden');
    else overlay.setAttribute('hidden', '');
    menuToggle.setAttribute('aria-expanded', String(open));
    if (open) root.classList.add(SCROLL_LOCK_CLASS);
    else root.classList.remove(SCROLL_LOCK_CLASS);
    if (open) {
      closeDropdowns();
      closeButton?.focus();
    } else if (restoreFocus) {
      menuToggle.focus();
    }
  }

  /** Focus kế tiếp khi Tab ở mép lớp phủ: quay vòng trong menu, không thoát ra sau lưng. */
  function trapFocus(event) {
    if (!menuOpen || !overlay || event.key !== 'Tab') return;
    const focusable = overlay.querySelectorAll(FOCUSABLE);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = documentTarget.activeElement;
    if (event.shiftKey && (active === first || !overlay.contains(active))) {
      event.preventDefault();
      last.focus();
      return;
    }
    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  for (const dropdown of dropdowns) {
    setDropdown(dropdown, false);
    dropdown.button.addEventListener('click', () => openByDropdown(dropdown));
    // Bấm vào link trong menu: để trình duyệt điều hướng, chỉ đóng menu và không giành focus.
    dropdown.panel.addEventListener('click', (event) => {
      if (event.target?.closest?.('a[href]')) closeDropdowns();
    });
  }

  menuToggle?.addEventListener('click', () => setMenuOpen(!menuOpen));
  closeButton?.addEventListener('click', () => setMenuOpen(false));
  overlay?.addEventListener('click', (event) => {
    // Link trong menu mobile tự điều hướng; đóng trước để trang không còn khóa cuộn khi anchor nội bộ.
    if (event.target?.closest?.('a[href]')) setMenuOpen(false, { restoreFocus: false });
  });

  documentTarget.addEventListener('click', (event) => {
    if (!openDropdown) return;
    if (openDropdown.root.contains(event.target)) return;
    closeDropdowns();
  });
  documentTarget.addEventListener('focusout', (event) => {
    if (!openDropdown) return;
    const next = event.relatedTarget;
    // `null` = focus rời hẳn tài liệu (cửa sổ khác, chụp ảnh): giữ menu, chỉ đóng khi Tab sang chỗ khác.
    if (!next || openDropdown.root.contains(next)) return;
    closeDropdowns();
  });
  documentTarget.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (menuOpen) {
        setMenuOpen(false);
        return;
      }
      if (openDropdown) closeDropdowns({ restoreFocus: true });
      return;
    }
    trapFocus(event);
  });

  // Cùng tài liệu đổi history (app pushState) hoặc rời trang: trạng thái menu không còn thuộc trang nữa.
  // Không reload, không giành focus — chỉ dọn lớp phủ và khóa cuộn.
  const clearTransientState = () => {
    setMenuOpen(false, { restoreFocus: false });
    closeDropdowns();
  };
  windowTarget.addEventListener?.('popstate', clearTransientState);
  windowTarget.addEventListener?.('pagehide', clearTransientState);

  // Vừa chuyển từ mobile sang desktop: đóng cả hai loại menu, không để lại lớp phủ treo hay khóa cuộn.
  // Chỉ hành động khi trạng thái thật sự đổi — ảnh chụp toàn trang của công cụ đo có thể phát `change` giả.
  const desktop = windowTarget.matchMedia?.(DESKTOP_QUERY);
  let wasDesktop = desktop?.matches ?? true;
  desktop?.addEventListener?.('change', (event) => {
    const changed = event.matches !== wasDesktop;
    wasDesktop = event.matches;
    if (!changed || !event.matches) return;
    setMenuOpen(false, { restoreFocus: false });
    closeDropdowns();
  });

  return {
    dropdowns,
    menuToggle,
    overlay,
    closeDropdowns,
    openDropdown: (index = 0) => dropdowns[index] && openByDropdown(dropdowns[index]),
    openMenu: () => setMenuOpen(true),
    closeMenu: (options) => setMenuOpen(false, options),
    isMenuOpen: () => menuOpen,
    isDropdownOpen: (index = 0) => dropdowns[index] === openDropdown,
  };
}
