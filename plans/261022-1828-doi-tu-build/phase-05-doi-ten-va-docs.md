---
phase: 5
title: "Đổi tên Đội cộng đồng → Đội tự build / 自配阵容, Privacy và docs"
status: pending
priority: P2
effort: "0.5d"
dependencies: [4]
---

# Phase 5 — Đổi tên và docs

## Goal

Mọi nhãn hiển thị, chú thích code và tài liệu dùng tên mới: **"Đội tự build"** (vi; chữ thường "đội tự build") và **"自配阵容"** (zh).

Trang Chính sách bảo mật mô tả đúng hành vi mới:
- 1 ảnh, và chọn ảnh là gửi ảnh cho AI.
- Thân bài.
- Nháp lưu trên trình duyệt: xoá khi gửi, khi bấm "Xoá nháp", khi đăng xuất, hoặc sau 30 ngày.

Docs mô tả:
- `body_md`, export v2.
- `MAINTENANCE` (gồm chặn đăng nhập).
- Chuẩn hoá page key cũ và 400 `stale_client` cho payload cũ. <!-- Updated: Validation Session 1 - stale_client 409 → 400 -->
- `site_quota`/`remaining`.
- Chuyển hướng 302 → 301.
- Migration `0012` (đã diễn tập) và cách cutover/rollback.
- Ngoại lệ bundler trong quy chuẩn. <!-- Red Team #4, #7, #8, #10, #12, #15 -->

## Context links

