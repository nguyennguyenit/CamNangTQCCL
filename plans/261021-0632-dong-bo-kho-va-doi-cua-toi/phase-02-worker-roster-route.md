---
phase: 2
title: "Worker: bảng roster_records và route /api/roster"
status: done
priority: P1
effort: "2d"
dependencies: [1]
---

# Phase 2: Worker — bảng `roster_records` và route `/api/roster`

## Goal

`community-worker` có `GET/POST /api/roster` đúng hợp đồng đã duyệt ở `docs/roster-sync.md`, với test viết trước.

## Files to Create / Modify

- Create: `community-worker/migrations/0011_roster.sql` (DDL đã duyệt ở phase 1; số theo quy tắc ở phase 1)
- Create: `community-worker/src/routes/roster.ts`
- Create: `community-worker/src/roster-schema.ts` — kiểm `data` theo từng kind (kiểu, độ dài theo byte UTF-8, enum `source.kind`, regex cho `source.key` và mọi id `hero:`/`tactic:`/`book:`), thu gọn payload bản xóa.
- Create: `community-worker/test/roster.test.ts`
- Modify: `community-worker/src/app.ts` (mount `roster` cạnh `recruit`, ~dòng 96)
- Modify: `community-worker/src/ratelimit.ts` (`roster_push: { limit: 600, windowMs: HOUR }`, `roster_pull: { limit: 1200, windowMs: HOUR }`)
- Prerequisite (Astra H8): `community-worker/test/fakes.ts` phải chạy `batch()` không nhường lượt giữa các câu (`runSync`) và trả `meta.changes` đúng cho câu có `returning`, như bước đã lên ở `plans/261021-0628-doi-cong-dong/phase-01-schema-nen-tang.md:34,122-124`. Nếu plan đó đã merge thì dùng lại; nếu chưa, làm **đúng bản sửa đó** thành một commit nền riêng trước phase 2 và báo cho plan kia dùng chung, không viết bản sửa thứ hai. Test rollback, hai batch đồng thời và `returning` của harness phải xanh trước test quota roster.

Không gộp với `recruit.ts`: khác bảng, khác kind, có xóa con theo hộp, cap theo trạng thái sống và kết quả từng bản ghi.

## API

- `GET /api/roster?since=<rev>&kinds=box,owned,season,locked,override` — `kinds` tùy chọn (mặc định tất cả); trả `{records, cursor, more}` như `recruit.ts:111-127`; rate limit `roster_pull`.
- `POST /api/roster` `{expectedUserId, records}` — thân sai cấu trúc → 400; `expectedUserId` khác user của cookie → 409 `user_mismatch`; trả `{results: [{kind, id, outcome, code?, server?}], cursor}` theo hợp đồng phase 1.

## Test Matrix (viết trước, chạy đỏ trước khi viết route)

Dùng `createHarness` (`community-worker/test/fakes.ts`, D1 giả chạy migration thật qua `node:sqlite`), cấu trúc như `community-worker/test/recruit.test.ts`.

