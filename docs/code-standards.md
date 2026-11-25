# Chuẩn code và dữ liệu

## Tổng quan

Chuẩn dự án ưu tiên YAGNI, KISS, DRY; thay đổi nhỏ, test được và giữ đúng ba boundary: static frontend, pipeline offline, Worker. Bám pattern đang có trước khi tạo abstraction hoặc dependency mới.

## Frontend JavaScript

- `src/layouts/SiteLayout.astro` sở hữu document shell cho **mọi** loại trang (`pageKind: landing | section | detail | not-found`); không trang nào tự viết lại head/header/footer.
- **Mô hình trang:** Landing: route `src/pages/index.astro` là vỏ mỏng, nội dung ở `src/components/landing/Landing.astro` nhận `locale` (một mã của `SITE_LOCALES`, chữ qua `pick()`, bản zh dùng chữ Hán gốc và bản ja dùng tên Nhật trong thẻ/bảng xem trước); 8 trang mục tĩnh `src/pages/<đường-dẫn>/index.astro` (`/doi-chuan/`, `/doi-khac/`, `/cung-ton/`, `/khai-hoang/`, `/tra-cuu/`, `/theo-doi-chieu-mo/`, `/soi-doi-tu-anh/`, `/goi-y-doi-tu-kho/`) mỗi trang đúng một mount `<section id="section-<id>">`; ba họ trang chi tiết sinh từ `src/lib/team-detail-routes.ts`; 7 trang nhóm `src/pages/tra-cuu/[group].astro` và trang riêng từng mục `src/pages/tra-cuu/[group]/[slug].astro` (`src/lib/lookup-item-pages.ts`, chỉ nạp `js/lookup-item-page.js`); `src/pages/404.astro` không boot `app.js`/`team-detail.js`.
- **Đa ngôn ngữ (`/zh/`, `/ja/`):** danh sách locale duy nhất là `SITE_LOCALES` của `js/i18n.js` (`['vi', 'zh', 'ja']`, `src/lib/locale-routes.ts` re-export); locale mới chỉ được nối vào cuối, không chèn hay đổi thứ tự. Mọi route bản Việt có bản gương cùng đường dẫn dưới tiền tố của từng locale (`LOCALE_PREFIX`: Landing, 8 trang mục, 3 họ chi tiết, trang nhóm và trang riêng Tra cứu, trang cộng đồng, `/chien-bao/`, `/doi-cua-toi/`, `/quan-tri/`, blog); `tests-js/locale-route-mirror.test.mjs` kiểm `src/pages/zh/` và `src/pages/ja/` cùng tập file. Route file chỉ là vỏ mỏng truyền `locale`; nội dung ở `src/components/pages/*.astro` (`SectionPage`, `RecommendedDetail`, `LegacyDetail`, `KhaiHoangDetail`, `LookupGroupPage`, `LookupItemPage`, `ReportsPage`, `AdminPage`), `getStaticPaths` chi tiết dùng chung ở `src/lib/team-detail-pages.ts` và `src/lib/lookup-item-pages.ts`.
  - **Chữ giao diện:** `pick(locale, vi, zh, ja)` và `L(vi, zh, ja)` (theo ngôn ngữ trang) chọn biến thể theo **vị trí** trong `SITE_LOCALES`; thiếu biến thể cho locale đang dựng thì `pick` ném lỗi, nên build dựng mọi trang sẽ bắt. `tests-js/i18n-call-arity.test.mjs` kiểm tĩnh mọi lời gọi `L(`/`pick(` trong `js/`, `src/` (kể cả bảng tuple được trải) có đúng `SITE_LOCALES.length` biến thể. Không viết `locale === "zh"`, `otherLocale` hay kiểu `"vi" | "zh"`: rẽ nhánh nội dung qua `contentLocaleIsVietnamese(locale)` (chỉ bản Việt hiện lớp dịch Việt) hoặc `contentMode(locale)` (`vi` / `source` / `ja`); bảng theo locale khai `Record<SiteLocale, …>`. Mã Intl lấy từ `LOCALE_INTL`. Thuật ngữ ja chốt một tên mỗi khái niệm trong `pipeline/ja-glossary.json`.
  - **Head và nút ngôn ngữ:** `SiteLayout` nhận `locale`: `<html lang>` (`LOCALE_HTML_LANG`: `vi`, `zh-Hans`, `ja`), `og:locale` và `og:locale:alternate`, hreflang của mọi locale cộng x-default = bản Việt (`mirroredAlternates`), nút chọn ngôn ngữ trên header (địa cầu + mã bản đang xem, menu thả theo hợp đồng `data-dropdown` của `js/site-nav.js`) và hàng ngôn ngữ ở chân menu mobile, cả hai liệt kê mọi bản trong `nav[data-lang-switcher]` (`js/site-chrome.js` giữ query/hash), mọi link nội bộ qua `localePath()`. Không bao giờ hiện hai ngôn ngữ cạnh nhau; tên riêng không dịch đánh dấu `translate="no"`.
  - **Nội dung bản zh/ja:** tiêu đề chi tiết bản zh dùng `nameZh` (đội chuẩn) hoặc tên tướng chữ Hán tra qua từ điển (tướng không tra được bị bỏ, không lộ chữ Việt); bản ja đổi các tên đó sang tên Nhật qua bộ tra `createJaNameResolver`. Văn xuôi chỉ có chữ Trung mà chưa có bản Nhật bị ẩn ở bản ja và thay bằng đúng một dòng báo thiếu; mô tả Tra cứu dịch máy luôn mang nhãn 機械翻訳.
