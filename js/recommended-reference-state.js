import { normalizeText } from './filters.js';
import { canonicalTeamView } from './team-view.js';
import { L, currentLocale, normalizeLocale } from './i18n.js';

const CJK_TEXT = /[\u3400-\u9fff\uf900-\ufaff]/u;
let zhNameResolver = null;

/**
 * Bản zh: bộ phân giải tên Hán-Việt của dữ liệu cũ (`teams.json`, `khaihoang.json`, `coexist.json`) → chữ Hán
 * gốc, dựng từ từ điển tướng/chiến pháp/binh thư. Bản vi không cần gọi; truyền giá trị không phải hàm để gỡ.
 */
export function setZhNameResolver(resolver) {
  zhNameResolver = typeof resolver === 'function' ? resolver : null;
}

/**
 * Tên nguồn theo ngôn ngữ trang. Bản vi trả nguyên; bản zh giữ nguyên chuỗi đã có chữ Hán, còn tên Hán-Việt
 * đổi sang chữ Hán gốc theo từng phần ngăn bởi `·`, `/`, `+`. Phần không tra được bị bỏ (không trộn tiếng Việt
 * vào trang zh); không còn phần nào thì trả chuỗi rỗng để caller hiện ô trống "—".
 */
export function sourceName(value, locale = currentLocale()) {
  if (typeof value !== 'string' || !zhNameResolver || normalizeLocale(locale) !== 'zh' || CJK_TEXT.test(value)) return value;
  const parts = value.split(/(\s*[·/+]\s*)/u);
  const kept = [];
  for (let index = 0; index < parts.length; index += 2) {
    const name = parts[index].trim();
    const resolved = name ? zhNameResolver(name) : null;
    if (resolved) kept.push({ separator: index ? parts[index - 1] : '', resolved });
  }
  return kept.map((item, index) => (index ? item.separator : '') + item.resolved).join('');
}

/** Nhãn tiếng Trung của giá trị phe / loại binh / nguồn trong dữ liệu cũ (vốn ghi bằng tiếng Việt). */
const LEGACY_LABEL_ZH = {
  faction: {'Ngụy':'魏','Thục':'蜀','Ngô':'吴','Quần':'群','Hỗn hợp':'混合'},
  unit: {'Kỵ':'骑','Cung':'弓','Thương':'枪','Khiên':'盾'},
  source: {'team-intro':'阵容介绍','do-uy':'都尉','moi-phe':'阵营强势（旧）'},
};

/** Bản zh: nhãn chữ Hán của giá trị cũ; bản vi hoặc giá trị lạ trả `null` để caller dùng nhãn sẵn có. */
export function legacyLabelZh(kind, value, locale = currentLocale()) {
  if (normalizeLocale(locale) !== 'zh' || typeof value !== 'string') return null;
  const table = LEGACY_LABEL_ZH[kind];
  return table && Object.hasOwn(table, value) ? table[value] : null;
}

/** Facet lặp được của danh sách đội; bộ lọc điểm đã bỏ nên `score` không còn ở đây. */
const REPEATABLE = ['faction','unit','tier','subcategory','source'];
/** Selector cũ của bảng xếp hạng: bỏ khỏi query Team, không map sang điểm nguồn. */
const RETIRED = ['stars','sort','point'];
const SCALARS = ['season','q','detail','legacyTeam','legacyVariant'];

