"""Behavioral contracts for seasonal attribution and scoped publication."""
import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from pipeline import build_season_data as seasons

ROOT = Path(__file__).resolve().parents[1]


def fixtures():
    provenance = {"provider": "fixture-source", "region": "VN", "sourceUrl": "https://example.org/season", "fetchedAt": "2026-09-07"}
    evidence = [{"schemaVersion": 1, "id": "scenario-proof", "provenance": provenance,
                 "sourceSeason": {"scenarioName": "Binh Diễn Xuân Thu"}, "canonicalRef": None,
                 "reviewStatus": "reviewed", "claim": {"kind": "scenario-attribution", "scenarioId": "binh-dien-xuan-thu", "rulesetId": None}, "note": "Scenario confirmation only."}]
    registry = [{"schemaVersion": 1, "id": "binh-dien-xuan-thu", "labelVi": "Binh Diễn Xuân Thu", "aliases": [], "region": "VN", "kind": "scenario",
                 "rulesets": [], "sourceMappings": [{"sourceSeason": {"scenarioName": "Binh Diễn Xuân Thu"}, "provenance": copy.deepcopy(provenance), "rulesetId": None, "reviewStatus": "reviewed", "evidenceRefs": ["scenario-proof"]}],
                 "reviewStatus": "reviewed", "evidenceRefs": ["scenario-proof"]}]
    return registry, evidence


def with_ruleset():
    registry, evidence = fixtures()
    rule = {"id": "reviewed-rules", "label": "Verified rule fixture", "reviewStatus": "reviewed", "evidenceRefs": ["rules-proof"]}
    registry[0]["rulesets"].append(rule)
    proof = copy.deepcopy(evidence[0])
    proof.update(id="rules-proof", claim={"kind": "ruleset-applicability", "scenarioId": registry[0]["id"], "rulesetId": rule["id"]})
    evidence.append(proof)
    return registry, evidence


