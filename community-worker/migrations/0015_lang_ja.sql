-- Bản tiếng Nhật: mở CHECK lang/text_lang từ ('vi', 'zh') sang ('vi', 'zh', 'ja') ở 6 bảng
-- comments, battle_reports, posts (0002), feedback (0003), scan_samples (0005), community_teams (0008).
-- SQLite không sửa được CHECK tại chỗ -> dựng lại bảng: tạo *_new, chép dữ liệu, xoá bảng cũ, đổi tên, tạo lại index/trigger.
-- Rollback (chạy tay, từ chối nếu đã có dòng ja): rollback/0015_restore_lang_vi_zh.sql.
-- Thứ tự release (docs/community-worker.md): sao lưu D1 -> apply migration này -> deploy worker -> merge site có /ja/.
--
-- Bất biến phải giữ (khoá bằng test/lang-ja-migration.test.ts: so sqlite_master và toàn bộ dữ liệu trước/sau):
-- * D1 luôn bật khoá ngoại và DROP TABLE chạy ngầm DELETE FROM: xoá community_teams cũ khi community_team_images/
--   community_team_votes còn trỏ vào nó sẽ CASCADE xoá sạch ảnh và vote (defer_foreign_keys không chặn CASCADE).
--   Vì vậy hai bảng con cũng được dựng lại, trỏ vào community_teams_new, và bảng con cũ bị xoá TRƯỚC bảng cha cũ.
-- * ALTER TABLE RENAME kiểm toàn schema: trigger còn nhắc tới bảng đã xoá làm RENAME lỗi. Gỡ cả 9 trigger của các bảng
--   này trước (không `if exists`: thiếu trigger = schema lệch khỏi migrations/, dừng cả file để chủ repo kiểm tra),
--   dựng lại nguyên văn ở cuối, SAU khi chép dữ liệu (không đếm lại up_votes/down_votes/evidence_count).
-- * Cột sinh points/hot_rank/top_rank không chép (SQLite tự tính lại từ cùng giá trị nguồn).
-- * Cả file chạy trong một transaction của D1: lỗi ở bất kỳ câu nào -> không đổi gì.

-- Lưới an toàn: kiểm khoá ngoại dồn về lúc commit (không ảnh hưởng CASCADE, xem trên).
pragma defer_foreign_keys = on;

drop trigger battle_reports_block_blocked_user;
drop trigger scan_samples_block_blocked_user;
drop trigger community_teams_block_blocked_user;
drop trigger community_team_votes_count_ins;
drop trigger community_team_votes_count_upd;
drop trigger community_team_votes_count_del;
drop trigger battle_reports_team_evidence_ins;
drop trigger battle_reports_team_evidence_upd;
drop trigger battle_reports_team_evidence_del;

-- comments (0002)
create table comments_new (
  id text not null primary key,
  page_key text not null,
  lang text not null check (lang in ('vi', 'zh', 'ja')),
  user_id text not null references "user" ("id") on delete cascade,
  body text not null,
  created_at integer not null
);
insert into comments_new (id, page_key, lang, user_id, body, created_at)
  select id, page_key, lang, user_id, body, created_at from comments;
drop table comments;
alter table comments_new rename to comments;

-- battle_reports (0002)
create table battle_reports_new (
  id text not null primary key,
  page_key text not null,
  lang text not null check (lang in ('vi', 'zh', 'ja')),
  user_id text not null references "user" ("id") on delete cascade,
  image_key text,
  result text not null check (result in ('win', 'loss', 'draw')),
  ally_heroes text not null,
  enemy_heroes text not null,
  note text,
  season text,
  status text not null check (status in ('pending', 'approved', 'rejected')),
  reject_reason text,
  reviewed_by text,
  reviewed_at integer,
  created_at integer not null
);
insert into battle_reports_new (id, page_key, lang, user_id, image_key, result, ally_heroes, enemy_heroes, note, season, status, reject_reason, reviewed_by, reviewed_at, created_at)
  select id, page_key, lang, user_id, image_key, result, ally_heroes, enemy_heroes, note, season, status, reject_reason, reviewed_by, reviewed_at, created_at from battle_reports;
drop table battle_reports;
alter table battle_reports_new rename to battle_reports;

-- posts (0002)
create table posts_new (
  id text not null primary key,
  slug text not null,
  lang text not null check (lang in ('vi', 'zh', 'ja')),
  translation_key text,
  title text not null,
  description text not null,
  body_markdown text not null,
  faq text not null,
  tags text not null,
  cover_image text,
  status text not null check (status in ('draft', 'published')),
  author_id text,
  author_name text not null,
  published_at integer,
  updated_at integer not null,
  created_at integer not null
);
insert into posts_new (id, slug, lang, translation_key, title, description, body_markdown, faq, tags, cover_image, status, author_id, author_name, published_at, updated_at, created_at)
  select id, slug, lang, translation_key, title, description, body_markdown, faq, tags, cover_image, status, author_id, author_name, published_at, updated_at, created_at from posts;
drop table posts;
alter table posts_new rename to posts;

