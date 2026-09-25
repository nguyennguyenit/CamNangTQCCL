# Phase 2 — Báo cáo: tách đường dẫn + layout chung

Ngày: 2026-09-25 · Plan `260923-1949-so-binh-phap-redesign`, [phase-02](../phase-02-duong-dan-layout.md).
Phase **cấu trúc**: không có cặp ảnh artboard, nên tầng vi mô soát bằng `tokens.json` + probe trên đường dẫn mới (§2).
**Bộ A2 đầy đủ đã xanh trong một lần chạy liền mạch** (§6) sau khi mọi việc của phase land và sau khi
áp xong ba bản sửa theo NO-GO của Kongming (§7c).
Chưa commit — orchestrator commit sau go/no-go.

## 1. Việc đã làm (theo bước trong phase file)

| Bước | Nội dung | Trạng thái |
|---|---|---|
| 1 | `SiteLayout` `pageKind` bắt buộc, 8 mục, nav là `<a href>` + `aria-current="page"`, `data-page-section`, theme inline chặn trước stylesheet, bỏ `data-theme="light"` cứng, bỏ `isRoot`/`contentClass`/nhánh root | xong |
| 2 | 8 trang mục + bảng payload (bảng ở §3) | xong |
| 3 | `app.js` chỉ mount mục của trang, `/data/…` tuyệt đối, lỗi hiện ở mount trang, giữ migrate `?detail=`/`?legacyTeam=`, dọn `fbclid`/`gclid`/`msclkid`/`utm_*`, `body[data-boot="ready"]` | xong |
| 3b | Đo tải dữ liệu (không tối ưu) | xong — §4 |
| 4 | Tra cứu `group`/`id` trên query, parser chỉ xét `group`/`id` | xong |
| 5 | Landing tạm thời (`index.astro`) + khối "Bạn đang cần gì?" | xong |
| 6 | `js/legacy-routes.js` + script inline chặn + `hashchange` | xong |
| 7 | `safeReturnUrl` theo allowlist từng trang, `familyReturnHref`, `khaiHoangContextKey` theo pathname, `tab` từ `data-page-section`, link nội bộ | xong |
| 8 | Sitemap 8 đường dẫn, verifier theo bảng payload, `_headers` 5 rule mới | xong |
| 9 | Policy bản dịch: entrypoints/sourceFiles/baseline/obligation/receipt/publish/re-pin | xong — §5 |
| 10 | Test chuyển có chủ đích | xong (e2e do phiên phụ trách — §6) |

### File tạo mới
- `src/pages/{doi-chuan,doi-khac,cung-ton,khai-hoang,tra-cuu,chieu-mo,soi-doi,goi-y-doi}/index.astro`
- `js/legacy-routes.js` (+ `entry("js","legacy-routes")` trong manifest), `tests-js/legacy-routes.test.mjs`

### File sửa
`src/layouts/SiteLayout.astro`, `src/pages/index.astro`, `src/pages/404.astro`, `src/pages/doi-khac/[team].astro`, `src/pages/khai-hoang/[team].astro`, `js/{app,render,site-chrome,unified-lookup,team-detail-navigation}.js`, `src/pages/sitemap.xml.ts`, `scripts/verify-astro-dist.mjs`, `public/_headers`, `src/lib/public-artifact-manifest.mjs`, `docs/design/so-binh-phap/tokens.json` (probe.page), `scripts/design-compare.mjs` (ready của cặp Phase 4), `pipeline/{site-localization-policy.json,site_localization.py,site-translations.json,site-translation-reviews.json,team-route-handles.json}`, `data/website-display.json`, generation `src/data/recommended-reference/`, `tests/test_site_localization.py`, `tests-js/{astro-dist-contract,team-detail-navigation,unified-lookup,pages-headers-contract}.test.mjs`, `tests-js/frontend-shell-contract-assertions.mjs`, 8 spec trong `tests-e2e/`.

## 2. Vi mô (tự động)

`node scripts/design-tokens.mjs --check`: pass. `:root` khớp `tokens.json`; 0 mã màu ngoài khối token; **0 giá trị thô ngoài khối legacy**; mốc legacy **657 giá trị thô trên 303 selector — không tăng** (Phase 2 không thêm CSS).

