---
title: "So Binh Phap: anh chuan design va plan redesign"
date: 2026-09-24
summary: "Them shim support.js + script chup 25 artboard, lap plan 10 phase cho redesign So binh phap"
---

# So Binh Phap: anh chuan design va plan redesign

## What happened
- Canvas claude.ai không đọc được từ agent; artboard `.dc.html` cần runtime `support.js` không có trong bản chụp, và `<sc-for>` nằm trong `<table>/<tr>` bị trình duyệt dời chỗ nếu dựng từ DOM.
- Viết shim `docs/design/so-binh-phap/project/support.js` (đọc lại mã nguồn qua HTTP, đổi sc-if/sc-for thành `<template>`, báo lỗi khi gặp cấu trúc lạ) + `scripts/design-capture.mjs`; chụp 25 ảnh chuẩn vào `screens/` (~5.4 MB). Commit `9e0c63e`.
- Lập plan `plans/260923-1949-so-binh-phap-redesign` (10 phase), blockedBy plan Khai hoang `260922-1806`. Commit `cb4cbdf`.

## Decision
- Không chép runtime gốc của canvas (mã bên thứ ba); shim chỉ hỗ trợ đúng cấu trúc bản chụp dùng.
- Người dùng chốt: thẻ Khai hoang = build + thanh điểm, hướng dẫn ở trang chi tiết; tổng quan Cùng Tồn hiện nguyên văn gốc; ngày build + ẩn "Góp ý"; "dành cho game".
- Tự rà thay red-team (4 reviewer bị 429): 6 finding, đáng chú ý nhất là `app.js` tải toàn bộ dữ liệu lúc khởi động (`js/app.js:154-196`) nên phải tải dữ liệu theo từng mục khi tách trang.

## Next steps
- Người dùng đối chiếu `screens/` với canvas gốc một lần, ghi kết quả vào README design.
- Chạy lại red-team độc lập khi hết giới hạn.
- Cook plan sau khi plan Khai hoang land.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
