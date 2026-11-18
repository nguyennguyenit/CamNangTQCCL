"""Chiếu tier JP vào generation Recommended: chỉ entry đã review và khớp, mùa đúng, hash vào descriptor."""
import copy
import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from pipeline.build_recommended_reference import build_generation, canonical_object_hash, raw_source_record
from pipeline.recommended_jp_tiers import apply_jp_tiers, jp_tier_projection, load_jp_tiers

CATALOG_BYTES = json.dumps([{"id": "hero:fixture", "viet": "Tướng mẫu", "hanViet": "Tướng mẫu",
    "chinese": "樣", "aliases": []}], ensure_ascii=False).encode()
TACTIC_CATALOG_BYTES = json.dumps([{"id": "tactic:fixture", "viet": "Chiến pháp mẫu", "hanViet": "Chiến pháp mẫu",
    "chinese": "範例戰法", "aliases": []}], ensure_ascii=False).encode()
SCOPE_26 = "s-" + "6" * 64
SCOPE_27 = "s-" + "7" * 64
SOURCE_URL = "https://kazten.com/entry/2026/06/19/180000"


def _row(identifier, scope, season, index, tier="T0.5"):
    return {"sourceConfigId": identifier, "safeScopeKey": scope, "sourceScopeId": season + "|交戰", "sourceSeasonId": season,
            "sourceSeasonLabel": season.upper(), "sourceCategoryId": "交戰", "tierRaw": tier, "tierOrder": 1,
            "value": None, "listIndex": index, "heroes": []}


def _details(rows):
    return [{key: value for key, value in row.items() if key != "sourceSeasonId"} for row in copy.deepcopy(rows)]


def _inputs():
    records = [
        _row("yx-exact", SCOPE_26, "pk-s26", 0),
        _row("yx-heroes", SCOPE_26, "pk-s26", 1),
        _row("yx-pending", SCOPE_26, "pk-s26", 2),
        _row("hd-other", SCOPE_27, "pk-s27", 0),
    ]
    return {
        "inventory": {
            "inventoryHash": "a",
            "seasonOptions": [{"sourceSeasonId": "pk-s26", "label": "PK-S26", "status": "available"},
                              {"sourceSeasonId": "pk-s27", "label": "PK-S27", "status": "available"}],
            "scopes": [
                {"safeScopeKey": SCOPE_26, "sourceScopeId": "pk-s26|交戰", "sourceSeasonId": "pk-s26", "sourceCategoryId": "交戰", "state": "complete"},
                {"safeScopeKey": SCOPE_27, "sourceScopeId": "pk-s27|交戰", "sourceSeasonId": "pk-s27", "sourceCategoryId": "交戰", "state": "complete"},
            ],
        },
        "records": records,
        # Như input thật: detail là bản ghi nguồn, mùa chỉ nằm trên hàng index.
        "details": {SCOPE_26: _details(records[:3]), SCOPE_27: _details(records[3:])},
        "otherTeams": [], "mappingHash": "b", "decisionSnapshotHash": "c", "dedupKeyVersion": 1,
    }


def _entry(tier, kind, target, review="reviewed"):
    return {"tierJa": tier, "teamNameJa": "編成", "heroesJa": ["周劭", "SP荀彧", "SP郭嘉"],
            "heroes": ["do-uy:周劭", "hero:sp-tuan-uc", "hero:sp-quach-gia"], "tacticsJa": [], "tactics": [],
            "match": {"kind": kind, "recommendedTeamId": target}, "reviewStatus": review, "note": ""}


def _table(**changes):
    table = {
        "schemaVersion": 1,
        "source": {"name": "カズ天", "url": SOURCE_URL, "publishedAt": "2026-06-19", "vnSourceSeasonId": "pk-s26"},
        "entries": [
            _entry("T0", "exact", "yx-exact"),
            _entry("T0.5", "heroes-only", "yx-heroes"),
            _entry("T0", "heroes-only", "yx-pending", review="needs-review"),
            _entry("T0", "none", None),
        ],
    }
    table.update(changes)
    return table


def _bytes(table):
    return json.dumps(table, ensure_ascii=False).encode()


