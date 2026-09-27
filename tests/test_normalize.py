"""Test normalize: split_variants, parse_hero, split_counters, classify, alias."""

import os
import sys
import unittest
import unicodedata

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

    def test_mix_formation_overrides_faction(self):
        aliases = {"heroes": {}, "tactics": {}, "books": {}}
        # team có banner "Quần" nhưng dùng Tam Thế Trận -> Hỗn hợp
        raw = {
            "source": "moi-phe",
            "rawType": "Cung",
            "bannerFaction": "Quần",
            "heroesRaw": [
                {"nameRaw": "Lữ Bố", "cp1Raw": "Tam Thế Trận", "cp2Raw": "", "booksRaw": []},
            ],
        }
        team = normalize.normalize_team(raw, aliases, "team-intro-0")
        self.assertEqual(team["faction"], "Hỗn hợp")

    def test_no_mix_formation_keeps_faction(self):
        aliases = {"heroes": {}, "tactics": {}, "books": {}}
        raw = {
            "source": "moi-phe",
            "rawType": "Cung",
            "bannerFaction": "Thục",
            "heroesRaw": [
                {"nameRaw": "Khương Duy", "cp1Raw": "Vô Đương Phi Quân", "cp2Raw": "", "booksRaw": []},
            ],
        }
        team = normalize.normalize_team(raw, aliases, "team-intro-0")
        self.assertEqual(team["faction"], "Thục")

    def test_auto_team_name_last_syllable(self):
        self.assertEqual(
            normalize.auto_team_name(["Cam Ninh", "Thái Sử Từ", "Chu Thái"]),
            "Ninh Từ Thái",
        )

    def test_nickname_key_order_independent(self):
        self.assertEqual(
            normalize._nickname_key(["Cam Ninh", "Thái Sử Từ", "Chu Thái"]),
            normalize._nickname_key(["Chu Thái", "Cam Ninh", "Thái Sử Từ"]),
        )

    def test_normalize_team_name_and_nickname(self):
        aliases = {"heroes": {}, "tactics": {}, "books": {}}
        nicks = normalize.load_nicknames(
            os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "pipeline", "team-nicknames.json")
        )
        raw = {
            "source": "team-intro",
            "rawType": "Cung",
            "heroesRaw": [
                {"nameRaw": "Cam Ninh", "cp1Raw": "", "cp2Raw": "", "booksRaw": []},
                {"nameRaw": "Thái Sử Từ", "cp1Raw": "", "cp2Raw": "", "booksRaw": []},
                {"nameRaw": "Chu Thái", "cp1Raw": "", "cp2Raw": "", "booksRaw": []},
            ],
        }
        team = normalize.normalize_team(raw, aliases, "team-intro-0", nicks)
        self.assertEqual(team["name"], "Ninh Từ Thái")
        self.assertEqual(team["nickname"], "Hổ Thần Cung")

    def test_normalize_team_nickname_none_when_absent(self):
        aliases = {"heroes": {}, "tactics": {}, "books": {}}
        raw = {
            "source": "team-intro",
            "rawType": "Kỵ",
            "heroesRaw": [
                {"nameRaw": "Quan Vũ", "cp1Raw": "", "cp2Raw": "", "booksRaw": []},
            ],
        }
        team = normalize.normalize_team(raw, aliases, "team-intro-0", {})
        self.assertEqual(team["name"], "Vũ")
        self.assertIsNone(team["nickname"])


