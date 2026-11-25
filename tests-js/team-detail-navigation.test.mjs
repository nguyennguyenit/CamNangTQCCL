import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TEAM_RETURN_STORAGE_KEY,
  TEAM_DETAIL_RETURN_STORAGE_KEY,
  SECTION_QUERY_KEYS,
  SSR_STALE_EXEMPT_KEYS,
  teamDetailPath,
  teamDetailHref,
  referenceDetailHref,
  khaiHoangCardHref,
  safeReturnUrl,
  familyReturnHref,
  resolveDetailReturn,
  rememberDetailReturn,
  detailUrlWithoutReturn,
  isNativeNavigationClick,
  captureReturnSnapshot,
  matchesReturnSnapshot,
  writeReturnSnapshot,
  readReturnSnapshot,
  migrateLegacyReferenceUrl,
  setTeamRouteHandles,
  setTeamRouteHandlesFromJSON,
  khaiHoangContextKey,
  khaiHoangPairFromUrl,
  khaiHoangUrlWithPair,
  khaiHoangDetailVariantUrl,
  safeKhaiHoangVariants,
} from '../js/team-detail-navigation.js';

const ROOT='https://tqccl.com';
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

/** Các đích độc hại dùng chung: `safeReturnUrl` và từng nguồn của `resolveDetailReturn` phải bỏ qua mọi mục. */
const HOSTILE_RETURNS=[
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
];

const DETAIL_PATH=`/doi-chuan/${RECOMMENDED_SEGMENT}/`;
const DETAIL_URL=`${ROOT}${DETAIL_PATH}`;

/** Storage theo đúng bố cục của `rememberDetailReturn`: `{[pathname chi tiết bỏ locale]: đích bỏ locale}`; đích độc cũng đi đường này. */
function storageWith(entries) {
  const storage=memoryStorage();
  storage.map.set(TEAM_DETAIL_RETURN_STORAGE_KEY,JSON.stringify(entries));
  return storage;
}

/** Mọi ca truyền `origin` của trang (`location.origin`): Node không có `location`, trình duyệt thì có, nên không được để mặc định. */
const resolveReturn=(overrides={})=>resolveDetailReturn({href:DETAIL_URL,referrer:'',state:null,storage:null,origin:ROOT,...overrides});

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

test('detail hrefs come from the registered final segments and carry identity (plus a variant), never a return source',()=>{
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
  // Link nội bộ chỉ có đường dẫn (+ variant): đường về nằm ở history.state/referrer/sessionStorage của trang chi tiết, không ở URL.
  assert.equal(teamDetailHref({sourceConfigId:RECOMMENDED}),`/doi-chuan/${RECOMMENDED_SEGMENT}/`);
  assert.equal(teamDetailHref({sourceConfigId:RECOMMENDED},{locale:'zh'}),`/zh/doi-chuan/${RECOMMENDED_SEGMENT}/`);
  // A registered identity without a handle is still not routable.
  assert.equal(teamDetailHref({sourceConfigId:'team-missing'}),null);

  // Non-ASCII segments stay encoded in the emitted href.
  assert.equal(setTeamRouteHandles({r:{'yxms-049':'pk-s24-仙人盾'}}),true);
  assert.equal(teamDetailPath({sourceConfigId:'yxms-049'}),`/doi-chuan/${encodeURIComponent('pk-s24-仙人盾')}/`);
});

