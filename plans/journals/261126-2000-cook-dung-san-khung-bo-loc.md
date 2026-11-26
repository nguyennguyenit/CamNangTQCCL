---
title: Cook dựng sẵn khung bộ lọc Đội chuẩn/Đội khác
date: 2026-11-26
summary: "3 phase xong, PR #184; spec layout-shift lộ thêm lệch 16px của #season-controls"
---

# Cook dựng sẵn khung bộ lọc Đội chuẩn/Đội khác

## What happened
- Worktree CamNangTQCCL-wt-ssr-khung, branch feat/ssr-khung-bo-loc từ origin/main; cook --tdd --auto 3 phase, PR #184.
- Mỗi lần sửa JS bị pin (team-filter-section, render, app, SiteLayout) phải re-pin site-localization và xuất bản lại generation: f95e0ece → 40c48cc3 → d5fc5c25 → e15a6a30; dữ liệu đội giống từng byte.
- Spec layout-shift mới đỏ ngay trên code phase 2: #season-controls rỗng có margin 16px cho tới khi app.js ẩn. Sửa bằng cách phát sẵn `hidden`; Cùng Tồn cũng hết lệch.
- Kích thước HTML /doi-chuan/ +13,6 KB (gzip +2,2 KB), vượt ước lượng 10 KB; chấp nhận.

## Decision
- Thanh gợi ý kho (#181) là độ lệch dọc duy nhất được phép; spec khẳng định đúng bằng chiều cao thanh + gap (145px + 12px ở 390px).

## Next steps
- Review PR #184 (đề xuất Astra → Fable vì có generation), rồi làm #181.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
