import { describe, expect, it } from "vitest";

import {
  SCRUB_SAFE_DIGEST_PREFIX,
  fromScrubSafeDigest,
  toScrubSafeDigest,
} from "../../src/domain/digest-encoding.js";

const hex = (byte: number): string =>
  `sha256:${byte.toString(16).padStart(2, "0").repeat(32)}`;

const SAMPLE_HEX =
  "sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";

describe("scrub-safe digest encoding", () => {
  it("encodes a sha256 hex digest into a 43 character base64url body", () => {
    const token = toScrubSafeDigest(SAMPLE_HEX);

    expect(token.startsWith(SCRUB_SAFE_DIGEST_PREFIX)).toBe(true);
    const body = token.slice(SCRUB_SAFE_DIGEST_PREFIX.length);
    expect(body).toHaveLength(43);
    expect(body).toMatch(/^[A-Za-z0-9_-]{43}$/u);
  });

  it("never emits a run of 64 or more hex characters", () => {
    for (let byte = 0; byte < 256; byte += 1) {
      expect(toScrubSafeDigest(hex(byte))).not.toMatch(/[a-fA-F0-9]{64,}/u);
    }
  });

  it("round-trips every byte pattern back to the original digest", () => {
    for (let byte = 0; byte < 256; byte += 1) {
      const original = hex(byte);
      expect(fromScrubSafeDigest(toScrubSafeDigest(original))).toBe(original);
    }
    expect(fromScrubSafeDigest(toScrubSafeDigest(SAMPLE_HEX))).toBe(SAMPLE_HEX);
  });

  it("is injective: distinct digests encode to distinct tokens", () => {
    const tokens = new Set<string>();
    for (let byte = 0; byte < 256; byte += 1) tokens.add(toScrubSafeDigest(hex(byte)));
    expect(tokens.size).toBe(256);
  });

  it("accepts uppercase hex and normalizes the decoded digest to lowercase", () => {
    const upperBody = `sha256:${SAMPLE_HEX.slice("sha256:".length).toUpperCase()}`;
    expect(fromScrubSafeDigest(toScrubSafeDigest(upperBody))).toBe(SAMPLE_HEX);
  });

  describe("rejects malformed encode input", () => {
    const cases: Array<[string, string]> = [
      ["empty string", ""],
      ["missing prefix", SAMPLE_HEX.slice("sha256:".length)],
      ["wrong prefix", SAMPLE_HEX.replace("sha256:", "sha512:")],
      ["63 hex characters", `sha256:${"a".repeat(63)}`],
      ["65 hex characters", `sha256:${"a".repeat(65)}`],
      ["non-hex body", `sha256:${"z".repeat(64)}`],
      ["already encoded token", `${SCRUB_SAFE_DIGEST_PREFIX}${"A".repeat(43)}`],
    ];

    for (const [label, value] of cases) {
      it(label, () => {
        expect(() => toScrubSafeDigest(value)).toThrow(TypeError);
      });
    }
  });

  describe("rejects malformed decode input", () => {
    const cases: Array<[string, string]> = [
      ["empty string", ""],
      ["missing prefix", "A".repeat(43)],
      ["hex prefix instead of base64 prefix", SAMPLE_HEX],
      ["42 character body", `${SCRUB_SAFE_DIGEST_PREFIX}${"A".repeat(42)}`],
      ["44 character body", `${SCRUB_SAFE_DIGEST_PREFIX}${"A".repeat(44)}`],
      [
        "standard base64 alphabet",
        `${SCRUB_SAFE_DIGEST_PREFIX}${"A".repeat(41)}+/`,
      ],
      ["padded body", `${SCRUB_SAFE_DIGEST_PREFIX}${"A".repeat(42)}=`],
    ];

    for (const [label, value] of cases) {
      it(label, () => {
        expect(() => fromScrubSafeDigest(value)).toThrow(TypeError);
      });
    }
  });

  it("is a pure function: repeated calls give identical output", () => {
    expect(toScrubSafeDigest(SAMPLE_HEX)).toBe(toScrubSafeDigest(SAMPLE_HEX));
  });
});
