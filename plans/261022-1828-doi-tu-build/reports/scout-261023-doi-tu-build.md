# Báo cáo scout: plan "Đội tự build / 自配阵容"

Repo `/Users/plateau/Project/CamNangTQCCL`, nhánh `main`, HEAD `0f89e2e`. Chỉ đọc, không chạy build, test hay migration.

Tag: **[đã kiểm]** = đọc trực tiếp trên main ở file:line này. **[suy luận]** = kết luận của tôi từ bằng chứng, chưa kiểm trực tiếp.

## 1. Bản đồ tham chiếu `doi-cong-dong` / `Đội cộng đồng` / `社区阵容` / `community-team`

Cột "ghim" nghĩa là file có nằm trong `sourceFiles` của `pipeline/site-localization-policy.json`.

**Điểm quan trọng: không file nào trong nhóm cộng đồng nằm trong `sourceFiles`.** [đã kiểm: grep regex `community|view-tree|team-data|team-form|team-state|community-admin` trong policy không khớp]. Hệ quả: sửa các file `js/community-*.js` và `js/view-tree.js` không kéo theo chuỗi publish localization. [suy luận: cần kiểm lại với `pipeline/site_localization.py` nếu muốn chắc tuyệt đối.]

Các file trong `sourceFiles` có liên quan gián tiếp (đã kiểm, `pipeline/site-localization-policy.json:761-803`): `js/render.js`, `js/team-detail*.js`, `js/lookup-*.js`, `js/site-chrome.js`, `js/site-nav.js`, `js/turnstile.js`, `js/unified-lookup.js`, `js/website-display.js`, `src/components/landing/Landing.astro`, `data/teams.json`, `data/season-content-links.json`, `pipeline/*.json`. Không file nào trong số này chứa `doi-cong-dong`.

| Khu | File:dòng | Ghim? |
|---|---|---|
| Client trang đội | `js/community-teams.js:111-113` (`hrefFor` → `localePath('/doi-cong-dong/')`), `:129-134` (tab Danh sách / Đăng đội `new=1` / Đội của tôi `mine=1`, nhãn `社区阵容`), `:309-333`, `:479-498` (`pageKey = /doi-cong-dong/${team.id}/` tại `:486`) | Không |
| Client form | `js/community-team-form.js:2-3, 24, 25-31, 67, 147, 294, 314, 414-415` | Không |
| Client state | `js/community-team-state.js:4-22, 33, 82, 104` (`TeamFormError` định nghĩa tại `:16-22`) | Không |
| Client API | `js/community-api.js:11` (`PAGE_KEY_PATTERN` chỉ `doi-chuan|doi-khac|khai-hoang`, không chứa `doi-cong-dong`), `:147-155` (`communityPageHref` → `/doi-cong-dong/?id=`) | Không |
| Admin | `js/community-admin.js:1925-1931` (`hash: 'doi-cong-dong'`), `:303`, `:1590`; `js/community-admin-teams.js:17,31,218,235,339,353`; `js/community-auth.js:66-69` (menu: `localePath('/doi-cong-dong/')` và `'/doi-cong-dong/?mine=1'`) | Không |
| Dữ liệu client | `js/community-team-data.js:111-112` | Không |
| Renderer | `js/view-tree.js` (toàn file; không có HTML thô) | Không |
| Trang Astro | `src/components/pages/CommunityTeamsPage.astro:2-3, 16-24` (`robots="noindex"` `:20`, script `:24`); `src/components/community/CommunityTeamsHub.astro:14,17`; `ReportsHub.astro:30`; `AdminConsole.astro:18`; `src/components/pages/PrivacyPage.astro:88-89, 187-188, 205-206, 215-216` | Không |
| Route/sitemap | `src/lib/locale-routes.ts:18-19` `COMMUNITY_PATHS = ['/chien-bao/', '/quan-tri/']` (**không có** `/doi-cong-dong/`); `src/pages/sitemap.xml.ts:16-20` `SECTION_PATHS` (không có `/doi-cong-dong/`) | Không |
| Public | `public/_headers:38-39` (`/doi-cong-dong/*`); `public/_redirects` (**không có** dòng nào cho `doi-cong-dong`) | Không |
| Kiểm build | `scripts/verify-astro-dist.mjs:80-85` `COMMUNITY_PAGES` (chien-bao, doi-cong-dong, quan-tri × mỗi locale, mount `id="community-teams"`, entry `/js/community-teams.js`) | Không |
| Test | `tests-js/pages-headers-contract.test.mjs:21, 124, 145` (cả `/doi-cong-dong/*` và `/zh/doi-cong-dong/`); `tests-e2e/community-teams.spec.mjs`; `tests-e2e/helpers/community-mock.mjs:179-217` | Không |
| Canvas | `scripts/design-canvas/capture-community.mjs:102-130`; `scripts/design-canvas/canvas-page.mjs:31-36` (không có doi-cong-dong) | Không |
| CSS | `css/styles.css:14958-14960` | Không |
| Blog SEO | `src/lib/blog-seo.ts:252` `link('推荐阵容', '/zh/doi-chuan/', …)` | Không |

