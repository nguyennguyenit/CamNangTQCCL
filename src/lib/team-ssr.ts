/**
 * Phần thân dựng sẵn của các trang đội (trang chi tiết + bốn trang danh sách). Dựng bằng đúng builder cây view
 * mà trình duyệt dùng (`js/recommended-reference-render.js`, `js/render.js`, `src/lib/team-section-ssr.js`) rồi
 * `treeToHtml`; dữ liệu là byte đã pin của publication (`websiteDisplayPublicationSnapshot`), bản Việt áp lớp
 * dịch bằng chính `loadWebsiteDisplay` + `localizeData` như trình duyệt.
 *
 * Trạng thái toàn cục mà builder cần (bảng route handle, bộ tra tên Hán của bản zh) đặt một lần ở `prepare()`.
 */
import { createRawNameResolver, loadWebsiteDisplay, localizeData } from '../../js/website-display.js';
import { treeToHtml, treeToText } from '../../js/view-tree.js';
import { projectRecommendedRows, setZhNameResolver } from '../../js/recommended-reference-state.js';
import { setTeamRouteHandles } from '../../js/team-detail-navigation.js';
import { detailBadges, legacyOriginalDetailContent, recommendedTeamDetailContent } from '../../js/recommended-reference-render.js';
import { khaihoangDetailTrees } from '../../js/render.js';
import { coexistScenarioBlocks, coexistSectionTrees, inertUntilBound, khaihoangSectionTrees, recommendedSectionTrees, seasonPageTrees } from './team-section-ssr.js';
import { loadSeasonModel } from '../../js/season-ui-state.js';
import { HERO_SUMMARY_FILE, parseHeroSummaries } from '../../js/hero-summaries.js';
import { TACTIC_SUMMARY_FILE, parseTacticSummaries } from '../../js/tactic-summaries.js';
import { readPublicArtifact, seasonArtifactHashes, websiteDisplayPublicationSnapshot, type WebsiteDisplayPublicationSnapshot } from './root-static-artifacts.ts';
import { teamDetailCatalog } from './team-detail-routes.ts';
import { lookupRouteHandles } from './lookup-pages.ts';
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
    setZhNameResolver(rawName);
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

/** Cây thân + huy hiệu của trang chi tiết Đội chuẩn; `record` là bản ghi chi tiết đã pin của cấu hình. */
async function recommendedDetailTrees(record: Json, lookupLinks: unknown, locale: SiteLocale) {
  const env = await prepare();
  const labels = parse(env.website.recommended.files['seasons.json'])?.displayLabels ?? null;
  const legacyTeams = await localizedData('teams', locale);
  // Tùy chọn của builder JS (không có kiểu JSDoc): `lookupLinks`/`locale` là khóa hợp lệ.
  const options: Json = { legacyTeams, labels, lookupLinks, locale };
  return { body: recommendedTeamDetailContent(record, options) as Tree[], badges: detailBadges(record, labels, { locale }) as Tree[] };
}

/** Thân + huy hiệu trang chi tiết Đội chuẩn. */
export async function recommendedDetailParts(record: Json, lookupLinks: unknown, locale: SiteLocale): Promise<TeamDetailParts> {
  const { body, badges } = await recommendedDetailTrees(record, lookupLinks, locale);
  return { bodyHtml: html(body), badgesHtml: html(badges) };
}

/** Chữ thuần của trang chi tiết Đội chuẩn (huy hiệu rồi thân) — llms.txt dùng đúng cây mà HTML dựng từ. */
export async function recommendedDetailText(record: Json, lookupLinks: unknown, locale: SiteLocale): Promise<string> {
  const { body, badges } = await recommendedDetailTrees(record, lookupLinks, locale);
  return treeToText([...badges, ...body]);
}

async function legacyDetailTrees(entry: LegacyRouteEntry, locale: SiteLocale) {
  const teams: Json[] = await localizedData('teams', locale);
  const matches = teams.filter((team) => team.id === entry.legacyTeamId);
  if (matches.length !== 1) throw new Error(`Legacy team must resolve to exactly one record: ${entry.legacyTeamId}`);
  return { body: legacyOriginalDetailContent(matches[0], { locale }) as Tree[], badges: detailBadges(matches[0], null, { locale }) as Tree[] };
}

/** Thân + huy hiệu trang chi tiết Đội khác (nội dung đội gốc ở trạng thái không có biến thể). */
export async function legacyDetailParts(entry: LegacyRouteEntry, locale: SiteLocale): Promise<TeamDetailParts> {
  const { body, badges } = await legacyDetailTrees(entry, locale);
  return { bodyHtml: html(body), badgesHtml: html(badges) };
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
  return { body: inertUntilBound(khaihoangDetailTrees(team, options)) as Tree[], badges: detailBadges({ unitType: team.unitType ? [team.unitType] : [] }, null, { locale }) as Tree[] };
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
  if (section === 'coexist') return { html: html(coexistSectionTrees({ model: await seasonModel(), locale })), source };
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
