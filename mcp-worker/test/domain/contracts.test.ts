import { describe, expect, it } from "vitest";

import { ContractValidationError, stableStringify } from "../../src/domain/contracts.js";

describe("stableStringify", () => {
  it("serializes objects deterministically", () => {
    expect(stableStringify({ z: 1, a: { y: 2, b: 3 } })).toBe(
      '{"a":{"b":3,"y":2},"z":1}',
    );
  });

  it("rejects values that are not finite JSON", () => {
    expect(() => stableStringify({ score: Number.NaN })).toThrow(ContractValidationError);
    expect(() => stableStringify({ read: () => 1 })).toThrow(ContractValidationError);
  });
});
