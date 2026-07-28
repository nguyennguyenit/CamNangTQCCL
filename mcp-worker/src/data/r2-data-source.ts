import {
  MAX_ARTIFACT_BYTES,
  validateDataSnapshot,
  validateManifest,
  type ArtifactName,
  type ReleasePointer,
} from "./artifact-contracts.js";
import {
  DataSourceError,
  createCachedDataSource,
  type DataSource,
  type DataSourceLoadOptions,
  type SnapshotCachePolicy,
} from "./data-source.js";

export interface ReadObject {
  bytes: Uint8Array;
  etag?: string;
}

export interface PointerReader {
  readCurrent(): Promise<ReadObject | null>;
}

export interface ReleaseReader {
  readKnownObject(key: string): Promise<ReadObject | null>;
}

export interface R2DataSourceOptions {
  pointerReader: PointerReader;
  releaseReader: ReleaseReader;
  cachePolicy?: SnapshotCachePolicy;
  monotonicNow?: () => number;
}

const MAX_POINTER_BYTES = 64 * 1024;
const MAX_MANIFEST_BYTES = 1024 * 1024;
const decoder = new TextDecoder("utf-8", {
  fatal: true,
  ignoreBOM: false,
});

function parseJsonObject(bytes: Uint8Array, label: string): Record<string, unknown> {
  try {
    const value = JSON.parse(decoder.decode(bytes));
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error("not object");
    }
    return value as Record<string, unknown>;
  } catch {
    throw new DataSourceError(
      label === "pointer" ? "INVALID_POINTER" : "INVALID_RELEASE",
      `Dữ liệu ${label} không hợp lệ.`,
      false,
    );
  }
}

function parsePointer(object: ReadObject): ReleasePointer {
  if (object.bytes.byteLength > MAX_POINTER_BYTES) {
    throw new DataSourceError(
      "INVALID_POINTER",
      "Release pointer vượt giới hạn.",
      false,
    );
  }
  const pointer = parseJsonObject(object.bytes, "pointer");
  if (
    pointer.schemaVersion !== 1 ||
    typeof pointer.releaseId !== "string" ||
    !/^sha256:[a-f0-9]{64}$/u.test(pointer.releaseId) ||
    typeof pointer.manifestKey !== "string"
  ) {
    throw new DataSourceError(
      "INVALID_POINTER",
      "Release pointer không hợp lệ.",
      false,
    );
  }
  const digest = pointer.releaseId.slice("sha256:".length);
  if (pointer.manifestKey !== `releases/${digest}/manifest.json`) {
    throw new DataSourceError(
      "INVALID_POINTER",
      "Release pointer chứa manifest key không hợp lệ.",
      false,
    );
  }
  return {
    schemaVersion: 1,
    releaseId: pointer.releaseId as ReleasePointer["releaseId"],
    manifestKey: pointer.manifestKey,
  };
}

async function requiredObject(
  reader: ReleaseReader,
  key: string,
  limit: number,
): Promise<ReadObject> {
  const object = await reader.readKnownObject(key);
  if (object === null || object.bytes.byteLength > limit) {
    throw new DataSourceError(
      "DATA_UNAVAILABLE",
      "Release object không khả dụng.",
    );
  }
  return object;
}

export class R2DataSource implements DataSource {
  readonly #source: DataSource;

  constructor(options: R2DataSourceOptions) {
    this.#source = createCachedDataSource(
      {
        async loadCandidate() {
          const pointerObject = await options.pointerReader.readCurrent();
          if (pointerObject === null) {
            throw new DataSourceError(
              "DATA_UNAVAILABLE",
              "Release pointer không khả dụng.",
            );
          }
          const pointer = parsePointer(pointerObject);
          try {
            const manifestObject = await requiredObject(
              options.releaseReader,
              pointer.manifestKey,
              MAX_MANIFEST_BYTES,
            );
            const manifest = await validateManifest(
              parseJsonObject(manifestObject.bytes, "manifest"),
            );
            if (manifest.releaseId !== pointer.releaseId) {
              throw new DataSourceError(
                "INVALID_RELEASE",
                "Release identity không khớp pointer.",
                false,
              );
            }
            const prefix = `releases/${pointer.releaseId.slice("sha256:".length)}`;
            const entries = await Promise.all(
              manifest.artifacts.map(async (descriptor) => {
                const expectedKey = `${prefix}/${descriptor.name}.json`;
                const object = await requiredObject(
                  options.releaseReader,
                  expectedKey,
                  Math.min(
                    MAX_ARTIFACT_BYTES,
                    Math.max(descriptor.byteLength, 1),
                  ),
                );
                return [descriptor.name, object.bytes] as const;
              }),
            );
            const objects = new Map<ArtifactName, Uint8Array>(entries);
            return {
              snapshot: await validateDataSnapshot(manifest, objects),
              versionToken: `${pointer.releaseId}:${pointerObject.etag ?? ""}`,
            };
          } catch {
            throw new DataSourceError(
              "DATA_UNAVAILABLE",
              "Không thể kích hoạt release dữ liệu hợp lệ.",
            );
          }
        },
      },
      options.cachePolicy,
      options.monotonicNow,
    );
  }

  load(options?: DataSourceLoadOptions) {
    return this.#source.load(options);
  }
}
