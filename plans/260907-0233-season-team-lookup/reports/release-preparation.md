# Isolated release preparation — 2026-09-12

The user authorized an isolated worktree and durable local commits to complete the remaining release gate. No push, merge or deployment is requested. The original `main` workspace and index remain untouched; new evidence belongs to this plan's reports.

Worktree: `/Users/plateau/Project/worktrees/CamNangTQCCL-season-team-lookup`, branch `feat/season-team-lookup`, baseline `f221c2f55b9f16d857e5785b7fcb7d25a19b705e`.

Runtime prerequisite commit: `6993f060719e5b9e49677cb9c3a1fb6f8f041eb8`, eight files, Node 24.20.0 package bounds and owning setup docs. Workflow identity was regenerated for that commit; all three package installs used lockfiles.

## Scope selection

[Explicit source manifest](release-selection.json) selects the season implementation, five public sidecars, source evidence, required fixtures/tests, owning docs and this plan's historical evidence. Private catalog data/importers/tests, unrelated plans, deployment-history edits and the private-cache ignore edit remain in the original workspace.

README retains the season and Node changes while omitting catalog-specific commands and unrelated navigation. Eleven links to out-of-scope planning documents are retained as clearly labelled textual paths in the isolated copy. Required source/data imports remain unchanged. The optional private-directory exclusion and its negative tests are retained as the reviewed publication boundary; no private catalog data is copied.

Staged whitespace review found formatting in thirteen historical report/log copies; trailing formatting whitespace was removed without changing results. The source CSV remains byte-identical with SHA-256 `838c9b639d42aef67d270a8813edd13bf0b364efaa85ae80e1fa8efda9b829bb`. An exact-path Git attribute preserves its CRLF and whitespace inside quoted multiline cells; code and other files keep normal whitespace checks.

## Compatibility defect found by isolation

The original workspace resolved Python 3.14.6; the isolated shell resolved Apple's Python 3.9.6. The focused Python suite initially failed with six errors and one assertion failure: strict query parsing rejected an empty query on valid Recommended URLs.

A direct regression produced two real errors before the fix. Kongming approved explicitly mapping an absent query to an empty list while preserving strict parsing for nonempty queries. The new case also checks valid allowlisted queries, malformed fields/separators, blank values, duplicate/unknown keys and detail-query rejection.

After the one-line fix, **62 focused Python tests passed on each of Python 3.9.6, 3.12 and 3.14.6**. The direct pre-fix case already passed on 3.12; that run is not claimed as Red. Shared UI/context Node tests passed 31 cases. This is the only production-code change introduced by release isolation, and exists only in the isolated branch. The subsequent full gate exposed a test-only checkout-basename assumption; its committed correction checks the same 17-method adapter API in a fresh Node process with a temporary working directory. No test was removed.

## Verification sequence

Commit the selected feature, then build real assets and preserve emitted evidence outside the worktree's tracked files. Run real asset verification and the complete isolated repository gate. Once those pass, commit documentation closure. Rebuild and reverify assets plus Wrangler dry-run against the final HEAD because the documentation commit changes source identity.

Do not put the final commit's own SHA into a tracked report in that commit. Final attestation belongs to the original workspace's report directory. Full behavioral gates on the feature commit and identity-sensitive checks on the documentation-only final commit must be distinguished.

Unresolved questions: none. The preparation checkpoint is superseded by [completed validation](isolated-release-closure.md); failed-run evidence remains in the original workspace reports.
