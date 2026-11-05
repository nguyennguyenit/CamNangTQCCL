---
phase: 6
title: "Release và cutover production (diễn tập + cửa sổ bảo trì)"
status: pending
priority: P1
effort: "0.75d"
dependencies: [5]
---

# Phase 6 — Release và cutover production

## Goal

Đưa Đội tự build lên production theo ba chặng: <!-- Updated: Kongming advice - dời chuẩn bị ra trước cửa sổ -->

1. **Chuẩn bị, chưa bảo trì (6.1–6.9):**
   - kiểm cục bộ, chốt lịch và xin một lần chấp thuận cho chuỗi vận hành;
   - diễn tập migration trên D1 tạm;
   - tắt workflow Pages, merge PR, build `dist/`, upload sẵn hai version Worker;
   - viết sẵn bảng lệnh có đủ ID.
2. **Cửa sổ bảo trì (6.10–6.17), chạy liền theo chấp thuận ở 6.2:**
   - bật `MAINTENANCE`, chờ request ghi cũ kết thúc, ghi bookmark và số liệu nền;
   - áp `0012` → deploy Worker mới (vẫn bảo trì) → deploy Pages;
   - kiểm, rồi mở lại.
3. **Sau cửa sổ (6.18–6.20):** thử thật; sau ≥ 24 giờ ổn định đổi 302 thành 301; ghi `docs/deployment.md`.

**Mọi lệnh remote là điểm DỪNG VÀ HỎI user**: `--remote`, `wrangler deploy`, `wrangler versions …`, `wrangler d1 create/delete`, `wrangler pages deploy`, `time-travel`, `gh pr merge`, `gh run cancel`, `gh workflow disable/enable`. Ngoại lệ duy nhất là **chuỗi vận hành 6.10 → 6.17**: user chấp thuận một lần ở task 6.2, rồi chạy liền. Verify nào đỏ thì vẫn DỪNG theo Failure Protocol. <!-- Red Team #11 --> <!-- Updated: Kongming advice - một lần chấp thuận cho chuỗi từ bật tới tắt bảo trì -->

## Context links

- **Quy ước lệnh** (dùng cho mọi task). Mỗi phiên shell mới chạy lại đúng dòng này trước tiên: <!-- Updated: Kongming advice - W thành lệnh tuyệt đối, ghi cwd -->
  ```sh
  export WT=/Users/plateau/Project/worktrees/CamNangTQCCL-doi-tu-build CW=/Users/plateau/Project/worktrees/CamNangTQCCL-doi-tu-build/community-worker W=/Users/plateau/Project/worktrees/CamNangTQCCL-doi-tu-build/community-worker/node_modules/.bin/wrangler
  ```
  - `"$W"` là wrangler của worktree `feat/doi-tu-build`, cài ở task 6.1 (rồi cài lại trên `M` ở task 6.7).
  - Mỗi nhóm lệnh ghi rõ **cwd**:
    - lệnh vào D1/Worker production chạy trong `"$CW"` (đọc `wrangler.jsonc` ở đó);
    - lệnh Pages và `gh` chạy trong `"$WT"`;
    - lệnh diễn tập chạy trong `/tmp/dtb-rehearsal` với `--config wrangler.jsonc`.
- **Mốc thời gian** (cron `17 * * * *` ở `community-worker/wrangler.jsonc` `triggers`; các mốc dưới dùng phút của `date +%M`, giờ Việt Nam và UTC lệch đúng số giờ nên phút như nhau): <!-- Updated: Kongming advice - mốc thời gian cửa sổ -->
  - `HH` = giờ bắt đầu đã chốt ở 6.2.
  - Bật bảo trì (6.10) trong khoảng `HH:20`–`HH:25`. Quá `HH:25` thì không bật; dời sang giờ kế tiếp và hỏi user.
  - Áp migration (6.13) chỉ khi đồng hồ ≤ `HH:50`. Quá mốc thì không áp; DỪNG, hỏi user làm R0.
  - Hạn chót mở lại (6.17) là `(HH+1):15`, trước lần cron kế tiếp.
  - Mỗi task trong cửa sổ bắt đầu bằng `date +%H:%M:%S` và ghi giờ vào `release-log.md`.
- Lệnh deploy Pages tay: `docs/deployment.md` "Deploy Commands". Build tay thiếu `COMMUNITY_API_ORIGIN` thì blog rỗng (`docs/community-worker.md`).
- `.github/workflows/pages-deploy.yml` chạy khi có `repository_dispatch` (`blog-publish`, `site-publish`) do Worker gửi, hoặc khi chạy tay. Nó luôn build từ `main` (≈`:2-11`). Sau khi merge `M`, một lần duyệt/xuất bản ở Worker cũ có thể deploy frontend mới trước migration. Vì vậy workflow bị tắt từ trước merge (6.5) tới khi mở lại (6.17).
- Bookmark và phiên bản hiện tại: `docs/deployment.md` "Latest Community Worker Deploy". Gói Workers Free ⇒ Time Travel 7 ngày.
- Tính nguyên tử của `migrations apply --remote` chỉ là suy luận ([researcher §2.3](./reports/researcher-261023-cloudflare-cutover.md)). Fake D1 và workerd cục bộ không chứng minh được điều này, nên phải diễn tập. <!-- Red Team #1 -->
- Request ghi lọt vào **trước** khi bảo trì có hiệu lực vẫn có thể kết thúc **sau** đó: <!-- Updated: Kongming advice - chứng minh hết request ghi trước B0 -->
  - `POST /api/community-teams` chép ảnh R2 (`MEDIA.get` rồi `MEDIA.put`) rồi mới `DB.batch` (`community-worker/src/routes/teams.ts` `≈:287-339`). Code không có timeout riêng cho đoạn này.
  - Route gọi AI có trần tổng `MAX_BUDGET_MS = 180_000` (`shared/ai-config.ts` ≈`:69`); đây là request ghi chạy lâu nhất mà code giới hạn được.
  - Task 6.11 chờ 200 s (> 180 s), rồi so hai "dấu vân tay" ghi cách nhau 30 s. Chỉ khi hai dấu bằng nhau mới lấy B0.
