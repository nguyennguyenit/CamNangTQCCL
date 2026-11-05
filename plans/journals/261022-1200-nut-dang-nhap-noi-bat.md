---
title: "Nút Đăng nhập header nổi bật từ 821px"
date: 2026-10-22
summary: "Advise → cook --tdd: hiện chữ + viền --nav-underline ở ≥821px, mobile giữ icon; CSS-only"
---

# Nút Đăng nhập header nổi bật từ 821px

Worktree `../worktrees/CamNangTQCCL-nut-dang-nhap-noi-bat`, nhánh `feat/nut-dang-nhap-noi-bat` (từ `origin/main` 5b6014a). Chưa commit.

## Bối cảnh
Yêu cầu ban đầu "thêm nút Đăng ký/Đăng nhập". Site đã có đăng nhập Google (lần đầu tự tạo tài khoản); vấn đề thật là ở 821–1279px nút chỉ còn icon không viền, lẫn với nút ngôn ngữ và sáng/tối.

## Đo trước khi quyết
- 821–1279px: thêm chữ không tràn, chữ logo đủ (vi 165/165, zh 194/194).
- 361–475px: chữ trên nút cắt chữ logo "Cẩm Nang" → người dùng chọn giữ icon trên mobile.
- `--accent` sáng trên `--band` chỉ 2.40:1 (< 3:1 WCAG 1.4.11) → dùng `--nav-underline` (5.42 sáng / 5.54 tối).

## Thay đổi
- `css/styles.css`: ẩn nhãn ở `max-width: 820px` thay vì 1279px (gộp vào khối 820px có sẵn); viền `--nav-underline` cho `.header-actions .cm-auth-login` và `:hover` (phải có `:hover` vì `.header-actions .icon-btn:hover` xoá viền); sửa comment.
- `tests-e2e/responsive.spec.mjs`: test mới — 390/821/1024/1279/1366px × `/`, `/doi-chuan/`, `/zh/doi-chuan/` × sáng/tối: nhãn, viền lúc thường và rê chuột, không tràn, logo không cắt. Đỏ trước khi sửa, xanh sau.

## Kiểm chứng
`npm run check` 0 lỗi; `npx playwright test` 541/541 pass. Focus-visible: vòng 2px lệch 3px tạo viền kép, vẫn phân biệt được.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
