"""Orchestrate toàn pipeline -> data/{teams,coexist,khaihoang,facets}.json.

Verify per-file count, log diff fail-fast. Deterministic output (UTF-8, sort key).
"""

from __future__ import annotations

import json
import os
from collections import Counter
from typing import Dict, List

from .normalize import load_aliases, load_nicknames, normalize_team
from .parse_coexist import group_coexist, parse_coexist
from .parse_khaihoang import parse_khaihoang, parse_khaihoang_teams
from .parse_team_intro import parse_team_intro

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_SRC = os.path.join(_ROOT, "Meta Team PK")
_OUT = os.path.join(_ROOT, "data")

# (file, source-tag, status-hint, expected-count)
_TEAM_FILES = [
    ("Team giới thiệu(mới).html", "team-intro", None, 50),
    ("Meta mỗi phe (cũ).html", "moi-phe", "out-meta", 110),
]


def build_teams() -> List[dict]:
    aliases = load_aliases()
    nicknames = load_nicknames()
    teams: List[dict] = []
    idx = 0
    for fname, src, hint, expected in _TEAM_FILES:
        raw = parse_team_intro(os.path.join(_SRC, fname), src, hint)
        if len(raw) != expected:
            raise SystemExit(
                f"[build] COUNT MISMATCH {fname}: got {len(raw)} expected {expected}"
            )
        for r in raw:
            teams.append(normalize_team(r, aliases, idx, nicknames))
            idx += 1
    return teams


def build_facets(teams: List[dict]) -> Dict[str, list]:
    """Distinct + count cho autocomplete (sinh tĩnh)."""
    heroes: Counter = Counter()
    tactics: Counter = Counter()
    books: Counter = Counter()
    unit_types: Counter = Counter()
    stars: Counter = Counter()
    factions: Counter = Counter()
    statuses: Counter = Counter()
    sources: Counter = Counter()
    for t in teams:
        sources[t["source"]] += 1
        for u in t["unitType"]:
            unit_types[u] += 1
        if t["stars"] is not None:
            # "%g" -> "4"/"4.5"/"5" khớp JS String(Number) phía frontend.
            stars["%g" % t["stars"]] += 1
        if t["faction"]:
            factions[t["faction"]] += 1
        statuses[t["status"]] += 1
        for h in t["heroes"]:
            for hn in [h["baseName"]] + h.get("alternatives", []):
                heroes[hn] += 1
            for grp in h["tactics"]:
                for name in [grp["name"]] + grp["alternatives"]:
                    tactics[name] += 1
            for grp in h["books"]:
                for name in [grp["name"]] + grp["alternatives"]:
                    books[name] += 1

    def to_list(counter: Counter) -> list:
        return [{"value": k, "count": v} for k, v in sorted(counter.items(), key=lambda kv: (-kv[1], kv[0]))]

    return {
        "heroes": to_list(heroes),
        "tactics": to_list(tactics),
        "books": to_list(books),
        "unitTypes": to_list(unit_types),
        "stars": to_list(stars),
        "factions": to_list(factions),
        "statuses": to_list(statuses),
        "sources": to_list(sources),
    }


def _write(name: str, data) -> None:
    os.makedirs(_OUT, exist_ok=True)
    path = os.path.join(_OUT, name)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2, sort_keys=False)
        fh.write("\n")


def main() -> None:
    teams = build_teams()
    facets = build_facets(teams)
    coexist = group_coexist(parse_coexist(os.path.join(_SRC, "Team Cùng Tồn.html")))
    kh_path = os.path.join(_SRC, "Khai hoang.html")
    khaihoang = {
        "teams": parse_khaihoang_teams(kh_path),
        "mines": parse_khaihoang(kh_path),
    }

    if not coexist:
        raise SystemExit("[build] coexist rỗng")
    if not khaihoang["mines"] or not khaihoang["teams"]:
        raise SystemExit("[build] khaihoang rỗng (mines hoặc teams)")

    _write("teams.json", teams)
    _write("facets.json", facets)
    _write("coexist.json", coexist)
    _write("khaihoang.json", khaihoang)

    print(
        f"[build] teams={len(teams)} coexist-groups={len(coexist)} "
        f"khaihoang-teams={len(khaihoang['teams'])} mines={len(khaihoang['mines'])}"
    )
    print(f"[build] facets: heroes={len(facets['heroes'])} tactics={len(facets['tactics'])} books={len(facets['books'])}")


if __name__ == "__main__":
    main()
