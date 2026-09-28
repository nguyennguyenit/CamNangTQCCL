// Dữ liệu lúc build của các trang Tra cứu: 7 trang nhóm `/tra-cuu/<slug>/` (×2 ngôn ngữ) và trang mục lục
// `/tra-cuu/`. Kho Tra cứu đọc từ đúng snapshot byte mà publication phát (`lookupPublicationSnapshot`) và được
// kiểm trọn bộ — shape lẫn tham chiếu chéo — trước khi dựng trang; trình duyệt chỉ còn kiểm từng payload.
import { validateLookupBundle } from '../../js/lookup-data.js';
import { LOOKUP_GROUP_SLUGS, lookupGroupPath } from '../../js/lookup-ids.js';
import {
  LOOKUP_GROUPS,
  PAGE_SIZE,
  buildLookupCorpus,
  lookupGroupCounts,
  lookupGroupLabels,
  lookupMoreTrees,
  lookupOrderNote,
  lookupResultTrees,
  lookupSummaryTrees,
  searchLookupGroup,
} from '../../js/unified-lookup.js';
import { treeToHtml } from '../../js/view-tree.js';
import { pick } from '../../js/i18n.js';
import { lookupBookAliases, lookupPublicationSnapshot, readPublicArtifact } from './root-static-artifacts';
import type { SiteLocale } from './locale-routes';

export type LookupGroup = keyof typeof LOOKUP_GROUP_SLUGS;

/** Bảy nhóm theo thứ tự công bố (`LOOKUP_GROUPS` của `js/unified-lookup.js`), đúng kiểu nhóm. */
const GROUPS = LOOKUP_GROUPS as LookupGroup[];

/** Mô tả ngắn của từng nhóm (menu, footer, thẻ mục lục, dòng dẫn trang nhóm). */
const LOOKUP_DESCRIPTIONS: Record<LookupGroup, {vi: string; zh: string}> = {
  heroes: {vi: 'Chỉ số, binh chủng và chiến pháp', zh: '属性、兵种与战法'},
  tactics: {vi: 'Hiệu quả và cách dùng chiến pháp', zh: '战法效果与用法'},
  equipment: {vi: 'Trang bị theo ô và phẩm chất', zh: '按部位与品质查看装备'},
  advisors: {vi: 'Hiệu ứng và cách dùng quân sư', zh: '军师效果与用法'},
  'troop-mods': {vi: 'Cải tạo binh chủng và gợi ý build', zh: '兵种进阶与搭配建议'},
  buildings: {vi: 'Công trình theo cấp và hiệu quả', zh: '按等级查看建筑效果'},
  books: {vi: 'Binh thư theo tên Việt và chữ Hán', zh: '按名称查询兵书'},
};

export function lookupDescription(group: LookupGroup, locale: SiteLocale) {
  return pick(locale, LOOKUP_DESCRIPTIONS[group].vi, LOOKUP_DESCRIPTIONS[group].zh);
}

/** Corpus Tra cứu (`buildLookupCorpus` của `js/unified-lookup.js`): mục theo nhóm và theo mã. */
interface LookupCorpus {
  groups: Record<LookupGroup, {id: string}[]>;
  byId: Map<string, unknown>;
}

let corpusPromise: Promise<LookupCorpus> | null = null;

async function loadCorpus(): Promise<LookupCorpus> {
  const snapshot = await lookupPublicationSnapshot();
  const rawFiles = Object.fromEntries(
    ['heroes-dict.json', 'tactics.json', 'lookup-catalog.json'].map((name) => [name, new Uint8Array(snapshot.files[name])]),
  );
  const bundle = await validateLookupBundle(structuredClone(snapshot.manifest), rawFiles);
  const [{ bytes: bookBytes }, bookAliases] = await Promise.all([
    readPublicArtifact({ kind: 'data', routeParam: 'books-dict' }),
    lookupBookAliases(),
  ]);
  const books = JSON.parse(Buffer.from(bookBytes).toString('utf8'));
  return buildLookupCorpus({ heroes: bundle.heroes, tactics: bundle.tactics, catalog: bundle.catalog, books, bookAliases });
}

/** Corpus đầy đủ của publication, kiểm trọn bộ một lần mỗi build. */
export function lookupBuildCorpus() {
  corpusPromise ??= loadCorpus();
  return corpusPromise;
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
 * HTML dựng sẵn của trang nhóm: trang đầu (60 mục) của lưới, dòng trạng thái và hàng "Xem thêm", cùng cây
 * markup mà `js/lookup-page.js` dựng lại trong trình duyệt.
 */
export async function lookupGroupFirstPage(group: LookupGroup, locale: SiteLocale) {
  const corpus = await lookupBuildCorpus();
  const { items, total } = searchLookupGroup(corpus, { group, page: 1, pageSize: PAGE_SIZE, locale });
  return {
    total,
    // Tướng có bố cục riêng (artboard Lookup: 5 cột, chân dung vuông, vạch phe); nhóm catalog giữ lưới thẻ chung.
    gridClass: group === 'tactics'
      ? 'lookup-grid lookup-grid-table'
      : `lookup-grid lookup-grid-cards${group === 'heroes' ? ' lookup-grid-heroes' : ''}`,
    resultsHtml: lookupResultTrees(group, items, locale).map(treeToHtml).join(''),
    summaryHtml: lookupSummaryTrees(group, total, locale).map(treeToHtml).join(''),
    orderNote: total ? lookupOrderNote('', locale) : null,
    moreHtml: lookupMoreTrees(items.length, total, locale).map(treeToHtml).join(''),
  };
}
