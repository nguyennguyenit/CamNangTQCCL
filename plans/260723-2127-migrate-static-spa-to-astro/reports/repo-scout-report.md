---
title: "Repository scout: static SPA to Astro"
date: 2026-07-23
status: complete
scope: "Read-only repository inventory and phased migration proposal"
---

# Repository Scout Report

## Summary

The safest Astro migration is a **shell/build migration, not a frontend rewrite**. Keep `js/`, `data/`, and `css/` at the repository root as canonical sources; let Astro produce `dist/index.html` and copy those three root trees unchanged into `dist/`. This preserves:

- all current ES-module import paths (`./foo.js`);
- all Node tests importing `../js/*.js`;
- Python builders writing `data/*.json`;
- browser URLs `/js/*`, `/data/*`, and `/css/*`;
- Worker API/config and `localStorage` schemas.

Astro should initially own one page, `src/pages/index.astro`, with the current 10 mount points and the existing `/js/app.js` client entry. Splitting 68 lines of shell HTML into Astro components or rewriting DOM renderers into framework components would create two rendering systems without a demonstrated reuse boundary, contrary to YAGNI/KISS.

The current full gate is green: **82 Python + 83 frontend JS + 53 Worker tests = 218 tests**, plus Worker TypeScript typecheck. The largest migration gap is not pure logic; it is browser-level coverage of the shell, data loading, hash navigation, and DOM initialization.

## Current Deployment and Workspace State

### Deployment boundary

- The site is currently a static root publish of `index.html`, `css/`, `js/`, and `data/` (`README.md:62-68`, `docs/deployment-guide.md:68-88`).
- The Vision Worker is a separate package and deployment from `worker/`; its entry accepts only `POST /analyze` after origin/method, quota, Turnstile, and image guards (`worker/src/index.ts:26-85`).
- There is no root `package.json`, Astro config, Pages config file, or CI workflow. `.github/` is empty. Only `worker/package.json` exists, with Worker-local `dev`, `deploy`, `test`, and `typecheck` scripts (`worker/package.json:1-19`).
- Cloudflare Pages is configured externally; the durable record says Pages deploys from `main`, but no build command/output directory is committed (`docs/deployment.md:17-27`).
- Current rollback assumes the four root static artifacts, so it must be updated to treat `dist/` as the atomic Pages artifact (`docs/deployment-guide.md:172-184`).

### Dirty shared workspace

Do not reset, overwrite, or mechanically regenerate these user-owned changes:

- Modified frontend/data contract files: `data/tactics-generic.json`, `data/tactics.json`, `js/match-dict.js`, `tests-js/analyze-map.test.mjs`, `tests-js/match-dict.test.mjs`, `tests-js/tactics-data.test.mjs`.
- Modified pipeline/test files: `pipeline/build_dict.py`, `pipeline/do-uy-ss18-source.json`, `pipeline/tactic-name-overrides.json`, `tests/test_build_dict.py`.
- Modified docs that Phase 4 will also need: `README.md`, `docs/code-standards.md`, `docs/codebase-summary.md`, `docs/deployment-guide.md`, `docs/design-guidelines.md`, `docs/project-changelog.md`, `docs/project-overview-pdr.md`, `docs/project-roadmap.md`, `docs/system-architecture.md`.
- Untracked: `.agents/`, one journal, two unrelated plan directories, this Astro plan directory, and standalone reports.

`index.html`, `css/styles.css`, `js/app.js`, `.gitignore`, and `docs/deployment.md` are currently clean. Phase 4 documentation edits must re-read and merge the dirty files rather than replacing them from `HEAD`.

## Frontend Entrypoints and Runtime Contracts

### HTML and boot

- `index.html` is the only browser document. It owns metadata, global shell, 10 nav buttons, 10 matching section mounts, stylesheet URL, and module entry (`index.html:1-13`, `index.html:29-58`, `index.html:62-67`).
- `js/app.js` is the sole browser boot entry. It initializes theme/navigation, loads six required JSON artifacts concurrently, loads `team-tier.json` optionally, and then initializes every section (`js/app.js:35-71`, `js/app.js:73-117`).
- Required runtime data URLs are exactly:
  - `./data/teams.json`
  - `./data/coexist.json`
  - `./data/khaihoang.json`
  - `./data/tactics.json`
  - `./data/heroes-dict.json`
  - `./data/books-dict.json`
  - optional `./data/team-tier.json`
  (`js/app.js:78-87`).
