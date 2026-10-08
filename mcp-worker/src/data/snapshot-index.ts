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
}

export interface SnapshotIndex {
  releaseId: string;
  teamsById: ReadonlyMap<string, ArtifactRecord>;
  tierByTeam: ReadonlyMap<string, readonly ArtifactRecord[]>;
  searchEntries: readonly SearchEntry[];
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

function assertUniqueIdentities(entries: readonly SearchEntry[], label: string): void {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.canonicalId)) {
      throw new SnapshotIndexError(`${label} contains duplicate canonical identity: ${entry.canonicalId}`);
    }
    seen.add(entry.canonicalId);
  }
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
  assertUniqueIdentities(heroes, "heroes-dict");
  assertUniqueIdentities(tactics, "tactics");
  assertUniqueIdentities(books, "books-dict");
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
    searchEntries,
  };
}
