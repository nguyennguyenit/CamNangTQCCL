// Lớp gọi API cộng đồng (same-origin `/api`, qua Pages Function proxy) dùng chung cho mọi widget cộng đồng.
// Lỗi JSON `{error:{code,message}}` của server không bao giờ hiện nguyên văn: luôn đổi sang câu song ngữ
// theo mã trạng thái, giống cách js/analyze.js chặn văn bản upstream.

import { L, currentLocale, formatDate } from './i18n.js';
import { el, icon, svgNode } from './render.js';

/** Khoá localStorage ghi "có thể đang đăng nhập": trang thường chỉ hỏi `/api/me` khi có dấu này. */
const SESSION_HINT_KEY = 'tqccl:community-session';
export const SESSION_EVENT = 'community:session';
export const PAGE_KEY_PATTERN = /^\/(doi-chuan|doi-khac|khai-hoang)\/[a-z0-9][a-z0-9-]{0,120}\/$/;
export const COMMENT_MAX_LENGTH = 2000;
const IMAGE_MAX_DIM = 1600;
const IMAGE_JPEG_QUALITY = 0.82;

/** Lỗi đã bản địa hoá; `unavailable` = dịch vụ cộng đồng không phản hồi (503, mạng, không phải JSON). */
export class CommunityError extends Error {
  constructor(message, { status = 0, code = '', unavailable = false } = {}) {
    super(message);
    this.name = 'CommunityError';
    this.status = status;
    this.code = code;
    this.unavailable = unavailable;
  }
}

function unavailableMessage() {
  return L('Tính năng cộng đồng tạm thời không khả dụng. Vui lòng thử lại sau.', '社区功能暂时不可用，请稍后再试。');
}

function statusMessage(status) {
  switch (status) {
    case 400:
    case 422:
      return L('Dữ liệu gửi lên chưa hợp lệ. Hãy kiểm tra lại.', '提交的内容无效，请检查后重试。');
    case 401:
      return L('Bạn cần đăng nhập để làm việc này.', '请先登录再进行此操作。');
    case 403:
      return L('Bạn không có quyền làm việc này.', '你没有执行此操作的权限。');
    case 404:
      return L('Không tìm thấy nội dung yêu cầu.', '找不到请求的内容。');
    case 409:
      return L('Nội dung bị trùng với mục đã có.', '内容与已有条目重复。');
    case 413:
      return L('Ảnh quá lớn. Hãy chọn ảnh nhỏ hơn.', '图片太大，请选择更小的图片。');
    case 415:
      return L('Định dạng ảnh không được hỗ trợ (chỉ JPEG, PNG, WebP).', '不支持该图片格式（仅支持 JPEG、PNG、WebP）。');
    case 429:
      return L('Bạn thao tác quá nhanh. Hãy thử lại sau ít phút.', '操作过于频繁，请几分钟后再试。');
    default:
      return L('Không thể hoàn tất thao tác. Vui lòng thử lại.', '无法完成操作，请重试。');
  }
}

/** Mã lỗi cụ thể của community-worker có câu riêng; mã lạ rơi về câu theo trạng thái HTTP. */
function codeMessage(code) {
  switch (code) {
    case 'ai_overloaded':
    case 'ai_unavailable':
      return L('Dịch vụ AI đang bận. Hãy thử lại sau ít phút.', 'AI 服务繁忙，请几分钟后再试。');
    case 'ai_not_configured':
    case 'feature_disabled':
      return L('Tính năng này hiện chưa được bật.', '该功能暂未开启。');
    case 'slug_taken':
      return L('Slug này đã được dùng cho một bài cùng ngôn ngữ.', '同一语言中已有文章使用此 slug。');
    case 'translation_key_taken':
      return L('Khoá bản dịch này đã có bài cùng ngôn ngữ.', '同一语言中已有文章使用此译文关联键。');
    case 'invalid_upload':
      return L('Ảnh đã tải lên không còn hợp lệ. Hãy chọn lại ảnh.', '上传的图片已失效，请重新选择。');
    case 'ai_secret_missing':
      return L('Worker chưa có secret AI_CONFIG_SECRET nên chưa lưu được nhà cung cấp AI.', 'Worker 尚未设置 AI_CONFIG_SECRET，无法保存 AI 服务商。');
    case 'missing_api_key':
      return L('Nhà cung cấp mới cần API key.', '新服务商需要 API 密钥。');
    case 'invalid_endpoint':
      return L('Endpoint phải là URL https hợp lệ.', 'Endpoint 必须是有效的 https URL。');
    default:
      return null;
  }
}

