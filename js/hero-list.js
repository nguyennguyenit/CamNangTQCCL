// Section "Tra cứu tướng" — mirror pattern tactics.js: search đa ngõ vào
// (searchDict) + chip lọc (binh chủng thích tính / vai trò / phe / sao) + grid
// card; click card -> modal chi tiết. Filter tách thuần (test riêng). 0 dep.

import { el } from "./render.js";
import { searchDict } from "./match-dict.js";
import { heroDetailModal } from "./hero-detail.js";

const APT_GOOD = new Set(["S", "A"]);
const TROOP_FILTERS = [
  ["ky", "Kỵ"], ["thuan", "Thuẫn"], ["cung", "Cung"],
  ["thuong", "Thương"], ["khiGioi", "Khí giới"],
];

function matchSet(value, set) {
  return !set || set.size === 0 || set.has(value);
}

/**
 * Lọc tướng. Trong nhóm OR, giữa nhóm AND. Troop: đạt nếu thích tính 1 trong
 * các binh chủng đã chọn là S/A. Hàm thuần (test riêng).
 */
export function filterHeroes(heroes, { troops, roles, factions, stars } = {}) {
  return heroes.filter((h) => {
    const troopOk = !troops || troops.size === 0 ||
      [...troops].some((k) => APT_GOOD.has((h.troopApt || {})[k]));
    return troopOk &&
      matchSet(h.roleTagViet, roles) &&
      matchSet(h.faction, factions) &&
      matchSet(String(h.stars), stars);
  });
}

function aptBadges(apt) {
  // Chỉ hiện binh chủng đạt S/A (gọn card).
  return el("div", { class: "hc-apt" }, TROOP_FILTERS.flatMap(([k, label]) => {
    const v = (apt || {})[k];
    return APT_GOOD.has(v)
      ? [el("span", { class: `apt apt-${v.toLowerCase()}` }, `${label} ${v}`)]
      : [];
  }));
}

function heroCard(hero, onOpen) {
  const fcode = { "Ngụy": "nguy", "Thục": "thuc", "Ngô": "ngo", "Quần": "quan" }[hero.faction];
  const card = el("button", { class: "hero-card", type: "button" }, [
    hero.iconUrl ? el("img", { class: "hc-icon", src: hero.iconUrl, alt: hero.hanViet, loading: "lazy" }) : null,
    el("div", { class: "hc-body" }, [
      el("div", { class: "hc-name" }, [
        hero.isSP ? el("span", { class: "pre sp" }, "SP") : null,
        hero.hanViet,
      ].filter(Boolean)),
      el("div", { class: "hc-badges" }, [
        hero.faction ? el("span", { class: `badge faction${fcode ? " f-" + fcode : ""}` }, hero.faction) : null,
        hero.stars != null ? el("span", { class: "badge stars" }, "★".repeat(hero.stars)) : null,
        hero.roleTagViet ? el("span", { class: "badge role" }, hero.roleTagViet) : null,
      ].filter(Boolean)),
      aptBadges(hero.troopApt),
    ]),
  ].filter(Boolean));
  card.addEventListener("click", () => onOpen(hero));
  return card;
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))];
}

/** Overlay modal dùng chung: click nền / Esc / nút × để đóng. */
function openModal(node) {
  const overlay = el("div", { class: "hero-overlay" }, [
    el("button", { class: "hero-overlay-close", type: "button", "aria-label": "Đóng" }, "✕"),
    node,
  ]);
  function close() {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
  }
  function onKey(e) { if (e.key === "Escape") close(); }
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  overlay.querySelector(".hero-overlay-close").addEventListener("click", close);
  document.addEventListener("keydown", onKey);
  document.body.append(overlay);
}

/** Khởi tạo section "Tra cứu tướng" vào `mount`. */
export function initHeroList(heroesDict, tacticsDict, mount) {
  const state = { query: "", troops: new Set(), roles: new Set(), factions: new Set(), stars: new Set() };

  const roles = uniqueSorted(heroesDict.map((h) => h.roleTagViet));
  const factions = uniqueSorted(heroesDict.map((h) => h.faction));
  const stars = uniqueSorted(heroesDict.map((h) => String(h.stars))).sort((a, b) => b - a);

  const search = el("input", {
    class: "tac-search", type: "search",
    placeholder: "🔍 Gõ tên Việt (bỏ dấu), Hán-Việt, hoặc dán chữ Hán…", autocomplete: "off",
  });
  const troopRow = el("div", { class: "tac-chips" });
  const roleRow = el("div", { class: "tac-chips" });
  const factionRow = el("div", { class: "tac-chips" });
  const starRow = el("div", { class: "tac-chips" });
  const grid = el("div", { class: "hero-grid" });
  const count = el("span", { class: "tac-count" });

  function chip(label, set, value, row) {
    const btn = el("button", { class: "fchip", type: "button" }, label);
    btn.addEventListener("click", () => {
      btn.classList.toggle("on");
      set.has(value) ? set.delete(value) : set.add(value);
      render();
    });
    row.append(btn);
  }
  TROOP_FILTERS.forEach(([k, label]) => chip(label, state.troops, k, troopRow));
  roles.forEach((r) => chip(r, state.roles, r, roleRow));
  factions.forEach((f) => chip(f, state.factions, f, factionRow));
  stars.forEach((s) => chip(`${s}★`, state.stars, s, starRow));

  function render() {
    const pool = filterHeroes(heroesDict, state);
    const results = searchDict(state.query, pool, { limit: heroesDict.length });
    grid.replaceChildren();
    if (!results.length) {
      grid.append(el("p", { class: "empty" }, "Không tìm thấy tướng khớp."));
    } else {
      const frag = document.createDocumentFragment();
      for (const { record } of results) {
        frag.append(heroCard(record, (h) => openModal(heroDetailModal(h, tacticsDict))));
      }
      grid.append(frag);
    }
    count.textContent = `${results.length} / ${heroesDict.length} tướng`;
  }

  search.addEventListener("input", (e) => {
    state.query = e.target.value;
    render();
  });

  mount.replaceChildren(
    el("div", { class: "tac-toolbar" }, [
      search,
      el("div", { class: "tac-filter-row" }, [
        el("div", { class: "fgroup-inline" }, [el("span", { class: "flabel-inline" }, "Thích tính"), troopRow]),
        el("div", { class: "fgroup-inline" }, [el("span", { class: "flabel-inline" }, "Vai trò"), roleRow]),
        el("div", { class: "fgroup-inline" }, [el("span", { class: "flabel-inline" }, "Phe"), factionRow]),
        el("div", { class: "fgroup-inline" }, [el("span", { class: "flabel-inline" }, "Sao"), starRow]),
      ]),
      count,
    ]),
    grid,
  );
  render();
}