- Trong bảo trì vẫn có ghi ([phase 2 Context](./phase-02-worker-bao-tri-body-md-migration.md)):
  - `last_seen_at`, `rate_limits`, rate limit của Better Auth;
  - OAuth callback của luồng đã bắt đầu trước khi bật;
  - cron `17 * * * *` (mốc thời gian ở trên giữ cửa sổ không cắt qua phút `:17`). <!-- Red Team #10 -->
- Tab đang mở "Theo dõi chiêu mộ"/roster sync gặp 503 `maintenance` sẽ coi là "không khả dụng" (phase 4 task 4.7) và tự chờ. Tab còn chạy JS cũ thì hiện "Tính năng cộng đồng tạm thời không khả dụng". <!-- Red Team #10 -->
- Sổ ghi: `plans/261022-1828-doi-tu-build/reports/release-log.md` trong worktree `feat/doi-tu-build`. Các mục có sẵn: "Điều kiện bắt đầu", "P0" (`P0`, `V_P0`, `V_P0_MAINT`), "Gói TipTap", "Hợp đồng TipTap", "Build", "Preview", "IME".

## Files to Create/Modify

- Ghi: `plans/261022-1828-doi-tu-build/reports/release-log.md`
- Sửa (task 6.19, nhánh mới): `pipeline/lookup_route_handles.py` (`RENAMED_PAGE_STATUS`), `public/_redirects`
- Sửa (task 6.20, nhánh mới): `docs/deployment.md`, `plans/261022-1828-doi-tu-build/plan.md` (status), các `phase-*.md` (status)
- Tạm, ngoài repo (xoá sau khi dùng): `/tmp/dtb-rehearsal/`, `/tmp/dtb-rollback/`

## Tasks

### Chặng 1 — Chuẩn bị (chưa bảo trì)

### Task 6.1 — Điều kiện trước cửa sổ (cục bộ)
- Goal: mọi thứ sẵn sàng trước khi động vào production; `"$W"` chạy được.
- Target files and symbols: PR `feat/doi-tu-build` (mở ở task 5.5), `release-log.md`.
- Steps (cwd `"$WT"`, sau dòng `export` của Quy ước lệnh):
  1. `git fetch origin && git merge --no-edit origin/main`.
  2. Chạy cổng trên head PR:
     ```sh
     npm ci && npm run test:node && npm run build && npm run verify && npm run test:dist \
       && npx playwright test tests-e2e/community-teams.spec.mjs \
       && python3 -m unittest tests.test_lookup_route_handles && python3 -m pipeline.lookup_route_handles --check \
       && python3 -m pipeline.site_localization check --root . --stage public \
       && (cd "$CW" && npm ci && npm test && npm run typecheck)
     ```
  3. `"$W" --version`.
  4. Mở `release-log.md`, xác nhận có:
     - mục "P0" chứa `V_P0` và `V_P0_MAINT`;
     - mục "Preview" có 7 dòng `302` đúng đích;
     - mục "IME" tồn tại (nội dung tuỳ ý, **không** chặn). <!-- Red Team #14 -->
  5. Nếu bước 1 tạo merge commit: `git push`.
- Success criteria: cổng xanh; `"$W"` in số phiên bản; ba mục có đủ.
- Verify: lệnh bước 2 exit 0; bước 3 in một dòng chứa số phiên bản dạng `N.N.N`; `release-log.md` chứa `V_P0_MAINT`, tiêu đề `Preview` và tiêu đề `IME`.

### Task 6.2 — Chốt lịch và một lần chấp thuận cho chuỗi vận hành (DỪNG VÀ HỎI) <!-- Red Team #11 --> <!-- Updated: Kongming advice - chấp thuận chuỗi 6.10–6.17 có định danh -->
- Goal: user chốt giờ `HH`, thứ tự với plan `261022-1109`, và chấp thuận trước cho chuỗi vận hành định danh 6.10 → 6.17.
- Target files and symbols: `release-log.md` mục "Cửa sổ".
- Steps:
  1. Hỏi user:
     - Giờ `HH` (bật bảo trì lúc `HH:20`–`HH:25`, hạn chót mở lại `(HH+1):15`).
     - Có cần báo trước cho người dùng không.
     - Có chấp thuận chạy liền, không hỏi lại giữa chừng, đúng các lệnh remote sau không:
       - 6.10 `"$W" versions deploy <V_P0_MAINT>@100% -y` (bật bảo trì);
       - 6.11 các lệnh `"$W" d1 execute tqccl-community --remote` chỉ đọc (dấu vân tay; 2 tới 5 lần);
       - 6.12 `"$W" d1 time-travel info tqccl-community` và hai truy vấn nền chỉ đọc;
       - 6.13 `npm run db:migrate:remote`;
       - 6.14 `"$W" versions deploy <V_NEW_MAINT>@100% -y`;
       - 6.15 `"$W" pages deploy dist --project-name tqccl --branch main --commit-hash <M>`;
       - 6.16 các truy vấn `d1 execute --remote` chỉ đọc và `curl`;
       - 6.17 `"$W" versions deploy <V_NEW_OPEN>@100% -y` và `gh workflow enable pages-deploy.yml`.
     - Nói rõ: Verify nào đỏ, hoặc quá mốc thời gian, thì chuỗi DỪNG và hỏi lại; lệnh rollback vẫn hỏi riêng.
  2. Ghi câu trả lời vào `release-log.md` mục "Cửa sổ", kèm `HH` và câu nguyên văn chấp thuận chuỗi.
- Success criteria: có `HH` và có chấp thuận chuỗi 6.10–6.17.
- Verify: `release-log.md` mục "Cửa sổ" có dòng `HH:` và dòng chấp thuận ghi "6.10–6.17".

### Task 6.3 — Diễn tập migration trên D1 tạm (remote — DỪNG VÀ HỎI) <!-- Red Team #1 --> <!-- Updated: Validation Session 1 - user đã đồng ý diễn tập về nguyên tắc --> <!-- Updated: Kongming advice - seed SQL nguyên văn, cwd tuyệt đối -->
- Chấp thuận: user đã đồng ý về nguyên tắc việc tạo rồi xoá D1 tạm `tqccl-community-rehearsal` (Validation Session 1, 2026-10-23). Vẫn hỏi user ngay trước mỗi lệnh remote của task này.
- Goal: biết chắc trên D1 remote rằng:
  - (a) một bản `0012` lỗi ở câu cuối **không** để lại thay đổi nào;
  - (b) bản `0012` thật áp được, gồm `DROP COLUMN`.
