# Phase C1: khung locale ja (báo cáo)

Ngày 2026-11-17. Branch `feat/ja-locale-c1-shell`, tạo từ `origin/feat/ja-locale` (`4200dc9`). Worktree `/Users/plateau/Project/CamNangTQCCL-ja-c1`. Đã làm bước 1–8 và 10 của mục C1. Chưa làm bước 9: `SITE_LOCALES` vẫn là `['vi','zh']`.

## Kết quả

Khung ja đã sẵn sàng. Bước tích hợp chỉ còn bật `ja` và đổi tên một thư mục (xem mục "Cách bật ja"). Build vi/zh xanh, mọi gate xanh. So output với baseline:

- Gộp cụm nút chuyển ngôn ngữ và khai allowlist 5 file dùng chung: không còn file vi/zh nào khác baseline.
- So thô: mọi trang đều khác, vì nhóm chuyển ngôn ngữ mới có thêm link của bản đang xem.

Commit ghim localization nằm cuối, tách riêng.

## Commit

| Commit | Nội dung |
|---|---|
| `e265141` feat(i18n) | Bảng locale ja ở `js/i18n.js`. `src/pages/_ja/` (26 file gương `src/pages/zh/`). `tsconfig.json` exclude. Test `locale-route-mirror` (mới). Sửa `i18n-locales`, `i18n-call-arity`. Đăng ký 2 file data ja trong manifest. |
| `4bc1e99` feat(layout) | Nhóm chuyển ngôn ngữ. Chuỗi ja của `SiteLayout`. `locale-routes` (tên truy cập theo cặp). `site-chrome`. Token + CSS + `:root:lang(ja)`. `404.astro`. Verifier. `astro-dist-contract`. |
| `8941210` feat(deploy) | `_headers`, `robots.txt`. `lookup_route_handles.py` thêm `/ja`, sinh lại `_redirects`. Test Python. `pages-headers-contract`. |
| `201cbff` feat(blog) | Chuỗi ja của blog, RSS `<language>ja`, phút đọc tiếng Nhật. Mục ja trong `llms.txt` chỉ hiện khi ja bật. |
| `e61cfdc` test(e2e) | `tests-e2e/ja-locale.spec.mjs` (23 test, `test.skip` khi ja chưa bật). |
| (báo cáo) docs(plan) | File này. |
| (cuối) chore(data): ghim lại hash nguồn | Hash `js/site-chrome.js` và `src/layouts/SiteLayout.astro` trong policy, generation Recommended mới `a5cd2e2a…`, `data/website-display.json`, `pipeline/team-route-handles.json`. Người ghép bỏ commit này và chạy lại chuỗi ghim. |

## Đã làm theo từng bước

1. **Bảng locale (`js/i18n.js`)**. `LOCALE_PREFIX`, `LOCALE_HTML_LANG`, `LOCALE_INTL`, `LOCALE_OG`, `LOCALE_LABEL` đều có `ja` (`/ja`, `ja`, `ja-JP`, `ja_JP`, `日本語`).
   - Mọi hàm chỉ duyệt `SITE_LOCALES`, nên bản ghi khai trước không đổi output.
   - `tests-js/i18n-locales.test.mjs` giờ kiểm: mọi bảng có cùng tập khóa, và tập khóa bắt đầu bằng đúng `SITE_LOCALES`.
2. **Route `/ja/`**. Cây route nằm ở `src/pages/_ja/` thay vì `src/pages/ja/` (lý do ở "Lệch khỏi plan"). Nội dung là gương của `src/pages/zh/` với `locale="ja"`, `postsForLocale('ja')`, `rssDocument("ja", …)`.
   - `tests-js/locale-route-mirror.test.mjs` kiểm bốn điều với mọi locale có tiền tố đã khai bảng:
     - đúng một thư mục route (`<mã>/` khi bật, `_<mã>/` khi chưa bật);
     - `tsconfig.json` chỉ exclude thư mục của locale chưa bật;
     - cùng tập file với `zh/`;
     - nội dung chỉ khác mã locale và tên ngôn ngữ trong chú thích.
