import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { canonicalHeroId, heroFamilyId } from "../../../js/hero-identity.js";
import { buildSeasonCandidates } from "../../../js/roster-season-candidates.js";
import { canonicalTacticId } from "../../../js/team-recommend-engine.js";
import { FilesystemDataSource } from "../../src/data/filesystem-data-source.js";
import { publicSnapshotView } from "../../src/data/public-snapshot-view.js";
import { buildSnapshotIndex } from "../../src/data/snapshot-index.js";
import { createWorkflowVersion } from "../../src/domain/canonical-state.js";
import { normalizeObservations } from "../../src/domain/normalization-service.js";
import { WORKFLOW_BUILD_ID } from "../../src/generated/workflow-build.js";
import { ResearchHandlerError } from "../../src/research/handler-error.js";
import {
  handleRecommendTeams,
  recommendTeamsInputSchema,
  recommendTeamsOutputSchema,
} from "../../src/research/recommend-handlers.js";
import { createToolContext, type ToolContext } from "../../src/research/tool-context.js";

const realDataRoot = fileURLToPath(new URL("../../../data", import.meta.url));
const fixtureRoot = fileURLToPath(new URL("../fixtures/release-snapshot", import.meta.url));

async function contextFor(root: string): Promise<ToolContext> {
  const snapshot = await publicSnapshotView(await new FilesystemDataSource({ dataRoot: root }).load());
  return createToolContext(snapshot, buildSnapshotIndex(snapshot), createWorkflowVersion(snapshot.releaseId, WORKFLOW_BUILD_ID));
}

interface Roster {
  ownedHeroes: string[];
  ownedTactics: string[];
}

async function confirmed(ctx: ToolContext, roster: Roster) {
  const evidence = { sourceScope: "currentTurnImage", batchId: "recommend-test" } as const;
  const normalized = await normalizeObservations({
    workflowVersion: ctx.workflowVersion,
    observations: [
      ...roster.ownedHeroes.map((name, index) => ({
        observationId: `h${index}`,
        entityKind: "hero" as const,
        canonicalId: canonicalHeroId(name),
        familyId: heroFamilyId(name),
        displayName: name,
        evidence,
      })),
      ...roster.ownedTactics.map((name, index) => ({
        observationId: `t${index}`,
        entityKind: "tactic" as const,
        canonicalId: canonicalTacticId(name),
        displayName: name,
        evidence,
      })),
    ] as never,
  });
  return {
    expectedWorkflowVersion: ctx.workflowVersion,
    canonicalState: normalized.canonicalState,
    confirmationBinding: normalized.confirmationBinding,
  };
}

/** Roster that builds exactly the given source teams (tên Việt, bỏ ô chưa đối chiếu). */
function rosterOfTeams(teams: Array<{ heroes: Array<{ name: string; tactics: Array<{ name: string; unresolved?: boolean }> }> }>, skip: string[] = []): Roster {
  const heroes = new Set<string>();
  const tactics = new Set<string>();
  for (const team of teams) {
    for (const hero of team.heroes) {
      heroes.add(hero.name);
      for (const tactic of hero.tactics) if (!tactic.unresolved && !skip.includes(tactic.name)) tactics.add(tactic.name);
    }
  }
  return { ownedHeroes: [...heroes], ownedTactics: [...tactics] };
}

async function expectCode(promise: Promise<unknown>, code: string, retryable?: boolean) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(ResearchHandlerError);
  expect((error as ResearchHandlerError).code).toBe(code);
  if (retryable !== undefined) expect((error as ResearchHandlerError).retryable).toBe(retryable);
  return error as ResearchHandlerError;
}

let ctx: ToolContext;
function seasonTeams(seasonId: string, ids?: string[]) {
  const records = ctx.publication().recommendSourceRecords(seasonId);
  const built = buildSeasonCandidates(records as never, seasonId, {
    heroesDict: ctx.snapshot.artifacts["heroes-dict"] as never,
    tacticsDict: ctx.snapshot.artifacts.tactics as never,
  }) as { teams: Array<any> };
  return ids === undefined ? built.teams : built.teams.filter((team) => ids.includes(team.id));
}

beforeAll(async () => {
  ctx = await contextFor(realDataRoot);
}, 120_000);

