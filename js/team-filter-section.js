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
export function createSeasonCoexistSection({mount}) {
  const grid=el('div');
  mount.replaceChildren(el('h2',{},'Cùng Tồn'),grid);
  return {update(groups){
    const applicable=groups.filter(group=>group.classification === 'applicable');
    const references=groups.filter(group=>group.classification === 'scenarioReference');
    const unknown=groups.filter(group=>!group.classification || group.classification === 'unknown');
    grid.replaceChildren(...[[applicable,'Áp dụng theo phiên bản luật'],[references,'Tham khảo kịch bản'],[unknown,'Chưa xác định kịch bản — tham khảo']].filter(([items])=>items.length).map(([items,label])=>el('div',{class:'coexist-scope-group'},[el('h3',{},`${label} (${items.length})`),...items.map(seasonCoexistGroup)])));
    if (!groups.length) grid.append(el('p',{class:'empty'},'Không có nhóm Cùng Tồn trong mùa này.'));
  }};
}

import { projectRecommendedRows, referenceFacetValues, SCORE_UNKNOWN } from './recommended-reference-state.js';
import { recommendedTeamCard } from './recommended-reference-render.js';

// Nhóm chính Loại binh → Điểm → Phe; nhóm phụ vẫn nằm trong vùng Bộ lọc.
const PRIMARY_FACETS=['unit','score','faction'];
const SECONDARY_FACETS=['subcategory','source'];
const FACET_LABEL={unit:'Loại binh',score:'Điểm',faction:'Phe',subcategory:'Nhóm',source:'Nguồn'};
const SCORE_CHIP_LIMIT=8;

