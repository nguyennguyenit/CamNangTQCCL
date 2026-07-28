import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

import {
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
    "Đọc phiên bản dữ liệu, quy trình và provenance hiện hành.",
  tqccl_normalize_entities:
    "Chuẩn hóa các quan sát có cấu trúc thành trạng thái canonical để người dùng rà soát.",
  tqccl_search:
    "Tìm kiếm đội hình, tướng hoặc chiến pháp trong dữ liệu nghiên cứu.",
  tqccl_get_team:
    "Đọc chi tiết một đội hình canonical theo mã định danh.",
  tqccl_match_team:
    "Đối chiếu trạng thái canonical đã xác nhận với đội hình nghiên cứu.",
  tqccl_recommend_team:
    "Đề xuất đội hình từ trạng thái canonical đã xác nhận.",
  tqccl_recommend_coexist:
    "Đề xuất các đội hình có thể cùng tồn tại từ trạng thái canonical đã xác nhận.",
  tqccl_suggest_replacements:
    "Gợi ý chiến pháp thay thế cho một đội hình đã xác định.",
};

export interface ToolDefinition {
  name: ResearchToolName;
  description: string;
  inputSchema:
    (typeof RESEARCH_CONTRACTS)[ResearchToolName]["input"];
  outputSchema:
    (typeof RESEARCH_CONTRACTS)[ResearchToolName]["output"];
  annotations: typeof READ_ONLY_ANNOTATIONS;
}

export const TOOL_DEFINITIONS: readonly ToolDefinition[] =
  RESEARCH_TOOL_NAMES.map((name) => ({
    name,
    description: DESCRIPTIONS[name],
    inputSchema: RESEARCH_CONTRACTS[name].input,
    outputSchema: RESEARCH_CONTRACTS[name].output,
    annotations: READ_ONLY_ANNOTATIONS,
  }));

