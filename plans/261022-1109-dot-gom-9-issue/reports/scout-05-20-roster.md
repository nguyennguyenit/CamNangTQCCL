# Report: issues #5 and #20 (roster conflicted-teams and coverage dashboard)

I changed nothing in the repo. Dry runs went to `/tmp`, and the publish chain was run in a throwaway copy at `/tmp/scratch`.

## 0. The issues
- **Line numbers in #5 are stale.** It cites `roster-recommend-ui.js:852-917`. The current sections are at `:844-927`.
- **#5 dependency:** "after merging `feat/mcp-skill-redesign`". `conflictedTeams` is already on main (`js/team-recommend-engine.js:821-841`, `tests-js/roster-adapter-audit.test.mjs:404`, MCP `recommend-handlers.ts:455`), so no dependency remains.
- **#5 needs no engine change.** I ran the issue's example with `recommendRoster` against real data: mode `meta`, season `og-兵演春秋`, owned heroes and tactics exactly as in the issue, no locked teams.
  - `portfolioTeams` is exactly one team: `40Y Lữ Bố Cung (Vương Dị, Pháp Chính)`, status `build-now`.
  - `conflictedTeams` is exactly one team: `Ngô Nữ Kỵ (Tinh·Hổ Báo Kỵ)`, id `og-bingyan-wunv-cavalry-hubaoqi`, tier T0.
  - Its `sharedHeroes` is `[]`.
  - Its `sharedTactics` is Đương Phong Thôi Quyết and Lâm Nguy Cứu Chủ, both with `usedBy: "og-bingyan-40y-lvbu-b"`.

## 1. #5: current state

**Engine**
- `conflictedTeams[]` has the shape `{team, candidateKey?/configId?/seasonContext?, tier, sharedHeroes[{hero, heroId, usedBy}], sharedTactics[{tactic, tacticId, usedBy}]}` (`team-recommend-engine.js:821-841`).
- `usedBy` is a team id (`team.id`), not a name. Season configs use their `sourceConfigId`; locked teams use `teamId || "locked-N"` (`:431`). The UI must map id to name through `portfolioTeams[].team`.
- The list comes from `eligible`, not from the portfolio. `eligible` is every team whose heroes and tactics are all available when it stands alone.
  - It can include `unreconciled` and `variant` teams (`:346-356`).
  - It is already filtered to `meta` tiers by `candidatePool` (`:183-190`, `META_TIERS` at `:14`).
  - It never includes teams dropped only for lack of room (test `roster-adapter-audit.test.mjs:421`).
- `recommendRoster` passes it through unchanged (`roster-season-candidates.js:228`). The legacy supplement does not touch it, and it only covers season teams (docblock `:182-184`).

**UI (`js/roster-recommend-ui.js`)**
- `renderRecommendation(result)` runs `:694-929`.
- Portfolio section: `:890-906`. "Thiếu món" section (`roster-missing-section`): `:907-927`.
- `blocked` is `result.blockedStrongTeams.slice(0,5)` (`:863`) and `incompatible` is sliced to 5 (`:864`). `missingCard` is `:844`, `incompatibleCard` is `:866-881`.
- `idleOverrides` (`:883-887`) is computed from `shownTeams = portfolio ∪ blocked ∪ incompatible` (`:883`). A new section does not interfere with it. A team that is overridden and appears only in `conflictedTeams` would still show the idle-override note.
- Reusable pieces:
  - `teamLabel(team)` (`:128`) uses Chinese hero names in zh.
  - `shown(name)` (`:122`) is for heroes and for tactics in zh.
  - `tacticShown(name)` (`:125`) is for tactics.
  - `tierPill(entry)` (`:685`) and `openButton(team)` (`:692`) are the tier and "Mở đội" controls.
  - `pill()` (`:78`) and `warnIcon()` (`:73`) are small helpers.
  - `ROSTER_STATUS_LABELS` is `:35-43`.
