"""TDD pipeline/build_books_dict.py — bảng map binh thư Hán->Việt (thủ công).

Binh thư game VN dùng tên DỊCH NGHĨA, không Hán-Việt (vd 铁甲->Giáp Sắt), nên
KHÔNG auto-link như tướng/chiến pháp; map bằng bảng thủ công + validate viet in facet.
"""

import copy
import json
import os
import unittest

from pipeline import build_books_dict as bbd

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


FACET = [
    "Giáp Sắt", "Phòng Bị", "Tam Quân Chi Chúng", "Rèn Luyện", "Dẫn Quân",
    "Chiến Đấu Trường Kỳ", "Yêu Lính Thương Dân", "Quỷ Mưu",
]


LEDGER_PATH = os.path.join(_ROOT, "pipeline", "lookup-route-handles.json")


def bk(slug, viet, **extra):
    return {"id": f"book:{slug}", "viet": viet, **extra}


def ledger():
    with open(LEDGER_PATH, encoding="utf-8") as fh:
        return json.load(fh)


def real_inputs():
    with open(os.path.join(_ROOT, "data", "facets.json"), encoding="utf-8") as fh:
        facet_books = [b["value"] for b in json.load(fh)["books"]]
    return copy.deepcopy(bbd._load_map()), facet_books


