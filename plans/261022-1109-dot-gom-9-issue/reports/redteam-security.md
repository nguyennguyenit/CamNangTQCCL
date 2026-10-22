I found 8 problems in the plan: 3 High and 5 Medium. Most of them are security or privacy gaps around landing #21/#23, the production check, the pre-push hook and the MCP release check. I edited no files. The only thing I sent to production was three unauthenticated GET requests to `tqccl.com/api/*`, to see what each route returns today.

## Finding 1: Phase 10 never replays the snapshot's edits to files that are not pinned, including the sign-out privacy wipe and the noindex setting for `/doi-cua-toi/`
- **Severity:** High
- **Location:** Phase 10, section "Files to Create / Modify" (and "Bối cảnh")
- **Flaw:** Phase 10 covers only two kinds of file: new files (copied with `git checkout <snapshot> -- <path>`) and pinned files (edits re-applied by hand from the diff). The snapshot also edits files that are neither new nor pinned (not in `pipeline/site-localization-policy.json` `sourceFiles`, checked against the policy), and those edits are not listed anywhere:
  - `js/community-api.js`: `signOut()` deletes the cloud roster cache `tqccl.roster.cloud.v1` in a `finally` block, so it happens even when the sign-out call fails.
  - `src/lib/locale-routes.ts`: adds `/doi-cua-toi/` to `COMMUNITY_PATHS`, which makes the page noindex and keeps it out of the sitemap.
  - `js/community-auth.js`: the "Đội của tôi" menu entry.
  - `public/_headers`: cache headers for `/doi-cua-toi/*` and `/my-teams-source-index.json`.
  - `scripts/verify-astro-dist.mjs`: about 100 added lines that check the my-teams index and payload.
  - `pipeline/site_localization.py`: two localization tuples removed.
  - `src/lib/team-detail-pages.ts`.
  - Modified tests: `tests-js/pages-headers-contract.test.mjs`, `astro-dist-contract`, `roster-scan-state.test`, `beta-tools.spec`, `community-teams.spec`.

  Phase 9 also edits `js/community-api.js` and `scripts/verify-astro-dist.mjs`. So taking the snapshot copy of those files with `git checkout` would wipe phase 9's work.
- **Failure scenario:** The implementer follows the plan literally and these edits are lost. On a shared computer, user A signs out and the cloud roster cache stays in localStorage. `/doi-cua-toi/` is built without noindex and goes into `sitemap.xml`. The verifier that would catch both is part of the dropped `verify-astro-dist.mjs` edits, so `npm run verify` stays green. Phase 11 only checks noindex on production, after Pages has already been released. The other path is just as bad: someone copies those files wholesale from the snapshot and silently undoes phase 9's `PAGE_KEY_PATTERN` change and season-page verifier.
- **Evidence:**
  - `git -C <worktree> status --short` lists `M js/community-api.js`, `M js/community-auth.js`, `M public/_headers`, `M src/lib/locale-routes.ts`, `M scripts/verify-astro-dist.mjs`, `M pipeline/site_localization.py`, `M src/lib/team-detail-pages.ts`.
  - Worktree `js/community-api.js:271-283`: `ROSTER_CLOUD_KEY` and `localStorage.removeItem` inside `signOut`'s `finally`.
  - Worktree `src/lib/locale-routes.ts:19`: `COMMUNITY_PATHS = ['/chien-bao/', '/doi-cua-toi/', '/quan-tri/']`.
  - Policy check: `js/community-api.js`, `js/community-auth.js`, `public/_headers` and `src/lib/locale-routes.ts` all come back `False` for `sourceFiles`.
  - The same file is touched in phase 9 (it edits `js/community-api.js:11` for `PAGE_KEY_PATTERN`).
- **Suggested fix:** Add a third list to phase 10: tracked files that are modified but not pinned, each re-applied with a 3-way merge (`git diff 1fa81ab <snapshot> -- <file> | git apply -3`). Name all of the files above. Add an acceptance test that sign-out removes `tqccl.roster.cloud.v1`, and a dist check that `/doi-cua-toi/` is noindex and absent from `sitemap.xml`, both before merge.

