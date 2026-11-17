// Thẻ đội của trang Đội cộng đồng (thiết kế mới): thẻ lưới ở Danh sách (artboard DoiCongDongMoi) và thẻ ngang ở
// Đội của tôi (DoiCongDongMineMoi). Tên tướng/chiến pháp đi qua `names` (bộ tra tên nạp nền của community-teams.js)
// nên thẻ dựng ngay cả khi từ điển chưa tải xong. Văn bản người dùng luôn là text node.

import { L, formatNumber, htmlLang, isSiteLocale } from './i18n.js';
import { avatar, displayName, formatDateTime, timeNode } from './community-api.js';
import { seasonLabel, troopLabel } from './community-team-data.js';
import { el } from './render.js';
import {
  langBadge,
  statItem,
  teamIcon,
  teamImageCount,
  teamImageUrl,
  teamMedia,
  teamStatsLine,
  textLanguageName,
  troopPill,
} from './community-team-ui.js';

/** Ngày ngắn "20 thg 10" của dòng tác giả trên thẻ lưới (đủ ngày giờ nằm trong `title`). */
function shortDate(value, locale) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const text = new Intl.DateTimeFormat(htmlLang(locale), { day: 'numeric', month: 'short' }).format(date);
  return el('time', { class: 'cm-time', datetime: date.toISOString(), title: formatDateTime(value) }, text);
}

/**
 * Thẻ lưới Danh sách: ảnh (hoặc trạng thái "Chưa có ảnh đội"), tên + binh chủng, ba tướng, số liệu, tác giả, Chi tiết.
 * `titleLink(team, children, className)` dựng link tiêu đề (SPA hoặc URL tĩnh) — do trang truyền vào.
 */
export function listTeamCard(team, { names, locale, titleLink, headingTag = 'h2', showSeason = false }) {
  const more = titleLink(team, [L('Chi tiết', '详情', '詳細'), teamIcon('arrowRight')], 'cm-team-card-more');
  more.setAttribute('aria-label', L(`Chi tiết đội ${team.title}`, `阵容详情：${team.title}`, `編成の詳細：${team.title}`));
  return el('li', { class: 'cm-team-card', dataset: { teamId: team.id } }, [
    teamMedia(team),
    el('div', { class: 'cm-team-card-body' }, [
      el('div', { class: 'cm-team-card-top' }, [
        el(headingTag, { class: 'cm-team-card-heading' }, titleLink(team, team.title, 'cm-team-card-title')),
        troopPill(team.troop),
      ]),
      el('ul', { class: 'cm-team-card-heroes', 'aria-label': L('Ba tướng', '三名武将', '3人の武将') }, (team.heroes || []).map((id) => el('li', {}, [
        names.portrait(id, 'cm-team-card-portrait'),
        names.hero(id, 'cm-team-card-hero-name'),
      ]))),
      teamStatsLine(team),
      el('div', { class: 'cm-team-card-foot' }, [
        el('p', { class: 'cm-team-author' }, [
          avatar(team.author),
          el('span', { class: 'cm-team-author-name' }, displayName(team.author)),
          showSeason && team.season ? el('span', { class: 'cm-team-season' }, seasonLabel(team.season, locale)) : null,
          shortDate(team.createdAt, locale),
          langBadge(team.textLang),
        ]),
        more,
      ]),
    ]),
  ]);
}

const STATUS = {
  pending: { icon: 'clock', label: () => L('Đang chờ duyệt', '等待审核', '承認待ち') },
  rejected: { icon: 'xCircle', label: () => L('Bị từ chối', '未通过', '却下') },
  approved: { icon: 'checkCircle', label: () => L('Đã duyệt', '已通过', '承認済み') },
  deleting: { icon: 'clock', label: () => L('Đang xoá dở', '删除未完成', '削除未完了') },
};

/** Nhãn trạng thái duyệt có icon (`.cm-badge[data-status]`); giá trị lạ coi như chờ duyệt. */
export function statusBadge(status) {
  const key = Object.hasOwn(STATUS, status) ? status : 'pending';
  return el('span', { class: 'cm-badge cm-team-status', dataset: { status: key } }, [teamIcon(STATUS[key].icon, 14), STATUS[key].label()]);
}

/** Ngôn ngữ văn bản người dùng bằng chữ ("Tiếng Việt" / "Tiếng Trung"), theo ngôn ngữ trang; mã lạ → `null`. */
function textLangName(lang) {
  return isSiteLocale(lang) ? textLanguageName(lang) : null;
}

function mineCallout(team) {
  if (team.deleting === true) {
    return el('div', { class: 'cm-team-callout', dataset: { kind: 'pending' } }, [
      teamIcon('info'),
      el('p', {}, L('Lượt xoá trước chưa xong. Bấm "Thử xoá tiếp" để xoá nốt ảnh và dữ liệu.', '上次删除未完成。点击“继续删除”以删除剩余图片和数据。', '前回の削除が完了していません。「削除を再試行」を押して、残りの画像とデータを削除してください。')),
    ]);
  }
  if (team.status === 'rejected') {
    return el('div', { class: 'cm-team-callout cm-reject-reason', dataset: { kind: 'rejected' } }, [
      teamIcon('xCircle'),
      el('div', { class: 'cm-team-callout-text' }, [
        el('p', {}, [el('strong', {}, L('Lý do từ chối: ', '拒绝原因：', '却下理由：')), String(team.rejectReason || '—')]),
        el('p', {}, L('Đội không hiện công khai. Bạn có thể xoá đội này rồi đăng lại với ảnh rõ hơn.', '阵容不会公开显示。你可以删除后用更清晰的图片重新发布。', '編成は公開されません。削除して、より鮮明な画像で投稿し直してください。')),
      ]),
    ]);
  }
  if (team.status === 'approved') return null;
  return el('div', { class: 'cm-team-callout', dataset: { kind: 'pending' } }, [
    teamIcon('info'),
    el('p', {}, L(
      'Quản trị viên đang xem ảnh và đội hình. Cho tới khi được duyệt, chỉ bạn và quản trị viên xem được đội này.',
      '管理员正在查看图片和阵容。审核通过前，只有你和管理员可以看到此阵容。',
      '管理者が画像と編成を確認中です。承認されるまで、この編成はあなたと管理者のみ閲覧できます。',
    )),
  ]);
}

