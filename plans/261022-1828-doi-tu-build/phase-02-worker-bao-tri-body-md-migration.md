---
phase: 2
title: "Worker: bảo trì P0, body_md, uploadIds = 1, quota AI, export v2, tiền tố /doi-tu-build/, migration 0012"
status: pending
priority: P1
effort: "1.75d"
dependencies: [1]
---

# Phase 2 — Worker: bảo trì P0, body_md, quota, migration 0012

## Goal

1. **Release P0** (nhánh và worktree riêng, merge và deploy trước). Worker có chế độ bảo trì `MAINTENANCE`:
   - Chặn mọi method ghi dưới `/api/*` và mọi `POST /api/auth/*` trừ sign-out, trả 503 `maintenance` + `Retry-After`.
   - Có sẵn version `V_P0_MAINT` đã upload.
   - Không đổi schema.
2. Trên `feat/doi-tu-build`, API đội:
   - Nhận `bodyMd` thay 6 trường, đúng 1 ảnh.
   - Từ chối payload kiểu cũ bằng 400 `stale_client`. <!-- Updated: Validation Session 1 - stale_client 409 → 400 -->
   - Export `schemaVersion: 2`.
   - Page key `/doi-tu-build/<id>/`; page key cũ được chuẩn hoá.
   - Analyze kiểm trần site trước (`site_quota`) và trả `remaining`.
3. Migration `0012_doi_tu_build.sql` đổi dữ liệu cũ. Rollback trigger theo tiền tố mới. Mọi test Worker xanh.

## Context links

- Số dòng là tham chiếu ≈ trên `0f89e2e`; tìm theo symbol ghi kèm. <!-- Red Team #3 -->
- Middleware: `community-worker/src/app.ts`: `SAFE_METHODS` ≈`:30`, `app.onError` (chép `retryAfter` sang `Retry-After`) ≈`:36-41`, `app.on(["GET", "POST"], "/api/auth/*", …)` ≈`:53`, `app.use("/api/*", …)` ≈`:55-66`. `ApiError(status, code, message, retryAfter)` ở `community-worker/src/http.ts`.
- Ghi vẫn xảy ra khi bảo trì:
  - `last_seen_at` ở `community-worker/src/context.ts` (`update "user" set last_seen_at`).
  - `consumeRateLimit` ghi `rate_limits` cả ở GET.
  - Cron `17 * * * *` (`wrangler.jsonc` `triggers`) chạy `src/cleanup.ts`.
  - Better Auth rate limit lưu trong DB (`src/auth.ts` `rateLimit`). <!-- Red Team #10 -->
- Vars: `community-worker/wrangler.jsonc` `vars` (`FEATURE_ENABLED`); kiểu `community-worker/src/env.ts` `interface Env`. Harness: `community-worker/test/fakes.ts` `createHarness(envOverrides)`.
- Production Worker = `main` `99de31c` (`docs/deployment.md` "Latest Community Worker Deploy").
- Page key: `community-worker/src/validate.ts` `PAGE_KEY_RE`, `COMMUNITY_TEAM_PAGE_RE`, `parsePageKey`, `communityTeamIdFromPage`. Nơi gọi `parsePageKey` đều dùng giá trị trả về: `routes/comments.ts` (GET, POST), `routes/reports.ts` (POST, GET, `/stats`).
- Tiền tố cũ trong code: `routes/teams.ts` `pageKeyOf`, `TEAM_SELECT` (`comment_count`), quyền chủ xoá (`not exists (select 1 from battle_reports r where r.page_key = '/doi-cong-dong/'…`); `routes/users.ts` `TEAM_PAGES`.
- Sáu trường:
  - `src/teams-validate.ts`: `optionalText`, `TeamInput`, `MAX_UPLOADS`, `parseUploadIds`, `parseTeamInput`.
  - `routes/teams.ts`: `TeamRow`, `TEAM_SELECT`, `analysisOf`, câu `insert into community_teams`, route `/api/community-teams/export`, route `GET /api/community-teams/:id`.
- Quota AI: route `teams.post("/api/community-teams/uploads/:id/analyze", …)` gọi `consumeRateLimit(… "team_analyze", user.id …)` **rồi** `"team_analyze_global", "site"`. `community-worker/src/ratelimit.ts` `consumeRateLimit` ném `ApiError(429, "rate_limited", …)` và không trả gì. Test: `test/teams-analyze.test.ts` (các ca "JSON hợp lệ", "nội dung không parse được", "team_analyze tách khỏi analyze", "trần team_analyze_global hết"). <!-- Red Team #12 -->
- Schema: `migrations/0008_community_teams.sql:27-32` (6 cột), `:103-131` (3 trigger); `rollback/0009_drop_community_team_triggers.sql`, `rollback/0010_restore_community_team_triggers.sql`.
- Fake D1 áp mọi `migrations/*.sql` bằng `exec` cả file (`test/fakes.ts` `createFakeD1`), **không** chứng minh tính nguyên tử của D1 remote; diễn tập ở [phase 6 task 6.3](./phase-06-release-cutover-runbook.md). Mẫu test migration: `test/roster-migration.test.ts`. <!-- Red Team #1 -->
- Nhãn mục theo ngôn ngữ cho backfill: `js/community-teams.js` `ANALYSIS_FIELDS`.

## Files to Create/Modify

Worktree P0 `/Users/plateau/Project/worktrees/CamNangTQCCL-worker-maintenance`, nhánh `feat/worker-maintenance` (task 2.1–2.2):
- Sửa: `community-worker/src/app.ts`, `community-worker/src/env.ts`, `community-worker/wrangler.jsonc`, `docs/community-worker.md`
- Tạo: `community-worker/test/maintenance.test.ts`

Worktree `feat/doi-tu-build` (task 2.3 trở đi):
- Sửa: `community-worker/src/validate.ts`, `community-worker/src/teams-validate.ts`, `community-worker/src/ratelimit.ts`, `community-worker/src/routes/teams.ts`, `community-worker/src/routes/users.ts`
- Tạo: `community-worker/migrations/0012_doi_tu_build.sql`, `community-worker/test/doi-tu-build-migration.test.ts`
- Sửa: `community-worker/rollback/0009_drop_community_team_triggers.sql` (chỉ chú thích), `community-worker/rollback/0010_restore_community_team_triggers.sql`
- Sửa test: `community-worker/test/fakes.ts`, `admin.test.ts`, `comments.test.ts`, `reports.test.ts`, `site-publish.test.ts`, `teams-analyze.test.ts`, `teams-export.test.ts`, `teams-schema.test.ts`, `teams-validate.test.ts`, `teams.test.ts`, `users.test.ts`, `visibility.test.ts`
- Ghi: `plans/261022-1828-doi-tu-build/reports/release-log.md` (mục "P0")