class BuildSeasonDataTest(unittest.TestCase):
    def test_confirmed_scenario_remains_without_ruleset(self):
        registry, evidence = fixtures()
        result = seasons.build_season_data(registry, evidence)
        self.assertEqual(result["season-registry.json"], registry)
        self.assertEqual(result["season-evidence.json"], evidence)
        self.assertEqual(result["season-registry.json"][0]["rulesets"], [])
        self.assertIsNone(result["season-registry.json"][0]["sourceMappings"][0]["rulesetId"])
        result["season-registry.json"][0]["aliases"].append("independent")
        self.assertEqual(registry[0]["aliases"], [])

    def test_duplicate_scenario_evidence_and_ruleset_ids_reject(self):
        for kind in ("scenario", "evidence", "ruleset"):
            with self.subTest(kind=kind):
                registry, evidence = with_ruleset()
                rows = {"scenario": registry, "evidence": evidence, "ruleset": registry[0]["rulesets"]}[kind]
                rows.append(copy.deepcopy(rows[0]))
                with self.assertRaisesRegex(ValueError, "duplicate"):
                    seasons.build_season_data(registry, evidence)

    def test_id_bounds_and_controls_reject(self):
        for invalid in ("", "x" * 129, "x\n", "x\x00", "x\x7f", "x\x85", " x", 7):
            with self.subTest(invalid=repr(invalid)):
                registry, evidence = fixtures()
                evidence[0]["id"] = invalid
                with self.assertRaises(ValueError):
                    seasons.build_season_data(registry, evidence)

    def test_maximum_id_length_is_accepted(self):
        registry, evidence = fixtures()
        evidence[0]["id"] = "x" * 128
        registry[0]["evidenceRefs"] = [evidence[0]["id"]]
        registry[0]["sourceMappings"][0]["evidenceRefs"] = [evidence[0]["id"]]
        seasons.build_season_data(registry, evidence)

    def test_schema_top_level_and_unknown_fields_reject(self):
        registry, evidence = fixtures()
        for bad_registry in ({"records": registry}, [dict(registry[0], schemaVersion=2)], [dict(registry[0], schemaVersion=True)], [dict(registry[0], current=True)]):
            with self.subTest(value=bad_registry), self.assertRaises(ValueError):
                seasons.build_season_data(bad_registry, evidence)

    def test_dangling_evidence_and_claim_pair_reject(self):
        for change in ("ref", "scenario", "ruleset", "mapping"):
            with self.subTest(change=change):
                registry, evidence = with_ruleset()
                if change == "ref": registry[0]["evidenceRefs"] = ["missing"]
                if change == "scenario": evidence[0]["claim"]["scenarioId"] = "missing"
                if change == "ruleset": evidence[1]["claim"]["rulesetId"] = "missing"
                if change == "mapping": registry[0]["sourceMappings"][0]["rulesetId"] = "missing"
                with self.assertRaises(ValueError): seasons.build_season_data(registry, evidence)

    def test_pending_evidence_cannot_authorize_reviewed_scenario(self):
        registry, evidence = fixtures()
        evidence[0]["reviewStatus"] = "pending"
        with self.assertRaisesRegex(ValueError, "reviewed evidence"):
            seasons.build_season_data(registry, evidence)

    def test_scenario_proof_cannot_authorize_reviewed_ruleset(self):
        registry, evidence = with_ruleset()
        registry[0]["rulesets"][0]["evidenceRefs"] = ["scenario-proof"]
        with self.assertRaisesRegex(ValueError, "ruleset-applicability"):
            seasons.build_season_data(registry, evidence)

    def test_reviewed_ruleset_requires_reviewed_scenario(self):
        registry, evidence = with_ruleset()
        registry[0]["reviewStatus"] = "pending"
        with self.assertRaises(ValueError): seasons.build_season_data(registry, evidence)

    def test_pending_ruleset_cannot_authorize_reviewed_mapping(self):
        registry, evidence = with_ruleset()
        registry[0]["rulesets"][0]["reviewStatus"] = "pending"
        registry[0]["sourceMappings"][0].update(rulesetId="reviewed-rules", evidenceRefs=["rules-proof"])
        with self.assertRaises(ValueError): seasons.build_season_data(registry, evidence)

    def test_pending_is_preserved_without_automatic_review(self):
        registry, evidence = fixtures()
        registry[0].update(reviewStatus="pending", evidenceRefs=[])
        registry[0]["sourceMappings"][0].update(reviewStatus="pending", evidenceRefs=[])
        evidence[0]["reviewStatus"] = "pending"
        self.assertEqual(seasons.build_season_data(registry, evidence)["season-registry.json"], registry)

    def test_same_source_season_number_in_different_regions_stays_unmapped(self):
        registry, evidence = fixtures()
        registry[0]["sourceMappings"] = []
        for region in ("CN", "TW", "VN"):
            provenance = dict(evidence[0]["provenance"], region=region)
            registry[0]["sourceMappings"].append({"sourceSeason": {"number": 18}, "provenance": provenance, "rulesetId": None, "reviewStatus": "pending", "evidenceRefs": []})
        result = seasons.build_season_data(registry, evidence)["season-registry.json"]
        self.assertEqual(result, registry)
        self.assertEqual(len(result[0]["sourceMappings"]), 3)
        self.assertTrue(all(item["rulesetId"] is None for item in result[0]["sourceMappings"]))

    def test_reviewed_mapping_requires_same_source_provenance(self):
        registry, evidence = fixtures()
        registry[0]["sourceMappings"][0]["provenance"]["region"] = "CN"
        with self.assertRaises(ValueError): seasons.build_season_data(registry, evidence)

    def test_invalid_provenance_urls_dates_and_source_season_reject(self):
        invalid_fields = [("sourceUrl", "file:///tmp/source"), ("sourceUrl", "https:///missing"), ("sourceUrl", "https://user:pass@example.org"), ("sourceUrl", "https://example.org/\n"), ("fetchedAt", "2026-02-30"), ("fetchedAt", "yesterday"), ("sourceUpdatedAt", "2026-09-07T01:00:00"), ("provider", ""), ("region", "")]
        for key, value in invalid_fields:
            with self.subTest(key=key, value=value):
                registry, evidence = fixtures()
                evidence[0]["provenance"][key] = value
                with self.assertRaises(ValueError): seasons.build_season_data(registry, evidence)
        for value in (True, -1, "18", 1.5):
            registry, evidence = fixtures()
            evidence[0]["sourceSeason"] = {"number": value}
            with self.assertRaises(ValueError): seasons.build_season_data(registry, evidence)

    def test_canonical_ref_requires_review_and_valid_shape(self):
        registry, evidence = fixtures()
        evidence[0].update(reviewStatus="pending", canonicalRef={"kind": "hero", "id": "hero-1"})
        with self.assertRaises(ValueError): seasons.build_season_data(registry, evidence)

    def test_reviewed_exact_ruleset_mapping_is_accepted(self):
        registry, evidence = with_ruleset()
        registry[0]["sourceMappings"][0].update(rulesetId="reviewed-rules", evidenceRefs=["rules-proof"])
        self.assertEqual(seasons.build_season_data(registry, evidence)["season-registry.json"], registry)

    def test_repeat_publish_preserves_bytes_and_unrelated_corpus(self):
        registry, evidence = fixtures()
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            legacy = output / "coexist.json"
            legacy.write_bytes(b'[{"legacy":true}]\n')
            before = legacy.read_bytes()
            seasons.publish_season_data(registry, evidence, output)
            first = {path.name: path.read_bytes() for path in output.iterdir()}
            seasons.publish_season_data(registry, evidence, output)
            self.assertEqual(first, {path.name: path.read_bytes() for path in output.iterdir()})
            self.assertEqual(legacy.read_bytes(), before)
            for name in ("season-registry.json", "season-evidence.json"):
                self.assertTrue(first[name].endswith(b"\n"))
                self.assertIsInstance(json.loads(first[name]), list)

    def test_invalid_candidate_preserves_all_accepted_outputs(self):
        registry, evidence = fixtures()
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            seasons.publish_season_data(registry, evidence, output)
            before = {path.name: path.read_bytes() for path in output.iterdir()}
            registry[0]["labelVi"] = "Changed label"
            evidence[0]["provenance"]["fetchedAt"] = "invalid"
            with self.assertRaises(ValueError): seasons.publish_season_data(registry, evidence, output)
            self.assertEqual(before, {path.name: path.read_bytes() for path in output.iterdir()})

    def test_committed_corpus_preserved_during_candidate_build(self):
        paths = sorted((ROOT / "data").glob("*.json"))
        before = {str(path): hashlib.sha256(path.read_bytes()).hexdigest() for path in paths}
        with tempfile.TemporaryDirectory() as directory:
            seasons.publish_season_data(*fixtures(), Path(directory))
        self.assertEqual(before, {str(path): hashlib.sha256(path.read_bytes()).hexdigest() for path in paths})

    def test_handled_second_replace_failure_restores_existing_and_new_outputs(self):
        import os
        for existed in (False, True):
            with self.subTest(existed=existed), tempfile.TemporaryDirectory() as directory:
                output = Path(directory)
                registry, evidence = fixtures()
                if existed:
                    seasons.publish_season_data(registry, evidence, output)
                (output / "coexist.json").write_bytes(b"legacy\n")
                before = {path.name: path.read_bytes() for path in output.iterdir()}
                registry[0]["labelVi"] = "Changed label"
                replace = os.replace
                calls = []
                def fail_second(source, destination):
                    calls.append(destination)
                    if len(calls) == 2:
                        raise OSError("injected second replacement failure")
                    return replace(source, destination)
                with patch.object(seasons.os, "replace", side_effect=fail_second):
                    with self.assertRaises(OSError):
                        seasons.publish_season_data(registry, evidence, output)
                self.assertEqual(before, {path.name: path.read_bytes() for path in output.iterdir()})


