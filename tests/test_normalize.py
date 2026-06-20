"""Test normalize: split_variants, parse_hero, split_counters, classify, alias."""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pipeline import normalize  # noqa: E402


class TestNormalize(unittest.TestCase):
    def test_split_variants(self):
        v = normalize.split_variants("Uy Mưu Vô Địch/Vạn Quân Đoạt Sư/Thừa Địch Bất Ngu")
        self.assertEqual(v["name"], "Uy Mưu Vô Địch")
        self.assertEqual(v["alternatives"], ["Vạn Quân Đoạt Sư", "Thừa Địch Bất Ngu"])

    def test_split_variants_book_prefix(self):
        v = normalize.split_variants("Tinh·Phong Thi Trận", strip_book_prefix=True)
        self.assertEqual(v["name"], "Phong Thi Trận")

    def test_split_variants_empty(self):
        self.assertIsNone(normalize.split_variants(""))

    def test_parse_hero_sp(self):
        h = normalize.parse_hero("SP Mã Siêu")
        self.assertEqual(h["baseName"], "Mã Siêu")
        self.assertTrue(h["isSP"])

    def test_parse_hero_variant(self):
        h = normalize.parse_hero("Hứa Du (Thương S)")
        self.assertEqual(h["baseName"], "Hứa Du")
        self.assertEqual(h["variant"], "Thương S")

    def test_split_counters_glued(self):
        good, avoid, notes = normalize.split_counters(
            "Chạm:TMY Khiên, Bắc Phạt ThươngTránh:Team Cung các phe"
        )
        self.assertIn("TMY Khiên", good)
        self.assertIn("Bắc Phạt Thương", good)
        self.assertIn("Team Cung các phe", avoid)

    def test_split_counters_conditional_rating(self):
        good, avoid, notes = normalize.split_counters(
            "Chạm: Khiên, KỵTránh:Hổ Thần CungCó Gian Hùng, Viễn Trợ-★★★★★Có Gian Hùng-★★★★☆"
        )
        # rating điều kiện không lọt vào avoid
        self.assertIn("Hổ Thần Cung", avoid)
        self.assertTrue(all("★" not in a for a in avoid))
        self.assertIsNotNone(notes)
        self.assertIn("★", notes)

    def test_classify_dual_unit_stars(self):
        c = normalize.classify("Kỵ/Cung(★★★★☆)")
        self.assertEqual(set(c["unitType"]), {"Kỵ", "Cung"})
        self.assertEqual(c["stars"], 4.5)
        self.assertIsNone(c["faction"])

    def test_classify_no_stars(self):
        c = normalize.classify("Thương")
        self.assertIsNone(c["stars"])
        self.assertEqual(c["unitType"], ["Thương"])

    def test_classify_faction_whitelist(self):
        self.assertEqual(normalize.classify("Cung Thục")["faction"], "Thục")
        # "Tam Thế" không phải phe -> null
        self.assertIsNone(normalize.classify("Tam Thế")["faction"])

    def test_classify_status_hint(self):
        self.assertEqual(normalize.classify("Thương", "out-meta")["status"], "out-meta")

    def test_alias_applied(self):
        table = {"tactics": {"Thịnh Khí Lăng Địch": "Thịnh Khí Linh Địch"}}
        v = normalize.split_variants("Thịnh Khí Lăng Địch", table["tactics"])
        self.assertEqual(v["name"], "Thịnh Khí Linh Địch")


if __name__ == "__main__":
    unittest.main()
