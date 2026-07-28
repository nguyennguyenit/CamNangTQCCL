import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterEach, describe, expect, it } from "vitest";

import { RESEARCH_TOOL_NAMES } from "../../src/research/research-contracts.js";

const packageRoot = fileURLToPath(new URL("../../", import.meta.url));
const fixtureRoot = fileURLToPath(
  new URL("../fixtures/release-snapshot", import.meta.url),
);

const clients: Client[] = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

async function waitForExit(pid: number): Promise<boolean> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      process.kill(pid, 0);
    } catch {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return false;
}

describe("transport stdio", () => {
  it("khởi tạo, liệt kê, gọi và tắt sạch qua client chính thức", async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["--import", "tsx", "src/stdio.ts"],
      cwd: packageRoot,
      env: {
        ...getDefaultEnvironment(),
        TQCCL_DATA_ROOT: fixtureRoot,
      },
      stderr: "pipe",
    });
    let diagnostics = "";
    transport.stderr?.on("data", (chunk) => {
      diagnostics += String(chunk);
    });
    const client = new Client({
      name: "stdio-integration-test",
      version: "1.0.0",
    });
    clients.push(client);

    await client.connect(transport);
    expect(client.getServerVersion()).toEqual({
      name: "tqccl-research",
      version: "0.1.0",
    });
    expect((await client.listTools()).tools.map(({ name }) => name)).toEqual(
      RESEARCH_TOOL_NAMES,
    );

    const result = await client.callTool({
      name: "tqccl_get_data_version",
      arguments: {},
    });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      releaseId: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
    });
    expect(diagnostics).not.toContain("sha256:");

    const pid = transport.pid;
    expect(pid).not.toBeNull();
    await client.close();
    clients.pop();
    expect(await waitForExit(pid!)).toBe(true);
  });
});