- Target files and symbols: D1 tạm `tqccl-community-rehearsal`; thư mục tạm `/tmp/dtb-rehearsal/`; `release-log.md` mục "Diễn tập".
- Steps (sau dòng `export` của Quy ước lệnh):
  1. cwd `"$CW"`: `"$W" d1 create tqccl-community-rehearsal` → ghi `database_id`.
  2. `mkdir -p /tmp/dtb-rehearsal/migrations && cp "$CW"/migrations/*.sql /tmp/dtb-rehearsal/migrations/ && rm /tmp/dtb-rehearsal/migrations/0012_doi_tu_build.sql && ls /tmp/dtb-rehearsal/migrations` (trên `0f89e2e` có đúng 8 file: `0001`, `0002`, `0003`, `0004`, `0005`, `0006`, `0008`, `0011`; **không** để lại `0012`).
  3. Tạo `/tmp/dtb-rehearsal/wrangler.jsonc`:
     ```jsonc
     { "name": "tqccl-rehearsal", "compatibility_date": "2026-01-01",
       "d1_databases": [{ "binding": "DB", "database_name": "tqccl-community-rehearsal", "database_id": "<database_id>", "migrations_dir": "migrations" }] }
     ```
  4. cwd `/tmp/dtb-rehearsal`: `"$W" d1 migrations apply tqccl-community-rehearsal --remote --config wrangler.jsonc` (trả lời `y` nếu được hỏi).
  5. Tạo `/tmp/dtb-rehearsal/seed.sql` với **đúng** nội dung dưới. Đây là schema cũ (trước `0012`); các câu chép từ helper `user`, `season`, `team`, `report` của `community-worker/test/teams-schema.test.ts` trên `0f89e2e` (≈`:16-53`), **không** dùng helper đã đổi ở task 2.8.
     ```sql
     insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", banned_until) values ('author', 'author', 'author@x.test', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', null);
     insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", banned_until) values ('u1', 'u1', 'u1@x.test', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', null);
     insert into community_seasons (id, label_vi, label_zh, opened_at, closed_at) values ('s1', 'Mùa s1', '赛季s1', 1, null);
     insert into community_teams (id, author_id, season_id, status, title, hero_1, hero_2, hero_3, hero_key, tactics, troop, playstyle, text_lang, created_at) values ('t1', 'author', 's1', 'approved', 't', 'hero:a', 'hero:b', 'hero:c', 'hero:a,hero:b,hero:c', '[]', 'cung', 'Lối chơi thử nghiệm', 'vi', 1);
     insert into comments (id, page_key, lang, user_id, body, created_at) values ('c1', '/doi-cong-dong/t1/', 'vi', 'u1', 'bình luận thử', 1);
     insert into battle_reports (id, page_key, lang, user_id, result, ally_heroes, enemy_heroes, status, created_at) values ('r1', '/doi-cong-dong/t1/', 'vi', 'u1', 'win', '[]', '[]', 'approved', 1);
     ```
     cwd `/tmp/dtb-rehearsal`: `"$W" d1 execute tqccl-community-rehearsal --remote --config wrangler.jsonc --file seed.sql`.
  6. `cp "$CW"/migrations/0012_doi_tu_build.sql /tmp/dtb-rehearsal/migrations/0012_broken.sql && printf '\ninsert into bang_khong_ton_tai (x) values (1);\n' >> /tmp/dtb-rehearsal/migrations/0012_broken.sql`. Chạy lại lệnh bước 4.
  7. Kiểm sau lần lỗi. cwd `/tmp/dtb-rehearsal`; mỗi câu là một lệnh `"$W" d1 execute tqccl-community-rehearsal --remote --config wrangler.jsonc --command "…"`:
     - `select (select count(*) from comments where page_key like '/doi-cong-dong/%') as c_old, (select count(*) from comments where page_key like '/doi-tu-build/%') as c_new, (select evidence_count from community_teams where id = 't1') as ev`;
     - `select name from pragma_table_xinfo('community_teams') where name in ('body_md','playstyle')`;
     - `select sql from sqlite_master where name = 'battle_reports_team_evidence_ins'`;
     - `select name from d1_migrations where name like '0012%'`.
  8. `rm /tmp/dtb-rehearsal/migrations/0012_broken.sql && cp "$CW"/migrations/0012_doi_tu_build.sql /tmp/dtb-rehearsal/migrations/`. Chạy lại lệnh bước 4. Kiểm bằng ba lệnh `d1 execute` như bước 7:
     - `select name from pragma_table_xinfo('community_teams') where name in ('body_md','playstyle')`;
     - `select page_key from comments`;
     - `select evidence_count, body_md like '## Lối chơi%' as ok from community_teams where id = 't1'`.
  9. cwd `"$CW"`: `"$W" d1 delete tqccl-community-rehearsal` (trả lời `y`); rồi `rm -rf /tmp/dtb-rehearsal`.
  10. Ghi output bước 6–8 vào `release-log.md` mục "Diễn tập".
- Success criteria:
  - Bước 6 báo lỗi.
  - Bước 7: `c_old = 1`, `c_new = 0`, `ev = 1`; chỉ in `playstyle`; SQL trigger chứa `substr(NEW.page_key, 16`; không có dòng `0012` trong `d1_migrations`.
  - Bước 8: lệnh apply thành công; chỉ in `body_md`; page key là `/doi-tu-build/t1/`; `evidence_count = 1`, `ok = 1`.
- Verify: so output với Success criteria. Bất kỳ lệch nào ở bước 7 (D1 remote **không** nguyên tử): DỪNG, **không** mở cửa sổ, báo user và `kongming`.

### Task 6.4 — Kiểm trước (remote, chỉ đọc — DỪNG VÀ HỎI)
- Goal: production chỉ còn thiếu đúng `0012`.
- Target files and symbols: D1 `tqccl-community`.
- Steps:
  1. cwd `"$CW"`: `"$W" d1 migrations list tqccl-community --remote`.
  2. Ghi output vào `release-log.md` mục "Kiểm trước".
- Success criteria: danh sách chưa áp chỉ có `0012_doi_tu_build.sql`.
- Verify: output bước 1 có đúng một dòng chưa áp là `0012_doi_tu_build.sql`.