- Trang mục khai `activeSection` (một trong 8 id); layout gắn `data-page-section="<id>"` lên `<body>` (không dùng `data-section` — nav đã dùng) và `js/app.js` chỉ mount mục đó, không còn tab/hash/`switchSection`.
- `js/app.js` gắn `document.body.dataset.boot = 'ready'` sau khi mount xong (kể cả nhánh lỗi) — tín hiệu cho e2e.
- Astro chỉ làm static build. Không thêm SSR, adapter, renderer UI hoặc Pages Functions khi chưa có yêu cầu riêng. Nội dung dựng sẵn lúc build (trang đội, Tra cứu) là `treeToHtml` của builder cây view dùng chung với trình duyệt, không phải SSR lúc chạy.
- Dùng vanilla ES modules; không thêm framework/bundler nếu không có yêu cầu sản phẩm rõ.
- `app.js` chỉ điều phối load/init. Behavior section đặt trong module riêng.
- **Payload mỗi trang mục** do layout phát; Landing là `pageKind="landing"` và **chỉ có hai pin publication**, không có `#team-route-handles`, `#season-artifact-hashes` hay `#season-controls`:

  | Payload | Người đọc | Trang cần |
  |---|---|---|
  | `#recommended-publication`, `#website-display-publication` | `app.js` (verify pin trước khi render) | mọi trang |
  | `#team-route-handles` đủ `{r,l,k}` | `app.js` (href chi tiết, migrate `detail`/`legacyTeam`, migrate `khTeam`/`khVariant`) | cả 8 trang mục; trang chi tiết đội chỉ `{l}`; **Landing và trang riêng mục Tra cứu không có** |
  | `#lookup-route-handles` (ngoại lệ slug của ledger Tra cứu, hiện `{}`) | `app.js`, `team-detail.js` (`setLookupRouteHandlesFromJSON` trước lần dựng link Tra cứu đầu tiên) | mọi trang có `#team-route-handles` (trang riêng mục Tra cứu dựng link lúc build và không nhúng bảng; verifier chặn) |
  | `#season-artifact-hashes` | `app.js` (model mùa) | Đội chuẩn, Đội khác, Cùng Tồn |
  | `<div id="season-controls">` | `app.js` (`placeSeasonControls`) | 3 trang như trên; Soi đội, Gợi ý đội **không có** (bỏ `scenario`/`ruleset`/`config` khỏi URL khi tải; hai công cụ tự có ô chọn mùa Đội chuẩn `season` trong công cụ) |

- **Nguồn dữ liệu theo trang**: mỗi trang chỉ tải và xác minh nguồn chính nó đọc. `loadWebsiteDisplay(pin, loadBytes, recommendedPin, {paths})` băm song song đúng các nguồn trong `paths` (mặc định mọi nguồn trong `sourceHashes`; đường không được pin → lỗi) và `localizeData` từ chối nguồn chưa được chính publication đó xác minh. Byte đi qua `createByteLoader()` của `js/website-display.js`: một request mỗi đường dẫn cho cả publication, mô hình mùa và kho Tra cứu; lần tải lỗi bị bỏ để "Thử lại" tải lại. Thêm nguồn cho một trang thì thêm cả vào `paths` của trang đó.

  | Trang | Xác minh qua website-display (`paths`) | Tải thêm (bộ kiểm riêng) |
  |---|---|---|
  | Đội chuẩn, Đội khác | — (thêm `teams` khi URL có `legacyTeam` không kèm `config`) | bộ mùa 10 file (`#season-artifact-hashes`), generation Recommended |
  | Cùng Tồn | `coexist` | bộ mùa 10 file |
  | Khai hoang | `khaihoang` | — |
  | Tra cứu (trang nhóm) | `lookup-manifest` + payload của nhóm: Tướng `heroes-dict`, Chiến pháp `tactics`, Trang bị/Quân sư/Cải tạo/Công trình `lookup-catalog`; Binh thư không có (pin `books-dict` trên trang) | payload hồ sơ tải lười khi mở hồ sơ đầu tiên, kiểm theo manifest (Tướng: `tactics`, `lookup-catalog`, Recommended, bộ tra tên Hán bản zh; Chiến pháp/Trang bị/Quân sư: `heroes-dict`); hash `heroes-dict` của publication làm `catalogSha256` |
  | Tra cứu (mục lục `/tra-cuu/`) | — (không nạp app) | — |
  | Tra cứu (trang riêng `/tra-cuu/<nhóm>/<slug>/`) | — (không nạp app, hồ sơ dựng sẵn) | — |
  | Theo dõi chiêu mộ | `heroes-dict`, `tactics`, `lookup-catalog`, `lookup-manifest` | — |
  | Soi đội | như Theo dõi chiêu mộ | `books-dict`; generation Recommended (`index.json`, `other-teams.json`) tải lười khi cần đối chiếu |
  | Gợi ý đội | như Theo dõi chiêu mộ + `teams` (đội cũ lấp chỗ trống) | `team-tier` (tuỳ chọn); generation Recommended (`index.json`, `seasons.json`) tải lười khi mở công cụ |
  | Chi tiết Đội chuẩn | — (thân dựng sẵn, không tải gì) | — |
  | Chi tiết Đội khác | — ở trạng thái mặc định; `?variant=`: `teams` (dùng chung với kiểm `legacyTeamsSha256`) | `?variant=`: generation Recommended (`other-teams.json`) |
  | Chi tiết Khai hoang | — ở trạng thái mặc định; `?variant=` hoặc lần bấm chip cấu hình đầu: `khaihoang` (kiểm hash trang trước) | — |

