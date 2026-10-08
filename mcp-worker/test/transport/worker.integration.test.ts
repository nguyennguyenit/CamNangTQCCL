import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { describe, expect, it } from "vitest";

import { FilesystemDataSource } from "../../src/data/filesystem-data-source.js";
import { InFlightLimiter, TokenRateLimiter } from "../../src/security/request-limits.js";
import {
  createWorker,
  WORKER_VERSION_HEADER,
  type WorkerEnvironment,
} from "../../src/worker.js";

const fixtureRoot = fileURLToPath(
  new URL("../fixtures/release-snapshot", import.meta.url),
);
const TOKEN = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const VERSION_ID = "11111111-2222-4333-8444-555555555555";
const ENV = {
  CF_VERSION_METADATA: {
    id: VERSION_ID,
  },
  TQCCL_MCP_BEARER_CURRENT: TOKEN,
  TQCCL_MCP_ALLOWED_ORIGINS: "https://agent.example",
  TQCCL_MCP_MAX_BODY_BYTES: "65536",
  TQCCL_MCP_MAX_RESULT_BYTES: "98304",
  TQCCL_MCP_RATE_MAX: "10",
  TQCCL_MCP_RATE_WINDOW_MS: "60000",
  TQCCL_MCP_MAX_IN_FLIGHT: "2",
} as WorkerEnvironment;

function rpcRequest(
  body: unknown,
  additions: Record<string, string> = {},
): Request {
  return new Request("https://mcp.example/mcp", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...additions,
    },
    body: JSON.stringify(body),
  });
}

function initializeRequest() {
  return {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "worker-test", version: "1.0.0" },
    },
  };
}

function workerWithCounters() {
  let dataSources = 0;
  const worker = createWorker({
    createDataSource() {
      dataSources += 1;
      return new FilesystemDataSource({ dataRoot: fixtureRoot });
    },
    rateLimiter: new TokenRateLimiter({
      maxRequests: 10,
      windowMs: 60_000,
    }),
    inFlightLimiter: new InFlightLimiter(2),
    now: () => Date.parse("2026-07-28T12:00:00.000Z"),
  });
  return { worker, dataSources: () => dataSources };
}

