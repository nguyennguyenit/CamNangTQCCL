# Phase 3 — Tra cứu đủ mục, hồ sơ view-tree, trang riêng từng mục: báo cáo

Kết quả: 7 trang nhóm `/tra-cuu/<nhóm>/` (vi + zh) dựng sẵn **mọi** mục của nhóm (202 / 406 / 114 / 68 / 39 / 41 / 16 = 886); hồ sơ tướng, chiến pháp, binh thư là cây view (`createProfileRenderer` → `{renderProfile, profilePageTree}`); 886 × 2 trang riêng `/tra-cuu/<nhóm>/<slug>/` có hồ sơ đầy đủ dựng sẵn, title/description duy nhất, canonical, hreflang vi/zh và link quay lại trang nhóm. Thẻ/hàng/link quan hệ là `<a href="/tra-cuu/<nhóm>/<slug>/">` (zh có tiền tố), click thường vẫn mở hộp thoại; `?id=` cũ vẫn mở hộp thoại. Sitemap 3140 → 4912. Ledger slug (B1) đã giao trước, xem `phase-03-ledger.md`.

## Lệnh đã chạy (cuối cùng)

| Lệnh | Kết quả |
|---|---|
| `npm run build` (localization `check --stage public` + `astro build`) | OK, 4917 trang (3145 + 1772) |
| `npm run verify` | OK, 5115 file (3342 + 1772 trang + `js/lookup-item-page.js`) |
| `npm run test:dist` | 40/40 (trước 36: +3 ca dist Tra cứu, +1 ca fixture verifier) |
| `npm run test:node` | 531/531 (517 + 14: `lookup-profile-trees` 9, `lookup-ids` 1, dist contract 4) |
| `python3 -m unittest discover -s tests` | 422 OK |
| `npx playwright test -c playwright.local.config.mjs` | 460 passed, 0 failed, 0 flaky (434 nền + 26 ca mới) |
| `python3 -m pipeline.lookup_route_handles --check` | ledger ok: 886 id (generation lookup không đổi) |
| `python3 -m pipeline.team_route_handles --check` | OK (1366/166/17), re-pin sang generation mới |
| `python3 -m pipeline.site_localization check --root . --stage public` | exitCode 0 |
| `npx astro check` | 0 lỗi |
| `mcp-worker`: `npm run check:workflow-build` | OK (không file semantic nào bị đổi) |

## TDD (đỏ → xanh)

