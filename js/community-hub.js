// Trang /chien-bao/: "Chiến báo của tôi" kèm trạng thái duyệt (chờ duyệt, đã duyệt, bị từ chối + lý do).
// Hướng dẫn đóng góp là HTML tĩnh trong src/components/community/ReportsHub.astro.

import { L, currentLocale } from './i18n.js';
import { el } from './render.js';
import { api, communityPageHref, loadSession, signInPrompt, timeNode, unavailableNotice } from './community-api.js';
import { reportSummary } from './community-reports.js';

const STATUS_LABELS = {
  pending: () => L('Đang chờ duyệt', '等待审核'),
  approved: () => L('Đã duyệt', '已通过'),
  rejected: () => L('Bị từ chối', '未通过'),
};

function teamLink(pageKey) {
  if (typeof pageKey !== 'string' || !pageKey.startsWith('/')) return null;
  return el('a', { class: 'cm-link', href: communityPageHref(pageKey) }, L('Mở trang đội', '打开阵容页面'));
}

function myReportItem(report) {
  const status = Object.hasOwn(STATUS_LABELS, report?.status) ? report.status : 'pending';
  return el('li', { class: 'cm-report cm-my-report' }, [
    el('p', { class: 'cm-report-meta' }, [
      el('span', { class: 'cm-badge', dataset: { status } }, STATUS_LABELS[status]()),
      timeNode(report.createdAt),
      teamLink(report.page),
    ]),
    reportSummary(report),
    status === 'rejected' && report.rejectReason
      ? el('p', { class: 'cm-reject-reason' }, [
          el('strong', {}, L('Lý do: ', '原因：')),
          String(report.rejectReason),
        ])
      : null,
  ]);
}

export async function initCommunityHub(mount = document.getElementById('community-hub')) {
  if (!mount) return;
  const lang = currentLocale();
  mount.setAttribute('aria-busy', 'true');
  try {
    const user = await loadSession({ probe: true });
    if (!user) {
      mount.replaceChildren(signInPrompt(L('Đăng nhập để xem chiến báo bạn đã gửi.', '登录后即可查看你提交的战报。')));
      return;
    }
    const body = await api('/api/me/reports');
    const items = (Array.isArray(body?.items) ? body.items : []).filter((item) => item?.lang === lang);
    mount.replaceChildren(items.length
      ? el('ol', { class: 'cm-report-list' }, items.map(myReportItem))
      : el('p', { class: 'scope-note cm-empty' }, L(
          'Bạn chưa gửi chiến báo nào. Mở một trang đội và dùng mục "Chiến báo thực chiến" để gửi.',
          '你还没有提交战报。打开任一阵容页面，在“实战战报”区域提交即可。',
        )));
  } catch {
    mount.replaceChildren(unavailableNotice());
  } finally {
    mount.removeAttribute('aria-busy');
  }
}

initCommunityHub();
