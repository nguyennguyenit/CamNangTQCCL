import { websiteDisplayPublicationSnapshot } from './root-static-artifacts';
import { recommendedRoutePath, teamDetailCatalog } from './team-detail-routes';

/**
 * Số liệu Landing — mọi con số tính lúc build từ dữ liệu đã publish, không hard-code.
 *
 * Nguồn (một snapshot duy nhất, đã xác minh hash ở cả `website-display.json` và generation Recommended):
 * - `recommended/index.json` — cấu hình Đội chuẩn, hạng T0, mùa nguồn, thẻ/bảng xem trước.
 * - `recommended/seasons.json` — mùa mặc định + nhãn Việt của phe/loại binh/mục.
 * - `recommended/other-teams.json` — đúng tập trang `/doi-khac/` hiển thị (40), không phải `data/teams.json` (166,
 *   kho gốc trước khi khử trùng).
 * - `publicFiles/*.json` — `heroes-dict.json`, `tactics.json` (kho Tra cứu), `coexist.json`, `khaihoang.json`.
 *
 * Mẫu số của từng số ghi ngay ở trường tương ứng; số nào không có nguồn thì câu chứa nó không được dựng.
 * Chuỗi hiển thị chỉ nhận bản Việt: giá trị còn chữ Hán bị bỏ (không rò chữ nguồn ra UI).
 */
export interface LandingStatistics {
  /** Cấu hình Đội chuẩn = số bản ghi `index.json` của generation đang chọn. */
  standardConfigs: number;
  /** Cấu hình xếp T0 = bản ghi có `tierRaw === 'T0'`. */
  standardTier0: number;
  /** Mùa nguồn = số `sourceSeasonId` khác nhau trong `index.json`. */
  sourceSeasons: number;
  /** Tướng = phần tử `heroes-dict.json`. */
  heroes: number;
  /** Chiến pháp = phần tử `tactics.json`. */
  tactics: number;
  /** Đội khác = bản ghi `other-teams.json` (tập trang `/doi-khac/`). */
  otherTeams: number;
  /** Đội khác có ghi đội sợ = `legacyContent.counters.avoid` không rỗng. */
  otherTeamsWithCounters: number;
  /** Đội khác có ít nhất một phương án thay thế trong `legacyContent`. */
  otherTeamsWithAlternatives: number;
  /** Cùng Tồn: số nhóm, số đội mỗi nhóm, số tướng không trùng mỗi nhóm (dữ liệu phải đồng nhất giữa các nhóm). */
  coexist: { groups: number; teamsPerGroup: number; heroesPerGroup: number };
  /** Khai hoang: số đội, số mỏ, số đội Chạm Sứ, và số đội có ĐỦ cấu hình trước/sau. */
  khaiHoang: { teams: number; mines: number; chamSuTeams: number; beforeAfterTeams: number };
}

/** Ngôn ngữ của Landing: `vi` dùng bản Việt đã duyệt, `zh` dùng chữ Hán gốc của dữ liệu nguồn. */
export type LandingLocale = 'vi' | 'zh';

/** Một tướng trong thẻ xem trước; chuỗi đã đúng ngôn ngữ trang (Việt đã duyệt hoặc chữ Hán gốc). */
export interface LandingPreviewHolder {
  name: string;
  tactics: string[];
  books: string[];
  isMain: boolean;
}

export interface LandingTeamPreview {
  href: string;
  name: string;
  score: string | null;
  /** Tên phe hiển thị theo ngôn ngữ trang. */
  faction: string | null;
  /** Nhãn phe tiếng Việt: khoá tra màu phe (`FACTION_CODE`) dùng chung cho cả hai ngôn ngữ. */
  factionKeyVi: string | null;
  units: string[];
  holders: LandingPreviewHolder[];
}

export interface LandingTableRow {
  name: string;
  meta: string | null;
  holders: string;
  score: string;
}

export interface LandingTablePreview {
  scopeLabel: string;
  count: string;
  rows: LandingTableRow[];
}

export interface LandingPreviews {
  team: LandingTeamPreview;
  table: LandingTablePreview;
}

/** Đọc một file JSON trong snapshot đã publish; thiếu file là lỗi build, không im lặng bỏ số. */
function publishedJson(files: Record<string, Buffer | Uint8Array>, name: string): unknown {
  const bytes = files[name];
  if (!bytes) throw new Error(`Số liệu Landing thiếu file đã publish: ${name}`);
  return JSON.parse(Buffer.from(bytes).toString('utf8'));
}

