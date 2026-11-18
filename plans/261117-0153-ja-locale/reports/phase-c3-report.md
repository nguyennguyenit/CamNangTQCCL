# Phase C3: Tra cứu, tên đội, alias, báo cáo gap ja (báo cáo)

Ngày 2026-11-17. Branch `feat/ja-locale-c3-lookup`, tạo từ `origin/feat/ja-locale` (`4200dc9`). Worktree `/Users/plateau/Project/CamNangTQCCL-ja-c3`. `SITE_LOCALES` vẫn là `['vi','zh']`.

## Kết quả

Code ja của Tra cứu đã xong cho cả 8 điểm thiết kế của C3 (trừ phần ghi chú đội ở điểm 4, xem "Việc còn lại"). Mọi chỗ ja đều có unit test, chạy với locale `ja` truyền vào. Mọi lời gọi `L`/`pick` trong file C3 có đủ 3 biến thể.

`npm run check`, `npm run build`, `npm run verify`, `npm run test:dist` và `compare` **chưa chạy được** trên branch này. Theo chỉ đạo điều phối, em không sửa `pipeline/site_localization.py`. Vì vậy cổng `site_localization check` (chạy đầu cả bốn lệnh) đỏ vì 12 biểu thức obligation đã đổi (danh sách ở dưới) và hash nguồn chưa ghim lại. Bước tích hợp C sẽ cập nhật obligation cùng C2 rồi ghim lại một lần. Branch không có commit ghim.

## Commit

| Commit | Nội dung |
|---|---|
| `2ef2f6c` chore(artifacts) | Đăng ký 4 artifact trong `src/lib/public-artifact-manifest.mjs`: `data/lookup-ja`, `data/ja-kanji-variants`, `js/shinjitai`, `js/locale-name-aliases`. Cần làm vì `origin/feat/ja-locale` hiện không build được: hai file data của B chưa được đăng ký. Điều phối đã cho phép; bốn entry trùng bước 8 của C1, người ghép gộp lại. |
| `7177dec` feat(ja) | Toàn bộ code, test và docs của C3. |
| (commit này) docs(plan) | Báo cáo này. |

## Đã làm theo 8 điểm thiết kế

1. **Nạp và xác minh.**
   - Trình duyệt: `js/lookup-data.js` có thêm `validateLookupJaDocument`, `verifyLookupJa`, `verifyKanjiVariants` và `loadLookupJa(loadBytes, pin, {withVariants})`. File `lookup-ja.json` phải khớp pin `sha256:<hex>` và có `lookupGenerationId` bằng `generationId` của `data/lookup-manifest.json` đang phát. Bảng tự dạng phải khớp hash ghi trong `lookup-ja.sources`.
   - Trang nhóm `/ja/` nhúng `<script type="application/json" id="lookup-ja-pin">`. Giá trị lấy từ `lookupJaPin()` qua `pick(locale, null, null, pin)`, nên trang vi/zh không nhúng gì.
   - `initLookupPage` đọc pin, nạp lớp ja, chờ nạp xong mới dựng lại danh sách. Nếu lỗi, trang vẫn chạy với chữ Hán nguồn và hiện một dòng báo.
   - Build: `lookupJaPublicationSnapshot()` trong `src/lib/root-static-artifacts.ts` kiểm hợp đồng, kiểm `lookupGenerationId`, và kiểm `sources` khớp hash bytes của `heroes-dict`/`tactics`/`lookup-catalog` (từ lookup manifest), `books-dict` và `ja-kanji-variants`. Lệch thì build dừng.
   - `lookupBuildCorpus` (`src/lib/lookup-pages.ts`) gắn lớp ja khi manifest artifact có phát `lookup-ja`. Manifest mặc định luôn phát; fixture của verifier/test không phát thì corpus không có lớp ja.
