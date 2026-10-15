# Phase 4 — Link path, JSON-LD, llms, báo cáo zh: báo cáo

Kết quả: trang đội (Đội chuẩn/Đội khác/Khai hoang/Cùng Tồn × vi/zh) không còn link `?id=` tới Tra cứu — ô chiến pháp/binh thư dẫn tới `/tra-cuu/<nhóm>/<slug>/`; trang chi tiết đội, trang nhóm và 1772 trang riêng có JSON-LD; bộ llms (`/llms.txt`, 30 file con theo mục, `/llms-full.txt`) từ một hàm sinh; `reports/zh-gaps.md` do script sinh. Bước 1 (9 phát hiện Phase 3) ở mục "Review fixes" của `phase-03.md`.

## Lệnh đã chạy (cuối cùng, một lượt liền)

| Lệnh | Kết quả |
|---|---|
| `npm run build` (localization `check --stage public` + `astro build`) | OK, 4917 trang |
| `npm run verify` | OK, 5154 file (5115 + 26 llms đội chuẩn + 3 + 7 + `llms-full.txt` + 2 JS mới) |
| `npm run test:dist` | 49/49 (40 + 9 ca `seo-dist-contract`) |
| `npm run test:node` | 545/545 (532 + 13: `seo-dist-contract` 9, `lookup-item-page-deps` 1, `treeToText` 1, hero resolver 1, retire ledger TS 1) |
| `python3 -m unittest discover -s tests` | 426 OK (422 + 4 ca retire/hand-edit) |
| `npx playwright test -c playwright.local.config.mjs` | 482 passed, 0 failed (476 + 6 ca mới) |
| `python3 -m pipeline.lookup_route_handles --check` / `team_route_handles --check` | OK (886 mã; 1366/166/17) |
| `python3 -m pipeline.site_localization check --root . --stage public` | exitCode 0 |
| `mcp-worker`: `npm run check:workflow-build` | OK |
| `node scripts/report-zh-gaps.mjs --check`, `npx astro check` | khớp; 0 lỗi |

## Red → green

- **Đỏ** (`tests-js/seo-dist-contract.test.mjs` chạy trên dist trước khi sửa, 8/9 fail đúng lý do): trang đội còn `?id=` (`doi-chuan/og-40y-lu-bo-cung-dieu-thuyen`), 0 khối JSON-LD ở trang đội / trang mục / trang nhóm (`actual 0, expected 2`), `llms.txt` không có mục toàn văn, `dist/llms-full.txt` ENOENT. Ca thứ 9 (zh-gaps khớp dữ liệu) xanh vì sinh từ dữ liệu, không cần dist.
- **Xanh** sau khi dựng: link `lookupItemPath` (js/recommended-reference-render.js), `structured-data.ts`, `llms-documents.ts` + route, script zh-gaps. Hai lần đỏ thật lúc dựng (đã sửa, nêu để đối chiếu): (1) JSON-LD đội liệt kê tên tướng không đúng chữ trang hiển thị (`CO Vô Song Đại Kiều` hiển thị là `CO Đại Kiều`; `SP荀彧` hiển thị `SP 荀彧`) → dùng `holderDisplayName` của builder, so tên bỏ khoảng trắng; (2) `alternateName` Việt ở trang zh không có trong HTML → bản Trung không khai `alternateName`.
- Test cũ đổi vì hành vi chủ động đổi: `tests-e2e/team-detail-pages.spec.mjs` (link `?id=` → trang riêng), `tests-js/lookup-master.test.mjs` (link tướng trong chi tiết trang bị là trang riêng vì slug suy từ mã), `tests-js/astro-dev-contract.test.mjs` (fixture dev cần `pipeline/lookup-route-handles.json` vì mọi trang đội/Tra cứu nay nhúng bảng ngoại lệ).
- e2e mới (`tests-e2e/lookup-item-pages.spec.mjs`, +6): link chiến pháp và binh thư trên trang chi tiết đội dẫn tới trang riêng (vi + zh, click đổi URL, một h1, `[data-lookup-item-root]`); `?id=` cũ trên trang nhóm mở hộp thoại cho chiến pháp/binh thư/tướng.

## Link path

