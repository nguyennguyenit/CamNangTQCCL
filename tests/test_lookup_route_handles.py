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
        "qilueStrategies": [{"id": "qilue-strategy:cuong-cong", "nameVi": "Cường Công"}],
        "qilueCards": [{"id": "qilue-card:bo-tri-thap-dien", "nameVi": "Bố Trí Thập Diện"}],
    })
    write_json(data / "books-dict.json", books if books is not None else [
        {"id": "book:binh-hanh-quy-dao", "viet": "Binh Hành Quỷ Đạo", "chinese": "兵行诡道"},
        {"id": "book:han-viet-thu", "hanViet": "Hán Việt Thư"},
    ])
    return data


class LookupLedgerTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.tmp, True)
        self.data = make_data(self.tmp)
        self.ledger = self.tmp / "ledger.json"
        self.redirects = self.tmp / "_redirects"
        self.recommended = self.tmp / "recommended"

    def run_cli(self, *args):
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = lrh.main([*args, "--data-dir", str(self.data), "--ledger", str(self.ledger), "--redirects", str(self.redirects), "--recommended-root", str(self.recommended)])
        return code, out.getvalue(), err.getvalue()

    def write_registry(self, default_id, options=(("og-兵演春秋", "OG"), ("pk-s24", "PK-S24"))):
        generation = "1" * 64
        (self.recommended / generation).mkdir(parents=True, exist_ok=True)
        write_json(self.recommended / "current.json", {"schemaVersion": 1, "generationId": generation, "manifestSha256": "0" * 64})
        write_json(self.recommended / generation / "seasons.json", {
            "defaultSourceSeasonId": default_id,
            "seasonOptions": [{"sourceSeasonId": season, "displayCode": code} for season, code in options],
        })

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

    def test_qilue_group_lists_strategies_then_cards_under_two_kinds(self):
        self.assertEqual(lrh.GROUP_KINDS["qilue"], ("qilue-strategy", "qilue-card"))
        self.assertTrue(all(isinstance(kinds, tuple) and kinds for kinds in lrh.GROUP_KINDS.values()))
        corpus = lrh.load_corpus(self.data)
        self.assertEqual(corpus["groups"]["qilue"], [("qilue-strategy:cuong-cong", "Cường Công"), ("qilue-card:bo-tri-thap-dien", "Bố Trí Thập Diện")])
        self.assertEqual(self.run_cli("--write")[0], 0)
        self.assertEqual(self.handles()["qilue"], {"qilue-strategy:cuong-cong": "cuong-cong", "qilue-card:bo-tri-thap-dien": "bo-tri-thap-dien"})
        self.assertEqual(self.run_cli("--check")[0], 0)

    def test_corpus_rejects_an_id_of_another_kind_and_a_missing_catalog_key(self):
        catalog = json.loads((self.data / "lookup-catalog.json").read_text(encoding="utf-8"))
        wrong = copy.deepcopy(catalog)
        wrong["qilueStrategies"].append({"id": "tactic:cuong-cong", "nameVi": "Cường Công"})
        write_json(self.data / "lookup-catalog.json", wrong)
        with self.assertRaisesRegex(lrh.LookupRouteHandleError, "qilue.*tactic:cuong-cong"):
            lrh.load_corpus(self.data)
        for key in ("qilueStrategies", "qilueCards"):
            missing = copy.deepcopy(catalog)
            missing.pop(key)
            write_json(self.data / "lookup-catalog.json", missing)
            with self.subTest(key=key), self.assertRaisesRegex(lrh.LookupRouteHandleError, key):
                lrh.load_corpus(self.data)

    def drop_group(self, group, *, handles=True, retired=True, redigest=True):
        """Ledger written before `group` existed: the section is absent and the digest covers only the others."""
        def mutate(ledger):
            if handles:
                ledger["handles"].pop(group)
            if retired:
                ledger["retired"].pop(group)
        self.edit_ledger(mutate, redigest=redigest)

    def test_write_adds_a_known_group_missing_from_an_older_ledger(self):
        self.assertEqual(self.run_cli("--write")[0], 0)
        before = self.handles()
        self.drop_group("qilue")
        self.assertEqual(self.run_cli("--check")[0], 1)  # --check never migrates
        self.assertEqual(self.run_cli("--write")[0], 0)
        self.assertEqual(self.handles(), before)
        self.assertEqual(json.loads(self.ledger.read_text(encoding="utf-8"))["retired"]["qilue"], {})
        self.assertEqual(self.run_cli("--check")[0], 0)

    def test_write_refuses_other_edits_of_a_ledger_missing_a_group(self):
        cases = {
            "edited by hand": lambda: (self.drop_group("qilue"), self.edit_ledger(lambda l: l["handles"]["heroes"].update({"hero:dang-ai": "hand-edited"}))),
            "groups must be exactly": lambda: self.drop_group("qilue", retired=False),
            "groups must be exactly ": lambda: self.drop_group("qilue", handles=False),
            "groups must be exactly  ": lambda: self.edit_ledger(lambda l: (l["handles"].update({"other": {}}), l["retired"].update({"other": {}})), redigest=True),
        }
        for label, damage in cases.items():
            with self.subTest(label.strip()):
                self.ledger.unlink(missing_ok=True)
                self.assertEqual(self.run_cli("--write")[0], 0)
                damage()
                tampered = self.ledger.read_bytes()
                code, _, err = self.run_cli("--write")
                self.assertEqual(code, 1)
                self.assertIn(label.strip(), err)
                self.assertEqual(self.ledger.read_bytes(), tampered)

    def test_book_ids_are_read_from_rows_never_derived_from_names(self):
        self.assertEqual(self.run_cli("--write")[0], 0)
        before = self.handles()["books"]
        write_json(self.data / "books-dict.json", [
            {"id": "book:binh-hanh-quy-dao", "viet": "Tên Việt Mới", "chinese": "兵行诡道", "aliases": ["Binh Hành Quỷ Đạo"]},
            {"id": "book:han-viet-thu", "hanViet": "Hán Việt Thư"},
        ])
        corpus = lrh.load_corpus(self.data)
        self.assertEqual(corpus["groups"]["books"][0], ("book:binh-hanh-quy-dao", "Tên Việt Mới"))
        self.assertEqual(self.run_cli("--write")[0], 0)
        self.assertEqual(self.handles()["books"], before)
        self.assertEqual(self.run_cli("--check")[0], 0)

    def test_book_row_without_valid_id_fails_closed(self):
        for row in ({"viet": "Không Id"}, {"id": "", "viet": "Rỗng"}, {"id": "book:Sai-Dang", "viet": "Sai"}, {"id": "tactic:x", "viet": "Sai Loại"}):
            write_json(self.data / "books-dict.json", [row])
            with self.subTest(row), self.assertRaises(lrh.LookupRouteHandleError):
                lrh.load_corpus(self.data)

    def test_ledger_note_does_not_claim_names_never_derive_book_ids(self):
        self.assertNotIn("không suy lại từ tên Việt", lrh.LEDGER_NOTE)
        self.assertIn("binh thư", lrh.LEDGER_NOTE.lower())
        self.assertIn("books-han-viet-map", lrh.LEDGER_NOTE)

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
        write_json(self.data / "books-dict.json", [{"id": "book:binh-hanh-quy-dao", "viet": "Binh Hành Quỷ Đạo"}, {"id": "book:han-viet-thu", "viet": "Hán Việt Thư"}])
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
        self.assertEqual(lrh.REDIRECT_LOCALE_PREFIXES, ("", "/zh", "/ja"))
        self.assertEqual(self.redirects.read_text(encoding="utf-8"), "\n".join([
            lrh.REDIRECTS_HEADER,
            *(f"{prefix}/tra-cuu/chien-phap/cu/ {prefix}/tra-cuu/chien-phap/binh-thanh/ 301" for prefix in lrh.REDIRECT_LOCALE_PREFIXES),
        ]) + "\n")
        self.assertEqual(self.run_cli("--check")[0], 0)

    def test_current_season_slug_is_301_to_the_list_and_follows_the_default_season(self):
        self.merge_tactic()
        self.write_registry("og-兵演春秋")
        self.assertEqual(self.run_cli("--write")[0], 0)
        lines = self.redirects.read_text(encoding="utf-8").splitlines()
        self.assertEqual(lines[-3:], [f"{prefix}/doi-chuan/og/ {prefix}/doi-chuan/ 301" for prefix in lrh.REDIRECT_LOCALE_PREFIXES])
        self.assertEqual(self.run_cli("--check")[0], 0)
        # The default season changes: the committed rule is stale until regenerated, then it follows the new season.
        self.write_registry("pk-s24")
        code, _, err = self.run_cli("--check")
        self.assertEqual(code, 1)
        self.assertIn("is stale; run --write", err)
        self.assertEqual(self.run_cli("--write")[0], 0)
        lines = self.redirects.read_text(encoding="utf-8").splitlines()
        self.assertEqual(lines[-3:], [f"{prefix}/doi-chuan/pk-s24/ {prefix}/doi-chuan/ 301" for prefix in lrh.REDIRECT_LOCALE_PREFIXES])
        self.assertNotIn("/doi-chuan/og/ /doi-chuan/ 301", lines)
        self.assertEqual(self.run_cli("--check")[0], 0)

    def test_registry_without_a_default_season_adds_no_rule_and_a_bad_code_is_an_error(self):
        self.write_registry(None)
        self.assertEqual(lrh.season_redirect_lines(self.recommended), [])
        self.write_registry("og-兵演春秋", options=(("og-兵演春秋", "兵演"),))
        with self.assertRaisesRegex(lrh.LookupRouteHandleError, "no usable page slug"):
            lrh.season_redirect_lines(self.recommended)

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
        self.assertEqual(sum(counts.values()), len(corpus["groups"]["heroes"]) + len(corpus["groups"]["tactics"]) + sum(len(corpus["groups"][g]) for g in ("equipment", "advisors", "troop-mods", "buildings", "books", "qilue")))
        self.assertEqual(counts["heroes"], len(json.loads((REPO_ROOT / "data/heroes-dict.json").read_bytes())))

    def test_committed_bytes_are_canonical(self):
        ledger = json.loads(lrh.DEFAULT_LEDGER_PATH.read_bytes())
        self.assertEqual(lrh.ledger_bytes(copy.deepcopy(ledger)), lrh.DEFAULT_LEDGER_PATH.read_bytes())

    def test_committed_redirects_match_the_ledger(self):
        ledger = json.loads(lrh.DEFAULT_LEDGER_PATH.read_bytes())
        former = lrh.former_owner_map(REPO_ROOT / "data")
        season = lrh.season_redirect_lines(lrh.DEFAULT_RECOMMENDED_ROOT)
        self.assertEqual(len(season), len(lrh.REDIRECT_LOCALE_PREFIXES), "the pinned registry has a current season, so one rule per locale")
        self.assertEqual(lrh.DEFAULT_REDIRECTS_PATH.read_bytes(), lrh.redirects_bytes(former, ledger, season))
        tactics = json.loads((REPO_ROOT / "data/tactics.json").read_bytes())
        pairs = sum(len(row["lookup"]["formerIds"]) for row in tactics)
        rules = [line for line in lrh.DEFAULT_REDIRECTS_PATH.read_text(encoding="utf-8").splitlines() if not line.startswith("#")]
        self.assertEqual(len(rules), len(lrh.REDIRECT_LOCALE_PREFIXES) * (pairs + 1))
        self.assertTrue(all(line.endswith("/ 301") for line in rules))



