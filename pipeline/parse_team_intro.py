"""Parser cho 3 file CÙNG schema "team-intro":
Team giới thiệu(mới) / Team Đô Úy / Meta mỗi phe (cũ).

Trên grid đã tái dựng (bỏ gutter), mỗi team mở bằng 1 hàng có cột Type (col0)
là ô origin rowspan=3. Layout 8 cột: [Type, Tướng, CP1, CP2, BT1, BT2, BT3, Thêm].
Output = list team thô (chưa normalize alias/variant) cho pipeline normalize.
"""

from __future__ import annotations

from typing import List, Optional

from .grid_extractor import Cell, extract_grid

# Vị trí cột cố định (sau khi bỏ gutter) — đã verify trên cả 3 file thật.
COL_TYPE = 0
COL_HERO = 1
COL_CP1 = 2
COL_CP2 = 3
COL_BOOKS = (4, 5, 6)
COL_NOTES = 7

EXPECTED_COUNTS = {
    "team-intro": 50,   # Team giới thiệu(mới).html
    "do-uy": 12,        # Team Đô Úy.html
    "moi-phe": 110,     # Meta mỗi phe (cũ).html
}


def _cell(row: List[Cell], idx: int) -> str:
    return row[idx].text.strip() if idx < len(row) else ""


# Phe (whitelist) — file "Meta mỗi phe" có hàng banner full-width "Ngụy"/"Thục"/...
_FACTIONS = ("Ngụy", "Thục", "Ngô", "Quần")


def _is_team_open(row: List[Cell]) -> bool:
    """Hàng mở team = cột Type là ô origin có rowspan>=2 (thực tế =3)."""
    if not row:
        return False
    c = row[COL_TYPE]
    return c.origin and c.rowspan >= 2 and bool(c.text.strip())


def _banner_faction(row: List[Cell]) -> Optional[str]:
    """Trả phe nếu hàng là banner full-width (mọi ô non-empty đều cùng 1 phe)."""
    cells = [c.text.strip() for c in row if c.text.strip()]
    if cells and all(c in _FACTIONS for c in cells):
        return cells[0]
    return None


def parse_team_intro_grid(
    grid: List[List[Cell]], source: str, status_hint: Optional[str] = None
) -> List[dict]:
    teams: List[dict] = []
    n = len(grid)
    active_faction = None
    for i, row in enumerate(grid):
        banner = _banner_faction(row)
        if banner:
            active_faction = banner
            continue
        if not _is_team_open(row):
            continue
        span = row[COL_TYPE].rowspan
        heroes_raw = []
        for r in range(i, min(i + span, n)):
            hrow = grid[r]
            name = _cell(hrow, COL_HERO)
            if not name:
                continue
            books = [_cell(hrow, b) for b in COL_BOOKS]
            books = [b for b in books if b]
            heroes_raw.append(
                {
                    "nameRaw": name,
                    "cp1Raw": _cell(hrow, COL_CP1),
                    "cp2Raw": _cell(hrow, COL_CP2),
                    "booksRaw": books,
                }
            )
        teams.append(
            {
                "source": source,
                "rawType": _cell(row, COL_TYPE),
                "notesRaw": _cell(row, COL_NOTES),
                "statusHint": status_hint,
                "bannerFaction": active_faction,
                "heroesRaw": heroes_raw,
            }
        )
    return teams


def parse_team_intro(html_path: str, source: str, status_hint: Optional[str] = None) -> List[dict]:
    grid = extract_grid(html_path)
    return parse_team_intro_grid(grid, source, status_hint)
