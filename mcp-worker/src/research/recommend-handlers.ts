import { z } from "zod";

import {
  analyzeTacticSubstitutes,
  buildSeasonCandidates,
  recommendRoster,
  seasonTacticUsage,
} from "../../../js/roster-season-candidates.js";
import { MAX_TACTIC_OVERRIDES } from "../../../js/roster-scan-state.js";
import { createFormerTacticIdIndex } from "../../../js/lookup-ids.js";
import { buildTacticRules } from "../../../js/team-recommend-engine.js";
import { verifyConfirmationBinding, type CanonicalState } from "../domain/canonical-state.js";
import { PUBLIC_ERRORS, ResearchHandlerError } from "./handler-error.js";
import {
  boundedText,
  canonicalStateSchema,
  commonResultSchema,
  confirmationBindingSchema,
  workflowVersionSchema,
} from "./shared-schemas.js";
import { enforceResultSize, parseToolInput, type ToolContext } from "./tool-context.js";

const MAX_BLOCKED = 10;
const MAX_INCOMPATIBLE = 10;
const MAX_CONFLICTED = 10;
const MAX_OUTPUT_CHARS = 38_000;

type Rec = Record<string, any>;

const tacticOverrideSchema = z
  .object({
    teamId: z.string().min(1).max(128).describe("ID đội mùa (sourceConfigId) có ô được thay."),
    heroIndex: z.number().int().min(0).max(2).describe("Vị trí tướng trong đội (0-2)."),
    slotIndex: z.number().int().min(0).max(1).describe("Vị trí ô chiến pháp của tướng (0-1)."),
    tactic: z.string().min(1).max(128).describe("Tên chiến pháp Việt dùng thay; phải có trong kho."),
  })
  .strict();

export const recommendTeamsInputSchema = z
  .object({
    expectedWorkflowVersion: workflowVersionSchema,
    canonicalState: canonicalStateSchema,
    confirmationBinding: confirmationBindingSchema,
    sourceSeasonId: z
      .string()
      .min(1)
      .max(128)
      .describe("Mùa nguồn trong seasonOptions; lấy từ seasonSelection của tqccl_get_playbook."),
    lockedTeams: z
      .array(z.string().min(1).max(256))
      .max(10)
      .optional()
      .describe("teamId (team:...) trong canonicalState.lockedTeams cần giữ; bỏ trống = giữ mọi đội đã khóa."),
    maxTeams: z.number().int().min(1).max(10).optional().describe("Số đội tối đa; mặc định 5."),
    mode: z.enum(["meta", "redStars"]).optional().describe("meta = bậc T0→T1; redStars = nhiều hột. Mặc định meta."),
    tacticOverrides: z
      .array(tacticOverrideSchema)
      .max(MAX_TACTIC_OVERRIDES)
      .optional()
      .describe("Món bù người dùng đã chọn (tối đa 20); vượt thì INVALID_REQUEST, không bỏ âm thầm."),
    fullBox: z
      .boolean()
      .optional()
      .describe("Tìm toàn kho; mặc định true khi >40 tướng và >60 chiến pháp như trang Gợi ý kho."),
  })
  .strict();
export type RecommendTeamsInput = z.infer<typeof recommendTeamsInputSchema>;

const referenceSchema = z
  .union([
    z.object({ collection: z.literal("recommended").describe("Collection recommended."), sourceConfigId: boundedText.describe("ID cấu hình nguồn.") }).strict(),
    z.object({ collection: z.literal("engine").describe("Collection engine (kho đội cũ)."), teamId: boundedText.describe("ID đội engine.") }).strict(),
  ])
  .nullable()
  .describe("Selector cho tqccl_get_team; null với đội đã khóa.");

const heroRefSchema = z.object({ canonicalId: boundedText.describe("ID tướng canonical."), displayName: boundedText.describe("Tên tướng.") }).strict();
const selectionSchema = z
  .object({
    holderId: boundedText.nullable().describe("Tướng giữ ô; null nếu không rõ."),
    slotIndex: z.number().int().nonnegative().describe("Vị trí ô chiến pháp."),
    selectedTactic: boundedText.describe("Tên chiến pháp đã chọn."),
    selectedTacticId: boundedText.describe("ID chiến pháp đã chọn."),
    reason: boundedText.describe("Lý do."),
    downgrade: z.boolean().describe("True khi không dùng chiến pháp chính của nguồn."),
    unresolved: z.boolean().describe("True khi ô chưa đối chiếu với từ điển."),
  })
  .strict();
