import type { DataSnapshot } from "./artifact-contracts.js";

export interface DataSource {
  load(): Promise<DataSnapshot>;
}

export interface SnapshotCandidate {
  snapshot: DataSnapshot;
  versionToken: string;
}

export interface SnapshotLoader {
  loadCandidate(): Promise<SnapshotCandidate>;
}

export class DataSourceError extends Error {
  constructor(
    readonly code:
      | "DATA_UNAVAILABLE"
      | "INVALID_POINTER"
      | "INVALID_RELEASE",
    message: string,
    readonly retryable = true,
  ) {
    super(message);
    this.name = "DataSourceError";
  }
}

function unavailable(): DataSourceError {
  return new DataSourceError(
    "DATA_UNAVAILABLE",
    "Không thể tải snapshot dữ liệu hợp lệ.",
  );
}

export function createCachedDataSource(loader: SnapshotLoader): DataSource {
  let active: DataSnapshot | null = null;
  let pending: Promise<DataSnapshot> | null = null;

  async function activate(): Promise<DataSnapshot> {
    try {
      const candidate = await loader.loadCandidate();
      if (
        typeof candidate.versionToken !== "string" ||
        candidate.versionToken === ""
      ) {
        throw new DataSourceError(
          "INVALID_RELEASE",
          "Snapshot candidate thiếu version token.",
          false,
        );
      }
      active = candidate.snapshot;
      return active;
    } catch (error) {
      if (error instanceof DataSourceError) throw error;
      throw unavailable();
    } finally {
      pending = null;
    }
  }

  return {
    load() {
      if (active !== null) return Promise.resolve(active);
      pending ??= activate();
      return pending;
    },
  };
}
