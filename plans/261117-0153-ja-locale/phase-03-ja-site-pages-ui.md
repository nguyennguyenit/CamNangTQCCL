# Phase C — Trang `/ja/`, chuỗi UI ja, Tra cứu và đội đọc dữ liệu ja

Branch tích hợp: `feat/ja-locale-c-ja-site` (tạo sau khi A và B đã ghép vào `feat/ja-locale`). Phụ thuộc: A, B. Effort 36h. Rủi ro: cao (khối lượng chuỗi lớn, đụng ~70 file, đổi output dùng chung).

C chia thành ba phần có **sở hữu file rời nhau**, chạy song song trong ba worktree con rồi gộp vào branch tích hợp C. Mỗi phần tự thêm chuỗi ja cho chính các file mình sở hữu, nên không có hai phần nào cùng sửa một file.

## Bối cảnh

- Sau A, `pick`/`L` chọn biến thể theo chỉ số trong `SITE_LOCALES`, bỏ qua biến thể thừa ở cuối và ném lỗi khi thiếu (phase A, mục "Thiết kế"). Vì vậy C2/C3 có thể thêm chuỗi ja vào lời gọi trong khi `SITE_LOCALES` vẫn là `['vi','zh']`: vi/zh vẫn build xanh và vẫn so trùng byte được. C1 bật `'ja'` ở **commit cuối** của branch tích hợp C.
- Test arity (`tests-js/i18n-call-arity.test.mjs`) chạy với `I18N_ARITY_LOCALES=vi,zh,ja` trong lúc làm từng phần; sau khi bật ja, giá trị mặc định khớp và biến môi trường không còn cần.
- `data/lookup-ja.json` và `data/ja-kanji-variants.json` theo hợp đồng ở `docs/ja-lookup-data.md` (phase B).
- 18 obligation UI của policy chứa lời gọi `L(…)`/`pick(…)` đóng ngoặc (`js/lookup-detail.js` 7, `js/roster-recommend-ui.js` 4, `js/team-filter-section.js` 3, `js/render.js` 1, `js/recommended-reference-render.js` 1, `js/lookup-profile.js` 1, `src/lib/lookup-item-pages.ts` 1); thêm biến thể ja làm biểu thức không còn nằm nguyên văn trong file nên `site_localization check` báo thiếu (`pipeline/site_localization.py:1797-1806`). C cập nhật đúng 18 biểu thức này trong `UI_LITERAL_OBLIGATIONS`; obligation thuộc lớp `authored-vi` nên không cần receipt dịch (`docs/deployment-guide.md:320`).

## C1 — Khung locale ja (worktree `c1-ja-shell`)

Sở hữu: `js/i18n.js`, `src/lib/locale-routes.ts`, `src/layouts/SiteLayout.astro`, `js/site-chrome.js`, `src/pages/ja/**` (mới, 30 file vỏ mỏng gương `src/pages/zh/**`), `src/pages/404.astro`, `src/pages/sitemap.xml.ts`, `scripts/verify-astro-dist.mjs`, `src/lib/public-artifact-manifest.mjs`, nhóm blog (`src/lib/blog-*.ts`, `src/components/blog/*`, `src/pages/ja/rss.xml.ts`), `public/_headers`, `public/robots.txt`, `pipeline/lookup_route_handles.py` + `public/_redirects` (sinh lại), `docs/design/so-binh-phap/tokens.json`, `css/styles.css`, `tests-js/astro-dist-contract.test.mjs`, `tests-js/seo-dist-contract.test.mjs`, `tests-js/pages-headers-contract.test.mjs`, `tests-js/locale-route-mirror.test.mjs` (mới), `tests-e2e/ja-locale.spec.mjs` (mới).

Bước:

1. Thêm bảng ja vào mọi bảng locale của `js/i18n.js` (`LOCALE_PREFIX.ja = '/ja'`, `LOCALE_HTML_LANG.ja = 'ja'`, `LOCALE_INTL.ja = 'ja-JP'`, `LOCALE_OG.ja = 'ja_JP'`, `LOCALE_LABEL.ja = '日本語'`). Chưa nối `'ja'` vào `SITE_LOCALES` cho tới bước 9.
2. Tạo `src/pages/ja/**` bằng cách chép cấu trúc `src/pages/zh/**` và đổi `locale="zh"` thành `locale="ja"`. Viết `tests-js/locale-route-mirror.test.mjs`: với mọi locale khác `vi`, cây `src/pages/<locale>/` có đúng cùng tập file như `src/pages/zh/` và nội dung chỉ khác chuỗi locale (giữ DRY bằng test thay cho route động `[locale]`, tránh xung đột ưu tiên route của Astro).
3. Nút chuyển ngôn ngữ ba lựa chọn: một nhóm `<nav data-lang-switcher>` gồm ba link (locale hiện tại có `aria-current="page"`, không phải link chết), dùng ở header và menu mobile; `js/site-chrome.js` giữ query/hash cho mọi `[data-lang-switch]` (`js/site-chrome.js:101-115` đã duyệt nhiều link, chỉ cần bỏ giả định một đích). Thêm token/component vào `docs/design/so-binh-phap/tokens.json` trước, rồi CSS; `node scripts/design-tokens.mjs --check` và `node scripts/design-compare.mjs --tokens --phase NN` không lệch chưa giải thích. Thêm `:root:lang(ja)` với chồng font tiếng Nhật (Hiragino Sans, Yu Gothic, Noto Sans JP) cạnh `:root:lang(zh)` hiện có (`css/styles.css:454`) để chữ Hán trên trang ja hiện tự dạng Nhật.
4. `src/pages/404.astro`: thay script `pickZh` (`src/pages/404.astro:6-8`) bằng script chọn khối theo `LOCALE_PREFIX` sinh từ `SITE_LOCALES`, thêm khối ja ẩn. Đây là thay đổi chủ động của file dùng chung `404.html`.
5. Sitemap/hreflang: sau A, `mirroredSitemapRoutes` đã sinh theo danh sách nên tự có ja khi bật. Cập nhật số khóa cứng `5738 + 2 * seasonPageList.length` (`tests-js/astro-dist-contract.test.mjs:1030`, `:1163`) thành `SITE_LOCALES.length * (2869 + seasonPageList.length)`; verifier kiểm khối ja của 404 (`scripts/verify-astro-dist.mjs:832-834` đang chỉ kiểm zh).
6. `public/_headers`: thêm khối `/ja/*` giống `/zh/*` (`public/_headers:7-8`); `public/robots.txt`: thêm `Disallow: /ja/quan-tri/` ở mọi nhóm bot cạnh `/zh/quan-tri/` (`public/robots.txt:4,10,16,22,28`); test `pages-headers-contract` kiểm. `pipeline/lookup_route_handles.py:41` `REDIRECT_LOCALE_PREFIXES = ("", "/zh")` thêm `"/ja"`, chạy `python3 -m pipeline.lookup_route_handles --write` rồi `--check` để sinh lại `public/_redirects`; thêm test JS khẳng định `_redirects` có luật cho mọi tiền tố trong `LOCALE_PREFIX` (Python không đọc được danh sách JS, test giữ hai bên khớp).
7. Blog `/ja/bai-viet/` và `/ja/rss.xml`: danh sách rỗng khi chưa có bài ja (`postsForLocale('ja')`); hreflang bài chỉ ghép khi cùng `translationKey` (sau A đã là `translationsOf`). Bài ja chỉ tạo được khi phase G xong (D1 chặn `lang = 'ja'`).
8. Đăng ký `data/lookup-ja.json`, `data/ja-kanji-variants.json`, `js/shinjitai.js`, `js/locale-name-aliases.js` trong `src/lib/public-artifact-manifest.mjs`.
9. **Commit cuối của branch tích hợp C** (sau khi C2, C3 đã gộp): nối `'ja'` vào `SITE_LOCALES`, cập nhật test thứ tự danh sách thành `['vi','zh','ja']`.
10. `tests-e2e/ja-locale.spec.mjs` (mẫu theo `tests-e2e/zh-locale.spec.mjs`): Landing ja chỉ có chữ Nhật/Hán (không dòng tiếng Việt), `lang="ja"`, đủ hreflang, nút chuyển ngôn ngữ ba lựa chọn giữ query/hash; một trang mục, một trang đội mỗi họ, một trang mùa, trang nhóm và trang riêng Tra cứu (tên Nhật, tên gốc, nhãn trạng thái, nhãn 機械翻訳, dòng báo thiếu), Soi đội và Gợi ý đội mở được, 404 dưới `/ja/` hiện khối ja.

