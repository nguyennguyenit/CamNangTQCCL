/**
 * Mã lỗi công khai và `ResearchHandlerError`. Nằm ở lá (không import contract/handler)
 * để mọi handler dùng chung mà không tạo vòng import với `research-contracts.ts`.
 */

export const PUBLIC_ERRORS = {
  SEASON_CONTEXT_INVALID: {
    message: "Cặp kịch bản và luật chưa được xác minh.",
    nextAction: "Đọc registry và chọn cặp đã xác minh.",
  },
  CONFIG_NOT_FOUND: {
    message: "Không tìm thấy cấu hình phù hợp.",
    nextAction: "Tìm cấu hình trong đúng kịch bản và luật.",
  },
  CONFIG_AMBIGUOUS: {
    message: "Cần chọn cấu hình đội hình cụ thể.",
    nextAction: "Chọn configId từ choices rồi gọi lại tqccl_get_team với reference.configId.",
  },
  CANDIDATE_LIMIT_EXCEEDED: {
    message: "Số cấu hình vượt giới hạn xử lý.",
    nextAction: "Thu hẹp dữ liệu cấu hình trước khi thử lại.",
  },
  INVALID_REQUEST: {
    message: "Yêu cầu không hợp lệ.",
    nextAction: "Kiểm tra input theo schema công cụ rồi thử lại.",
  },
  DATA_UNAVAILABLE: {
    message: "Dữ liệu nghiên cứu hiện không khả dụng.",
    nextAction: "Thử lại sau; nếu lỗi tiếp diễn, kiểm tra readiness và release hiện hành.",
  },
  WORKFLOW_VERSION_CHANGED: {
    message: "Phiên bản dữ liệu hoặc quy trình đã thay đổi.",
    nextAction: "Gọi tqccl_get_playbook, chuẩn hóa và xác nhận lại trước khi tiếp tục.",
  },
  CONFIRMATION_REQUIRED: {
    message: "Trạng thái canonical cần được xác nhận lại.",
    nextAction: "Gọi tqccl_normalize_entities, cho người dùng rà soát rồi gửi confirmationBinding mới. Roster trống/chưa rõ: hỏi người dùng tướng/chiến pháp (hoặc ảnh) trước, rồi mới normalize và xác nhận; không lặp normalize khi chưa có quan sát mới.",
  },
  CURSOR_INVALID: {
    message: "Cursor không hợp lệ cho truy vấn hiện tại.",
    nextAction: "Bỏ cursor và gọi lại cùng công cụ từ trang đầu.",
  },
  RESULT_TOO_LARGE: {
    message: "Kết quả vượt giới hạn cho phép.",
    nextAction: "Thu hẹp truy vấn, chọn section hoặc giảm limit rồi thử lại; với playbook, gửi `stage` để chia nhỏ.",
  },
  INTERNAL_ERROR: {
    message: "Không thể hoàn tất yêu cầu.",
    nextAction: "Thử lại một lần; nếu lỗi tiếp diễn, báo mã INTERNAL_ERROR cho vận hành.",
  },
  CAPABILITY_UNAVAILABLE: {
    message: "Release hiện hành không có dữ liệu cho chức năng này.",
    nextAction: "Gọi tqccl_get_playbook để xem capabilities; không coi kết quả thiếu là không có dữ liệu.",
  },
  ENTITY_NOT_FOUND: {
    message: "Không tìm thấy thực thể.",
    nextAction: "Dùng tqccl_search để lấy entityId rồi gọi lại tqccl_get_entity.",
  },
  REFERENCE_NOT_FOUND: {
    message: "Không tìm thấy đội tham khảo.",
    nextAction: "Dùng tqccl_find_teams để lấy selector reference rồi gọi lại tqccl_get_team.",
  },
  REFERENCE_SCOPE_INVALID: {
    message: "Phạm vi mùa/nhóm/ngữ cảnh không tồn tại hoặc không áp dụng cho collection này.",
    nextAction: "Bỏ sourceSeasonId/sourceCategoryId hoặc chọn collection có registry mùa tương ứng.",
  },
  KNOWLEDGE_VERSION_CHANGED: {
    message: "Phiên bản bộ luật đã thay đổi.",
    nextAction: "Gọi lại tqccl_get_playbook để lấy knowledgeVersion hiện hành.",
  },
  KNOWLEDGE_UNAVAILABLE: {
    message: "Bộ luật không khả dụng trong release này.",
    nextAction: "Báo vận hành; tiếp tục chỉ với dữ liệu nguồn và ghi rõ thiếu bộ luật.",
  },
  PLAYBOOK_NOT_FOUND: {
    message: "Không có playbook cho intent hoặc stage đã chọn.",
    nextAction: "Dùng intent lookup, coexist hoặc research và một stage có trong playbook.",
  },
} as const satisfies Record<string, { message: string; nextAction: string }>;

export type ResearchErrorCode = keyof typeof PUBLIC_ERRORS;

export class ResearchHandlerError extends Error {
  constructor(
    readonly code: ResearchErrorCode,
    message: string,
    readonly retryable = false,
    /**
     * Đường dẫn các field vi phạm, để agent tự sửa request thay vì bỏ cuộc.
     * Chỉ tên field — không bao giờ chứa giá trị người dùng gửi lên, vì lỗi này
     * đi thẳng vào context LLM và vào trace.
     */
    readonly fields: readonly string[] = [],
    readonly choices?: {
      kind: "team-config";
      teamId: string;
      configIds: string[];
      totalCount: number;
      omittedCount: number;
    },
    readonly limits?: { maxCandidates: 500; candidateCount: number },
  ) {
    super(message);
    this.name = "ResearchHandlerError";
  }
}
