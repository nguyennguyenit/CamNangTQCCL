// Trang chi tiết một đội cộng đồng (thiết kế mới, artboard DoiCongDongDetailMoi): khung chung cho chế độ SPA
// `?id=` (đội chưa duyệt, hoặc đã duyệt mà trang tĩnh chưa build) và các mảnh sống gắn vào trang tĩnh
// `/doi-cong-dong/<id>/` (CommunityTeamPage.astro dựng cùng cấu trúc class lúc build).
//
// Bố cục: lưới hai cột `.cm-team-detail-page` — đầu trang (tên đội h1 + meta | bảng điểm) trải hai cột; cột trái
// Đội hình, Phân tích, rồi chiến báo + bình luận; cột phải Ảnh đội + Đội tương tự. Ở bề rộng hẹp còn một cột và
// thứ tự đổi theo artboard mobile (ảnh lên trước đội hình, đội tương tự xuống cuối).

import { L, formatNumber } from './i18n.js';
import { avatar, displayName, timeNode } from './community-api.js';
import { seasonLabel } from './community-team-data.js';
import { el } from './render.js';
import { langBadge, teamIcon, teamImageCount, teamImageUrl, troopPill } from './community-team-ui.js';

export const ANALYSIS_FIELDS = [
  ['playstyle', () => L('Lối chơi', '打法')],
  ['strengths', () => L('Điểm mạnh', '优点')],
  ['weaknesses', () => L('Điểm yếu', '缺点')],
  ['counters', () => L('Khắc chế', '克制')],
  ['counteredBy', () => L('Bị khắc chế bởi', '被克制于')],
  ['substitutes', () => L('Thay thế', '替补')],
];

/** Vai trò theo vị trí trong bài đăng: tướng đầu là chủ tướng. */
export const heroRole = (index) => (index === 0 ? L('Chủ tướng', '主将') : L(`Phó tướng ${index}`, `副将 ${index}`));

/** Link "← Về danh sách đội cộng đồng". */
export function backNav(href) {
  return el('nav', { class: 'cm-team-back', 'aria-label': L('Quay lại danh sách đội', '返回阵容列表') }, [
    el('a', { class: 'cm-team-back-link', href }, [teamIcon('arrowLeft'), L('Về danh sách đội cộng đồng', '返回社区阵容列表')]),
  ]);
}

/** Đầu trang chi tiết: nhãn mùa, tên đội (h1), dòng meta; ô `side` bên phải để gắn bảng điểm / trạng thái. */
function detailHead(team, locale) {
  const season = team.season ? seasonLabel(team.season, locale) : '';
  const approvedAt = team.status === 'approved' ? timeNode(team.approvedAt || team.createdAt) : null;
  const sentAt = team.status !== 'approved' ? timeNode(team.createdAt) : null;
  const side = el('div', { class: 'cm-team-detail-side' });
  const head = el('header', { class: 'cm-team-detail-head' }, [
    el('div', { class: 'cm-team-detail-id' }, [
      el('p', { class: 'cm-team-kicker' }, season ? L(`Đội cộng đồng · ${season}`, `社区阵容 · ${season}`) : L('Đội cộng đồng', '社区阵容')),
      el('h1', { class: 'cm-team-detail-title cm-team-heading', tabindex: '-1', lang: team.textLang === 'zh' ? 'zh-Hans' : 'vi' }, team.title),
      el('p', { class: 'cm-team-detail-meta cm-team-meta' }, [
        troopPill(team.troop),
        langBadge(team.textLang),
        el('span', { class: 'cm-team-detail-author' }, [
          avatar(team.author),
          el('span', {}, [L('Tác giả: ', '作者：'), el('strong', {}, displayName(team.author))]),
        ]),
        approvedAt ? el('span', { class: 'cm-team-detail-date' }, [L('Duyệt lúc ', '审核于 '), approvedAt]) : null,
        sentAt ? el('span', { class: 'cm-team-detail-date' }, [L('Gửi lúc ', '提交于 '), sentAt]) : null,
      ]),
    ]),
    side,
  ]);
  return { head, side };
}

