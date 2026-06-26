// Bộ lọc Team PK — pure functions, dùng được cả browser lẫn node test (0 deps).

/** Bỏ dấu tiếng Việt + lowercase để search/so khớp không phân biệt dấu. */
export function normalizeText(s) {
  return (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

/** Gom mọi tên chiến pháp/binh thư của 1 tướng (name + alternatives). */
function tacticNames(hero) {
  return (hero.tactics || []).flatMap((g) => [g.name, ...(g.alternatives || [])]);
}
function bookNames(hero) {
  return (hero.books || []).flatMap((g) => [g.name, ...(g.alternatives || [])]);
}

/** Văn bản phẳng của team để search toàn văn (đã normalize). */
export function teamSearchBlob(team) {
  const parts = [team.rawType, team.notes || "", team.faction || "", team.name || "", team.nickname || ""];
  for (const h of team.heroes) {
    parts.push(h.name, ...(h.alternatives || []), ...tacticNames(h), ...bookNames(h));
  }
  parts.push(...(team.counters?.good || []), ...(team.counters?.avoid || []));
  return normalizeText(parts.join(" "));
}

/** Một set rỗng = không lọc theo nhóm đó. */
function matchSet(set, values) {
  if (!set || set.size === 0) return true;
  return values.some((v) => set.has(v));
}

/**
 * Lọc danh sách team theo state.
 * state: { stars:Set, unitTypes:Set, statuses:Set, factions:Set,
 *          heroes:Set, tactics:Set, books:Set, query:string }
 * AND giữa các nhóm; OR trong cùng nhóm.
 */
export function applyFilters(teams, state) {
  const q = normalizeText(state.query || "");
  return teams.filter((team) => {
    if (!matchSet(state.stars, team.stars != null ? [String(team.stars)] : [])) return false;
    if (!matchSet(state.unitTypes, team.unitType || [])) return false;
    if (!matchSet(state.statuses, [team.status])) return false;
    if (!matchSet(state.factions, team.faction ? [team.faction] : [])) return false;
    if (!matchSet(state.sources, team.source ? [team.source] : [])) return false;
    // tier (Đô Úy): team.tierBest gắn runtime; rỗng -> không lọc.
    if (!matchSet(state.tiers, team.tierBest ? [team.tierBest] : [])) return false;
    // Khuyến nghị: bật bộ lọc này thì chỉ giữ team có cờ recommended.
    if (state.recommended && state.recommended.size && !team.recommended) return false;

    const heroNames = team.heroes.flatMap((h) => [h.baseName, ...(h.alternatives || [])]);
    if (!matchSet(state.heroes, heroNames)) return false;

    const allTactics = team.heroes.flatMap(tacticNames);
    if (!matchSet(state.tactics, allTactics)) return false;

    const allBooks = team.heroes.flatMap(bookNames);
    if (!matchSet(state.books, allBooks)) return false;

    if (q && !teamSearchBlob(team).includes(q)) return false;
    return true;
  });
}

/** Tạo state rỗng. */
export function emptyState() {
  return {
    stars: new Set(),
    unitTypes: new Set(),
    statuses: new Set(),
    factions: new Set(),
    sources: new Set(),
    heroes: new Set(),
    tactics: new Set(),
    books: new Set(),
    tiers: new Set(),
    recommended: new Set(),
    query: "",
  };
}
