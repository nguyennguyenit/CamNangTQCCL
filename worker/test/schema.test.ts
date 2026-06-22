import { describe, it, expect } from "vitest";
import { tolerantParse, validateResult, parseAndValidate } from "../src/schema";

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
});

describe("parseAndValidate (M1 end-to-end)", () => {
  it("fence + validate", () => {
    const out = parseAndValidate('```json\n{"heroes":[{"nameCn":"关羽","tacticsCn":[],"statFocusCn":"武力"}]}\n```');
    expect(out.heroes[0].nameCn).toBe("关羽");
  });
});
