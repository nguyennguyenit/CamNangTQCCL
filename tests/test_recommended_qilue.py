import collections
import copy
import json
import unittest
from pathlib import Path

from pipeline import build_unified_lookup as lookup
from pipeline.recommended_qilue import QilueError, compute_qilue, load_catalog, load_overrides

ROOT = Path(__file__).resolve().parents[1]


def _catalog():
    document = json.loads((ROOT / "pipeline" / "lookup-client-tactics.json").read_bytes())
    strategies, cards = lookup._client_qilue(document)
    return {"qilueStrategies": strategies, "qilueCards": cards}


def _overrides():
    return json.loads((ROOT / "pipeline" / "recommended-qilue-overrides.json").read_bytes())


def _pack_records():
    """Record của pack đã ghim, gắn displayNotes như `site_localization.hydrate_inputs`."""
    pack = json.loads((ROOT / "pipeline" / "localization-inputs" / "recommended.json").read_bytes())
    notes = pack["displayNotes"]
    out = []
    for row in pack["records"]:
        projection = notes.get(row["safeScopeKey"], {}).get(row.get("sourceConfigId"))
        out.append({**row, "displayNotes": projection} if projection is not None else row)
    return out


def _team(config, text, season="pk-s27"):
    return {"sourceSeasonId": season, "sourceConfigId": config, "safeScopeKey": "s-x",
            "displayNotes": {"blocks": [{"id": "p-1", "owner": "team", "textRaw": text}]}}


class QilueOverridesTest(unittest.TestCase):
    def test_overrides_point_at_real_catalog_rows(self):
        _, _, by_id = load_catalog(_catalog())
        load_overrides(_overrides(), by_id)

    def test_note_variants_never_reuse_a_card_name_or_another_tactic_name(self):
        catalog = _catalog()
        tactics = json.loads((ROOT / "data" / "tactics.json").read_bytes())
        tactic_names = {row.get("chinese") for row in tactics} | {row.get("hanViet") for row in tactics}
        names = {row["nameZh"] for row in catalog["qilueCards"]}
        for variant in _overrides()["noteVariantsZh"]:
            self.assertNotIn(variant, names)
            if variant != "十面埋伏":  # chiến pháp của Trình Dục: chỉ map khi đang trong chuỗi kỳ lược (test bên dưới)
                self.assertNotIn(variant, tactic_names, variant)

    def test_invalid_overrides_are_rejected(self):
        _, _, by_id = load_catalog(_catalog())
        for change in (
            lambda d: d["noteVariantsZh"].update({"設伏十面": "qilue-card:bo-tri-thap-dien"}),
            lambda d: d["noteVariantsZh"].update({"錯字": "qilue-card:khong-co"}),
            lambda d: d["fix"]["s27-lp-zuolv-qiang"].update(reason=""),
            lambda d: d["skip"].update({"s27-lp-zuolv-qiang": "trùng mục fix"}),
            lambda d: d["copyFrom"].update({"s27-chuanzi-gong": []}),
        ):
            document = copy.deepcopy(_overrides())
            change(document)
            with self.assertRaises(QilueError):
                load_overrides(document, by_id)