- Grep `[Đđ]ội cộng đồng|社区阵容` (2026-10-23, trên `0f89e2e`; PR #36 và phase 1–4 làm lệch dòng). Luôn grep lại trước khi sửa và tìm theo chuỗi: <!-- Red Team #3 -->
  - `js/community-teams.js` (chú thích đầu file, `aria-label` của `nav`); `js/community-admin-teams.js` (chú thích đầu file, `aria-label` danh sách); `js/community-admin-users.js` (nhãn `team.approve`, `team.reject`, `team.delete`, loại `team`); `js/community-admin.js` (chú thích đầu file, `label` của khu `doi-tu-build`); `js/community-api.js` (JSDoc `communityPageHref`); `js/community-auth.js` (nhãn link đội; link `?mine=1` giữ nhãn "Đội đã đăng" của PR #36); `js/community-comments.js`, `js/community-reports.js` (JSDoc `sharedPool`); `js/community-team-data.js`, `js/community-team-form.js`, `js/community-team-state.js` (chú thích đầu file).
  - `src/components/pages/CommunityTeamsPage.astro` (`title`, `description`, `tagline`, chú thích); `src/components/community/CommunityTeamsHub.astro` (h1, đoạn mô tả); `src/components/community/ReportsHub.astro` (chữ link); `src/components/community/AdminConsole.astro` (`adm-intro`); `src/components/pages/PrivacyPage.astro` (mục `id: 'doi-cong-dong'` và ba câu ở phần nhà cung cấp, thời gian lưu, quyền của bạn).
  - `css/styles.css` (chú thích `/* ---------- Đội cộng đồng (/doi-cong-dong/) ---------- */`).
  - `community-worker/src/deploy.ts`, `ratelimit.ts`, `teams-validate.ts`, `validate.ts`, `routes/comments.ts`, `routes/reports.ts`, `routes/teams.ts` (chỉ chú thích).
  - `.github/workflows/pages-deploy.yml` (chú thích dòng 3).
  - `scripts/design-canvas/capture-community.mjs` (đường dẫn, luồng "Đọc bằng AI", hằng `ANALYSIS`); `scripts/design-canvas/build-community-boards.mjs` (chú thích dòng 1, nhãn trong `BOARDS`; **không** đổi khoá `DoiCongDong…`).
  - `tests-e2e/community-teams.spec.mjs` (kỳ vọng `"Đội cộng đồng"`, `"Duyệt đội cộng đồng"`, `"đội cộng đồng · Đội t1"`, `"通过社区阵容"`, `"社区阵容 · Đội t1"`, tên test menu).
- Docs:
  - `docs/community-worker.md`: mục `## Đội cộng đồng` tới hết "Triển khai và rollback" của mục đó; dòng mã lỗi ở "Hành vi cần biết".
  - `docs/codebase-summary.md` (hai dòng bảng của đội cộng đồng).
  - `docs/system-architecture.md` (gạch `/quan-tri/` nói "soạn bài Markdown có xem trước an toàn dựng bằng DOM", và gạch `/doi-cong-dong/`). <!-- Red Team #15 -->
  - `docs/code-standards.md` (dòng "Dùng vanilla ES modules; không thêm framework/bundler nếu không có yêu cầu sản phẩm rõ."). <!-- Red Team #15 -->
  - `docs/deployment-guide.md` (đoạn "`--write` từ chối ledger đã bị sửa tay…"); `docs/unified-lookup.md` (gạch "Promote generation mới…"); `docs/project-changelog.md` (đầu file).
- Không sửa: `community-worker/migrations/0008_community_teams.sql` (đã áp), `docs/design/**`, `scripts/design-canvas/shot.mjs`, `plans/**` khác, journal. <!-- Red Team #2 -->

## Files to Create/Modify

- Sửa: các file `js/`, `src/components/`, `css/styles.css`, `community-worker/src/`, `.github/workflows/pages-deploy.yml`, `scripts/design-canvas/capture-community.mjs`, `scripts/design-canvas/build-community-boards.mjs`, `tests-e2e/community-teams.spec.mjs` liệt kê ở Context links.
- Sửa: `docs/community-worker.md`, `docs/codebase-summary.md`, `docs/system-architecture.md`, `docs/code-standards.md`, `docs/deployment-guide.md`, `docs/unified-lookup.md`, `docs/project-changelog.md`.

## Tasks

### Task 5.1 — Đổi nhãn giao diện
- Goal: người dùng không còn thấy "Đội cộng đồng"/"社区阵容" ở bất kỳ trang nào.
- Target files and symbols: các file `js/` và `src/components/` ở Context links.
- Steps:
  1. Trong mọi lời gọi `L`, `t`, `pick` **và mọi chú thích** của các file `js/` và `src/components/` ở Context links (trừ `PrivacyPage.astro`, làm ở task 5.2):
     - Thay `'Đội cộng đồng'` → `'Đội tự build'`, `'đội cộng đồng'` → `'đội tự build'`, `'社区阵容'` → `'自配阵容'`.
     - Câu ghép giữ ngữ pháp. Ở `js/community-admin-users.js`: nhãn `team.approve`/`team.reject`/`team.delete` → `'Duyệt bài Đội tự build'/'通过自配阵容'`, `'Từ chối bài Đội tự build'/'拒绝自配阵容'`, `'Gỡ bài Đội tự build'/'下架自配阵容'`; loại `team` → `'bài Đội tự build'/'自配阵容'`.
     - Chú thích đầu `js/community-team-form.js` viết lại theo form mới: 1 ảnh tự tải lên và tự đọc AI, thân bài Markdown qua `<cm-md-editor>` hoặc `<textarea>` dự phòng, nháp `localStorage`.
     - Không đổi nhãn `?mine=1` của PR #36.
  2. `CommunityTeamsPage.astro`:
     - `title`: `'Đội tự build — Cẩm Nang Game Tam Quốc Chí - Chiến Lược'` / `'自配阵容 — 三国志战略版攻略手册'`.
     - `description`: `'Bài đội do người chơi tự build theo mùa: đội hình, cách chơi, bình chọn, bình luận và chiến báo.'` / `'玩家按赛季发布的自配阵容文章：阵容、打法、投票、评论和战报。'`.
     - `tagline`: đổi tên.
  3. `CommunityTeamsHub.astro`:
     - h1: đổi tên.
     - Đoạn mô tả: `'Bài viết về đội do người chơi tự build cho mùa đang mở. Bài được quản trị viên duyệt trước khi hiện; mọi người có thể bình chọn, bình luận và gửi chiến báo.'` / `'玩家为当前赛季撰写的自配阵容文章。内容经管理员审核后显示；大家可以投票、评论并提交战报。'`.
  4. `AdminConsole.astro`: `'duyệt đội cộng đồng'` → `'duyệt bài Đội tự build'`; `'审核社区阵容'` → `'审核自配阵容'`.
  5. `tests-e2e/community-teams.spec.mjs`: đổi các kỳ vọng tên đã liệt kê (`name: "Đội tự build"`, `"Duyệt bài Đội tự build"`, `"Đối tượng: bài Đội tự build · Đội t1"`, `"通过自配阵容"`, `"对象：自配阵容 · Đội t1"`, tên test menu).
- Success criteria: grep `[Đđ]ội cộng đồng|社区阵容` trong `js src tests-e2e` chỉ còn kết quả trong `src/components/pages/PrivacyPage.astro`.
- Verify: grep trên không trả kết quả nào ngoài `src/components/pages/PrivacyPage.astro`.

### Task 5.2 — Chính sách bảo mật <!-- Red Team #4 -->
- Goal: mục Privacy mô tả đúng dữ liệu và luồng mới (vi + zh).
- Target files and symbols: `src/components/pages/PrivacyPage.astro`, mục `id: 'doi-cong-dong'` và ba câu nhắc tên ở các mục sau. PR #36 đã sửa file này nên tìm theo chuỗi.
- Steps:
  1. `id: 'doi-cong-dong'` → `id: 'doi-tu-build'`; heading `t('Đội tự build', '自配阵容')`.
  2. Câu dữ liệu lưu ("Đội bạn đăng (tiêu đề, 3 tướng…") → tiêu đề, 3 tướng, chiến pháp, binh chủng, **nội dung bài viết** (`'正文'`), ngôn ngữ, mùa, kèm **1 ảnh** (bài cũ có thể có tới 3 ảnh).
  3. Câu "Khi bạn bấm "Đọc bằng AI"…" → `'Khi bạn chọn ảnh đội hình, ảnh được tải lên và gửi ngay tới nhà cung cấp AI của site (DeepSeek hoặc OpenCode Zen, theo thứ tự quản trị viên đặt) để đọc nháp tên tướng và chiến pháp. Kết quả chỉ là nháp để bạn tự kiểm tra, sửa rồi mới gửi.'` / `'当你选择阵容图片时，图片会立即上传并发送至本站使用的 AI 服务商（DeepSeek 或 OpenCode Zen，按管理员设定的顺序），用于识别武将和战法草稿。识别结果只是草稿，需由你检查、修改后再提交。'`.
  4. `'phần phân tích'` → `'nội dung bài'`; zh `'分析内容'` → `'正文'`.
  5. Thêm một mục ngay sau câu "Đội bị từ chối…": `'Nháp bài đang viết được lưu trong trình duyệt của bạn (localStorage), không gửi lên máy chủ, gắn với tài khoản và mùa, không lưu ảnh. Nháp bị xoá khi bạn gửi bài, bấm "Xoá nháp", đăng xuất, hoặc sau 30 ngày.'` / `'正在撰写的草稿保存在你的浏览器中（localStorage），不会上传到服务器，按账号和赛季区分，不保存图片。提交文章、点击“删除草稿”、退出登录或 30 天后草稿即被删除。'`.
  6. Ba câu nhắc tên ở mục nhà cung cấp, thời gian lưu, quyền của bạn: `'đội cộng đồng'` → `'bài Đội tự build'`, `'ảnh đội cộng đồng'` → `'ảnh bài Đội tự build'`, `'社区阵容'` → `'自配阵容'`.
- Success criteria: Privacy không còn tên cũ, không còn "Đọc bằng AI", có câu về nháp kèm 30 ngày và đăng xuất.
- Verify: grep `[Đđ]ội cộng đồng|社区阵容|Đọc bằng AI` trong `src/components/pages/PrivacyPage.astro` trả 0 kết quả; grep `30 ngày` trong file đó trả ≥ 1 kết quả.

### Task 5.3 — Chú thích code, CSS, workflow, script canvas
- Goal: chú thích và công cụ nội bộ dùng tên/đường dẫn/luồng mới.
- Target files and symbols: chú thích trong `community-worker/src/` (Context links), chú thích CSS, `.github/workflows/pages-deploy.yml` dòng 3, `scripts/design-canvas/capture-community.mjs`, `scripts/design-canvas/build-community-boards.mjs`.
- Steps:
  1. Chú thích trong `community-worker/src/`: `Đội cộng đồng` → `Đội tự build`, `đội cộng đồng` → `đội tự build`. Chú thích CSS → `/* ---------- Đội tự build (/doi-tu-build/) ---------- */`.
  2. `pages-deploy.yml` dòng 3: `đội cộng đồng` → `bài Đội tự build`. Không đổi gì khác.
  3. `capture-community.mjs`:
     - Đường dẫn `/doi-cong-dong/` → `/doi-tu-build/`, `#doi-cong-dong` → `#doi-tu-build`.
     - `ANALYSIS` thay bằng hằng `BODY_MD` (chuỗi Markdown có `## Lối chơi`, `## Điểm mạnh`…); `teamDetail` dùng `bodyMd: BODY_MD`.
     - Màn `DoiCongDongNew`: bỏ bấm "Đọc bằng AI" (ảnh tự đọc sau `setInputFiles`); thay `#cm-team-playstyle` bằng click `cm-md-editor .ProseMirror` rồi `page.keyboard.type`.
     - Màn `AdminTeams`: `name: 'Đội tự build'`, bấm `'Xem bài'`.
  4. `build-community-boards.mjs`: chỉ đổi chữ nhãn (`'Đội tự build — danh sách'`, …, `'Quản trị — Đội tự build'`) và chú thích dòng 1; giữ nguyên khoá board.
- Success criteria: không còn tên cũ trong các file trên.
- Verify:
  - Grep `[Đđ]ội cộng đồng|社区阵容|doi-cong-dong|Đọc bằng AI|cm-team-playstyle` trong `scripts/design-canvas/capture-community.mjs scripts/design-canvas/build-community-boards.mjs css .github community-worker/src` chỉ còn `community-worker/src/validate.ts` (`LEGACY_TEAM_PAGE_RE` và chú thích của nó).
  - `node --check scripts/design-canvas/capture-community.mjs && node --check scripts/design-canvas/build-community-boards.mjs` exit 0.

### Task 5.4 — Docs
- Goal: docs khớp code mới và có hướng dẫn vận hành cutover/rollback.
- Target files and symbols: các file docs ở Context links.
- Steps:
  1. `docs/community-worker.md`:
     - Tiêu đề mục thành `## Đội tự build`. Đoạn mở đầu thêm:
       - link plan `plans/261022-1828-doi-tu-build/plan.md`;
       - URL `/doi-tu-build/`;
       - bài = đội + thân bài Markdown, đúng 1 ảnh cho bài mới (bài cũ giữ tới 3);
       - page key `/doi-tu-build/<id>/`.
       Giữ nguyên các tiêu đề con khác (anchor `#ai-đọc-nháp-đội` đang được link trong cùng file).
     - Bảng/cột: thay `playstyle` và năm trường bằng `body_md` (Markdown, ≤ 10 000 ký tự cho bài mới; bài gộp từ 6 cột cũ có thể dài hơn).
     - Trigger và đoạn bình luận/chiến báo:
       - tiền tố `/doi-tu-build/`, offset `substr(page_key, 15, …)`;
       - `parsePageKey` chuẩn hoá page key `/doi-cong-dong/<id>/` của client cũ thành `/doi-tu-build/<id>/`. <!-- Red Team #8 -->
     - API:
       - chi tiết trả `bodyMd`;
       - thêm `GET /api/community-teams/export` → `{schemaVersion: 2, items: [{…, bodyMd, approvedAt}]}`, `author` chỉ `{id, name}`;
       - body `POST` thành `{title 1–80, heroes[3], tactics[3][2], troop, bodyMd 10–10 000 (CRLF thành LF), lang vi|zh, uploadIds[1]}`;
       - payload có `playstyle` mà không có `bodyMd` → 400 `stale_client`. <!-- Updated: Validation Session 1 - stale_client 409 → 400 -->
     - AI đọc nháp: <!-- Red Team #12 -->
       - client tự gọi analyze đúng một lần cho mỗi ảnh vừa chọn;
       - kiểm trần site 300/ngày **trước** (429 `site_quota`, không trừ lượt riêng), rồi quota 20/ngày/user (429 `rate_limited`);
       - thành công trả `remaining`.
     - "Triển khai và rollback" của mục, thêm đoạn `0012`: <!-- Red Team #1, #7, #10, #11 -->
       - Đã diễn tập trên D1 tạm.
       - Chạy trong cửa sổ `MAINTENANCE` (bật/tắt bằng `wrangler versions deploy` của version upload sẵn; cấm `npm run deploy` trong cửa sổ).
       - Thứ tự: chuẩn bị trước cửa sổ (tắt workflow Pages → merge → build → upload hai version Worker) → bật bảo trì → chờ request ghi cũ kết thúc (200 s + hai dấu vân tay bằng nhau) → bookmark → migrate → deploy Worker → deploy Pages → kiểm → mở và bật lại workflow. Cửa sổ bắt đầu ngay sau phút `:17` của cron và phải mở lại trước `:15` giờ kế tiếp. <!-- Updated: Kongming advice - thứ tự cutover mới -->
       - Chuyển hướng 302 lúc cutover, 301 sau ≥ 24 giờ.
       - Rollback trước khi mở: Time Travel bookmark + version P0 + Pages cây cũ kèm rule ngược 302; liệt kê dữ liệu mất khi restore. Sau khi mở chỉ sửa tiến.
       - `rollback/0009`/`0010` theo tiền tố `/doi-tu-build/`.
       - Link `plans/261022-1828-doi-tu-build/phase-06-release-cutover-runbook.md`.
     - Dòng mã lỗi ở "Hành vi cần biết": thêm `maintenance` (503), `site_quota` (429), `stale_client` (400, payload form cũ). <!-- Updated: Validation Session 1 - stale_client 409 → 400 -->
  2. `docs/codebase-summary.md`: thêm `js/markdown.js` (renderer view-tree, profile `admin` giữ hành vi cũ, `ugc` cho bài người dùng), `src/scripts/md-editor-*.ts` (custom element `<cm-md-editor>`, TipTap 3.32.0, chunk `_astro`, `<textarea>` dự phòng), `migrations/0012_doi_tu_build.sql`; đổi tên trang và đường dẫn.
  3. `docs/system-architecture.md`: <!-- Red Team #15 -->
     - Gạch `/doi-cong-dong/` → `/doi-tu-build/`: form 1 ảnh tự đọc; editor TipTap nạp qua script Astro có xử lý (entry Vite duy nhất của site, chỉ trang này); render `bodyMd` bằng `js/markdown.js`.
     - Gạch `/quan-tri/`: "xem trước an toàn dựng bằng DOM" → "xem trước bằng renderer dùng chung `js/markdown.js` profile `admin`".
  4. `docs/code-standards.md`, dòng "Dùng vanilla ES modules; không thêm framework/bundler…", thêm câu ngoại lệ: "Ngoại lệ đã duyệt: editor TipTap 3.32.0 (pin chính xác) chỉ trong `src/scripts/md-editor-*.ts`, chỉ nạp ở `/doi-tu-build/` qua script Astro có xử lý; code trong `js/` vẫn không bundler." <!-- Red Team #15 -->
  5. `docs/deployment-guide.md` và `docs/unified-lookup.md`: thêm câu `_redirects` còn có chuyển hướng trang đổi tên (`RENAMED_PAGE_ROUTES`/`RENAMED_PAGE_STATUS`, `/doi-cong-dong` → `/doi-tu-build/`, vi + zh, splat ở cuối file, 302 lúc cutover rồi 301).
  6. `docs/project-changelog.md`: thêm mục mới trên cùng `## 2026-10-23 (Đội tự build)` với:
     - `### Added`: editor, `<textarea>` dự phòng, nháp, đăng lại, `js/markdown.js`, `MAINTENANCE`, chuyển hướng, `remaining`.
     - `### Changed`: tên, URL, 1 ảnh tự đọc, `body_md`, export v2, chuẩn hoá page key, `stale_client`, thứ tự quota + `site_quota`, thông báo 429.
     - `### Removed`: 6 cột, nút "Đọc bằng AI", renderer cũ trong `community-admin.js`.
     - Dòng "Migration `0012` cần cửa sổ bảo trì; xem runbook phase 6".
- Success criteria: docs không còn mô tả 6 trường hay nút "Đọc bằng AI" như hành vi hiện tại.
- Verify:
  - Grep `playstyle|Đọc bằng AI|1–3 ảnh` trong `docs/community-worker.md docs/system-architecture.md docs/codebase-summary.md` chỉ còn câu nói về dữ liệu cũ, migration hoặc payload cũ (đọc từng kết quả và đối chiếu).
  - Grep `schemaVersion: 2` trong `docs/community-worker.md` trả ≥ 1 kết quả.
  - Grep `TipTap` trong `docs/code-standards.md` trả ≥ 1 kết quả.

### Task 5.5 — Grep cuối, cổng của phase, mở PR
- Goal: chứng minh không còn tên/đường dẫn cũ ngoài danh sách được phép; PR mở với đúng file của plan.
- Target files and symbols: worktree `feat/doi-tu-build`.
- Steps:
  1. Grep `doi-cong-dong|[Đđ]ội cộng đồng|社区阵容` trong `js src public scripts/design-canvas/capture-community.mjs scripts/design-canvas/build-community-boards.mjs scripts/verify-astro-dist.mjs tests-js tests-e2e css community-worker/src community-worker/test community-worker/rollback .github pipeline tests docs/community-worker.md docs/system-architecture.md docs/codebase-summary.md docs/code-standards.md docs/deployment-guide.md docs/unified-lookup.md`.
  2. So từng kết quả với danh sách được phép; mọi kết quả khác phải sửa. Danh sách được phép:
     - `community-worker/src/validate.ts` (`LEGACY_TEAM_PAGE_RE` và chú thích).
     - `community-worker/test/teams-validate.test.ts`, `comments.test.ts`, `teams.test.ts` (ca chuẩn hoá, ca `PAGE_KEY_RE` âm, ca payload cũ).
     - `community-worker/test/doi-tu-build-migration.test.ts` (seed).
     - `community-worker/rollback/0009_drop_community_team_triggers.sql` (chú thích lịch sử nếu có).
     - `pipeline/lookup_route_handles.py` (`RENAMED_PAGE_ROUTES`, docstring); `tests/test_lookup_route_handles.py`.
     - `public/_redirects` (4 dòng cuối).
     - Câu trong docs nói về URL cũ, migration, chuyển hướng, chuẩn hoá page key hoặc `stale_client`.
  3. `npm run test:node`
  4. `npm run build`
  5. `npm run verify`
  6. `npm run test:dist`
  7. `npx playwright test tests-e2e/community-teams.spec.mjs`
  8. `cd community-worker && npm test && npm run typecheck`
  9. `python3 -m unittest tests.test_lookup_route_handles`
  10. `python3 -m pipeline.site_localization check --root . --stage public`
  11. Commit và mở PR: <!-- Red Team #2 -->
      - `git add` đúng các file đã sửa ở task 5.1–5.4, liệt kê từng đường dẫn: các file `js/` và `src/components/` ở Context links, `css/styles.css`, `community-worker/src/deploy.ts community-worker/src/ratelimit.ts community-worker/src/teams-validate.ts community-worker/src/validate.ts community-worker/src/routes/comments.ts community-worker/src/routes/reports.ts community-worker/src/routes/teams.ts`, `.github/workflows/pages-deploy.yml`, `scripts/design-canvas/capture-community.mjs scripts/design-canvas/build-community-boards.mjs`, `tests-e2e/community-teams.spec.mjs`, `docs/community-worker.md docs/codebase-summary.md docs/system-architecture.md docs/code-standards.md docs/deployment-guide.md docs/unified-lookup.md docs/project-changelog.md`.
      - `git diff --cached --name-only`.
      - `git commit -m "docs(community): rename to Đội tự build / 自配阵容, privacy and runbook"`.
      - `git push -u origin feat/doi-tu-build`.
      - `gh pr create --base main --title "Đội tự build: body Markdown, 1 ảnh tự đọc, /doi-tu-build/" --body-file plans/261022-1828-doi-tu-build/plan.md`.
      - **Không merge** (merge nằm trong cửa sổ cutover, phase 6).
- Success criteria: bước 2 không còn kết quả ngoài danh sách; lệnh 3–10 exit 0; PR mở và chưa merge; không file lạ trong PR.
- Verify:
  - Lệnh 3–10 exit 0 (`node --test` in `# fail 0`, Playwright không `failed`, unittest in `OK`).
  - Output `git diff --cached --name-only` không có `docs/design/` hay `scripts/design-canvas/shot.mjs`.
  - `gh pr view --json state -q .state` in `OPEN`.
  - `gh pr diff --name-only | grep -cE '^(docs/design/|scripts/design-canvas/shot\.mjs)'` in `0`.

## Risk

- Chữ trong test e2e và trong UI lệch nhau: chạy Playwright trong cổng.
- Đổi id neo Privacy làm hỏng link ngoài tới `#doi-cong-dong`: trong repo không có link nào tới neo này (đã grep).

## Security

- Privacy phải nói rõ ảnh được gửi AI **ngay khi chọn**, và nêu đúng các điều kiện xoá nháp.

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
