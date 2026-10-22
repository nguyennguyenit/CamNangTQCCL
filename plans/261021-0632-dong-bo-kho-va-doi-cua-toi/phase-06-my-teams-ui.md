---
phase: 6
title: "Đội của tôi: trang, trình soạn, nút lưu ở 4 nguồn"
status: done
priority: P1
effort: "2.5d"
dependencies: [5]
---

# Phase 6: Đội của tôi — trang, trình soạn, nút lưu ở 4 nguồn

## Goal

Trang `/doi-cua-toi/` (vi + `/zh/doi-cua-toi/`) bắt buộc đăng nhập, quản lý hộp/nhóm/đội với trình soạn; nút "Lưu vào đội của tôi" ở Gợi ý, chi tiết Đội chuẩn/Đội khác, chi tiết Khai hoang, Soi đội.

## Files to Create / Modify

- Create: `src/components/pages/MyTeamsPage.astro` — theo mẫu `src/components/pages/ReportsPage.astro` (`SiteLayout`, `robots="noindex"`, `pageKind="detail"`, script module riêng). Component tự nhúng bảng đường dẫn đội đầy đủ `{r, l, k}` (layout chỉ nhúng `{l}` cho `pageKind="detail"`, `src/layouts/SiteLayout.astro:356-365`) để `my-teams.js` gọi `setTeamRouteHandlesFromJSON` như `js/team-detail.js:41`; không sửa layout toàn site. <!-- Astra M4 -->
- Create: `src/pages/doi-cua-toi/index.astro`, `src/pages/zh/doi-cua-toi/index.astro` (`export const prerender = true`).
- Modify: `src/lib/locale-routes.ts:19` — thêm `/doi-cua-toi/` vào `COMMUNITY_PATHS`.
- Modify: `scripts/verify-astro-dist.mjs:78` — thêm trang vào `COMMUNITY_PAGES` (mount + entry); cập nhật fixture dựng dist giả trong `tests-js/astro-dist-contract.test.mjs` (vòng lặp `COMMUNITY_PAGES`, ~`:324`).
- Modify: `public/_headers` — `/doi-cua-toi/*` cùng quy tắc `/chien-bao/*`; thêm `doi-cua-toi` vào ba danh sách của `tests-js/pages-headers-contract.test.mjs` (quy tắc, vòng trang cộng đồng, vòng zh).
- Modify: `js/community-auth.js:66` — mục menu "Đội của tôi" / "我的阵容" trước "Chiến báo của tôi".
- Phối hợp: plan Đội cộng đồng (`plans/261021-0628-doi-cong-dong/`) sửa cùng `COMMUNITY_PAGES`, `public/_headers`, `pages-headers-contract.test.mjs`, menu `community-auth.js`. Khi làm phase này, rebase lên `main` mới nhất và giữ cả hai mục.
- Create: `js/my-teams.js` — entry trang:
  - Chưa đăng nhập: `signInPrompt(...)` (`js/community-api.js:318`), không gọi `/api/roster`.
  - Đã đăng nhập: `my-teams-api.load()` + `ensureBoxDefaults("main")`; chọn/tạo/đổi tên/xóa hộp (tạo hộp gửi kèm `ensureBoxDefaults(boxId)` cùng request; `main` không xóa được; xóa có hộp thoại xác nhận nêu số đội sẽ mất); nhóm (Khai Hoang, Ghép Team mặc định không xóa được; đổi tên, thêm, xóa — server chuyển đội về Ghép Team —, chuyển đội); thẻ đội dạng bảng như sheet; nhãn "chưa có trong kho", cảnh báo trùng, "Bản gốc đã cập nhật" (so `contentHash` với `/my-teams-source-index.json`). Link nguồn: tách `source.key` đã qua `normalizeTeam` thành `{family, id, variant}`, dựng bằng `teamDetailPath(...)` + helper nối `?variant` (`js/team-detail-navigation.js:121-136`); `analyze` không có link. <!-- Updated: Validation Session 1 - giữ xóa hộp/nhóm --> <!-- Astra H5, M4 -->
  - Trình soạn: chọn tướng/chiến pháp/binh thư bằng `js/roster-picker.js` policy `editor` (phase 4: đủ danh mục, có binh thư); ô chữ tự do đếm byte; ô "Thay thế cho đội". Lưu lỗi hoặc bị từ chối → `role="alert"` nêu lý do, giữ nguyên nội dung, nút Lưu lại. Xung đột (`conflict`) → hiện bản đang có trên server cạnh bản đang soạn, người dùng chọn giữ bản nào (giữ bản soạn thì lưu lại với dấu thời gian mới). <!-- Astra H1, M5 -->
