"""Tests for the build-time "Trong cẩm nang" tactic summaries.

Phép đếm kỳ vọng viết tay theo fixture nhỏ; ca biên ghim quy tắc nối (bỏ khoảng trắng chữ Hán, tên Việt
cắt hai đầu), bỏ ô duyên phận, đếm một lần mỗi đội và tham chiếu chéo của cổng publication.
"""
from __future__ import annotations

import copy
import json
import pathlib
import unittest

from pipeline.tactic_summaries import (
    build_tactic_summaries,
    validate_tactic_summaries,
    validate_tactic_summaries_shape,
)


def encode(value):
    return json.dumps(value, ensure_ascii=False).encode()


HEROES = encode([
    {"id": "hero:tao-thao", "chinese": "曹操", "aliases": [], "hanViet": "Tào Tháo", "viet": "Tào Tháo"},
    {"id": "hero:quach-gia", "chinese": "郭嘉", "aliases": [], "hanViet": "Quách Gia", "viet": "Quách Gia"},
])
TACTICS = encode([
    {"id": "tactic:ho-bao-ky", "chinese": "虎豹騎", "aliases": ["虎豹骑"], "hanViet": "Hổ Báo Kỵ", "viet": "Hổ Báo Kỵ"},
    {"id": "tactic:thiet-ky", "chinese": "鐵騎驅馳", "aliases": [], "hanViet": "Thiết Kỵ Khu Trì", "viet": "Thiết Kỵ Khu Trì"},
    {"id": "tactic:trung-1", "chinese": "重名", "aliases": [], "hanViet": "Trùng 1", "viet": "Trùng 1"},
    {"id": "tactic:trung-2", "chinese": "重名", "aliases": [], "hanViet": "Trùng 2", "viet": "Trùng 2"},
])


def member(name, tactics, kinds=None):
    item = {"nameRaw": name, "tacticSlotsRaw": list(tactics)}
    if kinds is not None:
        item["tacticSlotKinds"] = list(kinds)
    return item


def recommended(config_id, heroes, *, value=100):
    return {"sourceConfigId": config_id, "displayNameVi": config_id, "sourceSeasonLabel": "PK-S1", "value": value, "heroes": heroes}


def other(team_id, holders):
    return {"legacyTeamId": team_id, "legacyVariantId": None, "name": team_id, "holders": holders}


RECORDS = [
    # Hổ Báo Kỵ ở hai tướng cùng đội: chỉ đếm một lần, ở vị trí đầu (phó tướng 1).
    recommended("a", [member("曹 操", ["鐵騎驅馳"]), member("郭嘉", ["虎 豹 騎"]), member("無名", ["虎豹骑"])], value=90),
    # Ô duyên phận mang tên chiến pháp không được đếm; ô trùng tên khớp hai ID bị loại.
    recommended("b", [member("曹操", ["虎豹騎", "鐵騎驅馳"], ["tactic", "bond"]), member("郭嘉", ["重名"]), member("無名", ["—"])], value=110),
]
OTHERS = [other("x", [member("Tào Tháo", [" Hổ Báo Kỵ "]), member("Quách Gia", ["Thiết Kỵ Khu Trì"])])]


def build(records=RECORDS, others=OTHERS):
    return build_tactic_summaries(tactic_catalog_bytes=TACTICS, hero_catalog_bytes=HEROES, records=records, other_records=others)


