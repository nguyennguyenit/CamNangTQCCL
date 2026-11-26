# Phase A — Refactor N locale, giữ vi/zh trùng byte

Branch: `feat/ja-locale-a-n-locale`. Phụ thuộc: không. Chạy song song với B, D, E1, F, G. Effort 10h. Rủi ro: cao (đụng shell dùng chung và ~45 file bị policy localization ghim).

## Bối cảnh (bản đồ i18n zh hiện tại)

**Lõi.** `js/i18n.js` cố định hai ngôn ngữ: `LOCALES = ['vi','zh']` (`js/i18n.js:4`), `normalizeLocale` chỉ phân biệt "bắt đầu bằng zh" (`:9-11`), `pick(locale, vi, zh)` (`:33-35`), `L(vi, zh)` (`:38-40`), `stripLocale`/`localeFromPath`/`localePath` chỉ biết tiền tố `/zh` (`:43-65`), `formatNumber`/`formatDate` chọn `vi-VN`/`zh-CN` qua `pick` (`:68-78`). `src/lib/locale-routes.ts` lặp lại danh sách: `SiteLocale = 'vi' | 'zh'` (`:7`), `SITE_LOCALES` (`:9`), `HREFLANG` (`:12`), `LOCALE_LABEL` (`:15`), `otherLocale` (`:21`), `localizedHtmlPath` chỉ thêm `zh/` (`:24`), `alternatePaths(viPath, zhPath)` (`:32-38`).

**Chuỗi UI.** Không có từ điển tập trung: chuỗi nằm tại chỗ, 2.185 lời gọi `L(vi, zh)` trong 56 file `js/` (nhiều nhất `js/roster-recommend-ui.js` 177, `js/recruit-tracker.js` 164, `js/analyze.js` 142, `js/community-admin.js` 117, `js/community-admin-ai.js` 98; 279 lời gọi dùng template literal nên không thể tra theo khóa chuỗi Việt), 99 lời gọi `pick(locale, vi, zh)` trong 35 file (`src/**` và một số `js/`), 76 khóa `zh:` trong 41 file, bảng tuple `[vi, zh]` như `LOOKUP_FIELD_LABELS` (`js/lookup-detail.js:21`), và các hằng/thuộc tính hậu tố `_ZH`/`Zh` (`FACET_LABEL_ZH` ở `js/team-filter-section.js:167`, `LOOKUP_GROUP_LABELS_ZH` ở `js/unified-lookup.js:28`, `unitZh` ở `js/roster-recommend-ui.js:40-42`, `EVENT_ZH`, `STAT_ZH`…).

**Rẽ nhánh hai ngôn ngữ (35 điểm `=== "zh"`).** `js/lookup-detail.js:8,69,230,245`; `js/lookup-master.js:36`; `js/website-display.js:77,159,193,205`; `js/render.js:82`; `js/lookup-tactic-view.js:9`; `js/analyze.js:285,391`; `js/lookup-profile.js:87`; `js/roster-recommend-ui.js:162`; `js/lookup-tactic-profile.js:19`; `js/unified-lookup.js:28,206,261,273,293,341,403`; `scripts/verify-astro-dist.mjs:150,158,167,175,639,652,673,689,793,824`; `worker/src/schema.ts:268`, `worker/src/model.ts:110` (hai điểm Worker thuộc phase D). Thêm các mẫu `lang === 'zh' ? 'zh-Hans' : 'vi'` ở `js/community-admin.js:543,601,721,769`, `js/community-admin-users.js:169`, `js/community-admin-teams.js:118`, `js/community-team-detail.js:43,110`, `js/community-team-state.js:70`, và `langTag` ở `js/community-api.js:352-354`.

**Hai ngôn ngữ ở layout/blog/sitemap.** `src/layouts/SiteLayout.astro`: prop `locale?: 'vi' | 'zh'` (`:41`), `alternates?: boolean | {vi; zh}` (`:46`), `t = (vi, zh) => pick(...)` (`:71`), `switchLocale = otherLocale(locale)` (`:75`), `og:locale`/`og:locale:alternate` (`:394-395`), hai link `[data-lang-switch]` (`:482`, `:578`). Blog: `BlogLocale = 'vi' | 'zh'` (`src/lib/blog-posts.ts:12`), `translationOf` trả "bản ở ngôn ngữ còn lại" (`:449-451`), `BlogArticle.astro` dùng `otherLocale` (`:19`, `:62`). Sitemap: `mirroredSitemapRoutes` sinh đúng cặp vi+zh (`src/pages/sitemap.xml.ts:53-60`), vòng blog `for (const lang of ["vi","zh"])` (`:75`).

