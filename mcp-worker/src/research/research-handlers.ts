import { ZodError, type ZodType } from "zod";

import { heroFamilyId } from "../../../js/hero-identity.js";
import { resolveSeasonContext } from "../../../js/season-context.js";
import { publicSnapshotView } from "../data/public-snapshot-view.js";
import { buildSnapshotIndex, type SnapshotIndex } from "../data/snapshot-index.js";
import type { DataSnapshot } from "../data/artifact-contracts.js";
import type { DataSource } from "../data/data-source.js";
import { createWorkflowVersion } from "../domain/canonical-state.js";
import { normalizeObservations, type NormalizationResult } from "../domain/normalization-service.js";
import { WORKFLOW_BUILD_ID } from "../generated/workflow-build.js";
import { handleGetEntity, handleSearch } from "./catalog-handlers.js";
import { PUBLIC_ERRORS, ResearchHandlerError } from "./handler-error.js";
import { handleGetPlaybook } from "./playbook-handlers.js";
import { handleRecommendTeams } from "./recommend-handlers.js";
import {
  RESEARCH_CONTRACTS,
  type ResearchInput,
  type ResearchOutput,
  type ResearchToolName,
} from "./research-contracts.js";
import { handleFindTeams, handleGetTeam } from "./team-handlers.js";
import { createToolContext, enforceResultSize, parseToolInput, type ToolContext } from "./tool-context.js";

export { ResearchHandlerError } from "./handler-error.js";

export interface ResearchHandlerDependencies {
  dataSource: DataSource;
}

export interface ResearchHandlers {
  call<Name extends ResearchToolName>(
    name: Name,
    input: ResearchInput<Name>,
  ): Promise<ResearchOutput<Name>>;
}

export interface HeroObservationInput {
  entityKind?: unknown;
  canonicalId?: unknown;
  familyId?: unknown;
  observedText?: unknown;
  displayName?: unknown;
  reviewRequired?: unknown;
  candidates?: unknown;
}

const MAX_NAME_SUGGESTIONS = 5;

/**
 * Observation chỉ có tên (thiếu canonicalId) được tra bằng lõi search của trang Tra cứu, chỉ nhận khớp đúng tên:
 * đúng một mục → gán canonicalId; tên bản thường của tộc còn bản 40Y/SP/CO, hoặc nhiều mục cùng tên → ambiguous
 * kèm mọi bản; không khớp đúng → unknown kèm tối đa 5 gợi ý khớp một phần, không có thì tên gần (`similarCatalog`). Agent gửi canonicalId, candidates
 * hay reviewRequired thì giữ nguyên. Chỉ tra trong ID mà snapshot nhận (searchEntries).
 */
export function withResolvedNames(ctx: ToolContext, observations: readonly HeroObservationInput[]): HeroObservationInput[] {
  const needsLookup = (observation: HeroObservationInput) =>
    (observation.entityKind === "hero" || observation.entityKind === "tactic") &&
    observation.canonicalId === undefined &&
    observation.reviewRequired === undefined &&
    observation.candidates === undefined &&
    typeof (observation.observedText ?? observation.displayName) === "string";
  if (!observations.some(needsLookup)) return [...observations];
  const pub = ctx.publication();
  const known = new Map<string, string>();
  const variantsByFamily = new Map<string, string[]>();
  for (const entry of ctx.index.searchEntries) {
    if (entry.kind !== "hero" && entry.kind !== "tactic") continue;
    known.set(entry.canonicalId, entry.displayName);
    if (entry.kind !== "hero") continue;
    const family = heroFamilyId(entry.displayName);
    variantsByFamily.set(family, [...(variantsByFamily.get(family) ?? []), entry.canonicalId]);
  }
  return observations.map((observation) => {
    if (!needsLookup(observation)) return observation;
    const kind = observation.entityKind as "hero" | "tactic";
    const name = String(observation.observedText ?? observation.displayName);
    const matches = pub
      .searchCatalog(name, { kinds: [kind], limit: 100 })
      .items.filter(({ entity }) => known.has(entity.id));
    const exact = [...new Set(matches.filter(({ score }) => score === 3).map(({ entity }) => entity.id))];
    if (exact.length === 0) {
      const near = matches.length > 0 ? matches : pub.similarCatalog(name, { kinds: [kind], limit: 100 }).filter(({ entity }) => known.has(entity.id));
      const candidates = [...new Set(near.map(({ entity }) => entity.id))].slice(0, MAX_NAME_SUGGESTIONS);
      return { ...observation, candidates };
    }
    if (exact.length > 1) return { ...observation, reviewRequired: true, candidates: exact.sort() };
    const canonicalId = exact[0]!;
    if (kind === "hero") {
      // Bản thường có canonicalId trùng slug của family (hero-identity); 40Y/SP/CO thì không.
      const family = heroFamilyId(known.get(canonicalId)!);
      const variants = variantsByFamily.get(family) ?? [];
      if (canonicalId.slice("hero:".length) === family.slice("hero-family:".length) && variants.length > 1) {
        return { ...observation, reviewRequired: true, candidates: [...variants].sort() };
      }
    }
    return { ...observation, canonicalId, displayName: observation.displayName ?? known.get(canonicalId) };
  });
}

