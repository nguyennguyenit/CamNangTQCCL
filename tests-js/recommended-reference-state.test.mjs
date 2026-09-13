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
  const state = {season:'s28',category:'交戰',query:'',filters:{faction:['魏','蜀'],unit:['騎'],score:[],subcategory:[],source:[]}};
  assert.deepEqual(projectRecommendedRows(rows,state).map(x=>x.sourceConfigId), ['a']);
});

test('Team khác season attribution distinguishes all, unknown and reviewed membership', () => {
  const other = [
    {legacyTeamId:'unknown',legacyVariantId:'v-1',sourceSeasonIds:null,holders:[]},
    {legacyTeamId:'known',legacyVariantId:'v-2',sourceSeasonIds:['s28','s27'],holders:[]},
  ];
  const state = season => ({season,category:'all',query:'',filters:{faction:[],unit:[],score:[],subcategory:[],source:[]}});
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

test('query matches enriched rows by Vietnamese with or without accents and by original Chinese', () => {
  const enriched = [
    {sourceConfigId:'vi',sourceSeasonId:'s28',sourceCategoryId:'交戰',tierOrder:2,listIndex:0,heroes:[
      {nameRaw:'呂布',displayNameVi:'Lữ Bố',tacticSlotsRaw:['神兵天降','暴戾無仁'],tacticSlotsVi:['Thần Binh Thiên Giáng',null],bookSlotsRaw:['破陣'],bookSlotsVi:[null]},
    ]},
    {sourceConfigId:'other',sourceSeasonId:'s28',sourceCategoryId:'交戰',tierOrder:2,listIndex:1,heroes:[
      {nameRaw:'張飛',displayNameVi:'Trương Phi',tacticSlotsRaw:['橫掃千軍'],tacticSlotsVi:[null],bookSlotsRaw:[],bookSlotsVi:[]},
    ]},
  ];
  const state = query => ({season:'s28',category:'交戰',query,filters:{faction:[],unit:[],score:[],subcategory:[],source:[]}});
  const ids = query => projectRecommendedRows(enriched,state(query)).map(row=>row.sourceConfigId);
  assert.deepEqual(ids('Lữ Bố'), ['vi']);
  assert.deepEqual(ids('lu bo'), ['vi']);
  assert.deepEqual(ids('呂布'), ['vi']);
  assert.deepEqual(ids('than binh thien giang'), ['vi']);
  assert.deepEqual(ids('暴戾無仁'), ['vi']);
  assert.deepEqual(ids('truong phi'), ['other']);
});

const scored = [
  {sourceConfigId:'high',sourceSeasonId:'s28',sourceCategoryId:'交戰',tierOrder:1,listIndex:0,value:113,factionRaw:'魏',unitTypesRaw:['騎'],subcategoryRaw:'第一隊',heroes:[]},
  {sourceConfigId:'decimal',sourceSeasonId:'s28',sourceCategoryId:'交戰',tierOrder:1,listIndex:1,value:98.5,factionRaw:'魏',unitTypesRaw:['弓'],subcategoryRaw:'第一隊',heroes:[]},
  {sourceConfigId:'zero',sourceSeasonId:'s28',sourceCategoryId:'交戰',tierOrder:2,listIndex:2,value:0,factionRaw:'群',unitTypesRaw:['騎'],subcategoryRaw:'交戰',heroes:[]},
  {sourceConfigId:'tier-wins',sourceSeasonId:'s28',sourceCategoryId:'交戰',tierOrder:1,listIndex:3,value:1,factionRaw:'群',unitTypesRaw:['騎'],subcategoryRaw:'交戰',heroes:[]},
  {sourceConfigId:'unscored',sourceSeasonId:'s28',sourceCategoryId:'交戰',tierOrder:2,listIndex:4,value:null,factionRaw:'群',unitTypesRaw:['騎'],subcategoryRaw:'交戰',heroes:[]},
];
const scoredState = (extra={}) => ({season:'s28',category:'交戰',query:'',filters:{faction:[],unit:[],score:[],subcategory:[],source:[],...extra}});
const scoredIds = state => projectRecommendedRows(scored,state).map(row=>row.sourceConfigId);

test('score filters by exact source value and keeps 0 distinct from missing', () => {
  assert.deepEqual(scoredIds(scoredState({score:['113']})), ['high']);
  assert.deepEqual(scoredIds(scoredState({score:['98.5']})), ['decimal']);
  assert.deepEqual(scoredIds(scoredState({score:['0']})), ['zero']);
  assert.deepEqual(scoredIds(scoredState({score:['unknown']})), ['unscored']);
  // Repeated values are OR inside the facet and never reorder the fixed source ranking.
  assert.deepEqual(scoredIds(scoredState({score:['unknown','113','0']})), ['high','zero','unscored']);
  // Cross-facet is AND.
  assert.deepEqual(scoredIds(scoredState({score:['113','0'],faction:['魏'],unit:['騎']})), ['high']);
  assert.deepEqual(scoredIds(scoredState({score:['113'],unit:['弓']})), []);
  // Other facets keep working next to score.
  assert.deepEqual(scoredIds(scoredState({score:['0','unknown'],subcategory:['交戰']})), ['zero','unscored']);
  // Tier trước điểm: điểm 1 của Tier 1 vẫn đứng trước điểm 0 của Tier 2.
  assert.deepEqual(scoredIds(scoredState()), ['high','decimal','tier-wins','zero','unscored']);
});

test('score query values canonicalize, de-duplicate and reject ambiguous input with a notice', () => {
  const read = search => readRecommendedQuery(`https://x.test/?season=s28&${search}#team-chuan`, {seasons:['s28']});
  const canonical = read('score=113.0&score=113&score=+113&score=%20113%20&score=unknown');
  assert.deepEqual(canonical.filters.score, ['113','unknown']);
  assert.deepEqual(projectRecommendedRows(scored,{...canonical,category:'交戰'}).map(row=>row.sourceConfigId), ['high','unscored']);

  const rejected = read('score=&score=-5&score=Infinity&score=NaN&score=1e3&score=T1&score=4.5%20sao&score=98.5');
  assert.deepEqual(rejected.filters.score, ['98.5']);
  assert.match(rejected.notices.join(' '), /điểm/i);
  assert.deepEqual(projectRecommendedRows(scored,{...rejected,category:'交戰'}).map(row=>row.sourceConfigId), ['decimal']);

  // Old Tier/star selectors are dropped from the reference query with a notice, never mapped onto score.
  const legacyAliases = read('tier=T1&stars=4.5&sort=score');
  assert.equal(legacyAliases.filters.tier, undefined);
  assert.deepEqual(legacyAliases.filters.score, []);
  assert.match(legacyAliases.notices.join(' '), /không còn áp dụng|sắp xếp/);
  assert.deepEqual(projectRecommendedRows(scored,{...legacyAliases,category:'交戰'}).map(row=>row.sourceConfigId), ['high','decimal','tier-wins','zero','unscored']);
});

test('search reads declared domain fields only and never hashes or source URLs', () => {
  const rows = [
    {
      sourceConfigId:'primary',sourceSeasonId:'s28',sourceCategoryId:'交戰',tierOrder:1,listIndex:0,value:113,
      displayNameVi:'Đội Tiên Phong',nameZh:'先鋒隊',factionRaw:'魏',unitTypesRaw:['騎'],notesRaw:'Mở trận bằng đột kích',
      sourceUrl:'https://sgsdeck.com/recommended/primary',safeScopeKey:`s-${'a'.repeat(64)}`,
      heroes:[{nameRaw:'張遼',displayNameVi:'Trương Liêu',roleRaw:'Chủ tướng',tacticSlotsRaw:['突陣沖鋒'],tacticSlotsVi:['Đột Trận Xung Phong'],bookSlotsRaw:['破陣'],bookSlotsVi:['Phá Trận']}],
      alternativeHoldersRaw:[{nameRaw:'曹操',displayNameVi:'Tào Tháo',tacticSlotsRaw:['奇正相生'],tacticSlotsVi:['Kỳ Chính Tương Sinh'],bookSlotsRaw:[],bookSlotsVi:[]}],
    },
    {
      legacyTeamId:'tmy-counter',sourceSeasonIds:['s28'],sourceCategoryIds:['交戰'],listIndex:1,tierOrder:2,value:null,
      name:'Ngô Cung',faction:'Ngô',unit:['Cung'],legacyContentSha256:'deadbeefcafe',
      holders:[{nameRaw:'Lữ Mông',displayNameVi:'Lữ Mông',tacticSlotsRaw:['Đương Phong Thôi Quyết'],bookSlotsRaw:['Văn Thao']}],
      legacyContent:{name:'Ngô Cung',nickname:'Ngô Cung Kinh Điển',notes:'Đội cung Ngô tiêu chuẩn',counters:{good:['team TMY'],avoid:['Hổ Thần Cung']},
        heroes:[{name:'Lữ Mông',baseName:'Lữ Mông',tactics:[{name:'Đương Phong Thôi Quyết',alternatives:['Binh Vô Thường Thế']}],books:[{name:'Văn Thao',alternatives:[]}],alternatives:['SP Lữ Mông']}]},
    },
  ];
  const labels={faction:{魏:'Ngụy'},unit:{騎:'Kỵ'}};
  const ids = query => projectRecommendedRows(rows,{season:'s28',category:'all',query,filters:{}},labels).map(row=>row.sourceConfigId || row.legacyTeamId);
  assert.deepEqual(ids('nguy ky'), ['primary']);
  assert.deepEqual(ids('先鋒隊'), ['primary']);
  assert.deepEqual(ids('truong lieu'), ['primary']);
  assert.deepEqual(ids('Đột Trận Xung Phong'), ['primary']);
  assert.deepEqual(ids('pha tran'), ['primary']);
  assert.deepEqual(ids('tao thao'), ['primary']);
  assert.deepEqual(ids('dot kich'), ['primary']);
  // Counter-only terms match the legacy team without dropping it from broader results.
  assert.deepEqual(ids('team TMY'), ['tmy-counter']);
  assert.deepEqual(ids('ho than cung'), ['tmy-counter']);
  assert.deepEqual(ids('binh vo thuong the'), ['tmy-counter']);
  assert.deepEqual(ids('ngo cung kinh dien'), ['tmy-counter']);
  // Fingerprints, scope keys and source URLs are not searchable text.
  assert.deepEqual(ids('deadbeef'), []);
  assert.deepEqual(ids('sgsdeck.com'), []);
  assert.deepEqual(ids('aaaaaaaa'), []);
});
