## Contract verification summary

| Interface | Callers/consumers found (grep) | Listed in plan? |
|---|---|---|
| `bookLookupId` | main: `js/lookup-ids.js:42,147`, `js/unified-lookup.js:111`, `mcp-worker/src/data/publication-builder.ts:314`, `tests-js/lookup-ids.test.mjs:40-41`; Python twin `pipeline/lookup_route_handles.py:79-83`. Worktree: `js/roster-picker.js:13,69`, `js/my-teams.js:12,23`, **`tests-js/roster-picker.test.mjs:6,63,66,67,69`** | Main: all listed. Worktree: 2 of 3 files listed; the test file is missing (F7) |
| `createLookupIdResolver` | `js/lookup-ids.js:195`, `src/lib/team-detail-pages.ts:104`, `publication-builder.ts:744`, tests `lookup-ids.test.mjs` ×5 and `teams-data-integrity.test.mjs:71`. Worktree adds `js/roster-recommend-ui.js:1051`, `js/team-detail.js:73`, `tests-js/support/my-teams-fixtures.mjs:14` | Not listed. They pick up the change through the shared function, which works only if every row has `id` |
| `nameEntry` / `referenceTeam` / `diffTeam` / `compareTeams` | inside `js/analyze-map.js:408,410,420,422`; outside `js/analyze.js:991,1092-1093`. The cache is keyed only on `tacticIdOf` (`analyze-map.js:398,426`) | `analyze.js` is listed. The plan does not say the cache key must include the new `bookIdOf` |
| `recordEntityId` / `createEntityIndex` | `js/analyze.js:392-394`, `js/community-team-data.js:56-58`, **`worker/eval/score.ts:56-58`**, tests `analyze-map.test.mjs:293-295`, **`community-team-state.test.mjs:30-32`**, **`worker/test/eval-score.test.ts:5-15`** | 3 consumers missing (F2) |
| `canonicalDictionaryId` | `artifact-contracts.ts:295`, `snapshot-index.ts:54`, `test/fixtures/lookup-roots.ts:99,111`; affects fixture **`test/fixtures/release-snapshot/books-dict.json`**, which 14 test files use | The fixture is missing (F2) |
| `PublicationSources` / `PublicationRoots` | `build-worker-assets.ts:31-33,269,362`, `filesystem-data-source.ts:24-25,138-140`, `vitest.worker-production.config.ts:7,18`, `test/fixtures/publication-sources.ts:41,61`, `publication-worker-assets.test.ts:35,90-92` | Covered. Every caller goes through `repositoryPublicationRoots` |
| `ZH_GAPS_REPORT_PATH` | Used only in the script (`:15,101,109`). `seo-dist-contract.test.mjs:11` imports `zhGaps` only | Complete |
| `recommendedDetailPaths` / `[team].astro` `getStaticPaths` | `src/pages/doi-chuan/[team].astro:9`, `src/pages/zh/doi-chuan/[team].astro:9`, **`src/lib/llms-documents.ts:72-75`** | `llms-documents` is missing (F8) |
| `PAGE_KEY_PATTERN` | `js/community-page.js:6,19`. Worker twin `community-worker/src/validate.ts:6-7,25`, tested in `community-worker/test/teams-validate.test.ts:242-266` | Plan leaves "check the worker" open; the answer is that the twin exists (F6) |
| `familyReturnHref` | `KhaiHoangDetail.astro:19`, `LegacyDetail.astro:19`, `RecommendedDetail.astro:24`, `tests-js/team-detail-navigation.test.mjs:230-233,538-539,562-563` | Plan leaves it unchanged; correct |

---

