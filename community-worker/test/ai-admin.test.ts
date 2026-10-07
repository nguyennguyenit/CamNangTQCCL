import { describe, expect, it } from "vitest";
import { AI_CONFIG_KEY, AI_GROUPS, decryptConfig, type AiConfig } from "../../shared/ai-config";
import { AI_SECRET, createHarness, imageForm, PNG_BYTES, TEST_CONFIG, TEST_GROUP, TEST_PROVIDER, type ApiJson, type Harness } from "./fakes";

const PATH = "/api/admin/ai/config";
const LONG_KEY = "sk-live-0123456789abcdefWXYZ";

async function stored(h: Harness): Promise<AiConfig> {
  return decryptConfig(h.aiStore.get(AI_CONFIG_KEY) ?? "", AI_SECRET);
}

const ZEN = {
  id: "zen",
  label: "OpenCode Zen",
  preset: "opencode-zen",
  endpoint: "https://opencode.ai/zen/v1/chat/completions",
  enabled: true,
  extraModels: [],
};
const ZEN_LINK = { providerId: "zen", modelId: "deepseek-v4.1-flash", effort: "off" };

/** Cả bốn nhóm cùng một cấu hình (ghi đè được từng nhóm). */
function groups(base: object = TEST_GROUP, overrides: Record<string, unknown> = {}) {
  return { ...Object.fromEntries(AI_GROUPS.map((id) => [id, base])), ...overrides };
}

function put(h: Harness, providers: unknown[], groupsInput: unknown = groups()) {
  return h.request(PATH, { as: "admin", method: "PUT", json: { providers, groups: groupsInput } });
}

async function code(res: Response): Promise<string> {
  return (await res.json<ApiJson>()).error.code;
}