class BuildBooksDictTest(unittest.TestCase):
    def test_map_basic_records(self):
        m = {"铁甲": bk("giap-sat", "Giáp Sắt"), "防备": bk("phong-bi", "Phòng Bị")}
        recs = bbd.build_books_dict(m, FACET)
        by_cn = {r["chinese"]: r for r in recs}
        self.assertEqual(by_cn["铁甲"]["viet"], "Giáp Sắt")
        self.assertEqual(by_cn["防备"]["viet"], "Phòng Bị")
        # chinese giữ nguyên
        self.assertIn("铁甲", by_cn)

    def test_viet_must_be_in_facet_fail_loud(self):
        # tên Việt không thuộc facet -> ném (chống map lệch)
        with self.assertRaises(ValueError):
            bbd.build_books_dict({"铁甲": bk("giap-sat", "Tên Bịa Không Có")}, FACET)

    def test_hanviet_omitted_when_chars_missing(self):
        # 锤炼 có ký tự ngoài bảng hanviet -> KHÔNG ship field hanViet
        recs = bbd.build_books_dict({"锤炼": bk("ren-luyen", "Rèn Luyện")}, FACET)
        self.assertNotIn("hanViet", recs[0])

    def test_hanviet_present_when_complete(self):
        # 鬼谋 phiên âm sạch -> có hanViet = "Quỷ Mưu"
        recs = bbd.build_books_dict({"鬼谋": bk("quy-muu", "Quỷ Mưu")}, FACET)
        self.assertEqual(recs[0].get("hanViet"), "Quỷ Mưu")

    def test_sorted_by_viet(self):
        m = {"防备": bk("phong-bi", "Phòng Bị"), "铁甲": bk("giap-sat", "Giáp Sắt")}
        recs = bbd.build_books_dict(m, FACET)
        viets = [r["viet"] for r in recs]
        self.assertEqual(viets, sorted(viets))

    def test_outside_teams_row_skips_facet_check(self):
        m = {"归心": {"id": "book:quy-thuan", "viet": "Quy Thuận", "outsideTeams": True}, "铁甲": bk("giap-sat", "Giáp Sắt")}
        recs = bbd.build_books_dict(m, FACET)
        self.assertEqual([r["viet"] for r in recs], ["Giáp Sắt", "Quy Thuận"])

    def test_outside_teams_flag_rejected_when_book_is_in_facet(self):
        # cờ đã cũ (sách nay có đội dùng) -> ném để gỡ cờ
        with self.assertRaises(ValueError):
            bbd.build_books_dict({"铁甲": {"id": "book:giap-sat", "viet": "Giáp Sắt", "outsideTeams": True}}, FACET)

    def test_effect_fields_carried_to_record(self):
        effect = {"effect": "使自身受到的傷害降低 3%", "effectViet": "Bản thân giảm 3% sát thương phải chịu.", "effectVersion": "2021-11"}
        recs = bbd.build_books_dict({"防备": {"id": "book:phong-bi", "viet": "Phòng Bị", **effect}}, FACET)
        self.assertEqual({key: recs[0][key] for key in effect}, effect)

    def test_partial_effect_rejected(self):
        # Có chữ Hán mà thiếu bản dịch (hoặc phiên bản) thì hồ sơ hai ngôn ngữ lệch nhau -> ném.
        for partial in ({"effect": "x"}, {"effect": "x", "effectViet": "y"}, {"effectViet": "y", "effectVersion": "2021-11"}):
            with self.assertRaises(ValueError, msg=partial):
                bbd.build_books_dict({"防备": {"id": "book:phong-bi", "viet": "Phòng Bị", **partial}}, FACET)

    def test_client_vietnamese_version_needs_the_full_effect(self):
        # Mốc riêng của chữ Việt (chép từ client) đi kèm bộ ba hiệu ứng; đứng một mình thì zh không có gì đối ứng -> ném.
        effect = {"effect": "使自身受到的傷害降低 3%", "effectViet": "Bản thân giảm 3%.", "effectVersion": "2021-11"}
        recs = bbd.build_books_dict({"防备": bk("phong-bi", "Phòng Bị", **effect, effectVietVersion="Global 24.535")}, FACET)
        self.assertEqual((recs[0]["effectVersion"], recs[0]["effectVietVersion"]), ("2021-11", "Global 24.535"))
        for bad in ({"effectVietVersion": "Global 24.535"}, {**effect, "effectVietVersion": " "}):
            with self.assertRaises(ValueError, msg=bad):
                bbd.build_books_dict({"防备": bk("phong-bi", "Phòng Bị", **bad)}, FACET)

    def test_source_names_carried_sorted(self):
        recs = bbd.build_books_dict({"防备": {"id": "book:phong-bi", "viet": "Phòng Bị", "sourceNames": ["防備"]}}, FACET)
        self.assertEqual(recs[0]["sourceNames"], ["防備"])

    def test_excluded_source_name_cannot_belong_to_a_book(self):
        # Tên loại trừ (binh thư khác bị dịch nhầm) mà lại là tên nguồn của một binh thư -> mâu thuẫn, ném.
        m = {"防备": {"id": "book:phong-bi", "viet": "Phòng Bị", "sourceNames": ["防備"]}, "铁甲": {"id": "book:giap-sat", "viet": "Giáp Sắt", "excludedSourceNames": ["防備"]}}
        with self.assertRaises(ValueError):
            bbd.build_books_dict(m, FACET)

    def test_real_map_against_real_facets(self):
        with open(os.path.join(_ROOT, "data", "facets.json"), encoding="utf-8") as fh:
            facet_books = [b["value"] for b in json.load(fh)["books"]]
        with open(os.path.join(_ROOT, "data", "books-dict.json"), encoding="utf-8") as fh:
            committed = json.load(fh)
        built = bbd.build_books_dict(bbd._load_map(), facet_books)
        self.assertEqual(built, committed)

    def test_every_published_book_has_effect(self):
        # Hồ sơ Binh thư không còn ô hiệu ứng "Đang cập nhật" ở cả bản Việt lẫn bản zh.
        with open(os.path.join(_ROOT, "data", "books-dict.json"), encoding="utf-8") as fh:
            built = json.load(fh)
        missing = [r["viet"] for r in built if not (r.get("effect") and r.get("effectViet") and r.get("effectVersion"))]
        self.assertEqual(missing, [])