## Finding 2: The production check in phase 4 handles a root admin's session cookie with curl, logs the result into committed docs, and leaves test data behind
- **Severity:** High
- **Location:** Phase 4, section "Tasks & Steps" 7.5 and 8
- **Flaw:** Step 7.5 says to `POST`/`GET /api/roster` "qua devtools hoặc `curl` kèm cookie phiên". Step 8 then records "kết quả bước 4–5" in `docs/deployment.md` and commits it to `main`.
  - The real Google account is almost certainly the owner, who is root through `ADMIN_EMAILS`.
  - Requests with no `Origin` header pass the worker's cross-site request check, so the cookie value alone is enough to act from anywhere.
  - Nothing in the plan says to sign out afterwards (which revokes the session), or to remove the test `box` record.
- **Failure scenario:** The cookie value ends up in shell history, in the agent transcript, or pasted into `docs/deployment.md` as "the command used". Anyone holding it has a live root session. They can ban or delete users, and publish blog posts, which triggers a Pages rebuild through `repository_dispatch`. The leftover `box` also counts toward the 20-box limit and will show up in the owner's "Đội của tôi" after phase 10.
- **Evidence:**
  - `community-worker/wrangler.jsonc:38`: `"ADMIN_EMAILS": "nguyennlt.ncc@gmail.com"`.
  - `community-worker/src/context.ts:57-59`: root role comes from `ADMIN_EMAILS`.
  - `community-worker/src/app.ts:58-60`: rejects only when an `origin` is present and untrusted, or when `sec-fetch-site` is `cross-site`.
  - `docs/community-worker.md:230`: what root can do when deleting a user.
  - `community-worker/src/routes/posts.ts:139-156`: publishing a post sends the deploy dispatch.
  - Worktree `community-worker/src/routes/roster.ts`: `ROSTER_CAPS = { box: 20, ... }`.
- **Suggested fix:**
  - Run the round trip as a same-origin `fetch` in the devtools console on `https://tqccl.com`. The session cookie is HttpOnly, so it never leaves the browser.
  - Or use a separate non-admin Google account.
  - Never put the cookie in `curl`.
  - Record only status codes and the record id.
  - Send a deleting write (tombstone) for the test box.
  - Sign out at the end and check that `/api/me` returns 401 afterwards.

## Finding 3: Once the `push` trigger is gone, direct pushes to `main` skip the secret scan and the exact gate Pages runs; the hook replaces neither
- **Severity:** High
- **Location:** Phase 2, section "Nội dung hook" (and "Files to Create / Modify")
- **Flaw:**
  - Today every push to `main` runs `check:repository` in CI. That includes `npm run check`, which contains `check:local-secrets`, plus `npm run build` and `npm run verify`.
  - Phase 2 deletes the `push` trigger. The hook it adds runs only `check:workflow-build`, `check:knowledge-bundle`, `typecheck`, the community-worker tests and Python unittest.
  - Branch protection is not available on this repo, so nothing forces changes through a PR.
  - The plan itself pushes straight to `main` (phase 4 step 8, phase 11 step 7).
  - The hook also runs against the working tree, not the commits being pushed.
- **Failure scenario:** A direct push that breaks `npm run verify` reaches `main`. For example, Tra cứu data changes and `docs/zh-gaps.md` is not regenerated; phase 3 makes that fail `verify`. The next blog publish then runs `pages-deploy.yml`, which fails on `npm run verify`, and the post never goes out. This breaks Goal 3. In the same way, a committed credential is only caught by the weekly scheduled run, after it is already on GitHub.
- **Evidence:**
  - `.github/workflows/mcp-worker.yml:47-70`: the `push` trigger being removed.
  - `mcp-worker/scripts/check-repository.ts:22-46`: runs `check`, `build`, `test:dist`, `verify`.
  - `mcp-worker/package.json:36`: `check` includes `check:local-secrets`.
  - `mcp-worker/scripts/check-local-secret-files.ts:21-26`: the secret patterns.
  - `.github/workflows/pages-deploy.yml:49-50`: `npm run build` then `npm run verify`.
  - `gh api .../branches/main/protection` returns 403 ("Upgrade to GitHub Pro").
