# Phase 2 Shared Core Code Review

Date: 2026-09-12
Reviewer: code-reviewer
Scope: read-only review of the Phase 2 shared season core. This review intentionally excludes in-progress UI/MCP consumer work per task instruction.

## Code Review Summary

### Scope

- Plans and contracts read:
  - `plans/260907-0233-season-team-lookup/phase-01-start.md`
  - `plans/260907-0233-season-team-lookup/phase-02-season-team-configurations.md`
  - `plans/260907-0233-season-team-lookup/reports/season-shared-contract.md`
  - `plans/260907-0233-season-team-lookup/reports/phase-02-data-validation.md`
  - `plans/260907-0233-season-team-lookup/reports/phase-02-resolver-validation.md`
  - `plans/260907-0233-season-team-lookup/reports/validation.md`
- Core implementation reviewed:
  - `pipeline/build_season_data.py`
  - `pipeline/season_validation.py`
  - `pipeline/parse_coexist_csv.py`
  - `js/season-context.js`
  - `js/team-recommend-engine.js`
  - `src/lib/public-artifact-manifest.mjs`
- Relevant tests and fixtures reviewed:
  - `tests/test_build_season_data.py`
  - `tests/test_parse_coexist_csv.py`
  - `tests/test_sgsdeck_recommended.py`
  - `tests-js/season-context.test.mjs`
  - `tests-js/team-recommend-engine.test.mjs`
  - `tests-js/hero-identity.test.mjs`
  - `tests-js/team-tier-badge.test.mjs`
  - `pipeline/season-team-configs.json`
  - `pipeline/season-team-evaluations.json`
  - `pipeline/season-content-links.json`
  - `pipeline/season-registry.json`
  - `pipeline/season-evidence.json`
- Focus: exact proof/config/selection/score linkage, Python/JS parity, fail-closed cross references, 500-after-eligibility behavior, mutual exclusion, source payload preservation, legacy no-context compatibility, public sidecar manifest safety, and Phase 2 acceptance.
- Scout findings: native edge-case scouting was performed through the contract, generator, validator, resolver, engine, and tests. No new source-grounded defects were found in the frozen shared core.

### Overall Assessment

Verdict: PASS for the Phase 2 shared core.

- Critical count: 0
- High count: 0
- Medium count: 0
- Low count: 0
- Review score: 9/10 for the reviewed shared-core scope. The remaining point is reserved for accepted historical TDD gaps and consumer integration still in progress, both outside this defect review.

The implementation preserves the intended conservative boundary: reviewed source can identify the Binh Dien scenario and source-owned links, but it does not publish VN configs, VN evaluations, reviewed rulesets, `configId`s, or score promotion without exact configuration evidence.

## Priority Findings

### Critical Issues

None.

### High Priority

None.

### Medium Priority

None.

### Low Priority

None.

## Acceptance and Edge Cases Checked

| Area | Result | Evidence |
| --- | --- | --- |
| Phase 1 scenario/source registry | PASS | `pipeline/season-registry.json` contains one reviewed `binh-dien-xuan-thu` scenario with no rulesets; `pipeline/season-evidence.json` contains reviewed scenario attribution and source snapshot entries only. Unknowns remain null/pending rather than inferred. |
| Phase 2 public sidecars | PASS | `src/lib/public-artifact-manifest.mjs` registers `season-context` plus five public season sidecars: content links, evidence, registry, team configs, and team evaluations. No extra unreviewed source artifact is exposed. |
| No VN score/config promotion | PASS | Current config/evaluation sidecars are empty arrays. Data inventory found `reviewed_ruleset_links=0` and `configIds_nonempty=0`; source scores are preserved as source payload context, not converted to public VN evaluations. |
| Exact proof and config linkage | PASS | `pipeline/season_validation.py` verifies reviewed config fingerprints, exact ranking config proof, score proof/provider/region/url/source season/snapshot/config fields, and forbids unresolved cross references. |
| JS resolver fail-closed behavior | PASS | `js/season-context.js` validates config, evaluation, score proof, and selection shape before projection. `resolveSelectionScore` only returns a score for canonical exact selection. |
| Python/JS canonical parity | PASS | Contract defines deterministic canonical JSON. Python and JS canonical fingerprint tests use the same golden vector and passed in fresh local verification. |
| 500-after-eligibility | PASS | `projectSeasonCandidates` filters to reviewed exact-scope eligible configs before applying the 500 limit; the JS test covers a 501 eligible reject while pending records are excluded before budget. |
| Mutual exclusion | PASS | `js/team-recommend-engine.js` enforces canonical same-team exclusion in both greedy and search paths; the seasonal mutual-exclusion tests passed. |
| Real source payload preservation | PASS | `pipeline/parse_coexist_csv.py` uses strict CSV parsing and preserves raw multiline fields, CRLF-sensitive bytes, raw `C` suffixes, blank slots, locators, and source team/hero ownership. Tests cover 5 source links, 25 teams, and 75 hero positions. |
| Legacy no-context compatibility | PASS | No-context recommendation output remains deep-equal by current report evidence, with `configId` and `seasonContext` omitted; legacy data hash remains unchanged by task-provided validation. |
| Public contract safety | PASS | Publication output rebuilt to a temporary directory produced byte-identical copies for the five data sidecars against `data/`; manifest scope matches the contract. |

## Verification Performed

Fresh checks run during this review:

```text
python3 -m unittest tests.test_build_season_data tests.test_parse_coexist_csv tests.test_sgsdeck_recommended -v
Result: OK, 61 tests

node --test tests-js/season-context.test.mjs tests-js/team-recommend-engine.test.mjs tests-js/hero-identity.test.mjs tests-js/team-tier-badge.test.mjs
Result: 62 passed, 0 failed
```

Existing Phase 2 validation logs reviewed:

```text
plans/260907-0233-season-team-lookup/reports/phase-02-python.log
Result: OK, 187 tests

plans/260907-0233-season-team-lookup/reports/phase-02-node.log
Result: 180 passed, 0 failed
```

Data sidecar parity and inventory checked locally:

```text
pipeline/season-team-configs.json       list=0, data hash match
pipeline/season-team-evaluations.json   list=0, data hash match
pipeline/season-content-links.json      list=10, data hash match

links_total=10
source_links=5
legacy_links=5
source_teams=25
hero_positions=75
reviewed_ruleset_links=0
configIds_nonempty=0
```

Generator reproducibility checked locally:

```text
python3 -m pipeline.build_season_data --output-dir /tmp/tqccl-season-core-review-out

season-registry.json          byte/hash match against data/
season-evidence.json          byte/hash match against data/
season-team-configs.json      byte/hash match against data/
season-team-evaluations.json  byte/hash match against data/
season-content-links.json     byte/hash match against data/
```

## Residual Risks and Explicit Non-Issues

- The first eleven resolver cases without behavioral Red are already disclosed as historical TDD gaps and were explicitly accepted for this review; I did not reopen them as new defects.
- UI/MCP consumers are being edited concurrently and were explicitly out of scope. This report covers only the frozen shared Python/JS core and public data sidecars.
- Publication rollback is replacement-failure safe but not crash/power-loss atomic across all files. This is already disclosed in Phase 2 data validation and is not a blocker under the current acceptance contract.

Status: DONE
Summary: The Phase 2 shared core passes the acceptance review with no Critical, High, Medium, or Low findings. Exact proof/config/selection/score linkage, conservative no-promotion behavior, Python/JS parity, source payload preservation, and legacy compatibility are all supported by source inspection and tests.
Concerns: None for the reviewed shared-core scope.
