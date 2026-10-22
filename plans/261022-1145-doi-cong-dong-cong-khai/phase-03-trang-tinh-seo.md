---
phase: 3
title: "Trang tĩnh /doi-cong-dong/<id>/ (vi + zh), SEO, sitemap, verifier, redirect ?id="
status: pending
priority: P1
effort: "1.5d"
dependencies: [1, 2]
---

# Phase 3 — Trang tĩnh `/doi-cong-dong/<id>/` (vi + zh), SEO, sitemap, verifier, redirect `?id=`

## Mục tiêu
Lúc build, Astro đọc export của Phase 2 một lần và sinh hai trang tĩnh cho mỗi đội hiển thị (bản `text_lang` self-canonical + index, bản kia canonical về bản gốc), có title/description riêng, FAQ, JSON-LD, og meta, tên tác giả + ngày; sitemap một URL/đội; danh sách `/doi-cong-dong/` noindex khi < 10 đội; verifier khoá toàn bộ hợp đồng từ dist; JS gắn vote/bình luận/chiến báo live vào trang tĩnh và chuyển `?id=` sang URL tĩnh khi trang đã có.

## Bằng chứng
- Mẫu loader fail-closed: `src/lib/blog-posts.ts:1-6` (không env → rỗng; env có mà API/payload lỗi → dừng build), `communityApiOrigin` `:301-312`, fetch + timeout 30 s `:319-354`, memo một lần/build `:356-363`, `jsonLd()` chặn `</script>`, `<`, `>`, `&`, U+2028/2029 `:387-395`.
- Route mẫu: `src/pages/bai-viet/[slug].astro:8-10` (`getStaticPaths` từ loader), `src/pages/zh/bai-viet/[slug].astro:8-10`. Trang mẫu có JSON-LD + og: `src/components/blog/BlogArticle.astro:45-69` (`canonicalUrl`, `ogType="article"`, `alternates`, `counterpartPath`, `<Fragment slot="head">`, `jsonLd(data)` `:68`).
- `SiteLayout` props: `canonicalUrl` `src/layouts/SiteLayout.astro:42`, `robots` `:44`, `alternates` `:47-51` (mặc định bật `:77`, hreflang `:78-81`), `counterpartPath` `:53,76`, `ogImage` `:54-55` (vắng → `/og-image.png` `:220`); head phát canonical/robots/og/hreflang `:380-392`.
- JSON-LD đội hiện có: `teamDetailJsonLd` `src/lib/structured-data.ts:40-58` (`WebPage` + `about` tướng có trang Tra cứu + `BreadcrumbList`); helper `absolute`/`htmlLang`/`videoGame`/`homeCrumb` `:10-19`; `breadcrumbJsonLd` `src/lib/blog-seo.ts:78`; `SITE_NAME` `:9`; `formatPostDate` `:58`. Tướng có trang riêng: `lookupDetailRoutes().byId.get(id)` (`src/lib/team-detail-pages.ts:119-135`, `src/lib/lookup-detail-routes.ts:146`).
- Tên tướng/CP theo locale: `createTeamLexicon(dicts, locale)` `js/community-team-data.js:54-86` (`heroName`, `tacticName`, id lạ hiện thô, `formerIds` qua `createTacticIdResolver`); `troopLabel` dùng `L()` `:94-103` → bọc `withLocale` (`js/i18n.js:26`); `seasonLabel(season, locale)` `:106-109`. Đọc từ điển lúc build: `readPublicArtifact({kind:'data', routeParam})` `src/lib/root-static-artifacts.ts:273` (mẫu `team-detail-pages.ts:102-103`). Import `js/*.js` ở build là tiền lệ (`team-detail-pages.ts:9-13`, `team-ssr.ts:9-17`).
- Sitemap: `SitemapRoute` `src/pages/sitemap.xml.ts:36-40`, `mirroredSitemapRoutes` luôn phát cặp `:54-60`, `blogSitemapRoutes` `:71-88`, sắp xếp + chống trùng `:116-133`, `sitemapDocument` `:136-157`, `GET` `:159-173`.
- Verifier: `COMMUNITY_PAGES` `scripts/verify-astro-dist.mjs:79-84`; `verifyLocalePair` `:90-98`; `BLOG_POST_FILE` `:109`; `jsonLdBlocks` `:111-120` (thông điệp lỗi ghi "Blog page"); `verifyBlogOutputs` `:126-175` (đòi self-canonical `:146` → không chép cho bản gương); allowlist `:263-302` (bài blog tự nhận từ dist `:267,279`); sitemap byte-match `:304-321`; kiểm noindex + cấm canonical cho mọi trang cộng đồng `:609-620`. Thực nghiệm: thêm `src/pages/doi-cong-dong/[id].astro` → `dist allowlist mismatch; unexpected: doi-cong-dong/probe-team/index.html` (local://verification-facts.md).
- Trang danh sách: `src/components/pages/CommunityTeamsPage.astro:15-25` (`robots="noindex"`, `pageKind="detail"`, không canonical); `src/components/community/CommunityTeamsHub.astro:13-20` (mount `#community-teams`).
- `public/robots.txt:5` `Disallow: /api/` → Googlebot không gọi được `/api/community-teams` khi render JS ⇒ danh sách index được phải có link dựng sẵn trong HTML.
- JS: `initCommunityTeams` `js/community-teams.js:54-60`; `hrefFor`/`go`/`link` `:111-128`; `teamCard` link `:155`; `detailView` `:312-495` (fetch `:313`, nội dung `:319-356`, vote `:358-405`, xoá `:407-422`, khung "Đội tương tự" `:424-428`, notice pending/rejected `:444-449`, dựng danh sách tương tự `:469-481`, widgets pageKey `/doi-cong-dong/<id>/` + `sharedPool:true` + `archived:!seasonOpen` `:483-494`); bộ điều phối `:595-620`; nạp từ điển nền `:623`. `modeFromSearch` + `TEAM_ID_RE` `js/community-team-state.js:7,82-89`. `communityPageHref` giữ `?id=` `js/community-api.js:150-155`; `langTag` `:335-338`.
- Manifest JS: `src/lib/public-artifact-manifest.mjs:31-34` đã có `community-team-data|form|state`, `community-teams`; phase này không thêm module JS → không sửa manifest.
- Header: `public/_headers:8` (`/zh/*`) và `:38` (`/doi-cong-dong/*`) đã phủ trang con → không sửa; test `tests-js/pages-headers-contract.test.mjs:100-150`.
- Test hiện có: `tests-js/astro-dist-contract.test.mjs:103` (`writeBlogOutputs`), `:325-328` (fixture lặp `COMMUNITY_PAGES`, HTML noindex), `:1168-1207` (mẫu test verifier blog); `tests-js/seo-dist-contract.test.mjs:105` (JSON-LD trang đội đọc dist thật); `tests-e2e/community-teams.spec.mjs:11-20` (fixture đội, id tướng thật `hero:tao-thao`…), `:103` (chi tiết `?id=`), `:330-344` (`Mở trang đội` → `?id=t1`). E2E build **không** có `COMMUNITY_API_ORIGIN` (`playwright.config.mjs:20-25`) → 0 trang đội trong dist e2e.

## File
- Tạo: `src/lib/community-teams.ts` — kiểu `CommunityTeam`, `COMMUNITY_TEAMS_INDEX_MIN = 10`, `communityTeamPath(id, locale)`, `canonicalTeamPath(team)`, `communityTeamsIndexable(count)`, `validateTeamsExport(payload)`, `fetchCommunityTeams({env, fetchImpl})`, `loadCommunityTeams()` (memo)
- Tạo: `src/lib/community-team-pages.ts` — hàm thuần `teamPageCopy(team, names, locale)` (title, description, FAQ) + IO `communityTeamPageModel(team, locale, site)` (lexicon, link tướng, canonical, JSON-LD)
- Tạo: `src/components/pages/CommunityTeamPage.astro`
- Tạo: `src/pages/doi-cong-dong/[id].astro`, `src/pages/zh/doi-cong-dong/[id].astro`
- Sửa: `src/lib/structured-data.ts` (thêm `communityTeamJsonLd`)
- Sửa: `src/components/pages/CommunityTeamsPage.astro` (robots/canonical theo ngưỡng), `src/components/community/CommunityTeamsHub.astro` (danh sách link dựng sẵn trong mount)
- Sửa: `src/pages/sitemap.xml.ts` (`communityTeamSitemapRoutes` + dùng trong `GET`)
- Sửa: `scripts/verify-astro-dist.mjs`
- Sửa: `js/community-teams.js`, `js/community-team-state.js`
- Sửa: `css/styles.css` (chỉ lớp mới `cm-team-faq*`, `cm-team-static*`; dùng token sẵn có)
- Tạo test: `tests-js/community-teams.test.mjs`, `tests-js/community-team-pages.test.mjs`, `tests-js/fixtures/community-teams-export.json`
- Sửa test: `tests-js/astro-dist-contract.test.mjs`, `tests-js/seo-dist-contract.test.mjs`, `tests-js/pages-headers-contract.test.mjs`, `tests-js/community-team-state.test.mjs`, `tests-e2e/community-teams.spec.mjs`

Không sửa: `src/layouts/SiteLayout.astro`, `src/components/landing/Landing.astro` hay file nào trong `sourceFiles` (sẽ đòi publish lại); `public/_headers`; `public/robots.txt`; `src/lib/public-artifact-manifest.mjs`; `js/community-api.js` (`communityPageHref` vẫn `?id=`, redirect lo phần còn lại).

## Thiết kế

### Loader `src/lib/community-teams.ts`
- `communityApiOrigin()` import từ `blog-posts.ts:301` (không nhân bản). Không có → `[]`, không gọi mạng.
- `GET {origin}/api/community-teams/export`, `accept: application/json`, `AbortSignal.timeout(30_000)`. Lỗi mạng/HTTP ≠ 2xx/không phải JSON/`schemaVersion !== 1`/vi phạm schema (Phase 2, bảng trường) → `throw` (dừng build).
- Kiểm từng item: `id` khớp `^[a-z0-9][a-z0-9-]{0,63}$` và duy nhất; `title` 1–80; `season.{id,labelVi,labelZh}` string; `heroes` 3 string `hero:`; `tactics` 3×2 string `tactic:`; `troop` ∈ 5 giá trị; `textLang` ∈ `vi|zh`; `analysis.playstyle` string không rỗng, 5 khoá còn lại string|null; `author.name` string; `imageCount` int 0–3; `createdAt`, `approvedAt` `Date.parse` hữu hạn. Khoá thừa (vote, `author.id`…) bị bỏ, **không** đưa vào `CommunityTeam` → không thể render nhầm số vote.
- Sắp `createdAt desc, id desc` (ổn định dù API đổi thứ tự). Memo theo origin như `blog-posts.ts:356-363`: danh sách, hai locale, sitemap dùng chung một lần gọi.

### Đường dẫn, canonical, robots

| Trang | canonical | robots | hreflang (`alternates`) | JSON-LD | sitemap |
|---|---|---|---|---|---|
| Bản ngôn ngữ gốc `communityTeamPath(id, textLang)` | chính nó | không meta (index) | `false` | `WebPage` + `BreadcrumbList` + `FAQPage` | có, `lastmod = approvedAt`, không `xhtml:link` |
| Bản còn lại | URL bản gốc | không meta | `false` | không có khối nào | không |
| `/doi-cong-dong/`, `/zh/doi-cong-dong/` khi < 10 id | không | `noindex` | mặc định (cặp) | không | không |
| như trên khi ≥ 10 id | chính nó | không meta | mặc định (cặp) | không | cặp vi/zh qua `mirroredSitemapRoutes` |

`counterpartPath` để mặc định (bản gương cùng đường dẫn luôn tồn tại). og: `ogType="article"`, không truyền `ogImage` (giữ `/og-image.png`), thêm `<meta property="article:published_time" content={approvedAt}>` trong slot head. Không `<img>` avatar.

### Trang `CommunityTeamPage.astro` (props `{team, locale}`)
1. Link quay lại `localePath('/doi-cong-dong/', locale)`.
2. `<article class="cm-page cm-team-static" data-team-static>`: `h1` tiêu đề (`lang` = `htmlLang(textLang)`); dòng meta: mùa (`seasonLabel`), binh chủng (`withLocale(locale, () => troopLabel(troop))`), nhãn `[VI]/[ZH]`, tên tác giả, `<time datetime={createdAt}>` (`formatPostDate`); ảnh `0..imageCount-1` trỏ `/api/community-teams/<id>/images/<pos>` (`loading="lazy"`, alt theo locale; kiểm quyền live ở Worker, không copy vào dist); bảng tướng × 2 CP theo tên locale (tướng có trang Tra cứu thì là link); khối FAQ.
3. Sau `article`: `<div id="community-teams" class="cm-team-root" data-team-id={id}>` + `<noscript>` → JS gắn phần live.
4. `<script is:inline type="module" src="/js/community-teams.js" slot="scripts">` như `CommunityTeamsPage.astro:24`.
- Mọi chữ người dùng chỉ đi qua biểu thức `{…}` của Astro (tự escape), **không** `set:html`; JSON-LD qua `jsonLd()`.

### Nội dung thuần `teamPageCopy(team, names, locale)` (`community-team-pages.ts`)
- `title`: vi `${title} (${h1}, ${h2}, ${h3}) — Đội cộng đồng — ${SITE_NAME.vi}`; zh `${title}（${h1}、${h2}、${h3}）— 社区阵容 — ${SITE_NAME.zh}`.
- `description`: `${troop} · ${h1}, ${h2}, ${h3} — ${playstyle}` gộp khoảng trắng, cắt ≤ 155 code point (`Array.from`) + `…` khi cắt.
- `faq`: câu hỏi theo locale, chỉ trường khác rỗng, theo thứ tự: đội hình (trả lời sinh từ tên tướng + CP + binh chủng), `playstyle`, `strengths`, `weaknesses`, `counters`, `counteredBy`, `substitutes`. vi ví dụ "Đội {title} chơi thế nào?", "Đội nào khắc chế {title}?"; zh "{title}怎么玩？", "哪些阵容克制{title}？". Câu trả lời là văn bản gốc (giữ xuống dòng bằng lớp `cm-team-text`).
- `names`: `{heroes: string[3], tactics: string[3][2]}` do IO dựng bằng `createTeamLexicon({heroes, tactics}, locale)`.

### `communityTeamJsonLd` (`structured-data.ts`, chỉ cho bản gốc)
`[WebPage{name, description, url: canonical, inLanguage: htmlLang(textLang), datePublished: approvedAt, dateCreated: createdAt, author: {'@type':'Person', name}, isPartOf: videoGame(locale), about?: tướng có trang Tra cứu}, BreadcrumbList(Trang chủ → Đội cộng đồng → title), FAQPage(mainEntity Question/Answer từ faq)]`. Không có `aggregateRating`, `interactionStatistic`, `image` của người dùng.

### Danh sách `/doi-cong-dong/`
- `CommunityTeamsPage.astro` gọi `loadCommunityTeams()`; `indexable = communityTeamsIndexable(teams.length)`; `robots = indexable ? undefined : 'noindex'`; `canonicalUrl = indexable ? new URL(localePath('/doi-cong-dong/', locale), Astro.site) : undefined`.
- `CommunityTeamsHub.astro` nhận `teams`, dựng trong mount `<ul class="cm-team-static-list">` mỗi đội một `<a href={communityTeamPath(id, locale)}>{title}</a>` (luôn dựng, kể cả < 10); JS thay nội dung mount khi chạy (`mount.replaceChildren` `js/community-teams.js:602`).

### Sitemap
`export function communityTeamSitemapRoutes(teams: readonly {path: string; lastmod: string}[]): SitemapRoute[]` → mỗi đội `{path, lastmod}`; nếu `teams.length >= COMMUNITY_TEAMS_INDEX_MIN` thêm `mirroredSitemapRoutes(['/doi-cong-dong/'])`. `GET` thêm `...communityTeamSitemapRoutes(teams.map((t) => ({path: canonicalTeamPath(t), lastmod: t.approvedAt})))`. Verifier gọi cùng hàm với dữ liệu đọc lại từ dist → khớp byte.

### Verifier `scripts/verify-astro-dist.mjs`
- `COMMUNITY_TEAM_FILE = /^(zh\/)?doi-cong-dong\/([a-z0-9][a-z0-9-]{0,63})\/index\.html$/u` (không khớp `doi-cong-dong/index.html`); `communityTeamFiles` thêm vào allowlist cạnh `blogPostFiles` (`:267,279`).
- `COMMUNITY_PAGES`: mục `doi-cong-dong` thêm `listing: true`; vòng `:609-620` vẫn kiểm mount/entry/không `app.js` cho mọi mục, nhưng bỏ kiểm noindex/cấm canonical cho mục `listing` (chuyển sang hàm dưới).
- `jsonLdBlocks` đổi thông điệp thành `Page carries invalid JSON-LD` (dùng chung).
- `verifyCommunityTeamOutputs(distPath, files, site)`:
  1. Nhóm theo id; thiếu một trong hai locale → `Community team page lacks its locale pair: <id>`.
  2. Canonical: đúng một bản self-canonical, bản kia canonical bằng URL đó; sai → lỗi.
  3. Cả hai: không `<link rel="alternate" hreflang`, không meta robots `noindex`, có `id="community-teams"` + `data-team-id="<id>"` + `src="/js/community-teams.js"`, không `src="/js/app.js"`.
  4. Bản gốc: có `WebPage` với `url` = canonical, `inLanguage` = `HREFLANG[locale bản gốc]`, `name`, `author.name` khác rỗng, `datePublished` parse được; có `FAQPage`. Bản gương: 0 khối JSON-LD. Duyệt đệ quy mọi khối: không khoá `aggregateRating`.
  5. Đếm **id duy nhất** = số cặp. Danh sách hai locale: < 10 → bắt buộc `noindex` và không canonical; ≥ 10 → không `noindex`, canonical = URL danh sách của locale, `verifyLocalePair(html, path, locale, '/doi-cong-dong/', site)`. Cả hai trường hợp: danh sách chứa `href` tới `communityTeamPath(id, locale)` của mọi id.
  6. Trả `{path: canonicalPath, lastmod: datePublished}[]` → sitemap kỳ vọng `:314-318` thêm `communityTeamSitemapRoutes(...)`.

### JS (`js/community-team-state.js`, `js/community-teams.js`)
- State (thuần): `staticTeamPath(id, locale)` → `localePath('/doi-cong-dong/<id>/', locale)`; `modeFromSearch(search, staticId = null)` → `{mode:'static', id}` khi `staticId` khớp `TEAM_ID_RE`, còn lại như cũ.
- Entry: `staticId = mount.dataset.teamId ?? null`. Chế độ `static`: không nạp từ điển nền (`:623`), không gắn `popstate`, `go(params)` = `location.assign(hrefFor(params))`.
- Tách `detailView` thành `detailContent(team)` (ảnh/bảng/phân tích/meta, chỉ SPA) và `detailLive(view, team, isCurrent)` (vote, xoá, tương tự, widgets). SPA = fetch → (redirect) → nav + content + live; static = fetch `GET /api/community-teams/<id>` → live. Static mà API trả 404 (đội đã ẩn sau build) → đặt `hidden` cho `[data-team-static]`, hiện `describeError` trong mount.
- Redirect `?id=`: sau khi fetch chi tiết, nếu `team.status === 'approved'` và `fetch(staticTeamPath(id, locale), {method:'HEAD', cache:'no-store'})` trả `ok` → `location.replace(staticTeamPath(id, locale))` và dừng render; HEAD lỗi/404 → giữ `detailView`. Pending/rejected → không HEAD.
- Link nội bộ tới đội approved (`teamCard` `:155`, "Đội tương tự" `:475`; mục "Của tôi" có `status === 'approved'`): `href = staticTeamPath(id, locale)`; click trái thường → SPA `go({id})` (đi qua HEAD ở trên) / static `location.assign(hrefFor({id}))`, để cửa sổ "đã duyệt nhưng build chưa xong" không rơi vào 404. Đội không approved giữ `hrefFor({id})`.
- Giữ nguyên `pageKey = /doi-cong-dong/<id>/` + `sharedPool: true` + `archived: !team.seasonOpen` cho cả hai locale (`:486-489`); vote/bình luận/chiến báo/trạng thái mùa chỉ tải live.

## Test-first matrix

| # | Lớp | Test | Đỏ trước? | Lệnh |
|---|---|---|---|---|
| L1 | Loader | không env → `[]`, fetch không được gọi | Đỏ (module chưa có) | `node --experimental-strip-types --test tests-js/community-teams.test.mjs` |
| L2 | Loader | env có: HTTP 503, non-JSON, `schemaVersion: 2`, id sai, id trùng, `heroes` 2 phần tử, `troop: "x"`, `textLang: "en"`, `approvedAt` sai, thiếu `analysis.playstyle` → reject có thông điệp | Đỏ | như trên |
| L3 | Loader | fixture 10 đội (`tests-js/fixtures/community-teams-export.json`) → 10 item sắp `createdAt desc, id desc`; item không có khoá vote/`author.id`; `canonicalTeamPath` theo `textLang` | Đỏ | như trên |
| L4 | Loader | `communityTeamsIndexable(9) === false`, `(10) === true`; `loadCommunityTeams()` gọi 2 lần → 1 fetch | Đỏ | như trên |
| P1 | Nội dung | `teamPageCopy`: title vi/zh đúng mẫu; description ≤ 155 code point, cắt không vỡ ký tự nhiều byte; FAQ chỉ trường khác rỗng, đúng thứ tự, câu hỏi theo locale | Đỏ | `node --experimental-strip-types --test tests-js/community-team-pages.test.mjs` |
| P2 | JSON-LD | `communityTeamJsonLd`: `url` = canonical, `inLanguage`, `author.name`, `datePublished`; không có khoá `aggregateRating` ở mọi cấp; `jsonLd()` của tiêu đề chứa `</script><img src=x>` không còn `</script` | Đỏ | như trên |
| P3 | Sitemap | `communityTeamSitemapRoutes`: 9 đội → 9 route, không có `/doi-cong-dong/`; 10 đội → thêm cặp danh sách có `alternates`; route đội không có `alternates` | Đỏ | như trên |
| V1 | Verifier | fixture 0 đội: các test hiện có xanh nguyên | — | `node --experimental-strip-types --test tests-js/astro-dist-contract.test.mjs` |
| V2 | Verifier | 1 đội vi: cặp hợp lệ + sitemap đúng → pass; thiếu bản zh → `lacks its locale pair`; bản zh self-canonical → reject; có hreflang → reject; trang đội `noindex` → reject; bản gương có JSON-LD → reject; JSON-LD có `aggregateRating` → reject; sitemap có URL bản zh → reject (byte); file `doi-cong-dong/BAD_ID/index.html` → allowlist mismatch | Đỏ | như trên |
| V3 | Verifier | 10 đội: danh sách còn `noindex` → reject; danh sách index + canonical + hreflang + sitemap có cặp → pass; 9 đội mà danh sách index → reject; danh sách thiếu link tới một đội → reject | Đỏ | như trên |
| H1 | Header | thêm `/doi-cong-dong/3f2c-team/`, `/doi-cong-dong/3f2c-team/index.html`, `/zh/doi-cong-dong/3f2c-team/` | Không đỏ (luật `_headers:8,38` đã phủ; khoá hợp đồng) | `node --test tests-js/pages-headers-contract.test.mjs` |
| D1 | Dist thật | `seo-dist-contract`: dist 0 đội → `doi-cong-dong/index.html` và `zh/…` có `noindex`; `sitemap.xml` không có URL chứa `/doi-cong-dong/` | Xanh với dist hiện tại (khoá hồi quy) | `npm run test:dist` |
| J1 | State | `modeFromSearch('', 't1')` → static; `modeFromSearch('?id=t1', 'BAD')` → detail; `staticTeamPath('t1','zh')` → `/zh/doi-cong-dong/t1/` | Đỏ | `node --test tests-js/community-team-state.test.mjs` |
| E1 | E2E | `/doi-cong-dong/?id=t1` approved, `page.route` `**/doi-cong-dong/t1/` trả 200 cho HEAD và HTML tối thiểu cho GET → URL thành `/doi-cong-dong/t1/` | Đỏ | `npx playwright test tests-e2e/community-teams.spec.mjs` |
| E2 | E2E | `/zh/doi-cong-dong/?id=t1` → `/zh/doi-cong-dong/t1/` | Đỏ | như trên |
| E3 | E2E | approved nhưng không có trang tĩnh (preview trả 404) → ở lại `?id=t1`, chi tiết hiện; các test chi tiết hiện có (`:103`…) xanh nguyên | Đỏ phần assert HEAD đã gọi | như trên |
| E4 | E2E | chủ xem đội pending → không có request HEAD, ở lại | Đỏ | như trên |
| E5 | E2E | Static mode: route GET `/doi-cong-dong/t1/` trả HTML `<html lang="vi">` có `[data-team-static]`, `#community-teams[data-team-id="t1"]`, script `/js/community-teams.js` → có nút vote; gửi bình luận body `page: "/doi-cong-dong/t1/"`; không request `heroes-dict.json`; link tương tự `href="/doi-cong-dong/t2/"` | Đỏ | như trên |
| E6 | E2E | Static zh (`lang="zh-Hans"`): API bình luận gọi với page `/doi-cong-dong/t1/` (không `/zh/`) | Đỏ | như trên |
| E7 | E2E | Static mode, API chi tiết 404 → `[data-team-static]` ẩn, có thông báo | Đỏ | như trên |
| E8 | E2E | Danh sách: tiêu đề thẻ có `href="/doi-cong-dong/t1/"`; click → URL `?id=t1` và chi tiết hiện (HEAD 404 trong e2e) | Đỏ | như trên |

## Các bước
1. Viết fixture `tests-js/fixtures/community-teams-export.json` (10 đội: 7 `vi`, 3 `zh`; id tướng/CP thật lấy từ `tests-e2e/community-teams.spec.mjs:8-9`; một tiêu đề `Đội </script><img src=x onerror=alert(1)>`; một tên tác giả `<b>Gia Cát</b>`; một đội mọi trường phân tích tuỳ chọn = null; một đội `imageCount: 0`).
2. Viết L1–L4, P1–P3, V2–V3, H1, D1, J1, E1–E8; chạy → đỏ đúng các ca ghi "Đỏ".
3. `src/lib/community-teams.ts` → L1–L4 xanh.
4. `src/lib/community-team-pages.ts`, `communityTeamJsonLd` trong `structured-data.ts`, `communityTeamSitemapRoutes` trong `sitemap.xml.ts` → P1–P3 xanh.
5. `CommunityTeamPage.astro`, hai route `[id].astro` (`getStaticPaths` = mọi đội của `loadCommunityTeams()`, `props: {team}`), `CommunityTeamsPage.astro` + `CommunityTeamsHub.astro`, `GET` sitemap.
6. Verifier → V1–V3 xanh.
7. `js/community-team-state.js`, `js/community-teams.js`, `css/styles.css` → J1, E1–E8 xanh.
8. `python3 -m pipeline.site_localization check --root . --stage public` → exit 0 (chứng minh không đụng file ghim).
9. Build tích hợp với API giả (mục Verification), rồi build lại sạch trước các cổng.

## Verification
```bash
python3 -m pipeline.site_localization check --root . --stage public    # exit 0
npm run test:node
npm run build && npm run verify && npm run test:dist                  # dist 0 đội (không env)
npx playwright test tests-e2e/community-teams.spec.mjs tests-e2e/landing.spec.mjs
```
Build tích hợp (dữ liệu giả, không đụng production):
```bash
mkdir -p .cache/fake-community-api/api/community-teams
printf '{"items":[]}' > .cache/fake-community-api/api/posts
cp tests-js/fixtures/community-teams-export.json .cache/fake-community-api/api/community-teams/export
# service nền: python3 -m http.server 8799 --bind 127.0.0.1 --directory .cache/fake-community-api
COMMUNITY_API_ORIGIN=http://127.0.0.1:8799 npm run build && npm run verify
```
Kỳ vọng: 20 file khớp `doi-cong-dong/<id>/index.html` (10 vi + 10 zh); `dist/doi-cong-dong/index.html` không có `noindex`, có canonical; `sitemap.xml` có đúng 10 URL đội + cặp `/doi-cong-dong/`; trang có tiêu đề XSS không chứa chuỗi `<img src=x` và JSON-LD chứa `\u003c/script`; không trang đội nào có `hreflang`. Sau đó dừng service, `npm run build` lại **không** env để dist trở về 0 đội trước `npm run test:dist`/`test:e2e`.

## Rủi ro
- `lookupDetailRoutes().byId` có thể khoá theo id khác `hero:<slug>` → tướng không có link/`about` (hiện tên trơn, vẫn đúng hợp đồng seo-dist). Kiểm bằng fixture `hero:tao-thao`.
- Trang tĩnh cũ (đội đã ẩn, build chưa chạy): crawler không JS vẫn thấy tới build kế; người dùng có JS thấy nội dung bị ẩn (E7).
- Mỗi trang tĩnh tải `community-teams.js` (kéo `analyze-map.js`, `community-team-form.js`); không nạp từ điển ở chế độ static nên không thêm ~1.4 MB.
- Build tích hợp làm bẩn `dist` → bước build lại sạch là bắt buộc.

## Rollback
Revert commit của phase; trang đội biến mất ở build kế, `?id=` tự rơi về `detailView` (HEAD 404). Không có trạng thái remote.

## Checklist
- [x] Fixture + test L/P/V/H/D/J/E viết trước, đỏ đúng chỗ
- [x] Loader fail-closed + memo
- [x] Nội dung/FAQ/JSON-LD/sitemap
- [x] Trang + route vi/zh + danh sách theo ngưỡng
- [x] Verifier (cặp, canonical chéo, không hreflang, ngưỡng 10, link danh sách)
- [x] JS static mode + redirect + link tĩnh, giữ pageKey/sharedPool
- [x] Gate localization exit 0; test:node, build, verify, test:dist, e2e xanh
- [x] Build tích hợp API giả đạt kỳ vọng; dist build lại sạch