class ComputeQilueTest(unittest.TestCase):
    def _one(self, text, config="s27-test"):
        overrides = copy.deepcopy(_overrides())
        overrides.update(copyFrom={}, fix={}, skip={})
        return compute_qilue([_team(config, text)], _catalog(), overrides).get(("s-x", config))

    def test_official_form_is_ordered_and_hides_its_own_note_block(self):
        qilue = self._one("作戰方略：謀算。奇略卡（第 2→6 回合）：設伏十面→背水列陣→楚歌四起→多多益善→合圍夾擊。")
        self.assertEqual(qilue["form"], "official")
        self.assertEqual(qilue["strategyId"], "qilue-strategy:muu-tinh")
        self.assertEqual(qilue["cardIds"][0], "qilue-card:bo-tri-thap-dien")
        self.assertTrue(qilue["ordered"])
        self.assertEqual(qilue["hideNoteBlockId"], "p-1")

    def test_official_line_mixed_with_commentary_keeps_the_block(self):
        qilue = self._one("整體不錯。作戰方略：強攻。奇略卡（第 2→6 回合）：橫掃河西→追亡逐北→博浪椎秦→臨危不懼→壯志不絕")
        self.assertNotIn("hideNoteBlockId", qilue)

    def test_qimou_bare_and_list_forms(self):
        self.assertEqual(self._one("奇謀（強攻）：封狼居胥→博浪椎秦→摧鋒陷敵→斬逆納降→孤軍深入")["form"], "qimou")
        bare = self._one("T0 ｜ 整軍：推食解衣→芒碭隱蹤→[極]約法三章→鴻門避險→沛縣聚義")
        self.assertEqual((bare["form"], bare["strategyId"]), ("bare", "qilue-strategy:toan-quan"))
        self.assertEqual(bare["cardIds"][3], "qilue-card:lanh-hiem-hong-mon")
        listed = self._one("奇略：設伏十面、博浪椎秦、功成身退、合圍夾擊、楚歌四起")
        self.assertEqual((listed["form"], listed["ordered"], listed["strategyId"]), ("list", False, None))

    def test_ten_sided_ambush_variant_only_maps_inside_a_qilue_sequence(self):
        self.assertEqual(self._one("奇謀（謀算）：十面埋伏→暗度陳倉→博浪椎秦→背水列陣→楚歌四起")["cardIds"][0], "qilue-card:bo-tri-thap-dien")
        # Câu nói về chiến pháp Thập Diện Mai Phục của Trình Dục: không có chuỗi kỳ lược, nhưng có biến thể -> gate độ phủ báo.
        with self.assertRaises(QilueError):
            self._one("十面埋伏（程昱）調整後推薦的陣容")

    def test_game_rules_and_unknown_names_stop_the_publish(self):
        for text in (
            "奇謀（謀算）：設伏十面→背水列陣→楚歌四起→多多益善→錯字卡",  # tên lạ
            "奇謀（謀算）：設伏十面→背水列陣→楚歌四起→多多益善→誘敵離營",  # 2 thẻ hiếm
            "奇謀（強攻）：設伏十面→背水列陣→楚歌四起→合圍夾擊→暗度陳倉",  # thẻ Mưu với Cường Công
            "謀算：設伏十面→[極]背水列陣→楚歌四起",  # [極] trên thẻ thường
            "奇略：復刻五謀奇略",  # chép đội khác mà không có copyFrom
        ):
            with self.assertRaises(QilueError, msg=text):
                self._one(text)

    def test_other_seasons_are_ignored(self):
        overrides = copy.deepcopy(_overrides())
        overrides.update(copyFrom={}, fix={}, skip={})
        team = _team("s28-x", "司馬懿奇謀：設伏十面→背水列陣→錯字", season="pk-s28")
        self.assertEqual(compute_qilue([team], _catalog(), overrides), {})


class PinnedPackQilueTest(unittest.TestCase):
    """Toàn pack đã ghim: mọi đội PK-S27 có chữ kỳ lược nằm trong đúng một nhóm (đếm từ phía dữ liệu)."""

    def test_every_pk_s27_team_with_qilue_text_is_covered(self):
        result = compute_qilue(_pack_records(), _catalog(), _overrides())
        forms = collections.Counter()
        seen = set()
        for (_, config), qilue in result.items():
            if config not in seen:
                seen.add(config)
                forms[qilue["form"]] += 1
        self.assertEqual(dict(forms), {"official": 16, "qimou": 22, "bare": 2, "list": 13, "copy": 4, "fix": 2})
        wumou = next(qilue for (_, config), qilue in result.items() if config == "s27-official-wumou-qi")
        self.assertEqual(wumou["cardIds"], [
            "qilue-card:bo-tri-thap-dien", "qilue-card:dan-tran-tu-chien", "qilue-card:so-ca-tu-khoi",
            "qilue-card:cang-nhieu-cang-tot", "qilue-card:hop-vay-giap-kich",
        ])
        self.assertEqual(wumou["hideNoteBlockId"], "p-2")
        # 16 đội 台服官方 đều có một block chỉ chứa dòng kỳ lược: ô có cấu trúc thay cho block đó.
        official = {config: qilue for (_, config), qilue in result.items() if qilue["form"] == "official"}
        self.assertTrue(all("hideNoteBlockId" in qilue for qilue in official.values()))


if __name__ == "__main__":
    unittest.main()
