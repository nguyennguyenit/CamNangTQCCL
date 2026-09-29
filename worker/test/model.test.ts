import { describe, expect, it } from "vitest";
import { buildRequestBody, callModel, promptByMode } from "../src/model";

describe("vision prompt", () => {
  it("chỉ chép chữ in: không nhận diện chân dung, không có danh sách tên, chép mọi dòng chiến pháp", () => {
    const text = promptByMode("analyzeTeamImage");

    // Không còn đường đoán tướng: không cờ chân dung, không "menu" tên tướng cho model chọn.
    expect(text).not.toContain("nameFromPortrait");
    expect(text).not.toContain("DANH SÁCH HỢP LỆ");
    expect(text).not.toMatch(/SP关羽|、/u);
    expect(text).toContain("không nhận diện tướng qua chân dung");
    expect(text).toContain("nameCn = 未知");
    // Chép mọi dòng chiến pháp theo thứ tự (kể cả tự mang); site bỏ dòng tự mang bằng dữ liệu tướng.
    expect(text).toContain("tối đa 3 dòng");
    expect(text).toContain("KỂ CẢ dòng đầu là chiến pháp tự mang");
    // Màn chiến báo không in binh thư: không được lấy chiến pháp làm binh thư.
    expect(text).toContain("Màn chiến báo KHÔNG in binh thư");
    // Binh thư tách field riêng.
    expect(text).toContain("booksCn");
    expect(text).toContain("KHÔNG đưa dòng chiến pháp nào vào booksCn");
    // Giữ guard chống nhầm dòng chọn tướng + binh chủng.
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

describe("callModel khi upstream lỗi", () => {
  const opts = (status: number) => ({
    providers: [
      { id: "p", label: "P", endpoint: "https://model.test/v1/chat/completions", apiKey: "key", modelId: "vision-model", enabled: true },
    ],
    fetchImpl: (async () => new Response("provider detail", { status })) as typeof fetch,
  });

  for (const [upstream, status, message] of [
    [401, 502, "Dịch vụ AI tạm lỗi, thử lại sau"],
    [403, 502, "Dịch vụ AI tạm lỗi, thử lại sau"],
    [500, 502, "Dịch vụ AI tạm lỗi, thử lại sau"],
    [503, 502, "Dịch vụ AI tạm lỗi, thử lại sau"],
    [429, 503, "Dịch vụ AI đang quá tải, thử lại sau"],
  ] as const) {
    it(`upstream ${upstream} -> lỗi ${status} thông điệp cố định, không mang mã số`, async () => {
      const error = await callModel("data:image/png;base64,AA==", opts(upstream)).catch((e) => e);
      expect(error).toMatchObject({ status, message });
      expect(error.message).not.toMatch(/\d/u);
    });
  }
});
