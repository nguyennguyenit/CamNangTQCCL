---
phase: 9
title: "Trang mùa Đội chuẩn (#6)"
status: done
priority: P2
effort: "2d"
dependencies: [8]
---

# Phase 9: Trang mùa Đội chuẩn (#6)

## Goal

Mỗi mùa cũ có đội của Đội chuẩn có trang tĩnh `/doi-chuan/<mã mùa>/` và `/zh/doi-chuan/<mã mùa>/`, đọc được đủ tên đội, tướng, chiến pháp khi không chạy JS, có trong sitemap và có JSON-LD. `/doi-chuan/` có khối "Các mùa khác" gồm link `<a href>` thật. Trang chi tiết đội của mùa cũ có nhãn "mùa cũ". Bộ lọc `?season=` giữ nguyên.

## Quyết định đã chốt (thu hẹp so với chữ của issue, người dùng duyệt)

- Chỉ Đội chuẩn. Đội khác không có dữ liệu mùa (40/40 đội `sourceSeasonIds: null`), nên không làm trang mùa cho Đội khác.
- Mùa hiện tại (`defaultSourceSeasonId`, hiện là OG) không có trang riêng; link của nó là `/doi-chuan/`.
- Mùa chưa thu thập (0 đội: `pk-s15`, `pk-s20`, `pk-s21`) không có trang.
- Bộ lọc mùa và `?season=` giữ như cũ; không redirect.
- H1 trang chi tiết đội giữ là tên đội (tên mùa đã có ở `<title>`, JSON-LD, dòng phụ).
- Trang mùa không có comment cộng đồng.

## Hiện trạng (bằng chứng: [reports/scout-06-season-pages.md](./reports/scout-06-season-pages.md))

- Slug đội: `<displayCode viết thường>-<handle>` (`src/lib/team-detail-routes.ts:314-322`, `:21-27`). Mã mùa `og`, `s1`, `pk-s28` không bao giờ trùng slug đội (slug đội luôn có `-<handle>`).
- Registry mùa: `seasons.json` của generation đã pin, đọc qua `websiteDisplayPublicationSnapshot().recommended.files['seasons.json']` (`src/lib/team-detail-pages.ts:64-83`). `src/lib/llms-documents.ts:71-104` đã nhóm theo mùa với `lookupSlug(code)`.
- Số đội mỗi mùa tối đa 130 (`pk-s26`), nên một trang mỗi mùa, không phân trang. Prerender danh sách hiện giới hạn `PAGE_SIZE=60` (`js/team-filter-section.js:139`); trang mùa phải render đủ.
- `src/pages/doi-chuan/[team].astro` (ghim) là route động duy nhất ở cấp này; trang mùa đi chung route (Astro không cho hai route động cùng cấp).
- Sitemap `src/pages/sitemap.xml.ts:159-173` và verifier `scripts/verify-astro-dist.mjs:268-285` (allowlist), `:295-301`, `:309-321` (so byte sitemap), `:549-590` (title/description không trùng) phải cùng biết các trang mùa.
- Canonical/hreflang tự có qua `SiteLayout.astro:77-84` và `src/lib/locale-routes.ts:41-44`; `verifyLocalePair` ở `verify-astro-dist.mjs:90-98`.
- Client thay header khi khởi động (`js/team-filter-section.js:279`) và chỉ giữ `.reference-view`: khối "Các mùa khác" phải nằm ngoài vùng client thay thế, hoặc client cũng render nó.
- "Mùa cũ" chưa có ở đâu; `js/team-filter-section.js:165` cố định `CURRENT_SOURCE_SEASON_ID='og-兵演春秋'`, trùng với `defaultSourceSeasonId` của registry.
- `PAGE_KEY_PATTERN` (`js/community-api.js:11`) coi mọi đường dẫn một cấp dưới `/doi-chuan/` là trang có comment.
- Tên mùa Việt trùng nhau ở S3 và PK-S7 ("Trận chiến Xích Bích"): title trang mùa phải có mã mùa.

## Thiết kế

<!-- Updated: Red Team 2026-10-22 - /doi-chuan/ SSR đủ đội mùa mặc định; redirect slug mùa hiện tại; gộp path ở [team].astro; comment chỉ phía client, không sửa regex -->

