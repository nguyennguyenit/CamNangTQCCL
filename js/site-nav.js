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

/**
 * Hành vi menu thả dùng chung cho header (Công cụ/Game) và menu tài khoản của công cụ Chiêu mộ:
 * `aria-expanded` + `hidden` của panel, Escape đóng và trả focus về nút, bấm ra ngoài hoặc Tab ra
 * khỏi menu thì đóng, bấm link/hành động trong menu chỉ đóng chứ không cướp focus.
 *
 * Nơi dùng gắn listener ở `document` MỘT lần cho cả nhóm menu rồi gọi `handleDocumentClick` /
 * `handleDocumentFocusOut` / `handleEscape` của từng menu (nhiều menu trong cùng trang phải chia sẻ
 * một listener, và việc mở menu này đóng menu kia do nơi gọi quyết định qua `onChange`).
 *
 * `shouldHidePanel`: trả về false khi bề rộng lớn — hàng hành động hiện thẳng trong trang nên panel
 * không bị `hidden` lúc menu đóng (nút mở menu lúc đó do CSS ẩn).
 */
export function createDropdownMenu({
  root,
  button,
  panel,
  closeSelector = 'a[href]',
  shouldHidePanel = () => true,
  onChange = null,
} = {}) {
  let open = false;

  /** Ghi trạng thái hiện tại ra DOM — cũng dùng để khởi tạo và đồng bộ sau khi bề rộng đổi. */
  function apply() {
    panel.hidden = !open && shouldHidePanel();
    button.setAttribute('aria-expanded', String(open));
    if (open) root.classList.add('open');
    else root.classList.remove('open');
  }

  function setOpen(next, { restoreFocus = false } = {}) {
    if (open === next) return;
    open = next;
    apply();
    if (typeof onChange === 'function') onChange(open);
    if (!open && restoreFocus) button.focus();
  }

  const menu = {
    root,
    button,
    panel,
    isOpen: () => open,
    open: () => setOpen(true),
    close: (options) => setOpen(false, options),
    setOpen,
    sync: apply,
    /** Link trong menu tự điều hướng: chỉ đóng menu, không giành focus. */
    handlePanelClick(event) {
      if (open && event?.target?.closest?.(closeSelector)) menu.close();
    },
    handleDocumentClick(event) {
      if (open && !root.contains(event?.target)) menu.close();
    },
    handleDocumentFocusOut(event) {
      if (!open) return;
      const next = event?.relatedTarget;
      // `null` = focus rời hẳn tài liệu (cửa sổ khác, chụp ảnh): giữ menu, chỉ đóng khi Tab sang chỗ khác.
      if (!next || root.contains(next)) return;
      menu.close();
    },
    handleEscape() {
      if (!open) return false;
      menu.close({ restoreFocus: true });
      return true;
    },
  };

  button.addEventListener('click', () => {
    if (open) menu.close();
    else menu.open();
  });
  panel.addEventListener('click', (event) => menu.handlePanelClick(event));
  return menu;
}

export function createSiteNav({ documentTarget = document, windowTarget = globalThis } = {}) {
  const root = documentTarget.documentElement;
  /** Nơi giữ trạng thái mở độc quyền: mở một menu thì đóng các menu còn lại. */
  const menus = [];
  const dropdowns = [...documentTarget.querySelectorAll('[data-dropdown]')]
    .map((element) => {
      const button = element.querySelector('[data-dropdown-button]');
      const panel = element.querySelector('[data-dropdown-panel]');
      if (!button || !panel) return null;
      const menu = createDropdownMenu({
        root: element,
        button,
        panel,
        onChange(open) {
          if (open) {
            for (const other of menus) if (other !== menu && other.isOpen()) other.close();
            openDropdown = menu;
          } else if (openDropdown === menu) {
            openDropdown = null;
          }
        },
      });
      menus.push(menu);
      return menu;
    })
    .filter(Boolean);
  const menuToggle = documentTarget.querySelector('#section-menu-toggle');
  const overlay = documentTarget.querySelector('#section-menu-items');
  const closeButton = overlay ? overlay.querySelector('[data-menu-close]') : null;
  let openDropdown = null;
  let menuOpen = false;

  function closeDropdowns({ restoreFocus = false } = {}) {
    if (!openDropdown) return;
    const previous = openDropdown;
    openDropdown = null;
    previous.close({ restoreFocus });
  }

  /** Nút menu tự bật/tắt trong `createDropdownMenu`; nơi đây chỉ giữ trạng thái mở độc quyền. */
  function toggleDropdown(dropdown) {
    if (openDropdown === dropdown) dropdown.close();
    else dropdown.open();
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

  for (const dropdown of dropdowns) dropdown.sync();

  menuToggle?.addEventListener('click', () => setMenuOpen(!menuOpen));
  closeButton?.addEventListener('click', () => setMenuOpen(false));
  overlay?.addEventListener('click', (event) => {
    // Link trong menu mobile tự điều hướng; đóng trước để trang không còn khóa cuộn khi anchor nội bộ.
    if (event.target?.closest?.('a[href]')) setMenuOpen(false, { restoreFocus: false });
  });

  documentTarget.addEventListener('click', (event) => {
    for (const dropdown of dropdowns) dropdown.handleDocumentClick(event);
  });
  documentTarget.addEventListener('focusout', (event) => {
    for (const dropdown of dropdowns) dropdown.handleDocumentFocusOut(event);
  });
  documentTarget.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (menuOpen) {
        setMenuOpen(false);
        return;
      }
      closeDropdowns({ restoreFocus: true });
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
    openDropdown: (index = 0) => dropdowns[index] && toggleDropdown(dropdowns[index]),
    openMenu: () => setMenuOpen(true),
    closeMenu: (options) => setMenuOpen(false, options),
    isMenuOpen: () => menuOpen,
    isDropdownOpen: (index = 0) => dropdowns[index] === openDropdown,
  };
}
