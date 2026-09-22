// Điều hướng dùng chung giữa root và trang chi tiết: href chuẩn, nguồn quay lại an toàn
// và snapshot trạng thái giao diện. Không chạm DOM, không phụ thuộc dữ liệu đội: bảng route
// handle do caller bơm vào qua setTeamRouteHandles.

export const TEAM_RETURN_STORAGE_KEY = 'tqccl:team-return:v1';

export const ROOT_TABS = ['team-chuan','team-khac','coexist','khaihoang','heroes','tactics','recruit-tracker','analyze','roster-recommend'];

/** Query keys the root surfaces own; anything else in `from` is treated as untrusted. */
export const ROOT_QUERY_KEYS = ['season','category','q','faction','unit','score','tier','subcategory','source','scenario','ruleset','sort','stars','config'];

/** Selectors that would send the detail page straight back to itself. */
const LOOP_QUERY_KEYS = ['detail','legacyTeam','legacyVariant','from'];

const RETURN_ORIGIN = 'https://tqccl.invalid';
const UNSAFE_IDENTIFIER = /[\u0000-\u001f\u007f/\\?#%:*"<>|\s]/;

/** Route families published by the build: `r` = Recommended, `l` = legacy originals. */
const ROUTE_FAMILIES = ['r', 'l'];

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
 * Registry bảng route handle: `r[sourceConfigId]` và `l[legacyTeamId]` là final route segment.
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
      : [];
  if (!prefix) return null;
  const segment = families[family]?.get(identity);
  return segment ? `/${prefix}/${encodeURIComponent(segment)}/` : null;
}

export function teamDetailHref(target, {from, origin} = {}) {
  const path = teamDetailPath(target);
  if (!path) return null;
  const query = new URLSearchParams();
  if (!target.sourceConfigId && target?.legacyVariantId !== null && target?.legacyVariantId !== undefined) {
    query.set('variant', String(target.legacyVariantId));
  }
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

export function captureReturnSnapshot({href, scrollY, tab, disclosures, origin} = {}) {
  const url = safeReturnUrl(href, {origin});
  if (!url) return null;
  return {
    version: 1,
    url,
    scrollY: Number.isFinite(scrollY) && scrollY > 0 ? Math.min(Math.round(scrollY), 1_000_000) : 0,
    tab: ROOT_TABS.includes(tab) ? tab : null,
    disclosures: safeDisclosures(disclosures),
  };
}

export function matchesReturnSnapshot(snapshot, href, {origin} = {}) {
  const url = safeReturnUrl(href, {origin});
  return !!url
    && snapshot?.version === 1
    && typeof snapshot.url === 'string'
    && snapshot.url === url;
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

export function readReturnSnapshot(href, storage, {origin} = {}) {
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
  return {
    version: 1,
    url: snapshot.url,
    scrollY: Math.round(snapshot.scrollY),
    tab: snapshot.tab ?? null,
    disclosures: safeDisclosures(snapshot.disclosures),
  };
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
