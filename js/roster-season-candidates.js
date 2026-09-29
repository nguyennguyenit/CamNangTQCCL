// Đội chuẩn theo mùa → ứng viên của engine Gợi ý đội, cùng dạng `data/teams.json`
// (`team.id` + `teamTier[{teamId, rankings}]`) nên engine không cần nhánh riêng.
import { canonicalHeroId, normalizeHeroSlot } from "./hero-identity.js";
import { canonicalTacticId, recommendTeams } from "./team-recommend-engine.js";

/** Chỉ cấu hình Giao chiến: Khai hoang có mục riêng và không dùng cho đội PK. */
const BATTLE_CATEGORY = "交戰";
const EMPTY_SLOTS = new Set(["", "—", "-"]);

const rawKey = (value) => (typeof value === "string" ? value.replace(/\s+/gu, "") : "");

/** Tên gốc chữ Hán (kể cả alias) → tên Việt chuẩn của từ điển, cùng dạng kho đã đọc lưu. */
function nameIndex(dict) {
  const index = new Map();
  for (const item of dict || []) {
    if (!item?.viet) continue;
    for (const name of [item.chinese, ...(item.aliases || [])]) {
      const key = rawKey(name);
      if (key && !index.has(key)) index.set(key, item.viet);
    }
  }
  return index;
}

function mapHero(source, heroNames, tacticNames, heroIndex, conditionalTactics) {
  const name = heroNames.get(rawKey(source.nameRaw));
  if (!name) return null;
  const tactics = [];
  (source.tacticSlotsRaw || []).forEach((raw, slotIndex) => {
    if (raw == null || EMPTY_SLOTS.has(raw.trim())) return;
    const tactic = source.tacticSlotKinds?.[slotIndex] === "tactic" ? tacticNames.get(rawKey(raw)) : null;
    if (tactic) tactics.push({ name: tactic, alternatives: [] });
    else conditionalTactics.push({ heroIndex, slotIndex, raw });
  });
  return { name, tactics };
}

export function buildSeasonCandidates(records, seasonId, { heroesDict, tacticsDict } = {}) {
  const heroNames = nameIndex(heroesDict);
  const tacticNames = nameIndex(tacticsDict);
  const teams = [];
  const teamTier = [];
  const unmapped = [];
  let total = 0;
  for (const record of records || []) {
    if (record?.sourceSeasonId !== seasonId || record.sourceCategoryId !== BATTLE_CATEGORY) continue;
    total++;
    const conditionalTactics = [];
    const heroes = (record.heroes || []).map((hero, index) => mapHero(hero, heroNames, tacticNames, index, conditionalTactics));
    if (heroes.length === 0 || heroes.includes(null)) {
      unmapped.push({
        configId: record.sourceConfigId,
        reason: "hero-unmapped",
        names: record.heroes.filter((_, index) => heroes[index] === null).map((hero) => hero.nameRaw),
      });
      continue;
    }
    const tier = record.tierRaw || "";
    teams.push({
      id: record.sourceConfigId,
      name: record.displayNameVi,
      source: "season",
      seasonId,
      tier,
      heroes,
      conditionalTactics,
    });
    teamTier.push({ teamId: record.sourceConfigId, rankings: tier ? [{ tier }] : [] });
  }
  return { teams, teamTier, diagnostics: { total, mapped: teams.length, unmapped } };
}

/** Tướng → (chiến pháp → số cấu hình cùng mùa mang nó); nguồn của món bù. */
export function seasonTacticUsage(teams) {
  const usage = new Map();
  for (const team of teams || []) {
    for (const hero of team.heroes || []) {
      const id = canonicalHeroId(hero.name);
      const counts = usage.get(id) || new Map();
      for (const tactic of hero.tactics || []) counts.set(tactic.name, (counts.get(tactic.name) || 0) + 1);
      usage.set(id, counts);
    }
  }
  return usage;
}

/**
 * Món bù người dùng đã chọn cho một ô thiếu: thêm vào `alternatives` của đúng ô đó nên engine chọn
 * nó như biến thể ("đã thay"). Không sửa dữ liệu gốc; ô/đội không còn tồn tại thì bỏ qua.
 */
