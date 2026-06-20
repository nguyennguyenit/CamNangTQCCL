---
phase: 2
title: Team-Intro Parser (3 files)
status: completed
effort: ''
---

# Phase 2: Team-Intro Parser (3 files)

## Overview
1 parser `parse_team_intro` dùng chung cho 3 file CÙNG schema (`Team giới thiệu(mới).html` = 50, `Team Đô Úy.html` = 12, `Meta mỗi phe (cũ).html` = 110). Output = list team thô (chưa normalize alias/variant). Tổng **172 team**.

## Requirements
- Functional: trên grid đã bỏ gutter, **team mới = dòng có cột Type (col0) rowspan=3** (đồng nhất 50/12/110 — verified); dòng mở = 8 cột (`Type|Tướng|CP1|CP2|BT1|BT2|BT3|Thêm`), 2 dòng tướng nối = 6 cột (`Tướng|CP1|CP2|BT1|BT2|BT3`, không Type/Thêm). Loại dòng header + dòng intro.
- Functional: parser nhận `source` tag để gán (`team-intro`/`do-uy`/`moi-phe`); `Meta mỗi phe (cũ)` set `status_hint="out-meta"`.
- Mỗi team thô: `{source, rawType, heroesRaw[], notesRaw}`; hero thô `{nameRaw, cp1Raw, cp2Raw, booksRaw[]}`. Counter (cột Thêm) giữ NGUYÊN chuỗi raw — split ở P3.
- Non-functional: stdlib unittest; parser thuần (input = grid hoặc html_path), không side-effect.

## Architecture
Segmenter: duyệt grid, mỗi dòng có Type-cell rowspan=3 (dùng metadata span từ `grid_extractor` — cần `Cell` giữ `rowspan`) mở team; 2 dòng kế = tướng. Map cột theo vị trí cố định (xác nhận từ header). Vì `grid_extractor` fill-down, dòng tướng nối vẫn rộng 8 sau fill — phân biệt mở/nối bằng **rowspan gốc của Type-cell**, KHÔNG bằng đếm nonempty (audit finding I).

## Related Code Files
- Create: `build/parse_team_intro.py`
- Create: `tests/test_parse_team_intro.py`, `tests/fixtures/team_intro_sample.html`
- Depends: Phase 1 `grid_extractor` (Cell phải mang `rowspan`)

## Implementation Steps (TDD)
1. **RED**: fixture cắt THẬT 2-3 team từ `Team giới thiệu(mới)` — gồm 1 team có CP "A/B/C", 1 team có binh thư tiền tố `Tinh·`, counter dính `...ThươngTránh:...`. Cắt NGUYÊN block 3-dòng/team, đóng mọi rowspan trong phạm vi (audit finding G) → verify grid rectangular trước assert.
2. **RED**: test phân tách đúng số team, hero gắn đúng team, notesRaw giữ nguyên chuỗi counter dính, tướng mốc đúng (vd team 1 = SP Tuân Úc + Trương Liêu + Vương Nguyên Cơ).
3. **GREEN**: viết `parse_team_intro`.
4. **REFACTOR + count thật**: chạy trên 3 file đầy đủ; assert == 50 / 12 / 110. Nếu lệch → in dòng nghi vấn (Type rowspan ≠ 3) thay vì im lặng.

## Success Criteria
- [ ] `parse_team_intro` trên 3 file thật → đúng **50 / 12 / 110** (tổng 172).
- [ ] Unit test PASS với fixture có CP `/`, binh thư `Tinh·`, counter dính chữ.
- [ ] Hero không tràn segment; `source` + `status_hint` gán đúng (moi-phe = out-meta).

## Risk Assessment
- Lệch cột do rowspan (R1) — chặn ở P1; nếu count ≠ kỳ vọng, dừng & soi grid.
- Segmenter theo nonempty count dễ vỡ → BẮT BUỘC theo rowspan Type-cell (audit I).
- Fixture cắt thật phải đóng rowspan trong phạm vi, nếu không grid lệch (audit G).
