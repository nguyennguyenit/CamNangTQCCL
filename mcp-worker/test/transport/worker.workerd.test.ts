import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { WORKER_VERSION_HEADER } from "../../src/worker.js";

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

describe("Worker trong runtime workerd", () => {
  it("khởi tạo MCP và đọc snapshot từ Static Assets binding", async () => {
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
    expect(initialized.headers.get(WORKER_VERSION_HEADER)).toMatch(
      /^[a-f0-9-]{36}$/iu,
    );

    const version = await exports.default.fetch(
      rpcRequest({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "tqccl_get_playbook",
          arguments: { intent: "lookup" },
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

  it("mọi public asset path đều 404 và không lộ version header", async () => {
    for (const path of [
      "/manifest.json",
      "/teams.json",
      "/data/teams.json",
      "/unknown",
    ]) {
      for (const method of ["GET", "HEAD"]) {
        for (const authorization of [undefined, `Bearer ${TOKEN}`]) {
          const response = await exports.default.fetch(
            new Request(`https://mcp.example${path}`, {
              method,
              ...(authorization === undefined
                ? {}
                : { headers: { Authorization: authorization } }),
            }),
          );
          expect(response.status).toBe(404);
          expect(response.headers.has(WORKER_VERSION_HEADER)).toBe(false);
        }
      }
    }
  });
});
