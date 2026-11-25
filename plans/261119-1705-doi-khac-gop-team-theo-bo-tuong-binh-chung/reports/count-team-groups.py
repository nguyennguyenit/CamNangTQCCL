"""Đếm team / phương án Đội khác theo đúng module pipeline.other_team_groups.

Chạy từ gốc repo (worktree): python3 <đường dẫn tới file này> [--ledger pipeline/recommended-other-teams.json]
In: số team, team có phương án đủ dữ liệu, phương án đủ dữ liệu theo nguồn, route bị loại khỏi website.
"""
import argparse
import collections
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path.cwd()))
from pipeline.other_team_groups import annotate_other_teams  # noqa: E402

parser = argparse.ArgumentParser()
parser.add_argument("--ledger", default="pipeline/recommended-other-teams.json")
parser.add_argument("--teams", default="data/teams.json")
args = parser.parse_args()

ledger = json.loads(Path(args.ledger).read_text())
teams = {row["id"]: row for row in json.loads(Path(args.teams).read_text())}
records, groups = annotate_other_teams(ledger["admitted"])
complete = [row for row in records if row["dataComplete"]]
print("phương án admitted:", len(records))
print("team:", len(groups))
print("team có phương án đủ dữ liệu:", sum(1 for group in groups if group["representativeVariantId"]))
print("phương án đủ dữ liệu:", len(complete), dict(collections.Counter(teams[row["legacyTeamId"]]["source"] for row in complete)))
kept = {row["legacyTeamId"] for row in complete}
removed = [team_id for team_id in teams if team_id not in kept]
classes = {row["legacyTeamId"]: row["classification"] for row in ledger["decisions"]}
print("route bị loại khỏi website:", len(removed), dict(collections.Counter(
    "admitted thiếu dữ liệu" if classes.get(team_id) == "distinct" else classes.get(team_id) for team_id in removed)))
