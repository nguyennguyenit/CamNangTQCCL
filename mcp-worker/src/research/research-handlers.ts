import { ZodError, type ZodType } from "zod";

import { createWorkflowVersion, type CanonicalState } from "../domain/canonical-state.js";
import { legacyDomainAdapter } from "../domain/legacy-domain-adapter.js";
import { normalizeObservations } from "../domain/normalization-service.js";
import {
  DomainServiceError,
  recommendCoexist,
  recommendTeam,
  suggestReplacements,
} from "../domain/recommendation-service.js";
import type { WorkflowVersion } from "../domain/contracts.js";
import { WORKFLOW_BUILD_ID } from "../generated/workflow-build.js";
import type { DataSnapshot } from "../data/artifact-contracts.js";
import type { DataSource } from "../data/data-source.js";
import {
  invalidRequestFields,
  withFieldNames,
} from "./validation-fields.js";
import {
  buildSnapshotIndex,
  type SearchKind,
  type SnapshotIndex,
} from "../data/snapshot-index.js";
import {
  RESEARCH_CONTRACTS,
  type ResearchInput,
  type ResearchOutput,
  type ResearchToolName,
} from "./research-contracts.js";

const MAX_RESULT_BYTES = 64 * 1024;

export class ResearchHandlerError extends Error {
  constructor(
    readonly code:
      | "INVALID_REQUEST"
      | "DATA_UNAVAILABLE"
      | "WORKFLOW_VERSION_CHANGED"
      | "CONFIRMATION_REQUIRED"
      | "CURSOR_INVALID"
      | "TEAM_NOT_FOUND"
      | "TACTIC_NOT_FOUND"
      | "RESULT_TOO_LARGE"
      | "INTERNAL_ERROR",
    message: string,
    readonly retryable = false,
    /**
     * Đường dẫn các field vi phạm, để agent tự sửa request thay vì bỏ cuộc.
     * Chỉ tên field — không bao giờ chứa giá trị người dùng gửi lên, vì lỗi này
     * đi thẳng vào context LLM và vào trace.
     */
    readonly fields: readonly string[] = [],
  ) {
    super(message);
    this.name = "ResearchHandlerError";
  }
}

export interface ResearchHandlerDependencies {
  dataSource: DataSource;
}

export interface ResearchHandlers {
  call<Name extends ResearchToolName>(
    name: Name,
    input: ResearchInput<Name>,
  ): Promise<ResearchOutput<Name>>;
}

interface RequestContext {
  snapshot: DataSnapshot;
  workflowVersion: WorkflowVersion;
  index: SnapshotIndex;
}

interface CursorPayload {
  v: string;
  q: string;
  o: number;
}

function publicMessage(code: ResearchHandlerError["code"]): string {
  const messages: Record<ResearchHandlerError["code"], string> = {
    INVALID_REQUEST: "Yêu cầu không hợp lệ.",
    DATA_UNAVAILABLE: "Dữ liệu nghiên cứu hiện không khả dụng.",
    WORKFLOW_VERSION_CHANGED: "Phiên bản dữ liệu hoặc quy trình đã thay đổi.",
    CONFIRMATION_REQUIRED: "Trạng thái canonical cần được xác nhận lại.",
    CURSOR_INVALID: "Cursor không hợp lệ cho truy vấn hiện tại.",
    TEAM_NOT_FOUND: "Không tìm thấy đội hình.",
    TACTIC_NOT_FOUND: "Không tìm thấy chiến pháp.",
    RESULT_TOO_LARGE: "Kết quả vượt giới hạn cho phép.",
    INTERNAL_ERROR: "Không thể hoàn tất yêu cầu.",
  };
  return messages[code];
}

interface ProjectionState {
  truncated: boolean;
  remainingNodes?: number;
}

function boundedJson(
  value: unknown,
  state: ProjectionState,
  depth = 0,
): unknown {
  state.remainingNodes ??= 180;
  state.remainingNodes -= 1;
  if (state.remainingNodes < 0) {
    state.truncated = true;
    return null;
  }
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const normalized = value
      .normalize("NFC")
      .replace(/[\u0000-\u001f\u007f-\u009f]/gu, " ")
      .replace(/\s+/gu, " ")
      .trim();
    if (normalized.length > 256) state.truncated = true;
    return normalized.slice(0, 256);
  }
  if (depth >= 8) {
    state.truncated = true;
    return null;
  }
  if (Array.isArray(value)) {
    if (value.length > 100) state.truncated = true;
    return value
      .slice(0, 100)
      .map((item) => boundedJson(item, state, depth + 1));
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > 100) state.truncated = true;
    return Object.fromEntries(
      entries
        .slice(0, 100)
        .map(([key, nested]) => [key, boundedJson(nested, state, depth + 1)]),
    );
  }
  return null;
}

