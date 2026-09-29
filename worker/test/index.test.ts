import { afterEach, describe, expect, it, vi } from "vitest";
import { AI_PROVIDERS_KEY, encryptProviders, type AiProvider } from "../../shared/ai-config";
import worker from "../src/index";
import type { Env } from "../src/config";

const ORIGIN = "https://tqccl.com";
const ORIGINS = ["https://tqccl.com", "https://www.tqccl.com", "https://tqccl.pages.dev"];
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MODEL = "https://model.test/v1/chat/completions";
const MODEL_BACKUP = "https://backup.test/v1/chat/completions";
const AI_SECRET = "ai-config-secret-for-tests";
const PROVIDER: AiProvider = { id: "main", label: "Main", endpoint: MODEL, modelId: "deepseek-flash", apiKey: "deepseek-key", enabled: true };
const PROVIDERS_BLOB = await encryptProviders([PROVIDER], AI_SECRET);
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

/**
 * KV trong bộ nhớ, ghi lại mọi get/put; `failPut`/`failGet` quyết định lần nào ném lỗi.
 * `seed` = sẵn bản ghi `ai:providers` (một provider trỏ về MODEL).
 */
function fakeKV(
  { failPut, failGet }: { failPut?: (key: string, count: number) => boolean; failGet?: (key: string) => boolean } = {},
  seed = true,
): FakeKV {
  const store = new Map<string, string>(seed ? [[AI_PROVIDERS_KEY, PROVIDERS_BLOB]] : []);
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
    TURNSTILE_SECRET: "turnstile-secret",
    IP_HASH_SECRET: "ip-hash-secret-for-tests",
    AI_CONFIG_SECRET: AI_SECRET,
    ALLOWED_ORIGINS: ORIGINS.join(","),
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
    const kv = fakeKV({ failGet: (key) => key !== AI_PROVIDERS_KEY });
    const response = await worker.fetch(analyzeRequest(), env(kv));
    await expectJson(response, 200);
  });

  it("lỗi mạng khi gọi model -> 502 thông điệp cố định, không lộ chi tiết", async () => {
    stubFetch({ model: () => { throw new Error("socket hang up at 10.0.0.1"); } });
    const response = await worker.fetch(analyzeRequest(), env(fakeKV()));
    expect(await expectJson(response, 502)).toEqual({ error: "Dịch vụ AI tạm lỗi, thử lại sau" });
  });
});

