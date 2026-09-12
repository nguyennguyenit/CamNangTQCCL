---
phase: 2
title: "Browser and details"
status: completed
priority: P1
effort: "3d"
dependencies: [1]
---

# Phase 2: Browser And Details

## Overview

Deliver `Team chuẩn` and `Team khác`, existing filter styling plus searchable season selection, visible holder/tactic/book cards and full inline details. Source browsing remains independent of gameplay eligibility. This is a pending `--deep --tdd` execution contract, not an implementation or passing baseline.

Context: [locked brainstorm](../reports/brainstorm-260912-team-chuan-team-khac.md), [browser evidence](reports/browser-research.md), [UI audit](reports/audit-deep-ui.md), [Phase 1](phase-01-start.md). Code root **W** = `/Users/plateau/Project/worktrees/CamNangTQCCL-season-team-lookup`; all `W/` references expand to that absolute prefix. Reports **R** = `/Users/plateau/Project/CamNangTQCCL/plans/260912-0950-recommended-season-browser/reports`. macOS/zsh; Node 24.20.0, recheck before execution. Read `W/docs/design-guidelines.md` and `W/docs/code-standards.md` before changes.

## Requirements

- Visible team tabs: exactly `Team chuẩn`, `Team khác`; canonical hashes `#team-chuan`, `#team-khac`; no/unknown hash defaults Team chuẩn. Preserve `#team-pk`/`#meta-cu` as Team khác source-filter aliases and preserve original data/IDs/details.
- Keep search covering heroes/tactics/books and appropriate existing faction/unit/tier/source filters. Add grouped searchable season and source category/subcategory; no duplicate equivalent controls. No ruleset, score/point filter or sorting control in either browse tab.
- Team chuẩn groups by explicit source tier order, score descending within tier, source list index, then sourceConfigId. Preserve FUNC/unknown raw tiers and scores above 100; never infer tier from score. Team khác may retain honestly labeled historical local tiers; never assign SGSDeck scores/certification by similarity.
- Cards show exactly three holders, tactics/books and honest missing slots. Detail shows raw/reviewed display names, author, intro/notes, stat focus, traits, URL and unknown raw fields. Safe DOM/text only; holder assignments match the selected exact configuration.
- Team khác note: `Các đội có sẵn, đã đối chiếu với Team chuẩn.` Initial nonduplicates need no fresh battle report. Missing source: `Nguồn chưa xác định`. Duplicate/pending records stay out of lists; original details stay reachable without admission internals.
- Current Khaihoang stays latest-maintained; Recommended Khaihoang is source reference only. Gameplay consumers keep reviewed scenario/ruleset/config models; no Recommended row enters roster/analyze/MCP eligibility.

## Architecture and dependency map

`Phase 1 validated generation + identity-map hash → declared routes/root HTML pin → byte validation → per-surface state → shared-style cards/detail → Phase 3 real-data/release evidence`.

Phase 1 owns Python HTTP raw-rendered-HTML acquisition, offline parsing, task-owned reviewed `pipeline/recommended-identity-map.json`, dedup and the atomic generation transaction. Phase 2 consumes output; no crawling, translation or dependency on whole unified-lookup completion. Existing gameplay dictionaries/sidecars remain a separate graph.

### Publication and loader contract

