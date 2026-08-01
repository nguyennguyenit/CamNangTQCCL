import type { WorkerDeploymentSnapshot } from "./cloudflare-deployment-client.js";

type ExclusivePurpose = "bootstrap" | "promote" | "restore" | "rollback";

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

async function readAfterMutation(
  deployment: WorkerDeploymentGateway,
  incident: (() => Promise<void>) | undefined,
): Promise<WorkerDeploymentSnapshot> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await deployment.readCurrent();
    } catch {
      // Retry immediately: the API can briefly lag or lose a response after a
      // committed deployment. Three bounded reads avoid hanging automation.
    }
  }
  return reportDrift(incident);
}

async function deployExclusiveAndConfirm(options: {
  deployment: WorkerDeploymentGateway;
  expectedCurrent: WorkerDeploymentSnapshot;
  targetVersionId: string;
  purpose: ExclusivePurpose;
  runId: string;
  incident?: () => Promise<void>;
}): Promise<WorkerDeploymentSnapshot> {
  const current = await readAfterMutation(
    options.deployment,
    options.incident,
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
  } catch {
    // A deployment POST can commit even when its response is lost. Reconcile
    // using the run annotation before deciding whether it failed.
  }
  const observed = await readAfterMutation(
    options.deployment,
    options.incident,
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

export async function bootstrapWorkerVersion(options: {
  runId: string;
  candidateVersionId: string;
  deployment: WorkerDeploymentGateway;
  verifyProduction(versionId: string): Promise<void>;
  incident?: () => Promise<void>;
  onState?: (name: string, snapshot: WorkerDeploymentSnapshot) => void;
}): Promise<WorkerBootstrapEvidence> {
  if (
    !/^[A-Za-z0-9._:-]{1,128}$/u.test(options.runId) ||
    (await options.deployment.readCurrentOptional()) !== null
  ) {
    throw new DeploymentOwnershipError();
  }

  let response: WorkerDeploymentSnapshot | undefined;
  try {
    response = await options.deployment.deployExclusive(
      options.candidateVersionId,
      "bootstrap",
    );
  } catch {
    // The first deployment can commit even if its response is lost. Reconcile
    // only against the run annotation before treating the mutation as failed.
  }
  const observed = await readAfterMutation(
    options.deployment,
    options.incident,
  );
  const expectedVersions = [
    { versionId: options.candidateVersionId, percentage: 100 },
  ];
  if (
    !ownedShape(observed, options.runId, expectedVersions) ||
    (response !== undefined && !sameDeployment(observed, response))
  ) {
    return reportDrift(options.incident);
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
}): Promise<WorkerReleaseEvidence> {
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
  } catch {
    const observed = await readAfterMutation(
      options.deployment,
      options.incident,
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
    const restored = await deployExclusiveAndConfirm({
      deployment: options.deployment,
      expectedCurrent: smoke,
      targetVersionId: priorVersionId,
      purpose: "restore",
      runId: options.runId,
      ...(options.incident === undefined ? {} : { incident: options.incident }),
    });
    options.onState?.("restored", restored);
    throw new Error("Xác minh candidate thất bại; đã phục hồi prior version.");
  }

  const promoted = await deployExclusiveAndConfirm({
    deployment: options.deployment,
    expectedCurrent: smoke,
    targetVersionId: options.candidateVersionId,
    purpose: "promote",
    runId: options.runId,
    ...(options.incident === undefined ? {} : { incident: options.incident }),
  });
  options.onState?.("promoted", promoted);

  try {
    await options.verifyProduction(options.candidateVersionId);
  } catch {
    const rolledBack = await deployExclusiveAndConfirm({
      deployment: options.deployment,
      expectedCurrent: promoted,
      targetVersionId: priorVersionId,
      purpose: "rollback",
      runId: options.runId,
      ...(options.incident === undefined ? {} : { incident: options.incident }),
    });
    options.onState?.("rolled-back", rolledBack);
    throw new Error("Xác minh production thất bại; đã rollback prior version.");
  }

  if (verifyRolledBack === undefined) {
    return { prior, smoke, final: promoted };
  }

  const rolledBack = await deployExclusiveAndConfirm({
    deployment: options.deployment,
    expectedCurrent: promoted,
    targetVersionId: priorVersionId,
    purpose: "rollback",
    runId: options.runId,
    ...(options.incident === undefined ? {} : { incident: options.incident }),
  });
  options.onState?.("rehearsal-rolled-back", rolledBack);

  try {
    await verifyRolledBack();
  } catch {
    const candidateRestored = await deployExclusiveAndConfirm({
      deployment: options.deployment,
      expectedCurrent: rolledBack,
      targetVersionId: options.candidateVersionId,
      purpose: "promote",
      runId: options.runId,
      ...(options.incident === undefined ? {} : { incident: options.incident }),
    });
    options.onState?.("rehearsal-candidate-restored", candidateRestored);
    await options.verifyProduction(options.candidateVersionId);
    throw new Error(
      "Rollback rehearsal không xác minh được prior; candidate đã được phục hồi.",
    );
  }

  const rehearsalPromoted = await deployExclusiveAndConfirm({
    deployment: options.deployment,
    expectedCurrent: rolledBack,
    targetVersionId: options.candidateVersionId,
    purpose: "promote",
    runId: options.runId,
    ...(options.incident === undefined ? {} : { incident: options.incident }),
  });
  options.onState?.("rehearsal-promoted", rehearsalPromoted);

  try {
    await options.verifyProduction(options.candidateVersionId);
  } catch {
    const priorRestored = await deployExclusiveAndConfirm({
      deployment: options.deployment,
      expectedCurrent: rehearsalPromoted,
      targetVersionId: priorVersionId,
      purpose: "rollback",
      runId: options.runId,
      ...(options.incident === undefined ? {} : { incident: options.incident }),
    });
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
