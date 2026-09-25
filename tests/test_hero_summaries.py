"""Tests for the build-time "Trong cẩm nang" hero summaries (Phase 7).

Nguồn đếm độc lập ở đây cố tình viết theo cách khác `pipeline/hero_summaries.py` (vòng lặp trực tiếp, không
dùng chỉ mục khóa) để so chéo; ca biên ghim cả hai quy tắc nối của plan.md quyết định #12.
"""
from __future__ import annotations

import json
import unittest

from pipeline.hero_summaries import (
    build_hero_summaries,
    match_identity,
    validate_hero_summaries,
    validate_hero_summaries_shape,
)


def hero(identifier, *, chinese="", aliases=(), han_viet="", viet=None):
    return {
        "id": identifier,
        "chinese": chinese,
        "aliases": list(aliases),
        "hanViet": han_viet,
        "viet": viet if viet is not None else han_viet,
    }


def index_record(config_id, names, *, value=100, season="PK-S1", tactics=(), books=(), focus=None):
    return {
        "sourceConfigId": config_id,
        "displayNameVi": config_id,
        "sourceSeasonLabel": season,
        "value": value,
        "heroes": [
            {
                "nameRaw": name,
                "roleRaw": role,
                "tacticSlotsVi": list(tactics),
                "bookSlotsVi": list(books),
                "statFocusVi": focus,
            }
            for name, role in zip(names, ("主將", "副將 1", "副將 2"))
        ],
    }


def other_record(team_id, names, *, tactics=(), books=(), focus=None):
    return {
        "legacyTeamId": team_id,
        "legacyVariantId": f"{team_id}-v",
        "name": team_id,
        "holders": [
            {"nameRaw": name, "tacticSlotsRaw": list(tactics), "bookSlotsRaw": list(books), "statFocusRaw": focus}
            for name in names
        ],
    }


CATALOG = [
    hero("hero:lu-mong", chinese="SP 呂蒙", aliases=["SP吕蒙"], han_viet="SP Lữ Mông"),
    hero("hero:luu-bi", chinese="劉備", han_viet="Lưu Bị"),
    hero("hero:trung", chinese="重名", han_viet="Trùng"),
    hero("hero:trung-khac", chinese="重名", han_viet="Trùng Khác"),
]


class JoinRuleTest(unittest.TestCase):
    def test_whitespace_only_difference_matches(self):
        chinese, vietnamese = {}, {}
        for item in CATALOG:
            from pipeline.hero_summaries import build_join_indexes

            chinese, vietnamese = build_join_indexes(CATALOG)
            break
        self.assertEqual(match_identity(chinese, "SP呂蒙"), ("hero:lu-mong", None))
        self.assertEqual(match_identity(vietnamese, "SP Lữ Mông"), ("hero:lu-mong", None))

    def test_unmatched_and_ambiguous_slots_are_excluded(self):
        payload = build_hero_summaries(
            catalog_bytes=json.dumps(CATALOG, ensure_ascii=False).encode(),
            records=[
                index_record("a", ["SP 呂蒙", "重名", "不存在的人"]),
                index_record("b", ["", "重名", "SP 呂蒙"]),
            ],
            other_records=[other_record("t1", ["SP Lữ Mông", "Không Có", "Trùng"])],
        )
        self.assertEqual(payload["provenance"]["unmatchedSlots"]["recommended"], 2)
        self.assertEqual(payload["provenance"]["ambiguousSlots"]["recommended"], 2)
        summary = payload["summaries"]["hero:lu-mong"]
        self.assertEqual(summary["standard"]["teams"], 2)
        self.assertEqual(summary["standard"]["positions"], [1, 0, 1])
        self.assertEqual(summary["other"]["teams"], 1)
        # Khóa chữ Hán "重名" mơ hồ nên không nối được cho ai; tên Việt "Trùng" vẫn nối bình thường.
        self.assertEqual(payload["summaries"]["hero:trung"]["standard"]["teams"], 0)
        self.assertEqual(payload["summaries"]["hero:trung"]["other"]["teams"], 1)
        self.assertNotIn("hero:trung-khac", payload["summaries"])

    def test_each_family_uses_its_own_name_space(self):
        """Tên Việt không nối được với ô chữ Hán và ngược lại (hai quy tắc tách biệt)."""
        payload = build_hero_summaries(
            catalog_bytes=json.dumps(CATALOG, ensure_ascii=False).encode(),
            records=[index_record("a", ["Lưu Bị", "劉備", "SP 呂蒙"])],
            other_records=[],
        )
        self.assertEqual(payload["summaries"]["hero:luu-bi"]["standard"]["teams"], 1)
        self.assertEqual(payload["summaries"]["hero:luu-bi"]["standard"]["positions"], [0, 1, 0])