- `W/src/data/recommended-reference/current.json` selects one immutable `<generationId>/` containing `manifest.json`, `seasons.json`, `index.json`, `details-<safeScopeKey>.json`, `other-teams.json`. The selector fields are `schemaVersion,generationId,manifestSha256`; Phase 1 owns exact schema/hashes and safeScopeKey derivation. Generation binds accepted scopes, mapping hash, dedup version and all output hashes. Raw source IDs remain metadata, never path segments.
- Routes: `/data/recommended/current.json` and `/data/recommended/<generationId>/<safe-file>.json`. ASCII extensionless file keys must be manifest-enumerated; reject unknown generation/key, traversal, slashes, symlinks, missing/nonregular files, hash mismatch and unexpected files. Publish selected generation only; preserve older local generations for rollback, not recursive public exposure.
- `recommendedPublicationSnapshot()` reads current once, validates its generation and returns exact current bytes/object, manifest hash and declared source/output byte mappings. Root HTML embeds this under `#recommended-publication`; route enumeration and dist verifier use the same helper/policy. Fail the build if current changes across reads; emitted current, HTML pin, manifest and output bytes must agree.
- Browser `loadRecommendedReference(pin,loadBytes)` validates manifest bytes against HTML pin, then seasons/index/other-teams against manifest before admitting rows. Fetch detail lazily by declared generation/scope key and hash. Never independently refetch mutable current to advance a running page. Stale HTML whose generation is unavailable shows reload/unavailable, never mixed generations or unfiltered legacy fallback as Team khác.
- Missing/invalid Recommended data disables only these lists with notice; gameplay/Khaihoang/catalog boot continues. Invalid gameplay season bundle must not suppress valid Recommended rows. Detail requests carry token + generation + active detail identity; close/tab/scope changes invalidate late responses.
- Register new JS basenames in `PUBLIC_ARTIFACTS`; preserve strict root inventory and season hash inputs. `scripts/verify-astro-dist.mjs` combines root inventory with declared scoped mappings and compares exact bytes. Existing `/data/*` cache policy covers nested URLs; extend header tests, not policy. Gameplay workflow hash changes only if an actual semantic input changes.
- `validateReferenceSourceUrl` in the reference state module validates before any new renderer creates an anchor. Recommended requires credential-free `https://sgsdeck.com/recommended` or its declared detail path, canonical sourceConfigId/scope query parity, no fragment or encoded traversal/separators; wrong authorities are never labeled SGSDeck links. Existing/external Team khác supports credential-free HTTP(S) attribution links with their actual source label/host; do not require SGSDeck authority or invent a provider-registration gate. Reject executable schemes/control characters and malformed URLs. Invalid URLs remain non-clickable text with notice. External new-tab anchors use `noopener noreferrer`; source descriptions remain typed text, not HTML. C2/C4 cover wrong HTTPS host for Recommended, HTTP Recommended, credentials, encoded path attacks, valid Recommended and legitimate non-SGSDeck legacy attribution.

### Interfaces and caller checklist

| Interface / owner | Input → output | Callers / invariant |
|---|---|---|
| `recommendedPublicationSnapshot`, `recommendedStaticPaths`, `readRecommendedArtifact` / `W/src/lib/recommended-reference-artifacts.ts` | validated selected generation → pin, paths, exact bytes/MIME | root HTML, both routes, dist verifier, route/header tests; single publication policy |
| `loadRecommendedReference`, `loadRecommendedDetail` / `W/js/recommended-reference-state.js` | HTML pin + byte loader → read-only validated rows/detail | app; no gameplay validation call or partial admission |
| `readRecommendedQuery`, `transitionReferenceState`, `projectRecommendedRows` / same module | URL + family + generation → filters, notices, fixed groups/counts | app navigation/factory; pure, no DOM/localStorage |
| `validateReferenceSourceUrl` / same module | family + declared identity + raw URL → allowed canonical URL or reason | all new card/detail source anchors; preserve distinct attribution policies |
| `createRecommendedSection` / `W/js/team-filter-section.js` | mount/family + onQuery/onOpen → update/focus/setSearch | app creates both tabs; reuse filter markup/collapse; no gameplay classification |
| `recommendedTeamCard`, `recommendedTeamDetail`, `legacyOriginalDetail` / `W/js/recommended-reference-render.js` | exact content + callbacks → safe DOM | factory/app; no invented tier/season/source/translation |
| `resolveTeamDestination` / reference state; app executes it | original identity + admission lookup → tagged destination | `onOpenTeam` from `analyze.js:114-134`, `roster-recommend-ui.js:83-95,119`; hash parser; no first-hero identity search |
| Existing `seasonConfigDetail`, `loadSeasonModel`, consumer `setSeasonScope` | reviewed config/model only | independent original/gameplay detail, roster/analyze/coexist; preserve exact score and inventory semantics |

Check every caller row in R. Migrate `W/js/app.js:213-224` callback routing, `:145-157` detail lookup and `:75-79,196-207` controls/detail visibility together.

### Exact detail destinations

