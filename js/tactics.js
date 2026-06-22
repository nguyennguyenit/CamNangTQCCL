// Section "Tra cứu chiến pháp" — search đa ngõ vào (Việt bỏ dấu / Hán-Việt / Hán)
// + lọc loại/chất lượng. Dùng searchDict (match-dict.js) + el (render.js). 0 dep.

import { el } from "./render.js";
import { searchDict } from "./match-dict.js";

const QUALITY_ORDER = ["S", "A", "B"];

/** Card 1 chiến pháp (DOM-safe). */
export function tacticCard(t) {
  const head = el("div", { class: "tac-head" }, [
    el("span", { class: "tac-viet" }, t.viet),
    t.quality ? el("span", { class: `tac-q q-${t.quality}` }, t.quality) : null,
  ]);

  const sub = el("div", { class: "tac-sub" }, [
    t.chinese ? el("span", { class: "tac-cn" }, t.chinese) : null,
    t.hanViet && t.hanViet !== t.viet ? el("span", { class: "tac-hv" }, t.hanViet) : null,
  ]);

  const meta = el("div", { class: "tac-meta" }, [
    t.type ? el("span", { class: "tac-type" }, t.type) : null,
    ...(t.troopFit || []).map((u) => el("span", { class: "tac-troop" }, u)),
  ]);

  const desc = t.pending
    ? el("p", { class: "tac-desc pending" }, "⏳ Đang cập nhật")
    : el("p", { class: "tac-desc" }, t.effect || "");

  return el("div", { class: "tac-card" }, [head, sub, meta, desc]);
}

/** Khởi tạo section: dựng thanh search + lọc + lưới kết quả vào `mount`. */
export function initTactics(dict, mount) {
  const state = { query: "", types: new Set(), qualities: new Set() };

  const types = [...new Set(dict.map((t) => t.type).filter(Boolean))];
  const qualities = QUALITY_ORDER.filter((q) => dict.some((t) => t.quality === q));

  const search = el("input", {
    class: "tac-search", type: "search",
    placeholder: "🔍 Gõ tên Việt (bỏ dấu), Hán-Việt, hoặc dán chữ Hán…", autocomplete: "off",
  });
  const typeRow = el("div", { class: "tac-chips" });
  const qualRow = el("div", { class: "tac-chips" });
  const grid = el("div", { class: "tac-grid" });
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
  types.forEach((t) => chip(t, state.types, t, typeRow));
  qualities.forEach((q) => chip(`Chất ${q}`, state.qualities, q, qualRow));

  function render() {
    // Lọc loại/chất trước, fuzzy-search trên tập đã lọc.
    const pool = dict.filter(
      (t) =>
        (state.types.size === 0 || state.types.has(t.type)) &&
        (state.qualities.size === 0 || state.qualities.has(t.quality)),
    );
    const results = searchDict(state.query, pool);
    grid.replaceChildren();
    if (!results.length) {
      grid.append(el("p", { class: "empty" }, "Không tìm thấy chiến pháp khớp."));
    } else {
      const frag = document.createDocumentFragment();
      for (const { record } of results) frag.append(tacticCard(record));
      grid.append(frag);
    }
    count.textContent = `${results.length} / ${dict.length} chiến pháp`;
  }

  search.addEventListener("input", (e) => {
    state.query = e.target.value;
    render();
  });

  mount.replaceChildren(
    el("div", { class: "tac-toolbar" }, [
      search,
      el("div", { class: "tac-filter-row" }, [typeRow, qualRow]),
      count,
    ]),
    grid,
  );
  render();
}
