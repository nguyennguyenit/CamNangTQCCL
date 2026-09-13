import json
import subprocess
import unittest

from pipeline import sgsdeck_identity


class SgsdeckIdentityTest(unittest.TestCase):
    def setUp(self):
        self.heroes = [
            {"chinese": "吕蒙", "viet": "Lữ Mông"},
            {"chinese": "SP吕蒙", "viet": "SP Lữ Mông"},
            {"chinese": "無雙呂玲綺", "viet": "CO Lữ Linh Khởi"},
        ]
        self.tactics = [{"chinese": "一身是膽", "viet": "Nhất Thân Thị Đảm"}]

    def test_reviewed_mapping_preserves_variants_and_unmapped_40y(self):
        records = [
            {"sourceId": "base", "nameZh": "呂蒙", "canonicalRef": None, "nameVi": None,
             "verification": {"identity": "unmapped", "vnAvailability": "unverified"}},
            {"sourceId": "sp", "nameZh": "SP 呂蒙", "canonicalRef": None, "nameVi": None,
             "verification": {"identity": "unmapped", "vnAvailability": "unverified"}},
            {"sourceId": "40y", "nameZh": "40Y 呂布", "canonicalRef": None, "nameVi": None,
             "verification": {"identity": "unmapped", "vnAvailability": "unverified"}},
        ]
        mappings = [
            {"category": "generals", "sourceId": "base", "sourceName": "呂蒙", "canonicalName": "Lữ Mông", "evidence": "reviewed"},
            {"category": "generals", "sourceId": "sp", "sourceName": "SP 呂蒙", "canonicalName": "SP Lữ Mông", "evidence": "reviewed"},
        ]
        sgsdeck_identity.apply_reviewed_mappings(
            "generals", records, mappings, self.heroes, self.tactics
        )
        self.assertEqual(records[0]["canonicalRef"], {"kind": "hero", "id": "hero:lu-mong"})
        self.assertEqual(records[1]["canonicalRef"], {"kind": "hero", "id": "hero:sp-lu-mong"})
        self.assertIsNone(records[2]["canonicalRef"])

    def test_rejects_wrong_shape_kind_namespace_or_orphan(self):
        valid_ids = sgsdeck_identity.canonical_corpus(self.heroes, self.tactics)
        bad = [
            "hero:lu-mong",
            {"kind": "tactic", "id": "tactic:nhat-than-thi-dam"},
            {"kind": "hero", "id": "sgsdeck:generals:base"},
            {"kind": "hero", "id": "hero:khong-ton-tai"},
        ]
        for value in bad:
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    sgsdeck_identity.validate_canonical_ref("generals", value, valid_ids)

    def test_python_ids_match_runtime_helpers(self):
        script = (
            'import { canonicalHeroId } from "./js/hero-identity.js";'
            'import { canonicalDictionaryId } from "./mcp-worker/src/data/entity-identity.ts";'
            'console.log(JSON.stringify([canonicalHeroId("SP Lữ Mông"),'
            'canonicalHeroId("40Y Lữ Bố"),'
            'canonicalDictionaryId("tactics", "Nhất Thân Thị Đảm")]));'
        )
        runtime = json.loads(subprocess.check_output(
            ["node", "--experimental-strip-types", "--input-type=module", "--eval", script],
            text=True,
        ))
        self.assertEqual(runtime, [
            sgsdeck_identity.canonical_id("hero", "SP Lữ Mông"),
            sgsdeck_identity.canonical_id("hero", "40Y Lữ Bố"),
            sgsdeck_identity.canonical_id("tactic", "Nhất Thân Thị Đảm"),
        ])

    def test_duplicate_reviewed_mapping_is_rejected(self):
        records = [{
            "sourceId": "same", "nameZh": "呂蒙", "canonicalRef": None,
            "nameVi": None,
            "verification": {"identity": "unmapped", "vnAvailability": "unverified"},
        }]
        mappings = [
            {"category": "generals", "sourceId": "same", "sourceName": "呂蒙", "canonicalName": "Lữ Mông", "evidence": "one"},
            {"category": "generals", "sourceId": "same", "sourceName": "呂蒙", "canonicalName": "SP Lữ Mông", "evidence": "two"},
        ]
        with self.assertRaisesRegex(ValueError, "duplicate reviewed mapping"):
            sgsdeck_identity.apply_reviewed_mappings(
                "generals", records, mappings, self.heroes, self.tactics
            )

    def test_existing_base_ref_cannot_be_used_for_sp_source_variant(self):
        corpus = sgsdeck_identity.canonical_corpus(self.heroes, self.tactics)
        with self.assertRaisesRegex(ValueError, "variant"):
            sgsdeck_identity.validate_record_ref("generals", {
                "nameZh": "SP 呂蒙",
                "nameVi": "Lữ Mông",
                "canonicalRef": {"kind": "hero", "id": "hero:lu-mong"},
            }, corpus)

    def test_reviewed_mapping_must_match_source_name_and_be_used(self):
        record = {
            "sourceId": "base", "nameZh": "呂蒙", "canonicalRef": None,
            "nameVi": None,
            "verification": {"identity": "unmapped", "vnAvailability": "unverified"},
        }
        stale_name = [{
            "category": "generals", "sourceId": "base", "sourceName": "關羽",
            "canonicalName": "Lữ Mông", "evidence": "reviewed",
        }]
        with self.assertRaisesRegex(ValueError, "source name"):
            sgsdeck_identity.apply_reviewed_mappings(
                "generals", [record], stale_name, self.heroes, self.tactics
            )

        unused = [{
            "category": "generals", "sourceId": "missing", "sourceName": "呂蒙",
            "canonicalName": "Lữ Mông", "evidence": "reviewed",
        }]
        with self.assertRaisesRegex(ValueError, "unused reviewed mapping"):
            sgsdeck_identity.apply_reviewed_mappings(
                "generals", [record], unused, self.heroes, self.tactics
            )


if __name__ == "__main__":
    unittest.main()
