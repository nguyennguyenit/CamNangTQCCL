// Unit test cho js/site-nav.js bằng DOM giả tối thiểu (không có jsdom ở repo này).
// Chỉ dựng đúng những gì module dùng: cây cha/con, thuộc tính, classList, hidden, focus,
// querySelector(All) với selector con (thẻ, #id, [attr], thẻ[attr], danh sách phẩy).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createDropdownMenu, createSiteNav } from "../js/site-nav.js";

function matches(element, selector) {
  return selector.split(",").some((part) => {
    const token = part.trim();
    const id = token.match(/^#([\w-]+)$/);
    if (id) return element.id === id[1];
    const attr = token.match(/^([\w-]*)\[([\w-]+)(?:=["']?([^"'\]]+)["']?)?\]$/);
    if (attr) {
      const [, tag, name, value] = attr;
      if (tag && element.tagName !== tag) return false;
      const actual = element.getAttribute(name);
      return value === undefined ? actual !== null : actual === value;
    }
    return element.tagName === token;
  });
}

function createElement(tagName) {
  const listeners = new Map();
  const attributes = new Map();
  const classes = new Set();
  const element = {
    tagName,
    id: "",
    hidden: false,
    textContent: "",
    children: [],
    parent: null,
    focused: false,
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
    },
    append(child) {
      child.parent = element;
      element.children.push(child);
      return child;
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
      if (name === "id") element.id = String(value);
    },
    getAttribute: (name) => (attributes.has(name) ? attributes.get(name) : null),
    removeAttribute: (name) => attributes.delete(name),
    contains(node) {
      for (let current = node; current; current = current.parent) if (current === element) return true;
      return false;
    },
    closest(selector) {
      for (let current = element; current; current = current.parent) if (matches(current, selector)) return current;
      return null;
    },
    focus() {
      element.focused = true;
      element.ownerDocument.activeElement = element;
    },
    // Sự kiện nổi bọt như DOM thật: listener của tổ tiên cũng nhận được.
    emit(type, event) {
      for (let node = element; node; node = node.parent) node.listeners?.get(type)?.(event);
    },
    click() {
      element.emit("click", {type: "click", target: element});
    },
    key(event) {
      listeners.get("keydown")?.(event);
    },
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    listeners: null,
    querySelectorAll: (selector) => descendants(element).filter((node) => matches(node, selector)),
    querySelector: (selector) => element.querySelectorAll(selector)[0] ?? null,
  };
  element.listeners = listeners;
  return element;
}

function descendants(root) {
  const found = [];
  const walk = (node) => {
    for (const child of node.children) {
      found.push(child);
      walk(child);
    }
  };
  walk(root);
  return found;
}

/** Shell giả: header có 2 menu thả + nút ☰ và lớp phủ mobile, giống SiteLayout phát ra. */
function fakeShell() {
  const documentTarget = {
    activeElement: null,
    listeners: new Map(),
    documentElement: createElement("html"),
    addEventListener(type, handler) {
      documentTarget.listeners.set(type, handler);
    },
    dispatch(type, event = {}) {
      documentTarget.listeners.get(type)?.(event);
    },
    querySelectorAll: (selector) => descendants(documentTarget.documentElement).filter((node) => matches(node, selector)),
    querySelector: (selector) => documentTarget.querySelectorAll(selector)[0] ?? null,
  };
  const bind = (element) => {
    element.ownerDocument = documentTarget;
    for (const child of element.children) bind(child);
    return element;
  };
  const body = documentTarget.documentElement.append(createElement("body"));
  bind(documentTarget.documentElement);

  const dropdown = (name, links) => {
    const root = body.append(createElement("li"));
    root.setAttribute("data-dropdown", name);
    const button = root.append(createElement("button"));
    button.setAttribute("data-dropdown-button", "");
    button.setAttribute("aria-expanded", "false");
    bind(root);
    const panel = root.append(createElement("div"));
    panel.setAttribute("data-dropdown-panel", "");
    panel.setAttribute("id", `nav-menu-${name}`);
    for (const label of links) {
      const anchor = panel.append(createElement("a"));
      anchor.setAttribute("href", `/${label}/`);
      anchor.className = "nav-menu-item";
    }
    bind(root);
    return {root, button, panel};
  };

  const tools = dropdown("cong-cu", ["chieu-mo", "soi-doi"]);
  const game = dropdown("game", ["trang-chu"]);

  const toggle = body.append(createElement("button"));
  toggle.setAttribute("id", "section-menu-toggle");
  toggle.setAttribute("aria-expanded", "false");
  const overlay = body.append(createElement("div"));
  overlay.setAttribute("id", "section-menu-items");
  overlay.setAttribute("hidden", "");
  const close = overlay.append(createElement("button"));
  close.setAttribute("data-menu-close", "");
  const row = overlay.append(createElement("a"));
  row.setAttribute("href", "/doi-chuan/");
  bind(documentTarget.documentElement);
  return {documentTarget, tools, game, toggle, overlay, close, row};
}

