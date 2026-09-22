---
phase: 3
title: "Canonical, robots.txt, sitemap và khoá release"
status: pending
priority: P1
effort: "1d"
dependencies: [2]
---

# Phase 3 — Canonical, robots.txt, sitemap và khoá release

## Goal

Đóng phần định hình URL public: mỗi trang khai canonical đúng, `robots.txt` và sitemap sinh
từ chính inventory route, và dist verifier biết về hai file mới.

## Evidence and scope

- `src/layouts/SiteLayout.astro:40-46` hiện chỉ có `title`, `description`, `og:title`,
  `og:description`, `og:type = "website"` — **thiếu** `link rel="canonical"` và `og:url`;
  trang chi tiết dùng chung layout nên cũng mang `og:type="website"`.
- Trang gốc nhận vô số biến thể query (`season`, `category`, `q`, `faction`, `unit`,
  `score`, `subcategory`, `source` — `docs/code-standards.md:39`) mà không có canonical.
- `scripts/verify-astro-dist.mjs:14-18`: allowlist gồm `_headers` (deployment control) và
  `favicon.png` (static public); `:58-66` dựng `expectedFiles` từ `catalog.htmlPaths` +
  manifest + hai danh sách trên. Thêm file mới vào `dist/` mà không khai báo ⇒
  `unexpectedFiles` khác rỗng ⇒ `npm run verify` đỏ.
- `scripts/verify-astro-dist.mjs:8` đã import `teamDetailCatalog` — dùng lại chính catalog
  đó để sinh sitemap, nên sitemap không thể lệch khỏi trang đã phát hành.
- `astro.config.mjs` có `site: "https://tqccl.pages.dev"`, `output: "static"`.
- `@astrojs/sitemap` **không** có trong `node_modules` — không thêm dependency.

## Files

- Modify: `src/layouts/SiteLayout.astro` — nhận `canonicalUrl?: URL | string`,
  `ogType` (mặc định `website`) và `robots?: string`; chỉ emit canonical + `og:url` khi
  `canonicalUrl` có giá trị. **Lưu ý:** layout này dùng chung cho detail và 404, còn
  `src/pages/index.astro` có `<head>` riêng.
- Modify: `src/pages/doi-chuan/[team].astro`, `src/pages/doi-khac/[team].astro` — truyền
  canonical dựng từ pathname và `ogType="article"`.
- Modify: `src/pages/index.astro` — thêm `link rel="canonical"` + `og:url` trực tiếp vào
  `<head>` của chính nó.
- Modify: `src/pages/404.astro` — truyền `robots="noindex"` và không truyền `canonicalUrl`;
  kết quả không có cả canonical lẫn `og:url`.
- Create: `src/pages/sitemap.xml.ts` — endpoint tĩnh sinh `<urlset>` từ `teamDetailCatalog()`.
- Create: `public/robots.txt` — cho phép crawl toàn site, trỏ `Sitemap`.
- Modify: `scripts/verify-astro-dist.mjs` — thêm `public/robots.txt` vào
  `STATIC_PUBLIC_ARTIFACTS` và `sitemap.xml` vào `expectedFiles`.
- Modify: `pipeline/site-localization-policy.json` — refresh hash `sourceFiles` cho cả bốn
  Astro owner đã sửa: `src/layouts/SiteLayout.astro`, `src/pages/index.astro`,
  `src/pages/doi-chuan/[team].astro`, `src/pages/doi-khac/[team].astro`. So sánh toàn bộ
  fingerprint obligation trước/sau; chỉ giữ receipt cũ khi tất cả bằng nhau.
- Create: successor generation Recommended immutable từ strict publisher; modify
  `src/data/recommended-reference/current.json` và `data/website-display.json`. Payload phải
  byte-identical với Phase 2; generation cũ giữ nguyên.
- Modify: `pipeline/team-route-handles.json` + `pipeline/team_route_handles.py` — chỉ rebind
  generationId/baseline key sang successor sau publish; không sinh lại handle.