### Task 6.5 — Tắt workflow Pages, không run nào đang chạy (remote — DỪNG VÀ HỎI) <!-- Updated: Kongming advice - dời lên trước bảo trì, tắt workflow trước merge -->
- Goal: từ lúc merge `M` tới lúc mở lại, không có build Pages tự động nào có thể đưa frontend mới lên trước migration.
- Target files and symbols: workflow `.github/workflows/pages-deploy.yml` (tên hiển thị `Pages deploy`).
- Steps (cwd `"$WT"`):
  1. `gh workflow disable pages-deploy.yml`.
  2. `gh api repos/{owner}/{repo}/actions/workflows/pages-deploy.yml -q .state`.
  3. `gh run list --workflow pages-deploy.yml --limit 5 --json databaseId,status,createdAt`.
  4. Có run `in_progress` hoặc `queued` thì **hỏi user** rồi `gh run cancel <databaseId>`; chạy lại bước 3.
  5. Ghi vào `release-log.md` mục "Workflow": "đã tắt lúc <giờ>".
- Success criteria: workflow tắt; không run nào `in_progress`/`queued`.
- Verify: bước 2 in `disabled_manually`; output bước 3 (lần cuối) không chứa `"in_progress"` và `"queued"`.

### Task 6.6 — Guard Worker và merge PR (remote — DỪNG VÀ HỎI) <!-- Updated: Kongming advice - merge trước cửa sổ -->
- Goal: `main` chứa code mới; ghi SHA trước merge `P` và SHA merge `M`; code Worker trên `main` trước merge vẫn đúng là `P0` (nên `V_P0`/`V_P0_MAINT` khớp `P`).
- Target files and symbols: PR `feat/doi-tu-build`.
- Steps (cwd `"$WT"`):
  1. `git fetch origin && git log <P0>..origin/main --oneline -- community-worker shared worker/src`. Phải rỗng. Có commit thì DỪNG và hỏi.
  2. `git rev-parse --short origin/main` → ghi là `P` (dùng cho rollback R2).
  3. `gh pr merge <số PR> --merge`.
  4. `git fetch origin && git switch --detach origin/main && git rev-parse --short HEAD` → ghi là `M`. Từ đây tới 6.17, worktree này đứng ở `M`. <!-- Red Team #2 -->
- Success criteria: guard rỗng; worktree ở `M` có file migration `0012`.
- Verify: bước 1 in rỗng; `test -f "$CW"/migrations/0012_doi_tu_build.sql` exit 0; `git rev-parse --short HEAD` bằng `M`.

### Task 6.7 — Build và kiểm trên `M` (cục bộ)
- Goal: `dist/` đúng của `M`, có blog thật; dependency của `M` đã cài.
- Target files and symbols: `"$WT"`, `"$CW"`.
- Steps:
  1. cwd `"$WT"`: `npm ci && (cd "$CW" && npm ci && npm test && npm run typecheck)`.
  2. cwd `"$WT"`: `COMMUNITY_API_ORIGIN=https://tqccl-community.nguyennlt-ncc.workers.dev npm run build && npm run verify`.
- Success criteria: build và verify xanh.
- Verify: bước 1–2 exit 0; `tail -n 4 "$WT"/dist/_redirects` in đúng 4 rule `302` của phase 3 task 3.3; `test -f "$WT"/dist/doi-tu-build/index.html` exit 0.

### Task 6.8 — Upload sẵn hai version Worker (remote, chưa nhận traffic — DỪNG VÀ HỎI)
- Goal: có `V_NEW_MAINT` (code mới, bảo trì bật) và `V_NEW_OPEN` (code mới, bảo trì tắt).
- Target files and symbols: Worker `tqccl-community`.
- Steps (cwd `"$CW"`, ở `M`):
  1. `"$W" versions upload --var MAINTENANCE:true --message "doi-tu-build maint <M>"` → ghi `V_NEW_MAINT`.
  2. `"$W" versions upload --message "doi-tu-build open <M>"` → ghi `V_NEW_OPEN`.
- Success criteria: hai Version ID khác nhau, đã ghi. Cờ `--var` của `versions upload` đã được dùng ở task 2.2; nếu wrangler báo lỗi thì DỪNG, không thay bằng `wrangler deploy`.
- Verify: output mỗi lệnh có `Version ID`; `release-log.md` có `V_NEW_MAINT` và `V_NEW_OPEN`.

### Task 6.9 — Bảng lệnh cửa sổ (cục bộ) <!-- Updated: Kongming advice - chuẩn bị lệnh trước cửa sổ -->
- Goal: mọi lệnh 6.10–6.17 được viết sẵn với ID thật, để trong cửa sổ chỉ chép và chạy.
- Target files and symbols: `release-log.md` mục "Bảng lệnh".
- Steps:
  1. Chép nguyên văn khối lệnh của task 6.10–6.17 vào mục "Bảng lệnh", thay mọi `<V_P0_MAINT>`, `<V_NEW_MAINT>`, `<V_NEW_OPEN>`, `<M>`, `<V_P0>` bằng giá trị đã ghi.
  2. Ghi thêm ba mốc giờ tuyệt đối theo `HH`: bật `HH:20`–`HH:25`, migration ≤ `HH:50`, mở lại ≤ `(HH+1):15`.
  3. Nhắc ở đầu mục: từ 6.10 tới 6.17 **không ai được chạy `npm run deploy`** trong `community-worker/`, vì lệnh đó đặt lại `MAINTENANCE="false"`.
- Success criteria: mục "Bảng lệnh" không còn chỗ giữ chỗ.
- Verify: trong mục "Bảng lệnh" của `release-log.md`, tìm `<V_` và `<M>` không ra kết quả nào; mục có ba mốc giờ.

### Chặng 2 — Cửa sổ bảo trì (chuỗi đã chấp thuận ở 6.2)

