-- Rollback của trigger evidence trong migrations/0008_community_teams.sql. KHÔNG nằm trong migrations/ nên
-- `wrangler d1 migrations apply` không tự chạy; chỉ chạy tay khi rollback Worker về bản không biết Đội cộng đồng:
--   npx wrangler d1 execute tqccl-community --remote --file rollback/0009_drop_community_team_triggers.sql
-- Trigger nằm trên bảng cũ battle_reports (Worker cũ ghi vào đó) nên phải gỡ; bảng/trigger mới của 0008 để nguyên (Worker cũ bỏ qua).
-- Khi roll-forward lại, chạy rollback/0010_restore_community_team_triggers.sql để dựng lại trigger và đếm lại evidence_count.

drop trigger if exists battle_reports_team_evidence_ins;
drop trigger if exists battle_reports_team_evidence_upd;
drop trigger if exists battle_reports_team_evidence_del;
