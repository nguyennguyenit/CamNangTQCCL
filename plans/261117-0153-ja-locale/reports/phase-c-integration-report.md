# Phase C: tích hợp C1/C2/C3 và bật locale ja (báo cáo)

Ngày 2026-11-18. Branch `feat/ja-locale-c-integration`, tạo từ `origin/feat/ja-locale` (`3cff5ba`). Worktree `/Users/plateau/Project/CamNangTQCCL-ja-cint`. Chưa merge vào `feat/ja-locale`.

## Kết quả

`/ja/` đã bật: `SITE_LOCALES = ['vi', 'zh', 'ja']`, build ra 8.698 trang (base 5.799), trong đó 2.899 trang HTML dưới `/ja/`. Mọi lệnh kiểm trong brief đều xanh. Cổng so output báo 0 file vi/zh đổi ngoài allowlist, với một file dùng chung đổi có chủ đích nằm ngoài allowlist của brief là `llms.txt` (mục "Ghi chú cho PR").

Trang đội, Landing, trang mùa, trang cộng đồng và công cụ ở `/ja/` hiện tên Nhật thay cho chữ Hán nguồn thô. Ghi chú đội chữ Trung bị ẩn và thay bằng một dòng báo thiếu.

Commit ghim localization là commit riêng, nằm cuối branch.

## Đã ghép

Thứ tự: `c2a-community` → `c2b-tools` → `c2c-teams` → `c3-lookup` → `c1-shell`.

- C1 được ghép tới `7fb4333`. Commit cuối `353af50 chore(data): ghim lại hash nguồn` của C1 không được lấy. Policy, generation và `team-route-handles.json` được ghim lại từ đầu trên kết quả ghép.
- Không có xung đột git. Hai bên C1 và C3 cùng thêm 2 entry data (`lookup-ja`, `ja-kanji-variants`) vào `src/lib/public-artifact-manifest.mjs` với dòng giống hệt nhau, nên git gộp thành một. Hai entry JS (`shinjitai`, `locale-name-aliases`) đến từ C3. Kết quả: mỗi entry xuất hiện đúng một lần, test manifest xanh.

## Obligation đã cập nhật

26 biểu thức trong `UI_LITERAL_OBLIGATIONS` (`pipeline/site_localization.py`), giữ nguyên mọi id:

- 12 của C3 (`ui:lookup-item/*`, `ui:lookup/*`);
- 8 của C2c (`ui:khaihoang/guide-heading`, `ui:coexist/season-*`, `ui:recommended/season-label`, `ui:recommended/tactic-before-level-20`, `ui:landing/stats-seasons`, `ui:landing/preview-card-books-missing`, `ui:route-recommended/score-label`);
- 6 của C2b (`ui:roster/*`).

Biểu thức mới khớp đúng bảng cũ → mới trong báo cáo từng phần. `ui_source_locations` báo 0 obligation thiếu. `inventory` báo 0 vị trí lạ, digest `409a1481…` không đổi so với `baseline.notes`.

## Việc tồn đã làm (integration-notes-phase-c.md)

**Tên Nhật ở trang đội** (`js/render.js`, `js/recommended-reference-render.js`, `js/recommended-reference-state.js`):

- Bộ tra tên giờ đăng ký theo locale (`setZhNameResolver(resolver, locale)`). Lúc build, `team-ssr` đăng ký bộ zh (chữ Hán gốc) và bộ ja (`lookupJaNameResolver`) riêng. Trước đây chỉ có một biến toàn cục, nên không dựng được zh và ja trong cùng một tiến trình.
- `sourceName` đưa chữ Hán nguồn qua `resolver.fromRaw`. Bản zh giữ nguyên văn; bản ja cho tên Nhật.
- `createJaNameResolver` (`js/website-display.js`):
  - `fromRaw` tra chữ Hán về mã trước (theo `chinese` của từ điển, nguyên dạng hoặc sau khi đổi tự dạng) rồi lấy `entries[mã].name`; không tra được thì đổi tự dạng;
  - thêm `prefixed`: tên kịch bản của `prefixedTactics` (ví dụ `転・神算鬼謀`), không có thì `転・/拓・/精・<tên Nhật>`. Nhận cả `Chuyển · …` lẫn `轉·…`;
  - thêm `nameOf(mã)`.
- `formatModifiedTactic` không định dạng lại tên ở bản ja. Tiền tố của ô chiến pháp lấy từ ghi chú (`modifiedTacticPrefix`) cũng đi qua `prefixed`.
- Tên đội `nameZh`, nhãn phe/binh chữ Hán, mã danh mục và nhãn nhóm Cùng Tồn ở bản ja đều đi qua bộ tra.