## C2 — Chuỗi UI ja (worktree `c2-ja-strings`)

Sở hữu: mọi file trong `js/` và `src/components/**`, `src/lib/**` có lời gọi `L(`/`pick(`/`t(` hoặc bảng `{vi, zh}`/`[vi, zh]`/hằng `*_ZH` **trừ** các file của C1 và C3. Danh sách chốt bằng lệnh khi bắt đầu (grep `L(`/`pick(` trừ hai tập kia); nhóm chính: cộng đồng và quản trị (`js/community-*.js`, khoảng 700 lời gọi), công cụ (`js/analyze.js`, `js/analyze-state.js`, `js/roster-*.js`, `js/recruit-tracker*.js`, `js/my-teams*.js`), danh sách/chi tiết đội (`js/render.js`, `js/recommended-reference-render.js`, `js/recommended-reference-state.js`, `js/team-filter-section.js`, `js/team-detail*.js`, `js/khaihoang-detail.js`, `js/app.js`), component trang (`src/components/landing/Landing.astro`, `src/components/pages/*.astro` trừ hai trang Tra cứu thuộc C3, `src/components/community/*.astro`), `src/lib/{official-links,policy-pages,landing-stats,community-teams,community-team-pages,season-pages,section-icons}.ts`; cộng `pipeline/site_localization.py` (chỉ 18 biểu thức obligation). `js/analyze.js` thuộc C2: thêm `locale` vào payload gửi Worker (`postWorker({image, turnstileToken, mode})`, `js/analyze.js:230`) theo hợp đồng của D, gọi `withLocaleAliases` của C3 khi locale là ja, và với `explainSubstitute` ở ja gửi chữ hiệu ứng **Trung nguồn** (không gửi bản dịch máy) kèm `locale: "ja"`.

Quy tắc dịch: dịch từ chuỗi zh và vi cùng lời gọi, ưu tiên thuật ngữ của bản game Nhật (bảng `pipeline/ja-glossary.json` của B; thiếu thì theo Kazten), giữ placeholder/template literal và số; tên riêng giữ `translate="no"`; không ghép hai ngôn ngữ trong một chuỗi; chuỗi UI không gắn nhãn 機械翻訳 (nhãn chỉ dành cho mô tả dữ liệu). Hằng `*_ZH` và thuộc tính hậu tố `Zh` (`FACET_LABEL_ZH`, `unitZh`…) đổi thành bản ghi theo locale hoặc thêm biến thể ja theo cùng mẫu với A; không thêm hằng `*_JA` song song.

Có thể chia C2 tiếp cho nhiều sub-agent theo nhóm file ở trên (mỗi sub-agent một tập file rời).

Kiểm: `I18N_ARITY_LOCALES=vi,zh,ja node --test tests-js/i18n-call-arity.test.mjs` cho tập file của C2; `npm run test:node`; `site_localization check` (sau khi ghim lại trên branch) xanh; build vi/zh + `compare` với baseline vẫn 0 khác (vì ja chưa bật, chuỗi thừa bị bỏ qua).

## C3 — Tra cứu, tên đội và báo cáo gap ja (worktree `c3-ja-lookup`)

Sở hữu: `js/lookup-detail.js`, `js/lookup-field-labels.js`, `js/unified-lookup.js`, `js/lookup-master.js`, `js/lookup-profile.js`, `js/lookup-tactic-view.js`, `js/lookup-tactic-profile.js`, `js/lookup-data.js`, `js/lookup-page.js`, `js/website-display.js`, `js/shinjitai.js` (mới), `js/locale-name-aliases.js` (mới), `src/lib/lookup-pages.ts`, `src/lib/lookup-item-pages.ts`, `src/lib/tactic-display.ts`, `src/lib/root-static-artifacts.ts`, `src/lib/structured-data.ts`, `src/lib/team-detail-pages.ts`, `src/components/pages/LookupGroupPage.astro`, `src/components/pages/LookupItemPage.astro`, `src/components/pages/LookupHubPage.astro`, `scripts/report-zh-gaps.mjs`, `scripts/report-ja-gaps.mjs` (mới), `docs/ja-gaps.md` (sinh), `package.json`, test liên quan (`tests-js/unified-lookup.test.mjs`, `lookup-profile-trees`, `lookup-master`, `lookup-tactic-view`, `website-display`, `tactic-display-name`, `tests-js/shinjitai.test.mjs` mới, `tests-js/locale-name-aliases.test.mjs` mới, `tests-js/report-ja-gaps.test.mjs` mới).

