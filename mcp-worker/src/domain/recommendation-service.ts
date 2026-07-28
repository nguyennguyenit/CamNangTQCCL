import {
  verifyConfirmationBinding,
  type CanonicalState,
} from "./canonical-state.js";
import type {
  ConfirmationBinding,
  WorkflowVersion,
} from "./contracts.js";
import { legacyDomainAdapter } from "./legacy-domain-adapter.js";

type ArtifactRecord = Record<string, unknown>;
const MAX_CORPUS_TEXT = 256;

function boundedText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f-\u009f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, MAX_CORPUS_TEXT);
}

function boundedJson(value: unknown, depth = 0): unknown {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") return boundedText(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (depth >= 5) return null;
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => boundedJson(item, depth + 1));
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as ArtifactRecord)
        .slice(0, 100)
        .map(([key, nested]) => [key, boundedJson(nested, depth + 1)]),
    );
  }
  return null;
}

function boundedRecords(
  records: readonly ArtifactRecord[],
  limit: number,
): ArtifactRecord[] {
  return records
    .slice(0, limit)
    .map((record) => boundedJson(record) as ArtifactRecord);
}

export interface DomainSnapshot {
  releaseId: string;
  dataVersion: string;
  teams: readonly ArtifactRecord[];
  teamTier: readonly ArtifactRecord[];
  coexist?: readonly ArtifactRecord[];
}

interface RecommendationServiceRequest {
  snapshot: DomainSnapshot;
  canonicalState: CanonicalState;
  confirmationBinding: ConfirmationBinding;
  expectedWorkflowVersion: WorkflowVersion | string;
  workflowVersion: WorkflowVersion | string;
  maxTeams?: number;
  experimentalUntiered?: boolean;
}

interface ReplacementRequest extends RecommendationServiceRequest {
  teamId: string;
  tacticName: string;
}

export class DomainServiceError extends Error {
  constructor(
    readonly code:
      | "WORKFLOW_VERSION_MISMATCH"
      | "CONFIRMATION_REQUIRED"
      | "TEAM_NOT_FOUND"
      | "TACTIC_NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "DomainServiceError";
  }
}

async function assertConfirmed(
  request: RecommendationServiceRequest,
): Promise<void> {
  if (request.expectedWorkflowVersion !== request.workflowVersion) {
    throw new DomainServiceError(
      "WORKFLOW_VERSION_MISMATCH",
      "Phiên bản quy trình dự kiến không khớp với dữ liệu hiện tại.",
    );
  }
  if ((request.canonicalState.unresolved?.length ?? 0) > 0) {
    throw new DomainServiceError(
      "CONFIRMATION_REQUIRED",
      "Vẫn còn thực thể chưa được phân giải và cần xác nhận.",
    );
  }
  if (
    !(await verifyConfirmationBinding(
      request.confirmationBinding,
      request.canonicalState,
      request.workflowVersion,
    ))
  ) {
    throw new DomainServiceError(
      "CONFIRMATION_REQUIRED",
      "Trạng thái chuẩn hóa đã thay đổi và cần được xác nhận lại.",
    );
  }
}

function engineRequest(request: RecommendationServiceRequest): ArtifactRecord {
  const requestedMax = Number.isInteger(request.maxTeams) ? request.maxTeams! : 5;
  return {
    teams: boundedRecords(request.snapshot.teams, 500),
    teamTier: boundedRecords(request.snapshot.teamTier, 1_000),
    ownedHeroes: request.canonicalState.heroes.slice(0, 500).map((hero) => ({
      name: hero.displayName,
      canonicalId: hero.canonicalId,
      ...(hero.redStars === undefined ? {} : { redStars: hero.redStars }),
    })),
    ownedTactics: request.canonicalState.tactics.slice(0, 1_000).map((tactic) => ({
      name: tactic.displayName,
      canonicalId: tactic.canonicalId,
    })),
    lockedTeams: request.canonicalState.lockedTeams.slice(0, 10).map((team) => ({
      teamId: team.teamId,
      teamName: team.teamId,
      heroes: [...team.heroIds],
      tactics: [...team.tacticIds],
      tacticAssignments: team.tacticAssignments?.map((assignment) => ({
        holderId: assignment.holderId,
        tacticId: assignment.tacticId,
        ...(assignment.slotIndex === undefined
          ? {}
          : { slotIndex: assignment.slotIndex }),
      })),
    })),
    maxTeams: Math.max(1, Math.min(10, requestedMax)),
    mode: "meta",
    experimentalUntiered: request.experimentalUntiered === true,
  };
}

