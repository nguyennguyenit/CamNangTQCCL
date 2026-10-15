/**
 * Hợp đồng dữ liệu cho knowledge dataset (`agent-knowledge/`).
 *
 * Module thuần: không `node:*`, không DOM — chạy được trong Worker và CLI.
 * Nguồn duy nhất cho schema; `schemas/*.schema.json` được sinh từ đây.
 */
import { z } from "zod";

export const KNOWLEDGE_SCHEMA_VERSION = 1 as const;
export const TOKENIZER_ID = "vi-fold-zh-ngram-v1" as const;
export const RANKER_ID = "bm25-weighted-v1" as const;

export const WORKFLOW_IDS = ["lookup", "coexist", "research"] as const;
export type WorkflowId = (typeof WORKFLOW_IDS)[number];

/** 7 tên tool MCP cuối cùng; `tqccl_search_rules` cố ý không nằm trong danh sách. */
export const KNOWLEDGE_TOOL_NAMES = [
  "tqccl_get_playbook",
  "tqccl_search",
  "tqccl_get_entity",
  "tqccl_find_teams",
  "tqccl_get_team",
  "tqccl_normalize_entities",
  "tqccl_recommend_teams",
] as const;
export type KnowledgeToolName = (typeof KNOWLEDGE_TOOL_NAMES)[number];

export const RULE_KINDS = ["invariant", "guidance", "preference"] as const;
export const RULE_STATUSES = ["candidate", "active", "deprecated"] as const;
export const RULE_ORIGINS = [
  "existing-project-contract",
  "design-proposal",
  "skill-migration",
] as const;
export const ACTION_TYPES = [
  "require-context",
  "disallow-claim",
  "show-warning",
  "prefer-output-format",
  "route-workflow",
] as const;

export const KNOWLEDGE_ERROR_CODES = [
  "KNOWLEDGE_VERSION_CHANGED",
  "KNOWLEDGE_UNAVAILABLE",
  "RULE_SCOPE_INVALID",
  "PLAYBOOK_NOT_FOUND",
  "INVALID_REQUEST",
] as const;
export type KnowledgeErrorCode = (typeof KNOWLEDGE_ERROR_CODES)[number];

export class KnowledgeError extends Error {
  readonly code: KnowledgeErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: KnowledgeErrorCode,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "KnowledgeError";
    this.code = code;
    this.details = details;
  }
}

/**
 * Allowlist các fact mà điều kiện/scope được phép tham chiếu.
 * Fact vắng trong context = unknown (không phải false); `null` = đã biết là trống.
 */
export const CONTEXT_FIELD_SPECS = {
  seasonal: { type: "boolean" },
  configChanged: { type: "boolean" },
  rosterKnown: { type: "boolean" },
  requireAvailable: { type: "boolean" },
  region: { type: "string", values: ["cn", "global", "vn"] },
  locale: { type: "string", values: ["vi", "zh"] },
  ruleset: { type: "string" },
  sourceSeasonId: { type: "string" },
  externalCallsRemaining: { type: "number" },
} as const satisfies Record<
  string,
  { type: "boolean" | "string" | "number"; values?: readonly string[] }
>;
export type ContextFieldName = keyof typeof CONTEXT_FIELD_SPECS;
export const CONTEXT_FIELD_NAMES = Object.keys(CONTEXT_FIELD_SPECS) as [
  ContextFieldName,
  ...ContextFieldName[],
];
export const SCOPE_FIELD_NAMES = [
  "region",
  "locale",
  "ruleset",
  "sourceSeasonId",
] as const satisfies readonly ContextFieldName[];

const idSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/u);
const slugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/u);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u);
const boundedString = (max: number) => z.string().min(1).max(max);

const contextFieldSchema = z.enum(CONTEXT_FIELD_NAMES);
const workflowSchema = z.enum(WORKFLOW_IDS);
const scalarSchema = z.union([z.string().max(128), z.number().finite(), z.boolean()]);

export type Scalar = string | number | boolean;
export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { field: ContextFieldName; op: "eq"; value: Scalar }
  | { field: ContextFieldName; op: "in"; value: Scalar[] }
  | { field: ContextFieldName; op: "exists" };

export const ConditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.strictObject({ all: z.array(ConditionSchema).min(1).max(16) }),
    z.strictObject({ any: z.array(ConditionSchema).min(1).max(16) }),
    z.strictObject({ field: contextFieldSchema, op: z.literal("eq"), value: scalarSchema }),
    z.strictObject({
      field: contextFieldSchema,
      op: z.literal("in"),
      value: z.array(scalarSchema).min(1).max(32),
    }),
    z.strictObject({ field: contextFieldSchema, op: z.literal("exists") }),
  ]),
);

