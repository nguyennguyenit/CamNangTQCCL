import hashlib
import json
import re
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from pipeline import crawl_sgsdeck_recommended as crawler
from pipeline import recommended_team_dedup, site_localization
from pipeline.recommended_identity import build_mapping
from pipeline.recommended_team_dedup import (_local_identity_name, _partial_source_holders, _possibly_duplicate,
                                             build_other_team_ledger, classify_candidates, dedup_key, season_corpus)


def config(identifier, holders, origin="existing-local", evidence=None):
    return {"legacyTeamId": identifier, "legacyVariantId": identifier + ":v", "holders": holders, "origin": origin, "sourceEvidence": evidence}


class RecommendedDedupTest(unittest.TestCase):
    def test_display_and_slot_order_do_not_change_key_but_ownership_does(self):
        a = config("a", [{"heroIdentityId": "h1", "tacticIdentityIds": ["t1", "t2"]}, {"heroIdentityId": "h2", "tacticIdentityIds": ["t3"]}, {"heroIdentityId": "h3", "tacticIdentityIds": []}])
        reordered = config("b", list(reversed([{**h, "tacticIdentityIds": list(reversed(h["tacticIdentityIds"]))} for h in a["holders"]])))
        moved = config("c", [{"heroIdentityId": "h1", "tacticIdentityIds": ["t1"]}, {"heroIdentityId": "h2", "tacticIdentityIds": ["t2", "t3"]}, {"heroIdentityId": "h3", "tacticIdentityIds": []}])
        self.assertEqual(dedup_key(a), dedup_key(reordered))
        self.assertNotEqual(dedup_key(a), dedup_key(moved))

    def test_existing_distinct_is_admitted_external_without_source_is_pending(self):
        source = config("source", [{"heroIdentityId": "h1", "tacticIdentityIds": ["t1"]}, {"heroIdentityId": "h2", "tacticIdentityIds": []}, {"heroIdentityId": "h3", "tacticIdentityIds": []}])
        duplicate = {**source, "legacyTeamId": "duplicate", "legacyVariantId": "duplicate:v"}
        other = config("other", [{"heroIdentityId": "h4", "tacticIdentityIds": []}, {"heroIdentityId": "h5", "tacticIdentityIds": []}, {"heroIdentityId": "h6", "tacticIdentityIds": []}])
        external = {**other, "legacyTeamId": "external", "legacyVariantId": "external:v", "origin": "external"}
        result = classify_candidates([duplicate, other, external], [source])
        self.assertEqual([x["legacyTeamId"] for x in result["admitted"]], ["other"])
        self.assertEqual(result["decisions"][0]["classification"], "duplicate")
        self.assertEqual(result["decisions"][2]["classification"], "pendingSource")

    def test_unresolved_source_is_wildcard_not_proof_of_distinctness(self):
        candidate = config("candidate", [
            {"heroIdentityId": "h1", "tacticIdentityIds": ["t1", "t2"]},
            {"heroIdentityId": "h2", "tacticIdentityIds": ["t3", "t4"]},
            {"heroIdentityId": "h3", "tacticIdentityIds": ["t5", "t6"]},
        ])
        possible = [
            {"heroIdentityId": "h1", "tacticIdentityIds": ["t1", None]},
            {"heroIdentityId": None, "tacticIdentityIds": [None, None]},
            {"heroIdentityId": "h3", "tacticIdentityIds": ["t6", "t5"]},
        ]
        impossible = [{**holder} for holder in possible]
        impossible[0] = {"heroIdentityId": "other", "tacticIdentityIds": ["t1", None]}
        self.assertTrue(_possibly_duplicate(possible, candidate))
        self.assertFalse(_possibly_duplicate(impossible, candidate))

    def test_blank_source_holder_is_preserved_as_wildcard(self):
        mapping = build_mapping([
            {"kind": "hero", "stableId": "h1", "aliases": ["H1"], "reviewStatus": "reviewed"},
            {"kind": "hero", "stableId": "h3", "aliases": ["H3"], "reviewStatus": "reviewed"},
        ])
        partial = _partial_source_holders({"heroes": [
            {"nameRaw": "H1", "tacticSlotsRaw": []},
            {"nameRaw": "", "tacticSlotsRaw": []},
            {"nameRaw": "H3", "tacticSlotsRaw": []},
        ]}, mapping)
        self.assertEqual(len(partial), 3)
        self.assertIsNone(partial[1]["heroIdentityId"])

    def test_local_primary_with_alternatives_gets_one_final_decision(self):
        entries = [{"kind": "hero", "stableId": f"h{index}", "aliases": [f"H{index}"],
                    "reviewStatus": "reviewed", "evidenceRef": f"fixture:{index}"}
                   for index in range(1, 7)]
        teams = [{"id": "local", "name": "Local", "heroes": [
            {"name": "H4", "tactics": [], "alternatives": ["H1"]},
            {"name": "H5", "tactics": []},
            {"name": "H6", "tactics": []},
        ]}]
        recommended = [{"sourceConfigId": "source", "heroes": [
            {"nameRaw": "H1", "tacticSlotsRaw": []},
            {"nameRaw": "H2", "tacticSlotsRaw": []},
            {"nameRaw": "H3", "tacticSlotsRaw": []},
        ], "alternativeHoldersRaw": []}]
        result = build_other_team_ledger(teams, recommended, {"entries": entries})
        self.assertEqual(result["counts"]["distinct"], 1)
        self.assertEqual(len(result["decisions"]), 1)
        self.assertEqual(result["admitted"][0]["legacyTeamId"], "local")
        self.assertEqual(result["pendingBranches"][0]["classification"], "pendingAlternative")

    def test_source_alternative_holders_are_in_exact_corpus(self):
        entries = [{"kind": "hero", "stableId": f"h{index}", "aliases": [f"H{index}"],
                    "reviewStatus": "reviewed", "evidenceRef": f"fixture:{index}"}
                   for index in range(1, 7)]
        teams = [{"id": "local", "name": "Local", "heroes": [
            {"name": "H4", "tactics": []}, {"name": "H5", "tactics": []}, {"name": "H6", "tactics": []},
        ]}]
        recommended = [{"sourceConfigId": "source", "heroes": [
            {"nameRaw": "H1", "tacticSlotsRaw": []}, {"nameRaw": "H2", "tacticSlotsRaw": []}, {"nameRaw": "H3", "tacticSlotsRaw": []},
        ], "alternativeHoldersRaw": [
            {"nameRaw": "H4", "tacticSlotsRaw": []}, {"nameRaw": "H5", "tacticSlotsRaw": []}, {"nameRaw": "H6", "tacticSlotsRaw": []},
        ]}]
        result = build_other_team_ledger(teams, recommended, {"entries": entries})
        self.assertEqual(result["counts"]["duplicate"], 1)
        self.assertEqual(result["decisions"][0]["matchingRecommended"], ["source#alternative-1"])


    def test_local_identity_uses_sp_co_prefix_and_base_name_without_notes(self):
        self.assertEqual(_local_identity_name({"name": "SP Pháp Chính(Cung S)", "baseName": "Pháp Chính", "isSP": True}), "SP Pháp Chính")
        self.assertEqual(_local_identity_name({"name": "CO Tinh Thái", "baseName": "Tinh Thái", "isCO": True}), "CO Tinh Thái")
        self.assertEqual(_local_identity_name({"name": "40Y Lữ Bố(S)", "baseName": "40Y Lữ Bố"}), "40Y Lữ Bố")
        self.assertEqual(_local_identity_name({"name": "Đổng Trác/SP Đổng Trác", "baseName": "Đổng Trác",
                                               "alternatives": ["SP Đổng Trác"]}), "Đổng Trác")
        self.assertEqual(_local_identity_name({"name": "H1"}), "H1")

    def test_admitted_rows_carry_season_and_youtube_rows_are_recommended_first(self):
        entries = [{"kind": "hero", "stableId": f"h{index}", "aliases": [f"H{index}"],
                    "reviewStatus": "reviewed", "evidenceRef": f"fixture:{index}"}
                   for index in range(1, 10)]
        teams = [
            {"id": "team-intro-1", "source": "team-intro", "name": "Sheet", "heroes": [
                {"name": "H1(S)", "baseName": "H1", "tactics": []}, {"name": "H2", "tactics": []}, {"name": "H3", "tactics": []}]},
            {"id": "youtube-0", "source": "youtube", "name": "Video", "heroes": [
                {"name": "H4", "baseName": "H4", "tactics": []}, {"name": "H5", "tactics": []}, {"name": "H6", "tactics": []}]},
            {"id": "youtube-1", "source": "youtube", "name": "Same", "heroes": [
                {"name": "H7", "tactics": []}, {"name": "H8", "tactics": []}, {"name": "H9", "tactics": []}]},
        ]
        recommended = [{"sourceConfigId": "s27-same", "heroes": [
            {"nameRaw": "H7", "tacticSlotsRaw": []}, {"nameRaw": "H8", "tacticSlotsRaw": []}, {"nameRaw": "H9", "tacticSlotsRaw": []},
        ], "alternativeHoldersRaw": []}]
        result = build_other_team_ledger(teams, recommended, {"entries": entries}, season_id="pk-s27")
        self.assertEqual([row["legacyTeamId"] for row in result["admitted"]], ["youtube-0", "team-intro-1"])
        self.assertEqual([(row["recommended"], row["sourceLabel"]) for row in result["admitted"]],
                         [(True, "YouTube"), (False, "team-intro")])
        self.assertTrue(all(row["sourceSeasonIds"] == ["pk-s27"] for row in result["admitted"]))
        self.assertEqual(next(row for row in result["decisions"] if row["legacyTeamId"] == "youtube-1")["matchingRecommended"],
                         ["s27-same"])

    def test_season_corpus_keeps_only_default_season_scopes(self):
        inventory = {"scopes": [{"safeScopeKey": "a", "sourceSeasonId": "pk-s27"},
                                {"safeScopeKey": "b", "sourceSeasonId": "pk-s26"},
                                {"safeScopeKey": "c", "sourceSeasonId": "pk-s27"}]}
        details = {"a": [{"sourceConfigId": "a1"}], "b": [{"sourceConfigId": "b1"}], "c": [{"sourceConfigId": "c1"}]}
        self.assertEqual([row["sourceConfigId"] for row in season_corpus(inventory, details, "pk-s27")], ["a1", "c1"])
        with self.assertRaisesRegex(ValueError, "pk-s99"):
            season_corpus(inventory, details, "pk-s99")

    def test_unresolved_record_of_another_season_cannot_hold_back_a_team(self):
        entries = [{"kind": "hero", "stableId": f"h{index}", "aliases": [f"H{index}"],
                    "reviewStatus": "reviewed", "evidenceRef": f"fixture:{index}"}
                   for index in range(1, 4)]
        teams = [{"id": "local", "name": "Local", "heroes": [
            {"name": "H1", "tactics": []}, {"name": "H2", "tactics": []}, {"name": "H3", "tactics": []}]}]
        inventory = {"scopes": [{"safeScopeKey": "old", "sourceSeasonId": "pk-s26"},
                                {"safeScopeKey": "now", "sourceSeasonId": "pk-s27"}]}
        details = {"old": [{"sourceConfigId": "old-partial", "heroes": [
            {"nameRaw": "H1", "tacticSlotsRaw": []}, {"nameRaw": "未知", "tacticSlotsRaw": []}, {"nameRaw": "H3", "tacticSlotsRaw": []},
        ], "alternativeHoldersRaw": []}], "now": []}
        everything = build_other_team_ledger(teams, details["old"], {"entries": entries})
        self.assertEqual(everything["decisions"][0]["reason"], "possibly-matches-unresolved-recommended")
        seasonal = build_other_team_ledger(teams, season_corpus(inventory, details, "pk-s27"), {"entries": entries},
                                           season_id="pk-s27")
        self.assertEqual(seasonal["decisions"][0]["classification"], "distinct")
        self.assertEqual(seasonal["unresolvedRecommended"], [])

    def test_admitted_rows_identical_to_each_other_keep_one_preferring_youtube_then_order(self):
        entries = [{"kind": "hero", "stableId": f"h{index}", "aliases": [f"H{index}"],
                    "reviewStatus": "reviewed", "evidenceRef": f"fixture:{index}"}
                   for index in range(1, 7)]
        entries += [{"kind": "tactic", "stableId": f"t{index}", "aliases": [f"T{index}"],
                     "reviewStatus": "reviewed", "evidenceRef": f"fixture:t{index}"} for index in (1, 2)]

        def team(identifier, source, names, tactic="T1"):
            # Chiến pháp luôn thuộc H1/H4 dù thứ tự tướng đổi: trùng tuyệt đối tính theo chủ sở hữu.
            return {"id": identifier, "source": source, "name": identifier, "heroes": [
                {"name": name, "tactics": [{"name": tactic}] if name in ("H1", "H4") else []} for name in names]}

        teams = [
            team("team-intro-1", "team-intro", ["H1", "H2", "H3"]),
            team("moi-phe-2", "moi-phe", ["H3", "H2", "H1"]),
            team("team-intro-3", "team-intro", ["H4", "H5", "H6"]),
            team("moi-phe-4", "moi-phe", ["H6", "H5", "H4"]),
            team("team-intro-5", "team-intro", ["H4", "H5", "H6"], tactic="T2"),
            team("youtube-0", "youtube", ["H2", "H1", "H3"]),
        ]
        result = build_other_team_ledger(teams, [], {"entries": entries}, season_id="pk-s27")
        self.assertEqual([row["legacyTeamId"] for row in result["admitted"]], ["youtube-0", "team-intro-3", "team-intro-5"])
        decisions = {row["legacyTeamId"]: row for row in result["decisions"]}
        self.assertEqual({key: (row["classification"], row.get("matchingLocal")) for key, row in decisions.items()
                          if row["classification"] == "duplicate"},
                         {"team-intro-1": ("duplicate", "youtube-0"), "moi-phe-2": ("duplicate", "youtube-0"),
                          "moi-phe-4": ("duplicate", "team-intro-3")})
        self.assertEqual(result["counts"], {"distinct": 3, "duplicate": 3, "pendingIdentity": 0, "pendingSource": 0})
        self.assertEqual(len(result["admitted"]), result["counts"]["distinct"])

    def test_local_merge_keeps_book_and_unit_variants(self):
        """Gộp trùng nội bộ (khóa v2) xét cả binh thư và binh chủng: hàng đề cử thiếu binh thư không nuốt
        hàng sheet đủ binh thư cùng tướng + chiến pháp."""
        entries = [{"kind": "hero", "stableId": f"h{index}", "aliases": [f"H{index}"],
                    "reviewStatus": "reviewed", "evidenceRef": f"fixture:{index}"} for index in range(1, 4)]
        entries += [{"kind": "tactic", "stableId": f"t{index}", "aliases": [f"T{index}"],
                     "reviewStatus": "reviewed", "evidenceRef": f"fixture:t{index}"} for index in range(1, 7)]

        def team(identifier, source, books=("B1",), unit=("Cung",)):
            heroes = [{"name": f"H{index}", "tactics": [{"name": f"T{2 * index - 1}"}, {"name": f"T{2 * index}"}],
                       "books": [{"name": name} for name in books]} for index in range(1, 4)]
            return {"id": identifier, "source": source, "name": identifier, "unitType": list(unit), "heroes": heroes}

        teams = [
            team("youtube-0", "youtube", books=()),         # đề cử nhưng thiếu binh thư
            team("team-intro-1", "team-intro"),             # chỉ khác binh thư → phương án riêng
            team("moi-phe-2", "moi-phe", books=("B2",)),    # khác binh thư → phương án riêng
            team("moi-phe-3", "moi-phe", unit=("Kỵ",)),     # khác binh chủng → phương án riêng
            team("moi-phe-4", "moi-phe"),                   # trùng hệt team-intro-1 → duplicate
            team("youtube-5", "youtube", books=()),         # trùng hệt youtube-0 → duplicate
        ]
        result = build_other_team_ledger(teams, [], {"entries": entries}, season_id="pk-s27")
        self.assertEqual(result["localMergeKeyVersion"], 2)
        self.assertEqual([row["legacyTeamId"] for row in result["admitted"]],
                         ["youtube-0", "team-intro-1", "moi-phe-2", "moi-phe-3"])
        decisions = {row["legacyTeamId"]: row for row in result["decisions"]}
        self.assertEqual(decisions["moi-phe-4"].get("matchingLocal"), "team-intro-1")
        self.assertEqual(decisions["youtube-5"].get("matchingLocal"), "youtube-0")

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "tests/fixtures/sgsdeck-recommended"
DETAIL_URL = "https://sgsdeck.com/recommended/og-bingyan-40y-lvbu-b"
PACK = "pipeline/localization-inputs/recommended.json"
PINNED = ("cacheInventoryHash", "cacheManifestSha256", "cachedPageBytes", "cachedPageCount",
          "recommendedCorpusHash", "recordCount", "sourceInventoryHash")


