// Kiểm module dùng chung shared/ai-config.ts (worker/ và community-worker/ cùng import).

import { describe, expect, it } from "vitest";
import {
  AI_CONFIG_KEY,
  AI_GROUPS,
  AiCallError,
  callWithFailover,
  effortToBody,
  emptyConfig,
  encryptConfig,
  loadAiConfig,
  resolveRoute,
  type AiConfig,
  type AiProvider,
  type AiRoute,
  type AiTarget,
} from "../../shared/ai-config";

const SECRET = "secret-a";

function provider(id: string, extra: Partial<AiProvider> = {}): AiProvider {
  return {
    id,
    label: id,
    preset: "",
    endpoint: `https://${id}.test/v1/chat/completions`,
    apiKey: `key-${id}`,
    enabled: true,
    extraModels: [{ modelId: `model-${id}`, vision: true, effortStyle: "deepseek", efforts: ["off", "high"] }],
    ...extra,
  };
}

function target(id: string, extra: Partial<AiTarget> = {}): AiTarget {
  return { label: id, endpoint: `https://${id}.test/v1/chat/completions`, apiKey: `key-${id}`, modelId: `model-${id}`, effortStyle: "deepseek", effort: "off", ...extra };
}

function route(targets: AiTarget[], extra: Partial<AiRoute> = {}): AiRoute {
  return { group: "teamScan", targets, timeoutMs: 45_000, budgetMs: 180_000, ...extra };
}

function memoryKv(entries: [string, string][] = []) {
  const store = new Map(entries);
  return { get: async (key: string) => store.get(key) ?? null, put: async (key: string, value: string) => void store.set(key, value) };
}

/** fetch giả: mỗi host trả theo bảng; ghi lại host và body JSON đã gửi. */
function fakeFetch(byHost: Record<string, () => Response>) {
  const calls: string[] = [];
  const bodies: unknown[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const host = new URL(String(input)).hostname;
    calls.push(host);
    bodies.push(JSON.parse(String(init?.body)));
    return byHost[host]();
  }) as typeof fetch;
  return { calls, bodies, impl };
}

const ok = () => Response.json({ choices: [{ message: { content: "{}" } }] });
const status = (code: number) => () => new Response("upstream secret detail key-a", { status: code });

function configWith(providers: AiProvider[], chain: AiConfig["groups"]["teamScan"]["chain"]): AiConfig {
  const config = emptyConfig();
  config.providers = providers;
  config.groups.teamScan = { chain, timeoutMs: 45_000, budgetMs: 90_000 };
  return config;
}

describe("lưu/đọc cấu hình", () => {
  it("round-trip qua KV giữ nguyên cấu hình; bản ghi không chứa key dạng rõ", async () => {
    const config = configWith([provider("a"), provider("b", { enabled: false, preset: "deepseek", extraModels: [] })], [
      { providerId: "b", modelId: "deepseek-flash", effort: "high" },
      { providerId: "a", modelId: "model-a", effort: "off" },
    ]);
    const blob = await encryptConfig(config, SECRET);
    expect(blob).not.toContain("key-a");
    expect(await loadAiConfig(memoryKv([[AI_CONFIG_KEY, blob]]), SECRET)).toEqual(config);
  });

  it("IV ngẫu nhiên: mã hoá hai lần cùng dữ liệu ra hai bản khác nhau", async () => {
    expect(await encryptConfig(emptyConfig(), SECRET)).not.toBe(await encryptConfig(emptyConfig(), SECRET));
  });

  it("sai secret, thiếu secret, chưa có bản ghi, bản ghi hỏng -> cấu hình rỗng", async () => {
    const kv = memoryKv([[AI_CONFIG_KEY, await encryptConfig(configWith([provider("a")], []), SECRET)]]);
    for (const loaded of [
      await loadAiConfig(kv, "secret-b"),
      await loadAiConfig(kv, undefined),
      await loadAiConfig(kv, ""),
      await loadAiConfig(memoryKv(), SECRET),
      await loadAiConfig(memoryKv([[AI_CONFIG_KEY, "{not json"]]), SECRET),
    ]) {
      expect(loaded).toEqual(emptyConfig());
    }
  });
});

describe("resolveRoute", () => {
  it("giữ thứ tự chuỗi; bỏ mắt xích trỏ provider tắt/không tồn tại, model hoặc effort không còn hợp lệ", () => {
    const config = configWith([provider("a"), provider("b", { enabled: false }), provider("c", { preset: "opencode-zen" })], [
      { providerId: "c", modelId: "deepseek-v4.1-flash", effort: "max" },
      { providerId: "b", modelId: "model-b", effort: "off" },
      { providerId: "x", modelId: "model-x", effort: "off" },
      { providerId: "a", modelId: "model-gone", effort: "off" },
      { providerId: "a", modelId: "model-a", effort: "max" },
      { providerId: "a", modelId: "model-a", effort: "high" },
    ]);
    const { targets, timeoutMs, budgetMs } = resolveRoute(config, "teamScan");
    expect(targets.map((t) => [t.label, t.modelId, t.effort])).toEqual([
      ["c", "deepseek-v4.1-flash", "max"],
      ["a", "model-a", "high"],
    ]);
    expect([timeoutMs, budgetMs]).toEqual([45_000, 90_000]);
    expect(resolveRoute(config, "battleReport").targets).toEqual([]);
  });
});