Ghi chú: `src/lib/blog-posts.ts:182-265` có `safeHref`/`safeImageSrc` riêng, không dùng chung với `js/community-admin.js:39-50`.

## 2. Luồng form client (`js/community-team-form.js`)

- Đăng nhập và khởi tạo: `mountTeamForm(container, {season, locale, getLexicon, teamHref, onSubmitted})` tại `:67`.
- Ràng buộc đầu vào: `MAX_IMAGES = 3` (`:24`); `OPTIONAL_FIELDS` gồm strengths, weaknesses, counters, counteredBy, substitutes (`:25-31`); `TITLE_MAX=80`, `PLAYSTYLE_MIN=10`, `TEXT_MAX=3000`, `OPTIONAL_MAX=2000`, `MAX_UPLOADS=3` (`js/community-team-state.js:9-12`).
- Upload ảnh: `POST /api/community-teams/uploads` multipart field `image`, blob `team.jpg`, ảnh được thu nhỏ bằng `downscaleImage` (1600px, JPEG 0.82, `js/community-api.js:280`) tại `js/community-team-form.js:294`.
- AI đọc nháp: `POST /api/community-teams/uploads/:id/analyze` tại `:314`; kết quả điền vào form qua `applyRead` (`:248`) và `applyDraft` (`:219`).
- Kiểm tương đồng: `checkSimilar` gọi `GET /api/community-teams?heroes=…&season=all` (`:147`); cảnh báo do `similarWarning` (`js/community-team-state.js:104`).
- Submit: `teamPayloadFromDraft` (`js/community-team-state.js:33`) ném các mã `invalid_heroes|invalid_tactics|invalid_title|invalid_troop|invalid_text|invalid_uploads`; `POST /api/community-teams` JSON tại `js/community-team-form.js:414`; `onSubmitted()` tại `:415`.
- Thông báo lỗi: `js/community-api.js:31-55` (`statusMessage`: 400/422, 401, 403, 404, 409, 413, 415, 429 "Bạn thao tác quá nhanh…"), `:56-` (`codeMessage`: `ai_overloaded`, `ai_unavailable`, `ai_not_configured`, `feature_disabled`).
- Chế độ đọc từ query: `modeFromSearch` (`js/community-team-state.js:82`): `list|detail|new|mine` với `id`, `new=1`, `mine=1`.
- Nháp: **chưa có** code `localStorage` cho nháp trong ba file đã đọc [đã kiểm bằng đọc các đoạn đã nêu; suy luận: toàn repo cũng chưa có, cần grep `localStorage` nếu cần chắc chắn].

## 3. Worker: routes, validate, test

### 3.1 Route và middleware (`community-worker/src/app.ts`)
- `:13-22` import routes; `:32` `createApp`; `:37-45` `app.onError` (ApiError → errorResponse, còn lại 500 `internal_error`).
- `:51` `app.use("*")` gắn deps; `:53` Better Auth `/api/auth/*`; `:55-66` `app.use("/api/*")` kiểm `Origin` (`forbidden_origin`), `no-store`.
- `:91-104` `app.route` cho comments, feedback, reports, posts, recruit, roster, ai, scan, teams, audit, users, admin.
- **Không có middleware MAINTENANCE** [đã kiểm: không có trong `app.ts`]. Đây là cơ chế cần thêm mới theo thiết kế.