describe("POST /analyze với danh sách nhà cung cấp AI", () => {
  for (const [name, extra, seed] of [
    ["thiếu AI_CONFIG_SECRET", { AI_CONFIG_SECRET: undefined }, true],
    ["sai AI_CONFIG_SECRET", { AI_CONFIG_SECRET: "secret-khac" }, true],
    ["chưa có bản ghi ai:providers", {}, false],
  ] as const) {
    it(`${name} -> 503 chưa cấu hình, không ghi KV, không gọi siteverify/model`, async () => {
      const calls = stubFetch();
      const kv = fakeKV({}, seed);
      const response = await worker.fetch(analyzeRequest(), env(kv, extra));
      expect(await expectJson(response, 503)).toEqual({ error: "Dịch vụ soi ảnh chưa được cấu hình" });
      expect(kv.puts).toEqual([]);
      expect(calls).toEqual([]);
    });
  }

  it("mục đầu hết tiền (402) -> chuyển sang mục kế với model/key của mục đó", async () => {
    const kv = fakeKV({}, false);
    kv.store.set(
      AI_PROVIDERS_KEY,
      await encryptProviders([{ ...PROVIDER, id: "a", endpoint: MODEL_BACKUP, apiKey: "key-a", modelId: "m-a" }, PROVIDER], AI_SECRET),
    );
    const seen: { url: string; auth: string | null; model: string }[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === SITEVERIFY) return Response.json({ success: true, hostname: "tqccl.com" });
      seen.push({ url, auth: new Headers(init?.headers).get("Authorization"), model: JSON.parse(String(init?.body)).model });
      if (url === MODEL_BACKUP) return new Response("insufficient balance", { status: 402 });
      return Response.json({ choices: [{ message: { content: JSON.stringify({ heroes: [{ nameCn: "关羽", tacticsCn: [] }] }) } }] });
    });
    await expectJson(await worker.fetch(analyzeRequest(), env(kv)), 200);
    expect(seen).toEqual([
      { url: MODEL_BACKUP, auth: "Bearer key-a", model: "m-a" },
      { url: MODEL, auth: "Bearer deepseek-key", model: "deepseek-flash" },
    ]);
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
    // DeepSeek trả 402 khi hết số dư: coi như dịch vụ AI tạm lỗi, không lộ mã upstream.
    [402, 502, "Dịch vụ AI tạm lỗi, thử lại sau"],
    [401, 502, "Dịch vụ AI tạm lỗi, thử lại sau"],
    [403, 502, "Dịch vụ AI tạm lỗi, thử lại sau"],
    [500, 502, "Dịch vụ AI tạm lỗi, thử lại sau"],
    [429, 503, "Dịch vụ AI đang quá tải, thử lại sau"],
  ] as const) {
    it(`upstream ${upstream} -> ${status} với thông điệp cố định`, async () => {
      stubFetch({ model: () => new Response("quota exceeded for key deepseek-key", { status: upstream }) });
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

  it("một lượt thành công chỉ đọc danh sách AI + đọc/ghi bộ đếm, không có khoá replay Turnstile", async () => {
    stubFetch();
    const kv = fakeKV();
    await expectJson(await worker.fetch(analyzeRequest(), env(kv)), 200);
    expect([...kv.gets, ...kv.puts].map((key) => key.slice(0, 2)).sort()).toEqual(
      ["ai", "d:", "d:", "d:", "h:", "h:", "h:", "m:", "m:", "m:"],
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

describe("POST /analyze mode explainSubstitute (chỉ văn bản, không ảnh)", () => {
  const context = {
    locale: "vi",
    hero: "Quan Vũ",
    missing: { name: "Uy Chấn Hoa Hạ", effect: "Gây sát thương binh nhận và làm choáng." },
    substitute: { name: "Hoành Qua Dược Mã", effect: "Gây sát thương binh nhận lên toàn địch." },
    configCount: 2,
  };
  const explainBody = (ctx: unknown) => ({ mode: "explainSubstitute", turnstileToken: `token-${++issuedTokens}`, context: ctx });
  const explainModel = () => Response.json({ choices: [{ message: { content: '{"explanation":"Cả hai gây sát thương binh nhận."}' } }] });

  /** fetch giả ghi lại body gửi model. */
  function stubExplainFetch(siteverify?: () => Response) {
    const calls: string[] = [];
    const modelBodies: unknown[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(url);
      if (url === SITEVERIFY) return siteverify ? siteverify() : Response.json({ success: true, hostname: "tqccl.com" });
      if (url === MODEL) {
        modelBodies.push(JSON.parse(String(init?.body)));
        return explainModel();
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    return { calls, modelBodies };
  }

  it("không có ảnh vẫn qua: gọi model bằng văn bản, đếm quota global, trả { explanation }", async () => {
    const { calls, modelBodies } = stubExplainFetch();
    const kv = fakeKV();
    const response = await worker.fetch(analyzeRequest(explainBody(context)), env(kv));
    expect(await expectJson(response, 200)).toEqual({ explanation: "Cả hai gây sát thương binh nhận." });
    expect(calls).toEqual([SITEVERIFY, MODEL]);
    expect(JSON.stringify(modelBodies)).not.toContain("image_url");
    expect(JSON.stringify(modelBodies)).toContain("Hoành Qua Dược Mã");
    expect([...kv.gets, ...kv.puts].map((key) => key.slice(0, 2)).sort()).toEqual(
      ["ai", "d:", "d:", "d:", "h:", "h:", "h:", "m:", "m:", "m:"],
    );
  });

  for (const mode of ["analyzeTeamImage", "scanHeroes", "scanTactics", "scanBuiltTeams", undefined]) {
    it(`mode ảnh ${mode ?? "(mặc định)"} vẫn bắt buộc ảnh: thiếu ảnh -> 400, kể cả có context`, async () => {
      const calls = stubFetch();
      const response = await worker.fetch(
        analyzeRequest({ mode, turnstileToken: `token-${++issuedTokens}`, context }),
        env(fakeKV()),
      );
      expect(await expectJson(response, 400)).toEqual({ error: "Thiếu ảnh" });
      expect(calls).not.toContain(MODEL);
    });
  }

  for (const [name, ctx] of [
    ["thiếu context", undefined],
    ["context không phải object", "Quan Vũ"],
    ["khoá lạ", { ...context, extra: true }],
    ["khoá lạ lồng", { ...context, missing: { ...context.missing, note: "x" } }],
    ["tên quá dài", { ...context, hero: "x".repeat(41) }],
    ["hiệu ứng quá dài", { ...context, substitute: { ...context.substitute, effect: "x".repeat(1201) } }],
    ["locale lạ", { ...context, locale: "en" }],
    ["configCount sai", { ...context, configCount: 1000 }],
  ] as const) {
    it(`${name} -> 400, không gọi model, không đếm quota global`, async () => {
      const { calls } = stubExplainFetch();
      const kv = fakeKV();
      const response = await worker.fetch(analyzeRequest(explainBody(ctx)), env(kv));
      expect(await expectJson(response, 400)).toEqual({ error: "Ngữ cảnh không hợp lệ" });
      expect(calls).not.toContain(MODEL);
      expect(kv.puts.filter((key) => key.startsWith("d:") || key.startsWith("m:"))).toEqual([]);
    });
  }

  it("Turnstile thất bại -> 403, không gọi model", async () => {
    const { calls } = stubExplainFetch(() => Response.json({ success: false }));
    const response = await worker.fetch(analyzeRequest(explainBody(context)), env(fakeKV()));
    expect(await expectJson(response, 403)).toEqual({ error: "Xác thực chống bot thất bại" });
    expect(calls).not.toContain(MODEL);
  });

  it("thiếu token Turnstile -> 403, không gọi siteverify hay model", async () => {
    const { calls } = stubExplainFetch();
    const response = await worker.fetch(analyzeRequest({ mode: "explainSubstitute", context }), env(fakeKV()));
    expect(response.status).toBe(403);
    expect(calls).toEqual([]);
  });

  it("kill-switch -> 503 trước Turnstile", async () => {
    const { calls } = stubExplainFetch();
    const response = await worker.fetch(analyzeRequest(explainBody(context)), env(fakeKV(), { FEATURE_ENABLED: "false" }));
    expect(await expectJson(response, 503)).toEqual({ error: "Tính năng đang tắt" });
    expect(calls).toEqual([]);
  });

  it("vượt lượt/giờ theo IP -> 429 trước Turnstile", async () => {
    const { calls } = stubExplainFetch();
    const kv = fakeKV();
    const extra = { RL_PER_HOUR: "1" };
    await expectJson(await worker.fetch(analyzeRequest(explainBody(context)), env(kv, extra)), 200);
    calls.length = 0;
    const response = await worker.fetch(analyzeRequest(explainBody(context)), env(kv, extra));
    expect(await expectJson(response, 429)).toEqual({ error: "Bạn thử quá nhiều lần, đợi chút" });
    expect(calls).toEqual([]);
  });

  it("model trả explanation quá dài -> 422 thông điệp cố định", async () => {
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) =>
      String(input) === SITEVERIFY
        ? Response.json({ success: true, hostname: "tqccl.com" })
        : Response.json({ choices: [{ message: { content: JSON.stringify({ explanation: "x".repeat(601) }) } }] }),
    );
    const response = await worker.fetch(analyzeRequest(explainBody(context)), env(fakeKV()));
    expect(await expectJson(response, 422)).toEqual({ error: "Không giải thích được" });
  });
});
