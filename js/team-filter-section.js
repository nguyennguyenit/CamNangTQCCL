// Ba mục danh sách: Cùng Tồn (chọn mùa + phiên bản), Đội chuẩn và Đội khác (sidebar lọc,
// chế độ Thẻ / Thẻ gọn / Bảng). Trên điện thoại, vùng nhóm lọc thu gọn sau nút "Bộ lọc".

import { el, t, FACTION_CODE, coexistGroupLabel, seasonCoexistGroup, sourceLabel } from './render.js';
import { track } from './analytics.js';
import { L, contentLocaleIsVietnamese, currentLocale } from './i18n.js';
import { localSeasonName } from './ja-season-names.js';

/** Khóa nhận diện nhóm: `recordId` khi có, ngược lại số thứ tự 1-based trong danh sách nhận được. */
export function coexistGroupKey(group, index) {
  return group.recordId ? String(group.recordId) : String(index + 1);
}

/** Chữ đầu mục Cùng Tồn (kicker, h1, lời dẫn) dạng cây: bản dựng sẵn và trình duyệt dùng chung một định nghĩa. */
export function coexistHeadTextTree() {
  return t('div', {class: 'reference-head-text'}, [
    t('span', {class: 'reference-kicker'}, L('Đội hình', '阵容', '編成')),
    t('h1', {class: 'reference-title', tabindex: '-1'}, L('Cùng Tồn', '共存阵容', '共存編成')),
    t('p', {class: 'reference-lead'}, L('Năm đội dùng được cùng lúc trong một tài khoản, 15 tướng không trùng nhau. Chọn mùa rồi chọn phiên bản để tham khảo.', '同一账号可同时使用的五支队伍，15 名武将互不重复。先选赛季，再选版本参考。', '同一アカウントで同時に使える5つの編成です。武将15名は重複しません。シーズンを選び、続けてバージョンを選んで参考にしてください。')),
  ]);
}

/**
 * Dấu của phần thân dựng sẵn (kịch bản + khóa nhóm đang chọn). Trình duyệt chỉ nhận lại DOM dựng sẵn khi
 * dấu này khớp đúng trạng thái nó sắp vẽ; lệch thì thay như cũ.
 */
export const coexistViewSignature = (scenarioId, groupKey) => JSON.stringify([scenarioId ?? null, groupKey]);

/**
 * Mục Cùng Tồn: đầu mục như Đội chuẩn (ô chọn mùa bên phải; URL `scenario` sở hữu lựa chọn, đổi mùa gọi
 * `onScenario(id)`), một hàng nút phiên bản Cùng tồn 1–5 của mùa đó, rồi lưới thẻ đội của phiên bản đang xem.
 * Tập phiên bản đúng bằng tập `update(groups)` nhận, không lọc thêm ngoài phép chiếu phạm vi.
 * `onGroup(key | null)` được gọi khi URL phải đổi: chọn phiên bản mới, hoặc bỏ `group` cũ không còn hợp lệ.
 */
export function createSeasonCoexistSection({mount, scenarioLabel = () => '', onGroup, onScenario, adopt = false} = {}) {
  const headText = treeToDom(coexistHeadTextTree());
  const title = headText.querySelector('h1');
  const season = el('select', {'aria-label': L('Mùa', '赛季', 'シーズン')});
  const seasonStatus = el('span', {class: 'reference-season-status', hidden: ''}, L('Mới nhất', '最新', '最新'));
  const seasonField = el('label', {class: 'reference-season-field', hidden: ''}, [
    el('span', {class: 'reference-season-label'}, L('Mùa', '赛季', 'シーズン')),
    seasonStatus,
    season,
    icon(chevron(), {size: 16}),
  ]);
  season.addEventListener('change', () => {
    if (season.value !== selectedScenario && typeof onScenario === 'function') {
      track('filter_change', {filter: 'scenario', filter_value: season.value});
      onScenario(season.value);
    }
  });
  const head = el('header', {class: 'reference-head coexist-head'}, [headText, seasonField]);
  const versionRow = el('div', {class: 'coexist-group-row', role: 'group', 'aria-label': L('Chọn phiên bản Cùng Tồn', '选择共存版本', '共存バージョンを選択')});
  const chooser = el('div', {class: 'coexist-groups'}, [
    el('span', {class: 'coexist-groups-label', 'aria-hidden': 'true'}, L('Phiên bản', '版本', 'バージョン')),
    versionRow,
  ]);
  // Nhóm đang xem do build dựng sẵn (`data-ssr-signature`): nhận lại nguyên DOM đó nếu đúng trạng thái đầu tiên.
  const groupView = (adopt && mount.querySelector(':scope > .coexist-group-view[data-ssr-signature]')) || el('div', {class: 'coexist-group-view'});
  const empty = el('p', {class: 'empty'}, L('Không có nhóm Cùng Tồn trong mùa này.', '本赛季暂无共存阵容分组。', 'このシーズンには共存編成のグループがありません。'));
  mount.replaceChildren(head, chooser, groupView, empty);
  let items = [];
  let selectedScenario = null;
  let selectedKey = '';
  // Nút phiên bản đang có trong DOM theo khóa nhóm để bật/tắt `aria-pressed` tại chỗ.
  let groupNodes = new Map();

  /** Chọn phiên bản: nút vừa kích hoạt được giữ nguyên trong DOM nên trình duyệt không mất focus. */
  function activate(key) {
    selectedKey = key;
    for (const [itemKey, button] of groupNodes) button.setAttribute('aria-pressed', String(itemKey === selectedKey));
    paintGroupView();
    if (typeof onGroup === 'function') onGroup(key);
  }

  /** Ô chọn mùa: `scenarios` theo thứ tự hiển thị (mùa mới nhất trước); chỉ còn một mùa thì ẩn. */
  function paintSeasonField(scenarios, latest) {
    season.replaceChildren(...scenarios.map((id) => el('option', {value: id}, scenarioLabel(id) || id)));
    if (selectedScenario !== null) season.value = selectedScenario;
    seasonField.hidden = scenarios.length < 2;
    seasonStatus.hidden = !latest || selectedScenario !== latest;
  }

  /** Hàng nút "Cùng tồn N"; mobile chỉ hiện số, nhãn đầy đủ vẫn là tên truy cập của nút. */
  function paintGroupRow() {
    groupNodes = new Map();
    versionRow.replaceChildren(...items.map((item, index) => {
      const button = el('button', {
        type: 'button', class: 'coexist-group-chip', 'aria-pressed': String(item.key === selectedKey),
        dataset: { groupKey: item.key },
        onclick: () => activate(item.key),
      }, [
        el('span', {class: 'coexist-chip-number', 'aria-hidden': 'true'}, String(index + 1)),
        el('span', {class: 'coexist-chip-label'}, coexistGroupLabel(item.group.content?.groupLabel || item.group.groupLabel)),
      ]);
      groupNodes.set(item.key, button);
      return button;
    }));
    chooser.hidden = items.length < 2;
  }

  function paintGroupView() {
    const prerendered = groupView.dataset.ssrSignature;
    if (prerendered !== undefined) {
      groupView.removeAttribute('data-ssr-signature');
      if (prerendered === coexistViewSignature(selectedScenario, selectedKey)) return;
    }
    const selected = items.find((item) => item.key === selectedKey) || null;
    groupView.replaceChildren(...(selected ? [treeToDom(seasonCoexistGroup(selected.group, {teamCard: coexistTeamCard}))] : []));
  }

  return {
    /**
     * `groups`: phép chiếu của phạm vi đang chọn; `requested`: `group` của URL (`null` = không có);
     * `scenarios`: id kịch bản đã review theo thứ tự hiển thị; `selected`: kịch bản của URL (hoặc `null`);
     * `latest`: id mùa mới nhất (nhãn "Mới nhất" trên ô chọn mùa).
     */
    update(groups = [], requested = null, {scenarios = [], selected = null, latest = null} = {}) {
      items = (groups || []).map((group, index) => ({group, key: coexistGroupKey(group, index)}));
      selectedScenario = selected;
      // `null` = URL không có `group`; chuỗi bất kỳ (kể cả rỗng) = có yêu cầu, phải kiểm hợp lệ.
      const requestedKey = typeof requested === 'string' ? requested : null;
      const hit = (requestedKey && items.find((item) => item.key === requestedKey)) || items[0] || null;
      selectedKey = hit ? hit.key : '';
      empty.hidden = items.length > 0;
      paintSeasonField(scenarios, latest);
      paintGroupRow();
      paintGroupView();
      // Nhóm cũ không còn trong phạm vi mới: về nhóm đầu và bỏ `group` khỏi URL.
      if (requested !== null && requestedKey !== selectedKey && typeof onGroup === 'function') onGroup(null);
    },
    focus() { title.focus(); },
  };
}

