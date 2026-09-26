// Section team có bộ lọc inline (chip + combo + search) dùng chung cho cả 3 tab
// Team PK / Đô Úy / Meta cũ — cùng một kiểu. Tự tính facets từ tập team được
// truyền vào nên mỗi tab lọc đúng phạm vi của nó. Trên điện thoại, vùng nhóm lọc
// thu gọn sau nút "Bộ lọc" để tiết kiệm chiều dọc.

import { applyFilters, emptyState } from "./filters.js";
import { el, teamCard } from "./render.js";

/** Đếm distinct + count cho 1 trường, trả mảng {value,count} sort theo count desc. */
export function facetCount(teams, pick) {
  const c = new Map();
  for (const t of teams) {
    for (const v of pick(t)) c.set(v, (c.get(v) || 0) + 1);
  }
  return [...c.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);
}

/**
 * Dựng 1 section team có filter bar inline. Trả về { setSearch } để bên ngoài
 * (soi đội -> mở team) có thể đặt từ khóa tìm cho đúng tab.
 * opts:
 *   mount, teams, tierIndex, intro:{title,sub(count?)}, unitWord, sort, groups
 *   groups[]: { type:"chip", label, key, pick, fmt?, fcls?, sortValues? }
 *           | { type:"recommend", label, key }
 *           | { type:"combo", label, key, pick }
 */