2. **Corpus và hồ sơ ja.**
   - `buildLookupCorpus({…, ja})` gắn mục ja vào từng bản ghi theo ID, kể cả đặc kỹ và lựa chọn cải tạo. Cách gắn là `WeakMap` theo đối tượng, nên corpus không có ja không bị ảnh hưởng.
   - Hồ sơ ja có:
     - tên Nhật;
     - `profile.name = {original, status, label, title}`. Trang hiện dòng `原名 <chữ Hán gốc>` và nhãn `確認済み`/`字形変換` có `title` giải thích, ở cả hộp thoại, trang riêng và panel catalog;
     - bản dịch máy lấy từ `texts[key]`, đúng bảng khóa của `docs/ja-lookup-data.md` (gồm `conditions.N`, `cardPacks.N.*`, `levels.N.*`, `description` của lựa chọn). Khi có bản dịch thì `profile.machineTranslated` bật và trang hiện khối `機械翻訳` + `数値は中国大陸版に基づく`;
     - khi khóa vắng: khóa vào `profile.untranslated`, `viOnly` bật, và trang hiện dòng báo thiếu bằng tiếng Nhật.
   - Giá trị đóng: `ZH_VALUES` đổi thành **một** bảng `CLOSED_VALUES` theo cột `[zh, ja]`, tra bằng `pick(locale, vi, zh, ja)`.
   - Nguồn chữ của từng locale đi qua `contentMode(locale) = pick(locale, "vi", "source", "ja")`. Nhờ vậy cờ `sourceText` cũ không còn gộp "hiện chữ Hán nguồn thô" với mọi locale không phải tiếng Việt (rủi ro 1 của phase A). Ô ghép sự kiện ở bản ja bị bỏ và đánh dấu thiếu, vì chưa có tên sự kiện tiếng Nhật đã đối chiếu.
3. **Tên theo locale ở một chỗ.**
   - `lookupDisplayName` dùng tên Nhật theo ID; bản ghi chưa gắn ja thì lùi về chữ Hán.
   - `js/website-display.js` có thêm:
     - `createJaNameResolver(dicts, jaDoc, variants)`: tên Việt/Hán-Việt → tên Nhật theo ID; nếu chưa có thì `toShinjitai(chinese)`. `resolver.fromRaw` đổi tự dạng chữ Hán thô;
     - `localRawName`, `readLookupJaPin`;
     - `displayText(vi, raw, locale, resolver)` có nhánh ja;
     - `loadRawNameResolver(loadBytes, locale, {pin})`, ở bản ja, nạp `lookup-ja` (theo pin) và bảng tự dạng.
   - `js/shinjitai.js` (`parseKanjiVariants`, `toShinjitai`, `createShinjitai`) parity với `tests/fixtures/shinjitai-vectors.json`.
   - Tiêu đề trang chi tiết đội ja (`src/lib/team-detail-pages.ts`):
     - đội chuẩn: `nameZh` đổi tự dạng;
     - tên mùa và mã danh mục gốc: đổi tự dạng;
     - đội khác và Khai hoang: ghép tên Nhật của tướng;
     - JSON-LD tướng của đội: dùng tên Nhật.
4. **Ghi chú đội chữ Trung**: phần dựng ghi chú không nằm trong file C3 (xem "Việc còn lại").
5. **SEO ja.**
   - Meta description ja (`describeJa`) chỉ dùng tên Nhật, nhóm, phe, phẩm, loại và số; không trích mô tả dịch máy.
   - JSON-LD: `inLanguage: ja`, `alternateName` = tên chữ Hán gốc, không khai tên Việt.
   - Tên site lấy từ C1: 「三國志 真戦 攻略手帳」.
6. **Tìm kiếm ja.** Khớp tên Nhật, tên chiến pháp kịch bản có tiền tố (`prefixedTactics`), tên gốc, `chinese`, `aliasesZh` và bí danh có chữ Hán (gồm giản thể). Không khớp chữ Việt, không sinh kana. Khi xếp hạng, tên Nhật được xét như chữ Hán.
7. **Alias.** `withLocaleAliases(dict, jaEntries)` trong `js/locale-name-aliases.js` là hàm thuần:
   - nối tên Nhật vào `aliases`, bỏ trùng, giữ thứ tự, sao bản ghi;
   - thêm dạng tách tiền tố ("SP 法正") cho tên biến thể viết liền;
   - nhận cả tài liệu `lookup-ja` lẫn `entries`.

   Test kiểm với dữ liệu thật: mọi tên Nhật mà `classifyName` cũ không khớp chắc đều khớp `sure` đúng ID sau khi nối.
