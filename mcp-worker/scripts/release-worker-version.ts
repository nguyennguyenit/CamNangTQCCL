import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { CloudflareDeploymentClient } from "./cloudflare-deployment-client.js";
import type { WorkerDeploymentSnapshot } from "./cloudflare-deployment-client.js";
import { awaitServedVersion } from "./await-served-version.js";
import { createPacedMcpFetcher } from "./paced-mcp-fetch.js";
import {
  parseReleaseVerificationFixture,
  readReleaseIdentity,
  verifyRelease,
  type ReleaseVerificationStep,
} from "./verify-release.js";
import {
  releaseWorkerVersion,
  verifyBootstrapWorkerVersion,
} from "./worker-deployment-controller.js";
import { parseWorkerReleaseEvidence } from "../src/release/worker-release-evidence.js";
import { isWorkerVersionId } from "../src/transport/worker-version-header.js";

const OVERRIDE_HEADER = "Cloudflare-Workers-Version-Overrides";

type ReleaseFailureStage =
  | "initializing"
  | "settle"
  | `release:${ReleaseVerificationStep}`
  | `rollback-prior:${ReleaseVerificationStep | "starting"}`
  | "rollback-observed:settle"
  | `rollback-observed:${ReleaseVerificationStep | "starting"}`
  | "rollback-comparison";

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") throw new Error();
  return value;
}

function overrideFetcher(
  workerName: string,
  versionId: string,
  fetcher: typeof fetch,
): typeof fetch {
  return async (input, init) => {
    const request = new Request(input, init);
    request.headers.set(OVERRIDE_HEADER, `${workerName}="${versionId}"`);
    return fetcher(request);
  };
}

async function main(): Promise<void> {
  const states: Record<string, unknown> = {};
  let status = "failed";
  let failureStage: ReleaseFailureStage = "initializing";
  const deploymentEvidencePath = process.env["TQCCL_DEPLOYMENT_EVIDENCE_PATH"];
  const candidateArgument = process.argv[2] ?? null;
  try {
    const [candidateVersionId, evidencePath, fixturePath] = process.argv.slice(2);
    if (
      !isWorkerVersionId(candidateVersionId ?? "") ||
      evidencePath === undefined ||
      fixturePath === undefined
    ) throw new Error();
    const workerName = required("TQCCL_WORKER_NAME");
    const runId = required("TQCCL_RELEASE_RUN_ID");
    const endpoint = new URL(required("TQCCL_MCP_ENDPOINT"));
    const bearer = required("TQCCL_MCP_BEARER_CURRENT");
    const evidence = parseWorkerReleaseEvidence(
      JSON.parse(await readFile(resolve(evidencePath), "utf8")),
    );
    const fixture = parseReleaseVerificationFixture(
      JSON.parse(await readFile(resolve(fixturePath), "utf8")),
    );
    const pacedFetcher = createPacedMcpFetcher({ minimumIntervalMs: 1_100 });
    const verify = (versionId: string, fetcher: typeof fetch = pacedFetcher) =>
      verifyRelease({
        endpoint,
        bearer,
        expectedReleaseId: evidence.releaseId,
        expectedWorkflowBuildId: evidence.workflowBuildId,
        expectedWorkerVersionId: versionId,
        fixture,
        onStep: (step) => {
          failureStage = `release:${step}`;
        },
        ...(fetcher === undefined ? {} : { fetcher }),
      }).then(() => undefined);
    const deployment = new CloudflareDeploymentClient({
      accountId: required("CLOUDFLARE_ACCOUNT_ID"),
      workerName,
      apiToken: required("TQCCL_WORKER_DEPLOY_API_TOKEN"),
      runId,
    });
    const bootstrap = process.env["TQCCL_FIRST_RELEASE_BOOTSTRAP"] ?? "false";
    const rehearseRollback = process.env["TQCCL_REHEARSE_ROLLBACK"] ?? "false";
    if (
      (bootstrap !== "true" && bootstrap !== "false") ||
      (rehearseRollback !== "true" && rehearseRollback !== "false") ||
      (bootstrap === "true" && rehearseRollback === "true")
    ) {
      throw new Error();
    }
    const shared = {
      candidateVersionId,
      runId,
      deployment,
      // Sau mỗi lần đổi deployment, edge còn trả xen kẽ version cũ: chờ ổn định rồi mới xác minh không override.
      verifyProduction: async (versionId: string) => {
        failureStage = "settle";
        await awaitServedVersion({ endpoint, bearer, versionId, fetcher: pacedFetcher });
        await verify(versionId);
      },
      incident: async () => {
        status = "incident";
        process.stderr.write("::error::Worker deployment drift detected\n");
      },
      onState: (name: string, snapshot: WorkerDeploymentSnapshot) => {
        states[name] = snapshot;
      },
    };
    const result =
      bootstrap === "true"
        ? await verifyBootstrapWorkerVersion(shared)
        : await releaseWorkerVersion({
            ...shared,
            // Version Override chỉ có hiệu lực khi edge đã nhận deployment prior + candidate 0%: chờ như production.
            verifyCandidate: async (versionId) => {
              const fetcher = overrideFetcher(workerName, versionId, pacedFetcher);
              failureStage = "settle";
              await awaitServedVersion({ endpoint, bearer, versionId, fetcher });
              await verify(versionId, fetcher);
            },
            ...(rehearseRollback === "true"
              ? {
                  prepareRollbackVerification: async (
                    priorVersionId: string,
                  ) => {
                    failureStage = "rollback-prior:starting";
                    const expected = await readReleaseIdentity({
                      endpoint,
                      bearer,
                      expectedWorkerVersionId: priorVersionId,
                      fetcher: pacedFetcher,
                      onStep: (step) => {
                        failureStage = `rollback-prior:${step}`;
                      },
                    });
                    return async () => {
                      failureStage = "rollback-observed:settle";
                      await awaitServedVersion({ endpoint, bearer, versionId: priorVersionId, fetcher: pacedFetcher });
                      failureStage = "rollback-observed:starting";
                      const observed = await readReleaseIdentity({
                        endpoint,
                        bearer,
                        expectedWorkerVersionId: priorVersionId,
                        fetcher: pacedFetcher,
                        onStep: (step) => {
                          failureStage = `rollback-observed:${step}`;
                        },
                      });
                      failureStage = "rollback-comparison";
                      if (
                        observed.releaseId !== expected.releaseId ||
                        observed.workflowVersion !== expected.workflowVersion ||
                        observed.snapshotDigest !== expected.snapshotDigest
                      ) {
                        throw new Error();
                      }
                    };
                  },
                }
              : {}),
          });
    status = "verified";
    const output = {
      ...evidence,
      workerVersionId: candidateVersionId,
      releaseMode: bootstrap === "true" ? "bootstrap" : "normal",
      rollbackRehearsal: rehearseRollback === "true",
      status,
      deployments: result,
    };
    if (deploymentEvidencePath === undefined) throw new Error();
    await writeFile(deploymentEvidencePath, `${JSON.stringify(output)}\n`, {
      flag: "wx",
    });
    process.stdout.write(`${JSON.stringify(output)}\n`);
  } catch {
    if (deploymentEvidencePath !== undefined) {
      await writeFile(
        deploymentEvidencePath,
        `${JSON.stringify({ schemaVersion: 1, status, failureStage, candidateVersionId: candidateArgument, states })}\n`,
        { flag: "wx" },
      ).catch(() => undefined);
    }
    process.stderr.write("Phát hành Worker version thất bại.\n");
    process.exitCode = 1;
  }
}

await main();