- Admitted local variant: `{kind:'other',legacyTeamId,legacyVariantId}` opens exact Team khác variant. A generic old team with multiple explicit variants opens original alternatives; never choose arbitrarily. Serialize local identity as `legacyTeam` plus optional `legacyVariant`.
- Duplicate/pending/original: `{kind:'legacy',legacyTeamId}` resolves the preserved original team including its original alternatives, independently of admission; no private variant ledger is fetched. `legacyVariant` selects only a matching admitted explicit variant; unavailable variant IDs show a notice and original team, never an invented variant. Original labels/source only, no dedup ledger. Excluded variants never re-enter the list.
- Gameplay: `{kind:'gameplay',configId,scenarioId,rulesetId}` resolves exact ID from validated model, not browse projection. Consumer click keeps analyze/roster tab and opens shared original-detail mount. Historical `?config=...#team-pk` still opens original gameplay detail alongside aliased Team khác. That separate original detail retains verified selection-score/inventory semantics; browse cards inherit none and browse ruleset controls stay hidden.
- Recommended: `{kind:'recommended',sourceConfigId,scopeKey}` opens declared same-generation detail; URL `detail` identifies its index row. Unknown/wrong-scope IDs show notice, never similar-team substitution.
- Close clears only active detail keys, preserves filters and focuses connected trigger or heading. Enter/Space opens; Escape/close exits; Back/Forward restores identity/focus. Card activation must not swallow tactic/book search-button activation.

### URL transitions

Active browse scalars: `season,category,q,detail,legacyTeam,legacyVariant`; repeated facets `faction,unit,tier,subcategory,source` use OR within key, AND across keys. Reject repeated/empty scalar IDs, malformed detail and unknown facets with notice; deduplicate facet repetitions. Unsupported `sort`/point/score params are ignored with notice. Gameplay owns `scenario,ruleset,config`; only original-detail resolver interprets config.

Inactive per-surface filter snapshots live in `history.state`, not localStorage. URL owns active view and remains reload/shareable; Back/Forward uses matching entry. Retain scenario/ruleset in URL across reference navigation. Build gameplay parser input from its active/saved q/facets; do not pass reference facets to `readSeasonQuery` or clear saved gameplay scope.

| Transition | Query/detail rule | Result |
|---|---|---|
| Direct canonical / reload | parse active family only; explicit config beats browse detail with notice | one deterministic detail, no inactive concurrent view |
| Old team-pk / meta-cu hash | seed team-intro / moi-phe source; replace conflicting source with notice; replaceState canonical hash | admitted source-filter view; original/config IDs survive |
| Canonical Team khác nav after alias | restore canonical snapshot/default all, remove alias-only source restriction | alias cannot permanently narrow canonical list |
| Team chuẩn ↔ Team khác | save outgoing snapshot, restore incoming/default; remove outgoing detail keys | no source/faction/detail leakage |
| Browse ↔ coexist/analyze/roster | save/restore their q/facets; retain scenario/ruleset; hide inactive detail | no coexist source-ID collision; gameplay validation remains |
| Season/category change | pushState; preserve q/requested facets, validate new scope with notice; clear browse detail | coherent facets from unfiltered scope |
| Search/facet/clear | replaceState; clear q/facets/sort/stars, keep season/category | stable input/focus and source scope |
| Open/close; Back/Forward | push open, replace close; ignore stale request identities | exact detail, filters/focus retained |

### Team khác season/category contract

Consume `legacyTeamId`, `legacyVariantId` (not gameplay configId), `sourceSeasonIds: string[] | null`, `seasonAttribution: [{sourceSeasonId,evidenceRef}]`, `sourceState/sourceLabel`, `dedupKeyVersion`. Null means unknown; empty array is invalid. Only explicit reviewed source-season evidence permits membership. Never map a VN scenario or similar build into TW season. Attribution refs must be public-safe, not private ledger paths.

Team khác defaults to `season=all`; picker has all, unknown, and known seasons from common source registry. All includes every admitted variant once; unknown includes null only; known includes exact sourceSeasonIds members. Multi-season variant counts once per view. Filters never rerun dedup or admit excluded variants. Team chuẩn displays all 29 source options and uses explicit registry default, not a hardcoded season.

