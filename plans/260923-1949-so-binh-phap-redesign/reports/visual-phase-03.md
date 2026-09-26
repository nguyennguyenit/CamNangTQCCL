# Phase 3 — Báo cáo: header, menu thả, menu mobile, footer

Ngày: 2026-09-25 · Plan `260923-1949-so-binh-phap-redesign`, [phase-03](../phase-03-header-footer.md).
Phạm vi: header 2 biến thể + menu thả + menu mobile toàn màn hình (`js/site-nav.js` thay `js/mobile-section-menu.js`),
footer dùng chung mọi `pageKind`, ấn 兵 SVG, liên kết chính thức, chip ngày build.
**Bộ A2 đầy đủ đã chạy xanh sau khi land mọi việc của phase** (§6).
Chưa commit — orchestrator commit sau go/no-go.

## 1. Việc đã làm (theo bước trong phase file)

| Bước | Nội dung | Trạng thái |
|---|---|---|
| 1 | Header trang trong 1 hàng 72px: ấn 兵 40px SVG, tên trang serif 19px + tagline, nav Đội chuẩn · Đội khác · Cùng Tồn · Khai hoang · Tra cứu · Công cụ [Beta] ▾ · Game ▾, mục đang xem gạch chân son 3px, nút sáng/tối 44×44 | xong |
| 2 | Header Landing 76px: Đội hình ▾ · Tra cứu ▾ · Công cụ ▾ · Game ▾ · Về cẩm nang · sáng/tối · CTA "Mở cẩm nang"; mỗi nút chỉ mở nhóm của mình, panel neo dưới đúng nút | xong |
| 3 | `js/site-nav.js`: aria-expanded/aria-controls, mở một menu đóng menu khác, Escape trả focus, click ngoài đóng, Tab ra khỏi menu đóng; menu mobile toàn màn hình khóa cuộn, focus vào ✕, Escape/✕ trả focus về ☰, Tab trap | xong |
| 4 | Footer dùng chung mọi `pageKind`: cột giới thiệu + chip "Dữ liệu cập nhật dd/mm/yyyy" (memo một lần, `Asia/Ho_Chi_Minh`) + 4 cột + dải "Game chính thức" (5 link NPH + Tải game + 3 link cộng đồng) + dòng cuối 2 cột; bỏ nút sáng/tối và hàng "Nguồn dữ liệu"; mục "Góp ý" không render | xong |
| 5 | Link ngoài `target="_blank" rel="noopener noreferrer"` + icon ↗ aria-hidden + chữ ẩn "(mở tab mới)" **ở cả ba bề mặt shell** (menu thả desktop, lớp phủ mobile, dải footer) theo `entry.external`; mailto và link nội bộ không có `target`/chữ ẩn nhưng mailto vẫn giữ ↗ theo artboard (`entry.offsite`); không nhúng ảnh/logo NPH | xong — §4 |
| 6 | Vùng bấm mobile: link cột footer và dòng menu ≥ 44px (đo: min 44px trên 24 link footer) | xong |
| 7 | Chữ UI mới khai `authored-vi`; 4 obligation `translate` của `SiteLayout.astro` giữ nguyên tại chỗ, không đổi chữ | xong — §5 |
| 8 | 6 cặp so ảnh phase 3 (header Main/MobileList, LandingMenu, LandingMenuMobile, footer Landing/LandingMobile) × 2 theme | xong — §3 |

### File tạo mới
- `js/site-nav.js` (+ `entry("js","site-nav")` trong manifest), `tests-js/site-nav.test.mjs`
- `src/lib/official-links.ts` (một nguồn: 5 link chính thức + 3 cộng đồng + 3 tải game + `DATA_SOURCE_HREF`/`DOWNLOAD_HREF` + `EXTERNAL_REL`)
- `src/lib/build-date.ts` (`formatBuildDate` thuần + `buildDateVi()` memo), `tests-js/build-date.test.mjs`
- `src/lib/seal.ts` (path ấn 兵 trích nguyên văn từ `tokens.json`)

### File sửa
`src/layouts/SiteLayout.astro`, `js/site-chrome.js`, `js/unified-lookup.js` (export `LOOKUP_GROUP_LABELS` dùng chung cho chip và menu), `src/lib/public-artifact-manifest.mjs`, `css/styles.css`, `docs/design/so-binh-phap/tokens.json`, `scripts/design-compare.mjs`, `docs/design-guidelines.md`, `docs/code-standards.md`, `pipeline/site_localization.py`, `pipeline/site-localization-policy.json`, `pipeline/team-route-handles.json`, `data/website-display.json`, generation `src/data/recommended-reference/`, `tests-js/frontend-shell-contract-assertions.mjs`, `tests-js/unified-lookup.test.mjs`, `tests-js/{site-nav,build-date}.test.mjs` (mới), `tests-e2e/{spa-parity,recommended-browser,unified-lookup,season-lookup,team-detail-pages}.spec.mjs`.

