# Báo cáo sửa review vòng 2 và ghép `origin/main` (Kỳ lược) cho bản `/ja/`

Branch `feat/ja-locale-r3` (từ `origin/feat/ja-locale` @ `208ef4d6`), worktree `CamNangTQCCL-ja-r3`, ngày 2026-11-18. Ghép `origin/main` @ `55dea629` (14 commit, chủ yếu PR #132 Kỳ lược). Không merge vào `feat/ja-locale`, không deploy.

## (A) Sửa phát hiện review vòng 2 (TDD)

| Phát hiện | Sửa | Commit |
|---|---|---|
| Medium: Soi đội bản ja không khớp mờ theo tên Nhật | `withLocaleAliases` đánh dấu mảng trả về (`hasLocaleAliases`, WeakSet); `createEntityIndex` ghi cờ `cjkAliases` và `classifyName` truyền nó cho `matchDict` lẫn `searchDict` (thêm tùy chọn `cjkAliases`, mặc định tắt). Từ điển vi/zh không qua `withLocaleAliases` nên giữ bộ khớp cũ. | `a57dfba6` |
| Low: tên Nhật trùng chữ Hán nguồn của mục khác | `tests/test_ja_name_collisions.py`: liệt kê mọi trùng giữa `name` của lookup-ja và `chinese`/bí danh chữ Hán của mục khác trong ba từ điển mà bộ khớp tên dùng (tướng, chiến pháp, binh thư), so với `ALLOWED` = {`tactic:co-nhuoc-kim-thang` → `tactic:kim-thanh-thang-tri`}. Trùng mới hoặc mục cho phép hết trùng đều làm test đỏ. Trùng giữa hai nhóm khác nhau (cải tạo binh chủng và chiến pháp cùng tên) không tính vì mỗi nhóm có chỉ mục riêng. | `2007d9f8` |
| Low: `--prune-orphans` ghi file dịch trước khi build | `build_payload(..., items=)` dựng trong bộ nhớ với bản dịch đã dọn; chỉ khi dựng xong mới ghi `pipeline/ja-translations.json` và `data/lookup-ja.json`. Test: bản dịch sai số liệu, override trỏ ID không còn → exit 1, file dịch giữ nguyên byte, không có đầu ra. | `4359e57c` |
| Low: override trỏ ID không còn trong generation | Thông báo của `validate_overrides` nêu `names["<id>"]` cần gỡ (hoặc sửa bảng quan sát rồi `--import-observed`); `prefixedTactics` có `baseId` không còn có thông báo riêng. `docs/ja-lookup-data.md` thêm mục "Khi ID trong `pipeline/ja-name-overrides.json` không còn trong generation Tra cứu". | `4359e57c` |

Kết quả A1 (dữ liệu thật): 国の柱〇, 霊機一〇, 陥陣〇 trên ja → "không chắc" với đúng chiến pháp đứng đầu ứng viên, như bản zh với chữ Hán nguồn lệch một ký tự (靈機一〇); trước khi sửa 国の柱〇 và 陥陣〇 là `unknown`. Tên bốn chữ lệch một ký tự có điểm 0,75, dưới mức `medium` (0,85) của `matchDict`, nên không thành "chắc" ở bất kỳ bản nào; đây là ngưỡng sẵn có, không đổi. Bản vi/zh: kết quả không đổi (test so trực tiếp). Fixture eval ja vẫn 100% (`worker` 203/203).

## (B) Ghép `origin/main`

### Xung đột và cách giải

| File | Cách giải |
|---|---|
| `js/lookup-master.js` | Giữ import/locale helper của ja (`contentLocaleIsVietnamese`, `sourceTextOf`, `nameOriginalTrees`…) và thêm `qilueLabel`/`QILUE_TYPE_ORDER`; mọi nhãn bảng (nhóm, panel, lọc, đuôi tóm tắt, đơn vị) có biến thể ja; facet `type`/`rarity` của main giữ nguyên. |
| `js/recommended-reference-render.js` | Giữ cả `hiddenBlockId` (main) lẫn ẩn văn xuôi chữ Trung trên ja; section Kỳ lược sau Đội hình với tiêu đề ba biến thể. |
| `src/lib/lookup-item-pages.ts`, `src/lib/lookup-pages.ts` | Giữ `describeJa` và chữ ký `describe(group, item, locale, corpus)` của main; `describeQilue` thêm nhánh ja (chỉ nhãn đóng và tên phương lược, không trích bản dịch máy). Mô tả nhóm Kỳ lược có `ja`. |
| `src/components/pages/LookupHubPage.astro` | Chuỗi của main (thêm kỳ lược) cộng biến thể ja có 奇略. |
| `pipeline/build_recommended_reference.py`, `pipeline/site_localization.py` | Nhận cả `jp_tiers_bytes` lẫn `qilue_catalog_bytes`/`qilue_overrides_bytes`; descriptor ghi `jpTiersHash` và hai hash kỳ lược; obligation của main giữ và cập nhật biểu thức theo mã ba biến thể. |
| `tests-js/astro-dist-contract.test.mjs`, `tests/test_site_localization.py` | `SITEMAP_ROUTES_PER_LOCALE` 2869 → 2915; 983 → 1028 mục; giữ cả kiểm tier JP lẫn kiểm qilue. |
| `docs/project-changelog.md`, `docs/season-team-data.md` | Giữ cả hai mục. |
| File ghim/sinh: generation `src/data/recommended-reference/**`, `data/website-display.json`, `pipeline/site-localization-policy.json`, `pipeline/team-route-handles.json`, `mcp-worker/src/generated/workflow-build.ts` | Lấy bản main (policy: lấy cấu trúc main, chỉ khác hash `sourceFiles`), rồi dựng lại; không merge tay. |

### Phần mới của main trên bản ja

- **Chuỗi giao diện**: mọi `L(`/`pick(`/`text(` mới có biến thể ja; test arity mặc định xanh. Bảng `QILUE_LABELS` tách thành ba bảng theo `kind` để test arity đếm được. Nhãn ja: nhóm 奇略, phương lược 方略, thẻ 奇略カード, hiệp 第N ターン, loại 勇/謀/補/策/済, độ hiếm 普通/稀有, đối tượng 自軍全体/自軍単体/自軍群体/敵軍単体/敵軍全体.
- **Thuật ngữ** (`pipeline/ja-glossary.json`): 奇略 và 奇謀武略 (nguồn wiki #668), 輔→補 và 濟→済 (#665), 漢焰長明→漢焔不滅 (Shinsen Navi lịch mùa); 作戰方略→方略, 稀有, 回合→ターン, 控制狀態→制御状態 là `unverified`. Không thấy nhãn độ hiếm trong nguồn Nhật.
- **Tra cứu ja**: chi tiết thẻ/phương lược hiện tên Nhật, 原名 + nhãn trạng thái, bản dịch máy (`effect`, `description`, `buff`, `conditions.N`) có nhãn 機械翻訳; trường chưa dịch hiện dòng báo thiếu.
- **Ô Kỳ lược trang đội ja**: `qilueLookupTable(catalog, lookupJa)` mang `nameJa`; `team-ssr.ts` truyền lớp lookup-ja đã kiểm. Bản ja thiếu tên Nhật thì build dừng. Ví dụ `/ja/doi-chuan/pk-s27-tiem-long-luc-ton/`: 奇略 · 方略 謀算 · 第2ターン 背水列陣 … 第6ターン 博浪椎秦 補.
- **mcp-worker**: main không thêm file nguồn workflow mà bản ja đụng; chỉ sinh lại `WORKFLOW_BUILD_ID` (`cdfcf92d`). Test bao đóng nguồn xanh.

### Dữ liệu ja cho nhóm Kỳ lược

`build_lookup_ja` nhận `qilueStrategies`/`qilueCards` (tên `nameZh`; khóa dịch: phương lược `description`, `buff`, `conditions.N`; thẻ `effect`, `conditions.N`). `--prune-orphans --write`: 0 mục mồ côi.

Nguồn tên: chỉ wiki 貂蝉の三国志真戦 có tên (bài S27 #665, #666, #668; chép từ server thử nghiệm). Kazten 桃園結義, Chousen #670 và Shinsen Navi không có tên thẻ; không dùng Hensei Kobo. Tên được thêm vào bảng quan sát `plans/reports/ja-names-observed-261117.json` rồi dựng lại `pipeline/ja-name-overrides.json` bằng `--import-observed` (665 → 700 tên, chỉ thêm), để lần dựng sau không mất.

| | Số mục |
|---|---:|
| Tổng | 45 (5 phương lược + 40 thẻ) |
| `verified` (tên cùng chữ sau shinjitai, hoặc hiệu ứng trên trang trùng hiệu ứng chữ Trung) | 27 |
| `derived`, tên Nhật từ nguồn (`medium`, khớp bằng loại thẻ và loại trừ trong cùng loại) | 8 |
| `derived`, chuyển tự dạng: 8 thẻ loại 補 (không có tên trong nguồn) + 2 tên nguồn có dấu chép sai (疲楚容勢, 蔵節納籍; ghi `low`, không dùng) | 10 |
| Có bản dịch máy | 45 mục, 95 khóa (51 chuỗi mới, sonnet, 0 bị loại khi kiểm số liệu) |

Tên khác chữ Trung đáng chú ý: 久戰→堅牢, 襲擾→攪乱 (khớp cặp loại thẻ và hiệu ứng), 橫掃河西→河西掃討, 楚歌四起→四面楚歌, 韜晦自污→自汚忍辱, 居功至偉→偉功無双, 治延軍勢→軍勢整備 (hiệu ứng trùng). Nhóm `medium`: 追亡逐北→敗走追撃, 摧鋒陷敵→敵陣突破, 擒王破營→鋒鋩粉砕, 壯志不絕→不屈の志, 斬逆納降→逆臣討伐, 築闕長安→長安築闕, 受封增邑→封邑加増, 居儉避禍→倹約避禍.

`build_lookup_ja --check` khớp (1310 mục); `docs/ja-gaps.md` sinh lại: Kỳ lược 0/45 thiếu, trạng thái tên 27/18.

### Ghim localization

Theo chuỗi phase-08: ghim lại 10 hash nguồn (`js/analyze-map.js`, `js/lookup-data.js`, `js/lookup-detail.js`, `js/lookup-master.js`, `js/lookup-page.js`, `js/recommended-reference-render.js`, `js/unified-lookup.js`, `src/components/pages/LookupHubPage.astro`, `src/lib/lookup-item-pages.ts`, `src/lib/lookup-pages.ts`). `inventory` ra digest `2afd3ac8…` với 68205 location, trùng `baseline.notes` của main nên không sửa notes. candidate → check → publish → check public → prune: generation Recommended `556ec3a2…` (prune bỏ `54fb8fb8…` của main). `team_route_handles --rebind` giữ 1681 handle; `lookup_route_handles --write/--check`: 1028 ID, 57 luật redirect, ledger trùng main.

## Kiểm

Trên cây sau ghép, đã ghim (máy chạy song song nhiều session):

| Lệnh | Kết quả |
|---|---|
| `npm run check` | localization public ok; `astro check` 0 lỗi, 0 cảnh báo (149 file) |
| `npm run build` | 8836 trang trong 18,7 s (Astro 14,0 s) |
| `npm run verify` | ok, 11,3 s; `zh-gaps.md` và `ja-gaps.md` khớp |
| `npm run test:dist` | 70/70 |
| `npm run test:node` | 992/992 (arity ba biến thể xanh) |
| `python3 -m unittest discover -s tests` | 602 test OK (13 skip) |
| `(cd worker && npm test && npm run typecheck)` | 203/203, typecheck sạch |
| `(cd community-worker && npm test && npm run typecheck)` | 686/686, typecheck sạch |
| `python3 -m pipeline.build_lookup_ja --check` | khớp (1310 mục) |
| `mcp-worker`: `check:workflow-build`, `check:knowledge-bundle` | ok (sau khi sinh lại `workflow-build`) |
| `npm run test:e2e` | 741/741 (4,3 phút; cổng 4174/4175 trống nên dùng config gốc), gồm test ja mới cho Kỳ lược |
| `(cd mcp-worker && npm run check:repository)` | Mọi bước tới `astro-e2e` (741/741) và bộ test gốc đều qua; bước cuối `deploy:dry-run` dừng vì thiếu thư mục sinh `mcp-worker/.worker-assets` khi cây còn chưa commit. Chạy lại `deploy:dry-run` sau commit ghim, trên cây sạch, sau `npm run build:worker-assets` (kết quả trong báo cáo bàn giao). |

## So output

Baseline: build `origin/main` @ `55dea629` (worktree tạm `CamNangTQCCL-ja-r3-base`, 5891 trang). Head: build sau ghép (8836 trang, +2945 trang `/ja/`). `compare --allow-locale ja`:

- đổi 27, thêm 2 (`data/lookup-ja.json`, `data/ja-kanji-variants.json`), mất 0;
- 27 file đổi trùng đúng danh sách của phase H: 6 file dùng chung (`404.html`, `robots.txt`, `_headers`, `_redirects`, `css/styles.css`, `llms.txt`) và 21 file PK-S26 do tier JP (7 trang đội + trang mùa ở vi và zh, `llms-full.txt`, `llms/doi-chuan/pk-s26.txt`, `index.json`/`manifest.json`/một `details-s-d8a6775f….json` của generation);
- với allowlist trên: **0 file ngoài allowlist**. Không trang Kỳ lược vi/zh nào (46 trang Tra cứu × 2, 59 trang đội có ô Kỳ lược × 2) đổi byte.

## Quét `/ja/`

Script quét `<main>` và `<title>` của 2945 trang `/ja/` (bỏ phần `lang="zh-*"` và `translate="no"`), tìm chữ Việt có dấu và chữ Hán nguồn có tự dạng Nhật khác (theo `data/ja-kanji-variants.json`, trừ ký tự có trong tên Nhật của lookup-ja và 三國志):

- chữ Hán nguồn chưa đổi tự dạng: 0 trang;
- chữ Việt: 24 trang tướng, đều là "Châu" trong chữ Trung nguồn của ghi chú mùa PK-S27 (ngoại lệ đã biết, issue #130);
- `/ja/tra-cuu/ky-luoc/**`: 46 trang, 0 chữ Việt, 0 chữ Hán nguồn chưa đổi; 59 trang đội ja có ô Kỳ lược, 0 chữ Việt.

## Câu hỏi còn mở

- 8 tên `medium` (khớp bằng loại thẻ và loại trừ) và nhãn độ hiếm 普通/稀有 cần người chơi bản Nhật soát khi server chính 漢焔不滅 mở (21/11/2026); tên trên wiki là bản chép từ server thử nghiệm.