/** Câu hiển thị an toàn cho bất kỳ lỗi nào. */
export function describeError(error) {
  return error instanceof CommunityError ? error.message : statusMessage(0);
}

/**
 * Gọi `/api/...`. `json` gửi thân JSON, `form` gửi multipart. Trả JSON đã parse;
 * mọi thất bại ném `CommunityError` với câu song ngữ.
 */
export async function api(path, { method = 'GET', json, form, signal } = {}) {
  const init = { method, credentials: 'same-origin', headers: { Accept: 'application/json' }, signal };
  if (json !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(json);
  } else if (form) {
    init.body = form;
  }
  let response;
  try {
    response = await fetch(path, init);
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new CommunityError(unavailableMessage(), { unavailable: true });
  }
  const isJson = (response.headers.get('content-type') || '').includes('application/json');
  let body = null;
  if (isJson) {
    try {
      body = await response.json();
    } catch {
      body = null;
    }
  }
  if (response.ok && isJson) return body;
  const code = typeof body?.error?.code === 'string' ? body.error.code : '';
  const specific = codeMessage(code);
  if (specific) throw new CommunityError(specific, { status: response.status, code });
  // Proxy/Worker vắng mặt trả HTML hoặc 5xx: coi là dịch vụ không khả dụng, không phải lỗi người dùng.
  if (!isJson || response.status >= 500) {
    throw new CommunityError(unavailableMessage(), { status: response.status, code, unavailable: true });
  }
  throw new CommunityError(statusMessage(response.status), { status: response.status, code });
}

/* ---------- Phiên đăng nhập ---------- */

function readHint() {
  try {
    return localStorage.getItem(SESSION_HINT_KEY);
  } catch {
    return null;
  }
}

function writeHint(value) {
  try {
    if (value) localStorage.setItem(SESSION_HINT_KEY, value);
    else localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    // Trình duyệt chặn storage: chỉ mất tối ưu "không hỏi phiên", chức năng vẫn chạy.
  }
}

let sessionPromise = null;

/**
 * Người dùng hiện tại (`{id,name,image,isAdmin}` | null).
 * `probe: false` (header trên trang thường): chỉ hỏi server khi trình duyệt từng đăng nhập,
 * để khách vãng lai không tốn một lượt gọi API mỗi trang. Trang cộng đồng luôn `probe: true`.
 */
export function loadSession({ probe = true } = {}) {
  if (sessionPromise) return sessionPromise;
  if (!probe && !readHint()) return Promise.resolve(null);
  sessionPromise = api('/api/me').then(
    (body) => {
      const user = body?.user && typeof body.user === 'object' ? body.user : null;
      writeHint(user ? '1' : null);
      document.dispatchEvent(new CustomEvent(SESSION_EVENT, { detail: { user } }));
      return user;
    },
    (error) => {
      sessionPromise = null;
      throw error;
    },
  );
  return sessionPromise;
}

/** Đăng nhập Google: server trả URL OAuth, trình duyệt rời trang; quay về đúng trang đang xem. */
export async function signIn() {
  writeHint('pending');
  try {
    const body = await api('/api/auth/sign-in/social', {
      method: 'POST',
      json: { provider: 'google', callbackURL: location.href },
    });
    const url = new URL(String(body?.url || ''), location.href);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new CommunityError(statusMessage(0));
    location.assign(url.href);
  } catch (error) {
    writeHint(null);
    throw error;
  }
}

export async function signOut() {
  await api('/api/auth/sign-out', { method: 'POST', json: {} });
  writeHint(null);
  location.reload();
}

/* ---------- Ảnh ---------- */

/** Thu nhỏ ảnh về cạnh dài ≤ 1600px, JPEG ~0.82 trước khi tải lên (như js/analyze.js). */
export function downscaleImage(file, { maxDim = IMAGE_MAX_DIM, quality = IMAGE_JPEG_QUALITY } = {}) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    const fail = () => {
      URL.revokeObjectURL(url);
      reject(new CommunityError(L('Không đọc được ảnh. Hãy chọn ảnh khác.', '无法读取图片，请换一张。')));
    };
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => (blob ? resolve(blob) : fail()), 'image/jpeg', quality);
    };
    img.onerror = fail;
    img.src = url;
  });
}

