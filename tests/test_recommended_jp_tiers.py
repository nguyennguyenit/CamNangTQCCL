"""Bảng khớp tier JP (Kazten S25 時代の英雄) với Đội chuẩn PK-S26: ID tồn tại, mức khớp đúng với generation, đúng mùa."""

import json
import unittest
from collections import defaultdict
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
_TIERS_PATH = _ROOT / "pipeline" / "recommended-jp-tiers.json"
_ALLOWED_TIERS = {"T0", "T0.5", "T1", "T1.5", "T2", "T3"}
_MATCH_KINDS = {"exact", "heroes-only", "none"}
_REVIEW_STATUSES = {"reviewed", "needs-review"}
# Ba đội có ô nguồn không chắc (bảng mục lục, nhãn ảnh và văn bài mâu thuẫn).
_UNCERTAIN_TEAMS = {"雑草魂", "温翊弓", "遼喬槍"}


def _load(relative):
    return json.loads((_ROOT / relative).read_text(encoding="utf-8"))


def _strip(name):
    return (name or "").replace(" ", "")


class _Fixture:
    """Đọc một lần mọi từ điển và generation Recommended đang được `current.json` chọn."""

    def __init__(self):
        self.tiers = json.loads(_TIERS_PATH.read_text(encoding="utf-8"))
        self.lookup_ja = _load("data/lookup-ja.json")["entries"]
        self.ja_index = defaultdict(set)
        for entry_id, entry in self.lookup_ja.items():
            if entry_id.split(":", 1)[0] in ("hero", "tactic"):
                self.ja_index[entry["name"]].add(entry_id)
        self.hero_by_chinese = defaultdict(set)
        for hero in _load("data/heroes-dict.json"):
            for name in [hero["chinese"], *hero.get("aliases", [])]:
                self.hero_by_chinese[_strip(name)].add(hero["id"])
        self.tactic_by_chinese = defaultdict(set)
        for tactic in _load("data/tactics.json"):
            for name in [tactic["chinese"], *tactic.get("aliases", [])]:
                self.tactic_by_chinese[name].add(tactic["id"])
        self.identity_heroes = [entry for entry in _load("pipeline/recommended-identity-map.json")["entries"]
                                if entry["kind"] == "hero"]
        generation = _load("src/data/recommended-reference/current.json")["generationId"]
        base = Path("src/data/recommended-reference") / generation
        self.seasons = _load(base / "seasons.json")
        self.records = _load(base / "index.json")["records"]
        self.do_uy = {item["id"]: item for item in self.tiers["doUyHeroes"]}
        self.do_uy_by_raw = {item["sourceNameRaw"]: item["id"] for item in self.tiers["doUyHeroes"]}
        self.do_uy_by_ja = {item["nameJa"]: item["id"] for item in self.tiers["doUyHeroes"]}
        self.spelling = {item["sourceJa"]: item["nameJa"] for item in self.tiers["tacticSpellingJa"]}

    def resolve_hero_ja(self, name):
        if name in self.do_uy_by_ja:
            return self.do_uy_by_ja[name]
        ids = sorted(i for i in self.ja_index.get(name, ()) if i.startswith("hero:"))
        return ids[0] if len(ids) == 1 else None

    def resolve_tactic_ja(self, name):
        """Khớp theo trường `name` (tên Nhật) của lookup-ja, không theo chữ Hán gốc."""
        name = self.spelling.get(name, name)
        ids = sorted(i for i in self.ja_index.get(name, ()) if i.startswith("tactic:"))
        return ids[0] if len(ids) == 1 else None

    def resolve_hero_raw(self, name_raw):
        key = _strip(name_raw)
        ids = self.hero_by_chinese.get(key, set())
        if len(ids) == 1:
            return next(iter(ids))
        return self.do_uy_by_raw.get(key)

    def resolve_tactic_raw(self, name_raw):
        ids = self.tactic_by_chinese.get(name_raw, set())
        return next(iter(ids)) if len(ids) == 1 else None

    def season_rows(self, season_id):
        return [row for row in self.records if row["sourceSeasonId"] == season_id]

    def row_heroes(self, row):
        return [self.resolve_hero_raw(hero["nameRaw"]) for hero in row["heroes"]]

    def row_tactics(self, row):
        return {self.resolve_hero_raw(hero["nameRaw"]): frozenset(self.resolve_tactic_raw(n) for n in hero["tacticSlotsRaw"])
                for hero in row["heroes"]}