Đã kiểm bằng grep: `teams-admin.test.ts`, `audit.test.ts`, `permissions.test.ts`, `validate.test.ts` **không** chứa `doi-cong-dong`, sáu trường hay `uploadIds`, nên không sửa.

## Tasks

### Task 2.1 — Middleware `MAINTENANCE` (nhánh P0, worktree riêng) <!-- Red Team #2, #10 -->
- Goal: khi `MAINTENANCE === "true"`:
  - Mọi `POST/PUT/PATCH/DELETE` dưới `/api/*` trả 503 `{"error":{"code":"maintenance",…}}` với `Retry-After: 600`.
  - Mọi `POST /api/auth/*` trừ `/api/auth/sign-out` cũng trả như vậy.
  - GET vẫn chạy.
- Target files and symbols: `community-worker/src/app.ts` (`createApp`), `community-worker/src/env.ts` (`interface Env`), `community-worker/wrangler.jsonc` (`vars`), `community-worker/test/maintenance.test.ts`, `docs/community-worker.md` (mục "Hành vi cần biết").
- Steps:
  1. `git fetch origin && git worktree add /Users/plateau/Project/worktrees/CamNangTQCCL-worker-maintenance -b feat/worker-maintenance origin/main`, rồi trong worktree đó chạy `cd community-worker && npm ci`. Bước 2–8 chạy trong worktree này.
  2. `env.ts`: thêm sau `FEATURE_ENABLED?: string;` dòng chú thích `// "true" -> chặn mọi method ghi dưới /api/* và POST /api/auth/* (trừ sign-out) bằng 503 maintenance.` và `MAINTENANCE?: string;`.
  3. `wrangler.jsonc`: sau `"FEATURE_ENABLED": "true"` thêm dấu phẩy, chú thích `// "true" -> bảo trì (503 maintenance). Chỉ bật bằng version upload sẵn: wrangler versions upload --var MAINTENANCE:true.` và `"MAINTENANCE": "false"`.
  4. `app.ts`:
     - Thêm hằng `const MAINTENANCE_RETRY_AFTER_S = 600;` cạnh `SAFE_METHODS`, và hàm `const maintenanceError = () => new ApiError(503, "maintenance", "Đang bảo trì, thử lại sau", MAINTENANCE_RETRY_AFTER_S);`.
     - **Trước** dòng `app.on(["GET", "POST"], "/api/auth/*", …)` thêm `app.use("/api/auth/*", async (c, next) => { if (c.env.MAINTENANCE === "true" && c.req.method === "POST" && c.req.path !== "/api/auth/sign-out") throw maintenanceError(); await next(); });`.
     - Trong khối `if (!SAFE_METHODS.includes(c.req.method)) { … }` của `app.use("/api/*", …)`, **sau** đoạn kiểm `forbidden_origin`, thêm `if (c.env.MAINTENANCE === "true") throw maintenanceError();`.
     - Sửa chú thích đầu file thêm "chế độ bảo trì".
  5. Tạo `test/maintenance.test.ts` (vitest, `createHarness` từ `./fakes`):
     - `createHarness({ MAINTENANCE: "true" })`: `h.request("/api/comments", { as: "alice", json: { page: "/doi-chuan/s18-abc/", lang: "vi", body: "x" } })` → 503, `error.code === "maintenance"`, header `Retry-After` = `"600"`; `h.request("/api/community-teams/t1/vote", { as: "alice", method: "PUT", json: { value: 1 } })` → 503; `h.request("/api/auth/sign-in/social", { method: "POST", json: { provider: "google" } })` → 503 `maintenance`; `h.request("/api/auth/sign-out", { method: "POST", json: {} })` → status khác 503; `h.request("/api/community-seasons")` → 200; `h.request("/api/me")` → 200.
     - `createHarness()`: cùng POST bình luận → 201.
  6. `docs/community-worker.md`, mục "Hành vi cần biết", thêm một gạch đầu dòng nêu:
     - Var `MAINTENANCE` mặc định `"false"`.
     - Chặn: method ghi dưới `/api/*` (gồm duyệt, xoá tài khoản, nên không có `site-publish`) và `POST /api/auth/*` trừ sign-out.
     - Vẫn ghi: `last_seen_at`, `rate_limits`, bảng rate limit của Better Auth, OAuth callback của luồng đã bắt đầu trước, cron phút `:17`.
     - Client cũ hiện "không khả dụng" vì 503.
     - Cách dùng: bật/tắt bằng `wrangler versions deploy <version>@100%` của version đã upload sẵn. **Không** `npm run deploy` trong cửa sổ, vì lệnh đó đặt lại `MAINTENANCE="false"`. <!-- Red Team #11 -->
  7. `cd community-worker && npm test && npm run typecheck`.
  8. `git add community-worker/src/app.ts community-worker/src/env.ts community-worker/wrangler.jsonc community-worker/test/maintenance.test.ts docs/community-worker.md`, `git diff --cached --name-only`, `git commit -m "feat(community-worker): MAINTENANCE switch blocks writes and sign-in with 503"`, `git push -u origin feat/worker-maintenance`, `gh pr create --fill --base main`.
- Success criteria: test mới đạt; không test cũ nào đỏ; PR mở; commit chỉ gồm 5 file.
- Verify: `cd community-worker && npm test && npm run typecheck` exit 0, output vitest có `maintenance.test.ts` và không có `failed`; `git diff --cached --name-only` (trước commit) in đúng 5 dòng của bước 8.

