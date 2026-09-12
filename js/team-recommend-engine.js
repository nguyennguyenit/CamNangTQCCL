import { normalizeText } from "./filters.js";
import { canonicalHeroId, normalizeHeroSlot } from "./hero-identity.js";
import { compareSeasonIds } from "./season-context.js";

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

function canonicalTacticId(name) {
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
      String(a.source || "").localeCompare(String(b.source || "")) ||
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
    baseScore: 100 - (TIER_RANK.get(tier) ?? 9) * 10 + Math.min(9, redCopyScore),
    rankingTuple: [
      TIER_RANK.get(tier) ?? Number.MAX_SAFE_INTEGER,
      0,
      0,
      -redCopyScore,
      String(key || ""),
    ],
  };
}

function compareCandidates(a, b) {
  return (
    (TIER_RANK.get(a.tier) ?? Number.MAX_SAFE_INTEGER) -
      (TIER_RANK.get(b.tier) ?? Number.MAX_SAFE_INTEGER) ||
    b.redCopyScore - a.redCopyScore ||
    (a.seasonContext ? compareSeasonIds(a.candidateKey, b.candidateKey) : String(a.team.id || "").localeCompare(String(b.team.id || "")))
  );
}

function candidatePool(candidates, { mode, fullBox, experimentalUntiered, seasonContext }) {
  const eligible = candidates.filter((candidate) => {
    if (mode !== "meta") return true;
    if (META_TIERS.has(candidate.tier)) return true;
    return experimentalUntiered === true && candidate.tier === "";
  });
  const sorted = eligible.sort(compareCandidates);
  // Seasonal configs are already bounded by the shared projector; check resources before search limits.
  return seasonContext ? sorted : sorted.slice(0, fullBox ? 80 : 60);
}

function assignHeroes(candidate, ownedHeroes, usedHeroes) {
  const ownedBySlot = candidate.heroSlots.map((slot) =>
    slot.alternatives.filter(({ canonicalId }) => ownedHeroes.has(canonicalId)),
  );
  const missingHeroSlots = ownedBySlot.flatMap((owned, index) =>
    owned.length === 0
      ? [candidate.heroSlots[index].alternatives.map(({ canonicalId }) => canonicalId)]
      : [],
  );
  if (missingHeroSlots.length > 0) {
    return {
      ok: false,
      assignments: [],
      missingHeroSlots,
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
  const choicesBySlot = candidate.tacticSlots.map((slot) => {
    const holder = heroAssignments.find(
      (assignment) => assignment.slotId === slot.holderSlotId,
    );
    const candidates = [
      { name: slot.primary, id: slot.primaryId, primary: true },
      ...slot.alternatives.map((name, index) => ({
        name,
        id: slot.alternativeIds[index],
        primary: false,
      })),
    ];
    return {
      slot,
      holder,
      owned: candidates.filter(({ id }) => ownedTactics.has(id)),
    };
  });
  const missing = choicesBySlot
    .filter(({ owned }) => owned.length === 0)
    .map(({ slot }) => slot.primary);

  function visit(index, reserved, choices) {
    if (index >= choicesBySlot.length) return choices;
    for (const choice of choicesBySlot[index].owned) {
      if (reserved.has(choice.id)) continue;
      const next = visit(
        index + 1,
        new Set([...reserved, choice.id]),
        [...choices, choice],
      );
      if (next) return next;
    }
    return null;
  }
  const choices =
    missing.length === 0 ? visit(0, new Set(usedTactics), []) : null;
  const conflicts =
    missing.length === 0 && choices === null
      ? choicesBySlot.map(({ slot }) => slot.primary)
      : [];
  const selected = (choices || []).map(({ name }) => name);
  const usedAlternatives = (choices || []).flatMap((choice, index) =>
    choice.primary
      ? []
      : [{ from: candidate.tacticSlots[index].primary, to: choice.name }],
  );
  const selections = (choices || []).map((choice, index) => {
    const { slot, holder } = choicesBySlot[index];
    return {
      holderId: holder?.canonicalId || null,
      slotIndex: slot.slotIndex,
      selectedTactic: choice.name,
      selectedTacticId: choice.id,
      alternatives: [...slot.alternatives],
      reason: choice.primary ? "primary-available" : "primary-conflict",
      downgrade: !choice.primary,
    };
  });

  return {
    ok: choices !== null,
    status: missing.length
      ? "missing-tactic"
      : conflicts.length
        ? "move-tactic"
        : usedAlternatives.length
          ? "variant"
          : "build-now",
    missing,
    conflicts,
    selected,
    selections,
    usedAlternatives,
  };
}

function candidateMetadata(candidate) {
  return candidate.seasonContext ? { candidateKey: candidate.candidateKey, configId: candidate.configId, seasonContext: candidate.seasonContext } : {};
}

function makeEntry(candidate, heroUse, tacticUse, experimentalUntiered) {
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
    experimentalUntiered: experimentalUntiered === true && candidate.tier === "",
    presetId: null,
    presetReason: "",
    coexistSetBonus: 0,
    source: "team",
    score: candidate.baseScore - tacticUse.usedAlternatives.length * 3,
    rankingTuple: candidate.rankingTuple,
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
      name: team.teamName || team.teamId || `Team đã build ${index + 1}`,
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
    presetId: null,
    presetReason: "",
    coexistSetBonus: 0,
    source: "locked",
    score: 0,
  };
}

function addEntry(entry, usedHeroes, usedTactics) {
  for (const hero of entry.heroAssignments || []) usedHeroes.add(hero.canonicalId);
  for (const tactic of entry.tacticSelections || []) {
    usedTactics.add(tactic.selectedTacticId);
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
) {
  // Keep a feasible whole-pool result even when DFS only explores its bounded prefix.
  let best = seasonContext
    ? greedy(candidates, seed, ownedHeroes, ownedTactics, maxTeams, experimentalUntiered)
    : [...seed.portfolio];
  let searched = 0;
  const limited = candidates.slice(0, 60);

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
    const heroCounts = new Map();
    const tacticCounts = new Map();
    for (const entry of entries) {
      for (const { canonicalId } of entry.heroAssignments) {
        heroCounts.set(canonicalId, (heroCounts.get(canonicalId) || 0) + 1);
      }
      for (const tactic of entry.selectedTactics) {
        const canonicalId = canonicalOwnedTactic(tactic);
        tacticCounts.set(canonicalId, (tacticCounts.get(canonicalId) || 0) + 1);
      }
    }
    for (const entry of entries) {
      const heroConflicts = entry.heroAssignments
        .map(({ canonicalId }) => canonicalId)
        .filter((canonicalId) => heroCounts.get(canonicalId) > 1);
      const tacticConflicts = entry.selectedTactics
        .map(canonicalOwnedTactic)
        .filter((canonicalId) => tacticCounts.get(canonicalId) > 1);
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

  const candidates = candidatePool(
    teams.map((team) => normalizeTeamCandidate(team, tierByTeam, redByHero, seasonContext)),
    { mode, fullBox, experimentalUntiered, seasonContext },
  );

  const eligible = [];
  const blockedStrongTeams = [];
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
        missingHeroes: missing,
        missingHeroSlots: built.heroUse.missingHeroSlots,
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
    eligible.push(candidate);
  }

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
    diagnostics,
  };
}
