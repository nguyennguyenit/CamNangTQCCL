import { normalizeText } from './filters.js';
import { canonicalTeamView } from './team-view.js';

/** Facet lặp được của danh sách đội; bộ lọc điểm đã bỏ nên `score` không còn ở đây. */
const REPEATABLE = ['faction','unit','subcategory','source'];
/** Selector cũ của bảng xếp hạng: bỏ khỏi query Team, không map sang điểm nguồn. */
const RETIRED = ['tier','stars','sort','point'];
const SCALARS = ['season','category','q','detail','legacyTeam','legacyVariant'];

export function readRecommendedQuery(href, registry = {}) {
  const url = new URL(href);
  const notices = [];
  const scalar = {};
  for (const key of SCALARS) {
    const values = url.searchParams.getAll(key).filter(Boolean);
    if (values.length > 1) notices.push(`Tham số ${key} bị lặp; chỉ dùng giá trị đầu.`);
    scalar[key] = values[0] || null;
  }
  if (RETIRED.some(key=>url.searchParams.has(key))) notices.push('Bộ lọc bậc/sao và tham số sắp xếp cũ không còn áp dụng; đội giữ thứ tự nguồn cố định.');
  const viewValues = url.searchParams.getAll('view').filter(Boolean);
  if (viewValues.length > 1) notices.push('Tham số view bị lặp; chỉ dùng giá trị đầu.');
  const view = canonicalTeamView(viewValues[0]);
  if (viewValues[0] && !view) notices.push('Kiểu hiển thị không hợp lệ đã bị bỏ.');
  const seasons = new Set(registry.seasons || registry.seasonOptions?.map(item=>item.sourceSeasonId) || []);
  if (scalar.season && scalar.season !== 'all' && scalar.season !== 'unknown' && seasons.size && !seasons.has(scalar.season)) {
    notices.push('Mùa không tồn tại; đã dùng mùa mặc định.');
    scalar.season = registry.defaultSourceSeasonId || [...seasons][0] || null;
  }
  return {
    season: scalar.season || registry.defaultSourceSeasonId || 'all',
    category: scalar.category || 'all',
    query: scalar.q || '', detail: scalar.detail,
    legacyTeam: scalar.legacyTeam, legacyVariant: scalar.legacyVariant, view,
    filters: Object.fromEntries(REPEATABLE.map(key=>[key,readFacet(url,key)])),
    notices,
  };
}

/** Facet lặp: giữ nguyên giá trị nguồn, bỏ trùng, không diễn giải. */
function readFacet(url,key) {
  return [...new Set(url.searchParams.getAll(key).filter(Boolean))];
}

/** Giá trị facet của một hàng, dùng chung cho projector và bộ đếm phạm vi của UI. */
export function referenceFacetValues(row,key) {
  if (key === 'faction') return [row.factionRaw ?? row.faction].filter(Boolean);
  if (key === 'unit') return row.unitTypesRaw || row.unit || [];
  if (key === 'subcategory') return [row.subcategoryRaw].filter(Boolean);
  if (key === 'source') return [row.source].filter(Boolean);
  return [];
}

function seasonMatches(row, season) {
  if (!season || season === 'all') return true;
  if (row.sourceConfigId) return row.sourceSeasonId === season;
  if (season === 'unknown') return row.sourceSeasonIds == null;
  return Array.isArray(row.sourceSeasonIds) && row.sourceSeasonIds.includes(season);
}

function categoryMatches(row, category) {
  if (!category || category === 'all') return true;
  if (row.sourceConfigId) return row.sourceCategoryId === category;
  if (category === 'unknown') return row.sourceCategoryIds == null;
  return Array.isArray(row.sourceCategoryIds) && row.sourceCategoryIds.includes(category);
}

function holderTerms(holder) {
  return [
    holder.displayNameVi,holder.nameRaw,holder.roleRaw,holder.statFocusVi,holder.statFocusRaw,holder.notesRaw,
    ...(holder.tacticSlotsRaw || []),...(holder.tacticSlotsVi || []),
    ...(holder.bookSlotsRaw || []),...(holder.bookSlotsVi || []),
    ...(holder.alternatives || []),
  ];
}

function legacyContentTerms(content) {
  return [
    content.name,content.nickname,content.faction,content.rawType,content.notes,
    ...(content.unitType || []),
    ...(content.heroes || []).flatMap(hero=>[
      hero.name,hero.baseName,hero.note,...(hero.alternatives || []),
      ...(hero.tactics || []).flatMap(item=>[item.name,...(item.alternatives || [])]),
      ...(hero.books || []).flatMap(item=>[item.name,...(item.alternatives || [])]),
    ]),
    ...(content.counters?.good || []),...(content.counters?.avoid || []),
  ];
}

