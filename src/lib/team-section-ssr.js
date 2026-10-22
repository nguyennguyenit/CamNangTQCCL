// Phần thân dựng sẵn (lúc build) của bốn trang danh sách đội. Cùng đường chọn mặc định, cùng builder cây view
// và cùng cách dựng link với trình duyệt (`js/app.js` + `js/team-filter-section.js`): trình duyệt nhận lại nguyên
// DOM này khi trạng thái đầu của nó (URL, kiểu hiển thị, nguồn quay lại) khớp dấu `data-ssr-signature`, lệch thì thay như cũ.
// Chạy trong Node không cần `document`; mọi hàm nhận `locale` tường minh.

import { localePath, withLocale } from '../../js/i18n.js';
import { khaihoangTableTree, seasonCoexistGroup, t } from '../../js/render.js';
import { projectRecommendedRows, referenceSectionState } from '../../js/recommended-reference-state.js';
import { coexistTeamCard, recommendedListTrees } from '../../js/recommended-reference-render.js';
import { coexistGroups, coexistScenarioIds, readSeasonQuery } from '../../js/season-ui-state.js';
import { projectSeasonBrowse } from '../../js/season-context.js';
import { SECTION_QUERY_KEYS, TEAM_RETURN_STORAGE_KEY, khaiHoangCardHref, referenceDetailHref, safeReturnUrl } from '../../js/team-detail-navigation.js';
import { TEAM_VIEW_CARDS, TEAM_VIEW_GRID, TEAM_VIEW_STORAGE_KEY, TEAM_VIEW_TABLE } from '../../js/team-view.js';
import {
  PAGE_SIZE,
  coexistGroupKey,
  coexistHeadTextTree,
  coexistViewSignature,
  referenceHeadTextTree,
  referenceSectionTitle,
  referenceViewSignature,
} from '../../js/team-filter-section.js';
import { disableButtons } from '../../js/view-tree.js';

/**
 * Nút dựng sẵn mà sự kiện chỉ có sau khi `js/app.js` / `js/khaihoang-detail.js` gắn (chip chiến pháp "tìm", chip cấu hình
 * và chip loại binh của Khai hoang): `disabled` + `aria-disabled` đến lúc trình duyệt gắn xong rồi gọi `enableControl`;
 * không có JavaScript thì chúng không bấm được thay vì bấm mà không có gì xảy ra.
 */
const NEEDS_SCRIPT = (attrs) => 'data-tactic-search' in attrs || /(?:^|\s)kh-(?:config|unit)-chip(?:\s|$)/.test(attrs.class ?? '');
export const inertUntilBound = (trees) => trees.map((tree) => disableButtons(tree, NEEDS_SCRIPT));

/** Gốc giả để dựng URL trang mục tuyệt đối; chỉ `pathname` + query của nó đi vào link. */
const PAGE_ORIGIN = 'https://tqccl.invalid';
const pageUrl = (path, locale) => new URL(localePath(path, locale), PAGE_ORIGIN);

/**
 * Đội chuẩn (`family` = `recommended`) / Đội khác (`other`): đầu mục + `.reference-view` của mùa mặc định, mỗi đội
 * 3 tướng + link chi tiết. Đội chuẩn dựng ĐỦ mọi đội của mùa mặc định (mùa hiện tại không có trang riêng, có thể hơn
 * `PAGE_SIZE` đội khi đổi mùa mặc định); Đội khác tối đa `PAGE_SIZE` đội đầu. `rows`: `index.json` / `other-teams.json`
 * đã xác minh; `registry`: `seasons.json`.
 *
 * Dấu danh sách ghi số đội đã dựng: tối thiểu `PAGE_SIZE` (khớp lượt đầu của client nên DOM được nhận lại); mùa hơn
 * `PAGE_SIZE` đội thì dấu lệch lượt đầu, client dựng lại theo lượt như cũ — phân trang phía client giữ nguyên.
 */
