"""Tests for the frozen lookup (Tra cứu) slug ledger."""

from __future__ import annotations

import contextlib
import copy
import io
import json
import shutil
import tempfile
import unittest
from pathlib import Path

from pipeline import lookup_route_handles as lrh

REPO_ROOT = Path(__file__).resolve().parents[1]
GENERATION = "lookup:" + "a" * 64


def write_json(path: Path, value) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")


def tactic(tactic_id: str, viet: str, former=()) -> dict:
    return {"id": tactic_id, "viet": viet, "lookup": {"formerIds": list(former)}}


def make_data(root: Path, *, heroes=None, books=None, tactics=None, generation=GENERATION) -> Path:
    data = root / "data"
    data.mkdir(parents=True, exist_ok=True)
    write_json(data / "lookup-manifest.json", {"files": {}, "generationId": generation, "schemaVersion": 1})
    write_json(data / "heroes-dict.json", heroes if heroes is not None else [
        {"id": "hero:lu-mong", "viet": "Lữ Mông"},
        {"id": "hero:sp-lu-mong", "viet": "Lữ Mông"},
        {"id": "hero:dang-ai", "viet": "Đặng Ngải"},
    ])
    write_json(data / "tactics.json", tactics if tactics is not None else [tactic("tactic:binh-thanh", "Binh Thánh")])
    write_json(data / "lookup-catalog.json", {
        "equipment": [{"id": "equipment:kiem", "nameVi": "Kiếm"}],
        "specials": [{"id": "equipment-special:kiem-1", "nameVi": "Kiếm đặc kỹ", "equipmentId": "equipment:kiem"}],
        "advisors": [{"id": "advisor:lo-tuc", "nameVi": "Lỗ Túc"}],
        "troopMods": [{"id": "troop-mod:dan-duong", "nameVi": "Đan Dương Binh"}],
        "buildings": [{"id": "building:bat-tran-do", "nameVi": "Bát Trận Đồ"}],
    })
    write_json(data / "books-dict.json", books if books is not None else [
        {"viet": "Binh Hành Quỷ Đạo", "chinese": "兵行诡道"},
        {"hanViet": "Hán Việt Thư"},
        {"viet": "", "hanViet": "Bỏ"},
        {"viet": None, "hanViet": None},
    ])
    return data


class LookupLedgerTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.tmp, True)
        self.data = make_data(self.tmp)
        self.ledger = self.tmp / "ledger.json"
        self.redirects = self.tmp / "_redirects"

    def run_cli(self, *args):
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = lrh.main([*args, "--data-dir", str(self.data), "--ledger", str(self.ledger), "--redirects", str(self.redirects)])
        return code, out.getvalue(), err.getvalue()

    def handles(self):
        return json.loads(self.ledger.read_text(encoding="utf-8"))["handles"]

    def edit_ledger(self, mutate, *, redigest=False):
        ledger = json.loads(self.ledger.read_text(encoding="utf-8"))
        mutate(ledger)
        if redigest:
            ledger["handlesSha256"] = lrh.handles_digest(ledger["handles"], ledger["retired"])
        self.ledger.write_text(json.dumps(ledger, ensure_ascii=False), encoding="utf-8")

    def test_slug_matches_lookup_slug(self):
        self.assertEqual(lrh.slug("  Đặng Ngải "), "dang-ngai")
        self.assertEqual(lrh.slug("Tinh · Phong Thi Trận"), "tinh-phong-thi-tran")
        self.assertEqual(lrh.slug("Lữ Mông (SP)"), "lu-mong-sp")
        self.assertEqual(lrh.slug(None), "")

    def test_corpus_has_one_id_per_routed_item_and_no_specials(self):
        corpus = lrh.load_corpus(self.data)
        self.assertEqual(list(corpus["groups"]), list(lrh.GROUP_KINDS))
        self.assertEqual([i for i, _ in corpus["groups"]["books"]], ["book:binh-hanh-quy-dao", "book:han-viet-thu"])
        every = [i for items in corpus["groups"].values() for i, _ in items]
        self.assertFalse([i for i in every if i.startswith("equipment-special:")])

    def test_minting_is_stable_and_collisions_get_suffix(self):
        self.assertEqual(self.run_cli("--write")[0], 0)
        handles = self.handles()
        self.assertEqual(handles["heroes"], {"hero:lu-mong": "lu-mong", "hero:sp-lu-mong": "lu-mong-2", "hero:dang-ai": "dang-ngai"})
        self.assertEqual(handles["books"]["book:han-viet-thu"], "han-viet-thu")
        first = self.ledger.read_bytes()
        self.assertEqual(self.run_cli("--write")[0], 0)
        self.assertEqual(self.ledger.read_bytes(), first)
        self.assertEqual(self.run_cli("--check")[0], 0)

    def test_collision_suffix_skips_taken_slug(self):
        write_json(self.data / "heroes-dict.json", [
            {"id": "hero:a", "viet": "An"}, {"id": "hero:b", "viet": "An"}, {"id": "hero:c", "viet": "An 2"}, {"id": "hero:d", "viet": "An"},
        ])
        self.assertEqual(self.run_cli("--write")[0], 0)
        slugs = self.handles()["heroes"]
        self.assertEqual(len(set(slugs.values())), 4)
        self.assertEqual(slugs["hero:a"], "an")

    def test_rename_keeps_frozen_slug(self):
        self.run_cli("--write")
        before = self.handles()
        make_data(self.tmp, heroes=[
            {"id": "hero:lu-mong", "viet": "Tên Hoàn Toàn Mới"},
            {"id": "hero:sp-lu-mong", "viet": "Lữ Mông"},
            {"id": "hero:dang-ai", "viet": "Đặng Ngải"},
        ])
        self.assertEqual(self.run_cli("--write")[0], 0)
        self.assertEqual(self.handles(), before)
        self.assertEqual(self.run_cli("--check")[0], 0)

    def test_new_item_is_appended_without_touching_others(self):
        self.run_cli("--write")
        before = self.handles()
        make_data(self.tmp, generation="lookup:" + "b" * 64, heroes=[
            {"id": "hero:lu-mong", "viet": "Lữ Mông"},
            {"id": "hero:sp-lu-mong", "viet": "Lữ Mông"},
            {"id": "hero:dang-ai", "viet": "Đặng Ngải"},
            {"id": "hero:moi", "viet": "Lữ Mông"},
        ])
        code, _, _ = self.run_cli("--check")
        self.assertEqual(code, 1)  # unassigned id and stale pin: --check never mints
        self.assertEqual(self.run_cli("--write")[0], 0)
        after = self.handles()
        self.assertEqual(after["heroes"]["hero:moi"], "lu-mong-3")
        after["heroes"].pop("hero:moi")
        self.assertEqual(after, before)
        self.assertEqual(self.run_cli("--check")[0], 0)

    def test_check_fails_on_missing_id(self):
        self.run_cli("--write")
        self.edit_ledger(lambda l: l["handles"]["heroes"].pop("hero:dang-ai"), redigest=True)
        code, _, err = self.run_cli("--check")
        self.assertEqual(code, 1)
        self.assertIn("hero:dang-ai has no slug", err)

    def test_check_fails_on_unknown_id(self):
        self.run_cli("--write")
        self.edit_ledger(lambda l: l["handles"]["tactics"].update({"tactic:gone": "gone"}), redigest=True)
        code, _, err = self.run_cli("--check")
        self.assertEqual(code, 1)
        self.assertIn("tactic:gone is not in the corpus", err)

    def test_write_refuses_hand_edited_slug_even_when_new_ids_arrive(self):
        self.run_cli("--write")
        self.edit_ledger(lambda l: l["handles"]["heroes"].update({"hero:dang-ai": "hand-edited"}))
        make_data(self.tmp, heroes=[
            {"id": "hero:lu-mong", "viet": "Lữ Mông"}, {"id": "hero:sp-lu-mong", "viet": "Lữ Mông"},
            {"id": "hero:dang-ai", "viet": "Đặng Ngải"}, {"id": "hero:moi", "viet": "Mới"},
        ])
        code, _, err = self.run_cli("--write")
        self.assertEqual(code, 1)
        self.assertIn("edited by hand", err)
        self.assertEqual(self.run_cli("--check")[0], 1)

    def test_write_refuses_hand_edited_retired_section(self):
        self.run_cli("--write")
        self.edit_ledger(lambda l: l["retired"]["tactics"].update({"tactic:x": "x"}))
        code, _, err = self.run_cli("--write")
        self.assertEqual(code, 1)
        self.assertIn("edited by hand", err)

    def test_vanished_id_is_retired_and_its_slug_stays_reserved(self):
        self.run_cli("--write")
        before = self.handles()
        write_json(self.data / "heroes-dict.json", [{"id": "hero:lu-mong", "viet": "Lữ Mông"}, {"id": "hero:dang-ai", "viet": "Đặng Ngải"}])
        code, _, _ = self.run_cli("--check")
        self.assertEqual(code, 1)  # --check never retires
        self.assertEqual(self.run_cli("--write")[0], 0)
        ledger = json.loads(self.ledger.read_text(encoding="utf-8"))
        self.assertEqual(ledger["retired"]["heroes"], {"hero:sp-lu-mong": "lu-mong-2"})
        self.assertNotIn("hero:sp-lu-mong", ledger["handles"]["heroes"])
        self.assertEqual(ledger["handles"]["heroes"]["hero:lu-mong"], before["heroes"]["hero:lu-mong"])
        self.assertEqual(self.run_cli("--check")[0], 0)
        # A new item with the retired slug's name never receives the retired slug.
        write_json(self.data / "heroes-dict.json", [
            {"id": "hero:lu-mong", "viet": "Lữ Mông"}, {"id": "hero:dang-ai", "viet": "Đặng Ngải"},
            {"id": "hero:a", "viet": "Lữ Mông"}, {"id": "hero:b", "viet": "Lữ Mông"},
        ])
        self.assertEqual(self.run_cli("--write")[0], 0)
        slugs = self.handles()["heroes"]
        self.assertEqual((slugs["hero:a"], slugs["hero:b"]), ("lu-mong-3", "lu-mong-4"))
        self.assertEqual(self.run_cli("--check")[0], 0)

    def test_retired_id_that_returns_gets_its_old_slug_back(self):
        self.run_cli("--write")
        before = self.handles()
        full = json.loads((self.data / "heroes-dict.json").read_text(encoding="utf-8"))
        write_json(self.data / "heroes-dict.json", full[:1])
        self.run_cli("--write")
        write_json(self.data / "heroes-dict.json", full)
        self.assertEqual(self.run_cli("--check")[0], 1)  # retired id is back: needs --write
        self.assertEqual(self.run_cli("--write")[0], 0)
        self.assertEqual(self.handles(), before)
        self.assertEqual(json.loads(self.ledger.read_text(encoding="utf-8"))["retired"]["heroes"], {})
        self.assertEqual(self.run_cli("--check")[0], 0)

    def test_check_fails_on_slug_shared_by_live_and_retired(self):
        self.run_cli("--write")
        self.edit_ledger(lambda l: l["retired"]["heroes"].update({"hero:gone": "dang-ngai"}), redigest=True)
        code, _, err = self.run_cli("--check")
        self.assertEqual(code, 1)
        self.assertIn("shared by", err)

    def test_check_fails_on_duplicate_slug(self):
        self.run_cli("--write")
        self.edit_ledger(lambda l: l["handles"]["heroes"].update({"hero:sp-lu-mong": "lu-mong"}), redigest=True)
        code, _, err = self.run_cli("--check")
        self.assertEqual(code, 1)
        self.assertIn("shared by", err)

    def test_check_fails_on_hand_edited_slug(self):
        self.run_cli("--write")
        self.edit_ledger(lambda l: l["handles"]["heroes"].update({"hero:dang-ai": "ngai-dang"}))
        code, _, err = self.run_cli("--check")
        self.assertEqual(code, 1)
        self.assertIn("edited by hand", err)

    def test_check_fails_on_malformed_slug(self):
        self.run_cli("--write")
        self.edit_ledger(lambda l: l["handles"]["heroes"].update({"hero:dang-ai": "Đặng Ngải"}), redigest=True)
        self.assertEqual(self.run_cli("--check")[0], 1)

    def test_check_fails_on_stale_pins(self):
        self.run_cli("--write")
        self.edit_ledger(lambda l: l.update({"generationId": "lookup:" + "c" * 64}))
        self.assertEqual(self.run_cli("--check")[0], 1)
        self.run_cli("--write")  # restores the pin without changing slugs
        self.assertEqual(self.run_cli("--check")[0], 0)
        write_json(self.data / "books-dict.json", [{"viet": "Binh Hành Quỷ Đạo"}, {"viet": "Hán Việt Thư"}])
        self.assertEqual(self.run_cli("--check")[0], 1)

    def test_check_never_rederives_from_names(self):
        self.run_cli("--write")
        write_json(self.data / "tactics.json", [tactic("tactic:binh-thanh", "Đổi Tên")])
        self.assertEqual(self.run_cli("--check")[0], 0)

    def merge_tactic(self):
        """`tactic:cu` leaves the corpus as a former id of `tactic:binh-thanh`; `tactic:bo` leaves with no survivor."""
        write_json(self.data / "tactics.json", [
            tactic("tactic:binh-thanh", "Binh Thánh"), tactic("tactic:cu", "Cũ"), tactic("tactic:bo", "Bỏ"),
        ])
        self.assertEqual(self.run_cli("--write")[0], 0)
        write_json(self.data / "tactics.json", [tactic("tactic:binh-thanh", "Binh Thánh", ["tactic:cu"])])
        self.assertEqual(self.run_cli("--write")[0], 0)

    def test_merged_tactic_gets_one_301_per_locale_and_dropped_one_none(self):
        self.merge_tactic()
        self.assertEqual(self.redirects.read_text(encoding="utf-8"), "\n".join([
            lrh.REDIRECTS_HEADER,
            "/tra-cuu/chien-phap/cu/ /tra-cuu/chien-phap/binh-thanh/ 301",
            "/zh/tra-cuu/chien-phap/cu/ /zh/tra-cuu/chien-phap/binh-thanh/ 301",
        ]) + "\n")
        self.assertEqual(self.run_cli("--check")[0], 0)

    def test_check_fails_on_stale_redirects(self):
        self.merge_tactic()
        self.redirects.write_text(self.redirects.read_text(encoding="utf-8") + "/a/ /b/ 301\n", encoding="utf-8")
        code, _, err = self.run_cli("--check")
        self.assertEqual(code, 1)
        self.assertIn("is stale; run --write", err)
        self.assertEqual(self.run_cli("--write")[0], 0)
        self.assertEqual(self.run_cli("--check")[0], 0)

    def test_survivor_without_live_slug_fails(self):
        self.merge_tactic()
        self.edit_ledger(lambda l: l["handles"]["tactics"].pop("tactic:binh-thanh"), redigest=True)
        self.assertEqual(self.run_cli("--check")[0], 1)  # the ledger check already misses the corpus id
        ledger = json.loads(self.ledger.read_text(encoding="utf-8"))
        with self.assertRaisesRegex(lrh.LookupRouteHandleError, "survivor tactic:binh-thanh of tactic:cu has no live slug"):
            lrh.redirects_bytes({"tactic:cu": "tactic:binh-thanh"}, ledger)

    def test_former_id_without_retired_slug_fails(self):
        write_json(self.data / "tactics.json", [tactic("tactic:binh-thanh", "Binh Thánh", ["tactic:never-routed"])])
        code, _, err = self.run_cli("--write")
        self.assertEqual(code, 1)
        self.assertIn("former id tactic:never-routed of tactic:binh-thanh has no retired slug", err)

    def test_tactic_without_lookup_former_ids_is_a_data_error(self):
        write_json(self.data / "tactics.json", [{"id": "tactic:binh-thanh", "viet": "Binh Thánh"}])
        self.assertEqual(self.run_cli("--write")[0], 1)


