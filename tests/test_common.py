"""pipeline/common.py — the canonical JSON every Recommended/season hash is computed over."""

import math
import unittest

from pipeline.common import canonical_json


class CanonicalJsonTest(unittest.TestCase):
    def test_hash_input_is_sorted_compact_and_keeps_vietnamese(self):
        self.assertEqual(canonical_json({"b": [1, 2], "a": "Đội"}), '{"a":"Đội","b":[1,2]}')

    def test_non_finite_numbers_are_rejected_instead_of_emitting_invalid_json(self):
        for value in (math.nan, math.inf):
            with self.assertRaises(ValueError):
                canonical_json({"score": value})


if __name__ == "__main__":
    unittest.main()
