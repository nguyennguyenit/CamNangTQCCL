---
phase: 3
title: "Site: route /doi-tu-build/ (vi + zh), _headers, chuyển hướng qua generator, verifier, link"
status: pending
priority: P1
effort: "0.5d"
dependencies: [2]
---

# Phase 3 — Site: route `/doi-tu-build/`

## Goal

Trang đội phục vụ ở `/doi-tu-build/` và `/zh/doi-tu-build/`; route cũ bị xoá; `public/_redirects` (do generator sinh) chuyển mọi URL `/doi-cong-dong…` sang URL mới, giữ query, với mã **302** trong giai đoạn cutover (đổi 301 ở task 6.19); mọi link và page key phía client dùng tiền tố mới; test và verifier khớp. <!-- Red Team #7 --> <!-- Updated: Kongming advice - đánh số lại phase 6 -->

## Context links

- Số dòng là tham chiếu ≈ trên `0f89e2e`; PR #36 sửa `public/_headers`, `tests-js/pages-headers-contract.test.mjs`, `scripts/verify-astro-dist.mjs`, `js/community-auth.js`, `js/community-api.js` và e2e, nên luôn tìm theo chuỗi/symbol ghi kèm. <!-- Red Team #3 -->
- Route hiện tại: `src/pages/doi-cong-dong/index.astro`, `src/pages/zh/doi-cong-dong/index.astro` (cùng dùng `CommunityTeamsPage.astro`, import tương đối cùng độ sâu nên không đổi khi đổi tên thư mục).
- Cache: rule `/doi-cong-dong/*` trong `public/_headers`; test `tests-js/pages-headers-contract.test.mjs` (mảng `expectedRules`, mảng `publicPaths` có `"doi-cong-dong"` ở hai chỗ).
- Generator `_redirects`: `pipeline/lookup_route_handles.py` (docstring module đoạn "Both modes also own `public/_redirects`", `REDIRECT_LOCALE_PREFIXES`, `season_redirect_lines`, `redirects_bytes` với `lines.extend(season_lines)`, hai nơi gọi trong `write_ledger`/`check_ledger`). `public/_redirects` hiện có 2 dòng cuối là rule mùa.
- Test generator: `tests/test_lookup_route_handles.py` (`test_merged_tactic_gets_one_301_per_locale_and_dropped_one_none`, `test_current_season_slug_is_301_to_the_list_and_follows_the_default_season` với `lines[-2:]`, `test_committed_redirects_match_the_ledger` với `2 * pairs + 2` và `endswith("/ 301")`). Repo chạy Python test bằng `unittest` (`docs/code-standards.md`).
- Hành vi Pages ([researcher §1.1–1.4](./reports/researcher-261023-cloudflare-cutover.md)):
  - Rule splat không khớp URL thiếu `/`.
  - Mọi rule sau rule động đầu tiên đều bị tính là động.
  - Query của request được giữ khi đích không có query.
  - 301 bị trình duyệt cache, nên lúc cutover dùng 302. <!-- Red Team #7 -->
