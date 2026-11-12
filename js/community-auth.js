// Widget đăng nhập ở header (mọi trang): nút "Đăng nhập" hoặc ảnh đại diện + menu (Chiến báo của tôi,
// Quản trị nếu là admin, Đăng xuất). Menu dùng chung `createDropdownMenu` của js/site-nav.js:
// `aria-expanded`, Escape đóng và trả focus về nút, bấm ra ngoài hoặc Tab ra khỏi menu thì đóng.

import { L, localePath } from './i18n.js';
import { el, icon, svgNode } from './render.js';
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
      el('li', {}, el('a', { class: 'cm-auth-item', href: localePath('/doi-cua-toi/') }, L('Đội của tôi', '我的阵容'))),
      el('li', {}, el('a', { class: 'cm-auth-item', href: localePath('/chien-bao/') }, L('Chiến báo của tôi', '我的战报'))),
      el('li', {}, el('a', { class: 'cm-auth-item', href: localePath('/doi-cong-dong/') }, L('Đội cộng đồng', '社区阵容'))),
      el('li', {}, el('a', { class: 'cm-auth-item', href: localePath('/doi-cong-dong/?mine=1') }, L('Đội đã đăng', '我发布的阵容'))),
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

/**
 * Nội dung thông báo (artboard BanNoticeMoi): dòng đậm nói thời hạn khoá ("đến <ngày giờ>" hoặc "vĩnh viễn"),
 * dòng lý do nếu có. Tài khoản đang xoá chỉ có dòng đậm. `until` là ISO từ server hoặc `null` = vĩnh viễn.
 */
export function banNoticeContent(body) {
  if (body?.deleting === true) return { title: L('Tài khoản đang được xoá.', '账号正在删除中。'), reason: '', banned: false };
  const until = typeof body?.until === 'string' ? formatDateTime(body.until) : '';
  const title = until
    ? L(`Tài khoản đã bị khoá đến ${until}.`, `账号已被封禁至 ${until}。`)
    : L('Tài khoản đã bị khoá vĩnh viễn.', '账号已被永久封禁。');
  const reason = typeof body?.reason === 'string' && body.reason.trim() ? body.reason.trim() : '';
  return { title, reason, banned: true };
}

const noticeIcon = (paths, size) => icon(paths.map((d) => svgNode('path', { d })), { size });

/** Hộp thông báo dưới nút đăng nhập: icon khoá | chữ (role=alert) + gợi ý + link quy tắc | nút đóng cùng hàng. */
function showLoginNotice(mount, { title, reason = '', banned = false }) {
  if (currentMenu) return;
  const close = el('button', { class: 'cm-auth-notice-close', type: 'button', 'aria-label': L('Đóng thông báo', '关闭提示') },
    noticeIcon(['M18 6L6 18', 'M6 6l12 12'], 18));
  loginNotice = el('div', { class: 'cm-auth-menu cm-auth-notice' }, [
    el('span', { class: 'cm-auth-notice-ico', 'aria-hidden': 'true' },
      noticeIcon(['M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z', 'M7 11V7a5 5 0 0 1 10 0v4'], 18)),
    el('div', { class: 'cm-auth-notice-body' }, [
      el('p', { class: 'cm-auth-notice-msg', role: 'alert' }, [
        el('strong', { class: 'cm-auth-notice-title' }, title),
        reason
          ? el('span', { class: 'cm-auth-notice-text' }, [el('span', { class: 'cm-auth-notice-key' }, L('Lý do:', '理由：')), ` ${reason}`])
          : null,
      ]),
      banned ? el('p', { class: 'cm-auth-notice-hint' }, L('Bạn vẫn đọc được cẩm nang khi chưa đăng nhập.', '未登录也可以继续阅读攻略手册。')) : null,
      banned ? el('a', { class: 'cm-auth-notice-link', href: localePath('/quy-tac-cong-dong/') }, L('Xem Quy tắc cộng đồng', '查看社区规则')) : null,
    ]),
    close,
  ]);
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
  let content = { title: L('Không đăng nhập được. Thử lại sau.', '无法登录，请稍后再试。') };
  try {
    if (token) {
      const body = await api(`/api/ban-notice?token=${encodeURIComponent(token)}`);
      if (typeof body?.deleting === 'boolean') content = banNoticeContent(body);
    }
  } catch {
    // Giữ câu cố định: không phân biệt lỗi để không lộ gì về token.
  }
  showLoginNotice(mount, content);
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
