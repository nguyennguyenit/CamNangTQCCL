---
title: "Đội cộng đồng công khai: lối vào menu/landing và trang tĩnh index được cho từng đội"
description: "Thêm Đội cộng đồng vào menu và landing (publish lại bản dịch), Worker có export công khai + dispatch site-publish, site sinh trang tĩnh /doi-cong-dong/<id>/ (vi + zh) có SEO, sitemap, verifier và redirect ?id=."
status: in-progress
priority: P1
effort: 3d
branch: feat/doi-cong-dong
tags: [feature, frontend, backend, seo, i18n, ci]
blockedBy: []  # phụ thuộc mềm: plans/261021-0628-doi-cong-dong phase 7 (bước remote) phải xong trước Phase 4
blocks: []
created: 2026-10-22
---

# Đội cộng đồng công khai

Chế độ: `--fast --tdd`. Không nghiên cứu lại; mọi quyết định đã chốt và kiểm chứng qua: `ak:advise` (local://advise-community-teams.md), review Fable (local://advise-community-teams-v2.md, 12 sửa đổi), debate Proponent ↔ Skeptic (agent://Proponent, agent://Skeptic: blocker localization, export thiếu `analysis`, đếm id duy nhất, `alternates={false}` cả hai bản, `jsonLd()`/escape, giữ pageKey/`sharedPool`), và kiểm chứng thực nghiệm (local://verification-facts.md, main `5b6014a`; ưu tiên cao nhất khi mâu thuẫn). Plan chỉ đọc source để lấy `file:line`.

Làm trong worktree `/Users/plateau/Project/worktrees/CamNangTQCCL-doi-cong-dong` (nhánh `feat/doi-cong-dong`, sạch, chậm 17 commit so với `main` → Phase 1 bước 0 fast-forward).

## Outcome đã khoá

1. Menu Cộng đồng (desktop, mobile, chuyển nhanh, footer) và khối Cộng đồng của landing có "Đội cộng đồng" ở `/` và `/zh/`; landing không liệt kê đội.
2. Mỗi đội thoả `teamVisibleSql` có trang tĩnh `/doi-cong-dong/<id>/` và `/zh/doi-cong-dong/<id>/`, dữ liệu lấy lúc build; UI dịch theo locale, chữ người dùng giữ nguyên ngôn ngữ gốc.
3. Bản ngôn ngữ `text_lang` self-canonical + index; bản kia canonical về bản gốc; không hreflang ở cả hai; sitemap một URL/đội (bản gốc). Title/description riêng, FAQ, JSON-LD (không `aggregateRating`), og meta (og:image mặc định), tên tác giả + ngày; không nhúng avatar.
4. `/doi-cong-dong/` (vi + zh) noindex khi < 10 đội (đếm id duy nhất lúc build); ≥ 10 thì index + vào sitemap.
5. Vote, bình luận, chiến báo, trạng thái mùa tải live; pageKey `/doi-cong-dong/<id>/` + `sharedPool: true` ở cả hai locale.
6. Rebuild bằng `repository_dispatch` `site-publish` ở đúng 5 điểm đổi hiển thị + lịch hằng ngày; không SSR.
7. `?id=` chỉ `location.replace` sang URL tĩnh khi đội approved và trang tĩnh trả 200; link nội bộ tới đội approved trỏ URL tĩnh.

## Quyết định thiết kế

- **Sửa file bị ghim (đảo Red Team #1 của plan 261021-0628)**: thêm entry vào `communityEntries` `src/layouts/SiteLayout.astro:227-242` và thẻ vào `communityCards` `src/components/landing/Landing.astro:121-152`. Hai file ghim ở `pipeline/site-localization-policy.json:803,811`; `build`/`verify` chạy gate trước (`package.json:10,15`) → bắt buộc chuỗi publish `docs/deployment-guide.md:251-271` (Phase 1). File/route mới không bị gate (thực nghiệm), nên Phase 3 không được đụng file ghim.
- **Export một request** `GET /api/community-teams/export` (schema v1 đầy đủ ở Phase 2): giữ nguyên `toItem` (`community-worker/src/routes/teams.ts:113-132`) nhưng bỏ `author.image`, thêm `analysis` (cùng helper với `GET :id` `:424-431`) và `approvedAt = coalesce(reviewed_at, created_at)`; lọc `teamVisibleSql` (`:31-33`) mọi mùa, thứ tự `created_at desc, id desc`, `Cache-Control: no-store` (`community-worker/src/app.ts:64`). Đăng ký trước `GET :id` (`teams.ts:407`) vì `export` khớp regex id (`community-worker/src/validate.ts:8`). List hiện có không đủ (thiếu `analysis`, mặc định chỉ mùa mở `teams.ts:349-354`). Site không render các số vote/điểm có trong `toItem`.
- **Dispatch `site-publish`** (`DEPLOY_EVENT_TYPE` `community-worker/src/routes/posts.ts:136` chuyển sang `community-worker/src/deploy.ts`) ở: approve khi `reviewTeam` trả `true` (`teams.ts:716,731-736`), xoá đội pha 1 khi `changes > 0` (`teams.ts:587-592`), ban (`community-worker/src/routes/users.ts:251-282`), unban (`users.ts:300-327`), xoá user pha 1 khi `changes > 0` (`users.ts:411-427`). Không gửi ở reject, đóng/mở mùa, lần gọi lại xoá. Kết quả ghi `meta.deploy` theo mẫu `posts.ts:186-198` + `community-worker/src/audit.ts:89-100`; lỗi không rollback.
- **Workflow** `.github/workflows/pages-deploy.yml:8-10`: `types: [site-publish]` + `schedule` hằng ngày (best-effort, cho ban hết hạn `community-worker/src/moderation.ts:34-36` và dispatch lỗi); concurrency cancel-in-progress giữ nguyên (`:16-18`).
- **Loader build fail-closed** `src/lib/community-teams.ts` theo `src/lib/blog-posts.ts:1-6,301-363`; không `COMMUNITY_API_ORIGIN` → rỗng. Một snapshot memo cho route vi/zh, danh sách, sitemap. Chữ người dùng chỉ qua biểu thức Astro (escape) và `jsonLd()` (`blog-posts.ts:387-395`).
- **Canonical/hreflang**: `alternates={false}` ở cả hai bản (mặc định bật `SiteLayout.astro:77-81`), `canonicalUrl` (`:42,84`) = URL bản `text_lang`; JSON-LD chỉ trên bản gốc. Sitemap hàm mới `communityTeamSitemapRoutes` (không dùng `mirroredSitemapRoutes` cho trang đội vì luôn phát cặp `src/pages/sitemap.xml.ts:54-60`), dùng chung build + verifier như `blogSitemapRoutes` (`:71-88`).
- **Verifier** `scripts/verify-astro-dist.mjs`: regex trang đội như `BLOG_POST_FILE` (`:109`), allowlist (`:263-302`), tách `doi-cong-dong/index.html` khỏi kiểm noindex/cấm canonical của `COMMUNITY_PAGES` (`:79-84,609-620`), đếm **id duy nhất** + bắt đủ cặp vi/zh, canonical chéo, không hreflang, ngưỡng 10 đọc từ dist; không chép `verifyBlogOutputs` vì `:146` đòi self-canonical.
- **Danh sách index được phải có link tĩnh**: `public/robots.txt:5` chặn `/api/` nên Googlebot không render được danh sách JS → `CommunityTeamsHub.astro` dựng sẵn `<ul>` link tới trang đội trong mount (JS thay khi chạy).
- **JS** (`js/community-teams.js`): chế độ static khi mount có `data-team-id` (không nạp từ điển, chỉ gắn vote/xoá/tương tự/widgets); redirect `?id=` sau khi `GET :id` trả approved và HEAD trang tĩnh 200; link tới đội approved có `href` tĩnh, click đi qua `?id=` để tránh 404 trong cửa sổ chờ build. Không module JS mới → không sửa `src/lib/public-artifact-manifest.mjs`. `communityPageHref` (`js/community-api.js:150-155`) giữ `?id=`.

## Không làm

Khối liệt kê đội nổi bật trên landing; bộ lọc URL theo binh/loại; chép đội vào kho; so sánh đội; SSR/Pages Function cho trang đội; `aggregateRating` hay số vote nhúng tĩnh; sửa nội dung đội sau khi đăng; đội trong `llms.txt`; đổi `robots.txt`, `public/_headers`; avatar hoặc ảnh người dùng làm `og:image`; đổi schema D1/migration; thu hẹp điều kiện dispatch của ban/unban/xoá user (Validation Log 2026-10-22).

## Ràng buộc

- TDD: mỗi phase viết test đỏ trước (bảng Test-first matrix trong từng phase).
- Chỉ Phase 1 được sửa file trong `sourceFiles` của `pipeline/site-localization-policy.json`; mọi phase khác kết thúc với `python3 -m pipeline.site_localization check --root . --stage public` exit 0.
- Không sửa migration đã áp dụng; không thêm migration.
- UI song ngữ qua `pick`/`t` (Astro) và `L()` (JS); chữ người dùng là text node/biểu thức Astro, không `set:html`.
- Module JS mới (nếu buộc phải có) phải đăng ký trong `src/lib/public-artifact-manifest.mjs` (Astra A1 của plan 261021-0628).
- Thứ tự triển khai: Worker → merge/push `main` → `gh workflow run pages-deploy.yml`; rollback: revert `main` trước rồi `npx wrangler rollback`.

## Phase

| # | Nội dung | Effort | Phụ thuộc | Trạng thái |
|---|---|---|---|---|
| 1 | [Lối vào menu + thẻ landing, publish lại bản dịch](./phase-01-loi-vao-localization.md) | 3h | — | pending |
| 2 | [Worker: export công khai + dispatch `site-publish`](./phase-02-worker-export-dispatch.md) | 5h | — | pending |
| 3 | [Trang tĩnh, SEO, sitemap, verifier, redirect `?id=`](./phase-03-trang-tinh-seo.md) | 1.5d | 1, 2 | pending |
| 4 | [Docs, cổng kiểm, triển khai, smoke](./phase-04-docs-trien-khai.md) | 3h | 1, 2, 3 | pending |

Phụ thuộc: 1 và 2 song song được (file rời nhau: Phase 1 sở hữu `SiteLayout.astro`, `Landing.astro`, `css/styles.css`, policy + file publish, `tests-e2e/landing.spec.mjs`; Phase 2 sở hữu `community-worker/**`, `.github/workflows/pages-deploy.yml`). Phase 3 cần schema export của Phase 2 và chạy sau Phase 1 vì cùng sửa `css/styles.css`. Phase 4 cần cả ba và phụ thuộc mềm vào phase 7 (remote) của plan 261021-0628.

## Xong khi

- [ ] `cd community-worker && npm test && npm run typecheck` exit 0, gồm test export (lọc pending/rejected/đang xoá/user bị khoá/user đang xoá, ban hết hạn vẫn hiện, mùa đóng vẫn có, không lộ `author.image`/`rejectReason`/email, route không bị `:id` nuốt) và test dispatch (đúng 1 lần ở 5 điểm, 0 lần ở reject/mùa/đổi vai trò/gọi lại, lỗi dispatch không rollback).
- [ ] `grep -rn "blog-publish" community-worker/src community-worker/test community-worker/wrangler.jsonc .github` → 0 dòng; `pages-deploy.yml` có `types: [site-publish]` và `schedule`.
- [ ] `python3 -m pipeline.site_localization check --root . --stage public` và `python3 -m pipeline.team_route_handles --check` exit 0 sau khi sửa menu/landing.
- [ ] `npm run test:node`, `npm run build`, `npm run verify`, `npm run test:dist`, `npm run test:e2e` exit 0 trong worktree.
- [ ] Build tích hợp với API giả 10 đội: 20 file trang đội, danh sách không `noindex` + có canonical, sitemap đúng 10 URL đội + cặp danh sách, 0 `hreflang` trên trang đội, không có `<img src=x` từ tiêu đề XSS.
- [ ] Production: `curl -s https://tqccl-community.nguyennlt-ncc.workers.dev/api/community-teams/export` trả `"schemaVersion":1`; `tqccl.com/` và `/zh/` có link Đội cộng đồng (`grep -o … | wc -l` ≥ 2 mỗi trang).
- [ ] Production: duyệt một đội → run `repository_dispatch` mới success → trang bản gốc 200 có canonical đúng, `WebPage` + `FAQPage`, bản kia canonical về bản gốc, sitemap có URL; gỡ đội → run mới → 404 và sitemap không còn URL; `?id=<id>` chuyển sang URL tĩnh.
- [ ] Docs `community-worker.md`, `system-architecture.md`, `deployment-guide.md`, `codebase-summary.md`, `project-changelog.md` cập nhật.

## Dừng và hỏi chỉ khi

- Lỗi không giải thích được (test, build, verifier, gate localization).
- Hành động remote/không hoàn tác: `npm run deploy`/`wrangler deploy` (community-worker), push `main`, `gh workflow run`, tạo/duyệt/xoá nội dung production ngoài đội thử `[SMOKE]` đã được phép ở Phase 4.
- Publish localization đòi đổi baseline ngoài 2 file đã sửa, hoặc `inventory` báo obligation lớp `translate` mới/đổi fingerprint (cần receipt duyệt độc lập).
- Cần thay đổi schema D1 hoặc migration.
- Thấy deploy dở trên Pages (`gh run list` có run `in_progress`/kết quả không xác định trước khi chạy workflow).

## Rủi ro còn lại

| Rủi ro | Khả năng × Ảnh hưởng | Giảm thiểu / trạng thái |
|---|---|---|
| Pages atomicity: run bị `cancel-in-progress` sau khi POST manifest — chưa chứng minh "deployment sau luôn thắng" phía server (wrangler upload trước, POST manifest một lần; 30 run gần nhất success) | Thấp × Cao | Rủi ro đã tồn tại với blog; không thử trên production; smoke Phase 4 kiểm trạng thái sau mỗi run |
| `schedule` best-effort (GitHub có thể trễ/bỏ, tự tắt sau 60 ngày repo public không hoạt động) → đội của user hết hạn khoá hiện lại muộn | Trung bình × Thấp | Hướng hiển thị lại (không lộ nội dung bị ẩn); dispatch kế tiếp bất kỳ cũng sửa |
| Tên tác giả nhúng tĩnh cũ tới build thành công kế (better-auth 1.7.6 cho đổi `name` qua `/api/auth/update-user`) | Trung bình × Thấp | Chấp nhận; không nhúng avatar |
| Độ trễ vài phút giữa duyệt/gỡ và trang tĩnh đổi; trong cửa sổ gỡ, crawler không JS vẫn thấy trang cũ | Cao × Thấp | JS ẩn nội dung khi API 404; link nội bộ đi qua `?id=` |
| Mỗi duyệt/gỡ/khoá = build toàn site (~5 000 URL sitemap) | Cao × Trung bình | `cancel-in-progress` gộp các lần liên tiếp |
| Export không phân trang (trần ≈ 13 KB/đội) | Thấp × Trung bình | Ngưỡng xem lại bên dưới |

**Điều kiện chuyển sang SSR (Pages Function) — xem lại kiến trúc khi bất kỳ điều nào đúng trong 7 ngày liên tiếp:** > 30 lượt dispatch `site-publish`/ngày; thời gian run `pages-deploy.yml` trung vị > 10 phút; export > 5 MB hoặc > 2 000 đội; độ trễ duyệt → trang 200 trung vị > 15 phút. Đo bằng `gh run list --workflow pages-deploy.yml --json createdAt,updatedAt,event` và kích thước `curl -s …/export | wc -c`.

## Validation Log

### Session 1 — 2026-10-22
**Trigger:** câu hỏi mở của planner sau `/ak:plan --fast --tdd`.

| Câu hỏi | Quyết định | Áp vào |
|---|---|---|
| Ban/unban/xoá user chỉ dispatch khi user có ≥ 1 đội approved? | Không: luôn dispatch (giữ quyết định đã chốt; ban hiếm, concurrency gộp build) | Phase 2 |
| Smoke Phase 4 khi chưa có đội thật? | Cho phép executor tạo một đội thử trên production bằng tài khoản chủ project, duyệt, kiểm, rồi xoá ngay; tiêu đề có tiền tố `[SMOKE]` | Phase 4 |

## Whole-Plan Consistency Sweep
- Files reread: plan.md, phase-01-loi-vao-localization.md, phase-02-worker-export-dispatch.md, phase-03-trang-tinh-seo.md, phase-04-docs-trien-khai.md; đối chiếu local://verification-facts.md và 10 quyết định đã chốt.
- Decision deltas checked: 10 (menu/landing + publish localization; trang tĩnh vi/zh lúc build; SEO + canonical/`alternates={false}`/sitemap một URL; ngưỡng 10 id duy nhất; live widgets + pageKey/`sharedPool`; export trước `:id` + schema; `site-publish` + 5 điểm + `schedule`; redirect `?id=` có điều kiện + link tĩnh; loader fail-closed + `jsonLd()`/escape; ngoài phạm vi).
- Reconciled stale references: 4 (tiền đề "chưa có mùa" → mùa đã mở, 0 đội hiển thị; "đếm file" → đếm id duy nhất; `alternates={false}` chỉ bản gương → cả hai bản; Red Team #1 "không sửa SiteLayout" của plan cũ → đảo theo quyết định user, kèm chuỗi publish).
- Unresolved contradictions: 0
