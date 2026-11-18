"""pipeline/han_script.py: lối viết (giản / phồn) của tên chữ Hán gốc, dùng cho `nameOriginalLang` của data/lookup-ja.json."""

import json
import tempfile
import unittest
from pathlib import Path

from pipeline import han_script as hs


class HanScriptTests(unittest.TestCase):
    def test_simplified_and_traditional(self):
        self.assertEqual(hs.han_script_lang("白马替主"), "zh-Hans")
        self.assertEqual(hs.han_script_lang("霸王讨逆"), "zh-Hans")
        self.assertEqual(hs.han_script_lang("隱忍奪權"), "zh-Hant")
        self.assertEqual(hs.han_script_lang("八陣圖"), "zh-Hant")
        # Chữ hai lối viết cùng dùng (群) không là bằng chứng.
        self.assertEqual(hs.han_script_lang("舌戰群儒"), "zh-Hant")

    def test_undecidable_or_mixed_is_plain_zh(self):
        for text in ("恩服兵心", "SP 荀彧", "白马白馬", "", "Bạch Mã"):
            with self.subTest(text=text):
                self.assertEqual(hs.han_script_lang(text), "zh")
        # OpenCC coi 秘 là giản thể (phồn 祕) còn 術 là phồn thể: lẫn thì không đoán.
        self.assertEqual(hs.han_script_lang("金丹秘術"), "zh")
        with self.assertRaises(TypeError):
            hs.han_script_lang(None)

    def test_table_validation(self):
        tmp = Path(tempfile.mkdtemp())
        bad = tmp / "t.json"
        for payload in ({"schemaVersion": 1, "simplifiedOnly": "马", "traditionalOnly": "馬马"}, {"schemaVersion": 1, "simplifiedOnly": "马"}, [1]):
            with self.subTest(payload=payload):
                bad.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
                with self.assertRaises(hs.HanScriptTableError):
                    hs.load_table(bad)
        good = tmp / "g.json"
        good.write_text(json.dumps({"schemaVersion": 1, "simplifiedOnly": "马", "traditionalOnly": "馬"}, ensure_ascii=False), encoding="utf-8")
        self.assertEqual(hs.han_script_lang("马", hs.load_table(good)), "zh-Hans")


if __name__ == "__main__":
    unittest.main()