class SeasonalBundleTest(unittest.TestCase):
    def bundle(self):
        from pipeline.season_validation import config_fingerprint
        registry, evidence = with_ruleset()
        config = dict(schemaVersion=1, id='config-a', teamId='team-a', scenarioId=registry[0]['id'], rulesetId='reviewed-rules', reviewStatus='reviewed', evidenceRefs=['rules-proof'], unitTypes=['Thương'], heroSlots=[dict(heroRefs=['hero:'+name], tacticSlots=[dict(tacticRefs=['tactic:'+chr(97+index*2)]),dict(tacticRefs=['tactic:'+chr(98+index*2)])], bookSlots=[dict(bookRefs=['book:a']),dict(bookRefs=['book:b']),dict(bookRefs=['book:c'])],statFocusRaw='Trí Lực') for index,name in enumerate(('a','b','c'))], requirements=[],effectBundles=[],notes='')
        evidence[1]['configFingerprint'] = config_fingerprint(config)
        legacy = dict(teams=[dict(id='team-a')],coexist=[dict(groupLabel='Same name',teams=[])])
        catalog = {'heroes-dict':[{'viet':name.upper()} for name in ('a','b','c')], 'tactics':[{'viet':name} for name in 'ABCDEF'], 'books-dict':[{'viet':'A'},{'viet':'B'},{'viet':'C'}]}
        return registry,evidence,dict(configs=[config],evaluations=[],content_links=[],legacy_data=legacy,identity_catalog=catalog)

    def build(self, bundle):
        registry,evidence,options=bundle
        return seasons.build_season_data(registry,evidence,**options)

    def test_complete_bundle_requires_all_three_extension_arrays(self):
        registry,evidence=fixtures()
        with self.assertRaises(ValueError): seasons.build_season_data(registry,evidence,configs=[])

    def test_exact_reviewed_config_resolves_dictionary_refs(self):
        result=self.build(self.bundle())
        self.assertEqual(len(result),5)
        self.assertEqual(result['season-team-configs.json'][0]['id'],'config-a')

    def test_config_invalid_refs_slots_scope_and_condition_fields_reject(self):
        changes = [lambda c:c.update(teamId='missing'),lambda c:c.update(scenarioId='missing'),lambda c:c.update(rulesetId='missing'),lambda c:c['heroSlots'][0].update(heroRefs=['hero:missing']),lambda c:c['heroSlots'][0]['tacticSlots'][0].update(tacticRefs=['tactic:missing']),lambda c:c['heroSlots'][0]['bookSlots'][0].update(bookRefs=['book:missing']),lambda c:c.update(heroSlots=c['heroSlots'][:2]),lambda c:c['heroSlots'][0].update(bookSlots=[]),lambda c:c.update(requirements=[dict(id='r',kind='advisor',mandatory=True,reviewStatus='pending',descriptionRaw='Advisor unknown',evidenceRefs=[],supported=True,status='met')])]
        for index,change in enumerate(changes):
            with self.subTest(index=index):
                bundle=self.bundle();change(bundle[2]['configs'][0])
                with self.assertRaises(ValueError): self.build(bundle)

    def test_config_evidence_fingerprint_mismatch_rejects(self):
        bundle=self.bundle();bundle[2]['configs'][0]['heroSlots'][0]['statFocusRaw']='Võ Lực'
        with self.assertRaises(ValueError): self.build(bundle)

    def test_unknown_canonical_evidence_ref_rejects(self):
        bundle=self.bundle();bundle[1][0]['canonicalRef']={'kind':'hero','id':'hero:missing'}
        with self.assertRaises(ValueError): self.build(bundle)

    def test_legacy_links_fingerprint_and_locator_are_bound(self):
        from pipeline.season_validation import fingerprint
        for bad in ('fingerprint','locator','branch','scope'):
            bundle=self.bundle(); group=bundle[2]['legacy_data']['coexist'][0]
            link=dict(schemaVersion=1,id='legacy-link',kind='coexist',recordId='legacy-group',scenarioId=None,rulesetId=None,configIds=[],reviewStatus='pending',evidenceRefs=[],target=dict(type='legacy-locator',dataset='coexist',locator={'groupIndex':0},contentFingerprint=fingerprint(group)))
            if bad=='fingerprint':link['target']['contentFingerprint']='sha256:'+'0'*64
            if bad=='locator':link['target']['locator']['groupIndex']=1
            if bad=='branch':link['target']['payload']={}
            if bad=='scope':link['rulesetId']='reviewed-rules'
            bundle[2]['content_links']=[link]
            with self.subTest(bad=bad),self.assertRaises(ValueError):self.build(bundle)

    def test_duplicate_config_evaluation_and_record_identity_reject(self):
        bundle=self.bundle();bundle[2]['configs']*=2
        with self.assertRaises(ValueError):self.build(bundle)

    def scored_bundle(self):
        from pipeline.season_validation import config_fingerprint,fingerprint
        bundle=self.bundle();config=bundle[2]['configs'][0]
        selection=dict(schemaVersion=1,configId=config['id'],scenarioId=config['scenarioId'],rulesetId=config['rulesetId'],unitType='Thương',heroSlots=[dict(heroRef=slot['heroRefs'][0],tacticRefs=[x['tacticRefs'][0] for x in slot['tacticSlots']],bookRefs=[x['bookRefs'][0] for x in slot['bookSlots']]) for slot in config['heroSlots']],requirementIds=[],effectBundleIds=[])
        bundle[1][1]['provenance']['provider']='sgsdeck'
        bundle[1][1]['snapshotHash']='sha256:'+'a'*64
        score=dict(provider='sgsdeck',value=121,sourceConfigId='source-a',sourceSeason=bundle[1][1]['sourceSeason'],provenance=bundle[1][1]['provenance'],evidenceRefs=['rules-proof'],sourceSnapshotHash='sha256:'+'a'*64,configFingerprint=config_fingerprint(config),selectionFingerprint=fingerprint(selection),scoredSelection=selection)
        evaluation=dict(schemaVersion=1,id='eval-a',configId=config['id'],scenarioId=config['scenarioId'],rulesetId=config['rulesetId'],rankings=[],sourceScore=score,defaultRankingId=None,reviewStatus='reviewed',reviewNote='Source fixture')
        bundle[2]['evaluations']=[evaluation]
        return bundle

    def test_source_score_selection_and_hash_binding(self):
        bundle=self.scored_bundle()
        self.assertEqual(self.build(bundle)['season-team-evaluations.json'][0]['sourceScore']['value'],121)
        bundle[2]['evaluations'][0]['sourceScore']['scoredSelection']['heroSlots'][0]['heroRef']='hero:c'
        with self.assertRaises(ValueError): self.build(bundle)

    def test_canonical_fingerprint_rejects_unsafe_numbers(self):
        from pipeline.season_validation import fingerprint
        for value in (float('nan'),1.5,9007199254740992):
            with self.subTest(value=value),self.assertRaises(ValueError):fingerprint({'value':value})

    def test_score_wrong_source_snapshot_and_review_status_reject(self):
        for field in ('sourceUrl','sourceSeason','sourceSnapshotHash','reviewStatus'):
            bundle=self.scored_bundle();evaluation=bundle[2]['evaluations'][0];score=evaluation['sourceScore']
            if field=='sourceUrl':score['provenance']=dict(score['provenance'],sourceUrl='https://example.org/unrelated')
            elif field=='sourceSeason':score['sourceSeason']={'number':18}
            elif field=='sourceSnapshotHash':score[field]='sha256:'+'b'*64
            else:evaluation[field]='pending'
            with self.subTest(field=field),self.assertRaises(ValueError):self.build(bundle)

    def test_shared_golden_vectors(self):
        from pipeline.season_validation import config_fingerprint,fingerprint,canonical_bytes,CONFIG_FIELDS
        vector=json.loads((ROOT/'tests/fixtures/season-fingerprint-vectors.json').read_text())
        self.assertEqual(config_fingerprint(vector['config']),vector['configFingerprint'])
        self.assertEqual(canonical_bytes({key:vector['config'][key] for key in CONFIG_FIELDS}).decode(),vector['configCanonical'])
        self.assertEqual(fingerprint(vector['unicodeValue']),vector['unicodeFingerprint'])


