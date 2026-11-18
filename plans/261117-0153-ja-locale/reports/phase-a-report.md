# Phase A: refactor N locale (báo cáo)

Ngày 2026-11-17. Branch `feat/ja-locale-a-refactor`, tạo từ `feat/ja-locale` (`099f5cb`, nội dung site giống `993b2d4`). Worktree `/Users/plateau/Project/CamNangTQCCL-ja-a`. `SITE_LOCALES` vẫn là `['vi','zh']`. Phase C mới thêm `ja`.

## Kết quả

Output vi/zh trùng byte với baseline sau khi chuẩn hoá: 0 file đổi, 0 file thêm, 0 file mất. Mọi gate trong brief đều xanh. Commit ghim localization nằm cuối, tách riêng.

## Commit

| Commit | Nội dung |
|---|---|
| `3c11d41` feat(scripts) | `scripts/compare-locale-output.mjs` (`snapshot`/`compare`) + `tests-js/compare-locale-output.test.mjs` (11 test). Không đổi output site. |
| `7a6d189` feat(i18n) | `js/i18n.js` là nguồn locale duy nhất; `src/lib/locale-routes.ts` re-export; test `i18n-locales` và `i18n-call-arity`. |
| `277b27e` refactor(i18n) | `SiteLayout.astro`, blog (`blog-posts/seo/guide-link`, `BlogIndex`, `BlogArticle`), `sitemap.xml.ts`, `scripts/verify-astro-dist.mjs`; test blog/sitemap. |
| `2308be2` refactor(i18n) | Bỏ mọi nhánh `=== "zh"` ở `js/` và `src/` (lookup, website-display, community, trang chi tiết, landing…). |
| (báo cáo) docs(plan) | File này. |
| (cuối) chore(data): ghim lại hash nguồn | Policy localization (26 hash nguồn), `data/website-display.json`, generation Recommended mới `30634f3f…` (đã prune `01b06ba2…`), `pipeline/team-route-handles.json` rebind. Người ghép bỏ commit này và chạy lại chuỗi ghim (phase H). |

## Đã đổi gì

- **`js/i18n.js`**: `SITE_LOCALES = Object.freeze(['vi','zh'])` (giữ `LOCALES` làm alias). Các bảng `LOCALE_PREFIX`, `LOCALE_HTML_LANG`, `LOCALE_INTL`, `LOCALE_OG`, `LOCALE_LABEL` đều đông cứng (frozen). Thêm `isSiteLocale` (type predicate), `htmlLang` và `contentLocaleIsVietnamese`.
  - `normalizeLocale` so theo mã ngôn ngữ chính. Mã không khớp trả `vi`.
  - `pick(locale, ...variants)`/`L(...variants)` chọn biến thể theo vị trí trong `SITE_LOCALES`. Thiếu biến thể của locale đang dùng thì ném lỗi; biến thể thừa thì bỏ qua.
  - `stripLocale`/`localeFromPath`/`localePath`/`formatNumber`/`formatDate` đọc từ các bảng trên. Đã bỏ `ZH_PREFIX`.
- **`src/lib/locale-routes.ts`**: `SiteLocale` suy ra từ danh sách locale. Bỏ `otherLocale`. Thêm `switchTargets`, `mirroredPaths`, và `alternatePaths(pathsByLocale)` (một link cho mỗi locale có mặt, `x-default` = bản Việt khi có).
- **`SiteLayout.astro`**:
  - `t` nhận biến thể dạng rest.
  - `og:locale` lấy từ `LOCALE_OG`.
  - Mỗi locale còn lại có một `og:locale:alternate` và một nút `[data-lang-switch]`. Tên truy cập của nút tra bảng `SWITCH_ARIA[trang][đích]`; thiếu cặp nào thì build lỗi.
  - `counterpartPath` nhận bản ghi theo locale đích. Một chuỗi đứng riêng được hiểu theo locale suy từ chính nó, nên `404.astro` không phải sửa.
