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
                                "target": "我军兵力最低武将、敌军随机单体",
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
        self.assertEqual(tactics[0]["target"], "我军兵力最低武将、敌军随机单体")
        self.assertEqual(tactics[0]["troopFit"], ["Kỵ", "Khiên"])
        self.assertEqual(tactics[0]["source"], "Bổ sung thủ công")
        self.assertNotIn("pending", tactics[0])


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


if __name__ == "__main__":
    unittest.main()
