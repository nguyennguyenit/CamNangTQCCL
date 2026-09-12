import json
import tempfile
import unittest
from pathlib import Path

from pipeline.build_recommended_reference import build_generation, localize_rows
from pipeline.recommended_identity import build_mapping


class BuildRecommendedReferenceTest(unittest.TestCase):
    def test_generation_is_deterministic_ranked_and_selected_atomically(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            scope_key = "s-" + "1" * 64
            records = [
                {"sourceConfigId": "b", "safeScopeKey": scope_key, "tierRaw": "T2", "tierOrder": 1, "value": 72, "listIndex": 1, "heroes": []},
                {"sourceConfigId": "a", "safeScopeKey": scope_key, "tierRaw": "T2", "tierOrder": 1, "value": 82, "listIndex": 0, "heroes": []},
            ]
            inputs = {
                "inventory": {"inventoryHash": "a", "seasonOptions": [{"sourceSeasonId": "s", "label": "S", "status": "available"}], "scopes": [{"safeScopeKey": scope_key, "sourceScopeId": "s|交戰", "state": "complete"}]},
                "records": records,
                "details": {scope_key: list(records)}, "otherTeams": [], "mappingHash": "b", "decisionSnapshotHash": "c", "dedupKeyVersion": 1,
            }
            first = build_generation(inputs, root)
            second = build_generation(inputs, root)
            self.assertEqual(first["generationId"], second["generationId"])
            current = json.loads((root / "current.json").read_text())
            self.assertEqual(current["generationId"], first["generationId"])
            index = json.loads((root / first["generationId"] / "index.json").read_text())
            self.assertEqual([row["sourceConfigId"] for row in index["records"]], ["a", "b"])
            before = (root / "current.json").read_bytes()
            inputs["details"][scope_key] = inputs["details"][scope_key][:-1]
            with self.assertRaisesRegex(ValueError, "membership"):
                build_generation(inputs, root)
            self.assertEqual((root / "current.json").read_bytes(), before)

    def test_incomplete_scope_preserves_last_good_selector(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "current.json").write_text('{"old":true}\n')
            before = (root / "current.json").read_bytes()
            with self.assertRaises(ValueError):
                build_generation({"inventory": {"scopes": [{"state": "blocked"}]}}, root)
            self.assertEqual((root / "current.json").read_bytes(), before)

    def test_localization_adds_reviewed_names_only_and_preserves_raw_slots(self):
        mapping = build_mapping([
            {"kind": "hero", "stableId": "hero:1", "variant": "base", "aliases": ["張遼"],
             "displayNameVi": "Trương Liêu", "reviewStatus": "reviewed", "evidenceRef": "heroes-dict.json#1"},
            {"kind": "hero", "stableId": "hero:2", "variant": "base", "aliases": ["未知"],
             "displayNameVi": "Hai", "reviewStatus": "reviewed", "evidenceRef": "heroes-dict.json#2"},
            {"kind": "hero", "stableId": "hero:3", "variant": "base", "aliases": ["未知"],
             "displayNameVi": "Ba", "reviewStatus": "reviewed", "evidenceRef": "heroes-dict.json#3"},
            {"kind": "tactic", "stableId": "tactic:1", "aliases": ["盛氣淩敵"],
             "displayNameVi": "Thịnh Khí Lăng Địch", "reviewStatus": "reviewed", "evidenceRef": "tactics.json#1"},
            {"kind": "book", "stableId": "book:1", "aliases": ["執銳"],
             "displayNameVi": "Cầm Binh Khí", "reviewStatus": "reviewed", "evidenceRef": "books-dict.json#1"},
        ])
        holders = [{"roleRaw": "主將", "nameRaw": "張遼", "tacticSlotsRaw": ["盛氣淩敵", "當鋒摧決"],
                    "bookSlotsRaw": ["執銳", "沖陣", ""]},
                   {"roleRaw": "副將 1", "nameRaw": "未知", "tacticSlotsRaw": ["未錄"], "bookSlotsRaw": []}]
        alternatives = [{"roleRaw": "副將 3", "nameRaw": "張遼", "tacticSlotsRaw": ["未錄"], "bookSlotsRaw": ["執銳"]}]
        detail = {"sourceConfigId": "a", "nameZh": "隊伍", "heroes": holders, "alternativeHoldersRaw": alternatives}
        index_row = {**detail, "safeScopeKey": "s-" + "1" * 64, "listIndex": 0}
        shared, names = {}, {}
        localized_details = localize_rows([detail], mapping, names, shared)
        localized_index = localize_rows([index_row], mapping, names, shared)

        main, second = localized_details[0]["heroes"]
        self.assertEqual(main["displayNameVi"], "Trương Liêu")
        self.assertEqual(main["tacticSlotsVi"], ["Thịnh Khí Lăng Địch", None])
        self.assertEqual(main["bookSlotsVi"], ["Cầm Binh Khí", None, None])
        self.assertEqual(main["tacticSlotsRaw"], ["盛氣淩敵", "當鋒摧決"])
        self.assertEqual(main["bookSlotsRaw"], ["執銳", "沖陣", ""])
        self.assertIsNone(second["displayNameVi"])
        self.assertEqual(second["nameRaw"], "未知")
        self.assertEqual(second["tacticSlotsVi"], [None])
        self.assertEqual(second["bookSlotsVi"], [])
        alternative = localized_details[0]["alternativeHoldersRaw"][0]
        self.assertEqual(alternative["displayNameVi"], "Trương Liêu")
        self.assertEqual(alternative["bookSlotsVi"], ["Cầm Binh Khí"])
        self.assertEqual(localized_index[0]["heroes"], localized_details[0]["heroes"])
        self.assertEqual(detail["heroes"], holders)
        self.assertNotIn("displayNameVi", holders[0])



if __name__ == "__main__":
    unittest.main()