import { SOURCE_TIER_ORDER, TIER_SOURCE_JP, jpTierSourceLabel, sourceTierLabel, legacyLabelZh, projectRecommendedRows, referenceFacetValues } from './recommended-reference-state.js';
import { bindTacticTags, coexistTeamCard, groupRowsByTier, otherTeamItemTree, recommendedListTrees, referenceRowKey, teamItemTree, tierOf, tierSectionTree } from './recommended-reference-render.js';
import { otherTeamFacetValues, otherTeamListEntries } from './other-team-groups.js';
import { decorateCoverageBadges, rosterControlNodes, rosterHintNode, rosterSummaryNode } from './roster-list-badges.js';
import { treeToDom } from './view-tree.js';
import { icon, svgNode } from './render.js';
import { TEAM_VIEW_CARDS, TEAM_VIEW_GRID, TEAM_VIEW_TABLE, canonicalTeamView } from './team-view.js';
import { isNativeNavigationClick } from './team-detail-navigation.js';

// Đo lường (GA4 `filter_change`): chỉ gọi từ thao tác của người dùng trên điều khiển, không từ lần dựng đầu hay khôi phục URL.
const trackFilter=(filter,value)=>track('filter_change',{filter,filter_value:String(value)});
/** `change` của cụm nút kho: `{kho}` hoặc `{xep}`; `null` (tắt) báo là `tat`. */
const trackRosterChange=change=>{
  for (const key of ['kho','xep']) if (key in change) trackFilter(key,change[key] ?? 'tat');
};

/** Danh sách dài dựng theo lượt: dựng cả 1366 thẻ một lần làm trang đứng vài giây trên máy chậm. */
export const PAGE_SIZE=60;

/** Tiêu đề (h1) của mục Đội chuẩn (`recommended`) / Đội khác (`other`); một nguồn cho build lẫn trình duyệt. */
export const referenceSectionTitle=family=>family==='other' ? L('Đội khác','其他阵容','その他の編成') : L('Đội chuẩn','推荐阵容','おすすめ編成');

/** Chữ đầu mục Đội chuẩn / Đội khác (kicker, h1, lời dẫn) dạng cây; dùng chung giữa bản dựng sẵn và trình duyệt. */
export function referenceHeadTextTree(title,family) {
  return t('div',{class:'reference-head-text'},[
    t('span',{class:'reference-kicker'},L('Đội hình','阵容','編成')),
    t('h1',{class:'reference-title',tabindex:'-1'},title),
    t('p',{class:'reference-lead'},family==='other'
      ? L('Các đội có sẵn, đã đối chiếu với đội chuẩn.','现有阵容，已与推荐阵容核对。','既存の編成です。おすすめ編成と照合済みです。')
      : L('Đội hình tham khảo, chia theo mùa tương ứng.','参考阵容，按对应赛季分类。','参考編成です。対応するシーズンごとに分類しています。')),
  ]);
}

/**
 * Dấu của danh sách dựng sẵn: mùa, từ khóa, bộ lọc, kiểu hiển thị và số đội đang hiện. Trình duyệt chỉ nhận lại DOM dựng
 * sẵn khi dấu khớp đúng trạng thái nó sắp vẽ. Không có URL trang: link chi tiết là URL sạch nên URL không làm DOM khác
 * đi; danh sách không đọc `scenario`/`ruleset`/`config`, còn `source` đã nằm trong `filters`. `kho`/`xep` cũng không
 * vào dấu: thứ tự theo kho đã chặn riêng bằng `rosterOrdered` ở `renderView`.
 */
