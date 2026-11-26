// Phần thân dựng sẵn (lúc build) của bốn trang danh sách đội. Cùng đường chọn mặc định, cùng builder cây view
// và cùng cách dựng link với trình duyệt (`js/app.js` + `js/team-filter-section.js`): trình duyệt nhận lại nguyên
// DOM này khi trạng thái đầu của nó (mùa, từ khóa, bộ lọc, kiểu hiển thị, số đội) khớp dấu `data-ssr-signature`, lệch thì thay như cũ.
// Chạy trong Node không cần `document`; mọi hàm nhận `locale` tường minh.

import { localePath, withLocale } from '../../js/i18n.js';
import { khaihoangTableTree, seasonCoexistGroup, t } from '../../js/render.js';
import { projectRecommendedRows, referenceSectionState } from '../../js/recommended-reference-state.js';
import { otherTeamListEntries } from '../../js/other-team-groups.js';
import { coexistTeamCard, recommendedListTrees } from '../../js/recommended-reference-render.js';
import { coexistGroups, coexistScenarioIds, readSeasonQuery } from '../../js/season-ui-state.js';
import { projectSeasonBrowse } from '../../js/season-context.js';
import { SECTION_QUERY_KEYS, SSR_STALE_EXEMPT_KEYS, TEAM_RETURN_STORAGE_KEY, khaiHoangCardHref, referenceDetailHref } from '../../js/team-detail-navigation.js';
import { TEAM_VIEW_CARDS, TEAM_VIEW_GRID, TEAM_VIEW_STORAGE_KEY, TEAM_VIEW_TABLE } from '../../js/team-view.js';
import {
  PAGE_SIZE,
  coexistGroupKey,
  coexistHeadTextTree,
  coexistViewSignature,
  referenceHeadTree,
  referenceListTexts,
  referenceMoreTrees,
  referenceSectionTitle,
  referenceViewSignature,
} from '../../js/team-filter-section.js';
import { activeFilterCount, referenceEmptyHidden, referenceMoreHidden, referenceShellTree } from '../../js/reference-shell-tree.js';
import { disableControls } from '../../js/view-tree.js';

/**
 * Nút dựng sẵn mà sự kiện chỉ có sau khi `js/app.js` / `js/khaihoang-detail.js` gắn (chip chiến pháp "tìm", chip cấu hình
 * và chip loại binh của Khai hoang): `disabled` + `aria-disabled` đến lúc trình duyệt gắn xong rồi gọi `enableControl`;
 * không có JavaScript thì chúng không bấm được thay vì bấm mà không có gì xảy ra. Chỉ áp cho nút của NỘI DUNG (danh sách, trang
 * Khai hoang); điều khiển của khung lọc Đội chuẩn / Đội khác khoá riêng bằng `disableControls(…, () => true)` ở `recommendedSectionTrees`.
 */
const NEEDS_SCRIPT = (attrs) => 'data-tactic-search' in attrs || /(?:^|\s)kh-(?:config|unit)-chip(?:\s|$)/.test(attrs.class ?? '');
export const inertUntilBound = (trees) => trees.map((tree) => disableControls(tree, NEEDS_SCRIPT));

/** Gốc giả để dựng URL trang mục tuyệt đối; chỉ `pathname` + query của nó đi vào link. */
const PAGE_ORIGIN = 'https://tqccl.invalid';
const pageUrl = (path, locale) => new URL(localePath(path, locale), PAGE_ORIGIN);

/**
 * Đội chuẩn (`family` = `recommended`) / Đội khác (`other`): đầu mục + khung lọc (thanh công cụ, sidebar chip, vùng kết quả) + `.reference-view`
 * của mùa mặc định, mỗi đội 3 tướng + link chi tiết. Đội chuẩn dựng ĐỦ mọi đội của mùa mặc định (mùa hiện tại không có trang riêng,
 * có thể hơn `PAGE_SIZE` đội khi đổi mùa mặc định); `rows`: `records` của `index.json` đã xác minh. Đội khác dựng tối đa `PAGE_SIZE`
 * team đầu (`otherTeamListEntries`, cùng hàm với trình duyệt); `payload`: cả `other-teams.json` đã xác minh (`records` +
 * `teamGroups`). `registry`: `seasons.json`.
 *
 * Khung lọc dựng bằng đúng các cây của trình duyệt (`referenceHeadTree`, `referenceShellTree`) ở trạng thái mặc định
 * `referenceSectionState(family, url, registry, null)`: số đếm, chip và cờ `hidden` tính bằng cùng hàm với `render()`. Mọi điều
 * khiển của khung (ô chọn mùa, ô tìm, nút, chip, "Xem thêm") bị khoá tới khi trình duyệt nhận lại khung và dựng bản không khoá;
 * danh sách khoá riêng bằng `inertUntilBound` nên nút trong thẻ không bị lan.
 *
 * Dấu danh sách ghi số đội đã dựng: tối thiểu `PAGE_SIZE` (khớp lượt đầu của client nên DOM được nhận lại); mùa hơn
 * `PAGE_SIZE` đội thì dấu mang tổng số đội, client thử dấu này sau dấu lượt đầu và nhận lại cả danh sách; phân
 * trang phía client chỉ áp từ lần đổi trạng thái kế tiếp.
 * @param {{family: string, rows?: any[], payload?: any, registry: any, locale?: string}} options Đội chuẩn truyền `rows`, Đội khác truyền `payload`.
 */