## Finding 1: Phase 10 replays only pinned files and new files; 8+ edited, unpinned snapshot files are dropped
- **Severity:** High
- **Location:** Phase 10, sections "Bối cảnh" and "Files to Create / Modify"
- **Flaw:** The steps cover only (a) new files, via `git checkout <snapshot> --`, and (b) the 9 pinned files, by replaying their diffs by hand. The snapshot also edits unpinned tracked files that fall under neither step: `pipeline/site_localization.py`, `scripts/verify-astro-dist.mjs` (+100 lines), `src/lib/team-detail-pages.ts` (+56), `js/community-api.js`, `js/community-auth.js`, `src/lib/locale-routes.ts`, `public/_headers`, `css/styles.css` (+377), `docs/design-guidelines.md`, and the tests `tests-js/astro-dist-contract.test.mjs` (+131), `tests-js/pages-headers-contract.test.mjs`, `tests-js/roster-scan-state.test.mjs`, `tests-e2e/beta-tools.spec.mjs`, `tests-e2e/community-teams.spec.mjs`.
- **Failure scenario:**
  1. The worktree's `js/roster-recommend-ui.js` no longer contains "Tính năng gợi ý đội từ kho chưa được cấu hình.", but main's `site_localization.py:822-823` still lists it as an obligation. Without the snapshot's tuple removal, `site_localization check --stage public` reports "reviewed UI source expression is missing", and `npm run build` fails.
  2. Without the snapshot's `verify-astro-dist.mjs` change, `/doi-cua-toi/index.html` and `/my-teams-source-index.json` fail the dist allowlist as "unexpected". Phase 9 also edits that same file, so a wholesale checkout from the snapshot would wipe the season-page allowlist.
  3. Without the `community-api.js` change, `signOut` no longer clears `tqccl.roster.cloud.v1`. On a shared machine, the previous account's cloud roster stays in localStorage for the next user. This is a data leak the snapshot had already fixed.
- **Evidence:**
  - `git -C <worktree> status --short` lists the files above as ` M`.
  - `pipeline/site_localization.py:822-823`, `:1781-1806`, `:2465-2470`.
  - `js/roster-recommend-ui.js:103` has the literal; the worktree count is 0.
  - `scripts/verify-astro-dist.mjs:293-297` throws on unexpected files.
  - Worktree diff of `js/community-api.js` (signOut `finally` → `localStorage.removeItem(ROSTER_CLOUD_KEY)`).
  - `src/lib/locale-routes.ts:19` (`COMMUNITY_PATHS` gains `/doi-cua-toi/`).
- **Suggested fix:** Add a third bucket to Phase 10: "unpinned edited files: replay the diff per file", listing every file from `git diff --stat 1fa81ab <snapshot>` minus the generation and pin files. For `scripts/verify-astro-dist.mjs` and `site_localization.py`, require a three-way merge with the Phase 9 / Phase 7-8 edits. Add a check step: `git diff --stat 1fa81ab <snapshot>` vs `git diff --stat main-before main-after` with every path accounted for.

## Finding 2: Phase 5's fail-closed rule (rows without `id` are dropped) breaks id-less book fixtures that the plan does not list
- **Severity:** High
- **Location:** Phase 5, sections "Thiết kế" ("Dòng thiếu `id` hợp lệ bị bỏ… fail-closed") and "Files to Create / Modify"
- **Flaw:** The plan inventories only the real data plus a few test files. Many fixtures build `books` rows as `{chinese, viet}` with no `id`. Once `recordEntityId`, the season `dictionary()`, and `canonicalDictionaryId` stop deriving ids from `slug(viet)`, those rows vanish or throw. Not listed:
  - `tests-js/fixtures/season-fixtures.mjs:13`. Its `bookRefs` are `book:binh-thu-*`; 9 test files across tests-js and mcp-worker use it.
  - `mcp-worker/test/fixtures/release-snapshot/books-dict.json`. Its bytes are pinned in `manifest.json:42-46` (sha256, byteLength, and through them `releaseId`); 14 test files use it.
  - `tests-js/community-team-state.test.mjs:28`.
  - `worker/test/eval-score.test.ts:15`, together with `worker/eval/score.ts:56-58`. The vision worker is a `check:repository` gate.
  - Files the plan names but without saying their fixtures must change: `analyze-map.test.mjs:28-32`, `lookup-ids.test.mjs:47,61-66,92-96`, `unified-lookup.test.mjs:376`, `publication-snapshot.test.ts:331`, `tests/test_build_season_data.py:230`, `tests/test_lookup_route_handles.py:45-48,240`.
