# Implementation verification

## Phase 1 — Data contract

Status: complete for D1–D6. Dependent UI phases remain unverified.

### Red / Green record

- Baseline before new contracts: `python3 -m unittest tests.test_sgsdeck_recommended tests.test_recommended_identity tests.test_build_recommended_reference tests.test_report_recommended_translations tests.test_recommended_team_dedup` — 37 tests passed.
- D1 Red: localized publication row lacked `displayNameVi` for the team title (`KeyError` in `test_localization_adds_reviewed_names_only_and_preserves_raw_slots`). The earlier missing-symbol import error was not counted as a valid Red.
- D1 Green: global/scoped team title resolution, duplicate/mismatch rejection, and no team `stableId`; targeted tests passed.
- D2–D6 added behavioral coverage and characterization without inventing failures where the implementation was already Green. Reviewer-driven negative cases cover stale direct corpus, raw/enriched fingerprint separation, detail-only invalid `displayNotes`, extra scopes, wrong tier metadata, and unsupported lineage.
- Final focused gate after repairs: 41/41 passed. A separate synthetic equal-text ownership scenario also passed and is now included in the same 41-test suite.
- Production publication command completed successfully with the frozen cache and new mandatory `--teams` / `--content-links` inputs.

### Title review

- Reviewed 661 distinct Chinese source titles in 14 deterministic batches; entries are stored in `pipeline/recommended-identity-map.json` as `kind: team`, `reviewStatus: translation-reviewed`, and batch evidence references.
- Selected generation `b69cddeb19acbb06f0bccabe99412d8d54ac3032514582281e1941fbe56da02d` contains 1,366 Recommended rows; 1,366/1,366 have `displayNameVi`.
- Worksheet `pipeline/recommended-missing-translations.json` reports zero missing team, hero, and book names. The only unresolved item is source tactic `戮力上心` (11 occurrences); it remains raw and is not aliased to `勠力同心`.
- `桃園結義` remains the reviewed bond `Kết Nghĩa Vườn Đào`, not a selectable tactic identity.

### Content-link review

- `pipeline/recommended-content-links.json` is schema version 1 with zero reviewed entries. No exact legacy-to-Recommended content link had sufficient reviewed evidence, so no linkage was fabricated.
- The selected Recommended index therefore contains no `legacyReferences`. Every original remains independently available from `data/teams.json`; all 40 admitted Team khác rows carry their exact `legacyContent` and canonical `legacyContentSha256`.

### Corpus and lineage proof

- `data/teams.json` SHA-256 remains `b937a6ee1d71fc4176eda0efb1e4e8a5c9bcf4ca4775d53a5a21b84b33f973ac`; ledger and manifest `legacyTeamsHash` match it.
- Ledger counts remain 40 distinct, 19 duplicate, 107 pendingIdentity, 0 pendingSource across 166 originals.
- `git diff -- pipeline/recommended-other-teams.json` changes only `mappingFileSha256`; decisions, admissions, counts, `recommendedCorpusHash`, and `localTeamsSha256` are unchanged.
- Manifest `contentLinksHash` matches the exact empty reviewed-link input bytes. The pointer manifest hash is `5c7ed3ac248eb8cc7c723907a9150b8acda88dfd348c0a4e84e0b9412cddbd49`.
- All 1,366 selected rows have `displayNotes`; 1,967 blocks have unique `(sourceConfigId, occurrence id, owner)` tuples. The synthetic regression keeps five equal-text paragraph occurrences across team, three primary holders, and one alternative holder without text deduplication.
- Common publication validation binds exact teams bytes, ledger bytes, inventory, identity-map hash, dedup version 1, decision counts, raw Recommended corpus, scope metadata/order, and index/detail raw/display lineage for cache, CLI `--input`, and direct callers.

### Independent gates

- Tester: final focused suite 41/41; selected publication inventory and hashes valid; Recommended artifact Node probe 2/2.
- Code reviewer: 8.8/10, zero critical findings, technical GO. Initial raw-fingerprint/direct-publication/displayNotes bypasses and later scope/tier/version gaps were repaired and re-reviewed.
- Deferred by accepted plan to Phase 4: update `docs/season-team-data.md` builder command with `--teams` and `--content-links`, and refresh the historical source-coverage report pointer.

## Phase 2 — Static detail pages

Status: complete for R1–R7. BFCache-specific runtime restoration cannot be observed under the CDP-attached Chromium test environment; the persisted `pageshow` path remains implemented, while ordinary Back/Forward is verified.

### Red / Green record

