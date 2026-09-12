# Final integrated validation — 2026-09-12

## Summary

Status: **DONE_WITH_CONCERNS**. All executed behavioral, build, type and artifact checks passed. The actual repository release gate exited **1**, at its last command, because `mcp-worker/.worker-assets` does not exist. The actual asset build exited **1 / SOURCE_NOT_CLEAN**. These are unresolved environment/release gates, not successful dry-run or publication evidence.

Work context: `/Users/plateau/Project/CamNangTQCCL`; plan `260907-0233-season-team-lookup`, invocation `--auto --advice --tdd`. Final tester changed only this report and `final-*.log` under its reports directory; commands generated their normal ignored artifacts. No implementation changes, commits, stash, deployment, fake assets or guard bypass.

Runtime on every npm command:

```sh
export PATH=/Users/plateau/.nvm/versions/node/v24.20.0/bin:$PATH
node --version  # v24.20.0
npm --version   # 11.19.0
```

## Actual integrated gate

Command: `npm --prefix mcp-worker run check:repository`.
Evidence: [complete log](final-repository-gate.log), runtime at lines 1–2, final `EXIT_CODE=1`.
The runner executes commands serially and proceeds only after exit 0. Thus reaching the dry-run proves each previous command exited 0; the final command is the sole failing stage.

| Stage and actual command | Exit | Actual result |
|---|---:|---|
| `npm --prefix mcp-worker run check` | 0 | Workflow identity and local-secret checks passed; 351 tests / 43 files passed; both typechecks, package build, Node-min smoke and artifact-only control-plane verification passed |
| `npm run build` | 0 | Astro build passed |
| `npm run test:dist` | 0 | 13 passed; 0 failed/skipped |
| `npm run test:e2e` | 0 | **55 passed in 22.6s**; 28 season + 27 legacy/parity tests; retries 0 |
| `npm run test:node` | 0 | 186 passed; 0 failed/cancelled/skipped/todo |
| `python3 -m unittest discover -s tests` | 0 | 187 passed in 0.676s |
| `npm --prefix worker test` | 0 | 53 passed / 6 files |
| `npm --prefix worker run typecheck` | 0 | Typecheck passed |
| `npm --prefix mcp-worker run deploy:dry-run` | 1 | Wrangler 4.114.0: configured `assets.directory` does not exist at `mcp-worker/.worker-assets` |
| **Whole `check:repository`** | **1** | **ENVIRONMENT_BLOCKED at final dry-run** |

The count of 55 is measured, not the preliminary estimate of 56. The E2E log contains 28 `season-lookup`, 13 `khaihoang-options`, 12 `spa-parity` and 2 `mcp-domain-compatibility` cases. Playwright used its default fresh build and preview with `reuseExistingServer:false`, Chromium, deterministic port 4174. No retries or exclusions were added.

MCP coverage from the integrated run:

| Metric | Actual |
|---|---:|
| Statements | 91.08% (1287/1413) |
| Branches | 85.30% (900/1055) |
| Functions | 95.90% (375/391) |
| Lines | 91.75% (1180/1286) |

Configured coverage checks passed. Coverage is not complete: the domain-adapter row has 80% lines / 69.35% branches; remaining uncovered areas appear in the full log. No coverage claim is made for root JS or Python beyond their passing results.

## Additional required checks

| Actual command/check | Exit | Result/evidence |
|---|---:|---|
| `npm run check` | 0 | Astro: 9 files, 0 errors/warnings/hints; [log](final-root-check.log) |
| `npm run verify` after integrated build/E2E | 0 | **43 dist files / 40 raw assets** verified; [log](final-root-verify.log) |
| `npm --prefix mcp-worker run build:worker-assets` | **1** | **SOURCE_NOT_CLEAN** retained; [log](final-build-worker-assets.log) |
| Python SHA-256 comparison against `execution-baseline.json` | 0 | **9/9 legacy artifacts unchanged**; [hash log](final-legacy-hashes.log) |
| `git diff --check` | 0 | No whitespace errors; [log](final-diff-check.log) |

Hash comparison used `hashlib.sha256(Path(name).read_bytes()).hexdigest()` for every entry in `execution-baseline.json` and asserted all nine equal the recorded digest. Checked files: books dictionary, coexist, facets, heroes dictionary, Khai hoang, generic tactics, tactics, team tiers and teams.

The focused Workerd run was already completed by the MCP owner (2 worker cases + 1 production-performance case, exit 0, [owner log](phase-04-workerd.log)); final tester did not repeat it because the integrated gate does not include `test:worker`. Existing TDD chronology/deviations remain documented in [validation](validation.md) and [UI validation](phase-03-ui-validation.md); this final regression run does not invent new Red evidence.

## Process ownership

Before starting: port 4174 had no listener. MCP owner confirmed its Workerd/Vitest/stdio children had exited before the integrated gate began. The gate ran in harness session 37207; observed runner PID 96878, preview PID 97878 (parent 97831), command `node .../astro preview --host 127.0.0.1 --port 4174`, worktree `/Users/plateau/Project/CamNangTQCCL`. Playwright cleaned up preview on completion; final `lsof -nP -iTCP:4174 -sTCP:LISTEN` exited 1 with no listener. No owned long-running process remains.

User-owned Astro dev PID **77549** remained listening at `[::1]:4321` before and after testing. It was neither stopped nor modified. See [process audit](final-process-audit.log).

## Remaining gates and limits

- Real asset packaging and Wrangler dry-run remain blocked by the dirty source/missing asset directory chain. Resolve through the authorized clean-source/release workflow; no commit or cleanup authorization is inferred from green tests.
- This is local verification only. No deployment or live production parity claim.
- Browser execution covers Chromium; physical devices and other engines were not tested here. Detailed responsive/keyboard evidence belongs to [UI validation](phase-03-ui-validation.md).
- Production has no reviewed executable ruleset/configuration/evaluation. Passing controlled test fixtures does not promote source data or fabricate gameplay facts.

Unresolved questions: none needed to finish this test assignment; release environment gates remain explicitly open.
