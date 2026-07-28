import { normalizeText } from "../../../js/filters.js";

import type {
  ArtifactName,
  ArtifactRecord,
  DataSnapshot,
} from "./artifact-contracts.js";
import { canonicalDictionaryId } from "./entity-identity.js";

export type SearchKind = "hero" | "tactic" | "team" | "book";

export interface SearchEntry {
  kind: SearchKind;
  canonicalId: string;
  recordId: string;
  displayName: string;
  artifact: ArtifactName;
  record: ArtifactRecord;
  normalizedTerms: readonly string[];
}

export interface SearchOptions {
  kinds?: readonly SearchKind[];
  limit?: number;
  offset?: number;
}

export interface SnapshotIndex {
  releaseId: string;
  teamsById: ReadonlyMap<string, ArtifactRecord>;
  tierByTeam: ReadonlyMap<string, readonly ArtifactRecord[]>;
  heroesById: ReadonlyMap<string, ArtifactRecord>;
  tacticsById: ReadonlyMap<string, ArtifactRecord>;
  booksById: ReadonlyMap<string, ArtifactRecord>;
  searchEntries: readonly SearchEntry[];
  search(query: string, options?: SearchOptions): SearchEntry[];
}

export class SnapshotIndexError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SnapshotIndexError";
  }
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizedTerms(values: readonly unknown[]): string[] {
  return [
    ...new Set(
      values
        .flatMap((value) =>
          Array.isArray(value) ? value : [value],
        )
        .filter((value): value is string => typeof value === "string")
        .map((value) => normalizeText(value))
        .filter(Boolean),
    ),
  ];
}

function uniqueMap(
  entries: readonly SearchEntry[],
  label: string,
): Map<string, ArtifactRecord> {
  const output = new Map<string, ArtifactRecord>();
  for (const entry of entries) {
    if (output.has(entry.canonicalId)) {
      throw new SnapshotIndexError(
        `${label} contains duplicate canonical identity: ${entry.canonicalId}`,
      );
    }
    output.set(entry.canonicalId, entry.record);
  }
  return output;
}

function dictionaryEntries(
  records: readonly ArtifactRecord[],
  kind: "hero" | "tactic" | "book",
  artifact: "heroes-dict" | "tactics" | "books-dict",
): SearchEntry[] {
  return records.map((record) => {
    const displayName = text(record.viet);
    const canonicalId = canonicalDictionaryId(artifact, displayName);
    return {
      kind,
      canonicalId,
      recordId: canonicalId,
      displayName,
      artifact,
      record,
      normalizedTerms: normalizedTerms([
        displayName,
        record.chinese,
        record.hanViet,
        record.aliases,
      ]),
    };
  });
}

function teamEntries(records: readonly ArtifactRecord[]): SearchEntry[] {
  return records.map((record) => {
    const recordId = text(record.id);
    return {
      kind: "team",
      canonicalId: `team:${recordId}`,
      recordId,
      displayName: text(record.name),
      artifact: "teams",
      record,
      normalizedTerms: normalizedTerms([
        record.id,
        record.name,
        record.nickname,
        record.source,
      ]),
    };
  });
}

function compareEntries(left: SearchEntry, right: SearchEntry): number {
  return (
    left.kind.localeCompare(right.kind) ||
    left.displayName.localeCompare(right.displayName, "vi") ||
    left.canonicalId.localeCompare(right.canonicalId)
  );
}

function matchScore(entry: SearchEntry, query: string): number {
  if (!query) return 0;
  let score = -1;
  for (const term of entry.normalizedTerms) {
    if (term === query) score = Math.max(score, 3);
    else if (term.startsWith(query)) score = Math.max(score, 2);
    else if (term.includes(query)) score = Math.max(score, 1);
  }
  return score;
}

export function buildSnapshotIndex(snapshot: DataSnapshot): SnapshotIndex {
  const teams = teamEntries(snapshot.artifacts.teams);
  const heroes = dictionaryEntries(
    snapshot.artifacts["heroes-dict"],
    "hero",
    "heroes-dict",
  );
  const tactics = dictionaryEntries(
    snapshot.artifacts.tactics,
    "tactic",
    "tactics",
  );
  const books = dictionaryEntries(
    snapshot.artifacts["books-dict"],
    "book",
    "books-dict",
  );
  const teamsById = new Map(
    teams.map((entry) => [entry.recordId, entry.record] as const),
  );
  const tierByTeam = new Map<string, ArtifactRecord[]>();
  for (const tier of snapshot.artifacts["team-tier"]) {
    const teamId = text(tier.teamId);
    const rankings = Array.isArray(tier.rankings)
      ? tier.rankings.filter(
          (ranking): ranking is ArtifactRecord =>
            typeof ranking === "object" &&
            ranking !== null &&
            !Array.isArray(ranking),
        )
      : [];
    tierByTeam.set(teamId, rankings);
  }
  const searchEntries = [...teams, ...heroes, ...tactics, ...books].sort(
    compareEntries,
  );

  return {
    releaseId: snapshot.releaseId,
    teamsById,
    tierByTeam,
    heroesById: uniqueMap(heroes, "heroes-dict"),
    tacticsById: uniqueMap(tactics, "tactics"),
    booksById: uniqueMap(books, "books-dict"),
    searchEntries,
    search(query, options = {}) {
      const normalizedQuery = normalizeText(query).slice(0, 256);
      const kindSet =
        options.kinds === undefined
          ? null
          : new Set<SearchKind>(options.kinds);
      const limit = Math.max(
        1,
        Math.min(
          100,
          Number.isInteger(options.limit) ? options.limit! : 20,
        ),
      );
      const offset = Math.max(
        0,
        Math.min(
          searchEntries.length,
          Number.isInteger(options.offset) ? options.offset! : 0,
        ),
      );
      return searchEntries
        .filter((entry) => kindSet === null || kindSet.has(entry.kind))
        .map((entry) => ({ entry, score: matchScore(entry, normalizedQuery) }))
        .filter(({ score }) => !normalizedQuery || score >= 0)
        .sort(
          (left, right) =>
            right.score - left.score ||
            compareEntries(left.entry, right.entry),
        )
        .slice(offset, offset + limit)
        .map(({ entry }) => entry);
    },
  };
}