3. **Nhóm chuyển ngôn ngữ**. `nav.lang-switcher[data-lang-switcher]` nằm ở header và ở chân menu mobile, có một link cho mỗi locale theo thứ tự `SITE_LOCALES`.
   - Link của bản đang xem trỏ về chính trang (không phải link chết), mang `aria-current="page"` và `data-lang-current`.
   - Link sang bản khác mang `data-lang-switch`. Tên truy cập lấy từ `languageSwitchAria(page, target)` ở `src/lib/locale-routes.ts`; thiếu cặp thì build lỗi.
   - `js/site-chrome.js` giữ query/hash cho cả hai loại link.
   - Header ≤820px ẩn link của bản đang xem. Khi có 2 locale, header mobile vì thế trông như cũ.
   - Chân menu mobile cho CTA xuống hàng khi không đủ chỗ.
   - Token `components.nhom-chuyen-ngon-ngu` (phase 3, 4 probe) được thêm trước, rồi mới viết CSS. Thêm `:root:lang(ja)` (Hiragino Sans, Hiragino Kaku Gothic ProN, Yu Gothic, Noto Sans JP).
   - Mọi chuỗi của `SiteLayout` có biến thể ja. Bản ghi `{vi, zh, …}` (`POLICY_PAGES`, `FEEDBACK_KINDS`) đọc theo `record[locale]`, thiếu thì build lỗi. Nhờ vậy khi C2 thêm khóa `ja` vào các bản ghi này, layout không phải sửa.
4. **404**. Trang có một khối cho mỗi locale: khối Việt hiện, các khối khác ẩn và có `lang`. Script chọn khối theo tiền tố sinh từ `SITE_LOCALES`, rồi đặt `lang`, tiêu đề và chuyển dấu "bản đang xem" của nhóm chuyển ngôn ngữ. Nhóm chuyển ngôn ngữ của 404 trỏ trang chủ từng bản.
5. **Sitemap, test dist và verifier**.
   - Test dist đếm sitemap bằng `SITE_LOCALES.length * (2869 + số trang mùa)`, và dựng danh sách URL, hreflang, og theo danh sách locale.
   - Fixture của verifier (`pairHead`, sitemap, landing, trang mục, blog, Tra cứu, đội cộng đồng) dựng theo `SITE_LOCALES`.
   - Verifier kiểm nhóm chuyển ngôn ngữ của mọi trang có bản gương (2 nhóm, đủ locale, đúng một bản đang xem).
   - Verifier kiểm khối 404 ẩn của mọi locale có tiền tố.
   - Thêm unit test cho cả hai kiểm tra mới.
6. **File triển khai**.
   - `_headers` có `/ja/*`. `robots.txt` có `Disallow: /ja/quan-tri/` ở cả 5 nhóm bot.
   - `REDIRECT_LOCALE_PREFIXES = ("", "/zh", "/ja")`. Chạy `--write` rồi `--check`: 57 luật (trước là 38).
   - Test lấy danh sách tiền tố từ `LOCALE_PREFIX`. `LOCALE_PREFIX` gồm cả locale đã khai nhưng chưa bật, nên test đúng cả khi 2 hay 3 locale bật. Một test JS giữ danh sách tiền tố của bộ sinh Python khớp với `LOCALE_PREFIX`.
7. **Blog**. `/ja/bai-viet/` và `/ja/rss.xml` rỗng khi chưa có bài ja.
   - Nhãn link bản dịch có đủ 6 cặp. `SITE_NAME.ja` = 「三國志 真戦 攻略手帳」.
   - `llms.txt` chỉ thêm mục tiếng Nhật khi ja đã bật, nên output vi/zh không đổi.
8. **Manifest artifact**. Đã đăng ký `data/lookup-ja.json` và `data/ja-kanji-variants.json`. **Chưa** đăng ký `js/shinjitai.js` và `js/locale-name-aliases.js` (lý do ở "Việc cho bước tích hợp").
10. **E2E**. `tests-e2e/ja-locale.spec.mjs` lấy `zh-locale.spec.mjs` làm mẫu và phủ:
    - Landing: không có dòng tiếng Việt, `lang="ja"`, đủ hreflang 3 locale và x-default, nhóm chuyển ngôn ngữ 3 lựa chọn giữ query/hash;
    - 15 trang mục và trang nhóm;
    - 3 họ trang chi tiết và một trang mùa;
    - trang riêng Tra cứu (tên Nhật, `原名`, nhãn trạng thái tên, `機械翻訳`, `数値は中国大陸版に基づく`, dòng báo thiếu, lấy mục từ `data/lookup-ja.json`);
    - Soi đội, Gợi ý đội, menu mobile 390px, 404 dưới `/ja/`, blog/RSS.

## Lệch khỏi plan

- **`src/pages/_ja/` thay cho `src/pages/ja/`**. Astro sinh mọi trang tĩnh trong `src/pages/` mà không có điều kiện nào chặn được (chỉ route động có `getStaticPaths`). Nếu để ở `src/pages/ja/` thì hoặc trang ja được sinh với nội dung vi, hoặc build lỗi. Thư mục bắt đầu bằng `_` thì Astro bỏ qua.
  - Prop `locale="ja"` chưa thuộc kiểu `SiteLocale`, nên `astro check` báo lỗi kể cả trong `_ja`. Vì vậy `tsconfig.json` thêm `"src/pages/_ja"` vào `exclude`. Đã thử: không exclude thì 1 lỗi, có exclude thì 0 lỗi.
