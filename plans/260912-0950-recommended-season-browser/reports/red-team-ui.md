# Red-team UI plan review: Recommended season browser

Date: 2026-09-12, Asia/Saigon. Scope was plan-document review with grep/read verification only; no tests, network, dev server, lint, typecheck or build were run.

Plan reviewed: `plans/260912-0950-recommended-season-browser/plan.md` plus all three phase files, with Phase 2 focus. Decision source: `plans/reports/brainstorm-260912-team-chuan-team-khac.md`. Code root inspected: `/Users/plateau/Project/worktrees/CamNangTQCCL-season-team-lookup`.

## Overall assessment

Phase 2 is now mostly execution-ready as a pending contract. The earlier consumer routing, scoped publication, URL transition, Team khác attribution and test-migration gaps are represented in the current phase file. I found one high-priority source-content integrity gap and one medium validation-path gap that should be fixed in the plan before cook. I did not treat planned-new files/interfaces as missing implementation defects.

## Findings

### High: Recommended source links need a concrete URL allowlist before render

Plan evidence: Phase 2 requires detail to show source URL fields and safe DOM/text (`plans/260912-0950-recommended-season-browser/phase-02-browser-and-details.md:23,50`), while Phase 3 only names a broad "unsafe href" scenario (`plans/260912-0950-recommended-season-browser/phase-03-validation-and-release.md:97`). Phase 1 preserves public source URLs in generated details/Other rows (`plans/260912-0950-recommended-season-browser/phase-01-start.md:58-59`) but does not define a Phase 2 browser/render allowlist for published anchors.

Code evidence: the shared DOM helper assigns attributes directly with `setAttribute` (`/Users/plateau/Project/worktrees/CamNangTQCCL-season-team-lookup/js/render.js:4-10`). Current renderers put source/provenance URLs directly into `href` (`/Users/plateau/Project/worktrees/CamNangTQCCL-season-team-lookup/js/render.js:390,414,467,477`). The current validator accepts any credential-free `http:` or `https:` URL (`/Users/plateau/Project/worktrees/CamNangTQCCL-season-team-lookup/js/season-context.js:94-98`), and tests reject `javascript:` but not a wrong HTTPS authority (`/Users/plateau/Project/worktrees/CamNangTQCCL-season-team-lookup/tests-js/season-context.test.mjs:152-154,228-232`). The hardcoded prototype has stricter SGSDeck expectations, but the plan explicitly says not to adopt it (`plans/260912-0950-recommended-season-browser/phase-01-start.md:81`).

Failure scenario: a compromised or malformed imported source record contains `https://evil.example/recommended/foo` as an SGSDeck-looking source/provenance link. The public JSON can still be rendered as text-safe content, but the UI publishes a trusted-looking outbound link on Team chuẩn detail/card. This is not script XSS, but it is source-integrity failure: the site vouches for a source destination that is not the captured Recommended authority.

Minimal fix: add a Phase 2-owned `validateRecommendedPublicUrl` or equivalent policy in the loader/render path. For Team chuẩn, require `https://sgsdeck.com/recommended` list/detail URLs with no credentials, no hash-only tricks, and normalized pathname matching the declared `sourceConfigId`. For future external Team khác, require an explicit provider allowlist per admitted source type. Render non-allowlisted URLs as plain text plus an unavailable notice. Add C2/C4 cases for wrong HTTPS host, `http:`, credentials, encoded traversal-looking paths, and valid SGSDeck/player-source URLs where those are deliberately admitted.

### Medium: legacy port-4321 browser config can still validate the wrong app instance

Plan evidence: Phase 2 says C4 must use `W/playwright.config.mjs` only, on port 4174, and must not use the unrelated port-4321 server or add a second runner path (`plans/260912-0950-recommended-season-browser/phase-02-browser-and-details.md:169-173`). Phase 3 repeats the 4174 runner command (`plans/260912-0950-recommended-season-browser/phase-03-validation-and-release.md:109,121`). The Phase 2 file inventory and test migration list do not name the legacy config file (`plans/260912-0950-recommended-season-browser/phase-02-browser-and-details.md:101-105,127-133`).

Code evidence: the main Playwright config builds and previews on 4174 with `reuseExistingServer:false` (`/Users/plateau/Project/worktrees/CamNangTQCCL-season-team-lookup/playwright.config.mjs:3,16-20`). A legacy config still exists and disables the web server while pointing at `http://localhost:4321` (`/Users/plateau/Project/worktrees/CamNangTQCCL-season-team-lookup/tests-e2e/season-playwright.config.mjs:1-2`). `package.json` exposes the normal `test:e2e` command but does not fence the legacy config (`/Users/plateau/Project/worktrees/CamNangTQCCL-season-team-lookup/package.json:18-19`).

Failure scenario: during Phase 2, someone runs the old `season-playwright.config.mjs` path from habit or a local report. It can test a stale user dev server on 4321 instead of the freshly built 4174 artifact. That can produce false green evidence for old Team PK/Meta UI or false failures caused by another session's server state.

