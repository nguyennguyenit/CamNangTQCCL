import json
import tempfile
import unittest
from pathlib import Path

from pipeline.build_recommended_reference import build_generation


class BuildRecommendedReferenceTest(unittest.TestCase):
    def test_generation_is_deterministic_ranked_and_selected_atomically(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            scope_key = "s-" + "1" * 64
            records = [
                {"sourceConfigId": "b", "safeScopeKey": scope_key, "tierRaw": "T2", "tierOrder": 1, "value": 72, "listIndex": 1, "heroes": []},
                {"sourceConfigId": "a", "safeScopeKey": scope_key, "tierRaw": "T2", "tierOrder": 1, "value": 82, "listIndex": 0, "heroes": []},
            ]
            inputs = {
                "inventory": {"inventoryHash": "a", "seasonOptions": [{"sourceSeasonId": "s", "label": "S", "status": "available"}], "scopes": [{"safeScopeKey": scope_key, "sourceScopeId": "s|交戰", "state": "complete"}]},
                "records": records,
                "details": {scope_key: list(records)}, "otherTeams": [], "mappingHash": "b", "decisionSnapshotHash": "c", "dedupKeyVersion": 1,
            }
            first = build_generation(inputs, root)
            second = build_generation(inputs, root)
            self.assertEqual(first["generationId"], second["generationId"])
            current = json.loads((root / "current.json").read_text())
            self.assertEqual(current["generationId"], first["generationId"])
            index = json.loads((root / first["generationId"] / "index.json").read_text())
            self.assertEqual([row["sourceConfigId"] for row in index["records"]], ["a", "b"])
            before = (root / "current.json").read_bytes()
            inputs["details"][scope_key] = inputs["details"][scope_key][:-1]
            with self.assertRaisesRegex(ValueError, "membership"):
                build_generation(inputs, root)
            self.assertEqual((root / "current.json").read_bytes(), before)

    def test_incomplete_scope_preserves_last_good_selector(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "current.json").write_text('{"old":true}\n')
            before = (root / "current.json").read_bytes()
            with self.assertRaises(ValueError):
                build_generation({"inventory": {"scopes": [{"state": "blocked"}]}}, root)
            self.assertEqual((root / "current.json").read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
