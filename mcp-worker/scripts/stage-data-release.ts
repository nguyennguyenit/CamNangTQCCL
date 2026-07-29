import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import {
  ARTIFACT_NAMES,
  createDataManifest,
  type ArtifactName,
} from "../src/data/artifact-contracts.js";
import { stableStringify } from "../src/domain/contracts.js";
import {
  stageDataRelease,
  type ImmutableReleaseStore,
} from "./publish-data-release.js";
import {
  createR2S3Client,
  S3ImmutableReleaseStore,
} from "./r2-release-store.js";
import { verifyControlPlaneLive } from "./verify-control-plane.js";

const execFileAsync = promisify(execFile);
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const SOURCE_TREE_PATTERN = /^git-tree:(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;
const RELEASE_TARGETS = {
  staging: {
    releaseBucket: "tqccl-release-objects-staging",
    pointerBucket: "tqccl-release-pointer-staging",
  },
  production: {
    releaseBucket: "tqccl-release-objects",
    pointerBucket: "tqccl-release-pointer",
  },
} as const;
const FORBIDDEN_STAGE_CREDENTIALS = [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "CF_API_TOKEN",
  "CLOUDFLARE_API_KEY",
  "CLOUDFLARE_API_TOKEN",
  "TQCCL_R2_POINTER_ACCESS_KEY_ID",
  "TQCCL_R2_POINTER_SECRET_ACCESS_KEY",
  "TQCCL_MCP_BEARER_CURRENT",
  "TQCCL_MCP_BEARER_NEXT",
  "TQCCL_WORKER_DEPLOY_API_TOKEN",
] as const;

interface BuildMetadata {
  releaseId: `sha256:${string}`;
  dataVersion: `data:${string}`;
  manifestSha256: `sha256:${string}`;
  sourceTree: `git-tree:${string}`;
  artifactNames: readonly ArtifactName[];
}

export class StageDriverError extends Error {
  constructor() {
    super("Không thể chạy stage data release.");
    this.name = "StageDriverError";
  }
}

function validateMetadata(value: unknown): BuildMetadata {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new StageDriverError();
  }
  const metadata = value as Record<string, unknown>;
  const artifactNames = Array.isArray(metadata.artifactNames)
    ? metadata.artifactNames
    : null;
  if (
    typeof metadata.releaseId !== "string" ||
    !SHA256_PATTERN.test(metadata.releaseId) ||
    metadata.dataVersion !==
      `data:${metadata.releaseId.slice("sha256:".length, "sha256:".length + 12)}` ||
    typeof metadata.manifestSha256 !== "string" ||
    !SHA256_PATTERN.test(metadata.manifestSha256) ||
    typeof metadata.sourceTree !== "string" ||
    !SOURCE_TREE_PATTERN.test(metadata.sourceTree) ||
    artifactNames === null ||
    artifactNames.length !== ARTIFACT_NAMES.length ||
    ARTIFACT_NAMES.some(
      (name, index) => artifactNames[index] !== name,
    )
  ) {
    throw new StageDriverError();
  }
  return {
    releaseId: metadata.releaseId as BuildMetadata["releaseId"],
    dataVersion: metadata.dataVersion as BuildMetadata["dataVersion"],
    manifestSha256:
      metadata.manifestSha256 as BuildMetadata["manifestSha256"],
    sourceTree: metadata.sourceTree as BuildMetadata["sourceTree"],
    artifactNames: ARTIFACT_NAMES,
  };
}

export function assertStageCredentialBoundary(
  environment: NodeJS.ProcessEnv,
): void {
  if (FORBIDDEN_STAGE_CREDENTIALS.some((name) => environment[name])) {
    throw new StageDriverError();
  }
}

