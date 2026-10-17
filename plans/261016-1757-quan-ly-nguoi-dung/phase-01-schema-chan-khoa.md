---
phase: 1
title: "Schema và chặn tài khoản bị khoá"
status: completed
priority: P1
effort: "1d"
dependencies: []
---

# Phase 1 — Schema và chặn tài khoản bị khoá

<!-- Updated: Red Team 2026-10-17 - guard chuyển vào currentUser + toSessionUser, harness đọc DB, bỏ wrapper callback, bỏ cron session, trigger chỉ 4 bảng, token thông báo khoá, đồng hồ test, dialect D1 -->

## Mục tiêu
Có cột vai trò/khoá/xoá trên `user`, bảng `admin_audit`, các index còn thiếu, trigger chặn ghi; tài khoản bị khoá hoặc đang xoá không tạo được session, không dùng được session cũ — kể cả khi khoá chen giữa lúc đăng nhập. Harness test chạy đúng guard thật.

## Bằng chứng
[reports/xac-minh-truoc-plan.md](./reports/xac-minh-truoc-plan.md).

## File
- Tạo: `community-worker/migrations/0006_user_admin.sql`
- Tạo: `community-worker/src/moderation.ts`
- Tạo: `community-worker/test/auth-ban.test.ts`, `community-worker/test/moderation.test.ts`
- Sửa: `community-worker/src/auth.ts`, `community-worker/src/context.ts`, `community-worker/src/app.ts`, `community-worker/src/routes/reports.ts` (dọn ảnh khi batch lỗi)
- Sửa: `community-worker/test/fakes.ts` (getUser đọc DB, seed session + ISO đầy đủ, `meta.changes`/`last_row_id` cho `all()`, nút lỗi `r2Error`/`kvError`)

## Thiết kế

### Migration `0006_user_admin.sql`
```sql
alter table "user" add column role text not null default 'user' check (role in ('user', 'moderator'));
alter table "user" add column banned_until integer;   -- epoch ms; null = không khoá; vĩnh viễn = PERMANENT_BAN_UNTIL
alter table "user" add column ban_reason text;
alter table "user" add column banned_by text;          -- id người khoá, không FK
alter table "user" add column banned_by_role text check (banned_by_role in ('root', 'moderator'));
alter table "user" add column deleting_at integer;     -- khác null = đang xoá: chặn như khoá
alter table "user" add column last_seen_at integer;

create table admin_audit (
  id text not null primary key,
  actor_id text not null,
  actor_role text not null check (actor_role in ('root', 'moderator')),
  actor_label text not null,          -- tên + email đã che
  action text not null,
  target_type text not null,          -- 'report' | 'comment' | 'feedback' | 'scan_sample' | 'post' | 'ai_config' | 'user'
  target_id text,
  target_label text,                  -- không chứa email đầy đủ
  subject_user_id text,               -- user sở hữu đối tượng (hoặc chính user đích); null với post/ai_config
  reason text,
  meta text,                          -- JSON nhỏ, không secret
  status text not null check (status in ('ok', 'partial', 'failed')),
  created_at integer not null
);
create index admin_audit_created_idx on admin_audit (created_at desc, id desc);
create index admin_audit_subject_idx on admin_audit (subject_user_id, created_at desc);
create index feedback_user_idx on feedback (user_id);
create index scan_samples_user_idx on scan_samples (user_id);
create index uploads_user_idx on uploads (user_id);
create index user_created_idx on "user" ("createdAt" desc, id desc);
```
Điều kiện "bị chặn" dùng chung, viết trong trigger theo đồng hồ DB (`cast(unixepoch('subsec') * 1000 as integer)` = epoch ms):
`(banned_until is not null and banned_until > now) or deleting_at is not null`.

Trigger `before insert` (tên `<bảng>_block_blocked_user`) **chỉ** trên:
- `session` (`NEW."userId"`) — đóng race đăng nhập.
- `uploads`, `battle_reports`, `scan_samples` (`NEW.user_id`) — bảng giữ khoá R2; tránh ảnh mới sau khi kiểm kê lúc xoá.