- Intentionally unchanged: `pipeline/site-translations.json`,
  `pipeline/site-translation-reviews.json`, `pipeline/localization-reviews/*` khi fingerprint,
  text và glossary đều không đổi.
- Modify: `tests-js/astro-dist-contract.test.mjs` — khẳng định canonical/OG/404/sitemap/
  robots; cập nhật **mọi** synthetic project/dist fixture cho `robots.txt`, `sitemap.xml`
  và ledger route phase 2, hoặc truyền override artifact tường minh khi fixture không kiểm
  hai artifact đó.
- Modify: `docs/deployment-guide.md` — thêm `robots.txt`/`sitemap.xml` vào checklist preview.
- Intentionally unchanged: `public/_headers` (phase 2 đã sửa wildcard; phase này không thêm
  rule cache), `astro.config.mjs`, danh sách query của root.

## Shared contract

### Canonical và og

- Detail canonical = `new URL(Astro.url.pathname, Astro.site)` và được truyền vào
  `SiteLayout`; trang gốc dùng `https://tqccl.pages.dev/` trực tiếp trong head của
  `index.astro`. Cả hai bỏ query/hash.
- `SiteLayout` chỉ emit `link rel="canonical"` và `og:url` khi nhận `canonicalUrl`; hai tag
  luôn dùng cùng giá trị.
- `ogType`: `article` cho `/doi-chuan/*` và `/doi-khac/*`; `website` cho trang gốc.
- `404.html`: `robots=noindex`, **không** canonical và **không** `og:url`.
- Endpoint `sitemap.xml.ts` lấy `site` từ `APIContext` (không dùng `Astro.site`) và fail nếu
  config không có origin.

### Sitemap

`src/pages/sitemap.xml.ts`, `prerender = true`, trả `Content-Type:
application/xml; charset=utf-8` và sinh:

- `/` (trang gốc) — **không** kèm biến thể query.
- Mọi `routePath` hậu phase 2 của `teamDetailCatalog()`, sắp xếp ổn định.

Mỗi `<loc>` dùng `new URL(routePath, site)` rồi XML-escape. Tập URL phải không trùng, không
có path bắt đầu `/teams/`, và bằng đúng `{root} ∪ catalog.routePath`. Release hiện tại còn
khóa baseline **1533** URL = 1 + 1366 + 166; test vừa so với catalog động vừa so baseline.
Không có `<lastmod>`, `<changefreq>`, `<priority>`.

### robots.txt

```
User-agent: *
Allow: /

Sitemap: https://tqccl.pages.dev/sitemap.xml
```
Origin trong dòng `Sitemap` phải khớp `astro.config.mjs.site`; test khóa hai giá trị để việc
đổi domain không làm `robots.txt` trôi khỏi canonical/sitemap.

Không thêm `Disallow`: site tĩnh không phát hành đường riêng tư nào; chặn `/js/`, `/css/`
hay `/data/` chỉ làm hỏng khả năng render của crawler.

## Steps

- [x] Sửa `SiteLayout.astro` thêm prop optional `canonicalUrl`, `ogType`, `robots`; chỉ emit
      canonical/`og:url` khi có canonical. Hai trang chi tiết truyền canonical + `article`.
- [x] Thêm canonical + `og:url` vào `<head>` của `src/pages/index.astro`.
- [x] `404.astro` truyền `robots="noindex"` nhưng không truyền canonical; verifier khẳng định
      canonical và `og:url` đều vắng mặt.
- [x] Viết `src/pages/sitemap.xml.ts` từ post-phase-2 `teamDetailCatalog()`: fail nếu còn
      `/teams/`, XML-escape, kiểm duplicate, trả MIME XML.
- [x] Thêm `public/robots.txt`.
- [x] Cập nhật `scripts/verify-astro-dist.mjs` cho hai file mới.
- [x] Sau khi hoàn tất mọi source edit, refresh `sourceFiles` hash của bốn Astro owner trong
      `pipeline/site-localization-policy.json`. So sánh toàn bộ obligation fingerprint trước/
      sau; chỉ giữ receipt hiện tại khi tất cả bằng nhau.
