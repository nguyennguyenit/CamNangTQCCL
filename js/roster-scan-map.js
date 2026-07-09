import { matchDict } from "./match-dict.js";
import { toVietHanViet } from "./hanviet.js";

function mapName(cn, dict) {
  const m = matchDict(cn || "", dict || []);
  return {
    name: m.matched ? m.record.viet : toVietHanViet(cn || ""),
    confidence: m.matched ? m.confidence : "low",
  };
}

export function mapHeroesScan(result, { heroesDict }) {
  return {
    heroes: (result?.heroes || []).map((hero) => {
      const mapped = mapName(hero.nameCn || hero.name || "", heroesDict);
      const out = { name: mapped.name, confidence: mapped.confidence };
      if (Number.isFinite(hero.redStars)) out.redStars = hero.redStars;
      if (Number.isFinite(hero.level)) out.level = hero.level;
      return out;
    }).filter((h) => h.name),
  };
}

export function mapTacticsScan(result, { tacticsDict }) {
  return {
    tactics: (result?.tactics || []).map((tactic) => {
      const mapped = mapName(tactic.nameCn || tactic.name || "", tacticsDict);
      return { name: mapped.name, confidence: mapped.confidence };
    }).filter((t) => t.name),
  };
}

export function mapBuiltTeamsScan(result, { heroesDict, tacticsDict }) {
  return {
    teams: (result?.teams || []).map((team) => ({
      teamName: team.teamName || team.name || "Team đã build",
      heroes: (team.heroesCn || team.heroes || []).map((name) => mapName(name, heroesDict).name).filter(Boolean),
      tactics: (team.tacticsCn || team.tactics || []).map((name) => mapName(name, tacticsDict).name).filter(Boolean),
    })),
  };
}
