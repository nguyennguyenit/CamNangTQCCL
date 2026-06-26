"""TDD pipeline/suggest_team_tier.py — parser thuần trên fixture HTML cục bộ
(KHÔNG live-fetch [Audit A4]). Tool suggest-only, người duyệt tay vào map."""

import os
import unittest

from pipeline import suggest_team_tier as stt

_FIX = os.path.join(os.path.dirname(__file__), "fixtures", "team_tier_source_sample.html")


class ParseSuggestionTest(unittest.TestCase):
    def setUp(self):
        with open(_FIX, encoding="utf-8") as fh:
            self.html = fh.read()

    def test_parse_tiers_and_teams(self):
        out = stt.parse_team_tier_suggestions(self.html)
        teams = {s["team"]: s for s in out}
        self.assertEqual(len(out), 4)
        self.assertEqual(teams["太尉盾"]["tier"], "T0")
        self.assertEqual(teams["黄军弓"]["tier"], "T0")
        self.assertEqual(teams["三仙盾"]["tier"], "T0.5")
        self.assertEqual(teams["王佐骑"]["tier"], "T1")

    def test_parse_heroes_cn(self):
        out = stt.parse_team_tier_suggestions(self.html)
        teams = {s["team"]: s for s in out}
        self.assertEqual(teams["太尉盾"]["heroesCn"], ["司马懿", "曹操", "满宠"])

    def test_map_by_hero_composition(self):
        # Map tướng Hán -> Việt qua heroes-dict, khớp composition với teams.
        heroes_dict = [
            {"chinese": "司马懿", "hanViet": "Tư Mã Ý"},
            {"chinese": "曹操", "hanViet": "Tào Tháo"},
            {"chinese": "满宠", "hanViet": "Mãn Sủng"},
        ]
        teams = [
            {"id": "team-intro-42", "heroes": [{"baseName": "Tư Mã Ý"}, {"baseName": "Mãn Sủng"}, {"baseName": "Tào Tháo"}]},
            {"id": "team-intro-1", "heroes": [{"baseName": "Khác"}]},
        ]
        sug = {"team": "太尉盾", "tier": "T0", "heroesCn": ["司马懿", "曹操", "满宠"]}
        guess = stt.guess_team_id(sug, teams, heroes_dict)
        self.assertEqual(guess["teamId"], "team-intro-42")
        self.assertEqual(guess["score"], 3)  # khớp đủ 3 tướng


if __name__ == "__main__":
    unittest.main()