### 3.2 `community-worker/src/routes/teams.ts`
- `:61-62` `pageKeyOf(teamId) = /doi-cong-dong/${teamId}/`.
- `:65-` `TeamRow`; `~93-107` `TEAM_SELECT` (`comment_count` đếm theo `page_key = '/doi-cong-dong/' || t.id || '/'`); `~109` `TEAM_FROM`; `~111` `toItem`; `~127` `analysisOf`; `~138` `teamIdParam` (404 nếu sai page); `~143` `openSeason`; `~150` `removeQuietly`; `~160` `mayViewHidden`; `~171` `etagMatches`; `~180` `export const teams = new Hono`.
- Routes:
  - `~181` GET `/api/community-seasons`.
  - `:204` POST `/api/community-teams/uploads`: `parseImageUpload`, rate `team_upload`, R2 key `pending/<uploadId>`, bảng `uploads` kind `report`.
  - `:227` POST `/uploads/:id/analyze`: `FEATURE_ENABLED` → 503 `feature_disabled` (`:229-230`); `ai_not_configured` 503; rate `team_analyze` + `team_analyze_global`; 422 → `{read:{screen:"other",sides:[]}}`; 502 → `ai_unavailable`.
  - `:265` POST `/api/community-teams`: `openSeason` (409 `season_not_open`); rate `team_post` 5/ngày; kiểm ảnh (409 `image_missing`); copy R2 `pending/` → `community-teams/<teamId>/<position>.<ext>` (~`:292`); batch insert `community_teams` và `community_team_images`; xoá `uploads`; 201 `{id, status:"pending"}`.
  - `:355` GET `/api/community-teams` (sort hot/new/top, heroes, season, cursor, PAGE_SIZE+1).
  - `~393` GET `/api/community-teams/export` (`schemaVersion: 1`).
  - `:412` GET `/api/me/community-teams`.
  - `:440` GET `/api/community-teams/:id`; `:464` GET `/:id/images/:pos` (pos 0–2).
  - `:495` PUT `/:id/vote`.
  - `:561` DELETE `/api/community-teams/:id`: chốt `deleting_at` kèm audit `team.delete`; `has_evidence` 409 khi chủ xoá mà có chiến báo approved của người khác (~`:600-603`); R2 xoá trước, lỗi → 502 `delete_incomplete`; batch cuối xoá comments, uploads, battle_reports, community_teams; `triggerDeploy` khi đội đang approved.
  - `~686` `REVIEW_STATUSES = pending|approved|rejected|deleting`; `~688` GET `/api/admin/community-teams`; `~787` `reviewTeam(...)` (audit trước update `pending`; 409 `not_pending`); `~787` POST `/approve` (`triggerDeploy`, `settle`); `~798` POST `/reject` (`reason` 1–500).

### 3.3 `community-worker/src/teams-validate.ts`
- `:6-7` `SEASON_ID_RE`, `TROOPS` (cung, khiGioi, ky, thuan, thuong); `:12-14` `TEAM_HEROES=3`, `TACTICS_PER_HERO=2`, `MAX_UPLOADS=3`, `UPLOAD_ID_RE`.
- `~33` `optionalText` (max 2000); `~40` `TeamInput`; `~58` `heroKey`; `~62` `parseHeroes3`; `~70` `parseTactics`; `~84` `parseTroop`; `~88` `parseUploadIds`; `~102` `parseTeamInput` (title 1–80, playstyle 10–3000, optional ≤2000, lang, uploadIds 1–3).
- `:1` chỉ có literal `doi-cong-dong` trong comment; không có literal trong code [đã kiểm].

### 3.4 `community-worker/src/validate.ts`
- `:5-7` `PAGE_KEY_RE`: `/doi-chuan|doi-khac|khai-hoang` slug ≤120, hoặc `/doi-cong-dong/<slug ≤64>/`; `:8` `COMMUNITY_TEAM_PAGE_RE`; `:31-33` `communityTeamIdFromPage`.
- `~26` `parsePageKey` (`invalid_page`); `~36` `parseId`; `~45` `parseLang`; `~55` `parseText`; `~63` `parseOptionalText`; `~80` `parseResult`; `~87` `readJson` (415); `~115` `parseImageUpload` (413 `image_too_large`, 415 `invalid_image_type`, `missing_image`).

### 3.5 `community-worker/src/ratelimit.ts:29-38` (`RATE_RULES`)
- `team_upload` 30/DAY (`:30`); `team_analyze` 20/DAY (`:31`); `team_analyze_global` 300/DAY (`:33`); `team_post` 5/DAY (`:34`); `team_vote` 120/HOUR (`:35`). `consumeRateLimit` ~`:37`.

