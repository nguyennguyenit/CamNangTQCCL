---
phase: 2
title: "Danh sách: thẻ team, chỉ phương án đủ dữ liệu"
status: pending
priority: P1
effort: "1.5d"
dependencies: [1]
---

# Phase 2: Danh sách: thẻ team, chỉ phương án đủ dữ liệu

## Goal
`/doi-khac/` (vi, zh, ja; SSR và client) liệt kê **team**: mỗi team một thẻ/hàng bảng dựng từ phương án đại diện, ghi số phương án đủ dữ liệu; team không có phương án đủ dữ liệu không hiện.

## Context
- SSR `src/lib/team-section-ssr.js:48-61` (60 mục đầu); client `js/app.js:447`, `js/team-filter-section.js:262`, state `js/recommended-reference-state.js:165-175,183-184,268-283`, thẻ `js/recommended-reference-render.js`, `js/team-view.js`. Nhãn Đề cử và nhãn mùa tĩnh giữ như hiện tại.
- Dữ liệu từ generation Phase 1 (`teamGroups`, `optionRank`, `dataComplete`).

## Requirements
- Nguồn = `teamGroups` có `representativeVariantId` khác null; mỗi mục dựng bằng record đại diện.
- Thẻ thêm "N phương án" (zh `N 种方案`, ja `N 通りの構成`) khi N > 1.
- Bộ lọc khớp nếu bất kỳ phương án đủ dữ liệu nào của team khớp; khi khớp nhờ phương án không phải đại diện, link thẻ trỏ **trang của chính phương án khớp** (`referenceDetailHref(row)`), không dùng `?variant=`.
- Đếm và phân trang 60 theo team; thứ tự team theo `optionRank` của đại diện.
- SSR và client cùng tập, cùng thứ tự.
- Chuỗi UI mới đặt trong file đã có trong `sourceFiles` của policy; nếu tạo file mới (`js/other-team-groups.js`) thì thêm vào `sourceFiles`.

## Tests Before
- `tests-js/recommended-reference-state.test.mjs`: tập mục = team có đại diện; lọc theo chiến pháp chỉ có ở phương án phụ → ra team, href trỏ trang phương án phụ; thứ tự theo `optionRank`.
- `tests-js/team-section-ssr.test.mjs`: SSR 60 mục đầu theo team, có "N phương án".
- `tests-js/doi-khac-single-season.test.mjs`: cập nhật kỳ vọng số team; Đề cử vẫn đứng đầu.
- `tests-e2e/doi-khac-single-season.spec.mjs`, `tests-e2e/team-ssr-parity.spec.mjs`, `tests-e2e/team-ssr-nojs.spec.mjs`: số thẻ SSR = client; không link nào tới phương án bị loại.

## Refactor
- Hàm thuần dùng chung SSR/client: `otherTeamListEntries(otherPayload, filters)` → `[{group, displayRecord, href, optionCount}]` (trong `js/recommended-reference-state.js`, hoặc `js/other-team-groups.js` nếu file quá lớn).
- `js/team-filter-section.js`, `js/recommended-reference-render.js`, `src/lib/team-section-ssr.js`: dựng từ entry.
- Render chỉ qua `h()`/`treeToHtml`/`treeToDom`; link qua `referenceDetailHref`.

## Cuối phase
- Ghim lại hash file đổi trong `sourceFiles` → publish generation → `team_route_handles --rebind` → `--check`.

## Tests After / Regression gate
- `npm run test:node`; build; e2e ở trên; e2e Đội chuẩn hiện có xanh.

## Files
- Modify: `js/recommended-reference-state.js`, `js/team-filter-section.js`, `js/recommended-reference-render.js`, `src/lib/team-section-ssr.js`, tests nêu trên, `pipeline/site-localization-policy.json`.
- Có thể tạo: `js/other-team-groups.js` (thêm vào `sourceFiles`).