**Dữ liệu zh lấy từ đâu.** Bản zh không áp lớp dịch Việt (`localizeData` trả nguyên nguồn khi zh, `js/website-display.js:77`), chọn chữ nguồn trước chữ Việt (`displayText`, `:159`), tra tên Hán gốc từ tên Việt qua `createRawNameResolver` trên trường `chinese` của `heroes-dict`/`tactics`/`books-dict` (`:166-185`, `RAW_NAME_SOURCES` `:197`). Tra cứu: `lookupDisplayName` dùng `chinese`, rồi `aliasesZh`, rồi `nameZh` (`js/lookup-detail.js:245-251`); giá trị đóng tiếng Việt dịch qua `ZH_VALUES` (`:24-60`), phần chỉ có chữ Việt bị bỏ và hồ sơ gắn `viOnly` (báo cáo `scripts/report-zh-gaps.mjs:53-64`). Trường zh công khai của catalog liệt kê ở `docs/unified-lookup.md` mục "Trường zh công khai của catalog".

**Gate localization.** `npm run build`/`check`/`verify` đều chạy trước `python3 -m pipeline.site_localization check --root . --stage public` (`package.json`). `check` báo lỗi mọi file trong `policy.sourceFiles` (73 file, gồm phần lớn `js/` tra cứu/đội, `SiteLayout.astro`, các component trang, `worker/src/schema.ts`) có hash lệch (`pipeline/site_localization.py:1165-1176`, `:2441-2443`), rồi dựng lại candidate strict và so với `data/website-display.json` + generation Recommended (`:2231-2251`). 615 obligation UI (`UI_LITERAL_OBLIGATIONS`, `:272`) yêu cầu biểu thức nguồn còn nằm nguyên văn trong file (`:1785-1818`); 18 biểu thức trong số đó là lời gọi `L(…)`/`pick(…)` đóng ngoặc. Policy nằm trong `localizationInputsHash` (`:2079`) nên mỗi lần ghim lại sinh generation Recommended mới (`docs/deployment-guide.md:303-320`).

## Mục tiêu

Đổi mọi chỗ "hai ngôn ngữ" thành "theo danh sách `SITE_LOCALES`" mà **không đổi một byte output** nào của vi/zh, để phase C chỉ cần nối thêm `'ja'`.

## Thiết kế

1. **Một nguồn danh sách locale** ở `js/i18n.js` (ESM thuần, chạy được ở trình duyệt, Node, Astro và Worker nhờ `allowJs`):
   - `SITE_LOCALES = Object.freeze(['vi','zh'])` (giữ export cũ `LOCALES` làm alias để không vỡ import hiện có), `DEFAULT_LOCALE = 'vi'`.
   - Bảng theo locale: `LOCALE_PREFIX = {vi: '', zh: '/zh'}`, `LOCALE_HTML_LANG = {vi: 'vi', zh: 'zh-Hans'}`, `LOCALE_INTL = {vi: 'vi-VN', zh: 'zh-CN'}`, `LOCALE_OG = {vi: 'vi_VN', zh: 'zh_CN'}`, `LOCALE_LABEL = {vi: 'Tiếng Việt', zh: '中文'}`. Test khẳng định mọi bảng có đúng tập khóa `SITE_LOCALES`.
   - `normalizeLocale(value)`: so tiền tố mã ngôn ngữ với từng phần tử `SITE_LOCALES` (`zh-Hans` → `zh`), không khớp → `DEFAULT_LOCALE`.
   - `pick(locale, ...variants)` và `L(...variants)`: chọn `variants[SITE_LOCALES.indexOf(normalizeLocale(locale))]`; thiếu biến thể cho locale đang dùng thì **ném lỗi** (build dựng mọi trang nên lỗi lộ ngay); biến thể thừa ở cuối được bỏ qua để phase C có thể thêm chuỗi ja trước khi bật locale ja mà vi/zh vẫn xanh.
   - `stripLocale`, `localeFromPath`, `localePath` duyệt `LOCALE_PREFIX` thay cho hằng `ZH_PREFIX`.
   - `contentLocaleIsVietnamese(locale)` (tên chốt khi làm) thay cho các cờ `isZh` mang nghĩa "trang này có hiện nội dung chỉ có chữ Việt không": vi → có, mọi locale khác → không (zh hôm nay, ja ở C).
   - Không đổi chữ ký 2.185 lời gọi `L(vi, zh)` ở phase này; thứ tự biến thể chính là thứ tự `SITE_LOCALES` và danh sách này **chỉ được nối thêm ở cuối** (test khóa thứ tự).
   - Lý do chọn biến thể theo vị trí thay vì đối tượng `{vi, zh, ja}`: đổi hình 2.185 + 99 lời gọi trong cùng phase tạo diff khổng lồ đụng mọi file, trong khi chỉ số theo `SITE_LOCALES` đã thỏa yêu cầu "code đi theo danh sách"; chỗ đã là bản ghi `{vi, zh}` thì giữ dạng bản ghi.
