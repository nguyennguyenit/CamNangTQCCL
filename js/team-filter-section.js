// Ba mục danh sách có bộ lọc: Cùng Tồn (hàng nút kịch bản + nhóm), Đội chuẩn và Đội khác (sidebar lọc,
// chế độ Thẻ / Thẻ gọn / Bảng). Trên điện thoại, vùng nhóm lọc thu gọn sau nút "Bộ lọc".

import { el, FACTION_CODE, SOURCE_LABEL, seasonCoexistGroup } from './render.js';

/** Nhóm không gắn kịch bản (nhánh `unknown`) nằm trong mục riêng này. */
const COEXIST_UNKNOWN_SCENARIO = '';
const COEXIST_UNKNOWN_LABEL = 'Chưa xác định kịch bản';
/** Thứ tự và câu chữ phân loại giữ nguyên như trước redesign. */
const COEXIST_SCOPES = [
  ['applicable', 'Áp dụng theo phiên bản luật'],
  ['scenarioReference', 'Tham khảo kịch bản'],
  ['unknown', 'Chưa xác định kịch bản — tham khảo'],
];

/** Khóa nhận diện nhóm: `recordId` khi có, ngược lại số thứ tự 1-based trong danh sách nhận được. */
function coexistGroupKey(group, index) {
  return group.recordId ? String(group.recordId) : String(index + 1);
}

/**
 * Mục Cùng Tồn: hàng nút kịch bản là điều khiển phạm vi duy nhất của trang (URL `scenario` sở hữu lựa chọn,
 * bấm nút gọi `onScenario(id)`), rồi chọn nhóm 1–5 trong phép chiếu của kịch bản đó; chỉ nhóm đang xem được dựng.
 * Tập nhóm đúng bằng tập `update(groups)` nhận, không lọc thêm ngoài phép chiếu phạm vi.
 * `onGroup(key | null)` được gọi khi URL phải đổi: chọn nhóm mới, hoặc bỏ `group` cũ không còn hợp lệ.
 */
