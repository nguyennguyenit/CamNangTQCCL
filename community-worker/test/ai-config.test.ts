// Kiểm module dùng chung shared/ai-config.ts (worker/ và community-worker/ cùng import).

import { describe, expect, it } from "vitest";
import {
  AI_PROVIDERS_KEY,
  AiCallError,
  callWithFailover,
  encryptProviders,
  loadProviders,
  type AiProvider,
} from "../../shared/ai-config";

const SECRET = "secret-a";

function provider(id: string, extra: Partial<AiProvider> = {}): AiProvider {
  return { id, label: id, endpoint: `https://${id}.test/v1/chat/completions`, modelId: `model-${id}`, apiKey: `key-${id}`, enabled: true, ...extra };
}

function memoryKv(entries: [string, string][] = []) {
  const store = new Map(entries);
  return { get: async (key: string) => store.get(key) ?? null, put: async (key: string, value: string) => void store.set(key, value) };
}

/** fetch giả: mỗi host trả theo bảng; ghi lại thứ tự URL được gọi. */
function fakeFetch(byHost: Record<string, () => Response>) {
  const calls: string[] = [];
  const impl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(new URL(url).hostname);
    return byHost[new URL(url).hostname]();
  }) as typeof fetch;
  return { calls, impl };
}

const ok = () => Response.json({ choices: [{ message: { content: "{}" } }] });
const status = (code: number) => () => new Response("upstream secret detail key-a", { status: code });

describe("mã hoá danh sách provider", () => {
  it("round-trip qua KV giữ nguyên danh sách và thứ tự; bản ghi không chứa key dạng rõ", async () => {
    const list = [provider("a"), provider("b", { enabled: false })];
    const blob = await encryptProviders(list, SECRET);
    expect(blob).not.toContain("key-a");
    expect(await loadProviders(memoryKv([[AI_PROVIDERS_KEY, blob]]), SECRET)).toEqual(list);
  });

  it("IV ngẫu nhiên: mã hoá hai lần cùng dữ liệu ra hai bản khác nhau", async () => {
    expect(await encryptProviders([provider("a")], SECRET)).not.toBe(await encryptProviders([provider("a")], SECRET));
  });

  it("sai secret, thiếu secret, chưa có bản ghi, bản ghi hỏng -> [] (chưa cấu hình)", async () => {
    const kv = memoryKv([[AI_PROVIDERS_KEY, await encryptProviders([provider("a")], SECRET)]]);
    expect(await loadProviders(kv, "secret-b")).toEqual([]);
    expect(await loadProviders(kv, undefined)).toEqual([]);
    expect(await loadProviders(kv, "")).toEqual([]);
    expect(await loadProviders(memoryKv(), SECRET)).toEqual([]);
    expect(await loadProviders(memoryKv([[AI_PROVIDERS_KEY, "{not json"]]), SECRET)).toEqual([]);
  });
});

describe("callWithFailover", () => {
  it("thử theo thứ tự, bỏ qua mục tắt; gửi model/key của từng mục", async () => {
    const { calls, impl } = fakeFetch({ "a.test": status(500), "c.test": ok });
    const seen: string[] = [];
    const resp = await callWithFailover(
      [provider("a"), provider("b", { enabled: false }), provider("c")],
      (modelId) => (seen.push(modelId), { model: modelId }),
      impl,
    );
    expect(resp.status).toBe(200);
    expect(calls).toEqual(["a.test", "c.test"]);
    expect(seen).toEqual(["model-a", "model-c"]);
  });

  for (const code of [401, 402, 403, 429, 500, 503]) {
    it(`upstream ${code} -> chuyển sang mục kế`, async () => {
      const { calls, impl } = fakeFetch({ "a.test": status(code), "b.test": ok });
      expect((await callWithFailover([provider("a"), provider("b")], () => ({}), impl)).status).toBe(200);
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
    expect((await callWithFailover([provider("a"), provider("b")], () => ({}), impl)).status).toBe(200);
    expect(calls).toHaveLength(2);
  });

  it("2xx (kể cả nội dung không đọc được) -> dừng, KHÔNG thử mục khác", async () => {
    const { calls, impl } = fakeFetch({ "a.test": () => new Response("không phải JSON"), "b.test": ok });
    const resp = await callWithFailover([provider("a"), provider("b")], () => ({}), impl);
    expect(await resp.text()).toBe("không phải JSON");
    expect(calls).toEqual(["a.test"]);
  });

  it("4xx khác (yêu cầu hỏng) -> dừng ngay với 502", async () => {
    const { calls, impl } = fakeFetch({ "a.test": status(400), "b.test": ok });
    await expect(callWithFailover([provider("a"), provider("b")], () => ({}), impl)).rejects.toMatchObject({ status: 502 });
    expect(calls).toEqual(["a.test"]);
  });

  it("hết mục: 429 cuối -> 503 quá tải; còn lại -> 502; thông điệp không lộ upstream", async () => {
    const overloaded = fakeFetch({ "a.test": status(500), "b.test": status(429) });
    const e1 = await callWithFailover([provider("a"), provider("b")], () => ({}), overloaded.impl).catch((e: unknown) => e);
    expect(e1).toBeInstanceOf(AiCallError);
    expect(e1).toMatchObject({ status: 503, code: "ai_overloaded", message: "Dịch vụ AI đang quá tải, thử lại sau" });
    const down = fakeFetch({ "a.test": status(429), "b.test": status(401) });
    const e2 = await callWithFailover([provider("a"), provider("b")], () => ({}), down.impl).catch((e: unknown) => e);
    expect(e2).toMatchObject({ status: 502, code: "ai_unavailable", message: "Dịch vụ AI tạm lỗi, thử lại sau" });
  });

  it("rỗng hoặc không mục nào bật -> 503 chưa cấu hình, không gọi mạng", async () => {
    const { calls, impl } = fakeFetch({});
    for (const list of [[], [provider("a", { enabled: false })]]) {
      await expect(callWithFailover(list, () => ({}), impl)).rejects.toMatchObject({ status: 503, code: "ai_not_configured" });
    }
    expect(calls).toEqual([]);
  });
});
