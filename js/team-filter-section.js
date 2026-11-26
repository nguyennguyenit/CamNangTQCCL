// Ba mục danh sách: Cùng Tồn (chọn mùa + phiên bản), Đội chuẩn và Đội khác (sidebar lọc,
// chế độ Thẻ / Thẻ gọn / Bảng). Trên điện thoại, vùng nhóm lọc thu gọn sau nút "Bộ lọc".

import { el, t, iconTree, coexistGroupLabel, seasonCoexistGroup } from './render.js';
import { track } from './analytics.js';
import { L } from './i18n.js';

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
    treeToDom(iconTree(chevron, {size: 16})),
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

import { projectRecommendedRows } from './recommended-reference-state.js';
import { bindTacticTags, coexistTeamCard, groupRowsByTier, otherTeamItemTree, recommendedListTrees, referenceRowKey, teamItemTree, tierOf, tierSectionTree } from './recommended-reference-render.js';
import { otherTeamListEntries } from './other-team-groups.js';
import { decorateCoverageBadges, rosterControlNodes, rosterHintNode, rosterSummaryNode } from './roster-list-badges.js';
import { treeToDom } from './view-tree.js';
import { TEAM_VIEW_CARDS, canonicalTeamView } from './team-view.js';
import { isNativeNavigationClick } from './team-detail-navigation.js';
import {
  PRIMARY_FACETS, SECONDARY_FACETS, VIEW_OPTIONS, activeFilterCount, chevron, cjk, facetEntries, narrowingCount, referenceCountTrees,
  referenceEmptyHidden, referenceFiltersChildrenTree, referenceMoreHidden, referenceNoticeHidden, referenceShellTree, safeLabel, sourceText,
} from './reference-shell-tree.js';

// Đo lường (GA4 `filter_change`): chỉ gọi từ thao tác của người dùng trên điều khiển, không từ lần dựng đầu hay khôi phục URL.
const trackFilter=(filter,value)=>track('filter_change',{filter,filter_value:String(value)});
/** `change` của cụm nút kho: `{kho}` hoặc `{xep}`; `null` (tắt) báo là `tat`. */
const trackRosterChange=change=>{
  for (const key of ['kho','xep']) if (key in change) trackFilter(key,change[key] ?? 'tat');
};

/** Danh sách dài dựng theo lượt: dựng cả 1366 thẻ một lần làm trang đứng vài giây trên máy chậm. */
export const PAGE_SIZE=60;

/**
 * Hàng "Xem thêm": nút + ghi chú số đội mỗi lượt. Dạng cây dùng chung giữa bản dựng sẵn (nút bị khoá tới khi trình duyệt gắn xong)
 * và `renderMore()`.
 */
export const referenceMoreTrees=()=>[
  t('button',{type:'button',class:'lookup-more'},L('Xem thêm','查看更多','もっと見る')),
  t('span',{class:'lookup-more-note'},L(`Mỗi lượt hiện ${PAGE_SIZE} đội`,`每次显示 ${PAGE_SIZE} 队`,`1回に${PAGE_SIZE}編成ずつ表示`)),
];

/**
 * Chữ của thông báo (thông báo của URL, thêm câu "mùa chưa thu thập") và dòng "không có đội" ở vùng kết quả. Một luật cho `render()`
 * của trình duyệt và bản dựng sẵn; `scopeCount` là số mục của cả phạm vi (chưa lọc).
 */
export function referenceListTexts({family,state,registry,scopeCount}) {
  // Mùa chưa thu thập đánh dấu trên từng phạm vi của mùa đó; danh sách luôn gộp mọi danh mục.
  const sourceScope=family==='recommended' ? registry.scopes?.find(scope=>scope.sourceSeasonId===state.season && scope.state==='uncollected-season') : null;
  const scopeNotice=sourceScope?L('Mùa này chưa được thu thập.','该赛季尚未收录。','このシーズンはまだ収録されていません。'):'';
  return {
    noticeText:[...(state.notices || []),scopeNotice].filter(Boolean).join(' '),
    emptyText:scopeCount?L('Không có đội khớp bộ lọc.','没有符合筛选条件的阵容。','絞り込み条件に合う編成がありません。'):sourceScope?L('Mùa này chưa được thu thập.','该赛季尚未收录。','このシーズンはまだ収録されていません。'):L('Mùa này chưa có dữ liệu.','本赛季暂无数据。','このシーズンのデータはまだありません。'),
  };
}

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