function fakeWindow(desktopMatches = false) {
  const listeners = new Map();
  const state = {matches: desktopMatches};
  // `matchMedia` trả cùng một đối tượng (như trình duyệt), để `matches` phản ánh trạng thái hiện tại.
  return {
    listeners,
    addEventListener: (type, handler) => listeners.set(type, handler),
    matchMedia: () => ({get matches() { return state.matches; }, addEventListener: (type, handler) => listeners.set(type, handler)}),
    toMobile() {
      state.matches = false;
      listeners.get("change")?.({matches: false});
    },
    resizeToDesktop() {
      state.matches = true;
      listeners.get("change")?.({matches: true});
    },
    /** `change` giả khi bề rộng không đổi (công cụ chụp ảnh toàn trang): không được đóng menu. */
    spuriousDesktopChange() {
      listeners.get("change")?.({matches: true});
    },
    fire(type) {
      listeners.get(type)?.({type});
    },
  };
}

test("menu thả mở độc quyền, Escape trả focus và bấm ra ngoài đóng", () => {
  const shell = fakeShell();
  const windowTarget = fakeWindow(true);
  const nav = createSiteNav({documentTarget: shell.documentTarget, windowTarget});

  assert.deepEqual([shell.tools.panel.hidden, shell.game.panel.hidden], [true, true]);

  shell.tools.button.click();
  assert.equal(nav.isDropdownOpen(0), true);
  assert.deepEqual([shell.tools.panel.hidden, shell.tools.button.getAttribute("aria-expanded")], [false, "true"]);

  shell.game.button.click();
  assert.deepEqual([shell.tools.panel.hidden, shell.game.panel.hidden], [true, false]);
  assert.equal(nav.isDropdownOpen(1), true);

  shell.documentTarget.dispatch("keydown", {key: "Escape"});
  assert.equal(nav.isDropdownOpen(1), false);
  assert.equal(shell.game.button.focused, true, "Escape trả focus về nút của menu vừa đóng");

  shell.tools.button.click();
  shell.documentTarget.dispatch("click", {target: shell.documentTarget.documentElement});
  assert.equal(nav.isDropdownOpen(0), false, "bấm ra ngoài đóng menu");

  shell.tools.button.click();
  shell.documentTarget.dispatch("click", {target: shell.tools.panel.children[0]});
  assert.equal(nav.isDropdownOpen(0), true, "bấm vào link trong menu không đóng trước khi điều hướng");

  shell.documentTarget.dispatch("focusout", {relatedTarget: shell.toggle});
  assert.equal(nav.isDropdownOpen(0), false, "Tab ra khỏi menu thì đóng");

  shell.tools.button.click();
  shell.documentTarget.dispatch("focusout", {relatedTarget: shell.tools.panel.children[1]});
  assert.equal(nav.isDropdownOpen(0), true, "focus còn trong menu thì giữ mở");
  windowTarget.spuriousDesktopChange();
  assert.equal(nav.isDropdownOpen(0), true, "change giả (bề rộng không đổi) không đóng menu");
  windowTarget.toMobile();
  assert.equal(nav.isDropdownOpen(0), true, "thu về mobile không đóng menu thả");
  windowTarget.resizeToDesktop();
  assert.equal(nav.isDropdownOpen(0), false, "đổi sang desktop đóng menu thả");
});

