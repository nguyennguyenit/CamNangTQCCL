import { describe, expect, it } from "vitest";
import { AI_PROVIDERS_KEY, decryptProviders, type AiProvider } from "../../shared/ai-config";
import { AI_SECRET, createHarness, imageForm, PNG_BYTES, TEST_PROVIDER, type ApiJson, type Harness } from "./fakes";

const PATH = "/api/admin/ai/providers";
const LONG_KEY = "sk-live-0123456789abcdefWXYZ";

async function stored(h: Harness): Promise<AiProvider[]> {
  return decryptProviders(h.aiStore.get(AI_PROVIDERS_KEY) ?? "", AI_SECRET);
}

function put(h: Harness, providers: unknown[]) {
  return h.request(PATH, { as: "admin", method: "PUT", json: { providers } });
}

const ZEN = {
  id: "zen",
  label: "OpenCode Zen",
  endpoint: "https://opencode.ai/zen/v1/chat/completions",
  modelId: "deepseek-v4.1-flash",
  enabled: true,
};

describe("GET/PUT /api/admin/ai/providers", () => {
  it("chỉ admin: khách 401, người thường 403 (cả GET lẫn PUT)", async () => {
    const h = createHarness();
    expect((await h.request(PATH)).status).toBe(401);
    expect((await h.request(PATH, { as: "alice" })).status).toBe(403);
    expect((await h.request(PATH, { as: "alice", method: "PUT", json: { providers: [] } })).status).toBe(403);
    expect(await stored(h)).toEqual([TEST_PROVIDER]);
  });

  it("GET không bao giờ chứa key, chỉ 4 ký tự cuối", async () => {
    const h = createHarness();
    expect((await put(h, [{ ...ZEN, apiKey: LONG_KEY }])).status).toBe(200);
    const res = await h.request(PATH, { as: "admin" });
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).not.toContain(LONG_KEY);
    expect(text).not.toContain("sk-live");
    expect(JSON.parse(text)).toEqual({ providers: [{ ...ZEN, keyLast4: "WXYZ" }], configured: true });
  });

  it("PUT giữ key cũ theo id khi apiKey rỗng/thiếu; đổi thứ tự + thêm mục mới có key", async () => {
    const h = createHarness();
    const res = await put(h, [
      { ...ZEN, apiKey: LONG_KEY },
      { id: TEST_PROVIDER.id, label: "DeepSeek 2", endpoint: TEST_PROVIDER.endpoint, modelId: "deepseek-flash", apiKey: "", enabled: false },
    ]);
    expect(res.status).toBe(200);
    expect(await res.text()).not.toContain(LONG_KEY);
    expect(await stored(h)).toEqual([
      { ...ZEN, apiKey: LONG_KEY },
      { ...TEST_PROVIDER, label: "DeepSeek 2", enabled: false },
    ]);
    // Lần sau bỏ hẳn trường apiKey vẫn giữ key đã lưu.
    expect((await put(h, [ZEN])).status).toBe(200);
    expect((await stored(h))[0].apiKey).toBe(LONG_KEY);
  });

  it("mục mới thiếu key -> 400, không ghi đè bản cũ", async () => {
    const h = createHarness();
    const before = h.aiStore.get(AI_PROVIDERS_KEY);
    for (const item of [ZEN, { ...ZEN, apiKey: "   " }]) {
      const res = await put(h, [item]);
      expect(res.status).toBe(400);
      expect((await res.json<ApiJson>()).error.code).toBe("missing_api_key");
    }
    expect(h.aiStore.get(AI_PROVIDERS_KEY)).toBe(before);
  });

  it("validate: endpoint https parse được, id duy nhất/hợp lệ, độ dài, số mục tối đa", async () => {
    const h = createHarness();
    const withKey = { ...ZEN, apiKey: LONG_KEY };
    const cases: [unknown[], string][] = [
      [[{ ...withKey, endpoint: "http://opencode.ai/zen" }], "invalid_endpoint"],
      [[{ ...withKey, endpoint: "không phải url" }], "invalid_endpoint"],
      [[withKey, { ...withKey }], "duplicate_id"],
      [[{ ...withKey, id: "có dấu" }], "invalid_id"],
      [[{ ...withKey, label: "x".repeat(81) }], "invalid_label"],
      [[{ ...withKey, modelId: "" }], "invalid_modelId"],
      [[{ ...withKey, apiKey: "k".repeat(501) }], "invalid_apiKey"],
      [[{ ...withKey, endpoint: `https://a.test/${"p".repeat(500)}` }], "invalid_endpoint"],
      [[{ ...withKey, enabled: "true" }], "invalid_enabled"],
      [Array.from({ length: 11 }, (_, i) => ({ ...withKey, id: `p${i}` })), "invalid_providers"],
    ];
    for (const [providers, code] of cases) {
      const res = await put(h, providers);
      expect(res.status, code).toBe(400);
      expect((await res.json<ApiJson>()).error.code).toBe(code);
    }
    expect(await stored(h)).toEqual([TEST_PROVIDER]);
  });

  it("thiếu AI_CONFIG_SECRET -> 503, không ghi KV", async () => {
    const h = createHarness({ AI_CONFIG_SECRET: undefined });
    const before = h.aiStore.get(AI_PROVIDERS_KEY);
    expect((await h.request(PATH, { as: "admin" })).status).toBe(503);
    expect((await put(h, [{ ...ZEN, apiKey: LONG_KEY }])).status).toBe(503);
    expect(h.aiStore.get(AI_PROVIDERS_KEY)).toBe(before);
  });

  it("danh sách lưu xong được chiến báo dùng ngay, theo thứ tự ưu tiên + failover", async () => {
    const h = createHarness();
    await put(h, [{ ...ZEN, apiKey: LONG_KEY }, { ...TEST_PROVIDER, apiKey: "" }]);
    h.setFetch((url) =>
      url === ZEN.endpoint
        ? new Response("hết tiền", { status: 402 })
        : Response.json({ choices: [{ message: { content: '{"result":"win"}' } }] }),
    );
    const res = await h.request("/api/reports/analyze", { as: "alice", method: "POST", body: imageForm(PNG_BYTES, "image/png") });
    expect(res.status).toBe(200);
    expect(h.fetchCalls.map((c) => c.url)).toEqual([ZEN.endpoint, TEST_PROVIDER.endpoint]);
    expect(new Headers(h.fetchCalls[0].init?.headers).get("Authorization")).toBe(`Bearer ${LONG_KEY}`);
  });
});
