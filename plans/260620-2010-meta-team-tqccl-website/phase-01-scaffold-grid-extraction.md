---
phase: 1
title: Scaffold & Grid Extraction
status: completed
effort: ''
---

# Phase 1: Scaffold & Grid Extraction

## Overview
Dựng skeleton project + module LÕI `grid_extractor.py`: chuyển HTML table (ritz/waffle) → ma trận 2D có xử lý `rowspan`/`colspan` (fill-down), nền cho 2 parser. Đây là rủi ro CHÍ MẠNG R1 nên TDD trước tiên.

## Requirements
- Functional: hàm `extract_grid(html_path, drop_gutter=True) -> list[list[Cell]]` mỗi `Cell{text, row, col}`; ô có rowspan=N fill xuống N hàng đúng cột; ô colspan mở rộng ngang. Bỏ qua hàng/ô rỗng đầu/cuối hợp lý nhưng GIỮ alignment cột.
- **Functional (từ audit)**: ritz/waffle export có **cột gutter col0** (chỉ số spreadsheet 'A'/'1'/'2'…). `drop_gutter=True` loại cột 0 SAU khi fill-down → cột dữ liệu bắt đầu từ 0. Mọi parser sau làm việc trên grid đã bỏ gutter.
- Non-functional: chỉ Python stdlib (`html.parser`); chạy `python3 -m unittest`; unicode path tên file có dấu/space OK. `grid_extractor` phục vụ CẢ 3 parser (team-intro, coexist, khaihoang).

## Architecture
`grid_extractor`: parser sự kiện thu `(text, rowspan, colspan)` mỗi `<td>`. Thuật toán dựng grid: duyệt hàng, dùng "pending spans" (dict col→(text, remaining_rows)) để chèn ô spanned vào hàng sau tại đúng vị trí cột; con trỏ cột nhảy qua cột đã bị chiếm. Trả ma trận chữ nhật (pad ô trống).

## Related Code Files
- Create: `build/grid_extractor.py`, `build/__init__.py`
- Create: `tests/__init__.py`, `tests/test_grid_extractor.py`, `tests/fixtures/grid_rowspan.html`
- Create: `.gitignore` (bỏ `.DS_Store`, `__pycache__/`, `node_modules/`)

## Implementation Steps (TDD)
1. **RED**: viết `tests/fixtures/grid_rowspan.html` = bảng nhỏ TỰ TẠO mô phỏng cấu trúc thật: 1 ô `rowspan=3` (Type) phủ 3 hàng, hàng 2-3 thiếu cell đó. Thêm 1 case `rowspan=2` lồng + 1 hàng thường.
2. **RED**: `test_grid_extractor` assert: ma trận trả về có ô Type lặp đúng ở [0][1],[1][1],[2][1]; các cột khác không lệch; số cột mỗi hàng bằng nhau.
3. **GREEN**: viết `extract_grid` thuật toán pending-spans tới khi test pass.
4. **REFACTOR**: tách `Cell` dataclass; thêm test edge: bảng rỗng, ô colspan, rowspan vượt số hàng còn lại (clamp).
5. **RED gutter**: test `drop_gutter=True` loại đúng cột 0 (fixture có cột chỉ số 'A'/'1').
6. Verify trên data THẬT (smoke, không assert giá trị): chạy `extract_grid` cả 5 file thật → in shape, không exception.

## Success Criteria
- [ ] `python3 -m unittest tests.test_grid_extractor` PASS (≥5 assertions: rowspan fill, alignment, rectangular, edge clamp, drop_gutter).
- [ ] `extract_grid` chạy 5 file HTML thật không lỗi, shape hợp lý (sau bỏ gutter).
- [ ] `.gitignore` loại `.DS_Store`/`__pycache__`/`data/` nếu chỉ commit JSON build (cân nhắc P6).

## Risk Assessment
- R1 (rowspan shift) được test trực tiếp ở đây — nếu fixture không khớp cấu trúc thật, parser sau sẽ vỡ → bước 5 smoke trên file thật bắt buộc.
- Fixture tự tạo (không copy nguyên file thật) để test nhanh & rõ ý đồ; tính đại diện được bảo chứng bằng smoke bước 5.
