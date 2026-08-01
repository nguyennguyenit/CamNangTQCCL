import { describe, expect, it, vi } from "vitest";

import type { WorkerDeploymentSnapshot } from "../../scripts/cloudflare-deployment-client.js";
import {
  bootstrapWorkerVersion,
  DeploymentOwnershipError,
  releaseWorkerVersion,
} from "../../scripts/worker-deployment-controller.js";

const priorVersionId = "11111111-2222-4333-8444-555555555555";
const candidateVersionId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const runId = "github-123-1";

const prior: WorkerDeploymentSnapshot = {
  deploymentId: "deployment-prior",
  ownerTag: null,
  versions: [{ versionId: priorVersionId, percentage: 100 }],
};
const smoke: WorkerDeploymentSnapshot = {
  deploymentId: "deployment-smoke",
  ownerTag: runId,
  versions: [
    { versionId: priorVersionId, percentage: 100 },
    { versionId: candidateVersionId, percentage: 0 },
  ],
};
const promoted: WorkerDeploymentSnapshot = {
  deploymentId: "deployment-promoted",
  ownerTag: runId,
  versions: [{ versionId: candidateVersionId, percentage: 100 }],
};
const restored: WorkerDeploymentSnapshot = {
  deploymentId: "deployment-restored",
  ownerTag: runId,
  versions: [{ versionId: priorVersionId, percentage: 100 }],
};

function gateway(reads: WorkerDeploymentSnapshot[]) {
  return {
    readCurrentOptional: vi.fn(async () => {
      const value = reads.shift();
      return value ?? null;
    }),
    readCurrent: vi.fn(async () => {
      const value = reads.shift();
      if (value === undefined) throw new Error("unexpected read");
      return value;
    }),
    deployTest: vi.fn(async () => smoke),
    deployExclusive: vi.fn(async (versionId: string) =>
      versionId === candidateVersionId ? promoted : restored,
    ),
  };
}