class RealLedgerQilueMigrationTest(unittest.TestCase):
    """The committed 7-group ledger gains the Kỳ lược group on `--write` without touching a frozen slug."""

    def setUp(self):
        from pipeline import build_unified_lookup as lookup
        self.tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.tmp, True)
        self.data = self.tmp / "data"
        for name in ("lookup-manifest.json", "heroes-dict.json", "tactics.json", "lookup-catalog.json", "books-dict.json"):
            self.data.mkdir(exist_ok=True)
            shutil.copy(REPO_ROOT / "data" / name, self.data / name)
        catalog = json.loads((self.data / "lookup-catalog.json").read_bytes())
        if "qilueStrategies" not in catalog:  # data/ chưa promote nhóm Kỳ lược: thêm đúng hàng client vào bản sao
            strategies, cards = lookup._client_qilue(json.loads((REPO_ROOT / "pipeline" / "lookup-client-tactics.json").read_bytes()))
            catalog.update(qilueStrategies=strategies, qilueCards=cards)
            write_json(self.data / "lookup-catalog.json", catalog)
        self.ledger = self.tmp / "ledger.json"
        self.before = json.loads(lrh.DEFAULT_LEDGER_PATH.read_bytes())
        if "qilue" in self.before["handles"]:  # ledger đã có nhóm Kỳ lược: dựng lại đúng dạng 7 nhóm trước đó
            for section in ("handles", "retired"):
                self.before[section].pop("qilue")
            self.before["handlesSha256"] = lrh.handles_digest(self.before["handles"], self.before["retired"])
        self.ledger.write_bytes(lrh.ledger_bytes(self.before))
        self.redirects = self.tmp / "_redirects"
        shutil.copy(lrh.DEFAULT_REDIRECTS_PATH, self.redirects)

    def run_cli(self, *args):
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = lrh.main([*args, "--data-dir", str(self.data), "--ledger", str(self.ledger), "--redirects", str(self.redirects)])
        return code, err.getvalue()

    def test_write_appends_45_qilue_handles_and_keeps_every_frozen_slug(self):
        self.assertEqual(set(self.before["handles"]), set(lrh.GROUP_KINDS) - {"qilue"})
        code, err = self.run_cli("--write")
        self.assertEqual(code, 0, err)
        after = json.loads(self.ledger.read_bytes())
        qilue = after["handles"].pop("qilue")
        self.assertEqual(after["retired"].pop("qilue"), {})
        self.assertEqual((after["handles"], after["retired"]), (self.before["handles"], self.before["retired"]))
        self.assertEqual(len(qilue), 45)
        self.assertEqual(qilue["qilue-card:bo-tri-thap-dien"], "bo-tri-thap-dien")
        self.assertEqual(qilue["qilue-strategy:cuong-cong"], "cuong-cong")
        self.assertEqual(self.run_cli("--check"), (0, ""))

    def test_write_still_refuses_a_hand_edited_committed_ledger(self):
        ledger = json.loads(self.ledger.read_bytes())
        ledger["handles"]["heroes"]["hero:luu-bi"] = "luu-bi-sua-tay"
        self.ledger.write_text(json.dumps(ledger, ensure_ascii=False), encoding="utf-8")
        tampered = self.ledger.read_bytes()
        code, err = self.run_cli("--write")
        self.assertEqual(code, 1)
        self.assertIn("edited by hand", err)
        self.assertEqual(self.ledger.read_bytes(), tampered)