### Task 2.2 — Phát hành P0 (DỪNG VÀ HỎI trước bước 1) <!-- Red Team #11 -->
- Goal: production chạy Worker có middleware, `MAINTENANCE` tắt (`V_P0`); có sẵn version bảo trì `V_P0_MAINT` của **đúng** SHA P0; nhánh `feat/doi-tu-build` chứa P0.
- Target files and symbols: PR của task 2.1; Worker `tqccl-community`; `plans/261022-1828-doi-tu-build/reports/release-log.md` (trong worktree `feat/doi-tu-build`).
- Steps:
  1. **Hỏi user**: xác nhận lịch deploy Worker so với cửa sổ release phase 11 của `plans/261022-1109-dot-gom-9-issue`. Chỉ làm tiếp khi user đồng ý.
  2. `gh pr merge <số PR> --merge`.
  3. Trong worktree P0: `git fetch origin && git switch --detach origin/main && git rev-parse --short HEAD` → ghi là `P0`.
  4. `git log 99de31c..HEAD --oneline -- community-worker shared worker/src`: chỉ được liệt kê commit của task 2.1 (và merge commit của nó); có commit khác thì DỪNG và hỏi. Ghi chú: PR #36 không sửa file nào dưới `community-worker/` (đã kiểm bằng `gh pr view 36`), nên merge #36 không làm guard này dừng. <!-- Updated: Validation Session 1 - PR #36 không đụng community-worker -->
  5. `cd community-worker && npm ci && npm test && npm run typecheck && npm run deploy`. Ghi `Current Version ID` là `V_P0`.
  6. `npx wrangler versions upload --var MAINTENANCE:true --message "P0 maintenance <P0>"`. Ghi Version ID là `V_P0_MAINT` (version này chưa nhận traffic). [UNVERIFIED] cờ `--var` của `versions upload` lấy từ tài liệu Cloudflare (researcher §3.1); nếu wrangler báo cờ không hợp lệ thì DỪNG.
  7. Smoke: `curl -sS -o /dev/null -w "%{http_code}\n" -X POST https://tqccl.com/api/comments -H "Origin: https://tqccl.com" -H "Content-Type: application/json" -d '{}'`.
  8. Trong worktree `feat/doi-tu-build`: thêm mục "P0" vào `release-log.md`: ngày giờ UTC, `P0`, `V_P0`, `V_P0_MAINT`, kết quả curl. Rồi `git merge --no-edit origin/main`.
- Success criteria: Worker mới phục vụ; POST không đăng nhập vẫn 401; có `V_P0` và `V_P0_MAINT`; nhánh làm việc có commit P0.
- Verify: lệnh curl bước 7 in đúng `401`; `release-log.md` có dòng chứa `V_P0_MAINT`; `git merge-base --is-ancestor origin/main HEAD` exit 0 trong worktree `feat/doi-tu-build`.

### Task 2.3 — `bodyMd`, đúng 1 ảnh, payload cũ trả `stale_client`
- Goal: `parseTeamInput` trả `{title, heroes, tactics, troop, bodyMd, lang, uploadIds}`. Quy tắc:
  - `bodyMd` 10–10 000 code point, sau khi đổi `\r\n`/`\r` thành `\n` và trim.
  - `uploadIds` đúng 1 phần tử.
  - Payload của form cũ (có `playstyle`, không có `bodyMd`) trả 400 `stale_client`. Client cũ hiện câu 400 chung và không focus sai ô. <!-- Red Team #8 --> <!-- Updated: Validation Session 1 - stale_client 409 → 400 -->
- Target files and symbols: `community-worker/src/teams-validate.ts`: `MAX_UPLOADS`, `optionalText`, `TeamInput`, `parseUploadIds`, `parseTeamInput`.
- Steps:
  1. Đổi `const MAX_UPLOADS = 3;` thành `const UPLOADS_PER_TEAM = 1;`; thêm `export const BODY_MIN = 10;`, `export const BODY_MAX = 10_000;`.
  2. Xoá `optionalText`.
  3. `TeamInput`: xoá `playstyle, strengths, weaknesses, counters, counteredBy, substitutes`; thêm `bodyMd: string;` sau `troop`.
  4. Thêm `parseBody(value: unknown): string`: không phải chuỗi → `bad("invalid_text", "bodyMd phải là chuỗi")`; `value.replace(/\r\n?/gu, "\n")`; trả `text(normalized, "invalid_text", "bodyMd", BODY_MIN, BODY_MAX)`.
  5. `parseUploadIds`: điều kiện mảng thành `!Array.isArray(value) || value.length !== UPLOADS_PER_TEAM`, thông báo `"uploadIds phải có đúng 1 ảnh"`; bỏ kiểm trùng.
  6. `parseTeamInput`: ngay sau kiểm `isObject(input)`, thêm `if (input.bodyMd === undefined && "playstyle" in input) throw bad("stale_client", "Trang đã cập nhật, hãy tải lại trang");` (`bad` = `ApiError` 400 của file này); thay 6 dòng `playstyle…substitutes` bằng `bodyMd: parseBody(input.bodyMd),`. <!-- Updated: Validation Session 1 - stale_client 409 → 400 -->
- Success criteria: typecheck chỉ còn lỗi ở `routes/teams.ts` (sửa ở task 2.5).
- Verify: no verification needed (task 2.9).

### Task 2.4 — Tiền tố `/doi-tu-build/` và chuẩn hoá page key cũ <!-- Red Team #8 -->
- Goal: page key đội là `/doi-tu-build/<id>/`; `parsePageKey("/doi-cong-dong/<id>/")` trả `/doi-tu-build/<id>/`, nên tab cũ vẫn đọc/ghi đúng một tập bình luận/chiến báo.
- Target files and symbols: `community-worker/src/validate.ts` (`PAGE_KEY_RE`, `COMMUNITY_TEAM_PAGE_RE`, `parsePageKey`, chú thích của `communityTeamIdFromPage`).
- Steps:
  1. Thêm trên `PAGE_KEY_RE`: chú thích "page key trang Đội tự build: `/doi-tu-build/<id>/` (0012 đổi từ `/doi-cong-dong/`)" và `export const TEAM_PAGE_PREFIX = "/doi-tu-build/";`.
  2. Trong `PAGE_KEY_RE` và `COMMUNITY_TEAM_PAGE_RE` đổi `doi-cong-dong` thành `doi-tu-build` (giữ slug `{0,63}`).
  3. Thêm `const LEGACY_TEAM_PAGE_RE = /^\/doi-cong-dong\/([a-z0-9][a-z0-9-]{0,63})\/$/u;` kèm chú thích "tab mở trước cutover vẫn gửi tiền tố cũ: chuẩn hoá, không tách dữ liệu".
  4. `parsePageKey`: trước kiểm `PAGE_KEY_RE`, nếu `typeof value === "string"` và `LEGACY_TEAM_PAGE_RE.exec(value)` có kết quả `m` thì `return \`${TEAM_PAGE_PREFIX}${m[1]}/\``.
  5. Chú thích của `communityTeamIdFromPage` đổi thành `/doi-tu-build/<id>/`.