/** Search corpus khai báo theo trường domain; hash, scope key và URL nguồn không phải nội dung tìm được. */
function searchTerms(row,labels) {
  const factions=[row.factionRaw ?? row.faction].filter(Boolean);
  const units=row.unitTypesRaw || row.unit || [];
  return [
    row.displayNameVi,row.nameZh,row.name,row.nickname,row.notesRaw,
    ...factions,...factions.map(value=>labels?.faction?.[value]),
    row.subcategoryRaw,
    ...units,...units.map(value=>labels?.unit?.[value]),
    ...(row.heroes || row.holders || []).flatMap(holderTerms),
    ...(row.alternativeHoldersRaw || []).flatMap(holderTerms),
    ...(row.displayNotes?.blocks || []).flatMap(block=>[block?.textRaw,block?.textVi]),
    ...(row.legacyContent ? legacyContentTerms(row.legacyContent) : []),
    ...(row.legacyReferences || []).flatMap(reference=>reference.legacyContent ? legacyContentTerms(reference.legacyContent) : []),
  ];
}

// Corpus của mỗi hàng là bất biến trong một lần publication; nhãn registry là một phần của khóa cache.
const searchBlobs = new WeakMap();
function searchBlob(row,labels) {
  const cached=searchBlobs.get(row);
  if (cached && cached.labels === labels) return cached.blob;
  const blob=normalizeText(searchTerms(row,labels).filter(Boolean).join(' '));
  searchBlobs.set(row,{labels,blob});
  return blob;
}

function fixedRank(a,b) {
  const tier = (a.tierOrder ?? 999) - (b.tierOrder ?? 999);
  if (tier) return tier;
  if (a.value == null && b.value != null) return 1;
  if (a.value != null && b.value == null) return -1;
  const score = (b.value ?? 0) - (a.value ?? 0);
  return score || (a.listIndex ?? 0) - (b.listIndex ?? 0) || String(a.sourceConfigId || a.legacyVariantId || a.legacyTeamId).localeCompare(String(b.sourceConfigId || b.legacyVariantId || b.legacyTeamId));
}

export function projectRecommendedRows(rows,state,labels) {
  const query = normalizeText(state.query);
  const queryTerms=query.split(/\s+/).filter(Boolean);
  return rows.filter(row => {
    if (!seasonMatches(row,state.season)) return false;
    if (!categoryMatches(row,state.category)) return false;
    for (const key of REPEATABLE) {
      const selected = state.filters?.[key] || [];
      if (selected.length && !referenceFacetValues(row,key).some(value=>selected.includes(value))) return false;
    }
    if (!queryTerms.length) return true;
    const blob=searchBlob(row,labels);
    return queryTerms.every(term=>blob.includes(term));
  }).slice().sort(fixedRank);
}

export function resolveTeamDestination(team) {
  if (team?.sourceConfigId && team?.safeScopeKey) return {kind:'recommended',sourceConfigId:team.sourceConfigId,scopeKey:team.safeScopeKey};
  if (team?.legacyTeamId) return {kind:'legacy',legacyTeamId:team.legacyTeamId,...(team.legacyVariantId ? {legacyVariantId:team.legacyVariantId} : {})};
  if (team?.configId) return {kind:'gameplay',configId:team.configId,scenarioId:team.scenarioId,rulesetId:team.rulesetId};
  return null;
}

/**
 * Kiểm scheme dùng chung cho mọi URL nguồn lấy từ dữ liệu (quyết định #14): chỉ nhận `http(s)` tuyệt đối,
 * không userinfo, không ký tự điều khiển; fragment được giữ (link Google Sheets có `#gid=…`).
 * URL hỏng trả `null` để caller không dựng link — không ném lỗi ra ngoài.
 */