-- feedback (0003)
create table feedback_new (
  id text not null primary key,
  kind text not null check (kind in ('feature', 'bug', 'wrong_info', 'other')),
  title text not null,
  body text not null,
  email text,
  page text,
  lang text not null check (lang in ('vi', 'zh', 'ja')),
  user_id text references "user" ("id") on delete set null,
  status text not null check (status in ('new', 'done')),
  created_at integer not null
);
insert into feedback_new (id, kind, title, body, email, page, lang, user_id, status, created_at)
  select id, kind, title, body, email, page, lang, user_id, status, created_at from feedback;
drop table feedback;
alter table feedback_new rename to feedback;

-- scan_samples (0005)
create table scan_samples_new (
  id text not null primary key,
  user_id text not null references "user" ("id") on delete cascade,
  image_key text,
  screen text not null check (screen in ('battleReport', 'teamDetail', 'other')),
  side text not null check (side in ('left', 'right')),
  lang text not null check (lang in ('vi', 'zh', 'ja')),
  ai_read text not null,
  confirmed text not null,
  status text not null check (status in ('pending', 'approved', 'rejected')),
  reviewed_by text references "user" ("id") on delete set null,
  reviewed_at integer,
  created_at integer not null
);
insert into scan_samples_new (id, user_id, image_key, screen, side, lang, ai_read, confirmed, status, reviewed_by, reviewed_at, created_at)
  select id, user_id, image_key, screen, side, lang, ai_read, confirmed, status, reviewed_by, reviewed_at, created_at from scan_samples;
drop table scan_samples;
alter table scan_samples_new rename to scan_samples;

-- community_teams (0008) + hai bảng con. Thứ tự: cha mới -> con mới (trỏ cha mới) -> xoá con cũ -> xoá cha cũ
-- (không còn ai trỏ vào nên không CASCADE) -> đổi tên cha (RENAME viết lại khoá ngoại của con) -> đổi tên con.
create table community_teams_new (
  id text not null primary key,
  author_id text not null references "user" ("id") on delete cascade,
  season_id text not null references community_seasons ("id"),
  status text not null check (status in ('pending', 'approved', 'rejected')),
  title text not null,
  hero_1 text not null,
  hero_2 text not null,
  hero_3 text not null,
  hero_key text not null,              -- 3 id tướng đã sắp xếp, nối bằng ','
  tactics text not null,               -- JSON [[t,t],[t,t],[t,t]] theo thứ tự tướng
  troop text not null check (troop in ('cung', 'khiGioi', 'ky', 'thuan', 'thuong')),
  playstyle text not null,
  strengths text,
  weaknesses text,
  counters text,
  countered_by text,
  substitutes text,
  text_lang text not null check (text_lang in ('vi', 'zh', 'ja')),
  reject_reason text,
  reviewed_by text,                    -- không FK, giống battle_reports
  reviewed_at integer,
  deleting_at integer,                 -- khác null = đã chốt xoá (đang dọn R2); ẩn khỏi mọi đọc/ghi công khai
  created_at integer not null,
  up_votes integer not null default 0,
  down_votes integer not null default 0,
  evidence_count integer not null default 0,
  -- hot_rank: log() của SQLite là log cơ số 10 (workerd/D1 cục bộ cấm log10: "not authorized to use function").
  points integer generated always as (up_votes - down_votes + 2 * evidence_count) stored,
  hot_rank integer generated always as (
    cast(round((case when points > 0 then 1 when points < 0 then -1 else 0 end)
      * log(max(abs(points), 1)) * 1000000 + created_at / 172.8) as integer)) stored,
  top_rank integer generated always as (points * 10000000000 + created_at / 1000) stored
);
insert into community_teams_new (id, author_id, season_id, status, title, hero_1, hero_2, hero_3, hero_key, tactics, troop, playstyle,
    strengths, weaknesses, counters, countered_by, substitutes, text_lang, reject_reason, reviewed_by, reviewed_at, deleting_at, created_at,
    up_votes, down_votes, evidence_count)
  select id, author_id, season_id, status, title, hero_1, hero_2, hero_3, hero_key, tactics, troop, playstyle,
    strengths, weaknesses, counters, countered_by, substitutes, text_lang, reject_reason, reviewed_by, reviewed_at, deleting_at, created_at,
    up_votes, down_votes, evidence_count
  from community_teams;

create table community_team_images_new (
  team_id text not null references community_teams_new ("id") on delete cascade,
  position integer not null check (position between 0 and 2),
  object_key text not null unique,
  content_type text not null,
  primary key (team_id, position)
);
insert into community_team_images_new (team_id, position, object_key, content_type)
  select team_id, position, object_key, content_type from community_team_images;

create table community_team_votes_new (
  team_id text not null references community_teams_new ("id") on delete cascade,
  user_id text not null references "user" ("id") on delete cascade,
  value integer not null check (value in (-1, 1)),
  created_at integer not null,
  primary key (team_id, user_id)
);
insert into community_team_votes_new (team_id, user_id, value, created_at)
  select team_id, user_id, value, created_at from community_team_votes;

