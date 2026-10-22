/**
 * `getStaticPaths` dùng chung cho ba họ trang chi tiết đội ở cả bản Việt và bản Trung. Route `[team].astro`
 * (vi) và `zh/…/[team].astro` chỉ gọi hàm ở đây rồi truyền props cho component trang.
 *
 * Tiêu đề bản Trung: đội chuẩn dùng tên chữ Hán gốc (`nameZh`); đội khác và Khai hoang (dữ liệu cũ chỉ ghi
 * tên Hán-Việt) ghép tên tướng chữ Hán tra qua từ điển có trường `chinese` — cùng cách js/recommended-reference-render.js
 * (`legacyTitle`) và js/render.js dựng tên đội ở bản zh. Tên không tra được bị bỏ để trang zh không lẫn tiếng Việt.
 */
import { createLookupIdResolver } from '../../js/lookup-ids.js';
import { createRawNameResolver } from '../../js/website-display.js';
import { legacyLabelZh } from '../../js/recommended-reference-state.js';
import { holderDisplayName } from '../../js/recommended-reference-render.js';
import { SOURCE_LABEL } from '../../js/render.js';
import { readPublicArtifact, websiteDisplayPublicationSnapshot } from './root-static-artifacts.ts';
import {
  detailTitleRanks,
  teamDetailCatalog,
  type KhaiHoangRouteEntry,
  type LegacyRouteEntry,
  type RecommendedRouteEntry,
  type TeamDetailRouteCatalog,
} from './team-detail-routes.ts';
import { recommendedDetailParts, recommendedDetailText, type TeamDetailParts } from './team-ssr.ts';
import { lookupDetailRoutes } from './lookup-detail-routes.ts';
import { isOldSeason, seasonPages } from './season-pages.ts';
import type { NamedPath } from './structured-data.ts';
import { localePath } from '../../js/i18n.js';
import type { SiteLocale } from './locale-routes';

const CJK = /[\u3400-\u9fff\uf900-\ufaff]/u;
/** Tiêu đề bản Việt khi nguồn chưa dịch: không được lộ chữ Hán ra tiêu đề công khai. */
export const VI_UNAVAILABLE = 'Nội dung tiếng Việt chưa sẵn sàng';

const json = (bytes: Uint8Array) => JSON.parse(Buffer.from(bytes).toString('utf8'));

let zhNamesPromise: Promise<(name: string) => string | null> | undefined;

/** Bộ tra tên chữ Hán gốc từ tên Hán-Việt (tướng, chiến pháp, binh thư) — đúng ba từ điển của js/website-display.js. */
function zhNameResolver() {
  return zhNamesPromise ??= (async () => {
    const dicts = await Promise.all(['heroes-dict', 'tactics', 'books-dict'].map(async (routeParam) =>
      json((await readPublicArtifact({ kind: 'data', routeParam })).bytes)));
    const resolve = createRawNameResolver(...dicts);
    // Tiền tố biến thể (SP/CO/40Y) giữ nguyên khi chỉ tên gốc có trong từ điển.
    return (name: string) => {
      const value = String(name ?? '').trim();
      if (!value) return null;
      if (CJK.test(value)) return value;
      const whole = resolve(value);
      if (whole) return whole;
      const variant = value.match(/^(SP|CO|40Y)\s+(.+)$/u);
      const base = variant ? resolve(variant[2]) : null;
      return base ? `${variant![1]}${base}` : null;
    };
  })();
}

/** Tên đội bản Trung ghép từ tên tướng chữ Hán; tướng không tra được bị bỏ, không còn ai thì trả `null`. */
function lineupTitleZh(heroNames: readonly string[], resolve: (name: string) => string | null) {
  const names = heroNames.map((name) => resolve(name)).filter((name): name is string => Boolean(name));
  return names.length ? names.join(' · ') : null;
}

/** Tên mùa nguồn chữ Hán (`seasonOptions[].nameRaw`) theo `sourceSeasonId` của thế hệ Đội chuẩn đã pin. */
async function recommendedSeasonNamesRaw() {
  const website = await websiteDisplayPublicationSnapshot();
  const seasons = json(website.recommended.files['seasons.json']);
  const names = new Map<string, string>();
  for (const option of Array.isArray(seasons?.seasonOptions) ? seasons.seasonOptions : []) {
    if (typeof option?.sourceSeasonId === 'string' && typeof option?.nameRaw === 'string' && option.nameRaw.trim()) {
      names.set(option.sourceSeasonId, option.nameRaw.trim());
    }
  }
  return names;
}