- **Fetch dữ liệu bằng đường dẫn tuyệt đối** `/data/…` (không dùng `./data/…`: dưới `/<mục>/` sẽ thành `/doi-chuan/data/…` → 404).
- **Bảng chuyển tiếp hash cũ** nằm ở một nguồn `js/legacy-routes.js` (ESM thuần, không import): `index.astro` nhúng `resolveLegacyRoute.toString()` vào script inline chặn trong `<head>`, `js/team-detail-navigation.js` dùng cùng hàm để chuẩn hoá mọi đích quay lại (`history.state`, `?from=` của link cũ, referrer, sessionStorage) và snapshot cũ. Thêm mục/hash mới thì sửa bảng đó, không viết nhánh riêng.
- **`safeReturnUrl` giữ khóa theo trang**: `SECTION_QUERY_KEYS` là allowlist theo pathname của trang mục (`/doi-chuan/`, `/doi-khac/`, `/cung-ton/`, `/soi-doi-tu-anh/`, `/goi-y-doi-tu-kho/`, `/khai-hoang/`, `/tra-cuu/`, `/theo-doi-chieu-mo/`), chỉ giữ khóa có trong allowlist của **đúng** pathname đó và bỏ lặng lẽ mọi khóa khác (`fbclid`, `gclid`, `msclkid`, `utm_*`, `score`), không loại cả URL. `/doi-chuan/` giữ thêm `kho`/`xep` (lọc/sắp theo kho) để Quay lại về đúng danh sách đã lọc; `SSR_STALE_EXEMPT_KEYS` loại hai khóa này khỏi bảo vệ chống nháy vì chúng không làm danh sách dựng sẵn sai. URL gốc cũ dạng `/?…#<tab>` được chuẩn hoá về pathname + query của trang mục trước khi so allowlist, nên `from` cũ vẫn quay về đúng trang.
- **Link nội bộ không mang trạng thái điều hướng.** Href tới trang chi tiết chỉ có path canonical và `variant` khi nó chọn nội dung: `teamDetailHref`/`referenceDetailHref`/`khaiHoangCardHref` không nhận option `from`/`origin` (không thêm lại, không shim), và link nội bộ không có `rel="noreferrer"` vì trang chi tiết đọc `document.referrer`. Đích Quay lại do trang chi tiết quyết định bằng `resolveDetailReturn` (`js/team-detail-navigation.js`): `history.state.teamDetailReturn` → `?from=` của link cũ → referrer cùng origin → sessionStorage theo trang chi tiết (`rememberDetailReturn`; chỉ khi referrer rỗng/hỏng/khác origin hoặc là chính trang chi tiết đó, referrer cùng origin là trang khác thì bỏ qua storage) → link họ đội dựng sẵn. Mọi nguồn qua `safeReturnUrl` với `origin` là `location.origin` (không suy từ referrer); trang Khai hoang ghi đè cặp `khTeam`/`khVariant` của đích lấy từ referrer bằng đội của trang. Chữ ký prerender (`referenceViewSignature`) không chứa URL. Verifier `dist/` (`internalLinksWithReturnQuery` trong `scripts/verify-astro-dist.mjs`, parse `<a href>` bằng URL, không regex trên cả HTML) báo link nội bộ có query `from` hoặc link tới trang chi tiết có `rel` chứa `noreferrer`.
- **Bộ chọn theme/điều hướng**: `js/site-nav.js` sở hữu menu thả + menu mobile và `createDropdownMenu` (dùng lại ở menu tài khoản công cụ); `js/site-chrome.js` sở hữu nút đổi theme (tên truy cập/tooltip theo hành động từ `data-label-to-dark`/`data-label-to-light`, không `aria-pressed`; icon do CSS chọn), `pageshow` và sự kiện `storage`; theme theo hệ điều hành chỉ đọc ở mỗi lần tải trang (không có listener `matchMedia` cho trang đang mở).
- **Artifact tính lúc build**: hồ sơ Tra cứu đọc `hero-summaries.json` sinh trong generation Recommended đang pin (kèm `provenance.catalogSha256`); không tải kho đội chuẩn khi mở hồ sơ.
- Hai trang mục Đội chuẩn/Đội khác dùng cùng `createRecommendedSection()` trong `js/team-filter-section.js`; không fork filter UI theo family.
- Đội chuẩn/Đội khác dùng chung `js/recommended-reference-render.js`; Khai hoang dùng `js/render.js` cho build ở cả card và trang detail, guide chỉ nằm trên detail và ngoài subtree build bị thay khi đổi variant. Không fork markup build.
- **Nội dung đọc được khi không JavaScript dựng bằng cây view** (`js/view-tree.js`): builder trả cây (`h`/`t`), không chạm `document`, không mang hàm sự kiện và nhận `locale` tường minh; build gọi `treeToHtml`, client gọi `treeToDom` rồi gắn sự kiện (nút cần sự kiện nhận diện qua thuộc tính/lớp như `data-tactic-search`, `data-lookup-open`, `data-effect-version`, không qua closure). Không viết markup song song trong `.astro` và không thêm shim DOM (linkedom/happy-dom/jsdom) cho build. Phần dựng sẵn của trang danh sách chỉ được nhận lại khi `data-ssr-source` khớp pin trang đã xác minh và `data-ssr-signature` khớp trạng thái đầu của client; thêm trạng thái đầu mới (khóa URL làm đổi danh sách, kiểu xem) thì thêm vào chữ ký (`referenceViewSignature`/`coexistViewSignature` trong `js/team-filter-section.js`). Chữ ký danh sách chỉ gồm mùa, từ khóa, bộ lọc, kiểu xem, số đội — không có URL trang; `kho`/`xep` không vào chữ ký vì thứ tự theo kho đã chặn riêng bằng `rosterOrdered` ở `renderView`. Nút dựng sẵn cần sự kiện ra HTML `disabled` (`inertUntilBound` trong `src/lib/team-section-ssr.js`) và chỉ bật bằng `enableControl` khi đã gắn.
- Href, đích Quay lại của trang chi tiết (`resolveDetailReturn`), snapshot quay lại và migrate URL tham chiếu cũ thuộc `js/team-detail-navigation.js`; không tự nối path `/doi-chuan/...`, `/doi-khac/...` hoặc `/khai-hoang/...` ở chỗ khác. Bảng route handle do build nhúng (`#team-route-handles`) đăng ký trước lần dựng href đầu tiên, validate và thay nguyên khối; thiếu identity trả `null`, không fallback URL ID cũ. Trang mục Khai hoang dùng `khTeam`/`khVariant`, snapshot cùng map `khaihoangVariants`; chỉ context key của trang mục Khai hoang bỏ cặp query này, surface khác so full URL.
- Href Tra cứu thuộc `js/lookup-ids.js`: `lookupItemPath(id)` cho trang riêng `/tra-cuu/<nhóm>/<slug>/`, `lookupHref(id)` lùi về `?id=` trên trang nhóm chỉ khi mã không có trang riêng (đặc kỹ trang bị). Link từ trang đội, thẻ/hàng/quan hệ Tra cứu đều là path; không tự nối `?id=`. Slug lấy từ ledger `pipeline/lookup-route-handles.json` (gán một lần, không suy lại từ tên); client chỉ biết luật "slug = hậu tố mã" cộng bảng ngoại lệ nhúng.
- Liên kết sang trang chi tiết là anchor thật: chỉ ghi snapshot ở click primary không modifier, không `preventDefault` và không router tự viết.
- Ưu tiên pure function cho normalize, filter, map, score và state transition.
- Render dữ liệu bằng DOM API/`textContent` hoặc cây view (`treeToHtml` luôn escape chữ và thuộc tính); **không** `innerHTML`/`insertAdjacentHTML`/`outerHTML` với dữ liệu (chuỗi HTML còn lại trong `js/` phải là hằng tĩnh).
- `href` lấy từ dữ liệu phải qua kiểm scheme `http(s)`; link ngoài `target="_blank" rel="noopener noreferrer"`, link nội bộ không `rel="noreferrer"` (trang chi tiết đội cần referrer để dựng nút Quay lại); query link dựng bằng `URLSearchParams`.
- Public config đặt trong `js/config.js`; không coi Worker URL hoặc Turnstile site key là secret.
- Nếu code file vượt khoảng 200 dòng và đang tăng complexity, cân nhắc tách theo boundary thật; không tách cơ học.

