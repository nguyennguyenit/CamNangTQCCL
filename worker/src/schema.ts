// Schema kết quả vision + validate + tolerant parse (M1).
// Model trả JSON: { screen, sides: [{ side, heroes: [{ nameCn, tacticsCn[≤3 dòng], booksCn[], statFocusCn }] }] }.
// Chỉ chép chữ in trong ảnh: ô không đọc được là `未知`. Site map Hán -> Việt qua dict
// (match-dict.js), Worker KHÔNG map.

/** Chữ đánh dấu ô không đọc được (tên tướng hoặc một ô chiến pháp). */
export const UNKNOWN_CN = "未知";
/** Số dòng chiến pháp tối đa in dưới một tướng: tự mang + 2 ô tự chọn (màn chiến báo in đủ 3). */
export const TACTIC_ROWS = 3;

export interface HeroRead {
  nameCn: string;
  // Mọi dòng chiến pháp in dưới tướng theo thứ tự (≤ TACTIC_ROWS), kể cả dòng tự mang; dòng không
  // đọc được = `未知`. Site bỏ dòng tự mang bằng dữ liệu tướng (`selfTacticCn`), Worker không phân loại.
  tacticsCn: string[];
  // Binh thư theo thứ tự in (binh thư chính trước); không có -> [].
  booksCn: string[];
  statFocusCn: string;
}
/** Loại màn ảnh: chiến báo (2 phe), chi tiết một đội, hoặc khác. */
export type ScreenKind = "battleReport" | "teamDetail" | "other";
export type SideId = "left" | "right";
export interface AnalyzeSide {
  side: SideId;
  heroes: HeroRead[];
}
export interface AnalyzeResult {
  screen: ScreenKind;
  sides: AnalyzeSide[];
}

export type AnalyzeMode = "analyzeTeamImage" | "scanHeroes" | "scanTactics" | "scanBuiltTeams" | "explainSubstitute";
export const ANALYZE_MODES: AnalyzeMode[] = ["analyzeTeamImage", "scanHeroes", "scanTactics", "scanBuiltTeams", "explainSubstitute"];
/** Mode đọc ảnh (bắt buộc `image`); `explainSubstitute` chỉ văn bản, nhận `context`. */
export type ImageMode = Exclude<AnalyzeMode, "explainSubstitute">;

export interface RosterHeroRead {
  nameCn: string;
  level?: number;
  redStars?: number;
}
export interface RosterHeroesScanResult {
  heroes: RosterHeroRead[];
}
export interface TacticRead {
  nameCn: string;
}
export interface TacticsScanResult {
  tactics: TacticRead[];
}
export interface BuiltTeamRead {
  teamName: string;
  heroesCn: string[];
  tacticsCn: string[];
}
export interface BuiltTeamsScanResult {
  teams: BuiltTeamRead[];
}
/** Một chiến pháp trong ngữ cảnh giải thích: tên + mô tả hiệu ứng (do site cung cấp). */
export interface ExplainTactic {
  name: string;
  effect: string;
}
/** Ngữ cảnh mode explainSubstitute: vì sao `substitute` thay được `missing` trên tướng `hero`. */
export interface ExplainContext {
  locale: "vi" | "zh";
  hero: string;
  missing: ExplainTactic;
  substitute: ExplainTactic;
  /** Số cấu hình cùng mùa tướng này mang chiến pháp thay thế (0..999). */
  configCount: number;
}
export interface ExplainResult {
  explanation: string;
}
export type AnalyzeModeResult = AnalyzeResult | RosterHeroesScanResult | TacticsScanResult | BuiltTeamsScanResult;

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

// [M2] Chặn output phình to (model lỗi/độc): mỗi phe ≤6 tướng, tổng ≤12, cắt chuỗi/ mảng.
const MAX_SIDE_HEROES = 6;
const MAX_HEROES = 12;
const MAX_SIDES = 2;
const MAX_LIST = 6; // trần số phần tử mảng Hán (booksCn và danh sách của các mode scan)
const MAX_STR = 40; // tên Hán/chất tướng thực tế rất ngắn

const cut = (s: string) => s.trim().slice(0, MAX_STR);

const SCREEN_KINDS: readonly ScreenKind[] = ["battleReport", "teamDetail", "other"];
const SIDE_IDS: readonly SideId[] = ["left", "right"];

