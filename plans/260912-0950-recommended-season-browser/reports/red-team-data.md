# Red Team Data Review: Recommended Season Browser Phase 1

Status: DONE_WITH_CONCERNS

Scope: reviewed `plans/260912-0950-recommended-season-browser/plan.md`, all three phase files, accepted brainstorm, and current code facts in `/Users/plateau/Project/worktrees/CamNangTQCCL-season-team-lookup`. No code edits, no tests, no network, no server.

Overall: no Critical blocker found. The plan is directionally sound and correctly treats missing new interfaces as pending implementation. The remaining risk is implementation drift around two handoff surfaces that are load-bearing for Phase 1: browser-rendered cache admission and reviewed identity evidence.

## Findings

### High: Browser fallback capture is required but has no concrete cache-entry owner

Plan evidence: Phase 1 says HTTP-unavailable pages are verified/captured by browser under the same provenance contract, and page records must include `transport` as `python-http|browser-rendered` (`plans/260912-0950-recommended-season-browser/phase-01-start.md:36`, `:40`). The file inventory creates only the Python crawler and fixtures (`phase-01-start.md:68`, `:75`).

Code evidence: current v1 cache builder reads a flat manifest item with only `url`, `path`, `sha256`, and `fetchedAt`; it validates `fetchedAt` and stores only detail provenance, with no `transport`, original/final URL pair, status, parser outcome, or browser-import path (`pipeline/sgsdeck_recommended.py:225-258`). Current tests build the same v1 item shape (`tests/test_sgsdeck_recommended.py:106-112`).

Failure scenario: a season/category is visible only after browser rendering. The implementer captures HTML manually, but there is no planned command or interface that turns that capture into a URL-keyed, checksum-bound, parser-validated cache entry. The run can then either skip the scope while still trying to publish, or paste browser HTML into fixture/test paths without making it part of the acquisition inventory.

Minimal correction: add an explicit Phase 1 owner such as `record_rendered_page(...)` or `crawl_sgsdeck_recommended.py --import-rendered-page <url> <html>`, with tests proving `transport=browser-rendered`, original/final URL/status, checksum, parser outcome, and scope membership are validated by the same manifest path as Python HTTP pages.

### High: Dedup identity inputs need explicit read/hash ownership, not only a future map file

Plan evidence: Phase 1 requires a reviewed hero+tactic bridge with source/local aliases and exact base/SP/CO/40Y identity (`phase-01-start.md:27`, `:45`, `:69`, `:113`). It lists `data/teams.json` and `js/hero-identity.js` as read contracts but not the current local Chinese/Vietnamese dictionaries or typo alias files (`phase-01-start.md:79`).

Code evidence: local teams store Vietnamese display names and alternatives, e.g. `team-intro-1` has Vietnamese heroes/tactics plus tactic alternatives (`data/teams.json:128-157`, `:176-193`, `:212-225`). Recommended evidence stores Chinese source names/tactics, e.g. `40Y 呂布`, `引弦力戰`, `血刃爭鋒` (`pipeline/sgsdeck-recommended-evidence.json:20-27`). The existing dictionaries already contain Chinese/Vietnamese mappings such as `吕布` -> `Lữ Bố` and `临危救主` -> `Lâm Nguy Cứu Chủ` (`data/heroes-dict.json:723-749`, `data/tactics.json:4234-4244`), and current typo aliases live in `pipeline/aliases.json:1-31`.

Failure scenario: the builder compares Team chuẩn Chinese names to Team khác Vietnamese names using ad hoc transliteration or the JS slug helper. That can miss exact duplicates or collapse distinct variants. Current `hero-identity.js` only models SP/CO/base (`js/hero-identity.js:5`, `:29-34`); it does not encode 40Y identity, and Phase 1 correctly plans a Python resolver, but the plan does not bind the resolver to the current dictionary/alias evidence.

Minimal correction: add `W/data/heroes-dict.json`, `W/data/tactics.json`, `W/data/books-dict.json`, and `W/pipeline/aliases.json` as read-only evidence inputs for `recommended-identity-map.json`; include their hashes in the identity review report or map descriptor. Add red cases for at least `40Y 呂布` vs local `Lữ Bố`, traditional/simplified tactic spelling such as `當鋒摧決`/`当锋摧决`, and an unresolved Chinese source name that must not prove distinctness.

### Medium: The initial Team khác admission count can be overstated unless primary and alternative branches are reported separately

Plan evidence: Phase 1 admits existing explicit nonduplicates, disallows Cartesian expansion from slash/independent alternatives, and keeps ambiguous branches pending (`phase-01-start.md:26`, `:47`, `:50`, `:51`). Success criteria require measured admission/duplicate/pending counts (`phase-01-start.md:101`, `:133`).

Code evidence: current `data/teams.json` has 166 local teams in this worktree; many rows include embedded alternatives rather than independently sourced complete configurations. Example `team-intro-1` has tactic alternatives under the same hero slots (`data/teams.json:153-157`, `:188-193`). A local count probe found 72 teams with tactic alternatives, 10 with hero alternatives, 9 with book alternatives, and 58 with hero variant text.

