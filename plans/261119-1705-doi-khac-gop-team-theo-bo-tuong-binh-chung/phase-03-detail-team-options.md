---
phase: 3
title: "Trang chi tiết + route: phương án khác, 404 cho phương án bị loại"
status: pending
priority: P1
effort: "1.5d"
dependencies: [2]
---

# Phase 3: Trang chi tiết + route: phương án khác, 404 cho phương án bị loại

## Goal
Chỉ phương án admitted + đủ dữ liệu có trang `/doi-khac/<handle>/`; mỗi trang canonical về chính nó và có khối "Các phương án khác của team" bằng link thật; mọi phương án khác trả 404 nhưng handle giữ nguyên.

## Context
- Route: `src/lib/team-detail-routes.ts:47-61,122-184,220-240,342-389` (legacy dựng từ toàn bộ `teams.json`, `:357`), `src/lib/team-detail-pages.ts:374-415`, `src/pages/doi-khac/[team].astro`, `src/components/pages/LegacyDetail.astro`; SSR `src/lib/team-ssr.ts:223-233`; client `?variant=` `js/team-detail.js:103-106,155-182` (điều kiện `row.legacyTeamId === legacyTeamId` ở `:169`).
- Quan hệ 1:1: mỗi phương án là một `legacyTeamId`, nên "phương án khác" luôn là trang khác.
- Mục binh thư tham khảo (#170, `bookHints`) chỉ hiện cho tướng không ghi binh thư → không còn gặp trên trang nào sau phase này.

## Requirements
1. **Route**: catalog legacy chỉ gồm `legacyTeamId` có record admitted + `dataComplete`. Handle của id bị loại vẫn ở `team-route-handles.json` (không tombstone, không rebind mất). [UNVERIFIED] `team_route_handles --check` và kiểm key-set trong `team-detail-routes.ts:220-240` có chấp nhận handle không có route không: kiểm đầu phase; nếu không, thêm khái niệm "handle tạm ẩn" (danh sách id ẩn suy từ generation, không phải tombstone) và test.
2. **Trang**: hiện phương án; khối "Các phương án khác của team" liệt kê các phương án đủ dữ liệu khác cùng `teamGroupId` theo `optionRank`, mỗi mục là link thật (`referenceDetailHref`) kèm tóm tắt chỗ khác (chiến pháp/binh thư khác phương án đang xem, class `is-diff`, có nhãn cho trình đọc màn hình). Đọc được khi không có JS.
3. **Canonical** = URL của chính trang (như hiện tại); không noindex trên trang nào còn dựng.
4. **`?variant=`**: giữ điều kiện cùng `legacyTeamId`; `/<A>/?variant=<vB>` báo lỗi như hiện tại (test âm). Link mới không dùng `?variant=`.
5. **Bỏ mã chết**: gợi ý binh thư tham khảo (#170: `bookReferenceBlock`, `legacyBookHints`, `data-book-hints`) không còn đường dùng → gỡ cùng test, hoặc giữ nếu Khai hoang/khác dùng (kiểm trước khi gỡ).
6. **An toàn render**: dựng qua `h()`/`treeToHtml`; dữ liệu nhúng (nếu có) chỉ qua `jsonLd()`; link qua `referenceDetailHref`/`teamDetailHref`.
7. **SEO contract**: cập nhật `tests-js/seo-dist-contract.test.mjs` theo D6: `teamPages()` Đội khác = phương án đủ dữ liệu; canonical tự trỏ giữ nguyên; llms-full chứa đúng URL còn dựng.

## Tests Before
- `tests-js/team-detail-routes.test.mjs`: catalog legacy loại id thiếu dữ liệu và id không admitted; handle của id bị loại vẫn trong ledger; `--check` xanh.
- `tests-js/team-view-trees.test.mjs`: khối "Các phương án khác" có đúng phương án đủ dữ liệu khác của team, có `is-diff`; record giả chứa `</script>` và `"` render an toàn.
- `tests-js/seo-dist-contract.test.mjs`: như Requirement 7.
- `tests-e2e/team-detail-pages.spec.mjs`, `team-ssr-nojs.spec.mjs`, `team-ssr-detail-states.spec.mjs`: link "phương án khác" mở 200; một handle bị loại trả 404; `/<A>/?variant=<vB>` báo lỗi.

## Refactor
- `src/lib/team-detail-routes.ts`, `src/lib/team-detail-pages.ts`, `src/lib/team-ssr.ts`, `src/components/pages/LegacyDetail.astro`, `js/recommended-reference-render.js` (khối phương án khác), `css/styles.css`.

## Cuối phase
- Ghim lại hash file đổi → publish generation → `team_route_handles --rebind` → `--check` → `prune`.

## Tests After / Regression gate
- `npm run test:node`; build; `verify`; `test:dist`; e2e ở trên.

## Files
- Modify: các file Refactor + tests nêu trên, `pipeline/site-localization-policy.json`.

## Risk
- Khoảng 193 URL đã công bố thành 404: liệt kê trong PR (theo quyết định của anh).