- **Đỏ** (dist Phase 2, trước khi sửa) — ba ca dist mới + sitemap trong `tests-js/astro-dist-contract.test.mjs` fail đúng lý do: sitemap `actual 3140 / expected 4912`; trang `tra-cuu/tuong/` có `data-lookup-id` chỉ 60 mục (không phải đủ 202); `ENOENT dist/tra-cuu/tuong/sp-lu-mong/index.html` (không có trang riêng).
- **Xanh** sau khi sửa: 3 ca mới (đủ mục vi+zh và thẻ là link trang riêng; trang riêng mẫu mỗi nhóm có tên + trường hồ sơ chính từ corpus; 886×2 trang riêng có canonical/og:url/hreflang/title+description duy nhất/link về trang nhóm) + sitemap derive từ `lookupDetailRoutes()`.
- Trường hồ sơ chính lấy từ corpus thật: tướng → tên chiến pháp bản thân (`lookup.selfTacticId`); chiến pháp → đoạn hiệu ứng hiện hành; binh thư → hiệu ứng; trang bị → tên đặc kỹ độc quyền đầu; quân sư → tên võ tướng + hiệu ứng; cải tạo → `appliesToVi`; công trình → `summaryVi` (zh: cấp tối đa).
- Test unit/e2e viết cùng lúc với sửa (chưa chạy riêng trước khi sửa; đỏ chỉ ghi nhận ở tầng dist ở trên).
- `tests-js/lookup-profile-trees.test.mjs` (9 ca, dữ liệu thật, chạy Node không `document`): trang riêng tướng/chiến pháp/binh thư vi+zh (link quan hệ, h1 duy nhất, không nút đóng, đủ panel phiên bản, panel cũ `hidden`), khối Trong cẩm nang từ bảng đã kiểm, `data-lookup-later`, chi tiết catalog `h1` không back-link. `tests-js/lookup-ids.test.mjs`: bảng slug (từ chối nguyên khối bảng hỏng, mã chưa có slug lùi về `?id=`).
- Verifier (`scripts/verify-astro-dist.mjs`): ca fixture mới (`lookupItemsFixture`) có ledger + books-dict + trang riêng giả; khẳng định chấp nhận và từ chối: thiếu/thừa trang so ledger, canonical lệch, title/description trùng, thiếu hồ sơ của mục, hai h1, nạp `app.js`, thiếu link quay lại, chữ chờ, trang nhóm thiếu/thừa thẻ, bảng slug lệch ledger, ledger bị xoá id/sửa tay, sitemap thiếu URL.
- Đối chiếu DOM hộp thoại trước/sau B2 (throwaway, `/tmp/p3`, đã bỏ khỏi repo): Playwright trên dist Phase 2 và dist mới, `.lookup-dialog` outerHTML cho 10 tướng + 10 chiến pháp + 6 binh thư × vi/zh (52 file; chiến pháp có thêm DOM sau khi bấm từng nút phiên bản): **0/52 khác biệt** sau khi chuẩn hoá (a) `href` nội bộ Tra cứu (nay là trang riêng), (b) hai thuộc tính chủ động thêm — `data-lookup-open` (nút quan hệ cùng nhóm) và `data-effect-version` (nút chọn phiên bản; thay cho closure), (c) lớp `hero-portrait-loaded` (phụ thuộc thời điểm tải ảnh ngoài, không ổn định giữa hai lần chạy).

## E2E

- Mới `tests-e2e/lookup-item-pages.spec.mjs` (26 ca): thẻ tướng / hàng chiến pháp / danh sách catalog / binh thư là link trang riêng (vi+zh); click thường mở hộp thoại (URL `?id=`); Ctrl/Cmd+click mở link trang riêng ở tab mới, không mở hộp thoại; `?id=` cũ vẫn mở hộp thoại; HTML dựng sẵn đủ mọi mục nhưng khi có JS chỉ 60 mục hiện, sau boot DOM giữ đúng 60 rồi "Xem thêm" → 120; không JS: trang nhóm hiện đủ, không còn hàng "Xem thêm"; không JS: trang riêng của cả 7 nhóm × vi/zh đọc được, một h1, link quay lại; nút phiên bản hiệu ứng (chiến pháp, cải tạo) chạy trên trang riêng; link chiến pháp trong trang riêng tướng dẫn tới trang riêng chiến pháp.
- Test cũ đổi vì hành vi chủ động thay đổi (thẻ/link nay là trang riêng; trang nhóm dựng sẵn đủ mục): `unified-lookup.spec.mjs` (hồ sơ tướng → chiến pháp liên quan = link trang riêng, Back về hồ sơ tướng; HTML dựng sẵn bốn nhóm catalog = đủ mục; link tướng trong đặc kỹ = trang riêng; "HTML dựng sẵn của trang Tướng đủ mọi mục + `data-lookup-later` = tổng − 60"; thẻ/tên bấm khi app chưa chạy tới trang riêng), `a11y-targets.spec.mjs` (Enter trên nút quan hệ → trang riêng chiến pháp), `spa-parity.spec.mjs` (không JS: trang Tướng có đủ mục). Mọi test Tra cứu khác (tìm, lọc, "Xem thêm", dialog, Back/focus…) giữ nguyên và xanh.
- Một lỗi tự gây ra và đã sửa trong lúc chạy e2e: quy tắc CSS ẩn `.lookup-more-row` khi không có `html[data-lookup-js]` trúng cả hàng "Xem thêm" của Đội chuẩn/Đội khác (dùng chung class) → 4 ca `recommended-browser` fail; đã giới hạn trong `#section-lookup`.

## Kích thước và thời gian

Byte, bản Việt (bản zh nhỏ hơn 4–20 %). "Trước" của trang nhóm tính bằng cách bỏ các mục `data-lookup-later` khỏi HTML mới (≈ dist Phase 2; dist cũ không còn để đo).

