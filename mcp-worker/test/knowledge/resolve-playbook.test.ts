import { describe, expect, it } from "vitest";

import { resolvePlaybookKnowledge } from "../../src/knowledge/resolve-playbook.js";
import {
  KNOWLEDGE_TOOL_NAMES,
  KnowledgeError,
} from "../../src/knowledge/rule-contracts.js";
import { ids, makeRule, makeSource, realSource } from "./helpers.js";

function codeOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    if (error instanceof KnowledgeError) return error.code;
    throw error;
  }
  return "NO_ERROR";
}

describe("resolvePlaybookKnowledge", () => {
  it("returns versions, workflow card, required rules and all guidance", () => {
    const result = resolvePlaybookKnowledge({ intent: "lookup" });
    expect(result.knowledgeVersion).toBe(realSource.version);
    expect(result.workflow.id).toBe("lookup");
    expect(result.requiredRules.length).toBeGreaterThan(0);
    const allGuidance = realSource.bundle.rules.filter(
      (rule) => rule.kind !== "invariant" && rule.status === "active" && rule.workflows.includes("lookup") && rule.when === null,
    );
    expect(result.guidanceCount).toBe(allGuidance.length);
    expect(result.guidanceTruncated).toBe(false);
    expect(result.guidanceOmittedCount).toBe(0);
    expect(result.guidanceBytes).toBe(new TextEncoder().encode(JSON.stringify(result.guidance)).length);
    expect(result.outputChecklist.length).toBeGreaterThan(0);
    expect(result.errorRecovery.map((entry) => entry.code)).toContain("KNOWLEDGE_VERSION_CHANGED");
  });

  it("next-step tools come from the 7 final tool names (never search_rules)", () => {
    for (const intent of ["lookup", "coexist", "research"] as const) {
      const { nextTools } = resolvePlaybookKnowledge({ intent });
      expect(nextTools.length).toBeGreaterThan(0);
      for (const entry of nextTools) expect(KNOWLEDGE_TOOL_NAMES).toContain(entry.tool);
    }
    const staged = resolvePlaybookKnowledge({ intent: "coexist", stage: "normalize-roster" });
    expect(staged.nextTools.map((entry) => entry.tool)).toEqual(["tqccl_normalize_entities"]);
  });

  it("stage narrows rules; all-stages call is a superset", () => {
    const all = resolvePlaybookKnowledge({ intent: "research" });
    const stage = resolvePlaybookKnowledge({ intent: "research", stage: "scope-lock" });
    expect(ids(stage.requiredRules).every((id) => ids(all.requiredRules).includes(id))).toBe(true);
    expect(stage.requiredRules.length).toBeLessThan(all.requiredRules.length);
    expect(ids(stage.requiredRules)).toContain("research-topic-lock");
    expect(ids(stage.requiredRules)).not.toContain("research-write-report");
  });

  it("research playbook always carries correction-history without any query", () => {
    expect(ids(resolvePlaybookKnowledge({ intent: "research" }).requiredRules)).toContain("research-correction-history");
    expect(ids(resolvePlaybookKnowledge({ intent: "research", stage: "project-context" }).requiredRules)).toContain("research-correction-history");
  });

  it("reports unresolved conditions and applies known context", () => {
    const unknown = resolvePlaybookKnowledge({ intent: "coexist" });
    expect(unknown.unresolvedConditions.map((entry) => entry.ruleId)).toContain("verified-season-pair");
    const seasonal = resolvePlaybookKnowledge({ intent: "coexist", context: { seasonal: true } });
    expect(ids(seasonal.requiredRules)).toContain("verified-season-pair");
    const notSeasonal = resolvePlaybookKnowledge({ intent: "coexist", context: { seasonal: false } });
    expect(notSeasonal.unresolvedConditions.map((entry) => entry.ruleId)).not.toContain("verified-season-pair");
  });

  it("flags truncated guidance without touching required rules", () => {
    const full = resolvePlaybookKnowledge({ intent: "coexist" });
    const small = resolvePlaybookKnowledge({ intent: "coexist" }, { guidanceByteTarget: 900 });
    expect(small.guidanceTruncated).toBe(true);
    expect(small.guidanceCount).toBeLessThan(full.guidanceCount);
    expect(small.guidanceCount + small.guidanceOmittedCount).toBe(full.guidanceCount);
    expect(small.guidanceBytes).toBeLessThanOrEqual(900);
    expect(small.requiredRules).toEqual(full.requiredRules);
  });

  it("errors: version, unknown stage, invalid input, unavailable, required overflow", () => {
    expect(codeOf(() => resolvePlaybookKnowledge({ intent: "lookup", expectedKnowledgeVersion: "knowledge:stale" }))).toBe("KNOWLEDGE_VERSION_CHANGED");
    expect(codeOf(() => resolvePlaybookKnowledge({ intent: "lookup", stage: "no-such-stage" }))).toBe("PLAYBOOK_NOT_FOUND");
    expect(codeOf(() => resolvePlaybookKnowledge({ intent: "trade" }))).toBe("INVALID_REQUEST");
    expect(codeOf(() => resolvePlaybookKnowledge({ intent: "lookup", extra: 1 }))).toBe("INVALID_REQUEST");
    const broken = { bundle: { ...realSource.bundle, manifest: null }, version: "knowledge:broken" };
    expect(codeOf(() => resolvePlaybookKnowledge({ intent: "lookup" }, { knowledge: broken as never }))).toBe("KNOWLEDGE_UNAVAILABLE");
    const huge = makeSource(
      Array.from({ length: 30 }, (_, index) => makeRule({ id: `inv-${index}`, kind: "invariant", explanation: "x".repeat(1400) })),
    );
    expect(codeOf(() => resolvePlaybookKnowledge({ intent: "coexist" }, { knowledge: huge }))).toBe("RULE_SCOPE_INVALID");
  });

  it("derives the guidance budget from the result cap minus what the rest of the payload uses", () => {
    const free = resolvePlaybookKnowledge({ intent: "coexist" });
    const { guidance: _fg, guidanceCount: _fc, guidanceBytes: _fb, guidanceTruncated: _ft, guidanceOmittedCount: _fo, ...freeRest } = free;
    const bytes = (value: unknown): number => new TextEncoder().encode(JSON.stringify(value)).length;
    const reservedChars = 38_000 - bytes(freeRest) - 3_000;
    const squeezed = resolvePlaybookKnowledge({ intent: "coexist" }, { reservedChars });
    expect(squeezed.requiredRules).toEqual(free.requiredRules);
    expect(squeezed.guidanceTruncated).toBe(true);
    const { guidance: _g, guidanceCount: _c, guidanceBytes: _b, guidanceTruncated: _t, guidanceOmittedCount: _o, ...rest } = squeezed;
    expect(reservedChars + bytes(rest) + bytes(squeezed.guidance)).toBeLessThanOrEqual(38_000);
  });

  it("required rules that no longer fit beside the reserved payload overflow with a scoped error", () => {
    try {
      resolvePlaybookKnowledge({ intent: "research" }, { reservedChars: 20_000 });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(KnowledgeError);
      expect((error as KnowledgeError).code).toBe("RULE_SCOPE_INVALID");
      expect((error as KnowledgeError).details["reason"]).toBe("required-overflow");
    }
  });

  it("matching expectedKnowledgeVersion succeeds", () => {
    expect(resolvePlaybookKnowledge({ intent: "lookup", expectedKnowledgeVersion: realSource.version }).knowledgeVersion).toBe(realSource.version);
  });
});
