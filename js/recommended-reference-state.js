import { normalizeText } from './filters.js';

const REPEATABLE = ['faction','unit','tier','subcategory','source'];
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
  if (url.searchParams.has('sort') || url.searchParams.has('score') || url.searchParams.has('point')) notices.push('Team chuẩn dùng thứ tự nguồn cố định; đã bỏ tham số sắp xếp hoặc điểm.');
  const seasons = new Set(registry.seasons || registry.seasonOptions?.map(item=>item.sourceSeasonId) || []);
  if (scalar.season && scalar.season !== 'all' && scalar.season !== 'unknown' && seasons.size && !seasons.has(scalar.season)) {
    notices.push('Mùa không tồn tại; đã dùng mùa mặc định.');
    scalar.season = registry.defaultSourceSeasonId || [...seasons][0] || null;
  }
  return {
    season: scalar.season || registry.defaultSourceSeasonId || 'all',
    category: scalar.category || 'all',
    query: scalar.q || '', detail: scalar.detail,
    legacyTeam: scalar.legacyTeam, legacyVariant: scalar.legacyVariant,
    filters: Object.fromEntries(REPEATABLE.map(key=>[key,[...new Set(url.searchParams.getAll(key).filter(Boolean))]])),
    notices,
  };
}

function values(row,key) {
  if (key === 'faction') return [row.factionRaw ?? row.faction].filter(Boolean);
  if (key === 'unit') return row.unitTypesRaw || row.unit || [];
  if (key === 'tier') return [row.tierRaw ?? row.historicalTier].filter(value=>value !== null && value !== undefined).map(String);
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

function fixedRank(a,b) {
  const tier = (a.tierOrder ?? 999) - (b.tierOrder ?? 999);
  if (tier) return tier;
  if (a.value == null && b.value != null) return 1;
  if (a.value != null && b.value == null) return -1;
  const score = (b.value ?? 0) - (a.value ?? 0);
  return score || (a.listIndex ?? 0) - (b.listIndex ?? 0) || String(a.sourceConfigId || a.legacyVariantId || a.legacyTeamId).localeCompare(String(b.sourceConfigId || b.legacyVariantId || b.legacyTeamId));
}

export function projectRecommendedRows(rows,state) {
  const query = normalizeText(state.query);
  return rows.filter(row => {
    if (!seasonMatches(row,state.season)) return false;
    if (!categoryMatches(row,state.category)) return false;
    for (const key of REPEATABLE) {
      const selected = state.filters?.[key] || [];
      if (selected.length && !values(row,key).some(value=>selected.includes(value))) return false;
    }
    return !query || normalizeText(JSON.stringify(row)).includes(query);
  }).slice().sort(fixedRank);
}

export function resolveTeamDestination(team) {
  if (team?.sourceConfigId && team?.safeScopeKey) return {kind:'recommended',sourceConfigId:team.sourceConfigId,scopeKey:team.safeScopeKey};
  if (team?.legacyTeamId) return {kind:'legacy',legacyTeamId:team.legacyTeamId,...(team.legacyVariantId ? {legacyVariantId:team.legacyVariantId} : {})};
  if (team?.configId) return {kind:'gameplay',configId:team.configId,scenarioId:team.scenarioId,rulesetId:team.rulesetId};
  return null;
}

export function validateReferenceSourceUrl(family, identity, raw) {
  try {
    const url = new URL(raw);
    if (!['http:','https:'].includes(url.protocol) || url.username || url.password || url.hash || /[\u0000-\u001f]/.test(raw)) return null;
    if (family === 'recommended') {
      if (url.protocol !== 'https:' || url.hostname !== 'sgsdeck.com' || decodeURIComponent(url.pathname) !== `/recommended/${identity.sourceConfigId}` || url.search) return null;
    }
    return url.href;
  } catch { return null; }
}

function bytesToJson(bytes) { return JSON.parse(new TextDecoder().decode(bytes)); }
async function digest(bytes) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join(''); }

export async function loadRecommendedReference(pin, loadBytes) {
  if (!pin?.generationId || !pin.manifestSha256) throw new Error('Thiếu pin Team chuẩn.');
  const manifestBytes = await loadBytes(`${pin.generationId}/manifest.json`);
  if (await digest(manifestBytes) !== pin.manifestSha256) throw new Error('Manifest Team chuẩn không khớp trang.');
  const manifest = bytesToJson(manifestBytes);
  if (manifest.schemaVersion !== 1 || manifest.generationId !== pin.generationId || manifest.dedupKeyVersion !== 1) throw new Error('Manifest Team chuẩn sai định danh.');
  const required = ['seasons.json','index.json','other-teams.json'];
  if (required.some(name=>!manifest.files?.[name])) throw new Error('Manifest Team chuẩn thiếu artifact bắt buộc.');
  const load = async name => {
    const bytes = await loadBytes(`${pin.generationId}/${name}`);
    const expected = manifest.files?.[name];
    if (!expected || await digest(bytes) !== expected.sha256 || bytes.byteLength !== expected.bytes) throw new Error(`Artifact Team chuẩn không hợp lệ: ${name}`);
    return bytesToJson(bytes);
  };
  const [seasons,index,other] = await Promise.all([load('seasons.json'),load('index.json'),load('other-teams.json')]);
  return Object.freeze({pin,manifest,seasons,index,other,loadDetail:scopeKey=>load(`details-${scopeKey}.json`)});
}
