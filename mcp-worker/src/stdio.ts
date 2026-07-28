import { access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Readable, Writable } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { FilesystemDataSource } from "./data/filesystem-data-source.js";
import { createMcpServer } from "./mcp/create-mcp-server.js";
import { MAX_REQUEST_BYTES } from "./research/research-contracts.js";
import { createResearchHandlers } from "./research/research-handlers.js";

export interface StdioOptions {
  dataRoot?: string;
  stdin?: Readable;
  stdout?: Writable;
  stderr?: Pick<NodeJS.WriteStream, "write">;
}

async function defaultDataRoot(): Promise<string> {
  const moduleDirectory = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(moduleDirectory, "../../data"),
    resolve(moduleDirectory, "../../../../data"),
  ];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Hỗ trợ cả cây nguồn TypeScript và cây dist.
    }
  }
  return candidates[0]!;
}

export async function runStdio(options: StdioOptions = {}) {
  const configuredDataRoot = process.env["TQCCL_DATA_ROOT"];
  const dataRoot = resolve(
    options.dataRoot ?? configuredDataRoot ?? (await defaultDataRoot()),
  );
  const handlers = createResearchHandlers({
    dataSource: new FilesystemDataSource({ dataRoot }),
  });
  const server = createMcpServer({ handlers });
  const transport = new StdioServerTransport(
    options.stdin ?? process.stdin,
    options.stdout ?? process.stdout,
    { maxBufferSize: MAX_REQUEST_BYTES },
  );

  await server.connect(transport);
  (options.stderr ?? process.stderr).write("TQCCL stdio sẵn sàng.\n");
  return server;
}

export async function main(): Promise<void> {
  try {
    const server = await runStdio();
    let closing = false;
    const close = async () => {
      if (closing) return;
      closing = true;
      await server.close();
    };
    process.once("SIGINT", () => void close());
    process.once("SIGTERM", () => void close());
  } catch {
    process.stderr.write("TQCCL stdio không thể khởi động.\n");
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
