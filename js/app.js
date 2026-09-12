// Điều phối: load JSON, section nav, render, theme. Vanilla ES module.
// Cả 2 tab team (Team PK / Meta cũ) dùng chung filter inline qua
// createTeamFilterSection — không còn sidebar drawer riêng.

import { seasonConfigDetail, bestTier, el, khaihoangTable } from "./render.js";
import { initTactics } from "./tactics.js";
import { initTeamPk } from "./team-pk.js";
import { initMetaCu } from "./meta-cu.js";
import { initHeroList } from "./hero-list.js";
import { initAnalyze } from "./analyze.js";
import { initRecruitTracker } from "./recruit-tracker.js";
import { initRosterRecommend } from "./roster-recommend-ui.js";
import { createMobileSectionMenu } from "./mobile-section-menu.js";

import { loadSeasonModel, readSeasonQuery, updateSeasonURL, defaultSeasonSelection, BUNDLE_NOTICE } from './season-ui-state.js';
import { assignDerivedFactions } from "./derive-team-faction.js";
import { createSeasonTeamSection, createSeasonCoexistSection } from "./team-filter-section.js";
import { resolveBrowseState, projectSeasonBrowse, resolveSelectionScore } from './season-context.js';

let sectionMenu = null;
let onNavigation = () => {};

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

/* ---------- Theme ---------- */
function initTheme() {
  const saved = localStorage.getItem("theme");
  const theme = saved || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.dataset.theme = theme;
  $("#theme-toggle").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("theme", next);
  });
}

