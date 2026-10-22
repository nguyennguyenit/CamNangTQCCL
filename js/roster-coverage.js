// Độ phủ kho theo tier (#20): với Đội chuẩn của một mùa, mỗi đội xét ĐỘC LẬP (không ràng buộc dùng chung
// như `recommendRoster`) xem kho ráp đủ, thiếu đúng 1 món hay nhiều hơn. Hàm thuần, không DOM; so khớp bằng id
// cùng bộ đối chiếu với engine (`canonicalHeroId`/`normalizeHeroSlot`, `tacticIdForName` + `tacticIdOf`).
import { canonicalHeroId, normalizeHeroSlot } from "./hero-identity.js";
import { tacticIdForName } from "./team-recommend-engine.js";
import { SOURCE_TIER_ORDER } from "./recommended-reference-state.js";

const nameOf = (item) => (typeof item === "string" ? item : item?.name);

function ownedHeroId(item) {
  if (typeof item === "object" && item?.canonicalId) return item.canonicalId;
  if (typeof item === "string" && item.startsWith("hero:")) return item;
  return canonicalHeroId(nameOf(item));
}

function ownedTacticId(item, idOf) {
  if (typeof item === "object" && item?.canonicalId) return item.canonicalId;
  if (typeof item === "string" && item.startsWith("tactic:")) return item;
  return tacticIdForName(nameOf(item), idOf);
}

const hasName = (value) => typeof value === "string" && value.trim() !== "";

/** Bậc của đội: bảng bậc của mùa trước, `team.tier` dự phòng; không có bậc → "". */
function tierIndex(seasonTier) {
  if (seasonTier instanceof Map) return seasonTier;
  return new Map((seasonTier || []).map((entry) => [entry.teamId, entry.rankings || []]));
}

function tierOf(team, byTeam) {
  const ranking = byTeam.get(team.id)?.find((entry) => entry?.tier);
  return ranking?.tier || team.tier || "";
}

const tierOrder = (tier) => {
  const index = SOURCE_TIER_ORDER.indexOf(tier);
  return index < 0 ? SOURCE_TIER_ORDER.length : index;
};

/** Các ô của đội: tướng (có thể "A/B") và chiến pháp (có phương án thay); ô trống bị bỏ. */
function slotsOf(team, idOf) {
  const slots = [];
  for (const hero of team.heroes || []) {
    if (!hasName(nameOf(hero))) continue;
    slots.push({
      kind: "hero",
      name: nameOf(hero),
      ids: normalizeHeroSlot(hero).alternatives.map(({ canonicalId }) => canonicalId),
    });
    for (const tactic of hero.tactics || []) {
      if (!hasName(tactic?.name)) continue;
      slots.push({
        kind: "tactic",
        name: tactic.name,
        unresolved: tactic.unresolved === true,
        ids: [tactic.name, ...(tactic.alternatives || [])].map((name) => tacticIdForName(name, idOf)),
        // Món bù người dùng không thuộc Đội chuẩn: không tính vào tổng của tiến độ.
        seasonIds: [tactic.name, ...(tactic.alternatives || []).filter((name) => !(tactic.userAlternatives || []).includes(name))]
          .map((name) => tacticIdForName(name, idOf)),
      });
    }
  }
  return slots;
}

/**
 * @param {object} input
 * @param {object[]} input.seasonTeams Đội của mùa (`buildSeasonCandidates`, có thể đã `applyTacticOverrides`).
 * @param {object[]|Map} input.seasonTier Bảng bậc `[{teamId, rankings:[{tier}]}]`.
 * @param {Array<string|object>} input.ownedHeroes
 * @param {Array<string|object>} input.ownedTactics
 * @param {(name: string) => string} [input.tacticIdOf] bộ đối chiếu `createTacticIdResolver`; thiếu thì slug tên.
 * @param {object[]} [input.unmapped] cấu hình chưa đối chiếu của mùa (chỉ chuyển tiếp để UI ghi chú).
 * @returns {{tiers: Array<{tier: string, total: number, complete: object[], missingOne: Array<{team: object, missing: {kind: "hero"|"tactic", name: string, unresolved?: true}}>}>, progress: {heroes: {owned: number, total: number}, tactics: {owned: number, total: number}}, unmapped: object[]}}
 */
export function buildRosterCoverage({
  seasonTeams = [],
  seasonTier = [],
  ownedHeroes = [],
  ownedTactics = [],
  tacticIdOf = null,
  unmapped = [],
} = {}) {
  const heroSet = new Set((ownedHeroes || []).map(ownedHeroId));
  const tacticSet = new Set((ownedTactics || []).map((item) => ownedTacticId(item, tacticIdOf)));
  const byTeam = tierIndex(seasonTier);
  const groups = new Map();
  const seasonHeroes = new Set();
  const seasonTactics = new Set();

  for (const team of seasonTeams || []) {
    const slots = slotsOf(team, tacticIdOf);
    const missing = [];
    for (const slot of slots) {
      if (slot.kind === "hero") for (const id of slot.ids) seasonHeroes.add(id);
      else if (!slot.unresolved) for (const id of slot.seasonIds) seasonTactics.add(id);
      const owned = !slot.unresolved && slot.ids.some((id) => (slot.kind === "hero" ? heroSet : tacticSet).has(id));
      if (!owned) missing.push(slot);
    }
    const tier = tierOf(team, byTeam);
    if (!groups.has(tier)) groups.set(tier, { tier, total: 0, complete: [], missingOne: [] });
    const entry = groups.get(tier);
    entry.total++;
    if (missing.length === 0) entry.complete.push(team);
    else if (missing.length === 1) {
      const [slot] = missing;
      entry.missingOne.push({ team, missing: { kind: slot.kind, name: slot.name, ...(slot.unresolved ? { unresolved: true } : {}) } });
    }
  }

  const count = (set, owned) => [...set].filter((id) => owned.has(id)).length;
  return {
    tiers: [...groups.values()].sort((a, b) => tierOrder(a.tier) - tierOrder(b.tier) || a.tier.localeCompare(b.tier)),
    progress: {
      heroes: { owned: count(seasonHeroes, heroSet), total: seasonHeroes.size },
      tactics: { owned: count(seasonTactics, tacticSet), total: seasonTactics.size },
    },
    unmapped: unmapped || [],
  };
}
