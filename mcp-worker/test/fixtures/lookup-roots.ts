import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { seasonConsumerFixture } from "../../../tests-js/fixtures/season-fixtures.mjs";
import {
  ARTIFACT_NAMES,
  V2_ARTIFACT_NAMES,
  createDataManifest,
  type ArtifactName,
} from "../../src/data/artifact-contracts.js";
import { canonicalDictionaryId } from "../../src/data/entity-identity.js";
import { stableStringify } from "../../src/domain/contracts.js";

/**
 * Fixture builders for the three exact filesystem formats the MCP ingress must
 * tell apart: an activated raw project root with website lookup sidecars, a
 * packaged MCP release root with its own manifest, and a genuine legacy raw
 * root without either marker. Every root is derived from the existing
 * `release-snapshot` fixture (or the shared season fixture) so MCP artifact
 * contracts and lookup-bundle contracts stay describing the same bytes.
 */

export const releaseSnapshotRoot = fileURLToPath(
  new URL("release-snapshot/", import.meta.url),
);

export const MCP_MANIFEST_NAME = "manifest.json";
export const LOOKUP_MANIFEST_NAME = "lookup-manifest.json";
export const LOOKUP_CATALOG_NAME = "lookup-catalog.json";
export const LOOKUP_PAYLOAD_NAMES = [
  "heroes-dict.json",
  "tactics.json",
  LOOKUP_CATALOG_NAME,
] as const;
export const LOOKUP_SIDECAR_NAMES = [
  LOOKUP_CATALOG_NAME,
  LOOKUP_MANIFEST_NAME,
] as const;

export type JsonRecord = Record<string, unknown>;

export interface LookupBundle {
  heroes: JsonRecord[];
  tactics: JsonRecord[];
  catalog: JsonRecord;
}

export interface LookupManifest extends JsonRecord {
  schemaVersion: number;
  generationId: string;
  files: Record<string, string>;
}

const createdRoots: string[] = [];

export async function removeCreatedRoots(): Promise<void> {
  await Promise.all(
    createdRoots
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
}

async function temporaryRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  createdRoots.push(root);
  return root;
}

