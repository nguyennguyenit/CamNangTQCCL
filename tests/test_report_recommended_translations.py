import json
import tempfile
import unittest
from pathlib import Path

from pipeline.build_recommended_reference import build_generation
from pipeline.report_recommended_translations import build_report, read_generation


SCOPE = "s-" + "1" * 64
REVIEWED = [
    {"kind": "hero", "stableId": "hero:1", "variant": "base", "aliases": ["張遼"], "displayNameVi": "Trương Liêu",
     "reviewStatus": "reviewed", "evidenceRef": "heroes-dict.json#1"},
    {"kind": "tactic", "stableId": "tactic:1", "aliases": ["盛氣淩敵"], "displayNameVi": "Thịnh Khí Lăng Địch",
     "reviewStatus": "reviewed", "evidenceRef": "tactics.json#1"},
    {"kind": "hero", "stableId": "hero:9", "variant": "SP", "aliases": ["SP貂蟬"], "displayNameVi": "Điêu Thuyền",
     "reviewStatus": "reviewed", "evidenceRef": "heroes-dict.json#9"},
    {"kind": "hero", "stableId": "hero:8", "variant": "SP", "aliases": ["SP貂蟬"], "displayNameVi": "Điêu Thuyền khác",
     "reviewStatus": "reviewed", "evidenceRef": "heroes-dict.json#8"},
]


def _row(config_id, name_zh, heroes, alternatives=()):
    return {"sourceConfigId": config_id, "nameZh": name_zh, "safeScopeKey": SCOPE, "listIndex": 0,
            "sourceUrl": "https://sgsdeck.com/recommended/" + config_id, "tierRaw": "T0", "tierOrder": 0,
            "value": 100, "heroes": list(heroes), "alternativeHoldersRaw": list(alternatives)}


def _holder(name, tactics=(), books=()):
    return {"roleRaw": "主將", "nameRaw": name, "tacticSlotsRaw": list(tactics), "bookSlotsRaw": list(books)}