/** `sourceSeasonId` theo thứ tự registry mùa (`seasons.json` `seasonOptions`) của thế hệ Đội chuẩn đã pin. */
export async function recommendedSeasonOrder(): Promise<string[]> {
  const website = await websiteDisplayPublicationSnapshot();
  const seasons = json(website.recommended.files['seasons.json']);
  return (Array.isArray(seasons?.seasonOptions) ? seasons.seasonOptions : [])
    .map((option: { sourceSeasonId?: unknown }) => option?.sourceSeasonId)
    .filter((id: unknown): id is string => typeof id === 'string');
}

/** Bộ tra của js/lookup-ids.js (`createLookupIdResolver`): tên nguồn chữ Hán + tên Việt → mã hồ sơ Tra cứu. */
interface LookupIdResolver {
  tactic(raw: string | null, vi: string | null): string | null;
  book(raw: string | null, vi: string | null): string | null;
  hero(raw: string | null, vi: string | null): string | null;
}
/** Mã hồ sơ Tra cứu theo khoá tên (chữ Hán nguồn, thiếu thì tên Việt); builder cây view (`lookupLinks`) đọc cùng dạng này khi dựng thân trang. */
export interface TeamLookupLinks {
  tactic: Record<string, string>;
  book: Record<string, string>;
}

let lookupResolverPromise: Promise<LookupIdResolver> | undefined;

/** Bộ tra mã hồ sơ chiến pháp / binh thư / tướng từ đúng ba từ điển mà trang Tra cứu dùng. */
function lookupIdResolver() {
  return lookupResolverPromise ??= (async () => {
    const [tactics, books, heroes] = await Promise.all(['tactics', 'books-dict', 'heroes-dict'].map(async (routeParam) =>
      json((await readPublicArtifact({ kind: 'data', routeParam })).bytes)));
    return createLookupIdResolver({ tactics, books, heroes });
  })();
}

interface HeroRow {
  raw?: unknown;
  vi?: unknown;
  /** Tên tướng đúng như trang hiển thị; vắng thì `raw` (bản zh) hoặc `vi` (bản vi). */
  shown?: unknown;
}

/**
 * Bộ dựng danh sách tướng có trang riêng của một đội theo ngôn ngữ trang: mỗi tướng một lần, theo thứ tự đội, tên đúng như
 * trang hiển thị; tướng không có hồ sơ Tra cứu (hoặc không có tên ở ngôn ngữ này) không có mặt.
 */
async function heroLinkBuilder(locale: SiteLocale) {
  const [resolve, routes] = await Promise.all([lookupIdResolver(), lookupDetailRoutes()]);
  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  return (rows: HeroRow[]): NamedPath[] => {
    const seen = new Set<string>();
    const out: NamedPath[] = [];
    for (const row of rows) {
      const id = resolve.hero(text(row.raw) || null, text(row.vi) || null);
      const route = id ? routes.byId.get(id) : undefined;
      const name = text(row.shown) || (locale === 'zh' ? text(row.raw) : text(row.vi));
      if (!route || !name || seen.has(route.id)) continue;
      seen.add(route.id);
      out.push({ name, path: localePath(route.path, locale) });
    }
    return out;
  };
}

const detailScopes = new Map<string, Map<string, Record<string, unknown>>>();

/** Bản ghi chi tiết của một cấu hình từ thế hệ Đội chuẩn đã pin — cùng tệp `details-<scope>.json` trình duyệt tải. */
async function recommendedDetailRecord(entry: RecommendedRouteEntry) {
  let scope = detailScopes.get(entry.safeScopeKey);
  if (!scope) {
    const website = await websiteDisplayPublicationSnapshot();
    const bytes = website.recommended.files[`details-${entry.safeScopeKey}.json`];
    if (!bytes) throw new Error(`Recommended detail scope missing: ${entry.safeScopeKey}`);
    const records = json(bytes)?.records;
    scope = new Map((Array.isArray(records) ? records : []).map((row: Record<string, unknown>) => [String(row.sourceConfigId), row]));
    detailScopes.set(entry.safeScopeKey, scope);
  }
  return scope.get(entry.sourceConfigId) ?? null;
}

