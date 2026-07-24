"""TDD pipeline/build_dict.py — generic tactics can carry reviewed details."""

import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from pipeline import build_dict


class MergeGenericTest(unittest.TestCase):
    def test_merge_generic_preserves_optional_reviewed_fields(self):
        with tempfile.TemporaryDirectory() as tmp:
            generic_path = Path(tmp) / "tactics-generic.json"
            generic_path.write_text(
                json.dumps(
                    {
                        "tactics": [
                            {
                                "viet": "Toàn Quân Đồng Lòng",
                                "chinese": "众志成城",
                                "type": "Chỉ huy",
                                "quality": "S",
                                "effect": "战斗中，自身每回合有18%→36%概率",
                                "effectViet": "Mỗi hiệp có xác suất hồi phục và gây sát thương",
                                "target": "我军兵力最低武将、敌军随机单体",
                                "targetViet": "Quân ta ít binh nhất và một quân địch",
                                "troopFit": ["Kỵ", "Khiên"],
                                "source": "Bổ sung thủ công",
                            }
                        ]
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )
            tactics = []

            with mock.patch.object(build_dict, "_GENERIC", str(generic_path)):
                self.assertEqual(build_dict._merge_generic(tactics), 1)

        self.assertEqual(tactics[0]["chinese"], "众志成城")
        self.assertEqual(tactics[0]["hanViet"], "Chúng Chí Thành Thành")
        self.assertEqual(tactics[0]["type"], "Chỉ huy")
        self.assertEqual(tactics[0]["quality"], "S")
        self.assertEqual(tactics[0]["effect"], "战斗中，自身每回合有18%→36%概率")
        self.assertEqual(tactics[0]["effectViet"], "Mỗi hiệp có xác suất hồi phục và gây sát thương")
        self.assertEqual(tactics[0]["target"], "我军兵力最低武将、敌军随机单体")
        self.assertEqual(tactics[0]["targetViet"], "Quân ta ít binh nhất và một quân địch")
        self.assertEqual(tactics[0]["troopFit"], ["Kỵ", "Khiên"])
        self.assertEqual(tactics[0]["source"], "Bổ sung thủ công")
        self.assertNotIn("pending", tactics[0])

    def test_merge_generic_preserves_reviewed_han_viet(self):
        with tempfile.TemporaryDirectory() as tmp:
            generic_path = Path(tmp) / "tactics-generic.json"
            generic_path.write_text(
                json.dumps(
                    {
                        "tactics": [
                            {
                                "viet": "Nhanh Trí Động Não",
                                "chinese": "灵机一动",
                                "hanViet": "Linh Cơ Nhất Động",
                            }
                        ]
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )
            tactics = []

            with mock.patch.object(build_dict, "_GENERIC", str(generic_path)):
                build_dict._merge_generic(tactics)

        self.assertEqual(tactics[0]["hanViet"], "Linh Cơ Nhất Động")


class ApplyOverridesTest(unittest.TestCase):
    def test_apply_overrides_preserves_source_and_adds_vietnamese_fields(self):
        with tempfile.TemporaryDirectory() as tmp:
            overrides_path = Path(tmp) / "tactic-name-overrides.json"
            overrides_path.write_text(
                json.dumps(
                    {
                        "overrides": {
                            "所向披靡": {
                                "viet": "Đánh Đâu Thắng Đó",
                                "conf": "high",
                                "effectViet": "Mô tả Việt",
                                "targetViet": "Tập thể địch",
                            }
                        }
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )
            tactics = [{"chinese": "所向披靡", "effect": "中文描述", "target": "敌军全体"}]

            with mock.patch.object(build_dict, "_OVERRIDES", str(overrides_path)):
                self.assertEqual(build_dict._apply_overrides(tactics), 1)

        self.assertEqual(tactics[0]["effect"], "中文描述")
        self.assertEqual(tactics[0]["target"], "敌军全体")
        self.assertEqual(tactics[0]["effectViet"], "Mô tả Việt")
        self.assertEqual(tactics[0]["targetViet"], "Tập thể địch")


class VerifiedVietnameseMappingTest(unittest.TestCase):
    def test_nhanh_tri_dong_nao_belongs_to_ling_ji_yi_dong(self):
        root = Path(__file__).resolve().parents[1]
        overrides = json.loads(
            (root / "pipeline/tactic-name-overrides.json").read_text(encoding="utf-8")
        )["overrides"]
        generic = json.loads(
            (root / "data/tactics-generic.json").read_text(encoding="utf-8")
        )["tactics"]

        self.assertNotEqual(
            overrides.get("才辩机捷", {}).get("viet"),
            "Nhanh Trí Động Não",
        )
        matches = [item for item in generic if item.get("chinese") == "灵机一动"]
        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0]["viet"], "Nhanh Trí Động Não")
        self.assertEqual(matches[0]["type"], "Chủ động")
        self.assertEqual(matches[0]["troopFit"], ["Kỵ", "Khí giới"])


if __name__ == "__main__":
    unittest.main()