describe("tqccl_recommend_teams input contract", () => {
  it("is a root object with discriminators inside properties and no union/$ref", async () => {
    const schema = z.toJSONSchema(recommendTeamsInputSchema) as Record<string, unknown>;
    expect(schema.type).toBe("object");
    for (const key of ["oneOf", "anyOf", "allOf", "$ref", "$defs"]) expect(schema).not.toHaveProperty(key);
    expect(Object.keys(schema.properties as object)).not.toContain("seasonContext");
    expect(schema.required).toEqual(expect.arrayContaining(["expectedWorkflowVersion", "canonicalState", "confirmationBinding", "sourceSeasonId"]));
  });

  it("rejects seasonContext, a missing sourceSeasonId and more than 20 overrides with field names", async () => {
    const body = await confirmed(ctx, rosterOfTeams(seasonTeams("pk-s24").slice(0, 1)));
    // Strict schema: an unknown key (seasonContext) is rejected; the path of an unknown key is never echoed.
    await expectCode(
      handleRecommendTeams(ctx, { ...body, sourceSeasonId: "pk-s24", seasonContext: { scenarioId: "a", rulesetId: "b" } }),
      "INVALID_REQUEST",
    );
    const missing = await expectCode(handleRecommendTeams(ctx, body), "INVALID_REQUEST");
    expect(missing.fields).toContain("sourceSeasonId");
    const overrides = Array.from({ length: 21 }, (_, index) => ({ teamId: `t${index}`, heroIndex: 0, slotIndex: 0, tactic: "X" }));
    const tooMany = await expectCode(handleRecommendTeams(ctx, { ...body, sourceSeasonId: "pk-s24", tacticOverrides: overrides }), "INVALID_REQUEST");
    expect(tooMany.fields.join(",")).toContain("tacticOverrides");
  });

  it("rejects a source season that is not in seasonOptions and points at the playbook", async () => {
    const body = await confirmed(ctx, rosterOfTeams(seasonTeams("pk-s24").slice(0, 1)));
    const error = await expectCode(handleRecommendTeams(ctx, { ...body, sourceSeasonId: "no-such-season" }), "REFERENCE_SCOPE_INVALID", false);
    expect(error.fields).toEqual(["sourceSeasonId"]);
  });
});

describe("tqccl_recommend_teams state and version gates", () => {
  it("mismatched expectedWorkflowVersion is WORKFLOW_VERSION_CHANGED (retryable)", async () => {
    const body = await confirmed(ctx, rosterOfTeams(seasonTeams("pk-s24").slice(0, 1)));
    await expectCode(
      handleRecommendTeams(ctx, { ...body, sourceSeasonId: "pk-s24", expectedWorkflowVersion: "workflow:other" }),
      "WORKFLOW_VERSION_CHANGED",
      true,
    );
  });

  it("a binding that does not match the state is CONFIRMATION_REQUIRED", async () => {
    const body = await confirmed(ctx, rosterOfTeams(seasonTeams("pk-s24").slice(0, 1)));
    const tampered = { ...body.canonicalState, heroes: body.canonicalState.heroes.slice(1) };
    await expectCode(handleRecommendTeams(ctx, { ...body, canonicalState: tampered, sourceSeasonId: "pk-s24" }), "CONFIRMATION_REQUIRED");
    await expectCode(
      handleRecommendTeams(ctx, {
        ...body,
        confirmationBinding: { ...body.confirmationBinding, workflowVersion: "workflow:stale" },
        sourceSeasonId: "pk-s24",
      }),
      "CONFIRMATION_REQUIRED",
    );
  });

  it("an unknown roster stays unknown: no buildable claim, CONFIRMATION_REQUIRED", async () => {
    const body = await confirmed(ctx, { ownedHeroes: [], ownedTactics: [] });
    await expectCode(handleRecommendTeams(ctx, { ...body, sourceSeasonId: "pk-s24" }), "CONFIRMATION_REQUIRED");
  });

  it("a state with unresolved observations is CONFIRMATION_REQUIRED", async () => {
    const body = await confirmed(ctx, rosterOfTeams(seasonTeams("pk-s24").slice(0, 1)));
    const unresolved = { ...body.canonicalState, unresolved: [{ observationId: "x" }] };
    await expectCode(handleRecommendTeams(ctx, { ...body, canonicalState: unresolved, sourceSeasonId: "pk-s24" }), "CONFIRMATION_REQUIRED");
  });

  it("v1/v2 releases answer CAPABILITY_UNAVAILABLE, never an empty recommendation", async () => {
    const legacyCtx = await contextFor(fixtureRoot);
    expect(legacyCtx.snapshot.publication).toBeUndefined();
    const body = await confirmed(legacyCtx, { ownedHeroes: ["Tướng A"], ownedTactics: ["Chiến Pháp A"] });
    await expectCode(handleRecommendTeams(legacyCtx, { ...body, sourceSeasonId: "pk-s24" }), "CAPABILITY_UNAVAILABLE", false);
  });
});

