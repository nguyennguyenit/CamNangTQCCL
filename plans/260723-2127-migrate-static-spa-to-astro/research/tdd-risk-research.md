# TDD and migration risk research: static SPA to Astro

Date: 2026-07-23  
Scope: test strategy and risk model only; no product, test, build, or deployment files changed.

## Recommendation

Treat Astro as a static shell/build migration, not a frontend rewrite. Keep the existing DOM contract, `js/*.js` ES-module behavior, committed runtime JSON, storage keys, and separate Vision Worker unchanged. Add browser characterization before introducing Astro; make the same browser suite run against both the legacy root and the built `dist/` output until cutover.

The safest order is:

1. Freeze current behavior with real-browser characterization and an artifact allowlist test.
2. Add the minimal Astro static build while preserving the current page markup and public URL paths.
3. Prove behavior parity against `dist/`, including failure paths.
4. change Cloudflare Pages from repository-root publishing to `dist/` only.
5. Run a production-origin canary for Turnstile/Worker, then retain the previous Pages deployment as the rollback target.

Do not move or rewrite the pure domain modules during this migration. The unfinished MCP plan imports and changes those modules; preserving `/js` as the canonical source boundary avoids unnecessary coordination and lets Astro browser tests become its missing end-to-end regression gate.

## Evidence and current baseline

### Runtime contracts

- `index.html:1-75` is the entire document shell: Vietnamese metadata, stylesheet, ten nav buttons, ten matching `section-*` mounts, footer, and one module entrypoint at `./js/app.js`.
- `js/app.js:20-33` defines required and optional runtime JSON behavior. A non-2xx required artifact throws; only `team-tier.json` falls back.
- `js/app.js:48-71` owns the ten-section hash router. Unknown or empty hashes render `team-pk`; tab clicks and `hashchange` toggle the existing `.active` classes.
- `js/app.js:74-114` boots theme/navigation before fetching six required JSON files and one optional file, then initializes every feature. A required-data failure renders a Vietnamese error in Team PK and prevents later feature initialization.
- `js/app.js:35-45` preserves the public `localStorage.theme` key.
- `js/recruit-tracker-store.js:1-3,317-344` preserves `tqcclRecruitTracker`, schema version 1, fail-safe corrupt-data loading, and validated serialization.
- `js/roster-scan-state.js:1-3,85-100` preserves `tqccl.rosterRecommend.scanState.v1` and strips image/base64/blob/Turnstile fields.
- `js/roster-recommend-ui.js:22-28,117-210` reads/writes the roster key directly and shares the Turnstile loader with image analysis.
- `js/analyze.js:37-72` dynamically injects the Cloudflare Turnstile script and calls the configured Worker.
- `js/analyze.js:140-256` calls `ensureTurnstile()` during feature initialization; `js/roster-recommend-ui.js:202-210` also calls the shared loader during initialization. The current implementation therefore attempts Turnstile after successful app boot, not only after a user opens the Analyze tab. Migration tests must characterize the actual behavior; the mismatch with the comments is not an Astro-migration fix.
- `js/config.js:4-19` contains active public Worker and site-key configuration.
- `worker/src/index.ts:26-94` is an independently deployed Worker with the guard sequence origin/method → limit → Turnstile → image guard → model → validated JSON. Astro must not absorb or bypass it.
- `worker/wrangler.toml` fixes `ALLOWED_ORIGIN` to `https://tqccl.pages.dev`. A Pages preview origin cannot complete the live Vision flow unless the Worker policy changes; expanding that policy is outside this migration.

### Existing automated coverage

Observed on the dirty `main` workspace on 2026-07-23:

| Suite | Command | Result | What it protects |
|---|---|---:|---|
| Python unittest | `python3 -m unittest discover -s tests` | 82 passed | parser, normalization, builders, data joins and invariants |
| Node native tests | `node --test "tests-js/*.test.mjs"` | 83 passed | pure filters/mappers/recommendation, tracker state/view model, roster state, selected data contracts |
| Worker Vitest | `(cd worker && npm test)` | 53 passed / 6 files | image guard, rate/cap, schema/modes, endpoint config, model prompts |
| Worker typecheck | `(cd worker && npm run typecheck)` | passed | Worker TypeScript only |

Specific useful contracts already exist:

- `tests-js/recruit-tracker-store.test.mjs:138-159` checks import validation, corrupt storage fallback, and valid save/load using an in-memory adapter.
- `tests-js/roster-scan-state.test.mjs:13-65` freezes the roster key and privacy serialization.
- `tests-js/mobile-section-menu.test.mjs:73-98` uses hand-built fake elements to check menu state.
- `tests-js/tactics-data.test.mjs:121-129` checks that referenced JSON files parse.
- `worker/test/guard.test.ts:12-58` checks image/CORS helpers, while Worker tests do not run the deployed site.

The important gap is that none of these suites opens `index.html`, executes `js/app.js` in a browser, loads all runtime JSON over HTTP, exercises native history/localStorage, verifies the dynamically injected third-party script, or inspects a production build. There is no root `package.json`, Astro config, browser test config, build command, or build output test. Current deployment is a manual root allowlist (`docs/deployment-guide.md:68-88`) and manual smoke checklist (`docs/deployment-guide.md:149-170`).

## Contract checklist to freeze before Astro

### Document and DOM

- [ ] `lang="vi"`, `data-theme="light"`, title, description, viewport, favicon, and stylesheet remain present.
- [ ] All ten `.nav-tab[data-section]` values and all ten `#section-*` mounts remain one-to-one.
- [ ] Default active tab/section is Team PK.
- [ ] Existing IDs used by JavaScript remain unchanged: `section-menu-toggle`, `section-menu-items`, `theme-toggle`, and every mount ID.
- [ ] Footer/disclaimer user-facing copy remains present.
- [ ] The existing module graph executes once; no duplicate initialization/listeners from Astro hydration or script processing.

### Navigation

- [ ] Direct load of every supported hash activates exactly its tab and section.
- [ ] Empty hash activates Team PK.
- [ ] Unknown hash keeps current behavior: Team PK is active even if the unknown hash remains in the URL.
- [ ] Clicking each tab updates the hash and active classes.
- [ ] browser Back/Forward triggers `hashchange` and restores the corresponding section.
- [ ] A hash deep-link still returns the root document from Pages; no server-side Astro route or redirect is required for a fragment.

### Runtime data

- [ ] These six required URLs return 200 JSON from the built site: `/data/teams.json`, `/data/coexist.json`, `/data/khaihoang.json`, `/data/tactics.json`, `/data/heroes-dict.json`, `/data/books-dict.json`.
- [ ] `/data/team-tier.json` remains optional.
- [ ] Required-data failure renders the current load error and does not silently substitute stale/generated/fake data.
- [ ] Missing `team-tier.json` still renders the application without tier badges.
- [ ] Build uses the committed `data/` snapshot byte-for-byte; it does not invoke the currently non-reproducible Python rebuild path documented in `README.md:56-60` and `docs/deployment-guide.md:56-66`.
- [ ] CSS, hero icon URLs, module imports, and JSON fetches resolve from the production root.
- [ ] Build artifact contains only the intended site allowlist, not `pipeline/`, `tests*/`, `worker/`, `plans/`, ignored sources, secrets, or repository metadata.

### Persistent state and privacy

- [ ] Existing `theme`, `tqcclRecruitTracker`, and `tqccl.rosterRecommend.scanState.v1` values are readable after the migration on the unchanged Pages origin.
- [ ] Theme persists after reload.
- [ ] A real legacy schema-v1 tracker payload renders and remains exportable/importable after reload.
- [ ] A real legacy roster payload renders, can be edited/confirmed, and remains after reload.
- [ ] Invalid tracker JSON still falls back to a default state rather than preventing boot.
- [ ] Persisted roster JSON still contains no image, data URL/base64, blob, or Turnstile token.
- [ ] No storage-key rename, automatic clearing, or schema upgrade is introduced merely for Astro.

### Vision boundary

- [ ] Successful local data boot appends the exact Turnstile script URL no more than once despite two consumers.
- [ ] Turnstile network failure leaves all local-only sections usable and shows the existing failure status where applicable.
- [ ] `callWorker` still emits `POST` JSON `{image, turnstileToken, mode}` to the configured URL and preserves 429/422/general UI error mapping.
- [ ] Astro produces no server endpoint, proxy, secret, or alternate Turnstile bypass.
- [ ] Worker Vitest and typecheck remain unchanged and green.
- [ ] Final production-origin canary verifies a real widget/token and Worker request; preview-origin browser tests do not pretend to prove this.

### Deployment

