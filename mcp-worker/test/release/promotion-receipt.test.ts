import { describe, expect, it } from "vitest";

import {
  createPromotionReceipt,
  type PromotionReceiptInput,
  validatePromotionReceipt,
} from "../../src/release/promotion-receipt.js";

const input = {
  releaseId:
    "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  manifestSha256:
    "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  dataVersion: "data:aaaaaaaaaaaa",
  workflowBuildId:
    "build:sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  workerVersionId: "11111111-2222-4333-8444-555555555555",
  sourceTree: "git-tree:dddddddddddddddddddddddddddddddddddddddd",
  priorPointer: {
    etag: "prior-etag",
    value: {
      schemaVersion: 1 as const,
      releaseId:
        "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      manifestKey:
        "releases/eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee/manifest.json",
    },
  },
  environment: "staging",
  evidenceDigest:
    "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  approvalReference: "approval:release-42",
  issuedAt: "2026-07-28T15:00:00.000Z",
  expiresAt: "2026-07-28T15:15:00.000Z",
} satisfies PromotionReceiptInput;

describe("PromotionReceipt", () => {
  it("tạo receipt content-addressed và validate đúng immutable identities", async () => {
    const receipt = await createPromotionReceipt(input);

    expect(receipt.receiptId).toMatch(/^sha256:[a-f0-9]{64}$/u);
    await expect(
      validatePromotionReceipt(receipt, {
        now: new Date("2026-07-28T15:05:00.000Z"),
        expected: {
          receiptId: receipt.receiptId,
          releaseId: input.releaseId,
          manifestSha256: input.manifestSha256,
          dataVersion: input.dataVersion,
          workflowBuildId: input.workflowBuildId,
          workerVersionId: input.workerVersionId,
          sourceTree: input.sourceTree,
          environment: input.environment,
          priorPointerEtag: input.priorPointer.etag,
          priorPointerValue: input.priorPointer.value,
          evidenceDigest: input.evidenceDigest,
          approvalReference: input.approvalReference,
        },
      }),
    ).resolves.toEqual(receipt);
  });

  it("từ chối receipt bị sửa, hết hạn hoặc không khớp activation context", async () => {
    const receipt = await createPromotionReceipt(input);
    const recomputedForAnotherManifest = await createPromotionReceipt({
      ...input,
      manifestSha256:
        "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });

    await expect(
      validatePromotionReceipt(
        { ...receipt, workerVersionId: "tampered" },
        {
          now: new Date("2026-07-28T15:05:00.000Z"),
          expected: {
            receiptId: receipt.receiptId,
            releaseId: input.releaseId,
            manifestSha256: input.manifestSha256,
            dataVersion: input.dataVersion,
            workflowBuildId: input.workflowBuildId,
            workerVersionId: input.workerVersionId,
            sourceTree: input.sourceTree,
            environment: input.environment,
            priorPointerEtag: input.priorPointer.etag,
            priorPointerValue: input.priorPointer.value,
            evidenceDigest: input.evidenceDigest,
            approvalReference: input.approvalReference,
          },
        },
      ),
    ).rejects.toMatchObject({ code: "RECEIPT_TAMPERED" });
    await expect(
      validatePromotionReceipt(receipt, {
        now: new Date("2026-07-28T15:16:00.000Z"),
        expected: {
          receiptId: receipt.receiptId,
          releaseId: input.releaseId,
          manifestSha256: input.manifestSha256,
          dataVersion: input.dataVersion,
          workflowBuildId: input.workflowBuildId,
          workerVersionId: input.workerVersionId,
          sourceTree: input.sourceTree,
          environment: input.environment,
          priorPointerEtag: input.priorPointer.etag,
          priorPointerValue: input.priorPointer.value,
          evidenceDigest: input.evidenceDigest,
          approvalReference: input.approvalReference,
        },
      }),
    ).rejects.toMatchObject({ code: "RECEIPT_EXPIRED" });
    await expect(
      validatePromotionReceipt(receipt, {
        now: new Date("2026-07-28T15:05:00.000Z"),
        expected: {
          receiptId: receipt.receiptId,
          releaseId: input.releaseId,
          manifestSha256: input.manifestSha256,
          dataVersion: input.dataVersion,
          workflowBuildId: input.workflowBuildId,
          workerVersionId: "different-version",
          sourceTree: input.sourceTree,
          environment: input.environment,
          priorPointerEtag: input.priorPointer.etag,
          priorPointerValue: input.priorPointer.value,
          evidenceDigest: input.evidenceDigest,
          approvalReference: input.approvalReference,
        },
      }),
    ).rejects.toMatchObject({ code: "RECEIPT_MISMATCH" });
    await expect(
      validatePromotionReceipt(recomputedForAnotherManifest, {
        now: new Date("2026-07-28T15:05:00.000Z"),
        expected: {
          receiptId: recomputedForAnotherManifest.receiptId,
          releaseId: input.releaseId,
          manifestSha256: input.manifestSha256,
          dataVersion: input.dataVersion,
          workflowBuildId: input.workflowBuildId,
          workerVersionId: input.workerVersionId,
          sourceTree: input.sourceTree,
          environment: input.environment,
          priorPointerEtag: input.priorPointer.etag,
          priorPointerValue: input.priorPointer.value,
          evidenceDigest: input.evidenceDigest,
          approvalReference: input.approvalReference,
        },
      }),
    ).rejects.toMatchObject({ code: "RECEIPT_MISMATCH" });
  });

  it("giới hạn validity tối đa 15 phút", async () => {
    await expect(
      createPromotionReceipt({
        ...input,
        expiresAt: "2026-07-28T15:15:00.001Z",
      }),
    ).rejects.toMatchObject({ code: "RECEIPT_INVALID" });
  });

  it("từ chối receipt trước issuedAt và thời điểm kiểm tra không hợp lệ", async () => {
    const receipt = await createPromotionReceipt(input);
    const expected = {
      receiptId: receipt.receiptId,
      releaseId: input.releaseId,
      manifestSha256: input.manifestSha256,
      dataVersion: input.dataVersion,
      workflowBuildId: input.workflowBuildId,
      workerVersionId: input.workerVersionId,
      sourceTree: input.sourceTree,
      environment: input.environment,
      priorPointerEtag: input.priorPointer.etag,
      priorPointerValue: input.priorPointer.value,
      evidenceDigest: input.evidenceDigest,
      approvalReference: input.approvalReference,
    };
    await expect(
      validatePromotionReceipt(receipt, {
        now: new Date("2026-07-28T14:59:59.999Z"),
        expected,
      }),
    ).rejects.toMatchObject({ code: "RECEIPT_NOT_YET_VALID" });
    await expect(
      validatePromotionReceipt(receipt, {
        now: new Date(Number.NaN),
        expected,
      }),
    ).rejects.toMatchObject({ code: "RECEIPT_INVALID" });
  });
});
