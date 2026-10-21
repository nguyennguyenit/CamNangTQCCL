---
phase: 2
title: "API đội: mùa, ảnh + AI, đăng, xem, vote, xoá"
status: completed
priority: P1
effort: "1.5d"
dependencies: [1]
---

# Phase 2 — API đội: mùa, ảnh + AI, đăng, xem, vote, xoá

<!-- Updated: Red Team 2026-10-21 - khoá pending/team- + batch gắn ảnh nguyên tử (#3), xoá R2 trước + audit cùng batch + thứ bậc KDV (#4, #7), import callModel của worker/ (#9), trần AI toàn site (#11), bỏ /similar, gộp DELETE (#15), test 401 ở teams.test.ts + lỗi R2 theo lần gọi (#14) -->

## Mục tiêu
Router `teams.ts` cung cấp API công khai, của tác giả và xoá đội (chủ + staff) cho Đội cộng đồng; mùa, quyền và hiển thị kiểm trong chính câu ghi.

## Bằng chứng
- Mẫu upload + attach: `community-worker/src/routes/reports.ts:90-183` (preflight đọc riêng :151-155, `update uploads` không guard :174 — **không chép nguyên**, xem thiết kế); route ảnh kiểm quyền + ETag: `reports.ts:217-244`.
- `callModel(imageDataUri, opts, mode='analyzeTeamImage')` `worker/src/model.ts:169` (lỗi ném `{status: 422|502}` :157-161), chỉ import `../../shared/ai-config` và `./schema` (`worker/src/model.ts:5-12`). `resolveRoute` + nhóm `teamScan` `shared/ai-config.ts:22,222-232`.
- `RATE_RULES` `src/ratelimit.ts:14-27` (key chưa đăng ký → TypeError), khoá đếm `${action}:${userId}:…` :29-38.
- Thứ bậc KDV khi xoá nội dung: `src/routes/comments.ts:33-37,110-131` (điều kiện trong SQL, audit trước DELETE cùng batch); `src/audit.ts:74-79`.
- Xoá R2 trước, D1 sau, 502 gọi lại được: `src/routes/users.ts:422-445,482`.
- Harness: `r2Error` làm hỏng **mọi** put/delete (`test/fakes.ts:214-223`).

## File
- Tạo: `community-worker/src/routes/teams.ts`
- Tạo: `community-worker/test/teams.test.ts`, `community-worker/test/teams-analyze.test.ts`
- Sửa: `community-worker/src/ratelimit.ts`, `community-worker/src/app.ts`
- Sửa: `community-worker/test/fakes.ts` (lỗi R2 theo lần gọi: `failR2On({op:'put'|'delete', nth})`; hook `h.beforeNextBatch(fn)` chạy SQL ngay trước batch kế tiếp để dựng race; hook sau `getUser` để khoá user giữa chừng; helper seed mùa/đội)
- Sửa: `community-worker/test/visibility.test.ts`

## Thiết kế

### Rate limit mới (`RATE_RULES`)
`team_upload: 30/ngày`, `team_analyze: 20/ngày` (tách khỏi `analyze`), `team_analyze_global: 300/ngày` (gọi với userId `'site'` — trần chung cả site cho chuỗi `teamScan`), `team_post: 5/ngày`, `team_vote: 120/giờ`.

### Endpoint (đều `/api/...`, lỗi `{error:{code,message}}`)
| Method + path | Quyền | Hành vi |
|---|---|---|
| `GET /api/community-seasons` | công khai | `{open, seasons}`; `open` = `{id,labelVi,labelZh,openedAt}` hoặc `null`; `seasons` mới nhất trước |
| `POST /api/community-teams/uploads` | user | `parseImageUpload(req,'image',1_500_000)` → `consumeRateLimit('team_upload')` → R2 `pending/team-<uploadId>` + `uploads(kind='report', status='pending', object_key='pending/team-<uploadId>')`; trả `{uploadId}`. D1 lỗi → xoá R2 |
| `POST /api/community-teams/uploads/:id/analyze` | user, chủ upload | `FEATURE_ENABLED==='false'` → 503 `feature_disabled`; route `teamScan` rỗng → 503 `ai_not_configured`; upload phải là của mình, `pending`, khoá `pending/team-…` (khác → 404); `consumeRateLimit('team_analyze')` rồi `consumeRateLimit('team_analyze_global', 'site')`; `callModel(toDataUri(bytes, type), {route, fetchImpl: c.get('deps').fetchImpl}, 'analyzeTeamImage')`. Ánh xạ lỗi riêng (không dùng `instanceof ModelError` của `reports.ts`): `AiCallError` → `ApiError(e.status, e.code)` như `analyze.ts:146`; lỗi có `status === 422` (không đọc được) → `{read: {screen:'other', sides:[]}}`; `status === 502` (model trả rỗng) → `ApiError(502, 'ai_unavailable')`; lỗi khác → ném (500). Không xoá upload khi AI lỗi <!-- Astra A#9 --> |
| `POST /api/community-teams` | user | Xem "Đăng đội" dưới. 201 `{id, status:'pending'}` |
| `GET /api/community-teams?season&heroes&sort&cursor` | công khai | điều kiện `teamVisibleSql` (dưới); `season` = id, `all`, hoặc bỏ trống (mùa mở; không có mùa → `[]`); `heroes` = mỗi id phải thuộc `(hero_1,hero_2,hero_3)` — với 3 tướng đây chính là "đội tương tự"; keyset `hot_rank` / `top_rank` / `created_at` + `id` qua `paginateByKey`, 20/trang. Item: `id,title,season,heroes,tactics,troop,author{id,name,image},upVotes,downVotes,evidenceCount,points,commentCount,imageCount,textLang,createdAt`; `commentCount` = subquery đếm `comments` có `page_key` = `/doi-cong-dong/<id>/` |
| `GET /api/community-teams/:id` | công khai / chủ / staff | thoả `teamVisibleSql`: ai cũng xem; còn lại (pending, rejected, tác giả bị ẩn) chỉ chủ và staff, khác → 404; `deleting_at` khác null → 404 với mọi người. Thêm `status`, `analysis{playstyle,…}`, `myVote` (−1/0/1), `seasonOpen`, `rejectReason` (chủ/staff), `heroKey`; `author.id` để client so với `/api/me` <!-- Astra A#11 --> |
| `GET /api/community-teams/:id/images/:pos` | như chi tiết | chép `reports.ts:217-244` (404 thay 403, `nosniff`, cache public khi approved, private khi chủ/staff) |
| `PUT /api/community-teams/:id/vote` `{value}` | user | Xem "Vote" dưới |
| `GET /api/me/community-teams` | user | đội của mình, mọi trạng thái, kèm `rejectReason` |
| `DELETE /api/community-teams/:id` `{reason?}` | chủ, root, KDV | Xem "Xoá đội" dưới |

Không có route `/similar`: client gọi danh sách với `heroes=<3 id>&season=all`.

### Đăng đội (nguyên tử)
1. `parseTeamInput`; đọc mùa mở (không có → 409 `season_not_open`); `consumeRateLimit('team_post')`.
2. Preflight: đọc các `uploads` theo `uploadIds` (của user, `pending`, khoá `pending/team-…`); thiếu → 409 `image_missing` (UX, chưa phải chốt an toàn).
3. Chép R2 `pending/team-<uploadId>` → `community-teams/<teamId>/<pos>.<ext>`.
4. Một `DB.batch`:
   - `insert into community_teams (…) select … where (select count(*) from uploads where id in (…) and user_id = ? and status = 'pending' and object_key like 'pending/team-%') = :n and exists (select 1 from community_seasons where id = :season and closed_at is null)`
   - mỗi ảnh: `insert into community_team_images … select … where exists (select 1 from community_teams where id = :teamId)`
   - `delete from uploads where id in (…) and exists (select 1 from community_teams where id = :teamId)`
5. Câu 1 `changes = 0` hoặc batch lỗi → xoá các khoá vừa chép; chẩn đoán: mùa đã đóng → 409 `season_not_open`, còn lại → 409 `image_missing`. Thành công → xoá `pending/team-…`.

Hai request trùng `uploadIds` chạy song song: batch tuần tự hoá trong D1, request sau thấy upload đã bị xoá → không chèn gì → 409, khoá R2 của nó bị dọn.

### Vote
`value ∈ {1,-1}`: `insert into community_team_votes … select ?,?,?,? where exists (select 1 from community_teams t join community_seasons s on s.id = t.season_id join "user" u on u.id = t.author_id where t.id = ? and <teamVisibleSql> and s.closed_at is null and t.author_id <> ?) and exists (select 1 from "user" v where v.id = :voter and <visibleUserSql v>) on conflict (team_id, user_id) do update set value = excluded.value`. Điều kiện người vote còn hiển thị chặn vote "đang bay" ghi lại sau khi batch khoá tài khoản đã xoá vote (user được lưu một lần mỗi request, `context.ts:37-44`). `value = 0`: `delete … where team_id = ? and user_id = ? and exists(<điều kiện đội + mùa>)`. `changes = 0` → chẩn đoán: không thấy → 404; tác giả → 403 `own_team`; mùa đóng → 409 `season_closed`; người vote bị khoá → 401; bỏ vote khi chưa vote → 200. Trả `{upVotes, downVotes, points, myVote}` đọc lại. <!-- Astra A#4 -->

### Điều kiện hiển thị dùng chung (`teams.ts`)
`teamVisibleSql(t, u)` = `t.status = 'approved' and t.deleting_at is null and <visibleUserSql u>` (u = tác giả). Danh sách, chi tiết công khai, ảnh, vote và các helper phase 4 đều dùng hàm này.

### Xoá đội (`deleteTeamCascade`) <!-- Updated: Astra A#2, A#3 - chốt xoá bằng deleting_at trước khi đụng R2 -->
- Quyền: chủ; root; KDV chỉ khi tác giả **không** phải moderator/root (điều kiện `coalesce(u.role,'user') <> 'moderator'` + email không thuộc `ADMIN_EMAILS`, như `comments.ts:33-37`). Staff xoá đội người khác: `reason` 1–500 bắt buộc.
- Chủ tự xoá: bị chặn khi đội đã có chiến báo **đã duyệt** của người khác → 409 `has_evidence`; muốn gỡ thì nhờ staff. <!-- Validation Session 1 -->
1. **Chốt xoá** (một batch): [staff xoá đội người khác: `auditIfStmt` `team.delete` đặt **trước**, cùng điều kiện với câu dưới, `meta` = số bình luận/chiến báo theo từng tác giả], `update community_teams set deleting_at = :now where id = ? and deleting_at is null and <điều kiện quyền> and <chủ tự xoá: not exists chiến báo approved của người khác>`. `changes = 0` → nếu đội đã có `deleting_at` khác null và người gọi có quyền (chủ/staff theo thứ bậc) → **làm tiếp** từ bước 2 (gọi lại sau lỗi, không kiểm lại `has_evidence`, không ghi audit lần hai); ngược lại chẩn đoán 404 / 409 `has_evidence`.
2. Từ lúc chốt, đội biến khỏi mọi đọc/ghi công khai (`teamVisibleSql`), nên không nhận chiến báo/bình luận/vote mới; duyệt chiến báo cũ trên trang vẫn chạy nhưng không ảnh hưởng (sẽ bị xoá ở bước 4).
3. Đọc khoá R2 (ảnh đội + `battle_reports.image_key` trên trang) và xoá R2 theo lô; lỗi → 502 `delete_incomplete` (gọi lại endpoint để làm tiếp).
4. Batch cuối, **mọi câu** có điều kiện `exists (select 1 from community_teams where id = ? and deleting_at is not null)`: `delete from comments where page_key = ?`, `delete from battle_reports where page_key = ? returning image_key`, `delete from uploads where object_key in (<khoá ảnh chiến báo>)`, `delete from community_teams where id = ? and deleting_at is not null`.
5. Khoá trả về từ `returning` mà chưa có ở bước 3 → xoá R2 thêm; lỗi chỉ log kèm khoá.

## Tests Before (đỏ trước)
`teams.test.ts` (dùng `createHarness`, alice/bob/moderator/admin):
- Khách gọi mọi route ghi → 401.
- Không có mùa mở → POST đội 409 `season_not_open`; GET danh sách `[]`.
- Upload: sai MIME 415; quá cỡ 413; 31 lần → 429; khoá R2 là `pending/team-<id>`.
- Đăng: ảnh của người khác / ảnh đã dùng / upload chiến báo (`pending/<id>` không có `team-`) → 409 `image_missing`; thành công → 201, R2 có `community-teams/<id>/0.png`, `pending/team-…` bị xoá, không còn dòng `uploads`; `failR2On({op:'put', nth:2})` khi chép ảnh thứ 2 → không có dòng đội, không còn khoá `community-teams/…`.
- Hai POST cùng `uploadIds` qua `Promise.all` → một 201, một 409; R2 chỉ có ảnh của đội thắng.
- Đóng mùa giữa preflight và batch (đóng mùa trực tiếp bằng SQL sau bước chép) → 409, không có dòng đội.
- Server gán mùa: body gửi `season:'x'` bị bỏ qua.
- Hiển thị: đội pending không có trong danh sách, chi tiết 404 với bob, 200 với alice và moderator; ảnh pending 404 với khách. Chi tiết trả `status` và `author.id`; mở trực tiếp đội approved với bob đã được đổi tên trùng alice (SQL): alice (chủ) nhận `author.id` = id của mình, bob nhận id của alice khác id bob, khách nhận bình thường.
- Danh sách: 3 đội approved điểm khác nhau → thứ tự `hot`, `top`, `new` đúng; lọc 1 và 3 tướng (3 tướng thứ tự khác vẫn khớp); 21 đội → trang 2 không trùng/không sót; `season=<mùa cũ>` và `season=all`.
- Vote: bob 1 → `up_votes 1`; đổi −1; bỏ 0; alice vote đội mình → 403 `own_team`; đội pending → 404; sau khi đóng mùa → 409 `season_closed` cả vote lẫn bỏ vote.
- Vote "đang bay": khoá bob bằng SQL sau khi request đã qua `requireUser` (hook trong `getUser` của harness) → vote không được ghi, `up_votes` không đổi.
- User bị khoá: đội của họ biến khỏi danh sách/chi tiết công khai; vote vào đội đó → 404.
- Xoá: chủ xoá đội chưa có chiến báo duyệt của người khác → bình luận + chiến báo trên trang + ảnh R2 (đội và chiến báo) biến mất; đội có chiến báo **đã duyệt** của bob → chủ xoá 409 `has_evidence`, dữ liệu và R2 còn nguyên; chiến báo pending/rejected của bob không chặn; bob xoá đội alice → 404; moderator xoá đội của admin → 404, của alice (kể cả có bằng chứng) có lý do → 200 + 1 dòng audit `team.delete` có `meta` đếm theo tác giả; moderator thiếu lý do → 400.
- Xoá dở: `failR2On({op:'delete', nth:2})` (ảnh 1 đã xoá) → 502 `delete_incomplete`, đội có `deleting_at`, biến khỏi danh sách/chi tiết, vote mới → 404 (bình luận/chiến báo mới → 404 kiểm ở phase 4); staff duyệt một chiến báo cũ của bob trên trang; chủ gọi lại → 200 (không bị `has_evidence`), mọi dòng và khoá R2 hết, audit không thêm dòng.
- Đổi vai trò giữa chừng: moderator xoá đội alice; `h.beforeNextBatch` nâng alice làm moderator ngay trước batch chốt → 404, không có dòng nào bị xoá, R2 còn nguyên.

`teams-analyze.test.ts`:
- `FEATURE_ENABLED='false'` → 503; nhóm `teamScan` rỗng → 503 `ai_not_configured`; upload của bob gọi bởi alice → 404; upload chiến báo → 404.
- Qua `h.setFetch` (harness): JSON hợp lệ → `read` đúng hợp đồng `sides/heroes/nameCn/tacticsCn`; nội dung không parse được → `{screen:'other', sides:[]}`, upload còn; response rỗng → 502 `ai_unavailable`; upstream 429/5xx → mã từ `AiCallError`; mọi trường hợp upload còn.
- `team_analyze` tách khỏi `analyze`; trần `team_analyze_global` hết → 429 cho user khác.

`visibility.test.ts`: thêm danh sách/chi tiết/ảnh đội của user bị khoá.

## Refactor
Không đổi `reports.ts` ở phase này (phase 4 lo phần loại khoá `pending/team-`). `worker/` chỉ import.

## Tests After
Toàn bộ test worker xanh; `npm run typecheck` chứng minh import `worker/src/model.ts` biên dịch được trong `community-worker`.

## Regression gate
`cd community-worker && npm test && npm run typecheck`

## Rủi ro
- `commentCount` đếm cả bình luận của user đang bị khoá (bị ẩn khi xem): lệch nhỏ, chấp nhận.
- Phân trang theo `hot_rank`/`top_rank` thay đổi khi có vote: đội có thể bị lặp (client khử trùng) hoặc nhảy qua ranh giới cursor giữa hai lần tải trang; chấp nhận ở quy mô hiện tại.
- Xoá đội bước 5: sau khi chốt `deleting_at`, mọi ghi mới vào trang bị chặn (phase 4), nên khoá "chen vào" chỉ có thể là chiến báo đã đi qua kiểm tra trước lúc chốt; lỗi R2 ở bước này chỉ log → object mồ côi rất hiếm.
- `typecheck` kéo `worker/src/model.ts` + `worker/src/schema.ts` vào `tsc` của community-worker: nếu lỗi kiểu do khác cấu hình → **dừng và hỏi** (không sửa `worker/`).

## Bảo mật
- Mọi route ghi qua middleware CSRF origin sẵn có (`app.ts:53-64`) và `requireUser`.
- Không tin `season`, `status`, `author_id` từ client; id đúng định dạng; văn bản lưu thô, client render bằng `textContent`.
- Ảnh: magic bytes + MIME khớp (`parseImageUpload`), `nosniff`; khoá tạm của đội và chiến báo tách nhau.
- Chi phí AI: giới hạn mỗi user + trần toàn site + kill-switch.

## Todo
- [x] Harness `failR2On`, helper seed (đỏ trước các test dưới)
- [x] Test `teams.test.ts`, `teams-analyze.test.ts`, `visibility.test.ts` (đỏ)
- [x] `RATE_RULES` mới
- [x] `routes/teams.ts` + mount trong `app.ts`
- [x] Đăng đội nguyên tử, vote, xoá đội
- [x] Regression gate xanh
