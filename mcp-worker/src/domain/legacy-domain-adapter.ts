import { findSimilarTeams } from "../../../js/analyze-map.js";
import { recommendTeams } from "../../../js/team-recommend-engine.js";

type LegacyRecord = Record<string, unknown>;

export interface LegacyRecommendationEntry extends LegacyRecord {
  team: LegacyRecord;
  tierRankings: LegacyRecord[];
  selectedTactics: string[];
  tacticSelections: LegacyRecord[];
}

export interface LegacyRecommendationResult extends LegacyRecord {
  portfolioTeams: LegacyRecommendationEntry[];
}

export class LegacyDomainAdapterError extends Error {
  readonly code = "LEGACY_DOMAIN_FAILURE";

  constructor(readonly operation: string) {
    super(`Legacy domain operation failed: ${operation}`);
    this.name = "LegacyDomainAdapterError";
  }
}

function cloneInput<T>(value: T): T {
  return structuredClone(value);
}

type ResultValidator<T> = (value: unknown) => T;

function safeResult<T>(
  operation: string,
  action: () => unknown,
  validate: ResultValidator<T>,
): T {
  try {
    const encoded = JSON.stringify(action());
    if (encoded === undefined) throw new Error("legacy output is not JSON");
    return validate(JSON.parse(encoded));
  } catch {
    throw new LegacyDomainAdapterError(operation);
  }
}

function outputRecord(value: unknown, label: string): LegacyRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as LegacyRecord;
}

function outputString(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  return value;
}

function outputStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map((item, index) => outputString(item, `${label}[${index}]`));
}

function outputRecordArray(value: unknown, label: string): LegacyRecord[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map((item, index) => outputRecord(item, `${label}[${index}]`));
}

function recommendationResult(value: unknown): LegacyRecommendationResult {
  const result = outputRecord(value, "recommendation");
  outputRecordArray(result.portfolioTeams, "recommendation.portfolioTeams").forEach(
    (entry, entryIndex) => {
      outputRecord(
        entry.team,
        `recommendation.portfolioTeams[${entryIndex}].team`,
      );
      outputRecordArray(
        entry.tierRankings,
        `recommendation.portfolioTeams[${entryIndex}].tierRankings`,
      );
      outputStringArray(
        entry.selectedTactics,
        "recommendation.portfolioTeams.selectedTactics",
      );
      outputRecordArray(
        entry.tacticSelections,
        `recommendation.portfolioTeams[${entryIndex}].tacticSelections`,
      ).forEach((selection, selectionIndex) => {
        outputString(
          selection.holderId,
          `recommendation.portfolioTeams[${entryIndex}].tacticSelections[${selectionIndex}].holderId`,
        );
        if (
          !Number.isInteger(selection.slotIndex) ||
          (selection.slotIndex as number) < 0
        ) {
          throw new Error("recommendation tactic slot index must be non-negative");
        }
        outputString(
          selection.selectedTactic,
          `recommendation.portfolioTeams[${entryIndex}].tacticSelections[${selectionIndex}].selectedTactic`,
        );
        outputString(
          selection.selectedTacticId,
          `recommendation.portfolioTeams[${entryIndex}].tacticSelections[${selectionIndex}].selectedTacticId`,
        );
      });
    },
  );
  return result as LegacyRecommendationResult;
}

export interface LegacyDomainAdapter {
  findSimilarTeams(
    mapped: readonly LegacyRecord[],
    teams: readonly LegacyRecord[],
    options?: { minHeroes?: number; limit?: number },
  ): LegacyRecord[];
  recommendTeams(request?: LegacyRecord): LegacyRecommendationResult;
}

const adapter: LegacyDomainAdapter = {
  findSimilarTeams(mapped, teams, options = {}) {
    return safeResult(
      "findSimilarTeams",
      () => findSimilarTeams(
        cloneInput([...mapped]),
        cloneInput([...teams]),
        cloneInput(options),
      ),
      (result) => outputRecordArray(result, "findSimilarTeams result"),
    );
  },

  recommendTeams(request = {}) {
    return safeResult(
      "recommendTeams",
      () => recommendTeams(cloneInput(request)),
      recommendationResult,
    );
  },
};

export const legacyDomainAdapter: LegacyDomainAdapter = Object.freeze(adapter);
