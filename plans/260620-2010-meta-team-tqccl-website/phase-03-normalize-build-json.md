---
phase: 3
title: Coexist + Khaihoang Parsers & Normalize
status: completed
effort: ''
---

# Phase 3: Coexist + Khaihoang Parsers & Normalize

## Overview
2 parser phụ (`parse_coexist`, `parse_khaihoang`) cho 2 section riêng + module `normalize` chuẩn hóa team-intro thô → model cuối. Chuẩn bị mọi dữ liệu cho build JSON ở P4.

## Requirements

### parse_khaihoang (đơn giản nhất)
- Model: `Mine { name: "Mỏ 4".."Mỏ 8", enemies: [ {hero, unitType} ] }` (8 đội thủ/mỏ). Loại dòng ghi chú/link.
- Tách `hero(unitType)`: regex `^(.+?)\((Kỵ|Cung|Thương|Khiên)\)$`.

### parse_coexist (phức tạp — nhóm lồng)
- Model: `CoexistGroup { name: "Cùng tồn N", summary, teams: [ Team-like { teamName, heroes:[{name, tactics[2], statFocus, books[3], advisorSkill}] } ] }`.
- Cột thật: `Tên đội | Võ Tướng | Chiến Pháp | Thêm điểm | Binh Thư×3 | Kỹ Năng Quân Sư`. `Thêm điểm`=statFocus (Võ Lực/Trí Lực/Thống Soái), `Kỹ Năng Quân Sư`=advisorSkill.
- Phân tách nhóm "Cùng tồn N" + team con trong nhóm; nhận biết cột header riêng của file này. Đếm thực tế → log (chưa có số verified, parser phải tự robust + assert > 0).

### normalize (cho Team PK)
- `apply_alias(name)`: tra `aliases.json` exact map sau strip.
- `split_variants(cell)`: `"A/B/C"` → `{name:"A", alternatives:["B","C"]}`; bóc tiền tố `Tinh·`/`Thác·` khỏi binh thư.
- `parse_hero(nameRaw)`: `baseName`, `variant` (trong ngoặc), cờ `isSP`/`isCO`, `note`.
- `split_counters(notesRaw)`: **tách `Có …-★+` (rating điều kiện) ra `notes` TRƯỚC** (audit D), rồi regex `(Chạm|Tránh)\s*:` chia chuỗi dính → `{good[],avoid[]}` (tách tiếp `,`). Chuỗi dư → `notes`.
- `classify(rawType)`: `unitType[]` (tách `Kỵ/Cung/Thương/Khiên`), `stars` (parse ★ trong rawType, ☆=.5, không có→null), `faction` (**whitelist {Ngô,Ngụy,Thục,Quần}**, else null — audit E), `status` (hint out-meta giữ; Youtuber/T?→youtuber-untested; ghi chú out-meta→situational; else meta).
- Deterministic: chạy 2 lần ra kết quả giống nhau.

## Related Code Files
- Create: `build/parse_coexist.py`, `build/parse_khaihoang.py`, `build/normalize.py`, `build/aliases.json`, `build/suggest_aliases.py`
- Create: `tests/test_parse_coexist.py`, `tests/test_parse_khaihoang.py`, `tests/test_normalize.py`
- Depends: Phase 1 (grid), Phase 2 (team-intro thô)

## Implementation Steps (TDD)
1. **RED khaihoang**: fixture 1 mỏ → assert 8 enemy tách đúng hero+unitType. **GREEN**.
2. **RED coexist**: fixture 1 nhóm "Cùng tồn" + 1 team con → assert nhóm/team/hero + statFocus + advisorSkill. **GREEN** (robust với cột thừa).
3. **RED normalize** mỗi hàm: `split_variants("Uy Mưu/Vạn Quân/Thừa Địch")`→name+2alt; `parse_hero("SP Mã Siêu")`→baseName="Mã Siêu",isSP; `parse_hero("Hứa Du (Thương S)")`→variant="Thương S"; `split_counters("...Bắc Phạt ThươngTránh:Team CungCó Gian Hùng-★★★★★")`→good có "Bắc Phạt Thương", avoid có "Team Cung", notes có rating điều kiện; `classify("Kỵ/Cung(★★★★☆)")`→unitType=["Kỵ","Cung"],stars=4.5,faction=null; `classify("Thương")`→stars=null. **GREEN**.
4. Chạy `suggest_aliases.py` trên data 3 file thật → review cluster → điền `aliases.json` (≥7 cặp: Lăm/Lăng Thống, Thịnh Khí Linh/Lăng Địch, Tạm/Tam Lánh Sóng Gió, Phong Trợ Hỏa/Phơng Trợ Họa Thế, Giả Hủ/Hư, Rèn Luyện/Luyền, Khép Hờ/Hở, Nhạn Hình/Hành Trận, Đổng Trác/Trách).
5. **RED test giảm-distinct**: sau alias, distinct chiến pháp GIẢM ≥ số cặp khai. **GREEN**.

## Success Criteria
- [ ] `test_parse_khaihoang` + `test_parse_coexist` + `test_normalize` PASS.
- [ ] `parse_khaihoang` → 5 mỏ × 8 đội; `parse_coexist` → nhóm/team > 0, không exception.
- [ ] `split_counters` tách đúng rating-điều-kiện ra notes (không nuốt vào avoid).
- [ ] `classify` faction chỉ ra giá trị whitelist; `aliases.json` ≥7 cặp; distinct giảm sau normalize.

## Risk Assessment
- Coexist schema phức tạp/không đồng nhất → parser phải robust, không hardcode số team con; nếu cấu trúc lạ → log + bỏ qua dòng, không crash.
- Fuzzy auto-gộp sai tên thật → suggest chỉ gợi ý, map thủ công cứng.
- Counter biến thể `Chạm`/`Chạm:`/`Chạm :` → regex linh hoạt + test ca dính.
