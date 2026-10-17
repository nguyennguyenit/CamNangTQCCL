-- Rollback của trigger chặn tài khoản trong migrations/0006_user_admin.sql. KHÔNG nằm trong migrations/ nên
-- `wrangler d1 migrations apply` không tự chạy; chỉ chạy tay khi rollback Worker về bản không biết các trigger này:
--   npx wrangler d1 execute tqccl-community --remote --file rollback/0007_drop_user_block_triggers.sql
-- Cột và bảng admin_audit của 0006 để nguyên (Worker cũ bỏ qua). Sau khi gỡ, khoá tài khoản không còn bị DB chặn.

drop trigger if exists session_block_blocked_user;
drop trigger if exists uploads_block_blocked_user;
drop trigger if exists battle_reports_block_blocked_user;
drop trigger if exists scan_samples_block_blocked_user;
