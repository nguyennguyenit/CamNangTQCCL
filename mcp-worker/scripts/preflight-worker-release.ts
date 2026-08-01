import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

import { CloudflareDeploymentClient } from "./cloudflare-deployment-client.js";
import { preflightWorkerRelease } from "./worker-deployment-controller.js";

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") throw new Error();
  return value;
}

async function main(): Promise<void> {
  try {
    const bootstrap = required("TQCCL_FIRST_RELEASE_BOOTSTRAP");
    if (bootstrap !== "true" && bootstrap !== "false") throw new Error();
    const deployment = new CloudflareDeploymentClient({
      accountId: required("CLOUDFLARE_ACCOUNT_ID"),
      workerName: required("TQCCL_WORKER_NAME"),
      apiToken: required("TQCCL_WORKER_DEPLOY_API_TOKEN"),
      runId: "preflight",
    });
    const result = await preflightWorkerRelease({
      bootstrap: bootstrap === "true",
      deployment,
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch {
    process.stderr.write("Preflight Worker release thất bại.\n");
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
