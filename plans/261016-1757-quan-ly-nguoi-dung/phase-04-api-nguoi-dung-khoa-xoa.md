---
phase: 4
title: "API người dùng: danh sách, khoá, quyền, xoá; ẩn nội dung"
status: completed
priority: P1
effort: "1.5d"
dependencies: [3]
---

# Phase 4 — API người dùng và ẩn nội dung

<!-- Updated: Red Team 2026-10-17 - lọc ở route công khai, KDV không dò email, ràng buộc đích trong SQL + banned_by_role, cursor ISO, giữ ảnh bài viết, bỏ xoá rate_limits -->
<!-- Updated: Validation Session 1 - chặn xoá khi đang khoá (409 user_banned); xoá cựu admin: posts.author_id = null, giữ author_name -->

## Mục tiêu
Root/KDV xem danh sách và chi tiết user; khoá/mở; root cấp/thu KDV và xoá tài khoản theo quy trình có trạng thái, thử lại được. Nội dung công khai của user bị chặn biến mất khỏi API và hiện lại khi hết khoá.

## File
- Tạo: `community-worker/src/routes/users.ts`, `community-worker/test/users.test.ts`, `community-worker/test/visibility.test.ts`
- Sửa: `community-worker/src/app.ts`, `community-worker/src/routes/{comments,reports}.ts`

## Thiết kế

### Ẩn nội dung (dùng `visibleUserSql('u')`, bind `deps.now()`)
Chỉ ở route công khai, **không** sửa trong `listReports` dùng chung (`reports.ts:66-79` còn phục vụ `/api/me/reports` và `/api/admin/reports`):
- `GET /api/comments` (`comments.ts:40-57`): thêm điều kiện vào `where`.
- `GET /api/reports` (`reports.ts:172-177`): truyền thêm điều kiện ở lời gọi `listReports` tại `:175`.
- `GET /api/reports/stats` (`reports.ts:179-188`): `join "user" u on u.id = r.user_id` + điều kiện.
- `GET /api/reports/:id/image` (`reports.ts:190-212`): ảnh đã duyệt của user bị chặn → 404 trừ staff/chủ. `Cache-Control` ảnh đã duyệt đổi `public, max-age=3600` → `public, no-cache`; `If-None-Match` khớp `httpEtag` → 304.
- `/api/admin/comments`, `/api/admin/reports` không lọc (staff vẫn thấy và xử lý).
- Hết khoá theo thời gian → hiện lại, không cần cron.

### Endpoint (`routes/users.ts`)
| Endpoint | Quyền | Hành vi |
|---|---|---|
| `GET /api/admin/users?q=&role=user\|moderator\|root&status=active\|banned\|deleting&cursor=` | staff | Mới đăng ký trước. Cursor dùng `decodeCursor` sẵn có với `t = Date.parse("createdAt")`; điều kiện `("createdAt" < ? or ("createdAt" = ? and id < ?))` bind `new Date(t).toISOString()` (TEXT). `q`: root → `name like ? or email like ?` (escape `%`/`_`); KDV → `name like ?` **hoặc** `lower(email) = lower(?)` (chỉ khớp nguyên địa chỉ). `role=root` lọc `lower(email) in (adminEmails)`. Dòng: `{id,name,email,emailMasked?,image,createdAt,lastSeenAt,role,ban:{until,reason,byRole}\|null,deleting,counts:{comments,reports,feedback,scanSamples}}` — đếm bằng subquery theo index `user_id`. |
| `GET /api/admin/users/:id` | staff | User + 10 comment, 10 chiến báo mới nhất (mọi trạng thái), số góp ý/mẫu soi đội, 20 dòng `admin_audit` `where subject_user_id = ?`. Email che với KDV. |
| `POST /api/admin/users/:id/ban` `{duration:'1d'\|'7d'\|'30d'\|'permanent', reason}` | staff | `reason` 1–500. Tự khoá mình → 400 `invalid_target`; đích là root → 403. Batch: `update "user" set banned_until=?, ban_reason=?, banned_by=?, banned_by_role=? where id=? and deleting_at is null` **+ khi actor là KDV:** `and role = 'user' and lower(email) not in (adminEmails) and (banned_by_role is null or banned_by_role = 'moderator' or banned_until <= now)`; audit `user.ban` qua `auditIfStmt` (exists `banned_by = actor and ban_reason = ? and banned_until = ?`); `delete from session where "userId" = ? and exists(<user vừa bị khoá>)`. Không có dòng audit sau batch → 403 `forbidden` (hoặc 409 nếu đang xoá). |
| `POST /api/admin/users/:id/unban` | staff | Đặt null 4 cột ban; KDV chỉ khi đích là user thường và `banned_by_role = 'moderator'` (ràng buộc trong `WHERE`); audit `user.unban`. |
| `POST /api/admin/users/:id/role` `{role:'user'\|'moderator'}` | root | Đích không phải root, không đang xoá; audit `user.role` meta `{from,to}`. |
| `DELETE /api/admin/users/:id` `{confirmEmail}` | root | Quy trình dưới. |

