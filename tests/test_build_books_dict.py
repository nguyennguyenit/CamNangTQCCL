"""TDD pipeline/build_books_dict.py — bảng map binh thư Hán->Việt (thủ công).

Binh thư game VN dùng tên DỊCH NGHĨA, không Hán-Việt (vd 铁甲->Giáp Sắt), nên
KHÔNG auto-link như tướng/chiến pháp; map bằng bảng thủ công + validate viet in facet.
"""

import json
import os
import unittest

from pipeline import build_books_dict as bbd

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


FACET = [
    "Giáp Sắt", "Phòng Bị", "Tam Quân Chi Chúng", "Rèn Luyện", "Dẫn Quân",
    "Chiến Đấu Trường Kỳ", "Yêu Lính Thương Dân", "Quỷ Mưu",
]


class BuildBooksDictTest(unittest.TestCase):
    def test_map_basic_records(self):
        m = {"铁甲": "Giáp Sắt", "防备": "Phòng Bị"}
        recs = bbd.build_books_dict(m, FACET)
        by_cn = {r["chinese"]: r for r in recs}
        self.assertEqual(by_cn["铁甲"]["viet"], "Giáp Sắt")
        self.assertEqual(by_cn["防备"]["viet"], "Phòng Bị")
        # chinese giữ nguyên
        self.assertIn("铁甲", by_cn)

    def test_viet_must_be_in_facet_fail_loud(self):
        # tên Việt không thuộc facet -> ném (chống map lệch)
        with self.assertRaises(ValueError):
            bbd.build_books_dict({"铁甲": "Tên Bịa Không Có"}, FACET)

    def test_hanviet_omitted_when_chars_missing(self):
        # 锤炼 có ký tự ngoài bảng hanviet -> KHÔNG ship field hanViet
        recs = bbd.build_books_dict({"锤炼": "Rèn Luyện"}, FACET)
        self.assertNotIn("hanViet", recs[0])

    def test_hanviet_present_when_complete(self):
        # 鬼谋 phiên âm sạch -> có hanViet = "Quỷ Mưu"
        recs = bbd.build_books_dict({"鬼谋": "Quỷ Mưu"}, FACET)
        self.assertEqual(recs[0].get("hanViet"), "Quỷ Mưu")

    def test_sorted_by_viet(self):
        m = {"防备": "Phòng Bị", "铁甲": "Giáp Sắt"}
        recs = bbd.build_books_dict(m, FACET)
        viets = [r["viet"] for r in recs]
        self.assertEqual(viets, sorted(viets))

    def test_outside_teams_row_skips_facet_check(self):
        m = {"归心": {"viet": "Quy Thuận", "outsideTeams": True}, "铁甲": "Giáp Sắt"}
        recs = bbd.build_books_dict(m, FACET)
        self.assertEqual([r["viet"] for r in recs], ["Giáp Sắt", "Quy Thuận"])

    def test_outside_teams_flag_rejected_when_book_is_in_facet(self):
        # cờ đã cũ (sách nay có đội dùng) -> ném để gỡ cờ
        with self.assertRaises(ValueError):
            bbd.build_books_dict({"铁甲": {"viet": "Giáp Sắt", "outsideTeams": True}}, FACET)

    def test_real_map_against_real_facets(self):
        with open(os.path.join(_ROOT, "data", "facets.json"), encoding="utf-8") as fh:
            facet_books = [b["value"] for b in json.load(fh)["books"]]
        with open(os.path.join(_ROOT, "data", "books-dict.json"), encoding="utf-8") as fh:
            committed = json.load(fh)
        built = bbd.build_books_dict(bbd._load_map(), facet_books)
        self.assertEqual(
            [(r["chinese"], r["viet"]) for r in built],
            [(r["chinese"], r["viet"]) for r in committed],
        )


if __name__ == "__main__":
    unittest.main()
