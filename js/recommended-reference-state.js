import { normalizeText } from './filters.js';
import { canonicalTeamView, resolveTeamView } from './team-view.js';
import { L, contentLocaleIsVietnamese, currentLocale, normalizeLocale } from './i18n.js';

const CJK_TEXT = /[\u3400-\u9fff\uf900-\ufaff]/u;
/** Bộ tra tên theo locale; khóa `*` dùng cho mọi bản không phải tiếng Việt chưa có bộ riêng. */
const nameResolvers = new Map();
const ANY_SOURCE_LOCALE = '*';

/**
 * Bản không phải tiếng Việt: bộ phân giải tên Hán-Việt của dữ liệu cũ (`teams.json`, `khaihoang.json`, `coexist.json`) → tên của
 * bản đang xem, dựng từ từ điển tướng/chiến pháp/binh thư (bản zh: chữ Hán gốc, `createRawNameResolver`; bản ja: tên Nhật,
 * `createJaNameResolver`). `resolver.fromRaw(chữ Hán nguồn)` (tùy chọn) đổi chữ nguồn đã có chữ Hán; `resolver.prefixed`
 * (tùy chọn) dựng tên chiến pháp bản cải tạo. `locale` vắng thì bộ tra dùng cho mọi bản chưa có bộ riêng — trình duyệt chỉ có một
 * bản; lúc build dựng nhiều bản trong một tiến trình nên mỗi bản đăng ký riêng. Bản vi không cần gọi; truyền giá trị không phải
 * hàm để gỡ (vắng `locale`: gỡ mọi bộ).
 * @param {unknown} resolver
 * @param {string | null} [locale]
 */
export function setZhNameResolver(resolver, locale = null) {
  const key = locale === null || locale === undefined ? ANY_SOURCE_LOCALE : normalizeLocale(locale);
  if (typeof resolver === 'function') nameResolvers.set(key, resolver);
  else if (key === ANY_SOURCE_LOCALE) nameResolvers.clear();
  else nameResolvers.delete(key);
}

/** Bộ tra tên của bản `locale` (bản Việt: `null`). */
function nameResolverFor(locale) {
  if (contentLocaleIsVietnamese(locale)) return null;
  return nameResolvers.get(normalizeLocale(locale)) ?? nameResolvers.get(ANY_SOURCE_LOCALE) ?? null;
}

let tacticDisplayResolver = null;

/**
 * Bản vi: bộ tra tên chiến pháp lưu trong dữ liệu đội → `viet` hiện hành của danh mục (xem `createTacticDisplayName`).
 * Truyền giá trị không phải hàm để gỡ.
 */
export function setTacticDisplayName(resolver) {
  tacticDisplayResolver = typeof resolver === 'function' ? resolver : null;
}

/**
 * Tên chiến pháp hiển thị. Bản vi đổi tên lưu (Việt cũ hoặc chữ Hán `raw`) sang `viet` của danh mục khi tra được,
 * không tra được thì giữ nguyên; bản zh giữ nguyên (đã có đường tên chữ Hán riêng qua `sourceName`).
 */
export function tacticDisplayName(value, raw = null, locale = currentLocale()) {
  if (!tacticDisplayResolver || !contentLocaleIsVietnamese(locale)) return value;
  return tacticDisplayResolver(value, raw);
}

/**
 * Tên nguồn theo ngôn ngữ trang. Bản vi trả nguyên. Bản khác: chuỗi đã có chữ Hán đi qua `resolver.fromRaw` (bản zh giữ
 * nguyên, bản ja ra tên Nhật / tự dạng Nhật); tên Hán-Việt đổi sang tên của bản đang xem theo từng phần ngăn bởi `·`, `/`, `+`.
 * Phần không tra được bị bỏ (không trộn tiếng Việt vào trang); không còn phần nào thì trả chuỗi rỗng để caller hiện ô trống "—".
 */
