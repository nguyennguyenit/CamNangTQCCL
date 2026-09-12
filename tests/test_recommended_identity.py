import unittest

from pipeline.recommended_identity import build_mapping, resolve_identity


class RecommendedIdentityTest(unittest.TestCase):
    def setUp(self):
        self.mapping = build_mapping([
            {"kind": "hero", "stableId": "hero:lu-bu", "variant": "base", "aliases": ["呂布", "Lữ Bố"], "displayNameVi": "Lữ Bố", "reviewStatus": "reviewed", "evidenceRef": "fixture:1"},
            {"kind": "hero", "stableId": "hero:lu-bu-40y", "variant": "40Y", "aliases": ["40Y 呂布", "40Y Lữ Bố"], "displayNameVi": "40Y Lữ Bố", "reviewStatus": "reviewed", "evidenceRef": "fixture:2"},
            {"kind": "tactic", "stableId": "tactic:dang-phong", "aliases": ["當鋒摧決", "当锋摧决", "Đương Phong Thôi Quyết"], "displayNameVi": "Đương Phong Thôi Quyết", "reviewStatus": "reviewed", "evidenceRef": "fixture:3"},
        ])

    def test_reviewed_aliases_resolve_and_variants_stay_distinct(self):
        self.assertEqual(resolve_identity("hero", "呂布", self.mapping)["stableId"], "hero:lu-bu")
        self.assertEqual(resolve_identity("hero", "40Y 呂布", self.mapping)["stableId"], "hero:lu-bu-40y")
        self.assertEqual(resolve_identity("tactic", "当锋摧决", self.mapping)["stableId"], "tactic:dang-phong")

    def test_unknown_and_conflicting_aliases_do_not_resolve(self):
        self.assertEqual(resolve_identity("hero", "未知", self.mapping)["status"], "missing")
        conflict = build_mapping([
            {"kind": "hero", "stableId": "a", "aliases": ["X"], "reviewStatus": "reviewed", "evidenceRef": "a"},
            {"kind": "hero", "stableId": "b", "aliases": ["X"], "reviewStatus": "reviewed", "evidenceRef": "b"},
        ])
        self.assertEqual(resolve_identity("hero", "X", conflict)["status"], "ambiguous")


if __name__ == "__main__":
    unittest.main()