test('list href builders emit clean detail URLs: identity and variant only, in every locale',()=>{
  assert.equal(setTeamRouteHandles({
    r:{[RECOMMENDED]:RECOMMENDED_SEGMENT},
    l:{[LEGACY]:LEGACY_SEGMENT},
    k:{[KHAIHOANG]:KHAIHOANG_HANDLE},
  }),true);
  const hrefs=[
    // Đội chuẩn: không variant.
    [referenceDetailHref({sourceConfigId:RECOMMENDED}),`/doi-chuan/${RECOMMENDED_SEGMENT}/`],
    [referenceDetailHref({sourceConfigId:RECOMMENDED},{locale:'zh'}),`/zh/doi-chuan/${RECOMMENDED_SEGMENT}/`],
    [referenceDetailHref({sourceConfigId:RECOMMENDED},{locale:'ja'}),`/ja/doi-chuan/${RECOMMENDED_SEGMENT}/`],
    // Đội khác luôn mang variant của hàng; `id` là tên khác của `legacyTeamId`.
    [referenceDetailHref({legacyTeamId:LEGACY,legacyVariantId:'v-1'}),`/doi-khac/${LEGACY_SEGMENT}/?variant=v-1`],
    [referenceDetailHref({id:LEGACY,legacyVariantId:'v-1'},{locale:'zh'}),`/zh/doi-khac/${LEGACY_SEGMENT}/?variant=v-1`],
    [referenceDetailHref({legacyTeamId:LEGACY}),`/doi-khac/${LEGACY_SEGMENT}/`],
    // Khai hoang: `variant` chỉ khi cấu hình đang chọn khác mặc định.
    [khaiHoangCardHref(KHAIHOANG,''),`/khai-hoang/${KHAIHOANG_HANDLE}/`],
    [khaiHoangCardHref(KHAIHOANG,KHAIHOANG_VARIANT),`/khai-hoang/${KHAIHOANG_HANDLE}/?variant=${KHAIHOANG_VARIANT}`],
    [khaiHoangCardHref(KHAIHOANG,KHAIHOANG_VARIANT,{locale:'zh'}),`/zh/khai-hoang/${KHAIHOANG_HANDLE}/?variant=${KHAIHOANG_VARIANT}`],
  ];
  for (const [actual,expected] of hrefs) {
    assert.equal(actual,expected);
    assert.doesNotMatch(actual,/[?&]from=/u);
  }
  // Identity không có route handle thì không có link, thay vì link ID cũ.
  assert.equal(referenceDetailHref({sourceConfigId:'team-missing'}),null);
  assert.equal(khaiHoangCardHref('team-missing',''),null);
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
  // Bộ chọn danh mục đã bỏ: `category` cũ bị bỏ lặng lẽ như `score`.
  assert.equal(safeReturnUrl('/?season=pk-s24&category=交戰#team-chuan'),'/doi-chuan/?season=pk-s24');
  assert.equal(safeReturnUrl('/?faction=Thục&faction=Ngô&q=vien#team-khac'),`/doi-khac/?faction=${encodeURIComponent('Thục')}&faction=${encodeURIComponent('Ngô')}&q=vien`);
  // Bộ lọc điểm đã bỏ: `score` cũ bị bỏ lặng lẽ khi dựng URL quay lại; `view` của chế độ Bảng sống sót.
  assert.equal(safeReturnUrl('/?season=pk-s24&score=113&score=unknown#team-chuan'),'/doi-chuan/?season=pk-s24');
  assert.equal(safeReturnUrl('/doi-chuan/?view=bang&score=113&unit=%E9%A8%8E'),'/doi-chuan/?view=bang&unit=%E9%A8%8E');
  // URL mục: hash bị bỏ, khóa ngoài allowlist của trang bị bỏ lặng lẽ.
  assert.equal(safeReturnUrl('/doi-chuan/?faction=Thục&fbclid=x&utm_source=z'),`/doi-chuan/?faction=${encodeURIComponent('Thục')}`);
  assert.equal(safeReturnUrl('/doi-chuan/?rogue=1'),'/doi-chuan/');
  assert.equal(safeReturnUrl('/khai-hoang/?khTeam=a&khVariant=b&q=x'),'/khai-hoang/?khTeam=a&khVariant=b');
  assert.equal(safeReturnUrl('/tra-cuu/?group=heroes&id=hero%3Aluu-bi&utm_source=z'),'/tra-cuu/?group=heroes&id=hero%3Aluu-bi');
  assert.equal(safeReturnUrl('/tra-cuu/tuong/?id=hero%3Aluu-bi&group=heroes&utm_source=z'),'/tra-cuu/tuong/?id=hero%3Aluu-bi');
  // Cùng Tồn chỉ sở hữu nhóm đang xem, cấu hình đang mở và phạm vi kịch bản/luật; khóa lọc cũ bị bỏ.
  assert.equal(safeReturnUrl('/cung-ton/?group=coexist-bdx-group-0fb69f7aa19a&q=B%C3%ACnh&fbclid=1'),'/cung-ton/?group=coexist-bdx-group-0fb69f7aa19a');
  assert.equal(safeReturnUrl('/cung-ton/?group=2&q=x&tier=T0&scenario=a'),'/cung-ton/?group=2&scenario=a');
  assert.equal(safeReturnUrl('/cung-ton/?group=3&scenario=binh-dien-xuan-thu&ruleset=r&config=c&sort=tier&stars=5'),'/cung-ton/?group=3&scenario=binh-dien-xuan-thu&ruleset=r&config=c');
  assert.equal(safeReturnUrl('/cung-ton/?group=a&detail=x'),'/cung-ton/?group=a');
  // Soi đội quay về đúng mùa + đội đã xác nhận (dựng lại editor và diff); khóa khác bị bỏ.
  assert.equal(safeReturnUrl('/soi-doi-tu-anh/?q=x&faction=Thục'),'/soi-doi-tu-anh/');
  assert.equal(safeReturnUrl('/soi-doi-tu-anh/?season=pk-s28&doi=v1.a___.b___.c___&q=x'),'/soi-doi-tu-anh/?season=pk-s28&doi=v1.a___.b___.c___');
  // Gợi ý đội quay về đúng mùa đang chọn; Chiêu mộ không có trạng thái URL nào để quay lại.
  assert.equal(safeReturnUrl('/goi-y-doi-tu-kho/?q=x&tier=T0'),'/goi-y-doi-tu-kho/');
  assert.equal(safeReturnUrl('/goi-y-doi-tu-kho/?season=pk-s28&scenario=a'),'/goi-y-doi-tu-kho/?season=pk-s28');
  assert.equal(safeReturnUrl('/theo-doi-chieu-mo/?q=x'),'/theo-doi-chieu-mo/');
  // Đội chuẩn giữ thêm `kho`/`xep` (lọc/sắp theo kho cục bộ) để Quay lại về đúng danh sách; Đội khác không có kho nên bỏ như khóa lạ.
  assert.equal(safeReturnUrl('/doi-chuan/?season=all&q=x&kho=rap-duoc&xep=de-rap'),'/doi-chuan/?season=all&q=x&kho=rap-duoc&xep=de-rap');
  assert.equal(safeReturnUrl('/zh/doi-chuan/?kho=thieu-2'),'/zh/doi-chuan/?kho=thieu-2');
  assert.equal(safeReturnUrl('/doi-khac/?q=x&kho=rap-duoc&xep=de-rap'),'/doi-khac/?q=x');
  // Hai khóa này không làm danh sách dựng sẵn sai (chỉ thêm badge/đổi thứ tự khi máy có kho): bảo vệ chống nháy không tính chúng.
  assert.deepEqual(SSR_STALE_EXEMPT_KEYS,['kho','xep']);
  for (const key of SSR_STALE_EXEMPT_KEYS) assert.ok(SECTION_QUERY_KEYS['/doi-chuan/'].includes(key),key);
  assert.equal(SECTION_QUERY_KEYS['/doi-khac/'].some(key=>SSR_STALE_EXEMPT_KEYS.includes(key)),false);
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
  assert.equal(safeReturnUrl('/#so-lieu'),null);

  for (const hostile of HOSTILE_RETURNS) {
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
  assert.equal(familyReturnHref('recommended',{sourceSeasonId:'pk-s24'}),'/doi-chuan/?season=pk-s24');
  assert.equal(familyReturnHref('recommended',{sourceSeasonId:'all'}),'/doi-chuan/');
  // Không nguồn hợp lệ nào thì resolver trả null để trang chi tiết giữ nguyên link họ đội đã dựng sẵn.
  assert.equal(resolveDetailReturn(),null);
  assert.equal(resolveReturn(),null);
});

test('detail return resolves state, then a legacy ?from=, then the referrer, then session storage, then nothing',()=>{
  const stored=storageWith({[DETAIL_PATH]:'/doi-chuan/?q=storage'});
  const legacyHref=`${DETAIL_URL}?variant=1&from=${encodeURIComponent('/doi-chuan/?q=from')}`;
  const referrer=`${ROOT}/doi-chuan/?season=s27&kho=rap-duoc`;

  // 1. history.state hợp lệ thắng mọi nguồn khác, kể cả khi là URL tuyệt đối cùng origin và còn khóa kho.
  assert.equal(resolveReturn({state:{teamDetailReturn:'/doi-chuan/?q=state'},href:legacyHref,referrer,storage:stored}),'/doi-chuan/?q=state');
  assert.equal(resolveReturn({state:{teamDetailReturn:`${ROOT}/doi-chuan/?q=a&kho=rap-duoc&xep=de-rap&utm_source=x`}}),'/doi-chuan/?q=a&kho=rap-duoc&xep=de-rap');

  // 2. state thiếu/hỏng → `?from=` của link cũ (tương đối và tuyệt đối cùng origin).
  for (const state of [null,undefined,{},{teamDetailReturn:null},{teamDetailReturn:''},{teamDetailReturn:{url:'/doi-chuan/?q=state'}},'x',7,[],['/doi-chuan/?q=state']]) {
    assert.equal(resolveReturn({state,href:legacyHref,referrer,storage:stored}),'/doi-chuan/?q=from',`state ${JSON.stringify(state)}`);
  }
  assert.equal(
    resolveReturn({href:`${DETAIL_URL}?from=${encodeURIComponent(`${ROOT}/doi-chuan/?q=abs&kho=thieu-2&rogue=1`)}`,referrer,storage:stored}),
    '/doi-chuan/?q=abs&kho=thieu-2',
  );

  // 3. Không state/from: referrer thắng storage cũ (mở lại cùng đội từ danh sách khác không lấy đích của lần trước).
  assert.equal(resolveReturn({referrer,storage:stored}),'/doi-chuan/?season=s27&kho=rap-duoc');

  // 4. Referrer không cho biết người dùng đến từ đâu (khác origin, trang đăng nhập Google, hỏng, rỗng) hoặc là chính trang
  //    chi tiết này ở ngôn ngữ/variant khác → storage theo trang chi tiết.
  for (const useless of ['https://evil.example/doi-chuan/?q=a','https://accounts.google.com/','not a url',DETAIL_URL,`${DETAIL_URL}?variant=1`,`${ROOT}/zh${DETAIL_PATH}`,'',null,undefined]) {
    assert.equal(resolveReturn({referrer:useless,storage:stored}),'/doi-chuan/?q=storage',`referrer ${String(useless)}`);
  }

  // 4b. Referrer cùng origin là trang khác ngoài danh sách (trang riêng Tra cứu, trang mùa, Landing, Đội của tôi, blog, trang
  //     chi tiết đội khác): người dùng vừa đi đường khác tới đây, đích cũ trong storage là sai → null (giữ link họ đội).
  for (const elsewhere of [`${ROOT}/tra-cuu/tuong/luu-bi/`,`${ROOT}/doi-chuan/pk-s27/`,`${ROOT}/`,`${ROOT}/doi-cua-toi/`,`${ROOT}/blog/bai-viet/`,`${ROOT}/doi-khac/${LEGACY_SEGMENT}/`,`${ROOT}/zh/tra-cuu/tuong/luu-bi/`]) {
    assert.equal(resolveReturn({referrer:elsewhere,storage:stored}),null,`referrer ${elsewhere}`);
  }

  // 5. Hết nguồn → null (không storage, storage rỗng hoặc mục của trang khác).
  assert.equal(resolveReturn({referrer:'https://accounts.google.com/'}),null);
  assert.equal(resolveReturn({storage:memoryStorage()}),null);
  assert.equal(resolveReturn({storage:storageWith({'/doi-chuan/team-other/':'/doi-chuan/?q=other'})}),null);
});

test('detail return keeps the page language: a zh referrer stays zh and storage written in one locale is re-prefixed in another',()=>{
  const zhDetail=`${ROOT}/zh/doi-khac/${LEGACY_SEGMENT}/`;
  assert.equal(resolveReturn({href:zhDetail,referrer:`${ROOT}/zh/doi-khac/?q=x`}),'/zh/doi-khac/?q=x');
  const storage=memoryStorage();
  assert.equal(rememberDetailReturn(storage,DETAIL_URL,'/doi-chuan/?q=x'),true);
  assert.equal(resolveReturn({href:`${ROOT}/zh${DETAIL_PATH}`,storage}),'/zh/doi-chuan/?q=x');
  assert.equal(resolveReturn({href:`${ROOT}/ja${DETAIL_PATH}`,storage}),'/ja/doi-chuan/?q=x');
  assert.equal(resolveReturn({href:DETAIL_URL,storage}),'/doi-chuan/?q=x');
  // Ghi từ bản zh, đọc ở bản vi.
  assert.equal(rememberDetailReturn(storage,`${ROOT}/zh${DETAIL_PATH}`,'/zh/doi-chuan/?season=all&kho=rap-duoc'),true);
  assert.equal(resolveReturn({href:DETAIL_URL,storage}),'/doi-chuan/?season=all&kho=rap-duoc');
});

test('detail return on Khai hoang: a referrer pair is overridden by the opened team, a legacy ?from= keeps its own pair',()=>{
  const detail=`${ROOT}/khai-hoang/${KHAIHOANG_HANDLE}/`;
  const referrer=`${ROOT}/khai-hoang/?khTeam=A&khVariant=a1`;
  // Mở tab mới từ đội B khi URL danh sách còn mang cặp của A: cặp lấy từ đội của trang chi tiết, variant chỉ khi có.
  assert.equal(resolveReturn({href:detail,referrer,khaiHoang:{teamId:'B',variantId:''}}),'/khai-hoang/?khTeam=B');
  assert.equal(resolveReturn({href:detail,referrer,khaiHoang:{teamId:'B',variantId:'b2'}}),'/khai-hoang/?khTeam=B&khVariant=b2');
  assert.equal(
    resolveReturn({href:`${ROOT}/zh/khai-hoang/${KHAIHOANG_HANDLE}/`,referrer:`${ROOT}/zh/khai-hoang/?khTeam=A`,khaiHoang:{teamId:'B',variantId:''}}),
    '/zh/khai-hoang/?khTeam=B',
  );
  // Link cũ và history.state giữ nguyên cặp của chúng, không bị ghi đè.
  assert.equal(
    resolveReturn({href:`${detail}?from=${encodeURIComponent('/khai-hoang/?khTeam=A')}`,referrer,khaiHoang:{teamId:'B',variantId:'b2'}}),
    '/khai-hoang/?khTeam=A',
  );
  assert.equal(resolveReturn({href:detail,state:{teamDetailReturn:'/khai-hoang/?khTeam=A'},referrer,khaiHoang:{teamId:'B'}}),'/khai-hoang/?khTeam=A');
  // Chỉ ghi đè khi đích là trang Khai hoang và caller có đội; referrer khác trang hoặc không có `khaiHoang` giữ nguyên.
  assert.equal(resolveReturn({href:detail,referrer:`${ROOT}/doi-chuan/?q=x`,khaiHoang:{teamId:'B',variantId:'b2'}}),'/doi-chuan/?q=x');
  assert.equal(resolveReturn({href:detail,referrer}),'/khai-hoang/?khTeam=A&khVariant=a1');
  assert.equal(resolveReturn({href:detail,referrer,khaiHoang:{teamId:'',variantId:'b2'}}),'/khai-hoang/?khTeam=A&khVariant=a1');
  // Đội không routable không được ghi vào URL danh sách: bỏ cả cặp.
  assert.equal(resolveReturn({href:detail,referrer,khaiHoang:{teamId:'../x',variantId:'b2'}}),'/khai-hoang/');
  // Đích ghim vào storage đã là kết quả ghi đè: đổi ngôn ngữ/đăng nhập lại không tính lại cặp.
  const storage=memoryStorage();
  rememberDetailReturn(storage,detail,resolveReturn({href:detail,referrer,khaiHoang:{teamId:'B',variantId:'b2'}}));
  assert.equal(resolveReturn({href:`${ROOT}/zh/khai-hoang/${KHAIHOANG_HANDLE}/`,referrer:'https://accounts.google.com/',storage,khaiHoang:{teamId:'B',variantId:''}}),'/zh/khai-hoang/?khTeam=B&khVariant=b2');
});

test('detail return skips a hostile value in any source and lets the next valid source win',()=>{
  const fromUrl=(value)=>`${DETAIL_URL}?from=${encodeURIComponent(value)}`;
  const valid={
    state:{teamDetailReturn:'/doi-chuan/?q=state'},
    href:fromUrl('/doi-chuan/?q=from'),
    referrer:`${ROOT}/doi-chuan/?q=referrer`,
    storage:storageWith({[DETAIL_PATH]:'/doi-chuan/?q=storage'}),
  };
  for (const hostile of HOSTILE_RETURNS) {
    const label=String(hostile);
    // `?from=` chỉ có thể là chuỗi; giá trị khác không có trong query.
    const hostileFrom=typeof hostile==='string'?fromUrl(hostile):DETAIL_URL;
    assert.equal(resolveReturn({...valid,state:{teamDetailReturn:hostile}}),'/doi-chuan/?q=from',`state ${label}`);
    assert.equal(resolveReturn({...valid,state:{teamDetailReturn:hostile},href:hostileFrom}),'/doi-chuan/?q=referrer',`state + from ${label}`);
    assert.equal(resolveReturn({...valid,state:{teamDetailReturn:hostile},href:hostileFrom,referrer:hostile}),'/doi-chuan/?q=storage',`state + from + referrer ${label}`);
    assert.equal(
      resolveReturn({state:{teamDetailReturn:hostile},href:hostileFrom,referrer:hostile,storage:storageWith({[DETAIL_PATH]:hostile})}),
      null,
      `every source ${label}`,
    );
  }
  // History state không phải object (chuỗi, số, mảng, Map) không bao giờ được đọc như `{teamDetailReturn}`.
  for (const state of ['/doi-chuan/?q=state',7,true,['/doi-chuan/?q=state'],new Map([['teamDetailReturn','/doi-chuan/?q=state']])]) {
    assert.equal(resolveReturn({state}),null,String(state));
  }
  // Referrer giả domain hoặc khác scheme/cổng không phải origin của trang.
  for (const referrer of [
    'https://tqccl.com.evil.example/doi-chuan/?q=x',
    'https://tqccl.com@evil.example/doi-chuan/?q=x',
    'https://evil.example/doi-chuan/?q=x',
    'http://tqccl.com/doi-chuan/?q=x',
    'https://tqccl.com:8443/doi-chuan/?q=x',
  ]) {
    assert.equal(resolveReturn({referrer}),null,referrer);
    assert.equal(resolveReturn({href:fromUrl(referrer)}),null,`from ${referrer}`);
    assert.equal(resolveReturn({state:{teamDetailReturn:referrer}}),null,`state ${referrer}`);
  }
  // `origin` là origin của trang (location.origin), không phải của nguồn: URL tuyệt đối chỉ hợp lệ khi cùng origin đó.
  const absolute=`${ROOT}/doi-chuan/?q=x`;
  assert.equal(resolveReturn({referrer:absolute,origin:'https://evil.example'}),null);
  assert.equal(resolveReturn({href:fromUrl(absolute),origin:'https://evil.example'}),null);
  assert.equal(resolveReturn({state:{teamDetailReturn:absolute},origin:'https://evil.example'}),null);
  assert.equal(resolveReturn({referrer:absolute}),'/doi-chuan/?q=x');
});

test('detail return ignores a broken session storage instead of throwing',()=>{
  for (const raw of [
    '{not json',
    'null',
    '[]',
    '"/doi-chuan/"',
    '7',
    'true',
    JSON.stringify({[DETAIL_PATH]:7}),
    JSON.stringify({[DETAIL_PATH]:null}),
    JSON.stringify({[DETAIL_PATH]:{target:'/doi-chuan/?q=x'}}),
    JSON.stringify({'/doi-chuan/team-other/':'/doi-chuan/?q=other'}),
    // Khóa là pathname bỏ locale: mục ghi tay theo pathname có tiền tố không được đọc.
    JSON.stringify({[`/zh${DETAIL_PATH}`]:'/doi-chuan/?q=x'}),
  ]) {
    const storage=memoryStorage();
    storage.map.set(TEAM_DETAIL_RETURN_STORAGE_KEY,raw);
    assert.equal(resolveReturn({storage}),null,raw);
  }
  assert.equal(resolveReturn({storage:memoryStorage({failGet:true})}),null);
  assert.equal(resolveReturn({storage:null}),null);
  assert.equal(resolveReturn({storage:undefined}),null);
});

test('detail return storage is keyed by the detail path without its locale, capped at 32 entries and tolerant of failures',()=>{
  const read=(storage)=>JSON.parse(storage.map.get(TEAM_DETAIL_RETURN_STORAGE_KEY));
  const storage=memoryStorage();
  assert.equal(rememberDetailReturn(storage,`${DETAIL_URL}?variant=2#top`,'/zh/doi-chuan/?q=x&kho=rap-duoc&rogue=1'),true);
  assert.deepEqual(read(storage),{[DETAIL_PATH]:'/doi-chuan/?q=x&kho=rap-duoc'});
  // Cùng đội ở bản zh dùng chung khóa và ghi đè mục cũ, không thêm mục.
  assert.equal(rememberDetailReturn(storage,`${ROOT}/zh${DETAIL_PATH}`,'/zh/doi-chuan/?q=y'),true);
  assert.deepEqual(read(storage),{[DETAIL_PATH]:'/doi-chuan/?q=y'});

  // Đích không an toàn không bao giờ được ghi.
  for (const hostile of HOSTILE_RETURNS) {
    assert.equal(rememberDetailReturn(storage,DETAIL_URL,hostile),false,`must not store ${String(hostile)}`);
  }
  assert.deepEqual(read(storage),{[DETAIL_PATH]:'/doi-chuan/?q=y'});

  // Tối đa 32 mục: mục cũ nhất bị loại; ghi lại mục đã có đưa nó lên mới nhất.
  const many=memoryStorage();
  for (let index=0;index<40;index+=1) rememberDetailReturn(many,`${ROOT}/doi-chuan/team-${index}/`,`/doi-chuan/?q=${index}`);
  assert.deepEqual(Object.keys(read(many)),Array.from({length:32},(_,index)=>`/doi-chuan/team-${index+8}/`));
  assert.equal(read(many)['/doi-chuan/team-39/'],'/doi-chuan/?q=39');
  rememberDetailReturn(many,`${ROOT}/doi-chuan/team-8/`,'/doi-chuan/?q=again');
  rememberDetailReturn(many,`${ROOT}/doi-chuan/team-new/`,'/doi-chuan/?q=new');
  const keys=Object.keys(read(many));
  assert.equal(keys.length,32);
  assert.equal(keys.includes('/doi-chuan/team-9/'),false);
  assert.deepEqual(keys.slice(-2),['/doi-chuan/team-8/','/doi-chuan/team-new/']);
  assert.equal(read(many)['/doi-chuan/team-8/'],'/doi-chuan/?q=again');

  // Storage hỏng/bị chặn không chặn điều hướng: không ném, báo false khi không ghi được.
  assert.equal(rememberDetailReturn(memoryStorage({failSet:true}),DETAIL_URL,'/doi-chuan/'),false);
  assert.equal(rememberDetailReturn(null,DETAIL_URL,'/doi-chuan/'),false);
  assert.doesNotThrow(()=>rememberDetailReturn(memoryStorage({failGet:true}),DETAIL_URL,'/doi-chuan/?q=x'));
  // Giá trị cũ hỏng bị thay bằng bản ghi hợp lệ thay vì làm hỏng lần ghi mới.
  const poisoned=memoryStorage();
  poisoned.map.set(TEAM_DETAIL_RETURN_STORAGE_KEY,'{not json');
  assert.equal(rememberDetailReturn(poisoned,DETAIL_URL,'/doi-chuan/?q=x'),true);
  assert.deepEqual(read(poisoned),{[DETAIL_PATH]:'/doi-chuan/?q=x'});
  poisoned.map.set(TEAM_DETAIL_RETURN_STORAGE_KEY,JSON.stringify({[DETAIL_PATH]:{target:'x'},'rogue':'/doi-chuan/?q=rogue'}));
  assert.equal(rememberDetailReturn(poisoned,`${ROOT}/doi-chuan/team-other/`,'/doi-chuan/?q=other'),true);
  assert.deepEqual(read(poisoned),{'/doi-chuan/team-other/':'/doi-chuan/?q=other'});
});

test('the detail URL loses only a legacy from and otherwise comes back as the exact same string',()=>{
  assert.equal(detailUrlWithoutReturn('/doi-chuan/x/?variant=2&from=%2Fdoi-chuan%2F#a'),'/doi-chuan/x/?variant=2#a');
  assert.equal(detailUrlWithoutReturn('/doi-chuan/x/?from=%2Fdoi-chuan%2F'),'/doi-chuan/x/');
  assert.equal(detailUrlWithoutReturn('/doi-chuan/x/?from=a&variant=1&from=b'),'/doi-chuan/x/?variant=1');
  // Có `from` thì thành path + query + hash tương đối; origin của URL tuyệt đối không đi vào thanh địa chỉ.
  assert.equal(detailUrlWithoutReturn(`${ROOT}/doi-chuan/x/?from=%2F&variant=1`),'/doi-chuan/x/?variant=1');
  // Không có `from`: trả nguyên chuỗi, không re-encode (`%20`, `%3A`) và không đổi origin.
  for (const href of ['/doi-chuan/x/','/doi-khac/x/?variant=a%20b','/doi-khac/x/?variant=a%20b#top','/tra-cuu/chien-phap/?id=tactic%3Aan-ui-quan-dan',`${ROOT}/doi-khac/x/?variant=%2Fbad`,'/doi-khac/x/?fromage=1']) {
    assert.equal(detailUrlWithoutReturn(href),href);
  }
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
  const snapshot=captureReturnSnapshot({href:'/doi-chuan/?q=vien&season=pk-s24&view=bang',scrollY:842.6,tab:'team-chuan',disclosures:{filters:true,score:true,alternatives:['cfg-1','cfg-2','cfg-1'],seasons:false}});
  assert.equal(snapshot.version,1);
  assert.equal(snapshot.url,'/doi-chuan/?q=vien&season=pk-s24&view=bang');
  assert.equal(snapshot.scrollY,843);
  // `score` không còn là khóa disclosure; `view` thuộc URL nên không nằm trong snapshot.
  assert.deepEqual(snapshot.disclosures,{filters:true,alternatives:['cfg-1','cfg-2']});
  assert.equal(matchesReturnSnapshot(snapshot,'/doi-chuan/?q=vien&season=pk-s24&view=bang'),true);
  assert.equal(matchesReturnSnapshot(snapshot,'/doi-chuan/?q=vien&season=pk-s24'),false);
  assert.equal(matchesReturnSnapshot(snapshot,`${ROOT}/doi-chuan/?q=vien&season=pk-s24&view=bang`,{origin:ROOT}),true);
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
  // Khóa thẻ đã mở (`target`) đi qua cùng rào khóa bản ghi với `alternatives`.
  assert.deepEqual(captureReturnSnapshot({href:'/doi-chuan/',scrollY:0,disclosures:{target:'cfg-61'}}).disclosures,{target:'cfg-61'});
  for (const target of ['',{},'x'.repeat(129),'cfg\n1']) {
    assert.deepEqual(captureReturnSnapshot({href:'/doi-chuan/',scrollY:0,disclosures:{target}}).disclosures,{});
  }
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
  // Đích Quay lại không đi trong URL chi tiết: trang chi tiết đọc referrer của lần `location.replace` (URL cũ).
  assert.equal(recommended.target,`/doi-chuan/${RECOMMENDED_SEGMENT}/`);

  const legacy=migrate(`${ROOT}/?legacyTeam=${LEGACY}#team-khac`);
  assert.equal(legacy.target,`/doi-khac/${LEGACY_SEGMENT}/`);

  const variant=migrate(`${ROOT}/?legacyTeam=${LEGACY}&legacyVariant=v-9#team-khac`);
  assert.equal(variant.target,`/doi-khac/${LEGACY_SEGMENT}/?variant=v-9`);
  const malformedVariant=migrate(`${ROOT}/?legacyTeam=${LEGACY}&legacyVariant=%2Fbad#team-khac`);
  assert.equal(malformedVariant.target,`/doi-khac/${LEGACY_SEGMENT}/?variant=%2Fbad`);
  const emptyVariant=migrate(`${ROOT}/?legacyTeam=${LEGACY}&legacyVariant=#team-khac`);
  assert.equal(emptyVariant.target,`/doi-khac/${LEGACY_SEGMENT}/?variant=`);

  // Migrate chạy trên mọi trang mục: link chuyển tiếp không mang query của trang đi tiếp.
  const onSection=migrate(`/tra-cuu/?detail=${RECOMMENDED}&group=heroes&utm_source=z`);
  assert.equal(onSection.target,`/doi-chuan/${RECOMMENDED_SEGMENT}/`);
  const onKhaiHoang=migrate(`/khai-hoang/?legacyTeam=${LEGACY}&khTeam=x`);
  assert.equal(onKhaiHoang.target,`/doi-khac/${LEGACY_SEGMENT}/`);

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
  assert.equal(matchesReturnSnapshot(snapshot,'/soi-doi-tu-anh/'),false);
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

test('the detail page variant URL only replaces its own variant query and drops a leftover legacy from',()=>{
  const detail=`/khai-hoang/${KHAIHOANG_HANDLE}/?variant=${KHAIHOANG_VARIANT}`;
  const legacy=`${detail}&from=${encodeURIComponent('/#khaihoang')}`;
  assert.equal(khaiHoangDetailVariantUrl(detail,'jp-s23'),`/khai-hoang/${KHAIHOANG_HANDLE}/?variant=jp-s23`);
  // Link cũ còn `from`: đổi variant cũng dọn `from`, không phát lại nó (đích Quay lại đã ghim ở history.state/sessionStorage).
  assert.equal(khaiHoangDetailVariantUrl(legacy,'jp-s23'),`/khai-hoang/${KHAIHOANG_HANDLE}/?variant=jp-s23`);
  // Về mặc định thì bỏ hẳn `variant`.
  assert.equal(khaiHoangDetailVariantUrl(legacy,''),`/khai-hoang/${KHAIHOANG_HANDLE}/`);
  assert.equal(khaiHoangDetailVariantUrl(legacy,'/bad'),`/khai-hoang/${KHAIHOANG_HANDLE}/`);
  assert.equal(khaiHoangDetailVariantUrl(`/khai-hoang/${KHAIHOANG_HANDLE}/?from=%2F%23khaihoang`,'jp-s23'),`/khai-hoang/${KHAIHOANG_HANDLE}/?variant=jp-s23`);
  // Không có gì khác bị chạm: hash và query lạ của trang chi tiết giữ nguyên.
  assert.equal(khaiHoangDetailVariantUrl(`/khai-hoang/${KHAIHOANG_HANDLE}/?variant=a&from=x&q=y#top`,'b'),`/khai-hoang/${KHAIHOANG_HANDLE}/?variant=b&q=y#top`);
});

test('a Khai hoang detail page resolves its legacy sources and otherwise leaves the default list link alone',()=>{
  const detail=`${ROOT}/khai-hoang/${KHAIHOANG_HANDLE}/`;
  const fromUrl=(value)=>`${detail}?from=${encodeURIComponent(value)}`;
  assert.equal(familyReturnHref('khaihoang'),'/khai-hoang/');
  assert.equal(familyReturnHref('khaihoang',{sourceSeasonId:'pk-s24',sourceCategoryId:'交戰'}),'/khai-hoang/');
  assert.equal(
    resolveReturn({href:fromUrl(`/khai-hoang/?khTeam=${KHAIHOANG}&khVariant=${KHAIHOANG_VARIANT}`)}),
    `/khai-hoang/?khTeam=${KHAIHOANG}&khVariant=${KHAIHOANG_VARIANT}`,
  );
  // Không nguồn, nguồn độc hay trang con của Khai hoang: null để trang giữ `/khai-hoang/` dựng sẵn.
  assert.equal(resolveReturn({href:detail}),null);
  assert.equal(resolveReturn({href:fromUrl('https://evil.example/')}),null);
  assert.equal(resolveReturn({href:fromUrl('/khai-hoang/handle/')}),null);
  assert.equal(resolveReturn({href:detail,referrer:`${ROOT}/khai-hoang/handle/`}),null);
  // Snapshot và `from` cũ dạng `/#khaihoang` vẫn quay về đúng trang.
  assert.equal(resolveReturn({href:fromUrl('/#khaihoang')}),'/khai-hoang/');
});

test('Chinese pages keep detail, return and migration links under /zh/ with the same allowlist',()=>{
  handles();
  assert.equal(teamDetailPath({sourceConfigId:RECOMMENDED},'zh'),`/zh/doi-chuan/${RECOMMENDED_SEGMENT}/`);
  assert.equal(teamDetailPath({sourceConfigId:RECOMMENDED},'vi'),`/doi-chuan/${RECOMMENDED_SEGMENT}/`);
  // Link chi tiết bản Trung không mang nguồn quay lại; nguồn cũ (`from`) giữ đúng ngôn ngữ và lọc khóa như bản Việt.
  assert.equal(teamDetailHref({legacyTeamId:LEGACY},{locale:'zh'}),`/zh/doi-khac/${LEGACY_SEGMENT}/`);
  assert.equal(
    resolveReturn({href:`${ROOT}/zh/doi-khac/${LEGACY_SEGMENT}/?from=${encodeURIComponent('/zh/doi-khac/?q=abc&utm_source=x&detail=y')}`}),
    '/zh/doi-khac/?q=abc',
  );
  assert.equal(safeReturnUrl('/zh/khai-hoang/?khTeam=a&x=1',{origin:ROOT}),'/zh/khai-hoang/?khTeam=a');
  assert.equal(safeReturnUrl('/zh/#team-khac',{origin:ROOT}),'/zh/doi-khac/');
  for (const bad of ['/zh/','/zh','/zh/zh/doi-chuan/','/zh/bai-viet/','/zhx/doi-chuan/','/ZH/doi-chuan/']) {
    assert.equal(safeReturnUrl(bad,{origin:ROOT}),null,bad);
  }
  assert.equal(familyReturnHref('recommended',{sourceSeasonId:'pk-s24',locale:'zh'}),'/zh/doi-chuan/?season=pk-s24');
  assert.equal(familyReturnHref('khaihoang',{locale:'zh'}),'/zh/khai-hoang/');
  assert.equal(familyReturnHref('other',{locale:'zh'}),'/zh/doi-khac/');
  assert.equal(resolveReturn({href:`${ROOT}/zh/doi-khac/${LEGACY_SEGMENT}/?from=${encodeURIComponent('https://evil.example/zh/doi-khac/')}`}),null);
  // Khóa phục hồi Khai hoang tách theo ngôn ngữ: snapshot bản Việt không khớp trang bản Trung.
  assert.equal(khaiHoangContextKey('/zh/khai-hoang/?khTeam=a',{origin:ROOT}),'/zh/khai-hoang/');
  const snapshot=captureReturnSnapshot({href:'/khai-hoang/',scrollY:10,tab:'khaihoang',origin:ROOT});
  assert.equal(matchesReturnSnapshot(snapshot,'/zh/khai-hoang/',{origin:ROOT}),false);
  assert.deepEqual(
    migrateLegacyReferenceUrl(`${ROOT}/zh/doi-chuan/?detail=${RECOMMENDED}`,{hasRecommended:()=>true}),
    {target:`/zh/doi-chuan/${RECOMMENDED_SEGMENT}/`,replace:true},
  );
});
