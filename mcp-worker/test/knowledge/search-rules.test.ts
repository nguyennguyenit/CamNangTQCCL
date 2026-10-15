import { describe, expect, it } from "vitest";

import { KnowledgeError } from "../../src/knowledge/rule-contracts.js";
import { searchRules } from "../../src/knowledge/search-rules.js";
import { ids, makeRule, makeSource, noiseRules, realSource } from "./helpers.js";

function codeOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    if (error instanceof KnowledgeError) return error.code;
    throw error;
  }
  return "NO_ERROR";
}

describe("searchRules — prototype deterministic checks (ported)", () => {
  it("required rules survive an unrelated query and limit=1", () => {
    const result = searchRules({ query: "zzzxxyy", workflow: "coexist", limit: 1 });
    expect(ids(result.requiredRules)).toContain("respect-tactic-locks");
    expect(result.abstained).toBe(true);
    expect(result.guidance).toEqual([]);
  });

  it("reports an unknown condition instead of treating it as false", () => {
    const result = searchRules({ query: "mùa", workflow: "coexist" });
    expect(result.unresolvedConditions).toContainEqual({
      ruleId: "verified-season-pair",
      kind: "invariant",
      missing: ["seasonal"],
    });
    expect(result.requiredRules.find((rule) => rule.ruleId === "verified-season-pair")?.conditionStatus).toBe("unresolved");
  });

  it("a true condition makes the rule required", () => {
    const result = searchRules({ query: "", workflow: "coexist", context: { seasonal: true } });
    expect(ids(result.requiredRules)).toContain("verified-season-pair");
  });

  it("a false condition neither applies nor stays unresolved", () => {
    const result = searchRules({ query: "", workflow: "coexist", context: { seasonal: false } });
    expect(ids(result.requiredRules)).not.toContain("verified-season-pair");
    expect(result.unresolvedConditions.some((entry) => entry.ruleId === "verified-season-pair")).toBe(false);
  });

  it("isolates rules by workflow", () => {
    const result = searchRules({ query: "khóa chiến pháp", workflow: "lookup" });
    expect(ids(result.requiredRules)).not.toContain("respect-tactic-locks");
  });

  it("ranks coexist-priority first for unaccented 'nhieu hot'", () => {
    const result = searchRules({ query: "nhieu hot", workflow: "coexist", limit: 1 });
    expect(result.guidance[0]?.ruleId).toBe("coexist-priority");
    expect(result.requiredRules.length).toBeGreaterThanOrEqual(5);
    expect(result.abstained).toBe(false);
  });

  it("finds lookup guidance for the Chinese query 装备", () => {
    const result = searchRules({ query: "装备", workflow: "lookup" });
    expect(result.guidance[0]?.ruleId).toBe("lookup-seven-groups");
  });

  it("changed configuration pulls in the source-score rule", () => {
    const result = searchRules({ query: "", workflow: "research", context: { configChanged: true } });
    expect(ids(result.requiredRules)).toContain("preserve-source-score");
  });

  it("rejects unknown context keys and string booleans", () => {
    expect(codeOf(() => searchRules({ query: "", workflow: "lookup", context: { seasonal: "false" } }))).toBe("INVALID_REQUEST");
    expect(codeOf(() => searchRules({ query: "", workflow: "lookup", context: { execute: true } }))).toBe("INVALID_REQUEST");
  });

  it("knowledge version mismatch is an explicit error", () => {
    expect(
      codeOf(() => searchRules({ query: "x", workflow: "lookup", expectedKnowledgeVersion: "knowledge:old" })),
    ).toBe("KNOWLEDGE_VERSION_CHANGED");
    const ok = searchRules({
      query: "x",
      workflow: "lookup",
      expectedKnowledgeVersion: realSource.version,
    });
    expect(ok.knowledgeVersion).toBe(realSource.version);
  });
});

