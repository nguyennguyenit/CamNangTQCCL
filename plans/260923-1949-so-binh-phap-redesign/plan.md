---
title: "Redesign Sổ binh pháp toàn site"
description: "Đưa toàn bộ Cẩm Nang TQCCL sang giao diện Sổ binh pháp đúng canvas: Landing ở /, mỗi mục một đường dẫn, header/footer dùng chung, token sáng/tối, font self-host."
status: pending
priority: P1
effort: "23.5d"
branch: main
tags: [frontend, feature, routing, design]
blockedBy: [260922-1806-khai-hoang-trang-chi-tiet]
blocks: []
created: 2026-09-24
---

# Redesign Sổ binh pháp toàn site

## Contract

Nguồn chuẩn: [brainstorm-260923-2001-so-binh-phap-redesign.md](../reports/brainstorm-260923-2001-so-binh-phap-redesign.md) — Outcome §1, Constraints §2 + §10.3, Non-goals §3, Acceptance §4, quyết định §5/§6/§10.2/§10.7, rà design §11. Plan không lặp lại toàn văn; mỗi phase ghi rõ mục contract nó thực hiện.

- **Outcome:** mọi trang (Landing, 8 trang mục, chi tiết đội, 404) mang giao diện Sổ binh pháp đúng canvas ở 1440 và 390, sáng + tối.
- **Chuẩn thị giác:** mã nguồn `docs/design/so-binh-phap/project/*.dc.html` (giá trị) + ảnh `docs/design/so-binh-phap/screens/*.png` (bố cục). Chỗ artboard trái contract → contract thắng theo bảng brainstorm §11.4.
- **Không làm:** tính năng ngoài canvas (trừ Thẻ/Bảng), đổi dữ liệu/engine/Worker/schema lưu trữ, self-host ảnh chân dung, đổi 5 tên "…cảm tử", đổi URL chi tiết đội đã đóng băng, implement artboard DirA/B/C, deploy.

## Điều kiện bắt đầu

- **Chặn bởi** plan `260922-1806-khai-hoang-trang-chi-tiet` — **đã gỡ 2026-09-24:** plan đó `status: completed`, code ở commit `68a49b3`; kiểm trên cây sau commit: `npm run check` 0 lỗi, `npm run test:node` 316/316, `python3 -m unittest discover -s tests` 368 OK, `npm run test:e2e` 153/153, `npm run verify` (gate bản dịch public + 1700 file dist) và `npm run test:dist` 27/27 pass.
- Trước khi bắt đầu Phase 1, `git status --short` không được còn file code/pipeline đang sửa dở. **Đã dọn 2026-09-25:** 8 thư mục generation Recommended chưa track, không file nào tham chiếu, và `site-compile.log` đã chuyển sang `~/.Trash/CamNangTQCCL-cleanup-260925/` (khôi phục được); plan `260626-1600` → `cancelled` commit `2e351b6`; brainstorm + plan này commit `e4df36b`. Chỉ còn `.cache/` chưa track (Phase 1 thêm vào `.gitignore`).
- Phase 1 đọc lại mọi file nó sửa; số dòng trích dẫn lấy từ cây làm việc ngày 2026-09-24.

## Bằng chứng hiện trạng

- **Shell trùng lặp:** `src/pages/index.astro:14-27,29-55,73-75` tự viết head/header/footer; `src/layouts/SiteLayout.astro:52-65,68-96,106-108` viết lại lần nữa, có nhánh `pageKind: root` riêng (`:5-14,25-41,84-93`).
- **SPA theo hash:** 8 mục `team-chuan, team-khac, coexist, khaihoang, lookup, recruit-tracker, analyze, roster-recommend`, mặc định `team-chuan` (`js/app.js:36,57`); alias `team-pk`, `meta-cu` → `team-khac` (`js/app.js:58,84-98`); `#heroes`, `#tactics`, `#lookup?group=&id=` (`js/unified-lookup.js:27-45,129-131`). `app.js` import tĩnh mọi module, mount cả 8 mục (`js/app.js:1-23,424-486`).
- **Link trỏ `/#…`:** `SiteLayout.astro:75,91`, `src/pages/404.astro:16-18`, `src/pages/doi-khac/[team].astro:36`, `src/pages/khai-hoang/[team].astro:31`, `familyReturnHref` (`js/team-detail-navigation.js:149-162`), `safeReturnUrl` chỉ nhận pathname `/` (`js/team-detail-navigation.js:7,121-146`).
- **CSS:** một file `css/styles.css` 921 dòng; token ở `:root` và `:root[data-theme="dark"]` (`:2-51`); 39 mã hex nằm ngoài khối token. Chưa có `@font-face`, font hệ thống.
- **Asset:** manifest chỉ nhận `js/css/data` (`src/lib/public-artifact-manifest.mjs:1-53`); file `public/` phải khai báo trong verifier (`scripts/verify-astro-dist.mjs:16-19,61-89`) và `_headers` + test (`tests-js/pages-headers-contract.test.mjs:8-19,75-93`).
- **Theme:** khóa `theme`; không có giá trị lưu → theo `prefers-color-scheme` (`js/site-chrome.js:5-13,28-38`). Brainstorm §5 #5 ghi "mặc định sáng" là không chính xác; plan **giữ hành vi hiện tại**.
- **Bản dịch:** policy khóa sha256 của 36 file nguồn, lệch → `stale`, chặn `check` (`pipeline/site_localization.py:605-615,1858-1861`); không có lệnh làm mới hash — sửa trường `sourceFiles` bằng `sha256_hex()` (`:341-342,493-499`). Chữ UI phải khai báo trong `UI_LITERAL_OBLIGATIONS` (`:267-338`); chỉ lớp `translate` cần receipt người duyệt độc lập (`draftSession != reviewerSession`, `:1095-1100`); lớp `authored-vi` không cần receipt (`:1333-1368`). Đúng 8 section id (`:52-60,524-527`) và đúng 3 route family (`:62,527-530`).
- **Test bám cấu trúc cũ:** tab/hash ở `tests-e2e/spa-parity.spec.mjs:121-125,163-220,477-495`, `unified-lookup.spec.mjs:13-69,102-115`, `recommended-browser.spec.mjs:18-69,407-444`, `season-lookup.spec.mjs:23-49`, `team-detail-pages.spec.mjs:288-289,312-385`, `khaihoang-options.spec.mjs:50-51,135-137,392-394`, `mcp-domain-compatibility.spec.mjs:10-13,72-80`, `site-localization.spec.mjs:59-71`; class bị test bắt liệt kê ở Phase 1.
- **Trang `/` đang mang payload và phần tử mà `app.js` bắt buộc có:** `#season-controls` (`index.astro:61`, `app.js:211` gọi `.after` không kiểm null), `#season-artifact-hashes` (`:77`, thiếu → `seasonModel` rỗng im lặng, `app.js:188`), `#team-route-handles` đủ `{r,l,k}` (`:78`, ≈70 KB); `SiteLayout` chỉ phát `{l}` cho trang chi tiết (`SiteLayout.astro:46-48,112-114`).
- **Fetch dữ liệu tương đối:** `app.js:146,184,193` dùng `./data/…` — đúng ở `/`, 404 ở `/doi-chuan/`; trang chi tiết đã dùng `/data/…` (`team-detail.js:74`, `khaihoang-detail.js:29`).
- **Migrate URL tham chiếu cũ:** `?detail=` / `?legacyTeam=` trên mọi tab được `migrateLegacyReferenceUrl` chuyển sang trang chi tiết, `config` thắng (`app.js:199-203`, `team-detail-navigation.js:371-392`); cần `recommendedModel.index` và `teams.json`.
- **Phạm vi mùa + chi tiết cấu hình:** select Mùa / Phiên bản luật (`scenario`, `ruleset`) ở Cùng Tồn, Soi đội, Gợi ý đội (`app.js:100-115,395-422`); chi tiết `?config=` trong `#season-detail-mount` trên 5 mục (`app.js:210-260`); nút nhập kho gọi `switchSection('roster-recommend')` (`app.js:258`, `render.js:569`). Không có artboard; `season-lookup.spec.mjs` bắt hơn 10 ca.
- **Allowlist URL quay lại:** `safeReturnUrl` loại **cả URL** khi có khóa ngoài `ROOT_QUERY_KEYS` (`team-detail-navigation.js:14,140-143`).

