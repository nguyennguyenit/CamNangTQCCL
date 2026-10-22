/**
 * Danh mục trang mùa Đội chuẩn (`/doi-chuan/<mã mùa>/`, `/zh/doi-chuan/<mã mùa>/`): một nguồn cho trang, sitemap,
 * verifier, khối "Các mùa khác" của `/doi-chuan/` và luật 301 của mùa hiện tại. Không ghim, không đọc file thứ hai:
 * registry là `seasons.json` của generation đã pin (cùng chỗ `recommendedSeasonOrder`), số đội đếm trên route của catalog.
 *
 * - Slug là `displayCode` viết thường (`pk-s24`, `s1`), cũng là tiền tố `routeSegment` của mọi đội trong mùa
 *   (`routeSeasonSegment` ở team-detail-routes.ts); slug đội luôn có `-<handle>` nên không bao giờ trùng slug mùa.
 * - Mùa hiện tại (`defaultSourceSeasonId`) không có trang: nội dung của nó là `/doi-chuan/`. Khi mùa mặc định đổi,
 *   trang cũ của mùa mới hiện tại biến mất và được 301 về `/doi-chuan/` (`seasonRedirectRules`).
 * - Mùa 0 đội (chưa thu thập) không có trang; registry rỗng cho 0 trang.
 */
import { websiteDisplayPublicationSnapshot } from './root-static-artifacts.ts';
import { teamDetailCatalog, type RecommendedRouteEntry, type TeamDetailRouteCatalog } from './team-detail-routes.ts';

const CJK = /[\u3400-\u9fff\uf900-\ufaff]/u;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export interface SeasonSummary {
  /** `displayCode` viết thường: đoạn đường dẫn `/doi-chuan/<slug>/`. */
  slug: string;
  sourceSeasonId: string;
  /** Mã hiển thị gốc (`PK-S24`). */
  displayCode: string;
  /** Tên Việt của mùa; `null` khi registry chưa có tên không lẫn chữ Hán. */
  nameVi: string | null;
  /** Tên mùa chữ Hán gốc (bản zh); `null` khi registry không ghi. */
  nameRaw: string | null;
  /** Số đội của mùa trên route của catalog (không phải `advertisedCountRaw`). */
  count: number;
}

export interface SeasonPage extends SeasonSummary {
  /** Đường dẫn bản Việt; bản zh thêm tiền tố `/zh`. */
  routePath: string;
  /** File dist bản Việt; bản zh nằm dưới `zh/`. */
  htmlPath: string;
}

export interface SeasonPageCatalog {
  defaultSourceSeasonId: string | null;
  /** Mùa hiện tại (không có trang riêng); `null` khi registry rỗng. */
  current: SeasonSummary | null;
  /** Mùa cũ có đội, theo thứ tự registry. */
  pages: SeasonPage[];
}

export interface SeasonRedirectRule {
  from: string;
  to: string;
  status: 301;
}

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

/** Mùa cũ: đội thuộc một mùa khác mùa mặc định của registry. Đội không rõ mùa không bị coi là mùa cũ. */
export function isOldSeason(sourceSeasonId: string | null | undefined, defaultSourceSeasonId: string | null | undefined) {
  return Boolean(sourceSeasonId) && Boolean(defaultSourceSeasonId) && sourceSeasonId !== defaultSourceSeasonId;
}

/**
 * Dựng danh mục từ registry (`seasons.json` đã parse) và route Đội chuẩn của catalog. Thuần, nhận registry tường minh
 * để verifier và test dùng cùng một hàm với bản build.
 */
