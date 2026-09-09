---
title: "Phase 3: Integration and docs"
status: completed
phase: 3
priority: P1
effort: ""
dependencies: [2]
---

# Phase 3: Integration and docs

## Overview

After data and UI are GREEN, prove real runtime JSON reaches the built route and all 11 images are accounted for. Update only owning architecture documentation; unresolved image input prevents final completion.

User selected roster-level guide/score ownership on 2026-09-09. Consume Phase 1's parent-team guide contract and Phase 2's persistent guide display; keep build-specific tactics/commanders separate.

## Requirements

- [x] All 11 reviewed dispositions, supported Node 22 gates, real-route behavior and canonical/dist parity.
- [x] Preserve independent mines/Chạm Sứ, internal metadata and unrelated WIP.

## Related files and test inventory

| Action | File / surface | Responsibility |
|---|---|---|
| Modify if gaps found | `tests-js/khaihoang-data.test.mjs`, `tests-e2e/khaihoang-options.spec.mjs` | Actual JSON and full integration coverage |
| Modify | `docs/system-architecture.md` (~171 lines) | Owning Khai hoang contract and runtime path |
| Create | `plans/260907-0353-khai-hoang-team-details/reports/implementation-validation.md` | Commands, RED/GREEN, image coverage, review, limits |
| Read | `src/lib/public-artifact-manifest.mjs`, `src/pages/data/[file].json.ts`, analogous JS/CSS routes | Canonical static assets |
| Read | `scripts/verify-astro-dist.mjs`, `tests-js/astro-dist-contract.test.mjs`, `tests-js/runtime-asset-contract.test.mjs`, `package.json`, `playwright.config.mjs` | Distribution and environment gates |

Research baseline: focused data tests 3/3 passed; Playwright discovered 21 cases across 3 files, including 7 Khai hoang cases. Discovery is not E2E success. Totals may increase. Historical parser counts remain separate from curated runtime totals.

## Architecture and documentation

`js/app.js` loads JSON and mounts the renderer. Root JSON/JS/CSS are canonical; Astro routes copy exact bytes. Never patch `dist/` or public copies. Existing manifest already covers touched assets; a genuinely new runtime module requires allowlisting and inventory tests, not silent deployment omission.

Read architecture before updating. Document optional `teams[].guide` for the three-hero roster, six groups, note-only detail support, current-only main presentation, neutral variants and internal metadata retention. Explain the shared guide's applicability note, no `variant.guide`, guide/disclosure persistence outside `.kh-build`, and separate build-specific tactics/commanders. Explain per-roster ranking versus global mines and split/transition versus Chạm Sứ. Correct stale root `app.js` reference to `js/app.js` in the owning section. No unrelated docs/changelog churn.

## Implementation Steps

1. Re-read phase outputs and full ledger; map every image to its parent three-hero roster, guide fields and justified omissions. Review researched build/stage mappings separately. No unresolved row counts as complete and no final team count is hardcoded.
2. RED: add missing real-route checks on `/#khaihoang` using actual JSON and independent source expectations, catching fixture-only rendering or wrong roster attachment. Reuse Phase 2 coverage and add only missing cases: exactly one parent guide and applicability note remain unchanged/open across variant switches while tactics/commanders change; separate cards retain their own guides. Also verify image 9's exact SP Chu Tuấn → Gia Cát Khác commander labels, image 7's verified Trương Xuân Hoa after-stage label, and each hero's exact stage units/tactic slots and deliberate omissions from Phase 1. Cover selected root builds as well as variants. Require meaningful assertion failure; if the behavior already passes, record it as regression coverage rather than fabricate RED.
3. GREEN: fix integration gaps at their owner. Inspect JSON diff against snapshots, including unchanged legacy alias/compound fields on builds receiving guides; retain Phase 1's strict canonical checks for new/changed references without global normalization. Reconcile any shared renderer overlap with the season plan without restoring Khai hoang season/source display.
4. Execute sequential gates below on supported Node 22; record actual version, exit codes and failure evidence. Unsupported environment is setup work, never waived verification.
5. Update owning docs and verify references/claims against final source and scripts. Rerun executable checks only if changes or findings justify it.
6. Use review capability/reviewer for the changed public display/data contracts. Resolve evidence-based findings, preserve explicit user decisions, and compare all plan acceptance criteria with final artifacts.
7. Record all-11 coverage, command evidence, responsive screenshots/observations, artifact parity, diff inventory and remaining limitations. Clean up only owned processes. No commit/deploy.

## Todo

- [x] Real-route/source coverage verified.
- [x] Required gates and scoped documentation complete.
- [x] Review, all-11 acceptance and owned-process cleanup recorded.

## Exact gate sequence

Working directory: `/Users/plateau/Project/CamNangTQCCL`. Shell observed v24.14.0; package requires `>=22.12.0 <23`. A compatible Node install has not been confirmed. Discover the actual installed manager/runtime, select a compatible Node 22 or resolve the missing prerequisite; do not guess a path or change engines.

