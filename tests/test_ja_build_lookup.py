"""TDD pipeline/build_lookup_ja.py: tên Nhật có trạng thái, kiểm số liệu bản dịch, mồ côi, deterministic và dữ liệu thật."""

import contextlib
import io
import json
import os
import shutil
import tempfile
import unittest
from pathlib import Path

from pipeline import build_lookup_ja as bj

_ROOT = Path(__file__).resolve().parent.parent


def _corpus():
    hero = lambda hid, zh, **lk: {"id": hid, "chinese": zh, "roleTag": None, "lookup": {"usageZh": None, "conditions": [], "cardPacks": [], **lk}}
    return {
        "heroes": [hero("hero:phap-chinh", "法正"), hero("hero:sp-phap-chinh", "SP 法正"), hero("hero:lu-bo", "呂布", usageZh="兵刃傷害提高 5%"),
                   hero("hero:sp-tuan-uc", "SP 荀彧"), hero("hero:tuan-uc", "荀彧"), hero("hero:co-dai-kieu", "無雙大喬")],
        "tactics": [{"id": "tactic:a", "chinese": "橫掃千軍", "effect": "傷害率 50%→100%", "target": "敵軍單體", "lookup": {"effectZhSource": {"kind": "translation"}}}],
        "books": [{"id": "book:b", "chinese": "兵行诡道", "sourceNames": ["兵行詭道"], "effect": "降低 3 回合"}],
        "catalog": {"equipment": [{"id": "equipment:e", "aliasesZh": ["青龍偃月刀"]}], "specials": [], "advisors": [], "buildings": [], "troopMods": []},
        "manifest": {"generationId": "lookup:" + "a" * 64},
    }