- `js/lookup-ids.js`: slug = hậu tố mã (`lookupDerivedSlug`); `lookupItemPath` không cần bảng. Ngoại lệ ledger (`{}` hiện nay) đăng ký qua `#lookup-route-handles` do `SiteLayout` nhúng cho mọi trang có `team-route-handles` (kể cả trang chi tiết); `app.js` và `team-detail.js` đăng ký; build đăng ký ở `prepare()` của `team-ssr.ts` và `lookupRouteHandles()`.
- Trang đội: `lookupHref` trong `js/recommended-reference-render.js` dùng `lookupItemPath`. Đối chiếu dist: mọi `href` trang riêng trong 3000+ trang đội (vi+zh) là route của ledger và có file dist; > 1000 link.
- `docs/design-guidelines.md:109` để Phase 5 (theo phạm vi).

## JSON-LD (mẫu thật từ dist)

`src/lib/structured-data.ts` (mẫu `blog-seo.ts`); chèn qua `<Fragment slot="head">` với `jsonLd()`. Mỗi trang 2 khối: nội dung + `BreadcrumbList`. Test dist: mọi khối parse được; `url` = canonical; `description` = meta description; `name` đứng đầu `<title>`; `isPartOf` `VideoGame` `三国志·战略版`; `inLanguage` vi/zh-Hans; mọi `about`/`ItemList` url là route của ledger và có file dist; tên có trong HTML.

Trang chi tiết đội (`/doi-chuan/pk-s4-thuc-tri-cung/`; `about` chỉ tướng có trang riêng, tên đúng như trang hiển thị):
```json
{"@context":"https://schema.org","@type":"WebPage","name":"Thục Trí Cung (PK-S4)","description":"Chi tiết đội hình Thục Trí Cung (PK-S4 · Quần Hùng Cát Cứ · Giao chiến): tướng, chiến pháp, binh thư và điểm tham khảo.","url":"https://tqccl.com/doi-chuan/pk-s4-thuc-tri-cung/","inLanguage":"vi","isPartOf":{"@type":"VideoGame","name":"三国志·战略版","alternateName":"Tam Quốc Chí - Chiến Lược"},"about":[{"@type":"Thing","name":"Khương Duy","url":"https://tqccl.com/tra-cuu/tuong/khuong-duy/"},{"@type":"Thing","name":"Bàng Thống","url":"https://tqccl.com/tra-cuu/tuong/bang-thong/"},"…"]}
```
Trang riêng — tướng `Thing` (`image` https từ `iconUrl`, bỏ khi thiếu):
```json
{"@type":"Thing","name":"SP Lữ Mông","alternateName":"SP 呂蒙","description":"SP Lữ Mông — tướng Ngô · 5 sao · Thống ngự 7 · Khống chế / Kiêm nhiệm: chỉ số, thích tính binh chủng, chiến pháp bản thân và các đội hình dùng tướng này.","url":"https://tqccl.com/tra-cuu/tuong/sp-lu-mong/","inLanguage":"vi","image":"https://cloud.lingxigames.com/2022/12/6/784810408878469120.png","isPartOf":{"@type":"VideoGame","name":"三国志·战略版"}}
```
Trang riêng — chiến pháp/binh thư/quân sư `DefinedTerm`:
```json
{"@type":"DefinedTerm","name":"An Ủi Quân Dân","alternateName":"撫輯軍民","description":"An Ủi Quân Dân — chiến pháp phẩm S · Chỉ huy: Trong 3 hiệp đầu trận, …","url":"https://tqccl.com/tra-cuu/chien-phap/an-ui-quan-dan/","inLanguage":"vi","inDefinedTermSet":{"@type":"DefinedTermSet","name":"Chiến pháp","url":"https://tqccl.com/tra-cuu/chien-phap/"},"isPartOf":{"@type":"VideoGame","name":"三国志·战略版"}}
```
Trang nhóm (`/tra-cuu/binh-thu/`, `ItemList` đủ 68 phần tử, mọi `url` có file dist):
```json
{"@type":"CollectionPage","name":"Binh thư","url":"https://tqccl.com/tra-cuu/binh-thu/","inLanguage":"vi","isPartOf":{"@type":"VideoGame","name":"三国志·战略版"},"mainEntity":{"@type":"ItemList","name":"Binh thư","numberOfItems":68,"itemListElement":[{"@type":"ListItem","position":1,"url":"https://tqccl.com/tra-cuu/binh-thu/binh-hanh-quy-dao/","name":"Binh Hành Quỷ Đạo"},"…"]}}
```
Quy tắc: `alternateName` chỉ ở bản Việt và chỉ khi trang hiển thị chữ Hán (không có cho binh thư bản Việt); bản Trung không khai tên Việt. Breadcrumb: Trang chủ → Đội chuẩn/Đội khác/Khai hoang → đội; Trang chủ → Tra cứu → Nhóm → Mục.

