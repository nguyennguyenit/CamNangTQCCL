// Tab Đô Úy (ss18): dùng section filter inline chung, thêm lọc Tier + Khuyến nghị.
// Facets tính từ chính tập team do-uy (FACETS chung cố ý loại do-uy).

import { bestTier, FACTION_CODE } from "./render.js";
import { createTeamFilterSection } from "./team-filter-section.js";

/** Tier rank để sort (T0 -> T1 -> ...; không tier xuống cuối). */
function tierRankVal(tier) {
  return tier ? parseFloat(tier.slice(1)) : Infinity;
}

export function initDoUy({ teams, tierIndex, mount }) {
  // Gắn tierBest runtime để applyFilters lọc theo tier.
  const doTeams = teams
    .filter((t) => t.source === "do-uy")
    .map((t) => {
      t.tierBest = bestTier(tierIndex.get(t.id));
      return t;
    });

  return createTeamFilterSection({
    mount,
    teams: doTeams,
    tierIndex,
    unitWord: "đội",
    intro: {
      title: "Team Đô Úy (ss18)",
      sub: (n) => `${n} đội — meta đội hình Đô Úy, lọc theo loại binh / phe / tier / khuyến nghị.`,
    },
    sort: (filtered) => filtered.sort((a, b) => tierRankVal(a.tierBest) - tierRankVal(b.tierBest)),
    groups: [
      { type: "chip", label: "Loại binh", key: "unitTypes", pick: (t) => t.unitType || [] },
      { type: "chip", label: "Phe", key: "factions", pick: (t) => (t.faction ? [t.faction] : []), fcls: (v) => (FACTION_CODE[v] ? ` f-${FACTION_CODE[v]}` : "") },
      { type: "chip", label: "Tier", key: "tiers", pick: (t) => (t.tierBest ? [t.tierBest] : []), sortValues: (a, b) => tierRankVal(a.value) - tierRankVal(b.value) },
      { type: "recommend", label: "Khuyến nghị", key: "recommended" },
    ],
  });
}
