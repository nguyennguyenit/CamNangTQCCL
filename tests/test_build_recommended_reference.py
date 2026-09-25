import json
import hashlib
import copy
import tempfile
import unittest
from pathlib import Path

from pipeline.build_recommended_reference import (
    _validated_display_notes,
    _validated_raw_display_notes,
    apply_display_map,
    build_generation,
    canonical_object_hash,
    load_display_map,
    localize_rows,
    raw_source_record,
)
from pipeline.recommended_identity import build_display_mapping, build_mapping, resolve_identity

def _publish(inputs, output, *, links=None):
    candidate = copy.deepcopy(inputs)
    admitted = candidate.get("otherTeams") or []
    teams = [{"id": row["legacyTeamId"], "name": "Legacy fixture"} for row in admitted]
    teams_bytes = json.dumps(teams, ensure_ascii=False, separators=(",", ":")).encode()
    decisions = [
        {
            "classification": "distinct",
            "legacyTeamId": row["legacyTeamId"],
            "legacyVariantId": row.get("legacyVariantId"),
        }
        for row in admitted
    ]
    raw_corpus = [
        raw_source_record(row)
        for scope in candidate.get("inventory", {}).get("scopes", [])
        for row in (candidate.get("details") or {}).get(scope.get("safeScopeKey"), [])
    ]
    counts = {name: sum(item["classification"] == name for item in decisions)
              for name in ("distinct", "duplicate", "pendingIdentity", "pendingSource")}
    ledger = {
        "dedupKeyVersion": candidate.get("dedupKeyVersion"),
        "sourceInventoryHash": candidate.get("inventory", {}).get("inventoryHash"),
        "mappingFileSha256": candidate.get("mappingHash"),
        "recommendedCorpusHash": canonical_object_hash(raw_corpus),
        "localTeamsSha256": "sha256:" + hashlib.sha256(teams_bytes).hexdigest(),
        "inputTeamRows": len(decisions),
        "counts": counts,
        "admitted": admitted,
        "decisions": decisions,
    }
    ledger_bytes = json.dumps(ledger).encode()
    candidate["decisionSnapshotHash"] = "sha256:" + hashlib.sha256(ledger_bytes).hexdigest()
    return build_generation(
        candidate,
        output,
        catalog_bytes=CATALOG_BYTES,
        teams_bytes=teams_bytes,
        content_links_bytes=json.dumps({"schemaVersion": 1, "entries": links or []}).encode(),
        ledger_bytes=ledger_bytes,
    )


# Kho Tra cứu mẫu: chỉ đủ để dựng khóa nối, bản ghi fixture không có tướng khớp.
CATALOG_BYTES = json.dumps([{"id": "hero:fixture", "viet": "Tướng mẫu", "hanViet": "Tướng mẫu",
    "chinese": "樣", "aliases": []}], ensure_ascii=False).encode()

