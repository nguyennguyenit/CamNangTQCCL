-- Mùa của Đội cộng đồng = danh mục mùa Đội chuẩn (`seasonOptions` của seasons.json đang publish, worker đọc lúc chạy).
-- Bỏ "đúng một mùa mở": mọi mùa nhận đội, vote, chiến báo. community_seasons chỉ còn là đích FK + nhãn cho join/export;
-- route đăng đội upsert hàng từ catalog. opened_at từ nay = lúc hàng được tạo; nhãn chỉ cập nhật khi có bài đăng mới ở mùa đó.
-- Mùa duy nhất từng mở bằng tay (binh-dien-xuan-thu) chuyển sang id catalog og-兵演春秋 (OG · Binh Diễn Xuân Thu / 兵演春秋).
-- Rollback (chạy tay): rollback/0013_restore_community_season_open.sql.
-- Thứ tự deploy: worker mới chạy được trên schema cũ -> deploy worker TRƯỚC rồi mới apply migration này.

-- Gỡ index trước: insert mùa mới khi binh-dien-xuan-thu còn mở sẽ vi phạm "một mùa mở".
drop index community_seasons_one_open_uidx;

insert into community_seasons (id, label_vi, label_zh, opened_at)
  values ('og-兵演春秋', 'OG · Binh Diễn Xuân Thu', 'OG · 兵演春秋', cast(unixepoch('subsec') * 1000 as integer))
  on conflict (id) do nothing;

update community_teams set season_id = 'og-兵演春秋' where season_id = 'binh-dien-xuan-thu';
update battle_reports set season = 'og-兵演春秋' where season = 'binh-dien-xuan-thu';
delete from community_seasons where id = 'binh-dien-xuan-thu';

alter table community_seasons drop column closed_at;