### Task 6.10 — Bật bảo trì bằng version đã upload <!-- Red Team #11 -->
- Goal: Worker P0 chạy với bảo trì bật, đúng trong khung giờ.
- Target files and symbols: Worker `tqccl-community`; `V_P0_MAINT`.
- Steps (cwd `"$CW"`):
  1. `date +%H:%M:%S`. Phút phải trong `20`–`25` của giờ `HH`; ngoài khoảng thì không chạy tiếp, DỪNG và hỏi user dời giờ.
  2. `"$W" versions deploy <V_P0_MAINT>@100% -y`.
  3. `curl -sS -X POST https://tqccl.com/api/comments -H "Origin: https://tqccl.com" -H "Content-Type: application/json" -d '{}' -w "\n%{http_code}\n"`.
  4. Ghi `T_on` = giờ lúc bước 3 lần đầu thấy `503` vào `release-log.md` mục "Cửa sổ".
- Success criteria: POST trả 503 với mã `maintenance`.
- Verify: output bước 3 có `"code":"maintenance"` và dòng cuối `503`. Chưa đạt thì lặp curl tối đa 6 lần, cách nhau 10 giây; vẫn không đạt thì DỪNG.

### Task 6.11 — Chờ request ghi cũ kết thúc (remote, chỉ đọc) <!-- Updated: Kongming advice - bước drain có điều kiện đạt so sánh được -->
- Goal: chứng minh không còn request ghi nào bắt đầu trước `T_on` đang chạy, trước khi lấy B0.
- Target files and symbols: D1 `tqccl-community`.
- Steps (cwd `"$CW"`):
  1. Chờ tới khi đồng hồ ≥ `T_on` + 200 s (`sleep` đủ số giây còn lại). 200 s lớn hơn trần AI 180 s (`shared/ai-config.ts` `MAX_BUDGET_MS`).
  2. Dấu vân tay F1: `"$W" d1 execute tqccl-community --remote --command "select (select count(*) || ':' || coalesce(max(created_at), 0) from comments) as c, (select count(*) || ':' || coalesce(max(created_at), 0) from battle_reports) as r, (select count(*) || ':' || coalesce(max(created_at), 0) from community_teams) as t, (select count(*) || ':' || coalesce(sum(value), 0) from community_team_votes) as v, (select count(*) || ':' || coalesce(sum(status = 'attached'), 0) || ':' || coalesce(max(created_at), 0) from uploads) as u, (select count(*) || ':' || coalesce(max(updated_at), 0) from posts) as p, (select count(*) || ':' || coalesce(max(created_at), 0) from feedback) as f"`.
  3. `sleep 30`, rồi chạy lại đúng lệnh bước 2 → F2.
  4. Nếu F1 ≠ F2: `sleep 30`, chạy lại lệnh bước 2 → F3, so với F2; lặp tối đa 3 lần.
  5. Ghi các dấu và giờ vào `release-log.md` mục "Drain".
- Success criteria: có hai dấu liên tiếp bằng nhau trên cả 7 cột, lấy cách nhau 30 s, lần đầu ≥ `T_on` + 200 s.
- Verify: so từng cột của hai dấu cuối, phải bằng nhau. Sau 3 lần lặp vẫn khác thì DỪNG, **không** lấy B0, hỏi user làm R0.

### Task 6.12 — Bookmark và số liệu nền (remote, chỉ đọc)
- Goal: có bookmark B0 **sau khi đã hết request ghi cũ**, và có số liệu để so sau migration.
- Target files and symbols: D1 `tqccl-community`; `release-log.md` mục "Nền".
- Steps (cwd `"$CW"`):
  1. `"$W" d1 time-travel info tqccl-community` → ghi bookmark `B0` và giờ UTC.
  2. `"$W" d1 execute tqccl-community --remote --command "select (select count(*) from comments where page_key like '/doi-cong-dong/%') as c_old, (select count(*) from battle_reports where page_key like '/doi-cong-dong/%') as r_old, (select count(*) from community_teams) as teams"`
  3. `"$W" d1 execute tqccl-community --remote --command "select id, status, evidence_count from community_teams order by id"`
  4. Ghi nguyên output bước 2–3 vào `release-log.md`.
- Success criteria: có `B0`, `c_old`, `r_old`, `teams` và bảng `evidence_count`.
- Verify: mục "Nền" có dòng bắt đầu bằng `B0:` và ba số `c_old`, `r_old`, `teams`.

### Task 6.13 — Áp migration `0012` <!-- Red Team #11 -->
- Goal: D1 production có `body_md`, page key mới, trigger mới, không còn 6 cột.
- Target files and symbols: D1 `tqccl-community`.
- Steps (cwd `"$CW"`):
  1. `date +%H:%M`. Phải ≤ `HH:50`; quá mốc thì **không** áp, DỪNG, hỏi user làm R0.
  2. `npm run db:migrate:remote` (trả lời `y` nếu được hỏi).
  3. Thành công thì sang **ngay** task 6.14.
- Success criteria: `0012_doi_tu_build.sql` được đánh dấu đã áp.
- Verify: output bước 2 có `0012_doi_tu_build.sql` và không có `ERROR`. Lỗi thì DỪNG và theo Rollback R1.

### Task 6.14 — Deploy Worker mới, vẫn bảo trì
- Goal: thu khe hở Worker cũ đọc schema mới xuống vài giây.
- Target files and symbols: Worker `tqccl-community`.
- Steps (cwd `"$CW"`):
  1. `"$W" versions deploy <V_NEW_MAINT>@100% -y`
  2. `curl -sS https://tqccl.com/api/community-teams/export`
  3. Lệnh curl POST của task 6.10 bước 3.
  4. Sang **ngay** task 6.15.
- Success criteria: export trả schema v2; POST vẫn 503.
- Verify: output bước 2 bắt đầu bằng `{"schemaVersion":2`; dòng cuối bước 3 là `503`.

### Task 6.15 — Deploy Pages
- Goal: frontend mới (route, chuyển hướng 302, editor) lên production.
- Target files and symbols: Pages project `tqccl`.
- Steps (cwd `"$WT"`):
  1. `"$W" pages deploy dist --project-name tqccl --branch main --commit-hash <M>` → ghi URL deployment.
- Success criteria: có URL `https://<hash>.tqccl.pages.dev`.
- Verify: output có `Deployment complete` (hoặc dòng có URL `.tqccl.pages.dev`); URL đã ghi vào `release-log.md`.