### 3.6 `community-worker/src/cleanup.ts`
- `:4` `PENDING_TTL_MS = 24h`: xoá R2 prefix `pending/` quá hạn, xoá `uploads where status='pending'` cũ, xoá `rate_limits` hết hạn. **Không** xoá prefix `community-teams/` [đã kiểm].

### 3.7 `community-worker/src/routes/reports.ts`
- `~80-86` `listReports`; `~90-93` `communityTeamVisible` (dùng `communityTeamVisibleSql`); `~96` `teamRefusal` (409 `season_closed` / 404); `~101-105` `/api/reports/analyze` với `FEATURE_ENABLED`.

### 3.8 `community-worker/src/routes/users.ts`
- `~384-395` `inventoryKeys`: `TEAM_PAGES` (`:394` `select '/doi-cong-dong/' || id || '/' from community_teams where author_id = ?`) và `battle_reports r where r.page_key in (${TEAM_PAGES})`. Khi đổi URL sang `/doi-tu-build/`, nhánh này phải đổi cùng.
- `~400` `users.delete("/api/admin/users/:id")`.

### 3.9 Migration và trigger
- `community-worker/migrations/`: 0001_better_auth, 0002_community, 0003_feedback, 0004_recruit, 0005_scan, 0006_user_admin, 0008_community_teams, 0011_roster. **Không có** 0007, 0009, 0010 trong thư mục này [đã kiểm]; 0009/0010 nằm ở `community-worker/rollback/`. Migration mới theo thiết kế: `0012`.
- `0008_community_teams.sql:103-128`: ba trigger `battle_reports_team_evidence_{ins,upd,del}` với điều kiện `like '/doi-cong-dong/%'` tại `:107`, `:116`, `:125`. Khi đổi page_key sang `/doi-tu-build/` phải cập nhật các điều kiện này trong `0012` (suy luận: cần để evidence_count không về 0).
- `rollback/0009_drop_community_team_triggers.sql:1-5`; `rollback/0010_restore_community_team_triggers.sql:6,15,24,34`.

### 3.10 Test worker (`community-worker/test/`, 28 file)
- `teams-validate.test.ts:244-272`; `teams.test.ts:10-11, 145-155, 196-222, 430-439, 617-618`; `users.test.ts:866-942` (TEAM `/doi-cong-dong/t1/`, `:912` R2 keys); `visibility.test.ts:162-182`; `comments.test.ts:86-121`; `reports.test.ts:300-404`; `audit.test.ts:520-524`; `permissions.test.ts:100-103, 173-187`; `site-publish.test.ts:9-22, 98-102`; `teams-admin.test.ts:14, 31-32, 100-102, 159`; `teams-analyze.test.ts:9, 39-41`; `teams-export.test.ts:9, 67, 89-90, 127-128`; `teams-schema.test.ts:120-181, 244-245, 274-278`.
- `test/fakes.ts:377-427`: `seedSeason` `:379`, `seedTeam`, R2 key `community-teams/${t.id}/${i}.png` `:423-427`.

## 4. Renderer (`js/view-tree.js`, `js/community-admin.js`)

- `js/view-tree.js` (toàn file): `:6` `h(tag, attrs, children)`; `:17-18` `VOID`, escape; `:30` `treeToHtml`; `:44` `treeToDom` (dùng `globalThis.document`, `createElementNS` cho svg, nên chạy được cả Node lẫn browser theo chữ ký); `:58` `disableButtons`; `:65` `enableControl`; `:72-` `TEXT_BLOCKS`, `treeToText` (dùng cho llms). Không có HTML thô [đã kiểm].
- Import hiện có: `src/lib/llms-documents.ts:15`, `src/lib/lookup-item-pages.ts:11`, `js/hero-portrait.js:8`, `js/render.js:7`, `js/lookup-master.js:7`, `js/lookup-page.js:10`, `js/lookup-profile.js:19`, `js/lookup-tactic-profile.js:15`, `js/unified-lookup.js:11`, `js/team-detail.js:18`, `js/team-filter-section.js:133`, `js/khaihoang-detail.js:13`, `js/recommended-reference-render.js:7`.
- `js/community-admin.js:34-144`: banner `:34-`; `safeHref` `:39-44`; `safeImageSrc` `:46-50`; `INLINE_PATTERN` `:52`; `inlineNodes` `:54-80`; `renderMarkdown` export `:78-` (tiêu đề `#`→h2+, code fence, hr, list, blockquote `:130`, đoạn). Đây là renderer Markdown hiện có cho admin; thân bài `body_md` có thể tái dùng [suy luận: cần xem xét để đưa vào `view-tree` hoặc giữ riêng].
- Lỗi UI đã ghi nhận trong design: `design/so-binh-phap/README.md:79-84` (thẻ đội không có ảnh hiện chữ "null" vì `js/community-teams.js` truyền `null` vào `card.append`; trang có hai tiêu đề "Đội cộng đồng" liền nhau; nút "×" của thông báo bị khoá xuống dòng).

