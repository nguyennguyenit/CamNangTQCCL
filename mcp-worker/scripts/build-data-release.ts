import { execFile } from "node:child_process";
import {
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

import {
  ARTIFACT_NAMES,
  createDataManifest,
  validateDataSnapshot,
  type ArtifactName,
} from "../src/data/artifact-contracts.js";
import { stableStringify } from "../src/domain/contracts.js";

const execFileAsync = promisify(execFile);
const SOURCE_TREE_PATTERN = /^git-tree:(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;

export class ReleaseBuildError extends Error {
  constructor(
    readonly code:
      | "INVALID_SOURCE_TREE"
      | "SOURCE_NOT_CLEAN"
      | "INVALID_OUTPUT_PATH"
      | "EXISTING_RELEASE_MISMATCH"
      | "BUILD_FAILED",
  ) {
    super("Không thể build data release.");
    this.name = "ReleaseBuildError";
  }
}

export interface BuildDataReleaseOptions {
  dataRoot: string | URL;
  outputRoot: string | URL;
  sourceTree: string;
  assertCleanSource: () => Promise<void>;
}

export interface DataReleaseBuild {
  releaseId: `sha256:${string}`;
  dataVersion: `data:${string}`;
  manifestSha256: `sha256:${string}`;
  sourceTree: `git-tree:${string}`;
  artifactNames: typeof ARTIFACT_NAMES;
  releaseDirectory: string;
  manifestPath: string;
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

async function writeImmutable(path: string, bytes: Uint8Array): Promise<void> {
  try {
    await writeFile(path, bytes, { flag: "wx" });
  } catch (error) {
    const existing = await readFile(path).catch(() => null);
    if (
      existing === null ||
      !new Uint8Array(existing).every(
        (byte, index) => byte === bytes[index],
      ) ||
      existing.byteLength !== bytes.byteLength
    ) {
      throw new ReleaseBuildError("EXISTING_RELEASE_MISMATCH");
    }
    if (
      typeof error !== "object" ||
      error === null ||
      !("code" in error) ||
      error.code !== "EEXIST"
    ) {
      throw new ReleaseBuildError("BUILD_FAILED");
    }
  }
}

export async function buildDataRelease(
  options: BuildDataReleaseOptions,
): Promise<DataReleaseBuild> {
  if (!SOURCE_TREE_PATTERN.test(options.sourceTree)) {
    throw new ReleaseBuildError("INVALID_SOURCE_TREE");
  }
  try {
    await options.assertCleanSource();
  } catch {
    throw new ReleaseBuildError("SOURCE_NOT_CLEAN");
  }
  const dataRoot = toPath(options.dataRoot);
  const outputRoot = toPath(options.outputRoot);
  if (isWithin(dataRoot, outputRoot)) {
    throw new ReleaseBuildError("INVALID_OUTPUT_PATH");
  }
  try {
    const entries = await Promise.all(
      ARTIFACT_NAMES.map(async (name) => [
        name,
        new Uint8Array(await readFile(resolve(dataRoot, `${name}.json`))),
      ] as const),
    );
    await options.assertCleanSource();
    const objects = new Map<ArtifactName, Uint8Array>(entries);
    const manifest = await createDataManifest(objects);
    await validateDataSnapshot(manifest, objects);
    const manifestBytes = new TextEncoder().encode(
      `${stableStringify(manifest)}\n`,
    );
    const releaseDirectory = resolve(
      outputRoot,
      "releases",
      manifest.releaseId.slice("sha256:".length),
    );
    await mkdir(releaseDirectory, { recursive: true });
    for (const descriptor of manifest.artifacts) {
      await writeImmutable(
        resolve(releaseDirectory, descriptor.key),
        objects.get(descriptor.name)!,
      );
    }
    const manifestPath = resolve(releaseDirectory, "manifest.json");
    await writeImmutable(manifestPath, manifestBytes);
    return {
      releaseId: manifest.releaseId,
      dataVersion: manifest.dataVersion,
      manifestSha256: await sha256(manifestBytes),
      sourceTree: options.sourceTree as DataReleaseBuild["sourceTree"],
      artifactNames: ARTIFACT_NAMES,
      releaseDirectory,
      manifestPath,
    };
  } catch (error) {
    if (error instanceof ReleaseBuildError) throw error;
    throw new ReleaseBuildError("BUILD_FAILED");
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
    const repositoryRoot = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../..",
    );
    const canonicalDataRoot = resolve(repositoryRoot, "data");
    const dataRoot = resolve(
      process.env["TQCCL_DATA_ROOT"] ?? canonicalDataRoot,
    );
    const outputRoot = process.env["TQCCL_RELEASE_OUTPUT"];
    if (
      outputRoot === undefined ||
      outputRoot === "" ||
      dataRoot !== canonicalDataRoot
    ) {
      throw new ReleaseBuildError("INVALID_OUTPUT_PATH");
    }
    const tree = await gitOutput(repositoryRoot, ["rev-parse", "HEAD^{tree}"]);
    const result = await buildDataRelease({
      dataRoot,
      outputRoot,
      sourceTree: `git-tree:${tree}`,
      assertCleanSource: async () => {
        const status = await gitOutput(repositoryRoot, [
          "status",
          "--porcelain=v1",
          "--untracked-files=all",
        ]);
        if (status !== "") throw new Error("dirty");
      },
    });
    process.stdout.write(
      `${stableStringify({
        releaseId: result.releaseId,
        dataVersion: result.dataVersion,
        manifestSha256: result.manifestSha256,
        sourceTree: result.sourceTree,
        artifactNames: result.artifactNames,
      })}\n`,
    );
  } catch {
    process.stderr.write("Build data release thất bại.\n");
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