export function createTeamFilterSection(opts) {
  const { mount, teams, tierIndex, intro, unitWord = "đội", sort } = opts;
  const groups = opts.groups.filter(group => group.key !== "stars");
  const state = emptyState();

  const grid = el("div", { class: "team-grid" });
  const stats = el("span", { class: "stats" }, "");
  const search = el("input", { class: "search", type: "search", placeholder: "🔍 Tìm tướng, chiến pháp, binh thư…" });

  // Click tag (tướng/chiến pháp/binh thư/khắc chế) trong card -> lọc ngay trong tab này.
  function onTag(value) {
    search.value = value;
    state.query = value;
    rerender();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function rerender() {
    let filtered = applyFilters(teams, state);
    if (sort) filtered = sort(filtered.slice());
    grid.replaceChildren();
    if (!filtered.length) {
      grid.append(el("p", { class: "empty" }, `Không có ${unitWord} nào khớp bộ lọc.`));
    } else {
      const frag = document.createDocumentFragment();
      for (const t of filtered) frag.append(teamCard(t, onTag, tierIndex?.get(t.id)));
      grid.append(frag);
    }
    stats.textContent = `${filtered.length} / ${teams.length} ${unitWord}`;
  }

  function chipGroup(g) {
    let values = facetCount(teams, g.pick);
    if (g.sortValues) values = values.slice().sort(g.sortValues);
    // Gọn bộ lọc: nhóm chỉ 0–1 giá trị thì không lọc được gì -> ẩn luôn.
    if (values.length < 2) return null;
    const chips = el("div", { class: "chip-row" });
    for (const { value, count } of values) {
      const cls = `fchip${g.fcls ? g.fcls(value) : ""}`;
      const btn = el("button", { class: cls, type: "button" }, `${g.fmt ? g.fmt(value) : value} (${count})`);
      btn.addEventListener("click", () => {
        btn.classList.toggle("on");
        state[g.key].has(value) ? state[g.key].delete(value) : state[g.key].add(value);
        rerender();
      });
      chips.append(btn);
    }
    return el("div", { class: "fgroup" }, [el("div", { class: "flabel" }, g.label), chips]);
  }

  function recommendChip(g) {
    const count = teams.filter((t) => t.recommended).length;
    if (!count) return null;
    const btn = el("button", { class: "fchip recommend", type: "button" }, `${g.label} (${count})`);
    btn.addEventListener("click", () => {
      btn.classList.toggle("on");
      state[g.key].has(true) ? state[g.key].delete(true) : state[g.key].add(true);
      rerender();
    });
    return el("div", { class: "fgroup" }, [el("div", { class: "flabel" }, "Đề cử"), el("div", { class: "chip-row" }, btn)]);
  }

  function comboGroup(g) {
    const values = facetCount(teams, g.pick);
    if (values.length < 2) return null;
    const input = el("input", { class: "combo-input", type: "text", placeholder: `Tìm ${g.label.toLowerCase()}…`, autocomplete: "off" });
    const list = el("div", { class: "combo-list" });
    const selected = el("div", { class: "combo-selected" });
    function renderSelected() {
      selected.replaceChildren();
      for (const v of state[g.key]) {
        const tag = el("button", { class: "sel-tag", type: "button" }, `${v} ✕`);
        tag.addEventListener("click", () => { state[g.key].delete(v); renderSelected(); rerender(); });
        selected.append(tag);
      }
    }
    function renderList(q) {
      list.replaceChildren();
      const nq = q.toLowerCase();
      for (const { value, count } of values.filter((x) => x.value.toLowerCase().includes(nq)).slice(0, 12)) {
        const item = el("button", { class: "combo-item", type: "button" }, `${value} (${count})`);
        item.addEventListener("click", () => { state[g.key].add(value); input.value = ""; list.replaceChildren(); renderSelected(); rerender(); });
        list.append(item);
      }
    }
    input.addEventListener("input", () => renderList(input.value));
    input.addEventListener("focus", () => renderList(input.value));
    input.addEventListener("blur", () => setTimeout(() => list.replaceChildren(), 150));
    return el("div", { class: "fgroup combo" }, [el("div", { class: "flabel" }, g.label), input, list, selected]);
  }

  function buildGroup(g) {
    if (g.type === "chip") return chipGroup(g);
    if (g.type === "recommend") return recommendChip(g);
    if (g.type === "combo") return comboGroup(g);
    return null;
  }

  search.addEventListener("input", (e) => { state.query = e.target.value; rerender(); });
  const clearBtn = el("button", { class: "clear-btn", type: "button" }, "Xóa lọc");

  // Bắt đầu ở trạng thái "collapsed": desktop bỏ qua class này (CSS), mobile thu gọn.
  const filters = el("div", { class: "team-filters collapsed" }, groups.map(buildGroup).filter(Boolean));

  // Nút thu/mở (chỉ hiện trên mobile qua CSS).
  const collapseToggle = el("button", { class: "filter-collapse-toggle", type: "button", "aria-expanded": "false" }, "☰ Bộ lọc");
  collapseToggle.addEventListener("click", () => {
    const open = filters.classList.toggle("collapsed") === false;
    collapseToggle.setAttribute("aria-expanded", String(open));
  });

  clearBtn.addEventListener("click", () => {
    for (const k of Object.keys(state)) if (state[k] instanceof Set) state[k].clear();
    state.query = "";
    search.value = "";
    filters.querySelectorAll(".fchip.on").forEach((b) => b.classList.remove("on"));
    filters.querySelectorAll(".combo-selected").forEach((s) => s.replaceChildren());
    rerender();
  });

  const subText = typeof intro.sub === "function" ? intro.sub(teams.length) : intro.sub;
  mount.replaceChildren(
    el("div", { class: "section-intro" }, [
      el("h2", { class: "section-intro-title" }, intro.title),
      el("p", { class: "section-intro-sub" }, subText),
    ]),
    el("div", { class: "team-filter-bar" }, [
      el("div", { class: "filter-bar" }, [search, clearBtn, collapseToggle, stats]),
      filters,
    ]),
    grid,
  );
  rerender();

  return {
    setSearch(value) {
      search.value = value || "";
      state.query = value || "";
      rerender();
    },
  };
}

import { QUERY_FILTERS, rowFacet, validateTeamFilters, filterSeasonRows } from './season-ui-state.js';
import { FACTION_CODE, SOURCE_LABEL, seasonTeamCard } from './render.js';

function replaceFilterButtons(container, children) {
  const focusedKey = container.contains(document.activeElement) ? document.activeElement.dataset.focusKey : null;
  container.replaceChildren(...children);
  if (focusedKey) [...container.querySelectorAll('[data-focus-key]')].find(button=>button.dataset.focusKey === focusedKey)?.focus({preventScroll:true});
}

/** One stable input surface, with facets and counts rebuilt from the current scope. */
export function createSeasonTeamSection({mount, title, onQuery, onOpenConfig}) {
  let rows = [], queryState;
  const heading = el('h2',{tabindex:'-1'},title);
  const search = el('input',{type:'search',class:'search','aria-label':`Tìm ${title}`,placeholder:'Tìm tướng, chiến pháp, binh thư…'});
  const sort = el('select',{'aria-label':`Sắp xếp ${title}`},[
    el('option',{value:'tier'},'Theo bậc'), el('option',{value:'sgsdeck-score'},'Theo điểm SGSDeck'),
  ]);
  const counts = el('p',{class:'stats','aria-live':'polite'});
  const notice = el('p',{class:'scope-note',role:'status'});
  const filters = el('div',{class:'team-filters collapsed',id:`${mount.id}-filters`});
  const grid = el('div',{class:'season-team-groups'});
  const toggle = el('button',{type:'button',class:'filter-collapse-toggle','aria-controls':filters.id,'aria-expanded':'false'},'Bộ lọc');
  toggle.addEventListener('click',()=>toggle.setAttribute('aria-expanded',String(!filters.classList.toggle('collapsed'))));
  search.addEventListener('input',()=>onQuery({q:search.value}));
  sort.addEventListener('change',()=>onQuery({sort:sort.value}));
  const clear = el('button',{type:'button',class:'clear-btn',onClick:()=>onQuery({q:null,faction:null,unit:null,tier:null,source:null,sort:null,stars:null})},'Xóa lọc');
  mount.replaceChildren(heading,el('div',{class:'team-filter-bar'},[el('div',{class:'filter-bar'},[search,sort,clear,toggle]),filters]),notice,counts,grid);
  function render() {
    const state = validateTeamFilters(rows,queryState);
    if (search.value !== state.query) search.value = state.query;
    sort.value = state.sort;
    notice.textContent = state.notices.join(' ');
    replaceFilterButtons(filters,QUERY_FILTERS.map(key=>{
      const values = [...new Set(rows.flatMap(row=>rowFacet(row,key)))].sort();
      if (!values.length) return null;
      const label = {faction:'Phe',unit:'Loại binh',tier:'Bậc',source:'Nguồn'}[key];
      return el('div',{class:'fgroup'},[el('div',{class:'flabel'},label),el('div',{class:'chip-row'},values.map(value=>{
        const selected = state.filters[key].includes(value);
        return el('button',{type:'button',class:`fchip${selected?' on':''}`,dataset:{focusKey:JSON.stringify([key,value])},'aria-pressed':String(selected),onClick:()=>onQuery({[key]:selected?state.filters[key].filter(v=>v!==value):[...state.filters[key],value]})},`${key === 'source' ? SOURCE_LABEL[value] || value : value === 'untiered' ? 'Chưa xếp hạng' : value} (${rows.filter(row=>rowFacet(row,key).includes(value)).length})`);
      }))]);
    }).filter(Boolean));
    const filtered = filterSeasonRows(rows,state);
    const active = filtered.filter(row=>row.classification === 'applicable').length;
    counts.textContent = `${active} cấu hình áp dụng · ${filtered.length-active} tham khảo / ${rows.length} cấu hình và đội`;
    const groups = new Map();
    for (const row of filtered) {
      const key = row.classification === 'applicable' ? (row.tier || 'Chưa xếp hạng') : row.classification === 'unknown' ? 'Chưa rõ mùa — tham khảo' : 'Tham khảo kịch bản';
      if (!groups.has(key)) groups.set(key,[]);
      groups.get(key).push(row);
    }
    grid.replaceChildren(...[...groups].map(([name,items])=>el('div',{class:'season-tier-group'},[el('h3',{},`${name} (${items.length})`),el('div',{class:'team-grid'},items.map(row=>seasonTeamCard(row,value=>onQuery({q:value}),()=>onOpenConfig(row.configId))))])));
    if (!filtered.length) grid.append(el('p',{class:'empty'},'Không có đội hoặc cấu hình phù hợp trong phạm vi này.'));
  }
  return {
    update(nextRows,nextState) { rows=nextRows;queryState=nextState;render(); },
    setSearch(query) { onQuery({q:query || null}); },
    focus() { heading.focus(); },
  };
}

import { seasonCoexistGroup } from './render.js';

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
 * Mục Cùng Tồn: chọn kịch bản rồi chọn nhóm 1–5 của kịch bản đó; chỉ nhóm đang xem được dựng.
 * Tập kịch bản/nhóm đúng bằng tập `update(groups)` nhận, không lọc thêm ngoài phép chiếu phạm vi.
 * `onGroup(key | null)` được gọi khi URL phải đổi: chọn nhóm mới, hoặc bỏ `group` cũ không còn hợp lệ.
 */
export function createSeasonCoexistSection({mount, scenarioLabel = () => COEXIST_UNKNOWN_LABEL, onGroup} = {}) {
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
  let scenarios = new Map();
  let selectedScenario = COEXIST_UNKNOWN_SCENARIO;
  let selectedKey = '';
  // Nút đang có trong DOM theo nhận diện (scenarioId / khóa nhóm) để bật/tắt `aria-pressed` tại chỗ.
  let scenarioNodes = new Map();
  let groupNodes = new Map();
  // Dòng tóm tắt nhóm đang chọn (mobile) theo từng hàng phạm vi → các nhóm của hàng đó.
  let groupNotes = new Map();

  function scenarioTitle(scenario) {
    return scenario === COEXIST_UNKNOWN_SCENARIO ? COEXIST_UNKNOWN_LABEL : scenarioLabel(scenario) || COEXIST_UNKNOWN_LABEL;
  }

  /**
   * Người dùng bấm/bàn phím chọn một mục: chỉ hàng nhóm được dựng lại khi đổi kịch bản, còn chính nút vừa
   * kích hoạt luôn được giữ nguyên trong DOM nên trình duyệt không mất focus (không gọi `.focus()` ở đây).
   */
  function activate(scenario, key) {
    const scenarioChanged = scenario !== selectedScenario;
    selectedScenario = scenario;
    selectedKey = key;
    if (scenarioChanged) paintGroupRow();
    syncPressed();
    paintGroupView();
    if (typeof onGroup === 'function') onGroup(key);
  }

  function selectScenario(scenario) {
    const items = scenarios.get(scenario) || [];
    if (!items.length) return;
    activate(scenario, items.some((item) => item.key === selectedKey) ? selectedKey : items[0].key);
  }

  function syncPressed() {
    for (const [scenario, button] of scenarioNodes) button.setAttribute('aria-pressed', String(scenario === selectedScenario));
    for (const [key, button] of groupNodes) button.setAttribute('aria-pressed', String(key === selectedKey));
    for (const [note, items] of groupNotes) {
      const text = groupSummary(items.find((item) => item.key === selectedKey));
      note.textContent = text;
      note.hidden = !text;
    }
  }

  function paintScenarioRow() {
    scenarioNodes = new Map();
    scenarioRow.replaceChildren(...[...scenarios].map(([scenario]) => {
      const button = el('button', {
        type: 'button', class: 'coexist-scenario', 'aria-pressed': String(scenario === selectedScenario),
        dataset: { scenario },
        onclick: () => { if (scenario !== selectedScenario) selectScenario(scenario); },
      }, scenarioTitle(scenario));
      scenarioNodes.set(scenario, button);
      return button;
    }));
    scenarioRow.hidden = scenarios.size < 2;
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
    const current = scenarios.get(selectedScenario) || [];
    chooser.replaceChildren(...COEXIST_SCOPES.map(([classification, label]) => {
      const items = current.filter((item) => (item.group.classification || 'unknown') === classification);
      if (!items.length) return null;
      const note = el('p', {class: 'coexist-group-note'});
      groupNotes.set(note, items);
      return el('div', {class: 'coexist-scope-group'}, [
        el('h2', {class: 'coexist-scope-title'}, `${label} (${items.length})`),
        el('div', {class: 'coexist-group-row', role: 'group', 'aria-label': 'Chọn nhóm Cùng Tồn'}, items.map((item, index) => {
          const summary = groupSummary(item);
          const chip = el('button', {
            type: 'button', class: 'coexist-group-chip', 'aria-pressed': String(item.key === selectedKey),
            dataset: { groupKey: item.key },
            onclick: () => activate(item.scenario, item.key),
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
    const current = scenarios.get(selectedScenario) || [];
    const selected = current.find((item) => item.key === selectedKey) || null;
    groupView.replaceChildren(...(selected ? [seasonCoexistGroup(selected.group, {scenarioLabel: scenarioTitle(selected.scenario)})] : []));
  }

  /** Dựng lại toàn bộ hàng chọn (đổi phạm vi mùa, tải trang): không đụng focus của trang. */
  function paint() {
    paintScenarioRow();
    paintGroupRow();
    paintGroupView();
  }

  return {
    update(groups = [], requested = null) {
      scenarios = new Map();
      const next = groups || [];
      next.forEach((group, index) => {
        const scenario = group.scenarioId || COEXIST_UNKNOWN_SCENARIO;
        if (!scenarios.has(scenario)) scenarios.set(scenario, []);
        scenarios.get(scenario).push({group, scenario, key: coexistGroupKey(group, index)});
      });
      // `null` = URL không có `group`; chuỗi bất kỳ (kể cả rỗng) = có yêu cầu, phải kiểm hợp lệ.
      const requestedKey = typeof requested === 'string' ? requested : null;
      let hit = null;
      if (requestedKey) for (const [scenario, items] of scenarios) {
        const match = items.find((item) => item.key === requestedKey);
        if (match) { hit = match; break; }
      }
      if (!hit) hit = scenarios.values().next().value?.[0] || null;
      selectedScenario = hit ? hit.scenario : COEXIST_UNKNOWN_SCENARIO;
      selectedKey = hit ? hit.key : '';
      empty.hidden = next.length > 0;
      paint();
      // Nhóm cũ không còn trong phạm vi mới: về nhóm đầu và bỏ `group` khỏi URL.
      if (requested !== null && requestedKey !== selectedKey && typeof onGroup === 'function') onGroup(null);
    },
    focus() { title.focus(); },
  };
}

import { projectRecommendedRows, referenceFacetValues } from './recommended-reference-state.js';
import { recommendedTeamCard, recommendedTeamTable } from './recommended-reference-render.js';
import { icon, svgNode } from './render.js';
import { TEAM_VIEW_CARDS, TEAM_VIEW_TABLE, canonicalTeamView } from './team-view.js';

// Nhóm chính Loại binh → Phe theo artboard Main; Nhóm/Nguồn thu gọn trong accordion.
const PRIMARY_FACETS=['unit','faction'];
const SECONDARY_FACETS=['subcategory','source'];
const FACET_LABEL={unit:'Loại binh',faction:'Phe',subcategory:'Nhóm',source:'Nguồn'};
const VIEW_LABEL={[TEAM_VIEW_CARDS]:'Thẻ',[TEAM_VIEW_TABLE]:'Bảng'};

const VIEW_ICON=view=>view===TEAM_VIEW_CARDS
  ? [svgNode('rect',{x:3,y:3,width:7.5,height:7.5,rx:1.5}),svgNode('rect',{x:13.5,y:3,width:7.5,height:7.5,rx:1.5}),svgNode('rect',{x:3,y:13.5,width:7.5,height:7.5,rx:1.5}),svgNode('rect',{x:13.5,y:13.5,width:7.5,height:7.5,rx:1.5})]
  : [svgNode('line',{x1:3,y1:6,x2:21,y2:6}),svgNode('line',{x1:3,y1:12,x2:21,y2:12}),svgNode('line',{x1:3,y1:18,x2:21,y2:18})];

const CHEVRON=[svgNode('polyline',{points:'6 9 12 15 18 9'})];
const FILTER_ICON=[svgNode('line',{x1:4,y1:7,x2:20,y2:7}),svgNode('line',{x1:7,y1:12,x2:17,y2:12}),svgNode('line',{x1:10,y1:17,x2:14,y2:17})];

/** Shared-style Team chuẩn/Team khác browser: sidebar lọc, thẻ gọn và chế độ Bảng. */
export function createRecommendedSection({mount,title,family,onQuery,hrefFor,onNavigate}) {
  let rows=[], state={query:'',filters:{},view:TEAM_VIEW_CARDS}, registry={seasonOptions:[]}, currentScopeRows=[];
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
  const category=el('select',{'aria-label':'Danh mục nguồn'});
  const filters=el('aside',{class:'reference-filters collapsed',id:`${mount.id}-filters`,'aria-label':'Bộ lọc'});
  const notice=el('p',{class:'scope-note reference-notice',role:'status'});
  const count=el('span',{class:'stats reference-count',role:'status'});
  const view=el('div',{class:'reference-view'});
  const empty=el('p',{class:'empty reference-empty'});
  const clear=el('button',{type:'button',class:'clear-btn',onClick:()=>{
    onQuery({q:null,faction:null,unit:null,subcategory:null,source:null});
    // Xóa lọc làm nút này bị vô hiệu và cây lọc dựng lại: trả focus về ô tìm kiếm, không thả về BODY.
    searchInput.focus({preventScroll:true});
  }},'Xóa lọc');
  const filterCount=el('span',{class:'filter-count','aria-hidden':'true',hidden:''});
  const toggle=el('button',{type:'button',class:'filter-collapse-toggle','aria-controls':filters.id,'aria-expanded':'false'},[
    icon(FILTER_ICON,{size:18}),
    el('span',{class:'filter-toggle-label'},'Bộ lọc'),
    filterCount,
  ]);
  const viewButtons=[TEAM_VIEW_CARDS,TEAM_VIEW_TABLE].map(value=>el('button',{
    type:'button',class:`view-btn view-btn-${value}`,dataset:{view:value},'aria-pressed':'false',
    'aria-label':value===TEAM_VIEW_CARDS?'Xem dạng thẻ':'Xem dạng bảng',
    onClick:()=>onQuery({view: value===TEAM_VIEW_TABLE ? TEAM_VIEW_TABLE : null}),
  },[icon(VIEW_ICON(value),{size:16}),el('span',{class:'view-btn-label'},VIEW_LABEL[value])]));
  // Title/CTA là link thật: chỉ ghi snapshot, không chặn hành vi trình duyệt.
  // Marker ổn định của link chi tiết, không pin path segment của route.
  view.addEventListener('click',event=>{
    const link=event.target.closest?.('a[data-team-detail-link]');
    if (link) onNavigate?.(event,link);
  });
  searchInput.addEventListener('input',()=>onQuery({q:searchInput.value || null}));
  season.addEventListener('change',()=>onQuery({season:season.value,detail:null,legacyTeam:null,legacyVariant:null},true));
  category.addEventListener('change',()=>onQuery({category:category.value,detail:null,legacyTeam:null,legacyVariant:null},true));
  toggle.addEventListener('click',()=>setFiltersExpanded(filters.classList.contains('collapsed')));
  const results = el('div',{class:'reference-results'},[
    el('div',{class:'reference-toolbar'},[
      search,
      toggle,
      count,
      el('div',{class:'reference-view-toggle',role:'group','aria-label':'Kiểu hiển thị'},viewButtons),
    ]),
    filters,
    el('div',{class:'reference-results-body'},[notice,view,empty]),
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
      el('div',{class:'reference-scope-controls'},[
        el('label',{class:'flabel'},['Mùa nguồn',season]),
        el('label',{class:'flabel'},['Danh mục',category]),
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
    season.replaceChildren(
      ...(family==='other'?[el('option',{value:'all'},'Tất cả'),el('option',{value:'unknown'},'Chưa rõ mùa')]:[]),
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
      }},[FACET_LABEL[key],icon(CHEVRON,{size:16})])
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

  function updateViewButtons() {
    const table=canonicalTeamView(state.view)===TEAM_VIEW_TABLE;
    for (const button of viewButtons) {
      const on=(button.dataset.view===TEAM_VIEW_TABLE)===table;
      button.setAttribute('aria-pressed',String(on));
      button.classList.toggle('on',on);
    }
  }

  function renderView(filtered,labels,sourceScope) {
    view.replaceChildren(canonicalTeamView(state.view)===TEAM_VIEW_TABLE
      ? el('div',{class:'reference-table-frame'},recommendedTeamTable(filtered,{hrefFor,labels}))
      : el('div',{class:'team-grid'},filtered.map(row=>recommendedTeamCard(row,{onTag:value=>onQuery({q:value}),href:hrefFor?.(row),labels}))));
    empty.textContent=currentScopeRows.length?'Không có đội khớp bộ lọc.':sourceScope?.state==='uncollected-season'?'Mùa nguồn chưa được thu thập.':sourceScope?.state==='empty-category'?'Nguồn xác nhận danh mục này hiện không có đội.':family==='other' && (state.season==='unknown' || state.category==='unknown')?'Không có đội có thuộc tính nguồn chưa rõ trong phạm vi này.':'Mùa hoặc danh mục này chưa có dữ liệu.';
    empty.hidden=filtered.length>0;
  }

  function render() {
    if (searchInput.value!==state.query) searchInput.value=state.query || '';
    renderSeasonOptions();
    const categories=family==='other'
      ? ['all','unknown',...new Set(rows.flatMap(row=>row.sourceCategoryIds || []))]
      : ['all',...new Set(rows.map(row=>row.sourceCategoryId).filter(Boolean))];
    category.replaceChildren(...categories.map(value=>el('option',{value,title:value==='all'||value==='unknown'||displayLabel('category',value)===value?null:value},value==='all'?'Tất cả danh mục':value==='unknown'?'Chưa rõ danh mục':displayLabel('category',value))));
    category.value=categories.includes(state.category)?state.category:'all';
    const labels=registry.displayLabels || {};
    const scopeRows=projectRecommendedRows(rows,{...state,query:'',filters:{}},labels);
    currentScopeRows=scopeRows;
    renderFacets(scopeRows);
    const filtered=projectRecommendedRows(rows,state,labels);
    count.replaceChildren(el('strong',{},String(filtered.length)),` / ${scopeRows.length} đội`);
    const sourceScope=family==='recommended' ? registry.scopes?.find(scope=>scope.sourceSeasonId===state.season && scope.sourceCategoryId===state.category) : null;
    const scopeNotice=sourceScope?.state==='uncollected-season'?'Mùa nguồn chưa được thu thập.':sourceScope?.state==='empty-category'?'Nguồn xác nhận danh mục này hiện không có đội.':'';
    notice.textContent=[...(state.notices || []),scopeNotice].filter(Boolean).join(' ');
    notice.hidden=!notice.textContent;
    updateViewButtons();
    renderView(filtered,labels,sourceScope);
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
      };
    },
    setDisclosureState(disclosures={}){
      setFiltersExpanded(disclosures.filters);
      const open=new Set(disclosures.alternatives || []);
      for (const card of view.querySelectorAll('.reference-team-card[data-reference-key]')) {
        const details=card.querySelector(':scope > details.reference-alternatives');
        if (details) details.open=open.has(card.dataset.referenceKey);
      }
    },
  };
}
