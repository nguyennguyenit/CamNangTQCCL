import { z } from "zod";
import {
  MAX_NORMALIZE_REQUEST_BYTES, boundedRequest, canonicalStateSchema, commonResultSchema, confirmationBindingSchema, seasonContextSchema, seasonId, structuredObservationSchema,
} from "./shared-schemas.js";
import { findTeamsInputSchema, findTeamsOutputSchema, getTeamInputSchema, getTeamOutputSchema } from "./team-handlers.js";
import { getEntityInputSchema, getEntityOutputSchema, searchInputSchema, searchOutputSchema } from "./catalog-handlers.js";
import { recommendTeamsInputSchema, recommendTeamsOutputSchema } from "./recommend-handlers.js";
import { getPlaybookInputSchema, getPlaybookOutputSchema } from "./playbook-handlers.js";
export { MAX_REQUEST_BYTES, canonicalStateSchema, confirmationBindingSchema, seasonContextSchema, structuredObservationSchema } from "./shared-schemas.js";

const normalizeInputSchema = z
  .object({
    seasonContext: seasonContextSchema.optional(),
    observations: z
      .array(structuredObservationSchema)
      .max(100)
      .describe("Observation đầu vào."),
  })
  .strict();


const normalizeOutputSchema = commonResultSchema.extend({
  seasonContext: seasonContextSchema.optional(),
  canonicalState: canonicalStateSchema,
  observations: z
    .array(structuredObservationSchema)
    .max(500)
    .describe("Observation chuẩn hóa."),
  reviewRequired: z
    .boolean()
    .describe("Cần rà soát ambiguity."),
  confirmationBinding: confirmationBindingSchema,
});


export const RESEARCH_TOOL_NAMES = [
  "tqccl_get_playbook",
  "tqccl_search",
  "tqccl_get_entity",
  "tqccl_find_teams",
  "tqccl_get_team",
  "tqccl_normalize_entities",
  "tqccl_recommend_teams",
] as const;

export type ResearchToolName = (typeof RESEARCH_TOOL_NAMES)[number];

function codePointCompare(a:string,b:string) {const left=Array.from(a,c=>c.codePointAt(0)!);const right=Array.from(b,c=>c.codePointAt(0)!);for(let i=0;i<Math.min(left.length,right.length);i++){if(left[i]!==right[i])return left[i]!-right[i]!;}return left.length-right.length;}
const choiceId = z.string().min(1).max(128).describe("ID cấu hình.");
export const configChoicesSchema = z.object({
  kind: z.literal("team-config").describe("Loại lựa chọn."),
  teamId: choiceId,
  configIds: z.array(choiceId).min(2).max(20).describe("ID sắp code point."),
  totalCount: z.number().int().min(2).describe("Tổng cấu hình phù hợp."),
  omittedCount: z.number().int().nonnegative().describe("Số ID bị lược."),
}).strict().refine(value => value.configIds.length === Math.min(20, value.totalCount) && value.omittedCount === value.totalCount - value.configIds.length && value.configIds.every((id, i) => i === 0 || codePointCompare(value.configIds[i - 1]!, id) < 0)).describe("Lựa chọn cấu hình.");
export const candidateLimitsSchema = z.object({
  maxCandidates: z.literal(500).describe("Giới hạn cấu hình."),
  candidateCount: z.number().int().min(501).describe("Số cấu hình thực tế."),
}).strict().describe("Giới hạn trước engine.");
const publicErrorBaseSchema = z.object({
  message: z.string().describe("Thông báo an toàn."),
  nextAction: z.string().describe("Cách xử lý lỗi."),
  retryable: z.boolean().describe("Thử lại được."),
  fields: z.array(z.string()).optional().describe("Tên field lỗi."),
});
const publicErrorShape = publicErrorBaseSchema.extend({
  code: z.string().describe("Mã lỗi."),
  choices: configChoicesSchema.optional(),
  limits: candidateLimitsSchema.optional(),
}).strict();
// One strict shape owns all keys. Branches constrain payload presence while
// accepting the common keys; disjoint strict intersections would reject them.
const publicErrorBranches = z.discriminatedUnion("code", [
  z.object({
    code: z.enum(["INVALID_REQUEST", "DATA_UNAVAILABLE", "WORKFLOW_VERSION_CHANGED", "CONFIRMATION_REQUIRED", "CURSOR_INVALID", "RESULT_TOO_LARGE", "INTERNAL_ERROR", "SEASON_CONTEXT_INVALID", "CONFIG_NOT_FOUND", "CAPABILITY_UNAVAILABLE", "ENTITY_NOT_FOUND", "REFERENCE_NOT_FOUND", "REFERENCE_SCOPE_INVALID", "KNOWLEDGE_VERSION_CHANGED", "KNOWLEDGE_UNAVAILABLE", "PLAYBOOK_NOT_FOUND"]).describe("Lỗi không payload mùa."),
    choices: z.never().optional().describe("Cấm."),
    limits: z.never().optional().describe("Cấm."),
  }).passthrough(),
  z.object({
    code: z.literal("CONFIG_AMBIGUOUS").describe("Đội có nhiều cấu hình."),
    choices: z.unknown().describe("Cần cấu hình."),
    limits: z.never().optional().describe("Cấm."),
  }).passthrough(),
  z.object({
    code: z.literal("CANDIDATE_LIMIT_EXCEEDED").describe("Vượt giới hạn cấu hình."),
    limits: z.unknown().describe("Số cấu hình vượt trần."),
    choices: z.never().optional().describe("Cấm."),
    retryable: z.literal(false).describe("Không thử lại."),
  }).passthrough(),
]);
export const errorEnvelopeSchema = z.object({
  error: z.intersection(publicErrorShape, publicErrorBranches).describe("Lỗi đúng mã."),
}).strict();

