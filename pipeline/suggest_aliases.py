"""Gợi ý cụm tên gần-trùng (typo) cho con người review vào aliases.json.

KHÔNG tự áp dụng fuzzy — chỉ in cluster + count để người chọn.
Dùng difflib cutoff cao để giảm false positive. Quét đúng các nguồn đội mà
``build_json`` publish; tướng gom theo ``baseName`` (bỏ SP/biến thể); tên đã là
khoá trong ``aliases.json`` (typo đã xử lý) không được đề xuất lại.
"""

from __future__ import annotations

import difflib
import os
import sys
from collections import Counter
from typing import Dict, List

from .build_json import _SRC, _TEAM_FILES
from .normalize import load_aliases, parse_hero
from .parse_team_intro import parse_team_intro


def collect_counts() -> Dict[str, Counter]:
    aliases = load_aliases()
    known = {**aliases, "heroes": {**aliases["heroes"], **aliases["heroNames"]}}
    counts: Dict[str, Counter] = {"tactics": Counter(), "books": Counter(), "heroes": Counter()}

    def add(kind: str, name: str) -> None:
        if name and name not in known[kind]:
            counts[kind][name] += 1

    for fname, src, hint, _expected in _TEAM_FILES:
        for team in parse_team_intro(os.path.join(_SRC, fname), src, hint):
            for h in team["heroesRaw"]:
                hero = parse_hero(h["nameRaw"])
                for name in [hero["baseName"], *hero["alternatives"]]:
                    add("heroes", name.strip())
                for cp in (h["cp1Raw"], h["cp2Raw"]):
                    for part in str(cp).split("/"):
                        add("tactics", part.strip())
                for b in h["booksRaw"]:
                    for part in str(b).split("/"):
                        add("books", part.strip().replace("Tinh·", "").replace("Thác·", "").strip())
    return counts


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
