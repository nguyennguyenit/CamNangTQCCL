import { normalizeText } from "./filters.js";
import { canonicalHeroId, normalizeHeroSlot } from "./hero-identity.js";
import { compareSeasonIds } from "./season-context.js";
import { L } from "./i18n.js";

const TIER_RANK = new Map([
  ["T0", 0],
  ["T0.5", 1],
  ["T1", 2],
  ["T1.5", 3],
  ["T2", 4],
  ["T3", 5],
]);
const META_TIERS = new Set(["T0", "T0.5", "T1"]);

const DEFAULT_DIAGNOSTICS = () => ({
  missingHeroes: [],
  missingTactics: [],
  tacticConflicts: [],
  heroConflicts: [],
  searchedCandidates: 0,
  prunedCandidates: [],
});

/** Số đội tối đa DFS toàn kho (fullBox) duyệt; phần còn lại vẫn được xét bởi bước tham lam dự phòng. */
export const DEFAULT_POOL_LIMIT = 60;

const unitKey = (value) => normalizeText(String(value ?? "")).replace(/\s*binh$/u, "");

/**
 * Luật đội cho món bù do người dùng chọn, suy từ từ điển chiến pháp: `type` FORMATION (trận pháp) /
 * TROOP (binh chủng) và `troopFit` (loại binh hợp). Khóa theo canonicalTacticId; món không thuộc hai loại
 * này không có luật. Dữ liệu gốc của đội không bị kiểm (nguồn có thể lệch luật, ngoài phạm vi chấm luật mùa).
 */
export function buildTacticRules(tacticsDict = []) {
  const rules = new Map();
  for (const item of tacticsDict || []) {
    const kind = item?.type === "FORMATION" ? "formation" : item?.type === "TROOP" ? "troop" : null;
    if (!kind || !item.viet) continue;
    rules.set(canonicalTacticId(item.viet), { kind, troopFit: (item.troopFit || []).map(unitKey) });
  }
  return rules;
}

/** Loại binh của đội (`unitType`, dạng "Kỵ"/"Cung"…); rỗng khi nguồn không ghi. */
export function teamUnitTypes(team) {
  return (Array.isArray(team?.unitType) ? team.unitType : []).map(unitKey).filter(Boolean);
}

/**
 * Vi phạm luật khi thêm món `candidateId` vào đội có `otherIds` (các món còn lại sau khi trừ ô đang thay):
 * tối đa 1 trận pháp, tối đa 1 binh chủng, binh chủng phải hợp loại binh; thiếu loại binh thì không binh chủng nào hợp.
 * Trả về mã lý do hoặc null.
 */
export function tacticRuleViolation(candidateId, otherIds, unitTypes, rules) {
  const rule = rules?.get(candidateId);
  if (!rule) return null;
  const same = (otherIds || []).filter((id) => rules.get(id)?.kind === rule.kind).length;
  if (rule.kind === "formation") return same > 0 ? "formation-limit" : null;
  if (same > 0) return "troop-limit";
  if (unitTypes.length === 0) return "troop-unit-unknown";
  return rule.troopFit.length === 0 || unitTypes.some((unit) => rule.troopFit.includes(unit)) ? null : "troop-unit-mismatch";
}

export function canonicalTacticId(name) {
  const slug = normalizeText(name)
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  return `tactic:${slug}`;
}

function displayName(item) {
  return typeof item === "string" ? item : item?.name;
}

function canonicalOwnedHero(item) {
  if (typeof item === "object" && item?.canonicalId) return item.canonicalId;
  if (typeof item === "string" && item.startsWith("hero:")) return item;
  return canonicalHeroId(displayName(item));
}

function canonicalOwnedTactic(item) {
  if (typeof item === "object" && item?.canonicalId) return item.canonicalId;
  if (typeof item === "string" && item.startsWith("tactic:")) return item;
  return canonicalTacticId(displayName(item));
}

