import { describe, expect, it } from "vitest";

import {
  RequestGuardError,
  readBoundedJson,
  validateMcpRequestHead,
} from "../../src/security/request-guards.js";

const OPTIONS = {
  allowedOrigins: ["https://agent.example"],
  maxBodyBytes: 64,
};

function request(
  method: string,
  headers: Record<string, string> = {},
  body?: string,
): Request {
  return new Request("https://mcp.example/mcp", {
    method,
    headers,
    ...(body === undefined ? {} : { body }),
  });
}

describe("guard request MCP", () => {
  it("cho phép Origin vắng mặt hoặc khớp chính xác", () => {
    expect(() =>
      validateMcpRequestHead(request("GET"), OPTIONS),
    ).not.toThrow();
    expect(() =>
      validateMcpRequestHead(
        request("GET", { Origin: "https://agent.example" }),
        OPTIONS,
      ),
    ).not.toThrow();

    let rejected: unknown;
    try {
      validateMcpRequestHead(
        request("GET", { Origin: "https://agent.example.evil" }),
        OPTIONS,
      );
    } catch (error) {
      rejected = error;
    }
    expect(rejected).toBeInstanceOf(RequestGuardError);
    expect(rejected).toMatchObject({ status: 403, code: "ORIGIN_NOT_ALLOWED" });
  });

  it("từ chối method, media, encoding và declared length sai trước khi đọc body", () => {
    const invalidRequests = [
      request("PUT"),
      request("POST", { "Content-Type": "text/plain" }, "{}"),
      request(
        "POST",
        {
          "Content-Type": "application/json",
          Accept: "text/html",
        },
        "{}",
      ),
      request(
        "POST",
        {
          "Content-Type": "application/json",
          "Content-Encoding": "gzip",
        },
        "{}",
      ),
      request(
        "POST",
        {
          "Content-Type": "application/json",
          "Content-Length": "65",
        },
        "{}",
      ),
    ];

    for (const invalidRequest of invalidRequests) {
      expect(() =>
        validateMcpRequestHead(invalidRequest, OPTIONS),
      ).toThrowError(RequestGuardError);
      expect(invalidRequest.bodyUsed).toBe(false);
    }
  });

  it("đọc JSON theo byte thực tế và chặn body chunked quá giới hạn", async () => {
    const valid = request(
      "POST",
      { "Content-Type": "application/json" },
      JSON.stringify({ ok: true }),
    );
    expect(await readBoundedJson(valid, 64)).toEqual({ ok: true });

    const oversized = request(
      "POST",
      { "Content-Type": "application/json" },
      JSON.stringify({ payload: "x".repeat(100) }),
    );
    await expect(readBoundedJson(oversized, 64)).rejects.toMatchObject({
      status: 413,
      code: "BODY_TOO_LARGE",
    });

    const malformed = request(
      "POST",
      { "Content-Type": "application/json" },
      "{",
    );
    await expect(readBoundedJson(malformed, 64)).rejects.toMatchObject({
      status: 400,
      code: "INVALID_JSON",
    });
  });
});