function baseResult(
  request: RecommendationServiceRequest,
  teams: ReadonlyArray<
    ArtifactRecord & {
      team: ArtifactRecord;
      tierRankings: readonly ArtifactRecord[];
    }
  >,
) {
  const projectedTeams = teams.map((entry) => {
    const teamId = boundedText(entry.team.id);
    const tierRankings = entry.tierRankings.slice(0, 20).map((ranking) => ({
      tier: boundedText(ranking.tier),
      source: boundedText(ranking.source),
      updatedAt: boundedText(ranking.updatedAt),
      trust: "untrusted" as const,
    }));
    return {
      team: {
        id: teamId,
        name: boundedText(entry.team.name),
        source: boundedText(entry.team.source),
        trust: "untrusted" as const,
      },
      tier: boundedText(entry.tier),
      tierRankings,
      status: boundedText(entry.status),
      heroAssignments: boundedJson(entry.heroAssignments),
      selectedTactics: boundedJson(entry.selectedTactics),
      tacticSelections: boundedJson(entry.tacticSelections),
      usedAlternatives: boundedJson(entry.usedAlternatives),
      experimentalUntiered: entry.experimentalUntiered === true,
      provenance: {
        artifact: entry.locked ? "canonical-state" : "teams.json",
        recordId: teamId,
        tierRankings,
      },
    };
  });
  return {
    releaseId: request.snapshot.releaseId,
    dataVersion: request.snapshot.dataVersion,
    workflowVersion: request.workflowVersion,
    teams: projectedTeams,
  };
}

export async function recommendTeam(request: RecommendationServiceRequest) {
  await assertConfirmed(request);
  const recommendation = legacyDomainAdapter.recommendTeams(engineRequest(request));
  return {
    ...baseResult(request, recommendation.portfolioTeams),
    diagnostics: boundedJson(recommendation.diagnostics),
    warnings: [] as string[],
  };
}

export async function recommendCoexist(request: RecommendationServiceRequest) {
  await assertConfirmed(request);
  const recommendation = legacyDomainAdapter.recommendTeams(engineRequest(request));
  return {
    ...baseResult(request, recommendation.portfolioTeams),
    coexistReference: [...(request.snapshot.coexist ?? [])]
      .slice(0, 50)
      .map((entry) => ({
        ...(entry.id === undefined ? {} : { id: boundedText(entry.id) }),
        ...(entry.displayName === undefined
          ? {}
          : { displayName: boundedText(entry.displayName) }),
        ...(entry.name === undefined ? {} : { name: boundedText(entry.name) }),
        ...(entry.note === undefined ? {} : { note: boundedText(entry.note) }),
        trust: "untrusted" as const,
      })),
    diagnostics: boundedJson(recommendation.diagnostics),
    warnings: ["coexist-reference-not-scored"],
  };
}

function teamTacticSlots(team: ArtifactRecord): ArtifactRecord[] {
  const heroes = Array.isArray(team.heroes) ? team.heroes : [];
  return heroes.flatMap((hero) => {
    if (typeof hero !== "object" || hero === null || Array.isArray(hero)) return [];
    const tactics = (hero as ArtifactRecord).tactics;
    return Array.isArray(tactics)
      ? tactics.filter(
          (tactic): tactic is ArtifactRecord =>
            typeof tactic === "object" && tactic !== null && !Array.isArray(tactic),
        )
      : [];
  });
}

export async function suggestReplacements(request: ReplacementRequest) {
  await assertConfirmed(request);
  const team = request.snapshot.teams.find(
    (candidate) => candidate.id === request.teamId,
  );
  if (!team) {
    throw new DomainServiceError("TEAM_NOT_FOUND", "Không tìm thấy đội hình.");
  }
  const tactic = teamTacticSlots(team).find(
    (candidate) => candidate.name === request.tacticName,
  );
  if (!tactic) {
    throw new DomainServiceError("TACTIC_NOT_FOUND", "Không tìm thấy chiến pháp.");
  }
  const replacements = Array.isArray(tactic.alternatives)
    ? tactic.alternatives.filter(
        (candidate): candidate is string => typeof candidate === "string",
      )
    : [];
  return {
    releaseId: request.snapshot.releaseId,
    dataVersion: request.snapshot.dataVersion,
    workflowVersion: request.workflowVersion,
    teamId: request.teamId,
    tacticName: boundedText(request.tacticName),
    replacements: replacements.slice(0, 20).map(boundedText),
    warnings: ["mechanics-not-evaluated"],
  };
}
