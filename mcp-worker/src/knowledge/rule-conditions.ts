import {
  CONTEXT_FIELD_SPECS,
  SCOPE_FIELD_NAMES,
  type Condition,
  type ContextFieldName,
  type KnowledgeContext,
  type Rule,
  type Scalar,
} from "./rule-contracts.js";

export type Truth = "true" | "false" | "unknown";

export interface Evaluation {
  state: Truth;
  /** Field chưa biết làm kết quả không xác định; chỉ có khi state = unknown. */
  missing: string[];
}

type ContextValue = Scalar | null | undefined;

function contextValue(context: KnowledgeContext, field: ContextFieldName): ContextValue {
  return context[field];
}

function evaluateLeaf(
  condition: Extract<Condition, { field: ContextFieldName }>,
  context: KnowledgeContext,
): Evaluation {
  const actual = contextValue(context, condition.field);
  if (actual === undefined) return { state: "unknown", missing: [condition.field] };
  if (condition.op === "exists") return { state: actual === null ? "false" : "true", missing: [] };
  if (actual === null) return { state: "false", missing: [] };
  const matches =
    condition.op === "eq" ? actual === condition.value : condition.value.includes(actual);
  return { state: matches ? "true" : "false", missing: [] };
}

/** Logic ba trị: unknown không bao giờ bị coi là false. */
export function evaluateCondition(condition: Condition, context: KnowledgeContext): Evaluation {
  if ("all" in condition) {
    const parts = condition.all.map((part) => evaluateCondition(part, context));
    if (parts.some((part) => part.state === "false")) return { state: "false", missing: [] };
    const missing = parts.flatMap((part) => part.missing);
    return missing.length > 0 || parts.some((part) => part.state === "unknown")
      ? { state: "unknown", missing: [...new Set(missing)].sort() }
      : { state: "true", missing: [] };
  }
  if ("any" in condition) {
    const parts = condition.any.map((part) => evaluateCondition(part, context));
    if (parts.some((part) => part.state === "true")) return { state: "true", missing: [] };
    const missing = parts.flatMap((part) => part.missing);
    return parts.some((part) => part.state === "unknown")
      ? { state: "unknown", missing: [...new Set(missing)].sort() }
      : { state: "false", missing: [] };
  }
  return evaluateLeaf(condition, context);
}

/** `when` và `scope` của rule gộp thành một phép AND ba trị. */
export function evaluateRuleApplicability(rule: Rule, context: KnowledgeContext): Evaluation {
  const parts: Condition[] = [];
  for (const field of SCOPE_FIELD_NAMES) {
    const wanted = rule.scope[field];
    if (wanted !== undefined) parts.push({ field, op: "eq", value: wanted });
  }
  if (rule.when !== null) parts.push(rule.when);
  return parts.length === 0
    ? { state: "true", missing: [] }
    : evaluateCondition({ all: parts }, context);
}

export function conditionDepth(condition: Condition): number {
  if ("all" in condition) return 1 + Math.max(...condition.all.map(conditionDepth));
  if ("any" in condition) return 1 + Math.max(...condition.any.map(conditionDepth));
  return 1;
}

export function conditionLeaves(
  condition: Condition,
): Extract<Condition, { field: ContextFieldName }>[] {
  if ("all" in condition) return condition.all.flatMap(conditionLeaves);
  if ("any" in condition) return condition.any.flatMap(conditionLeaves);
  return [condition];
}

/** Kiểm giá trị literal có đúng kiểu/enum của field (typed values). */
export function scalarMatchesField(field: ContextFieldName, value: Scalar): boolean {
  const spec: { type: string; values?: readonly string[] } = CONTEXT_FIELD_SPECS[field];
  if (typeof value !== spec.type) return false;
  return spec.values === undefined || spec.values.includes(value as string);
}

/**
 * Top-level `eq` bắt buộc trong một `when` (cấu trúc all/leaf); dùng để quyết định hai rule
 * có thể cùng áp dụng hay không. `any` bị coi là không ràng buộc (bảo thủ → có thể chồng lấn).
 */
export function pinnedValues(
  when: Condition | null,
  scope: Rule["scope"],
): Map<string, Scalar> {
  const pinned = new Map<string, Scalar>();
  for (const field of SCOPE_FIELD_NAMES) {
    const value = scope[field];
    if (value !== undefined) pinned.set(field, value);
  }
  const visit = (condition: Condition): void => {
    if ("all" in condition) condition.all.forEach(visit);
    else if (!("any" in condition) && condition.op === "eq") pinned.set(condition.field, condition.value);
  };
  if (when !== null) visit(when);
  return pinned;
}

/** Gấp dấu, bỏ dấu tiếng Việt; Latin tách theo [a-z0-9]+; Hán: unigram + bigram. */
export function foldText(text: string): string {
  let folded = "";
  for (const char of text.normalize("NFKC").toLowerCase().normalize("NFD")) {
    if (!/\p{Mn}/u.test(char)) folded += char;
  }
  return folded.replace(/đ/gu, "d");
}

export function tokenize(text: string): string[] {
  const folded = foldText(text);
  const tokens: string[] = [...(folded.match(/[a-z0-9]+/gu) ?? [])];
  for (const segment of folded.match(/[\u3400-\u9fff]+/gu) ?? []) {
    const chars = [...segment];
    tokens.push(...chars);
    for (let index = 0; index + 1 < chars.length; index += 1) {
      tokens.push(`${chars[index]}${chars[index + 1]}`);
    }
  }
  return tokens;
}
