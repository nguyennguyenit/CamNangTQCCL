"""TDD pipeline/crawl_tactics.py — parser thuần trên fixture (KHÔNG gọi mạng)."""

import json
import os
import unittest

from pipeline import crawl_tactics

_FIX = os.path.join(os.path.dirname(__file__), "fixtures", "lingxi")


def _load(name):
    with open(os.path.join(_FIX, name), "r", encoding="utf-8") as fh:
        return json.load(fh)


class ParseTacticTest(unittest.TestCase):
    def setUp(self):
        self.item = _load("tactic_detail.json")["result"]["items"][0]

    def test_core_fields(self):
        rec = crawl_tactics.parse_tactic_detail(self.item)
        self.assertEqual(rec["chinese"], "燕人咆哮")
        self.assertEqual(rec["hanViet"], "Yến Nhân Bào Hao")
        self.assertEqual(rec["type"], "Bị động")       # 被动
        self.assertEqual(rec["quality"], "S")
        self.assertEqual(rec["source"], "Tự mang")     # 自带战法
        self.assertTrue(rec["effect"])                 # mô tả không rỗng
        self.assertIn("Kỵ", rec["troopFit"])           # 骑兵
        self.assertTrue(rec["iconUrl"].startswith("http"))

    def test_no_network_no_png(self):
        # iconUrl chỉ là URL, không phải đường dẫn file local [C3].
        rec = crawl_tactics.parse_tactic_detail(self.item)
        self.assertTrue(rec["iconUrl"].startswith("http"))
        self.assertNotIn("assets/", rec["iconUrl"])


class ParseHeroTest(unittest.TestCase):
    def setUp(self):
        self.item = _load("hero_detail.json")["result"]["items"][0]

    def test_core_fields(self):
        rec = crawl_tactics.parse_hero_detail(self.item)
        self.assertEqual(rec["chinese"], "曹操")
        self.assertEqual(rec["hanViet"], "Tào Tháo")
        self.assertEqual(rec["faction"], "Ngụy")       # 魏
        self.assertEqual(rec["stars"], 5)              # 5星
        self.assertEqual(rec["stats"]["tri"], "91")    # 智力
        self.assertTrue(rec["iconUrl"].startswith("http"))

    def test_enriched_fields(self):
        # [Phase 1] thích tính binh chủng + truyền thừa + tag vai trò.
        rec = crawl_tactics.parse_hero_detail(self.item)
        self.assertEqual(rec["troopApt"], {        # 兵种适性{骑/盾/弓/枪/器械}
            "ky": "S", "thuan": "S", "cung": "A", "thuong": "A", "khiGioi": "B",
        })
        self.assertEqual(rec["inheritTacticCn"], "梦中弑臣")  # 传承战法 (chỉ tên Hán)
        self.assertEqual(rec["roleTag"], "辅")                 # 武将标签
        self.assertEqual(rec["roleTagViet"], "Phụ trợ")       # qua role-tag-map.json

    def test_unknown_role_tag_fail_loud(self):
        # Tag chưa có trong bảng map -> fail-loud (không lọt tag chưa map).
        bad = json.loads(json.dumps(self.item))  # deep copy
        for d in bad["details"]:
            if d["key"] == "武将标签":
                d["val"] = "氏"  # tag không tồn tại trong map
        with self.assertRaises(Exception):
            crawl_tactics.parse_hero_detail(bad)


class DetailMapTest(unittest.TestCase):
    def test_list_fixture_shape(self):
        # List fixture: totalCount + items có priRowId.
        data = _load("tactics_list_p0.json")["result"]
        self.assertEqual(data["totalCount"], 209)
        self.assertTrue(all("priRowId" in it for it in data["items"]))


def _page(total, ids):
    return {"result": {"totalCount": total, "items": [{"priRowId": i, "priVal": i} for i in ids]}}


class CrawlListGuardTest(unittest.TestCase):
    """[H3/M1] dedup theo priRowId + fail-loud khi lệch totalCount, KHÔNG gọi mạng."""

    def _patch(self, pages):
        seq = iter(pages)
        crawl_tactics._post = lambda api, params: next(seq)

    def setUp(self):
        self._orig = crawl_tactics._post

    def tearDown(self):
        crawl_tactics._post = self._orig

    def test_dedup_repeated_page_then_complete(self):
        # Page lặp (cùng id) KHÔNG inflate; chỉ pass khi đủ unique == total.
        self._patch([_page(3, ["a", "b"]), _page(3, ["a", "b"]), _page(3, ["c"]), _page(3, [])])
        items = crawl_tactics.crawl_list("tb", size=2, sleep=0)
        self.assertEqual({it["priRowId"] for it in items}, {"a", "b", "c"})

    def test_fail_loud_when_short(self):
        # Hết item nhưng unique < total -> raise (crawl thiếu).
        self._patch([_page(5, ["a", "b"]), _page(5, [])])
        with self.assertRaises(RuntimeError):
            crawl_tactics.crawl_list("tb", size=2, sleep=0)


if __name__ == "__main__":
    unittest.main()
