import type { DataSnapshot } from "./artifact-contracts.js";

export interface DataSourceLoadOptions {
  forceRefresh?: boolean;
}

export interface DataSource {
  load(options?: DataSourceLoadOptions): Promise<DataSnapshot>;
}

export interface SnapshotCandidate {
  snapshot: DataSnapshot;
  versionToken: string;
}

export interface SnapshotLoader {
  loadCandidate(): Promise<SnapshotCandidate>;
}

export interface SnapshotCachePolicy {
  refreshAfterMs: number;
  maxStaleAgeMs: number;
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

interface ActiveSnapshot {
  snapshot: DataSnapshot;
  versionToken: string;
  refreshAfterAt: number;
  serveStaleUntil: number;
  requestId: number;
}

function validatePolicy(policy: SnapshotCachePolicy): void {
  if (
    !Number.isFinite(policy.refreshAfterMs) ||
    policy.refreshAfterMs < 0 ||
    !Number.isFinite(policy.maxStaleAgeMs) ||
    policy.maxStaleAgeMs < 0
  ) {
    throw new TypeError("Snapshot cache durations must be non-negative");
  }
}

function unavailable(): DataSourceError {
  return new DataSourceError(
    "DATA_UNAVAILABLE",
    "Không thể tải snapshot dữ liệu hợp lệ.",
  );
}

export function createCachedDataSource(
  loader: SnapshotLoader,
  policy: SnapshotCachePolicy = {
    refreshAfterMs: 60_000,
    maxStaleAgeMs: 300_000,
  },
  monotonicNow: () => number = () => performance.now(),
): DataSource {
  validatePolicy(policy);
  let active: ActiveSnapshot | null = null;
  let requestCounter = 0;
  let normalRefresh: Promise<DataSnapshot> | null = null;

  async function refresh(): Promise<DataSnapshot> {
    const requestId = ++requestCounter;
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
    if (active === null || requestId >= active.requestId) {
      const activatedAt = monotonicNow();
      active = {
        snapshot: candidate.snapshot,
        versionToken: candidate.versionToken,
        refreshAfterAt: activatedAt + policy.refreshAfterMs,
        serveStaleUntil: activatedAt + policy.maxStaleAgeMs,
        requestId,
      };
    }
    return active.snapshot;
  }

  async function normalRefreshOnce(): Promise<DataSnapshot> {
    if (normalRefresh !== null) return normalRefresh;
    normalRefresh = refresh().finally(() => {
      normalRefresh = null;
    });
    return normalRefresh;
  }

  return {
    async load(options = {}) {
      const now = monotonicNow();
      if (
        options.forceRefresh !== true &&
        active !== null &&
        now < active.refreshAfterAt
      ) {
        return active.snapshot;
      }
      try {
        return options.forceRefresh === true
          ? await refresh()
          : await normalRefreshOnce();
      } catch (error) {
        if (options.forceRefresh === true) {
          if (error instanceof DataSourceError) throw error;
          throw unavailable();
        }
        const failureTime = monotonicNow();
        if (active !== null && failureTime <= active.serveStaleUntil) {
          return active.snapshot;
        }
        if (active === null && error instanceof DataSourceError) {
          throw error;
        }
        throw unavailable();
      }
    },
  };
}
