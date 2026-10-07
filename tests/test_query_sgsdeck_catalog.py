import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from pipeline import query_sgsdeck_catalog


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode()


class QuerySgsdeckCatalogTest(unittest.TestCase):
    def make_snapshot(self, root: Path):
        fetched_at = "2026-09-12T01:00:00+07:00"
        provenance = lambda category: {
            "provider": "sgsdeck", "region": "TW",
            "sourceUrl": f"https://sgsdeck.com/{category}", "fetchedAt": fetched_at,
        }
        base = lambda category, source_id, name, attributes: {
            "id": f"sgsdeck:{category}:{source_id}", "sourceId": source_id,
            "nameZh": name, "nameVi": None, "canonicalRef": None,
            "attributes": attributes, "provenance": provenance(category),
            "sourceSeason": None,
            "verification": {"identity": "unmapped", "vnAvailability": "unverified"},
            "missingFields": [],
        }
        records = {
            "generals": [{
                "id": "sgsdeck:generals:g1",
                "sourceId": "g1",
                "nameZh": "趙雲",
                "nameVi": "Triệu Vân",
                "canonicalRef": {"kind": "hero", "id": "hero:trieu-van"},
                "attributes": {
                    "category": "軍事", "variant": "base", "faction": "SHU",
                    "stars": 5, "cost": 7,
                },
                "provenance": provenance("generals"),
                "sourceSeason": None,
                "verification": {"identity": "matched", "vnAvailability": "unverified"},
                "missingFields": [],
            }],
            "tactics": [base("tactics", "t1", "一身是膽", {
                "quality": "S", "kind": "主動", "source": "事件",
                "effectText": "增傷", "troopLimit": [], "maxUsers": 1,
            })],
            "equipment": [base("equipment", "e1", "丈八蛇矛", {
                "quality": "橙", "slot": "武器",
            })],
            "advisors": [base("advisors", "a1", "仁心得眾", {
                "element": "風", "effectText": "增益", "tacticPoints": 5,
                "generals": [],
            })],
            "troop-mods": [base("troop-mods", "m1", "大戟士", {
                "effectText": "強化", "troopLimit": ["SPEAR"],
                "options": [{"tier": "BASIC", "traitName": "持槍", "description": "提升", "convertsTo": None}],
            })],
            "buildings": [base("buildings", "b1", "君王殿", {
                "maxLevel": 1, "mainCityOnly": True,
                "levels": [{"level": 1, "costs": {"wood": None, "iron": None, "stone": None}, "duration": None, "effect": "核心"}],
            })],
        }
        files = {}
        inventory = {}
        for category in query_sgsdeck_catalog.CATEGORIES:
            category_records = records[category]
            category_inventory = {
                "recordCount": len(category_records),
                "childCount": query_sgsdeck_catalog._child_count(category, category_records),
            }
            value = {
                "schemaVersion": 1, "provider": "sgsdeck", "region": "TW",
                "fetchedAt": fetched_at, "inventory": category_inventory,
                "records": category_records,
            }
            body = encoded(value)
            (root / f"{category}.json").write_bytes(body)
            files[category] = hashlib.sha256(body).hexdigest()
            inventory[category] = value["inventory"]
        (root / "manifest.json").write_bytes(encoded({
            "schemaVersion": 1,
            "provider": "sgsdeck",
            "region": "TW",
            "fetchedAt": fetched_at,
            "inventory": inventory,
            "files": files,
        }))

    def test_complete_snapshot_rejects_an_empty_category(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.make_snapshot(root)
            catalog = json.loads((root / "tactics.json").read_text())
            catalog["records"] = []
            catalog["inventory"] = {"recordCount": 0, "childCount": 0}
            body = encoded(catalog)
            (root / "tactics.json").write_bytes(body)
            manifest = json.loads((root / "manifest.json").read_text())
            manifest["files"]["tactics"] = hashlib.sha256(body).hexdigest()
            manifest["inventory"]["tactics"] = catalog["inventory"]
            (root / "manifest.json").write_bytes(encoded(manifest))
            with self.assertRaisesRegex(ValueError, "empty category"):
                query_sgsdeck_catalog.validate_snapshot(root)

    def test_query_chinese_and_vietnamese_return_same_source_identity_without_network(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.make_snapshot(root)
            with mock.patch("urllib.request.urlopen") as network:
                chinese = query_sgsdeck_catalog.query(root, "generals", "趙雲")
                vietnamese = query_sgsdeck_catalog.query(root, "generals", "trieu van")
                network.assert_not_called()
            self.assertEqual(chinese[0]["id"], vietnamese[0]["id"])
            self.assertEqual(chinese[0]["provenance"]["region"], "TW")

    def test_manifest_mismatch_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.make_snapshot(root)
            with (root / "generals.json").open("ab") as handle:
                handle.write(b" ")
            with self.assertRaisesRegex(ValueError, "checksum mismatch"):
                query_sgsdeck_catalog.query(root, "generals", "趙雲")

    def test_manifest_contract_and_complete_category_set_are_required(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "manifest.json").write_text(json.dumps({
                "schemaVersion": 999,
                "provider": "other",
                "region": "XX",
                "fetchedAt": "bad",
                "inventory": {},
                "files": {},
            }))
            with self.assertRaises(ValueError):
                query_sgsdeck_catalog.validate_snapshot(root)

    def test_missing_ref_and_cross_variant_ref_are_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.make_snapshot(root)
            catalog = json.loads((root / "generals.json").read_text())
            record = catalog["records"][0]
            record.pop("canonicalRef")
            body = encoded(catalog)
            (root / "generals.json").write_bytes(body)
            manifest = json.loads((root / "manifest.json").read_text())
            manifest["files"]["generals"] = hashlib.sha256(body).hexdigest()
            (root / "manifest.json").write_bytes(encoded(manifest))
            with self.assertRaisesRegex(ValueError, "canonicalRef"):
                query_sgsdeck_catalog.query(root, "generals", "趙雲")

            record["canonicalRef"] = {"kind": "hero", "id": "hero:sp-trieu-van"}
            record["nameVi"] = "SP Triệu Vân"
            body = encoded(catalog)
            (root / "generals.json").write_bytes(body)
            manifest["files"]["generals"] = hashlib.sha256(body).hexdigest()
            (root / "manifest.json").write_bytes(encoded(manifest))
            with self.assertRaises(ValueError):
                query_sgsdeck_catalog.query(root, "generals", "趙雲")

    def test_record_identity_provenance_and_inventory_must_reconcile(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.make_snapshot(root)
            catalog = json.loads((root / "generals.json").read_text())
            manifest = json.loads((root / "manifest.json").read_text())
            catalog["records"][0]["id"] = "wrong:namespace"
            catalog["records"][0]["provenance"] = None
            catalog["inventory"] = {"recordCount": 999, "childCount": 999}
            manifest["inventory"]["generals"] = {"recordCount": 999, "childCount": 555}
            body = encoded(catalog)
            (root / "generals.json").write_bytes(body)
            manifest["files"]["generals"] = hashlib.sha256(body).hexdigest()
            (root / "manifest.json").write_bytes(encoded(manifest))
            with self.assertRaises(ValueError):
                query_sgsdeck_catalog.validate_snapshot(root)

    def test_semantically_invalid_attributes_and_identity_state_are_rejected(self):
        mutations = [
            ("numeric general attribute", lambda record: record["attributes"].update({"baseForce": "NOT_A_NUMBER"})),
            ("matched identity without ref", lambda record: record.update({"canonicalRef": None})),
            ("invalid source season", lambda record: record.update({"sourceSeason": {"label": 5}})),
        ]
        for label, mutate in mutations:
            with self.subTest(label=label), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                self.make_snapshot(root)
                catalog = json.loads((root / "generals.json").read_text())
                mutate(catalog["records"][0])
                body = encoded(catalog)
                (root / "generals.json").write_bytes(body)
                manifest = json.loads((root / "manifest.json").read_text())
                manifest["files"]["generals"] = hashlib.sha256(body).hexdigest()
                (root / "manifest.json").write_bytes(encoded(manifest))
                with self.assertRaises(ValueError):
                    query_sgsdeck_catalog.validate_snapshot(root)

    def test_general_guide_document_is_bound_to_its_snapshot_and_pack_table(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.make_snapshot(root)
            manifest_bytes = (root / "manifest.json").read_bytes()
            generals = json.loads((root / "generals.json").read_text())
        valid = {
            "schemaVersion": 1, "provider": "sgsdeck", "region": "TW",
            "fetchedAt": "2026-09-12T01:00:00+07:00",
            "snapshotManifestHash": hashlib.sha256(manifest_bytes).hexdigest(),
            "cardPacks": [{"id": "p1", "nameZh": "名將", "category": "名將卡包", "coreRate": 0.34, "nonCoreRate": 0.66, "sortOrder": 0}],
            "generals": [{"sourceId": "g1", "usage": "必留一個", "cardPacks": [{"packId": "p1", "tier": "core"}]}],
        }
        query_sgsdeck_catalog.validate_guide_document(valid, manifest_bytes, generals)
        row = lambda document: document["generals"][0]
        mutations = [
            ("other snapshot", lambda document: document.update({"snapshotManifestHash": "0" * 64})),
            ("other fetch", lambda document: document.update({"fetchedAt": "2026-10-01T00:00:00+07:00"})),
            ("general missing", lambda document: document.update({"generals": []})),
            ("unknown general", lambda document: row(document).update({"sourceId": "g9"})),
            ("blank usage", lambda document: row(document).update({"usage": " "})),
            ("unknown pack reference", lambda document: row(document)["cardPacks"][0].update({"packId": "p9"})),
            ("unknown tier", lambda document: row(document)["cardPacks"][0].update({"tier": "gold"})),
            ("duplicate pack reference", lambda document: row(document)["cardPacks"].append({"packId": "p1", "tier": "non-core"})),
            ("rate outside 0..1", lambda document: document["cardPacks"][0].update({"coreRate": 34})),
            ("duplicate pack id", lambda document: document["cardPacks"].append(dict(document["cardPacks"][0]))),
            ("extra pack field", lambda document: document["cardPacks"][0].update({"slug": "名將"})),
        ]
        for label, mutate in mutations:
            document = json.loads(json.dumps(valid))
            mutate(document)
            with self.subTest(label=label), self.assertRaises(ValueError):
                query_sgsdeck_catalog.validate_guide_document(document, manifest_bytes, generals)


if __name__ == "__main__":
    unittest.main()