describe("effortToBody", () => {
  it("dịch mức theo kiểu API của model", () => {
    expect(effortToBody("deepseek", "off")).toEqual({ thinking: { type: "disabled" } });
    expect(effortToBody("deepseek", "high")).toEqual({ thinking: { type: "enabled" }, reasoning_effort: "high" });
    expect(effortToBody("openai", "medium")).toEqual({ reasoning_effort: "medium" });
    expect(effortToBody("none", "default")).toEqual({});
  });
});

describe("callWithFailover", () => {
  it("thử theo thứ tự; body = buildBody(model) + trường effort của từng mắt xích", async () => {
    const { calls, bodies, impl } = fakeFetch({ "a.test": status(500), "c.test": ok });
    const resp = await callWithFailover(
      route([target("a", { effort: "high" }), target("c", { effortStyle: "none", effort: "default" })]),
      (model) => ({ model }),
      impl,
    );
    expect(resp.status).toBe(200);
    expect(calls).toEqual(["a.test", "c.test"]);
    expect(bodies).toEqual([{ model: "model-a", thinking: { type: "enabled" }, reasoning_effort: "high" }, { model: "model-c" }]);
  });

  for (const code of [401, 402, 403, 429, 500, 503]) {
    it(`upstream ${code} -> chuyển sang mục kế`, async () => {
      const { calls, impl } = fakeFetch({ "a.test": status(code), "b.test": ok });
      expect((await callWithFailover(route([target("a"), target("b")]), () => ({}), impl)).status).toBe(200);
      expect(calls).toEqual(["a.test", "b.test"]);
    });
  }

  it("lỗi mạng/timeout -> chuyển sang mục kế", async () => {
    const calls: string[] = [];
    const impl = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      if (calls.length === 1) throw new DOMException("timed out", "TimeoutError");
      return ok();
    }) as typeof fetch;
    expect((await callWithFailover(route([target("a"), target("b")]), () => ({}), impl)).status).toBe(200);
    expect(calls).toHaveLength(2);
  });

  it("2xx (kể cả nội dung không đọc được) -> dừng, KHÔNG thử mục khác", async () => {
    const { calls, impl } = fakeFetch({ "a.test": () => new Response("không phải JSON"), "b.test": ok });
    const resp = await callWithFailover(route([target("a"), target("b")]), () => ({}), impl);
    expect(await resp.text()).toBe("không phải JSON");
    expect(calls).toEqual(["a.test"]);
  });

  it("4xx khác (yêu cầu hỏng) -> dừng ngay với 502", async () => {
    const { calls, impl } = fakeFetch({ "a.test": status(400), "b.test": ok });
    await expect(callWithFailover(route([target("a"), target("b")]), () => ({}), impl)).rejects.toMatchObject({ status: 502 });
    expect(calls).toEqual(["a.test"]);
  });

  it("hết mục: 429 cuối -> 503 quá tải; còn lại -> 502; thông điệp không lộ upstream", async () => {
    const overloaded = fakeFetch({ "a.test": status(500), "b.test": status(429) });
    const e1 = await callWithFailover(route([target("a"), target("b")]), () => ({}), overloaded.impl).catch((e: unknown) => e);
    expect(e1).toBeInstanceOf(AiCallError);
    expect(e1).toMatchObject({ status: 503, code: "ai_overloaded", message: "Dịch vụ AI đang quá tải, thử lại sau" });
    const down = fakeFetch({ "a.test": status(429), "b.test": status(401) });
    const e2 = await callWithFailover(route([target("a"), target("b")]), () => ({}), down.impl).catch((e: unknown) => e);
    expect(e2).toMatchObject({ status: 502, code: "ai_unavailable", message: "Dịch vụ AI tạm lỗi, thử lại sau" });
  });

  it("nhóm không có mắt xích -> 503 chưa cấu hình, không gọi mạng", async () => {
    const { calls, impl } = fakeFetch({});
    await expect(callWithFailover(route([]), () => ({}), impl)).rejects.toMatchObject({ status: 503, code: "ai_not_configured" });
    expect(calls).toEqual([]);
  });

  it("trần tổng: mỗi lượt chờ tối đa phần còn lại, còn dưới 3s thì dừng failover", async () => {
    let clock = 0;
    const calls: string[] = [];
    const impl = (async (input: RequestInfo | URL) => {
      calls.push(new URL(String(input)).hostname);
      clock += 40_000;
      return new Response("x", { status: 500 });
    }) as typeof fetch;
    const r = route([target("a"), target("b"), target("c")], { timeoutMs: 45_000, budgetMs: 82_500 });
    await expect(callWithFailover(r, () => ({}), impl, () => clock)).rejects.toMatchObject({ status: 502 });
    // 0s -> a (lỗi lúc 40s), còn 42.5s -> b (lỗi lúc 80s), còn 2.5s < 3s -> không thử c.
    expect(calls).toEqual(["a.test", "b.test"]);
  });
});
