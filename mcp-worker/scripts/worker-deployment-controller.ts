import { setTimeout as delay } from "node:timers/promises";

import type { WorkerDeploymentSnapshot } from "./cloudflare-deployment-client.js";

type ExclusivePurpose = "bootstrap" | "promote" | "restore" | "rollback";
type MutationPurpose = ExclusivePurpose | "smoke";
type Sleep = (delayMs: number) => Promise<void>;

/**
 * Khoảng chờ giữa các lần đọc lại sau một mutation (~30 s tổng). API deployment của Cloudflare có thể commit
 * nhưng làm mất/lỗi response, và lần đọc ngay sau đó còn trả deployment trước mutation (run 38762022539).
 */
export const MUTATION_READ_BACK_DELAYS_MS = [0, 1_000, 2_000, 4_000, 8_000, 15_000] as const;

const defaultSleep: Sleep = (delayMs) => delay(delayMs);

export interface WorkerDeploymentGateway {
  readCurrentOptional(): Promise<WorkerDeploymentSnapshot | null>;
  readCurrent(): Promise<WorkerDeploymentSnapshot>;
  deployTest(
    priorVersionId: string,
    candidateVersionId: string,
  ): Promise<WorkerDeploymentSnapshot>;
  deployExclusive(
    versionId: string,
    purpose?: ExclusivePurpose,
  ): Promise<WorkerDeploymentSnapshot>;
}

export interface WorkerReleaseEvidence {
  prior: WorkerDeploymentSnapshot;
  smoke: WorkerDeploymentSnapshot;
  rollbackRehearsal?: {
    rolledBack: WorkerDeploymentSnapshot;
  };
  final: WorkerDeploymentSnapshot;
}

export interface WorkerBootstrapEvidence {
  final: WorkerDeploymentSnapshot;
}

export class DeploymentOwnershipError extends Error {
  constructor() {
    super("Deployment đã thay đổi; dừng mutation và mở incident.");
    this.name = "DeploymentOwnershipError";
  }
}

function sameDeployment(
  actual: WorkerDeploymentSnapshot,
  expected: WorkerDeploymentSnapshot,
): boolean {
  return (
    actual.deploymentId === expected.deploymentId &&
    actual.ownerTag === expected.ownerTag &&
    sameVersions(actual, expected.versions)
  );
}

function sameVersions(
  snapshot: WorkerDeploymentSnapshot,
  versions: WorkerDeploymentSnapshot["versions"],
): boolean {
  return (
    snapshot.versions.length === versions.length &&
    snapshot.versions.every((version, index) => {
      const expected = versions[index];
      return (
        expected !== undefined &&
        version.versionId === expected.versionId &&
        version.percentage === expected.percentage
      );
    })
  );
}

function ownedShape(
  snapshot: WorkerDeploymentSnapshot,
  runId: string,
  versions: WorkerDeploymentSnapshot["versions"],
): boolean {
  return snapshot.ownerTag === runId && sameVersions(snapshot, versions);
}

function exclusiveVersion(snapshot: WorkerDeploymentSnapshot): string | null {
  const version = snapshot.versions[0];
  return snapshot.versions.length === 1 && version?.percentage === 100
    ? version.versionId
    : null;
}

export async function preflightWorkerRelease(options: {
  bootstrap: boolean;
  deployment: Pick<WorkerDeploymentGateway, "readCurrentOptional">;
}): Promise<
  | { mode: "bootstrap" }
  | { mode: "normal"; priorVersionId: string }
> {
  const current = await options.deployment.readCurrentOptional();
  if (options.bootstrap) {
    if (current !== null) throw new DeploymentOwnershipError();
    return { mode: "bootstrap" };
  }
  if (current === null) throw new DeploymentOwnershipError();
  const priorVersionId = exclusiveVersion(current);
  if (priorVersionId === null) throw new DeploymentOwnershipError();
  return { mode: "normal", priorVersionId };
}

async function reportDrift(
  incident: (() => Promise<void>) | undefined,
): Promise<never> {
  await incident?.();
  throw new DeploymentOwnershipError();
}

