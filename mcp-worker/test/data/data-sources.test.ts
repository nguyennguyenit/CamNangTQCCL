import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
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
import { FilesystemDataSource, observeLookupRoot } from "../../src/data/filesystem-data-source.js";
import {
  createActivatedRoot,
  createLegacyRoot,
  createPackagedRoot,
  encodeJson,
  LOOKUP_CATALOG_NAME,
  LOOKUP_MANIFEST_NAME,
  MCP_MANIFEST_NAME,
  releaseSnapshotBundle,
  releaseSnapshotRoot,
  removeCreatedRoots,
  sha256Hex,
  type JsonRecord,
  type RawRootOptions,
} from "../fixtures/lookup-roots.js";

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

describe("filesystem root formats", () => {
  afterEach(removeCreatedRoots);

  it("nạp activated raw root sau khi verify ba lookup payload và transaction đã kết thúc", async () => {
    const { dataRoot } = await createActivatedRoot({
      transaction: { state: "committed" },
    });

    const snapshot = await new FilesystemDataSource({ dataRoot }).load();

    expect(snapshot.artifacts["heroes-dict"][0]?.id).toBe("hero:tuong-a");
    expect(snapshot.artifacts.tactics.map((row) => row.id)).toEqual([
      "tactic:chien-phap-a",
      "tactic:chien-phap-b",
    ]);
    expect(snapshot.releaseId).toMatch(/^sha256:[a-f0-9]{64}$/);
    for (const name of ["heroes-dict", "tactics"] as const) {
      const descriptor = snapshot.manifest.artifacts.find(
        (artifact) => artifact.name === name,
      );
      const onDisk = new Uint8Array(
        await readFile(join(dataRoot, `${name}.json`)),
      );
      expect(descriptor?.sha256).toBe(`sha256:${await sha256Hex(onDisk)}`);
    }
  });

  it("quan sát inventory và lookup manifest để phát hiện activation xen giữa", async () => {
    const { dataRoot } = await createActivatedRoot();
    const before = await observeLookupRoot(dataRoot);
    await writeFile(join(dataRoot, LOOKUP_MANIFEST_NAME), encodeJson({
      schemaVersion: 1,
      generationId: `lookup:${"1".repeat(64)}`,
      files: {},
    }));
    const after = await observeLookupRoot(dataRoot);
    expect(after.token).not.toBe(before.token);
  });

  it("quan sát transaction đã rollback dù public inventory trở về như cũ", async () => {
    const { dataRoot } = await createLegacyRoot();
    const before = await observeLookupRoot(dataRoot);
    const transaction = join(dirname(dataRoot), "pipeline", "lookup-output", "transactions", "rolled-back-after-capture");
    await mkdir(transaction, { recursive: true });
    await writeFile(join(transaction, "journal.json"), encodeJson({ state: "rolled-back" }));
    const after = await observeLookupRoot(dataRoot);
    expect(after.files).toEqual(before.files);
    expect(after.token).not.toBe(before.token);
  });

  it("từ chối activated root khi lookup bundle không nhất quán", async () => {
    const bundle = await releaseSnapshotBundle();
    const brokenCatalog = { ...bundle.catalog };
    delete brokenCatalog.buildings;
    const cases: Record<string, RawRootOptions> = {
      "payload bytes bị sửa sau khi manifest chốt": {
        payloadOverrides: { "tactics.json": encodeJson(bundle.tactics.slice(1)) },
      },
      "digest trong manifest không khớp bytes": {
        manifest: (manifest) => ({
          ...manifest,
          files: { ...manifest.files, "tactics.json": "0".repeat(64) },
        }),
      },
      "generationId không dẫn xuất từ files": {
        manifest: (manifest) => ({
          ...manifest,
          generationId: `lookup:${"1".repeat(64)}`,
        }),
      },
      "manifest sai schemaVersion": {
        manifest: (manifest) => ({ ...manifest, schemaVersion: 2 }),
      },
      "manifest có key lạ": {
        manifest: (manifest) => ({ ...manifest, extra: true }),
      },
      "catalog thiếu nhóm": { bundle: { ...bundle, catalog: brokenCatalog } },
      "catalog vắng mặt dù marker còn": {
        omitSidecars: [LOOKUP_CATALOG_NAME],
      },
      "manifest vắng mặt dù catalog còn": {
        omitSidecars: [LOOKUP_MANIFEST_NAME],
      },
      "cross-ID chiến pháp treo": {
        bundle: {
          ...bundle,
          heroes: bundle.heroes.map((hero) => ({
            ...hero,
            lookup: { ...(hero.lookup as object), selfTacticId: "tactic:khong-co" },
          })),
        },
      },
      "raw root lẫn packaged manifest": { withPackagedManifest: true },
    };

    for (const [label, options] of Object.entries(cases)) {
      const { dataRoot } = await createActivatedRoot(options);
      await expect(
        new FilesystemDataSource({ dataRoot }).load(),
        label,
      ).rejects.toMatchObject({ code: "DATA_UNAVAILABLE" });
    }
  });

  it("từ chối activated root khi transaction promotion còn dở dang", async () => {
    for (const transaction of [
      { state: "activation-prepared" },
      { state: "writing" },
      { lock: true },
      { state: "rolled-back", lock: true },
    ]) {
      const { dataRoot } = await createActivatedRoot({ transaction });
      await expect(
        new FilesystemDataSource({ dataRoot }).load(),
        JSON.stringify(transaction),
      ).rejects.toMatchObject({ code: "DATA_UNAVAILABLE" });
    }

    for (const transaction of [{ state: "committed" }, { state: "rolled-back" }]) {
      const { dataRoot } = await createActivatedRoot({ transaction });
      await expect(
        new FilesystemDataSource({ dataRoot }).load(),
        JSON.stringify(transaction),
      ).resolves.toMatchObject({
        releaseId: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      });
    }
  });

  it("validate manifest MCP có sẵn của packaged release root thay vì dựng lại", async () => {
    const published = JSON.parse(
      await readFile(join(releaseSnapshotRoot, MCP_MANIFEST_NAME), "utf8"),
    );

    const snapshot = await new FilesystemDataSource({
      dataRoot: await createPackagedRoot(),
    }).load();

    expect(snapshot.releaseId).toBe(published.releaseId);
    expect(snapshot.manifest.schemaVersion).toBe(1);
    expect(snapshot.manifest.artifacts).toHaveLength(6);
    expect(snapshot.warnings).toEqual([]);
  });

  it("từ chối packaged root khi manifest phát hành không còn mô tả đúng bundle", async () => {
    const rewrites: Record<string, (manifest: JsonRecord) => unknown> = {
      "count sai": (manifest) => ({
        ...manifest,
        artifacts: (manifest.artifacts as JsonRecord[]).map((artifact) =>
          artifact.name === "heroes-dict" ? { ...artifact, count: 2 } : artifact,
        ),
      }),
      "byteLength sai": (manifest) => ({
        ...manifest,
        artifacts: (manifest.artifacts as JsonRecord[]).map((artifact) =>
          artifact.name === "tactics"
            ? { ...artifact, byteLength: 1 }
            : artifact,
        ),
      }),
      "digest sai": (manifest) => ({
        ...manifest,
        artifacts: (manifest.artifacts as JsonRecord[]).map((artifact) =>
          artifact.name === "teams"
            ? { ...artifact, sha256: `sha256:${"0".repeat(64)}` }
            : artifact,
        ),
      }),
      "releaseId sai": (manifest) => ({
        ...manifest,
        releaseId: `sha256:${"0".repeat(64)}`,
      }),
      "thiếu artifact": (manifest) => ({
        ...manifest,
        artifacts: (manifest.artifacts as JsonRecord[]).slice(1),
      }),
    };

    for (const [label, manifest] of Object.entries(rewrites)) {
      const dataRoot = await createPackagedRoot({ manifest });
      await expect(
        new FilesystemDataSource({ dataRoot }).load(),
        label,
      ).rejects.toMatchObject({ code: "DATA_UNAVAILABLE" });
    }
  });

  it("từ chối packaged root mang thêm sidecar website", async () => {
    const dataRoot = await createPackagedRoot({ withSidecars: true });

    await expect(
      new FilesystemDataSource({ dataRoot }).load(),
    ).rejects.toMatchObject({ code: "DATA_UNAVAILABLE" });
  });

  it("giữ nhánh legacy cho raw root không marker và vẫn chặn inventory mùa dở dang", async () => {
    const { dataRoot } = await createLegacyRoot();

    const snapshot = await new FilesystemDataSource({ dataRoot }).load();
    expect(snapshot.artifacts["heroes-dict"][0]?.viet).toBe("Tướng A");
    expect(snapshot.artifacts["heroes-dict"][0]?.id).toBeUndefined();
    expect(snapshot.manifest.schemaVersion).toBe(1);

    const partial = await createLegacyRoot();
    await writeFile(
      join(partial.dataRoot, "season-registry.json"),
      encodeJson([]),
    );
    await expect(
      new FilesystemDataSource({ dataRoot: partial.dataRoot }).load(),
    ).rejects.toMatchObject({ code: "DATA_UNAVAILABLE" });
  });

  it("không tiết lộ đường dẫn, digest hay tên sidecar khi từ chối root", async () => {
    const { dataRoot, projectRoot } = await createActivatedRoot({
      payloadOverrides: { "heroes-dict.json": encodeJson([]) },
    });

    try {
      await new FilesystemDataSource({ dataRoot }).load();
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(DataSourceError);
      expect((error as DataSourceError).code).toBe("DATA_UNAVAILABLE");
      const message = (error as DataSourceError).message;
      expect(message).not.toContain(projectRoot);
      expect(message).not.toContain("lookup");
      expect(message).not.toMatch(/[a-f0-9]{64}/u);
    }
  });

  it("giữ snapshot đã activate bất biến trong process dù root đổi sau đó", async () => {
    const { dataRoot } = await createActivatedRoot();
    const source = new FilesystemDataSource({ dataRoot });
    const first = await source.load();

    await writeFile(join(dataRoot, "tactics.json"), encodeJson([]));
    await writeFile(join(dataRoot, LOOKUP_CATALOG_NAME), encodeJson({}));

    const second = await source.load();
    expect(second).toBe(first);
    expect(second.artifacts.tactics).toHaveLength(2);
  });
});
