import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { FilesystemDataSource } from "../../src/data/filesystem-data-source.js";
import type { DataSource } from "../../src/data/data-source.js";
import {
  RESEARCH_CONTRACTS,
  RESEARCH_TOOL_NAMES,
  type ResearchToolName,
} from "../../src/research/research-contracts.js";
import {
  ResearchHandlerError,
  createResearchHandlers,
} from "../../src/research/research-handlers.js";

const fixtureRoot = fileURLToPath(
  new URL("../fixtures/release-snapshot", import.meta.url),
);

function fixtureSource(): DataSource {
  return new FilesystemDataSource({ dataRoot: fixtureRoot });
}

async function confirmedFixtureFlow(source = fixtureSource()) {
  const handlers = createResearchHandlers({ dataSource: source });
  const normalized = await handlers.call("tqccl_normalize_entities", {
    observations: [
      {
        observationId: "hero",
        entityKind: "hero",
        canonicalId: "hero:tuong-a",
        familyId: "hero-family:tuong-a",
        displayName: "Tướng A",
        evidence: {
          sourceScope: "currentTurnImage",
          batchId: "fixture",
        },
      },
      {
        observationId: "tactic",
        entityKind: "tactic",
        canonicalId: "tactic:chien-phap-a",
        displayName: "Chiến Pháp A",
        evidence: {
          sourceScope: "currentTurnImage",
          batchId: "fixture",
        },
      },
    ],
  });
  return { handlers, normalized };
}

