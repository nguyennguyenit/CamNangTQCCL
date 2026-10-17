/**
 * Snapshot v3 publication projection: contract, ingress validator and typed read model.
 *
 * SHARD LAYOUT DECISION (measured on the Recommended generation a973b093…, lookup generation
 * 29322cab…, 2026-10-08):
 *
 *   inputs                                         bytes
 *   index.json (1366 records)                      3 109 k   (details-*.json hold the same records, 2 948 k)
 *   other-teams.json (40 admitted variants)          124 k
 *   seasons.json                                      42 k
 *   heroes-dict 457 k, tactics 745 k, lookup-catalog 362 k, books-dict 25 k, khaihoang 77 k,
 *   website-display 10 k, team-route-handles 72 k
 *
 * Measured projection output with that layout (bytes): catalog-entities-00 1 243 052 (976 records);
 * reference-registry 20 428; reference-team-index 1 887 731 (1423 teams); reference-team-details-00/01/02
 * 2 096 288 / 2 094 953 / 1 364 283 (1423 details); public-routes 356 088 (2399 routes). Total 9.06 MB in
 * 7 publication artifacts, each < 2.1 MB against the 8 MiB gate.
 *
 * Projection output is an allowlist, not a copy: heroes/tactics drop iconUrl/linkScore/pending,
 * the Recommended index and details collapse into one detail record per config, and nothing from
 * `data/sgsdeck` is ever read. Measured artifact sizes are far below MAX_ARTIFACT_BYTES (8 MiB), but
 * the ceiling must hold as the corpus grows, so the two record-heavy families are sharded
 * deterministically instead of raising the gate:
 *
 *   - `catalog-entities-NN`      records sorted by (group order, id), greedy fill
 *   - `reference-team-details-NN` records sorted by (collection order, ref), greedy fill
 *   - `reference-registry`, `reference-team-index`, `public-routes` are single artifacts.
 *
 * Greedy fill closes a shard before a record would push it past SHARD_TARGET_BYTES (2 MiB, a quarter
 * of the hard gate) so a Worker never has to parse one oversized document; a single record larger than
 * the target gets its own shard and is still bound by MAX_ARTIFACT_BYTES. Shard names have the fixed
 * grammar `<family>-<2 digits>`, indexes are contiguous from 00, at most MAX_SHARDS_PER_FAMILY per
 * family, and the count per family is recorded in the manifest (`publication.shards`). The inventory
 * is derived only from that validated manifest.
 *
 * Worker-safe: no node:* imports, no DOM.
 */
import { normalizeText } from "../../../js/filters.js";
import { lookupProfilePath, LOOKUP_GROUP_SLUGS } from "../../../js/lookup-ids.js";
import { localePath } from "../../../js/i18n.js";

import type { ArtifactRecord } from "./artifact-contracts.js";

export const MAX_SHARD_RECORD_BYTES = 8 * 1024 * 1024;
export const SHARD_TARGET_BYTES = 2 * 1024 * 1024;
export const MAX_SHARDS_PER_FAMILY = 16;

export const PUBLICATION_SHARDED_FAMILIES = ["catalog-entities", "reference-team-details"] as const;
export const PUBLICATION_SINGLE_ARTIFACTS = ["reference-registry", "reference-team-index", "public-routes"] as const;
export type PublicationShardFamily = (typeof PUBLICATION_SHARDED_FAMILIES)[number];
export type PublicationSingleArtifact = (typeof PUBLICATION_SINGLE_ARTIFACTS)[number];
export type PublicationShardName = `${PublicationShardFamily}-${string}`;
export type PublicationArtifactName = PublicationSingleArtifact | PublicationShardName;

const SHARD_NAME = /^(catalog-entities|reference-team-details)-([0-9]{2})$/u;

export function isPublicationArtifactName(name: string): name is PublicationArtifactName {
  return (PUBLICATION_SINGLE_ARTIFACTS as readonly string[]).includes(name) || SHARD_NAME.test(name);
}

export function shardName(family: PublicationShardFamily, index: number): PublicationShardName {
  if (!Number.isInteger(index) || index < 0 || index >= MAX_SHARDS_PER_FAMILY) {
    throw new PublicationContractError(`shard index out of range: ${index}`);
  }
  return `${family}-${String(index).padStart(2, "0")}`;
}

export interface PublicationShardCounts {
  "catalog-entities": number;
  "reference-team-details": number;
}

/** Fixed manifest order of the publication artifacts for a shard layout. */
export function publicationArtifactNames(shards: PublicationShardCounts): PublicationArtifactName[] {
  const family = (name: PublicationShardFamily) =>
    Array.from({ length: shards[name] }, (_, index) => shardName(name, index));
  return [
    ...family("catalog-entities"),
    "reference-registry",
    "reference-team-index",
    ...family("reference-team-details"),
    "public-routes",
  ];
}

export class PublicationContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicationContractError";
  }
}

// ---------------------------------------------------------------------------------------------
// Manifest metadata (part of the release identity)
// ---------------------------------------------------------------------------------------------

export interface RecommendedPin {
  schemaVersion: 1;
  generationId: string;
  manifestSha256: string;
}

export interface PublicationUpstream {
  recommended: RecommendedPin;
  lookup: { generationId: string };
  websiteDisplay: { generationId: string; sha256: `sha256:${string}`; recommendedPin: RecommendedPin };
  routeLedger: { generationId: string; sha256: `sha256:${string}` };
  /** Raw byte digests of the public inputs a projection was derived from. */
  sources: Record<(typeof UPSTREAM_SOURCE_KEYS)[number], `sha256:${string}`>;
}

