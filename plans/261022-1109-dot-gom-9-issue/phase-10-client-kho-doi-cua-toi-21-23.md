---
phase: 10
title: "Client kho và Đội của tôi (#21, #23)"
status: in-progress
priority: P1
effort: "2.5d"
dependencies: [4, 5, 9]
---

# Phase 10: Client kho và Đội của tôi (#21, #23)

## Goal

Phần client của #21/#23 (đã code trong snapshot phase 1, theo phase 3–6 của plan gốc `plans/261021-0632-dong-bo-kho-va-doi-cua-toi/`) được chạy lại trên `main` hiện tại, dùng id binh thư đã đóng băng, qua đủ cổng kiểm trong PR, và **merge trong cửa sổ release của phase 11** (không merge sớm hơn).

<!-- Updated: Red Team 2026-10-22 - liệt kê đủ file theo từng cách chuyển; merge trong cửa sổ release; bookLookupId đã bị xóa ở phase 5 -->

## Bối cảnh

- `pages-deploy.yml` build `main` mỗi lần xuất bản blog. Nếu PR này merge sớm, client đồng bộ đám mây lên production mà không ai theo dõi; xóa hộp là xóa cứng phía server (snapshot `community-worker/src/routes/roster.ts:163-165`), và cách khôi phục duy nhất là Time Travel cả database. Vì vậy PR này mở và xanh từ trước, nhưng chỉ merge ở bước 1 của phase 11.
- Phase 5, 7, 8, 9 cũng sửa một số file mà snapshot sửa. Không được `git checkout <snapshot> -- <file>` cho bất kỳ file nào đã có trên `main`.
- Phase 5 đã xóa `bookLookupId`; mọi chỗ dùng nó trong snapshot phải chuyển sang `row.id`.
- Hợp đồng dữ liệu đã duyệt: `docs/roster-sync.md` (đã lên `main` ở phase 4). Không đổi schema ở phase này.

## Cách chuyển từng file từ snapshot

Nguồn: `git diff --name-status 1fa81ab <snapshot>` (liệt kê lại khi làm; danh sách dưới đây lấy từ `git status --untracked-files=all` của worktree ngày 2026-10-22, bỏ `src/data/recommended-reference/**`).

**A. File mới, lấy nguyên (`git checkout <snapshot> -- <path>`):**
`js/my-teams-api.js`, `js/my-teams-editor.js`, `js/my-teams.js`, `js/my-teams-links.js`, `js/my-teams-model.js`, `js/my-teams-pending.js`, `js/my-teams-save-button.js`, `js/my-teams-sources.js`, `js/my-teams-ui.js`, `js/roster-cloud-store.js`, `js/roster-id-resolve.js`, `js/roster-picker.js`, `js/roster-scan-writer.js`, `js/roster-sync.js`, `src/components/pages/MyTeamsPage.astro`, `src/lib/my-teams-source-index.ts`, `src/pages/doi-cua-toi/index.astro`, `src/pages/zh/doi-cua-toi/index.astro`, `src/pages/my-teams-source-index.json.ts`, `tests-e2e/helpers/roster-mock.mjs`, `tests-e2e/my-teams.spec.mjs`, `tests-js/my-teams-{crud,links,model,pending,sources,ui-label}.test.mjs`, `tests-js/roster-{cloud-store,id-resolve,picker,scan-writer,sync}.test.mjs`, `tests-js/support/my-teams-fixtures.mjs`, `tests-js/support/roster-fake-server.mjs`.
Sau khi lấy: sửa `js/roster-picker.js:13,69`, `js/my-teams.js:12,23`, `tests-js/roster-picker.test.mjs:6,63-69` từ `bookLookupId` sang `row.id`.

**B. File ghim, áp diff bằng 3-way merge (`git diff 1fa81ab <snapshot> -- <file> | git apply -3`, giải xung đột bằng tay):**
`js/analyze.js`, `js/detail-actions.js`, `js/khaihoang-detail.js`, `js/roster-recommend-ui.js` (gộp với phase 7, 8), `js/roster-scan-state.js`, `js/team-detail.js`, `src/components/pages/KhaiHoangDetail.astro`, `src/components/pages/LegacyDetail.astro`, `src/components/pages/RecommendedDetail.astro` (gộp với phase 9).

