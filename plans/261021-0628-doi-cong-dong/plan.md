---
title: "Đội cộng đồng: kho đội do người chơi đăng, có duyệt, vote, chiến báo và bình luận"
description: "Thêm kho đội cộng đồng theo mùa đang mở vào community-worker và site tĩnh: form có cấu trúc + AI điền nháp từ ảnh, duyệt trước, xếp hạng vote + chiến báo thắng, bình luận, dùng chung vi/zh."
status: in-progress
priority: P1
effort: 7d
branch: main
tags: [feature, backend, frontend, database, api]
blockedBy: []
blocks: []
created: 2026-10-21
---

# Đội cộng đồng

Chế độ: `--hard --tdd`. Phạm vi: HOLD (đã khoá qua `ak:advise`, xác nhận 2026-10-21). Bằng chứng: [scout-ai-pipeline](./reports/scout-ai-pipeline.md), [scout-worker-data](./reports/scout-worker-data.md), [scout-frontend-season](./reports/scout-frontend-season.md), [research-d1-ranking](./reports/research-d1-ranking.md).

## Outcome đã khoá

1. Người đã đăng nhập đăng đội **cho mùa đang mở** (server gán, admin đổi mùa ở `/quan-tri/`): tiêu đề, 3 tướng × 2 chiến pháp (id), binh chủng, lối chơi, điểm mạnh/yếu, khắc chế/bị khắc, thay thế, 1–3 ảnh.
2. AI điền nháp tướng + chiến pháp từ ảnh (người dùng sửa/xác nhận), có rate limit + kill-switch `FEATURE_ENABLED`.
3. Duyệt trước (root/KDV), có `admin_audit`. Không sửa sau khi đăng; tác giả xoá được.
4. Trùng bộ 3 tướng: cho đăng, cảnh báo + "Đội tương tự".
5. Vote ±1, mỗi user 1 phiếu/đội, tác giả không tự vote.
6. Chiến báo gửi vào đội cộng đồng; điểm chiến báo = số user khác tác giả có ≥1 chiến báo **thắng** đã duyệt.
7. Bình luận dùng bảng `comments`, page_key `/doi-cong-dong/<id>/`.
8. Một kho chung vi/zh; tên tướng/CP theo id + locale; văn bản giữ ngôn ngữ gốc kèm nhãn.
9. Danh sách: lọc mùa (mặc định mùa mở) + tướng; sắp Hot/Mới/Top. Trang khung tĩnh, render client, `noindex`, `/doi-cong-dong/` và `/zh/doi-cong-dong/`.
10. Mùa cũ: khoá vote + chiến báo (409 `season_closed`), **vẫn mở bình luận**, vẫn xem được khi lọc mùa cũ.
11. Ẩn đội của user bị khoá/đang xoá (`visibleUserSql`).

## Quyết định thiết kế (từ research)

- **Không rebuild `uploads`**: ảnh đội tạm ở `uploads.kind='report'` nhưng khoá R2 riêng `pending/team-<uploadId>` (route chiến báo loại khoá này, route đội chỉ nhận khoá này). Khi gắn vào đội, dòng `uploads` bị xoá trong cùng batch; `community_team_images` là chủ duy nhất của khoá cuối và `inventoryKeys` đọc thẳng bảng này. <!-- Red Team #3 -->
- **AI**: import `callModel(dataUri, {route, fetchImpl}, 'analyzeTeamImage')` từ `worker/src/model.ts` (chỉ phụ thuộc `shared/`; không sửa `worker/`), nhóm `teamScan`, ánh xạ lỗi riêng (`AiCallError`/`status`); client tái dụng `normalizeTeamRead` → `pickSide` → `draftFromRead({heroes})` (`js/analyze-map.js`, bị pin → chỉ import). Có trần toàn site `team_analyze_global`/ngày ngoài giới hạn mỗi user. <!-- Red Team #9, #11; Astra A#9, A#12 -->
- **Id tướng/CP**: chỉ kiểm định dạng (`ID_RE` chuyển từ `scan.ts` sang `validate.ts`) + không trùng; không sinh allow-list (dữ liệu `data/` đổi nhanh hơn Worker). Client hiển thị qua `createTacticIdResolver` (hiểu `formerIds`), id lạ hiện thô. <!-- Red Team #8 -->
- **Mùa**: bảng `community_seasons` (id slug, nhãn vi/zh, `opened_at`, `closed_at`); đúng một dòng `closed_at is null` = mùa mở. Không dựa vào `data/season-registry.json` (thiếu nhãn zh) hay `battle_reports.season` (luôn NULL).
- **Xếp hạng**: bộ đếm `up_votes`, `down_votes`, `evidence_count` trên dòng đội, **trigger** đếm lại; cột sinh STORED `points = up − down + 2·evidence`, `hot_rank` (Reddit, τ = 2 ngày), `top_rank`; phân trang keyset `[key, id]` bằng hàm mới `paginateByKey` (không đổi `paginate`).
- **Mùa cũ / quyền / hiển thị** kiểm trong chính câu ghi (`insert … select … where exists`), mọi câu đi kèm trong batch cũng có cùng điều kiện; route GET bình luận/chiến báo/thống kê của trang đội cũng kiểm đội hiển thị. <!-- Red Team #6, #13 -->
- **Xoá đội** (chủ, root, KDV theo thứ bậc như bình luận): một batch **chốt xoá** (`deleting_at`, kèm audit đứng trước, cùng điều kiện quyền và `has_evidence`) → đội biến khỏi mọi đọc/ghi → xoá R2 (lỗi → 502 `delete_incomplete`, gọi lại thì làm tiếp việc đã chốt) → batch cuối mọi câu đều đòi `deleting_at` khác null; `delete … returning image_key` bắt khoá sót. <!-- Red Team #4, #7; Astra A#2, A#3 -->
- **Lối vào**: không sửa `SiteLayout.astro` (sửa = sinh lại cả thế hệ bản dịch); vào qua menu tài khoản (`js/community-auth.js`) và link trên trang `/chien-bao/`. Link từ page key dùng một hàm `communityPageHref()`. <!-- Red Team #1, #12 -->