## llms

Một hàm sinh `llmsDocuments(site)` (`src/lib/llms-documents.ts`, memo theo gốc site): chữ thuần `treeToText` (mới, `js/view-tree.js`) của đúng các cây mà HTML dựng từ (`recommendedTeamDetailContent`/`legacyOriginalDetailContent`/`khaihoangDetailTrees`, `seasonCoexistGroup`, `profilePageTree`/`masterDetailTree`). Mỗi mục mở bằng `## [tên](URL trang riêng)`. Route: `src/pages/llms.txt.ts` (giữ nguyên nội dung blog, thêm "Tra cứu theo nhóm" với 7 nhóm + "Toàn văn chữ thuần theo mục"), `src/pages/llms/[...path].txt.ts`, `src/pages/llms-full.txt.ts`; `scripts/verify-astro-dist.mjs` lấy allowlist từ cùng hàm và kiểm từng file đúng byte, `llms-full.txt` = nối theo thứ tự, mọi link của `llms.txt` về site có file dist. `public/_headers` thêm `/llms-full.txt` và `/llms/*` (cùng chính sách revalidate; test header cập nhật).

Đội chuẩn tổng 1 178 203 byte > 300 KB nên tách theo mùa (`/llms/doi-chuan/<mùa>.txt`, tên = slug mã mùa). Cùng Tồn không có trang riêng: mỗi mùa đã duyệt một mục, link `/cung-ton/?scenario=<mùa>` (tham số mà trang đọc); chứa mọi nhóm đội của mọi mùa (trang chỉ dựng nhóm đầu của mùa mới nhất).

Kích thước (byte, UTF-8):

| File | Byte |
|---|---:|
| `/llms.txt` | 12 565 |
| `/llms-full.txt` | 2 668 288 |
| `/llms/doi-chuan/pk-s4.txt` · `pk-s5` · `pk-s6` · `pk-s7` · `pk-s8` | 12 119 · 13 076 · 15 101 · 15 209 · 15 173 |
| `…/pk-s9` · `pk-s10` · `pk-s11` · `pk-s12` · `pk-s13` · `pk-s14` | 33 275 · 36 694 · 29 517 · 16 628 · 32 288 · 27 931 |
| `…/pk-s16` · `pk-s17` · `pk-s18` · `pk-s19` | 92 021 · 88 655 · 91 903 · 69 878 |
| `…/pk-s22` · `pk-s23` · `pk-s24` · `pk-s25` · `pk-s26` · `pk-s27` · `pk-s28` | 23 471 · 33 755 · 87 030 · 92 463 · 100 829 · 70 178 · 80 003 |
| `…/s1` · `s2` · `s3` · `og` | 21 267 · 23 326 · 24 519 · 31 894 |
| `/llms/doi-khac.txt` | 131 786 |
| `/llms/cung-ton.txt` | 30 773 |
| `/llms/khai-hoang.txt` | 34 006 |
| `/llms/tra-cuu/tuong.txt` | 387 680 |
| `/llms/tra-cuu/chien-phap.txt` | 483 975 |
| `/llms/tra-cuu/trang-bi.txt` | 265 568 |
| `/llms/tra-cuu/quan-su.txt` | 35 226 |
| `/llms/tra-cuu/cai-tao-binh-chung.txt` | 46 022 |
| `/llms/tra-cuu/cong-trinh.txt` | 56 303 |
| `/llms/tra-cuu/binh-thu.txt` | 18 746 |

Không file mùa nào vượt 300 KB (lớn nhất `pk-s26` 100 829). Hợp đồng dist: `/llms-full.txt` đúng bằng nối các file con (thứ tự: đội chuẩn theo mùa → đội khác → cùng tồn → khai hoang → 7 nhóm), đủ 1366 URL đội chuẩn, 166 đội khác, 17 Khai hoang, 886 URL trang mục; file Tra cứu của nhóm nào chỉ có URL trang của nhóm đó.

