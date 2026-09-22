import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TEAM_RETURN_STORAGE_KEY,
  teamDetailPath,
  teamDetailHref,
  safeReturnUrl,
  familyReturnHref,
  returnHrefFor,
  isNativeNavigationClick,
  captureReturnSnapshot,
  matchesReturnSnapshot,
  writeReturnSnapshot,
  readReturnSnapshot,
  clearReturnSnapshot,
  migrateLegacyReferenceUrl,
  setTeamRouteHandles,
  setTeamRouteHandlesFromJSON,
} from '../js/team-detail-navigation.js';

const ROOT='https://tqccl.pages.dev';
const RECOMMENDED='team-epoddo';
const LEGACY='team-intro-4';
const RECOMMENDED_SEGMENT='pk-s24-tiem-long-dieu-thuyen';
const LEGACY_SEGMENT='tan-ngo-thuong';

const handles=()=>setTeamRouteHandles({
  r:{[RECOMMENDED]:RECOMMENDED_SEGMENT},
  l:{[LEGACY]:LEGACY_SEGMENT},
});
const empty=()=>setTeamRouteHandles({});

function memoryStorage({failGet=false,failSet=false}={}) {
  const map=new Map();
  return {
    getItem(key){ if (failGet) throw new Error('denied'); return map.has(key)?map.get(key):null; },
    setItem(key,value){ if (failSet) throw new Error('quota'); map.set(key,String(value)); },
    removeItem(key){ map.delete(key); },
    map,
  };
}

test('the route-handle registry is uninitialised until a caller registers one',async()=>{
  // A fresh module instance proves the shipped default is "no registry", never an old ID path.
  const fresh=await import(new URL('../js/team-detail-navigation.js?uninitialised',import.meta.url).href);
  assert.equal(typeof fresh.setTeamRouteHandles,'function');
  assert.equal(fresh.teamDetailPath({sourceConfigId:RECOMMENDED}),null);
  assert.equal(fresh.teamDetailPath({legacyTeamId:LEGACY}),null);
  assert.equal(fresh.teamDetailHref({sourceConfigId:RECOMMENDED}),null);
  assert.equal(fresh.migrateLegacyReferenceUrl(`${ROOT}/?detail=${RECOMMENDED}#team-chuan`,{
    hasRecommended:id=>id===RECOMMENDED,
    hasLegacy:id=>id===LEGACY,
  }),null);
});

test('detail hrefs come from the registered final segments and carry only identity plus a safe origin',()=>{
  assert.equal(handles(),true);
  assert.equal(teamDetailPath({sourceConfigId:RECOMMENDED}),`/doi-chuan/${RECOMMENDED_SEGMENT}/`);
  assert.equal(teamDetailPath({legacyTeamId:LEGACY}),`/doi-khac/${LEGACY_SEGMENT}/`);
  // Identity always beats a stray variant, and an unregistered identity never falls back to an ID path.
  assert.equal(teamDetailPath({sourceConfigId:RECOMMENDED,legacyTeamId:LEGACY}),`/doi-chuan/${RECOMMENDED_SEGMENT}/`);
  assert.equal(teamDetailPath({sourceConfigId:'team-missing'}),null);
  assert.equal(teamDetailPath({legacyTeamId:'team-missing'}),null);
  assert.equal(teamDetailPath({}),null);
  assert.equal(teamDetailPath({legacyTeamId:'../secret'}),null);

  assert.equal(
    teamDetailHref({legacyTeamId:LEGACY,legacyVariantId:'v-'+'a'.repeat(64)}),
    `/doi-khac/${LEGACY_SEGMENT}/?variant=v-${'a'.repeat(64)}`,
  );
  assert.equal(teamDetailHref({legacyTeamId:LEGACY,legacyVariantId:''}),`/doi-khac/${LEGACY_SEGMENT}/?variant=`);
  assert.equal(teamDetailHref({legacyTeamId:LEGACY,legacyVariantId:'/bad'}),`/doi-khac/${LEGACY_SEGMENT}/?variant=%2Fbad`);
  assert.equal(
    teamDetailHref({sourceConfigId:RECOMMENDED},{from:'/?season=pk-s24&q=quan#team-chuan'}),
    `/doi-chuan/${RECOMMENDED_SEGMENT}/?from=${encodeURIComponent('/?season=pk-s24&q=quan#team-chuan')}`,
  );
  // An unsafe origin is dropped instead of being propagated into the detail URL.
  assert.equal(teamDetailHref({sourceConfigId:RECOMMENDED},{from:'https://evil.example/'}),`/doi-chuan/${RECOMMENDED_SEGMENT}/`);
  // A registered identity without a handle is still not routable.
  assert.equal(teamDetailHref({sourceConfigId:'team-missing'},{from:'/?q=a#team-chuan'}),null);

  // Non-ASCII segments stay encoded in the emitted href.
  assert.equal(setTeamRouteHandles({r:{'yxms-049':'pk-s24-仙人盾'}}),true);
  assert.equal(teamDetailPath({sourceConfigId:'yxms-049'}),`/doi-chuan/${encodeURIComponent('pk-s24-仙人盾')}/`);
});