/** Tên mùa không kèm số đội (chip tóm tắt của Gợi ý đội). */
export const seasonNameText=item=>sourceText()
  ? [item.displayCode,item.nameRaw].filter(Boolean).join(' · ') || item.label || item.sourceSeasonId
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
  ? item.nameRaw || item.label || item.sourceSeasonId
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
 * Các `<option>` của ô chọn mùa Đội chuẩn: `all` (link Tra cứu mở `?season=all`) rồi từng mùa của registry. `selected`: giá trị
 * đang chọn, ghi thuộc tính `selected`; bản dựng sẵn và trình duyệt cùng ghi nên DOM sau boot ở trạng thái mặc định đúng bằng bản dựng sẵn.
 */
export function referenceSeasonOptionTrees({registry,selected=null}) {
  return [
    t('option',{value:'all',selected:selected==='all'},L('Tất cả','全部','すべて')),
    ...(registry.seasonOptions || []).map(item=>t('option',{value:item.sourceSeasonId,title:seasonOptionTitle(item),selected:selected===item.sourceSeasonId},seasonOptionText(item,registry.defaultSourceSeasonId))),
  ];
}

/** Giá trị mà ô chọn mùa đang chọn: mùa của state (hoặc mùa mặc định của registry) nếu có option, không thì mục đầu `all`. */
function seasonSelection(registry,state) {
  const current=state.season || registry.defaultSourceSeasonId;
  return ['all',...(registry.seasonOptions || []).map(item=>item.sourceSeasonId)].includes(current) ? current : 'all';
}

/**
 * Ô chọn mùa của Đội chuẩn ở đầu mục: nhãn "Mùa", huy hiệu "Đang diễn ra" (chỉ hiện khi đang xem đúng mùa mặc định của registry),
 * `select` và mũi tên. Mùa đang xem là `state.season` hoặc mùa mặc định; không khớp option nào thì `select` rơi về mục đầu (`all`).
 * Dạng cây dùng chung giữa bản dựng sẵn và trình duyệt; chỉ dùng cho Đội chuẩn (Đội khác có `referenceSeasonLabelTree`).
 */
export function referenceSeasonFieldTree({registry,state}) {
  const selected=seasonSelection(registry,state);
  return t('label',{class:'reference-season-field'},[
    t('span',{class:'reference-season-label'},L('Mùa','赛季','シーズン')),
    t('span',{class:'reference-season-status',hidden:selected!==registry.defaultSourceSeasonId},L('Đang diễn ra','进行中','開催中')),
    t('select',{'aria-label':L('Mùa','赛季','シーズン')},referenceSeasonOptionTrees({registry,selected})),
    iconTree(chevron,{size:16}),
  ]);
}

/**
 * Đầu mục Đội chuẩn / Đội khác: chữ đầu mục rồi ô chọn mùa (Đội chuẩn) hoặc nhãn mùa tĩnh (Đội khác, khi `rows` cho biết được mùa).
 * Một cây cho bản dựng sẵn và trình duyệt; `lock` (mặc định giữ nguyên) áp lên ô chọn mùa, bản dựng sẵn khoá điều khiển bằng nó.
 */
export function referenceHeadTree({title,family,registry,state,rows,lock=tree=>tree}) {
  return t('header',{class:'reference-head'},[
    referenceHeadTextTree(title,family),
    family==='other' ? referenceSeasonLabelTree(registry,rows) : lock(referenceSeasonFieldTree({registry,state})),
  ]);
}

/**
 * Khung dựng sẵn của `mount` để nhận lại tại chỗ: đầu mục và `.reference-browser` có đủ thanh công cụ, sidebar lọc và danh sách mang
 * `data-ssr-signature` (Đội chuẩn còn phải có ô chọn mùa). HTML thiếu phần nào (chỉ có danh sách) thì trả `null` để dựng mới.
 */