class FrozenBookIdsTest(unittest.TestCase):
    def test_real_map_yields_exactly_the_ledger_book_ids(self):
        m, facets = real_inputs()
        built = bbd.build_books_dict(m, facets)
        self.assertEqual({r["id"] for r in built}, set(ledger()["handles"]["books"]))
        self.assertEqual(len(built), 68)
        # id luôn đứng đầu dòng và là id cố định ghi trong map, không suy từ tên.
        self.assertEqual({r["chinese"]: r["id"] for r in built}, {c: e["id"] for c, e in m.items()})

    def test_rename_viet_with_alias_keeps_id_and_passes_facet_check(self):
        m, facets = real_inputs()
        old = "Dĩ Trực Báo Oán"
        chinese = next(c for c, e in m.items() if e["viet"] == old)
        m[chinese]["viet"] = "Lấy Thẳng Báo Oán"
        m[chinese]["aliases"] = [old]
        row = next(r for r in bbd.build_books_dict(m, facets) if r["chinese"] == chinese)
        self.assertEqual(row["id"], "book:di-truc-bao-oan")
        self.assertEqual(row["viet"], "Lấy Thẳng Báo Oán")
        self.assertEqual(row["aliases"], [old])

    def test_rename_without_alias_fails_facet_check(self):
        m, facets = real_inputs()
        chinese = next(c for c, e in m.items() if e["viet"] == "Dĩ Trực Báo Oán")
        m[chinese]["viet"] = "Lấy Thẳng Báo Oán"
        with self.assertRaises(ValueError):
            bbd.build_books_dict(m, facets)

    def test_chinese_key_change_keeps_id(self):
        m, facets = real_inputs()
        chinese = next(c for c, e in m.items() if e["viet"] == "Giáp Sắt")
        entry = m.pop(chinese)
        m["鐵甲新"] = entry
        row = next(r for r in bbd.build_books_dict(m, facets) if r["viet"] == "Giáp Sắt")
        self.assertEqual((row["chinese"], row["id"]), ("鐵甲新", entry["id"]))

    def test_missing_duplicate_malformed_ids_rejected(self):
        for label, m in (
            ("missing", {"铁甲": {"viet": "Giáp Sắt"}}),
            ("blank", {"铁甲": {"id": " ", "viet": "Giáp Sắt"}}),
            ("duplicate", {"铁甲": bk("giap-sat", "Giáp Sắt"), "防备": bk("giap-sat", "Phòng Bị")}),
            ("bad prefix", {"铁甲": {"id": "tactic:giap-sat", "viet": "Giáp Sắt"}}),
            ("uppercase", {"铁甲": {"id": "book:Giap-Sat", "viet": "Giáp Sắt"}}),
            ("diacritic", {"铁甲": {"id": "book:giáp-sắt", "viet": "Giáp Sắt"}}),
            ("trailing dash", {"铁甲": {"id": "book:giap-", "viet": "Giáp Sắt"}}),
            ("not a string", {"铁甲": {"id": 7, "viet": "Giáp Sắt"}}),
        ):
            with self.subTest(label), self.assertRaises(ValueError):
                bbd.build_books_dict(m, FACET)

    def test_new_id_reusing_a_retired_id_is_rejected(self):
        retired = {"book:da-ve-huu": "da-ve-huu"}
        m = {"铁甲": bk("da-ve-huu", "Giáp Sắt")}
        with self.assertRaises(ValueError):
            bbd.build_books_dict(m, FACET, ledger={"handles": {"books": {}}, "retired": {"books": retired}})
        # id đã có trong handles là id cũ, không phải id mới.
        rows = bbd.build_books_dict({"铁甲": bk("giap-sat", "Giáp Sắt")}, FACET, ledger={"handles": {"books": {"book:giap-sat": "giap-sat"}}, "retired": {"books": {"book:giap-sat": "giap-sat"}}})
        self.assertEqual(rows[0]["id"], "book:giap-sat")

    def test_entry_with_id_but_no_name_does_not_crash(self):
        with self.assertRaises(ValueError) as caught:
            bbd.build_books_dict({"铁甲": {"id": "book:giap-sat"}}, FACET)
        self.assertNotIsInstance(caught.exception, KeyError)

    def test_bare_string_entry_rejected(self):
        with self.assertRaises(ValueError):
            bbd.build_books_dict({"铁甲": "Giáp Sắt"}, FACET)


if __name__ == "__main__":
    unittest.main()
