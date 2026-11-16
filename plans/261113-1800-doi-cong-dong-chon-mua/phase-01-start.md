---
title: "Phase 1: Start"
status: todo
priority: P1
effort: "5h"
dependencies: []
---

# Phase 1: Catalog mùa (worker) + migration 0012

## Goal
Worker có danh mục mùa đã xác minh từ site; schema bỏ "đúng một mùa mở"; đội prod chuyển sang id catalog.

## Files
- Create: `community-worker/src/season-catalog.ts`
- Create: `community-worker/migrations/0012_community_season_catalog.sql`
- Create: `community-worker/rollback/0013_restore_community_season_open.sql` (chạy tay; dãy số dùng chung với migrations như 0007/0009/0010)
- Create: `community-worker/test/season-catalog.test.ts`
- Modify: `community-worker/test/teams-schema.test.ts`, `community-worker/test/fakes.ts`

## Hợp đồng catalog
- Chuỗi xác minh giống `loadVerifiedRecommendedManifest` (`js/recommended-reference-state.js:256`), origin catalog = hằng `CATALOG_ORIGIN` riêng trong `season-catalog.ts` (giá trị `siteOrigin(env)`); đường dự phòng chỉ đổi origin catalog, không đụng `SITE_ORIGIN` (Better Auth/CORS):
  `GET /data/recommended/current.json` (`schemaVersion 1`, `generationId`, `manifestSha256`) →
  `<gen>/manifest.json` (sha256 = `manifestSha256`; `schemaVersion 1`, `generationId` khớp, `dedupKeyVersion 1`) →
  `<gen>/seasons.json` (sha256 + bytes = `manifest.files["seasons.json"]`; `schemaVersion` đúng như builder).
  (Fable đề xuất bỏ bước manifest/hash vì cùng origin; giữ theo Astra — không hại, khớp verifier frontend.)
- Id hợp lệ = khớp CHECK D1 (`0008:7`): `^[a-z0-9]` ở ký tự đầu, 1–40 code point, khác `all`, không trùng. `seasonOptions` không rỗng; `defaultSourceSeasonId` thuộc danh sách.
- Kết quả `{ generationId, current: defaultSourceSeasonId, seasons: [{id, code, labelVi, labelZh}] }` theo thứ tự `seasonOptions`. Tên `current` (không phải "latest"): `pk-s28` đứng trước `pk-s27`, mặc định là mùa hiện hành do `pipeline/recommended-default-season.json` chốt.
- Nhãn: `labelVi = "<displayCode> · <displayNameVi ?? nameRaw>"`, `labelZh = "<displayCode> · <nameRaw>"`.
- Một deadline 5 s cho **cả chuỗi** fetch (`AbortSignal.timeout`); HTTP ≠ 200, JSON hỏng, sai hash/schema → lỗi; `console.error` kèm bước lỗi.
- Cache module-level một bản `{ value, fetchedAt }` (origin luôn là `siteOrigin(env)` đầu tiên), TTL 10 phút; refresh đồng thời dùng chung một promise; lỗi **không** ghi đè bản tốt; có bản tốt → trả bản cũ; chưa có bản → `ApiError(503, "season_catalog_unavailable")`, negative-cache 30 s để không dội site.
- `findSeason(c, id)` → `{ season } | { missing } | throw 503`: id có trong bản cache tốt → dùng; không có → bỏ TTL, refresh một lần (single-flight, tối đa 1 lần / 30 s).
  Refresh **thành công** mà vẫn không có → `missing` (route trả 400). Refresh **thất bại** hoặc đang trong negative-cache/cooldown → 503 `season_catalog_unavailable` (không bao giờ 400 khi chưa xác nhận được). Mùa mới có thể trễ tới 30 s trên một isolate — không hứa tức thời.
- `resetSeasonCatalogCache()` export cho test; harness gọi trong `createHarness`.
- Không fallback bundle tĩnh.