const swapSchema = z.object({ from: boundedText.describe("Món gốc."), to: boundedText.describe("Món thay.") }).strict();

const portfolioEntrySchema = z
  .object({
    teamId: boundedText.describe("ID đội."),
    name: boundedText.describe("Tên."),
    source: z.enum(["season", "legacy", "locked"]).describe("season = đội chuẩn mùa nguồn; legacy = top-up từ kho engine cũ."),
    status: boundedText.describe("Trạng thái."),
    locked: z.boolean().describe("Đội đã khóa từ canonicalState."),
    tier: boundedText.describe("Bậc."),
    originalTier: boundedText.nullable().describe("Bậc của cấu hình gốc khi là bản đã thay."),
    variantUnrated: z.boolean().describe("Bản đã thay chưa được đánh giá; tier là của cấu hình gốc."),
    variantLabel: z.literal("đã thay").nullable().describe("\"đã thay\" khi dùng món bù; null với cấu hình gốc."),
    sourceScore: z.number().nullable().describe("Điểm nguồn; chỉ cho cấu hình gốc chưa đổi ô."),
    heroes: z.array(heroRefSchema).max(3).describe("Ba tướng của đội."),
    tacticSelections: z.array(selectionSchema).max(12).describe("Chiến pháp chọn theo từng ô."),
    selectedTactics: z.array(boundedText).max(12).describe("Tên chiến pháp đã chọn cho đội."),
    usedAlternatives: z.array(swapSchema).max(12).describe("Các món đã thay (từ → sang)."),
    unresolvedTactics: z.array(boundedText).max(12).describe("Ô chiến pháp chưa đối chiếu được."),
    unresolvedLabel: z.literal("chưa đối chiếu").nullable().describe("\"chưa đối chiếu\" khi còn ô chưa đối chiếu."),
    reference: referenceSchema.describe("Selector cho tqccl_get_team."),
  })
  .strict();

const substituteSchema = z.object({ tactic: boundedText.describe("Tên chiến pháp bù."), configCount: z.number().int().nonnegative().describe("Số cấu hình cùng mùa dùng món này.") }).strict();
const incompatibleSubstituteSchema = substituteSchema.extend({ reason: boundedText.describe("Lý do phạm luật đội.") }).strict();
const missingSlotSchema = z
  .object({
    holderName: boundedText.describe("Tên tướng giữ ô."),
    tactic: boundedText.describe("Tên chiến pháp."),
    heroIndex: z.number().int().describe("Vị trí tướng trong đội."),
    slotIndex: z.number().int().describe("Vị trí ô chiến pháp."),
    substitutes: z.array(substituteSchema).max(3).describe("Món bù hợp luật đội có trong kho (tối đa 3)."),
    incompatible: z.array(incompatibleSubstituteSchema).max(3).describe("Món bù có trong kho nhưng phạm luật đội."),
    substituteStatus: z.enum(["available", "none-in-box", "incompatible"]).describe("available / none-in-box / incompatible."),
  })
  .strict();
const blockedEntrySchema = z
  .object({
    teamId: boundedText.describe("ID đội."),
    name: boundedText.describe("Tên."),
    status: z.enum(["missing-hero", "missing-tactic"]).describe("Trạng thái."),
    tier: boundedText.describe("Bậc."),
    missingHeroSlotNames: z.array(z.array(boundedText).max(6)).max(3).describe("Tên tướng thay thế được cho từng ô tướng còn thiếu."),
    missingTacticSlots: z.array(missingSlotSchema).max(6).describe("Ô chiến pháp còn thiếu kèm món bù theo kho."),
    reference: referenceSchema.describe("Selector cho tqccl_get_team."),
  })
  .strict();