export interface PublicationMeta {
  schemaVersion: 1;
  upstream: PublicationUpstream;
  shards: PublicationShardCounts;
}

export const UPSTREAM_SOURCE_KEYS = [
  "books-dict",
  "heroes-dict",
  "khaihoang",
  "lookup-catalog",
  "lookup-manifest",
  "tactics",
  "teams",
] as const;

const HEX64 = /^[0-9a-f]{64}$/u;
const SHA = /^sha256:[0-9a-f]{64}$/u;

function plain(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new PublicationContractError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  if (Object.keys(value).sort().join("\0") !== [...keys].sort().join("\0")) {
    throw new PublicationContractError(`${label} has an unexpected key set`);
  }
}

function pattern(value: unknown, regex: RegExp, label: string): string {
  if (typeof value !== "string" || !regex.test(value)) {
    throw new PublicationContractError(`${label} is invalid`);
  }
  return value;
}

function pin(value: unknown, label: string): RecommendedPin {
  const item = plain(value, label);
  exactKeys(item, ["generationId", "manifestSha256", "schemaVersion"], label);
  if (item.schemaVersion !== 1) throw new PublicationContractError(`${label}.schemaVersion is invalid`);
  return {
    schemaVersion: 1,
    generationId: pattern(item.generationId, HEX64, `${label}.generationId`),
    manifestSha256: pattern(item.manifestSha256, HEX64, `${label}.manifestSha256`),
  };
}

export function validatePublicationMeta(value: unknown): PublicationMeta {
  const meta = plain(value, "publication");
  exactKeys(meta, ["schemaVersion", "shards", "upstream"], "publication");
  if (meta.schemaVersion !== 1) throw new PublicationContractError("publication.schemaVersion is invalid");
  const shards = plain(meta.shards, "publication.shards");
  exactKeys(shards, PUBLICATION_SHARDED_FAMILIES, "publication.shards");
  for (const family of PUBLICATION_SHARDED_FAMILIES) {
    const count = shards[family];
    if (!Number.isInteger(count) || (count as number) < 1 || (count as number) > MAX_SHARDS_PER_FAMILY) {
      throw new PublicationContractError(`publication.shards.${family} is invalid`);
    }
  }
  const upstream = plain(meta.upstream, "publication.upstream");
  exactKeys(upstream, ["lookup", "recommended", "routeLedger", "sources", "websiteDisplay"], "publication.upstream");
  const lookup = plain(upstream.lookup, "upstream.lookup");
  exactKeys(lookup, ["generationId"], "upstream.lookup");
  const display = plain(upstream.websiteDisplay, "upstream.websiteDisplay");
  exactKeys(display, ["generationId", "recommendedPin", "sha256"], "upstream.websiteDisplay");
  const ledger = plain(upstream.routeLedger, "upstream.routeLedger");
  exactKeys(ledger, ["generationId", "sha256"], "upstream.routeLedger");
  const sources = plain(upstream.sources, "upstream.sources");
  exactKeys(sources, UPSTREAM_SOURCE_KEYS, "upstream.sources");
  const recommended = pin(upstream.recommended, "upstream.recommended");
  const displayPin = pin(display.recommendedPin, "upstream.websiteDisplay.recommendedPin");
  if (
    displayPin.generationId !== recommended.generationId
    || displayPin.manifestSha256 !== recommended.manifestSha256
  ) {
    throw new PublicationContractError("mixed Recommended generation between manifest pins");
  }
  const ledgerGeneration = pattern(ledger.generationId, HEX64, "upstream.routeLedger.generationId");
  if (ledgerGeneration !== recommended.generationId) {
    throw new PublicationContractError("route ledger generation differs from Recommended generation");
  }
  return {
    schemaVersion: 1,
    shards: {
      "catalog-entities": shards["catalog-entities"] as number,
      "reference-team-details": shards["reference-team-details"] as number,
    },
    upstream: {
      recommended,
      lookup: { generationId: pattern(lookup.generationId, /^lookup:[0-9a-f]{64}$/u, "upstream.lookup.generationId") },
      websiteDisplay: {
        generationId: pattern(display.generationId, /^site-localization:[0-9a-f]{64}$/u, "upstream.websiteDisplay.generationId"),
        sha256: pattern(display.sha256, SHA, "upstream.websiteDisplay.sha256") as `sha256:${string}`,
        recommendedPin: displayPin,
      },
      routeLedger: {
        generationId: ledgerGeneration,
        sha256: pattern(ledger.sha256, SHA, "upstream.routeLedger.sha256") as `sha256:${string}`,
      },
      sources: Object.fromEntries(
        UPSTREAM_SOURCE_KEYS.map((key) => [key, pattern(sources[key], SHA, `upstream.sources.${key}`)]),
      ) as PublicationUpstream["sources"],
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Record contracts
// ---------------------------------------------------------------------------------------------

export const CATALOG_GROUPS = ["heroes", "tactics", "equipment", "advisors", "troop-mods", "buildings", "books"] as const;
export type CatalogGroup = (typeof CATALOG_GROUPS)[number];
export const CATALOG_KINDS = [
  "hero",
  "tactic",
  "equipment",
  "equipment-special",
  "advisor",
  "troop-mod",
  "building",
  "book",
] as const;
export type CatalogKind = (typeof CATALOG_KINDS)[number];

export const KIND_GROUP: Readonly<Record<CatalogKind, CatalogGroup>> = Object.freeze({
  hero: "heroes",
  tactic: "tactics",
  equipment: "equipment",
  "equipment-special": "equipment",
  advisor: "advisors",
  "troop-mod": "troop-mods",
  building: "buildings",
  book: "books",
});

export interface CatalogEntity {
  id: string;
  kind: CatalogKind;
  group: CatalogGroup;
  nameVi: string;
  nameZh: string | null;
  hanViet: string | null;
  aliases: string[];
  /** Allowlisted public profile fields; nested specials/options/levels stay inside for section pagination. */
  profile: Record<string, unknown>;
}

export const TEAM_COLLECTIONS = ["recommended", "other", "khaihoang"] as const;
export type TeamCollection = (typeof TEAM_COLLECTIONS)[number];
/** `engine` is the legacy corpus read from the v1/v2 artifacts, listed in the registry only. */
export type RegistryCollectionId = TeamCollection | "engine";

export interface LocalePaths {
  vi: string;
  zh: string;
}

export interface PublicRoute extends LocalePaths {
  id: string;
  kind: "entity" | "team";
}

export interface TeamSlotRef {
  slot: number;
  raw: string | null;
  vi: string | null;
  tacticId: string | null;
}

export interface TeamHeroSummary {
  holder: number;
  heroId: string | null;
  nameVi: string;
  nameRaw: string | null;
  role: string | null;
  tactics: TeamSlotRef[];
}

export interface TeamSummary {
  ref: string;
  collection: TeamCollection;
  id: string;
  nameVi: string;
  nameZh: string | null;
  nickname: string | null;
  sourceSeasonId: string | null;
  sourceSeasonCode: string | null;
  sourceCategoryId: string | null;
  tierRaw: string | null;
  tierOrder: number | null;
  score: number | null;
  factionRaw: string | null;
  unitTypes: string[];
  heroes: TeamHeroSummary[];
  translationStatus: string | null;
  /** Recommended only: position in the website's `index.json` (the order `buildSeasonCandidates` consumes). */
  indexPosition: number | null;
}

export type TeamDetail = { ref: string; collection: TeamCollection; id: string } & Record<string, unknown>;

export interface SeasonOption {
  sourceSeasonId: string;
  label: string;
  nameRaw: string;
  displayNameVi: string;
  displayCode: string;
  sourceOrder: number;
  status: string;
  translationStatus: string;
  advertisedCountRaw: number | null;
}

export interface SeasonRegistry {
  schemaVersion: 1;
  upstream: PublicationUpstream;
  defaultSourceSeasonId: string;
  seasonOptions: SeasonOption[];
  categories: Array<{ sourceCategoryId: string; nameVi: string | null }>;
  scopes: Array<{
    sourceSeasonId: string;
    sourceCategoryId: string;
    state: string;
    advertisedCountRaw: number | null;
    observedCardCount: number | null;
  }>;
  displayLabels: Record<string, Record<string, string>>;
  collections: Array<{ id: RegistryCollectionId; count: number; descriptionVi: string }>;
}

function str(value: unknown, label: string): string {
  if (typeof value !== "string" || value === "") throw new PublicationContractError(`${label} must be a non-empty string`);
  return value;
}

function strOrNull(value: unknown, label: string): string | null {
  if (value === null) return null;
  return str(value, label);
}

function numOrNull(value: unknown, label: string): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new PublicationContractError(`${label} must be a number`);
  return value;
}

function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new PublicationContractError(`${label} must be a string array`);
  }
  return value as string[];
}

