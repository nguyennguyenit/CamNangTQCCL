"""Parser cho Khai hoang.html (PvE đánh mỏ).

Cấu trúc: xen kẽ hàng "Mỏ N" (1 ô) và hàng 8 đội thủ quân dạng "Tên(LoạiBinh)".
Output: list mỏ, mỗi mỏ có danh sách 8 đội thủ (hero + unitType).
"""

from __future__ import annotations

import re
from typing import List

from .grid_extractor import extract_grid, grid_texts

_MINE_RE = re.compile(r"^Mỏ\s*\d+", re.IGNORECASE)
_ENEMY_RE = re.compile(r"^(.+?)\((Kỵ|Cung|Thương|Khiên)\)\s*$")


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


if __name__ == "__main__":
    import json
    import sys

    data = parse_khaihoang(sys.argv[1])
    print(json.dumps(data, ensure_ascii=False, indent=2))
