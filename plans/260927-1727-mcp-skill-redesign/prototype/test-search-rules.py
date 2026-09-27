import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('search_rules', Path(__file__).with_name('search-rules.py'))
search = importlib.util.module_from_spec(spec)
spec.loader.exec_module(search)


class RetrievalContract(unittest.TestCase):
    def test_required_survives_unrelated_query_and_limit(self):
        result = search.retrieve('zzzxxyy', 'coexist', limit=1)
        self.assertIn('respect-tactic-locks', {r['id'] for r in result['requiredRules']})
        self.assertTrue(result['abstained'])
        self.assertEqual(result['guidance'], [])

    def test_unknown_condition_is_reported(self):
        result = search.retrieve('mùa', 'coexist')
        self.assertIn({'ruleId': 'verified-season-pair', 'missing': ['seasonal']}, result['unresolvedConditions'])

    def test_true_condition_is_required(self):
        result = search.retrieve('', 'coexist', {'seasonal': True})
        self.assertIn('verified-season-pair', {r['id'] for r in result['requiredRules']})

    def test_false_condition_does_not_apply(self):
        result = search.retrieve('', 'coexist', {'seasonal': False})
        self.assertNotIn('verified-season-pair', {r['id'] for r in result['requiredRules']})
        self.assertFalse(any(r['ruleId'] == 'verified-season-pair' for r in result['unresolvedConditions']))

    def test_workflow_isolation(self):
        result = search.retrieve('khóa chiến pháp', 'lookup')
        self.assertNotIn('respect-tactic-locks', {r['id'] for r in result['requiredRules']})

    def test_vietnamese_without_diacritics(self):
        result = search.retrieve('nhieu hot', 'coexist')
        self.assertEqual(result['guidance'][0]['rule']['id'], 'coexist-priority')

    def test_chinese_query(self):
        result = search.retrieve('装备', 'lookup')
        self.assertEqual(result['guidance'][0]['rule']['id'], 'lookup-six-groups')

    def test_changed_configuration_includes_score_rule(self):
        result = search.retrieve('', 'research', {'configChanged': True})
        self.assertIn('preserve-source-score', {r['id'] for r in result['requiredRules']})

    def test_unknown_context_and_string_boolean_rejected(self):
        for context in ({'seasonal': 'false'}, {'execute': True}):
            with self.assertRaises(ValueError):
                search.retrieve('', 'lookup', context)

    def test_dataset_change_invalidates_version(self):
        original = search.retrieve('nhieu hot', 'coexist')
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'rules.json'
            doc = json.loads(search.DATA.read_text())
            doc['rules'][0]['revision'] += 1
            path.write_text(json.dumps(doc))
            changed = search.retrieve('nhieu hot', 'coexist', path=path)
            self.assertNotEqual(original['knowledgeVersion'], changed['knowledgeVersion'])


if __name__ == '__main__':
    unittest.main()
