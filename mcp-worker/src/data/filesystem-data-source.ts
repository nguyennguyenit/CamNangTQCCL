import { readFile, stat, readdir, lstat } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  ARTIFACT_NAMES,
  V2_ARTIFACT_NAMES,
  SEASON_ARTIFACT_NAMES,
  MAX_ARTIFACT_BYTES,
  createDataManifest,
  validateManifest,
  validateDataSnapshot,
  type ArtifactName,
} from "./artifact-contracts.js";
import {
  DataSourceError,
  createCachedDataSource,
  type DataSource,
} from "./data-source.js";
import {
  LOOKUP_CATALOG_FILE,
  LOOKUP_MANIFEST_FILE,
  verifyLookupPayloads,
} from "./lookup-bundle.js";

const LOOKUP_SIDECARS = [LOOKUP_CATALOG_FILE, LOOKUP_MANIFEST_FILE] as const;

export async function validateLookupRoot(dataRoot: string, objects: Map<ArtifactName, Uint8Array>) {
  const readSidecar = async (name: string) => {
    const path = resolve(dataRoot, name);
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_ARTIFACT_BYTES) {
      throw new Error("invalid lookup sidecar");
    }
    return new Uint8Array(await readFile(path));
  };
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
            const initial = await observeLookupRoot(dataRoot);
            const files = initial.files;
            const hasPackage = files.includes("manifest.json");
            const sidecarCount = LOOKUP_SIDECARS.filter((name) => files.includes(name)).length;
            if ((hasPackage && sidecarCount !== 0) || sidecarCount === 1) throw new Error("ambiguous data root");
            const seasonalCount = SEASON_ARTIFACT_NAMES.filter(name => files.includes(`${name}.json`)).length;
            if (seasonalCount !== 0 && seasonalCount !== SEASON_ARTIFACT_NAMES.length) throw new Error("partial seasonal inventory");
            const names = seasonalCount === 0 ? ARTIFACT_NAMES : V2_ARTIFACT_NAMES;
            const entries = await Promise.all(
              names.map(async (name) => [
                name,
                await (async () => {
                  const path = resolve(dataRoot, `${name}.json`);
                  if ((await stat(path)).size > MAX_ARTIFACT_BYTES) throw new Error("artifact too large");
                  return new Uint8Array(await readFile(path));
                })(),
              ] as const),
            );
            const objects = new Map<ArtifactName, Uint8Array>(entries);
            if (sidecarCount === LOOKUP_SIDECARS.length) {
              await validateLookupRoot(dataRoot, objects);
            }
            const manifest = hasPackage
              ? await validateManifest(JSON.parse(await readFile(resolve(dataRoot, "manifest.json"), "utf8")))
              : await createDataManifest(objects);
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