| Trang | Trước (≈, 60 mục đầu) | Sau |
|---|---|---|
| `/tra-cuu/chien-phap/` (lớn nhất; 406 mục) | ≈ 241 000 | **593 585** (zh 481 138) |
| `/tra-cuu/tuong/` (202) | ≈ 222 000 | 328 939 (zh 316 762) |
| `/tra-cuu/trang-bi/` (114) | ≈ 200 000 | 247 834 |
| `/tra-cuu/binh-thu/` (68) | ≈ 197 000 | 200 429 |
| `/tra-cuu/quan-su/` (39) / `cong-trinh/` (41) / `cai-tao-binh-chung/` (16) | ≈ 199 000 / 184 000 / 188 000 | 224 939 / 192 746 / 187 942 |
| Trang riêng (886, vi) | — | nhỏ nhất 68 194 · trung vị 73 106 · **lớn nhất 83 606** (`/tra-cuu/cong-trinh/nong-truong/`) |

Mỗi trang nhóm mang thêm bảng slug 886 mục (36 KB JSON, chưa nén). `dist`: 260 MB → 388 MB.

Thời gian build (`astro build`, máy này, một lần đo mỗi bên, đo khi không chạy việc khác): **trước ≈ 6,4 s / 3145 trang** (bản sao cây hiện tại, bỏ hai route trang riêng; không có số đo từ trước Phase 3 vì cây làm việc chứa cả Phase 1–2 chưa commit) → **sau ≈ 8,5 s / 4917 trang** (wall 7,4 s → 9,3 s). `npm run build` đầy đủ (kèm localization check) ≈ 17 s.

## Quyết định thiết kế