- vi/zh text mechanism:
  - `L(vi, zh)` from `js/i18n.js:34`.
  - `<html lang>` is fixed per page, so `L()` and the `const zh` at `:119` are resolved at load time.
  - There is no separate string table. Chinese literals sit next to the Vietnamese ones.
- The page shell is `src/pages/goi-y-doi-tu-kho/index.astro` (5 lines, pinned) → `SectionPage.astro` section `roster-recommend` (`:71`). `src/pages/zh/goi-y-doi-tu-kho/index.astro` is the zh mirror.
- The app boots `initRosterRecommend(...)` from `js/app.js:588`. It needs `isAnalyzeConfigured()` (`:100`) and fetches `/data/team-tier.json` and `/data/teams.json`.

**CSS**
- `.roster-missing` is `css/styles.css:12633` (card layout) and `:990` (shared border and panel rule). The `.roster-missing-text` warn colour is `:12654`. Section containers are `:12474`. The mobile rule for `.roster-missing-line` is `:13055`.
- No CSS exists for `.roster-incompatible`. The card reuses `roster-missing` plus a `data-status` attribute.
- Dark theme comes from tokens (`--warn`, `--panel`). No theme-specific rule is needed for a card that reuses `roster-missing`.

**Tests**
- There is no unit test for UI rendering. The UI is only covered by Playwright in `tests-e2e/beta-tools.spec.mjs` (describe "Gợi ý đội" `:840`).
  - `seedRoster` is at `:842`.
  - A real-data season fixture, `seasonMissingFixture()`, is at `:1122`.
  - The `/goi-y-doi-tu-kho/` flow is at `:1156`.
- `tests-e2e/zh-locale.spec.mjs:87` only checks the zh page shell. No zh roster test exists.
- Engine tests for `conflictedTeams` are `tests-js/roster-adapter-audit.test.mjs:404-430`. They use `seasonFrom("og-兵演春秋", ["og-bingyan-40y-lvbu-b","og-bingyan-wunv-cavalry-hubaoqi"])` and the `rosterOf` and `run` helpers from the same file, via `tests-js/fixtures/roster-adapter-fixtures.mjs`. This is the fixture to reuse for the issue's example.
- MCP parity: `mcp-worker/test/research/recommend-web-parity.test.ts:198` and `recommend-teams.test.ts:227`. MCP caps the list at `MAX_CONFLICTED = 10` (`recommend-handlers.ts:25`). The issue does not say whether the UI should cap it.

## 2. #5: files to touch

| File | Change | Pinned in policy `sourceFiles`? | In MCP `semanticFiles`? |
|---|---|---|---|
| `js/roster-recommend-ui.js` | New section, card and vi/zh text | **Yes**, sha256 `6d23419c…` | No |
| `css/styles.css` | Card styles (only if the reused style is not enough) | No (but in `PUBLIC_ARTIFACTS`) | No |
| `tests-e2e/beta-tools.spec.mjs` | New e2e tests | No | No |
| `tests-js/roster-view-model.test.mjs` (new) | Test for a new pure view-model | No | No |
| `js/roster-conflict-view.js` (new, optional, **recommended**) | Pure function that turns `conflictedTeams` plus portfolio into view data (name of holder, de-duplication, cap). Makes the logic testable in Node. | No | No (not listed, so no MCP workflow-hash churn) |
| `src/lib/public-artifact-manifest.mjs` | Add `entry("js","roster-conflict-view")`. A new runtime JS file that is not in this manifest will 404 in `dist`. | No | No |
| `docs/project-changelog.md`, `docs/codebase-summary.md`, `README.md` (Gợi ý đội section) | Docs | No | No |

- `js/roster-season-candidates.js`, `js/roster-scan-state.js` and `js/team-recommend-engine.js` are listed in `mcp-worker/workflow-source-manifest.json` `semanticFiles`. Editing any of them changes the MCP workflow hash and forces `mcp-worker/src/generated/workflow-build.ts` to be regenerated. That conflicts with "Research MCP released once". #5 needs none of these edits.
- `js/roster-recommend-ui.js` and `js/roster-scan-state.js` are pinned. `js/roster-season-candidates.js` and `js/team-recommend-engine.js` are not. `js/recommended-reference-state.js` is pinned, but it is only imported, not edited.

