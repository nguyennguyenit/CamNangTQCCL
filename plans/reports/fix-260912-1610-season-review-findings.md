# Fix season review findings — 2026-09-12

Outcome: admitted, buildable seasonal configurations cannot disappear behind the old candidate prefix; browser verification preserves committed evidence. Constraints: preserve legacy no-context behavior, API/data shape, DFS window/node budget and original WIP. No source-data promotion, source-label redesign, push, merge or deployment. Local commits remain authorized for clean-source packaging.

Acceptance: validated61/81/500-config fixtures reach the buildable tail;60 feasible configs of one team cannot hide a compatible second team in either mode; screenshot-producing tests leave tracked PNGs unchanged; affected suites/build/typecheck and clean-source packaging pass.

## Diagnosis and choice

Astro frontend, shared JavaScript engine, TypeScript MCP, Python ingestion. Affected owners: `js/team-recommend-engine.js`, its validated-bundle tests in `tests-js/season-context.test.mjs`, and `tests-e2e/season-lookup.spec.mjs`. Direct consumers are roster UI and MCP recommendation/coexist. Introducer `b3b26a3` expanded canonical teams into seasonal configs while reusing the older60/80 candidate cut; it also introduced screenshots written into tracked plan reports.

- Recommendation symptom: valid61-config bundle projects61 candidates but default portfolio is empty; full-box can find config060. Root cause: candidatePool cuts before resource matching. New same-team config expansion increases rows independently of canonical team count. Both UI/MCP and default/full-box paths are affected.
- Verification symptom: existing375px browser test passes but next real asset build fails `SOURCE_NOT_CLEAN`. Root cause: screenshot destinations are tracked historical evidence files. Existing `testInfo.outputPath` is the correct local pattern.

Kongming chose: seasonal candidatePool keeps all sorted/projector-bounded candidates; resource feasibility examines all. Greedy scans all feasible candidates. Full-box initializes its best incumbent from seasonal greedy but starts DFS from the original locked seed, retaining its existing60-candidate DFS window and node budget. Legacy behavior remains unchanged. Cutting feasible configs again would still hide a compatible second team behind60 variants of the first.

Screenshots move to Playwright per-test output paths. A before/after hash guard covers every tracked PNG; committed evidence is retained.

## Progress

- [x] Scout and confirmed diagnosis reused from fresh review, source/history rechecked.
- [x] Eight validated-bundle regression cases added; fail before engine fix.
- [x] Screenshot preservation regression demonstrated before fix: afterAll hash assertion failed, exact original PNG bytes restored.
- [x] Cause-aligned implementation and workflow regeneration.
- [x] Focused and consumer verification; independent review.
- [x] Durable local commit, real assets/build verification and final dry-run.

## Verification before commit

- Red: [8 engine cases fail](fix-260912-1610-engine-red.log); [screenshot preservation assertion fails](fix-260912-1610-screenshots-red.log).
- Green: [61 engine/context](fix-260912-1610-engine-green.log), [194 full Node](fix-260912-1610-node.log), [28 season browser tests with tracked-PNG preservation](fix-260912-1610-e2e-green.log), [25 focused MCP](fix-260912-1610-mcp-green.log), [MCP typecheck](fix-260912-1610-typecheck.log) pass.
- Five changed files: engine, validated-bundle tests, browser tests, generated workflow ID, owning seasonal-data documentation. Public APIs/data schema unchanged; legacy branches and DFS budgets retained. Full-box remains a bounded heuristic.

## Completed validation and decisions

Both P2 findings are resolved. Local commits:

- `920a98f5b8603304f940d9e80194808f52e63f51`: engine, eight regressions, owning docs and generated workflow identity.
- `e39db07a7cc3fb51738d952c89cab1fda515f067`: screenshot outputs and tracked-PNG preservation guard. Final HEAD is clean.

[Independent review](review-260912-1610-season-fixes.md): no critical/important defect, score9/10. This is below ak-fix's9.5 automatic threshold. Kongming explicitly approved proceeding under the user's delegated decision authority; the score was not changed or represented as automatic approval.

All final checks ran on the final SHA with Node24.20.0 and Python3.12.13:

| Gate | Result |
|---|---|
| [Full repository gate](fix-260912-1610-repository-gate.log) | Exit0: MCP351, Node194, E2E55, dist13, Vision53; builds/typechecks/workflow/control-plane checks and Wrangler dry-run pass |
| Python discovery within full gate |151 total:139 passed,12 existing missing-HTML skips; no failures |
| [Astro check](fix-260912-1610-root-check.log) / [verify](fix-260912-1610-root-verify.log) |0 errors/warnings;43 dist files /40 raw assets |
| [Workerd](fix-260912-1610-workerd.log) |2 transport +1 production test pass |
| [Build after E2E](fix-260912-1610-post-test-assets-build.log) / [verification](fix-260912-1610-post-test-assets-verify.log) |Both exit0, source remained clean without restoring any screenshot |
| [Final Wrangler dry-run](fix-260912-1610-final-dry-run.log) |Exit0;12 real assets; no deployment |

[Machine-readable attestation](fix-260912-1610-final-validation.json) and [final asset evidence](fix-260912-1610-post-test-worker-evidence.json) bind HEAD/tree/workflow. Pre-test and post-test asset evidence are identical. Data release/manifest/inventory are unchanged from the previous delivery; workflow ID changes to reflect the engine repair. Nine protected legacy data files remain byte-identical. Port4174 is closed; no owned server remains.

## Status synchronization and journal

Mapped repairs: phase2 engine feasibility; phase3 screenshot/output verification; phase4 regenerated workflow and clean-source gates. All four phase statuses remain completed. The original plan links this post-review validation; the isolated worktree remains clean with no extra documentation commit/SHA loop. Original source WIP and index are preserved.

Journal preference is enabled. `ak project list --json` failed exit1 during registry lookup; prior journal resolution selected an enclosing registry outside this repo. To respect the required Markdown location, the existing project-local journal was appended instead of creating a file in that enclosing project. No skill code or registry was modified. AgentWiki publish skipped.

Unresolved questions: none. Full-box remains a bounded heuristic; no global-optimality claim. Existing source-evidence/TDD-history limits from the original delivery remain unchanged.
