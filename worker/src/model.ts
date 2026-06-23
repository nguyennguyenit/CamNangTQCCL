// Lớp callModel() trung lập (R7/L3) — gọi Vision LLM qua endpoint OpenAI-compatible.
// Mặc định Qwen DashScope OpenAI-compatible. Bao cả endpoint LẪN cách truyền ảnh
// (base64 data URI) để dễ đổi sang GPT/Gemini sau.

import { AnalyzeResult, parseAndValidate } from "./schema";

export const VISION_PROMPT =
  "Đọc screenshot đội hình game Tam Quốc Chí Chiến Lược (三国志战略版). " +
  "Trả về JSON đúng schema: " +
  '{"heroes":[{"nameCn":"tên tướng chữ Hán","tacticsCn":["chiến pháp chữ Hán"],"statFocusCn":"chất tướng vd 全智力"}]}. ' +
  "nameCn/tacticsCn/statFocusCn PHẢI là chữ Hán gốc trong ảnh. " +
  "Chỉ đọc tên tướng nếu chữ tên tướng được in rõ trong ảnh; nếu không thấy tên in rõ thì dùng 未知. " +
  "Không dùng tên trong dòng #帅选择/#师选择/天赋选择 làm tên tướng của từng cột; không đoán tên tướng từ chân dung, icon, hoặc tên đội. " +
  "tacticsCn chỉ gồm chiến pháp, thường là dòng trắng dạng A/B trên từng cột. Không đưa binh thư, thiên phú, quân sư, thuộc tính, hay dòng vàng như 三军之众/统军/锤炼 vào tacticsCn. " +
  "Chỉ trả JSON, không giải thích.";

export interface ModelOptions {
  endpoint: string;
  apiKey: string;
  modelId: string;
  fetchImpl?: typeof fetch;
}

/** Body OpenAI-compatible chat/completions với 1 ảnh (base64 data URI). */
export function buildRequestBody(modelId: string, imageDataUri: string) {
  return {
    model: modelId,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: VISION_PROMPT },
          { type: "image_url", image_url: { url: imageDataUri } },
        ],
      },
    ],
    // Thử ép JSON; nếu model không hỗ trợ, tolerantParse vẫn lo (M1).
    response_format: { type: "json_object" },
    temperature: 0,
  };
}

/** Lấy text content từ response OpenAI-compatible (chịu vài biến thể shape). */
export function extractContent(data: any): string {
  const msg = data?.choices?.[0]?.message;
  if (typeof msg?.content === "string") return msg.content;
  if (Array.isArray(msg?.content)) {
    return msg.content.map((c: any) => (typeof c === "string" ? c : c?.text || "")).join("");
  }
  return "";
}

/**
 * Gọi model vision -> AnalyzeResult đã validate.
 * Ném Error có .status để handler map sang HTTP (502 upstream / 422 không đọc được).
 */
export async function callModel(imageDataUri: string, opts: ModelOptions): Promise<AnalyzeResult> {
  const fetchImpl = opts.fetchImpl || fetch;
  const resp = await fetchImpl(opts.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildRequestBody(opts.modelId, imageDataUri)),
  });
  if (!resp.ok) {
    const err: any = new Error(`Model upstream lỗi ${resp.status}`);
    err.status = 502;
    throw err;
  }
  const data = await resp.json();
  const content = extractContent(data);
  if (!content) {
    const err: any = new Error("Model trả rỗng");
    err.status = 502;
    throw err;
  }
  try {
    return parseAndValidate(content);
  } catch (e) {
    const err: any = new Error("Không đọc được đội hình từ ảnh");
    err.status = 422;
    throw err;
  }
}
