---
phase: 8
title: "Cùng Tồn + Khai hoang"
status: pending
priority: P2
effort: "2.5d"
dependencies: [5, 6]
---

# Phase 8: Cùng Tồn + Khai hoang

## Goal
`/cung-ton/` có chọn nhóm theo từng kịch bản và ô tổng quan; `/khai-hoang/` có thẻ build Trước → Sau (khối dùng chung đã làm ở Phase 6), thanh điểm 6 mốc, lưới Chạm Sứ, bảng quân thủ mỏ — theo artboard và quyết định nội dung đã chốt.

## Contract
Brainstorm §2 (thuật ngữ Chạm Sứ), §6 (Cùng Tồn, Khai hoang), §3 (không đổi dữ liệu), plan quyết định #8 (thẻ Khai hoang, tổng quan Cùng Tồn).

## Artboard
`Coexist.dc.html:45-84`, `CoexistMobile.dc.html:38-51`, `Khaihoang.dc.html:34-97`, `KhaihoangMobile.dc.html:37-77`.

## Files to Create / Modify
- Modify: `js/render.js` (Cùng Tồn `seasonCoexistGroup`/`coexistGroup` `:497-520`; thẻ Khai hoang `:333-385,411-471` — **không** đổi `khaihoangBuildContent` `:234` ngoài phần Phase 6 đã làm), `js/team-filter-section.js` (nhóm Cùng Tồn `:231-240`), `js/app.js` (query nhóm), `js/team-detail-navigation.js` (khóa được giữ của `/cung-ton/` thêm `group`), `css/styles.css` (gồm bộ chọn phạm vi mùa `#season-controls` và chi tiết cấu hình `#season-config-detail` trên `/cung-ton/`).
- Modify: policy + obligations theo plan.md "Quy trình bắt buộc mỗi phase" bước 2; `scripts/design-compare.mjs`; `tests-e2e/season-lookup.spec.mjs` (`:23-49,157-174`), `tests-e2e/khaihoang-options.spec.mjs` (thẻ + trang chi tiết Khai hoang).