8. **Báo cáo gap.**
   - `scripts/report-zh-gaps.mjs` tổng quát theo locale: `missingInLocale`, `localeGaps`, `groupTotals`, `runGapsReport`. Lệnh và đầu ra zh giữ nguyên; `docs/zh-gaps.md` không đổi byte.
   - `scripts/report-ja-gaps.mjs` ghi `docs/ja-gaps.md`: 147/983 mục thiếu, toàn bộ là chiến pháp, gồm 38 mục nhiều hơn zh do ô ghép từ tên sự kiện. Kèm bảng `verified`/`derived` theo nhóm.
   - `package.json` `verify` thêm `node scripts/report-ja-gaps.mjs --check`.

Chuỗi ja cho mọi lời gọi `L(`/`pick(` trong file C3 và ba trang `Lookup*Page.astro` dịch từ zh+vi theo `pipeline/ja-glossary.json`. Ví dụ: 計略ダメージ, アクティブ戦法, 兵法書, 発動確率, 回避, 潰走, 計窮.

## Danh sách obligation đổi (cũ → mới) cho `UI_LITERAL_OBLIGATIONS`

Cả 12 chỉ thêm đối số ja ở cuối. Chuỗi mới có nguyên văn trong file.

| # | Obligation | File | Cũ | Mới |
|---|---|---|---|---|
| 1 | `ui:lookup-item/section` | `src/lib/lookup-item-pages.ts` | `pick(locale, 'Tra cứu', '图鉴查询')` | `pick(locale, 'Tra cứu', '图鉴查询', '図鑑')` |
| 2 | `ui:lookup-item/tagline` | `src/components/pages/LookupItemPage.astro` | `t('Tra cứu', '图鉴查询')` | `t('Tra cứu', '图鉴查询', '図鑑')` |
| 3 | `ui:lookup-item/back-aria` | `src/components/pages/LookupItemPage.astro` | `t('Quay lại danh sách Tra cứu', '返回图鉴列表')` | `t('Quay lại danh sách Tra cứu', '返回图鉴列表', '図鑑の一覧に戻る')` |
| 4 | `ui:lookup-item/back` | `src/components/pages/LookupItemPage.astro` | ``t(`Quay lại ${page.groupLabel}`, `返回${page.groupLabel}`)`` | ``t(`Quay lại ${page.groupLabel}`, `返回${page.groupLabel}`, `${page.groupLabel}に戻る`)`` |
| 5 | `ui:lookup/book-former-names` | `js/lookup-detail.js` | `L("Tên cũ", "旧名")` | `L("Tên cũ", "旧名", "旧名")` |
| 6 | `ui:lookup/book-effect-version` | `js/lookup-detail.js` | `L("Số liệu theo bản", "数据版本")` | `L("Số liệu theo bản", "数据版本", "データ版")` |
| 7 | `ui:lookup/fact-role` | `js/lookup-profile.js` | `[L("Vai trò", "定位"), valueText(fieldByKey(profile, "roleTagViet"), "")]` | `[L("Vai trò", "定位", "役割"), valueText(fieldByKey(profile, "roleTagViet"), "")]` |
| 8 | `ui:lookup/hero-usage` | `js/lookup-detail.js` | `L("Đánh giá", "评价")` | `L("Đánh giá", "评价", "評価")` |
| 9 | `ui:lookup/hero-card-packs` | `js/lookup-detail.js` | `L("Cách nhận", "获取途径")` | `L("Cách nhận", "获取途径", "入手方法")` |
| 10 | `ui:lookup/hero-card-pack-core` | `js/lookup-detail.js` | `L("Tướng lõi", "核心")` | `L("Tướng lõi", "核心", "コア")` |
| 11 | `ui:lookup/hero-card-pack-regular` | `js/lookup-detail.js` | `L("Thường", "非核心")` | `L("Thường", "非核心", "非コア")` |
| 12 | `ui:lookup/hero-card-pack-rates` | `js/lookup-detail.js` | ``\`${L("lõi", "核心")} ${percentText(pack.coreRate)} / ${L("thường", "非核心")} ${percentText(pack.nonCoreRate)}\` `` | ``\`${L("lõi", "核心", "コア")} ${percentText(pack.coreRate)} / ${L("thường", "非核心", "非コア")} ${percentText(pack.nonCoreRate)}\` `` |

Danh sách lấy từ `ui_source_locations(root, "pipeline/site-translations.json")`. Đó là toàn bộ obligation báo thiếu trên branch.

Ngoài ra, file nguồn trong `policy.sourceFiles` đã đổi. Đó là các file C3 trong `js/` và `src/`, gồm `js/lookup-field-labels.js`, `js/lookup-data.js` và `js/website-display.js`. Chuỗi ghim của bước tích hợp cần băm lại chúng.

## Lệnh kiểm

| Lệnh | Kết quả |
|---|---|
| `npx astro check` | 0 lỗi, 0 cảnh báo (2 gợi ý cũ ở `season-pages.ts`, `team-detail-routes.ts`) |
| `I18N_ARITY_LOCALES=vi,zh,ja node --test tests-js/i18n-call-arity.test.mjs` | không còn dòng nào ở file C3. Lỗi còn lại đều thuộc C1/C2 |
| Unit test mới | `shinjitai` (4), `locale-name-aliases` (3), `lookup-ja-data` (7), `lookup-ja-profile` (11, chạy trong tiến trình con có `ja`), `report-ja-gaps` (3): xanh |
| `node scripts/report-zh-gaps.mjs --check` | khớp. `docs/zh-gaps.md` không đổi byte so với `origin/feat/ja-locale` |
| `node scripts/report-ja-gaps.mjs --check` | khớp |
| `npm run test:node` | 916 test: 914 xanh, 2 đỏ có chủ đích. (a) `astro-dist-contract` "built dist is allowlisted…" đọc `dist/` cũ (build baseline) nên thiếu `js/shinjitai.js` và `js/locale-name-aliases.js`; cần build lại, mà build đang bị cổng chặn. (b) arity mặc định (2 biến thể) đỏ vì lời gọi đã có biến thể ja, xem "Việc còn lại". Lần chạy đầu có thêm `website-display` "requests every listed source…" đỏ do timing 20 ms khi máy bận; chạy riêng 3/3 xanh, lần chạy lại toàn bộ cũng xanh |
| `python3 -m unittest discover -s tests` | 528 test: 1 fail + 1 error, cả hai ở `test_site_localization` (cổng localization: "reviewed source hash is stale" và `unknownLocations` 12 ≠ 0 = 12 obligation trên). Phần còn lại xanh |
| `npm run check` / `build` / `verify` / `test:dist`, `compare` | **chưa chạy được**: cổng `site_localization check` đỏ vì obligation và hash nguồn (để bước tích hợp C) |

Baseline cho `compare` đã chụp sẵn ở `.cache/locale-baseline/base.json` (không commit). Cách chụp: build `origin/feat/ja-locale` + 2 dòng đăng ký data, được 6131 file, `filesSha256 9dfd276c91233ed63f2dbf66ff300cc7eadd24c99c0f567232a095ed4e39f9cd`. Bước tích hợp chạy `compare` sau khi ghim lại. Những chỗ có thể đổi output vi/zh đã được giữ trùng byte có chủ đích:

- Chữ Hán nguồn của bản zh vẫn đi nguyên (không trim thêm).
- Phần tử ja chỉ chèn khi locale là ja.
- Lớp ja gắn vào corpus build không đổi hồ sơ vi/zh; test `lớp ja không đổi hồ sơ vi/zh của cùng mục` kiểm điều này.

## Quyết định và lưu ý cho người ghép

- **Kiểm ja trước khi bật locale.** Trên branch này `normalizeLocale("ja")` trả `vi`, nên `withLocale("ja")` không dựng được hồ sơ ja. Em thêm `scripts/preview-locale-hook.mjs` (file mới ngoài danh sách sở hữu, không trùng phase nào): một hook `module.register` nạp `js/i18n.js` với `ja` (danh sách và các bảng locale) chỉ trong tiến trình con.
  - `report-ja-gaps.mjs` và `tests-js/lookup-ja-profile.test.mjs` tự chạy lại qua hook khi `ja` chưa có trong `SITE_LOCALES`.
  - Khi C1 bật `ja`, mẫu thay thế không còn khớp, hook không đổi gì và kết quả giữ nguyên. Sau đó có thể xoá hook.
  - Test lồng phải bỏ `NODE_TEST_CONTEXT`; không thì `node --test` con luôn thoát 0.
- **`initLookupPage({…, loadBytes})`.** Tham số mới, tuỳ chọn; vắng thì tự tạo bộ nạp. `js/app.js` (C2) nên truyền `loadBytes` của trang để `lookup-manifest` không bị tải hai lần.
- **`recommendedTitle(entry, locale, resolver)`.** Ở bản ja cần truyền `await lookupJaNameResolver()` (từ `src/lib/lookup-pages.ts`). `src/components/pages/SeasonPage.astro` (C2) đang gọi với 2 đối số, nên bản ja sẽ hiện chữ Hán gốc chưa đổi tự dạng.
- **API dùng lại cho C2/D:**
  - `withLocaleAliases` (C2 `analyze.js`, D `worker/eval/score.ts`);
  - `loadLookupJa(loadBytes, pin)`;
  - `readLookupJaPin()`;
  - `loadRawNameResolver(loadBytes, locale)`: bản ja trả tên Nhật, kèm `resolver.fromRaw`;
  - `localRawName(raw, resolver, locale)`;
  - `contentMode(locale)`;
  - `lookupJaPin()` cho trang công cụ/đội ja cần nhúng `#lookup-ja-pin`.
