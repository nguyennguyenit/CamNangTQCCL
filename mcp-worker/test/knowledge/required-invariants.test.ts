import { describe, expect, it } from "vitest";

import { resolvePlaybookKnowledge } from "../../src/knowledge/resolve-playbook.js";
import { evaluateRuleApplicability } from "../../src/knowledge/rule-conditions.js";
import type { Rule, WorkflowId } from "../../src/knowledge/rule-contracts.js";
import { searchRules } from "../../src/knowledge/search-rules.js";
import { ids, makeRule, makeSource, realSource } from "./helpers.js";

const workflows = realSource.bundle.workflows.workflows;

function activeInvariants(workflow: WorkflowId, stage: string | null): Rule[] {
  return realSource.bundle.rules.filter(
    (rule) =>
      rule.kind === "invariant" &&
      rule.status === "active" &&
      rule.workflows.includes(workflow) &&
      (stage === null || rule.stage === null || rule.stage === stage),
  );
}

describe("required invariants — unknown is not false", () => {
  for (const card of workflows) {
    for (const stage of [null, ...card.stages.map((entry) => entry.id)]) {
      it(`${card.id}/${stage ?? "*"}: all-unknown context requires every active invariant`, () => {
        const expected = activeInvariants(card.id, stage).filter(
          (rule) => evaluateRuleApplicability(rule, {}).state !== "false",
        );
        const search = searchRules({ query: "zzzxxyy", workflow: card.id, ...(stage === null ? {} : { stage }) });
        const playbook = resolvePlaybookKnowledge({ intent: card.id, ...(stage === null ? {} : { stage }) });
        for (const result of [search, playbook]) {
          expect(ids(result.requiredRules)).toEqual(expect.arrayContaining(ids(expected.map((rule) => ({ ruleId: rule.id })))));
          expect(result.requiredRules.length).toBe(expected.length);
          const unresolved = new Set(result.unresolvedConditions.map((entry) => entry.ruleId));
          for (const required of result.requiredRules) {
            const rule = expected.find((candidate) => candidate.id === required.ruleId)!;
            const state = evaluateRuleApplicability(rule, {}).state;
            expect(required.conditionStatus).toBe(state === "true" ? "met" : "unresolved");
            expect(unresolved.has(required.ruleId)).toBe(required.conditionStatus === "unresolved");
          }
        }
        expect(search.abstained).toBe(true);
      });
    }
  }

  it("keeps a conditional invariant required as unresolved and reports what is missing", () => {
    const result = searchRules({ query: "mùa", workflow: "coexist" });
    expect(result.requiredRules.find((rule) => rule.ruleId === "verified-season-pair")?.conditionStatus).toBe(
      "unresolved",
    );
    expect(result.unresolvedConditions).toContainEqual({
      ruleId: "verified-season-pair",
      kind: "invariant",
      missing: ["seasonal"],
    });
  });

  it("marks a satisfied condition as met and not unresolved", () => {
    const result = searchRules({ query: "", workflow: "coexist", context: { seasonal: true } });
    expect(result.requiredRules.find((rule) => rule.ruleId === "verified-season-pair")?.conditionStatus).toBe("met");
    expect(result.unresolvedConditions.some((entry) => entry.ruleId === "verified-season-pair")).toBe(false);
  });

  it("excludes only invariants whose condition is definitively false", () => {
    const source = makeSource([
      makeRule({ id: "always", kind: "invariant" }),
      makeRule({ id: "cond-true", kind: "invariant", when: { field: "seasonal", op: "eq", value: true } }),
      makeRule({ id: "cond-false", kind: "invariant", when: { field: "seasonal", op: "eq", value: false } }),
      makeRule({ id: "cond-other", kind: "invariant", when: { field: "configChanged", op: "eq", value: true } }),
    ]);
    const context = { seasonal: true };
    const search = searchRules({ query: "", workflow: "coexist", context }, { knowledge: source });
    const playbook = resolvePlaybookKnowledge({ intent: "coexist", context }, { knowledge: source });
    for (const result of [search, playbook]) {
      expect(ids(result.requiredRules)).toEqual(["always", "cond-other", "cond-true"]);
      expect(Object.fromEntries(result.requiredRules.map((rule) => [rule.ruleId, rule.conditionStatus]))).toEqual({
        always: "met",
        "cond-true": "met",
        "cond-other": "unresolved",
      });
      expect(ids(result.unresolvedConditions)).toEqual(["cond-other"]);
    }
  });
});