Không trigger trên `comments`, `feedback`, `recruit_records`: nội dung bị khoá đã bị lọc lúc đọc (phase 4), xoá thì cascade. Trigger chạy theo đồng hồ DB; guard và lọc chạy theo `deps.now()` — ghi trong docs phase 6.

### `src/moderation.ts`
- `PERMANENT_BAN_UNTIL = 8_640_000_000_000_000`.
- `BAN_DURATIONS = { '1d': 86_400_000, '7d': 604_800_000, '30d': 2_592_000_000, permanent: null }`.
- `isBlocked({ bannedUntil, deletingAt }, now)`.
- `maskEmail(email)` → 2 ký tự đầu phần local + `***@` + domain (local ≤ 2 ký tự: 1 ký tự + `***`).
- `visibleUserSql(alias)` → đoạn `(${a}.banned_until is null or ${a}.banned_until <= ?) and ${a}.deleting_at is null`, bind `now` (dùng phase 4).
- `signBanNotice(secret, { userId, exp })` / `verifyBanNotice(secret, token, now)`: HMAC-SHA-256 (Web Crypto), token base64url `userId.exp.sig`, hạn 10 phút.

### Better Auth (`src/auth.ts`)
- `user.additionalFields`: `role` (string, default `'user'`), `banned_until`, `ban_reason`, `deleting_at`, `last_seen_at` (number, `required:false`) — tất cả `input:false`; tên = tên cột.
- `databaseHooks.session.create.before(session)`: đọc trực tiếp `env.DB.prepare('select banned_until, deleting_at from "user" where id = ?')` (không phụ thuộc `ctx` có hay không). Bị chặn → ném `APIError('FORBIDDEN', { code: deleting ? 'ACCOUNT_UNAVAILABLE' : 'ACCOUNT_BANNED', message: signBanNotice(env.BETTER_AUTH_SECRET, { userId, exp: Date.now() + 600_000 }) })`. Không trả `false`/`null`. `error_description` chỉ chứa token, không chứa lý do.
- `getSessionUser(env, headers)` trả **dòng thô** `SessionUserRow` (id, name, email, image, role, banned_until, deleting_at, last_seen_at) hoặc `null`; không quyết định khoá ở đây.
- Export hàm thuần `toSessionUser(row, now): SessionUser | null` — map tên trường, trả `null` khi `isBlocked`. Đây là chỗ duy nhất quyết định.

### Guard (`src/context.ts`)
- `AppDeps.getUser(env, headers)` trả `SessionUserRow | null`.
- `currentUser(c)`: `toSessionUser(await deps.getUser(...), deps.now())`; nếu `last_seen_at` null hoặc cũ hơn 10 phút → `c.executionCtx.waitUntil(update "user" set last_seen_at = ? where id = ?)`, lỗi chỉ `console.error`.

### Endpoint thông báo khoá
`GET /api/ban-notice?token=` (công khai, `no-store`): `verifyBanNotice` hợp lệ → `{ until: ISO | null, reason, deleting: boolean }` đọc từ DB; token sai/hết hạn hoặc user không còn bị chặn → 404 `not_found`.

### Race ở callback OAuth
Không bọc callback. Khi trigger chặn trong khe race, callback trả 500 (lỗi SQL không phải `APIError`); lần đăng nhập kế tiếp hook trả `ACCOUNT_BANNED` kèm token. Ghi trong docs.

### Dọn ảnh chiến báo khi batch lỗi (`src/routes/reports.ts:157-167`)
Bọc `DB.batch` của `POST /api/reports` bằng `try/catch` xoá `imageKey` rồi ném lại — theo mẫu `scan.ts:227-229`. Cần vì trigger trên `battle_reports` có thể huỷ batch sau khi ảnh đã ghi.