class CuratedSeasonBundleTest(unittest.TestCase):
    def bundle(self):
        load=lambda name:json.loads((ROOT/'pipeline'/name).read_text())
        return load('season-registry.json'),load('season-evidence.json'),dict(configs=load('season-team-configs.json'),evaluations=load('season-team-evaluations.json'),content_links=load('season-content-links.json'))

    def test_real_content_inventory_and_no_fabricated_configs(self):
        registry,evidence,options=self.bundle()
        result=seasons.build_season_data(registry,evidence,**options)
        self.assertEqual(result['season-team-configs.json'],[])
        self.assertEqual(result['season-team-evaluations.json'],[])
        links=result['season-content-links.json']
        self.assertEqual(len(links),10)
        source=[link for link in links if link['target']['type']=='source-owned-coexist']
        self.assertEqual(len(source),5)
        self.assertEqual(sum(len(link['target']['payload']['teams']) for link in source),25)
        self.assertTrue(all(link['rulesetId'] is None and not link['configIds'] for link in links))

    def test_source_snapshot_url_and_observation_evidence_must_match(self):
        for mode in ('hash','url','no-observation'):
            registry,evidence,options=self.bundle();link=options['content_links'][0]
            if mode=='hash':link['target']['source']['snapshotHash']='sha256:'+'0'*64
            if mode=='url':link['target']['source']['url']='https://example.org/other'
            if mode=='no-observation':link['evidenceRefs']=['coexist-binh-dien-scenario-confirmation']
            with self.subTest(mode=mode),self.assertRaises(ValueError):seasons.build_season_data(registry,evidence,**options)

    def test_source_nested_slot_identity_and_revision_mutations_reject(self):
        changes=[lambda link:link['target']['payload']['teams'][0]['heroes'].pop(),lambda link:link['target']['payload']['teams'][0]['heroes'][0]['bookSlotsRaw'].pop(),lambda link:link['target']['payload']['teams'][0].update(recordId=link['recordId']),lambda link:link['target']['payload']['teams'][0].update(teamNameRaw='Changed revision'),lambda link:link['target']['payload']['teams'][0]['sourceLocator'].update(csvRecordEnd=999)]
        for index,change in enumerate(changes):
            registry,evidence,options=self.bundle();change(options['content_links'][0])
            with self.subTest(index=index),self.assertRaises(ValueError):seasons.build_season_data(registry,evidence,**options)

    def test_five_file_publication_failure_restores_all_outputs_and_siblings(self):
        import os
        for existed in (False,True):
            with self.subTest(existed=existed),tempfile.TemporaryDirectory() as directory:
                output=Path(directory);registry,evidence,options=self.bundle()
                if existed:seasons.publish_season_data(registry,evidence,output,**options)
                (output/'coexist.json').write_bytes(b'legacy\n')
                before={path.name:path.read_bytes() for path in output.iterdir()}
                registry[0]['labelVi']='Changed label';calls=[];replace=os.replace
                def fail_second(source,destination):
                    calls.append(destination)
                    if len(calls)==2:raise OSError('second replace fails')
                    return replace(source,destination)
                with patch.object(seasons.os,'replace',side_effect=fail_second),self.assertRaises(OSError):
                    seasons.publish_season_data(registry,evidence,output,**options)
                self.assertEqual(before,{path.name:path.read_bytes() for path in output.iterdir()})


