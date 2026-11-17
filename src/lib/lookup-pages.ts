// Dữ liệu lúc build của các trang Tra cứu: 7 trang nhóm `/tra-cuu/<slug>/` (× mỗi ngôn ngữ) và trang mục lục
// `/tra-cuu/`. Kho Tra cứu đọc từ đúng snapshot byte mà publication phát (`lookupPublicationSnapshot`) và được
// kiểm trọn bộ — shape lẫn tham chiếu chéo — trước khi dựng trang; trình duyệt chỉ còn kiểm từng payload.
import { validateLookupBundle } from '../../js/lookup-data.js';
import { LOOKUP_GROUP_SLUGS, lookupGroupPath, lookupItemPath, setLookupRouteHandles } from '../../js/lookup-ids.js';
import { lookupDetailRoutes } from './lookup-detail-routes.ts';
import {
  LOOKUP_GROUPS,
  buildLookupCorpus,
  lookupGroupCounts,
  lookupGroupLabels,
  lookupMoreTrees,
  lookupOrderNote,
  lookupPageSize,
  lookupResultTrees,
  lookupSummaryTrees,
  searchLookupGroup,
} from '../../js/unified-lookup.js';
import {
  isMasterGroup,
  masterDefaultId,
  masterDetailTree,
  masterFilterTree,
  masterPanelLabel,
  masterTargetFor,
} from '../../js/lookup-master.js';
import { treeToHtml } from '../../js/view-tree.js';
import { localePath, pick } from '../../js/i18n.js';
import { createJaNameResolver } from '../../js/website-display.js';
import { PUBLIC_ARTIFACTS } from './public-artifact-manifest.mjs';
import { lookupDisplayName } from '../../js/lookup-detail.js';
import { lookupBookAliases, lookupJaPublicationSnapshot, lookupPublicationSnapshot, readPublicArtifact } from './root-static-artifacts.ts';
import { tacticDisplayTable } from './tactic-display.ts';
import type { SiteLocale } from './locale-routes';

export type LookupGroup = keyof typeof LOOKUP_GROUP_SLUGS;

/** Bảy nhóm theo thứ tự công bố (`LOOKUP_GROUPS` của `js/unified-lookup.js`), đúng kiểu nhóm. */
const GROUPS = LOOKUP_GROUPS as LookupGroup[];

/** Mô tả ngắn của từng nhóm (menu, footer, thẻ mục lục, dòng dẫn trang nhóm). */
const LOOKUP_DESCRIPTIONS: Record<LookupGroup, {vi: string; zh: string; ja: string}> = {
  heroes: {vi: 'Chỉ số, binh chủng và chiến pháp', zh: '属性、兵种与战法', ja: '能力値・兵種・戦法'},
  tactics: {vi: 'Hiệu quả và cách dùng chiến pháp', zh: '战法效果与用法', ja: '戦法の効果と使い方'},
  equipment: {vi: 'Trang bị theo ô và phẩm chất', zh: '按部位与品质查看装备', ja: '部位と品質で装備を探す'},
  advisors: {vi: 'Hiệu ứng và cách dùng quân sư', zh: '军师效果与用法', ja: '軍師の効果と使い方'},
  'troop-mods': {vi: 'Cải tạo binh chủng và gợi ý build', zh: '兵种进阶与搭配建议', ja: '兵種進階とおすすめ構成'},
  buildings: {vi: 'Công trình theo cấp và hiệu quả', zh: '按等级查看建筑效果', ja: 'レベル別の施設効果'},
  books: {vi: 'Binh thư theo tên Việt và chữ Hán', zh: '按名称查询兵书', ja: '名称で兵法書を探す'},
};

export function lookupDescription(group: LookupGroup, locale: SiteLocale) {
  const row = LOOKUP_DESCRIPTIONS[group];
  return pick(locale, row.vi, row.zh, row.ja);
}

/** Corpus Tra cứu (`buildLookupCorpus` của `js/unified-lookup.js`): mục theo nhóm và theo mã. */
interface LookupCorpus {
  groups: Record<LookupGroup, {id: string}[]>;
  byId: Map<string, unknown>;
}

let corpusPromise: Promise<LookupCorpus> | null = null;

/** Gốc dự án và manifest artifact khác mặc định (verifier chạy trên một dist/gốc dự án khác). */
export interface LookupCorpusOptions {
  rootDir?: string;
  manifest?: readonly unknown[];
}