describe("Worker deployment controller", () => {
  it("bootstrap chỉ tạo deployment đầu tiên khi chưa có current deployment", async () => {
    const deployment = gateway([promoted]);
    deployment.readCurrentOptional.mockResolvedValueOnce(null);
    const verifyProduction = vi.fn(async () => undefined);

    await expect(
      bootstrapWorkerVersion({
        runId,
        candidateVersionId,
        deployment,
        verifyProduction,
      }),
    ).resolves.toEqual({ final: promoted });
    expect(deployment.deployExclusive).toHaveBeenCalledWith(
      candidateVersionId,
      "bootstrap",
    );
    expect(verifyProduction).toHaveBeenCalledWith(candidateVersionId);
  });

  it("bootstrap từ chối ghi đè deployment đã tồn tại", async () => {
    const deployment = gateway([]);
    deployment.readCurrentOptional.mockResolvedValueOnce(prior);

    await expect(
      bootstrapWorkerVersion({
        runId,
        candidateVersionId,
        deployment,
        verifyProduction: async () => undefined,
      }),
    ).rejects.toBeInstanceOf(DeploymentOwnershipError);
    expect(deployment.deployExclusive).not.toHaveBeenCalled();
  });

  it("bootstrap verify fail mở incident vì chưa có version để rollback", async () => {
    const deployment = gateway([promoted]);
    deployment.readCurrentOptional.mockResolvedValueOnce(null);
    const incident = vi.fn(async () => undefined);

    await expect(
      bootstrapWorkerVersion({
        runId,
        candidateVersionId,
        deployment,
        verifyProduction: async () => {
          throw new Error("production failed");
        },
        incident,
      }),
    ).rejects.toThrow("Bootstrap production thất bại");
    expect(incident).toHaveBeenCalledOnce();
  });

  it("verify candidate 0% trước khi promote một version 100%", async () => {
    const deployment = gateway([prior, smoke, promoted]);
    const verifyCandidate = vi.fn(async () => undefined);
    const verifyProduction = vi.fn(async () => undefined);

    await expect(
      releaseWorkerVersion({
        runId,
        candidateVersionId,
        deployment,
        verifyCandidate,
        verifyProduction,
      }),
    ).resolves.toEqual({ prior, smoke, final: promoted });
    expect(deployment.deployTest).toHaveBeenCalledWith(
      priorVersionId,
      candidateVersionId,
    );
    expect(verifyCandidate).toHaveBeenCalledWith(candidateVersionId);
    expect(deployment.deployExclusive).toHaveBeenCalledWith(
      candidateVersionId,
      "promote",
    );
  });

  it("smoke fail thì phục hồi prior khi deployment vẫn do run sở hữu", async () => {
    const deployment = gateway([prior, smoke, restored]);
    const incident = vi.fn(async () => undefined);
    const onState = vi.fn();

    await expect(
      releaseWorkerVersion({
        runId,
        candidateVersionId,
        deployment,
        verifyCandidate: async () => {
          throw new Error("smoke failed");
        },
        verifyProduction: async () => undefined,
        incident,
        onState,
      }),
    ).rejects.toThrow("Xác minh candidate thất bại");
    expect(deployment.deployExclusive).toHaveBeenCalledWith(
      priorVersionId,
      "restore",
    );
    expect(incident).not.toHaveBeenCalled();
    expect(onState).toHaveBeenCalledWith("restored", restored);
  });

  it("smoke fail có drift thì mở incident và không overwrite", async () => {
    const drift = { ...promoted, deploymentId: "deployment-other" };
    const deployment = gateway([prior, drift]);
    const incident = vi.fn(async () => undefined);

    await expect(
      releaseWorkerVersion({
        runId,
        candidateVersionId,
        deployment,
        verifyCandidate: async () => {
          throw new Error("smoke failed");
        },
        verifyProduction: async () => undefined,
        incident,
      }),
    ).rejects.toBeInstanceOf(DeploymentOwnershipError);
    expect(deployment.deployExclusive).not.toHaveBeenCalled();
    expect(incident).toHaveBeenCalledOnce();
  });

  it("production fail thì rollback prior chỉ khi candidate vẫn thuộc run", async () => {
    const deployment = gateway([prior, smoke, promoted, promoted, restored]);

    await expect(
      releaseWorkerVersion({
        runId,
        candidateVersionId,
        deployment,
        verifyCandidate: async () => undefined,
        verifyProduction: async () => {
          throw new Error("production failed");
        },
      }),
    ).rejects.toThrow("Xác minh production thất bại");
    expect(deployment.deployExclusive).toHaveBeenLastCalledWith(
      priorVersionId,
      "rollback",
    );
  });

  it("từ chối split prior và stale rollback không ghi đè release khác", async () => {
    const splitPrior: WorkerDeploymentSnapshot = {
      deploymentId: "split",
      ownerTag: null,
      versions: [
        { versionId: priorVersionId, percentage: 50 },
        { versionId: candidateVersionId, percentage: 50 },
      ],
    };
    const splitGateway = gateway([splitPrior]);
    await expect(
      releaseWorkerVersion({
        runId,
        candidateVersionId,
        deployment: splitGateway,
        verifyCandidate: async () => undefined,
        verifyProduction: async () => undefined,
      }),
    ).rejects.toBeInstanceOf(DeploymentOwnershipError);

    const drift = { ...prior, deploymentId: "newer-release" };
    const deployment = gateway([prior, smoke, promoted, drift]);
    await expect(
      releaseWorkerVersion({
        runId,
        candidateVersionId,
        deployment,
        verifyCandidate: async () => undefined,
        verifyProduction: async () => {
          throw new Error("production failed");
        },
      }),
    ).rejects.toBeInstanceOf(DeploymentOwnershipError);
    expect(deployment.deployExclusive).toHaveBeenCalledTimes(1);
  });

  it("reconcile smoke đã commit khi response bị mất", async () => {
    const deployment = gateway([prior, smoke, smoke, restored]);
    deployment.deployTest.mockRejectedValueOnce(new Error("response lost"));

    await expect(
      releaseWorkerVersion({
        runId,
        candidateVersionId,
        deployment,
        verifyCandidate: async () => {
          throw new Error("smoke failed");
        },
        verifyProduction: async () => undefined,
      }),
    ).rejects.toThrow("đã phục hồi prior");
    expect(deployment.deployExclusive).toHaveBeenCalledWith(
      priorVersionId,
      "restore",
    );
  });

  it("reconcile promotion đã commit khi response bị mất rồi vẫn verify production", async () => {
    const deployment = gateway([prior, smoke, promoted]);
    deployment.deployExclusive.mockRejectedValueOnce(new Error("response lost"));
    const verifyProduction = vi.fn(async () => undefined);

    await expect(
      releaseWorkerVersion({
        runId,
        candidateVersionId,
        deployment,
        verifyCandidate: async () => undefined,
        verifyProduction,
      }),
    ).resolves.toEqual({ prior, smoke, final: promoted });
    expect(verifyProduction).toHaveBeenCalledWith(candidateVersionId);
  });

  it("read-back không xác định sau mutation thì retry hữu hạn và mở incident", async () => {
    const deployment = gateway([prior, smoke]);
    const incident = vi.fn(async () => undefined);

    await expect(
      releaseWorkerVersion({
        runId,
        candidateVersionId,
        deployment,
        verifyCandidate: async () => undefined,
        verifyProduction: async () => undefined,
        incident,
      }),
    ).rejects.toBeInstanceOf(DeploymentOwnershipError);
    expect(deployment.readCurrent).toHaveBeenCalledTimes(5);
    expect(incident).toHaveBeenCalledOnce();
  });
});
