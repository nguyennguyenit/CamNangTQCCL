# Phase 2 — Engine: legacy fallback, substitution overrides, substitute suggestions (TDD)

## Files
- Modify `js/team-recommend-engine.js` (small, additive).
- Extend `js/roster-season-candidates.js` (orchestration + substitutes).
- Modify `js/roster-scan-state.js` (persist `tacticOverrides`).
- Tests: `tests-js/team-recommend-engine.test.mjs`, `tests-js/roster-season-candidates.test.mjs`,
  `tests-js/roster-scan-state.test.mjs`.

## Engine changes (`recommendTeams`)
- New option `seedEntries = []`: already-chosen non-locked entries appended to the seed after locked teams
  (resources reserved, count toward `maxTeams`). Enables the fallback pass without touching search logic.
- `blockedStrongTeams[*]` for `missing-tactic` gains `missingTacticSlots: [{ tactic, holderName, holderSlotIndex, slotIndex }]`
  (keep `missingTactics` as is — UI and tests use it).

## Orchestration `recommendRoster(...)` (in adapter module)
```js
recommendRoster({ seasonTeams, seasonTier, legacyTeams, legacyTier, tacticOverrides, ...engineOpts }) → {
  portfolioTeams, addTeams, blockedStrongTeams /* season only */, diagnostics, legacyUsed: boolean }
```
1. `applyTacticOverrides(seasonTeams, overrides)`: override `{ teamId, heroIndex, slotIndex, tactic }` appends
   `tactic` to that slot's `alternatives` → engine picks it as `variant`, `usedAlternatives` = "đã thay".
   Overrides for teams/slots that no longer exist are ignored.
2. Season pass: `recommendTeams({ teams: seasonTeams', teamTier: seasonTier, ... })`.
3. If `portfolioTeams.length < maxTeams`: legacy pass with `seedEntries = season addTeams`, `lockedTeams` same,
   legacy teams whose normalized 3-hero set equals any season team are removed; legacy entries get
   `source: 'legacy'` and are appended after season entries (never interleaved).

## `suggestTacticSubstitutes`
```js
suggestTacticSubstitutes({ holderName, missingTactic, teamTactics, usage, ownedTactics, reservedTactics })
  → [{ tactic, configCount }]  // sorted by configCount desc, then name; max 3
```
Candidates = tactics the same hero carries in other configs of the selected season (`usage`), owned,
not the missing one, not already in the team, not reserved by the current portfolio.

## State
`tacticOverrides` persisted in `tqccl.rosterRecommend.scanState.v1` (allowlist serializer, strings capped,
max 20, dedupe by `teamId+heroIndex+slotIndex`); `applyScanResult`/`clearRosterScanState` keep/clear consistently.

## Tests (red first)
- Season portfolio of 3 + legacy fills to 5, legacy last, no shared hero/tactic across passes.
- Legacy duplicate (same hero set) never appears.
- Override turns a `missing-tactic` team into a portfolio entry with `usedAlternatives[0] = {from, to}`.
- Substitutes exclude unowned/reserved/in-team tactics; ordered by count.
- State round-trip keeps overrides, drops malformed ones.