- The hash contract is the 10 values in `SECTIONS`; unknown/empty hashes fall back to `team-pk`, and section switching depends on `.nav-tab[data-section]` plus `#section-${name}` (`js/app.js:47-71`).
- `createTeamFilterSection()` returns `{ setSearch(value) }`; `app.js` relies on that interface when an analyzed/recommended team opens its source tab (`js/team-filter-section.js:18-27`, `js/team-filter-section.js:146-166`, `js/app.js:89-111`).

### DOM-bound modules

These should remain client-side vanilla modules during the Astro migration:

| File | Boundary and contract |
|---|---|
| `js/app.js` | Global `document`, `window`, `location`, `matchMedia`, `localStorage`, `fetch`; calls all section initializers. |
| `js/render.js` | Shared DOM factory `el()` and all team/Cùng Tồn/khai-hoang renderers. `el()` creates nodes, assigns properties, and binds event handlers (`js/render.js:4-18`). |
| `js/team-filter-section.js` | Shared interactive filter renderer; consumes `mount`, `teams`, `tierIndex`, `groups`, returns `setSearch` (`js/team-filter-section.js:27-55`, `js/team-filter-section.js:124-166`). |
| `js/team-pk.js` | Filters source `team-intro`, derives missing faction, delegates to shared section (`js/team-pk.js:8-29`). |
| `js/do-uy.js` | Filters source `do-uy`, mutates runtime `tierBest`, sorts by best tier, delegates to shared section (`js/do-uy.js:12-37`). |
| `js/meta-cu.js` | Filters source `moi-phe`, delegates to shared section (`js/meta-cu.js:8-24`). |
| `js/mobile-section-menu.js` | Binds toggle/tab/Escape behavior and returns `{ nav, toggle, tabs, open, close, setActive }` (`js/mobile-section-menu.js:3-37`). |
| `js/hero-list.js`, `js/hero-detail.js` | List/filter/modal UI; pure seams are `filterHeroes()` and `resolveHeroTactics()` (`js/hero-list.js:23-34`, `js/hero-list.js:70-87`, `js/hero-detail.js:22-37`). |
| `js/tactics.js` | Card/search UI; pure seam `tacticDescriptions()` (`js/tactics.js:10-18`, `js/tactics.js:20-48`). |
| `js/analyze.js` | Canvas compression, lazy Turnstile script, Worker fetch, paste/drop/upload and result rendering (`js/analyze.js:14-69`, `js/analyze.js:140-257`). |
| `js/recruit-tracker.js` | Tracker DOM/event layer; pure seam `buildRecruitTrackerViewModel()`; initializer permits injected storage (`js/recruit-tracker.js:42-70`). |
| `js/roster-recommend-ui.js` | `localStorage`, image/Turnstile scan, review UI, local recommendation invocation (`js/roster-recommend-ui.js:1-27`, `js/roster-recommend-ui.js:117-262`). |

Astro must render the same IDs/classes before `/js/app.js` runs. Use an external public module script (for example, Astro `is:inline` on `<script type="module" src="/js/app.js">`) so Astro/Vite does not relocate or rewrite the root module graph.

### Pure or mostly pure modules

Keep these at their current root paths and retain direct Node-test imports:

| File | Characterization targets |
|---|---|
| `js/filters.js` | `normalizeText`, `teamSearchBlob`, `applyFilters`, `emptyState`; AND across filter groups, OR within a group (`js/filters.js:4-13`, `js/filters.js:39-87`). |
| `js/match-dict.js` | `levenshtein`, `ratio`, `matchDict`, `searchDict`; output contract `{record, score, confidence, matched}` (`js/match-dict.js:17-49`, `js/match-dict.js:94-135`). |
| `js/analyze-map.js` | `statFocusVn`, `mapRead`, `mapTeamRead`, `findSimilarTeams`; canonical mapping/similarity with no browser dependency. |
| `js/derive-team-faction.js` | `buildHeroFactionIndex`, `dominantFaction`, `assignDerivedFactions`; note the last function mutates team records in place. |
| `js/hanviet.js` | Transliteration/title-case helpers; no DOM. |
| `js/recruit-tracker-store.js` | State transitions and schema validation are pure; only `loadRecruitTrackerState`/`saveRecruitTrackerState` touch injected storage (`js/recruit-tracker-store.js:317-344`). Preserve `schemaVersion` and exported storage key. |
| `js/roster-scan-map.js` | Canonical hero/tactic/built-team mapping. |
| `js/roster-scan-state.js` | Stable key `tqccl.rosterRecommend.scanState.v1`; serializer strips image/token fields (`js/roster-scan-state.js:1-23`, `js/roster-scan-state.js:85-100`). |
| `js/team-recommend-engine.js` | Candidate normalization and `recommendTeams()` portfolio contract; tier join is `team.id` to `teamTier[].teamId` (`js/team-recommend-engine.js:28-69`, `js/team-recommend-engine.js:232-312`). |
| `js/config.js` | Public Worker URL, Turnstile key, compression settings; not a secret (`js/config.js:4-20`). |
| `js/render.js` | `bestTier` and `tierClass` are pure even though the rest of the module is DOM-bound (`js/render.js:37-48`). |

### Module dependency edges

```text
index.astro (future) -> /css/styles.css + /js/app.js
js/app.js
├── render.js
├── team-pk.js -> derive-team-faction.js + team-filter-section.js
├── do-uy.js -> render.js + team-filter-section.js
├── meta-cu.js -> team-filter-section.js
├── team-filter-section.js -> filters.js + render.js
├── hero-list.js -> match-dict.js + hero-detail.js + render.js
│   ├── match-dict.js -> filters.js
│   └── hero-detail.js -> render.js
├── tactics.js -> match-dict.js + render.js
├── recruit-tracker.js -> recruit-tracker-store.js + render.js
├── analyze.js -> config.js + analyze-map.js + render.js
│   └── analyze-map.js -> filters.js + match-dict.js + hanviet.js
├── roster-recommend-ui.js
│   ├── analyze.js + config.js + render.js
│   ├── roster-scan-map.js -> match-dict.js + hanviet.js
│   ├── roster-scan-state.js
│   └── team-recommend-engine.js -> filters.js
└── mobile-section-menu.js
```

Astro should sit **above** this graph. Importing these DOM modules into Astro frontmatter would execute browser assumptions during SSR/build and is therefore incorrect.

## Data Artifacts and Builders

### Runtime artifacts

Current JSON shapes/counts observed directly:

| Artifact | Shape/count | Runtime consumer |
|---|---:|---|
| `data/teams.json` | array 214; team keys include `id`, `source`, `heroes`, `unitType`, `stars`, `faction` | `js/app.js`, team tabs, analyze, recommender |
| `data/team-tier.json` | array 57; `{teamId, rankings}` | optional in `js/app.js`; recommender |
| `data/tactics.json` | array 239 | tactics UI, analyze, roster scan |
| `data/heroes-dict.json` | array 112 | heroes UI, faction derivation, analyze, roster scan |
| `data/books-dict.json` | array 66 | analyze mapping |
| `data/coexist.json` | array 5 groups | display only |
| `data/khaihoang.json` | object `{teams,mines}` | display only |
| `data/facets.json` | object of counted facets | build input; explicitly not loaded by frontend (`docs/system-architecture.md:39-55`) |
| `data/tactics-generic.json` | object `{_note,tactics}` | build input, not browser entry data |

Do not convert these to Astro content collections or build-time imports. Runtime fetch preserves the current failure/fallback behavior, avoids bundling large JSON into HTML/JS, and lets Python remain the artifact owner.

### Builder ownership and edges

