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
- Modify: `js/app.js`, `js/unified-lookup.js`, `js/team-detail-navigation.js`, `js/team-detail.js`, `js/khaihoang-detail.js`.
- Modify: `src/pages/sitemap.xml.ts`, `scripts/verify-astro-dist.mjs`, `public/_headers`.
- Modify: `pipeline/site-localization-policy.json` (sections `entrypoints`/`mount`/`sourceFiles`, hash), `pipeline/site_localization.py` (chỉ đường dẫn nguồn của `UI_LITERAL_OBLIGATIONS` có chuỗi dời file), `tests/test_site_localization.py`.
- Modify tests: `tests-e2e/spa-parity.spec.mjs`, `unified-lookup.spec.mjs`, `recommended-browser.spec.mjs`, `season-lookup.spec.mjs`, `team-detail-pages.spec.mjs`, `khaihoang-options.spec.mjs`, `mcp-domain-compatibility.spec.mjs`, `site-localization.spec.mjs`; `tests-js/frontend-shell-contract-assertions.mjs`, `tests-js/team-detail-navigation.test.mjs`, `tests-js/astro-dist-contract.test.mjs`, `tests-js/pages-headers-contract.test.mjs`, `tests-js/unified-lookup.test.mjs`.

## Tasks & Steps
1. **Layout.** `SiteLayout` nhận `pageKind: 'landing' | 'section' | 'detail' | 'not-found'` (bắt buộc, bỏ mặc định `'root'` ở `SiteLayout.astro:19` và biến `isRoot`/`contentClass` ở `:42-43`) và `activeSection` là 1 trong 8 id; gắn `data-section` lên `<body>` khi là trang mục. Bỏ nhánh `root` và danh sách 9 id có `heroes`/`tactics` (`SiteLayout.astro:5-14,25-41,84-93`). `legacyRouteSegments` (`:46-48`) hiện chỉ nạp cho `detail` — trang mục Đội khác cần bảng này để dựng link chi tiết thì mở rộng điều kiện sang `section` của `team-khac`, kiểm lại bằng code tạo link trong `app.js`. Nav: `<a href>` thật tới 8 đường dẫn, mục đang xem có `aria-current="page"`; logo → `/`. `site-chrome.js` chạy trên mọi trang (hiện bị tắt ở root, `:115-121`).
2. **Trang mục.** Mỗi trang: `<SiteLayout pageKind="section" activeSection=… title=… description=…>` + đúng một mount `<section id="section-<id>">` (chuyển nguyên markup mount/notice từ `index.astro:62-75`) + `<script type="module" src="/js/app.js" slot="scripts">`. `<title>` dạng "<Mục> — Cẩm Nang Game Tam Quốc Chí - Chiến Lược"; mô tả riêng từng mục (chữ mới → UI obligation `authored-vi`).
3. **`js/app.js`.** Đọc `document.body.dataset.section`; chỉ gọi hàm mount của mục đó (các lời gọi ở `:227,424-425,441-458,471-484`). Xóa `initNav`, `sectionFromHash`, `canonicalizeSectionHash`, `switchSection`, `onSectionRequest` và mọi nhánh hash (`:59-130,216,230,265,278,285-307,320-341,365-385,398,433-436,462-465`). Snapshot theo query mỗi mục vẫn giữ nhưng khóa theo pathname. Link chuyển mục trong nội dung (vd "Mở Cùng Tồn", link chiến pháp sang Tra cứu) đổi thành `<a href>` tới đường dẫn mới + query.
3b. **Chỉ tải dữ liệu mục cần.** Khởi động hiện tải hết (`js/app.js:154-196`). Lập bảng mục → dữ liệu từ code (ai dùng `teamsSource`, `coexistSource`, `khaihoangSource`, `booksDict`, `lookupBundle`/`catalog` ở `:183`, `teamTier`, `seasonModel`, `recommendedModel`), ghi bảng vào báo cáo phase, rồi tải theo bảng. Mục không cần dữ liệu nào (vd Chiêu mộ nếu đúng vậy) không được fetch bộ Tra cứu. Kiểm bằng e2e đếm request `data/` trên `/chieu-mo/` và `/doi-chuan/`.
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
   | hash khác | ở lại `/`, không đổi URL |

   Ví dụ: `/?season=s26#team-chuan` → `/doi-chuan/?season=s26`.
