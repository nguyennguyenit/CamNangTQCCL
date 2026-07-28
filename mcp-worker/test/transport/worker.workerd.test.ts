import { exports } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";

import { seedFixtureR2 } from "../fixtures/seed-r2.workerd.js";

const TOKEN = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

function rpcRequest(body: unknown): Request {
  return new Request("https://mcp.example/mcp", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(body),
  });
}

beforeAll(seedFixtureR2);

describe("Worker trong runtime workerd", () => {
  it("khởi tạo MCP và đọc snapshot từ hai R2 binding", async () => {
    const initialized = await exports.default.fetch(
      rpcRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "workerd-test", version: "1.0.0" },
        },
      }),
    );
    expect(initialized.status).toBe(200);

    const version = await exports.default.fetch(
      rpcRequest({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "tqccl_get_data_version",
          arguments: {},
        },
      }),
    );
    expect(version.status).toBe(200);
    const body = (await version.json()) as {
      result: { structuredContent: { releaseId: string } };
    };
    expect(body.result.structuredContent.releaseId).toMatch(
      /^sha256:[a-f0-9]{64}$/u,
    );
  });
});
