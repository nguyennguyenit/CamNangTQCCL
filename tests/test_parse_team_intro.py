"""Test parse_team_intro: phân tách team, gắn hero đúng, đếm đúng trên file thật."""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pipeline.grid_extractor import extract_grid_from_html  # noqa: E402
from pipeline.parse_team_intro import parse_team_intro, parse_team_intro_grid  # noqa: E402

BASE = os.path.join(os.path.dirname(__file__), "..", "Meta Team PK")

# Fixture tổng hợp: 2 team, mỗi team 3 tướng; CP có "/", binh thư có tiền tố Tinh·,
# counter dính liền. Đóng mọi rowspan trong phạm vi (rectangular).
FIXTURE = """
<table>
 <tr><td>g</td><td rowspan="3">Thương(★★★★)</td><td>SP Tuân Úc</td><td>Uy Mưu/Vạn Quân</td><td>Tĩnh Tâm</td><td>Tinh·Phong Thi Trận</td><td>Giáp Sắt</td><td></td><td rowspan="3">Chạm:TMY KhiênTránh:Quần Cung</td></tr>
 <tr><td>g</td><td>Trương Liêu</td><td>Bạo Lệ</td><td>Liền Mạch</td><td>Thắng Trận</td><td>Cầm Binh Khí</td><td></td></tr>
 <tr><td>g</td><td>Vương Nguyên Cơ</td><td>Tạm Lánh</td><td>Tốc Chiến</td><td>Khích Lệ</td><td></td><td></td></tr>
 <tr><td>g</td><td rowspan="3">Kỵ</td><td>Lữ Bố</td><td>Nhất Kỵ</td><td>Quỷ Thần</td><td>Thắng Trận</td><td></td><td></td><td rowspan="3">Chạm:Cung</td></tr>
 <tr><td>g</td><td>Quách Gia</td><td>Hổ Báo Kỵ</td><td>Tam Thế</td><td>Rèn Luyện</td><td></td><td></td></tr>
 <tr><td>g</td><td>Hạ Hầu Uyên</td><td>Lõa Y</td><td>Bạo Lệ</td><td>Tốc Chiến</td><td></td><td></td></tr>
</table>
"""


class TestParseTeamIntro(unittest.TestCase):
    def test_fixture_segmentation(self):
        grid = extract_grid_from_html(FIXTURE)
        teams = parse_team_intro_grid(grid, source="fixture")
        self.assertEqual(len(teams), 2)
        t0 = teams[0]
        self.assertEqual(t0["rawType"], "Thương(★★★★)")
        self.assertEqual(len(t0["heroesRaw"]), 3)
        self.assertEqual(t0["heroesRaw"][0]["nameRaw"], "SP Tuân Úc")
        self.assertEqual(t0["heroesRaw"][2]["nameRaw"], "Vương Nguyên Cơ")
        # counter dính giữ nguyên ở raw
        self.assertIn("Tránh:Quần Cung", t0["notesRaw"])
        # hero không tràn sang team kế
        self.assertEqual(teams[1]["heroesRaw"][0]["nameRaw"], "Lữ Bố")

    def test_books_and_cp_raw_preserved(self):
        grid = extract_grid_from_html(FIXTURE)
        teams = parse_team_intro_grid(grid, source="fixture")
        hero = teams[0]["heroesRaw"][0]
        self.assertEqual(hero["cp1Raw"], "Uy Mưu/Vạn Quân")
        self.assertIn("Tinh·Phong Thi Trận", hero["booksRaw"])

    def test_real_counts(self):
        counts = {
            "Team giới thiệu(mới).html": ("team-intro", 50),
            "Team Đô Úy.html": ("do-uy", 12),
            "Meta mỗi phe (cũ).html": ("moi-phe", 110),
        }
        for fname, (src, expected) in counts.items():
            path = os.path.join(BASE, fname)
            if not os.path.exists(path):
                self.skipTest(f"missing {fname}")
            teams = parse_team_intro(path, source=src)
            self.assertEqual(len(teams), expected, f"{fname}: got {len(teams)} expected {expected}")

    def test_real_first_team_marker(self):
        path = os.path.join(BASE, "Team giới thiệu(mới).html")
        if not os.path.exists(path):
            self.skipTest("missing file")
        teams = parse_team_intro(path, source="team-intro")
        self.assertEqual(teams[0]["heroesRaw"][0]["nameRaw"], "SP Tuân Úc")


if __name__ == "__main__":
    unittest.main()
