/**
 * Nội dung trang tĩnh một đội cộng đồng: hàm thuần `teamPageCopy` (title, description, FAQ theo ngôn ngữ trang) và
 * `communityTeamPageModel` (đọc từ điển lúc build, dựng tên tướng/chiến pháp, link Tra cứu, canonical, JSON-LD).
 * Chữ người dùng (tiêu đề, phân tích, tên tác giả) giữ nguyên ngôn ngữ gốc; chỉ khung câu hỏi và nhãn theo `locale`.
 */
import { createTeamLexicon, troopLabel } from '../../js/community-team-data.js';
import { localePath, pick, withLocale } from '../../js/i18n.js';
import { SITE_NAME } from './blog-seo.ts';
import { canonicalTeamPath, type CommunityTeam } from './community-teams.ts';
import { lookupDetailRoutes } from './lookup-detail-routes.ts';
import type { SiteLocale } from './locale-routes';
import { readPublicArtifact } from './root-static-artifacts.ts';
import { communityTeamJsonLd, type NamedPath } from './structured-data.ts';

export const DESCRIPTION_MAX = 155;

/**
 * Chữ người dùng đưa vào thẻ meta (`<title>`, og:title, description, author). Astro đã escape `"` và `&` trong thuộc tính
 * (không phải chặn XSS); mục đích ở đây là để dist không chứa chuỗi thẻ thô do người dùng gõ trong thuộc tính meta.
 * Đánh đổi: `<`/`>` hiển thị thành `‹`/`›` trong title/og/description. Chỉ dùng cho meta; nội dung trang đi qua biểu thức
 * Astro (tự escape) và JSON-LD qua `jsonLd()` giữ nguyên văn.
 */
export function metaText(text: string): string {
  return text.replace(/</gu, '‹').replace(/>/gu, '›');
}

/** Tên tác giả hiển thị; khớp fallback `displayName()` của js/community-api.js. */
export function teamAuthorName(team: Pick<CommunityTeam, 'author'>, locale: SiteLocale): string {
  return team.author.name?.trim() || pick(locale, 'Người chơi', '玩家');
}

/** Tên đã dịch theo ngôn ngữ trang: ba tướng và ba cặp chiến pháp, cùng thứ tự với đội. */
export interface TeamNames {
  heroes: readonly [string, string, string];
  tactics: readonly [readonly [string, string], readonly [string, string], readonly [string, string]];
}

export type TeamFaqKey = 'lineup' | 'playstyle' | 'strengths' | 'weaknesses' | 'counters' | 'counteredBy' | 'substitutes';

export interface TeamFaqEntry {
  key: TeamFaqKey;
  q: string;
  a: string;
}

export interface TeamPageCopy {
  title: string;
  description: string;
  faq: TeamFaqEntry[];
}

const ANALYSIS_FAQ_KEYS = ['playstyle', 'strengths', 'weaknesses', 'counters', 'counteredBy', 'substitutes'] as const;

const QUESTIONS: Record<Exclude<TeamFaqKey, 'lineup'>, (title: string, locale: SiteLocale) => string> = {
  playstyle: (title, locale) => pick(locale, `Đội ${title} chơi thế nào?`, `${title}怎么玩？`),
  strengths: (title, locale) => pick(locale, `Điểm mạnh của đội ${title} là gì?`, `${title}的优点是什么？`),
  weaknesses: (title, locale) => pick(locale, `Điểm yếu của đội ${title} là gì?`, `${title}的缺点是什么？`),
  counters: (title, locale) => pick(locale, `Đội ${title} khắc chế đội nào?`, `${title}克制哪些阵容？`),
  counteredBy: (title, locale) => pick(locale, `Đội nào khắc chế ${title}?`, `哪些阵容克制${title}？`),
  substitutes: (title, locale) => pick(locale, `Có thể thay tướng nào trong đội ${title}?`, `${title}可以用哪些武将替换？`),
};

/** Gộp khoảng trắng; quá `DESCRIPTION_MAX` code point thì cắt (tính cả `…`), không bao giờ cắt giữa cặp surrogate. */
function clampDescription(raw: string): string {
  const flat = raw.replace(/\s+/gu, ' ').trim();
  const points = Array.from(flat);
  if (points.length <= DESCRIPTION_MAX) return flat;
  return `${points.slice(0, DESCRIPTION_MAX - 1).join('').trimEnd()}…`;
}

