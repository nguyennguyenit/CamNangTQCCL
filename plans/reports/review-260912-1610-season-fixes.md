# Season fix review — 2026-09-12

Scope: bounded fix diff in `/Users/plateau/Project/worktrees/CamNangTQCCL-season-team-lookup` against `4eb7f19b2f97e78f3d336b8f32762f492c7bb2e0`.

Files reviewed:

- `js/team-recommend-engine.js`
- `tests-js/season-context.test.mjs`
- `tests-e2e/season-lookup.spec.mjs`
- `mcp-worker/src/generated/workflow-build.ts`
- `docs/season-team-data.md`

Verdict: no critical or important defect found in the fix. Score: 9/10.

The engine fix is cause-aligned. Seasonal mode now keeps the projector-bounded candidate set for feasibility checks, while legacy no-context mode keeps the existing 60/80 prefix behavior. Full-box still searches the original 60-candidate DFS window with the existing 250000 node budget, but seeds `best` from a whole-pool seasonal greedy result so a feasible tail candidate is not lost. The DFS starts from the original locked seed, so locked-resource accounting is not widened or double-counted.

The prior candidate bug is covered by eight validated-bundle regressions: 61/81/500 seasonal configs, missing hero and missing tactic variants, default and full-box paths, plus same-canonical-team uniqueness with a compatible second team. Existing engine tests also cover legacy API shape, same-team config uniqueness, stable config tie ordering, locks, ordered repeated holders, and Unicode ID bounds.

The screenshot fix is scoped and meaningful. The tracked historical report paths were replaced with `testInfo.outputPath(...)` for the affected screenshot writes, and a file-level hash guard snapshots all tracked `*.png` files before the Playwright file and compares them after the file. Static review found no remaining writes to `plans/260907-0233-season-team-lookup/reports` in `tests-e2e/season-lookup.spec.mjs`; there are three `testInfo.outputPath` screenshot writes.

The generated MCP workflow build ID was regenerated and `npm --prefix mcp-worker run check:workflow-build` passed under Node 24.20.0. This confirms the generated hash matches the current semantic workflow inputs after the engine change.

Fresh verification run in this review:

- `PATH=/Users/plateau/.nvm/versions/node/v24.20.0/bin:$PATH node --test tests-js/season-context.test.mjs tests-js/team-recommend-engine.test.mjs` — 61/61 passed.
- `PATH=/Users/plateau/.nvm/versions/node/v24.20.0/bin:$PATH npm --prefix mcp-worker exec vitest run test/research/season-research.test.ts test/research/season-bounds.test.ts test/research/season-errors.test.ts test/domain/recommendation-service.test.ts test/domain/legacy-domain-adapter.test.ts` — 43/43 passed.
- `PATH=/Users/plateau/.nvm/versions/node/v24.20.0/bin:$PATH npm --prefix mcp-worker run check:workflow-build` — passed.
- `PATH=/Users/plateau/.nvm/versions/node/v24.20.0/bin:$PATH node --check tests-e2e/season-lookup.spec.mjs && PATH=/Users/plateau/.nvm/versions/node/v24.20.0/bin:$PATH node --check js/team-recommend-engine.js` — passed.
- `git diff --check 4eb7f19` — passed.

Controller-provided additional evidence, not rerun here to avoid taking the serialized browser/server gate: broader 194 Node tests passed, MCP typecheck passed, and 28 season E2E tests passed while preserving all 9 tracked PNGs.

Scout findings reviewed:

- Candidate identity: fixed path preserves `candidateKey=config.id`, keeps canonical `team.id`, rejects duplicate seasonal candidate keys, and keeps `configId === candidateKey`.
- Same canonical team: greedy and DFS skip additional configs once a team is already selected; regressions verify two configs of one team do not count as two teams.
- Locks: full-box greedy incumbent and DFS both receive the original locked seed and reuse existing resource sets.
- Budget: seasonal feasibility now scans at most the shared projector's 500 admitted configs; DFS remains capped to the first 60 eligible configs and 250000 visits.
- Legacy compatibility: no-context candidate slicing and output shape are covered by existing tests.
- Screenshot side effects: writes go to Playwright output paths; tracked PNG mutation is guarded.

Residual risk: diagnostics for seasonal recommendations can now describe more blocked candidates because feasibility examines the full projector-bounded set. That is expected from the accepted fix and remains bounded by the 500-candidate projector plus existing MCP result-size guards.

Status: DONE
Summary: The two P2 findings are fixed within the requested scope; no blocker or important regression was found.
Concerns/Blockers: none.
