"""Orchestrate toàn pipeline -> data/{teams,coexist,khaihoang,facets}.json.

Verify per-file count, fail-fast. Ghi đè 4 file output (UTF-8, indent 2,
``sort_keys=False``: giữ thứ tự khoá theo code). ID đội đã commit trong
``data/teams.json`` được giữ theo (nguồn, tập tên tướng đã sắp); đội mới nhận
số kế tiếp của đúng nguồn; đội đã commit biến mất khỏi nguồn -> dừng.
"""

from __future__ import annotations

import json
import os
from collections import Counter, defaultdict, deque
from typing import Deque, Dict, List, Optional, Tuple

from .normalize import load_aliases, load_nicknames, normalize_team
from .parse_coexist import group_coexist, parse_coexist
from .parse_khaihoang import parse_cham_su_teams, parse_khaihoang, parse_khaihoang_teams
from .parse_team_intro import parse_team_intro

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_SRC = os.path.join(_ROOT, "Meta Team PK")
_OUT = os.path.join(_ROOT, "data")

# (file, source-tag, status-hint, expected-count)
_TEAM_FILES = [
    ("Team giới thiệu(mới).html", "team-intro", None, 50),
    ("Meta mỗi phe (cũ).html", "moi-phe", "out-meta", 110),
]


def _team_key(source: str, heroes: List[dict]) -> Tuple[str, Tuple[str, ...]]:
    return source, tuple(sorted(h["baseName"] for h in heroes))


def _id_number(team_id: str) -> int:
    return int(team_id.rsplit("-", 1)[1])


def load_committed_teams(path: str = os.path.join(_OUT, "teams.json")) -> List[dict]:
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def build_teams(committed: Optional[List[dict]] = None) -> List[dict]:
    """Parse + normalize các nguồn đội, giữ ID của ``committed``.

    Ghép theo (nguồn, tập tên tướng đã sắp); trùng khoá thì theo thứ tự xuất hiện.
    """
    aliases = load_aliases()
    nicknames = load_nicknames()
    known: Dict[Tuple[str, Tuple[str, ...]], Deque[str]] = defaultdict(deque)
    next_number: Dict[str, int] = defaultdict(int)
    for team in committed or []:
        known[_team_key(team["source"], team["heroes"])].append(team["id"])
        next_number[team["source"]] = max(next_number[team["source"]], _id_number(team["id"]) + 1)

    teams: List[dict] = []
    for fname, src, hint, expected in _TEAM_FILES:
        raw = parse_team_intro(os.path.join(_SRC, fname), src, hint)
        if len(raw) != expected:
            raise SystemExit(
                f"[build] COUNT MISMATCH {fname}: got {len(raw)} expected {expected}"
            )
        for r in raw:
            team = normalize_team(r, aliases, "", nicknames)
            matches = known.get(_team_key(src, team["heroes"]))
            if matches:
                team["id"] = matches.popleft()
            else:
                team["id"] = f"{src}-{next_number[src]}"
                next_number[src] += 1
            teams.append(team)

    missing = sorted((i for ids in known.values() for i in ids), key=lambda i: (i.rsplit("-", 1)[0], _id_number(i)))
    if missing:
        raise SystemExit(
            f"[build] {len(missing)} đội đã commit không còn trong nguồn (ID công khai sẽ mất): "
            + ", ".join(missing)
        )
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


def build_khaihoang_payload(html_path: str) -> dict:
    """Build this HTML snapshot only, without other inputs or output writes."""
    return {
        "teams": parse_khaihoang_teams(html_path),
        "mines": parse_khaihoang(html_path),
        "chamSuTeams": parse_cham_su_teams(html_path),
    }


def main() -> None:
    teams = build_teams(committed=load_committed_teams())
    facets = build_facets(teams)
    coexist = group_coexist(parse_coexist(os.path.join(_SRC, "Team Cùng Tồn.html")))
    kh_path = os.path.join(_SRC, "Khai hoang.html")
    khaihoang = build_khaihoang_payload(kh_path)

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