export function applyTacticOverrides(teams, overrides = []) {
  const byTeam = new Map();
  for (const override of overrides || []) {
    const list = byTeam.get(override?.teamId) || [];
    list.push(override);
    byTeam.set(override?.teamId, list);
  }
  return (teams || []).map((team) => {
    const own = (byTeam.get(team.id) || []).filter((o) => team.heroes?.[o.heroIndex]?.tactics?.[o.slotIndex]);
    if (own.length === 0) return team;
    return {
      ...team,
      heroes: team.heroes.map((hero, heroIndex) => ({
        ...hero,
        tactics: (hero.tactics || []).map((slot, slotIndex) => {
          const added = own.filter((o) => o.heroIndex === heroIndex && o.slotIndex === slotIndex).map((o) => o.tactic);
          return added.length ? { ...slot, alternatives: [...(slot.alternatives || []), ...added] } : slot;
        }),
      })),
    };
  });
}

/** Khóa theo bộ tướng (không thứ tự) để bỏ đội cũ trùng đội mùa. */
const heroSetKey = (team) => (team.heroes || [])
  .map((hero) => normalizeHeroSlot(hero).alternatives[0].canonicalId)
  .sort()
  .join("|");

/**
 * Gợi ý theo mùa trước; chỉ khi mùa chưa đủ đội mới lấp bằng đội cũ, luôn xếp sau và không dùng lại
 * tướng/chiến pháp đã chọn. "Thiếu món" chỉ lấy từ đội mùa, đội thiếu ít món nhất đứng trước
 * (sort ổn định: cùng số món thì giữ thứ tự bậc của engine).
 */
export function recommendRoster({
  seasonTeams = [],
  seasonTier = [],
  legacyTeams = [],
  legacyTier = [],
  tacticOverrides = [],
  maxTeams = 5,
  ...engineOptions
} = {}) {
  const season = recommendTeams({
    ...engineOptions,
    teams: applyTacticOverrides(seasonTeams, tacticOverrides),
    teamTier: seasonTier,
    maxTeams,
  });
  let portfolioTeams = season.portfolioTeams;
  if (portfolioTeams.length < maxTeams && legacyTeams.length) {
    const seasonKeys = new Set(seasonTeams.map(heroSetKey));
    const legacy = recommendTeams({
      ...engineOptions,
      teams: legacyTeams.filter((team) => !seasonKeys.has(heroSetKey(team))),
      teamTier: legacyTier,
      maxTeams,
      seedEntries: season.addTeams,
    });
    const chosen = new Set(portfolioTeams);
    portfolioTeams = [
      ...portfolioTeams,
      ...legacy.portfolioTeams.filter((entry) => !chosen.has(entry) && !entry.locked).map((entry) => ({ ...entry, source: "legacy" })),
    ];
  }
  return {
    portfolioTeams,
    addTeams: portfolioTeams.filter((entry) => !entry.locked),
    blockedStrongTeams: [...season.blockedStrongTeams].sort((a, b) => missingCount(a) - missingCount(b)),
    diagnostics: season.diagnostics,
    legacyUsed: portfolioTeams.some((entry) => entry.source === "legacy"),
  };
}

const missingCount = (entry) => entry.missingHeroSlots?.length || entry.missingTacticSlots?.length || 0;

const ownedTacticId = (item) => (typeof item === "object" && item?.canonicalId) || canonicalTacticId(typeof item === "string" ? item : item?.name);

/** Món bù cho một ô thiếu: chiến pháp tướng đó mang ở cấu hình khác cùng mùa, có trong kho và còn trống. */
export function suggestTacticSubstitutes({
  heroName,
  missingTactic,
  teamTactics = [],
  usage,
  ownedTactics = [],
  reservedTactics = [],
  limit = 3,
}) {
  const counts = usage?.get(canonicalHeroId(heroName));
  if (!counts) return [];
  const owned = new Set(ownedTactics.map(ownedTacticId));
  const excluded = new Set([missingTactic, ...teamTactics, ...reservedTactics].map(canonicalTacticId));
  return [...counts]
    .filter(([tactic]) => owned.has(canonicalTacticId(tactic)) && !excluded.has(canonicalTacticId(tactic)))
    .sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b, "vi"))
    .slice(0, limit)
    .map(([tactic, configCount]) => ({ tactic, configCount }));
}