## zh-gaps

`scripts/report-zh-gaps.mjs` (`--check` để so với file): quét `lookupProfile(...).viOnly` ở bản zh trên 886 mục, so hồ sơ vi/zh để nêu phần thiếu (trường theo khóa, số điều kiện/lịch sử/lựa chọn, thuộc tính cấp công trình). Kết quả `reports/zh-gaps.md`: 570/886 mục thiếu (tướng 131/202, chiến pháp 343/406, quân sư 39/39, cải tạo 16/16, công trình 41/41, trang bị 0/114, binh thư 0/68). Test dist so file với đầu ra hiện tại.

## Localization

File nguồn trong `policy.sourceFiles` đã sửa → hash cập nhật (`js/hero-portrait.js`, `lookup-detail.js`, `lookup-master.js`, `lookup-page.js`, `lookup-tactic-profile.js`, `recommended-reference-render.js`, `recommended-reference-state.js`, `team-detail.js`, 5 trang `.astro` + `SiteLayout.astro`, `lookup-item-pages.ts`, `lookup-pages.ts`); biểu thức nghĩa vụ `ui:lookup-item/title|description-books|description-troop-mods` đổi theo mã. Chuỗi chạy: `build --stage all` → `check --candidate` (0) → `publish` → `check --stage public` (0) → `prune`; mỗi lần sửa nguồn đã đăng ký phải chạy lại cả chuỗi vì hash nguồn nằm trong publication. Generation Recommended hiện `82e9d065…` (đã prune hai generation trung gian); `pipeline/team-route-handles.json` re-pin (`--check` OK). File mới (`structured-data.ts`, `llms-documents.ts`, `http-source-url.js`, `lookup-effect-panels.js`, route llms) không nằm trong `sourceFiles`; `check` không báo vị trí chưa biết.

## File chính

- Mới: `src/lib/structured-data.ts`, `src/lib/llms-documents.ts`, `src/pages/llms-full.txt.ts`, `src/pages/llms/[...path].txt.ts`, `js/http-source-url.js`, `js/lookup-effect-panels.js`, `scripts/report-zh-gaps.mjs`, `reports/zh-gaps.md`, `tests-js/{seo-dist-contract,lookup-item-page-deps}.test.mjs`.
- Sửa: `js/{lookup-ids,view-tree,recommended-reference-render,recommended-reference-state,hero-portrait,lookup-detail,lookup-master,lookup-page,lookup-tactic-profile,team-detail}.js`, `src/lib/{team-ssr,team-detail-pages,team-section-ssr,lookup-pages,lookup-item-pages,lookup-detail-routes,blog-seo,public-artifact-manifest}.*`, `src/layouts/SiteLayout.astro`, 5 trang `.astro`, `src/pages/llms.txt.ts`, `scripts/verify-astro-dist.mjs`, `pipeline/{lookup_route_handles.py,lookup-route-handles.json,site_localization.py,site-localization-policy.json,team-route-handles.json}` + generation mới, `public/_headers`, `package.json` (`test:dist` thêm `seo-dist-contract`), test liên quan.

## Còn lại / lưu ý

- Docs/changelog (kể cả `docs/design-guidelines.md:109`) là Phase 5.
- `verify-astro-dist.mjs` sinh llms bằng dữ liệu của gốc dự án mặc định (cwd), chỉ khi manifest có cả website-display lẫn bundle Tra cứu (dist thật); fixture rút gọn bỏ qua mục này.
- Mọi trang có team-route-handles nay mang `<script id="lookup-route-handles">{}</script>` (2 byte); trang nhóm lớn nhất `/tra-cuu/chien-phap/` 611 066 B (JSON-LD `ItemList` + bỏ bảng slug 36 153 B).

## Final review fixes

Nguồn: `agent://FinalReview` (7 phát hiện: 3 P2, 4 P3).