/** Thân dựng sẵn của trang chi tiết Đội chuẩn: bản ghi chi tiết đã pin của cấu hình qua builder dùng chung với trình duyệt. */
export async function recommendedDetailBody(entry: RecommendedRouteEntry, lookupLinks: TeamLookupLinks, locale: SiteLocale): Promise<TeamDetailParts> {
  const record = await recommendedDetailRecord(entry);
  if (!record) throw new Error(`Recommended detail record missing: ${entry.sourceConfigId}`);
  return recommendedDetailParts(record, lookupLinks, locale);
}

/** Chữ thuần của trang chi tiết Đội chuẩn (llms.txt): cùng bản ghi và cùng builder với `recommendedDetailBody`. */
export async function recommendedDetailPlainText(entry: RecommendedRouteEntry, lookupLinks: TeamLookupLinks, locale: SiteLocale): Promise<string> {
  const record = await recommendedDetailRecord(entry);
  if (!record) throw new Error(`Recommended detail record missing: ${entry.sourceConfigId}`);
  return recommendedDetailText(record, lookupLinks, locale);
}

const strings = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** Link Tra cứu của mọi ô chiến pháp / binh thư trong đội, cấu hình thay thế và nội dung đội gốc đã đối chiếu. */
function recordLookupLinks(record: Record<string, unknown> | null, resolve: LookupIdResolver): TeamLookupLinks {
  const links: TeamLookupLinks = { tactic: {}, book: {} };
  const add = (kind: keyof TeamLookupLinks, raw: unknown, vi: unknown) => {
    // Cùng khoá mà js/recommended-reference-render.js (`lookupHref`) tra: tên nguồn, thiếu thì tên Việt.
    const key = [raw, vi].map((value) => (typeof value === 'string' ? value.trim() : '')).find(Boolean);
    if (!key || Object.hasOwn(links[kind], key)) return;
    const id = resolve[kind](typeof raw === 'string' ? raw : null, typeof vi === 'string' ? vi : null);
    if (id) links[kind][key] = id;
  };
  if (!record) return links;
  const holders = [...strings(record.heroes ?? record.holders), ...strings(record.alternativeHoldersRaw)] as Record<string, unknown>[];
  for (const holder of holders) {
    const raw = strings(holder?.tacticSlotsRaw);
    const vi = strings(holder?.tacticSlotsVi);
    const kinds = strings(holder?.tacticSlotKinds);
    for (let index = 0; index < Math.max(raw.length, vi.length); index += 1) {
      if (kinds[index] !== 'bond') add('tactic', raw[index], vi[index]);
    }
    const booksRaw = strings(holder?.bookSlotsRaw);
    const booksVi = strings(holder?.bookSlotsVi);
    for (let index = 0; index < Math.max(booksRaw.length, booksVi.length); index += 1) add('book', booksRaw[index], booksVi[index]);
  }
  for (const reference of strings(record.legacyReferences) as Record<string, any>[]) {
    for (const hero of strings(reference?.legacyContent?.heroes) as Record<string, any>[]) {
      for (const item of strings(hero?.tactics) as Record<string, unknown>[]) add('tactic', null, item?.name);
      for (const item of strings(hero?.books) as Record<string, unknown>[]) add('book', null, item?.name);
    }
  }
  return links;
}

const catalogPins = (catalog: TeamDetailRouteCatalog) => ({
  generationId: catalog.generationId,
  manifestSha256: catalog.manifestSha256,
  legacyTeamsSha256: catalog.legacyTeamsSha256,
});

