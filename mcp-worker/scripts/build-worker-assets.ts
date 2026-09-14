import { execFile } from "node:child_process";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { basename, dirname, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

import {
  ARTIFACT_NAMES,
  SEASON_ARTIFACT_NAMES,
  V2_ARTIFACT_NAMES,
  ArtifactContractError,
  createDataManifest,
  validateDataSnapshot,
  type ArtifactName,
} from "../src/data/artifact-contracts.js";
import { observeLookupRoot, validateLookupRoot } from "../src/data/filesystem-data-source.js";
import { stableStringify } from "../src/domain/contracts.js";
import { WORKFLOW_BUILD_ID } from "../src/generated/workflow-build.js";
import {
  assertWorkerBuildIdentity,
  calculateWorkerAssetInventoryDigest,
  WorkerAssetBuildError,
  type WorkerReleaseEvidence,
} from "../src/release/worker-release-evidence.js";

export { WorkerAssetBuildError } from "../src/release/worker-release-evidence.js";

const execFileAsync = promisify(execFile);
export const WORKER_SOURCE_ONLY_FILES = [
  "facets.json",
  "khaihoang.json",
  "tactics-generic.json",
  "lookup-catalog.json",
  "lookup-manifest.json",
  "website-display.json",
] as const;

export interface BuildWorkerAssetsOptions {
  dataRoot: string | URL;
  outputDirectory: string | URL;
  workflowBuildId: string;
  allowedSourceFiles?: readonly string[];
  readSourceState: () => Promise<{
    commitSha: string;
    sourceTree: string;
  }>;
  assertCleanSource: () => Promise<void>;
}

export interface WorkerAssetBuild {
  artifactNames: readonly ArtifactName[];
  outputDirectory: string;
  evidence: WorkerReleaseEvidence;
}

function toPath(value: string | URL): string {
  return value instanceof URL ? fileURLToPath(value) : resolve(value);
}

function isWithin(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== "..");
}

