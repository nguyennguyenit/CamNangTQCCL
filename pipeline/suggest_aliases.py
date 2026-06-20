"""Gợi ý cụm tên gần-trùng (typo) cho con người review vào aliases.json.

KHÔNG tự áp dụng fuzzy — chỉ in cluster + count để người chọn.
Dùng difflib cutoff cao để giảm false positive.
"""

from __future__ import annotations

import difflib
import sys
from collections import Counter
from typing import Dict, List

from .parse_team_intro import parse_team_intro

_FILES = [
    ("Meta Team PK/Team giới thiệu(mới).html", "team-intro", None),
    ("Meta Team PK/Team Đô Úy.html", "do-uy", None),
    ("Meta Team PK/Meta mỗi phe (cũ).html", "moi-phe", "out-meta"),
]


def collect_counts() -> Dict[str, Counter]:
    tactics: Counter = Counter()
    books: Counter = Counter()
    heroes: Counter = Counter()
    for path, src, hint in _FILES:
        for team in parse_team_intro(path, src, hint):
            for h in team["heroesRaw"]:
                heroes[h["nameRaw"].strip()] += 1
                for cp in (h["cp1Raw"], h["cp2Raw"]):
                    for part in str(cp).split("/"):
                        part = part.strip()
                        if part:
                            tactics[part] += 1
                for b in h["booksRaw"]:
                    for part in str(b).split("/"):
                        part = part.strip().replace("Tinh·", "").replace("Thác·", "").strip()
                        if part:
                            books[part] += 1
    return {"tactics": tactics, "books": books, "heroes": heroes}


def clusters(counter: Counter, cutoff: float = 0.86) -> List[List[str]]:
    names = list(counter.keys())
    seen = set()
    out = []
    for i, a in enumerate(names):
        if a in seen:
            continue
        group = [a]
        for b in names[i + 1:]:
            if b in seen:
                continue
            if a != b and difflib.SequenceMatcher(None, a, b).ratio() >= cutoff:
                group.append(b)
                seen.add(b)
        if len(group) > 1:
            seen.add(a)
            out.append(group)
    return out


def main():
    counts = collect_counts()
    for kind in ("heroes", "tactics", "books"):
        print(f"\n##### {kind} (distinct={len(counts[kind])}) — near-duplicate clusters #####")
        for grp in clusters(counts[kind]):
            print("  " + "  |  ".join(f"{g} ({counts[kind][g]})" for g in grp))


if __name__ == "__main__":
    sys.path.insert(0, ".")
    main()