Failure scenario: implementation reports "all existing nonduplicates" as if each current team row is a single explicit build, while silently dropping ambiguous alternatives or accidentally expanding them into unsupported variants. Either outcome changes the user-visible Team khác count without evidence.

Minimal correction: require `dedup-summary.json` to separate `primaryExplicitAdmitted`, `explicitVariantAdmitted`, `duplicate`, `pendingAlternative`, and `pendingIdentity` counts. Public `other-teams.json` should only contain admitted variants; the report should state how many current rows had alternatives and how they were classified.

## Phase 1 Current-Code Claim Verification

| # | Claim checked | Status | Evidence |
|---|---|---|---|
| 1 | The target worktree is on `feat/season-team-lookup`. | VERIFIED | `git status --short --branch` returned `## feat/season-team-lookup`. |
| 2 | Current Recommended adapter is an offline/source-reference parser, not runtime crawl. | VERIFIED | `pipeline/sgsdeck_recommended.py:1`, `:225-289`. |
| 3 | Current URL guard only accepts public `https://sgsdeck.com/recommended` list/detail URLs and list query keys `season`/`category`. | VERIFIED | `pipeline/sgsdeck_recommended.py:99-113`. |
| 4 | Current list parser is v1 single-argument `parse_recommended_list(html)` and extracts count, season, IDs, URL, title, score, holders, tier, faction. | VERIFIED | `pipeline/sgsdeck_recommended.py:127-159`. |
| 5 | Current detail parser requires exactly three ordered holders and rejects empty tactic slots. | VERIFIED | `pipeline/sgsdeck_recommended.py:170-205`, especially `:198-201`. |
| 6 | Current join validates detail membership and list/detail URL/title/score/season/holder parity. | VERIFIED | `pipeline/sgsdeck_recommended.py:208-222`. |
| 7 | Current canonical evidence writer rejects incomplete selected scope. | VERIFIED | `pipeline/sgsdeck_recommended.py:262-264`; regression expectation at `tests/test_sgsdeck_recommended.py:114-121`. |
| 8 | Current v1 builder is not a multi-scope generation builder: manifest length is capped at 501 and only one `/recommended` list is allowed. | VERIFIED | `pipeline/sgsdeck_recommended.py:228-253`. This is a current limitation, not a bug in the plan because v2/new builders are planned. |
| 9 | Current evidence artifact is one 25-record `og-兵演春秋` source snapshot, not full 29-season coverage. | VERIFIED | `pipeline/sgsdeck-recommended-evidence.json:1-8`, `:70-75`. |
| 10 | The plan says the 14-test source baseline passed, but this review did not run tests by instruction. | UNVERIFIED | There are 14 `test_` declarations in `tests/test_sgsdeck_recommended.py:19-139`; pass/fail status was not rechecked. |

## Affected Current Callers For Changed Interfaces

`pipeline/sgsdeck_recommended.py` parser/build interfaces:
- Module-internal/CLI calls: `parse_recommended_list` at `pipeline/sgsdeck_recommended.py:254`, `parse_recommended_detail` at `:257`, `join_recommended_evidence` at `:262`, `build_recommended_evidence` from `main()` at `:289`.
- Test callers: `tests/test_sgsdeck_recommended.py:19-139` covers URL validation, list parse, detail parse, join, and v1 cache publishing.

`js/hero-identity.js` should remain a read contract in Phase 1, not be changed for Python dedup unless a separate JS consumer migration is intentional:
- Current callers: `js/season-ui-state.js:73-76`, `js/roster-scan-map.js:3,48,52`, `js/analyze-map.js:6,78,116`, `js/season-context.js:2,142`, `js/render.js:423,431`, `js/team-recommend-engine.js:2,38,97`, and `tests-js/hero-identity.test.mjs:4-62`.

## Pending Implementation, Not Bugs

- Missing files such as `pipeline/crawl_sgsdeck_recommended.py`, `pipeline/recommended_identity.py`, `pipeline/recommended_team_dedup.py`, `pipeline/build_recommended_reference.py`, and `src/data/recommended-reference/current.json` are planned Phase 1 outputs, not current defects.
- The current `src/lib/recommended-reference-data.mjs` spike hardcodes one source season and uses dictionary/transliteration display lookup (`src/lib/recommended-reference-data.mjs:4`, `:12-20`); the plan correctly says not to adopt it.
- Existing current-code limits such as one selected v1 scope and 501 cache items are not blockers if Phase 1 replaces them under the v2 acquisition/generation contract while preserving v1 tests.

Summary: no Critical blocker; fix the two High plan gaps before implementation so Phase 1 cannot publish browser-captured or identity-mapped data without deterministic evidence.

Concerns/Blockers: concerns only; no blocker found under the requested Phase 1 data review.
