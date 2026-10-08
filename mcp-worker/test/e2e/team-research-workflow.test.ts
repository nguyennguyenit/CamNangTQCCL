import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { canonicalHeroId, heroFamilyId } from "../../../js/hero-identity.js";
import { canonicalTacticId } from "../../../js/team-recommend-engine.js";
import { FilesystemDataSource } from "../../src/data/filesystem-data-source.js";
import { createResearchHandlers } from "../../src/research/research-handlers.js";
import { toScrubSafeDigest } from "../../src/domain/digest-encoding.js";

const dataRoot = fileURLToPath(new URL("../../../data", import.meta.url));

describe("golden team research workflow", () => {
  it("playbook → find → get → normalize → binding → recommend deterministic và fail closed khi state đổi", async () => {
    const handlers = createResearchHandlers({ dataSource: new FilesystemDataSource({ dataRoot }) });
    const playbook = await handlers.call("tqccl_get_playbook", { intent: "coexist" });
    const sourceSeasonId = playbook.seasonSelection!.sourceSeasonId;
    const found = await handlers.call("tqccl_find_teams", { collection: "recommended", sourceSeasonId, limit: 1 });
    const team = found.items[0]!;
    const detail = await handlers.call("tqccl_get_team", { reference: team.reference });
    expect(detail.team?.heroes).toHaveLength(3);

    const evidence = { sourceScope: "currentTurnImage" as const, batchId: "golden", imageOrdinal: 0 };
    const normalized = await handlers.call("tqccl_normalize_entities", {
      observations: [
        ...team.heroes.map((hero, index) => ({
          observationId: `hero-${index}`,
          entityKind: "hero" as const,
          canonicalId: canonicalHeroId(hero.nameVi) as `hero:${string}`,
          familyId: heroFamilyId(hero.nameVi) as `hero-family:${string}`,
          displayName: hero.nameVi,
          evidence,
        })),
        ...team.heroes.flatMap((hero, index) =>
          hero.tactics.map((tactic, slot) => ({
            observationId: `tactic-${index}-${slot}`,
            entityKind: "tactic" as const,
            canonicalId: canonicalTacticId(tactic.vi ?? "") as `tactic:${string}`,
            displayName: tactic.vi ?? "",
            evidence,
          })),
        ),
      ],
    });
    expect(normalized.reviewRequired).toBe(false);

    const request = {
      expectedWorkflowVersion: normalized.workflowVersion,
      canonicalState: normalized.canonicalState,
      confirmationBinding: normalized.confirmationBinding,
      sourceSeasonId,
      maxTeams: 1,
    };
    const first = await handlers.call("tqccl_recommend_teams", request);
    const second = await handlers.call("tqccl_recommend_teams", request);

    expect(second).toEqual(first);
    expect(first.basis).toBe("source-reference-fit");
    expect(first.rulesetVerified).toBe(false);
    expect(first.releaseId).toMatch(/^sha256:[a-f0-9]{64}$/u);
    // workflowVersion nhúng bản mã hoá scrub-safe của cùng releaseId đó.
    expect(first.workflowVersion).toContain(toScrubSafeDigest(first.releaseId));
    expect(first.workflowVersion).not.toMatch(/[a-fA-F0-9]{64,}/u);
    expect(first.provenance.length).toBeGreaterThan(0);
    await expect(
      handlers.call("tqccl_recommend_teams", {
        ...request,
        canonicalState: { ...normalized.canonicalState, heroes: [] },
      }),
    ).rejects.toMatchObject({ code: "CONFIRMATION_REQUIRED" });
  });
});