## Không làm

SEO/index/SSR trang đội; sửa bài sau khi đăng; gộp đội trùng; chấm sao; lọc theo kho tướng/binh chủng/phe; tự động đưa vào Đội chuẩn; đổi `worker/`; rebuild `uploads`; lọc vote theo trạng thái khoá lúc đọc (thay vào đó: khoá tài khoản xoá vote, không khôi phục khi mở khoá); mục menu chính trong `SiteLayout.astro`.

## Ràng buộc

- Tái dụng Hono/D1/R2/Better Auth/`callModel` của `worker/`/`RATE_RULES`/`admin_audit`/`visibleUserSql`.
- Không sửa migration đã áp dụng (`0001`–`0006`); cột thời gian epoch ms.
- Không sửa file bị pin trong `pipeline/site-localization-policy.json` (gồm `SiteLayout.astro`, `js/analyze-map.js`, `js/analyze.js`, `js/lookup-data.js`, `js/hero-portrait.js`, `js/render.js`).
- UI song ngữ qua `L()`/`pick()`; lỗi `{error:{code,message}}`, UI dịch theo `code`.
- Deploy: migration → Worker → push `main` → chạy tay workflow `pages-deploy.yml` (push không tự deploy Pages). Rollback: revert `main` trước.

## Phase

| # | Nội dung | Trạng thái |
|---|---|---|
| 1 | [Schema, mùa, id tướng/CP, nền tảng validate](./phase-01-schema-nen-tang.md) | completed |
| 2 | [API đội: mùa, ảnh + AI, đăng, xem, vote, xoá](./phase-02-api-doi.md) | completed |
| 3 | [API duyệt và quản trị mùa](./phase-03-api-duyet-mua.md) | completed |
| 4 | [Nối chiến báo, bình luận, xoá tài khoản](./phase-04-noi-route-san-co.md) | completed |
| 5 | [Trang công khai /doi-cong-dong/ (vi + zh)](./phase-05-trang-cong-khai.md) | completed |
| 6 | [Tab quản trị Đội cộng đồng](./phase-06-tab-quan-tri.md) | completed |
| 7 | [Docs, kiểm tra toàn bộ, triển khai](./phase-07-docs-trien-khai.md) | in-progress (còn bước remote, chờ duyệt) |

Phụ thuộc: 1 → 2 → 3 → 4 (cùng sửa route/test harness worker) → 5 → 6 (cùng sửa `js/community-*.js`) → 7.

## Xong khi

- [ ] Migration `0008_community_teams.sql` áp được trên fake D1, D1 cục bộ và production; test chứng minh bộ đếm khớp đếm lại sau vote, duyệt/gỡ chiến báo, xoá tài khoản.
- [ ] Vòng đầy đủ chạy được trên `tqccl.com/doi-cong-dong/`: tải ảnh → AI nháp → gửi → KDV duyệt → hiện trong danh sách (lọc mùa/tướng, Hot/Mới/Top) → người khác vote, bình luận, gửi chiến báo → duyệt chiến báo làm tăng điểm.
- [ ] Root mở mùa mới → đội mới gắn mùa mới; vote/chiến báo vào đội mùa cũ trả 409 `season_closed`; bình luận vẫn 201.
- [ ] `/zh/doi-cong-dong/` hiện cùng kho, tên tướng/CP tiếng Trung; văn bản có nhãn ngôn ngữ gốc.
- [ ] Đội của user bị khoá/đang xoá không có trong API công khai; xoá tài khoản xoá đội, ảnh R2, chiến báo/bình luận trên trang đội đó.
- [ ] `npm test` + `npm run typecheck` (community-worker), `npm run test:node`, `npm run build`, `npm run verify`, `npm run test:dist`, `npm run test:e2e` xanh; `docs/community-worker.md`, `docs/system-architecture.md`, `docs/project-changelog.md`, `src/components/pages/PrivacyPage.astro` (vi/zh) cập nhật.

