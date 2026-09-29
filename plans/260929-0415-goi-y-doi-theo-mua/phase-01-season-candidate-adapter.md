# Phase 1 — Season candidate adapter (TDD)

## Goal
Pure module turning Recommended `index.json` records of one season into engine candidates in the
exact `data/teams.json` shape `recommendTeams` already consumes (non-season path: `team.id` +
`teamTier[{teamId, rankings}]`). No engine changes; `seasonContext` stays unused.

## Files
- Create `js/roster-season-candidates.js` (ES2022, no deps beyond `hero-identity.js`, `filters.js`).
- Create `tests-js/roster-season-candidates.test.mjs`.

## Contract
```js
buildSeasonCandidates(records, seasonId, { heroesDict, tacticsDict }) → {
  teams: [{ id: sourceConfigId, name: displayNameVi, source: 'season', seasonId, tier,
            heroes: [{ name, baseName, isSP, alternatives: [], tactics: [{ name, alternatives: [] }] }],
            conditionalTactics: [{ heroIndex, slotIndex, raw }] }],
  teamTier: [{ teamId, rankings: [{ tier }] }],
  diagnostics: { total, mapped, unmapped: [{ configId, reason: 'hero-unmapped', names }] },
}
seasonTacticUsage(teams) → Map<heroCanonicalId, Map<tacticCanonicalName, count>>
```
- Filter `sourceSeasonId === seasonId && sourceCategoryId === '交戰'` (Khai hoang có mục riêng).
- Hero name: `nameRaw` → heroes-dict `chinese`/`aliases` (whitespace-insensitive) → `viet`; fallback
  `displayNameVi` only if it is itself a dict `viet`. Any hero unmapped → config excluded + diagnostic.
- Tactic slot: `tacticSlotsRaw` → tactics.json `chinese`/`aliases` → `viet`. `—`/`''`/`null` = empty slot
  (dropped). Unmapped non-empty or `tacticSlotKinds[i] !== 'tactic'` → `conditionalTactics`, not a requirement.
- `tier` from `tierRaw` (null → ''), so Meta mode filters untiered like legacy.

## Tests (write first, red → green)
- Maps SP/raw alias names to the same canonical id the roster scan stores (`canonicalHeroId('SP Hoàng Phủ Tung')`).
- Excludes 開荒 and other seasons; excluded unmapped config appears in diagnostics.
- Empty and bond/unmapped slots never become required tactics.
- Integration: over the pinned generation `index.json` + `data/heroes-dict.json` + `data/tactics.json`,
  mapped ratio ≥ 0.98 (reads real files; skip gracefully is NOT allowed — fail if files missing).
- `recommendTeams({ teams, teamTier, ownedHeroes, ownedTactics })` on adapter output builds a known config.

## 3.T characterization first
Run `node --experimental-strip-types --test tests-js/team-recommend-engine.test.mjs tests-js/roster-scan-state.test.mjs` green before any edit.
