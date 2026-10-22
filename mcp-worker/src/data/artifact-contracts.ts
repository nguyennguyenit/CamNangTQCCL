import { validateSeasonBundle } from "../../../js/season-context.js";
import { stableStringify } from "../domain/contracts.js";
import { MissingBookIdError, canonicalDictionaryId } from "./entity-identity.js";
import {
  PublicationContractError,
  buildPublicationReadModel,
  isPublicationArtifactName,
  publicationArtifactNames,
  validatePublicationMeta,
  type PublicationArtifactName,
  type PublicationMeta,
  type PublicationReadModel,
} from "./publication-projection.js";

export const ARTIFACT_NAMES = [
  "teams",
  "team-tier",
  "coexist",
  "heroes-dict",
  "tactics",
  "books-dict",
] as const;

export const SEASON_ARTIFACT_NAMES = ["season-registry", "season-evidence", "season-team-configs", "season-team-evaluations", "season-content-links"] as const;
export const V2_ARTIFACT_NAMES = [...ARTIFACT_NAMES, ...SEASON_ARTIFACT_NAMES] as const;
export type ManifestVersion = 1 | 2 | 3;
export type LegacyArtifactName = (typeof V2_ARTIFACT_NAMES)[number];
/** Names of the fixed v1/v2 inventories. v3 inventory is derived from its validated manifest only. */
export function artifactNamesForVersion(version: 1 | 2) {
  return version === 1 ? ARTIFACT_NAMES : V2_ARTIFACT_NAMES;
}
export type ArtifactName = LegacyArtifactName | PublicationArtifactName;
/** The exact artifact inventory a validated manifest declares, in manifest order. */
export function artifactNamesForManifest(manifest: { schemaVersion: ManifestVersion; artifacts: readonly { name: ArtifactName }[] }): readonly ArtifactName[] {
  return manifest.schemaVersion === 3 ? manifest.artifacts.map(({ name }) => name) : artifactNamesForVersion(manifest.schemaVersion);
}
export type SeasonModel = Awaited<ReturnType<typeof validateSeasonBundle>>;
export type ArtifactRecord = Record<string, unknown>;
export type ParsedArtifact = readonly ArtifactRecord[];
export type ArtifactBytes = ReadonlyMap<ArtifactName, Uint8Array>;
export const MAX_ARTIFACT_BYTES = 8 * 1024 * 1024;

export interface ArtifactDescriptor {
  name: ArtifactName;
  key: `${ArtifactName}.json`;
  sha256: `sha256:${string}`;
  byteLength: number;
  count: number;
}

interface DataManifestBase {
  releaseId: `sha256:${string}`;
  dataVersion: `data:${string}`;
  artifacts: readonly ArtifactDescriptor[];
}

export interface DataManifestV1 extends DataManifestBase { schemaVersion: 1 }
export interface DataManifestV2 extends DataManifestBase { schemaVersion: 2 }
/** v2 plus the public publication projection; `publication` is part of the release identity. */
export interface DataManifestV3 extends DataManifestBase { schemaVersion: 3; publication: PublicationMeta }
export type DataManifest = DataManifestV1 | DataManifestV2 | DataManifestV3;

export interface SnapshotArtifacts {
  teams: ParsedArtifact;
  "team-tier": ParsedArtifact;
  coexist: ParsedArtifact;
  "heroes-dict": ParsedArtifact;
  tactics: ParsedArtifact;
  "books-dict": ParsedArtifact;
  "season-registry"?: ParsedArtifact;
  "season-evidence"?: ParsedArtifact;
  "season-team-configs"?: ParsedArtifact;
  "season-team-evaluations"?: ParsedArtifact;
  "season-content-links"?: ParsedArtifact;
}

export interface DataSnapshot {
  releaseId: DataManifest["releaseId"];
  dataVersion: DataManifest["dataVersion"];
  manifest: DataManifest;
  artifacts: SnapshotArtifacts;
  warnings: readonly string[];
  seasonModel?: SeasonModel;
  /** Present only for manifest v3. Absent v1/v2 means "capability unavailable", never "empty". */
  publication?: PublicationReadModel;
}

