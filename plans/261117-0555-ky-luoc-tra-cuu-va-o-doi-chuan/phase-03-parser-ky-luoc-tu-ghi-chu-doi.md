---
phase: 3
title: "Tính kỳ lược đội ở đường publish"
status: pending
priority: P1
effort: "1.5d"
dependencies: [1, 2]
---

# Phase 3: Tính kỳ lược đội ở đường publish

## Goal
Trong `site_localization.compile_candidate`, tính projection hiển thị `qilue` cho từng đội thuộc mùa trong allowlist (`pk-s27`). Nguồn là `notesRaw`/`displayNotes`, đối chiếu với `lookup-catalog.json` của **cùng candidate**. `qilue` không bao giờ đi vào pack, nên `recommendedCorpusHash`, `normalizedSnapshotSha256` và ledger dedup không đổi.

## Context
- Đường publish thật đi theo thứ tự: `compile_candidate` (`pipeline/site_localization.py:2037`) → `hydrate_inputs` (l.2049, định nghĩa l.1510) → `_apply_recommended_translations` → `build_generation` (l.2115).
- `attach_display_notes`/`inputs_from_cache` chỉ chạy lúc capture, nên không gắn vào đó. <!-- Red-team F1 -->
- Có 4 chỗ tính corpus hash:
  - `build_recommended_reference.py:221-226`: dùng `raw_source_record`.
  - `build_recommended_reference.py:746-749`
  - `site_localization.py:1314` và `:1393` (`_corpus_bytes`)
  - `recommended_team_dedup.py:222`
- Có 2 danh sách trường dẫn xuất: `raw_source_record.display_fields` (l.50-66) và `ROW_DERIVED` (`site_localization.py:133`).
- Tiền lệ nối sang catalog cùng candidate: `catalog_bytes`/`tactic_catalog_bytes` (`site_localization.py:2123-2124`).
- Dữ liệu PK-S27 (169 cấu hình, đã quét lại):
  - A. `作戰方略：X。奇略卡（第 2→6 回合）：…`: 16 đội.
  - B. `奇謀（X）：a→…`: 22 đội.
  - C. `奇略：a、b…` không thứ tự: 17 dòng. Trong đó 4 dòng là R.
  - E. `<phương lược>：a→b→[極]c…` không có tiền tố, ví dụ `s27-han-hanshi-gong-1`, `s27-han-huangma-qiang`.
  - R. 復刻: `s27-lp-beifa-qiang`, `s27-lp-taoyuan-dun-ay`, `s27-lp-taiwei-dun-ay`, `s27-chuanzi-gong`.
  - Sửa tay: `s27-lp-zuolv-qiang` (nhãn 謀算 nhưng chuỗi là 強攻, nguồn ghi 待確認).
  - `s27-han-yuanshu-feixiong-qi`: chỉ có "奇謀武略系統", không phải chuỗi thẻ.
  - Câu thay thế như `奇略換…`, `奇略第五個改選…` không phải chuỗi chính.

## Thiết kế
- Module `pipeline/recommended_qilue.py`:
  - `compute_qilue(record, overrides, catalog)`. Thứ tự xử lý:
    1. Mùa không nằm trong `overrides.seasons` thì trả `None`.
    2. Áp `skip`, `fix`, `copyFrom` **trước** khi parse.
    3. Parse theo các dạng A, B, E (có neo), sau đó C.
    4. Bỏ tiền tố `[極]` và kiểm thẻ đó là `rare`.
    5. Map tên theo `nameZh` của catalog, rồi mới tới `noteVariantsZh` (chỉ dùng trong ngữ cảnh kỳ lược).
  - Kiểm luật game:
    - Có 3 đến 5 thẻ. Dạng có thứ tự phải liên tiếp từ hiệp 2.
    - Tối đa 1 thẻ hiếm.
    - Khi có phương lược, loại thẻ phải thuộc `cardTypes` của phương lược đó.
  - Bỏ qua: `奇謀武略系統`, các câu `奇略把…`, `奇略換…`, `奇略第…個改選…`.
- **Gate độ phủ, đếm từ phía dữ liệu:** <!-- Red-team F7 -->
  - Đội thuộc mùa allowlist mà có `奇略`/`奇謀` kèm `→`/`、`, hoặc có `nameZh`/biến thể của bất kỳ thẻ nào, thì phải ra `qilue` hoặc nằm trong `skip`. Nếu không, dừng publish.
  - Fail-closed là chủ ý: pack đã pin, recapture phải qua review, và gate chỉ áp cho mùa trong allowlist. <!-- Red-team F13 -->