test('the registry replaces atomically and refuses malformed payloads',()=>{
  assert.equal(handles(),true);

  const malformed=[
    null,
    undefined,
    7,
    'r',
    [],
    new Date(0),
    new Map(),
    {l:new Date(0)},
    {r:new Map()},
    {l:new(class RouteFamily {})()},
    {x:{}},
    {r:[]},
    {r:null},
    {r:{'../secret':'ok'}},
    {r:{'':'ok'}},
    {r:{'team-epoddo':'/escape'}},
    {r:{'team-epoddo':'trail.'}},
    {r:{'team-epoddo':'inner space'}},
    {r:{'team-epoddo':7}},
    {r:{a:'same',b:'same'}},
    {r:{'team-epoddo':RECOMMENDED_SEGMENT},'l':{'team-intro-4':LEGACY_SEGMENT},extra:{}},
  ];
  for (const payload of malformed) {
    assert.equal(setTeamRouteHandles(payload),false,`must reject ${JSON.stringify(payload)}`);
  }
  // A rejected payload leaves the previous registry fully intact.
  assert.equal(teamDetailPath({sourceConfigId:RECOMMENDED}),`/doi-chuan/${RECOMMENDED_SEGMENT}/`);
  assert.equal(teamDetailPath({legacyTeamId:LEGACY}),`/doi-khac/${LEGACY_SEGMENT}/`);

  // An empty family object is a valid registration that contains nothing.
  assert.equal(setTeamRouteHandles({l:{}}),true);
  assert.equal(teamDetailPath({legacyTeamId:LEGACY}),null);
  assert.equal(teamDetailPath({sourceConfigId:RECOMMENDED}),null);

  // A valid payload replaces instead of merging, and a partial payload only owns its own family.
  assert.equal(setTeamRouteHandles({l:{'team-intro-9':'hoang-ma-thuong'}}),true);
  assert.equal(teamDetailPath({legacyTeamId:'team-intro-9'}),'/doi-khac/hoang-ma-thuong/');
  assert.equal(teamDetailPath({legacyTeamId:LEGACY}),null);
  assert.equal(teamDetailPath({sourceConfigId:RECOMMENDED}),null);
});

test('the embedded JSON payload is parsed defensively before it can replace the registry',()=>{
  assert.equal(handles(),true);

  for (const raw of ['',null,undefined,'{not json','[]','null','"r"',JSON.stringify({r:{'team-epoddo':'ok'},l:{'team-intro-4':'ok'},x:{}})]) {
    assert.equal(setTeamRouteHandlesFromJSON(raw),false,`must reject ${String(raw)}`);
  }
  assert.equal(teamDetailPath({sourceConfigId:RECOMMENDED}),`/doi-chuan/${RECOMMENDED_SEGMENT}/`);

  // The detail-page payload carries only the legacy family.
  assert.equal(setTeamRouteHandlesFromJSON(JSON.stringify({l:{[LEGACY]:LEGACY_SEGMENT}})),true);
  assert.equal(teamDetailPath({legacyTeamId:LEGACY}),`/doi-khac/${LEGACY_SEGMENT}/`);
  assert.equal(teamDetailPath({sourceConfigId:RECOMMENDED}),null);

  // The root payload carries both families.
  assert.equal(setTeamRouteHandlesFromJSON(JSON.stringify({r:{[RECOMMENDED]:RECOMMENDED_SEGMENT},l:{[LEGACY]:LEGACY_SEGMENT}})),true);
  assert.equal(teamDetailPath({legacyTeamId:LEGACY}),`/doi-khac/${LEGACY_SEGMENT}/`);
  assert.equal(teamDetailPath({sourceConfigId:RECOMMENDED}),`/doi-chuan/${RECOMMENDED_SEGMENT}/`);
});

