import { z } from "zod";

import { normalizeText, teamSearchBlob } from "../../../js/filters.js";
import { resolveSeasonContext } from "../../../js/season-context.js";
import type { ArtifactRecord } from "../data/artifact-contracts.js";
import type {
  LocalePaths,
  PublicationReadModel,
  TeamCollection,
  TeamHeroSummary,
  TeamSummaryView,
} from "../data/publication-projection.js";
import type { SeasonContext } from "../domain/canonical-state.js";
import { legacyDomainAdapter } from "../domain/legacy-domain-adapter.js";
import { seasonDomain, type BrowseEntry } from "../domain/season-domain-adapter.js";
import { allowGuide, allowTierRanking } from "../data/team-source-allowlist.js";
import { decodeCursor, encodeCursor, type CursorBinding } from "./cursor.js";
import { PUBLIC_ERRORS, ResearchHandlerError, type ResearchErrorCode } from "./handler-error.js";
import { fitPage } from "./page.js";
import {
  boundedText,
  commonResultSchema,
  decimalNumberish,
  heroId,
  seasonContextSchema,
  seasonId,
  tacticId,
  workflowVersion,
} from "./shared-schemas.js";
import { parseToolInput, type ToolContext } from "./tool-context.js";

export const TEAM_COLLECTION_IDS = ["recommended", "other", "khaihoang", "engine"] as const;
export type TeamCollectionId = (typeof TEAM_COLLECTION_IDS)[number];

const locale = z.enum(["vi", "zh"]).optional().describe("vi (mặc định) hoặc zh; chỉ đổi tên hiển thị và pagePath.");
const cursorText = z.string().max(2_048).optional().describe("Cursor trang trước; bắt buộc kèm expectedWorkflowVersion.");
const refId = z.string().min(1).max(256).regex(/^[^\u0000-\u001f\u007f-\u009f]+$/u);
const nullableText = z.string().max(2_048).nullable().optional();

export const referenceSelectorSchema = z
  .object({
    collection: z.enum(TEAM_COLLECTION_IDS).describe("Họ đội: recommended, other, khaihoang hoặc engine."),
    sourceConfigId: refId.optional().describe("recommended: sourceConfigId."),
    legacyTeamId: refId.optional().describe("other: legacyTeamId."),
    legacyVariantId: refId.optional().describe("other: legacyVariantId của biến thể đã nhận."),
    khaiHoangTeamId: refId.optional().describe("khaihoang: id đội."),
    teamId: refId.optional().describe("engine: teamId (dạng team:<id> hoặc id gốc)."),
    configId: seasonId.optional().describe("engine + seasonContext: configId cụ thể."),
  })
  .strict();

const SELECTOR_FIELDS: Record<TeamCollectionId, { required: string[]; optional: string[] }> = {
  recommended: { required: ["sourceConfigId"], optional: [] },
  other: { required: ["legacyTeamId", "legacyVariantId"], optional: [] },
  khaihoang: { required: ["khaiHoangTeamId"], optional: [] },
  engine: { required: ["teamId"], optional: ["configId"] },
};
const ALL_SELECTOR_FIELDS = ["sourceConfigId", "legacyTeamId", "legacyVariantId", "khaiHoangTeamId", "teamId", "configId"];

const referenceInputSchema = referenceSelectorSchema.superRefine((value, ctx) => {
  const spec = SELECTOR_FIELDS[value.collection];
  const record = value as Record<string, unknown>;
  for (const field of ALL_SELECTOR_FIELDS) {
    const present = record[field] !== undefined;
    const allowed = spec.required.includes(field) || spec.optional.includes(field);
    if ((spec.required.includes(field) && !present) || (present && !allowed)) {
      ctx.addIssue({ code: "custom", message: "reference field mismatch", path: [field] });
    }
  }
});

/**
 * `legacyVariantId` gốc là `v-<64 hex>`; client MCP che chuỗi hex dài nên selector công bố
 * dùng 24 hex đầu. Server nhận cả dạng rút gọn lẫn dạng đầy đủ.
 */
export function publicVariantId(variantId: string): string {
  return /^v-[0-9a-f]{64}$/u.test(variantId) ? variantId.slice(0, 26) : variantId;
}

export type ReferenceSelector = z.infer<typeof referenceSelectorSchema>;

// -------------------------------------------------------------------------------------------
// find_teams
// -------------------------------------------------------------------------------------------

export const findTeamsInputSchema = z
  .object({
    collection: z.enum(TEAM_COLLECTION_IDS).describe("Họ đội cần duyệt; không trộn họ."),
    sourceSeasonId: seasonId.optional().describe("Chỉ recommended: mùa nguồn lấy từ registry của tqccl_get_playbook."),
    sourceCategoryId: seasonId.optional().describe("Chỉ recommended: nhóm nguồn (ví dụ giao chiến)."),
    query: z.string().max(256).optional().describe("Tên, biệt danh hoặc tên tướng; bỏ trống để duyệt."),
    heroes: z
      .array(
        z
          .object({
            canonicalId: heroId,
            tacticIds: z.array(tacticId).max(20).describe("Chiến pháp đang gắn với tướng này."),
          })
          .strict(),
      )
      .max(20)
      .optional()
      .describe("Roster canonical; xếp theo số tướng và chiến pháp đúng holder."),
    minHeroes: z.number().int().min(1).max(3).optional().describe("Số tướng trùng tối thiểu khi có heroes (mặc định 2)."),
    seasonContext: seasonContextSchema.optional().describe("Chỉ engine: cặp kịch bản/luật đã xác minh."),
    limit: decimalNumberish(z.number().int().min(1).max(50).optional()).describe("Số kết quả mỗi trang, mặc định 20."),
    cursor: cursorText,
    locale,
    expectedWorkflowVersion: workflowVersion.optional(),
  })
  .strict();

const text2k = (description: string) => z.string().max(2_048).nullable().optional().describe(description);
const idText = (description: string) => z.string().max(256).nullable().optional().describe(description);
const count = (description: string) => z.number().int().nonnegative().describe(description);

const altTacticSchema = z
  .object({
    vi: text2k("Tên chiến pháp thay thế theo nguồn."),
    tacticId: idText("ID chiến pháp thay thế nếu khớp được."),
    pagePath: z.string().max(512).optional().describe("Trang tra cứu chiến pháp thay thế theo locale."),
  })
  .strict();

const slotTacticSchema = z
  .object({
    slot: count("Chỉ số ô chiến pháp trên holder."),
    vi: text2k("Tên chiến pháp tiếng Việt."),
    raw: text2k("Tên chiến pháp nguyên bản của nguồn."),
    tacticId: idText("ID chiến pháp nếu nguồn khớp được."),
    pagePath: z.string().max(512).optional().describe("Trang tra cứu chiến pháp theo locale."),
    tacticRefs: z.array(z.string().max(256)).max(50).optional().describe("Tham chiếu chiến pháp của cấu hình mùa."),
    alternatives: z.array(altTacticSchema).max(20).optional().describe("Chiến pháp thay thế ghi trong nguồn cho ô này."),
  })
  .strict();

