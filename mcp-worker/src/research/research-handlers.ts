import { ZodError, type ZodType } from "zod";

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

async function handleNormalize(ctx: ToolContext, rawInput: unknown): Promise<unknown> {
  const input = parseToolInput(RESEARCH_CONTRACTS.tqccl_normalize_entities.input as ZodType<Record<string, unknown>>, rawInput);
  const seasonContext = input.seasonContext as { scenarioId: string; rulesetId: string } | undefined;
  if (seasonContext) {
    const model = ctx.snapshot.seasonModel;
    if (!model || !resolveSeasonContext(model, seasonContext).ok) {
      throw new ResearchHandlerError("SEASON_CONTEXT_INVALID", PUBLIC_ERRORS.SEASON_CONTEXT_INVALID.message);
    }
  }
  const normalized = await normalizeObservations({
    workflowVersion: ctx.workflowVersion,
    observations: input.observations as never,
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
