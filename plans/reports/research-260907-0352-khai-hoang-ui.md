# Khai hoang UI and integration research

Date: 2026-09-07
Scope: plan-only; no runtime edits. Accepted contract: `plans/reports/brainstorm-260907-0347-khai-hoang-team-details.md`.

## Current ownership and evidence

- `js/render.js:220-254`: `khaihoangTeamCard` owns the existing card and selector. `showBuild` at 236-247 replaces only `.kh-build`; unit badge follows selected build, title stays parent-owned. Read guidance exclusively from the selected build inside this replacement boundary. Never use `build.guide || t.guide` or merge parent guidance into a variant: same roster is insufficient evidence of same guide.
- `js/render.js:4-16`: `el` constructs text nodes and skips null children. Use it for every source-derived label/note; never interpolate raw HTML. Empty optional groups return null, numeric zero remains visible (`value != null`, not truthiness).
- `js/render.js:197-216`: existing primary hero rows use `.hero`, `.hn`, `.tag`, `kh-label`. Give nested split/transition rosters their own selectors, or scope primary assertions to `.kh-build > .heroes`; otherwise existing `card.locator('.hero')` assertions can accidentally include secondary rosters.
- `js/render.js:267-278,295-323`: separate Chạm Sứ renderer and block remain untouched. Legacy array input still renders mines; missing/empty Chạm Sứ hides only that block. Global mines are generic inventory, never the owner of per-team land rankings.
- `js/app.js:80,94`: actual runtime load/mount owner. Architecture text at `docs/system-architecture.md:48` still says root `app.js`; actual file is `js/app.js`. No app orchestration changes required for additive team guide data.
- `css/styles.css:298-317`: current card grid uses fixed 320px minimum; the nearby Chạm Sứ grid already uses `minmax(min(100%, 320px), 1fr)` and `min-width:0`. Reuse that responsive approach if narrow-screen tests expose overflow. Keep guide styles adjacent to Khai hoang owner, use wrapping lists/grid and visible summary focus.
- `docs/code-standards.md:15,21-25,30-34`: DOM text safety, canonical root assets, explicit artifact allowlist, accessible Vietnamese controls. Existing pure vanilla DOM rendering is sufficient.

## Bounded UI design

One optional guide object per applicable build; exact field names belong to the shared schema decision. Render characteristics/purpose, six score categories (land 4, 5, 6, 7–8, transition, overall), and minimum/recommended hột as compact summary. Do not invent a denominator or minimum when evidence supplies only a recommendation.

Render one native `details` with a Vietnamese `summary` when at least one detailed group is populated. Inside it: separate ordered land-4/land-5 lists (easy to hard); split plans with documented heroes, tactics and target; transition steps with destination team, extra training heroes, city/command/time milestones only where supplied. Omit empty headings and containers. Numeric milestones must retain their unit/context. Split teams stay nested inside the main card and never enter `chamSuTeams`.

Native details gives keyboard/touch operation without custom state, icon dependencies or new framework. On variant change the replaced guide closes; switching back restores the default guide collapsed. Other cards and their open states remain unchanged. Source strings containing markup render as literal text. No new season selection, source link, or source label in guide DOM.

Existing season banner and old variant source links are preexisting contracts (`js/render.js:240,246,301`, E2E `:14,24,36`). Accepted wording is no new season/source UI for this guidance; preserve unrelated existing metadata unless the controller explicitly scopes broader removal. New matching guide values must not be hidden by season checks.

## Phase inventory and RED/GREEN matrix

### UI phase (depends on accepted data shape and one evidence-backed guide fixture)

Modify `js/render.js`, `css/styles.css`, `tests-e2e/khaihoang-options.spec.mjs`. Prefer local guide helpers; no new runtime module or manifest change needed. Tests may intercept JSON with explicit real-source subsets, following existing `routeKhaihoang` at E2E :79-82; this is a test harness, never published fake records.

| RED case | Why meaningful now | GREEN acceptance |
|---|---|---|
| One actual complete guide, collapsed | Current renderer ignores all six groups | Summary contains exact expected labels/values; detailed content hidden until expanded; no headings for absent fields |
| Enter/Space activation at 1280 and 375px | No disclosure exists | Keyboard toggles open/closed, focused summary persists, visible detailed groups match source |
| Per-team ordered guards at land 4 and 5 | Global mines cannot express team-specific order | Exact list sequence per level; changing team changes sequence appropriately |
| Default guide → different variant guide → guide-less variant → default | Current selector only replaces hero/source content | Only selected guide visible, no inherited default guide; default restored; neighbor card text/open state unaffected |
| Missing guide, empty guide and partially populated guide | Future optional fields risk empty UI and exceptions | Existing heroes and source behavior retained, no blank disclosure, only supported groups rendered |
| Source text contains `<img ...>` and numeric score zero | Unsafe new code or truthy filters can regress correctness | Literal text only, no injected element/execution, zero visible |
| Real long transition/split text at 375px (and 320px grid edge) | Existing grid floor may overflow | Document/card fit viewport, text wraps, disclosure touch/focus usable |
| Guide provenance sentinel | Accepted guide must not display source or seasons | Sentinel source/season fields do not appear in guide subtree; old unrelated source assertions remain |