## Tasks (TDD: test đỏ trước)
1. `season-catalog.test.ts` (fetch giả qua `deps.fetchImpl`, đồng hồ giả qua `deps.now`): đường đúng; `current` = `defaultSourceSeasonId` **khác** phần tử đầu (fixture: đầu `og-…`, default `pk-s27`); sai hash manifest; sai hash/bytes seasons; sai `generationId`/`schemaVersion`/`dedupKeyVersion`; JSON hỏng; HTTP 500; treo quá deadline; `seasonOptions` rỗng / id trùng / id > 40 / id bắt đầu bằng `-` hoặc chữ hoa / default không thuộc danh sách; trong TTL không fetch; hết TTL refresh sang generation mới; refresh lỗi → bản cũ; chưa có bản + lỗi → 503 và lần gọi trong 30 s không fetch; 2 lời gọi đồng thời → 1 lượt fetch; `findSeason` miss → refresh thấy mùa mới; miss lần 2 trong 30 s không fetch; `displayNameVi` null → `nameRaw`.
2. Cài `season-catalog.ts` theo hợp đồng.
3. Test migration: `fakes.ts` thêm tuỳ chọn chạy migration tới một file (`upTo: "0011"`) và hàm chạy tiếp; seed trạng thái prod trước 0012 (mùa `binh-dien-xuan-thu` **đang mở**, 2 đội, 1 chiến báo `season='binh-dien-xuan-thu'`) → chạy 0012 → đội + chiến báo trỏ `og-兵演春秋`, hàng cũ bị xoá, `pragma foreign_key_check` rỗng, không còn index `community_seasons_one_open_uidx` và cột `closed_at`; insert 2 mùa liên tiếp được.
4. Migration 0012 (thứ tự đã chạy thử trên SQLite 3.53 — Astra):
   ```sql
   drop index community_seasons_one_open_uidx;
   insert into community_seasons (id, label_vi, label_zh, opened_at)
     values ('og-兵演春秋', 'OG · Binh Diễn Xuân Thu', 'OG · 兵演春秋', cast(unixepoch('subsec') * 1000 as integer))
     on conflict (id) do nothing;
   update community_teams set season_id = 'og-兵演春秋' where season_id = 'binh-dien-xuan-thu';
   update battle_reports set season = 'og-兵演春秋' where season = 'binh-dien-xuan-thu';
   delete from community_seasons where id = 'binh-dien-xuan-thu';
   alter table community_seasons drop column closed_at;
   ```
   Chú thích: `opened_at` từ nay = lúc hàng được tạo (upsert lần đầu); nhãn trong bảng chỉ cập nhật khi có bài đăng mới ở mùa đó.
5. Rollback 0013 (cho worker + frontend cũ, vốn chỉ nhận slug `^[a-z0-9][a-z0-9-]{0,39}$`):
   thêm lại `closed_at`; tạo lại `binh-dien-xuan-thu`; remap đội + chiến báo `og-兵演春秋` → `binh-dien-xuan-thu`; xoá hàng `og-兵演春秋`;
   đóng mọi mùa khác (`closed_at = now`); dựng lại unique index. Mùa catalog khác (vd `pk-s5`) đều khớp regex cũ.
   Test: chạy 0012 → đội mùa `pk-s5` → rollback → đúng 1 mùa mở `binh-dien-xuan-thu`, mọi id mùa khớp regex cũ, `foreign_key_check` rỗng; chạy lại SQL 0012 (roll-forward) thành công. Ghi lệnh roll-forward trong chú thích đầu file.
6. `fakes.ts`: `seedSeason(h, id, openedAt?)` bỏ `closedAt`; helper `catalogResponses({ options, defaultId })` dựng 3 response có hash đúng; harness mặc định cài fetch catalog giả chứa các mùa seed.

## Verification
- `cd community-worker && npx vitest run test/season-catalog.test.ts test/teams-schema.test.ts`
- `npm run db:migrate:local` chạy sạch trên D1 cục bộ (chứng minh `drop column` trên engine D1).