- **Trạng thái đầu của trang nhóm.** HTML chứa đủ mọi mục; mục từ vị trí `pageSize` trở đi mang `data-lookup-later`. Head của trang nhóm đặt `<html data-lookup-js>`; chỉ khi có cờ này CSS ẩn các mục đó (`html[data-lookup-js] [data-lookup-later]{display:none}`), nên không JS thì hiện đủ và hàng "Xem thêm" (vô tác dụng) bị ẩn (`html:not([data-lookup-js]) #section-lookup .lookup-more-row`). Trạng thái nhìn thấy khi có JS giữ nguyên như trước: trang đầu (60 / trang bị 24 / quân sư 18 / công trình 20 / cải tạo trọn 16), phần còn lại do "Xem thêm". Client không đổi logic: `render()` đầu tiên vẫn dựng trang đầu (các nút ẩn bị bỏ khỏi DOM), tìm/lọc/"Xem thêm" dựng từ dữ liệu; HTML dựng sẵn chỉ quyết định nội dung mà crawler/không-JS thấy.
- **Slug trên client.** Thẻ dựng lại trong trình duyệt phải trỏ đúng cùng link với HTML: build nhúng `#lookup-route-handles` (`{id: slug}` đủ 886, đúng ledger; verifier so từng byte) và `js/app.js` đăng ký bằng `setLookupRouteHandlesFromJSON` trước `initLookupPage`. `lookupHref(id)` (`js/lookup-ids.js`) = trang riêng khi có slug, không thì `?id=`. Mọi href Tra cứu của thẻ, hàng, link quan hệ đi qua đây; link của trang đội (`lookupProfilePath`, `?id=`) không đổi (Phase 4).
- **Hồ sơ = cây view.** `js/lookup-profile.js` / `lookup-tactic-profile.js`: mọi khối dùng `t()`/`portraitTree`/`iconTree`; `createProfileRenderer` trả `{renderProfile, profilePageTree}`. Hộp thoại: `treeToDom` rồi gắn sự kiện (nút đóng, `[data-lookup-open]`, nút phiên bản, khối Trong cẩm nang tải lười như cũ — giữ nguyên nhánh async + trạng thái). Trang riêng: bỏ nút đóng, tiêu đề `h1`, quan hệ cùng nhóm là link thay vì nút. Cây giữ nguyên `L()` nguyên văn nên nghĩa vụ UI cũ vẫn khớp.
- **Phiên bản hiệu ứng chiến pháp.** Hộp thoại chỉ có đoạn của bản đang chọn (DOM không đổi; nút dựng lại đoạn từ bản ghi). Trang riêng không có bản ghi ở client nên mang đủ mọi phiên bản trong các panel `[data-effect-panel]` (bản cũ `hidden`), `js/lookup-item-page.js` chỉ bật/tắt. Quy tắc CSS `[hidden]` cho panel.
- **Hằng dịch lúc nạp module.** `lookup-detail.js` (`LABELS`, `LOOKUP_EMPTY`, `VARIANT_LABELS`, `FLAG_LABELS`) và `unified-lookup.js` (`POSITION_LABELS`) đóng băng theo ngôn ngữ lúc nạp, nên build zh trong cùng tiến trình với vi sẽ sai. Chuyển thành hàm (`lookupEmpty()`, `labels()`, `POSITION_LABELS()`…); test `POSITION_LABELS()` cập nhật.
- **Trang riêng bốn nhóm catalog** dùng `masterDetailTree(…, {page: true})`: tiêu đề `h1`, bỏ link "quay lại" của màn mobile (đã có hàng quay lại của trang) và đặt trong `aside.lookup-detail-panel` (CSS `.lookup-item .lookup-detail-panel` luôn hiện). `handleEffectTabClick` tách ra dùng chung cho panel trang nhóm và trang riêng.
- **Trang riêng**: `src/lib/lookup-item-pages.ts` (`lookupItemStaticPaths`, `lookupItemPage`), `src/components/pages/LookupItemPage.astro` (`pageKind="detail"`, `activeSection="lookup"`, không nạp `app.js`, chỉ `js/lookup-item-page.js`), hai route `[group]/[slug].astro`. Title `Tên — Nhóm — Tra cứu — <site>`; description ghép từ chính bản ghi (tướng: phe·sao·thống ngự; chiến pháp/binh thư/quân sư/cải tạo/công trình: đoạn hiệu ứng/tóm tắt cắt ≤150 ký tự; zh chỉ dùng chữ Hán/giá trị dịch được). 1772/1772 title và description duy nhất.
- **Trong cẩm nang trên trang riêng** (tướng + chiến pháp) dựng sẵn từ `hero-summaries.json`/`tactic-summaries.json` của generation Recommended đã pin (`lookupSummaryTables()` trong `src/lib/team-ssr.ts`: cùng `parseHeroSummaries`/`parseTacticSummaries` và khóa nối với kho Tra cứu như trình duyệt). Link đội tiêu biểu dùng bảng route handle đội đã đăng ký, không có `from`. Số liệu này đổi khi generation Recommended đổi (build lại).
- **Verifier**: chỉ kiểm trang riêng khi manifest phát cả `lookup-manifest` lẫn `books-dict` (dist thật); allowlist, sitemap và mọi kiểm tra đều dẫn xuất từ `lookupDetailRoutes({rootDir, manifest})` + `lookupBuildCorpus({rootDir, manifest})` của chính gốc dự án đang xác minh (không số đếm viết tay). `lookupBuildCorpus`/`lookupDetailRoutes` nhận `rootDir`/`manifest`; import trong `lookup-pages.ts`/`lookup-detail-routes.ts` thêm đuôi `.ts` để chạy được dưới Node (đường mặc định của ledger lần đầu được chạy thật ở đây: 886 id, pin khớp).
- **Sitemap** thêm `lookupDetailRoutes().entries` vào `mirroredSitemapPaths` → 4912 URL (không đổi hàm sinh).

## Localization

