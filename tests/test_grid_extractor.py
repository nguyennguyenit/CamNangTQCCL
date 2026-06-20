"""Test cho grid_extractor: rowspan fill-down, alignment, rectangular, drop_gutter."""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pipeline.grid_extractor import extract_grid_from_html, grid_texts  # noqa: E402


# Bảng mô phỏng cấu trúc THẬT: ô "Type" rowspan=3 phủ 3 hàng, hàng 2-3 thiếu ô đó.
# Cột 0 là gutter (chỉ số spreadsheet) để test drop_gutter.
ROWSPAN_HTML = """
<table>
  <tr><td>1</td><td rowspan="3">Thương</td><td>Tướng A</td><td rowspan="3">Counter X</td></tr>
  <tr><td>2</td><td>Tướng B</td></tr>
  <tr><td>3</td><td>Tướng C</td></tr>
  <tr><td>4</td><td>Kỵ</td><td>Tướng D</td><td>Counter Y</td></tr>
</table>
"""


class TestGridExtractor(unittest.TestCase):
    def test_rowspan_fill_down(self):
        grid = extract_grid_from_html(ROWSPAN_HTML, drop_gutter=True)
        texts = grid_texts(grid)
        # Sau bỏ gutter: cột 0 = Type, cột 1 = Tướng, cột 2 = Counter
        self.assertEqual(texts[0][0], "Thương")
        self.assertEqual(texts[1][0], "Thương")  # filled down
        self.assertEqual(texts[2][0], "Thương")  # filled down
        self.assertEqual(texts[3][0], "Kỵ")

    def test_hero_column_alignment(self):
        grid = extract_grid_from_html(ROWSPAN_HTML, drop_gutter=True)
        texts = grid_texts(grid)
        # Cột Tướng (index 1) canh đúng cho cả 3 hàng spanned
        self.assertEqual(texts[0][1], "Tướng A")
        self.assertEqual(texts[1][1], "Tướng B")
        self.assertEqual(texts[2][1], "Tướng C")

    def test_counter_rowspan_fill(self):
        grid = extract_grid_from_html(ROWSPAN_HTML, drop_gutter=True)
        texts = grid_texts(grid)
        # Counter (rowspan=3) fill xuống cả 3 hàng
        self.assertEqual(texts[0][2], "Counter X")
        self.assertEqual(texts[1][2], "Counter X")
        self.assertEqual(texts[2][2], "Counter X")

    def test_rectangular(self):
        grid = extract_grid_from_html(ROWSPAN_HTML, drop_gutter=True)
        widths = {len(r) for r in grid}
        self.assertEqual(len(widths), 1, "Mọi hàng phải cùng số cột")

    def test_origin_flag_marks_team_open(self):
        # Ô Type origin chỉ True ở hàng khai báo, False ở hàng filled.
        grid = extract_grid_from_html(ROWSPAN_HTML, drop_gutter=True)
        self.assertTrue(grid[0][0].origin)
        self.assertEqual(grid[0][0].rowspan, 3)
        self.assertFalse(grid[1][0].origin)
        self.assertFalse(grid[2][0].origin)
        self.assertTrue(grid[3][0].origin)  # team mới (Kỵ)

    def test_drop_gutter_false_keeps_col0(self):
        grid = extract_grid_from_html(ROWSPAN_HTML, drop_gutter=False)
        self.assertEqual(grid[0][0].text, "1")  # gutter giữ nguyên

    def test_empty_table(self):
        grid = extract_grid_from_html("<table></table>")
        self.assertEqual(grid, [])

    def test_colspan_expands(self):
        html = '<table><tr><td>a</td><td colspan="2">wide</td></tr><tr><td>x</td><td>y</td><td>z</td></tr></table>'
        grid = extract_grid_from_html(html, drop_gutter=False)
        texts = grid_texts(grid)
        self.assertEqual(texts[0], ["a", "wide", "wide"])
        self.assertEqual(texts[1], ["x", "y", "z"])


if __name__ == "__main__":
    unittest.main()
