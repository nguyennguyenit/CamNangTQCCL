// Lớp callModel() trung lập (R7/L3) — gọi Vision LLM qua endpoint OpenAI-compatible.
// Danh sách nhà cung cấp (endpoint/model/key, thứ tự ưu tiên) do admin nhập ở /quan-tri/ và
// failover qua `callWithFailover` (shared/ai-config.ts); ảnh truyền dạng base64 data URI.

import { callWithFailover, type AiProvider } from "../../shared/ai-config";
import { AnalyzeMode, AnalyzeModeResult, parseAndValidateByMode } from "./schema";

export const VISION_PROMPT =
  "Chép chữ từ screenshot đội hình game Tam Quốc Chí Chiến Lược (三国志战略版). " +
  "Trả về JSON đúng schema: " +
  '{"heroes":[{"nameCn":"tên tướng chữ Hán hoặc 未知","tacticsCn":["dòng chiến pháp 1","dòng chiến pháp 2","dòng chiến pháp 3"],"booksCn":["binh thư chữ Hán"],"statFocusCn":"chất tướng vd 全智力"}]}. ' +
  "Mỗi cột tướng là MỘT phần tử heroes, theo thứ tự trái sang phải. " +
  "CHỈ CHÉP CHỮ IN TRONG ẢNH: không nhận diện tướng qua chân dung, khuôn mặt, trang phục hay icon; không suy đoán, không bịa tên. " +
  "TẤT CẢ chữ Hán trong kết quả PHẢI là GIẢN THỂ (简体中文), tuyệt đối KHÔNG dùng phồn thể (繁体): vd phải ghi 连环计 chứ không phải 連環計, 夺魂挟魄 chứ không 奪魂挾魄. " +
  "Tên tướng thường in NHỎ ở đáy mỗi chân dung (cạnh số cấp/binh chủng) — HÃY đọc kỹ dòng đó và trả CHÍNH XÁC tên Hán in đó. TUYỆT ĐỐI KHÔNG thay tên in bằng một tướng nổi tiếng trông giống (vd thấy 周劭 thì trả 周劭, KHÔNG trả 赵云). " +
  "Cột KHÔNG có tên in đọc được thì nameCn = 未知. Ô tướng trống (chỉ có hình bóng, không tướng, không chiến pháp) thì BỎ QUA, không thêm phần tử. Màn chiến báo có hai phe: chỉ chép phe 我方 (bên trái). " +
  "Không dùng tên trong dòng #帅选择/#师选择/天赋选择 làm tên tướng của từng cột; không đoán tên tướng từ tên đội. " +
  "tacticsCn là MỌI dòng chiến pháp in dưới cột tướng đó, theo đúng thứ tự từ trên xuống, tối đa 3 dòng, KỂ CẢ dòng đầu là chiến pháp tự mang của tướng (vd màn chiến báo 战报 in 3 dòng: tự mang rồi 2 chiến pháp đã học). Dòng có icon 兵 (vd 精·青州兵) cũng là chiến pháp, chép vào tacticsCn. Dòng không đọc được thì ghi 未知 ở đúng vị trí đó, KHÔNG dồn dòng dưới lên. Không phân loại, không bỏ dòng nào. " +
  "booksCn CHỈ gồm binh thư khi ảnh có in dòng binh thư riêng (thường màu vàng, vd 三军之众/统军/锤炼/铁甲/防备), theo thứ tự in. Màn chiến báo KHÔNG in binh thư: khi đó booksCn = []. KHÔNG đưa dòng chiến pháp nào vào booksCn và ngược lại. KHÔNG đưa thiên phú, quân sư, thuộc tính, hay binh chủng đặc biệt (vd 象兵/虎豹骑) vào booksCn. " +
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
  /** Toàn bộ danh sách provider (mục tắt bị bỏ qua), thứ tự = ưu tiên. */
  providers: AiProvider[];
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
    // DeepSeek V4.1 bật thinking mặc định (effort high): chậm tới mức quá 45s timeout với ảnh, trong
    // khi chép chữ không cần suy luận. Tắt hẳn; nhà cung cấp OpenAI-compatible khác bỏ qua trường lạ.
    thinking: { type: "disabled" },
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
 * Ném Error có .status để handler map sang HTTP (502/503 upstream / 422 không đọc được);
 * lỗi upstream là `AiCallError` (thông điệp cố định, không mang mã/nội dung upstream).
 */
export async function callModel(imageDataUri: string, opts: ModelOptions, mode: AnalyzeMode = "analyzeTeamImage"): Promise<AnalyzeModeResult> {
  const resp = await callWithFailover(
    opts.providers,
    (modelId) => buildRequestBody(modelId, imageDataUri, mode),
    opts.fetchImpl || fetch,
  );
  const data = await resp.json().catch(() => null);
  const content = extractContent(data);
  if (!content) {
    // Hình dạng response OpenAI-compatible; chỉ đọc vài trường để ghi log chẩn đoán.
    const choice = (data as { choices?: Array<{ finish_reason?: unknown; message?: { content?: unknown; reasoning_content?: unknown } }> } | null)?.choices?.[0];
    const message = choice?.message;
    console.warn(JSON.stringify({
      event: "ai_empty_content",
      finishReason: choice?.finish_reason ?? null,
      hasReasoning: typeof message?.reasoning_content === "string" && message.reasoning_content.length > 0,
      contentType: Array.isArray(message?.content) ? "array" : typeof message?.content,
    }));
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