7. **Link quay lại / nội bộ:** `familyReturnHref` → `/doi-chuan/?season=…`, `/doi-khac/`, `/khai-hoang/` (`js/team-detail-navigation.js:149-162`); `safeReturnUrl` nhận đúng 8 pathname mục (bỏ điều kiện pathname `/` + hash, `:7,118-146`); `khaiHoangContextKey` đang nhận diện Khai hoang bằng hash `#khaihoang` (`:174-182`) → đổi sang pathname `/khai-hoang/`; trường `tab` của `captureReturnSnapshot` (`:287-305`) lấy id mục từ `data-section`. `src/pages/doi-khac/[team].astro:36`, `src/pages/khai-hoang/[team].astro:31`, `404.astro:16-18` trỏ đường dẫn mới. Viết lại các ca đang ghim URL hash trong `tests-js/team-detail-navigation.test.mjs:163-215` sang đường dẫn mới, giữ nguyên các ca từ chối URL lạ/khác origin (`:171-202`). Grep lại `'/#`, `"/#`, `` `/#`` trong `js/ src/ public/` = 0 kết quả.
8. **Sitemap / verifier / headers:** sitemap thêm 8 đường dẫn (`src/pages/sitemap.xml.ts:30-41,54-60`); verifier thêm 8 `…/index.html` vào danh sách chính xác + kiểm mỗi trang mục nạp `/js/app.js` và Landing nạp `/js/landing.js` (`scripts/verify-astro-dist.mjs:63-98,155-202`); `_headers` thêm rule cho `/cung-ton/*`, `/tra-cuu/*`, `/chieu-mo/*`, `/soi-doi/*`, `/goi-y-doi/*` cùng chính sách HTML như `/doi-chuan/*` (`public/_headers:7-11`); `/doi-chuan/`, `/doi-khac/`, `/khai-hoang/` đã được rule họ đó bao.
9. **Policy bản dịch:** mỗi section đổi `entrypoints` sang trang mục mới, `mount` giữ `section-<id>`; thêm 8 trang + `js/landing.js` vào `sourceFiles`; obligation có chuỗi dời từ `index.astro` sang `SiteLayout.astro`/trang mục → sửa đường dẫn nguồn, **không đổi chữ**. Vẫn đúng 8 section, 3 route family.
10. **Test chuyển có chủ đích:** tab/tabpanel → link + `aria-current`; điều hướng hash → điều hướng đường dẫn; thêm ca e2e cho từng dòng bảng chuyển tiếp (gồm alias, query trước hash, hash lạ) và cho quay lại từ trang chi tiết về đúng trang mục + query + vị trí cuộn. Xóa assertion chỉ còn ý nghĩa với mô hình tab (vd phím mũi tên giữa tab, `spa-parity.spec.mjs:121-125`).

## Verification
- `npm run check && npm run build && npm run verify && npm run test:dist`
- `node --experimental-strip-types --test tests-js/team-detail-navigation.test.mjs tests-js/astro-dist-contract.test.mjs tests-js/pages-headers-contract.test.mjs tests-js/unified-lookup.test.mjs`
- `npm run test:e2e`
- `python3 -m unittest discover -s tests -p test_site_localization.py -v` + `python3 -m pipeline.site_localization check --root . --stage public`
- Trình duyệt: mở trực tiếp 8 đường dẫn + reload; mở `/#heroes`, `/?season=…#team-chuan`, `/#xyz`; từ `/doi-chuan/?faction=…` vào chi tiết rồi Back.
