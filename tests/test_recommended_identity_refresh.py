import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from pipeline import recommended_identity_refresh as refresh
from pipeline.recommended_identity import build_display_mapping, build_mapping, resolve_display_name, resolve_identity


def _bytes(rows):
    return json.dumps(rows, ensure_ascii=False).encode()


EXISTING = {
    "schemaVersion": 1,
    "evidenceInputs": {"heroes-dict.json": "sha256:old"},
    "entries": [
        {"kind": "hero", "stableId": "hero:old-lu-bu", "variant": "base", "aliases": ["Lữ Bố", "吕布"],
         "displayNameVi": "Lữ Bố", "faction": "Quần", "reviewStatus": "reviewed", "evidenceRef": "heroes-dict.json#1"},
        {"kind": "hero", "variant": "40Y", "aliases": ["40Y 呂布"], "displayNameVi": "40Y Lữ Bố",
         "reviewStatus": "translation-reviewed", "evidenceRef": "user-confirmed:40Y"},
        {"kind": "tactic", "stableId": "tactic:combat", "variant": None, "aliases": ["勠力同心", "Đồng Lòng Hợp Sức"],
         "displayNameVi": "Đồng Lòng Hợp Sức", "reviewStatus": "reviewed", "evidenceRef": "tactics.json#1"},
        {"kind": "tactic", "stableId": "tactic:internal", "variant": None, "aliases": ["戮力上国"],
         "displayNameVi": "Lục Lực Thượng Quốc", "reviewStatus": "reviewed", "evidenceRef": "tactics.json#2"},
        {"kind": "tactic", "aliases": ["戮力上心"], "displayNameVi": "Đồng Lòng Hợp Sức",
         "reviewStatus": "translation-reviewed", "evidenceRef": "user-confirmed:display-only"},
    ],
}
HEROES = [
    {"chinese": "呂布", "hanViet": "Lữ Bố", "viet": "Lữ Bố", "aliases": ["呂布", "吕布"], "faction": "Quần"},
    {"chinese": "40Y 呂布", "hanViet": "40Y Lữ Bố", "viet": "40Y Lữ Bố", "aliases": ["40Y 呂布", "40Y吕布"], "faction": "Hán"},
    {"chinese": "SP 盧植", "hanViet": "SP Lô Thực", "viet": "SP Lô Thực", "aliases": ["SP 盧植", "SP Lô Trực"], "faction": "Hán"},
]
TACTICS = [
    {"chinese": "戮力上國", "hanViet": "Lục Lực Thượng Quốc", "viet": "Lục Lực Thượng Quốc",
     "aliases": ["戮力上國", "戮力上国", "戮力上心"]},
    {"chinese": "藏器待時", "hanViet": "Tàng Khí Đãi Thì", "viet": "Tàng Khí Đợi Thời", "aliases": ["藏器待時", "藏器待时"]},
]


