// Điều phối: load JSON, section nav, render, theme. Vanilla ES module.
// Cả 3 tab team (Team PK / Đô Úy / Meta cũ) dùng chung filter inline qua
// createTeamFilterSection — không còn sidebar drawer riêng.

import { coexistGroup, el, khaihoangTable } from "./render.js";
import { initTactics } from "./tactics.js";
import { initTeamPk } from "./team-pk.js";
import { initDoUy } from "./do-uy.js";
import { initMetaCu } from "./meta-cu.js";
import { initHeroList } from "./hero-list.js";
import { initAnalyze } from "./analyze.js";
import { initRecruitTracker } from "./recruit-tracker.js";
import { createMobileSectionMenu } from "./mobile-section-menu.js";

let sectionMenu = null;

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
const SECTIONS = ["team-pk", "do-uy", "meta-cu", "coexist", "khaihoang", "heroes", "tactics", "recruit-tracker", "analyze"];
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
  if (sectionFromHash() !== name) location.hash = name;
}

/* ---------- Boot ---------- */
async function main() {
  initTheme();
  initNav();
  try {
    const [teams, coexist, khaihoang, tactics, heroesDict, booksDict] = await Promise.all([
      loadJSON("./data/teams.json"),
      loadJSON("./data/coexist.json"),
      loadJSON("./data/khaihoang.json"),
      loadJSON("./data/tactics.json"),
      loadJSON("./data/heroes-dict.json"),
      loadJSON("./data/books-dict.json"),
    ]);
    const teamTier = await loadOptionalJSON("./data/team-tier.json", []);
    const tierIndex = new Map(teamTier.map((r) => [r.teamId, r.rankings]));

    const sections = {
      "team-pk": initTeamPk({ teams, tierIndex, heroesDict, mount: $("#section-team-pk") }),
      "do-uy": initDoUy({ teams, tierIndex, mount: $("#section-do-uy") }),
      "meta-cu": initMetaCu({ teams, tierIndex, mount: $("#section-meta-cu") }),
    };

    $("#section-coexist").append(...coexist.map(coexistGroup));
    $("#section-khaihoang").append(khaihoangTable(khaihoang));
    initHeroList(heroesDict, tactics, $("#section-heroes"));
    initTactics(tactics, $("#section-tactics"));
    initRecruitTracker({ heroesDict, mount: $("#section-recruit-tracker") });

    // Mở team giống từ kết quả soi đội -> về đúng tab theo nguồn + search tên tướng đầu.
    const SOURCE_SECTION = { "do-uy": "do-uy", "moi-phe": "meta-cu", "team-intro": "team-pk" };
    const onOpenTeam = (team) => {
      const name = SOURCE_SECTION[team.source] || "team-pk";
      switchSection(name);
      const first = team.heroes?.[0]?.baseName;
      if (first) sections[name]?.setSearch(first);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    initAnalyze({ teams, heroesDict, tacticsDict: tactics, booksDict, onOpenTeam }, $("#section-analyze"));
  } catch (err) {
    $("#section-team-pk").append(el("p", { class: "error" }, "Lỗi tải dữ liệu: " + err.message + ". Hãy chạy qua http server (python3 -m http.server)."));
  }
}

main();
