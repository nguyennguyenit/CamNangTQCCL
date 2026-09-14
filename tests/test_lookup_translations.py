import copy
import json
import unittest
import subprocess
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
    def test_rejects_extended_han(self):
        rejected = [
            "\u2f00",
            "\U00016fe2",
            "\U00016fe3",
            "\U00016ff0",
            "\U00020000",
            "\U000323b0",
        ]
        accepted = ["A", "Đ", "\u2e9a", "\ufa6e", "\U00016fe1", "\U0003347a"]
        samples = rejected + accepted
        script = (
            "const xs=JSON.parse(process.argv[1]);"
            r"process.stdout.write(JSON.stringify(xs.map(x=>/\p{Script=Han}/u.test(x))))"
        )
        result = subprocess.run(
            ["node", "-e", script, json.dumps(samples, ensure_ascii=False)],
            check=False,
            capture_output=True,
            text=True,
        )
        self.assertEqual(
            result.returncode,
            0,
            msg=f"Node Han probe failed before classification:\n{result.stderr}",
        )
        classified = json.loads(result.stdout)
        self.assertEqual(classified, [True] * len(rejected) + [False] * len(accepted))
        for value in rejected:
            candidate = copy.deepcopy(self.ledger)
            candidate["entries"][0]["textVi"] = "Bản dịch chứa " + value
            with self.subTest(codepoint=f"U+{ord(value):X}"), self.assertRaises(ValueError):
                validate_translation_entries(candidate)
        for value in accepted:
            candidate = copy.deepcopy(self.ledger)
            candidate["entries"][0]["textVi"] = "Bản dịch giữ nguyên " + value
            with self.subTest(non_han=f"U+{ord(value):X}"):
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
