import { describe, expect, it } from "vitest";
import { buildRequestBody, promptByMode } from "../src/model";

describe("vision prompt", () => {
  it("đọc binh thư vào booksCn riêng + cho phép đoán tướng từ chân dung khi tên vắng", () => {
    const body = buildRequestBody("vision-model", "data:image/jpeg;base64,abc");
    const text = (body.messages[0].content[0] as { text: string }).text;

    // B1: binh thư tách field riêng
    expect(text).toContain("booksCn");
    expect(text).toContain("KHÔNG đưa binh thư vào tacticsCn");
    // B0: cho phép suy đoán chân dung khi không có tên in + cờ
    expect(text).toContain("nameFromPortrait=true");
    expect(text).toContain("未知");
    // tên IN RÕ đọc nguyên văn, không ép vào danh sách (chống map sai như 周劭->姜维)
    expect(text).toContain("KỂ CẢ khi không có trong danh sách");
    // giữ guard chống nhầm dòng chọn tướng + binh chủng
    expect(text).toContain("Không dùng tên trong dòng #帅选择");
    expect(text).toContain("象兵");
  });
});

describe("scan mode prompts", () => {
  it("buildRequestBody defaults to analyzeTeamImage for backward compatibility", () => {
    const body = buildRequestBody("vision-model", "data:image/jpeg;base64,abc");
    const text = (body.messages[0].content[0] as { text: string }).text;
    expect(text).toBe(promptByMode("analyzeTeamImage"));
  });

  it("scanHeroes prompt asks for roster heroes not team tactics", () => {
    const text = promptByMode("scanHeroes");
    expect(text).toContain("danh sách võ tướng");
    expect(text).toContain("redStars");
    expect(text).not.toContain("booksCn");
  });

  it("scanTactics prompt only asks for owned tactic names", () => {
    const text = promptByMode("scanTactics");
    expect(text).toContain("danh sách chiến pháp");
    expect(text).toContain("tactics");
  });

  it("scanBuiltTeams prompt asks for locked heroes and tactics", () => {
    const text = promptByMode("scanBuiltTeams");
    expect(text).toContain("team đã build");
    expect(text).toContain("heroesCn");
    expect(text).toContain("tacticsCn");
  });
});