test("menu mobile khóa cuộn, giam focus và trả focus ở mọi đường đóng", () => {
  const shell = fakeShell();
  const windowTarget = fakeWindow();
  const nav = createSiteNav({documentTarget: shell.documentTarget, windowTarget});
  const documentElement = shell.documentTarget.documentElement;

  shell.toggle.click();
  assert.equal(nav.isMenuOpen(), true);
  assert.equal(shell.overlay.getAttribute("hidden"), null);
  assert.equal(shell.toggle.getAttribute("aria-expanded"), "true");
  assert.equal(documentElement.classList.contains("site-menu-open"), true, "khóa cuộn nền");
  assert.equal(shell.close.focused, true, "focus vào nút đóng");

  // Tab ở phần tử cuối quấn về đầu, Shift+Tab ở đầu quấn về cuối — không thoát ra sau lưng.
  shell.documentTarget.activeElement = shell.row;
  const forward = {key: "Tab", preventDefault() { this.prevented = true; }};
  shell.documentTarget.dispatch("keydown", forward);
  assert.equal(forward.prevented, true, "Tab ở phần tử cuối bị chặn để quấn về đầu");
  assert.equal(shell.close.focused, true, "Tab ở phần tử cuối quấn về nút đóng");
  shell.documentTarget.activeElement = shell.close;
  const shift = {key: "Tab", shiftKey: true, preventDefault() { this.prevented = true; }};
  shell.documentTarget.dispatch("keydown", shift);
  assert.equal(shift.prevented, true, "Shift+Tab ở nút đóng bị chặn để quấn về cuối");
  assert.equal(shell.row.focused, true);

  shell.documentTarget.dispatch("keydown", {key: "Escape"});
  assert.equal(nav.isMenuOpen(), false);
  assert.equal(shell.overlay.getAttribute("hidden"), "");
  assert.equal(documentElement.classList.contains("site-menu-open"), false, "Escape mở khóa cuộn");
  assert.equal(shell.toggle.focused, true, "Escape trả focus về ☰");

  shell.toggle.click();
  shell.close.click();
  assert.equal(nav.isMenuOpen(), false);
  assert.equal(documentElement.classList.contains("site-menu-open"), false);

  shell.toggle.click();
  shell.row.click();
  assert.equal(nav.isMenuOpen(), false, "bấm link trong menu đóng menu");
  assert.equal(documentElement.classList.contains("site-menu-open"), false);
  assert.equal(shell.toggle.focused, true, "focus vẫn ở nút sau khi điều hướng");

  shell.toggle.click();
  windowTarget.resizeToDesktop();
  assert.equal(nav.isMenuOpen(), false);
  assert.equal(documentElement.classList.contains("site-menu-open"), false, "resize không để lại khóa cuộn");

  shell.toggle.click();
  shell.toggle.click();
  assert.equal(nav.isMenuOpen(), false, "bấm ☰ lần nữa đóng menu");
});

test("menu thả đóng khi mở menu mobile và ngược lại", () => {
  const shell = fakeShell();
  const nav = createSiteNav({documentTarget: shell.documentTarget, windowTarget: fakeWindow()});

  shell.tools.button.click();
  assert.equal(nav.isDropdownOpen(0), true);
  shell.toggle.click();
  assert.equal(nav.isDropdownOpen(0), false, "mở menu mobile đóng menu thả");
  assert.equal(nav.isMenuOpen(), true);
});

