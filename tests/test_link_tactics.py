"""TDD pipeline/link_tactics.py — normalize + auto-link Hán-Việt -> tên site."""

import unittest

from pipeline import link_tactics as lt


class NormalizeTest(unittest.TestCase):
    def test_strip_diacritics_and_dd(self):
        self.assertEqual(lt.normalize("Bát Môn Kim Tỏa Trận"), "batmonkimtoatran")
        self.assertEqual(lt.normalize("Đoạt Hồn"), "doathon")  # đ -> d
        self.assertEqual(lt.normalize("  MÊ  HOẶC  "), "mehoac")


class AutoLinkTest(unittest.TestCase):
    def setUp(self):
        self.index = lt.build_index([
            "Bát Môn Kim Tỏa Trận", "Mê Hoặc", "Đoạt Hồn Hiệp Phách", "Thịnh Khí Linh Địch",
        ])

    def test_exact_after_normalize(self):
        name, score = lt.auto_link("Bát Môn Kim Tỏa Trận", self.index)
        self.assertEqual(name, "Bát Môn Kim Tỏa Trận")
        self.assertEqual(score, 1.0)

    def test_diacritic_insensitive_exact(self):
        # hán-việt "mị hoặc" vs site "Mê Hoặc" -> khác chữ, không exact.
        name, score = lt.auto_link("Đoạt Hồn Hiệp Phách", self.index)
        self.assertEqual(name, "Đoạt Hồn Hiệp Phách")
        self.assertEqual(score, 1.0)

    def test_fuzzy_threshold(self):
        # gần (thiếu 1 ký tự thật sự) -> fuzzy match trên ngưỡng.
        name, score = lt.auto_link("Bát Môn Kim Tỏ Trận", self.index)
        self.assertEqual(name, "Bát Môn Kim Tỏa Trận")
        self.assertGreaterEqual(score, lt.FUZZY_THRESHOLD)
        self.assertLess(score, 1.0)

    def test_no_match(self):
        name, score = lt.auto_link("Yến Nhân Bào Hao", self.index)
        self.assertIsNone(name)
        self.assertEqual(score, 0.0)


class LinkRecordsTest(unittest.TestCase):
    def test_report_buckets(self):
        records = [
            {"chinese": "八门金锁阵", "hanViet": "Bát Môn Kim Tỏa Trận"},
            {"chinese": "燕人咆哮", "hanViet": "Yến Nhân Bào Hao"},
        ]
        report = lt.link_records(records, ["Bát Môn Kim Tỏa Trận"])
        self.assertEqual(records[0]["viet"], "Bát Môn Kim Tỏa Trận")
        self.assertEqual(records[0]["linkScore"], 1.0)
        self.assertEqual(records[1]["viet"], "Yến Nhân Bào Hao")  # nomatch -> giữ hán-việt
        self.assertEqual(len(report["matched"]), 1)
        self.assertEqual(len(report["nomatch"]), 1)


if __name__ == "__main__":
    unittest.main()
