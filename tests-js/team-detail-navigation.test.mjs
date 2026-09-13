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
} from '../js/team-detail-navigation.js';

const ROOT='https://tqccl.pages.dev';

function memoryStorage({failGet=false,failSet=false}={}) {
  const map=new Map();
  return {
    getItem(key){ if (failGet) throw new Error('denied'); return map.has(key)?map.get(key):null; },
    setItem(key,value){ if (failSet) throw new Error('quota'); map.set(key,String(value)); },
    removeItem(key){ map.delete(key); },
    map,
  };
}

test('detail hrefs are root-absolute, encoded and carry only identity plus a safe origin',()=>{
  assert.equal(teamDetailPath({sourceConfigId:'team-epoddo'}),'/teams/recommended/team-epoddo/');
  assert.equal(teamDetailPath({legacyTeamId:'team-intro-4'}),'/teams/legacy/team-intro-4/');
  assert.equal(
    teamDetailPath({sourceConfigId:'yxms-049-仙人盾-by大米'}),
    `/teams/recommended/${encodeURIComponent('yxms-049-仙人盾-by大米')}/`,
  );
  assert.equal(teamDetailPath({}),null);
  assert.equal(teamDetailPath({legacyTeamId:'../secret'}),null);

  assert.equal(
    teamDetailHref({legacyTeamId:'team-intro-4',legacyVariantId:'v-'+'a'.repeat(64)}),
    `/teams/legacy/team-intro-4/?variant=v-${'a'.repeat(64)}`,
  );
  assert.equal(teamDetailHref({legacyTeamId:'team-intro-4',legacyVariantId:''}),'/teams/legacy/team-intro-4/?variant=');
  assert.equal(teamDetailHref({legacyTeamId:'team-intro-4',legacyVariantId:'/bad'}),'/teams/legacy/team-intro-4/?variant=%2Fbad');
  assert.equal(
    teamDetailHref({sourceConfigId:'team-epoddo'},{from:'/?season=pk-s24&q=quan#team-chuan'}),
    `/teams/recommended/team-epoddo/?from=${encodeURIComponent('/?season=pk-s24&q=quan#team-chuan')}`,
  );
  // An unsafe origin is dropped instead of being propagated into the detail URL.
  assert.equal(teamDetailHref({sourceConfigId:'team-epoddo'},{from:'https://evil.example/'}),'/teams/recommended/team-epoddo/');
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
    '/teams/legacy/team-intro-4/',
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

test('old reference URLs migrate by identity while any config key keeps gameplay precedence',()=>{
  const resolver={
    hasRecommended:id=>id==='team-epoddo',
    hasLegacy:id=>id==='team-intro-4',
  };
  const migrate=(href,extra=resolver)=>migrateLegacyReferenceUrl(href,extra);

  const recommended=migrate(`${ROOT}/?season=pk-s24&detail=team-epoddo#team-chuan`);
  assert.equal(recommended.replace,true);
  assert.equal(
    recommended.target,
    `/teams/recommended/team-epoddo/?from=${encodeURIComponent('/?season=pk-s24#team-chuan')}`,
  );

  const legacy=migrate(`${ROOT}/?legacyTeam=team-intro-4#team-khac`);
  assert.equal(legacy.target,`/teams/legacy/team-intro-4/?from=${encodeURIComponent('/#team-khac')}`);

  const variant=migrate(`${ROOT}/?legacyTeam=team-intro-4&legacyVariant=v-9#team-khac`);
  assert.equal(variant.target,`/teams/legacy/team-intro-4/?variant=v-9&from=${encodeURIComponent('/#team-khac')}`);
  const malformedVariant=migrate(`${ROOT}/?legacyTeam=team-intro-4&legacyVariant=%2Fbad#team-khac`);
  assert.equal(malformedVariant.target,`/teams/legacy/team-intro-4/?variant=%2Fbad&from=${encodeURIComponent('/#team-khac')}`);
  const emptyVariant=migrate(`${ROOT}/?legacyTeam=team-intro-4&legacyVariant=#team-khac`);
  assert.equal(emptyVariant.target,`/teams/legacy/team-intro-4/?variant=&from=${encodeURIComponent('/#team-khac')}`);

  // Unknown identity must not become an arbitrary path.
  assert.equal(migrate(`${ROOT}/?detail=team-missing#team-chuan`),null);
  assert.equal(migrate(`${ROOT}/?legacyTeam=../secret#team-khac`),null);
  assert.equal(migrate(`${ROOT}/#team-chuan`),null);

  // Gameplay config keeps precedence, including an invalid config value.
  assert.equal(migrate(`${ROOT}/?config=season-config-1&detail=team-epoddo#analyze`),null);
  assert.equal(migrate(`${ROOT}/?config=missing&legacyTeam=team-intro-4#analyze`),null);
  assert.equal(migrate(`${ROOT}/?config=&legacyTeam=team-intro-4#analyze`),null);
});