async function sha256(bytes: Uint8Array): Promise<`sha256:${string}`> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes as Uint8Array<ArrayBuffer>,
  );
  return `sha256:${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

async function readRegularFile(path: string): Promise<Uint8Array> {
  const before = await lstat(path).catch(() => null);
  if (before === null || !before.isFile() || before.isSymbolicLink()) {
    throw new WorkerAssetBuildError("INVALID_SOURCE_ASSET");
  }
  const bytes = new Uint8Array(await readFile(path));
  const after = await lstat(path).catch(() => null);
  if (
    after === null ||
    !after.isFile() ||
    after.isSymbolicLink() ||
    before.dev !== after.dev ||
    before.ino !== after.ino ||
    before.size !== after.size ||
    before.mtimeMs !== after.mtimeMs
  ) {
    throw new WorkerAssetBuildError("INVALID_SOURCE_ASSET");
  }
  return bytes;
}

async function validateSourceRoot(
  dataRoot: string,
  allowedSourceFiles: readonly string[],
): Promise<readonly ArtifactName[]> {
  const root = await lstat(dataRoot).catch(() => null);
  if (root === null || !root.isDirectory() || root.isSymbolicLink()) {
    throw new WorkerAssetBuildError("INVALID_SOURCE_ASSET");
  }
  if (
    allowedSourceFiles.some(
      (name) => !/^[a-z0-9-]+\.json$/u.test(name),
    )
  ) {
    throw new WorkerAssetBuildError("INVALID_SOURCE_ASSET");
  }
  let entries = await readdir(dataRoot, { withFileTypes: true });
  if (entries.some(entry => entry.name === "sgsdeck")) {
    const privatePath = resolve(dataRoot, "sgsdeck");
    const privateStat = await lstat(privatePath);
    if (!privateStat.isDirectory() || privateStat.isSymbolicLink()) {
      throw new WorkerAssetBuildError("INVALID_SOURCE_ASSET");
    }
    const [rootRealpath, privateRealpath] = await Promise.all([realpath(dataRoot), realpath(privatePath)]);
    if (!isWithin(rootRealpath, privateRealpath) || dirname(privateRealpath) !== rootRealpath) {
      throw new WorkerAssetBuildError("INVALID_SOURCE_ASSET");
    }
    // This established private source subtree never participates in artifact collection.
    entries = entries.filter(entry => entry.name !== "sgsdeck");
  }
  const seasonalCount = SEASON_ARTIFACT_NAMES.filter(name => entries.some(entry => entry.name === `${name}.json`)).length;
  if (seasonalCount !== 0 && seasonalCount !== SEASON_ARTIFACT_NAMES.length) {
    throw new WorkerAssetBuildError("INVALID_SOURCE_ASSET");
  }
  const artifactNames = seasonalCount === 0 ? ARTIFACT_NAMES : V2_ARTIFACT_NAMES;
  const expected = new Set([
    ...artifactNames.map((name) => `${name}.json`),
    ...allowedSourceFiles,
  ]);
  if (
    entries.length !== expected.size ||
    entries.some(
      (entry) =>
        !expected.has(entry.name) ||
        !entry.isFile() ||
        entry.isSymbolicLink(),
    )
  ) {
    throw new WorkerAssetBuildError("INVALID_SOURCE_ASSET");
  }
  return artifactNames;
}

export async function replaceWorkerAssetDirectory(
  temporaryDirectory: string,
  outputDirectory: string,
  options: {
    cleanupPrevious?: (path: string) => Promise<void>;
  } = {},
): Promise<void> {
  const previousDirectory = `${outputDirectory}.previous-${randomUUID()}`;
  const output = await lstat(outputDirectory).catch(() => null);
  if (output !== null && (!output.isDirectory() || output.isSymbolicLink())) {
    throw new WorkerAssetBuildError("INVALID_OUTPUT_PATH");
  }
  let movedPrevious = false;
  try {
    if (output !== null) {
      await rename(outputDirectory, previousDirectory);
      movedPrevious = true;
    }
    await rename(temporaryDirectory, outputDirectory);
    if (movedPrevious) {
      const cleanupPrevious =
        options.cleanupPrevious ??
        ((path: string) => rm(path, { recursive: true, force: true }));
      await cleanupPrevious(previousDirectory).catch(() => undefined);
    }
  } catch (error) {
    if (movedPrevious) {
      const current = await lstat(outputDirectory).catch(() => null);
      if (current === null) {
        await rename(previousDirectory, outputDirectory).catch(() => undefined);
      }
    }
    throw error;
  }
}

async function readSourceState(
  options: BuildWorkerAssetsOptions,
): Promise<{ commitSha: string; sourceTree: string }> {
  const source = await options.readSourceState().catch(() => {
    throw new WorkerAssetBuildError("INVALID_BUILD_IDENTITY");
  });
  assertWorkerBuildIdentity({
    ...source,
    workflowBuildId: options.workflowBuildId,
  });
  return source;
}

async function assertCleanSource(
  callback: () => Promise<void>,
): Promise<void> {
  try {
    await callback();
  } catch {
    throw new WorkerAssetBuildError("SOURCE_NOT_CLEAN");
  }
}

export async function buildWorkerAssets(
  options: BuildWorkerAssetsOptions,
): Promise<WorkerAssetBuild> {
  const initialSource = await readSourceState(options);
  await assertCleanSource(options.assertCleanSource);
  const dataRoot = toPath(options.dataRoot);
  const outputDirectory = toPath(options.outputDirectory);
  if (
    basename(outputDirectory) !== ".worker-assets" ||
    isWithin(dataRoot, outputDirectory)
  ) {
    throw new WorkerAssetBuildError("INVALID_OUTPUT_PATH");
  }
  const artifactNames = await validateSourceRoot(dataRoot, options.allowedSourceFiles ?? []);
  await mkdir(dirname(outputDirectory), { recursive: true });
  const [realDataRoot, realOutputParent] = await Promise.all([
    realpath(dataRoot),
    realpath(dirname(outputDirectory)),
  ]).catch(() => {
    throw new WorkerAssetBuildError("INVALID_OUTPUT_PATH");
  });
  if (
    isWithin(
      realDataRoot,
      resolve(realOutputParent, basename(outputDirectory)),
    )
  ) {
    throw new WorkerAssetBuildError("INVALID_OUTPUT_PATH");
  }
  const temporaryDirectory = await mkdtemp(
    resolve(dirname(outputDirectory), `.${basename(outputDirectory)}.tmp-`),
  );
  try {
    const initialLookupRoot = await observeLookupRoot(dataRoot);
    const entries = await Promise.all(
      artifactNames.map(async (name) => [
        name,
        await readRegularFile(resolve(dataRoot, `${name}.json`)),
      ] as const),
    );
    await assertCleanSource(options.assertCleanSource);
    const finalSource = await readSourceState(options);
    if (
      finalSource.commitSha !== initialSource.commitSha ||
      finalSource.sourceTree !== initialSource.sourceTree
    ) {
      throw new WorkerAssetBuildError("SOURCE_IDENTITY_CHANGED");
    }
    const objects = new Map<ArtifactName, Uint8Array>(entries);
    const lookupSidecars = ["lookup-catalog.json", "lookup-manifest.json"];
    const lookupCount = lookupSidecars.filter((name) => options.allowedSourceFiles?.includes(name)).length;
    if (lookupCount !== 0 && lookupCount !== lookupSidecars.length) {
      throw new WorkerAssetBuildError("INVALID_SOURCE_ASSET");
    }
    if (lookupCount === lookupSidecars.length) {
      try {
        await validateLookupRoot(dataRoot, objects);
      } catch {
        throw new WorkerAssetBuildError("INVALID_SOURCE_ASSET");
      }
    }
    const finalLookupRoot = await observeLookupRoot(dataRoot);
    if (finalLookupRoot.token !== initialLookupRoot.token) {
      throw new WorkerAssetBuildError("INVALID_SOURCE_ASSET");
    }
    let manifest;
    try {
      manifest = await createDataManifest(objects);
      await validateDataSnapshot(manifest, objects);
    } catch (error) {
      if (error instanceof ArtifactContractError) {
        throw new WorkerAssetBuildError("INVALID_SOURCE_ASSET");
      }
      throw error;
    }
    const manifestBytes = new TextEncoder().encode(
      `${stableStringify(manifest)}\n`,
    );
    const assets = new Map<string, Uint8Array>([
      ...entries.map(([name, bytes]) => [`${name}.json`, bytes] as const),
      ["manifest.json", manifestBytes],
    ]);
    for (const [name, bytes] of assets) {
      await writeFile(resolve(temporaryDirectory, name), bytes, { flag: "wx" });
    }
    const evidence: WorkerReleaseEvidence = {
      schemaVersion: 1,
      commitSha: initialSource.commitSha,
      sourceTree:
        initialSource.sourceTree as WorkerReleaseEvidence["sourceTree"],
      manifestSha256: await sha256(manifestBytes),
      releaseId: manifest.releaseId,
      workflowBuildId:
        options.workflowBuildId as WorkerReleaseEvidence["workflowBuildId"],
      assetInventoryDigest: await calculateWorkerAssetInventoryDigest(assets),
    };
    await replaceWorkerAssetDirectory(temporaryDirectory, outputDirectory);
    return { artifactNames, outputDirectory, evidence };
  } catch (error) {
    await rm(temporaryDirectory, { recursive: true, force: true }).catch(
      () => undefined,
    );
    if (error instanceof WorkerAssetBuildError) throw error;
    throw new WorkerAssetBuildError("BUILD_FAILED");
  }
}

async function gitOutput(root: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", root, ...args], {
    encoding: "utf8",
  });
  return stdout.trim();
}

async function main(): Promise<void> {
  try {
    const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
    const outputDirectory = resolve(repositoryRoot, "mcp-worker/.worker-assets");
    const result = await buildWorkerAssets({
      dataRoot: resolve(repositoryRoot, "data"),
      outputDirectory,
      workflowBuildId: WORKFLOW_BUILD_ID,
      allowedSourceFiles: WORKER_SOURCE_ONLY_FILES,
      readSourceState: async () => {
        const commitSha = await gitOutput(repositoryRoot, [
          "rev-parse",
          "HEAD",
        ]);
        const tree = await gitOutput(repositoryRoot, [
          "rev-parse",
          `${commitSha}^{tree}`,
        ]);
        return { commitSha, sourceTree: `git-tree:${tree}` };
      },
      assertCleanSource: async () => {
        const status = await gitOutput(repositoryRoot, [
          "status",
          "--porcelain=v1",
          "--untracked-files=all",
        ]);
        if (status !== "") throw new Error("dirty");
      },
    });
    process.stdout.write(`${stableStringify(result.evidence)}\n`);
  } catch (error) {
    const code =
      error instanceof WorkerAssetBuildError ? error.code : "BUILD_FAILED";
    process.stderr.write(`Build Worker static assets thất bại (${code}).\n`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1];
if (
  invokedPath !== undefined &&
  pathToFileURL(resolve(invokedPath)).href === import.meta.url
) {
  await main();
}