## 5. Route Astro, `_headers`, `_redirects`, sitemap, Privacy

- **Route Astro**: `src/pages/doi-cong-dong/` và `src/pages/zh/doi-cong-dong/` [đã kiểm: thư mục tồn tại qua glob]. Trang dùng `CommunityTeamsPage.astro` (`robots="noindex"`, `:20`).
- **`public/_headers`**: `:38-39` `/doi-cong-dong/*`. `tests-js/pages-headers-contract.test.mjs:21` (expectedRules gồm `/doi-cong-dong/*`), `:124` (danh sách `/doi-cong-dong/` và `/index.html`), `:145` (`/zh/doi-cong-dong/`). Đổi URL phải sửa cả ba chỗ này.
- **`public/_redirects`**: `:1` dòng header "Sinh bởi python3 -m pipeline.lookup_route_handles --write; không sửa tay." Không có dòng nào cho `doi-cong-dong`.
- **Generator** `pipeline/lookup_route_handles.py` [đã kiểm]:
  - `:37` `DEFAULT_REDIRECTS_PATH`; `:39` `REDIRECTS_HEADER`.
  - `:267-280` `redirects_bytes(former_map, ledger, season_lines=())`: sinh `old new 301` cho từng chiến pháp đã gộp, theo từng prefix locale (`:278`), rồi `lines.extend(season_lines)` (`:279`).
  - `:283` `write_ledger`; `:316` `check_ledger`; `:332` `main` (`--write`, `--check`).
  - Hệ quả [suy luận]: 301 `/doi-cong-dong/*` → `/doi-tu-build/*` không có sẵn trong generator. Cần mở rộng generator (thêm `season_lines` hoặc tham số mới) thay vì sửa tay, vì file ghi rõ "không sửa tay". Đây là điểm thiết kế cần chốt.
- **Kiểm build**: `scripts/verify-astro-dist.mjs:35` (sourcePath `public/_redirects`); `:720-723` kiểm từng dòng `seasonRedirectRules` có trong `_redirects` đã build.
- **`src/lib/season-pages.ts:108-112`** `seasonRedirectRules`: 301 cho slug mùa hiện tại về `/doi-chuan/` (vi + zh). Đây là mẫu cho luật 301 mới.
- **Sitemap**: `src/pages/sitemap.xml.ts:16-20` `SECTION_PATHS` không có `/doi-cong-dong/`; `:55`, `:63-65` `mirroredSitemapPaths`; `:117` `sitemapLocations`; `:160-175` `GET`. `/doi-cong-dong/` không được liệt kê [đã kiểm]. Trang noindex, nên không bị index.
- **`src/lib/locale-routes.ts:18-19`** `COMMUNITY_PATHS = ['/chien-bao/', '/quan-tri/']` (không có `/doi-cong-dong/`); `:23-24` `localizedHtmlPath`; `:26-` `AlternateLink`, `alternatePaths`, `mirroredAlternates` (~`:46-51`). [suy luận: `/doi-cong-dong/` không có trong danh sách này, nên không bị coi là trang cộng đồng cho hreflang/noindex; cần đọc thêm nếu plan muốn thêm `/doi-tu-build/` vào đây.]
- **Privacy**: `src/components/pages/PrivacyPage.astro:88-89, 187-188, 205-206, 215-216` có nhắc đội cộng đồng; cần cập nhật theo plan 261021 "Xong khi".
- **`src/lib/public-artifact-manifest.mjs:31-34`**: khai báo artifact công khai, không có doi-cong-dong.

