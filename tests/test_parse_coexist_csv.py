"""Pinned real-source parser regression: boundaries, options and preservation."""
import copy
import csv
import io
from pathlib import Path
import unittest
from pipeline.parse_coexist_csv import parse_coexist_csv

SNAPSHOT=Path(__file__).resolve().parents[1]/'plans/260907-0233-season-team-lookup/research/coexist-binh-dien-xuan-thu.csv'
HASH='sha256:838c9b639d42aef67d270a8813edd13bf0b364efaa85ae80e1fa8efda9b829bb'


def csv_text(rows):
    stream=io.StringIO(newline='');csv.writer(stream).writerows(rows);return stream.getvalue()


class ParseCoexistCSVTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.raw=SNAPSHOT.read_bytes().decode('utf-8')
        cls.rows=list(csv.reader(io.StringIO(cls.raw,newline='')))

    def test_real_snapshot_has_exact_inventory(self):
        parsed=parse_coexist_csv(self.raw,expected_hash=HASH)
        self.assertEqual(len(parsed['groups']),5)
        self.assertEqual(sum(len(group['teams']) for group in parsed['groups']),25)
        self.assertTrue(all(len(team['heroes'])==3 for group in parsed['groups'] for team in group['teams']))
        self.assertIn('chỉ mang tính chất tham khảo',parsed['disclaimerRaw'])

    def test_multiline_notes_effects_and_options_preserved(self):
        parsed=parse_coexist_csv(self.raw)
        first=parsed['groups'][0]
        self.assertIn('[Pháp Mã Khác]\nPháp Chính',first['openingSuggestionsRaw'])
        self.assertIn('Ghi chú',first['notesRaw']);self.assertIn('Tiến cử chủ lực',first['notesRaw'])
        self.assertEqual(first['teams'][0]['teamNameRaw'],'Hoàng Mã Thương\n19C')
        self.assertEqual(first['teams'][0]['heroes'][2]['nameRaw'],'Hứa Du\n(Thương S)')
        self.assertEqual(parsed['groups'][1]['teams'][2]['unitTacticEffectsRaw'],'')
        merged=parsed['groups'][3]['teams'][3]
        self.assertIn('/\n',merged['unitTacticEffectsRaw'])
        self.assertIn('Tinh·Hổ Báo Kỵ',merged['heroes'][0]['tacticSlotsRaw'][1])
        self.assertEqual(len(merged['heroes'][0]['bookSlotsRaw']),3)
        self.assertNotIn('advisorSkill',merged)

    def test_locator_counts_csv_records_and_physical_lines(self):
        first=parse_coexist_csv(self.raw)['groups'][0]['teams'][0]['sourceLocator']
        self.assertEqual(first,dict(csvRecordStart=6,csvRecordEnd=8,lineStart=6,lineEnd=23))

    def test_header_column_drift_reorder_or_missing_reject(self):
        for mode in ('rename','remove','reorder'):
            rows=copy.deepcopy(self.rows)
            if mode=='rename':rows[4][9]='Quân Sư'
            if mode=='remove':rows[4].pop()
            if mode=='reorder':rows[4][2],rows[4][5]=rows[4][5],rows[4][2]
            with self.subTest(mode=mode),self.assertRaises(ValueError):parse_coexist_csv(csv_text(rows))

    def test_orphan_truncated_and_interrupted_hero_blocks_reject(self):
        for mode in ('orphan','truncated','interrupted','extra'):
            rows=copy.deepcopy(self.rows)
            if mode=='orphan':rows[5][1]=''
            if mode=='truncated':rows.pop()
            if mode=='interrupted':rows.insert(6,['']*10)
            if mode=='extra':rows.insert(8,copy.deepcopy(rows[7]))
            with self.subTest(mode=mode),self.assertRaises(ValueError):parse_coexist_csv(csv_text(rows))

    def test_hash_mismatch_and_login_html_reject(self):
        with self.assertRaises(ValueError):parse_coexist_csv(self.raw,expected_hash='sha256:'+'0'*64)
        with self.assertRaises(ValueError):parse_coexist_csv('<html>Please log in</html>')

    def test_malformed_csv_is_domain_error(self):
        with self.assertRaises(ValueError):parse_coexist_csv('"unterminated')

    def test_blank_ordered_slots_remain_blank(self):
        rows=copy.deepcopy(self.rows);rows[5][3]='';rows[5][7]=''
        parsed=parse_coexist_csv(csv_text(rows))
        hero=parsed['groups'][0]['teams'][0]['heroes'][0]
        self.assertEqual(hero['tacticSlotsRaw'][0],'');self.assertEqual(hero['bookSlotsRaw'][1],'')

    def test_unproven_continuation_effect_ownership_rejects(self):
        rows=copy.deepcopy(self.rows);rows[6][9]='Another holder effect'
        with self.assertRaises(ValueError):parse_coexist_csv(csv_text(rows))


class CoexistIdentityTest(unittest.TestCase):
    def setUp(self):
        import json
        self.raw=SNAPSHOT.read_bytes().decode('utf-8')
        root=SNAPSHOT.parents[3]
        self.mapping=json.loads((root/'pipeline/coexist-source-record-map.json').read_text())
        self.links=json.loads((root/'pipeline/season-content-links.json').read_text())[:5]
        self.source=copy.deepcopy(self.links[0]['target']['source'])
        self.options=dict(scenario_id='binh-dien-xuan-thu',evidence_refs=['coexist-binh-dien-scenario-confirmation','coexist-binh-dien-source-snapshot'])

    def build(self,raw=None,mapping=None):
        from pipeline.parse_coexist_csv import build_content_links
        return build_content_links(self.raw if raw is None else raw,self.mapping if mapping is None else mapping,self.source,**self.options)

    def test_reviewed_map_reproduces_source_links_byte_for_byte(self):
        self.assertEqual(self.build(),self.links)
        self.assertEqual(self.build(),self.build())

    def test_reordered_groups_keep_record_and_team_ids(self):
        import hashlib
        rows=list(csv.reader(io.StringIO(self.raw,newline='')))
        starts=[index for index,row in enumerate(rows) if row[0].startswith('Cùng tồn ')]
        sections=[rows[start:end] for start,end in zip(starts,starts[1:]+[len(rows)])]
        reordered=csv_text(rows[:starts[0]]+[row for section in reversed(sections) for row in section])
        self.source['snapshotHash']='sha256:'+hashlib.sha256(reordered.encode()).hexdigest()
        result=self.build(reordered)
        self.assertEqual([link['recordId'] for link in result],list(reversed([link['recordId'] for link in self.links])))
        self.assertEqual({team['recordId'] for link in result for team in link['target']['payload']['teams']},{team['recordId'] for link in self.links for team in link['target']['payload']['teams']})

    def test_edited_content_and_ambiguous_maps_require_new_review(self):
        import hashlib
        changed=self.raw.replace('Hoàng Mã Thương','Changed source title',1)
        self.source['snapshotHash']='sha256:'+hashlib.sha256(changed.encode()).hexdigest()
        with self.assertRaises(ValueError):self.build(changed)
        self.source['snapshotHash']=HASH
        self.mapping['groups'].append(copy.deepcopy(self.mapping['groups'][0]))
        with self.assertRaises(ValueError):self.build()