### File xoá
`js/mobile-section-menu.js`, `tests-js/mobile-section-menu.test.mjs`, `entry("js","mobile-section-menu")` — cutover nguyên khối, không để alias.

## 2. Vi mô (tự động)

`node scripts/design-tokens.mjs --check`: **pass** — `:root` khớp `tokens.json`; 0 mã màu ngoài khối token; **0 giá trị thô ngoài khối legacy**; khối legacy **657 → 603 giá trị thô** trên 285 selector, `ceiling` hạ xuống **603** (đúng số còn lại; phần xoá là rule header/nav/nav-tab/footer/skip-link của phase này).

`node scripts/design-compare.mjs --tokens --phase 03` (đo cả trạng thái **menu thả đang mở** và **menu mobile đang mở ở 390px**, nhờ `probe.width` mới):

```
118/118 thuộc tính khớp token (theme light, phase 3); 0 lệch chưa giải thích.
118/118 thuộc tính khớp token (theme dark, phase 3); 0 lệch chưa giải thích.
```

`node scripts/design-compare.mjs --tokens --phase 01` (không hồi quy sau khi header đổi):
```
117/118 thuộc tính khớp token (theme light, phase 1); 0 lệch chưa giải thích.
đã giải thích: select-nhan-caps line-height = normal — form control, token bị Chrome bỏ qua (giữ nguyên ngoại lệ của Phase 1)
```

Token/component thêm (đều ghi nguồn artboard):
- màu: `accent-strong #7E1620` (link hover ×26 + hover CTA), `footer-bg #141210` (×2), `band-good #7FC99E` (chấm trạng thái ×5), `focus-ring-band #E36A6F` (StyleGuide Focus trên dải)
- chữ: `tagline 12/1.4/400`, `nav-badge 10/1.2/600`, `header-title 19px/700`, `header-title-landing 20px/700`, `header-title-mobile 16px/700` (đều serif, nguồn `Main.dc.html:25`, `Landing.dc.html:22`, `MobileList.dc.html:26`, `LandingMobile.dc.html:23`, `LandingMenuMobile.dc.html:23`)
- component mới: `header-trong`, `nut-cta`, `link-ngoai`, `menu-mobile`, `footer-dung-chung` (mỗi mục có `probes` thật); `menu-tha` và `an-binh-phap` được thêm probe (trước đó phase 3 sở hữu nhưng chưa đo được gì)

## 3. Bố cục (người duyệt)

6 ảnh ghép × 2 theme ở `.cache/design-compare/phase-03{,-dark}/` (không commit). Cặp ảnh của phase dùng `clip` đỉnh (header) và `clip.bottom` mới (footer — cắt đủ cả footer, mobile 1280px).

| Artboard | Trang | Đã xem | Kết luận |
|---|---|---|---|
| Main (cắt 0–72) | `/doi-chuan/` | light + dark | **đã sửa**: dải tối, ấn 40px, tên trang serif, gạch chân son 3px, nút sáng/tối 44px, Công cụ/Game ▾ đúng artboard |
| MobileList (cắt 0–64) | `/doi-chuan/` @390 | light + dark | **đã sửa**: ☰ 44px, ấn 32px, tên trang 16px, nút sáng/tối 44px không viền (đã bỏ viền theo `MobileList.dc.html:29`) |
| LandingMenu | `/` @1440 | light + dark | **đã sửa**: 4 menu thả neo dưới nút, panel nền `--panel` radius 14 bóng `--shadow-menu`, mục tên 15/600 + mô tả 12.5, chip cộng đồng/tải game radius 999 |
| LandingMenuMobile (setup ☰) | `/` @390 | light + dark | **đã sửa**: lớp phủ toàn màn hình, đầu menu ✕ + ấn + tên + nút sáng/tối, nhãn nhóm son caps, dòng 52px có mô tả + mũi tên, CTA cuối |
| Landing (cắt đáy 580) | `/` @1440 | light + dark | **đã sửa**: cột giới thiệu 2fr + 4 cột + dải "Game chính thức" + dòng cuối 2 cột |
| LandingMobile (cắt đáy 1280) | `/` @390 | light + dark | **đã sửa**: khối giới thiệu tràn 2 cột, lưới cột 2×2, dải game thành cột lưới 2 cột, dòng cuối xếp dọc |

### Lệch có chủ đích (giữ, có lý do)