2. **`src/lib/locale-routes.ts`** re-export từ `js/i18n.js` (bỏ bản sao danh sách), `SiteLocale` suy từ `SITE_LOCALES`, bỏ `otherLocale`, thêm `switchTargets(locale)` = các locale còn lại theo thứ tự danh sách, `localizedHtmlPath(path, locale)` dùng `LOCALE_PREFIX`, `alternatePaths(pathsByLocale)` nhận bản ghi `{[locale]: path}` và luôn thêm `x-default` = bản vi.
3. **`SiteLayout.astro`**: prop `locale?: SiteLocale`, `alternates?: boolean | Partial<Record<SiteLocale,string>>`, `t` thành `(...variants) => pick(locale, ...variants)`, nút chuyển ngôn ngữ render một link cho mỗi phần tử `switchTargets(locale)` (với hai locale ra đúng một link, cùng thuộc tính, cùng thứ tự như hôm nay), `og:locale:alternate` render cho mỗi locale còn lại.
4. **Rẽ nhánh dữ liệu**: mỗi điểm `=== "zh"` được đổi thành một trong ba dạng, theo đúng nghĩa của chỗ đó: (a) `contentLocaleIsVietnamese(locale)` cho cờ ẩn chữ Việt; (b) tra bảng theo locale (`LOCALE_HTML_LANG[lang]` cho thuộc tính `lang`, nhãn nhóm theo locale); (c) hàm chọn tên theo locale (ví dụ `lookupDisplayName`, `localName`, `loadRawNameResolver`) có một nhánh cho locale dùng chữ nguồn, viết sao cho C chỉ cần thêm nhánh ja vào **một** chỗ. Không thêm nhánh ja ở phase này.
5. **Blog**: `BlogLocale` thay bằng `SiteLocale`; `translationOf` thành `translationsOf(post, posts)` trả bản ghi `{[locale]: post}` (hreflang và nút chuyển ngôn ngữ dùng chung); với hai locale kết quả giống hôm nay.
6. **Sitemap và verifier**: `mirroredSitemapRoutes` sinh một URL cho mỗi locale với cùng bộ alternates; vòng blog lặp `SITE_LOCALES`; `scripts/verify-astro-dist.mjs` bỏ mọi `lang === "zh"`, regex `BLOG_POST_FILE`/`COMMUNITY_TEAM_FILE` dựng từ `LOCALE_PREFIX`, `pair.vi && pair.zh` thành "đủ mọi locale".
7. **Không làm ở A**: `src/pages/404.astro` (C viết lại thành khối theo locale), `pipeline/lookup_route_handles.py`, Worker (D), chuỗi ja (C).

## File sở hữu

