import { readFile, readdir, lstat } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  ARTIFACT_NAMES,
  V2_ARTIFACT_NAMES,
  SEASON_ARTIFACT_NAMES,
  MAX_ARTIFACT_BYTES,
  artifactNamesForManifest,
  createDataManifest,
  validateManifest,
  validateDataSnapshot,
  type ArtifactName,
  type DataManifest,
} from "./artifact-contracts.js";
import {
  DataSourceError,
  createCachedDataSource,
  type DataSource,
} from "./data-source.js";
import { buildPublicationArtifacts } from "./publication-builder.js";
import {
  hasRecommendedPublication,
  readPublicationSources,
  repositoryPublicationRoots,
} from "./publication-source-reader.js";
import {
  LOOKUP_CATALOG_FILE,
  LOOKUP_MANIFEST_FILE,
  verifyLookupPayloads,
} from "./lookup-bundle.js";

const LOOKUP_SIDECARS = [LOOKUP_CATALOG_FILE, LOOKUP_MANIFEST_FILE] as const;

async function readRegularFile(path: string) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_ARTIFACT_BYTES) {
    throw new Error("invalid data artifact");
  }
  return new Uint8Array(await readFile(path));
}

async function assertExactPackageRoot(dataRoot: string, names: readonly ArtifactName[]) {
  const expected = new Set(["manifest.json", ...names.map(name => `${name}.json`)]);
  const entries = await readdir(dataRoot, { withFileTypes: true });
  if (
    entries.length !== expected.size
    || entries.some(entry => !expected.has(entry.name) || !entry.isFile() || entry.isSymbolicLink())
  ) {
    throw new Error("invalid packaged inventory");
  }
}

function containsLookupIdentities(objects: Map<ArtifactName, Uint8Array>) {
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false });
  return (["heroes-dict", "tactics"] as const).some(name => {
    const records = JSON.parse(decoder.decode(objects.get(name)!));
    return Array.isArray(records) && records.some(record =>
      record !== null
      && typeof record === "object"
      && (Object.hasOwn(record, "id") || Object.hasOwn(record, "lookup"))
    );
  });
}

export async function validateLookupRoot(dataRoot: string, objects: Map<ArtifactName, Uint8Array>) {
  const readSidecar = async (name: string) =>
    readRegularFile(resolve(dataRoot, name));
  const [catalogBytes, manifestBytes] = await Promise.all([
    readSidecar(LOOKUP_CATALOG_FILE),
    readSidecar(LOOKUP_MANIFEST_FILE),
  ]);
  await verifyLookupPayloads(manifestBytes, {
    "heroes-dict.json": objects.get("heroes-dict")!,
    "tactics.json": objects.get("tactics")!,
    "lookup-catalog.json": catalogBytes,
  });
}

async function assertNoIncompletePromotion(dataRoot: string) {
  const output = resolve(dirname(dataRoot), "pipeline/lookup-output");
  if ((await lstat(resolve(output, "promotion.lock")).catch(() => null)) !== null) throw new Error("incomplete promotion");
  const transactions = resolve(output, "transactions");
  const observed: string[][] = [];
  for (const entry of (await readdir(transactions, { withFileTypes: true }).catch(() => [])).sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const bytes = await readFile(resolve(transactions, entry.name, "journal.json")).catch(() => null);
    if (bytes === null) {
      observed.push([entry.name, "missing"]);
      continue;
    }
    const journal = JSON.parse(bytes.toString("utf8"));
    if (journal.state === "activation-prepared" || journal.state === "writing") throw new Error("incomplete promotion");
    observed.push([entry.name, bytes.toString("base64")]);
  }
  return JSON.stringify(observed);
}

export async function observeLookupRoot(dataRoot: string) {
  const promotion = await assertNoIncompletePromotion(dataRoot);
  const files = (await readdir(dataRoot)).sort();
  let lookupManifest = "";
  if (files.includes(LOOKUP_MANIFEST_FILE)) {
    const path = resolve(dataRoot, LOOKUP_MANIFEST_FILE);
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_ARTIFACT_BYTES) {
      throw new Error("invalid lookup manifest observation");
    }
    lookupManifest = Buffer.from(await readFile(path)).toString("base64");
  }
  return { files, token: JSON.stringify([files, lookupManifest, promotion]) };
}

