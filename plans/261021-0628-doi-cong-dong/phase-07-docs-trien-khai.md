---
phase: 7
title: "Docs, kiểm tra toàn bộ, triển khai"
status: in-progress
priority: P1
effort: "0.5d"
dependencies: [6]
---

# Phase 7 — Docs, kiểm tra toàn bộ, triển khai

<!-- Updated: Red Team 2026-10-21 - Pages chạy tay bằng workflow_dispatch, rollback revert main trước, restore trigger 0010 (#10), trần AI toàn site trong docs (#11) -->

## Mục tiêu
Tài liệu khớp code; toàn bộ bộ kiểm tra xanh; triển khai theo luật migration → Worker → `main` → workflow Pages; smoke trên production đi đủ vòng.

## Bằng chứng
- Luật triển khai và rollback: `docs/community-worker.md:252-268` (revert `main` trước :263; trigger phải tạo lại :266).
- `pages-deploy.yml` chỉ chạy bằng `repository_dispatch: blog-publish` và `workflow_dispatch` (`.github/workflows/pages-deploy.yml:7-10`) — push **không** deploy.
- Time Travel ghi đè toàn DB, cần bookmark trước: [research-d1-ranking](./reports/research-d1-ranking.md) §Q1.

## File
- Sửa: `docs/community-worker.md` (mục "Đội cộng đồng": bảng, trigger, công thức điểm + hằng số, API, mã lỗi mới, rate limit gồm `team_analyze_global`, AI qua `callModel` của `worker/` nhóm `teamScan`, mùa, khoá tạm `pending/team-`, xoá đội/xoá tài khoản, triển khai/rollback 0008/0009/0010)
- Sửa: `docs/system-architecture.md`, `docs/codebase-summary.md`, `docs/project-changelog.md`
- Sửa (nếu có liệt kê trang cộng đồng): `docs/design-guidelines.md`
- Sửa: `src/components/pages/PrivacyPage.astro` (vi + zh; không bị pin): ảnh đội gửi tới nhà cung cấp AI để đọc nháp, ảnh + phân tích công khai sau khi duyệt, ảnh của đội bị từ chối bị xoá, ảnh tạm chưa gửi xoá sau 24 giờ, toàn bộ xoá theo tài khoản. <!-- Updated: Validation Session 1 -->

## Các bước
1. Viết docs (tiếng Việt, theo cấu trúc hiện có của `community-worker.md`).
2. Chạy đủ: `cd community-worker && npm test && npm run typecheck`; ở root `npm run test:node && npm run build && npm run verify && npm run test:dist && npm run test:e2e`.
3. Smoke cục bộ: `npm run db:migrate:local`; `npm run dev` (community-worker) + `npx wrangler pages dev dist` với session seed như plan 261016; root mở mùa, đăng đội có ảnh, KDV duyệt, user khác vote, gửi chiến báo + duyệt, mở mùa mới, thử vote (409) và bình luận (201), xoá đội.
4. **Dừng và hỏi trước mỗi bước remote dưới đây.**
5. Kiểm D1: `npx wrangler d1 execute tqccl-community --remote --command "select sqlite_version()"` (≥ 3.31; thấp hơn → dừng). Ghi bookmark: `npx wrangler d1 time-travel info tqccl-community`.
6. Kiểm `/quan-tri/` tab AI: nhóm `teamScan` có chuỗi vision (đang phục vụ `/soi-doi-tu-anh/`).
7. `cd community-worker && npm run db:migrate:remote` → `npm run deploy`.
8. Push `main`, rồi `gh workflow run pages-deploy.yml --ref main` và chờ xanh (`gh run watch`). Trước khi mở mùa, trang hiện "Chưa mở mùa" — trạng thái hợp lệ.
9. Root mở mùa đầu tiên trong tab "Đội cộng đồng" của `/quan-tri/` (id + nhãn vi/zh do người dùng cung cấp — hỏi nếu chưa có).
10. Smoke production: vòng đầy đủ ở "Xong khi" của `plan.md`, trên `/doi-cong-dong/` và `/zh/doi-cong-dong/`; xoá đội thử sau khi xong.

## Tests Before
Không có test mới; bước 2 là cổng.

## Regression gate
Toàn bộ lệnh ở bước 2 xanh trước bước 5.

## Rủi ro và rollback
- Migration lỗi: D1 chạy cả file trong một lần, tự rollback.
- Frontend/Worker lỗi: **revert commit trên `main` trước** (để `blog-publish` kế tiếp không build lại frontend mới), chạy lại `pages-deploy.yml`, rồi `wrangler rollback` Worker.
- Trong thời gian chạy Worker cũ trên DB đã có đội: **không xoá tài khoản** (Worker cũ không biết `community_team_images` → ảnh đội và chiến báo/bình luận trên trang đội bị bỏ sót, không dọn lại được) cho tới khi deploy lại Worker có phase 4. Ghi quy tắc này vào mục rollback của `docs/community-worker.md`. <!-- Astra A#7 -->
- Trigger evidence trên `battle_reports` vô hại với Worker cũ; nếu cần gỡ: `rollback/0009_drop_community_team_triggers.sql`; khi roll-forward chạy `rollback/0010_restore_community_team_triggers.sql` (tạo lại trigger + đếm lại `evidence_count`).
- Time Travel chỉ khi dữ liệu sai nghiêm trọng (ghi đè mọi ghi sau bookmark) — hỏi trước.

## Todo
- [x] Docs + changelog
- [x] Toàn bộ kiểm tra xanh (2026-10-21, worktree `feat/doi-cong-dong`: worker 537 test + typecheck; `test:node` 614; `build`; `verify` 5406 file; `test:dist` 49; `test:e2e` 533)
- [x] Smoke cục bộ — API trên `wrangler dev` + D1/R2 cục bộ (session Better Auth seed): mở mùa, đăng đội có ảnh, KDV duyệt, vote ±1 (tác giả 403 `own_team`), chiến báo thắng được duyệt → `evidenceCount` 1, `points` 2, mở mùa mới → vote 409 `season_closed`, bình luận 201, chủ xoá 409 `has_evidence`, KDV xoá → D1 sạch. UI chỉ kiểm qua e2e (mock `/api`), chưa smoke UI với `pages dev`.
- [ ] (hỏi) Kiểm SQLite D1 + bookmark Time Travel
- [ ] (hỏi) Migrate remote → deploy Worker
- [ ] (hỏi) Push `main` + chạy `pages-deploy.yml`
- [ ] Mở mùa đầu tiên
- [ ] Smoke production vi + zh