/**
 * Agent biết `canonicalId` (từ tqccl_search) nhưng không biết `hero-family:`; family là dữ liệu của snapshot
 * nên server suy từ tên tướng trong heroes-dict. familyId gửi lên phải khớp, không tự sửa.
 */
export function withHeroFamilies(ctx: ToolContext, observations: readonly HeroObservationInput[]): HeroObservationInput[] {
  const heroNames = new Map<string, string>();
  for (const entry of ctx.index.searchEntries) {
    if (entry.kind === "hero") heroNames.set(entry.canonicalId, entry.displayName);
  }
  return observations.map((observation, index) => {
    if (observation.entityKind !== "hero" || typeof observation.canonicalId !== "string") return observation;
    const name = heroNames.get(observation.canonicalId);
    if (name === undefined) {
      throw new ResearchHandlerError("INVALID_REQUEST", PUBLIC_ERRORS.INVALID_REQUEST.message, false, [
        `observations[${index}].canonicalId`,
      ]);
    }
    const familyId = heroFamilyId(name);
    if (observation.familyId !== undefined && observation.familyId !== familyId) {
      throw new ResearchHandlerError("INVALID_REQUEST", PUBLIC_ERRORS.INVALID_REQUEST.message, false, [
        `observations[${index}].familyId`,
      ]);
    }
    return { ...observation, familyId };
  });
}

/** Schema cho phép tối đa 100 cảnh báo; vượt thì gộp theo loại để không vỡ output (300 mục có thể sinh > 600). */
const MAX_WARNING_DETAILS = 100;

/**
 * Vượt 100 cảnh báo: giữ chi tiết của `100 − số loại` cảnh báo đầu, cuối danh sách thêm một dòng đếm mỗi loại dạng
 * `summary:<loại>:<n>` (n = tổng số cảnh báo loại đó, kể cả phần đã hiển thị). Không đổi khi ≤ 100.
 */
