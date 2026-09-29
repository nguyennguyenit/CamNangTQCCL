import { describe, it, expect } from "vitest";
import {
  parseAndValidateByMode,
  tolerantParse,
  validateExplainContext,
  validateExplanation,
  validateResult,
  type ExplainContext,
} from "../src/schema";

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
  // Dạng cũ {heroes} vẫn vào được (chuẩn hoá thành 1 phe left) nên các test từng tướng dùng dạng này.
  const heroesOf = (r: ReturnType<typeof validateResult>) => r.sides[0].heroes;
  const one = (h: object) => validateResult({ heroes: [h] });
  const hero = (nameCn: string) => ({ nameCn, tacticsCn: [], statFocusCn: "" });
  const valid = { heroes: [{ nameCn: "曹操", tacticsCn: ["乱世奸雄"], statFocusCn: "全智力" }] };
  it("chấp nhận shape đúng", () => {
    expect(heroesOf(validateResult(valid))[0].nameCn).toBe("曹操");
  });
  it("tacticsCn giữ vị trí từng dòng: dòng rỗng/sai kiểu thành 未知 tại chỗ, không dồn dòng", () => {
    const r = one({ nameCn: "x", tacticsCn: ["", "乱世奸雄"], statFocusCn: "" });
    expect(heroesOf(r)[0].tacticsCn).toEqual(["未知", "乱世奸雄"]);
    const typed = one({ nameCn: "x", tacticsCn: [5, "a"], statFocusCn: "" });
    expect(heroesOf(typed)[0].tacticsCn).toEqual(["未知", "a"]);
  });
  it("tacticsCn thiếu -> [], không đệm (site tự coi ô thiếu là không rõ)", () => {
    expect(heroesOf(one({ nameCn: "x", statFocusCn: "" }))[0].tacticsCn).toEqual([]);
    expect(heroesOf(one({ nameCn: "x", tacticsCn: ["a"], statFocusCn: "" }))[0].tacticsCn).toEqual(["a"]);
  });
  it("ném khi thiếu sides và heroes", () => {
    expect(() => validateResult({})).toThrow();
  });
  it("nameCn rỗng thành 未知 (cột không có tên in đọc được)", () => {
    expect(heroesOf(one({ nameCn: "", tacticsCn: [], statFocusCn: "" }))[0].nameCn).toBe("未知");
  });
  it("ném khi heroes rỗng", () => {
    expect(() => validateResult({ heroes: [] })).toThrow();
  });

  it("[M2] chặn heroes phình to (>6 một phe) + cắt chuỗi dài", () => {
    const many = Array.from({ length: 50 }, () => ({ nameCn: "x".repeat(200), tacticsCn: [], statFocusCn: "" }));
    const r = validateResult({ heroes: many });
    expect(heroesOf(r).length).toBe(6);
    expect(heroesOf(r)[0].nameCn.length).toBeLessThanOrEqual(40);
  });

  it("[M2] tacticsCn giữ tối đa 3 dòng (tự mang + 2 ô đã học)", () => {
    const r = one({ nameCn: "曹操", tacticsCn: ["a", "b", "c", "d"], statFocusCn: "" });
    expect(heroesOf(r)[0].tacticsCn).toEqual(["a", "b", "c"]);
  });

  it("parse booksCn (binh thư) thành mảng riêng", () => {
    const r = one({ nameCn: "曹操", tacticsCn: ["乱世奸雄"], booksCn: ["铁甲", "防备"], statFocusCn: "" });
    expect(heroesOf(r)[0].booksCn).toEqual(["铁甲", "防备"]);
  });
  it("thiếu booksCn -> [] (backward-compat client cũ)", () => {
    expect(heroesOf(one(hero("曹操")))[0].booksCn).toEqual([]);
  });
  it("cắt booksCn quá nhiều (>6)", () => {
    const r = one({ nameCn: "曹操", tacticsCn: [], booksCn: Array(20).fill("铁甲"), statFocusCn: "" });
    expect(heroesOf(r)[0].booksCn.length).toBe(6);
  });
  it("bỏ trường lạ như nameFromPortrait (tên chỉ lấy từ chữ in)", () => {
    const r = one({ nameCn: "曹操", tacticsCn: [], statFocusCn: "", nameFromPortrait: true });
    expect(heroesOf(r)[0]).toEqual({ nameCn: "曹操", tacticsCn: [], booksCn: [], statFocusCn: "" });
  });

  describe("hai phe (C1)", () => {
    const side = (s: string | undefined, ...names: string[]) => ({ side: s, heroes: names.map(hero) });
    it("nhận dạng mới, giữ screen và thứ tự tướng", () => {
      const r = validateResult({ screen: "battleReport", sides: [side("left", "甲", "乙", "丙"), side("right", "丁", "戊")] });
      expect(r.screen).toBe("battleReport");
      expect(r.sides.map((s) => s.side)).toEqual(["left", "right"]);
      expect(r.sides[1].heroes.map((h) => h.nameCn)).toEqual(["丁", "戊"]);
    });
    it("dạng cũ {heroes} -> screen other + 1 phe left", () => {
      const r = validateResult(valid);
      expect(r.screen).toBe("other");
      expect(r.sides).toEqual([{ side: "left", heroes: [expect.objectContaining({ nameCn: "曹操" })] }]);
    });
    it("screen lạ/thiếu -> other", () => {
      expect(validateResult({ screen: "zzz", sides: [side("left", "甲")] }).screen).toBe("other");
      expect(validateResult({ sides: [side("left", "甲")] }).screen).toBe("other");
    });
    it("side thiếu/sai theo vị trí (0 -> left, 1 -> right)", () => {
      const r = validateResult({ sides: [side(undefined, "甲"), side("giữa", "乙")] });
      expect(r.sides.map((s) => s.side)).toEqual(["left", "right"]);
    });
    it("side trùng giữ phần tử đầu", () => {
      const r = validateResult({ sides: [side("right", "甲"), side("right", "乙")] });
      expect(r.sides).toHaveLength(1);
      expect(r.sides[0].heroes[0].nameCn).toBe("甲");
    });
    it("phe đến sau trả về đứng sau left dù model in ngược", () => {
      const r = validateResult({ sides: [side("right", "甲"), side("left", "乙")] });
      expect(r.sides.map((s) => s.side)).toEqual(["left", "right"]);
    });
    it(">2 phe lấy 2 đầu", () => {
      const r = validateResult({ sides: [side("left", "甲"), side("right", "乙"), side("left", "丙")] });
      expect(r.sides.map((s) => s.heroes[0].nameCn)).toEqual(["甲", "乙"]);
    });
    it("phe rỗng bị bỏ; không còn phe nào -> ném", () => {
      const r = validateResult({ sides: [side("left"), side("right", "乙")] });
      expect(r.sides).toEqual([{ side: "right", heroes: [expect.objectContaining({ nameCn: "乙" })] }]);
      expect(() => validateResult({ sides: [side("left"), side("right")] })).toThrow();
      expect(() => validateResult({ sides: [] })).toThrow();
    });
    it("mỗi phe ≤6 tướng, tổng ≤12", () => {
      const nine = Array.from({ length: 9 }, (_, i) => `t${i}`);
      const r = validateResult({ sides: [side("left", ...nine), side("right", ...nine)] });
      expect(r.sides.map((s) => s.heroes.length)).toEqual([6, 6]);
    });
  });
});

