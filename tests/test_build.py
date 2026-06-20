"""Test build: tổng team đúng, deterministic, JSON UTF-8 hợp lệ, alias giảm distinct."""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pipeline import build_json  # noqa: E402

BASE = os.path.join(os.path.dirname(__file__), "..", "Meta Team PK")


def _has_sources():
    return os.path.exists(os.path.join(BASE, "Team giới thiệu(mới).html"))


@unittest.skipUnless(_has_sources(), "nguồn HTML không có")
class TestBuild(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.teams = build_json.build_teams()

    def test_total_count(self):
        self.assertEqual(len(self.teams), 172)

    def test_team_shape(self):
        t = self.teams[0]
        for key in ("id", "source", "unitType", "stars", "status", "heroes", "counters", "notes"):
            self.assertIn(key, t)
        self.assertTrue(t["heroes"])
        self.assertIn("good", t["counters"])

    def test_deterministic(self):
        again = build_json.build_teams()
        self.assertEqual(self.teams, again)

    def test_alias_reduces_distinct(self):
        # Sau alias, không còn các typo đã khai trong tập tactics.
        names = set()
        for t in self.teams:
            for h in t["heroes"]:
                for grp in h["tactics"]:
                    names.add(grp["name"])
                    names.update(grp["alternatives"])
        self.assertNotIn("Thịnh Khí Lăng Địch", names)
        self.assertNotIn("Phong Thị Trận", names)

    def test_facets_nonempty(self):
        facets = build_json.build_facets(self.teams)
        self.assertGreater(len(facets["tactics"]), 50)
        self.assertTrue(all("count" in x for x in facets["heroes"]))

    def test_moi_phe_out_meta(self):
        moi = [t for t in self.teams if t["source"] == "moi-phe"]
        self.assertTrue(moi)
        self.assertTrue(all(t["status"] == "out-meta" for t in moi))


if __name__ == "__main__":
    unittest.main()
