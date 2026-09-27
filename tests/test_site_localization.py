import contextlib
import copy
import hashlib
import json
import io
import tempfile
import shutil
import unittest
from pathlib import Path

from pipeline.lookup_translations import canonical_json_bytes
from pipeline.site_localization import (
    _assert_lookup_publication,
    _data_classification,
    glossary_digest,
    check,
    compile_candidate,
    expected_fingerprints,
    inventory_report,
    load_policy,
    load_source_pack,
    recommended_note_inputs,
    hydrate_inputs,
    main,
    text_digest,
    validate_review_receipts,
    site_translation_obligations,
    ui_source_locations,
    validate_source_pack,
    verify_cache_layout,
    verify_pack_pins,
    write_source_pack,
)


ROOT = Path(__file__).resolve().parents[1]


class KhaiHoangNoteClassificationTest(unittest.TestCase):
    def test_split_notes_remain_reviewable_and_han_requires_translation(self):
        self.assertEqual(_data_classification(("teams", 3, "buildNote"), "Cộng Trí Lực."), "authored-vi")
        self.assertEqual(_data_classification(("teams", 3, "openingNote"), "Ưu tiên đất Thương."), "authored-vi")
        self.assertEqual(_data_classification(("teams", 14, "buildNote"), "Chiến pháp 疾風豪雨"), "translate")


class SiteLocalizationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.policy = load_policy(ROOT)
        cls.pack = load_source_pack(ROOT)

    def test_policy_covers_full_site_and_required_owners(self):
        report = inventory_report(ROOT, policy=self.policy, pack=self.pack)
        self.assertEqual(
            [row["id"] for row in report["sections"]],
            ["analyze", "coexist", "khaihoang", "lookup", "recruit-tracker", "roster-recommend", "team-chuan", "team-khac"],
        )
        self.assertEqual([row["id"] for row in report["routeFamilies"]], ["khaihoang-detail", "legacy-detail", "recommended-detail"])
        self.assertEqual(report["unknownLocations"], 0)
        self.assertEqual(report["unknownLocationDetails"], [])
        self.assertEqual(report["duplicateLocations"], 0)
        self.assertEqual(report["capturedSourcePack"]["records"], 1366)
        self.assertEqual(report["capturedSourcePack"]["noteBlocks"], 1967)
        self.assertEqual(report["translation"]["recommendedObligations"], 1967)
        self.assertEqual(report["translation"]["lookupReviewObligations"], 3503)
        self.assertGreater(report["translation"]["expectedObligations"], 5470)
        self.assertEqual(report["translation"]["missing"], 0)
        obligations = site_translation_obligations(ROOT, self.pack)
        site_keys = {(item["entityId"], item["fieldPath"]) for item in obligations}
        lookup = json.loads((ROOT / "pipeline/lookup-translations.json").read_bytes())
        lookup_keys = {(item["entityId"], item["fieldPath"]) for item in lookup["entries"]}
        self.assertEqual(len(site_keys), 2075)
        self.assertEqual(len(lookup_keys), 3503)
        self.assertTrue(site_keys.isdisjoint(lookup_keys))
        self.assertEqual(len(site_keys | lookup_keys), report["translation"]["expectedObligations"])

    def test_capture_layout_rejects_corrupted_page_and_path_escape(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "page.html").write_bytes(b"source")
            inventory = {"inventoryHash": "sha256:" + "1" * 64}
            (root / "scope-inventory.json").write_bytes(canonical_json_bytes(inventory))
            manifest = {
                "inventoryHash": inventory["inventoryHash"],
                "pages": {
                    "https://example.invalid/source": {
                        "path": "page.html",
                        "sha256": hashlib.sha256(b"source").hexdigest(),
                    }
                },
            }
            (root / "manifest.json").write_bytes(canonical_json_bytes(manifest))
            self.assertEqual(verify_cache_layout(root)["cachedPageBytes"], len(b"source"))

            (root / "page.html").write_bytes(b"sourcf")
            with self.assertRaises(ValueError):
                verify_cache_layout(root)

            repository = root / "repository"
            (repository / "pipeline").mkdir(parents=True)
            (repository / "pipeline/site-localization-policy.json").write_bytes(
                canonical_json_bytes(self.policy)
            )
            output = repository / "pipeline/localization-inputs/recommended.json"
            with self.assertRaises(ValueError):
                main([
                    "capture",
                    "--root", str(repository),
                    "--cache", str(root),
                    "--output", str(output),
                ])
            self.assertFalse(output.exists())

            manifest["pages"]["https://example.invalid/source"] = {
                "path": "../outside.html",
                "sha256": hashlib.sha256(b"source").hexdigest(),
            }
            (root / "manifest.json").write_bytes(canonical_json_bytes(manifest))
            with self.assertRaises(ValueError):
                verify_cache_layout(root)
            with self.assertRaises(ValueError):
                main([
                    "capture",
                    "--root", str(repository),
                    "--cache", str(root),
                    "--output", str(output),
                ])
            self.assertFalse(output.exists())

    def test_ui_source_expression_is_distinct_from_stable_location_identity(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "js/example.js"
            source.parent.mkdir(parents=True)
            source.write_text("try {} catch (caught) { show(caught.message); }", encoding="utf-8")
            obligation = (
                "ui:test/error",
                "error.message",
                "caught.message",
                "js/example.js",
                "render",
                "error",
                "translate",
            )
            locations, missing = ui_source_locations(root, self.policy["artifacts"]["ledger"], (obligation,))
            self.assertEqual(missing, [])
            self.assertEqual((locations[0]["entityId"], locations[0]["fieldPath"]), ("ui:test/error", "error.message"))
            source.write_text("try {} catch (other) { show(other.message); }", encoding="utf-8")
            _, missing = ui_source_locations(root, self.policy["artifacts"]["ledger"], (obligation,))
            self.assertEqual(missing, [{
                "entityId": "ui:test/error",
                "fieldPath": "error.message",
                "source": "js/example.js",
                "sourceExpression": "caught.message",
            }])
            renamed = (*obligation[:2], "other.message", *obligation[3:])
            locations, missing = ui_source_locations(root, self.policy["artifacts"]["ledger"], (renamed,))
            self.assertEqual(missing, [])
            self.assertEqual((locations[0]["entityId"], locations[0]["fieldPath"]), ("ui:test/error", "error.message"))

    def test_captured_pack_is_portable_and_deterministic_across_roots(self):
        validate_source_pack(self.pack)
        encoded = canonical_json_bytes(self.pack)
        self.assertNotIn(b"/Users/", encoded)
        self.assertNotIn(b"displayNameVi", encoded)
        with tempfile.TemporaryDirectory() as first, tempfile.TemporaryDirectory() as second:
            left = Path(first) / "recommended.json"
            right = Path(second) / "recommended.json"
            left_result = write_source_pack(copy.deepcopy(self.pack), left)
            right_result = write_source_pack(copy.deepcopy(self.pack), right)
            self.assertEqual(left.read_bytes(), right.read_bytes())
            self.assertEqual(left_result["sha256"], right_result["sha256"])
            left.write_text("{}", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "source update approval"):
                write_source_pack(self.pack, left)
        pins = self.policy["baseline"]["sourcePins"]
        verify_pack_pins(self.pack, pins)
        for label, mutate in (
            ("record", lambda value: value["records"][0].update(notesRaw="changed")),
            ("inventory", lambda value: value["inventory"].update(defaultSourceSeasonId="changed")),
            ("note", lambda value: next(iter(next(iter(value["displayNotes"].values())).values()))["blocks"][0].update(textRaw="changed")),
        ):
            candidate = copy.deepcopy(self.pack)
            mutate(candidate)
            with self.subTest(label), self.assertRaises(ValueError):
                verify_pack_pins(candidate, pins)
        with tempfile.TemporaryDirectory() as first, tempfile.TemporaryDirectory() as second:
            outputs = []
            for temporary in (first, second):
                root = Path(temporary)
                identity = root / "identity.json"
                other = root / "other.json"
                identity.write_bytes((ROOT / "pipeline/recommended-identity-map.json").read_bytes())
                other.write_bytes((ROOT / "pipeline/recommended-other-teams.json").read_bytes())
                outputs.append(hydrate_inputs(copy.deepcopy(self.pack), identity, other, pins=pins))
            self.assertEqual(canonical_json_bytes(outputs[0]), canonical_json_bytes(outputs[1]))
            mutated = copy.deepcopy(self.pack)
            next(iter(next(iter(mutated["displayNotes"].values())).values()))["blocks"][0]["textRaw"] = "changed"
            with self.assertRaisesRegex(ValueError, "snapshot"):
                hydrate_inputs(mutated, identity, other, pins=pins)

    def test_recommended_only_completed_ledger_cannot_pass_full_site_gate(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            required = set(self.policy["sourceFiles"]) | {
                self.policy["artifacts"]["capturedSourcePack"],
                "pipeline/lookup-translations.json",
            }
            for relative in required:
                destination = root / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT / relative, destination)
            policy_path = root / "pipeline/site-localization-policy.json"
            policy_path.write_bytes(canonical_json_bytes(self.policy))
            digest = glossary_digest(root, self.policy)
            recommended = expected_fingerprints(recommended_note_inputs(self.pack), digest)
            entries = [{
                "entityId": entity_id,
                "fieldPath": field_path,
                "inputFingerprint": fingerprint,
                "textVi": "Bản dịch đã kiểm",
                "status": "reviewed",
                "review": {
                    "reviewer": "independent test reviewer",
                    "reviewedAt": "2026-09-14T00:00:00Z",
                    "evidence": ["captured input"],
                    "semanticChecks": ["meaning preserved"],
                },
            } for (entity_id, field_path), fingerprint in sorted(recommended.items())]
            ledger_path = root / self.policy["artifacts"]["ledger"]
            ledger_path.write_bytes(canonical_json_bytes({
                "schemaVersion": 1,
                "glossaryVersion": digest,
                "entries": entries,
            }))
            report = check(root, policy=self.policy)
            self.assertEqual(report["exitCode"], 1)
            self.assertEqual(report["coverage"]["expected"], 5578)
            self.assertEqual(report["coverage"]["translated"], 5470)
            self.assertEqual(report["coverage"]["missing"], 108)
            self.assertTrue(any("coverage does not match" in item["reason"] for item in report["problems"]))

    def test_actual_glossary_bytes_and_source_owner_invalidate_fingerprints(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for relative in self.policy["glossary"]["sources"]:
                destination = root / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes((ROOT / relative).read_bytes())
            original_digest = glossary_digest(root, self.policy)
            source = root / self.policy["glossary"]["sources"][0]
            source.write_bytes(source.read_bytes() + b" ")
            changed_digest = glossary_digest(root, self.policy)
            self.assertNotEqual(original_digest, changed_digest)
        base = {
            "entityId": "recommended:s-test/team-test",
            "fieldPath": "displayNotes.blocks.p-1.textRaw",
            "chosenInput": "cùng nguồn",
            "context": {"owner": "team"},
        }
        moved = copy.deepcopy(base)
        moved["context"]["owner"] = "primary"
        self.assertNotEqual(
            expected_fingerprints([base], original_digest),
            expected_fingerprints([moved], original_digest),
        )

    def test_review_receipts_bind_output_session_fingerprint_text_and_glossary(self):
        digest = glossary_digest(ROOT, self.policy)
        entity_id = "recommended:s-test/team-test"
        field_path = "displayNotes.blocks.p-1.textRaw"
        fingerprint = "2" * 64
        text_vi = "Bản dịch đã kiểm"
        ledger = {
            "entries": [{
                "entityId": entity_id,
                "fieldPath": field_path,
                "inputFingerprint": fingerprint,
                "textVi": text_vi,
            }]
        }
        item = {
            "entityId": entity_id,
            "fieldPath": field_path,
            "glossaryDigest": digest,
            "inputFingerprint": fingerprint,
            "textSha256": text_digest(text_vi),
            "verdict": "accepted",
        }
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            output_path = root / "pipeline/localization-reviews/batch-1.json"
            output_path.parent.mkdir(parents=True)
            output = {
                "schemaVersion": 1,
                "batchId": "batch-1",
                "reviewerSession": "review-session",
                "items": [{
                    "entityId": entity_id,
                    "fieldPath": field_path,
                    "inputFingerprint": fingerprint,
                    "glossaryDigest": digest,
                    "textSha256": text_digest(text_vi),
                    "verdict": "accepted",
                }],
            }
            output_bytes = canonical_json_bytes(output)
            output_path.write_bytes(output_bytes)
            receipts = {
                "schemaVersion": 1,
                "batches": [{
                    "batchId": "batch-1",
                    "draftSession": "draft-session",
                    "reviewerSession": "review-session",
                    "reviewedAt": "2026-09-14T00:00:00Z",
                    "outputPath": "pipeline/localization-reviews/batch-1.json",
                    "outputSha256": hashlib.sha256(output_bytes).hexdigest(),
                    "items": [item],
                }],
            }
            self.assertEqual(validate_review_receipts(receipts, ledger, root=root, digest=digest), [])
            duplicate_output = copy.deepcopy(output)
            duplicate_output["items"].append(copy.deepcopy(duplicate_output["items"][0]))
            duplicate_output_bytes = canonical_json_bytes(duplicate_output)
            output_path.write_bytes(duplicate_output_bytes)
            duplicate_output_receipts = copy.deepcopy(receipts)
            duplicate_output_receipts["batches"][0]["outputSha256"] = hashlib.sha256(
                duplicate_output_bytes
            ).hexdigest()
            self.assertTrue(
                validate_review_receipts(
                    duplicate_output_receipts, ledger, root=root, digest=digest
                )
            )

            extra_output = copy.deepcopy(output)
            extra_item = copy.deepcopy(extra_output["items"][0])
            extra_item["entityId"] = "recommended:other/team"
            extra_output["items"].append(extra_item)
            extra_output_bytes = canonical_json_bytes(extra_output)
            output_path.write_bytes(extra_output_bytes)
            extra_output_receipts = copy.deepcopy(receipts)
            extra_output_receipts["batches"][0]["outputSha256"] = hashlib.sha256(
                extra_output_bytes
            ).hexdigest()
            self.assertEqual(
                validate_review_receipts(extra_output_receipts, ledger, root=root, digest=digest),
                [],
            )
            active_extra = copy.deepcopy(ledger)
            active_extra["entries"].append({
                "entityId": extra_item["entityId"],
                "fieldPath": extra_item["fieldPath"],
                "inputFingerprint": fingerprint,
                "textVi": text_vi,
            })
            # Even another accepted batch cannot cherry-pick an active result out
            # of this historical output's active receipt projection.
            second_output = {
                "schemaVersion": 1,
                "batchId": "batch-2",
                "reviewerSession": "second-review-session",
                "items": [extra_item],
            }
            second_bytes = canonical_json_bytes(second_output)
            (output_path.parent / "batch-2.json").write_bytes(second_bytes)
            active_receipts = copy.deepcopy(extra_output_receipts)
            active_receipts["batches"].append({
                "batchId": "batch-2",
                "draftSession": "second-draft-session",
                "reviewerSession": "second-review-session",
                "reviewedAt": "2026-09-23T00:00:00Z",
                "outputPath": "pipeline/localization-reviews/batch-2.json",
                "outputSha256": hashlib.sha256(second_bytes).hexdigest(),
                "items": [extra_item],
            })
            self.assertTrue(validate_review_receipts(active_receipts, active_extra, root=root, digest=digest))

            output_path.write_bytes(output_bytes)
            duplicate_receipt_item = copy.deepcopy(receipts)
            duplicate_receipt_item["batches"][0]["items"].append(
                copy.deepcopy(duplicate_receipt_item["batches"][0]["items"][0])
            )
            self.assertTrue(
                validate_review_receipts(
                    duplicate_receipt_item, ledger, root=root, digest=digest
                )
            )

            duplicate_active_batch = copy.deepcopy(receipts)
            duplicate_active_batch["batches"].append(
                copy.deepcopy(duplicate_active_batch["batches"][0])
            )
            self.assertTrue(
                validate_review_receipts(
                    duplicate_active_batch, ledger, root=root, digest=digest
                )
            )
            for label, mutate in (
                ("same session", lambda value: value["batches"][0].update(reviewerSession="draft-session")),
                ("stale glossary", lambda value: value["batches"][0]["items"][0].update(glossaryDigest="sha256:" + "0" * 64)),
                ("wrong text", lambda value: value["batches"][0]["items"][0].update(textSha256="0" * 64)),
                ("rejected", lambda value: value["batches"][0]["items"][0].update(verdict="rejected")),
            ):
                candidate = copy.deepcopy(receipts)
                mutate(candidate)
                with self.subTest(label):
                    self.assertTrue(validate_review_receipts(candidate, ledger, root=root, digest=digest))
            rebound = copy.deepcopy(receipts)
            rebound_ledger = copy.deepcopy(ledger)
            rebound["batches"][0]["items"][0]["inputFingerprint"] = "3" * 64
            rebound_ledger["entries"][0]["inputFingerprint"] = "3" * 64
            self.assertTrue(validate_review_receipts(rebound, rebound_ledger, root=root, digest=digest))
            changed_ledger = copy.deepcopy(ledger)
            changed_ledger["entries"][0]["textVi"] = "Bản dịch đã bị đổi"
            self.assertTrue(validate_review_receipts(receipts, changed_ledger, root=root, digest=digest))
            output_path.unlink()
            self.assertTrue(validate_review_receipts(receipts, ledger, root=root, digest=digest))
            output_path.write_bytes(output_bytes)
            for label, mutate in (
                ("output rejected", lambda value: value["items"][0].update(verdict="rejected")),
                ("output session mismatch", lambda value: value.update(reviewerSession="other-review-session")),
                ("output key mismatch", lambda value: value["items"][0].update(entityId="recommended:other/team")),
            ):
                candidate_output = copy.deepcopy(output)
                mutate(candidate_output)
                candidate_bytes = canonical_json_bytes(candidate_output)
                output_path.write_bytes(candidate_bytes)
                candidate_receipts = copy.deepcopy(receipts)
                candidate_receipts["batches"][0]["outputSha256"] = hashlib.sha256(candidate_bytes).hexdigest()
                with self.subTest(label):
                    self.assertTrue(validate_review_receipts(candidate_receipts, ledger, root=root, digest=digest))
            output_path.write_bytes(output_bytes)
            changed_digest = "sha256:" + "4" * 64
            rebound = copy.deepcopy(receipts)
            rebound["batches"][0]["items"][0]["glossaryDigest"] = changed_digest
            self.assertTrue(validate_review_receipts(rebound, ledger, root=root, digest=changed_digest))
            output_path.write_bytes(output_bytes + b" ")
            self.assertTrue(validate_review_receipts(receipts, ledger, root=root, digest=digest))

    def test_data_stage_defers_ui_values_while_full_candidate_stays_strict(self):
        cache = ROOT / ".cache"
        cache.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=cache) as temporary:
            data_candidate = Path(temporary) / "data-candidate"
            data_manifest = compile_candidate(ROOT, data_candidate, stage="data")
            self.assertEqual(data_manifest["counts"]["uiPending"], 64)
            scoped = check(ROOT, stage="data", candidate=data_candidate)
            self.assertEqual(scoped["exitCode"], 0)
            self.assertEqual(scoped["uiPending"], 64)
            self.assertEqual(scoped["uiMissingSources"], [])

            full_candidate = Path(temporary) / "full-candidate"
            full_manifest = compile_candidate(ROOT, full_candidate, stage="all")
            self.assertEqual(full_manifest["stage"], "all")
            self.assertEqual(full_manifest["counts"]["uiPending"], 0)
            self.assertEqual(full_manifest["counts"]["uiValues"], 64)
            strict = check(ROOT, stage="all", candidate=full_candidate)
            self.assertEqual(strict["exitCode"], 0)
            self.assertEqual(strict["uiMissingSources"], [])

    def test_publication_rejects_lookup_bytes_outside_reviewed_candidate(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            candidate = root / "candidate"
            public = root / "data"
            candidate.mkdir()
            public.mkdir()
            names = ("heroes-dict.json", "tactics.json", "lookup-catalog.json", "lookup-manifest.json")
            for name in names:
                payload = json.dumps({"name": name}, sort_keys=True).encode()
                (candidate / name).write_bytes(payload)
                (public / name).write_bytes(payload)
            _assert_lookup_publication(root, candidate)
            (public / "heroes-dict.json").write_bytes(b'{"coherent":"replacement"}')
            (public / "lookup-manifest.json").write_bytes(b'{"generationId":"lookup:replacement"}')
            with self.assertRaisesRegex(ValueError, "heroes-dict"):
                _assert_lookup_publication(root, candidate)


class PruneGenerationsTest(unittest.TestCase):
    def reference_root(self, root, generations, pinned):
        reference = root / "src/data/recommended-reference"
        for generation in generations:
            (reference / generation).mkdir(parents=True)
            (reference / generation / "manifest.json").write_text(generation, encoding="utf-8")
        (reference / "current.json").write_bytes(canonical_json_bytes({
            "generationId": pinned, "manifestSha256": "0" * 64, "schemaVersion": 1,
        }))
        return reference

    def prune(self, root):
        with contextlib.redirect_stdout(io.StringIO()):
            return main(["prune", "--root", str(root)])

    def test_prune_keeps_only_the_pinned_generation(self):
        generations = ["a" * 64, "b" * 64, "c" * 64]
        with tempfile.TemporaryDirectory() as temporary:
            reference = self.reference_root(Path(temporary), generations, "b" * 64)
            current = (reference / "current.json").read_bytes()

            self.assertEqual(self.prune(Path(temporary)), 0)

            self.assertEqual(sorted(path.name for path in reference.iterdir()), ["b" * 64, "current.json"])
            self.assertEqual((reference / ("b" * 64) / "manifest.json").read_text(encoding="utf-8"), "b" * 64)
            self.assertEqual((reference / "current.json").read_bytes(), current)

    def test_prune_refuses_a_pin_without_its_generation_and_deletes_nothing(self):
        generations = ["a" * 64, "b" * 64]
        with tempfile.TemporaryDirectory() as temporary:
            reference = self.reference_root(Path(temporary), generations, "d" * 64)

            with self.assertRaisesRegex(ValueError, "pinned Recommended generation"):
                self.prune(Path(temporary))

            self.assertEqual(sorted(path.name for path in reference.iterdir()), ["a" * 64, "b" * 64, "current.json"])


if __name__ == "__main__":
    unittest.main()