- **Shape** (trên detail và index, do `build_generation` ghi):
  `qilue: {strategyId: "qilue-strategy:…"|null, cardIds: ["qilue-card:…"], ordered: bool, form: "official"|"qimou"|"bare"|"list"|"copy", copyFrom?: [configId], hideNoteBlockId?: "p-4"}`
- **Nối vào publish:**
  - `compile_candidate` đọc `lookup_root/lookup-catalog.json` (catalog vừa dựng) và `pipeline/recommended-qilue-overrides.json`, gọi `compute_qilue`, rồi truyền kết quả vào `build_generation`.
  - Descriptor thêm `qilueCatalogHash` và `qilueOverridesHash`. `input_hashes` của `compile_candidate` (l.2058-2071) có thêm file overrides. <!-- Red-team F5, F6 -->
- **Chặn `qilue` vào pack:** thêm `qilue` vào cả `display_fields` (`build_recommended_reference.py:50-66`) lẫn `ROW_DERIVED` (`site_localization.py:133`). Như vậy recapture về sau cũng không đưa `qilue` vào pack.
- Mọi `cardIds`/`strategyId` phải có trong catalog cùng candidate. Mã không có thì dừng.

## Tests Before (viết trước, phải fail)
- `tests/test_recommended_qilue.py`:
  - Mỗi dạng A, B, C, E, R có một mẫu thật lấy từ pack.
  - Tiền tố `[極]` trên thẻ không phải `rare` thì báo lỗi.
  - 十面埋伏 trong chuỗi kỳ lược ra `bo-tri-thap-dien`. 十面埋伏 trong câu nói về chiến pháp của Trình Dục thì không ra kỳ lược.
  - Tên lạ, 6 thẻ, 2 thẻ hiếm, hoặc loại thẻ không hợp phương lược thì báo lỗi.
  - Mùa `pk-s28` (`s28-0617-wei-19` "司馬懿奇謀") ra `None`.
  - `copyFrom` trỏ tới đội không tồn tại thì báo lỗi.
- `tests/test_site_localization.py`:
  - Chạy `compile_candidate` trên fixture: đội Ngũ Mưu Kỵ (`s27-official-wumou-qi`) có `qilue` đúng.
  - `recommendedCorpusHash` và `normalizedSnapshotSha256` không đổi.
  - `check --stage all` qua.
  - Gate độ phủ dừng khi bỏ một đội khỏi `skip`.
- Test toàn pack đã pin: mỗi đội PK-S27 có chữ kỳ lược nằm trong đúng một nhóm A/B/C/E/R/fix/skip. Đếm ra con số chốt sau lần rà tay, rồi ghi cứng.

## Tasks & Steps
1. Quét pack, in theo dạng, rà tay từng đội C/E/R/fix/skip, chốt `copyFrom`/`fix`/`skip` (receipt review).
2. Viết test, xác nhận chúng fail.
3. Viết `pipeline/recommended_qilue.py`.
4. Nối vào `compile_candidate` và `build_generation`, cùng descriptor và `input_hashes`. Thêm `qilue` vào `display_fields` và `ROW_DERIVED`.
5. Gate dedup: chạy `python3 -m pipeline.recommended_team_dedup --pack pipeline/localization-inputs/recommended.json --output "$SCRATCH/other.json"` rồi `cmp "$SCRATCH/other.json" pipeline/recommended-other-teams.json`. Không ghi đè ledger thật. <!-- Red-team F4 -->

## Regression gate
- `python3 -m unittest discover -s tests`
- Gate dedup bằng `cmp` ở bước 5.
- `python3 -m pipeline.site_localization check --root . --stage all`, chạy trên candidate scratch.

## Todo
- [ ] Rà tay và chốt overrides
- [ ] Test trước fail
- [ ] Module `recommended_qilue.py` kèm gate độ phủ
- [ ] Nối vào `compile_candidate`/`build_generation`, descriptor hash
- [ ] `display_fields` và `ROW_DERIVED`
- [ ] Gate dedup `cmp`
- [ ] Regression gate pass

## Success Criteria
Mọi đội PK-S27 có chữ kỳ lược đều ra `qilue` hợp lệ hoặc nằm trong `skip` có lý do. Mã nào cũng có trong catalog cùng candidate. Pack và ledger dedup không đổi byte nào.