function parseEntity(value: ArtifactRecord, label: string): CatalogEntity {
  const kind = value.kind;
  if (typeof kind !== "string" || !(CATALOG_KINDS as readonly string[]).includes(kind)) {
    throw new PublicationContractError(`${label}.kind is invalid`);
  }
  const id = str(value.id, `${label}.id`);
  if (!id.startsWith(`${kind}:`)) throw new PublicationContractError(`${label}.id does not match its kind`);
  const group = KIND_GROUP[kind as CatalogKind];
  if (value.group !== group) throw new PublicationContractError(`${label}.group does not match its kind`);
  return {
    id,
    kind: kind as CatalogKind,
    group,
    nameVi: str(value.nameVi, `${label}.nameVi`),
    nameZh: strOrNull(value.nameZh, `${label}.nameZh`),
    hanViet: strOrNull(value.hanViet, `${label}.hanViet`),
    aliases: strings(value.aliases, `${label}.aliases`),
    profile: plain(value.profile, `${label}.profile`),
  };
}

function parseSlot(value: unknown, label: string): TeamSlotRef {
  const item = plain(value, label);
  if (!Number.isInteger(item.slot)) throw new PublicationContractError(`${label}.slot is invalid`);
  return {
    slot: item.slot as number,
    raw: strOrNull(item.raw, `${label}.raw`),
    vi: strOrNull(item.vi, `${label}.vi`),
    tacticId: strOrNull(item.tacticId, `${label}.tacticId`),
  };
}

