import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

import {
  publishedOutputSchema,
  RESEARCH_CONTRACTS,
  RESEARCH_TOOL_NAMES,
  type ResearchToolName,
} from "../research/research-contracts.js";

const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const satisfies ToolAnnotations;

const DESCRIPTIONS: Record<ResearchToolName, string> = {
  tqccl_get_data_version:
    "Đọc identity của data release và workflow hiện hành. Khi dùng: gọi đầu workflow hoặc trước khi tái sử dụng state/cursor cũ. Trả về: releaseId, workflowVersion, provenance và sáu artifact. Có thể lỗi: dữ liệu không khả dụng hoặc release không hợp lệ.",
  tqccl_normalize_entities:
    "Chuẩn hóa observation có cấu trúc thành canonical state để người dùng rà soát. Khi dùng: sau khi consumer đã trích xuất observation, trước mọi recommendation. Trả về: canonicalState, reviewRequired và confirmationBinding; ambiguity được biểu diễn qua reviewRequired thay vì tự chọn. Có thể lỗi: input không hợp lệ hoặc dữ liệu không khả dụng.",
  tqccl_search:
    "Tìm kiếm team, hero, tactic hoặc book trong corpus nghiên cứu. Khi dùng: cần canonical ID/tên hợp lệ hoặc cần duyệt dữ liệu theo trang. Trả về: record ngắn gọn, provenance và nextCursor khi còn trang. Có thể lỗi: workflow đã đổi, cursor không hợp lệ hoặc request vượt giới hạn.",
  tqccl_get_team:
    "Đọc chi tiết một team canonical và tier liên quan. Khi dùng: sau khi có teamId từ search, match hoặc recommendation. Trả về: team bounded, tierRankings và provenance. Có thể lỗi: team không tồn tại, workflow đã đổi hoặc dữ liệu không khả dụng.",
  tqccl_match_team:
    "Đối chiếu roster canonical với các team trong corpus. Khi dùng: cần tìm team gần nhất mà chưa yêu cầu recommendation đầy đủ. Trả về: matches xếp hạng theo hero/tactic hit. Có thể lỗi: workflow đã đổi, input không hợp lệ hoặc dữ liệu không khả dụng.",
  tqccl_recommend_team:
    "Đề xuất team từ canonical state đã được người dùng xác nhận. Khi dùng: sau normalize khi reviewRequired=false và confirmationBinding còn nguyên vẹn. Trả về: teams xếp hạng, diagnostics, warnings và provenance. Có thể lỗi: cần xác nhận lại, workflow đã đổi, xung đột tài nguyên hoặc không có candidate an toàn.",
  tqccl_recommend_coexist:
    "Đề xuất nhiều team có thể cùng tồn tại mà không dùng trùng tài nguyên. Khi dùng: sau normalize và xác nhận khi cần xây portfolio team. Trả về: teams, coexistReference, diagnostics và warnings. Có thể lỗi: cần xác nhận lại, workflow đã đổi, xung đột tài nguyên hoặc không có portfolio an toàn.",
  tqccl_suggest_replacements:
    "Gợi ý tactic thay thế cho một team đã xác định. Khi dùng: sau khi có canonical teamId, tacticName và state đã xác nhận. Trả về: danh sách replacements có thứ tự cùng provenance. Có thể lỗi: cần xác nhận lại, workflow đã đổi, team/tactic không tồn tại hoặc không có thay thế an toàn.",
};

export interface ToolDefinition {
  name: ResearchToolName;
  description: string;
  inputSchema:
    (typeof RESEARCH_CONTRACTS)[ResearchToolName]["input"];
  outputSchema: ReturnType<
    typeof publishedOutputSchema<
      (typeof RESEARCH_CONTRACTS)[ResearchToolName]["output"]
    >
  >;
  annotations: typeof READ_ONLY_ANNOTATIONS;
}

export const TOOL_DEFINITIONS: readonly ToolDefinition[] =
  RESEARCH_TOOL_NAMES.map((name) => ({
    name,
    description: DESCRIPTIONS[name],
    inputSchema: RESEARCH_CONTRACTS[name].input,
    // Công bố cả nhánh lỗi: client validate structuredContent kể cả khi isError.
    outputSchema: publishedOutputSchema(RESEARCH_CONTRACTS[name].output),
    annotations: READ_ONLY_ANNOTATIONS,
  }));
