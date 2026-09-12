# Phase 3 Red-Team Validation

Status: DONE_WITH_CONCERNS

Scope: independent read-only plan review for `plans/260912-0950-recommended-season-browser/phase-03-validation-and-release.md`, focused on current-code failure modes in `/Users/plateau/Project/worktrees/CamNangTQCCL-season-team-lookup`. I read the root plan and all phase files, then inspected only the requested current-code contracts with grep/glob/file reads. I did not run lint, build, tests, servers, browser, git mutations, network, or implementation commands.

## Ten Current-Code Phase 3 Claims

| # | Phase 3 claim | Status | Evidence |
|---|---|---|---|
| 1 | Root public artifacts are exact and basename-allowlisted. | VERIFIED | Plan cites `phase-03-validation-and-release.md:38`; code validates manifest then compares expected vs actual artifact basenames in `src/lib/root-static-artifacts.ts:47-73`, and rejects non-basename/pathy sources in `src/lib/public-artifact-manifest.mjs:60-89`. |
| 2 | Browser season model loading is hash-pinned to exact static bytes. | VERIFIED | Plan cites `phase-03-validation-and-release.md:39`; source hashes come from `src/lib/root-static-artifacts.ts:121-128`, and browser loading recomputes SHA-256 for every required artifact before parsing in `js/season-ui-state.js:5-18`. |
| 3 | Worker release data has exact v1/v2 artifact inventories. | VERIFIED | Plan cites `phase-03-validation-and-release.md:40`; artifact names are fixed in `mcp-worker/src/data/artifact-contracts.ts:5-24`, and `requireExactArtifactBytes()` rejects unknown/missing names before manifest creation in `mcp-worker/src/data/artifact-contracts.ts:337-380`. |
| 4 | `verifyAstroDist()` enforces exact bytes, missing/unexpected files, symlink rejection, and private source exclusion for current root artifacts. | VERIFIED for current root artifacts; UNVERIFIED for future scoped Recommended routes | Plan checklist is at `phase-03-validation-and-release.md:77`; current verifier compares source/emitted bytes in `scripts/verify-astro-dist.mjs:26-72` and rejects private/secret-like outputs in `scripts/verify-astro-dist.mjs:74-90`; dist tests cover missing/unexpected/symlink and built-output parity in `tests-js/astro-dist-contract.test.mjs:256-345`. The scoped helper named by the plan, `src/lib/recommended-reference-artifacts.ts`, is not present yet. |
| 5 | Existing `tests/test_sgsdeck_recommended.py` has 14 baseline test declarations. | VERIFIED | Plan inventory says 14 at `phase-03-validation-and-release.md:51`; current declarations are `tests/test_sgsdeck_recommended.py:19,31,39,50,58,62,68,72,77,82,87,92,114,123`. |
| 6 | P1/P2-created Recommended files are new planned surfaces, not current-code coverage. | UNVERIFIED / PENDING | Plan lists them as P1/P2-owned at `phase-03-validation-and-release.md:52-53`; current filesystem lacks `tests/test_crawl_sgsdeck_recommended.py`, `tests/test_recommended_identity.py`, `tests/test_recommended_team_dedup.py`, `tests/test_build_recommended_reference.py`, `tests-js/recommended-reference-state.test.mjs`, `tests-js/recommended-reference-artifacts.test.mjs`, and `tests-e2e/recommended-browser.spec.mjs`. |
| 7 | `tests-e2e/season-lookup.spec.mjs` has 23 source declarations and loops expand runtime cases. | VERIFIED | Plan says 23 at `phase-03-validation-and-release.md:54`; current declarations start at `tests-e2e/season-lookup.spec.mjs:21` and end at `tests-e2e/season-lookup.spec.mjs:310`, including loop declarations at `:150`, `:179`, and `:266`. |
| 8 | Root/dist/runtime/shell/header contract counts match the Phase 3 inventory. | VERIFIED | Plan lists 10/6 and shell 4/header 3 at `phase-03-validation-and-release.md:55-56`; current declarations are 10 in `tests-js/astro-dist-contract.test.mjs:20-327`, 6 in `tests-js/runtime-asset-contract.test.mjs:25-103`, 4 in `tests-js/frontend-shell-contract.test.mjs:21-54`, and 3 in `tests-js/pages-headers-contract.test.mjs:55-79`. |
| 9 | MCP release test files have the direct baseline declaration counts named by the plan. | VERIFIED with convention note | Plan says 4 and 5 declarations at `phase-03-validation-and-release.md:57`; direct `it(...)` counts match at `mcp-worker/test/release/verify-release.test.ts:78,101,212,226` and `mcp-worker/test/release/season-worker-assets.test.ts:28,45,54,61,75`. Both files also contain `it.each(...)` matrix declarations at `verify-release.test.ts:135,178` and `season-worker-assets.test.ts:65,79,87,101`, so runtime case counts are higher than the direct-declaration baseline. |
| 10 | `check:repository` covers broad suites and Worker dry-run. | VERIFIED, with failure-mode findings below | Plan checklist is at `phase-03-validation-and-release.md:81`; command inventory includes MCP check, Astro build/dist/E2E, root JS, Python unittest discovery, Vision Worker tests/typecheck, and MCP dry-run in `mcp-worker/scripts/check-repository.ts:21-75`; package exposes it at `mcp-worker/package.json:35`. |