class RealLedgerTest(unittest.TestCase):
    def test_committed_ledger_freezes_the_whole_corpus(self):
        corpus = lrh.load_corpus(REPO_ROOT / "data")
        ledger = json.loads(lrh.DEFAULT_LEDGER_PATH.read_bytes())
        self.assertEqual(lrh.ledger_problems(ledger, corpus), [])
        counts = {group: len(items) for group, items in ledger["handles"].items()}
        self.assertEqual(sum(counts.values()), len(corpus["groups"]["heroes"]) + len(corpus["groups"]["tactics"]) + sum(len(corpus["groups"][g]) for g in ("equipment", "advisors", "troop-mods", "buildings", "books")))
        self.assertEqual(counts["heroes"], len(json.loads((REPO_ROOT / "data/heroes-dict.json").read_bytes())))

    def test_committed_bytes_are_canonical(self):
        ledger = json.loads(lrh.DEFAULT_LEDGER_PATH.read_bytes())
        self.assertEqual(lrh.ledger_bytes(copy.deepcopy(ledger)), lrh.DEFAULT_LEDGER_PATH.read_bytes())

    def test_committed_redirects_match_the_ledger(self):
        ledger = json.loads(lrh.DEFAULT_LEDGER_PATH.read_bytes())
        former = lrh.former_owner_map(REPO_ROOT / "data")
        self.assertEqual(lrh.DEFAULT_REDIRECTS_PATH.read_bytes(), lrh.redirects_bytes(former, ledger))
        tactics = json.loads((REPO_ROOT / "data/tactics.json").read_bytes())
        pairs = sum(len(row["lookup"]["formerIds"]) for row in tactics)
        rules = [line for line in lrh.DEFAULT_REDIRECTS_PATH.read_text(encoding="utf-8").splitlines() if not line.startswith("#")]
        self.assertEqual(len(rules), 2 * pairs)
        self.assertTrue(all(line.endswith("/ 301") for line in rules))


if __name__ == "__main__":
    unittest.main()