- Success criteria: `parsePageKey("/doi-cong-dong/t1/")` = `"/doi-tu-build/t1/"`; `parsePageKey("/doi-tu-build/t1/")` trả nguyên chuỗi; `PAGE_KEY_RE.test("/doi-cong-dong/t1/")` = `false`.
- Verify: no verification needed (task 2.8 thêm test, task 2.9 chạy).

### Task 2.5 — Route đội, export v2, xoá tài khoản
- Goal: route đọc/ghi dùng `body_md`, export `schemaVersion: 2`, mọi SQL tiền tố lấy từ `TEAM_PAGE_PREFIX`.
- Target files and symbols: `community-worker/src/routes/teams.ts`, `community-worker/src/routes/users.ts`.
- Steps:
  1. `teams.ts`: thêm `TEAM_PAGE_PREFIX` vào import từ `../validate`; `pageKeyOf` thành `` (teamId: string) => `${TEAM_PAGE_PREFIX}${teamId}/` ``.
  2. `TeamRow`: xoá 6 trường; thêm `body_md?: string;`.
  3. `TEAM_SELECT`: bỏ `t.playstyle, ` và `t.strengths, t.weaknesses, t.counters, t.countered_by, t.substitutes, `; dòng `comment_count` thành `` `(select count(*) from comments where page_key = '${TEAM_PAGE_PREFIX}' || t.id || '/') as comment_count, ` ``. Không thêm `body_md` vào `TEAM_SELECT`.
  4. Xoá `analysisOf`.
  5. Câu `insert into community_teams`: cột thành `id, author_id, season_id, status, title, hero_1, hero_2, hero_3, hero_key, tactics, troop, body_md, text_lang, created_at`; phần select thành `select ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ? where …` (13 dấu `?` trước `where`); trong `.bind(...)` thay 6 dòng `input.playstyle` … `input.substitutes` bằng `input.bodyMd,`.
  6. Route export: truy vấn `` `${TEAM_SELECT}, t.body_md${TEAM_FROM} where …` ``; `schemaVersion: 2`; item `{ ...item, author: { id: item.author.id, name }, bodyMd: row.body_md ?? "", approvedAt: … }`; chú thích "kèm analysis" thành "kèm bodyMd (schema v2)".
  7. Route `GET /api/community-teams/:id`: `` `${TEAM_SELECT}, t.body_md${TEAM_FROM} where t.id = ?` ``; `analysis: analysisOf(row),` thành `bodyMd: row.body_md ?? "",`.
  8. Điều kiện quyền chủ xoá: `'/doi-cong-dong/'` thành `'${TEAM_PAGE_PREFIX}'` (chuyển chuỗi sang template literal).
  9. `users.ts`: import `TEAM_PAGE_PREFIX` từ `../validate`; `TEAM_PAGES` thành `` `select '${TEAM_PAGE_PREFIX}' || id || '/' from community_teams where author_id = ?` ``.
- Success criteria: grep `doi-cong-dong` trong `community-worker/src` chỉ còn `LEGACY_TEAM_PAGE_RE` (và chú thích của nó) và chú thích đầu `teams-validate.ts` (đổi ở phase 5).
- Verify: `cd community-worker && npm run typecheck` exit 0.

### Task 2.6 — Quota AI: trần site trước, `site_quota`, `remaining` <!-- Red Team #12 -->
- Goal: khi trần site (300/ngày) cạn, user nhận 429 `site_quota` mà không bị trừ lượt riêng; analyze thành công trả `remaining` = lượt riêng còn lại hôm nay.
- Target files and symbols: `community-worker/src/ratelimit.ts` (`consumeRateLimit`); `community-worker/src/routes/teams.ts` (route `…/uploads/:id/analyze`).
- Steps:
  1. `consumeRateLimit(db, action, userId, now, code = "rate_limited")`: kiểu trả `Promise<{ count: number; limit: number }>`; ném `new ApiError(429, code, "Bạn thao tác quá nhanh, thử lại sau", retryAfter)`; khi không vượt trả `{ count: row?.count ?? 0, limit: rule.limit }`. Các nơi gọi khác giữ nguyên (bỏ qua giá trị trả).
  2. Route analyze: đổi thứ tự thành `await consumeRateLimit(c.env.DB, "team_analyze_global", "site", at, "site_quota");` rồi `const quota = await consumeRateLimit(c.env.DB, "team_analyze", user.id, at);` và `const remaining = Math.max(0, quota.limit - quota.count);`.
  3. Trả `c.json({ read, remaining })`; nhánh 422 trả `c.json({ read: { screen: "other", sides: [] }, remaining })`.
  4. Chú thích ngay trên hai lời gọi: "Trần site trước: site cạn thì không trừ lượt riêng (mã site_quota). Lượt riêng hết thì bộ đếm site vẫn tăng một lần (chấp nhận)."
  5. `test/teams-analyze.test.ts`:
     - Ca "JSON hợp lệ": kỳ vọng thêm `remaining: 19`.
     - Ca "nội dung không parse được": `toEqual({ read: { screen: "other", sides: [] }, remaining: 19 })`.
     - Ca "team_analyze tách khỏi analyze": response 429 có `error.code === "rate_limited"`.
     - Ca "trần team_analyze_global hết": response 429 có `error.code === "site_quota"`, và `h.sqlite.prepare("select count(*) n from rate_limits where key like 'team_analyze:u-alice:%'").get()` = `{ n: 0 }`.
- Success criteria: test đạt.
- Verify: no verification needed (task 2.9).