- **`mcp-worker`.** `js/website-display.js` giờ import `js/lookup-data.js` và `js/shinjitai.js`.
  - `mcp-worker/workflow-source-manifest.json` cần thêm `js/shinjitai.js`, rồi chạy `npm --prefix mcp-worker run generate:workflow-build`.
  - `WORKFLOW_BUILD_ID` đã lệch từ phase A (`js/i18n.js` đổi). Phần này thuộc H.
- **CSS.** Không thêm CSS (`css/styles.css` thuộc C1). Dòng 原名 và nhãn trạng thái dùng lớp sẵn có (`lookup-dialog-zh`, `badge badge-outline`); khối 機械翻訳 dùng `lookup-child-row` + `lookup-version-tag`. Các hook để C1 tạo kiểu nếu cần: `.lookup-name-original`, `.lookup-name-status[data-name-status]`, `.lookup-mt-notice`.
- **Trang mục lục Tra cứu.** Script chuyển tiếp link cũ (`LookupHubPage.astro`) giữ regex `^/(?:zh/)?tra-cuu/`, để không đổi byte trang vi/zh. Ở `/ja/` link cũ vẫn tới đúng đích, chỉ khác là dùng `location.replace` thay vì `replaceState`.

## Việc còn lại

1. **Điểm 4: ghi chú đội chữ Trung** (`displayNotes.blocks[].textRaw`) ẩn trên `/ja/` và hiện dòng báo thiếu. Phần dựng nằm ở `js/recommended-reference-render.js`/`js/recommended-reference-state.js` (C2), không có file C3 nào dựng ghi chú. Cần C2 hoặc tích hợp làm, dùng `contentMode`/`pick` để ẩn.
2. **Bước tích hợp C:** cập nhật 12 obligation ở trên, ghim lại localization, rồi chạy `npm run check`, `build`, `verify`, `test:dist`, `compare` với baseline ở trên.
3. **Arity mặc định.** `tests-js/i18n-call-arity.test.mjs` khi không đặt biến môi trường đòi đúng `SITE_LOCALES.length` (2) biến thể, nên đỏ ở các lời gọi đã có biến thể ja. C2 cũng vậy. Test tự xanh khi C1 bật `ja`.

## Câu hỏi chưa giải

- Thuật ngữ UI ja tự chọn khi glossary chưa có: 兵種進階 (cải tạo binh chủng), 施設 (công trình), 図鑑 (Tra cứu), コスト (thống ngự), 紅度ルール. Cần người chơi bản Nhật soát ở H.
- Có nên đối chiếu tên sự kiện tiếng Nhật để ô "Cách nhận"/"Điều kiện đổi" của 38 chiến pháp sự kiện hiện được ở `/ja/` không? Nếu làm thì nên tách issue.