describe("searchRules — retrieval contract", () => {
  it("abstains with a reason on no-match and on filler-only queries", () => {
    const none = searchRules({ query: "zzzxxyy", workflow: "research" });
    expect(none.abstained).toBe(true);
    expect(none.abstentionReason).toBe("no-lexical-match");
    const empty = searchRules({ query: "", workflow: "research" });
    expect(empty.abstentionReason).toBe("empty-query");
    const weak = searchRules({ query: "tôi muốn biết cơ chế", workflow: "research" });
    expect(weak.abstained).toBe(true);
    expect(weak.guidance).toEqual([]);
  });

  it("defaults to 3 results, caps at 10 and validates bounds", () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      makeRule({ id: `guide-${index}`, title: "chiến pháp chung", terms: "chiến pháp", explanation: `mẫu ${index}` }),
    );
    const source = makeSource([...many, ...noiseRules(20)]);
    const base = { query: "chiến pháp", workflow: "coexist" as const };
    expect(searchRules(base, { knowledge: source }).guidance).toHaveLength(3);
    expect(searchRules({ ...base, limit: 10 }, { knowledge: source }).guidance).toHaveLength(10);
    expect(codeOf(() => searchRules({ ...base, limit: 11 }))).toBe("INVALID_REQUEST");
    expect(codeOf(() => searchRules({ ...base, query: "x".repeat(257) }))).toBe("INVALID_REQUEST");
    expect(codeOf(() => searchRules({ ...base, ruleIds: Array.from({ length: 21 }, (_, i) => `rule-${i}`) }))).toBe("INVALID_REQUEST");
  });

  it("exact ruleIds come back with status, successor and scope checks", () => {
    const source = makeSource([
      makeRule({ id: "old-rule", status: "deprecated", successor: "new-rule" }),
      makeRule({ id: "new-rule", supersedes: ["old-rule"] }),
    ]);
    const result = searchRules(
      { query: "", workflow: "coexist", ruleIds: ["old-rule", "new-rule", "missing-rule"] },
      { knowledge: source },
    );
    expect(result.exactRules.map((entry) => [entry.rule.ruleId, entry.status, entry.successor, entry.applicable])).toEqual([
      ["old-rule", "deprecated", "new-rule", false],
      ["new-rule", "active", null, true],
    ]);
    expect(result.unknownRuleIds).toEqual(["missing-rule"]);
    expect(codeOf(() => searchRules({ query: "", workflow: "lookup", ruleIds: ["respect-tactic-locks"] }))).toBe("RULE_SCOPE_INVALID");
  });

  it("alias match ranks before BM25", () => {
    const source = {
      ...makeSource([
        makeRule({ id: "plain", title: "đỏ đỏ đỏ", terms: "đỏ", explanation: "đỏ" }),
        makeRule({ id: "aliased", title: "Khác hẳn", explanation: "Không liên quan" }),
      ]),
    };
    source.bundle = {
      ...source.bundle,
      aliases: { schemaVersion: 1, aliases: [{ forms: ["Sao Đỏ"], ruleIds: ["aliased"] }] },
    };
    const result = searchRules({ query: "sao đỏ", workflow: "coexist" }, { knowledge: source });
    expect(result.guidance.map((hit) => [hit.ruleId, hit.matchedBy])).toEqual([
      ["aliased", "alias"],
      ["plain", "bm25"],
    ]);
  });

  it("filters by stage and scope before ranking", () => {
    const source = makeSource([
      makeRule({ id: "in-stage", stage: "recommend", title: "chung", terms: "kho" }),
      makeRule({ id: "other-stage", stage: "explain", title: "chung", terms: "kho" }),
      makeRule({ id: "cn-only", scope: { region: "cn" }, title: "chung", terms: "kho" }),
      ...noiseRules(20).map((rule) => ({ ...rule, stage: "recommend" })),
    ]);
    const stage = searchRules({ query: "kho", workflow: "coexist", stage: "recommend", context: { region: "global" } }, { knowledge: source });
    expect(ids(stage.guidance)).toEqual(["in-stage"]);
    const cn = searchRules({ query: "kho", workflow: "coexist", stage: "recommend", context: { region: "cn" } }, { knowledge: source });
    expect(ids(cn.guidance).sort()).toEqual(["cn-only", "in-stage"]);
    const unknownRegion = searchRules({ query: "kho", workflow: "coexist", stage: "recommend" }, { knowledge: source });
    expect(unknownRegion.unresolvedConditions.map((entry) => entry.ruleId)).toEqual(["cn-only"]);
  });

  it("unknown stage is PLAYBOOK_NOT_FOUND", () => {
    expect(codeOf(() => searchRules({ query: "", workflow: "lookup", stage: "nope" }))).toBe("PLAYBOOK_NOT_FOUND");
  });

  it("trims guidance to the byte target but never trims required rules", () => {
    const big = "mẫu ".repeat(300);
    const required = makeRule({ id: "must-keep", kind: "invariant", explanation: "bắt buộc" });
    const guides = Array.from({ length: 10 }, (_, index) =>
      makeRule({ id: `big-${index}`, title: "kho", terms: "kho", explanation: big }),
    );
    const result = searchRules({ query: "kho", workflow: "coexist", limit: 10 }, { knowledge: makeSource([required, ...guides, ...noiseRules(30)]) });
    expect(result.guidanceTruncated).toBe(true);
    expect(result.guidanceBytes).toBeLessThanOrEqual(16 * 1024);
    expect(result.guidance.length).toBeLessThan(10);
    expect(ids(result.requiredRules)).toEqual(["must-keep"]);
  });

  it("required overflow is an error, not a truncation", () => {
    const invariants = Array.from({ length: 30 }, (_, index) =>
      makeRule({ id: `inv-${index}`, kind: "invariant", explanation: "x".repeat(1400) }),
    );
    const source = makeSource(invariants);
    try {
      searchRules({ query: "", workflow: "coexist" }, { knowledge: source });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(KnowledgeError);
      expect((error as KnowledgeError).code).toBe("RULE_SCOPE_INVALID");
      expect((error as KnowledgeError).details["reason"]).toBe("required-overflow");
    }
  });

  it("an invalid bundle is KNOWLEDGE_UNAVAILABLE", () => {
    const broken = { bundle: { ...realSource.bundle, rules: [{ id: "x" }] }, version: "knowledge:broken" };
    expect(codeOf(() => searchRules({ query: "", workflow: "lookup" }, { knowledge: broken as never }))).toBe("KNOWLEDGE_UNAVAILABLE");
  });

  it("diagnostics are opt-in", () => {
    expect(searchRules({ query: "nhieu hot", workflow: "coexist" }).diagnostics).toBeUndefined();
    const diagnostic = searchRules({ query: "nhieu hot", workflow: "coexist", diagnostics: true }).diagnostics;
    expect(diagnostic?.thresholds.minScore).toBeGreaterThan(0);
  });
});

