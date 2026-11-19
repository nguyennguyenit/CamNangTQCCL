/**
 * Phần thân dựng sẵn của các trang đội (trang chi tiết + bốn trang danh sách). Dựng bằng đúng builder cây view
 * mà trình duyệt dùng (`js/recommended-reference-render.js`, `js/render.js`, `src/lib/team-section-ssr.js`) rồi
 * `treeToHtml`; dữ liệu là byte đã pin của publication (`websiteDisplayPublicationSnapshot`), bản Việt áp lớp
 * dịch bằng chính `loadWebsiteDisplay` + `localizeData` như trình duyệt.
 *
 * Trạng thái toàn cục mà builder cần (bảng route handle, bộ tra tên của bản zh và bản ja) đặt một lần ở `prepare()`.
 */
import { createRawNameResolver, loadWebsiteDisplay, localizeData } from '../../js/website-display.js';
import { treeToHtml, treeToText } from '../../js/view-tree.js';
import { projectRecommendedRows, setZhNameResolver } from '../../js/recommended-reference-state.js';
import { setTeamRouteHandles } from '../../js/team-detail-navigation.js';
import { detailBadges, legacyOriginalDetailContent, qilueLookupTable, recommendedTeamDetailContent, setCoexistQilueTable } from '../../js/recommended-reference-render.js';
import { khaihoangDetailTrees } from '../../js/render.js';
import { coexistScenarioBlocks, coexistSectionTrees, inertUntilBound, khaihoangSectionTrees, recommendedSectionTrees, seasonPageTrees } from './team-section-ssr.js';
import { loadSeasonModel } from '../../js/season-ui-state.js';
import { HERO_SUMMARY_FILE, parseHeroSummaries } from '../../js/hero-summaries.js';
import { TACTIC_SUMMARY_FILE, parseTacticSummaries } from '../../js/tactic-summaries.js';
import { lookupJaPublicationSnapshot, readPublicArtifact, seasonArtifactHashes, websiteDisplayPublicationSnapshot, type WebsiteDisplayPublicationSnapshot } from './root-static-artifacts.ts';
import { teamDetailCatalog } from './team-detail-routes.ts';
import { lookupJaNameResolver, lookupRouteHandles } from './lookup-pages.ts';
import { tacticDisplayTable } from './tactic-display.ts';
import type { SiteLocale } from './locale-routes';
import type { LegacyRouteEntry, KhaiHoangRouteEntry, RecommendedRouteEntry } from './team-detail-routes.ts';

type Tree = unknown;
type Json = any;

const parse = (bytes: Uint8Array) => JSON.parse(Buffer.from(bytes).toString('utf8'));
const html = (trees: Tree[]) => trees.map((tree) => treeToHtml(tree)).join('');

interface Environment {
  website: WebsiteDisplayPublicationSnapshot;
  publication: unknown;
  localized: Map<string, Json>;
  /** Tên Việt → chữ Hán nguồn (bản zh), cùng bộ tra đã đăng ký cho builder đội. */
  rawName: (viName: string) => string | null;
}

let environment: Promise<Environment> | undefined;

