// Điều phối dữ liệu tĩnh và mục của MỘT trang mục: mỗi đường dẫn tự nạp dữ liệu, tự mount mục
// của mình. Không còn tab, hashchange hay switchSection — điều hướng giữa các mục là chuyển trang.

import { seasonConfigDetail, bestTier, el, khaihoangTable } from "./render.js";
import { loadLookupBundle } from "./lookup-data.js";
import { initUnifiedLookup } from "./unified-lookup.js";
import { initAnalyze } from "./analyze.js";
import { initRecruitTracker } from "./recruit-tracker.js";
import { initRosterRecommend } from "./roster-recommend-ui.js";
import { displayValue, loadWebsiteDisplay, localizeData } from "./website-display.js";

import { loadSeasonModel, readSeasonQuery, updateSeasonURL, defaultSeasonSelection, BUNDLE_NOTICE } from './season-ui-state.js';
import { assignDerivedFactions } from "./derive-team-faction.js";
import { createSeasonCoexistSection, createRecommendedSection } from "./team-filter-section.js";
import { resolveBrowseState, projectSeasonBrowse, resolveSelectionScore } from './season-context.js';
import { loadRecommendedReference, readRecommendedQuery } from './recommended-reference-state.js';
import { resolveTeamView, writeStoredTeamView } from './team-view.js';
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
  teamDetailPath,
  writeReturnSnapshot,
} from './team-detail-navigation.js';

const $ = (sel) => document.querySelector(sel);

/** Mục có phạm vi mùa + chi tiết cấu hình: layout chỉ phát payload cho đúng 5 trang này. */
const REFERENCE_SECTIONS = ['team-chuan', 'team-khac'];
const GAMEPLAY_SECTIONS = ['coexist', 'analyze', 'roster-recommend'];
/** 3 công cụ Beta (Phase 9): bộ chọn Mùa nằm trong đầu mục do chính công cụ dựng. */
const TOOL_SECTIONS = ['analyze', 'roster-recommend'];
/** Khóa theo dõi bị bỏ khỏi URL trang mục ngay khi khởi động; mọi khóa khác giữ nguyên. */
const TRACKING_PARAM = /^(?:utm_.+|fbclid|gclid|msclkid)$/;

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

/** URL trang mục sạch khóa theo dõi: `replaceState` để không thêm bước lịch sử. */
function stripTrackingParams() {
  const url = new URL(location.href);
  const removed = [...url.searchParams.keys()].filter((key) => TRACKING_PARAM.test(key));
  if (!removed.length) return;
  for (const key of removed) url.searchParams.delete(key);
  history.replaceState(history.state, '', url);
}

/** Bộ lọc điểm đã bỏ: `score=` cũ bị bỏ qua và bị xóa khỏi URL ngay lần replaceState đầu. */
function stripRetiredReferenceParams(pageSection) {
  if (!REFERENCE_SECTIONS.includes(pageSection)) return;
  const url = new URL(location.href);
  if (!url.searchParams.has('score')) return;
  url.searchParams.delete('score');
  history.replaceState(history.state, '', url);
}

/** localStorage có thể bị chặn (chế độ riêng tư): đọc/ghi lựa chọn Thẻ/Bảng chỉ là ghi nhớ. */
function localStore() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