function prerenderedShell(mount,family) {
  const head=mount.querySelector(':scope > .reference-head');
  const shell=mount.querySelector(':scope > .reference-browser');
  const body=shell?.querySelector(':scope > .reference-results > .reference-results-body');
  const parts=[
    shell?.querySelector(':scope > .reference-results > .reference-toolbar'),
    shell?.querySelector(':scope > .reference-results > aside.reference-filters'),
    body?.querySelector(':scope > .reference-view[data-ssr-signature]'),
    family==='other' ? head : head?.querySelector('label.reference-season-field'),
  ];
  return parts.every(Boolean) ? {head,shell} : null;
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
  /** Khóa `data-reference-key` của một mục: thẻ team Đội khác mang khóa của phương án đại diện. */
  const itemKey=item=>referenceRowKey(other ? item.displayRecord : item);
  // Kho của người xem (chỉ Đội chuẩn): `undefined` = chưa biết, `null` = máy chưa có kho, hàm = mùa → độ phủ kho
  // (`buildListCoverage`). `coverage` là độ phủ của mùa đang xem; `null` khi không gắn badge được.
  let rosterSource, coverage=null, updated=false;
  // Trạng thái mở/đóng vừa khôi phục khi quay lại từ trang chi tiết; dùng lại nếu kho tới sau và làm danh sách dựng lại.
  let restoredDisclosures=null;
  const openFacets=new Set();
  const title=referenceSectionTitle(family);
  // Khung dựng bằng đúng các cây mà bản dựng sẵn dùng (`referenceHeadTree`, `referenceShellTree`). Cây không mang sự kiện nên sự kiện
  // gắn bằng delegation ở dưới. Trạng thái đầu là mặc định: `update()` vẽ lại ngay trong cùng task nên chưa có gì kịp hiện.
  const freshHead=treeToDom(referenceHeadTree({title,family,registry,state,rows:[]}));
  const freshShell=treeToDom(referenceShellTree({
    mountId:mount.id,title,family,state,labels:{},openFacets,scopeItems:[],count:0,scopeCount:0,activeCount:0,
    noticeText:'',emptyText:'',emptyHidden:referenceEmptyHidden(0),moreHidden:referenceMoreHidden(shown,0),
    viewTree:t('div',{class:'reference-view'}),
  }));
  // Build đã dựng sẵn khung quanh danh sách: nhận lại tại chỗ, không `mount.replaceChildren`. Giữ nguyên node đầu mục, khung kết quả,
  // thân kết quả và danh sách (người đã tab vào thẻ trước khi boot không mất focus); chỉ thay CON của ô chọn mùa, thanh công cụ và
  // sidebar bằng bản không khoá của cùng cây. Thiếu phần nào của khung dựng sẵn thì dựng mới như trước.
  const adopted=adopt ? prerenderedShell(mount,family) : null;
  const head=adopted?.head ?? freshHead;
  const shell=adopted?.shell ?? freshShell;
  if (adopted) {
    for (const [root,fresh,selector] of [
      [head,freshHead,'label.reference-season-field'],
      [shell,freshShell,':scope > .reference-results > .reference-toolbar'],
      [shell,freshShell,':scope > .reference-results > aside.reference-filters'],
    ]) root.querySelector(selector)?.replaceChildren(...(fresh.querySelector(selector)?.childNodes ?? []));
  }
  const heading=head.querySelector('h1');
  const season=head.querySelector('select');
  const seasonStatus=head.querySelector('.reference-season-status');
  let seasonLabelNode=head.querySelector(':scope > .reference-season-static'), seasonLabelRegistry=null, seasonLabelRows=null;
  const results=shell.querySelector(':scope > .reference-results');
  const toolbar=results.querySelector(':scope > .reference-toolbar');
  const filters=results.querySelector(':scope > .reference-filters');
  const body=results.querySelector(':scope > .reference-results-body');
  const searchInput=toolbar.querySelector('.reference-search-input');
  const toggle=toolbar.querySelector('.filter-collapse-toggle');
  const filterCount=toggle.querySelector('.filter-count');
  const count=toolbar.querySelector('.reference-count');
  const viewButtons=[...toolbar.querySelectorAll('[data-view]')];
  const rosterBar=body.querySelector(':scope > .reference-roster-bar');
  const notice=body.querySelector(':scope > .reference-notice');
  const more=body.querySelector(':scope > .reference-more');
  const empty=body.querySelector(':scope > .reference-empty');
  // Danh sách đầu do build dựng sẵn (`data-ssr-signature`): trình duyệt nhận lại nguyên DOM đó nếu đúng trạng thái đầu.
  const viewSlot=body.querySelector(':scope > .reference-view');
  const prerenderedView=adopt ? mount.querySelector(':scope > .reference-view[data-ssr-signature]') : null;
  if (prerenderedView) viewSlot.replaceWith(prerenderedView);
  const view=prerenderedView || viewSlot;
  // Title/CTA là link thật: chỉ ghi snapshot, không chặn hành vi trình duyệt.
  // Marker ổn định của link chi tiết, không pin path segment của route.
  view.addEventListener('click',event=>{
    const link=event.target.closest?.('a[data-team-detail-link]');
    if (!link) return;
    // Ghi khóa thẻ trước snapshot để khi quay lại, danh sách dựng tới thẻ này và trả focus về nó.
    if (isNativeNavigationClick(event)) openedKey=link.closest('[data-reference-key]')?.dataset.referenceKey || null;
    onNavigate?.(event,link);
  });
  // Sidebar: một `click` cho chip, nút mở/đóng nhóm phụ và "Xóa lọc". Chip nhận diện bằng `data-focus-key` có sẵn (`khóa:giá trị`, tách ở
  // dấu `:` đầu tiên), chỉ nhận khóa facet có thật và giá trị có trong facet của phạm vi hiện tại; giá trị gửi đi lấy từ facet/state, không
  // lấy từ chuỗi DOM. Chip của thanh kho cũng là `.fchip` nhưng nằm ngoài sidebar nên không bao giờ tới đây (nó có handler riêng).
  filters.addEventListener('click',event=>{
    const control=event.target.closest?.('.fchip, .flabel-toggle, .clear-btn');
    if (!control || control.disabled || !filters.contains(control)) return;
    if (control.classList.contains('clear-btn')) {
      onQuery({q:null,faction:null,unit:null,tier:null,subcategory:null,source:null,kho:null});
      // Xóa lọc làm nút này bị vô hiệu và cây lọc dựng lại: trả focus về ô tìm kiếm, không thả về BODY.
      searchInput.focus({preventScroll:true});
      return;
    }
    const focusKey=control.dataset.focusKey || '';
    const split=focusKey.indexOf(':');
    const key=split>0 ? focusKey.slice(0,split) : '';
    const value=focusKey.slice(split+1);
    if (control.classList.contains('flabel-toggle')) {
      if (!SECONDARY_FACETS.includes(key) || value!=='toggle') return;
      if (openFacets.has(key)) openFacets.delete(key); else openFacets.add(key);
      renderFacets(currentScopeRows);
      return;
    }
    if (!PRIMARY_FACETS.includes(key) && !SECONDARY_FACETS.includes(key)) return;
    const entry=facetEntries({scopeItems:currentScopeRows,key,family,state,labels:registry.displayLabels || {}}).find(([candidate])=>candidate===value);
    if (!entry) return;
    const [chosen]=entry;
    const selected=state.filters?.[key] || [];
    trackFilter('facet',`${key}:${chosen}`);
    onQuery({[key]:selected.includes(chosen)?selected.filter(item=>item!==chosen):[...selected,chosen]});
  });
  // Thanh công cụ: `click` cho nút kiểu hiển thị (`data-view`, chỉ nhận giá trị của `VIEW_OPTIONS`) và nút "Bộ lọc" của mobile, `input` cho ô tìm.
  toolbar.addEventListener('click',event=>{
    const control=event.target.closest?.('[data-view], .filter-collapse-toggle');
    if (!control || control.disabled || !toolbar.contains(control)) return;
    if (control===toggle) { setFiltersExpanded(filters.classList.contains('collapsed')); return; }
    const option=VIEW_OPTIONS.find(candidate=>candidate.value===control.dataset.view);
    if (!option) return;
    if (option.value!==currentView()) trackFilter('view',option.value);
    onQuery({view: option.value===TEAM_VIEW_CARDS ? null : option.value});
  });
  toolbar.addEventListener('input',event=>{ if (event.target===searchInput) onQuery({q:searchInput.value || null}); });
  // Ô chọn mùa nằm ở đầu mục (ngoài sidebar và thanh công cụ): gắn `change` trực tiếp.
  season?.addEventListener('change',()=>{trackFilter('season',season.value); onQuery({season:season.value,detail:null,legacyTeam:null,legacyVariant:null},true);});
  // "Xem thêm" nằm trong thân kết quả (ngoài sidebar và thanh công cụ); nút do `renderMore()` dựng lại theo lượt nên bắt ở hàng chứa.
  more.addEventListener('click',event=>{
    const control=event.target.closest?.('.lookup-more');
    if (control && !control.disabled && more.contains(control)) appendNextPage();
  });
  // A5: panel lọc mobile đóng bằng Escape và trả focus về nút "Bộ lọc", như menu thả ở header.
  // Desktop luôn hiện sidebar và nút này bị ẩn (`getClientRects` rỗng) nên Escape không đụng tới.
  results.addEventListener('keydown',event=>{
    if (event.key !== 'Escape') return;
    if (filters.classList.contains('collapsed') || !toggle.getClientRects().length) return;
    event.preventDefault();
    setFiltersExpanded(false);
    toggle.focus({preventScroll:true});
  });
  if (!adopted) mount.replaceChildren(head,shell);

  /** Mở/đóng panel lọc mobile; desktop luôn hiện sidebar nên class này vô hại. */
  function setFiltersExpanded(expanded) {
    const open=expanded === true;
    // Dấu `data-ssr-filters-open` của script bảo vệ chỉ giữ panel mở tới lúc client tự quyết định.
    delete mount.dataset.ssrFiltersOpen;
    filters.classList.toggle('collapsed',!open);
    toggle.setAttribute('aria-expanded',String(open));
  }

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
    const selected=seasonSelection(registry,state);
    // Cùng cây option với bản dựng sẵn (kể cả `selected`); thay `option` tại chỗ để `select` (focus, sự kiện `change`) giữ nguyên.
    season.replaceChildren(...referenceSeasonOptionTrees({registry,selected}).map(tree=>treeToDom(tree)));
    seasonStatus.hidden=selected!==registry.defaultSourceSeasonId;
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
      rosterControlNodes({filter:state.rosterFilter,sort:state.rosterSort,summary:narrowingCount(state) ? null : coverage.summary,onChange:change=>{trackRosterChange(change); onQuery(change);}}),
    );
    rosterBar.dataset.state='ready';
    if (focused) rosterBar.querySelector(`[data-focus-key="${CSS.escape(focused)}"]`)?.focus({preventScroll:true});
  }

  /** Dựng lại sidebar nhưng giữ focus theo `data-focus-key` để lọc bằng bàn phím không bị mất chỗ. */
  function replaceFilterNodes(children) {
    const focused=filters.contains(document.activeElement) ? document.activeElement.dataset.focusKey : null;
    filters.replaceChildren(...children);
    if (focused) filters.querySelector(`[data-focus-key="${CSS.escape(focused)}"]`)?.focus({preventScroll:true});
  }

  function renderFacets(scopeRows) {
    const active=activeFilterCount(state,Boolean(coverage));
    filterCount.textContent=String(active);
    filterCount.hidden=active===0;
    replaceFilterNodes(referenceFiltersChildrenTree({
      mountId:mount.id,scopeItems:scopeRows,state,labels:registry.displayLabels || {},family,openFacets,activeCount:active,
    }).map(tree=>treeToDom(tree)));
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
    empty.hidden=referenceEmptyHidden(filteredRows.length);
  }

  /** Hàng "Xem thêm" khi còn đội chưa hiện (cùng mẫu với Tra cứu); sự kiện bắt ở hàng chứa (`more.addEventListener`). */
  function renderMore() {
    more.replaceChildren();
    more.hidden=referenceMoreHidden(shown,filteredRows.length);
    if (more.hidden) return;
    more.append(...referenceMoreTrees().map(tree=>treeToDom(tree)));
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
    count.replaceChildren(...referenceCountTrees({count:filtered.length,scopeCount:scopeRows.length}).map(tree=>treeToDom(tree)));
    const {noticeText,emptyText:nextEmptyText}=referenceListTexts({family,state,registry,scopeCount:scopeRows.length});
    notice.textContent=noticeText;
    notice.hidden=referenceNoticeHidden(noticeText);
    updateViewButtons();
    filteredRows=filtered;
    viewLabels=labels;
    emptyText=nextEmptyText;
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