function tierIndex(teamTier, seasonal = false) {
  if (teamTier instanceof Map) return teamTier;
  return new Map((teamTier || []).map((entry) => [seasonal ? entry.candidateKey : entry.teamId, entry.rankings || []]));
}

function bestTier(rankings) {
  return [...rankings].sort(
    (a, b) =>
      (TIER_RANK.get(a.tier) ?? Number.MAX_SAFE_INTEGER) -
        (TIER_RANK.get(b.tier) ?? Number.MAX_SAFE_INTEGER) ||
      String(a.updatedAt || "").localeCompare(String(b.updatedAt || "")),
  )[0]?.tier || "";
}

function tacticSlots(team, heroSlots) {
  return (team.heroes || []).flatMap((hero, heroIndex) =>
    (hero.tactics || []).map((slot, slotIndex) => ({
      holderSlotId: heroSlots[heroIndex].slotId,
      slotIndex,
      primary: slot.name,
      primaryId: canonicalTacticId(slot.name),
      alternatives: slot.alternatives || [],
      alternativeIds: (slot.alternatives || []).map(canonicalTacticId),
      // Ô chưa đối chiếu được với từ điển: giữ tên Việt dự phòng, không bắt buộc sở hữu (không thể kiểm).
      unresolved: slot.unresolved === true,
      // Món bù do người dùng chọn (khác biến thể có sẵn trong dữ liệu đội): chịu luật đội, nhãn "chưa được đánh giá".
      userAlternativeIds: new Set((slot.userAlternatives || []).map(canonicalTacticId)),
    })),
  );
}

function redStarBonus(heroSlots, redByHero) {
  return heroSlots.reduce(
    (sum, slot) =>
      sum +
      Math.max(
        0,
        ...slot.alternatives.map(({ canonicalId }) => redByHero.get(canonicalId) || 0),
      ),
    0,
  );
}

export function normalizeTeamCandidate(
  team,
  tierByTeam = new Map(),
  redByHero = new Map(),
  seasonContext = null,
) {
  const key = seasonContext ? team.candidateKey : team.id;
  const rankings = tierByTeam.get(key) || [];
  const tier = bestTier(rankings);
  const heroSlots = (team.heroes || []).map((hero, index) => {
    const slot = normalizeHeroSlot(hero);
    return seasonContext ? { ...slot, slotId: `slot:${key}:${index}` } : slot;
  });
  const redCopyScore = redStarBonus(heroSlots, redByHero);
  return {
    team,
    ...(seasonContext ? { candidateKey: key, configId: team.configId, seasonContext } : {}),
    tier,
    tierRankings: [...rankings],
    heroSlots,
    requiredHeroes: heroSlots.map((slot) => slot.alternatives[0].displayName),
    tacticSlots: tacticSlots(team, heroSlots),
    redCopyScore,
    rankingTuple: [TIER_RANK.get(tier) ?? Number.MAX_SAFE_INTEGER, -redCopyScore, String(key || "")],
  };
}

/**
 * "Nhiều hột" (`redStars`) xếp số hột đỏ trước bậc; "Meta" giữ bậc trước, hột chỉ để phân định.
 * Bản đã thay (`substituted`, món bù do người dùng chọn) xếp sau đội cùng bậc không bị thay.
 */
function compareCandidates(a, b, mode) {
  const tier = (TIER_RANK.get(a.tier) ?? Number.MAX_SAFE_INTEGER) - (TIER_RANK.get(b.tier) ?? Number.MAX_SAFE_INTEGER);
  const substituted = Number(a.substituted === true) - Number(b.substituted === true);
  const red = b.redCopyScore - a.redCopyScore;
  return (
    (mode === "redStars" ? red || tier || substituted : tier || substituted || red) ||
    (a.seasonContext ? compareSeasonIds(a.candidateKey, b.candidateKey) : String(a.team.id || "").localeCompare(String(b.team.id || "")))
  );
}