## 6. Lệnh chuẩn, chuỗi publish, quy ước test, fakes

**`package.json` gốc** [đã kiểm]:
- `build` = `python3 -m pipeline.site_localization check --root . --stage public && astro build`.
- `check` = như trên + `astro check`.
- `verify` = `site_localization check` + `node scripts/verify-astro-dist.mjs` + `node scripts/report-zh-gaps.mjs --check`.
- `test:dist` (3 file tests-js); `test:node` (`tests-js/*.test.mjs`); `test:e2e` = `playwright test`; engines `node >=24.20.0 <25`.

**`community-worker/package.json`** [đã kiểm]: `dev` (wrangler dev, port 8788); `deploy` (wrangler deploy); `db:migrate:local` và `db:migrate:remote` = `wrangler d1 migrations apply tqccl-community`; `test` = `vitest run`; `typecheck` = `tsc --noEmit`.

**Chuỗi publish localization** [đã kiểm: `docs/deployment-guide.md:254-270`]:
```
python3 -m pipeline.site_localization inventory --root . --report <file>      # :262
python3 -m pipeline.site_localization build --root . --stage all --output .cache/site-localization-candidate   # :263
python3 -m pipeline.site_localization check --root . --stage all --candidate .cache/site-localization-candidate  # :264
python3 -m pipeline.site_localization publish --root . --candidate .cache/site-localization-candidate  # :265
python3 -m pipeline.site_localization check --root . --stage public          # :266
python3 -m pipeline.team_route_handles --check                              # :268
npm run build && npm run verify && npm run test:dist                        # :269
```
Dòng `:256`: mọi thay đổi trong `sourceFiles` phải đi qua chuỗi này. Vì mục 1 cho thấy nhóm cộng đồng không ghim, chuỗi này **không bắt buộc** cho thay đổi cộng đồng [suy luận, dựa trên grep policy].

**Mã nguồn Localization**: `pipeline/site_localization.py:1050-1053` (sourceFiles không rỗng), `:1164-1171` (fresh/stale/missing theo hash), `:2321-2324` (báo cáo sourceFiles) [đã kiểm].

**Quy ước migration test**: `tests/test_lookup_route_handles.py` (Python) và worker test dùng `test/fakes.ts` [đã kiểm: liệt kê thư mục].

## 7. Trạng thái các plan

**`plans/261021-0628-doi-cong-dong/plan.md`** [đã đọc]:
- Frontmatter: `status: in-progress`, `priority: P1`, `effort: 7d`, `branch: main`, `created: 2026-10-21`.
- Phase 1–6: completed. Phase 7 `docs/triển khai`: in-progress (còn bước remote, chờ duyệt).
- Ràng buộc: không sửa migration `0001`–`0006` đã áp dụng; không sửa file pin; deploy theo thứ tự migration → Worker → push `main` → chạy tay `pages-deploy.yml`.
- "Xong khi" còn chưa tick (`- [ ]`).

**`plans/261022-1109-dot-gom-9-issue/plan.md`** [đã đọc]:
- Frontmatter: `status: in-progress`, `effort: 13d`, `issue: 14`.
- Phase 10 (`#36`) mở, chưa merge (`25884a5`). Phase 11 pending, cần người dùng.
- Hàng nối tiếp 5→7→8→9→10 sửa file ghim, nên phải chạy lại chuỗi "Publish lại bản dịch hiển thị".
- Cộng đồng: Stage A PR #32 merged (`a7e217b`); Stage B nhánh `feat/doi-cong-dong-cong-khai` chưa mở PR; phải rebase lên `feat/trang-mua-doi-chuan` trước phase 10.
- Mốc rollback: `main` = `5b6014a`.

**`plans/261022-1145-doi-cong-dong-cong-khai/`**: chưa đọc qua `git show`. Theo brief, đây là Stage B. Không xác minh nội dung [chưa kiểm].

**Nhật ký**: `plans/journals/261022-2330-cook-dot-gom-9-issue.md`, `261022-1830-plan-dot-gom-9-issue.md` [có tồn tại].

