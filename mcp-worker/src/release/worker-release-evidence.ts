import {
  ARTIFACT_NAMES,
  ArtifactContractError,
  createDataManifest,
  validateDataSnapshot,
  validateManifest,
  type ArtifactBytes,
  type ArtifactName,
} from "../data/artifact-contracts.js";
import { stableStringify } from "../domain/contracts.js";

const COMMIT_PATTERN = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u;
const SOURCE_TREE_PATTERN = /^git-tree:[a-f0-9]{40}(?:[a-f0-9]{24})?$/u;
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const WORKFLOW_BUILD_PATTERN = /^build:sha256b64:[A-Za-z0-9_-]{43}$/u;
const EVIDENCE_KEYS = [
  "assetInventoryDigest",
  "commitSha",
  "manifestSha256",
  "releaseId",
  "schemaVersion",
  "sourceTree",
  "workflowBuildId",
] as const;
const ASSET_NAMES = [
  ...ARTIFACT_NAMES.map((name) => `${name}.json`),
  "manifest.json",
].sort();
const textDecoder = new TextDecoder("utf-8", {
  fatal: true,
  ignoreBOM: false,
});

export class WorkerAssetBuildError extends Error {
  constructor(
    readonly code:
      | "INVALID_BUILD_IDENTITY"
      | "SOURCE_IDENTITY_CHANGED"
      | "SOURCE_NOT_CLEAN"
      | "INVALID_OUTPUT_PATH"
      | "INVALID_SOURCE_ASSET"
      | "INVALID_RELEASE_EVIDENCE"
      | "BUILD_FAILED",
  ) {
    super("Không thể build Worker static assets.");
    this.name = "WorkerAssetBuildError";
  }
}

export interface WorkerReleaseEvidence {
  schemaVersion: 1;
  commitSha: string;
  sourceTree: `git-tree:${string}`;
  manifestSha256: `sha256:${string}`;
  releaseId: `sha256:${string}`;
  workflowBuildId: `build:sha256b64:${string}`;
  assetInventoryDigest: `sha256:${string}`;
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

function requireExactAssets(
  assets: ReadonlyMap<string, Uint8Array>,
): void {
  const names = [...assets.keys()].sort();
  if (
    names.join("\0") !== ASSET_NAMES.join("\0") ||
    [...assets.values()].some((bytes) => !(bytes instanceof Uint8Array))
  ) {
    throw new WorkerAssetBuildError("INVALID_RELEASE_EVIDENCE");
  }
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.byteLength === right.byteLength &&
    left.every((byte, index) => byte === right[index])
  );
}

export async function calculateWorkerAssetInventoryDigest(
  assets: ReadonlyMap<string, Uint8Array>,
): Promise<`sha256:${string}`> {
  requireExactAssets(assets);
  const inventory = await Promise.all(
    [...assets]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(async ([path, bytes]) => ({
        path,
        byteLength: bytes.byteLength,
        sha256: await sha256(bytes),
      })),
  );
  return sha256(
    new TextEncoder().encode(
      stableStringify({ schemaVersion: 1, assets: inventory }),
    ),
  );
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new WorkerAssetBuildError("INVALID_RELEASE_EVIDENCE");
  }
  return value as Record<string, unknown>;
}

