import { exports } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";

import { seedProductionR2 } from "../fixtures/seed-production-r2.workerd.js";

const TOKEN = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

function rpcRequest(id: number, method: string, params: unknown): Request {
  return new Request("https://mcp.example/mcp", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-11-25",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
}

async function callTool(
  id: number,
  name: string,
  arguments_: Record<string, unknown>,
) {
  const startedAt = performance.now();
  const response = await exports.default.fetch(
    rpcRequest(id, "tools/call", { name, arguments: arguments_ }),
  );
  const elapsedMs = performance.now() - startedAt;
  expect(response.status).toBe(200);
  const body = (await response.json()) as {
    result: {
      isError?: boolean;
      structuredContent: Record<string, unknown>;
    };
  };
  expect(body.result.isError).not.toBe(true);
  return { elapsedMs, result: body.result.structuredContent };
}

beforeAll(async () => {
  await seedProductionR2();
  const initialized = await exports.default.fetch(
    rpcRequest(1, "initialize", {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "budget-test", version: "1.0.0" },
    }),
  );
  expect(initialized.status).toBe(200);
});

describe("budget production-shaped trong workerd", () => {
  it("ghi nhận cold, warm và recommendation để chọn Workers Paid", async () => {
    const cold = await callTool(2, "tqccl_get_data_version", {});
    const warm = await callTool(3, "tqccl_get_data_version", {});
    const normalized = await callTool(4, "tqccl_normalize_entities", {
      observations: [],
    });
    const recommendation = await callTool(5, "tqccl_recommend_team", {
      expectedWorkflowVersion: normalized.result.workflowVersion,
      canonicalState: normalized.result.canonicalState,
      confirmationBinding: normalized.result.confirmationBinding,
      maxTeams: 10,
    });

    const metrics = {
      selectedTier: "paid",
      corpus: "production",
      coldVersionMs: Number(cold.elapsedMs.toFixed(2)),
      warmVersionMs: Number(warm.elapsedMs.toFixed(2)),
      recommendationMs: Number(recommendation.elapsedMs.toFixed(2)),
    };
    console.info("TQCCL_WORKER_BUDGET", JSON.stringify(metrics));

    expect(metrics.coldVersionMs).toBeLessThan(3_000);
    expect(metrics.warmVersionMs).toBeLessThan(1_000);
    expect(metrics.recommendationMs).toBeLessThan(1_000);
  });
});
