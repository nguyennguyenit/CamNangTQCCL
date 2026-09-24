---
phase: 6
title: "Trang chi tiết đội"
status: pending
priority: P1
effort: "2d"
dependencies: [5]
---

# Phase 6: Trang chi tiết đội

## Goal
Trang chi tiết Đội chuẩn, Đội khác và Khai hoang dùng chung khung TeamDetail; URL, dữ liệu và luồng quay lại giữ nguyên.

## Contract
Brainstorm §3 (URL chi tiết đóng băng), §7 Bước 4, §11.3 (Khai hoang chi tiết dùng khung TeamDetail), plan quyết định #9.

## Artboard
`TeamDetail.dc.html:35-117` — tiêu đề serif lớn + tên Trung, dòng mùa/danh mục, badge phe/binh, panel điểm 340px có "Xem nguồn" + nút sao chép link, 3 thẻ tướng (vai trò/chỉ số, tên VN + Trung, chiến pháp, binh thư), ghi chú nguồn đánh số.

## Files to Create / Modify
- Modify: `src/pages/doi-chuan/[team].astro`, `src/pages/doi-khac/[team].astro`, `src/pages/khai-hoang/[team].astro` (khung shell), `js/team-detail.js`, `js/recommended-reference-render.js` (`:73-101,184-300`), `js/khaihoang-detail.js`, `js/render.js` (`khaihoangBuildContent` `:234`, dùng chung cho thẻ `:432` và trang chi tiết `khaihoang-detail.js:4`), `js/recommended-reference-state.js` (tổng quát hóa kiểm URL nguồn `:172-181`), `css/styles.css` (`:870-896` và mới).
- Modify: policy + obligations theo plan.md "Quy trình bắt buộc mỗi phase" bước 2; `scripts/design-compare.mjs`; `tests-e2e/team-detail-pages.spec.mjs` (`:20-50,144-180`), `tests-e2e/khaihoang-options.spec.mjs` (phần detail và phần thẻ dùng `khaihoangBuildContent`).
- Obligation `translate` trong shell chi tiết: `src/pages/doi-chuan/[team].astro` 5, `src/pages/doi-khac/[team].astro` 4 (vd `ui:route-legacy/noscript` "danh sách Team khác", `site_localization.py:328`) → giữ chữ gốc/chữ đã duyệt trong đúng file khi dựng lại khung (plan.md "Quy trình bắt buộc mỗi phase" bước 2a).

## Tasks & Steps
1. Khung chung: hàng quay lại (`.detail-back-row`, `.detail-link` giữ) → header (tên serif, `nameZh` nếu có, dòng mùa · danh mục, badge phe + binh) → panel điểm (`.detail-score` giữ; số serif son; "Xem nguồn" trỏ link nguồn đã có trong dữ liệu — mọi URL nguồn của 3 họ (Recommended, legacy, Khai hoang `sources[].url` đang render thô ở `js/render.js:372`) qua cùng hàm kiểm scheme `http(s)`, URL hỏng → không render link (plan.md quyết định #14); nút "Sao chép liên kết" dùng `navigator.clipboard.writeText(location.href)` với thông báo `role="status"`, lỗi clipboard → chọn sẵn URL trong ô chỉ đọc).
2. Thẻ tướng ×3 theo artboard; giữ các phần detail đang có mà artboard không vẽ (ghi chú theo tướng, phương án thay thế, "Khắc được"/"Sợ", tham chiếu legacy, metadata nguồn) — xếp dưới thẻ tướng theo thứ tự artboard "ghi chú nguồn đánh số", không bỏ dữ liệu. "Khắc được"/"Sợ" lấy từ `content.counters` legacy (`recommended-reference-render.js:198-225`): trang Đội chuẩn hiện không có dữ liệu này (0/1366) → không render khối, không để tiêu đề rỗng.
3. Đội khác: phần nào thiếu dữ liệu (tên Trung, điểm) → không render phần đó, không để ô trống.
4. Khai hoang chi tiết: khung giống trên; nội dung hướng dẫn giữ đúng plan `260922-1806` (build đang chọn + hướng dẫn đầy đủ + chọn variant), chỉ đổi trình bày. **Khối build dùng chung** `khaihoangBuildContent` được thiết kế lại **ở phase này** theo artboard Khaihoang (mỗi tướng "Trước: …" → "Sau: …", chiến pháp chữ son, ghi chú build) vì `docs/code-standards.md:14` cấm fork markup build; Phase 8 dùng lại nguyên khối cho thẻ danh sách.
5. `?from=` và snapshot quay lại (Phase 2) không đổi hành vi.
6. Chữ mới ("Sao chép liên kết", "Đã sao chép", "Xem nguồn") → obligations.
7. Cặp so ảnh: TeamDetail ↔ `/doi-chuan/<đội đầu tiên trong catalog>/` ở 1440 và 390; thêm 1 trang Đội khác và 1 trang Khai hoang để soát chéo (không có artboard, chỉ kiểm nhất quán).

## Verification
- e2e: mở trực tiếp 3 loại trang chi tiết; sao chép liên kết (cấp quyền clipboard trong Playwright) ra đúng URL; Back/nút quay lại giữ bộ lọc + chế độ Thẻ/Bảng + cuộn; slug lạ vẫn 404; URL nguồn `javascript:` trong fixture không thành link; thẻ `/khai-hoang/` vẫn hiện khối build mới (dùng chung).
- Gate đầy đủ (plan.md "Quy trình bắt buộc mỗi phase" bước 3).
- `node scripts/design-compare.mjs --phase 06` → `reports/visual-phase-06.md`.
