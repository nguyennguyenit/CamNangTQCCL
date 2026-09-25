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
  khaiHoangContextKey,
  khaiHoangPairFromUrl,
  khaiHoangUrlWithPair,
  khaiHoangDetailVariantUrl,
  safeKhaiHoangVariants,
} from '../js/team-detail-navigation.js';

const ROOT='https://tqccl.pages.dev';
const RECOMMENDED='team-epoddo';
const LEGACY='team-intro-4';
const RECOMMENDED_SEGMENT='pk-s24-tiem-long-dieu-thuyen';
const LEGACY_SEGMENT='tan-ngo-thuong';
const KHAIHOANG='gia-cat-khac-sp-ma-sieu-phap-chinh';
const KHAIHOANG_HANDLE='gia-cat-khac-sp-ma-sieu-phap-chinh';
const KHAIHOANG_VARIANT='cn-thoi-phong';
/** Inventory dùng để loại lựa chọn stale: team -> variant ID còn tồn tại. */
const KHAIHOANG_INVENTORY={[KHAIHOANG]:[KHAIHOANG_VARIANT],'luc-ton-ta-tu-truong-xuan-hoa':['jp-s23']};

const khaiHoangHandles=()=>setTeamRouteHandles({k:{[KHAIHOANG]:KHAIHOANG_HANDLE}});

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
    `/doi-chuan/${RECOMMENDED_SEGMENT}/?from=${encodeURIComponent('/doi-chuan/?season=pk-s24&q=quan')}`,
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

