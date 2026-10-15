---
phase: 1
title: "Builder đội sang view-tree"
status: completed
---

# Phase 1 — Builder đội sang view-tree

## Mục tiêu
Mọi builder dựng **nội dung chính** của đội (thẻ/hàng danh sách, nhóm Cùng Tồn, bảng Khai hoang, thân trang chi tiết) trả cây `h()` của `js/view-tree.js`, chạy được trong Node (không `document`). Client gọi `treeToDom` rồi gắn sự kiện; HTML/DOM đầu ra và hành vi client **không đổi**. Phase này chưa đổi trang Astro nào.

## Phạm vi
- `js/recommended-reference-render.js`: `recommendedTeamCard`, `coexistTeamCard`, `recommendedTeamTable`, `recommendedTeamTableRow`, `recommendedTeamDetailContent`, `legacyOriginalDetailContent` (+ helper nội bộ: `detailBadges`, …).
- `js/render.js`: `seasonCoexistGroup`, `variantNameNodes`, `heroMentionNodes`, `khaihoangBuildContent`, `khaihoangRatings`, `khaihoangGuide`, `khaihoangRatingBar`, `khaihoangConfigRow`, `khaihoangTable`, `icon`/`svgNode` khi nằm trong các cây trên.
- Caller: `js/team-filter-section.js`, `js/team-detail.js`, `js/khaihoang-detail.js`, `js/app.js` và mọi importer khác (dùng LSP references).
- Không đổi: `js/view-tree.js` API (chỉ mở rộng nếu thiếu: ví dụ SVG namespace cho `treeToDom` — `svg`/`path` phải tạo bằng `createElementNS`).

## Thiết kế
- Builder thuần trả cây; sự kiện (`onTag`, `onNavigate`, `onChange`, `onSelect`, `onClose`) **không** nằm trong cây. Client gắn sau `treeToDom` bằng delegation hoặc truy vấn `data-*` / class có sẵn.
- `L()`/`currentLocale()` phụ thuộc `document`? Nếu có, builder nhận `locale` tham số (mẫu `lookupResultTrees(group, items, locale = currentLocale())`) và dùng `pick(locale, vi, zh)`.
- `dataset` → thuộc tính `data-*` (kebab-case) cho cây; `class` giữ nguyên chuỗi.
- Không shim DOM.

## TDD
### 3.T — test hành vi hiện tại (trước khi sửa)
1. Script throwaway `scripts/tmp-capture-team-dom.mjs` (Playwright, server preview hiện có) chụp `outerHTML` chuẩn hoá (bỏ khoảng trắng giữa thẻ) của: `/doi-chuan/` (danh sách mặc định, 2 chế độ thẻ/bảng nếu có), `/doi-khac/`, `/cung-ton/` (một nhóm + chi tiết cấu hình), `/khai-hoang/`, 3 trang chi tiết mỗi họ (vi + zh) → `/tmp/team-dom-before/*.html`. Không commit file này.
2. Test Node vĩnh viễn (mới) `tests-js/team-view-trees.test.mjs`: với record thật từ `src/data/recommended-reference/<gen>/details-*.json`, `data/teams.json`, `data/khaihoang.json`, `data/coexist.json` — `treeToHtml(builder(...))` chạy không cần `document` và chứa tên 3 tướng + tên chiến pháp + binh thư lấy từ chính record (vi và zh). Test này đỏ trước khi port (builder gọi `document`).
3. Chạy e2e liên quan (`tests-e2e/` có `season-lookup`, `team-detail`, `spa-parity`, …) xanh làm mốc.

### 3.I — port
Port từng builder; caller chuyển sang `treeToDom` + gắn sự kiện.

### 3.V — xác minh
- Chạy lại script chụp → so `/tmp/team-dom-before` với sau: giống hệt (khác biệt chỉ được phép nếu chứng minh là thứ tự thuộc tính). Ghi kết quả vào `reports/phase-01.md`.
- `npm run test:node`, `npm run build`, `npm run verify`, `npm run test:dist`, e2e toàn bộ (`npx playwright test -c playwright.local.config.mjs` nếu cổng 4174 bận) xanh.
- Localization: file nguồn sửa nằm trong `policy.sourceFiles` → làm mới hash/đăng ký theo `pipeline/site_localization.py`; literal UI di chuyển giữa file phải đăng ký lại owner. `check --stage public` xanh.
- `mcp-worker/workflow-source-manifest.json`: nếu file `semanticFiles` đổi → regenerate.
- Xoá script throwaway.

## Xong khi
- [x] Builder trong phạm vi trả cây view, chạy trong Node.
- [x] DOM trước/sau giống hệt trên các trang đã chụp.
- [x] `tests-js/team-view-trees.test.mjs` xanh; mọi suite xanh.
- [x] `reports/phase-01.md` ghi lệnh, kết quả đỏ→xanh.