const incompatibleEntrySchema = z
  .object({
    teamId: boundedText.describe("ID đội."),
    name: boundedText.describe("Tên."),
    tier: boundedText.describe("Bậc."),
    incompatibleTactics: z
      .array(z.object({ tactic: boundedText.describe("Món phạm luật."), from: boundedText.describe("Món gốc."), reason: boundedText.describe("Lý do phạm luật đội.") }).strict())
      .max(6)
      .describe("Món phạm luật đội và lý do."),
    reference: referenceSchema.describe("Selector cho tqccl_get_team."),
  })
  .strict();
const conflictHolderSchema = z
  .object({
    name: boundedText.describe("Tên đội đã chọn đang giữ món."),
    reference: referenceSchema.describe("Selector cho tqccl_get_team (null nếu là đội khóa)."),
  })
  .strict();
const conflictedEntrySchema = z
  .object({
    teamId: boundedText.describe("ID đội."),
    name: boundedText.describe("Tên."),
    tier: boundedText.describe("Bậc."),
    sharedHeroes: z
      .array(z.object({ hero: boundedText.describe("Tướng dùng chung."), usedBy: conflictHolderSchema }).strict())
      .max(3)
      .describe("Tướng đội này cần nhưng đội đã chọn đang dùng."),
    sharedTactics: z
      .array(z.object({ tactic: boundedText.describe("Chiến pháp dùng chung."), usedBy: conflictHolderSchema }).strict())
      .max(6)
      .describe("Chiến pháp đội này cần nhưng đội đã chọn đang dùng (kho chỉ có một bản)."),
    reference: referenceSchema.describe("Selector cho tqccl_get_team."),
  })
  .strict();

export const recommendTeamsOutputSchema = commonResultSchema
  .extend({
    basis: z.literal("source-reference-fit").describe("Cơ sở ghép: luôn là source-reference-fit (nguồn + kho, không chấm theo luật)."),
    rulesetVerified: z.literal(false).describe("Luôn false: kết quả chưa được kiểm theo ruleset mùa."),
    sourceSeasonId: boundedText.describe("Mùa nguồn."),
    mode: z.enum(["meta", "redStars"]).describe("Chế độ."),
    maxTeams: z.number().int().describe("Số đội tối đa đã dùng."),
    fullBox: z.boolean().describe("Có tìm toàn kho hay không."),
    legacyUsed: z.boolean().describe("True khi có đội top-up từ kho engine cũ; mỗi đội ghi source."),
    portfolioTeams: z.array(portfolioEntrySchema).max(10).describe("Đội xếp được, theo thứ tự ưu tiên."),
    blockedStrongTeams: z.array(blockedEntrySchema).max(MAX_BLOCKED).describe("Đội mạnh còn thiếu tướng hoặc chiến pháp."),
    incompatibleTeams: z.array(incompatibleEntrySchema).max(MAX_INCOMPATIBLE).describe("Đội đủ tướng và món nhưng món bù phạm luật đội."),
    conflictedTeams: z
      .array(conflictedEntrySchema)
      .max(MAX_CONFLICTED)
      .describe("Đội đủ kho khi đứng riêng nhưng không vào danh sách vì dùng chung tướng/chiến pháp với đội đã chọn."),
    omittedCounts: z
      .object({
        blockedStrongTeams: z.number().int().nonnegative().describe("Đội mạnh còn thiếu tướng hoặc chiến pháp."),
        incompatibleTeams: z.number().int().nonnegative().describe("Đội đủ tướng và món nhưng món bù phạm luật đội."),
        conflictedTeams: z.number().int().nonnegative().describe("Đội đủ kho bị loại vì tranh tướng/chiến pháp."),
      })
      .strict()
      .describe("Số mục bị bỏ để vừa giới hạn kích thước."),
    tacticOverrides: z
      .object({
        requested: z.number().int().nonnegative().describe("Số món bù yêu cầu."),
        applied: z.number().int().nonnegative().describe("Số món bù đã áp dụng."),
        ignored: z.array(tacticOverrideSchema.omit({ tactic: true }).strict()).max(MAX_TACTIC_OVERRIDES).describe("Món bù không khớp đội/ô nào."),
      })
      .strict()
      .describe("Kết quả áp món bù: yêu cầu, đã áp dụng, bị bỏ qua (báo, không bỏ âm thầm)."),
    diagnostics: z
      .object({
        seasonSourceRecords: z.number().int().nonnegative().describe("Số bản ghi nguồn của mùa."),
        seasonMappedTeams: z.number().int().nonnegative().describe("Số đội mùa dựng được."),
        seasonUnmappedTeams: z.number().int().nonnegative().describe("Số bản ghi mùa không ánh xạ được."),
        searchedCandidates: z.number().int().nonnegative().describe("Số ứng viên engine đã xét."),
      })
      .strict()
      .describe("Chẩn đoán bounded về dữ liệu mùa và số ứng viên đã xét."),
  })
  .strict();