class IdentityRefreshTest(unittest.TestCase):
    def setUp(self):
        self.refreshed, self.report = refresh.refresh_descriptor(EXISTING, [
            ("hero", "heroes-dict.json", _bytes(HEROES)),
            ("tactic", "tactics.json", _bytes(TACTICS)),
            ("book", "books-dict.json", _bytes([])),
        ])
        self.mapping = build_display_mapping(self.refreshed["entries"])

    def test_existing_entries_keep_identity_and_review_and_only_gain_aliases(self):
        before = EXISTING["entries"]
        after = self.refreshed["entries"][:len(before)]
        for old, new in zip(before, after):
            self.assertEqual({k: v for k, v in old.items() if k not in ("aliases", "aliasEvidence")},
                             {k: v for k, v in new.items() if k not in ("aliases", "aliasEvidence")})
            self.assertLessEqual(set(old["aliases"]), set(new["aliases"]))
        self.assertEqual(resolve_identity("hero", "呂布", self.mapping)["stableId"], "hero:old-lu-bu")
        self.assertEqual(after[0]["aliasEvidence"], {"呂布": ["heroes-dict.json#0"]})

    def test_new_dictionary_rows_become_reviewed_identities_with_vietnamese_and_han_aliases(self):
        lu_bu = resolve_identity("hero", "40Y Lữ Bố", self.mapping)
        self.assertEqual(lu_bu["stableId"], "hero:" + hashlib.sha256("40Y 呂布".encode()).hexdigest()[:24])
        self.assertEqual((lu_bu["variant"], lu_bu["faction"]), ("40Y", "Hán"))
        self.assertEqual(resolve_identity("hero", "40Y 呂布", self.mapping)["stableId"], lu_bu["stableId"])
        self.assertEqual(resolve_identity("hero", "SP Lô Trực", self.mapping)["displayNameVi"], "SP Lô Thực")
        self.assertEqual(resolve_identity("tactic", "Tàng Khí Đợi Thời", self.mapping)["stableId"],
                         resolve_identity("tactic", "藏器待时", self.mapping)["stableId"])
        # Bản duyệt hiển thị vẫn thắng tên từ điển.
        self.assertEqual(resolve_display_name("hero", "40Y 呂布", self.mapping), "40Y Lữ Bố")

    def test_display_only_alias_naming_another_identity_stays_unresolved(self):
        self.assertEqual(resolve_identity("tactic", "戮力上心", self.mapping)["status"], "missing")
        self.assertEqual(resolve_display_name("tactic", "戮力上心", self.mapping), "Đồng Lòng Hợp Sức")
        self.assertIn({"evidenceRef": "tactics.json#0", "alias": "戮力上心", "reason": "display-review-names-other-identity",
                       "displayNameVi": "Đồng Lòng Hợp Sức"}, self.report["skipped"])
        self.assertEqual(resolve_identity("tactic", "戮力上國", self.mapping)["stableId"], "tactic:internal")

    def test_row_touching_two_identities_is_skipped_and_hashes_are_refreshed(self):
        rows = [{"chinese": "X", "viet": "Đồng Lòng Hợp Sức", "aliases": ["戮力上国"]}]
        refreshed, report = refresh.refresh_descriptor(EXISTING, [("tactic", "tactics.json", _bytes(rows))])
        self.assertEqual(refreshed["entries"], EXISTING["entries"])
        self.assertEqual(report["skipped"][0]["reason"], "matches-several-identities")
        self.assertEqual(refreshed["evidenceInputs"]["tactics.json"], "sha256:" + hashlib.sha256(_bytes(rows)).hexdigest())
        self.assertEqual(refreshed["evidenceInputs"]["heroes-dict.json"], "sha256:old")

    def test_refresh_is_idempotent_and_cli_check_does_not_write(self):
        again, report = refresh.refresh_descriptor(self.refreshed, [
            ("hero", "heroes-dict.json", _bytes(HEROES)),
            ("tactic", "tactics.json", _bytes(TACTICS)),
            ("book", "books-dict.json", _bytes([])),
        ])
        self.assertEqual(again, self.refreshed)
        self.assertEqual((report["added"], report["extended"]), ([], []))
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            paths = {name: root / name for name in ("map.json", "heroes.json", "tactics.json", "books.json")}
            paths["map.json"].write_text(json.dumps(EXISTING, ensure_ascii=False), encoding="utf-8")
            paths["heroes.json"].write_bytes(_bytes(HEROES))
            paths["tactics.json"].write_bytes(_bytes(TACTICS))
            paths["books.json"].write_bytes(_bytes([]))
            argv = ["--identity-map", str(paths["map.json"]), "--heroes", str(paths["heroes.json"]),
                    "--tactics", str(paths["tactics.json"]), "--books", str(paths["books.json"])]
            refresh.main([*argv, "--check"])
            self.assertEqual(json.loads(paths["map.json"].read_text(encoding="utf-8")), EXISTING)
            refresh.main(argv)
            written = json.loads(paths["map.json"].read_text(encoding="utf-8"))
            self.assertEqual(len(build_mapping(written["entries"])["entries"]), 6)


if __name__ == "__main__":
    unittest.main()