- Create: `js/my-teams-save-button.js` — nút dùng chung. Dựng đội nháp **lúc bấm** (biến thể theo URL hiện tại), `draft.id` sinh một lần. Chưa đăng nhập → `stashPendingSave` rồi `signIn()`. Đã đăng nhập → hộp thoại chọn hộp + nhóm (mặc định theo nguồn) → `ensureBoxDefaults(boxId)` → `saveTeam` → toast có link `/doi-cua-toi/`. Trang tải với phiên hợp lệ và có bản lưu dở → lưu tự động; chỉ `clearPendingSave()` khi `applied`/`already-applied`, lỗi thì toast "Lưu lại" và giữ bản lưu dở.
- Modify: `js/detail-actions.js` — `detailPanelActions()` nhận thêm nút lưu (giữ nút sao chép liên kết).
- Modify: `js/team-detail.js` — trang mặc định: đọc `#team-save-payload`; nhánh `?variant` (`:126-153`): dựng nháp bằng `fromLegacy` từ **đúng object đang hiển thị** `{...admitted.legacyContent, notes: team.notes}` (`:151`), key `${legacyTeamId}~${legacyVariantId}`.
- Modify: `js/khaihoang-detail.js` — chọn biến thể trong payload theo `?variant` lúc bấm (đổi biến thể chỉ `replaceState`, `:128-129`).
- Modify: `js/roster-recommend-ui.js` — nút lưu trên mỗi thẻ kết quả (`fromRosterEntry(entry, seasonRecords)`).
- Modify: `js/analyze.js` — nút lưu sau khi đội đã xác nhận (`fromAnalyze`).
- Modify: `src/lib/public-artifact-manifest.mjs` — `entry("js", "my-teams")`, `entry("js", "my-teams-save-button")`.
- Localization: `js/detail-actions.js`, `js/team-detail.js`, `js/khaihoang-detail.js`, `js/roster-recommend-ui.js`, `js/analyze.js` (đều bị ghim, `pipeline/site-localization-policy.json:767-794`) và trang mới → chuỗi "Publish lại bản dịch hiển thị" (`docs/deployment-guide.md:251-271`), receipt cho chữ lớp `translate`. `js/community-auth.js` không bị ghim. Rebase lên `main` trước khi publish.
- Modify: `css/styles.css` — trang và trình soạn; mobile: bảng đội thành thẻ xếp dọc.
- Create: `tests-e2e/my-teams.spec.mjs` — mock `/api/me`, `/api/roster`, OAuth bằng route intercept như `tests-e2e/community.spec.mjs`.

## Test Matrix

| # | Ca | Kỳ vọng |
|---|---|---|
| 1 | `/doi-cua-toi/` chưa đăng nhập | hộp mời đăng nhập; không gọi `/api/roster` |
| 2 | Lưu từ Đội chuẩn khi chưa đăng nhập → OAuth quay về | đội được lưu đúng một lần |
| 3 | Như 2 nhưng POST trả 500, rồi tải lại trang | bản lưu dở còn, toast "Lưu lại", lưu được ở lần sau |
| 4 | User chưa từng dùng Gợi ý lưu đội đầu tiên | `box main` và hai nhóm mặc định được tạo trước khi lưu |
| 5 | Lưu từ 4 nguồn khi đã đăng nhập | 4 đội trong hộp, nhóm đúng (Khai hoang → Khai Hoang), dữ liệu khớp nguồn |
| 6 | `/doi-khac/<x>/?variant=v` → Lưu | đội của biến thể, key `x~v` |
| 7 | Khai hoang đổi chip biến thể rồi Lưu | đội của biến thể đang hiện |
| 8 | Sửa đội, tải lại | thay đổi còn |
| 9 | Server trả `conflict` (kèm `server`) | `role="alert"` xung đột, hiện cả hai bản, nội dung soạn giữ nguyên |
| 9b | Lưu đội vào hộp mới tạo | hai nhóm mặc định của hộp đó có trước khi lưu |
| 9c | Link nguồn: Đội chuẩn, Đội khác biến thể, Khai hoang biến thể, vi và zh | bấm link mở đúng trang và đúng biến thể |
| 10 | Hai đội trùng tướng / đánh dấu thay thế | cảnh báo hiện / không |
| 11 | Món không có trong kho hộp | nhãn "chưa có trong kho" |
| 12 | `contentHash` khác index | nhãn "Bản gốc đã cập nhật" + link nguồn đúng |
| 13 | Bản ghi đội hỏng từ server | bị bỏ qua kèm thông báo, các đội khác vẫn hiện |
| 14 | zh + mobile 390px | nhãn tiếng Trung; không tràn ngang |
| 15 | `test:dist` | `/doi-cua-toi/` và bản zh `noindex`, không trong sitemap, có trong `COMMUNITY_PAGES` |

## Tasks & Steps

1. Trang tĩnh, route, `COMMUNITY_PATHS`, `COMMUNITY_PAGES`, `_headers`, menu, **manifest cho `my-teams` và `my-teams-save-button` kèm entry stub hoàn chỉnh, rồi publish lại bản dịch** — trước khi chạy `npm run build && npm run test:dist` lần đầu (cổng build kiểm manifest và hash ghim). <!-- Astra M3 -->
2. `my-teams.js`: danh sách, link nguồn, rồi trình soạn.
3. `my-teams-save-button.js`, gắn vào 4 nguồn (kể cả biến thể).
4. Publish lại bản dịch lần cuối cho các file nguồn đã sửa ở bước 2–3.
5. E2E; smoke với session Better Auth dựng sẵn (`docs/community-worker.md:157`) trên hai trình duyệt.

## Verification

- `npm run test:node`, `npm run check`, `npm run build`, `npm run test:dist` xanh.
- `npx playwright test tests-e2e/my-teams.spec.mjs tests-e2e/community.spec.mjs tests-e2e/team-detail-pages.spec.mjs tests-e2e/khaihoang-options.spec.mjs` xanh.
- Smoke bước 5 qua.