export interface RecommendedDetailProps {
  entry: RecommendedRouteEntry;
  /** Tiêu đề h1 theo ngôn ngữ trang. */
  title: string;
  ordinal: number;
  /** Dòng phạm vi (mã mùa · tên mùa · danh mục) theo ngôn ngữ trang; rỗng thì không vẽ. */
  scopeLine: string;
  /** Nhãn tiêu đề (tab/meta, llms.txt): tên đội kèm mã mùa và số thứ tự khi trùng. */
  pageLabel: string;
  generationId: string;
  manifestSha256: string;
  legacyTeamsSha256: string;
  lookupLinks: TeamLookupLinks;
  /** Tướng của đội có trang riêng trong Tra cứu (cho JSON-LD). */
  heroes: NamedPath[];
  /** Đội thuộc mùa cũ (khác `defaultSourceSeasonId` của registry): dòng phụ có nhãn "mùa cũ". */
  oldSeason: boolean;
}

/** Tiêu đề đội chuẩn: bản vi dùng tên đã dịch, bản zh dùng tên chữ Hán gốc của nguồn. */
export function recommendedTitle(entry: RecommendedRouteEntry, locale: SiteLocale) {
  if (locale === 'zh') return entry.nameZh?.trim() || entry.sourceConfigId;
  return entry.displayNameVi || VI_UNAVAILABLE;
}

export async function recommendedDetailPaths(locale: SiteLocale) {
  const catalog = await teamDetailCatalog();
  const seasonNames = locale === 'zh' ? await recommendedSeasonNamesRaw() : null;
  const resolveLookupId = await lookupIdResolver();
  const links = await heroLinkBuilder(locale);
  const { defaultSourceSeasonId } = await seasonPages();
  // Cùng tên đội có ở nhiều mùa (và đôi khi nhiều cấu hình trong một mùa): tiêu đề mang mã mùa, còn trùng thì số thứ tự.
  const ranks = detailTitleRanks(catalog.recommended, (entry) => JSON.stringify(
    locale === 'zh' ? [recommendedTitle(entry, locale), entry.sourceSeasonCode] : [entry.displayNameVi, entry.sourceSeasonCode],
  ));
  return Promise.all(catalog.recommended.map(async (entry) => {
    // Bản zh: mã mùa trung tính + tên mùa chữ Hán gốc + mã danh mục gốc (交戰/開荒); bản vi giữ nhãn đã dịch.
    const scope = locale === 'zh'
      ? [entry.sourceSeasonCode, entry.sourceSeasonId ? seasonNames!.get(entry.sourceSeasonId) : null, entry.sourceCategoryId]
      : [entry.sourceSeasonCode, entry.sourceSeasonNameVi, entry.sourceCategoryNameVi];
    const record = await recommendedDetailRecord(entry);
    const heroes = links((strings(record?.heroes) as Array<{ nameRaw?: unknown; displayNameVi?: unknown }>).map((hero) => ({
      raw: hero?.nameRaw,
      vi: hero?.displayNameVi,
      shown: holderDisplayName(hero, locale),
    })));
    const title = recommendedTitle(entry, locale);
    const { ordinal } = ranks(entry);
    const qualifier = [entry.sourceSeasonCode, ordinal > 1 ? String(ordinal) : null].filter(Boolean).join(' · ');
    const props: RecommendedDetailProps = {
      entry,
      title,
      ordinal,
      pageLabel: qualifier ? `${title} (${qualifier})` : title,
      scopeLine: scope.filter(Boolean).join(' · '),
      ...catalogPins(catalog),
      lookupLinks: recordLookupLinks(record, resolveLookupId),
      heroes,
      oldSeason: isOldSeason(entry.sourceSeasonId, defaultSourceSeasonId),
    };
    return { params: { team: entry.routeSegment }, props };
  }));
}

export interface LegacyDetailProps {
  entry: LegacyRouteEntry;
  title: string;
  /** Nhãn tiêu đề (tab/meta): tên + nhãn nguồn khi trùng tên + số thứ tự khi vẫn trùng. */
  pageLabel: string;
  generationId: string;
  manifestSha256: string;
  legacyTeamsSha256: string;
  /** Tướng của đội có trang riêng trong Tra cứu (cho JSON-LD). */
  heroes: NamedPath[];
}

