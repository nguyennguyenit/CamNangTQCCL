"""pipeline/suggest_aliases.py — chỉ đề xuất cụm typo thật, quét đúng nguồn đội đang publish."""

import os
import unittest
from unittest import mock

from pipeline import build_json
from pipeline import suggest_aliases


def _hero(name_raw):
    return {"nameRaw": name_raw, "cp1Raw": "", "cp2Raw": "", "booksRaw": []}


class SuggestAliasesTest(unittest.TestCase):
    def test_variants_and_known_aliases_are_not_suggested(self):
        raw = {
            "team-intro": [{"heroesRaw": [_hero("SP Tuân Úc"), _hero("Tôn Thương Hương"), _hero("SP Đổng Trách")]}],
            "moi-phe": [{"heroesRaw": [_hero("SP Tuân Úc(S)"), _hero("Tôn Thượng Hương"), _hero("Đổng Trác")]}],
        }
        scanned = []

        def parse(path, source, _hint):
            scanned.append(path)
            return raw[source]

        aliases = {
            "heroes": {"Tôn Thương Hương": "Tôn Thượng Hương"},
            "heroNames": {"Đổng Trách": "Đổng Trác"},
            "tactics": {},
            "books": {},
        }
        with mock.patch.object(suggest_aliases, "parse_team_intro", side_effect=parse), \
                mock.patch.object(suggest_aliases, "load_aliases", return_value=aliases):
            counts = suggest_aliases.collect_counts()

        self.assertEqual(
            scanned,
            [os.path.join(build_json._SRC, fname) for fname, *_ in build_json._TEAM_FILES],
        )
        self.assertEqual(suggest_aliases.clusters(counts["heroes"]), [])
        self.assertNotIn("Tôn Thương Hương", counts["heroes"])
        self.assertNotIn("Đổng Trách", counts["heroes"])


if __name__ == "__main__":
    unittest.main()
