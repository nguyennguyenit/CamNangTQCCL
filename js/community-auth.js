// Widget đăng nhập ở header (mọi trang): nút "Đăng nhập" hoặc ảnh đại diện + menu (Chiến báo của tôi,
// Quản trị nếu là admin, Đăng xuất). Menu dùng chung `createDropdownMenu` của js/site-nav.js:
// `aria-expanded`, Escape đóng và trả focus về nút, bấm ra ngoài hoặc Tab ra khỏi menu thì đóng.

import { L, localePath } from './i18n.js';
import { el } from './render.js';
import { createDropdownMenu } from './site-nav.js';
import {
  SESSION_EVENT,
  avatar,
  describeError,
  displayName,
  loadSession,
  signIn,
  signOut,
  userIcon,
} from './community-api.js';

const MENU_ID = 'community-auth-menu';
/** Menu tài khoản đang gắn (null khi chưa đăng nhập); listener cấp document gắn một lần ở init. */
let currentMenu = null;

function renderSignedOut(mount) {
  currentMenu = null;
  const label = L('Đăng nhập', '登录');
  const button = el('button', {
    class: 'icon-btn cm-auth-login',
    type: 'button',
    'aria-label': L('Đăng nhập bằng Google', '使用 Google 登录'),
    title: L('Đăng nhập bằng Google', '使用 Google 登录'),
  }, [userIcon(), el('span', { class: 'cm-auth-label', 'aria-hidden': 'true' }, label)]);
  const status = el('span', { class: 'visually-hidden', role: 'status', 'aria-live': 'polite' });
  button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = L('Đang chuyển tới Google…', '正在跳转到 Google…');
    try {
      await signIn();
    } catch (error) {
      button.disabled = false;
      status.textContent = describeError(error);
      button.title = describeError(error);
    }
  });
  mount.replaceChildren(button, status);
}

function renderSignedIn(mount, user) {
  const name = displayName(user);
  const toggle = el('button', {
    class: 'icon-btn cm-auth-toggle',
    type: 'button',
    'aria-expanded': 'false',
    'aria-controls': MENU_ID,
    'aria-label': L(`Tài khoản: ${name}`, `账户：${name}`),
  }, [avatar(user, 'cm-avatar cm-auth-avatar')]);
  const status = el('p', { class: 'cm-auth-status', role: 'status', 'aria-live': 'polite', hidden: '' });
  const signOutButton = el('button', { class: 'cm-auth-item', type: 'button' }, L('Đăng xuất', '退出登录'));
  const panel = el('div', { id: MENU_ID, class: 'cm-auth-menu', hidden: '' }, [
    el('p', { class: 'cm-auth-name' }, name),
    el('ul', { class: 'cm-auth-list' }, [
      el('li', {}, el('a', { class: 'cm-auth-item', href: localePath('/chien-bao/') }, L('Chiến báo của tôi', '我的战报'))),
      user.isAdmin ? el('li', {}, el('a', { class: 'cm-auth-item', href: localePath('/quan-tri/') }, L('Quản trị', '管理后台'))) : null,
      el('li', {}, signOutButton),
    ]),
    status,
  ]);

  currentMenu = createDropdownMenu({ root: mount, button: toggle, panel, closeSelector: 'a[href]' });
  signOutButton.addEventListener('click', async () => {
    signOutButton.disabled = true;
    try {
      await signOut();
    } catch (error) {
      signOutButton.disabled = false;
      status.hidden = false;
      status.textContent = describeError(error);
    }
  });
  mount.replaceChildren(toggle, panel);
}

function render(mount, user) {
  if (user) renderSignedIn(mount, user);
  else renderSignedOut(mount);
}

export function initCommunityAuth(mount = document.getElementById('community-auth')) {
  if (!mount) return;
  // Trang cộng đồng hỏi phiên đầy đủ; header chỉ cập nhật theo kết quả đó.
  document.addEventListener(SESSION_EVENT, (event) => render(mount, event.detail?.user || null));
  document.addEventListener('click', (event) => currentMenu?.handleDocumentClick(event));
  document.addEventListener('focusout', (event) => currentMenu?.handleDocumentFocusOut(event));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') currentMenu?.handleEscape();
  });
  render(mount, null);
  loadSession({ probe: false }).catch(() => {
    // Dịch vụ không phản hồi: giữ nút đăng nhập, lỗi hiện khi người dùng bấm.
  });
}

initCommunityAuth();
