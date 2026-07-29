import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import type { ResearchToolName } from "../research/research-contracts.js";
import { ResearchHandlerError } from "../research/research-handlers.js";

const PUBLIC_ERRORS = {
  INVALID_REQUEST: {
    message: "Yêu cầu không hợp lệ.",
    nextAction: "Kiểm tra input theo schema công cụ rồi thử lại.",
  },
  DATA_UNAVAILABLE: {
    message: "Dữ liệu nghiên cứu hiện không khả dụng.",
    nextAction:
      "Thử lại sau; nếu lỗi tiếp diễn, kiểm tra readiness và release hiện hành.",
  },
  WORKFLOW_VERSION_CHANGED: {
    message: "Phiên bản dữ liệu hoặc quy trình đã thay đổi.",
    nextAction:
      "Gọi tqccl_get_data_version, chuẩn hóa và xác nhận lại trước khi tiếp tục.",
  },
  CONFIRMATION_REQUIRED: {
    message: "Trạng thái canonical cần được xác nhận lại.",
    nextAction:
      "Gọi tqccl_normalize_entities, cho người dùng rà soát rồi gửi confirmationBinding mới.",
  },
  CURSOR_INVALID: {
    message: "Cursor không hợp lệ cho truy vấn hiện tại.",
    nextAction: "Bỏ cursor và gọi lại tqccl_search từ trang đầu.",
  },
  TEAM_NOT_FOUND: {
    message: "Không tìm thấy đội hình.",
    nextAction:
      "Dùng tqccl_search để lấy teamId canonical rồi thử lại.",
  },
  TACTIC_NOT_FOUND: {
    message: "Không tìm thấy chiến pháp.",
    nextAction:
      "Kiểm tra tên chiến pháp hoặc dùng tqccl_search rồi thử lại.",
  },
  RESULT_TOO_LARGE: {
    message: "Kết quả vượt giới hạn cho phép.",
    nextAction: "Thu hẹp truy vấn hoặc giảm limit rồi thử lại.",
  },
  INTERNAL_ERROR: {
    message: "Không thể hoàn tất yêu cầu.",
    nextAction:
      "Thử lại một lần; nếu lỗi tiếp diễn, báo mã INTERNAL_ERROR cho vận hành.",
  },
} as const satisfies Record<
  ResearchHandlerError["code"],
  { message: string; nextAction: string }
>;

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
  const publicError = PUBLIC_ERRORS[code];

  return {
    isError: true,
    structuredContent: {
      error: {
        code,
        message: publicError.message,
        nextAction: publicError.nextAction,
        retryable,
      },
    },
    content: [
      {
        type: "text",
        text:
          `TQCCL_ERROR:${code}. ${publicError.message} ` +
          publicError.nextAction,
      },
    ],
  };
}