Thiết kế:

1. **Nạp và xác minh.** Trang nhóm Tra cứu và công cụ ở `/ja/` nạp `data/lookup-ja.json` qua bộ nạp byte dùng chung (`createByteLoader`) và kiểm SHA-256 với pin nhúng trong trang (`#lookup-ja-pin`, tính lúc build từ bytes như pin binh thư), đồng thời kiểm `lookupGenerationId` khớp `data/lookup-manifest.json`. Trang vi/zh không nạp file này. Build (`src/lib/lookup-pages.ts`) dừng nếu `lookupGenerationId` hoặc `sources` của file ja lệch bốn payload hiện tại.
2. **Corpus build.** `lookupBuildCorpus()` gắn lớp ja theo ID; `lookupProfile(corpus, id)` dưới `withLocale('ja')` dựng hồ sơ như bản zh nhưng: tên = `entries[id].name`; luôn có trường "原名" = tên chữ Hán nguồn (yêu cầu "trang chi tiết luôn hiện cả tên gốc"); nhãn trạng thái tên ("確認済み" cho `verified`, "字形変換" cho `derived`, chốt chữ khi làm) có `title` giải thích; mô tả lấy từ `texts[key]` kèm khối nhãn "機械翻訳" + "数値は中国大陸版に基づく"; khóa vắng → dòng báo thiếu và hồ sơ gắn cờ thiếu như `viOnly` của zh; giá trị đóng tiếng Việt dịch qua bảng `JA_VALUES` cùng khóa với `ZH_VALUES` (`js/lookup-detail.js:24-60`), tổ chức lại thành một bảng theo locale để không có hai bảng song song khác cấu trúc.
3. **Tên theo locale ở một chỗ.** `lookupDisplayName` (`js/lookup-detail.js:245`), `localName`/`loadRawNameResolver` (`js/website-display.js:192-207`) có nhánh ja: ID → `entries[id].name`; tên thô chưa khớp từ điển (ví dụ ô Đội chuẩn chưa đối chiếu) → `toShinjitai(tên thô)` của `js/shinjitai.js` (đọc cùng `data/ja-kanji-variants.json`; test parity với `tests/fixtures/shinjitai-vectors.json` của B); tên đội Đội chuẩn (`nameZh`) → `toShinjitai`. Trang chi tiết đội ja dựng tiêu đề như zh nhưng bằng tên Nhật.
4. **Ghi chú đội chữ Trung** (`displayNotes.blocks[].textRaw`) trên `/ja/`: mặc định ẩn và hiện dòng báo thiếu như cách bản zh bỏ chữ chỉ có tiếng Việt (chờ Q4; nếu chủ repo chọn dịch máy thì tách GitHub issue).
5. **SEO ja.** Meta description và JSON-LD trang riêng ja chỉ dùng chữ không phải dịch máy (tên Nhật, nhóm, phe, loại, số); `alternateName` = tên chữ Hán gốc vì trang có hiện; không khai tên Việt (theo quy tắc `src/lib/structured-data.ts`, `docs/code-standards.md` mục JSON-LD).
6. **Tìm kiếm ja.** Khớp tên Nhật, `chinese`, `aliases` (gồm giản thể); không khớp chữ Việt (không hiển thị); không sinh hay tìm theo kana.
7. **Alias cho Soi đội** (`js/locale-name-aliases.js`): `withLocaleAliases(dict, jaEntries)` trả bản sao bản ghi từ điển với `aliases` nối thêm `entries[id].name` (bỏ trùng, giữ thứ tự), để `createEntityIndex` (`js/analyze-map.js:170-185`) khớp chắc tên Nhật in trong ảnh mà không phải sửa `analyze-map.js`. `js/analyze.js` (file của C2) gọi hàm này khi locale là ja; phase D dùng lại trong `worker/eval/score.ts`. Đây là "unit test bộ khớp alias" của hợp đồng.
8. **Báo cáo gap.** Tổng quát hoá `scripts/report-zh-gaps.mjs` thành hàm theo locale (giữ lệnh và đầu ra zh như cũ, `docs/zh-gaps.md` không đổi byte); `scripts/report-ja-gaps.mjs` là entry mỏng ghi `docs/ja-gaps.md`, liệt kê mục thiếu bản dịch và (bảng riêng) số tên `derived`/`verified` theo nhóm. `package.json` `verify` thêm `node scripts/report-ja-gaps.mjs --check`.

