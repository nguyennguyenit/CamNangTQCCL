import { describe, expect, it } from "vitest";

import { normalizeObservations } from "../../src/domain/normalization-service.js";
import {
  DomainServiceError,
  recommendCoexist,
  recommendTeam,
  suggestReplacements,
} from "../../src/domain/recommendation-service.js";

const workflowVersion = "workflow:sha256-release:build-workflow";
const team = {
  id: "team-a",
  name: "Đội A",
  heroes: [
    {
      name: "Tướng A",
      baseName: "Tướng A",
      tactics: [
        { name: "Chiến Pháp Chính", alternatives: ["Chiến Pháp Phụ"] },
      ],
    },
  ],
};
const snapshot = {
  releaseId: "sha256:release-full",
  dataVersion: "data-short",
  teams: [team],
  teamTier: [
    {
      teamId: "team-a",
      rankings: [
        { tier: "T0", source: "video-260701", updatedAt: "2026-07-03" },
        { tier: "T0.5", source: "site-pk26", updatedAt: "2026-07-04" },
      ],
    },
  ],
  coexist: [{ displayName: "Đội A gần giống", note: "reference only" }],
};

async function confirmedState() {
  return normalizeObservations({
    workflowVersion,
    observations: [
      {
        observationId: "hero",
        entityKind: "hero",
        canonicalId: "hero:tuong-a",
        familyId: "hero-family:tuong-a",
        displayName: "Tướng A",
        evidence: {
          sourceScope: "currentTurnImage",
          batchId: "batch",
          fieldPresence: ["canonicalId"],
        },
      },
      {
        observationId: "tactic",
        entityKind: "tactic",
        canonicalId: "tactic:chien-phap-chinh",
        displayName: "Chiến Pháp Chính",
        evidence: {
          sourceScope: "currentTurnImage",
          batchId: "batch",
          fieldPresence: ["canonicalId"],
        },
      },
    ],
  });
}

