# Isolated validation after checkout-path fix — 2026-09-12

## Result

Status: **DONE_WITH_CONCERNS**. Real asset build/verification, complete repository gate including Wrangler dry-run, root check/verify, and Workerd smoke all exit **0** on feature HEAD `f2741f5d1ca83ae6c9eb93783b85514767d91f41`. Python reports 151 total, **139 passed and 12 skipped** because optional legacy HTML source files are absent. No failing test remains in this run; skipped tests are not claimed as passed.

Worktree: `/Users/plateau/Project/worktrees/CamNangTQCCL-season-team-lookup`, branch `feat/season-team-lookup`. Node **24.20.0**, npm **11.19.0**, Python **3.12.13** with:

```sh
export PATH=/Users/plateau/.nvm/versions/node/v24.20.0/bin:/opt/homebrew/opt/python@3.12/libexec/bin:$PATH
```

The prior `b3b26a3` failure and original asset evidence remain unchanged in [prior report](isolated-validation.md) and its logs. This run validates the committed checkout-independent test fix without renaming the checkout or excluding the failing test. No tracked source edits, Git mutation, fixture asset substitution, push, merge, deploy or plan-status closure was performed by this tester.

## Actual commands and counts

All commands below ran in the isolated worktree. Evidence/log files were written outside it, to the primary workspace's plan reports.

| Command | Exit | Result/evidence |
|---|---:|---|
| `npm --prefix mcp-worker run --silent build:worker-assets` | 0 | Real current-source bundle; [pure stdout JSON](isolated-fixed-worker-evidence.json), [stderr/exit](isolated-fixed-worker-assets-build.log) |
| `npm --prefix mcp-worker run verify:worker-assets -- /Users/plateau/Project/CamNangTQCCL/plans/260907-0233-season-team-lookup/reports/isolated-fixed-worker-evidence.json` | 0 | HEAD/tree/workflow and exact assets verified [before tests](isolated-fixed-worker-assets-verify.log) and [after cleanup/Workerd](isolated-fixed-final-assets-verify.log) |
| `npm --prefix mcp-worker run check:repository` | **0** | Every stage below passed; [full gate log](isolated-fixed-repository-gate.log) |
| ↳ MCP `check` | 0 | **351 tests / 43 files**; workflow identity, local secrets, both typechecks, build, Node-min smoke, artifact-only control-plane check pass |
| ↳ Astro build and dist tests | 0 | Build pass; **13 dist tests** pass |
| ↳ Full built Playwright E2E | 0 | **55 passed in 25.3s**: 28 season and 27 legacy/parity; retries 0 |
| ↳ Root Node | 0 | **186 passed**, no failures/skips |
| ↳ Python unittest discovery | 0 | **151 total: 139 passed, 12 skipped**, no failures/errors; details below |
| ↳ Vision Worker | 0 | **53 passed / 6 files**; typecheck pass |
| ↳ Wrangler `deploy:dry-run` | 0 | Wrangler 4.114.0 read **12 real asset files**; package 1429.79 KiB, gzip 257.32 KiB; explicit dry-run exit, no deployment |
| `npm run check` | 0 | Astro 9 files, zero errors/warnings/hints; [log](isolated-fixed-root-check.log) |
| `npm run verify` | 0 | **43 dist files / 40 raw assets**; [log](isolated-fixed-root-verify.log) |
| `npm --prefix mcp-worker run test:worker` | 0 | **2 Workerd transport + 1 production-performance test**; serialized after browser exit; [log](isolated-fixed-workerd.log) |

MCP coverage: statements 91.08%, branches 85.30%, functions 95.90%, lines 91.75%; configured thresholds unchanged and passed. SDK sourcemap warnings in Workerd are nonfatal and preserved in its log.

## Python scope and skips

[Scope evidence](isolated-fixed-python-scope.log) statically counts the four intentionally unselected private-catalog modules: build 9, query 7, identity 6, source 15 = **37 tests**. The previous primary-workspace suite had 187; isolation removes 37 and adds one committed empty-query regression, yielding 151. This is scope isolation, not test weakening or a changed pass expectation.

The **12 existing source-dependent skips** are seven `TestBuild` cases in `tests/test_build.py`, three real-source parser cases in `tests/test_parse_secondary.py` (mines, Khai hoang teams, coexist groups), and two real-source cases in `tests/test_parse_team_intro.py`. Their existing `skipUnless`/`skipTest` guards require untracked legacy HTML under `Meta Team PK`; those files are absent from this isolated checkout. No guard was introduced or changed. Source fixtures committed for the seasonal importer and regression tests ran normally. These 12 real-HTML parser cases remain unverified in this checkout.

## Artifact identity and preservation

Evidence schema remains 1; data manifest is 2 with eleven named public artifacts plus manifest, **12 files total**. [Identity audit](isolated-fixed-identity-audit.log) confirms all nine protected data hashes equal the baseline, and no private catalog dataset exists in the isolated source or asset inventory.

| Identity | Value |
|---|---|
| Source SHA | `f2741f5d1ca83ae6c9eb93783b85514767d91f41` |
| Source tree | `git-tree:4d374becfd7d34f5e02e80ed0cc9d6584391691a` |
| Release ID | `sha256:9acbe1a58ec3cc439a0b87870f658a1c0d331285b5457e6f001dd24ffcbe33cf` |
| Workflow ID | `build:sha256b64:ybUy68D9Sj9XSxdr4Uxf8YDBJz6D7GKM9u8Zp8Z9Th8` |
| Asset inventory digest | `sha256:0d05d58859a1af9600109230f24c03f0be7b63263654e8bee5caff8c8607f94f` |
| Manifest SHA256 | `sha256:0190d006ec6e7718a481b94baa3d1e581b14043976406d80d5f90a4db0c4fe55` |

Git status was clean before asset creation. E2E rewrote two tracked screenshot outputs: `plans/260907-0233-season-team-lookup/reports/ui-detail-1024-dark.png` and `ui-detail-375-dark.png`. Fresh outputs were preserved externally as [1024 dark](isolated-fixed-ui-detail-1024-dark.png) and [375 dark](isolated-fixed-ui-detail-375-dark.png). The authorized Git owner restored exactly those two outputs from HEAD; final Git status is clean at the same SHA. The mid-run identity audit faithfully records their temporary modification; final [process/status audit](isolated-fixed-process-audit.log) and asset verification show the cleaned state.

## Process cleanup and limits

Gate harness 31800 (runner PID 11875), preview PID 12792 on 4174, root-check harness 63747 and Workerd harness 59091 all exited. Preview was closed before Workerd started. Final port 4174 check found no listener; no owned preview/Vitest/Workerd/stdio child remains. User-owned PID 77549 continues listening on 4321, untouched. See [audit](isolated-fixed-process-audit.log).

These full behavioral/package results belong to the feature SHA above. A later documentation-only closure commit changes source identity and requires the prescribed real asset rebuild/verification and identity-sensitive dry-run; this report does not attest to an uncreated future commit. No plan or documentation closure was performed. TDD chronology qualifications from earlier reports remain unchanged.