- **Blog**: thay `BlogLocale` bằng `SiteLocale`. `translationOf` đổi thành `translationsOf` (trả mọi bản cùng `translationKey`). `BlogArticle` có một link bản dịch cho mỗi bản có thật. RSS/feed path dùng `localePath`.
- **Sitemap/verifier**: `mirroredSitemapRoutes` sinh một URL cho mỗi locale. `blogSitemapRoutes` lặp `SITE_LOCALES` và nhận `translationPaths`. Verifier dựng regex bài viết/đội cộng đồng từ `LOCALE_PREFIX` và đọc hreflang của mọi locale khác.
- **Các nhánh dữ liệu** dùng một trong ba dạng:
  - (a) `contentLocaleIsVietnamese` cho cờ "hiện chữ nguồn, bỏ phần chỉ có chữ Việt". Các helper `isZh`/`ZH`/`zh()` đổi tên thành `sourceText`.
  - (b) Tra bảng theo locale cho `lang`, `Intl`, nhãn ngôn ngữ và bảng `LANDING_COPY: Record<SiteLocale, …>`.
  - (c) `pick`/`L` khi chọn dữ liệu hoặc câu theo ngôn ngữ, ví dụ `lookupDisplayName`, `displayText`, `lookupGroupLabels`, mô tả trang chi tiết, câu chữ Hán viết cứng.

  Khi thêm `ja`, test arity chỉ ra từng chỗ thuộc dạng (c).
- **Hàm bọc** `t(...)` trong 18 component `.astro`, cùng `text(...)` ở `lookup-master.js` và `unified-lookup.js`, đổi sang dạng rest để test arity kiểm được cả lời gọi qua chúng.
- **`grep`** không còn `=== "zh"`, `!== "zh"`, `otherLocale`, `BlogLocale`, `'vi' | 'zh'` hay `ZH_PREFIX` trong `js/`, `src/`, `scripts/`. Hai điểm ở `worker/src` thuộc phase D.

## Công cụ so output

Lệnh `snapshot` băm từng file output, trừ `js/**` (mã nguồn copy thô; hành vi do test và e2e giữ). Trước khi băm, nó chuẩn hoá:

1. Ngày build ở `<p class="footer-chip">` (cả `dd/mm/yyyy` lẫn `yyyy-mm-dd`) thành `<BUILD_DATE>`.
2. Pin generation thành token, áp cả vào đường dẫn file. Các pin gồm: `generationId`, `manifestSha256` và hash `current.json` của Recommended, `localizationInputsHash` trong manifest generation, hash của `data/website-display.json` và hex của `generationId` site-localization.
3. Chỉ khi có `--allow-locale <mã>` (dùng ở phase C):
   - bỏ hreflang, `og:locale:alternate` và khối `<url>`/`xhtml:link` sitemap của locale đó;
   - bỏ qua `<mã>/**`.

   Manifest còn lưu thêm bảng `languageSwitchAgnostic`, trong đó cụm nút chuyển ngôn ngữ được gộp thành `<LANG_SWITCH>`. Nhờ vậy baseline chụp một lần vẫn so được với build có thêm locale.

Lệnh `compare` thoát mã 1 nếu có file đổi hoặc mất, hoặc có file thêm ngoài allowlist. Allowlist gồm `--allow-file`; khi có `--allow-locale` thì thêm `<mã>/**` và `data/*<mã>*.json`.

### Baseline và kết quả so trùng byte

```bash
# baseline: build tại 099f5cb (trước mọi sửa), copy dist ra thư mục tạm rồi chụp
node scripts/compare-locale-output.mjs snapshot --root <bản copy dist 099f5cb> \
  --out .cache/locale-baseline/base.json --label "feat/ja-locale 099f5cb (nội dung site = 993b2d4)"
# head: sau refactor + ghim lại
npm run build
node scripts/compare-locale-output.mjs snapshot --root dist --out .cache/locale-baseline/head.json
node scripts/compare-locale-output.mjs compare
```

| | Baseline (`099f5cb`) | Head (refactor + ghim) |
|---|---|---|
| Số file trong manifest (trừ `js/`) | 6129 | 6129 |
| `filesSha256` | `a363d24a8d2c996e19b84af9ccaa3ddb4938158af4f4f6156f377e2e9bbf1432` | `a363d24a8d2c996e19b84af9ccaa3ddb4938158af4f4f6156f377e2e9bbf1432` |
| SHA-256 file manifest | `8570839012759d02f8b408e19b59ac9f1991ed4f9dec00fdab4b654077a7b4d8` | `cb714419…` (khác vì nhãn) |
| Generation Recommended | `01b06ba2…` | `30634f3f…` |

`compare` báo `Đổi: 0`, `Thêm: 0`, `Mất: 0`, `Ngoài allowlist: 0`.

So thô, chưa chuẩn hoá: 235 file trùng, 5801 file khác, 93 file mỗi bên đổi tên. Toàn bộ chênh lệch đến từ pin generation nhúng trong mọi trang và tên thư mục generation; sau chuẩn hoá không còn file nào khác.

Ngoài ra đã build lại `099f5cb` một lần nữa (sau commit công cụ) và so với baseline: 0 khác. Build xác định (deterministic).