/** Lọc theo chế độ; KHÔNG cắt số lượng ở đây: phải kiểm kho trước rồi mới giới hạn (xem `poolLimit`). */
function candidatePool(candidates, { mode, experimentalUntiered }) {
  const eligible = candidates.filter((candidate) => {
    if (mode !== "meta") return true;
    if (META_TIERS.has(candidate.tier)) return true;
    return experimentalUntiered === true && candidate.tier === "";
  });
  return eligible.sort((a, b) => compareCandidates(a, b, mode));
}

function assignHeroes(candidate, ownedHeroes, usedHeroes) {
  const ownedBySlot = candidate.heroSlots.map((slot) =>
    slot.alternatives.filter(({ canonicalId }) => ownedHeroes.has(canonicalId)),
  );
  const missingSlots = candidate.heroSlots.filter((_, index) => ownedBySlot[index].length === 0);
  const missingHeroSlots = missingSlots.map((slot) => slot.alternatives.map(({ canonicalId }) => canonicalId));
  if (missingHeroSlots.length > 0) {
    return {
      ok: false,
      assignments: [],
      missingHeroSlots,
      missingHeroSlotNames: missingSlots.map((slot) => slot.alternatives.map(({ displayName }) => displayName)),
      conflictingHeroSlots: [],
    };
  }

  function visit(index, reserved, assignments) {
    if (index >= candidate.heroSlots.length) return assignments;
    const slot = candidate.heroSlots[index];
    for (const hero of ownedBySlot[index]) {
      if (reserved.has(hero.canonicalId)) continue;
      const next = visit(
        index + 1,
        new Set([...reserved, hero.canonicalId]),
        [
          ...assignments,
          {
            slotId: slot.slotId,
            canonicalId: hero.canonicalId,
            displayName: hero.displayName,
          },
        ],
      );
      if (next) return next;
    }
    return null;
  }

  const assignments = visit(0, new Set(usedHeroes), []);
  const conflictingHeroSlots = assignments
    ? []
    : ownedBySlot.map((owned) => owned.map(({ canonicalId }) => canonicalId));
  return {
    ok: assignments !== null,
    assignments: assignments || [],
    missingHeroSlots,
    conflictingHeroSlots,
  };
}