- `src/lib/season-pages.ts` (mới, không ghim): dựng danh mục trang mùa từ `teamDetailCatalog()` và `recommendedSeasonOrder()` đã có (`src/lib/team-detail-pages.ts:77`), không viết bộ đọc `seasons.json`/`index.json` thứ hai: `{slug: displayCode.toLowerCase(), sourceSeasonId, nameVi, nameRaw, count, isCurrent}`; bỏ mùa hiện tại và mùa 0 đội. Fixture registry rỗng cho 0 trang, không ném lỗi. Sitemap, verifier, trang và `/doi-chuan/` cùng import.
- Path mùa được nối vào `getStaticPaths` **trong** `src/pages/doi-chuan/[team].astro` và bản zh (hoặc qua hàm mới `seasonPagePaths()`), không bao giờ bên trong `recommendedDetailPaths` (consumer thứ ba `src/lib/llms-documents.ts:72-75` sắp xếp theo `row.props.entry.sourceSeasonId`). Render component mới `src/components/pages/SeasonPage.astro` cho path mùa.
- Trang mùa: một H1 "Đội chuẩn mùa <tên mùa> (<mã>)"; mỗi đội một mục có tên, tier, tướng, chiến pháp, link tới trang chi tiết; nhóm theo tier; JSON-LD `CollectionPage` + `ItemList` (mọi item có URL trang đội thật), `isPartOf` VideoGame, breadcrumb Trang chủ › Đội chuẩn › mùa; canonical là chính nó; hreflang vi/zh.
- `/doi-chuan/` (và zh): SSR render **đủ** đội của mùa mặc định (bỏ giới hạn `PAGE_SIZE=60` ở phần SSR của `src/lib/team-section-ssr.js:39-55`; client vẫn hiện theo trang như cũ), vì mùa hiện tại không có trang riêng và có thể >60 đội khi đổi mùa mặc định. Khối "Các mùa khác" SSR liệt kê mọi trang mùa bằng `<a href>`, đặt ngoài vùng client thay thế.
- Khi mùa mặc định đổi, trang của mùa mới thành "hiện tại" sẽ biến mất. Giữ URL: `public/_redirects` có rule `/doi-chuan/<slug mùa hiện tại>/ → /doi-chuan/` và `/zh/doi-chuan/<slug>/ → /zh/doi-chuan/` (301), sinh từ danh mục trang mùa lúc build (cùng chỗ sinh `_redirects` hiện có ở `pipeline/lookup_route_handles.py:16-19,244-252`, hoặc một bước sinh riêng có `--check`).
- Nhãn "mùa cũ": trên trang chi tiết đội (dòng phụ, `RecommendedDetail.astro:81-82`) và trên mỗi trang mùa, khi `sourceSeasonId !== defaultSourceSeasonId`. `js/team-filter-section.js` lấy mùa hiện tại từ registry thay cho hằng số `:165`, để chip "Hiện tại" và nhãn "mùa cũ" cùng một nguồn.
- Comment: `SeasonPage.astro` không có `#community-root`, nên `js/community-page.js:22-28` không mount khung comment. Không sửa `PAGE_KEY_PATTERN` (`js/community-api.js:11`) và không sửa `community-worker/src/validate.ts:6-7`. Server vẫn nhận `page_key` dạng `/doi-chuan/<slug>/` như hiện nay (đã nhận mọi slug một cấp); điều này được chấp nhận và ghi vào comment đóng #6.
- Không đổi `js/team-detail-navigation.js`: link từ trang mùa tới trang đội không mang `from=`; nút quay lại của trang đội giữ hành vi hiện tại (`/doi-chuan/?season=<sourceSeasonId>`).

## Files to Create / Modify

- Create: `src/lib/season-pages.ts`, `src/components/pages/SeasonPage.astro`, `tests-js/season-pages.test.mjs`, `tests-e2e/season-pages.spec.mjs`.
- Modify (ghim): `src/pages/doi-chuan/[team].astro`, `src/components/pages/RecommendedDetail.astro`, `js/team-filter-section.js`, và `src/components/pages/SectionPage.astro` hoặc `src/lib/team-section-ssr.js` cho khối "Các mùa khác".
- Modify (không ghim): `src/pages/zh/doi-chuan/[team].astro`, `src/pages/sitemap.xml.ts`, `scripts/verify-astro-dist.mjs`, `src/lib/structured-data.ts`, `src/lib/team-section-ssr.js` (bỏ giới hạn SSR), nơi sinh `public/_redirects`, `tests-js/astro-dist-contract.test.mjs`, `tests-js/seo-dist-contract.test.mjs`. Không sửa `js/community-api.js` hay bất kỳ file `community-worker/**` nào.
- Hồi quy: `src/lib/llms-documents.ts` (các file `/llms/doi-chuan/<mùa>.txt` không đổi).
- Publish lại bản dịch (chữ vi/zh mới), re-pin `pipeline/team-route-handles.json`.
- Docs: `docs/code-standards.md`, `docs/deployment-guide.md:104`, `README.md:9-14`, `docs/project-changelog.md`.
- Sau khi merge: comment vào #6 ghi phần đã làm, lý do bỏ Đội khác, lý do giữ H1, lý do giữ `?season=` (không thêm lợi SEO).

