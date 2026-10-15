import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { FilesystemDataSource } from "../../src/data/filesystem-data-source.js";
import { publicSnapshotView } from "../../src/data/public-snapshot-view.js";
import { buildSnapshotIndex } from "../../src/data/snapshot-index.js";
import { createWorkflowVersion } from "../../src/domain/canonical-state.js";
import { KNOWLEDGE_VERSION } from "../../src/generated/knowledge-bundle.js";
import { WORKFLOW_BUILD_ID } from "../../src/generated/workflow-build.js";
import { KNOWLEDGE_BUNDLE } from "../../src/generated/knowledge-bundle.js";
import { resolvePlaybookKnowledge } from "../../src/knowledge/resolve-playbook.js";
import { KnowledgeError, KNOWLEDGE_TOOL_NAMES } from "../../src/knowledge/rule-contracts.js";
import { RESEARCH_TOOL_NAMES } from "../../src/research/research-contracts.js";
import { ResearchHandlerError } from "../../src/research/handler-error.js";
import { getPlaybookInputSchema, getPlaybookOutputSchema, handleGetPlaybook } from "../../src/research/playbook-handlers.js";
import { createToolContext, type ToolContext } from "../../src/research/tool-context.js";

vi.mock("../../src/knowledge/resolve-playbook.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/knowledge/resolve-playbook.js")>();
  return { ...actual, resolvePlaybookKnowledge: vi.fn(actual.resolvePlaybookKnowledge) };
});

const realDataRoot = fileURLToPath(new URL("../../../data", import.meta.url));
const fixtureRoot = fileURLToPath(new URL("../fixtures/release-snapshot", import.meta.url));

async function contextFor(root: string): Promise<ToolContext> {
  const snapshot = await publicSnapshotView(await new FilesystemDataSource({ dataRoot: root }).load());
  return createToolContext(snapshot, buildSnapshotIndex(snapshot), createWorkflowVersion(snapshot.releaseId, WORKFLOW_BUILD_ID));
}

async function expectCode(promise: Promise<unknown>, code: string, retryable?: boolean) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(ResearchHandlerError);
  expect((error as ResearchHandlerError).code).toBe(code);
  if (retryable !== undefined) expect((error as ResearchHandlerError).retryable).toBe(retryable);
}

let ctx: ToolContext;
let legacyCtx: ToolContext;
beforeAll(async () => {
  ctx = await contextFor(realDataRoot);
  legacyCtx = await contextFor(fixtureRoot);
}, 120_000);

describe("tqccl_get_playbook input contract", () => {
  it("is a root object with discriminators inside properties and no union/$ref", () => {
    const schema = z.toJSONSchema(getPlaybookInputSchema) as Record<string, unknown>;
    expect(schema.type).toBe("object");
    for (const key of ["oneOf", "anyOf", "allOf", "$ref", "$defs"]) expect(schema).not.toHaveProperty(key);
    expect(schema.required).toEqual(["intent"]);
  });

  it("rejects unknown keys, bad intent and a malformed seasonSelection", async () => {
    await expectCode(handleGetPlaybook(ctx, { intent: "lookup", seasonContext: {} }), "INVALID_REQUEST");
    await expectCode(handleGetPlaybook(ctx, { intent: "nope" }), "INVALID_REQUEST");
    await expectCode(handleGetPlaybook(ctx, { intent: "lookup", seasonSelection: { mode: "default", sourceSeasonId: "x" } }), "INVALID_REQUEST");
  });
});

