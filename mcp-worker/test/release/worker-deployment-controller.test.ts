import { describe, expect, it, vi } from "vitest";

import type { WorkerDeploymentSnapshot } from "../../scripts/cloudflare-deployment-client.js";
import {
  DeploymentOwnershipError,
  MUTATION_READ_BACK_DELAYS_MS,
  preflightWorkerRelease,
  releaseWorkerVersion,
  verifyBootstrapWorkerVersion,
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
  it("preflight bootstrap dừng trước upload nếu deployment đã tồn tại", async () => {
    const deployment = gateway([]);
    deployment.readCurrentOptional.mockResolvedValueOnce(prior);

    await expect(
      preflightWorkerRelease({ bootstrap: true, deployment }),
    ).rejects.toBeInstanceOf(DeploymentOwnershipError);
  });

  it("preflight normal yêu cầu prior duy nhất ở 100%", async () => {
    const deployment = gateway([]);
    deployment.readCurrentOptional.mockResolvedValueOnce(prior);

    await expect(
      preflightWorkerRelease({ bootstrap: false, deployment }),
    ).resolves.toEqual({ mode: "normal", priorVersionId });
  });

  it("bootstrap read-back exact deployment do Wrangler vừa tạo", async () => {
    const deployment = gateway([promoted]);
    const verifyProduction = vi.fn(async () => undefined);

    await expect(
      verifyBootstrapWorkerVersion({
        candidateVersionId,
        deployment,
        verifyProduction,
      }),
    ).resolves.toEqual({ final: promoted });
    expect(deployment.deployExclusive).not.toHaveBeenCalled();
    expect(verifyProduction).toHaveBeenCalledWith(candidateVersionId);
  });

  it("bootstrap từ chối deployment không trỏ exact candidate", async () => {
    const deployment = gateway([prior]);
    const incident = vi.fn(async () => undefined);

    await expect(
      verifyBootstrapWorkerVersion({
        candidateVersionId,
        deployment,
        verifyProduction: async () => undefined,
        incident,
      }),
    ).rejects.toBeInstanceOf(DeploymentOwnershipError);
    expect(deployment.deployExclusive).not.toHaveBeenCalled();
    expect(incident).toHaveBeenCalledOnce();
  });

  it("bootstrap verify fail mở incident vì chưa có prior để rollback", async () => {
    const deployment = gateway([promoted]);
    const incident = vi.fn(async () => undefined);

    await expect(
      verifyBootstrapWorkerVersion({
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

  it("rehearsal rollback xác minh prior rồi re-promote candidate", async () => {
    const rehearsalRollback: WorkerDeploymentSnapshot = {
      ...restored,
      deploymentId: "deployment-rehearsal-rollback",
    };
    const rehearsalPromoted: WorkerDeploymentSnapshot = {
      ...promoted,
      deploymentId: "deployment-rehearsal-promoted",
    };
    const deployment = gateway([
      prior,
      smoke,
      promoted,
      promoted,
      rehearsalRollback,
      rehearsalRollback,
      rehearsalPromoted,
    ]);
    deployment.deployExclusive
      .mockResolvedValueOnce(promoted)
      .mockResolvedValueOnce(rehearsalRollback)
      .mockResolvedValueOnce(rehearsalPromoted);
    const verifyProduction = vi.fn(async () => undefined);
    const verifyRolledBack = vi.fn(async () => undefined);
    const prepareRollbackVerification = vi.fn(async () => verifyRolledBack);
    const onState = vi.fn();

    await expect(
      releaseWorkerVersion({
        runId,
        candidateVersionId,
        deployment,
        verifyCandidate: async () => undefined,
        verifyProduction,
        prepareRollbackVerification,
        onState,
      }),
    ).resolves.toEqual({
      prior,
      smoke,
      rollbackRehearsal: { rolledBack: rehearsalRollback },
      final: rehearsalPromoted,
    });
    expect(prepareRollbackVerification).toHaveBeenCalledWith(priorVersionId);
    expect(verifyRolledBack).toHaveBeenCalledOnce();
    expect(verifyProduction).toHaveBeenCalledTimes(2);
    expect(deployment.deployExclusive.mock.calls).toEqual([
      [candidateVersionId, "promote"],
      [priorVersionId, "rollback"],
      [candidateVersionId, "promote"],
    ]);
    expect(onState).toHaveBeenCalledWith(
      "rehearsal-rolled-back",
      rehearsalRollback,
    );
    expect(onState).toHaveBeenCalledWith(
      "rehearsal-promoted",
      rehearsalPromoted,
    );
  });

  it("rehearsal prior fail phục hồi candidate rồi dừng release", async () => {
    const rehearsalRollback = {
      ...restored,
      deploymentId: "deployment-rehearsal-rollback",
    };
    const rehearsalPromoted = {
      ...promoted,
      deploymentId: "deployment-rehearsal-promoted",
    };
    const deployment = gateway([
      prior,
      smoke,
      promoted,
      promoted,
      rehearsalRollback,
      rehearsalRollback,
      rehearsalPromoted,
    ]);
    deployment.deployExclusive
      .mockResolvedValueOnce(promoted)
      .mockResolvedValueOnce(rehearsalRollback)
      .mockResolvedValueOnce(rehearsalPromoted);
    const verifyProduction = vi.fn(async () => undefined);

    await expect(
      releaseWorkerVersion({
        runId,
        candidateVersionId,
        deployment,
        verifyCandidate: async () => undefined,
        verifyProduction,
        prepareRollbackVerification: async () => async () => {
          throw new Error("prior mismatch");
        },
      }),
    ).rejects.toThrow("candidate đã được phục hồi");
    expect(verifyProduction).toHaveBeenCalledTimes(2);
    expect(deployment.deployExclusive).toHaveBeenLastCalledWith(
      candidateVersionId,
      "promote",
    );
  });

  it("re-promote verify fail rollback lại prior đã xác minh", async () => {
    const rehearsalRollback = {
      ...restored,
      deploymentId: "deployment-rehearsal-rollback",
    };
    const rehearsalPromoted = {
      ...promoted,
      deploymentId: "deployment-rehearsal-promoted",
    };
    const finalRollback = {
      ...restored,
      deploymentId: "deployment-final-rollback",
    };
    const deployment = gateway([
      prior,
      smoke,
      promoted,
      promoted,
      rehearsalRollback,
      rehearsalRollback,
      rehearsalPromoted,
      rehearsalPromoted,
      finalRollback,
    ]);
    deployment.deployExclusive
      .mockResolvedValueOnce(promoted)
      .mockResolvedValueOnce(rehearsalRollback)
      .mockResolvedValueOnce(rehearsalPromoted)
      .mockResolvedValueOnce(finalRollback);
    const verifyProduction = vi
      .fn(async () => undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("candidate mismatch"));
    const verifyRolledBack = vi.fn(async () => undefined);

    await expect(
      releaseWorkerVersion({
        runId,
        candidateVersionId,
        deployment,
        verifyCandidate: async () => undefined,
        verifyProduction,
        prepareRollbackVerification: async () => verifyRolledBack,
      }),
    ).rejects.toThrow("prior đã được phục hồi");
    expect(verifyRolledBack).toHaveBeenCalledTimes(2);
    expect(deployment.deployExclusive).toHaveBeenLastCalledWith(
      priorVersionId,
      "rollback",
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
    const sleep = vi.fn(async () => undefined);

    await expect(
      releaseWorkerVersion({
        runId,
        candidateVersionId,
        deployment,
        verifyCandidate: async () => undefined,
        verifyProduction: async () => undefined,
        incident,
        sleep,
      }),
    ).rejects.toBeInstanceOf(DeploymentOwnershipError);
    // prior + read trước promote + mọi lần đọc lại sau promote đều lỗi.
    expect(deployment.readCurrent).toHaveBeenCalledTimes(2 + MUTATION_READ_BACK_DELAYS_MS.length);
    expect(incident).toHaveBeenCalledOnce();
  });

  it("POST smoke lỗi mà đọc lại còn thấy prior: chờ API rồi nhận smoke đã commit, không bỏ dở deployment", async () => {
    // Run 38762022539: smoke được tạo nhưng response POST lỗi và lần đọc ngay sau vẫn là prior.
    const deployment = gateway([prior, prior, prior, smoke, smoke, promoted]);
    deployment.deployTest.mockRejectedValueOnce(new Error("response lost"));
    const sleep = vi.fn(async () => undefined);
    const mutationErrors: string[] = [];

    await expect(
      releaseWorkerVersion({
        runId,
        candidateVersionId,
        deployment,
        verifyCandidate: async () => undefined,
        verifyProduction: async () => undefined,
        sleep,
        onMutationError: (purpose) => mutationErrors.push(purpose),
      }),
    ).resolves.toEqual({ prior, smoke, final: promoted });
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(mutationErrors).toEqual(["smoke"]);
  });

  it("POST smoke lỗi và prior vẫn y nguyên hết cửa sổ chờ thì kết luận chưa đổi", async () => {
    const deployment = gateway([prior, ...MUTATION_READ_BACK_DELAYS_MS.map(() => prior)]);
    deployment.deployTest.mockRejectedValueOnce(new Error("request failed"));

    await expect(
      releaseWorkerVersion({
        runId,
        candidateVersionId,
        deployment,
        verifyCandidate: async () => undefined,
        verifyProduction: async () => undefined,
        sleep: async () => undefined,
      }),
    ).rejects.toThrow("prior không đổi");
    expect(deployment.readCurrent).toHaveBeenCalledTimes(1 + MUTATION_READ_BACK_DELAYS_MS.length);
  });

  it("promote trả OK nhưng đọc lại còn thấy smoke: chờ tới khi thấy promoted, không báo drift", async () => {
    const deployment = gateway([prior, smoke, smoke, smoke, promoted]);
    const incident = vi.fn(async () => undefined);

    await expect(
      releaseWorkerVersion({
        runId,
        candidateVersionId,
        deployment,
        verifyCandidate: async () => undefined,
        verifyProduction: async () => undefined,
        incident,
        sleep: async () => undefined,
      }),
    ).resolves.toEqual({ prior, smoke, final: promoted });
    expect(incident).not.toHaveBeenCalled();
  });
});