- `pipeline/build_json.py` parses ignored HTML sources, normalizes teams, and writes `teams.json`, `facets.json`, `coexist.json`, and `khaihoang.json` (`pipeline/build_json.py:13-27`, `pipeline/build_json.py:100-118`).
- Its expected counts are stale at 50/12/110 and therefore it cannot reproduce the committed 56/48/110 snapshot (`pipeline/build_json.py:22-44`; warning in `docs/deployment-guide.md:56-66`). Astro work must not invoke this builder as part of `npm run build`.
- `pipeline/build_dict.py` reads crawl/cache + `facets.json`, applies curated overrides and generic tactics, then writes `tactics.json` and `heroes-dict.json` (`pipeline/build_dict.py:23-29`, `pipeline/build_dict.py:118-151`).
- `pipeline/build_books_dict.py` validates its curated Hán→Việt map against `facets.json.books`, then writes `books-dict.json` (`pipeline/build_books_dict.py:21-28`, `pipeline/build_books_dict.py:54-63`).
- `pipeline/build_team_tier.py` joins curated rankings by stable `team.id` and writes `team-tier.json` (`pipeline/build_team_tier.py:19-29`, `pipeline/build_team_tier.py:53-62`).
- `worker/src/hero-names.ts` is manually derived from `data/heroes-dict.json`; Astro does not own this edge.

Recommended artifact flow:

```text
pipeline/*.py -> canonical root data/*.json
canonical root js/*.js + css/*.css + data/*.json
        -> Astro/Vite static-copy step -> dist/{js,css,data}/
src/pages/index.astro -> dist/index.html
worker/ -> independent Wrangler deploy (unchanged)
```

## Existing Test Coverage

### Counts verified on 2026-07-23

- `python3 -m unittest discover -s tests`: **82/82 pass**.
- `node --test "tests-js/*.test.mjs"`: **83/83 pass**.
- `cd worker && npm test`: **53/53 pass** across 6 files.
- `cd worker && npm run typecheck`: pass.

### Frontend JS test inventory

| Test file | Count | Direct contract |
|---|---:|---|
| `tests-js/analyze-map.test.mjs` | 15 | map/read/similarity (`tests-js/analyze-map.test.mjs:4`, `:27-143`) |
| `derive-team-faction.test.mjs` | 5 | faction index/majority/mutation |
| `filters.test.mjs` | 10 | filter/search normalization |
| `hero-detail.test.mjs` | 3 | tactic resolution only |
| `hero-list.test.mjs` | 6 | `filterHeroes` only |
| `match-dict.test.mjs` | 9 | fuzzy matching |
| `mobile-section-menu.test.mjs` | 2 | fake-DOM menu behavior |
| `recruit-tracker-store.test.mjs` | 7 | state/storage adapters |
| `recruit-tracker-ui.test.mjs` | 1 | view-model only |
| `roster-scan-map.test.mjs` | 3 | scan canonicalization |
| `roster-scan-state.test.mjs` | 5 | state/storage privacy |
| `tactics-data.test.mjs` | 6 | generated data + descriptions |
| `team-recommend-engine.test.mjs` | 7 | portfolio engine |
| `team-tier-badge.test.mjs` | 4 | pure tier helpers |

No test imports `js/app.js`, `js/team-filter-section.js`, `js/team-pk.js`, `js/do-uy.js`, `js/meta-cu.js`, `initHeroList`, `initTactics`, `initAnalyze`, `initRecruitTracker`, or `initRosterRecommend`. There is also no browser/E2E runner, no test of the 10 shell mount IDs, no test of successful/failed runtime JSON fetch, and no test that a production build excludes `pipeline/`, `worker/`, tests, plans, ignored sources, or secrets.

### Python and Worker coverage

- Python file counts: build books 5, build dict 4, build team tier 4, build JSON 6, crawl 8, grid extractor 8, Hán-Việt 12, link tactics 6, normalize 18, secondary parsers 4, team-intro parser 4, tier suggestions 3.
- Worker file counts: config 9, guard 9, model 5, rate limit 7, scan modes 3, schema 20. The Worker is independent and should remain unchanged during this migration.

## Proposed Sequential Implementation Phases

## Phase 1 — Freeze the Current Browser Contract