## Findings

### Medium: Phase 3 port-4174 preflight is procedural only, while `check:repository` runs E2E directly

Plan evidence: Phase 3 requires inspecting port 4174 before E2E and says Playwright must own and stop the build/preview process in `phase-03-validation-and-release.md:107-109`; the implementation steps run E2E at `phase-03-validation-and-release.md:120-128`; release packaging later relies on `check:repository` at `phase-03-validation-and-release.md:141`. Phase 2 gives the same operational rule at `phase-02-browser-and-details.md:169-173`.

Code evidence: root `test:e2e` is plain `playwright test` in `package.json:18`; Playwright always starts preview on port 4174 with `reuseExistingServer:false` in `playwright.config.mjs:16-20`; `check:repository` invokes root E2E directly in `mcp-worker/scripts/check-repository.ts:40-45` and has no preflight command before it. The repository-gate unit test locks the command labels without a port guard in `mcp-worker/test/release/repository-gate.test.ts:14-25`.

Failure scenario: if another session already owns port 4174, a Phase 3 operator who follows the release packaging shortcut (`npm --prefix mcp-worker run check:repository`) reaches the E2E stage only after earlier gates have run, then Playwright fails trying to own the fixed port. That turns a coordination issue into a late release-gate failure and can leave the validation report without the owner/cwd evidence the plan explicitly requires.

Minimal fix: make the port-4174 preflight a concrete gate before `check:repository` in Phase 3 evidence, or encode a read-only preflight in `mcp-worker/scripts/check-repository.ts` that reports the listener owner/cwd and exits before running child commands. If encoded in code, add a unit assertion beside `repository-gate.test.ts:14-25` so the release gate cannot regress back to direct E2E without the preflight.

### Medium: `check-repository.ts` hides pre-child gate failure causes at the CLI boundary

Plan evidence: Phase 3 says `REPOSITORY_GATE_COMMANDS` keeps broad suites and dry-run with visible failures in `phase-03-validation-and-release.md:81`, and the validation report must record pass/fail output summaries in `phase-03-validation-and-release.md:139`.

Code evidence: `assertCredentialFreeEnvironment()` throws a specific credential error in `mcp-worker/scripts/check-repository.ts:123-128`, and retired-release residue throws a specific error in `mcp-worker/scripts/check-repository.ts:98-120`. Both checks run before the child-command loop in `runRepositoryGate()` at `mcp-worker/scripts/check-repository.ts:157-167`. The CLI `main()` catches every error but writes only `Repository release gate thất bại.` in `mcp-worker/scripts/check-repository.ts:170-176`. Current tests assert helper behavior and runner propagation in `mcp-worker/test/release/repository-gate.test.ts:31-58`, but do not cover CLI error text.

Failure scenario: with `CF_API_TOKEN` or another forbidden release credential in the environment, the gate fails before any child command emits output. The caller receives only the generic failure line, so the Phase 3 validation record cannot distinguish a secret-env block from retired release residue or another preflight failure without reopening code and re-running probes.

Minimal fix: change the CLI catch to print a scrub-safe error message, for example the thrown `Error.message` plus the generic line, while preserving the existing no-secret behavior. The current credential/residue errors identify keys/classes but do not include secret values.

## Notes For Review Adjudication

- I did not flag the `MAX_RESULT_BYTES` / JSON-envelope size distinction from the MCP release work here; it is outside this Phase 3 browser validation plan and was not part of the current-code contract set.
- Missing Recommended-specific state/artifact/E2E files are treated as pending Phase 1/2 delivery surfaces, not as current defects, because the plan explicitly labels them new or P2-owned.
- Screenshot path handling in the current migrated season E2E is consistent with the Phase 3 instruction: screenshots use `testInfo.outputPath()` at `tests-e2e/season-lookup.spec.mjs:162-163` and `tests-e2e/season-lookup.spec.mjs:271`, while tracked PNG preservation is guarded at `tests-e2e/season-lookup.spec.mjs:8-16`.

Summary: Phase 3 is broadly contract-aware, but two release-readiness failure modes remain: the broad repository gate does not encode the port-4174 preflight the plan requires, and the repository-gate CLI hides pre-child failure causes that Phase 3 needs as evidence.

Concerns/Blockers: no code blocker found in the current browser/MCP contract surfaces; address the two Medium plan/gate concerns before treating Phase 3 release validation as operator-proof.
