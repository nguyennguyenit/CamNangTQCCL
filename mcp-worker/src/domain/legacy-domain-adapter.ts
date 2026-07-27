import { findSimilarTeams, mapRead, mapTeamRead } from "../../../js/analyze-map.js";
import { normalizeText } from "../../../js/filters.js";
import { toVietHanViet } from "../../../js/hanviet.js";
import { matchDict, searchDict } from "../../../js/match-dict.js";
import {
  mapBuiltTeamsScan,
  mapHeroesScan,
  mapTacticsScan,
} from "../../../js/roster-scan-map.js";
import {
  deserializeRosterScanState,
  serializeRosterScanState,
} from "../../../js/roster-scan-state.js";
import {
  normalizeTeamCandidate,
  recommendTeams,
} from "../../../js/team-recommend-engine.js";

type LegacyRecord = Record<string, unknown>;
type LegacyDictionary = readonly LegacyRecord[];
type Confidence = "high" | "medium" | "low" | "manual";

interface HeroDictionaries extends LegacyRecord {
  heroesDict: LegacyRecord[];
}

interface TacticDictionaries extends LegacyRecord {
  tacticsDict: LegacyRecord[];
}

interface TeamReadDictionaries extends HeroDictionaries, TacticDictionaries {
  booksDict?: LegacyRecord[];
}

export interface LegacyMatchResult {
  record: LegacyRecord | null;
  score: number;
  confidence: Confidence;
  matched: boolean;
}

export interface LegacySearchResult {
  record: LegacyRecord;
  score: number;
}

export interface LegacyHeroesScanResult {
  heroes: Array<{
    name: string;
    confidence: Confidence;
    redStars?: number;
    level?: number;
  }>;
}

export interface LegacyTacticsScanResult {
  tactics: Array<{ name: string; confidence: Confidence }>;
}

export interface LegacyBuiltTeamsScanResult {
  teams: Array<{ teamName: string; heroes: string[]; tactics: string[] }>;
}

export interface LegacyTeamCandidate extends LegacyRecord {
  requiredHeroes: string[];
}

