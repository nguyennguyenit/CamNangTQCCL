---
phase: 2
title: "Worker: endpoint export công khai + dispatch site-publish"
status: pending
priority: P1
effort: "5h"
dependencies: []
---

# Phase 2 — Worker: endpoint export công khai + dispatch `site-publish`

## Mục tiêu
Một request `GET /api/community-teams/export` trả **mọi** đội hiển thị công khai (mọi mùa) kèm `analysis` cho build Astro; Worker gửi `repository_dispatch` `site-publish` đúng ở 5 điểm đổi hiển thị; workflow Pages nhận `site-publish` và có lịch chạy hằng ngày.

## Bằng chứng
- Điều kiện hiển thị: `teamVisibleSql` `community-worker/src/routes/teams.ts:31-33` (approved, chưa `deleting_at`, `visibleUserSql`); `visibleUserSql` `community-worker/src/moderation.ts:34-36` (ban tự hết hạn theo `now`, user không đang xoá). Không xét mùa.
- `TEAM_SELECT`/`TEAM_FROM` `teams.ts:102-111` (bind `now` đầu tiên), không có `reviewed_at`; `toItem` `:113-132` (có `author.image`, không có `analysis`); `analysis` chỉ dựng trong `GET :id` `:424-431`.
- List `:342-377` (thiếu `season` → chỉ mùa mở `:349-354`; keyset theo cột sort `:366-371`); `GET /api/me/community-teams` `:379-405`; `GET /api/community-teams/:id` đăng ký ở `:407`, `teamIdParam` `:134-138` nhận mọi chuỗi khớp `COMMUNITY_TEAM_PAGE_RE` `community-worker/src/validate.ts:8` (`[a-z0-9][a-z0-9-]{0,63}`) → chữ `export` **khớp** regex id, nên route export phải đăng ký trước `:407` (Hono chạy handler theo thứ tự đăng ký).
- `reviewed_at` có trong schema `community-worker/migrations/0008_community_teams.sql:36`, chỉ set khi duyệt/từ chối `teams.ts:713-714`; `seedTeam` của harness không set (`community-worker/test/fakes.ts:402-422`) → export dùng `coalesce(reviewed_at, created_at)`.
- Middleware đặt `Cache-Control: no-store` khi route không tự đặt: `community-worker/src/app.ts:64`; `teams` mount ở `app.ts:100`.
- Dispatch hiện có: `DeployResult`, `DEPLOY_EVENT_TYPE = "blog-publish"`, `triggerDeploy` `community-worker/src/routes/posts.ts:126-160` (lỗi chỉ báo trong kết quả, không rollback DB); `deployMeta` `:186-189`, `settle` `:191-198`; dùng ở `:281-282`, `:304-305`, `:330-331`. `settleDeploy` `community-worker/src/audit.ts:89-100` (thay `meta` bằng `{...meta, deploy}`; lỗi → `status = 'partial'`). `AuditEntry.id` tuỳ chọn `audit.ts:19-20`; `rowValues` ném lỗi khi actor là `user` `audit.ts:35` → chủ tự xoá đội không có dòng audit.
- 5 điểm đổi hiển thị (debate agent://Proponent, agent://Skeptic: không có đường thứ bảy ngoài 5 điểm này + ban hết hạn):
  1. Duyệt: route `teams.ts:731-736`; `reviewTeam` `:686-729` trả `true` khi chính request chuyển `pending → approved` (`:716`), với approve không có nhánh retry (`:724-725` chỉ cho rejected).
  2. Xoá đội pha 1: `update … set deleting_at` `teams.ts:587-590`, chốt bằng `committed.meta.changes` `:592`; nhánh gọi lại `:592-603` (changes = 0); audit chỉ khi staff `:569-586`.
  3. Ban: `community-worker/src/routes/users.ts:221-283`; `auditId` `:249`, batch `:251-276`, thất bại `:277-281`.
  4. Unban: `users.ts:285-328`; batch `:300-319` (audit chưa có `id`), thất bại `:320-326`.
  5. Xoá user pha 1: `users.ts:404-428` (chỉ khi `target.deleting_at === null`), `auditId` `:410`, batch `:411-421`, thua race `:422-427`; lần gọi lại bỏ qua khối này.
  Không dispatch: reject `teams.ts:738-765` (pending vốn ẩn), đóng/mở mùa `:767-793` (export dùng mọi mùa), đổi vai trò `users.ts:330-364`, lần gọi lại xoá.
- Workflow: `.github/workflows/pages-deploy.yml:1-3` (comment), `:8-10` (`repository_dispatch: types: [blog-publish]` + `workflow_dispatch`), `:16-18` concurrency cancel-in-progress, `:26` `COMMUNITY_API_ORIGIN`, `:46` `npm run verify`. Comment `community-worker/wrangler.jsonc:43` nhắc `blog-publish`.
- Harness: `createHarness` `community-worker/test/fakes.ts:226`, `fetchCalls` `:203`, `setFetch` `:220`, `GITHUB_DISPATCH_TOKEN`/`GITHUB_REPOSITORY` `:360-361`, `failR2On` `:215`, `seedSeason` `:379`, `seedTeam` `:402`; mẫu kiểm dispatch `community-worker/test/posts.test.ts:43-56` (đang khẳng định `event_type: "blog-publish"` ở `:56`); mẫu duyệt `community-worker/test/teams-admin.test.ts:15-22`.
- Độ dài văn bản: `playstyle` 10–3000, năm trường phân tích 1–2000 (`docs/community-worker.md:316`), `title` 1–80.

## File
- Tạo: `community-worker/src/deploy.ts` — chuyển nguyên `DeployResult`, `DEPLOY_EVENT_TYPE`, `triggerDeploy`, `deployMeta`, `settle` từ `posts.ts:126-160,186-198`; đổi `DEPLOY_EVENT_TYPE` thành `"site-publish"`.
- Sửa: `community-worker/src/routes/posts.ts` (xoá phần đã chuyển, import từ `../deploy`)
- Sửa: `community-worker/src/routes/teams.ts` (thêm `t.reviewed_at` vào `TEAM_SELECT` + `TeamRow`; helper `analysisOf(row)` dùng chung cho `GET :id` và export; route export; dispatch ở approve và xoá đội pha 1)
- Sửa: `community-worker/src/routes/users.ts` (dispatch ở ban, unban, xoá user pha 1)
- Sửa: `.github/workflows/pages-deploy.yml` (`types: [site-publish]`, thêm `schedule`, sửa comment `:1-3`)
- Sửa: `community-worker/wrangler.jsonc:43` (comment `site-publish`)
- Tạo test: `community-worker/test/teams-export.test.ts`, `community-worker/test/site-publish.test.ts`
- Sửa test: `community-worker/test/posts.test.ts:56` (`site-publish`)

## Thiết kế

### Hợp đồng `GET /api/community-teams/export` (schema v1 — Phase 3 dựa vào đây)
- Công khai, không cần phiên; không rate limit (cùng dữ liệu list công khai đã cho đi hết qua cursor).
- Đăng ký trên `teams` **ngay sau** list (`teams.ts:377`), trước `GET /api/me/community-teams` và trước `:id` (`:407`).
- Truy vấn: `${TEAM_SELECT}${TEAM_FROM} where ${teamVisibleSql("t","u")} order by t.created_at desc, t.id desc`, bind `[now, now]` (cột `author_visible` + điều kiện where). Không `limit`, không cursor, không lọc mùa.
- Header: không tự đặt → `Cache-Control: no-store` (`app.ts:64`); `Content-Type: application/json`.
- Body:

```json
{
  "schemaVersion": 1,
  "items": [
    {
      "id": "3f2c…",
      "title": "Thục kỵ khống chế",
      "season": { "id": "binh-dien-xuan-thu", "labelVi": "…", "labelZh": "…" },
      "heroes": ["hero:a", "hero:b", "hero:c"],
      "tactics": [["tactic:1", "tactic:2"], ["tactic:3", "tactic:4"], ["tactic:5", "tactic:6"]],
      "troop": "ky",
      "author": { "id": "u-…", "name": "Gia Cát" },
      "upVotes": 3, "downVotes": 1, "evidenceCount": 2, "points": 6, "commentCount": 4,
      "imageCount": 1,
      "textLang": "vi",
      "createdAt": "2026-10-22T11:30:00.000Z",
      "analysis": {
        "playstyle": "…", "strengths": "…", "weaknesses": null,
        "counters": null, "counteredBy": null, "substitutes": null
      },
      "approvedAt": "2026-10-22T12:00:00.000Z"
    }
  ]
}
```

| Trường | Kiểu | Ràng buộc / nguồn |
|---|---|---|
| `schemaVersion` | `1` | hằng; loader từ chối giá trị khác |
| `items` | mảng | thứ tự ổn định `created_at desc, id desc`; id duy nhất |
| `id` | string | `^[a-z0-9][a-z0-9-]{0,63}$` (`validate.ts:8`) |
| `title` | string | 1–80 |
| `season` | `{id, labelVi, labelZh}` string | như `toItem` `teams.ts:118` |
| `heroes` | string[3] | `hero:<slug>`, như `toItem` `:119` |
| `tactics` | string[3][2] | `tactic:<slug>`, như `:120` |
| `troop` | enum | một trong `cung`, `khiGioi`, `ky`, `thuan`, `thuong` (`0008_community_teams.sql:26`) |
| `author` | `{id, name}` | **bỏ `image`** so với `toItem` `:122` |
| `upVotes`, `downVotes`, `evidenceCount`, `points`, `commentCount` | int | snapshot lúc export (giữ đúng `toItem`); site **không render** |
| `imageCount` | int 0–3 | như `:128` |
| `textLang` | enum | `vi` hoặc `zh`, như `:129` |
| `createdAt` | ISO 8601 UTC | `iso(created_at)` |
| `analysis` | object 6 khoá | `playstyle` string; 5 khoá còn lại string \| null; dựng bằng `analysisOf(row)` (cùng hàm với `GET :id`) |
| `approvedAt` | ISO 8601 UTC | `iso(reviewed_at ?? created_at)` |

Không bao giờ có: `author.image`, email, `status`, `rejectReason`, `reviewedBy`, `deleting`, `heroKey`, `myVote`, `seasonOpen`, URL/khoá ảnh R2. Kích thước: không phân trang; trần lý thuyết ≈ 13 KB/đội (80 + 3000 + 5×2000 ký tự) → xem ngưỡng xem lại ở plan.md "Rủi ro còn lại".

### Dispatch `site-publish`
- `src/deploy.ts`: `triggerDeploy(env, fetchImpl)` y nguyên, body `{event_type: "site-publish"}`; `settle(c, auditId, meta, deploy)` y nguyên (nuốt lỗi, log).
- Gọi **sau** khi batch D1 chốt thành công, `await` inline như `posts.ts:281`; kết quả trả trong JSON phản hồi dưới khoá `deploy` (admin UI bỏ qua; nhật ký đã hiện `meta.deploy` qua `js/community-admin-users.js:99`).

| Điểm | Điều kiện gửi | Audit `meta.deploy` |
|---|---|---|
| Approve `teams.ts:731` | `reviewTeam` trả `true` | `reviewTeam(c, viewer, id, status, reason, auditId?)`: khi approve truyền `auditId = newId()`, entry `{id: auditId, meta: deployMeta({}, true)}`; sau dispatch `settle(c, auditId, {}, deploy)`. Reject không truyền `auditId`, không đổi. |
| Xoá đội pha 1 `teams.ts:587-592` | `committed.meta.changes > 0` (trước bước R2) | Staff: entry `team.delete` thêm `id: auditId`, `meta: deployMeta({byAuthor}, true)` → `settle(…, {byAuthor}, deploy)`. Chủ đội: không có audit → chỉ gửi, `console.error` khi `!deploy.ok`. Nhánh gọi lại (`changes = 0`) không gửi. |
| Ban `users.ts:276-282` | sau khi qua kiểm `:277` | `meta: deployMeta({duration, until, votesRemoved}, true)` → `settle(c, auditId, {duration, until, votesRemoved}, deploy)` |
| Unban `users.ts:319-327` | sau khi qua kiểm `:320` | entry thêm `id: auditId = newId()`, `meta: deployMeta({previousUntil, previousByRole, previousReason}, true)` → `settle` |
| Xoá user pha 1 `users.ts:411-427` | `res.meta.changes && logged.meta.changes` (không phải nhánh thua race, không phải lần gọi lại) | entry `user.delete.start` thêm `meta: deployMeta({}, true)` → `settle(c, auditId, {}, deploy)`; gửi trước `inventoryKeys` `:430` |

Dispatch lỗi (`deploy_hook_failed|unreachable|not_configured`) không đổi status HTTP, không rollback D1; audit thành `partial` với `meta.deploy = {ok:false, status}`.

### Workflow
```yaml
on:
  repository_dispatch:
    types: [site-publish]
  workflow_dispatch:
  # Lưới an toàn best-effort: ban tự hết hạn không có event, dispatch có thể lỗi.
  schedule:
    - cron: "17 20 * * *"   # 03:17 giờ Việt Nam
```
Concurrency `pages-deploy` + cancel-in-progress giữ nguyên (`:16-18`). Comment `:1-3` mô tả `site-publish` (bài viết + đội cộng đồng + lịch).

## Test-first matrix

| # | Ca | File | Kỳ vọng |
|---|---|---|---|
| E1 | Lọc hiển thị | `teams-export.test.ts` | Seed: t1 approved; t2 pending; t3 rejected; t4 approved + `deleting_at`; t5 approved của user ban còn hạn; t6 approved của user ban **đã hết hạn** (`banned_until <= now`); t7 approved của user `deleting_at`; t8 approved ở mùa **đã đóng** → `items.map(id)` = đúng {t1, t6, t8} |
| E2 | Không lộ trường riêng | như trên | `Object.keys(item).sort()` bằng đúng danh sách bảng schema; `Object.keys(item.author)` = `["id","name"]` (tác giả `bob` có `image` ở `fakes.ts:133`); body thô không chứa các chuỗi `"image":`, `rejectReason`, `email`, `img.test`, `object_key`, `community-teams/` (khoá R2 `community-teams/<id>/<i>.png` của `seedTeam`) |
| E3 | `analysis` + `approvedAt` | như trên | đội duyệt qua route có `approvedAt` = ISO của `reviewed_at`; đội seed (reviewed_at null) có `approvedAt === createdAt`; `analysis` đủ 6 khoá |
| E4 | Thứ tự | như trên | hai đội cùng `created_at` xếp theo `id desc`; còn lại `created_at desc` |
| E5 | Không bị `:id` nuốt | như trên | `GET /api/community-teams/export` 200 có `schemaVersion: 1` (trước khi sửa: 404 `not_found`); `GET /api/community-teams/t1` vẫn 200; `Cache-Control: no-store`; khách không phiên gọi được |
| E6 | Rỗng | như trên | không có đội → `{schemaVersion:1, items:[]}` |
| D1 | Approve | `site-publish.test.ts` | `fetchCalls.length === 1`, body `{event_type:"site-publish"}`; audit `team.approve` `status ok`, `meta.deploy === "ok"`; approve lần hai → 409, không thêm fetch |
| D2 | Reject | như trên | reject → 0 fetch; reject gọi lại sau `failR2On({op:"delete", nth:1})` → 0 fetch |
| D3 | Xoá đội | như trên | chủ xoá → 1 fetch; staff xoá → 1 fetch + audit `team.delete` có `meta.byAuthor` và `deploy: "ok"`; R2 lỗi → 502 nhưng đã 1 fetch, gọi lại → 200 và **không** thêm fetch; chủ gặp `has_evidence` 409 → 0 fetch |
| D4 | Ban/unban | như trên | ban → 1 fetch, meta giữ `duration/until/votesRemoved` + `deploy`; ban bị từ chối (KDV khoá root) → 0; unban → 1; unban `not_banned` 409 → 0 |
| D5 | Xoá user | như trên | pha 1 → 1 fetch, audit `user.delete.start` `meta.deploy === "ok"`; R2 lỗi 502 rồi gọi lại → không thêm fetch |
| D6 | Không dispatch | như trên | đổi vai trò, mở mùa (`POST /api/admin/community-seasons`) → 0 fetch |
| D7 | Dispatch lỗi | như trên | `h.setFetch(() => new Response("x",{status:500}))` → approve 200, đội `approved`, audit `status = "partial"`, `meta.deploy = {ok:false,status:500}`; `setFetch` ném lỗi → `deploy.error === "deploy_hook_unreachable"`; `createHarness({GITHUB_DISPATCH_TOKEN: ""})` → `deploy_hook_not_configured`, 0 fetch |
| D8 | Blog | `posts.test.ts:56` | đổi kỳ vọng thành `site-publish` (đỏ trước khi đổi hằng số) |

## Các bước
1. Viết `teams-export.test.ts` (E1–E6), `site-publish.test.ts` (D1–D7), sửa `posts.test.ts:56` (D8). `cd community-worker && npm test` → đỏ đúng các ca mới.
2. Tạo `src/deploy.ts`, chuyển code từ `posts.ts:126-160,186-198`, đổi hằng số; `posts.ts` import lại. `npm test -- posts` xanh.
3. `teams.ts`: thêm `t.reviewed_at` vào `TEAM_SELECT` (`:103-104`) và `reviewed_at: number | null` vào `TeamRow` (`:64-99`); tách `analysisOf(row)` từ `:424-431`; thêm route export sau `:377`.
4. `teams.ts`: approve + `reviewTeam` nhận `auditId` (`:686-736`); xoá đội pha 1 (`:568-592`).
5. `users.ts`: ban (`:249-282`), unban (`:300-327`), xoá user pha 1 (`:410-427`).
6. `pages-deploy.yml` (`:1-3`, `:8-10` + `schedule`), `wrangler.jsonc:43`.
7. `npm test && npm run typecheck` xanh.

## Verification
```bash
cd community-worker && npm test && npm run typecheck
```
- `grep -n "site-publish" community-worker/src/deploy.ts .github/workflows/pages-deploy.yml community-worker/wrangler.jsonc` → có ở cả 3; `grep -rn "blog-publish" community-worker/src community-worker/test .github` → 0 dòng.
- `grep -n "community-teams/export\|community-teams/:id\"" community-worker/src/routes/teams.ts` → dòng export nhỏ hơn dòng `:id`.

## Rủi ro
- Cửa sổ giữa deploy Worker (gửi `site-publish`) và merge `main` (workflow còn `blog-publish`): GitHub bỏ qua event không khớp → bù bằng `gh workflow run` cuối Phase 4.
- Ban/unban/xoá user của người không có đội approved vẫn kích hoạt build (đã xác nhận ở Validation Log 2026-10-22: luôn dispatch).
- Export không rate limit: chi phí D1 tỉ lệ số đội hiển thị; cùng dữ liệu đã lấy được qua list.

## Rollback
`npx wrangler rollback` (Worker cũ không có export, gửi `blog-publish`); làm **sau** khi revert `main` (Phase 4). Không đổi schema D1.

## Checklist
- [x] Test E1–E6, D1–D8 đỏ
- [x] `src/deploy.ts` + `posts.ts` dùng lại
- [x] Export: `reviewed_at`, `analysisOf`, route trước `:id`
- [x] Dispatch 5 điểm + audit `meta.deploy`
- [x] Workflow `types` + `schedule`, comment wrangler
- [x] `npm test && npm run typecheck` xanh