- [x] Build + check đúng một candidate strict stage `all`; review độc lập chứng minh payload
      Recommended và Lookup byte-identical, website-display values/sourceHashes không đổi, và
      route handle không đổi. Publish candidate một lần, rồi rebind chỉ generationId trong
      route ledger và baseline key. Sau đó
      `python3 -m pipeline.site_localization check --root . --stage public` và
      `python3 -m pipeline.team_route_handles --check` phải xanh.
- [x] Cập nhật `tests-js/astro-dist-contract.test.mjs`, gồm mọi synthetic fixture và các
      assertion head/XML/robots ở contract trên.
- [x] Cập nhật checklist trong `docs/deployment-guide.md`.
- [x] `npm run build` → `npm run verify` → `npm run test:node` → `npm run test:e2e`.

## Success criteria

- `npm run verify` xanh; `dist/sitemap.xml` và `dist/robots.txt` tồn tại.
- Public localization + route-ledger check xanh sau strict successor/rebind; toàn bộ
  fingerprint obligation không đổi, nên receipt/translation ledger giữ nguyên.
- Sitemap có tập `<loc>` bằng chính root + catalog, không duplicate, đúng baseline release
  **1533**, và **0** URL `/teams/`.
- `dist/index.html` có canonical/`og:url` cùng trỏ `https://tqccl.pages.dev/`.
- Một trang mỗi family detail có canonical đúng pathname và `og:type=article`.
- `dist/404.html` có `robots=noindex`, không canonical, không `og:url`.
- `dist/robots.txt` byte-equal source và trỏ đúng canonical sitemap; sitemap trả MIME XML.
- `npm run test:node` và `npm run test:e2e` xanh.

## Failure protocol

`verify-astro-dist` báo `unexpectedFiles` hoặc `missingFiles` ⇒ **STOP**, không nới lỏng
allowlist để build xanh. Sửa bằng cách khai báo đúng artifact mới, hoặc bỏ file thừa.
Sitemap lệch số URL so với catalog ⇒ cũng STOP, vì nghĩa là sitemap và trang đã phát hành
đang lệch nhau.

Gate localization đỏ vì `sourceFiles` stale ⇒ **STOP** và refresh hash cho đúng file đã sửa
(Step 7), không xoá khoá khỏi `sourceFiles` để né — `REQUIRED_OWNER_FILES` và các khoá khác
phải còn nguyên.
Strict candidate có payload khác Phase 2, fingerprint obligation đổi, hoặc handle/route đổi
⇒ **STOP**, không publish và không rebind. Publication xanh nhưng selector/sidecar/ledger
chưa cùng generation ⇒ cũng STOP; không build/deploy trạng thái trộn.

## Trạng thái hoàn tất

Đóng ngày 2026-09-22. Cả mười một step đã xong, không có mục nào chưa gán vào checklist.

- `SiteLayout.astro` phát `link rel="canonical"` và `og:url` từ prop `canonicalUrl` optional,
  hai họ trang chi tiết truyền pathname của chính trang kèm `ogType="article"`, `index.astro`
  khai canonical/`og:url` trực tiếp trong `<head>` của nó, `404.astro` chỉ có `robots=noindex`
  và không có canonical lẫn `og:url`.
- `src/pages/sitemap.xml.ts` sinh `<urlset>` từ chính `teamDetailCatalog()`, fail khi gặp
  path `/teams/` hoặc URL trùng, và trả MIME `application/xml; charset=utf-8`;
  `public/robots.txt` trỏ đúng origin production. `scripts/verify-astro-dist.mjs` đã khai hai
  artifact mới và policy đã refresh hash bốn Astro owner.
- Successor generation `7f02c639…` đã publish byte-identical; `src/data/recommended-reference/current.json`
  và `pipeline/team-route-handles.json` cùng trỏ successor, baseline generator đã rebind và
  không handle nào đổi.
- Gate chốt: `npm run verify` xanh với 1682 file và sitemap 1533 `<loc>`; `npm run build` sinh
  1534 trang; `npm run test:node` 302/302; `npm run test:e2e` 138/138.