test('return origin accepts section URLs, normalizes old root state, and rejects foreign or looping targets',()=>{
  // URL gốc cũ đi qua bảng chuyển tiếp của Landing rồi xét như URL mục.
  assert.equal(safeReturnUrl('/#team-khac'),'/doi-khac/');
  assert.equal(safeReturnUrl('/#team-pk'),'/doi-khac/?source=team-intro');
  assert.equal(safeReturnUrl('/?season=pk-s24&category=交戰#team-chuan'),`/doi-chuan/?season=pk-s24&category=${encodeURIComponent('交戰')}`);
  assert.equal(safeReturnUrl('/?faction=Thục&faction=Ngô&q=vien#team-khac'),`/doi-khac/?faction=${encodeURIComponent('Thục')}&faction=${encodeURIComponent('Ngô')}&q=vien`);
  // Điểm nguồn là selector của Đội chuẩn nên phải sống sót vòng list → detail → quay lại.
  assert.equal(safeReturnUrl('/?season=pk-s24&score=113&score=unknown#team-chuan'),'/doi-chuan/?season=pk-s24&score=113&score=unknown');
  // URL mục: hash bị bỏ, khóa ngoài allowlist của trang bị bỏ lặng lẽ.
  assert.equal(safeReturnUrl('/doi-chuan/?faction=Thục&fbclid=x&utm_source=z'),`/doi-chuan/?faction=${encodeURIComponent('Thục')}`);
  assert.equal(safeReturnUrl('/doi-chuan/?rogue=1'),'/doi-chuan/');
  assert.equal(safeReturnUrl('/khai-hoang/?khTeam=a&khVariant=b&q=x'),'/khai-hoang/?khTeam=a&khVariant=b');
  assert.equal(safeReturnUrl('/tra-cuu/?group=heroes&id=hero%3Aluu-bi&utm_source=z'),'/tra-cuu/?group=heroes&id=hero%3Aluu-bi');
  assert.equal(safeReturnUrl('/chieu-mo/?q=x'),'/chieu-mo/');
  // Absolute URLs are accepted only for the page's own origin.
  assert.equal(safeReturnUrl(`${ROOT}/doi-chuan/?q=a`,{origin:ROOT}),'/doi-chuan/?q=a');
  assert.equal(safeReturnUrl(`${ROOT}/#team-chuan`,{origin:ROOT}),'/doi-chuan/');
  assert.equal(safeReturnUrl('https://evil.example/',{origin:ROOT}),null);
  assert.equal(safeReturnUrl(`${ROOT}/doi-chuan/?q=a`),null);

  // Loop selectors are dropped, never carried back into the detail page.
  assert.equal(safeReturnUrl('/doi-chuan/?detail=team-epoddo&q=a'),'/doi-chuan/?q=a');
  assert.equal(safeReturnUrl('/doi-khac/?legacyTeam=team-intro-4&legacyVariant=v1&from=%2F'),'/doi-khac/');
  // Landing không phải đích quay lại hợp lệ của trang chi tiết.
  assert.equal(safeReturnUrl('/'),null);
  assert.equal(safeReturnUrl('/#nguon-du-lieu'),null);

  for (const hostile of [
    'https://evil.example/',
    '//evil.example/',
    '/\\evil.example',
    'javascript:alert(1)',
    'data:text/html,<script>',
    '/doi-khac/tan-ngo-thuong/',
    '/doi-chuan/pk-s24-tu-ma-phi-hung/',
    '/%2e%2e/admin',
    '/..%2fadmin',
    '/?q=a#unknown-tab',
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
  assert.doesNotThrow(()=>safeReturnUrl('/doi-chuan/?q=%E0%A4%A'));
  assert.doesNotThrow(()=>safeReturnUrl('/%E0%A4%A'));
  assert.equal(safeReturnUrl('/%E0%A4%A'),null);
});

test('a share link without origin still returns to the right family page',()=>{
  assert.equal(familyReturnHref('recommended'),'/doi-chuan/');
  assert.equal(familyReturnHref('legacy'),'/doi-khac/');
  assert.equal(
    familyReturnHref('recommended',{sourceSeasonId:'pk-s24',sourceCategoryId:'交戰'}),
    `/doi-chuan/?season=pk-s24&category=${encodeURIComponent('交戰')}`,
  );
  assert.equal(familyReturnHref('recommended',{sourceSeasonId:'all',sourceCategoryId:'all'}),'/doi-chuan/');
  assert.equal(returnHrefFor('recommended',{from:'/doi-chuan/?q=a'}),'/doi-chuan/?q=a');
  assert.equal(returnHrefFor('recommended',{from:'https://evil.example/',sourceSeasonId:'pk-s24'}),'/doi-chuan/?season=pk-s24');
  assert.equal(returnHrefFor('legacy',{}),'/doi-khac/');
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

test('return snapshots keep UI state only and match one exact section URL',()=>{
  const snapshot=captureReturnSnapshot({href:'/doi-chuan/?q=vien&season=pk-s24',scrollY:842.6,tab:'team-chuan',disclosures:{filters:true,score:true,alternatives:['cfg-1','cfg-2','cfg-1'],seasons:false}});
  assert.equal(snapshot.version,1);
  assert.equal(snapshot.url,'/doi-chuan/?q=vien&season=pk-s24');
  assert.equal(snapshot.scrollY,843);
  assert.deepEqual(snapshot.disclosures,{filters:true,score:true,alternatives:['cfg-1','cfg-2']});
  assert.equal(matchesReturnSnapshot(snapshot,'/doi-chuan/?q=vien&season=pk-s24'),true);
  assert.equal(matchesReturnSnapshot(snapshot,`${ROOT}/doi-chuan/?q=vien&season=pk-s24`,{origin:ROOT}),true);
  assert.equal(matchesReturnSnapshot(snapshot,'/doi-chuan/?q=vien'),false);
  assert.equal(matchesReturnSnapshot(snapshot,'/doi-khac/?q=vien&season=pk-s24'),false);
  assert.equal(matchesReturnSnapshot({version:0,url:'/doi-chuan/'},'/doi-chuan/'),false);

  assert.equal(captureReturnSnapshot({href:'https://evil.example/',scrollY:0}),null);
  assert.equal(captureReturnSnapshot({href:'/doi-chuan/',scrollY:Number.NaN}).scrollY,0);
  assert.equal(captureReturnSnapshot({href:'/doi-chuan/',scrollY:-40}).scrollY,0);
  // Snapshot ghi từ URL gốc cũ vẫn chuẩn hóa về đúng trang mục.
  assert.equal(captureReturnSnapshot({href:'/?q=vien#team-chuan',scrollY:0,tab:'team-chuan'}).url,'/doi-chuan/?q=vien');
  // Never persist a corpus or roster payload on the way out.
  assert.deepEqual(captureReturnSnapshot({href:'/doi-chuan/',scrollY:0,disclosures:{filters:'yes',roster:[1,2,3]}}).disclosures,{});
});

test('snapshot storage failures never block navigation and never restore a foreign entry',()=>{
  const storage=memoryStorage();
  const snapshot=captureReturnSnapshot({href:'/doi-chuan/?q=vien',scrollY:120,tab:'team-chuan'});
  assert.equal(writeReturnSnapshot(snapshot,storage),true);
  assert.equal(storage.map.size,1);
  assert.ok(storage.map.has(TEAM_RETURN_STORAGE_KEY));
  assert.deepEqual(readReturnSnapshot('/doi-chuan/?q=vien',storage),snapshot);
  assert.deepEqual(readReturnSnapshot(`${ROOT}/doi-chuan/?q=vien`,storage,{origin:ROOT}),snapshot);
  assert.equal(readReturnSnapshot('/doi-chuan/?q=other',storage),null);

  clearReturnSnapshot(storage);
  assert.equal(readReturnSnapshot('/doi-chuan/?q=vien',storage),null);

  assert.equal(writeReturnSnapshot(snapshot,memoryStorage({failSet:true})),false);
  assert.equal(readReturnSnapshot('/doi-chuan/?q=vien',memoryStorage({failGet:true})),null);
  assert.equal(writeReturnSnapshot(snapshot,null),false);
  assert.equal(readReturnSnapshot('/doi-chuan/',null),null);
  assert.equal(writeReturnSnapshot(null,storage),false);

  const poisoned=memoryStorage();
  poisoned.map.set(TEAM_RETURN_STORAGE_KEY,'{not json');
  assert.equal(readReturnSnapshot('/doi-chuan/',poisoned),null);
  poisoned.map.set(TEAM_RETURN_STORAGE_KEY,JSON.stringify({version:1,url:'https://evil.example/',scrollY:0}));
  assert.equal(readReturnSnapshot('https://evil.example/',poisoned),null);
  poisoned.map.set(TEAM_RETURN_STORAGE_KEY,JSON.stringify({version:1,url:'/doi-chuan/',scrollY:'top'}));
  assert.equal(readReturnSnapshot('/doi-chuan/',poisoned),null);
  poisoned.map.set(TEAM_RETURN_STORAGE_KEY,JSON.stringify({version:1,url:'/doi-chuan/',scrollY:1_000_001,tab:null,disclosures:{}}));
  assert.equal(readReturnSnapshot('/doi-chuan/',poisoned),null);
  // `tab` ngoài 8 mục cẩm nang vẫn bị loại.
  poisoned.map.set(TEAM_RETURN_STORAGE_KEY,JSON.stringify({version:1,url:'/doi-chuan/',scrollY:0,tab:'heroes',disclosures:{}}));
  assert.equal(readReturnSnapshot('/doi-chuan/',poisoned),null);
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
    `/doi-chuan/${RECOMMENDED_SEGMENT}/?from=${encodeURIComponent('/doi-chuan/?season=pk-s24')}`,
  );

  const legacy=migrate(`${ROOT}/?legacyTeam=${LEGACY}#team-khac`);
  assert.equal(legacy.target,`/doi-khac/${LEGACY_SEGMENT}/?from=${encodeURIComponent('/doi-khac/')}`);

  const variant=migrate(`${ROOT}/?legacyTeam=${LEGACY}&legacyVariant=v-9#team-khac`);
  assert.equal(variant.target,`/doi-khac/${LEGACY_SEGMENT}/?variant=v-9&from=${encodeURIComponent('/doi-khac/')}`);
  const malformedVariant=migrate(`${ROOT}/?legacyTeam=${LEGACY}&legacyVariant=%2Fbad#team-khac`);
  assert.equal(malformedVariant.target,`/doi-khac/${LEGACY_SEGMENT}/?variant=%2Fbad&from=${encodeURIComponent('/doi-khac/')}`);
  const emptyVariant=migrate(`${ROOT}/?legacyTeam=${LEGACY}&legacyVariant=#team-khac`);
  assert.equal(emptyVariant.target,`/doi-khac/${LEGACY_SEGMENT}/?variant=&from=${encodeURIComponent('/doi-khac/')}`);

  // Migrate chạy trên mọi trang mục: query riêng của trang đi tiếp làm `from` sau khi lọc.
  const onSection=migrate(`/tra-cuu/?detail=${RECOMMENDED}&group=heroes&utm_source=z`);
  assert.equal(onSection.target,`/doi-chuan/${RECOMMENDED_SEGMENT}/?from=${encodeURIComponent('/tra-cuu/?group=heroes')}`);
  const onKhaiHoang=migrate(`/khai-hoang/?legacyTeam=${LEGACY}&khTeam=x`);
  assert.equal(onKhaiHoang.target,`/doi-khac/${LEGACY_SEGMENT}/?from=${encodeURIComponent('/khai-hoang/?khTeam=x')}`);

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

test('Khai hoang detail routes come from the frozen handle registry and omit a default variant',()=>{
  assert.equal(khaiHoangHandles(),true);
  assert.equal(teamDetailPath({khaiHoangTeamId:KHAIHOANG}),`/khai-hoang/${KHAIHOANG_HANDLE}/`);
  assert.equal(teamDetailPath({khaiHoangTeamId:'team-missing'}),null);
  assert.equal(teamDetailPath({khaiHoangTeamId:'../secret'}),null);
  // Identity precedence never lets a stray Khai hoang id shadow a reference identity.
  assert.equal(setTeamRouteHandles({
    r:{[RECOMMENDED]:RECOMMENDED_SEGMENT},
    k:{[KHAIHOANG]:KHAIHOANG_HANDLE},
  }),true);
  assert.equal(teamDetailPath({sourceConfigId:RECOMMENDED,khaiHoangTeamId:KHAIHOANG}),`/doi-chuan/${RECOMMENDED_SEGMENT}/`);

  assert.equal(teamDetailHref({khaiHoangTeamId:KHAIHOANG}),`/khai-hoang/${KHAIHOANG_HANDLE}/`);
  // Mặc định (thiếu/rỗng/không routable) không bao giờ phát `variant`.
  assert.equal(teamDetailHref({khaiHoangTeamId:KHAIHOANG,khaiHoangVariantId:''}),`/khai-hoang/${KHAIHOANG_HANDLE}/`);
  assert.equal(teamDetailHref({khaiHoangTeamId:KHAIHOANG,khaiHoangVariantId:null}),`/khai-hoang/${KHAIHOANG_HANDLE}/`);
  assert.equal(teamDetailHref({khaiHoangTeamId:KHAIHOANG,khaiHoangVariantId:'/bad'}),`/khai-hoang/${KHAIHOANG_HANDLE}/`);
  assert.equal(
    teamDetailHref({khaiHoangTeamId:KHAIHOANG,khaiHoangVariantId:KHAIHOANG_VARIANT}),
    `/khai-hoang/${KHAIHOANG_HANDLE}/?variant=${KHAIHOANG_VARIANT}`,
  );
  // Href tự đủ state: `from` là URL root kèm đúng cặp của card, không query lạ nào khác.
  assert.equal(
    teamDetailHref(
      {khaiHoangTeamId:KHAIHOANG,khaiHoangVariantId:KHAIHOANG_VARIANT},
      {from:khaiHoangUrlWithPair('/khai-hoang/',{teamId:KHAIHOANG,variantId:KHAIHOANG_VARIANT})},
    ),
    `/khai-hoang/${KHAIHOANG_HANDLE}/?variant=${KHAIHOANG_VARIANT}`
      + `&from=${encodeURIComponent(`/khai-hoang/?khTeam=${KHAIHOANG}&khVariant=${KHAIHOANG_VARIANT}`)}`,
  );
  // `from` ngoài origin hoặc không an toàn bị bỏ, không kéo state lạ vào URL chi tiết.
  assert.equal(
    teamDetailHref({khaiHoangTeamId:KHAIHOANG},{from:'https://evil.example/'}),
    `/khai-hoang/${KHAIHOANG_HANDLE}/`,
  );
  // Family `k` cũng được validate nguyên khối như hai family cũ.
  for (const payload of [{k:[]},{k:null},{k:{'../secret':'ok'}},{k:{[KHAIHOANG]:'inner space'}},{k:{a:'same',b:'same'}},{k:{[KHAIHOANG]:KHAIHOANG_HANDLE},x:{}}]) {
    assert.equal(setTeamRouteHandles(payload),false,`must reject ${JSON.stringify(payload)}`);
  }
  assert.equal(teamDetailPath({khaiHoangTeamId:KHAIHOANG}),`/khai-hoang/${KHAIHOANG_HANDLE}/`);
});

test('Khai hoang pair stays on its own page URL and never bleeds into another surface',()=>{
  // Nondefault ghi đủ cặp; mặc định chỉ bỏ `khVariant`; không có team thì bỏ cả cặp.
  assert.equal(khaiHoangUrlWithPair('/khai-hoang/',{teamId:KHAIHOANG,variantId:KHAIHOANG_VARIANT}),`/khai-hoang/?khTeam=${KHAIHOANG}&khVariant=${KHAIHOANG_VARIANT}`);
  assert.equal(khaiHoangUrlWithPair('/khai-hoang/',{teamId:KHAIHOANG,variantId:''}),`/khai-hoang/?khTeam=${KHAIHOANG}`);
  assert.equal(khaiHoangUrlWithPair('/khai-hoang/',{teamId:'',variantId:''}),'/khai-hoang/');
  assert.equal(khaiHoangUrlWithPair('/khai-hoang/',{}),'/khai-hoang/');
  // Query khác và path giữ nguyên; cặp cũ bị thay chứ không nhân bản.
  assert.equal(khaiHoangUrlWithPair('/khai-hoang/?q=vien',{teamId:KHAIHOANG}),`/khai-hoang/?q=vien&khTeam=${KHAIHOANG}`);
  assert.equal(khaiHoangUrlWithPair(`/khai-hoang/?khTeam=old&khVariant=old&q=vien`,{teamId:KHAIHOANG,variantId:KHAIHOANG_VARIANT}),`/khai-hoang/?q=vien&khTeam=${KHAIHOANG}&khVariant=${KHAIHOANG_VARIANT}`);
  // Identity không routable không được ghi vào URL.
  assert.equal(khaiHoangUrlWithPair('/khai-hoang/',{teamId:'../secret',variantId:'/bad'}),'/khai-hoang/');
  // URL gốc cũ vẫn chuẩn hóa được qua cùng hàm.
  assert.equal(khaiHoangUrlWithPair('/#khaihoang',{teamId:KHAIHOANG,variantId:KHAIHOANG_VARIANT}),`/?khTeam=${KHAIHOANG}&khVariant=${KHAIHOANG_VARIANT}#khaihoang`);

  assert.deepEqual(khaiHoangPairFromUrl(`/khai-hoang/?khTeam=${KHAIHOANG}&khVariant=${KHAIHOANG_VARIANT}`),{teamId:KHAIHOANG,variantId:KHAIHOANG_VARIANT});
  assert.deepEqual(khaiHoangPairFromUrl(`/khai-hoang/?khTeam=${KHAIHOANG}`),{teamId:KHAIHOANG,variantId:''});
  assert.deepEqual(khaiHoangPairFromUrl('/khai-hoang/'),{teamId:'',variantId:''});
  assert.deepEqual(khaiHoangPairFromUrl('/khai-hoang/?khTeam=%2Fbad&khVariant=%2Fbad'),{teamId:'',variantId:''});
  assert.deepEqual(khaiHoangPairFromUrl('not a url'),{teamId:'',variantId:''});

  // Cặp này là query hợp lệ của trang Khai hoang nên sống sót qua safeReturnUrl.
  assert.equal(safeReturnUrl(`/khai-hoang/?khTeam=${KHAIHOANG}&khVariant=${KHAIHOANG_VARIANT}`),`/khai-hoang/?khTeam=${KHAIHOANG}&khVariant=${KHAIHOANG_VARIANT}`);
  // Khóa lạ không còn làm hỏng cả URL, chỉ bị bỏ khỏi đích quay lại.
  assert.equal(safeReturnUrl('/khai-hoang/?khTeam=x&rogue=1'),'/khai-hoang/?khTeam=x');
});

test('Khai hoang recovery context drops exactly the active pair',()=>{
  assert.equal(khaiHoangContextKey(`/khai-hoang/?khTeam=${KHAIHOANG}&khVariant=${KHAIHOANG_VARIANT}`),'/khai-hoang/');
  // Trang Khai hoang chỉ sở hữu `khTeam`/`khVariant`: khóa khác không thuộc trang nên bị bỏ
  // trước khi tính khóa phục hồi (thay đổi có chủ đích so với mô hình một-query-cũ của root).
  assert.equal(khaiHoangContextKey('/khai-hoang/?q=vien&khTeam=a&khVariant=b'),'/khai-hoang/');
  const context = '/khai-hoang/?q=mot&scenario=binh-dien-xuan-thu&khTeam=a&q=hai&ruleset=demo&khVariant=b';
  const otherPair = '/khai-hoang/?q=mot&scenario=binh-dien-xuan-thu&khTeam=other&q=hai&ruleset=demo&khVariant=other';
  assert.equal(khaiHoangContextKey(context),'/khai-hoang/');
  assert.equal(khaiHoangContextKey(otherPair),khaiHoangContextKey(context));
  const scopedSnapshot = captureReturnSnapshot({href: context, scrollY: 0, tab: 'khaihoang'});
  assert.equal(matchesReturnSnapshot(scopedSnapshot, otherPair), true);
  // URL gốc cũ `/#khaihoang` chuẩn hóa về cùng một khóa.
  assert.equal(khaiHoangContextKey('/#khaihoang'),'/khai-hoang/');
  assert.equal(khaiHoangContextKey(`/?khTeam=${KHAIHOANG}&khVariant=${KHAIHOANG_VARIANT}#khaihoang`),'/khai-hoang/');
  // Surface khác vẫn exact URL: context key chỉ tồn tại cho trang Khai hoang.
  assert.equal(khaiHoangContextKey('/doi-chuan/?q=vien'),null);
  assert.equal(khaiHoangContextKey('/doi-khac/?q=vien'),null);
  assert.equal(khaiHoangContextKey('https://evil.example/?khTeam=a#khaihoang'),null);
  assert.equal(khaiHoangContextKey('/khai-hoang/handle/'),null);
  assert.equal(khaiHoangContextKey(null),null);

  const snapshot=captureReturnSnapshot({href:`/khai-hoang/?khTeam=${KHAIHOANG}&khVariant=${KHAIHOANG_VARIANT}`,scrollY:0,tab:'khaihoang'});
  // Khác riêng active pair thì phải nhận; khác trang thì phải bị loại.
  assert.equal(matchesReturnSnapshot(snapshot,'/khai-hoang/'),true);
  assert.equal(matchesReturnSnapshot(snapshot,'/khai-hoang/?khTeam=other&khVariant=other'),true);
  assert.equal(matchesReturnSnapshot(snapshot,'/khai-hoang/?q=vien'),true);
  assert.equal(matchesReturnSnapshot(snapshot,'/doi-chuan/'),false);
  assert.equal(matchesReturnSnapshot(snapshot,'/soi-doi/'),false);
  // Snapshot surface khác vẫn exact URL như trước.
  const reference=captureReturnSnapshot({href:'/doi-chuan/?q=vien',scrollY:0,tab:'team-chuan'});
  assert.equal(matchesReturnSnapshot(reference,'/doi-chuan/?q=vien'),true);
  assert.equal(matchesReturnSnapshot(reference,'/doi-chuan/?q=other'),false);
});

test('Khai hoang selection map is sparse, inventory-limited, and authoritative when empty',()=>{
  // Chỉ giữ nondefault; thiếu key nghĩa là mặc định.
  assert.deepEqual(safeKhaiHoangVariants({[KHAIHOANG]:KHAIHOANG_VARIANT,'luc-ton-ta-tu-truong-xuan-hoa':''},KHAIHOANG_INVENTORY),{[KHAIHOANG]:KHAIHOANG_VARIANT});
  // Variant stale chỉ loại đúng entry sai, không xóa cả map.
  assert.deepEqual(
    safeKhaiHoangVariants({[KHAIHOANG]:'variant-da-bo','luc-ton-ta-tu-truong-xuan-hoa':'jp-s23'},KHAIHOANG_INVENTORY),
    {'luc-ton-ta-tu-truong-xuan-hoa':'jp-s23'},
  );
  assert.deepEqual(safeKhaiHoangVariants({'team-da-bo':'jp-s23'},KHAIHOANG_INVENTORY),{});
  // Payload hỏng không tự sinh lựa chọn.
  for (const hostile of [null,undefined,'x',7,[],[KHAIHOANG],new Map([[KHAIHOANG,KHAIHOANG_VARIANT]])]) {
    assert.deepEqual(safeKhaiHoangVariants(hostile,KHAIHOANG_INVENTORY),{},`must reject ${String(hostile)}`);
  }
  assert.deepEqual(safeKhaiHoangVariants({[KHAIHOANG]:'../bad','luc-ton-ta-tu-truong-xuan-hoa':'jp-s23'},KHAIHOANG_INVENTORY),{'luc-ton-ta-tu-truong-xuan-hoa':'jp-s23'});

  const storage=memoryStorage();
  const snapshot=captureReturnSnapshot({
    href:`/?khTeam=${KHAIHOANG}&khVariant=${KHAIHOANG_VARIANT}#khaihoang`,
    scrollY:640,
    tab:'khaihoang',
    khaihoangVariants:{[KHAIHOANG]:KHAIHOANG_VARIANT,'luc-ton-ta-tu-truong-xuan-hoa':'jp-s23','team-da-bo':'jp-s23'},
    khaihoangInventory:KHAIHOANG_INVENTORY,
  });
  assert.deepEqual(snapshot.khaihoangVariants,{[KHAIHOANG]:KHAIHOANG_VARIANT,'luc-ton-ta-tu-truong-xuan-hoa':'jp-s23'});
  assert.equal(writeReturnSnapshot(snapshot,storage),true);
  // Cùng tab, khác cặp đang chọn ⇒ vẫn đọc được map và scroll.
  assert.deepEqual(
    readReturnSnapshot('/#khaihoang',storage,{khaihoangInventory:KHAIHOANG_INVENTORY}),
    {...snapshot,url:snapshot.url},
  );
  // Inventory mới đã bỏ một variant ⇒ chỉ entry stale biến mất khi đọc.
  assert.deepEqual(
    readReturnSnapshot('/#khaihoang',storage,{khaihoangInventory:{[KHAIHOANG]:['variant-moi'],'luc-ton-ta-tu-truong-xuan-hoa':['jp-s23']}}).khaihoangVariants,
    {'luc-ton-ta-tu-truong-xuan-hoa':'jp-s23'},
  );
  // Map rỗng là lựa chọn hợp lệ của người dùng, không bị coi là thiếu dữ liệu.
  const reset=captureReturnSnapshot({href:'/#khaihoang',scrollY:0,tab:'khaihoang',khaihoangVariants:{},khaihoangInventory:KHAIHOANG_INVENTORY});
  assert.equal(Object.hasOwn(reset,'khaihoangVariants'),true);
  assert.deepEqual(reset.khaihoangVariants,{});
  writeReturnSnapshot(reset,storage);
  const restored=readReturnSnapshot('/#khaihoang',storage,{khaihoangInventory:KHAIHOANG_INVENTORY});
  assert.equal(Object.hasOwn(restored,'khaihoangVariants'),true);
  assert.deepEqual(restored.khaihoangVariants,{});

  // Snapshot v1 cũ thiếu map vẫn đọc tab/scroll theo contract cũ, không tự sinh map.
  const legacy=memoryStorage();
  legacy.map.set(TEAM_RETURN_STORAGE_KEY,JSON.stringify({version:1,url:'/#khaihoang',scrollY:210,tab:'khaihoang',disclosures:{filters:true}}));
  const legacyRead=readReturnSnapshot('/#khaihoang',legacy,{khaihoangInventory:KHAIHOANG_INVENTORY});
  assert.equal(legacyRead.scrollY,210);
  assert.equal(legacyRead.tab,'khaihoang');
  assert.equal(Object.hasOwn(legacyRead,'khaihoangVariants'),false);

  // Map hỏng hoặc storage bị chặn không làm hỏng phần còn lại của snapshot.
  const poisoned=memoryStorage();
  poisoned.map.set(TEAM_RETURN_STORAGE_KEY,JSON.stringify({version:1,url:'/#khaihoang',scrollY:0,tab:'khaihoang',disclosures:{},khaihoangVariants:'all'}));
  const poisonedRead=readReturnSnapshot('/#khaihoang',poisoned,{khaihoangInventory:KHAIHOANG_INVENTORY});
  assert.equal(poisonedRead.tab,'khaihoang');
  assert.equal(Object.hasOwn(poisonedRead,'khaihoangVariants'),false);
  assert.equal(readReturnSnapshot('/#khaihoang',memoryStorage({failGet:true}),{khaihoangInventory:KHAIHOANG_INVENTORY}),null);
  assert.equal(captureReturnSnapshot({href:'https://evil.example/',khaihoangVariants:{[KHAIHOANG]:KHAIHOANG_VARIANT}}),null);
});

test('the detail page variant URL only replaces its own variant query',()=>{
  const detail=`/khai-hoang/${KHAIHOANG_HANDLE}/?variant=${KHAIHOANG_VARIANT}&from=${encodeURIComponent('/#khaihoang')}`;
  assert.equal(
    khaiHoangDetailVariantUrl(detail,'jp-s23'),
    `/khai-hoang/${KHAIHOANG_HANDLE}/?variant=jp-s23&from=${encodeURIComponent('/#khaihoang')}`,
  );
  // Về mặc định thì bỏ hẳn `variant`, `from` vẫn nguyên.
  assert.equal(khaiHoangDetailVariantUrl(detail,''),`/khai-hoang/${KHAIHOANG_HANDLE}/?from=${encodeURIComponent('/#khaihoang')}`);
  assert.equal(khaiHoangDetailVariantUrl(detail,'/bad'),`/khai-hoang/${KHAIHOANG_HANDLE}/?from=${encodeURIComponent('/#khaihoang')}`);
  assert.equal(khaiHoangDetailVariantUrl(`/khai-hoang/${KHAIHOANG_HANDLE}/?from=%2F%23khaihoang`,'jp-s23'),`/khai-hoang/${KHAIHOANG_HANDLE}/?from=%2F%23khaihoang&variant=jp-s23`);
  // Không có gì khác bị chạm: hash và query lạ của trang chi tiết giữ nguyên.
  assert.equal(khaiHoangDetailVariantUrl(`/khai-hoang/${KHAIHOANG_HANDLE}/?variant=a&from=x#top`,'b'),`/khai-hoang/${KHAIHOANG_HANDLE}/?variant=b&from=x#top`);
});

test('a Khai hoang share link without origin returns to the Khai hoang page',()=>{
  assert.equal(familyReturnHref('khaihoang'),'/khai-hoang/');
  assert.equal(familyReturnHref('khaihoang',{sourceSeasonId:'pk-s24',sourceCategoryId:'交戰'}),'/khai-hoang/');
  assert.equal(returnHrefFor('khaihoang',{from:`/khai-hoang/?khTeam=${KHAIHOANG}&khVariant=${KHAIHOANG_VARIANT}`}),`/khai-hoang/?khTeam=${KHAIHOANG}&khVariant=${KHAIHOANG_VARIANT}`);
  assert.equal(returnHrefFor('khaihoang',{from:'https://evil.example/'}),'/khai-hoang/');
  assert.equal(returnHrefFor('khaihoang',{}),'/khai-hoang/');
  assert.equal(returnHrefFor('khaihoang',{from:'/khai-hoang/handle/'}),'/khai-hoang/');
  // Snapshot và `from` cũ dạng `/#khaihoang` vẫn quay về đúng trang.
  assert.equal(returnHrefFor('khaihoang',{from:'/#khaihoang'}),'/khai-hoang/');
});
