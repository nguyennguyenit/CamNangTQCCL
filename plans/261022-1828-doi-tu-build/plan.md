---
title: "Đội tự build / 自配阵容: bài một đội + thân bài Markdown, URL /doi-tu-build/"
description: "Đổi Đội cộng đồng thành Đội tự build: 1 ảnh tự đọc AI, thân bài Markdown soạn bằng TipTap, renderer view-tree dùng chung, gộp 6 cột vào body_md, cutover /doi-cong-dong/ → /doi-tu-build/ trong cửa sổ bảo trì."
status: pending
priority: P1
effort: 6.5d
branch: feat/doi-tu-build
tags: [feature, frontend, backend, database, migration, editor, community]
blockedBy: []
blocks: [261022-1145-doi-cong-dong-cong-khai]
created: 2026-10-23
---

# Đội tự build / 自配阵容

Chế độ: `/ak:plan --hard --advice`. Plan viết cho executor yếu hơn: mỗi phase có task đánh số, lệnh kiểm so sánh được và khối **Failure Protocol** (gặp kiểm đỏ thì DỪNG, hỏi `kongming`). Bằng chứng: [scout](./reports/scout-261023-doi-tu-build.md), [TipTap + Astro](./reports/researcher-261023-tiptap-astro.md), [Cloudflare cutover](./reports/researcher-261023-cloudflare-cutover.md), [red team](./reports/red-team-261023.md). Số dòng `:NN` trong plan là tham chiếu **≈ trên `main` `0f89e2e`**; sau khi PR #36 và `fix/community-teams-ui-polish` merge, luôn tìm theo symbol/chuỗi ghi kèm. <!-- Red Team #3 -->

## Overview

Kho "Đội cộng đồng" hiện có form 6 ô chữ cố định (`community-worker/migrations/0008_community_teams.sql:27-32`), 1–3 ảnh, nút "Đọc bằng AI" bấm tay, URL `/doi-cong-dong/`. Plan này đổi thành **Đội tự build**: mỗi bài vẫn là một đội (3 tướng × 2 chiến pháp) nhưng có thân bài Markdown tự do, đúng một ảnh tự đọc AI, URL `/doi-tu-build/`, và đổi dữ liệu cũ một lần trong cửa sổ bảo trì.

## Outcome đã khoá

1. Bài mới: tiêu đề, binh chủng, 3 tướng + 6 chiến pháp, **đúng 1 ảnh** (chọn ảnh là tự tải lên rồi tự gọi AI một lần), thân bài Markdown ≤ 10 000 ký tự soạn bằng TipTap; form hiện số lượt đọc AI còn lại. AI lỗi, hết lượt hoặc editor không tải được vẫn nhập và gửi được (ô `<textarea>` dự phòng). <!-- Red Team #5, #12 -->
2. Bài cũ: 6 cột gộp thành `body_md` (`## Lối chơi`… theo `text_lang`), không cắt; ảnh 2–3 của bài cũ vẫn xem được.
3. Chi tiết, quản trị và export hiển thị thân bài qua **một** renderer `js/markdown.js` (profile `ugc`: không ảnh, link khác origin `rel="nofollow ugc noopener"`, trích dẫn tối đa 2 cấp). <!-- Red Team #6 -->
4. URL `/doi-tu-build/` và `/zh/doi-tu-build/`; mọi `/doi-cong-dong…` chuyển hướng giữ query: **302** lúc cutover, đổi **301** sau ≥ 24 giờ ổn định. Bình luận, chiến báo và `evidence_count` chuyển nguyên vẹn sang page key mới. <!-- Red Team #7 -->
5. Nháp tự lưu trên trình duyệt (hết hạn 30 ngày, xoá khi gửi/đăng xuất); bài bị từ chối có nút "Đăng lại" điền sẵn nội dung. <!-- Red Team #4 -->
6. Tên mới khắp UI, Privacy, docs: "Đội tự build" (vi) / "自配阵容" (zh).

## Quyết định thiết kế

