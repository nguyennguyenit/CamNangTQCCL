import { describe, expect, it } from "vitest";
import { verifyTurnstile } from "../src/turnstile";

function siteverify(body: unknown) {
  const calls: FormData[] = [];
  const fetchImpl = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    calls.push(init?.body as FormData);
    return Response.json(body);
  }) as typeof fetch;
  return { calls, fetchImpl };
}

describe("verifyTurnstile", () => {
  it("từ chối token hợp lệ nhưng cấp cho hostname khác", async () => {
    const { fetchImpl } = siteverify({ success: true, hostname: "evil.example" });
    expect(await verifyTurnstile("token", "secret", "203.0.113.7", "tqccl.pages.dev", fetchImpl)).toEqual({
      ok: false,
      message: "Xác thực chống bot thất bại",
    });
  });

  it("nhận token cấp cho đúng hostname của site", async () => {
    const { calls, fetchImpl } = siteverify({ success: true, hostname: "tqccl.pages.dev" });
    expect(await verifyTurnstile("token", "secret", "203.0.113.7", "tqccl.pages.dev", fetchImpl)).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].get("response")).toBe("token");
    expect(calls[0].get("remoteip")).toBe("203.0.113.7");
  });

  it("không có hostname kỳ vọng (ALLOWED_ORIGIN='*') thì chỉ dựa vào success", async () => {
    const { fetchImpl } = siteverify({ success: true, hostname: "localhost" });
    expect(await verifyTurnstile("token", "secret", "", null, fetchImpl)).toEqual({ ok: true });
  });

  it("token đã dùng (siteverify timeout-or-duplicate) -> thất bại", async () => {
    const { fetchImpl } = siteverify({ success: false, "error-codes": ["timeout-or-duplicate"] });
    expect(await verifyTurnstile("token", "secret", "", "tqccl.pages.dev", fetchImpl)).toEqual({
      ok: false,
      message: "Xác thực chống bot thất bại",
    });
  });
});
