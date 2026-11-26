import { describe, expect, it } from "vitest";

import { canonicalHeroId, heroFamilyId } from "../../../js/hero-identity.js";
import { buildSeasonCandidates } from "../../../js/roster-season-candidates.js";
import { createTacticNameResolver } from "../../src/data/entity-identity.js";
import { canonicalTacticId } from "../../../js/team-recommend-engine.js";
import { normalizeObservations } from "../../src/domain/normalization-service.js";
import { RESEARCH_CONTRACTS } from "../../src/research/research-contracts.js";
import { ResearchHandlerError } from "../../src/research/research-handlers.js";
import {
  buildMixedObservations,
  buildNameObservations,
  loadRosterEnv,
  loadRosterFixture,
  prepareForDomain,
  type Observation,
} from "../fixtures/normalize-full-roster.js";
import { realHandlers } from "../fixtures/real-handlers.js";

const roster = loadRosterFixture();
const handlers = realHandlers();
const evidence = (sourceScope: "currentTurnImage" | "manualCorrection" = "currentTurnImage") => ({ sourceScope, batchId: "compact-test" });
type Env = Awaited<ReturnType<typeof loadRosterEnv>>;

/** Chuẩn hoá ≤ 100 mục qua handler thật: 30 tướng (a) + 25 mục mơ hồ/không biết. */
function mixedSlice(env: Env): Observation[] {
  return buildMixedObservations(env, roster).filter((_, index) => index < 30 || index >= 238);
}

/** Roster dựng đúng một đội mùa pk-s24 (đủ để recommend trả `portfolioTeams`). */
function teamRosterObservations(env: Env) {
  const records = env.ctx.publication().recommendSourceRecords("pk-s24");
  const built = buildSeasonCandidates(records as never, "pk-s24", {
    heroesDict: env.ctx.snapshot.artifacts["heroes-dict"] as never,
    tacticsDict: env.ctx.snapshot.artifacts.tactics as never,
  }) as { teams: Array<{ id: string; heroes: Array<{ name: string; tactics: Array<{ name: string; unresolved?: boolean }> }> }> };
  const team = built.teams.find((candidate) => candidate.id === "team-1imndp3")!;
  const resolveTactic = createTacticNameResolver(env.ctx.snapshot.artifacts.tactics);
  const heroes = [...new Set(team.heroes.map((hero) => hero.name))];
  const tactics = [...new Set(team.heroes.flatMap((hero) => hero.tactics.filter((tactic) => !tactic.unresolved).map((tactic) => tactic.name)))];
  return [
    ...heroes.map((name, index) => ({
      observationId: `h${index}`,
      entityKind: "hero" as const,
      canonicalId: canonicalHeroId(name) as `hero:${string}`,
      displayName: "Tên giả của client",
      evidence: evidence(),
    })),
    ...tactics.map((name, index) => ({
      observationId: `t${index}`,
      entityKind: "tactic" as const,
      canonicalId: (resolveTactic(name) ?? canonicalTacticId(name)) as `tactic:${string}`,
      displayName: "Chiến pháp giả của client",
      evidence: evidence(),
    })),
  ];
}