- **Suggested fix:**
  - Always run `cd mcp-worker && npm run --silent check:local-secrets` in the hook.
  - When the remote ref is `refs/heads/main`, also run `npm run build && npm run verify`.
  - Refuse to run with a dirty tree (`git diff --quiet HEAD`), or check out the pushed SHA in a temporary worktree.
  - Add matching cases to `tests-js/pre-push-hook.test.mjs`.

## Finding 4: The secret check in phase 1 does not look at untracked files, ignores the existing scanner, and two `.gitignore` gaps remain
- **Severity:** Medium
- **Location:** Phase 1, section "Tasks & Steps" step 2
- **Flaw:**
  - Step 2 checks `git diff` plus "các file mới" by eye. `git diff` does not show untracked files, and 142 of the 272 paths `git add -A` will stage are untracked.
  - Only `community-worker/.dev.vars` is named. Root `.gitignore` and `mcp-worker/` have no `.dev.vars` or `.env` rule, so `git add -A` would stage them if they exist.
  - The repo's own scanner `check:local-secrets` covers exactly the set `add -A` stages (cached plus others, excluding ignored), but the plan does not use it.
  - That scanner's patterns also miss the credential types this project actually uses: Google OAuth client secrets (`GOCSPX-…`), Cloudflare API tokens, and Better Auth or `AI_CONFIG_SECRET` values.
- **Failure scenario:** A `mcp-worker/.dev.vars` or root `.env` created during local work gets committed and pushed in the snapshot, unseen, because the reviewer read `git diff`.
- **Evidence:**
  - `git check-ignore -v` matches only `worker/.gitignore:2` and `community-worker/.gitignore:1`; `mcp-worker/.dev.vars`, `.dev.vars` and `.env` are not ignored.
  - `git -C <worktree> add -A -n | wc -l` gives 272.
  - `mcp-worker/scripts/check-local-secret-files.ts:21-26` (patterns) and `:75-87` (file listing).
  - `docs/community-worker.md:27-34`: the secret types in use.
- **Suggested fix:**
  - Review the output of `git -C <worktree> add -A -n` line by line.
  - Fail if any path matches `(^|/)\.(dev\.vars|env)`.
  - Run `check:local-secrets` inside the worktree (it needs `npm ci` there).
  - Add a grep for `GOCSPX-|BETTER_AUTH_SECRET=\S|CLOUDFLARE_API_TOKEN=\S`.
  - Put `.dev.vars` and `.env` in the root `.gitignore`.

## Finding 5: The file counts in phase 1 are wrong, so its own verification is guaranteed to fail
- **Severity:** Medium
- **Location:** Phase 1, sections "Bối cảnh", "Tasks & Steps" step 1, and "Verification" bullet 3
- **Flaw:** 171 is the line count of `status --short`, which collapses untracked directories into one line. The commit will actually contain 272 paths: 37 modified, 93 deleted and 142 untracked, including the 93-file new generation `7949…`. The plan says 36 modified, 94 deleted and about 45 new. The check "`git show --stat HEAD | tail -1` khớp số file ở bước 1" will report 272, not 171.
- **Failure scenario:** The check fails on a correct snapshot. An agent may then "fix" it by staging fewer files, and the snapshot that is supposed to preserve the work ends up incomplete.
- **Evidence:** `git status --short | wc -l` = 171; `git status --short --untracked-files=all` = 272 (142 `??`, 93 `D`, 37 `M`); the 37th `M` is `src/data/recommended-reference/current.json`.
- **Suggested fix:** Record `git add -A -n | wc -l` in step 1. Compare it with `git show --stat --format= HEAD | tail -1`. Correct the counts in the description.

