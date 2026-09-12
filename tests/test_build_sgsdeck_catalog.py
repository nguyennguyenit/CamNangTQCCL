import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock
import os

from pipeline import build_sgsdeck_catalog


def flight_html(payload: str) -> str:
    return f'<script>self.__next_f.push({json.dumps([1, payload], ensure_ascii=False)})</script>'


class BuildSgsdeckCatalogTest(unittest.TestCase):
    def empty_mapping(self, root):
        path = Path(root) / "empty-sgsdeck-name-map.json"
        path.write_text(json.dumps({"schemaVersion": 1, "mappings": []}))
        return path

    def test_general_detail_must_match_list_name_and_url_slug(self):
        list_body = (
            flight_html('7:["$",null,null,{"generals":[{"id":"g1","nameZh":"趙雲"}]}]')
            + '<a href="/generals/%E8%B6%99%E9%9B%B2">趙雲</a>'
        ).encode()
        source_records = [{
            "sourceId": "g1", "nameZh": "趙雲", "attributes": {}, "sourceSeason": None,
        }]
        resources = {("generals", "detail-0001"): {
            "metadata": {"url": "https://sgsdeck.com/generals/%E8%B6%99%E9%9B%B2"},
            "body": flight_html(
                '7:["$",null,null,{"general":{"id":"g1","nameZh":"關羽",'
                '"baseForce":99,"updatedAt":"2026-09-01T00:00:00Z"}}]'
            ).encode(),
        }}
        with self.assertRaisesRegex(ValueError, "name does not match"):
            build_sgsdeck_catalog._compose_list_records(
                "generals", source_records, list_body, resources
            )

    def test_inventory_shrink_is_rejected_against_validated_snapshot(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp)
            (output / "manifest.json").write_text(json.dumps({
                "inventory": {
                    category: {"recordCount": 2, "childCount": 1}
                    for category in build_sgsdeck_catalog.CATEGORIES
                }
            }))
            candidate = {
                category: {"recordCount": 2, "childCount": 1}
                for category in build_sgsdeck_catalog.CATEGORIES
            }
            candidate["generals"]["recordCount"] = 0
            with mock.patch("pipeline.build_sgsdeck_catalog.validate_snapshot"):
                with self.assertRaisesRegex(ValueError, "snapshot shrink"):
                    build_sgsdeck_catalog._reject_snapshot_shrink(output, candidate)

    def test_nested_record_loss_is_rejected_even_when_total_counts_hold(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp)
            inventory = {
                category: {"recordCount": 0, "childCount": 0}
                for category in build_sgsdeck_catalog.CATEGORIES
            }
            inventory["troop-mods"] = {"recordCount": 1, "childCount": 2}
            (output / "manifest.json").write_text(json.dumps({"inventory": inventory}))
            for category in build_sgsdeck_catalog.CATEGORIES:
                records = []
                if category == "troop-mods":
                    records = [{
                        "sourceId": "m1", "nameZh": "大戟士",
                        "attributes": {
                            "effectText": "強化", "troopLimit": ["SPEAR"],
                            "options": [{"traitName": "一"}, {"traitName": "二"}],
                        },
                    }]
                (output / f"{category}.json").write_text(json.dumps({"records": records}))
            catalogs = {
                category: {"records": []}
                for category in build_sgsdeck_catalog.CATEGORIES
            }
            catalogs["troop-mods"] = {"records": [{
                "sourceId": "m1", "nameZh": "大戟士",
                "attributes": {
                    "effectText": "強化", "troopLimit": ["SPEAR"],
                    "options": [{"traitName": "一"}],
                },
            }]}
            with mock.patch("pipeline.build_sgsdeck_catalog.validate_snapshot"):
                with self.assertRaisesRegex(ValueError, "lost nested records"):
                    build_sgsdeck_catalog._reject_snapshot_shrink(
                        output, inventory, catalogs
                    )

    def test_equipment_source_id_drift_is_rejected_after_upstream_id_migration(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp)
            inventory = {
                category: {"recordCount": 0, "childCount": 0}
                for category in build_sgsdeck_catalog.CATEGORIES
            }
            inventory["equipment"] = {"recordCount": 1, "childCount": 0}
            (output / "manifest.json").write_text(json.dumps({"inventory": inventory}))
            for category in build_sgsdeck_catalog.CATEGORIES:
                records = []
                if category == "equipment":
                    records = [{
                        "sourceId": "upstream-old", "nameZh": "丈八蛇矛",
                        "attributes": {"quality": "橙", "slot": "武器"},
                    }]
                (output / f"{category}.json").write_text(json.dumps({"records": records}))
            catalogs = {
                category: {"records": []}
                for category in build_sgsdeck_catalog.CATEGORIES
            }
            catalogs["equipment"] = {"records": [{
                "sourceId": "upstream-new", "nameZh": "丈八蛇矛",
                "attributes": {"quality": "橙", "slot": "武器"},
            }]}
            with mock.patch("pipeline.build_sgsdeck_catalog.validate_snapshot"):
                with self.assertRaisesRegex(ValueError, "lost existing identity"):
                    build_sgsdeck_catalog._reject_snapshot_shrink(
                        output, inventory, catalogs
                    )

    def test_list_build_composes_details_and_equipment_special_children(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            cache = root / "cache"
            output = root / "data" / "sgsdeck"
            cache.mkdir()
            fixtures = {
                ("generals", "list", "https://sgsdeck.com/generals"): (
                    flight_html('7:["$",null,null,{"generals":[{"id":"g1","slug":"趙雲",'
                                '"nameZh":"趙雲","category":"軍事","faction":"SHU","stars":5,"cost":7}]}]')
                    + '<a href="/generals/%E8%B6%99%E9%9B%B2">趙雲</a>'
                ),
                ("generals", "detail-0001", "https://sgsdeck.com/generals/%E8%B6%99%E9%9B%B2"): flight_html(
                    '7:["$",null,null,{"general":{"id":"g1","nameZh":"趙雲",'
                    '"baseForce":95,"updatedAt":"2026-09-01T00:00:00Z"}}]'
                ),
                ("tactics", "list", "https://sgsdeck.com/tactics"): flight_html(
                    '7:["$",null,null,{"tactics":[{"id":"t1","nameZh":"一身是膽",'
                    '"quality":"S","kind":"主動","source":"事件","effectText":"增傷",'
                    '"troopLimit":[],"maxUsers":1}]}]'
                ),
                ("equipment", "list", "https://sgsdeck.com/equipment"): (
                    '<li><span>丈八蛇矛</span><span>橙</span><span>武器</span></li>'
                ),
                ("equipment", "specials", "https://sgsdeck.com/equipment?tab=specials"): flight_html(
                    '7:["$",null,null,{"specials":[{"id":"s1","nameZh":"雄烈",'
                    '"tier":"T1","slot":"WEAPON","description":"破陣",'
                    '"exclusiveEquipmentName":"丈八蛇矛","exclusiveGeneralName":"張飛",'
                    '"acquisitionSources":["鍛造"]}]}]'
                ),
                ("advisors", "list", "https://sgsdeck.com/advisors"): flight_html(
                    '7:["$",null,null,{"advisors":[{"id":"a1","nameZh":"仁心得眾",'
                    '"element":"風","effectText":"增益","tacticPoints":5,"generals":[]}]}]'
                ),
                ("troop-mods", "list", "https://sgsdeck.com/troop-mods"): flight_html(
                    '7:["$",null,null,{"seasonCode":"s","seasonName":"兵演春秋",'
                    '"tactics":[{"id":"m1","nameZh":"大戟士","effectText":"兵種強化",'
                    '"troopLimit":["SPEAR"],"options":[{"tier":"BASIC",'
                    '"traitName":"持槍","description":"提升適性","convertsTo":null}]}]}]'
                ),
                ("buildings", "list", "https://sgsdeck.com/buildings"): (
                    '<li><a href="/buildings/jun-wang-dian"><h3>君王殿</h3>'
                    '<span>10</span><p>主城核心建築資料</p></a></li>'
                ),
                ("buildings", "detail-0001", "https://sgsdeck.com/buildings/jun-wang-dian"): (
                    '<table><thead><tr><th>等級</th><th>木材</th><th>鐵礦</th>'
                    '<th>石材</th><th>時間</th><th>效果</th></tr></thead><tbody>'
                    '<tr><td>Lv1</td><td>—</td><td>—</td><td>—</td>'
                    '<td>—</td><td>COST+10</td></tr></tbody></table>'
                ),
            }
            resources = []
            for (category, key, url), text in fixtures.items():
                body = text.encode()
                name = f"{category}-{key}.html"
                (cache / name).write_bytes(body)
                resources.append({
                    "category": category, "key": key, "url": url, "file": name,
                    "sha256": hashlib.sha256(body).hexdigest(),
                })
            (cache / "manifest.json").write_text(json.dumps({
                "schemaVersion": 1, "provider": "sgsdeck", "region": "TW",
                "fetchedAt": "2026-09-12T02:00:00+07:00", "resources": resources,
            }))

            build_sgsdeck_catalog.build_from_cache(
                cache, output, mapping_path=self.empty_mapping(root)
            )
            generals = json.loads((output / "generals.json").read_text())
            equipment = json.loads((output / "equipment.json").read_text())
            buildings = json.loads((output / "buildings.json").read_text())
            self.assertEqual(generals["records"][0]["attributes"]["baseForce"], 95)
            self.assertEqual(
                generals["records"][0]["provenance"]["sourceUrl"],
                "https://sgsdeck.com/generals/%E8%B6%99%E9%9B%B2",
            )
            self.assertEqual(buildings["records"][0]["attributes"]["levels"][0]["level"], 1)
            self.assertEqual(equipment["inventory"]["childCount"], 1)
            self.assertEqual(equipment["children"][0]["parentSourceId"], "丈八蛇矛")

    def test_atomic_promotion_restores_before_commit_and_ignores_cleanup_failure_after_commit(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            output = root / "output"
            staging = root / "staging"
            output.mkdir()
            staging.mkdir()
            (output / "marker").write_text("old")
            (staging / "marker").write_text("new")
            real_replace = os.replace
            calls = 0

            def fail_commit(source, destination):
                nonlocal calls
                calls += 1
                if calls == 2:
                    raise OSError("commit failed")
                return real_replace(source, destination)

            with mock.patch("pipeline.build_sgsdeck_catalog.os.replace", side_effect=fail_commit):
                with self.assertRaisesRegex(OSError, "commit failed"):
                    build_sgsdeck_catalog._promote(staging, output)
            self.assertEqual((output / "marker").read_text(), "old")

            (staging / "marker").write_text("new")
            real_rmtree = build_sgsdeck_catalog.shutil.rmtree

            def fail_backup_cleanup(path):
                if Path(path).name == "output.previous":
                    raise OSError("cleanup failed")
                return real_rmtree(path)

            with mock.patch("pipeline.build_sgsdeck_catalog.shutil.rmtree", side_effect=fail_backup_cleanup):
                build_sgsdeck_catalog._promote(staging, output)
            self.assertEqual((output / "marker").read_text(), "new")

    def test_missing_offline_cache_preserves_accepted_snapshot_and_never_fetches(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            cache = root / "cache"
            output = root / "data" / "sgsdeck"
            cache.mkdir()
            output.mkdir(parents=True)
            old = b'{"accepted":true}\n'
            (output / "manifest.json").write_bytes(old)

            with mock.patch("urllib.request.urlopen") as network:
                with self.assertRaisesRegex(ValueError, "cache manifest is missing"):
                    build_sgsdeck_catalog.build_from_cache(cache, output)
                network.assert_not_called()
            self.assertEqual((output / "manifest.json").read_bytes(), old)

    def test_semantically_invalid_staging_never_replaces_accepted_snapshot(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            cache = root / "cache"
            output = root / "data" / "sgsdeck"
            cache.mkdir()
            output.mkdir(parents=True)
            old = b'{"accepted":true}\n'
            (output / "manifest.json").write_bytes(old)
            resources = []
            fixtures = {
                category: [{
                    "sourceId": f"{category}-1",
                    "nameZh": f"{category} name",
                    "attributes": "invalid" if category == "generals" else {},
                }]
                for category in build_sgsdeck_catalog.CATEGORIES
            }
            for category, records in fixtures.items():
                body = json.dumps(records, sort_keys=True).encode()
                name = f"{category}-normalized-source.json"
                (cache / name).write_bytes(body)
                resources.append({
                    "category": category,
                    "key": "normalized-source",
                    "url": f"https://sgsdeck.com/{category}",
                    "file": name,
                    "sha256": hashlib.sha256(body).hexdigest(),
                })
            (cache / "manifest.json").write_text(json.dumps({
                "schemaVersion": 1,
                "provider": "sgsdeck",
                "region": "TW",
                "fetchedAt": "2026-09-12T01:00:00+07:00",
                "resources": resources,
            }))

            with self.assertRaises(ValueError):
                build_sgsdeck_catalog.build_from_cache(
                    cache, output, resource_key="normalized-source",
                    mapping_path=self.empty_mapping(root),
                )
            self.assertEqual((output / "manifest.json").read_bytes(), old)

    def test_same_cache_build_is_byte_identical_and_records_parent_child_counts(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            cache = root / "cache"
            first = root / "first"
            second = root / "second"
            cache.mkdir()
            fetched_at = "2026-09-12T01:00:00+07:00"
            resources = []
            fixtures = {
                "generals": [{"id": "g1", "nameZh": "趙雲", "stars": 5, "cost": 7, "category": "軍事", "faction": "SHU", "variant": "base"}],
                "tactics": [{"id": "t1", "nameZh": "一身是膽", "quality": "S", "kind": "主動", "source": "事件", "effectText": "增傷", "troopLimit": [], "maxUsers": 1}],
                "equipment": [{"sourceId": "zhang-ba-she-mao", "nameZh": "丈八蛇矛", "attributes": {"quality": "橙", "slot": "武器"}}],
                "advisors": [{"id": "a1", "nameZh": "仁心得眾", "element": "風", "effectText": "增益", "tacticPoints": 5, "generals": [{"nameZh": "劉備"}]}],
                "troop-mods": [{"sourceId": "da-ji-shi", "nameZh": "大戟士", "attributes": {"effectText": "強化", "troopLimit": ["SPEAR"], "options": [{"tier": "BASIC", "traitName": "持槍", "description": "提升", "convertsTo": None}, {"tier": "ADVANCED", "traitName": "連擊", "description": "連擊", "convertsTo": None}]}, "sourceSeason": {"label": "s", "number": None, "scenarioName": "兵演春秋"}}],
                "buildings": [{"sourceId": "jun-wang-dian", "nameZh": "君王殿", "attributes": {"maxLevel": 2, "mainCityOnly": True, "levels": [{"level": 1, "costs": {"wood": None, "iron": None, "stone": None}, "duration": None, "effect": "一級"}, {"level": 2, "costs": {"wood": 1, "iron": 1, "stone": 1}, "duration": "1小時", "effect": "二級"}]}}],
            }
            for category, records in fixtures.items():
                body = json.dumps(records, ensure_ascii=False, sort_keys=True).encode()
                name = f"{category}-normalized-source.json"
                (cache / name).write_bytes(body)
                resources.append({
                    "category": category,
                    "key": "normalized-source",
                    "url": f"https://sgsdeck.com/{category}",
                    "file": name,
                    "sha256": hashlib.sha256(body).hexdigest(),
                })
            (cache / "manifest.json").write_text(json.dumps({
                "schemaVersion": 1,
                "provider": "sgsdeck",
                "region": "TW",
                "fetchedAt": fetched_at,
                "resources": resources,
            }))

            mapping_path = self.empty_mapping(root)
            build_sgsdeck_catalog.build_from_cache(
                cache, first, resource_key="normalized-source", mapping_path=mapping_path
            )
            build_sgsdeck_catalog.build_from_cache(
                cache, second, resource_key="normalized-source", mapping_path=mapping_path
            )
            for name in [*build_sgsdeck_catalog.CATEGORIES, "manifest"]:
                self.assertEqual((first / f"{name}.json").read_bytes(), (second / f"{name}.json").read_bytes())
            manifest = json.loads((first / "manifest.json").read_text())
            self.assertEqual(manifest["inventory"]["troop-mods"]["childCount"], 2)
            self.assertEqual(manifest["inventory"]["buildings"]["childCount"], 2)


if __name__ == "__main__":
    unittest.main()
