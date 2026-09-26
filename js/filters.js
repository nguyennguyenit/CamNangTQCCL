// Chuẩn hoá chữ (bỏ dấu) và blob tìm kiếm của một đội — pure functions, dùng chung cho website và MCP (0 deps).

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
