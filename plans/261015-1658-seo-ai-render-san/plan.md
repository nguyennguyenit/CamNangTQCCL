---
title: "SEO cho AI: render sẵn nội dung đội (#6) và Tra cứu + trang riêng từng mục (#7)"
description: "Chuyển builder DOM sang view-tree (treeToHtml lúc build, treeToDom ở client); SSR trang đội, Tra cứu đủ mục, 1772 trang mục, JSON-LD, llms tách theo mục + llms-full."
priority: P1
status: completed
tags: [seo, ai, astro, ssr, lookup, localization]
created: 2026-10-15
---

# SEO cho AI: render sẵn nội dung

Issue: #6, #7. Chế độ: `ak:cook --tdd` (test hành vi hiện tại trước mỗi phase refactor).

## Outcome đã khóa (advise 2026-10-15)

- Trang chi tiết `doi-chuan` (1366), `doi-khac` (166), `khai-hoang` (17) ×2 locale render sẵn tướng, chiến pháp, binh thư, ghi chú; bỏ "Đang tải chi tiết…" và `<noscript>` "cần JavaScript".
- Trang danh sách `doi-chuan`, `doi-khac`, `cung-ton`, `khai-hoang` ×2 render sẵn mùa/kịch bản mặc định: mỗi đội 3 tướng + link chi tiết.
- JS giữ lọc, đổi mùa, "Xem thêm", dialog; không quyết định nội dung HTML ban đầu.
- `/tra-cuu/<nhóm>/` ×2 render đủ 202/406/114/68/39/41/16 mục; "Xem thêm" chỉ ẩn/hiện.
- 886 × 2 = 1772 trang `/tra-cuu/<nhóm>/<slug>/`: hồ sơ đủ, title/meta/canonical/hreflang, JSON-LD (`Thing`/`DefinedTerm` + `BreadcrumbList` + `isPartOf` `VideoGame`).
- Slug từ ledger đóng băng `pipeline/lookup-route-handles.json` (mẫu `pipeline/team_route_handles.py`), có `--check`, đã cấp thì không đổi.
- Trang nhóm có `CollectionPage` + `ItemList`, mọi `url` trả 200. Trang đội có JSON-LD.
- Link đội → tra cứu dạng path, không còn `?id=` trong trang đội; `?id=` cũ vẫn mở dialog.
- `llms.txt` liệt kê 7 nhóm + link `/llms/<mục>.txt` (doi-chuan, doi-khac, cung-ton, khai-hoang, 7 nhóm `/llms/tra-cuu/<nhóm>.txt`; doi-chuan tách theo mùa nếu > ~300 KB); mỗi dòng có URL trang riêng; `/llms-full.txt` = nối các file con theo thứ tự cố định; một hàm sinh; allowlist lấy từ hàm đó.
- Sitemap 4912 URL. Báo cáo các mục zh thiếu mô tả (`viOnly`).
- `npm run build`, `verify`, `test:dist`, `test:node`, `test:e2e` xanh.

## Không làm

Cloudflare Markdown for Agents; `.md` từng trang; tách llms theo từng đội/mục; llms tiếng Trung; bổ sung dữ liệu zh; trang chi tiết `cung-ton`; render mọi mùa trên trang danh sách; redirect URL cũ; việc tay D1/Cloudflare (đã xong ở Phase 0).

## Ràng buộc

- Không nới/bỏ qua `pipeline/site_localization` (`check --stage public`). File nguồn sửa → làm mới hash/đăng ký literal; republish localization local theo quy trình hiện có.
- Text song ngữ qua `pick()` / `L()`.
- Không viết markup song song trong `.astro`; không thêm shim DOM (linkedom/happy-dom/jsdom).
- Sửa file trong `semanticFiles` của `mcp-worker/workflow-source-manifest.json` → regenerate `mcp-worker/src/generated/workflow-build.ts`.
- Không commit, không deploy (chưa được cho phép).

## Phase

| # | Nội dung | Trạng thái |
|---|---|---|
| 0 | Việc tay: bài test D1, AI Crawl Control | done |
| 1 | [Builder đội sang view-tree](./phase-01-builder-doi-view-tree.md) | done |
| 2 | [SSR trang đội và trang danh sách (#6)](./phase-02-ssr-trang-doi.md) | done |
| 3 | [Tra cứu đủ mục, hồ sơ view-tree, ledger slug, trang mục (#7)](./phase-03-tra-cuu-trang-muc.md) | done |
| 4 | [Link path, JSON-LD, llms, báo cáo zh](./phase-04-link-jsonld-llms.md) | done |
| 5 | [Docs, changelog, kiểm toàn bộ](./phase-05-docs-verify.md) | done |

## Bằng chứng nền

- `js/view-tree.js` `treeToHtml`/`treeToDom`; tiền lệ `src/lib/lookup-pages.ts:143` + `js/unified-lookup.js:350`.
- Builder DOM: `js/render.js` (`el()`), `js/recommended-reference-render.js` (`recommendedTeamCard:397`, `coexistTeamCard:425`, `recommendedTeamTable:476`, `recommendedTeamDetailContent:562`, `legacyOriginalDetailContent:655`), `js/lookup-profile.js` (DOM-only), `js/lookup-tactic-profile.js`.
- Mount: `SectionPage.astro:88-91`, `RecommendedDetail.astro:99-105`, `LegacyDetail.astro:56-62`, `KhaiHoangDetail.astro:55-61`, noscript `SiteLayout.astro:160-163,572`.
- Gate: `scripts/verify-astro-dist.mjs` (allowlist ~200-231, section/detail contract 291-420, sitemap 238-250), `tests-js/astro-dist-contract.test.mjs:930-932,1050` (3140).
