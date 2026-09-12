---
phase: 3
title: "Validation and release readiness"
status: completed
priority: P1
effort: "1–2d"
dependencies: [1, 2]
---

# Phase 3: Validation And Release Readiness

## Overview

Prove the Team chuẩn and Team khác browser is source-accurate, backward compatible and ready for publication. This phase validates behavior, artifacts, screenshots and rollback without deploying or expanding MCP gameplay behavior.

Context: [brainstorm](../reports/brainstorm-260912-team-chuan-team-khac.md), [Phase 1](./phase-01-start.md), [Phase 2](./phase-02-browser-and-details.md). `CODE_ROOT` is `/Users/plateau/Project/worktrees/CamNangTQCCL-season-team-lookup`; all code/test paths below resolve there. Reports resolve under `/Users/plateau/Project/CamNangTQCCL/plans/260912-0950-recommended-season-browser/reports/`. Keep dirty main separate. Node 24.20.0 and Python 3.12 are the execution baseline; verify actual versions before tests.

## Requirements

- Functional: run the full focused test matrix for parser, projection, UI state, browser behavior, artifact publication and regression surfaces.
- Functional: produce release evidence showing Team chuẩn and Team khác public artifacts are declared, hash/read guarded, source-honest, and excluded from VN gameplay/MCP eligibility unless a separate reviewed config path exists.
- Functional: document user-visible behavior only where it changes navigation, source display, setup commands or maintainer ownership.
- Non-functional: preserve dirty unrelated WIP; do not commit, push or deploy unless the controller explicitly authorizes those actions later.
- Non-functional: no publication can claim Global/VN live tier, ruleset validity, roster recommendation readiness or source freshness beyond the captured source snapshot.

## Architecture

Validation follows the actual data flow:

1. source cache fixtures and real captured cache validate Team chuẩn importer/projection;
2. existing local team fixtures validate Team khác dedup/admission against the whole Team chuẩn corpus;
3. public artifact manifest validates that Team chuẩn/Team khác browse data is routeable, Team khác contains admitted rows only, and no private evidence subtree leaks;
4. browser tests load fixture and real candidate data through the same route shape used by Astro;
5. regression tests prove existing season gameplay, Khaihoang, Cùng Tồn, roster scan/recommend and MCP worker still consume their old contracts.

Existing release contracts to preserve:

- strict root public artifact matching in `src/lib/root-static-artifacts.ts:47-73`;
- hash-pinned season model loading in `src/lib/root-static-artifacts.ts:121-128` and `js/season-ui-state.js:8-18`;
- Worker/data manifest exact artifact names in `mcp-worker/src/data/artifact-contracts.ts:5-24` and exact-byte validation in `mcp-worker/src/data/artifact-contracts.ts:337-380`;
- source gameplay documentation boundary in `docs/season-team-data.md:32-59` and Recommended internal evidence boundary in `docs/season-team-data.md:74-90`.

## Related Code Files

### File inventory and phase dependency map

`P1 frozen scopes + identity + variants → coherent generation → P2 routes + state + consumers → P3 integration tests → check, build, verify → docs/evidence`. P3 runs after P1/P2; shared code, generation and dictionary edits are serialized with unified lookup. Return failures to the owning seam with a failing assertion before changing behavior.

| Files at CODE_ROOT | Action/owner | Baseline definition count or dependency |
|---|---|---|
| `tests/test_sgsdeck_recommended.py` | Run P1 regression | 14 tests verified passing in audit |
| `tests/test_crawl_sgsdeck_recommended.py`, `tests/test_recommended_identity.py`, `tests/test_recommended_team_dedup.py`, `tests/test_build_recommended_reference.py` | Run P1-created tests; add integration failure cases if missing | New files owned by P1 |
| `tests-js/recommended-reference-state.test.mjs`, `tests-js/recommended-reference-artifacts.test.mjs`, `tests-e2e/recommended-browser.spec.mjs` | Extend P2 integration coverage | Generation, state, aliases, source content |
| `tests-e2e/season-lookup.spec.mjs` | Run migrated assertions from P2 | 23 declarations; loops expand runtime cases |
| `tests-js/astro-dist-contract.test.mjs`, `tests-js/runtime-asset-contract.test.mjs` | Run root/scoped contract integration | 10 and 6 declarations |
| `tests-js/frontend-shell-contract.test.mjs`, `tests-js/frontend-shell-contract-assertions.mjs`, `tests-js/pages-headers-contract.test.mjs` | Validate canonical nav and historical aliases; header coverage for scoped URLs | Shell 4, headers 3 declarations; RegExp.test is not a test declaration |
| `mcp-worker/test/release/verify-release.test.ts`, `mcp-worker/test/release/season-worker-assets.test.ts` | Add/run browse-exclusion integration cases | 4 and 5 direct `it` declarations, plus 2 and 4 `it.each` declarations; runtime cases expand |
| `scripts/verify-astro-dist.mjs`, `src/lib/recommended-reference-artifacts.ts` | P2-owned implementation; correct only when integration assertion fails | Same declared scoped path/byte inventory for routes and verifier |
| `mcp-worker/src/generated/workflow-build.ts` | Regenerate only if actual workflow inputs change | No manual hash edits or browse-only closure expansion |
| `docs/season-team-data.md`, `docs/design-guidelines.md` | Read then update actual maintenance and UI changes | Link CLI/schema owners instead of duplicating schemas |