/**
 * Đọc deployment hiện tại sau mutation. Lỗi đọc và kết quả còn y nguyên `unchangedFrom` đều được đọc lại theo
 * `MUTATION_READ_BACK_DELAYS_MS`; hết cửa sổ mà vẫn y nguyên thì trả bản đó để người gọi kết luận "chưa đổi".
 * Không đọc được lần nào thì mở incident.
 */
async function readAfterMutation(
  deployment: WorkerDeploymentGateway,
  incident: (() => Promise<void>) | undefined,
  sleep: Sleep,
  unchangedFrom?: WorkerDeploymentSnapshot,
): Promise<WorkerDeploymentSnapshot> {
  let last: WorkerDeploymentSnapshot | undefined;
  for (const delayMs of MUTATION_READ_BACK_DELAYS_MS) {
    if (delayMs > 0) await sleep(delayMs);
    let observed: WorkerDeploymentSnapshot;
    try {
      observed = await deployment.readCurrent();
    } catch {
      continue;
    }
    last = observed;
    if (unchangedFrom === undefined || !sameDeployment(observed, unchangedFrom)) return observed;
  }
  return last ?? reportDrift(incident);
}

async function deployExclusiveAndConfirm(options: {
  deployment: WorkerDeploymentGateway;
  expectedCurrent: WorkerDeploymentSnapshot;
  targetVersionId: string;
  purpose: ExclusivePurpose;
  runId: string;
  sleep: Sleep;
  incident?: () => Promise<void>;
  onMutationError?: (purpose: MutationPurpose, error: unknown) => void;
}): Promise<WorkerDeploymentSnapshot> {
  const current = await readAfterMutation(
    options.deployment,
    options.incident,
    options.sleep,
  );
  if (!sameDeployment(current, options.expectedCurrent)) {
    return reportDrift(options.incident);
  }
  let response: WorkerDeploymentSnapshot | undefined;
  try {
    response = await options.deployment.deployExclusive(
      options.targetVersionId,
      options.purpose,
    );
  } catch (error) {
    // A deployment POST can commit even when its response is lost. Reconcile
    // using the run annotation before deciding whether it failed.
    options.onMutationError?.(options.purpose, error);
  }
  const observed = await readAfterMutation(
    options.deployment,
    options.incident,
    options.sleep,
    options.expectedCurrent,
  );
  const expectedVersions = [
    { versionId: options.targetVersionId, percentage: 100 },
  ];
  if (!ownedShape(observed, options.runId, expectedVersions)) {
    return reportDrift(options.incident);
  }
  if (response !== undefined && !sameDeployment(observed, response)) {
    return reportDrift(options.incident);
  }
  return observed;
}

export async function verifyBootstrapWorkerVersion(options: {
  candidateVersionId: string;
  deployment: WorkerDeploymentGateway;
  verifyProduction(versionId: string): Promise<void>;
  incident?: () => Promise<void>;
  onState?: (name: string, snapshot: WorkerDeploymentSnapshot) => void;
}): Promise<WorkerBootstrapEvidence> {
  const observed = await options.deployment.readCurrent();
  if (exclusiveVersion(observed) !== options.candidateVersionId) {
    await options.incident?.();
    throw new DeploymentOwnershipError();
  }
  options.onState?.("bootstrapped", observed);

  try {
    await options.verifyProduction(options.candidateVersionId);
  } catch {
    await options.incident?.();
    throw new Error(
      "Bootstrap production thất bại; chưa có prior version để rollback.",
    );
  }

  return { final: observed };
}