Do not turn the old global absence of `Chuyển hình đề xuất` into an unchecked deletion. E2E :94 and :123 currently assert global absence; scope those checks to `.cham-su-card` or the intentionally guide-less fixture while adding positive guide transition assertions. Keep `tests-js/khaihoang-data.test.mjs:84` forbidding legacy `teams[].transforms`; new structured transition steps must not revive the erroneous old table join. E2E :27 forbids `.kh-transforms` in variants; retain the old-field prohibition or replace with explicit selected-guide assertions if selectors intentionally change.

### Integration phase (depends on data and UI GREEN)

Modify existing data/E2E tests as necessary; update `docs/system-architecture.md` owning Khai hoang contract at 65-71 after reading current version. No expected changes to app loading, shell, Worker or pipeline rebuild. Extend tests to cover real imported guide identities/values, source-linked roster matching, and untouched Chạm Sứ/mines. Do not derive expected score values from the same payload under test: retain independently reviewed expected records.

| Check | Failure caught | GREEN evidence |
|---|---|---|
| Actual `data/khaihoang.json` through `/#khaihoang` | Fixture-only implementation, incorrect team mapping | All expected guide-bearing teams render correct summary/details from built site |
| Existing seven Khai hoang E2E cases | Selector, source link, mobile, independent Chạm Sứ and legacy input regression | All existing contracts pass, with only deliberately updated guide-aware assertions |
| Full Playwright suite | Shared render/CSS effects on other nine-section SPA flows | All discovered tests pass (current baseline 21, increases expected) |
| Build + dist contracts + verifier | Stale/copied assets or missing module allowlist | Output exact bytes equal canonical JS/CSS/JSON |
| Data test suite + runtime contracts | Renamed entities, invalid shape, accidental unrelated JSON change | Focused source assertions and runtime contracts pass |

## Exact commands and observed baseline

Observed on this read-only run: `node --test tests-js/khaihoang-data.test.mjs` passed **3/3**. `npx playwright test --list` discovered **21 tests in 3 files**, including **7** Khai hoang tests (2 variant/mobile, 2 Chạm Sứ viewport, 3 missing/empty/legacy). Discovery is not an E2E pass. No build, browser server or implementation test run was started.

Current shell Node is **v24.14.0** while `package.json:5-6` requires `>=22.12.0 <23`; select an installed compatible Node 22 before executing delivery gates, and record actual version. Do not silently change package engines.

Run sequentially during implementation:

```sh
node --test tests-js/khaihoang-data.test.mjs
lsof -nP -iTCP:4174 -sTCP:LISTEN
npx playwright test tests-e2e/khaihoang-options.spec.mjs --project=astro
npm run check
npm run test:node
npm run test:e2e
npm run test:dist
npm run verify
```

Focused and full Playwright commands build themselves via `playwright.config.mjs:16-20`: `npm run build && npm run preview -- --host 127.0.0.1 --port 4174`, reuse disabled, timeout 30 seconds; project is desktop Chromium with service workers blocked and failure traces retained (:12-14,24-27). Run no competing server. Inspect any existing port owner; do not kill user processes. Harness owns cleanup. If no E2E build was performed, run `npm run build` before dist tests/verifier.

The source manifest already includes render/styles/khaihoang (`src/lib/public-artifact-manifest.mjs:33,41,46`). Static endpoints prerender raw bytes (`src/pages/data/[file].json.ts:4-12`, analogous JS/CSS routes). `scripts/verify-astro-dist.mjs:53-61` compares emitted bytes with root sources; never edit `dist/` or `public/` copies. If helpers become a real new runtime module, explicitly add its manifest entry and let the existing inventory test (`tests-js/astro-dist-contract.test.mjs:20-39`) detect omissions.

## Concerns / unresolved inputs

- Exact schema and source transcription are controller/data researcher dependencies; this report does not assert image values unavailable here.
- Image 2 configuration and complete main tactics for two new teams remain the accepted brainstorm's data questions, not reasons to block work on other guides.
- Node engine mismatch must be resolved before final verification. Existing docs root-app path drift should be corrected only on the owning page when updating this contract.
- Preserve unrelated working-tree changes; this run writes only this report.

Status: DONE_WITH_CONCERNS
Summary: UI ownership, optional rendering, selected-build isolation, concrete TDD matrices and build/test delivery inventory are established from live code.
Concerns: Node 24 shell vs required Node 22; source/schema inputs pending; existing global transition-absence tests need precise guide-aware replacement.
