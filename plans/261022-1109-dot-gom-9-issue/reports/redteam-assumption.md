## Finding 1: Phase 10's port recipe leaves out the snapshot's unpinned code changes, and the #23 save flow depends on them
- **Severity:** High
- **Location:** Phase 10, sections "Bối cảnh" and "Files to Create / Modify"
- **Flaw:** The recipe covers only three groups: new files (`git checkout <snapshot> -- <path>`), pinned files (re-apply by hand from the diff), and generated files to leave behind. The snapshot also edits tracked files that are not pinned. Phase 10 never names them, and phase 4 takes only worker files. The missing files are:
  - `src/lib/team-detail-pages.ts`: the `team-save-payload` that the 4 save sources need.
  - `scripts/verify-astro-dist.mjs`: the My Teams index and payload verifier, about 100 lines.
  - `js/community-api.js`: clears the cloud roster cache on sign-out.
  - `js/community-auth.js`: the "Đội của tôi" menu entry.
  - `pipeline/site_localization.py`: removes the `ui:roster/setup-*` obligations.
  - `public/_headers`, `css/styles.css`, and the matching tests.

  The plan also says to rebuild `site-localization-policy.json` with the publish chain. The chain only re-pins hashes; the snapshot's new section entrypoint `js/roster-picker.js` was added by hand.
- **Failure scenario:** Someone follows phase 10 literally. Detail pages ship with no save payload, so "Lưu" on Đội chuẩn, Đội khác and Khai hoang has nothing to save, and the verifier that would catch this is not ported either. Sign-out stops clearing `tqccl.roster.cloud.v1`, so on a shared computer the next person to sign in sees the previous account's roster. `check --stage public` fails on the stale setup obligations, and the fix is improvised.
- **Evidence:** worktree `git status` lists all of these as ` M`. Worktree `src/lib/team-detail-pages.ts:171-189`, `scripts/verify-astro-dist.mjs:212,262,669`, `js/community-api.js:272-281`. Main `pipeline/site_localization.py:822-823`, `pipeline/site-localization-policy.json:698-701`. `docs/deployment-guide.md:258-260` (the policy is edited by hand before `build`).
- **Suggested fix:** Have phase 10 list every file from `git diff --name-only 1fa81ab <snapshot>` and assign each one an action: port, re-apply by hand, or regenerate. Add the `entrypoints` edit for `roster-picker.js` explicitly. Phase 9 also edits `js/community-api.js` and `verify-astro-dist.mjs`, so mark those two as hand-merge.

## Finding 2: The production acceptance checks for #23 and #21 are dropped; the OAuth round-trip is never tested anywhere real
- **Severity:** High
- **Location:** Phase 10, "Verification" (local smoke "session Better Auth dựng sẵn"); Phase 11, "Kiểm production"; plan.md "Success Criteria"
- **Flaw:** #23's "Xong khi" requires four things:
  - signed out, click Lưu on each of the 4 sources, sign in, and the right team is saved;
  - an edit survives reload;
  - the edit shows up on a second machine;
  - #21 requires the one-time local-to-cloud merge after first sign-in.

  The plan checks production only twice:
  - Phase 4 runs a curl POST/GET on one `box` record, before any client exists.
  - Phase 11 checks `/api/roster` returns 401, `/doi-cua-toi/` is noindex, and the index JSON loads.

  The only end-to-end run is local, with a pre-seeded session. That skips the real path: `signIn()` sends Google a `callbackURL` and leaves the page, then the pending draft must come back from `sessionStorage` on return.
- **Failure scenario:** On production the callback lands somewhere `my-teams-pending.js` does not handle, for example `errorCallbackURL`, a trusted-origin mismatch, or a different tab. The draft is lost silently. #23 is still closed in phase 11 with "bằng chứng kiểm".
- **Evidence:** `js/community-api.js:255-268` (`callbackURL`, `location.assign`). Worktree `js/my-teams-save-button.js:5,126`, `js/my-teams-pending.js:1,12`. Phase 11 step 6 has no #23 flow. Issue #23 "Xong khi".
- **Suggested fix:** Add a production checklist to phase 11 step 6, run with a real Google account:
  - save from each of the 4 sources while signed out, sign in, and confirm the save;
  - edit, then reload;
  - open in a second browser;
  - check the first-sign-in local-roster merge prompt.

  Close #21/#23 only with this evidence.