/**
 * Thẻ ngang "Đội của tôi": ảnh, tên + meta + trạng thái, ba tướng kèm hai chiến pháp, lời nhắn theo trạng thái,
 * chân thẻ (số liệu khi đã duyệt, nút xem/đăng lại, nút Xoá). `removeButton` do trang dựng (gắn hộp xác nhận).
 */
export function mineTeamCard(team, { names, locale, titleLink, newHref, removeButton }) {
  const status = team.deleting === true ? 'deleting' : team.status;
  const count = teamImageCount(team);
  const thumb = count
    ? titleLink(team, el('img', { class: 'cm-team-thumb', src: teamImageUrl(team.id, 0), alt: '', loading: 'lazy', decoding: 'async' }), 'cm-team-mine-thumb')
    : el('div', { class: 'cm-team-mine-thumb', dataset: { empty: 'true' } }, [teamIcon('imageOff', 22), el('span', {}, L('Chưa có ảnh đội', '暂无阵容图片', '編成画像なし'))]);
  if (count) thumb.setAttribute('tabindex', '-1');
  if (count) thumb.setAttribute('aria-hidden', 'true');

  const meta = [
    team.season ? seasonLabel(team.season, locale) : null,
    troopLabel(team.troop),
    textLangName(team.textLang),
  ].filter(Boolean).map((text) => el('span', {}, text));
  const sent = timeNode(team.createdAt);
  if (sent) meta.push(el('span', {}, [L('Gửi ', '提交于 ', '送信日：'), sent]));

  const lineup = el('ul', { class: 'cm-team-lineup', 'aria-label': L('Đội hình', '阵容', '編成') }, (team.heroes || []).map((id, index) => el('li', {}, [
    names.portrait(id, 'cm-team-mini-portrait'),
    el('span', { class: 'cm-team-lineup-text' }, [
      names.hero(id, 'cm-team-lineup-hero'),
      el('span', { class: 'cm-team-lineup-tactics' }, (team.tactics?.[index] || []).flatMap((tactic, position) => [
        position ? ' · ' : null,
        names.tactic(tactic),
      ]).filter(Boolean)),
    ]),
  ])));

  let primary = null;
  if (status === 'rejected') {
    primary = el('a', { class: 'cm-team-btn', href: newHref }, [teamIcon('plus'), L('Đăng đội mới', '发布新阵容', '新しい編成を投稿')]);
  } else if (status !== 'deleting') {
    primary = titleLink(team, [status === 'approved' ? L('Xem trang đội', '查看阵容页', '編成ページを見る') : L('Xem đội', '查看阵容', '編成を見る'), teamIcon('arrowRight')], 'cm-team-btn');
  }

  return el('li', { class: 'cm-team-card cm-team-mine-card', dataset: { teamId: team.id, status } }, [
    thumb,
    el('div', { class: 'cm-team-mine-body' }, [
      el('div', { class: 'cm-team-mine-top' }, [
        el('div', { class: 'cm-team-mine-id' }, [
          el('h3', { class: 'cm-team-card-heading' }, titleLink(team, team.title, 'cm-team-card-title')),
          el('p', { class: 'cm-team-mine-meta' }, meta),
        ]),
        statusBadge(status),
      ]),
      lineup,
      mineCallout(team),
      el('div', { class: 'cm-team-mine-foot' }, [
        status === 'approved'
          ? el('p', { class: 'cm-team-mine-stats' }, [
              statItem('chevronUp', team.upVotes, L('Bình chọn lên', '赞成票', '賛成票'), { visible: L('lên', '赞', '賛成') }),
              statItem('chevronDown', team.downVotes, L('Bình chọn xuống', '反对票', '反対票'), { visible: L('xuống', '踩', '反対') }),
              statItem('trophy', team.evidenceCount, L('Người thắng', '获胜玩家', '勝利プレイヤー'), { visible: L('người thắng', '人获胜', '人が勝利') }),
              statItem('comment', team.commentCount, L('Bình luận', '评论', 'コメント'), { visible: L('bình luận', '条评论', '件のコメント') }),
            ])
          : null,
        el('div', { class: 'cm-team-mine-actions' }, [primary, removeButton]),
      ]),
    ]),
  ]);
}

/** Bảng đếm theo trạng thái ở cột phải "Đội của tôi". */
export function mineTally(items) {
  const counts = { pending: 0, rejected: 0, approved: 0 };
  for (const team of items) if (Object.hasOwn(counts, team.status)) counts[team.status] += 1;
  return el('ul', { class: 'cm-team-tally' }, Object.keys(counts).map((key) => el('li', { dataset: { status: key } }, [
    statusBadge(key),
    el('span', { class: 'cm-team-tally-num' }, formatNumber(counts[key])),
  ])));
}