**Ghi chú đội chữ Trung** (điểm 4 của C3): bản ja bỏ `displayNotes.blocks[].textRaw`, `introRaw` và ghi chú chỉ số (`statFocusKind: note`). Khối "備考" chỉ hiện một dòng: 「中国語の原文しかない説明は、日本語訳がないため表示していません。」

**Nạp lớp ja ở trình duyệt:**

- `SiteLayout.astro` nhúng `#lookup-ja-pin` cho mọi trang ja có dữ liệu (cùng điều kiện với `#tactic-display-names`). Thẻ ở `LookupGroupPage.astro` bị bỏ để không trùng id. Nhờ vậy `loadRawNameResolver` của trang đội, Khai hoang và danh sách nạp được tên Nhật.
- `js/app.js`:
  - nạp `data/lookup-ja.json` qua `loadLookupJa(loadBytes, pin)` cho Soi đội và truyền `jaEntries` vào `initAnalyze`;
  - truyền bộ tra của trang (`rawNames`) cho Soi đội, Gợi ý đội và Theo dõi chiêu mộ;
  - truyền `loadBytes` cho `initLookupPage`.
- Trang cộng đồng (`community-team-data.js`): `loadTeamDictionaries` nạp bộ tra ja khi trang có pin. `recordLabel` và `seasonLabel` cho tên Nhật. Lúc build, `communityTeamPageModel` truyền `lookupJaNameResolver`.
- Huy hiệu kho của trang mùa (`season-page-roster-badges.js`, `roster-list-badges.js`) và tiêu đề đội trong Soi đội dùng tên Nhật.

**SSR khác:**

- `SeasonPage.astro` và `SectionPage.astro` truyền `lookupJaNameResolver` vào `recommendedTitle` và `seasonDisplayName` (tên mùa ja được đổi tự dạng).
- Thẻ xem trước Landing (`landing-stats.ts`) dùng tên Nhật.
- `seasonRedirectRules` lấy tiền tố từ `SITE_LOCALES`, nên có thêm luật `/ja/doi-chuan/<mùa hiện tại>/`. `_redirects` đã có sẵn luật này.

**Các mục nhỏ:**

- `js/feedback-kinds.js` có `ja` (機能要望 / 不具合報告 / 情報の誤り / その他). `community-admin.js` bỏ fallback `kind.ja ?? kind.zh`.
- `community-team-pages.ts` dùng `SITE_NAME.ja`.
- Bốn chỗ viết cứng mã Intl (`'ja-JP'`, `"zh-CN"`) đổi sang `LOCALE_INTL[currentLocale()]`.
- `WRITTEN_IN` đổi lại thành `Record<SiteLocale, string>`.
- `contentMode` chuyển về `js/i18n.js`; `lookup-detail.js` re-export.
- CSS:
  - token `components.nhan-ten-nhat` thêm vào `docs/design/so-binh-phap/tokens.json` trước;
  - `css/styles.css` thêm kiểu cho `.lookup-name-original`, `.lookup-name-status[data-name-status]` (derived viền đứt), `.lookup-mt-notice` và `.detail-note-missing`;
  - `design-tokens --check` xanh.
- Fixture D1: `battle-ja-1/2.json` ghi nguồn là "chủ repo gửi 2026-11-17".
- `mcp-worker/workflow-source-manifest.json` thêm `js/shinjitai.js`, rồi sinh lại `src/generated/workflow-build.ts`.
- Bước tích hợp cũng gặp hai chỗ đỏ có từ trước, nằm ngoài ghi chú tích hợp. Cả hai do phase B thêm data ja và `website-display.js` import `shinjitai.js`:
  - `.github/workflows/mcp-release.yml` thiếu `js/shinjitai.js` trong `push.paths`;
  - `mcp-worker/scripts/build-worker-assets.ts` cần coi `lookup-ja.json`, `ja-kanji-variants.json` là source-only.

**Thuật ngữ:** mỗi khái niệm còn đúng một tên, và các tên này đã ghi vào `pipeline/ja-glossary.json` (32 mục mới, `source: unverified`):

| Khái niệm | Tên chọn | Tên bị thay |
|---|---|---|
| Soi đội | 編成解析 / スクショ編成解析 | 編成判定, 編成診断 |
| Kho tướng | 武将図鑑 | 武将庫 |
| Gợi ý đội từ kho | 武将図鑑から編成提案 | 所持武将で編成, 所持武将から編成提案 |
| Đội chuẩn | おすすめ編成 | 推奨編成 |
| Chiêu mộ | 登用 / 登用記録 | 招聘, 募集 |
| Đếm đội | 編成 / 部隊 | チーム |
| Đội chức năng | 機能特化編成 | 機能チーム |

Tiêu đề trang dùng tên site không có ngoặc 「」.

**Bật ja** (bước 9 của C1):