export const referenceViewSignature=(state,mode,shown=PAGE_SIZE)=>
  JSON.stringify([state.season ?? null,state.query || '',state.filters || {},mode,shown]);

// Nhóm chính Loại binh → Phe → Tier; Nhóm/Bộ đội hình thu gọn trong accordion.
const PRIMARY_FACETS=['unit','faction','tier'];
const SECONDARY_FACETS=['subcategory','source'];
const FACET_LABEL={unit:'Loại binh',faction:'Phe',tier:'Tier',subcategory:'Nhóm',source:'Bộ đội hình'};
const FACET_LABEL_HAN={
  zh:{tier:'等级',unit:'兵种',faction:'阵营',subcategory:'分组',source:'阵容合集'},
  ja:{tier:'ティア',unit:'兵種',faction:'勢力',subcategory:'グループ',source:'編成コレクション'},
};
const facetLabel=key=>L(FACET_LABEL[key],FACET_LABEL_HAN.zh[key],FACET_LABEL_HAN.ja[key]);

/** Ba kiểu hiển thị: Thẻ (mặc định, không ghi URL), Thẻ gọn (lưới tối đa 4 cột, `?view=luoi`), Bảng (`?view=bang`). */
const VIEW_OPTIONS=[
  {value:TEAM_VIEW_CARDS,label:'Thẻ',aria:'Xem dạng thẻ',labelZh:'卡片',ariaZh:'以卡片显示',labelJa:'カード',ariaJa:'カード表示',icon:()=>[
    svgNode('rect',{x:3,y:3,width:7.5,height:18,rx:1.5}),
    svgNode('rect',{x:13.5,y:3,width:7.5,height:18,rx:1.5}),
  ]},
  {value:TEAM_VIEW_GRID,label:'Thẻ gọn',aria:'Xem dạng thẻ gọn',labelZh:'紧凑卡片',ariaZh:'以紧凑卡片显示',labelJa:'コンパクトカード',ariaJa:'コンパクトカード表示',icon:()=>[
    svgNode('rect',{x:3,y:3,width:7.5,height:7.5,rx:1.5}),svgNode('rect',{x:13.5,y:3,width:7.5,height:7.5,rx:1.5}),
    svgNode('rect',{x:3,y:13.5,width:7.5,height:7.5,rx:1.5}),svgNode('rect',{x:13.5,y:13.5,width:7.5,height:7.5,rx:1.5}),
  ]},
  {value:TEAM_VIEW_TABLE,label:'Bảng',aria:'Xem dạng bảng',labelZh:'表格',ariaZh:'以表格显示',labelJa:'表',ariaJa:'表で表示',icon:()=>[
    svgNode('line',{x1:3,y1:6,x2:21,y2:6}),svgNode('line',{x1:3,y1:12,x2:21,y2:12}),svgNode('line',{x1:3,y1:18,x2:21,y2:18}),
  ]},
];

// Hàm sinh node mới mỗi lần gọi: một node SVG chỉ gắn được vào một chỗ, dùng chung sẽ bị dời sang ô dựng sau.
const chevron=()=>[svgNode('polyline',{points:'6 9 12 15 18 9'})];
const filterIcon=()=>[svgNode('line',{x1:4,y1:7,x2:20,y2:7}),svgNode('line',{x1:7,y1:12,x2:17,y2:12}),svgNode('line',{x1:10,y1:17,x2:14,y2:17})];

const cjk=/[\u3400-\u9fff\uf900-\ufaff]/u;
// `sourceText`: trang không phải bản Việt hiện chữ nguồn (chữ Hán) thay cho lớp dịch Việt; hiện chỉ có bản zh.
const sourceText=()=>!contentLocaleIsVietnamese(currentLocale());
const safeLabel=value=>typeof value === 'string' && value.trim() && !cjk.test(value)
  ? value.trim()
  : 'Nội dung tiếng Việt chưa sẵn sàng';
/** Tên mùa nguồn theo bản đang xem: bản ja dùng tên mùa Nhật đã xác minh, thiếu thì giữ tên nguồn. */
const sourceSeasonName=item=>localSeasonName(item.nameRaw,currentLocale());
/** Tên mùa không kèm số đội (chip tóm tắt của Gợi ý đội). */
export const seasonNameText=item=>sourceText()
  ? [item.displayCode,sourceSeasonName(item)].filter(Boolean).join(' · ') || item.label || item.sourceSeasonId
  : item.displayCode && item.displayNameVi
    ? `${item.displayCode} · ${item.displayNameVi}`
    : safeLabel(item.displayNameVi);
/**
 * Nhãn một mùa trong ô chọn mùa (Đội chuẩn và công cụ Gợi ý đội dùng chung). `currentSourceSeasonId` là mùa đang diễn ra:
 * `defaultSourceSeasonId` của registry, cùng nguồn với trang mùa và nhãn "mùa cũ" của trang đội (không còn hằng số ở client).
 */
export const seasonOptionText=(item,currentSourceSeasonId)=>`${seasonNameText(item)}${item.advertisedCountRaw != null ? ` (${item.advertisedCountRaw})` : ''}${currentSourceSeasonId && item.sourceSeasonId===currentSourceSeasonId ? L(' · Hiện tại',' · 当前',' · 現在') : ''}`;
// Bản zh hiện đúng tên mùa nguồn nên không cần chú thích tên dịch.
export const seasonOptionTitle=item=>sourceText() ? null : [
  item.label && !cjk.test(item.label) ? item.label : null,
  item.translationStatus === 'reference-translation' ? 'Tên dịch tham khảo, không phải tên mùa chính thức' : null,
].filter(Boolean).join(' · ') || null;

/** Tên mùa đứng một mình (không mã, không số đội): bản vi `displayNameVi`, bản khác tên nguồn (như `seasonNameText`). */
const seasonTitleText=item=>sourceText()
  ? sourceSeasonName(item) || item.label || item.sourceSeasonId
  : safeLabel(item.displayNameVi);

