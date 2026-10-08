import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { DataSource } from "../../src/data/data-source.js";
import { FilesystemDataSource } from "../../src/data/filesystem-data-source.js";
import { toScrubSafeDigest } from "../../src/domain/digest-encoding.js";
import {
  RESEARCH_CONTRACTS,
  RESEARCH_TOOL_NAMES,
  type ResearchToolName,
} from "../../src/research/research-contracts.js";
import { ResearchHandlerError, createResearchHandlers } from "../../src/research/research-handlers.js";
import { realHandlers } from "../fixtures/real-handlers.js";

const fixtureRoot = fileURLToPath(new URL("../fixtures/release-snapshot", import.meta.url));
const realDataRoot = fileURLToPath(new URL("../../../data", import.meta.url));

function fixtureSource(): DataSource {
  return new FilesystemDataSource({ dataRoot: fixtureRoot });
}

const call = (handlers: ReturnType<typeof createResearchHandlers>) =>
  handlers.call as (name: ResearchToolName, input: unknown) => Promise<unknown>;

describe("research runtime contracts", () => {
  it("owns exactly seven unique prefixed names and shared schema objects", () => {
    expect(RESEARCH_TOOL_NAMES).toEqual([
      "tqccl_get_playbook",
      "tqccl_search",
      "tqccl_get_entity",
      "tqccl_find_teams",
      "tqccl_get_team",
      "tqccl_normalize_entities",
      "tqccl_recommend_teams",
    ]);
    expect(new Set(RESEARCH_TOOL_NAMES).size).toBe(7);
    for (const name of RESEARCH_TOOL_NAMES) {
      expect(RESEARCH_CONTRACTS[name].input).toBeDefined();
      expect(RESEARCH_CONTRACTS[name].output).toBeDefined();
    }
  });

  it("returns manifest provenance from the playbook without hard-coded counts", async () => {
    const handlers = createResearchHandlers({ dataSource: fixtureSource() });
    const snapshot = await fixtureSource().load();
    const playbook = await handlers.call("tqccl_get_playbook", { intent: "lookup" });
    expect(playbook.releaseId).toBe(snapshot.releaseId);
    expect(playbook.dataVersion).toBe(snapshot.dataVersion);
    expect(playbook.manifestVersion).toBe(snapshot.manifest.schemaVersion);
    expect(playbook.workflowVersion).toMatch(/^workflow:sha256b64:[A-Za-z0-9_-]{43}:build:sha256b64:/u);
    expect(playbook.workflowVersion).toContain(toScrubSafeDigest(snapshot.releaseId));
    expect(playbook.capabilities).toMatchObject({ catalog: false, reference: false, recommend: false });
  });

  it("normalizes observations and binds the result to the workflow", async () => {
    const handlers = createResearchHandlers({ dataSource: fixtureSource() });
    const normalized = await handlers.call("tqccl_normalize_entities", {
      observations: [
        {
          observationId: "hero",
          entityKind: "hero",
          canonicalId: "hero:tuong-a",
          familyId: "hero-family:tuong-a",
          displayName: "Tướng A",
          evidence: { sourceScope: "currentTurnImage", batchId: "fixture" },
        },
      ],
    });
    expect(normalized.canonicalState.heroes).toHaveLength(1);
    expect(normalized.confirmationBinding.workflowVersion).toBe(normalized.workflowVersion);
    expect(normalized.reviewRequired).toBe(false);
  });

  it("hides retired Đô Úy teams from the engine collection", async () => {
    const base = await fixtureSource().load();
    const hiddenTeam = {
      id: "do-uy-hidden",
      source: "do-uy",
      name: "Đội Đô Úy ẩn",
      heroes: [{ name: "Tướng A", tactics: [{ name: "Chiến Pháp A", alternatives: ["Chiến Pháp B"] }], books: [{ name: "Binh Thư A" }] }],
    };
    const source: DataSource = {
      async load() {
        return {
          ...base,
          artifacts: {
            ...base.artifacts,
            teams: [...base.artifacts.teams, hiddenTeam],
            "team-tier": [...base.artifacts["team-tier"], { teamId: hiddenTeam.id, rankings: [{ tier: "T0", source: "retired-season", updatedAt: "2026-08-25" }] }],
          },
        };
      },
    };
    const handlers = createResearchHandlers({ dataSource: source });
    const listed = await handlers.call("tqccl_find_teams", { collection: "engine", limit: 10 });
    expect(listed.items.map((item) => item.reference.teamId)).toEqual(["team-a"]);
    await expect(handlers.call("tqccl_get_team", { reference: { collection: "engine", teamId: hiddenTeam.id } })).rejects.toMatchObject({ code: "REFERENCE_NOT_FOUND" });
    const matches = await handlers.call("tqccl_find_teams", {
      collection: "engine",
      heroes: [{ canonicalId: "hero:tuong-a", tacticIds: ["tactic:chien-phap-a"] }],
      minHeroes: 1,
      limit: 10,
    });
    expect(matches.items.map((item) => item.reference.teamId)).toEqual(["team-a"]);
    const search = await handlers.call("tqccl_search", { query: "" }).catch((error: ResearchHandlerError) => error);
    expect(search).toMatchObject({ code: "CAPABILITY_UNAVAILABLE" });
  });

  it("validates every successful result with its authoritative output schema", async () => {
    const handlers = realHandlers();
    const playbook = await handlers.call("tqccl_get_playbook", { intent: "lookup" });
    const found = await handlers.call("tqccl_find_teams", { collection: "recommended", limit: 1 });
    const hero = (await handlers.call("tqccl_search", { query: "", kinds: ["hero"], limit: 1 })).items[0]!;
    const requests: Partial<Record<ResearchToolName, unknown>> = {
      tqccl_get_playbook: { intent: "lookup" },
      tqccl_normalize_entities: { observations: [] },
      tqccl_search: { query: "Tướng" },
      tqccl_get_entity: { entityId: hero.entityId },
      tqccl_find_teams: { collection: "other" },
      tqccl_get_team: { reference: found.items[0]!.reference, expectedWorkflowVersion: playbook.workflowVersion },
    };
    for (const [name, input] of Object.entries(requests)) {
      const result = await call(handlers)(name as ResearchToolName, input);
      expect(() => RESEARCH_CONTRACTS[name as ResearchToolName].output.parse(result), name).not.toThrow();
    }
  });

  it("rejects oversized/invalid inputs and keeps public errors redacted", async () => {
    const handlers = realHandlers();
    await expect(handlers.call("tqccl_search", { query: "x".repeat(257) })).rejects.toBeInstanceOf(ResearchHandlerError);
    await expect(handlers.call("tqccl_get_team", {} as never)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(handlers.call("tqccl_find_teams", { collection: "recommended", heroes: Array.from({ length: 21 }, () => ({ canonicalId: "hero:a", tacticIds: [] })) })).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(
      handlers.call("tqccl_normalize_entities", {
        observations: Array.from({ length: 300 }, (_, index) => ({
          observationId: `oversized-${index}`,
          entityKind: "hero" as const,
          observedText: `Không rõ ${index} ${"x".repeat(120)}`,
          evidence: { sourceScope: "currentTurnImage" as const, batchId: `oversized-${index}` },
        })),
      }),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    const failure = await handlers
      .call("tqccl_get_team", { reference: { collection: "recommended", sourceConfigId: "../private/manifest.json" } })
      .catch((error: unknown) => error);
    expect(failure).toMatchObject({ code: "REFERENCE_NOT_FOUND" });
    expect(String(failure)).not.toContain("manifest.json");
    expect(String(failure)).not.toContain(fixtureRoot);
  });
});

describe("tqccl_search tolerates stringified arguments from the LLM boundary", () => {
  const search = (input: Record<string, unknown>) => realHandlers().call("tqccl_search", input as never);

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
    const stringified = await search({ query: "Tướng", kinds: '["hero"]', limit: "5" });
    expect(stringified.items).toEqual(typed.items);
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
      ["boolean limit", { query: "x", limit: true }],
      ["array wrapping a number", { query: "x", limit: ["3"] }],
      ["hexadecimal string", { query: "x", limit: "0x10" }],
      ["exponent string", { query: "x", limit: "1e1" }],
      ["padded string", { query: "x", limit: " 5 " }],
      ["negative string", { query: "x", limit: "-5" }],
    ];
    for (const [label, input] of cases) {
      it(label, async () => {
        await expect(search(input)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
      });
    }
  });

  it("treats an omitted limit as absent, not as NaN", async () => {
    expect((await search({ query: "Tướng" })).items.length).toBeGreaterThan(0);
  });
});