- nối `'ja'` vào `SITE_LOCALES`; `git mv src/pages/_ja src/pages/ja`; bỏ exclude trong `tsconfig.json`;
- sửa test thứ tự, `switchTargets` và hreflang trong `tests-js/i18n-locales.test.mjs`;
- `zh-locale.spec.mjs` chọn link chuyển ngôn ngữ theo `hreflang`;
- `ja-locale.spec.mjs`:
  - regex dòng báo thiếu khớp chữ C3 (`日本語訳がない`);
  - thêm kiểm "trang đội ja không còn chữ Hán nguồn chưa đổi tự dạng", trừ ký tự có trong tên Nhật đã xác minh (ví dụ 焰逐風飛) và tên game 三國志;
- `spa-parity.spec.mjs` không tính link `data-lang-current` khi đếm `aria-current`;
- test dist và sitemap đếm theo `SITE_LOCALES.length`.

Build không cần thêm chuỗi ja nào: C2 đã đủ (`pick` không ném lỗi ở trang nào).

## Ghim lại localization

Theo đúng chuỗi lệnh ở phase-08:

1. Ghim lại 44 hash trong `policy.sourceFiles`: 43 file sau khi ghép, cộng 1 file sửa lại sau đó. `inventory` báo stale 0, unknown 0. `baseline.notes` không đổi.
2. `site_localization build/check/publish/check --stage public/prune`: generation Recommended mới là `c96c9871…`; prune bỏ `30634f3f…`.
3. `team_route_handles --rebind/--check`: giữ 1.681 handle, thêm 0, bỏ 0.
4. `lookup_route_handles --write/--check`: 983 id, 57 luật redirect, `_redirects` không đổi.

Hash nguồn ghim trên kết quả ghép cuối. Sau commit ghim không có commit nào sửa file trong `sourceFiles`.

## Kết quả kiểm

| Lệnh | Kết quả |
|---|---|
| `npm run check` | xanh (localization public check, `astro check` 0 lỗi, 0 cảnh báo) |
| `npm run build` | xanh, 8.698 trang, **21 s** (baseline phase A: 19 s; máy đang tải nặng, load ~18) |
| `npm run verify` | xanh, "Verified 9136 dist files", `zh-gaps` và `report-ja-gaps --check` khớp, **13 s** (baseline: 11 s) |
| `npm run test:dist` | 69/69 |
| `npm run test:node` | 943/943 |
| `python3 -m unittest discover -s tests` | 528 OK (13 skip) |
| `(cd worker && npm test && npm run typecheck)` | 196/196, typecheck sạch; `tests-js/worker-locales-parity.test.mjs` xanh |
| `(cd mcp-worker && npm run check:repository)` | Các bước check-workflow-build, knowledge-bundle, typecheck, build và release contract xanh. Vitest lần chạy sau khi sửa: 557/558. Test đỏ là `test/performance/domain-budget.test.ts`, ngưỡng CPU `coldLoadMs < 2000` (đo được 2366 và 3866 ms). Máy lúc đó có load trung bình 19–32 vì các session khác chạy song song. Chạy riêng test này thì 2/2 xanh; lần chạy đầu cùng mã (trước khi sửa build-worker-assets) cũng 558/558. Vì bước này đỏ, gate dừng trước e2e, nên e2e được chạy riêng ở dòng dưới |
| `node scripts/design-tokens.mjs --check` | xanh |
| Playwright `ja-locale`, `zh-locale`, `landing`, `responsive` (+ `spa-parity`) | 133/133. Có một lần `spa-parity` "requests only the data sources" bị timeout khi máy quá tải; chạy lại thì xanh |
| `npm run test:e2e` (toàn bộ) | 723/725. Hai test hết thời gian ở `page.goto` khi máy quá tải: `a11y-targets` A5 và `team-ssr-detail-states:50`. Chạy lại hai spec đó: 9/9 xanh. Một lần chạy trước, trong `check:repository`, bắt được 4 lỗi thật (2 của ja-locale, 2 của spa-parity vì link bản đang xem của nhóm ngôn ngữ); cả 4 đã sửa ở `b7a9472` |

Thời gian dựng trang: Astro báo "8698 page(s) built in ~16 s" (trước khi bật ja: 5.799 trang). Tổng `npm run build` tăng khoảng 10% so với baseline phase A, thấp hơn mức 40–50% plan dự kiến.

## So output

Baseline lấy từ `origin/feat/ja-locale` (`3cff5ba`) cộng 2 dòng đăng ký data ja trong manifest, vì nếu thiếu thì base build đỏ. Kết quả: 6.131 file, `filesSha256 9dfd276c…f9cd`, trùng baseline của C1/C3. Head: 6.131 file (trừ `ja/`), `filesSha256 2b1423c3…`. Cả hai snapshot dùng `--allow-locale ja`.