/** Thẻ một tướng trong "Đội hình": chân dung, vai trò, tên (h3), hai chiến pháp A/B. */
function heroCard(team, index, names) {
  const heroId = team.heroes[index];
  return el('li', { class: 'cm-team-hero-card' }, [
    el('div', { class: 'cm-team-hero-card-id' }, [
      names.portrait(heroId, 'cm-team-hero-card-portrait'),
      el('div', { class: 'cm-team-hero-card-text' }, [
        el('span', { class: 'cm-team-caps' }, heroRole(index)),
        el('h3', { class: 'cm-team-hero-card-name', dataset: { heroId } }, names.hero(heroId, 'cm-team-hero-card-label')),
      ]),
    ]),
    el('div', { class: 'cm-team-hero-card-tactics' }, [
      el('span', { class: 'cm-team-caps' }, L('Chiến pháp', '战法')),
      el('ol', { class: 'cm-team-tactic-list' }, (team.tactics?.[index] || []).map((tacticId, position) => el('li', {}, [
        el('span', { class: 'cm-team-tactic-link', dataset: { tacticId } }, [
          el('span', { class: 'cm-team-tactic-slot', 'aria-hidden': 'true' }, position ? 'B' : 'A'),
          el('span', { class: 'cm-team-tactic-name' }, names.tactic(tacticId)),
        ]),
      ]))),
    ]),
  ]);
}

/** Khối "Đội hình" (3 thẻ tướng). */
function lineupSection(team, names) {
  return el('section', { class: 'cm-team-lineup-section', 'aria-labelledby': 'cm-team-lineup-title' }, [
    el('div', { class: 'cm-team-section-head' }, [
      el('h2', { id: 'cm-team-lineup-title', class: 'cm-team-section-title' }, L('Đội hình', '阵容')),
      el('p', { class: 'cm-team-section-note' }, L('Tướng đứng đầu bài đăng là chủ tướng', '排在首位的武将为主将')),
    ]),
    el('ol', { class: 'cm-team-hero-cards' }, team.heroes.map((_, index) => heroCard(team, index, names))),
  ]);
}

/** Khối "Phân tích của tác giả" (chỉ các mục có chữ). */
function analysisSection(team) {
  const rows = ANALYSIS_FIELDS.flatMap(([key, label]) => {
    const text = team.analysis?.[key];
    if (typeof text !== 'string' || !text.trim()) return [];
    return [el('div', { class: 'cm-team-analysis-item' }, [
      el('dt', {}, [label(), ' ', langBadge(team.textLang)]),
      el('dd', { class: 'cm-team-text', lang: team.textLang === 'zh' ? 'zh-Hans' : 'vi' }, text),
    ])];
  });
  if (!rows.length) return null;
  return el('section', { class: 'cm-team-analysis-section', 'aria-labelledby': 'cm-team-analysis-title' }, [
    el('div', { class: 'cm-team-section-head' }, [
      el('h2', { id: 'cm-team-analysis-title', class: 'cm-team-section-title' }, L('Phân tích của tác giả', '作者分析')),
      el('p', { class: 'cm-team-section-note' }, [
        langBadge(team.textLang),
        team.textLang === 'zh' ? L('Viết bằng tiếng Trung', '以中文撰写') : L('Viết bằng tiếng Việt', '以越南语撰写'),
      ]),
    ]),
    el('dl', { class: 'cm-team-analysis' }, rows),
  ]);
}

