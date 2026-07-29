import type { ReleasePointer } from "../data/artifact-contracts.js";
import { stableStringify } from "../domain/contracts.js";

const MAX_RECEIPT_VALIDITY_MS = 15 * 60 * 1_000;
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const SOURCE_TREE_PATTERN = /^git-tree:(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;
const WORKFLOW_BUILD_PATTERN = /^build:sha256:[a-f0-9]{64}$/u;

export interface PromotionReceiptInput {
  releaseId: `sha256:${string}`;
  manifestSha256: `sha256:${string}`;
  dataVersion: `data:${string}`;
  workflowBuildId: `build:sha256:${string}`;
  workerVersionId: string;
  sourceTree: `git-tree:${string}`;
  priorPointer: {
    etag: string;
    value: ReleasePointer;
  };
  environment: string;
  evidenceDigest: `sha256:${string}`;
  approvalReference: string;
  issuedAt: string;
  expiresAt: string;
}

export interface PromotionReceipt extends PromotionReceiptInput {
  schemaVersion: 1;
  receiptId: `sha256:${string}`;
}

export class PromotionReceiptError extends Error {
  constructor(
    readonly code:
      | "RECEIPT_INVALID"
      | "RECEIPT_TAMPERED"
      | "RECEIPT_NOT_YET_VALID"
      | "RECEIPT_EXPIRED"
      | "RECEIPT_MISMATCH",
  ) {
    super("Promotion receipt không hợp lệ.");
    this.name = "PromotionReceiptError";
  }
}

function requireText(value: string, pattern?: RegExp): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 512 ||
    (pattern !== undefined && !pattern.test(value))
  ) {
    throw new PromotionReceiptError("RECEIPT_INVALID");
  }
  return value;
}

function normalizeInput(input: PromotionReceiptInput): PromotionReceiptInput {
  const releaseId = requireText(input.releaseId, SHA256_PATTERN);
  const releaseDigest = releaseId.slice("sha256:".length);
  const dataVersion = requireText(input.dataVersion, /^data:[a-f0-9]{12}$/u);
  if (dataVersion !== `data:${releaseDigest.slice(0, 12)}`) {
    throw new PromotionReceiptError("RECEIPT_INVALID");
  }
  const priorReleaseId = requireText(
    input.priorPointer.value.releaseId,
    SHA256_PATTERN,
  );
  if (
    input.priorPointer.value.schemaVersion !== 1 ||
    input.priorPointer.value.manifestKey !==
      `releases/${priorReleaseId.slice("sha256:".length)}/manifest.json`
  ) {
    throw new PromotionReceiptError("RECEIPT_INVALID");
  }
  const issuedAt = new Date(input.issuedAt);
  const expiresAt = new Date(input.expiresAt);
  const validity = expiresAt.getTime() - issuedAt.getTime();
  if (
    !Number.isFinite(issuedAt.getTime()) ||
    !Number.isFinite(expiresAt.getTime()) ||
    validity <= 0 ||
    validity > MAX_RECEIPT_VALIDITY_MS
  ) {
    throw new PromotionReceiptError("RECEIPT_INVALID");
  }
  return {
    releaseId: releaseId as PromotionReceiptInput["releaseId"],
    manifestSha256: requireText(
      input.manifestSha256,
      SHA256_PATTERN,
    ) as PromotionReceiptInput["manifestSha256"],
    dataVersion: dataVersion as PromotionReceiptInput["dataVersion"],
    workflowBuildId: requireText(
      input.workflowBuildId,
      WORKFLOW_BUILD_PATTERN,
    ) as PromotionReceiptInput["workflowBuildId"],
    workerVersionId: requireText(input.workerVersionId),
    sourceTree: requireText(
      input.sourceTree,
      SOURCE_TREE_PATTERN,
    ) as PromotionReceiptInput["sourceTree"],
    priorPointer: {
      etag: requireText(input.priorPointer.etag),
      value: {
        schemaVersion: 1,
        releaseId:
          priorReleaseId as PromotionReceiptInput["priorPointer"]["value"]["releaseId"],
        manifestKey: input.priorPointer.value.manifestKey,
      },
    },
    environment: requireText(input.environment),
    evidenceDigest: requireText(
      input.evidenceDigest,
      SHA256_PATTERN,
    ) as PromotionReceiptInput["evidenceDigest"],
    approvalReference: requireText(input.approvalReference),
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

async function sha256(value: unknown): Promise<`sha256:${string}`> {
  const bytes = new TextEncoder().encode(stableStringify(value));
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes as Uint8Array<ArrayBuffer>,
  );
  return `sha256:${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

export async function createPromotionReceipt(
  input: PromotionReceiptInput,
): Promise<PromotionReceipt> {
  const normalized = normalizeInput(input);
  return {
    schemaVersion: 1,
    receiptId: await sha256({ schemaVersion: 1, ...normalized }),
    ...normalized,
  };
}

export interface PromotionReceiptExpectation {
  receiptId: string;
  releaseId: string;
  manifestSha256: string;
  dataVersion: string;
  workflowBuildId: string;
  workerVersionId: string;
  sourceTree: string;
  environment: string;
  priorPointerEtag: string;
  priorPointerValue: ReleasePointer;
  evidenceDigest: string;
  approvalReference: string;
}

export async function validatePromotionReceipt(
  value: PromotionReceipt,
  options: {
    now: Date;
    expected: PromotionReceiptExpectation;
  },
): Promise<PromotionReceipt> {
  let expectedReceipt: PromotionReceipt;
  try {
    if (
      value.schemaVersion !== 1 ||
      !SHA256_PATTERN.test(value.receiptId)
    ) {
      throw new Error("invalid");
    }
    expectedReceipt = await createPromotionReceipt(value);
  } catch {
    throw new PromotionReceiptError("RECEIPT_TAMPERED");
  }
  if (expectedReceipt.receiptId !== value.receiptId) {
    throw new PromotionReceiptError("RECEIPT_TAMPERED");
  }
  const now = options.now.getTime();
  if (!Number.isFinite(now)) {
    throw new PromotionReceiptError("RECEIPT_INVALID");
  }
  if (now < new Date(value.issuedAt).getTime()) {
    throw new PromotionReceiptError("RECEIPT_NOT_YET_VALID");
  }
  if (now > new Date(value.expiresAt).getTime()) {
    throw new PromotionReceiptError("RECEIPT_EXPIRED");
  }
  const expected = options.expected;
  if (
    value.receiptId !== expected.receiptId ||
    value.releaseId !== expected.releaseId ||
    value.manifestSha256 !== expected.manifestSha256 ||
    value.dataVersion !== expected.dataVersion ||
    value.workflowBuildId !== expected.workflowBuildId ||
    value.workerVersionId !== expected.workerVersionId ||
    value.sourceTree !== expected.sourceTree ||
    value.environment !== expected.environment ||
    value.priorPointer.etag !== expected.priorPointerEtag ||
    value.priorPointer.value.schemaVersion !==
      expected.priorPointerValue.schemaVersion ||
    value.priorPointer.value.releaseId !== expected.priorPointerValue.releaseId ||
    value.priorPointer.value.manifestKey !==
      expected.priorPointerValue.manifestKey ||
    value.evidenceDigest !== expected.evidenceDigest ||
    value.approvalReference !== expected.approvalReference
  ) {
    throw new PromotionReceiptError("RECEIPT_MISMATCH");
  }
  return value;
}
