import {
  conditionDepth,
  conditionLeaves,
  foldText,
  pinnedValues,
  scalarMatchesField,
} from "./rule-conditions.js";
import {
  KnowledgeBundleSchema,
  type KnowledgeBundle,
  type Rule,
} from "./rule-contracts.js";

export type KnowledgeIssueCode =
  | "SCHEMA"
  | "DUPLICATE_RULE_ID"
  | "DUPLICATE_WORKFLOW"
  | "DUPLICATE_ALIAS"
  | "UNKNOWN_WORKFLOW"
  | "UNKNOWN_STAGE"
  | "UNKNOWN_RULE_REFERENCE"
  | "RETIRED_WITHOUT_SUCCESSOR"
  | "SUPERSEDES_MISMATCH"
  | "CONDITION_INVALID"
  | "DATE_ORDER"
  | "CONFLICT";

export interface KnowledgeIssue {
  code: KnowledgeIssueCode;
  path: string;
  message: string;
}

export type KnowledgeValidation =
  | { ok: true; bundle: KnowledgeBundle; issues: [] }
  | { ok: false; issues: KnowledgeIssue[] };

const MAX_CONDITION_DEPTH = 4;

function ruleConflict(a: Rule, b: Rule): string | null {
  if (a.action.type !== b.action.type) return null;
  const sameScope = JSON.stringify(a.scope) === JSON.stringify(b.scope);
  if (!sameScope) return null;
  if (!a.workflows.some((workflow) => b.workflows.includes(workflow))) return null;
  if (a.stage !== null && b.stage !== null && a.stage !== b.stage) return null;
  const pinsA = pinnedValues(a.when, a.scope);
  const pinsB = pinnedValues(b.when, b.scope);
  for (const [field, value] of pinsA) {
    const other = pinsB.get(field);
    if (other !== undefined && other !== value) return null;
  }
  if (a.action.type === "prefer-output-format" && b.action.type === "prefer-output-format") {
    return a.action.outputKey === b.action.outputKey && a.action.format !== b.action.format
      ? `cùng outputKey "${a.action.outputKey}" nhưng format khác nhau`
      : null;
  }
  if (a.action.type === "route-workflow" && b.action.type === "route-workflow") {
    return a.action.workflow !== b.action.workflow
      ? "cùng điều kiện nhưng route tới workflow khác nhau"
      : null;
  }
  return null;
}

