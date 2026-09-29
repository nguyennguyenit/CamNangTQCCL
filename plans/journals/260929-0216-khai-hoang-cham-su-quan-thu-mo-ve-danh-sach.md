---
title: "Khai hoang: Chạm Sứ và quân thủ mỏ về trang danh sách"
date: 2026-09-28
summary: "Chuyển hai khối tham khảo chung từ 17 trang chi tiết về /khai-hoang/ kèm nút nhảy; TDD e2e, re-publish localization"
---

# Khai hoang: Chạm Sứ và quân thủ mỏ về trang danh sách

## What happened
- Chạm Sứ / Ăn vạ (`chamSuTeams`) và Quân thủ các mỏ (`mines`) là trường top-level của `data/khaihoang.json`, nhưng redesign 260928 đặt chúng trên mọi trang chi tiết `/khai-hoang/<handle>/` nên 17 trang lặp y hệt.
- TDD: viết lại e2e `tests-e2e/khaihoang-options.spec.mjs` trước (8 ca đỏ), rồi chuyển `khaihoangReference` vào `khaihoangTable` (`js/render.js`), thêm nút nhảy `#de-xuat/#cham-su/#mo`, bỏ khối khỏi `js/khaihoang-detail.js`, cuộn tới hash sau mount trong `js/app.js`, CSS `.kh-jump`/`.kh-reference`.
- Localization: 4 tuple mới + đổi `lead`; policy `site-vi-260929-khai-hoang-tham-khao`, baseline 56593, publish generation `f71e22b6…`, xoá `afc632de…`, re-pin `pipeline/team-route-handles.json`. Candidate phải nằm trong repo (`.tmp/`), không được ở `/tmp`.

## Decision
- Bộ lọc loại binh không lọc Chạm Sứ/mỏ (quân thủ mỏ là quân địch).
- Trang chi tiết xoá hẳn, không để link thay thế (user chọn).
- Cuộn hash làm trong `app.js` vì nội dung dựng sau khi tải dữ liệu; `scroll-margin-top` 88px tránh header dính.

## Gotchas
- `scripts/design-compare.mjs --tokens` hỏng sẵn ở probe Tra cứu (`#section-lookup .lookup-chip`), không đo được probe Khai hoang; kiểm bằng e2e + script tạm.
- Trang dùng smooth scroll: đo vị trí ngay sau load sai, phải đợi.

## Next steps
- Sửa probe Tra cứu trong `tokens.json` để `design-compare --tokens` chạy lại được.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
