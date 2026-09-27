"""Parser cho Khai hoang.html (PvE đánh mỏ).

File có 3 khối dữ liệu:
- Khối quân thủ mỏ: xen kẽ hàng "Mỏ N" (1 ô) và hàng 8 đội thủ quân dạng "Tên(LoạiBinh)".
  -> parse_khaihoang() trả list mỏ, mỗi mỏ có 8 đội thủ (hero + unitType).
- Khối đội hình khai hoang đề xuất: bảng "Type | Tướng | CP trước | Sau lv.20 | CP1 | CP2 | ghi chú".
  Mỗi đội = 3 hàng tướng, cột Type (col0) là ô origin rowspan phủ cả đội.
  -> parse_khaihoang_teams() trả list đội (title ghép tên tướng + heroes).
- Bảng Team Chạm Sứ bên phải: nhóm riêng, ngăn bởi hàng trống bên phải.
"""

from __future__ import annotations

import re
import unicodedata
from typing import List

from .grid_extractor import Cell, extract_grid, grid_texts

_MINE_RE = re.compile(r"^Mỏ\s*\d+", re.IGNORECASE)
_ENEMY_RE = re.compile(r"^(.+?)\((Kỵ|Cung|Thương|Khiên)\)\s*$")

# Cột khối đội hình khai hoang đề xuất (sau bỏ gutter).
TM_COL_TYPE = 0  # binh chủng trước lv.20 (ô origin = mở đội)
TM_COL_HERO = 1
TM_COL_CP_BEFORE = 2
TM_COL_TYPE_AFTER = 3
TM_COL_CP1_AFTER = 4
TM_COL_CP2_AFTER = 5
TM_COL_NOTE = 6


def _split_enemy(text: str) -> dict:
    m = _ENEMY_RE.match(text.strip())
    if m:
        return {"hero": m.group(1).strip(), "unitType": m.group(2)}
    return {"hero": text.strip(), "unitType": None}


def parse_khaihoang(html_path: str) -> List[dict]:
    rows = grid_texts(extract_grid(html_path))
    mines: List[dict] = []
    current = None
    for row in rows:
        cells = [c for c in row if c.strip()]
        if not cells:
            continue
        if len(cells) == 1 and _MINE_RE.match(cells[0]):
            current = {"name": cells[0].strip(), "enemies": []}
            mines.append(current)
            continue
        # Hàng đội thủ: nhiều ô, mỗi ô là "Tên(LoạiBinh)".
        if current is not None and len(cells) >= 4 and all("(" in c for c in cells):
            current["enemies"] = [_split_enemy(c) for c in cells]
    return mines


def _tm_txt(row: List[Cell], idx: int) -> str:
    return row[idx].text.strip() if idx < len(row) else ""


def _is_team_header(row: List[Cell]) -> bool:
    return _tm_txt(row, TM_COL_TYPE) == "Type" and _tm_txt(row, TM_COL_HERO) == "Tướng"


def _is_team_open(row: List[Cell]) -> bool:
    """Hàng mở đội = ô Type (col0) là origin với rowspan>=2 (phủ cả 3 tướng)."""
    if TM_COL_TYPE >= len(row):
        return False
    c = row[TM_COL_TYPE]
    return c.origin and c.rowspan >= 2 and bool(c.text.strip())


def parse_khaihoang_teams(html_path: str) -> List[dict]:
    """Parse khối đội hình khai hoang đề xuất (Trước/Sau lv.20)."""
    grid = extract_grid(html_path)
    teams: List[dict] = []
    current = None
    in_block = False
    for row in grid:
        if _is_team_header(row):
            in_block = True
            continue
        if not in_block:
            continue
        hero = _tm_txt(row, TM_COL_HERO)
        if not hero:
            # Hàng trống sau bảng -> kết thúc khối.
            if current is not None:
                break
            continue
        if _is_team_open(row):
            current = {
                "unitType": _tm_txt(row, TM_COL_TYPE),
                "heroes": [],
            }
            teams.append(current)
        if current is None:
            continue
        tactics_after = [
            t for t in (_tm_txt(row, TM_COL_CP1_AFTER), _tm_txt(row, TM_COL_CP2_AFTER)) if t
        ]
        current["heroes"].append(
            {
                "name": hero,
                "unitTypeBefore": _tm_txt(row, TM_COL_TYPE),
                "tacticBefore": _tm_txt(row, TM_COL_CP_BEFORE),
                "unitTypeAfter": _tm_txt(row, TM_COL_TYPE_AFTER),
                "tacticsAfter": tactics_after,
                "note": _tm_txt(row, TM_COL_NOTE),
            }
        )
    # Ghép title từ tên 3 tướng.
    for t in teams:
        t["title"] = " · ".join(h["name"] for h in t["heroes"])
    return teams


def parse_cham_su_teams(html_path: str) -> List[dict]:
    """Read the independent right table; its blank rows delimit groups."""
    groups: List[dict] = []
    hero_col = None
    in_rows = False
    heroes: List[dict] = []
    alternatives: List[str] = []

    def finish_group() -> None:
        if not heroes:
            return
        title = " · ".join(hero["name"] for hero in heroes)
        normalized = unicodedata.normalize("NFD", title.lower().replace("đ", "d"))
        plain = "".join(char for char in normalized if not unicodedata.combining(char))
        slug = re.sub(r"[^a-z0-9]+", "-", plain).strip("-")
        note = "Mang 1 lính."
        if alternatives:
            note += " Tướng thay thế: " + "; ".join(alternatives).rstrip(".") + "."
        groups.append({
            "id": slug,
            "title": title,
            "heroes": list(heroes),
            "note": note,
        })
        heroes.clear()
        alternatives.clear()

    for row in extract_grid(html_path):
        heading = next((index for index, cell in enumerate(row)
                        if cell.origin and cell.text.strip().startswith("Team Chạm Sứ")), None)
        if heading is not None:
            finish_group()
            hero_col = heading
            in_rows = False
            continue
        if hero_col is None:
            continue
        name = _tm_txt(row, hero_col)
        tactic = _tm_txt(row, hero_col + 1)
        if name == "Tướng" and tactic == "Chiến pháp 1":
            in_rows = True
            continue
        if not in_rows:
            continue
        if not name:
            finish_group()
            continue
        if row[hero_col].origin:
            heroes.append({"name": name, "tactic": tactic})
        alt_col = hero_col + 2
        if alt_col < len(row) and row[alt_col].origin:
            alt = _tm_txt(row, alt_col)
            if alt and alt not in alternatives:
                alternatives.append(alt)
    finish_group()
    return groups


if __name__ == "__main__":
    import json
    import sys

    data = {
        "mines": parse_khaihoang(sys.argv[1]),
        "teams": parse_khaihoang_teams(sys.argv[1]),
        "chamSuTeams": parse_cham_su_teams(sys.argv[1]),
    }
    print(json.dumps(data, ensure_ascii=False, indent=2))