### Task 2.7 — Migration `0012_doi_tu_build.sql` và rollback trigger
- Goal: một file migration đổi dữ liệu cũ; `rollback/0010` dựng lại trigger theo tiền tố mới.
- Target files and symbols: `community-worker/migrations/0012_doi_tu_build.sql` (tạo, LF), `community-worker/rollback/0010_restore_community_team_triggers.sql`, `community-worker/rollback/0009_drop_community_team_triggers.sql`.
- Steps:
  1. Tạo `0012_doi_tu_build.sql` với **đúng** nội dung sau (không thêm `BEGIN`, `COMMIT`, `PRAGMA`):
     ```sql
     -- Đội tự build (plan 261022-1828): thân bài Markdown `body_md` thay 6 cột phân tích; page key bình luận/chiến báo
     -- '/doi-cong-dong/<id>/' -> '/doi-tu-build/<id>/'. Chạy trong cửa sổ bảo trì (MAINTENANCE=true): Worker cũ đọc 6 cột
     -- nên lỗi ngay sau file này; deploy Worker mới liền sau. Hành vi khi lỗi giữa chừng đã diễn tập trên D1 tạm
     -- (plan task 6.3). Không dựng lại bảng: D1 luôn bật FK, DROP TABLE sẽ cascade xoá ảnh và phiếu. Cần SQLite >= 3.35.
     -- Rollback dữ liệu: Time Travel bookmark ghi trước khi apply. Trigger: rollback/0009 gỡ, rollback/0010 dựng lại.

     alter table community_teams add column body_md text not null default '';

     -- Bài cũ là chữ thuần: chuẩn hoá xuống dòng, bỏ khoảng trắng hai đầu.
     update community_teams set
       playstyle = trim(replace(replace(playstyle, char(13) || char(10), char(10)), char(13), char(10)), ' ' || char(9) || char(10)),
       strengths = trim(replace(replace(strengths, char(13) || char(10), char(10)), char(13), char(10)), ' ' || char(9) || char(10)),
       weaknesses = trim(replace(replace(weaknesses, char(13) || char(10), char(10)), char(13), char(10)), ' ' || char(9) || char(10)),
       counters = trim(replace(replace(counters, char(13) || char(10), char(10)), char(13), char(10)), ' ' || char(9) || char(10)),
       countered_by = trim(replace(replace(countered_by, char(13) || char(10), char(10)), char(13), char(10)), ' ' || char(9) || char(10)),
       substitutes = trim(replace(replace(substitutes, char(13) || char(10), char(10)), char(13), char(10)), ' ' || char(9) || char(10));

     -- Escape có chọn lọc các ký tự js/markdown.js (profile ugc) hiểu ở giữa dòng (backslash trước tiên).
     update community_teams set
       playstyle = replace(replace(replace(replace(replace(replace(playstyle, '\', '\\'), '&', '\&'), '`', '\`'), '*', '\*'), '_', '\_'), '[', '\['),
       strengths = replace(replace(replace(replace(replace(replace(strengths, '\', '\\'), '&', '\&'), '`', '\`'), '*', '\*'), '_', '\_'), '[', '\['),
       weaknesses = replace(replace(replace(replace(replace(replace(weaknesses, '\', '\\'), '&', '\&'), '`', '\`'), '*', '\*'), '_', '\_'), '[', '\['),
       counters = replace(replace(replace(replace(replace(replace(counters, '\', '\\'), '&', '\&'), '`', '\`'), '*', '\*'), '_', '\_'), '[', '\['),
       countered_by = replace(replace(replace(replace(replace(replace(countered_by, '\', '\\'), '&', '\&'), '`', '\`'), '*', '\*'), '_', '\_'), '[', '\['),
       substitutes = replace(replace(replace(replace(replace(replace(substitutes, '\', '\\'), '&', '\&'), '`', '\`'), '*', '\*'), '_', '\_'), '[', '\[');

     -- Đầu dòng: '#' (tiêu đề) và '>' (trích dẫn) thành chữ thường. '-', '+', '1.' giữ nguyên: người viết dùng chúng như danh sách.
     update community_teams set
       playstyle = replace(replace(playstyle, char(10) || '#', char(10) || '\#'), char(10) || '>', char(10) || '\>'),
       strengths = replace(replace(strengths, char(10) || '#', char(10) || '\#'), char(10) || '>', char(10) || '\>'),
       weaknesses = replace(replace(weaknesses, char(10) || '#', char(10) || '\#'), char(10) || '>', char(10) || '\>'),
       counters = replace(replace(counters, char(10) || '#', char(10) || '\#'), char(10) || '>', char(10) || '\>'),
       countered_by = replace(replace(countered_by, char(10) || '#', char(10) || '\#'), char(10) || '>', char(10) || '\>'),
       substitutes = replace(replace(substitutes, char(10) || '#', char(10) || '\#'), char(10) || '>', char(10) || '\>');
     update community_teams set
       playstyle = case when substr(playstyle, 1, 1) in ('#', '>') then '\' || playstyle else playstyle end,
       strengths = case when substr(strengths, 1, 1) in ('#', '>') then '\' || strengths else strengths end,
       weaknesses = case when substr(weaknesses, 1, 1) in ('#', '>') then '\' || weaknesses else weaknesses end,
       counters = case when substr(counters, 1, 1) in ('#', '>') then '\' || counters else counters end,
       countered_by = case when substr(countered_by, 1, 1) in ('#', '>') then '\' || countered_by else countered_by end,
       substitutes = case when substr(substitutes, 1, 1) in ('#', '>') then '\' || substitutes else substitutes end;

     -- Mỗi dòng cũ thành một đoạn (renderer nối các dòng trong cùng đoạn bằng dấu cách).
     update community_teams set
       playstyle = replace(playstyle, char(10), char(10) || char(10)),
       strengths = replace(strengths, char(10), char(10) || char(10)),
       weaknesses = replace(weaknesses, char(10), char(10) || char(10)),
       counters = replace(counters, char(10), char(10) || char(10)),
       countered_by = replace(countered_by, char(10), char(10) || char(10)),
       substitutes = replace(substitutes, char(10), char(10) || char(10));

     -- Gộp theo thứ tự cũ, nhãn theo text_lang (như js/community-teams.js ANALYSIS_FIELDS), bỏ mục rỗng, không cắt.
     update community_teams set body_md = trim(
       (case text_lang when 'zh' then '## 打法' else '## Lối chơi' end) || char(10) || char(10) || playstyle
       || case when coalesce(strengths, '') = '' then '' else char(10) || char(10) || (case text_lang when 'zh' then '## 优点' else '## Điểm mạnh' end) || char(10) || char(10) || strengths end
       || case when coalesce(weaknesses, '') = '' then '' else char(10) || char(10) || (case text_lang when 'zh' then '## 缺点' else '## Điểm yếu' end) || char(10) || char(10) || weaknesses end
       || case when coalesce(counters, '') = '' then '' else char(10) || char(10) || (case text_lang when 'zh' then '## 克制' else '## Khắc chế' end) || char(10) || char(10) || counters end
       || case when coalesce(countered_by, '') = '' then '' else char(10) || char(10) || (case text_lang when 'zh' then '## 被克制于' else '## Bị khắc chế bởi' end) || char(10) || char(10) || countered_by end
       || case when coalesce(substitutes, '') = '' then '' else char(10) || char(10) || (case text_lang when 'zh' then '## 替补' else '## Thay thế' end) || char(10) || char(10) || substitutes end,
       char(10));

     -- Trigger evidence theo tiền tố mới. '/doi-tu-build/' dài 14 ký tự: id = substr(page_key, 15, length - 15).
     drop trigger if exists battle_reports_team_evidence_ins;
     drop trigger if exists battle_reports_team_evidence_upd;
     drop trigger if exists battle_reports_team_evidence_del;

     -- '/doi-cong-dong/' dài 15 ký tự: phần sau tiền tố (gồm '/' cuối) bắt đầu ở vị trí 16.
     update comments set page_key = '/doi-tu-build/' || substr(page_key, 16) where page_key like '/doi-cong-dong/%';
     update battle_reports set page_key = '/doi-tu-build/' || substr(page_key, 16) where page_key like '/doi-cong-dong/%';

     create trigger battle_reports_team_evidence_ins after insert on battle_reports
     when NEW.page_key like '/doi-tu-build/%'
     begin
       update community_teams set evidence_count = (
         select count(distinct r.user_id) from battle_reports r
         where r.page_key = NEW.page_key and r.status = 'approved' and r.result = 'win' and r.user_id <> community_teams.author_id
       ) where id = substr(NEW.page_key, 15, length(NEW.page_key) - 15);
     end;

     create trigger battle_reports_team_evidence_upd after update of status, result on battle_reports
     when NEW.page_key like '/doi-tu-build/%'
     begin
       update community_teams set evidence_count = (
         select count(distinct r.user_id) from battle_reports r
         where r.page_key = NEW.page_key and r.status = 'approved' and r.result = 'win' and r.user_id <> community_teams.author_id
       ) where id = substr(NEW.page_key, 15, length(NEW.page_key) - 15);
     end;

     create trigger battle_reports_team_evidence_del after delete on battle_reports
     when OLD.page_key like '/doi-tu-build/%'
     begin
       update community_teams set evidence_count = (
         select count(distinct r.user_id) from battle_reports r
         where r.page_key = OLD.page_key and r.status = 'approved' and r.result = 'win' and r.user_id <> community_teams.author_id
       ) where id = substr(OLD.page_key, 15, length(OLD.page_key) - 15);
     end;

     -- Đếm lại cho mọi đội (đổi page_key không chạy trigger _upd vì trigger đó chỉ theo status, result).
     update community_teams set evidence_count = (
       select count(distinct r.user_id) from battle_reports r
       where r.page_key = '/doi-tu-build/' || community_teams.id || '/' and r.status = 'approved' and r.result = 'win'
         and r.user_id <> community_teams.author_id
     );

     -- Không index, trigger, view, cột sinh hay CHECK nào tham chiếu 6 cột này (0008:19-54, 75-140).
     alter table community_teams drop column playstyle;
     alter table community_teams drop column strengths;
     alter table community_teams drop column weaknesses;
     alter table community_teams drop column counters;
     alter table community_teams drop column countered_by;
     alter table community_teams drop column substitutes;
     ```
  2. `rollback/0010_restore_community_team_triggers.sql`: thay ba câu `create trigger` bằng đúng ba câu của bước 1; câu đếm lại cuối file đổi `'/doi-cong-dong/'` thành `'/doi-tu-build/'`; chú thích đầu file "chép từ migrations/0008_community_teams.sql" thành "chép từ migrations/0012_doi_tu_build.sql (tiền tố /doi-tu-build/)".
  3. `rollback/0009_drop_community_team_triggers.sql`: chú thích dòng 1 thành "Rollback của trigger evidence (tạo ở migrations/0008, dựng lại theo tiền tố mới ở 0012)"; ba câu `drop trigger if exists` giữ nguyên.