/* ---------- Mảnh UI dùng chung ---------- */

export function formatDateTime(value) {
  return formatDate(value, currentLocale(), { dateStyle: 'medium', timeStyle: 'short' });
}

/** Thẻ `<time>` có `datetime` máy đọc được. */
export function timeNode(value) {
  const text = formatDateTime(value);
  if (!text) return null;
  // formatDate đã loại giá trị không hợp lệ nên toISOString an toàn.
  return el('time', { class: 'cm-time', datetime: new Date(value).toISOString() }, text);
}

/** Ảnh đại diện Google (không gửi Referer); thiếu ảnh thì dùng chữ cái đầu. */
export function avatar(user, className = 'cm-avatar') {
  const name = String(user?.name || '').trim();
  if (typeof user?.image === 'string' && /^https:\/\//.test(user.image)) {
    return el('img', {
      class: className,
      src: user.image,
      alt: '',
      width: '32',
      height: '32',
      loading: 'lazy',
      decoding: 'async',
      referrerpolicy: 'no-referrer',
    });
  }
  return el('span', { class: `${className} cm-avatar-fallback`, 'aria-hidden': 'true' }, name ? name[0].toUpperCase() : '?');
}

export function displayName(user) {
  return String(user?.name || '').trim() || L('Người chơi', '玩家');
}

/** Vùng thông báo trực tiếp cho trình đọc màn hình. */
export function liveStatus(className = 'cm-status') {
  const node = el('p', { class: className, role: 'status', 'aria-live': 'polite' });
  node.set = (message, kind = '') => {
    node.textContent = message || '';
    node.dataset.kind = kind;
    node.hidden = !message;
  };
  node.hidden = true;
  return node;
}

/** Hộp mời đăng nhập Google, dùng cho bình luận, chiến báo, trang hub. */
export function signInPrompt(message) {
  const status = liveStatus();
  const button = el('button', { class: 'ana-btn primary cm-signin-btn', type: 'button' }, [
    googleIcon(),
    L('Đăng nhập bằng Google', '使用 Google 登录'),
  ]);
  button.addEventListener('click', async () => {
    button.disabled = true;
    status.set(L('Đang chuyển tới Google…', '正在跳转到 Google…'));
    try {
      await signIn();
    } catch (error) {
      button.disabled = false;
      status.set(describeError(error), 'error');
    }
  });
  return el('div', { class: 'cm-signin' }, [el('p', { class: 'cm-signin-text' }, message), button, status]);
}

/** Thông báo ngắn khi dịch vụ cộng đồng không phản hồi; phần còn lại của trang không bị ảnh hưởng. */
export function unavailableNotice() {
  return el('p', { class: 'cm-notice', role: 'note' }, unavailableMessage());
}

export function googleIcon() {
  return svgNode('svg', { 'aria-hidden': 'true', width: 18, height: 18, viewBox: '0 0 24 24', class: 'cm-google' }, [
    svgNode('path', { fill: 'currentColor', d: 'M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z' }),
    svgNode('path', { fill: 'currentColor', d: 'M12 22c2.7 0 5-.9 6.6-2.5l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z', opacity: '.8' }),
    svgNode('path', { fill: 'currentColor', d: 'M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9z', opacity: '.6' }),
    svgNode('path', { fill: 'currentColor', d: 'M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.8 9.4 6 12 6z', opacity: '.9' }),
  ]);
}

export function userIcon() {
  return icon([
    svgNode('circle', { cx: 12, cy: 8, r: 4 }),
    svgNode('path', { d: 'M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5' }),
  ]);
}

/** Tách danh sách tên tướng người dùng nhập (dấu phẩy Việt/Trung, chấm phẩy, xuống dòng). */
export function splitNames(value, max = 5) {
  const seen = new Set();
  const names = [];
  for (const part of String(value || '').split(/[,，、;；\n]+/u)) {
    const name = part.trim().slice(0, 40);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
    if (names.length >= max) break;
  }
  return names;
}

export function resultLabel(result) {
  if (result === 'win') return L('Thắng', '胜');
  if (result === 'loss') return L('Thua', '负');
  if (result === 'draw') return L('Hoà', '平');
  return L('Chưa rõ', '未知');
}

export function formatPercent(ratio) {
  return new Intl.NumberFormat(L('vi-VN', 'zh-CN'), { style: 'percent', maximumFractionDigits: 0 }).format(ratio);
}