export function createSeasonCoexistSection({mount, scenarioLabel = () => COEXIST_UNKNOWN_LABEL, onGroup, onScenario} = {}) {
  const title = el('h1', {class: 'reference-title', tabindex: '-1'}, 'Cùng Tồn');
  const head = el('header', {class: 'coexist-head'}, [
    el('div', {class: 'reference-head-text'}, [
      el('span', {class: 'reference-kicker'}, 'Đội hình'),
      title,
      el('p', {class: 'reference-lead'}, 'Năm đội dùng được cùng lúc trong một tài khoản. Mỗi nhóm là một tổ hợp 15 tướng không trùng nhau.'),
    ]),
  ]);
  const scenarioRow = el('div', {class: 'coexist-scenarios', role: 'group', 'aria-label': 'Chọn kịch bản'});
  const chooser = el('div', {class: 'coexist-groups'});
  const groupView = el('div', {class: 'coexist-group-view'});
  const empty = el('p', {class: 'empty'}, 'Không có nhóm Cùng Tồn trong mùa này.');
  mount.replaceChildren(head, scenarioRow, chooser, groupView, empty);
  let items = [];
  let selectedScenario = null;
  let selectedKey = '';
  // Nút đang có trong DOM theo nhận diện (scenarioId / khóa nhóm) để bật/tắt `aria-pressed` tại chỗ.
  let scenarioNodes = new Map();
  let groupNodes = new Map();
  // Dòng tóm tắt nhóm đang chọn (mobile) theo từng hàng phạm vi → các nhóm của hàng đó.
  let groupNotes = new Map();

  function scenarioTitle(scenario) {
    return scenario === COEXIST_UNKNOWN_SCENARIO ? COEXIST_UNKNOWN_LABEL : scenarioLabel(scenario) || COEXIST_UNKNOWN_LABEL;
  }

  /** Chọn nhóm: chip vừa kích hoạt được giữ nguyên trong DOM nên trình duyệt không mất focus. */
  function activate(key) {
    selectedKey = key;
    syncPressed();
    paintGroupView();
    if (typeof onGroup === 'function') onGroup(key);
  }

  function syncPressed() {
    for (const [scenario, button] of scenarioNodes) button.setAttribute('aria-pressed', String(scenario === selectedScenario));
    for (const [key, button] of groupNodes) button.setAttribute('aria-pressed', String(key === selectedKey));
    for (const [note, rowItems] of groupNotes) {
      const text = groupSummary(rowItems.find((item) => item.key === selectedKey));
      note.textContent = text;
      note.hidden = !text;
    }
  }

  /**
   * Nút kịch bản theo thứ tự registry. Tập nút không đổi thì giữ nguyên node (chỉ đổi `aria-pressed`) để nút
   * vừa bấm bằng bàn phím vẫn giữ focus sau khi URL đổi và mục dựng lại nhóm.
   */
  function paintScenarioRow(scenarioIds) {
    const unchanged = scenarioIds.length === scenarioNodes.size && [...scenarioNodes.keys()].every((id, index) => id === scenarioIds[index]);
    if (!unchanged) {
      scenarioNodes = new Map();
      scenarioRow.replaceChildren(...scenarioIds.map((scenario) => {
        const button = el('button', {
          type: 'button', class: 'coexist-scenario', 'aria-pressed': String(scenario === selectedScenario),
          dataset: { scenario },
          onclick: () => { if (scenario !== selectedScenario && typeof onScenario === 'function') onScenario(scenario); },
        }, scenarioTitle(scenario));
        scenarioNodes.set(scenario, button);
        return button;
      }));
    }
    scenarioRow.hidden = scenarioIds.length < 2;
  }

  /** Tóm tắt đội của nguồn cho một nhóm (cùng chuỗi hiện trong chip). */
  function groupSummary(item) {
    return item?.group.content?.summaryRaw || item?.group.content?.summary || '';
  }

  /**
   * Desktop: chip nhóm kèm tóm tắt. Mobile (artboard CoexistMobile): một hàng nút số 44px, tóm tắt của
   * nhóm đang chọn hiện ở dòng ngay dưới hàng (`coexist-group-note`); nhãn nhóm vẫn là tên truy cập của nút.
   */
  function paintGroupRow() {
    groupNodes = new Map();
    groupNotes = new Map();
    chooser.replaceChildren(...COEXIST_SCOPES.map(([classification, label]) => {
      const rowItems = items.filter((item) => (item.group.classification || 'unknown') === classification);
      if (!rowItems.length) return null;
      const note = el('p', {class: 'coexist-group-note'});
      groupNotes.set(note, rowItems);
      return el('div', {class: 'coexist-scope-group'}, [
        el('h2', {class: 'coexist-scope-title'}, `${label} (${rowItems.length})`),
        el('div', {class: 'coexist-group-row', role: 'group', 'aria-label': 'Chọn nhóm Cùng Tồn'}, rowItems.map((item, index) => {
          const summary = groupSummary(item);
          const chip = el('button', {
            type: 'button', class: 'coexist-group-chip', 'aria-pressed': String(item.key === selectedKey),
            dataset: { groupKey: item.key },
            onclick: () => activate(item.key),
          }, [
            el('span', {class: 'coexist-chip-number', 'aria-hidden': 'true'}, String(index + 1)),
            el('span', {class: 'coexist-chip-label'}, item.group.content?.groupLabel || item.group.groupLabel || 'Nhóm'),
            summary ? el('span', {class: 'coexist-chip-note'}, summary) : null,
          ].filter(Boolean));
          groupNodes.set(item.key, chip);
          return chip;
        })),
        note,
      ]);
    }).filter(Boolean));
    syncPressed();
  }

  function paintGroupView() {
    const selected = items.find((item) => item.key === selectedKey) || null;
    groupView.replaceChildren(...(selected ? [seasonCoexistGroup(selected.group, {scenarioLabel: scenarioTitle(selected.scenario)})] : []));
  }

  return {
    /**
     * `groups`: phép chiếu của phạm vi đang chọn; `requested`: `group` của URL (`null` = không có);
     * `scenarios`: id kịch bản đã review theo thứ tự registry; `selected`: kịch bản của URL (hoặc `null`).
     */
    update(groups = [], requested = null, {scenarios = [], selected = null} = {}) {
      items = (groups || []).map((group, index) => ({group, scenario: group.scenarioId || COEXIST_UNKNOWN_SCENARIO, key: coexistGroupKey(group, index)}));
      selectedScenario = selected;
      // `null` = URL không có `group`; chuỗi bất kỳ (kể cả rỗng) = có yêu cầu, phải kiểm hợp lệ.
      const requestedKey = typeof requested === 'string' ? requested : null;
      const hit = (requestedKey && items.find((item) => item.key === requestedKey)) || items[0] || null;
      selectedKey = hit ? hit.key : '';
      empty.hidden = items.length > 0;
      paintScenarioRow(scenarios);
      paintGroupRow();
      paintGroupView();
      // Nhóm cũ không còn trong phạm vi mới: về nhóm đầu và bỏ `group` khỏi URL.
      if (requested !== null && requestedKey !== selectedKey && typeof onGroup === 'function') onGroup(null);
    },
    focus() { title.focus(); },
  };
}

