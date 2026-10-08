/**
 * `tools/list` công bố schema gọn hơn schema nội bộ: Worker vẫn validate kết quả bằng schema
 * Zod đầy đủ (authority), còn wire chỉ mang hình dạng cần cho client.
 *
 * - Output: bỏ `description` của mọi schema lồng sâu; giữ mô tả field cấp gốc.
 * - Error envelope dùng chung một schema phẳng thay vì lặp union đầy đủ cho từng tool.
 */

type JsonSchema = Record<string, unknown>;

export interface ListedTool {
  outputSchema?: JsonSchema;
  [key: string]: unknown;
}

/** Hình dạng `error` công bố chung; ràng buộc theo mã nằm ở `errorEnvelopeSchema` nội bộ. */
export const PUBLISHED_ERROR_SCHEMA: JsonSchema = {
  type: "object",
  description: "Lỗi (isError=true): mã, thông báo an toàn và cách xử lý.",
  properties: {
    code: { type: "string" },
    message: { type: "string" },
    nextAction: { type: "string" },
    retryable: { type: "boolean" },
    fields: { type: "array", items: { type: "string" } },
    choices: {
      type: "object",
      properties: {
        kind: { type: "string", const: "team-config" },
        teamId: { type: "string" },
        configIds: { type: "array", items: { type: "string" } },
        totalCount: { type: "integer" },
        omittedCount: { type: "integer" },
      },
      required: ["kind", "teamId", "configIds", "totalCount", "omittedCount"],
      additionalProperties: false,
    },
    limits: {
      type: "object",
      properties: { maxCandidates: { type: "integer", const: 500 }, candidateCount: { type: "integer", minimum: 501 } },
      required: ["maxCandidates", "candidateCount"],
      additionalProperties: false,
    },
  },
  required: ["code", "message", "nextAction", "retryable"],
  additionalProperties: false,
  allOf: [
    {
      if: { properties: { code: { const: "CONFIG_AMBIGUOUS" } }, required: ["code"] },
      then: { required: ["choices"] },
      else: { not: { required: ["choices"] } },
    },
    {
      if: { properties: { code: { const: "CANDIDATE_LIMIT_EXCEEDED" } }, required: ["code"] },
      then: { required: ["limits"], properties: { retryable: { const: false } } },
      else: { not: { required: ["limits"] } },
    },
  ],
};

function stripNestedDescriptions(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripNestedDescriptions);
  if (typeof node !== "object" || node === null) return node;
  const output: JsonSchema = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "description" && typeof value === "string") continue;
    output[key] = stripNestedDescriptions(value);
  }
  return output;
}

function slimOutputSchema(schema: JsonSchema): JsonSchema {
  const properties = (schema.properties ?? {}) as Record<string, JsonSchema>;
  const slimmed: Record<string, unknown> = {};
  for (const [name, property] of Object.entries(properties)) {
    if (name === "error") {
      slimmed[name] = PUBLISHED_ERROR_SCHEMA;
      continue;
    }
    const { description, ...rest } = property;
    slimmed[name] = { ...(stripNestedDescriptions(rest) as JsonSchema), ...(typeof description === "string" ? { description } : {}) };
  }
  return { ...schema, properties: slimmed };
}

export function slimListedTool<T extends ListedTool>(tool: T): T {
  return tool.outputSchema === undefined ? tool : { ...tool, outputSchema: slimOutputSchema(tool.outputSchema) };
}
