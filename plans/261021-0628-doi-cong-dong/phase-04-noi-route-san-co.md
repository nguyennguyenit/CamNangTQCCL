---
phase: 4
title: "Nối chiến báo, bình luận, xoá tài khoản"
status: completed
priority: P1
effort: "1d"
dependencies: [3]
---

# Phase 4 — Nối chiến báo, bình luận, xoá tài khoản

<!-- Updated: Red Team 2026-10-21 - guard cả câu update uploads + kiểm mùa trước rate limit (#6), GET cũng kiểm đội hiển thị (#13), điều kiện hiển thị nằm trong câu insert (#6), inventoryKeys đọc community_team_images (#3), loại khoá pending/team- khỏi chiến báo (#3) -->

## Mục tiêu
Chiến báo và bình luận chạy trên trang đội cộng đồng với luật mùa, luật hiển thị và kho chung vi/zh; xoá tài khoản dọn sạch đội, ảnh và nội dung trên trang đội.

## Bằng chứng
- Tạo chiến báo: `community-worker/src/routes/reports.ts:137-183` (`season` từ client :147; rate limit :160 trước khi ghi; batch [insert, `update uploads … where id = ?` không guard] :166-175; bù trừ chỉ trong `catch` :176-180; xoá `pending/` :181). Chọn upload :151-155 (`kind='report' and status='pending'`).
- `GET /api/reports` lọc `lang` :186-193; stats :197-206; không kiểm trang tồn tại.
- Bình luận: `src/routes/comments.ts:52-70` (lọc `lang`), `:72-98` (insert không điều kiện).
- Xoá tài khoản: `src/routes/users.ts:363-377` (`inventoryKeys`), R2 trước :422-445, lô cuối :482; test chốt khoá `test/users.test.ts:560-663`.
- Client chưa bao giờ gửi `season` cho chiến báo → `battle_reports.season` luôn NULL hiện nay.

## File
- Sửa: `community-worker/src/routes/reports.ts`, `community-worker/src/routes/comments.ts`, `community-worker/src/routes/users.ts`, `community-worker/src/routes/teams.ts` (helper dùng chung)
- Sửa: `community-worker/test/reports.test.ts`, `community-worker/test/comments.test.ts`, `community-worker/test/users.test.ts`, `community-worker/test/visibility.test.ts`

## Thiết kế

### Helper dùng chung (`teams.ts`)
- `communityTeamVisibleSql` — đoạn `exists (select 1 from community_teams t join "user" u on u.id = t.author_id where t.id = ? and <teamVisibleSql(t,u)>)` (dùng `teamVisibleSql` của phase 2: approved, `deleting_at is null`, tác giả hiển thị); biến thể `…OpenSql` thêm `join community_seasons s … and s.closed_at is null`.
- `diagnoseCommunityTeam(db, id, now)` → `'missing' | 'closed' | 'ok'` (dùng để chọn mã lỗi sau khi câu ghi không đổi dòng nào, và cho preflight).

### Chiến báo (`reports.ts`)
- Mọi trang: câu chọn upload thêm `and object_key not like 'pending/team-%'` (ảnh đội không dùng làm chiến báo được).
- `POST` trang cộng đồng:
  1. Preflight `diagnoseCommunityTeam` **trước** `consumeRateLimit('report')`: missing → 404 `not_found`; closed → 409 `season_closed`.
  2. `season` lưu = `team.season_id` (bỏ giá trị client). Trang khác giữ hành vi cũ.
  3. Batch: `insert into battle_reports … select … where <communityTeamVisibleOpenSql>`; `update uploads set status='attached', object_key=? where id=? and exists (select 1 from battle_reports where id = ?)`.
  4. Câu insert `changes = 0` → xoá khoá R2 mới vừa ghi, **giữ** `pending/<uploadId>` và dòng upload `pending`; chẩn đoán lại → 404/409.
- `GET /api/reports?page=<cộng đồng>` và `GET /api/reports/stats?page=<cộng đồng>`: đội không hiển thị → `[]`/thống kê rỗng (không lộ tồn tại); hiển thị → bỏ lọc `r.lang = ?` (vẫn nhận `lang`).
- `GET /api/reports/:id/image`: câu đọc thêm `r.page_key`; với trang cộng đồng, "công khai" = chiến báo approved + người gửi hiển thị **+ đội cha thoả `communityTeamVisibleSql`**; không công khai → chỉ người gửi và staff xem (giữ chính sách hiện tại `reports.ts:217-230`), khác → 404; phân quyền xong mới xét ETag. <!-- Astra A#5 -->
- Duyệt/từ chối không đổi; trigger phase 1 tự cập nhật `evidence_count`.

### Bình luận (`comments.ts`)
- `GET` trang cộng đồng: đội không hiển thị → `[]`; hiển thị → bỏ lọc `lang`, item vẫn có `lang`.
- `POST` trang cộng đồng: `insert into comments … select … where <communityTeamVisibleSql>` (không kiểm mùa); `changes = 0` → 404.

### Xoá tài khoản (`users.ts`)
- `inventoryKeys` thêm:
  - `select i.object_key from community_team_images i join community_teams t on t.id = i.team_id where t.author_id = ?`
  - `select r.image_key from battle_reports r where r.page_key in (select '/doi-cong-dong/' || id || '/' from community_teams where author_id = ?) and r.image_key is not null` (ảnh chiến báo của người khác trên trang đội của user).
- Lô cuối, **trước** `delete from "user"`: `delete from comments where page_key in (<trang đội của user>)`, `delete from battle_reports where page_key in (<…>)`, `delete from uploads where object_key in (<ảnh chiến báo vừa liệt kê>)`, `update community_teams set reviewed_by = null where reviewed_by = ?`. Đội, ảnh, vote cascade qua FK; trigger vote tự đếm lại đội người khác mà user từng vote.
- Meta audit `user.delete` thêm `teams`.

### Khoá tài khoản (`users.ts`, `POST /api/admin/users/:id/ban`) <!-- Updated: Validation Session 1 - khoá user xoá vote -->
- Thêm `delete from community_team_votes where user_id = ?` vào **cùng** batch khoá hiện có, có điều kiện như các câu khác của batch đó (chỉ chạy khi dòng khoá được ghi). Trigger vote đếm lại; mở khoá không khôi phục vote. Meta audit `user.ban` thêm `votesRemoved`.

## Tests Before (đỏ trước)
- `reports.test.ts`:
  - Đội cộng đồng approved mùa mở → 201, `season` = mùa đội dù client gửi khác.
  - Đội pending → 404; mùa đóng → 409 `season_closed`; trong cả hai: dòng `uploads` vẫn `pending`, `pending/<id>` còn, không có khoá `reports/…` mới, bộ đếm rate limit `report` không tăng; gửi lại cùng `uploadId` vào đội chuẩn → 201.
  - Đóng mùa giữa preflight và batch (SQL trực tiếp) → 409, upload vẫn `pending`.
  - Upload `pending/team-…` gửi làm chiến báo → 400 `invalid_upload` (mã hiện có).
  - Danh sách + stats trang cộng đồng trả cả `vi` lẫn `zh`; đội pending → `[]`; đội chuẩn vẫn lọc `lang`.
  - Duyệt chiến báo thắng của bob → `evidence_count` 1; chiến báo của tác giả → không đổi.
- `comments.test.ts`: bình luận đội mùa đóng → 201; đội pending → 404; GET hai ngôn ngữ; GET đội pending → `[]`; đội chuẩn vẫn lọc `lang`.
- `users.test.ts`: xoá alice (đội có 2 ảnh, chiến báo của bob kèm ảnh, bình luận của bob) → R2 xoá đúng tập khoá (cập nhật danh sách chốt `deleted.sort()`); không còn dòng đội/ảnh/vote/chiến báo/bình luận trên trang; vote của alice trên đội bob biến mất, `up_votes` đội bob giảm; lỗi R2 rồi gọi lại vẫn hoàn tất. Khoá bob (đã vote 2 đội) → 2 vote biến mất, `up_votes` giảm, audit `user.ban` có `votesRemoved: 2`; khoá bị từ chối (KDV khoá root) → vote còn; mở khoá → vote không quay lại.
- `visibility.test.ts`: tác giả đội bị khoá → POST bình luận/chiến báo 404, GET `[]`; ảnh chiến báo approved của bob trên đội đó → khách GET và GET có `If-None-Match` đều 404, bob và staff vẫn 200. Đội đã chốt xoá (`deleting_at`) → POST bình luận/chiến báo 404, GET `[]`, ảnh chiến báo 404 với khách. <!-- Astra A#5, A#3 -->

## Refactor
Helper hiển thị đặt trong `teams.ts`, `reports.ts`/`comments.ts` import; không đổi chữ ký route.

## Tests After
Toàn bộ test worker xanh; test đội chuẩn (chiến báo, bình luận) không đổi kỳ vọng.

## Regression gate
`cd community-worker && npm test && npm run typecheck`

## Rủi ro
- Đổi `reports.ts` theo nhánh page: khoá hành vi đội chuẩn bằng test hiện có + test mới ở trên.
- Xoá tài khoản là luồng nhiều bước có thử lại: thêm câu xoá vào **cùng** lô cuối hiện có, không tạo lô mới.

## Bảo mật
- Không ai đọc/ghi chiến báo, bình luận của đội chưa duyệt hoặc bị ẩn; cùng 404/`[]` để không lộ trạng thái.
- Điều kiện hiển thị nằm trong câu ghi → không race với khoá tài khoản/gỡ đội.

## Todo
- [x] Test reports/comments/users/visibility (đỏ)
- [x] Helper hiển thị trong `teams.ts`
- [x] `reports.ts` nhánh cộng đồng + loại khoá `pending/team-`
- [x] `comments.ts` nhánh cộng đồng
- [x] `users.ts` xoá tài khoản
- [x] Regression gate xanh
