---
phase: 5
title: "Giao diện quản trị và thông báo bị khoá"
status: completed
priority: P1
effort: "2d"
dependencies: [4]
---

# Phase 5 — Giao diện quản trị và thông báo bị khoá

<!-- Updated: Red Team 2026-10-17 - thông báo khoá qua token + /api/ban-notice, bỏ mailto khi email che, paintIdentity, e2e kiểm errorCallbackURL -->
<!-- Updated: Validation Session 1 - không đăng nhập Google thật; smoke bằng wrangler pages dev + session seed -->

## Mục tiêu
`/quan-tri/` (vi + zh) theo vai trò: KDV chỉ thấy khu được phép; khu **Người dùng** (staff) và **Nhật ký** (root); hộp thoại khoá và xoá; người bị khoá thấy thông báo kèm lý do do server xác nhận.

## File
- Sửa: `js/community-api.js`, `js/community-auth.js`, `js/community-admin.js`, `src/components/community/AdminConsole.astro`, `css/styles.css`
- Tạo (nếu tách): `js/community-admin-users.js`
- Sửa: `tests-e2e/community.spec.mjs`

## Thiết kế

### Phiên và đăng nhập
- `js/community-api.js`: JSDoc `loadSession` (`:168`) đổi `{id,name,image,isAdmin}` → `{id,name,email,image,role}`. `signIn()` gửi thêm `errorCallbackURL` = URL hiện tại đã bỏ `error`, `error_description`.
- `js/community-auth.js:62`: link Quản trị khi `role !== 'user'`.
- Trang nạp có `?error=ACCOUNT_BANNED|ACCOUNT_UNAVAILABLE`: gọi `GET /api/ban-notice?token=<error_description>`.
  - 200 → thông báo `role="alert"` cạnh nút đăng nhập: "Tài khoản đã bị khoá đến {ngày}" / "vĩnh viễn" + "Lý do: {reason}" (gắn bằng `textContent`); `deleting` → "Tài khoản đang được xoá".
  - Khác 200 → câu cố định "Không đăng nhập được. Thử lại sau." (không hiển thị chữ nào từ URL).
  - Sau đó `history.replaceState` bỏ `error`, `error_description`.
  - Mã `error` khác (lỗi OAuth khác) giữ hành vi hiện tại.

### Khung quản trị (`js/community-admin.js`)
- Cổng `initCommunityAdmin` (`:1806-1825`): cho vào khi `role` là `root` hoặc `moderator`.
- `paintIdentity` (`:1793-1804`): "Quản trị viên" (root) / "Kiểm duyệt viên" (moderator), vi + zh.
- Định nghĩa khu (`:1829+`) thêm `roles`: `posts`, `ai`, `audit` → `['root']`; `reports`, `comments`, `feedback`, `scan`, `users` → `['root','moderator']`. `adminShell` chỉ dựng khu hợp vai trò; hash tới khu không được phép → khu đầu tiên.
- `feedbackItem` (`:527-575`): `entry.emailMasked` → hiển thị chữ, không tạo `mailto:` (`:532-533`).
- Khu **Người dùng** (hash `nguoi-dung`), dùng `pagedList`, `formField`, `selectInput`, `textInput`, `adminStatus`, `button` sẵn có:
  - Lọc: ô tìm (debounce 300 ms; gợi ý cho KDV: "Tìm theo tên hoặc email đầy đủ"), Vai trò, Trạng thái.
  - Dòng: ảnh, tên, email, "Đăng ký {ngày}", "Hoạt động {tương đối}" / "Chưa ghi nhận", badge vai trò, "Khoá đến …"/"Khoá vĩnh viễn"/"Đang xoá", số BL/CB/GY/Soi.
  - Bấm dòng → chi tiết (kiểu `adm-posts-view`): nội dung gần đây (link trang), nhật ký về user.
  - Hành động theo vai trò/đích: **Khoá** (dialog: 1/7/30 ngày/vĩnh viễn + lý do bắt buộc ≤ 500), **Mở khoá**, **Cấp/Thu KDV** (root), **Xoá…** (root; ẩn khi đang bị khoá, kèm gợi ý "Mở khoá trước"; dialog nút xoá vô hiệu đến khi gõ đúng email; `delete_incomplete` → "Thử xoá tiếp"). Ẩn nút với đích không thao tác được; lỗi 403/409 từ server dịch theo `code`.