- Success criteria: file `0012` tồn tại, kết thúc bằng xuống dòng, không có ký tự `\r`.
- Verify: no verification needed (task 2.8 và 2.9).

### Task 2.8 — Test migration và cập nhật mọi test Worker
- Goal: test chứng minh `0012` đúng trên dữ liệu kiểu production, và mọi test cũ đi theo schema/API mới.
- Target files and symbols: như danh sách dưới.
- Steps:
  1. Tạo `test/doi-tu-build-migration.test.ts` theo mẫu `test/roster-migration.test.ts` (`DatabaseSync` qua `createRequire`, `apply(db, file)`), `const BASE = ["0001_better_auth.sql", "0002_community.sql", "0003_feedback.sql", "0004_recruit.sql", "0005_scan.sql", "0006_user_admin.sql", "0008_community_teams.sql", "0011_roster.sql"]`. Trước khi áp `0012`, seed bằng SQL của schema cũ:
     - User `author`, `u1`, `u2`, `u3` (insert như `teams-schema.test.ts` hàm `user`); mùa `s1`.
     - Đội `t1` (`text_lang` `vi`): `strengths` = `"Mạnh"`, `weaknesses` = `null`, `counters` = `"  "` (hai dấu cách), `countered_by` = `"Kỵ"`, `substitutes` = `""`, và `playstyle` là literal JS sau (có `\r\n` sau dòng đầu, hai dấu cách ở đầu):
       ```js
       const OLD_PLAYSTYLE = "  Mở đầu *nhanh* [Tào Tháo]\r\n# 1 chủ lực\n> 50% máu\n- a_b `x` \\ R&D";
       ```
     - Đội `t11` (`zh`): `playstyle` = `"先手控制"`, `substitutes` = `"替换"`, các cột khác `null`.
     - Đội `t2` (`vi`): `playstyle` = `"a".repeat(3000)`, năm cột kia mỗi cột `"b".repeat(2000)`.
     - Bình luận: hai dòng `/doi-cong-dong/t1/`, một dòng `/doi-cong-dong/t11/`, một dòng `/doi-chuan/s18-abc/`.
     - Chiến báo `approved` + `win`: `u1`, `u2`, `author` trên `/doi-cong-dong/t1/`; `u1` trên `/doi-cong-dong/t11/`. Ghi lại `evidence_count` của `t1` (phải là 2) và `t11` (1) trước khi áp `0012`.
  2. Áp `0012_doi_tu_build.sql`, rồi assert:
     - `body_md` của `t1` bằng đúng chuỗi `MIGRATED_VI` (chép nguyên khối ở phase 1 task 1.3 ca 18).
     - `body_md` của `t11` = `"## 打法\n\n先手控制\n\n## 替补\n\n替换"`.
     - `length(body_md)` của `t2` > 13000.
     - `comments`: `page_key like '/doi-cong-dong/%'` = 0; `= '/doi-tu-build/t1/'` = 2; `= '/doi-tu-build/t11/'` = 1; dòng `/doi-chuan/s18-abc/` còn nguyên. `battle_reports`: 3 dòng `t1`, 1 dòng `t11` theo tiền tố mới.
     - `evidence_count`: `t1` = 2, `t11` = 1.
     - Insert chiến báo `approved` `win` của `u3` trên `/doi-tu-build/t1/` → `t1` = 3 và `t11` vẫn 1; xoá dòng đó → `t1` = 2.
     - `select sql from sqlite_master where name = 'battle_reports_team_evidence_ins'` chứa `like '/doi-tu-build/%'` và `substr(NEW.page_key, 15, length(NEW.page_key) - 15)`.
     - `select name from pragma_table_xinfo('community_teams') order by cid` trả **đúng** 24 tên theo thứ tự: `id, author_id, season_id, status, title, hero_1, hero_2, hero_3, hero_key, tactics, troop, text_lang, reject_reason, reviewed_by, reviewed_at, deleting_at, created_at, up_votes, down_votes, evidence_count, points, hot_rank, top_rank, body_md` (0008 ≈`:15-48` bỏ 6 cột, `body_md` thêm cuối). Không còn `playstyle, strengths, weaknesses, counters, countered_by, substitutes`. Phải dùng `table_xinfo`: `points`, `hot_rank`, `top_rank` là generated column (0008 ≈`:43-47`) nên `table_info` không trả chúng. <!-- Updated: Kongming advice - table_info → table_xinfo, liệt kê tập cột -->
  3. `test/fakes.ts` `seedTeam`: cột `playstyle` thành `body_md`, giá trị `'Lối chơi thử nghiệm'`.
  4. `test/admin.test.ts` (câu `insert into community_teams … playstyle`) và `test/teams-schema.test.ts` (hàm `team`): đổi cột `playstyle` thành `body_md` (giá trị giữ `'p'`).
  5. `test/teams-schema.test.ts`: mọi `/doi-cong-dong/` (≈`:121,173,178,245,275`) thành `/doi-tu-build/`; khối `describe("rollback 0009 / 0010")` chạy file `rollback/0010` mới.
  6. `test/teams-validate.test.ts`:
     - `valid()`: thay 6 trường bằng `bodyMd: "## Lối chơi\r\n\r\nĐánh nhanh thắng nhanh."`, `uploadIds: ["up-1"]`; kỳ vọng của ca parse đúng có `bodyMd: "## Lối chơi\n\nĐánh nhanh thắng nhanh."` và `uploadIds: ["up-1"]`.
     - Thay ca "playstyle: biên 10–3000" bằng "bodyMd: biên 10–10000 code point": 9 ký tự → `invalid_text`; 10 → `no_error`; `"𠮷".repeat(10000)` → `no_error`; `"a".repeat(10001)` → `invalid_text`; `undefined` (không có `playstyle`) → `invalid_text`; `3` → `invalid_text`.
     - Thêm ca "payload form cũ": `codeOf(() => parseTeamInput({ ...valid(), bodyMd: undefined, playstyle: "x".repeat(20) }))` = `"stale_client"`, và lỗi ném ra là `ApiError` có `status === 400`. <!-- Updated: Validation Session 1 - stale_client 409 → 400 -->
     - Xoá ca "các trường tuỳ chọn".
     - Ca `uploadIds`: `[]` → `invalid_uploads`; `["a", "b"]` → `invalid_uploads`; `["a"]` → `no_error`; `["bad id"]` → `invalid_uploads`.
     - Khối page key: đổi mọi `/doi-cong-dong/` trong danh sách hợp lệ/không hợp lệ thành `/doi-tu-build/`; thêm `expect(PAGE_KEY_RE.test("/doi-cong-dong/id-1/")).toBe(false)`, `expect(parsePageKey("/doi-cong-dong/id-1/")).toBe("/doi-tu-build/id-1/")`, `expect(codeOf(() => parsePageKey("/doi-cong-dong/ID/"))).toBe("invalid_page")` (import `parsePageKey` từ `../src/validate`).
  7. `test/teams.test.ts`:
     - `PAGE` đổi tiền tố; `teamBody` thay `playstyle` bằng `bodyMd: "## Lối chơi\n\nĐánh nhanh thắng nhanh"`.
     - Ca "thành công: 201…" thêm assert `row.body_md === "## Lối chơi\n\nĐánh nhanh thắng nhanh"`.
     - Ca "lỗi R2 ở ảnh thứ 2" đổi tên thành "lỗi R2 khi chép ảnh"; dùng `const ids = [await upload(h)]`, `failR2On({ op: "put", nth: 1 })`, kỳ vọng `count(... uploads)` = 1.
     - Thêm ca "2 ảnh -> 400 invalid_uploads".
     - Thêm ca "payload form cũ -> 400 stale_client": `h.request(TEAMS, { as: "alice", json: { ...teamBody([await upload(h)]), bodyMd: undefined, playstyle: "Lối chơi đủ dài" } })` → 400, `error.code === "stale_client"`. <!-- Updated: Validation Session 1 - stale_client 409 → 400 -->
     - Ca "đội approved…": `analysis: {...}` thành `bodyMd: "Lối chơi thử nghiệm",`; thêm `expect("analysis" in guest).toBe(false)`.
  8. `test/teams-export.test.ts`:
     - `ITEM_KEYS`: thay `"analysis"` bằng `"bodyMd"`, sắp lại thứ tự chữ cái (`approvedAt, author, bodyMd, commentCount, …`).
     - Ca E3: đổi tên thành "… bodyMd theo body_md"; dòng `update community_teams set strengths = 'Mạnh'…` thay bằng `h.sqlite.prepare("update community_teams set body_md = ? where id = 't2'").run("## Lối chơi\n\nMạnh")`; hai assert `analysis` thay bằng `expect(byId.t2.bodyMd).toBe("## Lối chơi\n\nMạnh")`.
     - Ca E5, E6: `schemaVersion` thành `2`.
  9. Đổi literal `/doi-cong-dong/` thành `/doi-tu-build/` ở `test/comments.test.ts` (khối `describe("bình luận trên trang đội cộng đồng")`), `test/reports.test.ts` (khối `describe("chiến báo trên trang đội cộng đồng")`), `test/users.test.ts` (`TEAM` và hai dòng `t2`), `test/visibility.test.ts` (`TEAM`), `test/site-publish.test.ts` (insert `battle_reports`).
  10. `test/comments.test.ts`, trong khối đã nói ở bước 9, thêm ca "page key cũ được chuẩn hoá": `POST /api/comments` với `page: "/doi-cong-dong/t1/"` → 201 và `select page_key from comments` của dòng mới = `"/doi-tu-build/t1/"`; `GET /api/comments?page=/doi-cong-dong/t1/&lang=vi` trả cùng danh sách với `?page=/doi-tu-build/t1/`. <!-- Red Team #8 -->
