import { normalizeText } from "../../../js/filters.js";

import type {
  ArtifactName,
  ArtifactRecord,
  DataSnapshot,
} from "./artifact-contracts.js";
import { canonicalDictionaryId } from "./entity-identity.js";

export type SearchKind = "hero" | "tactic" | "team" | "book";

/**
 * Một chuỗi có thể tìm được, giữ cả bản nguyên văn lẫn bản đã chuẩn hoá. Bản
 * chuẩn hoá để so khớp; bản nguyên văn để nói cho người đọc biết vì sao khớp —
 * "Hoàng Quan Thương" dễ hiểu hơn nhiều so với "hoang quan thuong".
 */
export interface SearchTerm {
  raw: string;
  normalized: string;
}

export interface SearchEntry {
  kind: SearchKind;
  canonicalId: string;
  recordId: string;
  displayName: string;
  artifact: ArtifactName;
  record: ArtifactRecord;
  terms: readonly SearchTerm[];
}

/** Kết quả tìm kiếm kèm term đã làm nên match, nếu có truy vấn. */
export interface SearchMatch extends SearchEntry {
  matchedTerm?: string;
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
  search(query: string, options?: SearchOptions): SearchMatch[];
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

function searchTerms(values: readonly unknown[]): SearchTerm[] {
  // Dedupe theo bản chuẩn hoá, giữ lần khai báo đầu tiên: thứ tự khai báo là
  // thứ tự ưu tiên tất định khi nhiều term cùng điểm cao nhất.
  const terms = new Map<string, SearchTerm>();
  for (const value of values.flatMap((entry) =>
    Array.isArray(entry) ? entry : [entry],
  )) {
    if (typeof value !== "string") continue;
    const normalized = normalizeText(value);
    if (!normalized || terms.has(normalized)) continue;
    terms.set(normalized, { raw: value.trim(), normalized });
  }
  return [...terms.values()];
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
      terms: searchTerms([
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
      terms: searchTerms([
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

/**
 * Điểm khớp cao nhất kèm term đã đạt điểm đó. Khi nhiều term cùng điểm cao
 * nhất, term khai báo trước thắng.
 */
function matchScore(
  entry: SearchEntry,
  query: string,
): { score: number; matchedTerm?: string } {
  if (!query) return { score: 0 };
  let score = -1;
  let matchedTerm: string | undefined;
  for (const term of entry.terms) {
    const termScore =
      term.normalized === query
        ? 3
        : term.normalized.startsWith(query)
          ? 2
          : term.normalized.includes(query)
            ? 1
            : -1;
    if (termScore > score) {
      score = termScore;
      matchedTerm = termScore >= 1 ? term.raw : undefined;
    }
  }
  return matchedTerm === undefined ? { score } : { score, matchedTerm };
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
        .map((entry) => ({ entry, ...matchScore(entry, normalizedQuery) }))
        .filter(({ score }) => !normalizedQuery || score >= 0)
        .sort(
          (left, right) =>
            right.score - left.score ||
            compareEntries(left.entry, right.entry),
        )
        .slice(offset, offset + limit)
        .map(({ entry, matchedTerm }) =>
          matchedTerm === undefined ? entry : { ...entry, matchedTerm },
        );
    },
  };
}
