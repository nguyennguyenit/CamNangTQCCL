import { describe, expect, it } from "vitest";
import { resolveAnalyzeMode, resolveImageLocale } from "../src/index";

describe("resolveAnalyzeMode", () => {
  it("defaults missing mode to analyzeTeamImage", () => {
    expect(resolveAnalyzeMode(undefined)).toBe("analyzeTeamImage");
  });

  it("accepts known scan modes", () => {
    expect(resolveAnalyzeMode("scanHeroes")).toBe("scanHeroes");
    expect(resolveAnalyzeMode("scanTactics")).toBe("scanTactics");
    expect(resolveAnalyzeMode("scanBuiltTeams")).toBe("scanBuiltTeams");
    expect(resolveAnalyzeMode("explainSubstitute")).toBe("explainSubstitute");
  });

  it("rejects invalid mode before model call", () => {
    expect(() => resolveAnalyzeMode("scanEverything")).toThrow("Mode không hợp lệ");
  });
});

describe("resolveImageLocale", () => {
  it("vắng locale -> undefined (hành vi cũ)", () => {
    expect(resolveImageLocale(undefined)).toBeUndefined();
    expect(resolveImageLocale(null)).toBeUndefined();
  });

  it("nhận mọi locale của Worker", () => {
    expect(resolveImageLocale("vi")).toBe("vi");
    expect(resolveImageLocale("zh")).toBe("zh");
    expect(resolveImageLocale("ja")).toBe("ja");
  });

  it("từ chối locale lạ, rỗng hoặc sai kiểu", () => {
    for (const bad of ["ko", "", "JA", 1, {}, []]) {
      expect(() => resolveImageLocale(bad)).toThrow("Locale không hợp lệ");
    }
  });
});
