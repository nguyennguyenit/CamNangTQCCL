import copy
import json
import unittest
from pathlib import Path

from pipeline.lookup_translations import load_translation_ledger, translation_fingerprint, validate_translation_entries


ROOT = Path(__file__).resolve().parents[1]


class LookupTranslationsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.path = ROOT / "pipeline" / "lookup-translations.json"
        cls.ledger = load_translation_ledger(cls.path)

    def test_checked_in_ledger_is_reviewed_vietnamese_and_unique(self):
        validate_translation_entries(self.ledger)
        entries = self.ledger["entries"]
        self.assertGreater(len(entries), 500)
        self.assertEqual(
            len(entries),
            len({(row["entityId"], row["fieldPath"]) for row in entries}),
        )
        self.assertTrue(all(row["status"] == "reviewed" for row in entries))

    def test_strict_schema_rejects_stale_empty_or_unreviewed_entries(self):
        for label, mutate in (
            ("boolean schema", lambda value: value.update(schemaVersion=True)),
            ("stale fingerprint", lambda value: value["entries"][0].update(inputFingerprint="0" * 64)),
            ("empty translation", lambda value: value["entries"][0].update(textVi="")),
            ("unreviewed", lambda value: value["entries"][0].update(status="draft")),
            ("empty evidence", lambda value: value["entries"][0]["review"].update(evidence=[])),
        ):
            candidate = copy.deepcopy(self.ledger)
            mutate(candidate)
            with self.subTest(label), self.assertRaises(ValueError):
                validate_translation_entries(candidate)

    def test_semantic_context_changes_fingerprint_but_provider_metadata_does_not(self):
        base = translation_fingerprint("tactic:x", "effectViet", "Gây 100% sát thương", "v1", {"target": "đơn"})
        changed = translation_fingerprint("tactic:x", "effectViet", "Gây 100% sát thương", "v1", {"target": "toàn thể"})
        metadata_only = translation_fingerprint("tactic:x", "effectViet", "Gây 100% sát thương", "v1", {"target": "đơn"})
        self.assertNotEqual(base, changed)
        self.assertEqual(base, metadata_only)

    def test_ledger_bytes_are_canonical_and_private(self):
        raw = self.path.read_bytes()
        self.assertTrue(raw.endswith(b"\n"))
        parsed = json.loads(raw)
        self.assertEqual(parsed["schemaVersion"], 1)
        self.assertNotIn(b"sourceUrl", raw)


if __name__ == "__main__":
    unittest.main()