function selectTactics(candidate, heroAssignments, ownedTactics, usedTactics) {
  const rules = candidate.tacticRules;
  const unitTypes = teamUnitTypes(candidate.team);
  const choicesBySlot = candidate.tacticSlots.map((slot) => {
    const holder = heroAssignments.find(
      (assignment) => assignment.slotId === slot.holderSlotId,
    );
    if (slot.unresolved) {
      return { slot, holder, owned: [{ name: slot.primary, id: slot.primaryId, primary: true, unresolved: true }] };
    }
    const candidates = [
      { name: slot.primary, id: slot.primaryId, primary: true },
      ...slot.alternatives.map((name, index) => ({
        name,
        id: slot.alternativeIds[index],
        primary: false,
        user: slot.userAlternativeIds.has(slot.alternativeIds[index]),
      })),
    ];
    return {
      slot,
      holder,
      owned: candidates.filter(({ id }) => ownedTactics.has(id)),
    };
  });
  const missingChoices = choicesBySlot.filter(({ owned }) => owned.length === 0);
  const missing = missingChoices.map(({ slot }) => slot.primary);
  // Chỗ cần lấp: tướng giữ ô (theo thứ tự trong đội) và vị trí ô, để UI gợi ý món bù đúng ô.
  const missingSlots = missingChoices.map(({ slot }) => {
    const heroIndex = candidate.heroSlots.findIndex((heroSlot) => heroSlot.slotId === slot.holderSlotId);
    return {
      tactic: slot.primary,
      heroIndex,
      holderName: candidate.heroSlots[heroIndex]?.alternatives[0].displayName ?? "",
      slotIndex: slot.slotIndex,
    };
  });
  const unresolved = choicesBySlot.filter(({ slot }) => slot.unresolved).map(({ slot }) => {
    const heroIndex = candidate.heroSlots.findIndex((heroSlot) => heroSlot.slotId === slot.holderSlotId);
    return {
      tactic: slot.primary,
      heroIndex,
      holderName: candidate.heroSlots[heroIndex]?.alternatives[0].displayName ?? "",
      slotIndex: slot.slotIndex,
    };
  });

  // Luật đội chỉ áp cho món bù do người dùng chọn; dữ liệu gốc/biến thể có sẵn của đội không bị kiểm.
  const violations = (choices) => {
    const ids = choices.map(({ id }) => id);
    return choices.flatMap((choice, index) => {
      if (!choice.user) return [];
      const reason = tacticRuleViolation(choice.id, ids.filter((_, other) => other !== index), unitTypes, rules);
      return reason ? [{ tactic: choice.name, from: candidate.tacticSlots[index].primary, reason }] : [];
    });
  };

  function visit(index, reserved, choices, enforce) {
    if (index >= choicesBySlot.length) return enforce && violations(choices).length ? null : choices;
    for (const choice of choicesBySlot[index].owned) {
      if (!choice.unresolved && reserved.has(choice.id)) continue;
      const next = visit(
        index + 1,
        choice.unresolved ? reserved : new Set([...reserved, choice.id]),
        [...choices, choice],
        enforce,
      );
      if (next) return next;
    }
    return null;
  }
  let choices = missing.length === 0 ? visit(0, new Set(usedTactics), [], true) : null;
  // Có tổ hợp xếp được nếu bỏ luật đội ⇒ lý do không xây được là luật, không phải thiếu món hay xung đột.
  const unruled = missing.length === 0 && choices === null ? visit(0, new Set(usedTactics), [], false) : null;
  const incompatible = unruled ? violations(unruled) : [];
  const conflicts =
    missing.length === 0 && choices === null && !unruled
      ? choicesBySlot.map(({ slot }) => slot.primary)
      : [];
  const selected = (choices || []).map(({ name }) => name);
  const usedAlternatives = (choices || []).flatMap((choice, index) =>
    choice.primary
      ? []
      : [{ from: candidate.tacticSlots[index].primary, to: choice.name }],
  );
  const substitutions = (choices || []).flatMap((choice, index) =>
    choice.user ? [{ from: candidate.tacticSlots[index].primary, to: choice.name }] : [],
  );
  const selections = (choices || []).map((choice, index) => {
    const { slot, holder } = choicesBySlot[index];
    return {
      holderId: holder?.canonicalId || null,
      slotIndex: slot.slotIndex,
      selectedTactic: choice.name,
      selectedTacticId: choice.id,
      alternatives: [...slot.alternatives],
      reason: choice.unresolved ? "unresolved" : choice.primary ? "primary-available" : "primary-conflict",
      downgrade: !choice.primary,
      ...(choice.unresolved ? { unresolved: true } : {}),
    };
  });

  return {
    ok: choices !== null,
    status: missing.length
      ? "missing-tactic"
      : incompatible.length
        ? "incompatible"
        : conflicts.length
          ? "move-tactic"
          : unresolved.length
            ? "unreconciled"
            : usedAlternatives.length
              ? "variant"
              : "build-now",
    missing,
    missingSlots,
    conflicts,
    incompatible,
    unresolved: unresolved.map(({ tactic }) => tactic),
    unresolvedSlots: unresolved,
    selected,
    selections,
    usedAlternatives,
    substitutions,
  };
}

function candidateMetadata(candidate) {
  return candidate.seasonContext ? { candidateKey: candidate.candidateKey, configId: candidate.configId, seasonContext: candidate.seasonContext } : {};
}