describe("research runtime contracts", () => {
  it("owns exactly eight unique prefixed names and shared schema objects", () => {
    expect(RESEARCH_TOOL_NAMES).toEqual([
      "tqccl_get_data_version",
      "tqccl_normalize_entities",
      "tqccl_search",
      "tqccl_get_team",
      "tqccl_match_team",
      "tqccl_recommend_team",
      "tqccl_recommend_coexist",
      "tqccl_suggest_replacements",
    ]);
    expect(new Set(RESEARCH_TOOL_NAMES).size).toBe(8);
    for (const name of RESEARCH_TOOL_NAMES) {
      expect(RESEARCH_CONTRACTS[name].input).toBeDefined();
      expect(RESEARCH_CONTRACTS[name].output).toBeDefined();
    }
  });

  it("returns manifest provenance and observed counts without constants", async () => {
    const handlers = createResearchHandlers({ dataSource: fixtureSource() });
    const result = await handlers.call("tqccl_get_data_version", {});

    expect(result.releaseId).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(result.dataVersion).toMatch(/^data:[a-f0-9]{12}$/);
    expect(result.workflowVersion).toContain(result.releaseId);
    expect(result.artifacts.map(({ name }) => name)).toEqual([
      "teams",
      "team-tier",
      "coexist",
      "heroes-dict",
      "tactics",
      "books-dict",
    ]);
    expect(result.artifacts[0]?.count).toBe(1);
  });

  it("normalizes and recommends only with the exact confirmed workflow binding", async () => {
    const { handlers, normalized } = await confirmedFixtureFlow();

    expect(normalized.reviewRequired).toBe(false);
    expect(normalized.confirmationBinding.workflowVersion).toBe(
      normalized.workflowVersion,
    );
    const recommended = await handlers.call("tqccl_recommend_team", {
      expectedWorkflowVersion: normalized.workflowVersion,
      canonicalState: normalized.canonicalState,
      confirmationBinding: normalized.confirmationBinding,
      maxTeams: 1,
    });
    expect(
      (recommended.teams[0]?.team as { id?: string } | undefined)?.id,
    ).toBe("team-a");

    await expect(
      handlers.call("tqccl_recommend_team", {
        expectedWorkflowVersion: "workflow:stale",
        canonicalState: normalized.canonicalState,
        confirmationBinding: normalized.confirmationBinding,
      }),
    ).rejects.toMatchObject({ code: "WORKFLOW_VERSION_CHANGED" });

    await expect(
      handlers.call("tqccl_recommend_team", {
        expectedWorkflowVersion: normalized.workflowVersion,
        canonicalState: {
          ...normalized.canonicalState,
          heroes: [],
        },
        confirmationBinding: normalized.confirmationBinding,
      }),
    ).rejects.toMatchObject({ code: "CONFIRMATION_REQUIRED" });
  });

  it("blocks recommendation when public normalization reports material ambiguity", async () => {
    const handlers = createResearchHandlers({ dataSource: fixtureSource() });
    const normalized = await handlers.call("tqccl_normalize_entities", {
      observations: [
        {
          observationId: "ambiguous-hero",
          entityKind: "hero",
          observedText: "Tướng chưa rõ",
          reviewRequired: true,
          candidates: ["hero:tuong-a", "hero:tuong-b"],
          evidence: {
            sourceScope: "currentTurnImage",
            batchId: "ambiguous-fixture",
          },
        },
      ],
    });

    expect(normalized.reviewRequired).toBe(true);
    await expect(
      handlers.call("tqccl_recommend_team", {
        expectedWorkflowVersion: normalized.workflowVersion,
        canonicalState: normalized.canonicalState,
        confirmationBinding: normalized.confirmationBinding,
      }),
    ).rejects.toMatchObject({ code: "CONFIRMATION_REQUIRED" });
  });

  it("searches, paginates and rejects cursor reuse after workflow changes", async () => {
    const source = fixtureSource();
    const snapshot = await source.load();
    const handlers = createResearchHandlers({ dataSource: source });
    const first = await handlers.call("tqccl_search", {
      query: "",
      limit: 2,
    });

    expect(first.items).toHaveLength(2);
    expect(first.truncated).toBe(true);
    expect(first.nextCursor).toBeTypeOf("string");
    const second = await handlers.call("tqccl_search", {
      query: "",
      limit: 2,
      cursor: first.nextCursor,
      expectedWorkflowVersion: first.workflowVersion,
    });
    expect(second.items).not.toEqual(first.items);

    const changedSource: DataSource = {
      async load() {
        return {
          ...snapshot,
          releaseId:
            "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          dataVersion: snapshot.dataVersion,
        };
      },
    };
    const changedVersion = await createResearchHandlers({
      dataSource: changedSource,
    }).call("tqccl_get_data_version", {});
    expect(changedVersion.dataVersion).toBe(first.dataVersion);
    expect(changedVersion.releaseId).not.toBe(first.releaseId);
    expect(changedVersion.workflowVersion).not.toBe(first.workflowVersion);
    await expect(
      createResearchHandlers({ dataSource: changedSource }).call(
        "tqccl_search",
        {
          query: "",
          cursor: first.nextCursor,
          expectedWorkflowVersion: first.workflowVersion,
        },
      ),
    ).rejects.toMatchObject({ code: "WORKFLOW_VERSION_CHANGED" });
  });

  it("returns bounded team detail and structured matches", async () => {
    const handlers = createResearchHandlers({ dataSource: fixtureSource() });
    const version = await handlers.call("tqccl_get_data_version", {});
    const detail = await handlers.call("tqccl_get_team", {
      teamId: "team-a",
      expectedWorkflowVersion: version.workflowVersion,
    });
    const matches = await handlers.call("tqccl_match_team", {
      expectedWorkflowVersion: version.workflowVersion,
      heroes: [
        {
          canonicalId: "hero:tuong-a",
          tacticIds: ["tactic:chien-phap-a"],
        },
      ],
      minHeroes: 1,
      limit: 5,
    });

    expect(detail.team.id).toBe("team-a");
    expect(detail.provenance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ artifact: "teams", recordId: "team-a" }),
      ]),
    );
    expect(matches.matches[0]?.team.id).toBe("team-a");
  });

  it("truncates a future-field-heavy team deterministically below the byte ceiling", async () => {
    const base = await fixtureSource().load();
    const largeTeam = {
      ...base.artifacts.teams[0],
      future: Array.from({ length: 100 }, (_, outer) =>
        Object.fromEntries(
          Array.from({ length: 100 }, (_, inner) => [
            `field-${inner}`,
            `${outer}-${inner}-${"x".repeat(256)}`,
          ]),
        ),
      ),
    };
    const source: DataSource = {
      async load() {
        return {
          ...base,
          artifacts: {
            ...base.artifacts,
            teams: [largeTeam],
          },
        };
      },
    };
    const handlers = createResearchHandlers({ dataSource: source });
    const version = await handlers.call("tqccl_get_data_version", {});
    const detail = await handlers.call("tqccl_get_team", {
      teamId: "team-a",
      expectedWorkflowVersion: version.workflowVersion,
    });

    expect(detail.truncated).toBe(true);
    expect(new TextEncoder().encode(JSON.stringify(detail)).byteLength).toBeLessThanOrEqual(
      64 * 1024,
    );
  });

  it("returns coexist reference only and curated replacements", async () => {
    const { handlers, normalized } = await confirmedFixtureFlow();
    const common = {
      expectedWorkflowVersion: normalized.workflowVersion,
      canonicalState: normalized.canonicalState,
      confirmationBinding: normalized.confirmationBinding,
    };
    const coexist = await handlers.call("tqccl_recommend_coexist", common);
    const replacements = await handlers.call("tqccl_suggest_replacements", {
      ...common,
      teamId: "team-a",
      tacticName: "Chiến Pháp A",
    });

    expect(coexist.warnings).toContain("coexist-reference-not-scored");
    expect(coexist.coexistReference).toHaveLength(1);
    expect(replacements.replacements).toEqual(["Chiến Pháp B"]);
    expect(replacements.warnings).toContain("mechanics-not-evaluated");
  });

  it("validates every successful result with its authoritative output schema", async () => {
    const { handlers, normalized } = await confirmedFixtureFlow();
    const requests = {
      tqccl_get_data_version: {},
      tqccl_normalize_entities: { observations: [] },
      tqccl_search: { query: "Tướng" },
      tqccl_get_team: {
        teamId: "team-a",
        expectedWorkflowVersion: normalized.workflowVersion,
      },
      tqccl_match_team: {
        expectedWorkflowVersion: normalized.workflowVersion,
        heroes: [{ canonicalId: "hero:tuong-a", tacticIds: [] }],
        minHeroes: 1,
      },
      tqccl_recommend_team: {
        expectedWorkflowVersion: normalized.workflowVersion,
        canonicalState: normalized.canonicalState,
        confirmationBinding: normalized.confirmationBinding,
      },
      tqccl_recommend_coexist: {
        expectedWorkflowVersion: normalized.workflowVersion,
        canonicalState: normalized.canonicalState,
        confirmationBinding: normalized.confirmationBinding,
      },
      tqccl_suggest_replacements: {
        expectedWorkflowVersion: normalized.workflowVersion,
        canonicalState: normalized.canonicalState,
        confirmationBinding: normalized.confirmationBinding,
        teamId: "team-a",
        tacticName: "Chiến Pháp A",
      },
    } as const;
    const call = handlers.call as (
      name: ResearchToolName,
      input: unknown,
    ) => Promise<unknown>;

    for (const name of RESEARCH_TOOL_NAMES) {
      const result = await call(name, requests[name]);
      expect(() => RESEARCH_CONTRACTS[name].output.parse(result)).not.toThrow();
    }
  });

  it("rejects oversized/invalid inputs and keeps public errors redacted", async () => {
    const handlers = createResearchHandlers({ dataSource: fixtureSource() });
    const version = await handlers.call("tqccl_get_data_version", {});

    await expect(
      handlers.call("tqccl_search", {
        query: "x".repeat(257),
      }),
    ).rejects.toBeInstanceOf(ResearchHandlerError);
    await expect(
      handlers.call("tqccl_get_team", {
        teamId: "team-a",
      } as never),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(
      handlers.call("tqccl_match_team", {
        heroes: [],
      } as never),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    const normalized = await handlers.call("tqccl_normalize_entities", {
      observations: [],
    });
    await expect(
      handlers.call("tqccl_recommend_team", {
        expectedWorkflowVersion: normalized.workflowVersion,
        canonicalState: {
          ...normalized.canonicalState,
          heroes: [
            {
              canonicalId: "hero:tuong-a",
              familyId: "hero-family:tuong-a",
              displayName: "Tướng A",
              evidence: [{ blob: "x".repeat(300_000) }],
            },
          ],
        },
        confirmationBinding: normalized.confirmationBinding,
      }),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(
      handlers.call("tqccl_normalize_entities", {
        observations: Array.from({ length: 100 }, (_, index) => ({
          observationId: `bounded-${index}`,
          entityKind: "hero" as const,
          observedText: `Chưa rõ ${index}`,
          evidence: {
            sourceScope: "currentTurnImage" as const,
            batchId: `bounded-${index}`,
          },
        })),
      }),
    ).resolves.toMatchObject({
      reviewRequired: true,
      truncated: false,
    });
    await expect(
      handlers.call("tqccl_normalize_entities", {
        observations: Array.from({ length: 100 }, (_, index) => ({
          observationId: `near-ceiling-${index}`,
          entityKind: "hero" as const,
          observedText: `Chưa rõ ${index} ${"x".repeat(140)}`,
          evidence: {
            sourceScope: "currentTurnImage" as const,
            batchId: `near-ceiling-${index}`,
          },
        })),
      }),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(
      handlers.call("tqccl_normalize_entities", {
        observations: Array.from({ length: 300 }, (_, index) => ({
          observationId: `oversized-${index}`,
          entityKind: "hero" as const,
          observedText: `Không rõ ${index} ${"x".repeat(120)}`,
          evidence: {
            sourceScope: "currentTurnImage" as const,
            batchId: `oversized-${index}`,
          },
        })),
      }),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(
      handlers.call("tqccl_get_team", {
        teamId: "../private/manifest.json",
        expectedWorkflowVersion: version.workflowVersion,
      }),
    ).rejects.toMatchObject({ code: "TEAM_NOT_FOUND" });

    try {
      await handlers.call("tqccl_get_team", {
        teamId: "../private/manifest.json",
        expectedWorkflowVersion: version.workflowVersion,
      });
    } catch (error) {
      expect(String(error)).not.toContain("manifest.json");
      expect(String(error)).not.toContain(fixtureRoot);
    }
  });
});