| Chỗ | Artboard | Thực tế | Lý do |
|---|---|---|---|
| Tagline header | `Binh Diễn Xuân Thu · tham khảo` | tagline tĩnh theo trang của Phase 2 (`Duyệt đội hình theo mùa nguồn`…) | `season-registry.json` không có cờ "mùa hiện tại"; README design ghi mùa trong artboard là dữ liệu mẫu (phase bước 1) — Kongming #3 APPROVE |
| Chip "Kịch bản Binh Diễn Xuân Thu · tham khảo" ở footer | có | **bỏ** | cùng lý do trên; không gán một kịch bản bất kỳ làm "hiện hành" |
| Chữ credit | `Build bởi Nguyễn Nguyên … Team 2 bang Huynh Đệ` | `Được xây dựng bởi … Team 2 bang Huynh Đệ` | giữ nguyên văn bản đã duyệt của `ui:layout/build-credit`; đổi chữ `translate` cần receipt người duyệt — Kongming #1 APPROVE |
| Cao header | trang trong 72px, Landing 76px, mobile 60px | đúng | 76 = `control.72 + space.4`; 60 = `control.44 + space.16` |
| Tên trang header | 19 / 20 / 16px | đúng theo token mới | Kongming #4 CHANGE |
| Nút sáng/tối trong menu mobile | có (artboard) | có, cùng một bộ điều khiển với nút header (`data-theme-toggle`, đồng bộ nhãn + `aria-pressed`) | Kongming #2 CHANGE; mobile Landing đóng thì ẩn nút ở header và giữ CTA "Mở" đúng `LandingMobile.dc.html:22-23` |
| Nhóm "Tra cứu" trong menu mobile | 6 dòng con | 6 dòng con, tiêu đề nhóm là **link** `/tra-cuu/` (≥44px, `aria-current` khi đang ở Tra cứu) | Kongming #5 CHANGE — bỏ dòng "Tra cứu" thừa |
| Mô tả trong menu | mọi mục có mô tả | link cộng đồng/tải game chỉ có nhãn | đúng `LandingMenuMobile.dc.html:27` (hàng 48px label-only) — Kongming #6 APPROVE |
| Bề rộng panel menu thả | 320/480/340/500px | đúng | px của artboard; bề rộng không thuộc thang token nên `width` là giá trị duy nhất không qua token (chỉ nằm trong `style` inline của khối menu) |
| Ẩn/không dùng chữ Hán thay chân dung | — | không đổi | ngoài phạm vi phase |

## 4. Kiểm trên trình duyệt thật (Chromium, preview `dist/`)

- **Desktop** (`/doi-chuan/`, `/`): mở từng menu bằng chuột và bằng Enter; mở menu này đóng menu kia; Escape đóng và trả focus về nút; bấm ra ngoài đóng; đi hết mục rồi Tab ra ngoài đóng; link trong menu vẫn là anchor thật (điều hướng `/cung-ton/` bình thường, không `preventDefault`).
- **Mobile 390px**: ☰ mở lớp phủ toàn màn hình, `html`+`body` `overflow: hidden` (cuộn nền đứng yên khi `scrollBy`), focus vào ✕, Escape và ✕ đều đóng + trả focus về ☰, Shift+Tab từ ✕ quấn về CTA cuối, bấm link con đóng menu và điều hướng, resize lên desktop đóng menu và mở khóa cuộn.
- **Header**: 72px (trang trong) / 76px (Landing) / 60px (mobile); ấn 40px (desktop) và 32px (mobile); tên trang 19/20/16px; nút sáng/tối 44×44 (desktop có viền, mobile không); ở 390px tên trang đủ chỗ **không ellipsis** (chỉ ellipsis ở 320px — fallback).
- **Footer**: có mặt ở Landing, 8 trang mục, 3 họ trang chi tiết và 404, cùng một chip "Dữ liệu cập nhật 25/09/2026"; link footer mobile cao ≥ 44px; ở 390px toàn site không cuộn ngang; không còn chuỗi "Góp ý".
- **Link ngoài (audit theo giao thức, ba bề mặt)**: trên `/`, `/doi-chuan/`, `/tra-cuu/` — menu thả desktop **10** link HTTP(S), lớp phủ mobile **10**, dải footer **7**; **mọi** link đó có `target="_blank"`, `rel="noopener noreferrer"`, chỉ báo ↗ `aria-hidden` và chữ ẩn "(mở tab mới)". Link **mailto** (3 chỗ: menu, lớp phủ, footer) **không** có `target` và **không** có chữ ẩn, vẫn giữ ↗; **0** link nội bộ có `target`. Một link menu tiêu biểu (`Trang chủ game`) được bấm thật với đích do test kiểm soát: tab mới mở đúng host, trang hiện tại không đổi, menu đóng lại như disclosure.
- **Lịch sử & vòng đời**: mở lớp phủ rồi Back/Forward **cùng tài liệu** (đổi mùa ở Cùng Tồn bằng `pushState`): URL và mùa trở lại đúng theo URL, lớp phủ `hidden`, `aria-expanded="false"`, `html` mất `site-menu-open`, `body` hết `overflow: hidden` và cuộn nền dùng lại được; `Forward` trả lại đúng mùa. Rời trang bằng điều hướng khác tài liệu (menu đang mở) rồi quay lại: không giữ lớp phủ lẫn khóa cuộn. Không reload, không giành focus, không thêm store điều hướng thứ hai.

