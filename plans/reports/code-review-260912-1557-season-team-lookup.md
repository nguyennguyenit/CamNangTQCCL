# Season lookup review — 2026-09-12

Target: `f221c2f55b9f16d857e5785b7fcb7d25a19b705e..4eb7f19b2f97e78f3d336b8f32762f492c7bb2e0`, branch `feat/season-team-lookup`, isolated worktree `/Users/plateau/Project/worktrees/CamNangTQCCL-season-team-lookup`. Review only; preserve source and original WIP. Includes required Node prerequisite and subsequent portability fixes. No `--yagni` flag.

## Progress

- [x] Resolve full delivery diff and clean HEAD.
- [x] Spec-presence review and edge-case scout.
- [x] Independent code-quality review.
- [x] Reproduce and classify findings; run focused verification.
- [x] Final report. Implementation/fix is outside this review request.

## Spec presence — PASS to quality review

This verifies requested capabilities exist, not that every edge case is correct.

| Accepted requirement | Implementation / evidence owner |
|---|---|
| Scenario distinct from ruleset; evidence/review before applicability | `pipeline/build_season_data.py`, `pipeline/season_validation.py`, `js/season-context.js:validateSeasonBundle/resolveBrowseState` |
| Preserve legacy bytes and no-context behavior | Additive five sidecars, conditional engine/MCP scope paths, v1 release tests |
| Stable configurations, contextual tier and explicit ambiguity | `displayConfig`, `resolveTeamConfig`, engine candidateKey/teamId separation |
| Exact SGSDeck score/selection; no score transfer | `validateEvaluations`, `resolveSelectionScore`, `selectionFromEntry`, Recommended adapter |
| Cùng Tồn source-owned groups and unknown legacy; Khai hoang excluded | `parse_coexist_csv.py`, content links, `projectSeasonBrowse`, source render/projection |
| Shared website scope, filters/detail/history and invalidation | `js/app.js`, `season-ui-state.js`, filter section, analyze and roster consumers |
| Eight MCP tools, schema v2, context binding/cursor and bounded output | research contracts/handlers, canonical state, domain adapter/projection |
| Scope/eligibility before candidate cap500; ambiguity choices max20 | shared resolver plus transport error schema/tests |
| Whole-generation public assets and real clean release gate | public manifest/shell hashes, asset builder/verifier, existing final attestation |

Zero reviewed VN rulesets/configs/evaluations and source-only references are accepted current data state. Source authorization includes Recommended. Historical TDD gaps and Python real-source skips remain disclosed, not new missing-feature findings.

## Scout handoff

Trace asynchronous scan completion after scope change; URL/hash/query synchronization across section changes; default vs alternate config selections and null score; mandatory/optional conditions; same-team multiple config resource locks; source-record identity/provenance; public exclusion before validation; bounded nested output after truncation; v1/v2 identity and private artifact closure. These are investigation targets, not confirmed findings.

## Verdict — changes requested

Two confirmed P2 defects; no P0/P1 finding accepted by the controller. The core reviewer initially rated the candidate bug High; final priority is P2 because its validated trigger requires populated seasonal configs and the shipped VN config set remains empty. This does not reduce the correctness requirement before publishing reviewed seasonal data. No code fix or commit was made during review.

### P2 — Config expansion inherits a pre-feasibility cut and drops a buildable team

Location: `js/team-recommend-engine.js:579-582`, calling `candidatePool` at130-136.

The new seasonal path feeds individual configs into the legacy 60/80-row prefix cut before matching owned resources. A team with many configs can consume that entire prefix and crowd out another team. Controller reproduction constructs a **valid, reviewed bundle** with61 T0 configs in one context:60 configs of team-a require unowned Dũng/Em/Giang, and config-060 of another team requires owned Anh/Bình/Cường plus six owned tactics. After `refreshConfigProofs` and `validateSeasonBundle`, the shared projector accepts all61 under its500 cap. Default `fullBox:false` returns an empty portfolio and only60 missing-hero diagnostics; `fullBox:true` returns config-060, as does default mode when that config is tested alone.

The old prefix cut predates this change; the new regression is applying it to expanded same-team seasonal configs. No available team is reported even though an admitted config is buildable. Keep legacy no-context behavior; for seasonal mode, run resource feasibility across the projector-bounded set before applying the established search/portfolio budget. Add a validated-bundle regression where many unbuildable configs precede one buildable different team.

