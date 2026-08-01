import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { ARTIFACT_NAMES } from "../src/data/artifact-contracts.js";
import { WORKFLOW_BUILD_ID } from "../src/generated/workflow-build.js";
import { verifyWorkerReleaseEvidence } from "../src/release/worker-release-evidence.js";

const execFileAsync = promisify(execFile);

async function main(): Promise<void> {
  try {
    const evidencePath = process.argv[2];
    if (evidencePath === undefined) throw new Error();
    const packageRoot = resolve(import.meta.dirname, "..");
    const repositoryRoot = resolve(packageRoot, "..");
    const assetNames = [...ARTIFACT_NAMES.map((name) => `${name}.json`), "manifest.json"];
    const assets = new Map(
      await Promise.all(
        assetNames.map(async (name) => [
          name,
          new Uint8Array(await readFile(resolve(packageRoot, ".worker-assets", name))),
        ] as const),
      ),
    );
    const [commit, tree] = await Promise.all([
      execFileAsync("git", ["-C", repositoryRoot, "rev-parse", "HEAD"]),
      execFileAsync("git", ["-C", repositoryRoot, "rev-parse", "HEAD^{tree}"]),
    ]);
    await verifyWorkerReleaseEvidence(
      JSON.parse(await readFile(resolve(evidencePath), "utf8")),
      {
        assets,
        expectedSource: {
          commitSha: commit.stdout.trim(),
          sourceTree: `git-tree:${tree.stdout.trim()}`,
          workflowBuildId: WORKFLOW_BUILD_ID,
        },
      },
    );
    process.stderr.write("Worker asset evidence hợp lệ.\n");
  } catch {
    process.stderr.write("Worker asset evidence không hợp lệ.\n");
    process.exitCode = 1;
  }
}

await main();