## 5. Policy bản dịch (bước 7)

### Obligation
- **Thêm 53 obligation `authored-vi`**: 22 chuỗi khối lượng cố định của shell (tên trang, nhãn menu/nhóm, nhãn aria, chip ngày, credit, mô tả footer, CTA) + 8 mô tả mục nội bộ + 6 mô tả nhóm Tra cứu + 16 nhãn/mô tả link chính thức (`src/lib/official-links.ts`). Không cần receipt (lớp `authored-vi`).
- 4 obligation `translate` của `src/layouts/SiteLayout.astro` (`ui:layout/team-chuan`, `team-khac`, `beta`, `build-credit`) **giữ nguyên tại chỗ, không đổi chữ** ⇒ **không có obligation nào bị dời file hoặc đổi chữ** ⇒ không cần receipt độc lập (coverage giữ 5591/5591, receipt 5591).

### Policy
- `sourceFiles`: 45 → **49** (thêm `js/site-nav.js`, `src/lib/official-links.ts`, `src/lib/seal.ts`, `src/lib/build-date.ts`; làm mới hash `src/layouts/SiteLayout.astro`, `js/site-chrome.js`, `js/unified-lookup.js`). Định dạng JSON giữ nguyên một dòng như trước.
- `policyVersion`: `site-vi-260925-duong-dan-layout` → `site-vi-260925-header-footer`.

### baseline.notes cũ → mới
| Khóa | Cũ | Mới |
|---|---|---|
| `concreteLocationCount` | 56 280 | **56 333** (+53 obligation mới) |
| `concreteInventorySha256` | `3fd137df…` | **`9e8fbcea…`** |
| `siteLedgerObligations` / `translationObligations` / `uiTranslateObligations` | 2 088 / 5 591 / 68 | không đổi (chỉ thêm `authored-vi`) |
| `approvedDisplaySlots` / `blocks` / `hanBlocks` / `uniqueRawTexts` / `lookupReviewObligations` | 11 / 1967 / 1928 / 1123 / 3503 | không đổi |

### Generation + re-pin
`build --stage all` → `check --stage all --candidate` (exit 0) → `publish` → `check --stage public` (exit 0, `uiPending` 68, 0 problem) → `pipeline/team-route-handles.json` `generationId`:

```
1056a9a2b440e8794954f2bdaf26e348fb5f26d7019e2fd2606ac7d5e30364d6   (Phase 2)
→ 38bae7dc9ed30efbedaa17d454e2b206a6e623bcfa37fd86302fdc2b704bfb3f   (Phase 3, chốt)
```

Generation trung gian sinh trong lúc làm (`db2c70bd…`, `dcd4372c…`, `b1bc8961…`, `13826c39…`, `f0a1142e…`, `b6ce5424…`, `35a45429…`) đã xoá — không file nào tham chiếu; chỉ generation chốt nằm trong cây.
`python3 -m pipeline.team_route_handles --check` pass (1366 recommended / 166 legacy / 17 Khai hoang).
`tests/test_site_localization.py`: **không phải sửa số ghim** (2088/68/5591 và `coverage.missing` không đổi vì không thêm chuỗi `translate`).

## 6. Gate (bộ A2)

| Lệnh | Kết quả |
|---|---|
| `npm run check` | pass — 0 error, 0 warning, 1 hint có trước (`team-detail-routes.ts`) |
| `npm run build` | pass — 1559 trang |
| `npm run verify` | pass — `site_localization check --stage public` + 1725 file dist (54 raw asset, 16 file `public/` tĩnh) |
| `npm run test:dist` | **28/28 pass** |
| `npm run test:node` | **334/334 pass** |
| `npm run test:e2e` | **pass — 197/197** (189 của Phase 2 + 8 test mới của phase này; 1 test outbound cũ được thay) |
| `python3 -m unittest discover -s tests` | **368 OK** |
| `node scripts/design-tokens.mjs --check` | pass (legacy 603 = ceiling 603) |
| `node scripts/design-compare.mjs --tokens --phase 03` (+`--theme dark`) | 118/118 · 118/118, 0 lệch chưa giải thích |

