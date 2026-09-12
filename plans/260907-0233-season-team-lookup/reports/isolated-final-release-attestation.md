# Final local release attestation — 2026-09-12

Status: **DONE**. All final identity-sensitive checks passed on clean local HEAD `4eb7f19b2f97e78f3d336b8f32762f492c7bb2e0` in `/Users/plateau/Project/worktrees/CamNangTQCCL-season-team-lookup`, branch `feat/season-team-lookup`. No push, merge, deployment or tracked modification was performed by this validation run.

Runtime: Node **24.20.0**, npm **11.19.0**, Python **3.12.13**, selected with the explicit Node24/Python3.12 PATH. All logs and JSON below were written outside the isolated checkout, in the original workspace's plan reports.

| Command | Actual exit | Evidence |
|---|---:|---|
| `npm --prefix mcp-worker run check:workflow-build` | 0 | [Workflow check](isolated-final-workflow-check.log) |
| `npm --prefix mcp-worker run --silent build:worker-assets` | 0 | [Pure stdout evidence JSON](isolated-final-worker-evidence.json), [stderr/exit log](isolated-final-worker-assets-build.log) |
| `npm --prefix mcp-worker run verify:worker-assets -- /Users/plateau/Project/CamNangTQCCL/plans/260907-0233-season-team-lookup/reports/isolated-final-worker-evidence.json` | 0 | [Real asset verification](isolated-final-worker-assets-verify.log) |
| `npm --prefix mcp-worker run deploy:dry-run` | 0 | [Wrangler dry-run](isolated-final-wrangler-dry-run.log): 12 real assets, 1429.79 KiB / gzip 257.32 KiB, dry-run exit |
| HEAD/tree/generation/process audit | 0 | [Identity audit](isolated-final-identity-audit.log) |

## Final identity

| Field | Verified value |
|---|---|
| Commit | `4eb7f19b2f97e78f3d336b8f32762f492c7bb2e0` |
| Source tree | `git-tree:c012f1ae0f0d19ef056e29fab45da61e3947661d` |
| Release ID | `sha256:9acbe1a58ec3cc439a0b87870f658a1c0d331285b5457e6f001dd24ffcbe33cf` |
| Workflow ID | `build:sha256b64:ybUy68D9Sj9XSxdr4Uxf8YDBJz6D7GKM9u8Zp8Z9Th8` |
| Manifest SHA256 | `sha256:0190d006ec6e7718a481b94baa3d1e581b14043976406d80d5f90a4db0c4fe55` |
| Asset inventory digest | `sha256:0d05d58859a1af9600109230f24c03f0be7b63263654e8bee5caff8c8607f94f` |

Fresh evidence was compared with [feature-commit evidence](isolated-fixed-worker-evidence.json). **Only `commitSha` and `sourceTree` changed.** Data release, workflow generation, manifest digest, asset inventory digest and evidence schema remain identical. The exact inventory remains eleven public data artifacts plus manifest; no private catalog dataset is present in the isolated source or assets.

## Behavioral evidence and boundaries

The final commit changes exactly ten files under `plans/`, all Markdown/log/JSON documentation evidence, relative to `f2741f5d1ca83ae6c9eb93783b85514767d91f41`. The audit recorded each path. Behavioral suites were intentionally not repeated for this documentation-only commit.

The full [feature-commit validation](isolated-fixed-validation.md) remains the behavioral evidence: MCP 351, Node 186, E2E 55, dist 13, Vision 53, Workerd 3 passed; Python 151 total, **139 passed and 12 existing skips** for absent optional legacy HTML. The prior failed checkout-name assertion and its correction remain traceable in the earlier logs. This attestation does not reclassify skips or TDD chronology gaps as passes/test-first evidence.

Git status is clean at the final SHA. No preview, Vitest, Workerd or stdio child from this task remains. Port 4174 has no listener; user-owned PID 77549 remains on port 4321, untouched. No background process was started by this final identity-only run.

Controller separately audited the original workspace before status synchronization: all **416 recorded files unchanged**, original main HEAD `f221c2f55b9f16d857e5785b7fcb7d25a19b705e`, empty index. This is controller-reported preservation evidence, not a second independent 416-file audit by the tester. Subsequent authorized original-plan status synchronization belongs to the controller and is outside this attestation.

Concerns: none for final local packaging identity. No remote deployment or live production claim; optional legacy HTML parser skips remain disclosed in the behavioral report.

## Controller post-synchronization audit

The original plan was synchronized to **completed** using explicit plan ID `CamNangTQCCL/260906-1933`. All four phase files report completed, and structural plan validation passes. The final [416-file preservation audit](isolated-original-preservation.json) finds exactly three authorized status records changed (plan index, Phase 4, journal); the remaining 413 recorded files are unchanged. Original main HEAD and empty index remain intact; no source-code or unrelated WIP change was introduced by isolation or closure. Closure report links resolve.
