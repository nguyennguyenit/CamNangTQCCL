// Điều hướng dùng chung giữa root và trang chi tiết: href chuẩn, nguồn quay lại an toàn
// và snapshot trạng thái giao diện. Không chạm DOM, không phụ thuộc dữ liệu đội: bảng route
// handle do caller bơm vào qua setTeamRouteHandles.

export const TEAM_RETURN_STORAGE_KEY = 'tqccl:team-return:v1';

export const ROOT_TABS = ['team-chuan','team-khac','coexist','khaihoang','heroes','tactics','recruit-tracker','analyze','roster-recommend'];

/** Tab riêng của Khai hoang: cặp đang chọn nằm trong query URL root, không có store thứ hai. */
export const KHAIHOANG_TEAM_QUERY_KEY = 'khTeam';
export const KHAIHOANG_VARIANT_QUERY_KEY = 'khVariant';

/** Query keys the root surfaces own; anything else in `from` is treated as untrusted. */
export const ROOT_QUERY_KEYS = ['season','category','q','faction','unit','score','tier','subcategory','source','scenario','ruleset','sort','stars','config',KHAIHOANG_TEAM_QUERY_KEY,KHAIHOANG_VARIANT_QUERY_KEY];

/** Selectors that would send the detail page straight back to itself. */
const LOOP_QUERY_KEYS = ['detail','legacyTeam','legacyVariant','from'];

const RETURN_ORIGIN = 'https://tqccl.invalid';
const UNSAFE_IDENTIFIER = /[\u0000-\u001f\u007f/\\?#%:*"<>|\s]/;

/** Route families published by the build: `r` = Recommended, `l` = legacy, `k` = Khai hoang. */
const ROUTE_FAMILIES = ['r', 'l', 'k'];

function routableIdentifier(value) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 128
    && !UNSAFE_IDENTIFIER.test(value)
    && !value.startsWith('.')
    && !value.endsWith('.');
}

function plainObject(value) {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Registry bảng route handle: `r[sourceConfigId]`, `l[legacyTeamId]` và `k[khaiHoangTeamId]` là final route segment.
 * Registry chưa khởi tạo, family/identity không có hoặc payload hỏng ⇒ `teamDetailPath` trả null,
 * tuyệt đối không fallback về URL ID cũ.
 */
let teamRouteHandles = null;

/** Validate toàn payload rồi replace nguyên khối; payload hỏng không đụng registry hiện hành. */
export function setTeamRouteHandles(map) {
  if (!plainObject(map)) return false;
  const next = {};
  for (const family of Object.keys(map)) {
    if (!ROUTE_FAMILIES.includes(family)) return false;
    const entries = map[family];
    if (!plainObject(entries)) return false;
    const segments = new Set();
    const handles = new Map();
    for (const [identity, segment] of Object.entries(entries)) {
      if (!routableIdentifier(identity) || !routableIdentifier(segment)) return false;
      if (segments.has(segment)) return false;
      segments.add(segment);
      handles.set(identity, segment);
    }
    next[family] = handles;
  }
  teamRouteHandles = next;
  return true;
}

/** Payload JSON nhúng trong document shell; lỗi parse không bao giờ thay registry hiện hành. */
export function setTeamRouteHandlesFromJSON(raw) {
  if (typeof raw !== 'string' || !raw) return false;
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return false;
  }
  return setTeamRouteHandles(payload);
}

export function teamDetailPath(target) {
  const families = teamRouteHandles;
  if (!families) return null;
  const [prefix, family, identity] = routableIdentifier(target?.sourceConfigId)
    ? ['doi-chuan', 'r', target.sourceConfigId]
    : routableIdentifier(target?.legacyTeamId)
      ? ['doi-khac', 'l', target.legacyTeamId]
      : routableIdentifier(target?.khaiHoangTeamId)
        ? ['khai-hoang', 'k', target.khaiHoangTeamId]
        : [];
  if (!prefix) return null;
  const segment = families[family]?.get(identity);
  return segment ? `/${prefix}/${encodeURIComponent(segment)}/` : null;
}