describe("tqccl_get_playbook season resolution", () => {
  it("without a selection uses the registry default as an assumption (lookup/coexist)", async () => {
    const defaultId = ctx.publication().seasons.defaultSourceSeasonId;
    for (const intent of ["lookup", "coexist"] as const) {
      const output = await handleGetPlaybook(ctx, { intent });
      expect(getPlaybookOutputSchema.parse(output)).toEqual(output);
      expect(output.seasonSelection).toMatchObject({
        mode: "default",
        sourceSeasonId: defaultId,
        resolutionSource: "registry-default",
        selectionStatus: "assumed",
        dataVersion: ctx.dataVersion,
      });
      expect(output.seasonSelection?.label).toBe(ctx.publication().seasons.seasonOptions.find((o) => o.sourceSeasonId === defaultId)?.label);
    }
  });

  it("honours a valid explicit selection and its confirmed status", async () => {
    const other = ctx.publication().seasons.seasonOptions.find((option) => option.sourceSeasonId !== ctx.publication().seasons.defaultSourceSeasonId)!;
    const output = await handleGetPlaybook(ctx, { intent: "coexist", seasonSelection: { mode: "explicit", sourceSeasonId: other.sourceSeasonId } });
    expect(output.seasonSelection).toMatchObject({ mode: "explicit", sourceSeasonId: other.sourceSeasonId, resolutionSource: "caller", selectionStatus: "confirmed" });
    const session = await handleGetPlaybook(ctx, { intent: "coexist", seasonSelection: { mode: "session", sourceSeasonId: other.sourceSeasonId } });
    expect(session.seasonSelection?.selectionStatus).toBe("assumed");
    const profile = await handleGetPlaybook(ctx, { intent: "coexist", seasonSelection: { mode: "profile", sourceSeasonId: other.sourceSeasonId, status: "confirmed" } });
    expect(profile.seasonSelection).toMatchObject({ mode: "profile", selectionStatus: "confirmed" });
  });

  it("an id outside seasonOptions falls back to the default and says so", async () => {
    const output = await handleGetPlaybook(ctx, { intent: "coexist", seasonSelection: { mode: "explicit", sourceSeasonId: "not-a-season", status: "confirmed" } });
    expect(output.seasonSelection).toMatchObject({
      mode: "default",
      sourceSeasonId: ctx.publication().seasons.defaultSourceSeasonId,
      resolutionSource: "registry-default-invalid-selection",
      selectionStatus: "assumed",
    });
    expect(output.readiness.warnings).toContain("season-selection-invalid-using-default");
  });

  it("research without a selection keeps the season unknown (no default applied)", async () => {
    const output = await handleGetPlaybook(ctx, { intent: "research" });
    expect(output.seasonSelection).toBeNull();
    expect(output.readiness.referenceFitReady).toBe(false);
    expect(output.readiness.warnings).toContain("season-unknown-research-without-selection");
    const selected = await handleGetPlaybook(ctx, { intent: "research", seasonSelection: { mode: "explicit", sourceSeasonId: "pk-s24" } });
    expect(selected.seasonSelection?.sourceSeasonId).toBe("pk-s24");
  });

  it("lists bounded registry options with labels, not record dumps", async () => {
    const output = await handleGetPlaybook(ctx, { intent: "lookup" });
    const seasons = ctx.publication().seasons;
    expect(output.registry?.defaultSourceSeasonId).toBe(seasons.defaultSourceSeasonId);
    expect(output.registry?.seasonOptions.map((o) => o.sourceSeasonId)).toEqual(seasons.seasonOptions.map((o) => o.sourceSeasonId));
    expect(Object.keys(output.registry!.seasonOptions[0]!).sort()).toEqual(["displayCode", "displayNameVi", "label", "sourceSeasonId", "status"]);
    expect(JSON.stringify(output).length).toBeLessThan(40_000);
  });
});

