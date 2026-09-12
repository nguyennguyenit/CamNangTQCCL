import {
  artifactNamesForVersion,
  MAX_ARTIFACT_BYTES,
  validateDataSnapshot,
  validateManifest,
  type ArtifactName,
} from "./artifact-contracts.js";
import {
  createCachedDataSource,
  DataSourceError,
  type DataSource,
} from "./data-source.js";

export const MAX_MANIFEST_BYTES = 64 * 1024;
const INTERNAL_ASSET_ORIGIN = "https://worker-assets.invalid";

export interface AssetFetcher {
  fetch(request: Request): Promise<Response>;
}

export interface StaticAssetsDataSourceOptions {
  fetcher: AssetFetcher;
}

function unavailable(): DataSourceError {
  return new DataSourceError(
    "DATA_UNAVAILABLE",
    "Không thể tải Worker static assets hợp lệ.",
  );
}

async function readBoundedResponse(
  response: Response,
  maxBytes: number,
): Promise<Uint8Array> {
  if (response.status !== 200 || response.redirected || response.body === null) {
    throw unavailable();
  }
  const contentLength = response.headers.get("Content-Length");
  if (contentLength !== null) {
    if (!/^(?:0|[1-9][0-9]*)$/u.test(contentLength)) throw unavailable();
    const length = Number(contentLength);
    if (!Number.isSafeInteger(length) || length > maxBytes) throw unavailable();
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      const chunk = result.value;
      total += chunk.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw unavailable();
      }
      chunks.push(chunk);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function readAsset(
  fetcher: AssetFetcher,
  path: string,
  maxBytes: number,
): Promise<Uint8Array> {
  if (!/^\/[a-z0-9-]+\.json$/u.test(path)) throw unavailable();
  const request = new Request(new URL(path, INTERNAL_ASSET_ORIGIN), {
    method: "GET",
    redirect: "manual",
  });
  return readBoundedResponse(await fetcher.fetch(request), maxBytes);
}

export class StaticAssetsDataSource implements DataSource {
  readonly #source: DataSource;

  constructor(options: StaticAssetsDataSourceOptions) {
    if (
      typeof options.fetcher !== "object" ||
      options.fetcher === null ||
      typeof options.fetcher.fetch !== "function"
    ) {
      throw new TypeError("Static asset fetcher is required");
    }
    this.#source = createCachedDataSource({
      async loadCandidate() {
        try {
          const manifestBytes = await readAsset(
            options.fetcher,
            "/manifest.json",
            MAX_MANIFEST_BYTES,
          );
          const manifest = await validateManifest(
            JSON.parse(new TextDecoder("utf-8", {
              fatal: true,
              ignoreBOM: false,
            }).decode(manifestBytes)),
          );
          const entries = await Promise.all(
            manifest.artifacts.map(async (descriptor) => [
              descriptor.name,
              await readAsset(
                options.fetcher,
                `/${descriptor.key}`,
                MAX_ARTIFACT_BYTES,
              ),
            ] as const),
          );
          const objects = new Map<ArtifactName, Uint8Array>(entries);
          if (
            objects.size !== artifactNamesForVersion(manifest.schemaVersion).length ||
            artifactNamesForVersion(manifest.schemaVersion).some((name) => !objects.has(name))
          ) {
            throw unavailable();
          }
          return {
            snapshot: await validateDataSnapshot(manifest, objects),
            versionToken: manifest.releaseId,
          };
        } catch {
          throw unavailable();
        }
      },
    });
  }

  load() {
    return this.#source.load();
  }
}