class ReportRecommendedTranslationsTest(unittest.TestCase):
    def _generation(self, root, records):
        inputs = {
            "inventory": {"inventoryHash": "a", "seasonOptions": [{"sourceSeasonId": "s", "status": "available"}],
                          "scopes": [{"safeScopeKey": SCOPE, "sourceScopeId": "s|交戰", "state": "complete"}]},
            "records": records, "details": {SCOPE: list(records)}, "otherTeams": [],
            "mappingHash": "b", "decisionSnapshotHash": "c", "dedupKeyVersion": 1,
        }
        return build_generation(inputs, root)

    def _map(self, root, entries):
        path = root / "identity-map.json"
        path.write_text(json.dumps({"schemaVersion": 1, "entries": entries}, ensure_ascii=False))
        return path

    def test_missing_names_are_deduplicated_with_bounded_source_context(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            reference = root / "reference"
            records = [
                _row("team-a", "隊一", [_holder("張遼", ["盛氣淩敵", "當鋒摧決"], ["執銳", "", "—"])]),
                _row("team-b", "隊二", [_holder("未知甲", ["當鋒摧決"], [])]),
                _row("team-c", "隊三", [_holder("未知甲", ["當鋒摧決"], [])]),
                _row("team-d", "隊四", [_holder("未知甲", ["當鋒摧決"], [])]),
            ]
            self._generation(reference, records)
            report = build_report(reference, self._map(root, REVIEWED[:2]))

            keys = [(item["kind"], item["aliasKey"]) for item in report["items"]]
            self.assertEqual(keys, [("book", "執銳"), ("hero", "未知甲"), ("tactic", "當鋒摧決")])
            self.assertNotIn(("hero", "張遼"), keys)
            self.assertNotIn(("tactic", "盛氣淩敵"), keys)
            missing_hero = next(item for item in report["items"] if item["kind"] == "hero")
            self.assertEqual(missing_hero["occurrences"], 3)
            self.assertEqual([variant["raw"] for variant in missing_hero["rawVariants"]], ["未知甲"])
            self.assertEqual(missing_hero["status"], "missing")
            self.assertIsNone(missing_hero["displayNameVi"])
            self.assertEqual([context["sourceConfigId"] for context in missing_hero["contextExamples"]],
                             ["team-b", "team-c", "team-d"])
            self.assertEqual(missing_hero["contextExamples"][0],
                             {"sourceConfigId": "team-b", "teamNameRaw": "隊二",
                              "sourceUrl": "https://sgsdeck.com/recommended/team-b"})
            tactic = next(item for item in report["items"] if item["kind"] == "tactic")
            self.assertEqual(len(tactic["contextExamples"]), 3)
            self.assertEqual(tactic["occurrences"], 4)
            self.assertEqual(report["counts"]["hero"], {"missingNames": 1, "occurrences": 3})
            self.assertEqual(report["counts"]["book"], {"missingNames": 1, "occurrences": 1})
            self.assertEqual(report["counts"]["total"], 3)
            self.assertEqual(report["sourceGeneration"]["records"], 4)

    def test_alternative_holders_and_ambiguous_variants_stay_unmerged(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            reference = root / "reference"
            records = [_row("team-a", "隊一", [_holder("SP貂蟬", [], [])],
                            [_holder("未知乙", ["未錄"], []), _holder("SP 貂蟬", [], [])])]
            self._generation(reference, records)
            report = build_report(reference, self._map(root, REVIEWED))

            hero = next(item for item in report["items"] if item["kind"] == "hero" and item["aliasKey"] == "SP貂蟬")
            self.assertEqual(hero["status"], "ambiguous")
            self.assertEqual([variant["raw"] for variant in hero["rawVariants"]], ["SP 貂蟬", "SP貂蟬"])
            self.assertEqual(hero["rawVariants"][0]["candidates"], ["hero:8", "hero:9"])
            self.assertEqual(hero["holderKinds"], ["alternative", "primary"])
            alternative_only = next(item for item in report["items"] if item["aliasKey"] == "未知乙")
            self.assertEqual(alternative_only["holderKinds"], ["alternative"])
            self.assertEqual(alternative_only["rawVariants"][0]["reason"], "no-reviewed-exact-alias")
            self.assertEqual(report["counts"]["ambiguous"], 1)

    def test_reviewing_a_name_drops_it_and_keeps_other_row_ids_and_source_bytes(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            reference = root / "reference"
            records = [_row("team-a", "隊一", [_holder("未知甲", ["當鋒摧決"], [])])]
            selector = self._generation(reference, records)
            before = build_report(reference, self._map(root, REVIEWED[:2]))
            source_bytes = (reference / selector["generationId"] / "index.json").read_bytes()

            translated = REVIEWED[:2] + [{"kind": "hero", "stableId": "hero:5", "variant": "base", "aliases": ["未知甲"],
                                          "displayNameVi": "Vô Danh Giáp", "reviewStatus": "reviewed",
                                          "evidenceRef": "heroes-dict.json#5"}]
            after = build_report(reference, self._map(root, translated))

            self.assertEqual([item["aliasKey"] for item in before["items"]], ["未知甲", "當鋒摧決"])
            self.assertEqual([item["aliasKey"] for item in after["items"]], ["當鋒摧決"])
            ids = {item["aliasKey"]: item["itemId"] for item in before["items"]}
            self.assertEqual(after["items"][0]["itemId"], ids["當鋒摧決"])
            self.assertNotEqual(after["mappingHash"], before["mappingHash"])
            self.assertEqual(after["sourceGeneration"], before["sourceGeneration"])
            self.assertEqual((reference / selector["generationId"] / "index.json").read_bytes(), source_bytes)

    def test_unreviewed_entries_and_empty_vietnamese_names_remain_missing(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            reference = root / "reference"
            self._generation(reference, [_row("team-a", "隊一", [_holder("未知甲", ["未錄"], [])])])
            entries = [
                {"kind": "hero", "stableId": "hero:5", "variant": "base", "aliases": ["未知甲"],
                 "displayNameVi": "Vô Danh Giáp", "reviewStatus": "draft", "evidenceRef": "heroes-dict.json#5"},
                {"kind": "tactic", "stableId": "tactic:5", "aliases": ["未錄"], "displayNameVi": "  ",
                 "reviewStatus": "reviewed", "evidenceRef": "tactics.json#5"},
            ]
            report = build_report(reference, self._map(root, entries))

            statuses = {item["aliasKey"]: item["rawVariants"][0]["reason"] for item in report["items"]}
            self.assertEqual(statuses, {"未知甲": "no-reviewed-exact-alias", "未錄": "no-reviewed-vietnamese-name"})

    def test_tampered_generation_payload_is_refused(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            reference = root / "reference"
            selector = self._generation(reference, [_row("team-a", "隊一", [_holder("未知甲", [], [])])])
            index_path = reference / selector["generationId"] / "index.json"
            index_path.write_bytes(index_path.read_bytes().replace(b"\xe6\x9c\xaa\xe7\x9f\xa5\xe7\x94\xb2", b"\xe5\xbc\xb5\xe9\x81\xbc"))
            with self.assertRaisesRegex(ValueError, "index payload differs"):
                read_generation(reference)


if __name__ == "__main__":
    unittest.main()
