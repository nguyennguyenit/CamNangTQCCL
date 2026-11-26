-- Rollback của migrations/0012_community_season_catalog.sql: đưa DB về dạng worker + frontend cũ đọc được
-- (đúng một mùa mở; id mùa khớp ^[a-z0-9][a-z0-9-]{0,39}$). KHÔNG nằm trong migrations/; chạy tay rồi `wrangler rollback`:
--   npx wrangler d1 execute tqccl-community --remote --file rollback/0013_restore_community_season_open.sql
-- Mùa mở lại = binh-dien-xuan-thu (đội og-兵演春秋 quay về id cũ); mọi mùa catalog khác bị đóng (đội vẫn xem được,
-- khoá vote/chiến báo như hành vi cũ). Roll-forward sau rollback: chạy lại file migrations/0012 bằng `--file`
-- (d1_migrations vẫn ghi 0012 là đã apply nên `migrations apply` sẽ bỏ qua).

alter table community_seasons add column closed_at integer;

insert into community_seasons (id, label_vi, label_zh, opened_at)
  values ('binh-dien-xuan-thu', 'Binh Diễn Xuân Thu', '兵演春秋', cast(unixepoch('subsec') * 1000 as integer))
  on conflict (id) do nothing;

update community_teams set season_id = 'binh-dien-xuan-thu' where season_id = 'og-兵演春秋';
update battle_reports set season = 'binh-dien-xuan-thu' where season = 'og-兵演春秋';
delete from community_seasons where id = 'og-兵演春秋';

update community_seasons set closed_at = cast(unixepoch('subsec') * 1000 as integer) where id <> 'binh-dien-xuan-thu';

create unique index community_seasons_one_open_uidx on community_seasons ((closed_at is null)) where closed_at is null;
