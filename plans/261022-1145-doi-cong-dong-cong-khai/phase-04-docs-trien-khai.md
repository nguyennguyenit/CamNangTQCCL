---
phase: 4
title: "Docs, toàn bộ cổng kiểm, triển khai và smoke production"
status: pending
priority: P1
effort: "3h"
dependencies: [1, 2, 3]
---

# Phase 4 — Docs, toàn bộ cổng kiểm, triển khai và smoke production

## Mục tiêu
Tài liệu khớp code; mọi cổng kiểm xanh trong worktree; triển khai theo thứ tự Worker → `main` → workflow Pages; smoke production chứng minh vòng duyệt → trang tĩnh 200 + JSON-LD → xoá → 404; có runbook rollback.

## Bằng chứng
- Docs cần sửa:
  - `docs/community-worker.md:77-83` (mục "Build lại site khi xuất bản bài": `event_type: "blog-publish"`, chỉ blog), `:254` và `:353` (nhắc `blog-publish`), `:303-310` (API Đội cộng đồng — thêm export), `:337-349` (xoá đội, khoá/xoá tài khoản — thêm dispatch), `:351-360` (triển khai/rollback Đội cộng đồng).
  - `docs/system-architecture.md:140` (trang `/doi-cong-dong/` chỉ một trang tĩnh, 4 chế độ), `:144` (route `/zh/`).
  - `docs/deployment-guide.md:102` (blog sinh tĩnh từ `COMMUNITY_API_ORIGIN` — thêm trang đội), `:251-271` (giữ nguyên quy trình, Phase 1 đã dùng).
  - `docs/codebase-summary.md:74-75` (bảng file Đội cộng đồng).
  - `docs/project-changelog.md:9` (mẫu mục theo ngày; thêm mục mới phía trên).
