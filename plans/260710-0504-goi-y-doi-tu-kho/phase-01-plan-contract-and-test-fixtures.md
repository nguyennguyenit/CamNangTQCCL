---
phase: 1
title: Plan contract and test fixtures
status: completed
priority: P1
effort: 0.5d
dependencies: []
---

# Phase 1: Plan contract and test fixtures

## Overview

Define the normalized contracts and test fixtures before implementation. This phase prevents the engine/UI/Worker from inventing incompatible shapes.

## Requirements

- Functional: document canonical scan state, recommendation input/output, status enum, and Worker mode payloads.
- Functional: add deterministic fixture data for engine tests using a small subset of `teams.json`-like objects.
- Non-functional: keep fixtures local to tests; no production data mutation in this phase.

## Architecture

Contracts:

- Scan state: `ownedHeroes`, `ownedTactics`, `lockedTeams`, confidence flags, source image metadata.
- Recommendation state: `portfolioTeams`, `addTeams`, `blockedStrongTeams`, `diagnostics`.
- Team statuses: `build-now`, `move-tactic`, `variant`, `missing-tactic`, `missing-hero`.
- Worker modes: `analyzeTeamImage`, `scanHeroes`, `scanTactics`, `scanBuiltTeams`.

## Related Code Files

- Create: `tests-js/fixtures/team-recommend-fixtures.mjs`
- Create: `tests-js/team-recommend-engine.test.mjs`
- Create: `tests-js/roster-scan-state.test.mjs`
- Create: `worker/test/scan-modes.test.ts` or extend existing Worker test suite
- Modify later phases only: `js/team-recommend-engine.js`, `js/roster-scan-state.js`, `worker/src/schema.ts`

## Implementation Steps

1. Write fixtures with 8-12 candidate teams covering:
   - one T0 team with missing core hero,
   - one team needing an alternative tactic,
   - two teams sharing a premium tactic,
   - a full-box case where the individually best team lowers the portfolio score,
   - built-team locks.
2. Write failing JS tests for contract-only expectations:
   - output status strings are stable,
   - diagnostics include missing/conflict details,
   - preset fields exist and default to null/empty values.
3. Write failing Worker schema tests for mode discrimination, without calling model.
4. Keep all production files unchanged until tests describe expected behavior.

## Success Criteria

- [ ] Fixture file exists and is small enough to reason about without reading full `data/teams.json`.
- [ ] Tests fail for missing production modules/contracts.
- [ ] Contracts include `presetId`, `presetReason`, `coexistSetBonus`, `source`.
- [ ] No production code changed except imports needed by tests in later phases.

## Risk Assessment

- Risk: over-modeling too early. Mitigation: only encode fields required by brainstorm/red-team acceptance.
- Risk: fixtures drift from real data. Mitigation: fixture shape mirrors `teams.json` enough to feed adapter tests later.
