import { KNOWLEDGE_BUNDLE, KNOWLEDGE_VERSION } from "../generated/knowledge-bundle.js";
import { evaluateRuleApplicability, foldText, tokenize } from "./rule-conditions.js";
import {
  DEFAULT_LIMIT,
  KnowledgeError,
  SearchRulesInputSchema,
  type KnowledgeBundle,
  type KnowledgeContext,
  type KnowledgeSource,
  type PublicRule,
  type RequiredRule,
  type Rule,
  type SearchRulesInput,
  type UnresolvedCondition,
  type WorkflowId,
} from "./rule-contracts.js";
import { validateKnowledgeBundle } from "./validate-knowledge.js";

/**
 * Ngân sách toàn bộ kết quả tool (JSON.stringify), chừa đệm dưới trần 40.000 ký tự của dispatcher.
 * Đo bằng byte UTF-8 của JSON (≥ số ký tự) nên luôn bảo thủ so với trần ký tự.
 */
export const RESULT_CHAR_BUDGET = 38_000;
/** Trần phần guidance trả về; thực tế còn bị giới hạn bởi RESULT_CHAR_BUDGET trừ phần còn lại. */
export const GUIDANCE_BYTE_TARGET = 16 * 1024;
/** Ngưỡng lexical chưa calibrate (xem `calibration` trong kết quả). */
export const MIN_RETRIEVAL_SCORE = 0.5;
export const MIN_QUERY_COVERAGE = 0.4;

const FIELD_WEIGHTS = { title: 3, terms: 2, explanation: 1 } as const;
/** Alias/ruleId khớp chính xác luôn xếp trước BM25. */
const ALIAS_MATCH_SCORE = 1e9;
const BM25_K1 = 1.5;
const BM25_B = 0.75;

const encoder = new TextEncoder();

export function byteLength(value: unknown): number {
  return encoder.encode(JSON.stringify(value)).length;
}

export function defaultKnowledgeSource(): KnowledgeSource {
  return { bundle: KNOWLEDGE_BUNDLE, version: KNOWLEDGE_VERSION };
}

const validated = new WeakSet<KnowledgeBundle>();

/** Validate bundle một lần cho mỗi object; hỏng → KNOWLEDGE_UNAVAILABLE. */
export function loadKnowledge(
  source: KnowledgeSource | undefined,
  expectedKnowledgeVersion: string | undefined,
): KnowledgeSource {
  const knowledge = source ?? defaultKnowledgeSource();
  if (!validated.has(knowledge.bundle)) {
    const result = validateKnowledgeBundle(knowledge.bundle);
    if (!result.ok) {
      throw new KnowledgeError("KNOWLEDGE_UNAVAILABLE", "Knowledge dataset không hợp lệ.", {
        issues: result.issues.slice(0, 5),
      });
    }
    validated.add(knowledge.bundle);
  }
  if (expectedKnowledgeVersion !== undefined && expectedKnowledgeVersion !== knowledge.version) {
    throw new KnowledgeError(
      "KNOWLEDGE_VERSION_CHANGED",
      "Knowledge đã đổi phiên bản; gọi lại playbook để lấy bản mới.",
      { expected: expectedKnowledgeVersion, actual: knowledge.version },
    );
  }
  return knowledge;
}

export function parseInput<T>(
  schema: { safeParse(input: unknown): { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } },
  input: unknown,
): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new KnowledgeError("INVALID_REQUEST", "Input không hợp lệ.", {
      fields: [...new Set(parsed.error.issues.map((issue) => issue.path.map(String).join(".")))],
    });
  }
  return parsed.data;
}

export function toPublicRule(rule: Rule): PublicRule {
  return {
    ruleId: rule.id,
    revision: rule.revision,
    kind: rule.kind,
    stage: rule.stage,
    title: rule.title,
    explanation: rule.explanation,
    action: rule.action,
    sourceRefs: rule.sourceRefs,
  };
}

export interface RequiredSelection {
  rule: Rule;
  conditionStatus: RequiredRule["conditionStatus"];
}