describe("validation errors name the offending fields", () => {
  async function invalid(name: ResearchToolName, input: unknown) {
    try {
      await call(realHandlers())(name, input);
    } catch (error) {
      return error as ResearchHandlerError;
    }
    throw new Error(`${name} unexpectedly accepted the input`);
  }

  it("names top-level, missing and nested fields", async () => {
    expect((await invalid("tqccl_search", { query: "x", limit: "abc" })).fields).toContain("limit");
    expect((await invalid("tqccl_get_entity", {})).fields).toContain("entityId");
    expect((await invalid("tqccl_find_teams", { collection: "recommended", heroes: [{ canonicalId: "hero:a", tacticIds: "x" }] })).fields).toContain("heroes[0].tacticIds");
    expect((await invalid("tqccl_get_team", { reference: { collection: "other", legacyTeamId: "a" } })).fields).toContain("reference.legacyVariantId");
  });

  it("caps the reported field list and mentions fields in the public message", async () => {
    const error = await invalid("tqccl_find_teams", {
      collection: "nope",
      minHeroes: "abc",
      limit: "x",
      heroes: [{ canonicalId: 1, tacticIds: 2 }, { canonicalId: 3, tacticIds: 4 }, { canonicalId: 5, tacticIds: 6 }],
    });
    expect(error.fields.length).toBeLessThanOrEqual(5);
    expect(error.fields.length).toBeGreaterThan(1);
    expect(new Set(error.fields).size).toBe(error.fields.length);
    expect(error.message).toContain(error.fields[0]!);
  });

  it("never echoes the submitted value", async () => {
    const sentinel = "SENTINEL_VALUE_XYZ";
    const error = await invalid("tqccl_search", { query: "x", limit: sentinel, cursor: sentinel });
    expect(JSON.stringify({ ...error, message: error.message })).not.toContain(sentinel);
  });

  it("leaves other error codes untouched", async () => {
    await expect(
      realHandlers().call("tqccl_get_team", { reference: { collection: "engine", teamId: "khong-ton-tai" }, expectedWorkflowVersion: "workflow:stale" }),
    ).rejects.toMatchObject({ code: "WORKFLOW_VERSION_CHANGED", message: "Phiên bản dữ liệu hoặc quy trình đã thay đổi.", fields: [] });
    await expect(realHandlers().call("tqccl_get_team", { reference: { collection: "engine", teamId: "khong-ton-tai" } })).rejects.toMatchObject({
      code: "REFERENCE_NOT_FOUND",
      message: "Không tìm thấy đội tham khảo.",
      fields: [],
    });
  });
});