async function loadCorpus(options: LookupCorpusOptions): Promise<LookupCorpus> {
  const snapshot = await lookupPublicationSnapshot({ rootDir: options.rootDir });
  const rawFiles = Object.fromEntries(
    ['heroes-dict.json', 'tactics.json', 'lookup-catalog.json'].map((name) => [name, new Uint8Array(snapshot.files[name])]),
  );
  const bundle = await validateLookupBundle(structuredClone(snapshot.manifest), rawFiles);
  // Lớp ja được kiểm cùng lúc: `lookupGenerationId`/`sources` lệch bốn payload hiện tại thì build dừng ở đây. Manifest artifact
  // không phát `lookup-ja` (fixture của verifier/test) thì corpus không có lớp ja.
  const publishesJa = ((options.manifest ?? PUBLIC_ARTIFACTS) as { kind?: string; routeParam?: string }[])
    .some((artifact) => artifact.kind === 'data' && artifact.routeParam === 'lookup-ja');
  const [{ bytes: bookBytes }, bookAliases, ja] = await Promise.all([
    readPublicArtifact({ kind: 'data', routeParam: 'books-dict', ...options } as Parameters<typeof readPublicArtifact>[0]),
    lookupBookAliases(options as Parameters<typeof lookupBookAliases>[0]),
    publishesJa ? lookupJaPublicationSnapshot(options as Parameters<typeof lookupJaPublicationSnapshot>[0]) : null,
  ]);
  const books = JSON.parse(Buffer.from(bookBytes).toString('utf8'));
  return buildLookupCorpus({ heroes: bundle.heroes, tactics: bundle.tactics, catalog: bundle.catalog, books, bookAliases, ja: ja?.document ?? null });
}

/** Corpus đầy đủ của publication, kiểm trọn bộ một lần mỗi build (gốc dự án khác mặc định thì dựng riêng, không nhớ). */
export function lookupBuildCorpus(options: LookupCorpusOptions = {}) {
  if (options.rootDir !== undefined || options.manifest !== undefined) return loadCorpus(options);
  corpusPromise ??= loadCorpus(options);
  return corpusPromise;
}

/**
 * Pin `sha256:<hex>` của `data/lookup-ja.json` cho trang `/ja/` (`#lookup-ja-pin`): trình duyệt chỉ nhận lớp ja có đúng bytes
 * mà build đã kiểm. Trang vi/zh không nhúng.
 */
export async function lookupJaPin() {
  return (await lookupJaPublicationSnapshot()).pin;
}

let jaNamesPromise: Promise<((viName: string) => string | null) & { fromRaw: (raw: string) => string }> | null = null;

/**
 * Bộ tra tên Nhật lúc build (`createJaNameResolver`): tên Việt/Hán-Việt của ba từ điển → tên Nhật theo ID, `fromRaw` đổi tự dạng
 * chữ Hán thô. Cùng dữ liệu mà trang `/ja/` nạp ở trình duyệt (`loadRawNameResolver`), nên HTML dựng sẵn khớp DOM dựng lại.
 */
export function lookupJaNameResolver() {
  jaNamesPromise ??= (async () => {
    const [ja, ...dicts] = await Promise.all([
      lookupJaPublicationSnapshot(),
      ...['heroes-dict', 'tactics', 'books-dict'].map(async (routeParam) =>
        JSON.parse(Buffer.from((await readPublicArtifact({ kind: 'data', routeParam } as Parameters<typeof readPublicArtifact>[0])).bytes).toString('utf8'))),
    ]);
    return createJaNameResolver(dicts, ja.document, ja.variants) as ((viName: string) => string | null) & { fromRaw: (raw: string) => string };
  })();
  return jaNamesPromise;
}

/** `getStaticPaths` của trang nhóm: slug đường dẫn → nhóm. */
export function lookupGroupStaticPaths() {
  return GROUPS.map((group) => ({ params: { group: LOOKUP_GROUP_SLUGS[group] }, props: { group } }));
}

/** Nhãn, đường dẫn và mô tả của 7 nhóm theo thứ tự công bố (menu, footer): không cần đọc kho Tra cứu. */
export function lookupGroupLinks(locale: SiteLocale) {
  const labels = lookupGroupLabels(locale);
  return GROUPS.map((group) => ({
    group,
    label: labels[group] as string,
    path: lookupGroupPath(group) as string,
    description: lookupDescription(group, locale),
  }));
}

/** `lookupGroupLinks` kèm số bản ghi của từng nhóm (mục lục, chip nhóm) từ kho Tra cứu của build. */
export async function lookupGroupEntries(locale: SiteLocale) {
  const counts = lookupGroupCounts(await lookupBuildCorpus());
  return lookupGroupLinks(locale).map((link) => ({ ...link, count: counts[link.group] as number }));
}

/**
 * Tướng liên quan của trang Trang bị (tướng độc quyền của đặc kỹ) và Quân sư (tướng mang kỹ năng): bản ghi tối
 * thiểu `{id, viet, chinese, iconUrl}` nhúng vào trang để danh sách ghi được tên tướng mà không tải `heroes-dict`.
 * Nhóm khác trả `null`.
 */