export function toRequiredRule(entry: RequiredSelection): RequiredRule {
  return { ...toPublicRule(entry.rule), conditionStatus: entry.conditionStatus };
}

export interface RuleSelection {
  required: RequiredSelection[];
  candidates: Rule[];
  unresolved: UnresolvedCondition[];
}

/**
 * Chọn rule áp dụng: active + đúng workflow/stage + điều kiện/scope.
 * Mọi invariant có điều kiện không-false đều vào `required` (met | unresolved), không phụ thuộc
 * query hay top-k. Điều kiện unknown ≠ false: invariant unknown vẫn required và được liệt kê
 * trong `unresolved`; chỉ điều kiện false mới loại. Guidance/preference unknown chỉ vào `unresolved`.
 */
export function selectRules(
  bundle: KnowledgeBundle,
  workflow: WorkflowId,
  stage: string | null,
  context: KnowledgeContext,
): RuleSelection {
  const required: RequiredSelection[] = [];
  const candidates: Rule[] = [];
  const unresolved: UnresolvedCondition[] = [];
  for (const rule of bundle.rules) {
    if (rule.status !== "active" || !rule.workflows.includes(workflow)) continue;
    if (stage !== null && rule.stage !== null && rule.stage !== stage) continue;
    const applicability = evaluateRuleApplicability(rule, context);
    if (applicability.state === "false") continue;
    if (applicability.state === "unknown") {
      unresolved.push({ ruleId: rule.id, kind: rule.kind, missing: applicability.missing });
      if (rule.kind === "invariant") required.push({ rule, conditionStatus: "unresolved" });
      continue;
    }
    if (rule.kind === "invariant") required.push({ rule, conditionStatus: "met" });
    else candidates.push(rule);
  }
  const byId = (a: Rule, b: Rule): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  required.sort((a, b) => (a.rule.id < b.rule.id ? -1 : a.rule.id > b.rule.id ? 1 : 0));
  candidates.sort(byId);
  unresolved.sort((a, b) => (a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0));
  return { required, candidates, unresolved };
}

/** Required không được cắt: vượt `limit` (mặc định cả ngân sách kết quả) thì lỗi để người gọi chọn stage hẹp hơn. */
export function assertRequiredFits(
  requiredRules: RequiredRule[],
  stage: string | null,
  limit: number = RESULT_CHAR_BUDGET,
): void {
  const bytes = byteLength(requiredRules);
  if (bytes > limit) {
    throw new KnowledgeError(
      "RULE_SCOPE_INVALID",
      "Required rules vượt giới hạn kích thước; chọn stage hẹp hơn thay vì cắt bớt.",
      { reason: "required-overflow", requiredBytes: bytes, limit, stage },
    );
  }
}

/** Giữ tối đa phần đầu của danh sách sao cho JSON mảng ≤ target byte. */
export function fitGuidance<T>(items: T[], target: number): { kept: T[]; bytes: number } {
  const kept: T[] = [];
  let bytes = 2;
  for (const item of items) {
    const next = bytes + byteLength(item) + (kept.length > 0 ? 1 : 0);
    if (next > target) break;
    kept.push(item);
    bytes = next;
  }
  return { kept, bytes };
}

function weightedDocument(rule: Rule): Map<string, number> {
  const frequencies = new Map<string, number>();
  for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
    for (const token of tokenize(rule[field as keyof typeof FIELD_WEIGHTS])) {
      frequencies.set(token, (frequencies.get(token) ?? 0) + weight);
    }
  }
  return frequencies;
}

interface RankedRule {
  rule: Rule;
  score: number;
  matchedTerms: string[];
}