export interface LegacyRecommendationEntry extends LegacyRecord {
  selectedTactics: string[];
  tacticSelections?: unknown;
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

function records(value: LegacyDictionary): LegacyRecord[] {
  return cloneInput([...value]);
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

function outputConfidence(value: unknown, label: string): Confidence {
  const confidence = outputString(value, label);
  if (!["high", "medium", "low", "manual"].includes(confidence)) {
    throw new Error(`${label} is invalid`);
  }
  return confidence as Confidence;
}

function outputRecordArray(value: unknown, label: string): LegacyRecord[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map((item, index) => outputRecord(item, `${label}[${index}]`));
}

function matchResult(value: unknown): LegacyMatchResult {
  const result = outputRecord(value, "match result");
  if (result.record !== null) outputRecord(result.record, "match result.record");
  if (typeof result.score !== "number" || !Number.isFinite(result.score)) {
    throw new Error("match result.score must be finite");
  }
  if (!["high", "medium", "low"].includes(String(result.confidence))) {
    throw new Error("match result.confidence is invalid");
  }
  if (typeof result.matched !== "boolean") throw new Error("match result.matched is invalid");
  return result as unknown as LegacyMatchResult;
}

function searchResults(value: unknown): LegacySearchResult[] {
  return outputRecordArray(value, "search results").map((result) => {
    outputRecord(result.record, "search result.record");
    if (typeof result.score !== "number" || !Number.isFinite(result.score)) {
      throw new Error("search result.score must be finite");
    }
    return result as unknown as LegacySearchResult;
  });
}

function heroesScanResult(value: unknown): LegacyHeroesScanResult {
  const result = outputRecord(value, "heroes scan");
  const heroes = outputRecordArray(result.heroes, "heroes scan.heroes").map((hero) => {
    outputString(hero.name, "heroes scan.hero.name");
    outputConfidence(hero.confidence, "heroes scan.hero.confidence");
    for (const key of ["redStars", "level"] as const) {
      if (hero[key] !== undefined && (typeof hero[key] !== "number" || !Number.isFinite(hero[key]))) {
        throw new Error(`heroes scan.hero.${key} must be finite`);
      }
    }
    return hero as LegacyHeroesScanResult["heroes"][number];
  });
  return { heroes };
}

function tacticsScanResult(value: unknown): LegacyTacticsScanResult {
  const result = outputRecord(value, "tactics scan");
  const tactics = outputRecordArray(result.tactics, "tactics scan.tactics").map((tactic) => ({
    name: outputString(tactic.name, "tactics scan.tactic.name"),
    confidence: outputConfidence(
      tactic.confidence,
      "tactics scan.tactic.confidence",
    ),
  }));
  return { tactics };
}

function builtTeamsScanResult(value: unknown): LegacyBuiltTeamsScanResult {
  const result = outputRecord(value, "built teams scan");
  const teams = outputRecordArray(result.teams, "built teams scan.teams").map((team) => ({
    teamName: outputString(team.teamName, "built teams scan.team.teamName"),
    heroes: outputStringArray(team.heroes, "built teams scan.team.heroes"),
    tactics: outputStringArray(team.tactics, "built teams scan.team.tactics"),
  }));
  return { teams };
}

function teamCandidateResult(value: unknown): LegacyTeamCandidate {
  const result = outputRecord(value, "team candidate");
  outputStringArray(result.requiredHeroes, "team candidate.requiredHeroes");
  return result as LegacyTeamCandidate;
}

function recommendationResult(value: unknown): LegacyRecommendationResult {
  const result = outputRecord(value, "recommendation");
  outputRecordArray(result.portfolioTeams, "recommendation.portfolioTeams").forEach(
    (entry) =>
      outputStringArray(
        entry.selectedTactics,
        "recommendation.portfolioTeams.selectedTactics",
      ),
  );
  return result as LegacyRecommendationResult;
}

export interface LegacyDomainAdapter {
  normalizeText(value: string): string;
  toVietHanViet(value: string): string;
  matchDictionary(
    query: string,
    dictionary: LegacyDictionary,
    options?: { threshold?: number },
  ): LegacyMatchResult;
  searchDictionary(
    query: string,
    dictionary: LegacyDictionary,
    options?: { threshold?: number; limit?: number },
  ): LegacySearchResult[];
  mapRead(read: LegacyRecord, dictionaries: TeamReadDictionaries): LegacyRecord;
  mapTeamRead(
    reads: readonly LegacyRecord[],
    dictionaries: TeamReadDictionaries,
  ): LegacyRecord[];
  findSimilarTeams(
    mapped: readonly LegacyRecord[],
    teams: readonly LegacyRecord[],
    options?: { minHeroes?: number; limit?: number },
  ): LegacyRecord[];
  mapHeroesScan(
    result: LegacyRecord,
    dictionaries: HeroDictionaries,
  ): LegacyHeroesScanResult;
  mapTacticsScan(
    result: LegacyRecord,
    dictionaries: TacticDictionaries,
  ): LegacyTacticsScanResult;
  mapBuiltTeamsScan(
    result: LegacyRecord,
    dictionaries: HeroDictionaries & TacticDictionaries,
  ): LegacyBuiltTeamsScanResult;
  serializeBrowserScanState(state: LegacyRecord): LegacyRecord;
  deserializeBrowserScanState(value: unknown): LegacyRecord;
  normalizeTeamCandidate(
    team: LegacyRecord,
    tierByTeam?: Map<string, LegacyRecord[]>,
    redByHero?: Map<string, number>,
  ): LegacyTeamCandidate;
  recommendTeams(request?: LegacyRecord): LegacyRecommendationResult;
}

const adapter: LegacyDomainAdapter = {
  normalizeText(value) {
    return safeResult("normalizeText", () => normalizeText(value), (result) =>
      outputString(result, "normalizeText result"),
    );
  },

  toVietHanViet(value) {
    return safeResult("toVietHanViet", () => toVietHanViet(value), (result) =>
      outputString(result, "toVietHanViet result"),
    );
  },

  matchDictionary(query, dictionary, options = {}) {
    return safeResult(
      "matchDictionary",
      () => matchDict(query, records(dictionary), cloneInput(options)),
      matchResult,
    );
  },

  searchDictionary(query, dictionary, options = {}) {
    return safeResult(
      "searchDictionary",
      () => searchDict(query, records(dictionary), cloneInput(options)),
      searchResults,
    );
  },

  mapRead(read, dictionaries) {
    return safeResult(
      "mapRead",
      () => mapRead(cloneInput(read), cloneInput(dictionaries)),
      (result) => outputRecord(result, "mapRead result"),
    );
  },

  mapTeamRead(reads, dictionaries) {
    return safeResult(
      "mapTeamRead",
      () => mapTeamRead(cloneInput([...reads]), cloneInput(dictionaries)),
      (result) => outputRecordArray(result, "mapTeamRead result"),
    );
  },

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

  mapHeroesScan(result, dictionaries) {
    return safeResult(
      "mapHeroesScan",
      () => mapHeroesScan(cloneInput(result), cloneInput(dictionaries)),
      heroesScanResult,
    );
  },

  mapTacticsScan(result, dictionaries) {
    return safeResult(
      "mapTacticsScan",
      () => mapTacticsScan(cloneInput(result), cloneInput(dictionaries)),
      tacticsScanResult,
    );
  },

  mapBuiltTeamsScan(result, dictionaries) {
    return safeResult(
      "mapBuiltTeamsScan",
      () => mapBuiltTeamsScan(cloneInput(result), cloneInput(dictionaries)),
      builtTeamsScanResult,
    );
  },

  serializeBrowserScanState(state) {
    return safeResult(
      "serializeBrowserScanState",
      () => serializeRosterScanState(cloneInput(state)),
      (result) => outputRecord(result, "serializeBrowserScanState result"),
    );
  },

  deserializeBrowserScanState(value) {
    return safeResult(
      "deserializeBrowserScanState",
      () => deserializeRosterScanState(cloneInput(value)),
      (result) => outputRecord(result, "deserializeBrowserScanState result"),
    );
  },

  normalizeTeamCandidate(team, tierByTeam = new Map(), redByHero = new Map()) {
    return safeResult(
      "normalizeTeamCandidate",
      () => normalizeTeamCandidate(
        cloneInput(team),
        cloneInput(tierByTeam),
        cloneInput(redByHero),
      ),
      teamCandidateResult,
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