export function parseWorkerReleaseEvidence(
  value: unknown,
  options: { expected?: WorkerReleaseEvidence } = {},
): WorkerReleaseEvidence {
  const input = record(value);
  if (
    Object.keys(input).sort().join("\0") !== EVIDENCE_KEYS.join("\0") ||
    input.schemaVersion !== 1 ||
    typeof input.commitSha !== "string" ||
    !COMMIT_PATTERN.test(input.commitSha) ||
    typeof input.sourceTree !== "string" ||
    !SOURCE_TREE_PATTERN.test(input.sourceTree) ||
    typeof input.manifestSha256 !== "string" ||
    !SHA256_PATTERN.test(input.manifestSha256) ||
    typeof input.releaseId !== "string" ||
    !SHA256_PATTERN.test(input.releaseId) ||
    typeof input.workflowBuildId !== "string" ||
    !WORKFLOW_BUILD_PATTERN.test(input.workflowBuildId) ||
    typeof input.assetInventoryDigest !== "string" ||
    !SHA256_PATTERN.test(input.assetInventoryDigest)
  ) {
    throw new WorkerAssetBuildError("INVALID_RELEASE_EVIDENCE");
  }
  const evidence: WorkerReleaseEvidence = {
    schemaVersion: 1,
    commitSha: input.commitSha,
    sourceTree: input.sourceTree as WorkerReleaseEvidence["sourceTree"],
    manifestSha256:
      input.manifestSha256 as WorkerReleaseEvidence["manifestSha256"],
    releaseId: input.releaseId as WorkerReleaseEvidence["releaseId"],
    workflowBuildId:
      input.workflowBuildId as WorkerReleaseEvidence["workflowBuildId"],
    assetInventoryDigest:
      input.assetInventoryDigest as WorkerReleaseEvidence["assetInventoryDigest"],
  };
  const expected = options.expected;
  if (
    expected !== undefined &&
    (Object.keys(evidence) as (keyof WorkerReleaseEvidence)[]).some(
      (key) => evidence[key] !== expected[key],
    )
  ) {
    throw new WorkerAssetBuildError("INVALID_RELEASE_EVIDENCE");
  }
  return evidence;
}

export async function verifyWorkerReleaseEvidence(
  value: unknown,
  options: {
    assets: ReadonlyMap<string, Uint8Array>;
    expectedSource: {
      commitSha: string;
      sourceTree: string;
      workflowBuildId: string;
    };
  },
): Promise<WorkerReleaseEvidence> {
  const evidence = parseWorkerReleaseEvidence(value);
  assertWorkerBuildIdentity(options.expectedSource);
  if (
    evidence.commitSha !== options.expectedSource.commitSha ||
    evidence.sourceTree !== options.expectedSource.sourceTree ||
    evidence.workflowBuildId !== options.expectedSource.workflowBuildId
  ) {
    throw new WorkerAssetBuildError("INVALID_RELEASE_EVIDENCE");
  }
  try {
    requireExactAssets(options.assets);
    const manifestBytes = options.assets.get("manifest.json")!;
    const manifest = await validateManifest(
      JSON.parse(textDecoder.decode(manifestBytes)),
    );
    const artifacts: ArtifactBytes = new Map(
      ARTIFACT_NAMES.map((name) => [
        name,
        options.assets.get(`${name}.json`),
      ] as [ArtifactName, Uint8Array]),
    );
    await validateDataSnapshot(manifest, artifacts);
    const canonicalManifest = await createDataManifest(artifacts);
    const canonicalManifestBytes = new TextEncoder().encode(
      `${stableStringify(canonicalManifest)}\n`,
    );
    if (
      !sameBytes(manifestBytes, canonicalManifestBytes) ||
      evidence.releaseId !== manifest.releaseId ||
      evidence.manifestSha256 !== (await sha256(manifestBytes)) ||
      evidence.assetInventoryDigest !==
        (await calculateWorkerAssetInventoryDigest(options.assets))
    ) {
      throw new WorkerAssetBuildError("INVALID_RELEASE_EVIDENCE");
    }
    return evidence;
  } catch (error) {
    if (error instanceof WorkerAssetBuildError) throw error;
    if (error instanceof ArtifactContractError || error instanceof Error) {
      throw new WorkerAssetBuildError("INVALID_RELEASE_EVIDENCE");
    }
    throw error;
  }
}

export function assertWorkerBuildIdentity(value: {
  commitSha: string;
  sourceTree: string;
  workflowBuildId: string;
}): asserts value is {
  commitSha: string;
  sourceTree: WorkerReleaseEvidence["sourceTree"];
  workflowBuildId: WorkerReleaseEvidence["workflowBuildId"];
} {
  if (
    !COMMIT_PATTERN.test(value.commitSha) ||
    !SOURCE_TREE_PATTERN.test(value.sourceTree) ||
    !WORKFLOW_BUILD_PATTERN.test(value.workflowBuildId)
  ) {
    throw new WorkerAssetBuildError("INVALID_BUILD_IDENTITY");
  }
}