class BuildRecommendedReferenceTest(unittest.TestCase):
    def test_generation_is_deterministic_ranked_and_selected_atomically(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            scope_key = "s-" + "1" * 64
            records = [
                {"sourceConfigId": "b", "safeScopeKey": scope_key, "sourceScopeId": "s|交戰", "sourceSeasonId": "s", "sourceSeasonLabel": "S", "sourceCategoryId": "交戰", "tierRaw": "T2", "tierOrder": 4, "value": 72, "listIndex": 1, "heroes": []},
                {"sourceConfigId": "a", "safeScopeKey": scope_key, "sourceScopeId": "s|交戰", "sourceSeasonId": "s", "sourceSeasonLabel": "S", "sourceCategoryId": "交戰", "tierRaw": "T2", "tierOrder": 4, "value": 82, "listIndex": 0, "heroes": []},
            ]
            inputs = {
                "inventory": {"inventoryHash": "a", "seasonOptions": [{"sourceSeasonId": "s", "label": "S", "status": "available"}], "scopes": [{"safeScopeKey": scope_key, "sourceScopeId": "s|交戰", "sourceSeasonId": "s", "sourceCategoryId": "交戰", "state": "complete"}]},
                "records": records,
                "details": {scope_key: list(records)}, "otherTeams": [], "mappingHash": "b", "decisionSnapshotHash": "c", "dedupKeyVersion": 1,
            }
            first = _publish(inputs, root)
            second = _publish(inputs, root)
            self.assertEqual(first["generationId"], second["generationId"])
            current = json.loads((root / "current.json").read_text())
            self.assertEqual(current["generationId"], first["generationId"])
            index = json.loads((root / first["generationId"] / "index.json").read_text())
            self.assertEqual([row["sourceConfigId"] for row in index["records"]], ["a", "b"])
            before = (root / "current.json").read_bytes()
            rogue = copy.deepcopy(inputs)
            rogue["details"]["s-" + "2" * 64] = []
            with self.assertRaisesRegex(ValueError, "scope inventory"):
                _publish(rogue, root)
            forged = copy.deepcopy(inputs)
            forged["records"][0]["tierRaw"] = "T0"
            with self.assertRaisesRegex(ValueError, "tier order|raw lineage"):
                _publish(forged, root)
            inputs["details"][scope_key] = inputs["details"][scope_key][:-1]
            with self.assertRaisesRegex(ValueError, "lineage|membership"):
                _publish(inputs, root)
            self.assertEqual((root / "current.json").read_bytes(), before)

    def test_incomplete_scope_preserves_last_good_selector(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "current.json").write_text('{"old":true}\n')
            before = (root / "current.json").read_bytes()
            with self.assertRaises(ValueError):
                _publish({"inventory": {"scopes": [{"state": "blocked"}]}}, root)
            self.assertEqual((root / "current.json").read_bytes(), before)

    def test_localization_adds_reviewed_names_only_and_preserves_raw_slots(self):
        mapping = build_display_mapping([
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
            {"kind": "team", "aliases": ["隊伍"], "displayNameVi": "Đội Ngũ",
             "reviewStatus": "translation-reviewed", "evidenceRef": "fixture:team"},
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

        self.assertEqual(localized_details[0]["displayNameVi"], "Đội Ngũ")
        self.assertEqual(localized_index[0]["displayNameVi"], "Đội Ngũ")
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

    def test_bond_in_source_tactic_slot_is_classified_without_rewriting_evidence(self):
        mapping = build_display_mapping([
            {"kind": "bond", "aliases": ["桃園結義"], "displayNameVi": "Kết Nghĩa Vườn Đào",
             "reviewStatus": "translation-reviewed", "evidenceRef": "user:bond"},
        ])
        raw_holder = {"nameRaw": "劉備", "tacticSlotsRaw": ["桃園結義", "未知戰法"], "bookSlotsRaw": []}
        rows = [{"sourceConfigId": "bond-source", "heroes": [raw_holder], "alternativeHoldersRaw": [raw_holder]}]
        before = json.loads(json.dumps(rows))
        translated = localize_rows(rows, mapping)
        for field in ("heroes", "alternativeHoldersRaw"):
            holder = translated[0][field][0]
            self.assertEqual(holder["tacticSlotKinds"], ["bond", "tactic"])
            self.assertEqual(holder["tacticSlotsVi"], ["Kết Nghĩa Vườn Đào", None])
            self.assertEqual(holder["tacticSlotsRaw"], ["桃園結義", "未知戰法"])
        self.assertEqual(rows, before)
        self.assertEqual(resolve_identity("tactic", "桃園結義", mapping)["status"], "missing")

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
                  "otherTeams": [{"sourceConfigId": "z", "classification": "distinct", "sourceSeasonLabel": "PK-S28",
                                  "legacyTeamId": "legacy-z", "legacyVariantId": "variant-z"}],
                  "mappingHash": "b", "decisionSnapshotHash": "c", "dedupKeyVersion": 1}
        return inputs, scope_key, empty_key

    def _display_map(self, **overrides):
        payload = {
            "schemaVersion": 1,
            "labels": {"faction": {"魏": "Ngụy"}, "unit": {"騎": "Kỵ"}, "category": {"交戰": "Giao chiến"}, "subcategory": {}},
            "statFocus": {
                "evidenceRef": "user-confirmed:fixture",
                "translations": {
                    "全武": "Toàn Võ Lực",
                    "S盾": "Khiên bậc S",
                },
                "noteValues": ["S盾"],
            },
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
            generation = _publish(inputs, root)["generationId"]
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
        self.assertEqual(other["records"][0]["legacyTeamId"], "legacy-z")
        self.assertEqual(other["records"][0]["legacyContent"]["id"], "legacy-z")

    def test_display_map_localizes_stat_focus_and_rejects_unmapped_chinese(self):
        inputs, scope_key, _ = self._display_inputs()
        holders = [
            {"statFocusRaw": "全武"},
            {"statFocusRaw": "Võ Lực"},
        ]
        alternatives = [{"statFocusRaw": "S盾"}]
        inputs["records"][0]["heroes"] = copy.deepcopy(holders)
        inputs["records"][0]["alternativeHoldersRaw"] = copy.deepcopy(alternatives)
        inputs["details"][scope_key][0]["heroes"] = copy.deepcopy(holders)
        inputs["details"][scope_key][0]["alternativeHoldersRaw"] = copy.deepcopy(alternatives)

        apply_display_map(inputs, self._loaded(self._display_map()))

        published = inputs["records"][0]
        self.assertEqual(published["heroes"][0]["statFocusRaw"], "全武")
        self.assertEqual(published["heroes"][0]["statFocusVi"], "Toàn Võ Lực")
        self.assertEqual(published["heroes"][0]["statFocusKind"], "stat")
        self.assertEqual(published["heroes"][1]["statFocusVi"], "Võ Lực")
        self.assertEqual(published["alternativeHoldersRaw"][0]["statFocusVi"], "Khiên bậc S")
        self.assertEqual(published["alternativeHoldersRaw"][0]["statFocusKind"], "note")
        self.assertEqual(
            inputs["details"][scope_key][0]["heroes"],
            published["heroes"],
        )
        self.assertNotIn("statFocusVi", raw_source_record(published)["heroes"][0])

        missing, _, _ = self._display_inputs()
        missing["records"][0]["heroes"] = [{"statFocusRaw": "未知加點"}]
        with self.assertRaisesRegex(ValueError, "missing stat focus"):
            apply_display_map(missing, self._loaded(self._display_map()))

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

    def test_display_notes_require_reviewed_vietnamese_text(self):
        row = {"heroes": [], "alternativeHoldersRaw": []}
        projection = {
            "schemaVersion": 1,
            "blocks": [{"id": "p-1", "textRaw": "source note", "owner": "team"}],
        }
        self.assertEqual(_validated_raw_display_notes(projection, row), projection)
        with self.assertRaisesRegex(ValueError, "textVi"):
            _validated_display_notes(projection, row)
        projection["blocks"][0]["textVi"] = "Ghi chú đã dịch"
        self.assertEqual(_validated_display_notes(projection, row), projection)

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

    def test_publication_rederives_legacy_content_and_rejects_stale_lineage(self):
        scope = "s-" + "9" * 64
        detail = {
            "sourceConfigId": "source-a",
            "sourceUrl": "https://sgsdeck.com/recommended/source-a",
            "nameZh": "測試隊",
            "value": 113,
            "heroes": [],
            "alternativeHoldersRaw": [],
            "unitTypesRaw": ["弓"],
            "notesRaw": "source note",
            "displayNameVi": "Đội Kiểm Thử",
            "displayNotes": {
                "schemaVersion": 1,
                "blocks": [{"id": "p-1", "textRaw": "source note", "textVi": "Ghi chú nguồn", "owner": "team"}],
            },
        }
        index = {
            **detail,
            "safeScopeKey": scope,
            "sourceScopeId": "s|c",
            "sourceSeasonId": "s",
            "sourceSeasonLabel": "S",
            "sourceCategoryId": "c",
            "listIndex": 0,
        }
        admitted = {
            "classification": "distinct",
            "legacyTeamId": "legacy-a",
            "legacyVariantId": "variant-a",
        }
        inputs = {
            "inventory": {
                "inventoryHash": "inventory",
                "seasonOptions": [{"sourceSeasonId": "s", "label": "S", "status": "available"}],
                "scopes": [{
                    "safeScopeKey": scope,
                    "sourceScopeId": "s|c",
                    "sourceSeasonId": "s",
                    "sourceCategoryId": "c",
                    "state": "complete",
                }],
            },
            "records": [index],
            "details": {scope: [detail]},
            "otherTeams": [admitted],
            "mappingHash": "mapping",
            "decisionSnapshotHash": "ledger",
            "dedupKeyVersion": 1,
        }
        legacy = {"id": "legacy-a", "notes": "legacy note", "counters": {"good": ["A"], "avoid": ["B"]}}
        teams_bytes = json.dumps([legacy], ensure_ascii=False, separators=(",", ":")).encode()
        ledger = {
            "dedupKeyVersion": 1,
            "sourceInventoryHash": "inventory",
            "mappingFileSha256": "mapping",
            "recommendedCorpusHash": canonical_object_hash([raw_source_record(detail)]),
            "localTeamsSha256": "sha256:" + hashlib.sha256(teams_bytes).hexdigest(),
            "inputTeamRows": 1,
            "counts": {"distinct": 1, "duplicate": 0, "pendingIdentity": 0, "pendingSource": 0},
            "admitted": [admitted],
            "decisions": [{**admitted}],
        }
        ledger_bytes = json.dumps(ledger).encode()
        inputs["decisionSnapshotHash"] = "sha256:" + hashlib.sha256(ledger_bytes).hexdigest()
        link = {
            "sourceConfigId": "source-a",
            "legacyTeamId": "legacy-a",
            "legacyVariantId": "variant-a",
            "sourceContentSha256": canonical_object_hash(raw_source_record(detail)),
            "legacyContentSha256": canonical_object_hash(legacy),
            "reviewStatus": "reviewed",
            "evidenceRef": "fixture:exact-review",
        }
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            selector = build_generation(
                inputs,
                root,
                catalog_bytes=CATALOG_BYTES,
                teams_bytes=teams_bytes,
                content_links_bytes=json.dumps({"schemaVersion": 1, "entries": [link]}).encode(),
                ledger_bytes=ledger_bytes,
            )
            generation = root / selector["generationId"]
            published = json.loads((generation / "index.json").read_text())["records"][0]
            other = json.loads((generation / "other-teams.json").read_text())["records"][0]
            self.assertEqual(published["legacyReferences"][0]["legacyContent"], legacy)
            self.assertEqual(other["legacyContent"], legacy)
            manifest = json.loads((generation / "manifest.json").read_text())
            self.assertEqual(manifest["legacyTeamsHash"], ledger["localTeamsSha256"])
            self.assertTrue(manifest["contentLinksHash"].startswith("sha256:"))

            stale = dict(ledger)
            stale["localTeamsSha256"] = "sha256:" + "0" * 64
            with self.assertRaisesRegex(ValueError, "legacy teams bytes differ"):
                build_generation(
                    inputs,
                    root,
                    catalog_bytes=CATALOG_BYTES,
                    teams_bytes=teams_bytes,
                    content_links_bytes=b'{"schemaVersion":1,"entries":[]}',
                    ledger_bytes=json.dumps(stale).encode(),
                )
            stale_link = {**link, "sourceContentSha256": "sha256:" + "0" * 64}
            with self.assertRaisesRegex(ValueError, "source fingerprint"):
                build_generation(
                    inputs,
                    root,
                    catalog_bytes=CATALOG_BYTES,
                    teams_bytes=teams_bytes,
                    content_links_bytes=json.dumps({"schemaVersion": 1, "entries": [stale_link]}).encode(),
                    ledger_bytes=ledger_bytes,
                )
            bad_notes = copy.deepcopy(inputs)
            bad_notes["records"][0].pop("displayNotes")
            bad_notes["details"][scope][0]["displayNotes"] = {
                "schemaVersion": 1,
                "blocks": [{"id": "p-1", "textRaw": "x", "owner": "primary", "holderIndex": 0}],
            }
            with self.assertRaisesRegex(ValueError, "displayNotes"):
                build_generation(
                    bad_notes,
                    root,
                    catalog_bytes=CATALOG_BYTES,
                    teams_bytes=teams_bytes,
                    content_links_bytes=b'{"schemaVersion":1,"entries":[]}',
                    ledger_bytes=ledger_bytes,
                )

            stale_corpus = {**ledger, "recommendedCorpusHash": "sha256:" + "0" * 64}
            stale_corpus_bytes = json.dumps(stale_corpus).encode()
            stale_inputs = copy.deepcopy(inputs)
            stale_inputs["decisionSnapshotHash"] = "sha256:" + hashlib.sha256(stale_corpus_bytes).hexdigest()
            with self.assertRaisesRegex(ValueError, "Recommended corpus differs"):
                build_generation(
                    stale_inputs,
                    root,
                    catalog_bytes=CATALOG_BYTES,
                    teams_bytes=teams_bytes,
                    content_links_bytes=b'{"schemaVersion":1,"entries":[]}',
                    ledger_bytes=stale_corpus_bytes,
                )


if __name__ == "__main__":
    unittest.main()
