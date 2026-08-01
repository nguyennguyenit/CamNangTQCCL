import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  type DataSnapshot,
} from "../../src/data/artifact-contracts.js";
import {
  DataSourceError,
  createCachedDataSource,
  type SnapshotCandidate,
} from "../../src/data/data-source.js";
import { FilesystemDataSource } from "../../src/data/filesystem-data-source.js";

const fixtureRoot = fileURLToPath(
  new URL("../fixtures/release-snapshot", import.meta.url),
);
const originalCwd = process.cwd();

afterEach(() => {
  process.chdir(originalCwd);
});

describe("filesystem data source", () => {
  it("loads from an explicit filesystem root independently of CWD", async () => {
    process.chdir("/tmp");
    const source = new FilesystemDataSource({ dataRoot: fixtureRoot });
    const snapshot = await source.load();

    expect(snapshot.artifacts.teams[0]?.id).toBe("team-a");
    expect(snapshot.releaseId).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("does not expose local paths or bucket keys in public errors", async () => {
    const source = new FilesystemDataSource({
      dataRoot: "/private/not-present",
    });
    try {
      await source.load();
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(DataSourceError);
      expect(String(error)).not.toContain("/private/not-present");
    }
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function candidate(
  snapshot: DataSnapshot,
  versionToken = snapshot.releaseId,
): SnapshotCandidate {
  return { snapshot, versionToken };
}

describe("snapshot cache", () => {
  it("single-flights cold loads and returns the same activated snapshot", async () => {
    const snapshot = await new FilesystemDataSource({
      dataRoot: fixtureRoot,
    }).load();
    const pending = deferred<SnapshotCandidate>();
    let reads = 0;
    const source = createCachedDataSource({
      async loadCandidate() {
        reads += 1;
        return pending.promise;
      },
    });
    const left = source.load();
    const right = source.load();
    pending.resolve(candidate(snapshot));

    await expect(left).resolves.toBe(snapshot);
    await expect(right).resolves.toBe(snapshot);
    expect(reads).toBe(1);
  });

  it("giữ snapshot immutable và không fetch lại trong cùng process", async () => {
    const snapshot = await new FilesystemDataSource({
      dataRoot: fixtureRoot,
    }).load();
    let reads = 0;
    const source = createCachedDataSource({
      async loadCandidate() {
        reads += 1;
        return candidate(snapshot);
      },
    });

    await expect(source.load()).resolves.toBe(snapshot);
    await expect(source.load()).resolves.toBe(snapshot);
    expect(reads).toBe(1);
  });

  it("cho phép retry sau cold-load failure nhưng không cache partial state", async () => {
    const snapshot = await new FilesystemDataSource({
      dataRoot: fixtureRoot,
    }).load();
    let reads = 0;
    const source = createCachedDataSource({
      async loadCandidate() {
        reads += 1;
        if (reads === 1) throw new Error("offline");
        return candidate(snapshot);
      },
    });

    await expect(source.load()).rejects.toMatchObject({
      code: "DATA_UNAVAILABLE",
    });
    await expect(source.load()).resolves.toBe(snapshot);
    expect(reads).toBe(2);
  });
});
