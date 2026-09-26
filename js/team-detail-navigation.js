// Điều hướng dùng chung giữa trang mục và trang chi tiết: href chuẩn, nguồn quay lại an toàn
// và snapshot trạng thái giao diện. Không chạm DOM, không phụ thuộc dữ liệu đội: bảng route
// handle do caller bơm vào qua setTeamRouteHandles.

import { resolveLegacyRoute } from './legacy-routes.js';

export const TEAM_RETURN_STORAGE_KEY = 'tqccl:team-return:v1';

/** Tám mục cẩm nang; `tab` của snapshot và `aria-current` của nav đều dùng đúng id này. */
export const SECTION_TABS = ['team-chuan','team-khac','coexist','khaihoang','lookup','recruit-tracker','analyze','roster-recommend'];

/** Tab riêng của Khai hoang: cặp đang chọn nằm trong query URL mục, không có store thứ hai. */
export const KHAIHOANG_TEAM_QUERY_KEY = 'khTeam';
export const KHAIHOANG_VARIANT_QUERY_KEY = 'khVariant';

/**
 * Khóa query mỗi trang mục giữ lại khi dựng URL quay lại; khóa khác bị bỏ lặng lẽ.
 * Đội chuẩn/Đội khác không còn `score` (bộ lọc điểm đã bỏ) và `category` (bộ chọn danh mục đã bỏ); thêm `view` cho chế độ Thẻ/Bảng.
 * Cùng Tồn chỉ có nhóm, cấu hình và phạm vi kịch bản/luật; hai công cụ không có trạng thái URL.
 */
export const SECTION_QUERY_KEYS = Object.freeze({
  '/doi-chuan/': ['season','q','faction','unit','view','subcategory','source','scenario','ruleset','config'],
  '/doi-khac/': ['season','q','faction','unit','view','subcategory','source','scenario','ruleset','config'],
  '/cung-ton/': ['group','config','scenario','ruleset'],
  '/soi-doi-tu-anh/': [],
  '/goi-y-doi-tu-kho/': [],
  '/khai-hoang/': [KHAIHOANG_TEAM_QUERY_KEY,KHAIHOANG_VARIANT_QUERY_KEY],
  '/tra-cuu/': ['group','id'],
  '/theo-doi-chieu-mo/': [],
});

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
 * Chuẩn hóa URL quay lại: chỉ chấp nhận cùng origin và pathname thuộc 8 trang mục.
 * URL gốc cũ (`/` + hash tab, hoặc `/` + khóa root cũ) được chuyển qua bảng của Landing rồi
 * xét như URL mới, nên link chi tiết đã chia sẻ trước cutover vẫn quay về đúng trang.
 * Bỏ hash của URL mục và bỏ selector mở lại chính trang chi tiết (không tạo vòng lặp).
 * Vẫn từ chối: khác origin, `//`, ký tự điều khiển và pathname ngoài tập 8 trang.
 */
function normalizedSectionTarget(raw, origin) {
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
  let candidate = url;
  if (pathname === '/') {
    // Root cũ: chuẩn hóa bằng đúng bảng chuyển tiếp của Landing trước khi xét allowlist.
    if (url.pathname !== '/') return null;
    const normalized = resolveLegacyRoute(`${url.pathname}${url.search}${url.hash}`, RETURN_ORIGIN);
    if (!normalized) return null;
    try {
      candidate = new URL(normalized, RETURN_ORIGIN);
      pathname = decodeURIComponent(candidate.pathname);
    } catch {
      return null;
    }
  }
  if (!Object.hasOwn(SECTION_QUERY_KEYS, pathname) || candidate.pathname !== pathname) return null;
  const params = new URLSearchParams();
  for (const [key, value] of candidate.searchParams) {
    if (LOOP_QUERY_KEYS.includes(key)) continue;
    params.append(key, value);
  }
  return {pathname, params};
}

/** URL quay lại: giữ khóa được phép của đúng trang, bỏ lặng lẽ mọi khóa khác. */
export function safeReturnUrl(raw, {origin = globalThis.location?.origin} = {}) {
  const target = normalizedSectionTarget(raw, origin);
  if (!target) return null;
  const allowed = SECTION_QUERY_KEYS[target.pathname];
  const params = new URLSearchParams();
  for (const [key, value] of target.params) {
    if (!allowed.includes(key)) continue;
    params.append(key, value);
  }
  const search = params.toString();
  return `${target.pathname}${search ? `?${search}` : ''}`;
}

export function familyReturnHref(family, {sourceSeasonId} = {}) {
  if (family === 'khaihoang') return '/khai-hoang/';
  const params = new URLSearchParams();
  if (family === 'recommended') {
    if (sourceSeasonId && sourceSeasonId !== 'all') params.set('season', sourceSeasonId);
  }
  const search = params.toString();
  const path = family === 'recommended' ? '/doi-chuan/' : '/doi-khac/';
  return `${path}${search ? `?${search}` : ''}`;
}

export function returnHrefFor(family, {from, origin, ...scope} = {}) {
  return safeReturnUrl(from, {origin}) || familyReturnHref(family, scope);
}

/**
 * Khóa phục hồi của Khai hoang: `safeReturnUrl` chuẩn hóa trước (URL gốc `/#khaihoang` cũng về
 * `/khai-hoang/`), chỉ khi thuộc đúng trang Khai hoang mới bỏ đúng `khTeam`/`khVariant`.
 * Trang Khai hoang chỉ sở hữu cặp đó, nên URL khác ở khóa không thuộc trang là cùng trạng thái.
 * URL khác trang trả null ⇒ caller quay về so khớp exact.
 */
export function khaiHoangContextKey(raw, {origin = globalThis.location?.origin} = {}) {
  const url = safeReturnUrl(raw, {origin});
  if (!url) return null;
  const target = new URL(url, RETURN_ORIGIN);
  if (target.pathname !== '/khai-hoang/') return null;
  target.searchParams.delete(KHAIHOANG_TEAM_QUERY_KEY);
  target.searchParams.delete(KHAIHOANG_VARIANT_QUERY_KEY);
  const search = target.searchParams.toString();
  return `${target.pathname}${search ? `?${search}` : ''}`;
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
  if (typeof value.filters === 'boolean') result.filters=value.filters;
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
    tab: SECTION_TABS.includes(tab) ? tab : null,
    disclosures: safeDisclosures(disclosures),
  };
  // Chỉ ghi map khi root Khai hoang đã khởi tạo; map rỗng vẫn là trạng thái hợp lệ và có quyền.
  if (plainObject(khaihoangVariants)) snapshot.khaihoangVariants = safeKhaiHoangVariants(khaihoangVariants, khaihoangInventory);
  return snapshot;
}

/**
 * Hai URL cùng trang `/khai-hoang/` khớp theo context key: khóa phục hồi bỏ đúng cặp
 * `khTeam`/`khVariant` và giữ mọi khóa khác mà trang sở hữu (allowlist chỉ có hai khóa đó, nên
 * `q`/`scenario`/`ruleset` không được coi là trạng thái phân biệt). Mọi surface khác phải khớp
 * full URL, nên snapshot khác trang hoặc khác query được phép đều bị loại.
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
  if (snapshot.tab !== null && !SECTION_TABS.includes(snapshot.tab)) return null;
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