export function recommendedSectionTrees({ family, rows, registry, locale }) {
  return withLocale(locale, () => {
    const url = pageUrl(family === 'other' ? '/doi-khac/' : '/doi-chuan/', locale);
    const state = referenceSectionState(family, url.href, registry, null);
    const labels = registry.displayLabels || {};
    const filtered = projectRecommendedRows(rows, state, labels);
    const hrefFor = (row) => referenceDetailHref(row, { from: url.href, origin: url.origin, locale });
    const mountId = family === 'other' ? 'section-team-khac' : 'section-team-chuan';
    const title = referenceSectionTitle(family);
    const limit = family === 'other' ? PAGE_SIZE : filtered.length;
    const signature = referenceViewSignature(state, state.view, safeReturnUrl(url.href, { origin: url.origin }), Math.max(PAGE_SIZE, limit));
    return inertUntilBound([
      t('header', { class: 'reference-head' }, [referenceHeadTextTree(title, family)]),
      t('div', { class: 'reference-view', dataset: { ssrSignature: signature } },
        recommendedListTrees(filtered, { family, mode: state.view, limit, labels, hrefFor, mountId, locale })),
    ]);
  });
}

/** Chip chiến pháp của thẻ là nút "tìm" cần app.js gắn sự kiện; trang mùa không nạp app.js nên đổi chúng thành chữ thuần. */
const staticTacticTags = (tree) => {
  if (typeof tree === 'string') return tree;
  const search = tree.tag === 'button' && tree.attrs && 'data-tactic-search' in tree.attrs;
  const attrs = search ? Object.fromEntries(Object.entries(tree.attrs).filter(([name]) => name !== 'type' && name !== 'data-tactic-search' && name !== 'title')) : tree.attrs;
  return { tag: search ? 'span' : tree.tag, attrs, children: tree.children.map(staticTacticTags) };
};

/**
 * Thân trang mùa Đội chuẩn: MỌI đội của mùa (không giới hạn `PAGE_SIZE`, không phân trang) nhóm theo Tier bằng đúng
 * builder thẻ của danh sách, mỗi đội 3 tướng + chiến pháp + link chi tiết. Không có `from=` (trang mùa không thuộc
 * `SECTION_QUERY_KEYS`): nút quay lại của trang đội giữ hành vi hiện tại. Trang tĩnh, không nạp app.js.
 */
export function seasonPageTrees({ rows, sourceSeasonId, registry, locale }) {
  return withLocale(locale, () => {
    const season = rows.filter((row) => row.sourceSeasonId === sourceSeasonId);
    const filtered = projectRecommendedRows(season, { season: sourceSeasonId, query: '', filters: {} }, registry.displayLabels || {});
    const hrefFor = (row) => referenceDetailHref(row, { locale });
    return recommendedListTrees(filtered, {
      family: 'recommended', mode: TEAM_VIEW_CARDS, labels: registry.displayLabels || {}, hrefFor, mountId: 'season-page', locale,
    }).map(staticTacticTags);
  });
}

/**
 * Cùng Tồn: đầu mục + nhóm đầu của mùa mới nhất (mặc định của URL trống). `model`: mô hình mùa đã xác minh
 * (`loadSeasonModel`). Mùa/nhóm mặc định chọn bằng đúng hàm mà trình duyệt dùng.
 */
export function coexistSectionTrees({ model, locale }) {
  return withLocale(locale, () => {
    const scenarioId = coexistScenarioIds(model)[0] ?? null;
    const head = t('header', { class: 'reference-head coexist-head' }, [coexistHeadTextTree()]);
    if (!scenarioId) return [head];
    const url = new URL(pageUrl('/cung-ton/', locale));
    url.searchParams.set('scenario', scenarioId);
    const browse = readSeasonQuery(url.href, model).browse;
    const groups = coexistGroups(projectSeasonBrowse(model, browse));
    if (!groups.length) return [head];
    const group = groups[0];
    return [
      head,
      t('div', { class: 'coexist-group-view', dataset: { ssrSignature: coexistViewSignature(browse?.scenarioId ?? null, coexistGroupKey(group, 0)) } },
        [seasonCoexistGroup(group, { teamCard: coexistTeamCard })]),
    ];
  });
}

