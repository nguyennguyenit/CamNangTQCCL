import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  ARTIFACT_NAMES,
  V2_ARTIFACT_NAMES,
  validateManifest,
} from "../../src/data/artifact-contracts.js";
import {
  calculateWorkerAssetInventoryDigest,
  parseWorkerReleaseEvidence,
  verifyWorkerReleaseEvidence,
  type WorkerReleaseEvidence,
} from "../../src/release/worker-release-evidence.js";
import {
  buildWorkerAssets,
  replaceWorkerAssetDirectory,
  WORKER_SOURCE_ONLY_FILES,
  WorkerAssetBuildError,
} from "../../scripts/build-worker-assets.js";
import {
  createLookupSourceRoot,
  encodeJson,
  LOOKUP_SIDECAR_NAMES,
  releaseSnapshotBundle,
  removeCreatedRoots,
  type RawRootOptions,
} from "../fixtures/lookup-roots.js";

const fixtureRoot = new URL("../fixtures/release-snapshot/", import.meta.url);
const repositoryRoot = new URL("../../../", import.meta.url);
const commitSha = "a".repeat(40);
const sourceTree = `git-tree:${"b".repeat(40)}`;
const workflowBuildId = `build:sha256b64:${"c".repeat(43)}`;
const expectedNames = [
  "books-dict.json",
  "coexist.json",
  "heroes-dict.json",
  "manifest.json",
  "tactics.json",
  "team-tier.json",
  "teams.json",
];