| # | Ca | Kỳ vọng |
|---|---|---|
| 1 | GET/POST không đăng nhập; user bị khóa có phiên | 401 `unauthorized` (như `test/moderation.test.ts:116-122`) |
| 2 | Đẩy rồi kéo `since=0` | đúng bản ghi, `cursor` = rev lớn nhất |
| 3 | `?kinds=owned,box` | không trả `team`/`group` |
| 4 | LWW: bản cũ hơn sau bản mới | `outcome: conflict`, kèm `server` |
| 5 | Gửi lại đúng bản đã lưu (mất phản hồi) | `outcome: already-applied`, không cấp rev mới |
| 6 | Cùng `updatedAt`, payload khác | `outcome: conflict`, server giữ bản đang có |
| 7 | Xóa mềm | `deleted = 1`, payload chỉ còn `{id, updatedAt, deletedAt, boxId}`; đẩy lại bản sống cũ hơn → `conflict` |
| 8 | Phân trang 501 bản ghi | trang 1 `more: true`, trang 2 đủ phần còn lại |
| 9 | Cô lập user (kể cả xóa hộp của alice không chạm bản ghi của bob cùng `box_id`) | đúng |
| 10 | `expectedUserId` khác cookie | 409 `user_mismatch`, không ghi gì |
| 11 | Batch có bản `applied`, `conflict`, `rejected` lẫn nhau | mỗi bản đúng `outcome`, bản hợp lệ vẫn được ghi |
| 12 | `updatedAt > now + 5 phút` | `rejected` `clock_skew` |
| 13 | Bản ghi con vào hộp không tồn tại / đã xóa | `rejected` `box_missing` (kiểm trong câu ghi) |
| 14 | Xóa hộp `box-x` hợp lệ | hộp thành bản xóa; mọi bản ghi con `box_id = box-x` của user đó bị xóa hẳn; kết quả không đếm dòng con |
| 15 | Xóa hộp đến muộn (server có hộp sống ở `updatedAt` 200, xóa gửi 100) | `conflict`; **không** bản ghi con nào bị xóa |
| 16 | Xóa `box:main` gửi kèm bản ghi con | `main` bị `rejected`; bản ghi con vẫn ghi bình thường |
| 17 | Tạo hộp + hai nhóm mặc định + đội trong cùng request | tất cả `applied` (hộp xử lý trước) |
| 18 | Xóa hộp + ghi bản ghi con cùng request, cả hai thứ tự trong mảng | bản con `box_missing` |
| 19 | Xóa nhóm `G` có 3 đội sống | nhóm thành bản xóa; 3 đội chuyển sang `${boxId}~ghep-team` với rev mới; máy khác kéo về thấy |
| 20 | Xóa nhóm đến muộn | `conflict`; không đội nào bị chuyển |
| 21 | Ghi đội vào nhóm đã xóa / nhóm của hộp khác | `rejected` `group_missing` |
| 22 | Đổi `boxId` của nhóm/đội đang sống | `rejected` `box_changed` |
| 23 | Nhóm mặc định | xóa bị `rejected` |
| 24 | Quota sống 20 000: bản xóa không tính; hồi sinh khi đầy | hồi sinh `rejected` `quota`; xóa vẫn được |
| 25 | Cap 20 hộp / 50 nhóm / 500 đội: tạo mới, hồi sinh; hai batch đồng thời | không bao giờ vượt cap (cap nằm trong câu ghi) |
| 26 | Trần giữ lại 40 000 khóa; tạo/xóa luân phiên | khóa mới `rejected` `retained_cap`; sửa/xóa khóa cũ vẫn được |
| 27 | Bản xóa cho khóa chưa từng tồn tại | `rejected` `not_found` |
| 28 | Trần byte: `team` 16 384 B qua, 16 385 B → `rejected`; chữ Hán đa byte | đúng theo byte |
| 29 | `source.key` chứa `javascript:` hoặc ký tự ngoài regex | `rejected` |
| 30 | Rate limit push/pull | vượt → 429 |
| 31 | Xóa user (đường xóa tài khoản hiện có) | `roster_records` của user mất theo cascade |

## Tasks & Steps

1. Kiểm prerequisite harness (H8) đã có. Viết `0011_roster.sql`; viết `roster.test.ts`; `cd community-worker && npx vitest run test/roster.test.ts` → đỏ.
2. Viết `roster-schema.ts` và `roster.ts`: parse thân, kiểm `expectedUserId`, kiểm từng bản ghi, sắp bản ghi `box` lên trước, dựng một `db.batch` gồm: câu ghi có điều kiện (LWW, hộp sống, nhóm sống, `box_id` bất biến, cap sống và trần giữ lại trong `where`); câu xóa con / chuyển đội chỉ chạy khi bản xóa hộp/nhóm tương ứng đã được ghi (`exists … deleted = 1 and updated_at = ?`); câu đọc lại bản đang lưu cho từng khóa để suy `outcome` (`applied` / `already-applied` / `conflict`). `outcome` tính theo từng bản ghi gửi lên, không cộng `meta.changes` của câu xóa con.
3. Mount route, thêm rule rate limit; chạy đến xanh.

## Verification

- `cd community-worker && npx vitest run` (mọi test, kể cả `recruit.test.ts`) xanh.
- `cd community-worker && npx tsc --noEmit` sạch.
- `cd community-worker && npm run db:migrate:local` áp dụng `0011_roster.sql` không lỗi (kể cả khi `0008` của Đội cộng đồng có hoặc chưa có).
