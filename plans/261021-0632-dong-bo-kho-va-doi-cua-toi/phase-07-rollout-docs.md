---
phase: 7
title: "Rollout và tài liệu"
status: done
priority: P2
effort: "0.5d"
dependencies: [6]
---

# Phase 7: Rollout và tài liệu

## Goal

Thứ tự deploy và rollback được ghi trong tài liệu, mô tả đúng hành vi của client cũ; README, changelog và docs phản ánh tính năng mới.

## Files to Create / Modify

- Modify: `docs/deployment-guide.md` — mục rollout `roster_records`: D1 `0011` → `community-worker` → Pages, theo cách đã ghi cho đợt PR #18 (commit `e340f3a`).
- Modify: `docs/community-worker.md` — route `/api/roster`, bảng, rate limit, test.
- Modify: `README.md` — Gợi ý đội (đồng bộ tùy chọn, bảng chọn nhanh, chạy khi chưa cấu hình AI) và Đội của tôi.
- Modify: `docs/codebase-summary.md` — module mới (`roster-*`, `my-teams-*`), endpoint index nguồn.
- Modify: `docs/project-changelog.md` — mục mới theo mẫu đợt recruit-sync (`:400-405`), gồm generation bản dịch đã publish.
- Modify: `docs/roster-sync.md` — đánh dấu hợp đồng là hiện hành, kèm số đo cuối.

## Rollout order

<!-- Updated: đợt gom 9 issue (plans/261022-1109-dot-gom-9-issue) — tách rollout thành hai lần: worker sớm, Pages cuối đợt -->

Rollout chia hai lần, theo `plans/261022-1109-dot-gom-9-issue/plan.md`. Lý do: `pages-deploy.yml` tự build `main` mỗi lần xuất bản blog (`community-worker/src/routes/posts.ts:139-156`), nên client gọi `/api/roster` chỉ được vào `main` khi worker đã chạy trên production.

**Lần 1 — Worker, ngay sau khi PR worker (chỉ `community-worker/**` và docs) merge** (phase 04 của plan đợt gom):

1. Cổng trước deploy, chạy trên đúng commit sẽ deploy:
   - `cd community-worker && npx vitest run && npx tsc --noEmit` xanh. CI không chạy community-worker (`.github/workflows/mcp-worker.yml` không có `community-worker/**`; `mcp-worker/scripts/check-repository.ts` không có bước community-worker), nên đây là bằng chứng duy nhất.
   - Thử migration trên D1 local: `cd community-worker && npm run db:migrate:local` áp `0011_roster.sql` trên DB đã có `0001`–`0006`, `0008`.
   - Giới hạn batch (200 bản ghi, 601 câu D1 mỗi request) đối chiếu với giới hạn gói D1 thật; ghi số liệu vào `docs/roster-sync.md`.
2. Ghi lại version worker đang chạy (rollback target) và bookmark D1: `npx wrangler d1 time-travel info tqccl-community`.
3. `cd community-worker && npm run db:migrate:remote` (`0011_roster.sql` chỉ thêm bảng và index; `0008` đã áp trên production theo `docs/deployment.md:33`). Không chạy bước kiểm `sqlite_version()` ở `docs/community-worker.md:353`: production D1 từ chối câu này.
4. `cd community-worker && npm run deploy`.
5. Kiểm production qua proxy Pages: `curl -s -o /dev/null -w '%{http_code}' https://tqccl.com/api/roster` → `401`; một lượt đăng nhập Google thật, ghi một bản ghi rồi đọc lại (`docs/community-worker.md:155-157`: test và session dựng sẵn không chứng minh OAuth thật hay D1 production).
6. Ghi mục "Latest Community Worker Deploy" vào `docs/deployment.md` (version, bookmark, kết quả kiểm).

Chỉ sau bước 5, các PR client (phase 3–6, chạy lại trên `main`) mới được merge.

