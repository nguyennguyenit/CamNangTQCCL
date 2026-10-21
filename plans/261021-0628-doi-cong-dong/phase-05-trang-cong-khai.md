---
phase: 5
title: "Trang công khai /doi-cong-dong/ (vi + zh)"
status: completed
priority: P1
effort: "2d"
dependencies: [4]
---

# Phase 5 — Trang công khai `/doi-cong-dong/` (vi + zh)

<!-- Updated: Red Team 2026-10-21 - không sửa SiteLayout (#1), mountComments/mountReports thêm sharedPool + archived (#2), communityPageHref (#12), hàm thuần trong module không phải entry + mock e2e dùng chung (#14), books index rỗng + createByteLoader + createTacticIdResolver (#8, #15), bỏ /similar (#15) -->

## Mục tiêu
Một trang khung tĩnh `noindex` ở `/doi-cong-dong/` và `/zh/doi-cong-dong/` với 4 chế độ (danh sách, chi tiết `?id=`, đăng `?new=1`, của tôi `?mine=1`), tái dùng module cộng đồng và module đọc ảnh sẵn có; vào trang qua menu tài khoản và trang Chiến báo.

## Bằng chứng
- Mẫu trang: `src/components/pages/ReportsPage.astro` (`robots="noindex"`, `pageKind="detail"`), `src/components/community/ReportsHub.astro`, `js/community-hub.js` (entry tự chạy `initCommunityHub()` cuối file; `teamLink(report.page)` → `localePath(pageKey)` :15-17,26).
- API client: `js/community-api.js` (`api`, `loadSession`, `signInPrompt`, `unavailableNotice`, `downscaleImage` :247; `codeMessage` ~:60 **không export** — thêm mã trong file).
- `mountComments(container,{pageKey,lang,user})` `js/community-comments.js:40`, lọc `comment.lang !== lang` :70; `mountReports(container,{pageKey,lang,user})` `js/community-reports.js:276`, lọc `report.lang === lang` :289, luôn hiện `submitFlow` cho người đăng nhập :328. Caller hiện có: `js/community-page.js` (trang đội chuẩn).
- Đọc ảnh → nháp: `normalizeTeamRead` :283, `draftFromRead(result, {heroes,tactics,books})` :252 (dùng `indexes.books` khi có `booksCn`), `createEntityIndex` :164, `cellFromInput` :347 (`js/analyze-map.js`, bị pin → chỉ import).
- Dữ liệu: `createLookupPayloadLoader(fetchBytes)` `js/lookup-data.js:344` cần loader trả bytes → `createByteLoader()` `js/website-display.js:41`; `createTacticIdResolver(tactics)` `js/lookup-ids.js:117` (hiểu `formerIds`); chân dung `heroPortrait`/`activatePortraits` `js/hero-portrait.js` (pin: chỉ import).
- Sổ đăng ký trang: [scout-frontend-season](./reports/scout-frontend-season.md) §5 (`COMMUNITY_PAGES` `scripts/verify-astro-dist.mjs:77-81`, `public/_headers:35`, `tests-js/pages-headers-contract.test.mjs:20-21,123,144`, `tests-js/astro-dist-contract.test.mjs:324-327` — fixture lặp theo `COMMUNITY_PAGES`).
- `SiteLayout.astro` bị pin; sửa nó làm đổi `localizationInputsHash` và cả thế hệ bản dịch (`pipeline/site_localization.py:2059-2072,2136-2143`, tiền lệ commit `22e3ffd`) → **không sửa**.
- Mock e2e: `mockCommunityApi` cục bộ trong `tests-e2e/community.spec.mjs:59-188`.

## File
- Tạo: `src/pages/doi-cong-dong/index.astro`, `src/pages/zh/doi-cong-dong/index.astro`, `src/components/pages/CommunityTeamsPage.astro`, `src/components/community/CommunityTeamsHub.astro`
- Tạo: `js/community-teams.js` (entry: điều hướng chế độ, danh sách, chi tiết, của tôi), `js/community-team-form.js` (form + ảnh + AI), `js/community-team-data.js` (nạp dict, nhãn theo locale, chỉ mục id, resolver CP), `js/community-team-state.js` (hàm thuần, không đụng DOM)
- Sửa: `js/community-comments.js`, `js/community-reports.js` (tuỳ chọn mới, mặc định không đổi)
- Sửa: `js/community-api.js` (`communityPageHref(pageKey, locale)`; mã lỗi mới trong `codeMessage`: `season_closed`, `season_not_open`, `own_team`, `has_evidence`, `image_missing`, `delete_incomplete`, `invalid_heroes`, `invalid_tactics`)
- Sửa: `js/community-hub.js` (`teamLink` dùng `communityPageHref`)
- Sửa: `js/community-auth.js` (mục "Đội cộng đồng" → `localePath('/doi-cong-dong/')`, "Đội của tôi" → `?mine=1`)
- Sửa: `src/components/community/ReportsHub.astro` (link "Đội cộng đồng" trong khối giới thiệu)
- Sửa: `public/_headers`, `scripts/verify-astro-dist.mjs`, `css/styles.css` (lớp `cm-team-*`, dùng token có sẵn)
- Sửa: `src/lib/public-artifact-manifest.mjs` — đăng ký `community-teams`, `community-team-form`, `community-team-data`, `community-team-state` (route `src/pages/js/[file].js.ts` chỉ phát hành file có trong manifest; `root-static-artifacts.ts:163-171` và `tests-js/astro-dist-contract.test.mjs:398-416` đòi khớp tuyệt đối). Không nới lỏng hai kiểm tra đó. <!-- Astra A#1 -->
- Sửa test: `tests-js/pages-headers-contract.test.mjs`, `tests-js/astro-dist-contract.test.mjs` (fixture/kỳ vọng, không coi là test đỏ trước)
- Tạo: `tests-e2e/helpers/community-mock.mjs` (chuyển `mockCommunityApi` ra, thêm route đội); sửa `tests-e2e/community.spec.mjs` để import
- Tạo test: `tests-e2e/community-teams.spec.mjs`, `tests-js/community-team-state.test.mjs`

## Thiết kế

### Tuỳ chọn mới của widget
- `mountComments(container, {pageKey, lang, user, sharedPool = false})`: `sharedPool` → không lọc theo `lang`, mỗi bình luận có nhãn `[VI]`/`[ZH]`; bài mới vẫn gửi `lang` hiện tại.
- `mountReports(container, {pageKey, lang, user, sharedPool = false, archived = false})`: `sharedPool` như trên; `archived` → không render `submitFlow`, thay bằng ghi chú "Mùa đã lưu trữ — không nhận chiến báo mới" / "赛季已归档".
- Không truyền tuỳ chọn → hành vi cũ (`community-page.js` không đổi).

### `communityPageHref(pageKey, locale)`
`/doi-cong-dong/<id>/` → `localePath('/doi-cong-dong/?id=<id>', locale)`; key khác → `localePath(pageKey, locale)`. Dùng ở `community-hub.js` (phase này) và `pagePath` của admin (phase 6).

### Chế độ (đọc từ `location.search`, `history.pushState` khi chuyển)
1. **Danh sách** (mặc định): chọn mùa (`GET /api/community-seasons`, mặc định `open`, có "Tất cả mùa"; nhãn theo locale), lọc tướng (tối đa 3, datalist), sắp `Hot/Mới/Top`; thẻ: ảnh đầu (`/api/community-teams/:id/images/0`, `loading=lazy`), 3 chân dung + tên theo locale, tiêu đề, binh chủng, `▲ up ▼ down`, `⚔ evidenceCount người thắng`, `💬 commentCount`, tác giả, nhãn `[VI]/[ZH]`. "Xem thêm" theo cursor, khử trùng id. Không có mùa mở → "Chưa mở mùa", ẩn nút đăng.
2. **Chi tiết** `?id=`: ảnh 1–3 (trước/sau), bảng tướng × CP (CP qua `createTacticIdResolver`; id lạ → hiện thô), binh chủng, các mục phân tích (`textContent`, giữ xuống dòng) + nhãn ngôn ngữ, nút vote (`myVote`; tắt + chú thích khi `seasonOpen=false` hoặc `author.id` = id người xem lấy từ `/api/me`; khách → `signInPrompt`), "Đội tương tự" = `GET /api/community-teams?heroes=<heroKey>&season=all` bỏ chính nó, nút xoá (chỉ khi `author.id` = id người xem; xác nhận), trạng thái theo `status` (pending/rejected + lý do, cho chủ). Không so sánh tên hiển thị. Gắn `mountReports(…, {sharedPool:true, archived: !seasonOpen})` và `mountComments(…, {sharedPool:true})` với `pageKey = '/doi-cong-dong/<id>/'`. <!-- Astra A#11 -->
3. **Đăng** `?new=1`: yêu cầu đăng nhập; hiển thị mùa mở (chỉ đọc). Ảnh 1–3 ô: `downscaleImage` → `POST /api/community-teams/uploads`; "Đọc bằng AI" trên từng ảnh → `POST …/uploads/:id/analyze` → `normalized = normalizeTeamRead(read)` → `side = pickSide(normalized, choice)` (1 side → tự chọn; 2 side → bắt người dùng chọn; 0 side → nháp rỗng) → `draftFromRead({heroes: side.heroes}, {heroes, tactics, books: createEntityIndex([], 'book')})` (đúng cách `js/analyze.js:1174,1417` gọi; **không** truyền nguyên `{screen, sides}`) → điền 3 tướng + 6 CP; ô `unsure` tô cảnh báo, phải xác nhận/sửa. Ô nhập: datalist nhãn→id (`cellFromInput`); binh chủng `select` 5 giá trị; textarea. Đủ 3 tướng → gọi danh sách `heroes=…&season=all` → cảnh báo "Đã có N đội cùng 3 tướng" + link. Gửi `POST /api/community-teams` (không có `season`) → chuyển sang "của tôi" kèm thông báo chờ duyệt. <!-- Astra A#12 -->
4. **Của tôi** `?mine=1`: `GET /api/me/community-teams`, trạng thái + lý do + nút xoá. Xoá trả 409 `has_evidence` → thông báo "Đội đã có chiến báo được duyệt của người khác; liên hệ quản trị để gỡ" (vi/zh). Đội bị từ chối không còn ảnh (phase 3). <!-- Updated: Validation Session 1 -->

### Hàm thuần (`js/community-team-state.js`, test bằng `node --test`)
`teamPayloadFromDraft(draft, fields)` (ném lỗi khi thiếu/trùng), `pickSide(normalized, choice)` → một side `{heroes}` hoặc `null` khi cần người dùng chọn, `modeFromSearch(search)`, `mergePage(items, next)` (khử trùng id), `similarWarning(count, locale)`.

### Trang Astro và sổ đăng ký
- `CommunityTeamsPage.astro` chép `ReportsPage.astro` (title/description qua `pick`, `robots="noindex"`, script `/js/community-teams.js`); hub có mount `id="community-teams"` + `<noscript>`.
- `COMMUNITY_PAGES` thêm `{htmlPath: localizedHtmlPath('doi-cong-dong/index.html', locale), mount: 'id="community-teams"', entry: '/js/community-teams.js'}`.
- `public/_headers`: `/doi-cong-dong/*` cùng quy tắc `/chien-bao/*`; cập nhật ba danh sách trong `pages-headers-contract.test.mjs`.
- Không sửa `robots.txt`, sitemap, `src/lib/locale-routes.ts` (`COMMUNITY_PATHS` không có consumer), `SiteLayout.astro`.

## Tests Before (đỏ trước)
- `tests-js/community-team-state.test.mjs`: `teamPayloadFromDraft` (đủ/thiếu/trùng CP), `pickSide` (0/1/2 side), `modeFromSearch`, `mergePage`; đường ống thật `normalizeTeamRead` → `pickSide` → `draftFromRead` với kết quả 1 side có `booksCn` cho ra 3 tướng + 6 CP, với kết quả rỗng/không đọc được cho ra nháp rỗng không lỗi.
- `tests-js/pages-headers-contract.test.mjs`: kỳ vọng `/doi-cong-dong/*` (đỏ tới khi có header).
- `tests-e2e/community-teams.spec.mjs` (mock dùng chung):
  - Danh sách vi: đổi sắp xếp gọi `sort=top`; lọc tướng gọi `heroes=`; "Xem thêm" dùng `cursor`.
  - `/zh/doi-cong-dong/`: tên tướng/CP tiếng Trung, nhãn `[VI]` trên văn bản tiếng Việt; bình luận và chiến báo tiếng Việt hiện trên trang zh kèm `[VI]`.
  - Chi tiết mùa mở: vote gửi `PUT …/vote {value:1}`, số cập nhật; mùa đóng: nút vote tắt, không có form chiến báo, có ghi chú lưu trữ, ô bình luận vẫn gửi được.
  - Đăng: tải ảnh → AI trả 1 side có `booksCn` → 3 tướng + 6 CP được điền, không lỗi; ô unsure phải xác nhận; cảnh báo đội tương tự; body có id, không có `season`.
  - AI 503 → thông báo theo mã, nhập tay vẫn được.
  - Khách bấm vote → lời mời đăng nhập.
  - Menu tài khoản có "Đội cộng đồng"; `/chien-bao/` có link tới trang; "Chiến báo của tôi" với chiến báo trên đội cộng đồng mở `/doi-cong-dong/?id=…`.
- `tests-e2e/community.spec.mjs` (trang đội chuẩn) xanh nguyên sau khi chuyển mock và thêm tuỳ chọn widget.

## Refactor
- Chuyển `mockCommunityApi` sang `tests-e2e/helpers/community-mock.mjs` không đổi hành vi.
- Không sửa file bị pin; cần hàm chưa export từ chúng → **dừng và hỏi**.

## Tests After
`npm run test:node`, `npm run build`, `npm run verify`, `npm run test:dist`, `npm run test:e2e` (toàn bộ).

## Regression gate
`npm run test:node && npm run build && npm run verify && npm run test:dist && npm run test:e2e`

## Rủi ro
- Tải dict ~1.4 MB (`heroes-dict.json` + `tactics.json`) cho trang danh sách: loader có cache + sha256; render khung thẻ trước, điền tên khi dict xong.
- Nhãn trùng trong datalist (mục đầu thắng): chân dung giúp người dùng tự thấy nhầm; server chỉ kiểm định dạng.
- Không có mục menu chính: người chưa đăng nhập vào qua `/chien-bao/` hoặc link chia sẻ. Thêm vào menu chính cần sinh lại thế hệ bản dịch (ngoài phạm vi, hỏi riêng nếu muốn).

## Bảo mật
- Toàn bộ văn bản người dùng render bằng `textContent`/`el()`; URL ảnh chỉ từ id do server trả.
- Không cache phản hồi API trong localStorage ngoài gợi ý phiên sẵn có.

## Todo
- [x] Test hàm thuần, header contract, e2e (đỏ); chuyển mock e2e ra helper
- [x] Tuỳ chọn `sharedPool`/`archived` cho widget
- [x] `communityPageHref` + `community-hub.js`
- [x] Trang Astro vi/zh + hub
- [x] `community-team-data.js`, `community-team-state.js`, `community-teams.js`, `community-team-form.js`
- [x] `community-auth.js` menu, link trong `ReportsHub.astro`
- [x] Sổ đăng ký trang + `_headers` + verifier
- [x] CSS `cm-team-*`
- [x] Regression gate xanh