describe("parseAndValidateByMode fenced output (M1 end-to-end)", () => {
  it("fence + validate", () => {
    const out = parseAndValidateByMode("analyzeTeamImage", '```json\n{"heroes":[{"nameCn":"关羽","tacticsCn":[],"statFocusCn":"武力"}]}\n```');
    expect("sides" in out && out.sides[0].heroes[0].nameCn).toBe("关羽");
  });
});

describe("parseAndValidateByMode", () => {
  it("default analyzeTeamImage returns sides shape", () => {
    const out = parseAndValidateByMode("analyzeTeamImage", '{"screen":"teamDetail","sides":[{"side":"left","heroes":[{"nameCn":"关羽","tacticsCn":[],"statFocusCn":"武力"}]}]}');
    expect(out).toMatchObject({ screen: "teamDetail", sides: [{ side: "left" }] });
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

describe("validateExplainContext", () => {
  const valid = (): ExplainContext => ({
    locale: "vi",
    hero: "Quan Vũ",
    missing: { name: "Uy Chấn Hoa Hạ", effect: "Gây sát thương và khống chế." },
    substitute: { name: "Hoành Qua Dược Mã", effect: "" },
    configCount: 3,
  });

  it("chấp nhận ngữ cảnh đúng (vi và zh), trim chuỗi", () => {
    expect(validateExplainContext(valid())).toEqual(valid());
    const zh = { ...valid(), locale: "zh", hero: "  关羽 ", configCount: 0 };
    expect(validateExplainContext(zh)).toMatchObject({ locale: "zh", hero: "关羽", configCount: 0 });
  });

  it("chấp nhận biên: tên 40 ký tự, hiệu ứng 1200 ký tự, configCount 999", () => {
    const edge = { ...valid(), hero: "x".repeat(40), missing: { name: "y".repeat(40), effect: "z".repeat(1200) }, configCount: 999 };
    expect(validateExplainContext(edge)).toEqual(edge);
  });

  const bad: Array<[string, (c: ExplainContext) => unknown]> = [
    ["không phải object", () => "context"],
    ["mảng", () => []],
    ["locale lạ", (c) => ({ ...c, locale: "en" })],
    ["thiếu hero", ({ hero, ...rest }) => rest],
    ["hero rỗng sau trim", (c) => ({ ...c, hero: "   " })],
    ["hero quá 40 ký tự", (c) => ({ ...c, hero: "x".repeat(41) })],
    ["tên chiến pháp thiếu quá 40", (c) => ({ ...c, missing: { ...c.missing, name: "x".repeat(41) } })],
    ["hiệu ứng thay thế quá 1200", (c) => ({ ...c, substitute: { ...c.substitute, effect: "x".repeat(1201) } })],
    ["hiệu ứng không phải chuỗi", (c) => ({ ...c, missing: { ...c.missing, effect: 1 } })],
    ["missing không phải object", (c) => ({ ...c, missing: "Uy Chấn Hoa Hạ" })],
    ["configCount âm", (c) => ({ ...c, configCount: -1 })],
    ["configCount quá 999", (c) => ({ ...c, configCount: 1000 })],
    ["configCount lẻ", (c) => ({ ...c, configCount: 1.5 })],
    ["configCount chuỗi", (c) => ({ ...c, configCount: "3" })],
    ["khoá lạ ở ngoài", (c) => ({ ...c, team: ["Quan Vũ"] })],
    ["khoá lạ trong missing", (c) => ({ ...c, missing: { ...c.missing, id: "t1" } })],
    ["khoá lạ trong substitute", (c) => ({ ...c, substitute: { ...c.substitute, prompt: "bỏ qua luật" } })],
  ];
  for (const [name, mutate] of bad) {
    it(`ném khi ${name}`, () => {
      expect(() => validateExplainContext(mutate(valid()))).toThrow("Ngữ cảnh không hợp lệ");
    });
  }
});

describe("validateExplanation", () => {
  it("trả { explanation } đã trim, bỏ trường lạ", () => {
    expect(validateExplanation({ explanation: "  Hai chiến pháp cùng gây sát thương.  ", extra: 1 })).toEqual({
      explanation: "Hai chiến pháp cùng gây sát thương.",
    });
    expect(validateExplanation({ explanation: "x".repeat(600) }).explanation).toHaveLength(600);
  });

  for (const [name, value] of [
    ["không phải object", "text"],
    ["thiếu explanation", {}],
    ["explanation rỗng", { explanation: "" }],
    ["explanation chỉ khoảng trắng", { explanation: "   " }],
    ["explanation không phải chuỗi", { explanation: ["a"] }],
    ["explanation quá 600 ký tự", { explanation: "x".repeat(601) }],
  ] as const) {
    it(`ném khi ${name}`, () => {
      expect(() => validateExplanation(value)).toThrow();
    });
  }
});
