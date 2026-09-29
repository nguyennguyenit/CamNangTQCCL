# Phase 5 — Localization, e2e, docs, cleanup

## Localization (see docs/deployment-guide.md:265-283)
- New `L(vi, zh)` literals → obligations in `pipeline/site_localization.py` `UI_LITERAL_OBLIGATIONS`
  (follow existing `ui:roster/*` class choice); translate-class strings need ledger + receipts.
- Add `js/roster-season-candidates.js` to roster section entrypoints if it renders text; re-pin sha256 in
  `sourceFiles` for every touched tracked file (app.js, roster-recommend-ui.js, roster-scan-state.js,
  team-detail-navigation.js, team-filter-section.js, worker/src/schema.ts …).
- New `policyVersion`; refresh `baseline.notes` from `inventory`; build → check → publish → check public → prune;
  re-pin `pipeline/team-route-handles.json` generationId + `--check`.
- `npm run generate:workflow-build` (engine is an mcp-worker semantic file).

## E2E
- `tests-e2e/season-lookup.spec.mjs` "tool pages drop old season links and run on the legacy teams":
  rewrite to the new contract (`?season=` kept, scenario/ruleset still dropped, results from season).
- `tests-e2e/beta-tools.spec.mjs` "Gợi ý đội": season select default, legacy label, Thiếu món actions,
  "Vì sao?" with mocked Worker route.
- `tests-js/astro-dist-contract.test.mjs`: page still has no `#season-controls` (select is in-tool) — keep.

## Docs
README, docs/system-architecture.md, docs/code-standards.md (SECTION_QUERY_KEYS row), docs/design-guidelines.md,
worker/README.md (new mode), docs/project-changelog.md; remove statements that tool runs on legacy teams only.

## Done means
See plan.md "Confirmed outcome" + all gates green.
