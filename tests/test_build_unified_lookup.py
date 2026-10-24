import json
import re
import copy
import hashlib
import tempfile
import shutil
import unittest
from pathlib import Path

from unittest import mock

from pipeline import build_unified_lookup as build_module
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
                "Vương Nguyên Cơ": ("mi", "50"),
                "Nhạc Tiến": ("toc", "68"),
                "Trương Xuân Hoa": ("mi", "68"),
                "Quan Ngân Bình": ("mi", "50"),
                "Mã Vân Lộc": ("mi", "47"),
                "Lỗ Túc": ("cung", "S"),
                "Lữ Mông": ("cung", "S"),
                "Lữ Linh Ỷ": ("mi", "34"),
                "SP Lữ Mông": ("cung", "S"),
                "Đổng Bạch": ("mi", "57"),
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
            # Mã đã gộp theo client trỏ về mã giữ; mã bị bỏ hẳn (không phải chiến pháp) không còn.
            retired = json.loads((ROOT / "pipeline" / "lookup-client-tactics.json").read_bytes())["retired"]
            for row in tactics:
                for former in row["lookup"]["formerIds"]:
                    output_tactics[former] = row
            for baseline in baseline_tactics:
                # Mã ổn định suy từ tên baseline; tên hiển thị có thể đã theo client.
                identifier = build_module.canonical_id("tactic", baseline.get("viet") or baseline["hanViet"])
                if identifier in retired:
                    # Mã bị bỏ biến mất; mã gộp mở được qua mã giữ (kiểu trường theo mã giữ).
                    self.assertEqual(identifier in output_tactics, retired[identifier] is not None)
                    continue
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
            # SGSDeck `待補充`: chữ Hán không lấy từ baseline cũ mà từ mục `zhEffects` có nguồn khai báo.
            placeholder_fallback = by_id["tactic:nhanh-tri-dong-nao"]
            self.assertNotEqual(placeholder_fallback["effect"], "待補充")
            self.assertNotEqual(placeholder_fallback["effectViet"], "Chờ bổ sung")
            self.assertFalse(placeholder_fallback["pending"])
            zh_effects = json.loads((ROOT / "pipeline" / "lookup-client-tactics.json").read_bytes())["zhEffects"]
            self.assertEqual(placeholder_fallback["effect"], zh_effects["tactic:nhanh-tri-dong-nao"]["text"])
            self.assertEqual(placeholder_fallback["lookup"]["effectZhSource"], {"kind": zh_effects["tactic:nhanh-tri-dong-nao"]["source"]["kind"]})
            self.assertEqual(sum(row["lookup"]["effectZhSource"] is not None for row in tactics), len(zh_effects))
            self.assertFalse([row["id"] for row in tactics if row["pending"]])
            rates = {row["lookup"]["activationRate"] for row in tactics}
            self.assertIn(1, rates)
            self.assertIn(0.25, rates)
            # Cải tạo binh chủng chỉ giữ một bản client: không còn lịch sử bản SGSDeck.
            client_mods = json.loads((ROOT / "pipeline" / "lookup-client-tactics.json").read_bytes())["troopMods"]
            for row in catalog["troopMods"]:
                self.assertEqual(row["revisions"], [])
                self.assertEqual(row["effectVi"], client_mods[row["id"]]["effectVi"])
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
            # Hiệu chỉnh nguồn (0.5) vẫn được ledger ghi; giá trị phát hành là số của client Global (đầy cấp 55%).
            self.assertEqual(by_id["tactic:thien-uy-khieu-tran"]["lookup"]["activationRate"], 0.55)
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
            # SGSDeck gắn lời khuyên của Điển Vi thường (truyền thừa 折衝禦侮) vào bản SP: hồ sơ thường mang nó.
            self.assertEqual((dien_vi["usageVi"], dien_vi["usageZh"]), (None, None))
            base = by_id["hero:dien-vi"]["lookup"]
            self.assertEqual(base["usageZh"], "可留一個，優先拆折衝禦侮、酌情換虎衛軍，其次升星")
            self.assertIn("Đánh Bại Quân Địch", base["usageVi"])
            self.assertIsNone(by_id["hero:sp-tuan-uc"]["lookup"]["usageZh"])
            self.assertIn("Tứ Diện Sở Ca", by_id["hero:tuan-uc"]["lookup"]["usageVi"])
            self.assertIn("Lửa Đuổi Gió Bay", by_id["hero:sp-chu-du"]["lookup"]["usageVi"])
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
            # 126 tướng có gói thẻ trong guide; Hà Thị (không có ở client Global) đã bị bỏ.
            self.assertEqual(sum(bool(row["lookup"]["cardPacks"]) for row in heroes), 125)
            for row in heroes:
                self.assertEqual(row["lookup"]["usageVi"] is None, row["lookup"]["usageZh"] is None, row["id"])
            ledger = {
                (row["entityId"], row["fieldPath"]): row
                for row in json.loads((output / "ledger.json").read_bytes())
            }
            moved = ledger[("hero:sp-dien-vi", "guide.usage")]
            self.assertEqual(moved["disposition"], "corrected-public")
            self.assertEqual(moved["translationInputFingerprint"], ledger[("hero:dien-vi", "guide.usage")]["translationInputFingerprint"])
            self.assertEqual(ledger[("hero:sp-chu-du", "guide.usage")]["disposition"], "translated-public")
            pack = ledger[("hero:sp-dien-vi", "guide.cardPacks[0].tier")]
            self.assertEqual(pack["disposition"], "typed-public")
            self.assertEqual(ledger[("hero:tuan-uc", "guide.cardPacks")]["disposition"], "missing-source")

    def test_stale_usage_reassignment_fails_the_build(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)

            def reword(document):
                next(row for row in document["generals"] if row["sourceId"] == "cmnzwge0b000l94f8usar7du4")["usage"] = "必留一個"

            source_copy, identity = self._input_copy(directory, mutate_guide=reword)
            with self.assertRaisesRegex(ValueError, "stale usage reassignment"):
                build_candidate(
                    inputs=ROOT / "pipeline" / "lookup-inputs",
                    source=source_copy,
                    identity=identity,
                    translations=ROOT / "pipeline" / "lookup-translations.json",
                    output=directory / "candidate",
                )

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
                # Nguồn chữ Hán `zhEffects` chỉ công khai `kind`; `ref`/`note`/`viSha256` ở đầu vào và ledger riêng.
                self.assertNotIn(b'"ref"', raw)
                self.assertNotIn(b'"note"', raw)
                self.assertNotIn(b"viSha256", raw)

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


