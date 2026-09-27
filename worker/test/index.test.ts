import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import type { Env } from "../src/config";

const ORIGIN = "https://tqccl.com";
const ORIGINS = ["https://tqccl.com", "https://www.tqccl.com", "https://tqccl.pages.dev"];
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MODEL = "https://model.test/v1/chat/completions";
const PNG = Buffer.from(
  Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array(92).fill(0)]),
).toString("base64");

interface FakeKV {
  store: Map<string, string>;
  gets: string[];
  puts: string[];
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

/** KV trong bộ nhớ, ghi lại mọi get/put; `failPut`/`failGet` quyết định lần nào ném lỗi. */
function fakeKV(
  { failPut, failGet }: { failPut?: (key: string, count: number) => boolean; failGet?: (key: string) => boolean } = {},
): FakeKV {
  const store = new Map<string, string>();
  const counts = new Map<string, number>();
  const kv: FakeKV = {
    store,
    gets: [],
    puts: [],
    async get(key) {
      kv.gets.push(key);
      if (failGet?.(key)) throw new Error("KV GET failed: 429");
      return store.get(key) ?? null;
    },
    async put(key, value) {
      kv.puts.push(key);
      const prefix = key.slice(0, 2);
      const count = (counts.get(prefix) ?? 0) + 1;
      counts.set(prefix, count);
      if (failPut?.(key, count)) throw new Error("KV PUT failed: 429");
      store.set(key, value);
    },
  };
  return kv;
}

function env(kv: FakeKV, extra: Partial<Env> = {}): Env {
  return {
    RL: kv as unknown as KVNamespace,
    QWEN_API_KEY: "qwen-key",
    TURNSTILE_SECRET: "turnstile-secret",
    IP_HASH_SECRET: "ip-hash-secret-for-tests",
    ALLOWED_ORIGINS: ORIGINS.join(","),
    MODEL_ENDPOINT: MODEL,
    ...extra,
  };
}

type Upstream = { siteverify?: () => Response; model?: () => Response | Promise<Response> };

/** `fetch` toàn cục giả cho siteverify và model; trả danh sách URL đã gọi. */
function stubFetch({ siteverify, model }: Upstream = {}): string[] {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url === SITEVERIFY) {
      return siteverify ? siteverify() : Response.json({ success: true, hostname: "tqccl.com" });
    }
    if (url === MODEL) {
      return model
        ? model()
        : Response.json({ choices: [{ message: { content: JSON.stringify({ heroes: [{ nameCn: "关羽", tacticsCn: [] }] }) } }] });
    }
    throw new Error(`unexpected fetch ${url}`);
  });
  return calls;
}

let issuedTokens = 0;
function analyzeRequest(body?: unknown, headers: Record<string, string> = {}) {
  body ??= { image: PNG, turnstileToken: `token-${++issuedTokens}`, mode: "analyzeTeamImage" };
  return new Request("https://worker.test/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN, "CF-Connecting-IP": "203.0.113.7", ...headers },
    body: JSON.stringify(body),
  });
}

async function expectJson(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
  expect(response.headers.get("Content-Type")).toBe("application/json");
  return response.json() as Promise<any>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /analyze khi KV lỗi", () => {
  it("lỗi ghi bộ đếm ngày vẫn trả kết quả JSON có CORS", async () => {
    stubFetch();
    const kv = fakeKV({ failPut: (key, count) => key.startsWith("d:") && count === 2 });
    const first = await worker.fetch(analyzeRequest(), env(kv));
    expect(await expectJson(first, 200)).toEqual({ heroes: [expect.objectContaining({ nameCn: "关羽" })] });
    const second = await worker.fetch(analyzeRequest(), env(kv));
    expect(await expectJson(second, 200)).toEqual({ heroes: [expect.objectContaining({ nameCn: "关羽" })] });
  });

  it("lỗi đọc bộ đếm coi như 0 lượt, vẫn trả kết quả", async () => {
    stubFetch();
    const kv = fakeKV({ failGet: () => true });
    const response = await worker.fetch(analyzeRequest(), env(kv));
    await expectJson(response, 200);
  });

  it("lỗi bất ngờ khi gọi model -> JSON 500 có CORS, không lộ chi tiết", async () => {
    stubFetch({ model: () => { throw new Error("socket hang up at 10.0.0.1"); } });
    const response = await worker.fetch(analyzeRequest(), env(fakeKV()));
    expect(await expectJson(response, 500)).toEqual({ error: "Lỗi xử lý, thử lại sau" });
  });
});