function heroRead(h: any, label: string): HeroRead {
  if (!h || typeof h !== "object") throw new TypeError(`${label} không hợp lệ`);
  const nameCn = (typeof h.nameCn === "string" ? cut(h.nameCn) : "") || UNKNOWN_CN;
  const tacticsCn = tacticRows(h.tacticsCn);
  const booksCn = strList(h.booksCn); // binh thư (field riêng; thiếu -> [] backward-compat)
  const statFocusCn = typeof h.statFocusCn === "string" ? cut(h.statFocusCn) : "";
  return { nameCn, tacticsCn, booksCn, statFocusCn };
}

/**
 * Ép parsed về AnalyzeResult; ném nếu không còn phe nào có tướng.
 * Chịu lỗi: dạng cũ `{heroes}` -> 1 phe left; screen lạ -> other; side thiếu/sai theo vị trí;
 * side trùng giữ phần tử đầu; >2 phe lấy 2 đầu; phe rỗng bị bỏ.
 */
export function validateResult(parsed: unknown): AnalyzeResult {
  if (!parsed || typeof parsed !== "object") throw new TypeError("Kết quả không phải object");
  const p = parsed as any;
  const screen: ScreenKind = SCREEN_KINDS.includes(p.screen) ? p.screen : "other";
  let rawSides: any[];
  if (Array.isArray(p.sides)) rawSides = p.sides.slice(0, MAX_SIDES);
  else if (Array.isArray(p.heroes)) rawSides = [{ side: "left", heroes: p.heroes }]; // dạng cũ
  else throw new TypeError("Thiếu mảng 'sides'");

  const seen = new Set<SideId>();
  const sides: AnalyzeSide[] = [];
  let total = 0;
  rawSides.forEach((s: any, i: number) => {
    if (!s || typeof s !== "object" || !Array.isArray(s.heroes)) throw new TypeError(`sides[${i}] không hợp lệ`);
    const side: SideId = SIDE_IDS.includes(s.side) ? s.side : SIDE_IDS[i];
    if (seen.has(side)) return;
    seen.add(side);
    const heroes = s.heroes
      .slice(0, Math.min(MAX_SIDE_HEROES, MAX_HEROES - total))
      .map((h: any, j: number) => heroRead(h, `sides[${i}].heroes[${j}]`));
    if (heroes.length === 0) return;
    total += heroes.length;
    sides.push({ side, heroes });
  });
  if (sides.length === 0) throw new TypeError("sides rỗng");
  sides.sort((a, b) => SIDE_IDS.indexOf(a.side) - SIDE_IDS.indexOf(b.side));
  return { screen, sides };
}

function strList(v: any) {
  return Array.isArray(v) ? v.filter((t: any) => typeof t === "string" && t.trim()).slice(0, MAX_LIST).map(cut) : [];
}

/** Dòng chiến pháp theo vị trí (≤ TACTIC_ROWS): dòng trống/sai kiểu = `未知`, không dồn dòng. */
function tacticRows(v: unknown): string[] {
  const raw = Array.isArray(v) ? v.slice(0, TACTIC_ROWS) : [];
  return raw.map((value: unknown) => (typeof value === "string" ? cut(value) : "") || UNKNOWN_CN);
}

function numberField(v: any) {
  return Number.isFinite(v) ? Math.max(0, Math.min(100, Math.trunc(v))) : undefined;
}

export function validateRosterHeroesResult(parsed: unknown): RosterHeroesScanResult {
  if (!parsed || typeof parsed !== "object") throw new TypeError("Kết quả không phải object");
  const heroesRaw = (parsed as any).heroes;
  if (!Array.isArray(heroesRaw)) throw new TypeError("Thiếu mảng 'heroes'");
  const heroes = heroesRaw.slice(0, 80).map((h: any, i: number) => {
    if (!h || typeof h !== "object") throw new TypeError(`heroes[${i}] không hợp lệ`);
    const nameCn = typeof h.nameCn === "string" ? cut(h.nameCn) : "";
    if (!nameCn) throw new TypeError(`heroes[${i}].nameCn rỗng`);
    const hero: RosterHeroRead = { nameCn };
    const level = numberField(h.level);
    const redStars = numberField(h.redStars);
    if (level !== undefined) hero.level = level;
    if (redStars !== undefined) hero.redStars = Math.min(6, redStars);
    return hero;
  });
  if (heroes.length === 0) throw new TypeError("heroes rỗng");
  return { heroes };
}