const summaryHeroSchema = z
  .object({
    holder: count("Vị trí tướng trong đội, bắt đầu 0."),
    heroId: idText("ID tướng nếu khớp được."),
    nameVi: z.string().max(256).describe("Tên tướng tiếng Việt."),
    tactics: z
      .array(
        z
          .object({
            slot: count("Chỉ số ô chiến pháp."),
            vi: text2k("Tên chiến pháp tiếng Việt."),
            tacticId: idText("ID chiến pháp nếu khớp được."),
          })
          .strict(),
      )
      .max(4)
      .describe("Các ô chiến pháp của tướng."),
  })
  .strict();

const teamHeaderShape = {
  reference: referenceSelectorSchema.describe("Selector để gọi tqccl_get_team."),
  ref: z.string().max(300).describe("Nhãn ổn định <collection>:<id>."),
  name: z.string().max(256).describe("Tên hiển thị theo locale."),
  nameVi: z.string().max(256).describe("Tên tiếng Việt."),
  nameZh: text2k("Tên tiếng Hán nếu có."),
  nickname: text2k("Biệt danh nếu có."),
  sourceSeasonId: text2k("Mùa nguồn của bản ghi (chỉ recommended)."),
  sourceSeasonCode: text2k("Mã mùa nguồn hiển thị."),
  sourceCategoryId: text2k("Nhóm nguồn của bản ghi (chỉ recommended)."),
  tierRaw: text2k("Bậc nguyên bản của nguồn."),
  tierOrder: z.number().nullable().optional().describe("Thứ tự bậc để sắp xếp."),
  factionRaw: text2k("Phe nguyên bản của nguồn."),
  unitTypes: z.array(z.string().max(64)).max(10).describe("Binh chủng của đội."),
  translationStatus: text2k("Trạng thái bản dịch của tên đội."),
  pagePath: z.string().max(512).optional().describe("Trang đội trên website theo locale; engine không có."),
  configId: seasonId.optional().describe("engine + seasonContext: configId của mục này."),
};

const teamItemSchema = z
  .object({
    ...teamHeaderShape,
    score: z.number().nullable().optional().describe("Điểm nguyên bản của nguồn, không phải điểm theo luật."),
    heroes: z.array(summaryHeroSchema).max(10).describe("Tướng và chiến pháp của đội."),
    heroHit: count("Chỉ khi có heroes: số tướng trùng.").optional(),
    tacticHit: count("Chỉ khi có heroes: số chiến pháp trùng đúng holder.").optional(),
    total: count("Chỉ khi có heroes: số tướng nhận diện được.").optional(),
  })
  .strict();

export const findTeamsOutputSchema = commonResultSchema.extend({
  locale: z.enum(["vi", "zh"]).describe("Locale đã dùng cho tên và pagePath."),
  collection: z.enum(TEAM_COLLECTION_IDS).describe("Họ đội đã duyệt."),
  total: z.number().int().nonnegative().describe("Tổng số đội khớp bộ lọc."),
  items: z.array(teamItemSchema).max(50).describe("Đội của trang hiện tại."),
});

type TeamItem = z.infer<typeof teamItemSchema>;
type Locale = "vi" | "zh";

const OFFSET_FOR = (cursor: number | undefined) => cursor ?? 0;

function scopeInvalid(...fields: string[]): ResearchHandlerError {
  return new ResearchHandlerError("REFERENCE_SCOPE_INVALID", PUBLIC_ERRORS.REFERENCE_SCOPE_INVALID.message, false, fields);
}

function fail(code: ResearchErrorCode, fields: readonly string[] = []): ResearchHandlerError {
  return new ResearchHandlerError(code, PUBLIC_ERRORS[code].message, false, fields);
}

function ensureSeasonContext(ctx: ToolContext, seasonContext: SeasonContext | undefined): void {
  if (seasonContext === undefined) return;
  const model = ctx.snapshot.seasonModel;
  if (!model || !resolveSeasonContext(model, seasonContext).ok) throw fail("SEASON_CONTEXT_INVALID");
}

function localized(paths: LocalePaths | undefined, loc: Locale): string | undefined {
  return paths?.[loc];
}

function summaryItem(view: TeamSummaryView, loc: Locale, reference: ReferenceSelector): TeamItem {
  return {
    reference,
    ref: view.ref,
    name: loc === "zh" ? (view.nameZh ?? view.nameVi) : view.nameVi,
    nameVi: view.nameVi,
    nameZh: view.nameZh,
    nickname: view.nickname,
    sourceSeasonId: view.sourceSeasonId,
    sourceSeasonCode: view.sourceSeasonCode,
    sourceCategoryId: view.sourceCategoryId,
    tierRaw: view.tierRaw,
    tierOrder: view.tierOrder,
    score: view.score,
    factionRaw: view.factionRaw,
    unitTypes: [...view.unitTypes],
    translationStatus: view.translationStatus,
    pagePath: view.pagePath[loc],
    heroes: view.heroes.map(compactHero),
  };
}

function compactHero(hero: TeamHeroSummary) {
  return {
    holder: hero.holder,
    heroId: hero.heroId,
    nameVi: hero.nameVi,
    tactics: hero.tactics.map((tactic) => ({ slot: tactic.slot, vi: tactic.vi, tacticId: tactic.tacticId })),
  };
}

function viewReference(view: TeamSummaryView, variantId?: string): ReferenceSelector {
  if (view.collection === "recommended") return { collection: "recommended", sourceConfigId: view.id };
  if (view.collection === "other") return { collection: "other", legacyTeamId: view.id, legacyVariantId: variantId ?? "" };
  return { collection: "khaihoang", khaiHoangTeamId: view.id };
}

function publicTeamsFor(pub: PublicationReadModel, filter: Parameters<PublicationReadModel["findTeams"]>[0] & object): TeamSummaryView[] {
  const all: TeamSummaryView[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = pub.findTeams({ ...filter, limit: 100, offset });
    all.push(...page.items);
    if (all.length >= page.total || page.items.length === 0) return all;
  }
}

/** Mỗi biến thể `other` đã nhận là một mục có selector riêng. */
function expandedItems(pub: PublicationReadModel, views: readonly TeamSummaryView[], loc: Locale): TeamItem[] {
  const items: TeamItem[] = [];
  for (const view of views) {
    if (view.collection !== "other") {
      items.push(summaryItem(view, loc, viewReference(view)));
      continue;
    }
    const detail = pub.getTeam(view.ref) as { variants?: ArtifactRecord[] } | undefined;
    for (const variant of detail?.variants ?? []) {
      if (typeof variant.variantId !== "string") continue;
      const item = summaryItem(view, loc, viewReference(view, publicVariantId(variant.variantId)));
      const holders = Array.isArray(variant.holders) ? (variant.holders as ArtifactRecord[]) : [];
      const resolved = Array.isArray((variant.resolved as ArtifactRecord | undefined)?.heroes) ? (((variant.resolved as ArtifactRecord).heroes as ArtifactRecord[])) : [];
      // Mỗi biến thể dùng chính tướng/tên/bậc của nó, không mượn biến thể đầu.
      items.push({
        ...item,
        ...(typeof variant.name === "string" ? { name: variant.name, nameVi: variant.name } : {}),
        nickname: typeof variant.nickname === "string" ? variant.nickname : null,
        tierRaw: typeof variant.historicalTier === "string" ? variant.historicalTier : null,
        factionRaw: typeof variant.faction === "string" ? variant.faction : null,
        unitTypes: Array.isArray(variant.unit) ? variant.unit.filter((entry): entry is string => typeof entry === "string") : [],
        heroes: resolved.map((hero, index) => {
          const holder = holders[index] ?? {};
          return {
            holder: typeof hero.holder === "number" ? hero.holder : index,
            heroId: typeof hero.heroId === "string" ? hero.heroId : null,
            nameVi: String(holder.displayNameVi ?? holder.nameRaw ?? ""),
            tactics: ((Array.isArray(hero.tactics) ? hero.tactics : []) as ArtifactRecord[]).map((tactic) => ({
              slot: tactic.slot as number,
              vi: typeof tactic.vi === "string" ? tactic.vi : null,
              tacticId: typeof tactic.tacticId === "string" ? tactic.tacticId : null,
            })),
          };
        }),
      });
    }
  }
  return items;
}

