---
phase: 2
title: "Tách đường dẫn + layout chung"
status: pending
priority: P1
effort: "2.5d"
dependencies: [1]
---

# Phase 2: Tách đường dẫn + layout chung

## Goal
Mỗi mục cẩm nang thành một trang tĩnh riêng dùng chung `SiteLayout.astro`; `/` thành Landing có chuyển tiếp hash cũ; mọi link nội bộ, sitemap, headers, verifier, policy bản dịch và test theo mô hình mới. Giao diện header/footer chưa đổi (Phase 3).

## Contract
Brainstorm §10.7 (toàn bộ), §10.4 (nav là tab, test sửa có chủ đích), §11.6 (tách đường dẫn trước header).

## Files to Create / Modify
- Create: `src/pages/doi-chuan/index.astro`, `src/pages/doi-khac/index.astro`, `src/pages/cung-ton/index.astro`, `src/pages/khai-hoang/index.astro`, `src/pages/tra-cuu/index.astro`, `src/pages/chieu-mo/index.astro`, `src/pages/soi-doi/index.astro`, `src/pages/goi-y-doi/index.astro`.
- Create: `js/landing.js` (+ `entry("js","landing")` trong `src/lib/public-artifact-manifest.mjs`).
- Modify: `src/layouts/SiteLayout.astro`, `src/pages/index.astro`, `src/pages/404.astro`, `src/pages/doi-chuan/[team].astro`, `src/pages/doi-khac/[team].astro`, `src/pages/khai-hoang/[team].astro`.
- Modify: `js/app.js`, `js/render.js` (nút "Mở scan / nhập kho" của chi tiết cấu hình, `:569`), `js/unified-lookup.js`, `js/team-detail-navigation.js`, `js/team-detail.js`, `js/khaihoang-detail.js`.
- Modify: `src/pages/sitemap.xml.ts`, `scripts/verify-astro-dist.mjs`, `public/_headers`.
- Modify: `pipeline/site-localization-policy.json` (sections `entrypoints`/`mount`/`sourceFiles`, hash), `pipeline/site_localization.py` (chỉ đường dẫn nguồn của `UI_LITERAL_OBLIGATIONS` có chuỗi dời file), `tests/test_site_localization.py`.
- Modify tests: `tests-e2e/spa-parity.spec.mjs`, `unified-lookup.spec.mjs`, `recommended-browser.spec.mjs`, `season-lookup.spec.mjs`, `team-detail-pages.spec.mjs`, `khaihoang-options.spec.mjs`, `mcp-domain-compatibility.spec.mjs`, `site-localization.spec.mjs`; `tests-js/frontend-shell-contract-assertions.mjs`, `tests-js/team-detail-navigation.test.mjs`, `tests-js/astro-dist-contract.test.mjs`, `tests-js/pages-headers-contract.test.mjs`, `tests-js/unified-lookup.test.mjs`.

