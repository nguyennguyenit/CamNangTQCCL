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

const HOSTS = ["tqccl.com", "www.tqccl.com", "tqccl.pages.dev"];

describe("verifyTurnstile", () => {
  it("từ chối token hợp lệ nhưng cấp cho hostname khác", async () => {
    const { fetchImpl } = siteverify({ success: true, hostname: "evil.example" });
    expect(await verifyTurnstile("token", "secret", "203.0.113.7", HOSTS, fetchImpl)).toEqual({
      ok: false,
      message: "Xác thực chống bot thất bại",
    });
  });

  for (const hostname of HOSTS) {
    it(`nhận token cấp cho hostname được phép ${hostname}`, async () => {
      const { calls, fetchImpl } = siteverify({ success: true, hostname });
      expect(await verifyTurnstile("token", "secret", "203.0.113.7", HOSTS, fetchImpl)).toEqual({ ok: true });
      expect(calls).toHaveLength(1);
      expect(calls[0].get("response")).toBe("token");
      expect(calls[0].get("remoteip")).toBe("203.0.113.7");
    });
  }

  it("không có hostname kỳ vọng (ALLOWED_ORIGINS='*') thì chỉ dựa vào success", async () => {
    const { fetchImpl } = siteverify({ success: true, hostname: "localhost" });
    expect(await verifyTurnstile("token", "secret", "", null, fetchImpl)).toEqual({ ok: true });
  });

  it("danh sách hostname rỗng -> luôn từ chối", async () => {
    const { fetchImpl } = siteverify({ success: true, hostname: "tqccl.com" });
    expect(await verifyTurnstile("token", "secret", "", [], fetchImpl)).toEqual({
      ok: false,
      message: "Xác thực chống bot thất bại",
    });
  });

  it("token đã dùng (siteverify timeout-or-duplicate) -> thất bại", async () => {
    const { fetchImpl } = siteverify({ success: false, "error-codes": ["timeout-or-duplicate"] });
    expect(await verifyTurnstile("token", "secret", "", HOSTS, fetchImpl)).toEqual({
      ok: false,
      message: "Xác thực chống bot thất bại",
    });
  });
});
