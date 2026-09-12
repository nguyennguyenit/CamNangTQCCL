## Code Review Summary

### Scope

- Files reviewed: `js/season-context.js`, `js/team-recommend-engine.js`, `pipeline/build_season_data.py`, `pipeline/season_validation.py`, `pipeline/parse_coexist_csv.py`, `pipeline/sgsdeck_recommended.py`, focused callers/tests in `js/roster-recommend-ui.js`, `mcp-worker/src/domain/recommendation-service.ts`, `mcp-worker/src/research/research-handlers.ts`
- Diff scope checked: `f221c2f55b9f16d857e5785b7fcb7d25a19b705e..4eb7f19b2f97e78f3d336b8f32762f492c7bb2e0`
- Focus: Stage 2 code quality on season lookup core/source contracts
- Scout findings applied: exact SGSDeck score binding, reviewed claim boundaries, source-owned coexist mapping, same-team/multiple-config identity, seasonal candidate limit, MCP/UI parity, atomic sidecar publication

### Overall Assessment

Validator and source-ingestion boundaries are generally strong: exact config fingerprints, source snapshots, sourceSeason, reviewed claim kind, ordered holder slots, raw CSV fields, and rollback-on-replace are all enforced and covered by focused tests. I found one real recommendation-path defect that passes the current happy-path suites and can drop buildable seasonal teams before resource matching.

### Critical Issues

None found in the reviewed core/source scope.

### High Priority

1. Seasonal default recommendation silently discards buildable candidates after the first 60 sorted configs.

   `js/team-recommend-engine.js:130-136` truncates the candidate pool before the engine checks owned heroes/tactics at `js/team-recommend-engine.js:584-639`. In default `fullBox:false` mode, if the first 60 same-tier seasonal configs are blocked by missing heroes, a buildable config at position 61 is never inspected. This violates the documented seasonal contract that the shared projector admits up to 500 eligible configs and does not silently take an arbitrary prefix (`docs/season-team-data.md:49-54`). The 60/80 slice preexisted for legacy team-count heuristics, but the new seasonal path now feeds config-expanded candidates into it; multiple same-team configs can crowd out other teams before feasibility is checked.

   Fresh repro from a valid seasonal fixture:

   ```text
   seasonFixture -> 61 reviewed configs -> refreshConfigProofs -> validateSeasonBundle -> projectSeasonCandidates
   Projector: 61 of 500 candidates accepted
   First 60 configs: same canonical team, unowned heroes Dũng/Em/Giang
   config-060: other team, owned Anh/Bình/Cường plus all tactics
   fullBox:false portfolio = []
   fullBox:true portfolio = [config-060]
   passing only config-060 = [config-060]
   result.portfolio = []
   diagnostics.missingHeroes = 60
   diagnostics.searchedCandidates = 0
   ```

   Minimal fix: in seasonal mode, do not apply the 60/80 `candidatePool` cut before resource feasibility. Filter by mode/tier first, check ownership/resource eligibility across the full projector-bounded set, then apply the existing search/portfolio budget to feasible candidates. Preserve the legacy no-context behavior unless separately accepted. Add a regression test where 60 missing seasonal configs precede one buildable config and assert `config-060` is recommended in the default path.

### Medium Priority

None found.

### Low Priority

None found.

### Edge Cases Checked

- Reviewed scenario attribution does not authorize rulesets or engine candidates.
- Source-owned Cùng Tồn records stay reference-only and do not become tiered/scored recommendation input.
- SGSDeck source scores remain exact-selection only and return `null` for alternatives or changed selections.
- Same canonical team with multiple seasonal configs keeps config identity and is not selected twice in one portfolio.
- Ambiguous `teamId` lookups bound choices to 20 IDs with total/omitted counts.
- Source-owned coexist payload validates stable record IDs, content fingerprints, nested slots, snapshot evidence, and source URL.
- Python publication validates all sidecars before write and restores prior outputs after an injected replace failure.
- Recommended cache parser requires list/detail match and complete selected scope before writing canonical evidence.

### Verification

- PASS: `/Users/plateau/.nvm/versions/node/v24.20.0/bin/node --test tests-js/season-context.test.mjs tests-js/team-recommend-engine.test.mjs` — 53 tests
- PASS: `/opt/homebrew/bin/python3.12 -m unittest tests.test_build_season_data tests.test_parse_coexist_csv tests.test_sgsdeck_recommended` — 62 tests
- PASS: `cd mcp-worker && /Users/plateau/.nvm/versions/node/v24.20.0/bin/npm test -- --run test/research/season-research.test.ts test/research/season-bounds.test.ts test/transport/season-tools-parity.test.ts` — 18 tests
- PASS: `git diff --check f221c2f55b9f16d857e5785b7fcb7d25a19b705e..HEAD`
- REPRO: `/Users/plateau/Project/CamNangTQCCL/plans/reports/code-review-260912-1557-candidate-repro.json` records the validated fixture/projector/engine mismatch.
- Note: handoff Python path `/opt/homebrew/opt/python@3.12/libexec/bin/python3.12` was absent; actual binary used was `/opt/homebrew/bin/python3.12`.

### Metrics

- Type coverage: not measured in this scoped review
- Test coverage: not measured; 133 focused tests passed
- Linting issues: none from `git diff --check`; full lint not run by this subreview

### Unresolved Questions

None.

Status: DONE_WITH_CONCERNS
