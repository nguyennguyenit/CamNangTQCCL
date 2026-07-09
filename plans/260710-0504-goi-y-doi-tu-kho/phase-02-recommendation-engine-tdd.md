---
phase: 2
title: Recommendation engine TDD
status: completed
priority: P1
effort: 1.5d
dependencies:
  - 1
---

# Phase 2: Recommendation engine TDD

## Overview

Build the local deterministic recommendation engine. It chooses a conflict-aware portfolio, not a raw sorted list.

## Requirements

- Functional: accept owned heroes, owned tactics, locked teams, candidate teams, tier map, and mode.
- Functional: return up to 5 portfolio teams; with existing locked teams, output total portfolio and only add enough teams to reach 5.
- Functional: exclude missing required heroes from main recommendations. MVP treats all 3 heroes in a `teams.json` team as required/core.
- Functional: no duplicate heroes/tactics in portfolio unless the item is explicitly in a move/swap diagnostic, never silently.
- Functional: support `Meta T0 -> T1` and `Nhieu hot` ordering.
- Functional: full-box uses bounded search/backtracking over selected candidates, not independent top-5 sort.
- Functional: tactic alternatives are explicit only; do not infer alternatives from tactic type, name similarity, or display strings.
- Non-functional: pure JS, zero runtime dependencies, no DOM access.

## Architecture

New pure module:

```text
js/team-recommend-engine.js
  normalizeTeamCandidate()
  recommendTeams()
  scoreTeamCandidate()
  searchPortfolio()
  explainSkippedCandidates()
```

Candidate source:

- MVP uses `data/teams.json` + `data/team-tier.json`.
- `data/coexist.json` is not parsed directly by engine.
- Future preset hooks use `presetId`, `presetReason`, `coexistSetBonus`.

Portfolio logic:

1. Normalize candidates from teams data.
2. Filter by owned heroes; missing required hero -> `blockedStrongTeams`.
3. Evaluate tactic availability/conflicts and curated alternatives if present.
4. If `keepExistingTeams`, seed locked portfolio first.
5. For normal accounts, greedy with conflict diagnostics is acceptable.
6. For full-box, run bounded search/backtracking over candidate pool.

Full-box candidate pool must include:

- all T0/T0.5 candidates,
- top T1 candidates after diversity/conflict pruning,
- candidates that use high-red owned heroes,
- future preset-related candidates when `coexist-sets.json` exists.

## Related Code Files

- Create: `js/team-recommend-engine.js`
- Create/modify: `tests-js/team-recommend-engine.test.mjs`
- Possibly create: `js/team-candidate-normalizer.js` only if `team-recommend-engine.js` exceeds maintainable size.
- Read-only data: `data/teams.json`, `data/team-tier.json`, `data/tactics.json`, `data/heroes-dict.json`

## Implementation Steps

1. Write failing tests:
   - team missing any required hero never appears in main 5.
   - locked team tactics block later teams.
   - from-scratch first team has no duplicate conflict before it is chosen.
   - `variant` appears only when alternative tactic exists in candidate/rule data.
   - no implicit alternative is generated from tactic type/name similarity.
   - full-box bounded search can skip top individual team for stronger 5-team portfolio.
   - output with 4 locked teams returns 5 total portfolio teams and 1 add team.
2. Implement minimal data normalizer for `teams.json` shape.
3. Implement scoring and status classification.
4. Implement conflict-aware portfolio selection.
5. Add diagnostics and skipped-candidate explanations.
6. Run targeted tests, then full JS tests.

## Success Criteria

- [ ] `node --test tests-js/team-recommend-engine.test.mjs` passes.
- [ ] Full `node --test tests-js/*.test.mjs` passes.
- [ ] Engine does not import DOM/browser APIs.
- [ ] Engine contains no direct `coexist.json` parsing or slash-string split logic.
- [ ] Full-box path reports `searchedCandidates` and `prunedCandidates`.
- [ ] Tests prove all three team heroes are required for MVP.
- [ ] Tests prove tactic alternatives are explicit-only.

## Risk Assessment

- Risk: algorithm complexity grows. Mitigation: bounded candidate pool and pure helper functions with tests.
- Risk: hidden meta assumptions. Mitigation: engine only uses current data and labels weaker cases as diagnostics/variant.
- Risk: red-star scan confidence weak. Mitigation: red-star weighting only applies when value exists; tier remains hard priority in meta mode.