**Triển khai** [đã kiểm: `docs/deployment.md:15-17, 42-47`]:
- Worker `tqccl-community` version `771191b8-8ca8-4c19-bb05-4e4f91465e7b`, source `99de31c`.
- Rollback target `c04a352c-9bf7-45c1-8b42-fd60eabb1a6b`.
- D1 `0011_roster.sql` đã áp dụng ngày 2026-10-22 ~17:45 UTC.
- Pages workflow: Worker dispatch `site-publish`; `pages-deploy.yml` nhận `blog-publish` và `site-publish`. GitHub Actions minutes đã hết [đã kiểm], nên không có run Pages nào chạy.

## 8. `docs/` cần cập nhật

Đã kiểm vị trí dòng:
- `docs/community-worker.md:21` (bảng binding MEDIA, mô tả `pending/team-<uploadId>`, `community-teams/<teamId>/`); `:269-346` (mục "Đội cộng đồng", gồm `:271` mô tả trang, `:278` trigger, `:295-297` quyền xem và bình luận, `:307-317` API đọc và ghi, `:321-322` admin, `:327` mùa, `:331-334` AI đọc nháp, `:339-344` xoá).
- `docs/codebase-summary.md:76-77` (bảng file, gồm đường dẫn `js/community-team-data.js` và `CommunityTeamsPage.astro`).
- `docs/deployment.md:15-17, 42-47` (cập nhật phiên bản Worker và D1 sau release).
- `docs/deployment-guide.md:254-270` (chuỗi publish, nếu plan đổi file ghim).
- `design/so-binh-phap/README.md:75-84` (tài liệu thiết kế đã chụp; ghi lỗi UI cũ).
- `docs/system-architecture.md`, `docs/project-changelog.md`, `docs/design-guidelines.md`: [chưa grep dòng cụ thể; theo plan 261021 "Xong khi" cần cập nhật].
- `src/components/pages/PrivacyPage.astro` (vi và zh): `:88-89, 187-188, 205-206, 215-216`.

## Khác với brief

1. `teams.ts` `pageKeyOf` nằm ở `:61-62` (brief ghi `:62`). `TEAM_SELECT` ở khoảng `:93-107`.
2. `js/community-api.js:11` `PAGE_KEY_PATTERN` **không** chứa `doi-cong-dong` (brief giả định có).
3. `TeamFormError` định nghĩa tại `js/community-team-state.js:16-22`, không thiếu.
4. `teams-validate.ts` **không có** literal `doi-cong-dong` trong code, chỉ có trong comment `:1`.
5. `public/_redirects` **không có** dòng `doi-cong-dong`. Generator là `pipeline/lookup_route_handles.py:267-280` và chỉ sinh luật cho chiến pháp đã gộp và mùa hiện tại.
6. **Không có middleware MAINTENANCE** trong `community-worker/src/app.ts`.
7. Không có migration `0007`, `0009`, `0010` trong `community-worker/migrations/`; 0009/0010 ở `community-worker/rollback/`.
8. Các file `js/community-*.js` và `js/view-tree.js` **không** nằm trong `sourceFiles` ghim hash. Brief giả định khác. Hệ quả: sửa chúng không bắt buộc chạy chuỗi publish localization.
9. `src/lib/locale-routes.ts:18-19` `COMMUNITY_PATHS` chỉ có `/chien-bao/` và `/quan-tri/`, không có `/doi-cong-dong/`.
10. `src/pages/sitemap.xml.ts:16-20` `SECTION_PATHS` không có `/doi-cong-dong/`.
11. Không có code `localStorage` cho nháp trong các file cộng đồng đã đọc.

## Việc cần chốt trước khi lập plan (suy luận)

- Luật 301 `/doi-cong-dong/*` → `/doi-tu-build/*` không có cơ chế sinh sẵn. Cần quyết định: mở rộng `pipeline/lookup_route_handles.py` hay thêm vào `_headers`/`_redirects` bằng cách khác, vì file ghi "không sửa tay".
- `0012` phải đổi cả ba điều kiện trigger `like '/doi-cong-dong/%'` (`0008_community_teams.sql:107,116,125`) và `inventoryKeys` (`users.ts:394`), không chỉ đổi `pageKeyOf`.
- `tests-js/pages-headers-contract.test.mjs:21,124,145` và `verify-astro-dist.mjs:80-85` cần đổi khi đổi URL.

## Đường dẫn file báo cáo

Không ghi được file. Cần lưu nội dung trên vào `plans/reports/scout-261023-doi-tu-build.md`; thư mục `plans/reports/` đã tồn tại.