export const ScopeSchema = z.strictObject({
  region: z.enum(CONTEXT_FIELD_SPECS.region.values).optional(),
  locale: z.enum(CONTEXT_FIELD_SPECS.locale.values).optional(),
  ruleset: boundedString(64).optional(),
  sourceSeasonId: boundedString(64).optional(),
});
export type RuleScope = z.infer<typeof ScopeSchema>;

export const ActionSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("require-context"),
    fields: z.array(contextFieldSchema).min(1).max(8),
  }),
  z.strictObject({ type: z.literal("disallow-claim"), claim: slugSchema }),
  z.strictObject({ type: z.literal("show-warning"), code: slugSchema }),
  z.strictObject({
    type: z.literal("prefer-output-format"),
    outputKey: slugSchema,
    format: slugSchema,
  }),
  z.strictObject({ type: z.literal("route-workflow"), workflow: workflowSchema }),
]);
export type RuleAction = z.infer<typeof ActionSchema>;

export const RuleSchema = z.strictObject({
  id: idSchema,
  revision: z.number().int().min(1),
  kind: z.enum(RULE_KINDS),
  status: z.enum(RULE_STATUSES),
  workflows: z.array(workflowSchema).min(1).max(3),
  stage: slugSchema.nullable(),
  scope: ScopeSchema,
  when: ConditionSchema.nullable(),
  action: ActionSchema,
  title: boundedString(120),
  terms: z.string().max(400),
  explanation: boundedString(1500),
  sourceRefs: z.array(boundedString(200)).min(1).max(8),
  origin: z.enum(RULE_ORIGINS),
  validFrom: dateSchema,
  reviewAfter: dateSchema,
  supersedes: z.array(idSchema).max(8),
  successor: idSchema.nullable(),
  regressionCaseIds: z.array(boundedString(80)).max(16),
});
export type Rule = z.infer<typeof RuleSchema>;

export const WorkflowCardSchema = z.strictObject({
  id: workflowSchema,
  title: boundedString(120),
  summary: boundedString(600),
  stages: z
    .array(z.strictObject({ id: slugSchema, title: boundedString(120), goal: boundedString(400) }))
    .min(1)
    .max(12),
  nextTools: z
    .array(
      z.strictObject({
        stage: slugSchema,
        tool: z.enum(KNOWLEDGE_TOOL_NAMES),
        purpose: boundedString(300),
      }),
    )
    .max(24),
  handoffs: z
    .array(
      z.strictObject({
        to: workflowSchema,
        when: boundedString(300),
        returnTo: workflowSchema,
      }),
    )
    .max(6),
  outputChecklist: z.array(boundedString(300)).min(1).max(24),
  errorRecovery: z
    .array(z.strictObject({ code: boundedString(64), action: boundedString(400) }))
    .min(1)
    .max(24),
});
export type WorkflowCard = z.infer<typeof WorkflowCardSchema>;

export const WorkflowFileSchema = z.strictObject({
  schemaVersion: z.literal(KNOWLEDGE_SCHEMA_VERSION),
  workflows: z.array(WorkflowCardSchema).min(1).max(3),
});
export type WorkflowFile = z.infer<typeof WorkflowFileSchema>;

export const AliasFileSchema = z.strictObject({
  schemaVersion: z.literal(KNOWLEDGE_SCHEMA_VERSION),
  aliases: z
    .array(
      z.strictObject({
        forms: z.array(boundedString(120)).min(1).max(16),
        ruleIds: z.array(idSchema).min(1).max(8),
      }),
    )
    .max(256),
});
export type AliasFile = z.infer<typeof AliasFileSchema>;

export const ManifestSchema = z.strictObject({
  schemaVersion: z.literal(KNOWLEDGE_SCHEMA_VERSION),
  dataset: z.literal("tqccl-agent-knowledge"),
  locales: z.array(z.enum(["vi", "zh"])).min(1),
  tokenizer: z.literal(TOKENIZER_ID),
  ranker: z.literal(RANKER_ID),
  compatibility: z.strictObject({ core: z.literal(KNOWLEDGE_SCHEMA_VERSION) }),
  files: z.strictObject({
    workflows: boundedString(120),
    aliases: boundedString(120),
    rules: z.array(boundedString(120)).min(1).max(16),
  }),
});
export type KnowledgeManifest = z.infer<typeof ManifestSchema>;

export const KnowledgeBundleSchema = z.strictObject({
  schemaVersion: z.literal(KNOWLEDGE_SCHEMA_VERSION),
  manifest: ManifestSchema,
  workflows: WorkflowFileSchema,
  aliases: AliasFileSchema,
  rules: z.array(RuleSchema).max(512),
});
export type KnowledgeBundle = z.infer<typeof KnowledgeBundleSchema>;

