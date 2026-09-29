// Catalog model tĩnh cho các mẫu nhà cung cấp ở tab AI (/quan-tri/). Danh sách model id lấy một lần
// bằng `node scripts/scan-ai-models.mjs` (GET {base}/models); cờ `vision`/`effortStyle`/`efforts` điền tay
// theo tài liệu nhà cung cấp vì /models không trả các thông tin này. Model ngoài catalog: admin tự thêm
// vào `extraModels` của nhà cung cấp (lưu KV), không cần deploy.

/**
 * Cách một model nhận mức suy luận trong body Chat Completions:
 * - `deepseek`: `thinking: {type: enabled|disabled}` + `reasoning_effort` (api-docs.deepseek.com/guides/thinking_mode).
 * - `openai`: chỉ `reasoning_effort`.
 * - `none`: model không có tham số suy luận; không gửi trường nào.
 */
export type EffortStyle = "deepseek" | "openai" | "none";

/** Mọi mức hợp lệ theo từng kiểu; `efforts` của một model là tập con khác rỗng của danh sách này. */
export const EFFORT_LEVELS: Record<EffortStyle, readonly string[]> = {
  deepseek: ["off", "low", "high", "max"],
  openai: ["none", "low", "medium", "high"],
  none: ["default"],
};

export interface AiModel {
  modelId: string;
  /** Nhận ảnh (image_url) — bắt buộc cho nhóm đọc ảnh. */
  vision: boolean;
  effortStyle: EffortStyle;
  efforts: string[];
}

export interface AiPreset {
  id: string;
  label: string;
  endpoint: string;
  models: AiModel[];
}

const DEEPSEEK_EFFORTS = [...EFFORT_LEVELS.deepseek];

export const AI_PRESETS: readonly AiPreset[] = [
  {
    id: "deepseek",
    label: "DeepSeek",
    endpoint: "https://api.deepseek.com/chat/completions",
    models: [
      { modelId: "deepseek-flash", vision: true, effortStyle: "deepseek", efforts: DEEPSEEK_EFFORTS },
      { modelId: "deepseek-v4-pro", vision: false, effortStyle: "deepseek", efforts: DEEPSEEK_EFFORTS },
    ],
  },
  {
    // Zen phục vụ nhiều họ model trên các endpoint khác nhau; chỉ các model trên /chat/completions dùng được ở đây.
    id: "opencode-zen",
    label: "OpenCode Zen",
    endpoint: "https://opencode.ai/zen/v1/chat/completions",
    models: [
      { modelId: "deepseek-v4.1-flash", vision: true, effortStyle: "deepseek", efforts: DEEPSEEK_EFFORTS },
      { modelId: "deepseek-v4-flash-vision-exp", vision: true, effortStyle: "deepseek", efforts: DEEPSEEK_EFFORTS },
      { modelId: "deepseek-v4-flash", vision: false, effortStyle: "deepseek", efforts: DEEPSEEK_EFFORTS },
      { modelId: "deepseek-v4-pro", vision: false, effortStyle: "deepseek", efforts: DEEPSEEK_EFFORTS },
    ],
  },
];