def _fixture_cache(cache):
    """Crawler-layout cache of one real fixture scope holding the single pinned detail card."""
    listing = re.sub(
        r'<a\b[^>]*href="/recommended/[^\"]+"[^>]*>.*?</a>',
        lambda match: match[0] if 'href="' + DETAIL_URL.removeprefix("https://sgsdeck.com") + '"' in match[0] else "",
        (FIXTURES / "list.html").read_text(), flags=re.S,
    ).replace("25 套交戰配置", "1 套交戰配置")
    detail = (FIXTURES / "detail-sample.html").read_text()
    discovered = crawler.discover_scopes((FIXTURES / "source-season-picker.html").read_text())
    scope = next(item for item in discovered["scopes"] if item["sourceScopeId"] == "og-兵演春秋|交戰")
    inventory = {"schemaVersion": discovered["schemaVersion"], "seasonOptions": discovered["seasonOptions"], "scopes": [scope]}
    inventory["inventoryHash"] = "sha256:" + hashlib.sha256(crawler.canonical_json(inventory).encode()).hexdigest()
    cache.mkdir(parents=True)
    (cache / "scope-inventory.json").write_text(json.dumps(inventory, ensure_ascii=False), encoding="utf-8")
    pages = {DETAIL_URL: detail.encode()}
    with mock.patch.object(crawler, "fetch_page", lambda url, timeout=30: (url, 200, pages.get(url, listing.encode()))):
        crawler.crawl_scope(inventory, cache, scope, minimum_interval=0)


