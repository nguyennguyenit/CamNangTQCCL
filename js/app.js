// Điều phối: load JSON, section nav, render, filter UI, theme. Vanilla ES module.

import { applyFilters, emptyState } from "./filters.js";
import { coexistGroup, el, FACTION_CODE, khaihoangTable, SOURCE_LABEL, STATUS_LABEL, teamCard } from "./render.js";
import { initTactics } from "./tactics.js";
import { initAnalyze } from "./analyze.js";
import { createMobileFilterDrawer } from "./mobile-filter-drawer.js";
import { createMobileSectionMenu } from "./mobile-section-menu.js";

const state = emptyState();
let TEAMS = [];
let FACETS = {};
let filterDrawer = null;
let sectionMenu = null;

const $ = (sel) => document.querySelector(sel);

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
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
const SECTIONS = ["team-pk", "coexist", "khaihoang", "tactics", "analyze"];
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
  // Sidebar ẩn -> layout 1 cột để content tràn full (tránh bị dồn vào track 270px).
  document.querySelector(".layout").classList.toggle("full", name !== "team-pk");
  filterDrawer?.closeForSection(name, { focusTarget: $("#section-menu-toggle") });
  $("#mobile-filter-actions").hidden = name !== "team-pk";
  sectionMenu?.setActive(name);
  if (sectionFromHash() !== name) location.hash = name;
}

/* ---------- Filter UI ---------- */
const CHIP_GROUPS = [
  { key: "unitTypes", facet: "unitTypes", label: "Loại binh" },
  { key: "stars", facet: "stars", label: "Sao" },
  { key: "statuses", facet: "statuses", label: "Trạng thái", fmt: (v) => STATUS_LABEL[v] || v },
  { key: "factions", facet: "factions", label: "Phe" },
  { key: "sources", facet: "sources", label: "Nguồn", fmt: (v) => SOURCE_LABEL[v] || v },
];
const COMBO_GROUPS = [
  { key: "heroes", facet: "heroes", label: "Tướng" },
  { key: "tactics", facet: "tactics", label: "Chiến pháp" },
  { key: "books", facet: "books", label: "Binh thư" },
];

function buildFilterUI() {
  const panel = $("#filters");
  panel.replaceChildren();

  for (const g of CHIP_GROUPS) {
    const values = FACETS[g.facet] || [];
    if (!values.length) continue;
    const chips = el("div", { class: "chip-row" });
    for (const { value, count } of values) {
      const label = g.fmt ? g.fmt(value) : value;
      // Chip Phe gắn class màu theo phe.
      const fcls = g.key === "factions" && FACTION_CODE[value] ? ` f-${FACTION_CODE[value]}` : "";
      const btn = el("button", { class: `fchip${fcls}`, type: "button" }, `${label} (${count})`);
      btn.addEventListener("click", () => {
        btn.classList.toggle("on");
        state[g.key].has(value) ? state[g.key].delete(value) : state[g.key].add(value);
        rerender();
      });
      chips.append(btn);
    }
    panel.append(el("div", { class: "fgroup" }, [el("div", { class: "flabel" }, g.label), chips]));
  }

  for (const g of COMBO_GROUPS) {
    panel.append(buildCombo(g));
  }

  $("#clear-filters").addEventListener("click", clearAll);
  $("#search").addEventListener("input", (e) => {
    state.query = e.target.value;
    rerender();
  });
}

function buildCombo(g) {
  const values = FACETS[g.facet] || [];
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
    const matches = values.filter((x) => x.value.toLowerCase().includes(nq)).slice(0, 12);
    for (const { value, count } of matches) {
      const item = el("button", { class: "combo-item", type: "button" }, `${value} (${count})`);
      item.addEventListener("click", () => {
        state[g.key].add(value);
        input.value = "";
        list.replaceChildren();
        renderSelected();
        rerender();
      });
      list.append(item);
    }
  }
  input.addEventListener("input", () => renderList(input.value));
  input.addEventListener("focus", () => renderList(input.value));
  input.addEventListener("blur", () => setTimeout(() => list.replaceChildren(), 150));

  return el("div", { class: "fgroup combo" }, [el("div", { class: "flabel" }, g.label), input, list, selected]);
}

function clearAll() {
  for (const k of Object.keys(state)) {
    if (state[k] instanceof Set) state[k].clear();
  }
  state.query = "";
  $("#search").value = "";
  buildFilterUI();
  rerender();
}

/* ---------- Render ---------- */
function onTag(value) {
  state.query = value;
  $("#search").value = value;
  window.scrollTo({ top: 0, behavior: "smooth" });
  rerender();
}

function rerender() {
  const filtered = applyFilters(TEAMS, state);
  const grid = $("#team-grid");
  grid.replaceChildren();
  if (!filtered.length) {
    grid.append(el("p", { class: "empty" }, "Không có team nào khớp bộ lọc."));
  } else {
    const frag = document.createDocumentFragment();
    for (const t of filtered) frag.append(teamCard(t, onTag));
    grid.append(frag);
  }
  $("#stats").textContent = `${filtered.length} / ${TEAMS.length} team`;
}

/* ---------- Mobile drawer ---------- */
function initDrawer() {
  filterDrawer = createMobileFilterDrawer({
    panel: $("#filter-panel"),
    overlay: $("#filter-overlay"),
    toggle: $("#filter-toggle"),
    closeButtons: [...document.querySelectorAll(".filter-close, .filter-apply")],
    backgroundElements: [...document.querySelectorAll(".site-header, .section-nav, #mobile-filter-actions, .content, .site-footer")],
    onOpen: () => sectionMenu?.close(),
    mobileMedia: matchMedia("(max-width: 820px)"),
  });
}

/* ---------- Boot ---------- */
async function main() {
  initTheme();
  initNav();
  initDrawer();
  try {
    const [teams, facets, coexist, khaihoang, tactics, heroesDict, booksDict] = await Promise.all([
      loadJSON("./data/teams.json"),
      loadJSON("./data/facets.json"),
      loadJSON("./data/coexist.json"),
      loadJSON("./data/khaihoang.json"),
      loadJSON("./data/tactics.json"),
      loadJSON("./data/heroes-dict.json"),
      loadJSON("./data/books-dict.json"),
    ]);
    TEAMS = teams;
    FACETS = facets;
    buildFilterUI();
    rerender();
    $("#section-coexist").append(...coexist.map(coexistGroup));
    $("#section-khaihoang").append(khaihoangTable(khaihoang));
    initTactics(tactics, $("#section-tactics"));
    // Mở team giống từ kết quả soi đội -> về tab Team PK, search tên tướng đầu.
    const onOpenTeam = (team) => {
      const first = team.heroes?.[0]?.baseName;
      switchSection("team-pk");
      if (first) onTag(first);
    };
    initAnalyze({ teams, heroesDict, tacticsDict: tactics, booksDict, onOpenTeam }, $("#section-analyze"));
  } catch (err) {
    $("#team-grid").append(el("p", { class: "error" }, "Lỗi tải dữ liệu: " + err.message + ". Hãy chạy qua http server (python3 -m http.server)."));
  }
}

main();