class CountingTest(unittest.TestCase):
    def test_counts_tactics_once_per_team_and_ranks_by_score_then_source(self):
        payload = build_hero_summaries(
            catalog_bytes=json.dumps(CATALOG, ensure_ascii=False).encode(),
            records=[
                index_record("a", ["劉備", "SP 呂蒙", ""], value=90, season="PK-S1", tactics=("A", "A"), books=("B",), focus="Toàn Thống"),
                index_record("c", ["劉備", "", ""], value=120, season="PK-S2", tactics=("A",), books=("B",)),
                index_record("b", ["劉備", "", ""], value=120, season="PK-S3", tactics=("C",)),
            ],
            other_records=[other_record("t1", ["Lưu Bị", "", ""], tactics=("A",), books=("D",))],
        )
        liu = payload["summaries"]["hero:luu-bi"]
        self.assertEqual(liu["standard"]["teams"], 3)
        self.assertEqual(liu["other"]["teams"], 1)
        # Chiến pháp của Đội khác cũng được đếm (khối ghi rõ "đội chuẩn và đội khác").
        self.assertEqual(liu["tactics"], [{"name": "A", "teams": 3}, {"name": "C", "teams": 1}])
        self.assertEqual(liu["books"]["teams"], 3)
        self.assertEqual(liu["books"]["items"], [{"name": "B", "teams": 2}, {"name": "D", "teams": 1}])
        self.assertEqual(liu["statFocus"]["teams"], 1)
        # Điểm giảm dần rồi thứ tự nguồn: 120 (c) trước 120 (b) trước 90 (a) — đội khác xếp sau khi thiếu điểm.
        self.assertEqual([team["sourceConfigId"] for team in liu["representative"]],
                         ["c", "b", "a"])
        self.assertEqual([team["position"] for team in liu["representative"]], [0, 0, 0])
        self.assertEqual(liu["searchName"], "Lưu Bị")

    def test_hero_outside_every_team_is_absent(self):
        payload = build_hero_summaries(
            catalog_bytes=json.dumps(CATALOG, ensure_ascii=False).encode(),
            records=[index_record("a", ["劉備", "", ""])],
            other_records=[],
        )
        self.assertEqual(list(payload["summaries"]), ["hero:luu-bi"])


