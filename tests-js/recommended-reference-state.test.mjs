import test from 'node:test';
import assert from 'node:assert/strict';
import { projectRecommendedRows, readRecommendedQuery, validateHttpSourceUrl } from '../js/recommended-reference-state.js';

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
  const state = {season:'s28',query:'',filters:{faction:['魏','蜀'],unit:['騎'],subcategory:[],source:[]}};
  assert.deepEqual(projectRecommendedRows(rows,state).map(x=>x.sourceConfigId), ['a']);
});

test('Team khác season attribution distinguishes all, unknown and reviewed membership', () => {
  const other = [
    {legacyTeamId:'unknown',legacyVariantId:'v-1',sourceSeasonIds:null,holders:[]},
    {legacyTeamId:'known',legacyVariantId:'v-2',sourceSeasonIds:['s28','s27'],holders:[]},
  ];
  const state = season => ({season,query:'',filters:{faction:[],unit:[],subcategory:[],source:[]}});
  assert.deepEqual(projectRecommendedRows(other,state('all')).map(row=>row.legacyTeamId), ['unknown','known']);
  assert.deepEqual(projectRecommendedRows(other,state('unknown')).map(row=>row.legacyTeamId), ['unknown']);
  assert.deepEqual(projectRecommendedRows(other,state('s28')).map(row=>row.legacyTeamId), ['known']);
});

test('view chọn chế độ Thẻ/Bảng: chỉ nhận giá trị hợp lệ, giá trị lạ kèm thông báo', () => {
  const read = search => readRecommendedQuery(`https://x.test/?season=s28${search}#team-chuan`, {seasons:['s28']});
  assert.equal(read('').view, null);
  assert.equal(read('&view=bang').view, 'bang');
  assert.equal(read('&view=the').view, 'the');
  const invalid = read('&view=cards');
  assert.equal(invalid.view, null);
  assert.match(invalid.notices.join(' '), /hiển thị/);
  const duplicated = read('&view=bang&view=the');
  assert.equal(duplicated.view, 'bang');
  assert.match(duplicated.notices.join(' '), /view bị lặp/);
});

test('khóa đã nghỉ `score` và `category` không còn lọc gì', () => {
  const state = readRecommendedQuery(`https://x.test/?season=s28&score=113&score=unknown&category=${encodeURIComponent('器械')}#team-chuan`, {seasons:['s28']});
  assert.equal(Object.hasOwn(state.filters,'score'),false);
  assert.equal(Object.hasOwn(state,'category'),false);
  // Cả hai hàng thuộc danh mục 交戰: `category=器械` cũ không được thu hẹp danh sách.
  assert.deepEqual(projectRecommendedRows(rows,state).map(x=>x.sourceConfigId), ['a','b']);
});

test('shared http(s) source check keeps links honest for every family', () => {
  // Đội khác và Khai hoang dẫn link nguồn: phải là URL tuyệt đối http(s).
  assert.equal(validateHttpSourceUrl('https://kazten.com/entry/2025/11/20/180000'), 'https://kazten.com/entry/2025/11/20/180000');
  assert.equal(validateHttpSourceUrl('http://example.test/a'), 'http://example.test/a');
  for (const unsafe of [
    'javascript:alert(1)', 'data:text/html,<script>1</script>', 'file:///etc/passwd', '//evil.test/x',
    '/relative/path', 'https://user:pass@example.test/x',
    'https://example.test/a\u0000b', '', null, undefined, 42,
  ]) {
    assert.equal(validateHttpSourceUrl(unsafe), null, `${String(unsafe)} phải bị từ chối`);
  }
  // Fragment của URL nguồn thật (ví dụ #gid= của Google Sheets) vẫn giữ nguyên.
  assert.equal(validateHttpSourceUrl('https://docs.google.com/spreadsheets/d/x/edit#gid=1'), 'https://docs.google.com/spreadsheets/d/x/edit#gid=1');
});