export type RecommendTeamsOutput = z.infer<typeof recommendTeamsOutputSchema>;

function invalid(fields: string[]): ResearchHandlerError {
  return new ResearchHandlerError("INVALID_REQUEST", PUBLIC_ERRORS.INVALID_REQUEST.message, false, fields);
}

const text = (value: unknown): string =>
  String(value ?? "")
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f-\u009f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 256);

function sourceScores(ctx: ToolContext, seasonId: string): Map<string, number> {
  const scores = new Map<string, number>();
  for (const team of ctx.publication().teams) {
    if (team.collection === "recommended" && team.sourceSeasonId === seasonId && typeof team.score === "number") {
      scores.set(team.id, team.score);
    }
  }
  return scores;
}

function referenceOf(entry: Rec): z.infer<typeof referenceSchema> {
  if (entry.locked || entry.source === "locked") return null;
  const id = text(entry.team?.id);
  return entry.source === "legacy" || entry.team?.source !== "season"
    ? { collection: "engine", teamId: id }
    : { collection: "recommended", sourceConfigId: id };
}

export async function handleRecommendTeams(ctx: ToolContext, rawInput: unknown): Promise<RecommendTeamsOutput> {
  const input = parseToolInput(recommendTeamsInputSchema, rawInput);
  ctx.requireExpectedWorkflow(input.expectedWorkflowVersion);
  const publication = ctx.publication();

  const registry = publication.seasons;
  if (!registry.seasonOptions.some((option) => option.sourceSeasonId === input.sourceSeasonId)) {
    throw new ResearchHandlerError(
      "REFERENCE_SCOPE_INVALID",
      PUBLIC_ERRORS.REFERENCE_SCOPE_INVALID.message,
      false,
      ["sourceSeasonId"],
    );
  }
  const state = input.canonicalState as unknown as CanonicalState;
  // Cùng giới hạn engine (`lockedEntry`): đội khóa >3 tướng hoặc >12 chiến pháp làm hỏng output, nên từ chối ngay ở input.
  if (state.lockedTeams.some((team) => team.heroIds.length > 3 || team.tacticIds.length > 12)) {
    throw invalid(["canonicalState.lockedTeams"]);
  }
  // Web giữ một món cho mỗi ô (`cleanTacticOverrides`); trùng ô là ý định mơ hồ, không chọn hộ.
  const slotKeys = new Set((input.tacticOverrides ?? []).map((item) => `${item.teamId}\u0000${item.heroIndex}\u0000${item.slotIndex}`));
  if (slotKeys.size !== (input.tacticOverrides ?? []).length) throw invalid(["tacticOverrides"]);
  if (state.seasonContext !== undefined) throw invalid(["canonicalState.seasonContext"]);
  if ((state.unresolved?.length ?? 0) > 0) {
    throw new ResearchHandlerError("CONFIRMATION_REQUIRED", PUBLIC_ERRORS.CONFIRMATION_REQUIRED.message);
  }
  if (!(await verifyConfirmationBinding(input.confirmationBinding, state, ctx.workflowVersion))) {
    throw new ResearchHandlerError("CONFIRMATION_REQUIRED", PUBLIC_ERRORS.CONFIRMATION_REQUIRED.message);
  }
  // Roster chưa biết ≠ kho rỗng đã xác nhận: không có thông tin sở hữu thì không được nói "xây được".
  if (state.heroes.length === 0 && state.tactics.length === 0 && state.lockedTeams.length === 0) {
    throw new ResearchHandlerError("CONFIRMATION_REQUIRED", PUBLIC_ERRORS.CONFIRMATION_REQUIRED.message);
  }

  const wantedLocks = input.lockedTeams === undefined ? null : new Set(input.lockedTeams);
  if (wantedLocks !== null) {
    const known = new Set(state.lockedTeams.map((team) => team.teamId as string));
    if ([...wantedLocks].some((id) => !known.has(id))) throw invalid(["lockedTeams"]);
  }
  const heroNames = new Map(state.heroes.map((hero) => [hero.canonicalId as string, hero.displayName]));

  const heroesDict = ctx.snapshot.artifacts["heroes-dict"] as never;
  const tacticsDict = ctx.snapshot.artifacts.tactics as never;
  const season = buildSeasonCandidates(publication.recommendSourceRecords(input.sourceSeasonId) as never, input.sourceSeasonId, {
    heroesDict,
    tacticsDict,
  }) as { teams: Rec[]; teamTier: Rec[]; diagnostics: Rec };
  const usage = seasonTacticUsage(season.teams as never);
  const tacticRules = buildTacticRules(tacticsDict);

  const ownedHeroes = state.heroes.slice(0, 500).map((hero) => ({
    name: hero.displayName,
    canonicalId: hero.canonicalId,
    ...(hero.redStars === undefined ? {} : { redStars: hero.redStars }),
  }));
  // Mã chiến pháp đã gộp (lookup.formerIds) trong trạng thái đã xác nhận quy về mã giữ trước khi so với đội mùa.
  const formerTactic: Map<string, string> = createFormerTacticIdIndex(tacticsDict);
  const liveTacticId = (id: string): string => formerTactic.get(id) ?? id;
  const ownedTactics = state.tactics.slice(0, 1_000).map((tactic) => ({
    name: tactic.displayName,
    canonicalId: liveTacticId(tactic.canonicalId),
  }));
  const lockedTeams = state.lockedTeams
    .filter((team) => wantedLocks === null || wantedLocks.has(team.teamId as string))
    .slice(0, 10)
    .map((team) => ({
      teamId: team.teamId,
      teamName: team.teamId,
      heroes: [...team.heroIds],
      tactics: team.tacticIds.map(liveTacticId),
      tacticAssignments: team.tacticAssignments?.map((assignment) => ({
        holderId: assignment.holderId,
        tacticId: liveTacticId(assignment.tacticId),
        ...(assignment.slotIndex === undefined ? {} : { slotIndex: assignment.slotIndex }),
      })),
    }));

  const mode = input.mode ?? "meta";
  const maxTeams = input.maxTeams ?? 5;
  const fullBox = input.fullBox ?? (ownedHeroes.length > 40 && ownedTactics.length > 60);
  const overrides = input.tacticOverrides ?? [];

  const result = recommendRoster({
    seasonTeams: season.teams,
    seasonTier: season.teamTier,
    legacyTeams: ctx.snapshot.artifacts.teams as never,
    legacyTier: ctx.snapshot.artifacts["team-tier"] as never,
    tacticOverrides: overrides,
    ownedHeroes,
    ownedTactics,
    lockedTeams,
    mode,
    keepExistingTeams: true,
    tacticsDict,
    fullBox,
    maxTeams,
  } as never) as Rec;

  const scores = sourceScores(ctx, input.sourceSeasonId);
  const portfolio: Rec[] = result.portfolioTeams;
  const reserved: string[] = portfolio.flatMap((entry) => entry.selectedTactics ?? []);

  const seasonById = new Map(season.teams.map((team) => [team.id as string, team]));
  const ignored = overrides.filter((override) => {
    const team = seasonById.get(override.teamId);
    return !team?.heroes?.[override.heroIndex]?.tactics?.[override.slotIndex];
  });

  const portfolioTeams = portfolio.map((entry) => {
    const original = entry.originalTier ? text(entry.originalTier) : null;
    const modified = (entry.usedAlternatives ?? []).length > 0 || entry.variantUnrated === true;
    const isSeason = entry.source === "team" && entry.team?.source === "season";
    const score = isSeason && !modified ? scores.get(entry.team.id) : undefined;
    const unresolved: string[] = (entry.unresolvedTactics ?? []).map(text);
    const source: "season" | "legacy" | "locked" = entry.locked ? "locked" : entry.source === "legacy" ? "legacy" : "season";
    return {
      teamId: text(entry.team?.id),
      name: text(entry.team?.name),
      source,
      status: text(entry.status),
      locked: entry.locked === true,
      tier: text(entry.tier),
      originalTier: entry.variantUnrated ? original : null,
      variantUnrated: entry.variantUnrated === true,
      variantLabel: modified ? ("đã thay" as const) : null,
      sourceScore: score ?? null,
      heroes: (entry.heroAssignments ?? []).map((hero: Rec) => ({
        canonicalId: text(hero.canonicalId),
        displayName: text(heroNames.get(hero.canonicalId) ?? hero.displayName),
      })),
      tacticSelections: (entry.tacticSelections ?? []).map((selection: Rec) => ({
        holderId: selection.holderId == null ? null : text(selection.holderId),
        slotIndex: selection.slotIndex,
        selectedTactic: text(selection.selectedTactic),
        selectedTacticId: text(selection.selectedTacticId),
        reason: text(selection.reason),
        downgrade: selection.downgrade === true,
        unresolved: selection.unresolved === true,
      })),
      selectedTactics: (entry.selectedTactics ?? []).map(text),
      usedAlternatives: (entry.usedAlternatives ?? []).map((swap: Rec) => ({ from: text(swap.from), to: text(swap.to) })),
      unresolvedTactics: unresolved,
      unresolvedLabel: unresolved.length > 0 ? ("chưa đối chiếu" as const) : null,
      reference: referenceOf(entry),
    };
  });

  const blockedAll: Rec[] = result.blockedStrongTeams;
  const blockedStrongTeams = blockedAll.slice(0, MAX_BLOCKED).map((entry) => {
    const slots: Rec[] = entry.status === "missing-hero" ? [] : (entry.missingTacticSlots ?? []);
    return {
      teamId: text(entry.team?.id),
      name: text(entry.team?.name),
      status: entry.status as "missing-hero" | "missing-tactic",
      tier: text(entry.tier),
      missingHeroSlotNames: entry.status === "missing-hero" ? (entry.missingHeroSlotNames ?? []).map((names: string[]) => names.map(text)) : [],
      missingTacticSlots: slots.map((slot) => {
        const analysis = analyzeTacticSubstitutes({
          heroName: slot.holderName,
          missingTactic: slot.tactic,
          team: entry.team,
          tacticOverrides: overrides,
          heroIndex: slot.heroIndex,
          slotIndex: slot.slotIndex,
          tacticRules,
          usage,
          ownedTactics,
          reservedTactics: reserved,
        } as never) as { substitutes: Rec[]; incompatible: Rec[] };
        return {
          holderName: text(slot.holderName),
          tactic: text(slot.tactic),
          heroIndex: slot.heroIndex,
          slotIndex: slot.slotIndex,
          substitutes: analysis.substitutes.map((item) => ({ tactic: text(item.tactic), configCount: item.configCount })),
          incompatible: analysis.incompatible.map((item) => ({
            tactic: text(item.tactic),
            configCount: item.configCount,
            reason: text(item.reason),
          })),
          substituteStatus: (analysis.substitutes.length > 0
            ? "available"
            : analysis.incompatible.length > 0
              ? "incompatible"
              : "none-in-box") as "available" | "none-in-box" | "incompatible",
        };
      }),
      reference: referenceOf({ ...entry, source: "team" }),
    };
  });

  const incompatibleAll: Rec[] = result.incompatibleTeams;
  const incompatibleTeams = incompatibleAll.slice(0, MAX_INCOMPATIBLE).map((entry) => ({
    teamId: text(entry.team?.id),
    name: text(entry.team?.name),
    tier: text(entry.tier),
    incompatibleTactics: (entry.incompatibleTactics ?? []).map((item: Rec) => ({
      tactic: text(item.tactic),
      from: text(item.from),
      reason: text(item.reason),
    })),
    reference: referenceOf({ ...entry, source: "team" }),
  }));

  const holders = new Map<string, z.infer<typeof conflictHolderSchema>>(
    portfolio.map((entry: Rec) => [text(entry.team?.id), { name: text(entry.team?.name), reference: referenceOf(entry) }]),
  );
  const holderOf = (teamId: unknown) => holders.get(text(teamId)) ?? { name: text(teamId), reference: null };
  const conflictedAll: Rec[] = result.conflictedTeams ?? [];
  const conflictedTeams = conflictedAll.slice(0, MAX_CONFLICTED).map((entry) => ({
    teamId: text(entry.team?.id),
    name: text(entry.team?.name),
    tier: text(entry.tier),
    sharedHeroes: (entry.sharedHeroes ?? []).map((item: Rec) => ({ hero: text(item.hero), usedBy: holderOf(item.usedBy) })),
    sharedTactics: (entry.sharedTactics ?? []).map((item: Rec) => ({ tactic: text(item.tactic), usedBy: holderOf(item.usedBy) })),
    reference: referenceOf({ ...entry, source: "team" }),
  }));
  const warnings = [...ctx.snapshot.warnings];
  if (season.teams.length === 0) warnings.push("season-has-no-mapped-source-teams");
  if (result.legacyUsed === true) warnings.push("legacy-engine-teams-used");
  if (ignored.length > 0) warnings.push("tactic-overrides-ignored");

  const output: RecommendTeamsOutput = {
    ...ctx.commonResult([
      { artifact: "reference-team-details", trust: "untrusted" },
      { artifact: "team-tier", trust: "untrusted" },
      { artifact: "canonical-state" },
    ]),
    warnings,
    basis: "source-reference-fit",
    rulesetVerified: false,
    sourceSeasonId: input.sourceSeasonId,
    mode,
    maxTeams,
    fullBox,
    legacyUsed: result.legacyUsed === true,
    portfolioTeams,
    blockedStrongTeams,
    incompatibleTeams,
    conflictedTeams,
    omittedCounts: {
      blockedStrongTeams: Math.max(0, blockedAll.length - blockedStrongTeams.length),
      incompatibleTeams: Math.max(0, incompatibleAll.length - incompatibleTeams.length),
      conflictedTeams: Math.max(0, conflictedAll.length - conflictedTeams.length),
    },
    tacticOverrides: {
      requested: overrides.length,
      applied: overrides.length - ignored.length,
      ignored: ignored.map(({ teamId, heroIndex, slotIndex }) => ({ teamId, heroIndex, slotIndex })),
    },
    diagnostics: {
      seasonSourceRecords: Number(season.diagnostics?.total ?? 0),
      seasonMappedTeams: season.teams.length,
      seasonUnmappedTeams: (season.diagnostics?.unmapped ?? []).length,
      searchedCandidates: Number(result.diagnostics?.searchedCandidates ?? 0),
    },
  } as RecommendTeamsOutput;
  const omittedTotal = () =>
    output.omittedCounts.blockedStrongTeams + output.omittedCounts.incompatibleTeams + output.omittedCounts.conflictedTeams;
  output.truncated = omittedTotal() > 0;

  // Giữ JSON hợp lệ dưới giới hạn: bớt đội "bị chặn"/"không tương thích" trước, đội "tranh tài nguyên" sau cùng
  // (ghi omittedCounts); không bao giờ bớt ô của đội đã trả.
  while (JSON.stringify(output).length > MAX_OUTPUT_CHARS) {
    if (output.blockedStrongTeams.length > 0 && output.blockedStrongTeams.length >= output.incompatibleTeams.length) {
      output.blockedStrongTeams.pop();
      output.omittedCounts.blockedStrongTeams += 1;
    } else if (output.incompatibleTeams.length > 0) {
      output.incompatibleTeams.pop();
      output.omittedCounts.incompatibleTeams += 1;
    } else if (output.conflictedTeams.length > 0) {
      output.conflictedTeams.pop();
      output.omittedCounts.conflictedTeams += 1;
    } else {
      break;
    }
    output.truncated = true;
  }
  enforceResultSize(output);
  return output;
}
