import { exports } from "cloudflare:workers";
import { canonicalTacticId } from "../../../js/team-recommend-engine.js";
import { beforeAll, describe, expect, it } from "vitest";
import roster from "../fixtures/normalize-full-roster.json";
import { buildCapObservations, rpcBody, type CapEntry } from "../fixtures/normalize-cap-request.js";

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
          canonicalId: hero.heroId,
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

// Ngưỡng workerd (#165): chưa đo được trên máy dev Windows (build assets production cần symlink); đặt ở trần 2 s của
// kế hoạch, siết lại bằng số đo CI đầu tiên (log TQCCL_WORKER_ROSTER_BUDGET) × ~3.
const ROSTER_NORMALIZE_BUDGET_MS = 2_000;
const ROSTER_RECOMMEND_BUDGET_MS = 2_000;

/** Tên catalog (hero + tactic) theo canonicalId, duyệt bằng tqccl_search trên dữ liệu production. */
async function catalogNames(): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  let id = 100;
  for (const kind of ["hero", "tactic"]) {
    let cursor: string | undefined;
    do {
      const page = await callTool(id++, "tqccl_search", { query: "", kinds: [kind], limit: 50, ...(cursor === undefined ? {} : { cursor }) });
      for (const item of page.result.items as Array<{ entityId: string; displayName: string }>) names.set(item.entityId, item.displayName);
      cursor = page.result.nextCursor as string | undefined;
    } while (cursor !== undefined);
  }
  return names;
}

describe("kho đầy đủ trong workerd (#165)", () => {
  it("normalize 238 mục bằng tên rồi recommend fullBox trong ngân sách; recommend trả tên catalog", async () => {
    const names = await catalogNames();
    const evidence = { sourceScope: "currentTurnImage", batchId: "roster-budget" };
    const all = [
      ...roster.heroes.map(({ canonicalId, redStars }, index) => ({ id: `h${index}`, kind: "hero", canonicalId, redStars })),
      ...roster.tactics.map((canonicalId, index) => ({ id: `t${index}`, kind: "tactic", canonicalId, redStars: undefined })),
    ];
    const byName = all.map(({ id, kind, canonicalId, redStars }) => ({
      observationId: id,
      entityKind: kind,
      observedText: names.get(canonicalId)!,
      ...(redStars === undefined ? {} : { redStars }),
      evidence,
    }));
    const first = await callTool(900, "tqccl_normalize_entities", { observations: byName });
    // Mục mơ hồ (tên gốc còn bản SP/40Y/CO): người chơi chọn bằng canonicalId, như tqccl-auto sau `pick`.
    const unresolved = new Set((first.result.canonicalState as { unresolved: Array<{ observationId: string }> }).unresolved.map((item) => item.observationId));
    const picked = byName.map((observation, index) => {
      if (!unresolved.has(observation.observationId)) return observation;
      const { observedText: _text, ...rest } = observation;
      return { ...rest, canonicalId: all[index]!.canonicalId };
    });
    const normalized = await callTool(901, "tqccl_normalize_entities", { observations: picked });
    expect(normalized.result.reviewRequired).toBe(false);
    const playbook = await callTool(902, "tqccl_get_playbook", { intent: "coexist" });
    const recommendation = await callTool(903, "tqccl_recommend_teams", {
      sourceSeasonId: (playbook.result.seasonSelection as { sourceSeasonId: string }).sourceSeasonId,
      expectedWorkflowVersion: normalized.result.workflowVersion,
      canonicalState: normalized.result.canonicalState,
      confirmationBinding: normalized.result.confirmationBinding,
      maxTeams: 10,
      fullBox: true,
    });
    console.info(
      "TQCCL_WORKER_ROSTER_BUDGET",
      JSON.stringify({ normalizeMs: Number(first.elapsedMs.toFixed(2)), recommendMs: Number(recommendation.elapsedMs.toFixed(2)) }),
    );
    expect(first.elapsedMs).toBeLessThan(ROSTER_NORMALIZE_BUDGET_MS);
    expect(recommendation.elapsedMs).toBeLessThan(ROSTER_RECOMMEND_BUDGET_MS);
    const heroes = (recommendation.result.portfolioTeams as Array<{ heroes: Array<{ canonicalId: string; displayName: string }> }>).flatMap((team) => team.heroes);
    expect(heroes.length).toBeGreaterThan(0);
    for (const hero of heroes) expect(hero.displayName).toBe(names.get(hero.canonicalId));
  });

  it("HTTP: request đúng trần byte, escape ASCII toàn bộ, kèm _meta → 200; hơn trần → INVALID_REQUEST; thân > 64 KiB → 413", async () => {
    const names = await catalogNames();
    const entries: CapEntry[] = [
      ...roster.heroes.map(({ canonicalId }) => ({ canonicalId, kind: "hero" as const, displayName: names.get(canonicalId)! })),
      ...roster.tactics.map((canonicalId) => ({ canonicalId, kind: "tactic" as const, displayName: names.get(canonicalId)! })),
    ];
    const post = (body: string) =>
      exports.default.fetch(
        new Request("https://mcp.example/mcp", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${TOKEN}`,
            "Content-Type": "application/json",
            Accept: "application/json, text/event-stream",
            "MCP-Protocol-Version": "2025-11-25",
          },
          body,
        }),
      );
    const atCap = rpcBody(buildCapObservations(entries, 60_770));
    expect(new TextEncoder().encode(atCap).byteLength).toBeLessThanOrEqual(65_536);
    const ok = await post(atCap);
    expect(ok.status).toBe(200);
    const okBody = (await ok.json()) as { result: { isError?: boolean } };
    expect(okBody.result.isError).not.toBe(true);

    const over = await post(rpcBody(buildCapObservations(entries, 60_771)));
    expect(over.status).toBe(200);
    const overBody = (await over.json()) as { result: { isError?: boolean; structuredContent: { error: { code: string } } } };
    expect(overBody.result.isError).toBe(true);
    expect(overBody.result.structuredContent.error.code).toBe("INVALID_REQUEST");

    const huge = await post(rpcBody(buildCapObservations(entries, 60_770)).padEnd(65_537, " "));
    expect(huge.status).toBe(413);
  });
});
