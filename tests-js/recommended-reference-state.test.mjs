import test from 'node:test';
import assert from 'node:assert/strict';
import { projectRecommendedRows, readRecommendedQuery, resolveTeamDestination, validateReferenceSourceUrl } from '../js/recommended-reference-state.js';

const rows = [
  {sourceConfigId:'b',sourceSeasonId:'s28',sourceCategoryId:'交戰',tierRaw:'T2',tierOrder:2,value:72,listIndex:1,factionRaw:'群',unitTypesRaw:['弓'],subcategoryRaw:'交戰',heroes:[]},
  {sourceConfigId:'a',sourceSeasonId:'s28',sourceCategoryId:'交戰',tierRaw:'T2',tierOrder:2,value:82,listIndex:0,factionRaw:'魏',unitTypesRaw:['騎'],subcategoryRaw:'第一隊',heroes:[]},
];

test('query rejects duplicate scalars and unsupported sorting without changing fixed order', () => {
  const state = readRecommendedQuery('https://x.test/?season=s28&season=s1&sort=score#team-chuan', {seasons:['s28']});
  assert.equal(state.season, 's28');
  assert.match(state.notices.join(' '), /lặp|sắp xếp/);
  assert.deepEqual(projectRecommendedRows(rows, {...state, season:'s28'}).map(x=>x.sourceConfigId), ['a','b']);
});

test('facets are OR within key and AND across keys', () => {
  const state = {season:'s28',category:'交戰',query:'',filters:{faction:['魏','蜀'],unit:['騎'],tier:[],subcategory:[],source:[]}};
  assert.deepEqual(projectRecommendedRows(rows,state).map(x=>x.sourceConfigId), ['a']);
});

test('Team khác season attribution distinguishes all, unknown and reviewed membership', () => {
  const other = [
    {legacyTeamId:'unknown',legacyVariantId:'v-1',sourceSeasonIds:null,holders:[]},
    {legacyTeamId:'known',legacyVariantId:'v-2',sourceSeasonIds:['s28','s27'],holders:[]},
  ];
  const state = season => ({season,category:'all',query:'',filters:{faction:[],unit:[],tier:[],subcategory:[],source:[]}});
  assert.deepEqual(projectRecommendedRows(other,state('all')).map(row=>row.legacyTeamId), ['unknown','known']);
  assert.deepEqual(projectRecommendedRows(other,state('unknown')).map(row=>row.legacyTeamId), ['unknown']);
  assert.deepEqual(projectRecommendedRows(other,state('s28')).map(row=>row.legacyTeamId), ['known']);
});

test('legacy aliases preserve exact original destination', () => {
  assert.deepEqual(resolveTeamDestination({legacyTeamId:'team-intro-0'}), {kind:'legacy',legacyTeamId:'team-intro-0'});
  assert.deepEqual(resolveTeamDestination({sourceConfigId:'abc',safeScopeKey:'s-'+ '1'.repeat(64)}), {kind:'recommended',sourceConfigId:'abc',scopeKey:'s-'+ '1'.repeat(64)});
});

test('source URL policy rejects wrong hosts and credentials', () => {
  assert.equal(validateReferenceSourceUrl('recommended',{sourceConfigId:'abc'},'https://sgsdeck.com/recommended/abc'), 'https://sgsdeck.com/recommended/abc');
  assert.equal(validateReferenceSourceUrl('recommended',{sourceConfigId:'abc'},'https://evil.test/recommended/abc'), null);
  assert.equal(validateReferenceSourceUrl('recommended',{sourceConfigId:'呂布'},'https://sgsdeck.com/recommended/%E5%91%82%E5%B8%83'), 'https://sgsdeck.com/recommended/%E5%91%82%E5%B8%83');
  assert.equal(validateReferenceSourceUrl('other',{},'javascript:alert(1)'), null);
});
