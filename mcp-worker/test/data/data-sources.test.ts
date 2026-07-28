import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  ARTIFACT_NAMES,
  createDataManifest,
  type ArtifactName,
  type DataSnapshot,
} from "../../src/data/artifact-contracts.js";
import {
  DataSourceError,
  createCachedDataSource,
  type SnapshotCandidate,
} from "../../src/data/data-source.js";
import { FilesystemDataSource } from "../../src/data/filesystem-data-source.js";
import {
  R2DataSource,
  type PointerReader,
  type ReadObject,
  type ReleaseReader,
} from "../../src/data/r2-data-source.js";
import { createResearchHandlers } from "../../src/research/research-handlers.js";

const fixtureRoot = fileURLToPath(
  new URL("../fixtures/release-snapshot", import.meta.url),
);
const originalCwd = process.cwd();

afterEach(() => {
  process.chdir(originalCwd);
});

async function fixtureBytes() {
  return new Map(
    await Promise.all(
      ARTIFACT_NAMES.map(async (name) => [
        name,
        new Uint8Array(
          await readFile(
            new URL(`../fixtures/release-snapshot/${name}.json`, import.meta.url),
          ),
        ),
      ] as const),
    ),
  );
}

function jsonBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

class MemoryPointerReader implements PointerReader {
  constructor(public current: ReadObject | null) {}

  async readCurrent(): Promise<ReadObject | null> {
    return this.current;
  }
}

class MemoryReleaseReader implements ReleaseReader {
  readonly reads: string[] = [];

  constructor(readonly objects: Map<string, ReadObject>) {}

  async readKnownObject(key: string): Promise<ReadObject | null> {
    this.reads.push(key);
    return this.objects.get(key) ?? null;
  }
}

async function seededR2() {
  const objects = await fixtureBytes();
  const manifest = await createDataManifest(objects);
  const prefix = `releases/${manifest.releaseId.slice("sha256:".length)}`;
  const manifestKey = `${prefix}/manifest.json`;
  const releases = new Map<string, ReadObject>([
    [manifestKey, { bytes: jsonBytes(manifest), etag: "manifest-etag" }],
    ...manifest.artifacts.map(
      (descriptor) =>
        [
          `${prefix}/${descriptor.key}`,
          { bytes: objects.get(descriptor.name)!, etag: descriptor.sha256 },
        ] as const,
    ),
  ]);
  return {
    manifest,
    pointer: new MemoryPointerReader({
      bytes: jsonBytes({
        schemaVersion: 1,
        releaseId: manifest.releaseId,
        manifestKey,
      }),
      etag: "pointer-etag",
    }),
    releases: new MemoryReleaseReader(releases),
  };
}

