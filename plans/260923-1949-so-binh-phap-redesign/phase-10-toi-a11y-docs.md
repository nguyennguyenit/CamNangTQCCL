---
phase: 10
title: "Giao diện tối, a11y, responsive, docs, full test"
status: pending
priority: P1
effort: "2d"
dependencies: [1, 2, 3, 4, 5, 6, 7, 8, 9]
---

# Phase 10: Giao diện tối, a11y, responsive, docs, full test

## Goal
Toàn site đạt acceptance A1–A7 của plan ở cả sáng và tối, docs mô tả đúng mô hình mới, toàn bộ bộ test và gate xanh.

## Contract
Brainstorm §4 (toàn bộ), §5 #5 (bảng tối, vẽ thêm chỗ xấu), §11.5 (tương phản), plan "Bằng chứng hiện trạng" (theme theo OS khi chưa lưu).

## Files to Create / Modify
- Modify: `css/styles.css` (chỉnh token/override tối).
- Modify: `docs/design-guidelines.md` (`:7-9,26-36,89-127,161-169`), `docs/code-standards.md` (`:9-20,22-35,39-47`), `docs/system-architecture.md` (`:111,114` mô tả `/#khaihoang` và root một trang).
- Create: `plans/260923-1949-so-binh-phap-redesign/reports/phase-10-final.md`.

## Tasks & Steps
1. **Rà tối:** chạy `design-compare` mọi phase ở theme tối (thêm cờ `--theme dark` đặt `localStorage.theme='dark'` trước khi tải). Không có artboard tối → soát theo bảng tối StyleGuide; chỗ xấu ghi vào báo cáo, sửa bằng token/override, chỗ cần thiết kế mới → dừng hỏi người dùng (brainstorm §5 #5).
2. **Tương phản:** script tạm duyệt mọi phần tử có chữ trên 10 trang đại diện × 2 theme, tính tương phản với nền thực (`getComputedStyle`) → 0 vi phạm A4. Màu phe/binh/trạng thái luôn có chữ.
3. **A11y + responsive:** mọi trang ở 320, 390, 768, 1440: không cuộn ngang (`document.documentElement.scrollWidth <= innerWidth`), vùng bấm ≥ 44px trên mobile (script đo `getBoundingClientRect` các `a, button, input, select, [role=button]`), focus-visible nhìn thấy, thứ tự Tab hợp lý, `prefers-reduced-motion` tắt chuyển động.
4. **Docs:** design-guidelines mô tả token (trỏ bảng token README design), component, header/footer/menu, Thẻ/Bảng, quy tắc 44px, theme theo OS, bộ chọn phạm vi mùa + chi tiết cấu hình (không có artboard, theo StyleGuide); code-standards mô tả mô hình trang mục + `data-section`, `SiteLayout` duy nhất, bảng payload mỗi trang mục (Phase 2 bước 2), fetch dữ liệu bằng đường dẫn tuyệt đối `/data/…`, allowlist `ROOT_QUERY_KEYS`, font trong `public/fonts/`, `site-nav.js`, quy trình hash policy; system-architecture bỏ mô tả `/#khaihoang` và root một trang (`docs/system-architecture.md:111,114`).
5. **Full test + gate:** chạy đủ bộ A2 + A3; ghi số obligation `authored-vi`/`translate` đã thêm/đổi, receipt đã nhận, vào báo cáo cuối.
6. Tổng hợp báo cáo so ảnh 25 artboard (link `visual-phase-*.md`), liệt kê chỗ lệch giữ lại có lý do.

## Verification
- `npm run check && npm run build && npm run verify && npm run test:node && npm run test:e2e && python3 -m unittest discover -s tests`
- `python3 -m pipeline.site_localization check --root . --stage public` → không problem.
- Script tương phản / vùng bấm / cuộn ngang: 0 vi phạm (đầu ra dán vào `reports/phase-10-final.md`).
- Người dùng xem báo cáo so ảnh và duyệt trước khi xin quyền deploy (deploy không thuộc plan).