export interface FilesystemDataSourceOptions {
  dataRoot: string;
}

const strictDecoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false });

async function readNames(dataRoot: string, names: readonly ArtifactName[]) {
  const entries = await Promise.all(
    names.map(async (name) => [name, await readRegularFile(resolve(dataRoot, `${name}.json`))] as const),
  );
  return new Map<ArtifactName, Uint8Array>(entries);
}

/**
 * A raw checkout publishes v3 when its Recommended selector exists: the projection is built from the
 * verified publication inputs next to `data/` (`src/data/recommended-reference`, `pipeline/`).
 */
async function loadRawRoot(dataRoot: string, files: readonly string[], sidecarCount: number) {
  const seasonalCount = SEASON_ARTIFACT_NAMES.filter(name => files.includes(`${name}.json`)).length;
  if (seasonalCount !== 0 && seasonalCount !== SEASON_ARTIFACT_NAMES.length) throw new Error("partial seasonal inventory");
  const names = seasonalCount === 0 ? ARTIFACT_NAMES : V2_ARTIFACT_NAMES;
  const objects = await readNames(dataRoot, names);
  if (sidecarCount === 0 && containsLookupIdentities(objects)) throw new Error("lookup sidecars are required");
  if (sidecarCount === LOOKUP_SIDECARS.length) await validateLookupRoot(dataRoot, objects);
  const roots = repositoryPublicationRoots(dataRoot);
  if (seasonalCount === SEASON_ARTIFACT_NAMES.length && sidecarCount === LOOKUP_SIDECARS.length && await hasRecommendedPublication(roots)) {
    const publication = await buildPublicationArtifacts({ objects, sources: await readPublicationSources(roots) });
    const all = new Map<ArtifactName, Uint8Array>([...objects, ...publication.artifacts] as Array<[ArtifactName, Uint8Array]>);
    return { manifest: await createDataManifest(all, { publication: publication.meta }), objects: all };
  }
  return { manifest: await createDataManifest(objects), objects };
}

async function loadPackagedRoot(dataRoot: string) {
  const manifestBytes = await readRegularFile(resolve(dataRoot, "manifest.json"));
  const manifest: DataManifest = await validateManifest(JSON.parse(strictDecoder.decode(manifestBytes)));
  const names = artifactNamesForManifest(manifest);
  await assertExactPackageRoot(dataRoot, names);
  return { manifest, objects: await readNames(dataRoot, names) };
}

export class FilesystemDataSource implements DataSource {
  readonly #source: DataSource;

  constructor(options: FilesystemDataSourceOptions) {
    if (
      typeof options.dataRoot !== "string" ||
      options.dataRoot.trim() === ""
    ) {
      throw new TypeError("Filesystem data root is required");
    }
    const dataRoot = resolve(options.dataRoot);
    this.#source = createCachedDataSource(
      {
        async loadCandidate() {
          try {
            const rootInfo = await lstat(dataRoot);
            if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) {
              throw new Error("invalid data root");
            }
            const initial = await observeLookupRoot(dataRoot);
            const files = initial.files;
            const hasPackage = files.includes("manifest.json");
            const sidecarCount = LOOKUP_SIDECARS.filter((name) => files.includes(name)).length;
            if ((hasPackage && sidecarCount !== 0) || sidecarCount === 1) throw new Error("ambiguous data root");
            const { manifest, objects } = hasPackage
              ? await loadPackagedRoot(dataRoot)
              : await loadRawRoot(dataRoot, files, sidecarCount);
            const final = await observeLookupRoot(dataRoot);
            if (final.token !== initial.token) throw new Error("data root changed during capture");
            return {
              snapshot: await validateDataSnapshot(manifest, objects),
              versionToken: manifest.releaseId,
            };
          } catch {
            throw new DataSourceError(
              "DATA_UNAVAILABLE",
              "Không thể tải dữ liệu local hợp lệ.",
            );
          }
        },
      },
    );
  }

  load() {
    return this.#source.load();
  }
}