`node scripts/design-compare.mjs --tokens --phase 01` (probe đã chuyển sang đường dẫn mới), theme sáng và tối:

```
117/118 thuộc tính khớp token (theme light, phase 1); 0 lệch chưa giải thích.
117/118 thuộc tính khớp token (theme dark, phase 1); 0 lệch chưa giải thích.
đã giải thích: select-nhan-caps line-height = normal — select là form control: Chrome tính
`line-height: normal`, bỏ qua line-height của token (chiều cao đã khóa bằng control.44)
```

**Phạm vi 0 của Phase 2 được nói rõ, không tính là đạt** (rủi ro #4 của Kongming):

```
node scripts/design-compare.mjs --tokens --phase 02
0/0 thuộc tính khớp token (theme light, phase 2); 0 lệch chưa giải thích.
không đo được thuộc tính nào — coi như gate đỏ.
Phase 2: 0 thuộc tính đo được — chưa có probe, không tính là đạt.
```

Phase 2 không sở hữu/dùng component nào trong `tokens.json`, nên bảng probe rỗng. Bù lại, toàn bộ 14 probe của Phase 1 được chạy thật trên `/doi-chuan/` + `/chieu-mo/` (đường dẫn mới) và khớp token — đây là bằng chứng shell dùng chung còn nguyên sau cutover.

`node scripts/design-compare.mjs --phase 02`: `Phase 2: chưa có cặp ảnh nào` — phase cấu trúc, không có artboard. Cặp `ready` của Phase 4 đã đổi từ `#section-team-chuan .reference-team-card` (không còn tồn tại trên `/`) sang `#landing-quick` để không thành mìn cho Phase 4.

### Chuyển `probe.page` khỏi `/` (rủi ro #4)
11 component có probe trỏ `/` (`badge-phe`, `badge-binh`, `nut-chinh`, `nut-chu`, `nut-chien-phap`, `so-diem`, `the`, `o-tim`, `select-nhan-caps`, `nhan-caps`, `focus-visible`) → `/doi-chuan/`; `nut-phu` (selector `#section-recruit-tracker .rt-btn`) → `/chieu-mo/` (mount đó không còn trên `/`). `chip-loc`/`nhan-bien-the` giữ nguyên vì probe của chúng đã khai page riêng.

## 3. Bảng payload theo trang (lập từ code, bước 2)

| Payload | Nguồn phát | team-chuan | team-khac | coexist | khaihoang | lookup | recruit | analyze | roster |
|---|---|---|---|---|---|---|---|---|---|
| `#recommended-publication`, `#website-display-publication` | layout (mọi trang) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `#team-route-handles` `{r,l,k}` | layout (`pageKind="section"`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `#season-artifact-hashes` | layout (`SEASON_SECTIONS`) | ✓ | ✓ | ✓ | — | — | — | ✓ | ✓ |
| `#season-controls` | layout (`SEASON_SECTIONS`) | ✓ | ✓ | ✓ | — | — | — | ✓ | ✓ |
| `<section id="section-<id>">` | trang mục | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/js/app.js` | trang mục | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `{l}` route handles | layout (`pageKind="detail"`) | chỉ trang chi tiết đội | | | | | | | |
| Landing | `pageKind="landing"` | không `#team-route-handles`, không `#season-artifact-hashes`, không `#season-controls`, không `/js/app.js`; có script inline chuyển tiếp | | | | | | | |

`#season-controls` do layout phát nên `app.js` bỏ qua toàn bộ phần phạm vi mùa khi trang không có phần tử (Khai hoang, Tra cứu, Chiêu mộ) — không còn `TypeError` ở `app.js:211`. `#season-artifact-hashes` thiếu ⇒ không nạp `seasonModel` (không rơi vào `BUNDLE_NOTICE` im lặng). Landing không có payload nào của `app.js`.

## 4. Số đo tải dữ liệu (bước 3b — chỉ đo, không tối ưu)

Đo trên `npm run preview` (dist thật) bằng Chromium: xoá cache qua CDP rồi mở trang mục, đọc bảng request.

### 4.1 Số đo của người thực thi (executor-attributed)

| Lần mở | Tổng request | request `data/` | `data/` 200 | `data/` 304 |
|---|---|---|---|---|
| `/doi-chuan/` (cache trống) | 66 | 19 | 19 | 0 |
| `/doi-khac/` (cùng phiên, cache ấm) | 66 | 19 | 0 | 19 |

### 4.2 Số đo chuyển byte của Kongming (đo độc lập, `Resource Timing`, preview riêng)

Phiên Chromium tách biệt, chờ `data-boot=ready`, đọc Resource Timing rồi điều hướng cùng phiên
`/doi-chuan/` → `/doi-khac/`. Là tổng của các resource entry (không gồm entry điều hướng tài liệu
chính); `transferSize` là số trình duyệt báo, không phải bắt gói.

| Chỉ số | Cache trống | Cache ấm |
|---|---|---|
| resource entry | 65 | 64 |
| `transferSize` tổng resource (không gồm entry điều hướng tài liệu chính) | 940 552 B | 19 200 B |
| request `data/` | 19 | 19 |
| `data/` `transferSize` | 588 430 B | 5 700 B (≈300 B/entry — revalidate) |
| `data/` `encodedBodySize` | 582 730 B | 582 730 B |
| `data/` `decodedBodySize` | **5 801 055 B** | **5 801 055 B** |

**Đính chính:** con số 5 801 055 B mà bản báo cáo trước ghi là "byte trên đĩa" thực chất là
`decodedBodySize` (dữ liệu sau giải nén) — Kongming xác nhận đúng bằng phép đo Resource Timing.
Chuyển byte thật khi cache trống là **≈588 KB** cho `data/` (940 KB cho toàn trang), không phải 5,5 MB;
cache ấm chỉ còn ≈5,7 KB cho `data/` nhờ 19 × revalidate. Kết luận cho quyết định #1 không đổi:
giữ nguyên tập dữ liệu khởi động, tối ưu tải là plan riêng.

- Tập 19 file `data/` giống hệt nhau ở cả hai trang: `website-display`, `teams`, `coexist`, `khaihoang`, `books-dict`, `team-tier`, `heroes-dict`, `tactics`, `lookup-catalog`, `lookup-manifest`, 5 `season-*`, và 4 file generation Recommended (`manifest`, `index`, `other-teams`, `seasons`).
- Kích thước dữ liệu của 19 file `data/` là **5 801 055 B `decodedBodySize`** (5,53 MiB sau giải nén) — **không phải** byte truyền. Byte truyền thật của `data/` khi cache trống là **588 430 B** (`transferSize`), với **582 730 B `encodedBodySize`** (xem §4.2). Lần mở trang mục thứ hai chỉ revalidate (19 × 304) đúng như `_headers` `must-revalidate` dự định.
- Hạn chế của phép đo của người thực thi: lần đọc DOM/`performance` trong `tab.run` chạy ở runtime của tab chứ không phải ngữ cảnh trang, nên tôi không đọc được `transferSize`; Kongming lấy được số đó (§4.2) và hai bộ số khớp nhau ở phần request/status. Đây là số liệu cho quyết định tối ưu sau, không phải assertion.
- Kết luận cho quyết định #1: giữ nguyên tập dữ liệu khởi động như plan yêu cầu; số đo xác nhận tối ưu tải **là việc của plan riêng** (≈588 KB truyền cho `data/` mỗi lần mở cache trống; phần lớn dữ liệu là `index.json` Recommended + 5 sidecar mùa, 5 801 055 B sau giải nén).

## 5. Policy bản dịch (bước 9)

### Obligation
- **Bỏ** `ui:root/build-credit`: xoá tuple trong `UI_LITERAL_OBLIGATIONS`, xoá mục ledger `ui:root/build-credit`, bỏ đúng item đó khỏi batch `site-review-v5-080` (4 → 3 item). Không cần receipt mới (footer đã có `ui:layout/build-credit` cùng chữ).
- **Thêm 16 obligation `authored-vi`** cho 8 trang mục (`ui:section-page/<slug>` × `title`/`metaDescription`) — chữ tác giả mới, không cần receipt.
- 5 obligation `translate` còn lại của `src/pages/index.astro` **giữ nguyên tại chỗ, không đổi chữ** (`ui:root/brand`, `ui:root/meta-description`, `ui:root/team-chuan`, `ui:root/team-khac`, `ui:root/beta`) — Landing mới chứa đủ 5 chuỗi. Không có obligation `translate` nào bị dời file hoặc đổi chữ ⇒ **không cần receipt độc lập**.
- `js/app.js` giữ nguyên văn biểu thức binding `displayValue(websiteDisplay, "ui:app/load-error", "errorTemplate")` và tiêu đề `title:'Đội chuẩn'` / `title:'Đội khác'`.

### Policy
- `sections[].entrypoints`: `js/app.js` → trang mục tương ứng (8 trang), `mount` giữ `section-<id>`.
- `sourceFiles`: 36 → **45** (thêm 8 trang + `js/legacy-routes.js`, làm mới hash toàn bộ).
- `policyVersion`: `site-vi-260923-khaihoang-detail` → `site-vi-260925-duong-dan-layout`.

### baseline.notes cũ → mới
| Khóa | Cũ | Mới |
|---|---|---|
| `concreteLocationCount` | 56 265 | **56 280** |
| `concreteInventorySha256` | `1017ff16…` | **`3fd137df…`** |
| `siteLedgerObligations` | 2 089 | **2 088** |
| `translationObligations` | 5 592 | **5 591** |
| `uiTranslateObligations` | 69 | **68** |
| `approvedDisplaySlots` / `blocks` / `hanBlocks` / `uniqueRawTexts` / `lookupReviewObligations` | 11 / 1967 / 1928 / 1123 / 3503 | không đổi |

### Generation + re-pin
`site_localization build --stage all` → `check --stage all --candidate` (exit 0) → `publish` → `check --stage public` (exit 0, `uiPending` 68, không problem) → `pipeline/team-route-handles.json` `generationId`:

```
0fe39aaa1c0a279ed4b0db55c642c4436ce78675240b723addc5a3bc083f3ea4   (Phase 1)
→ bd150c962cef72dd4e1d9a5ed8504cbbd3bdeda49ac063b212fb79b394944c9b   (Phase 2, lần publish đầu)
→ 1056a9a2b440e8794954f2bdaf26e348fb5f26d7019e2fd2606ac7d5e30364d6   (Phase 2, chốt — sau ba bản sửa NO-GO)
```

Sau mỗi lần sửa file nguồn, quy trình lặp lại đủ bước 2b–e (refresh `sourceFiles` → `build` → `check --candidate` → `publish` → `check --stage public` → re-pin), nên generation chốt là generation khớp đúng byte hiện tại.

`python3 -m pipeline.team_route_handles --check` pass (1366 recommended / 166 legacy / 17 Khai hoang).

## 6. Gate (bộ A2)

| Lệnh | Kết quả |
|---|---|
| `npm run check` | pass — 0 error, 0 warning, 1 hint (`team-detail-routes.ts` đã có trước) |
| `npm run build` | pass — 1559 trang |
| `npm run verify` | pass — `site_localization check --stage public` + 1725 file dist |
| `npm run test:dist` | **28/28 pass** |
| `npm run test:node` | **330/330 pass** (thêm 1 test bảng hash kế thừa) |
| `python3 -m unittest discover -s tests` | **368 OK** |
| `npm run test:e2e` | **pass — 189/189** (1,0 phút) sau khi 8 spec chuyển sang mô hình đường dẫn mới và thêm 5 test hồi quy lịch sử |
| `node --experimental-strip-types --test tests-js/legacy-routes.test.mjs tests-js/team-detail-navigation.test.mjs tests-js/astro-dist-contract.test.mjs tests-js/pages-headers-contract.test.mjs tests-js/unified-lookup.test.mjs` | pass — **11** (legacy-routes, sau khi thêm ca tên kế thừa) + 16 + 28 + 3 + 36 |

## 7. Test sửa có chủ đích + lý do

1. `tests-js/team-detail-navigation.test.mjs` (9 ca): mô hình hash → mô hình đường dẫn. `safeReturnUrl('/')`/`'/#nguon-du-lieu'` giờ trả `null` (Landing không phải đích quay lại hợp lệ của trang chi tiết); URL gốc cũ được **chuẩn hóa** (`/#team-khac` → `/doi-khac/`) thay vì giữ hash; khóa lạ **bị bỏ lặng lẽ** thay vì loại cả URL (quyết định #2).
2. `tests-js/team-detail-navigation.test.mjs` — Khai hoang: trang chỉ sở hữu `khTeam`/`khVariant`, nên URL khác ở khóa khác (`q`, `scenario`, `ruleset`) được coi là **cùng trạng thái** khi so snapshot (`khaiHoangContextKey` lọc theo allowlist của trang). Ca "khác `ruleset` ⇒ không khớp" của mô hình cũ bị bỏ cùng lý do.
3. `tests-js/team-detail-navigation.test.mjs` — thêm ca migrate trên mọi trang mục (`/tra-cuu/?detail=…&group=heroes` → `from=/tra-cuu/?group=heroes`).
4. `tests-js/unified-lookup.test.mjs`: `parseLookupRoute`/`formatLookupHash` → `parseLookupQuery`/`formatLookupQuery`; **khóa lạ không còn là lỗi** (`unknown-param` bị xoá) — bước 4 của phase; alias `#heroes`/`#tactics` chuyển sang `js/legacy-routes.js`; ca shell đọc `src/pages/tra-cuu/index.astro` + `SiteLayout.astro` thay vì Landing.
5. `tests-js/frontend-shell-contract-assertions.mjs`: trang mục chỉ có **một** mount của mình (thay vì đủ 8), nav là `<a>` + `aria-current="page"`, `<title>` được phép có tiền tố tên mục.
6. `tests-js/astro-dist-contract.test.mjs`: fixture dist dựng Landing + 8 trang mục theo bảng payload; kiểm pin chuyển từ `index.html` sang vòng lặp trang mục; sitemap thêm 8 đường dẫn (1550 → **1558** location); `marker()` của lookup cập nhật cả 5 trang có phạm vi mùa; thêm khẳng định Landing nhúng nguyên `function resolveLegacyRoute(` + listener `hashchange`.
7. `tests-js/pages-headers-contract.test.mjs`: thêm 5 rule `_headers` mới + phủ mọi trang mục.
8. `tests-e2e/*`: tab/tabpanel → link + `aria-current`; điều hướng hash → đường dẫn; `waitForBoot` chờ `body[data-boot="ready"]` (Turnstile chỉ giữ ở `/soi-doi/`, `/goi-y-doi/`); xoá **có chủ đích** hai assertion thuần tab (phím mũi tên giữa tab, facet không rò giữa tab); `recommended-browser.spec.mjs:123-131` **chuyển** (không xoá) sang `/doi-chuan/?q=sentinel` → `/doi-khac/` → Back; snapshot `url:"/#khaihoang"` giữ nguyên + thêm bản `/khai-hoang/`.
9. `tests/test_site_localization.py`: 4 số ghim theo bước 2e — `uiPending`/`uiValues` 69 → 68 (2 chỗ), site obligations 2089 → 2088, tổng obligations 5592 → 5591, và `coverage.missing` 122 → 121 (cùng ledger một phần).
10. `docs/design/so-binh-phap/tokens.json` + `scripts/design-compare.mjs`: không phải test, nhưng là bề mặt so ảnh/đo token — probe trỏ `/` được chuyển (rủi ro #4).

## 7b. Phán quyết deviation (Kongming, 2026-09-25)

| Deviation | Phán quyết | Việc đã làm theo phán quyết |
|---|---|---|
| (a) Layout sở hữu `SEASON_SECTIONS`; `app.js` chuyển mạch theo phần tử `#season-controls` | **APPROVE thiết kế, nhưng code chưa đúng** — `app.js` vẫn giữ danh sách 5 mục thứ hai | Đã xoá `SEASON_SECTIONS` khỏi `js/app.js`; `const controls = $('#season-controls'); const seasonScoped = controls !== null;` — layout là nguồn duy nhất, thêm/bớt trang chỉ sửa layout |
| (b) Giữ `score` tới Phase 5 | **APPROVE** — bộ lọc điểm còn sống (`team-filter-section.js`), bỏ bây giờ là mất trạng thái người dùng; Phase 5 phải bỏ bộ lọc + khóa trả về cùng lúc, thêm `view`, và danh sách khóa root cũ giữ đóng băng | Không đổi |
| (c) Resolver tự đủ với bảng literal cục bộ để nhúng `toString()` | **APPROVE** — nhưng phải sửa phép tra thuộc tính mà không sinh bản nhúng thứ hai | Xem §7c |
| (d) Khóa phục hồi Khai hoang không còn phân biệt `q`/`scenario`/`ruleset` | **APPROVE** — `/khai-hoang/` chỉ sở hữu `khTeam`/`khVariant`; giữ chuẩn hóa snapshot cũ `/#khaihoang`, validate inventory, ưu tiên cặp trên URL, map rỗng có quyền; **không** thêm lại khóa ngoài chỉ để giữ test cũ | Giữ nguyên; sửa comment sai ở `matchesReturnSnapshot` (§7c) |
| (e) Xoá generation trung gian không được tham chiếu | **APPROVE chính sách dọn** — nhưng phần "không ai tham chiếu" là executor-attributed; không mở rộng quyền này cho generation khác | Giữ nguyên |

## 7c. Sửa theo NO-GO của Kongming (2026-09-25)

| # | Lỗi | Sửa |
|---|---|---|
| P1 | Back/Forward đổi URL nhưng **không render lại** trạng thái do URL sở hữu (Kongming tái hiện: `/doi-chuan/` 25 thẻ → chọn `pk-s24` thành 82 thẻ → Back về URL mặc định nhưng select vẫn `pk-s24` và vẫn 82 thẻ) | `js/app.js` listener `popstate` gọi `refresh()` (hiện/ẩn `#season-detail-mount`, `renderScope()` → Cùng Tồn + chi tiết cấu hình + consumer phạm vi mùa, `renderReference()` → danh sách Đội chuẩn/Đội khác theo URL, `khaiHoangUI.updateLinks()`) **trước** `restoreReturnState()`. Không thêm store thứ hai, không reload, không bỏ `pushState`; Tra cứu giữ listener popstate riêng của nó |
| P2 | Hash trùng tên thuộc tính của `Object` bị coi là hash hợp lệ: `/#constructor` → `/tra-cuu/?group=function+Object%28%29+…`, `__proto__`/`toString`/`valueOf`/`hasOwnProperty` cũng cho group rác | `js/legacy-routes.js` tra `LOOKUP_ALIAS_GROUP`/`HASH_TARGETS`/`ALIAS_SOURCE` bằng `Object.prototype.hasOwnProperty.call(...)` (vẫn self-contained cho `toString()`); test đơn vị thêm 9 tên kế thừa × 4 biến thể query → `null`, và chính bản nhúng phải từ chối `#constructor`/`#__proto__`/`#toString?group=heroes` |
| P2 | Deviation (a) và báo cáo không khớp thực tế | Xoá danh sách 5 mục trùng (bảng trên); báo cáo này ghi lại bằng chứng chuyển tiếp cuối cùng (§8), số đo chuyển byte có nguồn (§4.2) và phán quyết a–e (bảng trên); sửa comment `matchesReturnSnapshot` để không còn ngụ ý `q`/`scenario`/`ruleset` là trạng thái phân biệt của Khai hoang |

### Bằng chứng failing-before / passing-after cho P1

Bản sửa `popstate` được chứng minh trên **artifact đang phục vụ** (`dist/js/app.js`): build lại, vá
`dist/js/app.js` về dạng trước khi sửa, đo, rồi khôi phục `dist` từ nguồn và đo lại. Cùng một kịch bản
(`/doi-chuan/` → đổi *Mùa nguồn* → `history.back()` → `history.forward()`):

| Bước | `dist` trước khi sửa (failing-before) | `dist` sau khi sửa (passing-after) |
|---|---|---|
| mặc định | `value=og-兵演春秋`, 25 thẻ, `search=""` | `value=og-兵演春秋`, 25 thẻ, `search=""` |
| chọn `pk-s28` | `value=pk-s28`, 93 thẻ, `?season=pk-s28` | `value=pk-s28`, 93 thẻ, `?season=pk-s28` |
| **Back** | `search=""` **nhưng** `value=pk-s28` và **vẫn 93 thẻ** ← đúng triệu chứng Kongming tái hiện | `value=og-兵演春秋`, **25 thẻ**, `search=""` |
| Forward | — | `value=pk-s28`, 93 thẻ, `?season=pk-s28` |

Bằng chứng failing-before nêu trên là một **smoke trên artifact đang phục vụ** cho đúng kịch bản mùa→Back→Forward (bảng trên). Năm test hồi quy dưới đây được viết sau bản sửa và xác nhận xanh trong lần chạy 67/67; tôi **không** chạy từng test trong số đó trên bản vá cũ, nên không có bằng chứng failing-before riêng cho từng test. Riêng test "list → detail → Back" là luồng khác tài liệu, không phải bằng chứng cho lỗi thiếu render khi Back cùng tài liệu:

| Spec | Test | Bắt được gì |
|---|---|---|
| `recommended-browser.spec.mjs` | `same-document season and category history re-renders the same records on Back and Forward` | **Danh tính bản ghi** đang render (`data-reference-key` = sourceConfigId/legacyVariantId/legacyTeamId) sau hai pushState **bắt buộc** (mùa rồi danh mục, cặp được chọn từ dữ liệu sao cho danh mục thu hẹp membership), so lại sau từng Back/Forward; kèm URL, control đã chọn và số thẻ |
| `recommended-browser.spec.mjs` | `list to detail and Back restores the rendered list filters and scroll position` | danh sách → chi tiết → Back: giữ bộ lọc phe, `aria-pressed`, số thẻ và vị trí cuộn |
| `season-lookup.spec.mjs` | `scenario history re-renders the scoped surface on Back and Forward` | URL + `#season-scenario` + `#season-summary` + số nhóm Cùng Tồn |
| `season-lookup.spec.mjs` | `ruleset history re-renders the scoped surface on Back and Forward` | URL + `#season-ruleset` + summary (bỏ/chọn lại phiên bản luật) |
| `season-lookup.spec.mjs` | `config detail visibility follows history on Back and Forward` | mở chi tiết cấu hình bằng nút thật của công cụ (pushState) → Back ẩn → Forward hiện lại; đóng bằng nút thì `replaceState` bỏ `config` |

`npm run test:e2e -- tests-e2e/season-lookup.spec.mjs tests-e2e/recommended-browser.spec.mjs` = **67/67 pass**;
`npm run test:e2e -- tests-e2e/recommended-browser.spec.mjs` sau khi siết test membership = **36/36 pass**.

### Bằng chứng P2 qua script inline thật của Landing

| Hash | Kết quả trên trình duyệt |
|---|---|
| `#constructor`, `#__proto__`, `#toString?group=heroes`, `#hasOwnProperty`, `#valueOf?id=hero%3Aluu-bi` | **giữ nguyên URL** (ở lại `/`) |
| `#team-chuan` | `/doi-chuan/` |
| `#heroes` | `/tra-cuu/?group=heroes` |
| `#analyze` | `/soi-doi/` |

Bằng chứng chuyển tiếp **đầy đủ 17/17 dòng bảng** trên trình duyệt thật (Chromium, preview trên `dist/`):

| Hash/URL gốc | Đích | Kết quả |
|---|---|---|
| `#team-chuan` | `/doi-chuan/` | OK |
| `#team-khac` | `/doi-khac/` | OK |
| `#team-pk` | `/doi-khac/?source=team-intro` | OK |
| `#meta-cu` | `/doi-khac/?source=moi-phe` | OK |
| `#coexist` | `/cung-ton/` | OK |
| `#khaihoang` | `/khai-hoang/` | OK |
| `#lookup?group=tactics&id=tactic%3Aan-ui-quan-dan` | `/tra-cuu/?group=tactics&id=tactic%3Aan-ui-quan-dan` | OK |
| `#heroes` | `/tra-cuu/?group=heroes` | OK |
| `#tactics` | `/tra-cuu/?group=tactics` | OK |
| `#recruit-tracker` | `/chieu-mo/` | OK |
| `#analyze` | `/soi-doi/` | OK |
| `#roster-recommend` | `/goi-y-doi/` | OK |
| `/?season=s26#team-chuan` | `/doi-chuan/?season=s26` | OK |
| `/?score=113` | `/doi-chuan/?score=113` | OK |
| `/?detail=team-epoddo` | `/doi-chuan/pk-s24-tiem-long-dieu-thuyen/?from=%2Fdoi-chuan%2F` | OK |
| `/?config=x&legacyTeam=y#analyze` | `/soi-doi/?config=x&legacyTeam=y` | OK |
| `/#xyz`, `/#nguon-du-lieu`, `/?utm_source=x` | giữ nguyên URL (ở lại `/`) | OK |

`/?legacyTeam=<id>` (không hash) chuẩn hóa về `/doi-chuan/` trước rồi migrate sang trang chi tiết Đội khác với `from=/doi-chuan/` — đúng dòng bảng "mục mặc định cũ là Đội chuẩn".

## 8. Kiểm trên trình duyệt thật

- **8 trang mục** (`/doi-chuan/` … `/goi-y-doi/`): `data-boot="ready"`, mount có nội dung (4/4/3/1/8/1/10/1 phần tử), **không 4xx** (không có 404 dưới `/<mục>/data/`), không `BUNDLE_NOTICE`, `#team-route-handles` có ở cả 8, `#season-artifact-hashes` + `#season-controls` **chỉ** ở 5 trang phạm vi mùa, `/js/app.js` có ở cả 8.
- **Chuyển tiếp hash cũ**: đủ **17/17 dòng bảng**, xem bảng ở §7c.
- Theme: `data-theme` do script inline chặn trong `<head>` đặt trước stylesheet (không nháy) và `site-chrome.js` là nơi duy nhất gắn nút đổi, chạy trên mọi trang kể cả Landing; `pageshow` + `storage` áp lại. (Ca Back-đổi-theme nằm trong e2e.)
- `?config=` / nút "Mở scan / nhập kho" → link `/goi-y-doi/` giữ `scenario`/`ruleset` (đơn vị: `render.js` nhận `importHref`; đường dẫn dựng bằng `URLSearchParams`).

## 9. Rủi ro còn lại / việc của phase sau

1. ~~`npm run test:e2e` chưa được xác nhận~~ — đã chạy lại trong gate liền mạch sau ba bản sửa NO-GO: **189/189 pass** (§6). Không còn việc chặn nào của phase.
2. **Byte truyền khi cache trống** — đã đo được (§4.2): `data/` 588 430 B `transferSize` (582 730 B `encodedBodySize`, 5 801 055 B `decodedBodySize`); tổng resource 940 552 B `transferSize`, **không gồm entry điều hướng tài liệu chính** nên không phải con số "toàn trang" đầy đủ. Tối ưu tải vẫn ngoài phạm vi Phase 2.
3. **Phase 4**: cặp ảnh `Landing`/`LandingMobile` đã đổi `ready` sang `#landing-quick`; Landing hiện dùng markup tối thiểu (`landing-cards`, `landing-sections` chưa có CSS) — Phase 4 thay bằng bố cục artboard.
4. **Phase 5**: `safeReturnUrl` cho `/doi-chuan/`,`/doi-khac/` còn giữ `score` (bộ lọc còn sống) và chưa có `view`; cả hai đổi cùng lúc với bộ lọc ở Phase 5.
5. **Phase 3**: `js/mobile-section-menu.js` vẫn là menu cũ; nav giờ là `<a>` nên menu đóng bằng click là đủ, nhưng `js/site-nav.js` của Phase 3 sẽ thay hẳn.
6. `#nguon-du-lieu`/`#tai-game`/`#dau-trang` cố ý ở lại `/` để trình duyệt cuộn anchor — Phase 3/4 quyết định anchor của Landing.

## 10. Gợi ý commit

```
refactor(routing): split the hash SPA into eight static section pages

- add src/pages/<section>/index.astro for all eight guide sections and turn
  `/` into a Landing that redirects legacy hashes before paint
- give SiteLayout a required pageKind, real nav links, data-page-section and a
  blocking head theme init; site-chrome owns the theme toggle on every page
- mount one section per page in js/app.js, fetch data from absolute /data/…,
  report load errors on the current mount and expose body[data-boot]
- move lookup group/id and team return state onto query params with per-route
  allowlists; freeze the legacy root-query key set in js/legacy-routes.js
- extend sitemap, dist verifier, _headers and the localization policy, then
  republish the generation and re-pin team-route-handles.json
```
