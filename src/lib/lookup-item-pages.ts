// Dữ liệu lúc build của trang riêng từng mục Tra cứu (`/tra-cuu/<nhóm>/<slug>/` + bản `/zh/`): 886 mục × 2 ngôn ngữ từ
// ledger slug đóng băng (`lookupDetailRoutes`). Hồ sơ dựng bằng đúng cây view mà hộp thoại/panel của trình duyệt dùng
// (`createProfileRenderer(...).profilePageTree` cho tướng/chiến pháp/binh thư, `masterDetailTree` cho bốn nhóm catalog)
// rồi `treeToHtml`; tiêu đề và mô tả meta tính từ chính bản ghi nên mỗi trang một bộ riêng.
import { createProfileRenderer } from '../../js/lookup-profile.js';
import { isMasterGroup, masterDetailTree, masterTargetFor } from '../../js/lookup-master.js';
import { effectVersions, isTranslatedZhEffect, isVersionHeading, lookupDisplayName, tacticTypeLabel, zhSafeValue } from '../../js/lookup-detail.js';
import { lookupCardView, lookupGroupLabels } from '../../js/unified-lookup.js';
import { LOOKUP_GROUP_SLUGS, lookupGroupPath } from '../../js/lookup-ids.js';
import { localePath, pick, withLocale } from '../../js/i18n.js';
import { treeToHtml } from '../../js/view-tree.js';
import { portraitUrl } from '../../js/hero-portrait.js';
import { lookupItemJsonLd } from './structured-data.ts';
import { lookupDetailRoutes } from './lookup-detail-routes.ts';
import { lookupBuildCorpus, lookupRouteHandles, type LookupGroup } from './lookup-pages.ts';
import { lookupSummaryTables, type LookupSummaryTables } from './team-ssr.ts';
import type { SiteLocale } from './locale-routes';

type Json = any;

/** `getStaticPaths` của trang riêng: mỗi mục trong ledger một đường dẫn `{group, slug}`. */
export async function lookupItemStaticPaths() {
  const routes = await lookupDetailRoutes();
  return routes.entries.map((entry) => ({
    params: { group: LOOKUP_GROUP_SLUGS[entry.group], slug: entry.slug },
    props: { id: entry.id, group: entry.group as LookupGroup },
  }));
}

const SNIPPET_CHARS = 150;

/** Một đoạn chữ gọn cho mô tả meta: gộp khoảng trắng, cắt ở ranh giới từ, thêm "…" khi bị cắt. */
function snippet(value: unknown, limit = SNIPPET_CHARS): string {
  const text = String(value ?? '').replace(/\s+/gu, ' ').trim();
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const space = cut.lastIndexOf(' ');
  return `${(space > limit * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.，；：。]+$/u, '')}…`;
}

/** Đoạn đầu có nội dung của phiên bản hiệu ứng hiện hành (bản Việt dùng bản dịch, bản zh dùng chữ Hán nguồn); bỏ qua đoạn chỉ là nhãn phiên bản. */
const currentEffect = (value: unknown) => effectVersions(value)[0]?.paragraphs.find((paragraph) => !isVersionHeading(paragraph)) ?? '';

/** Đuôi mô tả sau tên/nhãn: `<sep> <chữ>` khi có chữ, không thì chấm cuối (không bao giờ để dấu hai chấm treo). */
const tail = (text: string, colon: string, stop: string) => (text ? `${colon}${colon === '：' ? '' : ' '}${text}` : stop);

const parts = (...values: unknown[]) => values.map((value) => String(value ?? '').trim()).filter(Boolean);