export function validateHttpSourceUrl(raw) {
  if (typeof raw !== 'string' || /[\u0000-\u001f]/.test(raw)) return null;
  try {
    const url = new URL(raw);
    if (!['http:','https:'].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

/**
 * URL nguồn theo từng họ: `recommended` giữ nguyên ràng buộc danh tính (https, host, path giải mã được,
 * không query/fragment); họ khác chỉ cần phép kiểm scheme ở trên. Mọi lỗi giải mã trả `null`, không ném.
 */
export function validateReferenceSourceUrl(family, identity, raw) {
  const href = validateHttpSourceUrl(raw);
  if (!href) return null;
  if (family !== 'recommended') return href;
  try {
    const url = new URL(href);
    if (url.protocol !== 'https:' || url.hostname !== 'sgsdeck.com' || url.hash || url.search) return null;
    return decodeURIComponent(url.pathname) === `/recommended/${identity.sourceConfigId}` ? href : null;
  } catch {
    // `%ZZ` trong path không giải mã được: không phải URL nguồn hợp lệ, không được làm hỏng trang chi tiết.
    return null;
  }
}

function bytesToJson(bytes) { return JSON.parse(new TextDecoder().decode(bytes)); }
async function digest(bytes) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join(''); }

/** Verifier dùng chung: pin trang → manifest đúng generation → artifact đúng hash. */
export async function loadVerifiedRecommendedManifest(pin, loadBytes) {
  if (!pin?.generationId || !pin.manifestSha256) throw new Error('Thiếu mã xác minh đội chuẩn.');
  const manifestBytes = await loadBytes(`${pin.generationId}/manifest.json`);
  if (await digest(manifestBytes) !== pin.manifestSha256) throw new Error('Danh mục đội chuẩn không khớp trang.');
  const manifest = bytesToJson(manifestBytes);
  if (manifest.schemaVersion !== 1 || manifest.generationId !== pin.generationId || manifest.dedupKeyVersion !== 1) throw new Error('Danh mục đội chuẩn sai định danh.');
  const load = async name => {
    const bytes = await loadBytes(`${pin.generationId}/${name}`);
    const expected = manifest.files?.[name];
    if (!expected || await digest(bytes) !== expected.sha256 || bytes.byteLength !== expected.bytes) throw new Error(`Dữ liệu đội chuẩn không hợp lệ: ${name}`);
    return bytesToJson(bytes);
  };
  return {manifest, load};
}

export async function loadRecommendedReference(pin, loadBytes) {
  const {manifest, load} = await loadVerifiedRecommendedManifest(pin, loadBytes);
  const required = ['seasons.json','index.json','other-teams.json'];
  if (required.some(name=>!manifest.files?.[name])) throw new Error('Danh mục đội chuẩn thiếu dữ liệu bắt buộc.');
  const [seasons,index,other] = await Promise.all([load('seasons.json'),load('index.json'),load('other-teams.json')]);
  return Object.freeze({pin,manifest,seasons,index,other,loadDetail:scopeKey=>load(`details-${scopeKey}.json`)});
}

/**
 * Trang chi tiết chỉ tải đúng scope của nó: bản ghi đã xác minh + nhãn hiển thị phe/loại binh của
 * `seasons.json` cùng generation (đầu trang cần nhãn Việt cho giá trị nguồn), không kéo index/other.
 */
export async function loadRecommendedDetailView(pin, {scopeKey, sourceConfigId}, loadBytes) {
  if (!/^s-[0-9a-f]{64}$/.test(scopeKey || '')) throw new Error('Scope chi tiết không hợp lệ.');
  const {load} = await loadVerifiedRecommendedManifest(pin, loadBytes);
  const [payload,seasons] = await Promise.all([load(`details-${scopeKey}.json`),load('seasons.json')]);
  const matches = (payload.records || []).filter(row=>row.sourceConfigId === sourceConfigId);
  if (matches.length !== 1) throw new Error('Không tìm thấy đúng một cấu hình trong dữ liệu đã xác minh.');
  return {record: matches[0], labels: seasons?.displayLabels ?? null};
}

/** Toàn bộ đội gốc tự xác minh bytes raw trước khi tạo bản hiển thị. */
export async function loadVerifiedLegacyTeams(expectedHash, loadBytes) {
  if (!/^sha256:[0-9a-f]{64}$/.test(expectedHash || '')) throw new Error('Thiếu vân tay dữ liệu đội gốc.');
  const bytes = await loadBytes();
  if (`sha256:${await digest(bytes)}` !== expectedHash) throw new Error('Dữ liệu đội gốc không khớp vân tay của trang.');
  const teams = bytesToJson(bytes);
  if (!Array.isArray(teams)) throw new Error('Dữ liệu đội gốc sai định dạng.');
  return teams;
}

export async function loadVerifiedLegacyTeam(legacyTeamId, expectedHash, loadBytes) {
  const teams = await loadVerifiedLegacyTeams(expectedHash, loadBytes);
  const matches = teams.filter(team=>team.id === legacyTeamId);
  if (matches.length !== 1) throw new Error('Không tìm thấy đúng một đội gốc với mã này.');
  return matches[0];
}