def _dedup(*args):
    with mock.patch("sys.argv", ["recommended_team_dedup", *args]):
        recommended_team_dedup.main()


class RecommendedDedupPackTest(unittest.TestCase):
    def test_pack_mode_matches_cache_mode_byte_for_byte_and_passes_ledger_validation(self):
        identity_map = ROOT / "pipeline/recommended-identity-map.json"
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            # Scope fixture là mùa og-兵演春秋; xét trùng chỉ dùng Đội chuẩn của mùa mặc định.
            season = base / "default-season.json"
            season.write_text(json.dumps({"schemaVersion": 1, "defaultSourceSeasonId": "og-兵演春秋",
                                          "evidenceRef": "fixture"}, ensure_ascii=False), encoding="utf-8")
            common = ["--teams", str(ROOT / "data/teams.json"), "--team-tier", str(ROOT / "data/team-tier.json"),
                      "--identity-map", str(identity_map), "--default-season", str(season)]
            cache, repository = base / "cache", base / "repository"
            _fixture_cache(cache)
            from_cache = base / "from-cache.json"
            _dedup(*common, "--cache", str(cache), "--output", str(from_cache))

            # Repository whose reviewed pins are the fixture pack's own provenance, then capture through the CLI.
            pack = site_localization.capture_source_pack(cache, identity_map=identity_map, other_ledger=from_cache, root=ROOT)
            policy = site_localization.load_policy(ROOT)
            policy["baseline"]["sourcePins"] = {
                **{key: pack["provenance"][key] for key in PINNED},
                "normalizedSnapshotSha256": site_localization.sha256_hex(site_localization.canonical_json_bytes(pack)),
                "authority": policy["baseline"]["sourcePins"]["authority"],
            }
            (repository / "pipeline").mkdir(parents=True)
            (repository / "pipeline/site-localization-policy.json").write_text(json.dumps(policy, ensure_ascii=False), encoding="utf-8")
            site_localization.main(["capture", "--root", str(repository), "--cache", str(cache), "--identity-map", str(identity_map),
                                    "--other-ledger", str(from_cache), "--output", str(repository / PACK)])

            from_pack = base / "from-pack.json"
            _dedup(*common, "--root", str(repository), "--pack", PACK, "--output", str(from_pack))
            self.assertEqual(from_pack.read_bytes(), from_cache.read_bytes())
            written = json.loads(from_pack.read_bytes())
            self.assertEqual(written["recommendedCorpusSeasonId"], "og-兵演春秋")
            self.assertTrue(all(row["sourceSeasonIds"] == ["og-兵演春秋"] for row in written["admitted"]))
            captured = site_localization.load_source_pack(repository, PACK)
            site_localization._validate_other_ledger(json.loads(from_pack.read_bytes()), captured["inventory"],
                                                     identity_map.read_bytes(), site_localization.pack_corpus(captured))

            # A pack that no longer matches the reviewed pins is refused instead of producing a ledger.
            policy["baseline"]["sourcePins"]["recordCount"] += 1
            (repository / "pipeline/site-localization-policy.json").write_text(json.dumps(policy, ensure_ascii=False), encoding="utf-8")
            refused = base / "refused.json"
            with self.assertRaisesRegex(ValueError, "pin"):
                _dedup(*common, "--root", str(repository), "--pack", PACK, "--output", str(refused))
            self.assertFalse(refused.exists())

            with self.assertRaises(SystemExit):
                _dedup(*common, "--cache", str(cache), "--pack", PACK, "--output", str(refused))


if __name__ == "__main__":
    unittest.main()
