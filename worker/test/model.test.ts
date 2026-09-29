import { describe, expect, it } from "vitest";
import type { AiRoute } from "../../shared/ai-config";
import { buildExplainRequestBody, buildRequestBody, callExplainModel, callModel, promptByMode } from "../src/model";
import type { ExplainContext } from "../src/schema";

function route(modelId: string, effort = "off"): AiRoute {
  return {
    group: "teamScan",
    targets: [{ label: "P", endpoint: "https://model.test/v1/chat/completions", apiKey: "key", modelId, effortStyle: "deepseek", effort }],
    timeoutMs: 45_000,
    budgetMs: 45_000,
  };
}

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
    route: route("vision-model"),
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

describe("explainSubstitute (chỉ văn bản)", () => {
  const context: ExplainContext = {
    locale: "vi",
    hero: "Quan Vũ",
    missing: { name: "Uy Chấn Hoa Hạ", effect: "Gây sát thương binh nhận 150% và làm choáng 1 lượt." },
    substitute: { name: "Hoành Qua Dược Mã", effect: "Gây sát thương binh nhận 120% lên toàn địch." },
    configCount: 4,
  };

  function promptText(ctx: ExplainContext): string {
    const content = buildExplainRequestBody("text-model", ctx).messages[0].content;
    expect(typeof content).toBe("string");
    return String(content);
  }

  it("body chỉ có văn bản, không image_url; giữ json_object; không tự đặt thinking (effort do chuỗi quyết định)", () => {
    const body = buildExplainRequestBody("text-model", context);
    expect(body.model).toBe("text-model");
    expect(JSON.stringify(body)).not.toContain("image_url");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body).not.toHaveProperty("thinking");
  });

  it("prompt đưa đủ dữ kiện và ràng buộc: chỉ giải thích, 2-4 câu, không nêu chiến pháp khác, không khuyên đội", () => {
    const text = promptText(context);
    for (const value of [context.hero, context.missing.name, context.missing.effect, context.substitute.name, context.substitute.effect]) {
      expect(text).toContain(value);
    }
    expect(text).toContain('"configCount":4');
    expect(text).toContain("JSON");
    expect(text).toContain('{"explanation"');
    expect(text).toContain("2-4 câu");
    expect(text).toContain("KHÁC BIỆT RÕ");
    expect(text).toContain("KHÔNG nêu tên bất kỳ chiến pháp nào khác");
    expect(text).toContain("KHÔNG khuyên");
    expect(text).toContain("tiếng Việt");
  });

  it("locale zh yêu cầu trả lời bằng tiếng Trung giản thể", () => {
    const text = promptText({ ...context, locale: "zh" });
    expect(text).toContain("简体中文");
    expect(text).not.toContain("Trả lời bằng tiếng Việt");
  });

  it("callExplainModel gửi body văn bản kèm effort của mắt xích và trả { explanation }", async () => {
    const sent: unknown[] = [];
    const fetchImpl = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      sent.push(JSON.parse(String(init?.body)));
      return Response.json({ choices: [{ message: { content: '{"explanation":" Cả hai đều gây sát thương. "}' } }] });
    }) as typeof fetch;
    expect(await callExplainModel(context, { route: route("text-model", "high"), fetchImpl })).toEqual({ explanation: "Cả hai đều gây sát thương." });
    expect(sent).toEqual([{ ...buildExplainRequestBody("text-model", context), thinking: { type: "enabled" }, reasoning_effort: "high" }]);
  });

  for (const [name, content] of [
    ["explanation rỗng", '{"explanation":"  "}'],
    ["explanation quá dài", JSON.stringify({ explanation: "x".repeat(601) })],
    ["không phải JSON", "Không biết."],
  ] as const) {
    it(`${name} -> 422 thông điệp cố định`, async () => {
      const fetchImpl = (async () => Response.json({ choices: [{ message: { content } }] })) as typeof fetch;
      const error = await callExplainModel(context, { route: route("text-model"), fetchImpl }).catch((e) => e);
      expect(error).toMatchObject({ status: 422, message: "Không giải thích được" });
    });
  }
});
