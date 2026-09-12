import json
import tempfile
import unittest
from pathlib import Path

from pipeline.build_recommended_reference import apply_display_map, build_generation, load_display_map, localize_rows
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

    def _display_inputs(self):
        scope_key = "s-" + "2" * 64
        empty_key = "s-" + "3" * 64
        detail = {"sourceConfigId": "a", "nameZh": "隊伍", "heroes": []}
        index_row = {**detail, "safeScopeKey": scope_key, "sourceScopeId": "pk-s28|交戰", "sourceSeasonId": "pk-s28",
                     "sourceSeasonLabel": "PK-S28", "sourceCategoryId": "交戰", "listIndex": 0, "tierOrder": 4}
        inventory = {
            "inventoryHash": "a",
            "seasonOptions": [
                {"sourceSeasonId": "pk-s28", "nameRaw": "九州兵興", "label": "PK-S28", "status": "available", "advertisedCountRaw": 93},
                {"sourceSeasonId": "pk-s01", "nameRaw": "群雄逐鹿", "label": "PK-S1", "status": "uncollected", "advertisedCountRaw": 0},
            ],
            "scopes": [
                {"safeScopeKey": scope_key, "sourceScopeId": "pk-s28|交戰", "sourceSeasonId": "pk-s28", "sourceCategoryId": "交戰", "state": "complete"},
                {"safeScopeKey": empty_key, "sourceScopeId": "pk-s01|交戰", "sourceSeasonId": "pk-s01", "sourceCategoryId": "交戰", "state": "uncollected-season"},
            ],
        }
        inputs = {"inventory": inventory, "records": [index_row], "details": {scope_key: [detail], empty_key: []},
                  "otherTeams": [{"sourceConfigId": "z", "classification": "distinct", "sourceSeasonLabel": "PK-S28"}],
                  "mappingHash": "b", "decisionSnapshotHash": "c", "dedupKeyVersion": 1}
        return inputs, scope_key, empty_key

    def _display_map(self, **overrides):
        payload = {
            "schemaVersion": 1,
            "labels": {"faction": {"魏": "Ngụy"}, "unit": {"騎": "Kỵ"}, "category": {"交戰": "Giao chiến"}, "subcategory": {}},
            "labelEvidence": ["js/render.js"],
            "seasons": [
                {"sourceSeasonId": "pk-s28", "nameRaw": "九州兵興", "displayNameVi": "Cửu Châu Binh Hưng", "displayCode": "PK-S28",
                 "translationStatus": "reference-translation", "evidenceRef": "cache"},
                {"sourceSeasonId": "pk-s01", "nameRaw": "群雄逐鹿", "displayNameVi": "Quần Hùng Trục Lộc", "displayCode": "PK-S1",
                 "translationStatus": "existing-project-name", "evidenceRef": "data/season-registry.json"},
            ],
        }
        payload.update(overrides)
        return payload

    def _loaded(self, payload):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "display-map.json"
            path.write_text(json.dumps(payload, ensure_ascii=False))
            return load_display_map(path)

    def test_display_map_publishes_shared_labels_and_preserves_source_identity(self):
        inputs, scope_key, empty_key = self._display_inputs()
        apply_display_map(inputs, self._loaded(self._display_map()))
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            generation = build_generation(inputs, root)["generationId"]
            seasons = json.loads((root / generation / "seasons.json").read_text())
            index = json.loads((root / generation / "index.json").read_text())
            detail = json.loads((root / generation / ("details-" + scope_key + ".json")).read_text())
            other = json.loads((root / generation / "other-teams.json").read_text())
            empty = json.loads((root / generation / ("details-" + empty_key + ".json")).read_text())
        self.assertEqual(seasons["displayLabels"]["category"], {"交戰": "Giao chiến"})
        self.assertEqual([(option["sourceSeasonId"], option["nameRaw"], option["label"], option["displayNameVi"], option["displayCode"], option["translationStatus"])
                          for option in seasons["seasonOptions"]],
                         [("pk-s28", "九州兵興", "PK-S28", "Cửu Châu Binh Hưng", "PK-S28", "reference-translation"),
                          ("pk-s01", "群雄逐鹿", "PK-S1", "Quần Hùng Trục Lộc", "PK-S1", "existing-project-name")])
        self.assertNotIn("displayLabels", seasons["seasonOptions"][0])
        display = {"sourceSeasonNameVi": "Cửu Châu Binh Hưng", "sourceSeasonCode": "PK-S28",
                   "sourceSeasonTranslationStatus": "reference-translation", "sourceCategoryNameVi": "Giao chiến"}
        self.assertEqual({key: index["records"][0][key] for key in display}, display)
        self.assertEqual({key: detail["records"][0][key] for key in display}, display)
        self.assertEqual(index["records"][0]["sourceSeasonId"], "pk-s28")
        self.assertEqual(index["records"][0]["sourceCategoryId"], "交戰")
        self.assertEqual(index["records"][0]["sourceSeasonLabel"], "PK-S28")
        self.assertEqual(empty["records"], [])
        self.assertEqual(other["records"], [{"sourceConfigId": "z", "classification": "distinct", "sourceSeasonLabel": "PK-S28"}])

    def test_display_map_rejects_duplicate_mismatched_and_missing_seasons(self):
        payload = self._display_map()
        duplicate = self._display_map(seasons=[*payload["seasons"], dict(payload["seasons"][0])])
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            self._loaded(duplicate)
        with self.assertRaisesRegex(ValueError, "translation status"):
            self._loaded(self._display_map(seasons=[{**payload["seasons"][0], "translationStatus": "guess"}]))
        inputs, _, _ = self._display_inputs()
        mismatched = [{**payload["seasons"][0], "nameRaw": "九州兵兴"}, payload["seasons"][1]]
        with self.assertRaisesRegex(ValueError, "differs from source"):
            apply_display_map(inputs, self._loaded(self._display_map(seasons=mismatched)))
        inputs, _, _ = self._display_inputs()
        with self.assertRaisesRegex(ValueError, "missing seasons: pk-s01"):
            apply_display_map(inputs, self._loaded(self._display_map(seasons=[payload["seasons"][0]])))

    def test_display_name_change_keeps_identity_and_filter_metadata(self):
        identity = ("sourceSeasonId", "nameRaw", "label", "status", "advertisedCountRaw")
        first, scope_key, _ = self._display_inputs()
        apply_display_map(first, self._loaded(self._display_map()))
        renamed = self._display_map()
        renamed["seasons"][0] = {**renamed["seasons"][0], "displayNameVi": "Chín Châu Binh Hưng", "displayCode": "PK-S28b"}
        second, _, _ = self._display_inputs()
        apply_display_map(second, self._loaded(renamed))
        self.assertEqual([{key: option[key] for key in identity} for option in second["inventory"]["seasonOptions"]],
                         [{key: option[key] for key in identity} for option in first["inventory"]["seasonOptions"]])
        self.assertEqual(second["inventory"]["scopes"], first["inventory"]["scopes"])
        filters = ("sourceConfigId", "safeScopeKey", "sourceScopeId", "sourceSeasonId", "sourceSeasonLabel", "sourceCategoryId", "listIndex")
        self.assertEqual({key: second["records"][0][key] for key in filters}, {key: first["records"][0][key] for key in filters})
        self.assertEqual(second["details"][scope_key][0]["sourceConfigId"], first["details"][scope_key][0]["sourceConfigId"])
        self.assertEqual(second["records"][0]["sourceSeasonNameVi"], "Chín Châu Binh Hưng")
        self.assertEqual(second["records"][0]["sourceSeasonCode"], "PK-S28b")
        self.assertEqual(second["details"][scope_key][0]["sourceSeasonCode"], "PK-S28b")


if __name__ == "__main__":
    unittest.main()