- **Sửa file ngoài danh sách C1** (không thuộc C2/C3):
  - `tsconfig.json` (dòng exclude ở trên);
  - `tests-js/i18n-locales.test.mjs` (test của `js/i18n.js`);
  - `tests-js/i18n-call-arity.test.mjs`: không đặt biến môi trường thì nhận từ `SITE_LOCALES.length` tới số locale đã khai bảng, tức 2–3 lúc này. Nếu không đổi, chuỗi ja của C1/C2/C3 làm `test:node` đỏ cho tới khi bật ja. `I18N_ARITY_LOCALES=vi,zh,ja` vẫn kiểm đúng bằng 3;
  - `tests/test_lookup_route_handles.py` (số luật redirect theo `REDIRECT_LOCALE_PREFIXES`).
- **`css/styles.css` đổi**, vì là CSS của nhóm chuyển ngôn ngữ. Allowlist của cổng so byte vì vậy cần thêm `--allow-file css/styles.css`, ngoài 4 file plan đã liệt kê.

## Baseline và so output

`origin/feat/ja-locale` (`4200dc9`) **build đỏ**. Phase B thêm `data/lookup-ja.json` và `data/ja-kanji-variants.json` mà không đăng ký trong `src/lib/public-artifact-manifest.mjs`, nên `validatePublicArtifactTree` báo tập file data lệch manifest. Baseline vì vậy được chụp từ `4200dc9` cộng đúng 2 dòng đăng ký này (đây cũng là bước 8).

| | Baseline | Head (C1 + ghim) |
|---|---|---|
| Số file trong manifest (trừ `js/`) | 6131 | 6131 |
| `filesSha256` | `9dfd276c…f9cd` | `06c563b5…aa8f` |
| `compare` thô | | đổi 5803 (5798 trang khác ở cụm nút chuyển ngôn ngữ, cộng 5 file dùng chung), thêm 0, mất 0 |
| `compare --allow-locale ja --allow-file 404.html --allow-file robots.txt --allow-file _headers --allow-file _redirects --allow-file css/styles.css` | | đổi 5 (đúng 5 file trên), thêm 0, mất 0, ngoài allowlist **0** |

`llms.txt`, `sitemap.xml` và mọi trang vi/zh (sau khi gộp cụm nút chuyển ngôn ngữ) trùng baseline. Manifest nằm ở `.cache/locale-baseline/{base,head}.json` và không commit.

## Lệnh kiểm

| Lệnh | Kết quả |
|---|---|
| `npm run check` | xanh (localization check + `astro check` 0 lỗi, 0 cảnh báo) |
| `npm run build` | xanh, 21 s |
| `npm run verify` | xanh: "Verified 6234 dist files", `zh-gaps.md` khớp |
| `npm run test:dist` | 69/69 |
| `npm run test:node` | 907/907 |
| `python3 -m unittest discover -s tests` | 528 OK (13 skip) |
| `node scripts/design-tokens.mjs --check` | xanh |
| `node scripts/design-compare.mjs --tokens --phase 3` (sáng và tối) | `nhom-chuyen-ngon-ngu` không lệch. Có 13 lệch cũ ở `header-trong`, `nut-cta`, `an-binh-phap`, `menu-mobile` (chiều cao header 64/72, CTA desktop 36px…), không liên quan thay đổi này. |
| Playwright `zh-locale`, `ja-locale`, `landing`, `responsive`, `a11y-targets`, `bai-viet-kho-redesign`, `site-localization` | 64 pass, 23 skip (toàn bộ `ja-locale` vì ja chưa bật) |
| `I18N_ARITY_LOCALES=vi,zh,ja node --test tests-js/i18n-call-arity.test.mjs` | đỏ như mong đợi, nhưng không còn lời gọi nào trong file của C1 |

## Thử bật ja cục bộ (không commit)

Cách thử: nối `'ja'` vào `SITE_LOCALES`, đổi `_ja` thành `ja`, bỏ exclude. Kết quả:

- `astro check`: 2 lỗi, đều ở file C2: `WRITTEN_IN: Record<SiteLocale, string>` (`src/components/pages/CommunityTeamPage.astro:46`) và `LANDING_COPY` (`src/lib/landing-stats.ts:378`) thiếu khóa `ja`.
- `astro build`: dừng ở trang đầu tiên được dựng, với lỗi `pick: thiếu biến thể cho locale "ja"` trong `holderName`/`unavailable` (team-ssr, trang chi tiết đội, file C2/C3).
- Build lại với `pick` tạm không ném lỗi (dùng biến thể cuối): dựng được hết `/ja/bai-viet/`, `/ja/rss.xml`, 404 và phần lớn trang mục.
  - Dừng ở `/ja/` vì `LANDING_COPY[locale] is not a function`.
  - Có khoảng 515 nghìn lượt `pick` thiếu biến thể ja.
  - Lần đầu, bộ đọc bản ghi của layout dừng vì `POLICY_PAGES`/`FEEDBACK_KINDS` chưa có `ja` (C2).
