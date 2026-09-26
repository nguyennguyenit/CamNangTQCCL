"""Recommended source contract using pinned, rendered source fragments."""
import copy
import unittest
from pathlib import Path

from pipeline import sgsdeck_recommended as source

FIXTURES = Path(__file__).parent / "fixtures/sgsdeck-recommended"
LIST = (FIXTURES / "list.html").read_text()
DETAIL = (FIXTURES / "detail-sample.html").read_text()
URL = "https://sgsdeck.com/recommended/og-bingyan-40y-lvbu-b"


class RecommendedSourceTest(unittest.TestCase):
    def test_urls_without_query_are_valid_but_malformed_queries_are_rejected(self):
        for url in ["https://sgsdeck.com/recommended", URL,
                    "https://sgsdeck.com/recommended?season=s1&category=pk"]:
            with self.subTest(url=url):
                self.assertEqual(source.validate_source_url(url), url)
        for query in ["season", "season=", "season=s1&season=s2",
                      "season=s1&&category=pk", "unknown=s1"]:
            with self.subTest(query=query), self.assertRaises(ValueError):
                source.validate_source_url("https://sgsdeck.com/recommended?" + query)
        with self.assertRaises(ValueError):
            source.validate_source_url(URL + "?season=s1")

    def test_pinned_list_keeps_all_25_source_scores_without_vn_mapping(self):
        result = source.parse_recommended_list(LIST)
        self.assertEqual(result["expectedCount"], 25)
        self.assertEqual(len(result["records"]), 25)
        self.assertEqual(result["records"][0]["value"], 113)
        self.assertEqual(result["sourceSeason"]["label"], "og-兵演春秋")
        self.assertNotIn("rulesetId", result)

    def test_source_tier_and_faction_come_from_list_not_score(self):
        listing = source.parse_recommended_list(LIST)
        self.assertEqual([sum(row.get("tierRaw") == tier for row in listing["records"]) for tier in ["T0", "T0.5", "T1"]], [12, 1, 12])
        self.assertEqual(listing["records"][0].get("factionRaw"), "群")
        changed = LIST.replace('title="來源評分，僅供同賽季內比較">113', 'title="來源評分，僅供同賽季內比較">97')
        self.assertEqual(source.parse_recommended_list(changed)["records"][0]["tierRaw"], "T0")
        detail = source.parse_recommended_detail(DETAIL, URL)
        joined = source.join_recommended_evidence(listing, [detail])
        self.assertEqual(joined["records"][0]["tierRaw"], "T0")
        self.assertEqual(joined["records"][0]["factionRaw"], "群")

    def test_detail_keeps_holder_tactics_books_and_source_conditions(self):
        result = source.parse_recommended_detail(DETAIL, URL)
        self.assertEqual(result["value"], 113)
        self.assertEqual([h["nameRaw"] for h in result["heroes"]], ["40Y 呂布", "王異", "SP 法正"])
        self.assertEqual(result["heroes"][0]["bookSlotsRaw"], ["以退為進", "精準", "持重"])
        self.assertEqual(result["heroes"][1]["tacticSlotsRaw"], ["奪魂挾魄", "當鋒摧決"])
        self.assertIn("升級為 S", result["notesRaw"])

    def test_display_notes_assign_each_source_occurrence_once_without_changing_raw(self):
        raw, projection = source.parse_recommended_detail_with_display_notes(DETAIL, URL)
        self.assertEqual(raw, source.parse_recommended_detail(DETAIL, URL))
        blocks = projection["blocks"]
        self.assertEqual(projection["schemaVersion"], 1)
        self.assertEqual(len({block["id"] for block in blocks}), len(blocks))
        self.assertEqual([block["id"] for block in blocks], [f"p-{index}" for index in range(1, len(blocks) + 1)])
        self.assertIn("team", {block["owner"] for block in blocks})
        self.assertIn("primary", {block["owner"] for block in blocks})
        self.assertTrue(all("holderIndex" not in block for block in blocks if block["owner"] == "team"))

    def test_display_notes_keep_equal_text_occurrences_across_all_owners(self):
        def card(role, name, note):
            return (
                '<div class="sm:p-5 p-4 space-y-2">'
                f'<span>{role}</span><p class="text-xl">{name}</p>'
                '<div><span>戰法 1</span><span>A</span></div>'
                '<div><span>戰法 2</span><span>B</span></div>'
                '<div><span>兵書</span><button>C</button></div>'
                '<div><span>加點</span><span>智力</span></div>'
                f'<p>{note}</p></div>'
            )

        url = "https://sgsdeck.com/recommended/ownership-fixture"
        html = (
            f'<link rel="canonical" href="{url}">'
            '<header><h1>測試隊</h1><span class="font-mono">105</span><span>OG-Test · 交戰</span></header>'
            '<p>同文</p>'
            + card("主將", "甲", "同文")
            + card("副將 1", "乙", "同文")
            + card("副將 2", "丙", "同文")
            + card("副將 3", "丁", "同文")
            + '<span>#弓</span>'
        )
        raw, projection = source.parse_recommended_detail_with_display_notes(html, url)
        self.assertEqual(raw, source.parse_recommended_detail(html, url))
        equal_blocks = [block for block in projection["blocks"] if block["textRaw"] == "同文"]
        self.assertEqual(len(equal_blocks), 5)
        self.assertEqual([block["owner"] for block in equal_blocks], [
            "team", "primary", "primary", "primary", "alternative",
        ])
        self.assertEqual(len({block["id"] for block in equal_blocks}), 5)
        self.assertEqual(len(raw["alternativeHoldersRaw"]), 1)

    def test_missing_score_is_null_not_zero(self):
        changed = LIST.replace('title="來源評分，僅供同賽季內比較">113', 'title="來源評分，僅供同賽季內比較">')
        self.assertIsNone(source.parse_recommended_list(changed)["records"][0]["value"])

    def test_streamed_holder_fields_and_unit_tags_keep_their_owner(self):
        result = source.parse_recommended_detail(DETAIL, URL)
        self.assertEqual(result["heroes"][2]["statFocusRaw"], "智力")
        self.assertIn("升級為 S", result["heroes"][2]["notesRaw"])
        self.assertEqual(result["unitTypesRaw"], ["弓"])

    def test_incomplete_streamed_holder_field_is_rejected(self):
        with self.assertRaises(ValueError):
            source.parse_recommended_detail(DETAIL.replace('id="S:4"', 'id="missing-chunk"'), URL)

    def test_duplicate_list_identity_is_rejected(self):
        changed = LIST.replace("og-bingyan-40y-lvbu-xiandeng", "og-bingyan-40y-lvbu-b")
        with self.assertRaises(ValueError):
            source.parse_recommended_list(changed)

    def test_list_count_drift_and_login_html_are_rejected(self):
        for html in [LIST.replace("25 套交戰配置", "26 套交戰配置"), "<h1>登入</h1>"]:
            with self.subTest(html=html[:50]), self.assertRaises(ValueError):
                source.parse_recommended_list(html)

    def test_incomplete_detail_or_wrong_canonical_url_is_rejected(self):
        for html in [DETAIL.replace("副將 2", "missing role"), DETAIL.replace(URL, URL + "-other")]:
            with self.subTest(html=html[:50]), self.assertRaises(ValueError):
                source.parse_recommended_detail(html, URL)

    def test_urls_cannot_leave_recommended_public_scope(self):
        for url in ["https://evil.test/recommended", "http://sgsdeck.com/recommended", "https://sgsdeck.com/login", "https://user@sgsdeck.com/recommended", "https://sgsdeck.com/recommended/../login", "https://sgsdeck.com/recommended?token=secret"]:
            with self.subTest(url=url), self.assertRaises(ValueError):
                source.validate_source_url(url)

    def test_matching_list_detail_is_required_for_score_evidence(self):
        listing = source.parse_recommended_list(LIST)
        detail = source.parse_recommended_detail(DETAIL, URL)
        accepted = source.join_recommended_evidence(listing, [detail])
        self.assertEqual(accepted["inventory"]["expected"], 25)
        self.assertEqual(accepted["inventory"]["extracted"], 1)
        self.assertEqual(accepted["inventory"]["missingDetails"], 24)
        self.assertEqual(accepted["records"][0]["value"], 113)
        for key, value in [("value", 105), ("nameZh", "other"), ("sourceSeason", {"label": "s1"})]:
            other = copy.deepcopy(detail)
            other[key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                source.join_recommended_evidence(listing, [other])

    def test_requested_scope_must_match_rendered_season_and_category(self):
        accepted = source.parse_recommended_list(LIST, requested_scope={"season": "og-兵演春秋", "category": "交戰"})
        self.assertEqual(accepted["sourceCategoryId"], "交戰")
        with self.assertRaisesRegex(ValueError, "requested scope"):
            source.parse_recommended_list(LIST, requested_scope={"season": "pk-s28", "category": "交戰"})
        with self.assertRaisesRegex(ValueError, "requested scope"):
            source.parse_recommended_list(LIST, requested_scope={"sourceSeasonId": "og-兵演春秋", "sourceCategoryId": "器械"})


if __name__ == "__main__":
    unittest.main()
