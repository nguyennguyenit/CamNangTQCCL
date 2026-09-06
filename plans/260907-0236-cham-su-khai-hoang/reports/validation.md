# Validation — Chạm Sứ separation

Date: 2026-09-07, Asia/Ho_Chi_Minh. Verified shared main implementation; no code changes, commit, or deployment by tester.

| Command / check | Result |
|---|---|
| `python3 -m unittest tests.test_parse_secondary` | 9 passed, no skips |
| `node --test tests-js/khaihoang-data.test.mjs` | 3 passed, no skips |
| `python3 -m unittest discover -s tests` | 89 passed, no skips |
| `npm run test:node` | 138 passed, no skips ([full log](validation-node.log)) |
| `npm run check` | 9 files, 0 errors, 0 warnings, 0 hints |
| `npm run build` | Passed ([full log](validation-build.log)) |
| `npm run verify` | Verified 36 files, 33 raw assets |
| `npm run test:dist` | 9 passed, no skips |
| `npm run test:e2e:astro` | 21 passed in 22.4s, including all 7 khaihoang tests ([full log](validation-e2e.log)) |
| Isolated fixture regression | 5 TestChamSu tests passed, no skips |
| Full JSON preservation | Exact equality excluding only old transforms and new chamSuTeams |

Focused Python and Node ran before full suites. Check ran independently. Build completed before artifact verification and full E2E; Playwright also performed its configured fresh build.

## TDD evidence

- [Parser evidence](parser-tdd.md): no-transforms assertion failed against old parser, then 9 focused tests passed. Missing imports were not used as red proof.
- [Data red log](data-red.log): 2 existing tests passed; new assertion failed with missing independent Chạm Sứ table. [Green log](data-green.log) and independent focused rerun pass all 3.
- [UI evidence](ui-tdd.md): standalone heading absent before renderer implementation; 7 focused tests passed afterward. Full 21-test E2E rerun confirms shared renderer contracts.
- Parser/UI red outcomes are retained as narrated owner evidence rather than raw logs; data red has a raw log. No tests were weakened during validation.

## Preservation and clean-source execution

Independently loaded [baseline](khaihoang-baseline.json) and current data/khaihoang.json, removed only old teams[].transforms and new top-level chamSuTeams, then asserted full object equality. This covers every preserved team field, variants/options, season fields, mines, and other top-level data. Agrees with [data preservation](data-preservation.json): 15 opening teams, 5 mines, 7 removed attachments, 8 Chạm Sứ groups.

Copied only pipeline, test module/package initializer and both source fixtures to a fresh temporary directory. Ran `python3 -m unittest tests.test_parse_secondary.TestChamSu`: 5 passed. No Meta Team PK directory existed there, proving new parser/payload tests have no ignored HTML dependency. Temporary copy was automatically removed. Existing source-dependent tests ran without skips in main workspace.

Both tests/fixtures/khaihoang-cham-su-source.html and .csv are visible untracked Git candidates; neither matches ignore rules. They must accompany a later authorized commit; no staging performed. Historical HTML expects six groups; newer CSV/runtime expects eight, matching reconciliation.

## Process lifecycle

Port 4174 was free before E2E. Playwright owned preview PID 34666, command `npm run preview -- --host 127.0.0.1 --port 4174`, worktree /Users/plateau/Project/CamNangTQCCL. Process exited automatically when Playwright completed; no user process stopped. Final listener check is recorded by tester.

All requested validation gates pass. Final reviewer/doc acceptance remains with controller. No unresolved test questions.