- File nguồn đã sửa nằm trong `policy.sourceFiles`: `js/app.js`, `lookup-detail.js`, `lookup-master.js`, `lookup-page.js`, `lookup-profile.js`, `lookup-tactic-profile.js`, `unified-lookup.js`, `LookupGroupPage.astro`, `lookup-pages.ts` → hash cập nhật; thêm vào `sourceFiles` + entrypoint mục `lookup`: `LookupItemPage.astro`, `lookup-item-pages.ts`, `src/pages/tra-cuu/[group]/[slug].astro` (và `js/lookup-master.js` ở entrypoint).
- `pipeline/site_localization.py` `UI_LITERAL_OBLIGATIONS` +12 nghĩa vụ `authored-vi` (`ui:lookup-item/*`: title, nhãn mục, 7 mô tả theo nhóm, tagline, back-aria, back); `concreteLocationCount` 56824 → 56836, `concreteInventorySha256` mới (`2a1ca02b…`). Không đổi số nghĩa vụ dịch (5668).
- Chuỗi chạy: `inventory` → `build --stage all --output .cache/…` → `check --stage all --candidate` (exit 0) → `publish` → `check --stage public` (exit 0) → `prune`. Generation Recommended mới `4fb559ea…` (cũ `e40a244a…` → trung gian `9780b449…` đều đã prune); `pipeline/team-route-handles.json` re-pin (1 dòng `generationId`; `--check` OK). Không đụng `data/lookup-*`, `books-dict.json`, ledger lookup (`generation lookup:29322cab13be` không đổi).

## File chính

- Mới: `js/lookup-item-page.js` (+ entry trong `src/lib/public-artifact-manifest.mjs`), `src/lib/lookup-item-pages.ts`, `src/components/pages/LookupItemPage.astro`, `src/pages/{,zh/}tra-cuu/[group]/[slug].astro`, `tests-e2e/lookup-item-pages.spec.mjs`, `tests-js/lookup-profile-trees.test.mjs`.
- Sửa: `js/{lookup-profile,lookup-tactic-profile,lookup-master,lookup-ids,lookup-detail,lookup-page,unified-lookup,app}.js`, `src/lib/{lookup-pages,lookup-detail-routes,team-ssr}.ts`, `src/components/pages/LookupGroupPage.astro`, `src/pages/sitemap.xml.ts`, `scripts/verify-astro-dist.mjs`, `css/styles.css`, `pipeline/{site_localization.py,site-localization-policy.json,team-route-handles.json}` + generation Recommended mới, `tests-js/{astro-dist-contract,lookup-ids,unified-lookup}.test.mjs`, `tests-e2e/{unified-lookup,a11y-targets,spa-parity}.spec.mjs`.

## Còn lại / lưu ý

- Link Tra cứu trong trang đội vẫn `?id=` (Phase 4 đổi nguồn `lookupLinks`); không có JSON-LD (Phase 4). `?id=` cũ vẫn mở hộp thoại.
- Docs/changelog chưa sửa (Phase 5; `docs/project-changelog.md` có thay đổi tay của người dùng, không đụng).
- Trang riêng không tải dữ liệu nào ở client; bản hiệu ứng cũ của chiến pháp chỉ xem được bằng JS (có trong HTML, ẩn). Trang nhóm khi có JS ẩn mục sau trang đầu bằng CSS (nội dung vẫn trong HTML cho crawler).
- Dùng chung `dist/` với agent khác: lần chạy cuối là `npm run build` + e2e cấu hình local (port 4184). Không commit/push/deploy.

## Review fixes (Phase 4, bước 1 — 9 phát hiện của ReviewPhase3)