## Astro và public artifact

- `js/`, `css/`, `data/` ở repository root là source canonical; không tạo bản copy editable trong `public/`.
- Mọi raw asset public phải có entry explicit trong `src/lib/public-artifact-manifest.mjs`; route param không extension và source basename exact.
- Static endpoint phải trả raw bytes/MIME đúng; từ chối file lạ, symlink, non-regular file và realpath thoát root.
- `public/` chỉ chứa deployment-control/static file do Astro copy; hiện `public/_headers`, `public/robots.txt`, `public/favicon.png`, `public/og-image.png` (ảnh chia sẻ 1200×630, lệnh sinh ở `docs/design/so-binh-phap/README.md`) và **cả thư mục `public/fonts/`** phải byte-equal với output tương ứng trong `dist/` (`scripts/verify-astro-dist.mjs` so cả năm nhóm).
- `scripts/verify-astro-dist.mjs` là output policy duy nhất. Test và CLI phải gọi cùng verifier, không nhân đôi allowlist.
- Shell/JS/CSS/JSON mutable dùng `Cache-Control: public, max-age=0, must-revalidate`; Pages response thật vẫn phải được kiểm tra trước promotion.
- `src/pages/404.astro` là trang 404 top-level; không dựa vào SPA fallback và không boot `app.js`/`team-detail.js` trong trang đó.
- **Trang mùa Đội chuẩn** `/doi-chuan/<mã mùa>/` (vi + zh) đi chung route `src/pages/doi-chuan/[team].astro` (Astro không cho hai route động cùng cấp): path mùa nối vào `getStaticPaths` bằng `seasonPagePaths()` của `src/lib/season-pages.ts`, KHÔNG bao giờ qua `recommendedDetailPaths` (`llms-documents.ts` đọc `entry.sourceSeasonId` của mọi path ở đó, nên `/llms/doi-chuan/<mùa>.txt` không đổi). Danh mục (`seasonPageCatalog`) là nguồn chung của trang, sitemap, verifier, khối "Các mùa khác" của `/doi-chuan/` (nằm NGOÀI `#section-team-chuan`, vùng client thay thế) và luật 301 của mùa hiện tại trong `public/_redirects` (sinh bởi `pipeline/lookup_route_handles.py`). `SeasonPage.astro` không có `#community-root` nên khung comment không mount; không sửa `PAGE_KEY_PATTERN` (`js/community-api.js`) hay `community-worker/**`. "Mùa hiện tại" chỉ lấy từ `defaultSourceSeasonId` của registry: client không còn hằng số mùa (`seasonOptionText(item, currentSourceSeasonId)`), nhãn "mùa cũ" của trang đội dùng `isOldSeason`. `/doi-chuan/` dựng sẵn đủ đội của mùa mặc định (bỏ giới hạn `PAGE_SIZE` ở phần SSR; client vẫn phân trang theo lượt, dấu `data-ssr-signature` ghi đúng số đội đã dựng).
- Ba route `/doi-chuan/<mùa>-<handle>/`, `/doi-khac/<handle>/` và `/khai-hoang/<handle>/` sinh từ `src/lib/team-detail-routes.ts`; handle đóng băng trong `pipeline/team-route-handles.json`, inventory HTML dùng chung cho build và verifier, ID/handle không routable bị loại. `sourceConfigId`/`legacyTeamId`/`khaiHoangTeamId` vẫn là định danh nguồn, không đổi theo route; Khai hoang chỉ render từ publication và pin source hash khớp, không fallback JSON thô. Ledger (v3) chỉ được sửa bằng `python3 -m pipeline.team_route_handles` (`--write` lần đầu, `--rebind` khi đổi generation): segment Đội chuẩn đã ngừng công bố nằm vĩnh viễn trong `retiredRecommended` và không bao giờ được cấp lại, kể cả cho id quay lại (id SGSDeck không phải căn cước đội, khác ledger Tra cứu); reader TS/MCP chỉ đọc `handles` và bỏ qua `recommendedSeasons`/`retiredRecommended`.
- Route trang riêng Tra cứu `/tra-cuu/<nhóm>/<slug>/` sinh từ `lookupDetailRoutes()` (`src/lib/lookup-detail-routes.ts`) đọc ledger đóng băng `pipeline/lookup-route-handles.json`; build, sitemap, llms và verifier dùng chung inventory này. Slug đã cấp không bao giờ đổi hay cấp lại: đổi tên giữ slug, mã biến mất chuyển sang `retired` (giữ chỗ slug), mã quay lại nhận lại slug cũ. Ledger chỉ được sửa bằng `python3 -m pipeline.lookup_route_handles --write` (`handlesSha256` bắt sửa tay); `--check` không bao giờ suy lại slug.
- `public/_headers` là nguồn duy nhất của luật cache (shell, trang mục, trang chi tiết, `/zh/*`, `/ja/*`, blog/RSS, bộ llms, JS/CSS/font/data, ảnh tĩnh; mọi asset mutable dùng `max-age=0, must-revalidate`); thêm output công khai mới thì thêm luật và để `tests-js/pages-headers-contract.test.mjs` kiểm, không chép danh sách luật vào docs. Rule `/*` là ngoại lệ duy nhất: đặt `Referrer-Policy: strict-origin-when-cross-origin` cho mọi route vì trang chi tiết đội đọc `document.referrer` cùng origin để dựng nút Quay lại; cùng giá trị chạy ở zone Cloudflare nhưng phải nằm trong repo để test khóa nó.
- Root và trang con dùng chung `src/layouts/SiteLayout.astro` cùng một `/css/styles.css`; không thêm stylesheet hoặc shell riêng cho trang chi tiết.
- **Font self-host** nằm ở `public/fonts/` (Be Vietnam Pro 400/500/600/700 + Noto Serif Display 700, subset latin/latin-ext/vietnamese, `font-display: swap`), khai `@font-face` trong `css/styles.css`, và phải có rule cache trong `public/_headers` cùng entry trong verifier; `public/fonts/OFL.txt` giữ license.
- **CSS chỉ dùng token**: mọi giá trị vi mô lấy từ `docs/design/so-binh-phap/tokens.json` (nguồn duy nhất); `node scripts/design-tokens.mjs --check` phải pass (kể cả ngưỡng tương phản `meta.contrast`, cũng được `tests-js/design-tokens.test.mjs` giữ trong `npm run test:node`) và `node scripts/design-compare.mjs --tokens --phase NN` phải 0 lệch chưa giải thích. Không viết mã màu/px trực tiếp và không giữ lại khối legacy.
- `link rel="canonical"` và `og:url` chỉ khai cho URL công khai ổn định và luôn cùng một giá trị: `src/layouts/SiteLayout.astro` phát từ prop `canonicalUrl`; Landing (`pageKind="landing"`) và 8 trang mục cũng đi qua chính layout đó và truyền pathname sạch của mình (gom mọi biến thể query), cả ba họ trang chi tiết và trang riêng Tra cứu truyền pathname chính nó kèm `og:type="article"`. Link nội bộ tới trang chi tiết trỏ thẳng URL canonical (kèm `variant` chọn nội dung), không `?from=`: Google khuyên link nội bộ trỏ canonical và `from` sinh biến thể URL không có trần. `src/pages/404.astro` chỉ khai `robots=noindex`, không canonical/`og:url`. Mọi trang còn khai `og:site_name` (tên logo), `og:locale=vi_VN` và `og:image` tuyệt đối trỏ `/og-image.png` (kèm kích thước 1200×630); bài blog có ảnh bìa truyền ảnh bìa qua prop `ogImage` (không khai kích thước).
- `public/robots.txt` và `src/pages/sitemap.xml.ts` là surface crawl công khai: sitemap phát root, 8 đường dẫn mục (`/doi-chuan/`, `/doi-khac/`, `/cung-ton/`, `/khai-hoang/`, `/tra-cuu/`, `/theo-doi-chieu-mo/`, `/soi-doi-tu-anh/`, `/goi-y-doi-tu-kho/`), 7 trang nhóm Tra cứu, trang tĩnh, inventory route của `src/lib/team-detail-routes.ts`, các trang mùa Đội chuẩn của `seasonPages()` và mọi trang riêng Tra cứu của `lookupDetailRoutes()`, cùng bản `/zh` và `/ja` của toàn bộ tập đó (mỗi bộ khai `xhtml:link` hreflang vi, zh-Hans, ja, x-default = bản Việt; tập route ở `mirroredSitemapPaths`), ba trang danh sách blog (`/bai-viet/`, `/zh/bai-viet/`, `/ja/bai-viet/`, cũng là một bộ hreflang; bài viết chỉ ghép cặp khi có bản dịch cùng `translationKey`) và mọi bài viết (bài và trang danh sách blog có `<lastmod>` từ `updatedAt`), và origin công khai duy nhất khai ở `site` của `astro.config.mjs` — robots, sitemap, canonical và `og:url` đều phải khớp origin đó. robots cho phép toàn site cho mọi bot và khai tường minh các bot AI (`GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`); chỉ `Disallow` trang quản trị (`/quan-tri/`, `/zh/quan-tri/`, `/ja/quan-tri/`) và `/api/`. Không thêm `Disallow` cho `/js/`, `/css/`, `/data/` vì crawler cần chúng để render.
- Blog (`src/lib/blog-posts.ts`, `src/lib/blog-seo.ts`, `src/components/blog/`): Markdown render bằng Sätteri (`satteri`, devDependency pin chính xác) với plugin làm sạch — bỏ HTML thô và comment, link chỉ nhận `#`, đường dẫn cùng site, http(s), mailto (link ngoài site thêm `rel="noopener noreferrer"` + tab mới), ảnh chỉ nhận https hoặc đường dẫn cùng site; h1 trong thân bài hạ thành h2. Trang bài phát JSON-LD `BlogPosting` + `BreadcrumbList` (+ `FAQPage` khi có FAQ), hreflang tới bản dịch cùng `translationKey`; nhúng JSON-LD luôn qua `jsonLd()` để thoát `<`/`>`/`&`.
- JSON-LD của trang chi tiết đội, trang nhóm và trang riêng Tra cứu thuộc `src/lib/structured-data.ts`, chèn qua `<Fragment slot="head">` bằng `jsonLd()`. Chỉ khai chữ đã hiện trong HTML của chính trang: `name` đầu `<title>`, `description` = meta description, `url` = canonical; bản Việt chỉ khai `alternateName` chữ Hán khi trang hiện chữ Hán, bản Trung không khai tên Việt; `about`/`ItemList` chỉ trỏ tới trang riêng có thật. Hợp đồng nằm ở `tests-js/seo-dist-contract.test.mjs`.
- Bộ llms (`/llms.txt`, `/llms/*.txt`, `/llms-full.txt`) chỉ sinh từ `llmsDocuments()` của `src/lib/llms-documents.ts`: nội dung là `treeToText` của đúng cây mà trang HTML dựng từ, không viết văn bản song song. Route, `llms.txt` và allowlist của `scripts/verify-astro-dist.mjs` lấy danh sách file từ cùng hàm.

