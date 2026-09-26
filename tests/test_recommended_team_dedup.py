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
from pipeline.recommended_team_dedup import _partial_source_holders, _possibly_duplicate, build_other_team_ledger, classify_candidates, dedup_key


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
        common = ["--teams", str(ROOT / "data/teams.json"), "--team-tier", str(ROOT / "data/team-tier.json"),
                  "--identity-map", str(identity_map)]
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
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
