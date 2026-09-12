# Isolated release closure — 2026-09-12

All four phases are complete. The authorized local worktree `feat/season-team-lookup` passed the full release gate on clean commit `f2741f5d1ca83ae6c9eb93783b85514767d91f41`. Kongming approved documentation closure followed by final-HEAD packaging verification. No push, merge or deployment is part of this delivery.

## Verified behavior and packaging

- [Complete repository gate](isolated-fixed-repository-gate.log): exit 0; MCP 351, Node 186, browser E2E 55, dist 13 and Vision Worker 53 tests pass. Workflow, both MCP typechecks, builds, minimum-Node smoke, control-plane artifact check and Vision typecheck pass. Wrangler dry-run packages 12 real assets.
- [Workerd](isolated-fixed-workerd.log): 2 transport and 1 production-performance tests pass, exit 0.
- Python: 151 total, **139 passed and 12 skipped**, no failures. Existing guards skip real-HTML parser/build cases because legacy source HTML is absent from this checkout. These cases remain unverified here. [Scope audit](isolated-fixed-python-scope.log): 37 unrelated private-catalog tests were excluded with their feature; one empty-query regression was added. No skip guard or pass threshold was changed.
- Root Astro check: zero errors/warnings/hints; verify: 43 dist files and 40 raw assets. Detailed supplemental logs remain in the original workspace's `isolated-fixed-validation.md` and sibling reports.
- Real asset build and [verification after tests/cleanup](isolated-fixed-final-assets-verify.log) passed with [pure JSON evidence](isolated-fixed-worker-evidence.json). Nine legacy data artifacts remain byte-identical; private catalogs are absent from the public bundle.

Runtime: Node 24.20.0, npm 11.19.0, Python 3.12.13. Source tree: `git-tree:4d374becfd7d34f5e02e80ed0cc9d6584391691a`. Release ID: `sha256:9acbe1a58ec3cc439a0b87870f658a1c0d331285b5457e6f001dd24ffcbe33cf`. Workflow ID: `build:sha256b64:ybUy68D9Sj9XSxdr4Uxf8YDBJz6D7GKM9u8Zp8Z9Th8`.

## Repairs and preserved limits

Isolation found Python 3.9 strict parsing rejecting absent queries on valid Recommended URLs. An explicit empty-query branch preserves strict validation for nonempty queries; focused 62 cases passed on Python 3.9, 3.12 and 3.14. The initial full isolated gate then exposed a test requiring the checkout basename `CamNangTQCCL`; the replacement imports the adapter from a fresh Node process whose working directory is temporary and checks the same 17-method API. Both original failures remain recorded outside the isolated worktree. The first eleven resolver cases and supplemental regression tests still lack individual pre-code Red evidence; no chronology claim is upgraded.

Source permission includes SGSDeck Recommended on the website. Publication still requires exact configuration/context/selection evidence. Current public data intentionally contains one VN scenario, five reference groups / 25 teams / 75 hero positions and zero reviewed VN rulesets/configurations/evaluations. Passing tests do not promote gameplay claims.

## Final commit identity

The full behavioral gate belongs to `f2741f5` above. This closure commit changes documentation only. After it is created, check workflow identity, rebuild real assets, verify them and run Wrangler dry-run against the new HEAD. Store its SHA/tree and evidence in the original workspace reports, outside this clean worktree, to avoid embedding a commit's own SHA within itself. Do not claim the full behavioral suite ran at that later SHA. A code/data/configuration change would require relevant behavioral checks again.

The original main workspace remains the user's WIP. E2E screenshot outputs were preserved externally and restored exactly from the tested HEAD. Preview and Workerd processes were stopped; the user's original server remains untouched. No unresolved product or permission question blocks this local delivery.