export function validateTacticsScanResult(parsed: unknown): TacticsScanResult {
  if (!parsed || typeof parsed !== "object") throw new TypeError("Kết quả không phải object");
  const tacticsRaw = (parsed as any).tactics;
  if (!Array.isArray(tacticsRaw)) throw new TypeError("Thiếu mảng 'tactics'");
  const tactics = tacticsRaw.slice(0, 300).map((t: any, i: number) => {
    const raw = typeof t === "string" ? t : t?.nameCn;
    const nameCn = typeof raw === "string" ? cut(raw) : "";
    if (!nameCn) throw new TypeError(`tactics[${i}].nameCn rỗng`);
    return { nameCn };
  });
  if (tactics.length === 0) throw new TypeError("tactics rỗng");
  return { tactics };
}

export function validateBuiltTeamsScanResult(parsed: unknown): BuiltTeamsScanResult {
  if (!parsed || typeof parsed !== "object") throw new TypeError("Kết quả không phải object");
  const teamsRaw = (parsed as any).teams;
  if (!Array.isArray(teamsRaw)) throw new TypeError("Thiếu mảng 'teams'");
  const teams = teamsRaw.slice(0, 12).map((t: any, i: number) => {
    if (!t || typeof t !== "object") throw new TypeError(`teams[${i}] không hợp lệ`);
    const teamName = typeof t.teamName === "string" && t.teamName.trim() ? cut(t.teamName) : `Đội số ${i + 1}`;
    const heroesCn = strList(t.heroesCn || t.heroes);
    const tacticsCn = strList(t.tacticsCn || t.tactics);
    return { teamName, heroesCn, tacticsCn };
  }).filter((team) => team.heroesCn.length || team.tacticsCn.length);
  if (teams.length === 0) throw new TypeError("teams rỗng");
  return { teams };
}

export function parseAndValidateByMode(mode: ImageMode, text: string): AnalyzeModeResult {
  const parsed = tolerantParse(text);
  if (mode === "scanHeroes") return validateRosterHeroesResult(parsed);
  if (mode === "scanTactics") return validateTacticsScanResult(parsed);
  if (mode === "scanBuiltTeams") return validateBuiltTeamsScanResult(parsed);
  return validateResult(parsed);
}

export const INVALID_CONTEXT = "Ngữ cảnh không hợp lệ";
const MAX_NAME = 40;
const MAX_EFFECT = 1200;
const MAX_CONFIG_COUNT = 999;
export const MAX_EXPLANATION = 600;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Đúng tập khoá `keys` (không thiếu, không thừa). */
function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

/** Chuỗi đã trim, độ dài trong [min, max]; sai -> ném. */
function boundedString(value: unknown, min: number, max: number): string {
  if (typeof value !== "string") throw new TypeError(INVALID_CONTEXT);
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) throw new TypeError(INVALID_CONTEXT);
  return trimmed;
}

function explainTactic(value: unknown): ExplainTactic {
  if (!isPlainObject(value) || !hasExactKeys(value, ["name", "effect"])) throw new TypeError(INVALID_CONTEXT);
  return { name: boundedString(value.name, 1, MAX_NAME), effect: boundedString(value.effect, 0, MAX_EFFECT) };
}

/** Validate `context` client gửi cho explainSubstitute (không tin client): sai/thừa khoá/quá dài -> ném. */
export function validateExplainContext(value: unknown): ExplainContext {
  if (!isPlainObject(value) || !hasExactKeys(value, ["locale", "hero", "missing", "substitute", "configCount"])) {
    throw new TypeError(INVALID_CONTEXT);
  }
  const { locale, configCount } = value;
  if (locale !== "vi" && locale !== "zh") throw new TypeError(INVALID_CONTEXT);
  if (typeof configCount !== "number" || !Number.isInteger(configCount) || configCount < 0 || configCount > MAX_CONFIG_COUNT) {
    throw new TypeError(INVALID_CONTEXT);
  }
  return {
    locale,
    hero: boundedString(value.hero, 1, MAX_NAME),
    missing: explainTactic(value.missing),
    substitute: explainTactic(value.substitute),
    configCount,
  };
}

/** Output model explainSubstitute -> `{ explanation }` (1..600 ký tự sau trim); rỗng/quá dài -> ném. */
export function validateExplanation(parsed: unknown): ExplainResult {
  if (!isPlainObject(parsed) || typeof parsed.explanation !== "string") throw new TypeError("Thiếu 'explanation'");
  const explanation = parsed.explanation.trim();
  if (!explanation) throw new TypeError("explanation rỗng");
  if (explanation.length > MAX_EXPLANATION) throw new TypeError("explanation quá dài");
  return { explanation };
}
