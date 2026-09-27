/**
 * `getStaticPaths` dùng chung cho ba họ trang chi tiết đội ở cả bản Việt và bản Trung. Route `[team].astro`
 * (vi) và `zh/…/[team].astro` chỉ gọi hàm ở đây rồi truyền props cho component trang.
 *
 * Tiêu đề bản Trung: đội chuẩn dùng tên chữ Hán gốc (`nameZh`); đội khác và Khai hoang (dữ liệu cũ chỉ ghi
 * tên Hán-Việt) ghép tên tướng chữ Hán tra qua từ điển có trường `chinese` — cùng cách js/recommended-reference-render.js
 * (`legacyTitle`) và js/render.js dựng tên đội ở bản zh. Tên không tra được bị bỏ để trang zh không lẫn tiếng Việt.
 */
import { createRawNameResolver } from '../../js/website-display.js';
import { legacyLabelZh } from '../../js/recommended-reference-state.js';
import { SOURCE_LABEL } from '../../js/render.js';
import { readPublicArtifact, websiteDisplayPublicationSnapshot } from './root-static-artifacts';
import {
  detailTitleRanks,
  teamDetailCatalog,
  type KhaiHoangRouteEntry,
  type LegacyRouteEntry,
  type RecommendedRouteEntry,
  type TeamDetailRouteCatalog,
} from './team-detail-routes';
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
  generationId: string;
  manifestSha256: string;
  legacyTeamsSha256: string;
}

/** Tiêu đề đội chuẩn: bản vi dùng tên đã dịch, bản zh dùng tên chữ Hán gốc của nguồn. */
function recommendedTitle(entry: RecommendedRouteEntry, locale: SiteLocale) {
  if (locale === 'zh') return entry.nameZh?.trim() || entry.sourceConfigId;
  return entry.displayNameVi || VI_UNAVAILABLE;
}

export async function recommendedDetailPaths(locale: SiteLocale) {
  const catalog = await teamDetailCatalog();
  const seasonNames = locale === 'zh' ? await recommendedSeasonNamesRaw() : null;
  // Cùng tên đội có ở nhiều mùa (và đôi khi nhiều cấu hình trong một mùa): tiêu đề mang mã mùa, còn trùng thì số thứ tự.
  const ranks = detailTitleRanks(catalog.recommended, (entry) => JSON.stringify(
    locale === 'zh' ? [recommendedTitle(entry, locale), entry.sourceSeasonCode] : [entry.displayNameVi, entry.sourceSeasonCode],
  ));
  return catalog.recommended.map((entry) => {
    // Bản zh: mã mùa trung tính + tên mùa chữ Hán gốc + mã danh mục gốc (交戰/開荒); bản vi giữ nhãn đã dịch.
    const scope = locale === 'zh'
      ? [entry.sourceSeasonCode, entry.sourceSeasonId ? seasonNames!.get(entry.sourceSeasonId) : null, entry.sourceCategoryId]
      : [entry.sourceSeasonCode, entry.sourceSeasonNameVi, entry.sourceCategoryNameVi];
    const props: RecommendedDetailProps = {
      entry,
      title: recommendedTitle(entry, locale),
      ordinal: ranks(entry).ordinal,
      scopeLine: scope.filter(Boolean).join(' · '),
      ...catalogPins(catalog),
    };
    return { params: { team: entry.routeSegment }, props };
  });
}

export interface LegacyDetailProps {
  entry: LegacyRouteEntry;
  title: string;
  /** Nhãn tiêu đề (tab/meta): tên + nhãn nguồn khi trùng tên + số thứ tự khi vẫn trùng. */
  pageLabel: string;
  generationId: string;
  manifestSha256: string;
  legacyTeamsSha256: string;
}

export async function legacyDetailPaths(locale: SiteLocale) {
  const catalog = await teamDetailCatalog();
  let title: (entry: LegacyRouteEntry) => string;
  if (locale === 'zh') {
    const website = await websiteDisplayPublicationSnapshot();
    const teams: Array<{ id: string; heroes?: Array<{ name?: string }> }> = json(website.publicFiles['teams.json']);
    const heroesById = new Map(teams.map((team) => [team.id, (team.heroes ?? []).map((hero) => hero?.name ?? '')]));
    const resolve = await zhNameResolver();
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
    const props: LegacyDetailProps = { entry, title: title(entry), pageLabel, ...catalogPins(catalog) };
    return { params: { team: entry.routeSegment }, props };
  });
}

export interface KhaiHoangDetailProps {
  entry: KhaiHoangRouteEntry;
  title: string;
  /** Tiêu đề tab/meta; bản zh thêm số thứ tự khi hai đội ghép ra cùng tên chữ Hán. */
  pageLabel: string;
  khaiHoangSha256: string;
}

export async function khaiHoangDetailPaths(locale: SiteLocale) {
  const catalog = await teamDetailCatalog();
  let title: (entry: KhaiHoangRouteEntry) => string;
  if (locale === 'zh') {
    const website = await websiteDisplayPublicationSnapshot();
    const source: { teams: Array<{ id: string; heroes?: Array<{ name?: string }> }> } = json(website.publicFiles['khaihoang.json']);
    const heroesById = new Map(source.teams.map((team) => [team.id, (team.heroes ?? []).map((hero) => hero?.name ?? '')]));
    const resolve = await zhNameResolver();
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
    };
    return { params: { team: entry.routeSegment }, props };
  });
}
