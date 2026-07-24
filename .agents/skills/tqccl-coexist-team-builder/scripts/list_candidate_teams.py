#!/usr/bin/env python3
"""List CamNangTQCCL prebuilt team candidates with tactic conflicts."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


TIER_RANK = {
    "T0": 0,
    "T0.5": 1,
    "T1": 2,
    "T1.5": 3,
    "T2": 4,
    "T3": 5,
}


def split_csv(value: str) -> set[str]:
    if not value:
        return set()
    return {item.strip() for item in value.split(",") if item.strip()}


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def best_tier(rankings: list[dict]) -> tuple[str | None, int]:
    best_label = None
    best_rank = 999
    for ranking in rankings:
        tier = ranking.get("tier")
        rank = TIER_RANK.get(tier, 999)
        if rank < best_rank:
            best_label = tier
            best_rank = rank
    return best_label, best_rank


def hero_names(team: dict) -> list[str]:
    return [hero.get("name", "") for hero in team.get("heroes", [])]


def tactic_names(team: dict) -> list[str]:
    names: list[str] = []
    for hero in team.get("heroes", []):
        for tactic in hero.get("tactics", []):
            if isinstance(tactic, dict):
                name = tactic.get("name")
            else:
                name = tactic
            if name:
                names.append(name)
    return names


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", default=".", help="CamNangTQCCL project root")
    parser.add_argument("--available-heroes", default="", help="Comma-separated owned heroes")
    parser.add_argument("--used-tactics", default="", help="Comma-separated locked tactics")
    parser.add_argument("--require-available", action="store_true", help="Hide teams with missing heroes")
    parser.add_argument("--no-conflicts", action="store_true", help="Hide teams with locked tactic conflicts")
    parser.add_argument("--max-tier", default="T1", choices=list(TIER_RANK))
    parser.add_argument("--limit", type=int, default=30)
    parser.add_argument("--json", action="store_true", help="Emit JSON instead of text")
    args = parser.parse_args()

    project = Path(args.project).resolve()
    teams = load_json(project / "data" / "teams.json")
    tiers = load_json(project / "data" / "team-tier.json")
    tier_by_id = {item["teamId"]: item.get("rankings", []) for item in tiers}

    available = split_csv(args.available_heroes)
    used_tactics = split_csv(args.used_tactics)
    max_rank = TIER_RANK[args.max_tier]

    rows = []
    for team in teams:
        rankings = tier_by_id.get(team.get("id"), [])
        tier, rank = best_tier(rankings)
        if tier is None or rank > max_rank:
            continue

        heroes = hero_names(team)
        tactics = tactic_names(team)
        missing_heroes = sorted(set(heroes) - available) if available else []
        conflicts = sorted(set(tactics) & used_tactics)
        if args.require_available and missing_heroes:
            continue
        if args.no_conflicts and conflicts:
            continue

        rows.append(
            {
                "id": team.get("id"),
                "name": team.get("name") or team.get("nickname") or team.get("id"),
                "nickname": team.get("nickname"),
                "tier": tier,
                "source": team.get("source"),
                "unitType": team.get("unitType", []),
                "stars": team.get("stars"),
                "heroes": heroes,
                "tactics": tactics,
                "missingHeroes": missing_heroes,
                "conflicts": conflicts,
                "conflictCount": len(conflicts),
                "missingHeroCount": len(missing_heroes),
            }
        )

    rows.sort(
        key=lambda row: (
            TIER_RANK.get(row["tier"], 999),
            row["conflictCount"],
            row["missingHeroCount"],
            -(row["stars"] or 0),
            row["name"],
        )
    )
    rows = rows[: args.limit]

    if args.json:
        print(json.dumps(rows, ensure_ascii=False, indent=2))
        return 0

    for row in rows:
        title = f"{row['tier']} {row['name']}"
        if row.get("nickname"):
            title += f" ({row['nickname']})"
        print(title)
        print(f"  id: {row['id']} | source: {row['source']} | stars: {row['stars']}")
        print(f"  heroes: {', '.join(row['heroes'])}")
        print(f"  tactics: {', '.join(row['tactics'])}")
        if row["conflicts"]:
            print(f"  conflicts: {', '.join(row['conflicts'])}")
        if row["missingHeroes"]:
            print(f"  missing heroes: {', '.join(row['missingHeroes'])}")
        print()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