/** Context do caller cung cấp; khóa lạ hoặc sai kiểu bị từ chối (INVALID_REQUEST). */
export const ContextSchema = z.strictObject({
  seasonal: z.boolean().nullable().optional(),
  configChanged: z.boolean().nullable().optional(),
  rosterKnown: z.boolean().nullable().optional(),
  requireAvailable: z.boolean().nullable().optional(),
  region: z.enum(CONTEXT_FIELD_SPECS.region.values).nullable().optional(),
  locale: z.enum(CONTEXT_FIELD_SPECS.locale.values).nullable().optional(),
  ruleset: boundedString(64).nullable().optional(),
  sourceSeasonId: boundedString(64).nullable().optional(),
  externalCallsRemaining: z.number().int().min(0).max(1_000_000).nullable().optional(),
});
export type KnowledgeContext = z.infer<typeof ContextSchema>;

export const MAX_QUERY_LENGTH = 256;
export const DEFAULT_LIMIT = 3;
export const MAX_LIMIT = 10;
export const MAX_RULE_IDS = 20;

export const SearchRulesInputSchema = z.strictObject({
  query: z.string().max(MAX_QUERY_LENGTH),
  workflow: workflowSchema,
  stage: slugSchema.optional(),
  context: ContextSchema.optional(),
  expectedKnowledgeVersion: boundedString(128).optional(),
  limit: z.number().int().min(1).max(MAX_LIMIT).optional(),
  ruleIds: z.array(idSchema).max(MAX_RULE_IDS).optional(),
  diagnostics: z.boolean().optional(),
});
export type SearchRulesInput = z.infer<typeof SearchRulesInputSchema>;

export const PlaybookInputSchema = z.strictObject({
  intent: workflowSchema,
  stage: slugSchema.optional(),
  context: ContextSchema.optional(),
  expectedKnowledgeVersion: boundedString(128).optional(),
});
export type PlaybookInput = z.infer<typeof PlaybookInputSchema>;

/** Work packet bàn giao giữa workflow (design §4). Không chứa transcript/token/ảnh thô. */
export const WorkPacketSchema = z.strictObject({
  taskId: boundedString(80),
  topicId: boundedString(80),
  ownerWorkflow: workflowSchema,
  returnTo: workflowSchema,
  requestedOutcome: boundedString(500),
  scope: z.strictObject({
    sourceSeasonId: boundedString(64).nullable(),
    scenario: boundedString(64).nullable(),
    ruleset: boundedString(64).nullable(),
    region: z.enum(["cn", "global", "vn", "unknown"]),
    locale: z.enum(["vi", "zh"]),
    provenance: z.record(z.string().max(64), boundedString(200)),
  }),
  entityRefs: z.array(boundedString(120)).max(64),
  referenceRefs: z.array(boundedString(160)).max(64),
  canonicalStateRef: boundedString(200).nullable(),
  confirmationBinding: boundedString(200).nullable(),
  claims: z
    .array(
      z.strictObject({
        claimId: boundedString(80),
        status: z.enum(["da-doi-chieu", "phuong-an-tu-nguon", "chua-xac-minh"]),
        scope: boundedString(200),
        evidenceRefs: z.array(boundedString(300)).max(16),
      }),
    )
    .max(64),
  unresolved: z.array(boundedString(300)).max(32),
  budget: z.strictObject({
    topicId: boundedString(80),
    limit: z.number().int().min(0),
    used: z.number().int().min(0),
    remaining: z.number().int().min(0),
  }),
  versions: z.strictObject({
    gameReleaseId: boundedString(128).nullable(),
    workflowVersion: boundedString(160).nullable(),
    knowledgeVersion: boundedString(128),
    skillVersion: boundedString(64).nullable(),
  }),
  appliedRuleIds: z.array(idSchema).max(128),
});
export type WorkPacket = z.infer<typeof WorkPacketSchema>;

/** Rule ở dạng trả cho consumer (không lộ trường nội bộ như terms/regressionCaseIds). */
export interface PublicRule {
  ruleId: string;
  revision: number;
  kind: Rule["kind"];
  stage: string | null;
  title: string;
  explanation: string;
  action: RuleAction;
  sourceRefs: string[];
}

/** Invariant bắt buộc kèm trạng thái điều kiện: met = điều kiện đúng/không có; unresolved = còn fact chưa biết. */
export interface RequiredRule extends PublicRule {
  conditionStatus: "met" | "unresolved";
}

export interface UnresolvedCondition {
  ruleId: string;
  kind: Rule["kind"];
  missing: string[];
}

/** Một bản knowledge đã đóng gói kèm version của nó. */
export interface KnowledgeSource {
  bundle: KnowledgeBundle;
  version: string;
}
