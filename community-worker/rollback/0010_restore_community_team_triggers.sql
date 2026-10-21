-- Roll-forward sau rollback/0009: dựng lại 3 trigger evidence (chép từ migrations/0008_community_teams.sql) rồi đếm lại
-- evidence_count cho mọi đội (chiến báo ghi trong lúc trigger vắng mặt). KHÔNG nằm trong migrations/; chạy tay:
--   npx wrangler d1 execute tqccl-community --remote --file rollback/0010_restore_community_team_triggers.sql

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

update community_teams set evidence_count = (
  select count(distinct r.user_id) from battle_reports r
  where r.page_key = '/doi-cong-dong/' || community_teams.id || '/' and r.status = 'approved' and r.result = 'win'
    and r.user_id <> community_teams.author_id
);