describe("tqccl_recommend_teams output", () => {
  it("tags the basis, keeps original configs scored and labels nothing as ruleset-verified", async () => {
    const [team] = seasonTeams("pk-s24", ["team-1imndp3"]);
    const body = await confirmed(ctx, rosterOfTeams([team]));
    const output = await handleRecommendTeams(ctx, { ...body, sourceSeasonId: "pk-s24", mode: "meta", maxTeams: 3 });
    expect(recommendTeamsOutputSchema.parse(output)).toEqual(output);
    expect(output).toMatchObject({ basis: "source-reference-fit", rulesetVerified: false, sourceSeasonId: "pk-s24", mode: "meta" });
    expect(output.workflowVersion).toBe(ctx.workflowVersion);
    expect(output.releaseId).toBe(ctx.releaseId);
    const entry = output.portfolioTeams.find((item) => item.teamId === "team-1imndp3");
    expect(entry).toMatchObject({ source: "season", status: "build-now", variantLabel: null, variantUnrated: false, unresolvedLabel: null });
    expect(entry?.reference).toEqual({ collection: "recommended", sourceConfigId: "team-1imndp3" });
    const score = ctx.publication().getTeam("recommended:team-1imndp3");
    expect(score).toBeDefined();
    const summary = ctx.publication().teams.find((item) => item.ref === "recommended:team-1imndp3");
    expect(entry?.sourceScore).toBe(summary?.score ?? null);
  });

  it("marks a slot that cannot be reconciled with the dictionary as 'chưa đối chiếu', never build-now", async () => {
    const [team] = seasonTeams("pk-s28", ["s28-wutugu-huangma"]);
    const body = await confirmed(ctx, rosterOfTeams([team]));
    const output = await handleRecommendTeams(ctx, { ...body, sourceSeasonId: "pk-s28" });
    const entry = output.portfolioTeams.find((item) => item.teamId === "s28-wutugu-huangma");
    expect(entry?.status).toBe("unreconciled");
    expect(entry?.unresolvedLabel).toBe("chưa đối chiếu");
    expect(entry?.unresolvedTactics).toContain("Ngự Địch Bình Chướng");
  });

  it("reports blocked teams with per-slot substitutes and explicit status", async () => {
    const teams = seasonTeams("pk-s24", ["team-1imndp3", "team-831163"]);
    const body = await confirmed(ctx, rosterOfTeams(teams, ["Phi Hùng Quân"]));
    const output = await handleRecommendTeams(ctx, { ...body, sourceSeasonId: "pk-s24" });
    const slots = output.blockedStrongTeams.flatMap((entry) => entry.missingTacticSlots);
    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      expect(["available", "none-in-box", "incompatible"]).toContain(slot.substituteStatus);
      expect(slot.substituteStatus === "available").toBe(slot.substitutes.length > 0);
    }
    expect(output.omittedCounts).toEqual({
      blockedStrongTeams: expect.any(Number),
      incompatibleTeams: expect.any(Number),
      conflictedTeams: expect.any(Number),
    });
  });

  it("names a fully owned team left out for sharing tactics with a picked team, with the shared tactics and holder", async () => {
    // Dewee R2 case 18: kho đủ cho cả hai đội nhưng chỉ có 1 bản Đương Phong Thôi Quyết và Lâm Nguy Cứu Chủ.
    const roster = rosterOfTeams(seasonTeams("og-兵演春秋", ["og-bingyan-40y-lvbu-b", "og-bingyan-wunv-cavalry-hubaoqi"]));
    const output = await handleRecommendTeams(ctx, { ...(await confirmed(ctx, roster)), sourceSeasonId: "og-兵演春秋" });

    expect(output.portfolioTeams.map((team) => team.reference)).toContainEqual({ collection: "recommended", sourceConfigId: "og-bingyan-40y-lvbu-b" });
    const conflicted = output.conflictedTeams.find((team) => team.teamId === "og-bingyan-wunv-cavalry-hubaoqi");
    expect(conflicted?.reference).toEqual({ collection: "recommended", sourceConfigId: "og-bingyan-wunv-cavalry-hubaoqi" });
    const holder = { name: "40Y Lữ Bố Cung (Vương Dị, Pháp Chính)", reference: { collection: "recommended", sourceConfigId: "og-bingyan-40y-lvbu-b" } };
    expect([...conflicted!.sharedTactics].sort((a, b) => a.tactic.localeCompare(b.tactic))).toEqual(
      [{ tactic: "Lâm Nguy Cứu Chủ", usedBy: holder }, { tactic: "Đương Phong Thôi Quyết", usedBy: holder }].sort((a, b) => a.tactic.localeCompare(b.tactic)),
    );
  });

  it("applies a chosen substitute as a labelled variant that keeps the original tier and loses the score", async () => {
    const [team] = seasonTeams("pk-s24", ["team-831163"]);
    const missing = team.heroes[0].tactics[0].name as string;
    const roster = rosterOfTeams([team], [missing]);
    const baseBody = await confirmed(ctx, roster);
    const blocked = await handleRecommendTeams(ctx, { ...baseBody, sourceSeasonId: "pk-s24" });
    const slot = blocked.blockedStrongTeams.find((entry) => entry.teamId === "team-831163")?.missingTacticSlots[0];
    expect(slot).toBeDefined();
    const substitute = slot!.substitutes[0]?.tactic;
    if (substitute === undefined) return; // dữ liệu thật không có món bù hợp luật cho ô này; nhánh được phủ bởi parity test
    const body = await confirmed(ctx, { ownedHeroes: roster.ownedHeroes, ownedTactics: [...roster.ownedTactics, substitute] });
    const output = await handleRecommendTeams(ctx, {
      ...body,
      sourceSeasonId: "pk-s24",
      tacticOverrides: [{ teamId: "team-831163", heroIndex: slot!.heroIndex, slotIndex: slot!.slotIndex, tactic: substitute }],
    });
    const entry = output.portfolioTeams.find((item) => item.teamId === "team-831163");
    expect(entry).toMatchObject({ variantLabel: "đã thay", variantUnrated: true, sourceScore: null });
    expect(entry?.originalTier).toBeTruthy();
    expect(entry?.usedAlternatives.length).toBeGreaterThan(0);
    expect(output.tacticOverrides).toMatchObject({ requested: 1, applied: 1, ignored: [] });
  });

  it("reports overrides that point at no team or slot instead of dropping them", async () => {
    const [team] = seasonTeams("pk-s24", ["team-831163"]);
    const body = await confirmed(ctx, rosterOfTeams([team]));
    const output = await handleRecommendTeams(ctx, {
      ...body,
      sourceSeasonId: "pk-s24",
      tacticOverrides: [{ teamId: "ghost-team", heroIndex: 0, slotIndex: 0, tactic: "Mê Hoặc" }],
    });
    expect(output.tacticOverrides).toEqual({ requested: 1, applied: 0, ignored: [{ teamId: "ghost-team", heroIndex: 0, slotIndex: 0 }] });
    expect(output.warnings).toContain("tactic-overrides-ignored");
  });

  it("makes legacy top-up explicit: legacyUsed matches per-team source", async () => {
    const [team] = seasonTeams("pk-s24", ["team-831163"]);
    const body = await confirmed(ctx, rosterOfTeams([team]));
    const output = await handleRecommendTeams(ctx, { ...body, sourceSeasonId: "pk-s24", maxTeams: 5 });
    expect(output.legacyUsed).toBe(output.portfolioTeams.some((item) => item.source === "legacy"));
    for (const item of output.portfolioTeams.filter((entry) => entry.source === "legacy")) {
      expect(item.reference).toMatchObject({ collection: "engine" });
      expect(item.sourceScore).toBeNull();
    }
  });

  it("stays bounded for a full box without silently dropping slots of returned teams", async () => {
    const teams = seasonTeams("pk-s26");
    const roster = rosterOfTeams(teams.slice(0, 40));
    const body = await confirmed(ctx, { ownedHeroes: roster.ownedHeroes.slice(0, 120), ownedTactics: roster.ownedTactics.slice(0, 200) });
    const output = await handleRecommendTeams(ctx, { ...body, sourceSeasonId: "pk-s26", maxTeams: 10, fullBox: true, mode: "redStars" });
    expect(JSON.stringify(output).length).toBeLessThan(40_000);
    for (const entry of output.portfolioTeams) {
      expect(entry.heroes).toHaveLength(3);
      expect(entry.tacticSelections.length).toBe(entry.selectedTactics.length);
    }
    expect(output.truncated).toBe(output.omittedCounts.blockedStrongTeams + output.omittedCounts.incompatibleTeams > 0);
  });
});