describe("filesystem and R2 data sources", () => {
  it("loads from an explicit filesystem root independently of CWD", async () => {
    process.chdir("/tmp");
    const source = new FilesystemDataSource({ dataRoot: fixtureRoot });
    const snapshot = await source.load();

    expect(snapshot.artifacts.teams[0]?.id).toBe("team-a");
    expect(snapshot.releaseId).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("produces semantic parity from filesystem and seeded two-reader R2", async () => {
    const localSource = new FilesystemDataSource({
      dataRoot: fixtureRoot,
    });
    const local = await localSource.load();
    const seeded = await seededR2();
    const remoteSource = new R2DataSource({
      pointerReader: seeded.pointer,
      releaseReader: seeded.releases,
    });
    const remote = await remoteSource.load();

    expect(remote).toEqual(local);
    await expect(
      createResearchHandlers({ dataSource: remoteSource }).call(
        "tqccl_search",
        { query: "Tướng A", limit: 10 },
      ),
    ).resolves.toEqual(
      await createResearchHandlers({ dataSource: localSource }).call(
        "tqccl_search",
        { query: "Tướng A", limit: 10 },
      ),
    );
    expect(seeded.releases.reads).toEqual([
      `releases/${seeded.manifest.releaseId.slice("sha256:".length)}/manifest.json`,
      ...seeded.manifest.artifacts.map(
        ({ key }) =>
          `releases/${seeded.manifest.releaseId.slice("sha256:".length)}/${key}`,
      ),
    ]);
  });

  it("rejects missing pointers, traversal and mixed/corrupt releases", async () => {
    const seeded = await seededR2();
    await expect(
      new R2DataSource({
        pointerReader: new MemoryPointerReader(null),
        releaseReader: seeded.releases,
      }).load(),
    ).rejects.toMatchObject({ code: "DATA_UNAVAILABLE" });

    await expect(
      new R2DataSource({
        pointerReader: new MemoryPointerReader({
          bytes: jsonBytes({
            schemaVersion: 1,
            releaseId: seeded.manifest.releaseId,
            manifestKey: "../manifest.json",
          }),
        }),
        releaseReader: seeded.releases,
      }).load(),
    ).rejects.toMatchObject({ code: "INVALID_POINTER" });

    const corruptObjects = new Map(seeded.releases.objects);
    const teamsKey = [...corruptObjects.keys()].find((key) =>
      key.endsWith("/teams.json"),
    )!;
    corruptObjects.set(teamsKey, { bytes: jsonBytes([]) });
    await expect(
      new R2DataSource({
        pointerReader: seeded.pointer,
        releaseReader: new MemoryReleaseReader(corruptObjects),
      }).load(),
    ).rejects.toMatchObject({ code: "DATA_UNAVAILABLE" });
  });

  it("exposes read-only application reader capabilities", () => {
    const pointer = new MemoryPointerReader(null);
    const release = new MemoryReleaseReader(new Map());

    expect("write" in pointer).toBe(false);
    expect("put" in release).toBe(false);
    expect("delete" in release).toBe(false);
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
    const source = createCachedDataSource(
      {
        async loadCandidate() {
          reads += 1;
          return pending.promise;
        },
      },
      { refreshAfterMs: 100, maxStaleAgeMs: 1_000 },
      () => 0,
    );
    const left = source.load();
    const right = source.load();
    pending.resolve(candidate(snapshot));

    await expect(left).resolves.toBe(snapshot);
    await expect(right).resolves.toBe(snapshot);
    expect(reads).toBe(1);
  });

  it("never extends the absolute stale deadline after refresh failures", async () => {
    const snapshot = await new FilesystemDataSource({
      dataRoot: fixtureRoot,
    }).load();
    let now = 0;
    let fail = false;
    const source = createCachedDataSource(
      {
        async loadCandidate() {
          if (fail) throw new Error("offline");
          return candidate(snapshot);
        },
      },
      { refreshAfterMs: 10, maxStaleAgeMs: 100 },
      () => now,
    );
    await source.load();
    fail = true;
    now = 20;
    await expect(source.load()).resolves.toBe(snapshot);
    now = 90;
    await expect(source.load()).resolves.toBe(snapshot);
    now = 101;
    await expect(source.load()).rejects.toMatchObject({
      code: "DATA_UNAVAILABLE",
    });
  });

  it("normalizes typed refresh failures after the stale deadline", async () => {
    const snapshot = await new FilesystemDataSource({
      dataRoot: fixtureRoot,
    }).load();
    let now = 0;
    let fail = false;
    const source = createCachedDataSource(
      {
        async loadCandidate() {
          if (fail) {
            throw new DataSourceError(
              "INVALID_POINTER",
              "private pointer detail",
              false,
            );
          }
          return candidate(snapshot);
        },
      },
      { refreshAfterMs: 0, maxStaleAgeMs: 10 },
      () => now,
    );
    await source.load();
    fail = true;
    now = 11;

    await expect(source.load()).rejects.toMatchObject({
      code: "DATA_UNAVAILABLE",
    });
  });

  it("prevents a slow older refresh from overwriting a newer activation", async () => {
    const base = await new FilesystemDataSource({
      dataRoot: fixtureRoot,
    }).load();
    const v1 = { ...base, releaseId: "sha256:v1" as const };
    const v2 = { ...base, releaseId: "sha256:v2" as const };
    const slow = deferred<SnapshotCandidate>();
    let call = 0;
    const source = createCachedDataSource(
      {
        async loadCandidate() {
          call += 1;
          return call === 1 ? slow.promise : candidate(v2);
        },
      },
      { refreshAfterMs: 0, maxStaleAgeMs: 100 },
      () => 0,
    );
    const older = source.load({ forceRefresh: true });
    const newer = source.load({ forceRefresh: true });
    await expect(newer).resolves.toBe(v2);
    slow.resolve(candidate(v1));
    await expect(older).resolves.toBe(v2);
    await expect(source.load()).resolves.toBe(v2);
  });

  it("allows a later pointer rollback to activate an older release identity", async () => {
    const base = await new FilesystemDataSource({
      dataRoot: fixtureRoot,
    }).load();
    const v1 = { ...base, releaseId: "sha256:v1" as const };
    const v2 = { ...base, releaseId: "sha256:v2" as const };
    const queue = [v1, v2, v1];
    const source = createCachedDataSource(
      {
        async loadCandidate() {
          return candidate(queue.shift()!);
        },
      },
      { refreshAfterMs: 0, maxStaleAgeMs: 100 },
      () => 0,
    );

    await expect(source.load({ forceRefresh: true })).resolves.toBe(v1);
    await expect(source.load({ forceRefresh: true })).resolves.toBe(v2);
    await expect(source.load({ forceRefresh: true })).resolves.toBe(v1);
  });
});
