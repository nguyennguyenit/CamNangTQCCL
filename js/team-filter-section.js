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
  const { mount, teams, tierIndex, intro, unitWord = "đội", sort, groups } = opts;
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
    const btn = el("button", { class: "fchip recommend", type: "button" }, `★ ${g.label} (${count})`);
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