Keep local faction/unit/historical tier/source fields. Category/subcategory require explicit attribution; never infer PK from legacy source name. Team khác category defaults all, retaining unknown-category rows; missing metadata is an honest unknown state. Counts/facets derive from unfiltered season/category scope. Distinguish uncollected season, empty category, unknown-attribution scope, unavailable publication and no filter match.

## Related Code Files

2026-09-12 line/test counts are source inventory, not execution results. New sizes are estimates. No deletion or broad restyle; existing paths have full W prefix defined above.

| Action | Exact files | Size / test impact |
|---|---|---|
| Modify | `W/js/app.js`; `W/js/team-filter-section.js` | 231/253 lines; boot/nav/destinations; shared-style factory |
| Modify | `W/src/pages/index.astro`; `W/src/lib/public-artifact-manifest.mjs` | 72/95; canonical shell + pin; JS registration |
| Modify | `W/scripts/verify-astro-dist.mjs`; `W/css/styles.css` | 104/819; scoped inventory/bytes; narrow UI additions |
| Create | `W/js/recommended-reference-state.js`; `W/js/recommended-reference-render.js` | ~220/~180; state/load/destinations; safe source/original DOM |
| Create | `W/src/lib/recommended-reference-artifacts.ts` | ~160; scoped snapshot/read/hash/path policy |
| Create | `W/src/pages/data/recommended/current.json.ts`; `W/src/pages/data/recommended/[generationId]/[file].json.ts` | ~15 each; prerendered exact-byte endpoints |
| Create | `W/tests-js/recommended-reference-state.test.mjs`; `W/tests-js/recommended-reference-artifacts.test.mjs` | state and publication matrices below |
| Create | `W/tests-js/fixtures/recommended-reference-fixtures.mjs`; `W/tests-e2e/recommended-browser.spec.mjs` | builder from Phase 1 fixtures; browser integration |
| Modify | `W/tests-js/frontend-shell-contract-assertions.mjs`; `W/tests-js/frontend-shell-contract.test.mjs` | 46/56; helper and 4 tests |
| Modify | `W/tests-js/runtime-asset-contract.test.mjs`; `W/tests-js/astro-dist-contract.test.mjs`; `W/tests-js/pages-headers-contract.test.mjs` | 125/347/100; 6/10/3 tests |
| Modify | `W/tests-e2e/season-lookup.spec.mjs` | 319; 23 declarations expand to 28 cases |
| Modify | `W/tests-e2e/season-playwright.config.mjs` | Replace legacy unmanaged 4321 override with a re-export of root `playwright.config.mjs`; one managed 4174 runner policy |
| Preserve/read | `W/js/render.js`; `W/js/season-ui-state.js`; `W/src/lib/root-static-artifacts.ts`; `W/tests-js/season-ui-state.test.mjs` | 493/95/128/49; 6 state tests; gameplay behavior unchanged |
| Trace/read | `W/js/analyze.js`; `W/js/roster-recommend-ui.js`; `W/js/mobile-section-menu.js`; `W/src/pages/data/[file].json.ts`; `W/src/pages/js/[file].js.ts` | callback signatures and existing root routes remain compatible |

## Test scenario matrix

Fixture builder consumes Phase 1 captured fixtures/projection outputs. `small-generation`: captured picker + two scopes, mixed faction, T2 82/72, FUNC, score >100, three holders/full raw detail. `other-generation`: known/null/multi-season admitted variants, duplicate and ambiguous originals, multiple explicit variants. Corruptions/HTTP failures are test-only injections, never product records. Admission fixture outputs must come from Phase 1 decisions.