- Verifier: `scripts/verify-astro-dist.mjs` `COMMUNITY_PAGES` (entry `localizedHtmlPath("doi-cong-dong/index.html", locale)`).
- Link client: `js/community-api.js` `communityPageHref`; `js/community-teams.js` `hrefFor` (`localePath('/doi-cong-dong/')`), `pageKey` trong `detailView`; `js/community-auth.js` (hai link `/doi-cong-dong/` và `/doi-cong-dong/?mine=1`; sau PR #36 link `?mine=1` có nhãn "Đội đã đăng"); `js/community-admin.js` `pagePath`, mục `hash: 'doi-cong-dong'`; `src/components/community/ReportsHub.astro` (link `localePath('/doi-cong-dong/', locale)`).
- E2E: `tests-e2e/community-teams.spec.mjs` (đường dẫn `/doi-cong-dong/…`, page key `/doi-cong-dong/t1/`, hash `#doi-cong-dong`).
- Kiểm chuyển hướng trên preview được gộp vào [phase 4 task 4.12](./phase-04-form-editor-chi-tiet.md) (một lần deploy preview). <!-- Red Team #14 -->

## Files to Create/Modify

- Đổi tên: `src/pages/doi-cong-dong/` → `src/pages/doi-tu-build/`; `src/pages/zh/doi-cong-dong/` → `src/pages/zh/doi-tu-build/`
- Sửa: `public/_headers`, `tests-js/pages-headers-contract.test.mjs`
- Sửa: `pipeline/lookup_route_handles.py`, `tests/test_lookup_route_handles.py`; sinh lại: `public/_redirects`
- Sửa: `scripts/verify-astro-dist.mjs`
- Sửa: `js/community-api.js`, `js/community-teams.js`, `js/community-auth.js`, `js/community-admin.js`, `js/community-admin-teams.js` (chú thích đầu file), `src/components/community/ReportsHub.astro`, `src/components/community/CommunityTeamsHub.astro` (chú thích đầu file), `src/components/pages/CommunityTeamsPage.astro` (chú thích đầu file)
- Sửa: `tests-e2e/community-teams.spec.mjs`

## Tasks

### Task 3.1 — Đổi thư mục route
- Goal: build sinh `dist/doi-tu-build/index.html` và `dist/zh/doi-tu-build/index.html`, không sinh thư mục `doi-cong-dong`.
- Target files and symbols: `src/pages/doi-cong-dong/index.astro`, `src/pages/zh/doi-cong-dong/index.astro`.
- Steps:
  1. `git mv src/pages/doi-cong-dong src/pages/doi-tu-build`
  2. `git mv src/pages/zh/doi-cong-dong src/pages/zh/doi-tu-build`
  3. Không sửa nội dung hai file.
- Success criteria: hai file mới tồn tại, thư mục cũ không còn.
- Verify: glob `src/pages/**/doi-tu-build/index.astro` ra đúng 2 file và glob `src/pages/**/doi-cong-dong/**` ra 0 file.

### Task 3.2 — `_headers` và test hợp đồng
- Goal: rule cache `/doi-tu-build/*` thay `/doi-cong-dong/*` ở đúng vị trí.
- Target files and symbols: `public/_headers` (dòng `/doi-cong-dong/*`); `tests-js/pages-headers-contract.test.mjs` (`expectedRules`, `publicPaths`).
- Steps:
  1. `public/_headers`: dòng `/doi-cong-dong/*` → `/doi-tu-build/*` (dòng `Cache-Control` ngay dưới giữ nguyên).
  2. Test: chuỗi `"/doi-cong-dong/*"` → `"/doi-tu-build/*"`; hai phần tử `"doi-cong-dong"` trong các mảng đường dẫn → `"doi-tu-build"`.
- Success criteria: không còn `doi-cong-dong` trong hai file.
- Verify: `node --test tests-js/pages-headers-contract.test.mjs` exit 0 và in `# fail 0`.

### Task 3.3 — Chuyển hướng qua generator `_redirects` (302 lúc cutover) <!-- Red Team #7 -->
- Goal: `public/_redirects` kết thúc bằng đúng 4 dòng sau, sinh bởi `python3 -m pipeline.lookup_route_handles --write`:
  ```
  /doi-cong-dong /doi-tu-build/ 302
  /zh/doi-cong-dong /zh/doi-tu-build/ 302
  /doi-cong-dong/* /doi-tu-build/:splat 302
  /zh/doi-cong-dong/* /zh/doi-tu-build/:splat 302
  ```
- Target files and symbols: `pipeline/lookup_route_handles.py` (thêm `RENAMED_PAGE_ROUTES`, `RENAMED_PAGE_STATUS`, `renamed_page_redirect_lines`; sửa `redirects_bytes` và docstring module); `tests/test_lookup_route_handles.py`.
- Steps:
  1. Sau `REDIRECT_LOCALE_PREFIXES` thêm:
     ```python
     # Trang đổi tên: URL cũ chuyển sang URL mới theo locale. Pages giữ query của request khi đích không có query
     # (?id=, ?new=1, ?mine=1). Splat là rule động nên đứng cuối file: sau rule động đầu tiên, Pages coi mọi rule là động.
     RENAMED_PAGE_ROUTES = (("doi-cong-dong", "doi-tu-build"),)
     # 302 trong lúc cutover (trình duyệt không cache vĩnh viễn, rollback được); đổi 301 khi đã ổn định (plan 261022-1828 task 6.19).
     RENAMED_PAGE_STATUS = 302
     ```
  2. Sau `season_redirect_lines` thêm:
     ```python
     def renamed_page_redirect_lines() -> list[str]:
         """`/<cũ> /<mới>/ <status>` (URL thiếu `/`, rule tĩnh) mỗi locale, rồi `/<cũ>/* /<mới>/:splat <status>` mỗi locale."""
         s = RENAMED_PAGE_STATUS
         static = [f"{p}/{old} {p}/{new}/ {s}" for old, new in RENAMED_PAGE_ROUTES for p in REDIRECT_LOCALE_PREFIXES]
         splat = [f"{p}/{old}/* {p}/{new}/:splat {s}" for old, new in RENAMED_PAGE_ROUTES for p in REDIRECT_LOCALE_PREFIXES]
         return static + splat
     ```
  3. Trong `redirects_bytes`, ngay sau `lines.extend(season_lines)` thêm `lines.extend(renamed_page_redirect_lines())`; docstring thêm "; then the renamed-page rules (static first, splat last)".
  4. Docstring module (đoạn "Both modes also own `public/_redirects`"): thêm câu "It also appends the renamed-page redirects (`RENAMED_PAGE_ROUTES`: `/doi-cong-dong` → `/doi-tu-build/`, status `RENAMED_PAGE_STATUS`), splat rules last."
  5. Test `test_merged_tactic_gets_one_301_per_locale_and_dropped_one_none`: trong danh sách kỳ vọng, sau dòng `/zh/tra-cuu/…` thêm `*lrh.renamed_page_redirect_lines(),`.
  6. Test `test_current_season_slug_is_301_to_the_list_and_follows_the_default_season`: thêm `n = len(lrh.renamed_page_redirect_lines())` ở đầu; hai chỗ `lines[-2:]` thành `lines[-2 - n:-n]`.
  7. Test `test_committed_redirects_match_the_ledger`: `self.assertEqual(len(rules), 2 * pairs + 2 + len(lrh.renamed_page_redirect_lines()))`; `self.assertTrue(all(line.endswith("/ 301") or line in lrh.renamed_page_redirect_lines() for line in rules))`.
  8. Thêm vào `RealLedgerTest` test `test_renamed_page_rules_are_exact_and_splat_rules_come_last`:
     - `s = lrh.RENAMED_PAGE_STATUS`; `assertIn(s, (301, 302))`.
     - `lrh.renamed_page_redirect_lines()` bằng đúng 4 dòng ở Goal, với mã thay bằng `s`.
     - Đọc `lrh.DEFAULT_REDIRECTS_PATH`, lấy các dòng không bắt đầu bằng `#`: 2 dòng cuối chứa `/:splat {s}`, và không dòng nào trước đó chứa `*` hoặc `:splat`.
  9. `python3 -m pipeline.lookup_route_handles --write`
- Success criteria: chỉ `public/_redirects` đổi do bước 9 (ledger không đổi).
- Verify:
  - `python3 -m unittest tests.test_lookup_route_handles` exit 0 và in `OK`.
  - `python3 -m pipeline.lookup_route_handles --check` exit 0.
  - `tail -n 4 public/_redirects` in đúng 4 dòng ở Goal.
  - `git status --short pipeline/lookup-route-handles.json` in rỗng.

### Task 3.4 — Verifier dist
- Goal: `npm run verify` đòi trang cộng đồng ở đường dẫn mới.
- Target files and symbols: `scripts/verify-astro-dist.mjs` `COMMUNITY_PAGES`.
- Steps:
  1. `localizedHtmlPath("doi-cong-dong/index.html", locale)` → `localizedHtmlPath("doi-tu-build/index.html", locale)`.
- Success criteria: không còn `doi-cong-dong` trong file.
- Verify: no verification needed (task 3.7).

### Task 3.5 — Link và page key phía client
- Goal: mọi link và page key đội dùng một hằng `TEAM_PAGE_PATH = '/doi-tu-build/'`.
- Target files and symbols: `js/community-api.js` (`PAGE_KEY_PATTERN`, `communityPageHref`), `js/community-teams.js` (`hrefFor`, `pageKey` trong `detailView`, import từ `./community-api.js`), `js/community-auth.js` (import, hai link đội), `js/community-admin.js` (import, `pagePath`, mục `hash: 'doi-cong-dong'`, chú thích đầu file), `js/community-admin-teams.js` (chú thích đầu file), `src/components/community/ReportsHub.astro`, chú thích đầu `CommunityTeamsHub.astro` và `CommunityTeamsPage.astro`.
- Steps:
  1. `community-api.js`: sau `PAGE_KEY_PATTERN` thêm chú thích `/** Đường dẫn trang Đội tự build (không locale); page key của một đội là \`${TEAM_PAGE_PATH}<id>/\`. */` và `export const TEAM_PAGE_PATH = '/doi-tu-build/';`. Trong `communityPageHref`: regex thành `/^\/doi-tu-build\/([a-z0-9][a-z0-9-]{0,63})\/$/u`, nhánh khớp trả `localePath(\`${TEAM_PAGE_PATH}?id=${match[1]}\`, locale)`; chú thích JSDoc đổi đường dẫn.
  2. `community-teams.js`: thêm `TEAM_PAGE_PATH` vào import từ `./community-api.js`; `hrefFor` dùng `localePath(TEAM_PAGE_PATH)`; `` const pageKey = `${TEAM_PAGE_PATH}${team.id}/`; ``; chú thích đầu file đổi đường dẫn.
  3. `community-auth.js`: thêm `TEAM_PAGE_PATH` vào import; link đội → `localePath(TEAM_PAGE_PATH)`; link `?mine=1` → ``localePath(`${TEAM_PAGE_PATH}?mine=1`)``. Giữ nguyên nhãn hiện có (nhãn của `?mine=1` theo PR #36).
  4. `community-admin.js`: thêm `TEAM_PAGE_PATH` vào import từ `./community-api.js`; trong `pagePath`, `page.startsWith('/doi-cong-dong/')` → `page.startsWith(TEAM_PAGE_PATH)`; `hash: 'doi-cong-dong'` → `hash: 'doi-tu-build'`; chú thích đầu file `#doi-cong-dong` → `#doi-tu-build`.
  5. `ReportsHub.astro`: `localePath('/doi-cong-dong/', locale)` → `localePath('/doi-tu-build/', locale)`.
  6. Chú thích đầu `CommunityTeamsHub.astro` và `CommunityTeamsPage.astro`: `/doi-cong-dong/` → `/doi-tu-build/`.
  7. `js/community-admin-teams.js` chú thích đầu file: `#doi-cong-dong` → `#doi-tu-build`.
- Success criteria: trong `js/` và `src/` không còn đường dẫn hay page key `doi-cong-dong`. Chỉ còn nhãn tên, chú thích tên, và id neo `id: 'doi-cong-dong'` của `src/components/pages/PrivacyPage.astro`; cả ba đổi ở phase 5.
- Verify: grep `/doi-cong-dong|#doi-cong-dong|'doi-cong-dong'` trong `js` và `src` chỉ còn đúng 1 kết quả, nằm trong `src/components/pages/PrivacyPage.astro`; `node --check js/community-api.js && node --check js/community-teams.js && node --check js/community-auth.js && node --check js/community-admin.js` exit 0.

### Task 3.6 — E2E theo đường dẫn mới
- Goal: `tests-e2e/community-teams.spec.mjs` dùng `/doi-tu-build/` và `#doi-tu-build`.
- Target files and symbols: `tests-e2e/community-teams.spec.mjs`.
- Steps:
  1. Thay mọi `doi-cong-dong` trong file bằng `doi-tu-build` (đường dẫn, page key, hash, tên test, chú thích). Không đổi nhãn hiển thị (phase 5), không đổi kỳ vọng nhãn mà PR #36 đã đặt cho link `?mine=1`.
- Success criteria: file không còn `doi-cong-dong`.
- Verify: no verification needed (task 3.7).

### Task 3.7 — Cổng của phase
- Goal: build, verify, test xanh với route mới; commit chỉ chứa file của phase.
- Target files and symbols: worktree `feat/doi-tu-build`.
- Steps:
  1. `npm run test:node`
  2. `npm run build`
  3. `npm run verify`
  4. `npm run test:dist`
  5. `npx playwright test tests-e2e/community-teams.spec.mjs`
  6. `python3 -m pipeline.site_localization check --root . --stage public`
  7. `git add src/pages/doi-tu-build src/pages/zh/doi-tu-build public/_headers public/_redirects tests-js/pages-headers-contract.test.mjs pipeline/lookup_route_handles.py tests/test_lookup_route_handles.py scripts/verify-astro-dist.mjs js/community-api.js js/community-teams.js js/community-auth.js js/community-admin.js js/community-admin-teams.js src/components/community/ReportsHub.astro src/components/community/CommunityTeamsHub.astro src/components/pages/CommunityTeamsPage.astro tests-e2e/community-teams.spec.mjs` (phần xoá thư mục cũ đã được `git mv` ở task 3.1 stage sẵn) <!-- Red Team #2 -->
  8. `git diff --cached --name-only`
  9. `git commit -m "feat(site): move team pages to /doi-tu-build/ with generated 302s from /doi-cong-dong"`
- Success criteria: mọi lệnh exit 0; commit chỉ chứa file của phase.
- Verify:
  - Lệnh 1–6 exit 0.
  - Sau bước 2: `test -f dist/doi-tu-build/index.html && test -f dist/zh/doi-tu-build/index.html && test ! -e dist/doi-cong-dong` exit 0, và `tail -n 4 dist/_redirects` in đúng 4 dòng của task 3.3.
  - Playwright in `passed`, không có `failed`.
  - Bước 8 không có `docs/design/` hay `scripts/design-canvas/shot.mjs`.

## Risk

- Rule splat đặt giữa file biến các rule tĩnh sau nó thành động: test task 3.3 bước 8 khoá thứ tự.
- Bookmark cũ `/quan-tri/#doi-cong-dong` mở khu mặc định: chấp nhận (plan.md "Không làm").
- `feedback.page` lịch sử còn `/doi-cong-dong/?id=…`: `pagePath` trả nguyên đường dẫn, chuyển hướng đưa tới trang mới.

## Security

- `_redirects` chỉ chuyển trong cùng origin; không có đích ngoài site.

## Failure Protocol
If any Verify step does not meet its stated pass condition, STOP this phase.
Do not improvise a fix, retry blindly, or reason around the failure.
Spawn the `kongming` subagent for next-step counsel and pass:
- the phase and task id,
- what you attempted (the steps you ran),
- the exact command and its full output,
- the pass condition it failed to meet.
Apply kongming's guidance, then re-run the Verify step.
If `kongming` cannot be spawned in this environment, STOP and report the same
failure evidence to the user. Never continue by self-reasoning.