**Goal:** create a narrow characterization net before changing the entry document.

### Create

- `tests-js/frontend-shell-contract.test.mjs`
  - Read the current `index.html`.
  - Assert exactly 10 unique `data-section` values.
  - Assert each has a matching `#section-${name}` mount.
  - Assert the active default is `team-pk`.
  - Assert stylesheet `/css/styles.css` and module `/js/app.js`.
  - Assert required accessibility hooks: `#section-menu-toggle`, `aria-controls="section-menu-items"`, and `#theme-toggle`.
- `tests-js/runtime-asset-contract.test.mjs`
  - Assert the seven runtime JSON paths exist and parse.
  - Assert top-level shapes/count invariants without freezing mutable content.
  - Assert `team.id` uniqueness and every `team-tier.teamId` joins an existing team.
  - Assert `js/app.js` still treats `team-tier.json` as optional and the other six as required.

### Modify

- None.

### Delete

- None.

### Characterize

- `index.html` nav/mount/script/style contract (`index.html:12`, `:29-58`, `:66`).
- `SECTIONS`, `sectionFromHash()`, `switchSection()` (`js/app.js:48-71`).
- `loadJSON()` versus `loadOptionalJSON()` (`js/app.js:20-33`).
- Runtime artifact paths and tier join (`js/app.js:78-87`).
- `createTeamFilterSection().setSearch()` cross-section contract.

### Existing coverage before phase

- 83 frontend tests; zero shell/app/data-loader tests.

### Dependency edges and duplication risk

- Test source truth must come from exported/observable contracts, not duplicate the entire HTML body.
- Counts should be broad invariants or current documented snapshot checks only where already an accepted contract; do not encode stale builder counts.

### Validation

- `node --test "tests-js/*.test.mjs"`; expected total becomes the existing 83 plus the new characterization cases.
- Existing Python and Worker suites remain unchanged.

## Phase 2 — Add Astro as a Static Build Shell

**Goal:** produce a parity `dist/` without changing browser behavior or canonical root assets.

### Create

- `package.json`
  - `private: true`, `type: "module"`.
  - scripts: `dev`, `build`, `preview`, `test:js`.
  - dependencies/devDependencies limited to Astro and one proven static-copy mechanism.
- `package-lock.json`
- `astro.config.mjs`
  - static output;
  - copy canonical root `css/`, `js/`, and `data/` to the same names under `dist/`;
  - no adapter and no SSR.
- `src/pages/index.astro`
  - copy the current document metadata and shell exactly;
  - preserve all IDs, classes, `data-section` values, initial active classes, Vietnamese text, and footer;
  - reference `/css/styles.css`;
  - load `/js/app.js` as an unbundled external module so its relative imports remain `/js/*.js`.

### Modify

- `.gitignore`: add `.astro/`, `dist/`, and root `node_modules/` remains covered by the existing rule.
- `tests-js/frontend-shell-contract.test.mjs`: parameterize the shell assertions so the same contract can run against `index.html` during transition and `dist/index.html` after build.

### Delete

- None. Keep `index.html` temporarily as rollback/reference until the parity build and E2E phase pass.

### Characterize

- Astro output must be a static `dist/index.html`.
- Root `js/`, `css/`, `data/` remain canonical and unchanged.
- Browser module URLs, fetch URLs, Worker URL/config, and localStorage keys must not change.
- `js/app.js` must execute only in the browser; do not import it in Astro frontmatter.

### Existing coverage before phase

- Phase 1 shell/data characterization plus the original 218-test full gate.

### Dependency edges and duplication risk

- **Primary risk:** committing `public/js`, `public/css`, or `public/data` would create second editable copies. Avoid.
- Do not configure Astro `publicDir` as repository root; that could publish `pipeline/`, `worker/`, tests, plans, ignored HTML sources, or local files.
- Do not build-time import JSON into Astro; that duplicates data payloads and changes runtime failure semantics.
- Verify the selected static-copy integration supports both `astro dev` and `astro build`; if it only copies on build, implement a small local Astro integration rather than committing copied assets.
- Do not create `src/components/*` yet. The shell is one page and has no reuse boundary.

