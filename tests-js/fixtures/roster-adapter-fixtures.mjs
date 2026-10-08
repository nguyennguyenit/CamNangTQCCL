// Fixtures của adapter Gợi ý kho (`recommendRoster`) dùng chung cho test web và test parity MCP
// (`tqccl_recommend_teams`). Mọi fixture suy từ bản ghi thật của generation Recommended đang pin
// (`src/data/recommended-reference/`) + từ điển (`data/`); không có số liệu bịa ngoài các `usage` ghi rõ.
import { readFileSync } from "node:fs";
import { buildSeasonCandidates, seasonTacticUsage } from "../../js/roster-season-candidates.js";
import { canonicalHeroId } from "../../js/hero-identity.js";

const read = (path) => JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"));

let cache = null;
/** Dữ liệu thật dùng chung: bản ghi Recommended, hai từ điển, đội cũ + bậc đội cũ. */
export function realData() {
  if (cache) return cache;
  const { generationId } = read("src/data/recommended-reference/current.json");
  cache = {
    records: read(`src/data/recommended-reference/${generationId}/index.json`).records,
    heroesDict: read("data/heroes-dict.json"),
    tacticsDict: read("data/tactics.json"),
    legacyTeams: read("data/teams.json"),
    legacyTier: read("data/team-tier.json"),
  };
  return cache;
}

/** Đội mùa dựng từ toàn bộ bản ghi thật của mùa, hoặc chỉ từ các `configIds` (fixture tối thiểu). */
export function seasonFrom(seasonId, configIds = null) {
  const { records, heroesDict, tacticsDict } = realData();
  const picked = configIds ? records.filter((r) => configIds.includes(r.sourceConfigId)) : records;
  const built = buildSeasonCandidates(picked, seasonId, { heroesDict, tacticsDict });
  return { ...built, usage: seasonTacticUsage(built.teams) };
}

export const tierRank = (tier) => ({ T0: 0, "T0.5": 1, T1: 2, "T1.5": 3, T2: 4, T3: 5 })[tier] ?? 9;

/** Kho sở hữu đúng tài nguyên (không cần bản thay) của các đội: tên Việt, bỏ ô chưa đối chiếu. */
export function rosterOf(teams, { skipTactics = [] } = {}) {
  const skip = new Set(skipTactics);
  const heroes = new Set();
  const tactics = new Set();
  for (const team of teams) {
    for (const hero of team.heroes) {
      heroes.add(hero.name);
      for (const tactic of hero.tactics) if (!tactic.unresolved && !skip.has(tactic.name)) tactics.add(tactic.name);
    }
  }
  return { ownedHeroes: [...heroes], ownedTactics: [...tactics] };
}

/**
 * Kiểm độc lập (không qua engine): mọi tướng và chiến pháp đã đối chiếu của đội đều có trong kho và không
 * trùng nhau (một tướng/chiến pháp chỉ lắp được một chỗ; vài đội nguồn lặp món nên không bao giờ xây được).
 */
export function buildableBy(team, { ownedHeroes, ownedTactics }) {
  const heroes = new Set(ownedHeroes);
  const tactics = new Set(ownedTactics);
  const heroNames = team.heroes.map((h) => h.name);
  const tacticNames = team.heroes.flatMap((h) => h.tactics.filter((t) => !t.unresolved).map((t) => t.name));
  return new Set(heroNames).size === heroNames.length
    && new Set(tacticNames).size === tacticNames.length
    && heroNames.every((name) => heroes.has(name))
    && tacticNames.every((name) => tactics.has(name));
}

/** Hai đội dùng chung tướng hoặc chiến pháp? */
const overlaps = (a, b) => {
  const heroes = new Set(a.heroes.map((h) => canonicalHeroId(h.name)));
  const tactics = new Set(a.heroes.flatMap((h) => h.tactics.map((t) => t.name)));
  return b.heroes.some((h) => heroes.has(canonicalHeroId(h.name)) || h.tactics.some((t) => tactics.has(t.name)));
};

/**
 * Probe "kho chỉ dựng được đội xếp sau": mùa `seasonId`, sắp theo bậc rồi id như engine; `metaOnly` giới hạn
 * T0/T0.5/T1 (chế độ Meta), ngược lại mọi bậc (chế độ Nhiều hột, hột bằng nhau). Lấy `count` đội dựng được,
 * KHÔNG chung tài nguyên, từ thứ hạng `fromRank` trở đi; kho = đúng tài nguyên của chúng.
 * Cắt pool trước khi kiểm kho (lỗi 1) làm các đội này biến mất.
 */
export function deepRankProbe(seasonId, fromRank, count = 3, { metaOnly = true } = {}) {
  const season = seasonFrom(seasonId);
  const tierOf = new Map(season.teamTier.map((e) => [e.teamId, e.rankings[0]?.tier || ""]));
  const pool = season.teams
    .filter((t) => !metaOnly || ["T0", "T0.5", "T1"].includes(tierOf.get(t.id)))
    .sort((a, b) => tierRank(tierOf.get(a.id)) - tierRank(tierOf.get(b.id)) || String(a.id).localeCompare(String(b.id)));
  const picks = [];
  for (const team of pool.slice(fromRank)) {
    if (!buildableBy(team, rosterOf([team]))) continue;
    if (picks.every((p) => !overlaps(p, team))) picks.push(team);
    if (picks.length === count) break;
  }
  return { season, poolSize: pool.length, picks, roster: rosterOf(picks) };
}

/** Món bù cho tướng `heroName` ngoài dữ liệu mùa (ghi rõ khi một fixture cần): cộng vào `usage` bản sao. */
export function withUsage(usage, heroName, tactics) {
  const next = new Map([...usage].map(([id, counts]) => [id, new Map(counts)]));
  const id = canonicalHeroId(heroName);
  const counts = next.get(id) || new Map();
  for (const [name, count] of Object.entries(tactics)) counts.set(name, (counts.get(name) || 0) + count);
  next.set(id, counts);
  return next;
}

export const FIXTURE_IDS = {
  unresolvedSlot: "s28-wutugu-huangma", // pk-s28, ô 御敵屏障 không có trong từ điển chiến pháp
  troopRules: "team-1imndp3", // pk-s24, khiên; Lưu Bị mang Phi Hùng Quân (kỵ) + Phong Thi Trận ở cấu hình khác
  troopKy: "team-831163", // pk-s24, kỵ, đã có Phi Hùng Quân
  unitMissing: "team-epoddo", // pk-s24, thiếu unitTypesRaw
};