- **Renderer**: `js/markdown.js` trả cây `js/view-tree.js` (`treeToHtml` cho Node, `treeToDom` cho trình duyệt). Profile `admin` giữ **đúng** hành vi renderer cũ (`js/community-admin.js` `renderMarkdown`), có test khoá. Chỉ profile `ugc` giải mã backslash escape/entity, nhận code span N backtick, fence N, `ol start`, link có ngoặc cân bằng, và giới hạn trích dẫn 2 cấp. So origin bằng `new URL(href, siteOrigin)` với `siteOrigin` truyền vào. Không dùng satteri cho UGC. <!-- Red Team #6, #15 -->
- **Tập Markdown của bài user**: `##`→h2, `###`→h3 (không h1); không list lồng; không HardBreak; dán HTML để schema lọc; chặn dán/thả file ảnh.
- **Editor**: TipTap **3.32.0** pin chính xác, cài `--ignore-scripts`, `npm audit signatures`, danh sách extension tường minh. Hợp đồng API của bản pin được chốt (task 4.3) trước khi dựng editor. Nạp qua custom element `<cm-md-editor>` trong `<script>` Astro có xử lý; `import()` khi connected, có token vòng đời bỏ kết quả về muộn; giữ giá trị mới nhất ở mỗi `update` và trước `destroy()`. Form chuyển sang `<textarea>` Markdown nếu 5 s chưa có `editor-ready` hoặc báo lỗi. Vite `build.target: 'safari16'`. <!-- Red Team #4, #5, #13 --> <!-- Updated: Kongming advice - editor-ready, token vòng đời, chốt hợp đồng sớm -->
- **Giới hạn 10 000 ký tự** chỉ kiểm lúc gửi (client) và ở `POST` (Worker). Bài cũ dài hơn vẫn đọc được.
- **Worker**: middleware `MAINTENANCE` chặn method ghi dưới `/api/*` **và** `POST /api/auth/*` trừ sign-out (503 `maintenance`, `Retry-After`); phát hành trước thành **release P0**, kèm sẵn version `V_P0_MAINT`. Sau cutover, page key `/doi-cong-dong/<id>/` được **chuẩn hoá** thành `/doi-tu-build/<id>/`; `POST` đội kiểu cũ (có `playstyle`, không `bodyMd`) trả **400** `stale_client`. `uploadIds` đúng 1. Export `schemaVersion: 2`. Analyze kiểm trần site trước (mã `site_quota`) và trả `remaining`. <!-- Red Team #8, #10, #11, #12 --> <!-- Updated: Validation Session 1 - stale_client 409 → 400 -->
- **Migration `0012_doi_tu_build.sql`**: thêm `body_md`, gộp 6 cột (escape có chọn lọc), đổi page key, dựng lại 3 trigger với `like '/doi-tu-build/%'` và `substr(page_key, 15, length(page_key) - 15)`, đếm lại `evidence_count`, `DROP COLUMN` 6 cột. Tính nguyên tử khi lỗi giữa chừng được **diễn tập** trên D1 tạm trước cutover; rollback chính là Time Travel bookmark. <!-- Red Team #1 -->
- **Chuyển hướng**: `RENAMED_PAGE_ROUTES` + `RENAMED_PAGE_STATUS` + `renamed_page_redirect_lines()` trong `pipeline/lookup_route_handles.py`; rule tĩnh trước, splat cuối file, vi + zh. <!-- Red Team #7 -->

## Không làm

Trang tĩnh từng đội, menu chính, landing, sitemap, FAQ/JSON-LD (thuộc plan công khai); ảnh trong thân bài; sửa bài sau khi đăng; đổi vote/duyệt/xếp hạng; đổi tên bảng `community_teams` hay `/api/community-teams`; đổi khoá R2; rule `_headers` cho `/_astro/*`; alias hash `/quan-tri/#doi-cong-dong`; sửa `docs/design/**` và `scripts/design-canvas/shot.mjs` (thay đổi chưa commit của user); sửa thẻ "null", tiêu đề lặp, nút "×" (đã sửa ở `fix/community-teams-ui-polish`). <!-- Red Team #2, #15 -->

## Ràng buộc