class CountTest(unittest.TestCase):
    def test_counts_positions_carriers_companions_and_teams(self):
        payload = build()
        ho = payload["summaries"]["tactic:ho-bao-ky"]
        self.assertEqual(ho["standard"], {"teams": 2, "positions": [1, 1, 0]})
        self.assertEqual(ho["other"], {"teams": 1, "positions": [1, 0, 0]})
        self.assertEqual(ho["carriers"], [{"heroId": "hero:quach-gia", "teams": 1}, {"heroId": "hero:tao-thao", "teams": 2}][::-1])
        self.assertEqual(ho["companions"], [{"tacticId": "tactic:thiet-ky", "teams": 2}])
        # Điểm giảm dần; Đội khác không điểm xếp cuối.
        self.assertEqual([(team["family"], team.get("sourceConfigId"), team["heroId"]) for team in ho["representative"]],
                         [("recommended", "b", "hero:tao-thao"), ("recommended", "a", "hero:quach-gia"), ("other", None, "hero:tao-thao")])
        thiet = payload["summaries"]["tactic:thiet-ky"]
        self.assertEqual(thiet["standard"], {"teams": 1, "positions": [1, 0, 0]})
        self.assertEqual(thiet["other"], {"teams": 1, "positions": [0, 1, 0]})
        self.assertNotIn("tactic:trung-1", payload["summaries"])

    def test_provenance_records_unmatched_and_ambiguous_slots(self):
        provenance = build()["provenance"]
        self.assertEqual(provenance["unmatchedSlots"], {"recommended": 1, "other": 0})
        self.assertEqual(provenance["ambiguousSlots"], {"recommended": 1, "other": 0})

    def test_catalog_hash_changes_payload(self):
        changed = build_tactic_summaries(tactic_catalog_bytes=TACTICS + b" ", hero_catalog_bytes=HEROES, records=RECORDS, other_records=OTHERS)
        self.assertNotEqual(changed["provenance"]["tacticCatalogSha256"], build()["provenance"]["tacticCatalogSha256"])


class ValidationTest(unittest.TestCase):
    def setUp(self):
        self.payload = build()

    def test_valid_payload_passes_both_gates(self):
        validate_tactic_summaries(self.payload, tactic_catalog_bytes=TACTICS, hero_catalog_bytes=HEROES, records=RECORDS, other_records=OTHERS)

    def test_position_total_mismatch_is_rejected(self):
        broken = copy.deepcopy(self.payload)
        broken["summaries"]["tactic:ho-bao-ky"]["standard"]["teams"] = 5
        with self.assertRaisesRegex(ValueError, "lệch tổng"):
            validate_tactic_summaries_shape(broken, records=RECORDS, other_records=OTHERS)

    def test_representative_outside_source_is_rejected(self):
        foreign = copy.deepcopy(self.payload)
        foreign["summaries"]["tactic:ho-bao-ky"]["representative"][0]["sourceConfigId"] = "khong-co"
        with self.assertRaisesRegex(ValueError, "ngoài nguồn Đội chuẩn"):
            validate_tactic_summaries_shape(foreign, records=RECORDS, other_records=OTHERS)

    def test_rebuild_mismatch_is_rejected(self):
        tampered = copy.deepcopy(self.payload)
        tampered["summaries"]["tactic:ho-bao-ky"]["carriers"] = []
        with self.assertRaisesRegex(ValueError, "tất định"):
            validate_tactic_summaries(tampered, tactic_catalog_bytes=TACTICS, hero_catalog_bytes=HEROES, records=RECORDS, other_records=OTHERS)


class PublishedGenerationTest(unittest.TestCase):
    def test_pinned_generation_matches_deterministic_rebuild(self):
        root = pathlib.Path(__file__).resolve().parents[1]
        current = json.loads((root / "src/data/recommended-reference/current.json").read_text())
        generation = root / "src/data/recommended-reference" / current["generationId"]
        path = generation / "tactic-summaries.json"
        if not path.exists():
            self.skipTest("generation đang pin chưa có tactic-summaries.json")
        validate_tactic_summaries(
            json.loads(path.read_text()),
            tactic_catalog_bytes=(root / "data/tactics.json").read_bytes(),
            hero_catalog_bytes=(root / "data/heroes-dict.json").read_bytes(),
            records=json.loads((generation / "index.json").read_text())["records"],
            other_records=json.loads((generation / "other-teams.json").read_text())["records"],
        )


if __name__ == "__main__":
    unittest.main()