describe("tqccl_get_playbook readiness and capabilities", () => {
  it("v3 reports capabilities, reference fit ready and ruleset scoring unavailable", async () => {
    const output = await handleGetPlaybook(ctx, { intent: "coexist" });
    expect(output.capabilities).toMatchObject({ catalog: true, reference: true, recommend: true, locale: true });
    expect(output.capabilities.collections).toEqual(ctx.publication().seasons.collections.map((c) => c.id));
    expect(output.readiness).toMatchObject({ referenceAvailable: true, referenceFitReady: true, rulesetScoringReady: false });
    expect(output.readiness.missingRequirements).toContain("reviewed-ruleset");
    expect(output.rulesetResolution).toMatchObject({ status: "unresolved", scenarioId: null, rulesetId: null });
    expect(output.rulesetResolution.scenarios.length).toBeGreaterThan(0);
    expect(output.rulesetResolution.scenarios.every((scenario) => scenario.rulesets.length === 0)).toBe(true);
    expect(output).toMatchObject({ releaseId: ctx.releaseId, dataVersion: ctx.dataVersion, workflowVersion: ctx.workflowVersion, knowledgeVersion: KNOWLEDGE_VERSION });
  });

  it("a ruleset id that is not reviewed never resolves", async () => {
    const output = await handleGetPlaybook(ctx, { intent: "coexist", context: { ruleset: "made-up-ruleset" } });
    expect(output.rulesetResolution).toMatchObject({ status: "unresolved", reason: "ruleset-not-reviewed" });
    expect(output.readiness.rulesetScoringReady).toBe(false);
  });

  it("v1/v2 releases report every v3 capability false and hide unavailable tools", async () => {
    const output = await handleGetPlaybook(legacyCtx, { intent: "coexist" });
    expect(output.capabilities).toEqual({ catalog: false, reference: false, recommend: false, locale: false, collections: ["engine"] });
    expect(output.seasonSelection).toBeNull();
    expect(output.registry).toBeNull();
    expect(output.readiness).toMatchObject({ referenceAvailable: false, referenceFitReady: false, rulesetScoringReady: false });
    expect(output.readiness.missingRequirements).toContain("publication-v3");
    const tools = output.nextTools.map((entry) => entry.tool);
    for (const name of ["tqccl_search", "tqccl_get_entity", "tqccl_recommend_teams"]) expect(tools).not.toContain(name);
  });

  it("v1/v2 releases still report the engine collection and keep the engine tools", async () => {
    const output = await handleGetPlaybook(legacyCtx, { intent: "lookup" });
    expect(output.capabilities.collections).toEqual(["engine"]);
    const tools = output.nextTools.map((entry) => entry.tool);
    expect(tools).toContain("tqccl_find_teams");
    expect(tools).toContain("tqccl_get_team");
    expect(tools).not.toContain("tqccl_search");
  });
});

describe("tqccl_get_playbook knowledge and versions", () => {
  it("returns the workflow card, required rules with conditionStatus and registered next tools", async () => {
    const output = await handleGetPlaybook(ctx, { intent: "coexist" });
    expect(output.workflow.id).toBe("coexist");
    expect(output.requiredRules.length).toBeGreaterThan(0);
    for (const rule of output.requiredRules) {
      expect(rule.kind).toBe("invariant");
      expect(["met", "unresolved"]).toContain(rule.conditionStatus);
    }
    expect(output.guidanceCount).toBe(output.guidance.length);
    expect(typeof output.guidanceBytes).toBe("number");
    expect(typeof output.guidanceTruncated).toBe("boolean");
    expect(output.nextTools.length).toBeGreaterThan(0);
    for (const entry of output.nextTools) expect((KNOWLEDGE_TOOL_NAMES as readonly string[]).includes(entry.tool)).toBe(true);
    expect(output.outputChecklist.length).toBeGreaterThan(0);
    expect(output.errorRecovery.length).toBeGreaterThan(0);
    expect(JSON.stringify(output).length).toBeLessThan(40_000);
  });

  it("a stage narrows next tools and an unknown stage is PLAYBOOK_NOT_FOUND", async () => {
    const full = await handleGetPlaybook(ctx, { intent: "coexist" });
    const stage = full.workflow.stages[0]!.id;
    const narrowed = await handleGetPlaybook(ctx, { intent: "coexist", stage });
    expect(narrowed.stage).toBe(stage);
    expect(narrowed.nextTools.every((entry) => entry.stage === stage)).toBe(true);
    await expectCode(handleGetPlaybook(ctx, { intent: "coexist", stage: "no-such-stage" }), "PLAYBOOK_NOT_FOUND", false);
  });

  it("knowledge and workflow version mismatches are retryable errors; matching ones pass", async () => {
    await expectCode(handleGetPlaybook(ctx, { intent: "lookup", expectedKnowledgeVersion: "knowledge:stale" }), "KNOWLEDGE_VERSION_CHANGED", true);
    await expectCode(handleGetPlaybook(ctx, { intent: "lookup", expectedWorkflowVersion: "workflow:stale" }), "WORKFLOW_VERSION_CHANGED", true);
    const ok = await handleGetPlaybook(ctx, { intent: "lookup", expectedKnowledgeVersion: KNOWLEDGE_VERSION, expectedWorkflowVersion: ctx.workflowVersion });
    expect(ok.knowledgeVersion).toBe(KNOWLEDGE_VERSION);
  });

  it("passes the resolved season into rule scope and keeps invariants independent of it", async () => {
    const a = await handleGetPlaybook(ctx, { intent: "research" });
    const b = await handleGetPlaybook(ctx, { intent: "research", seasonSelection: { mode: "explicit", sourceSeasonId: "pk-s24" }, locale: "zh" });
    const idsA = a.requiredRules.map((rule) => rule.ruleId).sort();
    for (const id of idsA) expect(b.requiredRules.map((rule) => rule.ruleId)).toContain(id);
    expect(b.locale).toBe("zh");
  });
});

