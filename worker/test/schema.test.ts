import { describe, it, expect } from "vitest";
import { parseAndValidateByMode, tolerantParse, validateResult, parseAndValidate } from "../src/schema";

describe("tolerantParse", () => {
  it("parse JSON thuần", () => {
    expect(tolerantParse('{"a":1}')).toEqual({ a: 1 });
  });
  it("bỏ fence ```json", () => {
    expect(tolerantParse('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it("lấy object cân ngoặc trong văn bản lẫn lộn", () => {
    expect(tolerantParse('Đây là kết quả: {"heroes":[]} hết.')).toEqual({ heroes: [] });
  });
  it("ném khi không có JSON", () => {
    expect(() => tolerantParse("không có gì")).toThrow();
  });
});

describe("validateResult", () => {
  const valid = { heroes: [{ nameCn: "曹操", tacticsCn: ["乱世奸雄"], statFocusCn: "全智力" }] };
  it("chấp nhận shape đúng", () => {
    expect(validateResult(valid).heroes[0].nameCn).toBe("曹操");
  });
  it("lọc tacticsCn rỗng/không phải string", () => {
    const r = validateResult({ heroes: [{ nameCn: "x", tacticsCn: ["a", "", 5], statFocusCn: "" }] });
    expect(r.heroes[0].tacticsCn).toEqual(["a"]);
  });
  it("ném khi thiếu heroes", () => {
    expect(() => validateResult({})).toThrow();
  });
  it("ném khi nameCn rỗng", () => {
    expect(() => validateResult({ heroes: [{ nameCn: "", tacticsCn: [], statFocusCn: "" }] })).toThrow();
  });
  it("ném khi heroes rỗng", () => {
    expect(() => validateResult({ heroes: [] })).toThrow();
  });

  it("[M2] chặn heroes phình to (>12) + cắt chuỗi dài", () => {
    const many = Array.from({ length: 50 }, () => ({ nameCn: "x".repeat(200), tacticsCn: [], statFocusCn: "" }));
    const r = validateResult({ heroes: many });
    expect(r.heroes.length).toBe(12);
    expect(r.heroes[0].nameCn.length).toBeLessThanOrEqual(40);
  });

  it("[M2] cắt tacticsCn quá nhiều (>6)", () => {
    const r = validateResult({ heroes: [{ nameCn: "曹操", tacticsCn: Array(20).fill("乱世奸雄"), statFocusCn: "" }] });
    expect(r.heroes[0].tacticsCn.length).toBe(6);
  });

  it("parse booksCn (binh thư) thành mảng riêng", () => {
    const r = validateResult({ heroes: [{ nameCn: "曹操", tacticsCn: ["乱世奸雄"], booksCn: ["铁甲", "防备"], statFocusCn: "" }] });
    expect(r.heroes[0].booksCn).toEqual(["铁甲", "防备"]);
  });
  it("thiếu booksCn -> [] (backward-compat client cũ)", () => {
    const r = validateResult({ heroes: [{ nameCn: "曹操", tacticsCn: [], statFocusCn: "" }] });
    expect(r.heroes[0].booksCn).toEqual([]);
  });
  it("cắt booksCn quá nhiều (>6)", () => {
    const r = validateResult({ heroes: [{ nameCn: "曹操", tacticsCn: [], booksCn: Array(20).fill("铁甲"), statFocusCn: "" }] });
    expect(r.heroes[0].booksCn.length).toBe(6);
  });
  it("nameFromPortrait=true giữ lại; mặc định vắng", () => {
    const r = validateResult({ heroes: [{ nameCn: "曹操", tacticsCn: [], statFocusCn: "", nameFromPortrait: true }] });
    expect(r.heroes[0].nameFromPortrait).toBe(true);
    const r2 = validateResult({ heroes: [{ nameCn: "曹操", tacticsCn: [], statFocusCn: "" }] });
    expect(r2.heroes[0].nameFromPortrait).toBeUndefined();
  });
});

describe("parseAndValidate (M1 end-to-end)", () => {
  it("fence + validate", () => {
    const out = parseAndValidate('```json\n{"heroes":[{"nameCn":"关羽","tacticsCn":[],"statFocusCn":"武力"}]}\n```');
    expect(out.heroes[0].nameCn).toBe("关羽");
  });
});

describe("parseAndValidateByMode", () => {
  it("default analyzeTeamImage keeps existing analyze result shape", () => {
    const out = parseAndValidateByMode("analyzeTeamImage", '{"heroes":[{"nameCn":"关羽","tacticsCn":[],"statFocusCn":"武力"}]}');
    expect("heroes" in out).toBe(true);
  });

  it("validates scanHeroes mode", () => {
    const out = parseAndValidateByMode("scanHeroes", '{"heroes":[{"nameCn":"马超","level":50,"redStars":4}]}');
    expect(out).toEqual({ heroes: [{ nameCn: "马超", level: 50, redStars: 4 }] });
  });

  it("validates scanTactics mode", () => {
    const out = parseAndValidateByMode("scanTactics", '{"tactics":[{"nameCn":"当锋摧决"}]}');
    expect(out).toEqual({ tactics: [{ nameCn: "当锋摧决" }] });
  });

  it("validates scanBuiltTeams mode", () => {
    const out = parseAndValidateByMode("scanBuiltTeams", '{"teams":[{"teamName":"旧队","heroesCn":["程普"],"tacticsCn":["抚辑军民"]}]}');
    expect(out).toEqual({ teams: [{ teamName: "旧队", heroesCn: ["程普"], tacticsCn: ["抚辑军民"] }] });
  });
});