test("popstate và pagehide dọn cả hai loại menu cùng khóa cuộn", () => {
  const shell = fakeShell();
  const windowTarget = fakeWindow();
  const nav = createSiteNav({documentTarget: shell.documentTarget, windowTarget});
  const documentElement = shell.documentTarget.documentElement;

  // Menu thả mở rồi Back/Forward cùng tài liệu: đóng, không giành focus.
  shell.tools.button.click();
  assert.equal(nav.isDropdownOpen(0), true);
  windowTarget.fire("popstate");
  assert.equal(nav.isDropdownOpen(0), false, "popstate đóng menu thả");
  assert.equal(shell.tools.button.focused, false, "popstate không giành focus");

  // Lớp phủ mobile mở rồi Back/Forward: đóng, mở khóa cuộn.
  shell.toggle.click();
  assert.equal(nav.isMenuOpen(), true);
  windowTarget.fire("popstate");
  assert.equal(nav.isMenuOpen(), false, "popstate đóng menu mobile");
  assert.equal(shell.toggle.getAttribute("aria-expanded"), "false");
  assert.equal(documentElement.classList.contains("site-menu-open"), false, "popstate mở khóa cuộn");
  assert.equal(shell.toggle.focused, false, "popstate không trả focus về ☰");

  // Rời trang (pagehide): bản lưu không được giữ lớp phủ hay khóa cuộn.
  shell.toggle.click();
  shell.tools.button.click();
  windowTarget.fire("pagehide");
  assert.equal(nav.isMenuOpen(), false, "pagehide đóng menu mobile");
  assert.equal(nav.isDropdownOpen(0), false, "pagehide đóng menu thả");
  assert.equal(documentElement.classList.contains("site-menu-open"), false, "pagehide mở khóa cuộn");
});

test("menu thả dùng chung: Escape trả focus, bấm ngoài/focusout đóng, panel theo bề rộng", () => {
  // Dùng lại shell giả của file để có `ownerDocument` (harness `focus()` ghi vào đó).
  const shell = fakeShell();
  const documentTarget = shell.documentTarget;
  const bind = (node) => {
    node.ownerDocument = documentTarget;
    for (const child of node.children) bind(child);
    return node;
  };
  const root = documentTarget.documentElement.querySelector("body").append(createElement("div"));
  const button = root.append(createElement("button"));
  button.setAttribute("aria-expanded", "false");
  const panel = root.append(createElement("div"));
  const link = panel.append(createElement("a"));
  link.setAttribute("href", "/chieu-mo/");
  bind(root);
  let hideWhenClosed = true;
  const menu = createDropdownMenu({ root, button, panel, shouldHidePanel: () => hideWhenClosed });

  menu.sync();
  assert.deepEqual([panel.hidden, button.getAttribute("aria-expanded"), root.classList.contains("open")], [true, "false", false]);

  button.click();
  assert.deepEqual([panel.hidden, button.getAttribute("aria-expanded"), menu.isOpen()], [false, "true", true]);
  assert.equal(menu.handleEscape(), true, "Escape đóng menu đang mở");
  assert.deepEqual([panel.hidden, menu.isOpen(), button.focused], [true, false, true]);

  assert.equal(menu.handleEscape(), false, "menu đã đóng thì Escape không cướp focus");

  menu.open();
  menu.handlePanelClick({ target: link });
  assert.equal(menu.isOpen(), false, "bấm link trong menu chỉ đóng menu (để trình duyệt điều hướng)");

  menu.open();
  menu.handleDocumentClick({ target: root });
  assert.equal(menu.isOpen(), true, "bấm trong menu thì giữ mở");
  menu.handleDocumentClick({ target: shell.toggle });
  assert.equal(menu.isOpen(), false, "bấm ra ngoài thì đóng");

  menu.open();
  menu.handleDocumentFocusOut({ relatedTarget: link });
  assert.equal(menu.isOpen(), true, "focus còn trong menu thì giữ mở");
  menu.handleDocumentFocusOut({ relatedTarget: null });
  assert.equal(menu.isOpen(), true, "focus rời hẳn tài liệu thì giữ menu");
  menu.handleDocumentFocusOut({ relatedTarget: shell.toggle });
  assert.equal(menu.isOpen(), false, "Tab ra ngoài menu thì đóng");

  // Bề rộng lớn: hàng thao tác hiện thẳng nên panel không bị ẩn khi menu đóng.
  hideWhenClosed = false;
  menu.close();
  menu.sync();
  assert.equal(panel.hidden, false);
  assert.equal(button.getAttribute("aria-expanded"), "false");
});
