"""Thẻ Kỳ Lược Cùng Tồn: chữ sheet nối với mã `qilue-card:*` của catalog Kỳ lược lúc dựng dữ liệu, tên lạ làm build dừng."""

import copy
import json
import unittest
from pathlib import Path

from pipeline.coexist_qilue import CoexistQilueError, card_index, check_payload_cards, read_aliases, read_catalog, resolve_strategy_cards
from pipeline.parse_coexist_csv import build_content_links
from pipeline.season_validation import content_fingerprint

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / "plans/261117-0206-cung-ton-han-diem-truong-minh/research/coexist-han-diem-truong-minh.csv"
SCENARIO = "han-diem-truong-minh"


def _links():
    return json.loads((ROOT / "pipeline/season-content-links.json").read_text(encoding="utf-8"))


def _rebuild(catalog=None, aliases=None):
    current = [link for link in _links() if link["scenarioId"] == SCENARIO]
    source = copy.deepcopy(current[0]["target"]["source"])
    source.pop("disclaimerRaw")
    return build_content_links(
        SNAPSHOT.read_bytes().decode("utf-8"),
        json.loads((ROOT / "pipeline/coexist-han-diem-source-record-map.json").read_text(encoding="utf-8")),
        source,
        scenario_id=SCENARIO,
        evidence_refs=current[0]["evidenceRefs"],
        qilue_catalog=catalog,
        qilue_aliases=aliases,
    )


class CoexistQilueResolveTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = read_catalog()
        cls.aliases = read_aliases()
        cls.index, cls.by_id = card_index(cls.catalog, cls.aliases)

    def test_all_25_teams_map_every_card_in_round_order(self):
        teams = [team for link in _links() if link["scenarioId"] == SCENARIO for team in link["target"]["payload"]["teams"]]
        self.assertEqual(len(teams), 25)
        names = {row["id"]: row["nameVi"] for row in self.catalog["qilueCards"]}
        aliases = {entry["cardId"]: alias for alias, entry in self.aliases["aliases"].items()}
        for team in teams:
            raw = [part.strip() for part in team["strategyCardsRaw"].split("→")]
            ids = team["strategyCardIds"]
            self.assertEqual(len(ids), len(raw), team["recordId"])
            self.assertEqual([names[card] if names[card] == name else aliases[card] for card, name in zip(ids, raw)], raw, team["recordId"])
        check_payload_cards(_links(), self.catalog, self.aliases)

    def test_reviewed_aliases_map_sheet_names_to_client_cards(self):
        self.assertEqual(self.index["Phong Lang Cư Tế"], "qilue-card:phong-lang-cu-tu")
        self.assertEqual(self.index["Trấn Giữ Quân Diên"], "qilue-card:tri-duyen-quan-the")
        self.assertEqual({self.by_id[entry["cardId"]]["nameZh"] for entry in self.aliases["aliases"].values()}, {"封狼居胥", "治延軍勢"})

    def test_unknown_card_name_stops_the_build(self):
        with self.assertRaisesRegex(CoexistQilueError, "unknown qilue card in t: Thẻ Lạ"):
            resolve_strategy_cards("Càn Quét Tây Hà → Thẻ Lạ → Truy Kích Tử Trận", self.index, self.by_id, label="t")
        # Snapshot đã ghim hash nên tên lạ ở dữ liệu thật chỉ xuất hiện khi catalog không còn thẻ mà sheet ghi.
        catalog = copy.deepcopy(self.catalog)
        catalog["qilueCards"] = [row for row in catalog["qilueCards"] if row["id"] != "qilue-card:bac-lang-chuy-tan"]
        with self.assertRaisesRegex(CoexistQilueError, "unknown qilue card .*Bác Lãng Chuy Tần"):
            _rebuild(catalog=catalog)

    def test_rebuild_attaches_ids_without_changing_reviewed_fingerprints(self):
        rebuilt = _rebuild()
        self.assertEqual(rebuilt, [link for link in _links() if link["scenarioId"] == SCENARIO])
        for link in rebuilt:
            self.assertEqual(link["target"]["contentFingerprint"], content_fingerprint(link["target"]["payload"]))
            for team in link["target"]["payload"]["teams"]:
                stripped = {key: value for key, value in team.items() if key != "strategyCardIds"}
                self.assertEqual(content_fingerprint(team), content_fingerprint(stripped))

    def test_game_rules_reject_impossible_sequences(self):
        for raw in (
            "Càn Quét Tây Hà → Truy Kích Tử Trận",  # dưới 3 thẻ
            "Càn Quét Tây Hà → Càn Quét Tây Hà → Truy Kích Tử Trận",  # trùng thẻ
            "Chí Khí Ngập Tràn → Trảm Địch Chiêu Hàng → Truy Kích Tử Trận",  # hai thẻ hiếm
            "Càn Quét Tây Hà → Bố Trí Thập Diện → Ẩn Tích Mang Thương",  # ba loại thẻ, không phương lược nào dùng được
        ):
            with self.subTest(raw=raw), self.assertRaises(CoexistQilueError):
                resolve_strategy_cards(raw, self.index, self.by_id, label="t")
        self.assertEqual(resolve_strategy_cards("", self.index, self.by_id, label="t"), [])

    def test_invalid_aliases_reject(self):
        changes = (
            lambda d: d["aliases"]["Phong Lang Cư Tế"].update(cardId="qilue-card:khong-co"),
            lambda d: d["aliases"]["Phong Lang Cư Tế"].update(nameZh="治延軍勢"),
            lambda d: d["aliases"]["Phong Lang Cư Tế"].update(source=" "),
            lambda d: d["aliases"].update({"Càn Quét Tây Hà": {"cardId": "qilue-card:truy-kich-tu-tran", "nameZh": "乘勝追擊", "source": "x"}}),
            lambda d: d.update(schemaVersion=2),
        )
        for index, change in enumerate(changes):
            document = copy.deepcopy(self.aliases)
            change(document)
            with self.subTest(index=index), self.assertRaises(CoexistQilueError):
                card_index(self.catalog, document)

    def test_publication_rejects_stale_or_hand_edited_ids(self):
        for mode in ("swap", "missing", "extra-on-empty"):
            links = _links()
            team = next(link for link in links if link["scenarioId"] == SCENARIO)["target"]["payload"]["teams"][0]
            if mode == "swap":
                team["strategyCardIds"][0], team["strategyCardIds"][1] = team["strategyCardIds"][1], team["strategyCardIds"][0]
            if mode == "missing":
                team.pop("strategyCardIds")
            if mode == "extra-on-empty":
                team["strategyCardsRaw"] = ""
            with self.subTest(mode=mode), self.assertRaises(CoexistQilueError):
                check_payload_cards(links, self.catalog, self.aliases)


if __name__ == "__main__":
    unittest.main()