export function recommendedSectionTrees({ family, rows, payload, registry, locale }) {
  return withLocale(locale, () => {
    const other = family === 'other';
    const url = pageUrl(other ? '/doi-khac/' : '/doi-chuan/', locale);
    const state = referenceSectionState(family, url.href, registry, null);
    const labels = registry.displayLabels || {};
    const hrefFor = (row) => referenceDetailHref(row, { locale });
    const records = other ? (Array.isArray(payload?.records) ? payload.records : []) : rows;
    // Cùng hai phép chiếu với `render()` của trình duyệt: mục của danh sách (đã lọc) và mục của cả phạm vi (chưa lọc: số đếm, chip).
    const project = (listState) => (other ? otherTeamListEntries(payload, listState, labels, { hrefFor }) : projectRecommendedRows(records, listState, labels));
    const filtered = project(state);
    const scopeItems = project({ ...state, query: '', filters: {} });
    const mountId = family === 'other' ? 'section-team-khac' : 'section-team-chuan';
    const title = referenceSectionTitle(family);
    const limit = family === 'other' ? PAGE_SIZE : filtered.length;
    const signature = referenceViewSignature(state, state.view, Math.max(PAGE_SIZE, limit));
    const lock = (tree) => disableControls(tree, () => true);
    const { noticeText, emptyText } = referenceListTexts({ family, state, registry, scopeCount: scopeItems.length });
    const [viewTree] = inertUntilBound([
      t('div', { class: 'reference-view', dataset: { ssrSignature: signature } },
        recommendedListTrees(filtered, { family, mode: state.view, limit, labels, hrefFor, mountId, locale })),
    ]);
    return [
      // Đội khác: nhãn mùa tĩnh (nội dung, không khoá) cùng cây với trình duyệt; Đội chuẩn: ô chọn mùa, khoá.
      referenceHeadTree({ title, family, registry, state, rows: records, lock }),
      referenceShellTree({
        mountId, title, family, state, labels, openFacets: new Set(), scopeItems,
        count: filtered.length, scopeCount: scopeItems.length, activeCount: activeFilterCount(state, false),
        noticeText, emptyText,
        emptyHidden: referenceEmptyHidden(filtered.length),
        moreHidden: referenceMoreHidden(limit, filtered.length),
        moreTrees: referenceMoreTrees(),
        viewTree,
        lock,
      }),
    ];
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
 * builder thẻ của danh sách, mỗi đội 3 tướng + chiến pháp + link chi tiết sạch như mọi danh sách. Trang mùa không thuộc
 * `SECTION_QUERY_KEYS` nên không thành đích Quay lại: nút quay lại của trang đội giữ link mặc định. Trang tĩnh, không nạp app.js.
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
    const hrefFor = (teamId, variantId) => khaiHoangCardHref(teamId, variantId, { locale });
    return inertUntilBound([khaihoangTableTree(data, { hrefFor, locale })]);
  });
}

const SECTION_PATHS = { 'team-chuan': '/doi-chuan/', 'team-khac': '/doi-khac/', coexist: '/cung-ton/', khaihoang: '/khai-hoang/' };