test('query matches enriched rows by Vietnamese with or without accents and by original Chinese', () => {
  const enriched = [
    {sourceConfigId:'vi',sourceSeasonId:'s28',sourceCategoryId:'交戰',tierOrder:2,listIndex:0,heroes:[
      {nameRaw:'呂布',displayNameVi:'Lữ Bố',statFocusRaw:'全武',statFocusVi:'Toàn Võ Lực',tacticSlotsRaw:['神兵天降','暴戾無仁'],tacticSlotsVi:['Thần Binh Thiên Giáng',null],bookSlotsRaw:['破陣'],bookSlotsVi:[null]},
    ]},
    {sourceConfigId:'notes',sourceSeasonId:'s28',sourceCategoryId:'交戰',tierOrder:2,listIndex:2,heroes:[],
      displayNotes:{blocks:[{textRaw:'害怕五謀臣與麒麟',textVi:'Sợ Ngũ Mưu Thần và Kỳ Lân'}]}},
    {sourceConfigId:'other',sourceSeasonId:'s28',sourceCategoryId:'交戰',tierOrder:2,listIndex:1,heroes:[
      {nameRaw:'張飛',displayNameVi:'Trương Phi',tacticSlotsRaw:['橫掃千軍'],tacticSlotsVi:[null],bookSlotsRaw:[],bookSlotsVi:[]},
    ]},
  ];
  const state = query => ({season:'s28',query,filters:{faction:[],unit:[],subcategory:[],source:[]}});
  const ids = query => projectRecommendedRows(enriched,state(query)).map(row=>row.sourceConfigId);
  assert.deepEqual(ids('Lữ Bố'), ['vi']);
  assert.deepEqual(ids('lu bo'), ['vi']);
  assert.deepEqual(ids('呂布'), ['vi']);
  assert.deepEqual(ids('than binh thien giang'), ['vi']);
  assert.deepEqual(ids('暴戾無仁'), ['vi']);
  assert.deepEqual(ids('toan vo luc'), ['vi']);
  assert.deepEqual(ids('truong phi'), ['other']);
  assert.deepEqual(ids('ngu muu than ky lan'), ['notes']);
  assert.deepEqual(ids('五謀臣'), ['notes']);
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
  const ids = query => projectRecommendedRows(rows,{season:'s28',query,filters:{}},labels).map(row=>row.sourceConfigId || row.legacyTeamId);
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


test('source Tier facets preserve repeated selections and sort before source score', () => {
  const ranked = [
    {...rows[0], sourceConfigId:'t1', tierRaw:'T1', tierOrder:2, value:150},
    {...rows[1], sourceConfigId:'t0', tierRaw:'T0', tierOrder:0, value:100},
    {...rows[0], sourceConfigId:'unranked', tierRaw:null, tierOrder:999},
  ];
  const state=readRecommendedQuery('https://x.test/?season=s28&tier=T1&tier=T0&tier=T1');
  assert.deepEqual(state.filters.tier,['T1','T0']);
  assert.deepEqual(state.notices,[]);
  assert.deepEqual(projectRecommendedRows(ranked,state).map(row=>row.sourceConfigId),['t0','t1']);
  assert.deepEqual(projectRecommendedRows(ranked,{...state,filters:{tier:['T1'],faction:['魏']}}),[]);
});


test('legacy teams ignore source Tier selectors and never borrow historical tiers', () => {
  const state=readRecommendedQuery('https://x.test/doi-khac/?tier=T0');
  assert.deepEqual(state.filters.tier,[]);
  assert.match(state.notices.join(' '),/không còn áp dụng/);
  const legacy=[{legacyTeamId:'legacy',historicalTier:'T0'}];
  assert.deepEqual(projectRecommendedRows(legacy,state),legacy);
  assert.deepEqual(projectRecommendedRows(legacy,{...state,filters:{tier:['T0']}}),[]);
});
