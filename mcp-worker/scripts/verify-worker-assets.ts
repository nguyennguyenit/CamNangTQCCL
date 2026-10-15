import { execFile } from "node:child_process";
import { lstat, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { artifactNamesForManifest, validateManifest } from "../src/data/artifact-contracts.js";
import { WORKFLOW_BUILD_ID } from "../src/generated/workflow-build.js";
import { verifyWorkerReleaseEvidence } from "../src/release/worker-release-evidence.js";

const execFileAsync = promisify(execFile);

export async function readWorkerAssetFiles(directory: string): Promise<Map<string, Uint8Array>> {
  const root = await lstat(directory);
  if (!root.isDirectory() || root.isSymbolicLink()) throw new Error("Invalid asset directory");
  const entries = await readdir(directory, { withFileTypes: true });
  if (entries.some(entry => !entry.isFile() || entry.isSymbolicLink())) throw new Error("Invalid asset entry");
  const manifestBytes = new Uint8Array(await readFile(resolve(directory, "manifest.json")));
  const manifest = await validateManifest(JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(manifestBytes)));
  const assetNames = [...artifactNamesForManifest(manifest).map(name => `${name}.json`), "manifest.json"].sort();
  if (entries.map(entry => entry.name).sort().join("\0") !== assetNames.join("\0")) throw new Error("Invalid asset inventory");
  return new Map(await Promise.all(assetNames.map(async name => [name, name === "manifest.json" ? manifestBytes :
    new Uint8Array(await readFile(resolve(directory, name))),
  ] as const)));
}

async function main(): Promise<void> {
  try {
    const evidencePath = process.argv[2];
    if (evidencePath === undefined) throw new Error();
    const packageRoot = resolve(import.meta.dirname, "..");
    const repositoryRoot = resolve(packageRoot, "..");
    const assets = await readWorkerAssetFiles(resolve(packageRoot, ".worker-assets"));
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

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await main();
