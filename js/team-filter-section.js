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
import { SOURCE_LABEL, seasonTeamCard } from './render.js';

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
    el('option',{value:'tier'},'Theo tier'), el('option',{value:'sgsdeck-score'},'Theo điểm SGSDeck'),
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
      const label = {faction:'Phe',unit:'Loại binh',tier:'Tier',source:'Nguồn'}[key];
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
import { normalizeText } from './filters.js';
export function createSeasonCoexistSection({mount,onQuery}) {
  const search=el('input',{type:'search',class:'search','aria-label':'Tìm Cùng Tồn',placeholder:'Tìm đội, tướng, điều kiện nguồn…'});
  const sources=el('div',{class:'chip-row'}), notice=el('p',{class:'scope-note'}), grid=el('div');
  search.addEventListener('input',()=>onQuery({q:search.value}));
  mount.replaceChildren(el('h2',{},'Cùng Tồn'),el('div',{class:'filter-bar'},[search,el('button',{type:'button',class:'clear-btn',onClick:()=>onQuery({q:null,source:null,faction:null,unit:null,tier:null,sort:null,stars:null})},'Xóa lọc')]),sources,notice,grid);
  return {update(groups,state,scopeLabel){
    if (search.value !== state.query) search.value=state.query;
    const sourceId=group=>group.source?.id || 'legacy';
    const available=[...new Set(groups.map(sourceId))];
    const selected=state.filters.source.filter(value=>available.includes(value));
    replaceFilterButtons(sources,available.map(value=>el('button',{type:'button',class:`fchip${selected.includes(value)?' on':''}`,dataset:{focusKey:value},'aria-pressed':String(selected.includes(value)),onClick:()=>onQuery({source:selected.includes(value)?selected.filter(item=>item!==value):[...selected,value]})},value === 'legacy' ? 'Nguồn cũ' : 'Bảng Cùng Tồn')));
    const query=normalizeText(state.query);
    const filtered=groups.filter(group=>(!selected.length || selected.includes(sourceId(group))) && (!query || normalizeText(JSON.stringify(group.content)).includes(query)));
    const applicable=filtered.filter(group=>group.classification === 'applicable');
    const references=filtered.filter(group=>group.classification === 'scenarioReference');
    const unknown=filtered.filter(group=>!group.classification || group.classification === 'unknown');
    notice.textContent=`${scopeLabel} · ${applicable.length} nhóm áp dụng · ${references.length} nhóm tham khảo · ${unknown.length} nhóm chưa rõ mùa / ${groups.length} nhóm` + (selected.length !== state.filters.source.length || ['unit','tier','faction'].some(key=>state.filters[key].length) ? ' · Đã bỏ bộ lọc không có trong dữ liệu nguồn.' : '');
    grid.replaceChildren(...[[applicable,'Áp dụng theo phiên bản luật'],[references,'Tham khảo kịch bản'],[unknown,'Chưa xác định kịch bản — tham khảo']].filter(([items])=>items.length).map(([items,label])=>el('div',{class:'coexist-scope-group'},[el('h3',{},`${label} (${items.length})`),...items.map(seasonCoexistGroup)])));
    if (state.browse?.kind === 'verified-pair' && !applicable.length) grid.prepend(el('p',{class:'scope-note'},'Chưa có bộ Cùng Tồn được xác minh cho phiên bản luật này.'));
    if (!filtered.length) grid.append(el('p',{class:'empty'},'Không có nhóm Cùng Tồn khớp phạm vi và bộ lọc này.'));
  }};
}