interface HeroQuery {
  canonicalId: string;
  tacticIds: string[];
}

/** Khớp theo holder: tactic chỉ tính khi nằm trên đúng tướng đó. */
function matchPublicItems(items: TeamItem[], heroes: readonly HeroQuery[], minHeroes: number): TeamItem[] {
  const wanted = new Map(heroes.map((hero) => [hero.canonicalId, new Set(hero.tacticIds)]));
  const ranked: Array<{ item: TeamItem; order: number }> = [];
  items.forEach((item, order) => {
    let heroHit = 0;
    let tacticHit = 0;
    for (const hero of item.heroes) {
      const tactics = hero.heroId ? wanted.get(hero.heroId) : undefined;
      if (tactics === undefined) continue;
      heroHit += 1;
      for (const slot of hero.tactics) if (slot.tacticId && tactics.has(slot.tacticId)) tacticHit += 1;
    }
    if (heroHit >= minHeroes) ranked.push({ item: { ...item, heroHit, tacticHit, total: wanted.size }, order });
  });
  ranked.sort((a, b) => b.item.heroHit! - a.item.heroHit! || b.item.tacticHit! - a.item.tacticHit! || a.order - b.order);
  return ranked.map((entry) => entry.item);
}

interface EngineNameResolver {
  hero: (name: string) => string | null;
  tactic: (name: string) => string | null;
}

/** Một lần cho mỗi SnapshotIndex (bất biến), không dựng lại cho từng đội. */
const engineNameResolvers = new WeakMap<object, EngineNameResolver>();

