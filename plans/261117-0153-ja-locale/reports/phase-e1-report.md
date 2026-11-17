# Phase E1: bảng khớp tier JP (Kazten S25) với Đội chuẩn PK-S26

- Ngày: 2026-11-17 (Asia/Saigon). Branch `feat/ja-locale-e1-tier` (từ `origin/feat/ja-locale` tại `3cff5ba`).
- File mới: `pipeline/recommended-jp-tiers.json`, `tests/test_recommended_jp_tiers.py`.
- Nguồn: [Kazten 都尉武将使用テンプレ編成](https://kazten.com/entry/2026/06/19/180000), カズ天, đăng 2026-06-19, ảnh cập nhật tới 2026-09-15. Mùa JP S25「時代の英雄」= VN PK-S26 Anh Hùng Mệnh Thế (`pk-s26`, `nameRaw` 英雄命世 trong `seasons.json` của generation). Ánh xạ mùa lấy theo `plans/reports/researcher-261117-0153-jp-tier-sources.md`.
- Đối chiếu với generation Recommended `30634f3f…` (130 hàng `pk-s26`: 108 Giao chiến, 22 Khai hoang).

## Kết quả

Có **2 `exact`**, **5 `heroes-only`** và **17 `none`**. 21 entry `reviewed`, 3 entry `needs-review` (雑草魂, 温翊弓, 遼喬槍). Theo `matchRules.tierAssignable`, 7 entry gán được tier (5 heroes-only + 2 exact, đều `reviewed`). Mỗi đội VN chỉ có một entry trỏ tới, nên không có xung đột tier.

| # | Tier JP | Đội (Kazten) | Tướng (chủ tướng đầu) | Mức khớp | Đội VN (`sourceConfigId`) | Review |
|---|---|---|---|---|---|---|
| 1 | T0 | 富貴騎 | SP Tuân Úc + Chu Thiệu + SP Quách Gia | exact | `yxms-027-周劭富貴騎` (Chu Thiệu Phú Quý Kỵ, SGSDeck T0.5) | reviewed |
| 2 | T0 | 富連騎 | SP Tuân Úc + Thẩm Hằng + SP Quách Gia | heroes-only | `yxms-028-沈姮富貴騎` (Thẩm Hằng Phú Quý Kỵ, SGSDeck T0.5) | reviewed |
| 3 | T0 | 法徐盾 | SP Quan Vũ + Từ Ngạn + SP Pháp Chính | none | — | reviewed |
| 4 | T0 | 法宏盾 | SP Quan Vũ + Hoàng Phủ Hoành + SP Pháp Chính | exact | `yxms-014-皇甫法關盾` (Hoàng Phủ Pháp Quan Thuẫn, SGSDeck T0.5) | reviewed |
| 5 | T0 | 二喬弓 | Hoàng Phủ Hoành + Tôn Thượng Hương + CO Đại Kiều | none | — | reviewed |
| 6 | T0 | 周馬槍 | SP Mã Siêu + Chu Thiệu + SP Hoàng Phủ Tung | none | — | reviewed |
| 7 | T0 | 太師弓 | SP Lô Thực + SP Điêu Thuyền + Tiêu Chỉ | heroes-only | `yxms-044-拒馬弓` (Cự Mã Cung, SGSDeck T0.5) | reviewed |
| 8 | T0 | 太熊弓 | SP Đổng Trác + SP Điêu Thuyền + Tiêu Chỉ | none | — | reviewed |
| 9 | T0.5 | 五謀騎 | SP Quách Gia + Tuân Du + Dương Kỳ | none | — | reviewed |
| 10 | T0.5 | 女王盾 | Tư Mã Ý + Tiêu Chỉ + Mãn Sủng | heroes-only | `yxms-024-蕭芷太尉盾` (Tiêu Chỉ Thái Úy Thuẫn, SGSDeck T0.5) | reviewed |
| 11 | T0.5 | 曹魏騎 | Hạ Hầu Đôn + Hạ Hầu Uyên + Thẩm Hằng | none | — | reviewed |
| 12 | T0.5 | 反惇盾 | Trần Dực + Hạ Hầu Đôn + Mãn Sủng | none | — | reviewed |
| 13 | T0.5 | 周蜀弓 | Gia Cát Lượng + Bàng Thống + Chu Thiệu | heroes-only | `yxms-010-周劭蜀弓` (Chu Thiệu Thục Cung, SGSDeck T0) | reviewed |
| 14 | T0.5 | 西翊弓 | Gia Cát Lượng + Bàng Thống + Trần Dực | none | — | reviewed |
| 15 | T0.5 | 雑草魂 | Khương Duy + Tiêu Chỉ + Gia Cát Lượng | none | — | needs-review |
| 16 | T0.5 | 東呉弓 | Chu Du + SP Lữ Mông + Chu Thiệu | none | — | reviewed |
| 17 | T0.5 | 都堅弓 | SP Chu Du + SP Lữ Mông + Tiêu Chỉ | none | — | reviewed |
| 18 | T0.5 | 至尊喬弓 | Tôn Quyền + CO Đại Kiều + Hoàng Phủ Hoành | none | — | reviewed |
| 19 | T0.5 | 甘太徐 | Cam Ninh + Thái Sử Từ + Từ Ngạn | none | — | reviewed |
| 20 | T0.5 | 孫熊騎 | Tôn Quyền + Chu Thái + Mã Thiền | none | — | reviewed |
| 21 | T0.5 | 妖精盾 | Chu Thiệu + Trương Giác + Tả Từ | heroes-only | `yxms-050-千機盾` (Thiên Cơ Thuẫn, SGSDeck T0.5) | reviewed |
| 22 | T0.5 | 温翊弓 | Trần Dực + Lữ Bố + Hứa Du | none | — | needs-review |
| 23 | T0.5 | 遼喬槍 | CO Đại Kiều + Trương Liêu + Hoàng Phủ Hoành | none | — | needs-review |
| 24 | T0.5 | 女堅弓 | Tiêu Chỉ + SP Điêu Thuyền + Vương Dị | none | — | reviewed |

Phần khác chiến pháp của các đội `heroes-only` ghi trong `note` của từng entry. Ví dụ, ở 富連騎 SP Quách Gia mang 勠力同心 bên Kazten nhưng 當鋒摧決 bên SGSDeck. Mọi đội khớp đều cùng chủ tướng.

## Schema

Phase-05 chưa có chỗ cho chiến pháp, trạng thái review và ba mức khớp, nên file dùng schema của brief E1, có thêm vài phần:

- `source{name, url, author, publishedAt, imagesUpdatedThrough, fetchedAt, context, assessment, seasonJa, scenarioNameRaw, seasonVn, vnSourceSeasonId, seasonMappingRef}`.
- `matchRules`: định nghĩa `exact`, `heroes-only`, `none` và điều kiện `tierAssignable`.
- `doUyHeroes`: bảng tướng Đô Úy.
- `tacticSpellingJa`: bảng chuẩn hoá cách gõ của Kazten.
- `entries[{tierJa, teamNameJa, heroesJa, heroes, tacticsJa, tactics, match{kind, recommendedTeamId}, reviewStatus, note}]`. `heroesJa`/`tacticsJa` giữ nguyên cách gõ của nguồn để truy vết. Chỉ chứa dữ kiện, không chép mô tả.

## Quyết định khớp không hiển nhiên

1. **Tướng Đô Úy không có ID trong từ điển.** `data/lookup-ja.json` và `heroes-dict.json` không có 8 tướng Đô Úy (周劭, 沈姮, 徐彦, 皇甫宏, 蕭芷, 陳翊, 馬嬋, 楊琪). Mỗi đội Kazten lại có đúng một Đô Úy. Vì vậy file dùng ID `do-uy:<tên SGSDeck>`, ví dụ `do-uy:徐彥` cho 徐彦 của JP. Mỗi ID khai trong `doUyHeroes` và được test đối chiếu với entry `translation-reviewed` của `pipeline/recommended-identity-map.json`; test cũng kiểm rằng các tên này vắng mặt trong catalog lingxi. 陳翊 Trần Dực và 陳熙 Trần Hy được giữ là hai tướng riêng.
2. **Khớp theo tên Nhật, không theo mặt chữ.** Tên Nhật quy về ID qua trường `name` của lookup-ja. Test chặn bẫy 金城湯池: tên Nhật 金城湯池 là 固若金湯, còn chiến pháp mang chữ Hán 金城湯池 có tên Nhật 湯池鉄城.
3. **Cách gõ của Kazten** được chuẩn hoá: 戮力同心 → 勠力同心, 霊気一動 → 霊機一動. Bản 精 (精魚鱗陣, 精鋒矢陣) gộp về ID gốc vì catalog không tách bản 精/拓, và SGSDeck PK-S26 cũng chỉ ghi 魚鱗陣/鋒矢陣. Bốn đội có bản 精 đều là `none`.
4. **太師弓 không khớp theo tên.** `yxms-045-太師弓` của SGSDeck là SP Lô Thực + SP Điêu Thuyền + SP Đổng Trác, khác bộ ba với Kazten. Bộ ba Kazten khớp `yxms-044-拒馬弓`; khác biệt là hai tướng đổi chỗ Nhạn Hành Trận và Nhân Lợi Chế Quyền.
5. **女王盾 là `heroes-only`.** Chỉ khác một ô của Tư Mã Ý: 神算鬼謀 so với 熯天熾地. Mức khớp dựa vào ánh xạ `derived` 神算鬼謀 → 用武通神, có lý do tin được vì đây là chiến pháp truyền thừa của Tư Mã Ý và SGSDeck cũng gán cho chính Tư Mã Ý ở hàng khác. Nếu ánh xạ sai thì đội thành `exact`, việc gán tier không đổi.
6. **Ba đội `needs-review`** có ô nguồn mâu thuẫn, xem `unreadable` trong `jp-tier-teams-261117.json`. Cả ba đều `none` dù đọc ô theo cách nào, nên hiện không ảnh hưởng việc gán tier.

## Review độc lập

Một sub-agent khác (không phải người lập bảng) tự viết script đối chiếu 24 entry với 130 hàng `pk-s26`, gồm cả Khai hoang. Kết luận: mọi mức khớp, chủ tướng và ghi chú đều đúng, không sót hàng cùng bộ ba nào. Reviewer duyệt 21 entry `reviewed` và giữ 3 entry `needs-review`. Ba gợi ý của reviewer đã được đưa vào note: lưu ý ánh xạ ở 女王盾, ghi yxms-053 (陳熙) ở 温翊弓, và liệt kê đủ hàng gần của 孫熊騎. Ánh xạ yếu nhất reviewer chỉ ra là 志操堅固 → 臨危救主 (quan sát ghi "suy luận, chưa đối chiếu hiệu ứng JP"). Ánh xạ này dùng ở 6 đội, đều là `none`.

## Test

- `tests/test_recommended_jp_tiers.py` có 15 test, viết trước dữ liệu (đỏ → xanh). Test kiểm:
  - schema;
  - mùa PK-S26 (cả `source` lẫn `seasons.json` của generation);
  - mọi ID tướng/chiến pháp có trong lookup-ja hoặc `doUyHeroes`;
  - tên Nhật quy đúng về ID đã ghi;
  - mức khớp tính lại từ generation khớp với mức đã ghi (`none` thì thật sự không có hàng cùng bộ ba);
  - `recommendedTeamId` tồn tại và thuộc `pk-s26`;
  - cùng đội mà khác tier thì phải có note;
  - ba đội nguồn không chắc phải `needs-review`.
- Đã thử đột biến: đổi mức khớp, đổi đội trỏ tới, đổi ID chiến pháp lạ, nâng `needs-review`, đổi mùa. Lần nào test cũng báo đỏ.
- `python3 -m unittest discover -s tests`: chạy 543 test, có **1 lỗi có sẵn trên `feat/ja-locale`** không do E1: `test_site_localization…test_data_stage_defers_ui_values_while_full_candidate_stays_strict` báo `worker/src/schema.ts` "reviewed source hash is stale". Khi bỏ hai file của E1 ra, test này vẫn lỗi y như vậy. Báo cáo D1 đã ghi rằng chưa ghim lại hash cho file này và việc ghim để phase H làm. Ngoài lỗi đó, mọi test khác đều xanh.

## Đề xuất cho E2

1. **Chỉ gắn tier cho đội đã có**, theo `tierAssignable` (`reviewed` và khác `none`): 7 hàng PK-S26. Với `heroes-only` nên hiện kèm nhãn kiểu "Kazten dùng chiến pháp khác" hoặc link bài nguồn, vì tier JP đánh giá cấu hình của Kazten chứ không phải cấu hình SGSDeck. Nếu chủ repo muốn chặt hơn thì chỉ chiếu `exact` (còn 2 hàng). Đây là câu hỏi mở bên dưới.
2. **Không thêm 17 đội `none` làm hàng Recommended trong E2.** Hàng Recommended là bản chiếu của SGSDeck (ledger, identity map, route handle). Thêm đội ngoài nguồn sẽ đụng ledger/generation và cần review Astra → Fable, đúng như phase-05 bước 6 (chờ Q3). Nếu muốn có các đội này, nên mở issue riêng để đưa qua pipeline candidate, ưu tiên 4 đội T0 là 法徐盾, 二喬弓, 周馬槍 và 太熊弓. Ba đội 法徐盾, 西翊弓 và 孫熊騎 chỉ khác hàng đã có một tướng Đô Úy. Trước khi làm cần xác minh 志操堅固 và ba đội `needs-review`.
3. E2 nên dừng khi `recommendedTeamId` không còn trong generation hoặc lệch mùa. Test E1 đã kiểm điều này trên generation hiện tại, nên một lần dựng lại generation làm mất ID sẽ làm test đỏ.

## Câu hỏi chưa giải

- E2 gán tier JP cho cả `heroes-only` (7 hàng) hay chỉ `exact` (2 hàng)?
- 17 đội `none`: có mở issue để thêm qua pipeline candidate (Q3) không?
- 志操堅固 → 臨危救主 cần đối chiếu hiệu ứng JP trước khi hiện ID chiến pháp công khai.
