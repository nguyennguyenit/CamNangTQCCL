import { appendFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { isWorkerVersionId } from "../src/transport/worker-version-header.js";

export function parseWranglerVersionUpload(output: string): string {
  const records = output
    .split(/\r?\n/u)
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as unknown)
    .filter(
      (value): value is Record<string, unknown> =>
        typeof value === "object" && value !== null && !Array.isArray(value),
    )
    .filter((record) => record.type === "version-upload");
  if (
    records.length !== 1 ||
    typeof records[0]?.version_id !== "string" ||
    !isWorkerVersionId(records[0].version_id)
  ) {
    throw new Error("Wrangler version upload output không hợp lệ.");
  }
  return records[0].version_id;
}

async function main(): Promise<void> {
  try {
    const outputPath = process.argv[2];
    const githubOutput = process.env["GITHUB_OUTPUT"];
    if (outputPath === undefined || githubOutput === undefined) throw new Error();
    const versionId = parseWranglerVersionUpload(
      await readFile(resolve(outputPath), "utf8"),
    );
    await appendFile(githubOutput, `candidate_version_id=${versionId}\n`);
    process.stderr.write("Đã đọc Worker version ID từ Wrangler output.\n");
  } catch {
    process.stderr.write("Không thể đọc Worker version ID.\n");
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
