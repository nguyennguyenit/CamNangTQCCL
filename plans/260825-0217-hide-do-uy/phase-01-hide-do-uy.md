---
phase: 1
title: "Ẩn Đô Úy ở data, website và MCP"
status: completed
priority: P1
effort: "4-6h"
dependencies: []
---

# Phase 1: Ẩn Đô Úy ở data, website và MCP

## Requirements

- Functional: loại toàn bộ team `source === "do-uy"` và tier/facet liên quan khỏi artifact công khai; bỏ UI/module; chặn lại ở MCP boundary.
- Non-functional: thay đổi xác định, review được; không dùng full regeneration; không đổi contract công khai.

## Files to Modify

- Data/pipeline: `data/teams.json`, `data/team-tier.json`, `data/facets.json`, `pipeline/team-tier-map.json`, `pipeline/build_json.py`, `tests/test_build.py`.
- Website/publication: `src/pages/index.astro`, `js/app.js`, `src/lib/public-artifact-manifest.mjs`, `tests-js/frontend-shell-contract-assertions.mjs`, `tests-js/runtime-asset-contract.test.mjs`, `tests-e2e/spa-parity.spec.mjs`.
- MCP: `mcp-worker/src/research/research-handlers.ts`, `mcp-worker/test/research/research-handlers.test.ts`.
- Delete: `js/do-uy.js`.
- Preserve unchanged: `pipeline/do-uy-ss18-source.json`.

## Implementation Steps

1. Surgically filter `data/teams.json` by `source !== "do-uy"`; assert exact before/after counts `214 -> 166` and `48 -> 0`. Do not rebuild the file.
2. Remove all 26 `do-uy-*` entries from `pipeline/team-tier-map.json`, then regenerate only `data/team-tier.json` with `python3 -m pipeline.build_team_tier` (or make the identical reviewed edit); assert `57 -> 31` and no orphan IDs.
3. Remove only the `{ "value": "do-uy", "count": 48 }` source facet from `data/facets.json`; preserve every unrelated entry byte-for-byte where practical.
4. Remove the Đô Úy tuple from `_TEAM_FILES` in `pipeline/build_json.py`. Update `tests/test_build.py` to expect 160 buildable teams and explicitly assert the generated sources are exactly `team-intro` and `moi-phe` with no `do-uy`. Keep raw parsers/sources intact.
5. Remove the Đô Úy nav tab and section mount from `src/pages/index.astro`; remove its import, initializer, hash section and source-to-section mapping from `js/app.js`. Delete `js/do-uy.js` and its public manifest entry.
6. Update shell/runtime/E2E expectations from ten to nine sections and remove Đô Úy routing assumptions. Add artifact assertions that teams, tiers and facets contain no Đô Úy, and that the removed JS module is absent from public output. Retain generic source-filter tests because that API contract is not being narrowed.
7. In `research-handlers.ts`, project each loaded snapshot to public-visible teams before caching/building `SnapshotIndex`: filter `source === "do-uy"`, then filter tier rows against retained IDs. Use that same projected snapshot for index search/get, similarity matching, recommendation services and replacement lookup. Do not change release/workflow IDs, schemas or error mapping.
8. Add a mixed-snapshot MCP regression fixture/wrapper containing one valid team and one injected `do-uy` team+tier. Prove: empty/source search excludes it; direct get is `TEAM_NOT_FOUND`; match excludes it; both recommend tools exclude it; replacement lookup for it is `TEAM_NOT_FOUND`. Keep existing contract/schema tests unchanged and green.

## Validation

1. Run a read-only JSON audit for exact totals, source counts, tier joins and absence of `do-uy` in public facets.
2. Run focused pipeline tests: `python3 -m unittest tests.test_build tests.test_build_team_tier` (source-dependent skips must be reported, not counted as proof).
3. Run website contracts/build: `npm run test:contracts && npm run build && npm run test:dist`; run the affected Playwright section/parity tests when browser dependencies are available.
4. Run MCP gates from `mcp-worker/`: focused `npx vitest run test/research/research-handlers.test.ts`, then `npm test` and `npm run typecheck`.
5. Inspect `git diff --check`, confirm `pipeline/do-uy-ss18-source.json` is unchanged, and confirm no deploy/commit occurred.

## Risks and Mitigations

- Stale snapshot could reintroduce hidden teams: central MCP projection rejects them before every team-capable handler.
- Tier rows could become orphaned: clean the authoritative tier map first and validate all remaining joins.
- Full build could overwrite curated data: explicitly prohibit `pipeline.build_json`; use surgical edits and only the scoped tier builder.
- Removing a hash section can break old bookmarks: existing unknown-hash behavior safely falls back to Team PK; cover this in E2E.

## Rollback

Revert the data/publication/MCP changes together. Restore `js/do-uy.js` and manifest/tab wiring from version control; raw curate source remains available and untouched.

## Success Criteria

- [x] All plan-level acceptance criteria pass with command output recorded in the implementation report.
- [x] Diff contains no unrelated changes, no raw-source deletion, no deployment and no contract/schema change.