## Tasks & Steps
1. **Layout.** `SiteLayout` nhận `pageKind: 'landing' | 'section' | 'detail' | 'not-found'` (bắt buộc, bỏ mặc định `'root'` ở `SiteLayout.astro:19` và biến `isRoot`/`contentClass` ở `:42-43`) và `activeSection` là 1 trong 8 id; gắn `data-section` lên `<body>` khi là trang mục. Bỏ nhánh `root` và danh sách 9 id có `heroes`/`tactics` (`SiteLayout.astro:5-14,25-41,84-93`). Nav: `<a href>` thật tới 8 đường dẫn, mục đang xem có `aria-current="page"`; logo → `/`. `site-chrome.js` chạy trên mọi trang (hiện bị tắt ở root, `:115-121`) — là nơi **duy nhất** gọi `initSiteChrome()`; `app.js` bỏ lời gọi trong `initNav` (`app.js:60`), nếu không nút sáng/tối bị gắn 2 listener và bấm không đổi được theme.
2. **Trang mục.** Mỗi trang: `<SiteLayout pageKind="section" activeSection=… title=… description=… canonicalUrl=…>` + đúng một mount `<section id="section-<id>">` + `<script type="module" src="/js/app.js" slot="scripts">`. `<title>` dạng "<Mục> — Cẩm Nang Game Tam Quốc Chí - Chiến Lược"; mô tả riêng từng mục (chữ mới → UI obligation `authored-vi`). **Payload mà `app.js` đọc** (hiện nằm ở `index.astro:61,77-80`, không nằm trong `:62-75`) phải được layout phát cho trang mục:

   | Payload | Người đọc | Trang mục cần |
   |---|---|---|
   | `#recommended-publication`, `#website-display-publication` | `app.js:153-158` | cả 8 (layout đã phát cho mọi trang, `SiteLayout.astro:110-111`) |
   | `#team-route-handles` đủ `{r,l,k}` (≈70 KB, đo trên `dist/index.html`) | `app.js:135`; `r` cho Đội chuẩn + migrate `detail`, `l` cho Đội khác, `onOpenTeam` Soi đội/Gợi ý đội (`app.js:476`) + migrate `legacyTeam`, `k` cho Khai hoang (`app.js:442`) | cả 8 (một bảng, không chia theo mục — migrate URL cũ có thể tới bất kỳ trang mục nào); trang chi tiết giữ `{l}` như hiện tại (`SiteLayout.astro:46-48`) |
   | `#season-artifact-hashes` | `app.js:188` (thiếu → `seasonModel` rỗng **im lặng**, chỉ hiện `BUNDLE_NOTICE`) | mọi trang có chi tiết cấu hình `?config=` hoặc bộ chọn phạm vi mùa: Đội chuẩn, Đội khác, Cùng Tồn, Soi đội, Gợi ý đội |
   | `<div id="season-controls">` | `app.js:211` (thiếu → `TypeError`, rơi vào catch `:491`, **mọi mục chết**) | 5 trang như dòng trên; `app.js` phải chịu được trang không có phần tử này (Khai hoang, Tra cứu, Chiêu mộ) thay vì gọi `.after` trên `null` |

   Bảng cuối cùng lập từ code và ghi vào báo cáo phase; e2e mở trực tiếp 8 trang, bắt `pageerror`, và kiểm không trang nào hiện `BUNDLE_NOTICE` khi bundle hợp lệ.
3. **`js/app.js`.** Đọc `document.body.dataset.section`; chỉ gọi hàm mount của mục đó (các lời gọi ở `:227,424-425,441-458,471-484`). Xóa `initNav`, `sectionFromHash`, `canonicalizeSectionHash`, `switchSection`, `onSectionRequest`, `surfaceSnapshots` và mọi nhánh hash (`:59-130,216,230,265,278,285-307,320-341,365-385,398,433-436,462-465`); các chỗ đang hỏi `sectionFromHash()` đọc id mục từ `data-section`. Snapshot quay lại theo query mỗi mục vẫn giữ nhưng khóa theo pathname. Link chuyển mục trong nội dung (vd "Mở Cùng Tồn", link chiến pháp sang Tra cứu) đổi thành `<a href>` tới đường dẫn mới + query. Thêm:
   - **Đường dẫn dữ liệu tuyệt đối.** `app.js` đang fetch tương đối `./data/…` (`:146,184,193`) → trên `/doi-chuan/` thành `/doi-chuan/data/…` = 404. Đổi sang `/data/…` như trang chi tiết (`team-detail.js:74`, `khaihoang-detail.js:29`). Tiêu chí: grep `fetch\(\s*[\x60'"]\.\/` và `` `\./data`` trong `js/` = 0.
   - **Phạm vi mùa + chi tiết cấu hình giữ nguyên hành vi** (không có artboard, không bỏ tính năng): bộ chọn Mùa / Phiên bản luật (`scenario`, `ruleset`) hiện ở Cùng Tồn, Soi đội, Gợi ý đội (`placeSeasonControls`, `app.js:100-115` → thành cố định theo trang); chi tiết cấu hình `?config=` trong `#season-detail-mount` (`app.js:210-260`) trên Đội chuẩn, Đội khác, Cùng Tồn, Soi đội, Gợi ý đội. `onImport` (`app.js:258` → nút `render.js:569`) đổi thành link `/goi-y-doi/` giữ `scenario`/`ruleset`. Giao diện của các khối này làm ở Phase 8 (Cùng Tồn) và Phase 9 (Soi đội, Gợi ý đội).
   - **Lỗi tải hiện ở mục đang mở.** Thông báo lỗi chung và lỗi Tra cứu đang ghi vào `#section-team-chuan` / `#section-lookup` bất kể tab (`app.js:179,492-496`) → ghi vào mount của `data-section`; sửa `spa-parity.spec.mjs:468-470` theo.
   - **Migrate URL tham chiếu cũ.** `migrateLegacyReferenceUrl` (`app.js:199-203`, `team-detail-navigation.js:371-392`) giữ nguyên trên mọi trang mục: `?detail=` → trang chi tiết Đội chuẩn, `?legacyTeam=` (+`legacyVariant`) → trang chi tiết Đội khác, `config` luôn thắng (`:378`). `from` sinh ra theo `safeReturnUrl` mới (bước 7).
