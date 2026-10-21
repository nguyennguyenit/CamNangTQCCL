---
phase: 6
title: "Tab quản trị Đội cộng đồng"
status: completed
priority: P2
effort: "0.75d"
dependencies: [5]
---

# Phase 6 — Tab quản trị Đội cộng đồng

<!-- Updated: Red Team 2026-10-21 - openTeamsPanel nhận counts, targetTypeLabel, pagePath dùng communityPageHref, gỡ đội qua DELETE /api/community-teams/:id (#12, #14, #15) -->

## Mục tiêu
Trong `/quan-tri/`, staff duyệt/từ chối/gỡ đội; root đặt mùa đang mở; nhật ký hiển thị nhãn vi/zh cho hành động mới; mọi link từ page key cộng đồng mở đúng trang.

## Bằng chứng
- Tab = mảng `definitions` + `ICONS` trong `js/community-admin.js` (~1850-1935, ~140-155); vai trò `ROOT`/`STAFF` :1850-1851; panel nhận `counts` (`:217`; `openReportsPanel(panel, {head, counts})` gọi `counts.refresh()` :462,480).
- `pagePath` `js/community-admin.js:297-300`, dùng ở `:402`, `:504`, `:559` và `js/community-admin-users.js:299,305`.
- Module tách riêng: `js/community-admin-users.js` (`actionLabel` :29-48, `AUDIT_ACTIONS` :53-57, `targetTypeLabel` :75-87).
- Mock counts e2e không có `teamsPending`: `tests-e2e/community.spec.mjs:112-119` (nay ở helper phase 5).
- Lời giới thiệu: `src/components/community/AdminConsole.astro:15-21`.

## File
- Tạo: `js/community-admin-teams.js` (`openTeamsPanel(panel, {head, counts, viewer})`)
- Sửa: `src/lib/public-artifact-manifest.mjs` — đăng ký `community-admin-teams` (thiếu thì `community-admin.js` import hỏng và cả trang quản trị không khởi động). <!-- Astra A#1 -->
- Sửa: `js/community-admin.js` (`definitions` + `ICONS.teams` + import; `pagePath` gọi `communityPageHref`)
- Sửa: `js/community-admin-users.js` (`actionLabel`, `AUDIT_ACTIONS`: `team.approve`, `team.reject`, `team.delete`, `season.open`; `targetTypeLabel`: `team`, `season`)
- Sửa: `src/components/community/AdminConsole.astro` (lời giới thiệu)
- Sửa: `tests-e2e/helpers/community-mock.mjs` (`teamsPending`, route admin đội/mùa), `tests-e2e/community-teams.spec.mjs` (khối quản trị)

## Thiết kế
- Tab: `{id:'teams', roles: STAFF, hash:'doi-cong-dong', icon:'teams', label: L('Đội cộng đồng','社区阵容'), lead: L(...), count:{key:'teamsPending', unit: L('đội chờ','待审')}, open: openTeamsPanel}`.
- Panel:
  - Lọc trạng thái (Chờ duyệt / Đã duyệt / Bị từ chối), `pagedList` theo `GET /api/admin/community-teams`.
  - Mỗi dòng: ảnh đầu, 3 tướng + CP (nhãn theo locale qua `js/community-team-data.js`), tiêu đề, tác giả (email đã che với KDV), mùa, ngày; mở rộng xem toàn bộ phân tích.
  - Duyệt; Từ chối (lý do bắt buộc); Gỡ (đội đã duyệt; lý do bắt buộc; xác nhận) → `DELETE /api/community-teams/:id {reason}`. Sau mỗi thao tác: `counts.refresh()`; 409 `not_pending` → làm mới dòng; 404 khi gỡ (đội của KDV/root với người gọi là KDV) → thông báo không đủ quyền; 502 `delete_incomplete` (từ chối hoặc gỡ) → thông báo + nút "Thử lại" gọi lại cùng endpoint.
  - Khối "Mùa đang mở" **chỉ hiện với root**: mùa hiện tại (id + nhãn vi/zh + ngày mở), form `id`, `labelVi`, `labelZh`; hộp xác nhận "Mùa <cũ> sẽ bị lưu trữ: khoá vote và chiến báo".

## Tests Before (đỏ trước)
`tests-e2e` (mock API):
- KDV: thấy tab và badge `teamsPending`; duyệt gửi `POST …/approve` rồi badge giảm; từ chối không lý do bị chặn ở client; không thấy khối mùa.
- Root: thấy khối mùa; gửi sau khi xác nhận → `POST /api/admin/community-seasons` đúng body; 409 `season_exists` hiện thông báo.
- Nhật ký: dòng `team.approve`/`season.open` có nhãn hành động và loại đối tượng vi + zh.
- Link từ hàng chờ bình luận/chiến báo và trang chi tiết user với `page = /doi-cong-dong/<id>/` mở `/doi-cong-dong/?id=<id>`.

## Refactor
Không đổi các tab cũ; `pagePath` đổi sang `communityPageHref` giữ nguyên kết quả cho key cũ (e2e hiện có chứng minh).

## Tests After
`npm run test:e2e` toàn bộ.

## Regression gate
`npm run build && npm run verify && npm run test:e2e`

## Rủi ro
- Import vòng `community-admin.js` ↔ module mới: theo mẫu `community-admin-users.js` (dùng lười trong hàm).
- `ICONS[name]` ném lỗi khi thiếu khoá: thêm `teams` cùng thay đổi với định nghĩa tab.

## Bảo mật
- Ẩn khối mùa với KDV chỉ là UX; server đã `requireRoot` (phase 3); thứ bậc khi gỡ do server (phase 2).

## Todo
- [x] Test e2e quản trị (đỏ)
- [x] `community-admin-teams.js`
- [x] Đăng ký tab + icon + `pagePath`
- [x] Nhãn nhật ký vi/zh (`actionLabel`, `AUDIT_ACTIONS`, `targetTypeLabel`)
- [x] Lời giới thiệu AdminConsole
- [x] Regression gate xanh
