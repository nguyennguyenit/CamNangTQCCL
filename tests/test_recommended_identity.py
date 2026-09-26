import json
from pathlib import Path
import unittest

from pipeline.recommended_identity import (
    build_display_mapping,
    build_mapping,
    resolve_display_name,
    resolve_identity,
    resolve_team_display_name,
)


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

    def test_translation_approval_does_not_confirm_or_merge_variant_identity(self):
        base = next(item for item in self.mapping["entries"] if item["stableId"] == "hero:lu-bu")
        translation = {"kind": "hero", "variant": "40Y", "aliases": ["40Y 呂布"],
                       "displayNameVi": "40Y Lữ Bố", "reviewStatus": "translation-reviewed", "evidenceRef": "user:1"}
        mapping = build_display_mapping([base, translation])
        self.assertEqual(resolve_display_name("hero", "40Y呂布", mapping), "40Y Lữ Bố")
        self.assertEqual(resolve_display_name("hero", "呂布", mapping), "Lữ Bố")
        self.assertIsNone(resolve_display_name("hero", "SP 呂布", mapping))
        self.assertEqual(resolve_identity("hero", "40Y 呂布", mapping)["status"], "missing")
        self.assertEqual(resolve_identity("hero", "呂布", mapping)["stableId"], "hero:lu-bu")
        unreviewed = build_display_mapping([base, {**translation, "reviewStatus": "pending"}])
        self.assertIsNone(resolve_display_name("hero", "40Y 呂布", unreviewed))

    def test_luc_luc_display_approval_does_not_merge_combat_and_internal_identities(self):
        path = Path(__file__).resolve().parents[1] / "pipeline" / "recommended-identity-map.json"
        mapping = build_display_mapping(json.loads(path.read_text(encoding="utf-8"))["entries"])
        self.assertEqual(
            resolve_display_name("tactic", "戮力上心", mapping),
            "Đồng Lòng Hợp Sức",
        )
        self.assertEqual(resolve_identity("tactic", "戮力上心", mapping)["status"], "missing")
        combat = resolve_identity("tactic", "勠力同心", mapping)
        internal = resolve_identity("tactic", "戮力上国", mapping)
        self.assertEqual(combat["status"], "resolved")
        self.assertEqual(internal["status"], "resolved")
        self.assertNotEqual(combat["stableId"], internal["stableId"])
        self.assertEqual(internal["displayNameVi"], "Lục Lực Thượng Quốc")

    def test_team_titles_support_global_and_source_scoped_translations(self):
        entries = [
            {
                "kind": "team",
                "aliases": ["桃園盾"],
                "displayNameVi": "Đào Viên Thuẫn",
                "reviewStatus": "translation-reviewed",
                "evidenceRef": "fixture:team-global",
            },
            {
                "kind": "team",
                "aliases": ["變種隊"],
                "sourceConfigId": "source-a",
                "displayNameVi": "Đội Biến Thể A",
                "reviewStatus": "translation-reviewed",
                "evidenceRef": "fixture:team-scoped",
            },
        ]
        mapping = build_display_mapping(entries)
        self.assertEqual(
            resolve_team_display_name({"sourceConfigId": "source-a", "nameZh": "變種隊"}, mapping),
            "Đội Biến Thể A",
        )
        self.assertIsNone(
            resolve_team_display_name({"sourceConfigId": "source-b", "nameZh": "變種隊"}, mapping)
        )
        self.assertEqual(
            resolve_team_display_name({"sourceConfigId": "source-b", "nameZh": "桃園盾"}, mapping),
            "Đào Viên Thuẫn",
        )
        with self.assertRaises(ValueError):
            build_display_mapping([entries[1], {**entries[1], "displayNameVi": "Tên Khác"}])
        with self.assertRaises(ValueError):
            build_display_mapping([entries[1], dict(entries[1])])
        with self.assertRaises(ValueError):
            resolve_team_display_name({"sourceConfigId": "source-a", "nameZh": "Tên Khác"}, mapping)
        with self.assertRaises(ValueError):
            build_display_mapping([{**entries[1], "stableId": "team:forbidden"}])

    def test_team_titles_use_ascii_brackets_once_fully_translated(self):
        entries = [
            {"kind": "team", "aliases": ["奸雄騎（呂布）"], "displayNameVi": "Gian Hùng Kỵ（Lữ Bố）",
             "reviewStatus": "translation-reviewed", "evidenceRef": "fixture:team-bracket"},
            {"kind": "team", "aliases": ["騎（呂布）"], "displayNameVi": "Kỵ （ Lữ Bố ）  Thuẫn",
             "reviewStatus": "translation-reviewed", "evidenceRef": "fixture:team-bracket-space"},
            {"kind": "team", "aliases": ["弓（呂布）"], "displayNameVi": "Cung（呂布）",
             "reviewStatus": "translation-reviewed", "evidenceRef": "fixture:team-bracket-han"},
        ]
        mapping = build_display_mapping(entries)
        self.assertEqual(resolve_team_display_name({"nameZh": "奸雄騎（呂布）"}, mapping), "Gian Hùng Kỵ (Lữ Bố)")
        self.assertEqual(resolve_team_display_name({"nameZh": "騎（呂布）"}, mapping), "Kỵ (Lữ Bố) Thuẫn")
        # Tên còn chữ Hán giữ nguyên dấu ngoặc nguồn.
        self.assertEqual(resolve_team_display_name({"nameZh": "弓（呂布）"}, mapping), "Cung（呂布）")

if __name__ == "__main__":
    unittest.main()