async function digest(bytes: Uint8Array): Promise<`sha256:${string}`> {
  const value = await crypto.subtle.digest(
    "SHA-256",
    bytes as Uint8Array<ArrayBuffer>,
  );
  return `sha256:${[...new Uint8Array(value)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

async function outputBytes(root: string): Promise<Map<string, Uint8Array>> {
  return new Map(
    await Promise.all(
      (await readdir(root)).sort().map(async (name) => [
        name,
        new Uint8Array(await readFile(join(root, name))),
      ] as const),
    ),
  );
}

async function createSource(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "tqccl-worker-source-"));
  await Promise.all(
    ARTIFACT_NAMES.map((name) =>
      copyFile(new URL(`${name}.json`, fixtureRoot), join(root, `${name}.json`)),
    ),
  );
  return root;
}

function buildOptions(dataRoot: string, outputDirectory: string) {
  return {
    dataRoot,
    outputDirectory,
    workflowBuildId,
    readSourceState: async () => ({ commitSha, sourceTree }),
    assertCleanSource: async () => undefined,
  } as const;
}

describe("buildWorkerAssets", () => {
  it("tạo đúng bảy static assets deterministic trong một thư mục phẳng", async () => {
    const parent = await mkdtemp(join(tmpdir(), "tqccl-worker-assets-"));
    const outputDirectory = join(parent, ".worker-assets");
    const options = buildOptions(await createSource(), outputDirectory);

    const first = await buildWorkerAssets(options);
    const firstBytes = await outputBytes(outputDirectory);
    const second = await buildWorkerAssets(options);
    const secondBytes = await outputBytes(outputDirectory);

    expect([...firstBytes.keys()]).toEqual(expectedNames);
    expect(secondBytes).toEqual(firstBytes);
    expect(second).toEqual(first);
    expect(first.artifactNames).toEqual(ARTIFACT_NAMES);
    expect(first.outputDirectory).toBe(outputDirectory);
    const manifest = await validateManifest(
      JSON.parse(await readFile(join(outputDirectory, "manifest.json"), "utf8")),
    );
    expect(manifest.releaseId).toBe(first.evidence.releaseId);
    for (const descriptor of manifest.artifacts) {
      expect(await readFile(join(outputDirectory, descriptor.key))).toEqual(
        await readFile(new URL(descriptor.key, fixtureRoot)),
      );
    }
  });

  it("xóa stale output thay vì đưa file thừa vào bundle", async () => {
    const parent = await mkdtemp(join(tmpdir(), "tqccl-worker-assets-"));
    const outputDirectory = join(parent, ".worker-assets");
    const options = buildOptions(await createSource(), outputDirectory);
    await buildWorkerAssets(options);
    await writeFile(join(outputDirectory, "secret.txt"), "must disappear");

    await buildWorkerAssets(options);

    expect((await readdir(outputDirectory)).sort()).toEqual(expectedNames);
  });

  it("fail closed với source bẩn, identity sai, artifact thiếu hoặc symlink", async () => {
    const parent = await mkdtemp(join(tmpdir(), "tqccl-worker-assets-"));
    const outputDirectory = join(parent, ".worker-assets");
    const base = buildOptions(await createSource(), outputDirectory);

    await expect(
      buildWorkerAssets({
        ...base,
        readSourceState: async () => ({ commitSha: "main", sourceTree }),
      }),
    ).rejects.toMatchObject({ code: "INVALID_BUILD_IDENTITY" });
    await expect(
      buildWorkerAssets({
        ...base,
        assertCleanSource: async () => {
          throw new Error("dirty");
        },
      }),
    ).rejects.toMatchObject({ code: "SOURCE_NOT_CLEAN" });

    const incomplete = await mkdtemp(join(tmpdir(), "tqccl-worker-source-"));
    for (const name of ARTIFACT_NAMES.slice(1)) {
      await writeFile(join(incomplete, `${name}.json`), "[]");
    }
    await expect(
      buildWorkerAssets({ ...base, dataRoot: incomplete }),
    ).rejects.toMatchObject({ code: "INVALID_SOURCE_ASSET" });

    const linked = await mkdtemp(join(tmpdir(), "tqccl-worker-source-"));
    for (const name of ARTIFACT_NAMES) {
      const target = new URL(`${name}.json`, fixtureRoot);
      if (name === "teams") {
        await symlink(target, join(linked, `${name}.json`));
      } else {
        await writeFile(join(linked, `${name}.json`), await readFile(target));
      }
    }
    await expect(
      buildWorkerAssets({ ...base, dataRoot: linked }),
    ).rejects.toMatchObject({ code: "INVALID_SOURCE_ASSET" });
    expect(await lstat(join(linked, "teams.json"))).toMatchObject({});
  });

  it("evidence khóa commit, tree, manifest, workflow và inventory", async () => {
    const parent = await mkdtemp(join(tmpdir(), "tqccl-worker-assets-"));
    const outputDirectory = join(parent, ".worker-assets");
    const built = await buildWorkerAssets(
      buildOptions(await createSource(), outputDirectory),
    );

    expect(parseWorkerReleaseEvidence(built.evidence)).toEqual(built.evidence);
    await expect(
      verifyWorkerReleaseEvidence(built.evidence, {
        assets: await outputBytes(outputDirectory),
        expectedSource: { commitSha, sourceTree, workflowBuildId },
      }),
    ).resolves.toEqual(built.evidence);
    for (const field of [
      "commitSha",
      "sourceTree",
      "manifestSha256",
      "releaseId",
      "workflowBuildId",
      "assetInventoryDigest",
    ] as const) {
      const replacement = {
        commitSha: "d".repeat(40),
        sourceTree: `git-tree:${"d".repeat(40)}`,
        manifestSha256: `sha256:${"d".repeat(64)}`,
        releaseId: `sha256:${"d".repeat(64)}`,
        workflowBuildId: `build:sha256b64:${"d".repeat(43)}`,
        assetInventoryDigest: `sha256:${"d".repeat(64)}`,
      } satisfies Record<typeof field, string>;
      const mismatched = {
        ...built.evidence,
        [field]: replacement[field],
      } as WorkerReleaseEvidence;
      expect(() =>
        parseWorkerReleaseEvidence(mismatched, { expected: built.evidence }),
      ).toThrow(WorkerAssetBuildError);
    }
    expect(() =>
      parseWorkerReleaseEvidence({ ...built.evidence, ambiguous: true }),
    ).toThrow(WorkerAssetBuildError);

    const tamperedAssets = await outputBytes(outputDirectory);
    tamperedAssets.set("teams.json", new TextEncoder().encode("[]"));
    await expect(
      verifyWorkerReleaseEvidence(built.evidence, {
        assets: tamperedAssets,
        expectedSource: { commitSha, sourceTree, workflowBuildId },
      }),
    ).rejects.toThrow(WorkerAssetBuildError);

    const coordinatedAssets = await outputBytes(outputDirectory);
    const reformattedManifest = new TextEncoder().encode(
      JSON.stringify(
        JSON.parse(
          new TextDecoder().decode(coordinatedAssets.get("manifest.json")!),
        ),
        null,
        2,
      ),
    );
    coordinatedAssets.set("manifest.json", reformattedManifest);
    const coordinatedEvidence: WorkerReleaseEvidence = {
      ...built.evidence,
      manifestSha256: await digest(reformattedManifest),
      assetInventoryDigest:
        await calculateWorkerAssetInventoryDigest(coordinatedAssets),
    };
    await expect(
      verifyWorkerReleaseEvidence(coordinatedEvidence, {
        assets: coordinatedAssets,
        expectedSource: { commitSha, sourceTree, workflowBuildId },
      }),
    ).rejects.toThrow(WorkerAssetBuildError);
  });

  it("từ chối extra file, symlink root, JSON hỏng và artifact quá cỡ", async () => {
    const parent = await mkdtemp(join(tmpdir(), "tqccl-worker-assets-"));
    const outputDirectory = join(parent, ".worker-assets");
    const extra = await createSource();
    await writeFile(join(extra, "extra.json"), "[]");
    await expect(
      buildWorkerAssets(buildOptions(extra, outputDirectory)),
    ).rejects.toMatchObject({ code: "INVALID_SOURCE_ASSET" });

    const source = await createSource();
    const linkedRoot = join(parent, "linked-source");
    await symlink(source, linkedRoot, "dir");
    await expect(
      buildWorkerAssets(buildOptions(linkedRoot, outputDirectory)),
    ).rejects.toMatchObject({ code: "INVALID_SOURCE_ASSET" });

    const outputParent = join(parent, "linked-output-parent");
    await symlink(source, outputParent, "dir");
    await expect(
      buildWorkerAssets(
        buildOptions(source, join(outputParent, ".worker-assets")),
      ),
    ).rejects.toMatchObject({ code: "INVALID_OUTPUT_PATH" });
    await expect(lstat(join(source, ".worker-assets"))).rejects.toMatchObject({
      code: "ENOENT",
    });

    const invalid = await createSource();
    await writeFile(join(invalid, "teams.json"), "{bad json");
    await expect(
      buildWorkerAssets(buildOptions(invalid, outputDirectory)),
    ).rejects.toMatchObject({ code: "INVALID_SOURCE_ASSET" });

    const oversized = await createSource();
    await writeFile(join(oversized, "books-dict.json"), new Uint8Array(8 * 1024 * 1024 + 1));
    await expect(
      buildWorkerAssets(buildOptions(oversized, outputDirectory)),
    ).rejects.toMatchObject({ code: "INVALID_SOURCE_ASSET" });
  });

  it("giữ nguyên bundle trước đó khi rebuild fail hoặc source identity đổi", async () => {
    const parent = await mkdtemp(join(tmpdir(), "tqccl-worker-assets-"));
    const outputDirectory = join(parent, ".worker-assets");
    const source = await createSource();
    const options = buildOptions(source, outputDirectory);
    await buildWorkerAssets(options);
    const before = await outputBytes(outputDirectory);
    await writeFile(join(source, "teams.json"), "{bad json");

    await expect(buildWorkerAssets(options)).rejects.toMatchObject({
      code: "INVALID_SOURCE_ASSET",
    });
    expect(await outputBytes(outputDirectory)).toEqual(before);

    const cleanSource = await createSource();
    let reads = 0;
    await expect(
      buildWorkerAssets({
        ...buildOptions(cleanSource, outputDirectory),
        readSourceState: async () => ({
          commitSha: reads++ === 0 ? commitSha : "d".repeat(40),
          sourceTree,
        }),
      }),
    ).rejects.toMatchObject({ code: "SOURCE_IDENTITY_CHANGED" });
    expect(await outputBytes(outputDirectory)).toEqual(before);
  });

  it("từ chối inventory lookup xuất hiện giữa lúc capture raw root", async () => {
    const parent = await mkdtemp(join(tmpdir(), "tqccl-worker-assets-"));
    const outputDirectory = join(parent, ".worker-assets");
    const source = await createSource();
    let cleanChecks = 0;

    await expect(buildWorkerAssets({
      ...buildOptions(source, outputDirectory),
      assertCleanSource: async () => {
        cleanChecks += 1;
        if (cleanChecks === 2) {
          await writeFile(join(source, "lookup-manifest.json"), encodeJson({ schemaVersion: 1 }));
        }
      },
    })).rejects.toMatchObject({ code: "INVALID_SOURCE_ASSET" });
  });

  it("package và CI chỉ gọi builder mới, đồng thời giữ package private", async () => {
    const packageJson = JSON.parse(
      await readFile(new URL("mcp-worker/package.json", repositoryRoot), "utf8"),
    );
    const workflow = await readFile(
      new URL(".github/workflows/mcp-worker.yml", repositoryRoot),
      "utf8",
    );

    expect(packageJson.private).toBe(true);
    expect(packageJson.scripts["build:worker-assets"]).toContain(
      "build-worker-assets.ts",
    );
    expect(packageJson.scripts["build:data-release"]).toBeUndefined();
    expect(workflow).toContain("npm run --silent build:worker-assets");
    expect(workflow).not.toContain("build:data-release");
  });

  it("nhận website-display như source-only và không emit vào Worker assets", async () => {
    const parent = await mkdtemp(join(tmpdir(), "tqccl-worker-assets-"));
    const outputDirectory = join(parent, ".worker-assets");
    const dataRoot = fileURLToPath(new URL("data/", repositoryRoot));

    const built = await buildWorkerAssets({
      ...buildOptions(dataRoot, outputDirectory),
      allowedSourceFiles: WORKER_SOURCE_ONLY_FILES,
    });
    const names = await readdir(outputDirectory);

    expect(built.artifactNames).toEqual(V2_ARTIFACT_NAMES);
    expect(names).not.toContain("website-display.json");
  });

  it("cleanup backup thất bại không báo build fail sau commit", async () => {
    const parent = await mkdtemp(join(tmpdir(), "tqccl-worker-assets-"));
    const outputDirectory = join(parent, ".worker-assets");
    const temporaryDirectory = join(parent, ".worker-assets.tmp-test");
    await mkdir(outputDirectory);
    await mkdir(temporaryDirectory);
    await writeFile(join(outputDirectory, "old.txt"), "old");
    await writeFile(join(temporaryDirectory, "new.txt"), "new");

    await expect(
      replaceWorkerAssetDirectory(temporaryDirectory, outputDirectory, {
        cleanupPrevious: async () => {
          throw new Error("cleanup denied");
        },
      }),
    ).resolves.toBeUndefined();
    expect(await readFile(join(outputDirectory, "new.txt"), "utf8")).toBe(
      "new",
    );
    expect(
      (await readdir(parent)).some((name) =>
        name.startsWith(".worker-assets.previous-"),
      ),
    ).toBe(true);
  });
});

describe("buildWorkerAssets với lookup sidecar", () => {
  afterEach(removeCreatedRoots);

  const withSidecars = (dataRoot: string, outputDirectory: string) => ({
    ...buildOptions(dataRoot, outputDirectory),
    allowedSourceFiles: [...LOOKUP_SIDECAR_NAMES],
  });

  it("nhận hai sidecar website hợp lệ nhưng không emit chúng và giữ đúng inventory 6/11", async () => {
    for (const seasonal of [false, true]) {
      const parent = await mkdtemp(join(tmpdir(), "tqccl-worker-assets-"));
      const outputDirectory = join(parent, ".worker-assets");
      const dataRoot = await createLookupSourceRoot({ seasonal });

      const built = await buildWorkerAssets(
        withSidecars(dataRoot, outputDirectory),
      );

      const names = (await readdir(outputDirectory)).sort();
      const artifactNames: readonly string[] = seasonal
        ? V2_ARTIFACT_NAMES
        : ARTIFACT_NAMES;
      expect(built.artifactNames).toEqual(artifactNames);
      expect(names).toEqual(
        [...artifactNames.map((name) => `${name}.json`), "manifest.json"].sort(),
      );
      for (const sidecar of LOOKUP_SIDECAR_NAMES) {
        expect(names).not.toContain(sidecar);
      }
      expect(
        JSON.parse(
          await readFile(join(outputDirectory, "manifest.json"), "utf8"),
        ).schemaVersion,
      ).toBe(seasonal ? 2 : 1);
    }
  });

  it("validate raw lookup bundle trước khi chọn heroes/tactics cho MCP snapshot", async () => {
    const bundle = await releaseSnapshotBundle();
    const brokenCatalog = { ...bundle.catalog };
    delete brokenCatalog.specials;
    const cases: Record<string, RawRootOptions> = {
      "payload bị sửa sau khi manifest chốt": {
        payloadOverrides: { "tactics.json": encodeJson(bundle.tactics.slice(1)) },
      },
      "digest manifest không khớp bytes": {
        manifest: (manifest) => ({
          ...manifest,
          files: { ...manifest.files, "heroes-dict.json": "0".repeat(64) },
        }),
      },
      "generationId không dẫn xuất": {
        manifest: (manifest) => ({
          ...manifest,
          generationId: `lookup:${"1".repeat(64)}`,
        }),
      },
      "manifest sai schemaVersion": {
        manifest: (manifest) => ({ ...manifest, schemaVersion: 2 }),
      },
      "catalog thiếu nhóm": { bundle: { ...bundle, catalog: brokenCatalog } },
      "cross-ID chiến pháp treo": {
        bundle: {
          ...bundle,
          heroes: bundle.heroes.map((hero) => ({
            ...hero,
            lookup: {
              ...(hero.lookup as object),
              inheritTacticId: "tactic:khong-co",
            },
          })),
        },
      },
    };

    for (const [label, options] of Object.entries(cases)) {
      const parent = await mkdtemp(join(tmpdir(), "tqccl-worker-assets-"));
      const outputDirectory = join(parent, ".worker-assets");
      const dataRoot = await createLookupSourceRoot(options);

      await expect(
        buildWorkerAssets(withSidecars(dataRoot, outputDirectory)),
        label,
      ).rejects.toMatchObject({ code: "INVALID_SOURCE_ASSET" });
      await expect(readdir(outputDirectory)).rejects.toMatchObject({
        code: "ENOENT",
      });
    }
  });

  it("vẫn từ chối sidecar chưa được allowlist hoặc bundle chỉ có một nửa", async () => {
    const parent = await mkdtemp(join(tmpdir(), "tqccl-worker-assets-"));
    const outputDirectory = join(parent, ".worker-assets");

    await expect(
      buildWorkerAssets(
        buildOptions(await createLookupSourceRoot(), outputDirectory),
      ),
    ).rejects.toMatchObject({ code: "INVALID_SOURCE_ASSET" });

    for (const omitted of LOOKUP_SIDECAR_NAMES) {
      const dataRoot = await createLookupSourceRoot({
        omitSidecars: [omitted],
      });
      await expect(
        buildWorkerAssets(withSidecars(dataRoot, outputDirectory)),
        omitted,
      ).rejects.toMatchObject({ code: "INVALID_SOURCE_ASSET" });
    }
  });
});
