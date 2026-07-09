import { normalizeText } from "./filters.js";

const TIER_SCORE = {
  T0: 100,
  "T0.5": 92,
  T1: 84,
  "T1.5": 76,
  T2: 62,
  T3: 45,
};

const DEFAULT_DIAGNOSTICS = () => ({
  missingHeroes: [],
  missingTactics: [],
  tacticConflicts: [],
  searchedCandidates: 0,
  prunedCandidates: [],
});

function asNameSet(values) {
  return new Set((values || []).map((item) => normalizeText(typeof item === "string" ? item : item?.name)).filter(Boolean));
}

function displayName(item) {
  return typeof item === "string" ? item : item?.name;
}

function bestTier(team, tierByTeam) {
  const rankings = tierByTeam.get(team.id) || [];
  let best = null;
  for (const r of rankings) {
    if (!best || (TIER_SCORE[r.tier] || 0) > (TIER_SCORE[best.tier] || 0)) best = r;
  }
  return best?.tier || "";
}

function tierIndex(teamTier) {
  if (teamTier instanceof Map) return teamTier;
  return new Map((teamTier || []).map((entry) => [entry.teamId, entry.rankings || []]));
}

function teamHeroes(team) {
  return (team.heroes || []).map((hero) => hero.baseName || hero.name).filter(Boolean);
}

function tacticSlots(team) {
  return (team.heroes || []).flatMap((hero) =>
    (hero.tactics || []).map((slot) => ({
      primary: slot.name,
      alternatives: slot.alternatives || [],
      holder: hero.baseName || hero.name,
    })),
  ).filter((slot) => slot.primary);
}

function redStarBonus(team, redByHero) {
  return teamHeroes(team).reduce((sum, hero) => sum + (redByHero.get(normalizeText(hero)) || 0), 0);
}

export function normalizeTeamCandidate(team, tierByTeam = new Map(), redByHero = new Map()) {
  const tier = bestTier(team, tierByTeam);
  return {
    team,
    tier,
    requiredHeroes: teamHeroes(team),
    tacticSlots: tacticSlots(team),
    baseScore: (TIER_SCORE[tier] || 20) + Math.min(12, redStarBonus(team, redByHero)),
  };
}

function selectTactics(candidate, ownedTactics, usedTactics) {
  const selected = [];
  const usedAlternatives = [];
  const missing = [];
  const conflicts = [];

  for (const slot of candidate.tacticSlots) {
    const primaryKey = normalizeText(slot.primary);
    if (ownedTactics.has(primaryKey) && !usedTactics.has(primaryKey)) {
      selected.push(slot.primary);
      continue;
    }

    let alternative = null;
    for (const alt of slot.alternatives || []) {
      const altKey = normalizeText(alt);
      if (ownedTactics.has(altKey) && !usedTactics.has(altKey)) {
        alternative = alt;
        break;
      }
    }
    if (alternative) {
      selected.push(alternative);
      usedAlternatives.push({ from: slot.primary, to: alternative });
      continue;
    }

    if (!ownedTactics.has(primaryKey)) missing.push(slot.primary);
    else conflicts.push(slot.primary);
  }

  if (missing.length) return { ok: false, status: "missing-tactic", missing, conflicts, selected, usedAlternatives };
  if (conflicts.length) return { ok: false, status: "move-tactic", missing, conflicts, selected, usedAlternatives };
  return {
    ok: true,
    status: usedAlternatives.length ? "variant" : "build-now",
    missing,
    conflicts,
    selected,
    usedAlternatives,
  };
}

function makeEntry(candidate, tacticResult) {
  return {
    team: candidate.team,
    tier: candidate.tier,
    status: tacticResult.status,
    selectedTactics: tacticResult.selected,
    usedAlternatives: tacticResult.usedAlternatives,
    missingTactics: tacticResult.missing,
    tacticConflicts: tacticResult.conflicts,
    presetId: null,
    presetReason: "",
    coexistSetBonus: 0,
    source: "team",
    score: candidate.baseScore - tacticResult.usedAlternatives.length * 3,
  };
}

function lockedEntry(team, index) {
  return {
    locked: true,
    team: { id: `locked-${index}`, name: team.teamName || `Team đã build ${index + 1}` },
    tier: "",
    status: "locked",
    selectedTactics: team.tactics || [],
    usedAlternatives: [],
    missingTactics: [],
    tacticConflicts: [],
    presetId: null,
    presetReason: "",
    coexistSetBonus: 0,
    source: "locked",
    score: 0,
  };
}

function canUseHeroes(candidate, ownedHeroes, usedHeroes) {
  const missing = candidate.requiredHeroes.filter((hero) => !ownedHeroes.has(normalizeText(hero)));
  if (missing.length) return { ok: false, missing };
  const conflicts = candidate.requiredHeroes.filter((hero) => usedHeroes.has(normalizeText(hero)));
  if (conflicts.length) return { ok: false, conflicts };
  return { ok: true, missing: [], conflicts: [] };
}

function addEntry(entry, usedHeroes, usedTactics) {
  for (const hero of teamHeroes(entry.team)) usedHeroes.add(normalizeText(hero));
  for (const tactic of entry.selectedTactics || []) usedTactics.add(normalizeText(tactic));
}

function candidatePool(candidates, mode, fullBox) {
  const sorted = [...candidates].sort((a, b) => b.baseScore - a.baseScore || a.team.name.localeCompare(b.team.name));
  if (!fullBox) return sorted;

  const priority = [];
  const rest = [];
  for (const candidate of sorted) {
    if (candidate.tier === "T0" || candidate.tier === "T0.5" || candidate.tier === "T1") priority.push(candidate);
    else rest.push(candidate);
  }
  const pool = [...priority, ...rest].slice(0, mode === "redStars" ? 80 : 60);
  return pool;
}