class ClientHeroSupplementTest(unittest.TestCase):
    def setUp(self):
        self.directory = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.directory, ignore_errors=True)
        self.heroes_dir = self.directory / "heroes"
        self.heroes_dir.mkdir()
        for name in ("tao-ngang", "chu-hang"):
            (self.heroes_dir / f"{name}.webp").write_bytes(b"RIFF")
        patcher = mock.patch.object(build_module, "PUBLIC_HEROES_DIR", self.heroes_dir)
        patcher.start()
        self.addCleanup(patcher.stop)

    def _hero(self, **overrides):
        hero = {
            "id": "hero:tao-ngang", "viet": "Tào Ngang", "chinese": "曹昂", "aliasesVi": [],
            "faction": "Ngụy", "stars": 2, "cost": "3", "isSP": False, "variant": "base",
            "stats": {"luc": "67", "tri": "69", "thong": "74", "toc": "34", "chinh": "68", "mi": "77"},
            "growth": {"luc": 0.68, "tri": 0.17, "thong": 0.31, "toc": 0.15, "chinh": 0.1, "mi": 0.1},
            "troopApt": {"ky": "B", "thuan": "C", "cung": "C", "thuong": "B", "khiGioi": "C"},
            "roleTag": "武", "roleTagViet": "Vũ lực", "selfTacticVi": "An Ủi Quân Dân",
            "portrait": "/heroes/tao-ngang.webp",
        }
        hero.update(overrides)
        return hero

    def _build(self, *, heroes=(), portraits=None, overrides=None, role_tags=None, aliases=None):
        # Ghim GOLDEN_HERO_DELTAS theo client: fixture mang đúng các `stats` đã duyệt của 7 tướng đó.
        client = json.loads((ROOT / "pipeline" / "lookup-client-heroes.json").read_bytes())
        real = client["overrides"]
        pinned = {key: {"stats": real[key]["stats"]} for key in ("hero:vuong-nguyen-co", "hero:nhac-tien", "hero:truong-xuan-hoa", "hero:quan-ngan-binh", "hero:ma-van-loc", "hero:lu-linh-y", "hero:dong-bach")}
        # Client tactics thật bỏ các chiến pháp chỉ có ở SGSDeck: giữ đúng danh sách tướng bị bỏ của client thật.
        overrides = {**pinned, **(overrides or {})}
        document = {
            "schemaVersion": 1,
            "source": {"kind": "game-client", "edition": "Global", "client": "Tam Quốc Chí - Chiến Lược", "version": "24.526", "screen": "Võ Tướng > Minh Giám", "capturedAt": "2026-10-15"},
            "heroes": list(heroes), "portraits": portraits or {}, "overrides": overrides or {}, "roleTags": role_tags or {}, "aliases": aliases or {},
            "retired": client["retired"],
        }
        path = self.directory / "client.json"
        path.write_text(json.dumps(document, ensure_ascii=False), encoding="utf-8")
        # Quân sư client trỏ tới tướng chỉ có trong file tướng client thật; fixture tướng thu gọn nên bỏ hai khóa này
        # cùng bản dịch zh của quân sư (chúng khóa theo chữ Việt client của hai khóa đó).
        tactics = json.loads((ROOT / "pipeline" / "lookup-client-tactics.json").read_bytes())
        tactics.pop("advisors", None)
        tactics.pop("newAdvisors", None)
        tactics["zhTexts"] = {owner: entry for owner, entry in tactics.get("zhTexts", {}).items() if not owner.startswith("advisor:")}
        tactics_path = self.directory / "client-tactics.json"
        tactics_path.write_text(json.dumps(tactics, ensure_ascii=False), encoding="utf-8")
        output = self.directory / "candidate"
        shutil.rmtree(output, ignore_errors=True)
        build_candidate(
            inputs=ROOT / "pipeline" / "lookup-inputs", source=ROOT / "data" / "sgsdeck",
            identity=ROOT / "pipeline" / "lookup-identity.json", translations=ROOT / "pipeline" / "lookup-translations.json",
            client_heroes=path, client_tactics=tactics_path, output=output,
        )
        return output

    def test_valid_client_hero_is_emitted_after_existing_heroes(self):
        output = self._build(heroes=[self._hero()], portraits={"hero:chu-hang": "/heroes/chu-hang.webp"})
        heroes = json.loads((output / "heroes-dict.json").read_bytes())
        by_id = {row["id"]: row for row in heroes}
        self.assertEqual(heroes[-1]["id"], "hero:tao-ngang")
        row = heroes[-1]
        self.assertEqual((row["iconUrl"], row["aliases"], row["hanViet"], row["selfTacticCn"], row["pending"]), ("/heroes/tao-ngang.webp", ["曹昂"], "Tào Ngang", None, False))
        self.assertEqual(row["lookup"]["selfTacticId"], "tactic:an-ui-quan-dan")
        self.assertEqual((row["lookup"]["cardPacks"], row["lookup"]["usageVi"], row["lookup"]["flags"]["isSp"]), ([], None, False))
        self.assertIn("usage", row["lookup"]["missingFields"])
        self.assertNotIn("innateTacticId", row["lookup"]["missingFields"])
        self.assertEqual(by_id["hero:chu-hang"]["iconUrl"], "/heroes/chu-hang.webp")
        validate_candidate(output, client_heroes=self.directory / "client.json", client_tactics=self.directory / "client-tactics.json")
        ledger = json.loads((output / "ledger.json").read_bytes())
        self.assertTrue(any(item["entityId"] == "hero:tao-ngang" and item["chosenInput"] == "client-capture" for item in ledger))

    def test_unknown_self_tactic_name_is_not_linked(self):
        output = self._build(heroes=[self._hero(selfTacticVi="Không Có Chiến Pháp Này")])
        row = json.loads((output / "heroes-dict.json").read_bytes())[-1]
        self.assertIsNone(row["lookup"]["selfTacticId"])
        self.assertIn("innateTacticId", row["lookup"]["missingFields"])

    def test_collision_with_existing_hero_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "collides"):
            self._build(heroes=[self._hero(id="hero:ha-hau-don", viet="Hạ Hầu Đôn")])

    def test_id_must_match_canonical_name(self):
        with self.assertRaisesRegex(ValueError, "does not match"):
            self._build(heroes=[self._hero(id="hero:khac")])

    def test_name_with_trailing_annotation_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "parenthetical"):
            self._build(heroes=[self._hero(id="hero:tao-ngang-khan-vang", viet="Tào Ngang (Khăn Vàng)")])

    def test_portrait_for_hero_with_remote_icon_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "override an existing icon"):
            self._build(portraits={"hero:ha-hau-don": "/heroes/tao-ngang.webp"})

    def test_bad_or_missing_portrait_is_rejected(self):
        for portrait in ("/heroes/Tao-Ngang.webp", "heroes/tao-ngang.webp", "//evil.example/x.webp", "https://x.example/a.webp", "/heroes/tao-ngang.png", "/heroes/missing.webp"):
            with self.subTest(portrait=portrait), self.assertRaisesRegex(ValueError, "portrait"):
                self._build(heroes=[self._hero(portrait=portrait)])

    def test_override_replaces_built_value_and_is_ledgered(self):
        output = self._build(overrides={"hero:ha-hau-don": {"cost": "99", "troopApt": {"ky": "C", "thuan": "S", "cung": "C", "thuong": "C", "khiGioi": "C"}}})
        row = next(item for item in json.loads((output / "heroes-dict.json").read_bytes()) if item["id"] == "hero:ha-hau-don")
        self.assertEqual((row["cost"], row["troopApt"]["ky"]), ("99", "C"))
        ledger = json.loads((output / "ledger.json").read_bytes())
        self.assertTrue(any(item["fieldPath"] == "clientCapture.overrides.cost" and item["localValueHash"] for item in ledger))

    def test_noop_and_malformed_overrides_are_rejected(self):
        built = {item["id"]: item for item in json.loads((ROOT / "data" / "heroes-dict.json").read_bytes())}
        with self.assertRaisesRegex(ValueError, "no-op"):
            self._build(overrides={"hero:ha-hau-don": {"faction": built["hero:ha-hau-don"]["faction"]}})
        with self.assertRaisesRegex(ValueError, "key set"):
            self._build(overrides={"hero:ha-hau-don": {"stats": {"luc": "1"}}})
        with self.assertRaisesRegex(ValueError, "override is invalid"):
            self._build(overrides={"hero:khong-co": {"cost": "3"}})

    def test_role_tag_override_applies_and_requires_both_fields(self):
        output = self._build(overrides={"hero:ha-hau-don": {"roleTag": "聯", "roleTagViet": "Liên"}})
        row = next(item for item in json.loads((output / "heroes-dict.json").read_bytes()) if item["id"] == "hero:ha-hau-don")
        self.assertEqual((row["roleTag"], row["roleTagViet"]), ("聯", "Liên"))
        ledger = json.loads((output / "ledger.json").read_bytes())
        self.assertTrue(any(item["fieldPath"] == "clientCapture.overrides.roleTag" and item["localValueHash"] for item in ledger))
        with self.assertRaisesRegex(ValueError, "together"):
            self._build(overrides={"hero:ha-hau-don": {"roleTag": "聯"}})
        built = next(item for item in json.loads((ROOT / "data" / "heroes-dict.json").read_bytes()) if item["id"] == "hero:ha-hau-don")
        with self.assertRaisesRegex(ValueError, "no-op"):
            self._build(overrides={"hero:ha-hau-don": {"roleTag": built["roleTag"], "roleTagViet": built["roleTagViet"]}})

    def test_tactic_link_override_sets_links_and_inherited_holders(self):
        output = self._build(overrides={"hero:dai-kieu": {"selfTacticId": "tactic:quoc-sac", "inheritTacticId": "tactic:me-hoac"}})
        hero = next(item for item in json.loads((output / "heroes-dict.json").read_bytes()) if item["id"] == "hero:dai-kieu")
        self.assertEqual((hero["lookup"]["selfTacticId"], hero["lookup"]["inheritTacticId"]), ("tactic:quoc-sac", "tactic:me-hoac"))
        tactic = next(item for item in json.loads((output / "tactics.json").read_bytes()) if item["id"] == "tactic:me-hoac")
        self.assertIn("hero:dai-kieu", tactic["lookup"]["inheritedFromIds"])
        ledger = json.loads((output / "ledger.json").read_bytes())
        self.assertTrue(any(item["fieldPath"] == "clientCapture.overrides.inheritTacticId" for item in ledger))
        with self.assertRaisesRegex(ValueError, "tactic is unknown"):
            self._build(overrides={"hero:dai-kieu": {"selfTacticId": "tactic:khong-co"}})
        built = next(item for item in json.loads((ROOT / "data" / "heroes-dict.json").read_bytes()) if item["id"] == "hero:ha-hau-don")
        with self.assertRaisesRegex(ValueError, "no-op"):
            self._build(overrides={"hero:ha-hau-don": {"selfTacticId": built["lookup"]["selfTacticId"]}})
        cleared = self._build(overrides={"hero:ha-hau-don": {"selfTacticId": None}})
        hero = next(item for item in json.loads((cleared / "heroes-dict.json").read_bytes()) if item["id"] == "hero:ha-hau-don")
        self.assertIsNone(hero["lookup"]["selfTacticId"])

    def test_role_tags_only_fill_empty_tags(self):
        with self.assertRaisesRegex(ValueError, "existing tag"):
            self._build(role_tags={"hero:ha-hau-don": {"roleTag": "戰", "roleTagViet": "Chiến"}})
        with self.assertRaisesRegex(ValueError, "roleTags entry is invalid"):
            self._build(role_tags={"hero:khong-co": {"roleTag": "戰", "roleTagViet": "Chiến"}})

    def test_aliases_are_appended_and_duplicates_rejected(self):
        output = self._build(aliases={"hero:ha-hau-don": ["Tên Mới Của Client"]})
        row = next(item for item in json.loads((output / "heroes-dict.json").read_bytes()) if item["id"] == "hero:ha-hau-don")
        self.assertEqual(row["aliases"][-1], "Tên Mới Của Client")
        with self.assertRaisesRegex(ValueError, "duplicates"):
            self._build(aliases={"hero:ha-hau-don": ["Hạ Hầu Đôn"]})
        with self.assertRaisesRegex(ValueError, "duplicates"):
            self._build(aliases={"hero:ha-hau-don": ["Một", "Một"]})

    def test_supplement_must_have_exact_shape(self):
        with self.assertRaisesRegex(ValueError, "entry shape"):
            self._build(heroes=[{**self._hero(), "extra": 1}])