- **Failure scenario:**
  - `validateSeasonBundle` rejects `book:binh-thu-mot` because it is no longer in the dictionary, so every season test is red.
  - The `validateDataSnapshot` check at `artifact-contracts.ts:295` throws on the release-snapshot book, so about 14 MCP suites fail.
  - `eval-score.test.ts:48` expects `books {hit:1,total:1}` and gets `0/0`, so `vision-worker-tests` goes red.
  - The 2d estimate does not include this work, and the PR cannot satisfy the "never red main" invariant.
- **Evidence:** `tests-js/fixtures/season-fixtures.mjs:13,16`; `mcp-worker/test/fixtures/release-snapshot/books-dict.json:1-6` with `manifest.json:2-4,42-46`; `worker/test/eval-score.test.ts:15,48`; `mcp-worker/scripts/check-repository.ts:61-71` (vision-worker gate); `mcp-worker/src/data/entity-identity.ts:28-31`; `js/season-context.js:141`.
- **Suggested fix:** Add a "fixture migration" task with this list. For the release snapshot, also regenerate `manifest.json` sha256, byteLength and releaseId, plus any expected values derived from them. Add `worker/` to the Phase 5 verification commands (`cd worker && npm test`).

## Finding 3: `--mint-id` plus `tests/fixtures/book-ids-frozen.json` are extra machinery, and the minting rule can reuse a retired id
- **Severity:** Medium
- **Location:** Phase 5, section "Thiết kế" (bullet 2) and "Test fixture"
- **Flaw:** Issue #14 option A asks to "khóa binh thư theo danh tính ổn định; migrate id cũ, giữ slug". The plan adds two things beyond that:
  - **A new CLI.** `--mint-id` assigns `book:<slug(viet)>`, with a `-2` suffix on collision.
  - **A fourth copy of the 68 ids.** The production generator reads `tests/fixtures/book-ids-frozen.json` to check that no id vanished. The same ids already live in the map, in `books-dict`, and in ledger `handles.books`.

  The minting rule checks collisions only against live ids. The ledger reserves slugs of removed ids in `retired` and hands the old slug back when that id "returns". That reuse is correct for the same book but wrong when the old id is minted for a different book.
- **Failure scenario:** A book is deleted, so `book:x` moves to `retired.books`. Later a new book whose Vietnamese name slugs to `x` is minted as `book:x`. `--write` then "restores" the retired slug. Two things go wrong:
  - The old indexed URL and its MCP id now point to a different book.
  - Saved records holding `book:x` silently refer to the new book. That covers D1 `scan_samples.confirmed`, `?doi=` links and history, and roster records from #23.

  Separately, a deliberate book deletion fails the generator until someone edits a file under `tests/`, which inverts the dependency between pipeline and tests.
- **Evidence:** `pipeline/lookup_route_handles.py:11-13,131-141` (retired slugs reserved and restored on return); `community-worker/src/validate.ts:12` and `community-worker/src/routes/scan.ts:100` (book ids are persisted); `pipeline/lookup-route-handles.json` has 68 `handles.books` entries plus `retired`.
- **Suggested fix (question to user):** Is the mint CLI needed for a 68-row map that changes rarely? A simpler approach: the author writes `id` by hand, and the generator checks its shape, uniqueness, and that it is not in ledger `handles` (any book) or `retired.books`. Use the ledger as the "never vanish / never reuse" source and drop the generator's dependency on the tests fixture.

## Finding 4: `formerViet` adds a third "old name" convention next to the existing `aliases` and `formerNames`
- **Severity:** Medium
- **Location:** Phase 5, section "Thiết kế" (last bullet: "thêm trường tùy chọn `formerViet: []`") and TDD 9
- **Flaw:** The locked decision for #14 is "chỉ đóng băng id", and `formerViet` is a new schema field beyond that. The repo already has two ways to record other names:
  - **Dictionary rows carry `aliases`.** The tactic resolver tiers `viet → hanViet → aliases`.
  - **The MCP builder already folds `book.aliases`** into entity aliases.
  - **`bookSourceAliases` returns `{aliases, formerNames}`** per book id.

  `formerViet` is not in `BOOK_FIELDS`, and it is not passed into the `entity(...)` aliases argument.
