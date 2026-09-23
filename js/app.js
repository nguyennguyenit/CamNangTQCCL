// Điều phối dữ liệu tĩnh, section navigation, theme và hai browser đội theo mùa.

import { seasonConfigDetail, bestTier, el, khaihoangTable } from "./render.js";
import { loadLookupBundle } from "./lookup-data.js";
import { initUnifiedLookup, parseLookupRoute } from "./unified-lookup.js";
import { initAnalyze } from "./analyze.js";
import { initRecruitTracker } from "./recruit-tracker.js";
import { initRosterRecommend } from "./roster-recommend-ui.js";
import { initSiteChrome } from "./site-chrome.js";
import { displayValue, loadWebsiteDisplay, localizeData } from "./website-display.js";

import { loadSeasonModel, readSeasonQuery, updateSeasonURL, defaultSeasonSelection, BUNDLE_NOTICE } from './season-ui-state.js';
import { assignDerivedFactions } from "./derive-team-faction.js";
import { createSeasonCoexistSection, createRecommendedSection } from "./team-filter-section.js";
import { resolveBrowseState, projectSeasonBrowse, resolveSelectionScore } from './season-context.js';
import { loadRecommendedReference, readRecommendedQuery } from './recommended-reference-state.js';
import {
  KHAIHOANG_TEAM_QUERY_KEY,
  KHAIHOANG_VARIANT_QUERY_KEY,
  captureReturnSnapshot,
  isNativeNavigationClick,
  khaiHoangPairFromUrl,
  khaiHoangUrlWithPair,
  matchesReturnSnapshot,
  migrateLegacyReferenceUrl,
  readReturnSnapshot,
  safeKhaiHoangVariants,
  setTeamRouteHandlesFromJSON,
  teamDetailHref,
  writeReturnSnapshot,
} from './team-detail-navigation.js';

let sectionMenu = null;
let onNavigation = () => {};
let onSectionRequest = name => switchSection(name);
let activeSection = 'team-chuan';
let restoringHistory = false;

const $ = (sel) => document.querySelector(sel);

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

// Tier team là tùy chọn: thiếu file không được làm vỡ site (team không tier vẫn render).
async function loadOptionalJSON(path, fallback) {
  try {
    return await loadJSON(path);
  } catch {
    return fallback;
  }
}

