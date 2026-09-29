import { describe, expect, it } from "vitest";
import { resolveAnalyzeMode } from "../src/index";

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
