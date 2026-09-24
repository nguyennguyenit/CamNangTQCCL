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
- Modify: `js/render.js` (Cùng Tồn `seasonCoexistGroup`/`coexistGroup` `:497-520`; Khai hoang `:206-248,333-385,411-471`), `js/team-filter-section.js` (nhóm Cùng Tồn `:231-240`), `js/app.js` (query nhóm), `css/styles.css` (gồm bộ chọn phạm vi mùa `#season-controls` và chi tiết cấu hình `#season-config-detail` trên `/cung-ton/`).
- Modify: policy + obligations; `scripts/design-compare.mjs`; `tests-e2e/season-lookup.spec.mjs` (`:23-49,157-174`), `tests-e2e/khaihoang-options.spec.mjs`.

## Tasks & Steps
1. **Cùng Tồn — chọn nhóm:** nút chọn nhóm (`aria-pressed`) theo đúng thứ tự `update(groups)` đang nhận (applicable → scenarioReference → unknown, `team-filter-section.js:235-238`; không phạm vi mùa thì là thứ tự nguồn, 5 nhóm); nhãn nút là `groupLabel` + nhãn phân loại khi có phạm vi mùa ("Áp dụng theo phiên bản luật" / "Tham khảo kịch bản" / "Chưa xác định kịch bản"). Nhóm đang chọn ghi vào query `group` (`replaceState`): giá trị là `recordId` của nhóm (nhánh có mô hình mùa, `render.js:511`), hoặc số thứ tự 1-based trong nguồn (nhánh không có mô hình mùa); mặc định nhóm đầu; `group` không còn trong danh sách sau khi đổi phạm vi → về nhóm đầu và bỏ `group` khỏi URL. Hiển thị 5 đội của nhóm theo artboard. Danh sách rỗng giữ thông báo hiện có (`:239`).
2. **Cùng Tồn — ô tổng quan:** "5 đội · 15 tướng · không trùng" **tính** từ mảng 3 tướng mỗi đội (`pipeline/season_validation.py:346-353`): số đội, số tướng khác nhau, có trùng hay không (trùng → hiện "có trùng: <tên>"). Hiện **nguyên văn** mọi trường nguồn đang render (`render.js:511-516`): `summaryRaw` ("Tổng quan"), `openingSuggestionsRaw` ("Gợi ý khai hoang"), `notesRaw` ("Ghi chú"), dòng phân loại phạm vi (`scope-note`), link "Nguồn Cùng Tồn" (`source.url`, `rel="noopener noreferrer"` giữ) và `disclaimerRaw` ("Lưu ý nguồn") — qua helper `el()` gán text (`js/render.js:1-4`), không `innerHTML`; trường rỗng → không render ô. Nhánh không có mô hình mùa (`coexistGroup(reference.content)`, `:498`) dùng cùng khung với các trường nó có. Không tách câu, không thêm trường dữ liệu, không bỏ nguồn/lưu ý.
2b. **Phạm vi mùa + chi tiết cấu hình trên `/cung-ton/`** (Phase 2 giữ hành vi, không có artboard): select Mùa / Phiên bản luật dùng component select 44px + nhãn caps của StyleGuide "Nhập liệu & hiển thị dữ liệu"; chi tiết cấu hình `?config=` dùng token panel/thẻ. Ghi vào `visual-phase-08.md` là "không có artboard, theo StyleGuide". **Dữ liệu thật (đo 2026-09-25):** `season-registry.json` có 2 kịch bản reviewed, **0** phiên bản luật reviewed; `season-team-configs.json` và `season-team-evaluations.json` **rỗng** → trên site thật chỉ select Mùa có tác dụng (phân loại nhóm Cùng Tồn qua 10 `season-content-links`), select Phiên bản luật luôn disabled, chi tiết cấu hình không bao giờ hiện. Vì vậy: select Mùa làm đầy đủ theo StyleGuide; select Phiên bản luật và chi tiết cấu hình chỉ áp token (màu, viền, radius, cỡ chữ), không trau chuốt bố cục, không thêm cặp so ảnh; kiểm bằng fixture `season-lookup.spec.mjs` hiện có.
3. **Khai hoang — thẻ** (theo plan `260922-1806` + quyết định 2026-09-24): build, chọn cấu hình (chip 44px), mỗi tướng "Trước: …" / "Sau: …" với chiến pháp chữ son, ghi chú build, thanh điểm 6 mốc (Đất 4, Đất 5, Đất 6, Đất 7–8, Chuyển, Tổng; thang /10, cột Tổng màu mực) đọc từ `guide.ratings` (`land4, land5, land6, land7to8, transition, overall`, vd `data/khaihoang.json:188`) — chỉ 11/17 đội có guide nên chỉ 11 thẻ có thanh; đội không có `ratings` → không vẽ thanh. Thẻ chỉ hiện số liệu, chữ hướng dẫn ở trang chi tiết; dòng cuối thẻ là link "Hướng dẫn đánh đất →" tới `/khai-hoang/<đội>/` (giữ `variant`); đội không có guide vẫn có link "Chi tiết →".
4. **Khai hoang — khối khác:** lọc loại binh (chip), anchor 3 khối "Đội đề xuất", "Chạm Sứ / Ăn vạ", "Quân thủ các mỏ" (nút nhảy khối trên đầu trang); lưới Chạm Sứ; bảng/thẻ quân thủ mỏ theo artboard (mobile: thẻ từng mỏ).
5. Thuật ngữ: khối Khai hoang dùng "Chạm Sứ"; không đổi 5 tên "…cảm tử".
6. Chữ mới → obligations; chữ `translate` đổi → chờ receipt.
7. Cặp so ảnh: Coexist, CoexistMobile, Khaihoang, KhaihoangMobile.

## Verification
- e2e: đổi nhóm Cùng Tồn cập nhật URL + reload giữ nhóm; đổi Mùa/Phiên bản luật làm nút nhóm hiện đúng nhãn phân loại và `group` không hợp lệ bị bỏ; nhóm đang xem có đủ Tổng quan / Gợi ý khai hoang / Ghi chú / link nguồn / Lưu ý nguồn khi dữ liệu có; số liệu tổng quan khớp phép đếm độc lập trong test; các ca `season-lookup.spec.mjs` trên `/cung-ton/` (Phase 2) vẫn pass không đổi assertion; thẻ Khai hoang không còn chữ hướng dẫn, có thanh điểm + link chi tiết đúng variant; Back từ chi tiết giữ variant (contract plan `260922-1806` A3/A4 vẫn đạt).
- `npm run check && npm run build && npm run verify && npm run test:e2e`
- `node scripts/design-compare.mjs --phase 08` → `reports/visual-phase-08.md`.