### Task 6.16 — Kiểm sau cutover (remote, chỉ đọc)
- Goal: dữ liệu, URL và API khớp kỳ vọng trước khi mở.
- Target files and symbols: `https://tqccl.com`, D1.
- Steps:
  1. cwd bất kỳ. Chuyển hướng trên production:
     ```sh
     for p in "/doi-cong-dong/?id=abc" "/doi-cong-dong/?new=1" "/doi-cong-dong/?mine=1" "/doi-cong-dong" "/doi-cong-dong/" "/zh/doi-cong-dong/?id=abc" "/zh/doi-cong-dong"; do
       curl -sS -o /dev/null -w "%{http_code} $p -> %{redirect_url}\n" "https://tqccl.com$p"
     done
     ```
  2. `curl -sS -o /dev/null -w "%{http_code}\n" https://tqccl.com/doi-tu-build/` và tương tự `/zh/doi-tu-build/`.
  3. `curl -sS https://tqccl.com/doi-tu-build/ | grep -c 'src="/_astro/'`
  4. `curl -sS "https://tqccl.com/api/comments?page=/doi-cong-dong/x/&lang=vi" -w "\n%{http_code}\n"` (page key cũ được chuẩn hoá; đội không tồn tại nên rỗng). <!-- Red Team #8 -->
  5. cwd `"$CW"`: `"$W" d1 execute tqccl-community --remote --command "select (select count(*) from comments where page_key like '/doi-cong-dong/%') as c_old, (select count(*) from comments where page_key like '/doi-tu-build/%') as c_new, (select count(*) from battle_reports where page_key like '/doi-cong-dong/%') as r_old, (select count(*) from battle_reports where page_key like '/doi-tu-build/%') as r_new, (select count(*) from community_teams) as teams, (select count(*) from community_teams where body_md = '') as empty_body"`
  6. cwd `"$CW"`: `"$W" d1 execute tqccl-community --remote --command "select id, status, evidence_count from community_teams order by id"`
  7. cwd `"$CW"`: `"$W" d1 execute tqccl-community --remote --command "select name from pragma_table_xinfo('community_teams') where name in ('playstyle','strengths','weaknesses','counters','countered_by','substitutes','body_md')"`
  8. **Hỏi user** mở trình duyệt (tài khoản quản trị): `/doi-tu-build/` hiện danh sách không lỗi; `/quan-tri/#doi-tu-build` "Xem bài" của một đội (nếu có) hiện tiêu đề `Lối chơi`; `/doi-tu-build/?new=1` hiện editor; `/bai-viet/` còn bài blog.
  9. Ghi mọi output vào `release-log.md` mục "Sau cutover".
- Success criteria:
  - Bước 1: đủ 7 dòng `302`, đích như phase 4 task 4.12.
  - Bước 2: hai lần `200`. Bước 3: ≥ `1`.
  - Bước 4: `{"items":[],"nextCursor":null}` và `200`.
  - Bước 5: `c_old = 0`, `r_old = 0`, `c_new` = `c_old` của 6.12, `r_new` = `r_old` của 6.12, `teams` bằng nền, `empty_body = 0`.
  - Bước 6: từng `evidence_count` bằng nền. Bước 7: chỉ in `body_md`.
  - Bước 8: user xác nhận.
- Verify: so từng output với Success criteria. Lệch bất kỳ chỗ nào thì DỪNG, hỏi user, theo Rollback R2.

### Task 6.17 — Mở lại và bật lại workflow Pages
- Goal: ghi hoạt động bình thường với Worker mới, trước hạn chót.
- Target files and symbols: Worker `tqccl-community`; workflow `pages-deploy.yml`.
- Steps:
  1. `date +%H:%M`. Ghi giờ. Nếu đã quá `(HH+1):15` thì vẫn làm tiếp bước 2–4 (đã migration, không còn R0), và ghi "quá hạn chót" vào `release-log.md` để R2 tính thêm dòng `uploads` bị cron đụng.
  2. cwd `"$CW"`: `"$W" versions deploy <V_NEW_OPEN>@100% -y`
  3. Lệnh curl POST của task 6.10 bước 3.
  4. cwd `"$WT"`: `gh workflow enable pages-deploy.yml && gh api repos/{owner}/{repo}/actions/workflows/pages-deploy.yml -q .state`.
- Success criteria: POST không đăng nhập trả 401; workflow bật lại.
- Verify: dòng cuối output bước 3 là `401`; bước 4 in `active`. Ghi thời điểm mở vào `release-log.md`; từ đây không dùng Time Travel nữa.

### Chặng 3 — Sau cửa sổ

### Task 6.18 — Thử thật sau khi mở (user — DỪNG VÀ HỎI)
- Goal: một vòng đăng bài thật chạy trên production.
- Target files and symbols: `https://tqccl.com/doi-tu-build/?new=1`.
- Steps:
  1. User đăng nhập, chọn một ảnh đội (AI tự đọc, thấy "Còn N lượt"), sửa ô, viết vài dòng có `## Lối chơi`, gửi.
  2. Quản trị mở `/quan-tri/#doi-tu-build`; "Xem bài" hiện đúng thân bài; từ chối bài thử với lý do "thử nghiệm".
  3. User vào "Đội đã đăng", bấm "Đăng lại", thấy form điền sẵn (không gửi lại); xoá bài thử.
- Success criteria: các bước chạy, không lỗi.
- Verify: user xác nhận; ghi vào `release-log.md` mục "Thử thật".

### Task 6.19 — Đổi chuyển hướng 302 → 301 sau ≥ 24 giờ ổn định (DỪNG VÀ HỎI) <!-- Red Team #7 -->
- Goal: 4 rule đổi tên thành `301` sau khi production đã chạy ổn ≥ 24 giờ, không cần rollback.
- Target files and symbols: `pipeline/lookup_route_handles.py` `RENAMED_PAGE_STATUS`; `public/_redirects`.
- Steps (cwd `"$WT"`):
  1. Hỏi user: đã ≥ 24 giờ từ task 6.17 và không có sự cố cần lùi?
  2. `git fetch origin && git switch -c fix/doi-tu-build-301 origin/main`.
  3. `RENAMED_PAGE_STATUS = 302` → `301`; sửa chú thích ngay trên thành "301 từ <ngày> (đã ổn định sau cutover)".
  4. `python3 -m pipeline.lookup_route_handles --write && python3 -m unittest tests.test_lookup_route_handles && python3 -m pipeline.lookup_route_handles --check`.
  5. `npm ci && COMMUNITY_API_ORIGIN=https://tqccl-community.nguyennlt-ncc.workers.dev npm run build && npm run verify`.
  6. `git add pipeline/lookup_route_handles.py public/_redirects`, `git diff --cached --name-only`, `git commit -m "fix(site): make /doi-cong-dong redirects permanent (301)"`, `git push -u origin fix/doi-tu-build-301`, `gh pr create --fill --base main`. **Hỏi user** rồi `gh pr merge --merge`.
  7. `git fetch origin && git switch --detach origin/main`, lặp bước 5, rồi **hỏi user** và chạy `"$W" pages deploy dist --project-name tqccl --branch main --commit-hash $(git rev-parse --short HEAD)`.
  8. Chạy lại vòng `curl` của task 6.16 bước 1.