## UI và accessibility

- Nhãn tiếng Việt ngắn, trạng thái rõ; mọi control dùng `button`/`input` phù hợp và có tên truy cập được.
- Filter count phải tính từ tập dữ liệu của mục đang mở. Không phụ thuộc `data/facets.json` ở runtime.
- URL sở hữu bộ lọc Team: `season`, `q`, `faction`, `unit`, `tier`, `subcategory`, `source`, `view`. Khóa `score`, `category`, selector cũ `stars`, `sort`, `point` đã nghỉ; gặp thì bỏ lặng lẽ, không map sang điểm nguồn và không đổi thứ tự nguồn. Trang chi tiết Đội chuẩn quay lại chỉ mang `season`.
- Query của Cùng Tồn chỉ gồm `group`, `config`, `scenario`, `ruleset` (ô chọn Mùa là điều khiển phạm vi duy nhất, URL thiếu `scenario` được ghi mùa của `group` trong link cũ, không thì mùa mới nhất `COEXIST_LATEST_SCENARIO_ID` bằng `replaceState`); Soi đội chỉ giữ `season` và `doi` (đội đã xác nhận `v1.…`, chỉ ID canonical) khi quay lại, gợi ý kho không giữ khóa nào (`SECTION_QUERY_KEYS`); cả hai không nhận `config`/`scenario`/`ruleset`. Snapshot theo từng surface, không rò giữa hai nhóm.
- Tier Đội chuẩn lấy nguyên `tierRaw` của nguồn, hiện trên thẻ/thẻ gọn/bảng và lọc bằng `tier` (OR trong nhóm, AND với facet khác). Cả ba kiểu hiển thị chia thành khối Tier có tiêu đề và số đội sau lọc; hàng thiếu Tier nằm ở khối “Chưa xếp hạng”. Thứ tự giữ `tierOrder` tăng dần, điểm giảm dần, thứ tự nguồn; không suy Tier từ điểm hoặc Tier lịch sử của Đội khác.
- Dấu mùa nguồn hiện tại dùng `CURRENT_SOURCE_SEASON_ID` trong `js/team-filter-section.js`, đối chiếu SGSDeck ngày 2026-09-27 là Binh Diễn Xuân Thu (`og-兵演春秋`). Option ghi “Hiện tại”; ô chọn hiện “Đang diễn ra” chỉ khi đang xem đúng mùa đó. Không suy trạng thái từ mùa người dùng chọn hoặc coi đây là mùa hiện tại của server VN. Cập nhật hằng này khi nguồn đổi mùa.
- Bộ lọc điểm đã nghỉ: không còn nhóm facet Điểm, không còn khóa `score` trên URL; điểm nguồn chỉ hiển thị trên thẻ/bảng và không đổi thứ tự nguồn.
- Disclosure phục hồi (`filters`, `alternatives`, `view`) chỉ nhận snapshot khớp đúng pathname + query hiện tại; storage lỗi không được chặn điều hướng.
- Mobile dùng shared inline filter collapse và `js/site-nav.js` (menu toàn màn hình); không tham chiếu drawer/module điều hướng không tồn tại.
- Không thiết kế tương tác chỉ dựa vào hover; giữ touch target đủ dùng.
- Khi thêm dialog/upload/status async: bổ sung focus management, keyboard activation và live region, kèm test.