3b. **Chỉ tải dữ liệu mục cần.** Khởi động hiện tải hết (`js/app.js:154-196`). Lập bảng mục → dữ liệu từ code (ai dùng `teamsSource`, `coexistSource`, `khaihoangSource`, `booksDict`, `lookupBundle`/`catalog` ở `:183`, `teamTier`, `seasonModel`, `recommendedModel`), ghi bảng vào báo cáo phase, rồi tải theo bảng. Đã biết từ code: cả 3 công cụ Beta cần `lookupBundle` (`app.js:481-488`, Chiêu mộ dùng `heroesDict`), nên `/chieu-mo/` **vẫn** tải bộ Tra cứu; Khai hoang và Tra cứu không cần `recommendedModel`. Tải có điều kiện cho migrate: URL có `detail` → tải `recommendedModel` (cần `index.records`, `:200`); có `legacyTeam` → tải `teams.json` (`:201`) — ở bất kỳ trang mục nào. Kiểm bằng e2e đếm request `data/` trên `/khai-hoang/` (không có `data/recommended/`), `/doi-chuan/` (không có `lookup-catalog.json` nếu bảng xác nhận không cần) và `/soi-doi/?detail=<id thật>` (có tải index, rồi chuyển sang trang chi tiết).
4. **Tra cứu:** `group`, `id` chuyển từ hash sang query (`js/unified-lookup.js:27-45,100,129-131,280,350-351`); mở/đóng hồ sơ dùng `pushState`/`replaceState` trên query như hiện nay dùng hash. Parser hiện trả lỗi `unknown-param` với mọi khóa lạ (`:34-36`) — hợp lý với hash riêng, nhưng query là công khai (link chia sẻ có `utm_*`, `fbclid`) → khi đọc từ `location.search` chỉ xét `group`, `id`, bỏ qua khóa khác; vẫn báo lỗi khi `group`/`id` lặp hoặc sai giá trị.
5. **Landing tạm thời trong phase này** = `index.astro` dùng layout `pageKind="landing"`, nội dung là khối "Bạn đang cần gì?" của artboard Landing (link tới các mục) — khối này giữ lại ở Phase 4, không phải stub. Tải `js/landing.js`.
6. **`js/landing.js` — chuyển tiếp hash cũ** bằng `location.replace`, giữ query có sẵn trước hash:

   | Hash cũ | Đích |
   |---|---|
   | `#team-chuan` | `/doi-chuan/` |
   | `#team-khac`, `#team-pk`, `#meta-cu` | `/doi-khac/` (alias thêm `source` đúng như `canonicalizeSectionHash` hiện làm, `js/app.js:84-98`) |
   | `#coexist` | `/cung-ton/` |
   | `#khaihoang` | `/khai-hoang/` |
   | `#lookup`, `#lookup?group=…&id=…` | `/tra-cuu/` + query tương ứng |
   | `#heroes`, `#tactics` | `/tra-cuu/?group=heroes` / `?group=tactics` (giá trị group đúng như `unified-lookup.js:27-45`) |
   | `#recruit-tracker` | `/chieu-mo/` |
   | `#analyze` | `/soi-doi/` |
   | `#roster-recommend` | `/goi-y-doi/` |
   | không có hash, query có khóa của `ROOT_QUERY_KEYS` hoặc `detail`/`legacyTeam`/`legacyVariant` (mục mặc định cũ là Đội chuẩn, `app.js:98`) | `/doi-chuan/` + nguyên query (migrate `detail`/`legacyTeam` chạy ở đó) |
   | không có hash, query chỉ có khóa lạ (`utm_*`, `fbclid`…) hoặc rỗng | ở lại `/` |
   | hash khác | ở lại `/`, không đổi URL |

   Ví dụ: `/?season=s26#team-chuan` → `/doi-chuan/?season=s26`; `/?detail=<id>` → `/doi-chuan/?detail=<id>` → trang chi tiết; `/?config=x&legacyTeam=y#analyze` → `/soi-doi/?config=x&legacyTeam=y` (config thắng, không migrate).