## Finding 6: "Season pages have no comments" (phase 9) is enforced only in the browser; the worker still accepts writes, and fixing that needs a second worker release
- **Severity:** Medium
- **Location:** Phase 9, section "Thiết kế", the Comment bullet ("kiểm phía worker: `community-worker` có cùng mẫu không")
- **Flaw:**
  - The plan leaves open a question the code already answers: the worker's `PAGE_KEY_RE` accepts any `/doi-chuan/<slug>/`, so it accepts `/doi-chuan/pk-s24/`.
  - Both options in the plan are client-only: change `PAGE_KEY_PATTERN`, or don't mount the comment box.
  - Phase 9 runs after the single worker release in phase 4. Tightening the server then would be a second release, against Goal 2, and phase 9 has no "dừng và hỏi" step for that case.
  - The leniency itself is not new: the server already accepts any slug. The new problem is that the decision can't be enforced and the case is unplanned.
- **Failure scenario:** Anyone can `POST /api/comments` or `/api/reports` with page `/doi-chuan/pk-s24/`. Those rows are invisible on the public page, but they show up in admin and user views linking to a real page that never displays them. If the implementer instead tightens the worker inside phase 9, there is an unplanned production worker deploy mid-batch.
- **Evidence:**
  - `community-worker/src/validate.ts:6-7` (`PAGE_KEY_RE`) and `:24-28` (`parsePageKey`).
  - `community-worker/src/routes/comments.ts:93` (insert) and `:161` (admin list exposes `page`).
  - `community-worker/src/routes/reports.ts:190`.
  - `js/community-api.js:11` and `:150-154`.
  - `js/community-page.js:19` and `:24-27`.
- **Suggested fix:** Decide before phase 4 ships. Either put a reject list for season codes into the phase 4 worker PR, built from the codes in the pinned `seasons.json`. Or accept, in writing, that the server stays lenient and is out of scope. Either way, add a stop-and-ask to phase 9 for any change to the worker.

## Finding 7: The MCP check in phase 11 needs a credential this machine does not have, and the plan does not say how to get it safely
- **Severity:** Medium
- **Location:** Phase 11, section "Tasks & Steps" step 6, the MCP `tqccl_get_entity` bullet (also a Success Criterion in plan.md)
- **Flaw:** The step requires a live authenticated `tqccl_get_entity` call. The last release record says no such call was possible from this machine because there is no managed bearer token. The plan gives no source for the credential and no safe way to pass it.
- **Failure scenario:** The operator skips the check while still claiming the success criterion, or pastes the bearer into a `curl -H "Authorization: Bearer …"` command. That puts it in the command line and shell history, against the runbook.
- **Evidence:**
  - `docs/deployment.md:49`: "No authenticated live `tqccl_get_entity` call was made from this machine (no managed bearer)."
  - `docs/deployment-guide.md:182`: the bearer comes from `TQCCL_MCP_BEARER_CURRENT`, and secrets must not go in argv, query strings or artifacts.
- **Suggested fix:** Use the precedent in `docs/deployment.md:49`. Run the local `mcp-worker` CLI on the released SHA, check that its release ID matches the workflow's, and read `pagePath` locally. If a live call is required, use a script that reads the bearer from `TQCCL_MCP_BEARER_CURRENT` only, and log status codes only.