function makeEntry(candidate, heroUse, tacticUse, experimentalUntiered) {
  const substitutions = tacticUse.substitutions;
  const [tierRank, ...rest] = candidate.rankingTuple;
  return {
    team: candidate.team,
    ...candidateMetadata(candidate),
    tier: candidate.tier,
    tierRankings: candidate.tierRankings,
    status: tacticUse.status,
    heroAssignments: heroUse.assignments,
    selectedTactics: tacticUse.selected,
    tacticSelections: tacticUse.selections,
    usedAlternatives: tacticUse.usedAlternatives,
    missingTactics: tacticUse.missing,
    tacticConflicts: tacticUse.conflicts,
    // Ô chiến pháp chưa đối chiếu được với từ điển (tên Việt dự phòng); đội còn ô này không bao giờ là "build-now".
    unresolvedTactics: tacticUse.unresolved,
    // Bản đã thay bằng món bù của người dùng: bậc `tier` là bậc của cấu hình gốc, bản thay chưa được đánh giá.
    variantUnrated: substitutions.length > 0,
    originalTier: candidate.tier,
    experimentalUntiered: experimentalUntiered === true && candidate.tier === "",
    source: "team",
    // Bản đã thay xếp sau đội cùng bậc không bị thay (phần tử 1 của tuple).
    rankingTuple: [tierRank, substitutions.length > 0 ? 1 : 0, ...rest],
  };
}

function lockedEntry(team, index) {
  const usedSlotsByHolder = new Map();
  for (const assignment of team.tacticAssignments || []) {
    if (!Number.isInteger(assignment.slotIndex)) continue;
    const used = usedSlotsByHolder.get(assignment.holderId) || new Set();
    used.add(assignment.slotIndex);
    usedSlotsByHolder.set(assignment.holderId, used);
  }
  const tacticAssignments = (team.tacticAssignments || []).map((assignment) => {
    const used = usedSlotsByHolder.get(assignment.holderId) || new Set();
    let slotIndex = assignment.slotIndex;
    if (!Number.isInteger(slotIndex)) {
      slotIndex = 0;
      while (used.has(slotIndex)) slotIndex += 1;
      used.add(slotIndex);
      usedSlotsByHolder.set(assignment.holderId, used);
    }
    return {
      holderId: assignment.holderId,
      slotIndex,
      selectedTactic: assignment.tacticId,
      selectedTacticId: assignment.tacticId,
      alternatives: [assignment.tacticId],
      reason: "locked",
      downgrade: false,
    };
  });
  return {
    locked: true,
    team: {
      id: team.teamId || `locked-${index}`,
      name: team.teamName || team.teamId || L(`Đội đã xây dựng ${index + 1}`, `已组建队伍 ${index + 1}`),
    },
    tier: "",
    tierRankings: [],
    status: "locked",
    heroAssignments: (team.heroes || []).map((name) => ({
      slotId: `slot:${canonicalOwnedHero(name)}`,
      canonicalId: canonicalOwnedHero(name),
      displayName: name,
    })),
    selectedTactics: team.tactics || [],
    tacticSelections: tacticAssignments,
    usedAlternatives: [],
    missingTactics: [],
    tacticConflicts: [],
    experimentalUntiered: false,
    source: "locked",
  };
}

function addEntry(entry, usedHeroes, usedTactics) {
  for (const hero of entry.heroAssignments || []) usedHeroes.add(hero.canonicalId);
  for (const tactic of entry.tacticSelections || []) {
    if (!tactic.unresolved) usedTactics.add(tactic.selectedTacticId);
  }
  if (entry.locked) {
    for (const tactic of entry.selectedTactics || []) {
      usedTactics.add(canonicalOwnedTactic(tactic));
    }
  }
}

function buildCandidate(
  candidate,
  ownedHeroes,
  ownedTactics,
  usedHeroes,
  usedTactics,
  experimentalUntiered,
) {
  const heroUse = assignHeroes(candidate, ownedHeroes, usedHeroes);
  if (!heroUse.ok) return { heroUse, tacticUse: null, entry: null };
  const tacticUse = selectTactics(
    candidate,
    heroUse.assignments,
    ownedTactics,
    usedTactics,
  );
  return {
    heroUse,
    tacticUse,
    entry: tacticUse.ok
      ? makeEntry(candidate, heroUse, tacticUse, experimentalUntiered)
      : null,
  };
}