- Success criteria: 7 dòng `301`, đích như cũ.
- Verify: bước 4 exit 0 và unittest in `OK`; `tail -n 4 public/_redirects` có 4 dòng kết thúc bằng ` 301`; output bước 8 có 7 dòng `301`.

### Task 6.20 — Ghi docs triển khai và đóng plan
- Goal: `docs/deployment.md` phản ánh production; plan đổi trạng thái.
- Target files and symbols: `docs/deployment.md` mục "Latest Community Worker Deploy" và "Latest Static Pages Deploy"; `plans/261022-1828-doi-tu-build/plan.md` (`status`), các `phase-*.md` (`status`).
- Steps (cwd `"$WT"`):
  1. `git fetch origin && git switch -c docs/deploy-doi-tu-build origin/main`.
  2. `docs/deployment.md`:
     - Community Worker: ngày giờ UTC; `V_NEW_OPEN` (source `M`); migration `0012` và bookmark `B0`; kết quả diễn tập (6.3) và drain (6.11); `V_P0`/`V_P0_MAINT` (P0, ngày); rollback target `V_P0`. Bản cũ xuống dòng "Previous".
     - Static Pages: URL deployment của 6.15 và 6.19; source `M` và SHA 6.19; phương thức "wrangler pages deploy tay (Actions hết phút)"; kết quả kiểm chuyển hướng (302 rồi 301).
  3. `plan.md` `status: completed`; mọi phase `status: completed`.
  4. Commit chỉ đường dẫn: `git add docs/deployment.md plans/261022-1828-doi-tu-build/plan.md plans/261022-1828-doi-tu-build/phase-0*.md plans/261022-1828-doi-tu-build/reports/release-log.md`.
  5. `git diff --cached --name-only`; commit; `git push -u origin docs/deploy-doi-tu-build`; `gh pr create --fill`. **Hỏi user** trước `gh pr merge`.
  6. Báo user: plan `261022-1145-doi-cong-dong-cong-khai` có thể tiếp tục (rebase lên `main`, dùng bảng "Bàn giao cho plan công khai" trong `plan.md`).
  7. Hỏi user có muốn xoá worktree `/Users/plateau/Project/worktrees/CamNangTQCCL-worker-maintenance` và `…-doi-tu-build` không; chỉ xoá khi user đồng ý (`git worktree remove <path>`).
- Success criteria: PR docs mở (hoặc đã merge theo lệnh user); commit không có file lạ.
- Verify: `gh pr view docs/deploy-doi-tu-build --json state -q .state` in `OPEN` hoặc `MERGED`; output `git diff --cached --name-only` chỉ chứa đường dẫn của bước 4.

## Rollback

Mỗi bước rollback là lệnh remote và **không** nằm trong chấp thuận chuỗi của 6.2: hỏi user trước từng lệnh. Mọi lệnh dùng `"$W"` theo Quy ước lệnh; cwd ghi ở từng bước. <!-- Updated: Kongming advice - cwd tuyệt đối cho rollback -->

- **R0 — trước task 6.13 (chưa migration):**
  1. cwd `"$CW"`: `"$W" versions deploy <V_P0>@100% -y` để mở lại bằng code P0. (Nếu 6.10 chưa chạy thì bỏ bước này.)
  2. Nếu 6.6 đã merge: cwd `"$WT"`, `git fetch origin && git switch -c revert/doi-tu-build origin/main && git revert -m 1 <M> --no-edit && git push -u origin revert/doi-tu-build && gh pr create --fill --base main`, hỏi user rồi `gh pr merge --merge`.
  3. Chỉ sau khi bước 2 đã merge (hoặc 6.6 chưa merge): cwd `"$WT"`, `gh workflow enable pages-deploy.yml`.
  4. Pages production chưa đổi nên không cần deploy.
- **R1 — task 6.13 lỗi:** <!-- Red Team #1 -->
  1. Giữ nguyên `V_P0_MAINT` (bảo trì bật). **Không** mở lại.
  2. cwd `"$CW"`: chạy lại đúng truy vấn của 6.12 bước 2 và 3.
  3. cwd `"$CW"`: `"$W" d1 execute tqccl-community --remote --command "select name from pragma_table_xinfo('community_teams') where name in ('body_md','playstyle')"`.
  4. cwd `"$CW"`: `"$W" d1 execute tqccl-community --remote --command "select sql from sqlite_master where name = 'battle_reports_team_evidence_ins'"`.
  5. Đủ bốn điều kiện sau thì D1 không đổi, làm R0:
     - số ở bước 2 bằng nền;
     - `evidence_count` bằng nền;
     - bước 3 chỉ in `playstyle`;
     - SQL trigger còn `substr(NEW.page_key, 16`.
  6. Lệch bất kỳ điều kiện nào: làm R2 từ bước 2 (Time Travel B0) trong khi vẫn giữ `V_P0_MAINT`, rồi R0.
  7. Gửi lỗi cho `kongming`.
