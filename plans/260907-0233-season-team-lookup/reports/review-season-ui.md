# Review: Phase 03 season lookup UI

Date: 2026-09-12
Reviewer: code-reviewer
Scope: read-only review of the Phase 3 UI slice. Code was not modified; this report is the only file written.

## Scope

Reviewed plan and decision records:

- `plans/260907-0233-season-team-lookup/phase-03-season-lookup-interface.md`
- `plans/260907-0233-season-team-lookup/reports/execution-decisions.md`
- `plans/260907-0233-season-team-lookup/reports/phase-03-ui-validation.md`

Reviewed UI and shell source:

- `js/season-ui-state.js`
- `js/app.js`
- `js/render.js`
- `js/team-filter-section.js`
- `js/team-pk.js`
- `js/meta-cu.js`
- `js/analyze.js`
- `js/roster-recommend-ui.js`
- `js/roster-scan-state.js`
- `js/team-recommend-engine.js`
- `src/pages/index.astro`
- `css/styles.css`
- `src/lib/public-artifact-manifest.mjs`

Reviewed targeted tests:

- `tests-js/season-ui-state.test.mjs`
- `tests-js/season-context.test.mjs`
- `tests-js/team-recommend-engine.test.mjs`
- `tests-js/team-tier-badge.test.mjs`
- `tests-js/derive-team-faction.test.mjs`
- `tests-js/frontend-shell-contract.test.mjs`
- `tests-js/runtime-asset-contract.test.mjs`
- `tests-js/astro-dist-contract.test.mjs`
- `tests-e2e/season-lookup.spec.mjs`

## Scout findings

Local scout targets were URL/state restoration, hash activation, context fallback, detail opening, source score display, stale async scan/recommendation state, legacy Khai hoang compatibility, Cung Ton reference rendering, and mobile/keyboard behavior.

No unreviewed dependent UI owner was found beyond the noted `team-filter-section.js` keyboard-chip focus restoration. Latest frozen source preserves focus through `data-focus-key` before replacing filter chips and restores the matching button after render. The focused browser test `keyboard facet and source toggles preserve focus and pressed state after filtering` passes.

## Overall assessment

PASS. I found no source-grounded open findings in the Phase 3 UI slice.

Score: 9/10
Critical count: 0
High count: 0
Medium count: 0
Low count: 0

## Findings

No open findings.

## Spec compliance notes

- Shared season controls and URL ownership are present in `app.js` and `season-ui-state.js`: `scenario`, `ruleset`, `q`, filters, sort, and `config` are parsed through one query owner; duplicate scalar values become invalid/ignored with notices; `updateSeasonURL` preserves hash and query state. Browser tests cover scenario-only restore, invalid pair, close/back behavior, and query retention.
- Hash activation is fail-closed. `loadSeasonModel` requires all season sidecars plus referenced canonical datasets, verifies SHA-256 bytes, and validates the full model before enabling scoped UI. Runtime/dist contract tests cover the exact five sidecars, resolver publication, missing sidecar rejection, mixed data fallback, and optional legacy `team-tier.json`.
- Legacy behavior remains distinct. When no scoped model is active, `app.js` initializes the legacy Team PK and Meta sections; Khai hoang is appended from `khaihoang.json` and is not season-filtered. E2E coverage confirms Khai hoang remains visible, legacy tiers stay in `legacyRankings`/`legacyTier`, and optional missing `team-tier.json` does not break cards.
- Seasonal card/detail identity is config-specific. `app.js` derives rows from the shared projector and opens detail by `configId`; cards count configurations and separate applicable/reference/unknown classifications. Detail renders ordered holder slots, tactics, books, raw effect labels, conditions, provenance, and missing-field text.
- Source score handling matches the contract. Cards and recommendation results use `resolveSelectionScore` against the displayed/final selection, keep original values such as `132.5`, do not clamp above 100, and fall back to “Chưa có điểm SGSDeck” when the visible selection no longer matches the scored source selection. Detail selection changes re-resolve score live.
- Cung Ton reference rendering is scope-safe. `projectSeasonBrowse` provides applicable/scenarioReference/unknown buckets; `createSeasonCoexistSection` renders counts and labels separately; `seasonCoexistGroup` uses text nodes for raw multiline source fields and only uses validated source URLs from the shared model. E2E tests cover source text escaping, exact-pair versus scenario-reference counts, and no PK tier/source score on reference groups.
- Inventory and scan state fail closed on scope changes. `initAnalyze` and `initRosterRecommend` increment a generation counter on scope changes; late scan responses cannot repopulate stale state. Scenario-only/invalid gameplay is disabled unless the user explicitly opts into outside-scope reference viewing for analysis. Roster state preserves config identity for locks while clearing confirmation on scope changes.
- Candidate cap behavior is shared with MCP/core. Roster recommendation projects exact scoped candidates before the local engine, rejects 501 eligible configs with the same count/limit semantics, and does not render stale portfolios after rejection. The 500/501 E2E cases cover this boundary.
- Mandatory/unknown conditions are messaged without overclaiming. Detail and inventory comparison state “Chưa xác minh điều kiện”; mandatory conditions add the “chưa thể đề xuất” claim, while optional unverified conditions remain informational. Tests cover both paths.
- Accessibility/mobile coverage is material. CSS sets 44px controls, responsive season controls/details, focus outlines, text wrapping, and mobile select font sizing. E2E checks 320/375/768/1024 widths in light/dark, focus visibility, no horizontal overflow, sticky-header-safe detail opening, close focus restoration, and chip `aria-pressed` focus retention.

## Verification run during review

```text
node --experimental-strip-types --test tests-js/season-ui-state.test.mjs tests-js/season-context.test.mjs tests-js/team-recommend-engine.test.mjs tests-js/team-tier-badge.test.mjs tests-js/derive-team-faction.test.mjs
# tests 68; pass 68; fail 0

npx playwright test tests-e2e/season-lookup.spec.mjs --project=astro
# 28 passed

node --experimental-strip-types --test tests-js/frontend-shell-contract.test.mjs tests-js/runtime-asset-contract.test.mjs tests-js/astro-dist-contract.test.mjs
# tests 20; pass 20; fail 0

npm run check
# Result 9 files: 0 errors, 0 warnings, 0 hints
```

## Residual risk

This review did not cover unfinished UI/MCP consumer work outside the Phase 3 UI slice. I did not run the full repository gate locally; root reported the broader current gate separately. No deployment, commit, or source mutation was performed.

Status: DONE
Summary: Phase 3 UI implementation matches the reviewed plan and execution decisions. No open priority findings remain after checking the frozen keyboard focus change and rerunning focused UI, browser, shell/runtime/dist, and Astro validation.
Concerns: None for this slice.