export function readRecommendedQuery(href, registry = {}) {
  const url = new URL(href);
  const notices = [];
  const legacyTier = /\/doi-khac\/?$/.test(url.pathname) && url.searchParams.has('tier');
  const scalar = {};
  for (const key of SCALARS) {
    const values = url.searchParams.getAll(key).filter(Boolean);
    if (values.length > 1) notices.push(L(`Tham số ${key} bị lặp; chỉ dùng giá trị đầu.`, `参数 ${key} 重复，仅使用第一个值。`));
    scalar[key] = values[0] || null;
  }
  if (legacyTier || RETIRED.some(key=>url.searchParams.has(key))) notices.push(L('Bộ lọc sao và tham số sắp xếp cũ không còn áp dụng; đội giữ thứ tự nguồn cố định.', '旧的星级筛选和排序参数已不再适用；阵容保持来源的固定顺序。'));
  const viewValues = url.searchParams.getAll('view').filter(Boolean);
  if (viewValues.length > 1) notices.push(L('Tham số view bị lặp; chỉ dùng giá trị đầu.', '参数 view 重复，仅使用第一个值。'));
  const view = canonicalTeamView(viewValues[0]);
  if (viewValues[0] && !view) notices.push(L('Kiểu hiển thị không hợp lệ đã bị bỏ.', '无效的显示方式已被忽略。'));
  const seasons = new Set(registry.seasons || registry.seasonOptions?.map(item=>item.sourceSeasonId) || []);
  if (scalar.season && scalar.season !== 'all' && scalar.season !== 'unknown' && seasons.size && !seasons.has(scalar.season)) {
    notices.push(L('Mùa không tồn tại; đã dùng mùa mặc định.', '赛季不存在，已改用默认赛季。'));
    scalar.season = registry.defaultSourceSeasonId || [...seasons][0] || null;
  }
  return {
    season: scalar.season || registry.defaultSourceSeasonId || 'all',
    query: scalar.q || '', detail: scalar.detail,
    legacyTeam: scalar.legacyTeam, legacyVariant: scalar.legacyVariant, view,
    filters: Object.fromEntries(REPEATABLE.map(key=>[key,key === 'tier' && legacyTier ? [] : readFacet(url,key)])),
    notices,
  };
}

/** Facet lặp: giữ nguyên giá trị nguồn, bỏ trùng, không diễn giải. */
function readFacet(url,key) {
  return [...new Set(url.searchParams.getAll(key).filter(Boolean))];
}

/** Giá trị facet của một hàng, dùng chung cho projector và bộ đếm phạm vi của UI. */
export function referenceFacetValues(row,key) {
  if (key === 'tier') return row.sourceConfigId ? [row.tierRaw].filter(Boolean) : [];
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

// Corpus của mỗi hàng là bất biến trong một lần publication; nhãn registry và bộ phân giải tên zh là một
// phần của khóa cache. Bản zh thêm tên chữ Hán gốc và nhãn phe/binh chữ Hán để tìm bằng tiếng Trung.
const searchBlobs = new WeakMap();
function searchBlob(row,labels) {
  const resolver=currentLocale()==='zh' ? (zhNameResolver || 'zh') : null;
  const cached=searchBlobs.get(row);
  if (cached && cached.labels === labels && cached.resolver === resolver) return cached.blob;
  const terms=searchTerms(row,labels).filter(Boolean);
  const zhTerms=resolver ? terms.flatMap(term=>[
    sourceName(term),legacyLabelZh('faction',term),legacyLabelZh('unit',term),legacyLabelZh('source',term),
  ]).filter(term=>term && !terms.includes(term)) : [];
  const blob=normalizeText([...terms,...zhTerms].join(' '));
  searchBlobs.set(row,{labels,resolver,blob});
  return blob;
}

export const SOURCE_TIER_ORDER = ['T0','T0.5','T1','T1.5','T2','T3','FUNC','功能隊'];
export const sourceTierLabel = value => value === '功能隊' || value === 'FUNC' ? L('Đội chức năng','功能队') : value;

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
    for (const key of REPEATABLE) {
      const selected = state.filters?.[key] || [];
      if (selected.length && !referenceFacetValues(row,key).some(value=>selected.includes(value))) return false;
    }
    if (!queryTerms.length) return true;
    const blob=searchBlob(row,labels);
    return queryTerms.every(term=>blob.includes(term));
  }).slice().sort(fixedRank);
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
