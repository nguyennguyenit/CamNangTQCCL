# Báo cáo sửa phát hiện review PR #133 (bản `/ja/`)

Branch `feat/ja-locale-review-fix` (từ `origin/feat/ja-locale` @ `5de2c944`), ngày 2026-11-18. Không merge, không deploy.

## Kết quả

| Phát hiện | Trạng thái | Commit |
|---|---|---|
| M1: quét kho `/ja/goi-y-doi-tu-kho/` ra tên rác | Đã sửa | `b7da302d`, e2e `e6c5d374` |
| M2: pipeline dịch Nhật chặn promote Tra cứu | Đã sửa | `ee030724` |
| L1: lớp ja lỗi thì tên lùi về tên Việt | Đã sửa | `4f3d1e61` |
| L2: 原名 gắn sai `lang` | Đã sửa; vòng 2 chuyển sang tính lúc build | `ed8433c4`, `b7e4d377` |
| #138: Soi đội bản ja khớp nhầm 金城湯池 | Đã sửa ở vòng 2 | `6122bd58` (`Fixes #138`), `35c57712` |
| L3 (issue #130), L4 (issue #136) | Không đụng theo yêu cầu | |

Commit ghim localization riêng, nằm cuối branch. Commit ghim của vòng 1 (`98bd54e0`) đã bị bỏ bằng `git revert` (`d9c0cb7a`) thay vì viết lại lịch sử, vì branch đã push và lệnh reset bị chặn trong phiên này.

## M1: đọc ảnh kho khớp tên Nhật

- `js/app.js`: lớp `lookup-ja` giờ nạp cho cả hai công cụ đọc ảnh (`TOOL_SECTIONS`: Soi đội, Gợi ý đội), chỉ khi trang có pin `#lookup-ja-pin` (trang ja). Lỗi nạp thì `jaEntries = null`.
- `js/roster-recommend-ui.js`: nhận `jaEntries`, chỉ dùng khi `currentLocale() === "ja"`, rồi truyền vào ba hàm map ảnh.
- `js/roster-scan-map.js`: khi có `jaEntries`, tên khớp chính xác được ưu tiên, trong đó tên Nhật thắng (từ vòng 2 dùng bảng chung `createExactNameIndex`, xem mục #138). Bản Nhật gọi 固若金湯 là 金城湯池, mà 金城湯池 lại là chữ Hán nguồn của một chiến pháp khác (bản Nhật gọi chiến pháp đó là 湯池鉄城). Sau đó mới khớp mờ trên `chinese` và mọi bí danh chữ Hán (`withLocaleAliases`). Không có `jaEntries` thì vẫn chạy đúng đường cũ.
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

## L2: `lang` của 原名 (vòng 2: tính lúc build)

Vòng 1 thêm `js/han-script.js` (khoảng 19.6 KB). Mọi trang Tra cứu của cả ba bản đều tải file này, nên với vi/zh đó là hồi quy hiệu năng. Vòng 2 gỡ nó:

- `pipeline/han-script-chars.json`: hai chuỗi `simplifiedOnly` (2654 chữ) và `traditionalOnly` (3131 chữ), sinh từ OpenCC commit `fae2a0a9` (STCharacters, TSCharacters, TWVariants; Apache-2.0), chỉ khối CJK cơ bản và mở rộng A. Quy tắc sinh ghi trong `source`. Pipeline trước đó chưa có bảng này: `data/ja-kanji-variants.json` gộp cả giản lẫn phồn về tự dạng Nhật nên không phân biệt được hai lối viết. File chỉ dùng lúc build, không phát lên site.
- `pipeline/han_script.py` có `han_script_lang`; bảng bị kiểm (sai schema hoặc có ký tự thuộc cả hai lối viết thì dừng). `pipeline/build_lookup_ja.py` ghi `nameOriginalLang` (`zh-Hans`/`zh-Hant`/`zh`) cho từng mục. Đã sinh lại `data/lookup-ja.json` (927 `zh-Hant`, 316 `zh`, 22 `zh-Hans`); `build_lookup_ja --check` xanh, `report-ja-gaps --check` khớp.
- `js/lookup-data.js`: bộ kiểm lookup-ja nhận trường mới, từ chối giá trị lạ; tài liệu cũ chưa có trường vẫn hợp lệ. `js/lookup-detail.js` `lookupNameInfo` trả thêm `lang` (vắng hoặc lạ thì `zh`); `js/lookup-master.js` dùng `info.lang`.
- Đã gỡ `js/han-script.js`, `tests-js/han-script.test.mjs` và mục manifest. `docs/ja-lookup-data.md` thêm bảng đầu vào và trường mới vào schema.
- Test: `tests/test_ja_han_script.py` (mới); `tests/test_ja_build_lookup.py` (resolve_names và dữ liệu thật); `tests-js/lookup-ja-data.test.mjs` (giá trị lạ bị từ chối, tài liệu cũ vẫn hợp lệ); `lookup-ja-profile` (白马替主 → `zh-Hans`, 八陣圖 → `zh-Hant`, tên trung tính → `zh`).

## #138: Soi đội bản ja ưu tiên chủ của tên Nhật

- `js/locale-name-aliases.js`: `withLocaleAliases` gắn thêm `localeNames` cho bản ghi có tên Nhật. Hàm mới `createExactNameIndex(records, keyOf)` dựng bảng tên chính xác hai tầng: tên Nhật trước, `chinese` cùng bí danh sau. Tên Nhật thắng chữ Hán nguồn trùng của mục khác; trùng trong cùng tầng vẫn là mơ hồ (`null`).
- `createEntityIndex` (`js/analyze-map.js`; Soi đội và bộ chấm eval `worker/eval/score.ts` dùng chung) và đọc ảnh kho Gợi ý đội (`js/roster-scan-map.js`) đều dùng bảng này. Từ điển vi/zh không qua `withLocaleAliases` nên chỉ có tầng chữ Hán, như trước.
- Kết quả: trên ja, 金城湯池 → `tactic:co-nhuoc-kim-thang` (sure), 湯池鉄城 → `tactic:kim-thanh-thang-tri`; trên vi/zh, 金城湯池 vẫn → `tactic:kim-thanh-thang-tri`. So bảng tên chính xác cũ và mới trên ba từ điển thật: bản vi/zh 0 khóa khác, bản ja chỉ khác đúng khóa 金城湯池. Đây cũng là chỗ trùng duy nhất giữa tên Nhật và chữ Hán nguồn của mục khác trong dữ liệu hiện tại.
- Test: `tests-js/locale-name-aliases.test.mjs` (dữ liệu thật ja và vi/zh, cùng ngữ nghĩa hai tầng); `worker/test/eval-score.test.ts` (chỉ mục ja và chỉ mục thường). Fixture eval ja vẫn chấm 100%.
- Vì `js/analyze-map.js` giờ import `js/locale-name-aliases.js` (`js/roster-scan-map.js` đã import từ vòng 1), module này thuộc bao đóng nguồn Worker MCP. Commit `fae71f90` thêm nó vào `mcp-worker/workflow-source-manifest.json`, test bao đóng nguồn và `push.paths` của `mcp-release.yml`, rồi sinh lại `workflow-build`. Vòng 1 đã thiếu bước này.

## Ghim localization

Vòng 2 ghim lại 9 hash nguồn đã đổi so với `5de2c944`: `js/analyze-map.js`, `js/app.js`, `js/lookup-data.js`, `js/lookup-detail.js`, `js/lookup-master.js`, `js/roster-recommend-ui.js`, `js/roster-scan-map.js`, `js/website-display.js`, `src/lib/root-static-artifacts.ts`. Chạy theo chuỗi trong `phase-08-integration-review.md`:

- `inventory` ra digest `c6689383…` với 68173 location, trùng `baseline.notes`, nên không phải sửa notes.
- Chuỗi candidate → check → publish → check public → prune chạy qua: 6409/6409 obligation đã dịch. Generation Recommended mới là `c777fe17…`; prune xóa `86673de2…`.
- `team_route_handles --rebind` giữ 1681 handle, không thêm, không bỏ. `--check` và `lookup_route_handles --check` đều ok.

## Kiểm thử

Vòng 2, trên cây có pin:

| Lệnh | Kết quả |
|---|---|
| `npm run check` | 0 lỗi |
| `npm run build`, `npm run verify` | ok (zh-gaps và ja-gaps khớp) |
| `npm run test:dist` | ok |
| `npm run test:node` | 957/957 |
| `python3 -m unittest discover -s tests` | 567 test OK (13 skip) |
| `(cd worker && npm test && npm run typecheck)` | 203/203, typecheck sạch |
| `python3 -m pipeline.build_lookup_ja --check` | khớp (1265 mục) |
| `mcp-worker`: `check:workflow-build`, `check:knowledge-bundle` | ok |
| `mcp-worker`: `npm run check:repository` | Bước mcp `check`, root build/dist/verify và **toàn bộ Playwright e2e 728/728** (gồm `ja-locale`, `zh-locale`, `beta-tools`, `doi-chuan-roster-badges`) đều qua. Bước `root-js` vướng 1 test đo thời gian 20 ms (`website-display.test.mjs`, "requests every listed source…") khi máy đang chạy cùng bộ Python; chạy riêng 3 lần đều qua, `npm run test:node` chạy lại 957/957. Bước cuối `deploy:dry-run` chạy riêng không qua được vì thiếu thư mục sinh `mcp-worker/.worker-assets`, lỗi môi trường, không liên quan thay đổi này. |

## So output với `origin/feat/ja-locale`

So build của `origin/feat/ja-locale` (dựng trước khi sửa) với build vòng 2, sau khi thay năm hash pin (generation Recommended, manifest, generation và sha của website-display, pin `lookup-ja.json` của trang ja):

- Trang vi: 0 HTML đổi. Trang zh: 0 HTML đổi.
- Trang ja: 246 HTML đổi, và chỉ đổi `lang` của dòng 原名: 224 chỗ `zh-Hant` → `zh`, 22 chỗ `zh-Hant` → `zh-Hans` (ví dụ `/ja/tra-cuu/quan-su/bach-ma-thay-chu/`). Không có khác biệt nào khác.
- `han-script` không còn: không có `js/han-script.js` trong output, và không file HTML/JS nào nhắc tới nó. Trang Tra cứu vi/zh không còn tải nó.
- Không phải HTML: đổi các file JS đã sửa (`analyze-map`, `app`, `locale-name-aliases`, `lookup-data`, `lookup-detail`, `lookup-master`, `match-dict`, `roster-recommend-ui`, `roster-scan-map`, `website-display`), cùng `data/lookup-ja.json` (thêm `nameOriginalLang`), `data/website-display.json`, `data/recommended/current.json` và thư mục generation (do pin).

## Ghi chú

- Bảng phân loại giản/phồn coi 秘 là chữ giản thể (dạng phồn của OpenCC là 祕), nên 金丹秘術 bị xem là lẫn hai lối viết và gắn `zh`. Đây là cách chọn không đoán, đúng như yêu cầu.

## Câu hỏi còn mở

- Không có.
