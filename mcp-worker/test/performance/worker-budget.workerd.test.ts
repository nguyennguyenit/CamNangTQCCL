import { exports } from "cloudflare:workers";
import { canonicalHeroId, heroFamilyId } from "../../../js/hero-identity.js";
import { canonicalTacticId } from "../../../js/team-recommend-engine.js";
import { beforeAll, describe, expect, it } from "vitest";

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
    const cold = await callTool(2, "tqccl_get_playbook", { intent: "coexist" });
    const warm = await callTool(3, "tqccl_get_playbook", { intent: "coexist" });
    const found = await callTool(6, "tqccl_find_teams", { collection: "recommended", limit: 1 });
    const team = (found.result.items as Array<{ heroes: Array<{ nameVi: string; tactics: Array<{ vi: string }> }> }>)[0]!;
    const evidence = { sourceScope: "currentTurnImage", batchId: "worker-budget" };
    const normalized = await callTool(4, "tqccl_normalize_entities", {
      observations: [
        ...team.heroes.map((hero, index) => ({
          observationId: `hero-${index}`,
          entityKind: "hero",
          canonicalId: canonicalHeroId(hero.nameVi),
          familyId: heroFamilyId(hero.nameVi),
          displayName: hero.nameVi,
          evidence,
        })),
        ...team.heroes.flatMap((hero, index) =>
          hero.tactics.map((tactic, slot) => ({
            observationId: `tactic-${index}-${slot}`,
            entityKind: "tactic",
            canonicalId: canonicalTacticId(tactic.vi),
            displayName: tactic.vi,
            evidence,
          })),
        ),
      ],
    });
    const seasonSelection = warm.result.seasonSelection as { sourceSeasonId: string };
    const recommendation = await callTool(5, "tqccl_recommend_teams", {
      sourceSeasonId: seasonSelection.sourceSeasonId,
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
