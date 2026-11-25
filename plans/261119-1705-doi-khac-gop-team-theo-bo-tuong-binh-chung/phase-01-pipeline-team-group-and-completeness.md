---
phase: 1
title: "Pipeline: gộp nội bộ v2, khóa team, đủ dữ liệu, publish"
status: pending
priority: P1
effort: "1.5d"
dependencies: []
---

# Phase 1: Pipeline: gộp nội bộ v2, khóa team, đủ dữ liệu, publish

## Goal
Ledger giữ được mọi phương án khác binh thư/binh chủng; mỗi record `other-teams.json` mang khóa team, cờ đủ dữ liệu, thứ tự; summaries chỉ tính phương án đủ dữ liệu; publish generation mới để các phase sau chạy trên dữ liệu thật.

## Context
- Dedup: `pipeline/recommended_team_dedup.py:20-31` (khóa v1 = tướng + chiến pháp), `:131-145` `_merge_local_duplicates` (giữ hàng đầu), `:177-181` một `legacyVariantId` mỗi hàng `teams.json` (1:1), `:193` unit từ hàng, `:219` sort đề cử trước. Hàng admitted luôn có đủ `heroIdentityId` (hàng chưa resolve → `pendingIdentity`, `:23-25,185-187`).
- Builder: `pipeline/build_recommended_reference.py:398-414` (validate), `:441-465` (ghi `other-teams.json`), `:456-462` (summaries nhận `otherTeams`), `:801-838`.
- Summaries: `pipeline/hero_summaries.py:284,318-323`, `pipeline/tactic_summaries.py:224`.

## Requirements
1. **Gộp nội bộ v2** (`recommended_team_dedup.py`): khóa gộp trùng nội bộ = khóa v1 + binh thư (theo thứ tự slot của từng tướng) + unit; so với Đội chuẩn vẫn dùng khóa v1 (`classify_candidates` không đổi). Khi trùng hệt khóa v2, giữ hàng `dataComplete` trước, rồi Đề cử, rồi thứ tự cũ. Tăng `DEDUP_KEY_VERSION` hoặc thêm `localMergeKeyVersion` — chọn một, ghi vào ledger.
2. **Khóa team** (module mới `pipeline/other_team_groups.py`): `teamGroupKey` = `heroes:<3 heroIdentityId sort, nối bằng ,>|unit:<unit sort, nối +; rỗng → ?>`; `teamGroupId` = `g-` + 16 hex đầu sha256(key). Identity rỗng → raise.
3. **Đủ dữ liệu** (`dataComplete`): đúng 3 holder; mỗi holder ≥2 `tacticSlotsRaw` không rỗng và ≥1 `bookSlotsRaw` không rỗng (theo dữ liệu vi/nguồn của ledger).
4. **Thứ tự** (`optionRank`, số nguyên trên toàn danh sách): Đề cử trước, rồi thứ tự ledger. JS dùng `optionRank`, bỏ tie-break hash riêng cho Đội khác (tránh hai nguồn sự thật).
5. **`teamGroups`** trong payload `other-teams.json`: `{teamGroupId, teamGroupKey, memberVariantIds (theo optionRank), completeVariantIds, representativeVariantId (phương án đủ dữ liệu có optionRank nhỏ nhất; null nếu không có)}`.
6. **Validator** (builder) fail loud khi: record không thuộc đúng một group; `memberVariantIds` khác tập record mang `teamGroupId` đó; `teamGroupId ≠ sha256(teamGroupKey)`; `completeVariantIds` khác tập `dataComplete`; representative không thuộc `completeVariantIds` (khi khác null); một `legacyTeamId` có >1 record (bất biến 1:1).
7. **Summaries chỉ tính đủ dữ liệu**: truyền `other_records` đã lọc `dataComplete` vào `build_hero_summaries`/`build_tactic_summaries`.
8. **Báo cáo zh**: liệt kê phương án `dataComplete` có slot chiến pháp/binh thư không tra được chữ Hán (để biết bản zh sẽ hiện thiếu); không chặn build, đính PR.
9. **Script đếm** `reports/count-team-groups.py` (trong thư mục plan): in số team, team có phương án đủ, phương án đủ theo nguồn, route bị loại; Success Criteria dùng số này.

## Tests Before (viết trước, phải đỏ)
- `tests/test_recommended_team_dedup.py`: hai hàng cùng tướng + chiến pháp, khác binh thư → cả hai admitted; khác unit → cả hai admitted; trùng hệt khóa v2 với một hàng thiếu dữ liệu và một hàng đủ → giữ hàng đủ (dù hàng thiếu là Đề cử); so với Đội chuẩn vẫn theo khóa v1.
- `tests/test_build_recommended_reference.py` (hoặc `tests/test_other_team_groups.py`): cùng 3 identity khác thứ tự + cùng unit → cùng `teamGroupId`; khác unit → khác; "Kỵ, Cung" khác "Kỵ"; identity rỗng → raise; `dataComplete` false khi 1 tướng 1 chiến pháp / 0 binh thư; validator bắt từng bất biến ở Requirement 6 (fixture hỏng có chủ đích).
- `tests/test_hero_summaries.py`, `tests/test_tactic_summaries.py`: record `dataComplete=false` không được đếm, không làm representative.
- Snapshot số trên generation đã pin: cập nhật có chủ đích khi đổi generation (không tính lại bằng chính hàm cần kiểm).

## Refactor
- Tạo `pipeline/other_team_groups.py`; sửa `recommended_team_dedup.py` (khóa nội bộ v2, thứ tự giữ hàng), `build_recommended_reference.py` (gắn trường, `teamGroups`, validator, lọc summaries).

## Publish (cuối phase)
- Sinh lại ledger (`recommended_team_dedup --pack …`), so phân loại trước/sau (liệt kê hàng chuyển trạng thái, kỳ vọng ≥5 hàng `matchingLocal` khác binh thư thành admitted).
- Ghim hash `data/teams.json`/file đổi + baseline inventory → `site_localization build/check/publish/check --stage public` → `team_route_handles --rebind --append-legacy` → `--check` → `prune`.

## Regression gate
- Các test Python ở trên + `tests.test_site_localization`, `tests.test_team_route_handles`; `build_json --check`; `npm run test:node` (site chưa đổi giao diện nên phải xanh).

## Files
- Create: `pipeline/other_team_groups.py`, `tests/test_other_team_groups.py`, `reports/count-team-groups.py` (thư mục plan).
- Modify: `pipeline/recommended_team_dedup.py`, `pipeline/build_recommended_reference.py`, `pipeline/recommended-other-teams.json` (sinh lại), generation `src/data/recommended-reference/*`, `pipeline/site-localization-policy.json`, `pipeline/team-route-handles.json`, `data/website-display.json`.

## Risk
- Đổi ledger: số admitted tăng (phương án khác binh thư/unit trở lại); liệt kê trong PR.