function greedy(entries, seed, maxTeams) {
  const portfolio = [...seed.portfolio];
  const usedHeroes = new Set(seed.usedHeroes);
  const usedTactics = new Set(seed.usedTactics);
  for (const { candidate, entry } of entries) {
    if (portfolio.length >= maxTeams) break;
    const heroUse = canUseHeroes(candidate, new Set(candidate.requiredHeroes.map(normalizeText)), usedHeroes);
    if (!heroUse.ok) continue;
    const tacticUse = selectTactics(candidate, new Set(entry.selectedTactics.map(normalizeText)), usedTactics);
    if (!tacticUse.ok) continue;
    const freshEntry = makeEntry(candidate, tacticUse);
    portfolio.push(freshEntry);
    addEntry(freshEntry, usedHeroes, usedTactics);
  }
  return portfolio;
}

function searchPortfolio(entries, seed, maxTeams) {
  let best = [...seed.portfolio];
  let bestScore = best.reduce((sum, entry) => sum + (entry.score || 0), 0);
  let searched = 0;
  const targetAdds = Math.max(0, maxTeams - seed.portfolio.length);
  const limited = entries.slice(0, 60);

  function dfs(index, chosen, usedHeroes, usedTactics, score) {
    searched++;
    if (searched > 250000) return;
    if (chosen.length === targetAdds || index >= limited.length) {
      const portfolio = [...seed.portfolio, ...chosen];
      if (portfolio.length > best.length || (portfolio.length === best.length && score > bestScore)) {
        best = portfolio;
        bestScore = score;
      }
      return;
    }
    if (chosen.length + (limited.length - index) < targetAdds) return;

    const { candidate } = limited[index];
    const heroConflicts = candidate.requiredHeroes.some((hero) => usedHeroes.has(normalizeText(hero)));
    if (!heroConflicts) {
      const tacticResult = selectTactics(candidate, new Set(limited[index].entry.selectedTactics.map(normalizeText)), usedTactics);
      if (tacticResult.ok) {
        const entry = makeEntry(candidate, tacticResult);
        const nextHeroes = new Set(usedHeroes);
        const nextTactics = new Set(usedTactics);
        addEntry(entry, nextHeroes, nextTactics);
        dfs(index + 1, [...chosen, entry], nextHeroes, nextTactics, score + entry.score);
      }
    }
    dfs(index + 1, chosen, usedHeroes, usedTactics, score);
  }

  dfs(0, [], new Set(seed.usedHeroes), new Set(seed.usedTactics), bestScore);
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
} = {}) {
  const diagnostics = DEFAULT_DIAGNOSTICS();
  const tierByTeam = tierIndex(teamTier);
  const redByHero = new Map(
    (ownedHeroes || [])
      .filter((h) => typeof h === "object" && Number.isFinite(h.redStars))
      .map((h) => [normalizeText(h.name), h.redStars]),
  );
  const ownedHeroSet = asNameSet(ownedHeroes.map(displayName));
  const ownedTacticSet = asNameSet(ownedTactics.map(displayName));
  const seed = { portfolio: [], usedHeroes: new Set(), usedTactics: new Set() };

  if (keepExistingTeams) {
    (lockedTeams || []).slice(0, maxTeams).forEach((team, index) => {
      const entry = lockedEntry(team, index);
      seed.portfolio.push(entry);
      for (const hero of team.heroes || []) seed.usedHeroes.add(normalizeText(hero));
      for (const tactic of team.tactics || []) seed.usedTactics.add(normalizeText(tactic));
    });
  }

  const candidates = candidatePool(
    teams.map((team) => normalizeTeamCandidate(team, tierByTeam, redByHero)),
    mode,
    fullBox,
  );

  const usable = [];
  const blockedStrongTeams = [];
  for (const candidate of candidates) {
    const heroUse = canUseHeroes(candidate, ownedHeroSet, seed.usedHeroes);
    if (!heroUse.ok && heroUse.missing?.length) {
      diagnostics.missingHeroes.push({ teamId: candidate.team.id, heroes: heroUse.missing });
      blockedStrongTeams.push({ team: candidate.team, tier: candidate.tier, status: "missing-hero", missingHeroes: heroUse.missing });
      continue;
    }

    const tacticResult = selectTactics(candidate, ownedTacticSet, seed.usedTactics);
    if (!tacticResult.ok) {
      if (tacticResult.missing.length) {
        diagnostics.missingTactics.push({ teamId: candidate.team.id, tactics: tacticResult.missing });
        blockedStrongTeams.push({ team: candidate.team, tier: candidate.tier, status: "missing-tactic", missingTactics: tacticResult.missing });
      } else {
        diagnostics.tacticConflicts.push({ teamId: candidate.team.id, tactics: tacticResult.conflicts });
      }
      continue;
    }
    usable.push({ candidate, entry: makeEntry(candidate, tacticResult) });
  }

  let portfolio;
  if (fullBox) {
    const searched = searchPortfolio(usable, seed, maxTeams);
    portfolio = searched.portfolio;
    diagnostics.searchedCandidates = searched.searched;
  } else {
    portfolio = greedy(usable, seed, maxTeams);
    diagnostics.searchedCandidates = usable.length;
  }

  diagnostics.prunedCandidates = candidates
    .filter((candidate) => !portfolio.some((entry) => entry.team?.id === candidate.team.id))
    .slice(0, 20)
    .map((candidate) => ({ teamId: candidate.team.id, reason: "conflict-or-lower-score" }));

  return {
    portfolioTeams: portfolio,
    addTeams: portfolio.filter((entry) => !entry.locked),
    blockedStrongTeams,
    diagnostics,
  };
}
