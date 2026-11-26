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
import { LOCALE_PREFIX, SITE_LOCALES, pick } from '../../js/i18n.js';
import { localRawName } from '../../js/website-display.js';
import type { SiteLocale } from './locale-routes.ts';
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
  /** Mùa cũ hơn mùa hiện tại (`isOldSeason`): chỉ mùa này mang nhãn "mùa cũ"; mùa mới hơn mùa hiện tại không có nhãn. */
  older: boolean;
}

export interface SeasonPageCatalog {
  defaultSourceSeasonId: string | null;
  /** Mùa hiện tại (không có trang riêng); `null` khi registry rỗng. */
  current: SeasonSummary | null;
  /** Mùa không phải mùa hiện tại có đội, theo thứ tự registry. */
  pages: SeasonPage[];
}

export interface SeasonRedirectRule {
  from: string;
  to: string;
  status: 301;
}

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

const SEASON_NUMBER = /^(?:pk-)?s(\d+)$/u;

/** Số mùa trong id (`s1`..`s3`, `pk-s4`..`pk-s28`: một dãy liên tục S1→S3 rồi PK-S4…); `null` khi không đọc được (OG, họ mùa mới). */
function seasonNumber(sourceSeasonId: string) {
  const match = SEASON_NUMBER.exec(sourceSeasonId);
  return match ? Number(match[1]) : null;
}

/**
 * Mùa cũ: số mùa trong id NHỎ HƠN số của mùa mặc định. Không dùng vị trí trong `seasonOptions`/`sourceOrder`: đó là thứ tự
 * ô chọn trên trang nguồn, không phải thời gian (generation #103 xếp PK-S27, PK-S28 … S1, OG). Mùa mặc định, mùa mới hơn
 * nó (PK-S28 khi mặc định là PK-S27), mùa không đọc được số (OG, họ mới) hoặc thiếu mùa/mặc định đều không có nhãn.
 */
export function isOldSeason(sourceSeasonId: string | null | undefined, defaultSourceSeasonId: string | null | undefined) {
  if (!sourceSeasonId || !defaultSourceSeasonId) return false;
  const season = seasonNumber(sourceSeasonId);
  const current = seasonNumber(defaultSourceSeasonId);
  return season !== null && current !== null && season < current;
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
    .map((summary) => ({ ...summary, routePath: `/doi-chuan/${summary.slug}/`, htmlPath: `doi-chuan/${summary.slug}/index.html`,
      older: isOldSeason(summary.sourceSeasonId, defaultSourceSeasonId),
    }));
  return { defaultSourceSeasonId, current, pages };
}

/** 301 của slug mùa hiện tại về trang danh sách (mọi locale): URL đã index của mùa vừa thành mùa mặc định không bị 404. */
export function seasonRedirectRules(catalog: Pick<SeasonPageCatalog, 'current'>): SeasonRedirectRule[] {
  if (!catalog.current) return [];
  return SITE_LOCALES.map((locale) => LOCALE_PREFIX[locale]).map((prefix) => ({ from: `${prefix}/doi-chuan/${catalog.current!.slug}/`, to: `${prefix}/doi-chuan/`, status: 301 as const }));
}

/** Danh mục của publication đã pin của repo (đúng bản mà trang dùng). */
export async function seasonPages(): Promise<SeasonPageCatalog> {
  const website = await websiteDisplayPublicationSnapshot();
  const registry = JSON.parse(Buffer.from(website.recommended.files['seasons.json']).toString('utf8'));
  return seasonPageCatalog(registry, await teamDetailCatalog());
}

/** Tên mùa hiển thị theo ngôn ngữ: bản zh và ja dùng tên chữ Hán gốc, bản vi tên Việt; thiếu thì chỉ còn mã. */
/**
 * Tên mùa theo ngôn ngữ trang: bản Việt `nameVi`, bản Trung chữ Hán nguồn, bản Nhật chữ nguồn đổi tự dạng qua `resolver.fromRaw`
 * (truyền `await lookupJaNameResolver()`; vắng thì giữ chữ nguồn).
 */
export function seasonDisplayName(season: Pick<SeasonSummary, 'nameVi' | 'nameRaw'>, locale: SiteLocale, resolver: { fromRaw?: (raw: string) => string } | null = null) {
  return pick(locale, season.nameVi, season.nameRaw, season.nameRaw ? localRawName(season.nameRaw, resolver, locale) : season.nameRaw);
}

export interface SeasonPageProps {
  season: SeasonPage;
}

/** Path mùa cho `getStaticPaths` của `[team].astro` (chung route với trang đội, không đi qua `recommendedDetailPaths`). */
export async function seasonPagePaths() {
  const { pages } = await seasonPages();
  return pages.map((season) => ({ params: { team: season.slug }, props: { season } satisfies SeasonPageProps }));
}
