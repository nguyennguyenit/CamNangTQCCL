-- Quản trị người dùng: vai trò, khoá, đang xoá, lần hoạt động cuối, nhật ký quản trị.
-- Cột Better Auth ("createdAt"...) là chuỗi ISO; cột ứng dụng mới dưới đây là epoch ms (integer).

alter table "user" add column role text not null default 'user' check (role in ('user', 'moderator'));
alter table "user" add column banned_until integer;
alter table "user" add column ban_reason text;
alter table "user" add column banned_by text;
alter table "user" add column banned_by_role text check (banned_by_role in ('root', 'moderator'));
alter table "user" add column deleting_at integer;
alter table "user" add column last_seen_at integer;

create table admin_audit (
  id text not null primary key,
  actor_id text not null,
  actor_role text not null check (actor_role in ('root', 'moderator')),
  actor_label text not null,
  action text not null,
  target_type text not null,
  target_id text,
  target_label text,
  subject_user_id text,
  reason text,
  meta text,
  status text not null check (status in ('ok', 'partial', 'failed')),
  created_at integer not null
);

create index admin_audit_created_idx on admin_audit (created_at desc, id desc);
create index admin_audit_subject_idx on admin_audit (subject_user_id, created_at desc);
create index feedback_user_idx on feedback (user_id);
create index scan_samples_user_idx on scan_samples (user_id);
create index uploads_user_idx on uploads (user_id);
create index user_created_idx on "user" ("createdAt" desc, id desc);

-- Chặn ghi cho tài khoản bị khoá/đang xoá theo đồng hồ DB (epoch ms). Chỉ các bảng giữ khoá R2 và session.
create trigger session_block_blocked_user before insert on session
begin
  select raise(abort, 'account_blocked') where exists (
    select 1 from "user" where id = NEW."userId"
      and ((banned_until is not null and banned_until > cast(unixepoch('subsec') * 1000 as integer)) or deleting_at is not null)
  );
end;

create trigger uploads_block_blocked_user before insert on uploads
begin
  select raise(abort, 'account_blocked') where exists (
    select 1 from "user" where id = NEW.user_id
      and ((banned_until is not null and banned_until > cast(unixepoch('subsec') * 1000 as integer)) or deleting_at is not null)
  );
end;

create trigger battle_reports_block_blocked_user before insert on battle_reports
begin
  select raise(abort, 'account_blocked') where exists (
    select 1 from "user" where id = NEW.user_id
      and ((banned_until is not null and banned_until > cast(unixepoch('subsec') * 1000 as integer)) or deleting_at is not null)
  );
end;

create trigger scan_samples_block_blocked_user before insert on scan_samples
begin
  select raise(abort, 'account_blocked') where exists (
    select 1 from "user" where id = NEW.user_id
      and ((banned_until is not null and banned_until > cast(unixepoch('subsec') * 1000 as integer)) or deleting_at is not null)
  );
end;
