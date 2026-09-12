import hashlib
import json
import tempfile
import unittest
import urllib.request
from pathlib import Path
from unittest import mock

from pipeline import sgsdeck_source


def flight_html(payload: str) -> str:
    argument = json.dumps([1, payload], ensure_ascii=False)
    return f"<script>self.__next_f.push({argument})</script>"


class SgsdeckSourceTest(unittest.TestCase):
    def test_parses_general_detail_without_editorial_or_image_fields(self):
        html = flight_html(
            '7:["$","div",null,{"general":{"id":"g1","nameZh":"趙雲",'
            '"baseForce":95,"growForce":2.62,"adaptSpear":"S",'
            '"innateTacticId":"t1","releaseSeason":null,"updatedAt":'
            '"$D2026-09-01T01:02:03.000Z","description":"editorial",'
            '"lore":"copyright prose","imageUrl":"/image.png"}}]'
        )
        detail = sgsdeck_source.parse_general_detail(html)
        self.assertEqual(detail["sourceId"], "g1")
        self.assertEqual(detail["attributes"]["baseForce"], 95)
        self.assertEqual(detail["attributes"]["adaptSpear"], "S")
        self.assertEqual(detail["sourceUpdatedAt"], "2026-09-01T01:02:03.000Z")
        self.assertNotIn("description", detail["attributes"])
        self.assertNotIn("lore", detail["attributes"])
        self.assertNotIn("imageUrl", detail["attributes"])

    def test_parses_building_level_table_as_structured_game_facts(self):
        html = (
            '<table><thead><tr><th>等級</th><th>木材</th><th>鐵礦</th>'
            '<th>石材</th><th>時間</th><th>效果</th></tr></thead><tbody>'
            '<tr><td>Lv<!-- -->2</td><td>2,400</td><td>2,500</td>'
            '<td>7,200</td><td>30秒</td><td>COST+11</td></tr>'
            '</tbody></table>'
        )
        self.assertEqual(sgsdeck_source.parse_building_levels(html), [{
            "level": 2,
            "costs": {"wood": 2400, "iron": 2500, "stone": 7200},
            "duration": "30秒",
            "effect": "COST+11",
        }])

    def test_parses_equipment_specials_and_preserves_unlinked_children(self):
        html = flight_html(
            '7:["$","div",null,{"specials":['
            '{"id":"s1","nameZh":"雄烈","tier":"T1","slot":"WEAPON",'
            '"description":"戰鬥前2回合獲得破陣",'
            '"exclusiveEquipmentName":"丈八蛇矛","exclusiveGeneralName":"張飛",'
            '"acquisitionSources":["鍛造"]},'
            '{"id":"s2","nameZh":"妖氣","tier":"T1","slot":null,'
            '"description":"普通攻擊後恢復兵力","exclusiveEquipmentName":null,'
            '"exclusiveGeneralName":null,"acquisitionSources":["鍛造"]}]}]'
        )
        children = sgsdeck_source.parse_equipment_specials(html)
        self.assertEqual([child["sourceId"] for child in children], ["s1", "s2"])
        self.assertIsNone(children[1]["exclusiveEquipmentName"])

    def test_discovers_only_allowlisted_detail_urls_from_list_snapshot(self):
        html = (
            '<a href="/generals/%E8%B6%99%E9%9B%B2">趙雲</a>'
            '<a href="/generals/%E8%B6%99%E9%9B%B2?x=1">duplicate</a>'
            '<a href="https://evil.example/generals/x">bad</a>'
        )
        self.assertEqual(
            sgsdeck_source.discover_detail_urls("generals", html),
            ["https://sgsdeck.com/generals/%E8%B6%99%E9%9B%B2"],
        )

    def test_redirect_handler_rejects_external_target_before_following(self):
        handler = sgsdeck_source.AllowlistedRedirectHandler("generals")
        with mock.patch.object(
            urllib.request.HTTPRedirectHandler, "redirect_request"
        ) as follow:
            with self.assertRaisesRegex(ValueError, "allowlist"):
                handler.redirect_request(
                    mock.Mock(), None, 302, "Found", {},
                    "https://evil.example/collect",
                )
            follow.assert_not_called()

    def test_extracts_real_hydration_shapes_without_eval(self):
        html = flight_html(
            '37:["$","div",null,{"generals":'
            '[{"id":"cmtb9e3ke000258f8aks58gur","slug":"40Y呂布",'
            '"nameZh":"40Y 呂布","stars":5,"faction":"QUN","cost":7,'
            '"isSp":false,"isMusou":false,"isCO":false,"category":"軍事"}]}]'
        )
        records = sgsdeck_source.parse_category_page("generals", html)
        self.assertEqual(records[0]["sourceId"], "cmtb9e3ke000258f8aks58gur")
        self.assertEqual(records[0]["nameZh"], "40Y 呂布")
        self.assertEqual(records[0]["attributes"]["variant"], "40y")

    def test_parses_rendered_equipment_and_building_cards_with_stable_slugs(self):
        equipment = (
            '<li><img src="/game-image.png"/><div><span class="font-serif text-base">丈八蛇矛</span>'
            '<span>橙</span><div><span>武器</span></div></div></li>'
            '<li><span>古錠刀</span></li>'
        )
        buildings = (
            '<li><a href="/buildings/jun-wang-dian"><h3>君王殿</h3>'
            '<span>Lv<!-- -->10</span><p>主城核心建築</p>'
            '<span>10 / 10 級已填</span><span>限主城</span></a></li>'
        )
        equipment_records = sgsdeck_source.parse_category_page("equipment", equipment)
        item = equipment_records[0]
        building = sgsdeck_source.parse_category_page("buildings", buildings)[0]
        self.assertEqual(item["sourceId"], "丈八蛇矛")
        self.assertEqual(
            item["sourceId"],
            sgsdeck_source.parse_category_page("equipment", equipment)[0]["sourceId"],
        )
        self.assertEqual(item["attributes"], {"quality": "橙", "slot": "武器"})
        self.assertEqual(equipment_records[1]["missingFields"], ["quality", "slot"])
        self.assertEqual(building["sourceId"], "jun-wang-dian")
        self.assertEqual(building["attributes"]["maxLevel"], 10)
        self.assertTrue(building["attributes"]["mainCityOnly"])

    def test_equipment_flight_payload_uses_upstream_id_and_resolves_deferred_fields(self):
        html = flight_html(
            '7:["$","div",null,{"children":["$","li","equipment-1",'
            '{"children":["$","div",null,{"children":['
            '["$","span",null,{"children":"古錠刀"}],"$L36","$L37"]}]}]}]\n'
            '36:["$","span",null,{"children":"橙"}]\n'
            '37:["$","div",null,{"children":["$","span",null,{"children":"武器"}]}]'
        )
        record = sgsdeck_source.parse_category_page("equipment", html)[0]
        self.assertEqual(record["sourceId"], "equipment-1")
        self.assertEqual(record["nameZh"], "古錠刀")
        self.assertEqual(record["attributes"], {"quality": "橙", "slot": "武器"})
        self.assertEqual(record["missingFields"], [])

    def test_equipment_flight_payload_resolves_deferred_card_and_rejects_missing_reference(self):
        deferred = flight_html(
            '7:["$","div",null,{"children":"$L38"}]\n'
            '36:["$","span",null,{"children":"橙"}]\n'
            '37:["$","span",null,{"children":"武器"}]\n'
            '38:["$","li","equipment-1",{"children":["$","div",null,{"children":['
            '["$","span",null,{"children":"古錠刀"}],"$L36","$L37"]}]}]'
        )
        self.assertEqual(
            sgsdeck_source.parse_category_page("equipment", deferred)[0]["sourceId"],
            "equipment-1",
        )
        missing = deferred.replace(r'\"$L37\"', r'\"$L99\"')
        with self.assertRaisesRegex(ValueError, "missing SGSDeck Flight reference"):
            sgsdeck_source.parse_category_page("equipment", missing)

    def test_source_url_rejects_credentials_ports_fragments_and_unexpected_queries(self):
        rejected = [
            "https://user:secret@sgsdeck.com/generals",
            "https://sgsdeck.com:444/generals",
            "https://sgsdeck.com/generals#token",
            "https://sgsdeck.com/generals?account=private",
            "https://sgsdeck.com/equipment?tab=other",
            "https://sgsdeck.com/generals/a/b",
            "https://sgsdeck.com/generals/%0A",
            "https://sgsdeck.com/generals/%2Fadmin",
        ]
        for url in rejected:
            with self.subTest(url=url):
                with self.assertRaisesRegex(ValueError, "allowlist"):
                    sgsdeck_source.validate_source_url(url)
        sgsdeck_source.validate_source_url(
            "https://sgsdeck.com/equipment?tab=specials", "equipment"
        )

    def test_fetch_rejects_unsafe_resource_identity_before_writing(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            with self.assertRaisesRegex(ValueError, "category|key"):
                sgsdeck_source.fetch_cache(
                    root / "cache",
                    [{"category": "../escape", "key": "list", "url": "https://sgsdeck.com/generals"}],
                    "2026-09-12T01:00:00+07:00",
                )
            self.assertFalse((root / "escape-list.html").exists())

    def test_offline_cache_rejects_untrusted_manifest_metadata(self):
        with tempfile.TemporaryDirectory() as temp:
            cache = Path(temp)
            body = b"[]"
            (cache / "generals-list.html").write_bytes(body)
            base = {
                "schemaVersion": 1,
                "provider": "sgsdeck",
                "region": "TW",
                "fetchedAt": "2026-09-12T01:00:00+07:00",
                "resources": [{
                    "category": "generals", "key": "list",
                    "url": "https://sgsdeck.com/generals", "file": "generals-list.html",
                    "sha256": hashlib.sha256(body).hexdigest(),
                }],
            }
            mutations = [
                ("schemaVersion", 999),
                ("provider", "other"),
                ("region", "XX"),
                ("fetchedAt", "not-a-date"),
            ]
            for field, value in mutations:
                with self.subTest(field=field):
                    manifest = json.loads(json.dumps(base))
                    manifest[field] = value
                    (cache / "manifest.json").write_text(json.dumps(manifest))
                    with self.assertRaises(ValueError):
                        sgsdeck_source.load_offline_cache(cache, {("generals", "list")})
            manifest = json.loads(json.dumps(base))
            manifest["resources"][0]["url"] = "https://evil.example/source"
            (cache / "manifest.json").write_text(json.dumps(manifest))
            with self.assertRaises(ValueError):
                sgsdeck_source.load_offline_cache(cache, {("generals", "list")})

    def test_offline_cache_binds_resource_key_to_exact_url_shape(self):
        with tempfile.TemporaryDirectory() as temp:
            cache = Path(temp)
            body = b"[]"
            (cache / "equipment-list.html").write_bytes(body)
            (cache / "manifest.json").write_text(json.dumps({
                "schemaVersion": 1, "provider": "sgsdeck", "region": "TW",
                "fetchedAt": "2026-09-12T01:00:00+07:00",
                "resources": [{
                    "category": "equipment", "key": "list",
                    "url": "https://sgsdeck.com/equipment?tab=specials",
                    "file": "equipment-list.html",
                    "sha256": hashlib.sha256(body).hexdigest(),
                }],
            }))
            with self.assertRaisesRegex(ValueError, "resource URL"):
                sgsdeck_source.load_offline_cache(cache, {("equipment", "list")})

    def test_troop_mods_keep_children_and_source_season(self):
        html = flight_html(
            '37:["$","div",null,{"seasonCode":"og-兵演春秋",'
            '"seasonName":"兵演春秋","tactics":[{"slug":"大戟士",'
            '"nameZh":"大戟士","troopLimit":["SPEAR"],"options":'
            '[{"tier":"SPECIAL","traitName":"持槍","convertsTo":null,'
            '"description":"攜帶者槍兵兵種適性提升1級"}]}]}]'
        )
        record = sgsdeck_source.parse_category_page("troop-mods", html)[0]
        self.assertEqual(record["sourceSeason"]["scenarioName"], "兵演春秋")
        self.assertEqual(record["attributes"]["options"][0]["traitName"], "持槍")

    def test_offline_cache_rejects_missing_corrupt_or_partial_input_without_network(self):
        with tempfile.TemporaryDirectory() as temp:
            cache = Path(temp)
            body = flight_html('37:["$",null,null,{"generals":[]}]').encode()
            (cache / "generals-list.html").write_bytes(body)
            manifest = {
                "schemaVersion": 1,
                "provider": "sgsdeck",
                "region": "TW",
                "fetchedAt": "2026-09-12T01:00:00+07:00",
                "resources": [{
                    "category": "generals",
                    "key": "list",
                    "url": "https://sgsdeck.com/generals",
                    "file": "generals-list.html",
                    "sha256": hashlib.sha256(body).hexdigest(),
                }],
            }
            (cache / "manifest.json").write_text(json.dumps(manifest))

            with mock.patch("urllib.request.urlopen") as network:
                with self.assertRaisesRegex(ValueError, "missing required cache resource"):
                    sgsdeck_source.load_offline_cache(
                        cache,
                        required={("generals", "list"), ("tactics", "list")},
                    )
                network.assert_not_called()

            manifest["resources"][0]["sha256"] = "0" * 64
            (cache / "manifest.json").write_text(json.dumps(manifest))
            with self.assertRaisesRegex(ValueError, "checksum mismatch"):
                sgsdeck_source.load_offline_cache(cache, required={("generals", "list")})


if __name__ == "__main__":
    unittest.main()