function parseTeamSummary(value: ArtifactRecord, label: string): TeamSummary {
  const collection = value.collection;
  if (typeof collection !== "string" || !(TEAM_COLLECTIONS as readonly string[]).includes(collection)) {
    throw new PublicationContractError(`${label}.collection is invalid`);
  }
  const id = str(value.id, `${label}.id`);
  const ref = str(value.ref, `${label}.ref`);
  if (ref !== `${collection}:${id}`) throw new PublicationContractError(`${label}.ref does not match its identity`);
  if (!Array.isArray(value.heroes)) throw new PublicationContractError(`${label}.heroes must be an array`);
  return {
    ref,
    collection: collection as TeamCollection,
    id,
    nameVi: str(value.nameVi, `${label}.nameVi`),
    nameZh: strOrNull(value.nameZh, `${label}.nameZh`),
    nickname: strOrNull(value.nickname, `${label}.nickname`),
    sourceSeasonId: strOrNull(value.sourceSeasonId, `${label}.sourceSeasonId`),
    sourceSeasonCode: strOrNull(value.sourceSeasonCode, `${label}.sourceSeasonCode`),
    sourceCategoryId: strOrNull(value.sourceCategoryId, `${label}.sourceCategoryId`),
    tierRaw: strOrNull(value.tierRaw, `${label}.tierRaw`),
    tierOrder: numOrNull(value.tierOrder, `${label}.tierOrder`),
    score: numOrNull(value.score, `${label}.score`),
    factionRaw: strOrNull(value.factionRaw, `${label}.factionRaw`),
    unitTypes: strings(value.unitTypes, `${label}.unitTypes`),
    translationStatus: strOrNull(value.translationStatus, `${label}.translationStatus`),
    indexPosition: numOrNull(value.indexPosition ?? null, `${label}.indexPosition`),
    heroes: value.heroes.map((hero, index) => {
      const item = plain(hero, `${label}.heroes[${index}]`);
      if (!Array.isArray(item.tactics)) throw new PublicationContractError(`${label}.heroes[${index}].tactics must be an array`);
      return {
        holder: item.holder as number,
        heroId: strOrNull(item.heroId, `${label}.heroes[${index}].heroId`),
        nameVi: typeof item.nameVi === "string" ? item.nameVi : str(item.nameVi, `${label}.heroes[${index}].nameVi`),
        nameRaw: strOrNull(item.nameRaw, `${label}.heroes[${index}].nameRaw`),
        role: strOrNull(item.role, `${label}.heroes[${index}].role`),
        tactics: item.tactics.map((slot, slotIndex) => parseSlot(slot, `${label}.heroes[${index}].tactics[${slotIndex}]`)),
      };
    }),
  };
}

function parseRegistry(value: ArtifactRecord): SeasonRegistry {
  if (value.schemaVersion !== 1) throw new PublicationContractError("registry.schemaVersion is invalid");
  const options = value.seasonOptions;
  if (!Array.isArray(options) || options.length === 0) throw new PublicationContractError("registry.seasonOptions is empty");
  const seasonOptions = options.map((raw, index): SeasonOption => {
    const item = plain(raw, `registry.seasonOptions[${index}]`);
    return {
      sourceSeasonId: str(item.sourceSeasonId, "season.sourceSeasonId"),
      label: str(item.label, "season.label"),
      nameRaw: str(item.nameRaw, "season.nameRaw"),
      displayNameVi: str(item.displayNameVi, "season.displayNameVi"),
      displayCode: str(item.displayCode, "season.displayCode"),
      sourceOrder: item.sourceOrder as number,
      status: str(item.status, "season.status"),
      translationStatus: str(item.translationStatus, "season.translationStatus"),
      advertisedCountRaw: numOrNull(item.advertisedCountRaw ?? null, "season.advertisedCountRaw"),
    };
  });
  const defaultSourceSeasonId = str(value.defaultSourceSeasonId, "registry.defaultSourceSeasonId");
  if (!seasonOptions.some((option) => option.sourceSeasonId === defaultSourceSeasonId)) {
    throw new PublicationContractError("registry default season is not an option");
  }
  const upstream = validatePublicationMeta({
    schemaVersion: 1,
    shards: { "catalog-entities": 1, "reference-team-details": 1 },
    upstream: value.upstream,
  }).upstream;
  return {
    schemaVersion: 1,
    upstream,
    defaultSourceSeasonId,
    seasonOptions,
    categories: (value.categories as Array<Record<string, unknown>>).map((item) => ({
      sourceCategoryId: str(item.sourceCategoryId, "category.sourceCategoryId"),
      nameVi: strOrNull(item.nameVi, "category.nameVi"),
    })),
    scopes: (value.scopes as Array<Record<string, unknown>>).map((item) => ({
      sourceSeasonId: str(item.sourceSeasonId, "scope.sourceSeasonId"),
      sourceCategoryId: str(item.sourceCategoryId, "scope.sourceCategoryId"),
      state: str(item.state, "scope.state"),
      advertisedCountRaw: numOrNull(item.advertisedCountRaw ?? null, "scope.advertisedCountRaw"),
      observedCardCount: numOrNull(item.observedCardCount ?? null, "scope.observedCardCount"),
    })),
    displayLabels: plain(value.displayLabels, "registry.displayLabels") as Record<string, Record<string, string>>,
    collections: (value.collections as Array<Record<string, unknown>>).map((item) => ({
      id: item.id as RegistryCollectionId,
      count: item.count as number,
      descriptionVi: str(item.descriptionVi, "collection.descriptionVi"),
    })),
  };
}

function parseRoute(value: ArtifactRecord, label: string): PublicRoute {
  const kind = value.kind;
  if (kind !== "entity" && kind !== "team") throw new PublicationContractError(`${label}.kind is invalid`);
  const vi = str(value.vi, `${label}.vi`);
  const zh = str(value.zh, `${label}.zh`);
  if (!vi.startsWith("/") || vi.startsWith("//") || vi.startsWith("/zh/") || zh !== localePath(vi, "zh")) {
    throw new PublicationContractError(`${label} route paths are invalid`);
  }
  return { id: str(value.id, `${label}.id`), kind, vi, zh };
}

// ---------------------------------------------------------------------------------------------
// Read model
// ---------------------------------------------------------------------------------------------