- **Failure scenario:** After a rename, the website resolver accepts the old Vietnamese name through `formerViet`. MCP `tqccl_search` and `tqccl_get_entity` do not, because the builder only reads `sourceNames`/`aliases`. Website and MCP diverge, which is the kind of parity bug #5 exists to fix.
- **Evidence:** `mcp-worker/src/data/publication-builder.ts:243,316`; `js/lookup-ids.js:29-36,85-107` (tactic `aliases` tier); `js/unified-lookup.js:104-123`.
- **Suggested fix (question to user):** Reuse `aliases` on the book map entry, so one field feeds the resolver, the MCP builder and `bookSourceAliases`. Alternatively, drop the old-name support and update the stored names in `data/teams.json` when a book is renamed. Either way, do not introduce `formerViet`.

## Finding 5: Phase 6 re-parses the ledger in parallel code and drives routing through module-global state across `await`s
- **Severity:** Medium
- **Location:** Phase 6, section "Thiết kế" (bullet 1) and TDD 6-8
- **Flaw:** The builder would re-implement ledger parsing (generationId check, `handlesSha256` check, exception computation), described "như `parseLookupDetailLedger`". `parseLookupDetailLedger` is already exported and pure, and `lookupDetailPath(group, slug)` already exists. The plan then pushes the exceptions into the global `lookupRouteExceptions` with `setLookupRouteHandles` and resets it to `{}` after the build. `buildPublicationArtifacts` awaits between steps 4 and 9 (`await sha(...)` inside `Promise.all`). Two builds running concurrently in one process, such as the stdio server with `FilesystemDataSource` or a test using `Promise.all`, would see each other's table or a reset one. TDD 8 tests only the sequential case. The ledger currently has 0 excepti…
- **Failure scenario:** Build A sets exceptions `{hero:luu-bi → luu-bi-2}`. Build B starts and resets the table to `{}`. Build A resumes after its `await` and emits `/tra-cuu/tuong/luu-bi/`, which does not exist. This is a silent wrong `pagePath` in a published artifact.
- **Evidence:**
  - `src/lib/lookup-detail-routes.ts`: `parseLookupDetailLedger` and `lookupDetailPath` are exported.
  - `js/lookup-ids.js` (module-level `let lookupRouteExceptions`, plus `setLookupRouteHandles`).
  - `mcp-worker/src/data/publication-builder.ts:716-790` (awaits between ledger parse and routes), `:819-823`.
  - `pipeline/lookup-route-handles.json` (0 slugs ≠ id suffix).
- **Suggested fix:** Issue #15 asks to "đăng ký bảng ngoại lệ"; was a second validator also intended, or only the paths? Call `parseLookupDetailLedger(raw, corpusIds, {generationId})` and build each route as `byId.get(id)?.path ?? lookupProfilePath(id)`, with no global mutation. TDD 8 then becomes unnecessary and TDD 6-7 reuse the existing contract.

## Finding 6: Editing `PAGE_KEY_PATTERN` for season pages is unnecessary and would split the client from its worker twin
- **Severity:** Medium
- **Location:** Phase 9, section "Thiết kế" (bullet "Comment: loại path trang mùa khỏi `PAGE_KEY_PATTERN` hoặc…") and Files (`js/community-api.js` "nếu chọn loại path")
- **Flaw:** The comment block mounts only where `#community-root` exists. That element appears only in the three team-detail components, and the new `SeasonPage.astro` will not have it. The "check the worker side" question is open in the plan, and the answer is yes: `community-worker/src/validate.ts:6-7` has the same pattern as `PAGE_KEY_RE`, with its own tests.
- **Failure scenario:** If the client-only regex is narrowed, the server still accepts `/doi-chuan/pk-s24/` as a valid `pageKey`. The two validators drift apart for no behavioural gain. The edit also conflicts with Phase 10's edits to `js/community-api.js`.
- **Evidence:** `src/components/pages/RecommendedDetail.astro:104-108`, `LegacyDetail.astro:82-86`, `KhaiHoangDetail.astro:82-86`; `js/community-page.js:22-28` (`if (!root) return`); `js/community-api.js:11`; `community-worker/src/validate.ts:6-7,25`; `community-worker/test/teams-validate.test.ts:242-266`.
- **Suggested fix:** Drop the `PAGE_KEY_PATTERN` option. Keep the existing TDD 13 assertion ("không có khung comment") and add a dist assertion that the season HTML contains no `id="community-root"`.