/**
 * Schema công bố cho một tool: thành công HOẶC lỗi.
 *
 * MCP bắt `outputSchema` phải là schema kiểu object, và SDK bỏ luôn schema nào
 * không phải ZodObject — `z.union([success, error])` bị loại im lặng, khiến
 * outputSchema biến mất khỏi `listTools`. Nên hợp nhất hai nhánh thành một
 * object: field của nhánh thành công thành optional, cộng thêm `error` optional.
 *
 * Bản strict chỉ-thành-công vẫn là thẩm quyền nội bộ — handler validate mọi kết
 * quả thành công bằng nó (`research-handlers.ts`), nên nới lỏng ở đây không làm
 * yếu kiểm tra output thật; nó chỉ nới đúng phần hợp đồng trên dây.
 */
export function publishedOutputSchema<T extends z.ZodObject>(success: T) {
  return success
    .partial()
    .extend({ error: errorEnvelopeSchema.shape.error.optional() })
    .strict()
    .describe(
      "Kết quả hoặc error (isError=true).",
    );
}


export const RESEARCH_CONTRACTS = {
  tqccl_get_playbook: { input: boundedRequest(getPlaybookInputSchema), output: getPlaybookOutputSchema },
  tqccl_search: { input: boundedRequest(searchInputSchema), output: searchOutputSchema },
  tqccl_get_entity: { input: boundedRequest(getEntityInputSchema), output: getEntityOutputSchema },
  tqccl_find_teams: { input: boundedRequest(findTeamsInputSchema), output: findTeamsOutputSchema },
  tqccl_get_team: { input: boundedRequest(getTeamInputSchema), output: getTeamOutputSchema },
  tqccl_normalize_entities: { input: boundedRequest(normalizeInputSchema, MAX_NORMALIZE_REQUEST_BYTES), output: normalizeOutputSchema },
  tqccl_recommend_teams: { input: boundedRequest(recommendTeamsInputSchema), output: recommendTeamsOutputSchema },
} as const;

export type ResearchInput<Name extends ResearchToolName> = z.input<(typeof RESEARCH_CONTRACTS)[Name]["input"]>;

export type ResearchOutput<Name extends ResearchToolName> = z.output<(typeof RESEARCH_CONTRACTS)[Name]["output"]>;