- Success criteria: `/doi-cong-dong/` trong `community-worker/test` chỉ còn ở ca chuẩn hoá, ca `PAGE_KEY_RE` âm, và seed của `doi-tu-build-migration.test.ts`.
- Verify: no verification needed (task 2.9).

### Task 2.9 — Cổng của phase
- Goal: Worker xanh trên fake D1 và migration chạy được trên engine D1 cục bộ (workerd).
- Target files and symbols: worktree `feat/doi-tu-build`, `community-worker/`.
- Steps:
  1. `cd community-worker && npm test && npm run typecheck`
  2. `cd community-worker && npx wrangler d1 migrations apply tqccl-community --local` (wrangler hỏi xác nhận thì trả lời `y`). Chỉ ghi vào `.wrangler/` cục bộ.
  3. `cd community-worker && npx wrangler d1 execute tqccl-community --local --command "select name from pragma_table_xinfo('community_teams') where name in ('body_md','playstyle')"` <!-- Updated: Kongming advice - dùng table_xinfo thống nhất -->
  4. Ở root: `python3 -m pipeline.site_localization check --root . --stage public`
  5. `git add community-worker/src/validate.ts community-worker/src/teams-validate.ts community-worker/src/ratelimit.ts community-worker/src/routes/teams.ts community-worker/src/routes/users.ts community-worker/migrations/0012_doi_tu_build.sql community-worker/rollback/0009_drop_community_team_triggers.sql community-worker/rollback/0010_restore_community_team_triggers.sql community-worker/test plans/261022-1828-doi-tu-build/reports/release-log.md` <!-- Red Team #2 -->
  6. `git diff --cached --name-only`
  7. `git commit -m "feat(community-worker): body_md, one image, quota order, export v2, /doi-tu-build/ page keys, migration 0012"`
