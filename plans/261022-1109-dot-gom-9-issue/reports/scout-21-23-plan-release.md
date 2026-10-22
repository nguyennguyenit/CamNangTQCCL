Branch `feat/dong-bo-kho-va-doi-cua-toi` is already built, but only as uncommitted work on a stale base. The plan needs edits in `plan.md` and in phases 01, 02, 03, 05, 06 and 07; phase 04 only if an editor catalog function is touched. I made no edits to the repo. Everything below was read from the repo files except what is marked [UNVERIFIED].

## 1. Branch and worktree state

- The worktree is `/Users/plateau/Project/worktrees/CamNangTQCCL-dong-bo-kho-va-doi-cua-toi`. Its tip `1fa81ab` (PR #22 merge) equals the merge-base with `main`, so `git log main..branch` is empty.
- `main` is 5 commits ahead: `5b6014a`, `957bb3d` (PR #25) and others.
- All the work is uncommitted: 36 tracked files modified, 94 tracked `src/data/recommended-reference/74b0…` files deleted, plus about 45 untracked files.
- **Backend:** `community-worker/migrations/0011_roster.sql` (18 lines), `community-worker/src/roster-schema.ts`, `community-worker/src/routes/roster.ts`, `community-worker/test/roster.test.ts`, edits to `community-worker/src/app.ts` and `community-worker/src/ratelimit.ts`.
- **Client:** `js/roster-{sync,cloud-store,picker,id-resolve,scan-writer}.js`, `js/my-teams*.js`, `src/pages/doi-cua-toi/`, `src/pages/zh/doi-cua-toi/`, `src/pages/my-teams-source-index.json.ts`, `src/lib/my-teams-source-index.ts`, `MyTeamsPage.astro`, many `tests-js/*` and `tests-e2e/*`.
- **Docs:** new `docs/roster-sync.md`; edits to `docs/deployment-guide.md`, `docs/community-worker.md` and the changelog.
- **Journal:** `plans/journals/261022-cook-dong-bo-kho-doi-cua-toi.md` says phases 1–7 are done, phase 1 schema was approved by the user, and review fixes (2 High, 5 Medium, 8 Low) are applied. What remains is the production rollout and one open issue about D1 limits (see 4).
- **Plan files:** `plans/261021-0632-dong-bo-kho-va-doi-cua-toi/` is untracked on `main`. Every phase file still says `status: pending` and `branch: main` (`plan.md:4,8`), so the plan no longer matches reality.
- **Consequence:** the 94 deleted files and the new `recommended-reference/7949…` generation are a publication snapshot of the old base. #14, #5, #20 and #6 will each re-publish translations first, so this work has to be replayed on top of them. It cannot be merged as-is.
- **Local state:** this checkout (`main`) is clean except for the untracked plans/journals. The `feat/dong-bo…` remote branch does not exist; the worktree branch is local only.
- **Worktree edits to pinned files:** it modifies `js/roster-scan-state.js`, which is both a policy-pinned source file and an MCP `semanticFiles` entry (`mcp-worker/workflow-source-manifest.json:19`). The other pinned files it touches are `js/analyze.js`, `js/detail-actions.js`, `js/khaihoang-detail.js`, `js/roster-recommend-ui.js`, `js/team-detail.js`, `KhaiHoangDetail.astro`, `LegacyDetail.astro` and `RecommendedDetail.astro`. `js/roster-recommend-ui.js` and `js/roster-scan-state.js` therefore also need an MCP workflow-build regeneration (`mcp-worker/src/generated/workflow-build.ts`).

## 2. D1 migration numbering

- `community-worker/migrations/` on `main` holds `0001`–`0006` and `0008_community_teams.sql`. `0007` is deliberately missing.
- Rollback scripts live in `community-worker/rollback/` (not `migrations/rollback/`): `0007_drop_user_block_triggers.sql`, `0009_drop_community_team_triggers.sql`, `0010_restore_community_team_triggers.sql`. They never run automatically.
- `0008` is already applied on production. `docs/deployment.md:33` records it (applied 2026-10-21, bookmark `00000544-…`).
- So `0011_roster.sql` is correct and is the next free number. Phase 01 `:27` and `plan.md:47` still treat the `feat/doi-cong-dong` plan as parallel and unmerged. That is stale; PR #24 is merged.
- The test harness fix the plan treats as a prerequisite (Astra H8) is already on `main`: `community-worker/test/fakes.ts:34,39,45` has `runSync`. Phase 02 `:21` and Risk text can drop it.

## 3. Release runbook facts

- **Pages workflow:** `pages-deploy.yml:6-14` triggers on `repository_dispatch: blog-publish` and `workflow_dispatch` only, and always builds `ref: main`.
- **Concurrency:** `pages-deploy.yml:17-19` sets `group: pages-deploy` with `cancel-in-progress: true`, so a later dispatch cancels an earlier one. The final release must be a single manual dispatch, and a blog publish during it can cancel it.
- **Gates in that run:** it runs `npm run build` and `npm run verify` (`pages-deploy.yml:49-50`), not Playwright.
- **Pages deploy command:** `wrangler pages deploy dist --project-name tqccl --branch main --commit-hash "$(git rev-parse HEAD)"` (`pages-deploy.yml:55-58`).
- **Why main must stay deployable:** `docs/community-worker.md:254` says Pages rebuilds from `main` whenever `blog-publish` fires.
- **Production API path:** `functions/api/[[path]].ts` proxies same-origin `/api/*` to the Worker, so `/api/roster` is checked as `https://tqccl.com/api/roster`.
- **Previous community releases:** the `docs/deployment.md:31-37` record has Worker version, bookmark and live checks for the PR #24 rollout. It was done in the order migration → Worker → push `main` → manual `pages-deploy.yml` (`docs/community-worker.md:353`).
- **Rehearsal precedent:** `docs/deployment.md:33` says "Rehearsed on local workerd D1 + R2 with seeded sessions".
- **Migration rehearsal commands** from `community-worker/package.json:11-12` and `docs/community-worker.md:138`:
  - `cd community-worker && npm run db:migrate:local` runs `wrangler d1 migrations apply tqccl-community --local`.
  - `npm run db:migrate:remote` applies to production.
  - Before remote, take a bookmark with `npx wrangler d1 time-travel info tqccl-community`.
  - The `select sqlite_version()` precheck at `docs/community-worker.md:353` fails on production D1 (`docs/deployment.md:33`). Use a `log(100)` check or skip it.
  - Local smoke uses `wrangler dev --port 8788`, a seeded Better Auth session, and `wrangler pages dev dist --service COMMUNITY=tqccl-community` (`plans/…/phase-03:59`).
- **Rollback wording:** `docs/community-worker.md:357` reads "Revert commit trên `main` **trước** …, chạy lại `pages-deploy.yml`, rồi `npx wrangler rollback`". `docs/deployment.md:25` says "revert `main` first, then rerun `pages-deploy.yml`".
- **MCP release:** the gate is `cd mcp-worker && npm ci && … npm run check && npm run check:repository` (`docs/deployment-guide.md:168-175`). The workflow runs only on manual dispatch from `main`, with a full 40-char SHA matching `HEAD`, `GITHUB_SHA` and `origin/main` (`deployment-guide.md:179`). `docs/deployment.md:41-49` records the last release as run `39652210255` (`957bb3d`), with Worker version `93d02cc5…` as a rollback target.
- **Pages promotion checks:** known-good deployment ID recorded before preview, preview header checks, then post-promotion `POST /analyze` and CORS (`deployment-guide.md:129-141`).

## 4. Exact edit list

### `plan.md`
- Frontmatter `:4,8`: `status` is no longer `pending` and `branch: main` is wrong. Set the status to match the implemented worktree and set `branch: feat/dong-bo-kho-va-doi-cua-toi`.
- Phase table `:37-45`: phase 7 becomes "Docs + Pages cuối đợt". Add a column or note marking phase 2 as "worker release".
- `:47`: replace the stale "plan song song giữ 0008–0010" sentence. State that `0008`–`0010` are on `main` and `0011` is next. Add that phases 3–6 are replayed after #14→#5→#20→#6 because of translation re-publishing.
- Mermaid `:49-57`: add a "Worker release" node between P2 and P3, and make P7 "docs + Pages".
- Add a **Worker release gate** section. The gate is: phase 1 schema approved, payload size measurement covering the #23 converters done, `cd community-worker && npx vitest run && npx tsc --noEmit` green, `npm run db:migrate:local` rehearsal passed, bookmark taken, then `db:migrate:remote`, then `wrangler deploy`. Production check is `GET https://tqccl.com/api/roster` unauthenticated → 401, plus one real Google login with a write/read round trip (`docs/community-worker.md:155-157` says test and seeded sessions don't prove real OAuth or production D1). The client (phases 3–6) merges to `main` only after this passes.
- Success Criteria `:89-90`: change "Docs rollout có thứ tự D1 → Worker → Pages" to reflect the two release events. Add the real Google login check.
- Add a note that `blog-publish` can build `main` at any time, so every PR that merges must be deployable.
- Add to Whole-Plan Consistency Sweep that `books` are validated by regex and id catalog, not derived from names (see book ids below).

### `phase-01-schema-contract.md`
- Header and Goal `:12-16`: add that the schema approval gates the worker release.
- `:27`: delete "nếu chưa merge …" logic; `0011` is final.
- `:91` (`books: []`) and `:107`: add a book id contract. Stored `book:<slug>` ids are frozen by #14. The id comes from the frozen ledger map, never `bookLookupId` on a Vietnamese name. Server validation stays at `^book:[a-z0-9][a-z0-9-]*$` (`community-worker/src/roster-schema.ts:35`). The client regex is at `js/my-teams-model.js:33`.
- Task 1 `:182`: payload measurement must run real data through the #23 converters, not just synthetic worst cases. Use the Recommended, legacy and Khai hoang data plus the Analyze path. The journal says the notes limit was lowered from 2400 to 2000 B and bytes are counted after JSON escape; carry that in.
- Add the open D1 limit: 200 records per batch and 601 D1 statements per request, still to be checked against the real D1 plan (journal "Còn lại").

### `phase-02-worker-roster-route.md`
- Drop the prerequisite at `:21` (H8 done, `fakes.ts:34-45`).
- `:18`: `0011_roster.sql` already exists in the worktree; the phase becomes "land + release". Cherry-pick, not rewrite.
- Verification `:81`: keep `npm run db:migrate:local`, and drop "kể cả khi `0008` có hoặc chưa" (`0008` is applied).
- Add the release subsection: the Worker release gate, the order migration → Worker, rate-limit rules, the production unauthenticated 401 check and one real Google login. Hand the actual migration and deploy to the user (stop-and-ask).
- Phase 2 must not edit any pinned file, so it can merge without a re-publish.

### `phase-03` to `phase-06`
- Add to each: "client mới chỉ vào `main` sau khi worker đã chạy trên production (brief constraint)".
- `phase-03:59` (smoke): keep as local smoke. Real Google login happens at the worker gate, not here.
- `phase-03:26`, `phase-05:36`, `phase-06:36`: every pinned-file edit repeats the "Publish lại bản dịch hiển thị" chain (`docs/deployment-guide.md:251-271`). Rebase onto `main` first because of the #14→#5→#20→#6 chain.
- `phase-04:20,37` and `phase-05:19-24`: books must be read through the post-#14 frozen mapping. Today `js/roster-picker.js:13,69` and `js/my-teams.js:12,23` call `bookLookupId` from `js/lookup-ids.js`, which slugs the Vietnamese name. After a book is renamed, that no longer matches ids stored in saved teams.
- Rename test: a book renamed in the dictionary must still resolve a saved team's `book:` id in the picker, the editor and the Soi đội label.
- Add `js/roster-scan-state.js` MCP impact to phase 3 (see 1): after merging it, regenerate `mcp-worker/src/generated/workflow-build.ts` on merged code, as for #15.

### `phase-07-rollout-docs.md`
- Retitle and rewrite the goal as docs plus the final Pages release only.
- `:27-29` Rollout order: remove steps 1–2 (D1 and Worker move to phase 2). Keep only the final Pages step, with the shared end-of-batch order gate (check head SHA) → MCP → Pages. Pages is a manual `workflow_dispatch`, one run, with `main` unchanged until both are done. Concurrency cancels runs (`pages-deploy.yml:17-19`), so avoid a `blog-publish` dispatch in that window.
- `:27` Pages checks stay: `/goi-y-doi-tu-kho/` guest behaviour as before, login asks to merge, `/doi-cua-toi/` noindex, `/my-teams-source-index.json` JSON, plus the preview header and canary steps in `deployment-guide.md:129-141`.
- Rollback `:32-34`: add the main revert. The order is revert `main` first so a later `blog-publish` doesn't rebuild the new frontend, then rerun `pages-deploy.yml` (or promote the known-good deployment), then Worker rollback if needed. Pages and Worker must roll back together (`docs/community-worker.md:357`, `docs/deployment.md:25`). Keep "không xóa bảng D1".
- `:36-37` reword: the real Google login check moves to phase 2; here the final Pages verification only repeats `/api/roster` through the proxy.
- Files list `:17-22`: `docs/deployment.md` (not just `docs/deployment-guide.md`) must get the Latest Community Worker Deploy entry in phase 2 and the Pages entry at the end. The worktree already edits `docs/deployment-guide.md`, `docs/community-worker.md`, `docs/codebase-summary.md` and the changelog; reconcile those texts against the new phase split.

## 5. Tests and commands

- **Community worker:** `cd community-worker && npx vitest run && npx tsc --noEmit`. Extend `community-worker/test/roster.test.ts` (31 cases in the matrix, e.g. LWW, soft delete, box/group deletion, caps, bytes) and `test/recruit.test.ts` as regression. Add an `app.ts` mount test and a `ratelimit.ts` rule check.
- **Site:** `npm run check`, `npm run build`, `npm run verify`, `npm run test:dist`, `npm run test:node`. Pinned-file edits additionally need `python3 -m pipeline.site_localization …` and `python3 -m pipeline.team_route_handles --check`.
- **MCP:** `cd mcp-worker && npm run check`, then `npm run check:repository`.
- **Plan checks:** failing-first tests that catch consumer-visible bugs.
  - Worker: a batch of 201 records or 601 statements against the real D1 limits; 0011 applies on a database that has `0008` and the rollback scripts untouched.
  - Book rename: saved team with `book:<old-slug>` still resolves after the dictionary renames the book (picker, editor, Soi đội, MCP).
  - Release gate: unauthenticated `/api/roster` returns 401 through the Pages proxy.
  - Client order: a client PR built on `main` before the Worker exists must not call `/api/roster` unauthenticated or while the Worker is absent; sync must degrade to local.
  - Rollback: old client with Worker `/api/roster` removed (the new client must keep the cloud cache read-only).

## 6. Risks and traps

- **Replay, not merge:** the worktree's translation generation (deleted `74b0…` files, new `7949…`) conflicts with #14, #5, #20 and #6 re-publishing. Phases 3–6 must be replayed on top.
- **Stale docs steps:** `docs/community-worker.md:353` tells you to check `sqlite_version()`, which production D1 refuses (`docs/deployment.md:33`).
- **Hidden auto-deploy:** `blog-publish` rebuilds from `main` at any moment, not only on manual dispatch. This is why "main always deployable" is an invariant, and why the worker has to be live before the client lands.
- **Concurrency cancel:** the final Pages dispatch can be cancelled by a blog publish (`pages-deploy.yml:17-19`).
- **MCP impact:** `js/roster-scan-state.js` is in `semanticFiles`; so is `js/lookup-ids.js` (`workflow-source-manifest.json:16`), which #14 will change. Either change forces a `workflow-build.ts` regeneration. The new `roster-*` and `my-teams-*` files are not in `semanticFiles` [no grep match].
- **Not in the brief:** the real-data measurement (a team's `teamId` contains Chinese characters in 67 of 1,366 cases, per the journal, so `override` ids and `source.key` must be hashed or ASCII). Phase 01 and 02 need to say so.
- **Not in the brief:** the D1 batch size (200 records / 601 statements per request) is unchecked against the real plan [UNVERIFIED].
- **[UNVERIFIED]:** I did not run vitest, tsc or the local migration, and I did not inspect `0011_roster.sql` content or phases 03–06 line by line, only the lines named above. I did not check `mcp-worker/src/generated/workflow-build.ts` or whether the new files are in `PUBLIC_ARTIFACTS`.