## Finding 3: Phase 6 adds module-global route state inside an async builder; the existing exported helpers make it unnecessary
- **Severity:** Medium
- **Location:** Phase 6, "Thiết kế" (call `setLookupRouteHandles(exceptions)`, reset after each build) and TDD 6/8
- **Flaw:** `buildPublicationArtifacts` is async and awaits many times between the planned set and reset. The plan never says the reset goes in `finally`, and test 8 only covers success followed by success. The site sets this table once per process, memoized. Doing the same per build in the MCP builder is new mutable state for a table that is empty today. The global is not needed: `lookupDerivedSlug` and `lookupGroupPath` are already exported, so the builder can compute `exceptions.get(id) ?? lookupDerivedSlug(id)` locally.

  Separately, the planned "parse tối thiểu" re-implements `parseLookupDetailLedger` and skips its `booksSha256` pin. Test 6 compares the id set against `lookup-manifest`, which does not contain books. Books are exactly the group phase 5 changes.
- **Failure scenario:** A test expects a rejection after the exceptions were set (`rejects.toThrow()` style, as in the existing suite), and the reset never runs. Later builds in the same vitest module inherit the injected `hero:… → …-2` slug and pass or fail by test order. A books-dict change without `lookup_route_handles --write` also gets past the MCP builder's check.
- **Evidence:** `js/lookup-ids.js:277-309` (module-level `lookupRouteExceptions`; "Hiện không có ngoại lệ nên bảng rỗng"). `mcp-worker/src/data/publication-builder.ts:675-784` (async with repeated awaits). `mcp-worker/test/data/publication-snapshot.test.ts:140-174`. `src/lib/lookup-pages.ts:139-147`. `src/lib/lookup-detail-routes.ts:70-71`. `data/lookup-manifest.json` `files` has only heroes, catalog and tactics. `src/lib/root-static-artifacts.ts:316`.
- **Suggested fix:** Pass the exceptions map explicitly into the builder's route step and never call `setLookupRouteHandles` from the MCP builder. Validate `booksSha256` against `books-dict` bytes, and check the book id set against books-dict, not the manifest.

## Finding 4: The frozen fixture copies state the ledger already holds, and `--mint-id` ignores retired ids
- **Severity:** Medium
- **Location:** Phase 5, "Thiết kế" (`--mint-id`, check against `tests/fixtures/book-ids-frozen.json`) and "Files" (fixture of 68 `id → chinese` pairs)
- **Flaw:** `pipeline/lookup-route-handles.json` already freezes all 68 `book:*` ids in `handles.books`, keeps `retired` reserved, and hashes both with `handlesSha256`. The plan adds a second copy in `tests/` and has a production generator read it. Storing `chinese` in that copy breaks on the Hán corrections the plan itself expects (changelog:298). "No id may disappear" leaves no way to merge or retire a book, while tactics have `formerIds` plus `_redirects`. `--mint-id` says "thêm -2 khi trùng" but never says it must check against `retired`. In `mint_handles`, a retired id that comes back gets its old slug back.
- **Failure scenario:**
  1. A book is retired.
  2. Later a new book's Việt name slugs to the same id.
  3. `--mint-id` reissues it, and `--write` restores the old slug.
  4. The new book inherits the old URL, old `?doi=` links, history entries, and D1 `book:` refs that meant the other book. This is the URL-reuse problem #14 exists to prevent.

  Separately, a legitimate Hán fix turns the fixture test red, and the developer edits the frozen fixture to get green.
- **Evidence:** `pipeline/lookup_route_handles.py:11-13,128-141,201-207`. `pipeline/lookup-route-handles.json` (`handles.books` = 68, `retired.books` = {}). `pipeline/lookup_route_handles.py:244-251` (redirects are tactic-only). `docs/project-changelog.md:298`.
- **Suggested fix:** Validate `id`s against the ledger's `handles.books ∪ retired.books`, and have `--mint-id` reject any id or slug that is live or retired. Drop the `chinese` field from the fixture, or drop the fixture and use the ledger as the frozen set. Write down the procedure for merging or retiring a book.

## Finding 5: A real book rename is still blocked by the facet check; the rename success criterion is only proven on synthetic facets
- **Severity:** Medium
- **Location:** Phase 5, "Thiết kế" (`formerViet`), TDD 2, and the docs section "Thêm binh thư mới / id cố định"; plan.md Success Criteria row 3
- **Flaw:** `build_books_dict` fails loudly unless `viet ∈ facets.json.books`. `facets.json` is regenerated from team source HTML, which keeps the old name. The plan adds `formerViet` for resolvers but does not connect it to this check. TDD 2 changes `viet` in a synthetic map with a synthetic FACET list, so the only operator path #14 exists for is never exercised.
- **Failure scenario:** The operator renames `Dĩ Trực Báo Oán` to `Lấy Thẳng Báo Oán` in the real map, and `python3 -m pipeline.build_books_dict` stops with "không thuộc facets.json.books". The easiest workaround is to add `outsideTeams: true`, which passes because the new name is not in the facet. That wrongly marks a book used by teams as unused.
- **Evidence:** `pipeline/build_books_dict.py:66-70`. `pipeline/build_json.py:194-195` (`facets.json` built from teams). `pipeline/books-han-viet-map.json:2` ("Tên Việt PHẢI khớp facets.json.books").
- **Suggested fix:** Let the facet check accept an entry when `viet` or any `formerViet` is in the facet. Add a TDD case that renames on the real map and real facets, and document the full rename procedure.