function enforceResultSize(value: unknown): void {
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > MAX_RESULT_BYTES) {
    throw new ResearchHandlerError(
      "RESULT_TOO_LARGE",
      publicMessage("RESULT_TOO_LARGE"),
    );
  }
}

function fitResultSize(
  value: Record<string, unknown>,
  truncatableFields: readonly string[],
): Record<string, unknown> {
  const fitted = { ...value };
  for (const field of truncatableFields) {
    if (Array.isArray(fitted[field])) {
      fitted[field] = [...fitted[field]];
    }
  }
  while (
    new TextEncoder().encode(JSON.stringify(fitted)).byteLength >
    MAX_RESULT_BYTES
  ) {
    const field = truncatableFields.find(
      (candidate) =>
        Array.isArray(fitted[candidate]) &&
        (fitted[candidate] as unknown[]).length > 0,
    );
    if (field === undefined) {
      enforceResultSize(fitted);
      return fitted;
    }
    (fitted[field] as unknown[]).pop();
    fitted.truncated = true;
  }
  return fitted;
}

async function fingerprint(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes as Uint8Array<ArrayBuffer>,
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function encodeCursor(payload: CursorPayload): string {
  return btoa(JSON.stringify(payload));
}

function decodeCursor(value: string): CursorPayload {
  try {
    const parsed = JSON.parse(atob(value)) as Record<string, unknown>;
    if (
      typeof parsed.v !== "string" ||
      typeof parsed.q !== "string" ||
      !Number.isSafeInteger(parsed.o) ||
      (parsed.o as number) < 0
    ) {
      throw new Error("invalid");
    }
    return { v: parsed.v, q: parsed.q, o: parsed.o as number };
  } catch {
    throw new ResearchHandlerError(
      "CURSOR_INVALID",
      publicMessage("CURSOR_INVALID"),
    );
  }
}

function commonResult(
  context: RequestContext,
  provenance: Array<Record<string, unknown>> = [],
) {
  return {
    releaseId: context.snapshot.releaseId,
    dataVersion: context.snapshot.dataVersion,
    workflowVersion: context.workflowVersion,
    provenance,
    warnings: [...context.snapshot.warnings],
    truncated: false,
  };
}

function ensureExpectedWorkflow(
  expected: string | undefined,
  actual: string,
): void {
  if (expected !== undefined && expected !== actual) {
    throw new ResearchHandlerError(
      "WORKFLOW_VERSION_CHANGED",
      publicMessage("WORKFLOW_VERSION_CHANGED"),
      true,
    );
  }
}

function publicTeamSnapshot(snapshot: DataSnapshot): DataSnapshot {
  const teams = snapshot.artifacts.teams.filter(
    (team) => team.source !== "do-uy",
  );
  if (teams.length === snapshot.artifacts.teams.length) return snapshot;

  const visibleTeamIds = new Set(teams.map((team) => team.id));
  return {
    ...snapshot,
    artifacts: {
      ...snapshot.artifacts,
      teams,
      "team-tier": snapshot.artifacts["team-tier"].filter((row) =>
        visibleTeamIds.has(row.teamId),
      ),
    },
  };
}

function domainSnapshot(snapshot: DataSnapshot) {
  return {
    releaseId: snapshot.releaseId,
    dataVersion: snapshot.dataVersion,
    teams: snapshot.artifacts.teams,
    teamTier: snapshot.artifacts["team-tier"],
    coexist: snapshot.artifacts.coexist,
  };
}

function mapDomainError(error: unknown): never {
  if (error instanceof ResearchHandlerError) throw error;
  if (error instanceof DomainServiceError) {
    const code =
      error.code === "WORKFLOW_VERSION_MISMATCH"
        ? "WORKFLOW_VERSION_CHANGED"
        : error.code;
    throw new ResearchHandlerError(
      code,
      publicMessage(code),
      code === "WORKFLOW_VERSION_CHANGED",
    );
  }
  throw new ResearchHandlerError("INTERNAL_ERROR", publicMessage("INTERNAL_ERROR"));
}

export function createResearchHandlers(
  dependencies: ResearchHandlerDependencies,
): ResearchHandlers {
  let indexedRelease: string | null = null;
  let index: SnapshotIndex | null = null;

  async function context(): Promise<RequestContext> {
    let snapshot: DataSnapshot;
    try {
      snapshot = publicTeamSnapshot(await dependencies.dataSource.load());
    } catch {
      throw new ResearchHandlerError(
        "DATA_UNAVAILABLE",
        publicMessage("DATA_UNAVAILABLE"),
        true,
      );
    }
    if (index === null || indexedRelease !== snapshot.releaseId) {
      index = buildSnapshotIndex(snapshot);
      indexedRelease = snapshot.releaseId;
    }
    return {
      snapshot,
      workflowVersion: createWorkflowVersion(
        snapshot.releaseId,
        WORKFLOW_BUILD_ID,
      ),
      index,
    };
  }

  async function execute(
    name: ResearchToolName,
    rawInput: unknown,
  ): Promise<unknown> {
    let input: Record<string, unknown>;
    try {
      input = (
        RESEARCH_CONTRACTS[name].input as ZodType<Record<string, unknown>>
      ).parse(rawInput);
    } catch (error) {
      if (error instanceof ZodError) {
        const fields = invalidRequestFields(error);
        throw new ResearchHandlerError(
          "INVALID_REQUEST",
          withFieldNames(publicMessage("INVALID_REQUEST"), fields),
          false,
          fields,
        );
      }
      throw error;
    }
    const request = await context();
    let result: unknown;

    if (name === "tqccl_get_data_version") {
      result = {
        ...commonResult(request),
        artifacts: request.snapshot.manifest.artifacts.map((descriptor) => ({
          ...descriptor,
        })),
      };
    } else if (name === "tqccl_normalize_entities") {
      const normalized = await normalizeObservations({
        workflowVersion: request.workflowVersion,
        observations: input.observations as never,
      });
      result = {
        ...commonResult(request, [
          {
            artifact: "canonical-state",
            recordId: normalized.confirmationBinding.normalizationDigest,
          },
        ]),
        ...normalized,
      };
    } else if (name === "tqccl_search") {
      const query = input.query as string;
      const kinds = input.kinds as SearchKind[] | undefined;
      const limit = (input.limit as number | undefined) ?? 20;
      const queryIdentity = await fingerprint({ query, kinds: kinds ?? [] });
      let offset = 0;
      if (typeof input.cursor === "string") {
        const cursor = decodeCursor(input.cursor);
        if (
          cursor.v !== request.workflowVersion ||
          input.expectedWorkflowVersion !== request.workflowVersion
        ) {
          throw new ResearchHandlerError(
            "WORKFLOW_VERSION_CHANGED",
            publicMessage("WORKFLOW_VERSION_CHANGED"),
            true,
          );
        }
        if (cursor.q !== queryIdentity) {
          throw new ResearchHandlerError(
            "CURSOR_INVALID",
            publicMessage("CURSOR_INVALID"),
          );
        }
        offset = cursor.o;
      } else {
        ensureExpectedWorkflow(
          input.expectedWorkflowVersion as string | undefined,
          request.workflowVersion,
        );
      }
      const entries = request.index.search(query, {
        ...(kinds === undefined ? {} : { kinds }),
        limit: limit + 1,
        offset,
      });
      const truncated = entries.length > limit;
      const items = entries.slice(0, limit).map((entry) => ({
        kind: entry.kind,
        canonicalId: entry.canonicalId,
        recordId: entry.recordId,
        displayName: entry.displayName,
        ...(entry.matchedTerm === undefined
          ? {}
          : { matchedTerm: entry.matchedTerm }),
        artifact: entry.artifact,
        trust: "untrusted" as const,
      }));
      result = {
        ...commonResult(
          request,
          [...new Set(items.map(({ artifact }) => artifact))].map(
            (artifact) => ({ artifact, trust: "untrusted" }),
          ),
        ),
        items,
        truncated,
        ...(truncated
          ? {
              nextCursor: encodeCursor({
                v: request.workflowVersion,
                q: queryIdentity,
                o: offset + limit,
              }),
            }
          : {}),
      };
    } else if (name === "tqccl_get_team") {
      ensureExpectedWorkflow(
        input.expectedWorkflowVersion as string | undefined,
        request.workflowVersion,
      );
      const requestedId = input.teamId as string;
      const teamId = requestedId.startsWith("team:")
        ? requestedId.slice("team:".length)
        : requestedId;
      const team = request.index.teamsById.get(teamId);
      if (!team) {
        throw new ResearchHandlerError(
          "TEAM_NOT_FOUND",
          publicMessage("TEAM_NOT_FOUND"),
        );
      }
      const projectionState = { truncated: false };
      const projected = boundedJson(team, projectionState) as Record<
        string,
        unknown
      >;
      projected.trust = "untrusted";
      const tierRankings = (request.index.tierByTeam.get(teamId) ?? [])
        .slice(0, 20)
        .map((ranking): Record<string, unknown> => {
          const projectedRanking = boundedJson(
            ranking,
            projectionState,
          ) as Record<string, unknown>;
          return { ...projectedRanking, trust: "untrusted" };
        });
      result = {
        ...commonResult(request, [
          {
            artifact: "teams",
            recordId: teamId,
            trust: "untrusted",
          },
          ...tierRankings.map((ranking) => ({
            artifact: "team-tier",
            recordId: teamId,
            ...(typeof ranking.source === "string"
              ? { source: ranking.source }
              : {}),
            ...(typeof ranking.updatedAt === "string"
              ? { updatedAt: ranking.updatedAt }
              : {}),
            trust: "untrusted",
          })),
        ]),
        team: projected,
        tierRankings,
        truncated: projectionState.truncated,
      };
    } else if (name === "tqccl_match_team") {
      ensureExpectedWorkflow(
        input.expectedWorkflowVersion as string | undefined,
        request.workflowVersion,
      );
      const mapped = (
        input.heroes as Array<{ canonicalId: string; tacticIds: string[] }>
      ).map((hero) => ({
        hero: {
          matched: true,
          canonicalId: hero.canonicalId,
          reviewRequired: false,
        },
        tactics: hero.tacticIds.map((canonicalId) => ({
          matched: true,
          canonicalId,
          reviewRequired: false,
        })),
      }));
      const matches = legacyDomainAdapter.findSimilarTeams(
        mapped,
        request.snapshot.artifacts.teams,
        {
          minHeroes: (input.minHeroes as number | undefined) ?? 2,
          limit: (input.limit as number | undefined) ?? 5,
        },
      );
      result = {
        ...commonResult(request, [
          { artifact: "teams", trust: "untrusted" },
        ]),
        matches: matches.map((match) => {
          const team = match.team as Record<string, unknown>;
          return {
            team: {
              id: team.id,
              name: team.name,
              trust: "untrusted",
            },
            heroHit: match.heroHit,
            tacticHit: match.tacticHit,
            total: match.total,
          };
        }),
      };
    } else {
      const expectedWorkflowVersion = input.expectedWorkflowVersion as string;
      ensureExpectedWorkflow(
        expectedWorkflowVersion,
        request.workflowVersion,
      );
      const serviceRequest = {
        snapshot: domainSnapshot(request.snapshot),
        canonicalState: input.canonicalState as unknown as CanonicalState,
        confirmationBinding: input.confirmationBinding as never,
        expectedWorkflowVersion,
        workflowVersion: request.workflowVersion,
        ...(input.maxTeams === undefined
          ? {}
          : { maxTeams: input.maxTeams as number }),
        ...(input.experimentalUntiered === undefined
          ? {}
          : { experimentalUntiered: input.experimentalUntiered as boolean }),
      };
      try {
        if (name === "tqccl_recommend_team") {
          const recommendation = await recommendTeam(serviceRequest);
          const projectionState = { truncated: false };
          result = fitResultSize({
            ...commonResult(request, [
              { artifact: "teams", trust: "untrusted" },
              { artifact: "team-tier", trust: "untrusted" },
              { artifact: "canonical-state" },
            ]),
            teams: boundedJson(recommendation.teams, projectionState),
            diagnostics: boundedJson(
              recommendation.diagnostics,
              projectionState,
            ),
            warnings: [
              ...request.snapshot.warnings,
              ...recommendation.warnings,
            ],
            truncated: projectionState.truncated,
          }, ["teams"]);
        } else if (name === "tqccl_recommend_coexist") {
          const recommendation = await recommendCoexist(serviceRequest);
          const projectionState = { truncated: false };
          result = fitResultSize({
            ...commonResult(request, [
              { artifact: "teams", trust: "untrusted" },
              { artifact: "team-tier", trust: "untrusted" },
              { artifact: "coexist", trust: "untrusted" },
              { artifact: "canonical-state" },
            ]),
            teams: boundedJson(recommendation.teams, projectionState),
            coexistReference: boundedJson(
              recommendation.coexistReference,
              projectionState,
            ),
            diagnostics: boundedJson(
              recommendation.diagnostics,
              projectionState,
            ),
            warnings: [
              ...request.snapshot.warnings,
              ...recommendation.warnings,
            ],
            truncated: projectionState.truncated,
          }, ["coexistReference", "teams"]);
        } else {
          const replacement = await suggestReplacements({
            ...serviceRequest,
            teamId: input.teamId as string,
            tacticName: input.tacticName as string,
          });
          result = {
            ...commonResult(request, [
              {
                artifact: "teams",
                recordId: input.teamId as string,
                trust: "untrusted",
              },
              { artifact: "canonical-state" },
            ]),
            teamId: replacement.teamId,
            tacticName: replacement.tacticName,
            replacements: replacement.replacements,
            warnings: [
              ...request.snapshot.warnings,
              ...replacement.warnings,
            ],
          };
        }
      } catch (error) {
        mapDomainError(error);
      }
    }

    enforceResultSize(result);
    try {
      return (
        RESEARCH_CONTRACTS[name].output as ZodType<unknown>
      ).parse(result);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ResearchHandlerError(
          "INTERNAL_ERROR",
          publicMessage("INTERNAL_ERROR"),
        );
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
        mapDomainError(error);
      }
    },
  };
}