/**
 * Script inline chạy ngay sau `<section>` dựng sẵn: thân dựng sẵn là trạng thái MẶC ĐỊNH, nên khi trang mở ở trạng thái
 * khác (query của mục trong URL, kiểu hiển thị đã lưu khác Thẻ, hoặc lựa chọn Khai hoang được khôi phục từ snapshot quay
 * lại) thì gắn `data-ssr-stale` lên mount để CSS ẩn phần phụ thuộc trạng thái (danh sách, chip, số đếm, nút kiểu hiển thị, ô chọn
 * mùa) cho đến khi `js/app.js` dựng xong đúng trạng thái — không để danh sách sai mùa/bộ lọc hiện (và bấm được) suốt lúc tải.
 * Không có JavaScript thì không ẩn gì. `kho`/`xep` (`SSR_STALE_EXEMPT_KEYS`) không tính: chúng chỉ thêm badge/đổi thứ tự khi máy
 * có kho, người không có kho vẫn phải thấy danh sách dựng sẵn ngay.
 *
 * Đội chuẩn / Đội khác còn đọc snapshot quay lại với đúng khóa và luật khớp của `restoreReturnState` (`history.state.teamReturn`
 * rồi `sessionStorage`; khớp khi URL đã lọc theo allowlist của trang bằng URL hiện tại): snapshot ghi panel lọc đang mở
 * (`disclosures.filters === true`) thì gắn `data-ssr-filters-open` để CSS mở sẵn panel trên mobile, khỏi đẩy danh sách xuống
 * khi app.js mở lại panel. Lọc/sắp theo kho hoãn việc khôi phục tới khi kho tới nên không mở sớm. Dấu này do `setFiltersExpanded`
 * và `finally` của `main()` gỡ.
 */
export function ssrStaleGuardScript(section) {
  const teamList = section === 'team-chuan' || section === 'team-khac';
  const config = {
    id: `section-${section}`,
    keys: (SECTION_QUERY_KEYS[SECTION_PATHS[section]] ?? []).filter((key) => !SSR_STALE_EXEMPT_KEYS.includes(key)),
    viewKey: teamList ? TEAM_VIEW_STORAGE_KEY : null,
    // Chỉ kiểu hiển thị hợp lệ khác Thẻ mới đổi danh sách; giá trị lạ trong storage vẫn về Thẻ (`canonicalTeamView`).
    otherViews: [TEAM_VIEW_GRID, TEAM_VIEW_TABLE],
    returnKey: section === 'khaihoang' ? TEAM_RETURN_STORAGE_KEY : null,
    // Chỉ hai trang có khung lọc dựng sẵn mới đọc snapshot của panel lọc: script (và HTML) của Cùng Tồn / Khai hoang giữ nguyên.
    ...(teamList ? { openKey: TEAM_RETURN_STORAGE_KEY, allowed: SECTION_QUERY_KEYS[SECTION_PATHS[section]] } : {}),
  };
  // Khối thứ hai độc lập với khối `data-ssr-stale` (lỗi ở khối này không làm mất khối kia); `q` do khối trước khai báo.
  const openBlock = teamList
    ? `try{var o=[history.state&&history.state.teamReturn],i,x,hit=null,`
      + `n=function(h){var u=new URL(h,location.href),p=new URLSearchParams(),m;u.searchParams.forEach(function(v,k){if(c.allowed.indexOf(k)>=0)p.append(k,v);});m=p.toString();return u.pathname+(m?'?'+m:'');},`
      + `cur=n(location.href);try{o.push(JSON.parse(sessionStorage.getItem(c.openKey)));}catch(e){}`
      + `for(i=0;i<o.length&&!hit;i++){x=o[i];if(x&&x.version===1&&typeof x.url==='string'){try{if(n(x.url)===cur)hit=x;}catch(e){}}}`
      + `if(hit&&hit.disclosures&&hit.disclosures.filters===true&&!q.has('kho')&&!q.has('xep'))document.getElementById(c.id).dataset.ssrFiltersOpen='';}catch(e){}`
    : '';
  return `(function(c){try{var q=new URLSearchParams(location.search),s=c.keys.some(function(k){return q.has(k);});`
    + `if(!s&&c.viewKey){s=c.otherViews.indexOf(localStorage.getItem(c.viewKey))>=0;}`
    + `if(!s&&c.returnKey){var r=[history.state&&history.state.teamReturn];try{r.push(JSON.parse(sessionStorage.getItem(c.returnKey)));}catch(e){}`
    + `s=r.some(function(x){return !!x&&typeof x.url==='string'&&!!x.khaihoangVariants&&Object.keys(x.khaihoangVariants).length>0`
    + `&&new URL(x.url,location.href).pathname===location.pathname;});}`
    + `if(s)document.getElementById(c.id).dataset.ssrStale='';}catch(e){}`
    + openBlock
    + `})(${JSON.stringify(config)});`;
}
