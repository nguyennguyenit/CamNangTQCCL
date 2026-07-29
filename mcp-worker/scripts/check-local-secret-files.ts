import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function verifyExceptionalSecretFilesRemoved(options: {
  listFiles: () => Promise<readonly string[]>;
}): Promise<{ verified: true; files: 0 }> {
  const files = await options.listFiles();
  if (files.length !== 0) {
    throw new Error("Phải dọn toàn bộ exceptional local secret files.");
  }
  return { verified: true, files: 0 };
}

const SECRET_PATTERNS = [
  /-----BEGIN (?:EC |OPENSSH |RSA )?PRIVATE KEY-----/u,
  /\bAKIA[A-Z0-9]{16}\b/u,
  /\bgh[pousr]_[A-Za-z0-9]{36,}\b/u,
  /\bgithub_pat_[A-Za-z0-9_]{40,}\b/u,
] as const;

export async function verifyRepositoryHasNoHighConfidenceSecrets(options: {
  files: readonly string[];
  readBytes: (path: string) => Promise<Uint8Array>;
}): Promise<{ verified: true; files: number }> {
  for (const path of options.files) {
    const bytes = await options.readBytes(path);
    if (bytes.byteLength > 1024 * 1024 || bytes.includes(0)) continue;
    const text = new TextDecoder().decode(bytes);
    if (SECRET_PATTERNS.some((pattern) => pattern.test(text))) {
      throw new Error("Repository chứa credential có độ tin cậy cao.");
    }
  }
  return { verified: true, files: options.files.length };
}

async function gitFiles(args: readonly string[]): Promise<string[]> {
  const repositoryRoot = resolve(import.meta.dirname, "../..");
  const { stdout } = await execFileAsync(
    "git",
    [
      "-C",
      repositoryRoot,
      "ls-files",
      "-z",
      ...args,
    ],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  return stdout.split("\0").filter(Boolean);
}

async function listExceptionalFiles(): Promise<string[]> {
  return gitFiles([
    "--cached",
    "--others",
    "--ignored",
    "--exclude-standard",
    "--",
    "mcp-worker/.release-secrets",
    "mcp-worker/*.release-secret",
  ]);
}

async function listReviewableFiles(): Promise<string[]> {
  return gitFiles([
    "--cached",
    "--others",
    "--exclude-standard",
    "--",
    ".",
  ]);
}

async function readRepositoryFile(path: string): Promise<Uint8Array> {
  const repositoryRoot = resolve(import.meta.dirname, "../..");
  return new Uint8Array(await readFile(resolve(repositoryRoot, path)));
}

async function verifyLocalSecretState(): Promise<void> {
  await verifyExceptionalSecretFilesRemoved({
    listFiles: listExceptionalFiles,
  });
  await verifyRepositoryHasNoHighConfidenceSecrets({
    files: await listReviewableFiles(),
    readBytes: readRepositoryFile,
  });
}

async function main(): Promise<void> {
  try {
    await verifyLocalSecretState();
    process.stderr.write("Không phát hiện local secret files hoặc credential.\n");
  } catch {
    process.stderr.write("Kiểm tra local secret files thất bại.\n");
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