## Python pipeline

- Dùng Python stdlib theo convention hiện tại.
- Parser, normalize và builder tách trách nhiệm; invariant dữ liệu quan trọng fail-loud.
- JSON generated phải deterministic, UTF-8, có newline cuối file.
- Không chạy builder ghi đè trước khi xác minh đủ nguồn, backup artifact và hiểu expected count.
- Không thêm fake record hoặc sửa assertion chỉ để build pass; sửa đường nguồn/augmentation thực.

## Data contract

- `data/*.json` là artifact runtime commit cùng site.
- Team join tier bằng `team.id`; tên team không bảo đảm unique.
- Tier hợp lệ: `T0`, `T0.5`, `T1`, `T1.5`, `T2`, `T3`; một team có thể có nhiều rankings.
- Chiến pháp giữ field nguồn `effect`/`target`; bản dịch review dùng `effectViet`/`targetViet` tùy chọn.
- Bảng curate đang publish nằm trong `pipeline/aliases.json`, `team-nicknames.json`, `team-intro-supplement.json`, `team-tier-map.json` và `books-han-viet-map.json`; `pipeline/do-uy-ss18-source.json` chỉ là archive nguồn thô, không phải input public.
- Nếu đổi schema: cập nhật builder/normalizer, consumer JS, import validation và test contract liên quan.

