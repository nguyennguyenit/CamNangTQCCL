---
phase: 1
title: "Phase 1: Xác nhận hợp đồng và chạy test nền"
status: todo
priority: P1
effort: "2h"
dependencies: []
---

# Phase 1: Xác nhận hợp đồng và chạy test nền

## Goal

Chốt bốn điểm chưa kiểm bằng code và ghi lại kết quả test nền trước khi sửa, để các phase sau không dựa trên giả định.

## Files to Create / Modify

- Không sửa code. Ghi kết quả vào mục "Kết quả" cuối file này.

## Tasks & Steps

1. Luật chọn kho: đọc `js/roster-recommend-ui.js` (quanh các dòng 347–392) và `js/roster-sync.js` để ghi rõ khi nào UI dùng kho cloud thay kho local, và đăng xuất có xóa `tqccl.roster.cloud.v1` không. Kết luận thành luật cho `readOwnedRoster` ở phase 3; nếu cache cloud còn lại sau đăng xuất, luật phải nêu cách xử lý.
2. Trang mùa cũ `/doi-chuan/<mã mùa>/`: xác nhận `SiteLayout` với `pageKind="detail"` có nạp `js/app.js` không, và HTML của `bodyHtml` có `data-source-config-id` trên thẻ không. Kết luận: gắn badge qua app hiện có hay cần một entry script nhỏ.
3. Bảng: xác nhận `recommendedTeamTableRow` có khóa hàng (`data-reference-key` hoặc tương đương) để gắn badge ở kiểu Bảng.
4. Policy bản dịch: chạy `python3 -m pipeline.site_localization inventory --root . --report <file trong .cache>` trên nhánh hiện tại để lấy số nền (`uiTranslateObligations`, `siteLedgerObligations`), và đọc `classifications`/`exemptions` trong `pipeline/site-localization-policy.json` để biết file JS mới không có chữ UI có cần khai báo không.
5. Xác nhận tên tham số `kho` và `xep` chưa được dùng ở `readRecommendedQuery`, `referenceSectionState`, `season-ui-state.js` và `js/legacy-routes.js`.

## Tests Before

Chạy và ghi số test đạt làm nền:

- `npm run test:node`
- `npx playwright test -c <cấu hình tạm bỏ cổng bản dịch> recommended-browser.spec.mjs team-ssr-parity.spec.mjs team-ssr-nojs.spec.mjs season-pages.spec.mjs`

Ghi chú: trên nhánh này `npm run build` đang đỏ ở cổng `site_localization check` vì hash của `js/roster-recommend-ui.js` chưa ghim lại (bản sửa #59). E2E trong lúc phát triển chạy bằng cấu hình Playwright tạm gọi `astro build` trực tiếp; cổng đầy đủ chạy lại ở phase 5.

## Refactor

Không có.

## Tests After

Không có.

## Regression gate

`npm run test:node` xanh với cùng số test như nền.

## Success Criteria

- [x] Năm điểm trên có kết luận kèm đường dẫn file và số dòng làm căn cứ.
- [x] Số nền của test node, e2e và inventory đã ghi lại.
- [x] Nếu kết luận nào làm đổi "Quyết định thiết kế" trong `plan.md`, dừng và báo anh trước khi sang phase 2.

## Kết quả (2026-11-11)

1. **Luật chọn kho.** Gợi ý đội dùng kho local khi không có phiên (`mode = "guest"`), chuyển sang kho cloud khi `sync.user()` có giá trị (`js/roster-recommend-ui.js:384`), và giữ cache cloud ở chế độ chỉ đọc khi hết phiên (`enterFromCache`, dòng 373). Cache `tqccl.roster.cloud.v1` ghi kèm `userId` (`js/roster-sync.js:126`) và không bị xóa khi đăng xuất. `loadSession({ probe: false })` trong `js/community-api.js:227` dùng chung promise với header và không gọi mạng khi không có dấu đăng nhập. Luật cho phase 3: `readOwnedRoster(storage, { userId })`; `userId` rỗng thì đọc kho local; có `userId` thì chỉ đọc cache cloud có cùng `userId`, hộp `main`; không có cache khớp thì coi như chưa có kho (dòng dẫn sang Gợi ý đội, nơi sẽ đồng bộ và tạo cache). Cache của người khác không bao giờ được dùng.
2. **Trang mùa cũ.** `SiteLayout` với `pageKind="detail"` không nạp `js/app.js` (chỉ `site-chrome.js`, `donate.js`, `community-auth.js`). `bodyHtml` dựng từ `projectRecommendedRows` + thẻ đội (`src/lib/team-ssr.ts:195`), nên thẻ có `data-source-config-id`. Kết luận: phase 4 thêm một entry script nhỏ cho trang mùa, chỉ nạp dữ liệu khi máy có kho, gắn badge vào thẻ theo `data-source-config-id`.
3. **Kiểu Bảng.** `tableRowTree` có `data-reference-key` (`js/recommended-reference-render.js:555`), bằng `sourceConfigId` với hàng Đội chuẩn.
4. **Inventory nền.** `uiTranslateObligations = 62`, `siteLedgerObligations = 2694`, `translationObligations = 6291`, `sourceFiles.stale = 1` (đúng file của #59), generation nền `093fca99…`. Báo cáo ở `.cache/inventory-badge-kho-nen.json`. Số 62 nhỏ hơn nhiều so với số chuỗi `L(vi, zh)` trong JS, nên chuỗi `L()` có sẵn zh nhiều khả năng không sinh obligation lớp `translate`; phase 5 xác nhận bằng inventory sau khi sửa.
5. **Tên tham số.** `kho` và `xep` chưa được dùng ở đâu trong `js/` và `src/lib/`.

Test nền: `npm run test:node` 832/832 đạt; e2e (recommended-browser, team-ssr-parity, team-ssr-nojs, team-ssr-adopt, season-pages) 102/102 đạt bằng cấu hình tạm.

Thay đổi so với `plan.md`: quyết định 2 được làm rõ (cần `userId` từ `loadSession({ probe: false })`, không thêm request). Không đổi phạm vi, nên tiếp tục sang phase 2.