### Harness (`test/fakes.ts`)
- Seed `user` với `createdAt/updatedAt` ISO đầy đủ, mỗi user một dòng `session` (token = key của `USERS`); thêm `USERS.moderator` (role `moderator`).
- `getUser`: lấy token từ header `x-test-user`, `select u.* from session s join "user" u on u.id = s."userId" where s.token = ?` → dòng thô. Như vậy khoá (xoá session), cấp/thu quyền có hiệu lực ở request kế tiếp và đi qua `toSessionUser` thật.
- `request(... as)` nhận `string` (user tạo trong test có thể đăng nhập sau khi seed session).
- `FakeStatement.all()` trả `meta: { changes, last_row_id }` để dialect D1 của Better Auth chạy được trên fake D1.
- `h.r2Error`, `h.kvError` (mẫu `mailError`): fake R2 `put/delete` và KV `put` ném khi được đặt.

## TDD
### Trước (đỏ)
1. `test/auth-ban.test.ts` — Better Auth thật trên **`createFakeD1().d1`** (đi đúng nhánh dialect D1 `transaction=false`, `kysely-adapter/dist/index.mjs:103-107`), Google giả lập bằng cách thay `validateAuthorizationCode`/`getUserInfo` của provider trên **cùng một** instance dùng cho cả `/sign-in/social` và `/callback/google` (cookie state + bản ghi verification phải từ cùng instance). Ca:
   - user thường → 302 `callbackURL`, 1 session, `role === 'user'`.
   - user bị khoá → 302 `errorCallbackURL?error=ACCOUNT_BANNED&error_description=<token>`; token không chứa lý do; `GET /api/ban-notice?token=` (qua `createApp`) trả lý do và hạn.
   - race (khoá ngay trước insert session) → 0 session.
   - `deleting_at` → `ACCOUNT_UNAVAILABLE`.
   - đăng ký kèm `additionalData: { role: 'moderator' }` → `role` vẫn `'user'`.
   - token sửa 1 ký tự / quá hạn → 404.
   - Mọi giá trị `banned_until` dùng để thử trigger tính theo **`Date.now()` thật** (`+60_000` còn hiệu lực, `-1_000` đã hết), không theo `h.clock`.
2. `test/moderation.test.ts`: `maskEmail` biên, `isBlocked` đúng mốc, `toSessionUser` (null khi khoá/đang xoá, map role), trigger `uploads`/`battle_reports`/`scan_samples` chặn user bị khoá (mốc theo giờ thật), không chặn user thường.
3. Ca route (dùng harness mới): user có session bị khoá qua SQL → request kế tiếp 401; hết hạn theo `h.clock` → 200.
4. `reports.test.ts`: chèn lỗi batch (user bị khoá theo giờ thật giữa analyze và submit) → 500 và không còn object `reports/*`.

### Sau
Cài migration, `moderation.ts`, hook, `getSessionUser`/`toSessionUser`, guard, endpoint thông báo, try/catch report, harness → xanh; `npx vitest run` toàn bộ xanh.

## Kiểm tra
- `cd community-worker && npx tsc --noEmit && npx vitest run`
- `cd community-worker && P=$(mktemp -d) && npx wrangler d1 migrations apply tqccl-community --local --persist-to "$P" && npx wrangler d1 execute tqccl-community --local --persist-to "$P" --command "insert into \"user\" (id,name,email,emailVerified,createdAt,updatedAt,banned_until) values ('t','t','t@example.invalid',1,'2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z',8640000000000000); insert into session (id,expiresAt,token,createdAt,updatedAt,userId) values ('s','2099-01-01T00:00:00.000Z','tok','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z','t')"; rm -rf "$P"` → báo `account_blocked`.

## Rủi ro
- Better Auth kiểm schema lúc chạy (`@better-auth/core/dist/db/schema-check.mjs:8`): Worker có `additionalFields` mới chạy trên DB chưa có `0006` sẽ lỗi mọi lệnh auth → thứ tự deploy ở phase 6.
- Trigger chưa thử trên D1 remote → điều kiện dừng ở plan.
- Race đăng nhập trả 500 một lần (chấp nhận, đã ghi).

## Bảo mật
Trường mới `input:false`. Lý do khoá không nằm trong URL; chỉ token HMAC 10 phút, endpoint không lộ gì khi token sai.