## Finding 8: Phase 4's "write the failing test first" items are already covered by existing tests, so they can't fail first and add no coverage
- **Severity:** Medium
- **Location:** Phase 4, section "TDD", items 1–3
- **Flaw:** Unauthenticated → 401, the per-user rate limit, and the batch limit (201 records → 400; worst-case 200-record batch under the statement ceiling) are all already tested. Writing them "red first" is impossible. The real open item is the D1 plan's actual per-request statement limit, and that is a documentation lookup, not a test.
- **Failure scenario:** The gate looks thorough but adds nothing. A reviewer reads items 1–3 as new security coverage when the risk is unchanged.
- **Evidence:**
  - Worktree `community-worker/test/roster.test.ts:154` (test 1: 401), `:604` (test 30: 600/1200 per hour, per user), `:631` (M2: max batch under the statement ceiling).
  - Worktree `community-worker/src/routes/roster.ts:255` (more than 200 records → 400 `invalid_records`).
  - `rg -c "^\s*it\(" roster.test.ts` = 37.
- **Suggested fix:** Replace items 1–3 with what is actually missing: a test that `app.ts` mounts the route, if one doesn't already exist, and a recorded number for the real D1 plan limit (step 5). Production has no `/api/roster` today (`curl https://tqccl.com/api/roster` returns 404 `not_found`), so the 401 check after deploy really does show the new worker is live.

## Fact-check summary

Every phase has at least one FAILED or UNVERIFIED row. Phases 1, 3, 6, 7 and 8 have 15 or more resolved claims (verified plus failed). Phases 2, 4, 5, 9, 10 and 11 fall short of that, and phase 9 has only 13.

| Phase | Claims sampled | VERIFIED | FAILED | UNVERIFIED | Notable failures |
|---|---|---|---|---|---|
| plan.md | 15 | 13 | 0 | 2 | Unverified: "40/40 đội `sourceSeasonIds: null`", PR #26 scope |
| 1 | 16 | 13 | 3 | 0 | 171 vs 272 paths; 94 deleted (really 93); "~45 new" leaves out the 93-file `7949…` generation |
| 2 | 15 | 14 | 0 | 1 | Unverified: timing numbers. Verified: `mcp-worker.yml:3-24/25-46/47-70/75-118/121`, `generate-knowledge-bundle.ts:22`, `README.md:39,55`, no `.githooks` |
| 3 | 15 | 15 | 0 | 0 | `report-zh-gaps.mjs:5-6,15,99-108`, `package.json:15`, `seo-dist-contract.test.mjs:11,343-346`, doc lines all match |
| 4 | 16 | 13 | 2 | 1 | `docs/deployment.md:33` is really `:35`; "TDD viết đỏ trước" items already exist; D1 limit unverified (correctly flagged by the plan) |
| 5 | 18 | 13 | 2 | 3 | Sort by `viet` is at `build_books_dict.py:90`, not `:88`; `analyze-map.js:59` is `entityId`, not `recordEntityId`. Verified: 68 books, 0 `id`, ledger 68 handles with slug equal to the id suffix, `retired.books` empty |
| 6 | 16 | 15 | 0 | 1 | Unverified: "1028 entity routes / 90 specials" (ledger 938 is verified) |
| 7 | 16 | 15 | 1 | 0 | `L(vi, zh)` is at `js/i18n.js:39`, not `:34` |
| 8 | 15 | 15 | 0 | 0 | `roster-season-candidates.js:55,114`, `team-recommend-engine.js:183,709`, `SOURCE_TIER_ORDER :190` match |
| 9 | 16 | 12 | 1 | 3 | `src/pages/zh/doi-chuan/[team].astro` is listed as "(ghim)" but is not pinned. The "kiểm phía worker" check it leaves open is answered by `validate.ts:6-7` (Finding 6) |
| 10 | 15 | 13 | 1 | 1 | The file list leaves out 7+ modified non-pinned files (Finding 1). `bookLookupId` at `roster-picker.js:13,69` and `my-teams.js:12,23` is verified |
| 11 | 15 | 12 | 2 | 1 | `mcp-worker.yml:152-154` is really `:136-142`; `docs/deployment.md:25` is really `:29`; the live MCP check can't be done here (Finding 7) |

The phase 1 push itself carries little exposure: the repo is private (`gh repo view`: `PRIVATE`), and Pages is a direct upload with no Git connection (`docs/community-worker.md:79`), so pushing a branch creates no public preview build.