class RankingEvidenceTest(unittest.TestCase):
    bundle = SeasonalBundleTest.bundle
    build = SeasonalBundleTest.build
    def test_reviewed_tier_cannot_reuse_scenario_only_evidence(self):
        bundle=self.bundle();config=bundle[2]['configs'][0]
        bundle[2]['evaluations']=[dict(schemaVersion=1,id='tier-a',configId=config['id'],scenarioId=config['scenarioId'],rulesetId=config['rulesetId'],rankings=[dict(id='rank-a',tier='T0',evidenceRefs=['scenario-proof'])],sourceScore=None,defaultRankingId='rank-a',reviewStatus='reviewed',reviewNote='Reviewed ranking')]
        with self.assertRaises(ValueError):self.build(bundle)


class DictionaryAmbiguityTest(unittest.TestCase):
    bundle = SeasonalBundleTest.bundle
    build = SeasonalBundleTest.build

    def test_referenced_dictionary_identity_must_not_be_ambiguous(self):
        bundle=self.bundle()
        bundle[2]['identity_catalog']['heroes-dict'].append({'viet':'A','chinese':'conflicting identity'})
        with self.assertRaises(ValueError):self.build(bundle)


class LookupGenerationGateTest(unittest.TestCase):
    """The season publisher shares the lookup writer exclusion across its window."""

    def recorder(self, events):
        class Exclusion:
            def __init__(self, *args, **options):
                pass

            def __enter__(self):
                events.append("enter")
                return self

            def __exit__(self, *error):
                events.append("exit")
                return False

        return Exclusion

    def replace_recorder(self, events):
        import os
        replace = os.replace

        def record(source, destination):
            events.append("replace")
            return replace(source, destination)

        return record

    def test_exclusion_is_held_from_dictionary_validation_through_the_final_recheck(self):
        registry, evidence = fixtures()
        events = []

        def generation(*args, **options):
            events.append("generation")
            return "lookup:" + "1" * 64

        with tempfile.TemporaryDirectory() as directory:
            with patch.object(seasons, "dictionary_exclusion", self.recorder(events)), \
                    patch.object(seasons, "lookup_generation", generation), \
                    patch.object(seasons.os, "replace", self.replace_recorder(events)):
                seasons.publish_season_data(registry, evidence, Path(directory))

        self.assertEqual(events[0], "enter")
        self.assertEqual(events[1], "generation")
        self.assertEqual(events.count("generation"), 2)
        generation_events = [index for index, event in enumerate(events) if event == "generation"]
        self.assertLess(generation_events[-1], events.index("replace"))

    def test_first_activation_lock_blocks_legacy_season_publication_before_write(self):
        registry, evidence = fixtures()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            output = root / "data"
            output.mkdir()
            lock = root / "pipeline/lookup-output/promotion.lock"
            lock.parent.mkdir(parents=True)
            lock.write_text('{"transaction":"lookup-first-activation"}\n', encoding="utf-8")

            with self.assertRaises(RuntimeError):
                seasons.publish_season_data(registry, evidence, output)

            self.assertFalse((output / "season-registry.json").exists())

    def test_lookup_generation_change_before_replacement_preserves_outputs_without_replace(self):
        registry, evidence = fixtures()
        events = []
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            with patch.object(seasons, "dictionary_exclusion", self.recorder(events)), \
                    patch.object(seasons, "lookup_generation", side_effect=["lookup:" + "1" * 64] * 2):
                seasons.publish_season_data(registry, evidence, output)
            (output / "coexist.json").write_bytes(b'[{"legacy":true}]\n')
            before = {path.name: path.read_bytes() for path in output.iterdir()}
            registry[0]["labelVi"] = "Nhãn mùa mới"
            events.clear()
            with patch.object(seasons, "dictionary_exclusion", self.recorder(events)), \
                    patch.object(seasons, "lookup_generation", side_effect=["lookup:" + "1" * 64, "lookup:" + "0" * 64]) as generation_gate, \
                    patch.object(seasons.os, "replace", self.replace_recorder(events)):
                with self.assertRaises(ValueError):
                    seasons.publish_season_data(registry, evidence, output)
            self.assertEqual(before, {path.name: path.read_bytes() for path in output.iterdir()})
        self.assertEqual(generation_gate.call_count, 2)
        self.assertNotIn("replace", events)
        self.assertEqual(events, ["enter", "exit"])


if __name__ == "__main__":
    unittest.main()
