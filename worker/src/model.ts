// Lớp callModel() trung lập (R7/L3) — gọi Vision LLM qua endpoint OpenAI-compatible.
// Mặc định Qwen DashScope OpenAI-compatible. Bao cả endpoint LẪN cách truyền ảnh
// (base64 data URI) để dễ đổi sang GPT/Gemini sau.

import { AnalyzeMode, AnalyzeModeResult, parseAndValidateByMode } from "./schema";
import { HERO_NAMES_CN } from "./hero-names";

export const VISION_PROMPT =
  "Đọc screenshot đội hình game Tam Quốc Chí Chiến Lược (三国志战略版). " +
  "Trả về JSON đúng schema: " +
  '{"heroes":[{"nameCn":"tên tướng chữ Hán","tacticsCn":["chiến pháp chữ Hán"],"booksCn":["binh thư chữ Hán"],"statFocusCn":"chất tướng vd 全智力","nameFromPortrait":false}]}. ' +
  "tacticsCn/booksCn/statFocusCn PHẢI là chữ Hán gốc trong ảnh. " +
  "TẤT CẢ chữ Hán trong kết quả PHẢI là GIẢN THỂ (简体中文), tuyệt đối KHÔNG dùng phồn thể (繁体): vd phải ghi 连环计 chứ không phải 連環計, 夺魂挟魄 chứ không 奪魂挾魄. " +
  "Tên tướng thường in NHỎ ở đáy mỗi chân dung (cạnh số cấp/binh chủng) — HÃY đọc kỹ dòng đó. Nếu có tên in: trả CHÍNH XÁC tên Hán in đó, KỂ CẢ khi không có trong danh sách bên dưới; nameFromPortrait=false. TUYỆT ĐỐI KHÔNG thay tên in bằng một tướng nổi tiếng trông giống (vd thấy 周劭 thì trả 周劭, KHÔNG trả 赵云). " +
  "CHỈ KHI một cột KHÔNG có tên in rõ thì mới NHẬN DIỆN tướng từ chân dung (nhân vật Tam Quốc 三国志战略版, nhận qua khuôn mặt/trang phục/chiến pháp tự mang) và đặt nameFromPortrait=true; KHI ĐÓ nameCn phải chọn 1 tên trong DANH SÁCH HỢP LỆ sau (hoặc 未知), không bịa tên ngoài danh sách: " +
  HERO_NAMES_CN.join("、") + ". " +
  "Không dùng tên trong dòng #帅选择/#师选择/天赋选择 làm tên tướng của từng cột; không đoán tên tướng từ tên đội. " +
  "tacticsCn chỉ gồm chiến pháp (thường dòng trắng dạng A/B trên từng cột). " +
  "booksCn gồm binh thư (dòng vàng dạng A/B, vd 三军之众/统军/锤炼/铁甲/防备); KHÔNG đưa binh thư vào tacticsCn và ngược lại. KHÔNG đưa thiên phú, quân sư, thuộc tính, hay binh chủng đặc biệt (vd 象兵/虎豹骑) vào booksCn. " +
  "Chỉ trả JSON, không giải thích.";

const SCAN_HEROES_PROMPT =
  "Đọc screenshot danh sách võ tướng game Tam Quốc Chí Chiến Lược (三国志战略版). " +
  "Chỉ trích xuất các võ tướng nhìn thấy trong danh sách. Trả JSON đúng schema: " +
  '{"heroes":[{"nameCn":"tên tướng chữ Hán giản thể","level":50,"redStars":4}]}. ' +
  "nameCn PHẢI là chữ Hán giản thể. level/redStars chỉ điền khi thấy rõ; không đoán. " +
  "Không đọc chiến pháp, binh thư, mô tả, tài nguyên hay text ngoài thẻ tướng. Chỉ trả JSON.";

const SCAN_TACTICS_PROMPT =
  "Đọc screenshot danh sách chiến pháp game Tam Quốc Chí Chiến Lược (三国志战略版). " +
  "Chỉ cần xác định tên chiến pháp user sở hữu/đang hiển thị; không đọc 0/1, loại hình, xác suất, mô tả, có thể thiết lập. " +
  "Trả JSON đúng schema: " +
  '{"tactics":[{"nameCn":"tên chiến pháp chữ Hán giản thể"}]}. ' +
  "nameCn PHẢI là chữ Hán giản thể. Chỉ trả JSON.";

const SCAN_BUILT_TEAMS_PROMPT =
  "Đọc screenshot team đã build trong game Tam Quốc Chí Chiến Lược (三国志战略版). " +
  "Mục tiêu là khóa tướng và chiến pháp đang dùng để tránh trùng khi gợi ý team cùng tồn. " +
  "Trả JSON đúng schema: " +
  '{"teams":[{"teamName":"tên đội nếu thấy","heroesCn":["tướng chữ Hán giản thể"],"tacticsCn":["chiến pháp chữ Hán giản thể"]}]}. ' +
  "Không đưa binh thư vào tacticsCn. Không đoán chiến pháp nếu không thấy rõ. Chỉ trả JSON.";

export function promptByMode(mode: AnalyzeMode = "analyzeTeamImage") {
  if (mode === "scanHeroes") return SCAN_HEROES_PROMPT;
  if (mode === "scanTactics") return SCAN_TACTICS_PROMPT;
  if (mode === "scanBuiltTeams") return SCAN_BUILT_TEAMS_PROMPT;
  return VISION_PROMPT;
}

export interface ModelOptions {
  endpoint: string;
  apiKey: string;
  modelId: string;
  fetchImpl?: typeof fetch;
}

/** Body OpenAI-compatible chat/completions với 1 ảnh (base64 data URI). */
export function buildRequestBody(modelId: string, imageDataUri: string, mode: AnalyzeMode = "analyzeTeamImage") {
  return {
    model: modelId,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: promptByMode(mode) },
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
 * Ném Error có .status để handler map sang HTTP (502/503 upstream / 422 không đọc được).
 */
export async function callModel(imageDataUri: string, opts: ModelOptions, mode: AnalyzeMode = "analyzeTeamImage"): Promise<AnalyzeModeResult> {
  const fetchImpl = opts.fetchImpl || fetch;
  const resp = await fetchImpl(opts.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildRequestBody(opts.modelId, imageDataUri, mode)),
  });
  if (!resp.ok) {
    // Thông điệp cố định, không mang mã upstream: 429 là quá tải (503), còn lại
    // (khoá sai 401/403, 5xx…) là dịch vụ AI tạm lỗi (502).
    const overloaded = resp.status === 429;
    const err: any = new Error(overloaded ? "Dịch vụ AI đang quá tải, thử lại sau" : "Dịch vụ AI tạm lỗi, thử lại sau");
    err.status = overloaded ? 503 : 502;
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
    return parseAndValidateByMode(mode, content);
  } catch (e) {
    const err: any = new Error("Không đọc được đội hình từ ảnh");
    err.status = 422;
    throw err;
  }
}