export class ArtifactContractError extends Error {
  constructor(
    readonly code:
      | "INVALID_ARTIFACT"
      | "INVALID_MANIFEST"
      | "ARTIFACT_MISMATCH",
    message: string,
  ) {
    super(message);
    this.name = "ArtifactContractError";
  }
}

const textDecoder = new TextDecoder("utf-8", {
  fatal: true,
  ignoreBOM: false,
});

function record(value: unknown, label: string): ArtifactRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ArtifactContractError(
      "INVALID_ARTIFACT",
      `${label} must be an object`,
    );
  }
  return value as ArtifactRecord;
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ArtifactContractError(
      "INVALID_ARTIFACT",
      `${label} must be a non-empty string`,
    );
  }
  return value;
}

function optionalString(value: unknown, label: string): void {
  if (value !== undefined && value !== null && typeof value !== "string") {
    throw new ArtifactContractError(
      "INVALID_ARTIFACT",
      `${label} must be a string when present`,
    );
  }
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new ArtifactContractError(
      "INVALID_ARTIFACT",
      `${label} must be an array`,
    );
  }
  return value;
}

function validateStringArray(value: unknown, label: string): void {
  array(value, label).forEach((item, index) => {
    nonEmptyString(item, `${label}[${index}]`);
  });
}

function validateBuildHero(value: unknown, label: string): void {
  const hero = record(value, label);
  nonEmptyString(hero.name, `${label}.name`);
  if (hero.tactics !== undefined) {
    array(hero.tactics, `${label}.tactics`).forEach((value, index) => {
      if (typeof value === "string") {
        nonEmptyString(value, `${label}.tactics[${index}]`);
        return;
      }
      const tactic = record(value, `${label}.tactics[${index}]`);
      nonEmptyString(tactic.name, `${label}.tactics[${index}].name`);
      if (tactic.alternatives !== undefined) {
        validateStringArray(
          tactic.alternatives,
          `${label}.tactics[${index}].alternatives`,
        );
      }
    });
  }
  if (hero.books !== undefined) {
    array(hero.books, `${label}.books`).forEach((value, index) => {
      if (typeof value === "string") {
        nonEmptyString(value, `${label}.books[${index}]`);
        return;
      }
      const book = record(value, `${label}.books[${index}]`);
      nonEmptyString(book.name, `${label}.books[${index}].name`);
    });
  }
}

function validateArtifactRecords(
  name: ArtifactName,
  records: readonly unknown[],
): ParsedArtifact {
  const parsed = records.map((value, index) => {
    const label = `${name}[${index}]`;
    const item = record(value, label);
    if (name === "teams") {
      nonEmptyString(item.id, `${label}.id`);
      nonEmptyString(item.name, `${label}.name`);
      array(item.heroes, `${label}.heroes`).forEach((hero, heroIndex) =>
        validateBuildHero(hero, `${label}.heroes[${heroIndex}]`),
      );
    } else if (name === "team-tier") {
      nonEmptyString(item.teamId, `${label}.teamId`);
      array(item.rankings, `${label}.rankings`).forEach(
        (ranking, rankingIndex) => {
          const parsedRanking = record(
            ranking,
            `${label}.rankings[${rankingIndex}]`,
          );
          nonEmptyString(
            parsedRanking.tier,
            `${label}.rankings[${rankingIndex}].tier`,
          );
          optionalString(
            parsedRanking.source,
            `${label}.rankings[${rankingIndex}].source`,
          );
          optionalString(
            parsedRanking.updatedAt,
            `${label}.rankings[${rankingIndex}].updatedAt`,
          );
        },
      );
    } else if (name === "coexist") {
      optionalString(item.groupLabel, `${label}.groupLabel`);
      array(item.teams, `${label}.teams`).forEach((team, teamIndex) => {
        const parsedTeam = record(team, `${label}.teams[${teamIndex}]`);
        nonEmptyString(
          parsedTeam.teamName,
          `${label}.teams[${teamIndex}].teamName`,
        );
        array(
          parsedTeam.heroes,
          `${label}.teams[${teamIndex}].heroes`,
        ).forEach((hero, heroIndex) =>
          validateBuildHero(
            hero,
            `${label}.teams[${teamIndex}].heroes[${heroIndex}]`,
          ),
        );
      });
    } else if (!(SEASON_ARTIFACT_NAMES as readonly string[]).includes(name)) {
      nonEmptyString(item.viet, `${label}.viet`);
      optionalString(item.chinese, `${label}.chinese`);
      optionalString(item.hanViet, `${label}.hanViet`);
    }
    return item;
  });

  if (name === "teams") {
    const ids = new Set<string>();
    parsed.forEach((team, index) => {
      const id = team.id as string;
      if (ids.has(id)) {
        throw new ArtifactContractError(
          "INVALID_ARTIFACT",
          `teams[${index}].id is duplicated`,
        );
      }
      ids.add(id);
    });
  }
  return parsed;
}