class TestSourceTextRepair(unittest.TestCase):
    """HTML export có dấu thanh thừa (U+0323) và dạng Unicode khác nhau."""

    def test_drops_stray_tone_mark_after_toned_syllable(self):
        # Ký tự dựng sẵn đã mang dấu thanh, theo sau là dấu nặng kết hợp gõ thừa.
        self.assertEqual(normalize.clean_text("Giả H\u1ee7\u0323(S)"), "Giả Hủ(S)")
        self.assertEqual(normalize.clean_text("Lục T\u1ed1n\u0323(S)"), "Lục Tốn(S)")
        self.assertEqual(normalize.clean_text("Lỗ T\u00fac\u0323(S)"), "Lỗ Túc(S)")

    def test_decomposed_text_becomes_nfc(self):
        self.assertEqual(
            normalize.clean_text(unicodedata.normalize("NFD", "Tôn Thượng Hương")),
            "Tôn Thượng Hương",
        )

    def test_single_tone_mark_is_kept(self):
        # "Thiẹu" là typo đặt sai dấu (một dấu thanh) -> để alias xử lý, không tự sửa.
        self.assertEqual(normalize.clean_text("SP Viên Thi\u1eb9u"), "SP Viên Thi\u1eb9u")
        self.assertEqual(normalize.clean_text("Giả Hư"), "Giả Hư")

    def test_parse_hero_repairs_display_name_and_base(self):
        h = normalize.parse_hero("Giả H\u1ee7\u0323(S)")
        self.assertEqual(h["name"], "Giả Hủ(S)")
        self.assertEqual(h["baseName"], "Giả Hủ")
        self.assertEqual(h["variant"], "S")


def _hero(name, cp1="", cp2=""):
    return {"nameRaw": name, "cp1Raw": cp1, "cp2Raw": cp2, "booksRaw": []}


class TestNormalizeTeamSourceFixes(unittest.TestCase):
    def test_hero_name_fix_rewrites_display_name_but_base_alias_does_not(self):
        aliases = {
            "heroes": {"Giả Hư": "Giả Hủ"},
            "heroNames": {"Hoàng Phổ Tung": "Hoàng Phủ Tung"},
            "tactics": {},
            "books": {},
        }
        raw = {"source": "team-intro", "rawType": "Thương",
               "heroesRaw": [_hero("SP Hoàng Phổ Tung"), _hero("Giả Hư")]}
        team = normalize.normalize_team(raw, aliases, "team-intro-0")
        self.assertEqual(
            [(h["name"], h["baseName"], h["isSP"]) for h in team["heroes"]],
            [("SP Hoàng Phủ Tung", "Hoàng Phủ Tung", True), ("Giả Hư", "Giả Hủ", False)],
        )
        self.assertEqual(team["name"], "Tung Hủ")

    def test_merged_tactic_cell_of_pairs_splits_by_slot(self):
        # Ô CP1+CP2 bị gộp: "A+B/C+D" = lựa chọn (A,B) hoặc (C,D).
        aliases = {"heroes": {}, "tactics": {"Cạo Xương": "Cắt Xương"}, "books": {}}
        merged = "Đương Phong Thôi Quyết+Binh Vô Thường Thế/Huyết Đao Tranh Giành+Cạo Xương"
        raw = {"source": "moi-phe", "rawType": "Thương", "heroesRaw": [_hero("Tôn Quyền", merged, merged)]}
        team = normalize.normalize_team(raw, aliases, "moi-phe-0")
        self.assertEqual(team["heroes"][0]["tactics"], [
            {"name": "Đương Phong Thôi Quyết", "alternatives": ["Huyết Đao Tranh Giành"]},
            {"name": "Binh Vô Thường Thế", "alternatives": ["Cắt Xương"]},
        ])

    def test_plus_in_distinct_cells_is_left_alone(self):
        aliases = {"heroes": {}, "tactics": {}, "books": {}}
        raw = {"source": "moi-phe", "rawType": "Thương", "heroesRaw": [_hero("Tôn Quyền", "A+B", "C")]}
        team = normalize.normalize_team(raw, aliases, "moi-phe-0")
        self.assertEqual(team["heroes"][0]["tactics"], [
            {"name": "A+B", "alternatives": []},
            {"name": "C", "alternatives": []},
        ])


if __name__ == "__main__":
    unittest.main()