/** Mô tả meta của một mục theo nhóm; chỉ dùng chữ có thật của bản ghi (bản zh bỏ chữ chỉ có tiếng Việt). */
function describe(group: LookupGroup, item: Json, locale: SiteLocale): string {
  const zh = locale === 'zh';
  const record: Json = item.record ?? {};
  const name = lookupDisplayName(record, item.nameVi, locale);
  const shown = (value: unknown) => String(zhSafeValue(value, locale) ?? '').trim();
  if (group === 'heroes' || group === 'tactics' || group === 'books') {
    const meta = lookupCardView(group, item, locale).meta.map((part: Json) => part.text);
    if (group === 'heroes') {
      return zh
        ? `${name}（${meta.join('·')}）：武将属性、兵种适性、自带战法与相关阵容。`
        : `${name} — tướng ${meta.join(' · ')}: chỉ số, thích tính binh chủng, chiến pháp bản thân và các đội hình dùng tướng này.`;
    }
    // Chữ Hán dịch từ tiếng Việt (chưa đối chiếu) không vào meta/JSON-LD của bản zh: trang mang cờ, snippet thì không.
    const effect = zh && isTranslatedZhEffect(record) ? '' : snippet(currentEffect(zh ? record.effect : record.effectViet));
    if (group === 'tactics') {
      const type = tacticTypeLabel(record.type, locale);
      const head = parts(shown(record.quality) && (zh ? `品质${shown(record.quality)}` : `phẩm ${shown(record.quality)}`), type).join(zh ? '·' : ' · ');
      return zh ? `${name}（战法${head ? `，${head}` : ''}）${tail(effect, '：', '。')}` : `${name} — chiến pháp${head ? ` ${head}` : ''}${tail(effect, ':', '.')}`;
    }
    return zh ? `${name}（兵书）${tail(effect, '：', '。')}` : `${name} — binh thư${tail(effect, ':', '.')}`;
  }
  if (group === 'equipment') {
    const detail = parts(shown(record.slotVi), shown(record.qualityVi)).join(zh ? '·' : ' · ');
    const exclusive = item.exclusives?.length ?? 0;
    return zh
      ? `${name}（装备${detail ? `，${detail}` : ''}）：${exclusive ? `${exclusive} 个专属特技，` : ''}可锻造的通用特技。`
      : `${name} — trang bị${detail ? ` ${detail}` : ''}: ${exclusive ? `${exclusive} đặc kỹ độc quyền, ` : ''}đặc kỹ chung có thể rèn.`;
  }
  if (group === 'advisors') {
    const element = shown(record.elementVi);
    const points = Number.isFinite(Number(record.tacticPoints)) ? Number(record.tacticPoints) : null;
    return zh
      ? `${name}（军师技能${element ? `，${element}系` : ''}${points === null ? '' : `，${points} 战法点`}）：携带此技能的武将。`
      : `${name} — kỹ năng quân sư${element ? ` hệ ${element}` : ''}${points === null ? '' : `, ${points} điểm chiến pháp`}${tail(snippet(currentEffect(record.effectVi), 110), ':', '.')}`;
  }
  if (group === 'troop-mods') {
    return zh
      ? `${name}（兵种进阶）：进阶选项树与推荐路线。`
      : `${name} — cải tạo binh chủng${tail(snippet(record.appliesToVi || currentEffect(record.effectVi), 120), ':', '.')}`;
  }
  const max = Number.isFinite(Number(record.maxLevel)) ? Number(record.maxLevel) : null;
  return zh
    ? `${name}（建筑${max === null ? '' : `，最高 ${max} 级`}）：各等级效果与资源消耗。`
    : `${name} — công trình${max === null ? '' : `, cấp tối đa ${max}`}: ${snippet(record.summaryVi, 120) || 'hiệu quả và tài nguyên theo từng cấp.'}`;
}

export interface LookupItemPage {
  title: string;
  description: string;
  name: string;
  groupLabel: string;
  /** Đường dẫn trang nhóm (đã gắn tiền tố ngôn ngữ). */
  groupHref: string;
  /** HTML hồ sơ: `article` của hộp thoại (tướng/chiến pháp/binh thư) hoặc chi tiết catalog. */
  bodyHtml: string;
  master: boolean;
  /** JSON-LD của trang (`Thing`/`DefinedTerm` + `BreadcrumbList`). */
  structured: object[];
}