export interface PublicationArtifactRecords {
  entityShards: ReadonlyArray<readonly ArtifactRecord[]>;
  registry: readonly ArtifactRecord[];
  teamIndex: readonly ArtifactRecord[];
  detailShards: ReadonlyArray<readonly ArtifactRecord[]>;
  routes: readonly ArtifactRecord[];
}

export interface CatalogSearchOptions {
  kinds?: readonly CatalogKind[];
  groups?: readonly CatalogGroup[];
  limit?: number;
  offset?: number;
}

export interface CatalogSearchMatch {
  entity: CatalogEntityView;
  score: number;
  matchedTerm: string;
}

export interface CatalogEntityView extends CatalogEntity {
  pagePath: LocalePaths;
}

export interface TeamSummaryView extends TeamSummary {
  pagePath: LocalePaths;
}

export type TeamDetailView = TeamDetail & { pagePath: LocalePaths };

export interface TeamFilter {
  collection?: TeamCollection;
  sourceSeasonId?: string;
  sourceCategoryId?: string;
  tierRaw?: string;
  /** Hero canonical ids that must all appear. */
  heroIds?: readonly string[];
  /** Tactic canonical ids that must all appear on some slot. */
  tacticIds?: readonly string[];
  unitType?: string;
  /** Normalized substring over names, nicknames and hero names. */
  query?: string;
  limit?: number;
  offset?: number;
}

export interface Page<T> {
  total: number;
  offset: number;
  limit: number;
  items: T[];
}

export interface PublicationReadModel {
  readonly upstream: PublicationUpstream;
  /** Recommended season registry (`defaultSourceSeasonId`, `seasonOptions`, categories, scopes, collections). */
  readonly seasons: SeasonRegistry;
  readonly entities: readonly CatalogEntityView[];
  readonly teams: readonly TeamSummaryView[];
  /** id/ref → route. Entity ids and team refs share one namespace (`hero:…`, `recommended:…`). */
  readonly routes: ReadonlyMap<string, PublicRoute>;
  searchCatalog(query: string, options?: CatalogSearchOptions): Page<CatalogSearchMatch>;
  /**
   * Tên gần cho truy vấn không khớp chuỗi con nào: mục chung ít nhất 2 từ (chữ Hán tính từng chữ) với
   * truy vấn, xếp theo số từ chung rồi độ trùng Jaccard. Không phải kết quả khớp; rỗng khi không đủ gần.
   * `likely`: mục duy nhất cùng loại mà mọi từ có trong truy vấn (xem `covers`); đứng đầu danh sách.
   */
  similarCatalog(query: string, options?: Pick<CatalogSearchOptions, "kinds" | "limit">): Array<CatalogSearchMatch & { likely: boolean }>;
  getEntity(id: string): CatalogEntityView | undefined;
  findTeams(filter?: TeamFilter): Page<TeamSummaryView>;
  getTeam(reference: string): TeamDetailView | undefined;
  /**
   * Raw Recommended records of one source season, in the exact shape `buildSeasonCandidates` reads
   * from the website's `index.json` (sourceConfigId, displayNameVi, sourceSeasonId, sourceCategoryId,
   * tierRaw, tierOrder, heroes with raw tactic slots, unitTypesRaw, alternativeHoldersRaw, …).
   */
  recommendSourceRecords(sourceSeasonId: string): readonly ArtifactRecord[];
}

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

function clampPage(limit: number | undefined, offset: number | undefined) {
  const boundedLimit = Math.min(Math.max(Math.trunc(limit ?? DEFAULT_PAGE_LIMIT), 1), MAX_PAGE_LIMIT);
  const boundedOffset = Math.max(Math.trunc(offset ?? 0), 0);
  return { limit: Number.isFinite(boundedLimit) ? boundedLimit : DEFAULT_PAGE_LIMIT, offset: Number.isFinite(boundedOffset) ? boundedOffset : 0 };
}

function terms(values: ReadonlyArray<string | null | undefined | readonly string[]>) {
  const output = new Map<string, string>();
  for (const value of values.flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))) {
    if (typeof value !== "string") continue;
    const normalized = normalizeText(value);
    if (normalized && !output.has(normalized)) output.set(normalized, value.trim().slice(0, 256));
  }
  return [...output];
}

function scoreTerms(entries: ReadonlyArray<readonly [string, string]>, query: string) {
  let score = -1;
  let matched = "";
  for (const [normalized, raw] of entries) {
    const value = normalized === query ? 3 : normalized.startsWith(query) ? 2 : normalized.includes(query) ? 1 : -1;
    if (value > score) {
      score = value;
      matched = raw;
    }
  }
  return { score, matched };
}

const MIN_SHARED_TOKENS = 2;

/** Từ của một chuỗi: tách khoảng trắng/dấu câu; chữ Hán tách từng chữ. */
function tokens(text: string): ReadonlySet<string> {
  return new Set(text.replace(/(\p{Script=Han})/gu, " $1 ").split(/[^\p{L}\p{N}]+/u).filter(Boolean));
}

interface TokenTerm {
  /** Từ sau normalizeText (bỏ dấu): quyết định có gợi ý hay không, như search chuỗi con. */
  folded: ReadonlySet<string>;
  /**
   * Từ giữ dấu, chỉ để xếp "Long" trước "Lòng" khi người dùng gõ có dấu. Term toàn ASCII (id slug, alias
   * không dấu) không có dạng có dấu nên để rỗng, tránh "quan" của slug trùng "Quan" người dùng gõ.
   */
  accented: ReadonlySet<string>;
  raw: string;
  /** Từng từ của raw (giữ thứ tự, không gộp trùng) để xét `likely`. */
  words: readonly Word[];
}