describe("transport Streamable HTTP Worker", () => {
  it("trả health no-I/O và 404 tối giản ngoài route", async () => {
    const { worker, dataSources } = workerWithCounters();

    const health = await worker.fetch(
      new Request("https://mcp.example/healthz"),
      ENV,
    );
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });
    expect(health.headers.has(WORKER_VERSION_HEADER)).toBe(false);

    const missing = await worker.fetch(
      new Request("https://mcp.example/other"),
      ENV,
    );
    expect(missing.status).toBe(404);
    expect(missing.headers.has(WORKER_VERSION_HEADER)).toBe(false);
    expect(dataSources()).toBe(0);
  });

  it("xác thực mọi method trước khi đọc body hoặc tạo data source", async () => {
    const { worker, dataSources } = workerWithCounters();
    for (const method of ["GET", "POST", "DELETE"]) {
      const denied = new Request("https://mcp.example/mcp", {
        method,
        ...(method === "POST"
          ? {
              headers: { "Content-Type": "application/json" },
              body: '{"private":"payload"}',
            }
          : {}),
      });
      const response = await worker.fetch(denied, ENV);

      expect(response.status).toBe(401);
      expect(response.headers.get("WWW-Authenticate")).toBe("Bearer");
      expect(response.headers.has(WORKER_VERSION_HEADER)).toBe(false);
      expect(denied.bodyUsed).toBe(false);
      expect(JSON.stringify(await response.json())).not.toContain("private");
    }
    expect(dataSources()).toBe(0);
  });

  it("bỏ qua force-refresh header và chỉ lộ version sau bearer auth", async () => {
    const { worker, dataSources } = workerWithCounters();
    const unauthorized = rpcRequest(initializeRequest(), {
      Authorization: "Bearer wrong",
      "TQCCL-MCP-Force-Refresh": "unexpected",
    });
    const denied = await worker.fetch(unauthorized, ENV);

    expect(denied.status).toBe(401);
    expect(dataSources()).toBe(0);

    const accepted = await worker.fetch(
      rpcRequest(initializeRequest(), {
        "TQCCL-MCP-Force-Refresh": "unexpected",
      }),
      ENV,
    );
    expect(accepted.status).toBe(200);
    expect(accepted.headers.get(WORKER_VERSION_HEADER)).toBe(
      VERSION_ID,
    );
    expect(dataSources()).toBe(1);
  });

  it("đàm phán protocol cố định rồi liệt kê đủ tám tool ở request độc lập", async () => {
    const { worker } = workerWithCounters();
    const initialized = await worker.fetch(rpcRequest(initializeRequest()), ENV);
    expect(initialized.status).toBe(200);
    const initializeBody = (await initialized.json()) as {
      result: { protocolVersion: string };
    };
    expect(initializeBody.result.protocolVersion).toBe("2025-11-25");

    const listed = await worker.fetch(
      rpcRequest(
        {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/list",
          params: {},
        },
        { "MCP-Protocol-Version": "2025-11-25" },
      ),
      ENV,
    );
    expect(listed.status).toBe(200);
    const listBody = (await listed.json()) as {
      result: { tools: Array<{ name: string }> };
    };
    expect(listBody.result.tools).toHaveLength(7);
    expect(listBody.result.tools.every(({ name }) => name.startsWith("tqccl_"))).toBe(
      true,
    );
  });

  it("từ chối initialize dùng protocol cũ, malformed hoặc chưa biết", async () => {
    const { worker } = workerWithCounters();
    for (const protocolVersion of [
      "2024-11-05",
      "garbage",
      "2099-01-01",
    ]) {
      const body = initializeRequest();
      body.params.protocolVersion = protocolVersion;
      const response = await worker.fetch(rpcRequest(body), ENV);

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: { code: "PROTOCOL_VERSION_NOT_SUPPORTED" },
      });
    }
  });

  it("từ chối initialize sai protocol nằm trong JSON-RPC batch", async () => {
    const { worker, dataSources } = workerWithCounters();
    const body = initializeRequest();
    body.params.protocolVersion = "garbage";

    const response = await worker.fetch(rpcRequest([body]), ENV);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { code: "PROTOCOL_VERSION_NOT_SUPPORTED" },
    });
    expect(dataSources()).toBe(0);
  });

  it("cho phép hai managed client độc lập gửi bearer bằng custom header", async () => {
    const { worker } = workerWithCounters();
    const clients = [1, 2].map((ordinal) => {
      const transport = new StreamableHTTPClientTransport(
        new URL("https://mcp.example/mcp"),
        {
          requestInit: {
            headers: { Authorization: `Bearer ${TOKEN}` },
          },
          fetch: (input, init) =>
            worker.fetch(new Request(input, init), ENV),
        },
      );
      const client = new Client({
        name: `managed-client-${ordinal}`,
        version: "1.0.0",
      });
      return { client, transport };
    });

    try {
      await Promise.all(
        clients.map(({ client, transport }) =>
          client.connect(transport as unknown as Transport),
        ),
      );
      expect(clients.map(({ transport }) => transport.protocolVersion)).toEqual(
        ["2025-11-25", "2025-11-25"],
      );
      const results = await Promise.all(
        clients.map(({ client }) => client.listTools()),
      );
      expect(results.map(({ tools }) => tools.length)).toEqual([7, 7]);
    } finally {
      await Promise.all(clients.map(({ client }) => client.close()));
    }
  });

  it("đóng băng matrix protocol và GET/DELETE stateless", async () => {
    const { worker } = workerWithCounters();
    for (const protocolVersion of [undefined, "2025-06-18"]) {
      const response = await worker.fetch(
        rpcRequest(
          {
            jsonrpc: "2.0",
            id: 3,
            method: "tools/list",
            params: {},
          },
          protocolVersion === undefined
            ? {}
            : { "MCP-Protocol-Version": protocolVersion },
        ),
        ENV,
      );
      expect(response.status).toBe(200);
    }
    for (const protocolVersion of ["invalid", "2026-99-99"]) {
      const response = await worker.fetch(
        rpcRequest(
          {
            jsonrpc: "2.0",
            id: 3,
            method: "tools/list",
            params: {},
          },
          { "MCP-Protocol-Version": protocolVersion },
        ),
        ENV,
      );
      expect(response.status).toBe(400);
    }

    for (const method of ["GET", "DELETE"]) {
      const response = await worker.fetch(
        new Request("https://mcp.example/mcp", {
          method,
          headers: { Authorization: `Bearer ${TOKEN}` },
        }),
        ENV,
      );
      expect(response.status).toBe(405);
    }
  });

  it("trả 429 sau auth và không đọc body hoặc tạo data source", async () => {
    const rateLimiter = new TokenRateLimiter({
      maxRequests: 1,
      windowMs: 60_000,
    });
    let dataSources = 0;
    const worker = createWorker({
      createDataSource() {
        dataSources += 1;
        return new FilesystemDataSource({ dataRoot: fixtureRoot });
      },
      rateLimiter,
      inFlightLimiter: new InFlightLimiter(1),
      now: () => Date.parse("2026-07-28T12:00:00.000Z"),
    });
    const first = await worker.fetch(rpcRequest(initializeRequest()), ENV);
    expect(first.status).toBe(200);

    const rejected = rpcRequest(initializeRequest());
    const response = await worker.fetch(rejected, ENV);
    expect(response.status).toBe(429);
    expect(rejected.bodyUsed).toBe(false);
    expect(dataSources).toBe(1);
  });

  it("giữ in-flight ceiling trước lần đọc body và phục hồi sau khi drain", async () => {
    const snapshot = await new FilesystemDataSource({
      dataRoot: fixtureRoot,
    }).load();
    let releaseLoad!: () => void;
    const loadGate = new Promise<void>((resolve) => {
      releaseLoad = resolve;
    });
    let enteredLoad!: () => void;
    const entered = new Promise<void>((resolve) => {
      enteredLoad = resolve;
    });
    const worker = createWorker({
      createDataSource: () => ({
        async load() {
          enteredLoad();
          await loadGate;
          return snapshot;
        },
      }),
      rateLimiter: new TokenRateLimiter({
        maxRequests: 10,
        windowMs: 60_000,
      }),
      inFlightLimiter: new InFlightLimiter(1),
    });
    const first = worker.fetch(
      rpcRequest({
        jsonrpc: "2.0",
        id: 10,
        method: "tools/call",
        params: {
          name: "tqccl_get_playbook",
          arguments: { intent: "lookup" },
        },
      }),
      ENV,
    );
    await entered;

    const rejectedRequest = rpcRequest(initializeRequest());
    const rejected = await worker.fetch(rejectedRequest, ENV);
    expect(rejected.status).toBe(429);
    expect(rejectedRequest.bodyUsed).toBe(false);

    releaseLoad();
    expect((await first).status).toBe(200);
    expect(
      (
        await worker.fetch(rpcRequest(initializeRequest()), ENV)
      ).status,
    ).toBe(200);
  });

  it("chặn response vượt giới hạn cấu hình", async () => {
    const { worker } = workerWithCounters();
    const response = await worker.fetch(rpcRequest(initializeRequest()), {
      ...ENV,
      TQCCL_MCP_MAX_RESULT_BYTES: "10",
    });
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      error: { code: "RESULT_TOO_LARGE" },
    });
  });

  it("NEXT quá NOT_AFTER: CURRENT vẫn 200, NEXT 401, thiếu CURRENT vẫn 503", async () => {
    const NEXT = "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
    const rotated = {
      ...ENV,
      TQCCL_MCP_BEARER_NEXT: NEXT,
      TQCCL_MCP_NEXT_TOKEN_NOT_AFTER: "2026-07-28T11:49:00.000Z",
    } as WorkerEnvironment;

    const current = await workerWithCounters().worker.fetch(
      rpcRequest(initializeRequest()),
      rotated,
    );
    expect(current.status).toBe(200);

    const next = await workerWithCounters().worker.fetch(
      rpcRequest(initializeRequest(), { Authorization: `Bearer ${NEXT}` }),
      rotated,
    );
    expect(next.status).toBe(401);
    expect(await next.json()).toEqual({ error: { code: "UNAUTHORIZED" } });

    const withoutCurrent: Partial<WorkerEnvironment> = { ...rotated };
    delete withoutCurrent.TQCCL_MCP_BEARER_CURRENT;
    const missingCurrent = await workerWithCounters().worker.fetch(
      rpcRequest(initializeRequest()),
      withoutCurrent as WorkerEnvironment,
    );
    expect(missingCurrent.status).toBe(503);
    expect(await missingCurrent.json()).toEqual({
      error: { code: "SERVICE_MISCONFIGURED" },
    });
  });
});
