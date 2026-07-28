import { describe, expect, it } from "vitest";

import {
  CANONICAL_PROJECTION_VERSION,
  canonicalizeCanonicalState,
  createNormalizationDigest,
  createWorkflowVersion,
  projectCanonicalState,
  verifyConfirmationBinding,
} from "../../src/domain/canonical-state.js";

const state = {
  heroes: [
    {
      canonicalId: "hero:sp-ma-sieu",
      familyId: "hero-family:ma-sieu",
      displayName: "SP Mã Siêu",
      redStars: 4,
      level: 50,
      evidence: [{ sourceScope: "currentTurnImage", imageOrdinal: 2 }],
    },
  ],
  tactics: [
    {
      canonicalId: "tactic:thuyen-co-muon-ten",
      displayName: "Thuyền Cỏ Mượn Tên",
      evidence: [{ sourceScope: "priorConfirmedNote" }],
    },
  ],
  lockedTeams: [],
  unresolved: [],
  warnings: [],
};

describe("canonical state projection", () => {
  it("normalizes NFC and object key order deterministically", () => {
    const composed = canonicalizeCanonicalState({ z: "Mã", a: { y: 2, b: 1 } });
    const decomposed = canonicalizeCanonicalState({
      a: { b: 1, y: 2 },
      z: "Ma\u0303",
    });

    expect(decomposed).toBe(composed);
    expect(composed).toBe('{"a":{"b":1,"y":2},"z":"Mã"}');
  });

  it("rejects non-finite values", () => {
    expect(() => canonicalizeCanonicalState({ value: Number.NaN })).toThrow(
      "finite",
    );
  });

  it("rejects lone Unicode surrogates required by JCS", () => {
    expect(() => canonicalizeCanonicalState({ value: "\ud800" })).toThrow(
      "valid Unicode",
    );
  });

  it("excludes display and evidence but keeps semantic inventory", () => {
    expect(projectCanonicalState(state)).toEqual({
      canonicalProjectionVersion: CANONICAL_PROJECTION_VERSION,
      reviewRequired: false,
      heroes: [
        {
          canonicalId: "hero:sp-ma-sieu",
          familyId: "hero-family:ma-sieu",
          redStars: 4,
          level: 50,
        },
      ],
      tactics: ["tactic:thuyen-co-muon-ten"],
      lockedTeams: [],
    });
  });

  it("sorts set-like inventory before hashing", async () => {
    const reordered = {
      ...state,
      heroes: [
        {
          canonicalId: "hero:tuong-b",
          familyId: "hero-family:tuong-b",
          displayName: "Tướng B",
          evidence: [],
        },
        ...state.heroes,
      ],
    };
    const permuted = { ...reordered, heroes: [...reordered.heroes].reverse() };

    await expect(createNormalizationDigest(reordered)).resolves.toBe(
      await createNormalizationDigest(permuted),
    );
  });

  it("changes the digest when material ambiguity is resolved", async () => {
    const ambiguous = {
      ...state,
      unresolved: [{ observationId: "ambiguous", reason: "ambiguous" }],
    };

    await expect(createNormalizationDigest(ambiguous)).resolves.not.toBe(
      await createNormalizationDigest(state),
    );
  });

  it("binds tactic holder assignments inside locked teams", async () => {
    const locked = {
      ...state,
      lockedTeams: [
        {
          teamId: "team:locked",
          heroIds: ["hero:a", "hero:b"],
          tacticIds: ["tactic:x"],
          tacticAssignments: [
            { holderId: "hero:a", tacticId: "tactic:x", slotIndex: 0 },
          ],
        },
      ],
    };
    const swapped = {
      ...locked,
      lockedTeams: [
        {
          ...locked.lockedTeams[0]!,
          tacticAssignments: [
            { holderId: "hero:b", tacticId: "tactic:x", slotIndex: 0 },
          ],
        },
      ],
    };

    await expect(createNormalizationDigest(locked)).resolves.not.toBe(
      await createNormalizationDigest(swapped),
    );
  });
});

describe("confirmation binding", () => {
  it("binds exact workflow, digest, and projection", async () => {
    const workflowVersion = createWorkflowVersion(
      "sha256:release-full",
      "build:workflow-full",
    );
    const normalizationDigest = await createNormalizationDigest(state);
    const binding = {
      workflowVersion,
      normalizationDigest,
      canonicalProjectionVersion: CANONICAL_PROJECTION_VERSION,
    };

    await expect(
      verifyConfirmationBinding(binding, state, workflowVersion),
    ).resolves.toBe(true);
  });

  it("rejects replay after nested state or workflow changes", async () => {
    const workflowVersion = createWorkflowVersion(
      "sha256:release-full",
      "build:workflow-full",
    );
    const binding = {
      workflowVersion,
      normalizationDigest: await createNormalizationDigest(state),
      canonicalProjectionVersion: CANONICAL_PROJECTION_VERSION,
    };
    const changed = {
      ...state,
      heroes: [{ ...state.heroes[0]!, redStars: 5 }],
    };

    await expect(
      verifyConfirmationBinding(binding, changed, workflowVersion),
    ).resolves.toBe(false);
    await expect(
      verifyConfirmationBinding(binding, state, "workflow:different"),
    ).resolves.toBe(false);
  });
});