### 6b. Kiểm độc lập của Kongming (2026-09-25, preview riêng cổng 4377, không do người thực thi chạy)

Đạt: menu thả desktop (độc quyền, Escape trả focus, Tab ra ngoài, click ngoài, aria-expanded ↔ panel), lớp phủ mobile
(fill viewport, focus ✕, khóa cuộn html/body, Tab/Shift+Tab quấn vòng, Escape/✕ trả focus + mở khóa, resize 390→1440),
theme (một bộ điều khiển, hai nút đồng bộ cả hai chiều), chữ header (1440: 76px/20px và 72px/19px; 390: 60px/16px,
tên trang đủ chỗ; 320: ellipsis không tràn), footer (13 tài liệu: Landing, 8 mục, 3 họ chi tiết, 404 — một footer,
cùng chip ngày, link mobile ≥44px, không placeholder "Góp ý"), bản dịch (không đổi ledger/receipt/`translate`),
chi tiết cấu hình + list→detail→Back (2 test Playwright scoped pass; tự bấm link chi tiết thật: 82 thẻ + scrollY 915
được phục hồi). Không đạt (đã sửa ở §10): outbound của menu và menu-state khi Back cùng tài liệu.

## 7. Test sửa/thêm có chủ đích + lý do

1. `tests-js/mobile-section-menu.test.mjs` **xoá** cùng module bị xoá; thay bằng `tests-js/site-nav.test.mjs` (DOM giả tối thiểu): mở độc quyền, Escape trả focus, click ngoài, Tab ra khỏi menu, khóa cuộn, focus trap quấn vòng, Escape và nút ✕ trả focus (đóng do điều hướng link, `popstate`, `pagehide` chỉ dọn trạng thái, không giành focus), resize đóng cả hai loại menu.
2. `tests-js/frontend-shell-contract-assertions.mjs`: regex mục đang xem nới từ `class="nav-tab active"` sang "có class `active` + `data-section` + `aria-current=page`" (mục công cụ nằm trong menu thả nên không còn class `nav-tab`); thêm khẳng định shell mới: 2 nút `data-theme-toggle` (header + menu mobile), mỗi nút menu thả có `aria-controls` trỏ panel đang `hidden`, footer có chip ngày + credit đã duyệt + không "Góp ý", mọi `target="_blank"` có đủ `noopener`+`noreferrer`.
3. `tests-e2e/spa-parity.spec.mjs`: 2 test cũ chuyển sang DOM mới (`.section-nav.open` → `#section-menu-items` + `aria-expanded`; bấm link công cụ phải mở menu "Công cụ" trước — helper `clickSectionLink`); thêm 6 test theo Verification của phase (menu thả bằng chuột/bàn phím + Escape + click ngoài + Tab, menu mobile 390px khóa cuộn + trả focus + nút sáng/tối đồng bộ, `rel` của mọi link `_blank`, `aria-current` trên 8 trang, footer 4 loại trang cùng ngày, nhóm Tra cứu 6 dòng + tiêu đề là link).
4. `tests-e2e/team-detail-pages.spec.mjs`: 404 mobile kiểm `#section-menu-items` hiện + `aria-expanded` thay cho class `.section-nav.open`.
5. `tests-e2e/{recommended-browser,unified-lookup,season-lookup}.spec.mjs`: link nav tra bằng `navLink()` scope vào `.site-nav` (desktop) hoặc `#section-menu-items` (mobile đang mở) — footer cũng có link cùng tên nên truy vấn toàn trang sẽ khớp 2 phần tử. Hai vòng lặp theo bề rộng đóng menu mobile bằng nút ✕ trong lớp phủ thay vì bấm lại ☰: lớp phủ toàn màn hình che header nên ☰ không còn bấm được khi menu đang mở (đúng thiết kế).
6. `tests-js/unified-lookup.test.mjs` (test đọc mã nguồn shell): khối nav đổi từ `SECTIONS.map(...<a>` sang `!landing && topSections.map(...<a>` và thêm khẳng định mục trong menu thả cũng là `<a>` có `data-section`/`href`/`aria-current`.
7. `scripts/design-compare.mjs`: thêm `clip.bottom` (cắt đáy cho cặp footer) và `probe.width` (đo trạng thái chỉ có ở mobile); cặp phase 3 setup đúng nút ("Đội hình" cho LandingMenu, ☰ cho LandingMenuMobile).
8. `tests-js/site-nav.test.mjs` thêm ca "change giả (bề rộng không đổi) không đóng menu" — công cụ chụp ảnh toàn trang của
   Chromium phát `MediaQueryList change` dù bề rộng không đổi, làm menu thả tự đóng giữa lúc chụp; handler resize nay chỉ
   hành động khi trạng thái desktop **thật sự đổi**.