| # | Sửa | Bằng chứng |
|---|---|---|
| 1 | `lookupItemJsonLd` (`src/lib/structured-data.ts`) phát `ItemPage` (`url`, `inLanguage`, `isPartOf` `VideoGame`) với `mainEntity` = `Thing`/`DefinedTerm` (`name`, `alternateName`, `description`, `image`, `inDefinedTermSet`); `inLanguage`/`isPartOf` chỉ hợp lệ trên `CreativeWork` nên không còn ở nút `Thing`/`DefinedTerm`. | **Đỏ trước**: `seo-dist-contract` chạy trên dist cũ fail `expected 'ItemPage'`. Xanh sau build: assert đổi sang `page.mainEntity` và khẳng định `mainEntity` không mang `@context`/`url`/`inLanguage`/`isPartOf`. |
| 2 | Bỏ `assert.equal(…, 1366)`/`(…, 886)` trong `seo-dist-contract` (còn `> 0`); các kiểm phủ bên dưới so với `catalog`/`routes`. | Không còn số cứng trong file. |
| 3 | Test không còn đọc `reports/zh-gaps.md`: chỉ kiểm bất biến (`zhGaps` mỗi mục có phần thiếu; báo cáo sinh trong bộ nhớ từ dữ liệu hiện tại có dòng cho từng mục). Script giữ `--check` chạy tay. | `node scripts/report-zh-gaps.mjs --check` khớp (570/886); `test:dist` không phụ thuộc thư mục kế hoạch. |
| 4 | `recommendedFiles` (`src/lib/llms-documents.ts`) sắp hàng theo thứ tự registry mùa (`recommendedSeasonOrder()` mới ở `team-detail-pages.ts`, đọc `seasons.json` `seasonOptions`), sort ổn định nên thứ tự trong mùa giữ nguyên. | `dist/llms.txt`: `og, pk-s28, pk-s27, pk-s26, …` thay cho thứ tự catalog (`pk-s24, s1, pk-s11, …`); `llms-full.txt` vẫn đúng bằng nối file con (test:dist). |
| 5 | `SiteLayout.astro`: trang `detail` + `lookup` (trang riêng mục) không nhúng `#team-route-handles`/`#lookup-route-handles`. Verifier chặn cả hai id trên 1772 trang riêng. | `dist/tra-cuu/tuong/sp-lu-mong/index.html` có 0 lần `route-handles`; e2e `lookup-item-pages` xanh. |
| 6 | `verify-astro-dist.mjs` lấy danh sách mục dựng sẵn từ `PRERENDERED_TEAM_SECTIONS` của `src/lib/team-ssr.ts`; chỉ giữ dấu hiệu nội dung theo mục và ném lỗi khi hai bên lệch khoá (thiếu marker hoặc marker dư). | `npm run verify` xanh. |
| 7 | `tail()` (`src/lib/lookup-item-pages.ts`) không chèn khoảng trắng sau `：` full-width. | `dist/zh/tra-cuu/chien-phap/an-ui-quan-dan/`: `…品质S·指挥）：戰鬥前…`. |

Localization: `SiteLayout.astro` và `lookup-item-pages.ts` nằm trong `policy.sourceFiles` → cập nhật hash trong `pipeline/site-localization-policy.json` (inventory không đổi: `concreteInventorySha256` giữ nguyên); chuỗi `build --stage all --output .cache/build-final-fix.json` → `check --stage all --candidate` (exit 0) → `publish` → `check --stage public` (exit 0) → `prune`; Recommended generation mới `d7d15ecd…` (cũ `82e9d065…` bị prune), re-pin `pipeline/team-route-handles.json` (`--check` OK 1366/166/17). Ledger lookup không đổi (886 mã, `lookup:29322cab13be`).

Docs cập nhật: `docs/{system-architecture,code-standards,codebase-summary,deployment-guide}.md` và mục mới trên cùng của `project-changelog.md` (JSON-LD `ItemPage`, thứ tự mùa llms, bảng route không nhúng ở trang riêng, test zh-gaps chỉ kiểm bất biến).

Kết quả cuối: `npm run build` OK 4917 trang; `npm run verify` OK (5154 file); `npm run test:dist` 49/49; `npm run test:node` 545/545; `python3 -m unittest discover -s tests` 426 OK; `npx playwright test -c playwright.local.config.mjs` 482 passed; `site_localization check --stage public` exitCode 0; `lookup_route_handles --check` và `team_route_handles --check` OK.