```sh
node --version
node -e 'const [major,minor]=process.versions.node.split(".").map(Number); if(major!==22 || minor<12) process.exit(1)'
node --test tests-js/khaihoang-data.test.mjs
lsof -nP -iTCP:4174 -sTCP:LISTEN
npx playwright test tests-e2e/khaihoang-options.spec.mjs --project=astro
npm run check
npm run test:node
npm run test:e2e
npm run test:dist
npm run verify
```

No listener from `lsof` is expected. Inspect existing owner rather than killing user processes. Playwright runs `npm run build && npm run preview -- --host 127.0.0.1 --port 4174`, reuse disabled, and keeps failure traces. Run suites sequentially. If no successful browser build occurred, run `npm run build` before dist tests/verifier. Resolve missing browser/tooling setup and rerun; do not count attempted commands as passes.

Track command, PID, port and worktree for manually started long-running processes. Let harness cleanup finish; stop only owned leftovers. Do not start duplicates or increment ports.

## Integration matrix

| Contract | Failure caught | Passing evidence |
|---|---|---|
| All 11 source mappings | Missing/wrong roster guide or researched build | Complete reviewed ledger with separate roster-guide and build-stage assertions |
| Actual JSON on route | Fixture-only implementation | Literal expected summaries, order and steps on named cards |
| Shared roster guide and independent builds | Guide disappears, changes, duplicates or collapses on selection | One persistent parent guide and applicability note; unchanged disclosure state, updated selected tactics/commanders and independent neighboring cards |
| Root/variant stage identity | Missing/wrong in-roster commander, misplaced tactics or inferred missing stage | Actual route matches Phase 1's exact commander/unit/tactic expectations and explicit omissions for images 7/9 |
| Canonical check scope and legacy retention | Broad validator rejects legacy or cleanup changes unrelated fields | Strict new/changed reference checks pass; unchanged legacy fields equal recorded pre-edit values |
| Current-only main UI | Legacy banner/link remains | No provenance in main display; internal data and Chạm Sứ links retained |
| Other teams/mines/Chạm Sứ | Broad collateral edit | Scoped diff/snapshots and retained checks |
| Full Node and browser suites | Shared rendering/CSS regression | All discovered checks pass; no weakened contracts |
| Dist/public assets | Stale bytes/missing module | `test:dist` and `verify` pass from canonical sources |
| Docs and resources | Stale claims/orphan preview | Verified paths, behavior and harness exit |

## Success Criteria

- [x] Schema has one owner and all layers agree: one parent-roster guide, no variant guide, persistent disclosure and applicability note, including warnings, note-only splits and ordered transition steps.
- [x] All 11 images resolved; confirmed image 2 identity retained and 7/9 representation no longer pending.
- [x] No personal inventory, invented main tactics or borrowed global rankings.
- [x] Exact root/variant commander, unit and learned-tactic expectations pass on the real route; unchanged legacy fields remain intact.
- [x] Node 22, focused/full tests and canonical/dist verifier pass with recorded evidence.
- [x] Owning docs verified, public-contract review complete and unrelated WIP preserved.
- [x] No commit/deploy; process cleanup and limitations reported honestly.

## Risks and rollback

| Risk | Observable signal | Response |
|---|---|---|
| Input still missing | Unresolved image row | Keep delivery pending, obtain evidence; continue independent verification |
| Unsupported runtime | Version gate fails | Resolve compatible Node, rerun; never relax engines |
| Artifact mismatch | Verifier reports different bytes | Rebuild canonical assets and inspect route/manifest; never edit dist |
| Plan collision | Shared change restores forbidden UI | Controller reconciles accepted boundaries and repeats impacted checks |
| Existing unrelated failures | Failure reproduces outside task | Report baseline evidence; never hide failure or claim all gates passed |

Rollback task-owned canonical/documentation hunks only, then rebuild if needed; preserve recorded pre-edit WIP. No external production state changes.

## Unresolved questions

- Guide-score ownership is resolved: the user selected the three-hero roster. Remaining curation must preserve any tactic/unit/stage conditions; no source evidence or user decision establishes a separate score for each selected build.
- Image 7 before level 20: both user proposals remain personal assessments; commander positions, mechanics (especially Tam Thế) and battle verification are unresolved. Do not infer these from the level-32 build.
- Image 9 tactics and commanders are resolved in the research report for both the pre-20 and observed level-22 stages, including SP Chu Tuấn → Gia Cát Khác. Do not reopen the superseded missing-post-awakening-tactics question. Independent/current confirmation for the researched builds remains a source limitation, not missing tactic slots or proof of universal optimality.
- Complete overview/split/transition transcription for all 11 images and retain any scale qualifications. Finish Phase 1's reviewed dispositions before final completion; do not count unresolved input as delivered.