test('return origin accepts normalized root state and rejects foreign or looping targets',()=>{
  assert.equal(safeReturnUrl('/'),'/');
  assert.equal(safeReturnUrl('/#team-khac'),'/#team-khac');
  assert.equal(safeReturnUrl('/?season=pk-s24&category=交戰#team-chuan'),`/?season=pk-s24&category=${encodeURIComponent('交戰')}#team-chuan`);
  assert.equal(safeReturnUrl('/?faction=Thục&faction=Ngô&q=vien#team-khac'),`/?faction=${encodeURIComponent('Thục')}&faction=${encodeURIComponent('Ngô')}&q=vien#team-khac`);
  // Điểm nguồn là selector của Team chuẩn nên phải sống sót vòng list → detail → quay lại.
  assert.equal(safeReturnUrl('/?season=pk-s24&score=113&score=unknown#team-chuan'),'/?season=pk-s24&score=113&score=unknown#team-chuan');
  // Absolute URLs are accepted only for the page's own origin.
  assert.equal(safeReturnUrl(`${ROOT}/?q=a#team-chuan`,{origin:ROOT}),'/?q=a#team-chuan');
  assert.equal(safeReturnUrl('https://evil.example/',{origin:ROOT}),null);
  assert.equal(safeReturnUrl(`${ROOT}/?q=a#team-chuan`),null);

  // Loop selectors are dropped, never carried back into the detail page.
  assert.equal(safeReturnUrl('/?detail=team-epoddo&q=a#team-chuan'),'/?q=a#team-chuan');
  assert.equal(safeReturnUrl('/?legacyTeam=team-intro-4&legacyVariant=v1&from=%2F#team-khac'),'/#team-khac');

  for (const hostile of [
    'https://evil.example/',
    '//evil.example/',
    '/\\evil.example',
    'javascript:alert(1)',
    'data:text/html,<script>',
    '/doi-khac/tan-ngo-thuong/',
    '/%2e%2e/admin',
    '/..%2fadmin',
    '/?q=a#unknown-tab',
    '/?rogue=1#team-chuan',
    '/?q=a\u0000b',
    'not a url',
    '',
    null,
    undefined,
    123,
  ]) {
    assert.equal(safeReturnUrl(hostile),null,`must reject ${String(hostile)}`);
  }
  // Malformed percent escapes are rejected, not thrown.
  assert.doesNotThrow(()=>safeReturnUrl('/?q=%E0%A4%A#team-chuan'));
  assert.doesNotThrow(()=>safeReturnUrl('/%E0%A4%A'));
  assert.equal(safeReturnUrl('/%E0%A4%A'),null);
});

test('a share link without origin still returns to the right family scope',()=>{
  assert.equal(familyReturnHref('recommended'),'/#team-chuan');
  assert.equal(familyReturnHref('legacy'),'/#team-khac');
  assert.equal(
    familyReturnHref('recommended',{sourceSeasonId:'pk-s24',sourceCategoryId:'交戰'}),
    `/?season=pk-s24&category=${encodeURIComponent('交戰')}#team-chuan`,
  );
  assert.equal(familyReturnHref('recommended',{sourceSeasonId:'all',sourceCategoryId:'all'}),'/#team-chuan');
  assert.equal(returnHrefFor('recommended',{from:'/?q=a#team-chuan'}),'/?q=a#team-chuan');
  assert.equal(returnHrefFor('recommended',{from:'https://evil.example/',sourceSeasonId:'pk-s24'}),'/?season=pk-s24#team-chuan');
  assert.equal(returnHrefFor('legacy',{}),'/#team-khac');
});