- Success criteria: mọi test đạt, migration áp được cục bộ, commit chỉ chứa file của phase.
- Verify:
  - Bước 1 exit 0, output vitest không có `failed`.
  - Bước 2 exit 0, output có `0012_doi_tu_build.sql`.
  - Bước 3 in `body_md` và không in `playstyle`.
  - Bước 4 exit 0.
  - Bước 6 chỉ liệt kê đường dẫn dưới `community-worker/` và `plans/261022-1828-doi-tu-build/reports/release-log.md`; không có `docs/design/` hay `scripts/design-canvas/shot.mjs`.

## Risk

| Rủi ro | Khả năng × Tác động | Giảm thiểu |
|---|---|---|
| Worker cũ (đọc 6 cột) chạy sau khi `0012` áp → GET đội 500 | Chắc chắn trong khoảng 6.13→6.14 × Trung bình | Version mới upload sẵn (6.8); chuỗi 6.10→6.17 một lần chấp thuận (phase 6) <!-- Updated: Kongming advice - đánh số lại phase 6 --> |
| `node:sqlite` (fake) và workerd cục bộ khác D1 remote khi lỗi giữa file | Thấp × Cao | Diễn tập trên D1 tạm (task 6.3); R1 kiểm bất biến đầy đủ <!-- Red Team #1 --> |
| Escape làm bài cũ hiển thị khác ý người viết | Thấp × Thấp | Chỉ escape ký tự có nghĩa giữa dòng và `#`/`>` đầu dòng; test khoá chuỗi cụ thể |
| P0 deploy kéo theo thay đổi Worker chưa phát hành | Thấp × Cao | Task 2.2 bước 4 kiểm `git log 99de31c..HEAD` |
| Đổi thứ tự quota làm bộ đếm site tăng khi user đã hết lượt riêng | Trung bình × Thấp | Chấp nhận, ghi chú trong code |

## Security

- Validator áp độ dài và chuẩn hoá cho mọi `POST`; `bodyMd` lưu thô, chỉ hiển thị qua `js/markdown.js` profile `ugc`.
- `MAINTENANCE` chặn xoá tài khoản (`DELETE /api/admin/users/:id`), mọi lệnh gây `site-publish`, và đăng nhập mới (`POST /api/auth/*` trừ sign-out). Vẫn ghi `last_seen_at`, `rate_limits`, rate limit của Better Auth, OAuth callback của luồng đã bắt đầu, và cron `:17` (liệt kê ở phase 6 R2). <!-- Red Team #10 -->
- Chuẩn hoá page key cũ chỉ ánh xạ một tiền tố cố định sang tiền tố mới, không mở thêm trang nào.

## Failure Protocol
If any Verify step does not meet its stated pass condition, STOP this phase.
Do not improvise a fix, retry blindly, or reason around the failure.
Spawn the `kongming` subagent for next-step counsel and pass:
- the phase and task id,
- what you attempted (the steps you ran),
- the exact command and its full output,
- the pass condition it failed to meet.
Apply kongming's guidance, then re-run the Verify step.
If `kongming` cannot be spawned in this environment, STOP and report the same
failure evidence to the user. Never continue by self-reasoning.
