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
  tqccl_get_playbook: "Khi dùng: bắt đầu mọi workflow. Trả về: version, capabilities, mùa nguồn, luật bắt buộc và tool kế tiếp. Có thể lỗi: PLAYBOOK_NOT_FOUND, DATA_UNAVAILABLE.",
  tqccl_search: "Khi dùng: tìm ID tướng, chiến pháp, trang bị, binh thư hoặc đội. Trả về: entityId, loại, tên, pagePath, cursor. Có thể lỗi: CURSOR_INVALID, CAPABILITY_UNAVAILABLE.",
  tqccl_get_entity: "Khi dùng: có entityId cần hồ sơ như trang Tra cứu. Trả về: hồ sơ, pagePath vi/zh, section có cursor. Có thể lỗi: ENTITY_NOT_FOUND, CAPABILITY_UNAVAILABLE.",
  tqccl_find_teams: "Khi dùng: duyệt/đối chiếu đội theo họ recommended, other, khaihoang, engine. Trả về: tóm tắt, bậc/điểm nguồn, reference. Có thể lỗi: REFERENCE_SCOPE_INVALID.",
  tqccl_get_team: "Khi dùng: có reference cần chi tiết đội. Trả về: ô tướng/chiến pháp/binh thư, ghi chú, sourceScore. Có thể lỗi: REFERENCE_NOT_FOUND, CONFIG_AMBIGUOUS.",
  tqccl_normalize_entities: "Khi dùng: trước khi ghép đội; gửi cả kho 1 lần bằng observedText. Trả về: canonicalState, binding; tên mơ hồ/không khớp vào unresolved. Có thể lỗi: input sai.",
  tqccl_recommend_teams: "Khi dùng: state đã xác nhận, ghép đội theo mùa nguồn. Trả về: portfolioTeams, blockedStrongTeams, substitutes. Có thể lỗi: CONFIRMATION_REQUIRED.",
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
