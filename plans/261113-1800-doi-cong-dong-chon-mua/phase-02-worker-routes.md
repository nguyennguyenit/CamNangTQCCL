---
title: "Phase 2: Worker-routes"
status: todo
priority: P1
effort: "4h"
dependencies: [1]
---

# Phase 2: Route worker theo catalog, bỏ mùa đóng

## Goal
API nhận `season` do user chọn, bỏ mở/đóng mùa, vote + chiến báo mở cho mọi mùa. Worker mới chạy được trên **cả** schema cũ (≤0011) cho các đường đọc, để deploy worker trước migration.

## Files
- Modify: `community-worker/src/routes/teams.ts`, `community-worker/src/routes/reports.ts`, `community-worker/src/teams-validate.ts`
- Modify tests: `teams.test.ts`, `teams-admin.test.ts`, `reports.test.ts`, `permissions.test.ts`, `audit.test.ts`, `visibility.test.ts`, `teams-validate.test.ts`, `site-publish.test.ts`, `teams-export.test.ts` (chỗ seed mùa)

## Tasks (TDD)
1. `GET /api/community-seasons` → `{ current, seasons: [{id, code, labelVi, labelZh}] }` từ catalog. Bỏ `open`, `openedAt`, `closedAt`.
2. `POST /api/community-teams`:
   - `parseTeamInput` thêm `season` theo cùng luật id của catalog (ký tự đầu `[a-z0-9]`, 1–40 code point, khác `all`) → 400 `invalid_season`; membership qua `findSeason` (`missing` → 400 `invalid_season`; không xác nhận được → 503). Kiểm **trước** `consumeRateLimit` và trước khi chép R2.
   - Batch: câu đầu upsert `community_seasons` (`on conflict (id) do update set label_vi = excluded.label_vi, label_zh = excluded.label_zh`); bỏ điều kiện `closed_at`; đọc `changes` của **câu insert đội** (không còn `results[0]`); `changes = 0` → `image_missing` + dọn R2.
   - Test: mùa cũ `pk-s5` → 201, hàng mùa có nhãn đúng; đăng lần 2 cùng mùa không nhân đôi hàng; mùa lạ / thiếu / `all` / > 40 / `-x` → 400, không tốn rate limit, không chép R2; catalog 503 → 503, không tốn rate limit; mùa mới chỉ có sau refresh (cache cũ thiếu, ngoài cooldown) → 201; **cache cũ + id mới + refresh lỗi → 503**, rate limit và R2 nguyên trạng; giữ nguyên test đua upload/dọn R2 (`teams.test.ts:196–222`).
3. `GET /api/community-teams`: `parseSeasonFilter` nhận `all` hoặc id hợp lệ; **thiếu → `all`** (đường đọc không phụ thuộc catalog; frontend luôn gửi `season`). Bỏ nhánh "không có mùa mở → []".
4. Xoá: `openSeason`, `communityTeamVisibleOpenSql`, trạng thái `closed` của `diagnoseCommunityTeam` (thay bằng `communityTeamVisibleSql`), `season_closed_at` trong `TEAM_SELECT`, `seasonOpen` trong chi tiết, `s.closed_at is null` trong `VOTABLE_TEAM` + nhánh 409 vote, `POST /api/admin/community-seasons`, `parseSeasonInput`, `SeasonInput`, `SEASON_ID_RE` (kiểm LSP references trước khi xoá export).
5. `reports.ts`: chiến báo đội cộng đồng lấy `t.season_id` **trong chính câu `insert … select`** (join đội, cùng điều kiện `teamVisibleSql`), không bind mùa đọc ở preflight; bỏ `season_closed`. Test: `beforeNextBatch` remap mùa của đội (mô phỏng migration 0012/rollback chen giữa preflight và batch) → chiến báo mang mùa mới của đội.
6. Audit `season.open`: không sinh mới; giữ trong danh sách `?action=` hợp lệ (nhật ký prod đã có dòng); test audit seed dòng trực tiếp.
7. Test dương tính thay test khoá mùa: đội thuộc mùa không phải `current` → vote, bỏ vote, gửi chiến báo đều thành công. Xoá test mở/đóng mùa, `season_closed`, `season_not_open`, unique-open (không re-pin).
8. Test tương thích schema cũ: harness `upTo: "0011"` + seed mùa mở → app mới trả 200 cho `GET /api/community-seasons`, danh sách, chi tiết, export, vote, chiến báo (chứng minh deploy worker trước migration an toàn). POST đội trên schema cũ **vẫn lỗi** (unique index) nếu gọi API trực tiếp; frontend cũ không có nút đăng — rủi ro chấp nhận trong cửa sổ cutover, ghi ở Phase 4.

## Verification
- `cd community-worker && npm test && npm run typecheck`
- `rg -n "closed_at|season_closed|season_not_open|openSeason|admin/community-seasons|parseSeasonInput" community-worker/src` → không còn kết quả.