import { projectRecommendedRows, referenceFacetValues } from './recommended-reference-state.js';
import { recommendedTeamCard, recommendedTeamTable, recommendedTeamTableRow, referenceRowKey } from './recommended-reference-render.js';
import { icon, svgNode } from './render.js';
import { TEAM_VIEW_CARDS, TEAM_VIEW_GRID, TEAM_VIEW_TABLE, canonicalTeamView } from './team-view.js';
import { isNativeNavigationClick } from './team-detail-navigation.js';

/** Danh sách dài dựng theo lượt: dựng cả 1366 thẻ một lần làm trang đứng vài giây trên máy chậm. */
const PAGE_SIZE=60;

// Nhóm chính Loại binh → Phe theo artboard Main; Nhóm/Nguồn thu gọn trong accordion.
const PRIMARY_FACETS=['unit','faction'];
const SECONDARY_FACETS=['subcategory','source'];
const FACET_LABEL={unit:'Loại binh',faction:'Phe',subcategory:'Nhóm',source:'Nguồn'};

/** Ba kiểu hiển thị: Thẻ (mặc định, không ghi URL), Thẻ gọn (lưới tối đa 4 cột, `?view=luoi`), Bảng (`?view=bang`). */
const VIEW_OPTIONS=[
  {value:TEAM_VIEW_CARDS,label:'Thẻ',aria:'Xem dạng thẻ',icon:()=>[
    svgNode('rect',{x:3,y:3,width:7.5,height:18,rx:1.5}),
    svgNode('rect',{x:13.5,y:3,width:7.5,height:18,rx:1.5}),
  ]},
  {value:TEAM_VIEW_GRID,label:'Thẻ gọn',aria:'Xem dạng thẻ gọn',icon:()=>[
    svgNode('rect',{x:3,y:3,width:7.5,height:7.5,rx:1.5}),svgNode('rect',{x:13.5,y:3,width:7.5,height:7.5,rx:1.5}),
    svgNode('rect',{x:3,y:13.5,width:7.5,height:7.5,rx:1.5}),svgNode('rect',{x:13.5,y:13.5,width:7.5,height:7.5,rx:1.5}),
  ]},
  {value:TEAM_VIEW_TABLE,label:'Bảng',aria:'Xem dạng bảng',icon:()=>[
    svgNode('line',{x1:3,y1:6,x2:21,y2:6}),svgNode('line',{x1:3,y1:12,x2:21,y2:12}),svgNode('line',{x1:3,y1:18,x2:21,y2:18}),
  ]},
];

// Hàm sinh node mới mỗi lần gọi: một node SVG chỉ gắn được vào một chỗ, dùng chung sẽ bị dời sang ô dựng sau.
const chevron=()=>[svgNode('polyline',{points:'6 9 12 15 18 9'})];
const filterIcon=()=>[svgNode('line',{x1:4,y1:7,x2:20,y2:7}),svgNode('line',{x1:7,y1:12,x2:17,y2:12}),svgNode('line',{x1:10,y1:17,x2:14,y2:17})];