async function lookupGroupOwners(group: LookupGroup): Promise<string | null> {
  if (group !== 'equipment' && group !== 'advisors') return null;
  const corpus = await lookupBuildCorpus();
  const catalog = (corpus as unknown as { catalog: { specials: {exclusiveHeroId: string | null}[]; advisors: {heroIds: string[]}[] } }).catalog;
  const ids = new Set<string>(
    group === 'equipment'
      ? catalog.specials.map((special) => special.exclusiveHeroId).filter((id): id is string => Boolean(id))
      : catalog.advisors.flatMap((advisor) => advisor.heroIds),
  );
  const heroes = [...ids].sort().flatMap((id) => {
    const record = (corpus.byId.get(id) as { record?: {viet?: string; chinese?: string; iconUrl?: string | null} } | undefined)?.record;
    return record ? [{ id, viet: record.viet, chinese: record.chinese, iconUrl: record.iconUrl ?? null }] : [];
  });
  return JSON.stringify(heroes).replace(/</g, '\\u003c');
}

let routeHandlesPromise: Promise<Record<string, string>> | null = null;

/**
 * Bảng ngoại lệ `{id: slug}` của quy tắc "slug = hậu tố mã" (ledger đóng băng, đúng tập id của corpus; hiện rỗng):
 * đăng ký một lần cho các builder dùng chung (thẻ, link quan hệ, link của trang đội trỏ tới trang riêng) và là bảng mà
 * mọi trang có link Tra cứu nhúng cho trình duyệt.
 */
export function lookupRouteHandles() {
  routeHandlesPromise ??= (async () => {
    const { exceptions } = await lookupDetailRoutes();
    // Khối "Trong cẩm nang" đổi tên chiến pháp lưu sang tên hiện hành bằng cùng bảng với trang đội.
    await tacticDisplayTable();
    if (!setLookupRouteHandles(exceptions)) throw new Error('Lookup route handle table rejected while preparing lookup pages');
    return exceptions;
  })();
  return routeHandlesPromise;
}

/**
 * HTML dựng sẵn của trang nhóm: MỌI mục của nhóm (số lượng không phụ thuộc client), dòng trạng thái và hàng "Xem thêm",
 * cùng cây markup mà `js/lookup-page.js` dựng lại trong trình duyệt. Các mục sau trang đầu mang `data-lookup-later`
 * (CSS ẩn khi có JavaScript; trình duyệt bỏ chúng khi nhận lại danh sách và "Xem thêm" dựng lại từ dữ liệu).
 * Bốn nhóm catalog thêm hàng chip lọc và chi tiết của mục đầu.
 */
export async function lookupGroupPage(group: LookupGroup, locale: SiteLocale) {
  const [corpus] = await Promise.all([lookupBuildCorpus(), lookupRouteHandles()]);
  const pageSize = lookupPageSize(group);
  const total = corpus.groups[group].length;
  const { items } = searchLookupGroup(corpus, { group, page: 1, pageSize: total, locale });
  const master = isMasterGroup(group);
  // Bốn nhóm catalog chọn sẵn mục đầu (artboard): chi tiết của nó dựng sẵn cạnh danh sách.
  const selectedId = master ? masterDefaultId(group, items.slice(0, pageSize) as { id: string }[]) : null;
  const target = selectedId ? masterTargetFor(corpus, selectedId) : null;
  return {
    total,
    master,
    // Tướng có bố cục riêng (artboard Lookup: 5 cột, chân dung vuông, vạch phe); nhóm catalog giữ lưới thẻ chung.
    gridClass: group === 'tactics'
      ? 'lookup-grid lookup-grid-table'
      : master
        ? `lookup-grid lookup-master-grid lookup-master-grid-${group}`
        : `lookup-grid lookup-grid-cards${group === 'heroes' ? ' lookup-grid-heroes' : ''}`,
    resultsHtml: lookupResultTrees(group, items, locale, { selectedId, byId: corpus.byId, visibleCount: pageSize }).map(treeToHtml).join(''),
    summaryHtml: lookupSummaryTrees(group, total, locale).map(treeToHtml).join(''),
    orderNote: total && !master ? lookupOrderNote('', locale) : null,
    moreHtml: lookupMoreTrees(Math.min(pageSize, total), total, locale, pageSize).map(treeToHtml).join(''),
    filtersHtml: master ? treeToHtml(masterFilterTree(group, corpus.groups[group], {}, locale)) : '',
    panelLabel: master ? masterPanelLabel(group, locale) : '',
    detailHtml: target ? treeToHtml(masterDetailTree(group, target.item, corpus, locale, { targetId: target.targetId })) : '',
    owners: await lookupGroupOwners(group),
    /** Mọi mục theo thứ tự hiển thị với tên và đường dẫn trang riêng (đã gắn tiền tố ngôn ngữ): `ItemList` của JSON-LD. */
    structuredItems: (items as { id: string; nameVi: string; record?: unknown }[]).map((item) => ({
      name: lookupDisplayName(item.record, item.nameVi, locale) as string,
      path: localePath(lookupItemPath(item.id) as string, locale),
    })),
  };
}