function greedy(
  candidates,
  seed,
  ownedHeroes,
  ownedTactics,
  maxTeams,
  experimentalUntiered,
) {
  const portfolio = [...seed.portfolio];
  const usedHeroes = new Set(seed.usedHeroes);
  const usedTactics = new Set(seed.usedTactics);
  for (const candidate of candidates) {
    if (portfolio.length >= maxTeams) break;
    if (candidate.seasonContext && portfolio.some((entry) => entry.team.id === candidate.team.id)) continue;
    const built = buildCandidate(
      candidate,
      ownedHeroes,
      ownedTactics,
      usedHeroes,
      usedTactics,
      experimentalUntiered,
    );
    if (!built.entry) continue;
    portfolio.push(built.entry);
    addEntry(built.entry, usedHeroes, usedTactics);
  }
  return portfolio;
}

function searchPortfolio(
  candidates,
  seed,
  ownedHeroes,
  ownedTactics,
  maxTeams,
  experimentalUntiered,
  seasonContext,
  mode,
  poolLimit = DEFAULT_POOL_LIMIT,
) {
  // Dự phòng: kết quả khả thi trên TOÀN danh sách đã qua kiểm kho, kể cả khi DFS chỉ duyệt `poolLimit` đội đầu.
  let best = greedy(candidates, seed, ownedHeroes, ownedTactics, maxTeams, experimentalUntiered);
  let searched = 0;
  const limited = candidates.slice(0, poolLimit);

  function compareTuple(left, right) {
    for (let index = 0; index < Math.max(left.length, right.length); index++) {
      const a = left[index];
      const b = right[index];
      if (a === b) continue;
      if (a === undefined) return -1;
      if (b === undefined) return 1;
      if (candidates[0]?.seasonContext && typeof a === "string" && typeof b === "string") return compareSeasonIds(a, b);
      return a < b ? -1 : 1;
    }
    return 0;
  }

  function portfolioIsBetter(portfolio, currentBest) {
    if (portfolio.length !== currentBest.length) {
      return portfolio.length > currentBest.length;
    }
    if (mode === "redStars") {
      // rankingTuple[2] = -redCopyScore của đội (xem normalizeTeamCandidate/makeEntry); đội khóa không tính.
      const redTotal = (entries) => entries.reduce((sum, entry) => sum - (entry.locked ? 0 : entry.rankingTuple[2]), 0);
      const difference = redTotal(portfolio) - redTotal(currentBest);
      if (difference !== 0) return difference > 0;
    }
    const tuples = portfolio
      .filter((entry) => !entry.locked)
      .map((entry) => entry.rankingTuple)
      .sort(compareTuple);
    const bestTuples = currentBest
      .filter((entry) => !entry.locked)
      .map((entry) => entry.rankingTuple)
      .sort(compareTuple);
    for (let index = 0; index < Math.max(tuples.length, bestTuples.length); index++) {
      const compared = compareTuple(tuples[index] || [], bestTuples[index] || []);
      if (compared !== 0) return compared < 0;
    }
    return false;
  }

  function visit(index, portfolio, usedHeroes, usedTactics) {
    searched++;
    if (searched > 250000) return;
    if (portfolio.length >= maxTeams || index >= limited.length) {
      if (portfolioIsBetter(portfolio, best)) {
        best = portfolio;
      }
      return;
    }
    if (portfolio.length + limited.length - index < best.length) return;

    const alreadySelected = limited[index].seasonContext && portfolio.some((entry) => entry.team.id === limited[index].team.id);
    const built = alreadySelected ? { entry: null } : buildCandidate(
      limited[index],
      ownedHeroes,
      ownedTactics,
      usedHeroes,
      usedTactics,
      experimentalUntiered,
    );
    if (built.entry) {
      const nextHeroes = new Set(usedHeroes);
      const nextTactics = new Set(usedTactics);
      addEntry(built.entry, nextHeroes, nextTactics);
      visit(
        index + 1,
        [...portfolio, built.entry],
        nextHeroes,
        nextTactics,
      );
    }
    visit(index + 1, portfolio, usedHeroes, usedTactics);
  }

  visit(
    0,
    [...seed.portfolio],
    new Set(seed.usedHeroes),
    new Set(seed.usedTactics),
  );
  return { portfolio: best.slice(0, maxTeams), searched };
}