class NameTests(unittest.TestCase):
    def test_collect_names_prefers_source_name_for_books(self):
        names = bj.collect_names(_corpus())
        self.assertEqual(names["book:b"], "兵行詭道")
        self.assertEqual(names["equipment:e"], "青龍偃月刀")

    def test_collect_names_fails_without_chinese_name(self):
        corpus = _corpus()
        corpus["tactics"][0]["chinese"] = ""
        with self.assertRaises(bj.LookupJaError):
            bj.collect_names(corpus)

    def test_import_observed_ranking_prefix_and_low(self):
        names = bj.collect_names(_corpus())
        rows = [
            {"id": "hero:lu-bo", "ja": "呂布X", "confidence": "medium", "sourceUrl": "https://x"},
            {"id": "hero:lu-bo", "ja": "呂布", "confidence": "high", "sourceUrl": "https://y"},
            {"id": "tactic:a", "ja": "千軍一掃", "confidence": "medium", "sourceUrl": "https://z"},
            {"id": "hero:tuan-uc", "ja": "ダメ", "confidence": "low", "sourceUrl": "https://z"},
            {"id": None, "baseId": "tactic:a", "ja": "転・千軍一掃", "confidence": "high", "sourceUrl": "https://z"},
            {"id": None, "ja": "九変", "confidence": "medium", "sourceUrl": "https://z"},
        ]
        result = bj.import_observed(rows, names, "t.json")
        self.assertEqual(result["names"]["hero:lu-bo"]["nameJa"], "呂布")
        self.assertEqual(result["names"]["hero:lu-bo"]["alts"], ["呂布X"])
        self.assertNotIn("hero:tuan-uc", result["names"])
        self.assertEqual(result["skipped"]["low"], ["hero:tuan-uc"])
        self.assertEqual(result["prefixedTactics"][0]["prefix"], "転")
        self.assertNotIn("alts", result["names"]["tactic:a"])
        self.assertEqual(result["skipped"]["noId"], 1)

    def test_import_observed_rejects_row_without_source(self):
        with self.assertRaises(bj.LookupJaError):
            bj.import_observed([{"id": "hero:lu-bo", "ja": "呂布", "confidence": "high"}], bj.collect_names(_corpus()), "t")

    def test_resolve_names_statuses_and_variants(self):
        corpus = _corpus()
        names = bj.collect_names(corpus)
        overrides = {"schemaVersion": 1, "names": {
            "hero:phap-chinh": {"confidence": "high", "nameJa": "法正", "sourceUrl": "https://x"},
            "tactic:a": {"confidence": "medium", "nameJa": "千軍一掃", "sourceUrl": "https://x"},
            "hero:tuan-uc": {"confidence": "high", "nameJa": "荀彧", "sourceUrl": "https://x"}}}
        bj.validate_overrides(overrides, names)
        resolved = bj.resolve_names(corpus, names, overrides)
        self.assertEqual(resolved["hero:phap-chinh"]["nameStatus"], "verified")
        self.assertEqual(resolved["tactic:a"], {"name": "千軍一掃", "nameStatus": "derived", "nameOriginal": "橫掃千軍", "nameOriginalLang": "zh-Hant"})
        self.assertEqual(resolved["hero:lu-bo"]["nameOriginalLang"], "zh-Hant")
        self.assertEqual(resolved["hero:phap-chinh"]["nameOriginalLang"], "zh")
        # SP chưa có hàng quan sát: tiền tố viết liền + tên tướng gốc, trạng thái theo tướng gốc
        self.assertEqual((resolved["hero:sp-phap-chinh"]["name"], resolved["hero:sp-phap-chinh"]["nameStatus"]), ("SP法正", "verified"))
        self.assertEqual(resolved["hero:sp-tuan-uc"]["name"], "SP荀彧")
        # không có quan sát: chuyển mặt chữ, derived
        self.assertEqual((resolved["hero:lu-bo"]["name"], resolved["hero:lu-bo"]["nameStatus"]), ("呂布", "derived"))
        self.assertEqual(resolved["hero:co-dai-kieu"]["name"], "無双大喬")
        self.assertEqual(resolved["book:b"]["name"], "兵行詭道")
        self.assertEqual(resolved["equipment:e"]["name"], "青龍偃月刀")

    def test_validate_overrides_rejects_unknown_id_and_missing_source(self):
        names = bj.collect_names(_corpus())
        with self.assertRaises(bj.LookupJaError) as raised:
            bj.validate_overrides({"schemaVersion": 1, "names": {"hero:zzz": {"confidence": "high", "nameJa": "x漢", "sourceUrl": "u"}}}, names)
        # ID không còn trong generation Tra cứu: thông báo nêu cách gỡ (xóa dòng override hoặc dựng lại từ bảng quan sát).
        self.assertIn('names["hero:zzz"]', str(raised.exception))
        self.assertIn("--import-observed", str(raised.exception))
        with self.assertRaises(bj.LookupJaError) as raised:
            bj.validate_overrides({"schemaVersion": 1, "names": {}, "prefixedTactics": [{"baseId": "tactic:zzz", "name": "転・x", "prefix": "転"}]}, names)
        self.assertIn("prefixedTactics", str(raised.exception))
        self.assertIn("tactic:zzz", str(raised.exception))
        with self.assertRaises(bj.LookupJaError):
            bj.validate_overrides({"schemaVersion": 1, "names": {"hero:lu-bo": {"confidence": "high", "nameJa": "呂布"}}}, names)


