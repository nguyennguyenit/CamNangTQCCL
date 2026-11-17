# Báo cáo sửa phát hiện review PR #133 (bản `/ja/`)

Branch `feat/ja-locale-review-fix` (từ `origin/feat/ja-locale` @ `5de2c944`), ngày 2026-11-18. Không merge, không deploy.

## Kết quả

| Phát hiện | Trạng thái | Commit |
|---|---|---|
| M1: quét kho `/ja/goi-y-doi-tu-kho/` ra tên rác | Đã sửa | `b7da302d`, e2e `e6c5d374` |
| M2: pipeline dịch Nhật chặn promote Tra cứu | Đã sửa | `ee030724` |
| L1: lớp ja lỗi thì tên lùi về tên Việt | Đã sửa | `4f3d1e61` |
| L2: 原名 gắn sai `lang` | Đã sửa | `ed8433c4` |
| L3 (issue #130), L4 (issue #136) | Không đụng theo yêu cầu | |

Commit ghim localization riêng, nằm cuối branch.

## M1: đọc ảnh kho khớp tên Nhật

- `js/app.js`: lớp `lookup-ja` giờ nạp cho cả hai công cụ đọc ảnh (`TOOL_SECTIONS`: Soi đội, Gợi ý đội), chỉ khi trang có pin `#lookup-ja-pin` (trang ja). Lỗi nạp thì `jaEntries = null`.
- `js/roster-recommend-ui.js`: nhận `jaEntries`, chỉ dùng khi `currentLocale() === "ja"`, rồi truyền vào ba hàm map ảnh.
- `js/roster-scan-map.js`: khi có `jaEntries`, tên Nhật khớp chính xác được ưu tiên. Bản Nhật gọi 固若金湯 là 金城湯池, mà 金城湯池 lại là chữ Hán nguồn của một chiến pháp khác (bản Nhật gọi chiến pháp đó là 湯池鉄城). Sau đó mới khớp mờ trên `chinese` và mọi bí danh chữ Hán (`withLocaleAliases`). Không có `jaEntries` thì vẫn chạy đúng đường cũ.
- `js/match-dict.js`: thêm tùy chọn `cjkAliases`, mặc định tắt. Phần chấm điểm chữ Hán tách thành `scoreCjk`, logic không đổi.
- Test: `tests-js/roster-scan-map.test.mjs` dùng dữ liệu thật (SP荀彧, `SP 荀彧`, 国の柱石, 霊機一動, 経天緯地, OCR lệch 霊気一動, cặp 金城湯池/湯池鉄城) và có test hồi quy vi/zh. `tests-js/match-dict.test.mjs` có thêm test cho tùy chọn mới. `tests-e2e/beta-tools.spec.mjs` thêm một test ja: Worker giả trả tên Nhật, kho lưu tên Việt với độ tin `high`, chip hiện tên Nhật.
- Đối chiếu `matchDict` mặc định của bản cũ và bản mới trên 6998 truy vấn (chinese, aliases, viet, hanViet, tên Nhật và các chuỗi cắt bớt một ký tự, trên ba từ điển): 0 khác biệt về record, score, runner-up và cờ ambiguous.

## M2: `build_lookup_ja --prune-orphans`

- `--prune-orphans` chỉ dùng được cùng `--write`; ghép với chế độ khác thì argparse báo lỗi, exit 2. Lệnh bỏ các mục mồ côi khỏi `pipeline/ja-translations.json`, ghi lại file đó, rồi build như `--write`. Chữ nguồn mới của các mục bị bỏ thành "chưa dịch" và hiện trong `docs/ja-gaps.md`. Bản dịch hỏng (sha lệch, sai số liệu) vẫn làm builder dừng.
- Khi gặp mục mồ côi, `--check` và `--write` vẫn exit 1, nhưng thông báo lỗi giờ nêu lệnh `python3 -m pipeline.build_lookup_ja --prune-orphans --write`.
- Tài liệu: `docs/ja-lookup-data.md` thêm mục "Khi promote generation Tra cứu mới" (`--prune-orphans --write` → `--check` → `report-ja-gaps`). Khối rebuild trong `README.md` và mục Regeneration triggers của `docs/unified-lookup.md` cập nhật theo.
- Test: `tests/test_ja_build_lookup.py` thêm 3 test: hàm `prune_orphans`; CLI bỏ mục mồ côi rồi `--check` qua, chữ đã đổi không còn bản dịch; `--prune-orphans` thiếu `--write` thì exit 2. Test cũ về mục mồ côi giờ kiểm cả gợi ý lệnh trong thông báo lỗi.

## L1: lớp ja lỗi không lùi về tên Việt

- Sửa ở một chỗ là `loadRawNameResolver` (`js/website-display.js`), nên mọi nơi gọi đều được hưởng: `team-detail.js`, `khaihoang-detail.js`, `app.js`, `community-team-data.js`, `season-page-roster-badges.js`. Khi lớp ja hỏng (thiếu/lệch pin, lệch thế hệ, lỗi mạng ở `lookup-ja.json` hoặc manifest, bảng tự dạng sai hash), hàm dựng `createJaNameResolver(dicts, null, variants)`. Bảng `variants` đọc thẳng từ `data/ja-kanji-variants.json` và vẫn qua `parseKanjiVariants`; nếu bảng cũng lỗi thì dùng bảng rỗng và hiện chữ Hán nguồn nguyên dạng. Promise chỉ lỗi khi chính các từ điển lỗi.
- Test (`tests-js/lookup-ja-profile.test.mjs`): bốn ca lỗi lớp ja đều trả chữ Hán nguồn (固若金湯, `SP 荀彧`, `転・暗蔵玄機`), có thêm ca bảng tự dạng cũng lỗi, và ca từ điển lỗi thì vẫn reject. Assert cũ "thiếu pin thì reject" được thay vì nó ghi nhận đúng hành vi lỗi cần sửa.

## L2: `lang` của 原名

- Thêm `js/han-script.js` với hàm `hanScriptLang(text)`. Hàm dựa trên hai bảng ký tự riêng của giản thể (2654 chữ) và phồn thể (3131 chữ), sinh từ OpenCC commit `fae2a0a9` (STCharacters, TSCharacters, TWVariants; Apache-2.0; cùng nguồn với `ja-kanji-variants.json`), chỉ lấy khối CJK cơ bản và mở rộng A. Chỉ có chữ giản thể thì trả `zh-Hans`, chỉ có chữ phồn thể thì `zh-Hant`; không có chữ phân biệt được hoặc lẫn cả hai thì `zh`. File nặng khoảng 19.6 KB và được đăng ký trong `src/lib/public-artifact-manifest.mjs`.
- `js/lookup-master.js` `nameOriginalTrees` dùng hàm này; SSR và client dùng chung hàm. `nameOriginalTrees` chỉ trả nội dung trên trang ja, nên trang zh không đổi.
- Test: `tests-js/han-script.test.mjs`; trong `lookup-ja-profile` thêm test cho quân sư 白马替主 → `zh-Hans`, công trình 八陣圖 → `zh-Hant`, và một tên trung tính → `zh`.

## Ghim localization

Policy cũ ghim hash của 5 file nguồn đã đổi (`js/app.js`, `js/lookup-master.js`, `js/roster-recommend-ui.js`, `js/roster-scan-map.js`, `js/website-display.js`). Đã ghim lại theo chuỗi trong `phase-08-integration-review.md`:

- `inventory` ra digest `c6689383…` với 68173 location, trùng `baseline.notes`, nên không phải sửa notes.
- Chuỗi candidate → check → publish → check public → prune chạy qua: 6409/6409 obligation đã dịch, `problems: []`. Generation Recommended mới là `b5bffa07…`; prune xóa `86673de2…`.
- `team_route_handles --rebind` giữ 1681 handle, không thêm, không bỏ. `--check` và `lookup_route_handles --check` đều ok.

## Kiểm thử

| Lệnh | Kết quả |
|---|---|
| `npm run check` | 0 lỗi, 0 cảnh báo (2 hint) |
| `npm run build` | ok |
| `npm run verify` | ok (9137 file dist, zh-gaps và ja-gaps khớp) |
| `npm run test:dist` | 69/69 |
| `npm run test:node` | 956/956 |
| `python3 -m unittest discover -s tests` | 563 test OK (13 skip) |
| `(cd worker && npm test)` | 202/202 |
| Playwright `ja-locale`, `zh-locale`, `beta-tools` (gồm Gợi ý đội và test ja mới), `doi-chuan-roster-badges` | 109/109 (config tạm cổng 4194, không commit) |

## So output với `origin/feat/ja-locale`

So build của `origin/feat/ja-locale` (dựng trước khi sửa) với build sau khi sửa, sau khi thay bốn hash pin (generation Recommended, manifest, generation và sha của website-display):

- Trang vi: 0 HTML đổi. Trang zh: 0 HTML đổi.
- Trang ja: 246 HTML đổi, và chỉ đổi `lang` của dòng 原名: 224 chỗ `zh-Hant` → `zh`, 22 chỗ `zh-Hant` → `zh-Hans` (ví dụ `/ja/tra-cuu/quan-su/bach-ma-thay-chu/`). Không có khác biệt nào khác.
- Không phải HTML: đổi các file JS đã sửa, thêm `js/han-script.js`, và đổi `data/website-display.json`, `data/recommended/current.json` cùng thư mục generation (do pin).

## Ghi chú ngoài phạm vi

- Soi đội trên trang ja gặp cùng vấn đề trùng tên với M1. `createEntityIndex` thấy 金城湯池 trỏ về hai ID nên đánh dấu là mơ hồ, rồi `matchDict` (chỉ so `chinese`) chọn "chắc" `tactic:kim-thanh-thang-tri`. Trên client Nhật, 金城湯池 là `tactic:co-nhuoc-kim-thang`. 湯池鉄城 thì vẫn khớp đúng. Chưa sửa vì nằm ngoài danh sách phát hiện; theo dõi ở issue #138.
- Bảng phân loại giản/phồn coi 秘 là chữ giản thể (dạng phồn của OpenCC là 祕), nên 金丹秘術 bị xem là lẫn hai lối viết và gắn `zh`. Đây là cách chọn không đoán, đúng như yêu cầu.

## Câu hỏi còn mở

- Không có.
