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

async function fingerprintOf(token: string): Promise<string> {
  const single = validateBearerConfiguration({ currentToken: token }, NOW);
  return (await authenticateBearer(`Bearer ${token}`, single)).fingerprint;
}

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
      { currentToken: CURRENT_TOKEN, nextTokenNotAfter: new Date(NOW + 60_000).toISOString() },
      { nextToken: NEXT_TOKEN, nextTokenNotAfter: new Date(NOW + 60_000).toISOString() },
      {
        currentToken: CURRENT_TOKEN,
        nextToken: NEXT_TOKEN,
        nextTokenNotAfter: "không phải ngày",
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

  it("NEXT quá NOT_AFTER bị coi như không có: CURRENT vẫn xác thực, NEXT thành token lạ", async () => {
    for (const nextTokenNotAfter of [
      new Date(NOW).toISOString(),
      new Date(NOW - 11 * 60_000).toISOString(),
    ]) {
      const configuration = validateBearerConfiguration(
        { currentToken: CURRENT_TOKEN, nextToken: NEXT_TOKEN, nextTokenNotAfter },
        NOW,
      );
      expect(configuration).toEqual({ currentToken: CURRENT_TOKEN });
      await expect(
        authenticateBearer(`Bearer ${CURRENT_TOKEN}`, configuration),
      ).resolves.toMatchObject({ fingerprint: await fingerprintOf(CURRENT_TOKEN) });
      await expect(
        authenticateBearer(`Bearer ${NEXT_TOKEN}`, configuration),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
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
    ).resolves.toMatchObject({ fingerprint: await fingerprintOf(CURRENT_TOKEN) });
    await expect(
      authenticateBearer(`Bearer ${NEXT_TOKEN}`, configuration),
    ).resolves.toMatchObject({ fingerprint: await fingerprintOf(NEXT_TOKEN) });
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
    ).resolves.toMatchObject({ fingerprint: await fingerprintOf(CURRENT_TOKEN) });
    await expect(
      authenticateBearer(`Bearer ${NEXT_TOKEN}`, overlap),
    ).resolves.toMatchObject({ fingerprint: await fingerprintOf(NEXT_TOKEN) });

    const promoted = validateBearerConfiguration(
      { currentToken: NEXT_TOKEN },
      NOW,
    );
    await expect(
      authenticateBearer(`Bearer ${NEXT_TOKEN}`, promoted),
    ).resolves.toMatchObject({ fingerprint: await fingerprintOf(NEXT_TOKEN) });
    await expect(
      authenticateBearer(`Bearer ${CURRENT_TOKEN}`, promoted),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