/**
 * Mùa duy nhất của dữ liệu Đội khác: hợp `sourceSeasonIds` của mọi hàng (`other-teams.json`, do dedup ghi). Không có
 * hàng, có hàng chưa gắn mùa hoặc hợp lại hơn một mùa thì trả `null`. Không suy từ `defaultSourceSeasonId`: đổi mùa
 * mặc định của Đội chuẩn không tự đổi mùa của Đội khác.
 */
export function otherTeamsSeasonId(rows) {
  const seasons=new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!Array.isArray(row?.sourceSeasonIds) || !row.sourceSeasonIds.length) return null;
    for (const id of row.sourceSeasonIds) seasons.add(id);
  }
  return seasons.size===1 ? [...seasons][0] : null;
}

/**
 * Nhãn mùa tĩnh của Đội khác: Đội khác chỉ có một mùa (`otherTeamsSeasonId` của các hàng) nên không có ô chọn; tên mùa
 * lấy từ `seasonOptions` của registry. Dạng cây dùng chung giữa bản dựng sẵn và trình duyệt; không xác định được mùa,
 * hoặc registry không có mùa đó, thì không có nhãn (`null`).
 */
export function referenceSeasonLabelTree(registry,rows) {
  const seasonId=otherTeamsSeasonId(rows);
  const item=seasonId ? (registry?.seasonOptions || []).find(option=>option.sourceSeasonId===seasonId) : null;
  if (!item) return null;
  return t('div',{class:'reference-season-field reference-season-static'},[
    t('span',{class:'reference-season-label'},L('Mùa','赛季','シーズン')),
    ' ',
    t('span',{class:'reference-season-name'},seasonTitleText(item)),
  ]);
}

/**
 * Shared-style Team chuẩn/Team khác browser: sidebar lọc, thẻ gọn và chế độ Bảng. Đội chuẩn liệt kê từng đội (hàng của
 * `index.json`); Đội khác liệt kê team (mục `otherTeamListEntries` của cả payload `other-teams.json`): đếm, facet, phân
 * trang đều theo team, cùng tập và thứ tự với bản dựng sẵn.
 */
