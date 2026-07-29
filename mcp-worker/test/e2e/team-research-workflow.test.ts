import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { FilesystemDataSource } from "../../src/data/filesystem-data-source.js";
import { createResearchHandlers } from "../../src/research/research-handlers.js";

const fixtureRoot = fileURLToPath(
  new URL("../fixtures/release-snapshot", import.meta.url),
);

describe("golden team research workflow", () => {
  it("normalize → binding → coexist deterministic và fail closed khi state đổi", async () => {
    const handlers = createResearchHandlers({
      dataSource: new FilesystemDataSource({ dataRoot: fixtureRoot }),
    });
    const normalized = await handlers.call("tqccl_normalize_entities", {
      observations: [
        {
          observationId: "hero-1",
          entityKind: "hero",
          canonicalId: "hero:tuong-a",
          familyId: "hero-family:tuong-a",
          displayName: "Tướng A",
          evidence: {
            sourceScope: "currentTurnImage",
            batchId: "golden",
            imageOrdinal: 0,
          },
        },
        {
          observationId: "tactic-1",
          entityKind: "tactic",
          canonicalId: "tactic:chien-phap-a",
          displayName: "Chiến Pháp A",
          evidence: {
            sourceScope: "currentTurnImage",
            batchId: "golden",
            imageOrdinal: 0,
          },
        },
      ],
    });
    expect(normalized.reviewRequired).toBe(false);

    const request = {
      expectedWorkflowVersion: normalized.workflowVersion,
      canonicalState: normalized.canonicalState,
      confirmationBinding: normalized.confirmationBinding,
      maxTeams: 1,
    };
    const first = await handlers.call("tqccl_recommend_coexist", request);
    const second = await handlers.call("tqccl_recommend_coexist", request);

    expect(second).toEqual(first);
    expect(first.releaseId).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(first.workflowVersion).toContain(first.releaseId);
    expect(first.truncated).toBe(false);
    expect(first.provenance.length).toBeGreaterThan(0);
    await expect(
      handlers.call("tqccl_recommend_coexist", {
        ...request,
        canonicalState: {
          ...normalized.canonicalState,
          heroes: [],
        },
      }),
    ).rejects.toMatchObject({ code: "CONFIRMATION_REQUIRED" });
  });
});