7. **Link quay lại / nội bộ:** `familyReturnHref` → `/doi-chuan/?season=…`, `/doi-khac/`, `/khai-hoang/` (`js/team-detail-navigation.js:149-162`); `safeReturnUrl` nhận đúng 8 pathname mục (bỏ điều kiện pathname `/` + hash, `:7,118-146`); `ROOT_TABS` (`:7`) thành 8 id mục (bỏ `heroes`/`tactics`); `khaiHoangContextKey` đang nhận diện Khai hoang bằng hash `#khaihoang` (`:174-182`) → đổi sang pathname `/khai-hoang/`; trường `tab` của `captureReturnSnapshot` (`:287-305`) lấy id mục từ `data-section`. `src/pages/doi-khac/[team].astro:36`, `src/pages/khai-hoang/[team].astro:31`, `404.astro:16-18` trỏ đường dẫn mới. Viết lại các ca đang ghim URL hash trong `tests-js/team-detail-navigation.test.mjs:163-215` sang đường dẫn mới, giữ nguyên các ca từ chối URL lạ/khác origin (`:171-202`). Grep lại `'/#`, `"/#`, `` `/#`` trong `js/ src/ public/` = 0 kết quả.
8. **Sitemap / verifier / headers:** sitemap thêm 8 đường dẫn (`src/pages/sitemap.xml.ts:30-41,54-60`); verifier thêm 8 `…/index.html` vào danh sách chính xác + kiểm mỗi trang mục nạp `/js/app.js` và Landing nạp `/js/landing.js` (`scripts/verify-astro-dist.mjs:63-98,155-202`); `_headers` thêm rule cho `/cung-ton/*`, `/tra-cuu/*`, `/chieu-mo/*`, `/soi-doi/*`, `/goi-y-doi/*` cùng chính sách HTML như `/doi-chuan/*` (`public/_headers:7-11`); `/doi-chuan/`, `/doi-khac/`, `/khai-hoang/` đã được rule họ đó bao.
9. **Policy bản dịch:** mỗi section đổi `entrypoints` sang trang mục mới, `mount` giữ `section-<id>`; thêm 8 trang + `js/landing.js` vào `sourceFiles`; obligation có chuỗi dời từ `index.astro` sang `SiteLayout.astro`/trang mục → sửa đường dẫn nguồn, **không đổi chữ**. Vẫn đúng 8 section, 3 route family.
10. **Test chuyển có chủ đích:** tab/tabpanel → link + `aria-current`; điều hướng hash → điều hướng đường dẫn; thêm ca e2e cho từng dòng bảng chuyển tiếp (gồm alias, query trước hash, hash lạ, URL không hash có/không có khóa root) và cho quay lại từ trang chi tiết về đúng trang mục + query + vị trí cuộn. Chuyển các ca migrate/ưu tiên `config` (`recommended-browser.spec.mjs:81-102`) và phạm vi mùa/chi tiết cấu hình (`season-lookup.spec.mjs:23-49,139-151,155,168,183,190,201-207,231,246,322,330`) sang đường dẫn mới, **không đổi assertion hành vi**. Xóa assertion chỉ còn ý nghĩa với mô hình tab (vd phím mũi tên giữa tab, `spa-parity.spec.mjs:121-125`; giữ query riêng từng tab khi đổi tab, `recommended-browser.spec.mjs:51-55,123-131` — nay là điều hướng trang thường).

## Verification
- `npm run check && npm run build && npm run verify && npm run test:dist`
- `node --experimental-strip-types --test tests-js/team-detail-navigation.test.mjs tests-js/astro-dist-contract.test.mjs tests-js/pages-headers-contract.test.mjs tests-js/unified-lookup.test.mjs`
- `npm run test:e2e`
- `python3 -m unittest discover -s tests -p test_site_localization.py -v` + `python3 -m pipeline.site_localization check --root . --stage public`
- Trình duyệt: mở trực tiếp 8 đường dẫn + reload, không `pageerror`, không `BUNDLE_NOTICE`, Network không có request 404 dưới `/<mục>/data/`; mở `/#heroes`, `/?season=…#team-chuan`, `/?detail=<id thật>`, `/#xyz`; từ `/doi-chuan/?faction=…` vào chi tiết rồi Back; `/cung-ton/?config=<id>` mở chi tiết cấu hình, nút nhập kho tới `/goi-y-doi/` giữ `scenario`/`ruleset`.
