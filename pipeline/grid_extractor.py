"""Tái dựng bảng HTML (Google Sheets "ritz/waffle" export) thành ma trận 2D.

Xử lý rowspan/colspan bằng cách fill-down/fill-right để mọi parser phía sau
làm việc trên grid hình chữ nhật đã canh cột đúng. Đây là module LÕI dùng chung
cho cả 3 parser (team-intro, coexist, khaihoang).

Chỉ dùng Python stdlib (html.parser).
"""

from __future__ import annotations

from dataclasses import dataclass
from html.parser import HTMLParser
from typing import List, Optional


@dataclass
class Cell:
    """Một ô trong grid đã tái dựng.

    text:    nội dung text đã strip.
    rowspan: span dọc GỐC (chỉ có ý nghĩa tại ô origin).
    colspan: span ngang GỐC.
    origin:  True nếu đây là ô được khai báo; False nếu được fill từ span phía trên/trái.
    """

    text: str
    rowspan: int = 1
    colspan: int = 1
    origin: bool = True


class _RawTableParser(HTMLParser):
    """Thu thập các hàng <tr> -> danh sách ô thô (text, rowspan, colspan)."""

    def __init__(self) -> None:
        super().__init__()
        self.rows: List[List[tuple]] = []
        self._cur: Optional[List[tuple]] = None
        self._in_td = False
        self._buf = ""
        self._rowspan = 1
        self._colspan = 1

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self._cur = []
        elif tag in ("td", "th") and self._cur is not None:
            self._in_td = True
            self._buf = ""
            self._rowspan = 1
            self._colspan = 1
            for key, val in attrs:
                if key == "rowspan":
                    self._rowspan = _safe_int(val, 1)
                elif key == "colspan":
                    self._colspan = _safe_int(val, 1)

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self._in_td and self._cur is not None:
            self._cur.append((self._buf.strip(), self._rowspan, self._colspan))
            self._in_td = False
        elif tag == "tr" and self._cur is not None:
            self.rows.append(self._cur)
            self._cur = None

    def handle_data(self, data):
        if self._in_td:
            self._buf += data


def _safe_int(value: str, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def build_grid(raw_rows: List[List[tuple]]) -> List[List[Cell]]:
    """Tái dựng ma trận chữ nhật từ các hàng ô thô, áp rowspan + colspan.

    `pending` giữ các ô đang span dọc: cột -> (Cell-fill, số hàng còn lại).
    """
    grid: List[List[Cell]] = []
    # cột -> [cell_to_fill, remaining_rows]
    pending: dict = {}

    for raw in raw_rows:
        row: List[Cell] = []
        col = 0
        src_idx = 0
        while True:
            # Ô đang span dọc TỪ HÀNG TRƯỚC phủ đúng cột này -> fill.
            if col in pending and pending[col][1] > 0:
                fill_cell, rem = pending[col]
                row.append(Cell(fill_cell.text, fill_cell.rowspan, 1, origin=False))
                pending[col] = [fill_cell, rem - 1]
                col += 1
                continue
            if src_idx < len(raw):
                text, rspan, cspan = raw[src_idx]
                src_idx += 1
                origin_cell = Cell(text, rspan, cspan, origin=True)
                row.append(origin_cell)
                # rowspan: đăng ký fill cho các HÀNG SAU tại cột này (không phải hàng hiện tại)
                if rspan > 1:
                    pending[col] = [origin_cell, rspan - 1]
                col += 1
                # colspan: nhân bản ngang trong cùng hàng
                for _ in range(cspan - 1):
                    row.append(Cell(text, rspan, 1, origin=False))
                    if rspan > 1:
                        pending[col] = [origin_cell, rspan - 1]
                    col += 1
            else:
                # Hết ô thô. Nếu còn span từ hàng trước ở cột BÊN PHẢI vị trí hiện tại,
                # chèn placeholder để tới đó; nếu không, kết thúc hàng.
                if any(k > col and rem > 0 for k, (_, rem) in pending.items()):
                    row.append(Cell("", 1, 1, origin=True))
                    col += 1
                else:
                    break
        grid.append(row)

    return _rectangularize(grid)


def _rectangularize(grid: List[List[Cell]]) -> List[List[Cell]]:
    """Pad mọi hàng về cùng số cột bằng ô trống."""
    if not grid:
        return grid
    width = max(len(r) for r in grid)
    for r in grid:
        while len(r) < width:
            r.append(Cell("", 1, 1, origin=True))
    return grid


def _has_gutter(grid: List[List[Cell]]) -> bool:
    """Phát hiện cột gutter (chỉ số spreadsheet) ở cột 0.

    Heuristic: cột 0 đa số là số / chữ cái đơn / rỗng, không phải nội dung thật.
    """
    if not grid:
        return False
    col0 = [r[0].text.strip() for r in grid if r]
    nonempty = [t for t in col0 if t]
    if not nonempty:
        return True
    def looks_gutter(t: str) -> bool:
        return t.isdigit() or (len(t) == 1 and t.isalpha())
    ratio = sum(1 for t in nonempty if looks_gutter(t)) / len(nonempty)
    return ratio >= 0.6


def extract_grid(html_path: str, drop_gutter: bool = True) -> List[List[Cell]]:
    """Đọc file HTML -> grid Cell đã tái dựng. Tuỳ chọn bỏ cột gutter col0."""
    with open(html_path, "r", encoding="utf-8") as fh:
        html = fh.read()
    return extract_grid_from_html(html, drop_gutter=drop_gutter)


def extract_grid_from_html(html: str, drop_gutter: bool = True) -> List[List[Cell]]:
    """Như extract_grid nhưng nhận trực tiếp chuỗi HTML (tiện cho test)."""
    parser = _RawTableParser()
    parser.feed(html)
    grid = build_grid(parser.rows)
    if drop_gutter and grid and _has_gutter(grid):
        grid = [row[1:] for row in grid]
        grid = _rectangularize(grid)
    return grid


def grid_texts(grid: List[List[Cell]]) -> List[List[str]]:
    """Tiện ích: trả ma trận text thuần (debug/smoke)."""
    return [[c.text for c in row] for row in grid]
