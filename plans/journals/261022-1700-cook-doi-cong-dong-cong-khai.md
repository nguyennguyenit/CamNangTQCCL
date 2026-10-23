---
title: Cook Đội cộng đồng công khai (phase 1–3 + docs)
date: 2026-10-22
summary: "Menu/landing, export + site-publish, trang tĩnh SEO; mọi cổng local xanh; dừng trước deploy"
---

# Cook Đội cộng đồng công khai (phase 1–3 + docs)

## What happened
- Phase 1: thêm Đội cộng đồng vào menu/thanh chuyển nhanh/footer/landing, icon riêng `community`; publish lại bản dịch (generation 42ea8bc0…).
- Phase 2: `GET /api/community-teams/export` (schema v1), `site-publish` ở approve, xoá đội approved (pha 1), ban, unban, xoá user (pha 1); timeout 5s; workflow `types: [site-publish]` + cron hằng ngày.
- Phase 3: trang tĩnh `/doi-cong-dong/<id>/` vi+zh, canonical theo textLang, không hreflang, JSON-LD bản gốc, danh sách noindex <10 đội, verifier/sitemap, redirect `?id=` có điều kiện.
- Review độc lập: sửa tên tác giả rỗng làm vỡ verify toàn site (H1), dispatch thừa khi xoá đội pending (M1), timeout dispatch, ngày hiển thị.
- E2E bắt hồi quy: thanh chuyển nhanh thêm mục cao ~492px đè header ở 1024×600 → breakpoint chiều cao 580→620px.

## Verification
- community-worker 557/557 + typecheck; test:node 638/638; l10n check; build+verify (5407 file); test:dist 54/54; test:e2e 551 passed.

## Next steps
- Chờ user: thứ tự merge so với đợt 9 issue; deploy Worker → merge main → gh workflow run → smoke [SMOKE].

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