| Priority / scenario | Fixture → assertion | Test file family / command |
|---|---|---|
| Critical: publication | two valid generations + swapped bytes/current, rogue/symlink/path → reject mixed/extra output; same pin drives HTML/current/all files | artifacts + dist / C1,C3 |
| Critical: independent failures | Recommended 503/hash failure, gameplay bundle 503 → other subsystem available; no raw legacy admission fallback | recommended browser / C4 |
| Critical: consumer identity | admitted/duplicate/original variants/reviewed config → exact old-link and onOpenTeam detail, excluded list empty | state + recommended + season browser / C2,C4 |
| High: transitions | mixed q/source/faction/detail/config and aliases → table semantics, notices, reload/back/forward, no browse ruleset UI | state + recommended browser / C2,C4 |
| High: source scope | 29-option picker, empty S21/S28 siege, mixed faction → search/group/counts/empty states and full facets | state + recommended browser / C2,C4 |
| High: ordering | T2 82/72,T0.5,FUNC,equal score → tier-owned stable ranking, no sort/point UI | state + recommended browser / C2,C4 |
| High: local attribution | known/null/multi-season, unknown category, duplicate elsewhere → all/unknown/known rules, no inferred season | state + recommended browser / C2,C4 |
| High: card/detail | author/援助/stats/missing slots/markup sentinel → 3 holders with tactics/books, safe raw text, no ledger | recommended browser / C4 |
| High: async detail | delay A, open B/close/change scope → A cannot overwrite/reopen; exact URL/focus | recommended browser / C4 |
| Medium: visual/keyboard | 320/375/768/1280 × light/dark, picker open/closed, long labels → no overflow, 44px targets, focus/ARIA, reduced motion, original style | recommended + season browser / C4 |
| High: gameplay | existing season fixture → exact selection-score, inventory reset, coexist/latest Khaihoang and failure guards | season state + migrated season browser / C2,C4 |

### Existing test migration

- Legacy `season-playwright.config.mjs` re-exports the root config; record effective config path, baseURL and webServer ownership in E2E evidence. No release evidence may use an unmanaged 4321 override.
- Keep all 6 season-state tests. Keep 5 runtime tests; migrate only `runtime-asset-contract.test.mjs:103-124` from literal old array/fallback to canonical sections and tested aliases. Keep 4 shell-test intents; migrate names/default/mounts in shell assertion helper `:3-13,31-39` and fixtures, retaining menu/theme hooks.
- Keep all 10 dist invariants; add scoped mappings/bytes, never allow arbitrary output. Keep all 3 header tests (declarations at :55/:63/:79; RegExp.test at :16 is not a test case); enumerate new declared paths at `pages-headers-contract.test.mjs:69` under unchanged policy.
- Season E2E `:21-36`: move gameplay selector setup to coexist, keep latest Khaihoang assertions. `:55-85,150-176,225-258,280-286,301-309`: use independent original/gameplay detail and consumer entry instead of reviewed cards in Team khác; retain score, raw fields, selection, inventory and focus checks.
- `:121-130`: move invalid gameplay state assertions to gameplay consumer. `:196-210`: use admitted historical-tier fixture plus separate gameplay-tier assertions. `:273-279,310-319`: canonical selectors with derived-faction/model-immutability and pressed-focus checks retained.
- Preserve roster/analyze/coexist intent at `:86-119,131-149,179-194,211-223,259-272,287-300`, changing destination expectations only where required. Record old intent → new test mapping/counts in R; deleting obsolete literal navigation assertions is not a behavioral pass.

## Implementation Steps

### Tests Before

1. Record W branch/status/runtime and source counts, preserving WIP. Run existing portions of C2/C3 and existing season E2E before migration; record real baseline separately from Reds. Before CSS/test edits, capture current filter/card/nav screenshots and computed tokens at 375/1280 in both themes through the repository-managed Playwright runner on port 4174, using the existing season suite before migration. If that runner is blocked, record the block and collect baseline before UI edits; do not claim it exists now.
2. Baseline targets `css/styles.css:2-46,202-236,432-442,580-603,790-819`: typography/spacing/panel/border/radius/faction/chip/collapse/card lines/menu/sticky header. Capture unchanged Khaihoang/coexist/catalog too. Expected content differences do not excuse unrelated style drift.
3. Write artifact/state Reds before loader/routes and browser destination/alias/control/card Reds before app/factory edits. Record assertion failures demonstrating missing behavior; import/syntax/setup failures alone do not prove behavioral Red. Keep already-passing invariants as regression checks.

### Refactor

