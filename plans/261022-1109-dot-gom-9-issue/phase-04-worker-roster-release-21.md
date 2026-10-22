---
phase: 4
title: "Worker /api/roster và release worker (#21)"
status: in-progress
priority: P1
effort: "0.5d"
dependencies: [1]
---

# Phase 4: Worker `/api/roster` và release worker (#21)

## Goal

Phần backend của #21/#23 (đã code trong snapshot phase 1) lên `main` thành một PR riêng, rồi D1 `0011` + community-worker deploy **một lần** ngay sau khi merge, có bằng chứng kiểm thật trên production. Từ đó các PR client (phase 10) mới được vào `main`.

## Bối cảnh

- Backend trong snapshot: `community-worker/migrations/0011_roster.sql`, `community-worker/src/roster-schema.ts`, `community-worker/src/routes/roster.ts`, sửa `community-worker/src/app.ts`, `community-worker/src/ratelimit.ts`, test `community-worker/test/roster.test.ts`; docs `docs/roster-sync.md` (hợp đồng đã duyệt), phần `roster_records` trong `docs/community-worker.md`.
- Không file nào trong số này bị ghim bản dịch hay nằm trong `semanticFiles` của MCP, nên PR merge không cần publish lại.
- Route chỉ thêm vào; client hiện tại trên production không gọi `/api/roster`, nên deploy worker sớm không đổi hành vi site.
- Server kiểm id binh thư bằng regex hình dạng (`community-worker/src/roster-schema.ts:35`), không suy từ tên, nên không phụ thuộc phase 5.
- CI không chạy community-worker (`.github/workflows/mcp-worker.yml` không có `community-worker/**`; `mcp-worker/scripts/check-repository.ts:21-82` không có bước này). Cổng kiểm dưới đây là bằng chứng duy nhất.
- `0008` đã áp trên production (`docs/deployment.md:35`); `0009`/`0010` là script trong `community-worker/rollback/`, không phải migration; `0011` là số kế tiếp.
- Plan gốc đã sửa thứ tự rollout: `plans/261021-0632-dong-bo-kho-va-doi-cua-toi/phase-07-rollout-docs.md` mục "Rollout order", lần 1.

## Files to Create / Modify

Nhánh mới `feat/roster-worker` từ `main`, lấy từ commit snapshot của phase 1 (`git checkout <snapshot> -- <path>`):

- Create: `community-worker/migrations/0011_roster.sql`, `community-worker/src/roster-schema.ts`, `community-worker/src/routes/roster.ts`, `community-worker/test/roster.test.ts`, `docs/roster-sync.md`.
- Modify: `community-worker/src/app.ts`, `community-worker/src/ratelimit.ts`, `docs/community-worker.md` (chỉ phần route/bảng/rate limit/test và rollout lần 1).
- Modify: `docs/deployment.md` — mục "Latest Community Worker Deploy" sau khi deploy.
- Không lấy bất kỳ file `js/`, `src/`, `css/`, `data/`, `pipeline/` nào.

## Tests

<!-- Updated: Red Team 2026-10-22 - ca 401/rate limit/batch đã có sẵn, không phải "đỏ trước"; giới hạn D1 thành điều kiện chặn -->

Các ca chính đã có trong snapshot và phải xanh trên nhánh này (không phải test mới): `community-worker/test/roster.test.ts:154` (chưa đăng nhập → 401), `:604` (rate limit theo người dùng), `:631` (M2: batch lớn nhất dưới trần câu D1), `:697-704` (`ROSTER_MAX_BATCH + 1` → 400). Thêm mới, đỏ trước:

1. `app.ts` mount: request thật qua `app.fetch` tới `GET /api/roster` không đăng nhập → 401 (nếu snapshot chưa có ca qua app).
2. Migration: trên DB local đã áp `0001`–`0006`, `0008`, áp `0011` thành công; áp lại lần hai không lỗi.

## Tasks & Steps

1. Tạo nhánh, lấy file như trên, chạy `cd community-worker && npm ci`.
2. Viết test 1–2; chạy cho đỏ trước; sửa nếu cần.
3. Cổng kiểm: `cd community-worker && npx vitest run && npx tsc --noEmit`.
4. Thử migration local: `cd community-worker && npm run db:migrate:local`.
5. **Điều kiện chặn:** tra giới hạn số câu D1 mỗi lần gọi Worker của gói đang dùng (Cloudflare docs). Test M2 giả định trần 1 000 câu. Nếu trần thật thấp hơn số câu của batch xấu nhất, hạ `ROSTER_MAX_BATCH` trong `community-worker/src/routes/roster.ts`, sửa test M2 và `docs/roster-sync.md` trước khi merge. Ghi con số vào `docs/roster-sync.md`.
6. Mở PR, review, merge.
7. **Dừng, hỏi người dùng** chạy release (cần quyền production):
   1. Ghi version worker hiện tại (rollback target) và bookmark: `npx wrangler d1 time-travel info tqccl-community`.
   2. `cd community-worker && npm run db:migrate:remote`. Không chạy kiểm `sqlite_version()` (production D1 từ chối, `docs/deployment.md:35`).
   3. `cd community-worker && npm run deploy`.
   4. `curl -s -o /dev/null -w '%{http_code}' https://tqccl.com/api/roster` → `401`.
   5. Đăng nhập Google thật trên `https://tqccl.com`, mở devtools console và chạy `fetch('/api/roster', …)` cùng origin (cookie HttpOnly không rời trình duyệt): `POST` một bản ghi `box` test, `GET` đọc lại, rồi `POST` tombstone (`deleted`) cho bản ghi đó. Không dùng `curl` kèm cookie. Đăng xuất, kiểm `GET /api/me` trả 401.
8. Ghi vào `docs/deployment.md`: version worker, bookmark, mã trạng thái của bước 4–5 và id bản ghi test (không ghi cookie, không ghi nội dung phiên). Commit vào `main`.

## Verification

- `cd community-worker && npx vitest run && npx tsc --noEmit` xanh trên đúng commit đã merge.
- `npm run db:migrate:local` thành công.
- Production: `/api/roster` trả 401 khi chưa đăng nhập; lưu/đọc một bản ghi thành công với tài khoản Google thật.
- `docs/deployment.md` có mục deploy mới.

## Rollback

`npx wrangler rollback` về version đã ghi ở bước 7.1 (version ngay trước #21). Không xóa bảng `roster_records`. Lúc này chưa có client gọi route, nên rollback worker không ảnh hưởng người dùng.

## Risks

- Schema đổi sau khi deploy sẽ cần migration thứ hai, phá mục tiêu "release worker một lần". Schema đã duyệt ở phase 1 của plan gốc và đã đo payload; phase 10 không được đổi hợp đồng `docs/roster-sync.md`. Nếu phase 10 phát hiện phải đổi schema: dừng và hỏi.
- Giới hạn batch D1 lệch gói thật: bước 5 chặn trước khi deploy.