- R1–R7 browser and Node contracts were authored before their source slices. The implementation owner did not execute them.
- First independent gate: focused Node 35/36 and Playwright 45/52. Failures exposed one encoded-path expectation mismatch, default-season test-fixture errors, stale locators retained across navigation, and a real scroll-test interaction problem caused by Playwright scrolling the clicked first card to the top.
- Corrected tests use encoded route strings, explicit source seasons, data captured before navigation, a DOM click that preserves the pre-click scroll position, and a navigation-aware popup wait.
- Initial review scored 6.5/10 and found three blocking contract gaps: malformed variants could become originals, captured disclosure state was ignored, and duplicate content deduplication discarded provenance.
- Repairs distinguish absent from present-invalid variants, restore disclosure state through its section owner before the zero-scroll branch, and group legacy content while rendering every reviewed locator/evidence record.
- Reviewer warnings also closed non-root chrome initialization, snapshot origin/range checks, and independent legacy generation/manifest pin verification. Source-shape-only shell tests were removed rather than re-pinned.

### Route and runtime proof

- Selected generation only: 1,366 Recommended routes, 166 raw-original routes, 40 exact admitted variant pairs, and one static `404.html`.
- Build output: 1,534 pages. Dist verifier: 1,673 files including 45 raw assets.
- Every original page pins the exact `data/teams.json` SHA-256 plus the selected generation and manifest; each publication pin is independently mutation-tested.
- Recommended pages load only their pinned manifest and one scope payload. Original-only pages verify `/data/teams.json` without requesting Recommended data. Variants require the exact reviewed `(legacyTeamId, legacyVariantId)` pair.
- Invalid, empty, unknown, mismatched, or malformed variant selectors show an announced error, hide content, and offer an explicit original link.
- Title and CTA use the same native root-absolute href. Modified clicks remain native. Old inline URLs use identity-backed `location.replace`; any `config` key retains gameplay precedence.
- Safe return URLs accept only normalized same-origin root state with supported query keys and section hashes. History snapshots preserve URL-owned state, active disclosure, and scroll without overwriting unrelated `history.state`.
- Renderer evidence covers complete original notes/counters/alternatives, one-to-one team/primary/alternative note ownership, inert hostile text, and one content body with all duplicate provenance entries.
- Detail and 404 pages initialize shared theme/mobile chrome without booting `app.js` or gameplay datasets. Unknown and nested routes serve the real static 404.

### Independent gates

- Certified tester: Astro check 18 files with zero diagnostics; Node 32/32; contracts 4/4; dist 14/14; focused Playwright 53/53; build and verifier passed.
- Code reviewer: 8.7/10, zero blockers, GO. Remaining non-blocking limitation: CDP Chromium does not restore pages through BFCache, so that browser-specific persisted event cannot be runtime-certified here.

## Phase 3 — Compact browser

Status: complete for B1–B6.

### Red / Green record

- Fresh scout mapped the Phase 2 URL/detail contracts, current filter/card conventions, query ownership, and responsive grid before source changes.
- Red coverage replaced the reference Tier facet with exact repeated `score`, added explicit domain-search cases, asserted the mobile filter hierarchy, complete compact cards, native links, score disclosure, and 4/3/2/1 responsive behavior.
- Initial Green passed Node 16/16 and most browser flows. Independent review then found three contract gaps: localized faction/unit labels were absent from search, new disclosures were not captured for fresh detail return, and faction chips omitted the existing color classes.
- Repairs add registry-localized search terms without searchable hashes/URLs, bounded identity-based disclosure snapshots, facet-only score expansion that preserves open cards, and the shared `FACTION_CODE` classes. Empty and malformed score selectors fail closed with a notice. Selected values absent from a new scope remain visible with count 0.

### Runtime and visual proof

- Certified tester: Astro check 18 files with zero diagnostics; production build 1,534 pages; focused Node 16/16; Recommended browser 34/34; detail pages 17/17.
- A final history-state sanitization repair was rechecked independently with navigation Node 7/7 and the fresh-root return browser scenario 1/1.
- Retrievable captures under `reports/screenshots/`: `desktop-light-closed.png`, `desktop-dark-open.png`, `mobile-light-og.png`, `mobile-dark-many-score.png`, `long-title-mobile.png`, `missing-score-mobile.png`, `detail-after-filter-scroll.png`, and `returned-filter-scroll.png`.
- The matrix covers 1440 light/dark, 375 light/dark, closed/open outer filters, OG `og-兵演春秋`, the 36-score `pk-s24` scope, a 50-character title, a missing-score Team khác card, and a real filtered detail/return path. Every root capture reported zero horizontal overflow; the long and missing-score cards also reported zero card overflow.
- Detail return preserved the exact URL `?season=pk-s24&faction=吳#team-chuan`, scroll position 615, and expanded filter state. The bottom-center overlay visible in development captures is Astro's dev toolbar, not shipped product UI.
- Expected baseline differences from tqccl.com are intentional: reference cards now show source score, localized unit/faction, complete holders and a bounded alternatives disclosure; Tier/group headings and per-card scope captions are removed. Shared shell, palette, spacing, native controls, and other tabs remain unchanged.
- Long content is allowed to change card height rather than being clipped. Missing source slots remain explicitly labeled. Raw Chinese role rows are hidden; the first holder alone carries the compact `C` marker with accessible label `Chủ tướng`.

