import { spawn } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export interface RepositoryGateCommand {
  label: string;
  command: string;
  args: readonly string[];
  cwd: string;
}

type CommandRunner = (
  command: RepositoryGateCommand,
  environment: NodeJS.ProcessEnv,
) => Promise<void>;

const packageRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(packageRoot, "..");

export const REPOSITORY_GATE_COMMANDS: readonly RepositoryGateCommand[] = [
  {
    label: "mcp-worker",
    command: "npm",
    args: ["run", "check"],
    cwd: packageRoot,
  },
  {
    label: "astro-build",
    command: "npm",
    args: ["run", "build"],
    cwd: repositoryRoot,
  },
  {
    label: "astro-dist",
    command: "npm",
    args: ["run", "test:dist"],
    cwd: repositoryRoot,
  },
  {
    label: "astro-e2e",
    command: "npm",
    args: ["run", "test:e2e"],
    cwd: repositoryRoot,
  },
  {
    label: "root-js",
    command: "npm",
    args: ["run", "test:node"],
    cwd: repositoryRoot,
  },
  {
    label: "python-fallback",
    command: "python3",
    args: ["-m", "unittest", "discover", "-s", "tests"],
    cwd: repositoryRoot,
  },
  {
    label: "vision-worker-tests",
    command: "npm",
    args: ["test"],
    cwd: resolve(repositoryRoot, "worker"),
  },
  {
    label: "vision-worker-typecheck",
    command: "npm",
    args: ["run", "typecheck"],
    cwd: resolve(repositoryRoot, "worker"),
  },
  {
    label: "mcp-worker-dry-run",
    command: "npm",
    args: ["run", "deploy:dry-run"],
    cwd: packageRoot,
  },
] as const;

const FORBIDDEN_CREDENTIALS = [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "CF_API_TOKEN",
  "CLOUDFLARE_API_KEY",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_CONTROL_PLANE_READ_TOKEN",
  "TQCCL_MCP_BEARER_CURRENT",
  "TQCCL_MCP_BEARER_NEXT",
  "TQCCL_R2_RELEASE_ACCESS_KEY_ID",
  "TQCCL_R2_RELEASE_SECRET_ACCESS_KEY",
  "TQCCL_R2_POINTER_ACCESS_KEY_ID",
  "TQCCL_R2_POINTER_SECRET_ACCESS_KEY",
  "TQCCL_WORKER_DEPLOY_API_TOKEN",
] as const;

const RETIRED_RELEASE_PATTERN =
  /@aws-sdk\/client-s3|stage:data-release|activate:data-release|publish-data-release|r2-release-store|promotion-receipt|TQCCL_(?:RELEASE|POINTER)_BUCKET|TQCCL_R2_|npm\s+publish/iu;

export function assertNoRetiredReleaseResidue(): void {
  const roots = [
    resolve(packageRoot, "src"),
    resolve(packageRoot, "scripts"),
    resolve(packageRoot, "infra"),
    resolve(repositoryRoot, ".github/workflows"),
  ];
  const files = [
    resolve(packageRoot, "package.json"),
    resolve(packageRoot, "wrangler.jsonc"),
    ...roots.flatMap((root) =>
      readdirSync(root, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => resolve(entry.parentPath, entry.name)),
    ),
  ].filter((filename) => filename !== import.meta.filename);
  if (
    files.some((filename) =>
      RETIRED_RELEASE_PATTERN.test(readFileSync(filename, "utf8")),
    )
  ) {
    throw new Error("Repository còn release consumer đã retire.");
  }
}

export function assertCredentialFreeEnvironment(
  environment: NodeJS.ProcessEnv,
): void {
  if (FORBIDDEN_CREDENTIALS.some((name) => environment[name])) {
    throw new Error("Repository gate phải chạy không có release credential.");
  }
}

function runCommand(
  command: RepositoryGateCommand,
  environment: NodeJS.ProcessEnv,
): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command.command, [...command.args], {
      cwd: command.cwd,
      env: environment,
      stdio: "inherit",
      shell: false,
    });
    child.once("error", rejectPromise);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(
        new Error(
          `Repository gate ${command.label} thất bại (${signal ?? code ?? "unknown"}).`,
        ),
      );
    });
  });
}

export async function runRepositoryGate(options: {
  runner?: CommandRunner;
  environment?: NodeJS.ProcessEnv;
} = {}): Promise<void> {
  const environment = options.environment ?? process.env;
  assertCredentialFreeEnvironment(environment);
  assertNoRetiredReleaseResidue();
  const runner = options.runner ?? runCommand;
  for (const command of REPOSITORY_GATE_COMMANDS) {
    await runner(command, environment);
  }
}

async function main(): Promise<void> {
  try {
    await runRepositoryGate();
    process.stderr.write("Repository release gate đã đạt.\n");
  } catch {
    process.stderr.write("Repository release gate thất bại.\n");
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