Evidence: [controller reproduction](code-review-260912-1557-candidate-repro.json), [core review](code-review-260912-1557-season-core.md). Root ran the repro with Node24.20.0 against the reviewed commit. No synthetic fixture was written into public data.

## Other confirmed finding

### P2 — E2E writes tracked screenshots and blocks the next clean-source asset build

Location: `tests-e2e/season-lookup.spec.mjs:149` (same pattern at257).

From clean final HEAD, `npm run test:e2e -- tests-e2e/season-lookup.spec.mjs --grep 'usable at 375px'` passes1/1 but modifies tracked `plans/260907-0233-season-team-lookup/reports/ui-detail-375-dark.png`. Immediately running the real asset builder exits1 `SOURCE_NOT_CLEAN`. The test creates screenshot output under committed historical reports instead of Playwright's ignored per-test output directory, although line148 already uses `testInfo.outputPath`. Every ordinary verification run can therefore dirty source and require manual restoration before packaging. This happened in the earlier full gate and was reproduced on the final commit. This is a local verification→packaging regression, not an assertion that the current CI stage order always fails.

Use `testInfo.outputPath(...)` / test attachments for generated screenshots; promote selected evidence into reports explicitly. Do not relax the release guard.

Evidence: [reproduction JSON](code-review-260912-1557-screenshot-repro.json), [passing E2E](code-review-260912-1557-screenshot-repro.log), [builder rejection](code-review-260912-1557-screenshot-builder.log). Exact original screenshot bytes restored after reproduction; worktree clean, port4174 closed. No source fix made.

## Nonblocking observation and rejected concerns

- UI source-link wording at `js/render.js:467` may be clearer if labelled as the original scored configuration's source after a selection changes. **P3 clarity only**: numeric score correctly becomes null. The accepted plan permits retaining original-config provenance, so link presence alone is not a score-binding bug. [Updated UI disposition](code-review-260912-1557-season-ui.md).
- MCP64KiB result contract vs98304-byte Worker outer-envelope limit are distinct bounds, not a contradiction. No concrete bug found in the reviewed MCP/release slice. [MCP review](code-review-260912-1557-season-mcp.md).
- Current zero reviewed VN rulesets/configs/evaluations, source-only references, prior TDD chronology exceptions and optional missing-HTML skips are explicit delivery limits. They were not converted into invented missing-feature findings.

## Fresh verification

- Root Node186/186 pass: [log](code-review-260912-1557-node.log).
- Seasonal Python62/62 pass: [log](code-review-260912-1557-python.log).
- MCP focused51/51 pass under pinned Node24.20.0: [log](code-review-260912-1557-mcp.log).
- Bounded existing375px browser test1/1 pass, revealing the side effect above.
- Full base..HEAD `git diff --check` passes.
- MCP reviewer additionally reported a fresh full repository gate with MCP351 / E2E55 / Node186 / Python139passed+12skipped / Vision53 and dry-run passing. Controller independently reran the focused checks linked above; the broader run is reviewer-reported, not claimed as a second controller run.
- UI review's initial59-case run used Node24.14.0; those are not relied upon for release evidence. Controller's pinned Node186 run covers those suites.

## Preservation and next action

Final worktree HEAD remains `4eb7f19b2f97e78f3d336b8f32762f492c7bb2e0`, clean. Review-generated375/1024 dark screenshots were preserved externally, then restored exactly from their committed bytes. Port4174 is closed; no owned preview process remains. Original source and index were not modified. Review reports/evidence live only under the original `plans/reports/`.

Fix the two P2 issues and add focused regressions, then rerun affected tests and identity-sensitive packaging after a new commit. This review does not silently change the completed implementation plan or claim the findings fixed.

Unresolved questions: none. Two P2 defects remain open; fixes were not requested in this review.

## Resolution — 2026-09-12

Both P2 findings were fixed and verified on clean local HEAD `e39db07a7cc3fb51738d952c89cab1fda515f067`. The review above is the historical pre-fix assessment. See [fix evidence](fix-260912-1610-season-review-findings.md) for eight Red→Green regressions, screenshot preservation, independent review and full final-SHA packaging gates. The nonblocking source-label observation was outside the accepted two-P2 fix scope.