class RealBooksRenameTest(unittest.TestCase):
    """Renaming a real book's `viet` (old name into `aliases`) keeps its id, so the real ledger stays frozen."""

    def test_rename_on_real_map_and_facets_keeps_ledger_handles(self):
        from pipeline import build_books_dict as bbd
        tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, tmp, True)
        data = tmp / "data"
        shutil.copytree(REPO_ROOT / "data", data)
        facets = json.loads((data / "facets.json").read_text(encoding="utf-8"))
        facet_books = [b["value"] for b in facets["books"]]
        book_map = bbd._load_map()
        chinese = next(c for c, e in book_map.items() if e["viet"] == "Dĩ Trực Báo Oán")
        book_map[chinese]["viet"] = "Lấy Thẳng Báo Oán"
        book_map[chinese]["aliases"] = ["Dĩ Trực Báo Oán"]
        rows = bbd.build_books_dict(book_map, facet_books)
        (data / "books-dict.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        ledger = tmp / "ledger.json"
        shutil.copy(REPO_ROOT / "pipeline" / "lookup-route-handles.json", ledger)
        before = json.loads(ledger.read_text(encoding="utf-8"))
        redirects = tmp / "_redirects"
        shutil.copy(REPO_ROOT / "public" / "_redirects", redirects)
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = lrh.main(["--write", "--data-dir", str(data), "--ledger", str(ledger), "--redirects", str(redirects)])
            check = lrh.main(["--check", "--data-dir", str(data), "--ledger", str(ledger), "--redirects", str(redirects)])
        self.assertEqual((code, check), (0, 0), err.getvalue())
        after = json.loads(ledger.read_text(encoding="utf-8"))
        self.assertEqual(after["handles"], before["handles"])
        self.assertEqual(after["retired"]["books"], {})
        self.assertEqual(after["handles"]["books"]["book:di-truc-bao-oan"], "di-truc-bao-oan")
        self.assertEqual(len(after["handles"]["books"]), 68)


if __name__ == "__main__":
    unittest.main()