- [ ] Astro output is static and deployable without a server adapter.
- [ ] Cloudflare Pages build command and output directory are explicit; output changes from repository root to `dist/`.
- [ ] `https://tqccl.pages.dev` remains the production origin so existing storage and Worker origin configuration survive.
- [ ] A preview deployment proves local features, hashes, assets, and JSON; production canary alone proves Turnstile/Worker integration.
- [ ] Previous known-good Pages deployment remains available until the post-cutover canary passes.

## Test scenario matrix

| Severity | Scenario | Test level | Expected invariant / failure signal | Gate |
|---|---|---|---|---|
| Critical | Astro shell omits/renames a mount or control ID | browser contract | ten tabs and ten mounts exist; app boots with no uncaught error | pre-merge |
| Critical | Built artifact misses/stales runtime JSON | artifact + browser/network | exact required URLs are 200/JSON and key counts/content hashes match source | every build |
| Critical | Required JSON returns 404/corrupt JSON | browser fault injection | visible current load error; no fabricated fallback | pre-merge |
| Critical | Existing tracker/roster state is lost | browser with seeded real schema payload | same keys remain readable after boot, mutation, reload | pre-merge and preview |
| Critical | Build publishes private/source material | artifact allowlist | fail on any path outside the approved static output | every build |
| Critical | Production Pages publishes repository root or wrong directory | deployment check | deployed headers/assets identify `dist`; source-only URL probes are 404 | preview/promotion |
| Critical | Turnstile/Worker fails after origin-preserving cutover | production canary | real widget completes and one cropped-image request follows current contract | post-deploy before completion |
| High | Astro processes/duplicates the entry script | browser instrumentation | one boot, one set of listeners, one Turnstile script element | pre-merge |
| High | Hash behavior changes | browser | direct links, click, Back/Forward, invalid hash all match current behavior | pre-merge |
| High | Relative `./data` paths break under preview/build | browser network | no 404 and all ten sections initialize from root document | built preview |
| High | Optional tier becomes required | browser fault injection | `team-tier.json` 404 does not show global load error | pre-merge |
| High | Theme storage changes | browser | legacy `theme=dark` applies before/at boot and persists on toggle/reload | pre-merge |
| High | Roster serializer leaks media/token fields | unit + browser storage inspection | forbidden substrings absent from persisted JSON | pre-merge |
| High | Preview canary is mistaken for Worker proof | deployment procedure | preview expected to exercise local UI only; production-origin canary is mandatory | release |
| High | Astro migration moves/bundles `js` in a way that breaks MCP imports | import/path contract + existing Node suite | canonical ES exports and current Node import paths stay valid | pre-merge |
| Medium | SEO/document metadata changes | HTML artifact/browser | existing title, description, language, viewport retained | build |
| Medium | CSS or icon/resource path changes | browser console/network | no local 404, layout CSS loaded, broken optional hotlink icon remains non-blocking | built preview |
| Medium | Third-party Turnstile is unavailable | browser with request deliberately aborted | local sections work; no unhandled rejection; visible status is stable | pre-merge |
| Medium | Browser console accumulates errors | browser | no uncaught exception or failed first-party request on each smoke path | preview |
| Medium | Worker package regresses due root tooling | package isolation | Worker lockfile/scripts still independently pass Vitest/typecheck | full gate |
| Medium | Dirty/generated public staging files mask stale source | artifact hash test | build always refreshes exact allowlist and compares output to source | every build |
| Low | Responsive menu regresses | Chromium desktop + mobile viewport | menu toggle, active label, Escape/click close continue to work | pre-merge |

Fault injection above means intercepting a real first-party request and returning a controlled transport failure, not supplying fake application records. Happy-path browser tests must consume the committed production-shaped JSON.

## Tests-first gates and likely phase commands

The commands below are proposed scripts for the Astro plan. Names can follow the final root `package.json`, but each capability should remain separately runnable.

### Gate 0 — record the unmodified baseline

Run before adding root tooling and again at every shared-contract phase:

```bash
python3 -m unittest discover -s tests
node --test "tests-js/*.test.mjs"
(cd worker && npm ci && npm test && npm run typecheck)
```

Acceptance: 82 Python, 83 Node, and 53 Worker tests currently pass; counts are evidence, not frozen acceptance. Zero failures is the contract.

### Phase 1 — browser characterization on the legacy site

Add a minimal root lockfile and a Chromium browser suite before Astro files. Prefer Playwright because native browser history, storage, network interception, viewport, console, and script-element inspection are the missing capabilities. Do not replace existing Node tests with a DOM emulator.

Suggested focused commands:

```bash
npm ci
npm run test:e2e:legacy
node --test tests-js/recruit-tracker-store.test.mjs tests-js/roster-scan-state.test.mjs
```