**Lần 2 — Pages, cuối đợt** (phase 11 của plan đợt gom): chạy gate `mcp-worker.yml` với `confirm_production=false` và kiểm head SHA của lần chạy → release MCP → `pages-deploy.yml` bằng `workflow_dispatch`, một lần; `main` không đổi tới khi cả hai xong (`pages-deploy.yml:17-19` có `cancel-in-progress`). Kiểm: `/goi-y-doi-tu-kho/` khách chạy như cũ; đăng nhập hỏi gộp và đồng bộ; `/doi-cua-toi/` noindex; `/my-teams-source-index.json` trả JSON; `/api/roster` qua proxy vẫn `401` khi chưa đăng nhập; các bước preview header và canary ở `docs/deployment-guide.md:129-141`.

## Rollback

- **Revert `main` trước**, rồi chạy lại `pages-deploy.yml` (hoặc promote deployment known-good), rồi mới rollback worker nếu cần (`docs/community-worker.md:357`, `docs/deployment.md:25`). Nếu chỉ rollback Pages mà `main` vẫn chứa client mới, lần xuất bản blog sau sẽ đưa client mới trở lại.
- Pages về bản trước: client cũ chỉ đọc `tqccl.rosterRecommend.scanState.v1`, nên người dùng thấy kho local trước lần gộp; dữ liệu cloud nằm yên trong D1. Món thêm trong thời gian rollback chỉ nằm ở kho local, và không tự lên cloud khi bản mới trở lại (cờ gộp đã đặt); ghi rõ điều này trong thông báo sự cố.
- Worker về version đã ghi ở bước 2 của lần 1 (version ngay trước #21, không lùi qua mốc Đội cộng đồng): `/api/roster` biến mất; client mới báo lỗi đồng bộ và giữ kho cloud cache ở chế độ chỉ đọc; Đội của tôi không lưu được.
- D1: không xóa bảng khi rollback. Code cũ không đọc bảng mới; xóa bảng là thao tác phá hủy, chỉ làm khi có quyết định riêng.

## Tasks & Steps

1. Viết các mục docs trên.
2. Chạy toàn bộ cổng kiểm.
3. Người dùng thực hiện rollout theo hai lần ở trên (deploy cần quyền của người dùng). Đăng nhập Google thật + một lượt lưu/đọc production thuộc lần 1 (worker); lần 2 chỉ kiểm lại qua proxy.

## Verification

- `npm run check && npm run build && npm run verify && npm run test:dist && npm run test:node` xanh.
- `cd community-worker && npx vitest run && npx tsc --noEmit` xanh.
- Docs có đủ thứ tự rollout và rollback như trên.

## Kết quả (2026-10-22)

- Docs: `docs/deployment-guide.md` § "Đồng bộ kho và Đội của tôi (`roster_records`)" (thứ tự D1 `0011` → Worker → Pages, kiểm sau từng bước, giới hạn bằng chứng local, rollback), `docs/community-worker.md` § cùng tên, `README.md`, `docs/codebase-summary.md`, `docs/system-architecture.md` (bảng state), `docs/project-changelog.md` (mục 2026-10-22, generation `29fc68086242…`, đổi tên menu "Đội đã đăng"), `docs/roster-sync.md` (trạng thái hiện hành, số đo cuối). Trang Quyền riêng tư (vi/zh) thêm mục "Đội của tôi".
- Không file docs hay `README.md` nào nằm trong `sourceFiles` của `pipeline/site-localization-policy.json`, nên không cần publish lại bản dịch; `PrivacyPage.astro` không bị ghim.
- Cổng kiểm đều xanh: `check` 0 lỗi, `build` 5 025 trang, `verify` (5 423 file dist), `test:dist` 52, `test:node` 704, `community-worker` vitest 570 + `tsc --noEmit`.
- Rollout (migration, deploy Worker, deploy Pages, đăng nhập Google thật + một lượt lưu/đọc production) do người dùng thực hiện; chưa làm. Thứ tự mới: xem "Rollout order" (worker sớm, Pages cuối đợt gom).
