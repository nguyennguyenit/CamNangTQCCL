// Ba mục danh sách: Cùng Tồn (chọn mùa + phiên bản), Đội chuẩn và Đội khác (sidebar lọc,
// chế độ Thẻ / Thẻ gọn / Bảng). Trên điện thoại, vùng nhóm lọc thu gọn sau nút "Bộ lọc".

import { el, FACTION_CODE, coexistGroupLabel, seasonCoexistGroup, sourceLabel } from './render.js';
import { L, currentLocale } from './i18n.js';

/** Khóa nhận diện nhóm: `recordId` khi có, ngược lại số thứ tự 1-based trong danh sách nhận được. */
function coexistGroupKey(group, index) {
  return group.recordId ? String(group.recordId) : String(index + 1);
}

/**
 * Mục Cùng Tồn: đầu mục như Đội chuẩn (ô chọn mùa bên phải; URL `scenario` sở hữu lựa chọn, đổi mùa gọi
 * `onScenario(id)`), một hàng nút phiên bản Cùng tồn 1–5 của mùa đó, rồi lưới thẻ đội của phiên bản đang xem.
 * Tập phiên bản đúng bằng tập `update(groups)` nhận, không lọc thêm ngoài phép chiếu phạm vi.
 * `onGroup(key | null)` được gọi khi URL phải đổi: chọn phiên bản mới, hoặc bỏ `group` cũ không còn hợp lệ.
 */
