import { KNOWLEDGE_BUNDLE, KNOWLEDGE_VERSION } from "../../src/generated/knowledge-bundle.js";
import type {
  KnowledgeBundle,
  KnowledgeSource,
  Rule,
} from "../../src/knowledge/rule-contracts.js";

export const realSource: KnowledgeSource = {
  bundle: KNOWLEDGE_BUNDLE,
  version: KNOWLEDGE_VERSION,
};

export function makeRule(overrides: Partial<Rule> & Pick<Rule, "id">): Rule {
  return {
    revision: 1,
    kind: "guidance",
    status: "active",
    workflows: ["coexist"],
    stage: null,
    scope: {},
    when: null,
    action: { type: "show-warning", code: "test-warning" },
    title: "Rule thử nghiệm",
    terms: "",
    explanation: "Nội dung rule thử nghiệm.",
    sourceRefs: ["test"],
    origin: "design-proposal",
    validFrom: "2026-10-08",
    reviewAfter: "2027-04-08",
    supersedes: [],
    successor: null,
    regressionCaseIds: [],
    ...overrides,
  };
}

/** Bundle tổng hợp dùng workflow cards thật nhưng rule và alias do test quyết định. */
export function makeBundle(rules: Rule[]): KnowledgeBundle {
  return {
    ...KNOWLEDGE_BUNDLE,
    aliases: { schemaVersion: 1, aliases: [] },
    rules,
  };
}

export function makeSource(rules: Rule[], version = "knowledge:test"): KnowledgeSource {
  return { bundle: makeBundle(rules), version };
}

export function ids(rules: readonly { ruleId: string }[]): string[] {
  return rules.map((rule) => rule.ruleId);
}

/** Rule không liên quan để idf của BM25 có nghĩa trong bundle tổng hợp nhỏ. */
export function noiseRules(count: number): Rule[] {
  return Array.from({ length: count }, (_, index) =>
    makeRule({
      id: `noise-${index}`,
      title: `Chủ đề khác ${index}`,
      terms: `nhiễu${index} khác${index}`,
      explanation: `Nội dung không liên quan số ${index}.`,
    }),
  );
}