export function seasonPageCatalog(
  registry: unknown,
  catalog: { recommended: readonly Pick<RecommendedRouteEntry, 'routeSegment' | 'sourceSeasonId'>[] },
): SeasonPageCatalog {
  const source = (registry && typeof registry === 'object' ? registry : {}) as { defaultSourceSeasonId?: unknown; seasonOptions?: unknown };
  const defaultSourceSeasonId = text(source.defaultSourceSeasonId);
  const options = Array.isArray(source.seasonOptions) ? source.seasonOptions : [];
  const teamSlugs = new Set(catalog.recommended.map((entry) => entry.routeSegment));
  const counts = new Map<string, number>();
  for (const entry of catalog.recommended) {
    if (entry.sourceSeasonId) counts.set(entry.sourceSeasonId, (counts.get(entry.sourceSeasonId) ?? 0) + 1);
  }
  const summaries: SeasonSummary[] = [];
  const seen = new Set<string>();
  for (const option of options) {
    const sourceSeasonId = text(option?.sourceSeasonId);
    const displayCode = text(option?.displayCode);
    if (!sourceSeasonId || !displayCode) continue;
    const slug = displayCode.toLowerCase();
    const count = counts.get(sourceSeasonId) ?? 0;
    const isCurrent = sourceSeasonId === defaultSourceSeasonId;
    // Mùa 0 đội (chưa thu thập) không có trang và không cần slug hợp lệ; mùa hiện tại vẫn cần slug để 301.
    if (!count && !isCurrent) continue;
    if (!SLUG.test(slug)) throw new Error(`Season ${sourceSeasonId} has no usable page slug: ${JSON.stringify(displayCode)}`);
    if (seen.has(slug)) throw new Error(`Season page slug is used by two seasons: ${slug}`);
    seen.add(slug);
    if (teamSlugs.has(slug)) throw new Error(`Season page slug trùng slug đội: ${slug}`);
    const nameVi = text(option.displayNameVi);
    summaries.push({
      slug,
      sourceSeasonId,
      displayCode,
      nameVi: nameVi && !CJK.test(nameVi) ? nameVi : null,
      nameRaw: text(option.nameRaw),
      count,
    });
  }
  const current = summaries.find((summary) => summary.sourceSeasonId === defaultSourceSeasonId) ?? null;
  const pages = summaries
    .filter((summary) => summary.sourceSeasonId !== defaultSourceSeasonId && summary.count > 0)
    .map((summary) => ({ ...summary, routePath: `/doi-chuan/${summary.slug}/`, htmlPath: `doi-chuan/${summary.slug}/index.html` }));
  return { defaultSourceSeasonId, current, pages };
}

/** 301 của slug mùa hiện tại về trang danh sách (vi + zh): URL đã index của mùa vừa thành mùa mặc định không bị 404. */
export function seasonRedirectRules(catalog: Pick<SeasonPageCatalog, 'current'>): SeasonRedirectRule[] {
  if (!catalog.current) return [];
  return ['', '/zh'].map((prefix) => ({ from: `${prefix}/doi-chuan/${catalog.current!.slug}/`, to: `${prefix}/doi-chuan/`, status: 301 as const }));
}

/** Danh mục của publication đã pin của repo (đúng bản mà trang dùng). */
export async function seasonPages(): Promise<SeasonPageCatalog> {
  const website = await websiteDisplayPublicationSnapshot();
  const registry = JSON.parse(Buffer.from(website.recommended.files['seasons.json']).toString('utf8'));
  return seasonPageCatalog(registry, await teamDetailCatalog());
}

/** Tên mùa hiển thị theo ngôn ngữ: bản zh dùng tên chữ Hán gốc, bản vi tên Việt; thiếu thì chỉ còn mã. */
export function seasonDisplayName(season: Pick<SeasonSummary, 'nameVi' | 'nameRaw'>, locale: 'vi' | 'zh') {
  return locale === 'zh' ? season.nameRaw : season.nameVi;
}

export interface SeasonPageProps {
  season: SeasonPage;
}

/** Path mùa cho `getStaticPaths` của `[team].astro` (chung route với trang đội, không đi qua `recommendedDetailPaths`). */
export async function seasonPagePaths() {
  const { pages } = await seasonPages();
  return pages.map((season) => ({ params: { team: season.slug }, props: { season } satisfies SeasonPageProps }));
}
