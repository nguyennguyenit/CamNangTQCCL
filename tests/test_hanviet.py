"""TDD pipeline/hanviet.py — phiên âm Hán-Việt + map chất tướng/phe/binh chủng."""

import unittest

from pipeline import hanviet


class TransliterateTest(unittest.TestCase):
    def test_known_phrases(self):
        # Các cụm đã verify ở spike.
        self.assertEqual(hanviet.transliterate("暴戾无仁"), "bạo lệ vô nhân")
        self.assertEqual(hanviet.transliterate("百骑劫营"), "bách kỵ kiếp doanh")
        self.assertEqual(hanviet.transliterate("夺魂挟魄"), "đoạt hồn hiệp phách")
        self.assertEqual(hanviet.transliterate("八门金锁阵"), "bát môn kim tỏa trận")

    def test_polyphone_locked(self):
        # M4: đa âm chốt theo cộng đồng VN (âm thứ 2).
        self.assertEqual(hanviet.transliterate("摧"), "thôi")  # không phải "tồi"
        self.assertEqual(hanviet.transliterate("武"), "võ")    # không phải "vũ"
        self.assertEqual(hanviet.transliterate("箕"), "cơ")    # không phải "ki"

    def test_title_case(self):
        self.assertEqual(hanviet.to_viet("暴戾无仁"), "Bạo Lệ Vô Nhân")
        self.assertEqual(hanviet.title_case_vn("bát môn kim tỏa trận"), "Bát Môn Kim Tỏa Trận")

    def test_latin_passthrough(self):
        # Tiền tố SP (Latin) giữ nguyên, KHÔNG tính thiếu.
        self.assertEqual(hanviet.transliterate("SP人"), "SP nhân")

    def test_missing_char_fail_loud(self):
        with self.assertRaises(hanviet.MissingCharError):
            hanviet.transliterate("猫")  # ký tự Hán không có trong bảng

    def test_missing_char_collected(self):
        missing = set()
        out = hanviet.transliterate("人猫", missing)
        self.assertIn("猫", missing)
        self.assertEqual(out, "nhân 猫")  # giữ nguyên ký tự thiếu

    def test_compound_reading(self):
        self.assertEqual(hanviet.to_viet("诸葛亮"), "Gia Cát Lượng")
        self.assertEqual(hanviet.to_viet("貂蝉"), "Điêu Thuyền")


class StatFocusTest(unittest.TestCase):
    def test_single_stat(self):
        self.assertEqual(hanviet.stat_focus_vn("智力"), "Trí")
        self.assertEqual(hanviet.stat_focus_vn("速度"), "Tốc")

    def test_quan_prefix(self):
        self.assertEqual(hanviet.stat_focus_vn("全智力"), "Toàn Trí")
        self.assertEqual(hanviet.stat_focus_vn("全武力"), "Toàn Lực")

    def test_empty(self):
        self.assertEqual(hanviet.stat_focus_vn(""), "")


class FactionTroopTest(unittest.TestCase):
    def test_faction(self):
        self.assertEqual(hanviet.faction_vn("魏"), "Ngụy")
        self.assertEqual(hanviet.faction_vn("蜀"), "Thục")
        self.assertEqual(hanviet.faction_vn("吴"), "Ngô")
        self.assertEqual(hanviet.faction_vn("群"), "Quần")

    def test_troops(self):
        self.assertEqual(
            hanviet.troops_vn("骑兵、弓兵、枪兵、盾兵、器械"),
            ["Kỵ", "Cung", "Thương", "Khiên", "Khí giới"],
        )


if __name__ == "__main__":
    unittest.main()
