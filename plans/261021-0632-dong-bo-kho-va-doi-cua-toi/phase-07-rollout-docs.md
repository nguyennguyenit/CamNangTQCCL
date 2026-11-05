---
phase: 7
title: "Rollout và tài liệu"
status: pending
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

1. `cd community-worker && npm run db:migrate:remote` (`0011_roster.sql` chỉ thêm bảng và index; nếu `0008` của Đội cộng đồng chưa áp, wrangler áp theo thứ tự tên file).
2. `cd community-worker && npm run deploy`. Kiểm: `GET /api/roster` không đăng nhập → 401; đăng nhập → 200 rỗng.
3. Deploy Pages. Kiểm: `/goi-y-doi-tu-kho/` khách chạy như cũ; đăng nhập hỏi gộp và đồng bộ; `/doi-cua-toi/` noindex; `/my-teams-source-index.json` trả JSON.

## Rollback

- Pages về bản trước: client cũ chỉ đọc `tqccl.rosterRecommend.scanState.v1`, nên người dùng thấy kho local trước lần gộp; dữ liệu cloud nằm yên trong D1. Món thêm trong thời gian rollback chỉ nằm ở kho local, và không tự lên cloud khi bản mới trở lại (cờ gộp đã đặt); ghi rõ điều này trong thông báo sự cố.
- Worker về version known-good: `/api/roster` biến mất; client mới báo lỗi đồng bộ và giữ kho cloud cache ở chế độ chỉ đọc; Đội của tôi không lưu được.
- D1: không xóa bảng khi rollback. Code cũ không đọc bảng mới; xóa bảng là thao tác phá hủy, chỉ làm khi có quyết định riêng.

## Tasks & Steps

1. Viết các mục docs trên.
2. Chạy toàn bộ cổng kiểm.
3. Người dùng thực hiện rollout (deploy cần quyền của người dùng). Ghi trong tài liệu: test chạy trên D1 giả và smoke dùng session Better Auth dựng sẵn không chứng minh được Google OAuth thật hay D1 production (`docs/community-worker.md:155-157`); kiểm sau rollout bằng một lượt đăng nhập Google thật và một lượt lưu/đọc trên production.

## Verification

- `npm run check && npm run build && npm run verify && npm run test:dist && npm run test:node` xanh.
- `cd community-worker && npx vitest run && npx tsc --noEmit` xanh.
- Docs có đủ thứ tự rollout và rollback như trên.