/**
 * Cùng Tồn cho llms.txt: MỌI mùa đã duyệt, MỌI nhóm đội của từng mùa (trang chỉ dựng nhóm đầu của mùa mới nhất; phần còn
 * lại đổi mùa/nhóm bằng JavaScript). Mỗi nhóm là cây của đúng builder `seasonCoexistGroup` mà trang dùng; URL của mùa là
 * `/cung-ton/?scenario=<mã mùa>`, tham số mà chính trang đọc.
 */
export function coexistScenarioBlocks({ model, locale }) {
  return withLocale(locale, () => coexistScenarioIds(model).map((scenarioId) => {
    const url = pageUrl('/cung-ton/', locale);
    url.searchParams.set('scenario', scenarioId);
    const browse = readSeasonQuery(url.href, model).browse;
    const groups = coexistGroups(projectSeasonBrowse(model, browse));
    const label = model.data['season-registry'].find((item) => item.id === scenarioId)?.labelVi ?? scenarioId;
    return {
      scenarioId,
      label,
      query: `?scenario=${encodeURIComponent(scenarioId)}`,
      groups: groups.map((group) => seasonCoexistGroup(group, { teamCard: coexistTeamCard })),
    };
  }));
}

/** Khai hoang: cả trang ở trạng thái mặc định (mọi đội, bộ lọc "Tất cả", cấu hình mặc định). `data`: `khaihoang.json` đã bản địa hoá. */
export function khaihoangSectionTrees({ data, locale }) {
  return withLocale(locale, () => {
    const url = pageUrl('/khai-hoang/', locale);
    const hrefFor = (teamId, variantId) => khaiHoangCardHref(teamId, variantId, { from: url.href, origin: url.origin, locale });
    return inertUntilBound([khaihoangTableTree(data, { hrefFor, locale })]);
  });
}

const SECTION_PATHS = { 'team-chuan': '/doi-chuan/', 'team-khac': '/doi-khac/', coexist: '/cung-ton/', khaihoang: '/khai-hoang/' };

/**
 * Script inline chạy ngay sau `<section>` dựng sẵn: thân dựng sẵn là trạng thái MẶC ĐỊNH, nên khi trang mở ở trạng thái
 * khác (query của mục trong URL, kiểu hiển thị đã lưu khác Thẻ, hoặc lựa chọn Khai hoang được khôi phục từ snapshot quay
 * lại) thì gắn `data-ssr-stale` lên mount để CSS ẩn phần phụ thuộc trạng thái cho đến khi `js/app.js` dựng xong đúng
 * trạng thái — không để danh sách sai mùa/bộ lọc hiện (và bấm được) suốt lúc tải. Không có JavaScript thì không ẩn gì.
 */
export function ssrStaleGuardScript(section) {
  const config = {
    id: `section-${section}`,
    keys: SECTION_QUERY_KEYS[SECTION_PATHS[section]] ?? [],
    viewKey: section === 'team-chuan' || section === 'team-khac' ? TEAM_VIEW_STORAGE_KEY : null,
    // Chỉ kiểu hiển thị hợp lệ khác Thẻ mới đổi danh sách; giá trị lạ trong storage vẫn về Thẻ (`canonicalTeamView`).
    otherViews: [TEAM_VIEW_GRID, TEAM_VIEW_TABLE],
    returnKey: section === 'khaihoang' ? TEAM_RETURN_STORAGE_KEY : null,
  };
  return `(function(c){try{var q=new URLSearchParams(location.search),s=c.keys.some(function(k){return q.has(k);});`
    + `if(!s&&c.viewKey){s=c.otherViews.indexOf(localStorage.getItem(c.viewKey))>=0;}`
    + `if(!s&&c.returnKey){var r=[history.state&&history.state.teamReturn];try{r.push(JSON.parse(sessionStorage.getItem(c.returnKey)));}catch(e){}`
    + `s=r.some(function(x){return !!x&&typeof x.url==='string'&&!!x.khaihoangVariants&&Object.keys(x.khaihoangVariants).length>0`
    + `&&new URL(x.url,location.href).pathname===location.pathname;});}`
    + `if(s)document.getElementById(c.id).dataset.ssrStale='';}catch(e){}})(${JSON.stringify(config)});`;
}