`test:e2e:legacy` should serve the current repository over HTTP (equivalent to `python3 -m http.server`) and run:

- shell/DOM contract;
- all ten direct hashes plus click and Back/Forward;
- required/optional JSON network assertions and failure injection;
- seeded legacy theme/tracker/roster state with reload;
- Turnstile script de-duplication and third-party failure isolation;
- first-party console/network error collection;
- desktop and one mobile viewport.

Gate: tests must pass against the legacy site before they are allowed to evaluate Astro. If a proposed assertion fails here, it is a behavior change request or a test mistake, not migration parity.

### Phase 2 — minimal Astro static build and artifact contract

Write the build test first. It should fail because `dist/` does not yet exist, then become green with the smallest Astro shell. Keep JSON as runtime fetches; do not import it into generated HTML or run the Python pipeline.

Suggested commands:

```bash
npm run build
npm run test:artifact
npm run test:e2e:dist
```

Artifact assertions:

- `dist/index.html` is static and contains the frozen metadata/DOM hooks;
- all first-party HTML references resolve under `dist/`;
- every approved `css/`, `js/`, and `data/` file required by the runtime is present;
- copied public assets match the source bytes/hashes so stale staging cannot pass;
- no source-only/private directory is present;
- no SSR/Worker adapter output is required.

If public staging/copying is necessary, use one explicit allowlisted sync/build owner and make both dev and build invoke it. Never configure the whole repository as Astro's public directory: current deployment deliberately excludes `pipeline/`, `worker/`, tests, plans, raw sources, and secrets (`docs/deployment-guide.md:72-81`).

Run the identical browser spec against built output. A temporary dual-target period is valuable: legacy and `dist` must both pass until cutover.

### Phase 3 — parity completion and shared regression

Focused red/green order:

1. shell and first-party asset smoke;
2. hash navigation;
3. required/optional JSON failures;
4. storage migration/reload/privacy;
5. Turnstile injection/failure isolation;
6. mobile and console/network sweep.

Full local gate:

```bash
npm run build
npm run test:artifact
npm run test:e2e:legacy
npm run test:e2e:dist
node --test "tests-js/*.test.mjs"
python3 -m unittest discover -s tests
(cd worker && npm ci && npm test && npm run typecheck)
```

After the legacy page is removed, drop only `test:e2e:legacy`; keep the exact same spec against `dist`.

### Phase 4 — Cloudflare Pages preview and promotion

Build from a clean checkout/worktree with the committed lockfile. Pages configuration must use the verified Astro build command and `dist` output, not the prior root publish behavior.

Preview gate:

```bash
npm ci
npm run build
npm run test:artifact
npm run test:e2e:dist
```

Against the preview URL:

- execute all local/hash/storage/read-only smoke paths;
- fetch each required JSON URL and selected CSS/JS assets;
- probe representative excluded paths (`/pipeline/`, `/tests/`, `/worker/`, `/plans/`) and require 404;
- collect browser console and failed first-party requests.

Do not require a successful Vision request on the preview subdomain because current Worker origin policy is exact. After promotion on `https://tqccl.pages.dev`, run the production canary from `docs/deployment-guide.md:151-170`: Worker preflight, real Turnstile, one cropped image flow, roster reload/privacy inspection, and ten-section smoke.

Promotion is complete only when the production canary passes. Until then, the prior Pages deployment is the immediate rollback.

## Migration failure modes and rollback gates

| Failure mode | Detection | Stop/rollback gate |
|---|---|---|
| Astro HTML transformation changes script execution or initializes twice | boot counter/listener behavior, duplicate Turnstile element, console errors | do not merge; render a static shell and load the existing entry once |
| DOM contract drift | legacy characterization passes, `dist` fails on IDs/tab/mounts | revert shell conversion; do not patch JS during parity work |
| Runtime JSON path or staging drift | artifact hash mismatch, first-party 404, wrong team/content assertions | fail build; restore exact allowlisted source-to-output mapping |
| Data pipeline accidentally runs and overwrites artifacts | dirty `data/` diff or content hash change | stop; restore the complete committed data snapshot, never mix files |
| Optional tier semantics change | injected tier 404 causes global error | revert loader/bundling change; keep `loadOptionalJSON` behavior |
| localStorage key/schema changes | seeded legacy payload missing or defaulted unexpectedly | block promotion; restore exact keys/schema and retest on unchanged origin |
| Browser privacy regression | persisted roster includes forbidden media/token fields | block merge and promotion; retain existing serializer contract |
| Turnstile script missing, duplicated, or loaded in a new order | DOM/network count or production canary failure | revert script integration; Astro must not own the widget |
| Preview Vision failure misdiagnosed as product failure | preview Origin differs from `ALLOWED_ORIGIN` | test local paths on preview; reserve integration decision for production canary |
| Root package/tooling interferes with Worker | Worker `npm ci/test/typecheck` fails | keep root and `worker/` lockfiles/config isolated; revert cross-package coupling |
| Pages output directory misconfigured | excluded source paths become public or `/data` is absent | do not promote; restore previous Pages deployment/config |
| Production-only failure after promotion | live canary fails | immediately roll back/promote the prior known-good Pages deployment; Worker remains independently deployed |
| `js` relocation breaks MCP adapter imports or Node tests | Node/import-boundary tests fail | keep canonical module paths; defer relocation/refactor beyond migration |