/** Nạp publication đã pin và đăng ký trạng thái toàn cục của builder (một lần cho cả lần build). */
export function prepare() {
  return environment ??= (async () => {
    const website = await websiteDisplayPublicationSnapshot();
    const catalog = await teamDetailCatalog();
    const dicts = await Promise.all(['heroes-dict', 'tactics', 'books-dict'].map(async (routeParam) =>
      parse((await readPublicArtifact({ kind: 'data', routeParam })).bytes)));
    const rawName = createRawNameResolver(...dicts);
    // Build dựng mọi bản trong một tiến trình: mỗi bản đăng ký bộ tra riêng (zh: chữ Hán gốc; ja: tên Nhật, cùng dữ liệu mà
    // trang `/ja/` nạp lại ở trình duyệt qua `loadRawNameResolver`).
    setZhNameResolver(rawName, 'zh');
    setZhNameResolver(await lookupJaNameResolver(), 'ja');
    // Cùng bảng route handle mà SiteLayout nhúng cho trang mục (`r`/`l`/`k`).
    const registered = setTeamRouteHandles({
      r: Object.fromEntries(catalog.recommended.map((entry) => [entry.sourceConfigId, entry.routeSegment])),
      l: Object.fromEntries(catalog.legacy.map((entry) => [entry.legacyTeamId, entry.routeSegment])),
      k: Object.fromEntries(catalog.khaiHoang.map((entry) => [entry.khaiHoangTeamId, entry.handle])),
    });
    if (!registered) throw new Error('Team route handle table rejected while preparing prerendered team pages');
    // Link Tra cứu của trang đội trỏ tới trang riêng: ngoại lệ slug của ledger phải đăng ký trước khi builder dựng href.
    await lookupRouteHandles();
    // Bản Việt: tên chiến pháp lưu → `viet` hiện hành, cùng bảng nhúng `#tactic-display-names` mà trình duyệt đọc lại.
    await tacticDisplayTable();
    const bytesOf = (name: string) => {
      const basename = name === 'website-display.json' ? name : name.replace(/^data\//, '');
      const bytes = website.publicFiles[basename];
      if (!bytes) throw new Error(`Prerender source is not part of the website display publication: ${name}`);
      return Promise.resolve(new Uint8Array(bytes));
    };
    const publication = await loadWebsiteDisplay(website.pin, bytesOf, website.recommended.pin);
    return { website, publication, localized: new Map<string, Json>(), rawName };
  })();
}

/** Dữ liệu `data/<name>.json` đã bản địa hoá theo ngôn ngữ trang (bản zh giữ chữ nguồn), dùng chung giữa các trang. */
async function localizedData(name: 'teams' | 'khaihoang', locale: SiteLocale): Promise<Json> {
  const env = await prepare();
  const key = `${name}:${locale}`;
  let data = env.localized.get(key);
  if (!data) {
    data = localizeData(env.publication, `data/${name}.json`, parse(env.website.publicFiles[`${name}.json`]), locale);
    env.localized.set(key, data);
  }
  return data;
}

export interface TeamDetailParts {
  /** HTML thân trang (`#team-detail-body`). */
  bodyHtml: string;
  /** HTML huy hiệu phe/loại binh của đầu trang; rỗng thì ẩn khối. */
  badgesHtml: string;
}

interface QilueContext {
  /** `qilueLookupTable` của lookup-catalog.json đã pin trong publication: mã kỳ lược → tên vi/zh/ja, loại, độ hiếm. */
  table: Json;
  /** Bản ghi index cùng generation theo `sourceConfigId`: đội nguồn của dạng kỳ lược chép (`form: copy`). */
  teams: Map<string, Json>;
}

let qilueContext: Promise<QilueContext> | undefined;

/** Bảng tra kỳ lược + index đội cho section Kỳ lược của trang chi tiết (một lần cho cả lần build, dùng chung mọi bản và llms). */
function qilueOptions() {
  return qilueContext ??= (async () => {
    const env = await prepare();
    const catalog = parse((await readPublicArtifact({ kind: 'data', routeParam: 'lookup-catalog' })).bytes);
    // Tên Nhật của mục kỳ lược: cùng lớp lookup-ja đã kiểm mà trang Tra cứu `/ja/` dùng.
    const ja = await lookupJaPublicationSnapshot();
    const rows: Json[] = parse(env.website.recommended.files['index.json'])?.records ?? [];
    return { table: qilueLookupTable(catalog, ja.document), teams: new Map(rows.map((row) => [row.sourceConfigId, row])) };
  })();
}

/**
 * Cây thân + huy hiệu của trang chi tiết Đội chuẩn; `record` là bản ghi chi tiết đã pin của cấu hình. `plainText`: bản
 * chữ thuần cho llms (section Kỳ lược thu về dòng gọn).
 */
async function recommendedDetailTrees(record: Json, lookupLinks: unknown, locale: SiteLocale, plainText = false) {
  const env = await prepare();
  const labels = parse(env.website.recommended.files['seasons.json'])?.displayLabels ?? null;
  const legacyTeams = await localizedData('teams', locale);
  const qilue = await qilueOptions();
  // Tùy chọn của builder JS (không có kiểu JSDoc): `lookupLinks`/`qilueTable`/`qilueTeams`/`plainText`/`locale` là khóa hợp lệ.
  const options: Json = { legacyTeams, labels, lookupLinks, qilueTable: qilue.table, qilueTeams: qilue.teams, plainText, locale };
  return { body: recommendedTeamDetailContent(record, options) as Tree[], badges: detailBadges(record, labels, { locale }) as Tree[] };
}

/** Thân + huy hiệu trang chi tiết Đội chuẩn. */
export async function recommendedDetailParts(record: Json, lookupLinks: unknown, locale: SiteLocale): Promise<TeamDetailParts> {
  const { body, badges } = await recommendedDetailTrees(record, lookupLinks, locale);
  return { bodyHtml: html(body), badgesHtml: html(badges) };
}

/** Chữ thuần của trang chi tiết Đội chuẩn (huy hiệu rồi thân) — llms.txt dùng cùng builder và cùng bản ghi với HTML. */
export async function recommendedDetailText(record: Json, lookupLinks: unknown, locale: SiteLocale): Promise<string> {
  const { body, badges } = await recommendedDetailTrees(record, lookupLinks, locale, true);
  return treeToText([...badges, ...body]);
}

let recommendedLegacyIds: Promise<Set<string>> | undefined;

/** Mã đội gốc có ít nhất một hàng `recommended: true` trong `other-teams.json` đã pin (field vắng = không đề cử). */
function recommendedLegacyTeamIds() {
  return recommendedLegacyIds ??= (async () => {
    const env = await prepare();
    const admitted: Json[] = parse(env.website.recommended.files['other-teams.json'])?.records ?? [];
    return new Set<string>(admitted.filter((row) => row.recommended === true).map((row) => row.legacyTeamId));
  })();
}

/** Binh thư tham khảo của một tướng: số đội có binh thư và top tên Việt (hình dạng `bookHint` của builder JS). */
export interface LegacyBookHint {
  teams: number;
  items: string[];
}

let heroBookHintIndex: Promise<Map<string, LegacyBookHint>> | undefined;

/**
 * Tên Việt của tướng (`searchName` trong `hero-summaries.json` đã kiểm) → binh thư hay dùng. Tên trùng nhau giữa hai
 * mục số liệu bị bỏ hẳn (không đoán tướng nào); tướng chưa có đội nào ghi binh thư không có gợi ý.
 */
function heroBookHints() {
  return heroBookHintIndex ??= (async () => {
    const { heroes } = await lookupSummaryTables();
    const index = new Map<string, LegacyBookHint>();
    const ambiguous = new Set<string>();
    for (const summary of Object.values(heroes as Record<string, Json>)) {
      const name = String(summary.searchName).trim();
      if (index.has(name) || ambiguous.has(name)) {
        index.delete(name);
        ambiguous.add(name);
        continue;
      }
      const items = (summary.books.items as Json[]).map((item) => String(item.name));
      if (summary.books.teams > 0 && items.length) index.set(name, { teams: summary.books.teams, items });
    }
    return index;
  })();
}

let admittedVariantIndex: Promise<Map<string, Json[]>> | undefined;

/**
 * `legacyTeamId` → nội dung các biến thể đã admit trong `other-teams.json` đã pin. Parse một lần cho cả lần build (file
 * ~1 MB, trang Đội khác dựng hàng trăm lần mỗi locale), mỗi trang chỉ tra đúng đội của mình.
 */
function admittedVariantContents() {
  return admittedVariantIndex ??= (async () => {
    const env = await prepare();
    const rows: Json[] = parse(env.website.recommended.files['other-teams.json'])?.records ?? [];
    const index = new Map<string, Json[]>();
    for (const row of rows) {
      if (typeof row?.legacyTeamId !== 'string' || !row.legacyContent) continue;
      const list = index.get(row.legacyTeamId);
      if (list) list.push(row.legacyContent);
      else index.set(row.legacyTeamId, [row.legacyContent]);
    }
    return index;
  })();
}

/**
 * Gợi ý binh thư cho mọi tướng có thể hiện trên trang một đội khác: tướng của đội gốc và của các biến thể đã admit
 * (nhánh `?variant=` dựng lại phía client bằng cùng bảng). Builder chỉ dùng gợi ý cho tướng mà nội dung không ghi binh thư.
 */
async function legacyBookHints(team: Json): Promise<Record<string, LegacyBookHint>> {
  const index = await heroBookHints();
  const contents = [team, ...((await admittedVariantContents()).get(team.id) ?? [])];
  const hints: Record<string, LegacyBookHint> = {};
  for (const content of contents) {
    for (const hero of (content.heroes ?? []) as Json[]) {
      const name = typeof hero?.name === 'string' ? hero.name.trim() : '';
      const hint = name ? index.get(name) : undefined;
      if (hint) hints[name] = hint;
    }
  }
  return hints;
}

async function legacyDetailTrees(entry: LegacyRouteEntry, locale: SiteLocale) {
  const teams: Json[] = await localizedData('teams', locale);
  const matches = teams.filter((team) => team.id === entry.legacyTeamId);
  if (matches.length !== 1) throw new Error(`Legacy team must resolve to exactly one record: ${entry.legacyTeamId}`);
  // Đề cử nằm ở hàng `other-teams.json` đã admit (không ở `teams.json`): đội có hàng đề cử nào thì hiện nhãn ở trạng thái không có biến thể.
  const referenceRecommended = (await recommendedLegacyTeamIds()).has(entry.legacyTeamId);
  const bookHints = await legacyBookHints(matches[0]);
  // Tùy chọn của builder JS (không có kiểu JSDoc): `locale`/`bookHints` là khóa hợp lệ.
  const options: Json = { locale, bookHints };
  return {
    body: legacyOriginalDetailContent(matches[0], options) as Tree[],
    badges: detailBadges({ ...matches[0], referenceRecommended }, null, { locale }) as Tree[],
    bookHints,
  };
}

/**
 * Thân + huy hiệu trang chi tiết Đội khác (nội dung đội gốc ở trạng thái không có biến thể), kèm bảng gợi ý binh thư
 * để trang nhúng vào `data-book-hints` cho nhánh biến thể phía client.
 */
export async function legacyDetailParts(entry: LegacyRouteEntry, locale: SiteLocale): Promise<TeamDetailParts & { bookHints: Record<string, LegacyBookHint> }> {
  const { body, badges, bookHints } = await legacyDetailTrees(entry, locale);
  return { bodyHtml: html(body), badgesHtml: html(badges), bookHints };
}

export async function legacyDetailText(entry: LegacyRouteEntry, locale: SiteLocale): Promise<string> {
  const { body, badges } = await legacyDetailTrees(entry, locale);
  return treeToText([...badges, ...body]);
}

async function khaiHoangDetailTrees(entry: KhaiHoangRouteEntry, locale: SiteLocale) {
  const data: Json = await localizedData('khaihoang', locale);
  const matches = (Array.isArray(data) ? [] : data.teams || []).filter((team: Json) => team?.id === entry.khaiHoangTeamId);
  if (matches.length !== 1) throw new Error(`Khai hoang team must resolve to exactly one record: ${entry.khaiHoangTeamId}`);
  const [team] = matches;
  const options: Json = { variantId: '', locale };
  return { body: inertUntilBound(khaihoangDetailTrees(team, options)) as Tree[], badges: detailBadges({ unitType: team.unitType ? [team.unitType] : [], khaihoangRecommended: team.recommended === true }, null, { locale }) as Tree[] };
}

/** Thân + huy hiệu trang chi tiết Khai hoang ở cấu hình mặc định. */
export async function khaiHoangDetailParts(entry: KhaiHoangRouteEntry, locale: SiteLocale): Promise<TeamDetailParts> {
  const { body, badges } = await khaiHoangDetailTrees(entry, locale);
  return { bodyHtml: html(body), badgesHtml: html(badges) };
}

export async function khaiHoangDetailText(entry: KhaiHoangRouteEntry, locale: SiteLocale): Promise<string> {
  const { body, badges } = await khaiHoangDetailTrees(entry, locale);
  return treeToText([...badges, ...body]);
}

export type TeamSection = 'team-chuan' | 'team-khac' | 'coexist' | 'khaihoang';
export const PRERENDERED_TEAM_SECTIONS: readonly string[] = ['team-chuan', 'team-khac', 'coexist', 'khaihoang'];

let seasonModelPromise: Promise<unknown> | undefined;

/** Mô hình mùa đã xác minh theo hash của publication (cùng `loadSeasonModel` mà trình duyệt chạy). */
function seasonModel() {
  return seasonModelPromise ??= (async () => {
    const hashes = await seasonArtifactHashes();
    return loadSeasonModel(hashes, async (name: string) => new Uint8Array((await readPublicArtifact({ kind: 'data', routeParam: name })).bytes));
  })();
}

let coexistQilueJson: Promise<string> | undefined;

/**
 * Bảng tra Thẻ Kỳ Lược của thẻ Cùng Tồn từ lookup-catalog.json đã pin: đăng ký cho builder (`setCoexistQilueTable`) và
 * trả JSON gọn (mã, tên vi/zh, loại, độ hiếm; `jaNames` là tên Nhật của thẻ theo cùng lớp lookup-ja mà Đội chuẩn dùng)
 * mà trang `/cung-ton/` nhúng ở `#coexist-qilue-table` để trình duyệt dựng lại thẻ khi đổi mùa/nhóm bằng đúng bảng của
 * bản dựng sẵn. Bản ja cần tên Nhật của mọi thẻ (`qilueItem` dừng build khi thiếu).
 */
export function coexistQilueTableJson(): Promise<string> {
  return coexistQilueJson ??= (async () => {
    const catalog = parse((await readPublicArtifact({ kind: 'data', routeParam: 'lookup-catalog' })).bytes);
    const rows = Array.isArray(catalog?.qilueCards) ? catalog.qilueCards : [];
    const jaEntries = (await lookupJaPublicationSnapshot()).document?.entries ?? {};
    const jaNames: Json = Object.fromEntries(rows
      .filter(({ id }: Json) => typeof jaEntries[id]?.name === 'string' && jaEntries[id].name.trim())
      .map(({ id }: Json) => [id, { name: jaEntries[id].name }]));
    const compact = {
      qilueStrategies: [],
      qilueCards: rows.map(({ id, nameVi, nameZh, type, rarity }: Json) => ({ id, nameVi, nameZh, type, rarity })),
      jaNames,
    };
    setCoexistQilueTable(qilueLookupTable(compact, jaNames));
    return JSON.stringify(compact).replace(/</g, '\\u003c');
  })();
}

export interface TeamSectionParts {
  /** HTML thân của mục ở trạng thái mặc định (nằm trong `#section-<mục>`). */
  html: string;
  /** Vân tay publication hiển thị mà HTML được dựng từ đó; trình duyệt chỉ nhận lại DOM khi trùng pin đã xác minh. */
  source: string;
}

export async function teamSectionParts(section: TeamSection, locale: SiteLocale): Promise<TeamSectionParts> {
  const env = await prepare();
  const source = env.website.pin.sha256;
  if (section === 'team-chuan' || section === 'team-khac') {
    const registry = parse(env.website.recommended.files['seasons.json']);
    const family = section === 'team-khac' ? 'other' : 'recommended';
    const rows = parse(env.website.recommended.files[family === 'other' ? 'other-teams.json' : 'index.json']).records;
    return { html: html(recommendedSectionTrees({ family, rows, registry, locale })), source };
  }
  if (section === 'coexist') {
    await coexistQilueTableJson();
    return { html: html(coexistSectionTrees({ model: await seasonModel(), locale })), source };
  }
  return { html: html(khaihoangSectionTrees({ data: await localizedData('khaihoang', locale), locale })), source };
}

export interface SeasonPageParts {
  /** Thân trang mùa (đội nhóm theo Tier) dựng bằng đúng builder thẻ của danh sách. */
  bodyHtml: string;
  /** Vân tay publication mà HTML được dựng từ đó. */
  source: string;
  /** Route của mọi đội của mùa theo thứ tự hiển thị (cho `ItemList` của JSON-LD). */
  teams: RecommendedRouteEntry[];
}

/** Trang mùa Đội chuẩn: thân + danh sách đội cho `ItemList`. Mọi đội của mùa, không phân trang. */
export async function seasonPageParts(sourceSeasonId: string, locale: SiteLocale): Promise<SeasonPageParts> {
  const env = await prepare();
  const registry = parse(env.website.recommended.files['seasons.json']);
  const rows = parse(env.website.recommended.files['index.json']).records;
  const catalog = await teamDetailCatalog();
  const byConfig = new Map(catalog.recommended.map((entry) => [entry.sourceConfigId, entry]));
  const season = rows.filter((row: Json) => row.sourceSeasonId === sourceSeasonId);
  const teams = projectRecommendedRows(season, { season: sourceSeasonId, query: '', filters: {} }, registry.displayLabels || {}).map((row: Json) => {
    const entry = byConfig.get(row.sourceConfigId);
    if (!entry) throw new Error(`Season page team has no route: ${row.sourceConfigId}`);
    return entry;
  });
  return {
    bodyHtml: html(seasonPageTrees({ rows, sourceSeasonId, registry, locale })),
    source: env.website.pin.sha256,
    teams,
  };
}

export interface CoexistScenarioText {
  scenarioId: string;
  label: string;
  /** Query của URL mùa trên trang Cùng Tồn (`?scenario=<mã mùa>`). */
  query: string;
  /** Chữ thuần của từng nhóm đội của mùa. */
  groups: string[];
}

/** Chữ thuần của mọi nhóm Cùng Tồn theo từng mùa đã duyệt (llms.txt). */
export async function coexistScenarioTexts(locale: SiteLocale): Promise<CoexistScenarioText[]> {
  await prepare();
  await coexistQilueTableJson();
  const blocks = coexistScenarioBlocks({ model: await seasonModel(), locale }) as Array<{ scenarioId: string; label: string; query: string; groups: Tree[] }>;
  return blocks.map((block) => ({ ...block, groups: block.groups.map((tree) => treeToText(tree)) }));
}

export interface LookupSummaryTables {
  /** `hero-summaries.json` đã kiểm đối chiếu kho tướng của publication ("Trong cẩm nang" của hồ sơ tướng). */
  heroes: Json;
  /** `tactic-summaries.json` đã kiểm đối chiếu kho chiến pháp + tướng. */
  tactics: Json;
  /** Tên Việt → chữ Hán nguồn cho khối "Trong cẩm nang" bản zh. */
  rawName: (viName: string) => string | null;
}

let lookupSummaries: Promise<LookupSummaryTables> | undefined;

/**
 * Số liệu "Trong cẩm nang" của trang riêng tướng và chiến pháp: đúng hai file của generation Recommended đã pin, cùng
 * bộ kiểm (`parseHeroSummaries`/`parseTacticSummaries`) và cùng khóa nối với kho Tra cứu mà trình duyệt dùng. Cũng đăng ký
 * bảng route handle đội để link "đội tiêu biểu" trỏ đúng trang chi tiết.
 */
export function lookupSummaryTables() {
  return lookupSummaries ??= (async () => {
    const env = await prepare();
    const hashes = (env.publication as Json)?.sourceHashes ?? {};
    return {
      heroes: parseHeroSummaries(parse(env.website.recommended.files[HERO_SUMMARY_FILE]), { catalogSha256: hashes['data/heroes-dict.json'] }),
      tactics: parseTacticSummaries(parse(env.website.recommended.files[TACTIC_SUMMARY_FILE]), {
        tacticCatalogSha256: hashes['data/tactics.json'],
        heroCatalogSha256: hashes['data/heroes-dict.json'],
      }),
      rawName: env.rawName,
    };
  })();
}