class ClientTacticCaptureTest(unittest.TestCase):
    ALL_TROOPS = ["Kỵ binh", "Khiên binh", "Cung binh", "Thương binh", "Khí giới"]
    _baseline_effect_vi = None  # {mã: effectViet} của chiến pháp có chữ Hán từ baseline cũ, dò một lần cho cả lớp

    def setUp(self):
        self.directory = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.directory, ignore_errors=True)

    @staticmethod
    def _zh(text, effect_vi, source=None):
        return {"text": text, "viSha256": hashlib.sha256(effect_vi.encode("utf-8")).hexdigest(), "source": source or {"kind": "translation"}}

    def _baseline_zh_effects(self):
        """Mục `zhEffects` tối thiểu cho mọi chiến pháp baseline mà builder đòi (chưa có dữ liệu tra nguồn trong fixture)."""
        if ClientTacticCaptureTest._baseline_effect_vi is None:
            seen = {}

            def probe(document, tactics, origin):
                by_id = {row["id"]: row for row in tactics}
                seen.update({owner: by_id[owner]["effectViet"] for owner, kind in origin.items() if kind == "baseline" and owner in by_id})
                return []

            with mock.patch.object(build_module, "_apply_zh_effects", probe):
                self._build({}, baseline_zh=False)
            ClientTacticCaptureTest._baseline_effect_vi = seen
        return {owner: self._zh("測試", effect_vi) for owner, effect_vi in ClientTacticCaptureTest._baseline_effect_vi.items()}

    def _entry(self, **overrides):
        entry = {
            "nameVi": "Cứu trợ", "quality": "B", "type": "ACTIVE", "activationRate": 0.4,
            "troopFit": list(self.ALL_TROOPS), "targetVi": "Một quân Đồng Minh", "effectTypeVi": "Trị liệu",
            "effectVi": "Khiến một quân ta nhận trạng thái Cấp cứu, mỗi khi nhận phải sát thương có 50% xác suất hồi phục Binh Lực nhất định (tỷ lệ Trị Liệu 37.5%→75%, bị Trí Lực ảnh hưởng), duy trì 2 hiệp",
            "maxUsers": None, "exchangeConditionVi": None,
        }
        entry.update(overrides)
        return entry

    def _build(self, tactics, baseline_zh=True, **extra):
        if baseline_zh:
            retired = extra.get("retired", {})
            defaults = {owner: entry for owner, entry in self._baseline_zh_effects().items() if owner not in retired}
            extra["zhEffects"] = {**defaults, **extra.get("zhEffects", {})}
        document = {
            "schemaVersion": 1,
            "source": {"kind": "game-client", "edition": "Global", "client": "Tam Quốc Chí - Chiến Lược", "version": "24.526", "screen": "Chiến Pháp > Toàn bộ", "capturedAt": "2026-10-16"},
            "tactics": tactics,
            **extra,
        }
        path = self.directory / "client-tactics.json"
        path.write_text(json.dumps(document, ensure_ascii=False), encoding="utf-8")
        # Tướng client thật, bỏ ghi đè liên kết chiến pháp (chúng trỏ tới chiến pháp chỉ có trong file client thật).
        heroes = json.loads((ROOT / "pipeline" / "lookup-client-heroes.json").read_bytes())
        overrides = {}
        for owner, override in heroes["overrides"].items():
            kept = {key: value for key, value in override.items() if key not in ("selfTacticId", "inheritTacticId")}
            if kept:
                overrides[owner] = kept
        heroes["overrides"] = overrides
        heroes_path = self.directory / "client-heroes.json"
        heroes_path.write_text(json.dumps(heroes, ensure_ascii=False), encoding="utf-8")
        output = self.directory / "candidate"
        shutil.rmtree(output, ignore_errors=True)
        build_candidate(
            inputs=ROOT / "pipeline" / "lookup-inputs", source=ROOT / "data" / "sgsdeck",
            identity=ROOT / "pipeline" / "lookup-identity.json", translations=ROOT / "pipeline" / "lookup-translations.json",
            client_tactics=path, client_heroes=heroes_path, output=output,
        )
        return output

    def test_retired_id_merges_into_survivor_and_removed_id_disappears(self):
        output = self._build({}, retired={"tactic:nhanh-chan-tranh-dat": "tactic:si-tranh-tien-pho", "tactic:dao-vien-ket-nghia": None})
        rows = self._rows(output, "tactics.json")
        self.assertNotIn("tactic:nhanh-chan-tranh-dat", rows)
        self.assertNotIn("tactic:dao-vien-ket-nghia", rows)
        survivor = rows["tactic:si-tranh-tien-pho"]
        self.assertEqual(survivor["lookup"]["formerIds"], ["tactic:nhanh-chan-tranh-dat"])
        self.assertIn("Nhanh Chân Tranh Đất", survivor["aliases"])
        self.assertTrue(all(row["lookup"]["formerIds"] == [] for key, row in rows.items() if key != "tactic:si-tranh-tien-pho"))
        validate_candidate(output, client_heroes=self.directory / "client-heroes.json", client_tactics=self.directory / "client-tactics.json")
        with self.assertRaisesRegex(ValueError, "retired tactic is invalid"):
            self._build({}, retired={"tactic:khong-co": "tactic:si-tranh-tien-pho"})
        with self.assertRaisesRegex(ValueError, "retired tactic is invalid"):
            self._build({"tactic:nhanh-chan-tranh-dat": self._entry(nameVi="Nhanh Chân Tranh Đất")}, retired={"tactic:nhanh-chan-tranh-dat": "tactic:si-tranh-tien-pho"})

    def test_client_troop_mod_is_the_only_version_and_keeps_matching_option_ids(self):
        mod = json.loads((ROOT / "pipeline" / "lookup-client-tactics.json").read_bytes())["troopMods"]["troop-mod:dan-duong-binh"]
        before = {row["id"]: row for row in json.loads(self._build({}).joinpath("lookup-catalog.json").read_bytes())["troopMods"]}["troop-mod:dan-duong-binh"]
        output = self._build({}, troopMods={"troop-mod:dan-duong-binh": mod})
        row = {row["id"]: row for row in json.loads((output / "lookup-catalog.json").read_bytes())["troopMods"]}["troop-mod:dan-duong-binh"]
        self.assertEqual((row["nameVi"], row["effectVi"], row["revisions"]), (mod["nameVi"], mod["effectVi"], []))
        self.assertIn(before["nameVi"], row["aliasesVi"])
        self.assertEqual([item["tierVi"] for item in row["options"]], ["Đặc biệt"] * 3 + ["Sơ cấp"] * 3 + ["Trung cấp"] * 3 + ["Cao cấp"] * 3)
        old_by_name = {item["nameVi"].lower(): item["id"] for item in before["options"]}
        kept = row["options"][1]  # "Nâng Khiên" khác tên bản cũ ("Giơ khiên") -> mã mới; "Kháng Cự" trùng -> giữ mã
        self.assertEqual(row["options"][2]["id"], old_by_name["kháng cự"])
        self.assertEqual(kept["id"], "troop-option:dan-duong-binh:nang-khien")
        self.assertEqual(row["options"][0]["convertsToVi"], "Thương binh")
        # Lựa chọn giữ mã chỉ giữ tên chữ Hán nguồn; mô tả chữ Hán nguồn (bản TW) bị bỏ vì mô tả Việt nay là chữ client.
        option = row["options"][2]
        old_option = {item["id"]: item for item in before["options"]}[option["id"]]
        self.assertTrue(old_option["descriptionZh"])
        self.assertEqual((option["nameZh"], option["descriptionZh"], option["zhSource"]), (old_option["nameZh"], None, {"kind": "source"}))
        self.assertEqual((kept["nameZh"], kept["zhSource"]), (None, None))
        self.assertEqual((row["effectZh"], row["zhSource"]), (None, None))
        # Mô tả của lựa chọn giữ mã nhận bản dịch theo chữ client; tên nguồn giữ nguyên, hàng thành `translation`.
        texts = {option["id"]: {"descriptionZh": {"text": "我軍受到的兵種剋制效果減半", "viSha256": hashlib.sha256(option["descriptionVi"].encode("utf-8")).hexdigest()}}}
        output = self._build({}, troopMods={"troop-mod:dan-duong-binh": mod}, zhTexts=texts)
        translated = {item["id"]: item for row in json.loads((output / "lookup-catalog.json").read_bytes())["troopMods"] for item in row["options"]}[option["id"]]
        self.assertEqual((translated["nameZh"], translated["descriptionZh"], translated["zhSource"]), (old_option["nameZh"], "我軍受到的兵種剋制效果減半", {"kind": "translation"}))
        validate_candidate(output, client_heroes=self.directory / "client-heroes.json", client_tactics=self.directory / "client-tactics.json")
        with self.assertRaisesRegex(ValueError, "client troop mod is invalid"):
            self._build({}, troopMods={"troop-mod:dan-duong-binh": {**mod, "options": mod["options"][:11]}})

    def test_client_catalog_renames_keep_old_name_and_only_declared_fields_change(self):
        output = self._build(
            {},
            equipment={"equipment:tu-luan-xa": {"nameVi": "Xe Bốn Bánh"}},
            specials={"equipment-special:te-phong": {"nameVi": "Xé Gió", "descriptionVi": "Tăng 8 điểm Võ Lực"}},
            buildings={"building:thai-thach-xu": {"nameVi": "Điểm nhặt đá"}, "building:my-binh-dinh": {"nameVi": "Trại Lính Khiên", "summaryVi": "Giảm sát thương Lính Khiên phải nhận"}},
            advisors={"advisor:thong-quan-tai-chien": {"nameVi": "Thống Quân Tái Chiến", "tacticPoints": 12, "heroIds": ["hero:truong-luong"]}},
            newAdvisors={"advisor:hieu-lenh-thien-ha": {"nameVi": "Hiệu Lệnh Thiên Hạ", "elementVi": "Hỏa", "tacticPoints": 8, "effectVi": "Thống Lĩnh: Công Thành", "heroIds": ["hero:tao-thao"]}},
        )
        catalog = json.loads((output / "lookup-catalog.json").read_bytes())
        rows = {row["id"]: row for group in ("equipment", "specials", "buildings", "advisors") for row in catalog[group]}
        heroes = self._rows(output, "heroes-dict.json")
        # Quân sư mới: không có chữ Hán/usageVi; tướng mang trỏ ngược tới đúng mã (cả mã cũ được nối tướng lần đầu).
        self.assertEqual((rows["advisor:hieu-lenh-thien-ha"]["aliasesZh"], rows["advisor:hieu-lenh-thien-ha"]["missingFields"]), ([], ["usageVi"]))
        self.assertEqual(heroes["hero:tao-thao"]["lookup"]["advisorId"], "advisor:hieu-lenh-thien-ha")
        self.assertEqual((rows["advisor:thong-quan-tai-chien"]["heroIds"], heroes["hero:truong-luong"]["lookup"]["advisorId"]), (["hero:truong-luong"], "advisor:thong-quan-tai-chien"))
        self.assertEqual((rows["equipment:tu-luan-xa"]["nameVi"], rows["equipment:tu-luan-xa"]["aliasesVi"]), ("Xe Bốn Bánh", ["Tứ Luân Xa"]))
        self.assertEqual(rows["equipment-special:te-phong"]["descriptionVi"], "Tăng 8 điểm Võ Lực")
        # Chỉ ghi đè trường được khai: summaryVi cũ (có mốc Lv10/Lv20) giữ nguyên khi client chỉ đổi tên.
        self.assertIn("Lv10", rows["building:thai-thach-xu"]["summaryVi"])
        self.assertEqual((rows["building:my-binh-dinh"]["nameVi"], rows["building:my-binh-dinh"]["aliasesVi"]), ("Trại Lính Khiên", ["My Binh Dinh"]))
        validate_candidate(output, client_heroes=self.directory / "client-heroes.json", client_tactics=self.directory / "client-tactics.json")
        for bad in (
            {"equipment": {"equipment:khong-co": {"nameVi": "X"}}},
            {"buildings": {"building:thai-thach-xu": {"summaryVi": "thiếu tên"}}},
            {"equipment": {"equipment:tu-luan-xa": {"nameVi": "Xe Bốn Bánh", "slotVi": "Bảo vật"}}},
            {"advisors": {"advisor:thong-quan-tai-chien": {"nameVi": "Thống Quân Tái Chiến", "tacticPoints": "12"}}},
            {"newAdvisors": {"advisor:an-nhan-doat-quyen": {"nameVi": "Trùng", "elementVi": "Hỏa", "tacticPoints": 1, "effectVi": "x", "heroIds": ["hero:tu-ma-y"]}}},
            {"advisors": {"advisor:thong-quan-tai-chien": {"nameVi": "Thống Quân Tái Chiến", "heroIds": ["hero:tu-ma-y"]}},
             "newAdvisors": {"advisor:moi": {"nameVi": "Mới", "elementVi": "Hỏa", "tacticPoints": 1, "effectVi": "x", "heroIds": ["hero:tu-ma-y"]}}},
        ):
            with self.subTest(bad=bad), self.assertRaisesRegex(ValueError, "client (equipment|buildings) entry is invalid|client catalog value is invalid|client new advisor is invalid|client advisor hero link is invalid"):
                self._build({}, **bad)

    def test_client_text_override_drops_the_paired_source_chinese(self):
        # Chữ Hán nguồn là bản TW: khi client thay chữ Việt, chữ Hán đi kèm bị bỏ để hai bản không lệch số liệu.
        before = json.loads(self._build({}).joinpath("lookup-catalog.json").read_bytes())
        advisor = next(row for row in before["advisors"] if row["effectZh"] and row["usageZh"])
        building = next(row for row in before["buildings"] if row["summaryZh"])
        output = self._build(
            {},
            advisors={advisor["id"]: {"nameVi": advisor["nameVi"], "effectVi": "Động Viên: chữ client"}},
            buildings={building["id"]: {"nameVi": building["nameVi"], "summaryVi": "Tóm tắt client"}},
        )
        catalog = json.loads((output / "lookup-catalog.json").read_bytes())
        advisor_after = {row["id"]: row for row in catalog["advisors"]}[advisor["id"]]
        building_after = {row["id"]: row for row in catalog["buildings"]}[building["id"]]
        self.assertEqual((advisor_after["effectZh"], advisor_after["usageZh"], advisor_after["zhSource"]), (None, advisor["usageZh"], None))
        self.assertEqual((building_after["summaryZh"], building_after["zhSource"]), (None, None))
        self.assertEqual([level["effectZh"] for level in building_after["levels"]], [level["effectZh"] for level in building["levels"]])
        validate_candidate(output, client_heroes=self.directory / "client-heroes.json", client_tactics=self.directory / "client-tactics.json")

    def test_source_chinese_with_an_editor_note_is_not_published(self):
        self.assertIsNone(build_module._source_zh("發動突擊戰法後，有25%機率（遊戲畫面此處文字被截斷，待補全）"))
        self.assertIsNone(build_module._source_zh("待補充"))
        self.assertEqual(build_module._source_zh(" 我軍全體獲得5%減傷 "), "我軍全體獲得5%減傷")

    def test_zh_texts_fill_only_missing_chinese_and_are_flagged_as_translation(self):
        def sha(text):
            return hashlib.sha256(text.encode("utf-8")).hexdigest()

        new = {"advisor:hieu-lenh-thien-ha": {"nameVi": "Hiệu Lệnh Thiên Hạ", "elementVi": "Hỏa", "tacticPoints": 8, "effectVi": "Thống Lĩnh: Công Thành", "heroIds": ["hero:tao-thao"]}}
        ref = "https://sanzhan.slgsim.com/zh-hans/advisors/%E5%8F%B7%E4%BB%A4%E5%A4%A9%E4%B8%8B-1/"
        texts = {"advisor:hieu-lenh-thien-ha": {
            "nameZh": {"text": "号令天下", "viSha256": sha("Hiệu Lệnh Thiên Hạ"), "ref": ref},
            "effectZh": {"text": "統領：攻城", "viSha256": sha("Thống Lĩnh: Công Thành")},
        }}
        output = self._build({}, newAdvisors=new, zhTexts=texts)
        rows = {row["id"]: row for row in json.loads((output / "lookup-catalog.json").read_bytes())["advisors"]}
        translated, source = rows["advisor:hieu-lenh-thien-ha"], rows["advisor:an-nhan-doat-quyen"]
        self.assertEqual((translated["nameZh"], translated["effectZh"], translated["zhSource"]), ("号令天下", "統領：攻城", {"kind": "translation"}))
        # `ref` chỉ ở đầu vào/ledger: tên có nguồn ghi bằng chứng URL, hiệu ứng ghi là bản dịch.
        ledger = {row["fieldPath"]: row for row in json.loads((output / "ledger.json").read_bytes()) if row["entityId"] == "advisor:hieu-lenh-thien-ha" and row["fieldPath"].startswith("zhTexts.")}
        self.assertEqual((ledger["zhTexts.nameZh"]["chosenInput"], ledger["zhTexts.nameZh"]["reviewEvidence"]), ("zh-text-sourced", [ref]))
        self.assertEqual(ledger["zhTexts.effectZh"]["chosenInput"], "zh-text-translation")
        self.assertNotIn("slgsim", (output / "lookup-catalog.json").read_text(encoding="utf-8"))
        self.assertEqual(source["zhSource"], {"kind": "source"})
        self.assertTrue(source["effectZh"])
        validate_candidate(output, client_heroes=self.directory / "client-heroes.json", client_tactics=self.directory / "client-tactics.json")
        for bad, message in (
            ({"advisor:hieu-lenh-thien-ha": {"nameZh": {"text": "號令天下", "viSha256": sha("Tên cũ")}}}, "stale against the Vietnamese text"),
            ({"advisor:an-nhan-doat-quyen": {"effectZh": {"text": "動員", "viSha256": sha(source["effectVi"])}}}, "overrides a source Chinese text"),
            ({"advisor:hieu-lenh-thien-ha": {"usageZh": {"text": "用法", "viSha256": sha("x")}}}, "entry is invalid"),
            ({"advisor:hieu-lenh-thien-ha": {"nameZh": {"text": "Hieu Lenh", "viSha256": sha("Hiệu Lệnh Thiên Hạ")}}}, "has no Chinese text"),
            ({"advisor:hieu-lenh-thien-ha": {"nameZh": {"text": "号令天下", "viSha256": sha("Hiệu Lệnh Thiên Hạ"), "ref": "https://example.com/x"}}}, "value is invalid"),
            *[({"advisor:hieu-lenh-thien-ha": {"nameZh": {"text": "号令天下", "viSha256": sha("Hiệu Lệnh Thiên Hạ"), "ref": bad_ref}}}, "value is invalid")
              for bad_ref in ("http://sanzhan.slgsim.com/x", "https://sanzhan.slgsim.com:8443/x", "https://user@sanzhan.slgsim.com/x", "https://sanzhan.slgsim.com/", "https://sanzhan.slgsim.com/a b")],
        ):
            with self.subTest(message=message), self.assertRaisesRegex(ValueError, message):
                self._build({}, newAdvisors=new, zhTexts=bad)

    def test_retired_hero_and_removed_tactics_leave_no_links(self):
        output = self._build({}, retired={"tactic:tuyet-ke-chiet-muu": None, "tactic:duy-noi-thien-quyen": None})
        heroes = self._rows(output, "heroes-dict.json")
        tactics = self._rows(output, "tactics.json")
        self.assertNotIn("hero:ha-thi", heroes)  # retired trong lookup-client-heroes.json
        self.assertNotIn("tactic:tuyet-ke-chiet-muu", tactics)
        self.assertFalse([row["id"] for row in tactics.values() if "hero:ha-thi" in row["lookup"]["inheritedFromIds"]])

    def test_tactic_notes_add_alias_and_season_condition(self):
        note = {"aliases": ["Thác-Cắt Xương Trị Độc"], "conditions": [{"kind": "season", "textVi": "Bán ở Thương nhân › Mùa giải."}]}
        row = self._rows(self._build({}, tacticNotes={"tactic:cat-xuong-tri-doc": note}), "tactics.json")["tactic:cat-xuong-tri-doc"]
        self.assertIn("Thác-Cắt Xương Trị Độc", row["aliases"])
        self.assertEqual(row["lookup"]["conditions"][-1], note["conditions"][0])
        with self.assertRaisesRegex(ValueError, "client tactic note is invalid"):
            self._build({}, tacticNotes={"tactic:khong-co": note})

    def _ho_ve(self):
        return self._entry(nameVi="Hộ Vệ", effectVi="Gánh Vác 10%→20% sát thương cho Chủ tướng quân Đồng Minh, duy trì 2 hiệp")

    def test_new_client_tactic_is_appended_with_chinese_text(self):
        entry = self._ho_ve()
        season = [{"kind": "season", "textVi": "Chiến pháp bổ sung của mùa Binh Diễn Xuân Thu."}]
        zh = self._zh("為我軍主將分擔 10%→20% 傷害，持續 2 回合", entry["effectVi"])
        output = self._build({"tactic:ho-ve": entry}, newTactics={"tactic:ho-ve": {"nameZh": "護衛", "conditions": season, "aliases": ["Hộ Vệ Chủ Tướng"]}}, zhEffects={"tactic:ho-ve": zh})
        row = self._rows(output, "tactics.json")["tactic:ho-ve"]
        self.assertEqual((row["viet"], row["chinese"], row["quality"], row["pending"]), ("Hộ Vệ", "護衛", "B", False))
        self.assertEqual((row["effect"], row["lookup"]["effectZhSource"]), (zh["text"], {"kind": "translation"}))
        self.assertEqual(row["lookup"]["conditions"], season)
        self.assertEqual(row["aliases"], ["Hộ Vệ Chủ Tướng"])
        self.assertEqual(row["effectViet"], entry["effectVi"])
        validate_candidate(output, client_heroes=self.directory / "client-heroes.json", client_tactics=self.directory / "client-tactics.json")
        with self.assertRaisesRegex(ValueError, "condition shape is invalid"):
            self._build({"tactic:ho-ve": entry}, newTactics={"tactic:ho-ve": {"nameZh": "護衛", "conditions": [{"kind": "mùa", "textVi": "x"}]}}, zhEffects={"tactic:ho-ve": zh})
        with self.assertRaisesRegex(ValueError, "new tactic is invalid"):
            self._build({"tactic:ho-ve-x": entry}, newTactics={"tactic:ho-ve-x": {"nameZh": "護衛"}})

    def test_every_zh_effect_kind_publishes_only_its_kind(self):
        entry = self._ho_ve()
        for source in (
            {"kind": "source", "ref": "https://sanzhan.slgsim.com/zhanfa/123"},
            {"kind": "source", "ref": "https://forum.gamer.com.tw/C.php?bsn=26742&snA=1"},
            {"kind": "capture", "note": "client TW 訓兵場 2026-10-17"},
            {"kind": "translation"},
        ):
            with self.subTest(source=source):
                output = self._build({"tactic:ho-ve": entry}, newTactics={"tactic:ho-ve": {"nameZh": "護衛"}}, zhEffects={"tactic:ho-ve": self._zh("分擔傷害", entry["effectVi"], source)})
                self.assertEqual(self._rows(output, "tactics.json")["tactic:ho-ve"]["lookup"]["effectZhSource"], {"kind": source["kind"]})
                raw = (output / "tactics.json").read_bytes()
                for private in (b'"ref"', b'"note"', b"viSha256", b"slgsim", b"gamer.com.tw", "訓兵場".encode("utf-8")):
                    self.assertNotIn(private, raw)
                ledger = [row for row in json.loads((output / "ledger.json").read_bytes()) if row["fieldPath"] == "clientCapture.zhEffects" and row["entityId"] == "tactic:ho-ve"]
                self.assertEqual([row["chosenInput"] for row in ledger], [f"zh-effect-{source['kind']}"])

    def test_invalid_zh_effects_are_rejected(self):
        entry = self._ho_ve()
        new = {"tactic:ho-ve": {"nameZh": "護衛"}}
        good = self._zh("分擔傷害", entry["effectVi"])
        for zh_effects, error in (
            ({"tactic:ho-ve": {**good, "viSha256": "0" * 64}}, r"stale zhEffects \(effectViet changed\): tactic:ho-ve"),
            ({"tactic:ho-ve": {**good, "viSha256": "ABC"}}, "zhEffects entry is invalid"),
            ({"tactic:ho-ve": {**good, "extra": 1}}, "zhEffects entry is invalid"),
            ({"tactic:ho-ve": {**good, "text": "分擔\u200b傷害"}}, "zhEffects.text is invalid"),
            ({"tactic:ho-ve": {**good, "text": "分擔<br>傷害"}}, "zhEffects.text is invalid"),
            ({"tactic:ho-ve": {**good, "text": "分擔&nbsp;傷害"}}, "zhEffects.text is invalid"),
            ({"tactic:ho-ve": {**good, "text": "效" * 1501}}, "zhEffects.text is invalid"),
            ({"tactic:ho-ve": {**good, "text": "待補充"}}, "zhEffects.text is invalid"),
            ({"tactic:ho-ve": {**good, "source": {"kind": "source", "ref": "https://u@sanzhan.slgsim.com/x"}}}, "source.ref is invalid"),
            ({"tactic:ho-ve": {**good, "source": {"kind": "source", "ref": "https://sanzhan.slgsim.com/a b"}}}, "source.ref is invalid"),
            ({"tactic:ho-ve": {**good, "source": {"kind": "source", "ref": "https://example.com/x"}}}, "source.ref is invalid"),
            ({"tactic:ho-ve": {**good, "source": {"kind": "source", "ref": "http://sanzhan.slgsim.com/x"}}}, "source.ref is invalid"),
            ({"tactic:ho-ve": {**good, "source": {"kind": "source", "ref": "https://sanzhan.slgsim.com:8443/x"}}}, "source.ref is invalid"),
            ({"tactic:ho-ve": {**good, "source": {"kind": "capture", "note": "https://sanzhan.slgsim.com/x"}}}, "source.note is invalid"),
            ({"tactic:ho-ve": {**good, "source": {"kind": "translation", "ref": "https://sanzhan.slgsim.com/x"}}}, "zhEffects.source is invalid"),
            ({"tactic:ho-ve": {**good, "source": {"kind": "sgsdeck"}}}, "zhEffects.source is invalid"),
            ({"tactic:ho-ve": good, "tactic:vien-cuu": self._zh("x", "y")}, "SGSDeck now provides the Chinese effect; remove the zhEffects entry: tactic:vien-cuu"),
            ({"tactic:ho-ve": good, "tactic:khong-co": self._zh("x", "y")}, "zhEffects owner is not a tactic in the catalog: tactic:khong-co"),
            ({}, "non-SGSDeck zh effect without zhEffects: .*tactic:ho-ve"),
        ):
            with self.subTest(error=error), self.assertRaisesRegex(ValueError, error):
                self._build({"tactic:ho-ve": entry}, newTactics=new, zhEffects=zh_effects)
        with self.assertRaisesRegex(ValueError, "new tactic is invalid"):
            self._build({"tactic:ho-ve": entry}, newTactics={"tactic:ho-ve": {"nameZh": "護衛", "effectZh": "分擔傷害"}}, zhEffects={"tactic:ho-ve": good})

    def test_baseline_chinese_effect_needs_a_declared_zh_effect(self):
        # Ghim cứng các chiến pháp xuất bản chữ Hán của baseline cũ (SGSDeck `待補充` hoặc không có bản ghi). Fixture này
        # không gộp mã nên còn `khac-tuan-hoa-nhat` và `thuong-lam-nhi-thuc`; file client thật gộp hai mã đó (`retired`),
        # nên dữ liệu thật chỉ còn ba mục `zhEffects` baseline.
        baseline = self._baseline_zh_effects()
        self.assertEqual(sorted(baseline), [
            "tactic:khac-tuan-hoa-nhat", "tactic:luc-luc-thuong-quoc", "tactic:nhanh-tri-dong-nao",
            "tactic:thuong-lam-nhi-thuc", "tactic:vo-song-thuong-tuong",
        ])
        with self.assertRaisesRegex(ValueError, "non-SGSDeck zh effect without zhEffects: " + ", ".join(sorted(baseline))):
            self._build({}, baseline_zh=False)
        with self.assertRaisesRegex(ValueError, "zhEffects owner is retired: tactic:nhanh-tri-dong-nao"):
            self._build({}, retired={"tactic:nhanh-tri-dong-nao": None}, zhEffects=baseline)
        owner = sorted(baseline)[0]
        row = self._rows(self._build({}), "tactics.json")[owner]
        self.assertEqual((row["effect"], row["lookup"]["effectZhSource"], row["pending"]), ("測試", {"kind": "translation"}, False))

    @staticmethod
    def _rows(output, name):
        return {row["id"]: row for row in json.loads((output / name).read_bytes())}

    def test_client_values_replace_built_values_with_ledger_evidence(self):
        output = self._build({"tactic:vien-cuu": self._entry(maxUsers=1, exchangeConditionVi="Sự kiện Thử — Lưu Bị (Thục): cần 1 thẻ")})
        row = self._rows(output, "tactics.json")["tactic:vien-cuu"]
        self.assertEqual((row["id"], row["viet"], row["hanViet"]), ("tactic:vien-cuu", "Cứu trợ", "Viện Cứu"))
        self.assertNotIn("Cứu trợ", row["aliases"])
        self.assertEqual((row["targetViet"], row["troopFit"], row["effectViet"].startswith("Khiến một quân ta")), ("Một quân Đồng Minh", self.ALL_TROOPS, True))
        self.assertEqual((row["lookup"]["activationRate"], row["lookup"]["effectTypeVi"], row["lookup"]["maxUsers"]), (0.4, "Trị liệu", 1))
        self.assertEqual(row["lookup"]["exchangeConditionVi"], "Sự kiện Thử — Lưu Bị (Thục): cần 1 thẻ")
        validate_candidate(output, client_heroes=self.directory / "client-heroes.json", client_tactics=self.directory / "client-tactics.json")
        ledger = [item for item in json.loads((output / "ledger.json").read_bytes()) if item["sourceRecordId"] == "client-tactics:vien-cuu"]
        self.assertIn("clientCapture.effectVi", {item["fieldPath"] for item in ledger})
        self.assertTrue(all(item["chosenInput"] == "client-capture" for item in ledger))

    def test_current_revision_keeps_its_date_only_when_numbers_match(self):
        same = "Chiến đấu 3 hiệp đầu, khiến sát thương của Tập thể quân ta (2 người) gây ra giảm 12%→24%, sát thương phải chịu giảm 12%→24% (bị Thống Soái ảnh hưởng), khi chiến đấu hiệp thứ 4, hồi phục Binh Lực (tỷ lệ Trị Liệu 63%→126%, bị Trí Lực ảnh hưởng)"
        entry = self._entry(nameVi="An Ủi Quân Dân", quality="S", type="ACTIVE", activationRate=1, targetVi="Tập thể quân ta (2 người)", effectTypeVi="Tăng ích", effectVi=same)
        revisions = self._rows(self._build({"tactic:an-ui-quan-dan": entry}), "tactics.json")["tactic:an-ui-quan-dan"]["lookup"]["revisions"]
        self.assertEqual([(item["effectiveDate"], item["isCurrent"]) for item in revisions], [("2021-06-09", True), (None, False)])
        self.assertEqual(revisions[0]["textVi"], same)
        changed = same.replace("12%→24%", "15%→30%")
        revisions = self._rows(self._build({"tactic:an-ui-quan-dan": {**entry, "effectVi": changed}}), "tactics.json")["tactic:an-ui-quan-dan"]["lookup"]["revisions"]
        self.assertEqual([(item["labelVi"], item["effectiveDate"], item["isCurrent"]) for item in revisions], [("Bản hiện hành", None, True), ("Bản 2021-06-09", "2021-06-09", False), ("Bản gốc", None, False)])
        self.assertEqual(revisions[0]["textVi"], changed)

    def test_client_tactic_name_links_client_hero_innate_tactic(self):
        self.assertIsNone(self._rows(self._build({}), "heroes-dict.json")["hero:dao-khiem"]["lookup"]["selfTacticId"])
        heroes = self._rows(self._build({"tactic:vien-cuu": self._entry()}), "heroes-dict.json")
        self.assertEqual(heroes["hero:dao-khiem"]["lookup"]["selfTacticId"], "tactic:vien-cuu")

    def test_invalid_entries_are_rejected(self):
        for tactics, error in (
            ({"tactic:khong-co": self._entry()}, "entry is invalid"),
            ({"tactic:vien-cuu": {**self._entry(), "extra": 1}}, "entry is invalid"),
            ({"tactic:vien-cuu": self._entry(troopFit=["Khiên binh", "Kỵ binh"])}, "value is invalid"),
            ({"tactic:vien-cuu": self._entry(troopFit=["Bộ binh"])}, "value is invalid"),
            ({"tactic:vien-cuu": self._entry(activationRate=40)}, "value is invalid"),
            ({"tactic:vien-cuu": self._entry(type="Chủ động")}, "value is invalid"),
            ({"tactic:vien-cuu": self._entry(effectVi=" ")}, "effectVi is invalid"),
        ):
            with self.subTest(error=error, tactics=tactics), self.assertRaisesRegex(ValueError, error):
                self._build(tactics)


class ZhEffectsDataTest(unittest.TestCase):
    def test_every_level_range_of_the_vietnamese_effect_is_in_the_chinese_text(self):
        # Kể cả "Xác suất phát động a%→b%": bản zh chỉ hiện mức tối đa ở ô tỉ lệ, nên dải cấp phải nằm trong chữ Hán.
        document = json.loads((ROOT / "pipeline" / "lookup-client-tactics.json").read_bytes())
        level_range = re.compile(r"\d+(?:\.\d+)?%?\s*→\s*\d+(?:\.\d+)?%?")
        compact = lambda text: re.sub(r"\s+", "", text)
        for owner, entry in document["zhEffects"].items():
            text = compact(entry["text"])
            missing = [compact(found) for found in level_range.findall(document["tactics"][owner]["effectVi"]) if compact(found) not in text]
            self.assertEqual(missing, [], owner)


if __name__ == "__main__":
    unittest.main()
