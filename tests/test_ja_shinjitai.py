"""TDD pipeline/shinjitai.py: vector dùng chung với bộ chuyển JS, và kiểm hợp lệ bảng ký tự."""

import json
import os
import tempfile
import unittest

from pipeline import shinjitai

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _vectors():
    with open(os.path.join(_ROOT, "tests", "fixtures", "shinjitai-vectors.json"), encoding="utf-8") as fh:
        return json.load(fh)["cases"]


class ShinjitaiVectorTests(unittest.TestCase):
    def test_vectors(self):
        cases = _vectors()
        self.assertGreaterEqual(len(cases), 60)
        for case in cases:
            with self.subTest(case["input"]):
                self.assertEqual(shinjitai.to_shinjitai(case["input"]), case["expected"])

    def test_non_string_rejected(self):
        with self.assertRaises(TypeError):
            shinjitai.to_shinjitai(None)

    def test_idempotent_on_vectors(self):
        for case in _vectors():
            with self.subTest(case["input"]):
                self.assertEqual(shinjitai.to_shinjitai(case["expected"]), case["expected"])


class VariantTableTests(unittest.TestCase):
    def test_shipped_table_is_valid(self):
        table = shinjitai.load_variants()
        self.assertGreater(len(table), 400)
        self.assertEqual(table["關"], "関")
        for kept in "禦龍當聯":
            self.assertNotIn(kept, table)

    def _table_file(self, payload):
        handle = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8")
        self.addCleanup(os.unlink, handle.name)
        json.dump(payload, handle, ensure_ascii=False)
        handle.close()
        return handle.name

    def test_rejects_chained_self_and_multichar_entries(self):
        for bad in ({"關": "関", "関": "関々"}, {"a": "a"}, {"關": "関", "関": "x"}, {"關關": "関"}, {}):
            with self.subTest(bad):
                with self.assertRaises(shinjitai.ShinjitaiTableError):
                    shinjitai.load_variants(self._table_file({"map": bad}))

    def test_missing_file_is_error(self):
        with self.assertRaises(shinjitai.ShinjitaiTableError):
            shinjitai.load_variants("/nonexistent/table.json")


if __name__ == "__main__":
    unittest.main()
