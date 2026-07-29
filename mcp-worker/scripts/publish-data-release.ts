import {
  ARTIFACT_NAMES,
  validateDataSnapshot,
  validateManifest,
  type ArtifactName,
  type ReleasePointer,
} from "../src/data/artifact-contracts.js";
import {
  validatePromotionReceipt,
  type PromotionReceipt,
  type PromotionReceiptExpectation,
} from "../src/release/promotion-receipt.js";

const RELEASE_ID_PATTERN = /^sha256:[a-f0-9]{64}$/u;

export class ReleasePublishError extends Error {
  constructor(
    readonly code:
      | "INVALID_RELEASE"
      | "PREFLIGHT_FAILED"
      | "EXISTING_OBJECT_MISMATCH"
      | "POINTER_STATE_MISMATCH"
      | "DEPLOYMENT_FAILED"
      | "DEPLOYMENT_NOT_EXCLUSIVE"
      | "POINTER_CAS_CONFLICT"
      | "LIVE_VERIFICATION_FAILED"
      | "ROLLBACK_CAS_CONFLICT",
  ) {
    super("Không thể publish data release.");
    this.name = "ReleasePublishError";
  }
}

export interface ImmutableReleaseStore {
  putIfAbsent(
    key: string,
    bytes: Uint8Array,
  ): Promise<{ created: boolean }>;
  read(key: string): Promise<{ bytes: Uint8Array } | null>;
}

export interface PointerState {
  etag: string;
  value: ReleasePointer;
}

export interface PointerStore {
  readCurrent(): Promise<PointerState | null>;
  compareAndSwapCurrent(
    expectedEtag: string,
    value: ReleasePointer,
  ): Promise<{ etag: string } | null>;
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  return left.every((byte, index) => byte === right[index]);
}

function samePointer(left: ReleasePointer, right: ReleasePointer): boolean {
  return (
    left.schemaVersion === right.schemaVersion &&
    left.releaseId === right.releaseId &&
    left.manifestKey === right.manifestKey
  );
}