export function createSeasonCoexistSection({mount, scenarioLabel = () => '', onGroup, onScenario} = {}) {
  const title = el('h1', {class: 'reference-title', tabindex: '-1'}, L('Cùng Tồn', '共存阵容'));
  const season = el('select', {'aria-label': L('Mùa', '赛季')});
  const seasonStatus = el('span', {class: 'reference-season-status', hidden: ''}, L('Mới nhất', '最新'));
  const seasonField = el('label', {class: 'reference-season-field', hidden: ''}, [
    el('span', {class: 'reference-season-label'}, L('Mùa', '赛季')),
    seasonStatus,
    season,
    icon(chevron(), {size: 16}),
  ]);
  season.addEventListener('change', () => {
    if (season.value !== selectedScenario && typeof onScenario === 'function') onScenario(season.value);
  });
  const head = el('header', {class: 'reference-head coexist-head'}, [
    el('div', {class: 'reference-head-text'}, [
      el('span', {class: 'reference-kicker'}, L('Đội hình', '阵容')),
      title,
      el('p', {class: 'reference-lead'}, L('Năm đội dùng được cùng lúc trong một tài khoản, 15 tướng không trùng nhau. Chọn mùa rồi chọn phiên bản để tham khảo.', '同一账号可同时使用的五支队伍，15 名武将互不重复。先选赛季，再选版本参考。')),
    ]),
    seasonField,
  ]);
  const versionRow = el('div', {class: 'coexist-group-row', role: 'group', 'aria-label': L('Chọn phiên bản Cùng Tồn', '选择共存版本')});
  const chooser = el('div', {class: 'coexist-groups'}, [
    el('span', {class: 'coexist-groups-label', 'aria-hidden': 'true'}, L('Phiên bản', '版本')),
    versionRow,
  ]);
  const groupView = el('div', {class: 'coexist-group-view'});
  const empty = el('p', {class: 'empty'}, L('Không có nhóm Cùng Tồn trong mùa này.', '本赛季暂无共存阵容分组。'));
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
    const selected = items.find((item) => item.key === selectedKey) || null;
    groupView.replaceChildren(...(selected ? [seasonCoexistGroup(selected.group, {teamCard: coexistTeamCard})] : []));
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

import { SOURCE_TIER_ORDER, sourceTierLabel, legacyLabelZh, projectRecommendedRows, referenceFacetValues } from './recommended-reference-state.js';
import { coexistTeamCard, recommendedTeamCard, recommendedTeamTable, recommendedTeamTableRow, referenceRowKey } from './recommended-reference-render.js';
import { icon, svgNode } from './render.js';
import { TEAM_VIEW_CARDS, TEAM_VIEW_GRID, TEAM_VIEW_TABLE, canonicalTeamView } from './team-view.js';
import { isNativeNavigationClick } from './team-detail-navigation.js';

/** Danh sách dài dựng theo lượt: dựng cả 1366 thẻ một lần làm trang đứng vài giây trên máy chậm. */
const PAGE_SIZE=60;

// Nhóm chính Loại binh → Phe → Tier; Nhóm/Bộ đội hình thu gọn trong accordion.
const PRIMARY_FACETS=['unit','faction','tier'];
// Mùa đang diễn ra, đối chiếu ngày 2026-09-27; độc lập mùa đang xem.
const CURRENT_SOURCE_SEASON_ID='og-兵演春秋';
const SECONDARY_FACETS=['subcategory','source'];
const FACET_LABEL={unit:'Loại binh',faction:'Phe',tier:'Tier',subcategory:'Nhóm',source:'Bộ đội hình'};
const FACET_LABEL_ZH={tier:'等级',unit:'兵种',faction:'阵营',subcategory:'分组',source:'阵容合集'};
const facetLabel=key=>L(FACET_LABEL[key],FACET_LABEL_ZH[key]);

/** Ba kiểu hiển thị: Thẻ (mặc định, không ghi URL), Thẻ gọn (lưới tối đa 4 cột, `?view=luoi`), Bảng (`?view=bang`). */
const VIEW_OPTIONS=[
  {value:TEAM_VIEW_CARDS,label:'Thẻ',aria:'Xem dạng thẻ',labelZh:'卡片',ariaZh:'以卡片显示',icon:()=>[
    svgNode('rect',{x:3,y:3,width:7.5,height:18,rx:1.5}),
    svgNode('rect',{x:13.5,y:3,width:7.5,height:18,rx:1.5}),
  ]},
  {value:TEAM_VIEW_GRID,label:'Thẻ gọn',aria:'Xem dạng thẻ gọn',labelZh:'紧凑卡片',ariaZh:'以紧凑卡片显示',icon:()=>[
    svgNode('rect',{x:3,y:3,width:7.5,height:7.5,rx:1.5}),svgNode('rect',{x:13.5,y:3,width:7.5,height:7.5,rx:1.5}),
    svgNode('rect',{x:3,y:13.5,width:7.5,height:7.5,rx:1.5}),svgNode('rect',{x:13.5,y:13.5,width:7.5,height:7.5,rx:1.5}),
  ]},
  {value:TEAM_VIEW_TABLE,label:'Bảng',aria:'Xem dạng bảng',labelZh:'表格',ariaZh:'以表格显示',icon:()=>[
    svgNode('line',{x1:3,y1:6,x2:21,y2:6}),svgNode('line',{x1:3,y1:12,x2:21,y2:12}),svgNode('line',{x1:3,y1:18,x2:21,y2:18}),
  ]},
];

// Hàm sinh node mới mỗi lần gọi: một node SVG chỉ gắn được vào một chỗ, dùng chung sẽ bị dời sang ô dựng sau.
const chevron=()=>[svgNode('polyline',{points:'6 9 12 15 18 9'})];
const filterIcon=()=>[svgNode('line',{x1:4,y1:7,x2:20,y2:7}),svgNode('line',{x1:7,y1:12,x2:17,y2:12}),svgNode('line',{x1:10,y1:17,x2:14,y2:17})];

const cjk=/[\u3400-\u9fff\uf900-\ufaff]/u;
const zh=()=>currentLocale()==='zh';
const safeLabel=value=>typeof value === 'string' && value.trim() && !cjk.test(value)
  ? value.trim()
  : 'Nội dung tiếng Việt chưa sẵn sàng';
/** Nhãn một mùa trong ô chọn mùa (Đội chuẩn và công cụ Gợi ý đội dùng chung). */
export const seasonOptionText=item=>{
  const base=zh()
    ? [item.displayCode,item.nameRaw].filter(Boolean).join(' · ') || item.label || item.sourceSeasonId
    : item.displayCode && item.displayNameVi
      ? `${item.displayCode} · ${item.displayNameVi}`
      : safeLabel(item.displayNameVi);
  return `${base}${item.advertisedCountRaw != null ? ` (${item.advertisedCountRaw})` : ''}${item.sourceSeasonId===CURRENT_SOURCE_SEASON_ID ? L(' · Hiện tại',' · 当前') : ''}`;
};
// Bản zh hiện đúng tên mùa nguồn nên không cần chú thích tên dịch.
export const seasonOptionTitle=item=>zh() ? null : [
  item.label && !cjk.test(item.label) ? item.label : null,
  item.translationStatus === 'reference-translation' ? 'Tên dịch tham khảo, không phải tên mùa chính thức' : null,
].filter(Boolean).join(' · ') || null;

/** Shared-style Team chuẩn/Team khác browser: sidebar lọc, thẻ gọn và chế độ Bảng. */
export function createRecommendedSection({mount,title,family,onQuery,hrefFor,onNavigate}) {
  let rows=[], state={query:'',filters:{},view:TEAM_VIEW_CARDS}, registry={seasonOptions:[]}, currentScopeRows=[];
  // Lượt đang hiện chỉ giữ khi danh sách không đổi (cùng mùa, lọc, từ khóa, kiểu hiển thị).
  let filteredRows=[], viewLabels={}, emptyText='', shown=PAGE_SIZE, listKey=null, openedKey=null;
  const openFacets=new Set();
  const heading=el('h1',{class:'reference-title',tabindex:'-1'},title);
  const kicker=el('span',{class:'reference-kicker'},L('Đội hình','阵容'));
  const intro=el('p',{class:'reference-lead'},family==='other'
    ? L('Các đội có sẵn, đã đối chiếu với đội chuẩn.','现有阵容，已与推荐阵容核对。')
    : L('Đội hình tham khảo, chia theo mùa tương ứng.','参考阵容，按对应赛季分类。'));
  const searchInput=el('input',{type:'search',class:'reference-search-input','aria-label':L(`Tìm ${title}`,`搜索${title}`),placeholder:L('Tìm tướng, chiến pháp, binh thư…','搜索武将、战法、兵书…')});
  const search=el('label',{class:'search reference-search'},[
    icon([svgNode('circle',{cx:11,cy:11,r:7}),svgNode('line',{x1:16.5,y1:16.5,x2:21,y2:21})]),
    searchInput,
  ]);
  const season=el('select',{'aria-label':L('Mùa','赛季')});
  const seasonStatus=el('span',{class:'reference-season-status',hidden:''},L('Đang diễn ra','进行中'));
  const filters=el('aside',{class:'reference-filters collapsed',id:`${mount.id}-filters`,'aria-label':L('Bộ lọc','筛选')});
  const notice=el('p',{class:'scope-note reference-notice',role:'status'});
  const count=el('span',{class:'stats reference-count',role:'status'});
  const view=el('div',{class:'reference-view'});
  const more=el('div',{class:'lookup-more-row reference-more'});
  const empty=el('p',{class:'empty reference-empty'});
  const clear=el('button',{type:'button',class:'clear-btn',onClick:()=>{
    onQuery({q:null,faction:null,unit:null,tier:null,subcategory:null,source:null});
    // Xóa lọc làm nút này bị vô hiệu và cây lọc dựng lại: trả focus về ô tìm kiếm, không thả về BODY.
    searchInput.focus({preventScroll:true});
  }},L('Xóa lọc','清除筛选'));
  const filterCount=el('span',{class:'filter-count','aria-hidden':'true',hidden:''});
  const toggle=el('button',{type:'button',class:'filter-collapse-toggle','aria-controls':filters.id,'aria-expanded':'false'},[
    icon(filterIcon(),{size:18}),
    el('span',{class:'filter-toggle-label'},L('Bộ lọc','筛选')),
    filterCount,
  ]);
  const viewButtons=VIEW_OPTIONS.map(option=>el('button',{
    type:'button',class:`view-btn view-btn-${option.value}`,dataset:{view:option.value},'aria-pressed':'false',
    'aria-label':L(option.aria,option.ariaZh),title:L(option.aria,option.ariaZh),
    onClick:()=>onQuery({view: option.value===TEAM_VIEW_CARDS ? null : option.value}),
  },[icon(option.icon(),{size:16}),el('span',{class:'view-btn-label'},L(option.label,option.labelZh))]));
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
  season.addEventListener('change',()=>onQuery({season:season.value,detail:null,legacyTeam:null,legacyVariant:null},true));
  toggle.addEventListener('click',()=>setFiltersExpanded(filters.classList.contains('collapsed')));
  const results = el('div',{class:'reference-results'},[
    el('div',{class:'reference-toolbar'},[
      search,
      toggle,
      count,
      el('div',{class:'reference-view-toggle',role:'group','aria-label':L('Kiểu hiển thị','显示方式')},viewButtons),
    ]),
    filters,
    el('div',{class:'reference-results-body'},[notice,view,more,empty]),
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
  mount.replaceChildren(
    el('header',{class:'reference-head'},[
      el('div',{class:'reference-head-text'},[kicker,heading,intro]),
      // Chỉ còn một phạm vi (mùa): ô chọn gói trong một khung có nhãn nhỏ phía trên giá trị.
      el('label',{class:'reference-season-field'},[
        el('span',{class:'reference-season-label'},L('Mùa','赛季')),
        seasonStatus,
        season,
        icon(chevron(),{size:16}),
      ]),
    ]),
    el('div',{class:'reference-browser'},results),
  );

  /** Mở/đóng panel lọc mobile; desktop luôn hiện sidebar nên class này vô hại. */
  function setFiltersExpanded(expanded) {
    const open=expanded === true;
    filters.classList.toggle('collapsed',!open);
    toggle.setAttribute('aria-expanded',String(open));
  }

  // Bản zh: giá trị nguồn chữ Hán giữ nguyên, giá trị tiếng Việt của đội cũ đổi sang nhãn chữ Hán.
  const displayLabel=(kind,value)=>zh()
    ? (typeof value === 'string' && cjk.test(value) ? value : legacyLabelZh(kind,value) ?? String(value ?? ''))
    : safeLabel(registry.displayLabels?.[kind]?.[value] || value);

  function renderSeasonOptions() {
    const current=state.season || (family==='other'?'all':registry.defaultSourceSeasonId);
    const options=registry.seasonOptions || [];
    // `all` có ở cả hai trang (link Tra cứu mở `?season=all`); `unknown` chỉ có nghĩa với đội gốc chưa rõ mùa.
    season.replaceChildren(
      el('option',{value:'all'},L('Tất cả','全部')),
      ...(family==='other'?[el('option',{value:'unknown'},L('Chưa rõ mùa','赛季不明'))]:[]),
      ...options.map(item=>el('option',{value:item.sourceSeasonId,title:seasonOptionTitle(item)},seasonOptionText(item))),
    );
    if ([...season.options].some(option=>option.value===current)) season.value=current;
    seasonStatus.hidden=season.value!==CURRENT_SOURCE_SEASON_ID;
  }

  // Facet sắp theo số đếm giảm dần (như artboard), hòa thì theo nhãn hiển thị của ngôn ngữ trang;
  // giá trị đang chọn vẫn có mặt khi phạm vi hiện tại không đếm được nó.
  const facetEntries=(scopeRows,key)=>{
    const counts=new Map();
    for (const row of scopeRows) for (const value of referenceFacetValues(row,key)) counts.set(value,(counts.get(value) || 0)+1);
    for (const value of state.filters?.[key] || []) if (!counts.has(value)) counts.set(value,0);
    const locale=zh() ? 'zh' : 'vi';
    if (key==='tier') return [...counts].sort(([a],[b])=>(SOURCE_TIER_ORDER.indexOf(a)<0?999:SOURCE_TIER_ORDER.indexOf(a))-(SOURCE_TIER_ORDER.indexOf(b)<0?999:SOURCE_TIER_ORDER.indexOf(b)) || a.localeCompare(b));
    return [...counts].sort(([a,countA],[b,countB])=>countB-countA || chipText(key,a).localeCompare(chipText(key,b),locale));
  };
  const chipText=(key,value)=>key==='tier'?sourceTierLabel(value):key==='source'?sourceLabel(value):displayLabel(key,value);

  /** Lọc đang bật = chip đã chọn + từ khóa tìm; dùng cho badge "Bộ lọc" và trạng thái "Xóa lọc". */
  function activeFilterCount() {
    const facets=Object.values(state.filters || {}).reduce((total,values)=>total + (Array.isArray(values) ? values.length : 0),0);
    return facets + (state.query ? 1 : 0);
  }

  const facetChip=(key,selected,value,count)=>{
    // Mã màu phe tra theo nhãn Việt của registry (hoặc giá trị Việt của đội cũ), không theo chữ hiển thị.
    const code=key==='faction' ? FACTION_CODE[registry.displayLabels?.faction?.[value] ?? value] : null;
    return el('button',{
      type:'button',class:`fchip ${key}-chip${code ? ` f-${code}` : ''}${selected.includes(value) ? ' on' : ''}`,'aria-pressed':String(selected.includes(value)),
      title:zh() || chipText(key,value)===value?null:value,dataset:{focusKey:`${key}:${value}`},
      onClick:()=>onQuery({[key]:selected.includes(value)?selected.filter(item=>item!==value):[...selected,value]}),
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
      el('div',{class:'reference-filter-head'},[el('h2',{class:'reference-filter-title'},L('Bộ lọc','筛选')),clear]),
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

  const itemNode=(row,mode)=>mode===TEAM_VIEW_TABLE
    ? recommendedTeamTableRow(row,{hrefFor,labels:viewLabels})
    : recommendedTeamCard(row,{onTag:value=>onQuery({q:value}),href:hrefFor?.(row),labels:viewLabels});

  /** Focus vào link chi tiết của thẻ/hàng; thẻ không có link thì chính thẻ nhận focus. */
  function focusItem(node,options) {
    if (!node) return;
    const link=node.querySelector('a[data-team-detail-link]');
    if (link) { link.focus(options); return; }
    node.tabIndex=-1;
    node.focus(options);
  }

  const renderRows=(items,mode)=>mode===TEAM_VIEW_TABLE
    ? el('div',{class:'reference-table-frame'},recommendedTeamTable(items,{hrefFor,labels:viewLabels}))
    : el('div',{class:mode===TEAM_VIEW_GRID?'team-grid team-grid-dense':'team-grid'},items.map(row=>itemNode(row,mode)));
  const tierOf=row=>row.tierRaw || 'unranked';

  /** Nhóm theo Tier, giữ nguyên thứ tự projector (đã xếp theo Tier nguồn và điểm). */
  function tierGroups(items) {
    const groups=new Map();
    for (const row of items) {
      if (!groups.has(tierOf(row))) groups.set(tierOf(row),[]);
      groups.get(tierOf(row)).push(row);
    }
    return groups;
  }

  /** Một nhóm Tier; số đội của nhóm đếm trên toàn bộ danh sách đã lọc, không chỉ lượt đang hiện. */
  function tierSection(tier,items,index,mode) {
    const label=tier==='unranked' ? L('Chưa xếp hạng','未评级') : sourceTierLabel(tier);
    const headingId=`${mount.id}-tier-heading-${index}`;
    const total=filteredRows.filter(row=>tierOf(row)===tier).length;
    return el('section',{class:'reference-tier-section',dataset:{tier},'aria-labelledby':headingId},[
      el('h2',{class:'reference-tier-heading',id:headingId},[
        el('span',{},label),
        el('span',{class:'reference-tier-count'},L(` · ${total} đội`,` · ${total} 队`)),
      ]),
      renderRows(items,mode),
    ]);
  }

  /** Dựng `shown` đội đầu của danh sách đã lọc; số đếm "N / M đội" vẫn là toàn bộ danh sách. */
  function renderView() {
    const mode=currentView();
    const visible=filteredRows.slice(0,shown);
    if (family==='recommended') {
      view.replaceChildren(...[...tierGroups(visible)].map(([tier,items],index)=>tierSection(tier,items,index,mode)));
    } else view.replaceChildren(renderRows(visible,mode));
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
      el('button',{type:'button',class:'lookup-more',onClick:appendNextPage},L('Xem thêm','查看更多')),
      el('span',{class:'lookup-more-note'},L(`Mỗi lượt hiện ${PAGE_SIZE} đội`,`每次显示 ${PAGE_SIZE} 队`)),
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
      for (const [tier,items] of tierGroups(batch)) {
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
    renderMore();
    focusItem(first);
  }

  function render() {
    if (searchInput.value!==state.query) searchInput.value=state.query || '';
    renderSeasonOptions();
    const labels=registry.displayLabels || {};
    const scopeRows=projectRecommendedRows(rows,{...state,query:'',filters:{}},labels);
    currentScopeRows=scopeRows;
    renderFacets(scopeRows);
    const filtered=projectRecommendedRows(rows,state,labels);
    const key=JSON.stringify([state.season ?? null,state.query || '',state.filters || {},currentView()]);
    if (key!==listKey) { listKey=key; shown=PAGE_SIZE; }
    count.replaceChildren(el('strong',{},String(filtered.length)),L(` / ${scopeRows.length} đội`,` / ${scopeRows.length} 队`));
    // Mùa chưa thu thập đánh dấu trên từng phạm vi của mùa đó; danh sách luôn gộp mọi danh mục.
    const sourceScope=family==='recommended' ? registry.scopes?.find(scope=>scope.sourceSeasonId===state.season && scope.state==='uncollected-season') : null;
    const scopeNotice=sourceScope?L('Mùa này chưa được thu thập.','该赛季尚未收录。'):'';
    notice.textContent=[...(state.notices || []),scopeNotice].filter(Boolean).join(' ');
    notice.hidden=!notice.textContent;
    updateViewButtons();
    filteredRows=filtered;
    viewLabels=labels;
    emptyText=scopeRows.length?L('Không có đội khớp bộ lọc.','没有符合筛选条件的阵容。'):sourceScope?L('Mùa này chưa được thu thập.','该赛季尚未收录。'):family==='other' && state.season==='unknown'?L('Không có đội có thuộc tính chưa rõ trong phạm vi này.','此范围内没有属性不明的阵容。'):L('Mùa này chưa có dữ liệu.','本赛季暂无数据。');
    renderView();
  }
  return {
    update(nextRows,nextState,nextRegistry){rows=nextRows;state=nextState;registry=nextRegistry;render();},
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
      setFiltersExpanded(disclosures.filters);
      // Thẻ đã mở chi tiết nằm sau các lượt đầu: dựng đủ lượt tới nó để focus và mốc cuộn còn đúng chỗ.
      const target=disclosures.target ? filteredRows.findIndex(row=>referenceRowKey(row)===disclosures.target) : -1;
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
    },
  };
}