export function sourceName(value, locale = currentLocale()) {
  const resolver = typeof value === 'string' ? nameResolverFor(locale) : null;
  if (!resolver) return value;
  if (CJK_TEXT.test(value)) return typeof resolver.fromRaw === 'function' ? resolver.fromRaw(value) : value;
  const parts = value.split(/(\s*[·/+]\s*)/u);
  const kept = [];
  for (let index = 0; index < parts.length; index += 2) {
    const name = parts[index].trim();
    const resolved = name ? resolver(name) : null;
    if (resolved) kept.push({ separator: index ? parts[index - 1] : '', resolved });
  }
  return kept.map((item, index) => (index ? item.separator : '') + item.resolved).join('');
}

/**
 * Tên chiến pháp bản cải tạo (`prefix`: `Tinh`/`Chuyển`/`Thác` hoặc `精`/`轉`/`拓`) theo bộ tra của bản đang xem khi bộ tra tự dựng
 * được (bản ja: tên kịch bản `prefixedTactics` hoặc `転・<tên Nhật>`); `undefined` khi bộ tra không hỗ trợ để caller dùng cách
 * ghép mặc định, chuỗi rỗng khi tên gốc không tra được.
 */
export function sourcePrefixedTactic(prefix, value, locale = currentLocale()) {
  const resolver = nameResolverFor(locale);
  if (typeof resolver?.prefixed !== 'function') return undefined;
  return resolver.prefixed(prefix, value) ?? '';
}

/** Nhãn chữ Hán (theo locale) của giá trị phe / loại binh / nguồn trong dữ liệu cũ (vốn ghi bằng tiếng Việt). */
const LEGACY_LABEL = {
  zh: {
    faction: {'Ngụy':'魏','Thục':'蜀','Ngô':'吴','Quần':'群','Hán':'汉','Hỗn hợp':'混合'},
    unit: {'Kỵ':'骑','Cung':'弓','Thương':'枪','Khiên':'盾','Khí giới':'器械'},
    source: {'team-intro':'阵容介绍','do-uy':'都尉','moi-phe':'阵营强势（旧）','youtube':'YouTube'},
  },
  ja: {
    faction: {'Ngụy':'魏','Thục':'蜀','Ngô':'呉','Quần':'群雄','Hán':'漢','Hỗn hợp':'混合'},
    unit: {'Kỵ':'騎兵','Cung':'弓兵','Thương':'槍兵','Khiên':'盾兵','Khí giới':'器械'},
    source: {'team-intro':'編成紹介','do-uy':'都尉','moi-phe':'勢力別強編成（旧）','youtube':'YouTube'},
  },
};

/** Bản zh/ja: nhãn chữ Hán của giá trị cũ; bản vi hoặc giá trị lạ trả `null` để caller dùng nhãn sẵn có. */
export function legacyLabelZh(kind, value, locale = currentLocale()) {
  if (contentLocaleIsVietnamese(locale) || typeof value !== 'string') return null;
  const table = LEGACY_LABEL[normalizeLocale(locale)]?.[kind];
  return table && Object.hasOwn(table, value) ? table[value] : null;
}

/**
 * Tier nguồn Nhật (bảng khớp Kazten đã review, `tierSources` của hàng Recommended do builder chiếu). Là một giá trị của facet
 * `source` sẵn có (`?source=jp`), không phải khóa facet riêng; `tierRaw` của SGSDeck giữ nguyên bên cạnh.
 */
export const TIER_SOURCE_JP = 'jp';
/** Mục tier JP của một hàng (`{source, tierRaw, matchKind, url, publishedAt}`), vắng thì `null`. */
export const jpTierSource = row => (Array.isArray(row?.tierSources) ? row.tierSources : [])
  .find(item => item?.source === TIER_SOURCE_JP && typeof item.tierRaw === 'string') ?? null;
