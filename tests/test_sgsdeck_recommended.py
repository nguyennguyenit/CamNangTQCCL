"""Recommended source contract using pinned, rendered source fragments."""
import copy
import hashlib
import json
import re
import tempfile
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

    def _cache(self, root, listing):
        items = []
        for key, html, url in [("list", listing, "https://sgsdeck.com/recommended"), ("detail", DETAIL, URL)]:
            body = html.encode()
            (root / (key + ".html")).write_bytes(body)
            items.append({"key": key, "url": url, "path": key + ".html", "sha256": hashlib.sha256(body).hexdigest(), "fetchedAt": "2026-09-12T06:07:25+00:00"})
        (root / "manifest.json").write_text(json.dumps(items))

    def test_incomplete_scope_cannot_publish_canonical_evidence(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            self._cache(root, LIST)
            output = root / "accepted.json"
            with self.assertRaisesRegex(ValueError, "incomplete"):
                source.build_recommended_evidence(root, output)
            self.assertFalse(output.exists())

    def test_offline_cache_checksums_and_failed_publish_preserve_evidence(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            # A controlled one-card scope retains the pinned source card verbatim.
            listing = re.sub(r'<a\b[^>]*href="/recommended/[^\"]+"[^>]*>.*?</a>',
                             lambda match: match[0] if 'href="' + URL.removeprefix('https://sgsdeck.com') + '"' in match[0] else '', LIST, flags=re.S)
            listing = listing.replace("25 套交戰配置", "1 套交戰配置")
            self._cache(root, listing)
            output = root / "accepted.json"
            source.build_recommended_evidence(root, output)
            before = output.read_bytes()
            source.build_recommended_evidence(root, output)
            self.assertEqual(output.read_bytes(), before)
            (root / "detail.html").write_text("broken")
            with self.assertRaises(ValueError):
                source.build_recommended_evidence(root, output)
            self.assertEqual(output.read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