`compare --allow-locale ja --allow-file 404.html --allow-file robots.txt --allow-file _headers --allow-file _redirects --allow-file css/styles.css`:

- đổi 6, thêm 0, mất 0;
- ngoài allowlist: 1, là `llms.txt`.

Thêm `--allow-file llms.txt` thì ngoài allowlist là **0**. Không trang HTML vi/zh nào đổi sau khi đã gộp cụm nút chuyển ngôn ngữ.

Diff các file dùng chung:

- `robots.txt`: thêm `Disallow: /ja/quan-tri/` ở 5 nhóm bot;
- `_headers`: thêm khối `/ja/*`;
- `_redirects`: thêm 19 luật `/ja/…`;
- `404.html`: thêm khối ja ẩn;
- `css/styles.css`: nhóm chuyển ngôn ngữ, `:root:lang(ja)` và kiểu nhãn tên Nhật;
- `llms.txt`: câu giới thiệu có thêm "bản tiếng Nhật (`/ja/`)", cùng 3 mục mới (Bản tiếng Nhật, bài viết tiếng Nhật, RSS tiếng Nhật). Đây là thiết kế của C1: mục ja chỉ hiện khi ja bật.

## Quét trang `/ja/`

Script quét mọi trang HTML dưới `/ja/` (2.899 trang). Với mỗi trang, script tìm chữ Việt có dấu trong `<main>` và `<title>`, và chữ Hán nguồn có dạng Nhật khác (theo `data/ja-kanji-variants.json`, trừ ký tự có trong tên Nhật đã xác minh và 三國志). Phần `lang="zh-*"` (dòng 原名) và `translate="no"` được bỏ qua.

- Landing, 15 trang mục và trang nhóm, 1.708 trang Đội chuẩn (gồm trang mùa), 167 trang Đội khác, 19 trang Khai hoang, trang cộng đồng, chính sách, công cụ và blog: 0 dòng tiếng Việt, 0 chữ Hán nguồn chưa đổi.
- Tra cứu: 991 trang, 0 chữ Hán nguồn chưa đổi, nhưng **24 trang tướng còn từ "Châu"**. Từ này nằm ngay trong chữ Trung nguồn của dữ liệu Tra cứu ("消耗 50K「Châu」", ghi chú mùa PK-S27), nên bản zh cũng có. Đây là lỗi dữ liệu nguồn, không thuộc phạm vi phase này (mục "Việc còn lại").
- Mẫu trang Đội chuẩn `/ja/doi-chuan/pk-s10-quan-cung/` hiện SP 袁紹 / SP 朱儁 / 沮授, các chiến pháp 臥薪嘗胆 / 威謀必至 / 無當飛軍 (tên đã xác minh) / 焰逐風飛 / 八門金鎖の陣 / 刮骨療毒, và dòng báo thiếu ở khối 備考.

## Ghi chú cho PR

- `llms.txt` là file dùng chung thứ 6 đổi có chủ đích. Nên thêm vào allowlist của cổng so byte và vào câu hỏi Q8.
- `DisclaimerPage` bản ja có câu mới về cách ghi tên theo bản Nhật (C2c). Chủ repo cần xác nhận.
- Thứ tự deploy theo G: backup D1 → migrate 0015 → deploy community-worker → merge site.

## Việc còn lại

1. "Châu" trong chữ Trung nguồn của 3 ghi chú mùa PK-S27 (dữ liệu Tra cứu, hiện ở 24 trang tướng vi/zh/ja). Nên tách GitHub issue để sửa nguồn rồi dịch lại.
2. Panel cấu hình mùa (`seasonConfigDetail`, chỉ mở khi có `?config=`) vẫn hiện văn xuôi chữ Trung của mô hình mùa ở bản ja. Tên tướng, chiến pháp và binh thư trong panel đã là tên Nhật.
3. `scripts/preview-locale-hook.mjs` được giữ lại. Khi ja đã bật, hook không đổi gì; muốn bỏ thì phải sửa `report-ja-gaps.mjs` và `lookup-ja-profile.test.mjs`.
4. Thuật ngữ mới (32 mục `unverified` trong glossary), tên site 「三國志 真戦 攻略手帳」 và tên kịch bản cần người chơi bản Nhật soát ở phase H.
5. Cổng 4174 của Playwright cố định. Khi một session khác chạy e2e cùng lúc trên máy, test sẽ đánh nhầm server. Lần chạy riêng của phase này dùng cấu hình tạm ở cổng khác (không commit).

## Câu hỏi chưa giải

- `llms.txt` có tính là file dùng chung được phép đổi (Q8) không?
- Chọn 武将図鑑 cho "kho tướng" (theo điều phối) làm tên công cụ thành 「武将図鑑から編成提案」, trong khi 図鑑 cũng là tên mục Tra cứu (図鑑検索). Có cần chủ repo xác nhận không?