function engineHeroNames(ctx: ToolContext): EngineNameResolver {
  const cached = engineNameResolvers.get(ctx.index);
  if (cached) return cached;
  const names = new Map<string, { hero?: string; tactic?: string }>();
  for (const entry of ctx.index.searchEntries) {
    if (entry.kind !== "hero" && entry.kind !== "tactic") continue;
    const key = normalizeText(entry.displayName);
    const slot = names.get(key) ?? {};
    slot[entry.kind] ??= entry.canonicalId;
    names.set(key, slot);
  }
  const resolver: EngineNameResolver = {
    hero: (name) => names.get(normalizeText(name))?.hero ?? null,
    tactic: (name) => names.get(normalizeText(name))?.tactic ?? null,
  };
  engineNameResolvers.set(ctx.index, resolver);
  return resolver;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function engineItem(ctx: ToolContext, team: ArtifactRecord, configId?: string): TeamItem {
  const resolve = engineHeroNames(ctx);
  const id = text(team.id);
  const heroes = (Array.isArray(team.heroes) ? team.heroes : []) as ArtifactRecord[];
  return {
    reference: { collection: "engine", teamId: id, ...(configId === undefined ? {} : { configId }) },
    ref: configId === undefined ? `engine:${id}` : `engine:${id}#${configId}`,
    name: text(team.name),
    nameVi: text(team.name),
    nameZh: null,
    nickname: typeof team.nickname === "string" ? team.nickname : null,
    sourceSeasonId: null,
    sourceCategoryId: null,
    tierRaw: null,
    score: null,
    factionRaw: typeof team.faction === "string" ? team.faction : null,
    unitTypes: stringList(team.unitType),
    ...(configId === undefined ? {} : { configId }),
    heroes: heroes.map((hero, holder) => ({
      holder,
      heroId: resolve.hero(text(hero.name)),
      nameVi: text(hero.name),
      tactics: ((Array.isArray(hero.tactics) ? hero.tactics : []) as ArtifactRecord[]).map((tactic, slot) => ({
        slot,
        vi: text(tactic.name),
        tacticId: resolve.tactic(text(tactic.name)),
      })),
    })),
  };
}

function engineTeams(ctx: ToolContext, seasonContext: SeasonContext | undefined, query: string): Array<{ team: ArtifactRecord; configId?: string }> {
  const needle = normalizeText(query);
  const matches = (team: ArtifactRecord, configId?: string) =>
    needle === "" || `${teamSearchBlob(team)} ${normalizeText(text(team.id))} ${normalizeText(configId ?? "")}`.includes(needle);
  if (seasonContext) {
    return seasonDomain
      .browse(ctx.snapshot.seasonModel!, seasonContext)
      .applicable.filter((entry: BrowseEntry) => matches(entry.team, entry.configId))
      .map((entry: BrowseEntry) => ({ team: entry.team, configId: entry.configId }));
  }
  return ctx.snapshot.artifacts.teams.filter((team) => matches(team)).map((team) => ({ team }));
}

function rankEngine(
  ctx: ToolContext,
  seasonContext: SeasonContext | undefined,
  candidates: Array<{ team: ArtifactRecord; configId?: string }>,
  heroes: readonly HeroQuery[],
  minHeroes: number,
): Array<{ team: ArtifactRecord; configId?: string; heroHit: number; tacticHit: number; total: number }> {
  const pool = seasonContext
    ? (seasonDomain.candidates(ctx.snapshot.seasonModel!, seasonContext, {}) as { ok: boolean; code?: string; teams?: ArtifactRecord[]; limits?: { maxCandidates: 500; candidateCount: number } })
    : null;
  if (pool && !pool.ok) {
    throw new ResearchHandlerError(
      (pool.code ?? "INTERNAL_ERROR") as ResearchErrorCode,
      PUBLIC_ERRORS[(pool.code ?? "INTERNAL_ERROR") as ResearchErrorCode].message,
      false,
      [],
      undefined,
      pool.limits,
    );
  }
  const allowed = new Set(candidates.map((entry) => `${text(entry.team.id)}|${entry.configId ?? ""}`));
  const source = pool ? pool.teams! : candidates.map((entry) => entry.team);
  const mapped = heroes.map((hero) => ({
    hero: { matched: true, canonicalId: hero.canonicalId, reviewRequired: false },
    tactics: hero.tacticIds.map((canonicalId) => ({ matched: true, canonicalId, reviewRequired: false })),
  }));
  const found = legacyDomainAdapter.findSimilarTeams(mapped, source, { minHeroes, limit: 500 });
  return found
    .map((match) => {
      const team = match.team as ArtifactRecord;
      const configId = typeof team.configId === "string" ? team.configId : undefined;
      return { team, ...(configId === undefined ? {} : { configId }), heroHit: match.heroHit as number, tacticHit: match.tacticHit as number, total: match.total as number };
    })
    .filter((entry) => allowed.has(`${text(entry.team.id)}|${entry.configId ?? ""}`));
}

export async function handleFindTeams(ctx: ToolContext, rawInput: unknown) {
  const input = parseToolInput(findTeamsInputSchema, rawInput);
  const loc: Locale = input.locale ?? "vi";
  const limit = input.limit ?? 20;
  const collection = input.collection;
  const seasonContext = input.seasonContext as SeasonContext | undefined;
  const query = input.query?.trim() ?? "";
  const heroes = (input.heroes ?? []) as HeroQuery[];
  const minHeroes = input.minHeroes ?? 2;

  if (input.cursor === undefined) ctx.ensureExpectedWorkflow(input.expectedWorkflowVersion);
  else ctx.requireExpectedWorkflow(input.expectedWorkflowVersion);

  if (collection !== "engine" && seasonContext !== undefined) throw scopeInvalid("seasonContext");
  if (collection !== "recommended" && (input.sourceSeasonId !== undefined || input.sourceCategoryId !== undefined)) {
    throw scopeInvalid(...(input.sourceSeasonId === undefined ? [] : ["sourceSeasonId"]), ...(input.sourceCategoryId === undefined ? [] : ["sourceCategoryId"]));
  }
  if (collection === "engine") ensureSeasonContext(ctx, seasonContext);

  let all: TeamItem[];
  if (collection === "engine") {
    const candidates = engineTeams(ctx, seasonContext, query);
    all =
      heroes.length === 0
        ? candidates.map((entry) => engineItem(ctx, entry.team, entry.configId))
        : rankEngine(ctx, seasonContext, candidates, heroes, minHeroes).map((entry) => ({
            ...engineItem(ctx, entry.team, entry.configId),
            heroHit: entry.heroHit,
            tacticHit: entry.tacticHit,
            total: entry.total,
          }));
  } else {
    const pub = ctx.publication();
    if (input.sourceSeasonId !== undefined && !pub.seasons.seasonOptions.some((option) => option.sourceSeasonId === input.sourceSeasonId)) throw scopeInvalid("sourceSeasonId");
    if (input.sourceCategoryId !== undefined && !pub.seasons.categories.some((category) => category.sourceCategoryId === input.sourceCategoryId)) throw scopeInvalid("sourceCategoryId");
    const views = publicTeamsFor(pub, {
      collection: collection as TeamCollection,
      ...(input.sourceSeasonId === undefined ? {} : { sourceSeasonId: input.sourceSeasonId }),
      ...(input.sourceCategoryId === undefined ? {} : { sourceCategoryId: input.sourceCategoryId }),
      ...(query === "" ? {} : { query }),
    });
    const items = expandedItems(pub, views, loc);
    all = heroes.length === 0 ? items : matchPublicItems(items, heroes, minHeroes);
  }

  const binding: CursorBinding = {
    tool: "tqccl_find_teams",
    locale: loc,
    workflowVersion: ctx.workflowVersion,
    filter: {
      collection,
      sourceSeasonId: input.sourceSeasonId ?? null,
      sourceCategoryId: input.sourceCategoryId ?? null,
      query: normalizeText(query),
      heroes: [...heroes].map((hero) => ({ canonicalId: hero.canonicalId, tacticIds: [...hero.tacticIds].sort() })).sort((a, b) => a.canonicalId.localeCompare(b.canonicalId)),
      minHeroes: heroes.length === 0 ? null : minHeroes,
      seasonContext: seasonContext ?? null,
    },
  };
  const offset = OFFSET_FOR(input.cursor === undefined ? undefined : await decodeCursor(input.cursor, binding));
  const base = { ...ctx.commonResult(provenanceFor(collection)), locale: loc, collection, total: all.length };
  const { page, nextOffset } = fitPage(all, offset, limit, (items) => ({ ...base, items }));
  return {
    ...base,
    items: page,
    truncated: nextOffset !== null,
    ...(nextOffset === null ? {} : { nextCursor: await encodeCursor(binding, nextOffset) }),
  };
}

function provenanceFor(collection: TeamCollectionId) {
  return collection === "engine"
    ? [{ artifact: "teams", trust: "untrusted" as const }]
    : [
        { artifact: "reference-team-index", trust: "untrusted" as const },
        { artifact: "public-routes" },
      ];
}

// -------------------------------------------------------------------------------------------
// get_team
// -------------------------------------------------------------------------------------------

export const TEAM_SECTIONS = ["overview", "notes", "variants", "guide"] as const;

export const getTeamInputSchema = z
  .object({
    reference: referenceInputSchema.describe("Selector từ tqccl_find_teams; collection quyết định field bắt buộc."),
    section: z.enum(TEAM_SECTIONS).optional().describe("overview (mặc định) | notes | variants | guide; notes/variants có phân trang."),
    limit: decimalNumberish(z.number().int().min(1).max(50).optional()).describe("Số mục mỗi trang cho notes/variants, mặc định 20."),
    cursor: cursorText,
    locale,
    seasonContext: seasonContextSchema.optional().describe("Chỉ engine: cần để đọc cấu hình theo mùa."),
    expectedWorkflowVersion: workflowVersion.optional(),
  })
  .strict();

const slotHeroSchema = z
  .object({
    holder: count("Vị trí tướng trong đội, bắt đầu 0."),
    heroId: idText("ID tướng nếu khớp được."),
    heroRefs: z.array(z.string().max(256)).max(50).optional().describe("Tham chiếu tướng của cấu hình mùa."),
    nameVi: text2k("Tên tướng tiếng Việt."),
    nameRaw: text2k("Tên tướng nguyên bản của nguồn."),
    role: text2k("Vai trò nguyên bản (chủ tướng/phó tướng)."),
    pagePath: z.string().max(512).optional().describe("Trang tra cứu tướng theo locale."),
    statFocus: text2k("Chỉ số ưu tiên theo nguồn."),
    note: text2k("Ghi chú ngắn của nguồn cho tướng."),
    tactics: z.array(slotTacticSchema).max(10).describe("Mọi ô chiến pháp của tướng."),
    books: z
      .array(
        z
          .object({
            slot: count("Chỉ số ô binh thư."),
            vi: text2k("Tên binh thư tiếng Việt."),
            raw: text2k("Tên binh thư nguyên bản."),
            bookId: idText("ID binh thư nếu khớp được."),
            alternatives: z
              .array(z.object({ vi: text2k("Tên binh thư thay thế."), bookId: idText("ID binh thư thay thế.") }).strict())
              .max(20)
              .optional()
              .describe("Binh thư thay thế ghi trong nguồn."),
          })
          .strict(),
      )
      .max(10)
      .describe("Mọi ô binh thư của tướng."),
    alternatives: z
      .array(z.object({ vi: text2k("Tên tướng thay thế."), heroId: idText("ID tướng thay thế.") }).strict())
      .max(20)
      .optional()
      .describe("Tướng thay thế ghi trong nguồn."),
  })
  .strict();

const notesBlockSchema = z
  .object({
    id: z.string().max(128).describe("ID khối ghi chú."),
    owner: z.string().max(64).optional().describe("Chủ khối: team, hero:<n> hoặc counter:<loại>."),
    textVi: text2k("Nội dung tiếng Việt."),
    textRaw: text2k("Nội dung nguyên bản của nguồn."),
  })
  .strict();

/**
 * Một hình dạng điểm nguồn cho mọi họ đội: `value` là điểm nguyên bản của nguồn, không phải điểm
 * theo luật. `unmodified-original` (recommended) và `reviewed-ruleset-selection` (engine +
 * seasonContext, lựa chọn đã review) là hai phạm vi duy nhất; đội đã thay ô luôn là null.
 */
export const sourceScoreSchema = z
  .object({
    value: z.number().nonnegative().describe("Điểm nguyên bản của nguồn."),
    scope: z.enum(["unmodified-original", "reviewed-ruleset-selection"]).describe("Phạm vi điểm."),
    tierRaw: z.string().max(64).nullable().describe("Bậc nguyên bản; null nếu nguồn không có."),
    tierOrder: z.number().nullable().describe("Thứ tự bậc; null nếu không có."),
    sourceConfigId: z.string().max(256).nullable().describe("sourceConfigId của điểm; null nếu không có."),
  })
  .strict();

const contextSchema = z
  .object({
    source: text2k("Nguồn."),
    sourceState: text2k("Trạng thái nguồn."),
    historicalTier: text2k("Bậc lịch sử."),
    classification: text2k("Phân loại."),
    period: text2k("Giai đoạn."),
    region: text2k("Khu vực."),
    season: text2k("Mùa."),
    commanderBefore: text2k("Chủ tướng trước."),
    commanderAfter: text2k("Chủ tướng sau."),
  })
  .strict();

const tierRankingSchema = z
  .object({
    id: z.string().max(256).optional().describe("ID xếp hạng."),
    tier: z.string().max(64).optional().describe("Bậc."),
    updatedAt: z.string().max(64).optional().describe("Ngày cập nhật."),
  })
  .strict();

const configSchema = z
  .object({
    id: seasonId.describe("configId."),
    teamId: z.string().max(256).describe("teamId."),
    scenarioId: z.string().max(256).describe("scenarioId."),
    rulesetId: z.string().max(256).nullable().describe("rulesetId."),
    reviewStatus: z.string().max(64).nullable().describe("Trạng thái review."),
    unitTypes: z.array(z.string().max(64)).max(10).describe("Binh chủng."),
    requirementIds: z.array(z.string().max(256)).max(100).describe("Yêu cầu của cấu hình."),
    effectBundleIds: z.array(z.string().max(256)).max(100).describe("Gói hiệu ứng của cấu hình."),
  })
  .strict();

const guideRowSchema = z.object({ hero: z.string().max(256).optional(), unitType: z.string().max(64).optional() }).strict();
const guideSchema = z
  .object({
    overview: z.string().max(8_192).optional(),
    ratings: z
      .object({
        overall: z.number().optional(),
        land4: z.number().optional(),
        land5: z.number().optional(),
        land6: z.number().optional(),
        land7to8: z.number().optional(),
        transition: z.number().optional(),
      })
      .strict()
      .optional(),
    redRequirements: z
      .array(z.object({ hero: z.string().max(256).optional(), minimum: z.number().optional(), recommended: z.number().optional(), note: z.string().max(2_048).optional() }).strict())
      .max(20)
      .optional(),
    defenders: z
      .object({ land4: z.array(guideRowSchema).max(30).optional(), land5: z.array(guideRowSchema).max(30).optional(), warning: z.string().max(2_048).optional() })
      .strict()
      .optional(),
    splitTeams: z
      .object({
        teams: z
          .array(
            z
              .object({
                target: z.string().max(512).optional(),
                note: z.string().max(2_048).optional(),
                heroes: z.array(z.object({ name: z.string().max(256).optional(), tactics: z.array(z.string().max(256)).max(10).optional() }).strict()).max(10).optional(),
              })
              .strict(),
          )
          .max(20)
          .optional(),
        note: z.string().max(2_048).optional(),
      })
      .strict()
      .optional(),
    transitions: z
      .array(
        z
          .object({
            target: z.string().max(512).optional(),
            note: z.string().max(2_048).optional(),
            steps: z
              .array(
                z
                  .object({
                    mainCityLevel: z.number().optional(),
                    commandCost: z.number().optional(),
                    timing: z.string().max(512).optional(),
                    note: z.string().max(2_048).optional(),
                    trainHeroes: z.array(z.string().max(256)).max(10).optional(),
                  })
                  .strict(),
              )
              .max(30)
              .optional(),
          })
          .strict(),
      )
      .max(30)
      .optional(),
  })
  .strict();

const variantSchema = z
  .object({
    id: text2k("ID biến thể."),
    label: text2k("Nhãn biến thể."),
    period: text2k("Giai đoạn."),
    region: text2k("Khu vực."),
    commanderBefore: text2k("Chủ tướng trước."),
    commanderAfter: text2k("Chủ tướng sau."),
    buildNote: text2k("Ghi chú build."),
    note: text2k("Ghi chú."),
    heroes: z.array(slotHeroSchema).max(10).describe("Ô tướng của biến thể."),
  })
  .strict();

const teamDetailSchema = z
  .object({
    ...teamHeaderShape,
    sourceSeasonNameVi: text2k("Tên mùa nguồn tiếng Việt."),
    alternativeHoldersRaw: z.array(z.string().max(512)).max(20).optional().describe("Người giữ thay thế ghi trong nguồn."),
    context: contextSchema.optional().describe("Bối cảnh nguồn."),
    sourceScore: sourceScoreSchema.nullable().optional().describe("Điểm nguồn; null nếu đã thay ô."),
    tierRankings: z.array(tierRankingSchema).max(20).optional().describe("Xếp hạng bậc ghi trong nguồn."),
    config: configSchema.optional().describe("Cấu hình mùa (engine + seasonContext)."),
    heroes: z.array(slotHeroSchema).max(10).describe("Tất cả ô tướng/chiến pháp/binh thư; không bao giờ bị lược."),
  })
  .strict();

export const getTeamOutputSchema = commonResultSchema.extend({
  locale: z.enum(["vi", "zh"]).describe("Locale đã dùng cho tên và pagePath."),
  section: z.enum(TEAM_SECTIONS).describe("Section đã trả về."),
  seasonContext: seasonContextSchema.optional(),
  team: teamDetailSchema.optional().describe("Có khi section=overview."),
  sections: z
    .array(z.object({ name: z.enum(TEAM_SECTIONS).describe("Tên section."), total: count("Số mục của section.") }).strict())
    .max(4)
    .optional()
    .describe("Các section có dữ liệu; có khi section=overview."),
  total: z.number().int().nonnegative().optional().describe("Tổng mục của section phân trang."),
  notes: z.array(notesBlockSchema).max(50).optional().describe("Khối ghi chú của trang hiện tại (section=notes)."),
  variants: z.array(variantSchema).max(50).optional().describe("Biến thể của trang hiện tại (section=variants)."),
  guide: guideSchema.optional().describe("Hướng dẫn nguồn (section=guide)."),
  build: z
    .object({
      ref: z.string().max(300).describe("Nhãn <collection>:<id> của đội."),
      name: z.string().max(256).describe("Tên đội theo locale."),
      // Cùng kiểu slotHeroSchema của team.heroes; khai báo record để tools/list không chép schema đó lần hai (ngân sách 90 KiB).
      heroes: z.array(z.record(z.string(), z.unknown())).max(10).describe("Ô tướng/chiến pháp/binh thư của đội, cùng dạng team.heroes ở overview."),
    })
    .strict()
    .optional()
    .describe("Có khi section khác overview: build của chính đội này, để không lấy nhầm build đội khác."),
});

interface TeamParts {
  team: z.infer<typeof teamDetailSchema>;
  notes: z.infer<typeof notesBlockSchema>[];
  variants: Array<z.infer<typeof variantSchema>>;
  guide?: z.infer<typeof guideSchema>;
  provenance: Array<{ artifact: string; recordId?: string; trust?: "untrusted" }>;
  seasonContext?: SeasonContext;
}

function asRecord(value: unknown): ArtifactRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as ArtifactRecord) : {};
}

