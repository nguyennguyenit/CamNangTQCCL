import unittest

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


if __name__ == "__main__":
    unittest.main()