export function validateReleaseTarget(
  environment: "staging" | "production",
  releaseBucket: string,
  pointerBucket: string,
): void {
  const target = RELEASE_TARGETS[environment];
  if (
    releaseBucket !== target.releaseBucket ||
    pointerBucket !== target.pointerBucket
  ) {
    throw new StageDriverError();
  }
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

export async function verifyCanonicalDataSource(options: {
  dataRoot: string | URL;
  metadata: unknown;
}): Promise<void> {
  const metadata = validateMetadata(options.metadata);
  const dataRoot =
    options.dataRoot instanceof URL
      ? fileURLToPath(options.dataRoot)
      : resolve(options.dataRoot);
  try {
    const artifacts = new Map<ArtifactName, Uint8Array>(
      await Promise.all(
        ARTIFACT_NAMES.map(async (name) => [
          name,
          new Uint8Array(await readFile(resolve(dataRoot, `${name}.json`))),
        ] as const),
      ),
    );
    const manifest = await createDataManifest(artifacts);
    const manifestBytes = new TextEncoder().encode(
      `${stableStringify(manifest)}\n`,
    );
    if (
      manifest.releaseId !== metadata.releaseId ||
      manifest.dataVersion !== metadata.dataVersion ||
      (await sha256(manifestBytes)) !== metadata.manifestSha256
    ) {
      throw new Error("source mismatch");
    }
  } catch {
    throw new StageDriverError();
  }
}

export async function loadBuiltRelease(options: {
  metadata: unknown;
  releaseDirectory: string | URL;
}): Promise<{
  metadata: BuildMetadata;
  objects: ReadonlyMap<string, Uint8Array>;
  buildEvidence: {
    sourceTree: `git-tree:${string}`;
    manifestSha256: `sha256:${string}`;
  };
}> {
  const metadata = validateMetadata(options.metadata);
  const directory =
    options.releaseDirectory instanceof URL
      ? fileURLToPath(options.releaseDirectory)
      : resolve(options.releaseDirectory);
  const prefix = `releases/${metadata.releaseId.slice("sha256:".length)}`;
  try {
    const objects = new Map<string, Uint8Array>(
      await Promise.all(
        [...ARTIFACT_NAMES, "manifest" as const].map(async (name) => [
          `${prefix}/${name}.json`,
          new Uint8Array(await readFile(resolve(directory, `${name}.json`))),
        ] as const),
      ),
    );
    return {
      metadata,
      objects,
      buildEvidence: {
        sourceTree: metadata.sourceTree,
        manifestSha256: metadata.manifestSha256,
      },
    };
  } catch {
    throw new StageDriverError();
  }
}

export async function stageBuiltRelease(options: {
  metadata: unknown;
  releaseDirectory: string | URL;
  releaseStore: ImmutableReleaseStore;
  verifyPreflight: () => Promise<void>;
  verifyRepositoryGate: () => Promise<{
    sourceTree: `git-tree:${string}`;
  }>;
}): Promise<{ releaseId: string; created: number; reused: number }> {
  const built = await loadBuiltRelease(options);
  return stageDataRelease({
    releaseId: built.metadata.releaseId,
    objects: built.objects,
    buildEvidence: built.buildEvidence,
    releaseStore: options.releaseStore,
    verifyPreflight: options.verifyPreflight,
    verifyRepositoryGate: options.verifyRepositoryGate,
  });
}

export function parseStageArguments(args: readonly string[]): {
  metadataPath: string;
  releaseDirectory: string;
  environment: "staging" | "production";
} {
  if (
    args.length !== 6 ||
    args[0] !== "--metadata" ||
    args[2] !== "--release-directory" ||
    args[4] !== "--environment" ||
    args[1] === "" ||
    args[3] === "" ||
    (args[5] !== "staging" && args[5] !== "production")
  ) {
    throw new StageDriverError();
  }
  return {
    metadataPath: resolve(args[1]!),
    releaseDirectory: resolve(args[3]!),
    environment: args[5],
  };
}

function requireEnvironment(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") throw new StageDriverError();
  return value;
}

async function gitOutput(root: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", root, ...args], {
    encoding: "utf8",
    env: {
      PATH: process.env["PATH"],
      LANG: process.env["LANG"],
    },
  });
  return stdout.trim();
}

async function main(): Promise<void> {
  try {
    const args = parseStageArguments(process.argv.slice(2));
    assertStageCredentialBoundary(process.env);
    const repositoryRoot = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../..",
    );
    const metadata: unknown = JSON.parse(
      await readFile(args.metadataPath, "utf8"),
    );
    const requirements: unknown = JSON.parse(
      await readFile(
        new URL("../infra/control-plane-requirements.json", import.meta.url),
        "utf8",
      ),
    );
    const accountId = requireEnvironment("CLOUDFLARE_ACCOUNT_ID");
    const releaseBucket = requireEnvironment("TQCCL_RELEASE_BUCKET_NAME");
    const pointerBucket = requireEnvironment("TQCCL_POINTER_BUCKET_NAME");
    validateReleaseTarget(
      args.environment,
      releaseBucket,
      pointerBucket,
    );
    const client = createR2S3Client({
      accountId,
      accessKeyId: requireEnvironment("TQCCL_R2_RELEASE_ACCESS_KEY_ID"),
      secretAccessKey: requireEnvironment(
        "TQCCL_R2_RELEASE_SECRET_ACCESS_KEY",
      ),
    });
    const result = await stageBuiltRelease({
      metadata,
      releaseDirectory: args.releaseDirectory,
      releaseStore: new S3ImmutableReleaseStore(client, releaseBucket),
      verifyRepositoryGate: async () => {
        const status = await gitOutput(repositoryRoot, [
          "status",
          "--porcelain=v1",
          "--untracked-files=all",
        ]);
        if (status !== "") throw new StageDriverError();
        const tree = await gitOutput(repositoryRoot, [
          "rev-parse",
          "HEAD^{tree}",
        ]);
        await verifyCanonicalDataSource({
          dataRoot: resolve(repositoryRoot, "data"),
          metadata,
        });
        return { sourceTree: `git-tree:${tree}` };
      },
      verifyPreflight: async () => {
        await verifyControlPlaneLive(requirements, {
          accountId,
          zoneId: requireEnvironment("CLOUDFLARE_ZONE_ID"),
          releaseBucket,
          pointerBucket,
          apiToken: requireEnvironment(
            "CLOUDFLARE_CONTROL_PLANE_READ_TOKEN",
          ),
        });
      },
    });
    process.stdout.write(
      `${stableStringify({ ...result, environment: args.environment })}\n`,
    );
  } catch {
    process.stderr.write("Stage data release thất bại.\n");
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