## 3. #20: current state
- **Data inputs:**
  - `buildSeasonCandidates(records, seasonId, {heroesDict, tacticsDict})` returns `{teams, teamTier, diagnostics{total, mapped, unmapped[]}}` (`roster-season-candidates.js:55-91`).
  - Each team has `{id, name, source:"season", seasonId, tier, unitType, unitTypesRaw, heroes[{name, tactics[{name, alternatives[], unresolved?, raw?}]}], conditionalTactics[]}`.
  - A hero slot has only `name` and `tactics`. The engine's `normalizeHeroSlot` can read `alternatives`, and `name` may be `"A/B"` (`js/hero-identity.js:66-98`).
  - In the current data, no season team has hero or tactic alternatives (probed on all 29 seasons: `withAlt = 0`). Alternatives only arrive through user overrides: `applyTacticOverrides` (`:114-137`) adds `alternatives` and `userAlternatives` to a slot.
- **Real tier values** (counts per season):
  - Default `og-兵演春秋`: 25 teams = T0 12, T0.5 1, T1 12.
  - pk-s28: 93 teams = T0 8, T0.5 33, T1 15, T1.5 17, T2 20.
  - pk-s24 also has T3 (10).
  - No team has an empty tier or FUNC, but `SOURCE_TIER_ORDER = ['T0','T0.5','T1','T1.5','T2','T3','FUNC','功能隊']` (`js/recommended-reference-state.js:190`). `sourceTierLabel` is at `:191`.
- **Seasons with no teams:** `pk-s15`, `pk-s20`, `pk-s21` have 0 Giao chiến teams, so the dashboard needs an empty state.
- **Unmapped configs:** `diagnostics.unmapped` is non-empty for `pk-s26` (17) and `pk-s24` (2). The dashboard total therefore undercounts the season's configs, and the UI should say so.
- **Engine status values.** `selectTactics` (`team-recommend-engine.js:346-356`) returns `missing-tactic`, `incompatible`, `move-tactic`, `unreconciled`, `variant` or `build-now`. `recommendTeams` adds `missing-hero` on `blockedStrongTeams` (`:716`) and `locked` on locked entries (`:436`).
- **`recommendRoster` is not enough for coverage.** It only uses `blockedStrongTeams`, so it fails these needs:
  1. `candidatePool` drops non-meta tiers in `mode: "meta"` (`:183-190`), so T1.5 and below would be missing.
  2. A team missing a hero never reaches the tactic check (`:709-721`, `continue`), so a team missing one hero and one tactic is reported as missing 1 hero.
  3. It applies shared-resource constraints (`seed.used*`), which the issue explicitly excludes.
  4. It blocks teams only when a hero or tactic is absent, so it cannot count "exactly one missing" across hero and tactic slots together.
- **Coverage must be its own pure function.** It should reuse the exported helpers `canonicalHeroId` / `normalizeHeroSlot` (`js/hero-identity.js`), `tacticIdForName` / `canonicalTacticId` / `createTacticIdResolver` (`js/lookup-ids.js`; the engine uses it through `tacticIdOf`).
  - Without the resolver, tactic ids fall back to slugging the display name, and the engine's own owned-set (`canonicalOwnedTactic`, `team-recommend-engine.js:85`) would disagree with the function.

### Page structure available
- `initRosterRecommend` keeps `season = {id, teams, teamTier, usage}` (`roster-recommend-ui.js:143-161`). `?season=` handling is `:162-192`. The season is chosen on the review stage (`seasonField` in `settings`).
- Results exist only after "Xác nhận" and "Gợi ý 5 đội". The issue says the block is "for the selected season", but not whether it needs the result stage. Placement (review or result) is an open decision.

## 4. #20: files to touch

