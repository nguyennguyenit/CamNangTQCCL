"""TDD pipeline/build_team_tier.py — join map tier (multi-source) vào teams theo
`id`, fail-loud khi id sai / tier ngoài tập. Test thuần (fixture in-memory)."""

import unittest

from pipeline import build_team_tier as btt


TEAMS = [
    {"id": "team-intro-0", "name": "A"},
    {"id": "team-intro-1", "name": "B"},
    {"id": "team-intro-2", "name": "C"},
]


class BuildTeamTierTest(unittest.TestCase):
    def test_join_multi_source(self):
        tier_map = {
            "team-intro-0": [
                {"source": "zhihu/x", "tier": "T0", "updatedAt": "2026-06-26"},
                {"source": "taptap/y", "tier": "T1", "updatedAt": "2026-06-20"},
            ],
            "team-intro-2": [{"source": "zhihu/x", "tier": "T1.5", "updatedAt": "2026-06-26"}],
        }
        out = btt.build_team_tier(tier_map, TEAMS)
        by_id = {r["teamId"]: r for r in out}
        self.assertEqual(len(out), 2)  # chỉ team có trong map
        self.assertEqual(len(by_id["team-intro-0"]["rankings"]), 2)
        self.assertEqual(by_id["team-intro-2"]["rankings"][0]["tier"], "T1.5")

    def test_unknown_id_fail_loud(self):
        bad = {"team-intro-999": [{"source": "s", "tier": "T0", "updatedAt": "2026-06-26"}]}
        with self.assertRaises(Exception):
            btt.build_team_tier(bad, TEAMS)

    def test_invalid_tier_fail_loud(self):
        bad = {"team-intro-0": [{"source": "s", "tier": "T9", "updatedAt": "2026-06-26"}]}
        with self.assertRaises(Exception):
            btt.build_team_tier(bad, TEAMS)

    def test_valid_half_tiers_ok(self):
        m = {"team-intro-1": [{"source": "s", "tier": "T0.5", "updatedAt": "2026-06-26"}]}
        out = btt.build_team_tier(m, TEAMS)
        self.assertEqual(out[0]["rankings"][0]["tier"], "T0.5")


if __name__ == "__main__":
    unittest.main()