## Finding 7: Phase 5 does not say whether the `bookLookupId` export survives, so the Phase 10 snapshot code may not even import
- **Severity:** Medium
- **Location:** Phase 5, section "Thiết kế" ("Mọi consumer đọc `row.id`"); Phase 10, TDD 2
- **Flaw:** The plan never says whether `bookLookupId` is deleted (the repo's clean-cutover rule) or redefined to return `row.id`. Phase 10 counts 2 worktree callers, but there are 3 files: `js/roster-picker.js:13,69`, `js/my-teams.js:12,23`, and `tests-js/roster-picker.test.mjs:6,63,66,67,69`. The test computes expected ids as `books.map(bookLookupId)`.
- **Failure scenario:**
  - **If Phase 5 deletes the export:** the replayed `roster-picker.test.mjs` fails with a missing-export import error, which fails `test:node`.
  - **If Phase 5 redefines it to return `row.id`:** Phase 10 TDD 2 ("không còn gọi `bookLookupId`") contradicts a working shared helper. The pipeline docstring (`lookup_route_handles.py:4-6`) and the `unified-lookup.js:104-107` comment describe the wrong rule either way.
- **Evidence:** `js/lookup-ids.js:17-21`; worktree `js/roster-picker.js:13,69`, `js/my-teams.js:12,23`, `tests-js/roster-picker.test.mjs:6,63-69`; `pipeline/lookup_route_handles.py:4-6`.
- **Suggested fix:** Decide in Phase 5. Recommended: delete `bookLookupId` and update every caller in the same PR. Phase 10 then lists all three worktree files, test included, under "update to `row.id`".

## Finding 8: Season pages vanish when the current season changes, and the `getStaticPaths` change can break the llms consumer
- **Severity:** Medium
- **Location:** Phase 9, sections "Thiết kế" (bullet 2) and TDD 6
- **Flaw 1:** TDD 6 makes a published season URL disappear as soon as that season becomes current. The locked decision ("mùa hiện tại dùng `/doi-chuan/`") causes this. The current season is not chronological: it is the OG event mode, switched by hand. That clashes with Goal 4 ("slug hiện có không đổi"), and nothing redirects the old URL.
- **Flaw 2:** The plan says `getStaticPaths` returns both team and season paths, but not where they are merged. `recommendedDetailPaths` has a third consumer the plan does not list. It sorts on `row.props.entry.sourceSeasonId`.
- **Failure scenario:**
  - **URL loss:** the default switches from `og-兵演春秋` back to `pk-s28`. `/doi-chuan/pk-s28/` and its `/zh/` mirror (already in the sitemap) start returning static 404s. Only the tactic redirects in `public/_redirects` exist.
  - **llms crash:** if season rows are appended inside `recommendedDetailPaths`, the `llms-documents.ts:75` sort throws on `undefined.sourceSeasonId` and the build fails.
- **Evidence:** `js/team-filter-section.js:164-165` (current season set by hand: "Mùa đang diễn ra, đối chiếu ngày 2026-09-27"); the pinned `seasons.json` has `defaultSourceSeasonId: og-兵演春秋`; `pipeline/lookup_route_handles.py:16-19` (the only `_redirects` writer, tactics only); `src/lib/llms-documents.ts:72-75`; `src/pages/doi-chuan/[team].astro:8-9`.
- **Suggested fix:**
  - **Redirect:** within the locked decision, add a `_redirects` entry from the current season's slug to `/doi-chuan/` (both locales) whenever that slug ever had a page. Change TDD 6 to assert the redirect, not just that the page is gone.
  - **Merge point:** state that season paths are concatenated in `[team].astro` (or a new `seasonPagePaths()`), never inside `recommendedDetailPaths`, and add `llms-documents.ts` to the Phase 9 regression list.

---

Read-only review; I edited nothing and ran no build, lint or tests.

[Some lines truncated to 768 chars. Use agent://RedScope:raw:84-84 to read line 84 whole]