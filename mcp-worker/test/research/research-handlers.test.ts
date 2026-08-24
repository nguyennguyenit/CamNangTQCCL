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
import { toScrubSafeDigest } from "../../src/domain/digest-encoding.js";

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
    // workflowVersion nhúng bản mã hoá scrub-safe của cùng releaseId đó.
    expect(result.workflowVersion).toContain(toScrubSafeDigest(result.releaseId));
    expect(result.workflowVersion).not.toMatch(/[a-fA-F0-9]{64,}/u);
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

  it("hides retired Đô Úy teams from every team-returning workflow", async () => {
    const base = await fixtureSource().load();
    const hiddenTeam = {
      id: "do-uy-hidden",
      source: "do-uy",
      name: "Đội Đô Úy ẩn",
      heroes: [
        {
          name: "Tướng A",
          tactics: [
            {
              name: "Chiến Pháp A",
              alternatives: ["Chiến Pháp B"],
            },
          ],
          books: [{ name: "Binh Thư A" }],
        },
      ],
    };
    const source: DataSource = {
      async load() {
        return {
          ...base,
          artifacts: {
            ...base.artifacts,
            teams: [...base.artifacts.teams, hiddenTeam],
            "team-tier": [
              ...base.artifacts["team-tier"],
              {
                teamId: hiddenTeam.id,
                rankings: [
                  {
                    tier: "T0",
                    source: "retired-season",
                    updatedAt: "2026-08-25",
                  },
                ],
              },
            ],
          },
        };
      },
    };
    const { handlers, normalized } = await confirmedFixtureFlow(source);
    const expectedWorkflowVersion = normalized.workflowVersion;
    const canonicalRequest = {
      expectedWorkflowVersion,
      canonicalState: normalized.canonicalState,
      confirmationBinding: normalized.confirmationBinding,
    };

    const search = await handlers.call("tqccl_search", {
      query: "",
      kinds: ["team"],
      limit: 10,
    });
    expect(search.items.map(({ recordId }) => recordId)).toEqual(["team-a"]);
    await expect(
      handlers.call("tqccl_get_team", {
        teamId: hiddenTeam.id,
        expectedWorkflowVersion,
      }),
    ).rejects.toMatchObject({ code: "TEAM_NOT_FOUND" });

    const matches = await handlers.call("tqccl_match_team", {
      expectedWorkflowVersion,
      heroes: [
        {
          canonicalId: "hero:tuong-a",
          tacticIds: ["tactic:chien-phap-a"],
        },
      ],
      minHeroes: 1,
      limit: 10,
    });
    expect(matches.matches.map(({ team }) => team.id)).toEqual(["team-a"]);

    const recommendation = await handlers.call(
      "tqccl_recommend_team",
      canonicalRequest,
    );
    const coexist = await handlers.call(
      "tqccl_recommend_coexist",
      canonicalRequest,
    );
    expect(
      recommendation.teams.every(
        ({ team }) => (team as { id?: unknown }).id !== hiddenTeam.id,
      ),
    ).toBe(true);
    expect(
      coexist.teams.every(
        ({ team }) => (team as { id?: unknown }).id !== hiddenTeam.id,
      ),
    ).toBe(true);
    await expect(
      handlers.call("tqccl_suggest_replacements", {
        ...canonicalRequest,
        teamId: hiddenTeam.id,
        tacticName: "Chiến Pháp A",
      }),
    ).rejects.toMatchObject({ code: "TEAM_NOT_FOUND" });
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

describe("tqccl_search tolerates stringified arguments from the LLM boundary", () => {
  async function search(input: Record<string, unknown>) {
    const handlers = createResearchHandlers({ dataSource: fixtureSource() });
    // Cố tình gửi kiểu lỏng: đây chính là hình dạng args mà model gửi tới.
    return handlers.call(
      "tqccl_search",
      input as Parameters<typeof handlers.call<"tqccl_search">>[1],
    );
  }

  it("accepts limit as a number and as a numeric string", async () => {
    const typed = await search({ query: "Tướng", limit: 5 });
    const stringified = await search({ query: "Tướng", limit: "5" });

    expect(stringified.items).toEqual(typed.items);
    expect(stringified.truncated).toBe(typed.truncated);
  });

  it("accepts kinds as an array and as a JSON-encoded array", async () => {
    const typed = await search({ query: "Tướng", kinds: ["hero"] });
    const stringified = await search({ query: "Tướng", kinds: '["hero"]' });

    expect(stringified.items).toEqual(typed.items);
    expect(typed.items.length).toBeGreaterThan(0);
  });

  it("accepts both fields stringified together", async () => {
    const typed = await search({ query: "Tướng", kinds: ["hero"], limit: 5 });
    const stringified = await search({
      query: "Tướng",
      kinds: '["hero"]',
      limit: "5",
    });

    expect(stringified.items).toEqual(typed.items);
  });

  it("leaves well-typed input byte-for-byte unchanged", async () => {
    const before = await search({ query: "Tướng", kinds: ["hero"], limit: 3 });
    const after = await search({ query: "Tướng", kinds: ["hero"], limit: 3 });

    expect(after).toEqual(before);
    expect(before.dataVersion).toMatch(/^data:[a-f0-9]{12}$/u);
  });

  describe("still rejects genuinely invalid input", () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ["non-numeric limit", { query: "x", limit: "abc" }],
      ["empty-string limit", { query: "x", limit: "" }],
      ["limit below range", { query: "x", limit: 0 }],
      ["limit above range", { query: "x", limit: 51 }],
      ["stringified limit above range", { query: "x", limit: "51" }],
      ["fractional limit", { query: "x", limit: 5.5 }],
      ["unknown kind", { query: "x", kinds: ["bogus"] }],
      ["stringified unknown kind", { query: "x", kinds: '["bogus"]' }],
      ["kinds that is not JSON", { query: "x", kinds: "khong-phai-json" }],
      ["stringified object instead of array", { query: "x", kinds: '{"a":1}' }],
      [
        "more kinds than allowed",
        { query: "x", kinds: '["hero","tactic","team","book","hero"]' },
      ],
    ];

    for (const [label, input] of cases) {
      it(label, async () => {
        await expect(search(input)).rejects.toMatchObject({
          code: "INVALID_REQUEST",
        });
      });
    }
  });
});