Rollback should be coarse and recoverable: revert the Pages deployment as one artifact. Do not attempt a partial rollback of HTML while retaining mismatched built assets/data. Worker rollback/kill-switch remains independent (`docs/deployment-guide.md:172-184`).

## Relationship to the unfinished MCP/GoClaw plan

The two plans should remain separate but must no longer claim zero relationship.

The pending MCP plan states that existing browser ES modules remain browser-compatible and are protected by characterization tests (`plans/260723-2055-mcp-goclaw-image-team-research/plan.md:28`) and requires browser/Worker regressions (`plan.md:58`). Its Phase 1 creates a typed adapter over pure `js/*.js`, while Phase 2 plans edits to `match-dict.js`, `analyze-map.js`, `roster-scan-map.js`, `roster-scan-state.js`, and `team-recommend-engine.js` plus their Node tests. It does not own `index.html`, `app.js`, Astro config, Pages output, or browser E2E.

Recommended coordination:

1. Astro plan first adds the real-browser characterization harness. This closes a gap the MCP plan currently labels “browser regression” but only implements with Node characterization.
2. Preserve canonical `/js` module paths and public exports through the Astro migration. Do not combine the migration with moving domain files under `src/` or converting them to TypeScript.
3. Complete the Astro shell/build cutover before MCP Phase 2 edits shared domain modules, or at minimum serialize those edits; do not run both plans against the same `js`/`tests-js` files concurrently.
4. Add the Astro build/artifact/browser commands to every MCP phase full-regression gate, alongside its existing Node/Python/Worker commands.
5. MCP owns domain semantics, typed adapters, R2/MCP transports, and GoClaw flow. Astro owns browser shell, static asset publication, runtime fetch behavior, state continuity, and Pages deployment.
6. The Vision Worker and Turnstile boundary stay unchanged in both plans. MCP explicitly forbids a Turnstile bypass/raw media path; Astro must preserve that separation.

This is a soft sequencing and regression dependency, not a reason to merge the plans. Update both plan indexes to name it once scheduling is accepted: “Astro browser/build characterization precedes shared-domain changes; MCP phases consume the Astro full gate.”

## Suggested acceptance criteria for the Astro plan

- All pre-existing Python, Node, Worker Vitest, and Worker typecheck suites pass.
- One browser characterization suite passes first against the legacy site and then unchanged against built Astro output.
- Ten hashes, runtime JSON success/failure semantics, legacy localStorage payloads, and Turnstile injection/failure isolation are covered.
- Astro outputs a static allowlisted `dist/`; committed runtime JSON is copied unchanged and the Python pipeline is not invoked.
- Cloudflare Pages preview passes local/asset/privacy smoke; excluded repository paths are not published.
- Production remains `https://tqccl.pages.dev`; real Turnstile/Worker canary passes after promotion.
- Previous Pages deployment is retained until canary completion and is the tested rollback path.
- Canonical pure ES module paths/exports remain compatible with the pending MCP plan.

## Unresolved questions

1. How does the current Cloudflare Pages project express its build command/output directory (dashboard-only versus repository configuration)? The repository has no Pages config to inspect.
2. Should generated public staging be copied, symlinked, or served through a narrowly scoped build helper? Choose only after a clean Linux/Pages build proves dev and production use identical allowlisted bytes; never expose the repository root.
3. Is a live production Vision canary authorized during implementation, including one cropped non-sensitive screenshot and quota use? Without it, local/preview gates can prove injection and request shape but not the exact Turnstile site/secret/origin pairing.