Counts are source inventories, not claims that new tests have run. The list below names further delivery artifacts, not parallel file ownership.

- Modify/create: `tests-js/recommended-reference-state.test.mjs`
- Modify/create: `tests-js/recommended-reference-artifacts.test.mjs`
- Create: `tests/test_recommended_team_dedup.py`
- Modify/create: `tests-e2e/recommended-browser.spec.mjs`
- Modify: `tests-js/astro-dist-contract.test.mjs`
- Modify: `tests-js/runtime-asset-contract.test.mjs` if new public assets are served by existing runtime path
- Modify: `mcp-worker/test/release/verify-release.test.ts` only to assert Team chuẩn is excluded or explicitly publication-classed as non-gameplay source reference
- Modify: `docs/season-team-data.md` only after reading it and only if behavior/commands/ownership changed
- Create: `plans/260912-0950-recommended-season-browser/reports/validation.md`
- Create: browser screenshots under the plan reports folder, not tracked app source, unless repo practice requires otherwise

### Interface and consumer checklist

- [x] `verifyAstroDist()` (`scripts/verify-astro-dist.mjs:26`): direct CLI and dist tests consume the same scoped inventory as Astro routes; enforce exact bytes, missing/unexpected/symlink rejection.
- [x] Root `PUBLIC_ARTIFACTS`, `root-static-artifacts.ts` readers and root data routes retain basename-only/exact inventory; scoped helper never becomes an arbitrary file reader.
- [x] Root HTML pins one generation; index, details and Team khác validate against it, with no independent mutable-current advance between fetches.
- [x] `onOpenTeam()` preserves Recommended source, legacy original and reviewed gameplay config destinations independently of browse admission.
- [x] `REPOSITORY_GATE_COMMANDS` (`mcp-worker/scripts/check-repository.ts:21`) keeps broad suites and dry-run; failures remain visible.
- [x] MCP loaders retain existing approved gameplay artifacts; browser source scores cannot enter recommendation by proximity.
- [x] Header test at `tests-js/pages-headers-contract.test.mjs:69` enumerates scoped routes; existing `/data/*` revalidation policy remains sufficient.

## Integration test scenario matrix

| Fixture/scenario | Observable assertion | Test owner / command group |
|---|---|---|
| Captured S28/Binh Diễn and full acquired inventory | Source tiers independent of score; every intended scope reconciles, empty/uncollected/blocked distinct | P1 Python suite below |
| Two generations, tampered index/detail | No mixed render; last-good or explicit unavailable; unrelated tools still work | artifacts unit + Recommended E2E |
| Interruption after source or dedup staging | Current pointer stays unchanged; resume never publishes half a generation | P1 builder tests |
| Initial legacy unknown source, duplicate/distinct variants | Distinct shown with honest source, duplicate absent; no fresh battle-report gate | dedup + Recommended E2E |
| Known and unknown local seasons | All/unknown discovers unknown rows; exact season only verified attribution | reference-state + Recommended E2E |
| Alias with mixed query/config/detail, navigation and history | One active detail owner; no filter spillover or stale alias restriction | reference-state + seasonal E2E |
| Soi đội/Gợi ý đội open an excluded duplicate or exact config | Correct original/config opens; gameplay score eligibility preserved; no duplicate in Team khác list | seasonal E2E |
| Missing/extra/symlink/tampered output | Reader/verifier rejects; internal cache and ledger never reach dist | artifacts unit + dist tests |
| Raw source markup and unsafe href | Source rendered as text; no script execution or unsafe link | render + Recommended E2E |
| 320/375/768/1280 × light/dark, keyboard | No overflow; visible tactics/books; dropdown/focus/sticky header work; before/after filter style preserved | Recommended E2E screenshots |
| Browse generation beside gameplay artifacts | MCP ignores browse-only rows; current IDs and gameplay model remain compatible | MCP release tests |

## Tests-first sequence

