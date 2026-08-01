import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { CloudflareDeploymentClient } from "./cloudflare-deployment-client.js";
import type { WorkerDeploymentSnapshot } from "./cloudflare-deployment-client.js";
import {
  parseReleaseVerificationFixture,
  verifyRelease,
} from "./verify-release.js";
import {
  bootstrapWorkerVersion,
  releaseWorkerVersion,
} from "./worker-deployment-controller.js";
import { parseWorkerReleaseEvidence } from "../src/release/worker-release-evidence.js";
import { isWorkerVersionId } from "../src/transport/worker-version-header.js";

const OVERRIDE_HEADER = "Cloudflare-Workers-Version-Overrides";

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") throw new Error();
  return value;
}

function overrideFetcher(workerName: string, versionId: string): typeof fetch {
  return async (input, init) => {
    const request = new Request(input, init);
    request.headers.set(OVERRIDE_HEADER, `${workerName}="${versionId}"`);
    return fetch(request);
  };
}

async function main(): Promise<void> {
  const states: Record<string, unknown> = {};
  let status = "failed";
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
    const verify = (versionId: string, fetcher?: typeof fetch) =>
      verifyRelease({
        endpoint,
        bearer,
        expectedReleaseId: evidence.releaseId,
        expectedWorkflowBuildId: evidence.workflowBuildId,
        expectedWorkerVersionId: versionId,
        fixture,
        ...(fetcher === undefined ? {} : { fetcher }),
      }).then(() => undefined);
    const deployment = new CloudflareDeploymentClient({
      accountId: required("CLOUDFLARE_ACCOUNT_ID"),
      workerName,
      apiToken: required("TQCCL_WORKER_DEPLOY_API_TOKEN"),
      runId,
    });
    const bootstrap = process.env["TQCCL_FIRST_RELEASE_BOOTSTRAP"] ?? "false";
    if (bootstrap !== "true" && bootstrap !== "false") throw new Error();
    const shared = {
      candidateVersionId,
      runId,
      deployment,
      verifyProduction: (versionId: string) => verify(versionId),
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
        ? await bootstrapWorkerVersion(shared)
        : await releaseWorkerVersion({
            ...shared,
            verifyCandidate: (versionId) =>
              verify(versionId, overrideFetcher(workerName, versionId)),
          });
    status = "verified";
    const output = {
      ...evidence,
      workerVersionId: candidateVersionId,
      releaseMode: bootstrap === "true" ? "bootstrap" : "normal",
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
        `${JSON.stringify({ schemaVersion: 1, status, candidateVersionId: candidateArgument, states })}\n`,
        { flag: "wx" },
      ).catch(() => undefined);
    }
    process.stderr.write("Phát hành Worker version thất bại.\n");
    process.exitCode = 1;
  }
}

await main();
