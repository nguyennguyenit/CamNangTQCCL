// Điểm mount cộng đồng của ba họ trang chi tiết đội (`#community-root` nằm sau bài chi tiết):
// chiến báo thực chiến rồi bình luận. Dịch vụ cộng đồng không phản hồi thì chỉ khối này hiện lời nhắn ngắn;
// phần chi tiết đội phía trên không bị ảnh hưởng.

import { currentLocale, stripLocale } from './i18n.js';
import { PAGE_KEY_PATTERN, loadSession, unavailableNotice } from './community-api.js';
import { mountComments } from './community-comments.js';
import { mountReports } from './community-reports.js';

/** pageKey = pathname canonical không có tiền tố locale, luôn kết thúc bằng `/`. */
export function pageKeyFrom(pathname) {
  let path = stripLocale(pathname);
  try {
    path = decodeURIComponent(path);
  } catch {
    return null;
  }
  if (!path.endsWith('/')) path += '/';
  return PAGE_KEY_PATTERN.test(path) ? path : null;
}

export async function initCommunityPage(root = document.getElementById('community-root')) {
  if (!root) return;
  const pageKey = pageKeyFrom(location.pathname);
  if (!pageKey) {
    root.hidden = true;
    return;
  }
  const lang = currentLocale();
  root.setAttribute('aria-busy', 'true');
  try {
    const user = await loadSession({ probe: true });
    const reports = mountReports(root, { pageKey, lang, user });
    const comments = mountComments(root, { pageKey, lang, user });
    await Promise.all([reports.load(), comments.load()]);
  } catch {
    // Lỗi nạp ban đầu (503, mạng, proxy vắng): thay cả khối bằng một lời nhắn.
    root.replaceChildren(unavailableNotice());
  } finally {
    root.removeAttribute('aria-busy');
  }
}

initCommunityPage();