Manifest nằm ở `.cache/`, không commit. Để tái tạo baseline: build `099f5cb` rồi chạy lệnh `snapshot` như trên, sẽ ra lại đúng `filesSha256` ở bảng.

## Lệnh kiểm

| Lệnh | Kết quả |
|---|---|
| `npm run check` | xanh (localization check + `astro check` 0 lỗi) |
| `npm run build` | xanh, 5799 trang |
| `npm run test:dist` | 64/64 pass |
| `npm run verify` | xanh ("Verified 6232 dist files", `zh-gaps.md` khớp) |
| `npm run test:node` | 898/898 pass |
| `python3 -m unittest discover -s tests` | 502 test OK (13 skip) |
| `npx playwright test tests-e2e/zh-locale.spec.mjs` | 22/22 pass |
| Thêm: `bai-viet-kho-redesign`, `community-teams`, `community-teams-redesign`, `landing`, `lookup-item-pages`, `admin-doi-cong-dong-moi` | 118/118 pass (phủ `BlogArticle` qua fixture bài viết và các nhánh community đã đổi) |
| `I18N_ARITY_LOCALES=vi,zh,ja node --test tests-js/i18n-call-arity.test.mjs` | đỏ như mong đợi: 2264 lời gọi `L`, 40 `pick`, 80 tuple cần thêm biến thể ja; 0 lời gọi không đếm được |

## Thời gian build/verify

Đo trên cùng máy, có phiên khác chạy song song nên dao động vài giây.

| | Trước (`099f5cb`) | Sau |
|---|---|---|
| `npm run build` | 19 s | 18–19 s |
| `npm run verify` | 11 s | 11 s |
| `npm run test:dist` | 11 s | 11 s (một lần 84 s do máy đang bận) |

Phase H dùng số này làm mốc. Dự kiến khi `/ja/` bật, thời gian dựng/đọc trang tăng khoảng 40–50%.

## Rủi ro còn lại

1. **Cờ `sourceText`/`contentLocaleIsVietnamese` đang gộp "không phải tiếng Việt" với "hiện chữ Hán nguồn".** Khi thêm `ja`, trang ja sẽ đi theo nhánh chữ nguồn của zh ở các chỗ này: hồ sơ Tra cứu, tiêu đề trang chi tiết, Đội chuẩn/Đội khác, community. Đó có thể là điểm khởi đầu chấp nhận được, nhưng phase C phải rà từng chỗ.
   - Tìm bằng `grep -n "sourceText\|contentLocaleIsVietnamese"`.
   - Các biến cục bộ `const zh = …` ở `roster-recommend-ui.js`, `analyze.js`, `lookup-profile.js`, `render.js` còn chọn vài chuỗi Hán viết cứng mà test arity không bắt được.
2. **Bản ghi `{vi, zh}`** (`policy-pages.ts`, `lookup-pages.ts`, `FEEDBACK_KINDS`, trường `labelZh` của official-links) giữ nguyên dạng. Lời gọi `pick(locale, x.vi, x.zh)` sẽ bị test arity bắt khi thêm `ja`. Còn các bảng `SWITCH_ARIA`, `TRANSLATION_LINK_LABEL`, `WRITTEN_IN`, `TEXT_LANGUAGE_NAME`, `LANDING_COPY` sẽ ném lỗi lúc build, hoặc lỗi typecheck, nếu thiếu cặp.
3. **Community nhận `ja` ngay khi danh sách locale có `ja`.** Đó là `isSiteLocale` trong form, admin, validate API blog và đội. Nếu `community-worker` chưa nhận `ja` (phase G, migration chưa áp lên production) thì thao tác ghi ở `/ja/` sẽ lỗi 400. Cần giữ thứ tự release: G lên production trước khi merge site.
4. **Đường blog có bài không được cổng so byte phủ**, vì build local không có `COMMUNITY_API_ORIGIN`. Phần này được giữ bằng các thứ sau:
   - unit test `translationsOf`;
   - test sitemap bài có bản dịch;
   - e2e `bai-viet-kho-redesign` (fixture có bài).

   Riêng phần verifier đọc hreflang bản dịch chưa có fixture bài song ngữ.
5. **Commit ghim** đụng generation Recommended. Người ghép phải bỏ commit này và chạy lại chuỗi ghim, như phase H đã ghi. Tôi chưa cập nhật docs evergreen (`docs/code-standards.md` vẫn mô tả `pick(locale, vi, zh)`, `counterpartPath`, cặp vi/zh); phần này thuộc phase H.
6. **File `.astro` không được test arity parse.** Lỗi thiếu biến thể ở đó lộ ra lúc build, khi `pick` ném lỗi.