4. Implement publication snapshot, helper, routes and dist verifier integration first; register JS files. Get C1 green while keeping root/private/header invariants. Verify every build consumer sees identical current/pin/manifest.
5. Implement pure state/projection/destination functions and byte loaders; get targeted C2 green. Preserve legacy source attribution and separate gameplay model; no transliteration prototype reuse.
6. Update boot/nav, independent original-detail resolver and all callback/visibility/history callers together. Preserve original teams/sidecars; Recommended failure cannot abort other main consumers. Get consumer/alias Reds green.
7. Build shared-style reference factory, picker/empty states, fixed groups, exact cards/details, keyboard/async guards and narrow CSS. Reuse mobile menu/filter behavior; migrate only obsolete assertions under the explicit inventory.

### Tests After

8. Complete C4 matrix and all 8 viewport/theme combinations, keyboard path and stale generation/detail cases. Inspect actual before/after screenshots and computed tokens; screenshot existence alone is insufficient. Run real captured scope through Astro routes alongside fault-injected fixtures; report real counts separately.
9. Refactor incidental duplication only after green; rerun affected tests after changes. Record Red→Green, command/results, migrated intents, caller checklist and screenshot references in R. New test counts are measured outputs, never invented targets.

### Regression Gate

Run from W. C1/C2 narrow first, C3 after outputs exist, C4 after build. These commands are planned, not executed evidence.

```sh
# C1: scoped artifact contracts
node --experimental-strip-types --test tests-js/recommended-reference-artifacts.test.mjs
# C2: new state plus protected gameplay/shell
node --test tests-js/recommended-reference-state.test.mjs tests-js/season-ui-state.test.mjs tests-js/frontend-shell-contract.test.mjs tests-js/runtime-asset-contract.test.mjs
# C3: compile and exact output/header policy
npm run check
npm run build
npm run verify
npm run test:dist
# C4: repository Playwright config owns build/preview on port 4174
npm run test:e2e -- tests-e2e/recommended-browser.spec.mjs tests-e2e/season-lookup.spec.mjs
```

C4 uses `W/playwright.config.mjs` only: it builds and manages preview on port 4174 with `reuseExistingServer:false`. Before execution inspect `lsof -nP -iTCP:4174 -sTCP:LISTEN`; confirm any owner/cwd. Stop only a stale process owned by this task; otherwise report the port conflict without killing another session or incrementing ports. Record runner command/PID/port/W and verify its server terminates after checks. Do not use the unrelated port-4321 server or add a second runner path. Planning starts no server. Phase 3 owns broader release gates and evergreen docs corrections.

## Success Criteria

- [x] HTML/current/manifest/output bytes identify one valid generation; unknown output fails and source failures remain isolated.
- [x] Canonical tabs/aliases, every consumer destination and local all/unknown/known season scopes follow the tables; excluded variants never appear as Team khác.
- [x] Appropriate existing filters/style survive; searchable seasons/fixed tiers/exact cards/full details work without browse ruleset/score controls.
- [x] Behavioral Reds became green; gameplay/header/private-artifact invariants retain explicit coverage and migration evidence.
- [x] Mobile/keyboard/light/dark/stale-response cases pass; gameplay/Khaihoang/coexist/catalog remain available.

## Risk Assessment and Rollback

| Signal | Predetermined response |
|---|---|
| Generation mismatch or missing detail | scoped unavailable/reload; reject mixed data and repair publication transaction |
| Consumer resolves only through admitted/filtered rows | restore independent identity resolver; prove duplicate/config fixture before continuing |
| Local attribution missing | retain all/unknown visibility; never infer season |
| New scoped file rejected by verifier | fix declared mapping/reader integration; preserve exact allowlists |
| Unrelated style/focus/menu drift | restore affected existing tokens/behavior and rerun changed visual cases |

Rollback scoped nav/app/artifact changes and disable reference views or select a previous validated generation through Phase 1 transaction. Preserve legacy corpus/IDs, intake evidence, older generations, Khaihoang, sidecars, Worker contracts and unrelated WIP. No source cleanup/commit/push/deploy follows from this phase. Unresolved product questions: none. Runtime baseline, corpus counts and behavioral results remain execution evidence to collect.
