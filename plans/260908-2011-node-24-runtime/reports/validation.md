# Node 24.20.0 validation

Date: 2026-09-09 (Asia/Ho_Chi_Minh). Status: DONE_WITH_CONCERNS.

## Summary

All requested runtime build, type, unit, browser and Python gates pass on Node `v24.20.0`. The derived MCP workflow fingerprint initially failed and passed after the controller ran the canonical generator. Supplemental workerd tests pass. The additional Wrangler dry-run remains unavailable because production assets are absent and their canonical builder requires a clean Git checkout.

No source, dependency, test or configuration edits were made by this validator. No deployment, commit, credential output or clean-source bypass occurred. Existing unrelated WIP was preserved.

## Environment and commands

Repository: `/Users/plateau/Project/CamNangTQCCL`.

Every runtime command explicitly prepended `$HOME/.nvm/versions/node/v24.20.0/bin` to `PATH`; the first command reported `v24.20.0`. Commands below use that runtime even though the pre-existing parent process environment may select another Node. Shell-default verification is recorded separately in [runtime-setup.md](runtime-setup.md).

## Results

| Working directory | Command | Exit | Result / evidence |
| --- | --- | --- | --- |
| `mcp-worker` | `npm run build && npm run test:node-min` | 0 | Initial narrow check passed: TypeScript build, exact root pin, absence of duplicate pins, bounded root/MCP engines, built domain import and normalization assertion. |
| Root | `npm run check` | 0 | 9 Astro files; 0 errors, warnings or hints. [Log](frontend-check.log) |
| Root | `npm run build` | 0 | Static build succeeded; 1 page. [Log](frontend-build.log) |
| Root | `npm run test:node` | 0 | 143 passed; 0 failed, skipped, cancelled or todo. [Log](frontend-node.log) |
| Root | `npm run test:dist` | 0 | 9 passed; 0 failed, skipped, cancelled or todo. Included in the broader Node suite; do not add these as distinct tests. [Log](frontend-static.log) |
| Root | `npm run verify` | 0 | 36 files verified, including 33 raw assets. [Log](frontend-verify.log) |
| Root | `npm run test:e2e` | 0 | 26 passed, 16.8 seconds; Chromium Astro project. [Log](frontend-e2e.log) |
| Root | `python3 -m unittest discover -s tests` | 0 | 89 passed, 0.256 seconds. [Log](python-tests.log) |
| `mcp-worker` | `npm run check` (initial) | 1 | Stopped at stale generated workflow fingerprint. [Log](mcp-check.log) |
| `mcp-worker` | `npm run check` (after canonical generation) | 0 | Workflow freshness, local-secret check, coverage, both typechecks, build, exact-runtime smoke and artifact-only control-plane verification passed. 305 tests in 37 files. [Log](mcp-check-rerun.log) |
| `worker` | `npm test` | 0 | 53 passed in 6 files. [Log](vision-tests.log) |
| `worker` | `npm run typecheck` | 0 | TypeScript passed. [Log](vision-typecheck.log) |
| `mcp-worker` | Repository credential-free and retired-release assertion functions | 0 | Both read-only assertions passed; no credentials printed. [Log](repository-guards.log) |
| `mcp-worker` | `WRANGLER_SEND_METRICS=false npm run test:worker` | 0 | Supplemental workerd transport suite: 2 passed in 1 file; production-profile suite: 1 passed in 1 file. [Log](mcp-workerd-tests.log) |
| `mcp-worker` | `npm run deploy:dry-run` | 1 | Missing configured `mcp-worker/.worker-assets` directory. No upload. [Log](mcp-dry-run.log) |
| `mcp-worker` | `npm run build:worker-assets` | 1 | `SOURCE_NOT_CLEAN`; canonical prerequisite fails before output-directory creation. [Log](mcp-assets-build.log) |

The aggregate `check:repository` command was inspected rather than redundantly rerun: its component commands and extra read-only guards were exercised above. It would still fail at its final dry-run step.

## Coverage

MCP coverage passed its configured aggregate thresholds:

| Metric | Measured | Count | Required |
| --- | --- | --- | --- |
| Statements | 90.36% | 1097 / 1214 | 80% |
| Branches | 83.45% | 666 / 798 | 70% |
| Functions | 95.5% | 319 / 334 | 80% |
| Lines | 90.87% | 1036 / 1140 | 80% |

The existing legacy domain adapter has 69.35% branch coverage and filesystem data source 66.66%; configured thresholds apply to the aggregate. No tests or thresholds were altered for this runtime change.

## Failure diagnosis and limits

1. **Resolved generated fingerprint mismatch.** `workflow-source-manifest.json` explicitly includes `.node-version`, `mcp-worker/package.json` and `mcp-worker/package-lock.json`. The generator hashes their actual bytes, so the authorized runtime edits invalidate the stored identity. The controller ran `npm run generate:workflow-build`; the complete MCP check then passed. This was a required derived-artifact update, not a runtime execution regression. A Node 22 rerun was unnecessary for this source-proven cause.
2. **Unresolved deployment prerequisite.** Wrangler resolves `assets.directory` to the absent production asset directory. The canonical builder checks full Git cleanliness before writing its output and correctly rejected current WIP with `SOURCE_NOT_CLEAN`. This is an environment/provenance prerequisite; the actual Worker dry-run bundle has not been verified. No substitute assets, fake provenance, temporary commits or clean-source bypass were introduced.
3. **Non-failing dependency warnings.** Workerd tests emitted missing-source-file sourcemap warnings from installed `@modelcontextprotocol/sdk`. Both workerd suites passed. No comparison was made to Node 22, so this report does not claim those warnings are newly introduced or pre-existing.

## Process cleanup

Before E2E, TCP 4174 had no listener. Playwright started its configured `npm run build` and Astro preview for this repository on `127.0.0.1:4174`; observed Playwright PID 8919 and preview PID 8993. The owned preview terminated automatically after the suite; port 4174 was checked and had no listener afterward. Final process inspection found no remaining owned Playwright, Astro preview, Vitest or workerd process. No unrelated process was stopped.

## Recommendation and unresolved questions

Accept the runtime validation with the explicitly bounded deployment dry-run limitation. A future release from a clean approved checkout must run canonical asset generation and the actual dry-run gate. No unanswered product question remains for this runtime upgrade.
