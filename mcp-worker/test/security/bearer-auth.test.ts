import { describe, expect, it } from "vitest";

import {
  BearerAuthError,
  authenticateBearer,
  parseBearer,
  validateBearerConfiguration,
} from "../../src/security/bearer-auth.js";

const CURRENT_TOKEN = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const NEXT_TOKEN = "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const NOW = Date.parse("2026-07-28T12:00:00.000Z");

describe("xác thực managed-client bearer", () => {
  it("chỉ chấp nhận cú pháp Authorization Bearer nghiêm ngặt", () => {
    expect(parseBearer(`Bearer ${CURRENT_TOKEN}`)).toBe(CURRENT_TOKEN);
    for (const value of [
      undefined,
      "",
      CURRENT_TOKEN,
      `bearer ${CURRENT_TOKEN}`,
      `Bearer  ${CURRENT_TOKEN}`,
      `Bearer ${CURRENT_TOKEN} extra`,
      "Bearer abc+=",
    ]) {
      expect(parseBearer(value)).toBeNull();
    }
  });

  it("từ chối cấu hình yếu, thiếu hoặc chồng lấn quá 15 phút", () => {
    const invalid = [
      {},
      { currentToken: "short" },
      { currentToken: CURRENT_TOKEN, nextToken: NEXT_TOKEN },
      {
        currentToken: CURRENT_TOKEN,
        nextToken: NEXT_TOKEN,
        nextTokenNotAfter: new Date(NOW - 1).toISOString(),
      },
      {
        currentToken: CURRENT_TOKEN,
        nextToken: NEXT_TOKEN,
        nextTokenNotAfter: new Date(NOW + 15 * 60_000 + 1).toISOString(),
      },
      {
        currentToken: CURRENT_TOKEN,
        nextToken: CURRENT_TOKEN,
        nextTokenNotAfter: new Date(NOW + 60_000).toISOString(),
      },
    ];

    for (const configuration of invalid) {
      expect(() =>
        validateBearerConfiguration(configuration, NOW),
      ).toThrowError(BearerAuthError);
    }
  });

  it("xác thực current và next chỉ trong cửa sổ quay vòng hợp lệ", async () => {
    const configuration = validateBearerConfiguration(
      {
        currentToken: CURRENT_TOKEN,
        nextToken: NEXT_TOKEN,
        nextTokenNotAfter: new Date(NOW + 10 * 60_000).toISOString(),
      },
      NOW,
    );

    await expect(
      authenticateBearer(`Bearer ${CURRENT_TOKEN}`, configuration),
    ).resolves.toMatchObject({ slot: "current" });
    await expect(
      authenticateBearer(`Bearer ${NEXT_TOKEN}`, configuration),
    ).resolves.toMatchObject({ slot: "next" });
  });

  it("không đưa token vào fingerprint hoặc lỗi xác thực", async () => {
    const configuration = validateBearerConfiguration(
      { currentToken: CURRENT_TOKEN },
      NOW,
    );
    const authenticated = await authenticateBearer(
      `Bearer ${CURRENT_TOKEN}`,
      configuration,
    );

    expect(authenticated.fingerprint).toMatch(/^[a-f0-9]{16}$/);
    expect(authenticated.fingerprint).not.toContain(CURRENT_TOKEN);

    let failure: unknown;
    try {
      await authenticateBearer(`Bearer ${NEXT_TOKEN}`, configuration);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(BearerAuthError);
    expect(JSON.stringify(failure)).not.toContain(NEXT_TOKEN);
    expect((failure as BearerAuthError).code).toBe("UNAUTHORIZED");
  });

  it("không phục hồi token đã retire sau promote", async () => {
    const overlap = validateBearerConfiguration(
      {
        currentToken: CURRENT_TOKEN,
        nextToken: NEXT_TOKEN,
        nextTokenNotAfter: new Date(NOW + 10 * 60_000).toISOString(),
      },
      NOW,
    );
    await expect(
      authenticateBearer(`Bearer ${CURRENT_TOKEN}`, overlap),
    ).resolves.toMatchObject({ slot: "current" });
    await expect(
      authenticateBearer(`Bearer ${NEXT_TOKEN}`, overlap),
    ).resolves.toMatchObject({ slot: "next" });

    const promoted = validateBearerConfiguration(
      { currentToken: NEXT_TOKEN },
      NOW,
    );
    await expect(
      authenticateBearer(`Bearer ${NEXT_TOKEN}`, promoted),
    ).resolves.toMatchObject({ slot: "current" });
    await expect(
      authenticateBearer(`Bearer ${CURRENT_TOKEN}`, promoted),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
