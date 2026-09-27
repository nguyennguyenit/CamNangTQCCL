"""Build data/team-tier.json từ bảng curate thủ công pipeline/team-tier-map.json.

Tier gắn vào **team** (nguồn TQ rank đội hình, không rank tướng lẻ). Khóa join =
team `id` (`team-intro-N`, unique; `name` KHÔNG unique). Multi-source: map giữ
`source` của từng xếp hạng để đối chiếu nội bộ; bản phát chỉ có `rankings:[{tier,updatedAt}]`.

Fail-loud: id trong map không có trong teams.json (chống typo) / tier ngoài tập
hợp lệ. Chạy OFFLINE lúc build, stdlib, KHÔNG vào runtime site.

Dùng: python3 -m pipeline.build_team_tier
"""

from __future__ import annotations

import json
import os
import sys

_DIR = os.path.dirname(__file__)
_DATA = os.path.join(_DIR, "..", "data")
_MAP = os.path.join(_DIR, "team-tier-map.json")
_TEAMS = os.path.join(_DATA, "teams.json")
_OUT = os.path.join(_DATA, "team-tier.json")

# Tập tier hợp lệ (có half-tier). Ngoài tập -> fail-loud [Audit A3].
VALID_TIERS = {"T0", "T0.5", "T1", "T1.5", "T2", "T3"}


def build_team_tier(tier_map: dict, teams: list) -> list:
    """Join map (multi-source) vào teams theo `id`. Trả [{teamId, rankings[]}].

    Fail-loud: id không tồn tại trong teams / tier ngoài VALID_TIERS.
    """
    valid_ids = {t["id"] for t in teams}
    out = []
    for team_id, rankings in tier_map.items():
        if team_id not in valid_ids:
            raise KeyError(f"[fail-loud] teamId không có trong teams.json: {team_id!r}")
        for r in rankings:
            if r.get("tier") not in VALID_TIERS:
                raise ValueError(f"[fail-loud] tier không hợp lệ: {r.get('tier')!r} (team {team_id})")
        out.append({
            "teamId": team_id,
            "rankings": [
                {"tier": r["tier"], "updatedAt": r["updatedAt"]}
                for r in rankings
            ],
        })
    out.sort(key=lambda r: r["teamId"])
    return out


def main() -> None:
    with open(_MAP, encoding="utf-8") as fh:
        tier_map = json.load(fh)
    with open(_TEAMS, encoding="utf-8") as fh:
        teams = json.load(fh)
    out = build_team_tier(tier_map, teams)
    with open(_OUT, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    print(f"team-tier.json: {len(out)} team có tier (từ {len(tier_map)} entry map)", file=sys.stderr)


if __name__ == "__main__":
    main()