describe("recommendation confirmation gate", () => {
  it("returns actual tier provenance and data version after exact confirmation", async () => {
    const normalized = await confirmedState();
    const result = await recommendTeam({
      snapshot,
      canonicalState: normalized.canonicalState,
      confirmationBinding: normalized.confirmationBinding,
      expectedWorkflowVersion: workflowVersion,
      workflowVersion,
    });

    expect(result.releaseId).toBe("sha256:release-full");
    expect(result.dataVersion).toBe("data-short");
    expect(result.workflowVersion).toBe(workflowVersion);
    expect(result.teams[0]?.tierRankings).toEqual(
      snapshot.teamTier[0]?.rankings.map((ranking) => ({
        ...ranking,
        trust: "untrusted",
      })),
    );
    expect(result.teams[0]?.provenance).toMatchObject({
      artifact: "teams.json",
      recordId: "team-a",
    });
  });

  it("preserves locked team identity and holder-aware tactic assignments", async () => {
    const normalized = await normalizeObservations({
      workflowVersion,
      observations: [
        {
          observationId: "hero",
          entityKind: "hero",
          canonicalId: "hero:tuong-a",
          familyId: "hero-family:tuong-a",
          displayName: "Tướng A",
          evidence: {
            sourceScope: "currentTurnImage",
            batchId: "batch",
          },
        },
        {
          observationId: "tactic",
          entityKind: "tactic",
          canonicalId: "tactic:chien-phap-chinh",
          displayName: "Chiến Pháp Chính",
          evidence: {
            sourceScope: "currentTurnImage",
            batchId: "batch",
          },
        },
        {
          observationId: "locked",
          entityKind: "team",
          canonicalId: "team:locked",
          heroIds: ["hero:tuong-a"],
          tacticIds: ["tactic:chien-phap-chinh"],
          tacticAssignments: [
            {
              holderId: "hero:tuong-a",
              tacticId: "tactic:chien-phap-chinh",
              slotIndex: 0,
            },
          ],
          evidence: {
            sourceScope: "currentTurnImage",
            batchId: "batch",
          },
        },
      ],
    });
    const result = await recommendTeam({
      snapshot,
      canonicalState: normalized.canonicalState,
      confirmationBinding: normalized.confirmationBinding,
      expectedWorkflowVersion: workflowVersion,
      workflowVersion,
    });

    expect(result.teams[0]?.team.id).toBe("team:locked");
    expect(result.teams[0]?.provenance.recordId).toBe("team:locked");
    expect(result.teams[0]?.tacticSelections).toEqual([
      expect.objectContaining({
        holderId: "hero:tuong-a",
        selectedTacticId: "tactic:chien-phap-chinh",
      }),
    ]);
  });

  it("derives a stable result slot when a locked assignment omits slotIndex", async () => {
    const normalized = await normalizeObservations({
      workflowVersion,
      observations: [
        {
          observationId: "hero",
          entityKind: "hero",
          canonicalId: "hero:tuong-a",
          familyId: "hero-family:tuong-a",
          displayName: "Tướng A",
          evidence: { sourceScope: "currentTurnImage", batchId: "batch" },
        },
        {
          observationId: "tactic",
          entityKind: "tactic",
          canonicalId: "tactic:chien-phap-chinh",
          displayName: "Chiến Pháp Chính",
          evidence: { sourceScope: "currentTurnImage", batchId: "batch" },
        },
        {
          observationId: "locked",
          entityKind: "team",
          canonicalId: "team:locked",
          heroIds: ["hero:tuong-a"],
          tacticIds: ["tactic:chien-phap-chinh"],
          tacticAssignments: [
            {
              holderId: "hero:tuong-a",
              tacticId: "tactic:chien-phap-chinh",
            },
          ],
          evidence: { sourceScope: "currentTurnImage", batchId: "batch" },
        },
      ],
    });
    const result = await recommendTeam({
      snapshot,
      canonicalState: normalized.canonicalState,
      confirmationBinding: normalized.confirmationBinding,
      expectedWorkflowVersion: workflowVersion,
      workflowVersion,
    });

    expect(result.teams[0]?.tacticSelections).toEqual([
      expect.objectContaining({ slotIndex: 0 }),
    ]);
  });

  it("rejects replay after any nested payload mutation before recommendation", async () => {
    const normalized = await confirmedState();
    const changed = {
      ...normalized.canonicalState,
      heroes: [{ ...normalized.canonicalState.heroes[0]!, redStars: 5 }],
    };

    await expect(
      recommendCoexist({
        snapshot,
        canonicalState: changed,
        confirmationBinding: normalized.confirmationBinding,
        expectedWorkflowVersion: workflowVersion,
        workflowVersion,
      }),
    ).rejects.toMatchObject({
      code: "CONFIRMATION_REQUIRED",
    } satisfies Partial<DomainServiceError>);
  });

  it("rejects a mismatched expected workflow version", async () => {
    const normalized = await confirmedState();

    await expect(
      recommendTeam({
        snapshot,
        canonicalState: normalized.canonicalState,
        confirmationBinding: normalized.confirmationBinding,
        expectedWorkflowVersion: "workflow:other",
        workflowVersion,
      }),
    ).rejects.toMatchObject({ code: "WORKFLOW_VERSION_MISMATCH" });
  });

  it("rejects unresolved ambiguity even when the digest binding is exact", async () => {
    const normalized = await normalizeObservations({
      workflowVersion,
      observations: [
        {
          observationId: "ambiguous",
          entityKind: "hero",
          observedText: "荀彧",
          reviewRequired: true,
          candidates: ["hero:sp-tuan-uc", "hero:tuan-uc"],
          evidence: {
            sourceScope: "currentTurnImage",
            batchId: "batch",
            fieldPresence: ["canonicalId"],
          },
        },
      ],
    });

    await expect(
      recommendTeam({
        snapshot,
        canonicalState: normalized.canonicalState,
        confirmationBinding: normalized.confirmationBinding,
        expectedWorkflowVersion: workflowVersion,
        workflowVersion,
      }),
    ).rejects.toMatchObject({ code: "CONFIRMATION_REQUIRED" });
  });

  it("uses coexist as reference metadata only, never a score boost", async () => {
    const normalized = await confirmedState();
    const result = await recommendCoexist({
      snapshot,
      canonicalState: normalized.canonicalState,
      confirmationBinding: normalized.confirmationBinding,
      expectedWorkflowVersion: workflowVersion,
      workflowVersion,
    });

    expect(result.teams[0]?.team.id).toBe("team-a");
    expect(result.coexistReference).toEqual([
      { ...snapshot.coexist[0], trust: "untrusted" },
    ]);
    expect(result.warnings).toContain("coexist-reference-not-scored");
  });

  it("suggests only curated tactic alternatives", async () => {
    const normalized = await confirmedState();
    const result = await suggestReplacements({
      snapshot,
      canonicalState: normalized.canonicalState,
      confirmationBinding: normalized.confirmationBinding,
      expectedWorkflowVersion: workflowVersion,
      workflowVersion,
      teamId: "team-a",
      tacticName: "Chiến Pháp Chính",
    });

    expect(result.replacements).toEqual(["Chiến Pháp Phụ"]);
    expect(result.warnings).toContain("mechanics-not-evaluated");
  });
});