test('only unmodified primary clicks may record a return snapshot',()=>{
  assert.equal(isNativeNavigationClick({button:0}),true);
  assert.equal(isNativeNavigationClick({button:1}),false);
  assert.equal(isNativeNavigationClick({button:0,metaKey:true}),false);
  assert.equal(isNativeNavigationClick({button:0,ctrlKey:true}),false);
  assert.equal(isNativeNavigationClick({button:0,shiftKey:true}),false);
  assert.equal(isNativeNavigationClick({button:0,altKey:true}),false);
  assert.equal(isNativeNavigationClick({button:0,defaultPrevented:true}),false);
  assert.equal(isNativeNavigationClick(null),false);
});

test('return snapshots keep UI state only and match one exact root URL',()=>{
  const snapshot=captureReturnSnapshot({href:'/?q=vien&season=pk-s24#team-chuan',scrollY:842.6,tab:'team-chuan',disclosures:{filters:true,score:true,alternatives:['cfg-1','cfg-2','cfg-1'],seasons:false}});
  assert.equal(snapshot.version,1);
  assert.equal(snapshot.url,'/?q=vien&season=pk-s24#team-chuan');
  assert.equal(snapshot.scrollY,843);
  assert.deepEqual(snapshot.disclosures,{filters:true,score:true,alternatives:['cfg-1','cfg-2']});
  assert.equal(matchesReturnSnapshot(snapshot,'/?q=vien&season=pk-s24#team-chuan'),true);
  assert.equal(matchesReturnSnapshot(snapshot,`${ROOT}/?q=vien&season=pk-s24#team-chuan`,{origin:ROOT}),true);
  assert.equal(matchesReturnSnapshot(snapshot,'/?q=vien#team-chuan'),false);
  assert.equal(matchesReturnSnapshot(snapshot,'/#team-chuan'),false);
  assert.equal(matchesReturnSnapshot({version:0,url:'/'},'/'),false);

  assert.equal(captureReturnSnapshot({href:'https://evil.example/',scrollY:0}),null);
  assert.equal(captureReturnSnapshot({href:'/#team-chuan',scrollY:Number.NaN}).scrollY,0);
  assert.equal(captureReturnSnapshot({href:'/#team-chuan',scrollY:-40}).scrollY,0);
  // Never persist a corpus or roster payload on the way out.
  assert.deepEqual(captureReturnSnapshot({href:'/#team-chuan',scrollY:0,disclosures:{filters:'yes',roster:[1,2,3]}}).disclosures,{});
});

test('snapshot storage failures never block navigation and never restore a foreign entry',()=>{
  const storage=memoryStorage();
  const snapshot=captureReturnSnapshot({href:'/?q=vien#team-chuan',scrollY:120,tab:'team-chuan'});
  assert.equal(writeReturnSnapshot(snapshot,storage),true);
  assert.equal(storage.map.size,1);
  assert.ok(storage.map.has(TEAM_RETURN_STORAGE_KEY));
  assert.deepEqual(readReturnSnapshot('/?q=vien#team-chuan',storage),snapshot);
  assert.deepEqual(readReturnSnapshot(`${ROOT}/?q=vien#team-chuan`,storage,{origin:ROOT}),snapshot);
  assert.equal(readReturnSnapshot('/?q=other#team-chuan',storage),null);

  clearReturnSnapshot(storage);
  assert.equal(readReturnSnapshot('/?q=vien#team-chuan',storage),null);

  assert.equal(writeReturnSnapshot(snapshot,memoryStorage({failSet:true})),false);
  assert.equal(readReturnSnapshot('/?q=vien#team-chuan',memoryStorage({failGet:true})),null);
  assert.equal(writeReturnSnapshot(snapshot,null),false);
  assert.equal(readReturnSnapshot('/#team-chuan',null),null);
  assert.equal(writeReturnSnapshot(null,storage),false);

  const poisoned=memoryStorage();
  poisoned.map.set(TEAM_RETURN_STORAGE_KEY,'{not json');
  assert.equal(readReturnSnapshot('/#team-chuan',poisoned),null);
  poisoned.map.set(TEAM_RETURN_STORAGE_KEY,JSON.stringify({version:1,url:'https://evil.example/',scrollY:0}));
  assert.equal(readReturnSnapshot('https://evil.example/',poisoned),null);
  poisoned.map.set(TEAM_RETURN_STORAGE_KEY,JSON.stringify({version:1,url:'/#team-chuan',scrollY:'top'}));
  assert.equal(readReturnSnapshot('/#team-chuan',poisoned),null);
  poisoned.map.set(TEAM_RETURN_STORAGE_KEY,JSON.stringify({version:1,url:'/#team-chuan',scrollY:1_000_001,tab:null,disclosures:{}}));
  assert.equal(readReturnSnapshot('/#team-chuan',poisoned),null);
});

