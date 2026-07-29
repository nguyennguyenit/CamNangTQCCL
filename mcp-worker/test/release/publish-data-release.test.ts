import { readFile } from "node:fs/promises";

import { describe, expect, it, vi } from "vitest";

import {
  activateDataReleaseWithDeployment,
  stageDataRelease,
  type ImmutableReleaseStore,
  type PointerState,
  type PointerStore,
} from "../../scripts/publish-data-release.js";
import * as releasePublisher from "../../scripts/publish-data-release.js";
import { createPromotionReceipt } from "../../src/release/promotion-receipt.js";

const releaseId =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const priorReleaseId =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
const receiptInput = {
  releaseId,
  manifestSha256:
    "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as const,
  dataVersion: "data:aaaaaaaaaaaa" as const,
  workflowBuildId:
    "build:sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" as const,
  workerVersionId: "worker-version-1",
  sourceTree: "git-tree:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" as const,
  priorPointer: {
    etag: "etag-prior",
    value: {
      schemaVersion: 1 as const,
      releaseId: priorReleaseId,
      manifestKey:
        "releases/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/manifest.json",
    },
  },
  environment: "staging",
  evidenceDigest:
    "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" as const,
  approvalReference: "approval:release-42",
  issuedAt: "2026-07-28T15:00:00.000Z",
  expiresAt: "2026-07-28T15:15:00.000Z",
};

class MemoryReleaseStore implements ImmutableReleaseStore {
  readonly objects = new Map<string, Uint8Array>();

  async putIfAbsent(key: string, bytes: Uint8Array) {
    if (this.objects.has(key)) return { created: false as const };
    this.objects.set(key, bytes.slice());
    return { created: true as const };
  }

  async read(key: string) {
    const bytes = this.objects.get(key);
    return bytes === undefined ? null : { bytes: bytes.slice() };
  }
}

function pointerStore(): PointerStore & { value: PointerState } {
  return {
    value: {
      etag: receiptInput.priorPointer.etag,
      value: receiptInput.priorPointer.value,
    },
    async readCurrent() {
      return this.value;
    },
    async compareAndSwapCurrent(expectedEtag, value) {
      if (this.value.etag !== expectedEtag) return null;
      this.value = {
        etag: `etag-${value.releaseId.slice(-4)}`,
        value,
      };
      return { etag: this.value.etag };
    },
  };
}

function receiptExpectation(
  receipt: Awaited<ReturnType<typeof createPromotionReceipt>>,
) {
  return {
    receiptId: receipt.receiptId,
    releaseId: receipt.releaseId,
    manifestSha256: receipt.manifestSha256,
    dataVersion: receipt.dataVersion,
    workflowBuildId: receipt.workflowBuildId,
    workerVersionId: receipt.workerVersionId,
    sourceTree: receipt.sourceTree,
    environment: receipt.environment,
    priorPointerEtag: receipt.priorPointer.etag,
    priorPointerValue: receipt.priorPointer.value,
    evidenceDigest: receipt.evidenceDigest,
    approvalReference: receipt.approvalReference,
  };
}

const activationLease = {
  async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    return operation();
  },
};

function deploymentFor(
  deployExclusive: () => Promise<{
    versionId: string;
    percentage: number;
    activeVersions: number;
  }>,
) {
  return {
    readCurrent: async () => ({
      deploymentId: "deployment-prior",
      versions: [{ versionId: "prior-version", percentage: 100 }],
    }),
    deployExclusive,
  };
}