- Workflow chỉ chạy từ `main` (`.github/workflows/pages-deploy.yml:28-30`); repository_dispatch dùng file workflow trên nhánh mặc định → `types: [site-publish]` chỉ có hiệu lực sau khi merge `main`. Build chạy `npm run verify` trước deploy (`:45-46`), nên dist sai hợp đồng không lên production.
- Loader fail-closed (Phase 3) + `COMMUNITY_API_ORIGIN` trong workflow (`pages-deploy.yml:26`) ⇒ nếu `main` mới chạy trước khi Worker có export, build dừng (404) — không deploy hỏng, nhưng chặn mọi deploy (kể cả bài viết) → Worker phải lên trước.
- Luật triển khai hiện hành: `docs/community-worker.md:254` ("không push `main` trước khi Worker mới đã chạy"), `:353-357` (rollback: revert `main` trước, chạy lại workflow, rồi `npx wrangler rollback`).
- Phụ thuộc mềm: `plans/261021-0628-doi-cong-dong/phase-07-docs-trien-khai.md:4` `status: in-progress` (bước remote). Live hiện có mùa mở `binh-dien-xuan-thu` và 0 đội hiển thị (local://verification-facts.md).

## File
- Sửa: `docs/community-worker.md`, `docs/system-architecture.md`, `docs/deployment-guide.md`, `docs/codebase-summary.md`, `docs/project-changelog.md`
- Sửa (cuối phase): `plans/261022-1145-doi-cong-dong-cong-khai/plan.md` + phase files (trạng thái)

## Thiết kế (nội dung docs)
- `community-worker.md`: đổi tiêu đề `:77` thành "Build lại site khi nội dung công khai đổi"; liệt kê 5 điểm dispatch + bài viết, `event_type: "site-publish"`, `schedule` hằng ngày (best-effort), kết quả ghi `meta.deploy` trong nhật ký; thêm `GET /api/community-teams/export` (schema v1, bảng trường như Phase 2) vào mục API; câu "chỉ `blog-publish` và chạy tay mới chạy" `:353` → `site-publish`, lịch, chạy tay.
- `system-architecture.md`: trang tĩnh `/doi-cong-dong/<id>/` + `/zh/…` sinh lúc build từ export; canonical theo `text_lang`, không hreflang; danh sách noindex < 10 đội; `?id=` chuyển sang URL tĩnh khi có; vote/bình luận/chiến báo live.
- `deployment-guide.md:102`: build đọc thêm `GET ${COMMUNITY_API_ORIGIN}/api/community-teams/export`, cùng chính sách rỗng/fail-closed.
- `codebase-summary.md`: thêm `src/lib/community-teams.ts`, `src/lib/community-team-pages.ts`, `src/components/pages/CommunityTeamPage.astro`, `src/pages/{,zh/}doi-cong-dong/[id].astro`, `community-worker/src/deploy.ts`.
- `project-changelog.md`: mục `## 2026-10-2x (Đội cộng đồng công khai)` — Added (menu/landing, trang tĩnh, export, schedule), Changed (`blog-publish` → `site-publish`, dispatch ở duyệt/xoá/khoá/mở khoá/xoá tài khoản, verifier/sitemap, publish lại bản dịch).

## Test-first matrix
Phase không thêm hành vi; "test" là toàn bộ cổng hồi quy và smoke có số liệu:

| Cổng | Lệnh | Kỳ vọng |
|---|---|---|
| Worker | `cd community-worker && npm test && npm run typecheck` | exit 0 |
| Node | `npm run test:node` | exit 0 |
| Localization | `python3 -m pipeline.site_localization check --root . --stage public` | exit 0 |
| Build/verify | `npm run build && npm run verify` | exit 0 (không env → 0 đội) |
| Dist | `npm run test:dist` | exit 0 |
| E2E | `npm run test:e2e` | exit 0 |
| Smoke prod | xem Các bước 7–9 | số liệu khớp |

## Các bước
1. Sửa docs theo mục Thiết kế. `grep -rn "blog-publish" docs community-worker/src community-worker/test community-worker/wrangler.jsonc .github` → chỉ còn trong `docs/project-changelog.md` (lịch sử).
2. Chạy đủ bảng cổng trong worktree, theo thứ tự trên (build trước test:dist; e2e build lại dist, không env).
3. Kiểm tiền đề: `curl -s https://tqccl-community.nguyennlt-ncc.workers.dev/api/community-seasons` trả JSON có `open`; phase 7 của plan 261021-0628 đã xong phần remote (nếu chưa → dừng và hỏi).
4. **(Dừng và hỏi trước)** Deploy Worker: `cd community-worker && npm run deploy`. Kiểm: `curl -s https://tqccl-community.nguyennlt-ncc.workers.dev/api/community-teams/export` → `{"schemaVersion":1,"items":[...]}` (hiện 0 item); `curl -sI …/api/community-teams/export | grep -i cache-control` → `no-store`.
5. **(Dừng và hỏi trước)** Merge `feat/doi-cong-dong` vào `main` và push. Từ lúc Worker deploy tới lúc này, dispatch `site-publish` bị GitHub bỏ qua (workflow trên `main` còn `blog-publish`).
6. **(Dừng và hỏi trước)** `gh workflow run pages-deploy.yml --ref main` rồi `gh run watch` → success. Trước khi chạy: `gh run list --workflow pages-deploy.yml -L 3` không có run `in_progress` (thấy deploy dở → dừng và hỏi).
7. Smoke tĩnh (HTML có thể nằm trên một dòng nên đếm bằng `grep -o … | wc -l`): `curl -s https://tqccl.com/ | grep -o 'href="/doi-cong-dong/"' | wc -l` ≥ 2 (menu + thẻ); `curl -s https://tqccl.com/zh/ | grep -o 'href="/zh/doi-cong-dong/"' | wc -l` ≥ 2; `curl -s https://tqccl.com/doi-cong-dong/ | grep -o 'content="noindex"' | wc -l` = 1 (0 đội); `curl -s https://tqccl.com/sitemap.xml | grep -o '/doi-cong-dong/' | wc -l` = 0.
8. Smoke vòng duyệt (đã được phép, Validation Log 2026-10-22): nếu chưa có đội thật chờ duyệt, đăng một đội thử bằng tài khoản chủ project, tiêu đề tiền tố `[SMOKE]`, rồi duyệt ở `/quan-tri/`. Sau khi duyệt, `gh run list --workflow pages-deploy.yml --event repository_dispatch -L 1` có run mới trong ≤ 1 phút; khi run success: `curl -sI https://tqccl.com/<locale gốc>/doi-cong-dong/<id>/` → 200; trang có `<link rel="canonical" href="https://tqccl.com/…/doi-cong-dong/<id>/">`, có `"@type":"WebPage"` và `"@type":"FAQPage"`, không có `hreflang`; bản locale kia canonical về bản gốc; `sitemap.xml` có đúng URL bản gốc; mở `https://tqccl.com/doi-cong-dong/?id=<id>` trong trình duyệt → URL đổi sang trang tĩnh; nhật ký `/quan-tri/#nhat-ky` dòng `team.approve` có `deploy: ok`.
9. Smoke gỡ: xoá/gỡ chính đội đó → run `repository_dispatch` mới → success → `curl -sI …/doi-cong-dong/<id>/` → 404; sitemap không còn URL.
10. Hôm sau: `gh run list --workflow pages-deploy.yml --event schedule -L 1` có run (xác nhận `schedule` hoạt động; lỗi → ghi vào rủi ro, không chặn).
11. Cập nhật trạng thái plan + phase (`ak plan` nếu có, hoặc frontmatter).

## Verification
```bash
cd community-worker && npm test && npm run typecheck && cd ..
npm run test:node
python3 -m pipeline.site_localization check --root . --stage public
npm run build && npm run verify && npm run test:dist
npm run test:e2e
```
Sau triển khai: các `curl`/`gh run list` ở bước 4, 6–10 với kỳ vọng ghi tại chỗ.

## Runbook rollback
1. Pages hỏng/sai: revert merge commit trên `main` (gồm cả commit publish localization của Phase 1) → `gh workflow run pages-deploy.yml --ref main` → site trở về menu cũ, không trang đội tĩnh, workflow lại nhận `blog-publish`.
2. Sau bước 1: `cd community-worker && npx wrangler rollback` (Worker cũ không có export, gửi `blog-publish` khớp workflow đã revert). Giữa bước 1 và 2, Worker mới gửi `site-publish` bị bỏ qua → chạy tay workflow một lần sau bước 2.
3. Không có thay đổi D1/R2 → không cần Time Travel.
4. Chỉ hỏng trang đội (Worker ổn): revert riêng commit Phase 3 trên `main` + chạy workflow; Worker giữ nguyên (export thừa vô hại).

## Rủi ro
- Pages atomicity khi run bị cancel sau POST manifest chưa kiểm thực nghiệm (plan.md "Rủi ro còn lại").
- Đội thử `[SMOKE]` public vài phút trên production; bước 9 phải xoá ngay sau khi kiểm, kể cả khi bước 8 thất bại.

## Checklist
- [ ] Docs 5 file cập nhật; `blog-publish` chỉ còn trong changelog lịch sử
- [ ] Bảng cổng xanh trong worktree
- [ ] Worker deploy + export 200 (đã hỏi)
- [ ] Merge + push `main` (đã hỏi)
- [ ] `gh workflow run` success (đã hỏi)
- [ ] Smoke tĩnh vi/zh
- [ ] Smoke duyệt → 200 + JSON-LD; gỡ → 404
- [ ] Run `schedule` đầu tiên quan sát được