_FIXTURE = None


def _fixture():
    global _FIXTURE
    if _FIXTURE is None:
        _FIXTURE = _Fixture()
    return _FIXTURE


class SchemaTests(unittest.TestCase):
    def test_top_level_shape(self):
        tiers = _fixture().tiers
        self.assertEqual(tiers["schemaVersion"], 1)
        for key in ("name", "url", "publishedAt", "author", "fetchedAt", "seasonJa", "seasonVn", "vnSourceSeasonId"):
            self.assertTrue(tiers["source"].get(key), key)
        self.assertTrue(tiers["source"]["url"].startswith("https://kazten.com/"))
        self.assertEqual(len(tiers["entries"]), 24)

    def test_entry_shape(self):
        names = set()
        for entry in _fixture().tiers["entries"]:
            with self.subTest(team=entry["teamNameJa"]):
                self.assertNotIn(entry["teamNameJa"], names)
                names.add(entry["teamNameJa"])
                self.assertIn(entry["tierJa"], _ALLOWED_TIERS)
                self.assertEqual(len(entry["heroes"]), 3)
                self.assertEqual(len(set(entry["heroes"])), 3)
                self.assertEqual(len(entry["heroesJa"]), 3)
                self.assertEqual([len(pair) for pair in entry["tactics"]], [2, 2, 2])
                self.assertEqual([len(pair) for pair in entry["tacticsJa"]], [2, 2, 2])
                self.assertIn(entry["match"]["kind"], _MATCH_KINDS)
                self.assertIn(entry["reviewStatus"], _REVIEW_STATUSES)
                self.assertEqual(set(entry), {"tierJa", "teamNameJa", "heroesJa", "heroes", "tacticsJa", "tactics",
                                              "match", "reviewStatus", "note"})
                self.assertEqual(set(entry["match"]), {"kind", "recommendedTeamId"})


class SeasonTests(unittest.TestCase):
    def test_source_is_jp_s25_mapped_to_pk_s26(self):
        source = _fixture().tiers["source"]
        self.assertEqual(source["seasonVn"], "PK-S26")
        self.assertEqual(source["vnSourceSeasonId"], "pk-s26")
        self.assertIn("時代の英雄", source["seasonJa"])

    def test_generation_season_is_anh_hung_menh_the(self):
        options = {item["sourceSeasonId"]: item for item in _fixture().seasons["seasonOptions"]}
        self.assertEqual(options["pk-s26"]["nameRaw"], "英雄命世")
        self.assertEqual(options["pk-s26"]["displayCode"], "PK-S26")


class DictionaryTests(unittest.TestCase):
    def test_hero_ids_exist(self):
        fx = _fixture()
        for entry in fx.tiers["entries"]:
            for hero_id in entry["heroes"]:
                with self.subTest(team=entry["teamNameJa"], hero=hero_id):
                    if hero_id.startswith("do-uy:"):
                        self.assertIn(hero_id, fx.do_uy)
                    else:
                        self.assertTrue(hero_id.startswith("hero:"))
                        self.assertIn(hero_id, fx.lookup_ja)

    def test_do_uy_heroes_are_reviewed_identities_outside_lingxi_catalog(self):
        fx = _fixture()
        for item in fx.tiers["doUyHeroes"]:
            with self.subTest(hero=item["id"]):
                self.assertEqual(item["id"], "do-uy:" + item["sourceNameRaw"])
                self.assertNotIn(item["sourceNameRaw"], fx.hero_by_chinese)
                hits = [e for e in fx.identity_heroes if item["sourceNameRaw"] in e["aliases"]]
                self.assertEqual(len(hits), 1)
                self.assertEqual(hits[0]["displayNameVi"], item["displayNameVi"])
                self.assertIn(hits[0]["reviewStatus"], {"reviewed", "translation-reviewed"})

    def test_tactic_ids_exist(self):
        fx = _fixture()
        for entry in fx.tiers["entries"]:
            for tactic_id in (t for pair in entry["tactics"] for t in pair):
                with self.subTest(team=entry["teamNameJa"], tactic=tactic_id):
                    self.assertTrue(tactic_id.startswith("tactic:"))
                    self.assertIn(tactic_id, fx.lookup_ja)

    def test_japanese_names_resolve_to_recorded_ids(self):
        fx = _fixture()
        for entry in fx.tiers["entries"]:
            with self.subTest(team=entry["teamNameJa"]):
                self.assertEqual([fx.resolve_hero_ja(n) for n in entry["heroesJa"]], entry["heroes"])
                self.assertEqual([[fx.resolve_tactic_ja(n) for n in pair] for pair in entry["tacticsJa"]],
                                 entry["tactics"])

    def test_spelling_table_targets_existing_japanese_names(self):
        fx = _fixture()
        for source, target in fx.spelling.items():
            with self.subTest(source=source):
                self.assertNotEqual(source, target)
                self.assertIsNotNone(fx.resolve_tactic_ja(target))

    def test_resolution_uses_japanese_name_not_original_glyphs(self):
        # 金城湯池 là tên Nhật của 固若金湯; chiến pháp có chữ Hán 金城湯池 mang tên Nhật 湯池鉄城.
        fx = _fixture()
        self.assertEqual(fx.resolve_tactic_ja("金城湯池"), "tactic:co-nhuoc-kim-thang")
        self.assertEqual(fx.resolve_tactic_ja("湯池鉄城"), "tactic:kim-thanh-thang-tri")