describe("tqccl_get_playbook size budget and error mapping", () => {
  const CAP = 40_000;

  it.each(["lookup", "coexist", "research"] as const)("%s without a stage keeps at least 15%% headroom under the result cap", async (intent) => {
    const output = await handleGetPlaybook(ctx, { intent });
    expect(JSON.stringify(output).length).toBeLessThanOrEqual(CAP * 0.85);
  });

  it("the output schema admits every invariant in the dataset", async () => {
    const invariants = KNOWLEDGE_BUNDLE.rules.filter((rule) => rule.kind === "invariant").length;
    const base = await handleGetPlaybook(ctx, { intent: "research" });
    const rule = base.requiredRules[0]!;
    const widened = { ...base, requiredRules: Array.from({ length: invariants }, () => rule) };
    expect(getPlaybookOutputSchema.safeParse(widened).success).toBe(true);
  });

  it("required overflow is RESULT_TOO_LARGE, never INTERNAL_ERROR", async () => {
    vi.mocked(resolvePlaybookKnowledge).mockImplementationOnce(() => {
      throw new KnowledgeError("RULE_SCOPE_INVALID", "x", { reason: "required-overflow" });
    });
    await expectCode(handleGetPlaybook(ctx, { intent: "research" }), "RESULT_TOO_LARGE", false);
  });

  it("any other RULE_SCOPE_INVALID is INVALID_REQUEST, never INTERNAL_ERROR", async () => {
    vi.mocked(resolvePlaybookKnowledge).mockImplementationOnce(() => {
      throw new KnowledgeError("RULE_SCOPE_INVALID", "x", { ruleId: "r" });
    });
    await expectCode(handleGetPlaybook(ctx, { intent: "research" }), "INVALID_REQUEST", false);
  });

  it("the resolver is told how much of the result cap the rest of the payload already uses", async () => {
    const spy = vi.mocked(resolvePlaybookKnowledge);
    spy.mockClear();
    await handleGetPlaybook(ctx, { intent: "research" });
    const options = spy.mock.calls[0]?.[1] as { reservedChars?: number } | undefined;
    expect(options?.reservedChars).toBeGreaterThan(500);
  });
});

describe("tool-name registries", () => {
  it("KNOWLEDGE_TOOL_NAMES equals RESEARCH_TOOL_NAMES", () => {
    expect([...KNOWLEDGE_TOOL_NAMES].sort()).toEqual([...RESEARCH_TOOL_NAMES].sort());
  });
});

describe("tqccl_get_playbook assumed season is not a confirmed fact", () => {
  const seenContext = (): Record<string, unknown> => {
    const call = vi.mocked(resolvePlaybookKnowledge).mock.calls.at(-1);
    return ((call?.[0] as { context?: Record<string, unknown> }).context ?? {}) as Record<string, unknown>;
  };

  it("an assumed default season is passed as unknown", async () => {
    await handleGetPlaybook(ctx, { intent: "coexist" });
    expect(seenContext()["sourceSeasonId"]).toBeUndefined();
  });

  it("an assumed caller selection is passed as unknown", async () => {
    await handleGetPlaybook(ctx, { intent: "coexist", seasonSelection: { mode: "session", sourceSeasonId: "pk-s24" } });
    expect(seenContext()["sourceSeasonId"]).toBeUndefined();
  });

  it("a confirmed selection is passed as a fact", async () => {
    await handleGetPlaybook(ctx, { intent: "coexist", seasonSelection: { mode: "explicit", sourceSeasonId: "pk-s24" } });
    expect(seenContext()["sourceSeasonId"]).toBe("pk-s24");
  });
});