export function createRecommendedSection({mount,family,onQuery,onReplaceQuery=onQuery,hrefFor,onNavigate,adopt=false}) {
  const other=family==='other';
  // `rows`: hàng nguồn (Đội chuẩn: `index.json`; Đội khác: `records` của `payload`, dùng cho nhãn mùa tĩnh).
  let rows=[], payload=null, state={query:'',filters:{},view:TEAM_VIEW_CARDS}, registry={seasonOptions:[]}, currentScopeRows=[];
  // Lượt đang hiện chỉ giữ khi danh sách không đổi (cùng mùa, lọc, từ khóa, kiểu hiển thị).
  // `filteredRows`/`currentScopeRows`: mục của danh sách (Đội chuẩn: hàng đội; Đội khác: mục team).
  let filteredRows=[], viewLabels={}, emptyText='', shown=PAGE_SIZE, listKey=null, openedKey=null;
  /** Mục danh sách của `listState`: Đội khác theo team (link đã gắn theo phương án khớp), Đội chuẩn theo đội. */
  const projectItems=(listState,labels,byConfigId=null)=>other
    ? otherTeamListEntries(payload,listState,labels,{hrefFor})
    : projectRecommendedRows(rows,listState,labels,byConfigId);
  const itemFacetValues=other ? otherTeamFacetValues : referenceFacetValues;
  /** Khóa `data-reference-key` của một mục: thẻ team Đội khác mang khóa của phương án đại diện. */
  const itemKey=item=>referenceRowKey(other ? item.displayRecord : item);
  // Kho của người xem (chỉ Đội chuẩn): `undefined` = chưa biết, `null` = máy chưa có kho, hàm = mùa → độ phủ kho
  // (`buildListCoverage`). `coverage` là độ phủ của mùa đang xem; `null` khi không gắn badge được.
  let rosterSource, coverage=null, updated=false;
  // Trạng thái mở/đóng vừa khôi phục khi quay lại từ trang chi tiết; dùng lại nếu kho tới sau và làm danh sách dựng lại.
  let restoredDisclosures=null;
  const rosterBar=el('div',{class:'reference-roster-bar',hidden:''});
  const openFacets=new Set();
  const title=referenceSectionTitle(family);
  const headText=treeToDom(referenceHeadTextTree(title,family));
  const heading=headText.querySelector('h1');
  const searchInput=el('input',{type:'search',class:'reference-search-input','aria-label':L(`Tìm ${title}`,`搜索${title}`,`${title}を検索`),placeholder:L('Tìm tướng, chiến pháp, binh thư…','搜索武将、战法、兵书…','武将・戦法・兵法書を検索…')});
  const search=el('label',{class:'search reference-search'},[
    icon([svgNode('circle',{cx:11,cy:11,r:7}),svgNode('line',{x1:16.5,y1:16.5,x2:21,y2:21})]),
    searchInput,
  ]);
  // Chỉ Đội chuẩn có ô chọn mùa; Đội khác một mùa nên chỉ có nhãn tĩnh (`referenceSeasonLabelTree`).
  const season=family==='other' ? null : el('select',{'aria-label':L('Mùa','赛季','シーズン')});
  const seasonStatus=family==='other' ? null : el('span',{class:'reference-season-status',hidden:''},L('Đang diễn ra','进行中','開催中'));
  let seasonLabelNode=null, seasonLabelRegistry=null, seasonLabelRows=null;
  const filters=el('aside',{class:'reference-filters collapsed',id:`${mount.id}-filters`,'aria-label':L('Bộ lọc','筛选','絞り込み')});
  const notice=el('p',{class:'scope-note reference-notice',role:'status'});
  const count=el('span',{class:'stats reference-count',role:'status'});
  // Danh sách đầu do build dựng sẵn (`data-ssr-signature`): trình duyệt nhận lại nguyên DOM đó nếu đúng trạng thái đầu.
  const view=(adopt && mount.querySelector(':scope > .reference-view[data-ssr-signature]')) || el('div',{class:'reference-view'});
  const more=el('div',{class:'lookup-more-row reference-more'});
  const empty=el('p',{class:'empty reference-empty'});
  const clear=el('button',{type:'button',class:'clear-btn',onClick:()=>{
    onQuery({q:null,faction:null,unit:null,tier:null,subcategory:null,source:null,kho:null});
    // Xóa lọc làm nút này bị vô hiệu và cây lọc dựng lại: trả focus về ô tìm kiếm, không thả về BODY.
    searchInput.focus({preventScroll:true});
  }},L('Xóa lọc','清除筛选','絞り込みを解除'));
  const filterCount=el('span',{class:'filter-count','aria-hidden':'true',hidden:''});
  const toggle=el('button',{type:'button',class:'filter-collapse-toggle','aria-controls':filters.id,'aria-expanded':'false'},[
    icon(filterIcon(),{size:18}),
    el('span',{class:'filter-toggle-label'},L('Bộ lọc','筛选','絞り込み')),
    filterCount,
  ]);
  const viewButtons=VIEW_OPTIONS.map(option=>el('button',{
    type:'button',class:`view-btn view-btn-${option.value}`,dataset:{view:option.value},'aria-pressed':'false',
    'aria-label':L(option.aria,option.ariaZh,option.ariaJa),title:L(option.aria,option.ariaZh,option.ariaJa),
    onClick:()=>{if (option.value!==currentView()) trackFilter('view',option.value); onQuery({view: option.value===TEAM_VIEW_CARDS ? null : option.value});},
  },[icon(option.icon(),{size:16}),el('span',{class:'view-btn-label'},L(option.label,option.labelZh,option.labelJa))]));
  // Title/CTA là link thật: chỉ ghi snapshot, không chặn hành vi trình duyệt.
  // Marker ổn định của link chi tiết, không pin path segment của route.
  view.addEventListener('click',event=>{
    const link=event.target.closest?.('a[data-team-detail-link]');
    if (!link) return;
    // Ghi khóa thẻ trước snapshot để khi quay lại, danh sách dựng tới thẻ này và trả focus về nó.
    if (isNativeNavigationClick(event)) openedKey=link.closest('[data-reference-key]')?.dataset.referenceKey || null;
    onNavigate?.(event,link);
  });
  searchInput.addEventListener('input',()=>onQuery({q:searchInput.value || null}));
  season?.addEventListener('change',()=>{trackFilter('season',season.value); onQuery({season:season.value,detail:null,legacyTeam:null,legacyVariant:null},true);});
  toggle.addEventListener('click',()=>setFiltersExpanded(filters.classList.contains('collapsed')));
  const results = el('div',{class:'reference-results'},[
    el('div',{class:'reference-toolbar'},[
      search,
      toggle,
      count,
      el('div',{class:'reference-view-toggle',role:'group','aria-label':L('Kiểu hiển thị','显示方式','表示形式')},viewButtons),
    ]),
    filters,
    el('div',{class:'reference-results-body'},[rosterBar,notice,view,more,empty]),
  ]);
  // A5: panel lọc mobile đóng bằng Escape và trả focus về nút "Bộ lọc", như menu thả ở header.
  // Desktop luôn hiện sidebar và nút này bị ẩn (`getClientRects` rỗng) nên Escape không đụng tới.
  results.addEventListener('keydown',event=>{
    if (event.key !== 'Escape') return;
    if (filters.classList.contains('collapsed') || !toggle.getClientRects().length) return;
    event.preventDefault();
    setFiltersExpanded(false);
    toggle.focus({preventScroll:true});
  });
  const head=el('header',{class:'reference-head'},[
    headText,
    // Đội chuẩn: ô chọn gói trong một khung có nhãn nhỏ phía trên giá trị. Đội khác: nhãn mùa tĩnh, dựng khi có registry.
    ...(family==='other' ? [] : [el('label',{class:'reference-season-field'},[
      el('span',{class:'reference-season-label'},L('Mùa','赛季','シーズン')),
      seasonStatus,
      season,
      icon(chevron(),{size:16}),
    ])]),
  ]);
  mount.replaceChildren(
    head,
    el('div',{class:'reference-browser'},results),
  );

  /** Mở/đóng panel lọc mobile; desktop luôn hiện sidebar nên class này vô hại. */
  function setFiltersExpanded(expanded) {
    const open=expanded === true;
    filters.classList.toggle('collapsed',!open);
    toggle.setAttribute('aria-expanded',String(open));
  }

  // Bản zh: giá trị nguồn chữ Hán giữ nguyên, giá trị tiếng Việt của đội cũ đổi sang nhãn chữ Hán.
  const displayLabel=(kind,value)=>sourceText()
    ? (typeof value === 'string' && cjk.test(value) ? value : legacyLabelZh(kind,value) ?? String(value ?? ''))
    : safeLabel(registry.displayLabels?.[kind]?.[value] || value);

  function renderSeasonOptions() {
    if (family==='other') {
      // Nhãn tĩnh chỉ dựng lại khi registry hoặc dữ liệu đổi, không theo từng lần lọc.
      if (seasonLabelRegistry===registry && seasonLabelRows===rows) return;
      seasonLabelRegistry=registry;
      seasonLabelRows=rows;
      const tree=referenceSeasonLabelTree(registry,rows);
      const next=tree ? treeToDom(tree) : null;
      seasonLabelNode?.remove();
      seasonLabelNode=next;
      if (next) head.append(next);
      return;
    }
    const current=state.season || registry.defaultSourceSeasonId;
    const options=registry.seasonOptions || [];
    // `all` có ở Đội chuẩn (link Tra cứu mở `?season=all`).
    season.replaceChildren(
      el('option',{value:'all'},L('Tất cả','全部','すべて')),
      ...options.map(item=>el('option',{value:item.sourceSeasonId,title:seasonOptionTitle(item)},seasonOptionText(item,registry.defaultSourceSeasonId))),
    );
    if ([...season.options].some(option=>option.value===current)) season.value=current;
    seasonStatus.hidden=season.value!==registry.defaultSourceSeasonId;
  }

  // Facet sắp theo số đếm giảm dần (như artboard), hòa thì theo nhãn hiển thị của ngôn ngữ trang;
  // giá trị đang chọn vẫn có mặt khi phạm vi hiện tại không đếm được nó.
  const facetEntries=(scopeRows,key)=>{
    const counts=new Map();
    for (const row of scopeRows) for (const value of itemFacetValues(row,key)) counts.set(value,(counts.get(value) || 0)+1);
    for (const value of state.filters?.[key] || []) if (!counts.has(value)) counts.set(value,0);
    const locale=currentLocale();
    if (key==='tier') return [...counts].sort(([a],[b])=>(SOURCE_TIER_ORDER.indexOf(a)<0?999:SOURCE_TIER_ORDER.indexOf(a))-(SOURCE_TIER_ORDER.indexOf(b)<0?999:SOURCE_TIER_ORDER.indexOf(b)) || a.localeCompare(b));
    return [...counts].sort(([a,countA],[b,countB])=>countB-countA || chipText(key,a).localeCompare(chipText(key,b),locale));
  };
  const chipText=(key,value)=>key==='tier'?sourceTierLabel(value):key==='source'?(value===TIER_SOURCE_JP?jpTierSourceLabel():sourceLabel(value)):displayLabel(key,value);

  /** Chip đã chọn + từ khóa tìm: những lọc thu hẹp danh sách mà số của cả mùa trên nút kho không còn khớp. */
  function narrowingCount() {
    const facets=Object.values(state.filters || {}).reduce((total,values)=>total + (Array.isArray(values) ? values.length : 0),0);
    return facets + (state.query ? 1 : 0);
  }

  /** Lọc đang bật = chip đã chọn + từ khóa tìm + lọc kho; dùng cho badge "Bộ lọc" và trạng thái "Xóa lọc". */
  function activeFilterCount() {
    return narrowingCount() + (coverage && state.rosterFilter ? 1 : 0);
  }

  /** Thanh kho phía trên danh sách: tóm tắt + nút lọc/sắp khi có kho, một dòng dẫn khi máy chưa có kho. */
  function paintRosterBar() {
    if (family!=='recommended' || rosterSource===undefined || (rosterSource && !coverage)) {
      rosterBar.hidden=true;
      rosterBar.removeAttribute('data-state');
      rosterBar.replaceChildren();
      return;
    }
    rosterBar.hidden=false;
    if (!coverage) {
      rosterBar.replaceChildren(rosterHintNode());
      rosterBar.dataset.state='empty';
      return;
    }
    const focused=rosterBar.contains(document.activeElement) ? document.activeElement.dataset.focusKey : null;
    rosterBar.replaceChildren(
      rosterSummaryNode(coverage.summary,{allSeasons:state.season==='all'}),
      rosterControlNodes({filter:state.rosterFilter,sort:state.rosterSort,summary:narrowingCount() ? null : coverage.summary,onChange:change=>{trackRosterChange(change); onQuery(change);}}),
    );
    rosterBar.dataset.state='ready';
    if (focused) rosterBar.querySelector(`[data-focus-key="${CSS.escape(focused)}"]`)?.focus({preventScroll:true});
  }

  const facetChip=(key,selected,value,count)=>{
    // Mã màu phe tra theo nhãn Việt của registry (hoặc giá trị Việt của đội cũ), không theo chữ hiển thị.
    const code=key==='faction' ? FACTION_CODE[registry.displayLabels?.faction?.[value] ?? value] : null;
    return el('button',{
      type:'button',class:`fchip ${key}-chip${code ? ` f-${code}` : ''}${selected.includes(value) ? ' on' : ''}`,'aria-pressed':String(selected.includes(value)),
      title:sourceText() || chipText(key,value)===value?null:value,dataset:{focusKey:`${key}:${value}`},
      onClick:()=>{trackFilter('facet',`${key}:${value}`); onQuery({[key]:selected.includes(value)?selected.filter(item=>item!==value):[...selected,value]});},
    },[
      el('span',{class:'fchip-check','aria-hidden':'true'}),
      el('span',{class:'fchip-label'},chipText(key,value)),
      ' ',
      el('span',{class:'fchip-count'},String(count)),
    ]);
  };

  function facetGroup(key,entries) {
    if (!entries.length) return null;
    const selected=state.filters?.[key] || [];
    const secondary=SECONDARY_FACETS.includes(key);
    const open=secondary && openFacets.has(key);
    const row=el('div',{class:'chip-row',id:`${mount.id}-${key}-values`},entries.map(([value,count])=>facetChip(key,selected,value,count)));
    // Nhóm phụ thu gọn mặc định: chip vẫn nằm trong DOM nhưng `hidden` giữ đúng trạng thái.
    if (secondary && !open) row.hidden=true;
    const label=secondary
      ? el('button',{type:'button',class:'flabel flabel-toggle','aria-expanded':String(open),'aria-controls':row.id,dataset:{focusKey:`${key}:toggle`},onClick:()=>{
        if (openFacets.has(key)) openFacets.delete(key); else openFacets.add(key);
        renderFacets(currentScopeRows);
      }},[facetLabel(key),icon(chevron(),{size:16})])
      : el('div',{class:'flabel'},facetLabel(key));
    return el('div',{class:`fgroup ${key}-group${secondary?' secondary':''}`},[label,row]);
  }

  /** Dựng lại sidebar nhưng giữ focus theo `data-focus-key` để lọc bằng bàn phím không bị mất chỗ. */
  function replaceFilterNodes(children) {
    const focused=filters.contains(document.activeElement) ? document.activeElement.dataset.focusKey : null;
    filters.replaceChildren(...children);
    if (focused) filters.querySelector(`[data-focus-key="${CSS.escape(focused)}"]`)?.focus({preventScroll:true});
  }

  function renderFacets(scopeRows) {
    const active=activeFilterCount();
    clear.disabled=active===0;
    filterCount.textContent=String(active);
    filterCount.hidden=active===0;
    replaceFilterNodes([
      el('div',{class:'reference-filter-head'},[el('h2',{class:'reference-filter-title'},L('Bộ lọc','筛选','絞り込み')),clear]),
      ...[...PRIMARY_FACETS,...SECONDARY_FACETS].map(key=>facetGroup(key,facetEntries(scopeRows,key))).filter(Boolean),
    ]);
  }

  const currentView=()=>canonicalTeamView(state.view) || TEAM_VIEW_CARDS;

  function updateViewButtons() {
    const active=currentView();
    for (const button of viewButtons) {
      const on=button.dataset.view===active;
      button.setAttribute('aria-pressed',String(on));
      button.classList.toggle('on',on);
    }
  }

  // Cây view dựng ở recommended-reference-render.js; ở đây chỉ đổi sang DOM rồi gắn sự kiện "tìm chiến pháp".
  const toNode=tree=>{
    const node=treeToDom(tree);
    bindTacticTags(node,value=>onQuery({q:value}));
    return node;
  };
  const itemNode=(item,mode)=>toNode(other
    ? otherTeamItemTree(item,mode,{labels:viewLabels})
    : teamItemTree(item,mode,{hrefFor,labels:viewLabels}));

  /** Focus vào link chi tiết của thẻ/hàng; thẻ không có link thì chính thẻ nhận focus. */
  function focusItem(node,options) {
    if (!node) return;
    const link=node.querySelector('a[data-team-detail-link]');
    if (link) { link.focus(options); return; }
    node.tabIndex=-1;
    node.focus(options);
  }

  /** Một nhóm Tier; số đội của nhóm đếm trên toàn bộ danh sách đã lọc, không chỉ lượt đang hiện. */
  const tierSection=(tier,items,index,mode)=>toNode(tierSectionTree(tier,items,{
    index,mode,mountId:mount.id,hrefFor,labels:viewLabels,
    total:filteredRows.filter(row=>tierOf(row)===tier).length,
  }));

  /** Dựng `shown` đội đầu của danh sách đã lọc; số đếm "N / M đội" vẫn là toàn bộ danh sách. */
  function renderView() {
    const mode=currentView();
    const prerendered=view.dataset.ssrSignature;
    view.removeAttribute('data-ssr-signature');
    // Đang lọc/sắp theo kho thì danh sách khác bản dựng sẵn: không nhận lại DOM đó.
    const rosterOrdered=Boolean(coverage && (state.rosterFilter || state.rosterSort));
    const prerenderedFor=count=>!rosterOrdered && prerendered!==undefined && prerendered===referenceViewSignature(state,mode,count);
    // Mùa dài hơn một lượt: bản dựng sẵn có đủ mọi đội (dấu mang tổng số đội), nên nhận lại cả danh sách ở lần vẽ đầu
    // và coi như đã "Xem thêm" hết, thay vì bỏ phần sau lượt đầu rồi dựng lại.
    const wholeList=!prerenderedFor(shown) && prerenderedFor(filteredRows.length);
    if (wholeList) shown=filteredRows.length;
    if (wholeList || prerenderedFor(shown)) {
      // Đúng danh sách đã dựng sẵn: giữ nguyên node, chỉ gắn sự kiện "tìm chiến pháp" (không nháy, không nhân đôi).
      bindTacticTags(view,value=>onQuery({q:value}));
    } else {
      view.replaceChildren(...recommendedListTrees(filteredRows,{family,mode,limit:shown,labels:viewLabels,hrefFor,mountId:mount.id}).map(toNode));
    }
    decorateCoverageBadges(view,coverage?.byConfigId);
    renderMore();
    empty.textContent=emptyText;
    empty.hidden=filteredRows.length>0;
  }

  /** Hàng "Xem thêm" khi còn đội chưa hiện (cùng mẫu với Tra cứu). */
  function renderMore() {
    more.replaceChildren();
    more.hidden=shown>=filteredRows.length;
    if (more.hidden) return;
    more.append(
      el('button',{type:'button',class:'lookup-more',onClick:appendNextPage},L('Xem thêm','查看更多','もっと見る')),
      el('span',{class:'lookup-more-note'},L(`Mỗi lượt hiện ${PAGE_SIZE} đội`,`每次显示 ${PAGE_SIZE} 队`,`1回に${PAGE_SIZE}編成ずつ表示`)),
    );
  }

  /** Hiện thêm một lượt rồi đưa focus tới đội đầu của lượt mới; thẻ/hàng đã hiện giữ nguyên node.
   *  Đội chuẩn nhóm theo Tier: đội của lượt mới nối vào nhóm Tier đã có, Tier mới thành nhóm mới ở cuối. */
  function appendNextPage() {
    const mode=currentView();
    const batch=filteredRows.slice(shown,shown+PAGE_SIZE);
    shown+=PAGE_SIZE;
    const container=root=>root.querySelector('.reference-table tbody') ?? root.querySelector('.team-grid') ?? root.firstElementChild;
    let first=null;
    if (family==='recommended') {
      for (const [tier,items] of groupRowsByTier(batch)) {
        const existing=[...view.children].find(section=>section.dataset.tier===tier);
        if (existing) {
          const nodes=items.map(row=>itemNode(row,mode));
          container(existing).append(...nodes);
          first??=nodes[0];
        } else {
          const section=tierSection(tier,items,view.children.length,mode);
          view.append(section);
          first??=section.querySelector('[data-reference-key]');
        }
      }
    } else {
      const nodes=batch.map(row=>itemNode(row,mode));
      container(view).append(...nodes);
      first=nodes[0];
    }
    decorateCoverageBadges(view,coverage?.byConfigId);
    renderMore();
    focusItem(first);
  }

  /** `keepSameList`: danh sách sau khi tính lại vẫn đúng các đội đang hiện thì giữ nguyên node, chỉ gắn lại badge
   *  (kho tới sau lần vẽ đầu không được thay thẻ dựng sẵn hay làm mất trạng thái mở/đóng của thẻ). */
  function render({keepSameList=false}={}) {
    if (searchInput.value!==state.query) searchInput.value=state.query || '';
    renderSeasonOptions();
    const labels=registry.displayLabels || {};
    const scopeRows=projectItems({...state,query:'',filters:{}},labels);
    currentScopeRows=scopeRows;
    // Độ phủ kho của mùa đang xem; mùa không có đội nào tính được (tổng 0) thì coi như không có độ phủ.
    // Lỗi khi tính độ phủ (dữ liệu mùa lạ) không được làm hỏng cả lượt vẽ: coi như mùa đó không có độ phủ.
    let seasonCoverage=null;
    if (family==='recommended' && typeof rosterSource==='function') {
      try { seasonCoverage=rosterSource(state.season); } catch (error) { console.error(error); }
    }
    coverage=seasonCoverage?.summary.total ? seasonCoverage : null;
    paintRosterBar();
    renderFacets(scopeRows);
    const filtered=projectItems(state,labels,coverage?.byConfigId);
    const rosterOrder=coverage && (state.rosterFilter || state.rosterSort) ? [state.rosterFilter ?? null,state.rosterSort ?? null] : null;
    const key=JSON.stringify([state.season ?? null,state.query || '',state.filters || {},currentView(),rosterOrder]);
    const sameList=keepSameList && key===listKey && filtered.length===filteredRows.length && filtered.every((row,index)=>row===filteredRows[index]);
    if (key!==listKey) { listKey=key; shown=PAGE_SIZE; }
    count.replaceChildren(el('strong',{},String(filtered.length)),L(` / ${scopeRows.length} đội`,` / ${scopeRows.length} 队`,` / ${scopeRows.length}編成`));
    // Mùa chưa thu thập đánh dấu trên từng phạm vi của mùa đó; danh sách luôn gộp mọi danh mục.
    const sourceScope=family==='recommended' ? registry.scopes?.find(scope=>scope.sourceSeasonId===state.season && scope.state==='uncollected-season') : null;
    const scopeNotice=sourceScope?L('Mùa này chưa được thu thập.','该赛季尚未收录。','このシーズンはまだ収録されていません。'):'';
    notice.textContent=[...(state.notices || []),scopeNotice].filter(Boolean).join(' ');
    notice.hidden=!notice.textContent;
    updateViewButtons();
    filteredRows=filtered;
    viewLabels=labels;
    emptyText=scopeRows.length?L('Không có đội khớp bộ lọc.','没有符合筛选条件的阵容。','絞り込み条件に合う編成がありません。'):sourceScope?L('Mùa này chưa được thu thập.','该赛季尚未收录。','このシーズンはまだ収録されていません。'):L('Mùa này chưa có dữ liệu.','本赛季暂无数据。','このシーズンのデータはまだありません。');
    if (sameList) decorateCoverageBadges(view,coverage?.byConfigId);
    else renderView();
    // Máy có kho nhưng mùa đang xem không có độ phủ: `kho`/`xep` không có tác dụng, thanh kho ẩn và "Xóa lọc" không gỡ được
    // chúng. Gỡ khỏi URL để đổi sang mùa có độ phủ không bật lại một bộ lọc người dùng đã quên. Chưa biết kho
    // (`undefined`, đang tải/hỏi lại phiên) hay máy chưa có kho (`null`) thì giữ nguyên: lúc đó chưa biết mùa có độ phủ hay không.
    // Không có độ phủ thì hai khóa này không nằm trong `listKey`, nên chỉ bỏ khỏi trạng thái của mục và sửa URL (không vẽ lại):
    // danh sách dựng sẵn, `details` đang mở và focus khôi phục khi quay lại được giữ nguyên.
    if (family==='recommended' && typeof rosterSource==='function' && !coverage && (state.rosterFilter || state.rosterSort)) {
      state={...state,rosterFilter:null,rosterSort:null};
      onReplaceQuery({kho:null,xep:null});
    }
  }
  return {
    /** `data`: Đội chuẩn là mảng hàng `index.json`; Đội khác là cả payload `other-teams.json` (`records` + `teamGroups`). */
    update(data,nextState,nextRegistry){
      if (other) { payload=data; rows=Array.isArray(data?.records) ? data.records : []; }
      else rows=data;
      state=nextState;registry=nextRegistry;updated=true;restoredDisclosures=null;render();
    },
    /** Trao kho của người xem: `null` = máy chưa có kho; hàm `seasonId => độ phủ` = có kho. Vẽ lại nếu danh sách đã dựng. */
    setRoster(source){
      rosterSource=source;
      if (!updated) return;
      const previousKey=listKey;
      render({keepSameList:true});
      // Kho tới sau khi trang đã khôi phục vị trí quay lại và làm danh sách đổi (đang lọc/sắp theo kho): khôi phục lại
      // trên danh sách mới để thẻ vừa mở vẫn được dựng tới và nhận focus.
      if (listKey!==previousKey && restoredDisclosures) applyDisclosures(restoredDisclosures);
    },
    focus(){heading.focus();},
    setSearch(value){onQuery({q:value || null});},
    setFiltersExpanded,
    getDisclosureState(){
      return {
        filters:filters.classList.contains('collapsed') === false,
        alternatives:[...view.querySelectorAll('.reference-team-card[data-reference-key] > details.reference-alternatives[open]')]
          .map(details=>details.parentElement.dataset.referenceKey).filter(Boolean).slice(0,12),
        ...(openedKey ? {target:openedKey} : {}),
      };
    },
    setDisclosureState(disclosures={}){
      restoredDisclosures=disclosures;
      applyDisclosures(disclosures);
    },
    /** Người dùng đã thao tác sau lần khôi phục: kho tới sau đó không áp lại trạng thái mở/đóng và focus cũ. */
    forgetRestoredDisclosures(){restoredDisclosures=null;},
  };

  function applyDisclosures(disclosures={}) {
      setFiltersExpanded(disclosures.filters);
      // Thẻ đã mở chi tiết nằm sau các lượt đầu: dựng đủ lượt tới nó để focus và mốc cuộn còn đúng chỗ.
      const target=disclosures.target ? filteredRows.findIndex(item=>itemKey(item)===disclosures.target) : -1;
      if (target>=shown) {
        shown=Math.ceil((target+1)/PAGE_SIZE)*PAGE_SIZE;
        renderView();
      }
      const open=new Set(disclosures.alternatives || []);
      for (const card of view.querySelectorAll('.reference-team-card[data-reference-key]')) {
        const details=card.querySelector(':scope > details.reference-alternatives');
        if (details) details.open=open.has(card.dataset.referenceKey);
      }
      if (target>=0) focusItem([...view.querySelectorAll('[data-reference-key]')].find(node=>node.dataset.referenceKey===disclosures.target),{preventScroll:true});
  }
}