## Finding 6: Phases 7–9 assume the current season stays OG and has at most 60 teams
- **Severity:** Medium
- **Location:** Phase 9, "Thiết kế" (current season has no page; `/doi-chuan/` serves it) and TDD 6; Phase 7 E2E 8; Phase 8 E2E 13
- **Flaw:** The current season is served only by `/doi-chuan/`, and that page renders at most `PAGE_SIZE = 60` teams in HTML. TDD 6 changes the default season, but no test covers a default season with more than 60 teams. Seasons today go up to 130 teams (pk-s26). The e2e tests in phases 7 and 8 seed the issue's roster on the "mùa mặc định" and assert OG-specific teams. Phase 9 also builds a new season catalog in `season-pages.ts` from `seasons.json` and `index.json`. `teamDetailCatalog()` and `recommendedSeasonOrder()` already provide each season's teams and route paths, and `llms-documents.ts` already groups them by season.
- **Failure scenario:** The next season becomes the default. Teams 61 onward of the current season appear in no static list: not on `/doi-chuan/`, and with no season page. That is the gap #6 is meant to close ("render sẵn đủ đội của mùa đó"). If the default changes during the batch, phase 7/8 e2e go red on every PR.
- **Evidence:** `src/lib/team-section-ssr.js:39-55` (`limit: PAGE_SIZE`), `js/team-filter-section.js:139`, `js/roster-recommend-ui.js:181` (season falls back to `registry.defaultSourceSeasonId`), `src/lib/team-detail-pages.ts:77`, `src/lib/llms-documents.ts:71-104`.
- **Suggested fix:** Either give the current season a page when it has more than 60 teams, or make the `/doi-chuan/` SSR render the whole default season. Add a TDD case with a large default season. Pin `?season=og-兵演春秋` in the phase 7/8 e2e. Build `season-pages.ts` from `teamDetailCatalog()` instead of a second reader.

## Finding 7: One allowed comment-exclusion option in phase 9 forces a second community-worker deploy
- **Severity:** Medium
- **Location:** Phase 9, "Thiết kế", bullet "Comment" ("loại path trang mùa khỏi `PAGE_KEY_PATTERN` … (kiểm phía worker…)")
- **Flaw:** The worker enforces the same page-key regex on its side. Excluding season paths "properly" means changing `community-worker/src/validate.ts` and redeploying the worker after phase 4. That breaks Goal 2 ("D1 + community-worker 1 lần"). The plan leaves this branch open and sends the implementer to "check the worker side".
- **Failure scenario:** The phase 9 implementer narrows both regexes to keep things consistent. The worker change sits unreleased: either a second worker release is needed, or `main` holds worker code that differs from production until someone deploys it.
- **Evidence:** `community-worker/src/validate.ts:7`, `js/community-api.js:11`, plan.md Goals row 2.
- **Suggested fix:** Decide now: season pages do not mount the comment frame, a client-only change in `SeasonPage.astro`. Leave both regexes untouched, and add a TDD case that `community-worker` is not modified in phase 9.

## Finding 8: Phase 4's "red first" tests already exist and pass in the snapshot
- **Severity:** Medium
- **Location:** Phase 4, "TDD" items 1–3
- **Flaw:** These cases are already in the snapshot suite, so they cannot be "đỏ trước". The plan counts them as new evidence on the only gate community-worker has, since CI does not run it. Meanwhile the real gap goes unnoticed: the `M2` test is built around 1,000 D1 statements per invocation. Phase 4 step 5 checks the plan tier but does not tie the outcome to `ROSTER_MAX_BATCH`.
- **Failure scenario:** The reviewer sees "4 new red→green tests" when nothing new was proven. If the account is on a tier with a lower per-invocation query cap, the worst-case batch passes in vitest and fails on production after the one allowed release.
- **Evidence:** worktree `community-worker/test/roster.test.ts:154` (401), `:604` (rate limit per user), `:631` (M2, "dưới trần 1 000 câu D1"), `:697-704` (`ROSTER_MAX_BATCH + 1` → 400).
- **Suggested fix:** Replace TDD 1–3 with a mapping to the existing case numbers. Make step 5's result a gate: if the real cap is below the M2 worst case, lower `ROSTER_MAX_BATCH` and update `docs/roster-sync.md` before the deploy.