| File | Change | Pinned? | In MCP `semanticFiles`? |
|---|---|---|---|
| `js/roster-coverage.js` (new, pure, no DOM) | `buildRosterCoverage({seasonTeams, seasonTier, ownedHeroes, ownedTactics, tacticIdOf}) → {tiers[{tier, total, complete, missingOne[]}], progress{heroes{owned,total}, tactics{owned,total}}}` | No | No (not listed) |
| `js/roster-recommend-ui.js` | Dashboard block, tier table, expandable lists, "Tôi có…" link, zh text | **Yes** | No |
| `css/styles.css` | Table and responsive rules, dark and mobile | No | No |
| `src/lib/public-artifact-manifest.mjs` | Add `entry("js","roster-coverage")` | No | No |
| `tests-js/roster-coverage.test.mjs` (new) | Counting tests | No | No |
| `tests-e2e/beta-tools.spec.mjs` | e2e (vi + zh + mobile) | No | No |
| `README.md` (Gợi ý đội), `docs/codebase-summary.md`, `docs/project-changelog.md` | Docs required by the issue | No | No |

- Avoid putting the pure function in `roster-season-candidates.js`. That file is in `semanticFiles`, so any edit forces a regeneration of `mcp-worker/src/generated/workflow-build.ts`.
- **Do not reuse `recommendRoster`**, for the reasons in section 3.

### Open points the issue leaves unspecified
- What to do with a team that has an `unresolved` tactic slot but otherwise has every owned hero and tactic.
  - The issue says `unreconciled` is "not counted as complete". It is silent on whether such a team counts as missing 1 or is shown separately.
  - The engine skips unresolved slots when checking ownership (`selectTactics`, `unresolved` branch at `:249-251`).
- Whether a hero-slot alternative (`"A/B"`) counts as owned if either is owned. The engine says yes (`assignHeroes`, `:192-206`).
- `conditionalTactics` (empty or `bond` slots) are not tactic slots, so they should be ignored (`mapHero`, `:38-43`).
- The collection denominator is "heroes and tactics in this season's standard teams". Unresolved slots should be excluded because they have no catalogue id. Owned items that never appear in the season are not counted.
- Roster-wide counts must dedupe by canonical id, not by display name. The same tactic can appear under a different viet name before and after catalogue updates.

## 5. Publish chain ("Publish lại bản dịch hiển thị", `docs/deployment-guide.md:251-271`)
Verified in the throwaway copy, where I added two `L()` strings to `js/roster-recommend-ui.js`:
1. `python3 -m pipeline.site_localization check --root . --stage public` first fails: `reviewed source hash is stale` for `js/roster-recommend-ui.js`.
2. Re-pin the file's sha256 in `pipeline/site-localization-policy.json` `sourceFiles`. The `inventory` command (`--report /tmp/…`) showed no change in `baseline.notes` (counts, `uiTranslateObligations`, `uiPending`, `concreteInventorySha256`) after adding the strings. New `L()` strings under an existing section do not need new policy tuples or receipts.
3. `check --stage public` then fails: `public localization artifact differs from strict build: data/website-display.json`. This confirms that `build` and `publish` are mandatory.
4. `build --root . --stage all --output .cache/site-localization-candidate` takes about 3 s. `check --stage all --candidate …` and `publish --root . --candidate …` follow.
5. `publish` rewrites the generation, which touches:
   - `data/website-display.json`.
   - `src/data/recommended-reference/current.json`.
   - A new directory `src/data/recommended-reference/<newgen>/` with `manifest.json`, `index.json`, `seasons.json`, `other-teams.json`, `hero-summaries.json`, `tactic-summaries.json` and about 87 `details-s-*.json` files. The previous generation directory is removed.