describe("stageDataRelease", () => {
  it("conditional-stage idempotent và từ chối existing bytes khác", async () => {
    const store = new MemoryReleaseStore();
    const writes: string[] = [];
    const originalPut = store.putIfAbsent.bind(store);
    store.putIfAbsent = async (key, bytes) => {
      writes.push(key);
      return originalPut(key, bytes);
    };
    const verifyPreflight = vi.fn(async () => undefined);
    const sourceTree =
      "git-tree:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" as const;
    const verifyRepositoryGate = vi.fn(async () => ({ sourceTree }));
    const fixture = new URL("../fixtures/release-snapshot/", import.meta.url);
    const manifest = new Uint8Array(await readFile(new URL("manifest.json", fixture)));
    const stageReleaseId = JSON.parse(
      new TextDecoder().decode(manifest),
    ).releaseId as `sha256:${string}`;
    const objects = new Map(
      await Promise.all(
        [
          "teams",
          "team-tier",
          "coexist",
          "heroes-dict",
          "tactics",
          "books-dict",
        ].map(async (name) => [
          `releases/${stageReleaseId.slice("sha256:".length)}/${name}.json`,
          new Uint8Array(await readFile(new URL(`${name}.json`, fixture))),
        ] as const),
      ),
    );
    objects.set(
      `releases/${stageReleaseId.slice("sha256:".length)}/manifest.json`,
      manifest,
    );
    const manifestSha256 = `sha256:${[...new Uint8Array(
      await crypto.subtle.digest("SHA-256", manifest),
    )]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")}` as const;
    const buildEvidence = { sourceTree, manifestSha256 };

    const first = await stageDataRelease({
      releaseId: stageReleaseId,
      objects,
      buildEvidence,
      releaseStore: store,
      verifyPreflight,
      verifyRepositoryGate,
    });
    const second = await stageDataRelease({
      releaseId: stageReleaseId,
      objects,
      buildEvidence,
      releaseStore: store,
      verifyPreflight,
      verifyRepositoryGate,
    });

    expect(first.created).toBe(objects.size);
    expect(writes.at(6)).toMatch(/\/manifest\.json$/u);
    expect(second.created).toBe(0);
    expect(second.reused).toBe(objects.size);
    expect(verifyPreflight).toHaveBeenCalledTimes(2);
    expect(verifyRepositoryGate).toHaveBeenCalledTimes(2);

    const key = [...objects.keys()][0]!;
    store.objects.set(key, new TextEncoder().encode("tampered"));
    await expect(
      stageDataRelease({
        releaseId: stageReleaseId,
        objects,
        buildEvidence,
        releaseStore: store,
        verifyPreflight,
        verifyRepositoryGate,
      }),
    ).rejects.toMatchObject({ code: "EXISTING_OBJECT_MISMATCH" });

    await expect(
      stageDataRelease({
        releaseId: stageReleaseId,
        objects,
        buildEvidence,
        releaseStore: new MemoryReleaseStore(),
        verifyPreflight,
        verifyRepositoryGate: async () => ({
          sourceTree:
            "git-tree:ffffffffffffffffffffffffffffffffffffffff",
        }),
      }),
    ).rejects.toMatchObject({ code: "PREFLIGHT_FAILED" });
  });
});

