---
phase: 3
title: "API duyệt và quản trị mùa"
status: completed
priority: P1
effort: "0.5d"
dependencies: [2]
---

# Phase 3 — API duyệt và quản trị mùa

<!-- Updated: Red Team 2026-10-21 - bỏ route DELETE admin (gộp vào phase 2) (#15), test counts đúng hình (#14), ma trận permissions: seed/snapshot/số route (#14) -->

## Mục tiêu
Root/KDV duyệt hoặc từ chối đội; root mở mùa mới; mỗi thao tác ghi đúng một dòng `admin_audit`; badge hàng chờ có số đội chờ.

## Bằng chứng
- Duyệt chiến báo: `community-worker/src/routes/reports.ts:252-307` (`requireStaff`, một `DB.batch([update, auditIfStmt(...)])`, audit chỉ ghi khi câu kiểm `exists` khớp; từ chối bắt buộc lý do 1–500).
- KDV được tự duyệt nội dung của mình: quyết định Validation Session 2 của `plans/261016-1757-quan-ly-nguoi-dung/plan.md` — giữ nhất quán.
- `auditStmt`, `auditIfStmt` `src/audit.ts:57-87`; tên hành động `^[a-z_]+(\.[a-z_]+){0,3}$` (`src/routes/audit.ts:37-49`).
- `COUNTS_SQL` + khoá phản hồi `src/routes/admin.ts:15-34`; test khoá đúng hình: `test/admin.test.ts:33,38-40`, `test/permissions.test.ts:193-199`.
- Ma trận quyền: `test/permissions.test.ts:11-31` (`seed`), `:34` (`Allowed`), `:58` (`snapshot` 6 bảng), `:64,165-166` (chữ "22 endpoint").

## File
- Sửa: `community-worker/src/routes/teams.ts` (route admin)
- Sửa: `community-worker/src/routes/admin.ts` (`teamsPending`)
- Tạo: `community-worker/test/teams-admin.test.ts`
- Sửa: `community-worker/test/admin.test.ts`, `community-worker/test/permissions.test.ts`, `community-worker/test/audit.test.ts`

## Thiết kế
| Method + path | Quyền | Hành vi |
|---|---|---|
| `GET /api/admin/community-teams?status=pending&cursor` | staff | mọi trạng thái (`pending` mặc định), không lọc hiển thị, 20/trang theo `created_at` (`paginate` sẵn có); item gồm tác giả (email che cho KDV như route users), `rejectReason` |
| `POST /api/admin/community-teams/:id/approve` | staff | `DB.batch([auditIfStmt team.approve với exists (select 1 from community_teams where id = ? and status = 'pending' and deleting_at is null), update … set status='approved', reviewed_by, reviewed_at where id = ? and status = 'pending' and deleting_at is null])` — audit đặt **trước** update với cùng điều kiện `pending`, nên chỉ request thực sự chuyển trạng thái mới ghi audit, kể cả hai lần gọi cùng người, cùng mili-giây. `changes=0` → 404 nếu không có/đang xoá, 409 `not_pending` nếu đã xử lý <!-- Astra A#6 --> |
| `POST /api/admin/community-teams/:id/reject` `{reason}` | staff | Lý do 1–500 bắt buộc. (1) `DB.batch([auditIfStmt team.reject (điều kiện pending như trên, đặt trước), update … set status='rejected', reject_reason, reviewed_by, reviewed_at where id=? and status='pending' and deleting_at is null])` — chốt trạng thái trước, thắng/thua race với duyệt một cách nguyên tử; `changes=0` → nếu đội đã `rejected` mà còn dòng ảnh thì đi tiếp bước 2 (gọi lại sau lỗi R2, không ghi audit lần hai), ngược lại 404/409 `not_pending`. (2) Xoá R2 ảnh đội; lỗi → 502 `delete_incomplete` (gọi lại endpoint để hoàn tất). (3) `delete from community_team_images where team_id = ?`. Đội bị từ chối không còn ảnh (giống mẫu soi đội bị từ chối) <!-- Validation Session 1; Astra A#6 --> |
| `POST /api/admin/community-seasons` `{id,labelVi,labelZh}` | **root** | `parseSeasonInput`; `DB.batch([update community_seasons set closed_at=? where closed_at is null, insert community_seasons …, auditStmt season.open (meta: {previous})])`; id đã tồn tại → 409 `season_exists` |

Gỡ đội đã duyệt dùng `DELETE /api/community-teams/:id` (phase 2), không thêm route admin riêng.

Audit: `targetType` = `team` / `season`; `targetLabel` = tiêu đề đội (che chuỗi giống email theo helper hiện có) hoặc id mùa; `subjectUserId` = tác giả với `team.*`, `null` với `season.open`.

`COUNTS_SQL` thêm `(select count(*) from community_teams where status = 'pending') as teams_pending`, phản hồi `teamsPending`.

## Tests Before (đỏ trước)
`teams-admin.test.ts`:
- KDV duyệt → đội vào danh sách công khai; 1 dòng audit `team.approve`, `subject_user_id` = tác giả.
- Duyệt lại → 409 `not_pending`, không thêm audit.
- Từ chối thiếu lý do → 400; có lý do → chủ thấy `rejectReason` qua `GET /api/me/community-teams`; R2 `community-teams/<id>/*` bị xoá, `community_team_images` rỗng, `imageCount` = 0.
- `failR2On({op:'delete', nth:1})` khi từ chối → 502, đội đã `rejected`, dòng ảnh còn, đúng 1 audit; gọi lại → 200, ảnh hết, vẫn 1 audit.
- Root mở A rồi B: A có `closed_at`, B mở; trùng id → 409 `season_exists`; KDV → 403; audit `season.open` meta `previous: 'A'`.
- Duyệt và từ chối cùng lúc (`Promise.all`) → một 200, một 409 `not_pending`; nếu duyệt thắng thì ảnh còn nguyên.
- Hai KDV duyệt cùng lúc (`Promise.all`) → một 200, một 409; đúng 1 dòng audit.
- Cùng một KDV gọi duyệt hai lần với đồng hồ harness cố định (cùng mili-giây) → một 200, một 409; đúng 1 dòng audit. Tương tự cho từ chối.

`admin.test.ts`: kỳ vọng `counts` có `teamsPending` đúng số.
`permissions.test.ts`:
- Danh sách khoá `counts` (`:193-199`) thêm `teamsPending`.
- `seed()` thêm một mùa mở và một đội pending của bob.
- `snapshot()` thêm `community_teams`, `community_seasons` (sắp theo `id`), `community_team_votes` (sắp theo `team_id, user_id`), `community_team_images` (sắp theo `team_id, position`): `dump` nhận cột sắp xếp theo từng bảng thay vì `order by id` cố định (`permissions.test.ts:55`). <!-- Astra A#10 -->
- 4 dòng ma trận mới (list/approve/reject: staff; season: root), cập nhật số "22" → "26".
`audit.test.ts`: lọc `?action=team.approve`, `season.open` hợp lệ.

## Refactor
Không đụng route chiến báo.

## Tests After
Toàn bộ test worker xanh.

## Regression gate
`cd community-worker && npm test && npm run typecheck`

## Rủi ro
- Mở mùa nhầm id: không có "mở lại mùa cũ" (ngoài phạm vi); UI phase 6 bắt xác nhận id + nhãn trước khi gửi.

## Bảo mật
- Mở mùa chỉ root (`requireRoot`); duyệt cho staff (`requireStaff`), giống chiến báo.
- Lý do và nhãn qua `parseText` (giới hạn độ dài), không lưu body thô vào audit.

## Todo
- [x] Test `teams-admin.test.ts`, cập nhật `admin`/`permissions`/`audit` test (đỏ)
- [x] Route duyệt/từ chối + audit
- [x] Route mở mùa + audit
- [x] `teamsPending` trong counts
- [x] Regression gate xanh