- **R2 — sau 6.13, trước 6.17 (vẫn bảo trì):**
  1. cwd `"$CW"`: `"$W" versions deploy <V_P0_MAINT>@100% -y` (code cũ, bảo trì bật).
  2. cwd `"$CW"`: `"$W" d1 time-travel restore tqccl-community --bookmark=<B0>`; ghi bookmark undo mà lệnh in ra.
  3. Nếu 6.15 đã chạy, deploy lại **cây cũ** kèm rule ngược, **không** dùng rollback trên dashboard: <!-- Red Team #7 -->
     - cwd `"$WT"`: `git worktree add --detach /tmp/dtb-rollback <P>`
     - cwd `/tmp/dtb-rollback`: `npm ci && COMMUNITY_API_ORIGIN=https://tqccl-community.nguyennlt-ncc.workers.dev npm run build && npm run verify`
     - Nối 4 dòng vào **`/tmp/dtb-rollback/dist/_redirects`** (không sửa `public/`):
       ```
       /doi-tu-build /doi-cong-dong/ 302
       /zh/doi-tu-build /zh/doi-cong-dong/ 302
       /doi-tu-build/* /doi-cong-dong/:splat 302
       /zh/doi-tu-build/* /zh/doi-cong-dong/:splat 302
       ```
     - cwd `/tmp/dtb-rollback`: `"$W" pages deploy dist --project-name tqccl --branch main --commit-hash <P>`
     - cwd `"$WT"`: `git worktree remove /tmp/dtb-rollback`
  4. Revert `M` trên `main` như R0 bước 2; workflow Pages chỉ bật lại sau khi revert đã merge (R0 bước 3).
  5. Kiểm (cwd `"$CW"`): lệnh của R1 bước 3 chỉ in `playstyle`; truy vấn 6.12 bước 2 cho `c_old`, `r_old` bằng nền.
  6. cwd `"$CW"`: `"$W" versions deploy <V_P0>@100% -y` để mở lại bằng code cũ.

  **Dữ liệu mất khi restore về B0** (báo user trước bước 2): <!-- Red Team #10 -->
  - Phiên và tài khoản tạo bởi OAuth callback của luồng bắt đầu trước khi bật bảo trì (người đó bị đăng xuất; tài khoản mới phải đăng nhập lại).
  - `user.last_seen_at` sau B0.
  - Bộ đếm `rate_limits` và rate limit của Better Auth sau B0 (có thể sống lại số cũ tới cửa sổ kế tiếp).
  - Nếu cửa sổ cắt qua phút `:17` (6.17 ghi "quá hạn chót"): dòng `uploads` pending > 24 giờ bị cron xoá sẽ sống lại trong D1, nhưng object R2 tương ứng đã mất (vô hại: cron kế tiếp xoá lại).

  Bình luận, chiến báo, đội, phiếu, bài viết và góp ý: mọi `POST/PUT/DELETE` mới dưới `/api/*` và mọi đăng nhập mới bị chặn từ 6.10. Request bắt đầu trước 6.10 đã được chứng minh là kết thúc trước B0, bằng hai dấu vân tay bằng nhau ở 6.11. Vì vậy mọi ghi loại này đều nằm trong B0. Đây là khẳng định có điều kiện: nếu 6.11 không đạt thì không có B0 và không đi tới đây. <!-- Updated: Kongming advice - bỏ khẳng định tuyệt đối "không mất" -->
- **R3 — sau 6.17 (đã mở):**
  - Không dùng Time Travel (mất mọi ghi sau B0). Chỉ sửa tiến: sửa trên nhánh mới, chạy cổng, deploy.
  - Cần dừng ghi trong lúc sửa thì cwd `"$CW"`: `"$W" versions deploy <V_NEW_MAINT>@100% -y`.
  - Không deploy lại Pages cũ (frontend cũ không hiểu `bodyMd`).
  - Chưa tới 6.19 thì chuyển hướng vẫn là 302, nên đổi đích không bị cache lâu.

## Risk

| Rủi ro | Khả năng × Tác động | Giảm thiểu |
|---|---|---|
| D1 remote không nguyên tử khi lỗi giữa file | Thấp × Cao | Diễn tập 6.3 trước cửa sổ; R1 kiểm bất biến đầy đủ <!-- Red Team #1 --> |
| Request ghi bắt đầu trước bảo trì kết thúc sau B0, restore làm mất hoặc lệch D1/R2 | Thấp × Cao | 6.11 chờ 200 s (> trần AI 180 s) rồi đòi hai dấu vân tay bằng nhau cách 30 s; không đạt thì không lấy B0 <!-- Updated: Kongming advice - drain trước B0 --> |
| Lan toả `versions deploy` chậm, POST lọt trước khi bảo trì có hiệu lực | Thấp × Trung bình | 6.10 lặp curl tới khi thấy 503; `T_on` tính từ lúc thấy 503 |
| Build Pages tự động đưa frontend mới lên trước migration | Thấp × Cao | 6.5 tắt `pages-deploy.yml` trước merge; 6.17 (hoặc R0 sau revert) mới bật lại <!-- Updated: Kongming advice - tắt workflow trước merge --> |
| Cửa sổ kéo dài cắt qua cron `:17` | Thấp × Thấp | Chuẩn bị xong trước cửa sổ (6.5–6.9); mốc `HH:20`–`HH:25`, migration ≤ `HH:50`, mở ≤ `(HH+1):15`; kiểm giờ ở 6.10, 6.13, 6.17 <!-- Updated: Kongming advice - mốc thời gian --> |
| Khe hở 6.13 → 6.14 làm GET đội lỗi 500 | Chắc chắn, vài giây × Thấp | Version upload sẵn ở 6.8; chuỗi chấp thuận một lần <!-- Red Team #11 --> |
| Ai đó `npm run deploy` trong cửa sổ, mở ghi trên schema đang đổi | Thấp × Cao | Cấm ghi trong "Bảng lệnh" ở 6.9 và trong docs P0 <!-- Red Team #11 --> |
| Tab cũ gửi đội bằng form cũ | Cao × Thấp | 400 `stale_client`; client cũ hiện câu 400 chung "Dữ liệu gửi lên chưa hợp lệ"; tải lại là hết <!-- Red Team #8 --> <!-- Updated: Validation Session 1 - stale_client 409 → 400 --> |
| Quên `COMMUNITY_API_ORIGIN` làm blog production rỗng | Thấp × Cao | Lệnh 6.7 có sẵn biến; 6.16 bước 8 kiểm `/bai-viet/` |

## Security

- Không commit secret; mọi lệnh dùng phiên `wrangler login`/`gh auth` của user.
- `release-log.md` chỉ chứa version ID, bookmark, số đếm, dấu vân tay (số đếm + mốc thời gian) và id đội; không ghi email hay nội dung người dùng.
- D1 diễn tập chỉ chứa dữ liệu giả và bị xoá ở 6.3 bước 9.

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
