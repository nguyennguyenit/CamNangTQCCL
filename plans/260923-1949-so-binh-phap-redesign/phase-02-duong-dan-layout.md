---
phase: 2
title: "Tách đường dẫn + layout chung"
status: completed
priority: P1
effort: "3.5d"
dependencies: [1]
---

# Phase 2: Tách đường dẫn + layout chung

## Goal
Mỗi mục cẩm nang thành một trang tĩnh riêng dùng chung `SiteLayout.astro`; `/` thành Landing có chuyển tiếp hash cũ; mọi link nội bộ, sitemap, headers, verifier, policy bản dịch và test theo mô hình mới. Giao diện header/footer chưa đổi (Phase 3).

## Contract
Brainstorm §10.7 (toàn bộ), §10.4 (nav là tab, test sửa có chủ đích), §11.6 (tách đường dẫn trước header).

## Files to Create / Modify
- Create: `src/pages/doi-chuan/index.astro`, `src/pages/doi-khac/index.astro`, `src/pages/cung-ton/index.astro`, `src/pages/khai-hoang/index.astro`, `src/pages/tra-cuu/index.astro`, `src/pages/chieu-mo/index.astro`, `src/pages/soi-doi/index.astro`, `src/pages/goi-y-doi/index.astro`.
- Create: `js/legacy-routes.js` (+ `entry("js","legacy-routes")` trong `src/lib/public-artifact-manifest.mjs`) — bảng hash cũ → đường dẫn mới + `resolveLegacyRoute(href, origin)`, ESM thuần không import (plan.md quyết định #3). Create: `tests-js/legacy-routes.test.mjs`.
- Modify: `src/layouts/SiteLayout.astro`, `src/pages/index.astro`, `src/pages/404.astro`, `src/pages/doi-chuan/[team].astro`, `src/pages/doi-khac/[team].astro`, `src/pages/khai-hoang/[team].astro`.
- Modify: `js/app.js`, `js/render.js` (nút "Mở scan / nhập kho" của chi tiết cấu hình, `:569`), `js/unified-lookup.js`, `js/team-detail-navigation.js`, `js/team-detail.js`, `js/khaihoang-detail.js`, `js/site-chrome.js` (theme `pageshow`/`storage`).
- Modify: `src/pages/sitemap.xml.ts`, `scripts/verify-astro-dist.mjs`, `public/_headers`.
- Modify: `pipeline/site-localization-policy.json` (sections `entrypoints`/`mount`, `sourceFiles`, `baseline.notes`), `pipeline/site_localization.py` (`UI_LITERAL_OBLIGATIONS`, bước 9), `pipeline/site-translations.json` + `pipeline/site-translation-reviews.json` (chỉ theo receipt độc lập), `pipeline/team-route-handles.json` (`generationId` sau publish), generation mới dưới `src/data/recommended-reference/`, `data/website-display.json`, `tests/test_site_localization.py`.
- Modify tests: `tests-e2e/spa-parity.spec.mjs`, `unified-lookup.spec.mjs`, `recommended-browser.spec.mjs`, `season-lookup.spec.mjs`, `team-detail-pages.spec.mjs`, `khaihoang-options.spec.mjs`, `mcp-domain-compatibility.spec.mjs`, `site-localization.spec.mjs`; `tests-js/frontend-shell-contract-assertions.mjs`, `tests-js/team-detail-navigation.test.mjs`, `tests-js/astro-dist-contract.test.mjs` (fixture: payload chuyển từ `index.html` sang trang mục, `:117-118,907-910,960-961`), `tests-js/pages-headers-contract.test.mjs`, `tests-js/unified-lookup.test.mjs` (`:529-542` đọc `src/pages/index.astro`).

## Tasks & Steps
1. **Layout.** `SiteLayout` nhận `pageKind: 'landing' | 'section' | 'detail' | 'not-found'` (bắt buộc, bỏ mặc định `'root'` ở `SiteLayout.astro:19` và biến `isRoot`/`contentClass` ở `:42-43`) và `activeSection` là 1 trong 8 id; gắn `data-page-section="<id>"` lên `<body>` khi là trang mục (không dùng `data-section`: nav đã dùng, `:90`; locator không phạm vi như `season-lookup.spec.mjs:47` và `frontend-shell-contract-assertions.mjs:30` sẽ trùng). Bỏ nhánh `root` và danh sách 9 id có `heroes`/`tactics` (`:5-14,25-41,84-93`). Nav: `<a href>` thật tới 8 đường dẫn, mục đang xem có `aria-current="page"`; logo → `/`. Giữ `.top-header` (sticky, `css/styles.css:69-74`; `app.js:224` và `season-lookup.spec.mjs:368` đo nó). Tagline tĩnh theo trang lấy đúng 3 chuỗi đang có ở `app.js:127` ("Khai hoang — dữ liệu mới nhất", "Duyệt đội hình theo mùa nguồn", "Tra cứu đội hình theo kịch bản"; không phải UI obligation) — giữ `season-lookup.spec.mjs:49`.
   **Theme** (plan.md quyết định #13): script inline chặn trong `<head>` trước stylesheet đặt `data-theme` từ `localStorage.theme`, lỗi storage/không có giá trị → `prefers-color-scheme`; bỏ `data-theme="light"` cứng (`SiteLayout.astro:51`). `site-chrome.js` là nơi **duy nhất** gắn nút đổi (bỏ lời gọi trong `initNav`, `app.js:60`), chạy trên mọi trang (hiện tắt ở root, `:115-121`), áp lại theme ở `pageshow` và sự kiện `storage`.
2. **Trang mục.** Mỗi trang: `<SiteLayout pageKind="section" activeSection=… title=… description=… canonicalUrl=…>` + đúng một mount `<section id="section-<id>">` + `<script type="module" src="/js/app.js" slot="scripts">`. `<title>` dạng "<Mục> — Cẩm Nang Game Tam Quốc Chí - Chiến Lược"; mô tả riêng từng mục (chữ mới → UI obligation `authored-vi`). **Payload mà `app.js` đọc** (hiện ở `index.astro:61,77-80`, không nằm trong `:62-75`) phải được layout phát cho trang mục:

   | Payload | Người đọc | Trang cần |
   |---|---|---|
   | `#recommended-publication`, `#website-display-publication` | `app.js:153-158` | mọi trang (layout đã phát, `SiteLayout.astro:110-111`) |
   | `#team-route-handles` đủ `{r,l,k}` (≈70 KB) | `app.js:135`; `r` Đội chuẩn + migrate `detail`, `l` Đội khác + `onOpenTeam` (`app.js:476`) + migrate `legacyTeam`, `k` Khai hoang (`app.js:442`) | cả 8 trang mục; trang chi tiết giữ `{l}` (`SiteLayout.astro:46-48`); **Landing không có** |
   | `#season-artifact-hashes` | `app.js:188` (thiếu → `seasonModel` rỗng **im lặng**, chỉ hiện `BUNDLE_NOTICE`) | Đội chuẩn, Đội khác, Cùng Tồn, Soi đội, Gợi ý đội; **Landing không có** |
   | `<div id="season-controls">` | `app.js:211,400` (thiếu → `TypeError`, rơi vào catch `:491`, **mọi mục chết**) | 5 trang như dòng trên; `app.js` bỏ qua phần phạm vi mùa khi trang không có phần tử (Khai hoang, Tra cứu, Chiêu mộ) |

   Bảng cuối cùng lập từ code và ghi vào báo cáo phase. `app.js` gắn `document.body.dataset.boot = 'ready'` sau khi mount xong (kể cả nhánh lỗi) làm tín hiệu cho e2e.
3. **`js/app.js`.** Đọc `document.body.dataset.pageSection`; chỉ gọi hàm mount của mục đó (các lời gọi ở `:227,424-425,441-458,471-484`). Xóa `initNav`, `sectionFromHash`, `canonicalizeSectionHash`, `switchSection`, `onSectionRequest`, `surfaceSnapshots` và mọi nhánh hash (`:59-130,216,230,265,278,285-307,320-341,365-385,398,433-436,462-465`); các chỗ đang hỏi `sectionFromHash()` đọc id mục từ `data-page-section`. Link chuyển mục trong nội dung (vd "Mở Cùng Tồn", link chiến pháp sang Tra cứu) đổi thành `<a href>` tới đường dẫn mới + query dựng bằng `URLSearchParams`. `openConfig` (`:224`) chịu được thiếu `.top-header` (null → offset 0). Thêm:
   - **Đường dẫn dữ liệu tuyệt đối.** `app.js` fetch tương đối `./data/…` (`:146,184,193`) → trên `/doi-chuan/` thành `/doi-chuan/data/…` = 404. Đổi sang `/data/…` như trang chi tiết (`team-detail.js:74`, `khaihoang-detail.js:29`). Tiêu chí: grep `fetch\(\s*[\x60'"]\.\/` và `` `\./data`` trong `js/` = 0.
   - **Phạm vi mùa + chi tiết cấu hình giữ nguyên hành vi** (không có artboard, không bỏ tính năng): bộ chọn Mùa / Phiên bản luật (`scenario`, `ruleset`) ở Cùng Tồn, Soi đội, Gợi ý đội (`placeSeasonControls`, `app.js:100-115` → cố định theo trang); chi tiết `?config=` trong `#season-detail-mount` (`app.js:210-260`) trên Đội chuẩn, Đội khác, Cùng Tồn, Soi đội, Gợi ý đội. `onImport` (`app.js:258` → nút `render.js:569`) đổi thành link `/goi-y-doi/` giữ `scenario`/`ruleset`. Giao diện làm ở Phase 8 và Phase 9.
   - **Lỗi tải hiện ở mục đang mở.** Lỗi chung và lỗi Tra cứu đang ghi vào `#section-team-chuan` / `#section-lookup` bất kể tab (`app.js:179,492-496`) → ghi vào mount của trang; sửa `spa-parity.spec.mjs:468-470` theo. Giữ **nguyên văn** biểu thức `displayValue(websiteDisplay, "ui:app/load-error", "errorTemplate")` và tiêu đề `title:'Đội chuẩn'` / `title:'Đội khác'` trong `app.js` (obligation `ui:app/load-error`, `ui:app/team-chuan-title`, `ui:app/team-khac-title`).
   - **Migrate URL tham chiếu cũ.** `migrateLegacyReferenceUrl` (`app.js:199-203`, `team-detail-navigation.js:371-392`) giữ nguyên trên mọi trang mục: `?detail=` → chi tiết Đội chuẩn, `?legacyTeam=` (+`legacyVariant`) → chi tiết Đội khác, `config` luôn thắng (`:378`).
   - **Dọn khóa theo dõi:** khi khởi động, `replaceState` bỏ `fbclid`, `gclid`, `msclkid`, `utm_*` khỏi URL trang mục (không đổi khóa khác).
3b. **Tải dữ liệu giữ nguyên, chỉ đo** (plan.md quyết định #1). Không lập bảng tải theo mục, không đổi `js/website-display.js`. Đo bằng Playwright: tổng byte truyền và số request `data/` khi mở trang mục đầu tiên (cache trống) và trang mục thứ hai (cùng phiên, phải là revalidate/304), ghi vào báo cáo phase. Đây là số liệu cho quyết định tối ưu sau, không phải assertion.
4. **Tra cứu:** `group`, `id` chuyển từ hash sang query (`js/unified-lookup.js:27-45,100,129-131,280,350-351`); mở/đóng hồ sơ dùng `pushState`/`replaceState` trên query như hiện dùng hash. Parser hiện trả lỗi `unknown-param` với mọi khóa lạ (`:34-36`) → khi đọc từ `location.search` chỉ xét `group`, `id`, bỏ qua khóa khác; vẫn báo lỗi khi `group`/`id` lặp hoặc sai giá trị. Link giữ query khác khi `pushState` (dựng bằng `URLSearchParams`).
5. **Landing tạm thời trong phase này** = `index.astro` dùng layout `pageKind="landing"`, nội dung là khối "Bạn đang cần gì?" của artboard Landing (link tới các mục) — giữ lại ở Phase 4, không phải stub. Landing không có `#team-route-handles`, `#season-artifact-hashes`, không nạp `app.js`.
6. **Chuyển tiếp hash cũ** (`js/legacy-routes.js`, nhúng inline chặn trong `<head>` của `index.astro` + listener `hashchange` để link cũ dán vào tab đang ở `/` cũng chuyển): `location.replace` tới đích cùng origin, giữ query có sẵn trước hash. Khóa "root cũ" là **danh sách đông cứng trong `js/legacy-routes.js`** = `ROOT_QUERY_KEYS` hiện tại (`team-detail-navigation.js:14`, gồm `score`, `tier`, `stars`) + `detail`, `legacyTeam`, `legacyVariant` — không đọc `ROOT_QUERY_KEYS` sống (Phase 5 sẽ đổi nó).

   | Hash cũ | Đích |
   |---|---|
   | `#team-chuan` | `/doi-chuan/` |
   | `#team-khac`, `#team-pk`, `#meta-cu` | `/doi-khac/` (alias thêm `source` đúng như `canonicalizeSectionHash` hiện làm, `js/app.js:83-92`) |
   | `#coexist` | `/cung-ton/` |
   | `#khaihoang` | `/khai-hoang/` |
   | `#lookup`, `#lookup?group=…&id=…` | `/tra-cuu/` + chỉ `group`, `id` từ hash (đọc qua `URLSearchParams`, khóa khác trong hash bỏ) gộp với query ngoài |
   | `#heroes`, `#tactics` | `/tra-cuu/?group=heroes` / `?group=tactics` (giá trị group đúng như `unified-lookup.js:27-45`) |
   | `#recruit-tracker` | `/chieu-mo/` |
   | `#analyze` | `/soi-doi/` |
   | `#roster-recommend` | `/goi-y-doi/` |
   | `#nguon-du-lieu`, `#tai-game`, `#dau-trang` | ở lại, để trình duyệt cuộn tới anchor (Phase 3/4) |
   | không có hash, query có khóa "root cũ" (mục mặc định cũ là Đội chuẩn, `app.js:93-98`; SPA cũ không ghi hash cho mục mặc định, `:129`) | `/doi-chuan/` + nguyên query (migrate `detail`/`legacyTeam` chạy ở đó) |
   | không có hash, query chỉ có khóa lạ (`utm_*`, `fbclid`…) hoặc rỗng | ở lại `/` |
   | hash khác | ở lại `/`, không đổi URL |

   Ví dụ: `/?season=s26#team-chuan` → `/doi-chuan/?season=s26`; `/?score=113` → `/doi-chuan/?score=113` (Phase 5 bỏ `score` ở đó); `/?detail=<id>` → `/doi-chuan/?detail=<id>` → trang chi tiết; `/?config=x&legacyTeam=y#analyze` → `/soi-doi/?config=x&legacyTeam=y` (config thắng). Test đơn vị `tests-js/legacy-routes.test.mjs` phủ mọi dòng bảng + hash thù địch: `#lookup?id=javascript:alert(1)`, `#lookup//evil.example`, `#%2F%2Fevil.example`, `#lookup?group=x&next=https://evil.example` → đích luôn cùng origin, pathname thuộc tập 8 trang mục hoặc `null`.
7. **Link quay lại / nội bộ** (`js/team-detail-navigation.js`):
   - `familyReturnHref` → `/doi-chuan/?season=…`, `/doi-khac/`, `/khai-hoang/` (`:149-162`). `ROOT_TABS` (`:7`) thành 8 id mục.
   - `safeReturnUrl` (`:118-146`): nhận pathname thuộc 8 trang mục; **pathname `/` + hash cũ** → chuẩn hóa qua `resolveLegacyRoute` rồi xét như URL mới (link chi tiết đã chia sẻ trước cutover có `from=/…#<tab>`, đọc ở `team-detail.js:24-26`, `khaihoang-detail.js:58-59`). Query: **giữ** khóa được phép của đúng trang, **bỏ lặng lẽ** mọi khóa khác (thay cho `return null` ở `:142`); bỏ hash của URL mục. Khóa được giữ theo pathname: Đội chuẩn/Đội khác = khóa bộ lọc đội (plan.md quyết định #2; `view` thêm ở Phase 5) + `scenario`, `ruleset`, `config`; Cùng Tồn/Soi đội/Gợi ý đội = `GAMEPLAY_PARAMS` (`app.js:281`) + `scenario`, `ruleset` (`group` thêm ở Phase 8); Khai hoang = `khTeam`, `khVariant`; Tra cứu = `group`, `id`; Chiêu mộ = không khóa nào. Vẫn từ chối: khác origin, `//`, ký tự điều khiển, pathname ngoài tập (`/doi-khac/tan-ngo-thuong/` → `null`, `:171-202`).
   - `khaiHoangContextKey` nhận diện bằng pathname `/khai-hoang/` thay hash (`:174-182`); snapshot `sessionStorage` cũ (`url:"/#khaihoang"`) cũng chuẩn hóa qua `safeReturnUrl` nên vẫn khớp. Trường `tab` của `captureReturnSnapshot` (`:287-305`) lấy id từ `data-page-section`.
   - `src/pages/doi-khac/[team].astro:36`, `src/pages/khai-hoang/[team].astro:31`, `404.astro:16-18` trỏ đường dẫn mới. Grep `/#(team-chuan|team-khac|team-pk|meta-cu|coexist|khaihoang|lookup|heroes|tactics|recruit-tracker|analyze|roster-recommend)\b` trong `js/ src/ public/` = 0 (ngoại trừ bảng trong `js/legacy-routes.js`); anchor Landing `/#nguon-du-lieu`, `/#tai-game` được phép.
   - `tests-js/team-detail-navigation.test.mjs:163-215`: ca đang ghim URL hash chuyển thành ca **chuẩn hóa** `from` cũ; thêm ca `fbclid`/`utm_*` bị bỏ mà giữ `faction`; giữ mọi ca từ chối URL lạ/khác origin.
8. **Sitemap / verifier / headers:**
   - Sitemap thêm 8 đường dẫn (`src/pages/sitemap.xml.ts:30-41,54-60`); verifier tự theo vì gọi cùng `sitemapDocument()` (`scripts/verify-astro-dist.mjs:94-97`).
   - Verifier: thêm 8 `…/index.html` vào danh sách chính xác (`:63-89`); **chuyển** các kiểm đang đọc `dist/index.html` — pin Recommended (`:124-135`), pin website-display (`:136-141`), `#team-route-handles` khớp catalog `{r,l,k}` (`:142-153`), `#season-artifact-hashes` khớp generation (`:239-246`) — sang vòng lặp trên trang mục theo bảng payload bước 2; kiểm Landing **không** chứa `#team-route-handles`, `#season-artifact-hashes`, không nạp `/js/app.js`, có script chuyển tiếp inline; mỗi trang mục nạp `/js/app.js`. Cập nhật fixture `tests-js/astro-dist-contract.test.mjs` theo.
   - `_headers` thêm rule cho `/cung-ton/*`, `/tra-cuu/*`, `/chieu-mo/*`, `/soi-doi/*`, `/goi-y-doi/*` cùng chính sách HTML như `/doi-chuan/*` (`public/_headers:7-11`).
9. **Policy bản dịch** (theo plan.md "Quy trình bắt buộc mỗi phase" bước 2): mỗi section đổi `entrypoints` sang trang mục mới, `mount` giữ `section-<id>`; thêm 8 trang + `js/legacy-routes.js` vào `sourceFiles`. Sáu obligation `translate` gắn `src/pages/index.astro` (`site_localization.py:296-299,329-330`) xử lý **không dời file** để khỏi đổi fingerprint:

   | Obligation | Chữ đã duyệt (ledger) | Cách giữ |
   |---|---|---|
   | `ui:root/brand` | "Cẩm Nang Game Tam Quốc Chí - Chiến Lược" | `<title>`/`og:title` Landing trong `index.astro` |
   | `ui:root/meta-description` | "Tổng hợp đội hình meta" | mô tả Landing trong `index.astro` giữ cụm này |
   | `ui:root/team-chuan`, `ui:root/team-khac` | "Đội chuẩn", "Đội khác" | khối "Bạn đang cần gì?" trong `index.astro` |
   | `ui:root/beta` | "Thử nghiệm" hoặc `>Beta<` | nhãn Beta của thẻ công cụ trong `index.astro` |
   | `ui:root/build-credit` | "Được xây dựng bởi" / "Build bởi" | footer chuyển vào layout, đã có `ui:layout/build-credit` cùng chữ → **bỏ** (không cần receipt mới): xóa dòng tuple khỏi `UI_LITERAL_OBLIGATIONS`, xóa mục ledger `ui:root/build-credit` trong `pipeline/site-translations.json`, bỏ đúng item đó khỏi batch `site-review-v5-080` trong `pipeline/site-translation-reviews.json` (batch còn 3 item; file output của reviewer giữ nguyên — receipt chỉ phải phủ các vị trí còn trong ledger, `site_localization.py:1137-1140`) |

   **Đã chạy thử 2026-09-25 trên worktree tạm** (bỏ `ui:root/build-credit` như trên): `check --stage public` chỉ báo baseline inventory lệch (56265 → 56264, không lỗi receipt/fingerprint) → cập nhật `baseline.notes` → chỉ báo `data/website-display.json` lệch → `build` → `check --candidate` → `publish` → `check --stage public` exit 0 → re-pin `team-route-handles.json` → `team_route_handles --check` pass; `index.json` generation mới giống hệt từng byte generation cũ. `tests/test_site_localization.py` đỏ đúng 3 số ghim: `uiPending`/`uiValues` 69 → 68, site obligations 2089 → 2088, tổng 5592 → 5591 → cập nhật cùng commit.

   Khi viết lại ghi JSON giữ nguyên định dạng file gốc (ledger và policy không được đổi khoảng trắng hàng loạt). Nhãn nav trong `SECTIONS` phải còn trong `SiteLayout.astro` (obligation `ui:layout/*`, `:300-303`); không chuyển sang file khác. Vẫn đúng 8 section, 3 route family. Chạy đủ bước 2b–e (baseline, publish, re-pin `team-route-handles.json`, số ghim test).
10. **Test chuyển có chủ đích:**
    - Tab/tabpanel → link + `aria-current`; điều hướng hash → điều hướng đường dẫn; ca e2e cho từng dòng bảng chuyển tiếp (gồm alias, query trước hash, hash lạ, URL không hash có/không có khóa root cũ, `/?score=113`, dán hash cũ khi đang ở `/`); quay lại từ trang chi tiết về đúng trang mục + query + vị trí cuộn; link chi tiết cũ có `from=/?…#team-chuan` quay về `/doi-chuan/?…`; `/doi-chuan/?fbclid=x&faction=…` → chi tiết → Back giữ bộ lọc + cuộn.
    - `waitForBoot` (`spa-parity.spec.mjs:126-129`, `mcp-domain-compatibility.spec.mjs:3-5`) đang chờ `#season-scenario` + script Turnstile — chỉ đúng trên 2–5 trang → đổi sang chờ `body[data-boot="ready"]`; điều kiện Turnstile giữ riêng cho `/soi-doi/`, `/goi-y-doi/`.
    - Chuyển các ca migrate/ưu tiên `config` (`recommended-browser.spec.mjs:81-102`) và phạm vi mùa/chi tiết cấu hình (`season-lookup.spec.mjs:23-49,139-151,155,168,183,190,201-207,231,246,322,330`) sang đường dẫn mới, **không đổi assertion hành vi**. Snapshot seed trong `spa-parity.spec.mjs:29,323,340` (`url:"/#khaihoang"`) giữ nguyên để kiểm chuẩn hóa snapshot cũ, thêm bản sao dạng `/khai-hoang/`.
    - `recommended-browser.spec.mjs:123-131` **chuyển**, không xóa: `/doi-chuan/?q=sentinel` → `/doi-khac/` → Back → ô tìm có `sentinel`. Chỉ xóa assertion thuần tab: phím mũi tên giữa tab (`spa-parity.spec.mjs:121-125`), facet không rò giữa tab (`recommended-browser.spec.mjs:51-55`).
    - Theme: `localStorage.theme='dark'` → mở `/doi-chuan/` → `data-theme` đã là `dark` lúc `DOMContentLoaded`; đổi sang sáng ở `/doi-khac/` → Back → `data-theme` là `light`.

## Verification
- Gate đầy đủ (plan.md "Quy trình bắt buộc mỗi phase" bước 3).
- `node --experimental-strip-types --test tests-js/legacy-routes.test.mjs tests-js/team-detail-navigation.test.mjs tests-js/astro-dist-contract.test.mjs tests-js/pages-headers-contract.test.mjs tests-js/unified-lookup.test.mjs`
- `python3 -m pipeline.team_route_handles --check`; `python3 -m pipeline.site_localization check --root . --stage public`.
- Trình duyệt: mở trực tiếp 8 đường dẫn + reload, không `pageerror`, không `BUNDLE_NOTICE`, Network không có 404 dưới `/<mục>/data/`; mở `/#heroes`, `/?season=…#team-chuan`, `/?detail=<id thật>`, `/#xyz`; dán `/#analyze` khi đang ở `/`; từ `/doi-chuan/?faction=…` vào chi tiết rồi Back; `/cung-ton/?config=<id>` mở chi tiết cấu hình, nút nhập kho tới `/goi-y-doi/` giữ `scenario`/`ruleset`; theme tối không nháy khi chuyển trang.
- Báo cáo phase: bảng payload, số đo tải bước 3b, danh sách obligation đổi + receipt, `baseline.notes` cũ → mới, generation mới.
