import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { stableStringify } from "../src/domain/contracts.js";
import {
  createPromotionReceipt,
  type PromotionReceipt,
  type PromotionReceiptExpectation,
} from "../src/release/promotion-receipt.js";
import {
  CloudflareDeploymentClient,
  type WorkerDeploymentSnapshot,
} from "./cloudflare-deployment-client.js";
import {
  activateDataReleaseWithDeployment,
  type ActivationLease,
  type DeploymentController,
  type PointerStore,
} from "./publish-data-release.js";
import {
  createR2S3Client,
  S3ActivationLease,
  S3PointerStore,
} from "./r2-release-store.js";
import { validateReleaseTarget } from "./stage-data-release.js";
import {
  parseReleaseVerificationFixture,
  verifyRelease,
} from "./verify-release.js";
import { verifyControlPlaneLive } from "./verify-control-plane.js";

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const FORBIDDEN_ACTIVATE_CREDENTIALS = [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "CF_API_TOKEN",
  "CLOUDFLARE_API_KEY",
  "CLOUDFLARE_API_TOKEN",
  "TQCCL_R2_RELEASE_ACCESS_KEY_ID",
  "TQCCL_R2_RELEASE_SECRET_ACCESS_KEY",
] as const;

export class ActivateDriverError extends Error {
  constructor() {
    super("Không thể activate data release.");
    this.name = "ActivateDriverError";
  }
}

export function assertActivateCredentialBoundary(
  environment: NodeJS.ProcessEnv,
): void {
  if (FORBIDDEN_ACTIVATE_CREDENTIALS.some((name) => environment[name])) {
    throw new ActivateDriverError();
  }
}

export interface ActivateArguments {
  receiptPath: string;
  expectationPath: string;
  fixturePath: string;
  endpoint: URL;
  environment: "staging" | "production";
}

function isCleanMcpEndpoint(endpoint: URL): boolean {
  return (
    endpoint.protocol === "https:" &&
    endpoint.pathname === "/mcp" &&
    endpoint.username === "" &&
    endpoint.password === "" &&
    endpoint.search === "" &&
    endpoint.hash === ""
  );
}

export function validateApprovedEndpoint(
  endpoint: URL,
  approvedEndpoint: string,
): URL {
  try {
    const approved = new URL(approvedEndpoint);
    if (
      !isCleanMcpEndpoint(endpoint) ||
      !isCleanMcpEndpoint(approved) ||
      endpoint.href !== approved.href
    ) {
      throw new Error("endpoint mismatch");
    }
    return endpoint;
  } catch {
    throw new ActivateDriverError();
  }
}

export function assertExclusiveWorkerDeployment(
  deployment: WorkerDeploymentSnapshot,
  expectedVersionId: string,
): void {
  if (
    deployment.versions.length !== 1 ||
    deployment.versions[0]?.versionId !== expectedVersionId ||
    deployment.versions[0].percentage !== 100
  ) {
    throw new ActivateDriverError();
  }
}

export function parseActivateArguments(
  args: readonly string[],
): ActivateArguments {
  if (
    args.length !== 10 ||
    args[0] !== "--receipt" ||
    args[2] !== "--expectation" ||
    args[4] !== "--fixture" ||
    args[6] !== "--endpoint" ||
    args[8] !== "--environment" ||
    args[1] === "" ||
    args[3] === "" ||
    args[5] === "" ||
    args[9] === "" ||
    (args[9] !== "staging" && args[9] !== "production")
  ) {
    throw new ActivateDriverError();
  }
  const endpoint = new URL(args[7]!);
  if (!isCleanMcpEndpoint(endpoint)) {
    throw new ActivateDriverError();
  }
  return {
    receiptPath: resolve(args[1]!),
    expectationPath: resolve(args[3]!),
    fixturePath: resolve(args[5]!),
    endpoint,
    environment: args[9],
  };
}

async function parseReceipt(value: unknown): Promise<PromotionReceipt> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ActivateDriverError();
  }
  const candidate = value as PromotionReceipt;
  try {
    const recomputed = await createPromotionReceipt(candidate);
    if (
      candidate.schemaVersion !== 1 ||
      candidate.receiptId !== recomputed.receiptId
    ) {
      throw new Error("receipt mismatch");
    }
    return candidate;
  } catch {
    throw new ActivateDriverError();
  }
}

export function parsePromotionExpectationDocument(
  value: unknown,
): PromotionReceiptExpectation {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ActivateDriverError();
  }
  const expectation = value as Record<string, unknown>;
  const pointer = expectation.priorPointerValue;
  if (
    typeof expectation.receiptId !== "string" ||
    !SHA256_PATTERN.test(expectation.receiptId) ||
    typeof expectation.releaseId !== "string" ||
    !SHA256_PATTERN.test(expectation.releaseId) ||
    typeof expectation.manifestSha256 !== "string" ||
    !SHA256_PATTERN.test(expectation.manifestSha256) ||
    typeof expectation.dataVersion !== "string" ||
    !/^data:[a-f0-9]{12}$/u.test(expectation.dataVersion) ||
    typeof expectation.workflowBuildId !== "string" ||
    !/^build:sha256:[a-f0-9]{64}$/u.test(expectation.workflowBuildId) ||
    typeof expectation.workerVersionId !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu.test(
      expectation.workerVersionId,
    ) ||
    typeof expectation.sourceTree !== "string" ||
    !/^git-tree:(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(
      expectation.sourceTree,
    ) ||
    (expectation.environment !== "staging" &&
      expectation.environment !== "production") ||
    typeof expectation.priorPointerEtag !== "string" ||
    expectation.priorPointerEtag === "" ||
    typeof expectation.evidenceDigest !== "string" ||
    !SHA256_PATTERN.test(expectation.evidenceDigest) ||
    typeof expectation.approvalReference !== "string" ||
    expectation.approvalReference === "" ||
    typeof pointer !== "object" ||
    pointer === null ||
    Array.isArray(pointer)
  ) {
    throw new ActivateDriverError();
  }
  const priorPointer = pointer as Record<string, unknown>;
  if (
    priorPointer.schemaVersion !== 1 ||
    typeof priorPointer.releaseId !== "string" ||
    !SHA256_PATTERN.test(priorPointer.releaseId) ||
    priorPointer.manifestKey !==
      `releases/${priorPointer.releaseId.slice("sha256:".length)}/manifest.json`
  ) {
    throw new ActivateDriverError();
  }
  return expectation as unknown as PromotionReceiptExpectation;
}