function asRecords(value: unknown): ArtifactRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function projectConfig(config: ArtifactRecord): z.infer<typeof configSchema> {
  const ids = (value: unknown) => asRecords(value).flatMap((entry) => (typeof entry.id === "string" ? [entry.id] : []));
  return {
    id: text(config.id),
    teamId: text(config.teamId),
    scenarioId: text(config.scenarioId),
    rulesetId: nullableString(config.rulesetId),
    reviewStatus: nullableString(config.reviewStatus),
    unitTypes: stringList(config.unitTypes),
    requirementIds: ids(config.requirements),
    effectBundleIds: ids(config.effectBundles),
  };
}

/** Điểm engine chỉ đi ra qua hình dạng `sourceScoreSchema`; selection/fingerprint không rời Worker. */
function projectEngineScore(raw: unknown): z.infer<typeof sourceScoreSchema> | null {
  const score = asRecord(raw);
  if (typeof score.value !== "number" || !Number.isFinite(score.value)) return null;
  return { value: score.value, scope: "reviewed-ruleset-selection", tierRaw: null, tierOrder: null, sourceConfigId: nullableString(score.sourceConfigId) };
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function notesFromRecord(prefix: string, owner: string, entries: Record<string, unknown>): z.infer<typeof notesBlockSchema>[] {
  return Object.entries(entries).flatMap(([key, value]) => {
    const textVi = nullableString(value);
    return textVi === null ? [] : [{ id: `${prefix}${key}`, owner, textVi, textRaw: null }];
  });
}

function tacticPath(pub: PublicationReadModel | undefined, id: unknown, loc: Locale): string | undefined {
  return typeof id === "string" ? localized(pub?.routes.get(id), loc) : undefined;
}

function buildRecommended(pub: PublicationReadModel, selector: ReferenceSelector, loc: Locale): TeamParts {
  const ref = `recommended:${selector.sourceConfigId}`;
  const detail = pub.getTeam(ref);
  const summary = pub.teams.find((team) => team.ref === ref);
  if (!detail || !summary) throw fail("REFERENCE_NOT_FOUND");
  const record = asRecord(detail.record);
  const resolved = asRecords(asRecord(detail.resolved).heroes);
  const heroes = asRecords(record.heroes).map((hero, holder) => {
    const slot = resolved.find((entry) => entry.holder === holder) ?? {};
    const resolvedTactics = asRecords(slot.tactics);
    const resolvedBooks = asRecords(slot.books);
    const raw = stringList(hero.tacticSlotsRaw);
    const vi = Array.isArray(hero.tacticSlotsVi) ? (hero.tacticSlotsVi as unknown[]) : [];
    const bookRaw = stringList(hero.bookSlotsRaw);
    const bookVi = Array.isArray(hero.bookSlotsVi) ? (hero.bookSlotsVi as unknown[]) : [];
    return {
      holder,
      heroId: typeof slot.heroId === "string" ? slot.heroId : null,
      nameVi: nullableString(hero.displayNameVi),
      nameRaw: nullableString(hero.nameRaw),
      role: nullableString(hero.roleRaw),
      ...(typeof slot.heroId === "string" && localized(pub.routes.get(slot.heroId), loc) ? { pagePath: localized(pub.routes.get(slot.heroId), loc)! } : {}),
      statFocus: nullableString(hero.statFocusVi) ?? nullableString(hero.statFocusRaw),
      note: nullableString(hero.notesRaw),
      tactics: raw.map((rawName, index) => {
        const match = resolvedTactics.find((entry) => entry.slot === index);
        const path = tacticPath(pub, match?.tacticId, loc);
        return {
          slot: index,
          vi: nullableString(vi[index]),
          raw: nullableString(rawName),
          tacticId: typeof match?.tacticId === "string" ? match.tacticId : null,
          ...(path === undefined ? {} : { pagePath: path }),
        };
      }),
      books: bookRaw.map((rawName, index) => {
        const match = resolvedBooks.find((entry) => entry.slot === index);
        return { slot: index, vi: nullableString(bookVi[index]), raw: nullableString(rawName), bookId: typeof match?.bookId === "string" ? match.bookId : null };
      }),
    };
  });
  const blocks = asRecords(asRecord(record.displayNotes).blocks).map((block) => ({
    id: text(block.id),
    owner: text(block.owner) || undefined,
    textVi: nullableString(block.textVi),
    textRaw: nullableString(block.textRaw),
  }));
  const notes =
    blocks.length > 0
      ? blocks.map((block) => ({ id: block.id, ...(block.owner === undefined ? {} : { owner: block.owner }), textVi: block.textVi, textRaw: block.textRaw }))
      : nullableString(record.notesRaw) === null
        ? []
        : [{ id: "notes", owner: "team", textVi: null, textRaw: nullableString(record.notesRaw) }];
  const value = typeof record.value === "number" ? record.value : null;
  return {
    team: {
      ...itemHeader(summary, loc, selector),
      sourceSeasonNameVi: nullableString(record.sourceSeasonNameVi),
      alternativeHoldersRaw: stringList(record.alternativeHoldersRaw),
      // Cấu hình gốc chưa đổi ô: điểm nguồn đi cùng đúng cấu hình này.
      sourceScore: value === null ? null : { value, tierRaw: summary.tierRaw, tierOrder: summary.tierOrder, sourceConfigId: selector.sourceConfigId ?? null, scope: "unmodified-original" },
      heroes,
    },
    notes,
    variants: [],
    provenance: [{ artifact: "reference-team-details", recordId: ref, trust: "untrusted" }, { artifact: "public-routes" }],
  };
}

function itemHeader(summary: TeamSummaryView, loc: Locale, selector: ReferenceSelector) {
  const { heroes: _heroes, heroHit: _a, tacticHit: _b, total: _c, score: _score, ...header } = summaryItem(summary, loc, selector);
  return header;
}

function buildOther(pub: PublicationReadModel, selector: ReferenceSelector, loc: Locale): TeamParts {
  const ref = `other:${selector.legacyTeamId}`;
  const detail = pub.getTeam(ref) as { variants?: ArtifactRecord[] } | undefined;
  const summary = pub.teams.find((team) => team.ref === ref);
  const variant = detail?.variants?.find((entry) => typeof entry.variantId === "string" && (entry.variantId === selector.legacyVariantId || publicVariantId(entry.variantId) === selector.legacyVariantId));
  if (!detail || !summary || !variant) throw fail("REFERENCE_NOT_FOUND");
  const holders = asRecords(variant.holders);
  const resolvedHeroes = asRecords(asRecord(variant.resolved).heroes);
  const heroes = resolvedHeroes.map((hero, index) => {
    const holder = holders[index] ?? {};
    const holderIndex = typeof hero.holder === "number" ? hero.holder : index;
    const heroId = typeof hero.heroId === "string" ? hero.heroId : null;
    const heroPath = heroId === null ? undefined : localized(pub.routes.get(heroId), loc);
    return {
      holder: holderIndex,
      heroId,
      nameVi: nullableString(holder.displayNameVi),
      nameRaw: nullableString(holder.nameRaw),
      ...(heroPath === undefined ? {} : { pagePath: heroPath }),
      statFocus: nullableString(holder.statFocusRaw),
      note: nullableString(holder.notesRaw),
      tactics: asRecords(hero.tactics).map((tactic) => ({
        slot: tactic.slot as number,
        vi: nullableString(tactic.vi),
        tacticId: typeof tactic.tacticId === "string" ? tactic.tacticId : null,
        ...(tacticPath(pub, tactic.tacticId, loc) === undefined ? {} : { pagePath: tacticPath(pub, tactic.tacticId, loc)! }),
        alternatives: asRecords(tactic.alternatives).map((alt) => ({
          vi: nullableString(alt.vi),
          tacticId: typeof alt.tacticId === "string" ? alt.tacticId : null,
          ...(tacticPath(pub, alt.tacticId, loc) === undefined ? {} : { pagePath: tacticPath(pub, alt.tacticId, loc)! }),
        })),
      })),
      books: asRecords(hero.books).map((book) => ({
        slot: book.slot as number,
        vi: nullableString(book.vi),
        raw: null,
        bookId: typeof book.bookId === "string" ? book.bookId : null,
        alternatives: asRecords(book.alternatives).map((alt) => ({ vi: nullableString(alt.vi), bookId: typeof alt.bookId === "string" ? alt.bookId : null })),
      })),
      alternatives: asRecords(hero.alternatives).map((alt) => ({ vi: nullableString(alt.vi), heroId: typeof alt.heroId === "string" ? alt.heroId : null })),
    };
  });
  const content = asRecord(variant.content);
  const counters = asRecord(content.counters);
  const notes: z.infer<typeof notesBlockSchema>[] = [];
  const contentNotes = content.notes;
  for (const entry of Array.isArray(contentNotes) ? contentNotes : [contentNotes]) {
    const note = nullableString(entry);
    if (note !== null) notes.push({ id: `note-${notes.length}`, owner: "team", textVi: note, textRaw: null });
  }
  for (const kind of ["good", "avoid"] as const) {
    for (const [index, entry] of (Array.isArray(counters[kind]) ? (counters[kind] as unknown[]) : []).entries()) {
      const label = nullableString(entry) ?? nullableString(asRecord(entry).name);
      if (label !== null) notes.push({ id: `counter-${kind}-${index}`, owner: `counter:${kind}`, textVi: label, textRaw: null });
    }
  }
  const context: Record<string, string | null> = {
    source: nullableString(variant.sourceLabel) ?? nullableString(variant.source),
    sourceState: nullableString(variant.sourceState),
    historicalTier: nullableString(variant.historicalTier),
    classification: nullableString(variant.classification),
  };
  return {
    team: {
      ...itemHeader(summary, loc, { ...selector, legacyVariantId: publicVariantId(String(variant.variantId)) }),
      nickname: nullableString(variant.nickname),
      context,
      tierRankings: asRecords(variant.historicalRankings).slice(0, 20).map(allowTierRanking),
      heroes,
    },
    notes,
    variants: [],
    provenance: [{ artifact: "reference-team-details", recordId: ref, trust: "untrusted" }, { artifact: "public-routes" }],
  };
}

function buildKhaiHoang(pub: PublicationReadModel, selector: ReferenceSelector, loc: Locale): TeamParts {
  const ref = `khaihoang:${selector.khaiHoangTeamId}`;
  const detail = pub.getTeam(ref);
  const summary = pub.teams.find((team) => team.ref === ref);
  if (!detail || !summary) throw fail("REFERENCE_NOT_FOUND");
  const team = asRecord(detail.team);
  const resolved = asRecords(asRecord(detail.resolved).heroes);
  const sourceHeroes = asRecords(team.heroes);
  const buildSlots = (heroesOf: ArtifactRecord[], sourceOf: (index: number) => ArtifactRecord) =>
    heroesOf.map((hero, index) => {
      const source = sourceOf(index);
      const heroId = typeof hero.heroId === "string" ? hero.heroId : null;
      const heroPath = heroId === null ? undefined : localized(pub.routes.get(heroId), loc);
      return {
        holder: typeof hero.holder === "number" ? hero.holder : index,
        heroId,
        nameVi: nullableString(source.name),
        ...(heroPath === undefined ? {} : { pagePath: heroPath }),
        note: nullableString(source.note) ?? nullableString(source.buildNote),
        tactics: asRecords(hero.tactics).map((tactic) => ({
          slot: tactic.slot as number,
          vi: nullableString(tactic.vi),
          raw: null,
          tacticId: typeof tactic.tacticId === "string" ? tactic.tacticId : null,
          ...(tacticPath(pub, tactic.tacticId, loc) === undefined ? {} : { pagePath: tacticPath(pub, tactic.tacticId, loc)! }),
        })),
        books: [],
      };
    });
  const heroes = buildSlots(resolved, (index) => sourceHeroes[index] ?? {});
  const variantsResolved = asRecords(asRecord(detail.resolved).variants);
  const sourceVariants = asRecords(team.variants);
  const variants = variantsResolved.map((variant, index) => {
    const source = sourceVariants.find((entry) => entry.id === variant.id) ?? sourceVariants[index] ?? {};
    return {
      id: nullableString(variant.id),
      label: nullableString(source.displayLabel) ?? nullableString(source.label),
      period: nullableString(source.period),
      region: nullableString(source.region),
      commanderBefore: nullableString(source.commanderBefore),
      commanderAfter: nullableString(source.commanderAfter),
      buildNote: nullableString(source.buildNote),
      note: nullableString(source.note),
      heroes: buildSlots(asRecords(variant.heroes), (heroIndex) => asRecords(source.heroes)[heroIndex] ?? {}),
    };
  });
  const notes: z.infer<typeof notesBlockSchema>[] = [
    ...notesFromRecord("team-", "team", { context: team.context, buildNote: team.buildNote, note: team.note, openingNote: team.openingNote, seasonNote: detail.seasonNote }),
    ...sourceHeroes.flatMap((hero, index) =>
      notesFromRecord(`hero-${index}-`, `hero:${index}`, { buildNote: hero.buildNote, note: hero.note, openingNote: hero.openingNote }),
    ),
  ];
  const guide = allowGuide(team.guide);
  return {
    team: {
      ...itemHeader(summary, loc, selector),
      nameVi: nullableString(team.title) ?? summary.nameVi,
      context: { period: nullableString(team.period), region: nullableString(team.region), season: nullableString(detail.season), commanderBefore: nullableString(team.commanderBefore), commanderAfter: nullableString(team.commanderAfter) },
      heroes,
    },
    notes,
    variants,
    ...(Object.keys(guide).length === 0 ? {} : { guide }),
    provenance: [{ artifact: "reference-team-details", recordId: ref, trust: "untrusted" }, { artifact: "public-routes" }],
  };
}

function buildEngine(ctx: ToolContext, selector: ReferenceSelector, seasonContext: SeasonContext | undefined): TeamParts {
  const requested = selector.teamId!;
  const teamId = requested.startsWith("team:") ? requested.slice("team:".length) : requested;
  if (selector.configId !== undefined && seasonContext === undefined) throw fail("INVALID_REQUEST", ["reference.configId"]);
  const resolve = engineHeroNames(ctx);
  const named = (team: ArtifactRecord, configId?: string) => {
    const item = engineItem(ctx, team, configId);
    return { item, heroes: asRecords(team.heroes) };
  };
  const legacySlots = (team: ArtifactRecord) =>
    named(team).heroes.map((hero, holder) => ({
      holder,
      heroId: resolve.hero(text(hero.name)),
      nameVi: nullableString(hero.name),
      note: nullableString(hero.note),
      tactics: asRecords(hero.tactics).map((tactic, slot) => ({
        slot,
        vi: nullableString(tactic.name),
        tacticId: resolve.tactic(text(tactic.name)),
        alternatives: stringList(tactic.alternatives).map((name) => ({ vi: name, tacticId: resolve.tactic(name) })),
      })),
      books: asRecords(hero.books).map((book, slot) => ({ slot, vi: nullableString(book.name), raw: null, bookId: null })),
      alternatives: stringList(hero.alternatives).map((name) => ({ vi: name, heroId: resolve.hero(name) })),
    }));
  const teamNotes = (team: ArtifactRecord) => {
    const notes: z.infer<typeof notesBlockSchema>[] = [];
    const note = nullableString(team.notes);
    if (note !== null) notes.push({ id: "notes", owner: "team", textVi: note, textRaw: null });
    const counters = asRecord(team.counters);
    for (const kind of ["good", "avoid"] as const) {
      stringList(counters[kind]).forEach((entry, index) => notes.push({ id: `counter-${kind}-${index}`, owner: `counter:${kind}`, textVi: entry, textRaw: null }));
    }
    return notes;
  };
  const provenance = [{ artifact: "teams", recordId: teamId, trust: "untrusted" as const }];
  if (seasonContext) {
    const resolved = seasonDomain.config(ctx.snapshot.seasonModel!, { teamId, configId: selector.configId, context: seasonContext });
    if (!resolved.ok) {
      throw new ResearchHandlerError(resolved.code as ResearchErrorCode, PUBLIC_ERRORS[resolved.code as ResearchErrorCode].message, false, [], resolved.choices);
    }
    const config = resolved.config;
    const { item } = named(resolved.team as ArtifactRecord, config.id);
    const heroes = config.heroSlots.map((slot, holder) => ({
      holder,
      heroRefs: [...slot.heroRefs],
      tactics: slot.tacticSlots.map((tactic, index) => ({ slot: index, tacticRefs: [...tactic.tacticRefs] })),
      books: [],
    }));
    const { heroes: _heroes, heroHit: _a, tacticHit: _b, total: _c, score: _score, ...header } = item;
    return {
      team: {
        ...header,
        config: projectConfig(config as unknown as ArtifactRecord),
        sourceScore: projectEngineScore(resolved.evaluation?.sourceScore),
        tierRankings: asRecords(resolved.evaluation?.rankings).slice(0, 20).map(allowTierRanking),
        heroes,
      },
      notes: teamNotes(resolved.team as ArtifactRecord),
      variants: [],
      seasonContext,
      provenance: [
        { artifact: "season-team-configs", recordId: config.id, trust: "untrusted" },
        ...(resolved.evaluation ? [{ artifact: "season-team-evaluations", recordId: text(resolved.evaluation.id), trust: "untrusted" as const }] : []),
      ],
    };
  }
  const team = ctx.index.teamsById.get(teamId);
  if (!team) throw fail("REFERENCE_NOT_FOUND");
  const { item } = named(team);
  const { heroes: _heroes, heroHit: _a, tacticHit: _b, total: _c, score: _score, ...header } = item;
  const rankings = (ctx.index.tierByTeam.get(teamId) ?? []).slice(0, 20).map(allowTierRanking);
  return {
    team: { ...header, tierRankings: rankings, heroes: legacySlots(team) },
    notes: teamNotes(team),
    variants: [],
    provenance: [...provenance, ...(rankings.length === 0 ? [] : [{ artifact: "team-tier", recordId: teamId, trust: "untrusted" as const }])],
  };
}

export async function handleGetTeam(ctx: ToolContext, rawInput: unknown) {
  const input = parseToolInput(getTeamInputSchema, rawInput);
  const loc: Locale = input.locale ?? "vi";
  const selector = input.reference;
  const section = input.section ?? "overview";
  const limit = input.limit ?? 20;
  const seasonContext = input.seasonContext as SeasonContext | undefined;

  if (input.cursor === undefined) ctx.ensureExpectedWorkflow(input.expectedWorkflowVersion);
  else ctx.requireExpectedWorkflow(input.expectedWorkflowVersion);
  if (input.cursor !== undefined && (section === "overview" || section === "guide")) throw fail("CURSOR_INVALID");
  if (seasonContext !== undefined && selector.collection !== "engine") throw scopeInvalid("seasonContext");
  if (selector.collection === "engine") ensureSeasonContext(ctx, seasonContext);

  let parts: TeamParts;
  if (selector.collection === "engine") parts = buildEngine(ctx, selector, seasonContext);
  else {
    const pub = ctx.publication();
    parts =
      selector.collection === "recommended" ? buildRecommended(pub, selector, loc)
      : selector.collection === "other" ? buildOther(pub, selector, loc)
      : buildKhaiHoang(pub, selector, loc);
  }

  const sections = (
    [
      { name: "overview" as const, total: 1 },
      { name: "notes" as const, total: parts.notes.length },
      { name: "variants" as const, total: parts.variants.length },
      { name: "guide" as const, total: parts.guide === undefined ? 0 : 1 },
    ] satisfies Array<{ name: (typeof TEAM_SECTIONS)[number]; total: number }>
  ).filter((entry) => entry.total > 0);
  if (!sections.some((entry) => entry.name === section)) throw fail("INVALID_REQUEST", ["section"]);

  const base = {
    ...ctx.commonResult(parts.provenance),
    locale: loc,
    section,
    ...(parts.seasonContext ? { seasonContext: parts.seasonContext } : {}),
  };
  if (section === "overview") return { ...base, team: parts.team, sections };
  const build = { ref: parts.team.ref, name: parts.team.name, heroes: parts.team.heroes };
  if (section === "guide") return { ...base, build, guide: parts.guide };

  const binding: CursorBinding = {
    tool: "tqccl_get_team",
    locale: loc,
    workflowVersion: ctx.workflowVersion,
    filter: { reference: selector, section, seasonContext: seasonContext ?? null },
  };
  const offset = input.cursor === undefined ? 0 : await decodeCursor(input.cursor, binding);
  const items: readonly unknown[] = section === "notes" ? parts.notes : parts.variants;
  const { page, nextOffset } = fitPage(items, offset, limit, (slice) => ({ ...base, build, total: items.length, [section]: slice }));
  return {
    ...base,
    build,
    total: items.length,
    [section]: page,
    truncated: nextOffset !== null,
    ...(nextOffset === null ? {} : { nextCursor: await encodeCursor(binding, nextOffset) }),
  };
}