describe("tqccl_search explains why a result matched", () => {
  const searchReal = (input: Record<string, unknown>) =>
    createResearchHandlers({ dataSource: new FilesystemDataSource({ dataRoot: realDataRoot }) }).call("tqccl_search", input as never);

  it("returns the nickname that matched, not just the display name", async () => {
    const result = await searchReal({ query: "Hoàng Quan Thương", kinds: ["team"], limit: 50 });
    expect(result.items.find((item) => item.entityId === "engine:team-intro-2")).toMatchObject({
      collection: "engine",
      displayName: "Vũ Tung Úc",
      matchedTerm: "Hoàng Quan Thương",
    });
  });

  it("echoes the display name when the primary name matched", async () => {
    const result = await searchReal({ query: "Vũ Tung Mông", kinds: ["team"], limit: 50 });
    const engine = result.items.find((item) => item.collection === "engine")!;
    expect(engine.matchedTerm).toBe(engine.displayName);
  });

  it("omits matchedTerm when browsing the corpus", async () => {
    const result = await searchReal({ query: "", limit: 3 });
    expect(result.items).toHaveLength(3);
    for (const item of result.items) expect(item).not.toHaveProperty("matchedTerm");
  });

  it("survives its own output schema", async () => {
    const result = await searchReal({ query: "Hoàng Quan Thương", limit: 5 });
    expect(() => RESEARCH_CONTRACTS.tqccl_search.output.parse(result)).not.toThrow();
  });

  it("bounds a long matched term without turning a valid search into an internal error", async () => {
    const base = await new FilesystemDataSource({ dataRoot: realDataRoot }).load();
    const longNickname = `Needle ${"x".repeat(300)}`;
    const source: DataSource = {
      async load() {
        return { ...base, artifacts: { ...base.artifacts, teams: [{ ...base.artifacts.teams[0], nickname: longNickname }] } };
      },
    };
    const result = await createResearchHandlers({ dataSource: source }).call("tqccl_search", { query: "Needle", kinds: ["team"], limit: 50 });
    const engine = result.items.find((item) => item.collection === "engine")!;
    expect(engine.matchedTerm).toBe(longNickname.slice(0, 256));
    expect(() => RESEARCH_CONTRACTS.tqccl_search.output.parse(result)).not.toThrow();
  });
});
