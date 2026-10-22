## Finding 1: Nothing checks that `main` builds after a merge, so the first failed build is a blog deploy and nobody is told
- **Severity:** High
- **Location:** plan.md "Lanes và ràng buộc thứ tự" → "Invariant toàn đợt"; Phase 2 "Files to Create / Modify" (remove `push`) and "Nội dung hook"; Phase 3 "Risks" ("Chặn bằng `verify` trong CI của PR").
- **Flaw:** The invariant "every PR merged into `main` passes `npm run build && npm run verify`" has no enforcement after merge:
  - `main` has no branch protection. `gh api repos/{owner}/{repo}/branches/main` returns `protected:false`, `required_status_checks.enforcement_level:"off"`. So a PR's CI can be green against an old base and still be merged.
  - Phase 2 removes the only post-merge run, the `push` trigger.
  - The pre-push hook never runs `build`/`verify`. It also never runs for merges done on GitHub. It checks the working tree on disk, not the commits being pushed.
  - Phase 3, labelled a "free lane" PR that can merge at any time, changes `npm run verify` itself. That is the gate every serial PR and every blog deploy runs.

  After this, the first time anyone builds the merged tip is the next blog publish.
- **Failure scenario:**
  1. The phase 5 PR goes green against base B. Phase 3 then merges and adds `report-zh-gaps --check` to `verify`. Phase 5 merges without re-running CI. [INFERENCE: if the `id`/`formerViet` fields change any book profile, `docs/zh-gaps.md` goes stale and `main` turns red.]
  2. Root unpublishes a post (for example a takedown). `pages-deploy` fails at `npm run verify`, so the post stays live on the static site.
  3. The admin UI still shows the deploy as OK. `triggerDeploy` only reports whether GitHub accepted the dispatch, not whether the workflow succeeded.
  4. Every later publish fails the same way until someone happens to open Actions.
- **Evidence:**
  - `.github/workflows/pages-deploy.yml:2,7-10,28-30,45-46`
  - `community-worker/src/routes/posts.ts:156`: `resp.ok ? { ok: true ...}` refers to the dispatch call only.
  - `.github/workflows/mcp-worker.yml:47-70`: the `push` trigger being removed.
  - `mcp-worker/scripts/check-repository.ts:23-48`: `verify` runs only inside this PR/dispatch gate.
  - `package.json:15`: `verify`.
  - `mcp-worker/scripts/generate-workflow-build.ts:166-180`: hashes files from disk, i.e. the working tree.
- **Suggested fix:** Add a per-phase merge step:
  1. Run `gh pr update-branch` on the PR and wait for CI to go green again on the updated head before merging. Alternatively, turn on "require branches up to date" for the existing `credential-free-release-gate` check. Neither re-adds a `push` trigger.
  2. Right after each merge, run `npm run build && npm run verify` on the exact merged SHA from a clean checkout. Record the result in the PR.
  3. During the batch, the operator checks the `pages-deploy` run status after every publish or unpublish.
  4. Treat phase 3 as a dependency of phases 5–10: rebase onto it before their CI runs.