6. `python3 -m pipeline.team_route_handles --check` then fails: `ledger generationId '<old>' is not the selected generation '<new>'`. Re-pin the new `generationId` in `pipeline/team-route-handles.json` (the old id is also in `data/website-display.json` and `src/data/recommended-reference/<old>/manifest.json`, which the publish replaces).
7. `npm run build && npm run verify && npm run test:dist`.
- `PUBLIC_ARTIFACTS` (`src/lib/public-artifact-manifest.mjs`) is not touched by the chain. It matters only for new runtime files, which need an entry.
- No test or other file outside `pipeline/`, `data/`, `src/data/` and `docs/` hardcodes the generation id. The e2e fixtures (`seasonMissingFixture`) and `tests-js/fixtures/roster-adapter-fixtures.mjs` read it from `current.json`, so they survive a regeneration.
- Because the chain runs once per PR, #5 and #20 each produce a new generation.
- Docs say to restart the dev server after publish (it keeps a pin snapshot in memory).
- Chain inputs that I confirmed are read-only: `inventory --report /tmp/x.json` leaves `git status` unchanged.

## 6. Commands to run
- `npm run test:node` (all `tests-js/*.test.mjs`) or `node --experimental-strip-types --test tests-js/roster-season-candidates.test.mjs tests-js/roster-adapter-audit.test.mjs <new tests>`.
- `npm run build` (runs `check --stage public` first, then `astro build`), `npm run verify`, `npm run test:dist`.
- `npm run test:e2e -- tests-e2e/beta-tools.spec.mjs -g "Gợi ý đội"` (the web server builds the site and previews on port 4174). Also `tests-e2e/spa-parity.spec.mjs` and `tests-e2e/zh-locale.spec.mjs`.
- If any `semanticFiles` entry changed: `cd mcp-worker && npm run check:workflow-build`, then `npm test` and `npm run typecheck`. Avoid touching these files in #5 and #20.

## 7. TDD test matrix (failing first)

### #5: `tests-js/roster-view-model.test.mjs` (pure `js/roster-conflict-view.js`)
- Issue example, using `seasonFrom` + `rosterOf` + `run` as in `roster-adapter-audit.test.mjs:404`: the view model has exactly one card for Ngô Nữ Kỵ, 2 shared tactics, 0 shared heroes, and the holder name for each is `40Y Lữ Bố Cung (Vương Dị, Pháp Chính)`, not the id `og-bingyan-40y-lvbu-b`.
- No conflict (the "hết chỗ" case, `:421`): the view model is empty and the section is not rendered.
- A shared hero: the card lists the hero with its holder.
- Holder is a locked team (`locked-0`, `teamName`): the name resolves to `teamName`.
- Holder id absent from the portfolio: fall back rather than show a raw id (decide a rule).
- More than N conflicts: the cap rule shows a count of the hidden ones.
- Team label in zh: Chinese hero names; tactic names go through the zh resolver.

### #5: e2e in `tests-e2e/beta-tools.spec.mjs`
- Seed `tqccl.rosterRecommend.scanState.v1` with the issue's roster (6 heroes, 10 tactics) and `confirmed: true`. Request the default season `og-兵演春秋`.
  - Expect a section heading "Đội dựng được nhưng tranh món…" containing "Ngô Nữ Kỵ (Tinh·Hổ Báo Kỵ)", tier "Bậc: T0", the two tactic names and "40Y Lữ Bố Cung", plus a "Mở đội" button.
  - `.roster-missing-section h2` ("Thiếu món") must remain.
- A roster without conflicts (for example the existing `seedRoster` fixture or a single team): the section must not exist.
- zh (`/zh/goi-y-doi-tu-kho/`): Chinese heading and Chinese names, no Vietnamese tactic names. This is a new zh roster e2e; none exists.
- After "Tôi có chiến pháp …" or "Dùng món này", the card list updates. `applyFromResults` re-renders, so the card must not go stale.
- Mobile (390 px): no horizontal overflow. The existing mobile test is at `:1053`.
- Dark theme: no contrast regression for a card reusing `roster-missing`.
- Opening the card ("Mở đội") goes through `onOpenTeam` like the blocked ones.

