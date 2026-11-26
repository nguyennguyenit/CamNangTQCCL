---
phase: 3
title: "Verifier, E2E, docs"
status: done
priority: P2
effort: "4h"
dependencies: [2]
---

# Phase 3: Verifier, E2E, docs

## Goal
Chặn tái phát ở `dist/`; E2E chứng minh nút Quay lại ở mọi đường; docs khớp hành vi mới.

## Files
- Modify: `scripts/verify-astro-dist.mjs`, `tests-js/astro-dist-contract.test.mjs` (file duy nhất import verifier, `:36`)
- Modify: `src/lib/host-bridge.ts` (export danh sách host cũ nếu chưa export)
- Modify E2E: `tests-e2e/team-ssr-adopt.spec.mjs:90-94`, `tests-e2e/spa-parity.spec.mjs:349,401-420,441-461,578`, `tests-e2e/khaihoang-options.spec.mjs:135,242,630-704`, `tests-e2e/team-detail-pages.spec.mjs:465,471-479,617-622,689-692`, `tests-e2e/unified-lookup.spec.mjs:543,1029-1036`, `tests-e2e/doi-chuan-roster-badges.spec.mjs`
- Modify docs: `docs/system-architecture.md:130`, `docs/code-standards.md:49,80`, `docs/project-changelog.md`

## Tests Before
1. Unit verifier (export hàm, vd `internalLinksWithReturnQuery(html, pageUrl)`): **báo** `/doi-chuan/x/?from=…`, `?variant=1&amp;from=…`, `?&#102;rom=x`, `?&#x66;rom=x`, `?%66rom=x`, `?from`, `https://www.tqccl.com/…?from=`, `https://tqccl.pages.dev/…?from=`, link chi tiết có `rel="noreferrer"`. **Không báo**: `https://example.com/?from=x`, `#?from=x`, `/doi-chuan/?q=a%3Ffrom%3Db`, `from=` trong JSON-LD / `data-href` / `<script>` / `<style>`.
2. E2E (`team-detail-pages.spec.mjs` hoặc spec mới cùng thư mục):
   - Đội chuẩn có kho: `seedRoster` + `waitForCoverage` (theo `doi-chuan-roster-badges.spec.mjs:49-57`), lọc `kho=rap-duoc&xep=de-rap`, cuộn, click đội: URL chi tiết không query; Quay lại đủ khóa; reload vẫn đúng; về danh sách thì thẻ đích nằm trong khung nhìn.
   - Cmd/Ctrl-click (tab mới) từ Đội chuẩn: Quay lại đúng.
   - Khai hoang: chọn cấu hình đội A, Cmd-click đội B → Quay lại `khTeam=B` (không A); click thường sau chọn cấu hình B → `khTeam=B&khVariant=…`; `?variant=<lạ>` từ danh sách → Quay lại chỉ `khTeam=B`.
   - Đổi ngôn ngữ trên trang chi tiết (vi → zh, vi → ja): Quay lại là danh sách bản đó **còn bộ lọc**.
   - Đăng nhập giả: từ danh sách lọc → chi tiết → `page.goto(detailUrl, {referer: 'https://accounts.google.com/'})` (giả lập quay về sau OAuth) → Quay lại còn bộ lọc.
   - Link cũ `?from=` (giữ ca `team-detail-pages.spec.mjs:147,633,868`): Quay lại đúng nguồn, thanh địa chỉ hết `from`; skip-link → reload vẫn đúng.
   - Khai hoang link cũ `?variant=<lạ>&from=/khai-hoang/?khTeam=X&khVariant=y` (`khaihoang-options.spec.mjs:672-704`, đổi `from` khác mặc định): nút "Xem cấu hình mặc định" mở đúng cấu hình **và** `#team-return-link` vẫn trỏ `khTeam=X&khVariant=y`.
   - `goto` không referrer → mặc định họ đội **và** `history.state.teamDetailReturn === null` (chứng minh JS đã chạy).
   - Sau hydrate và sau đổi bộ lọc: không `a[href*="from="]` trong Đội chuẩn, Đội khác, Khai hoang, Tra cứu, Soi đội, link đổi ngôn ngữ.
   - `doi-chuan-roster-badges.spec.mjs:155-162`: `?kho=…` không có kho vẫn nhận lại đủ danh sách dựng sẵn (169 đội).
3. Hành vi mới được chấp nhận (Non-goal): `spa-parity.spec.mjs:441-461` copy href thẻ B rồi `goto` cùng tab → Quay lại `/khai-hoang/`, chip B khôi phục từ snapshot phiên; viết lại assertion theo đúng hợp đồng này (không xóa ca).

## Refactor
1. `scripts/verify-astro-dist.mjs`: mở rộng đường `ANCHOR` sẵn có (`:104`) thay vì tokenizer mới: bỏ thân `<script>`/`<style>` trước, lấy `href`, giải mã entity (có/không tên, thập phân, hex), `new URL(href, pageUrl)`; nội bộ = origin `site` ∪ host cũ của `host-bridge`; lỗi khi `searchParams.has('from')` hoặc link tới trang chi tiết có `rel` chứa `noreferrer`.
2. Docs: `system-architecture.md:130` (nguồn quay lại: state → `?from=` cũ → referrer → sessionStorage; Khai hoang ghi đè cặp; Referrer-Policy trong `_headers`), `code-standards.md:49,80` (link nội bộ không mang trạng thái điều hướng; không `rel=noreferrer` trên link nội bộ), changelog (lý do SEO, số liệu production, #172).

## Tests After / Regression gate
- `npm run build && npm run verify && npm run test:node && npm run test:dist`
- `npx playwright test tests-e2e/team-detail-pages.spec.mjs tests-e2e/khaihoang-options.spec.mjs tests-e2e/spa-parity.spec.mjs tests-e2e/team-ssr-adopt.spec.mjs tests-e2e/unified-lookup.spec.mjs tests-e2e/doi-chuan-roster-badges.spec.mjs tests-e2e/zh-locale.spec.mjs tests-e2e/ja-locale.spec.mjs` + spec mới.

## Risks
- Trình duyệt cắt referrer (in-app browser, extension): rơi về storage rồi mặc định họ đội. Nếu số liệu sau release cho thấy nhiều, cân nhắc phương án fragment trong issue riêng.
