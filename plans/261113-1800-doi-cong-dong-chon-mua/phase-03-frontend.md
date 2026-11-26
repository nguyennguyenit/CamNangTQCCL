---
title: "Phase 3: Frontend"
status: todo
priority: P1
effort: "4h"
dependencies: [2]
---

# Phase 3: Form chọn mùa, danh sách, bỏ khối mùa ở admin

## Goal
User chọn mùa khi đăng; UI không còn khái niệm mùa mở/đóng.

## Files
- Modify: `js/community-teams.js`, `js/community-team-form.js`, `js/community-team-state.js`, `js/community-reports.js`, `js/community-api.js`, `js/community-admin-teams.js`, `css/styles.css` (xoá `.adm-season*`, `.cm-team-send-season*` không còn dùng, `.cm-archived`)
- Modify: `src/components/community/CommunityTeamsHub.astro` (lời dẫn "cho mùa đang mở" → "cho mùa bạn đang chơi")
- Modify tests/mocks: `tests-js/*community-team*` (payload có `season`), `tests-e2e/helpers/community-mock.mjs` (route `GET /api/community-seasons` dạng `{current, seasons}`, xoá mock `POST /api/admin/community-seasons`), `tests-e2e/community-teams.spec.mjs`, `tests-e2e/community-teams-redesign.spec.mjs`, `tests-e2e/admin-doi-cong-dong-moi.spec.mjs` (bỏ `seasonOpen`, bỏ test "mùa đã lưu trữ"), `scripts/design-canvas/community-samples.mjs`

## Tasks (TDD)
1. `teamPayloadFromDraft(draft, fields)`: thêm `season` bắt buộc (rỗng → `TeamFormError('invalid_season')`); test node trước.
2. `mountTeamForm(container, { seasons, current, … })`: thay khối "Mùa đang mở" bằng `<label>` "Mùa bạn đang chơi" + `<select id="cm-team-season-pick" required>` theo thứ tự catalog, chọn sẵn `current` (đánh dấu "(hiện hành)", không ghi "mới nhất"); nhãn `seasonLabel(season, locale)`; checklist có dòng "Đã chọn mùa".
3. `community-teams.js` — gỡ gate `open` ở **mọi** chỗ: `getSeasons()` → `{ current, seasons }`; `paintHead` (kicker chỉ "Cộng đồng", nút "Đăng đội" luôn hiện), tab nav, `mineView` (`:635`), `newView` (`:763`), danh sách (`state.season = current ?? 'all'`, luôn gửi `season` lên API, hậu tố "(hiện hành)" thay "(đang mở)", bỏ ghi chú "Chưa mở mùa").
   Chi tiết: `voteLocked` chỉ còn chủ đội; bỏ `voteNote` mùa đóng; `mountReports` bỏ `archived`.
   Catalog lỗi ở trang đăng → thông báo `codeMessage`, không mount form.
4. `community-reports.js`: xoá tuỳ chọn `archived` và nhánh hiển thị.
5. `community-api.js` `codeMessage`: xoá `season_closed`, `season_not_open`, `season_exists`, `season_conflict`; thêm `invalid_season` ("Hãy chọn mùa trong danh sách."), `season_catalog_unavailable` ("Chưa tải được danh sách mùa, thử lại sau.") vi + zh.
6. `community-admin-teams.js`: xoá `currentSeason`, `seasonBlock`, nhánh root, import/icon chỉ phục vụ khối này; sửa chú thích đầu file. `community-admin-audit.js` giữ nhãn `season.open` cho dòng lịch sử.
7. e2e: mặc định ô chọn = `current` (mock: `current` ≠ phần tử đầu); chọn mùa khác → body POST có mùa đó; từ `?mine=1` vẫn có nút/tab đăng đội và mở được form; danh sách mặc định gọi `season=<current>`; admin root không còn `#adm-season-form`; chi tiết đội không còn `.cm-archived`, vote bật cho người không phải chủ.

## Verification
- `npm run test:node`
- `npx playwright test tests-e2e/community-teams.spec.mjs tests-e2e/community-teams-redesign.spec.mjs tests-e2e/admin-doi-cong-dong-moi.spec.mjs`
- Mở `/doi-cong-dong/?new=1` (astro dev + mock) trên trình duyệt, chụp ô chọn mùa desktop + mobile.