9. `tests-js/site-nav.test.mjs` thêm ca "popstate và pagehide dọn cả hai loại menu cùng khóa cuộn" (không giành focus);
   `tests-e2e/spa-parity.spec.mjs` thay test `a[target="_blank"]` cũ (và bỏ hẳn khẳng định sai ".site-nav không có
   target=_blank") bằng **audit theo giao thức** trên ba bề mặt + bấm thật một link menu với đích kiểm soát, thêm hai
   regression lịch sử (Back/Forward cùng tài liệu; rời trang khác tài liệu rồi quay lại). `tests-js/frontend-shell-contract-assertions.mjs`
   thêm khẳng định tĩnh: mọi `target="_blank"` phải là HTTP(S) + đủ `noopener`/`noreferrer`, mailto không có `target`/chữ ẩn.
10. Không test nào bị nới lỏng để né lỗi: mọi thay đổi trên đều do DOM/điều hướng đổi có chủ đích.

## 8. Rủi ro còn lại / việc của phase sau

1. **Phase 4 (Landing)**: header Landing đã xong; phần thân Landing vẫn là markup tạm của Phase 2 (`landing-cards`, `landing-sections`). Hai anchor `/#nguon-du-lieu` và `/#tai-game` do Phase 4 dựng — hiện link đã đúng đích nhưng chưa có phần tử để cuộn tới.
2. **Phase 4**: `src/pages/index.astro` còn mảng `SECTIONS` riêng cho khối "Tất cả mục" và obligation `ui:root/*` bám file đó — giữ nguyên khi dựng Landing mới.
3. **Nút sáng/tối trên mobile Landing khi menu đóng**: chỉ còn CTA "Mở"; đổi theme phải mở menu (đúng `LandingMobile.dc.html`). Nếu Phase 10 muốn nút luôn hiện thì phải xét lại bề rộng tên trang.
4. **Dark theme**: chỉ mới đo token + so ảnh ghép; đánh giá tương phản/bảng tối đầy đủ vẫn thuộc Phase 10.
5. **Chi tiết cấu hình**: `js/app.js:178` vẫn lấy `.top-header` làm mốc cuộn; header nay thấp hơn (72px thay ~100px) nên mốc cũ vẫn an toàn (test `opening detail keeps its close control below the sticky navigation` xanh trong bộ e2e).
6. `.cache/design-compare/` và `.cache/p3/` là scratch (đã gitignore).

## 9. Gợi ý commit

```
feat(shell): rebuild header, dropdown menus, mobile menu and shared footer

- add js/site-nav.js (one owner for dropdowns and the fullscreen mobile menu)
  and delete js/mobile-section-menu.js with its manifest entry and test
- rebuild SiteLayout header in two variants (inner 72px, Landing 76px, mobile
  60px) with the 兵 seal, real nav links, dropdown groups and one synced theme
  toggle pair (header + mobile menu)
- add the shared footer for every pageKind: intro column, build-date chip,
  four link columns, official/community game strip and credit line
- move official game, community and download links into src/lib/official-links.ts
  and memoize the Asia/Ho_Chi_Minh build date in src/lib/build-date.ts
- extend tokens/components (header, CTA, external link, mobile menu, footer) with
  source-backed values and measure opened-menu states in design-compare
- refresh the localization policy (53 authored-vi obligations, 4 new source
  files, baseline notes), republish the generation and re-pin route handles
```

## 10. Sửa theo NO-GO của Kongming (2026-09-25)

| # | Phát hiện | Sửa |
|---|---|---|
| P2 | Link HTTP(S) trong cả hai menu thiếu `target`/`rel`; link mobile thiếu chữ ẩn "(mở tab mới)"; footer gắn `target=_blank` cho cả mailto | Cả ba renderer dùng chung `entry.external` (HTTP(S) → `target` + `EXTERNAL_REL` + ↗ + chữ ẩn; mailto/nội bộ → không `target`, không chữ ẩn) và `entry.offsite` cho chỉ báo ↗ (mailto vẫn có mũi tên theo artboard). Test cũ chỉ soi `a[target="_blank"]` đã bị thay bằng audit theo giao thức trên 3 bề mặt (10 + 10 + 7 link) + bấm thật một link menu với `context.route` kiểm soát đích |
| P2 | Back cùng tài liệu để lớp phủ mở và giữ khóa cuộn | `js/site-nav.js` thêm `clearTransientState` gọi trong `popstate` và `pagehide`: đóng cả menu thả lẫn lớp phủ, mở khóa cuộn, **không** reload/không giành focus/không thêm store; hành vi URL-owned và phục hồi cuộn của Phase 2 giữ nguyên. Regression: unit (popstate/pagehide) + e2e Back/Forward cùng tài liệu (URL/mùa/lớp phủ/khóa cuộn/cuộn nền) + e2e rời trang khác tài liệu rồi quay lại |
| P2 | Báo cáo claim sai về outbound/mailto | §1 bước 5 và §4 viết lại theo bằng chứng thật (số link theo bề mặt, mailto không `target`/không chữ ẩn, popup kiểm soát); §6 tách rõ số chạy bởi người thực thi khỏi phần Kongming kiểm độc lập (§6b) |

## 11. Vòng sửa Opus (re-review độc lập, 2026-09-26)

Rà soát độc lập tại HEAD `b89b1ad` (`'/Users/plateau/.omp/agent/sessions/-Project-CamNangTQCCL/2026-09-24T22-09-56-961Z_01a0d577-dae1-736c-8498-7e6dfd3aabd6/OpusRevB.md'`) kết luận Phase 3 **NO-GO** với 3 finding chặn
(P3-B1…B3) và 5 nit. Vòng này xử lý hết, mỗi finding có regression e2e riêng.

| # | Phát hiện | Sửa | Bằng chứng |
| --- | --- | --- | --- |
| **P3-B1** | Panel "Game" bị cắt khỏi khung nhìn và tạo cuộn ngang: `css/styles.css` có `.nav-dropdown-game .nav-menu{left:auto;right:0}` nhưng `SiteLayout.astro` không bao giờ gắn class đó (panel 1122→1622 ở khung 1440) | `<li class:list={['nav-dropdown', menu.key === 'game' && 'nav-dropdown-game']} data-dropdown>` — rule neo phải đã có sẵn, chỉ thiếu class | e2e `spa-parity.spec.mjs`: mở **từng** `[data-dropdown-button]` trên `/`, `/doi-chuan/` và một trang chi tiết ở 1280 và 1440 → panel left ≥ 0, right ≤ `clientWidth`, `scrollWidth == clientWidth`. Đo lại: Game ở `/doi-chuan/` = [632, 1132] @1280 và [712, 1212] @1440; ở `/` @1280 = [358, 858]; 0 cuộn ngang |
| **P3-B2** | Header vỡ trong 821–1260px (nhãn nav xuống 2 dòng "Đội/chuẩn", tagline tràn khỏi dải 72px); tagline 2 dòng ở 320 | `.nav-tab{white-space:nowrap}`; `.tagline{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`; khối mới `@media (max-width:1279px){.site-nav{display:none}.site-menu-toggle{display:inline-flex}}`; `DESKTOP_QUERY='(min-width: 1280px)'` trong `js/site-nav.js` | e2e: 821/1024/1180/1279 → nav ẩn, ☰ hiện 44×44, mở được lớp phủ, Escape trả focus; resize **1024 → 1280** đóng lớp phủ, mở khóa cuộn, ☰ ẩn; 1280/1440 mọi nhãn nav đúng **1 hộp dòng** (đo bằng hộp dòng của text node); 320 tagline cao đúng 1 dòng, đáy ≤ đáy header, cắt bằng ellipsis; 390/1024 hiện trọn chữ, không cắt. Đo lại: header 320 → 60px, 821/1024/1180/1279 → 72/76px, không cuộn ngang |
| **P3-B3** | Trang 404 không có lề trang (thẻ `.detail-state` trải hết chiều rộng vì `not-found` không nhận `detail-content`) | `contentClass = pageKind === 'detail' \|\| pageKind === 'not-found' ? 'content detail-content' : 'content'` | e2e: 404 @1440 thẻ left = left thương hiệu = **48**; @390 left = **16** (≥ 16); @320 left = 16; 0 cuộn ngang |
| N1 | Landing có **hai** `<h1>` (tên thương hiệu + tiêu đề hero) | Tên thương hiệu ở header Landing: `<h1 class="site-title">` → `<span class="site-title">` | e2e: `/` có đúng **1** `<h1>`; `npm run test:dist` khẳng định `dist/index.html` có 1 `<h1>` và brand là `<span class="brand-text"><span class="site-title">` |
| N2 | Trang chi tiết đánh dấu link mục cha bằng `aria-current="page"` (sai: link đó không phải trang đang mở) | helper `currentMark(id)` = `pageKind === 'detail' ? 'true' : 'page'`, dùng cho link nav phẳng, mục trong menu thả và dòng menu mobile | e2e: trang chi tiết → link mục cha `aria-current="true"`, **0** link `aria-current="page"` trong `.site-nav`; trang mục vẫn `"page"`. `khaihoang-options.spec.mjs` (trang chi tiết Khai hoang) sửa theo đúng hành vi mới |
| N3 | Nút menu thả khai `aria-haspopup="true"` dù panel là danh sách link (disclosure, không phải `role=menu`) | bỏ thuộc tính trong `SiteLayout.astro` | e2e: 0 phần tử `[aria-haspopup]` trên `/` và trang chi tiết; `test:dist` khẳng định `dist/index.html` + `dist/doi-chuan/index.html` không còn `aria-haspopup`; shell assertion thêm luật cấm cho mọi nút menu thả |
| N4 | Mô tả `meta name="description"` của `/doi-chuan/` còn "và **điểm**" (bộ lọc điểm đã bỏ từ Phase 5) | `src/pages/doi-chuan/index.astro` → "…lọc theo phe, loại binh và mùa nguồn."; obligation `ui:section-page/doi-chuan` cập nhật theo (lớp `authored-vi` ⇒ không cần receipt) | `test:dist` khẳng định chuỗi mới trong `dist/doi-chuan/index.html`; `site_localization check --stage public` 0 problem sau khi publish lại |
| N5 | Footer không chạm đáy ở trang ngắn (404 @1440×900 còn ~110px nền phía dưới) | `body{display:flex;flex-direction:column;min-height:var(--size-viewport)}` + `main{flex:1 0 auto}` (token mới `size.viewport` = `100dvh`) | e2e: 404 @1440×900 đáy footer = **900** = `innerHeight`; `min-height` computed của `body` = 900px; 390/320 không phát sinh cuộn ngang |

Token/component thêm trong vòng này (đều ghi nguồn trong `tokens.json`): `size.viewport` (100dvh),
`size.col-60/120/230/200/80` (bề rộng cột bảng chiến pháp — dùng ở Phase 7), `size.fact-label` (Phase 7),
`type.badge-chip`, `type.chip-pill`; `badge` thêm 2 biến thể viên 26px kèm probe; `chip-loc` và `bang`
thêm `7` vào `phaseUsed` để probe `/tra-cuu/` thật sự chạy trong gate Phase 7.

### Gate sau vòng sửa

| Lệnh | Kết quả |
| --- | --- |
| `npm run check` / `npm run build` / `npm run verify` | pass (0 error/warning; 1559 trang; gate bản dịch public 0 problem) |
| `npm run test:dist` | **28/28 pass** |
| `npm run test:node` | **349/349 pass** |
| `npm run test:e2e` | **271/271 pass** |
| `python3 -m unittest discover -s tests` | **379 OK** |
| `node scripts/design-tokens.mjs --check` | pass — legacy **0** giá trị thô / 0 selector (`ceiling` 0) |
| `design-compare --tokens --phase 03` (+dark) | **136/136** · **136/136**, 0 lệch chưa giải thích |
| `design-compare --phase 03` (+dark) | 6 ảnh ghép mỗi theme ở `.cache/design-compare/phase-03{,-dark}/` |

### Test sửa/thêm có chủ đích (vòng này)

1. `tests-e2e/spa-parity.spec.mjs` **thêm 6 ca**: panel menu thả trong khung nhìn + neo phải của Game; header
   821–1279 dùng ☰ (mở/Escape/focus) và 1280 mọi nhãn một hộp dòng; resize 1024→1280; tagline 320 một dòng
   trong dải; 404 có lề trang + footer chạm đáy; Landing một `h1` + trang chi tiết `aria-current="true"` +
   không `aria-haspopup`.
2. `tests-e2e/recommended-browser.spec.mjs`, `tests-e2e/unified-lookup.spec.mjs`: ngưỡng "đang ở mobile" đổi từ
   `width <= 820` sang `width < 1280` — mốc thu gọn nav nay là 1280px; các bề rộng đang chạy (320/375/768 và
   1280) giữ nguyên hành vi.
3. `tests-e2e/khaihoang-options.spec.mjs`: khẳng định `aria-current` trên trang chi tiết Khai hoang đổi từ
   `"page"` sang `"true"` (N2: link mục cha không phải trang hiện tại) + thêm khẳng định `.site-nav` không còn
   `aria-current="page"` trên trang chi tiết.
4. `tests-js/astro-dist-contract.test.mjs`: thêm khẳng định `dist/index.html` một `h1`, brand là `span`, không
   `aria-haspopup` (Landing + `/doi-chuan/`), và mô tả `/doi-chuan/` đúng chữ mới (bỏ "điểm").
5. `tests-js/frontend-shell-contract-assertions.mjs`: thêm luật "nút menu thả không được có `aria-haspopup`".
6. `tests-js/unified-lookup.test.mjs`: hai khẳng định đọc mã nguồn shell cập nhật theo biểu thức `currentMark(...)`
   (biểu thức `aria-current` cũ không còn trong `SiteLayout.astro`).
