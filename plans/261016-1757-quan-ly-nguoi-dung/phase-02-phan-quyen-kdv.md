---
phase: 2
title: "Phân quyền root/KDV và che email"
status: completed
priority: P1
effort: "1d"
dependencies: [1]
---

# Phase 2 — Phân quyền root/KDV và che email

<!-- Updated: Red Team 2026-10-17 - chặn KDV tự duyệt, KDV chỉ xoá bình luận của user thường, emailMasked, giữ nguyên counts, liệt kê đủ consumer -->

## Mục tiêu
Một nguồn phân quyền (`root` từ `ADMIN_EMAILS`, `moderator` từ `user.role`) thay boolean `isAdmin`; gắn lại 22 endpoint admin và 4 điểm quyền ngoài `requireAdmin`; KDV không xoá bình luận của KDV/root; KDV nhận email đã che ở server.

## File
- Sửa: `community-worker/src/context.ts`, `community-worker/src/app.ts`
- Sửa: `community-worker/src/routes/{admin,ai,comments,feedback,posts,reports,scan}.ts`
- Sửa test: `community-worker/test/{fakes,admin,ai-admin,comments,feedback,posts,reports,scan}.test.ts`, `fakes.ts` (`ApiJson.isAdmin` → `role`, `fakes.ts:128`)
- Tạo: `community-worker/test/permissions.test.ts`

## Thiết kế
- `Viewer = { user: SessionUser; role: 'root' | 'moderator' | 'user' }`, `role = isAdminEmail(env, user.email) ? 'root' : user.role`. Giữ trường `user` (13 chỗ destructure hiện có không đổi: `comments.ts:60,86`, `recruit.ts:112,131`, `reports.ts:90,131,215`, `scan.ts:188`, `posts.ts:211,275`, `reports.ts:232`, `scan.ts:288,304`).
- `requireUser(c)` trả `Viewer`. Thêm `requireStaff(c)` (root | moderator, ngược lại 403 `forbidden`), `requireRoot(c)`. Xoá `requireAdmin` (7 import + 21 lời gọi) và `Viewer.isAdmin`.
- Ánh xạ endpoint:

| Quyền | Endpoint (dòng route) |
|---|---|
| `requireStaff` | `admin.ts:25` counts; `comments.ts:96`; `feedback.ts:151,192`; `reports.ts:220,243,245` (qua `review`); `scan.ts:148,234,271,287,303,318` |
| `requireRoot` | `ai.ts:166,172`; `posts.ts:204,210,228,249,271,272` (qua `setPublished`), `274` |

- Ngoài `requireAdmin` (dùng `isAdminEmail` trực tiếp, 4 chỗ):
  - `app.ts:63-70` `/api/me`: `{ id, name, email, image, role }` — bỏ `isAdmin`, không alias.
  - `comments.ts:54-56` `canDelete` và `comments.ts:85-93` xoá: chủ comment; root; KDV khi tác giả có `role = 'user'` và không thuộc `ADMIN_EMAILS` (đọc kèm `u.role, u.email` trong truy vấn sẵn có).
  - `reports.ts:197-201` ảnh chưa duyệt: staff hoặc chủ.
- ~~Chặn tự duyệt (KDV)~~ — bỏ theo Validation Session 2 (2026-10-17): KDV duyệt/từ chối được chiến báo và mẫu soi đội của chính mình; không còn mã `self_review`.
- `/api/admin/counts`: giữ nguyên hình dạng cho mọi staff (badge Bài viết bị ẩn với KDV ở UI).
- Che email `feedback.ts:181`: root nhận `email`; KDV nhận `maskEmail(email)` và `emailMasked: true`. UI dùng `emailMasked` để bỏ link `mailto:` (phase 5). Nội dung `body` không che (văn bản tự do) — ghi trong docs.

## TDD
### Trước (đỏ)
`test/permissions.test.ts` — bảng [method, path, body?] × {khách, user, moderator, root} → status mong đợi, đủ 22 endpoint trên; thêm:
- `/api/me` trả `role` đúng 3 giá trị, không có `isAdmin`.
- `canDelete`/xoá comment: KDV với comment của user thường → được; với comment của moderator khác hoặc root → `canDelete:false`, xoá 403.
- KDV xem ảnh chiến báo chưa duyệt của người khác → 200.
- KDV và root duyệt/từ chối chiến báo và mẫu soi đội của chính mình → 200 (Validation Session 2).
- `GET /api/admin/feedback`: KDV nhận email che + `emailMasked:true`; root nhận đầy đủ, không có `emailMasked`.
- Thu quyền moderator (SQL đổi `role`) → request kế tiếp 403 (harness đọc DB).

### Sau
Đổi `context.ts` và route; cập nhật test đang ghim `isAdmin` (`posts.test.ts:118,122,124`, `fakes.ts:128`) và email (`feedback.test.ts:243,246`) theo hợp đồng mới; không giữ song song.

## Kiểm tra
- `cd community-worker && npx tsc --noEmit && npx vitest run`
- Công cụ grep `requireAdmin|isAdmin` trong `community-worker/src` và `community-worker/test` → 0 kết quả.

## Rủi ro
Client và e2e còn đọc `isAdmin` đến phase 5 → không push `main` giữa chừng (Pages tự build từ `main` khi publish bài, `.github/workflows/pages-deploy.yml:7-10`).

## Bảo mật
Quyền xét ở server cho từng endpoint; vai trò đọc lại mỗi request nên thu hồi có hiệu lực ngay.
