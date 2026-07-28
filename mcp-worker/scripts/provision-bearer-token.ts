import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export type SecretSink = (
  command: string,
  args: readonly string[],
  token: string,
) => Promise<void>;

export interface ProvisionBearerOptions {
  secretName: string;
  configPath: string;
}

const wranglerSecretSink: SecretSink = (command, args, token) =>
  new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      stdio: ["pipe", "ignore", "inherit"],
    });
    child.once("error", rejectPromise);
    child.once("close", (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        rejectPromise(new Error("Managed secret sink thất bại."));
      }
    });
    child.stdin.end(`${token}\n`);
  });

export async function provisionBearerToken(
  options: ProvisionBearerOptions,
  sink: SecretSink = wranglerSecretSink,
): Promise<void> {
  if (
    !/^[A-Z][A-Z0-9_]{2,63}$/u.test(options.secretName) ||
    options.configPath.trim() === ""
  ) {
    throw new Error("Tham số cấp secret không hợp lệ.");
  }

  const token = randomBytes(32).toString("base64url");
  await sink(
    "wrangler",
    [
      "secret",
      "put",
      options.secretName,
      "--config",
      options.configPath,
    ],
    token,
  );
}

function parseArgs(args: readonly string[]): ProvisionBearerOptions {
  if (
    args.length !== 4 ||
    args[0] !== "--secret-name" ||
    args[2] !== "--config" ||
    args[1] === undefined ||
    args[3] === undefined
  ) {
    throw new Error("Cách dùng không hợp lệ.");
  }
  return { secretName: args[1], configPath: args[3] };
}

async function main(): Promise<void> {
  try {
    await provisionBearerToken(parseArgs(process.argv.slice(2)));
    process.stderr.write("Đã cập nhật managed bearer secret.\n");
  } catch {
    process.stderr.write("Không thể cập nhật managed bearer secret.\n");
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
