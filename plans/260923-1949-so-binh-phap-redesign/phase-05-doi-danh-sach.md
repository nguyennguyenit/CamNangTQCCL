---
phase: 5
title: "Đội chuẩn / Đội khác: lọc, thẻ, Thẻ/Bảng"
status: completed
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
- Modify: `js/team-filter-section.js` (`createRecommendedSection`, `:246-340`; trạng thái mở/đóng `score` `:382,389`), `js/recommended-reference-render.js` (thẻ `:122-174`, slot `:32-68`), `js/recommended-reference-state.js` (bỏ `score`, thêm `view`), `js/app.js` (`navigateReference()` và nơi gọi — `REFERENCE_PARAMS` không còn tồn tại sau Phase 2; scout lại trước khi sửa), `js/team-detail-navigation.js` (khóa được giữ của Đội chuẩn/Đội khác thêm `view`; `safeDisclosures` bỏ `score`, `:276`).
- Create: `js/team-view.js` — đọc/ghi lựa chọn Thẻ/Bảng (URL > `localStorage['tqccl.teamView.v1']` > mặc định Thẻ; tên khóa theo quy ước `tqccl…vN` như `js/roster-scan-state.js:1`) và adapter hàng Bảng cho Recommended + legacy. Chỉ tách file nếu renderer vượt quá sức chứa; nếu nhỏ, đặt trong `recommended-reference-render.js`. File mới trong `js/` → thêm `entry()` vào manifest.
- Modify: `css/styles.css`; policy + obligations theo plan.md "Quy trình bắt buộc mỗi phase" bước 2; `scripts/design-compare.mjs`.
- Modify tests: `tests-e2e/recommended-browser.spec.mjs` (`:146-168,302-388,407-444`), `tests-e2e/team-detail-pages.spec.mjs` (ca quay lại bấm `.score-toggle`/`.score-group .fchip`, `:404-406,419,441-442,464`), `tests-js/recommended-reference-state.test.mjs` (`:79-112`), `tests-js/team-detail-navigation.test.mjs` (`:167-169,230-234`), `tests-e2e/season-lookup.spec.mjs` nếu đụng.

