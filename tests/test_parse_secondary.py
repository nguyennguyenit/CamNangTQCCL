"""Test parser phụ: khaihoang (mỏ + đội thủ) và coexist (nhóm + đội con)."""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pipeline.parse_coexist import group_coexist, parse_coexist  # noqa: E402
from pipeline.parse_khaihoang import _split_enemy, parse_khaihoang  # noqa: E402

BASE = os.path.join(os.path.dirname(__file__), "..", "Meta Team PK")


class TestKhaiHoang(unittest.TestCase):
    def test_split_enemy(self):
        e = _split_enemy("Quách Dĩ(Kỵ)")
        self.assertEqual(e, {"hero": "Quách Dĩ", "unitType": "Kỵ"})

    @unittest.skipUnless(os.path.exists(os.path.join(BASE, "Khai hoang.html")), "missing")
    def test_real_mines(self):
        mines = parse_khaihoang(os.path.join(BASE, "Khai hoang.html"))
        self.assertEqual(len(mines), 5)
        self.assertEqual(mines[0]["name"], "Mỏ 4")
        self.assertEqual(len(mines[0]["enemies"]), 8)
        self.assertTrue(all(e["unitType"] for e in mines[0]["enemies"]))


class TestCoexist(unittest.TestCase):
    @unittest.skipUnless(os.path.exists(os.path.join(BASE, "Team Cùng Tồn.html")), "missing")
    def test_real_groups(self):
        teams = parse_coexist(os.path.join(BASE, "Team Cùng Tồn.html"))
        self.assertGreater(len(teams), 0)
        groups = group_coexist(teams)
        self.assertGreater(len(groups), 1)
        # các nhóm phải mang nhãn thật "Cùng tồn N", không gộp hết vào "Khác"
        labels = [g["groupLabel"] for g in groups]
        self.assertTrue(
            all(lbl.startswith("Cùng tồn") for lbl in labels),
            f"nhãn nhóm không hợp lệ: {labels}",
        )
        self.assertEqual(len(set(labels)), len(labels), "nhãn nhóm bị trùng")
        # mỗi nhóm phải có summary mô tả + ít nhất 1 đội con
        for g in groups:
            self.assertTrue(g["teams"], f"nhóm {g['groupLabel']} rỗng")
            self.assertTrue(g.get("summary"), f"nhóm {g['groupLabel']} thiếu summary")
        # mỗi đội con có ít nhất 1 tướng + tên không phải chữ cái đơn
        for t in teams:
            self.assertTrue(t["heroes"])
            self.assertGreater(len(t["teamName"]), 1)


if __name__ == "__main__":
    unittest.main()
