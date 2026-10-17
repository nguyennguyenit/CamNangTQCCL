# Bằng chứng trước khi lập plan (advise + 2 vòng kiểm chứng, 2026-10-16/17)

Chỉ dùng dữ liệu giả; không chạm D1/R2 production; không sửa file dự án.

## Better Auth 1.7.6 (đúng bản cài, `community-worker/node_modules/better-auth/package.json:3`)

| Kiểm chứng | Cách | Kết quả |
|---|---|---|
| Hook `databaseHooks.session.create.before` ném `APIError('FORBIDDEN',{code,message})` | Luồng OAuth thật (`/sign-in/social` → `/callback/google`), Google giả lập token/profile, DB `node:sqlite` + toàn bộ migration | 302 → `errorCallbackURL?error=<code>&error_description=<message>`, 0 session |
| Hook trả `false` | như trên | 302 `error=unable_to_create_session`, mất lý do |
| Hook trả `null` | đọc `dist/db/with-hooks.mjs:18` | không chặn (chỉ `=== false` mới chặn) |
| Khoá giữa lúc đăng nhập (race) chỉ có hook + xoá session | memory adapter, dừng hook sau khi đọc, khoá + `deleteUserSessions`, thả | **1 session lọt** |
| Trigger `before insert on session ... raise(abort)` | luồng OAuth thật trên SQL | 0 session; callback trả **500** (lỗi SQL không phải APIError, `callback.mjs:191-194`) |
| Trigger trên D1 cục bộ | `wrangler d1 execute --local --persist-to <tmp>` | `SQLITE_CONSTRAINT_TRIGGER` — chạy được. **Chưa thử D1 remote** |
| Session cũ sau khi khoá (không xoá session, không guard) | `auth.api.getSession` | vẫn hợp lệ → cần guard mỗi request |
| `additionalFields` (`input:false`) trả trong `getSession` | đổi `banned_until` rồi gọi `getSession` | thấy giá trị mới ngay → guard không tốn truy vấn |
| `input:false` + `additionalData.role='moderator'` khi đăng ký | probe | không leo quyền, `role='user'` |
| Kiểu thời gian Better Auth trên SQLite/D1 | `typeof()` cột | `expiresAt/updatedAt/createdAt` là **text ISO**; adapter `supportsDates:false` (`kysely-adapter/dist/index.mjs:694`) |
| Better Auth trên D1 không dùng transaction | `kysely-adapter/dist/index.mjs:107` | `transaction = false` |
| Refresh session | `dist/context/create-context.mjs:147-148` | `updateAge` 24 giờ → `session.updatedAt` không dùng làm "lần hoạt động cuối" |
| Plugin `admin` | `plugins/admin/{admin,has-permission}.mjs` | hỗ trợ `roles`/`adminUserIds`; không dùng vì nguồn root là `ADMIN_EMAILS` và cần R2/audit/che email riêng |

## D1

- `DB.batch()` là SQL transaction, lỗi một lệnh thì rollback cả lô (developers.cloudflare.com/d1/worker-api/d1-database/).
- Không cấu hình read replication / Sessions API (`community-worker/wrangler.jsonc`).

## Schema hiện tại (migration thật, `PRAGMA foreign_keys=ON`, xoá user giả)

- `session`, `account`, `comments`, `uploads`, `battle_reports`, `scan_samples`, `recruit_records` cascade.
- `feedback.user_id` → NULL nhưng **`email`, `body` còn nguyên** (`0003_feedback.sql:8-11`).
- `posts.author_id`, `posts.author_name` **còn nguyên**, không FK (`0002_community.sql:65-66`).
- `battle_reports.reviewed_by` không FK (`0002_community.sql:43`); `scan_samples.reviewed_by` FK set null (`0005_scan.sql:26`).
- Thiếu index `user_id` trên `feedback`, `scan_samples`.
- Ảnh R2 không theo cascade; cron chỉ dọn `pending/` > 24 giờ (`src/cleanup.ts:8-24`).

## Bề mặt quyền hiện tại

- 22 handler `requireAdmin` trong 7 module: `admin.ts:25`; `ai.ts:166,172`; `comments.ts:96`; `feedback.ts:151,192`; `posts.ts:204,210,228,249,258(publish/unpublish),274`; `reports.ts:220,232(approve),245`; `scan.ts:148,234,271,287,303,318`.
- Ngoài `requireAdmin`: `/api/me` (`app.ts:63-70`), `canDelete` (`comments.ts:54-56`), xoá bình luận (`comments.ts:85-93`), ảnh chiến báo chưa duyệt (`reports.ts:197-201`).
- Client: `js/community-auth.js:62` (menu Quản trị), `js/community-admin.js:1806-1825` (cổng `isAdmin`), `js/community-api.js:191-205` (`signIn` chưa có `errorCallbackURL`).
- Email chéo user chỉ lộ ở `GET /api/admin/feedback` (`feedback.ts:174-190`).
- Ảnh chiến báo đã duyệt `Cache-Control: public, max-age=3600` (`reports.ts:207`).
- Thao tác ngoài D1: KV (`ai.ts:178`), GitHub dispatch (`posts.ts:245,253,267`), R2.
- Harness test giả lập auth (`test/fakes.ts:198-200`) → không chứng minh OAuth.
- File cộng đồng không thuộc `pipeline/site-localization-policy.json` `sourceFiles` → không cần làm mới hash localization.