## Local state và privacy

- Tracker phải giữ `schemaVersion` (hiện 2, có đường chuyển v1→v2), validate import, có đường export/import backup, và mọi bản ghi mang `id`/`updatedAt`/`deletedAt` để gộp; bảo hiểm và số lượt tới 5★ luôn tính lại từ lượt, không lưu riêng.
- Roster scan chỉ serialize dữ liệu canonical cần cho gợi ý; loại ảnh, data URL/base64, blob và Turnstile token.
- Không log hoặc persist nội dung screenshot ngoài yêu cầu rõ của người dùng.
- UI phải nói rõ ảnh gửi tới nhà cung cấp AI nào (hiện DeepSeek hoặc OpenCode Zen) và khuyến nghị crop tên tài khoản. Thêm nhà cung cấp mới vào tab AI thì phải cập nhật disclaimer và trang Quyền riêng tư.
- **Google Analytics 4 (Consent Mode v2, chế độ advanced):** id đo và danh sách host ở `ANALYTICS_CONFIG` của `js/config.js` (một nguồn cho script `<head>` của `SiteLayout` ở `src/lib/analytics-loader.ts` và cho `js/analytics.js`). Sự kiện chỉ đi qua `track()` của `js/analytics.js`: không gọi `gtag` trực tiếp và không kiểm đồng ý ở chỗ gọi (Consent Mode quyết định gtag gửi gì; riêng loại sự kiện mang chữ người dùng gõ, hiện chỉ `search`, do chính `track()` bỏ khi chưa có lựa chọn "granted", vì khi từ chối hay chưa chọn gtag vẫn gửi tín hiệu không cookie kèm tham số của mọi sự kiện); `track()` là no-op khi GA tắt (host ngoài `ANALYTICS_CONFIG.hosts`, `/quan-tri/`, chưa có gtag) và không bao giờ ném lỗi. Tham số chỉ mang id công khai/enum/số/boolean; không email, tên, tài khoản, nội dung kho/đội, ảnh hay chữ tự do (ngoại lệ duy nhất: từ khoá Tra cứu đã debounce của `search`, tối đa 50 ký tự, chỉ khi đã đồng ý). Từ khoá `?q=` của trang danh sách đội nằm trên URL nên không đi qua `track()`: nó được che bằng cài đặt "Redact data" của GA4, cùng các cài đặt phía GA4 khác ở `docs/deployment-guide.md#google-analytics-4-analytics_config`. Lượt xem trang đầu do loader gửi tường minh (`send_page_view: false`, URL chụp ở `<head>` trước khi `js/app.js` gỡ `utm_*`). Chỉ `analytics_storage` được cấp, quảng cáo luôn từ chối; lựa chọn lưu ở `localStorage.analyticsConsent` 12 tháng. Thêm hoặc đổi dữ liệu gửi đi thì cập nhật mục "Phân tích truy cập (Google Analytics)" của `src/components/pages/PrivacyPage.astro` (vi/zh/ja) cùng lúc; `/quan-tri/` không được có dấu vết GA (`SiteLayout analytics={false}`, verifier chặn).