- Khu **Nhật ký** (hash `nhat-ky`, root): lọc hành động; dòng: thời điểm, người làm, hành động (nhãn vi/zh theo mã), đối tượng, lý do, badge `ok/partial/failed`; `meta.deploy:'pending'` → "chưa rõ kết quả deploy".
- `AdminConsole.astro:18`: câu giới thiệu thêm Người dùng/Nhật ký (vi + zh).
- `css/styles.css`: chỉ thêm lớp cần thiết, dùng token và lớp `adm-*`/`cm-*` có sẵn theo `docs/design-guidelines.md`.
- `community-admin.js` đã 1896 dòng: tách Người dùng + Nhật ký sang `js/community-admin-users.js`, import helper từ `community-admin.js` (export helper cần dùng; không chép).

## Test e2e (`tests-e2e/community.spec.mjs`, mock `/api/*` như hiện có)
- Mock `PLAYER`/`ADMIN` (`:6-7`) sang `role`; thêm `MODERATOR`.
- KDV: điều hướng không có "Bài viết", "AI", "Nhật ký"; `/quan-tri/#ai` về khu đầu; thẻ danh tính "Kiểm duyệt viên"; góp ý có `emailMasked` không có link `mailto:`.
- Root: khu Người dùng hiển thị dòng mock; dialog khoá chặn gửi khi thiếu lý do; body gửi `{duration, reason}`; dialog xoá vô hiệu nút đến khi gõ đúng email, body `{confirmEmail}`; user đang khoá không có nút Xoá.
- Nhật ký hiển thị badge trạng thái.
- Bấm đăng nhập: request `sign-in/social` có `errorCallbackURL` không chứa `error=`.
- `?error=ACCOUNT_BANNED&error_description=tok` + mock `/api/ban-notice` 200 → thông báo có lý do; mock 404 → câu cố định, không có chữ từ URL; URL sạch tham số.
- `/zh/quan-tri/` hiện nhãn Trung cho khu Người dùng.
- Khung 390 px không tràn ngang (theo `:290-301`).

## Kiểm tra
- `npm run build && npx playwright test tests-e2e/community.spec.mjs`
- Smoke thật không cần Google (Validation Session 1): `community-worker/.dev.vars` tạm với `BETTER_AUTH_SECRET` ngẫu nhiên + `ADMIN_EMAILS`; `npm run db:migrate:local` (trong `community-worker/`); script throwaway (ngoài repo, `/tmp`) tạo user root + user thử và session trong DB local qua `internalAdapter.createSession` của Better Auth, in cookie phiên đã ký; `npm run build` ở root; `npx wrangler dev` (community-worker) + `npx wrangler pages dev dist --service COMMUNITY=tqccl-community`; mở `/quan-tri/` bằng `browser` với cookie đó: khoá user thử, xem badge, nhật ký; mở trang công khai xem comment ẩn; chụp khu Người dùng vi/zh. Xoá `.dev.vars` tạm và script sau khi xong.

## Rủi ro
Đăng nhập Google thật không được thử trên máy (đã chấp nhận); OAuth được phủ bởi `test/auth-ban.test.ts` với Better Auth thật.


## Ghi chú hoàn thành
Smoke thật do orchestrator chạy (`wrangler pages dev` + session seed; ảnh chụp ở `reports/smoke/`): 3 lỗi smoke đã sửa (chữ `null` ở chi tiết, lệch hàng lọc, loại đối tượng nhật ký chưa dịch) cùng 2 lỗi race (phản hồi muộn ghi đè chi tiết, nút xoá bật lại khi DELETE đang chạy). Đăng nhập Google thật không được thử.
