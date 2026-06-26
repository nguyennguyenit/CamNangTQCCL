// Tab Đô Úy (ss18): filter bar inline + grid riêng. Dùng lại applyFilters/teamCard.
// Khác Team PK ở chỗ có lọc theo Tier (T0/T0.5/T1) và Khuyến nghị; facets tính từ
// chính tập team do-uy (FACETS chung cố ý loại do-uy).

import { applyFilters, emptyState } from "./filters.js";
import { bestTier, el, FACTION_CODE, teamCard } from "./render.js";

/** Đếm distinct + count cho 1 trường, trả mảng {value,count} sort theo count desc. */
function facetCount(teams, pick) {
  const c = new Map();
  for (const t of teams) {
    for (const v of pick(t)) c.set(v, (c.get(v) || 0) + 1);
  }
  return [...c.entries()].map(([value, count]) => ({ value, count }));
}

/** Tier rank để sort (T0 -> T1 -> ...; không tier xuống cuối). */
function tierRankVal(tier) {
  return tier ? parseFloat(tier.slice(1)) : Infinity;
}

export function initDoUy({ teams, tierIndex, onTag, mount }) {
  // Gắn tierBest runtime để applyFilters lọc theo tier.
  const doTeams = teams
    .filter((t) => t.source === "do-uy")
    .map((t) => {
      t.tierBest = bestTier(tierIndex.get(t.id));
      return t;
    });

  const state = emptyState();

  // Facets riêng cho do-uy.
  const facUnit = facetCount(doTeams, (t) => t.unitType || []);
  const facFaction = facetCount(doTeams, (t) => (t.faction ? [t.faction] : []));
  const facTier = facetCount(doTeams, (t) => (t.tierBest ? [t.tierBest] : []))
    .sort((a, b) => tierRankVal(a.value) - tierRankVal(b.value));
  const recommendedCount = doTeams.filter((t) => t.recommended).length;
  const facHero = facetCount(doTeams, (t) => t.heroes.flatMap((h) => [h.baseName, ...(h.alternatives || [])]));
  const facTactic = facetCount(doTeams, (t) => t.heroes.flatMap((h) => (h.tactics || []).flatMap((g) => [g.name, ...(g.alternatives || [])])));
  const facBook = facetCount(doTeams, (t) => t.heroes.flatMap((h) => (h.books || []).flatMap((g) => [g.name, ...(g.alternatives || [])])));

  const grid = el("div", { class: "team-grid" });
  const stats = el("span", { class: "stats" }, "");

  function rerender() {
    const filtered = applyFilters(doTeams, state)
      .slice()
      .sort((a, b) => tierRankVal(a.tierBest) - tierRankVal(b.tierBest));
    grid.replaceChildren();
    if (!filtered.length) {
      grid.append(el("p", { class: "empty" }, "Không có đội nào khớp bộ lọc."));
    } else {
      const frag = document.createDocumentFragment();
      for (const t of filtered) frag.append(teamCard(t, onTag, tierIndex.get(t.id)));
      grid.append(frag);
    }
    stats.textContent = `${filtered.length} / ${doTeams.length} đội`;
  }

  // --- Chip group (multi-select OR). ---
  function chipGroup(label, values, key, fmt, fcls) {
    if (!values.length) return null;
    const chips = el("div", { class: "chip-row" });
    for (const { value, count } of values) {
      const cls = `fchip${fcls ? fcls(value) : ""}`;
      const btn = el("button", { class: cls, type: "button" }, `${fmt ? fmt(value) : value} (${count})`);
      btn.addEventListener("click", () => {
        btn.classList.toggle("on");
        state[key].has(value) ? state[key].delete(value) : state[key].add(value);
        rerender();
      });
      chips.append(btn);
    }
    return el("div", { class: "fgroup" }, [el("div", { class: "flabel" }, label), chips]);
  }

  // Chip Khuyến nghị (toggle đơn).
  function recommendChip() {
    if (!recommendedCount) return null;
    const btn = el("button", { class: "fchip recommend", type: "button" }, `★ Khuyến nghị (${recommendedCount})`);
    btn.addEventListener("click", () => {
      btn.classList.toggle("on");
      state.recommended.has(true) ? state.recommended.delete(true) : state.recommended.add(true);
      rerender();
    });
    return el("div", { class: "fgroup" }, [el("div", { class: "flabel" }, "Đề cử"), el("div", { class: "chip-row" }, btn)]);
  }

  // --- Combo (autocomplete, multi-select). ---
  function comboGroup(label, values, key) {
    if (!values.length) return null;
    const input = el("input", { class: "combo-input", type: "text", placeholder: `Tìm ${label.toLowerCase()}…`, autocomplete: "off" });
    const list = el("div", { class: "combo-list" });
    const selected = el("div", { class: "combo-selected" });
    function renderSelected() {
      selected.replaceChildren();
      for (const v of state[key]) {
        const tag = el("button", { class: "sel-tag", type: "button" }, `${v} ✕`);
        tag.addEventListener("click", () => { state[key].delete(v); renderSelected(); rerender(); });
        selected.append(tag);
      }
    }
    function renderList(q) {
      list.replaceChildren();
      const nq = q.toLowerCase();
      for (const { value, count } of values.filter((x) => x.value.toLowerCase().includes(nq)).slice(0, 12)) {
        const item = el("button", { class: "combo-item", type: "button" }, `${value} (${count})`);
        item.addEventListener("click", () => { state[key].add(value); input.value = ""; list.replaceChildren(); renderSelected(); rerender(); });
        list.append(item);
      }
    }
    input.addEventListener("input", () => renderList(input.value));
    input.addEventListener("focus", () => renderList(input.value));
    input.addEventListener("blur", () => setTimeout(() => list.replaceChildren(), 150));
    return el("div", { class: "fgroup combo" }, [el("div", { class: "flabel" }, label), input, list, selected]);
  }

  const search = el("input", { class: "search", type: "search", placeholder: "🔍 Tìm tướng, chiến pháp, binh thư…" });
  search.addEventListener("input", (e) => { state.query = e.target.value; rerender(); });
  const clearBtn = el("button", { class: "clear-btn", type: "button" }, "Xóa lọc");

  const filters = el("div", { class: "do-uy-filters" }, [
    chipGroup("Loại binh", facUnit, "unitTypes"),
    chipGroup("Phe", facFaction, "factions", null, (v) => (FACTION_CODE[v] ? ` f-${FACTION_CODE[v]}` : "")),
    chipGroup("Tier", facTier, "tiers"),
    recommendChip(),
    comboGroup("Tướng", facHero, "heroes"),
    comboGroup("Chiến pháp", facTactic, "tactics"),
    comboGroup("Binh thư", facBook, "books"),
  ].filter(Boolean));

  clearBtn.addEventListener("click", () => {
    for (const k of Object.keys(state)) if (state[k] instanceof Set) state[k].clear();
    state.query = "";
    search.value = "";
    filters.querySelectorAll(".fchip.on").forEach((b) => b.classList.remove("on"));
    filters.querySelectorAll(".combo-selected").forEach((s) => s.replaceChildren());
    rerender();
  });

  mount.replaceChildren(
    el("div", { class: "section-intro" }, [
      el("h2", { class: "section-intro-title" }, "Team Đô Úy (ss18)"),
      el("p", { class: "section-intro-sub" }, `${doTeams.length} đội — meta đội hình Đô Úy, lọc theo loại binh / phe / tier / khuyến nghị.`),
    ]),
    el("div", { class: "do-uy-filter-bar" }, [
      el("div", { class: "filter-bar" }, [search, clearBtn, stats]),
      filters,
    ]),
    grid,
  );
  rerender();
}
