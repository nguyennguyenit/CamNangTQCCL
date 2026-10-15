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
import { khaiHoangCardHref, referenceDetailHref, safeReturnUrl } from '../../js/team-detail-navigation.js';
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
 * Đội chuẩn (`family` = `recommended`) / Đội khác (`other`): đầu mục + `.reference-view` của mùa mặc định, tối đa
 * `PAGE_SIZE` đội đầu, mỗi đội 3 tướng + link chi tiết. `rows`: `index.json` / `other-teams.json` đã xác minh;
 * `registry`: `seasons.json`.
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
    const signature = referenceViewSignature(state, state.view, safeReturnUrl(url.href, { origin: url.origin }), PAGE_SIZE);
    return inertUntilBound([
      t('header', { class: 'reference-head' }, [referenceHeadTextTree(title, family)]),
      t('div', { class: 'reference-view', dataset: { ssrSignature: signature } },
        recommendedListTrees(filtered, { family, mode: state.view, limit: PAGE_SIZE, labels, hrefFor, mountId, locale })),
    ]);
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
