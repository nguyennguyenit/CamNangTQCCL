import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "../src/http";
import { requestOrigin, trustedOrigins, type Env } from "../src/env";
import { parseHeroes, parseLang, parsePageKey, sniffImageType } from "../src/validate";
import { createHarness, type ApiJson } from "./fakes";

describe("pageKey", () => {
  for (const ok of ["/doi-chuan/s18-abc/", "/doi-khac/x/", "/khai-hoang/0-team-9/"]) {
    it(`nhận ${ok}`, () => expect(parsePageKey(ok)).toBe(ok));
  }
  for (const bad of [
    "/zh/doi-chuan/s18-abc/", // có tiền tố locale
    "/doi-chuan/s18-abc", // thiếu gạch cuối
    "/doi-chuan/-abc/", // bắt đầu bằng gạch
    "/doi-chuan/ABC/", // chữ hoa
    "/bai-viet/abc/", // section không cho phép
    "/doi-chuan/a/b/",
    `/doi-chuan/a${"b".repeat(121)}/`, // quá dài
    42,
    undefined,
  ]) {
    it(`từ chối ${String(bad)}`, () => expect(() => parsePageKey(bad)).toThrow(expect.objectContaining({ code: "invalid_page", status: 400 })));
  }
});

describe("lang + tướng", () => {
  it("chỉ vi|zh", () => {
    expect(parseLang("zh")).toBe("zh");
    expect(() => parseLang("en")).toThrow(expect.objectContaining({ code: "invalid_lang" }));
    expect(() => parseLang("zh-Hans")).toThrow();
  });

  it("mảng tướng tối đa 5, mỗi tên ≤ 20 ký tự, không trùng", () => {
    expect(parseHeroes([" 曹操 ", "郭嘉"], "allyHeroes", 1)).toEqual(["曹操", "郭嘉"]);
    expect(() => parseHeroes([], "allyHeroes", 1)).toThrow();
    expect(parseHeroes([], "enemyHeroes", 0)).toEqual([]);
    expect(() => parseHeroes(["a", "b", "c", "d", "e", "f"], "allyHeroes", 1)).toThrow();
    expect(parseHeroes(["名".repeat(20)], "allyHeroes", 1)).toHaveLength(1);
    expect(() => parseHeroes(["名".repeat(21)], "allyHeroes", 1)).toThrow();
    expect(() => parseHeroes(["曹操", "曹操"], "allyHeroes", 1)).toThrow();
    expect(() => parseHeroes("曹操", "allyHeroes", 1)).toThrow();
  });
});

describe("ảnh + con trỏ", () => {
  it("nhận diện JPEG/PNG/WebP theo magic bytes", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffImageType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(sniffImageType(new TextEncoder().encode("GIF89a......"))).toBeNull();
  });

  it("con trỏ khứ hồi và từ chối chuỗi rác", () => {
    const c = { t: 1_790_000_000_000, id: "abc" };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
    expect(decodeCursor(undefined)).toBeNull();
    expect(() => decodeCursor("not-a-cursor")).toThrow(expect.objectContaining({ code: "invalid_cursor" }));
  });
});

describe("validate qua API", () => {
  it("GET /api/comments sai page/lang -> 400 với mã lỗi", async () => {
    const h = createHarness();
    const r1 = await h.request("/api/comments?page=/zh/doi-chuan/a/&lang=vi");
    expect(r1.status).toBe(400);
    expect(await r1.json<ApiJson>()).toEqual({ error: { code: "invalid_page", message: expect.any(String) } });
    const r2 = await h.request("/api/comments?page=/doi-chuan/a/&lang=en");
    expect((await r2.json<ApiJson>()).error.code).toBe("invalid_lang");
  });

  it("POST thiếu JSON content-type -> 415; body quá 2000 ký tự -> 400", async () => {
    const h = createHarness();
    const r1 = await h.request("/api/comments", { as: "alice", method: "POST", body: "{}" });
    expect(r1.status).toBe(415);
    const r2 = await h.request("/api/comments", { as: "alice", json: { page: "/doi-chuan/a/", lang: "vi", body: "x".repeat(2001) } });
    expect((await r2.json<ApiJson>()).error.code).toBe("invalid_body");
  });

  it("POST từ origin lạ bị chặn CSRF", async () => {
    const h = createHarness();
    const res = await h.request("/api/comments", {
      as: "alice",
      json: { page: "/doi-chuan/a/", lang: "vi", body: "hi" },
      headers: { origin: "https://evil.test" },
    });
    expect(res.status).toBe(403);
    expect((await res.json<ApiJson>()).error.code).toBe("forbidden_origin");
  });
});

describe("origin site theo request (nhiều domain)", () => {
  const env = { SITE_ORIGIN: "https://tqccl.com, https://www.tqccl.com, https://tqccl.pages.dev" } as Env;
  const req = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers });

  it("giữ đúng domain trình duyệt đang dùng khi nằm trong allowlist", () => {
    expect(requestOrigin(env, req("https://www.tqccl.com/api/auth/sign-in/social"))).toBe("https://www.tqccl.com");
    expect(requestOrigin(env, req("https://tqccl-community.x.workers.dev/api/auth/x", { "x-forwarded-host": "tqccl.pages.dev", "x-forwarded-proto": "https" }))).toBe("https://tqccl.pages.dev");
  });

  it("host lạ hoặc giả mạo rơi về origin mặc định", () => {
    expect(requestOrigin(env, req("https://evil.example/api/auth/x"))).toBe("https://tqccl.com");
    expect(requestOrigin(env, req("https://tqccl.com/api/auth/x", { "x-forwarded-host": "evil.example" }))).toBe("https://tqccl.com");
    expect(requestOrigin(env, req("https://tqccl.com/api/auth/x", { "x-forwarded-host": "tqccl.com", "x-forwarded-proto": "http" }))).toBe("https://tqccl.com");
  });

  it("mọi domain khai báo đều là origin tin cậy cho POST", () => {
    expect(trustedOrigins(env)).toEqual(expect.arrayContaining(["https://tqccl.com", "https://www.tqccl.com", "https://tqccl.pages.dev"]));
  });
});
