import copy
import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from pipeline.sgsdeck_identity import canonical_id

from pipeline.unified_lookup_identity import (
    freeze_baseline,
    inventory_from_sources,
    validate_registry,
)


PROJECT_ROOT = Path(__file__).resolve().parents[1]


class UnifiedLookupIdentityTest(unittest.TestCase):
    def _actual_contract(self):
        inventory = inventory_from_sources(PROJECT_ROOT)
        registry = json.loads((PROJECT_ROOT / "pipeline" / "lookup-identity.json").read_bytes())
        mapping_bytes = (PROJECT_ROOT / "pipeline" / "sgsdeck-name-map.json").read_bytes()
        mapping = json.loads(mapping_bytes)
        legacy_owners = {
            f"{row['category']}:{row['sourceId']}": canonical_id(
                "hero" if row["category"] == "generals" else "tactic",
                row["canonicalName"],
            )
            for row in mapping["mappings"]
        }
        expected_hashes = {
            "baseline": hashlib.sha256(
                (PROJECT_ROOT / "pipeline" / "lookup-inputs" / "manifest.json").read_bytes()
            ).hexdigest(),
            "source": hashlib.sha256(
                (PROJECT_ROOT / "data" / "sgsdeck" / "manifest.json").read_bytes()
            ).hexdigest(),
            "mapping": hashlib.sha256(mapping_bytes).hexdigest(),
        }
        return inventory, registry, legacy_owners, expected_hashes

    def test_actual_inventory_accounts_for_every_parent_child_and_local_row(self):
        inventory = inventory_from_sources(PROJECT_ROOT)
        self.assertEqual(len(inventory["parents"]), 805)
        self.assertEqual(len(inventory["children"]), 708)
        self.assertEqual(len(inventory["local"]), 352)
        self.assertEqual(
            {row["key"] for row in inventory["parents"]},
            {f"{row['category']}:{row['sourceId']}" for row in inventory["parents"]},
        )

    def test_checked_in_registry_covers_snapshot_without_fabricating_legacy_attestation(self):
        inventory = inventory_from_sources(PROJECT_ROOT)
        registry = json.loads((PROJECT_ROOT / "pipeline" / "lookup-identity.json").read_bytes())
        mapping_bytes = (PROJECT_ROOT / "pipeline" / "sgsdeck-name-map.json").read_bytes()
        mapping = json.loads(mapping_bytes)
        legacy_owners = {
            f"{row['category']}:{row['sourceId']}": canonical_id(
                "hero" if row["category"] == "generals" else "tactic",
                row["canonicalName"],
            )
            for row in mapping["mappings"]
        }
        expected_hashes = {
            "baseline": hashlib.sha256(
                (PROJECT_ROOT / "pipeline" / "lookup-inputs" / "manifest.json").read_bytes()
            ).hexdigest(),
            "source": hashlib.sha256(
                (PROJECT_ROOT / "data" / "sgsdeck" / "manifest.json").read_bytes()
            ).hexdigest(),
            "mapping": hashlib.sha256(mapping_bytes).hexdigest(),
        }
        validate_registry(
            registry,
            inventory,
            expected_hashes=expected_hashes,
            legacy_source_keys=legacy_owners,
        )
        self.assertEqual(len(mapping["mappings"]), 79)
        self.assertTrue(all(
            set(row) == {"category", "sourceId", "sourceName", "canonicalName", "evidence"}
            for row in mapping["mappings"]
        ))
        self.assertEqual(len(registry["decisions"]), 816)
        self.assertEqual(
            {value: sum(row["disposition"] == value for row in registry["decisions"]) for value in ("matched", "new", "unresolved")},
            {"matched": 260, "new": 556, "unresolved": 0},
        )
        self.assertEqual(len(registry["childIds"]), 618)
        self.assertEqual(len(registry["relationDecisions"]), 324)
        self.assertEqual(sum(row["targetId"] is None for row in registry["relationDecisions"]), 25)

    def test_freeze_baseline_is_exact_and_refuses_tampered_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            source = directory / "historical-source"
            (source / "data").mkdir(parents=True)
            frozen = PROJECT_ROOT / "pipeline" / "lookup-inputs"
            for name in ("heroes-dict.json", "tactics.json"):
                (source / "data" / name).write_bytes((frozen / name).read_bytes())
            output = directory / "lookup-inputs"
            manifest = freeze_baseline(source, output)
            self.assertEqual(manifest["counts"], {"heroes": 112, "tactics": 240})
            self.assertEqual(
                (output / "heroes-dict.json").read_bytes(),
                (frozen / "heroes-dict.json").read_bytes(),
            )
            (output / "heroes-dict.json").write_text("tampered", encoding="utf-8")
            with self.assertRaisesRegex(FileExistsError, "frozen baseline differs"):
                freeze_baseline(PROJECT_ROOT, output)
            self.assertEqual((output / "heroes-dict.json").read_text(encoding="utf-8"), "tampered")

    def test_registry_rejects_two_sources_targeting_one_owner(self):
        inventory = {
            "parents": [
                {"key": "generals:a", "category": "generals", "sourceId": "a", "sourceName": "甲", "fingerprint": "a" * 64},
                {"key": "generals:b", "category": "generals", "sourceId": "b", "sourceName": "乙", "fingerprint": "b" * 64},
            ],
            "children": [],
            "local": [{"key": "hero:existing", "nameVi": "Existing"}],
        }
        decision = {
            "category": "generals",
            "sourceId": "a",
            "sourceName": "甲",
            "inputFingerprint": "a" * 64,
            "disposition": "matched",
            "canonicalId": "hero:existing",
            "nameVi": "Existing",
            "variant": "base",
            "aliasesVi": [],
            "aliasesZh": ["甲"],
            "reasonVi": "Đã đối chiếu",
            "evidence": ["fixture"],
            "reviewer": "test",
            "reviewedAt": "2026-09-13T00:00:00+07:00",
        }
        registry = {
            "schemaVersion": 1,
            "baselineManifestHash": "c" * 64,
            "sourceManifestHash": "d" * 64,
            "existingMap": {"path": "pipeline/sgsdeck-name-map.json", "sha256": "e" * 64},
            "decisions": [decision, {**decision, "sourceId": "b", "sourceName": "乙", "inputFingerprint": "b" * 64}],
            "childIds": [],
            "relationDecisions": [],
        }
        with self.assertRaisesRegex(ValueError, "two source entities resolve to one owner"):
            validate_registry(
                registry,
                inventory,
                expected_hashes={"baseline": "c" * 64, "source": "d" * 64, "mapping": "e" * 64},
            )

    def test_registry_rejects_obsolete_fingerprint(self):
        inventory = {
            "parents": [{"key": "tactics:a", "category": "tactics", "sourceId": "a", "sourceName": "甲", "fingerprint": "a" * 64}],
            "children": [],
            "local": [],
        }
        registry = {
            "schemaVersion": 1,
            "baselineManifestHash": "c" * 64,
            "sourceManifestHash": "d" * 64,
            "existingMap": {"path": "pipeline/sgsdeck-name-map.json", "sha256": "e" * 64},
            "decisions": [{
                "category": "tactics", "sourceId": "a", "sourceName": "甲",
                "inputFingerprint": "f" * 64, "disposition": "unresolved",
                "canonicalId": None, "nameVi": None, "variant": None,
                "aliasesVi": [], "aliasesZh": ["甲"], "reasonVi": "Chưa đủ bằng chứng",
                "evidence": ["fixture"], "reviewer": "test",
                "reviewedAt": "2026-09-13T00:00:00+07:00",
            }],
            "childIds": [],
            "relationDecisions": [],
        }
        with self.assertRaisesRegex(ValueError, "obsolete fingerprint"):
            validate_registry(
                registry,
                inventory,
                expected_hashes={"baseline": "c" * 64, "source": "d" * 64, "mapping": "e" * 64},
            )

    def test_registry_rejects_schema_identity_child_and_relation_tampering(self):
        inventory, registry, legacy_owners, expected_hashes = self._actual_contract()
        candidates = []

        candidate = copy.deepcopy(registry)
        candidate["schemaVersion"] = True
        candidates.append(("boolean schema version", candidate))

        candidate = copy.deepcopy(registry)
        candidate["decisions"][0]["evidence"] = [""]
        candidates.append(("empty evidence", candidate))

        candidate = copy.deepcopy(registry)
        candidate["decisions"][0]["aliasesZh"] = [""]
        candidates.append(("empty alias", candidate))

        candidate = copy.deepcopy(registry)
        resolved = next(row for row in candidate["decisions"] if row["canonicalId"])
        resolved["nameVi"] = "甲"
        candidates.append(("CJK Vietnamese name", candidate))

        candidate = copy.deepcopy(registry)
        resolved = next(row for row in candidate["decisions"] if row["canonicalId"])
        resolved["canonicalId"] += "-changed"
        candidates.append(("name and ID disagreement", candidate))

        candidate = copy.deepcopy(registry)
        co = next(row for row in candidate["decisions"] if row["variant"] == "co")
        co["nameVi"] = co["nameVi"].removeprefix("CO ")
        co["canonicalId"] = canonical_id("hero", co["nameVi"])
        candidates.append(("CO display prefix removed", candidate))

        candidate = copy.deepcopy(registry)
        tactic_decision = next(row for row in candidate["decisions"] if row["category"] == "tactics")
        legacy_tactic = next(
            (key, owner)
            for key, owner in legacy_owners.items()
            if key.startswith("tactics:")
        )
        legacy_name = next(
            row["nameVi"] for row in inventory["local"] if row["key"] == legacy_tactic[1]
        )
        tactic_decision.update(
            disposition="matched",
            canonicalId=legacy_tactic[1],
            nameVi=legacy_name,
        )
        candidates.append(("collision with legacy owner", candidate))

        candidate = copy.deepcopy(registry)
        troop_child = next(row for row in candidate["childIds"] if row["kind"] == "troop-option")
        troop_child["id"] = troop_child["id"].split(":", 2)[0] + ":" + troop_child["id"].split(":", 2)[1] + ":../../private"
        candidates.append(("path-unsafe child suffix", candidate))

        candidate = copy.deepcopy(registry)
        candidate["childIds"][0]["id"] = "hero:wrong-child"
        candidates.append(("wrong child namespace", candidate))

        candidate = copy.deepcopy(registry)
        candidate["relationDecisions"].pop()
        candidates.append(("missing relation decision", candidate))

        candidate = copy.deepcopy(registry)
        candidate["relationDecisions"][0]["fieldPath"] = "lookup.arbitrary"
        candidates.append(("arbitrary relation field", candidate))

        candidate = copy.deepcopy(registry)
        candidate["relationDecisions"][0]["inputFingerprint"] = "0" * 64
        candidates.append(("stale relation fingerprint", candidate))

        candidate = copy.deepcopy(registry)
        direct_special = next(
            row for row in inventory["children"]
            if row["kind"] == "equipment-special"
            and row["parentSourceId"] != "unresolved"
        )
        direct_owner = next(
            row["canonicalId"] for row in candidate["decisions"]
            if row["category"] == "equipment-special"
            and row["sourceId"] == direct_special["sourceId"]
        )
        direct_relation = copy.deepcopy(candidate["relationDecisions"][0])
        direct_relation.update(ownerId=direct_owner, fieldPath="equipmentId")
        candidate["relationDecisions"].append(direct_relation)
        candidates.append(("name ledger overriding direct equipment parent", candidate))

        candidate = copy.deepcopy(registry)
        tactic_relation = next(
            row for row in candidate["relationDecisions"]
            if row["fieldPath"] == "lookup.inheritTacticId"
        )
        tactic_relation["targetId"] = next(
            row["key"] for row in inventory["local"] if row["kind"] == "hero"
        )
        candidates.append(("cross-kind relation target", candidate))

        for label, candidate in candidates:
            with self.subTest(label), self.assertRaises(ValueError):
                validate_registry(
                    candidate,
                    inventory,
                    expected_hashes=expected_hashes,
                    legacy_source_keys=legacy_owners,
                )

    def test_review_report_accounts_for_every_frozen_local_identity(self):
        report = json.loads((PROJECT_ROOT / "pipeline" / "lookup-review-report.json").read_bytes())
        rows = report["localInventory"]
        self.assertEqual(len(rows), 352)
        self.assertEqual(len({row["canonicalId"] for row in rows}), 352)
        self.assertEqual(
            sum(row["disposition"] == "preserved-local-only" for row in rows),
            13,
        )
        self.assertTrue(all(row["evidence"] and row["fingerprint"] for row in rows))


if __name__ == "__main__":
    unittest.main()