**C. File không ghim nhưng đã có trên `main`, áp diff bằng 3-way merge như B:**
- `js/community-api.js` — `signOut()` xóa `tqccl.roster.cloud.v1` trong `finally` (bảo vệ máy dùng chung).
- `js/community-auth.js` — mục menu "Đội của tôi".
- `src/lib/locale-routes.ts` — thêm `/doi-cua-toi/` vào `COMMUNITY_PATHS` (noindex, ngoài sitemap).
- `src/lib/team-detail-pages.ts` — `team-save-payload` cho nút lưu ở trang chi tiết (gộp với phase 9).
- `scripts/verify-astro-dist.mjs` — kiểm index và payload Đội của tôi (gộp với phase 9).
- `public/_headers` — cache cho `/doi-cua-toi/*`, `/my-teams-source-index.json`.
- `src/lib/public-artifact-manifest.mjs` — entry cho các JS mới (gộp với phase 7, 8).
- `css/styles.css` (gộp với phase 7, 8, 9).
- `src/components/pages/PrivacyPage.astro` — mục "Đội của tôi".
- `pipeline/site_localization.py` — gỡ hai obligation `ui:roster/setup-*` (chuỗi đã bị xóa khỏi `roster-recommend-ui.js`).
- Test: `tests-js/astro-dist-contract.test.mjs`, `tests-js/pages-headers-contract.test.mjs`, `tests-js/roster-scan-state.test.mjs`, `tests-e2e/beta-tools.spec.mjs`, `tests-e2e/community-teams.spec.mjs`.
- Docs: `README.md`, `docs/codebase-summary.md`, `docs/design-guidelines.md`, `docs/project-changelog.md`, `docs/system-architecture.md`, `docs/deployment-guide.md`, `docs/community-worker.md` (phần client; phần worker đã lên ở phase 4).

**D. Sửa tay rồi mới chạy chuỗi publish:** `pipeline/site-localization-policy.json` — các thay đổi cấu trúc của snapshot (thêm `js/roster-picker.js` vào `entrypoints`, thêm `sourceFiles` mới), theo `docs/deployment-guide.md:258-260`. Chuỗi publish chỉ re-pin hash, không thêm entrypoint.

**E. Không lấy, sinh lại:** `src/data/recommended-reference/**`, `data/website-display.json`, `pipeline/team-route-handles.json`, `mcp-worker/src/generated/workflow-build.ts`.

**F. Đã lên ở phase 4, không lấy lại:** `community-worker/**`, `docs/roster-sync.md`.

## TDD

Test đã có trong snapshot (client sync, picker, my-teams, e2e) chạy lại trên `main`. Thêm, đỏ trước:

1. Đổi tên Việt một binh thư trong fixture: đội đã lưu có `book:<slug cũ>` vẫn hiện đúng tên trong bảng chọn, trình soạn và nhãn Soi đội.
2. Không file nào trong `js/` hay `tests-js/` còn import `bookLookupId`.
3. Khi `/api/roster` trả 404 hoặc lỗi mạng, client giữ kho local và chế độ chỉ đọc, không mất dữ liệu.
4. Chưa đăng nhập: `/goi-y-doi-tu-kho/` chạy y như trước, kể cả mục tranh món (phase 7) và độ phủ (phase 8).
5. `signOut()` xóa `tqccl.roster.cloud.v1` kể cả khi gọi đăng xuất lỗi.
6. Dist: `/doi-cua-toi/index.html` có `noindex`, không có trong `sitemap.xml`; `/my-teams-source-index.json` nằm trong allowlist và `_headers`.
7. Trang chi tiết Đội chuẩn, Đội khác, Khai hoang có `team-save-payload` hợp lệ (verifier trong `verify-astro-dist.mjs`).

## Tasks & Steps

1. Kiểm phase 4 đã release: `curl -s -o /dev/null -w '%{http_code}' https://tqccl.com/api/roster` → `401`. Chưa có thì dừng.
2. Nhánh `feat/roster-client` từ `main` sau khi phase 9 merge. Chuyển file theo A–F.
3. Viết test 1–7; sửa tới khi xanh.
4. Sửa policy theo D; chạy chuỗi publish lại bản dịch; re-pin `pipeline/team-route-handles.json`; `cd mcp-worker && npm run generate:workflow-build`.
5. Mở PR (có thể tách hai PR: kho trước, Đội của tôi sau, nếu diff quá lớn). CI xanh. **Không merge**; merge ở phase 11 bước 1.

## Verification

```
python3 -m pipeline.site_localization check --root . --stage public
<chuỗi Publish lại bản dịch hiển thị>
python3 -m pipeline.team_route_handles --check
(cd mcp-worker && npm run generate:workflow-build && npm run check)
node scripts/report-zh-gaps.mjs --check
npm run check && npm run build && npm run verify && npm run test:dist && npm run test:node
npx playwright test
```

Local smoke với worker local: `cd community-worker && npx wrangler dev --port 8788` + `npx wrangler pages dev dist --service COMMUNITY=tqccl-community`, session Better Auth dựng sẵn: lưu đội từ 4 nguồn, gộp kho local lần đầu, xóa hộp/nhóm. Kiểm production với tài khoản Google thật ở phase 11.

## Risks

- Ghi đè việc của phase 5, 7, 8, 9: không dùng `git checkout` cho file đã có trên `main`; chạy lại toàn bộ e2e Gợi ý đội, trang đội, trang mùa.
- Phát hiện phải đổi schema: dừng và hỏi (sẽ cần release worker lần hai).