- Phần khung của trang ja đã dựng đúng:
  - `lang="ja"`;
  - hreflang vi/zh-Hans/ja/x-default;
  - `og:locale` ja_JP cùng 2 alternate;
  - hai nhóm chuyển ngôn ngữ, `日本語` có `aria-current`, tên truy cập tiếng Nhật;
  - tiêu đề 「記事 — 三國志 真戦 攻略手帳」;
  - RSS `<language>ja`;
  - 404 có khối `ja` ẩn.

Mọi thứ trên chờ C2/C3: chuỗi ja của 2264 lời gọi `L`, 40 `pick`, 80 tuple (số của phase A, trừ phần C1 đã làm), cộng các file `.astro` có `t()`/`pick()` như `Landing` (75 lời gọi), `PrivacyPage` (56), `TermsPage` (32), `CommunityTeamPage` (31)…

## Cách bật ja (bước 9, sau khi C2 và C3 đã gộp)

1. `js/i18n.js`: `SITE_LOCALES = Object.freeze(['vi', 'zh', 'ja'])`.
2. `git mv src/pages/_ja src/pages/ja`, rồi bỏ `"src/pages/_ja"` khỏi `exclude` của `tsconfig.json`. Test `locale-route-mirror` sẽ đỏ nếu thiếu một trong hai việc.
3. Cập nhật test chốt giá trị:
   - `tests-js/i18n-locales.test.mjs`: test thứ tự (`["vi","zh"]`) và hai dòng chốt `switchTargets("vi")`/`("zh")`.
   - `tests-e2e/zh-locale.spec.mjs` đang chọn `.header-actions [data-lang-switch]` như một phần tử duy nhất. Khi có 3 locale, bộ chọn này khớp 2 link và vi phạm strict mode. Cần chọn theo `[hreflang="vi"]`/`[hreflang="zh-Hans"]`. Đây chính là trường hợp "chỗ kiểm số lựa chọn của nút ngôn ngữ" mà plan cho phép sửa.
4. Ghim lại localization (chuỗi ở phase H), build, rồi chạy `compare --allow-locale ja` với allowlist 5 file ở trên.

## Việc cho bước tích hợp và các phần khác

- **Manifest artifact**: sau khi gộp C3, thêm `entry("js", "shinjitai")` và `entry("js", "locale-name-aliases")` vào `src/lib/public-artifact-manifest.mjs`. Validator đòi tập file khớp tuyệt đối, nên chưa thể thêm trên branch C1 khi hai file đó chưa tồn tại.
- `src/lib/season-pages.ts:132` (file C2) còn viết cứng `['', '/zh']` cho luật 301 của mùa hiện tại. Nên đổi sang tiền tố từ `SITE_LOCALES`. Hiện chưa gây lỗi: verifier chỉ kiểm luật JS có trong `_redirects`, và `_redirects` đã có luật cho `/ja`.
- **Tên site bản ja** 「三國志 真戦 攻略手帳」 đã báo orchestrator. Title các trang của C2/C3 nên dùng cùng tên này; test dist kiểm `og:site_name` bằng tên này.
- **Thuật ngữ mục trong menu** (C2 nên thống nhất trong title trang): おすすめ編成, その他の編成, 共存編成, 開拓, 図鑑検索, 登用記録, スクショ編成解析, 所持武将で編成, 記事, 戦報, コミュニティ編成.
- **Spec e2e ja** đang đoán trước chữ của C3: nhãn trạng thái tên (`確認済み|字形変換`, theo plan) và dòng báo thiếu (`/未翻訳|翻訳(?:は)?(?:まだ)?(?:ありません|準備中)/`). Nếu C3 chốt chữ khác thì sửa hai regex này.
- Không sửa file phase (`phase-03-…md`) để tránh trùng với C2/C3. Trạng thái nằm ở báo cáo này.

## Câu hỏi chưa giải

1. Cách để route ở `src/pages/_ja/` cộng dòng exclude trong `tsconfig.json` có được chấp nhận không? Phương án khác là dựng route `/ja/` ngay lúc bật (sinh từ `zh/` bằng script), nhưng như vậy plan phải có thêm một script.
2. Allowlist của cổng so byte ở bước C cần thêm `css/styles.css`. Có cần chủ repo duyệt như 4 file dùng chung kia không (Q8)?
3. Tên site 「三國志 真戦 攻略手帳」 và các thuật ngữ menu ở trên chưa qua người dùng game Nhật soát.
