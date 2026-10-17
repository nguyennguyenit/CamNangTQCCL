# Phase 6 — Kết quả docs và kiểm tra

Ngày: 2026-10-17. Worktree `CamNangTQCCL-quan-ly-nguoi-dung` (chưa commit, không `--remote`).

## Docs đã đổi
- `docs/community-worker.md`: dòng cấu hình `ADMIN_EMAILS` (root); API AI (chỉ root); góp ý (staff, email che + `emailMasked`, `body` không che); Soi đội (staff, KDV duyệt được cả mẫu của mình); ảnh chiến báo (`public, no-cache` + ETag/304, ẩn khi user bị chặn); `counts` (staff); mã lỗi mới; mục Kiểm tra (bộ test mới, `auth-ban.test.ts` Better Auth thật trên fake D1, giới hạn: Google giả lập, smoke bằng session seed, chưa đăng nhập Google thật, lệnh kiểm tra đầy đủ); mục mới **Vai trò và người dùng** (hai cấp quyền + ma trận, danh sách/chi tiết, khoá, guard + 4 trigger theo đồng hồ DB so với guard `deps.now()`, race đăng nhập 500 một lần, token + `GET /api/ban-notice`, ẩn nội dung, xoá tài khoản + giới hạn độ bền, nhật ký + quy tắc `ok/partial/failed`, `last_seen_at`, triển khai + rollback khớp phiên bản).
- `docs/system-architecture.md:139`: tối đa tám khu, root thấy cả tám, KDV năm khu, Người dùng/Nhật ký.
- `docs/project-changelog.md`: mục mới đầu file (2026-10-17).
- Tạo `community-worker/rollback/0007_drop_user_block_triggers.sql` (4 `drop trigger if exists`: `session_block_blocked_user`, `uploads_block_blocked_user`, `battle_reports_block_blocked_user`, `scan_samples_block_blocked_user`).

## Grep ranh giới
`grep -rnE "\bisAdmin\b|\brequireAdmin\b" community-worker/src community-worker/test js tests-e2e docs` → chỉ còn `docs/project-changelog.md` (dòng 7, 17 mô tả thay đổi; dòng 356 lịch sử cũ).

## Kết quả lệnh
| Lệnh | Kết quả |
|---|---|
| `cd community-worker && npx tsc --noEmit && npx vitest run` | xanh: 16 file, 384 test (log `ERR_SQLITE_ERROR` trên stderr là đường lỗi có chủ đích của test posts) |
| `npm run test:node` | lần đầu trong chuỗi chạy nền: 1 fail `astro-dist-contract` "Emitted artifact bytes differ from source: js/community-admin-users.js" do chạy **trước** `npm run build` nên đọc `dist/` cũ; chạy lại sau build: **595/595 pass** |
| `npm run build` | xanh (4917 trang) |
| `npm run verify` | xanh ("Verified 5157 dist files") |
| `npm run test:dist` | xanh: 49/49 |
| `npm run test:e2e` | xanh: 512 passed (2,9 phút) |

Ghi chú thứ tự: `test:node` có bài đọc `dist/`, nên chạy sau `build`.

## D1 cục bộ (engine D1 thật của wrangler, `--persist-to` thư mục tạm, đã xoá)
- `wrangler d1 migrations apply tqccl-community --local --persist-to <tmp>`: `0001`–`0006` đều ✅.
- Chèn user có `banned_until = 9000000000000000` rồi chèn `session` cho user đó → lỗi `account_blocked: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_TRIGGER)`.
- `wrangler d1 execute --local --persist-to <tmp> --file rollback/0007_drop_user_block_triggers.sql` → thành công; chèn lại cùng `session` → thành công (`count(session) = 1`).
- Thư mục tạm đã xoá.

## Ảnh smoke (orchestrator, `wrangler dev` + `wrangler pages dev`, session seed)
[vi-users](./smoke/vi-users.png) · [vi-after-ban](./smoke/vi-after-ban.png) · [vi-audit](./smoke/vi-audit.png) · [vi-mod-users](./smoke/vi-mod-users.png) · [zh-users](./smoke/zh-users.png) · [vi-public-comments](./smoke/vi-public-comments.png) · [vi-ban-notice](./smoke/vi-ban-notice.png)

Giới hạn trung thực: Google OAuth được giả lập trong test; chưa đăng nhập Google thật.

## Việc khi được phép deploy (không làm trong plan này)
Luật cứng: **không push `main` trước khi Worker mới đã chạy** (Pages build từ `main` mỗi lần `pages-deploy.yml` chạy; client mới cần `role`).
1. Thử `0006` + trigger trên D1 remote **không phải production**; insert session cho user bị khoá phải lỗi `SQLITE_CONSTRAINT_TRIGGER`.
2. Trong `community-worker/`: `npm run db:migrate:remote`; xác nhận `npx wrangler d1 execute tqccl-community --remote --command "pragma table_info(\"user\")"` có `role`, `banned_until`, `deleting_at`, `last_seen_at`. Không deploy Worker trước bước này (Better Auth kiểm schema lúc chạy).
3. `npx wrangler deploy` (Worker) → push `main` → deploy Pages. Thứ tự: migration → Worker → Pages.
4. Sau deploy: đăng nhập root, cấp KDV cho tài khoản thử, khoá/mở, `npx wrangler d1 execute tqccl-community --remote --command "select action,status from admin_audit order by created_at desc limit 10"`.
5. Rollback (khớp phiên bản Pages + Worker, vì client mới cần `role`, client cũ cần cờ boolean quản trị cũ): (a) revert commit trên `main` hoặc không publish/chạy workflow trước, để Pages không tự dựng lại client mới; (b) `wrangler rollback` Worker + rollback deployment Pages cùng lượt; (c) cột mới và `admin_audit` để nguyên; (d) chạy `wrangler d1 execute tqccl-community --remote --file rollback/0007_drop_user_block_triggers.sql` từ `community-worker/` (Worker cũ không hiểu trigger: user bị khoá nhận 500 thay vì thông báo). Hệ quả: mất cưỡng chế khoá và ẩn nội dung; muốn bật lại phải deploy Worker mới và tạo lại 4 trigger theo `0006`.