export function summarizeWarnings(warnings: readonly string[]): string[] {
  if (warnings.length <= MAX_WARNING_DETAILS) return [...warnings];
  const counts = new Map<string, number>();
  for (const warning of warnings) {
    const kind = warning.split(":", 1)[0]!;
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  const summaries = [...counts].map(([kind, count]) => `summary:${kind}:${count}`);
  return [...warnings.slice(0, Math.max(0, MAX_WARNING_DETAILS - summaries.length)), ...summaries].slice(0, MAX_WARNING_DETAILS);
}

/**
 * Hình chiếu gọn của kết quả domain (#165): digest/thuật toán không đổi vì digest chỉ dùng canonicalId, familyId,
 * redStars, level, tactic id, lockedTeams và số `unresolved`. `unresolved` là nguồn duy nhất cho mục cần rà soát
 * (không còn `observedText`/`evidence`: client biết text mình gửi qua `observationId`); `resolvedIds` (theo vị trí
 * của observations đầu vào) cho canonicalId server tra tên. `manual: true` giữ dấu manualCorrection; tên lấy từ catalog ở recommend.
 */
export function compactNormalizeResult(
  normalized: NormalizationResult,
  prepared: readonly HeroObservationInput[],
  lookedUp: readonly boolean[],
) {
  const state = normalized.canonicalState;
  const warnings = summarizeWarnings(normalized.warnings);
  const unresolved = (state.unresolved ?? []).map((entry) => {
    const { observationId, entityKind, reason, candidates, trust } = entry as Record<string, unknown>;
    // Identity conflict dồn mọi canonicalId của các observation trùng id: loại trùng để vừa `max(20)` của schema.
    return { observationId, entityKind, reason, candidates: [...new Set(candidates as unknown[])], trust };
  });
  const finalIds = new Set<string>([
    ...state.heroes.map(({ canonicalId }) => canonicalId as string),
    ...state.tactics.map(({ canonicalId }) => canonicalId as string),
    ...state.lockedTeams.map(({ teamId }) => teamId as string),
  ]);
  const unresolvedIds = new Set(unresolved.map(({ observationId }) => observationId));
  // Positional: phần tử i = canonicalId server tra tên cho observation i. null nếu client đã gửi canonicalId, mục chưa
  // rõ, bị thay/xung đột (canonicalId không còn trong state cuối, hoặc observationId nằm trong unresolved).
  const resolvedIds = prepared.map((observation, index) => {
    const canonicalId = observation.canonicalId;
    if (!lookedUp[index] || typeof canonicalId !== "string") return null;
    if (!finalIds.has(canonicalId) || unresolvedIds.has(String((observation as { observationId?: unknown }).observationId))) return null;
    return canonicalId;
  });
  return {
    canonicalState: {
      ...(state.seasonContext === undefined ? {} : { seasonContext: state.seasonContext }),
      heroes: state.heroes.map((hero) => ({
        canonicalId: hero.canonicalId,
        familyId: hero.familyId,
        ...(hero.redStars === undefined ? {} : { redStars: hero.redStars }),
        ...(hero.level === undefined ? {} : { level: hero.level }),
        ...(hero.confidence === "manual" ? { manual: true as const } : {}),
      })),
      tactics: state.tactics.map((tactic) => ({
        canonicalId: tactic.canonicalId,
        ...(tactic.confidence === "manual" ? { manual: true as const } : {}),
      })),
      unresolved,
      lockedTeams: state.lockedTeams,
      ...(state.warnings === undefined ? {} : { warnings: summarizeWarnings(state.warnings) }),
    },
    resolvedIds,
    reviewRequired: normalized.reviewRequired,
    warnings,
    confirmationBinding: normalized.confirmationBinding,
  };
}

async function handleNormalize(ctx: ToolContext, rawInput: unknown): Promise<unknown> {
  const input = parseToolInput(RESEARCH_CONTRACTS.tqccl_normalize_entities.input as ZodType<Record<string, unknown>>, rawInput);
  ctx.ensureExpectedWorkflow(input.expectedWorkflowVersion as string | undefined);
  const seasonContext = input.seasonContext as { scenarioId: string; rulesetId: string } | undefined;
  if (seasonContext) {
    const model = ctx.snapshot.seasonModel;
    if (!model || !resolveSeasonContext(model, seasonContext).ok) {
      throw new ResearchHandlerError("SEASON_CONTEXT_INVALID", PUBLIC_ERRORS.SEASON_CONTEXT_INVALID.message);
    }
  }
  const submitted = input.observations as HeroObservationInput[];
  const prepared = withHeroFamilies(ctx, withResolvedNames(ctx, submitted));
  const normalized = await normalizeObservations({
    workflowVersion: ctx.workflowVersion,
    observations: prepared as never,
    ...(seasonContext ? { seasonContext } : {}),
  });
  const compact = compactNormalizeResult(
    normalized,
    prepared,
    submitted.map((observation) => observation.canonicalId === undefined),
  );
  return {
    ...ctx.commonResult([
      { artifact: "canonical-state", recordId: normalized.confirmationBinding.normalizationDigest, trust: "untrusted" },
    ]),
    ...compact,
    ...(seasonContext ? { seasonContext } : {}),
  };
}

const HANDLERS: Record<ResearchToolName, (ctx: ToolContext, input: unknown) => Promise<unknown>> = {
  tqccl_get_playbook: handleGetPlaybook,
  tqccl_search: handleSearch,
  tqccl_get_entity: handleGetEntity,
  tqccl_find_teams: handleFindTeams,
  tqccl_get_team: handleGetTeam,
  tqccl_normalize_entities: handleNormalize,
  tqccl_recommend_teams: handleRecommendTeams,
};

export function createResearchHandlers(
  dependencies: ResearchHandlerDependencies,
): ResearchHandlers {
  let indexedRelease: string | null = null;
  let index: SnapshotIndex | null = null;

  async function context(): Promise<ToolContext> {
    let snapshot: DataSnapshot;
    try {
      snapshot = await publicSnapshotView(await dependencies.dataSource.load());
    } catch {
      throw new ResearchHandlerError("DATA_UNAVAILABLE", PUBLIC_ERRORS.DATA_UNAVAILABLE.message, true);
    }
    if (index === null || indexedRelease !== snapshot.releaseId) {
      index = buildSnapshotIndex(snapshot);
      indexedRelease = snapshot.releaseId;
    }
    return createToolContext(snapshot, index, createWorkflowVersion(snapshot.releaseId, WORKFLOW_BUILD_ID));
  }

  async function execute(name: ResearchToolName, rawInput: unknown): Promise<unknown> {
    const result = await HANDLERS[name](await context(), rawInput);
    enforceResultSize(result);
    try {
      return (RESEARCH_CONTRACTS[name].output as ZodType<unknown>).parse(result);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ResearchHandlerError("INTERNAL_ERROR", PUBLIC_ERRORS.INTERNAL_ERROR.message);
      }
      throw error;
    }
  }

  return {
    async call<Name extends ResearchToolName>(
      name: Name,
      input: ResearchInput<Name>,
    ): Promise<ResearchOutput<Name>> {
      try {
        return (await execute(name, input)) as ResearchOutput<Name>;
      } catch (error) {
        if (error instanceof ResearchHandlerError) throw error;
        throw new ResearchHandlerError("INTERNAL_ERROR", PUBLIC_ERRORS.INTERNAL_ERROR.message);
      }
    },
  };
}