drop table community_team_votes;
drop table community_team_images;
drop table community_teams;
alter table community_teams_new rename to community_teams;
alter table community_team_images_new rename to community_team_images;
alter table community_team_votes_new rename to community_team_votes;

-- Index (nguyên văn 0002, 0003, 0005, 0006, 0008).
create index comments_page_lang_created_idx on comments (page_key, lang, created_at desc, id desc);
create index comments_created_idx on comments (created_at desc, id desc);
create index comments_user_idx on comments (user_id);
create index battle_reports_page_lang_status_created_idx on battle_reports (page_key, lang, status, created_at desc, id desc);
create index battle_reports_page_status_idx on battle_reports (page_key, status);
create index battle_reports_status_created_idx on battle_reports (status, created_at desc, id desc);
create index battle_reports_user_created_idx on battle_reports (user_id, created_at desc, id desc);
create unique index posts_lang_slug_uidx on posts (lang, slug);
create unique index posts_lang_translation_key_uidx on posts (lang, translation_key) where translation_key is not null;
create index posts_status_published_idx on posts (status, published_at desc);
create index feedback_created_idx on feedback (created_at desc, id desc);
create index feedback_status_created_idx on feedback (status, created_at desc, id desc);
create index feedback_user_idx on feedback (user_id);
create index scan_samples_status_created_idx on scan_samples (status, created_at desc, id desc);
create index scan_samples_user_idx on scan_samples (user_id);
create index community_teams_season_hot_idx on community_teams (season_id, status, hot_rank desc, id desc);
create index community_teams_season_top_idx on community_teams (season_id, status, top_rank desc, id desc);
create index community_teams_season_new_idx on community_teams (season_id, status, created_at desc, id desc);
create index community_teams_status_created_idx on community_teams (status, created_at desc, id desc);
create index community_teams_hero_key_idx on community_teams (hero_key, status);
create index community_teams_author_idx on community_teams (author_id, created_at desc, id desc);
create index community_team_votes_user_idx on community_team_votes (user_id);

-- Trigger (nguyên văn 0006, 0008).
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

create trigger community_team_votes_count_ins after insert on community_team_votes
begin
  update community_teams set
    up_votes = (select count(*) from community_team_votes where team_id = NEW.team_id and value = 1),
    down_votes = (select count(*) from community_team_votes where team_id = NEW.team_id and value = -1)
  where id = NEW.team_id;
end;

create trigger community_team_votes_count_upd after update on community_team_votes
begin
  update community_teams set
    up_votes = (select count(*) from community_team_votes where team_id = NEW.team_id and value = 1),
    down_votes = (select count(*) from community_team_votes where team_id = NEW.team_id and value = -1)
  where id = NEW.team_id;
  update community_teams set
    up_votes = (select count(*) from community_team_votes where team_id = OLD.team_id and value = 1),
    down_votes = (select count(*) from community_team_votes where team_id = OLD.team_id and value = -1)
  where id = OLD.team_id and OLD.team_id <> NEW.team_id;
end;

create trigger community_team_votes_count_del after delete on community_team_votes
begin
  update community_teams set
    up_votes = (select count(*) from community_team_votes where team_id = OLD.team_id and value = 1),
    down_votes = (select count(*) from community_team_votes where team_id = OLD.team_id and value = -1)
  where id = OLD.team_id;
end;

-- Ba trigger evidence: giữ đồng bộ với migrations/0008, rollback/0009, rollback/0010.
create trigger battle_reports_team_evidence_ins after insert on battle_reports
when NEW.page_key like '/doi-cong-dong/%'
begin
  update community_teams set evidence_count = (
    select count(distinct r.user_id) from battle_reports r
    where r.page_key = NEW.page_key and r.status = 'approved' and r.result = 'win' and r.user_id <> community_teams.author_id
  ) where id = substr(NEW.page_key, 16, length(NEW.page_key) - 16);
end;

create trigger battle_reports_team_evidence_upd after update of status, result on battle_reports
when NEW.page_key like '/doi-cong-dong/%'
begin
  update community_teams set evidence_count = (
    select count(distinct r.user_id) from battle_reports r
    where r.page_key = NEW.page_key and r.status = 'approved' and r.result = 'win' and r.user_id <> community_teams.author_id
  ) where id = substr(NEW.page_key, 16, length(NEW.page_key) - 16);
end;

create trigger battle_reports_team_evidence_del after delete on battle_reports
when OLD.page_key like '/doi-cong-dong/%'
begin
  update community_teams set evidence_count = (
    select count(distinct r.user_id) from battle_reports r
    where r.page_key = OLD.page_key and r.status = 'approved' and r.result = 'win' and r.user_id <> community_teams.author_id
  ) where id = substr(OLD.page_key, 16, length(OLD.page_key) - 16);
end;

create trigger community_teams_block_blocked_user before insert on community_teams
begin
  select raise(abort, 'account_blocked') where exists (
    select 1 from "user" where id = NEW.author_id
      and ((banned_until is not null and banned_until > cast(unixepoch('subsec') * 1000 as integer)) or deleting_at is not null)
  );
end;