- Làm trong worktree `/Users/plateau/Project/worktrees/CamNangTQCCL-doi-tu-build`; mọi `git add` liệt kê đường dẫn tường minh. <!-- Red Team #2 -->
- Không file nào plan sửa được nằm trong `sourceFiles` của `pipeline/site-localization-policy.json` (PR #36 sửa file này; task 1.0 kiểm lại sau merge). Mỗi phase kết thúc bằng `python3 -m pipeline.site_localization check --root . --stage public` exit 0. <!-- Red Team #3 -->
- Không sửa `js/render.js`, `src/layouts/SiteLayout.astro`, `Landing.astro` (bị ghim), migration đã áp (`0001`–`0011`).
- GitHub Actions hết phút: Pages deploy bằng `wrangler pages deploy dist --project-name tqccl --branch main --commit-hash <sha>` (`docs/deployment.md` "Deploy Commands"); build tay phải đặt `COMMUNITY_API_ORIGIN`. Trong cửa sổ cutover cấm `npm run deploy` Worker. <!-- Red Team #11 -->
- Production D1 đã áp `0008` và `0011`; export production `{"schemaVersion":1,"items":[]}`; số bài pending/rejected chưa biết. Workers **Free** ⇒ Time Travel 7 ngày.

## Phase

| # | Phase | Effort | Phụ thuộc |
|---|---|---|---|
| 1 | [Renderer Markdown dùng chung](./phase-01-renderer-markdown-dung-chung.md) | 0.5d | PR #36 + ui-polish đã merge |
| 2 | [Worker: bảo trì P0, body_md, quota, migration 0012](./phase-02-worker-bao-tri-body-md-migration.md) | 1.75d | 1 |
| 3 | [Site: route /doi-tu-build/, chuyển hướng, link](./phase-03-site-route-doi-tu-build.md) | 0.5d | 2 |
| 4 | [Form, editor TipTap, trang chi tiết, preview](./phase-04-form-editor-chi-tiet.md) | 2.5d | 1, 2, 3 |
| 5 | [Đổi tên và docs](./phase-05-doi-ten-va-docs.md) | 0.5d | 4 |
| 6 | [Release và cutover production](./phase-06-release-cutover-runbook.md) | 0.75d | 5 (P0 đã live) |

Chạy tuần tự trên nhánh `feat/doi-tu-build`; riêng task 2.1 (P0) đi nhánh `feat/worker-maintenance` (worktree riêng) và merge trước.

## Phụ thuộc chéo plan

- **Điều kiện bắt đầu** (không phải plan id nên không ghi vào `blockedBy`): PR #36 (`feat/roster-client`, plan `261022-1109` phase 10) **đã merge** vào `main`, và nhánh `fix/community-teams-ui-polish` (commit `a1ba727`) **đã merge** vào `main`. Task 1.0 kiểm cả hai; chưa thì DỪNG. Hai nhánh này sửa đúng các file plan đụng tới (`js/community-auth.js`, `js/community-api.js` `signOut`, `js/community-teams.js`, `scripts/verify-astro-dist.mjs`, `public/_headers`, `PrivacyPage.astro`, `css/styles.css`, e2e). Nhãn link `?mine=1` theo #36 là "Đội đã đăng". <!-- Red Team #3 -->
- `plans/261022-1145-doi-cong-dong-cong-khai` (nhánh `feat/doi-cong-dong-cong-khai`): **tạm dừng**, chờ plan này xong rồi rebase.
- `plans/261022-1109-dot-gom-9-issue`: deploy Worker P0 và cửa sổ cutover xếp lịch với cửa sổ release của phase 11; xem "Dừng và hỏi".

## Bàn giao cho plan công khai

- Export `GET /api/community-teams/export` = `{schemaVersion: 2, items: [{…, bodyMd, approvedAt}]}`; không còn `analysis`.
- `js/markdown.js` `markdownTree(source, {profile: 'ugc', siteOrigin})` chạy trong Node; trang tĩnh dùng `treeToHtml` qua `set:html`, `siteOrigin` = `site` của `astro.config.mjs`.
- URL `/doi-tu-build/<id>/` (zh `/zh/doi-tu-build/<id>/`), page key `/doi-tu-build/<id>/`; rule chuyển hướng `/doi-cong-dong/*` đã có.
- Consumer v1 trên `feat/doi-cong-dong-cong-khai` phải đổi khi rebase (đã kiểm bằng `git show` 2026-10-23): <!-- Red Team #15 -->

| File:dòng trên nhánh công khai | Hiện tại | Phải đổi |
|---|---|---|
| `src/lib/community-teams.ts:157` | `schemaVersion !== 1` → fail | nhận `2` |
| `src/lib/community-teams.ts:119-131` | bắt buộc `analysis.playstyle` | đọc `bodyMd` (chuỗi) |
| `src/lib/community-teams.ts:47` | `/doi-cong-dong/${id}/` | `/doi-tu-build/${id}/` |
| `src/lib/community-team-pages.ts:38,52-90` | description/FAQ từ 6 trường | description từ đoạn đầu `bodyMd`; bỏ FAQ phân tích |
| `src/pages/{,zh/}doi-cong-dong/[id].astro` | route cũ | chuyển vào `doi-tu-build/` |
| `tests-js/fixtures/community-teams-export.json` (505 dòng) | v1 + `analysis` | v2 + `bodyMd` |
| `scripts/verify-astro-dist.mjs:89,185-187` | `listing: true`, regex `doi-cong-dong/<id>` | gộp với trường `editor` của phase 4; regex `doi-tu-build` |
| `plans/261022-1145-…/plan.md:73` | đòi `"schemaVersion":1` | `2` |

## Xong khi

- [ ] `cd community-worker && npm test && npm run typecheck` exit 0 (gồm test `site_quota`, `remaining`, chuẩn hoá page key, 400 `stale_client` cho payload cũ). <!-- Red Team #8, #12 --> <!-- Updated: Validation Session 1 - stale_client 400 -->
- [ ] `npm run test:node`, `npm run build`, `npm run verify`, `npm run test:dist`, `npx playwright test tests-e2e/community-teams.spec.mjs` exit 0.
- [ ] `python3 -m unittest tests.test_lookup_route_handles` và `python3 -m pipeline.lookup_route_handles --check` exit 0; 4 dòng cuối `public/_redirects` là rule `/doi-cong-dong` với mã **301** sau task 6.19 (302 trong lúc cutover). <!-- Red Team #7 --> <!-- Updated: Kongming advice - đánh số lại phase 6 -->
- [ ] Grep `doi-cong-dong|Đội cộng đồng|社区阵容|đội cộng đồng` chỉ còn các chỗ được phép ở phase 5.
- [ ] Production: chuyển hướng giữ query, export `schemaVersion` 2, số bình luận/chiến báo/`evidence_count` bằng số nền, `analyze` trả `remaining`, POST bình thường sau khi tắt `MAINTENANCE`.
- [ ] `docs/deployment.md` ghi version Worker (`V_P0`, `V_P0_MAINT`, `V_NEW_OPEN`), bookmark D1, deployment Pages, kết quả diễn tập migration.

## Dừng và hỏi chỉ khi

- Bất kỳ lệnh remote nào: `wrangler deploy`, `wrangler versions upload/deploy`, `wrangler d1 … --remote`, `wrangler d1 create/delete`, `wrangler pages deploy`, `wrangler d1 time-travel restore`, `gh pr merge`, push `main`, `gh workflow …`, `gh run cancel`.
- **Ngoại lệ duy nhất**: chuỗi vận hành task 6.10 → 6.17 (bật bảo trì → chờ request ghi cũ → bookmark → migrate → deploy Worker → deploy Pages → kiểm → mở lại) xin **một** lần chấp thuận ở task 6.2 rồi chạy liền. Chuỗi vẫn DỪNG nếu một Verify đỏ hoặc quá mốc thời gian; lệnh rollback vẫn hỏi riêng. Mọi chuẩn bị không cần bảo trì (tắt workflow, merge, build, upload version, bảng lệnh) làm trước ở 6.5–6.9. <!-- Red Team #11 --> <!-- Updated: Kongming advice - một lần chấp thuận cho chuỗi từ bật tới tắt bảo trì -->
- Trước khi deploy P0 hoặc mở cửa sổ cutover: xác nhận lịch với phase 11 của `261022-1109`.
- Một Verify không đạt (theo Failure Protocol của từng phase).
- Cần sửa file ngoài danh sách "Files" của phase, hoặc một file trong `sourceFiles` ghim.

## Rủi ro còn lại

| Rủi ro | Khả năng × Tác động | Giảm thiểu |
|---|---|---|
| Markdown của `@tiptap/markdown` (bản "early release") lệch renderer | Trung bình × Cao | Pin 3.32.0, test round-trip Node, renderer `ugc` giải mã escape/entity |
| IME tiếng Việt (Telex/Unikey/EVKey) hoặc chữ Hán lỗi trong ProseMirror | Trung bình × Trung bình | Không chặn độ dài trong editor, không đổi block khi `composing`, kiểm tay 3 tổ hợp user có (macOS Telex, iPhone Telex, Windows Unikey/EVKey), không chặn phát hành, `<textarea>` dự phòng <!-- Red Team #14 --> <!-- Updated: Validation Session 1 - IME chỉ 3 tổ hợp --> |
| `0012` lỗi giữa chừng trên D1 remote mà không tự rollback | Thấp × Cao | Đã diễn tập trên D1 tạm (task 6.3); R1 kiểm đủ bất biến, lệch thì Time Travel B0 khi vẫn bảo trì <!-- Red Team #1 --> |
| Tab mở trước cutover dùng JS cũ | Cao × Thấp | Bình luận/chiến báo: Worker chuẩn hoá page key cũ nên vẫn chạy. Gửi đội: 400 `stale_client`; client cũ không hiện message server nên chỉ thấy câu 400 chung ("Dữ liệu gửi lên chưa hợp lệ. Hãy kiểm tra lại."), không focus sai ô vì `stale_client` không thuộc `FIELD_CODES` của form cũ; `/js/*` revalidate nên tải lại là hết <!-- Red Team #8 --> <!-- Updated: Validation Session 1 - stale_client 409 → 400 --> |
| Chuyển hướng bị trình duyệt cache, khó lùi | Trung bình × Trung bình | 302 lúc cutover; R2 deploy cây cũ kèm rule ngược 302; chỉ đổi 301 sau ≥ 24 giờ ổn định <!-- Red Team #7 --> |
| Trần AI toàn site cạn | Trung bình × Thấp | Kiểm trần site trước, mã `site_quota` không trừ lượt user; nhập tay vẫn gửi được <!-- Red Team #12 --> |

## Red Team Review

### Session — 2026-10-23
**Findings:** 15 (15 accepted, 0 rejected)
**Severity breakdown:** 1 Critical, 8 High, 6 Medium

|#|Finding|Severity|Disposition|Applied To|
|---|---|---|---|---|
| 1 | Nguyên tử của migration remote chưa kiểm; R1 kiểm sai bất biến | Critical | Accept: task diễn tập 6.3 trên D1 tạm; R1 kiểm số nền + `pragma_table_info` + SQL trigger, lệch thì R2 | Phase 6, plan.md |
| 2 | `git add -A docs/scripts` gom thay đổi của user; `git switch` trên checkout chính | High | Accept: worktree riêng, `git add` tường minh, Verify `git diff --cached` | Phase 1, 2, 3, 4, 5, 6 |
| 3 | PR #36 + ui-polish sửa cùng file/dòng | High | Accept: điều kiện bắt đầu, task 1.0 kiểm merge + symbol + `sourceFiles`; neo theo symbol; nhãn "Đội đã đăng" | plan.md, mọi phase |
| 4 | Vòng đời nháp/editor/token | High | Accept: snapshot giá trị, `signal` từ `render()`, flush khi gỡ, chặn save sau 201, repost không autosave, `signOut` xoá nháp, TTL 30 ngày | Phase 4, 5 |
| 5 | Không có dự phòng khi editor không tải; Safari 16.0–16.3 | High | Accept: `<textarea>` dự phòng, `vite.build.target: 'safari16'`, e2e abort entry | Phase 4 |
| 6 | Blockquote đệ quy không giới hạn | High | Accept: `ugc` tối đa 2 cấp + test 9990 dấu `>` | Phase 1 |
| 7 | 301 công khai từ lúc deploy Pages; rollback kẹt | High | Accept: `RENAMED_PAGE_STATUS` 302 lúc cutover, task 6.17 đổi 301 (nay là 6.19 sau Kongming advice); R2 rule ngược 302 | Phase 3, 6 |
| 8 | `stale_client` không tới client cũ | High | Accept: chuẩn hoá page key cũ; `stale_client` cho POST đội kiểu cũ (409 lúc red team, **400** theo Validation Session 1); bỏ câu chết ở client mới; sửa Risk | Phase 2, 4, plan.md |
| 9 | `modeFromSearch` thêm `from` mọi nhánh | High | Accept: chỉ nhánh `new`; liệt kê assert `:63`, `:65`, `:164-170` | Phase 4 |
| 10 | MAINTENANCE không chặn hết ghi; R2 "không mất dữ liệu" sai | Medium | Accept: chặn `POST /api/auth/*` trừ sign-out; liệt kê ghi còn lại; tránh `:17` cả cửa sổ; `maintenance` → `unavailable` | Phase 2, 4, 6 |
| 11 | 6.4 deploy từ HEAD không ghim; chuỗi deploy hỏi nhiều lần | Medium | Accept: `V_P0_MAINT` upload ở 2.2; 6.5 chỉ `versions deploy`; guard `git log`; một lần đồng ý chuỗi 6.11→6.13; cấm `npm run deploy` (sau Kongming advice: bật bảo trì là 6.10, chuỗi chấp thuận 6.10→6.17) | Phase 2, 6, plan.md |
| 12 | Trần site tính như quota user; thiếu số lượt còn lại | Medium | Accept: kiểm trần site trước, `site_quota`, `remaining`, form hiện "Còn N lượt" | Phase 2, 4 |
| 13 | Chuỗi cung ứng TipTap | Medium | Accept: `--ignore-scripts`, `npm audit signatures`, ghi gói gián tiếp, rà lockfile | Phase 4 |
| 14 | IME 7 tổ hợp chặn phát hành; preview gọi Worker production | Medium | Accept: IME không chặn, chỉ thiết bị user có; gộp 3.8 vào 4.12; "không chọn ảnh"; deploy lại preview bằng main | Phase 3, 4, 6 |
| 15 | `admin` đổi hành vi; tự sửa 2 lỗi UI; Playwright 30 s; thiếu consumer v1; docs quy chuẩn | Medium | Accept: `admin` giữ đúng + test khoá; bỏ sửa UI; `playwright.config.mjs` vào phase 4; bảng consumer; `code-standards.md`, `system-architecture.md` | Phase 1, 4, 5, plan.md |

### Whole-Plan Consistency Sweep
- Files reread: plan.md, phase-01 … phase-06.
- Decision deltas checked: 15.
- Reconciled stale references: 17 — (1) "migration nguyên tử tự rollback" (plan.md Risk, phase 2 chú thích `0012`, phase 6 R1/Risk); (2) "301" lúc cutover (plan.md Outcome/Quyết định/Xong khi, phase 3 Goal/3.3/3.7, phase 4 preview, phase 6 6.14/6.18); (3) `stale_client` ở `parsePageKey` và ở client mới (phase 2 2.4/2.8, phase 4 4.7, phase 5 docs); (4) `from` ở mọi nhánh `modeFromSearch` (phase 4 4.6); (5) `git add -A` (phase 1 1.5, phase 2 2.1/2.9, phase 3 3.7, phase 4 4.11, phase 5 5.5); (6) `git switch -c` trên checkout chính (phase 1 1.0, phase 2 2.1/2.2, phase 6 6.1/6.5); (7) "admin giữ hành vi" nhưng giải mã chung (phase 1 Goal/1.1/1.3); (8) "Không mất dữ liệu người dùng" (phase 6 R2); (9) IME 7 tổ hợp bắt buộc (phase 4 4.12, phase 6 6.1); (10) sửa 2 lỗi UI (phase 4 Goal/4.9/4.10, plan.md Không làm); (11) `npm install` không `--ignore-scripts` (phase 4 4.1); (12) Task 3.8 preview riêng (phase 3, phase 6 6.1); (13) 6.4 `wrangler deploy --var` từ HEAD (phase 6 6.5); (14) đánh số task phase 6 (6.3–6.18, tham chiếu chéo ở plan.md và phase 2/3/4/5); (15) đánh số task phase 2 (2.6 mới, migration thành 2.7, test 2.8, cổng 2.9; tham chiếu ở phase 1); (16) số dòng neo của file #36/ui-polish sửa → symbol + "≈"; (17) lỗi Fact Checker: `renderMarkdown` 3 dòng grep (`:78`, `:130`, `:1590`), `applyDraft` `:219`.
- Unresolved contradictions: 0.

## Validation Log

### Session 1 — 2026-10-23
**Trigger:** validate sau red team.
**Questions asked:** 4

| Câu hỏi | Quyết định | Áp vào |
|---|---|---|
| Payload form cũ từ tab mở trước cutover trả mã gì? | **400** `stale_client` (không phải 409); tab cũ hiện câu 400 chung "Dữ liệu gửi lên chưa hợp lệ. Hãy kiểm tra lại." | plan.md (Quyết định, Xong khi, Risk, bảng Red Team #8); Phase 2 (Goal, task 2.3, task 2.8 test `teams-validate` + `teams`, Risk); Phase 5 (Goal, task 5.4); Phase 6 (Risk) |
| Có tạo/xoá D1 tạm để diễn tập migration không? | Đồng ý về nguyên tắc; vẫn dừng hỏi ngay trước mỗi lệnh remote | Phase 6 task 6.3 |
| Kiểm IME trên những tổ hợp nào? | Chỉ 3 tổ hợp user có: macOS Telex (bộ gõ hệ thống), iPhone Telex, Windows Unikey/EVKey; không chặn phát hành | plan.md Risk; Phase 4 task 4.12 (checklist + `release-log.md` 3 dòng) |
| PR #36 có làm guard Worker của P0 dừng không? | Không: `gh pr view 36` cho thấy #36 không sửa file nào dưới `community-worker/` | Phase 2 task 2.2 bước 4 (ghi chú) |

### Verification Results
- Tier: Full. Dựa trên bảng Fact Checker của RTSecurity (đối chiếu `0f89e2e`, `gh pr view/diff 36`, `npm view`).
- Verified: hơn 200 trích dẫn `file:line` và claim ở phase 1–6.
- Failed: 4, đã sửa trong plan:
  1. Grep `renderMarkdown` ra 3 dòng (`:78`, `:130` đệ quy, `:1590`), không phải 2 → Phase 1 Context.
  2. `applyDraft` nằm ở `:219`, không phải `:206-226` → Phase 4 Context.
  3. "MAINTENANCE chặn mọi ghi" sai → Phase 2 task 2.1 chặn thêm `POST /api/auth/*` trừ sign-out; Context/Security liệt kê các ghi còn lại.
  4. R2 "Không mất dữ liệu người dùng" sai → Phase 6 R2 liệt kê dữ liệu mất khi restore.
- Unverified: 4, cần chạy thật. Mỗi điểm có Verify riêng; đỏ thì Failure Protocol.
  1. `this.parent` trong `Paragraph.extend({ renderMarkdown })` của TipTap → chốt ở task 4.3 bước 1, test task 4.3 ca 2. <!-- Updated: Kongming advice - đánh số lại -->
  2. Tên `MarkdownManager.serialize/parse` của `@tiptap/markdown` khi chạy Node → task 4.3 bước 1.
  3. Dạng thẻ `<script type="module" src="/_astro/…">` mà `astro build` sinh → task 4.5.
  4. Cờ `--var` của `wrangler versions upload` → task 2.2 bước 6 (dùng lần đầu), task 6.8. <!-- Updated: Kongming advice - đánh số lại phase 6 -->

### Whole-Plan Consistency Sweep
- Files reread: plan.md, phase-01 … phase-06.
- Decision deltas checked: 4.
- Grep đã chạy:
  - `409`: còn lại chỉ ở chú thích `<!-- Updated … 409 → 400 -->` và dòng lịch sử của bảng Red Team #8 (đã ghi "409 lúc red team, 400 theo Validation Session 1").
  - `7 tổ hợp`: còn lại chỉ ở tiêu đề finding #14 và mục sweep red team (lịch sử).
  - `Pinyin`, `Gboard`, `Laban`, `Android`: 0 kết quả.
  - `iOS`: chỉ ở "iPhone + Telex (Safari iOS)" của task 4.12.
  - `7 dòng`: chỉ ở kiểm 7 URL chuyển hướng (không liên quan IME).
- Reconciled stale references: 9.
  - 409 → 400 ở plan.md Quyết định, Xong khi, Risk; Phase 2 Goal, 2.3 (×2), 2.8 (×2); Phase 5 Goal, 5.4 (×2); Phase 6 Risk.
  - Checklist IME 4.12 bỏ ví dụ "iOS Pinyin" và chữ Hán gõ thử.
  - plan.md Risk IME bỏ "Pinyin/Android".
- Unresolved contradictions: 0.

### Kongming Advice — 2026-10-23
Nguồn: `agent://KongmingPlanCheck` (kết luận "Sẵn sàng có điều kiện"). Áp đủ 8 điểm; không đổi quyết định sản phẩm nào.

| # | Điểm | Áp vào |
|---|---|---|
| 1 | Chứng minh hết request ghi đang chạy trước B0; bỏ khẳng định tuyệt đối "không mất" | Phase 6: Context (`routes/teams.ts` R2 rồi `DB.batch`, `MAX_BUDGET_MS` 180 s); task mới 6.11 (chờ 200 s, hai dấu vân tay 7 cột cách 30 s phải bằng nhau, tối đa 3 lần lặp, không đạt thì không lấy B0); 6.12 B0 sau drain; R2 câu "không mất" thành khẳng định có điều kiện; Risk |
| 2 | `pragma table_info` → `table_xinfo` (generated column) | Phase 2 task 2.8 bước 2 (tập đúng 24 cột theo thứ tự, 6 cột không còn), 2.9 bước 3; Phase 6 task 6.3 bước 7–8, 6.16 bước 7, R1 bước 3, R2 bước 5 |
| 3 | Fallback theo `editor-ready`; token vòng đời; bỏ chunk về muộn | Phase 4 task 4.4 (`#loadToken`, kiểm `token`/`isConnected` sau `await`, `disconnectedCallback` tăng token), 4.8 bước 6 (`readyTimer` 5 s tới `editor-ready`, `fellBack`), 4.10 bước 13 ca (c) chunk treo, (d) rời view lúc tải, (e) chunk về sau fallback; Risk |
| 4 | Repost không xoá nháp thường | Phase 4 task 4.8 bước 7 (`removeItem` chỉ khi `autosave`), Success criteria; 4.10 bước 11 gửi repost tới 201 rồi so nháp từng byte |
| 5 | Mỗi generation một `AbortController` cục bộ xuyên upload→analyze | Phase 4 task 4.8 bước 5 (không `AbortSignal.any` vì Safari 16; view abort gọi `imageAbort?.abort()`), Verify grep; 4.10 bước 6 bọc `fetch` ghi `__aborted`, assert analyze `tu-1` bị huỷ |
| 6 | Kiểm hợp đồng TipTap ngay sau 4.2 | Phase 4: task round-trip thành 4.3 (bước 1 chốt `MarkdownManager` và cách gọi bản gốc trên `.d.ts` bản cài, ghi "Hợp đồng TipTap"); element thành 4.4; nạp trang/allowlist thành 4.5; cập nhật tham chiếu 4.2, 4.4, Files, Risk, plan.md Quyết định "Editor" và Verification Results |
| 7 | `W` tuyệt đối, cwd từng nhóm lệnh, seed SQL nguyên văn | Phase 6 Context "Quy ước lệnh" (`export WT CW W`); mọi step ghi cwd; 6.3 bước 2 (chép 8 file migration), bước 5 `seed.sql` nguyên văn schema cũ; Rollback R0–R3 ghi cwd |
| 8 | Dời chuẩn bị ra trước bảo trì; một lần chấp thuận chuỗi; mốc thời gian | Phase 6 viết lại thứ tự: chuẩn bị 6.1–6.9 (6.5 tắt `pages-deploy.yml`, 6.6 guard + merge, 6.7 build, 6.8 upload, 6.9 bảng lệnh), cửa sổ 6.10–6.17 (một chấp thuận ở 6.2), sau cửa sổ 6.18–6.20; mốc `HH:20`–`HH:25` / migration ≤ `HH:50` / mở ≤ `(HH+1):15`, kiểm ở 6.10, 6.13, 6.17; plan.md "Dừng và hỏi"; Phase 5 task 5.4 thứ tự cutover |

#### Whole-Plan Consistency Sweep (sau Kongming advice)
- Files reread: plan.md, phase-01 … phase-06.
- Decision deltas checked: 8.
- Grep đã chạy:
  - `table_info`: còn lại ở hai chỗ. Một là câu giải thích trong phase 2 task 2.8 ("`table_info` không trả chúng"). Hai là dòng lịch sử của bảng Red Team #1. Mọi lệnh kiểm cột đều đã dùng `table_xinfo`.
  - `6.11→6.13`, `chuỗi 6.11`, `task 6.17` (nghĩa 301), `task 6.18`: chỉ còn ở dòng lịch sử bảng Red Team #7 và #11, và cả hai đã ghi số mới.
  - `6.14 bước`, `6.6 bước`, `W d1 `: 0 kết quả.
  - `imageAbort.signal`: chỉ còn trong câu cấm và trong lệnh grep Verify của task 4.8.
  - `vẫn \`undefined\``: 0 kết quả (fallback cũ theo `customElements.get` đã thay).
- Reconciled stale references: 12.
  - plan.md: Xong khi (301 ở 6.19), Dừng và hỏi (chuỗi 6.10→6.17), Quyết định "Editor", Verification Results (4.3, 4.5, 6.8), bảng Red Team #7 và #11 (ghi số mới).
  - Phase 2 Risk (6.13→6.14, 6.8, chuỗi 6.10→6.17).
  - Phase 3 Goal và chú thích `RENAMED_PAGE_STATUS` (6.19).
  - Phase 4 Files (4.5), Risk (4.3, 4.5, 6.15/6.13/6.14/6.5/6.17).
  - Phase 5 task 5.4 thứ tự cutover.
- Unresolved contradictions: 0.
