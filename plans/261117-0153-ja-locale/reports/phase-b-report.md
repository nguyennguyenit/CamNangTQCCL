# Báo cáo phase B: dữ liệu tên Nhật và bản dịch mô tả cho Tra cứu

Ngày 2026-11-17. Branch `feat/ja-locale-b-data` (từ `feat/ja-locale`, đã gộp fast-forward commit `e1ebd68` chứa bảng tên quan sát).

## Kết quả

- `python3 -m pipeline.build_lookup_ja --check` xanh; `python3 -m unittest discover -s tests` xanh (528 test, 13 bỏ qua có sẵn từ trước).
- `data/lookup-ja.json`: 1.265 mục, mọi mục của bảy nhóm đều có `name`, `nameStatus`, `nameOriginal`. Tên `verified` 455, `derived` 810.
- 1.516 chuỗi Trung khác nhau đã dịch hết (0 chuỗi thiếu); 3.116 trường `texts`.

## Độ phủ theo nhóm

| Nhóm | Mục | Mục có bản dịch | Mục thiếu bản dịch | Trường dịch | verified | derived |
|---|---:|---:|---:|---:|---:|---:|
| Tướng | 263 | 261 | 0 (2 mục không có chữ Trung nguồn) | 1.150 | 214 | 49 |
| Chiến pháp | 422 | 422 | 0 | 690 | 210 | 212 |
| Trang bị (gồm 90 đặc kỹ) | 204 | 0 | 0 (không có chữ Trung mô tả, chỉ có tên) | 0 | 0 | 204 |
| Quân sư | 59 | 59 | 0 | 86 | 2 | 57 |
| Cải tạo binh chủng (gồm 192 lựa chọn) | 208 | 208 | 0 | 232 | 0 | 208 |
| Công trình | 41 | 41 | 0 | 890 | 0 | 41 |
| Binh thư | 68 | 68 | 0 | 68 | 29 | 39 |

"Mục thiếu" tính theo trường có chữ Trung nguồn mà chưa có bản dịch. Mục không có chữ Trung nguồn không bị tính là thiếu.

## Quyết định áp dụng từ điều phối

1. Tên Nhật khớp theo `id` từ bảng quan sát; mặt chữ chỉ là dự phòng. 665 ID có tên quan sát, 600 ID dùng tên chuyển mặt chữ (derived).
2. `verified` khi `confidence` = high; medium vẫn dùng tên quan sát nhưng `derived`; 5 dòng low (`hero:my-truc`, 4 chiến pháp) bỏ, dùng tên chuyển mặt chữ.
3. 19 dòng tiền tố 転・/拓・ nằm riêng trong `prefixedTactics`, không đè tên chiến pháp gốc. Chúng cũng có trong `data/lookup-ja.json` (chỉ `baseId`, `name`, `prefix`) để phase C đọc; đây là trường thêm so với phase-02.
4. Bảng ký tự bổ sung 眾→衆, 溯→遡, 弒→弑, 據→据; giữ nguyên 禦, 龍, 當 (cộng 聯, 挾, 填, 携 sau khi so với bảng quan sát và 常用漢字). Thêm giản thể → tự dạng Nhật (chỉ ký tự một nghĩa).
5. Biến thể tướng SP/40Y/無雙 viết liền tiền tố. Cả 36 ID biến thể đã có hàng quan sát riêng; nhánh dự phòng (tiền tố + tên tướng gốc cùng chữ Hán) có test. `hero:sp-truong-bao` (SP張寶) được khớp theo chữ Hán, không theo ID gốc, vì ID `hero:truong-bao` là 張苞.
6. `confidence` và `sourceUrl` chỉ nằm trong `pipeline/ja-name-overrides.json`, không có trong output.

Bảng quan sát đã xong khi tôi đọc bản cuối (cùng nội dung ở commit `e1ebd68`), nên không có ghi chú "đang ghi dở".

## Soát độc lập

- Tên: reviewer kiểm 108 mục trên trang Nhật (72 mục khác nghĩa), xác nhận 108, sai 0. 24 mục `client-screenshot` (19 khác nghĩa) chưa đối chiếu được bằng nguồn web. Hai điểm cần chủ repo xem: `hero:gia-cat-canh` có chữ Hán nguồn 諸葛璟 trong khi tên Nhật là 諸葛瑾 (nghi lỗi gõ trong dữ liệu nguồn, ngoài phạm vi phase B); `tactic:tinh-nhanh-tri-dong-nao` tên Nhật 精・ひらめき đúng, trang còn ghi 霊気一動.
- Dịch: mẫu 80 mục (50 quân sư/chiến pháp S, 30 mục khác): OK 69, MINOR 11, MAJOR 0; số liệu khớp 80/80. Đã sửa ngay: dị thể 攜→携, "PK名将パック"→"PK名将カードパック", 敵軍/自軍のランダム, và câu 拆刮骨療毒 (thành "交換"). Còn lại MINOR chưa sửa: 叛逃, 衝鋒, 禁療/治療禁止, 抵御/防御 dùng không thống nhất; 徴召, 半時間; cách đếm 第二次. Bảng thuật ngữ cần chốt thêm cho 叛逃, 倒戈, 急救, 衝鋒, 威圧 (震懾), 計窮, 迷い, 追撃戦法 (đều `unverified`).
- Lỗi trong chính nguồn Trung mà bản dịch giữ nguyên để bảo toàn số liệu: "73%→180%", "12%→-18%", "15%3→0%", "【待核實】".