export async function releaseWorkerVersion(options: {
  runId: string;
  candidateVersionId: string;
  deployment: WorkerDeploymentGateway;
  verifyCandidate(versionId: string): Promise<void>;
  verifyProduction(versionId: string): Promise<void>;
  prepareRollbackVerification?: (
    priorVersionId: string,
  ) => Promise<() => Promise<void>>;
  incident?: () => Promise<void>;
  onState?: (name: string, snapshot: WorkerDeploymentSnapshot) => void;
  /** Lỗi của một POST deployment (response lỗi/mất); controller vẫn đọc lại để quyết định. */
  onMutationError?: (purpose: MutationPurpose, error: unknown) => void;
  sleep?: Sleep;
}): Promise<WorkerReleaseEvidence> {
  const sleep = options.sleep ?? defaultSleep;
  const confirm = (
    expectedCurrent: WorkerDeploymentSnapshot,
    targetVersionId: string,
    purpose: ExclusivePurpose,
  ) =>
    deployExclusiveAndConfirm({
      deployment: options.deployment,
      expectedCurrent,
      targetVersionId,
      purpose,
      runId: options.runId,
      sleep,
      ...(options.incident === undefined ? {} : { incident: options.incident }),
      ...(options.onMutationError === undefined ? {} : { onMutationError: options.onMutationError }),
    });
  const prior = await options.deployment.readCurrent();
  options.onState?.("prior", prior);
  const priorVersionId = exclusiveVersion(prior);
  if (
    !/^[A-Za-z0-9._:-]{1,128}$/u.test(options.runId) ||
    priorVersionId === null ||
    priorVersionId === options.candidateVersionId
  ) {
    throw new DeploymentOwnershipError();
  }
  const verifyRolledBack =
    await options.prepareRollbackVerification?.(priorVersionId);
  const smokeVersions = [
    { versionId: priorVersionId, percentage: 100 },
    { versionId: options.candidateVersionId, percentage: 0 },
  ];

  let smoke: WorkerDeploymentSnapshot;
  try {
    smoke = await options.deployment.deployTest(
      priorVersionId,
      options.candidateVersionId,
    );
  } catch (error) {
    options.onMutationError?.("smoke", error);
    const observed = await readAfterMutation(
      options.deployment,
      options.incident,
      sleep,
      prior,
    );
    if (sameDeployment(observed, prior)) {
      throw new Error("Tạo candidate deployment thất bại; prior không đổi.");
    }
    if (!ownedShape(observed, options.runId, smokeVersions)) {
      return reportDrift(options.incident);
    }
    smoke = observed;
  }
  if (!ownedShape(smoke, options.runId, smokeVersions)) {
    return reportDrift(options.incident);
  }
  options.onState?.("smoke", smoke);

  try {
    await options.verifyCandidate(options.candidateVersionId);
  } catch {
    const restored = await confirm(smoke, priorVersionId, "restore");
    options.onState?.("restored", restored);
    throw new Error("Xác minh candidate thất bại; đã phục hồi prior version.");
  }

  const promoted = await confirm(smoke, options.candidateVersionId, "promote");
  options.onState?.("promoted", promoted);

  try {
    await options.verifyProduction(options.candidateVersionId);
  } catch {
    const rolledBack = await confirm(promoted, priorVersionId, "rollback");
    options.onState?.("rolled-back", rolledBack);
    throw new Error("Xác minh production thất bại; đã rollback prior version.");
  }

  if (verifyRolledBack === undefined) {
    return { prior, smoke, final: promoted };
  }

  const rolledBack = await confirm(promoted, priorVersionId, "rollback");
  options.onState?.("rehearsal-rolled-back", rolledBack);

  try {
    await verifyRolledBack();
  } catch {
    const candidateRestored = await confirm(rolledBack, options.candidateVersionId, "promote");
    options.onState?.("rehearsal-candidate-restored", candidateRestored);
    await options.verifyProduction(options.candidateVersionId);
    throw new Error(
      "Rollback rehearsal không xác minh được prior; candidate đã được phục hồi.",
    );
  }

  const rehearsalPromoted = await confirm(rolledBack, options.candidateVersionId, "promote");
  options.onState?.("rehearsal-promoted", rehearsalPromoted);

  try {
    await options.verifyProduction(options.candidateVersionId);
  } catch {
    const priorRestored = await confirm(rehearsalPromoted, priorVersionId, "rollback");
    options.onState?.("rehearsal-prior-restored", priorRestored);
    await verifyRolledBack();
    throw new Error(
      "Re-promote rehearsal không xác minh được candidate; prior đã được phục hồi.",
    );
  }

  return {
    prior,
    smoke,
    rollbackRehearsal: { rolledBack },
    final: rehearsalPromoted,
  };
}
