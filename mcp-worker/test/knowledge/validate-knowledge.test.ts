import { describe, expect, it } from "vitest";

import { evaluateCondition, foldText, tokenize } from "../../src/knowledge/rule-conditions.js";
import type { Rule } from "../../src/knowledge/rule-contracts.js";
import { validateKnowledgeBundle } from "../../src/knowledge/validate-knowledge.js";
import { makeBundle, makeRule, realSource } from "./helpers.js";

function codes(rules: Rule[]): string[] {
  const result = validateKnowledgeBundle(makeBundle(rules));
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

describe("validateKnowledgeBundle", () => {
  it("accepts the shipped dataset", () => {
    const result = validateKnowledgeBundle(realSource.bundle);
    expect(result.ok).toBe(true);
  });

  it("rejects schema violations (unknown keys, bad action, bad field)", () => {
    const rule = makeRule({ id: "ok-rule" });
    expect(validateKnowledgeBundle(makeBundle([{ ...rule, extra: 1 } as never])).ok).toBe(false);
    expect(validateKnowledgeBundle(makeBundle([{ ...rule, action: { type: "run-shell", cmd: "ls" } } as never])).ok).toBe(false);
    expect(
      validateKnowledgeBundle(makeBundle([{ ...rule, when: { field: "secretToken", op: "eq", value: "x" } } as never])).ok,
    ).toBe(false);
    expect(validateKnowledgeBundle(makeBundle([{ ...rule, when: { field: "seasonal", op: "regex", value: ".*" } } as never])).ok).toBe(false);
  });

  it("rejects duplicate ids and mistyped condition values", () => {
    expect(codes([makeRule({ id: "same-id" }), makeRule({ id: "same-id" })])).toContain("DUPLICATE_RULE_ID");
    expect(codes([makeRule({ id: "typed", when: { field: "seasonal", op: "eq", value: "yes" } })])).toContain("CONDITION_INVALID");
    expect(codes([makeRule({ id: "enum", when: { field: "region", op: "in", value: ["cn", "mars"] } })])).toContain("CONDITION_INVALID");
  });

  it("rejects unknown stage and workflow references", () => {
    expect(codes([makeRule({ id: "bad-stage", stage: "nope" })])).toContain("UNKNOWN_STAGE");
  });

  it("detects conflicts between two active rules of the same scope", () => {
    const a = makeRule({ id: "fmt-a", action: { type: "prefer-output-format", outputKey: "answer", format: "table" } });
    const b = makeRule({ id: "fmt-b", action: { type: "prefer-output-format", outputKey: "answer", format: "list" } });
    expect(codes([a, b])).toContain("CONFLICT");
    // khác scope hoặc khác outputKey hoặc một bên không active → không conflict
    expect(codes([a, { ...b, scope: { region: "cn" } }])).not.toContain("CONFLICT");
    expect(codes([a, { ...b, action: { type: "prefer-output-format", outputKey: "other", format: "list" } }])).not.toContain("CONFLICT");
    expect(codes([a, { ...b, status: "candidate" }])).not.toContain("CONFLICT");
    // điều kiện loại trừ nhau (seasonal=true vs false) → không chồng lấn
    expect(
      codes([
        { ...a, when: { field: "seasonal", op: "eq", value: true } },
        { ...b, when: { field: "seasonal", op: "eq", value: false } },
      ]),
    ).not.toContain("CONFLICT");
    const routeA = makeRule({ id: "route-a", action: { type: "route-workflow", workflow: "research" } });
    const routeB = makeRule({ id: "route-b", action: { type: "route-workflow", workflow: "lookup" } });
    expect(codes([routeA, routeB])).toContain("CONFLICT");
  });

  it("requires a successor for retired rules and consistent supersedes", () => {
    expect(codes([makeRule({ id: "retired", status: "deprecated" })])).toContain("RETIRED_WITHOUT_SUCCESSOR");
    const retired = makeRule({ id: "retired", status: "deprecated", successor: "fresh" });
    expect(codes([retired, makeRule({ id: "fresh", supersedes: ["retired"] })])).toEqual([]);
    expect(codes([retired, makeRule({ id: "fresh" })])).toContain("SUPERSEDES_MISMATCH");
    expect(codes([makeRule({ id: "fresh", supersedes: ["ghost"] })])).toContain("UNKNOWN_RULE_REFERENCE");
    expect(codes([makeRule({ id: "active-with-successor", successor: "other" })])).toContain("SUPERSEDES_MISMATCH");
  });

  it("checks alias references and duplicate forms", () => {
    const bundle = makeBundle([makeRule({ id: "target" })]);
    const missing = validateKnowledgeBundle({ ...bundle, aliases: { schemaVersion: 1, aliases: [{ forms: ["a"], ruleIds: ["ghost"] }] } });
    expect(missing.ok).toBe(false);
    const dup = validateKnowledgeBundle({
      ...bundle,
      aliases: {
        schemaVersion: 1,
        aliases: [
          { forms: ["Nhiều Hột"], ruleIds: ["target"] },
          { forms: ["nhieu hot"], ruleIds: ["target"] },
        ],
      },
    });
    expect(dup.ok ? [] : dup.issues.map((issue) => issue.code)).toContain("DUPLICATE_ALIAS");
  });

  it("every shipped invariant has a regression-friendly shape", () => {
    for (const rule of realSource.bundle.rules) {
      expect(rule.sourceRefs.length).toBeGreaterThan(0);
      expect(rule.reviewAfter >= rule.validFrom).toBe(true);
    }
  });
});

describe("condition grammar and tokenizer", () => {
  it("is three-valued: unknown is not false", () => {
    const allOf = { all: [{ field: "seasonal", op: "eq", value: true }, { field: "region", op: "eq", value: "cn" }] } as const;
    expect(evaluateCondition(allOf as never, { seasonal: true })).toEqual({ state: "unknown", missing: ["region"] });
    expect(evaluateCondition(allOf as never, { seasonal: false })).toEqual({ state: "false", missing: [] });
    const anyOf = { any: [{ field: "seasonal", op: "eq", value: true }, { field: "region", op: "in", value: ["cn", "vn"] }] } as const;
    expect(evaluateCondition(anyOf as never, { region: "vn" }).state).toBe("true");
    expect(evaluateCondition(anyOf as never, {}).state).toBe("unknown");
    expect(evaluateCondition(anyOf as never, { seasonal: false, region: "global" }).state).toBe("false");
  });

  it("exists distinguishes null (known empty) from missing (unknown)", () => {
    const exists = { field: "ruleset", op: "exists" } as const;
    expect(evaluateCondition(exists, {}).state).toBe("unknown");
    expect(evaluateCondition(exists, { ruleset: null }).state).toBe("false");
    expect(evaluateCondition(exists, { ruleset: "s26" }).state).toBe("true");
  });

  it("folds Vietnamese diacritics and tokenizes Chinese into unigrams + bigrams", () => {
    expect(foldText("Nhiều Hột Đỏ")).toBe("nhieu hot do");
    expect(tokenize("nhiều hột")).toEqual(["nhieu", "hot"]);
    expect(tokenize("装备")).toEqual(["装", "备", "装备"]);
    expect(tokenize("SP Quách Gia 武将")).toEqual(["sp", "quach", "gia", "武", "将", "武将"]);
  });
});
