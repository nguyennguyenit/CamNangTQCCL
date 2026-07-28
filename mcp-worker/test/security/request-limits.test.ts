import { describe, expect, it } from "vitest";

import {
  InFlightLimiter,
  TokenRateLimiter,
} from "../../src/security/request-limits.js";

describe("giới hạn request sau xác thực", () => {
  it("giới hạn theo fingerprint và phục hồi ở cửa sổ kế tiếp", () => {
    const limiter = new TokenRateLimiter({
      maxRequests: 2,
      windowMs: 1_000,
    });

    expect(limiter.consume("token-a", 10_000)).toEqual({ allowed: true });
    expect(limiter.consume("token-a", 10_100)).toEqual({ allowed: true });
    expect(limiter.consume("token-a", 10_200)).toEqual({
      allowed: false,
      retryAfterSeconds: 1,
    });
    expect(limiter.consume("token-b", 10_200)).toEqual({ allowed: true });
    expect(limiter.consume("token-a", 11_001)).toEqual({ allowed: true });
  });

  it("giới hạn in-flight và trả slot đúng một lần", () => {
    const limiter = new InFlightLimiter(2);
    const releaseFirst = limiter.acquire();
    const releaseSecond = limiter.acquire();

    expect(releaseFirst).toBeTypeOf("function");
    expect(releaseSecond).toBeTypeOf("function");
    expect(limiter.acquire()).toBeNull();
    expect(limiter.active).toBe(2);

    releaseFirst!();
    releaseFirst!();
    expect(limiter.active).toBe(1);
    const releaseThird = limiter.acquire();
    expect(releaseThird).toBeTypeOf("function");
    expect(limiter.active).toBe(2);

    releaseSecond!();
    releaseThird!();
    expect(limiter.active).toBe(0);
  });

  it("từ chối cấu hình giới hạn không hữu hạn hoặc không dương", () => {
    expect(
      () => new TokenRateLimiter({ maxRequests: 0, windowMs: 1_000 }),
    ).toThrow();
    expect(
      () => new TokenRateLimiter({ maxRequests: 1, windowMs: Number.NaN }),
    ).toThrow();
    expect(() => new InFlightLimiter(-1)).toThrow();
  });
});