## Dừng và hỏi chỉ khi

- Lỗi không giải thích được (test, migration, AI).
- Hành động `--remote`/không hoàn tác: `wrangler d1 migrations apply --remote`, `wrangler deploy`, push `main`, `gh workflow run pages-deploy.yml`, Time Travel restore.
- Thay đổi ngoài `community-worker/`, `js/community-*.js`, `src/components/{community,pages}/`, `src/pages/{,zh/}doi-cong-dong/`, `src/lib/public-artifact-manifest.mjs`, `css/styles.css`, `public/_headers`, `scripts/verify-astro-dist.mjs`, `tests-js/`, `tests-e2e/`, `docs/`. Import (không sửa) `worker/src/model.ts` được phép.
- D1 production có SQLite < 3.31 (không hỗ trợ generated column).

## Red Team Review

### Session — 2026-10-21
**Findings:** 15 sau khi gộp 36 phát hiện thô của 4 reviewer (15 accepted, trong đó #7 bác một phần; 0 rejected vì thiếu bằng chứng)
**Severity breakdown:** 2 Critical, 8 High, 5 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---|---|---|---|
| 1 | Re-pin hash `SiteLayout.astro` kéo theo sinh lại cả thế hệ bản dịch | Critical | Accept: không sửa SiteLayout; lối vào qua menu tài khoản + `/chien-bao/` | plan, Phase 5 |
| 2 | `mountComments`/`mountReports` lọc `lang` ở client, không có chế độ mùa đóng | Critical | Accept: tuỳ chọn `sharedPool`, `archived` | Phase 5 |
| 3 | `update uploads` không guard; double submit/cron làm mất dấu ảnh đội khi xoá tài khoản | High | Accept: khoá `pending/team-`, batch gắn nguyên tử, `community_team_images` là chủ khoá, `inventoryKeys` đọc thẳng | plan, Phase 2, 4 |
| 4 | Xoá đội D1 trước R2; audit khác batch | High | Accept: R2 trước + 502 gọi lại, audit đầu batch, `returning` | plan, Phase 2 |
| 5 | Regex uuid loại id harness `id-0001` | High | Accept: `[a-z0-9][a-z0-9-]{0,63}` | Phase 1 |
| 6 | Chiến báo bị chặn mùa vẫn làm upload thành `attached` | High | Accept: guard update, preflight trước rate limit, test upload còn `pending` | Phase 4 |
| 7 | KDV xoá đội/nội dung của root/KDV; KDV tự duyệt | High | Accept thứ bậc + meta theo tác giả; Reject phần tự duyệt (giữ quyết định plan 261016) | Phase 2, 3 |
| 8 | Allow-list id lỗi thời, `formerIds` | High | Accept: chỉ kiểm định dạng; client dùng `createTacticIdResolver` | plan, Phase 1, 5 |
| 9 | `analyze-team.ts` chép lại `worker/src/model.ts` `callModel` | High | Accept: import `callModel` | plan, Phase 2 |
| 10 | Push `main` không deploy Pages; thứ tự rollback; thiếu SQL tạo lại trigger | High | Accept: `gh workflow run`, revert `main` trước, `0010_restore` | plan, Phase 1, 7 |
| 11 | AI không có trần toàn site trên chuỗi `teamScan` dùng chung | Medium | Accept: `team_analyze_global` | plan, Phase 2, 7 |
| 12 | Link page key → URL sai ở `community-hub.js`; sửa `PAGE_KEY_PATTERN`/`COMMUNITY_PATHS` vô tác dụng | Medium | Accept: `communityPageHref`, bỏ hai sửa vô tác dụng | Phase 5, 6 |
| 13 | GET bình luận/chiến báo/thống kê lộ nội dung đội ẩn | Medium | Accept | Phase 4 |
| 14 | Hợp đồng test: counts đúng hình, `counts` cho panel, `targetTypeLabel`, ma trận permissions, hàm thuần trong entry, mock e2e chép lại | Medium | Accept | Phase 2, 3, 5, 6 |
| 15 | Thừa: `/similar`, route DELETE admin, refactor `paginate`; thiếu `indexes.books`, byte loader | Medium | Accept | Phase 1, 2, 3, 5 |

Đưa sang Validation (quyết định sản phẩm): chủ xoá đội có xoá nội dung người khác; khoá user có xoá vote; cập nhật trang Chính sách bảo mật + xoá ảnh đội bị từ chối.

### Whole-Plan Consistency Sweep
- Files reread: plan.md, phase-01 … phase-07
- Decision deltas checked: 15
- Reconciled stale references: 9 (`analyze-team.ts`, allow-list + pre-scripts, `/similar`, route DELETE admin, `paginateBy`, re-pin SiteLayout, `PAGE_KEY_PATTERN`/`COMMUNITY_PATHS`, regex uuid, "push main → Pages")
- Unresolved contradictions: 0

## Validation Log

### Session 1 — 2026-10-21
**Trigger:** `/ak:plan --hard --tdd` sau red team; các quyết định sản phẩm red team chuyển sang.
**Questions asked:** 4
Verification: bỏ qua bước tự kiểm (red team đã fact-check với `file:line`; 2 trích dẫn lệch đã sửa: `callWithFailover` ở `shared/ai-config.ts`, `codeMessage` không export).

| Câu hỏi | Quyết định | Áp vào |
|---|---|---|
| Chủ tự xoá đội: chiến báo/bình luận của người khác? | Chặn tự xoá khi đội có chiến báo **đã duyệt** của người khác (409 `has_evidence`); staff vẫn gỡ được | Phase 2, 5 |
| Vote của user bị khoá? | Xoá vote trong cùng batch khoá; mở khoá không khôi phục | plan, Phase 4 |
| Chính sách bảo mật + ảnh đội bị từ chối? | Cập nhật `PrivacyPage.astro` (vi/zh); từ chối xoá ảnh (chốt trạng thái trước, xoá R2 sau, gọi lại được) | Phase 3, 6, 7 |
| Hằng số? | Theo đề xuất: điểm = vote + 2×người thắng; τ Hot = 2 ngày; AI 20/user/ngày, trần 300/ngày toàn site; đăng 5 đội/user/ngày | Phase 1, 2 |

### Whole-Plan Consistency Sweep
- Files reread: plan.md, phase-02, phase-03, phase-04, phase-05, phase-06, phase-07
- Decision deltas checked: 4
- Reconciled stale references: 2 ("Không làm" về vote user bị khoá; route từ chối không còn giữ ảnh)
- Unresolved contradictions: 0

## Astra Audit

### Session — 2026-10-21 (`openai-codex/gpt-6-astra`, agent `debate2`, chế độ audit đơn)
**Verdict ban đầu:** needs fixes. **Findings:** 12, đã kiểm lại từng mục trong code; 12 accepted (#6, #7 hạ xuống Medium).

| # | Finding | Severity | Applied To |
|---|---|---|---|
| A1 | Module JS mới chưa đăng ký trong `src/lib/public-artifact-manifest.mjs` → build fail, admin hỏng | Critical | plan, Phase 5, 6 |
| A2 | Xoá đội: câu xoá con không có điều kiện quyền | High | plan, Phase 1, 2 |
| A3 | Xoá dở + chiến báo được duyệt → không gọi lại được | High | plan, Phase 1, 2, 4 (`deleting_at`) |
| A4 | Vote đang chạy ghi lại sau batch khoá tài khoản | High | Phase 2 |
| A5 | URL ảnh chiến báo trên đội bị ẩn vẫn công khai | High | Phase 4 |
| A6 | Audit duyệt/từ chối có thể ghi 2 lần cùng mili-giây | Medium | Phase 3 |
| A7 | Rollback Worker cũ làm sót ảnh đội khi xoá tài khoản | Medium | Phase 7 (runbook) |
| A8 | Fake D1 nhường lượt giữa câu trong batch; `returning` báo `changes: 0` | Medium | Phase 1 |
| A9 | `callModel` thiếu `fetchImpl`; lỗi không phải `ModelError` | Medium | plan, Phase 2 |
| A10 | `snapshot()` `order by id` với bảng khoá ghép | Medium | Phase 3 |
| A11 | Phản hồi thiếu `author.id`, `status` | Medium | Phase 2, 5 |
| A12 | `draftFromRead` nhận `{screen,sides}` thay vì `{heroes}` | Medium | plan, Phase 5 |

### Whole-Plan Consistency Sweep
- Files reread: plan.md, phase-01 … phase-07
- Decision deltas checked: 12
- Reconciled stale references: 5 (`{route}` không `fetchImpl`, `author{name,image}`, `draftFromRead(read…)`, quyết định "Xoá đội" cũ, rủi ro bước xoá cũ); chuyển kiểm bình luận/chiến báo trên đội đang xoá sang phase 4 để thứ tự TDD đúng
- Unresolved contradictions: 0
