---
title: "Plan quản trị người dùng: KDV, khoá, xoá, nhật ký"
date: 2026-10-16
summary: "Advise + 2 vòng kiểm chứng + plan 6 phase, red team 15 phát hiện đã áp"
---

# Plan quản trị người dùng: KDV, khoá, xoá, nhật ký

Plan: `plans/261016-1757-quan-ly-nguoi-dung/`. Chưa sửa code, chưa commit.

## Kiểm chứng đã chạy (dữ liệu giả)
- Better Auth 1.7.6, luồng OAuth thật trên SQL + migration thật: hook `session.create.before` ném `APIError` có `code` → redirect kèm `error_description`; trả `false` chỉ báo lỗi chung; khoá chen giữa đăng nhập vẫn lọt 1 session nếu chỉ có hook + xoá session; trigger `before insert on session` chặn được (callback trả 500).
- `getSession` trả `additionalFields` mới ngay → guard mỗi request không tốn truy vấn. Thời gian Better Auth là ISO text.
- D1 cục bộ: trigger `RAISE(ABORT)` và `insert ... where changes()=1` chạy được. D1 `batch` là transaction (docs Cloudflare).
- Xoá user: `feedback.email/body`, `posts.author_id/author_name` không theo cascade.

## Red team (4 lens, 37 → 15)
Bẫy lớn: harness `fakes.ts:199` thay `getSessionUser` bằng `USERS` tĩnh nên test khoá/quyền sẽ không chạy code thật; KDV dò email qua `like`; xoá user xoá ảnh bài viết (`uploads.kind='post'`); ảnh `reports/*` mồ côi khi batch bị trigger huỷ; lọc trong `listReports` làm trống hàng chờ admin; wrapper callback biến mọi 500 thành "bị khoá"; thông báo khoá giả mạo qua URL; Pages tự build từ `main` + Better Auth kiểm schema lúc chạy → thứ tự rollout.

## Quyết định
Chặn xoá khi đang khoá (409); xoá cựu admin: `author_id=null`, giữ `author_name`; không đăng nhập Google thật, smoke bằng `wrangler pages dev` + session seed.

## Tiếp theo
`/ak:cook plans/261016-1757-quan-ly-nguoi-dung/plan.md --tdd`. Trigger chưa thử trên D1 remote.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
