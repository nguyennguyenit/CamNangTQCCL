// Kho giả cho e2e của danh sách Đội chuẩn (máy có kho): đủ tướng và chiến pháp để ráp được một đội của mùa mặc định.
// Dữ liệu đọc từ generation đang pin, cùng nguồn với trang, nên kho luôn khớp mùa mặc định hiện hành.
import { readFileSync } from "node:fs";
import { buildSeasonCandidates } from "../../js/roster-season-candidates.js";

const read = (path) => JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"));
const { generationId } = read("src/data/recommended-reference/current.json");
const { records } = read(`src/data/recommended-reference/${generationId}/index.json`);
const { defaultSourceSeasonId } = read(`src/data/recommended-reference/${generationId}/seasons.json`);
const dicts = { heroesDict: read("data/heroes-dict.json"), tacticsDict: read("data/tactics.json") };

/** Khóa localStorage của kho trên máy (khách đọc kho từ đây, không cần phiên). */
export const ROSTER_SCAN_KEY = "tqccl.rosterRecommend.scanState.v1";

/** Kho vừa đủ ráp một đội của mùa mặc định (cùng cách dựng với `rosterFor` của bai-viet-kho-redesign.spec.mjs). */
export function rosterOfFirstTeam() {
  const [record] = records.filter((item) => item.sourceSeasonId === defaultSourceSeasonId);
  const { teams } = buildSeasonCandidates([record], defaultSourceSeasonId, dicts);
  const heroes = new Set();
  const tactics = new Set();
  for (const team of teams) {
    for (const hero of team.heroes) {
      heroes.add(hero.name);
      for (const tactic of hero.tactics) if (!tactic.unresolved) tactics.add(tactic.name);
    }
  }
  return { ownedHeroes: [...heroes].map((name) => ({ name })), ownedTactics: [...tactics].map((name) => ({ name })), lockedTeams: [], confirmed: true, updatedAt: "2026-11-11T00:00:00.000Z" };
}