describe("tqccl_search coercion stays narrow", () => {
  async function search(input: Record<string, unknown>) {
    const handlers = createResearchHandlers({ dataSource: fixtureSource() });
    // Cố tình gửi kiểu lỏng: đây chính là hình dạng args mà model gửi tới.
    return handlers.call(
      "tqccl_search",
      input as Parameters<typeof handlers.call<"tqccl_search">>[1],
    );
  }

  it("treats an omitted limit as absent, not as NaN", async () => {
    const omitted = await search({ query: "Tướng" });

    expect(omitted.items.length).toBeGreaterThan(0);
  });

  // Các dạng mà z.coerce.number() sẽ nuốt thành số hợp lệ; agent cần lỗi rõ
  // ràng ở đây chứ không phải một trang kết quả sai âm thầm.
  describe("refuses values that only look numeric", () => {
    const cases: Array<[string, unknown]> = [
      ["boolean true", true],
      ["array wrapping a number", ["3"]],
      ["hexadecimal string", "0x10"],
      ["exponent string", "1e1"],
      ["padded string", " 5 "],
      ["negative string", "-5"],
    ];

    for (const [label, limit] of cases) {
      it(label, async () => {
        await expect(search({ query: "x", limit })).rejects.toMatchObject({
          code: "INVALID_REQUEST",
        });
      });
    }
  });
});