class MatchTests(unittest.TestCase):
    def test_match_kind_agrees_with_pk_s26_generation(self):
        fx = _fixture()
        season = fx.tiers["source"]["vnSourceSeasonId"]
        rows = fx.season_rows(season)
        self.assertTrue(rows)
        for entry in fx.tiers["entries"]:
            with self.subTest(team=entry["teamNameJa"]):
                heroes = set(entry["heroes"])
                candidates = {row["sourceConfigId"]: row for row in rows if set(fx.row_heroes(row)) == heroes}
                team_id = entry["match"]["recommendedTeamId"]
                if entry["match"]["kind"] == "none":
                    self.assertIsNone(team_id)
                    self.assertEqual(candidates, {})
                    continue
                self.assertIn(team_id, candidates)
                wanted = {h: frozenset(pair) for h, pair in zip(entry["heroes"], entry["tactics"])}
                exact = fx.row_tactics(candidates[team_id]) == wanted
                self.assertEqual(entry["match"]["kind"], "exact" if exact else "heroes-only")
                if not exact:
                    self.assertFalse(any(fx.row_tactics(row) == wanted for row in candidates.values()),
                                     "có hàng khớp exact nhưng entry trỏ hàng khác")

    def test_recommended_team_ids_exist_in_pk_s26(self):
        fx = _fixture()
        by_id = {row["sourceConfigId"]: row for row in fx.records}
        for entry in fx.tiers["entries"]:
            team_id = entry["match"]["recommendedTeamId"]
            if team_id is not None:
                with self.subTest(team=entry["teamNameJa"]):
                    self.assertIn(team_id, by_id)
                    self.assertEqual(by_id[team_id]["sourceSeasonId"], "pk-s26")

    def test_same_team_with_different_tiers_needs_note(self):
        groups = defaultdict(list)
        for entry in _fixture().tiers["entries"]:
            if entry["match"]["recommendedTeamId"] is not None:
                groups[entry["match"]["recommendedTeamId"]].append(entry)
        for team_id, entries in groups.items():
            if len({entry["tierJa"] for entry in entries}) > 1:
                for entry in entries:
                    with self.subTest(team=team_id, entry=entry["teamNameJa"]):
                        self.assertTrue(entry["note"].strip())


class ReviewTests(unittest.TestCase):
    def test_uncertain_source_cells_are_needs_review_with_note(self):
        entries = {entry["teamNameJa"]: entry for entry in _fixture().tiers["entries"]}
        for name in _UNCERTAIN_TEAMS:
            with self.subTest(team=name):
                self.assertEqual(entries[name]["reviewStatus"], "needs-review")
                self.assertTrue(entries[name]["note"].strip())

    def test_needs_review_entries_have_note(self):
        for entry in _fixture().tiers["entries"]:
            if entry["reviewStatus"] == "needs-review":
                with self.subTest(team=entry["teamNameJa"]):
                    self.assertTrue(entry["note"].strip())


if __name__ == "__main__":
    unittest.main()
