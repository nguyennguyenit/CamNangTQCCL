import { describe, expect, expectTypeOf, it } from "vitest";

import {
  ContractValidationError,
  createHeroSlot,
  parseBrowserScanConfirmation,
  parseConfirmationBinding,
  parseRosterSnapshot,
  stableStringify,
  type CanonicalEntity,
  type ConfirmationBinding,
  type HeroCanonicalId,
  type HeroIdentity,
  type RecommendationRequest,
} from "../../src/domain/contracts.js";

describe("canonical identity contracts", () => {
  it("keeps SP, CO, and base identities distinct from their family", () => {
    const identities = [
      {
        canonicalId: "hero:sp-tuan-uc",
        familyId: "hero-family:tuan-uc",
        displayName: "SP Tuân Úc",
        variant: "sp",
      },
      {
        canonicalId: "hero:tuan-uc",
        familyId: "hero-family:tuan-uc",
        displayName: "Tuân Úc",
        variant: "base",
      },
      {
        canonicalId: "hero:co-chan-co",
        familyId: "hero-family:chan-co",
        displayName: "CO Chân Cơ",
        variant: "co",
      },
      {
        canonicalId: "hero:chan-co",
        familyId: "hero-family:chan-co",
        displayName: "Chân Cơ",
        variant: "base",
      },
    ] as const satisfies readonly HeroIdentity[];

    expect(new Set(identities.map(({ canonicalId }) => canonicalId))).toHaveLength(4);
    expect(identities[0].familyId).toBe(identities[1].familyId);
    expect(identities[2].familyId).toBe(identities[3].familyId);
  });

  it("represents a combined hero slot as alternatives, not required heroes", () => {
    const slot = createHeroSlot({
      slotId: "slot:support",
      alternatives: ["hero:sp-lu-mong", "hero:trinh-pho"],
    });

    expect(slot.alternatives).toEqual(["hero:sp-lu-mong", "hero:trinh-pho"]);
    expect(slot.alternatives).toHaveLength(2);
  });

  it("rejects non-hero IDs in a hero slot at runtime", () => {
    expect(() =>
      createHeroSlot({
        slotId: "slot:support",
        alternatives: ["tactic:not-a-hero" as HeroCanonicalId],
      }),
    ).toThrow(ContractValidationError);
  });

  it("owns internal domain types without a public runtime schema dependency", () => {
    const entity: CanonicalEntity = {
      kind: "hero",
      canonicalId: "hero:sp-tuan-uc",
      familyId: "hero-family:tuan-uc",
      displayName: "SP Tuân Úc",
    };
    const request = {} as RecommendationRequest;

    expectTypeOf(entity).toMatchTypeOf<CanonicalEntity>();
    expectTypeOf(request.confirmationBinding).toMatchTypeOf<ConfirmationBinding>();
  });
});

describe("privacy-safe runtime boundaries", () => {
  const safeRoster = {
    heroes: [
      {
        identity: {
          canonicalId: "hero:sp-tuan-uc",
          familyId: "hero-family:tuan-uc",
          displayName: "SP Tuân Úc",
          variant: "sp",
        },
        redStars: 3,
      },
    ],
    tactics: [],
    lockedTeams: [],
  };

  it.each(["image", "base64", "path", "token", "turnstileToken", "providerSecret"])(
    "rejects nested forbidden field %s",
    (key) => {
      expect(() =>
        parseRosterSnapshot({
          ...safeRoster,
          heroes: [{ ...safeRoster.heroes[0], evidence: { [key]: "sensitive" } }],
        }),
      ).toThrow(ContractValidationError);
    },
  );

  it("strips unknown safe fields and produces a defensive JSON value", () => {
    const input = {
      ...safeRoster,
      ignoredFutureField: "allowed at boundary",
      heroes: [{ ...safeRoster.heroes[0], ignoredFutureField: 1 }],
    };
    const parsed = parseRosterSnapshot(input);

    expect(parsed).toEqual(safeRoster);
    expect(parsed).not.toBe(input);
    expect(JSON.parse(JSON.stringify(parsed))).toEqual(parsed);
  });

  it("preserves privacy-safe provenance while stripping unknown fields", () => {
    const provenance = {
      releaseId: "sha256:release",
      sourceId: "teams",
      recordId: "team-intro-0",
    };
    const parsed = parseRosterSnapshot({
      ...safeRoster,
      heroes: [{ ...safeRoster.heroes[0], provenance }],
      tactics: [
        {
          canonicalId: "tactic:thuyen-co-muon-ten",
          displayName: "Thuyền Cỏ Mượn Tên",
          provenance,
        },
      ],
    });

    expect(parsed.heroes[0]?.provenance).toEqual(provenance);
    expect(parsed.tactics[0]?.provenance).toEqual(provenance);
  });

  it.each([
    {
      ...safeRoster,
      heroes: [
        {
          ...safeRoster.heroes[0]!,
          identity: {
            ...safeRoster.heroes[0]!.identity,
            canonicalId: "tactic:not-a-hero",
          },
        },
      ],
    },
    {
      ...safeRoster,
      heroes: [
        {
          ...safeRoster.heroes[0]!,
          identity: {
            ...safeRoster.heroes[0]!.identity,
            familyId: "tactic-family:not-a-hero",
          },
        },
      ],
    },
    {
      ...safeRoster,
      tactics: [{ canonicalId: "hero:not-a-tactic", displayName: "Sai loại" }],
    },
  ])("rejects canonical identifiers from the wrong namespace", (input) => {
    expect(() => parseRosterSnapshot(input)).toThrow(ContractValidationError);
  });

  it("serializes objects deterministically", () => {
    expect(stableStringify({ z: 1, a: { y: 2, b: 3 } })).toBe(
      '{"a":{"b":3,"y":2},"z":1}',
    );
  });
});

describe("confirmation separation", () => {
  it("preserves the browser v1 boolean as a local-only contract", () => {
    expect(parseBrowserScanConfirmation({ confirmed: true })).toEqual({ confirmed: true });
  });

  it("never accepts browser confirmed=true as an MCP confirmation binding", () => {
    expect(() => parseConfirmationBinding({ confirmed: true })).toThrow(
      ContractValidationError,
    );
  });

  it("requires workflow, projection, and normalization binding", () => {
    const binding = parseConfirmationBinding({
      workflowVersion: "workflow:v1",
      canonicalProjectionVersion: "projection:v1",
      normalizationDigest: "sha256:abc",
    });

    expect(binding).toEqual({
      workflowVersion: "workflow:v1",
      canonicalProjectionVersion: "projection:v1",
      normalizationDigest: "sha256:abc",
    });
  });

  it("does not duplicate workflowBuildId in a confirmation binding", () => {
    expect(() =>
      parseConfirmationBinding({
        workflowVersion: "workflow:v1",
        workflowBuildId: "build:abc",
        canonicalProjectionVersion: "projection:v1",
        normalizationDigest: "sha256:abc",
      }),
    ).toThrow(ContractValidationError);
  });

  it.each([
    {
      workflowVersion: "bogus",
      canonicalProjectionVersion: "projection:v1",
      normalizationDigest: "sha256:abc",
    },
    {
      workflowVersion: "workflow:v1",
      canonicalProjectionVersion: "bogus",
      normalizationDigest: "sha256:abc",
    },
    {
      workflowVersion: "workflow:v1",
      canonicalProjectionVersion: "projection:v1",
      normalizationDigest: "bogus",
    },
  ])("rejects malformed workflow binding namespaces", (binding) => {
    expect(() => parseConfirmationBinding(binding)).toThrow(ContractValidationError);
  });
});