/** Shared-style Team chuẩn/Team khác browser; điểm nguồn chỉ lọc, không đổi thứ tự nguồn. */
export function createRecommendedSection({mount,title,family,onQuery,hrefFor,onNavigate}) {
  let rows=[], state={query:'',filters:{}}, registry={seasonOptions:[]}, scoreExpanded=false, currentScopeRows=[];
  const heading=el('h2',{tabindex:'-1'},title);
  const intro=el('p',{class:'section-intro-sub'},family==='other'?'Các đội có sẵn, đã đối chiếu với đội chuẩn.':'Dữ liệu đề xuất của SGSDeck được phân chia theo mùa tương ứng trong nguồn.');
  const search=el('input',{type:'search',class:'search','aria-label':`Tìm ${title}`,placeholder:'Tìm tướng, chiến pháp, binh thư…'});
  const season=el('select',{'aria-label':'Mùa nguồn'});
  const category=el('select',{'aria-label':'Danh mục nguồn'});
  const filters=el('div',{class:'team-filters collapsed',id:`${mount.id}-filters`});
  const notice=el('p',{class:'scope-note',role:'status'});
  const counts=el('p',{class:'stats','aria-live':'polite'});
  const grid=el('div',{class:'season-team-groups'});
  // Title/CTA là link thật: chỉ ghi snapshot, không chặn hành vi trình duyệt.
  // Marker ổn định của link chi tiết, không pin path segment của route.
  grid.addEventListener('click',event=>{
    const link=event.target.closest?.('a[data-team-detail-link]');
    if (link) onNavigate?.(event,link);
  });
  const toggle=el('button',{type:'button',class:'filter-collapse-toggle','aria-controls':filters.id,'aria-expanded':'false'},'Bộ lọc');
  toggle.addEventListener('click',()=>toggle.setAttribute('aria-expanded',String(!filters.classList.toggle('collapsed'))));
  search.addEventListener('input',()=>onQuery({q:search.value || null}));
  season.addEventListener('change',()=>onQuery({season:season.value,detail:null,legacyTeam:null,legacyVariant:null},true));
  category.addEventListener('change',()=>onQuery({category:category.value,detail:null,legacyTeam:null,legacyVariant:null},true));
  const clear=el('button',{type:'button',class:'clear-btn',onClick:()=>onQuery({q:null,faction:null,unit:null,score:null,subcategory:null,source:null})},'Xóa lọc');
  mount.replaceChildren(el('div',{class:'section-intro'},[heading,intro]),el('div',{class:'team-filter-bar'},[
    el('div',{class:'filter-bar'},[search,clear,toggle,counts]),
    el('div',{class:'reference-scope-controls'},[el('label',{},['Mùa',season]),el('label',{},['Danh mục',category])]),
    filters,
  ]),notice,grid);

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

  // Điểm hiển thị giảm dần, chưa có điểm xuống cuối; các facet khác giữ thứ tự chữ.
  const facetEntries=(scopeRows,key)=>{
    const counts=new Map();
    for (const row of scopeRows) for (const value of referenceFacetValues(row,key)) counts.set(value,(counts.get(value) || 0)+1);
    for (const value of state.filters?.[key] || []) if (!counts.has(value)) counts.set(value,0);
    const entries=[...counts];
    return key==='score'
      ? entries.sort(([a],[b])=>a===SCORE_UNKNOWN?1:b===SCORE_UNKNOWN?-1:Number(b)-Number(a))
      : entries.sort(([a],[b])=>a.localeCompare(b));
  };
  const chipText=(key,value)=>key==='source'?(SOURCE_LABEL[value] || value):key==='score'?(value===SCORE_UNKNOWN?'Chưa có điểm nguồn':value):displayLabel(key,value);

  function facetGroup(key,entries) {
    const selected=state.filters?.[key] || [];
    const chip=([value,count])=>{
      const factionCode=key==='faction' ? FACTION_CODE[displayLabel(key,value)] : null;
      return el('button',{
        type:'button',class:`fchip${factionCode?` f-${factionCode}`:''}${selected.includes(value)?' on':''}`,'aria-pressed':String(selected.includes(value)),
        title:key==='score' || chipText(key,value)===value?null:value,dataset:{focusKey:`${key}:${value}`},
        onClick:()=>onQuery({[key]:selected.includes(value)?selected.filter(item=>item!==value):[...selected,value]}),
      },`${chipText(key,value)} (${count})`);
    };
    const label=el('div',{class:'flabel'},FACET_LABEL[key]);
    if (key!=='score' || entries.length<=SCORE_CHIP_LIMIT) {
      return el('div',{class:`fgroup ${key}-group${SECONDARY_FACETS.includes(key)?' secondary':''}`},[label,el('div',{class:'chip-row'},entries.map(chip))]);
    }
    // Thu gọn chỉ là trình bày: mức đang chọn ngoài 8 mức đầu vẫn hiện và vẫn lọc.
    const visible=scoreExpanded?entries:entries.filter(([value],index)=>index<SCORE_CHIP_LIMIT || selected.includes(value));
    const chipRow=el('div',{class:'chip-row',id:`${mount.id}-score-values`},visible.map(chip));
    return el('div',{class:'fgroup score-group'},[label,chipRow,el('button',{
      type:'button',class:'score-toggle','aria-expanded':String(scoreExpanded),'aria-controls':chipRow.id,
      dataset:{focusKey:'score:toggle'},onClick:()=>{scoreExpanded=!scoreExpanded;renderFacets(currentScopeRows);},
    },scoreExpanded?'Thu gọn':`Xem tất cả mức điểm (${entries.length})`)]);
  }

  function renderFacets(scopeRows) {
    replaceFilterButtons(filters,[...PRIMARY_FACETS,...SECONDARY_FACETS].map(key=>{
      const entries=facetEntries(scopeRows,key);
      return entries.length?facetGroup(key,entries):null;
    }).filter(Boolean));
  }

  function render() {
    if (search.value!==state.query) search.value=state.query || '';
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
    counts.textContent=`${filtered.length} / ${scopeRows.length} đội`;
    const sourceScope=family==='recommended' ? registry.scopes?.find(scope=>scope.sourceSeasonId===state.season && scope.sourceCategoryId===state.category) : null;
    const scopeNotice=sourceScope?.state==='uncollected-season'?'Mùa nguồn chưa được thu thập.':sourceScope?.state==='empty-category'?'Nguồn xác nhận danh mục này hiện không có đội.':'';
    notice.textContent=[...(state.notices || []),scopeNotice].filter(Boolean).join(' ');
    grid.replaceChildren(el('div',{class:'team-grid'},filtered.map(row=>recommendedTeamCard(row,{onTag:value=>onQuery({q:value}),href:hrefFor?.(row),labels}))));
    if (!filtered.length) grid.append(el('p',{class:'empty'},scopeRows.length?'Không có đội khớp bộ lọc.':sourceScope?.state==='uncollected-season'?'Mùa nguồn chưa được thu thập.':sourceScope?.state==='empty-category'?'Nguồn xác nhận danh mục này hiện không có đội.':family==='other' && (state.season==='unknown' || state.category==='unknown')?'Không có đội có thuộc tính nguồn chưa rõ trong phạm vi này.':'Mùa hoặc danh mục này chưa có dữ liệu.'));
  }
  return {
    update(nextRows,nextState,nextRegistry){rows=nextRows;state=nextState;registry=nextRegistry;render();},
    focus(){heading.focus();},
    setSearch(value){onQuery({q:value || null});},
    setFiltersExpanded(expanded){
      const open=expanded === true;
      filters.classList.toggle('collapsed',!open);
      toggle.setAttribute('aria-expanded',String(open));
    },
    getDisclosureState(){
      return {
        filters:filters.classList.contains('collapsed') === false,
        score:scoreExpanded,
        alternatives:[...grid.querySelectorAll('.reference-team-card[data-reference-key] > details.reference-alternatives[open]')]
          .map(details=>details.parentElement.dataset.referenceKey).filter(Boolean).slice(0,12),
      };
    },
    setDisclosureState(disclosures={}){
      this.setFiltersExpanded(disclosures.filters);
      scoreExpanded=disclosures.score === true;
      renderFacets(currentScopeRows);
      const open=new Set(disclosures.alternatives || []);
      for (const card of grid.querySelectorAll('.reference-team-card[data-reference-key]')) {
        const details=card.querySelector(':scope > details.reference-alternatives');
        if (details) details.open=open.has(card.dataset.referenceKey);
      }
    },
  };
}
