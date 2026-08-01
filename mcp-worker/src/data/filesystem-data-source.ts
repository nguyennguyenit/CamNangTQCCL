import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

import {
  ARTIFACT_NAMES,
  MAX_ARTIFACT_BYTES,
  createDataManifest,
  validateDataSnapshot,
  type ArtifactName,
} from "./artifact-contracts.js";
import {
  DataSourceError,
  createCachedDataSource,
  type DataSource,
} from "./data-source.js";

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
            const entries = await Promise.all(
              ARTIFACT_NAMES.map(async (name) => [
                name,
                await (async () => {
                  const path = resolve(dataRoot, `${name}.json`);
                  if ((await stat(path)).size > MAX_ARTIFACT_BYTES) {
                    throw new Error("artifact too large");
                  }
                  return new Uint8Array(await readFile(path));
                })(),
              ] as const),
            );
            const objects = new Map<ArtifactName, Uint8Array>(entries);
            const manifest = await createDataManifest(objects);
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