/** Nhãn của tier JP: chip facet nguồn và tiêu đề khối trên trang chi tiết. */
export const jpTierSourceLabel = () => L('Tier JP','日服等级','日本版ティア');
/** Nhãn phụ khi bài nguồn dùng cùng ba tướng nhưng chiến pháp khác cấu hình SGSDeck (`matchKind: heroes-only`). */
export const jpTierMatchNote = item => item?.matchKind === 'heroes-only' ? L('khác chiến pháp','战法不同','戦法違い') : null;

/** Facet lặp được của danh sách đội; bộ lọc điểm đã bỏ nên `score` không còn ở đây. */
const REPEATABLE = ['faction','unit','tier','subcategory','source'];
/** Selector cũ của bảng xếp hạng: bỏ khỏi query Team, không map sang điểm nguồn. */
const RETIRED = ['stars','sort','point'];
const SCALARS = ['season','q','detail','legacyTeam','legacyVariant'];
/** Lọc theo kho (`kho=`): chỉ đội ráp được, hoặc đội thiếu tối đa 2 món. Chỉ có tác dụng khi danh sách có độ phủ kho. */
export const ROSTER_FILTER_READY = 'rap-duoc';
export const ROSTER_FILTER_NEAR = 'thieu-2';
const ROSTER_FILTER_LIMIT = {[ROSTER_FILTER_READY]: 0, [ROSTER_FILTER_NEAR]: 2};
/** Sắp theo kho (`xep=`): trong từng bậc, đội thiếu ít món đứng trước. Tên `sort` đã bỏ (RETIRED) nên không dùng lại. */
export const ROSTER_SORT_EASIEST = 'de-rap';
/** Giá trị đầu của `key` nếu nằm trong `allowed`; giá trị lạ coi như không có. */
const allowedParam = (url, key, allowed) => {
  const value = url.searchParams.getAll(key).filter(Boolean)[0];
  return value && allowed.includes(value) ? value : null;
};

export function readRecommendedQuery(href, registry = {}) {
  const url = new URL(href);
  const notices = [];
  const legacyTier = /\/doi-khac\/?$/.test(url.pathname) && url.searchParams.has('tier');
  const scalar = {};
  for (const key of SCALARS) {
    const values = url.searchParams.getAll(key).filter(Boolean);
    if (values.length > 1) notices.push(L(`Tham số ${key} bị lặp; chỉ dùng giá trị đầu.`, `参数 ${key} 重复，仅使用第一个值。`, `パラメータ ${key} が重複しています。最初の値のみ使用します。`));
    scalar[key] = values[0] || null;
  }
  if (legacyTier || RETIRED.some(key=>url.searchParams.has(key))) notices.push(L('Bộ lọc sao và tham số sắp xếp cũ không còn áp dụng; đội giữ thứ tự cố định.', '旧的星级筛选和排序参数已不再适用；阵容保持固定顺序。', '旧い星の絞り込みと並べ替えのパラメータは使用されなくなりました。編成は固定の順序で表示します。'));
  const viewValues = url.searchParams.getAll('view').filter(Boolean);
  if (viewValues.length > 1) notices.push(L('Tham số view bị lặp; chỉ dùng giá trị đầu.', '参数 view 重复，仅使用第一个值。', 'パラメータ view が重複しています。最初の値のみ使用します。'));
  const view = canonicalTeamView(viewValues[0]);
  if (viewValues[0] && !view) notices.push(L('Kiểu hiển thị không hợp lệ đã bị bỏ.', '无效的显示方式已被忽略。', '無効な表示形式は無視しました。'));
  const seasons = new Set(registry.seasons || registry.seasonOptions?.map(item=>item.sourceSeasonId) || []);
  if (scalar.season && scalar.season !== 'all' && scalar.season !== 'unknown' && seasons.size && !seasons.has(scalar.season)) {
    notices.push(L('Mùa không tồn tại; đã dùng mùa mặc định.', '赛季不存在，已改用默认赛季。', 'シーズンが存在しないため、既定のシーズンを使用しました。'));
    scalar.season = registry.defaultSourceSeasonId || [...seasons][0] || null;
  }
  return {
    season: scalar.season || registry.defaultSourceSeasonId || 'all',
    query: scalar.q || '', detail: scalar.detail,
    legacyTeam: scalar.legacyTeam, legacyVariant: scalar.legacyVariant, view,
    rosterFilter: allowedParam(url, 'kho', Object.keys(ROSTER_FILTER_LIMIT)),
    rosterSort: allowedParam(url, 'xep', [ROSTER_SORT_EASIEST]),
    filters: Object.fromEntries(REPEATABLE.map(key=>[key,key === 'tier' && legacyTier ? [] : readFacet(url,key)])),
    notices,
  };
}