export async function activateApprovedRelease(options: {
  receipt: PromotionReceipt;
  expectation: PromotionReceiptExpectation;
  expectedReceiptId: string;
  environment: "staging" | "production";
  now: Date;
  pointerStore: PointerStore;
  activationLease: ActivationLease;
  deployment: DeploymentController;
  verifyPreflight: () => Promise<void>;
  verifyLive: (input: {
    releaseId: string;
    workerVersionId: string;
    forceRefresh: true;
  }) => Promise<void>;
}) {
  if (
    !SHA256_PATTERN.test(options.expectedReceiptId) ||
    options.receipt.receiptId !== options.expectedReceiptId ||
    options.expectation.receiptId !== options.expectedReceiptId ||
    options.receipt.environment !== options.environment ||
    options.expectation.environment !== options.environment
  ) {
    throw new ActivateDriverError();
  }
  return activateDataReleaseWithDeployment({
    receipt: options.receipt,
    expected: options.expectation,
    now: options.now,
    pointerStore: options.pointerStore,
    activationLease: options.activationLease,
    deployment: options.deployment,
    verifyPreflight: options.verifyPreflight,
    verifyLive: options.verifyLive,
  });
}

function requireEnvironment(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") throw new ActivateDriverError();
  return value;
}

async function main(): Promise<void> {
  try {
    const args = parseActivateArguments(process.argv.slice(2));
    assertActivateCredentialBoundary(process.env);
    const receipt = await parseReceipt(
      JSON.parse(await readFile(args.receiptPath, "utf8")),
    );
    const expectation = parsePromotionExpectationDocument(
      JSON.parse(await readFile(args.expectationPath, "utf8")),
    );
    const fixture = parseReleaseVerificationFixture(
      JSON.parse(await readFile(args.fixturePath, "utf8")),
    );
    const requirements: unknown = JSON.parse(
      await readFile(
        new URL("../infra/control-plane-requirements.json", import.meta.url),
        "utf8",
      ),
    );
    const accountId = requireEnvironment("CLOUDFLARE_ACCOUNT_ID");
    const releaseBucket = requireEnvironment("TQCCL_RELEASE_BUCKET_NAME");
    const pointerBucket = requireEnvironment("TQCCL_POINTER_BUCKET_NAME");
    validateReleaseTarget(
      args.environment,
      releaseBucket,
      pointerBucket,
    );
    const pointerClient = createR2S3Client({
      accountId,
      accessKeyId: requireEnvironment("TQCCL_R2_POINTER_ACCESS_KEY_ID"),
      secretAccessKey: requireEnvironment(
        "TQCCL_R2_POINTER_SECRET_ACCESS_KEY",
      ),
    });
    const endpoint = validateApprovedEndpoint(
      args.endpoint,
      requireEnvironment("TQCCL_APPROVED_MCP_ENDPOINT"),
    );
    const deployment = new CloudflareDeploymentClient({
      accountId,
      workerName: requireEnvironment("TQCCL_WORKER_NAME"),
      apiToken: requireEnvironment("TQCCL_WORKER_DEPLOY_API_TOKEN"),
    });
    const result = await activateApprovedRelease({
      receipt,
      expectation,
      expectedReceiptId: requireEnvironment("TQCCL_APPROVED_RECEIPT_ID"),
      environment: args.environment,
      now: new Date(),
      pointerStore: new S3PointerStore(pointerClient, pointerBucket),
      activationLease: new S3ActivationLease(
        pointerClient,
        pointerBucket,
        {
          holderId: requireEnvironment("TQCCL_ACTIVATION_HOLDER_ID"),
        },
      ),
      deployment,
      verifyPreflight: async () => {
        await verifyControlPlaneLive(requirements, {
          accountId,
          zoneId: requireEnvironment("CLOUDFLARE_ZONE_ID"),
          releaseBucket,
          pointerBucket,
          apiToken: requireEnvironment(
            "CLOUDFLARE_CONTROL_PLANE_READ_TOKEN",
          ),
        });
      },
      verifyLive: async (input) => {
        await verifyRelease({
          endpoint,
          bearer: requireEnvironment("TQCCL_MCP_BEARER_CURRENT"),
          expectedReleaseId: input.releaseId,
          expectedWorkflowBuildId: receipt.workflowBuildId,
          fixture,
          forceRefresh: input.forceRefresh,
        });
        assertExclusiveWorkerDeployment(
          await deployment.readCurrent(),
          input.workerVersionId,
        );
      },
    });
    process.stdout.write(
      `${stableStringify({
        ...result,
        environment: args.environment,
        receiptId: receipt.receiptId,
      })}\n`,
    );
  } catch {
    process.stderr.write("Activate data release thất bại.\n");
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1];
if (
  invokedPath !== undefined &&
  pathToFileURL(resolve(invokedPath)).href === import.meta.url
) {
  await main();
}