describe("phase 2: kết quả normalize gọn", () => {
  it("Before 1: state không tên/evidence/confidence; observations chỉ resolved; unresolved gọn có trust", async () => {
    const env = await loadRosterEnv();
    const result = await handlers.call("tqccl_normalize_entities", { observations: mixedSlice(env) as never });
    const state = result.canonicalState;
    for (const hero of state.heroes) {
      expect(Object.keys(hero)).toEqual(expect.arrayContaining(["canonicalId", "familyId"]));
      expect(hero).not.toHaveProperty("displayName");
      expect(hero).not.toHaveProperty("evidence");
      expect(hero).not.toHaveProperty("confidence");
    }
    expect(state.unresolved!.length).toBeGreaterThan(0);
    for (const item of state.unresolved as Array<Record<string, unknown>>) {
      expect(Object.keys(item).sort()).toEqual(["candidates", "entityKind", "observationId", "reason", "trust"]);
      expect(item.trust).toBe("untrusted");
    }
    const input = mixedSlice(env);
    expect(result).not.toHaveProperty("observations");
    expect(result.resolvedIds).toHaveLength(input.length);
    const unresolvedIds = new Set((state.unresolved as Array<{ observationId: string }>).map((item) => item.observationId));
    input.forEach((observation, index) => {
      // resolvedIds[i] là canonicalId server tra tên cho observation i; null nếu chưa rõ.
      expect(result.resolvedIds[index] === null, observation.observationId).toBe(unresolvedIds.has(observation.observationId));
    });
    expect(result.reviewRequired).toBe(true);
    expect(result.provenance).toContainEqual(expect.objectContaining({ artifact: "canonical-state", trust: "untrusted" }));
  });

  it("Before 2: digest handler = digest domain cho cùng đầu vào", async () => {
    const env = await loadRosterEnv();
    const observations = mixedSlice(env);
    const viaHandler = await handlers.call("tqccl_normalize_entities", { observations: observations as never });
    const viaDomain = await normalizeObservations({
      workflowVersion: env.ctx.workflowVersion,
      observations: prepareForDomain(env.ctx, observations) as never,
    });
    expect(viaHandler.confirmationBinding).toEqual(viaDomain.confirmationBinding);
  });

  it("Before 3+4: binding bắt đổi state gọn; recommend trả tên catalog kể cả khi client gửi tên giả", async () => {
    const env = await loadRosterEnv();
    const normalized = await handlers.call("tqccl_normalize_entities", { observations: teamRosterObservations(env) as never });
    expect(normalized.reviewRequired).toBe(false);
    const base = {
      expectedWorkflowVersion: normalized.workflowVersion,
      canonicalState: normalized.canonicalState,
      confirmationBinding: normalized.confirmationBinding,
      sourceSeasonId: "pk-s24",
      maxTeams: 3,
    };
    const output = await handlers.call("tqccl_recommend_teams", base);
    const outputHeroes = output.portfolioTeams.flatMap((team) => team.heroes);
    expect(outputHeroes.length).toBeGreaterThan(0);
    for (const hero of outputHeroes) expect(hero.displayName).toBe(env.names.get(hero.canonicalId));

    // State có displayName giả của client: output vẫn là tên catalog.
    const forged = {
      ...base,
      canonicalState: {
        ...normalized.canonicalState,
        heroes: normalized.canonicalState.heroes.map((hero) => ({ ...hero, displayName: "Tên giả của client" })),
        tactics: normalized.canonicalState.tactics.map((tactic) => ({ ...tactic, displayName: "Chiến pháp giả" })),
      },
    };
    const forgedOutput = await handlers.call("tqccl_recommend_teams", forged);
    expect(JSON.stringify(forgedOutput)).not.toContain("giả");
    expect(forgedOutput.portfolioTeams.map((team) => team.teamId)).toEqual(output.portfolioTeams.map((team) => team.teamId));

    const state = normalized.canonicalState;
    const tampered: Record<string, typeof state> = {
      redStars: { ...state, heroes: state.heroes.map((hero, index) => (index === 0 ? { ...hero, redStars: (hero.redStars ?? 0) + 1 } : hero)) },
      canonicalId: { ...state, heroes: state.heroes.map((hero, index) => (index === 0 ? { ...hero, canonicalId: "hero:khac" as never } : hero)) },
      familyId: { ...state, heroes: state.heroes.map((hero, index) => (index === 0 ? { ...hero, familyId: "hero-family:khac" as never } : hero)) },
      lockedTeams: { ...state, lockedTeams: [{ teamId: "team:x" as never, heroIds: [state.heroes[0]!.canonicalId], tacticIds: [] }] },
    };
    for (const [label, canonicalState] of Object.entries(tampered)) {
      const failure = await handlers.call("tqccl_recommend_teams", { ...base, canonicalState }).catch((error: unknown) => error);
      expect(failure, label).toBeInstanceOf(ResearchHandlerError);
      expect(failure, label).toMatchObject({ code: "CONFIRMATION_REQUIRED" });
    }
  });

  it("Before 5: manualCorrection → manual: true; ảnh → không có", async () => {
    const env = await loadRosterEnv();
    const [hero, tactic] = [roster.heroes[0]!.canonicalId, roster.tactics[0]!];
    const observe = (sourceScope: "currentTurnImage" | "manualCorrection") => [
      { observationId: "h", entityKind: "hero" as const, canonicalId: hero as `hero:${string}`, evidence: evidence(sourceScope) },
      { observationId: "t", entityKind: "tactic" as const, canonicalId: tactic as `tactic:${string}`, evidence: evidence(sourceScope) },
    ];
    const manual = await handlers.call("tqccl_normalize_entities", { observations: observe("manualCorrection") });
    expect(manual.canonicalState.heroes[0]).toMatchObject({ manual: true });
    expect(manual.canonicalState.tactics[0]).toMatchObject({ manual: true });
    const image = await handlers.call("tqccl_normalize_entities", { observations: observe("currentTurnImage") });
    expect(image.canonicalState.heroes[0]).not.toHaveProperty("manual");
    expect(image.canonicalState.tactics[0]).not.toHaveProperty("manual");
    expect(heroFamilyId(env.names.get(hero)!)).toBe(image.canonicalState.heroes[0]!.familyId);
  });

  it("Before 6: roster có mục giải quyết, mơ hồ, không biết, đội khoá → output đúng schema", async () => {
    const env = await loadRosterEnv();
    const [hero, tactic] = [roster.heroes[0]!.canonicalId, roster.tactics[0]!];
    const slice = mixedSlice(env);
    const observations = [
      ...slice.slice(0, 8),
      ...slice.slice(30),
      {
        observationId: "locked",
        entityKind: "team" as const,
        canonicalId: "team:locked-a",
        heroIds: [hero],
        tacticIds: [tactic],
        evidence: evidence("manualCorrection"),
      },
    ];
    const result = await handlers.call("tqccl_normalize_entities", { observations: observations as never });
    expect(() => RESEARCH_CONTRACTS.tqccl_normalize_entities.output.parse(result)).not.toThrow();
    expect(result.canonicalState.lockedTeams).toHaveLength(1);
    expect(result.canonicalState.unresolved!.length).toBeGreaterThan(0);
    expect(result.resolvedIds.some((id) => id !== null)).toBe(true);
  });

  it("60 mục đầu của kho (a): resolvedIds khớp từng vị trí với state (null ⇔ nằm trong unresolved)", async () => {
    const env = await loadRosterEnv();
    const observations = buildNameObservations(env, roster).slice(0, 60);
    const result = await handlers.call("tqccl_normalize_entities", { observations: observations as never });
    const unresolved = new Set((result.canonicalState.unresolved as Array<{ observationId: string }>).map((item) => item.observationId));
    const heroIds = new Set(result.canonicalState.heroes.map((hero) => hero.canonicalId as string));
    expect(result.resolvedIds).toHaveLength(60);
    observations.forEach((observation, index) => {
      const id = result.resolvedIds[index];
      expect(id === null).toBe(unresolved.has(observation.observationId));
      if (id !== null) expect(heroIds.has(id!)).toBe(true);
    });
  });
});