test('old reference URLs migrate to the registered routes while any config key keeps gameplay precedence',()=>{
  const resolver={
    hasRecommended:id=>id===RECOMMENDED,
    hasLegacy:id=>id===LEGACY,
  };
  const migrate=(href,extra=resolver)=>migrateLegacyReferenceUrl(href,extra);
  assert.equal(handles(),true);

  const recommended=migrate(`${ROOT}/?season=pk-s24&detail=${RECOMMENDED}#team-chuan`);
  assert.equal(recommended.replace,true);
  assert.equal(
    recommended.target,
    `/doi-chuan/${RECOMMENDED_SEGMENT}/?from=${encodeURIComponent('/?season=pk-s24#team-chuan')}`,
  );

  const legacy=migrate(`${ROOT}/?legacyTeam=${LEGACY}#team-khac`);
  assert.equal(legacy.target,`/doi-khac/${LEGACY_SEGMENT}/?from=${encodeURIComponent('/#team-khac')}`);

  const variant=migrate(`${ROOT}/?legacyTeam=${LEGACY}&legacyVariant=v-9#team-khac`);
  assert.equal(variant.target,`/doi-khac/${LEGACY_SEGMENT}/?variant=v-9&from=${encodeURIComponent('/#team-khac')}`);
  const malformedVariant=migrate(`${ROOT}/?legacyTeam=${LEGACY}&legacyVariant=%2Fbad#team-khac`);
  assert.equal(malformedVariant.target,`/doi-khac/${LEGACY_SEGMENT}/?variant=%2Fbad&from=${encodeURIComponent('/#team-khac')}`);
  const emptyVariant=migrate(`${ROOT}/?legacyTeam=${LEGACY}&legacyVariant=#team-khac`);
  assert.equal(emptyVariant.target,`/doi-khac/${LEGACY_SEGMENT}/?variant=&from=${encodeURIComponent('/#team-khac')}`);

  // Unknown identity must not become an arbitrary path.
  assert.equal(migrate(`${ROOT}/?detail=team-missing#team-chuan`),null);
  assert.equal(migrate(`${ROOT}/?legacyTeam=../secret#team-khac`),null);
  assert.equal(migrate(`${ROOT}/#team-chuan`),null);

  // Gameplay config keeps precedence, including an invalid config value.
  assert.equal(migrate(`${ROOT}/?config=season-config-1&detail=${RECOMMENDED}#analyze`),null);
  assert.equal(migrate(`${ROOT}/?config=missing&legacyTeam=${LEGACY}#analyze`),null);
  assert.equal(migrate(`${ROOT}/?config=&legacyTeam=${LEGACY}#analyze`),null);

  // A resolver that claims an identity the registry never froze migrates nothing.
  assert.equal(migrate(`${ROOT}/?detail=team-claimed#team-chuan`,{hasRecommended:()=>true}),null);
  assert.equal(migrate(`${ROOT}/?legacyTeam=team-claimed#team-khac`,{hasLegacy:()=>true}),null);

  // Without any registered handles there is no migration at all.
  assert.equal(empty(),true);
  assert.equal(migrate(`${ROOT}/?detail=${RECOMMENDED}#team-chuan`),null);
  assert.equal(migrate(`${ROOT}/?legacyTeam=${LEGACY}#team-khac`),null);
});
