"""Test build: tổng team đúng, deterministic, JSON UTF-8 hợp lệ, alias giảm distinct."""

import json
import os
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pipeline import build_json  # noqa: E402

BASE = os.path.join(os.path.dirname(__file__), "..", "Meta Team PK")


def _has_sources():
    return os.path.exists(os.path.join(BASE, "Team giới thiệu(mới).html"))


@unittest.skipUnless(_has_sources(), "nguồn HTML không có")
class TestBuild(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.teams = build_json.build_teams()

    def test_total_count(self):
        self.assertEqual(len(self.teams), 166)

    def test_published_sources_exclude_do_uy(self):
        self.assertEqual({t["source"] for t in self.teams}, {"team-intro", "moi-phe"})

    def test_team_shape(self):
        t = self.teams[0]
        for key in ("id", "source", "unitType", "stars", "status", "heroes", "counters", "notes"):
            self.assertIn(key, t)
        self.assertTrue(t["heroes"])
        self.assertIn("good", t["counters"])

    def test_deterministic(self):
        again = build_json.build_teams()
        self.assertEqual(self.teams, again)

    def test_alias_reduces_distinct(self):
        # Sau alias, không còn các typo đã khai trong tập tactics.
        names = set()
        for t in self.teams:
            for h in t["heroes"]:
                for grp in h["tactics"]:
                    names.add(grp["name"])
                    names.update(grp["alternatives"])
        self.assertNotIn("Thịnh Khí Lăng Địch", names)
        self.assertNotIn("Phong Thị Trận", names)

    def test_facets_nonempty(self):
        facets = build_json.build_facets(self.teams)
        self.assertGreater(len(facets["tactics"]), 50)
        self.assertTrue(all("count" in x for x in facets["heroes"]))

    def test_moi_phe_out_meta(self):
        moi = [t for t in self.teams if t["source"] == "moi-phe"]
        self.assertTrue(moi)
        self.assertTrue(all(t["status"] == "out-meta" for t in moi))


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _read_data(name):
    with open(os.path.join(ROOT, "data", name), encoding="utf-8") as fh:
        return fh.read()


@unittest.skipUnless(_has_sources(), "nguồn HTML không có")
class TestRebuildReproducesCommitted(unittest.TestCase):
    """Rebuild từ HTML + input curate phải trùng byte artifact đang commit."""

    def test_teams_and_facets_bytes_match_committed(self):
        teams = build_json.build_teams(committed=build_json.load_committed_teams())
        self.assertEqual(build_json.render_json(teams), _read_data("teams.json"))
        self.assertEqual(build_json.render_json(build_json.build_facets(teams)), _read_data("facets.json"))


def _raw(source, *names):
    return {
        "source": source,
        "rawType": "",
        "heroesRaw": [{"nameRaw": n, "booksRaw": []} for n in names],
    }


def _committed(team_id, *names):
    source = team_id.rsplit("-", 1)[0]
    return {"id": team_id, "source": source, "heroes": [{"baseName": n} for n in names]}


class TestStableTeamIds(unittest.TestCase):
    """Rebuild giữ ID đã công khai theo (nguồn, tập tướng), không đánh số lại."""

    def _build(self, raw_by_source, committed, supplement=()):
        files = [
            ("intro.html", "team-intro", None, len(raw_by_source["team-intro"])),
            ("moi.html", "moi-phe", "out-meta", len(raw_by_source["moi-phe"])),
        ]
        empty = {"heroes": {}, "tactics": {}, "books": {}}
        with mock.patch.object(build_json, "_TEAM_FILES", files), \
                mock.patch.object(build_json, "load_aliases", return_value=empty), \
                mock.patch.object(build_json, "load_nicknames", return_value={}), \
                mock.patch.object(build_json, "load_supplement", return_value=list(supplement)), \
                mock.patch.object(build_json, "parse_team_intro",
                                  side_effect=lambda _path, src, _hint: raw_by_source[src]):
            return build_json.build_teams(committed=committed)

    def test_keeps_committed_ids_and_numbers_new_teams_per_source(self):
        committed = [
            _committed("team-intro-0", "A", "B", "C"),
            _committed("moi-phe-62", "D", "E", "F"),
            _committed("moi-phe-63", "G", "H", "I"),
        ]
        teams = self._build({
            "team-intro": [_raw("team-intro", "C", "B", "A"), _raw("team-intro", "J", "K", "L")],
            "moi-phe": [
                _raw("moi-phe", "G", "H", "I"),
                _raw("moi-phe", "F", "E", "D"),
                _raw("moi-phe", "M", "N", "O"),
            ],
        }, committed)
        self.assertEqual(
            [t["id"] for t in teams],
            ["team-intro-0", "team-intro-1", "moi-phe-63", "moi-phe-62", "moi-phe-64"],
        )

    def test_duplicate_hero_sets_keep_committed_order(self):
        committed = [_committed("moi-phe-62", "D", "E", "F"), _committed("moi-phe-70", "D", "E", "F")]
        teams = self._build({
            "team-intro": [],
            "moi-phe": [_raw("moi-phe", "D", "E", "F"), _raw("moi-phe", "E", "D", "F")],
        }, committed)
        self.assertEqual([t["id"] for t in teams], ["moi-phe-62", "moi-phe-70"])

    def test_committed_team_missing_from_source_is_refused(self):
        committed = [_committed("moi-phe-62", "D", "E", "F"), _committed("moi-phe-99", "X", "Y", "Z")]
        with self.assertRaises(SystemExit) as ctx:
            self._build({"team-intro": [], "moi-phe": [_raw("moi-phe", "D", "E", "F")]}, committed)
        self.assertIn("moi-phe-99", str(ctx.exception))
        self.assertNotIn("moi-phe-62", str(ctx.exception))

    def test_supplement_teams_follow_html_sources_and_keep_ids(self):
        record = {"source": "team-intro", "name": "Curated", "heroes": [{"baseName": "P"}, {"baseName": "Q"}]}
        new = {"source": "team-intro", "name": "New", "heroes": [{"baseName": "R"}]}
        committed = [_committed("team-intro-0", "A"), _committed("moi-phe-62", "D"), _committed("team-intro-1", "Q", "P")]
        teams = self._build(
            {"team-intro": [_raw("team-intro", "A")], "moi-phe": [_raw("moi-phe", "D")]},
            committed,
            supplement=[record, new],
        )
        self.assertEqual([t["id"] for t in teams], ["team-intro-0", "moi-phe-62", "team-intro-1", "team-intro-2"])
        self.assertEqual(teams[2], {"id": "team-intro-1", **record})
        self.assertEqual(list(teams[2])[:2], ["id", "source"])


class TestNicknameScope(unittest.TestCase):
    """Nickname chuỗi chỉ đặt tên Team PK; nickname có ``sources`` áp đúng các nguồn đó."""

    def test_string_nickname_names_team_pk_only_and_sources_widen_scope(self):
        files = [("intro.html", "team-intro", None, 2), ("moi.html", "moi-phe", "out-meta", 2)]
        empty = {"heroes": {}, "tactics": {}, "books": {}}
        raw_by_source = {
            "team-intro": [_raw("team-intro", "A", "B"), _raw("team-intro", "C", "D")],
            "moi-phe": [_raw("moi-phe", "B", "A"), _raw("moi-phe", "D", "C")],
        }
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "nicknames.json")
            with open(path, "w", encoding="utf-8") as fh:
                json.dump({"B|A": "PK", "C|D": {"nickname": "Both", "sources": ["team-intro", "moi-phe"]}}, fh)
            real_load = build_json.load_nicknames
            with mock.patch.object(build_json, "_TEAM_FILES", files), \
                    mock.patch.object(build_json, "load_aliases", return_value=empty), \
                    mock.patch.object(build_json, "load_nicknames",
                                      side_effect=lambda source: real_load(path, source=source)), \
                    mock.patch.object(build_json, "load_supplement", return_value=[]), \
                    mock.patch.object(build_json, "parse_team_intro",
                                      side_effect=lambda _path, src, _hint: raw_by_source[src]):
                teams = build_json.build_teams()
        self.assertEqual(
            [(t["source"], t["nickname"]) for t in teams],
            [("team-intro", "PK"), ("team-intro", "Both"), ("moi-phe", None), ("moi-phe", "Both")],
        )