Minimal fix: add `tests-e2e/season-playwright.config.mjs` to Phase 2 ownership. Either migrate it to the same 4174 webServer contract or mark it retired in a small test/script assertion so release evidence cannot cite it. The plan should require validation logs to include the config path, baseURL, and webServer ownership, not only the command name.

## Ten current-code claim checks

| # | Status | Phase 2 / plan claim checked | Current code evidence | Exact consumers |
|---|---|---|---|---|
| 1 | VERIFIED | Current visible team nav is still old Team PK / Meta phe before migration. | `src/pages/index.astro:33-43` has `team-pk`, `meta-cu`, and other section buttons. | Shell nav, mobile menu, `js/app.js` section switching, frontend shell tests. |
| 2 | VERIFIED | Unknown/no hash currently defaults to `team-pk`; plan changes default to Team chuẩn. | `js/app.js:52-70` defines `SECTIONS` and fallback `"team-pk"`. | Direct reload/deep links, `hashchange`, `switchSection`, `runtime-asset-contract.test.mjs:103-124`. |
| 3 | VERIFIED | Current shared season controls are scenario/ruleset controls, not the planned source season/category picker. | `src/pages/index.astro:52` mounts `season-controls`; `js/app.js:165-168` renders `season-scenario` and `season-ruleset`. | Team PK, Meta cũ, Cùng Tồn, Analyze, Roster Recommend via `switchSection` visibility. |
| 4 | VERIFIED | Current season team browser still exposes score sorting. | `js/team-filter-section.js:183-196` creates the sort select; `js/season-ui-state.js:47-62` accepts and applies `sgsdeck-score`. | `createSeasonTeamSection`, Team PK/Meta season rows, URL `sort` parameter, season E2E/state tests. |
| 5 | VERIFIED | Existing season query filters do not yet include `season`, `category`, or `subcategory`. | `js/season-ui-state.js:5-7` has artifacts/filters; `:19-31` parses `scenario`, `ruleset`, `q`, `sort`, `config`; `:34-38` facets only unit/tier/team fields. | `queryForSection`, `createSeasonTeamSection`, `createSeasonCoexistSection`, URL state tests. |
| 6 | VERIFIED | Existing configured cards strip the hero/tactic/book line content that Team chuẩn cards must show. | `js/render.js:118-144` builds hero rows; `js/render.js:402-408` removes `.heroes .line`, counters and notes for config cards. | Current season Team PK/Meta cards and `season-lookup.spec.mjs` configured-card assertions. |
| 7 | VERIFIED | Current public artifact manifest is root basename-only and has no scoped Recommended artifacts. | `src/lib/public-artifact-manifest.mjs:17-58` lists root JS/CSS/data; `:67-75` rejects slash paths. | Root JS/CSS/data routes, `root-static-artifacts.ts`, dist verifier, header/dist tests. |
| 8 | VERIFIED | Current Astro data route only supports `/data/<file>.json`, not `/data/recommended/...`. | `src/pages/data/[file].json.ts:4-12`; file search found no `src/pages/data/recommended/*` route. | Astro static paths, root data consumers, future Recommended route helper. |
| 9 | VERIFIED | Current dist verifier computes allowed output from root manifest plus static/control files. | `scripts/verify-astro-dist.mjs:26-50` builds expected files; `:53-72` checks byte parity; `:74-90` rejects private/secret-like paths. | `npm run verify`, `npm run test:dist`, release packaging evidence. |
| 10 | VERIFIED | Planned Recommended interfaces are intentionally new, not missing-current bugs. | Phase 2 marks `recommended-reference-state.js`, `recommended-reference-render.js`, `recommended-reference-artifacts.ts`, and Recommended route tests as Create (`phase-02-browser-and-details.md:98-102`); file search found none in W. | Future root HTML pin, Recommended routes, app loader, C1/C2/C4 tests. |

## Edge-case scout notes

- Source content is untrusted even when text-rendered safely; link destinations need the same source authority binding as byte/hash artifacts.
- Publication path integrity is otherwise well-covered in the revised plan: selected generation only, root HTML pin, shared route/dist helper, exact bytes, stale-generation unavailable behavior.
- Consumer identity, alias transitions, Team khác attribution, no-score-sort UI, and test migration are now explicitly covered in Phase 2; I did not re-raise them as active findings.

## Metrics

- Type coverage: not measured; no typecheck run by request.
- Test coverage: not measured; no tests run by request.
- Linting issues: not measured; no lint run by request.

## Unresolved questions

None for product scope. The only execution choices are how strictly to encode the source URL allowlist and whether to migrate or retire the legacy 4321 E2E config.

Status: DONE_WITH_CONCERNS
Summary: Two concrete plan fixes remain before Phase 2 cook: source-link authority validation and removal/migration of the stale port-4321 validation path.
Concerns/Blockers: The URL allowlist issue is high priority because it affects published source content integrity. No implementation files were edited.