### Validation

- `npm install`
- `npm run build`
- Contract tests against `dist/index.html`.
- Assert `dist/{index.html,css/,js/,data/}` exists.
- Assert no `dist/{pipeline,worker,tests,tests-js,plans,Meta Team PK}` exists.
- Run all existing Python/JS/Worker gates.

## Phase 3 — Add One Browser Smoke Suite and Prove Parity

**Goal:** cover the migration risk that Node unit tests cannot see.

### Create

- `playwright.config.mjs`
  - start `npm run dev -- --host 127.0.0.1`;
  - use one Chromium project;
  - retain traces only on failure.
- `tests-e2e/astro-smoke.spec.mjs`
  - page loads without console/page errors;
  - all 10 tabs activate the matching section and update hash;
  - direct hash load opens the correct section;
  - the three team tabs render expected runtime totals (56/48/110) from the current accepted snapshot;
  - theme toggles and persists after reload;
  - a local-only feature (search or tracker) works;
  - `/data/team-tier.json` failure is non-fatal (route interception), while a required JSON failure shows the load error;
  - no image upload or paid Worker call.
- `scripts/verify-astro-dist.mjs`
  - deterministic check of required output files and forbidden private directories.

### Modify

- `package.json`: add `test:e2e`, `test:dist`, and Playwright dev dependency.
- `package-lock.json`.

### Delete

- None.

### Characterize

- Hash navigation and mount activation.
- Client boot ordering.
- Runtime data loading and optional-tier fallback.
- CSS availability/responsive shell at a minimal desktop/mobile viewport pair.
- LocalStorage keys remain `theme`, tracker key, and roster scan key (`docs/system-architecture.md:57-66`).

### Existing coverage before phase

- 83 frontend unit tests, but only two fake-DOM navigation tests and no real browser boot coverage (`tests-js/mobile-section-menu.test.mjs:73-98`).

### Dependency edges and duplication risk

- Keep this a smoke suite, not a second assertion copy of every unit test.
- Avoid live Worker/Turnstile calls; browser migration does not authorize paid/external integration testing.
- Avoid snapshotting the entire HTML/CSS; test stable IDs, behavior, and visible counts.

### Validation

- `npm run build`
- `npm run test:dist`
- `npm run test:e2e`
- full existing gate.

## Phase 4 — Cut Over Pages and Remove the Legacy Entry

**Goal:** make Astro the only HTML source and update deployment authority after parity is proven.

### Create

- None in the repository unless the maintainer chooses to commit a Pages configuration later. Current Pages settings live outside the repo.

### Modify

- `README.md`
  - replace `python3 -m http.server` with Astro install/dev commands;
  - describe `src/pages/index.astro` plus canonical root `css/`, `js/`, `data/`;
  - document `npm run build` and `dist/`.
- `docs/system-architecture.md`
  - change “static SPA root files” to “Astro static shell + unchanged vanilla client modules/runtime JSON”;
  - preserve pipeline and Worker boundaries.
- `docs/deployment-guide.md`
  - Pages build command `npm run build`;
  - output directory `dist`;
  - verify copied static trees and forbidden paths;
  - rollback the atomic Astro build output.
- `docs/code-standards.md`
  - Astro owns static document structure only;
  - DOM behavior remains in root vanilla modules unless a future accepted feature justifies migration;
  - root `data/` remains generated runtime authority.
- `docs/codebase-summary.md`
  - update entrypoint/build tree and test commands.
- `docs/project-overview-pdr.md`
  - update the frontend architecture row from root `index.html` to Astro static output.
- `docs/deployment.md`
  - only after a real deployment: record date, source commit, preview/production URLs, build command, and `dist/` output. Do not pre-claim deployment.
- Cloudflare Pages external settings:
  - root directory: repository root;
  - build command: `npm run build`;
  - output directory: `dist`;
  - Node version pinned in Pages settings or `package.json` `engines`.

### Delete

- `index.html` after production-preview parity is accepted. `src/pages/index.astro` becomes the single document source.

### Characterize