## Worker TypeScript

- Giữ thứ tự guard rẻ → đắt: route/method/origin, secret băm IP, `Content-Length`, limit/kill-switch, Turnstile (siteverify một lần + đúng hostname), image guard, commit usage, model, schema validation.
- Mọi response kể cả lỗi bất ngờ đều là JSON có CORS (handler bọc một `try/catch` ngoài cùng).
- Origin lạ phải bị từ chối khi header có mặt và không khớp exact một mục trong `ALLOWED_ORIGINS` (CORS chỉ echo origin khớp, luôn kèm `Vary: Origin`; thiếu/rỗng biến → `503` fail-closed); hiểu rằng request không có `Origin` vẫn qua, nên không xem CORS là authentication.
- Kiểm tra MIME, magic bytes và size server-side; không tin nén client.
- Không leak upstream detail: lỗi model trả thông điệp cố định (502 tạm lỗi, 503 quá tải khi upstream 429), không kèm mã upstream; lỗi ngoài dự kiến trả thông báo chung.
- Không log ảnh; IP chỉ lưu dạng HMAC có khoá (`IP_HASH_SECRET`), IPv6 gom /64. Thiếu secret → 503 fail-closed trước mọi thao tác KV/siteverify/model.
- KV quota là best-effort, không diễn đạt như giới hạn cứng: lỗi đọc KV coi như 0, lỗi ghi bị bỏ qua. Cần quota cứng thì đổi primitive phù hợp.
- Secret dùng `wrangler secret put`; tuyệt đối không commit `.dev.vars`, key hoặc token.

## Research MCP

- Tám public schema/handler trong `mcp-worker/src/research/` là authority dùng chung cho CLI, stdio và HTTP.
- Public schema field phải có agent-facing description; tool description nêu khi dùng, kết quả và failure modes.
- MCP error chỉ dùng safe allowlist theo code cho `message`/`nextAction`; không chuyển exception message, input, path hoặc upstream body ra transport.
- `releaseId` đầy đủ sở hữu workflow/binding/cursor compatibility; không dùng compact `dataVersion` làm identity bảo mật.
- HTTP giữ thứ tự guard rẻ → đắt, server/transport theo request và chỉ đọc allowlisted Worker Static Assets qua `DataSource`.
- Release phải build deterministic manifest + sáu JSON từ exact Git tree sạch, verify candidate `0%` bằng Version Override, rồi promote duy nhất `100%` dưới expected-current guard.
- Bearer và Cloudflare token chỉ đi qua managed environment ở đúng step tiêu thụ; không argv/query/log/artifact. Gate phải từ chối file secret tạm chưa dọn.
- `npm run check` không được gọi live deploy. `.github/workflows/mcp-gate.yml` là browser CI owner duy nhất; `npm run check:repository` phải bao phủ MCP, Astro build/dist/`npm run verify`/E2E, JS, Python, Vision Worker và Wrangler dry-run. `.github/workflows/mcp-release.yml` chỉ chạy gate phạm vi Worker (`npm run check`, `test:worker`, `deploy:dry-run`) trước release; `push.paths` của nó phải phủ mọi đầu vào Worker (test `workflow-release-contract` giữ điều này).
- MCP core coverage (`src/data`, `src/domain`, `src/research`) phải đạt statements/lines/functions 80% và branches 70%; không hạ threshold để né regression.

## Quy ước tên và tài liệu

- Theo convention repo; file mới dùng tên mô tả, kebab-case nếu không có quy ước mạnh hơn.
- Docs evergreen ở `docs/`; kế hoạch/báo cáo có thời điểm ở `plans/` và không phải runtime truth.
- Cập nhật docs khi đổi behavior, command, schema, deploy boundary, config/security hoặc quyết định kiến trúc.
- Commit tập trung, conventional commit, không nhắc AI và không chứa secret/dữ liệu cá nhân.

## Quality gate

Chạy test hẹp trước, rồi full gate khi đổi contract chung:

```bash
npm run check
npm run build
npm run test:dist
npm run verify
npm run test:e2e
npm run test:node
python3 -m unittest discover -s tests
(cd worker && npm ci && npm test && npm run typecheck)
(cd mcp-worker && npm ci && npm run check:repository)
```

Không che test/lint/type error và không làm yếu assertion để hợp thức hóa regression.

## Bước tiếp theo

Trước merge: review diff dữ liệu, kiểm tra secret, xác nhận docs impact và chạy gate tương ứng. Với pipeline hiện tại, xem cảnh báo rebuild trong [Deployment Guide](deployment-guide.md).

## Tham chiếu

- [Tóm tắt codebase](codebase-summary.md)
- [Kiến trúc](system-architecture.md)
- [Design Guidelines](design-guidelines.md)
