// Tab Meta cũ (phe): các team meta phe cũ (source "moi-phe"), tách khỏi Team PK.
// Bộ lọc inline giống Team PK (loại binh / phe / tướng / chiến pháp / binh thư);
// facets tính từ chính tập team moi-phe.

import { FACTION_CODE } from "./render.js";
import { createTeamFilterSection } from "./team-filter-section.js";

export function initMetaCu({ teams, tierIndex, mount }) {
  const metaTeams = teams.filter((t) => t.source === "moi-phe");

  return createTeamFilterSection({
    mount,
    teams: metaTeams,
    tierIndex,
    unitWord: "team",
    intro: {
      title: "Team Meta phe (cũ)",
      sub: (n) => `${n} team meta phe các mùa cũ — tham khảo, lọc theo loại binh / phe (tìm tướng, chiến pháp, binh thư bằng ô tìm kiếm).`,
    },
    groups: [
      { type: "chip", label: "Loại binh", key: "unitTypes", pick: (t) => t.unitType || [] },
      { type: "chip", label: "Phe", key: "factions", pick: (t) => (t.faction ? [t.faction] : []), fcls: (v) => (FACTION_CODE[v] ? ` f-${FACTION_CODE[v]}` : "") },
    ],
  });
}
