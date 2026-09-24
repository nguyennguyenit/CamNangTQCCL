---
phase: 8
title: "Cùng Tồn + Khai hoang"
status: pending
priority: P2
effort: "2.5d"
dependencies: [5]
---

# Phase 8: Cùng Tồn + Khai hoang

## Goal
`/cung-ton/` có chọn nhóm 1–5 và ô tổng quan; `/khai-hoang/` có thẻ build Trước → Sau, thanh điểm 6 mốc, lưới Chạm Sứ, bảng quân thủ mỏ — theo artboard và quyết định nội dung đã chốt.

## Contract
Brainstorm §2 (thuật ngữ Chạm Sứ), §6 (Cùng Tồn, Khai hoang), §3 (không đổi dữ liệu), plan quyết định #8 (thẻ Khai hoang, tổng quan Cùng Tồn).

## Artboard
`Coexist.dc.html:45-84`, `CoexistMobile.dc.html:38-51`, `Khaihoang.dc.html:34-97`, `KhaihoangMobile.dc.html:37-77`.

## Files to Create / Modify
- Modify: `js/render.js` (Cùng Tồn `:497-517`; Khai hoang `:206-248,333-385,411-471`), `js/team-filter-section.js` (nhóm Cùng Tồn `:231-240`), `js/app.js` (query nhóm nếu thêm), `css/styles.css`.
- Modify: policy + obligations; `scripts/design-compare.mjs`; `tests-e2e/season-lookup.spec.mjs` (`:23-49,157-174`), `tests-e2e/khaihoang-options.spec.mjs`.

## Tasks & Steps
1. **Cùng Tồn — chọn nhóm:** nút chọn nhóm 1–5 (nhóm theo thứ tự nguồn, `aria-pressed`), nhóm đang chọn ghi vào query `group=<n>` (`replaceState`), mặc định nhóm 1; hiển thị 5 đội của nhóm theo artboard.
2. **Cùng Tồn — ô tổng quan:** "5 đội · 15 tướng · không trùng" **tính** từ mảng 3 tướng mỗi đội (`pipeline/season_validation.py:346-353`): số đội, số tướng khác nhau, có trùng hay không (trùng → hiện "có trùng: <tên>"). Ô "Ghi chú" và "Gợi ý khai hoang" hiện **nguyên văn** `notesRaw` và `openingSuggestionsRaw` qua helper `el()` (gán text, `js/render.js:1-4`), không `innerHTML`; trường rỗng → không render ô. Không tách câu, không thêm trường dữ liệu.
3. **Khai hoang — thẻ** (theo plan `260922-1806` + quyết định 2026-09-24): build, chọn cấu hình (chip 44px), mỗi tướng "Trước: …" / "Sau: …" với chiến pháp chữ son, ghi chú build, thanh điểm 6 mốc (Đất 4, Đất 5, Đất 6, Đất 7–8, Chuyển, Tổng; thang /10, cột Tổng màu mực) đọc từ `guide.ratings` (`land4, land5, land6, land7to8, transition, overall`, vd `data/khaihoang.json:188`) — chỉ 11/17 đội có guide nên chỉ 11 thẻ có thanh; đội không có `ratings` → không vẽ thanh. Thẻ chỉ hiện số liệu, chữ hướng dẫn ở trang chi tiết; dòng cuối thẻ là link "Hướng dẫn đánh đất →" tới `/khai-hoang/<đội>/` (giữ `variant`); đội không có guide vẫn có link "Chi tiết →".
4. **Khai hoang — khối khác:** lọc loại binh (chip), anchor 3 khối "Đội đề xuất", "Chạm Sứ / Ăn vạ", "Quân thủ các mỏ" (nút nhảy khối trên đầu trang); lưới Chạm Sứ; bảng/thẻ quân thủ mỏ theo artboard (mobile: thẻ từng mỏ).
5. Thuật ngữ: khối Khai hoang dùng "Chạm Sứ"; không đổi 5 tên "…cảm tử".
6. Chữ mới → obligations; chữ `translate` đổi → chờ receipt.
7. Cặp so ảnh: Coexist, CoexistMobile, Khaihoang, KhaihoangMobile.

## Verification
- e2e: đổi nhóm Cùng Tồn cập nhật URL + reload giữ nhóm; số liệu tổng quan khớp phép đếm độc lập trong test; thẻ Khai hoang không còn chữ hướng dẫn, có thanh điểm + link chi tiết đúng variant; Back từ chi tiết giữ variant (contract plan `260922-1806` A3/A4 vẫn đạt).
- `npm run check && npm run build && npm run verify && npm run test:e2e`
- `node scripts/design-compare.mjs --phase 08` → `reports/visual-phase-08.md`.
