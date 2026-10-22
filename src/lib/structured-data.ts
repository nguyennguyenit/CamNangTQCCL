/**
 * Dữ liệu có cấu trúc (JSON-LD) của trang đội, trang nhóm Tra cứu và trang riêng từng mục Tra cứu (mẫu: `blog-seo.ts`).
 * Mỗi hàm chỉ nhận chữ đã có trong HTML của trang (tên, mô tả meta, tên mục) nên JSON-LD không mô tả thứ người đọc không thấy.
 * Mọi chuỗi chọn đúng một ngôn ngữ qua `pick()`; `path` truyền vào đã gắn tiền tố ngôn ngữ.
 */
import { localePath, pick } from '../../js/i18n.js';
import { breadcrumbJsonLd } from './blog-seo.ts';
import type { SiteLocale } from './locale-routes';

const SCHEMA = 'https://schema.org';
const absolute = (path: string, site: URL | string) => new URL(path, site).href;
const htmlLang = (locale: SiteLocale) => pick(locale, 'vi', 'zh-Hans');

/** Trò chơi mà cẩm nang nói tới: mọi trang đội/Tra cứu là một phần của nó. */
function videoGame(locale: SiteLocale) {
  return { '@type': 'VideoGame', name: '三国志·战略版', alternateName: pick(locale, 'Tam Quốc Chí - Chiến Lược', '三国志战略版') };
}

const homeCrumb = (locale: SiteLocale) => ({ name: pick(locale, 'Trang chủ', '首页'), path: localePath('/', locale) });

export interface NamedPath {
  name: string;
  /** Đường dẫn trang riêng (đã gắn tiền tố ngôn ngữ). */
  path: string;
}

export interface TeamDetailStructured {
  locale: SiteLocale;
  site: URL | string;
  /** Đường dẫn của trang chi tiết đội. */
  path: string;
  name: string;
  description: string;
  family: NamedPath;
  /** Tướng của đội có trang riêng trong Tra cứu (tướng không có hồ sơ không có mặt). */
  heroes: readonly NamedPath[];
}

/** Trang chi tiết đội: `WebPage` nói về các tướng của đội + `BreadcrumbList`. */
export function teamDetailJsonLd(input: TeamDetailStructured) {
  const { locale, site } = input;
  const url = absolute(input.path, site);
  return [
    {
      '@context': SCHEMA,
      '@type': 'WebPage',
      name: input.name,
      description: input.description,
      url,
      inLanguage: htmlLang(locale),
      isPartOf: videoGame(locale),
      ...(input.heroes.length
        ? { about: input.heroes.map((hero) => ({ '@type': 'Thing', name: hero.name, url: absolute(hero.path, site) })) }
        : {}),
    },
    breadcrumbJsonLd([homeCrumb(locale), input.family, { name: input.name, path: input.path }], site),
  ];
}

export interface LookupGroupStructured {
  locale: SiteLocale;
  site: URL | string;
  path: string;
  name: string;
  description: string;
  /** Mọi mục của nhóm (hoặc mọi đội của mùa) theo thứ tự hiển thị, mỗi mục có trang riêng. */
  items: readonly NamedPath[];
  hub: NamedPath;
}

/**
 * Trang nhóm Tra cứu: `CollectionPage` + `ItemList` (mọi phần tử có `url` trang riêng) + `BreadcrumbList`.
 * Trang mùa Đội chuẩn dùng chung: `hub` là mục Đội chuẩn, `items` là các đội của mùa (Trang chủ › Đội chuẩn › mùa).
 */
export function lookupGroupJsonLd(input: LookupGroupStructured) {
  const { locale, site } = input;
  const url = absolute(input.path, site);
  return [
    {
      '@context': SCHEMA,
      '@type': 'CollectionPage',
      name: input.name,
      description: input.description,
      url,
      inLanguage: htmlLang(locale),
      isPartOf: videoGame(locale),
      mainEntity: {
        '@type': 'ItemList',
        name: input.name,
        numberOfItems: input.items.length,
        itemListElement: input.items.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          url: absolute(item.path, site),
          name: item.name,
        })),
      },
    },
    breadcrumbJsonLd([homeCrumb(locale), input.hub, { name: input.name, path: input.path }], site),
  ];
}

export interface LookupItemStructured {
  locale: SiteLocale;
  site: URL | string;
  /** `DefinedTerm` (chiến pháp, binh thư, quân sư) hay `Thing` (tướng, trang bị, công trình, cải tạo binh chủng). */
  term: boolean;
  path: string;
  name: string;
  /** Tên bằng ngôn ngữ còn lại có trong trang (chữ Hán ở bản Việt, tên Việt ở bản Trung); vắng thì bỏ. */
  alternateName?: string | null;
  description: string;
  /** Ảnh tuyệt đối `https` của tướng; mục không có ảnh thì bỏ. */
  image?: string | null;
  group: NamedPath;
  hub: NamedPath;
}

/** Trang riêng của một mục: `ItemPage` (url, inLanguage, isPartOf — chỉ hợp lệ trên CreativeWork) có `mainEntity` là `Thing`/`DefinedTerm`, + `BreadcrumbList` (Tra cứu → Nhóm → Mục). */
export function lookupItemJsonLd(input: LookupItemStructured) {
  const { locale, site } = input;
  const url = absolute(input.path, site);
  return [
    {
      '@context': SCHEMA,
      '@type': 'ItemPage',
      url,
      inLanguage: htmlLang(locale),
      isPartOf: videoGame(locale),
      mainEntity: {
        '@type': input.term ? 'DefinedTerm' : 'Thing',
        name: input.name,
        ...(input.alternateName ? { alternateName: input.alternateName } : {}),
        description: input.description,
        ...(input.image ? { image: input.image } : {}),
        ...(input.term ? { inDefinedTermSet: { '@type': 'DefinedTermSet', name: input.group.name, url: absolute(input.group.path, site) } } : {}),
      },
    },
    breadcrumbJsonLd([homeCrumb(locale), input.hub, input.group, { name: input.name, path: input.path }], site),
  ];
}