def _publish(inputs, output, jp_tiers_bytes=None):
    """Như helper của test_build_recommended_reference: ledger tự dựng khớp corpus raw của fixture."""
    candidate = copy.deepcopy(inputs)
    teams_bytes = b"[]"
    raw_corpus = [
        raw_source_record(row)
        for scope in candidate["inventory"]["scopes"]
        for row in candidate["details"].get(scope["safeScopeKey"], [])
    ]
    ledger = {
        "dedupKeyVersion": 1, "sourceInventoryHash": "a", "mappingFileSha256": "b",
        "recommendedCorpusHash": canonical_object_hash(raw_corpus),
        "localTeamsSha256": "sha256:" + hashlib.sha256(teams_bytes).hexdigest(),
        "inputTeamRows": 0, "counts": {"distinct": 0, "duplicate": 0, "pendingIdentity": 0, "pendingSource": 0},
        "admitted": [], "decisions": [],
    }
    ledger_bytes = json.dumps(ledger).encode()
    candidate["decisionSnapshotHash"] = "sha256:" + hashlib.sha256(ledger_bytes).hexdigest()
    return build_generation(
        candidate, output,
        catalog_bytes=CATALOG_BYTES, tactic_catalog_bytes=TACTIC_CATALOG_BYTES,
        teams_bytes=teams_bytes, content_links_bytes=b'{"schemaVersion":1,"entries":[]}',
        ledger_bytes=ledger_bytes, jp_tiers_bytes=jp_tiers_bytes,
    )


def _published(root, selector, name):
    return json.loads((Path(root) / selector["generationId"] / name).read_text())