// Đường `seasonContext` (candidateKey/compareSeasonIds) chưa có nơi gọi production: giữ cho chấm điểm theo luật mùa (`rulesetScoringReady`) về sau.
export function recommendTeams({
  teams = [],
  teamTier = [],
  ownedHeroes = [],
  ownedTactics = [],
  lockedTeams = [],
  mode = "meta",
  keepExistingTeams = true,
  maxTeams = 5,
  fullBox = false,
  experimentalUntiered = false,
  seasonContext = null,
  seedEntries = [],
  poolLimit = DEFAULT_POOL_LIMIT,
  tacticRules = null,
} = {}) {
  const diagnostics = DEFAULT_DIAGNOSTICS();
  if (seasonContext) {
    const validId = (value) => typeof value === "string" && value.length > 0 && [...value].length <= 128 && value.trim() === value && !/[\p{C}]/u.test(value);
    if (!validId(seasonContext.scenarioId) || !validId(seasonContext.rulesetId) || Object.keys(seasonContext).some((key) => !["scenarioId", "rulesetId"].includes(key))) throw new TypeError("Invalid seasonal context");
    const keys = new Set();
    for (const team of teams) {
      if (!validId(team.candidateKey) || team.configId !== team.candidateKey || keys.has(team.candidateKey)) throw new TypeError("Invalid seasonal candidate identity");
      keys.add(team.candidateKey);
    }
  }
  const tierByTeam = tierIndex(teamTier, Boolean(seasonContext));
  const redByHero = new Map(
    ownedHeroes
      .filter((hero) => typeof hero === "object" && Number.isFinite(hero.redStars))
      .map((hero) => [canonicalOwnedHero(hero), hero.redStars]),
  );
  const ownedHeroSet = new Set(ownedHeroes.map(canonicalOwnedHero));
  const ownedTacticSet = new Set(ownedTactics.map(canonicalOwnedTactic));
  const seed = { portfolio: [], usedHeroes: new Set(), usedTactics: new Set() };

  if (keepExistingTeams) {
    const entries = lockedTeams
      .slice(0, maxTeams)
      .map((team, index) => lockedEntry(team, index));
    // Đội khóa đầu tiên giữ tài nguyên; đội khóa sau dùng lại tướng/chiến pháp đó mới là xung đột.
    for (const entry of entries) {
      const heroConflicts = entry.heroAssignments
        .map(({ canonicalId }) => canonicalId)
        .filter((canonicalId) => seed.usedHeroes.has(canonicalId));
      const tacticConflicts = entry.selectedTactics
        .map(canonicalOwnedTactic)
        .filter((canonicalId) => seed.usedTactics.has(canonicalId));
      if (heroConflicts.length || tacticConflicts.length) {
        if (heroConflicts.length) {
          diagnostics.heroConflicts.push({
            teamId: entry.team.id,
            heroSlots: heroConflicts.map((canonicalId) => [canonicalId]),
          });
        }
        if (tacticConflicts.length) {
          diagnostics.tacticConflicts.push({
            teamId: entry.team.id,
            tactics: tacticConflicts,
          });
        }
        continue;
      }
      seed.portfolio.push(entry);
      addEntry(entry, seed.usedHeroes, seed.usedTactics);
    }
  }
  // Đội đã chọn ở lượt trước (vd. lượt đội chuẩn trước lượt đội cũ): giữ tài nguyên và tính vào giới hạn.
  for (const entry of seedEntries) {
    if (seed.portfolio.length >= maxTeams) break;
    seed.portfolio.push(entry);
    addEntry(entry, seed.usedHeroes, seed.usedTactics);
  }

  const candidates = candidatePool(
    teams.map((team) => ({ ...normalizeTeamCandidate(team, tierByTeam, redByHero, seasonContext), tacticRules })),
    { mode, experimentalUntiered },
  );

  const eligible = [];
  const blockedStrongTeams = [];
  const incompatibleTeams = [];
  for (const candidate of candidates) {
    const built = buildCandidate(
      candidate,
      ownedHeroSet,
      ownedTacticSet,
      seed.usedHeroes,
      seed.usedTactics,
      experimentalUntiered,
    );
    if (built.heroUse.missingHeroSlots.length) {
      const missing = built.heroUse.missingHeroSlots.flat();
      diagnostics.missingHeroes.push({ teamId: candidate.team.id, ...candidateMetadata(candidate), heroes: missing });
      blockedStrongTeams.push({
        team: candidate.team,
        ...candidateMetadata(candidate),
        tier: candidate.tier,
        status: "missing-hero",
        missingHeroSlots: built.heroUse.missingHeroSlots,
        missingHeroSlotNames: built.heroUse.missingHeroSlotNames,
      });
      continue;
    }
    if (built.heroUse.conflictingHeroSlots.length) {
      diagnostics.heroConflicts.push({
        teamId: candidate.team.id,
        ...candidateMetadata(candidate),
        heroSlots: built.heroUse.conflictingHeroSlots,
      });
      continue;
    }
    if (!built.tacticUse.ok) {
      if (built.tacticUse.missing.length) {
        diagnostics.missingTactics.push({
          teamId: candidate.team.id,
          ...candidateMetadata(candidate),
          tactics: built.tacticUse.missing,
        });
        blockedStrongTeams.push({
          team: candidate.team,
          ...candidateMetadata(candidate),
          tier: candidate.tier,
          status: "missing-tactic",
          missingTactics: built.tacticUse.missing,
          missingTacticSlots: built.tacticUse.missingSlots,
        });
      } else if (built.tacticUse.incompatible.length) {
        incompatibleTeams.push({
          team: candidate.team,
          ...candidateMetadata(candidate),
          tier: candidate.tier,
          status: "incompatible",
          incompatibleTactics: built.tacticUse.incompatible,
        });
      } else {
        diagnostics.tacticConflicts.push({
          teamId: candidate.team.id,
          ...candidateMetadata(candidate),
          tactics: built.tacticUse.conflicts,
        });
      }
      continue;
    }
    candidate.substituted = built.tacticUse.substitutions.length > 0;
    eligible.push(candidate);
  }

  // Xếp lại theo cờ "đã thay": bản thay xếp sau đội cùng bậc không bị thay (biết được sau khi kiểm kho).
  eligible.sort((a, b) => compareCandidates(a, b, mode));

  let portfolio;
  if (fullBox) {
    const searched = searchPortfolio(
      eligible,
      seed,
      ownedHeroSet,
      ownedTacticSet,
      maxTeams,
      experimentalUntiered,
      seasonContext,
      mode,
      poolLimit,
    );
    portfolio = searched.portfolio;
    diagnostics.searchedCandidates = searched.searched;
  } else {
    portfolio = greedy(
      eligible,
      seed,
      ownedHeroSet,
      ownedTacticSet,
      maxTeams,
      experimentalUntiered,
    );
    diagnostics.searchedCandidates = eligible.length;
  }

  diagnostics.prunedCandidates = candidates
    .filter(
      (candidate) =>
        !portfolio.some((entry) => candidate.seasonContext ? entry.candidateKey === candidate.candidateKey : entry.team?.id === candidate.team.id),
    )
    .slice(0, 20)
    .map((candidate) => ({
      teamId: candidate.team.id,
      ...candidateMetadata(candidate),
      reason: "conflict-or-lower-rank",
    }));

  return {
    portfolioTeams: portfolio,
    addTeams: portfolio.filter((entry) => !entry.locked),
    blockedStrongTeams,
    // Đội đủ tướng và món nhưng món bù đã chọn vi phạm luật đội: tách khỏi "thiếu món".
    incompatibleTeams,
    diagnostics,
  };
}