### #20: `tests-js/roster-coverage.test.mjs`
- Boundary: 0, 1 and 2 missing heroes or tactics (complete, missing exactly one, missing ≥2) in a single team.
- 1 missing hero + 1 missing tactic is not "missing one" (the case the engine would misreport).
- A hero slot with alternatives (`name: "A/B"`) counts as owned if either is owned.
- A tactic slot with a user alternative (`alternatives` + `userAlternatives` from `applyTacticOverrides`) counts as owned if the alternative is owned.
- `unresolved` slot: team is not "complete"; define and pin the missing-one rule.
- Empty and `bond` (`conditionalTactics`) slots are ignored.
- Same hero or tactic across several teams: each team counted independently (no shared-resource constraint).
- Per-tier counts follow `SOURCE_TIER_ORDER`; a tier with 0 teams still appears (or is omitted: pin it); an unknown tier value is placed last.
- A season with 0 teams (`pk-s20`) returns an empty structure without throwing.
- Collection progress: owned (canonical, deduped) ∩ season roster over the season total; duplicates in the roster don't double-count; owned items absent from the season don't inflate the numerator.
- Real-data test with the issue-#5 roster on `og-兵演春秋`: Lữ Bố Cung team is complete; Ngô Nữ Kỵ is also complete when standing alone (this is the point of the issue); the two counts are consistent with `buildSeasonCandidates` (25 total: T0 12, T0.5 1, T1 12).
- Tactic id via display names: a roster storing the old Hán-Việt tactic name resolves to the same id as the engine (`createTacticIdResolver(tacticsDict)`).

### #20: e2e
- The dashboard shows the right table for the issue roster; clicking a cell lists teams; "thiếu 1 món" lists the missing item and links to the "Tôi có…" flow.
- Changing `?season=` recalculates; `pk-s20` (empty) shows an empty state.
- vi and zh text, light and dark theme, and mobile.

## 8. Risks and traps
- A new JS file must be added to `PUBLIC_ARTIFACTS`, or it fails at runtime on `dist`. The `runtime-asset-contract` and `astro-dist-contract` tests are the guard.
- Putting the new pure function in `roster-season-candidates.js` or `team-recommend-engine.js` causes MCP workflow-hash churn.
- The chain adds a new generation directory with 87+ files for each PR, so diffs are huge. Re-pin `pipeline/team-route-handles.json` in the same PR, or `team_route_handles --check` fails.
- #14 → #5 → #20 → #6 serialization (brief): all of these edit `js/roster-recommend-ui.js`'s pin or the generation, so each PR must re-run the chain on the merged base.
- `usedBy` is an id, not a name (see section 1).
- The issue says "T0" for Ngô Nữ Kỵ, but `conflictedTeams` only contains `meta` tiers in `mode: "meta"`. In "Nhiều hột" (`redStars`) the pool is unfiltered (`candidatePool`, `:185`), so the section can list non-meta tiers there.
- `unreconciled` and `variant` teams can be in `conflictedTeams` (they pass `selectTactics` `ok`). The card could show their status label.
- The issue's wording "Engine không đưa vào danh sách này những đội bị loại chỉ vì đã đủ số đội tối đa" is true, but only for teams that share nothing. A full portfolio of 5 can still produce conflicted cards.
- The page requires `isAnalyzeConfigured()` and Turnstile. e2e must stub `https://challenges.cloudflare.com/**` (`TURNSTILE_STUB` in `tests-e2e/beta-tools.spec.mjs:24`) and `WORKER_ROUTE`; seed `localStorage` with `seed(page, …)` (`:60`).
- `docs/project-changelog.md` has an entry per policy bump, naming the policy (`site-vi-…`); previous practice renames `policyVersion` per change. I did not verify whether a changed `policyVersion` is required [UNVERIFIED]; my scratch run passed `check` without changing it.

## 9. What the brief misses
- Nothing in the brief covers `js/roster-conflict-view.js` or `js/roster-coverage.js` and their manifest entries.
- The brief says "chuỗi Publish lại" for each PR but not that adding `L()` text needs no new policy tuples (verified in the scratch copy) while the hash re-pin and the full build and publish are mandatory.
- #5's issue body says nothing about a cap, zh label of the holder team, or interaction with `idleOverrides`. #20 says nothing about where the block sits (review or result stage), the `unreconciled`-missing-one rule, or the `unmapped` undercount. These need a decision before implementation.