class TranslationTests(unittest.TestCase):
    def test_collect_texts_and_flags(self):
        texts = bj.collect_texts(_corpus())
        self.assertEqual(texts["hero:lu-bo"]["usage"], ("兵刃傷害提高 5%", False))
        self.assertEqual(texts["tactic:a"]["effect"], ("傷害率 50%→100%", True))
        self.assertEqual(texts["book:b"]["effect"][1], False)

    def test_editorial_notes_are_not_published(self):
        corpus = _corpus()
        corpus["books"][0]["effect"] = "待補充 效果"
        self.assertNotIn("book:b", bj.collect_texts(corpus))

    def test_number_check(self):
        src = "傷害率 50%→100%，持續 2 回合"
        self.assertIsNone(bj.translation_problem(src, "ダメージ率 50%→100%、2ターン持続"))
        self.assertIsNone(bj.translation_problem(src, "ダメージ率 50％→100％、2ターン持続"))
        for bad in ("ダメージ率 50%→10%、2ターン持続", "ダメージ率 50%、100%、2ターン持続", "ダメージ率 50%→100%、1ターン持続",
                    "ダメージ率 50%→100%、2ターン持続、3回", "ダメージ率 100%→50%、2ターン持続"):
            with self.subTest(bad):
                self.assertIn("số liệu lệch", bj.translation_problem(src, bad))

    def test_rejects_html_empty_and_untreated_variants(self):
        self.assertIsNotNone(bj.translation_problem("A 1", ""))
        self.assertIsNotNone(bj.translation_problem("A 1", "<b>1ターン</b>"))
        self.assertIsNotNone(bj.translation_problem("A 1", "&amp; 1ターン"))
        self.assertIsNotNone(bj.translation_problem("A 1", "戰闘 1ターン"))
        self.assertIsNotNone(bj.translation_problem("A 1", " 1ターン"))

    def test_ingest_drops_bad_items_and_keeps_good(self):
        sources = {bj.text_hash("兵力 5%"): "兵力 5%", bj.text_hash("兵力 6%"): "兵力 6%"}
        batch = [{"h": bj.text_hash("兵力 5%"), "ja": "兵力 5%"}, {"h": bj.text_hash("兵力 6%"), "ja": "兵力 7%"}, {"h": "dead", "ja": "x"}]
        merged, rejected = bj.ingest_batch(batch, sources, {}, "m", "2026-11-17")
        self.assertEqual(list(merged), [bj.text_hash("兵力 5%")])
        self.assertEqual(len(rejected), 2)

    def test_ingest_normalizes_to_japanese_glyphs(self):
        sources = {bj.text_hash("戰鬥 1"): "戰鬥 1"}
        merged, rejected = bj.ingest_batch([{"h": bj.text_hash("戰鬥 1"), "ja": "戰闘 1"}], sources, {}, "m", "2026-11-17")
        self.assertEqual(rejected, [])
        self.assertEqual(merged[bj.text_hash("戰鬥 1")]["ja"], "戦闘 1")

    def test_validate_translations_fails_on_orphan_and_bad_sha(self):
        sources = {bj.text_hash("兵力 5%"): "兵力 5%"}
        good = {bj.text_hash("兵力 5%"): {"src": "兵力 5%", "ja": "兵力 5%"}}
        bj.validate_translations(good, sources)
        with self.assertRaises(bj.LookupJaError):
            bj.validate_translations({**good, "f" * 64: {"src": "古い", "ja": "x"}}, sources)
        with self.assertRaises(bj.LookupJaError):
            bj.validate_translations({bj.text_hash("兵力 5%"): {"src": "兵力 9%", "ja": "兵力 9%"}}, sources)
        with self.assertRaises(bj.LookupJaError):
            bj.validate_translations({bj.text_hash("兵力 5%"): {"src": "兵力 5%", "ja": "兵力 6%"}}, sources)

    def test_prune_orphans_drops_only_items_without_current_source(self):
        sources = {bj.text_hash("兵力 5%"): "兵力 5%"}
        good = {bj.text_hash("兵力 5%"): {"src": "兵力 5%", "ja": "兵力 5%"}}
        orphan = {"f" * 64: {"src": "古い", "ja": "x"}}
        kept, removed = bj.prune_orphans({**good, **orphan}, sources)
        self.assertEqual(kept, good)
        self.assertEqual(removed, ["f" * 64])
        bj.validate_translations(kept, sources)
        self.assertEqual(bj.prune_orphans(good, sources), (good, []))


class RealDataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.payload = json.loads((_ROOT / "data" / "lookup-ja.json").read_text(encoding="utf-8"))
        cls.corpus = bj.load_corpus()

    def test_every_lookup_id_has_japanese_name_and_status(self):
        names = bj.collect_names(self.corpus)
        self.assertEqual(set(self.payload["entries"]), set(names))
        for entry_id, entry in self.payload["entries"].items():
            with self.subTest(entry_id):
                self.assertTrue(entry["name"].strip())
                self.assertIn(entry["nameStatus"], ("verified", "derived"))
                self.assertEqual(entry["nameOriginal"], names[entry_id])

    def test_public_payload_has_no_provenance(self):
        text = (_ROOT / "data" / "lookup-ja.json").read_text(encoding="utf-8")
        for forbidden in ("sourceUrl", "http", "model", "translatedAt", "confidence"):
            self.assertNotIn(forbidden, text)

    def test_generation_and_sources_match_current_files(self):
        manifest = json.loads((_ROOT / "data" / "lookup-manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(self.payload["lookupGenerationId"], manifest["generationId"])
        for rel, digest in self.payload["sources"].items():
            self.assertEqual(bj.sha256_hex((_ROOT / rel).read_bytes()), digest, rel)

    def test_translated_texts_keep_numbers_and_are_deterministic(self):
        texts = bj.collect_texts(self.corpus)
        for entry_id, fields in texts.items():
            for key, (src, _) in fields.items():
                ja = self.payload["entries"][entry_id]["texts"].get(key)
                if ja is not None:
                    self.assertEqual(bj.number_tokens(ja), bj.number_tokens(src), f"{entry_id}.{key}")
        self.assertEqual(bj.canonical_text(bj.build_payload()), (_ROOT / "data" / "lookup-ja.json").read_text(encoding="utf-8"))

    def test_name_original_lang_follows_script(self):
        entries = self.payload["entries"]
        self.assertTrue(all(entry["nameOriginalLang"] in {"zh-Hans", "zh-Hant", "zh"} for entry in entries.values()))
        self.assertEqual(entries["advisor:bach-ma-thay-chu"]["nameOriginal"], "白马替主")
        self.assertEqual(entries["advisor:bach-ma-thay-chu"]["nameOriginalLang"], "zh-Hans")
        self.assertEqual(entries["building:bat-tran-do"]["nameOriginalLang"], "zh-Hant")

    def test_sp_variants_carry_prefix(self):
        for row in self.corpus["heroes"]:
            match = bj.VARIANT_RE.match(row["chinese"])
            if match:
                name = self.payload["entries"][row["id"]]["name"]
                self.assertTrue(name.startswith(bj.VARIANT_PREFIXES[match.group(1)]), name)
                self.assertNotRegex(name[:3], r"\s")


class CliTests(unittest.TestCase):
    def test_check_detects_drift_and_write_fixes(self):
        tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, tmp)
        out = tmp / "lookup-ja.json"
        self.assertEqual(bj.main(["--check", "--output", str(out)]), 1)
        self.assertEqual(bj.main(["--write", "--output", str(out)]), 0)
        self.assertEqual(bj.main(["--check", "--output", str(out)]), 0)
        out.write_text(out.read_text(encoding="utf-8").replace('"machineTranslated": true', '"machineTranslated": false'), encoding="utf-8")
        self.assertEqual(bj.main(["--check", "--output", str(out)]), 1)

    def test_orphan_translation_stops_build(self):
        tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, tmp)
        data = json.loads((_ROOT / "pipeline" / "ja-translations.json").read_text(encoding="utf-8"))
        data["items"]["0" * 64] = {"src": "古い", "ja": "x", "model": "m", "translatedAt": "2026-11-17"}
        bad = tmp / "t.json"
        bad.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        stderr = io.StringIO()
        with contextlib.redirect_stderr(stderr):
            self.assertEqual(bj.main(["--check", "--translations", str(bad), "--output", str(tmp / "o.json")]), 1)
            self.assertEqual(bj.main(["--write", "--translations", str(bad), "--output", str(tmp / "o.json")]), 1)
        # Lỗi phải chỉ đúng lệnh dọn để người promote generation Tra cứu mới không bị kẹt.
        self.assertIn("--prune-orphans --write", stderr.getvalue())
        self.assertFalse((tmp / "o.json").exists())

    def test_prune_orphans_write_unblocks_build_and_leaves_changed_text_untranslated(self):
        tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, tmp)
        data = json.loads((_ROOT / "pipeline" / "ja-translations.json").read_text(encoding="utf-8"))
        # Giả lập chữ nguồn vi/zh đã đổi: bản dịch cũ còn khóa theo chữ cũ (mồ côi), chữ mới chưa có bản dịch.
        key, item = sorted(data["items"].items())[0]
        del data["items"][key]
        stale_src = item["src"] + "（旧）"
        data["items"][bj.text_hash(stale_src)] = {**item, "src": stale_src}
        translations = tmp / "t.json"
        translations.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        out = tmp / "o.json"
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(bj.main(["--prune-orphans", "--write", "--translations", str(translations), "--output", str(out)]), 0)
            self.assertEqual(bj.main(["--check", "--translations", str(translations), "--output", str(out)]), 0)
        pruned = json.loads(translations.read_text(encoding="utf-8"))
        self.assertEqual(pruned["schemaVersion"], bj.SCHEMA_VERSION)
        self.assertNotIn(bj.text_hash(stale_src), pruned["items"])
        self.assertEqual(len(pruned["items"]), len(data["items"]) - 1)
        published = [text for entry in json.loads(out.read_text(encoding="utf-8"))["entries"].values() for text in entry["texts"].values()]
        self.assertNotIn(item["ja"], published)

    def test_prune_orphans_writes_nothing_when_build_fails(self):
        # Dựng trong bộ nhớ trước: bản dịch hỏng hoặc override sai làm lệnh dừng mà không ghi file dịch hay đầu ra.
        tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, tmp)
        data = json.loads((_ROOT / "pipeline" / "ja-translations.json").read_text(encoding="utf-8"))
        good_key, good_item = sorted(data["items"].items())[0]
        data["items"]["0" * 64] = {"src": "古い", "ja": "x", "model": "m", "translatedAt": "2026-11-17"}
        broken_overrides = json.loads((_ROOT / "pipeline" / "ja-name-overrides.json").read_text(encoding="utf-8"))
        broken_overrides["names"]["tactic:khong-ton-tai"] = {"nameJa": "存在せず", "confidence": "high", "sourceUrl": "https://example.invalid/"}
        cases = {
            "bản dịch sai số liệu": ({**data, "items": {**data["items"], good_key: {**good_item, "ja": good_item["ja"] + " 999"}}}, None),
            "override trỏ ID không còn": (data, broken_overrides),
        }
        for label, (translations_doc, overrides_doc) in cases.items():
            with self.subTest(label):
                translations = tmp / "t.json"
                translations.write_text(json.dumps(translations_doc, ensure_ascii=False), encoding="utf-8")
                before = translations.read_bytes()
                argv = ["--prune-orphans", "--write", "--translations", str(translations), "--output", str(tmp / "o.json")]
                if overrides_doc is not None:
                    overrides = tmp / "overrides.json"
                    overrides.write_text(json.dumps(overrides_doc, ensure_ascii=False), encoding="utf-8")
                    argv += ["--overrides", str(overrides)]
                with contextlib.redirect_stderr(io.StringIO()), contextlib.redirect_stdout(io.StringIO()):
                    self.assertEqual(bj.main(argv), 1)
                self.assertEqual(translations.read_bytes(), before)
                self.assertFalse((tmp / "o.json").exists())

    def test_prune_orphans_requires_write(self):
        for argv in (["--prune-orphans"], ["--prune-orphans", "--check"], ["--prune-orphans", "--export-todo", "x"]):
            with self.subTest(argv=argv), contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as raised:
                bj.main(argv)
            self.assertEqual(raised.exception.code, 2)


if __name__ == "__main__":
    unittest.main()