export function encodeJson(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes as Uint8Array<ArrayBuffer>,
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Promote plain dictionary records into the published lookup projection:
 * canonical IDs plus the `lookup` relation object, with a catalog whose
 * cross-record references resolve against exactly those IDs.
 */
export function withLookupIdentity(dictionaries: {
  heroes: readonly JsonRecord[];
  tactics: readonly JsonRecord[];
}): LookupBundle {
  const tactics = dictionaries.tactics.map((row) => ({
    ...row,
    id: canonicalDictionaryId("tactics", String(row.viet)),
    lookup: {},
  }));
  const advisorId = "advisor:co-van-a";
  const heroes = dictionaries.heroes.map((row) => ({
    ...row,
    id: canonicalDictionaryId("heroes-dict", String(row.viet)),
    lookup: {
      selfTacticId: tactics[0]?.id ?? null,
      inheritTacticId: tactics[1]?.id ?? null,
      advisorId,
    },
  }));
  const equipmentId = "equipment:bao-giap";
  return {
    heroes,
    tactics,
    catalog: {
      schemaVersion: 1,
      equipment: [{ id: equipmentId, nameVi: "Bảo Giáp" }],
      specials: [
        {
          id: "equipment-special:cuong-hoa",
          equipmentId,
          exclusiveHeroId: heroes[0]?.id ?? null,
        },
      ],
      advisors: [{ id: advisorId, heroIds: heroes.map((hero) => hero.id) }],
      troopMods: [
        {
          id: "troop-mod:ky-binh",
          options: [{ id: "troop-option:ky-binh:tang-cong", nameVi: "Tăng công" }],
          revisions: [],
        },
      ],
      buildings: [
        {
          id: "building:doanh-trai",
          levels: [{ id: "building-level:doanh-trai:1", level: 1, costVi: "100 lương", timeVi: "5 phút" }],
        },
      ],
    },
  };
}

/** The lookup projection of the existing six-artifact release snapshot. */
export async function releaseSnapshotBundle(): Promise<LookupBundle> {
  const [heroes, tactics] = await Promise.all(
    (["heroes-dict", "tactics"] as const).map(
      async (name) =>
        JSON.parse(
          await readFile(join(releaseSnapshotRoot, `${name}.json`), "utf8"),
        ) as JsonRecord[],
    ),
  );
  return withLookupIdentity({ heroes: heroes!, tactics: tactics! });
}

/** The eleven-artifact seasonal corpus, projected into lookup identity. */
export async function seasonSnapshotData(): Promise<{
  data: Record<ArtifactName, unknown>;
  bundle: LookupBundle;
}> {
  const fixture = { ...(await seasonConsumerFixture()), "team-tier": [] } as Record<
    ArtifactName,
    unknown
  >;
  const bundle = withLookupIdentity({
    heroes: fixture["heroes-dict"] as JsonRecord[],
    tactics: fixture.tactics as JsonRecord[],
  });
  return {
    data: { ...fixture, "heroes-dict": bundle.heroes, tactics: bundle.tactics },
    bundle,
  };
}

/**
 * Derive the website lookup manifest the pipeline publishes: per-file SHA-256
 * of the raw bytes plus the generation ID derived from that canonical file map.
 */
export async function lookupManifestFor(
  payloads: Readonly<Record<string, Uint8Array>>,
): Promise<LookupManifest> {
  const files: Record<string, string> = {};
  for (const name of Object.keys(payloads).sort()) {
    files[name] = await sha256Hex(payloads[name]!);
  }
  const canonical = new TextEncoder().encode(`${JSON.stringify(files)}\n`);
  return {
    schemaVersion: 1,
    generationId: `lookup:${await sha256Hex(canonical)}`,
    files,
  };
}

export interface RawRootOptions {
  /** Lookup projection written into the root; defaults to the release snapshot. */
  bundle?: LookupBundle;
  /** Eleven-artifact seasonal inventory instead of the six-artifact one. */
  seasonal?: boolean;
  /** Rewrite the derived lookup manifest before it is written. */
  manifest?: (manifest: LookupManifest) => unknown;
  /** Sidecar basenames to leave out of the root. */
  omitSidecars?: readonly string[];
  /**
   * Bytes written over a payload after the lookup manifest was derived, so the
   * manifest describes a generation the root no longer contains.
   */
  payloadOverrides?: Readonly<Record<string, Uint8Array>>;
  /** Also emit a valid packaged MCP manifest, producing a mixed root. */
  withPackagedManifest?: boolean;
  /** Lookup promotion transaction observable from the project root. */
  transaction?: { id?: string; state?: string; lock?: boolean };
}

export interface RawRoot {
  projectRoot: string;
  dataRoot: string;
}

async function artifactBytes(
  options: RawRootOptions,
  bundle: LookupBundle,
): Promise<Map<ArtifactName, Uint8Array>> {
  if (options.seasonal !== true) {
    const entries = await Promise.all(
      ARTIFACT_NAMES.map(async (name) => {
        if (name === "heroes-dict") return [name, encodeJson(bundle.heroes)] as const;
        if (name === "tactics") return [name, encodeJson(bundle.tactics)] as const;
        return [
          name,
          new Uint8Array(await readFile(join(releaseSnapshotRoot, `${name}.json`))),
        ] as const;
      }),
    );
    return new Map(entries);
  }
  const { data } = await seasonSnapshotData();
  return new Map(
    V2_ARTIFACT_NAMES.map((name) => {
      if (name === "heroes-dict") return [name, encodeJson(bundle.heroes)] as const;
      if (name === "tactics") return [name, encodeJson(bundle.tactics)] as const;
      return [name, encodeJson(data[name])] as const;
    }),
  );
}

async function writeRawRoot(
  dataRoot: string,
  options: RawRootOptions,
): Promise<void> {
  const bundle =
    options.bundle ??
    (options.seasonal === true
      ? (await seasonSnapshotData()).bundle
      : await releaseSnapshotBundle());
  const artifacts = await artifactBytes(options, bundle);
  const payloads: Record<string, Uint8Array> = {
    "heroes-dict.json": artifacts.get("heroes-dict")!,
    "tactics.json": artifacts.get("tactics")!,
    [LOOKUP_CATALOG_NAME]: encodeJson(bundle.catalog),
  };
  const derived = await lookupManifestFor(payloads);
  const manifest = options.manifest?.(derived) ?? derived;
  const omitted = new Set(options.omitSidecars ?? []);

  for (const [name, bytes] of artifacts) {
    await writeFile(join(dataRoot, `${name}.json`), bytes);
  }
  if (!omitted.has(LOOKUP_CATALOG_NAME)) {
    await writeFile(
      join(dataRoot, LOOKUP_CATALOG_NAME),
      payloads[LOOKUP_CATALOG_NAME]!,
    );
  }
  if (!omitted.has(LOOKUP_MANIFEST_NAME)) {
    await writeFile(join(dataRoot, LOOKUP_MANIFEST_NAME), encodeJson(manifest));
  }
  if (options.withPackagedManifest === true) {
    const packaged = await createDataManifest(artifacts);
    await writeFile(
      join(dataRoot, MCP_MANIFEST_NAME),
      new TextEncoder().encode(`${stableStringify(packaged)}\n`),
    );
  }
  for (const [name, bytes] of Object.entries(options.payloadOverrides ?? {})) {
    await writeFile(join(dataRoot, name), bytes);
  }
}

async function writeTransaction(
  projectRoot: string,
  transaction: NonNullable<RawRootOptions["transaction"]>,
  generationId: string,
): Promise<void> {
  const lookupOutput = join(projectRoot, "pipeline", "lookup-output");
  const id = transaction.id ?? "tx-fixture";
  await mkdir(join(lookupOutput, "transactions", id), { recursive: true });
  if (transaction.state !== undefined) {
    await writeFile(
      join(lookupOutput, "transactions", id, "journal.json"),
      encodeJson({
        schemaVersion: 1,
        id,
        state: transaction.state,
        generationId,
        inputHashes: {},
        activationCodeManifestHash: `sha256:${"0".repeat(64)}`,
        paths: [],
      }),
    );
  }
  if (transaction.lock === true) {
    await writeFile(
      join(lookupOutput, "promotion.lock"),
      encodeJson({ pid: process.pid, transaction: id }),
    );
  }
}

/** Activated raw project root: six or eleven artifacts plus lookup sidecars. */
export async function createActivatedRoot(
  options: RawRootOptions = {},
): Promise<RawRoot> {
  const projectRoot = await temporaryRoot("tqccl-activated-root-");
  const dataRoot = join(projectRoot, "data");
  await mkdir(dataRoot);
  await writeRawRoot(dataRoot, options);
  if (options.transaction !== undefined) {
    const manifest = await readFile(
      join(dataRoot, LOOKUP_MANIFEST_NAME),
      "utf8",
    ).catch(() => "{}");
    await writeTransaction(
      projectRoot,
      options.transaction,
      String((JSON.parse(manifest) as JsonRecord).generationId ?? ""),
    );
  }
  return { projectRoot, dataRoot };
}

/** Genuine legacy raw root: dictionaries only, no package or lookup marker. */
export async function createLegacyRoot(): Promise<RawRoot> {
  const projectRoot = await temporaryRoot("tqccl-legacy-root-");
  const dataRoot = join(projectRoot, "data");
  await mkdir(dataRoot);
  await Promise.all(
    ARTIFACT_NAMES.map((name) =>
      copyFile(
        join(releaseSnapshotRoot, `${name}.json`),
        join(dataRoot, `${name}.json`),
      ),
    ),
  );
  return { projectRoot, dataRoot };
}

export interface PackagedRootOptions {
  /** Rewrite the packaged MCP manifest before it is written. */
  manifest?: (manifest: JsonRecord) => unknown;
  /** Add website lookup sidecars, producing a mixed root. */
  withSidecars?: boolean;
}

/**
 * Packaged MCP release root: the exact emitted artifact inventory plus the MCP
 * manifest, with no website sidecars.
 */
export async function createPackagedRoot(
  options: PackagedRootOptions = {},
): Promise<string> {
  const root = await temporaryRoot("tqccl-packaged-root-");
  await Promise.all(
    ARTIFACT_NAMES.map((name) =>
      copyFile(
        join(releaseSnapshotRoot, `${name}.json`),
        join(root, `${name}.json`),
      ),
    ),
  );
  const manifestBytes = new Uint8Array(
    await readFile(join(releaseSnapshotRoot, MCP_MANIFEST_NAME)),
  );
  const manifest = JSON.parse(
    new TextDecoder().decode(manifestBytes),
  ) as JsonRecord;
  const rewritten = options.manifest?.(manifest);
  await writeFile(
    join(root, MCP_MANIFEST_NAME),
    rewritten === undefined ? manifestBytes : encodeJson(rewritten),
  );
  if (options.withSidecars === true) {
    const bundle = await releaseSnapshotBundle();
    const payloads: Record<string, Uint8Array> = {
      "heroes-dict.json": new Uint8Array(
        await readFile(join(root, "heroes-dict.json")),
      ),
      "tactics.json": new Uint8Array(await readFile(join(root, "tactics.json"))),
      [LOOKUP_CATALOG_NAME]: encodeJson(bundle.catalog),
    };
    await writeFile(
      join(root, LOOKUP_CATALOG_NAME),
      payloads[LOOKUP_CATALOG_NAME]!,
    );
    await writeFile(
      join(root, LOOKUP_MANIFEST_NAME),
      encodeJson(await lookupManifestFor(payloads)),
    );
  }
  return root;
}

/**
 * Flat worker-builder source root (no project parent): activated dictionaries
 * plus the two website-only sidecars the builder may read but never emits.
 */
export async function createLookupSourceRoot(
  options: RawRootOptions = {},
): Promise<string> {
  const root = await temporaryRoot("tqccl-lookup-source-");
  await writeRawRoot(root, options);
  return root;
}
