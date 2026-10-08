import { findSimilarTeams } from "../../../js/analyze-map.js";

type LegacyRecord = Record<string, unknown>;

export class LegacyDomainAdapterError extends Error {
  readonly code = "LEGACY_DOMAIN_FAILURE";

  constructor(readonly operation: string) {
    super(`Legacy domain operation failed: ${operation}`);
    this.name = "LegacyDomainAdapterError";
  }
}

function outputRecordArray(value: unknown, label: string): LegacyRecord[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map((item, index) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new Error(`${label}[${index}] must be an object`);
    }
    return item as LegacyRecord;
  });
}

export interface LegacyDomainAdapter {
  findSimilarTeams(
    mapped: readonly LegacyRecord[],
    teams: readonly LegacyRecord[],
    options?: { minHeroes?: number; limit?: number },
  ): LegacyRecord[];
}

const adapter: LegacyDomainAdapter = {
  findSimilarTeams(mapped, teams, options = {}) {
    try {
      // Sao chép sâu để engine không thể đột biến input của snapshot.
      const encoded = JSON.stringify(
        findSimilarTeams(structuredClone([...mapped]), structuredClone([...teams]), structuredClone(options)),
      );
      if (encoded === undefined) throw new Error("legacy output is not JSON");
      return outputRecordArray(JSON.parse(encoded), "findSimilarTeams result");
    } catch {
      throw new LegacyDomainAdapterError("findSimilarTeams");
    }
  },
};

export const legacyDomainAdapter: LegacyDomainAdapter = Object.freeze(adapter);
