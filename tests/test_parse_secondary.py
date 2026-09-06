"""Test parser phụ: khaihoang (mỏ + đội thủ) và coexist (nhóm + đội con)."""

import os
import sys
import tempfile
from pathlib import Path
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pipeline.parse_coexist import group_coexist, parse_coexist  # noqa: E402
from pipeline.parse_khaihoang import (  # noqa: E402
    _split_enemy,
    parse_khaihoang,
    parse_khaihoang_teams,
)

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

    @unittest.skipUnless(os.path.exists(os.path.join(BASE, "Khai hoang.html")), "missing")
    def test_real_teams(self):
        teams = parse_khaihoang_teams(os.path.join(BASE, "Khai hoang.html"))
        self.assertEqual(len(teams), 11)
        for t in teams:
            # mỗi đội đúng 3 tướng + title ghép từ tên tướng
            self.assertEqual(len(t["heroes"]), 3)
            self.assertEqual(t["title"], " · ".join(h["name"] for h in t["heroes"]))
            self.assertIn(t["unitType"], ("Kỵ", "Cung", "Thương", "Khiên"))
            for h in t["heroes"]:
                self.assertTrue(h["name"])
                self.assertTrue(h["tacticsAfter"])  # luôn có chiến pháp sau lv.20
        # đội đầu khớp dữ liệu thật; bảng bên phải độc lập
        first = teams[0]
        self.assertEqual(first["heroes"][0]["name"], "Gia Cát Khác")
        self.assertNotIn("transforms", first)


FIXTURE = Path(__file__).parent / "fixtures" / "khaihoang-cham-su-source.html"


class TestChamSu(unittest.TestCase):
    def test_main_teams_do_not_attach_right_table(self):
        teams = parse_khaihoang_teams(str(FIXTURE))
        self.assertEqual(len(teams), 11)
        self.assertTrue(all("transforms" not in team for team in teams))

    def parse(self, path=FIXTURE):
        from pipeline.parse_khaihoang import parse_cham_su_teams
        return parse_cham_su_teams(str(path))

    def test_source_pairs_and_group_alternatives(self):
        groups = self.parse()
        self.assertEqual([g["title"] for g in groups], [
            "Lữ Mông · Giả Hủ", "Mã Siêu · Hoàng Nguyệt Anh",
            "Trương Nhượng · Hoàng Nguyệt Anh", "Tôn Thượng Hương · Lăng Thống",
            "Thái Sử Từ · Lăng Thống", "Hạ Hầu Uyên · Tào Thuận",
        ])
        self.assertEqual(groups[0]["id"], "lu-mong-gia-hu")
        self.assertEqual(groups[0]["heroes"], [
            {"name": "Lữ Mông", "tactic": "Bạch Mã Nghĩa Tòng"},
            {"name": "Giả Hủ", "tactic": "Ngụy Thư Tương Gian"},
        ])
        self.assertEqual(groups[0]["note"], "Mang 1 lính. Tướng thay thế: Điêu Thuyền, Hoàng Cái, Phùng Kỷ.")
        self.assertEqual(groups[3]["heroes"][1]["tactic"], "Tây Lương Thiết Kỳ")
        for group in groups:
            self.assertEqual(set(group), {"id", "title", "heroes", "note", "sources"})
            self.assertEqual(len(group["heroes"]), 2)
            self.assertTrue(group["note"].startswith("Mang 1 lính."))
            self.assertTrue(group["sources"][0]["label"])
            self.assertIn("gid=562317106", group["sources"][0]["url"])

    def test_right_table_survives_left_boundary_perturbation(self):
        # Perturbation of the real fixture: blank left cells after its first hero.
        # Re-emit the expanded grid so altered left rowspans cannot shift columns.
        from html import escape
        from pipeline.grid_extractor import extract_grid
        grid = extract_grid(str(FIXTURE))
        lines = []
        for index, row in enumerate(grid):
            values = [c.text if index <= 21 or col >= 8 else "" for col, c in enumerate(row)]
            # Keep only origin alternatives; expanded cells are no longer merged.
            if not row[10].origin:
                values[10] = ""
            lines.append("<tr><td>" + str(index) + "</td>" + "".join("<td>" + escape(v) + "</td>" for v in values) + "</tr>")
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "left-boundary-perturbation.html"
            path.write_text("<table>" + "".join(lines) + "</table>")
            self.assertEqual(self.parse(path), self.parse())

    def test_missing_and_empty_right_table(self):
        source = FIXTURE.read_text()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "source.html"
            path.write_text(source.replace("Team Chạm Sứ", "Unrelated table"))
            self.assertEqual(self.parse(path), [])
            path.write_text("<table><tr><td>1</td><td>Team Chạm Sứ------mang 1 lính</td></tr><tr><td>2</td><td>Tướng</td><td>Chiến pháp 1</td><td>Tướng thay thế</td></tr></table>")
            self.assertEqual(self.parse(path), [])

    def test_payload_is_pure_and_deterministic(self):
        from pipeline.build_json import build_khaihoang_payload
        payload = build_khaihoang_payload(str(FIXTURE))
        self.assertEqual(payload, build_khaihoang_payload(str(FIXTURE)))
        self.assertEqual(set(payload), {"teams", "mines", "chamSuTeams"})
        self.assertEqual(len(payload["teams"]), 11)
        self.assertEqual(len(payload["mines"]), 5)
        self.assertEqual(len(payload["mines"][0]["enemies"]), 8)
        self.assertEqual(len(payload["chamSuTeams"]), 6)
        self.assertEqual(len({g["id"] for g in payload["chamSuTeams"]}), 6)


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