class ValidationTest(unittest.TestCase):
    def setUp(self):
        self.catalog_bytes = json.dumps(CATALOG, ensure_ascii=False).encode()
        self.records = [index_record("a", ["劉備", "", ""]), index_record("b", ["SP 呂蒙", "", ""])]
        self.other = [other_record("t1", ["SP Lữ Mông", "", ""])]
        self.payload = build_hero_summaries(
            catalog_bytes=self.catalog_bytes, records=self.records, other_records=self.other,
        )

    def test_rebuild_is_identical_and_shape_passes(self):
        validate_hero_summaries(
            self.payload, catalog_bytes=self.catalog_bytes, records=self.records, other_records=self.other,
        )

    def test_shape_rejects_broken_totals_and_foreign_references(self):
        import copy

        broken = copy.deepcopy(self.payload)
        broken["summaries"]["hero:luu-bi"]["standard"]["teams"] = 5
        with self.assertRaisesRegex(ValueError, "lệch tổng"):
            validate_hero_summaries_shape(broken, records=self.records, other_records=self.other)

        foreign = copy.deepcopy(self.payload)
        foreign["summaries"]["hero:luu-bi"]["representative"][0]["sourceConfigId"] = "nope"
        with self.assertRaisesRegex(ValueError, "ngoài nguồn"):
            validate_hero_summaries_shape(foreign, records=self.records, other_records=self.other)

    def test_stale_catalog_changes_the_payload(self):
        other_catalog = json.dumps([hero("hero:luu-bi", chinese="劉備", han_viet="Lưu Bị")], ensure_ascii=False).encode()
        rebuilt = build_hero_summaries(catalog_bytes=other_catalog, records=self.records, other_records=self.other)
        self.assertNotEqual(rebuilt, self.payload)

    def test_real_generation_matches_independent_recount_of_every_field(self):
        """So chéo **mọi trường hứa** với phép đếm độc lập trên chính bản ghi đã phát (kể cả thứ tự đồng hạng)."""
        import pathlib

        root = pathlib.Path(__file__).resolve().parents[1]
        current = json.loads((root / "src/data/recommended-reference/current.json").read_text())
        generation = root / "src/data/recommended-reference" / current["generationId"]
        catalog = json.loads((root / "data/heroes-dict.json").read_text())
        records = json.loads((generation / "index.json").read_text())["records"]
        others = json.loads((generation / "other-teams.json").read_text())["records"]
        payload = json.loads((generation / "hero-summaries.json").read_text())

        def strip(value):
            return "".join(str(value or "").split())

        chinese, vietnamese = {}, {}
        for item in catalog:
            for value in [item.get("chinese"), *(item.get("aliases") or [])]:
                key = strip(value)
                if key:
                    chinese.setdefault(key, set()).add(item["id"])
            name = str(item.get("hanViet") or "").strip()
            if name:
                vietnamese.setdefault(name, set()).add(item["id"])

        def only(index, key):
            matches = index.get(key)
            return next(iter(matches)) if matches and len(matches) == 1 else None

        expected = {}

        catalog_name = {
            item["id"]: str(item.get("viet") or item.get("hanViet") or "").strip() for item in catalog
        }

        def slot(identifier, _team_name):
            return expected.setdefault(identifier, {
                "name": catalog_name[identifier], "positions": {"standard": [0, 0, 0], "other": [0, 0, 0]},
                "tactics": {}, "books": {}, "book_teams": 0, "focus": {}, "focus_teams": 0, "teams": [],
            })

        def add(counts, names):
            seen = set()
            for name in names or []:
                name = str(name or "").strip()
                if name and name not in seen:
                    seen.add(name)
                    counts[name] = counts.get(name, 0) + 1
            return bool(seen)

        for order, record in enumerate(records):
            for position, hero in enumerate(record["heroes"]):
                identifier = only(chinese, strip(hero.get("nameRaw")))
                if not identifier:
                    continue
                item = slot(identifier, record.get("displayNameVi"))
                item["positions"]["standard"][position] += 1
                add(item["tactics"], hero.get("tacticSlotsVi"))
                if add(item["books"], hero.get("bookSlotsVi")):
                    item["book_teams"] += 1
                if add(item["focus"], [hero.get("statFocusVi")]):
                    item["focus_teams"] += 1
                item["teams"].append({
                    "family": "recommended", "name": record.get("displayNameVi"),
                    "seasonLabel": record.get("sourceSeasonLabel"), "score": record.get("value"),
                    "position": position, "sourceConfigId": record.get("sourceConfigId"), "order": order,
                })

        for order, record in enumerate(others):
            for position, holder in enumerate(record["holders"]):
                identifier = only(vietnamese, str(holder.get("nameRaw") or "").strip())
                if not identifier:
                    continue
                item = slot(identifier, record.get("name"))
                item["positions"]["other"][position] += 1
                add(item["tactics"], holder.get("tacticSlotsRaw"))
                if add(item["books"], holder.get("bookSlotsRaw")):
                    item["book_teams"] += 1
                if add(item["focus"], [holder.get("statFocusRaw")]):
                    item["focus_teams"] += 1
                item["teams"].append({
                    "family": "other", "name": record.get("name"), "seasonLabel": "", "score": None,
                    "position": position, "legacyTeamId": record.get("legacyTeamId"),
                    "legacyVariantId": record.get("legacyVariantId"), "order": order,
                })

        def ranked(items):
            return sorted(items, key=lambda row: (
                row["score"] is None, -(row["score"] or 0),
                0 if row["family"] == "recommended" else 1, row["order"],
            ))

        def top(counts, order):
            names = list(counts)
            return sorted(names, key=lambda name: (-counts[name], order.index(name)))[:3]

        self.assertEqual(set(expected), set(payload["summaries"]), "tập tướng có số liệu khác nguồn")
        for identifier, item in expected.items():
            summary = payload["summaries"][identifier]
            self.assertEqual(summary["searchName"], item["name"], identifier)
            self.assertEqual(summary["standard"],
                             {"teams": sum(item["positions"]["standard"]), "positions": item["positions"]["standard"]}, identifier)
            self.assertEqual(summary["other"],
                             {"teams": sum(item["positions"]["other"]), "positions": item["positions"]["other"]}, identifier)
            self.assertEqual(summary["tactics"],
                             [{"name": name, "teams": item["tactics"][name]} for name in top(item["tactics"], list(item["tactics"]))],
                             f"{identifier} chiến pháp")
            self.assertEqual(summary["books"],
                             {"teams": item["book_teams"],
                              "items": [{"name": name, "teams": item["books"][name]} for name in top(item["books"], list(item["books"]))]},
                             f"{identifier} binh thư")
            self.assertEqual(summary["statFocus"],
                             {"teams": item["focus_teams"],
                              "items": [{"name": name, "teams": item["focus"][name]} for name in top(item["focus"], list(item["focus"]))]},
                             f"{identifier} hướng điểm")
            representatives = [
                {key: value for key, value in team.items() if key != "order"} for team in ranked(item["teams"])[:3]
            ]
            self.assertEqual(summary["representative"], representatives, f"{identifier} đội tiêu biểu")

        lu_mong = payload["summaries"]["hero:sp-lu-mong"]
        self.assertGreater(lu_mong["standard"]["teams"], 0)
        self.assertGreater(lu_mong["other"]["teams"], 0)
        # Chiến pháp của Đội khác phải nằm trong số liệu: tổng theo chiến pháp > số đội chuẩn của tướng
        # (SP Lữ Mông mang chiến pháp ở cả hai họ).
        self.assertGreater(sum(item["teams"] for item in lu_mong["tactics"]), lu_mong["standard"]["teams"])


if __name__ == "__main__":
    unittest.main()