### Independent gates

- Code reviewer re-review: 8.8/10, zero critical or blocking findings, GO. P3-R1/R2/R3 resolved.
- Remaining non-blocking caveats: BFCache persisted-event certification remains unavailable in this environment; exhaustive hostile narrow-card fixtures are not claimed beyond the exercised 320/375 responsive cases.

## Phase 4 — Integrated verification and handoff

Status: complete for V1–V3 and AC01–AC13.

### Characterization and regression repair

- Fresh Phase 4 scout mapped the changed publication, route, filter, renderer, history, static-output, test, config, and documentation owners. V2/V3 were already covered by behavior-bearing scenarios; no source defect was invented to manufacture a Red.
- Added one combined V1 characterization: choose an exact score outside the first eight plus unit and faction, search by reviewed Vietnamese title, scroll, open the native title link, verify/reload detail, return with exact URL-owned state and scroll, then Back/Forward. It was Green immediately (1/1), confirming integration of already-tested constituents.
- The first full Astro E2E gate found three obsolete assertions in `season-lookup.spec.mjs`: removed historical-Tier presentation and count-free faction-chip wording. Independent debugger traced all three to intentional AC05/AC06 changes, found no source regression, and prescribed behavior-bearing selectors/assertions.
- Replacements prove retired Tier selectors are inert even when the old tier artifact is unavailable, Team khác faction filtering preserves scoped counts and restores membership after clear, and keyboard activation retains focus/pressed/URL state. Targeted repairs passed 3/3; the owning localized-facet regression passed 1/1; full Astro E2E then passed 107/107.

### Final commands

- `node --version` — `v24.20.0`, within the package contract.
- `python3 -m unittest discover -s tests` — exit 0; 221 run, 209 passed, 12 skipped.
- `npm run check` — exit 0; 18 files, 0 errors/warnings/hints.
- `npm run build` — exit 0; 1,534 static pages.
- `npm run test:node` — exit 0; 212/212 passed.
- `npm run verify` — exit 0; 1,673 dist files verified, including 45 raw assets.
- `npm run test:e2e:astro` — initial 104/107 exposed the three obsolete contracts above; after their test-only repair, exit 0 with 107/107 passed.
- Only recurring warning: Node reports `NO_COLOR` is ignored because `FORCE_COLOR` is set. It does not affect behavior or exit status.

### Acceptance evidence

- **AC01 PASS — Tab/data:** publication admission validation plus Recommended outage/tab-isolation and full E2E regression coverage.
- **AC02 PASS — Desktop:** responsive contract proves 1440/1100/800 as 4/3/2 columns; desktop light/dark captures are readable.
- **AC03 PASS — Mobile/filter:** 320/375 one-column tests; 375 light/dark captures show persistent search/season and operable collapsed filters.
- **AC04 PASS — Season/states:** native season select, no season-search input, and distinct empty/uncollected/no-match scenarios.
- **AC05 PASS — Point chips:** exact/repeated score, unknown versus 0, scoped counts/colors, OR/AND behavior, and 36-value disclosure.
- **AC06 PASS — Score/labels:** source score remains top-right; missing score is neutral; reference cards contain no Tier/team-star/group/scope caption.
- **AC07 PASS — Complete cards:** long-title and missing-score captures plus browser assertions cover units/factions, three holders, tactics/books, alternatives, counters, badges, and no overflow.
- **AC08 PASS — Vietnamese/bond:** 661 reviewed team-title translations published with raw IDs preserved; approved badge/bond identities remain distinct; unresolved `戮力上心` stays raw.
- **AC09 PASS — Detail URL/links:** static Recommended/original routes; identical native title/CTA hrefs; direct/reload/share/new-tab and static 404 scenarios.
- **AC10 PASS — History:** combined V1 and dedicated history suites preserve tab/season/category/q/chips/scroll through return and Back/Forward; gameplay `config` precedence remains.
- **AC11 PASS — Legacy content:** all original notes, conditions, holder notes/stats, tactics/books/config alternatives, counters and reviewed provenance render without equal-text note loss.
- **AC12 PASS — Preservation/dedup:** all 166 originals have routes; only 40 admitted pairs enter Team khác; 19 duplicate and 107 pending identities remain excluded; source/mapping semantics and raw teams hash remain unchanged.
- **AC13 PASS — Actual verification:** valid phase Red/Green records, full repository gates, static dev/preview routes, outage/failure scenarios, and the eight durable screenshots above.

### Final review and limitations

- Whole-change reviewer: 8.8/10, zero critical/blocking findings, GO; all AC01–AC13 passed and changed public-contract behavior is intentional/documented.
- BFCache persisted-event execution remains unobservable in this Chromium environment. Ordinary browser history, fresh-load restoration, denied storage, and exact filtered detail return are verified; BFCache is not claimed.
- Production hosting behavior was not exercised because deployment is not authorized. Static output, `_headers`, generated `404.html`, detail routes, and built preview behavior are verified locally.