## Tasks & Steps
1. **Đầu trang:** eyebrow "ĐỘI HÌNH" màu son, h1 serif 48px, mô tả 15px; select "Mùa nguồn" + "Danh mục" (44px) bên phải (desktop) / trên ô tìm (mobile).
2. **Sidebar 272px (desktop):** "Bộ lọc" + "Xóa lọc" (disabled khi không có lọc); nhóm Loại binh, Phe (ô vuông màu phe + chữ + số đếm), Nhóm, Nguồn thu gọn (`aria-expanded`). Giữ `.fchip`, `.fgroup`, `.clear-btn`. Mobile: nút "Bộ lọc" + số lọc đang bật mở panel theo `MobileFilters` (chip 44px, Nhóm/Nguồn dạng accordion).
3. **Bỏ lọc điểm:** xóa facet `score` khỏi UI, state (`recommended-reference-state.js:23-25,69-74,149-166`), `navigateReference()`; URL cũ có `score=` bị bỏ qua và bị xóa khỏi URL ở lần `replaceState` đầu. Xóa test facet điểm; thay bằng một ca: URL có `score=113` → mọi đội hiển thị, URL sau khi tải không còn `score`.
3b. **URL quay lại:** Phase 2 đã đổi `safeReturnUrl` sang "giữ khóa được phép theo trang, bỏ lặng lẽ khóa khác". Phase 5 chỉ thêm `view` vào khóa được giữ của `/doi-chuan/`, `/doi-khac/`; `score` không còn trong danh sách nên tự bị bỏ (link chi tiết cũ có `from=…score=…` vẫn về đúng trang mục, chỉ mất `score`). Viết lại ca `tests-js/team-detail-navigation.test.mjs:167-169` theo hành vi này + thêm ca `view=bang` sống sót qua `safeReturnUrl`. Bỏ `score` khỏi `safeDisclosures` và ca `:230-234`.
4. **Thanh công cụ:** ô tìm 48px + "x / y đội" (`role="status"`) + nhóm 2 nút Thẻ | Bảng dùng `aria-pressed` theo StyleGuide mục "Nhập liệu & hiển thị dữ liệu" (artboard Main dùng `<a aria-current>` — StyleGuide là bản mới hơn, theo StyleGuide); desktop có chữ, mobile chỉ icon 44×44.
5. **Thẻ gọn** (lưới 2 cột desktop, 1 cột mobile): header = tên đội serif 19px (link chi tiết) + dòng "■ phe · binh" (bỏ phần thiếu); điểm serif 28px màu son + "điểm" (`.reference-score` giữ; đội không có điểm → không hiện số). Mỗi tướng: vai trò viết tắt (CHỦ / PHÓ 1 / PHÓ 2), tên 600, chiến pháp chữ son là nút tìm, dòng "Binh thư · …"; binh thư trống → một dòng nghiêng "Nguồn chưa ghi" (thay 3 tag "Chưa có dữ liệu"). Footer: "Sợ …" (từ counters `avoid`), "Thay thế (n) ▾" mở `<details class="reference-alternatives">` hiện có, "Chi tiết →" (`.ana-link-btn` giữ). Bỏ chip ⚔/⚠; "Khắc được" chỉ còn ở trang chi tiết (Phase 6). **Độ phủ dữ liệu:** counters chỉ đến từ `legacyContent`/`legacyReferences` (`recommended-reference-render.js:147-149`); generation đang pin có 0/1366 bản ghi Đội chuẩn và 9/40 bản ghi Đội khác có `avoid` → thẻ Đội chuẩn **không** có chữ "Sợ", không để khoảng trống; ghi độ lệch so với artboard Main vào `visual-phase-05.md` ("giữ, dữ liệu không có").
6. **Chế độ Bảng:** bảng 5 cột Đội | Chủ tướng | Phó 1 | Phó 2 | Điểm (`<table>`, `<th scope="row">` cho đội), hàng xen màu; ô tướng = tên + 2 chiến pháp chữ son; ô đội = tên link + "■ phe · binh". Adapter: Recommended `displayNameVi`, `heroes[0..2].displayNameVi || nameRaw`, `tacticSlotsVi`, `value`; legacy `nickname || name`, `holders[0..2]`, điểm vắng → "—". Link chi tiết giữ `sourceConfigId` / `legacyTeamId` + `legacyVariantId`. Mobile (`MobileTable`) theo artboard, không cuộn ngang toàn trang (bảng nằm trong vùng cuộn riêng có nhãn nếu cần).
7. **Ghi nhớ:** `?view=bang` chỉ xuất hiện khi Bảng; đổi chế độ → `replaceState` + ghi `localStorage['tqccl.teamView.v1']`; URL không có `view` → dùng giá trị đã lưu; lỗi storage → Thẻ. Áp chung cho cả hai trang.
8. Chữ mới ("Nguồn chưa ghi", "Sợ", "Thay thế", "Chi tiết", nhãn Bảng) → obligations `authored-vi`. "Phương án thay thế" và "Xem chi tiết" (`recommended-reference-render.js:141,173`) **không** nằm trong `UI_LITERAL_OBLIGATIONS` hay ledger → đổi chữ không cần receipt; nếu muốn phủ gate thì khai báo mới là `authored-vi`.
9. Cặp so ảnh: Main (`/doi-chuan/`), MainTable (`/doi-chuan/?view=bang`), MobileList, MobileTable, MobileFilters (setup: click "Bộ lọc").

## Verification
- e2e: lọc phe/binh/nhóm/nguồn + tìm vẫn đúng và giữ trên URL; `score=` bị bỏ; chuyển Thẻ/Bảng giữ bộ lọc, reload giữ chế độ, URL `?view=bang` thắng storage; Bảng của Đội khác hiện "—" khi thiếu điểm; từ Bảng vào chi tiết rồi Back về đúng Bảng + vị trí.
- `node --test tests-js/recommended-reference-state.test.mjs tests-js/team-detail-navigation.test.mjs`
- Gate đầy đủ (plan.md "Quy trình bắt buộc mỗi phase" bước 3).
- `node scripts/design-compare.mjs --phase 05` → `reports/visual-phase-05.md`.
