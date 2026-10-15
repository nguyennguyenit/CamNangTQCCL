import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { WORKER_SOURCE_ONLY_FILES, WorkerAssetBuildError, buildWorkerAssets } from "../../scripts/build-worker-assets.js";
import { readWorkerAssetFiles } from "../../scripts/verify-worker-assets.js";
import { validateDataSnapshot, validateManifest, V2_ARTIFACT_NAMES } from "../../src/data/artifact-contracts.js";
import { repositoryPublicationRoots } from "../../src/data/publication-source-reader.js";
import { verifyWorkerReleaseEvidence } from "../../src/release/worker-release-evidence.js";
import { repositoryDataRoot } from "../fixtures/publication-sources.js";

const commitSha = "a".repeat(40);
const sourceTree = `git-tree:${"b".repeat(40)}`;
const workflowBuildId = `build:sha256b64:${"c".repeat(43)}`;
const parents: string[] = [];

afterAll(async () => {
  await Promise.all(parents.map((parent) => rm(parent, { recursive: true, force: true })));
});

async function outputParent() {
  const parent = await mkdtemp(join(tmpdir(), "tqccl-v3-assets-"));
  parents.push(parent);
  return parent;
}

function options(outputDirectory: string, withPublication: boolean) {
  return {
    dataRoot: repositoryDataRoot,
    outputDirectory,
    workflowBuildId,
    allowedSourceFiles: WORKER_SOURCE_ONLY_FILES,
    ...(withPublication ? { publication: repositoryPublicationRoots(repositoryDataRoot) } : {}),
    readSourceState: async () => ({ commitSha, sourceTree }),
    assertCleanSource: async () => undefined,
  };
}

describe("buildWorkerAssets with publication (manifest v3)", () => {
  it("emits the v2 artifacts, the publication shards and a manifest-derived inventory", async () => {
    const outputDirectory = join(await outputParent(), ".worker-assets");
    const built = await buildWorkerAssets(options(outputDirectory, true));
    const names = (await readdir(outputDirectory)).sort();
    const manifest = await validateManifest(JSON.parse(await readFile(join(outputDirectory, "manifest.json"), "utf8")));

    expect(manifest.schemaVersion).toBe(3);
    expect(built.artifactNames).toEqual(manifest.artifacts.map((descriptor) => descriptor.name));
    expect(names).toEqual([...manifest.artifacts.map((descriptor) => descriptor.key), "manifest.json"].sort());
    for (const name of V2_ARTIFACT_NAMES) expect(names).toContain(`${name}.json`);
    expect(names).toContain("reference-registry.json");
    expect(names).toContain("catalog-entities-00.json");
    for (const forbidden of ["website-display.json", "khaihoang.json", "lookup-catalog.json", "lookup-manifest.json", "sgsdeck"]) {
      expect(names).not.toContain(forbidden);
    }
    expect(built.evidence.releaseId).toBe(manifest.releaseId);

    // The verifier reads exactly the manifest-derived inventory and accepts the evidence.
    const assets = await readWorkerAssetFiles(outputDirectory);
    await verifyWorkerReleaseEvidence(built.evidence, { assets, expectedSource: { commitSha, sourceTree, workflowBuildId } });
    const snapshot = await validateDataSnapshot(manifest, new Map(manifest.artifacts.map((descriptor) => [descriptor.name, assets.get(descriptor.key)!])));
    expect(snapshot.publication).toBeDefined();
  }, 120_000);

  it("is deterministic and keeps the non-publication build on exact v2 identity", async () => {
    const parent = await outputParent();
    const first = await buildWorkerAssets(options(join(parent, ".worker-assets"), true));
    const second = await buildWorkerAssets(options(join(parent, ".worker-assets"), true));
    expect(second.evidence).toEqual(first.evidence);
    const plain = await buildWorkerAssets(options(join(await outputParent(), ".worker-assets"), false));
    expect(plain.artifactNames).toEqual(V2_ARTIFACT_NAMES);
    expect(plain.evidence.releaseId).not.toBe(first.evidence.releaseId);
  }, 120_000);

  it("rejects evidence when an extra or missing shard breaks the manifest inventory", async () => {
    const outputDirectory = join(await outputParent(), ".worker-assets");
    const built = await buildWorkerAssets(options(outputDirectory, true));
    const assets = await readWorkerAssetFiles(outputDirectory);
    const missing = new Map(assets);
    missing.delete("reference-team-details-00.json");
    await expect(verifyWorkerReleaseEvidence(built.evidence, { assets: missing, expectedSource: { commitSha, sourceTree, workflowBuildId } })).rejects.toBeInstanceOf(WorkerAssetBuildError);
    const extra = new Map(assets);
    extra.set("catalog-entities-42.json", new TextEncoder().encode("[]"));
    await expect(verifyWorkerReleaseEvidence(built.evidence, { assets: extra, expectedSource: { commitSha, sourceTree, workflowBuildId } })).rejects.toBeInstanceOf(WorkerAssetBuildError);
  }, 120_000);

  it("fails the build when publication inputs are not the pinned generation", async () => {
    const outputDirectory = join(await outputParent(), ".worker-assets");
    const roots = repositoryPublicationRoots(repositoryDataRoot);
    await expect(
      buildWorkerAssets({ ...options(outputDirectory, true), publication: { ...roots, routeLedgerPath: join(repositoryDataRoot, "teams.json") } }),
    ).rejects.toBeInstanceOf(WorkerAssetBuildError);
  }, 120_000);
});