describe("POST /analyze kiểm Content-Length trước khi đọc body", () => {
  it("Content-Length vượt ngưỡng -> 413 có CORS, không ghi KV, không gọi siteverify", async () => {
    const calls = stubFetch();
    const kv = fakeKV();
    const limit = Math.ceil((1_500_000 * 4) / 3) + 4096;
    const response = await worker.fetch(analyzeRequest(undefined, { "Content-Length": String(limit + 1) }), env(kv));
    expect(await expectJson(response, 413)).toEqual({ error: "Ảnh quá lớn" });
    expect(kv.puts).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("Content-Length đúng ngưỡng vẫn xử lý bình thường", async () => {
    stubFetch();
    const limit = Math.ceil((1_500_000 * 4) / 3) + 4096;
    const response = await worker.fetch(analyzeRequest(undefined, { "Content-Length": String(limit) }), env(fakeKV()));
    await expectJson(response, 200);
  });
});

describe("POST /analyze khi model upstream lỗi", () => {
  for (const [upstream, status, message] of [
    [401, 502, "Dịch vụ AI tạm lỗi, thử lại sau"],
    [403, 502, "Dịch vụ AI tạm lỗi, thử lại sau"],
    [500, 502, "Dịch vụ AI tạm lỗi, thử lại sau"],
    [429, 503, "Dịch vụ AI đang quá tải, thử lại sau"],
  ] as const) {
    it(`upstream ${upstream} -> ${status} với thông điệp cố định`, async () => {
      stubFetch({ model: () => new Response("quota exceeded for key qwen-key", { status: upstream }) });
      const response = await worker.fetch(analyzeRequest(), env(fakeKV()));
      const text = await response.clone().text();
      expect(await expectJson(response, status)).toEqual({ error: message });
      expect(text).not.toMatch(/upstream|\d/iu);
    });
  }
});

describe("POST /analyze khi thiếu IP_HASH_SECRET", () => {
  for (const secret of [undefined, ""]) {
    it(`IP_HASH_SECRET=${JSON.stringify(secret)} -> 503 có CORS, không đụng KV, siteverify hay model`, async () => {
      const calls = stubFetch();
      const kv = fakeKV();
      const response = await worker.fetch(analyzeRequest(), env(kv, { IP_HASH_SECRET: secret }));
      expect(await expectJson(response, 503)).toEqual({ error: "Dịch vụ soi ảnh chưa được cấu hình" });
      expect(kv.gets).toEqual([]);
      expect(kv.puts).toEqual([]);
      expect(calls).toEqual([]);
    });
  }

  it("có secret: bộ đếm per-IP không chứa IP thô", async () => {
    stubFetch();
    const kv = fakeKV();
    await expectJson(await worker.fetch(analyzeRequest(), env(kv)), 200);
    const perIp = kv.puts.filter((key) => key.startsWith("h:"));
    expect(perIp).toHaveLength(1);
    expect(perIp[0]).not.toContain("203.0.113.7");
  });

  it("một lượt thành công chỉ đọc/ghi bộ đếm, không có khoá replay Turnstile", async () => {
    stubFetch();
    const kv = fakeKV();
    await expectJson(await worker.fetch(analyzeRequest(), env(kv)), 200);
    expect([...kv.gets, ...kv.puts].map((key) => key.slice(0, 2)).sort()).toEqual(
      ["d:", "d:", "d:", "h:", "h:", "h:", "m:", "m:", "m:"],
    );
  });
});

describe("POST /analyze xác thực Turnstile", () => {
  it("siteverify trả hostname lạ -> 403", async () => {
    stubFetch({ siteverify: () => Response.json({ success: true, hostname: "evil.example" }) });
    const response = await worker.fetch(analyzeRequest(), env(fakeKV()));
    expect(await expectJson(response, 403)).toEqual({ error: "Xác thực chống bot thất bại" });
  });
});

describe("POST /analyze với nhiều origin (ALLOWED_ORIGINS)", () => {
  for (const origin of ORIGINS) {
    it(`${origin}: preflight và POST đều nhận, CORS trả đúng origin gửi lên`, async () => {
      const hostname = new URL(origin).hostname;
      stubFetch({ siteverify: () => Response.json({ success: true, hostname }) });
      const preflight = await worker.fetch(
        new Request("https://worker.test/analyze", { method: "OPTIONS", headers: { Origin: origin } }),
        env(fakeKV()),
      );
      expect(preflight.status).toBe(204);
      expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe(origin);
      expect(preflight.headers.get("Vary")).toBe("Origin");
      const response = await worker.fetch(analyzeRequest(undefined, { Origin: origin }), env(fakeKV()));
      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
      expect(response.headers.get("Vary")).toBe("Origin");
    });
  }

  it("origin lạ -> 403, không cấp CORS cho origin đó, không gọi siteverify", async () => {
    const calls = stubFetch();
    const kv = fakeKV();
    const response = await worker.fetch(analyzeRequest(undefined, { Origin: "https://evil.example" }), env(kv));
    expect(response.status).toBe(403);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(response.headers.get("Vary")).toBe("Origin");
    expect(calls).toEqual([]);
    expect(kv.puts).toEqual([]);
  });

  it("preflight từ origin lạ không nhận Access-Control-Allow-Origin", async () => {
    const response = await worker.fetch(
      new Request("https://worker.test/analyze", { method: "OPTIONS", headers: { Origin: "https://tqccl.com.evil.example" } }),
      env(fakeKV()),
    );
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(response.headers.get("Vary")).toBe("Origin");
  });

  it("token cấp cho host khác trong danh sách vẫn qua (đang chuyển domain)", async () => {
    stubFetch({ siteverify: () => Response.json({ success: true, hostname: "tqccl.pages.dev" }) });
    const response = await worker.fetch(analyzeRequest(), env(fakeKV()));
    expect(await expectJson(response, 200)).toEqual({ heroes: [expect.objectContaining({ nameCn: "关羽" })] });
  });

  it("token cấp cho host ngoài danh sách -> 403", async () => {
    stubFetch({ siteverify: () => Response.json({ success: true, hostname: "preview.tqccl.pages.dev" }) });
    const response = await worker.fetch(analyzeRequest(), env(fakeKV()));
    expect(await expectJson(response, 403)).toEqual({ error: "Xác thực chống bot thất bại" });
  });

  for (const value of [undefined, "", " , "]) {
    it(`ALLOWED_ORIGINS=${JSON.stringify(value)} -> 503, không đụng KV, siteverify hay model`, async () => {
      const calls = stubFetch();
      const kv = fakeKV();
      const response = await worker.fetch(analyzeRequest(), env(kv, { ALLOWED_ORIGINS: value }));
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: "Dịch vụ soi ảnh chưa được cấu hình" });
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
      expect(kv.gets).toEqual([]);
      expect(kv.puts).toEqual([]);
      expect(calls).toEqual([]);
    });
  }
});
