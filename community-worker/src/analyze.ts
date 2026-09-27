// Phân tích ảnh chiến báo bằng Qwen Vision (DashScope OpenAI-compatible):
// trích kết quả trận + tướng hai phe (chữ Hán giản thể như trong ảnh).

import { MAX_HERO_CHARS, MAX_HEROES, type ReportResult } from "./validate";

export interface ReportAnalysis {
  result: ReportResult | null;
  ally: { heroes: string[] };
  enemy: { heroes: string[] };
  battleType: string | null;
  notes: string | null;
}

export const EMPTY_ANALYSIS: ReportAnalysis = {
  result: null,
  ally: { heroes: [] },
  enemy: { heroes: [] },
  battleType: null,
  notes: null,
};

export const REPORT_PROMPT =
  "Đọc screenshot chiến báo (战报) game Tam Quốc Chí Chiến Lược (三国志战略版). " +
  "Trả về DUY NHẤT một object JSON đúng schema sau, không thêm khoá khác, không giải thích: " +
  '{"result":"win"|"loss"|"draw"|null,"ally":{"heroes":["tên tướng"]},"enemy":{"heroes":["tên tướng"]},"battleType":string|null,"notes":string|null}. ' +
  "ally = phe của người chơi chụp ảnh (phe có kết quả 胜利/失败/平局 hiển thị theo góc nhìn của họ); enemy = phe đối thủ. " +
  "result theo góc nhìn phe ally: 胜/胜利 -> \"win\", 败/失败 -> \"loss\", 平/平局 -> \"draw\"; không thấy rõ -> null. " +
  `Mỗi phe tối đa ${MAX_HEROES} tướng, theo thứ tự trong ảnh; tên tướng PHẢI là chữ Hán GIẢN THỂ (简体中文) đúng như in trong ảnh, không dịch, không phiên âm, không đoán tên không đọc được (bỏ qua ô đó). ` +
  "battleType = loại trận bằng chữ Hán nếu ảnh ghi (vd 攻城, 野战, 演武, 同盟战), không có -> null. " +
  "notes = ghi chú rất ngắn (≤ 100 ký tự) nếu có điều bất thường, còn lại null. Chỉ trả JSON.";

export interface ModelOptions {
  endpoint: string;
  apiKey: string;
  modelId: string;
  fetchImpl?: typeof fetch;
}

/** Lỗi có status HTTP để handler trả về. */
export class ModelError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const RESULT_ALIASES: Record<string, ReportResult> = {
  win: "win",
  victory: "win",
  胜: "win",
  胜利: "win",
  loss: "loss",
  lose: "loss",
  defeat: "loss",
  败: "loss",
  失败: "loss",
  draw: "draw",
  tie: "draw",
  平: "draw",
  平局: "draw",
};

const UNKNOWN_HERO = /^(未知|unknown|\?+|？+)$/iu;

function cleanHeroes(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [];
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") continue;
    const name = item.trim();
    if (!name || UNKNOWN_HERO.test(name) || Array.from(name).length > MAX_HERO_CHARS || out.includes(name)) continue;
    out.push(name);
    if (out.length === MAX_HEROES) break;
  }
  return out;
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? Array.from(text).slice(0, max).join("") : null;
}

/**
 * Parse + validate output model. Chịu code fence / text thừa quanh JSON; loại tên
 * tướng rỗng/未知/quá dài/trùng; cắt còn 5. Không có object JSON -> ném lỗi.
 */
export function parseAnalysis(content: string): ReportAnalysis {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no json object");
  const raw: unknown = JSON.parse(content.slice(start, end + 1));
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("not an object");
  const data = raw as Record<string, unknown>;
  const resultKey = typeof data.result === "string" ? data.result.trim().toLowerCase() : "";
  return {
    result: Object.hasOwn(RESULT_ALIASES, resultKey) ? RESULT_ALIASES[resultKey] : null,
    ally: { heroes: cleanHeroes(field(data.ally, "heroes")) },
    enemy: { heroes: cleanHeroes(field(data.enemy, "heroes")) },
    battleType: cleanText(data.battleType, 40),
    notes: cleanText(data.notes, 300),
  };
}

/** Đọc khoá của một object không rõ kiểu (null nếu không phải object). */
function field(value: unknown, key: string): unknown {
  return value && typeof value === "object" && key in value ? (value as Record<string, unknown>)[key] : undefined;
}

function extractContent(data: unknown): string {
  const choices = field(data, "choices");
  const content = field(field(Array.isArray(choices) ? choices[0] : undefined, "message"), "content");
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((c: unknown) => (typeof c === "string" ? c : String(field(c, "text") ?? ""))).join("");
  }
  return "";
}

/** Gọi model; lỗi upstream -> ModelError 502/503; output không đọc được -> ModelError 422. */
export async function analyzeReportImage(imageDataUri: string, opts: ModelOptions): Promise<ReportAnalysis> {
  const fetchImpl = opts.fetchImpl || fetch;
  let resp: Response;
  try {
    resp = await fetchImpl(opts.endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts.modelId,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: REPORT_PROMPT },
              { type: "image_url", image_url: { url: imageDataUri } },
            ],
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
      }),
    });
  } catch {
    throw new ModelError(502, "ai_unavailable", "Dịch vụ AI tạm lỗi, thử lại sau");
  }
  if (!resp.ok) {
    if (resp.status === 429) throw new ModelError(503, "ai_overloaded", "Dịch vụ AI đang quá tải, thử lại sau");
    throw new ModelError(502, "ai_unavailable", "Dịch vụ AI tạm lỗi, thử lại sau");
  }
  const content = extractContent(await resp.json().catch(() => null));
  try {
    return parseAnalysis(content);
  } catch {
    throw new ModelError(422, "ai_unreadable", "Không đọc được chiến báo từ ảnh");
  }
}

export function toDataUri(bytes: Uint8Array, contentType: string): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:${contentType};base64,${btoa(bin)}`;
}