class RecommendedJpTierProjectionTest(unittest.TestCase):
    def test_only_reviewed_matched_entries_reach_their_rows(self):
        data = _bytes(_table())
        with tempfile.TemporaryDirectory() as folder:
            selector = _publish(_inputs(), folder, data)
            index = {row["sourceConfigId"]: row for row in _published(folder, selector, "index.json")["records"]}
            expected = {"source": "jp", "url": SOURCE_URL, "publishedAt": "2026-06-19"}
            self.assertEqual(index["yx-exact"]["tierSources"], [{**expected, "tierRaw": "T0", "matchKind": "exact"}])
            self.assertEqual(index["yx-heroes"]["tierSources"], [{**expected, "tierRaw": "T0.5", "matchKind": "heroes-only"}])
            self.assertNotIn("tierSources", index["yx-pending"])
            self.assertNotIn("tierSources", index["hd-other"])
            # Tier SGSDeck giữ nguyên, không bị thay hay suy từ tier JP.
            self.assertEqual({row["tierRaw"] for row in index.values()}, {"T0.5"})
            details = {row["sourceConfigId"]: row for row in _published(folder, selector, f"details-{SCOPE_26}.json")["records"]}
            self.assertEqual(details["yx-exact"]["tierSources"], index["yx-exact"]["tierSources"])
            self.assertNotIn("tierSources", details["yx-pending"])
            published = "".join(path.read_text() for path in sorted((Path(folder) / selector["generationId"]).iterdir()))
            # Mã tướng nội bộ của bảng khớp không ra bản phát.
            self.assertNotIn("do-uy:", published)
            manifest = _published(folder, selector, "manifest.json")
            self.assertEqual(manifest["jpTiersHash"], "sha256:" + hashlib.sha256(data).hexdigest())

    def test_table_change_yields_new_generation_and_absent_table_keeps_old_shape(self):
        with tempfile.TemporaryDirectory() as folder:
            plain = _publish(_inputs(), folder)
            self.assertNotIn("jpTiersHash", _published(folder, plain, "manifest.json"))
            self.assertFalse(any("tierSources" in row for row in _published(folder, plain, "index.json")["records"]))
            first = _publish(_inputs(), folder, _bytes(_table()))
            changed = _table()
            changed["entries"][0]["tierJa"] = "T1"
            second = _publish(_inputs(), folder, _bytes(changed))
            self.assertEqual(len({plain["generationId"], first["generationId"], second["generationId"]}), 3)

    def test_unknown_team_season_drift_and_double_target_stop_the_build(self):
        unknown = _table()
        unknown["entries"][0]["match"]["recommendedTeamId"] = "yx-missing"
        wrong_season = _table()
        wrong_season["entries"][0]["match"]["recommendedTeamId"] = "hd-other"
        double = _table()
        double["entries"][1]["match"]["recommendedTeamId"] = "yx-exact"
        for label, table, message in (
            ("unknown", unknown, "unknown team"),
            ("season", wrong_season, "season differs"),
            ("double", double, "same team twice"),
        ):
            with self.subTest(label), tempfile.TemporaryDirectory() as folder:
                with self.assertRaisesRegex(ValueError, message):
                    _publish(_inputs(), folder, _bytes(table))
                self.assertFalse((Path(folder) / "current.json").exists())

    def test_team_missing_from_details_stops_the_build(self):
        inputs = _inputs()
        inputs["details"][SCOPE_26] = [row for row in inputs["details"][SCOPE_26] if row["sourceConfigId"] != "yx-exact"]
        with self.assertRaisesRegex(ValueError, "absent from the details"):
            apply_jp_tiers(inputs, _bytes(_table()))

    def test_table_shape_is_validated(self):
        bad_tier = _table()
        bad_tier["entries"][0]["tierJa"] = "S"
        bad_kind = _table()
        bad_kind["entries"][0]["match"]["kind"] = "partial"
        unmatched_target = _table()
        unmatched_target["entries"][3]["match"]["recommendedTeamId"] = "yx-exact"
        for label, data, message in (
            ("json", b"{", "not valid JSON"),
            ("schema", _bytes(_table(schemaVersion=2)), "schema"),
            ("url", _bytes(_table(source={**_table()["source"], "url": "javascript:alert(1)"})), "https URL"),
            ("date", _bytes(_table(source={**_table()["source"], "publishedAt": "19/06/2026"})), "publishedAt"),
            ("season", _bytes(_table(source={**_table()["source"], "vnSourceSeasonId": ""})), "source season"),
            ("tier", _bytes(bad_tier), "Unsupported Recommended JP tier: S"),
            ("kind", _bytes(bad_kind), "match kind"),
            ("none target", _bytes(unmatched_target), "cannot point"),
        ):
            with self.subTest(label), self.assertRaisesRegex(ValueError, message):
                load_jp_tiers(data)

    def test_tier_sources_stay_outside_raw_source_lineage(self):
        candidate = apply_jp_tiers(_inputs(), _bytes(_table()))
        row = next(item for item in candidate["records"] if item["sourceConfigId"] == "yx-exact")
        self.assertIn("tierSources", row)
        self.assertNotIn("tierSources", raw_source_record(row))

    def test_index_and_detail_tier_sources_must_agree(self):
        inputs = apply_jp_tiers(_inputs(), _bytes(_table()))
        inputs["records"][0]["tierSources"][0]["tierRaw"] = "T3"
        with tempfile.TemporaryDirectory() as folder, self.assertRaisesRegex(ValueError, "tierSources differ"):
            _publish(inputs, folder)

    def test_repository_table_projects_seven_pk_s26_rows(self):
        """Bảng thật của repo: 7 entry gán được tier (2 exact + 5 heroes-only), cùng mùa PK-S26."""
        root = Path(__file__).resolve().parents[1]
        table = load_jp_tiers((root / "pipeline/recommended-jp-tiers.json").read_bytes())
        self.assertEqual(table["source"]["vnSourceSeasonId"], "pk-s26")
        rows = [
            {"sourceConfigId": entry["match"]["recommendedTeamId"], "sourceSeasonId": "pk-s26"}
            for entry in table["entries"] if entry["match"]["recommendedTeamId"]
        ]
        projection = jp_tier_projection(table, rows)
        self.assertEqual(len(projection), 7)
        kinds = sorted(sources[0]["matchKind"] for sources in projection.values())
        self.assertEqual(kinds, ["exact"] * 2 + ["heroes-only"] * 5)


if __name__ == "__main__":
    unittest.main()