### Quy trình xoá (thử lại an toàn)
1. Kiểm: `confirmEmail` khớp (không phân biệt hoa thường) → nếu không 400 `confirm_mismatch`; đích không phải root, không phải chính mình; đích đang bị khoá còn hạn → 409 `user_banned` (phải mở khoá trước; spammer để khoá vĩnh viễn).
2. Batch: `update "user" set deleting_at = coalesce(deleting_at, ?)`, `delete from session where "userId" = ?`, audit `user.delete.start` (`ok`). Từ đây user bị chặn ở guard; trigger chặn thêm ảnh/bản ghi R2 mới.
3. Kiểm kê khoá R2 của user: `uploads.object_key where kind = 'report'`, `battle_reports.image_key`, `scan_samples.image_key` (không null). **Không** lấy `uploads.kind = 'post'` (ảnh bài viết đang dùng trên blog). `MEDIA.delete` theo lô ≤ 1000. Lỗi → audit `user.delete` `failed` meta `{step:'r2'}` → 502 `delete_incomplete`; user giữ trạng thái đang xoá.
4. Batch: `update uploads set user_id = <root đang thao tác> where user_id = ? and kind = 'post'`; `update posts set author_id = null where author_id = ?` (giữ `author_name`); `update feedback set email = null, user_id = null where user_id = ?`; `update battle_reports set reviewed_by = null where reviewed_by = ?`; `delete from "user" where id = ?` (cascade phần còn lại); audit `user.delete` `ok` meta số dòng/ảnh đã xoá, `target_label` = email đã che.
5. Gọi lại khi đang xoá → bỏ qua phần đã làm của bước 2, chạy tiếp 3–4.

`body` góp ý giữ nguyên (yêu cầu "góp ý giữ lại ẩn danh"); docs ghi rõ văn bản tự do có thể chứa thông tin cá nhân.

## TDD
### Trước (đỏ)
- `test/visibility.test.ts`: user có comment + chiến báo đã duyệt có ảnh → khoá 7 ngày qua API → `/api/comments`, `/api/reports`, `/api/reports/stats`, ảnh (khách) không còn; `/api/admin/reports` và `/api/admin/comments` vẫn có; staff vẫn xem ảnh; tăng `h.clock.now` quá hạn → hiện lại; `If-None-Match` khớp → 304; header `no-cache`.
- `test/users.test.ts`:
  - Danh sách: seed ≥ 21 user (có 2 user cùng `createdAt`) → trang 2 đúng, không trùng/không sót; `q` chứa `%` không khớp tất cả; lọc role/status; KDV: email che + `emailMasked`, `q=<tiền tố email>` không trả user đó, `q=<email đầy đủ>` trả đúng; root thấy đầy đủ; counts đúng.
  - Khoá: session của đích bị xoá, request kế tiếp của đích 401 (harness đọc DB); ca 400/403/409; KDV khoá moderator → 403, 0 dòng audit; KDV mở/rút ngắn khoá do root đặt → 403; root đổi role đích thành moderator đúng lúc KDV khoá → khoá không áp (điều kiện SQL).
  - Quyền: root cấp moderator → request kế tiếp của đích vào `/api/admin/reports`; thu hồi → 403.
  - Xoá: email sai → 400; đích đang bị khoá → 409 `user_banned`; xoá thành công → không còn dòng ở `comments`, `battle_reports`, `uploads(kind='report')`, `scan_samples`, `recruit_records`, `session`, `account`; object R2 của báo cáo/soi đội biến mất; object `posts/*` user từng tải vẫn còn và dòng `uploads` chuyển sang root; `posts.author_id` null, `author_name` giữ; `feedback.user_id`, `email` null, `body` còn; audit `start` + `ok`, không chứa email đầy đủ; `h.r2Error` lần 1 → 502, user còn với `deleting_at`, audit `failed`; lần 2 → hoàn tất.

### Sau
Cài route và điều kiện ẩn; `npx vitest run` xanh.

## Kiểm tra
`cd community-worker && npx tsc --noEmit && npx vitest run`

## Rủi ro
- Không thu hồi được ảnh trình duyệt đã tải; chỉ chặn request mới.
- `name like` quét bảng `user`: chấp nhận ở quy mô vài nghìn user.

## Bảo mật
Mọi ràng buộc đích nằm trong câu `UPDATE` (không có khe giữa đọc và ghi); KDV không dò được email; `confirmEmail` chống bấm nhầm.