/* ---------- Section nav ---------- */
const SECTIONS = ["team-pk", "meta-cu", "coexist", "khaihoang", "heroes", "tactics", "recruit-tracker", "analyze", "roster-recommend"];
function initNav() {
  sectionMenu = createMobileSectionMenu({
    nav: $(".section-nav"),
    toggle: $("#section-menu-toggle"),
    tabs: [...document.querySelectorAll(".nav-tab")],
  });
  document.querySelectorAll(".nav-tab").forEach((tab) => {
    tab.addEventListener("click", () => switchSection(tab.dataset.section));
  });
  // Deep-link: mở section theo hash (#khaihoang) + đồng bộ khi đổi hash.
  window.addEventListener("hashchange", () => switchSection(sectionFromHash()));
  switchSection(sectionFromHash());
}
function sectionFromHash() {
  const name = (location.hash || "").replace(/^#/, "");
  return SECTIONS.includes(name) ? name : "team-pk";
}
function switchSection(name) {
  document.querySelectorAll(".nav-tab").forEach((t) => t.classList.toggle("active", t.dataset.section === name));
  document.querySelectorAll(".section").forEach((s) => s.classList.toggle("active", s.id === `section-${name}`));
  sectionMenu?.setActive(name);
  const controls = $('#season-controls');
  if (controls) controls.hidden = !['team-pk','meta-cu','coexist','analyze','roster-recommend'].includes(name);
  $('.tagline').textContent = name === 'khaihoang' ? 'Khai hoang — dữ liệu mới nhất' : 'Tra cứu đội hình theo kịch bản';
  if (sectionFromHash() !== name) location.hash = name;
  onNavigation();
}

/* ---------- Boot ---------- */
async function main() {
  initTheme();
  initNav();
  try {
    const byteRequests = new Map();
    const loadBytes = (name) => {
      if (!byteRequests.has(name)) byteRequests.set(name, fetch(`./data/${name}.json`).then(response => {
        if (!response.ok) throw new Error(`./data/${name}.json: ${response.status}`);
        return response.arrayBuffer();
      }));
      return byteRequests.get(name);
    };
    const loadData = name => loadBytes(name).then(bytes => JSON.parse(new TextDecoder().decode(bytes)));
    const [teams, coexist, khaihoang, tactics, heroesDict, booksDict] = await Promise.all([
      loadData("teams"),
      loadData("coexist"),
      loadJSON("./data/khaihoang.json"),
      loadData("tactics"),
      loadData("heroes-dict"),
      loadData("books-dict"),
    ]);
    const teamTier = await loadOptionalJSON("./data/team-tier.json", []);
    const tierIndex = new Map(teamTier.map((r) => [r.teamId, r.rankings]));

    let seasonModel = null;
    try { seasonModel = await loadSeasonModel(JSON.parse($('#season-artifact-hashes').textContent), loadBytes); } catch { /* Legacy display stays available with an explicit notice. */ }
    let browse = seasonModel ? readSeasonQuery(location.href, seasonModel).browse : null;
    let projection = seasonModel ? projectSeasonBrowse(seasonModel, browse) : null;
    const consumers = [];
    const sections = {};
    let openedConfig = null;
    let configTrigger = null;
    const detailMount = el('div',{id:'season-detail-mount'});
    $('#season-controls').after(detailMount);
    function openConfig(configId) {
      configTrigger = document.activeElement;
      navigateQuery({config:configId},true);
      const detail = $('#season-config-detail');
      if (detail) {
        detail.focus({preventScroll:true});
        window.scrollTo({top:window.scrollY + detail.getBoundingClientRect().top - $('.top-header').getBoundingClientRect().height - 12,behavior:'instant'});
      }
    }
    const coexistUI = createSeasonCoexistSection({mount:$('#section-coexist'),onQuery:changes=>navigateQuery(changes)});
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
      history[push ? 'pushState' : 'replaceState'](null, '', url);
      renderScope();
    };
    const scenarioSelect = el('select', {id:'season-scenario', 'aria-label':'Kịch bản đang chơi'}, [el('option',{value:''},'Tất cả — tham khảo'), ...(seasonModel?.data['season-registry'] || []).filter(scenario=>scenario.reviewStatus === 'reviewed').map(scenario => el('option',{value:scenario.id},scenario.labelVi))]);
    const rulesetSelect = el('select', {id:'season-ruleset', 'aria-label':'Phiên bản luật'});
    const summary = el('p', {id:'season-summary', role:'status', class:'scope-note'});
    $('#season-controls').replaceChildren(el('label',{for:'season-scenario'},['Kịch bản đang chơi',scenarioSelect]), el('label',{for:'season-ruleset'},['Phiên bản luật',rulesetSelect]), summary);
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
      coexistUI.update(groups,queryForSection('coexist'),browse?.kind === 'all-reference' || !browse ? 'Tham khảo — gồm dữ liệu chưa rõ mùa' : summary.textContent);
      renderTeams();
      if (previous !== JSON.stringify(browse)) consumers.forEach(consumer=>consumer?.setSeasonScope?.({model:seasonModel,browse}));
    }
    if (seasonModel) {
      for (const [key,title] of [['team-pk','Team PK'],['meta-cu','Team Meta phe (cũ)']]) sections[key] = createSeasonTeamSection({mount:$('#section-'+key),title,onQuery:changes=>navigateQuery(changes),onOpenConfig:openConfig});
    } else {
      sections['team-pk'] = initTeamPk({teams,tierIndex,heroesDict,mount:$('#section-team-pk')});
      sections['meta-cu'] = initMetaCu({teams,tierIndex,mount:$('#section-meta-cu')});
    }
    onNavigation = () => {
      detailMount.hidden = !['team-pk','meta-cu'].includes(sectionFromHash());
      renderScope();
    };
    onNavigation();

    renderScope();
    window.addEventListener("popstate", () => {
      const hadDetail = !!$('#season-config-detail');
      renderScope();
      if (hadDetail && !$('#season-config-detail')) sections[sectionFromHash()]?.focus?.();
    });
    $("#section-khaihoang").append(khaihoangTable(khaihoang));
    initHeroList(heroesDict, tactics, $("#section-heroes"));
    initTactics(tactics, $("#section-tactics"));
    initRecruitTracker({ heroesDict, mount: $("#section-recruit-tracker") });

    // Mở team giống từ kết quả soi đội -> về đúng tab theo nguồn + search tên tướng đầu.
    const SOURCE_SECTION = { "moi-phe": "meta-cu", "team-intro": "team-pk" };
    const onOpenTeam = (team) => {
      const name = SOURCE_SECTION[team.source] || "team-pk";
      switchSection(name);
      if (team.configId && seasonModel) { openConfig(team.configId); return; }
      const first = team.heroes?.[0]?.baseName;
      if (first) sections[name]?.setSearch(first);
      window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    };
    consumers.push(initAnalyze({ teams, heroesDict, tacticsDict: tactics, booksDict, onOpenTeam }, $("#section-analyze")));
    consumers.push(initRosterRecommend({ teams, teamTier, heroesDict, tacticsDict: tactics, onOpenTeam }, $("#section-roster-recommend")));
    consumers.forEach(consumer=>consumer?.setSeasonScope?.({model:seasonModel,browse:browse || {kind:["scenario","ruleset"].some(key=>new URL(location.href).searchParams.has(key)) ? "invalid" : "all-reference"}}, {initial:true}));
  } catch (err) {
    $("#section-team-pk").append(el("p", { class: "error" }, "Lỗi tải dữ liệu: " + err.message + ". Hãy tải lại trang hoặc liên hệ quản trị viên nếu lỗi tiếp diễn."));
  }
}

main();