## Finding 2: Phase 10's replay rules skip most of the snapshot's infrastructure changes, including the localization policy
- **Severity:** High
- **Location:** Phase 10, "Files to Create / Modify" (lines 27-29)
- **Flaw:** Phase 10 gives only three instructions:
  - take new files with `git checkout <snapshot> -- <path>`;
  - re-apply pinned files by hand;
  - "Không lấy … `pipeline/site-localization-policy.json` … sinh lại bằng chuỗi publish" (don't take the policy file from the snapshot; regenerate it with the publish chain).

  The snapshot also changes many files that are not pinned, and the plan says nothing about them. Separately, the snapshot's policy change is structural, not just re-pinned hashes. The publish chain only re-pins hashes of files already listed in `sourceFiles` and updates `baseline.notes`. It never adds entrypoints or new source files.
- **Failure scenario (either way it breaks):**
  - **Path A — the developer takes those files whole from the snapshot.** `git checkout <snapshot> -- css/styles.css scripts/verify-astro-dist.mjs js/community-api.js`:
    - wipes the CSS from phases 7 and 8;
    - wipes phase 9's sitemap/allowlist changes in the verifier;
    - wipes phase 9's `PAGE_KEY_PATTERN` change.

    Wiping phase 9's verifier changes turns `verify` red. Lost CSS passes CI and ships broken styling.
  - **Path B — the developer only follows the listed rules.**
    - `/doi-cua-toi/` and `/my-teams-source-index.json` are missing from the verifier allowlist and from `_headers`, so `verify` and `test:dist` go red.
    - `js/roster-picker.js` never becomes a localization entrypoint, so its UI strings skip localization review.
    - The two `ui:roster/setup-*` obligations stay registered after their literals are gone from `roster-recommend-ui.js`.
- **Evidence:**
  - Snapshot diff from base `1fa81ab`: `css/styles.css` +377 lines, `scripts/verify-astro-dist.mjs` +97/−3, `src/lib/team-detail-pages.ts` +55/−1.
  - Snapshot files, all under `/Users/plateau/Project/worktrees/CamNangTQCCL-dong-bo-kho-va-doi-cua-toi/`:
    - `scripts/verify-astro-dist.mjs:85,235`
    - `public/_headers:41,74`
    - `js/community-api.js:272-281`: clears the roster cache on sign-out.
    - `pipeline/site-localization-policy.json:700`: new entrypoint `js/roster-picker.js`.
    - `pipeline/site-localization-policy.json:788`: new `sourceFiles` entry.
  - Main: `pipeline/site_localization.py:822-823`, the obligations the snapshot deletes.
  - Main: `src/lib/locale-routes.ts:19`, where the snapshot adds `/doi-cua-toi/`.
  - Main: `docs/deployment-guide.md:254-256`, which says the chain only re-pins hashes and `baseline.notes`.
  - `reports/scout-21-23-plan-release.md` mentions none of these files.
- **Suggested fix:**
  - List every modified file from `git diff --name-status 1fa81ab <snapshot>` in phase 10, each tagged "replay by diff".
  - Explicitly port the policy's structural edits (entrypoints and `sourceFiles` entries) and the `site_localization.py` obligation removals by hand, before running the chain.
  - Forbid `git checkout <snapshot> --` for any file that already exists on `main`.

## Finding 3: The rollback plan can't be carried out, and the rollback target is unknown once blog deploys have shipped part of the batch
- **Severity:** High
- **Location:** Phase 11, "Rollback" (line 47) and step 5 ("ghi deployment ID known-good hiện tại", record the current known-good deployment ID); plan.md "Invariant toàn đợt" ("Pages có thể bị blog deploy giữa đợt", Pages may be deployed by blog posts mid-batch).
- **Flaw:** Every blog publish deploys whatever is on `main`, so phases 5–10 reach production one by one. Nothing records which Pages deployment ID matches which SHA until phase 11. Phase 11 step 5 then records "the current deployment" as known-good, but by then it is usually already the untested batch tip.

  "Revert `main` first" also doesn't work for a single serial PR. Each of phases 5→10 replaces the single pinned generation and edits the same one-line pin files. Reverting a middle PR (say #5) conflicts on `data/website-display.json`, `pipeline/team-route-handles.json`, the policy, and `js/roster-recommend-ui.js`, which phases 8 and 10 also changed. Even after resolving, the result is a new combination of pinned sources, so it needs a fresh publish chain. That is a forward-fix taking hours, not a revert. Meanwhile any blog publish redeploys the bad `main`.
- **Failure scenario:**
  1. A bug in the phase 7 conflict section is found after a blog deploy that happened during phase 9.
  2. The operator opens `docs/deployment.md`. The newest rollback target there is `ec3c9558` (`957bb3d`), from before the batch.
  3. Promoting it in the dashboard rolls back the season pages and roster client too.
  4. The next publish then redeploys the bad `main`, because `main` was never reverted.
  5. `git revert` of the phase 7 merge stops on conflicts.
- **Evidence:**
  - `data/website-display.json:1`: the whole pin is a single line.
  - `pipeline/team-route-handles.json:2`: `generationId`.
  - `src/data/recommended-reference/`: only one generation directory plus `current.json`.
  - `docs/deployment-guide.md:251-271`
  - `docs/deployment.md:26`: current rollback targets.
  - `docs/community-worker.md:357`: "Revert commit trên `main` **trước**" (revert the commit on `main` first).
  - `.github/workflows/pages-deploy.yml:7-10`
- **Suggested fix:**
  - Before phase 5 merges, record `main` SHA `5b6014a` and the Pages deployment ID as the batch's pre-batch rollback target.
  - After each serial merge, record the merged SHA.
  - Define the rollback unit for the serial lane: revert the merges in reverse order back to a recorded SHA, or forward-fix with a new publish chain. Don't plan on reverting a single middle PR.
  - Root must not publish blog posts while a rollback is in progress.

## Finding 4: Phase 11's Pages steps don't match the workflow, which deploys straight to production with no preview and no SHA input
- **Severity:** Medium
- **Location:** Phase 11, "Bối cảnh" (line 20) and step 5 (line 29)
- **Flaw:** Step 5 says "`workflow_dispatch` `pages-deploy.yml`; kiểm preview header; promote" (run the workflow, check preview headers, promote). The workflow can't do that:
  - It checks out the moving `main` ref, not a given SHA.
  - It runs `wrangler pages deploy dist --branch main`, which goes straight to production. There is no preview and nothing to promote.
  - Nothing compares the Pages run's `headSha` with the MCP `production_sha`, even though "same SHA" is a goal.
- **Failure scenario:**
  - **If the operator follows the plan as written:** production is replaced before any header or route check runs, and the guide's preview checks never happen.
  - **If the operator does a local `wrangler pages deploy --branch preview` to get a preview:** that build skips the workflow's `COMMUNITY_API_ORIGIN`. The blog builds empty (guide line 98). Promoting it wipes `/bai-viet/`, the RSS feeds and blog sitemap entries from production.

  In both cases, `docs/deployment.md` can end up recording "same SHA" without ever having checked it.
- **Evidence:**
  - `.github/workflows/pages-deploy.yml:26`: `COMMUNITY_API_ORIGIN` is set only in the workflow.
  - `.github/workflows/pages-deploy.yml:28-30`: `ref: main`.
  - `.github/workflows/pages-deploy.yml:51-53`: `--branch main`.
  - `docs/deployment-guide.md:98`: blog is empty without `COMMUNITY_API_ORIGIN`.
  - `docs/deployment-guide.md:129-141`: preview/promote runbook.
  - `.github/workflows/mcp-worker.yml:152-154`: only MCP checks the exact SHA.
- **Suggested fix:**
  - Rewrite step 5 as: record the known-good deployment, run the workflow, then `gh run view --json headSha` must equal the MCP SHA.
  - Run production checks after deploy and roll back through the dashboard if they fail. State that this workflow has no preview stage.
  - Add a branch for "MCP released but Pages build fails" (for example, the blog API is down at build time).

## Finding 5: Turning off comments on season pages needs a community-worker change after the worker's only release
- **Severity:** Medium
- **Location:** Phase 9, "Thiết kế", bullet "Comment" (line 45); goal 2 in plan.md (worker released once); Phase 4 (the one release)
- **Flaw:** The worker's own `page_key` regex already accepts `/doi-chuan/pk-s24/`. Phase 9 leaves the choice open ("kiểm phía worker", check the worker side) and doesn't list any `community-worker` file or deploy step.
  - **If the worker regex is changed:** that needs a second worker release after phase 4. This breaks goal 2 and has no gate: CI doesn't run community-worker, and there is no bookmark or rollback plan for it.
  - **If only the client is changed:** the server keeps accepting comments for season page keys.
- **Failure scenario:**
  - **If the client-only option is taken:** `POST /api/comments` with `page_key=/doi-chuan/pk-s24/` still succeeds. The result is orphan comments no page ever shows, an unmoderated spam sink, and rate-limit budget spent on it.
  - **If the developer edits `validate.ts` in the phase 9 PR:** the change merges untested. It then either sits undeployed, so worker and site disagree, or gets deployed ad hoc mid-batch.
- **Evidence:**
  - `community-worker/src/validate.ts:7`: the `doi-chuan` pattern accepts any one-level slug.
  - `js/community-api.js:11`: `PAGE_KEY_PATTERN`.
  - `.github/workflows/mcp-worker.yml:26-46`: no `community-worker/**` path.
- **Suggested fix:** Decide now:
  - **Option 1 (needs no worker change):** season pages simply don't mount the comment widget, and the server-side gap is documented as accepted.
  - **Option 2 (deny on the server):** fold the season-key denial into the phase 4 worker PR before its single release. Season codes are known from `seasons.json`, or a deny rule like `^/doi-chuan/(og|s\d+|pk-s\d+)/$` works.

## Finding 6: Phase 10 goes live on the next blog publish with no one watching, and the only recovery is a whole-database restore
- **Severity:** High
- **Location:** Phase 10, "Verification" (local smoke only) and "Risks"; Phase 4, "Rollback" ("chưa có client gọi route", no client calls the route yet); Phase 11, step 6
- **Flaw:**
  - After phase 10 merges, the next publish puts cloud sync in front of real users: first-time merge of local and cloud data, plus deleting boxes and groups.
  - There is no deliberate deploy or production smoke test until phase 11, which may be days later.
  - The server deletes data for real: deleting a box hard-deletes all its child rows.
  - The only restore path is D1 Time Travel to the phase 4 bookmark. That overwrites every D1 write since then: comments, posts, community teams, other users' rosters.
- **Failure scenario:**
  1. A Lamport clock or tombstone bug that only shows up with real Google sessions on several devices deletes a box server-side.
  2. Every device pulls the deletion and loses that box.
  3. No per-user recovery exists.
  4. The restore point recorded in phase 4 is days old. Using it destroys unrelated data, so in practice it can't be used.
- **Evidence:**
  - Snapshot `community-worker/src/routes/roster.ts:163-165`: `DELETE_BOX_CHILDREN` is a hard `delete from roster_records`.
  - Snapshot `community-worker/src/routes/roster.ts:282`
  - `docs/community-worker.md:363`: Time Travel overwrites every write after the bookmark.
  - `.github/workflows/pages-deploy.yml:7-10`: blog-triggered deploys of `main`.
- **Suggested fix:**
  - Take a fresh D1 bookmark right before the phase 10 merge.
  - Right after merging, run `pages-deploy` manually and smoke-test in production with two real-account devices: first merge, delete a box, delete a group.
  - Record the deployment ID and bookmark.
  - Write a per-user recovery procedure: re-insert one user's rows from a Time Travel copy into a scratch DB, without restoring the whole database.