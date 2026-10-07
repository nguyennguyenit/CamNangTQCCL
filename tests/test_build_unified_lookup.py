import json
import copy
import hashlib
import tempfile
import shutil
import unittest
from pathlib import Path

from pipeline.build_unified_lookup import _validate_payloads, build_candidate, validate_candidate


ROOT = Path(__file__).resolve().parents[1]


class BuildUnifiedLookupTest(unittest.TestCase):
    def _build(self, output):
        return build_candidate(
            inputs=ROOT / "pipeline" / "lookup-inputs",
            source=ROOT / "data" / "sgsdeck",
            identity=ROOT / "pipeline" / "lookup-identity.json",
            translations=ROOT / "pipeline" / "lookup-translations.json",
            output=output,
        )

    def test_build_is_byte_deterministic_and_keeps_candidate_private(self):
        with tempfile.TemporaryDirectory() as directory:
            first = Path(directory) / "first"
            second = Path(directory) / "second"
            first_result = self._build(first)
            second_result = self._build(second)
            self.assertEqual(first_result["generationId"], second_result["generationId"])
            for name in ("heroes-dict.json", "tactics.json", "lookup-catalog.json", "lookup-manifest.json"):
                self.assertEqual((first / name).read_bytes(), (second / name).read_bytes())
            validate_candidate(first)
            generation = json.loads((first / "generation.json").read_bytes())
            self.assertEqual(generation["outputHashes"], first_result["files"])
            translations = json.loads((ROOT / "pipeline" / "lookup-translations.json").read_bytes())
            field_ledger = json.loads((first / "ledger.json").read_bytes())
            self.assertEqual(
                {row["inputFingerprint"] for row in translations["entries"]},
                {row["translationInputFingerprint"] for row in field_ledger if row["translationInputFingerprint"]},
            )
            self.assertEqual(generation["counts"]["fieldLedgerRows"], len(field_ledger))
            empty_restriction = next(
                row for row in field_ledger
                if row["sourceRecordId"] == "cmnzuqc7y000f3wf8wmtxaca8"
                and row["fieldPath"] == "attributes.troopLimit"
            )
            self.assertEqual((empty_restriction["disposition"], empty_restriction["chosenInput"]), ("typed-public", "source"))
            inherited_relation = next(
                row for row in field_ledger
                if row["entityId"] == "tactic:doc-suc-tinh-ke"
                and row["fieldPath"].startswith("attributes.inheritedFrom")
            )
            self.assertEqual((inherited_relation["disposition"], inherited_relation["chosenInput"]), ("mapped-public", "source"))
            unresolved_relation = next(
                row for row in field_ledger
                if row["entityId"] == "tactic:gian-chinh"
                and row["fieldPath"] == "attributes.inheritedFrom"
            )
            self.assertEqual((unresolved_relation["disposition"], unresolved_relation["chosenInput"]), ("private-evidence", "source"))

    def test_legacy_ids_types_golden_deltas_and_full_children_survive(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "candidate"
            self._build(output)
            heroes = json.loads((output / "heroes-dict.json").read_bytes())
            tactics = json.loads((output / "tactics.json").read_bytes())
            catalog = json.loads((output / "lookup-catalog.json").read_bytes())
            self.assertEqual(len({row["id"] for row in heroes}), len(heroes))
            self.assertEqual(len({row["id"] for row in tactics}), len(tactics))
            by_name = {row["viet"]: row for row in heroes}
            expected = {
                "Hạ Hầu Đôn": ("thuan", "S"),
                "Vương Nguyên Cơ": ("mi", "80"),
                "Nhạc Tiến": ("toc", "58"),
                "Trương Xuân Hoa": ("mi", "75"),
                "Quan Ngân Bình": ("mi", "79"),
                "Mã Vân Lộc": ("mi", "75"),
                "Lỗ Túc": ("cung", "S"),
                "Lữ Mông": ("cung", "S"),
                "Lữ Linh Ỷ": ("mi", "74"),
                "SP Lữ Mông": ("cung", "S"),
                "Đổng Bạch": ("mi", "77"),
            }
            for name, (field, value) in expected.items():
                row = by_name[name]
                actual = row["troopApt"][field] if field in row["troopApt"] else row["stats"][field]
                self.assertEqual(actual, value, name)
            self.assertTrue(all(isinstance(row["cost"], str) for row in heroes[:112]))
            self.assertEqual(len(catalog["specials"]), 90)
            self.assertEqual(sum(len(row["options"]) for row in catalog["troopMods"]), 192)
            self.assertEqual(sum(len(row["levels"]) for row in catalog["buildings"]), 426)

            baseline_heroes = json.loads((ROOT / "pipeline" / "lookup-inputs" / "heroes-dict.json").read_bytes())
            output_heroes = {row["id"]: row for row in heroes}
            for baseline in baseline_heroes:
                identifier = next(row["id"] for row in heroes if row["viet"] == baseline["viet"])
                output = output_heroes[identifier]
                for field in ("inheritTacticCn", "roleTag", "roleTagViet"):
                    if baseline.get(field) is not None:
                        self.assertIsNotNone(output.get(field), f"{identifier}.{field}")
            for identifier in ("hero:sp-chu-du", "hero:sp-chu-tuan", "hero:sp-tuan-uc", "hero:sp-quach-gia"):
                self.assertEqual(output_heroes[identifier]["lookup"]["variant"], "sp")

            baseline_tactics = json.loads((ROOT / "pipeline" / "lookup-inputs" / "tactics.json").read_bytes())
            output_tactics = {row["id"]: row for row in tactics}
            for baseline in baseline_tactics:
                identifier = next(row["id"] for row in tactics if row["viet"] == baseline["viet"])
                self.assertEqual(type(output_tactics[identifier].get("target")), type(baseline.get("target")))

    def test_acquisition_union_revisions_rates_and_pending_are_semantic(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "candidate"
            self._build(output)
            tactics = json.loads((output / "tactics.json").read_bytes())
            by_id = {row["id"]: row for row in tactics}
            catalog = json.loads((output / "lookup-catalog.json").read_bytes())
            tam_the = by_id["tactic:tam-the-tran"]
            self.assertEqual(tam_the["lookup"]["acquiredFromVi"], ["Chư Hầu Thảo Đổng"])
            self.assertIn("chọn 4 thẻ bất kỳ", tam_the["lookup"]["exchangeConditionVi"].lower())
            self.assertNotIn("× 4", tam_the["lookup"]["exchangeConditionVi"])
            placeholder_fallback = by_id["tactic:nhanh-tri-dong-nao"]
            self.assertNotEqual(placeholder_fallback["effect"], "待補充")
            self.assertNotEqual(placeholder_fallback["effectViet"], "Chờ bổ sung")
            self.assertFalse(placeholder_fallback["pending"])
            rates = {row["lookup"]["activationRate"] for row in tactics}
            self.assertIn(1, rates)
            self.assertIn(0.25, rates)
            dai_kich = next(row for row in catalog["troopMods"] if row["id"] == "troop-mod:dai-kich-si")
            self.assertEqual(len(dai_kich["revisions"]), 3)
            self.assertEqual(sum(row["isCurrent"] for row in dai_kich["revisions"]), 1)
            self.assertEqual(
                [row["effectiveDate"] for row in dai_kich["revisions"]],
                ["2024-04-17", "2021-06-09", None],
            )
            for identifier in ("troop-mod:dan-duong-binh", "troop-mod:tien-dang-tu-si"):
                revisions = next(row["revisions"] for row in catalog["troopMods"] if row["id"] == identifier)
                self.assertTrue(revisions[0]["isCurrent"])
                self.assertIsNotNone(revisions[0]["effectiveDate"])
                self.assertFalse(revisions[-1]["isCurrent"])
            self.assertFalse([row for row in tactics if row.get("effect") and not row.get("effectViet")])
            for group in ("equipment", "specials", "advisors", "troopMods", "buildings"):
                for row in catalog[group]:
                    for condition in row["conditions"]:
                        self.assertNotRegex(condition["textVi"], r"[\u3400-\u9fff]")

    def test_build_uses_captured_bytes_when_source_path_changes_after_capture(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            reference = directory / "reference"
            expected = self._build(reference)
            source_copy = directory / "source"
            shutil.copytree(ROOT / "data" / "sgsdeck", source_copy)
            changed = directory / "changed"

            def replace_source_after_capture():
                (source_copy / "generals.json").write_text("{}", encoding="utf-8")

            actual = build_candidate(
                inputs=ROOT / "pipeline" / "lookup-inputs",
                source=source_copy,
                identity=ROOT / "pipeline" / "lookup-identity.json",
                translations=ROOT / "pipeline" / "lookup-translations.json",
                output=changed,
                after_capture=replace_source_after_capture,
            )
            self.assertEqual(actual, expected)
            self.assertEqual((source_copy / "generals.json").read_text(encoding="utf-8"), "{}")
            for name in ("heroes-dict.json", "tactics.json", "lookup-catalog.json"):
                self.assertEqual((changed / name).read_bytes(), (reference / name).read_bytes())

    def test_reviewed_activation_rate_correction_is_published_and_ledgered(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "candidate"
            self._build(output)
            tactics = json.loads((output / "tactics.json").read_bytes())
            by_id = {row["id"]: row for row in tactics}
            self.assertEqual(by_id["tactic:thien-uy-khieu-tran"]["lookup"]["activationRate"], 0.5)
            for row in tactics:
                rate = row["lookup"]["activationRate"]
                self.assertTrue(rate is None or 0 <= rate <= 1, row["id"])
            field_ledger = json.loads((output / "ledger.json").read_bytes())
            corrected = next(
                row for row in field_ledger
                if row["entityId"] == "tactic:thien-uy-khieu-tran"
                and row["fieldPath"] == "attributes.activationRate"
            )
            canonical_sha = lambda value: hashlib.sha256(
                (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode()
            ).hexdigest()
            self.assertEqual((corrected["disposition"], corrected["chosenInput"]), ("corrected-public", "source"))
            self.assertEqual(corrected["sourceValueHash"], canonical_sha(50))
            self.assertEqual(corrected["localValueHash"], canonical_sha(0.5))

    def _input_copy(self, directory, category=None, mutate=None, mutate_guide=None):
        """Copy the captured snapshot + sibling inputs, mutate them and rebind manifest, identity and guide hashes."""
        source_copy = directory / "source"
        shutil.copytree(ROOT / "data" / "sgsdeck", source_copy)
        manifest = json.loads((source_copy / "manifest.json").read_bytes())
        if category is not None:
            document = json.loads((source_copy / f"{category}.json").read_bytes())
            mutate(document)
            body = json.dumps(document, ensure_ascii=False).encode()
            (source_copy / f"{category}.json").write_bytes(body)
            manifest["files"][category] = hashlib.sha256(body).hexdigest()
        manifest_bytes = json.dumps(manifest, ensure_ascii=False).encode()
        (source_copy / "manifest.json").write_bytes(manifest_bytes)
        identity_dir = directory / "identity"
        identity_dir.mkdir()
        identity = json.loads((ROOT / "pipeline" / "lookup-identity.json").read_bytes())
        identity["sourceManifestHash"] = hashlib.sha256(manifest_bytes).hexdigest()
        (identity_dir / "lookup-identity.json").write_text(json.dumps(identity, ensure_ascii=False), encoding="utf-8")
        shutil.copy2(ROOT / "pipeline" / "sgsdeck-name-map.json", identity_dir / "sgsdeck-name-map.json")
        guide = json.loads((ROOT / "pipeline" / "sgsdeck-guide.json").read_bytes())
        guide["snapshotManifestHash"] = hashlib.sha256(manifest_bytes).hexdigest()
        if mutate_guide is not None:
            mutate_guide(guide)
        (identity_dir / "sgsdeck-guide.json").write_text(json.dumps(guide, ensure_ascii=False), encoding="utf-8")
        return source_copy, identity_dir / "lookup-identity.json"

    def test_stale_source_value_correction_fails_the_build(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)

            def drift(document):
                record = next(row for row in document["records"] if row["sourceId"] == "cmtb9e3c6000058f84ugbcun5")
                record["attributes"]["activationRate"] = 0.5

            source_copy, identity = self._input_copy(directory, "tactics", drift)
            with self.assertRaisesRegex(ValueError, "stale source value correction"):
                build_candidate(
                    inputs=ROOT / "pipeline" / "lookup-inputs",
                    source=source_copy,
                    identity=identity,
                    translations=ROOT / "pipeline" / "lookup-translations.json",
                    output=directory / "candidate",
                )

    def test_hero_guide_publishes_reviewed_usage_and_card_packs(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "candidate"
            self._build(output)
            heroes = json.loads((output / "heroes-dict.json").read_bytes())
            by_id = {row["id"]: row for row in heroes}
            dien_vi = by_id["hero:sp-dien-vi"]["lookup"]
            self.assertEqual(dien_vi["usageZh"], "可留一個，優先拆折衝禦侮、酌情換虎衛軍，其次升星")
            self.assertIn("Đánh Bại Quân Địch", dien_vi["usageVi"])
            self.assertEqual(
                [(row["packVi"], row["categoryVi"], row["isCore"], row["coreRate"], row["nonCoreRate"]) for row in dien_vi["cardPacks"]],
                [
                    ("Danh tướng", "Gói Danh tướng", True, 0.34, 0.66),
                    ("Sưu tầm", "Gói Sưu tầm", False, 0.36, 0.64),
                    ("Động Như Lôi Đình", "Gói EX (Quyền Âm Lôi)", True, 0.41, 0.59),
                    ("PK Danh tướng III", "Gói Danh tướng PK", True, 0.47, 0.53),
                ],
            )
            self.assertEqual(dien_vi["cardPacks"][0]["packZh"], "名將")
            self.assertEqual(sum(row["lookup"]["usageVi"] is not None for row in heroes), 94)
            self.assertEqual(sum(bool(row["lookup"]["cardPacks"]) for row in heroes), 126)
            for row in heroes:
                self.assertEqual(row["lookup"]["usageVi"] is None, row["lookup"]["usageZh"] is None, row["id"])
            ledger = {
                (row["entityId"], row["fieldPath"]): row
                for row in json.loads((output / "ledger.json").read_bytes())
            }
            usage = ledger[("hero:sp-dien-vi", "guide.usage")]
            self.assertEqual(usage["disposition"], "translated-public")
            self.assertIsNotNone(usage["translationInputFingerprint"])
            pack = ledger[("hero:sp-dien-vi", "guide.cardPacks[0].tier")]
            self.assertEqual(pack["disposition"], "typed-public")
            self.assertEqual(ledger[("hero:tuan-uc", "guide.usage")]["disposition"], "missing-source")

    def test_unknown_card_pack_name_fails_the_build(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)

            def rename_pack(document):
                document["cardPacks"][0]["nameZh"] = "新卡包"

            source_copy, identity = self._input_copy(directory, mutate_guide=rename_pack)
            with self.assertRaisesRegex(ValueError, "unknown nonempty enum card pack"):
                build_candidate(
                    inputs=ROOT / "pipeline" / "lookup-inputs",
                    source=source_copy,
                    identity=identity,
                    translations=ROOT / "pipeline" / "lookup-translations.json",
                    output=directory / "candidate",
                )

    def test_glossary_change_invalidates_every_stale_translation(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            translation_copy = directory / "translations.json"
            ledger = json.loads((ROOT / "pipeline" / "lookup-translations.json").read_bytes())
            ledger["glossaryVersion"] = "changed-without-review"
            translation_copy.write_text(json.dumps(ledger, ensure_ascii=False), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "stale translation fingerprint"):
                build_candidate(
                    inputs=ROOT / "pipeline" / "lookup-inputs",
                    source=ROOT / "data" / "sgsdeck",
                    identity=ROOT / "pipeline" / "lookup-identity.json",
                    translations=translation_copy,
                    output=directory / "candidate",
                )

    def test_public_projection_is_strict_and_has_no_provider_provenance(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "candidate"
            self._build(output)
            for name in ("heroes-dict.json", "tactics.json", "lookup-catalog.json", "lookup-manifest.json"):
                raw = (output / name).read_bytes()
                self.assertNotIn(b"sourceUrl", raw)
                self.assertNotIn(b"fetchedAt", raw)
                self.assertNotIn(b"sgsdeck.com", raw)

    def test_output_alias_and_symlink_are_rejected_before_replacement(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "candidate"
            output.mkdir()
            sentinel = output / "sentinel.txt"
            sentinel.write_text("keep", encoding="utf-8")
            with self.assertRaises(ValueError):
                build_candidate(
                    inputs=ROOT / "pipeline" / "lookup-inputs",
                    source=ROOT / "data" / "sgsdeck",
                    identity=ROOT / "pipeline" / "lookup-identity.json",
                    translations=ROOT / "pipeline" / "lookup-translations.json",
                    output=ROOT / "data" / "sgsdeck",
                )
            link = Path(directory) / "source-link"
            link.symlink_to(ROOT / "data" / "sgsdeck", target_is_directory=True)
            with self.assertRaises(ValueError):
                build_candidate(
                    inputs=ROOT / "pipeline" / "lookup-inputs",
                    source=link,
                    identity=ROOT / "pipeline" / "lookup-identity.json",
                    translations=ROOT / "pipeline" / "lookup-translations.json",
                    output=output,
                )
            self.assertEqual(sentinel.read_text(encoding="utf-8"), "keep")
            protected_root = Path(directory) / "protected-root"
            protected_root.mkdir()
            copied_inputs = protected_root / "inputs"
            copied_source = protected_root / "source"
            shutil.copytree(ROOT / "pipeline" / "lookup-inputs", copied_inputs)
            shutil.copytree(ROOT / "data" / "sgsdeck", copied_source)
            copied_identity = protected_root / "lookup-identity.json"
            copied_translations = protected_root / "lookup-translations.json"
            shutil.copy2(ROOT / "pipeline" / "lookup-identity.json", copied_identity)
            shutil.copy2(ROOT / "pipeline" / "lookup-translations.json", copied_translations)
            shutil.copy2(ROOT / "pipeline" / "sgsdeck-name-map.json", protected_root / "sgsdeck-name-map.json")
            shutil.copy2(ROOT / "pipeline" / "sgsdeck-guide.json", protected_root / "sgsdeck-guide.json")
            with self.assertRaisesRegex(ValueError, "overlaps"):
                build_candidate(
                    inputs=copied_inputs,
                    source=copied_source,
                    identity=copied_identity,
                    translations=copied_translations,
                    output=protected_root,
                )
            self.assertTrue((copied_inputs / "manifest.json").is_file())

    def test_output_parent_replacement_cannot_redirect_candidate(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            approved = directory / "approved"
            approved.mkdir()
            moved = directory / "moved-approved"
            outside = directory / "outside"
            outside.mkdir()

            def redirect_parent_after_capture():
                approved.rename(moved)
                approved.symlink_to(outside, target_is_directory=True)

            with self.assertRaises(ValueError):
                build_candidate(
                    inputs=ROOT / "pipeline" / "lookup-inputs",
                    source=ROOT / "data" / "sgsdeck",
                    identity=ROOT / "pipeline" / "lookup-identity.json",
                    translations=ROOT / "pipeline" / "lookup-translations.json",
                    output=approved / "candidate",
                    after_capture=redirect_parent_after_capture,
                )
            self.assertFalse((outside / "candidate").exists())
            self.assertFalse((moved / "candidate").exists())

    def test_output_ancestor_replacement_cannot_redirect_nested_candidate(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            approved = directory / "approved"
            (approved / "nested").mkdir(parents=True)
            moved = directory / "moved-approved"
            outside = directory / "outside"
            outside.mkdir()

            def redirect_ancestor_after_capture():
                approved.rename(moved)
                approved.symlink_to(outside, target_is_directory=True)

            with self.assertRaises(ValueError):
                build_candidate(
                    inputs=ROOT / "pipeline" / "lookup-inputs",
                    source=ROOT / "data" / "sgsdeck",
                    identity=ROOT / "pipeline" / "lookup-identity.json",
                    translations=ROOT / "pipeline" / "lookup-translations.json",
                    output=approved / "nested" / "candidate",
                    after_capture=redirect_ancestor_after_capture,
                )
            self.assertFalse((outside / "nested" / "candidate").exists())
            self.assertFalse((moved / "nested" / "candidate").exists())

    def test_strict_validator_rejects_scalar_and_reference_corruption(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "candidate"
            self._build(output)
            heroes = json.loads((output / "heroes-dict.json").read_bytes())
            tactics = json.loads((output / "tactics.json").read_bytes())
            catalog = json.loads((output / "lookup-catalog.json").read_bytes())
            cases = [
                ("growth", lambda h, t, c: h[0]["lookup"]["growth"].update(luc="invalid")),
                ("flag", lambda h, t, c: h[0]["lookup"]["flags"].update(isSp="invalid")),
                ("advisor reference", lambda h, t, c: h[0]["lookup"].update(advisorId="advisor:missing")),
                ("category text", lambda h, t, c: h[0]["lookup"].update(categoryVi={})),
                ("civil points", lambda h, t, c: h[0]["lookup"].update(civilInnatePoints="invalid")),
                ("variant", lambda h, t, c: h[0]["lookup"].update(variant="invalid")),
                ("activation", lambda h, t, c: t[0]["lookup"].update(activationRate="invalid")),
                ("activation range", lambda h, t, c: t[0]["lookup"].update(activationRate=50)),
                ("tactic text", lambda h, t, c: t[0].update(effectViet={})),
                ("special text", lambda h, t, c: c["specials"][0].update(descriptionVi={})),
                ("advisor text", lambda h, t, c: c["advisors"][0].update(effectVi={})),
                ("advisor points", lambda h, t, c: c["advisors"][0].update(tacticPoints="invalid")),
                ("troop option text", lambda h, t, c: c["troopMods"][0]["options"][0].update(descriptionVi={})),
                ("max level", lambda h, t, c: c["buildings"][0].update(maxLevel="invalid")),
                ("building level text", lambda h, t, c: c["buildings"][0]["levels"][0].update(effectVi={})),
                ("usage text", lambda h, t, c: h[0]["lookup"].update(usageVi={})),
                ("usage without source", lambda h, t, c: next(row for row in h if row["lookup"]["usageVi"])["lookup"].update(usageZh=None)),
                ("card pack rate", lambda h, t, c: next(row for row in h if row["lookup"]["cardPacks"])["lookup"]["cardPacks"][0].update(coreRate="invalid")),
                ("card pack shape", lambda h, t, c: next(row for row in h if row["lookup"]["cardPacks"])["lookup"]["cardPacks"][0].update(packId="p1")),
                ("card pack list", lambda h, t, c: h[0]["lookup"].update(cardPacks=None)),
            ]
            for label, mutate in cases:
                candidate_heroes = copy.deepcopy(heroes)
                candidate_tactics = copy.deepcopy(tactics)
                candidate_catalog = copy.deepcopy(catalog)
                mutate(candidate_heroes, candidate_tactics, candidate_catalog)
                with self.subTest(label), self.assertRaises(ValueError):
                    _validate_payloads(candidate_heroes, candidate_tactics, candidate_catalog)

    def test_validate_rejects_semantically_invalid_hash_consistent_candidate(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "candidate"
            self._build(output)
            catalog_path = output / "lookup-catalog.json"
            catalog = json.loads(catalog_path.read_bytes())
            catalog["troopMods"][0]["conditions"] = [{"kind": "scenario", "textVi": "兵演春秋"}]
            catalog_bytes = json.dumps(catalog, ensure_ascii=False, sort_keys=True, indent=2).encode() + b"\n"
            catalog_path.write_bytes(catalog_bytes)
            manifest_path = output / "lookup-manifest.json"
            manifest = json.loads(manifest_path.read_bytes())
            manifest["files"]["lookup-catalog.json"] = hashlib.sha256(catalog_bytes).hexdigest()
            manifest["generationId"] = "lookup:" + hashlib.sha256(
                (json.dumps(manifest["files"], ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode()
            ).hexdigest()
            manifest_path.write_bytes(json.dumps(manifest, ensure_ascii=False, sort_keys=True, indent=2).encode() + b"\n")
            generation_path = output / "generation.json"
            generation = json.loads(generation_path.read_bytes())
            generation["generationId"] = manifest["generationId"]
            generation["outputHashes"] = manifest["files"]
            generation_path.write_bytes(json.dumps(generation, ensure_ascii=False, sort_keys=True, indent=2).encode() + b"\n")
            with self.assertRaisesRegex(ValueError, "contains CJK"):
                validate_candidate(output)

    def test_validate_rejects_hash_consistent_blank_and_stale_vietnamese_effects(self):
        with tempfile.TemporaryDirectory() as directory:
            for replacement, expected_error in (
                ("", "effect translation state"),
                ("Nội dung đã bị thay đổi", "does not match reviewed content"),
            ):
                with self.subTest(replacement=replacement):
                    output = Path(directory) / ("blank" if replacement == "" else "stale")
                    self._build(output)
                    tactics_path = output / "tactics.json"
                    tactics = json.loads(tactics_path.read_bytes())
                    next(row for row in tactics if row["id"] == "tactic:tam-the-tran")["effectViet"] = replacement
                    tactics_bytes = json.dumps(tactics, ensure_ascii=False, sort_keys=True, indent=2).encode() + b"\n"
                    tactics_path.write_bytes(tactics_bytes)
                    manifest_path = output / "lookup-manifest.json"
                    manifest = json.loads(manifest_path.read_bytes())
                    manifest["files"]["tactics.json"] = hashlib.sha256(tactics_bytes).hexdigest()
                    manifest["generationId"] = "lookup:" + hashlib.sha256(
                        (json.dumps(manifest["files"], ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode()
                    ).hexdigest()
                    manifest_path.write_bytes(json.dumps(manifest, ensure_ascii=False, sort_keys=True, indent=2).encode() + b"\n")
                    generation_path = output / "generation.json"
                    generation = json.loads(generation_path.read_bytes())
                    generation["generationId"] = manifest["generationId"]
                    generation["outputHashes"] = manifest["files"]
                    generation_path.write_bytes(json.dumps(generation, ensure_ascii=False, sort_keys=True, indent=2).encode() + b"\n")
                    with self.assertRaisesRegex(ValueError, expected_error):
                        validate_candidate(output)


if __name__ == "__main__":
    unittest.main()
