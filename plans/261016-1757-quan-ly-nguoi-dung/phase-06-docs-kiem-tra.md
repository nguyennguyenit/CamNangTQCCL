---
phase: 6
title: "Docs, changelog, kiểm tra toàn bộ"
status: completed
priority: P2
effort: "0.5d"
dependencies: [5]
---

# Phase 6 — Docs, changelog, kiểm tra toàn bộ

<!-- Updated: Red Team 2026-10-17 - đủ dòng docs cần sửa, grep gồm test, luật rollout + rollback 0007 -->

## Mục tiêu
Tài liệu khớp hành vi mới; mọi bộ test và build xanh; có hướng dẫn deploy/rollback đúng thứ tự cho lúc được phép.

## File
- Sửa `docs/community-worker.md`:
  - `:119-120` (API AI: "(admin)" → root).
  - `:163` (góp ý admin → staff, email che với KDV + `emailMasked`, `body` không che).
  - `:167` (Soi đội "chỉ admin" → staff; KDV duyệt được cả mẫu của mình).
  - `:171` (cache ảnh chiến báo đã duyệt → `public, no-cache` + 304; ẩn khi user bị chặn).
  - `:173` (counts: staff).
  - Mục mới "Vai trò và người dùng": root/KDV và ma trận quyền; khoá (thời hạn, lý do, `banned_by_role`, KDV không đè khoá của root); guard + trigger (`session`, `uploads`, `battle_reports`, `scan_samples`) chạy theo đồng hồ DB; race đăng nhập trả 500 một lần; token thông báo + `GET /api/ban-notice`; ẩn nội dung; xoá (409 khi đang khoá, giữ ảnh bài viết, `author_id` null, thử lại sau `delete_incomplete`); nhật ký và quy tắc `ok/partial/failed`; `last_seen_at` (ghi ≤ 1 lần/10 phút).
  - Mục Kiểm tra: `test/auth-ban.test.ts` dùng Better Auth thật trên fake D1.
  - Mục deploy: thứ tự bên dưới.
- Sửa `docs/system-architecture.md:139` ("sáu khu" → số khu mới, nêu Người dùng/Nhật ký).
- Sửa `docs/project-changelog.md` (mục mới đầu file theo định dạng hiện có).
- Tạo `community-worker/rollback/0007_drop_user_block_triggers.sql` (không đặt trong `migrations/`, chỉ dùng khi rollback): `drop trigger if exists` 4 trigger của `0006`.

## Các bước
1. Công cụ grep `isAdmin|requireAdmin` trong `community-worker/src`, `community-worker/test`, `js/`, `tests-e2e/`, `docs/` → chỉ còn trong `docs/project-changelog.md` (lịch sử).
2. Cập nhật docs như trên.
3. Chạy toàn bộ kiểm tra. Lỗi → sửa ở phase gây ra, chạy lại.
4. Áp `0006` trên D1 cục bộ tạm (lệnh ở phase 1) để xác nhận chạy trên engine D1; chạy `rollback/0007...` trên cùng DB tạm → insert session cho user bị khoá thành công (trigger đã gỡ).
5. Ghi `reports/phase-06.md`: kết quả lệnh, ảnh chụp UI vi/zh, việc khi deploy.

## Kiểm tra
- `cd community-worker && npx tsc --noEmit && npx vitest run`
- `npm run test:node`
- `npm run build && npm run verify && npm run test:dist`
- `npm run test:e2e`

## Việc khi được phép deploy (không làm trong plan này)
Luật cứng: **không push `main` trước khi Worker mới đã chạy** — Pages tự build từ `main` mỗi lần publish/sửa bài (`.github/workflows/pages-deploy.yml:7-10`), client mới cần `role` từ Worker mới.
1. Thử `0006` + trigger trên một D1 remote **không phải production**; insert session cho user bị khoá phải lỗi `SQLITE_CONSTRAINT_TRIGGER`.
2. Trong `community-worker/`: `npm run db:migrate:remote`; xác nhận `npx wrangler d1 execute tqccl-community --remote --command "pragma table_info(\"user\")"` có `role`, `banned_until`, `deleting_at`, `last_seen_at`. Worker mới **không** deploy trước bước này (Better Auth kiểm schema lúc chạy, `@better-auth/core/dist/db/schema-check.mjs:8`).
3. `npx wrangler deploy` (Worker) → push `main` → deploy Pages.
4. Sau deploy: đăng nhập root, cấp KDV cho tài khoản thử, khoá/mở, `npx wrangler d1 execute tqccl-community --remote --command "select action,status from admin_audit order by created_at desc limit 10"`.
5. Rollback: `wrangler rollback` Worker; nếu đã có user bị khoá thì chạy `rollback/0007...` (Worker cũ không hiểu trigger, user bị khoá sẽ nhận 500 thay vì thông báo); cột mới để nguyên (Worker cũ bỏ qua, nội dung bị ẩn sẽ hiện lại).