**Tests Before:** verify baseline and run narrow P1/P2 suites; add a failing assertion for any missing integration case before fixing its seam. Save command, exit code, fixture hash and actual cause in `reports/tdd-integration-red.log`. Already-green invariants are regression; syntax/import/environment errors are not behavioral Red.

**Refactor:** fix only the owner seam; never loosen allowlists or delete gameplay assertions to satisfy new navigation. Reach Green, simplify if useful, rerun the same gate and save Green/Refactor evidence.

**Tests After:** complete the matrix using captured source through production paths, including generation failures and migration callbacks. Unobserved source variants are a fixture gap, not invented production evidence. Screenshots use `testInfo.outputPath`; compare tracked PNG hashes before/after.

**Regression Gate:** execute the ordered commands below; `test:dist` needs a fresh build. Before E2E inspect port 4174; Playwright owns the build/preview process and must stop it. Never move to another port or stop the user's port 4321 server to hide a collision.

Immediately before both direct E2E and `check:repository`, save `lsof -nP -iTCP:4174 -sTCP:LISTEN` output. If occupied, inspect the exact PID with `ps -p <pid> -o pid,ppid,command` and `lsof -a -p <pid> -d cwd`; record ownership and block unless the process belongs to this task and can be stopped cleanly. Record effective Playwright config/baseURL/webServer ownership and final listener state. This is an operator preflight, not an assertion that `check:repository` implements it. Existing generic pre-child CLI errors remain failures; record the gate exit/output without inventing a diagnosis or logging environment values. Improving that unrelated CLI diagnostic is outside this browser plan.

## Implementation Steps

1. Run focused Python tests for source parsing/projection and Team khác dedup:
   - `python3 -m unittest tests.test_crawl_sgsdeck_recommended tests.test_sgsdeck_recommended tests.test_recommended_identity tests.test_recommended_team_dedup tests.test_build_recommended_reference`
2. Run focused JS unit tests:
   - `node --test tests-js/recommended-reference-state.test.mjs`
   - `node --test tests-js/recommended-reference-artifacts.test.mjs`
   - `npm run test:contracts`
   - `npm run check`, then `npm run build`, then `npm run test:dist` and `npm run verify`; never run dist-dependent tests against stale output.
3. Run browser E2E with fixture and real captured scope:
   - `npm run test:e2e -- tests-e2e/recommended-browser.spec.mjs tests-e2e/season-lookup.spec.mjs` (runner builds and manages preview itself);
   - 320, 375, 768, 1280 widths;
   - light and dark themes;
   - keyboard path through season dropdown, facets, cards, detail open/close;
   - old `#team-pk` and `#meta-cu` aliases into Team khác;
   - Team khác note `Các đội có sẵn, đã đối chiếu với Team chuẩn.`;
   - duplicate legacy detail alias remains reachable without listing the duplicate in Team khác;
   - empty season/category message versus no filter match.
4. Review migrated seasonal E2E results using Phase 2 preserve/migrate matrix; retain Khaihoang/Cùng Tồn/roster/analyze invariants at their surviving destinations.
5. Broaden once after narrow gates because shared/public contracts changed: `npm run test:node` and `python3 -m unittest discover -s tests`. Avoid duplicate reruns unless code changes or failures justify them.
6. Run MCP worker release tests only to prove no accidental gameplay expansion:
   - `npm --prefix mcp-worker run test:release` and `npm --prefix mcp-worker run typecheck`;
   - data manifest still accepts the intended artifact version;
   - Team chuẩn source reference is absent from `tqccl_recommend_team`/season gameplay results unless a separate reviewed config path exists;
   - Team khác does not receive SGSDeck score/tier by implication;
   - search/get contracts remain compatible for existing teams.
7. Inspect generated `dist/` or worker asset output for source leakage: internal evidence files, raw cache HTML, private source manifests and unreviewed provenance must not be public except approved source URL/region/snapshot fields.
8. Update docs minimally if user-visible navigation or maintenance commands changed. Read the target doc first; `docs/season-team-data.md:74-90` is the likely owner for Team chuẩn boundaries and `pipeline/recommended-other-teams.json` ownership.
9. Write `reports/validation.md` with test commands, pass/fail output summaries, screenshot paths, artifact hashes, known limits and rollback instructions.

If actual inputs in `mcp-worker/workflow-source-manifest.json` change, regenerate using `npm --prefix mcp-worker run generate:workflow-build`, then `check:workflow-build`; otherwise only check. Never add browse-only sources to gameplay closure merely to alter its fingerprint. Release packaging is separately gated: `build:worker-assets`, `verify:worker-assets`, then `check:repository` under `mcp-worker`. Respect existing clean-source prerequisites; record an unmet packaging condition rather than fabricate attestation or auto-commit/push/deploy. Feature validation passing is not deployment permission.