function releasePrefix(releaseId: string): string {
  if (!RELEASE_ID_PATTERN.test(releaseId)) {
    throw new ReleasePublishError("INVALID_RELEASE");
  }
  return `releases/${releaseId.slice("sha256:".length)}`;
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

async function validateReleaseObjects(
  releaseId: `sha256:${string}`,
  objects: ReadonlyMap<string, Uint8Array>,
): Promise<{ manifestSha256: `sha256:${string}` }> {
  const prefix = releasePrefix(releaseId);
  const expectedKeys = [
    ...ARTIFACT_NAMES.map((name) => `${prefix}/${name}.json`),
    `${prefix}/manifest.json`,
  ];
  if (
    objects.size !== expectedKeys.length ||
    expectedKeys.some((key) => !objects.has(key))
  ) {
    throw new ReleasePublishError("INVALID_RELEASE");
  }
  try {
    const manifestBytes = objects.get(`${prefix}/manifest.json`)!;
    const manifest = await validateManifest(
      JSON.parse(
        new TextDecoder("utf-8", {
          fatal: true,
          ignoreBOM: false,
        }).decode(manifestBytes),
      ),
    );
    if (manifest.releaseId !== releaseId) {
      throw new Error("release mismatch");
    }
    const artifactBytes = new Map<ArtifactName, Uint8Array>(
      ARTIFACT_NAMES.map((name) => [
        name,
        objects.get(`${prefix}/${name}.json`)!,
      ]),
    );
    await validateDataSnapshot(manifest, artifactBytes);
    return { manifestSha256: await sha256(manifestBytes) };
  } catch {
    throw new ReleasePublishError("INVALID_RELEASE");
  }
}

export async function stageDataRelease(options: {
  releaseId: `sha256:${string}`;
  objects: ReadonlyMap<string, Uint8Array>;
  buildEvidence: {
    sourceTree: `git-tree:${string}`;
    manifestSha256: `sha256:${string}`;
  };
  releaseStore: ImmutableReleaseStore;
  verifyPreflight: () => Promise<void>;
  verifyRepositoryGate: () => Promise<{ sourceTree: `git-tree:${string}` }>;
}): Promise<{ releaseId: string; created: number; reused: number }> {
  const release = await validateReleaseObjects(
    options.releaseId,
    options.objects,
  );
  try {
    const repository = await options.verifyRepositoryGate();
    if (
      repository.sourceTree !== options.buildEvidence.sourceTree ||
      release.manifestSha256 !== options.buildEvidence.manifestSha256
    ) {
      throw new Error("provenance mismatch");
    }
    await options.verifyPreflight();
  } catch {
    throw new ReleasePublishError("PREFLIGHT_FAILED");
  }
  let created = 0;
  let reused = 0;
  const manifestKey = `${releasePrefix(options.releaseId)}/manifest.json`;
  const orderedObjects = [...options.objects].sort(([left], [right]) => {
    if (left === manifestKey) return 1;
    if (right === manifestKey) return -1;
    return left.localeCompare(right);
  });
  for (const [key, bytes] of orderedObjects) {
    const result = await options.releaseStore.putIfAbsent(key, bytes);
    const stored = await options.releaseStore.read(key);
    if (stored === null || !sameBytes(stored.bytes, bytes)) {
      throw new ReleasePublishError("EXISTING_OBJECT_MISMATCH");
    }
    if (result.created) created += 1;
    else reused += 1;
  }
  return { releaseId: options.releaseId, created, reused };
}

export interface DeploymentState {
  versionId: string;
  percentage: number;
  activeVersions: number;
}

export interface PriorDeployment {
  deploymentId: string;
  versions: Array<{
    versionId: string;
    percentage: number;
  }>;
}

export interface DeploymentController {
  readCurrent(): Promise<PriorDeployment>;
  deployExclusive(versionId: string): Promise<DeploymentState>;
}

export interface ActivationLease {
  runExclusive<T>(operation: () => Promise<T>): Promise<T>;
}

type ActivateDataReleaseOptions = Parameters<typeof activateDataRelease>[0];

export async function activateDataReleaseWithDeployment(
  options: Omit<
    ActivateDataReleaseOptions,
    | "prepareDeployment"
    | "deploySingleVersion"
  > & {
    deployment: DeploymentController;
    activationLease: ActivationLease;
  },
): ReturnType<typeof activateDataRelease> {
  return options.activationLease.runExclusive(() =>
    activateDataRelease({
      receipt: options.receipt,
      expected: options.expected,
      now: options.now,
      pointerStore: options.pointerStore,
      verifyPreflight: options.verifyPreflight,
      prepareDeployment: async () => {
        const priorDeployment = await options.deployment.readCurrent();
        if (
          priorDeployment.versions.length !== 1 ||
          priorDeployment.versions[0]?.percentage !== 100
        ) {
          throw new ReleasePublishError("DEPLOYMENT_NOT_EXCLUSIVE");
        }
      },
      deploySingleVersion: () =>
        options.deployment.deployExclusive(options.receipt.workerVersionId),
      verifyLive: options.verifyLive,
    }),
  );
}

async function activateDataRelease(options: {
  receipt: PromotionReceipt;
  expected: PromotionReceiptExpectation;
  now: Date;
  pointerStore: PointerStore;
  verifyPreflight: () => Promise<void>;
  prepareDeployment?: () => Promise<void>;
  deploySingleVersion: () => Promise<DeploymentState>;
  verifyLive: (input: {
    releaseId: string;
    workerVersionId: string;
    forceRefresh: true;
  }) => Promise<void>;
}): Promise<{
  activated: true;
  releaseId: string;
  pointerEtag: string;
}> {
  await validatePromotionReceipt(options.receipt, {
    now: options.now,
    expected: options.expected,
  });
  try {
    await options.verifyPreflight();
  } catch {
    throw new ReleasePublishError("PREFLIGHT_FAILED");
  }
  const current = await options.pointerStore.readCurrent();
  if (
    current === null ||
    current.etag !== options.receipt.priorPointer.etag ||
    !samePointer(current.value, options.receipt.priorPointer.value)
  ) {
    throw new ReleasePublishError("POINTER_STATE_MISMATCH");
  }
  await options.prepareDeployment?.();
  let deployment: DeploymentState;
  try {
    deployment = await options.deploySingleVersion();
    if (
      deployment.versionId !== options.receipt.workerVersionId ||
      deployment.percentage !== 100 ||
      deployment.activeVersions !== 1
    ) {
      throw new ReleasePublishError("DEPLOYMENT_NOT_EXCLUSIVE");
    }
  } catch (error) {
    if (
      error instanceof ReleasePublishError &&
      error.code === "DEPLOYMENT_NOT_EXCLUSIVE"
    ) {
      throw error;
    }
    throw new ReleasePublishError("DEPLOYMENT_FAILED");
  }
  const targetPointer: ReleasePointer = {
    schemaVersion: 1,
    releaseId: options.receipt.releaseId,
    manifestKey: `${releasePrefix(options.receipt.releaseId)}/manifest.json`,
  };
  const activated = await options.pointerStore.compareAndSwapCurrent(
    current.etag,
    targetPointer,
  );
  if (activated === null) {
    throw new ReleasePublishError("POINTER_CAS_CONFLICT");
  }
  try {
    await options.verifyLive({
      releaseId: options.receipt.releaseId,
      workerVersionId: options.receipt.workerVersionId,
      forceRefresh: true,
    });
  } catch {
    const restored = await options.pointerStore.compareAndSwapCurrent(
      activated.etag,
      options.receipt.priorPointer.value,
    );
    if (restored === null) {
      throw new ReleasePublishError("ROLLBACK_CAS_CONFLICT");
    }
    throw new ReleasePublishError("LIVE_VERIFICATION_FAILED");
  }
  return {
    activated: true,
    releaseId: options.receipt.releaseId,
    pointerEtag: activated.etag,
  };
}
