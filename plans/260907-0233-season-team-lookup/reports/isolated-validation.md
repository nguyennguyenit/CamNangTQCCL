# Isolated release validation — 2026-09-12

## Current checkpoint

Status: **BLOCKED pending controller fix**, not a completed repository gate. Worktree `/Users/plateau/Project/worktrees/CamNangTQCCL-season-team-lookup`, branch `feat/season-team-lookup`, feature HEAD `b3b26a3df5f1a00166eb01a4bfdf5134d15a02f5`, tree `e2f3121d51d3bcdf5aba8b9985c02fa153f06607`. Git status was clean before and after real asset creation.

Runtime: Node24.20.0, npm11.19.0, Python3.12.13 via explicit Node/Python PATH. Evidence files remain outside the isolated checkout, in the primary plan's reports. No implementation edit, Git mutation, fake asset, test exclusion, deploy or background server was performed by the tester.

## Commands and actual results

| Command in isolated worktree | Exit | Evidence/result |
|---|---:|---|
| `npm --prefix mcp-worker run --silent build:worker-assets` | 0 | [Pure stdout JSON](isolated-worker-evidence.json), [stderr/exit log](isolated-worker-assets-build.log); actual production-source bundle |
| `npm --prefix mcp-worker run verify:worker-assets -- /Users/plateau/Project/CamNangTQCCL/plans/260907-0233-season-team-lookup/reports/isolated-worker-evidence.json` | 0 | [Verifier log](isolated-worker-assets-verify.log); HEAD/tree/workflow match |
| `npm --prefix mcp-worker run check:repository` | **1** | [Failed integrated log](isolated-repository-gate.log); MCP coverage stage:350pass,1fail/43files |
| Identity/inventory/hash audit | 0 | [Audit](isolated-identity-audit.log);12asset files,manifestv2,9legacy hashes unchanged,private catalog absent,Git status clean |

Failure: `mcp-worker/test/domain/legacy-domain-adapter.test.ts:31` expects repositoryRoot to match `/CamNangTQCCL$/`; actual worktree basename is `CamNangTQCCL-season-team-lookup`. The expected checkout-name assertion fails before the rest of that test. Controller is diagnosing a meaningful location-independent fix. No directory rename, test filtering or bypass was attempted.

Workflow-build and local-secret checks passed before the failure. All subsequent integrated stages were **unreached**: MCP typechecks/build/Node-min/control-plane; Astro build/dist/E2E; root Node/Python; Vision tests/typecheck; Wrangler dry-run. Additional root check/verify and Workerd tests were not started after controller requested a halt.

## Feature-commit asset identity

- Source commit: `b3b26a3df5f1a00166eb01a4bfdf5134d15a02f5`
- Source tree: `git-tree:e2f3121d51d3bcdf5aba8b9985c02fa153f06607`
- Release ID: `sha256:9acbe1a58ec3cc439a0b87870f658a1c0d331285b5457e6f001dd24ffcbe33cf`
- Workflow ID: `build:sha256b64:ybUy68D9Sj9XSxdr4Uxf8YDBJz6D7GKM9u8Zp8Z9Th8`
- Asset inventory digest: `sha256:0d05d58859a1af9600109230f24c03f0be7b63263654e8bee5caff8c8607f94f`
- Manifest SHA256: `sha256:0190d006ec6e7718a481b94baa3d1e581b14043976406d80d5f90a4db0c4fe55`

Evidence schema stays1; data manifest is2. Twelve files are eleven public JSON artifacts plus manifest. Source identity must be rebuilt/reverified after the fix commit; existing results apply only to the feature SHA above.

## Processes and next step

Port4174 was free before testing. Gate session30840 exited on the MCP failure; it never reached Playwright or Workerd. User dev PID77549 on4321 was left untouched. No owned long-running process remains. Await controller's committed fix/new SHA, then resume real asset verification and required gates with a new log, preserving this failure.
