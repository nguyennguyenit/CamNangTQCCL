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
  api,
  formatDateTime,
  loadSession,
  signIn,
  signOut,
  urlWithoutAuthError,
  userIcon,
} from './community-api.js';

const MENU_ID = 'community-auth-menu';
/** Menu tài khoản đang gắn (null khi chưa đăng nhập); listener cấp document gắn một lần ở init. */
let currentMenu = null;
/** Thông báo đăng nhập thất bại do khoá/xoá tài khoản; sống qua mọi lần vẽ lại header. */
let loginNotice = null;

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
  mount.replaceChildren(button, status, ...(loginNotice ? [loginNotice] : []));
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
      user.role === 'root' || user.role === 'moderator' ? el('li', {}, el('a', { class: 'cm-auth-item', href: localePath('/quan-tri/') }, L('Quản trị', '管理后台'))) : null,
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

/* ---------- Thông báo bị khoá ---------- */
// Better Auth chuyển về trang với `?error=ACCOUNT_BANNED|ACCOUNT_UNAVAILABLE&error_description=<token>`.
// Token chỉ là khoá tra `GET /api/ban-notice`; chữ hiển thị chỉ lấy từ phản hồi của server (textContent),
// không bao giờ từ URL, nên liên kết giả không dựng được thông báo.

const BAN_ERROR_CODES = new Set(['ACCOUNT_BANNED', 'ACCOUNT_UNAVAILABLE']);

function banNoticeText(body) {
  if (body?.deleting === true) return L('Tài khoản đang được xoá.', '账号正在删除中。');
  const until = typeof body?.until === 'string' ? formatDateTime(body.until) : '';
  const head = until
    ? L(`Tài khoản đã bị khoá đến ${until}.`, `账号已被封禁至 ${until}。`)
    : L('Tài khoản đã bị khoá vĩnh viễn.', '账号已被永久封禁。');
  const reason = typeof body?.reason === 'string' && body.reason.trim() ? body.reason.trim() : '';
  return reason ? `${head} ${L('Lý do:', '理由：')} ${reason}` : head;
}

function showLoginNotice(mount, text) {
  if (currentMenu) return;
  const close = el('button', { class: 'cm-auth-notice-close', type: 'button', 'aria-label': L('Đóng thông báo', '关闭提示') }, '×');
  loginNotice = el('div', { class: 'cm-auth-menu cm-auth-notice' }, [el('p', { role: 'alert' }, text), close]);
  close.addEventListener('click', () => {
    loginNotice?.remove();
    loginNotice = null;
  });
  mount.append(loginNotice);
}

/** Xử lý `?error=` của lượt đăng nhập vừa bị chặn rồi bỏ `error`, `error_description` khỏi URL (giữ tham số và hash khác). */
async function handleBanRedirect(mount) {
  const params = new URLSearchParams(location.search);
  if (!BAN_ERROR_CODES.has(params.get('error') || '')) return;
  const token = params.get('error_description') || '';
  history.replaceState(history.state, '', urlWithoutAuthError().href);
  let text = L('Không đăng nhập được. Thử lại sau.', '无法登录，请稍后再试。');
  try {
    if (token) {
      const body = await api(`/api/ban-notice?token=${encodeURIComponent(token)}`);
      if (typeof body?.deleting === 'boolean') text = banNoticeText(body);
    }
  } catch {
    // Giữ câu cố định: không phân biệt lỗi để không lộ gì về token.
  }
  showLoginNotice(mount, text);
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
  handleBanRedirect(mount);
  loadSession({ probe: false }).catch(() => {
    // Dịch vụ không phản hồi: giữ nút đăng nhập, lỗi hiện khi người dùng bấm.
  });
}

initCommunityAuth();
