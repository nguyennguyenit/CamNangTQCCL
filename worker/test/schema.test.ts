import { describe, it, expect } from "vitest";
import { parseAndValidateByMode, tolerantParse, validateResult } from "../src/schema";

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
  it("tacticsCn giữ vị trí từng dòng: dòng rỗng/sai kiểu thành 未知 tại chỗ, không dồn dòng", () => {
    const r = validateResult({ heroes: [{ nameCn: "x", tacticsCn: ["", "乱世奸雄"], statFocusCn: "" }] });
    expect(r.heroes[0].tacticsCn).toEqual(["未知", "乱世奸雄"]);
    const typed = validateResult({ heroes: [{ nameCn: "x", tacticsCn: [5, "a"], statFocusCn: "" }] });
    expect(typed.heroes[0].tacticsCn).toEqual(["未知", "a"]);
  });
  it("tacticsCn thiếu -> [], không đệm (site tự coi ô thiếu là không rõ)", () => {
    expect(validateResult({ heroes: [{ nameCn: "x", statFocusCn: "" }] }).heroes[0].tacticsCn).toEqual([]);
    expect(validateResult({ heroes: [{ nameCn: "x", tacticsCn: ["a"], statFocusCn: "" }] }).heroes[0].tacticsCn).toEqual(["a"]);
  });
  it("ném khi thiếu heroes", () => {
    expect(() => validateResult({})).toThrow();
  });
  it("nameCn rỗng thành 未知 (cột không có tên in đọc được)", () => {
    expect(validateResult({ heroes: [{ nameCn: "", tacticsCn: [], statFocusCn: "" }] }).heroes[0].nameCn).toBe("未知");
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

  it("[M2] tacticsCn giữ tối đa 3 dòng (tự mang + 2 ô đã học)", () => {
    const r = validateResult({ heroes: [{ nameCn: "曹操", tacticsCn: ["a", "b", "c", "d"], statFocusCn: "" }] });
    expect(r.heroes[0].tacticsCn).toEqual(["a", "b", "c"]);
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
  it("bỏ trường lạ như nameFromPortrait (tên chỉ lấy từ chữ in)", () => {
    const r = validateResult({ heroes: [{ nameCn: "曹操", tacticsCn: [], statFocusCn: "", nameFromPortrait: true }] });
    expect(r.heroes[0]).toEqual({ nameCn: "曹操", tacticsCn: [], booksCn: [], statFocusCn: "" });
  });
});

describe("parseAndValidateByMode fenced output (M1 end-to-end)", () => {
  it("fence + validate", () => {
    const out = parseAndValidateByMode("analyzeTeamImage", '```json\n{"heroes":[{"nameCn":"关羽","tacticsCn":[],"statFocusCn":"武力"}]}\n```');
    expect("heroes" in out && out.heroes[0].nameCn).toBe("关羽");
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

  it("validates scanBuiltTeams mode and supplies Vietnamese missing names", () => {
    const out = parseAndValidateByMode(
      "scanBuiltTeams",
      '{"teams":[{"teamName":"旧队","heroesCn":["程普"],"tacticsCn":["抚辑军民"]},{"heroesCn":["关羽"],"tacticsCn":[]}]}',
    );
    expect(out).toEqual({
      teams: [
        { teamName: "旧队", heroesCn: ["程普"], tacticsCn: ["抚辑军民"] },
        { teamName: "Đội số 2", heroesCn: ["关羽"], tacticsCn: [] },
      ],
    });
  });
});