/* ---------- Section nav ---------- */
const SECTIONS = ["team-chuan", "team-khac", "coexist", "khaihoang", "lookup", "recruit-tracker", "analyze", "roster-recommend"];
const LEGACY_SECTIONS = {"team-pk":"team-khac","meta-cu":"team-khac"};
function initNav() {
  sectionMenu = initSiteChrome().menu;
  document.querySelectorAll(".nav-tab").forEach((tab) => {
    tab.addEventListener("click", () => onSectionRequest(tab.dataset.section));
  });
  const tabs = [...document.querySelectorAll(".nav-tab")];
  tabs.forEach((tab, index) => tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const offset = event.key === "ArrowRight" ? 1 : -1;
    tabs[(index + offset + tabs.length) % tabs.length].focus();
    onSectionRequest(tabs[(index + offset + tabs.length) % tabs.length].dataset.section);
  }));
  // Deep-link: mở section theo hash (#khaihoang) + đồng bộ khi đổi hash.
  window.addEventListener("hashchange", () => {
    canonicalizeSectionHash();
    const target = sectionFromHash();
    if (restoringHistory) { restoringHistory = false; switchSection(target); }
    else if (activeSection !== target && !history.state?.referenceAlias) onSectionRequest(target,{replace:true});
    else switchSection(target);
  });
  canonicalizeSectionHash();
  switchSection(sectionFromHash());
}
function canonicalizeSectionHash() {
  const hash = location.hash || '';
  const name = hash.slice(1);
  if (!name || SECTIONS.includes(name) || parseLookupRoute(hash)) return;
  const legacy = LEGACY_SECTIONS[name];
  const url = new URL(location.href);
  url.hash = legacy ? `#${legacy}` : '#team-chuan';
  if (legacy) url.searchParams.set('source', name === 'team-pk' ? 'team-intro' : 'moi-phe');
  history.replaceState({...history.state,referenceAlias:legacy ? name : null}, '', url);
}
function sectionFromHash() {
  const hash = location.hash || "";
  const lookup = parseLookupRoute(hash);
  if (lookup) return "lookup";
  const name = hash.replace(/^#/, "");
  return LEGACY_SECTIONS[name] || (SECTIONS.includes(name) ? name : "team-chuan");
}
function placeSeasonControls(name) {
  const controls = $('#season-controls');
  if (!controls) return;
  controls.hidden = !['coexist','analyze','roster-recommend'].includes(name);
  const rulesetControl = $('#season-ruleset-control');
  if (rulesetControl) rulesetControl.hidden = name === 'coexist';
  const summary = $('#season-summary');
  if (summary) summary.hidden = name === 'coexist';
  if (name === 'coexist') {
    const heading = $('#section-coexist > h2');
    if (heading) heading.after(controls);
  } else {
    const detailMount = $('#season-detail-mount');
    if (detailMount) detailMount.before(controls);
  }
}

function switchSection(name) {
  document.querySelectorAll(".nav-tab").forEach((t) => {
    const active = t.dataset.section === name;
    t.classList.toggle("active", active);
    t.setAttribute("aria-selected", String(active));
    t.tabIndex = active ? 0 : -1;
  });
  document.querySelectorAll(".section").forEach((s) => s.classList.toggle("active", s.id === `section-${name}`));
  sectionMenu?.setActive(name);
  placeSeasonControls(name);
  $('.tagline').textContent = name === 'khaihoang' ? 'Khai hoang — dữ liệu mới nhất' : name === 'team-chuan' || name === 'team-khac' ? 'Duyệt đội hình theo mùa nguồn' : 'Tra cứu đội hình theo kịch bản';
  activeSection = name;
  if (sectionFromHash() !== name) location.hash = name === "lookup" ? "lookup" : name;
  onNavigation();
}

async function main() {
  // Bảng route handle phải sẵn sàng trước migrate và mọi lần dựng href.
  setTeamRouteHandlesFromJSON($('#team-route-handles')?.textContent);
  initNav();
  let websiteDisplay = null;
  try {
    const byteRequests = new Map();
    const loadBytes = (name) => {
      const path = name === "website-display.json"
        ? "data/website-display.json"
        : name.startsWith("data/")
          ? name
          : `data/${name.replace(/\\.json$/, "")}.json`;
      if (!byteRequests.has(path)) byteRequests.set(path, fetch(`./${path}`).then(async response => {
        if (!response.ok) throw new Error(`./${path}: ${response.status}`);
        return new Uint8Array(await response.arrayBuffer());
      }));
      return byteRequests.get(path);
    };
    const loadData = name => loadBytes(name).then(bytes => JSON.parse(new TextDecoder().decode(bytes)));
    const recommendedPin = JSON.parse($('#recommended-publication').textContent);
    websiteDisplay = await loadWebsiteDisplay(
      JSON.parse($('#website-display-publication').textContent),
      loadBytes,
      recommendedPin,
    );
    const [teamsSource, coexistSource, khaihoangSource, booksDict] = await Promise.all([
      loadData("teams"),
      loadData("coexist"),
      loadData("khaihoang"),
      loadData("books-dict"),
    ]);
    const teams = localizeData(websiteDisplay, "data/teams.json", teamsSource);
    const coexist = localizeData(websiteDisplay, "data/coexist.json", coexistSource);
    const khaihoang = localizeData(websiteDisplay, "data/khaihoang.json", khaihoangSource);
    // Controller Khai hoang do renderer dựng; app chỉ bơm callback và giữ lựa chọn qua snapshot.
    let khaiHoangUI = null;
    // Inventory của Khai hoang: chỉ ID còn tồn tại mới được ghi vào snapshot phục hồi.
    const khaihoangInventory = new Map(
      (Array.isArray(khaihoang) ? [] : khaihoang.teams || [])
        .map(team => [team.id, new Set((team.variants || []).map(variant => variant.id))]),
    );
    let lookupBundle = null;
    try {
      lookupBundle = await loadLookupBundle(name => loadBytes(name.replace(/\.json$/, "")));
    } catch {
      $("#section-lookup").append(el("p", { class: "error", role: "alert" }, "Dữ liệu Tra cứu hiện không khả dụng. Các mục đội hình vẫn hoạt động."));
    }
    const heroesDict = lookupBundle?.heroes ?? [];
    const tactics = lookupBundle?.tactics ?? [];
    const catalog = lookupBundle?.catalog ?? null;
    const teamTier = await loadOptionalJSON("./data/team-tier.json", []);
    const tierIndex = new Map(teamTier.map((r) => [r.teamId, r.rankings]));

    let seasonModel = null;
    try { seasonModel = await loadSeasonModel(JSON.parse($('#season-artifact-hashes').textContent), loadBytes); } catch { /* Legacy display stays available with an explicit notice. */ }
    let recommendedModel = null;
    try {
      const pin = recommendedPin;
      recommendedModel = await loadRecommendedReference(pin, async path => {
        const response = await fetch(`./data/recommended/${path}`);
        if (!response.ok) throw new Error(`./data/recommended/${path}: ${response.status}`);
        return response.arrayBuffer();
      });
    } catch { /* Recommended views render an isolated unavailable state below. */ }
    // URL tham chiếu cũ đi tiếp bằng identity thật; key config giữ precedence gameplay.
    const migration = migrateLegacyReferenceUrl(location.href, {
      hasRecommended: id => !!recommendedModel?.index.records.some(row => row.sourceConfigId === id),
      hasLegacy: id => teams.some(team => team.id === id),
    });
    if (migration) { location.replace(migration.target); return; }
    let browse = seasonModel ? readSeasonQuery(location.href, seasonModel).browse : null;
    let projection = seasonModel ? projectSeasonBrowse(seasonModel, browse) : null;
    const consumers = [];
    const sections = {};
    let openedConfig = null;
    let configTrigger = null;
    const detailMount = el('div',{id:'season-detail-mount'});
    $('#season-controls').after(detailMount);
    detailMount.addEventListener('keydown',event=>{
      if (event.key !== 'Escape' || !detailMount.querySelector('#season-config-detail')) return;
      event.preventDefault();
      navigateQuery({config:null});
      if (configTrigger?.isConnected) configTrigger.focus(); else sections[sectionFromHash()]?.focus?.();
    });
    function openConfig(configId) {
      configTrigger = document.activeElement;
      navigateQuery({config:configId},true);
      const detail = $('#season-config-detail');
      if (detail) {
        detail.focus({preventScroll:true});
        window.scrollTo({top:window.scrollY + detail.getBoundingClientRect().top - $('.top-header').getBoundingClientRect().height - 12,behavior:'instant'});
      }
    }
    const coexistUI = createSeasonCoexistSection({mount:$('#section-coexist')});
    function queryForSection(name) {
      const state = readSeasonQuery(location.href,seasonModel);
      return sectionFromHash() === name ? state : {...state,query:'',sort:'tier',filters:{faction:[],unit:[],tier:[],source:[]},notices:[]};
    }
    function renderTeams() {
      if (!seasonModel) return;
      const state = readSeasonQuery(location.href,seasonModel);
      const rows = ['applicable','scenarioReference','unknown'].flatMap(classification=>projection[classification].map(row=>{
        const legacyRankings = browse.kind === 'all-reference' && row.configId === null ? tierIndex.get(row.teamId) || [] : [];
        const scenario = seasonModel.data['season-registry'].find(item=>item.id === row.config?.scenarioId);
        const rule = scenario?.rulesets.find(item=>item.id === row.config?.rulesetId);
        const contextLabel = row.configId ? `${scenario?.labelVi || 'Chưa rõ kịch bản'} · ${rule?.label || 'Chưa xác minh luật'}` : '';
        const team = {...row.team};
        assignDerivedFactions([team],heroesDict);
        return {...row,team,contextLabel,classification,legacyRankings,legacyTier:bestTier(legacyRankings),sourceScore:row.configId ? resolveSelectionScore(seasonModel,row.configId,defaultSeasonSelection(row.config)) : null};
      }));
      sections['team-pk']?.update(rows.filter(row=>row.team.source !== 'moi-phe'),queryForSection('team-pk'));
      sections['meta-cu']?.update(rows.filter(row=>row.team.source === 'moi-phe'),queryForSection('meta-cu'));
      const detailKey=JSON.stringify([state.configId,state.browse]);
      if (openedConfig === detailKey && detailMount.childElementCount) return;
      openedConfig = detailKey;
      detailMount.replaceChildren();
      if (!state.configId) return;
      const row = rows.find(row=>row.configId === state.configId);
      if (!row) { detailMount.append(el('p',{class:'error',role:'status'},'Không có cấu hình này trong phạm vi đã chọn.')); return; }
      detailMount.append(seasonConfigDetail(row,seasonModel,{
        onClose:()=>{
          navigateQuery({config:null});
          if (configTrigger?.isConnected) configTrigger.focus(); else sections[sectionFromHash()]?.focus?.();
        },
        onImport:()=>switchSection('roster-recommend'),
      }));
    }
    const navigateQuery = (changes, push = false) => {
      const url = updateSeasonURL(location.href, changes);
      history[push ? 'pushState' : 'replaceState'](history.state, '', url);
      const params = new URL(location.href).searchParams;
      detailMount.hidden = !['config','detail','legacyTeam'].some(key=>params.has(key)) && !['team-chuan','team-khac'].includes(sectionFromHash());
      renderScope();
    };
    const navigateReference = (changes, push = false) => {
      const url = new URL(location.href);
      for (const [key,value] of Object.entries(changes)) {
        url.searchParams.delete(key);
        if (Array.isArray(value)) value.forEach(item=>url.searchParams.append(key,item));
        else if (value !== null && value !== undefined && value !== '') url.searchParams.set(key,value);
      }
      history[push ? 'pushState' : 'replaceState'](history.state, '', url);
      renderReference();
      const params = new URL(location.href).searchParams;
      detailMount.hidden = !['config','detail','legacyTeam'].some(key=>params.has(key)) && !['team-chuan','team-khac'].includes(sectionFromHash());
    };
    const REFERENCE_PARAMS = ['season','category','q','detail','legacyTeam','legacyVariant','faction','unit','score','subcategory','source'];
    const GAMEPLAY_PARAMS = ['config','q','faction','unit','tier','source','sort','stars'];
    // Khai hoang giữ cặp đang chọn trong query của chính nó; surface khác không mang state này sang.
    const KHAIHOANG_PARAMS = [KHAIHOANG_TEAM_QUERY_KEY,KHAIHOANG_VARIANT_QUERY_KEY];
    const ALL_SURFACE_PARAMS = [...new Set([...REFERENCE_PARAMS,...GAMEPLAY_PARAMS,...KHAIHOANG_PARAMS])];
    const REFERENCE_SECTIONS = ['team-chuan','team-khac'];
    const GAMEPLAY_SECTIONS = ['coexist','analyze','roster-recommend'];
    const surfaceParams = name => name === 'khaihoang' ? KHAIHOANG_PARAMS : REFERENCE_SECTIONS.includes(name) ? REFERENCE_PARAMS : GAMEPLAY_SECTIONS.includes(name) ? GAMEPLAY_PARAMS : null;
    const surfaceSnapshot = (url,keys) => keys
      .filter(key=>!['detail','legacyTeam','legacyVariant','config'].includes(key))
      .flatMap(key=>url.searchParams.getAll(key).map(value=>[key,value]));
    onSectionRequest = (name,{replace=false}={}) => {
      const current = activeSection;
      const currentKeys = surfaceParams(current);
      const targetKeys = surfaceParams(name);
      if (!currentKeys && !targetKeys) { switchSection(name); return; }
      const url = new URL(location.href);
      const snapshots = {...(history.state?.surfaceSnapshots || {})};
      if (currentKeys && !history.state?.referenceAlias) snapshots[current] = surfaceSnapshot(url,currentKeys);
      ALL_SURFACE_PARAMS.forEach(key=>url.searchParams.delete(key));
      if (targetKeys) {
        const saved = snapshots[name];
        if (saved) saved.forEach(([key,value])=>url.searchParams.append(key,value));
        else if (name === 'team-khac') url.searchParams.set('season','all');
      }
      url.hash = `#${name}`;
      history[replace?'replaceState':'pushState']({...history.state,surfaceSnapshots:snapshots,referenceAlias:null},'',url);
      switchSection(name);
    };
    const sessionStore = () => {
      try { return globalThis.sessionStorage; } catch { return null; }
    };
    const referenceHref = row => teamDetailHref(
      row.sourceConfigId
        ? {sourceConfigId:row.sourceConfigId}
        : {legacyTeamId:row.legacyTeamId || row.id,legacyVariantId:row.legacyVariantId},
      {from:location.href},
    );
    // Snapshot chỉ là trạng thái giao diện; lỗi storage không được chặn điều hướng.
    const rememberReturn = () => {
      const tab = sectionFromHash();
      const snapshot = captureReturnSnapshot({
        href:location.href,
        scrollY:window.scrollY,
        tab,
        disclosures:sections[tab]?.getDisclosureState?.() || {
          filters:$(`#section-${tab}-filters`)?.classList.contains('collapsed') === false,
        },
        // Chỉ root Khai hoang đã mount mới ghi map; map rỗng vẫn là lựa chọn hợp lệ của người dùng.
        khaihoangVariants:khaiHoangUI?.getVariants(),
        khaihoangInventory,
      });
      if (!snapshot) return;
      history.replaceState({...history.state,teamReturn:snapshot},'',location.href);
      writeReturnSnapshot(snapshot,sessionStore());
    };
    // Chỉ tab Khai hoang mới ghi cặp đang chọn vào URL root.
    const syncKhaiHoangRoot = (teamId, variantId) => {
      if (sectionFromHash() !== 'khaihoang') return;
      const url = khaiHoangUrlWithPair(location.href,{teamId,variantId});
      if (url === `${location.pathname}${location.search}${location.hash}`) return;
      history.replaceState(history.state,'',url);
    };
    const onReferenceNavigate = event => { if (isNativeNavigationClick(event)) rememberReturn(); };
    const khaiHoangSelections = snapshot => snapshot && Object.hasOwn(snapshot,'khaihoangVariants')
      ? safeKhaiHoangVariants(snapshot.khaihoangVariants,khaihoangInventory)
      : null;
    const restoreReturnState = () => {
      const fromHistory = history.state?.teamReturn;
      const historySnapshot = fromHistory && matchesReturnSnapshot(fromHistory,location.href)
        ? captureReturnSnapshot({
            href:location.href,
            scrollY:fromHistory.scrollY,
            tab:fromHistory.tab,
            disclosures:fromHistory.disclosures,
            khaihoangVariants:fromHistory.khaihoangVariants,
            khaihoangInventory,
          })
        : null;
      const historySelections = khaiHoangSelections(historySnapshot);
      const sessionSnapshot = historySelections === null
        ? readReturnSnapshot(location.href,sessionStore(),{khaihoangInventory})
        : null;
      // Snapshot history cũ thiếu map không được che map mới hơn trong session; map rỗng thì có quyền.
      const selections = historySelections ?? khaiHoangSelections(sessionSnapshot);
      if (khaiHoangUI && (selections !== null || sectionFromHash() === 'khaihoang')) {
        const next = {...(selections || {})};
        if (sectionFromHash() === 'khaihoang') {
          const pair = khaiHoangPairFromUrl(location.href);
          const params = new URL(location.href).searchParams;
          const teams = params.getAll(KHAIHOANG_TEAM_QUERY_KEY);
          const variants = params.getAll(KHAIHOANG_VARIANT_QUERY_KEY);
          if (teams.length === 1 && variants.length <= 1 && khaihoangInventory.has(pair.teamId)
            && (variants.length === 0 || (pair.variantId && khaihoangInventory.get(pair.teamId).has(pair.variantId)))) {
            next[pair.teamId] = pair.variantId;
          }
        }
        khaiHoangUI.setVariants(next);
      }
      const snapshot = historySnapshot || sessionSnapshot;
      if (!snapshot) return;
      const section=sections[snapshot.tab || sectionFromHash()];
      if (section?.setDisclosureState) section.setDisclosureState(snapshot.disclosures);
      else section?.setFiltersExpanded?.(snapshot.disclosures?.filters);
      if (!snapshot.scrollY) return;
      requestAnimationFrame(()=>window.scrollTo({top:snapshot.scrollY,behavior:'instant'}));
    };
    function renderReference() {
      if (!recommendedModel) return;
      const registry = recommendedModel.seasons || {};
      const state = readRecommendedQuery(location.href,registry);
      const explicitSeason = new URL(location.href).searchParams.has('season');
      sections['team-chuan']?.update(recommendedModel.index.records,state,registry);
      sections['team-khac']?.update(recommendedModel.other.records,explicitSeason ? state : {...state,season:'all'},registry);
    }
    const scenarioSelect = el('select', {id:'season-scenario'}, [el('option',{value:''},'Tất cả — tham khảo'), ...(seasonModel?.data['season-registry'] || []).filter(scenario=>scenario.reviewStatus === 'reviewed').map(scenario => el('option',{value:scenario.id},scenario.labelVi))]);
    const rulesetSelect = el('select', {id:'season-ruleset', 'aria-label':'Phiên bản luật'});
    const rulesetControl = el('label',{id:'season-ruleset-control',for:'season-ruleset'},['Phiên bản luật',rulesetSelect]);
    rulesetControl.hidden = sectionFromHash() === 'coexist';
    const summary = el('p', {id:'season-summary', role:'status', class:'scope-note'});
    $('#season-controls').replaceChildren(el('div',{class:'reference-scope-controls'},[el('label',{for:'season-scenario'},['Mùa',scenarioSelect]),rulesetControl]), summary);
    placeSeasonControls(activeSection);
    if (!seasonModel) { scenarioSelect.disabled = true; rulesetSelect.disabled = true; }
    scenarioSelect.addEventListener('change', () => {
      const next = resolveBrowseState(seasonModel, scenarioSelect.value ? {scenarioId:scenarioSelect.value} : {}, {origin:'scenario-change'});
      navigateQuery({scenario:next.scenarioId, ruleset:next.rulesetId, config:null}, true);
    });
    rulesetSelect.addEventListener('change', () => navigateQuery({ruleset:rulesetSelect.value,config:null},true));
    function renderScope() {
      const previous = JSON.stringify(browse);
      browse = seasonModel ? readSeasonQuery(location.href, seasonModel).browse : null;
      projection = seasonModel ? projectSeasonBrowse(seasonModel, browse) : null;
      const scenario = seasonModel?.data['season-registry'].find(item=>item.id === browse?.scenarioId);
      scenarioSelect.value = scenario?.id || '';
      rulesetSelect.replaceChildren(el('option',{value:''},'Chưa chọn — tham khảo'), ...(scenario?.rulesets || []).filter(rule=>rule.reviewStatus === 'reviewed').map(rule=>el('option',{value:rule.id},rule.label)));
      rulesetSelect.value = browse?.rulesetId || '';
      rulesetSelect.disabled = !scenario || !scenario.rulesets.some(rule=>rule.reviewStatus === 'reviewed');
      summary.textContent = !seasonModel ? BUNDLE_NOTICE : browse.kind === 'invalid' ? 'Kịch bản hoặc phiên bản luật không hợp lệ. Hãy chọn lại phạm vi.' : browse.kind === 'all-reference' ? 'Tất cả — tham khảo' : `${scenario?.labelVi || ''} · ${browse.kind === 'verified-pair' ? rulesetSelect.selectedOptions[0]?.textContent : scenario?.rulesets.some(rule=>rule.reviewStatus === 'reviewed') ? 'Chưa chọn phiên bản luật — tham khảo' : 'Chưa có phiên bản luật được xác minh — tham khảo'}`;
      const groups = projection ? [...projection.coexist.applicable, ...projection.coexist.scenarioReference, ...projection.coexist.unknown] : coexist.map(content=>({content,source:null}));
      coexistUI.update(groups);
      renderTeams();
      if (previous !== JSON.stringify(browse)) consumers.forEach(consumer=>consumer?.setSeasonScope?.({model:seasonModel,browse}));
    }
    if (recommendedModel) {
      sections['team-chuan'] = createRecommendedSection({mount:$('#section-team-chuan'),title:'Đội chuẩn',family:'recommended',onQuery:navigateReference,hrefFor:referenceHref,onNavigate:onReferenceNavigate});
      sections['team-khac'] = createRecommendedSection({mount:$('#section-team-khac'),title:'Đội khác',family:'other',onQuery:navigateReference,hrefFor:referenceHref,onNavigate:onReferenceNavigate});
    } else {
      $('#section-team-chuan').append(el('p',{class:'error',role:'status'},'Dữ liệu đội chuẩn hiện không khả dụng. Các mục khác vẫn hoạt động.'));
      $('#section-team-khac').append(el('p',{class:'error',role:'status'},'Dữ liệu đội khác hiện không khả dụng. Các mục khác vẫn hoạt động.'));
    }
    let lookupUI = null;
    onNavigation = () => {
      const params = new URL(location.href).searchParams;
      detailMount.hidden = !params.has('config') && !['team-chuan','team-khac'].includes(sectionFromHash());
      renderScope();
      renderReference();
      if (sectionFromHash() === "lookup") lookupUI?.render();
      khaiHoangUI?.updateLinks();
    };
    // Mount controller Khai hoang trước restore: restoration ghi lựa chọn vào card đã dựng,
    // href tự đủ state cho Cmd/Ctrl-click và copy link mà không cần sửa URL tab nguồn.
    khaiHoangUI = khaihoangTable(khaihoang, {
      hrefFor: (teamId, variantId) => teamDetailHref(
        {khaiHoangTeamId: teamId, khaiHoangVariantId: variantId},
        {from: khaiHoangUrlWithPair(location.href, {teamId, variantId})},
      ),
      // Primary click: đồng bộ cặp đang bấm rồi mới ghi snapshot, không preventDefault.
      onNavigate: (event, teamId, variantId) => {
        if (!isNativeNavigationClick(event)) return;
        syncKhaiHoangRoot(teamId, variantId);
        rememberReturn();
      },
      // Đổi select: URL root theo cặp mới và snapshot được làm mới ngay.
      onChange: (teamId, variantId) => {
        syncKhaiHoangRoot(teamId, variantId);
        rememberReturn();
      },
    });
    $("#section-khaihoang").append(khaiHoangUI.element);
    onNavigation();
    renderScope();
    restoreReturnState();
    window.addEventListener("popstate", () => {
      restoringHistory = true;
      switchSection(sectionFromHash());
      restoreReturnState();
      setTimeout(()=>{restoringHistory=false;},0);
    });
    window.addEventListener('pageshow', event => { if (event.persisted) restoreReturnState(); });
    // Scroll mới nhất phải vào snapshot trước khi rời tab bằng paste/copy URL.
    window.addEventListener('pagehide', rememberReturn);
    if (catalog) lookupUI = initUnifiedLookup({ heroes: heroesDict, tactics, catalog }, $("#section-lookup"));

    // Kết quả gameplay giữ nguyên tab người dùng: config mở detail dùng chung, đội gốc đi trang riêng.
    const onOpenTeam = (team) => {
      if (team.configId && seasonModel) { openConfig(team.configId); return; }
      const href = teamDetailHref({legacyTeamId:team.id},{from:location.href});
      if (!href) return;
      rememberReturn();
      location.assign(href);
    };
    if (lookupBundle) {
      initRecruitTracker({ heroesDict, mount: $("#section-recruit-tracker") });
      consumers.push(initAnalyze({ teams, heroesDict, tacticsDict: tactics, booksDict, onOpenTeam }, $("#section-analyze")));
      consumers.push(initRosterRecommend({ teams, teamTier, heroesDict, tacticsDict: tactics, onOpenTeam }, $("#section-roster-recommend")));
    } else {
      for (const id of ["section-recruit-tracker", "section-analyze", "section-roster-recommend"]) {
        $(`#${id}`).append(el("p", { class: "error", role: "status" }, "Tính năng này cần dữ liệu Tra cứu đang không khả dụng."));
      }
    }
    consumers.forEach(consumer=>consumer?.setSeasonScope?.({model:seasonModel,browse:browse || {kind:["scenario","ruleset"].some(key=>new URL(location.href).searchParams.has(key)) ? "invalid" : "all-reference"}}, {initial:true}));
  } catch (err) {
    const mount = $("#section-team-chuan");
    const template = websiteDisplay
      ? displayValue(websiteDisplay, "ui:app/load-error", "errorTemplate")
      : "Không thể tải dữ liệu. Hãy tải lại trang hoặc liên hệ quản trị viên nếu lỗi tiếp diễn.";
    if (mount) mount.append(el("p", { class: "error" }, template.replace("{message}", "không xác định")));
  }
}

main();