export function parseArtifact(
  name: ArtifactName,
  bytes: Uint8Array,
): ParsedArtifact {
  if (bytes.byteLength > MAX_ARTIFACT_BYTES) {
    throw new ArtifactContractError(
      "INVALID_ARTIFACT",
      `artifact ${name} exceeds the size limit`,
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(textDecoder.decode(bytes));
  } catch {
    throw new ArtifactContractError(
      "INVALID_ARTIFACT",
      `artifact ${name} contains invalid JSON`,
    );
  }
  if (!Array.isArray(value)) {
    throw new ArtifactContractError(
      "INVALID_ARTIFACT",
      `artifact ${name} must contain an array`,
    );
  }
  if (isPublicationArtifactName(name)) {
    return value.map((item, index) => record(item, `${name}[${index}]`));
  }
  const parsed = validateArtifactRecords(name, value);
  if (
    name === "heroes-dict" ||
    name === "tactics" ||
    name === "books-dict"
  ) {
    const identities = new Set<string>();
    parsed.forEach((item, index) => {
      let identity: string;
      try {
        identity = canonicalDictionaryId(name, item.viet as string, item.id);
      } catch (error) {
        if (error instanceof MissingBookIdError) {
          throw new ArtifactContractError("INVALID_ARTIFACT", `${name}[${index}] has no frozen id (book:<slug>)`);
        }
        throw error;
      }
      if (identities.has(identity)) {
        throw new ArtifactContractError(
          "INVALID_ARTIFACT",
          `${name}[${index}].viet has a duplicate canonical identity`,
        );
      }
      identities.add(identity);
    });
  }
  return parsed;
}

async function sha256(bytes: Uint8Array): Promise<`sha256:${string}`> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes as Uint8Array<ArrayBuffer>,
  );
  return `sha256:${[...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

function canonicalManifestPayload(
  artifacts: readonly ArtifactDescriptor[],
  schemaVersion: ManifestVersion,
  publication?: PublicationMeta,
): unknown {
  return {
    schemaVersion,
    artifacts: artifacts.map(
      ({ name, key, sha256: digest, byteLength, count }) => ({
        name,
        key,
        sha256: digest,
        byteLength,
        count,
      }),
    ),
    // v1/v2 identity is exactly the pre-v3 payload; only v3 binds the projection metadata.
    ...(schemaVersion === 3 ? { publication } : {}),
  };
}

async function manifestIdentity(
  artifacts: readonly ArtifactDescriptor[],
  schemaVersion: ManifestVersion,
  publication?: PublicationMeta,
): Promise<{
  releaseId: DataManifest["releaseId"];
  dataVersion: DataManifest["dataVersion"];
}> {
  const releaseId = await sha256(
    new TextEncoder().encode(
      stableStringify(canonicalManifestPayload(artifacts, schemaVersion, publication)),
    ),
  );
  return {
    releaseId,
    dataVersion: `data:${releaseId.slice("sha256:".length, 19)}`,
  };
}

function expectedArtifactNames(schemaVersion: ManifestVersion, publication?: PublicationMeta): readonly ArtifactName[] {
  return schemaVersion === 3
    ? [...V2_ARTIFACT_NAMES, ...publicationArtifactNames(publication!.shards)]
    : artifactNamesForVersion(schemaVersion);
}

function requireExactArtifactBytes(
  objects: ArtifactBytes,
  schemaVersion: ManifestVersion,
  publication?: PublicationMeta,
): void {
  const expectedNames = expectedArtifactNames(schemaVersion, publication);
  const keys = [...objects.keys()] as string[];
  const unknown = keys.find((name) => !(expectedNames as readonly string[]).includes(name));
  if (unknown) {
    throw new ArtifactContractError(
      "INVALID_MANIFEST",
      `unknown artifact: ${unknown}`,
    );
  }
  const missing = expectedNames.find((name) => !objects.has(name));
  if (missing) {
    throw new ArtifactContractError(
      "INVALID_MANIFEST",
      `missing required artifact: ${missing}`,
    );
  }
}

function publicationMeta(value: unknown): PublicationMeta {
  try {
    return validatePublicationMeta(value);
  } catch (error) {
    throw new ArtifactContractError(
      "INVALID_MANIFEST",
      error instanceof PublicationContractError ? error.message : "invalid publication metadata",
    );
  }
}

export interface CreateDataManifestOptions {
  /** Supplying publication metadata creates a v3 manifest; the objects must then hold the publication artifacts. */
  publication?: PublicationMeta;
}

export async function createDataManifest(
  objects: ArtifactBytes,
  options: CreateDataManifestOptions = {},
): Promise<DataManifest> {
  const publication = options.publication === undefined ? undefined : publicationMeta(options.publication);
  const schemaVersion: ManifestVersion = publication !== undefined
    ? 3
    : SEASON_ARTIFACT_NAMES.some(name => objects.has(name)) ? 2 : 1;
  requireExactArtifactBytes(objects, schemaVersion, publication);
  const artifacts = await Promise.all(
    expectedArtifactNames(schemaVersion, publication).map(async (name): Promise<ArtifactDescriptor> => {
      const bytes = objects.get(name)!;
      const parsed = parseArtifact(name, bytes);
      return {
        name,
        key: `${name}.json`,
        sha256: await sha256(bytes),
        byteLength: bytes.byteLength,
        count: parsed.length,
      };
    }),
  );
  const identity = await manifestIdentity(artifacts, schemaVersion, publication);
  if (schemaVersion === 3) {
    return { schemaVersion, ...identity, artifacts, publication: publication! };
  }
  return {
    schemaVersion,
    ...identity,
    artifacts,
  };
}

function manifestRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ArtifactContractError(
      "INVALID_MANIFEST",
      "manifest must be an object",
    );
  }
  return value as Record<string, unknown>;
}

function manifestString(value: unknown, label: string): string {
  if (typeof value !== "string" || value === "") {
    throw new ArtifactContractError(
      "INVALID_MANIFEST",
      `${label} must be a non-empty string`,
    );
  }
  return value;
}

export async function validateManifest(value: unknown): Promise<DataManifest> {
  const input = manifestRecord(value);
  if (input.schemaVersion !== 1 && input.schemaVersion !== 2 && input.schemaVersion !== 3) {
    throw new ArtifactContractError(
      "INVALID_MANIFEST",
      "manifest schemaVersion must be 1, 2 or 3",
    );
  }
  const schemaVersion: ManifestVersion = input.schemaVersion;
  const keys = Object.keys(input).sort().join(",");
  if (schemaVersion === 3 ? keys !== "artifacts,dataVersion,publication,releaseId,schemaVersion" : input.publication !== undefined) {
    throw new ArtifactContractError("INVALID_MANIFEST", "manifest has an unexpected key set");
  }
  const publication = schemaVersion === 3 ? publicationMeta(input.publication) : undefined;
  const expectedNames = expectedArtifactNames(schemaVersion, publication);
  if (!Array.isArray(input.artifacts)) {
    throw new ArtifactContractError(
      "INVALID_MANIFEST",
      "manifest artifacts must be an array",
    );
  }
  const seen = new Set<string>();
  const descriptors = input.artifacts.map((descriptorValue, index) => {
    const descriptor = manifestRecord(descriptorValue);
    const name = manifestString(
      descriptor.name,
      `manifest artifacts[${index}].name`,
    );
    if (!(expectedNames as readonly string[]).includes(name)) {
      throw new ArtifactContractError(
        "INVALID_MANIFEST",
        `unknown artifact: ${name}`,
      );
    }
    if (seen.has(name)) {
      throw new ArtifactContractError(
        "INVALID_MANIFEST",
        `duplicate artifact: ${name}`,
      );
    }
    seen.add(name);
    const artifactName = name as ArtifactName;
    const key = manifestString(
      descriptor.key,
      `manifest artifacts[${index}].key`,
    );
    if (key !== `${artifactName}.json`) {
      throw new ArtifactContractError(
        "INVALID_MANIFEST",
        `artifact key is invalid for ${artifactName}`,
      );
    }
    const digest = manifestString(
      descriptor.sha256,
      `manifest artifacts[${index}].sha256`,
    );
    if (!/^sha256:[a-f0-9]{64}$/u.test(digest)) {
      throw new ArtifactContractError(
        "INVALID_MANIFEST",
        `manifest artifact ${artifactName} has invalid sha256`,
      );
    }
    for (const field of ["byteLength", "count"] as const) {
      if (
        !Number.isSafeInteger(descriptor[field]) ||
        (descriptor[field] as number) < 0 ||
        (field === "byteLength" &&
          (descriptor[field] as number) > MAX_ARTIFACT_BYTES)
      ) {
        throw new ArtifactContractError(
          "INVALID_MANIFEST",
          `manifest artifact ${artifactName} has invalid ${field}`,
        );
      }
    }
    return {
      name: artifactName,
      key: key as ArtifactDescriptor["key"],
      sha256: digest as ArtifactDescriptor["sha256"],
      byteLength: descriptor.byteLength as number,
      count: descriptor.count as number,
    };
  });
  const missing = expectedNames.find((name) => !seen.has(name));
  if (missing) {
    throw new ArtifactContractError(
      "INVALID_MANIFEST",
      `missing required artifact: ${missing}`,
    );
  }
  const byName = new Map(descriptors.map((item) => [item.name, item]));
  const artifacts = expectedNames.map((name) => byName.get(name)!);
  const expected = await manifestIdentity(artifacts, schemaVersion, publication);
  const releaseId = manifestString(input.releaseId, "manifest releaseId");
  const dataVersion = manifestString(input.dataVersion, "manifest dataVersion");
  if (
    releaseId !== expected.releaseId ||
    dataVersion !== expected.dataVersion
  ) {
    throw new ArtifactContractError(
      "INVALID_MANIFEST",
      "manifest identity does not match its canonical content",
    );
  }
  const base = {
    releaseId: releaseId as DataManifest["releaseId"],
    dataVersion: dataVersion as DataManifest["dataVersion"],
    artifacts,
  };
  return schemaVersion === 3 ? { schemaVersion, ...base, publication: publication! } : { schemaVersion, ...base };
}

export function validateCrossReferences(
  artifacts: SnapshotArtifacts,
): string[] {
  const teamIds = new Set(
    artifacts.teams.map((team) => nonEmptyString(team.id, "team.id")),
  );
  return artifacts["team-tier"].flatMap((tier) => {
    const teamId = nonEmptyString(tier.teamId, "team-tier.teamId");
    return teamIds.has(teamId) ? [] : [`tier-team-not-found:${teamId}`];
  });
}

/** Cross-checks that make a v3 projection part of exactly this release's legacy artifacts and upstream pins. */
function validatePublicationBinding(
  manifest: DataManifest & { schemaVersion: 3 },
  entries: ReadonlyMap<ArtifactName, ParsedArtifact>,
): PublicationReadModel {
  const { upstream, shards } = manifest.publication;
  const digest = (name: ArtifactName) => manifest.artifacts.find((descriptor) => descriptor.name === name)?.sha256;
  for (const key of ["books-dict", "heroes-dict", "tactics", "teams"] as const) {
    if (upstream.sources[key] !== digest(key)) {
      throw new ArtifactContractError("ARTIFACT_MISMATCH", `publication upstream ${key} differs from the release artifact`);
    }
  }
  const family = (prefix: "catalog-entities" | "reference-team-details") =>
    Array.from({ length: shards[prefix] }, (_, index) => entries.get(`${prefix}-${String(index).padStart(2, "0")}` as ArtifactName)!);
  try {
    return buildPublicationReadModel(
      {
        entityShards: family("catalog-entities"),
        registry: entries.get("reference-registry")!,
        teamIndex: entries.get("reference-team-index")!,
        detailShards: family("reference-team-details"),
        routes: entries.get("public-routes")!,
      },
      manifest.publication,
    );
  } catch (error) {
    throw new ArtifactContractError(
      "INVALID_ARTIFACT",
      error instanceof PublicationContractError ? error.message : "publication projection is invalid",
    );
  }
}

export async function validateDataSnapshot(
  manifestValue: unknown,
  objects: ArtifactBytes,
): Promise<DataSnapshot> {
  const manifest = await validateManifest(manifestValue);
  requireExactArtifactBytes(objects, manifest.schemaVersion, manifest.schemaVersion === 3 ? manifest.publication : undefined);
  const parsedEntries = await Promise.all(
    manifest.artifacts.map(async (descriptor) => {
      const bytes = objects.get(descriptor.name)!;
      if (
        bytes.byteLength !== descriptor.byteLength ||
        (await sha256(bytes)) !== descriptor.sha256
      ) {
        throw new ArtifactContractError(
          "ARTIFACT_MISMATCH",
          `artifact ${descriptor.name} does not match the manifest`,
        );
      }
      const parsed = parseArtifact(descriptor.name, bytes);
      if (parsed.length !== descriptor.count) {
        throw new ArtifactContractError(
          "ARTIFACT_MISMATCH",
          `artifact ${descriptor.name} count does not match the manifest`,
        );
      }
      return [descriptor.name, parsed] as const;
    }),
  );
  const legacyNames: readonly string[] = V2_ARTIFACT_NAMES;
  const artifacts = Object.fromEntries(
    parsedEntries.filter(([name]) => legacyNames.includes(name)),
  ) as unknown as SnapshotArtifacts;
  let seasonModel: SeasonModel | undefined;
  if (manifest.schemaVersion >= 2) {
    try {
      const { "team-tier": _tiers, ...bundle } = artifacts;
      seasonModel = await validateSeasonBundle(bundle);
      for (const link of artifacts["season-content-links"] ?? []) {
        const target = link.target as ArtifactRecord;
        if (target.type === "source-owned-coexist") {
          const payload = target.payload as ArtifactRecord;
          if ((payload.teams as unknown[]).length > 10) {
            throw new ArtifactContractError("INVALID_ARTIFACT", "source group exceeds the MCP team limit");
          }
        }
      }
    } catch {
      throw new ArtifactContractError("INVALID_ARTIFACT", "seasonal artifact contracts are invalid");
    }
  }
  const publication = manifest.schemaVersion === 3
    ? validatePublicationBinding(manifest, new Map(parsedEntries))
    : undefined;
  return {
    releaseId: manifest.releaseId,
    dataVersion: manifest.dataVersion,
    manifest,
    artifacts,
    warnings: validateCrossReferences(artifacts),
    ...(seasonModel === undefined ? {} : { seasonModel }),
    ...(publication === undefined ? {} : { publication }),
  };
}