/**
 * Trạng thái đưa vào danh sách Đội chuẩn (`family` = `recommended`) / Đội khác (`other`): query của URL cộng
 * kiểu hiển thị (URL > `storage` > Thẻ). Đội khác chỉ có một mùa (mùa mặc định của registry, hiện nhãn tĩnh) nên
 * mọi `?season=` bị bỏ qua: danh sách luôn đủ đội, không lọc mùa, không thông báo mùa lạ. Hàm thuần: trình
 * duyệt gọi với URL thật, bản dựng sẵn gọi với URL trang trống và `storage` rỗng — cùng một đường chọn mặc định.
 */
export function referenceSectionState(family, href, registry, storage = null) {
  if (family === 'other') {
    const url = new URL(href);
    url.searchParams.delete('season');
    const state = readRecommendedQuery(url.href, registry);
    // Lọc/sắp theo kho chỉ thuộc Đội chuẩn: Đội khác không có độ phủ kho.
    return {...state, season: 'all', view: resolveTeamView(state.view, storage), rosterFilter: null, rosterSort: null};
  }
  const state = readRecommendedQuery(href, registry);
  return {...state, view: resolveTeamView(state.view, storage)};
}

/**
 * Hàng Đội khác được đề cử (`recommended: true` do pipeline ghi, hiện cho nguồn YouTube). Chỉ hàng đội gốc
 * (không có `sourceConfigId`) mới tính; field vắng nghĩa là không đề cử.
 */
export const isRecommendedOtherRow = row => row?.recommended === true && !row.sourceConfigId;

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
  // Nguồn: bộ sưu tập của đội cũ (`row.source`) hoặc tier nguồn khác của hàng Recommended (hiện chỉ có JP).
  if (key === 'source') return [row.source,jpTierSource(row) ? TIER_SOURCE_JP : null].filter(Boolean);
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
    ...(holder.tacticSlotsVi || []).map((vi,index)=>tacticDisplayName(vi,holder.tacticSlotsRaw?.[index])),
    holder.tacticBeforeLevel20Raw,holder.tacticBeforeLevel20Vi,
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
      ...(hero.tactics || []).flatMap(item=>[item.name,tacticDisplayName(item.name),...(item.alternatives || []),...(item.alternatives || []).map(name=>tacticDisplayName(name))]),
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
  const resolver=!contentLocaleIsVietnamese(currentLocale()) ? (nameResolverFor(currentLocale()) || 'zh') : null;
  const cached=searchBlobs.get(row);
  if (cached && cached.labels === labels && cached.resolver === resolver && cached.display === tacticDisplayResolver) return cached.blob;
  const terms=searchTerms(row,labels).filter(Boolean);
  const zhTerms=resolver ? terms.flatMap(term=>[
    sourceName(term),legacyLabelZh('faction',term),legacyLabelZh('unit',term),legacyLabelZh('source',term),
  ]).filter(term=>term && !terms.includes(term)) : [];
  const blob=normalizeText([...terms,...zhTerms].join(' '));
  searchBlobs.set(row,{labels,resolver,display:tacticDisplayResolver,blob});
  return blob;
}