- Production still serves `/css/styles.css`, `/js/app.js`, `/data/*.json`.
- Worker `ALLOWED_ORIGIN` remains `https://tqccl.pages.dev`; Astro does not change the origin (`worker/wrangler.toml:13-26`).
- Rollback must restore a known-good complete `dist/`, never mix data from different builds.

### Existing coverage before phase

- Full unit/type gate plus Phase 3 browser/dist checks.

### Dependency edges and duplication risk

- During Phase 2–3, `index.html` and `src/pages/index.astro` are temporarily duplicated. Keep the transition short; delete `index.html` in this phase.
- Re-read all dirty docs before editing; do not overwrite current user changes.
- Do not update `docs/deployment.md` until deployment facts exist.

### Validation

- Clean-install build (`npm ci && npm run build`).
- Unit, dist, E2E, Python, Worker test, and Worker typecheck gates.
- Cloudflare preview smoke across all 10 hashes.
- Inspect deployed file list to ensure private/build-time directories are absent.
- Only then promote to production and update `docs/deployment.md`.

## Files Intentionally Unchanged

- All `js/*.js` behavior modules: preserving them is the core compatibility strategy.
- All `data/*.json` and `pipeline/*`: Astro consumes/copies artifacts; it does not rebuild them.
- `css/styles.css`: retain the existing class contract and visual behavior.
- Entire `worker/` package and `worker/wrangler.toml`: deployment/API remains independent.
- `data/facets.json` runtime behavior: it remains unused by the frontend; tabs continue deriving facets from their source subsets (`docs/system-architecture.md:48-55`).

## Possible Duplication and Migration Traps

1. **Two public asset trees:** root plus `public/`. Prevent by copying at dev/build time from canonical root sources, never committing generated copies.
2. **Two HTML authorities:** root `index.html` plus Astro page. Accept only during the short parity window; delete root entry at cutover.
3. **Two render systems:** Astro components generating team content while `render.js` also generates it. Do not server-render dynamic sections in this migration.
4. **Two navigation models:** Astro routes plus current hash sections. Preserve the one-page hash contract; do not create ten routes unless product scope changes.
5. **Two data lifecycles:** Astro build imports plus browser fetch. Preserve browser fetch and its optional-tier fallback.
6. **Two state stores:** Astro/framework state plus current localStorage modules. Keep current storage schemas and adapters.
7. **Accidental broad publish:** repository-root `publicDir` could leak non-site content. Enforce a `dist` allowlist/denylist check.
8. **Pipeline coupling:** adding Python builders to `npm run build` would make clean builds nondeterministic because ignored sources/cache and stale counts are known issues.
9. **Worker coupling:** a root package script must not implicitly deploy or bundle `worker/`; Worker rollback and secrets remain separate.

## Recommended Acceptance Criteria

- `npm ci && npm run build` produces only the intended static site under `dist/`.
- Production URLs `/`, `/css/styles.css`, `/js/app.js`, and all required `/data/*.json` retain their current contracts.
- All 10 hashes activate the correct section; invalid/empty hash falls back to Team PK.
- Existing 218 tests and Worker typecheck pass; new shell/dist/E2E checks pass.
- No root JS module, data schema, storage key, Worker request mode, or public config contract changes.
- No `pipeline/`, `worker/`, tests, plans, ignored source exports, `.dev.vars`, or credentials appear in `dist/`.
- `index.html` is deleted only after Astro preview parity is proven.
- Evergreen docs describe Astro build/output accurately; dated deployment record is updated only after real deployment.

## Unresolved Questions

- Cloudflare Pages build settings are not represented in the repository. Confirm current dashboard build command/output and Node version before cutover.
- Choose and verify the minimal root-asset copy mechanism against the Astro/Vite versions selected. The acceptance requirement is one canonical root tree with dev and build support, not a specific plugin.
- Confirm whether Chromium Playwright binaries are acceptable in local/CI setup. If not, retain the deterministic dist contract plus a documented manual browser smoke, but recognize the remaining app-init coverage gap.
- Confirm whether production is mounted only at `/`. Current `./data/*` fetches are document-relative and work at the origin root; a future subpath deployment would require an explicit base-path contract.
