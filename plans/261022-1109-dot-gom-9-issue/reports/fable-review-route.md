**Model:** anthropic/claude-fable-5-1

## Verdict: sound with fixes

The route, release order and serialization are defensible; two framing errors (#14A as a "migration", #6 as parallel-safe) and one weaker-than-necessary mitigation (holding #21/#23 PRs open) should be corrected.

## Findings

**1. High — #14A must be a freeze, not a migration; book ids are already persisted server-side.**
Evidence: `community-worker/src/routes/scan.ts:100` parses `book:` ids into `confirmed`, stored as JSON in D1 `scan_samples.confirmed` (`scan.ts:210-213`, `migrations/0005_scan.sql`); `community-worker/src/validate.ts:12` pins the shape `^book:[a-z0-9-]+$`; MCP entity ids come from `bookLookupId` (`mcp-worker/src/data/publication-builder.ts:314`); `js/lookup-ids.js:248-250` `groupForId` only accepts ASCII ids, so an id literally "keyed on the Chinese name" is impossible, and `lookupDerivedSlug` (`:280-284`) derives the URL slug from the id suffix, so new id values = new URLs unless 68 ledger exceptions are added (ledger has 0 today: `pipeline/lookup-route-handles.json`, 938 handles, 0 exceptions).
Correction: implement A as "assign `book:<slug(viet)>` once, keyed by `chinese` (all 68 unique, none missing — verified in `data/books-dict.json`), stored as a frozen `id` per row; current 68 values kept verbatim". Then no D1/fixture/MCP id churn. `lookup_route_handles.py:79-83` `_book_id` reads the frozen id instead of re-slugging.
Consequences for ordering: #14A → #15 is a *preference* (both regenerate `workflow-build` since `js/lookup-ids.js` is in `mcp-worker/workflow-source-manifest.json` semanticFiles), not a dependency; #14A → #23 is "freeze before #23 persists books", trivially met and not blocking #21/#23 phases 1–4. Roster localStorage (`js/roster-scan-state.js:79-82`, names not ids), `recruit_records`, and `community_teams` (hero/tactic ids only, `0008_community_teams.sql`) hold no book ids.

**2. Medium — #14B is dead code once A freezes ids.**
`pipeline/lookup_route_handles.py:16-19`: `_redirects` is driven by `lookup.formerIds` of tactics (merges), not renames. With frozen ids a book rename never retires an id; only a book *merge* would, and books have no `formerIds` concept. Recommend A + "tối thiểu" (fix `LEDGER_NOTE`, docs, rename test) and drop B until a book merge actually happens. User decided A+B — record as disagreement.

**3. High — better mitigation than "keep #21/#23 PRs unmerged": release D1 0011 + community-worker right after the worker phase merges.**
Confirmed: `community-worker/src/routes/posts.ts:139-156` sends `repository_dispatch` `blog-publish` on publish/unpublish/edit/delete (`:281,304,330`), gated by `requireRoot` (owner only); `pages-deploy.yml:8-10,30` builds `main` HEAD. The worker route is additive and the Pages proxy has no allowlist (`functions/api/[[path]].ts` forwards everything), so once `/api/roster` is live, every PR in the batch is safe to be on `main`. Surface count unchanged (worker still released once). Other PRs are deploy-safe mid-batch: #15 is MCP-only (MCP deploys only via `workflow_dispatch`, `mcp-worker.yml:141`); #14 freeze changes no URL; #6 is additive Pages content. The plan's rollback section already shows the client degrades to an error state without the worker (`phase-…

**4. High — "#15 ∥ #6" understates the republish contention; #6 is in the same pinned lane as #5/#20/#21.**
`pipeline/site-localization-policy.json` `sourceFiles` pins `src/pages/doi-chuan/index.astro`, `src/pages/doi-chuan/[team].astro`, `src/components/pages/RecommendedDetail.astro`, `js/team-detail-navigation.js`, `src/pages/goi-y-doi-tu-kho/index.astro`, `js/roster-recommend-ui.js`, `js/roster-scan-state.js`. Each branch that edits one must run the "Publish lại bản dịch hiển thị" chain (`docs/deployment-guide.md:251-271`), producing a new generation dir + policy/handles pins → merge conflicts between parallel branches. Correction: one serial lane #5 → #20 → #6 → #21 → #23 (or #6 before #20; order is a choice), and a free set {#12, #16, #14, #15} that touches no pinned file (`js/lookup-ids.js`, `pipeline/lookup_route_handles.py`, `scripts/report-zh-gaps.mjs`, w…

**5. Medium — #12 A' does not break `production-release`, but removes post-merge CI on `main`.**
`mcp-worker.yml:141` `production-release` runs only on `workflow_dispatch` with `confirm_production == true`; `credential-free-release-gate` has no `if`, so it also runs on `schedule`. Dropping `push` is safe. Side effect: merge commits are untested until release day, where `production-release` runs `check:repository` before any mutation (`:167-168` precede upload) — safe but costs a 25-min cycle. Add to the plan: rebase each PR before merge, and run the gate on the final `main` SHA via `workflow_dispatch` with `confirm_production: false` before release day.

**6. Low — #16 gate in `npm run verify` also gates blog-publish deploys and the MCP release.**
`pages-deploy.yml:44` and `mcp-worker/scripts/check-repository.ts:43` both run `verify`. `node scripts/report-zh-gaps.mjs --check` currently passes in 0.2 s, so cost is nil; just be aware a stale `docs/zh-gaps.md` on `main` will fail an owner-triggered blog publish. Alternative: put it in the #12 pre-push hook / `npm run check` instead. User decided `verify` — trade-off noted.

**7. Low — #5 → #20 → #21 serialization is accurate; #20 → #21 is merge-order, not a dependency.**
Pinned files per finding 4. #20's coverage block reads the same roster the engine reads; whichever lands second rewires one input. #21 also edits `js/roster-scan-state.js`, which is in MCP `semanticFiles` → that PR must regenerate `workflow-build`. #5's prerequisite is met: `conflictedTeams` is on `main` (`js/team-recommend-engine.js:821,849`).

**8. Low — Release order D1 0011 → worker → MCP → Pages is correct; add a "no push between MCP and Pages" rule.**
`mcp-worker.yml:152-154` requires `production_sha == origin/main` HEAD; Pages always builds `main` HEAD. Write the `docs/deployment.md` record after both dispatches to keep "same SHA". MCP does not depend on Pages: release verification uses MCP fixtures (`mcp-worker/test/fixtures/release-verification.json`), and #15's `/tra-cuu/<group>/<slug>/` targets have been live since PR #9 (`git log`: Pages deployed at 957bb3d). D1 numbering 0011 is right: `0009`/`0010` are `community-worker/rollback/` scripts; `0008` is applied in production (`docs/deployment.md:35`).

**9. Low — #6 is larger than "a parallel item".**
PR #9 already shipped prerender, team/item JSON-LD, `/llms-full.txt` (`src/pages/llms-full.txt.ts`), so #6's remainder is season pages plus "drop `?season=`". `?season=` is wired into team-detail return links, the Tra cứu `cam-nang-link` (`tests-e2e/unified-lookup.spec.mjs:550`), legacy `/?season=…#team-chuan` redirect, and ~40 e2e assertions. Keep `?season=` → path redirect for old links; budget accordingly.

**10. Low — housekeeping.** Worktree `feat/dong-bo-kho-va-doi-cua-toi` is at 1fa81ab, behind `main` (#24/#25 republished generations) — rebase before phase 3. Open PR #26 (header login) edits `SiteLayout.astro` (pinned) and will ride any Pages deploy; merge it before the lane starts or after. Community-worker deploy is manual `npm run deploy` (`community-worker/package.json`), untouched by #12.

## Corrected route
#12 → #16 → #14 (freeze, no B) → #15 ∥ lane[#5 → #20 → #6 → #21 (worker PR: merge → D1 0011 → `npm run deploy` immediately) → #21 client → #23] → pre-release gate dispatch (`confirm_production: false`) → MCP release → Pages release → record docs → close issues.

## Assumptions
- #23 team records will persist book ids (issue §5 lists binh thư) — medium; if they store names only, #14A → #23 ordering is irrelevant.
- The owner is the only `requireRoot` user — high (PR #18 adds moderators, but `posts.ts` uses `requireRoot`).
- `git config core.hooksPath .githooks` resolves per worktree — [INFERENCE] from git docs, not tested.

## Verified vs inferred
Verified by code/CLI: all `file:line` citations above, issue bodies via `gh`, `--check` run result, ledger counts, books-dict uniqueness. Inferred: #23 schema contents, hooksPath behaviour in worktrees, that each republish conflict costs one rebase cycle [UNVERIFIED duration].

[You have received this identical output 3 times. Re-reading 'agent://FableVerifyBatch' will not change it — use a narrower selector (path:A-B), or proceed with the edit.]

[Some lines truncated to 768 chars. Use agent://FableVerifyBatch:raw:18-18 to read line 18 whole; cut lines run to line 21, each read the same way]