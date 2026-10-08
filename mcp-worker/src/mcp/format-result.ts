import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { configChoicesSchema, candidateLimitsSchema } from "../research/research-contracts.js";
import { PUBLIC_ERRORS, ResearchHandlerError } from "../research/handler-error.js";
import { withFieldNames } from "../research/validation-fields.js";

/**
 * `content[0].text` là JSON tương đương `structuredContent` để host chỉ đọc text vẫn có dữ liệu.
 * Handler đã giới hạn kết quả (`MAX_RESULT_BYTES`), nên text + structuredContent vừa trần phản hồi.
 */
export function formatToolResult(result: object): CallToolResult {
  return {
    structuredContent: result as Record<string, unknown>,
    content: [{ type: "text", text: JSON.stringify(result) }],
  };
}

export function formatToolError(error: unknown): CallToolResult {
  const code =
    error instanceof ResearchHandlerError ? error.code : "INTERNAL_ERROR";
  const retryable =
    error instanceof ResearchHandlerError ? error.retryable : false;
  const publicError = PUBLIC_ERRORS[code];
  // Chỉ tên field, không kèm giá trị: payload này đi thẳng vào context LLM.
  const fields =
    error instanceof ResearchHandlerError ? error.fields : ([] as const);
  const message = withFieldNames(publicError.message, fields);

  return {
    isError: true,
    structuredContent: {
      error: {
        code,
        message,
        nextAction: publicError.nextAction,
        retryable,
        ...publicErrorDetails(error),
        ...(fields.length === 0 ? {} : { fields: [...fields] }),
      },
    },
    content: [
      {
        type: "text",
        text:
          `TQCCL_ERROR:${code}. ${message} ` + publicError.nextAction,
      },
    ],
  };
}

export function publicErrorDetails(error: unknown) {
 if (!(error instanceof ResearchHandlerError)) return {};
 if(error.code === "CONFIG_AMBIGUOUS") {const result=configChoicesSchema.safeParse(error.choices);return result.success?{choices:result.data}:{};}
 if(error.code === "CANDIDATE_LIMIT_EXCEEDED") {const result=candidateLimitsSchema.safeParse(error.limits);return result.success?{limits:result.data}:{};}
 return {};
}
