"""TDD pipeline/build_dict.py — generic tactics plus the lookup activation fence."""

import hashlib
import json
import os
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from pipeline import build_dict
from pipeline.lookup_translations import canonical_json_bytes

REPO = Path(__file__).resolve().parents[1]
LOCK_RELATIVE = "pipeline/lookup-output/promotion.lock"
LEGACY_HEROES = b'[\n  {\n    "chinese": "\\u5f20\\u98de",\n    "viet": "Tr\\u01b0\\u01a1ng Phi"\n  }\n]\n'
LEGACY_TACTICS = b'[\n  {\n    "chinese": "\\u4f17\\u5fd7\\u6210\\u57ce",\n    "viet": "To\\u00e0n Qu\\u00e2n \\u0110\\u1ed3ng L\\u00f2ng"\n  }\n]\n'


def sha(payload):
    return hashlib.sha256(payload).hexdigest()


def encode(value):
    return (json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")


class MergeGenericTest(unittest.TestCase):
    def test_event_heal_and_domestic_tactic_keep_distinct_names_after_merge(self):
        tactics = [{"chinese": "戮力上国", "viet": "Đồng Lòng Hợp Sức", "type": "Nội chính"}]
        build_dict._apply_overrides(tactics)
        build_dict._merge_generic(tactics)
        matches = [t for t in tactics if t["viet"] == "Đồng Lòng Hợp Sức"]
        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0]["chinese"], "勠力同心")
        self.assertEqual(matches[0]["type"], "Chủ động")
        self.assertIn("51%→102%", matches[0]["effectViet"])
        self.assertEqual(tactics[0]["viet"], "Lục Lực Thượng Quốc")

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


class LookupActivationFenceTest(unittest.TestCase):
    """The legacy writer must never overwrite or desync an activated lookup bundle."""

    def project(self):
        directory = tempfile.TemporaryDirectory(prefix="tqccl-build-dict-")
        self.addCleanup(directory.cleanup)
        root = Path(directory.name)
        (root / "data").mkdir()
        (root / "pipeline" / "lookup-output" / "transactions").mkdir(parents=True)
        shutil.copy(REPO / "data" / "facets.json", root / "data" / "facets.json")
        (root / "data" / "heroes-dict.json").write_bytes(LEGACY_HEROES)
        (root / "data" / "tactics.json").write_bytes(LEGACY_TACTICS)
        (root / "pipeline" / "raw_crawl_cache.json").write_bytes(b"{ this cache must never be read")
        return root

    def activate(self, root):
        payloads = {
            "heroes-dict.json": encode([{"id": "hero:a", "viet": "Tướng A"}]),
            "tactics.json": encode([{"id": "tactic:a", "viet": "Chiến pháp A"}]),
            "lookup-catalog.json": encode({"schemaVersion": 1, "equipment": []}),
        }
        files = {name: sha(payload) for name, payload in payloads.items()}
        payloads["lookup-manifest.json"] = encode({
            "schemaVersion": 1,
            "generationId": "lookup:" + sha(canonical_json_bytes(files)),
            "files": files,
        })
        for name, payload in payloads.items():
            (root / "data" / name).write_bytes(payload)

    def journal(self, root, state):
        transaction = root / "pipeline/lookup-output/transactions/t1"
        transaction.mkdir(parents=True, exist_ok=True)
        (transaction / "journal.json").write_bytes(encode({
            "schemaVersion": 1, "id": "t1", "state": state,
            "generationId": "lookup:" + "0" * 64, "inputHashes": {},
            "activationCodeManifestHash": "0" * 64, "paths": [],
        }))

    def lock(self, root):
        (root / LOCK_RELATIVE).write_bytes(encode({"pid": os.getpid(), "transaction": "t1"}))

    def empty_raw(self, *args, **kwargs):
        return {"tactics": [], "heroes": []}

    def test_activation_state_blocks_the_build_before_any_cache_or_network_read(self):
        for label in ("activated bundle", "promotion lock", "activation-prepared journal", "writing journal"):
            with self.subTest(label):
                root = self.project()
                if label == "activated bundle":
                    self.activate(root)
                elif label == "promotion lock":
                    self.lock(root)
                else:
                    self.journal(root, "activation-prepared" if "prepared" in label else "writing")
                before = {path.name: path.read_bytes() for path in sorted((root / "data").iterdir())}

                with mock.patch.object(build_dict.ct, "crawl_list") as crawl, \
                        mock.patch.object(build_dict.ct, "fetch_detail") as detail, \
                        mock.patch.object(build_dict, "_write_json") as write:
                    with self.assertRaises(RuntimeError):
                        build_dict.build(root=root)

                crawl.assert_not_called()
                detail.assert_not_called()
                write.assert_not_called()
                self.assertEqual({path.name: path.read_bytes() for path in sorted((root / "data").iterdir())}, before)

    def test_genuine_legacy_root_still_publishes_both_dictionaries(self):
        root = self.project()
        self.journal(root, "rolled-back")

        with mock.patch.object(build_dict, "load_raw", self.empty_raw):
            build_dict.build(root=root)

        self.assertEqual(json.loads((root / "data" / "heroes-dict.json").read_bytes()), [])
        self.assertTrue(json.loads((root / "data" / "tactics.json").read_bytes()))

    def test_activation_after_the_guard_aborts_at_the_write_fence(self):
        root = self.project()
        before = {path.name: path.read_bytes() for path in sorted((root / "data").iterdir())}

        def promote_then_return(*args, **kwargs):
            self.activate(root)
            return self.empty_raw()

        with mock.patch.object(build_dict, "load_raw", promote_then_return), \
                mock.patch.object(build_dict, "_write_json") as write:
            with self.assertRaises(RuntimeError):
                build_dict.build(root=root)

        write.assert_not_called()
        self.assertNotEqual({path.name: path.read_bytes() for path in sorted((root / "data").iterdir())}, before)
        self.assertEqual((root / "data" / "heroes-dict.json").read_bytes(),
                         encode([{"id": "hero:a", "viet": "Tướng A"}]))

    def test_dictionary_writes_hold_the_promotion_lock_and_release_it(self):
        root = self.project()
        owners = []
        real_write = build_dict._write_json

        def recording_write(path, payload):
            owners.append(json.loads((root / LOCK_RELATIVE).read_bytes())["pid"])
            return real_write(path, payload)

        with mock.patch.object(build_dict, "load_raw", self.empty_raw), \
                mock.patch.object(build_dict, "_write_json", recording_write):
            build_dict.build(root=root)

        self.assertEqual(owners, [os.getpid(), os.getpid()])
        self.assertFalse((root / LOCK_RELATIVE).exists())


if __name__ == "__main__":
    unittest.main()