/** Cây view của hồ sơ một mục (phải gọi trong `withLocale`): đúng cây mà trang riêng và llms.txt cùng dùng. */
function itemTree(corpus: Json, summaries: LookupSummaryTables, item: Json, locale: SiteLocale) {
  const id = item.id as string;
  const group = item.group as LookupGroup;
  if (isMasterGroup(group)) {
    const target = masterTargetFor(corpus, id);
    if (!target) throw new Error(`Lookup master item has no detail target: ${id}`);
    return masterDetailTree(group, target.item, corpus, locale, { targetId: target.targetId, page: true });
  }
  const { profilePageTree } = createProfileRenderer({ group, openInPage: () => {}, onClose: () => {} });
  const tree = profilePageTree(corpus, id, {
    summaryTable: group === 'heroes' ? summaries.heroes : group === 'tactics' ? summaries.tactics : null,
    rawName: locale === 'zh' ? summaries.rawName : null,
  });
  if (!tree) throw new Error(`Lookup profile cannot be built: ${id}`);
  return tree;
}

/** Cây hồ sơ của mục `id` (llms.txt dùng chữ thuần của đúng cây này). */
export async function lookupItemTree(id: string, locale: SiteLocale) {
  const [corpus, , summaries] = await Promise.all([lookupBuildCorpus(), lookupRouteHandles(), lookupSummaryTables()]);
  const item: Json = corpus.byId.get(id);
  if (!item) throw new Error(`Lookup item has no corpus entry: ${id}`);
  return withLocale(locale, () => itemTree(corpus, summaries, item, locale));
}

/** Nhóm có thuật ngữ (`DefinedTerm`) trong JSON-LD; nhóm còn lại là `Thing`. */
const TERM_GROUPS = new Set<LookupGroup>(['tactics', 'books', 'advisors']);

/** Trang riêng của mục `id` ở ngôn ngữ `locale`; `site` là gốc tuyệt đối cho JSON-LD. */
export async function lookupItemPage(id: string, locale: SiteLocale, site: URL | string): Promise<LookupItemPage> {
  const [corpus, routes, summaries] = await Promise.all([lookupBuildCorpus(), lookupDetailRoutes(), lookupSummaryTables(), lookupRouteHandles()]);
  const item: Json = corpus.byId.get(id);
  if (!item) throw new Error(`Lookup item page has no corpus entry: ${id}`);
  const group = item.group as LookupGroup;
  return withLocale(locale, () => {
    const bodyHtml = treeToHtml(itemTree(corpus, summaries, item, locale));
    const name = lookupDisplayName(item.record, item.nameVi, locale);
    const groupLabel = lookupGroupLabels(locale)[group] as string;
    const siteName = pick(locale, 'Cẩm Nang Game Tam Quốc Chí - Chiến Lược', '三国志战略版攻略手册');
    const section = pick(locale, 'Tra cứu', '图鉴查询');
    const description = describe(group, item, locale);
    const groupHref = localePath(lookupGroupPath(group) as string, locale);
    // Tên chữ Hán chỉ ở bản Việt và chỉ khi trang có hiện nó (binh thư bản Việt không hiện chữ Hán, chỉ là khoá tìm);
    // bản Trung không hiện tên Việt nên không khai tên thay thế.
    const other = locale === 'zh' || group === 'books' ? null : lookupDisplayName(item.record, item.nameVi, 'zh');
    return {
      title: `${name} — ${groupLabel} — ${section} — ${siteName}`,
      description,
      name,
      groupLabel,
      groupHref,
      bodyHtml,
      master: isMasterGroup(group),
      structured: lookupItemJsonLd({
        locale,
        site,
        term: TERM_GROUPS.has(group),
        path: localePath(routes.byId.get(id)!.path, locale),
        name,
        alternateName: other && other !== name ? other : null,
        description,
        image: group === 'heroes' ? portraitUrl(item.record?.iconUrl) : null,
        group: { name: groupLabel, path: groupHref },
        hub: { name: section, path: localePath('/tra-cuu/', locale) },
      }),
    };
  });
}