## TDD (đỏ trước)

`tests-js/season-pages.test.mjs`:

1. Slug là `displayCode` viết thường (`pk-s24`, `s1`), không phải `sourceSeasonId` chữ Hán; bằng tiền tố `routeSeasonSegment` của mọi slug đội trong mùa đó.
2. Không có trang cho mùa hiện tại và mùa 0 đội.
3. Số đội mỗi trang bằng số dòng `index.json` của mùa (không dùng `advertisedCountRaw`: `pk-s19` quảng cáo 88 nhưng có 84).
4. Không slug mùa nào trùng slug đội.
5. Registry rỗng → 0 trang, không ném lỗi.
6. Đổi `defaultSourceSeasonId` trong fixture → mùa cũ cũ trở thành có trang; mùa mới hiện tại mất trang và `_redirects` có rule 301 từ slug của nó (vi, zh) về `/doi-chuan/`; nhãn "mùa cũ" đổi theo, không còn hằng số trong client.
6b. Fixture mùa mặc định có hơn 60 đội: `/doi-chuan/` không JS liệt kê đủ mọi đội.

Dist/SEO (`astro-dist-contract`, `seo-dist-contract`):

7. Mỗi trang mùa: đúng một H1 có tên và mã mùa; đủ N đội, mỗi đội có link tới trang chi tiết tồn tại; không có chữ "cần JavaScript"; canonical là chính nó; hreflang vi/zh-Hans/x-default.
8. JSON-LD hợp lệ, `ItemList` mọi item có URL tồn tại, breadcrumb 3 mục.
9. Title và description các trang mùa không trùng nhau (S3 và PK-S7 cùng tên Việt).
10. `sitemap.xml` có mọi trang mùa × (vi, zh); verifier báo lỗi khi thiếu hoặc thừa file trang mùa; so byte sitemap vẫn khớp.
11. `/doi-chuan/` no-JS có khối "Các mùa khác" với `<a href="/doi-chuan/<slug>/">` cho mọi trang mùa.
12. Trang chi tiết đội mùa cũ có nhãn "mùa cũ" (vi) và nhãn tương ứng (zh); đội mùa hiện tại không có. JSON-LD `name` vẫn là tiền tố của `<title>`; H1 không đổi.

E2E `tests-e2e/season-pages.spec.mjs`:

13. Mở `/doi-chuan/pk-s24/` có JS: khối "Các mùa khác" không bị client xóa; không có khung comment; HTML dist của trang mùa không chứa `id="community-root"`.
13b. `git diff --name-only` của PR không có file `community-worker/**` hay `js/community-api.js`.
14. Bộ lọc `?season=pk-s24` trên `/doi-chuan/` hoạt động như cũ (các spec hiện có ở `tests-e2e/recommended-browser.spec.mjs` xanh, không sửa assert `?season=`).
15. zh không lẫn chữ Việt trên trang mùa.

## Verification

```
node --test tests-js/season-pages.test.mjs
<chuỗi Publish lại bản dịch hiển thị>
python3 -m pipeline.team_route_handles --check
node scripts/report-zh-gaps.mjs --check
npm run build && npm run verify && npm run test:dist && npm run test:node
npx playwright test tests-e2e/season-pages.spec.mjs tests-e2e/recommended-browser.spec.mjs tests-e2e/team-detail-pages.spec.mjs tests-e2e/team-ssr-nojs.spec.mjs
node --test tests-js/llms-*.test.mjs   # hồi quy llms-documents nếu có test; nếu không, so /llms/doi-chuan/*.txt trước/sau
```

## Risks

- Hai route động cùng cấp: dùng chung `[team].astro`, test 4 chặn trùng slug.
- Client xóa khối SSR: test 13.
- Thêm chuỗi UI vào file ghim: chạy publish lại; chuỗi mới không cần tuple policy mới (đã thử trong bản sao ở scout #5/#20), nhưng `check --stage public` sẽ báo nếu cần.
