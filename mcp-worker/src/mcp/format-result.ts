import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import type { ResearchToolName } from "../research/research-contracts.js";
import { ResearchHandlerError } from "../research/research-handlers.js";

export function formatToolResult(
  name: ResearchToolName,
  result: object,
): CallToolResult {
  return {
    structuredContent: result as Record<string, unknown>,
    content: [
      {
        type: "text",
        text: `Công cụ ${name} đã hoàn tất; xem structuredContent để đọc kết quả.`,
      },
    ],
  };
}

export function formatToolError(error: unknown): CallToolResult {
  const code =
    error instanceof ResearchHandlerError ? error.code : "INTERNAL_ERROR";
  const retryable =
    error instanceof ResearchHandlerError ? error.retryable : false;

  return {
    isError: true,
    structuredContent: {
      error: {
        code,
        retryable,
      },
    },
    content: [
      {
        type: "text",
        text: `TQCCL_ERROR:${code}`,
      },
    ],
  };
}