describe("GET/PUT /api/admin/ai/config", () => {
  it("chỉ admin: khách 401, người thường 403 (cả GET lẫn PUT)", async () => {
    const h = createHarness();
    expect((await h.request(PATH)).status).toBe(401);
    expect((await h.request(PATH, { as: "alice" })).status).toBe(403);
    expect((await h.request(PATH, { as: "alice", method: "PUT", json: { providers: [], groups: groups() } })).status).toBe(403);
    expect(await stored(h)).toEqual(TEST_CONFIG);
  });

  it("GET không bao giờ chứa key, chỉ 4 ký tự cuối; kèm chuỗi từng nhóm và catalog mẫu", async () => {
    const h = createHarness();
    const saved = await put(h, [{ ...ZEN, apiKey: LONG_KEY }], groups({ ...TEST_GROUP, chain: [ZEN_LINK] }, { explainSubstitute: { ...TEST_GROUP, chain: [] } }));
    expect(saved.status).toBe(200);
    const res = await h.request(PATH, { as: "admin" });
    const text = await res.text();
    expect(text).not.toContain(LONG_KEY);
    expect(text).not.toContain("sk-live");
    const body = JSON.parse(text);
    expect(body.providers).toEqual([{ ...ZEN, keyLast4: "WXYZ" }]);
    expect(body.groups.explainSubstitute.chain).toEqual([]);
    expect(body.groups.teamScan.chain).toEqual([ZEN_LINK]);
    expect(body.presets.map((p: { id: string }) => p.id)).toEqual(["deepseek", "opencode-zen"]);
    expect(body.groupNeedsVision.explainSubstitute).toBe(false);
  });

  it("PUT giữ key cũ theo id khi apiKey rỗng/thiếu; lưu model tự thêm và chuỗi riêng từng nhóm", async () => {
    const h = createHarness();
    const custom = {
      id: "custom",
      label: "Tự chọn",
      preset: "",
      endpoint: "https://custom.test/v1/chat/completions",
      enabled: true,
      apiKey: LONG_KEY,
      extraModels: [{ modelId: "glm-5.3-flash", vision: false, effortStyle: "openai", efforts: ["none", "high"] }],
    };
    const perGroup = groups(TEST_GROUP, {
      explainSubstitute: {
        chain: [{ providerId: "custom", modelId: "glm-5.3-flash", effort: "high" }, { providerId: "deepseek", modelId: "deepseek-v4-pro", effort: "max" }],
        timeoutMs: 60_000,
        budgetMs: 90_000,
      },
    });
    const res = await put(h, [custom, { ...TEST_PROVIDER, label: "DeepSeek 2", apiKey: "" }], perGroup);
    expect(res.status).toBe(200);
    expect(await res.text()).not.toContain(LONG_KEY);
    expect(await stored(h)).toEqual({ providers: [custom, { ...TEST_PROVIDER, label: "DeepSeek 2" }], groups: perGroup });
    // Lần sau bỏ hẳn trường apiKey vẫn giữ key đã lưu.
    const { apiKey: _drop, ...withoutKey } = custom;
    expect((await put(h, [withoutKey, TEST_PROVIDER], perGroup)).status).toBe(200);
    expect((await stored(h)).providers[0].apiKey).toBe(LONG_KEY);
    // Đổi endpoint mà không nhập key: key cũ không đi theo sang host mới.
    const moved = await put(h, [{ ...withoutKey, endpoint: "https://khac.test/v1/chat/completions" }, TEST_PROVIDER], perGroup);
    expect(moved.status).toBe(400);
    expect(await code(moved)).toBe("missing_api_key");
    expect((await stored(h)).providers[0].endpoint).toBe(custom.endpoint);
  });

  it("nhóm được để trống chuỗi (nhóm đó trả chưa cấu hình)", async () => {
    const h = createHarness();
    expect((await put(h, [TEST_PROVIDER], groups({ ...TEST_GROUP, chain: [] }))).status).toBe(200);
    expect((await stored(h)).groups.teamScan.chain).toEqual([]);
  });

  it("mục mới thiếu key -> 400, không ghi đè bản cũ", async () => {
    const h = createHarness();
    const before = h.aiStore.get(AI_CONFIG_KEY);
    for (const item of [ZEN, { ...ZEN, apiKey: "   " }]) {
      const res = await put(h, [item]);
      expect(res.status).toBe(400);
      expect(await code(res)).toBe("missing_api_key");
    }
    expect(h.aiStore.get(AI_CONFIG_KEY)).toBe(before);
  });

  it("validate nhà cung cấp: endpoint, mẫu, id, độ dài, số mục, model tự thêm", async () => {
    const h = createHarness();
    const withKey = { ...ZEN, apiKey: LONG_KEY };
    const custom = { ...withKey, preset: "", endpoint: "https://c.test/v1/chat/completions" };
    const model = { modelId: "m", vision: true, effortStyle: "deepseek", efforts: ["off"] };
    const cases: [unknown[], string][] = [
      [[{ ...custom, endpoint: "http://c.test" }], "invalid_endpoint"],
      [[{ ...custom, endpoint: "không phải url" }], "invalid_endpoint"],
      [[{ ...withKey, endpoint: "https://khac.test/v1/chat/completions" }], "invalid_endpoint"],
      [[{ ...withKey, preset: "khong-co" }], "invalid_preset"],
      [[withKey, { ...withKey }], "duplicate_id"],
      [[{ ...withKey, id: "có dấu" }], "invalid_id"],
      [[{ ...withKey, label: "x".repeat(81) }], "invalid_label"],
      [[{ ...withKey, apiKey: "k".repeat(501) }], "invalid_apiKey"],
      [[{ ...withKey, enabled: "true" }], "invalid_enabled"],
      [Array.from({ length: 11 }, (_, i) => ({ ...withKey, id: `p${i}` })), "invalid_providers"],
      [[{ ...custom, extraModels: [{ ...model, modelId: "" }] }], "invalid_modelId"],
      [[{ ...custom, extraModels: [model, model] }], "duplicate_model"],
      [[{ ...withKey, extraModels: [{ ...model, modelId: "deepseek-v4.1-flash" }] }], "duplicate_model"],
      [[{ ...custom, extraModels: [{ ...model, vision: "yes" }] }], "invalid_models"],
      [[{ ...custom, extraModels: [{ ...model, effortStyle: "anthropic" }] }], "invalid_effort_style"],
      [[{ ...custom, extraModels: [{ ...model, efforts: [] }] }], "invalid_efforts"],
      [[{ ...custom, extraModels: [{ ...model, efforts: ["medium"] }] }], "invalid_efforts"],
      [[{ ...custom, extraModels: Array.from({ length: 21 }, (_, i) => ({ ...model, modelId: `m${i}` })) }], "invalid_models"],
    ];
    for (const [providers, expected] of cases) {
      const res = await put(h, providers, groups({ ...TEST_GROUP, chain: [] }));
      expect(res.status, expected).toBe(400);
      expect(await code(res), expected).toBe(expected);
    }
    expect(await stored(h)).toEqual(TEST_CONFIG);
  });

  it("validate nhóm: đủ bốn nhóm, mắt xích trỏ đúng provider/model/effort, nhóm ảnh cần model vision, timeout/trần tổng", async () => {
    const h = createHarness();
    const link = (extra: object) => ({ ...TEST_GROUP, chain: [{ ...TEST_GROUP.chain[0], ...extra }] });
    const cases: [unknown, string][] = [
      [null, "invalid_groups"],
      [{ teamScan: TEST_GROUP }, "invalid_groups"],
      [groups({ ...TEST_GROUP, chain: "x" }), "invalid_chain"],
      [groups({ ...TEST_GROUP, chain: Array(11).fill(TEST_GROUP.chain[0]) }), "invalid_chain"],
      [groups(link({ providerId: "khong-co" })), "unknown_provider"],
      [groups(link({ modelId: "gpt-5" })), "unknown_model"],
      [groups(link({ effort: "medium" })), "invalid_effort"],
      [groups(TEST_GROUP, { battleReport: link({ modelId: "deepseek-v4-pro" }) }), "model_not_vision"],
      [groups({ ...TEST_GROUP, timeoutMs: 4_999 }), "invalid_timeout"],
      [groups({ ...TEST_GROUP, timeoutMs: 121_000, budgetMs: 150_000 }), "invalid_timeout"],
      [groups({ ...TEST_GROUP, timeoutMs: 30_000.5 }), "invalid_timeout"],
      [groups({ ...TEST_GROUP, timeoutMs: 45_500, budgetMs: 90_000 }), "invalid_timeout"],
      [groups({ ...TEST_GROUP, timeoutMs: 45_000, budgetMs: 44_000 }), "invalid_budget"],
      [groups({ ...TEST_GROUP, budgetMs: 181_000 }), "invalid_budget"],
    ];
    for (const [input, expected] of cases) {
      const res = await put(h, [TEST_PROVIDER], input);
      expect(res.status, expected).toBe(400);
      expect(await code(res), expected).toBe(expected);
    }
    // Model không vision vẫn hợp lệ cho nhóm chỉ văn bản.
    expect((await put(h, [TEST_PROVIDER], groups(TEST_GROUP, { explainSubstitute: link({ modelId: "deepseek-v4-pro" }) }))).status).toBe(200);
  });

  it("thiếu AI_CONFIG_SECRET -> 503, không ghi KV", async () => {
    const h = createHarness({ AI_CONFIG_SECRET: undefined });
    const before = h.aiStore.get(AI_CONFIG_KEY);
    expect((await h.request(PATH, { as: "admin" })).status).toBe(503);
    expect((await put(h, [{ ...ZEN, apiKey: LONG_KEY }])).status).toBe(503);
    expect(h.aiStore.get(AI_CONFIG_KEY)).toBe(before);
  });

  it("chuỗi lưu xong được chiến báo dùng ngay: đúng thứ tự, failover, effort của từng mắt xích", async () => {
    const h = createHarness();
    await put(
      h,
      [{ ...ZEN, apiKey: LONG_KEY }, TEST_PROVIDER],
      groups(TEST_GROUP, {
        battleReport: { chain: [{ ...ZEN_LINK, effort: "high" }, TEST_GROUP.chain[0]], timeoutMs: 45_000, budgetMs: 90_000 },
      }),
    );
    h.setFetch((url) =>
      url === ZEN.endpoint
        ? new Response("hết tiền", { status: 402 })
        : Response.json({ choices: [{ message: { content: '{"result":"win"}' } }] }),
    );
    const res = await h.request("/api/reports/analyze", { as: "alice", method: "POST", body: imageForm(PNG_BYTES, "image/png") });
    expect(res.status).toBe(200);
    expect(h.fetchCalls.map((c) => c.url)).toEqual([ZEN.endpoint, TEST_PROVIDER.endpoint]);
    expect(new Headers(h.fetchCalls[0].init?.headers).get("Authorization")).toBe(`Bearer ${LONG_KEY}`);
    const bodies = h.fetchCalls.map((c) => JSON.parse(String(c.init?.body)));
    expect(bodies.map((b) => [b.model, b.thinking, b.reasoning_effort])).toEqual([
      ["deepseek-v4.1-flash", { type: "enabled" }, "high"],
      ["deepseek-flash", { type: "disabled" }, undefined],
    ]);
  });
});