export function teamPageCopy(team: CommunityTeam, names: TeamNames, locale: SiteLocale): TeamPageCopy {
  const [h1, h2, h3] = names.heroes;
  const troop = withLocale(locale, () => troopLabel(team.troop)) as string;
  const title = pick(
    locale,
    `${team.title} (${h1}, ${h2}, ${h3}) — Đội cộng đồng — ${SITE_NAME.vi}`,
    `${team.title}（${h1}、${h2}、${h3}）— 社区阵容 — ${SITE_NAME.zh}`,
  );
  const description = clampDescription(`${troop} · ${h1}, ${h2}, ${h3} — ${team.analysis.playstyle}`);
  const pairs = names.heroes.map((hero, index) => `${hero} (${names.tactics[index]!.join(', ')})`);
  const lineup: TeamFaqEntry = {
    key: 'lineup',
    q: pick(locale, `Đội ${team.title} gồm những tướng nào?`, `${team.title}由哪些武将组成？`),
    a: pick(locale, `Đội gồm ${pairs.join('; ')}. Binh chủng: ${troop}.`, `阵容为 ${pairs.join('；')}。兵种：${troop}。`),
  };
  const faq = [lineup];
  for (const key of ANALYSIS_FAQ_KEYS) {
    const answer = team.analysis[key];
    if (typeof answer === 'string' && answer.trim()) faq.push({ key, q: QUESTIONS[key](team.title, locale), a: answer });
  }
  return { title, description, faq };
}

export interface TeamPageModel {
  copy: TeamPageCopy;
  names: TeamNames;
  /** Link Tra cứu của từng tướng (cùng thứ tự đội); tướng không có hồ sơ riêng là `null`. */
  heroPaths: (string | null)[];
  /** `true` ở bản đúng ngôn ngữ văn bản người dùng: bản duy nhất được index và mang JSON-LD. */
  original: boolean;
  canonicalUrl: URL;
  /** Khối JSON-LD chưa tuần tự hoá (rỗng ở bản gương). */
  structured: object[];
}

let dictionaries: Promise<{ heroes: unknown[]; tactics: unknown[] }> | undefined;

/** Hai từ điển mà trang Tra cứu dùng; đọc một lần cho cả build. */
function teamDictionaries() {
  return dictionaries ??= (async () => {
    const [heroes, tactics] = await Promise.all(['heroes-dict', 'tactics'].map(async (routeParam) =>
      JSON.parse(Buffer.from((await readPublicArtifact({ kind: 'data', routeParam })).bytes).toString('utf8')) as unknown[]));
    return { heroes: heroes!, tactics: tactics! };
  })();
}

export async function communityTeamPageModel(team: CommunityTeam, locale: SiteLocale, site: URL | string): Promise<TeamPageModel> {
  const [dicts, routes] = await Promise.all([teamDictionaries(), lookupDetailRoutes()]);
  const lexicon = createTeamLexicon(dicts, locale);
  const names: TeamNames = {
    heroes: team.heroes.map((id) => lexicon.heroName(id)) as unknown as TeamNames['heroes'],
    tactics: team.tactics.map((pair) => pair.map((id) => lexicon.tacticName(id))) as unknown as TeamNames['tactics'],
  };
  const heroPaths = team.heroes.map((id) => {
    const route = routes.byId.get(id);
    return route ? localePath(route.path, locale) : null;
  });
  const copy = teamPageCopy(team, names, locale);
  const canonicalPath = canonicalTeamPath(team);
  const original = locale === team.textLang;
  const about: NamedPath[] = [];
  heroPaths.forEach((path, index) => {
    if (path) about.push({ name: names.heroes[index]!, path });
  });
  return {
    copy,
    names,
    heroPaths,
    original,
    canonicalUrl: new URL(canonicalPath, site),
    structured: original
      ? communityTeamJsonLd({
          locale,
          site,
          path: canonicalPath,
          name: team.title,
          description: copy.description,
          createdAt: team.createdAt,
          approvedAt: team.approvedAt,
          authorName: teamAuthorName(team, locale),
          heroes: about,
          faq: copy.faq,
        })
      : [],
  };
}