describe("validation errors name the offending fields", () => {
  async function invalid(name: ResearchToolName, input: unknown) {
    const handlers = createResearchHandlers({ dataSource: fixtureSource() });
    const call = handlers.call as (
      name: ResearchToolName,
      input: unknown,
    ) => Promise<unknown>;
    try {
      await call(name, input);
    } catch (error) {
      return error as ResearchHandlerError;
    }
    throw new Error(`${name} unexpectedly accepted the input`);
  }

  it("names a top-level field", async () => {
    const error = await invalid("tqccl_search", { query: "x", limit: "abc" });

    expect(error.code).toBe("INVALID_REQUEST");
    expect(error.fields).toContain("limit");
  });

  it("names a missing required field", async () => {
    const error = await invalid("tqccl_get_team", {
      expectedWorkflowVersion: "workflow:whatever",
    });

    expect(error.fields).toContain("teamId");
  });

  it("formats nested array paths readably", async () => {
    const error = await invalid("tqccl_match_team", {
      expectedWorkflowVersion: "workflow:whatever",
      heroes: [{ canonicalId: "hero:tuong-a", tacticIds: "not-an-array" }],
    });

    expect(error.fields).toContain("heroes[0].tacticIds");
  });

  it("caps the reported field list", async () => {
    const error = await invalid("tqccl_match_team", {
      expectedWorkflowVersion: 1,
      minHeroes: "abc",
      heroes: [
        { canonicalId: 1, tacticIds: 2 },
        { canonicalId: 3, tacticIds: 4 },
        { canonicalId: 5, tacticIds: 6 },
      ],
    });

    expect(error.fields.length).toBeLessThanOrEqual(5);
    expect(error.fields.length).toBeGreaterThan(1);
    expect(new Set(error.fields).size).toBe(error.fields.length);
  });

  it("mentions the fields in the public message", async () => {
    const error = await invalid("tqccl_search", { query: "x", limit: "abc" });

    expect(error.message).toContain("limit");
  });

  it("never echoes the submitted value", async () => {
    const sentinel = "SENTINEL_VALUE_XYZ";
    const error = await invalid("tqccl_search", {
      query: "x",
      limit: sentinel,
      cursor: sentinel,
    });

    expect(JSON.stringify({ ...error, message: error.message })).not.toContain(
      sentinel,
    );
    expect(error.message).not.toContain(sentinel);
    expect(error.fields.join(",")).not.toContain(sentinel);
  });

  it("leaves other error codes untouched", async () => {
    const handlers = createResearchHandlers({ dataSource: fixtureSource() });
    const version = await handlers.call("tqccl_get_data_version", {});

    await expect(
      handlers.call("tqccl_get_team", {
        teamId: "team-a",
        expectedWorkflowVersion: "workflow:stale",
      }),
    ).rejects.toMatchObject({
      code: "WORKFLOW_VERSION_CHANGED",
      message: "Phiên bản dữ liệu hoặc quy trình đã thay đổi.",
      fields: [],
    });
    await expect(
      handlers.call("tqccl_get_team", {
        teamId: "khong-ton-tai",
        expectedWorkflowVersion: version.workflowVersion,
      }),
    ).rejects.toMatchObject({
      code: "TEAM_NOT_FOUND",
      message: "Không tìm thấy đội hình.",
      fields: [],
    });
  });
});

describe("tqccl_search explains why a result matched", () => {
  const realDataRoot = fileURLToPath(new URL("../../../data", import.meta.url));

  async function searchReal(input: Record<string, unknown>) {
    const handlers = createResearchHandlers({
      dataSource: new FilesystemDataSource({ dataRoot: realDataRoot }),
    });
    return handlers.call(
      "tqccl_search",
      input as Parameters<typeof handlers.call<"tqccl_search">>[1],
    );
  }

  it("returns the nickname that matched, not just the display name", async () => {
    const result = await searchReal({
      query: "Hoàng Quan Thương",
      kinds: ["team"],
      limit: 5,
    });

    expect(result.items[0]).toMatchObject({
      canonicalId: "team:team-intro-2",
      displayName: "Vũ Tung Úc",
      matchedTerm: "Hoàng Quan Thương",
    });
  });

  it("handles a second nickname the same way", async () => {
    const result = await searchReal({
      query: "Độ Giang Thương",
      kinds: ["team"],
      limit: 5,
    });

    expect(result.items[0]).toMatchObject({
      canonicalId: "team:team-intro-3",
      displayName: "Vũ Tung Mông",
      matchedTerm: "Độ Giang Thương",
    });
  });

  it("echoes the display name when the primary name matched", async () => {
    const result = await searchReal({
      query: "Vũ Tung Mông",
      kinds: ["team"],
      limit: 1,
    });

    expect(result.items[0]?.matchedTerm).toBe(result.items[0]?.displayName);
  });

  it("omits matchedTerm when browsing the corpus", async () => {
    const result = await searchReal({ query: "", limit: 3 });

    expect(result.items).toHaveLength(3);
    for (const item of result.items) {
      expect(item).not.toHaveProperty("matchedTerm");
    }
  });

  it("survives its own output schema", async () => {
    const result = await searchReal({ query: "Hoàng Quan Thương", limit: 5 });

    expect(() =>
      RESEARCH_CONTRACTS.tqccl_search.output.parse(result),
    ).not.toThrow();
  });

  it("bounds a long matched term without turning a valid search into an internal error", async () => {
    const base = await fixtureSource().load();
    const longNickname = `Needle ${"x".repeat(300)}`;
    const source: DataSource = {
      async load() {
        return {
          ...base,
          artifacts: {
            ...base.artifacts,
            teams: [
              {
                ...base.artifacts.teams[0],
                nickname: longNickname,
              },
            ],
          },
        };
      },
    };
    const result = await createResearchHandlers({ dataSource: source }).call(
      "tqccl_search",
      { query: "Needle", kinds: ["team"], limit: 1 },
    );

    expect(result.items[0]?.matchedTerm).toBe(longNickname.slice(0, 256));
    expect(() =>
      RESEARCH_CONTRACTS.tqccl_search.output.parse(result),
    ).not.toThrow();
  });
});
