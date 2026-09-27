import json
import tempfile
import unittest
from pathlib import Path

from pipeline.crawl_sgsdeck_recommended import SafeRecommendedRedirect, crawl_scope, discover_scopes, main, safe_scope_key
FIXTURE = Path(__file__).parent / "fixtures/sgsdeck-recommended/source-season-picker.html"


class CrawlRecommendedTest(unittest.TestCase):
    def test_discovery_freezes_all_source_seasons_and_categories(self):
        inventory = discover_scopes(FIXTURE.read_text())
        self.assertEqual(len(inventory["seasonOptions"]), 29)
        self.assertEqual(inventory["seasonOptions"][0]["sourceSeasonId"], "og-兵演春秋")
        self.assertEqual(inventory["seasonOptions"][1]["sourceSeasonId"], "pk-s28")
        self.assertEqual({scope["sourceCategoryId"] for scope in inventory["scopes"]}, {"開荒", "交戰", "器械"})
        self.assertEqual(len({scope["safeScopeKey"] for scope in inventory["scopes"]}), len(inventory["scopes"]))

    def test_safe_scope_key_is_stable_and_path_safe(self):
        first = safe_scope_key("pk-s28", "交戰")
        self.assertEqual(first, safe_scope_key("pk-s28", "交戰"))
        self.assertRegex(first, r"^s-[0-9a-f]{64}$")
        self.assertNotEqual(first, safe_scope_key("pk-s28", "器械"))

    def test_redirect_is_rejected_before_request_creation(self):
        with self.assertRaises(ValueError):
            SafeRecommendedRedirect().redirect_request(None, None, 302, "Found", {}, "https://example.com/recommended/x")

    def test_resume_is_bound_to_frozen_inventory(self):
        inventory = discover_scopes(FIXTURE.read_text())
        with tempfile.TemporaryDirectory() as directory:
            Path(directory, "manifest.json").write_text(json.dumps({"inventoryHash": "sha256:wrong", "pages": {}, "scopes": []}))
            with self.assertRaisesRegex(ValueError, "inventory changed"):
                crawl_scope(inventory, directory, inventory["scopes"][0], minimum_interval=0)

    def test_freeze_inventory_writes_discovered_scopes(self):
        with tempfile.TemporaryDirectory() as directory:
            main(["--cache", directory, "--freeze-inventory", str(FIXTURE)])
            written = json.loads(Path(directory, "scope-inventory.json").read_text(encoding="utf-8"))
        self.assertEqual(written, discover_scopes(FIXTURE.read_text()))

    def test_crawl_without_frozen_inventory_explains_freeze_step(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(SystemExit, "--freeze-inventory"):
                main(["--cache", directory, "--all-source-scopes"])
            self.assertFalse(Path(directory, "scope-inventory.json").exists())


if __name__ == "__main__":
    unittest.main()
