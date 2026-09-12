// Tab Team PK: 50 team giới thiệu (source "team-intro"). Cùng kiểu filter inline
// với Đô Úy / Meta cũ. Các nhóm chỉ 1 giá trị (trạng thái/nguồn/phe) tự ẩn.

import { FACTION_CODE, SOURCE_LABEL, STATUS_LABEL } from "./render.js";
import { createTeamFilterSection } from "./team-filter-section.js";
import { assignDerivedFactions } from "./derive-team-faction.js";

export function initTeamPk({ teams, tierIndex, heroesDict, mount }) {
  const pkTeams = teams.filter((t) => t.source === "team-intro");
  // team-intro không có sẵn phe -> suy quốc gia từ tướng để phân loại Ngụy/Thục/Ngô…
  assignDerivedFactions(pkTeams, heroesDict);

  return createTeamFilterSection({
    mount,
    teams: pkTeams,
    tierIndex,
    unitWord: "team",
    intro: {
      title: "Team PK",
      sub: (n) => `${n} team giới thiệu — lọc theo loại binh / phe (tìm tướng, chiến pháp, binh thư bằng ô tìm kiếm).`,
    },
    groups: [
      { type: "chip", label: "Loại binh", key: "unitTypes", pick: (t) => t.unitType || [] },
      { type: "chip", label: "Phe", key: "factions", pick: (t) => (t.faction ? [t.faction] : []), fcls: (v) => (FACTION_CODE[v] ? ` f-${FACTION_CODE[v]}` : "") },
      { type: "chip", label: "Trạng thái", key: "statuses", pick: (t) => (t.status ? [t.status] : []), fmt: (v) => STATUS_LABEL[v] || v },
      { type: "chip", label: "Nguồn", key: "sources", pick: (t) => (t.source ? [t.source] : []), fmt: (v) => SOURCE_LABEL[v] || v },
    ],
  });
}