/** Mảng con của một document đã publish, kèm tên trường để lỗi build chỉ đúng chỗ. */
function fieldArray(document: unknown, field: string, label: string): unknown[] {
  return publishedArray((document as Record<string, unknown> | null)?.[field], `${label}.${field}`);
}

/** Document đã publish dạng mảng trần (`heroes-dict.json`, `tactics.json`, `coexist.json`). */
function publishedArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Số liệu Landing: ${label} không phải mảng`);
  return value;
}

function field(document: unknown, name: string): unknown {
  return (document as Record<string, unknown> | null)?.[name] ?? null;
}

/** Trường chuỗi tuỳ chọn: `undefined`/`null` giữ nguyên, kiểu khác là lỗi build. */
function optionalString(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new Error(`Số liệu Landing: ${label} không phải chuỗi`);
  return value;
}

function optionalNumber(value: unknown, label: string): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number') throw new Error(`Số liệu Landing: ${label} không phải số`);
  return value;
}

/** Chuỗi hiển thị dùng được: có nội dung và không còn chữ Hán (luật của renderer: không rò chữ nguồn). */
function displayString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || /[\u3400-\u9fff\uf900-\ufaff]/u.test(trimmed)) return null;
  return trimmed;
}

/** Chuỗi nguồn nguyên bản (bản zh hiển thị chữ Hán gốc): chỉ bỏ ô trống. */
function rawString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

/** Mảng chuỗi hiển thị, bỏ ô trống/chữ Hán; độ dài giữ theo vị trí nguồn. */
function displaySlots(value: unknown): (string | null)[] {
  if (!Array.isArray(value)) return [];
  return value.map((slot) => displayString(slot));
}

/** Mảng chuỗi nguồn nguyên bản, bỏ ô trống. */
function rawSlots(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((slot) => rawString(slot)).filter((slot): slot is string => Boolean(slot));
}

/** `vi-NN`: dấu chấm phân cách nghìn, không phụ thuộc ICU của môi trường build. */
export function viNumber(value: number): string {
  if (!Number.isInteger(value) || value < 0) throw new Error(`Số liệu Landing phải là số nguyên không âm: ${value}`);
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Số theo ngôn ngữ trang: `vi` chấm phân cách nghìn, `zh` dấu phẩy (zh-CN); cùng luật kiểm như `viNumber`. */
export function localeNumber(value: number, locale: LandingLocale): string {
  const vi = viNumber(value);
  return locale === 'zh' ? vi.replaceAll('.', ',') : vi;
}

/** Số phương án thay thế trong `legacyContent` của một đội (tướng, chiến pháp, binh thư). */
function alternativeSlots(legacyContent: unknown): number {
  const heroes = (legacyContent as Record<string, unknown> | null)?.heroes;
  if (!Array.isArray(heroes)) return 0;
  let total = 0;
  for (const hero of heroes) {
    const holder = hero as Record<string, unknown>;
    for (const key of ['alternatives', 'tactics', 'books']) {
      const items = holder[key];
      if (!Array.isArray(items)) continue;
      if (key === 'alternatives') {
        total += items.length;
        continue;
      }
      for (const item of items) {
        const alternatives = (item as Record<string, unknown>).alternatives;
        if (Array.isArray(alternatives)) total += alternatives.length;
      }
    }
  }
  return total;
}

/** Bản ghi Đội khác chỉ dùng `legacyContent`: số đội sợ và số phương án thay thế. */
function parseOtherTeamLegends(value: unknown) {
  return fieldArray(value, 'records', 'other-teams.json').map((row) => {
    const legacyContent = field(row, 'legacyContent');
    const counters = field(legacyContent, 'counters');
    const avoid = field(counters, 'avoid');
    return {
      avoidCount: Array.isArray(avoid) ? avoid.length : 0,
      alternativeCount: alternativeSlots(legacyContent),
    };
  });
}

/** Cùng Tồn: số đội và số tướng không trùng của từng nhóm; các nhóm phải đồng nhất để câu chữ đúng. */
function parseCoexistGroups(groups: unknown[]) {
  return groups.map((group, at) => {
    const teams = fieldArray(group, 'teams', `coexist[${at}].teams`);
    const heroNames = new Set<string>();
    for (const team of teams) {
      for (const hero of fieldArray(team, 'heroes', `coexist[${at}].teams[].heroes`)) {
        const name = displayString(field(hero, 'name'));
        if (name) heroNames.add(name);
      }
    }
    return { teams: teams.length, heroes: heroNames.size };
  });
}

/** Một đội Khai hoang có ĐỦ cấu hình trước/sau: mọi tướng đều có bộ trước và bộ sau. */
function hasBeforeAfterBuild(team: unknown): boolean {
  const heroes = field(team, 'heroes');
  if (!Array.isArray(heroes) || !heroes.length) return false;
  return heroes.every((hero) => {
    const beforeTactic = displayString(field(hero, 'tacticBefore'));
    const beforeUnit = displayString(field(hero, 'unitTypeBefore'));
    const afterUnit = displayString(field(hero, 'unitTypeAfter'));
    const afterTactics = displaySlots(field(hero, 'tacticsAfter')).filter(Boolean);
    return Boolean(beforeTactic && beforeUnit && afterUnit && afterTactics.length);
  });
}

/** Bản ghi Recommended: mọi trường dùng cho số đếm và hai khối xem trước. */
function parseRecommendedRecords(index: unknown) {
  return fieldArray(index, 'records', 'recommended/index.json').map((row, at) => ({
    tierRaw: optionalString(field(row, 'tierRaw'), `index.records[${at}].tierRaw`),
    sourceSeasonId: optionalString(field(row, 'sourceSeasonId'), `index.records[${at}].sourceSeasonId`),
    sourceConfigId: optionalString(field(row, 'sourceConfigId'), `index.records[${at}].sourceConfigId`),
    scopeKey: optionalString(field(row, 'safeScopeKey'), `index.records[${at}].safeScopeKey`),
    listIndex: optionalNumber(field(row, 'listIndex'), `index.records[${at}].listIndex`) ?? at,
    name: displayString(field(row, 'displayNameVi')),
    nameZh: rawString(field(row, 'nameZh')),
    score: optionalNumber(field(row, 'value'), `index.records[${at}].value`),
    factionRaw: optionalString(field(row, 'factionRaw'), `index.records[${at}].factionRaw`),
    unitsRaw: fieldArray(row, 'unitTypesRaw', `index.records[${at}]`).map((unit) => String(unit)),
    holders: fieldArray(row, 'heroes', `index.records[${at}]`).map((holder) => ({
      name: displayString(field(holder, 'displayNameVi')),
      tactics: displaySlots(field(holder, 'tacticSlotsVi')).filter(Boolean) as string[],
      books: displaySlots(field(holder, 'bookSlotsVi')).filter(Boolean) as string[],
      nameZh: rawString(field(holder, 'nameRaw')),
      tacticsZh: rawSlots(field(holder, 'tacticSlotsRaw')),
      booksZh: rawSlots(field(holder, 'bookSlotsRaw')),
    })),
  }));
}

/** Nhãn Việt của mục/phe/loại binh trong generation (`displayLabels`). */
function parseDisplayLabels(seasons: unknown) {
  const labels = field(seasons, 'displayLabels');
  const group = (name: string): Record<string, string> => {
    const map = field(labels, name);
    if (!map || typeof map !== 'object') return {};
    return Object.fromEntries(
      Object.entries(map as Record<string, unknown>)
        .map(([key, value]) => [key, displayString(value)])
        .filter((entry): entry is [string, string] => Boolean(entry[1])),
    );
  };
  return { faction: group('faction'), unit: group('unit') };
}

export async function landingStatistics(): Promise<LandingStatistics> {
  const snapshot = await websiteDisplayPublicationSnapshot();

  const recommended = parseRecommendedRecords(publishedJson(snapshot.recommended.files, 'index.json'));
  const legends = parseOtherTeamLegends(publishedJson(snapshot.recommended.files, 'other-teams.json'));
  const heroes = publishedArray(publishedJson(snapshot.publicFiles, 'heroes-dict.json'), 'heroes-dict.json');
  const tactics = publishedArray(publishedJson(snapshot.publicFiles, 'tactics.json'), 'tactics.json');

  const groups = parseCoexistGroups(publishedArray(publishedJson(snapshot.publicFiles, 'coexist.json'), 'coexist.json'));
  const [firstGroup] = groups;
  if (!firstGroup || groups.some((group) => group.teams !== firstGroup.teams || group.heroes !== firstGroup.heroes)) {
    throw new Error('Số liệu Landing: số đội hoặc số tướng không trùng khác nhau giữa các nhóm Cùng Tồn');
  }

  const khaiHoang = publishedJson(snapshot.publicFiles, 'khaihoang.json');
  const khaiHoangTeams = fieldArray(khaiHoang, 'teams', 'khaihoang.json');

  return {
    standardConfigs: recommended.length,
    standardTier0: recommended.filter((row) => row.tierRaw === 'T0').length,
    sourceSeasons: new Set(recommended.map((row) => row.sourceSeasonId)).size,
    heroes: heroes.length,
    tactics: tactics.length,
    otherTeams: legends.length,
    otherTeamsWithCounters: legends.filter((legend) => legend.avoidCount > 0).length,
    otherTeamsWithAlternatives: legends.filter((legend) => legend.alternativeCount > 0).length,
    coexist: { groups: groups.length, teamsPerGroup: firstGroup.teams, heroesPerGroup: firstGroup.heroes },
    khaiHoang: {
      teams: khaiHoangTeams.length,
      mines: fieldArray(khaiHoang, 'mines', 'khaihoang.json').length,
      chamSuTeams: fieldArray(khaiHoang, 'chamSuTeams', 'khaihoang.json').length,
      beforeAfterTeams: khaiHoangTeams.filter(hasBeforeAfterBuild).length,
    },
  };
}

/**
 * Hai khối xem trước của Landing dựng từ dữ liệu publish thật: thẻ đội đầu tiên và bảng 4 dòng đầu của
 * phạm vi mặc định (`seasons.defaultSourceSeasonId` + scope đầu tiên), kèm link chi tiết tính lúc build.
 * Bản `zh` hiển thị chữ Hán gốc của nguồn (tên đội, tướng, chiến pháp, binh thư, phe, loại binh);
 * `href` luôn là đường canonical tiếng Việt — nơi render thêm tiền tố ngôn ngữ.
 */
export async function landingPreviews(locale: LandingLocale = 'vi'): Promise<LandingPreviews> {
  const zh = locale === 'zh';
  const snapshot = await websiteDisplayPublicationSnapshot();
  const seasons = publishedJson(snapshot.recommended.files, 'seasons.json');
  const recommended = parseRecommendedRecords(publishedJson(snapshot.recommended.files, 'index.json'));
  const labels = parseDisplayLabels(seasons);

  const defaultSeasonId = optionalString(field(seasons, 'defaultSourceSeasonId'), 'seasons.defaultSourceSeasonId');
  const scoped = recommended.filter((row) => row.sourceSeasonId === defaultSeasonId && row.scopeKey);
  const [first] = [...scoped].sort((left, right) => left.listIndex - right.listIndex);
  if (!first?.scopeKey) throw new Error('Số liệu Landing: không tìm thấy phạm vi mặc định để dựng khối xem trước');

  const season = fieldArray(seasons, 'seasonOptions', 'seasons.json')
    .find((option) => field(option, 'sourceSeasonId') === defaultSeasonId);
  // Mã mùa hiển thị (OG, PK-S28…) — không dùng `label`/`sourceSeasonId` vì với mùa OG chúng còn chữ Hán.
  const seasonLabel = displayString(field(season, 'displayCode')) ?? displayString(field(season, 'label')) ?? '';
  const seasonName = zh
    ? rawString(field(season, 'nameRaw')) ?? ''
    : displayString(field(season, 'nameVi')) ?? displayString(field(season, 'displayNameVi')) ?? '';

  const routeByConfig = new Map(
    (await teamDetailCatalog()).recommended.map((entry) => [entry.sourceConfigId, recommendedRoutePath(entry.routeSegment)]),
  );

  const scopeRows = scoped.filter((row) => row.scopeKey === first.scopeKey);
  const detailHref = first.sourceConfigId ? routeByConfig.get(first.sourceConfigId) : undefined;
  if (!detailHref) throw new Error(`Số liệu Landing: không có route chi tiết cho ${first.sourceConfigId ?? '(thiếu id)'}`);

  type Row = (typeof recommended)[number];
  type Holder = Row['holders'][number];
  // Bản zh: khoá nguồn của phe/loại binh chính là chữ Hán hiển thị.
  const factionOf = (row: Row): string | null =>
    row.factionRaw ? (zh ? row.factionRaw : labels.faction[row.factionRaw] ?? null) : null;
  const unitsOf = (row: Row): string[] =>
    zh ? row.unitsRaw.filter(Boolean) : row.unitsRaw.map((unit) => labels.unit[unit]).filter(Boolean);
  const teamName = (row: Row): string => (zh ? row.nameZh ?? row.name : row.name) ?? '';
  const holderName = (holder: Holder): string => (zh ? holder.nameZh ?? holder.name : holder.name) ?? '';
  const metaOf = (row: Row): string | null => {
    const parts = [factionOf(row), ...unitsOf(row)].filter(Boolean);
    return parts.length ? parts.join(' · ') : null;
  };
  const scoreOf = (row: Row): string => (row.score === null ? '—' : String(row.score));

  const toTableRow = (row: Row): LandingTableRow => ({
    name: teamName(row),
    meta: metaOf(row),
    holders: row.holders.map(holderName).filter(Boolean).join(' · '),
    score: scoreOf(row),
  });
  const count = localeNumber(scopeRows.length, locale);

  return {
    team: {
      href: detailHref,
      name: teamName(first),
      score: first.score === null ? null : String(first.score),
      faction: factionOf(first),
      factionKeyVi: first.factionRaw ? labels.faction[first.factionRaw] ?? null : null,
      units: unitsOf(first),
      holders: first.holders.map((holder, index) => ({
        name: holderName(holder),
        tactics: zh ? holder.tacticsZh : holder.tactics,
        books: zh ? holder.booksZh : holder.books,
        isMain: index === 0,
      })),
    },
    table: {
      scopeLabel: [seasonLabel, seasonName].filter(Boolean).join(' · '),
      count: zh ? `${count} / ${count} 支` : `${count} / ${count} đội`,
      rows: [...scopeRows].sort((left, right) => left.listIndex - right.listIndex).slice(0, 4).map(toTableRow),
    },
  };
}

/** Câu có số của Landing: dựng lúc build từ `LandingStatistics` để không hard-code con số nào. */
export interface LandingCopy {
  heroLead: string;
  standardCount: string;
  standardNote: string;
  otherCount: string;
  otherNote: string;
  coexistNote: string;
  khaiHoangNote: string;
}

export function landingCopy(stats: LandingStatistics, locale: LandingLocale = 'vi'): LandingCopy {
  const { coexist, khaiHoang } = stats;
  if (locale === 'zh') {
    const n = (value: number) => localeNumber(value, 'zh');
    return {
      heroLead: `${n(stats.standardConfigs)} 套推荐配将，覆盖 ${n(stats.sourceSeasons)} 个来源赛季；另有 ${n(stats.otherTeams)} 支玩家汇总阵容，以及 ${n(stats.heroes)} 名武将、${n(stats.tactics)} 个战法可供查询——免费使用，无需注册。`,
      standardCount: `${n(stats.standardConfigs)} 套配将`,
      standardNote: '，按赛季与分类整理，保留来源顺序并附来源评分。',
      otherCount: `${n(stats.otherTeams)} 支阵容`,
      otherNote: `，均为玩家汇总：${n(stats.otherTeamsWithCounters)} 支注明畏惧阵容，${n(stats.otherTeamsWithAlternatives)} 支附有替换方案。`,
      coexistNote: `${n(coexist.groups)} 组，每组 ${n(coexist.teamsPerGroup)} 支队伍可同时上阵——共 ${n(coexist.heroesPerGroup)} 名武将互不重复。`,
      khaiHoangNote: `${n(khaiHoang.teams)} 支开荒队伍，其中 ${n(khaiHoang.beforeAfterTeams)} 支配有完整的前后期配置、${n(khaiHoang.chamSuTeams)} 支碰瓷队，另附 ${n(khaiHoang.mines)} 座矿的守军信息。`,
    };
  }
  return {
    heroLead: `${viNumber(stats.standardConfigs)} cấu hình đội từ ${viNumber(stats.sourceSeasons)} mùa nguồn, ${viNumber(stats.otherTeams)} đội người chơi tổng hợp, cùng ${viNumber(stats.heroes)} tướng và ${viNumber(stats.tactics)} chiến pháp để tra cứu — miễn phí, không cần tài khoản.`,
    standardCount: `${viNumber(stats.standardConfigs)} cấu hình`,
    standardNote: 'theo mùa và danh mục, giữ đúng thứ tự nguồn, kèm điểm nguồn.',
    otherCount: `${viNumber(stats.otherTeams)} đội`,
    otherNote: `người chơi tổng hợp: ${viNumber(stats.otherTeamsWithCounters)} đội ghi đội sợ, ${viNumber(stats.otherTeamsWithAlternatives)} đội có phương án thay thế.`,
    coexistNote: `${viNumber(coexist.groups)} nhóm, mỗi nhóm ${viNumber(coexist.teamsPerGroup)} đội dùng cùng lúc — ${viNumber(coexist.heroesPerGroup)} tướng không trùng nhau.`,
    khaiHoangNote: `${viNumber(khaiHoang.teams)} đội mở đất, ${viNumber(khaiHoang.beforeAfterTeams)} đội có đủ cấu hình trước/sau, ${viNumber(khaiHoang.chamSuTeams)} đội Chạm Sứ, cùng quân thủ của ${viNumber(khaiHoang.mines)} mỏ.`,
  };
}
