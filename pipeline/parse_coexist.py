"""Parser cho Team Cùng Tồn.html (đội hình cùng tồn tại — cấu trúc lồng).

Grid 10 cột (sau bỏ gutter):
[Nhóm, Tên đội con, Võ Tướng, CP1, CP2, Thêm điểm, Binh Thư1, Binh Thư2, Binh Thư3, Kỹ Năng Quân Sư]
- col0 (Nhóm): ô rowspan phủ cả nhóm "Cùng tồn".
- col1 (Tên đội con): ô rowspan phủ các tướng của 1 đội con.
- Các hàng tướng: col2 = tên tướng.

Parser best-effort robust: gom theo đội con (col1 origin), nhóm hiển thị theo col0.
Output: list đội con phẳng, mỗi đội có groupLabel + heroes.
"""

from __future__ import annotations

import re
from typing import List

from .grid_extractor import Cell, extract_grid

COL_GROUP = 0
COL_TEAM = 1
COL_HERO = 2
COL_CP1 = 3
COL_CP2 = 4
COL_STAT = 5
COL_BOOKS = (6, 7, 8)
COL_ADVISOR = 9

_COPIES_RE = re.compile(r"\d+\s*[CＣ]\s*$")  # hậu tố số bản, vd "Bắc Phạt Thương18C"
_GROUP_RE = re.compile(r"^Cùng tồn\s*\d+")  # marker nhóm "Cùng tồn N"


def _txt(row: List[Cell], idx: int) -> str:
    return row[idx].text.strip() if idx < len(row) else ""


def _clean_team_name(name: str) -> str:
    return _COPIES_RE.sub("", name).strip()


_SINGLE_LETTER_RE = re.compile(r"^[A-Z]$")


def _is_hero_row(row: List[Cell]) -> bool:
    """Hàng dữ liệu tướng = đủ rộng + có tên tướng thật ở col2 + có CP.

    Loại hàng header chữ-cái-cột (A|B|C...) và hàng tiêu đề.
    """
    if len(row) <= COL_ADVISOR:
        return False
    hero = _txt(row, COL_HERO)
    cp = _txt(row, COL_CP1)
    if not hero or not cp:
        return False
    if _SINGLE_LETTER_RE.match(hero) or _SINGLE_LETTER_RE.match(cp):
        return False
    return hero not in ("Võ Tướng", "Ghi chú", "Chiến Pháp")


def parse_coexist(html_path: str) -> List[dict]:
    grid = extract_grid(html_path)
    teams: List[dict] = []
    current = None
    group_label = "Khác"
    group_summary = None
    for row in grid:
        # Marker nhóm "Cùng tồn N" (hàng thưa, không phải hàng tướng).
        c0 = _txt(row, COL_GROUP)
        if _GROUP_RE.match(c0):
            group_label = c0
            group_summary = _txt(row, COL_TEAM) or None
            continue
        if not _is_hero_row(row):
            continue
        team_name = _clean_team_name(_txt(row, COL_TEAM))
        # Đội con mới khi tên đội (col1) là ô origin.
        is_new_team = row[COL_TEAM].origin if COL_TEAM < len(row) else True
        if is_new_team or current is None or current["teamName"] != team_name:
            current = {
                "groupLabel": group_label,
                "groupSummary": group_summary,
                "teamName": team_name,
                "heroes": [],
            }
            teams.append(current)
        books = [_txt(row, b) for b in COL_BOOKS]
        books = [b for b in books if b]
        current["heroes"].append(
            {
                "name": _txt(row, COL_HERO),
                "tactics": [t for t in (_txt(row, COL_CP1), _txt(row, COL_CP2)) if t],
                "statFocus": _txt(row, COL_STAT),
                "books": books,
                "advisorSkill": _txt(row, COL_ADVISOR),
            }
        )
    return teams


def group_coexist(teams: List[dict]) -> List[dict]:
    """Gom đội con theo groupLabel để hiển thị thành nhóm 'Cùng tồn'."""
    groups: List[dict] = []
    index = {}
    for t in teams:
        label = t["groupLabel"] or "Khác"
        if label not in index:
            index[label] = {"groupLabel": label, "summary": t.get("groupSummary"), "teams": []}
            groups.append(index[label])
        index[label]["teams"].append(
            {"teamName": t["teamName"], "heroes": t["heroes"]}
        )
    return groups


if __name__ == "__main__":
    import json
    import sys

    data = group_coexist(parse_coexist(sys.argv[1]))
    print(json.dumps(data, ensure_ascii=False, indent=2))