## Tasks & Steps
1. **Cùng Tồn — chọn nhóm theo kịch bản.** Dữ liệu thật: 10 nhóm có liên kết mùa — 5 nhóm `binh-dien-xuan-thu` (source-owned) + 5 nhóm `anh-hung-menh-the` (legacy), cả hai bộ đều đặt nhãn "Cùng tồn 1…5" (`data/season-content-links.json`, `data/coexist.json:3,244`); phạm vi mặc định `all-reference` đẩy cả 10 thành `scenarioReference` (`js/season-context.js:349-350,365`). Vì vậy: hàng chọn **kịch bản** (nhãn `labelVi` từ `season-registry.json`, `aria-pressed`) → hàng chọn **nhóm 1–5** của kịch bản đó (nhãn `groupLabel`, `aria-pressed`) — đúng artboard "nhóm 1–5". Tập kịch bản/nhóm là **đúng tập `update(groups)` nhận** (không lọc thêm ngoài phép chiếu phạm vi hiện có); tiêu đề khối nhóm ghi kịch bản + phân loại ("Áp dụng theo phiên bản luật" / "Tham khảo kịch bản" / "Chưa xác định kịch bản"); nhóm không gắn kịch bản (nhánh `unknown`) nằm trong mục riêng "Chưa xác định kịch bản". Nhóm đang chọn ghi vào query `group=<recordId>` (`replaceState`; mọi nhóm có liên kết đều có `recordId`, `render.js:511`, `season-context.js:368`); nhánh không có mô hình mùa dùng số thứ tự 1-based trong `coexist.json`. Mặc định nhóm đầu của kịch bản đầu theo thứ tự nhận; `group` không còn hợp lệ sau khi đổi phạm vi → về nhóm đầu và bỏ `group` khỏi URL. Danh sách rỗng giữ thông báo hiện có (`team-filter-section.js:239`).
2. **Cùng Tồn — ô tổng quan:** "5 đội · 15 tướng · không trùng" **tính** từ mảng 3 tướng mỗi đội (`pipeline/season_validation.py:346-353`): số đội, số tướng khác nhau, có trùng hay không (trùng → hiện "có trùng: <tên>"). Hiện **nguyên văn** mọi trường nguồn đang render (`render.js:511-516`): `summaryRaw` ("Tổng quan"), `openingSuggestionsRaw` ("Gợi ý khai hoang"), `notesRaw` ("Ghi chú"), dòng phân loại phạm vi (`scope-note`), link "Nguồn Cùng Tồn" (`source.url`, `rel="noopener noreferrer"` giữ) và `disclaimerRaw` ("Lưu ý nguồn") — qua helper `el()` gán text (`js/render.js:1-4`), không `innerHTML`; trường rỗng → không render ô. Nhánh không có mô hình mùa (`coexistGroup(reference.content)`, `:498`) dùng cùng khung với các trường nó có. Không tách câu, không thêm trường dữ liệu, không bỏ nguồn/lưu ý.
2b. **Phạm vi mùa + chi tiết cấu hình trên `/cung-ton/`** (Phase 2 giữ hành vi, không có artboard): select Mùa / Phiên bản luật dùng component select 44px + nhãn caps của StyleGuide "Nhập liệu & hiển thị dữ liệu"; chi tiết cấu hình `?config=` dùng token panel/thẻ. Ghi vào `visual-phase-08.md` là "không có artboard, theo StyleGuide". **Dữ liệu thật (đo 2026-09-25):** `season-registry.json` có 2 kịch bản reviewed, **0** phiên bản luật reviewed; `season-team-configs.json` và `season-team-evaluations.json` **rỗng** → trên site thật chỉ select Mùa có tác dụng (phân loại nhóm Cùng Tồn qua 10 `season-content-links`), select Phiên bản luật luôn disabled, chi tiết cấu hình không bao giờ hiện. Vì vậy: select Mùa làm đầy đủ theo StyleGuide; select Phiên bản luật và chi tiết cấu hình chỉ áp token (màu, viền, radius, cỡ chữ), không trau chuốt bố cục, không thêm cặp so ảnh; kiểm bằng fixture `season-lookup.spec.mjs` hiện có.
3. **Khai hoang — thẻ** (theo plan `260922-1806` + quyết định 2026-09-24): khối build dùng chung `khaihoangBuildContent` (Trước → Sau, chiến pháp chữ son, ghi chú build) đã thiết kế ở Phase 6 — thẻ chỉ bọc khối đó, không fork markup (`docs/code-standards.md:14`); chọn cấu hình (chip 44px); thanh điểm 6 mốc (Đất 4, Đất 5, Đất 6, Đất 7–8, Chuyển, Tổng; thang /10, cột Tổng màu mực) đọc từ `guide.ratings` (`land4, land5, land6, land7to8, transition, overall`, vd `data/khaihoang.json:188`) — chỉ 11/17 đội có guide nên chỉ 11 thẻ có thanh; đội không có `ratings` → không vẽ thanh. Thẻ chỉ hiện số liệu, chữ hướng dẫn ở trang chi tiết; dòng cuối thẻ là link "Hướng dẫn đánh đất →" tới `/khai-hoang/<đội>/` (giữ `variant`); đội không có guide vẫn có link "Chi tiết →".
4. **Khai hoang — khối khác:** lọc loại binh (chip), anchor 3 khối "Đội đề xuất", "Chạm Sứ / Ăn vạ", "Quân thủ các mỏ" (nút nhảy khối trên đầu trang); lưới Chạm Sứ; bảng/thẻ quân thủ mỏ theo artboard (mobile: thẻ từng mỏ).
5. Thuật ngữ: khối Khai hoang dùng "Chạm Sứ"; không đổi 5 tên "…cảm tử".
6. Chữ mới → obligations `authored-vi`; obligation `translate` dời/bỏ/đổi → chờ receipt (plan.md "Quy trình bắt buộc mỗi phase" bước 2a).
7. Cặp so ảnh: Coexist, CoexistMobile, Khaihoang, KhaihoangMobile.

## Verification
- e2e: chọn kịch bản rồi nhóm Cùng Tồn cập nhật URL + reload giữ nhóm; phạm vi mặc định hiện 2 kịch bản × 5 nhóm, không có hai nút cùng nhãn trong một hàng; đổi Mùa làm hàng kịch bản/nhóm khớp đúng tập nhóm của phạm vi đó (so với phép chiếu `projectSeasonBrowse` tính trong test) và `group` không hợp lệ bị bỏ; nhóm đang xem có đủ Tổng quan / Gợi ý khai hoang / Ghi chú / link nguồn / Lưu ý nguồn khi dữ liệu có; số liệu tổng quan khớp phép đếm độc lập trong test; các ca `season-lookup.spec.mjs` trên `/cung-ton/` (Phase 2) vẫn pass không đổi assertion; thẻ Khai hoang không còn chữ hướng dẫn, có thanh điểm + link chi tiết đúng variant; Back từ chi tiết giữ variant (contract plan `260922-1806` A3/A4 vẫn đạt); trang chi tiết Khai hoang không đổi so với báo cáo Phase 6.
- Gate đầy đủ (plan.md "Quy trình bắt buộc mỗi phase" bước 3).
- `node scripts/design-compare.mjs --phase 08` → `reports/visual-phase-08.md`.