| # | Phát hiện | Sửa |
|---|---|---|
| 1 | `--write` nhận slug sửa tay khi có mã mới | `ledger_problems` luôn kiểm `handlesSha256` (kể cả khi `--write` bỏ qua "chưa có slug"); `write_ledger` từ chối ledger sửa tay dù có mã mới. Test: `test_write_refuses_hand_edited_slug_even_when_new_ids_arrive`, `…_hand_edited_retired_section`. |
| 2 | Mã biến mất (đổi tên sách…) không có đường đi | Ledger thêm `retired` (`{nhóm: {mã: slug}}`): `--write` chuyển mã không còn trong corpus sang `retired`, slug vẫn bị giữ chỗ (mã mới không bao giờ nhận lại), mã quay lại nhận đúng slug cũ; `--check` vẫn báo "chạy --write để retire". `handlesSha256` phủ cả `handles` lẫn `retired` (chống sửa tay `retired` để nhả slug). Loader TS bỏ qua `retired` khi tạo route nhưng kiểm slug retired không trùng slug đang dùng và cùng digest. Ledger 886 mã migrate một lần (thêm `retired` rỗng, tính lại digest; không đổi slug nào). Test thay `test_write_refuses_to_extend_ledger_with_vanished_id` bằng 3 ca retire/giữ chỗ/khôi phục + ca slug trùng giữa live và retired. |
| 3 | Test parity gắn slug với tên hiện tại | `tests-js/lookup-detail-routes.test.mjs`: thay bằng test luật slug — `slug()` Python và `lookupSlug` JS cho cùng kết quả trên mọi tên corpus (+ ca biên) qua một lần gọi `python3`. Không còn ràng buộc slug đã cấp với tên hiện tại. |
| 4 | Meta description rỗng / treo dấu hai chấm / lấy nhãn phiên bản | `describe()` (`src/lib/lookup-item-pages.ts`): thiếu hiệu ứng thì kết bằng chấm thay vì `: `/`：`; `currentEffect` bỏ đoạn chỉ là nhãn phiên bản (`isVersionHeading` mới ở `js/lookup-detail.js`, nhận cả dạng "Cập nhật … :"). Verifier từ chối description kết thúc bằng `:`/`：`; dist test từ chối cả description chứa nhãn "Cập nhật …:". Trước sửa: 49 vi + 45 zh kết bằng dấu hai chấm, 4 vi dùng nhãn phiên bản, 7 zh rỗng; sau: 0. Nghĩa vụ UI `ui:lookup-item/*` đổi biểu thức theo (`${siteName}`, `tail(effect`…). |
| 5 | Trang riêng nạp ~277 KB JS | Module không phụ thuộc: `js/lookup-effect-panels.js` (`handleEffectTabClick`, `bindEffectVersionPanels`) và `js/http-source-url.js` (`validateHttpSourceUrl`, rút khỏi `recommended-reference-state.js` nên `hero-portrait.js` không kéo mô-đun mùa). `lookup-item-page.js` nay nạp 5 file, **12,6 KB** (từ 20 file / ~277 KB). `bindTacticEffectVersions` chỉ còn nhánh hộp thoại. Test `tests-js/lookup-item-page-deps.test.mjs` giữ trần (≤ 6 module, < 20 KB, không `render.js`/`unified-lookup.js`/mô-đun mùa). |
| 6 | Bảng slug 36 KB mỗi trang nhóm | Slug = hậu tố mã (`lookupDerivedSlug`, trừ `equipment-special`); chỉ **ngoại lệ** `{mã: slug}` được nhúng (hiện `{}`). `parseLookupDetailLedger` tính `exceptions`; verifier và dist test so bảng nhúng với đúng tập ngoại lệ của ledger (luật + ngoại lệ tái tạo đúng ledger). Bảng nay do `SiteLayout` nhúng (`#lookup-route-handles`) cho mọi trang có link Tra cứu, không còn riêng trang nhóm. Mã không có trang riêng (đặc kỹ trang bị) vẫn lùi về `?id=`. |
| 7 | Verifier chỉ đếm thẻ | So **tập mã** `data-lookup-id` với corpus (thiếu, thừa, lặp); fixture có ca "cùng số thẻ, một mã lạ". |
| 8 | `<aside>` bọc nội dung chính | `<div class="lookup-detail-panel">` ở trang riêng (CSS dùng class, không đổi). |
| 9 | `bySlug` không dùng | Bỏ `bySlug`/`bySlugKey`; chỉ còn kiểm slug trùng trong nhóm bằng `Map` cục bộ. |

Đỏ → xanh: các ca Python/Node/dist ở trên được viết trước phần sửa; đỏ có chứng cứ ở test mô-đun (`import`/chữ ký chưa có) và ca dist (xem `phase-04.md`). Kích thước trang nhóm sau sửa: `/tra-cuu/chien-phap/` 611 066 B (đã gồm JSON-LD `ItemList` của Phase 4; bảng slug 36 153 B → `{}`).