class TestMainOutputs(unittest.TestCase):
    """Mặc định chỉ ghi teams/facets; coexist/khaihoang curate chỉ bị ghi khi có cờ."""

    TEAMS = [{"id": "team-intro-0", "source": "team-intro", "unitType": [], "stars": None, "faction": None,
              "status": "meta", "heroes": []}]

    def _run(self, out, argv):
        with mock.patch.object(build_json, "_OUT", out), \
                mock.patch.object(build_json, "build_teams", return_value=self.TEAMS), \
                mock.patch.object(build_json, "parse_coexist", return_value=[]) as parse_coexist, \
                mock.patch.object(build_json, "group_coexist", return_value=[{"g": 1}]), \
                mock.patch.object(build_json, "build_khaihoang_payload",
                                  return_value={"teams": [1], "mines": [1], "chamSuTeams": []}):
            code = build_json.main(argv)
        return code, parse_coexist.called

    def test_default_leaves_curated_files_untouched(self):
        with tempfile.TemporaryDirectory() as out:
            with open(os.path.join(out, "coexist.json"), "w", encoding="utf-8") as fh:
                fh.write("curated")
            code, parsed = self._run(out, [])
            self.assertEqual(code, 0)
            self.assertFalse(parsed)
            self.assertEqual(sorted(os.listdir(out)), ["coexist.json", "facets.json", "teams.json"])
            with open(os.path.join(out, "coexist.json"), encoding="utf-8") as fh:
                self.assertEqual(fh.read(), "curated")
            with open(os.path.join(out, "teams.json"), encoding="utf-8") as fh:
                self.assertEqual(fh.read(), build_json.render_json(self.TEAMS))

    def test_explicit_flag_overwrites_curated_files(self):
        with tempfile.TemporaryDirectory() as out:
            code, _ = self._run(out, ["--overwrite-curated"])
            self.assertEqual(code, 0)
            self.assertEqual(
                sorted(os.listdir(out)),
                ["coexist.json", "facets.json", "khaihoang.json", "teams.json"],
            )

    def test_check_reports_drift_without_writing(self):
        with tempfile.TemporaryDirectory() as out:
            self.assertEqual(self._run(out, []), (0, False))
            self.assertEqual(self._run(out, ["--check"])[0], 0)
            with open(os.path.join(out, "facets.json"), "w", encoding="utf-8") as fh:
                fh.write("stale")
            self.assertEqual(self._run(out, ["--check"])[0], 1)
            with open(os.path.join(out, "facets.json"), encoding="utf-8") as fh:
                self.assertEqual(fh.read(), "stale")


class TestCommittedFacets(unittest.TestCase):
    """data/facets.json phải là build_facets của data/teams.json đang commit."""

    def test_facets_match_committed_teams(self):
        root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        with open(os.path.join(root, "data", "teams.json"), encoding="utf-8") as fh:
            teams = json.load(fh)
        with open(os.path.join(root, "data", "facets.json"), encoding="utf-8") as fh:
            facets = json.load(fh)
        self.assertEqual(sum(x["count"] for x in facets["sources"]), len(teams))
        self.assertEqual(sum(x["count"] for x in facets["statuses"]), len(teams))
        self.assertEqual(facets, build_json.build_facets(teams))


if __name__ == "__main__":
    unittest.main()