function rankBm25(candidates: Rule[], queryTerms: string[]): RankedRule[] {
  const documents = candidates.map(weightedDocument);
  const lengths = documents.map((doc) => [...doc.values()].reduce((sum, value) => sum + value, 0));
  const average = lengths.reduce((sum, value) => sum + value, 0) / Math.max(lengths.length, 1) || 1;
  const documentFrequency = new Map<string, number>();
  for (const doc of documents) {
    for (const term of doc.keys()) documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
  }
  const ranked: RankedRule[] = [];
  candidates.forEach((rule, index) => {
    const doc = documents[index];
    if (doc === undefined) return;
    let score = 0;
    const matched: string[] = [];
    for (const term of queryTerms) {
      const tf = doc.get(term) ?? 0;
      if (tf === 0) continue;
      const df = documentFrequency.get(term) ?? 0;
      const idf = Math.log(1 + (documents.length - df + 0.5) / (df + 0.5));
      const length = lengths[index] ?? 0;
      score += (idf * tf * (BM25_K1 + 1)) / (tf + BM25_K1 * (1 - BM25_B + (BM25_B * length) / average));
      matched.push(term);
    }
    if (score > 0) ranked.push({ rule, score: Math.round(score * 1e6) / 1e6, matchedTerms: matched });
  });
  return ranked.sort((a, b) => b.score - a.score || (a.rule.id < b.rule.id ? -1 : 1));
}

function termsContainPhrase(queryTokens: string[], phraseTokens: string[]): boolean {
  if (phraseTokens.length === 0 || phraseTokens.length > queryTokens.length) return false;
  for (let start = 0; start + phraseTokens.length <= queryTokens.length; start += 1) {
    if (phraseTokens.every((token, offset) => queryTokens[start + offset] === token)) return true;
  }
  return false;
}

export interface GuidanceHit extends PublicRule {
  retrievalScore: number;
  matchedTerms: string[];
  matchedBy: "alias" | "bm25";
}

export interface ExactRuleResult {
  rule: PublicRule;
  status: Rule["status"];
  /** Rule deprecated trỏ tới bản thay thế; null nếu còn hiệu lực. */
  successor: string | null;
  applicable: boolean;
}

export interface SearchRulesResult {
  knowledgeVersion: string;
  workflow: WorkflowId;
  stage: string | null;
  requiredRules: RequiredRule[];
  exactRules: ExactRuleResult[];
  unknownRuleIds: string[];
  guidance: GuidanceHit[];
  unresolvedConditions: UnresolvedCondition[];
  matchedTerms: string[];
  abstained: boolean;
  abstentionReason: "empty-query" | "no-lexical-match" | "weak-match" | null;
  guidanceBytes: number;
  guidanceTruncated: boolean;
  calibration: "not-calibrated";
  scoreMeaning: "lexical-relevance-only";
  diagnostics?: {
    candidateCount: number;
    queryTermCount: number;
    coverage: number;
    topScore: number;
    thresholds: { minScore: number; minCoverage: number };
  };
}

function exactRules(
  bundle: KnowledgeBundle,
  ruleIds: string[],
  workflow: WorkflowId,
  context: KnowledgeContext,
): { found: ExactRuleResult[]; unknown: string[] } {
  const found: ExactRuleResult[] = [];
  const unknown: string[] = [];
  for (const ruleId of [...new Set(ruleIds)]) {
    const rule = bundle.rules.find((candidate) => candidate.id === ruleId);
    if (rule === undefined) {
      unknown.push(ruleId);
      continue;
    }
    if (!rule.workflows.includes(workflow)) {
      throw new KnowledgeError("RULE_SCOPE_INVALID", `Rule "${ruleId}" không thuộc workflow "${workflow}".`, {
        ruleId,
        workflow,
        ruleWorkflows: rule.workflows,
      });
    }
    const applicability = evaluateRuleApplicability(rule, context);
    if (applicability.state === "false") {
      throw new KnowledgeError("RULE_SCOPE_INVALID", `Rule "${ruleId}" không áp dụng cho scope đã cho.`, { ruleId });
    }
    found.push({
      rule: toPublicRule(rule),
      status: rule.status,
      successor: rule.successor,
      applicable: rule.status === "active" && applicability.state === "true",
    });
  }
  return { found, unknown };
}