describe("activateDataRelease", () => {
  it("không export primitive activation có thể bỏ qua lease", () => {
    expect(releasePublisher).not.toHaveProperty("activateDataRelease");
  });

  it("không ghi đè deployment khác khi pointer CAS xung đột", async () => {
    const receipt = await createPromotionReceipt(receiptInput);
    const pointer = pointerStore();
    let leaseHeld = false;
    const exclusiveLease = {
      async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
        expect(leaseHeld).toBe(false);
        leaseHeld = true;
        try {
          return await operation();
        } finally {
          leaseHeld = false;
        }
      },
    };
    pointer.compareAndSwapCurrent = async () => {
      expect(leaseHeld).toBe(true);
      return null;
    };
    const priorDeployment = {
      deploymentId: "deployment-prior",
      versions: [
        {
          versionId: "11111111-2222-4333-8444-555555555555",
          percentage: 100,
        },
      ],
    };
    const deployment = {
      readCurrent: vi.fn(async () => {
        expect(leaseHeld).toBe(true);
        return priorDeployment;
      }),
      deployExclusive: vi.fn(async () => {
        expect(leaseHeld).toBe(true);
        return {
          versionId: receipt.workerVersionId,
          percentage: 100,
          activeVersions: 1,
        };
      }),
    };

    await expect(
      activateDataReleaseWithDeployment({
        receipt,
        expected: receiptExpectation(receipt),
        now: new Date("2026-07-28T15:05:00.000Z"),
        pointerStore: pointer,
        verifyPreflight: async () => undefined,
        deployment,
        activationLease: exclusiveLease,
        verifyLive: async () => undefined,
      }),
    ).rejects.toMatchObject({ code: "POINTER_CAS_CONFLICT" });
    expect(leaseHeld).toBe(false);
  });

  it("không đọc deployment khi receipt chưa qua xác minh", async () => {
    const receipt = await createPromotionReceipt(receiptInput);
    const deployment = {
      readCurrent: vi.fn(async () => ({
        deploymentId: "deployment-prior",
        versions: [{ versionId: "prior", percentage: 100 }],
      })),
      deployExclusive: vi.fn(),
    };

    await expect(
      activateDataReleaseWithDeployment({
        receipt: { ...receipt, workerVersionId: "tampered" },
        expected: receiptExpectation(receipt),
        now: new Date("2026-07-28T15:05:00.000Z"),
        pointerStore: pointerStore(),
        verifyPreflight: async () => undefined,
        deployment,
        activationLease,
        verifyLive: async () => undefined,
      }),
    ).rejects.toBeDefined();
    expect(deployment.readCurrent).not.toHaveBeenCalled();
  });

  it("dừng mà không ghi đè khi candidate deploy có kết quả mơ hồ", async () => {
    const receipt = await createPromotionReceipt(receiptInput);
    const priorDeployment = {
      deploymentId: "deployment-prior",
      versions: [{ versionId: "prior-version", percentage: 100 }],
    };
    const deployment = {
      readCurrent: vi.fn(async () => priorDeployment),
      deployExclusive: vi.fn(async () => {
        throw new Error("response lost after commit");
      }),
    };

    await expect(
      activateDataReleaseWithDeployment({
        receipt,
        expected: receiptExpectation(receipt),
        now: new Date("2026-07-28T15:05:00.000Z"),
        pointerStore: pointerStore(),
        verifyPreflight: async () => undefined,
        deployment,
        activationLease,
        verifyLive: async () => undefined,
      }),
    ).rejects.toMatchObject({ code: "DEPLOYMENT_FAILED" });
  });

  it("deploy đúng một version, CAS pointer và force-refresh verify", async () => {
    const receipt = await createPromotionReceipt(receiptInput);
    const pointer = pointerStore();
    const deploySingleVersion = vi.fn(async () => ({
      versionId: receipt.workerVersionId,
      percentage: 100,
      activeVersions: 1,
    }));
    const verifyLive = vi.fn(async () => undefined);

    const result = await activateDataReleaseWithDeployment({
      receipt,
      expected: receiptExpectation(receipt),
      now: new Date("2026-07-28T15:05:00.000Z"),
      pointerStore: pointer,
      verifyPreflight: async () => undefined,
      deployment: deploymentFor(deploySingleVersion),
      activationLease,
      verifyLive,
    });

    expect(result).toEqual({
      activated: true,
      releaseId,
      pointerEtag: "etag-aaaa",
    });
    expect(pointer.value.value.releaseId).toBe(releaseId);
    expect(deploySingleVersion).toHaveBeenCalledOnce();
    expect(verifyLive).toHaveBeenCalledWith({
      releaseId,
      workerVersionId: receipt.workerVersionId,
      forceRefresh: true,
    });
  });

  it("không đổi pointer khi deployment không phải một version 100%", async () => {
    const receipt = await createPromotionReceipt(receiptInput);
    const pointer = pointerStore();

    await expect(
      activateDataReleaseWithDeployment({
        receipt,
        expected: receiptExpectation(receipt),
        now: new Date("2026-07-28T15:05:00.000Z"),
        pointerStore: pointer,
        verifyPreflight: async () => undefined,
        deployment: deploymentFor(async () => ({
          versionId: receipt.workerVersionId,
          percentage: 90,
          activeVersions: 2,
        })),
        activationLease,
        verifyLive: async () => undefined,
      }),
    ).rejects.toMatchObject({ code: "DEPLOYMENT_NOT_EXCLUSIVE" });
    expect(pointer.value.value.releaseId).toBe(priorReleaseId);
  });

  it("CAS-restore pointer khi live verify lỗi", async () => {
    const receipt = await createPromotionReceipt(receiptInput);
    const pointer = pointerStore();

    await expect(
      activateDataReleaseWithDeployment({
        receipt,
        expected: receiptExpectation(receipt),
        now: new Date("2026-07-28T15:05:00.000Z"),
        pointerStore: pointer,
        verifyPreflight: async () => undefined,
        deployment: deploymentFor(async () => ({
          versionId: receipt.workerVersionId,
          percentage: 100,
          activeVersions: 1,
        })),
        activationLease,
        verifyLive: async () => {
          throw new Error("candidate failed");
        },
      }),
    ).rejects.toMatchObject({ code: "LIVE_VERIFICATION_FAILED" });
    expect(pointer.value.value).toEqual(receipt.priorPointer.value);
  });

  it("dừng và báo incident khi rollback CAS xung đột", async () => {
    const receipt = await createPromotionReceipt(receiptInput);
    const pointer = pointerStore();
    let calls = 0;
    pointer.compareAndSwapCurrent = async (expectedEtag, value) => {
      calls += 1;
      if (calls === 1) {
        pointer.value = { etag: "etag-candidate", value };
        return { etag: "etag-candidate" };
      }
      return null;
    };

    await expect(
      activateDataReleaseWithDeployment({
        receipt,
        expected: receiptExpectation(receipt),
        now: new Date("2026-07-28T15:05:00.000Z"),
        pointerStore: pointer,
        verifyPreflight: async () => undefined,
        deployment: deploymentFor(async () => ({
          versionId: receipt.workerVersionId,
          percentage: 100,
          activeVersions: 1,
        })),
        activationLease,
        verifyLive: async () => {
          throw new Error("candidate failed");
        },
      }),
    ).rejects.toMatchObject({ code: "ROLLBACK_CAS_CONFLICT" });
  });

  it("dừng khi pointer CAS xung đột mà không ghi đè deployment", async () => {
    const receipt = await createPromotionReceipt(receiptInput);
    const pointer = pointerStore();
    pointer.compareAndSwapCurrent = async () => null;

    await expect(
      activateDataReleaseWithDeployment({
        receipt,
        expected: receiptExpectation(receipt),
        now: new Date("2026-07-28T15:05:00.000Z"),
        pointerStore: pointer,
        verifyPreflight: async () => undefined,
        deployment: deploymentFor(async () => ({
          versionId: receipt.workerVersionId,
          percentage: 100,
          activeVersions: 1,
        })),
        activationLease,
        verifyLive: async () => undefined,
      }),
    ).rejects.toMatchObject({ code: "POINTER_CAS_CONFLICT" });
  });
});
