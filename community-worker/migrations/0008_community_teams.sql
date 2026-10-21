-- Đội cộng đồng: mùa, đội, ảnh, vote. Bộ đếm (up_votes, down_votes, evidence_count) do trigger ĐẾM LẠI (không ±1)
-- nên idempotent; points/hot_rank/top_rank là cột sinh STORED để phân trang keyset theo index.
-- Cột thời gian ứng dụng là epoch ms (integer). Rollback evidence: rollback/0009, 0010 (chạy tay).

-- Mùa của kho Đội cộng đồng. Đúng một dòng closed_at is null = mùa đang mở.
create table community_seasons (
  id text not null primary key check (id glob '[a-z0-9]*' and length(id) between 1 and 40),
  label_vi text not null,
  label_zh text not null,
  opened_at integer not null,
  closed_at integer
);
create unique index community_seasons_one_open_uidx on community_seasons ((closed_at is null)) where closed_at is null;

create table community_teams (
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
  text_lang text not null check (text_lang in ('vi', 'zh')),
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
create index community_teams_season_hot_idx on community_teams (season_id, status, hot_rank desc, id desc);
create index community_teams_season_top_idx on community_teams (season_id, status, top_rank desc, id desc);
create index community_teams_season_new_idx on community_teams (season_id, status, created_at desc, id desc);
create index community_teams_status_created_idx on community_teams (status, created_at desc, id desc);
create index community_teams_hero_key_idx on community_teams (hero_key, status);
create index community_teams_author_idx on community_teams (author_id, created_at desc, id desc);

-- Chủ duy nhất của khoá R2 ảnh đội sau khi gắn (dòng uploads tạm bị xoá lúc gắn).
create table community_team_images (
  team_id text not null references community_teams ("id") on delete cascade,
  position integer not null check (position between 0 and 2),
  object_key text not null unique,
  content_type text not null,
  primary key (team_id, position)
);

create table community_team_votes (
  team_id text not null references community_teams ("id") on delete cascade,
  user_id text not null references "user" ("id") on delete cascade,
  value integer not null check (value in (-1, 1)),
  created_at integer not null,
  primary key (team_id, user_id)
);
create index community_team_votes_user_idx on community_team_votes (user_id);

-- Bộ đếm vote: đếm lại từ community_team_votes.
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

-- evidence_count = số user khác tác giả có >= 1 chiến báo THẮNG đã duyệt trên page_key '/doi-cong-dong/<id>/'.
-- '/doi-cong-dong/' dài 15 ký tự: id = substr(page_key, 16, length - 16) (bỏ '/' cuối).
-- Ba trigger này được rollback/0009 gỡ và rollback/0010 dựng lại: giữ hai file đó đồng bộ với khối dưới.
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

-- Chặn ghi cho tác giả bị khoá/đang xoá theo đồng hồ DB (giống 0006): bảng này giữ khoá R2.
create trigger community_teams_block_blocked_user before insert on community_teams
begin
  select raise(abort, 'account_blocked') where exists (
    select 1 from "user" where id = NEW.author_id
      and ((banned_until is not null and banned_until > cast(unixepoch('subsec') * 1000 as integer)) or deleting_at is not null)
  );
end;