## Quyết định kỹ thuật

1. **Mục = trang tĩnh.** 8 trang `src/pages/<đường-dẫn>/index.astro` dùng `SiteLayout` với `pageKind="section"` + `activeSection`; mỗi trang chỉ có một mount `section-<id>`. Layout gắn `data-page-section` lên `<body>` (không dùng `data-section` vì nav đã dùng thuộc tính này, `SiteLayout.astro:90`); `js/app.js` đọc giá trị này và chỉ **mount** mục đó (bỏ tab, `hashchange`, `switchSection`). **Không tối ưu tải dữ liệu theo mục trong plan này:** `loadWebsiteDisplay` tải + xác minh hash mọi nguồn trong `sourceHashes` trước khi rẽ nhánh (`js/app.js:153-158`, `js/website-display.js:86-91`), và `_headers` đặt `must-revalidate` cho `/data/*` nên lần chuyển mục sau chỉ là revalidate. Phase 2 giữ nguyên tập dữ liệu khởi động và **đo** (byte truyền lần mở trang mục thứ hai) vào báo cáo; tối ưu tải là plan riêng nếu số đo xấu.
   - **Sửa 2026-09-25 (Phase 7, quyết định uỷ quyền của Kongming P06b/P07):** một ngoại lệ hẹp đã được duyệt cho
     câu "không tối ưu tải dữ liệu theo mục": trang `/tra-cuu/` **không nạp generation Đội chuẩn** (`index.json`,
     `other-teams.json`, `seasons.json`) trước khi mở hồ sơ đầu tiên — đây là yêu cầu của Verification Phase 7 và
     của phương án số liệu lúc build (dưới, quyết định #12). `js/app.js` chỉ nạp generation cho hai trang danh sách
     (`team-chuan`, `team-khac`) và dùng bảng `#team-route-handles` đã phát sẵn để migrate URL cũ; `loadWebsiteDisplay`
     và bộ xác minh hash khởi động giữ nguyên. Ngoại lệ này **không** mở đường cho việc tối ưu tải theo mục ở các
     trang khác.
2. **Trạng thái trên query, giữ tên khóa cũ:** bộ lọc đội giữ `season, category, q, detail, legacyTeam, legacyVariant, faction, unit, subcategory, source`; bỏ `score`; thêm `view=bang`. Tra cứu chuyển `group`, `id` từ hash sang query của `/tra-cuu/`. **`safeReturnUrl` đổi từ "gặp khóa lạ → loại cả URL" sang "giữ khóa được phép của đúng trang, bỏ lặng lẽ mọi khóa khác"** (gồm `score`, `fbclid`, `gclid`, `msclkid`, `utm_*`); danh sách khóa được giữ theo pathname (Phase 2 bước 7). URL `from` cũ dạng `/…#<tab>` được chuẩn hóa qua cùng bảng ánh xạ của Landing thay vì bị loại.
3. **Landing `/`** = `src/pages/index.astro` dùng `SiteLayout` `pageKind="landing"`. Bảng ánh xạ hash cũ nằm ở **một** nguồn `js/legacy-routes.js` (ESM thuần, không import): export bảng + hàm thuần `resolveLegacyRoute(href, origin)` trả đích cùng origin hoặc `null`, dựng đích bằng `URL`/`URLSearchParams`. Hai nơi dùng: (a) `index.astro` import lúc build và nhúng vào **script inline chặn trong `<head>`** (`resolveLegacyRoute.toString()` + bảng JSON) để chuyển tiếp trước khi vẽ trang, kèm listener `hashchange`; (b) `safeReturnUrl` import ở trình duyệt để chuẩn hóa `from`/snapshot cũ. Không có `js/landing.js` riêng trừ khi Landing có tương tác khác.
4. **Điều hướng dùng chung:** entry mới `js/site-nav.js` lo menu thả (Công cụ, Game; Landing thêm Đội hình, Tra cứu) và menu mobile toàn màn hình; thay hẳn `js/mobile-section-menu.js` (xóa file + test cũ, không để alias).
5. **CSS một file.** Giữ `css/styles.css` (không tách): khối token → khối CSS cũ `legacy` (thu dần qua các phase, Phase 1 bước 2) → nền → component → theo trang. Không có mã hex hay giá trị vi mô thô ngoài khối token (trừ khối legacy đang thu). Tránh thêm manifest/verifier cho file CSS mới (`tests-js/astro-dist-contract.test.mjs:609-612` đang khóa `/css/styles.css`).
6. **Font self-host** trong `public/fonts/`: Be Vietnam Pro 400/500/600/700 + Noto Serif Display 700, chỉ subset latin + latin-ext + vietnamese, `font-display: swap`, preload 2 file dùng ngay màn đầu; kèm `public/fonts/OFL.txt`. Ấn 兵 là SVG path (trích từ Noto Serif TC Bold một lần); chữ Hán thay chân dung dùng serif hệ thống.
7. **Chữ UI + gate bản dịch:** chữ tác giả mới khai báo lớp `authored-vi` (không cần receipt). Mọi thay đổi obligation (thêm, dời file, bỏ) và mọi thay đổi policy đi qua quy trình bản dịch ở mục "Quy trình bắt buộc mỗi phase" bước 2 — gồm cập nhật baseline inventory và publish lại generation. Obligation `translate` bị **dời file** hoặc **đổi chữ** cần receipt độc lập (fingerprint gồm `sourceFile`/`ownerSymbol`, `pipeline/site_localization.py:1355-1368`); người dùng sắp xếp phiên review, agent không tự duyệt. **Bỏ** một obligation `translate` không cần receipt mới: xóa tuple + mục ledger + item tương ứng trong batch receipt (receipt chỉ phủ vị trí còn trong ledger, `:1137-1140`; đã chạy thử, xem Phase 2 bước 9). Ưu tiên giữ nguyên obligation bằng cách để chữ đã duyệt còn trong đúng file nguồn.
8. **Quyết định nội dung đã chốt 2026-09-24:** thẻ Khai hoang giữ build + Trước → Sau + thanh điểm 6 mốc, hướng dẫn chữ ở trang chi tiết, dòng cuối thẻ là link "Hướng dẫn đánh đất →"; ô tổng quan Cùng Tồn hiện nguyên `notesRaw`/`openingSuggestionsRaw`, "5 đội · 15 tướng · không trùng" tính từ mảng tướng; ngày cập nhật = ngày build (dd/mm/yyyy, giờ Việt Nam), mục "Góp ý, báo lỗi" ẩn đến khi có kênh; credit sửa thành "dành cho game".
9. **Thẻ đội:** dòng cuối gộp "Sợ …" (lấy từ counters `avoid`), "Thay thế (n)", "Chi tiết →"; "Khắc được" chỉ còn ở trang chi tiết; bỏ glyph ⚔/⚠.
10. **Trang mục tự đủ:** layout phát cho trang mục mọi payload `app.js` đọc (bảng ở Phase 2 bước 2, `{r,l,k}` cho cả 8 trang); `app.js` fetch `/data/…` tuyệt đối; lỗi tải hiện ở mount của mục đang mở.
11. **Giữ phạm vi mùa, chi tiết cấu hình và migrate URL cũ** — không bỏ tính năng đang có dù canvas không vẽ. Phase 2 giữ hành vi; Phase 8 (Cùng Tồn) và Phase 9 (Soi đội, Gợi ý đội) làm giao diện theo StyleGuide. Dữ liệu thật hiện có 2 kịch bản, 0 phiên bản luật, 0 cấu hình reviewed → chỉ select Mùa làm đầy đủ; select Phiên bản luật và chi tiết cấu hình chỉ áp token, kiểm bằng fixture test. URL `/` không hash nhưng có khóa root cũ → `/doi-chuan/` + query (mục mặc định cũ).
12. **"Trong cẩm nang" (Phase 7) nối tướng bằng so khớp chính xác theo từng nguồn:** Đội chuẩn — `nameRaw` ↔ `chinese`/`aliases[]` (bỏ khoảng trắng), 4071/4098 ô khớp, 0 mơ hồ; Đội khác — `holders[].nameRaw` (tên Việt) ↔ `hanViet` (duy nhất trên 202 tướng), 120/120 ô khớp. Phase 7 **bắt đầu bằng spike đo tải** (`index.json` gzip ≈ 309 KB + hash + parse, mobile chậm) trước khi dựng UI; trung vị > 2 s → dừng ngay đầu phase, hỏi người dùng về phương án tính lúc build.
   - **Sửa 2026-09-25 (Phase 7):** spike bước 0 đã chạy và **trượt** ngân sách (trung vị 2058 ms > 2 s ở 390px,
     cache trống, Fast 3G, CPU ×4). Người dùng đã uỷ quyền quyết định cho Kongming; Kongming P06b duyệt **phương án
     tính lúc build** và Phase 7 đã làm đúng hợp đồng đó: payload `hero-summaries.json` sinh trong **chính generation
     Recommended đang pin** (khóa nối chính xác theo từng nguồn như trên, **đếm cả Đội khác**, thứ tự đội tiêu biểu
     theo danh sách bản ghi đã sắp phát ra `index.json`), descriptor mang hash kho Tra cứu nên đổi kho là generation
     đổi; trang hồ sơ chỉ tải `manifest.json` + `hero-summaries.json` (đo lại sau vòng sửa P07: 1029 ms trung vị; lần đo trước vòng sửa 1041 ms) và đối chiếu
     `provenance.catalogSha256` với hash kho Tra cứu đã xác minh trong `website-display.json`. Không publish
     `pipeline/recommended-identity-map.json`. Kongming P07 đã chấp thuận kiến trúc này và giữ nguyên ngân sách 2 s.
13. **Theme không nháy giữa các trang:** script inline chặn trong `<head>` của `SiteLayout` đặt `data-theme` từ `localStorage.theme` (lỗi storage → `prefers-color-scheme`) trước stylesheet; `site-chrome.js` giữ nút đổi và áp lại theme ở `pageshow` + sự kiện `storage`.
14. **Quy tắc render an toàn (mọi phase):** nội dung động chỉ qua `el()`/`textContent`; không `innerHTML`/`insertAdjacentHTML`/`outerHTML` với dữ liệu; SVG tĩnh viết trong Astro hoặc `createElementNS`; mọi `href` ra ngoài lấy từ dữ liệu phải qua kiểm scheme `http(s)` (tổng quát hóa validator ở `recommended-reference-state.js:172-181`); link ngoài `target="_blank" rel="noopener noreferrer"` như code hiện có (`js/render.js:372,515`); query link dựng bằng `URLSearchParams`.
15. **Golden master theo tầng.** Artboard **không** là golden master pixel: dữ liệu trong artboard là mẫu (`docs/design/so-binh-phap/README.md:17`), chiều cao là ước tính (`:16`), ảnh chụp qua shim tự viết còn lệch dưới 1px (`:25-26`), và có chỗ contract cố ý thắng artboard (brainstorm §11.4). Chia tầng:
    - **Vi mô** — golden master là `docs/design/so-binh-phap/tokens.json` (trích từ inline style 24 artboard trang + `renderVals()`, giữ đúng giá trị, mỗi token có nguồn). CSS chỉ dùng token (`scripts/design-tokens.mjs --check`); trang thật được đo `getComputedStyle` so với token (`scripts/design-compare.mjs --tokens`). Tự động, lệch phải sửa hoặc ghi ngoại lệ có nguồn.
    - **Cấu trúc** — thứ tự khối, component có mặt, anchor, aria: e2e kiểm DOM (tự động).
    - **Bố cục** — ảnh `screens/*.png` đặt cạnh ảnh trang thật (`design-compare`), người duyệt ghi "đã sửa / giữ, lý do"; không pass/fail pixel.
    - Chỉ dùng bản chụp đã commit (`1790191281-3a81`); canvas đổi thì chụp lại có chủ đích, ghi phiên bản, cập nhật `tokens.json` qua `--extract`.
    - Chụp site đã duyệt làm mốc chống vỡ giao diện về sau (fixture cố định, font tự host, che ngày build) **ngoài phạm vi plan này**, quyết sau Phase 10.
16. **Component dùng lại.** Danh mục component nằm trong `tokens.json` (mục `components`: selector, cấu tạo, biến thể, trạng thái, thuộc tính → token, artboard nguồn, phase sở hữu, phase dùng). Phase 1 làm component nền và đặc tả component phức tạp (thẻ đội, dòng tướng, bảng, menu thả, hộp thoại, thanh điểm); phase sở hữu đầu tiên làm, phase sau dùng lại. Thiếu component → thêm vào danh mục trước (cùng commit), không viết CSS riêng một trang cho thứ đã có component.

## Quy trình bắt buộc mỗi phase

1. Đọc artboard của phase (mã nguồn + PNG) và mục `components` trong `tokens.json` trước khi viết CSS. Chỉ ghép component có trong danh mục, giá trị qua token; thiếu thì bổ sung danh mục/token trước (ghi nguồn artboard), không chép inline style, không viết px/hex trực tiếp.
2. **Quy trình bản dịch** (bắt buộc khi phase sửa file trong `sourceFiles`, obligation hoặc policy — gần như mọi phase):
   a. **Trước khi sửa một file**, liệt kê obligation của nó (`python3 -c "from pipeline.site_localization import UI_LITERAL_OBLIGATIONS as U; [print(o) for o in U if o[3]=='<file>']"`). Kiểm tra chỉ là chuỗi con trong đúng file đó (`site_localization.py:1240-1244`): obligation có biểu thức binding (phần tử thứ 8) phải giữ **nguyên văn** biểu thức; obligation không binding phải còn chữ gốc hoặc chữ đã duyệt (`textVi` trong ledger). Số obligation ở các file bị viết lại nhiều: `js/recruit-tracker.js` 21, `js/roster-recommend-ui.js` 10 (2 binding), `src/pages/index.astro` 6, `src/pages/doi-chuan/[team].astro` 5, `js/analyze.js` 4 (2 binding), `src/layouts/SiteLayout.astro` 4, `src/pages/doi-khac/[team].astro` 4, `js/app.js` 3 (1 binding: `displayValue(websiteDisplay, "ui:app/load-error", "errorTemplate")`), `js/team-filter-section.js` 3, `js/render.js` 1 (binding). Sửa code + `UI_LITERAL_OBLIGATIONS`. Obligation `translate` bị dời file/đổi chữ → ghi vào báo cáo phase và **dừng** tới khi có receipt độc lập (`pipeline/site-translation-reviews.json`). Obligation `translate` bị bỏ → xóa tuple + mục ledger `pipeline/site-translations.json` + item trong batch receipt, không cần review mới.
   b. Cập nhật `sourceFiles` hash và `baseline.notes` (`concreteLocationCount`, `concreteInventorySha256`, `siteLedgerObligations`, `translationObligations`, `uiTranslateObligations` khi đổi) bằng script — không sửa tay: hash qua `sha256_hex()`; số và digest inventory lấy từ `python3 -m pipeline.site_localization inventory --root . --report <file>` (mục `unknownLocationDetails[].actual`, `translation.siteLedgerEntries`, `translation.expectedObligations`). Giữ nguyên định dạng JSON của policy/ledger. Ghi cũ → mới vào báo cáo phase (tiền lệ: `68a49b3` đổi `concreteLocationCount` 56240 → 56265).
   c. Publish lại theo `docs/season-team-data.md:184-190`: `site_localization build --stage all --output .cache/site-localization-candidate` → `check --stage all --candidate …` → `publish --candidate …` → `check --stage public`. Policy thuộc `localizationInputsHash` (`site_localization.py:1503-1517`) nên mỗi lần đổi policy sinh generation Recommended mới + `data/website-display.json` mới.
   d. Sửa `generationId` trong `pipeline/team-route-handles.json` sang generation mới (build từ chối lệch, `src/lib/team-detail-routes.ts:207-210`) → `python3 -m pipeline.team_route_handles --check`. Payload trùng nội dung nên git lưu lại blob cũ; chỉ manifest/descriptor mới.
   e. Cập nhật số ghim trong `tests/test_site_localization.py` nếu đổi (đã thấy khi chạy thử: `uiPending`/`uiValues` ở `test_data_stage_defers_ui_values_while_full_candidate_stays_strict`, số site obligations ở `test_policy_covers_full_site_and_required_owners`, tổng obligations ở `test_recommended_only_completed_ledger_cannot_pass_full_site_gate`); khởi động lại dev server.
3. **Gate mỗi phase = bộ A2 đầy đủ**, xanh trước khi commit: `npm run check && npm run build && npm run verify && npm run test:dist && npm run test:node && npm run test:e2e && python3 -m unittest discover -s tests`; cộng test đích của phase. Không sửa test để né; test đổi có chủ đích phải ghi lý do trong commit.
4. Báo cáo `plans/260923-1949-so-binh-phap-redesign/reports/visual-phase-NN.md`:
   - **Vi mô (tự động):** `node scripts/design-tokens.mjs --check` pass (0 giá trị thô ngoài khối legacy, hạ `ceiling` legacy xuống đúng số còn lại) và `node scripts/design-compare.mjs --tokens --phase NN` cho component của phase ở cả sáng và tối → 0 lệch chưa giải thích.
   - **Bố cục (người duyệt):** `node scripts/design-compare.mjs --phase NN`, liệt kê từng chỗ lệch → "đã sửa" hoặc "giữ, lý do". Ảnh ghép ở `.cache/design-compare/` (không commit).
5. Commit riêng mỗi phase, conventional, không nhắc AI. Không deploy.

## Phases

| # | Phase | Artboard | Phụ thuộc |
|---|---|---|---|
| 1 | [Token (`tokens.json`), danh mục component, font, component nền, công cụ so ảnh + đo token](./phase-01-token-font-nen.md) | StyleGuide + inline style 24 artboard | — |
| 2 | [Tách đường dẫn + layout chung](./phase-02-duong-dan-layout.md) | — (cấu trúc) | 1 |
| 3 | [Header, menu thả, menu mobile, footer](./phase-03-header-footer.md) | header mọi artboard, LandingMenu, LandingMenuMobile, footer Landing | 2 |
| 4 | [Landing + Tải game](./phase-04-landing.md) | Landing, LandingMobile | 3 |
| 5 | [Đội chuẩn / Đội khác: lọc, thẻ, Thẻ/Bảng](./phase-05-doi-danh-sach.md) | Main, MainTable, MobileList, MobileTable, MobileFilters | 3 |
| 6 | [Trang chi tiết đội](./phase-06-chi-tiet-doi.md) | TeamDetail | 5 |
| 7 | [Tra cứu + hồ sơ](./phase-07-tra-cuu.md) | Lookup, LookupTactics, LookupProfile, LookupMobile | 3 |
| 8 | [Cùng Tồn + Khai hoang](./phase-08-cung-ton-khai-hoang.md) | Coexist(+Mobile), Khaihoang(+Mobile) | 5, 6 (dùng lại khối build Khai hoang) |
| 9 | [3 công cụ Beta](./phase-09-cong-cu-beta.md) | Recruit, Analyze, Roster (+Mobile) | 3, 7, 8 (helper chân dung, style phạm vi mùa) |
| 10 | [Giao diện tối, a11y, responsive, docs, full test](./phase-10-toi-a11y-docs.md) | StyleGuide (bảng tối) | 1–9 |

Một người thực thi tuần tự 1 → 10. Phase 4, 5, 7 cùng phụ thuộc Phase 3; Phase 8 thêm Phase 6; Phase 9 thêm Phase 7, 8; tất cả đều sửa `css/styles.css` và `pipeline/site-localization-policy.json` (và publish lại generation) → không chạy song song.

## Acceptance (theo brainstorm §4)

- [ ] A1: Vi mô — `design-tokens.mjs --check` pass với khối legacy đã xóa (`ceiling` = 0) và `design-compare.mjs --tokens` trên mọi trang × 2 theme có 0 lệch chưa giải thích so với `tokens.json`. Bố cục — mỗi artboard trang có báo cáo so ảnh ở đúng bề rộng artboard (1440 hoặc 390), mọi chỗ lệch đã xử lý hoặc có lý do; artboard không phải golden master pixel (quyết định #15). StyleGuide (1280, không có trang tương ứng) soát bằng `tokens.json` + tương phản ở Phase 1.
- [ ] A2: `npm run check`, `npm run build`, `npm run verify`, `npm run test:dist`, `npm run test:node`, `npm run test:e2e`, `python3 -m unittest discover -s tests` pass ở **mọi** commit phase; test chỉ đổi khi hành vi đổi có chủ đích.
- [ ] A3: `site_localization check --stage public` pass, không problem; số obligation mới được ghi trong báo cáo Phase 10.
- [ ] A4: Giao diện tối: chữ thường ≥ 4.5:1, chữ ≥ 24px ≥ 3:1; màu phe/binh/trạng thái luôn có chữ đi kèm.
- [ ] A5: Mobile vùng bấm ≥ 44px, không cuộn ngang ở 320/390; focus-visible rõ; menu thả và hộp thoại: `aria-expanded`, Escape đóng, focus quay về nút, bấm ngoài để đóng, hộp thoại khóa focus.
- [ ] A6: Mọi hash cũ (§ bảng Phase 2) và URL `/` không hash có khóa root cũ chuyển đúng đường dẫn mới, giữ query, kể cả khi dán vào tab đang ở `/`; `?detail=` / `?legacyTeam=` cũ vẫn mở đúng trang chi tiết; URL chi tiết đội không đổi và `from` cũ dạng `/…#<tab>` vẫn quay về đúng trang mục + query.
- [ ] A7: `docs/design-guidelines.md`, `docs/code-standards.md`, `docs/system-architecture.md`, `docs/deployment-guide.md`, `docs/unified-lookup.md`, `README.md` mô tả đúng mô hình đường dẫn + token mới; `docs/project-changelog.md` có mục cho redesign.

## Rủi ro

- Mỗi phase sinh một generation Recommended mới (quy trình bước 2c–d). Nội dung payload thường giống hệt nên git lưu lại blob cũ (đã kiểm: `index.json` của `b60b51…` và `91768e…` cùng hash), nhưng cây làm việc thêm ~6,7 MB mỗi lần; không xóa generation cũ đã track trong plan này.
- Snapshot quay lại cũ trong `sessionStorage` chứa URL `/#…` → chuẩn hóa qua `js/legacy-routes.js` như `from` (quyết định #2); không khớp bảng → về trang mục mặc định.
- Dev server giữ snapshot pin trong bộ nhớ (`src/lib/root-static-artifacts.ts`): sau publish phải khởi động lại.
- Receipt độc lập là việc của người dùng: chỉ phase có obligation `translate` **dời file** hoặc **đổi chữ** mới dừng chờ. Theo plan hiện tại không phase nào bắt buộc việc đó (Phase 2 giữ 5 obligation `ui:root/*` tại chỗ và bỏ `ui:root/build-credit` không cần receipt; nhãn nav `ui:layout/*` giữ trong `SiteLayout.astro`). Nếu lúc làm buộc phải dời/đổi một chuỗi `translate` → dừng, báo người dùng.
- Ảnh chân dung hotlink có thể bị chặn → fallback chữ Hán phải test bằng route chặn ảnh, chặn **mọi** host có trong `heroes-dict.json` (`image.aligames.com` 92, `cloud.lingxigames.com` 20; 90 tướng không có ảnh).
- Thẻ/Bảng với dữ liệu Đội khác: `value` vắng trong `other-teams.json` (0/40) → cột Điểm hiện "—", không bịa.
- "Sợ …" / "Khắc được" chỉ có ở dữ liệu legacy: 0/1366 Đội chuẩn, 9/40 Đội khác → thẻ và trang chi tiết Đội chuẩn lệch artboard có chủ đích.
- Chiều cao artboard là ước tính (brainstorm §8): so bố cục và giá trị, không so pixel dọc.

## Red Team Review

### Session — 2026-09-24

4 reviewer (Security, Failure Mode, Assumption, Scope) đều lỗi 429 rate limit sau ~2 phút, không trả finding. Người lập plan tự rà các giả định chịu lực bằng grep; **chưa có review độc lập** — nên chạy lại `/ak:plan red-team plans/260923-1949-so-binh-phap-redesign` khi hết giới hạn, trước khi cook.

**Findings:** 6 (6 accepted, 0 rejected) · 0 Critical, 4 High, 2 Medium

| # | Finding | Severity | Bằng chứng | Áp vào |
|---|---|---|---|---|
| 1 | Chia trang nhưng `app.js` vẫn tải toàn bộ dữ liệu mỗi lần → mỗi lần chuyển mục tải lại tất cả; câu "không tăng tải" sai | High | `js/app.js:154-196` | Quyết định #1, Phase 2 bước 3b (cách sửa "tải theo mục" đã thay bằng finding #18, 2026-09-25) |
| 2 | `khaiHoangContextKey` và snapshot quay lại dựa vào hash `#khaihoang`; test ghim URL hash | High | `js/team-detail-navigation.js:174-182,287-305`; `tests-js/team-detail-navigation.test.mjs:163-215` | Phase 2 bước 7 |
| 3 | Parser Tra cứu từ chối mọi khóa lạ → link có `utm_*`/`fbclid` hiện lỗi khi chuyển sang query | High | `js/unified-lookup.js:34-36` | Phase 2 bước 4 |
| 4 | Consumer của `mobile-section-menu.js` là `site-chrome.js` + manifest, không phải `app.js` | High | `js/site-chrome.js:3`; `src/lib/public-artifact-manifest.mjs:34` | Phase 3 files |
| 5 | `pageKind` mặc định `'root'` + `isRoot`; `legacyRouteSegments` chỉ nạp cho `detail` | Medium | `src/layouts/SiteLayout.astro:19,42-48` | Phase 2 bước 1 (phần route handles đã thay bằng finding #7, 2026-09-25) |
| 6 | Thanh điểm Khai hoang nằm trong `guide.ratings`, chỉ 11/17 đội có | Medium | `data/khaihoang.json:188` (11 lần `ratings`) | Phase 8 bước 3 |

Đã kiểm, không thành finding: nội dung thô Cùng Tồn đi qua `el()` gán text (`js/render.js:1`), `innerHTML` trong Tra cứu chỉ là chuỗi tĩnh (`js/unified-lookup.js:175,242,252`); chuyển tiếp hash ở Landing dùng bảng cố định nên không mở open redirect; `group` của Cùng Tồn và Tra cứu ở hai trang khác nhau nên không đụng nhau.

### Whole-Plan Consistency Sweep
- Đã đọc lại: plan.md, phase-01 … phase-10.
- Thay đổi quyết định đã rà: 6 (tải dữ liệu theo mục, context key Khai hoang theo đường dẫn, parser query, consumer menu mobile, `pageKind` bắt buộc, nguồn `ratings`).
- Chỗ cũ đã sửa theo: 6. Mâu thuẫn còn lại: 0.

### Session — 2026-09-25

4 reviewer lại lỗi 429 (retry-after ≈ 2,6 giờ). Audit chạy trong phiên chính, đối chiếu từng claim chịu lực với code ở HEAD `d8873ea` và đo dữ liệu dist/generation đang pin. **Vẫn chưa có review độc lập.**

**Findings:** 10 (10 accepted, 0 rejected) · 1 Critical, 5 High, 4 Medium

| # | Finding | Severity | Bằng chứng | Áp vào |
|---|---|---|---|---|
| 7 | Trang mục thiếu `#season-controls` (crash boot), `#season-artifact-hashes` (mất mô hình mùa im lặng), route handles `{r,k}`; plan chỉ chuyển `index.astro:62-75` | Critical | `app.js:135,188,211,491`; `index.astro:61,77-80`; `SiteLayout.astro:46-48` | Quyết định #10, Phase 2 bước 1–2 |
| 8 | `app.js` fetch tương đối `./data/…` → 404 dưới `/<mục>/` | High | `app.js:146,184,193` | Quyết định #10, Phase 2 bước 3 |
| 9 | Bảng chuyển tiếp bỏ sót URL không hash (`/?season=`, `/?detail=`) và migrate `detail`/`legacyTeam` xung đột với tải theo mục | High | `app.js:98,199-203`; `team-detail-navigation.js:371-392`; `recommended-browser.spec.mjs:81-102` | Quyết định #11, Phase 2 bước 3, 3b, 6, 10; A6 |
| 10 | Phạm vi mùa, chi tiết `?config=`, nút nhập kho không phase nào sở hữu | High | `app.js:100-115,210-260,258`; `render.js:569`; `season-lookup.spec.mjs` | Quyết định #11, Phase 2 bước 3, Phase 8 bước 2b, Phase 9 bước 3b |
| 11 | `view` ngoài `ROOT_QUERY_KEYS` → mọi URL Bảng mất `from`/snapshot; `score` bị loại làm hỏng `from` cũ | High | `team-detail-navigation.js:14,140-143`; `team-detail-navigation.test.mjs:169` | Quyết định #2, Phase 5 bước 3b |
| 12 | Khóa nối "Trong cẩm nang" không tồn tại: `index.json` không có ID tướng, identity map không có ID Tra cứu và không publish | High | `index.json` heroes keys; `pipeline/recommended-identity-map.json` entries; `other-teams.json` `heroIdentityId` khác namespace | Quyết định #12, Phase 7 bước 4b |
| 13 | Test chặn ảnh chỉ chặn `cloud.lingxigames.com`, 92/112 ảnh ở `image.aligames.com` | Medium | `data/heroes-dict.json` `iconUrl` | Phase 7 Verification, Rủi ro |
| 14 | "Sợ …" gần như không có dữ liệu (0/1366 Đội chuẩn) | Medium | `recommended-reference-render.js:147-155,198-225` | Phase 5 bước 5, Phase 6 bước 2, Rủi ro |
| 15 | Ví dụ 3b sai (Chiêu mộ cần bộ Tra cứu); lỗi tải luôn ghi vào `#section-team-chuan`; `initSiteChrome` có thể bị gọi 2 lần | Medium | `app.js:60,179,481-496`; `spa-parity.spec.mjs:468-470` | Phase 2 bước 1, 3, 3b |
| 16 | Redesign Cùng Tồn làm rơi phân loại phạm vi, `summaryRaw`, link nguồn, `disclaimerRaw`; thứ tự nhóm xung đột phạm vi mùa | Medium | `team-filter-section.js:235-239`; `render.js:498,511-516` | Phase 8 bước 1, 2, Verification |

Đã kiểm, không thành finding: số liệu Landing đều tính được (1366/26 mùa, 202, 406, 5×5, 17, 8 Chạm Sứ, 5 mỏ; con số 166 `teams.json` được sửa ở finding #38); `guide.ratings` 11/17; `index.json` 3.374.425 byte; trường adapter Bảng tồn tại; gate UI obligation chấp nhận chữ gốc hoặc bản dịch đã duyệt (`site_localization.py:1241-1244`) và chỉ `translate` cần receipt (`:1355-1358`); credit mới đúng brainstorm §10.2; `public/_headers` không có CSP nên font self-host/ảnh hotlink không cần đổi header.

### Whole-Plan Consistency Sweep — 2026-09-25
- Đã đọc lại: plan.md, phase-01 … phase-10.
- Thay đổi quyết định đã rà: 6 (payload trang mục, fetch tuyệt đối, giữ phạm vi mùa/config/migrate, allowlist `view`/`score`, khóa nối tướng, độ phủ counters).
- Chỗ cũ đã sửa theo: Phase 2 bước 1–3b, 6, 7, 10, Verification; Phase 5 files, bước 3b, 5; Phase 6 bước 2; Phase 7 bước 4b, Verification; Phase 8 files, bước 1, 2, 2b, Verification; Phase 9 files, bước 3b, dependencies; Phase 10 docs; plan.md bằng chứng, quyết định #2/#10–#12, bảng phase, A6, rủi ro.
- Mâu thuẫn còn lại: 0.

### Session — 2026-09-25 (review độc lập)

4 reviewer độc lập (Failure Mode / Flow Tracer, Assumption / Scope Auditor, Scope / Contract Verifier, Security / Fact Checker) chạy ở HEAD `d2d2fa4`, đều trả finding có bằng chứng. Phiên chính kiểm lại các finding chịu lực trước khi nhận: policy nằm trong `localizationInputsHash` (`site_localization.py:1503-1517`, `build_recommended_reference.py:376-379`); baseline inventory (`site_localization.py:1897-1901`); re-pin `generationId` (`team-detail-routes.ts:207-210`, tiền lệ `68a49b3`); `hanViet` duy nhất, 120/120 ô Đội khác khớp; 10 liên kết Cùng Tồn (5 `binh-dien-xuan-thu`, 5 `anh-hung-menh-the`); `qrcode@1.5.4` tồn tại; payload trùng giữa generation (`index.json` của `b60b51…` = `91768e…`).

**Findings:** 27 (27 accepted, 0 rejected) · 2 Critical, 10 High, 15 Medium. Một gợi ý con bị loại: bỏ `#season-artifact-hashes` khỏi Đội chuẩn/Đội khác (trái quyết định #11 giữ chi tiết cấu hình).

| # | Finding | Severity | Bằng chứng | Áp vào |
|---|---|---|---|---|
| 17 | Đổi policy (kể cả chỉ hash) làm đổi generation Recommended + website-display; phải publish lại + re-pin `team-route-handles.json` mỗi phase, plan không có bước này | Critical | `site_localization.py:1503-1517,1570-1579,1674-1682`; `build_recommended_reference.py:376-379`; `team-detail-routes.ts:207-210` | Quy trình bước 2c–d, Rủi ro, mọi phase |
| 18 | "Chỉ tải dữ liệu mục cần" không làm được như viết: `loadWebsiteDisplay` tải + xác minh ~2,1 MB trên mọi trang; e2e đếm request sẽ sai | High | `app.js:153-158`; `website-display.js:86-91` | Quyết định #1, Phase 2 bước 3b (bỏ tối ưu, chỉ đo) |
| 19 | Thêm/dời obligation (cả `authored-vi`) đổi baseline inventory đã khóa → gate đỏ, chặn `build`/`test:e2e` | Critical | `site_localization.py:1244-1256,1406-1418,1897-1901`; policy `baseline.notes` | Quy trình bước 2b, 2e |
| 20 | Dời obligation `translate` làm fingerprint + receipt mất hiệu lực; Phase 5 chờ receipt cho chuỗi không phải obligation | High | `site_localization.py:1146-1160,1355-1368`; `lookup_translations.py:37-46,90-97`; `recommended-reference-render.js:141,173` | Quyết định #7, Phase 2 bước 9, Phase 4, Phase 5 bước 8, Rủi ro |
| 21 | Verifier vẫn đòi route handles/season hashes/pin trên `dist/index.html` (nay là Landing) | High | `verify-astro-dist.mjs:120-153,239-246`; `astro-dist-contract.test.mjs:117-118,907-910,960-961` | Phase 2 bước 8, files |
| 22 | Theme tối nháy sáng mỗi lần chuyển trang; Back từ bfcache giữ theme cũ | High | `SiteLayout.astro:51,116-118`; `site-chrome.js:26-43` | Quyết định #13, Phase 2 bước 1, 10 |
| 23 | Phase 3–9 không chạy bộ test đang khóa file mình sửa (`test:dist`, Python) | High | `astro-dist-contract.test.mjs:26`; `test_site_localization.py:446-456` | Quy trình bước 3, A2, Verification mọi phase |
| 24 | `safeReturnUrl` loại cả URL khi có `fbclid`/`utm_*`, `group`/`id` Tra cứu, `group` Cùng Tồn (sửa #11 chưa đủ) | High | `team-detail-navigation.js:14,139-143,288-289`; `app.js:269-276` | Quyết định #2, Phase 2 bước 3, 7, Phase 5 bước 3b, Phase 8 files |
| 25 | Khóa nối Phase 7 khớp 0/120 ô Đội khác (`nameRaw` là tên Việt) | High | `other-teams.json` holders; `heroes-dict.json` `hanViet` | Quyết định #12, Phase 7 bước 4b |
| 26 | Link "Xem cả n đội chuẩn" → `?q=` cho số đội khác n (mùa mặc định, tìm chuỗi rộng) | High | `recommended-reference-state.js:45,115-128,150-160` | Phase 7 bước 4b |
| 27 | Ngân sách tải 2 s gần như chắc trượt, lại chỉ đo ở cuối phase | High | `recommended-reference-state.js:187-199`; gzip 308.928 B | Quyết định #12, Phase 7 bước 0 |
| 28 | Cùng Tồn mặc định có 10 nhóm, hai bộ cùng nhãn "Cùng tồn 1…5" | High | `season-context.js:349-350,365,368`; `season-content-links.json` | Phase 8 Goal, bước 1, Verification |
| 29 | Link chi tiết đã chia sẻ có `from=/…#<tab>` mất trạng thái quay lại | Medium | `team-detail.js:24-26`; `khaihoang-detail.js:58-59`; `team-detail-navigation.js:137-138,161-162` | Quyết định #2, #3, Phase 2 bước 7, A6, Rủi ro |
| 30 | Chuyển tiếp Landing chưa đặc tả: dựng đích an toàn, `hashchange`, vẽ trang trước khi chuyển, `/?score=` mất chuyển sau Phase 5 | Medium | `unified-lookup.js:33-35`; `app.js:93-98,129`; `team-detail-navigation.js:14` | Quyết định #3, Phase 2 bước 5–6, 10 |
| 31 | Grep "`/#` = 0" của Phase 2 mâu thuẫn link `/#nguon-du-lieu` của Phase 3 | Medium | `SiteLayout.astro:91` | Phase 2 bước 7, Phase 3 bước 4 |
| 32 | Phase 3 yêu cầu `rel="noopener"`, trái quy ước `noopener noreferrer` và brainstorm link chính thức | Medium | `render.js:372,515`; `recommended-reference-render.js:295`; `khaihoang-options.spec.mjs:280` | Quyết định #14, Phase 3 bước 5, Phase 4 bước 4 |
| 33 | 92/112 chân dung là `http://` (mixed content trên HTTPS), thiếu `referrerpolicy` | Medium | `heroes-dict.json:308,532`; `analyze.js:202`; `unified-lookup.js:319-324` | Phase 7 files, bước 2, Verification |
| 34 | Không có quy tắc render text-only / kiểm scheme `href` cho bề mặt mới | Medium | `unified-lookup.js:175`; `render.js:10,372`; `recommended-reference-state.js:172-181` | Quyết định #14, Phase 6 bước 1, Phase 7 bước 2, Phase 9 bước 2, Phase 10 bước 5 |
| 35 | Sinh asset bằng công cụ không ghim phiên bản, không ghi nguồn gốc | Medium | `package.json`; fontTools chưa cài; `verify-astro-dist.mjs:16-19` | Phase 1 bước 3–4, Phase 4 bước 4 |
| 36 | Phụ thuộc ẩn `.top-header`, `.tagline`; tagline "mùa hiện tại" không có nguồn dữ liệu | Medium | `app.js:127,224`; `season-lookup.spec.mjs:49,368` | Phase 1 bước 5, Phase 2 bước 1, 3, Phase 3 bước 1 |
| 37 | `data-section` trên `<body>` trùng thuộc tính nav | Medium | `SiteLayout.astro:90`; `season-lookup.spec.mjs:47`; `frontend-shell-contract-assertions.mjs:30` | Quyết định #1, Phase 2 bước 1 |
| 38 | Landing ghi "166 đội" (kho `teams.json`) nhưng trang Đội khác có 40 | Medium | `app.js:393`; `other-teams.json` | Phase 4 bước 1 |
| 39 | Bỏ lọc điểm làm vỡ test/code Phase 5 không liệt kê | Medium | `team-detail-pages.spec.mjs:404-464`; `team-filter-section.js:382,389`; `team-detail-navigation.js:276` | Phase 5 files, bước 3b |
| 40 | `waitForBoot` chờ `#season-scenario` + Turnstile (chỉ có trên 2–5 trang); test Back `?q=` không nên xóa | Medium | `spa-parity.spec.mjs:126-129`; `mcp-domain-compatibility.spec.mjs:3-5`; `recommended-browser.spec.mjs:123-131` | Phase 2 bước 2, 10 |
| 41 | Phase 8 sửa `khaihoangBuildContent` dùng chung với trang chi tiết Phase 6 | Medium | `render.js:234,432`; `khaihoang-detail.js:4`; `code-standards.md:14` | Phase 6 files, bước 4, Phase 8 deps, bước 3 |
| 42 | Nhiều docs mô tả mô hình cũ nằm ngoài Phase 10 → A7 trượt | Medium | `README.md:9-14`; `deployment-guide.md:103-113,136,240`; `unified-lookup.md:80`; `design-guidelines.md:40-44` | A7, Phase 10 files, bước 4 |
| 43 | A1 không đạt được cho StyleGuide; `design-compare` thiếu `clip`/`--theme` mà phase sau dùng | Medium | `canvas.json` StyleGuide 1280; Phase 3 bước 8; Phase 10 bước 1 | A1, Phase 1 files, bước 7, Phase 10 files |

### Whole-Plan Consistency Sweep — 2026-09-25 (sau review độc lập)
- Đã đọc lại: plan.md, phase-01 … phase-10.
- Thay đổi quyết định đã rà: 9 (quy trình bản dịch + publish, bỏ tối ưu tải theo mục, `data-page-section`, `safeReturnUrl` giữ khóa theo trang + chuẩn hóa `from` cũ, `js/legacy-routes.js` thay `js/landing.js`, khóa nối theo từng nguồn + spike đầu Phase 7, theme chặn nháy, quy tắc render an toàn, khối build Khai hoang chuyển sang Phase 6).
- Chỗ cũ đã sửa theo: plan.md quyết định #1/#2/#3/#7/#12, thêm #13/#14, quy trình bước 2–3, A1/A2/A6/A7, rủi ro, bảng phase + câu tuần tự, dòng #1/#5 bảng cũ; Phase 1 files, bước 2–5, 7–8, Verification; Phase 2 toàn bộ files/bước/Verification; Phase 3 files, bước 1, 4–5, Verification; Phase 4 files, bước 1, 4, Verification; Phase 5 files, bước 3b, 7–8, Verification; Phase 6 files, bước 1, 4, Verification; Phase 7 files, bước 0, 2, 4b, Verification; Phase 8 deps, Goal, files, bước 1, 3, 6, Verification; Phase 9 deps, files, bước 2, Verification; Phase 10 files, bước 4–6, Verification; effort.
- Mâu thuẫn còn lại: 0.

## Validation Log

### Verification Results
- **Tier:** Full (10 phase), chạy phần Fact Checker + Contract Verifier trên các claim chịu lực.
- **Claims checked:** 24 — **Verified:** 24 | **Failed:** 0 sau khi sửa (2 claim sai ban đầu: consumer `mobile-section-menu`, "không tăng tải").
- Quyết định người dùng đã chốt trước khi viết plan (2026-09-24): thẻ Khai hoang = build + thanh điểm, hướng dẫn ở chi tiết; tổng quan Cùng Tồn hiện nguyên văn gốc; ngày build + ẩn "Góp ý"; "dành cho game".
- `ak plan validate` → `valid: true`.
- **Chạy thử quy trình bản dịch 2026-09-25** (worktree tạm ở `f7ab651`, đã xóa sau khi chạy): bỏ `ui:root/build-credit` → cập nhật baseline qua lệnh `inventory` → `build`/`check --candidate`/`publish` → `check --stage public` exit 0 → re-pin `team-route-handles.json` → `team_route_handles --check` pass; không phát sinh lỗi receipt; `index.json` generation mới trùng byte với generation cũ; `tests/test_site_localization.py` đỏ đúng 3 số ghim dự kiến. Xác nhận quyết định #7 và quy trình bước 2a–e.
- **Sửa theo kết quả chạy thử:** (1) bỏ obligation `translate` không cần receipt mới — cập nhật quyết định #7, quy trình bước 2a, Phase 2 bước 9, Phase 3 bước 7, Phase 8 bước 6, Rủi ro, Handoff (phần "cần receipt" của finding #20 chỉ còn đúng với dời file/đổi chữ); (2) bổ sung quy tắc giữ obligation trong file bị viết lại (bước 2a, số obligation theo file từ `UI_LITERAL_OBLIGATIONS`) và ghi chú ở Phase 2 bước 3, Phase 6 files, Phase 9 files. Rà lại toàn plan: không còn chỗ nói Phase 2 cần receipt; mâu thuẫn còn lại 0.
- **Bổ sung 2026-09-25 (theo yêu cầu người dùng):** tầng golden master (quyết định #15) + danh mục component (#16): `tokens.json` trích từ inline style 24 artboard (đo: 39 font-size, 35 gap, 109 padding, 15 radius, 17 line-height, 12 chiều cao control, 6 letter-spacing, 5 shadow; `renderVals()` chỉ có màu), `design-tokens.mjs --check` cấm giá trị thô ngoài khối token (CSS cũ bọc khối `legacy` giữ vị trí, thu dần, Phase 10 = 0), `design-compare.mjs --tokens` đo computed style mỗi phase × 2 theme. Đã sửa theo: quyết định #5, quy trình bước 1 và 4, A1, bảng phase, Phase 1 (Goal, files, bước 1–2, 5, 7, Verification, effort 2.5d), Phase 10 (files, bước 1, 4, 6, Verification); effort tổng 23.5d. Mâu thuẫn còn lại 0.

## Handoff

Plan `260922-1806-khai-hoang-trang-chi-tiet` đã land (`68a49b3`). Review độc lập đã chạy 2026-09-25 (27 finding, đã áp dụng); quy trình bản dịch đã chạy thử thành công. Không còn việc chặn nào phía người dùng trước khi cook; phase nào buộc phải dời/đổi chuỗi `translate` sẽ tự dừng hỏi. Cook: `/ak:cook /Users/plateau/Project/CamNangTQCCL/plans/260923-1949-so-binh-phap-redesign/plan.md`. Không tự bắt đầu code từ phiên lập plan.

<!-- slug: so-binh-phap-redesign -->
