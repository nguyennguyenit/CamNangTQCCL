// Suy quốc gia (phe) cho team từ tướng trong đội. Team "giới thiệu" (team-intro)
// không có sẵn trường faction nên Team PK phân loại theo phe bằng cách lấy phe
// chiếm đa số trong 3 tướng; không có đa số -> "Hỗn hợp". Pure, không deps DOM.

/** Map tên tướng (viet/hanViet/chinese) -> phe, từ heroes-dict. */
export function buildHeroFactionIndex(heroesDict) {
  const idx = new Map();
  for (const h of heroesDict) {
    if (!h.faction) continue;
    for (const key of [h.viet, h.hanViet, h.chinese]) {
      if (key && !idx.has(key)) idx.set(key, h.faction);
    }
  }
  return idx;
}

/** Phe đa số của 1 team theo baseName các tướng. Không khớp tướng nào -> null. */
export function dominantFaction(team, index) {
  const counts = new Map();
  let matched = 0;
  for (const hero of team.heroes || []) {
    const f = index.get(hero.baseName);
    if (!f) continue;
    matched++;
    counts.set(f, (counts.get(f) || 0) + 1);
  }
  if (!matched) return null;
  let top = null, topN = 0;
  for (const [f, n] of counts) {
    if (n > topN) { top = f; topN = n; }
  }
  // Phải quá bán mới gán phe, còn lại coi là Hỗn hợp.
  return topN > matched / 2 ? top : "Hỗn hợp";
}

/** Gán faction suy ra cho các team chưa có (mutate tại chỗ). Trả về chính teams. */
export function assignDerivedFactions(teams, heroesDict) {
  const index = buildHeroFactionIndex(heroesDict);
  for (const t of teams) {
    if (!t.faction) {
      const f = dominantFaction(t, index);
      if (f) t.faction = f;
    }
  }
  return teams;
}