interface Word {
  folded: string;
  accented: string;
}

const NO_TOKENS: ReadonlySet<string> = new Set();
/** Từ ngắn hơn thì không bỏ qua sai một chữ cái: "ke" (kế) và "ky" (kỵ) là hai từ khác nhau. */
const MIN_TYPO_WORD_LENGTH = 4;

function wordsOf(raw: string): Word[] {
  return raw
    .normalize("NFC")
    .toLowerCase()
    .replace(/(\p{Script=Han})/gu, " $1 ")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((accented) => ({ accented, folded: normalizeText(accented) }));
}

function tokenTerm(normalized: string, raw: string): TokenTerm {
  return {
    folded: tokens(normalized),
    accented: /[^\x00-\x7f]/u.test(raw) ? tokens(raw.normalize("NFC").toLowerCase()) : NO_TOKENS,
    raw,
    words: wordsOf(raw),
  };
}

function withinOneEdit(left: string, right: string): boolean {
  if (Math.abs(left.length - right.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (left.length > right.length) i += 1;
    else if (right.length > left.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  return edits + (left.length - i) + (right.length - j) <= 1;
}

function sameWord(query: Word, candidate: Word): boolean {
  if (query.folded === candidate.folded) return true;
  return (
    query.folded.length >= MIN_TYPO_WORD_LENGTH
    && candidate.folded.length >= MIN_TYPO_WORD_LENGTH
    && withinOneEdit(query.folded, candidate.folded)
  );
}

/**
 * Tên gần "phủ" tên gõ khi mọi từ của nó khớp một từ riêng của tên gõ (bỏ qua dấu, hoặc sai một chữ cái
 * ở từ dài) và nó phủ ít nhất số từ của tên gõ trừ một: người dùng gõ thừa một từ, đảo thứ tự hay gõ sai.
 */
function covers(candidate: readonly Word[], query: readonly Word[]): boolean {
  if (candidate.length < MIN_SHARED_TOKENS || candidate.length < query.length - 1) return false;
  const used = new Set<number>();
  return candidate.every((word) => {
    const index = query.findIndex((queryWord, position) => !used.has(position) && sameWord(queryWord, word));
    if (index === -1) return false;
    used.add(index);
    return true;
  });
}

function countShared(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared;
}

function similarity(entries: readonly TokenTerm[], query: TokenTerm) {
  let best = { shared: 0, accented: 0, jaccard: 0, matched: "" };
  for (const term of entries) {
    const shared = countShared(query.folded, term.folded);
    const accented = countShared(query.accented, term.accented);
    const jaccard = shared / (query.folded.size + term.folded.size - shared);
    if (
      shared > best.shared
      || (shared === best.shared && (accented > best.accented || (accented === best.accented && jaccard > best.jaccard)))
    ) {
      best = { shared, accented, jaccard, matched: term.raw };
    }
  }
  return best;
}

const GROUP_ORDER = new Map<string, number>(CATALOG_GROUPS.map((group, index) => [group, index]));
const COLLECTION_ORDER = new Map<string, number>(TEAM_COLLECTIONS.map((collection, index) => [collection, index]));

function assertSharded(
  shards: ReadonlyArray<readonly ArtifactRecord[]>,
  key: (record: ArtifactRecord) => string,
  order: (record: ArtifactRecord) => number,
  label: string,
) {
  let previous: { order: number; key: string } | null = null;
  for (const shard of shards) {
    if (shard.length === 0) throw new PublicationContractError(`${label} contains an empty shard`);
    for (const record of shard) {
      const current = { order: order(record), key: key(record) };
      if (
        previous !== null
        && (current.order < previous.order || (current.order === previous.order && current.key <= previous.key))
      ) {
        throw new PublicationContractError(`${label} records are not in deterministic shard order`);
      }
      previous = current;
    }
  }
}

export function entityShardOrder(record: ArtifactRecord): number {
  return GROUP_ORDER.get(String(record.group)) ?? Number.MAX_SAFE_INTEGER;
}

export function detailShardOrder(record: ArtifactRecord): number {
  return COLLECTION_ORDER.get(String(record.collection)) ?? Number.MAX_SAFE_INTEGER;
}

/** Parse + cross-validate verified artifact records into the typed read model. */
export function buildPublicationReadModel(
  records: PublicationArtifactRecords,
  meta: PublicationMeta,
): PublicationReadModel {
  assertSharded(records.entityShards, (record) => String(record.id), entityShardOrder, "catalog-entities");
  assertSharded(records.detailShards, (record) => String(record.ref), detailShardOrder, "reference-team-details");
  if (records.registry.length !== 1) throw new PublicationContractError("reference-registry must hold exactly one record");
  const registry = parseRegistry(records.registry[0]!);
  if (JSON.stringify(registry.upstream) !== JSON.stringify(meta.upstream)) {
    throw new PublicationContractError("registry upstream differs from the manifest (mixed generation)");
  }

  const routes = new Map<string, PublicRoute>();
  records.routes.forEach((record, index) => {
    const route = parseRoute(record, `public-routes[${index}]`);
    if (routes.has(route.id)) throw new PublicationContractError(`public-routes duplicate id: ${route.id}`);
    routes.set(route.id, route);
  });

  const entities: CatalogEntityView[] = [];
  const entityById = new Map<string, CatalogEntityView>();
  records.entityShards.forEach((shard, shardIndex) => {
    shard.forEach((record, index) => {
      const entity = parseEntity(record, `catalog-entities-${shardIndex}[${index}]`);
      const route = routes.get(entity.id);
      if (route === undefined || route.kind !== "entity") {
        throw new PublicationContractError(`entity has no public route: ${entity.id}`);
      }
      const expected = lookupProfilePath(entity.id);
      if (expected === null || route.vi !== expected || route.zh !== localePath(expected, "zh")) {
        throw new PublicationContractError(`entity route differs from the Tra cứu route: ${entity.id}`);
      }
      if (entityById.has(entity.id)) throw new PublicationContractError(`duplicate entity: ${entity.id}`);
      const view: CatalogEntityView = { ...entity, pagePath: { vi: route.vi, zh: route.zh } };
      entityById.set(entity.id, view);
      entities.push(view);
    });
  });

  const detailByRef = new Map<string, ArtifactRecord>();
  for (const shard of records.detailShards) {
    for (const record of shard) {
      const ref = str(record.ref, "detail.ref");
      if (detailByRef.has(ref)) throw new PublicationContractError(`duplicate team detail: ${ref}`);
      detailByRef.set(ref, record);
    }
  }

  const teams: TeamSummaryView[] = [];
  const teamByRef = new Map<string, TeamSummaryView>();
  records.teamIndex.forEach((record, index) => {
    const team = parseTeamSummary(record, `reference-team-index[${index}]`);
    const route = routes.get(team.ref);
    if (route === undefined || route.kind !== "team") throw new PublicationContractError(`team has no public route: ${team.ref}`);
    if (!detailByRef.has(team.ref)) throw new PublicationContractError(`team has no detail: ${team.ref}`);
    if (teamByRef.has(team.ref)) throw new PublicationContractError(`duplicate team: ${team.ref}`);
    if (team.sourceSeasonId !== null && !registry.seasonOptions.some((option) => option.sourceSeasonId === team.sourceSeasonId)) {
      throw new PublicationContractError(`team references an unknown source season: ${team.ref}`);
    }
    const view: TeamSummaryView = { ...team, pagePath: { vi: route.vi, zh: route.zh } };
    teamByRef.set(team.ref, view);
    teams.push(view);
  });
  if (detailByRef.size !== teams.length) throw new PublicationContractError("team index and details disagree");
  for (const route of routes.values()) {
    if (route.kind === "entity" ? !entityById.has(route.id) : !teamByRef.has(route.id)) {
      throw new PublicationContractError(`public route has no target: ${route.id}`);
    }
  }

  // Mã chiến pháp đã gộp (`profile.lookup.formerIds` của mã còn sống) trả về hồ sơ của mã còn sống; mã còn sống không bao giờ bị che.
  const formerIdToSurvivor = new Map<string, CatalogEntityView>();
  const formerIdsOf = (entity: CatalogEntityView): string[] => {
    const lookup = entity.profile.lookup;
    const ids = typeof lookup === "object" && lookup !== null && !Array.isArray(lookup) ? (lookup as Record<string, unknown>).formerIds : undefined;
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
  };
  for (const entity of entities) {
    if (entity.kind !== "tactic") continue;
    for (const id of formerIdsOf(entity)) if (!entityById.has(id) && !formerIdToSurvivor.has(id)) formerIdToSurvivor.set(id, entity);
  }
  const searchIndex = entities.map((entity) => ({
    entity,
    terms: terms([entity.nameVi, entity.nameZh, entity.hanViet, entity.aliases, entity.id.slice(entity.id.indexOf(":") + 1), formerIdsOf(entity).map((id) => id.slice(id.indexOf(":") + 1))]),
  }));
  // Chỉ dựng khi có truy vấn không khớp; đa số request không cần.
  let tokenIndex: Array<{ entity: CatalogEntityView; tokenTerms: TokenTerm[] }> | null = null;
  const recommendRecords = new Map<string, ArtifactRecord[]>();
  const recommended = teams
    .filter((team) => team.collection === "recommended" && team.sourceSeasonId !== null)
    .sort((left, right) => (left.indexPosition ?? 0) - (right.indexPosition ?? 0));
  for (const team of recommended) {
    const source = plain(detailByRef.get(team.ref)!.record, `${team.ref}.record`);
    const bucket = recommendRecords.get(team.sourceSeasonId!) ?? [];
    bucket.push(source);
    recommendRecords.set(team.sourceSeasonId!, bucket);
  }

  const teamTerms = new Map<string, string>();
  for (const team of teams) {
    teamTerms.set(
      team.ref,
      normalizeText([team.nameVi, team.nameZh, team.nickname, ...team.heroes.map((hero) => hero.nameVi)].filter(Boolean).join(" ")),
    );
  }

  return {
    upstream: meta.upstream,
    seasons: registry,
    entities,
    teams,
    routes,
    getEntity: (id) => entityById.get(id) ?? formerIdToSurvivor.get(id),
    searchCatalog(query, options = {}) {
      const { limit, offset } = clampPage(options.limit, options.offset);
      const needle = normalizeText(query);
      const kinds = options.kinds === undefined ? null : new Set<string>(options.kinds);
      const groups = options.groups === undefined ? null : new Set<string>(options.groups);
      const matches: CatalogSearchMatch[] = [];
      for (const item of searchIndex) {
        if ((kinds !== null && !kinds.has(item.entity.kind)) || (groups !== null && !groups.has(item.entity.group))) continue;
        if (needle === "") {
          matches.push({ entity: item.entity, score: 0, matchedTerm: "" });
          continue;
        }
        const { score, matched } = scoreTerms(item.terms, needle);
        if (score >= 1) matches.push({ entity: item.entity, score, matchedTerm: matched });
      }
      matches.sort(
        (left, right) =>
          right.score - left.score
          || (GROUP_ORDER.get(left.entity.group) ?? 0) - (GROUP_ORDER.get(right.entity.group) ?? 0)
          || left.entity.kind.localeCompare(right.entity.kind)
          || left.entity.nameVi.localeCompare(right.entity.nameVi, "vi")
          || left.entity.id.localeCompare(right.entity.id),
      );
      return { total: matches.length, offset, limit, items: matches.slice(offset, offset + limit) };
    },
    similarCatalog(query, options = {}) {
      const limit = clampPage(options.limit, 0).limit;
      const queryTerm = tokenTerm(normalizeText(query), query);
      if (queryTerm.folded.size < MIN_SHARED_TOKENS) return [];
      const kinds = options.kinds === undefined ? null : new Set<string>(options.kinds);
      const scored: Array<CatalogSearchMatch & { accented: number; jaccard: number; covers: boolean; likely: boolean }> = [];
      tokenIndex ??= searchIndex.map(({ entity, terms: entries }) => ({
        entity,
        tokenTerms: entries.map(([normalized, raw]) => tokenTerm(normalized, raw)),
      }));
      for (const item of tokenIndex) {
        if (kinds !== null && !kinds.has(item.entity.kind)) continue;
        const { shared, accented, jaccard, matched } = similarity(item.tokenTerms, queryTerm);
        if (shared < MIN_SHARED_TOKENS) continue;
        const covering = item.tokenTerms.some((term) => covers(term.words, queryTerm.words));
        scored.push({ entity: item.entity, score: shared, accented, jaccard, matchedTerm: matched, covers: covering, likely: false });
      }
      // likely = mục phủ tên gõ duy nhất trong cùng loại; hai mục cùng loại cùng phủ thì không đoán mục nào.
      const coveringByKind = new Map<string, number>();
      for (const entry of scored) if (entry.covers) coveringByKind.set(entry.entity.kind, (coveringByKind.get(entry.entity.kind) ?? 0) + 1);
      for (const entry of scored) entry.likely = entry.covers && coveringByKind.get(entry.entity.kind) === 1;
      scored.sort(
        (left, right) =>
          Number(right.likely) - Number(left.likely)
          || right.score - left.score
          || right.accented - left.accented
          || right.jaccard - left.jaccard
          || (GROUP_ORDER.get(left.entity.group) ?? 0) - (GROUP_ORDER.get(right.entity.group) ?? 0)
          || left.entity.kind.localeCompare(right.entity.kind)
          || left.entity.nameVi.localeCompare(right.entity.nameVi, "vi")
          || left.entity.id.localeCompare(right.entity.id),
      );
      return scored.slice(0, limit).map(({ entity, score, matchedTerm, likely }) => ({ entity, score, matchedTerm, likely }));
    },
    findTeams(filter = {}) {
      const { limit, offset } = clampPage(filter.limit, filter.offset);
      const needle = filter.query === undefined ? "" : normalizeText(filter.query);
      const matched = teams.filter((team) => {
        if (filter.collection !== undefined && team.collection !== filter.collection) return false;
        if (filter.sourceSeasonId !== undefined && team.sourceSeasonId !== filter.sourceSeasonId) return false;
        if (filter.sourceCategoryId !== undefined && team.sourceCategoryId !== filter.sourceCategoryId) return false;
        if (filter.tierRaw !== undefined && team.tierRaw !== filter.tierRaw) return false;
        if (filter.unitType !== undefined && !team.unitTypes.includes(filter.unitType)) return false;
        if (filter.heroIds?.some((id) => !team.heroes.some((hero) => hero.heroId === id))) return false;
        if (
          filter.tacticIds?.some((id) => !team.heroes.some((hero) => hero.tactics.some((slot) => slot.tacticId === id)))
        ) return false;
        if (needle !== "" && !(teamTerms.get(team.ref) ?? "").includes(needle)) return false;
        return true;
      });
      // Deterministic: collection order, season order, tier order (best first), score (highest first), ref.
      const seasonOrder = new Map(registry.seasonOptions.map((option) => [option.sourceSeasonId, option.sourceOrder]));
      matched.sort(
        (left, right) =>
          (COLLECTION_ORDER.get(left.collection) ?? 0) - (COLLECTION_ORDER.get(right.collection) ?? 0)
          || (seasonOrder.get(left.sourceSeasonId ?? "") ?? Number.MAX_SAFE_INTEGER) - (seasonOrder.get(right.sourceSeasonId ?? "") ?? Number.MAX_SAFE_INTEGER)
          || (left.tierOrder ?? Number.MAX_SAFE_INTEGER) - (right.tierOrder ?? Number.MAX_SAFE_INTEGER)
          || (right.score ?? -Infinity) - (left.score ?? -Infinity)
          || left.ref.localeCompare(right.ref),
      );
      return { total: matched.length, offset, limit, items: matched.slice(offset, offset + limit) };
    },
    getTeam(reference) {
      const detail = detailByRef.get(reference);
      const route = routes.get(reference);
      if (detail === undefined || route === undefined) return undefined;
      return { ...(detail as TeamDetail), pagePath: { vi: route.vi, zh: route.zh } };
    },
    recommendSourceRecords: (sourceSeasonId) => recommendRecords.get(sourceSeasonId) ?? [],
  };
}

export const CATALOG_GROUP_SLUGS = LOOKUP_GROUP_SLUGS;
