// Schema kết quả vision + validate + tolerant parse (M1).
// Model trả JSON: { heroes: [{ nameCn, tacticsCn[], booksCn[], statFocusCn, nameFromPortrait? }] }.
// Site map Hán -> Việt qua dict (match-dict.js), Worker KHÔNG map.

export interface HeroRead {
  nameCn: string;
  tacticsCn: string[];
  booksCn: string[];
  statFocusCn: string;
  // True khi model SUY ĐOÁN tên tướng từ chân dung (không có tên in rõ). Site
  // dùng để ép confidence xuống "low" + gắn cờ kiểm tra (chống auto-accept sai).
  nameFromPortrait?: boolean;
}
export interface AnalyzeResult {
  heroes: HeroRead[];
  raw?: string;
}

/**
 * Tách JSON từ output model. Hỗ trợ:
 * - JSON thuần.
 * - JSON bọc trong ```json ... ``` fence (khi không có response_format).
 * - Văn bản có lẫn JSON (lấy block { ... } đầu tiên cân ngoặc).
 */
export function tolerantParse(text: string): unknown {
  const raw = (text || "").trim();
  // Bỏ fence ```json ... ``` nếu có.
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1].trim() : raw;
  try {
    return JSON.parse(body);
  } catch {
    // Tìm object cân ngoặc đầu tiên. (M4: chưa string-aware — ngoặc trong giá trị
    // string hiếm gặp với nameCn Hán; nếu vỡ -> ném -> handler trả 422 lịch sự.)
    const start = body.indexOf("{");
    if (start === -1) throw new SyntaxError("Không tìm thấy JSON trong output model");
    let depth = 0;
    for (let i = start; i < body.length; i++) {
      if (body[i] === "{") depth++;
      else if (body[i] === "}") {
        depth--;
        if (depth === 0) return JSON.parse(body.slice(start, i + 1));
      }
    }
    throw new SyntaxError("JSON trong output model không cân ngoặc");
  }
}

// [M2] Chặn output phình to (model lỗi/độc): đội ≤6 tướng, cắt chuỗi/ mảng.
const MAX_HEROES = 12;
const MAX_LIST = 6; // trần số phần tử mảng Hán (tacticsCn / booksCn)
const MAX_STR = 40; // tên Hán/chất tướng thực tế rất ngắn

const cut = (s: string) => s.trim().slice(0, MAX_STR);

/** Ép parsed về AnalyzeResult; ném nếu thiếu/sai cấu trúc bắt buộc. */
export function validateResult(parsed: unknown): AnalyzeResult {
  if (!parsed || typeof parsed !== "object") throw new TypeError("Kết quả không phải object");
  const heroesRaw = (parsed as any).heroes;
  if (!Array.isArray(heroesRaw)) throw new TypeError("Thiếu mảng 'heroes'");
  const heroes: HeroRead[] = heroesRaw.slice(0, MAX_HEROES).map((h: any, i: number) => {
    if (!h || typeof h !== "object") throw new TypeError(`heroes[${i}] không hợp lệ`);
    const nameCn = typeof h.nameCn === "string" ? cut(h.nameCn) : "";
    if (!nameCn) throw new TypeError(`heroes[${i}].nameCn rỗng`);
    const strList = (v: any) =>
      Array.isArray(v) ? v.filter((t: any) => typeof t === "string" && t.trim()).slice(0, MAX_LIST).map(cut) : [];
    const tacticsCn = strList(h.tacticsCn);
    const booksCn = strList(h.booksCn); // binh thư (field riêng; thiếu -> [] backward-compat)
    const statFocusCn = typeof h.statFocusCn === "string" ? cut(h.statFocusCn) : "";
    const hero: HeroRead = { nameCn, tacticsCn, booksCn, statFocusCn };
    if (h.nameFromPortrait === true) hero.nameFromPortrait = true;
    return hero;
  });
  if (heroes.length === 0) throw new TypeError("heroes rỗng");
  return { heroes };
}

/** parse + validate gộp; ném lỗi mô tả nếu không đọc được. */
export function parseAndValidate(text: string): AnalyzeResult {
  return validateResult(tolerantParse(text));
}