export function teamDetailHref(target, {from, origin} = {}) {
  const path = teamDetailPath(target);
  if (!path) return null;
  const query = new URLSearchParams();
  // Khai hoang chỉ phát `variant` cho cấu hình nondefault; legacy giữ nguyên hành vi cũ.
  const khaiHoang = routableIdentifier(target?.khaiHoangTeamId) && !routableIdentifier(target?.sourceConfigId) && !routableIdentifier(target?.legacyTeamId);
  const variant = khaiHoang
    ? (routableIdentifier(target?.khaiHoangVariantId) ? target.khaiHoangVariantId : null)
    : !target.sourceConfigId && target?.legacyVariantId !== null && target?.legacyVariantId !== undefined
      ? String(target.legacyVariantId)
      : null;
  if (variant !== null) query.set('variant', variant);
  const returnUrl = safeReturnUrl(from, {origin});
  if (returnUrl) query.set('from', returnUrl);
  const search = query.toString();
  return search ? `${path}?${search}` : path;
}

/**
 * Chỉ chấp nhận URL root cùng origin đã normalize: pathname `/`, hash thuộc tab hiện có,
 * query nằm trong allowlist. Selector mở chi tiết bị bỏ để không tạo vòng lặp.
 */
export function safeReturnUrl(raw, {origin = globalThis.location?.origin} = {}) {
  if (typeof raw !== 'string' || !raw || raw.length > 2048) return null;
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return null;
  if (raw.startsWith('//')) return null;
  const absolute = /^[a-z][a-z0-9+.-]*:/i.test(raw);
  if (absolute && (!origin || !raw.startsWith(`${origin}/`))) return null;
  if (!absolute && !raw.startsWith('/')) return null;
  let url;
  try {
    url = new URL(raw, RETURN_ORIGIN);
  } catch {
    return null;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (pathname !== '/' || url.pathname !== '/') return null;
  if (url.hash && !ROOT_TABS.includes(url.hash.slice(1))) return null;
  const params = new URLSearchParams();
  for (const [key, value] of url.searchParams) {
    if (LOOP_QUERY_KEYS.includes(key)) continue;
    if (!ROOT_QUERY_KEYS.includes(key)) return null;
    params.append(key, value);
  }
  const search = params.toString();
  return `/${search ? `?${search}` : ''}${url.hash}`;
}

export function familyReturnHref(family, {sourceSeasonId, sourceCategoryId} = {}) {
  if (family === 'khaihoang') return '/#khaihoang';
  const tab = family === 'recommended' ? 'team-chuan' : 'team-khac';
  const params = new URLSearchParams();
  if (family === 'recommended') {
    if (sourceSeasonId && sourceSeasonId !== 'all') params.set('season', sourceSeasonId);
    if (sourceCategoryId && sourceCategoryId !== 'all') params.set('category', sourceCategoryId);
  }
  const search = params.toString();
  return `/${search ? `?${search}` : ''}#${tab}`;
}

export function returnHrefFor(family, {from, origin, ...scope} = {}) {
  return safeReturnUrl(from, {origin}) || familyReturnHref(family, scope);
}

function khaiHoangPairlessUrl(safeUrl) {
  const url = new URL(safeUrl, RETURN_ORIGIN);
  url.searchParams.delete(KHAIHOANG_TEAM_QUERY_KEY);
  url.searchParams.delete(KHAIHOANG_VARIANT_QUERY_KEY);
  const search = url.searchParams.toString();
  return `/${search ? `?${search}` : ''}${url.hash}`;
}

/**
 * Khóa phục hồi của Khai hoang: gọi `safeReturnUrl` trước, chỉ khi URL an toàn thuộc tab
 * `#khaihoang` mới bỏ đúng `khTeam`/`khVariant`; path, hash và mọi query khác giữ nguyên.
 * URL khác tab trả null ⇒ caller quay về so khớp exact.
 */
export function khaiHoangContextKey(raw, {origin = globalThis.location?.origin} = {}) {
  const url = safeReturnUrl(raw, {origin});
  if (!url) return null;
  return new URL(url, RETURN_ORIGIN).hash === '#khaihoang' ? khaiHoangPairlessUrl(url) : null;
}

/** Cặp đang chọn trên URL root; thiếu hoặc không routable đều về mặc định ''. */
export function khaiHoangPairFromUrl(href) {
  let url;
  try {
    url = new URL(href, RETURN_ORIGIN);
  } catch {
    return {teamId: '', variantId: ''};
  }
  const teamId = url.searchParams.get(KHAIHOANG_TEAM_QUERY_KEY);
  const variantId = url.searchParams.get(KHAIHOANG_VARIANT_QUERY_KEY);
  return {
    teamId: routableIdentifier(teamId) ? teamId : '',
    variantId: routableIdentifier(variantId) ? variantId : '',
  };
}

/**
 * Ghi cặp đang chọn vào URL root dạng root-relative: không có team thì bỏ cả cặp, variant mặc
 * định chỉ bỏ `khVariant`. Path, hash và mọi query khác giữ nguyên.
 */
export function khaiHoangUrlWithPair(href, {teamId, variantId} = {}) {
  const url = new URL(href, RETURN_ORIGIN);
  url.searchParams.delete(KHAIHOANG_TEAM_QUERY_KEY);
  url.searchParams.delete(KHAIHOANG_VARIANT_QUERY_KEY);
  if (routableIdentifier(teamId)) {
    url.searchParams.set(KHAIHOANG_TEAM_QUERY_KEY, teamId);
    if (routableIdentifier(variantId)) url.searchParams.set(KHAIHOANG_VARIANT_QUERY_KEY, variantId);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

/** URL trang chi tiết: chỉ thay đúng `variant`, giữ `from`, path và hash; không chạm root. */
export function khaiHoangDetailVariantUrl(href, variantId) {
  const url = new URL(href, RETURN_ORIGIN);
  if (routableIdentifier(variantId)) url.searchParams.set('variant', variantId);
  else url.searchParams.delete('variant');
  return `${url.pathname}${url.search}${url.hash}`;
}

const MAX_KHAIHOANG_SELECTIONS = 64;

/** Inventory `teamId -> variant IDs` để loại entry stale; chấp nhận Map hoặc plain object. */
function khaiHoangVariantIndex(inventory) {
  const entries = inventory instanceof Map
    ? inventory.entries()
    : plainObject(inventory)
      ? Object.entries(inventory)
      : null;
  if (!entries) return null;
  const index = new Map();
  for (const [teamId, variants] of entries) {
    index.set(teamId, variants instanceof Set ? variants : new Set(Array.isArray(variants) ? variants : []));
  }
  return index;
}

/**
 * Map `teamId -> variantId` của snapshot: sparse (chỉ nondefault), key/value phải routable và khi
 * có inventory thì team cùng variant phải còn tồn tại — entry stale chỉ bị loại riêng nó.
 * Map rỗng vẫn là trạng thái hợp lệ.
 */
export function safeKhaiHoangVariants(value, inventory) {
  const result = {};
  if (!plainObject(value)) return result;
  const teams = khaiHoangVariantIndex(inventory);
  let kept = 0;
  for (const [teamId, variantId] of Object.entries(value)) {
    if (kept >= MAX_KHAIHOANG_SELECTIONS) break;
    if (!routableIdentifier(teamId) || !routableIdentifier(variantId)) continue;
    if (teams) {
      const variants = teams.get(teamId);
      if (!(variants instanceof Set) || !variants.has(variantId)) continue;
    }
    result[teamId] = variantId;
    kept += 1;
  }
  return result;
}

export function isNativeNavigationClick(event) {
  return !!event
    && event.button === 0
    && !event.metaKey
    && !event.ctrlKey
    && !event.shiftKey
    && !event.altKey
    && !event.defaultPrevented;
}

function safeDisclosures(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result={};
  for (const key of ['filters','score']) {
    if (typeof value[key] === 'boolean') result[key]=value[key];
  }
  if (Array.isArray(value.alternatives)) {
    result.alternatives=[...new Set(value.alternatives.filter(item=>
      typeof item === 'string' && item.length > 0 && item.length <= 128 && !/[\u0000-\u001f]/.test(item),
    ))].slice(0,12);
  }
  return result;
}

export function captureReturnSnapshot({href, scrollY, tab, disclosures, khaihoangVariants, khaihoangInventory, origin} = {}) {
  const url = safeReturnUrl(href, {origin});
  if (!url) return null;
  const snapshot = {
    version: 1,
    url,
    scrollY: Number.isFinite(scrollY) && scrollY > 0 ? Math.min(Math.round(scrollY), 1_000_000) : 0,
    tab: ROOT_TABS.includes(tab) ? tab : null,
    disclosures: safeDisclosures(disclosures),
  };
  // Chỉ ghi map khi root Khai hoang đã khởi tạo; map rỗng vẫn là trạng thái hợp lệ và có quyền.
  if (plainObject(khaihoangVariants)) snapshot.khaihoangVariants = safeKhaiHoangVariants(khaihoangVariants, khaihoangInventory);
  return snapshot;
}

/**
 * Hai URL cùng tab `#khaihoang` khớp theo context key (bỏ đúng cặp đang chọn); mọi surface khác
 * vẫn phải khớp full URL, nên snapshot khác `q`/`scenario`/`ruleset` hoặc tab bị loại.
 */
export function matchesReturnSnapshot(snapshot, href, {origin} = {}) {
  const url = safeReturnUrl(href, {origin});
  if (!url || snapshot?.version !== 1 || typeof snapshot.url !== 'string') return false;
  const stored = safeReturnUrl(snapshot.url, {origin});
  if (!stored) return false;
  const storedKey = khaiHoangContextKey(stored, {origin});
  const targetKey = khaiHoangContextKey(url, {origin});
  if (storedKey !== null && targetKey !== null) return storedKey === targetKey;
  return stored === url;
}

export function writeReturnSnapshot(snapshot, storage) {
  if (!snapshot || snapshot.version !== 1) return false;
  try {
    storage.setItem(TEAM_RETURN_STORAGE_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

export function readReturnSnapshot(href, storage, {origin, khaihoangInventory} = {}) {
  let raw;
  try {
    raw = storage.getItem(TEAM_RETURN_STORAGE_KEY);
  } catch {
    return null;
  }
  if (typeof raw !== 'string') return null;
  let snapshot;
  try {
    snapshot = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!matchesReturnSnapshot(snapshot,href,{origin})) return null;
  if (!Number.isFinite(snapshot.scrollY) || snapshot.scrollY < 0 || snapshot.scrollY > 1_000_000) return null;
  if (snapshot.tab !== null && !ROOT_TABS.includes(snapshot.tab)) return null;
  const restored = {
    version: 1,
    url: snapshot.url,
    scrollY: Math.round(snapshot.scrollY),
    tab: snapshot.tab ?? null,
    disclosures: safeDisclosures(snapshot.disclosures),
  };
  // Snapshot cũ thiếu map vẫn đọc được theo contract cũ; map hỏng không tự sinh lựa chọn.
  if (plainObject(snapshot.khaihoangVariants)) {
    restored.khaihoangVariants = safeKhaiHoangVariants(snapshot.khaihoangVariants, khaihoangInventory);
  }
  return restored;
}

export function clearReturnSnapshot(storage) {
  try {
    storage.removeItem(TEAM_RETURN_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * URL tham chiếu cũ được resolve bằng identity thật rồi replace sang route mới.
 * Key `config` luôn giữ precedence gameplay, kể cả khi giá trị không hợp lệ.
 */
export function migrateLegacyReferenceUrl(href, resolver = {}) {
  let url;
  try {
    url = new URL(href, RETURN_ORIGIN);
  } catch {
    return null;
  }
  if (url.searchParams.has('config')) return null;
  const detail = url.searchParams.get('detail');
  const legacyTeamId = url.searchParams.get('legacyTeam');
  const legacyVariantId = url.searchParams.get('legacyVariant');
  const from = safeReturnUrl(`${url.pathname}${url.search}${url.hash}`);
  if (detail && resolver.hasRecommended?.(detail)) {
    const target = teamDetailHref({sourceConfigId: detail}, {from});
    if (target) return {target, replace: true};
  }
  if (legacyTeamId && resolver.hasLegacy?.(legacyTeamId)) {
    const target = teamDetailHref({legacyTeamId, legacyVariantId}, {from});
    if (target) return {target, replace: true};
  }
  return null;
}