/** Thẻ "Ảnh đội" ở cột phải: ảnh mở tab mới + ghi chú; đội không ảnh hiện trạng thái riêng. */
export function photosCard(team) {
  const count = teamImageCount(team);
  const images = Array.from({ length: count }, (_, position) => el('a', {
    class: 'cm-team-image-link',
    href: teamImageUrl(team.id, position),
    target: '_blank',
    rel: 'noopener',
  }, [
    el('img', {
      class: 'cm-team-image',
      src: teamImageUrl(team.id, position),
      alt: L(`Ảnh ${position + 1} của đội`, `阵容图片 ${position + 1}`),
      loading: 'lazy',
      decoding: 'async',
    }),
    el('span', { class: 'cm-team-image-open', 'aria-hidden': 'true' }, teamIcon('external', 14)),
    el('span', { class: 'visually-hidden' }, L('(mở tab mới)', '（在新标签页打开）')),
  ]));
  return el('section', { class: 'cm-team-aside-card cm-team-photos', 'aria-labelledby': 'cm-team-photos-title' }, [
    el('div', { class: 'cm-team-aside-head' }, [
      el('h2', { id: 'cm-team-photos-title', class: 'cm-team-aside-title' }, L('Ảnh đội', '阵容图片')),
      el('span', { class: 'cm-team-aside-count' }, L(`${count} ảnh`, `${count} 张`)),
    ]),
    count
      ? el('div', { class: 'cm-team-images' }, images)
      : el('div', { class: 'cm-team-card-media', dataset: { empty: 'true' } }, [
          teamIcon('imageOff', 22),
          el('span', { class: 'cm-team-media-empty-title' }, L('Chưa có ảnh đội', '暂无阵容图片')),
          el('span', { class: 'cm-team-media-empty-hint' }, L('Đội hình vẫn xem được bên dưới', '阵容仍可在下方查看')),
        ]),
    count ? el('p', { class: 'cm-team-aside-note' }, L('Bấm để mở ảnh gốc trong tab mới. Tác giả đăng 1–3 ảnh đội hình khi gửi bài.', '点击在新标签页打开原图。作者发布时上传 1–3 张阵容图。')) : null,
  ]);
}

/** Thẻ "Đội tương tự" (ẩn tới khi có kết quả). `fill(items, heroLabels)` vẽ danh sách. */
export function similarCard({ teamLink, locale }) {
  const subtitle = el('p', { class: 'cm-team-aside-note' });
  const list = el('ul', { class: 'cm-team-similar-list' });
  const card = el('section', { class: 'cm-team-aside-card cm-team-similar', 'aria-labelledby': 'cm-team-similar-title', hidden: '' }, [
    el('h2', { id: 'cm-team-similar-title', class: 'cm-team-aside-title' }, L('Đội tương tự', '相似阵容')),
    subtitle,
    list,
  ]);
  card.fill = (items, heroLabels = []) => {
    const names = heroLabels.filter(Boolean).join(' · ');
    subtitle.textContent = names
      ? L(`Cùng ${names}, khác cách xếp chiến pháp`, `同为 ${names}，战法搭配不同`)
      : L('Cùng 3 tướng, khác cách xếp chiến pháp', '相同三名武将，战法搭配不同');
    list.replaceChildren(...items.map((item) => el('li', {}, teamLink(item, [
      el('span', { class: 'cm-team-similar-text' }, [
        el('span', { class: 'cm-team-similar-name' }, item.title),
        el('span', { class: 'cm-team-similar-meta' }, L(
          `${seasonLabel(item.season, locale)} · ${formatNumber(item.upVotes)} bình chọn lên`,
          `${seasonLabel(item.season, locale)} · ${formatNumber(item.upVotes)} 赞成票`,
        )),
      ]),
      teamIcon('arrowRight'),
    ], 'cm-team-similar-link'))));
    card.hidden = false;
  };
  return card;
}

/**
 * Khung SPA đầy đủ của một đội (chế độ `?id=`). Trả các ô để phần sống gắn vào: `side` (bảng điểm/trạng thái),
 * `similarSlot` (cột phải), `after` (chiến báo + bình luận, cột trái dưới phân tích), `notice` (đầu cột trái).
 */
export function detailLayout(team, { names, locale, backHref }) {
  const { head, side } = detailHead(team, locale);
  const notice = el('div', { class: 'cm-team-detail-notice' });
  const main = el('div', { class: 'cm-team-detail-main' }, [notice, lineupSection(team, names), analysisSection(team)]);
  const aside = el('aside', { class: 'cm-team-detail-aside', 'aria-label': L('Ảnh và đội liên quan', '图片与相关阵容') }, [photosCard(team)]);
  const after = el('div', { class: 'cm-team-detail-after' });
  const article = el('article', { class: 'cm-team-detail', 'aria-labelledby': 'cm-team-detail-heading' }, [head, main, aside]);
  head.querySelector('h1').id = 'cm-team-detail-heading';
  return { nodes: [backNav(backHref), article, after], side, aside, after, notice };
}