## Thứ tự gộp trong C và cổng so byte

1. C2 và C3 gộp vào branch tích hợp C (ja chưa bật): build vi/zh, `compare` với baseline → 0 khác.
2. C1 gộp, commit cuối bật `'ja'`. Ghim lại localization (người ghép H hoặc owner C). Build, rồi `node scripts/compare-locale-output.mjs compare --base .cache/locale-baseline/993b2d4.json --head <manifest> --allow-locale ja --allow-file 404.html --allow-file robots.txt --allow-file _headers --allow-file _redirects` → không file vi/zh nào đổi ngoài allowlist; diff bốn file dùng chung đính kèm vào PR. `docs/zh-gaps.md` không đổi.

## Cách kiểm

| Loại | Nội dung |
|---|---|
| Unit | arity với `vi,zh,ja`; `locale-route-mirror`; `shinjitai` parity; `locale-name-aliases`; `report-ja-gaps`; hồ sơ Tra cứu ja (tên, tên gốc, trạng thái, nhãn, dòng thiếu, `JA_VALUES`); sitemap 3 locale |
| Tích hợp | `npm run check`, `npm run build`, `npm run verify` (gồm `report-ja-gaps --check`), `npm run test:dist` |
| So output | `compare --allow-locale ja` như trên |
| E2E | `ja-locale.spec.mjs` mới + toàn bộ spec cũ không sửa kỳ vọng vi/zh (trừ chỗ kiểm số lựa chọn của nút ngôn ngữ, nếu có) |
| Thiết kế | `design-tokens --check`, `design-compare --tokens` cho nút ngôn ngữ mới |

## Rủi ro

| Rủi ro | Khả năng × Tác động | Giảm thiểu |
|---|---|---|
| Sót chuỗi ja trong file `.astro` (không có test tĩnh) | Trung bình × Cao | `pick` ném lỗi lúc build mọi trang ja; e2e quét dòng tiếng Việt trên trang ja |
| Đường client hiếm chạy thiếu chuỗi ja | Thấp × Trung bình | Test arity tĩnh cho mọi file JS/TS |
| Chất lượng chuỗi UI Nhật | Trung bình × Trung bình | Glossary chung với B; review độc lập ở H soát mẫu |
| Nút ngôn ngữ mới đổi layout header/mobile | Trung bình × Trung bình | Token trước, `design-compare`, e2e `responsive` |
| Bốn file dùng chung đổi (`404.html`, `robots.txt`, `_headers`, `_redirects`) | Chắc chắn × Thấp | Allowlist tường minh, diff đính PR, hỏi chủ repo (Q8) |
| Trang ja tăng ~50% thời gian build/verify | Chắc chắn × Thấp | Đo và ghi ở H; verifier đã duyệt theo lô 64 trang |

## Rollback

Revert commit bật `'ja'` là đủ để gỡ toàn bộ `/ja/` khỏi output (route ja vẫn còn file nhưng phải gỡ cùng: revert cả merge C1). C2/C3 không đổi output vi/zh nên có thể giữ. Sau revert, chạy lại chuỗi ghim localization và `lookup_route_handles --write`.

## Done khi

Mọi route vi có bản `/ja/`; verifier, sitemap, hreflang kiểm ba locale; `compare` đạt; Tra cứu ja đạt tiêu chí 5 của `plan.md`; `npm run verify` chạy `report-ja-gaps --check`; e2e ja xanh.