Sửa: `js/i18n.js`; `src/lib/locale-routes.ts`; `src/layouts/SiteLayout.astro`; `js/lookup-detail.js`, `js/lookup-master.js`, `js/website-display.js`, `js/render.js`, `js/lookup-tactic-view.js`, `js/analyze.js`, `js/lookup-profile.js`, `js/roster-recommend-ui.js`, `js/lookup-tactic-profile.js`, `js/unified-lookup.js` (chỉ các điểm rẽ nhánh đã liệt kê); `js/community-admin.js`, `js/community-admin-users.js`, `js/community-admin-teams.js`, `js/community-team-detail.js`, `js/community-team-state.js`, `js/community-api.js` (chỉ mẫu `lang`); `src/lib/blog-posts.ts`, `src/lib/blog-seo.ts`, `src/lib/blog-guide-link.ts`, `src/components/blog/BlogIndex.astro`, `src/components/blog/BlogArticle.astro`, `src/pages/rss.xml.ts`, `src/pages/zh/rss.xml.ts`; các component/lib còn `locale === 'zh'` hoặc kiểu `'vi' | 'zh'`: `src/components/landing/Landing.astro`, `src/components/pages/{CommunityTeamPage,KhaiHoangDetail,LegacyDetail,MyTeamsPage,PolicyPage,RecommendedDetail}.astro`, `src/components/community/CommunityTeamsHub.astro`, `src/lib/{community-teams,landing-stats,lookup-item-pages,official-links,season-pages,team-detail-pages}.ts`; `src/pages/sitemap.xml.ts`; `scripts/verify-astro-dist.mjs`; test hiện có bị ảnh hưởng (`tests-js/website-display.test.mjs`, `tests-js/blog-posts.test.mjs`, `tests-js/astro-dist-contract.test.mjs`, `tests-js/seo-dist-contract.test.mjs`, …) chỉ khi đổi tên API.

Tạo mới: `scripts/compare-locale-output.mjs`; `tests-js/compare-locale-output.test.mjs`; `tests-js/i18n-locales.test.mjs`; `tests-js/i18n-call-arity.test.mjs`.

Không đụng: `worker/**`, `community-worker/**`, `pipeline/**` (trừ commit ghim cuối), `src/pages/404.astro`, `src/pages/zh/**` (vỏ mỏng không cần đổi).

## Công cụ so output (trả lời câu hỏi "trùng byte")

`scripts/compare-locale-output.mjs` có hai lệnh:

- `snapshot --root <thư mục output> --out <manifest.json>`: duyệt mọi file output trừ `js/**` (mã nguồn được copy thô, đổi theo refactor; hành vi kiểm bằng test), tính SHA-256 của bytes **sau chuẩn hoá**, ghi `{đường dẫn: sha}` kèm metadata (commit, ngày build, generation).
- `compare --base <manifest> --head <manifest> [--allow-locale ja] [--allow-file <đường>]…`: in danh sách thêm/mất/đổi; exit 1 nếu có file đổi hoặc mất ngoài allowlist, hoặc file thêm ngoài `ja/**` và hai file dữ liệu ja khi có `--allow-locale`.

Chuẩn hoá (mỗi quy tắc có test với fixture):

1. Ngày build ở chip footer (`buildDateVi()` dạng `dd/mm/yyyy`, `src/lib/build-date.ts`) thay bằng `<BUILD_DATE>`; vị trí chip xác định theo markup thật lúc làm `[UNVERIFIED: selector chip]`.
2. Pin generation: đọc `generationId`/`manifestSha256` từ `data/recommended/current.json` và SHA-256 của `data/website-display.json` trong mỗi output, thay mọi lần xuất hiện bằng `<REC_GEN>`, `<REC_MANIFEST>`, `<WD_SHA>`; đường dẫn `data/recommended/<gen>/…` được đổi khóa tương ứng; `manifest.json` của generation so sau thay thế. Lý do: sửa file bị policy ghim buộc publish lại, sinh generation mới dù nội dung đội không đổi.
3. Chỉ khi `--allow-locale ja` (dùng ở C): bỏ `<link rel="alternate" hreflang="ja" …>`, `<meta property="og:locale:alternate" content="ja_JP">`, `<xhtml:link … hreflang="ja" …/>` và cả khối `<url>` có `<loc>` dưới `/ja/` của sitemap; thay mọi `<a …data-lang-switch…>…</a>` và phần tử bao có thuộc tính `data-lang-switcher` bằng `<LANG_SWITCH>`; bỏ qua file dưới `ja/`.

Quy trình baseline: commit đầu tiên của A chỉ thêm script + test (output site không đổi). Tại commit đó, trong worktree sạch: `npm ci`, `npm run build`, `node scripts/compare-locale-output.mjs snapshot --root <output> --out .cache/locale-baseline/993b2d4.json`, đồng thời ghi `time npm run build` và `time npm run verify`. Manifest lưu ở `.cache/` (không commit); SHA-256 của manifest và số file ghi vào `plans/261117-0153-ja-locale/reports/baseline-output.md` để các phase sau tái tạo đúng.

## Bước (TDD)