function semanticIssues(bundle: KnowledgeBundle): KnowledgeIssue[] {
  const issues: KnowledgeIssue[] = [];
  const add = (code: KnowledgeIssueCode, path: string, message: string): void => {
    issues.push({ code, path, message });
  };

  const cards = new Map<string, KnowledgeBundle["workflows"]["workflows"][number]>();
  bundle.workflows.workflows.forEach((card, index) => {
    if (cards.has(card.id)) add("DUPLICATE_WORKFLOW", `workflows[${index}]`, `workflow "${card.id}" trùng`);
    cards.set(card.id, card);
    const stageIds = new Set(card.stages.map((stage) => stage.id));
    if (stageIds.size !== card.stages.length) {
      add("UNKNOWN_STAGE", `workflows[${index}].stages`, "stage id trùng trong workflow");
    }
    card.nextTools.forEach((entry, toolIndex) => {
      if (!stageIds.has(entry.stage)) {
        add("UNKNOWN_STAGE", `workflows[${index}].nextTools[${toolIndex}]`, `stage "${entry.stage}" không có trong workflow`);
      }
    });
  });

  const byId = new Map<string, Rule>();
  bundle.rules.forEach((rule, index) => {
    const path = `rules[${index}](${rule.id})`;
    if (byId.has(rule.id)) add("DUPLICATE_RULE_ID", path, `id "${rule.id}" trùng`);
    byId.set(rule.id, rule);
    if (rule.reviewAfter < rule.validFrom) add("DATE_ORDER", path, "reviewAfter nhỏ hơn validFrom");
    for (const workflow of rule.workflows) {
      const card = cards.get(workflow);
      if (card === undefined) {
        add("UNKNOWN_WORKFLOW", path, `workflow "${workflow}" không có card`);
      } else if (rule.stage !== null && !card.stages.some((stage) => stage.id === rule.stage)) {
        add("UNKNOWN_STAGE", path, `stage "${rule.stage}" không thuộc workflow "${workflow}"`);
      }
    }
    if (rule.when !== null) {
      if (conditionDepth(rule.when) > MAX_CONDITION_DEPTH) {
        add("CONDITION_INVALID", path, `điều kiện sâu quá ${MAX_CONDITION_DEPTH} cấp`);
      }
      for (const leaf of conditionLeaves(rule.when)) {
        const values = leaf.op === "eq" ? [leaf.value] : leaf.op === "in" ? leaf.value : [];
        if (values.some((value) => !scalarMatchesField(leaf.field, value))) {
          add("CONDITION_INVALID", path, `giá trị không đúng kiểu/enum của field "${leaf.field}"`);
        }
      }
    }
    if (rule.status === "deprecated" && rule.successor === null) {
      add("RETIRED_WITHOUT_SUCCESSOR", path, "rule deprecated phải có successor");
    }
    if (rule.status !== "deprecated" && rule.successor !== null) {
      add("SUPERSEDES_MISMATCH", path, "chỉ rule deprecated mới có successor");
    }
  });

  for (const rule of bundle.rules) {
    const path = `rule(${rule.id})`;
    if (rule.successor !== null) {
      const successor = byId.get(rule.successor);
      if (successor === undefined) {
        add("UNKNOWN_RULE_REFERENCE", path, `successor "${rule.successor}" không tồn tại`);
      } else {
        if (successor.status !== "active") {
          add("SUPERSEDES_MISMATCH", path, `successor "${successor.id}" chưa active`);
        }
        if (!successor.supersedes.includes(rule.id)) {
          add("SUPERSEDES_MISMATCH", path, `successor "${successor.id}" không khai báo supersedes "${rule.id}"`);
        }
      }
    }
    for (const oldId of rule.supersedes) {
      const old = byId.get(oldId);
      if (old === undefined) {
        add("UNKNOWN_RULE_REFERENCE", path, `supersedes "${oldId}" không tồn tại`);
      } else if (old.status !== "deprecated" || old.successor !== rule.id) {
        add("SUPERSEDES_MISMATCH", path, `"${oldId}" phải deprecated với successor "${rule.id}"`);
      }
    }
  }

  const active = bundle.rules.filter((rule) => rule.status === "active");
  for (let left = 0; left < active.length; left += 1) {
    for (let right = left + 1; right < active.length; right += 1) {
      const a = active[left];
      const b = active[right];
      const reason = a === undefined || b === undefined ? null : ruleConflict(a, b);
      if (reason !== null && a !== undefined && b !== undefined) {
        add("CONFLICT", `rule(${a.id}) vs rule(${b.id})`, `hai rule active cùng scope mâu thuẫn: ${reason}`);
      }
    }
  }

  const seenForms = new Map<string, string>();
  bundle.aliases.aliases.forEach((entry, index) => {
    const path = `aliases[${index}]`;
    for (const ruleId of entry.ruleIds) {
      if (!byId.has(ruleId)) add("UNKNOWN_RULE_REFERENCE", path, `alias trỏ tới rule "${ruleId}" không tồn tại`);
    }
    for (const form of entry.forms) {
      const folded = foldText(form).trim();
      const previous = seenForms.get(folded);
      if (previous !== undefined && previous !== path) {
        add("DUPLICATE_ALIAS", path, `alias "${form}" trùng với ${previous}`);
      }
      seenForms.set(folded, path);
    }
  });
  return issues;
}

/** Validate toàn bộ bundle: schema → tham chiếu → supersedes → conflict. Không throw. */
export function validateKnowledgeBundle(input: unknown): KnowledgeValidation {
  const parsed = KnowledgeBundleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        code: "SCHEMA" as const,
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  }
  const issues = semanticIssues(parsed.data);
  return issues.length === 0
    ? { ok: true, bundle: parsed.data, issues: [] }
    : { ok: false, issues };
}