## 10 mẫu bản dịch để người duyệt soát

1. `tactic:an-ui-quan-dan` (慰撫軍民, derived), effect: 戰鬥前 3 回合，使我軍群體（2 人）造成的兵刃傷害和謀略傷害降低 12%→24%…（治療率 63%→126%…） → 戦闘前 3 ターン、自軍群体（2 人）の与える兵刃ダメージと計略ダメージが 12%→24% 低下し…回復率 63%→126%、知力の影響を受ける。
2. `advisor:an-phuc-binh-tam`: 動員：…持續 2 小時（魯肅卸任軍師後效果立刻結束） → 動員：…2 時間持続（魯粛が軍師を退任すると効果は即座に終了）。
3. `building:bat-tran-do` cấp 3: 降低兵刃傷害+9%，降低謀略傷害+9% → 兵刃ダメージ軽減+9%、計略ダメージ軽減+9%（cấp 2 dịch "被兵刃ダメージ+6%低下", chưa thống nhất cách viết với cấp 3).
4. `book:binh-hanh-quy-dao`: 戰鬥第2回合,我軍單體與敵軍隨機單體造成傷害降低75%,持續1回合 → 戦闘第2ターン、自軍単体と敵軍のランダム単体の与ダメージを75%低下させる。1ターン持続
5. `troop-mod:dan-duong-binh`: …我軍全體統率提升 36 點…抵擋其中 36% 謀略傷害…每回合衰減 10% → …自軍全体の統率が 36 上昇…その 36% の計略ダメージを防ぐ…毎ターン 10% 減衰する
6. `tactic:phong-tro-hoa-the`: 若目標處於灼燒狀態，額外對目標造成一次謀略傷害（傷害率 114%→228%） → 対象が燃焼状態の場合、対象にさらに計略ダメージを一度与える（ダメージ率 114%→228%）
7. `tactic:ho-hau`: 友軍群體發動或受到普通攻擊時，自身有22.5%→45%機率…可疊加5次，持續2回合 → 友軍群体が通常攻撃を発動または受けた時、自身が22.5%→45%の確率で…5回まで重複可、2ターン持続
8. `hero:gia-cat-luong` usage: 必留一個，多餘將換草船借箭，其次升星 → 必ず一つ残し、余りは草船借箭に交換し、その次に星上げに使う
9. `hero:cong-ton-toan` conditions.0 (chữ Hán vốn dịch từ tiếng Việt, cờ `translatedFromVi`): …可在內政廳 › 漢室 › 漢室補佐轉為漢陣營… → …内政庁 › 漢室 › 漢室補佐で漢陣営に転換可能…
10. `tactic:thien-ha-danh-xao`: 武將委任為使臣時，高階獎勵機率提升 4.5%→9% → 武将を使臣に委任した時、高ランク報酬の確率が 4.5%→9%上昇

## Công cụ và tệp

- Sửa/tạo: `pipeline/shinjitai.py`, `pipeline/build_lookup_ja.py` (stdlib; có thêm `--import-observed`, `--export-todo`, `--ingest` ngoài `--write|--check`; nạp lô tự đổi sang tự dạng Nhật và loại mục sai số liệu), `data/ja-kanji-variants.json` (4.023 ký tự), `pipeline/ja-name-overrides.json`, `pipeline/ja-glossary.json` (56 nhóm thuật ngữ), `pipeline/ja-translations.json`, `data/lookup-ja.json`, `tests/test_ja_shinjitai.py`, `tests/test_ja_build_lookup.py`, `tests/fixtures/shinjitai-vectors.json` (73 cặp), `docs/ja-lookup-data.md`.
- Hai tệp test đặt tên `test_ja_*` (khớp mẫu sở hữu `tests/test_*ja*.py`; `test_shinjitai.py` ở phase-02 không khớp mẫu).
- Dịch: 10 subagent sonnet (38 lô × 40 mục, đầu ra theo số thứ tự để tránh chép sai hash); 2 chuỗi sai thứ tự số được dịch lại tay (ghi `model` sonnet).
- `data/ja-kanji-variants.json` dài khoảng 66 KB vì gồm giản thể; nếu phase C thấy nặng cho trình duyệt, có thể cắt theo ký tự có trong tên.

## Việc cần người quyết

- Chủ repo xác nhận các thuật ngữ `unverified` trong `pipeline/ja-glossary.json` và 24 tên từ ảnh client chưa có nguồn web.
- Phase C: đọc `prefixedTactics`, `translatedFromVi`, `notice`, và bảng khóa trong `docs/ja-lookup-data.md`.