export function searchRules(input: unknown, options: { knowledge?: KnowledgeSource } = {}): SearchRulesResult {
  const request: SearchRulesInput = parseInput(SearchRulesInputSchema, input);
  const knowledge = loadKnowledge(options.knowledge, request.expectedKnowledgeVersion);
  const { bundle } = knowledge;
  const context = request.context ?? {};
  const stage = request.stage ?? null;
  const card = bundle.workflows.workflows.find((workflow) => workflow.id === request.workflow);
  if (card === undefined || (stage !== null && !card.stages.some((entry) => entry.id === stage))) {
    throw new KnowledgeError("PLAYBOOK_NOT_FOUND", "Workflow hoặc stage không có playbook.", {
      workflow: request.workflow,
      stage,
    });
  }

  const exact = exactRules(bundle, request.ruleIds ?? [], request.workflow, context);
  const selection = selectRules(bundle, request.workflow, stage, context);
  const requiredRules = selection.required.map(toRequiredRule);
  assertRequiredFits(requiredRules, stage);

  const queryTokens = tokenize(request.query);
  const queryTerms = [...new Set(queryTokens)];
  const hits: GuidanceHit[] = [];
  const aliasMatched = new Set<string>();
  for (const entry of bundle.aliases.aliases) {
    if (!entry.forms.some((form) => termsContainPhrase(queryTokens, tokenize(foldText(form))))) continue;
    for (const ruleId of entry.ruleIds) {
      const rule = selection.candidates.find((candidate) => candidate.id === ruleId);
      if (rule === undefined || aliasMatched.has(ruleId)) continue;
      aliasMatched.add(ruleId);
      hits.push({ ...toPublicRule(rule), retrievalScore: ALIAS_MATCH_SCORE, matchedTerms: [], matchedBy: "alias" });
    }
  }

  const ranked = rankBm25(
    selection.candidates.filter((rule) => !aliasMatched.has(rule.id)),
    queryTerms,
  );
  const matchedTermSet = new Set(ranked.flatMap((entry) => entry.matchedTerms));
  const coverage = queryTerms.length === 0 ? 0 : matchedTermSet.size / queryTerms.length;
  const topScore = ranked[0]?.score ?? 0;
  const weak = topScore < MIN_RETRIEVAL_SCORE || coverage < MIN_QUERY_COVERAGE;
  if (!weak) {
    for (const entry of ranked) {
      if (entry.score < MIN_RETRIEVAL_SCORE) continue;
      hits.push({
        ...toPublicRule(entry.rule),
        retrievalScore: entry.score,
        matchedTerms: entry.matchedTerms,
        matchedBy: "bm25",
      });
    }
  }

  const limited = hits.slice(0, request.limit ?? DEFAULT_LIMIT);
  const { kept, bytes } = fitGuidance(limited, GUIDANCE_BYTE_TARGET);
  const abstained = kept.length === 0;
  const abstentionReason = !abstained
    ? null
    : queryTerms.length === 0
      ? "empty-query"
      : ranked.length === 0
        ? "no-lexical-match"
        : "weak-match";
  const result: SearchRulesResult = {
    knowledgeVersion: knowledge.version,
    workflow: request.workflow,
    stage,
    requiredRules,
    exactRules: exact.found,
    unknownRuleIds: exact.unknown,
    guidance: kept,
    unresolvedConditions: selection.unresolved,
    matchedTerms: [...new Set(kept.flatMap((hit) => hit.matchedTerms))].sort(),
    abstained,
    abstentionReason,
    guidanceBytes: bytes,
    guidanceTruncated: kept.length < limited.length,
    calibration: "not-calibrated",
    scoreMeaning: "lexical-relevance-only",
  };
  if (request.diagnostics === true) {
    result.diagnostics = {
      candidateCount: selection.candidates.length,
      queryTermCount: queryTerms.length,
      coverage: Math.round(coverage * 1e4) / 1e4,
      topScore,
      thresholds: { minScore: MIN_RETRIEVAL_SCORE, minCoverage: MIN_QUERY_COVERAGE },
    };
  }
  return result;
}