1. Viết `tests-js/compare-locale-output.test.mjs` (fixture nhỏ cho từng quy tắc chuẩn hoá, case thêm/mất/đổi) → đỏ; viết script → xanh. Commit. Chụp baseline như trên.
2. Viết `tests-js/i18n-locales.test.mjs`: bảng locale đủ khóa, thứ tự danh sách khóa cứng `['vi','zh']` ở phase này, `normalizeLocale('zh-Hant') === 'zh'`, `localePath`/`stripLocale`/`localeFromPath` cho mọi locale, `pick` ném lỗi khi thiếu biến thể, bỏ qua biến thể thừa → đỏ; sửa `js/i18n.js` → xanh.
3. Viết `tests-js/i18n-call-arity.test.mjs`: dùng TypeScript compiler API (`typescript` 6.0.3 có trong devDependencies) parse mọi `js/**/*.js`, `src/**/*.ts`, `scripts/*.mjs`, tìm `CallExpression` tới `L`, `pick`, `t` (helper cục bộ của `SiteLayout`), khẳng định số biến thể = `SITE_LOCALES.length` (biến môi trường `I18N_ARITY_LOCALES` cho phép C chạy kiểm với `vi,zh,ja` trong lúc chuyển tiếp). File `.astro` không parse tĩnh; được phủ bởi lỗi ném của `pick` lúc build mọi trang.
4. Sửa `src/lib/locale-routes.ts`, `SiteLayout.astro`, sitemap, blog, verifier theo thiết kế; chạy `npm run test:node` hẹp theo file.
5. Sửa từng điểm rẽ nhánh dữ liệu; sau mỗi nhóm file chạy test đơn vị liên quan (`tests-js/unified-lookup.test.mjs`, `lookup-profile-trees`, `lookup-master`, `website-display`, `team-view-trees`, `team-section-ssr`, …).
6. `grep` xác nhận không còn `=== "zh"`/`!== "zh"`/`otherLocale`/`BlogLocale`/`'vi' | 'zh'` trong `js/`, `src/`, `scripts/` (Worker để D).
7. Ghim lại localization trên branch (chuỗi ở `docs/deployment-guide.md:303-320`), commit riêng `chore(data): ghim lại hash nguồn`. 18 biểu thức obligation không đổi ở A nên `check` phải xanh; nếu báo thiếu biểu thức thì sửa code cho khớp, không sửa obligation.
8. `npm run build`, snapshot head, `compare` với baseline → 0 khác. Chạy `npm run verify`, `npm run test:dist`, `npm run test:node`, `npm run test:e2e`, `python3 -m unittest discover -s tests`.

## Cách kiểm

| Loại | Nội dung |
|---|---|
| Unit | `i18n-locales`, `i18n-call-arity`, `compare-locale-output`, test sẵn có của lookup/website-display/blog/sitemap |
| Tích hợp | `npm run build` + `npm run verify` + `npm run test:dist` |
| So output | `compare` baseline ↔ head: 0 thêm/mất/đổi |
| E2E | Toàn bộ `npm run test:e2e` (đặc biệt `zh-locale.spec.mjs`, `landing`, `lookup-item-pages`, `season-pages`) không sửa kỳ vọng |

## Rủi ro

| Rủi ro | Khả năng × Tác động | Giảm thiểu |
|---|---|---|
| Đổi helper làm lệch một byte HTML (thứ tự thuộc tính, khoảng trắng của nút chuyển ngôn ngữ) | Trung bình × Cao | Cổng `compare` chặn; giữ nguyên template, chỉ đổi nguồn dữ liệu của nó |
| `pick` ném lỗi ở đường client hiếm chạy | Thấp × Cao | Test tĩnh arity phủ mọi file JS/TS; e2e |
| Ghim lại localization làm trộn generation khi ghép với D | Cao × Trung bình | Commit ghim riêng, người ghép chạy lại (phase H) |
| `normalizeLocale` mới đổi kết quả cho giá trị lạ (`en`, rỗng) | Thấp × Thấp | Test giữ hành vi cũ: không khớp → `vi` |

## Rollback

Revert merge commit của A trên `feat/ja-locale` rồi chạy lại chuỗi ghim localization (generation cũ có thể đã bị `prune`, nên không khôi phục bằng tay mà publish lại). Không có dữ liệu người dùng hay schema bị đổi.

## Done khi

`compare` báo 0 khác so với baseline; mọi gate README xanh; `grep` sạch các mẫu hai ngôn ngữ ngoài Worker; test arity xanh với `SITE_LOCALES = ['vi','zh']`.
