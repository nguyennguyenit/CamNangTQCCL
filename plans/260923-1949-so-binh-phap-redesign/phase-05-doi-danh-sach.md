---
phase: 5
title: "Đội chuẩn / Đội khác: lọc, thẻ, Thẻ/Bảng"
status: pending
priority: P1
effort: "3d"
dependencies: [3]
---

# Phase 5: Đội chuẩn / Đội khác: lọc, thẻ, Thẻ/Bảng

## Goal
`/doi-chuan/` và `/doi-khac/` có bố cục sidebar lọc, thẻ đội gọn và chế độ Bảng đúng artboard; bỏ bộ lọc điểm; mọi bộ lọc vẫn giữ trên URL.

## Contract
Brainstorm §5 #1–#3 (Thẻ/Bảng), §6 (bỏ lọc điểm, thẻ gọn), §8 (adapter legacy), §11.4 (44px mobile), plan quyết định #2, #9.

## Artboard
`Main.dc.html:33-141`, `MainTable.dc.html:42-149`, `MobileList.dc.html:41-100`, `MobileTable.dc.html`, `MobileFilters.dc.html:35-92`.

## Files to Create / Modify
- Modify: `js/team-filter-section.js` (`createRecommendedSection`, `:246-340`), `js/recommended-reference-render.js` (thẻ `:122-174`, slot `:32-68`), `js/recommended-reference-state.js` (bỏ `score`, thêm `view`), `js/app.js` (`REFERENCE_PARAMS`, `:262-280`).
- Create: `js/team-view.js` — đọc/ghi lựa chọn Thẻ/Bảng (URL > `localStorage['team-view']` > mặc định Thẻ) và adapter hàng Bảng cho Recommended + legacy. Chỉ tách file nếu renderer vượt quá sức chứa; nếu nhỏ, đặt trong `recommended-reference-render.js`.
- Modify: `css/styles.css`; policy + obligations; `scripts/design-compare.mjs`.
- Modify tests: `tests-e2e/recommended-browser.spec.mjs` (`:146-168,302-388,407-444`), `tests-js/recommended-reference-state.test.mjs` (`:79-112`), `tests-js/team-detail-navigation.test.mjs` (`:167-169`), `tests-e2e/season-lookup.spec.mjs` nếu đụng.

## Tasks & Steps
1. **Đầu trang:** eyebrow "ĐỘI HÌNH" màu son, h1 serif 48px, mô tả 15px; select "Mùa nguồn" + "Danh mục" (44px) bên phải (desktop) / trên ô tìm (mobile).
2. **Sidebar 272px (desktop):** "Bộ lọc" + "Xóa lọc" (disabled khi không có lọc); nhóm Loại binh, Phe (ô vuông màu phe + chữ + số đếm), Nhóm, Nguồn thu gọn (`aria-expanded`). Giữ `.fchip`, `.fgroup`, `.clear-btn`. Mobile: nút "Bộ lọc" + số lọc đang bật mở panel theo `MobileFilters` (chip 44px, Nhóm/Nguồn dạng accordion).
3. **Bỏ lọc điểm:** xóa facet `score` khỏi UI, state (`recommended-reference-state.js:23-25,69-74,149-166`), `REFERENCE_PARAMS`; URL cũ có `score=` bị bỏ qua và bị xóa khỏi URL ở lần `replaceState` đầu. Xóa test facet điểm; thay bằng một ca: URL có `score=113` → mọi đội hiển thị, URL sau khi tải không còn `score`.
4. **Thanh công cụ:** ô tìm 48px + "x / y đội" (`role="status"`) + nhóm 2 nút Thẻ | Bảng dùng `aria-pressed` theo StyleGuide mục "Nhập liệu & hiển thị dữ liệu" (artboard Main dùng `<a aria-current>` — StyleGuide là bản mới hơn, theo StyleGuide); desktop có chữ, mobile chỉ icon 44×44.
5. **Thẻ gọn** (lưới 2 cột desktop, 1 cột mobile): header = tên đội serif 19px (link chi tiết) + dòng "■ phe · binh" (bỏ phần thiếu); điểm serif 28px màu son + "điểm" (`.reference-score` giữ; đội không có điểm → không hiện số). Mỗi tướng: vai trò viết tắt (CHỦ / PHÓ 1 / PHÓ 2), tên 600, chiến pháp chữ son là nút tìm, dòng "Binh thư · …"; binh thư trống → một dòng nghiêng "Nguồn chưa ghi" (thay 3 tag "Chưa có dữ liệu"). Footer: "Sợ …" (từ counters `avoid`), "Thay thế (n) ▾" mở `<details class="reference-alternatives">` hiện có, "Chi tiết →" (`.ana-link-btn` giữ). Bỏ chip ⚔/⚠; "Khắc được" chỉ còn ở trang chi tiết (Phase 6).
6. **Chế độ Bảng:** bảng 5 cột Đội | Chủ tướng | Phó 1 | Phó 2 | Điểm (`<table>`, `<th scope="row">` cho đội), hàng xen màu; ô tướng = tên + 2 chiến pháp chữ son; ô đội = tên link + "■ phe · binh". Adapter: Recommended `displayNameVi`, `heroes[0..2].displayNameVi || nameRaw`, `tacticSlotsVi`, `value`; legacy `nickname || name`, `holders[0..2]`, điểm vắng → "—". Link chi tiết giữ `sourceConfigId` / `legacyTeamId` + `legacyVariantId`. Mobile (`MobileTable`) theo artboard, không cuộn ngang toàn trang (bảng nằm trong vùng cuộn riêng có nhãn nếu cần).
7. **Ghi nhớ:** `?view=bang` chỉ xuất hiện khi Bảng; đổi chế độ → `replaceState` + ghi `localStorage['team-view']`; URL không có `view` → dùng giá trị đã lưu; lỗi storage → Thẻ. Áp chung cho cả hai trang.
8. Chữ mới ("Nguồn chưa ghi", "Sợ", "Thay thế", nhãn Bảng) → obligations; chữ `translate` đổi ("Phương án thay thế" → "Thay thế", "Xem chi tiết" → "Chi tiết") → danh sách chờ receipt.
9. Cặp so ảnh: Main (`/doi-chuan/`), MainTable (`/doi-chuan/?view=bang`), MobileList, MobileTable, MobileFilters (setup: click "Bộ lọc").

## Verification
- e2e: lọc phe/binh/nhóm/nguồn + tìm vẫn đúng và giữ trên URL; `score=` bị bỏ; chuyển Thẻ/Bảng giữ bộ lọc, reload giữ chế độ, URL `?view=bang` thắng storage; Bảng của Đội khác hiện "—" khi thiếu điểm; từ Bảng vào chi tiết rồi Back về đúng Bảng + vị trí.
- `node --test tests-js/recommended-reference-state.test.mjs tests-js/team-detail-navigation.test.mjs`
- `npm run check && npm run build && npm run verify && npm run test:e2e`
- `node scripts/design-compare.mjs --phase 05` → `reports/visual-phase-05.md`.