## TDD Gates

These are planned behavioral checks, not test results. Record actual Red failures before implementation; retain already-passing invariants as regression checks.

- Red: public artifact validation allows an undeclared Team chuẩn or Team khác data file; Green: only declared routes/assets are served.
- Red: MCP release test sees Team chuẩn source reference as an eligible VN gameplay recommendation; Green: MCP gameplay contracts exclude it or mark source-reference only.
- Red: Team khác row receives SGSDeck score/tier through the combined browser; Green: only Team chuẩn rows show SGSDeck score/tier.
- Red: existing non-duplicate local team is blocked for missing new research/chiến báo evidence; Green: it appears with `Nguồn chưa xác định` or existing source label.
- Red: future external candidate without research/chiến báo source is admitted; Green: it is rejected from Team khác.
- Red: duplicate is checked only against the selected source season; Green: dedup checks against the whole Team chuẩn corpus.
- Red: public Team khác artifact includes duplicate or review-pending rows; Green: public artifact includes admitted rows only and internal reports carry counts/links.
- Red: Team khác detail exposes admission/dedup internals; Green: detail shows user-facing local team content and honest source label.
- Red: browser at 320px overflows after the grouped dropdown opens; Green: no horizontal overflow, controls remain target-size and focus-visible.
- Red: old `#team-pk` link loses original TeamPK detail after nav migration; Green: alias filters admitted Team khác rows and exact original detail remains reachable even when that configuration is excluded from the list.
- Red: empty S21/siege page and no-filter-match state show the same message; Green: messages are distinct.
- Regression: all existing season lookup tests that protect Khaihoang latest behavior, Cùng Tồn scope, roster scope reset and source score exactness remain green.

## Success Criteria

- [x] Python source/projection/dedup tests pass, including 29-season, S28 mixed faction, score>100, T2 82/72, detail holder/tactic/book cases and Team khác dedup.
- [x] JS state/artifact tests pass with duplicate query rejection, facet preservation, Team chuẩn/Team khác separation and fixed ranking.
- [x] Browser E2E passes across required widths/themes with screenshots saved to reports.
- [x] Astro check/build and public artifact validation pass.
- [x] MCP/release tests prove no accidental Team chuẩn-to-gameplay expansion and no SGSDeck score assignment to Team khác rows.
- [x] Team khác public artifact contains admitted rows only; duplicate/review-pending counts and links remain internal.
- [x] Docs reflect changed navigation/maintenance boundaries only if the implementation changed them.
- [x] Validation report includes commands, evidence paths, hashes, rollback and unresolved limits.
- [x] Source inventory, admitted/duplicate/pending counts and generation hash are recorded; 29 labels alone never establish full corpus coverage.
- [x] Feature validation and release packaging outcomes are reported separately; no unrun gate is marked complete.

## Risk Assessment

| Risk | Likelihood x Impact | Mitigation |
|------|---------------------|------------|
| Test fixtures pass but real captured source fails | Medium x High | Run both fixture and real captured cache paths; record source snapshot hash and blocked scopes. |
| Build passes but static route misses scoped detail file | Medium x High | Add Astro route tests for every manifest scope/detail key. |
| Team chuẩn leaks into MCP gameplay | Medium x High | Add negative MCP tests and keep source-reference publication class separate. |
| Team khác row gets SGSDeck score by proximity | Medium x High | Add source-separation tests; require exact Team chuẩn provider/sourceConfigId for SGSDeck fields. |
| Initial existing teams are falsely presented as battle-report sourced | Medium x High | Assert generic Team khác heading note and per-row `Nguồn chưa xác định` when needed. |
| Duplicate membership ignores tactic ownership | Medium x High | Assert holder-order-insensitive but hero-assigned tactic dedup keys. |
| Browser screenshots are generated into tracked app paths | Low x Medium | Save screenshots under plan reports or test output only; compare tracked screenshot hashes like current E2E guard at `tests-e2e/season-lookup.spec.mjs:8-16`. |
| Dirty main/worktree hides unrelated failures | High x Medium | Record git status before and after; stage/commit/deploy remain out of scope. |

## Rollback

Rollback is file-scoped: restore nav aliases/routes, remove Team chuẩn/Team khác public asset declarations/routes, and point Team chuẩn manifest to the previous accepted source set or disable the browser with a clear unavailable state. Do not delete legacy TeamPK/MetaCu data, Team khác intake ledger, Khaihoang data, season sidecars, public dictionary artifacts, MCP worker release assets, or source cache evidence unless a later explicit cleanup plan authorizes it.
