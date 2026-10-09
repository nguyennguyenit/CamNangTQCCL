import { ZodError, type ZodType } from "zod";

import { heroFamilyId } from "../../../js/hero-identity.js";
import { resolveSeasonContext } from "../../../js/season-context.js";
import { publicSnapshotView } from "../data/public-snapshot-view.js";
import { buildSnapshotIndex, type SnapshotIndex } from "../data/snapshot-index.js";
import type { DataSnapshot } from "../data/artifact-contracts.js";
import type { DataSource } from "../data/data-source.js";
import { createWorkflowVersion } from "../domain/canonical-state.js";
import { normalizeObservations } from "../domain/normalization-service.js";
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

interface HeroObservationInput {
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
 * kèm mọi bản; không khớp đúng → unknown kèm tối đa 5 gợi ý khớp một phần. Agent gửi canonicalId, candidates
 * hay reviewRequired thì giữ nguyên. Chỉ tra trong ID mà snapshot nhận (searchEntries).
 */
function withResolvedNames(ctx: ToolContext, observations: readonly HeroObservationInput[]): HeroObservationInput[] {
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
      const candidates = [...new Set(matches.map(({ entity }) => entity.id))].slice(0, MAX_NAME_SUGGESTIONS);
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
function withHeroFamilies(ctx: ToolContext, observations: readonly HeroObservationInput[]): HeroObservationInput[] {
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
  const normalized = await normalizeObservations({
    workflowVersion: ctx.workflowVersion,
    observations: withHeroFamilies(ctx, withResolvedNames(ctx, input.observations as HeroObservationInput[])) as never,
    ...(seasonContext ? { seasonContext } : {}),
  });
  return {
    ...ctx.commonResult([{ artifact: "canonical-state", recordId: normalized.confirmationBinding.normalizationDigest }]),
    ...normalized,
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