export const SOURCE_TIER_ORDER = ['T0','T0.5','T1','T1.5','T2','T3','FUNC','功能隊'];
export const sourceTierLabel = value => value === '功能隊' || value === 'FUNC' ? L('Đội chức năng','功能队','機能特化編成') : value;

function fixedRank(a,b) {
  // Đội khác: hàng đề cử đứng trước. Trong mỗi nhóm, hàng Đội khác không có `tierOrder`/`value`/`listIndex` nên thứ tự
  // rơi xuống tie-break cuối theo `legacyVariantId` (hash), KHÔNG phải thứ tự trong `other-teams.json` (xem #129).
  const recommended = Number(isRecommendedOtherRow(b)) - Number(isRecommendedOtherRow(a));
  if (recommended) return recommended;
  const tier = (a.tierOrder ?? 999) - (b.tierOrder ?? 999);
  if (tier) return tier;
  if (a.value == null && b.value != null) return 1;
  if (a.value != null && b.value == null) return -1;
  const score = (b.value ?? 0) - (a.value ?? 0);
  return score || (a.listIndex ?? 0) - (b.listIndex ?? 0) || String(a.sourceConfigId || a.legacyVariantId || a.legacyTeamId).localeCompare(String(b.sourceConfigId || b.legacyVariantId || b.legacyTeamId));
}

/**
 * `coverage` (tùy chọn) là `Map<sourceConfigId, {missingCount}>` của `buildListCoverage`. Vắng mặt thì `state.rosterFilter`
 * và `state.rosterSort` không có tác dụng và kết quả y như trước. Có mặt: lọc theo số món thiếu (đội không có độ phủ bị
 * loại khi đang lọc) và sắp trong từng bậc theo số món thiếu tăng dần (đội không có độ phủ đứng cuối bậc).
 */
export function projectRecommendedRows(rows,state,labels,coverage=null) {
  const query = normalizeText(state.query);
  const queryTerms=query.split(/\s+/).filter(Boolean);
  const missingOf=row=>coverage?.get(row.sourceConfigId)?.missingCount ?? null;
  const limit=coverage && state.rosterFilter ? ROSTER_FILTER_LIMIT[state.rosterFilter] : undefined;
  const easiest=Boolean(coverage && state.rosterSort === ROSTER_SORT_EASIEST);
  const rank=easiest ? (a,b)=>{
    const tier=(a.tierOrder ?? 999) - (b.tierOrder ?? 999);
    if (tier) return tier;
    const [left,right]=[missingOf(a),missingOf(b)];
    if (left !== right) return left === null ? 1 : right === null ? -1 : left - right;
    return fixedRank(a,b);
  } : fixedRank;
  return rows.filter(row => {
    if (!seasonMatches(row,state.season)) return false;
    if (limit !== undefined) {
      const missing=missingOf(row);
      if (missing === null || missing > limit) return false;
    }
    for (const key of REPEATABLE) {
      const selected = state.filters?.[key] || [];
      if (selected.length && !referenceFacetValues(row,key).some(value=>selected.includes(value))) return false;
    }
    if (!queryTerms.length) return true;
    const blob=searchBlob(row,labels);
    return queryTerms.every(term=>blob.includes(term));
  }).slice().sort(rank);
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

/** Toàn bộ đội gốc tự xác minh bytes raw trước khi tạo bản hiển thị. */
export async function loadVerifiedLegacyTeams(expectedHash, loadBytes) {
  if (!/^sha256:[0-9a-f]{64}$/.test(expectedHash || '')) throw new Error('Thiếu vân tay dữ liệu đội gốc.');
  const bytes = await loadBytes();
  if (`sha256:${await digest(bytes)}` !== expectedHash) throw new Error('Dữ liệu đội gốc không khớp vân tay của trang.');
  const teams = bytesToJson(bytes);
  if (!Array.isArray(teams)) throw new Error('Dữ liệu đội gốc sai định dạng.');
  return teams;
}