async function main() {
  const pageSection = document.body.dataset.pageSection || '';
  const mount = pageSection ? $(`#section-${pageSection}`) : null;
  // app.js chỉ được nạp ở trang mục; thiếu mount là lỗi build nên không giữ trang ở trạng thái chờ.
  if (!mount) {
    document.body.dataset.boot = 'ready';
    return;
  }
  // Bảng route handle phải sẵn sàng trước migrate và mọi lần dựng href.
  setTeamRouteHandlesFromJSON($('#team-route-handles')?.textContent);
  stripTrackingParams();
  stripRetiredReferenceParams(pageSection);
  // Layout sở hữu payload: có `#season-controls` nghĩa là trang này có phạm vi mùa. app.js
  // không giữ danh sách mục nào của riêng nó, nên thêm/bớt trang chỉ cần sửa layout.
  const controls = $('#season-controls');
  const seasonScoped = controls !== null;
  let websiteDisplay = null;
  try {
    const byteRequests = new Map();
    const loadBytes = (name) => {
      const path = name === "website-display.json"
        ? "/data/website-display.json"
        : name.startsWith("data/")
          ? `/${name}`
          : `/data/${name.replace(/\.json$/, "")}.json`;
      if (!byteRequests.has(path)) byteRequests.set(path, fetch(path).then(async response => {
        if (!response.ok) throw new Error(`${path}: ${response.status}`);
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
      mount.append(el("p", { class: "error", role: "alert" }, "Dữ liệu Tra cứu hiện không khả dụng. Các mục đội hình vẫn hoạt động."));
    }
    const heroesDict = lookupBundle?.heroes ?? [];
    const tactics = lookupBundle?.tactics ?? [];
    const catalog = lookupBundle?.catalog ?? null;
    const teamTier = await loadOptionalJSON("/data/team-tier.json", []);
    const tierIndex = new Map(teamTier.map((r) => [r.teamId, r.rankings]));

    // Phạm vi mùa chỉ có payload ở 5 trang mục; thiếu hash là trang không dùng đến mô hình mùa.
    let seasonModel = null;
    if (controls && $('#season-artifact-hashes')) {
      try { seasonModel = await loadSeasonModel(JSON.parse($('#season-artifact-hashes').textContent), loadBytes); } catch { /* Legacy display stays available with an explicit notice. */ }
    }
    // Generation Đội chuẩn chỉ tải khi trang thật sự cần: hai trang danh sách ngay lúc boot, các trang
    // khác (Tra cứu, Khai hoang, Công cụ) chỉ qua `loadRecommended()` nếu có nơi hỏi tới. Nhờ vậy trang
    // Tra cứu không kéo `index.json`/`other-teams.json` khi chưa mở hồ sơ; promise lỗi bị xóa để thử lại.
    let recommendedModel = null;
    let recommendedPending = null;
    const loadRecommendedBytes = async path => {
      const response = await fetch(`/data/recommended/${path}`);
      if (!response.ok) throw new Error(`/data/recommended/${path}: ${response.status}`);
      return response.arrayBuffer();
    };
    const loadRecommended = () => {
      if (!recommendedPending) {
        recommendedPending = loadRecommendedReference(recommendedPin, loadRecommendedBytes)
          .then(model => { recommendedModel = model; return model; })
          .catch(error => { recommendedPending = null; throw error; });
      }
      return recommendedPending;
    };
    if (REFERENCE_SECTIONS.includes(pageSection)) {
      try { await loadRecommended(); } catch { /* Recommended views render an isolated unavailable state below. */ }
    }
    // URL tham chiếu cũ đi tiếp bằng identity thật; bảng route handle đã phát cho mọi trang mục nên
    // nhận diện Đội chuẩn không cần nạp index.
    const migration = migrateLegacyReferenceUrl(location.href, {
      hasRecommended: id => teamDetailPath({ sourceConfigId: id }) !== null,
      hasLegacy: id => teams.some(team => team.id === id),
    });
    if (migration) { location.replace(migration.target); return; }
    let browse = seasonModel ? readSeasonQuery(location.href, seasonModel).browse : null;
    let projection = seasonModel ? projectSeasonBrowse(seasonModel, browse) : null;
    const consumers = [];
    const sections = {};
    let openedConfig = null;
    let configTrigger = null;
    const detailMount = controls ? el('div',{id:'season-detail-mount'}) : null;
    controls?.after(detailMount);
    detailMount?.addEventListener('keydown',event=>{
      if (event.key !== 'Escape' || !detailMount.querySelector('#season-config-detail')) return;
      event.preventDefault();
      navigateQuery({config:null});
      if (configTrigger?.isConnected) configTrigger.focus(); else sections[pageSection]?.focus?.();
    });
    /** Nút nhập kho của chi tiết cấu hình là link thật; giữ nguyên phạm vi mùa đang chọn. */
    const rosterImportHref = () => {
      const current = new URL(location.href).searchParams;
      const params = new URLSearchParams();
      for (const key of ['scenario','ruleset']) if (current.has(key)) params.set(key, current.get(key));
      const search = params.toString();
      return `/goi-y-doi/${search ? `?${search}` : ''}`;
    };
    function openConfig(configId) {
      configTrigger = document.activeElement;
      navigateQuery({config:configId},true);
      const detail = $('#season-config-detail');
      if (detail) {
        detail.focus({preventScroll:true});
        const headerHeight = $('.top-header')?.getBoundingClientRect().height ?? 0;
        window.scrollTo({top:window.scrollY + detail.getBoundingClientRect().top - headerHeight - 12,behavior:'instant'});
      }
    }
    const coexistUI = pageSection === 'coexist' ? createSeasonCoexistSection({
      mount,
      // Nhãn kịch bản lấy từ registry đã xác thực; nhóm không gắn kịch bản dùng nhãn riêng của mục.
      scenarioLabel: scenarioId => seasonModel?.data['season-registry'].find(item => item.id === scenarioId)?.labelVi || '',
      onGroup: syncCoexistGroup,
    }) : null;
    /**
     * Nhóm Cùng Tồn đang xem nằm trong query của chính trang mục; chỉ `replaceState` (không render lại)
     * để đổi nhóm và nhóm cũ hết hợp lệ đều không tạo thêm bước lịch sử.
     */
    function syncCoexistGroup(key) {
      if (pageSection !== 'coexist') return;
      const next = String(updateSeasonURL(location.href, {group: key ?? null}));
      if (next === location.href) return;
      history.replaceState(history.state, '', next);
    }
    function queryForSection(name) {
      const state = readSeasonQuery(location.href,seasonModel);
      return pageSection === name ? state : {...state,query:'',sort:'tier',filters:{faction:[],unit:[],tier:[],source:[]},notices:[]};
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
          if (configTrigger?.isConnected) configTrigger.focus(); else sections[pageSection]?.focus?.();
        },
        importHref:rosterImportHref(),
      }));
    }
    const navigateQuery = (changes, push = false) => {
      const url = updateSeasonURL(location.href, changes);
      history[push ? 'pushState' : 'replaceState'](history.state, '', url);
      const params = new URL(location.href).searchParams;
      if (detailMount) detailMount.hidden = !['config','detail','legacyTeam'].some(key=>params.has(key)) && !REFERENCE_SECTIONS.includes(pageSection);
      renderScope();
    };
    const navigateReference = (changes, push = false) => {
      // Kiểu hiển thị được ghi nhớ theo trình duyệt; URL chỉ mang `view=bang`, Thẻ là mặc định.
      if (Object.hasOwn(changes, 'view')) writeStoredTeamView(localStore(), changes.view);
      const url = new URL(location.href);
      for (const [key,value] of Object.entries(changes)) {
        url.searchParams.delete(key);
        if (Array.isArray(value)) value.forEach(item=>url.searchParams.append(key,item));
        else if (value !== null && value !== undefined && value !== '') url.searchParams.set(key,value);
      }
      history[push ? 'pushState' : 'replaceState'](history.state, '', url);
      renderReference();
      const params = new URL(location.href).searchParams;
      if (detailMount) detailMount.hidden = !['config','detail','legacyTeam'].some(key=>params.has(key)) && !REFERENCE_SECTIONS.includes(pageSection);
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
      const tab = pageSection;
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
    // Chỉ trang Khai hoang mới ghi cặp đang chọn vào URL của chính nó.
    const syncKhaiHoangRoot = (teamId, variantId) => {
      if (pageSection !== 'khaihoang') return;
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
      if (khaiHoangUI && (selections !== null || pageSection === 'khaihoang')) {
        const next = {...(selections || {})};
        if (pageSection === 'khaihoang') {
          const pair = khaiHoangPairFromUrl(location.href);
          const params = new URL(location.href).searchParams;
          const teamParams = params.getAll(KHAIHOANG_TEAM_QUERY_KEY);
          const variantParams = params.getAll(KHAIHOANG_VARIANT_QUERY_KEY);
          if (teamParams.length === 1 && variantParams.length <= 1 && khaihoangInventory.has(pair.teamId)
            && (variantParams.length === 0 || (pair.variantId && khaihoangInventory.get(pair.teamId).has(pair.variantId)))) {
            next[pair.teamId] = pair.variantId;
          }
        }
        khaiHoangUI.setVariants(next);
      }
      const snapshot = historySnapshot || sessionSnapshot;
      if (!snapshot) return;
      const section=sections[snapshot.tab || pageSection];
      if (section?.setDisclosureState) section.setDisclosureState(snapshot.disclosures);
      else section?.setFiltersExpanded?.(snapshot.disclosures?.filters);
      if (!snapshot.scrollY) return;
      requestAnimationFrame(()=>window.scrollTo({top:snapshot.scrollY,behavior:'instant'}));
    };
    function renderReference() {
      if (!REFERENCE_SECTIONS.includes(pageSection) || !recommendedModel) return;
      const registry = recommendedModel.seasons || {};
      const state = readRecommendedQuery(location.href,registry);
      // URL > giá trị đã lưu > Thẻ; cả hai trang danh sách dùng chung một lựa chọn.
      const resolved = {...state, view:resolveTeamView(state.view, localStore())};
      const explicitSeason = new URL(location.href).searchParams.has('season');
      sections['team-chuan']?.update(recommendedModel.index.records,resolved,registry);
      sections['team-khac']?.update(recommendedModel.other.records,explicitSeason ? resolved : {...resolved,season:'all'},registry);
    }
    const scenarioSelect = seasonScoped ? el('select', {id:'season-scenario'}, [el('option',{value:''},'Tất cả — tham khảo'), ...(seasonModel?.data['season-registry'] || []).filter(scenario=>scenario.reviewStatus === 'reviewed').map(scenario => el('option',{value:scenario.id},scenario.labelVi))]) : null;
    const rulesetSelect = seasonScoped ? el('select', {id:'season-ruleset', 'aria-label':'Phiên bản luật'}) : null;
    const rulesetControl = seasonScoped ? el('label',{id:'season-ruleset-control',for:'season-ruleset'},['Phiên bản luật',rulesetSelect]) : null;
    const summary = seasonScoped ? el('p', {id:'season-summary', role:'status', class:'scope-note'}) : null;
    if (seasonScoped) {
      controls.replaceChildren(el('div',{class:'reference-scope-controls'},[el('label',{for:'season-scenario'},['Mùa',scenarioSelect]),rulesetControl]), summary);
      placeSeasonControls();
      if (!seasonModel) { scenarioSelect.disabled = true; rulesetSelect.disabled = true; }
    }
    /** Bộ chọn Mùa / Phiên bản luật cố định theo trang: Cùng Tồn và 3 công cụ đặt trong đầu mục, mục gameplay còn lại trên thanh. */
    function placeSeasonControls() {
      // Trang không có phạm vi mùa (Chiêu mộ, Tra cứu, trang chi tiết) không có #season-controls.
      if (!controls) return;
      controls.hidden = !GAMEPLAY_SECTIONS.includes(pageSection);
      rulesetControl.hidden = pageSection === 'coexist';
      summary.hidden = pageSection === 'coexist';
      if (pageSection === 'coexist') {
        const head = mount.querySelector(':scope > .coexist-head');
        if (head) head.append(controls);
      } else if (TOOL_SECTIONS.includes(pageSection) && mount.querySelector('.tool-head')) {
        // 3 công cụ Phase 9 dựng đầu mục sau khi app khởi tạo, nên lần đặt thứ hai (sau khi mount) mới có đích.
        mount.querySelector('.tool-head').append(controls);
      } else if (detailMount) {
        detailMount.before(controls);
      }
    }
    scenarioSelect?.addEventListener('change', () => {
      const next = resolveBrowseState(seasonModel, scenarioSelect.value ? {scenarioId:scenarioSelect.value} : {}, {origin:'scenario-change'});
      navigateQuery({scenario:next.scenarioId, ruleset:next.rulesetId, config:null}, true);
    });
    rulesetSelect?.addEventListener('change', () => navigateQuery({ruleset:rulesetSelect.value,config:null},true));
    function renderScope() {
      if (!seasonScoped) return;
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
      // `group` không hợp lệ (kể cả lặp khóa) được coi là "có yêu cầu": mục tự về nhóm đầu và bỏ khỏi URL.
      const groupParams = new URL(location.href).searchParams.getAll('group');
      coexistUI?.update(groups, groupParams.length === 0 ? null : groupParams.length === 1 ? groupParams[0] : '');
      renderTeams();
      if (previous !== JSON.stringify(browse)) consumers.forEach(consumer=>consumer?.setSeasonScope?.({model:seasonModel,browse}));
    }
    if (pageSection === 'team-chuan') {
      sections['team-chuan'] = recommendedModel
        ? createRecommendedSection({mount,title:'Đội chuẩn',family:'recommended',onQuery:navigateReference,hrefFor:referenceHref,onNavigate:onReferenceNavigate})
        : null;
    } else if (pageSection === 'team-khac') {
      sections['team-khac'] = recommendedModel
        ? createRecommendedSection({mount,title:'Đội khác',family:'other',onQuery:navigateReference,hrefFor:referenceHref,onNavigate:onReferenceNavigate})
        : null;
    }
    if (REFERENCE_SECTIONS.includes(pageSection) && !recommendedModel) {
      mount.append(el('p',{class:'error',role:'status'}, pageSection === 'team-chuan'
        ? 'Dữ liệu đội chuẩn hiện không khả dụng. Các mục khác vẫn hoạt động.'
        : 'Dữ liệu đội khác hiện không khả dụng. Các mục khác vẫn hoạt động.'));
    }
    let lookupUI = null;
    const refresh = () => {
      if (detailMount) detailMount.hidden = !new URL(location.href).searchParams.has('config') && !REFERENCE_SECTIONS.includes(pageSection);
      renderScope();
      renderReference();
      khaiHoangUI?.updateLinks();
    };
    // Mount controller Khai hoang trước restore: restoration ghi lựa chọn vào card đã dựng,
    // href tự đủ state cho Cmd/Ctrl-click và copy link mà không cần sửa URL nguồn.
    if (pageSection === 'khaihoang') {
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
        // Đổi select: URL mục theo cặp mới và snapshot được làm mới ngay.
        onChange: (teamId, variantId) => {
          syncKhaiHoangRoot(teamId, variantId);
          rememberReturn();
        },
      });
      mount.append(khaiHoangUI.element);
    }
    refresh();
    renderScope();
    restoreReturnState();
    // Back/Forward đổi URL: đọc lại và render trạng thái do URL sở hữu (mùa, bộ lọc, chi tiết
    // cấu hình, consumer phạm vi) TRƯỚC khi khôi phục disclosure/lựa chọn/scroll.
    // Tra cứu giữ listener popstate riêng của nó trong `initUnifiedLookup`.
    window.addEventListener("popstate", () => {
      refresh();
      restoreReturnState();
    });
    window.addEventListener('pageshow', event => { if (event.persisted) restoreReturnState(); });
    // Scroll mới nhất phải vào snapshot trước khi rời trang bằng paste/copy URL.
    window.addEventListener('pagehide', rememberReturn);
    if (pageSection === 'lookup' && catalog) lookupUI = initUnifiedLookup({ heroes: heroesDict, tactics, catalog }, mount, {
      summary: {
        pin: recommendedPin,
        loadBytes: loadRecommendedBytes,
        // Khóa nối của số liệu là chính kho Tra cứu đang phát; hash đã xác minh lúc boot.
        catalogSha256: websiteDisplay?.sourceHashes?.["data/heroes-dict.json"] ?? null,
      },
    });

    // Kết quả gameplay giữ nguyên trang người dùng: config mở detail dùng chung, đội gốc đi trang riêng.
    const onOpenTeam = (team) => {
      if (team.configId && seasonModel) { openConfig(team.configId); return; }
      const href = teamDetailHref({legacyTeamId:team.id},{from:location.href});
      if (!href) return;
      rememberReturn();
      location.assign(href);
    };
    if (lookupBundle) {
      if (pageSection === 'recruit-tracker') initRecruitTracker({ heroesDict, mount });
      if (pageSection === 'analyze') consumers.push(initAnalyze({ teams, heroesDict, tacticsDict: tactics, booksDict, onOpenTeam }, mount));
      if (pageSection === 'roster-recommend') consumers.push(initRosterRecommend({ teams, teamTier, heroesDict, tacticsDict: tactics, onOpenTeam }, mount));
    } else if (['recruit-tracker', 'analyze', 'roster-recommend'].includes(pageSection)) {
      mount.append(el("p", { class: "error", role: "status" }, "Tính năng này cần dữ liệu Tra cứu đang không khả dụng."));
    }
    consumers.forEach(consumer=>consumer?.setSeasonScope?.({model:seasonModel,browse:browse || {kind:["scenario","ruleset"].some(key=>new URL(location.href).searchParams.has(key)) ? "invalid" : "all-reference"}}, {initial:true}));
    // 3 công cụ dựng đầu mục ở bước mount phía trên: đặt lại bộ chọn Mùa vào đúng đầu mục của công cụ.
    placeSeasonControls();
  } catch (err) {
    const template = websiteDisplay
      ? displayValue(websiteDisplay, "ui:app/load-error", "errorTemplate")
      : "Không thể tải dữ liệu. Hãy tải lại trang hoặc liên hệ quản trị viên nếu lỗi tiếp diễn.";
    mount.append(el("p", { class: "error", role: "alert" }, template.replace("{message}", "không xác định")));
  } finally {
    // Tín hiệu cho e2e: mount xong, kể cả khi nhánh trên đã lỗi.
    document.body.dataset.boot = 'ready';
  }
}

main();