export async function legacyDetailPaths(locale: SiteLocale) {
  const catalog = await teamDetailCatalog();
  const website = await websiteDisplayPublicationSnapshot();
  const teams: Array<{ id: string; heroes?: Array<{ name?: string }> }> = json(website.publicFiles['teams.json']);
  const heroesById = new Map(teams.map((team) => [team.id, (team.heroes ?? []).map((hero) => hero?.name ?? '')]));
  const resolve = await zhNameResolver();
  const links = await heroLinkBuilder(locale);
  let title: (entry: LegacyRouteEntry) => string;
  if (locale === 'zh') {
    title = (entry) => lineupTitleZh(heroesById.get(entry.legacyTeamId) ?? [], resolve) ?? entry.legacyTeamId;
  } else {
    title = (entry) => {
      const raw = entry.nickname || entry.name || entry.legacyTeamId;
      return CJK.test(raw) ? VI_UNAVAILABLE : raw;
    };
  }
  // Tên đội trùng nhau giữa các nguồn (và cả trong một nguồn): tiêu đề mang nhãn nguồn, còn trùng thì số thứ tự.
  // Bản vi giữ khoá cũ (tên gốc) để tiêu đề đã phát hành không đổi.
  const nameKey = locale === 'zh' ? title : (entry: LegacyRouteEntry) => entry.nickname || entry.name || entry.legacyTeamId;
  const byName = detailTitleRanks(catalog.legacy, nameKey);
  const bySource = detailTitleRanks(catalog.legacy, (entry) => JSON.stringify([nameKey(entry), entry.source]));
  return catalog.legacy.map((entry) => {
    const ordinal = bySource(entry).ordinal;
    const pageLabel = [
      title(entry),
      byName(entry).size > 1 && entry.source
        ? (locale === 'zh' ? legacyLabelZh('source', entry.source, 'zh') : (SOURCE_LABEL as Record<string, string>)[entry.source]) || entry.source
        : null,
      ordinal > 1 ? String(ordinal) : null,
    ].filter(Boolean).join(' · ');
    const heroes = links((heroesById.get(entry.legacyTeamId) ?? []).map((name) => ({ raw: resolve(name), vi: name })));
    const props: LegacyDetailProps = { entry, title: title(entry), pageLabel, heroes, ...catalogPins(catalog) };
    return { params: { team: entry.routeSegment }, props };
  });
}

export interface KhaiHoangDetailProps {
  entry: KhaiHoangRouteEntry;
  title: string;
  /** Tiêu đề tab/meta; bản zh thêm số thứ tự khi hai đội ghép ra cùng tên chữ Hán. */
  pageLabel: string;
  khaiHoangSha256: string;
  /** Tướng của đội có trang riêng trong Tra cứu (cho JSON-LD). */
  heroes: NamedPath[];
}

export async function khaiHoangDetailPaths(locale: SiteLocale) {
  const catalog = await teamDetailCatalog();
  const website = await websiteDisplayPublicationSnapshot();
  const source: { teams: Array<{ id: string; heroes?: Array<{ name?: string }> }> } = json(website.publicFiles['khaihoang.json']);
  const heroesById = new Map(source.teams.map((team) => [team.id, (team.heroes ?? []).map((hero) => hero?.name ?? '')]));
  const resolve = await zhNameResolver();
  const links = await heroLinkBuilder(locale);
  let title: (entry: KhaiHoangRouteEntry) => string;
  if (locale === 'zh') {
    title = (entry) => lineupTitleZh(heroesById.get(entry.khaiHoangTeamId) ?? [], resolve) ?? entry.handle;
  } else {
    // Nguồn chưa dịch xong không được lộ chữ Hán ra tiêu đề công khai.
    title = (entry) => (CJK.test(entry.title) ? VI_UNAVAILABLE : entry.title);
  }
  const ranks = detailTitleRanks(catalog.khaiHoang, title);
  return catalog.khaiHoang.map((entry) => {
    const ordinal = locale === 'zh' ? ranks(entry).ordinal : 1;
    const props: KhaiHoangDetailProps = {
      entry,
      title: title(entry),
      pageLabel: ordinal > 1 ? `${title(entry)} · ${ordinal}` : title(entry),
      khaiHoangSha256: catalog.khaiHoangSha256,
      heroes: links((heroesById.get(entry.khaiHoangTeamId) ?? []).map((name) => ({ raw: resolve(name), vi: name }))),
    };
    return { params: { team: entry.routeSegment }, props };
  });
}
