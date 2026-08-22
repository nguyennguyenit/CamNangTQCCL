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

const RELEASE_ID =
  "sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";
const BUILD_ID = "build:sha256b64:n4bQgYhMfWWaL-qgxVrQFaO_TxsrC4Is0V1sFbDwCgg";

describe("client-echoed tokens carry no long hex run", () => {
  it("emits the normalization digest as a base64url token", async () => {
    const digest = await createNormalizationDigest(state);

    expect(digest.startsWith("sha256b64:")).toBe(true);
    expect(digest).not.toMatch(/[a-fA-F0-9]{64,}/u);
  });

  it("encodes the release digest inside the workflow version", () => {
    const workflowVersion = createWorkflowVersion(RELEASE_ID, BUILD_ID);

    expect(workflowVersion).not.toMatch(/[a-fA-F0-9]{64,}/u);
    expect(workflowVersion).toBe(
      "workflow:sha256b64:n4bQgYhMfWWaL-qgxVrQFaO_TxsrC4Is0V1sFbDwCgg:" + BUILD_ID,
    );
  });

  it("rejects a release id that is not a full sha256 hex digest", () => {
    expect(() => createWorkflowVersion("sha256:release-full", BUILD_ID)).toThrow(
      TypeError,
    );
  });

  it("still rejects empty inputs", () => {
    expect(() => createWorkflowVersion("", BUILD_ID)).toThrow(TypeError);
    expect(() => createWorkflowVersion(RELEASE_ID, "")).toThrow(TypeError);
  });
});

describe("confirmation binding", () => {
  it("binds exact workflow, digest, and projection", async () => {
    const workflowVersion = createWorkflowVersion(RELEASE_ID, BUILD_ID);
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
    const workflowVersion = createWorkflowVersion(RELEASE_ID, BUILD_ID);
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
