import { describe, expect, it, vi } from "vitest";

import {
  activateApprovedRelease,
  assertExclusiveWorkerDeployment,
  assertActivateCredentialBoundary,
  parseActivateArguments,
  parsePromotionExpectationDocument,
  validateApprovedEndpoint,
} from "../../scripts/activate-data-release.js";
import type {
  PointerState,
  PointerStore,
} from "../../scripts/publish-data-release.js";
import { createPromotionReceipt } from "../../src/release/promotion-receipt.js";

const releaseId =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const priorReleaseId =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;

function pointerStore(): PointerStore & { value: PointerState } {
  return {
    value: {
      etag: "etag-prior",
      value: {
        schemaVersion: 1,
        releaseId: priorReleaseId,
        manifestKey:
          "releases/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/manifest.json",
      },
    },
    async readCurrent() {
      return this.value;
    },
    async compareAndSwapCurrent(expectedEtag, value) {
      if (this.value.etag !== expectedEtag) return null;
      this.value = { etag: "etag-next", value };
      return { etag: this.value.etag };
    },
  };
}

describe("activate-data-release driver", () => {
  it("nối approved expectation qua lock, deploy, pointer CAS và live verify", async () => {
    const receipt = await createPromotionReceipt({
      releaseId,
      manifestSha256:
        "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      dataVersion: "data:aaaaaaaaaaaa",
      workflowBuildId:
        "build:sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      workerVersionId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      sourceTree: "git-tree:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      priorPointer: {
        etag: "etag-prior",
        value: {
          schemaVersion: 1,
          releaseId: priorReleaseId,
          manifestKey:
            "releases/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/manifest.json",
        },
      },
      environment: "staging",
      evidenceDigest:
        "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      approvalReference: "approval:release-42",
      issuedAt: "2026-07-29T01:00:00.000Z",
      expiresAt: "2026-07-29T01:15:00.000Z",
    });
    const expectation = {
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
    const pointer = pointerStore();
    const verifyLive = vi.fn(async () => undefined);
    let locked = false;

    const result = await activateApprovedRelease({
      receipt,
      expectation,
      expectedReceiptId: receipt.receiptId,
      environment: "staging",
      now: new Date("2026-07-29T01:05:00.000Z"),
      pointerStore: pointer,
      activationLease: {
        async runExclusive(operation) {
          locked = true;
          try {
            return await operation();
          } finally {
            locked = false;
          }
        },
      },
      deployment: {
        async readCurrent() {
          expect(locked).toBe(true);
          return {
            deploymentId: "deployment-prior",
            versions: [
              {
                versionId: "11111111-2222-4333-8444-555555555555",
                percentage: 100,
              },
            ],
          };
        },
        async deployExclusive(versionId) {
          expect(locked).toBe(true);
          return { versionId, percentage: 100, activeVersions: 1 };
        },
      },
      verifyPreflight: async () => undefined,
      verifyLive,
    });

    expect(result).toMatchObject({ activated: true, releaseId });
    expect(pointer.value.value.releaseId).toBe(releaseId);
    expect(verifyLive).toHaveBeenCalledOnce();
    expect(locked).toBe(false);
  });

  it("CLI bind environment và expectation ID, không nhận secret trên argv", () => {
    expect(
      parseActivateArguments([
        "--receipt",
        "/tmp/receipt.json",
        "--expectation",
        "/tmp/expectation.json",
        "--fixture",
        "/tmp/fixture.json",
        "--endpoint",
        "https://mcp.example/mcp",
        "--environment",
        "production",
      ]),
    ).toMatchObject({
      environment: "production",
      endpoint: new URL("https://mcp.example/mcp"),
    });
    expect(() =>
      parseActivateArguments([
        "--receipt",
        "/tmp/receipt.json",
        "--token",
        "secret",
      ]),
    ).toThrow();
    for (const name of [
      "TQCCL_R2_RELEASE_ACCESS_KEY_ID",
      "TQCCL_R2_RELEASE_SECRET_ACCESS_KEY",
      "CLOUDFLARE_API_TOKEN",
    ]) {
      expect(() =>
        assertActivateCredentialBoundary({ [name]: "private" }),
      ).toThrow();
    }
    expect(() =>
      parsePromotionExpectationDocument({
        receiptId:
          "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      }),
    ).toThrow();
  });

  it("chỉ cho bearer đi tới endpoint đã được quản trị phê duyệt", () => {
    const approved = "https://mcp.example/mcp";

    expect(
      validateApprovedEndpoint(new URL(approved), approved),
    ).toEqual(new URL(approved));
    for (const endpoint of [
      "https://attacker.example/mcp",
      "https://user@mcp.example/mcp",
      "https://mcp.example/mcp?redirect=attacker",
      "https://mcp.example/mcp#fragment",
    ]) {
      expect(() =>
        validateApprovedEndpoint(new URL(endpoint), approved),
      ).toThrow();
    }
  });

  it("chỉ chấp nhận read-back đúng một Worker version ở 100%", () => {
    const candidate = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    expect(() =>
      assertExclusiveWorkerDeployment(
        {
          deploymentId: "deployment-candidate",
          versions: [{ versionId: candidate, percentage: 100 }],
        },
        candidate,
      ),
    ).not.toThrow();
    expect(() =>
      assertExclusiveWorkerDeployment(
        {
          deploymentId: "deployment-split",
          versions: [
            { versionId: candidate, percentage: 90 },
            {
              versionId: "11111111-2222-4333-8444-555555555555",
              percentage: 10,
            },
          ],
        },
        candidate,
      ),
    ).toThrow();
  });
});