describe("invariants are always required (real dataset)", () => {
  const queries = ["", "zzzxxyy", "nhieu hot", "装备", "tôi muốn biết cơ chế", "mùa", "x".repeat(256)];
  for (const workflow of ["lookup", "coexist", "research"] as const) {
    const card = realSource.bundle.workflows.workflows.find((entry) => entry.id === workflow);
    const stages: (string | undefined)[] = [undefined, ...(card?.stages.map((stage) => stage.id) ?? [])];
    it(`${workflow}: every unconditional invariant is in required for every query/stage/limit`, () => {
      let sawAbstained = false;
      for (const stage of stages) {
        const expected = realSource.bundle.rules
          .filter(
            (rule) =>
              rule.kind === "invariant" &&
              rule.status === "active" &&
              rule.workflows.includes(workflow) &&
              rule.when === null &&
              Object.keys(rule.scope).length === 0 &&
              (stage === undefined || rule.stage === null || rule.stage === stage),
          )
          .map((rule) => rule.id)
          .sort();
        expect(expected.length).toBeGreaterThan(0);
        for (const query of queries) {
          for (const limit of [1, 10]) {
            const result = searchRules({ query, workflow, limit, ...(stage === undefined ? {} : { stage }) });
            sawAbstained ||= result.abstained;
            expect(ids(result.requiredRules)).toEqual(expect.arrayContaining(expected));
          }
        }
      }
      expect(sawAbstained).toBe(true);
    });
  }

  it("research-correction-history is an invariant and survives abstention", () => {
    const rule = realSource.bundle.rules.find((entry) => entry.id === "research-correction-history");
    expect(rule?.kind).toBe("invariant");
    const result = searchRules({ query: "tôi muốn biết cơ chế", workflow: "research", limit: 1 });
    expect(result.abstained).toBe(true);
    expect(ids(result.requiredRules)).toContain("research-correction-history");
  });
});