/** Shared-style Team chuẩn/Team khác browser: sidebar lọc, thẻ gọn và chế độ Bảng. */
export function createRecommendedSection({mount,title,family,onQuery,hrefFor,onNavigate}) {
  let rows=[], state={query:'',filters:{},view:TEAM_VIEW_CARDS}, registry={seasonOptions:[]}, currentScopeRows=[];
  // Lượt đang hiện chỉ giữ khi danh sách không đổi (cùng mùa, lọc, từ khóa, kiểu hiển thị).
  let filteredRows=[], viewLabels={}, emptyText='', shown=PAGE_SIZE, listKey=null, openedKey=null;
  const openFacets=new Set();
  const heading=el('h1',{class:'reference-title',tabindex:'-1'},title);
  const kicker=el('span',{class:'reference-kicker'},'Đội hình');
  const intro=el('p',{class:'reference-lead'},family==='other'?'Các đội có sẵn, đã đối chiếu với đội chuẩn.':'Dữ liệu đề xuất của SGSDeck được phân chia theo mùa tương ứng trong nguồn.');
  const searchInput=el('input',{type:'search',class:'reference-search-input','aria-label':`Tìm ${title}`,placeholder:'Tìm tướng, chiến pháp, binh thư…'});
  const search=el('label',{class:'search reference-search'},[
    icon([svgNode('circle',{cx:11,cy:11,r:7}),svgNode('line',{x1:16.5,y1:16.5,x2:21,y2:21})]),
    searchInput,
  ]);
  const season=el('select',{'aria-label':'Mùa nguồn'});
  const filters=el('aside',{class:'reference-filters collapsed',id:`${mount.id}-filters`,'aria-label':'Bộ lọc'});
  const notice=el('p',{class:'scope-note reference-notice',role:'status'});
  const count=el('span',{class:'stats reference-count',role:'status'});
  const view=el('div',{class:'reference-view'});
  const more=el('div',{class:'lookup-more-row reference-more'});
  const empty=el('p',{class:'empty reference-empty'});
  const clear=el('button',{type:'button',class:'clear-btn',onClick:()=>{
    onQuery({q:null,faction:null,unit:null,subcategory:null,source:null});
    // Xóa lọc làm nút này bị vô hiệu và cây lọc dựng lại: trả focus về ô tìm kiếm, không thả về BODY.
    searchInput.focus({preventScroll:true});
  }},'Xóa lọc');
  const filterCount=el('span',{class:'filter-count','aria-hidden':'true',hidden:''});
  const toggle=el('button',{type:'button',class:'filter-collapse-toggle','aria-controls':filters.id,'aria-expanded':'false'},[
    icon(filterIcon(),{size:18}),
    el('span',{class:'filter-toggle-label'},'Bộ lọc'),
    filterCount,
  ]);
  const viewButtons=VIEW_OPTIONS.map(option=>el('button',{
    type:'button',class:`view-btn view-btn-${option.value}`,dataset:{view:option.value},'aria-pressed':'false',
    'aria-label':option.aria,title:option.aria,
    onClick:()=>onQuery({view: option.value===TEAM_VIEW_CARDS ? null : option.value}),
  },[icon(option.icon(),{size:16}),el('span',{class:'view-btn-label'},option.label)]));
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
      el('div',{class:'reference-view-toggle',role:'group','aria-label':'Kiểu hiển thị'},viewButtons),
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
      // Chỉ còn một phạm vi (mùa nguồn): ô chọn gói trong một khung có nhãn nhỏ phía trên giá trị.
      el('label',{class:'reference-season-field'},[
        el('span',{class:'reference-season-label'},'Mùa nguồn'),
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

  const cjk=/[\u3400-\u9fff\uf900-\ufaff]/u;
  const safeLabel=value=>typeof value === 'string' && value.trim() && !cjk.test(value)
    ? value.trim()
    : 'Nội dung tiếng Việt chưa sẵn sàng';
  const displayLabel=(kind,value)=>safeLabel(registry.displayLabels?.[kind]?.[value] || value);
  const seasonOptionText=item=>{
    const base=item.displayCode && item.displayNameVi
      ? `${item.displayCode} · ${item.displayNameVi}`
      : safeLabel(item.displayNameVi);
    return `${base}${item.advertisedCountRaw != null ? ` (${item.advertisedCountRaw})` : ''}`;
  };
  const seasonOptionTitle=item=>[
    item.label && !cjk.test(item.label) ? item.label : null,
    item.translationStatus === 'reference-translation' ? 'Tên dịch tham khảo, không phải tên mùa chính thức' : null,
  ].filter(Boolean).join(' · ') || null;


  function renderSeasonOptions() {
    const current=state.season || (family==='other'?'all':registry.defaultSourceSeasonId);
    const options=registry.seasonOptions || [];
    // `all` có ở cả hai trang (link Tra cứu mở `?season=all`); `unknown` chỉ có nghĩa với đội gốc chưa rõ mùa.
    season.replaceChildren(
      el('option',{value:'all'},'Tất cả'),
      ...(family==='other'?[el('option',{value:'unknown'},'Chưa rõ mùa')]:[]),
      ...options.map(item=>el('option',{value:item.sourceSeasonId,title:seasonOptionTitle(item)},seasonOptionText(item))),
    );
    if ([...season.options].some(option=>option.value===current)) season.value=current;
  }

  // Facet sắp theo số đếm giảm dần (như artboard), hòa thì theo nhãn hiển thị tiếng Việt;
  // giá trị đang chọn vẫn có mặt khi phạm vi hiện tại không đếm được nó.
  const facetEntries=(scopeRows,key)=>{
    const counts=new Map();
    for (const row of scopeRows) for (const value of referenceFacetValues(row,key)) counts.set(value,(counts.get(value) || 0)+1);
    for (const value of state.filters?.[key] || []) if (!counts.has(value)) counts.set(value,0);
    return [...counts].sort(([a,countA],[b,countB])=>countB-countA || chipText(key,a).localeCompare(chipText(key,b),'vi'));
  };
  const chipText=(key,value)=>key==='source'?(SOURCE_LABEL[value] || value):displayLabel(key,value);

  /** Lọc đang bật = chip đã chọn + từ khóa tìm; dùng cho badge "Bộ lọc" và trạng thái "Xóa lọc". */
  function activeFilterCount() {
    const facets=Object.values(state.filters || {}).reduce((total,values)=>total + (Array.isArray(values) ? values.length : 0),0);
    return facets + (state.query ? 1 : 0);
  }

  const facetChip=(key,selected,value,count)=>{
    const code=key==='faction' ? FACTION_CODE[displayLabel(key,value)] : null;
    return el('button',{
      type:'button',class:`fchip ${key}-chip${code ? ` f-${code}` : ''}${selected.includes(value) ? ' on' : ''}`,'aria-pressed':String(selected.includes(value)),
      title:chipText(key,value)===value?null:value,dataset:{focusKey:`${key}:${value}`},
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
      }},[FACET_LABEL[key],icon(chevron(),{size:16})])
      : el('div',{class:'flabel'},FACET_LABEL[key]);
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
      el('div',{class:'reference-filter-head'},[el('h2',{class:'reference-filter-title'},'Bộ lọc'),clear]),
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

  /** Dựng `shown` đội đầu của danh sách đã lọc; số đếm "N / M đội" vẫn là toàn bộ danh sách. */
  function renderView() {
    const mode=currentView();
    const visible=filteredRows.slice(0,shown);
    view.replaceChildren(mode===TEAM_VIEW_TABLE
      ? el('div',{class:'reference-table-frame'},recommendedTeamTable(visible,{hrefFor,labels:viewLabels}))
      : el('div',{class:mode===TEAM_VIEW_GRID?'team-grid team-grid-dense':'team-grid'},visible.map(row=>itemNode(row,mode))));
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
      el('button',{type:'button',class:'lookup-more',onClick:appendNextPage},'Xem thêm'),
      el('span',{class:'lookup-more-note'},'Mỗi lượt hiện 60 đội'),
    );
  }

  /** Chỉ nối lượt mới vào cuối lưới/bảng rồi đưa focus tới đội đầu của lượt mới. */
  function appendNextPage() {
    const mode=currentView();
    const nodes=filteredRows.slice(shown,shown+PAGE_SIZE).map(row=>itemNode(row,mode));
    shown+=PAGE_SIZE;
    (view.querySelector('.reference-table tbody') ?? view.firstElementChild).append(...nodes);
    renderMore();
    focusItem(nodes[0]);
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
    count.replaceChildren(el('strong',{},String(filtered.length)),` / ${scopeRows.length} đội`);
    // Mùa chưa thu thập đánh dấu trên từng phạm vi nguồn của mùa đó; danh sách luôn gộp mọi danh mục.
    const sourceScope=family==='recommended' ? registry.scopes?.find(scope=>scope.sourceSeasonId===state.season && scope.state==='uncollected-season') : null;
    const scopeNotice=sourceScope?'Mùa nguồn chưa được thu thập.':'';
    notice.textContent=[...(state.notices || []),scopeNotice].filter(Boolean).join(' ');
    notice.hidden=!notice.textContent;
    updateViewButtons();
    filteredRows=filtered;
    viewLabels=labels;
    emptyText=scopeRows.length?'Không có đội khớp bộ lọc.':sourceScope?'Mùa nguồn chưa được thu thập.':family==='other' && state.season==='unknown'?'Không có đội có thuộc tính nguồn chưa rõ trong phạm vi này.':'Mùa này chưa có dữ liệu.';
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
