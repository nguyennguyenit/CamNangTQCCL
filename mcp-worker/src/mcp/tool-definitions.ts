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
  tqccl_get_data_version: "Khi dùng: bắt đầu workflow. Trả về: release, workflow, manifestVersion, capabilities và registry. Có thể lỗi: DATA_UNAVAILABLE.",
  tqccl_normalize_entities: "Khi dùng: trước recommendation. Trả về: canonicalState và binding để người dùng rà soát. Có thể lỗi: input sai; ambiguity yêu cầu review.",
  tqccl_search: "Khi dùng: tìm ID hoặc duyệt corpus. Trả về: record, configId và cursor. Có thể lỗi: context, workflow hoặc cursor sai.",
  tqccl_get_team: "Khi dùng: đã có teamId. Trả về: cấu hình, tier và điểm nguồn. Có thể lỗi: CONFIG_AMBIGUOUS cần chọn configId, hoặc không tìm thấy.",
  tqccl_match_team: "Khi dùng: đối chiếu roster. Trả về: đội khớp hero/tactic đúng holder. Có thể lỗi: context sai hoặc quá 500 cấu hình.",
  tqccl_recommend_team: "Khi dùng: state đã xác nhận. Trả về: đội, configId và diagnostics. Có thể lỗi: binding stale, quá 500 cấu hình hoặc thiếu tài nguyên.",
  tqccl_recommend_coexist: "Khi dùng: state đã xác nhận, cần nhiều đội. Trả về: portfolio và nguồn tham khảo chưa chấm điểm. Có thể lỗi: binding stale hoặc quá 500 cấu hình.",
  tqccl_suggest_replacements: "Khi dùng: đã chọn đội/cấu hình/holder/slot. Trả về: chiến pháp thay thế; điểm chỉ giữ cho đúng lựa chọn đã chấm. Có thể lỗi: ambiguity, selector sai hoặc binding stale.",
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
    description: DESCRIPTIONS[name] + (name === "tqccl_get_data_version" ? "" : " seasonContext cần đủ cặp ID đã xác minh; bỏ field để dùng legacy."),
    inputSchema: RESEARCH_CONTRACTS[name].input,
    // Công bố cả nhánh lỗi: client validate structuredContent kể cả khi isError.
    outputSchema: publishedOutputSchema(RESEARCH_CONTRACTS[name].output),
    annotations: READ_ONLY_ANNOTATIONS,
  }));
